import * as fc from 'fast-check';
import { BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

function createMockPrisma(initialStock = 0) {
  let categoryStock = initialStock;
  let lastTransaction: Record<string, unknown> | null = null;

  const transactions: Array<{ categoryId: string; type: 'STOCK_IN' | 'STOCK_OUT'; quantity: number; status: 'ACTIVE' }> = [
    ...(initialStock > 0
      ? [{ categoryId: 'cat-1', type: 'STOCK_IN' as const, quantity: initialStock, status: 'ACTIVE' as const }]
      : []),
  ];

  const mockPrisma = {
    category: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) => {
        if (where.id === 'missing-category') return Promise.resolve(null);
        return Promise.resolve({ id: where.id, name: `Category ${where.id}` });
      }),
      findMany: jest.fn().mockResolvedValue([{ id: 'cat-1', name: 'Category 1' }]),
    },
    inventoryTransaction: {
      findFirst: jest.fn().mockResolvedValue({ purchasePrice: 100 }),
      findMany: jest.fn().mockImplementation(({ where }: { where?: { categoryId?: string; status?: string } }) => {
        if (!where?.categoryId) return Promise.resolve(transactions);
        return Promise.resolve(
          transactions.filter(
            (item) =>
              item.categoryId === where.categoryId &&
              (!where.status || item.status === where.status),
          ),
        );
      }),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        lastTransaction = {
          id: 'txn-1',
          ...data,
          createdAt: new Date(),
        };
        const type = data.type as 'STOCK_IN' | 'STOCK_OUT';
        const quantity = Number(data.quantity);
        transactions.push({
          categoryId: String(data.categoryId),
          type,
          quantity,
          status: 'ACTIVE',
        });
        categoryStock += type === 'STOCK_IN' ? quantity : -quantity;
        return Promise.resolve(lastTransaction);
      }),
      count: jest.fn().mockResolvedValue(0),
    },
    warehouseConfig: {
      findFirst: jest.fn().mockResolvedValue({ id: 'config-1', maxCapacity: 1000 }),
    },
    warehousePosition: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    storageZone: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    preliminaryCheck: {
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn().mockImplementation((ops: Array<Promise<unknown>>) => Promise.all(ops)),
    getCurrentStock: () => categoryStock,
    getLastTransaction: () => lastTransaction,
  };

  return mockPrisma;
}

describe('InventoryService', () => {
  it('stockIn should increase stock for the target category', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.nat({ max: 10000 }),
        fc.integer({ min: 1, max: 10000 }),
        async (initialStock, quantity) => {
          const mockPrisma = createMockPrisma(initialStock);
          const service = new InventoryService(mockPrisma as unknown as PrismaService);

          await service.stockIn('cat-1', quantity, 'user-1', {
            purchasePrice: 100,
            salePrice: 150,
          });

          expect(mockPrisma.getCurrentStock()).toBe(initialStock + quantity);
        },
      ),
    );
  });

  it('stockOut should decrease stock for the target category', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 0, max: 10000 }),
        async (quantity, extra) => {
          const initialStock = quantity + extra;
          const mockPrisma = createMockPrisma(initialStock);
          const service = new InventoryService(mockPrisma as unknown as PrismaService);

          await service.stockOut('cat-1', quantity, 'user-1');

          expect(mockPrisma.getCurrentStock()).toBe(initialStock - quantity);
        },
      ),
    );
  });

  it('should reject invalid quantity for stockIn and stockOut', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: -100, max: 0 }), async (quantity) => {
        const mockPrisma = createMockPrisma(100);
        const service = new InventoryService(mockPrisma as unknown as PrismaService);

        await expect(service.stockIn('cat-1', quantity, 'user-1')).rejects.toThrow(BadRequestException);
        await expect(service.stockOut('cat-1', quantity, 'user-1')).rejects.toThrow(BadRequestException);
      }),
    );
  });

  it('should not allow stockOut to exceed current category stock', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.nat({ max: 9999 }),
        fc.integer({ min: 1, max: 10000 }),
        async (stock, extra) => {
          const quantity = stock + extra;
          const mockPrisma = createMockPrisma(stock);
          const service = new InventoryService(mockPrisma as unknown as PrismaService);

          await expect(service.stockOut('cat-1', quantity, 'user-1')).rejects.toThrow(
            'Không thể xuất quá số lượng tồn kho hiện tại',
          );
        },
      ),
    );
  });

  it('should create transactions with categoryId only in the new inventory flow', async () => {
    const mockPrisma = createMockPrisma(50);
    const service = new InventoryService(mockPrisma as unknown as PrismaService);

    await service.stockIn('cat-1', 10, 'user-1', {
      purchasePrice: 100,
      salePrice: 150,
    });

    const stockInTxn = mockPrisma.getLastTransaction();
    expect(stockInTxn).toMatchObject({
      categoryId: 'cat-1',
      type: 'STOCK_IN',
      quantity: 10,
      userId: 'user-1',
    });

    await service.stockOut('cat-1', 5, 'user-1');
    const stockOutTxn = mockPrisma.getLastTransaction();
    expect(stockOutTxn).toMatchObject({
      categoryId: 'cat-1',
      type: 'STOCK_OUT',
      quantity: 5,
      userId: 'user-1',
    });
  });

  it('getCapacityRatio should use active inventory transactions', async () => {
    const mockPrisma = createMockPrisma(0);
    const service = new InventoryService(mockPrisma as unknown as PrismaService);

    const result = await service.getCapacityRatio();

    expect(result.currentTotal).toBe(0);
    expect(result.maxCapacity).toBe(1000);
    expect(result.ratio).toBe(0);
    expect(result.isWarning).toBe(false);
  });
});
