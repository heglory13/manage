import * as fc from 'fast-check';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StocktakingService } from './stocktaking.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Feature: system-upgrade-v2
 * Unit + Property-Based Tests for Stocktaking Module V2
 */

// Helper to create a mock PrismaService for stocktaking tests
function createMockPrisma(
  productsMap: Map<string, { id: string; stock: number }> = new Map(),
) {
  const stockState = new Map<string, number>();
  productsMap.forEach((p, id) => stockState.set(id, p.stock));

  let recordIdCounter = 0;

  const mockPrisma = {
    product: {
      findMany: jest.fn().mockImplementation((args?: { where?: Record<string, unknown> }) => {
        if (!args?.where || Object.keys(args.where).length === 0) {
          // mode='full' — return all products
          return Promise.resolve(
            Array.from(productsMap.values()).map((p) => ({
              id: p.id,
              name: `Product ${p.id}`,
              sku: `SKU-${p.id}`,
              price: 100,
              categoryId: 'cat-1',
              stock: stockState.get(p.id) ?? p.stock,
              createdAt: new Date(),
              updatedAt: new Date(),
            })),
          );
        }
        const ids = (args.where.id as { in: string[] })?.in;
        if (!ids) return Promise.resolve([]);
        return Promise.resolve(
          ids
            .map((id: string) => {
              const product = productsMap.get(id);
              if (!product) return null;
              return {
                id: product.id,
                name: `Product ${product.id}`,
                sku: `SKU-${product.id}`,
                price: 100,
                categoryId: 'cat-1',
                stock: stockState.get(id) ?? product.stock,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
            })
            .filter(Boolean),
        );
      }),
      update: jest.fn().mockImplementation(({ where, data }: { where: { id: string }; data: { stock: number } }) => {
        stockState.set(where.id, data.stock);
        return Promise.resolve({ id: where.id, stock: data.stock });
      }),
    },
    stocktakingRecord: {
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        const recordId = `record-${++recordIdCounter}`;
        const itemsCreate = (data.items as { create: Array<Record<string, unknown>> }).create;
        const items = itemsCreate.map(
          (item: Record<string, unknown>, index: number) => ({
            id: `item-${recordId}-${index}`,
            recordId,
            ...item,
            product: productsMap.get(item.productId as string)
              ? { id: item.productId, name: `Product ${item.productId}` }
              : null,
          }),
        );
        return Promise.resolve({
          id: recordId,
          status: data.status,
          mode: data.mode,
          cutoffTime: data.cutoffTime,
          submittedAt: data.submittedAt || null,
          createdBy: data.createdBy,
          createdAt: new Date(),
          updatedAt: new Date(),
          items,
          creator: { id: data.createdBy, name: 'Test User', email: 'test@test.com', role: 'STAFF' },
        });
      }),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    stocktakingItem: {
      update: jest.fn().mockImplementation(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        return Promise.resolve({ id: where.id, ...data });
      }),
    },
    stocktakingStatusHistory: {
      create: jest.fn().mockResolvedValue({ id: 'history-1' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn().mockImplementation((operations: Promise<unknown>[]) => {
      return Promise.all(operations);
    }),
    getStockState: () => stockState,
  };

  return mockPrisma;
}

describe('StocktakingService V2', () => {
  describe('create() - mode full/selected', () => {
    it('should create a CHECKING record with all products when mode=full', async () => {
      const productsMap = new Map([
        ['p1', { id: 'p1', stock: 10 }],
        ['p2', { id: 'p2', stock: 20 }],
        ['p3', { id: 'p3', stock: 5 }],
      ]);
      const mockPrisma = createMockPrisma(productsMap);
      const service = new StocktakingService(mockPrisma as unknown as PrismaService);

      const result = await service.create('full', 'user-1');

      expect(result.status).toBe('CHECKING');
      expect(result.mode).toBe('full');
      expect(result.items).toHaveLength(3);
      expect(result.cutoffTime).toBeDefined();
      // Status history should be recorded
      expect(mockPrisma.stocktakingStatusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CHECKING' }),
        }),
      );
    });

    it('should create a CHECKING record with selected products when mode=selected', async () => {
      const productsMap = new Map([
        ['p1', { id: 'p1', stock: 10 }],
        ['p2', { id: 'p2', stock: 20 }],
        ['p3', { id: 'p3', stock: 5 }],
      ]);
      const mockPrisma = createMockPrisma(productsMap);
      const service = new StocktakingService(mockPrisma as unknown as PrismaService);

      const result = await service.create('selected', 'user-1', ['p1', 'p3']);

      expect(result.status).toBe('CHECKING');
      expect(result.mode).toBe('selected');
      expect(result.items).toHaveLength(2);
    });

    it('should throw when mode=selected with no productIds', async () => {
      const mockPrisma = createMockPrisma(new Map());
      const service = new StocktakingService(mockPrisma as unknown as PrismaService);

      await expect(service.create('selected', 'user-1', [])).rejects.toThrow(BadRequestException);
      await expect(service.create('selected', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('submit() - discrepancyReason validation', () => {
    it('should reject submit when items with discrepancy lack reason', async () => {
      const productsMap = new Map([['p1', { id: 'p1', stock: 10 }]]);
      const mockPrisma = createMockPrisma(productsMap);

      mockPrisma.stocktakingRecord.findUnique.mockResolvedValue({
        id: 'record-1',
        status: 'CHECKING',
        items: [
          { id: 'item-1', productId: 'p1', systemQuantity: 10, actualQuantity: 0, discrepancy: 0, evidenceUrl: null, discrepancyReason: null },
        ],
      });

      const service = new StocktakingService(mockPrisma as unknown as PrismaService);

      // Submit with discrepancy but no reason
      await expect(
        service.submit('record-1', [
          { itemId: 'item-1', actualQuantity: 8 },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept submit when items with discrepancy have reason', async () => {
      const productsMap = new Map([['p1', { id: 'p1', stock: 10 }]]);
      const mockPrisma = createMockPrisma(productsMap);

      mockPrisma.stocktakingRecord.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
        if (where.id === 'record-1') {
          return Promise.resolve({
            id: 'record-1',
            status: 'CHECKING',
            items: [
              { id: 'item-1', productId: 'p1', systemQuantity: 10, actualQuantity: 0, discrepancy: 0, evidenceUrl: null, discrepancyReason: null },
            ],
          });
        }
        return Promise.resolve(null);
      });

      // For the final findUnique after submit
      mockPrisma.stocktakingRecord.update.mockResolvedValue({
        id: 'record-1',
        status: 'PENDING',
      });

      const service = new StocktakingService(mockPrisma as unknown as PrismaService);

      const result = await service.submit('record-1', [
        { itemId: 'item-1', actualQuantity: 8, discrepancyReason: 'Hàng bị hỏng' },
      ]);

      // Should have called $transaction
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should reject submit when record is not CHECKING', async () => {
      const mockPrisma = createMockPrisma(new Map());
      mockPrisma.stocktakingRecord.findUnique.mockResolvedValue({
        id: 'record-1',
        status: 'PENDING',
        items: [],
      });

      const service = new StocktakingService(mockPrisma as unknown as PrismaService);

      await expect(
        service.submit('record-1', []),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approve/reject - status transitions', () => {
    it('should only approve from PENDING status', async () => {
      const mockPrisma = createMockPrisma(new Map());
      mockPrisma.stocktakingRecord.findUnique.mockResolvedValue({
        id: 'record-1',
        status: 'CHECKING',
        items: [],
      });

      const service = new StocktakingService(mockPrisma as unknown as PrismaService);

      await expect(service.approve('record-1')).rejects.toThrow(BadRequestException);
    });

    it('should only reject from PENDING status', async () => {
      const mockPrisma = createMockPrisma(new Map());
      mockPrisma.stocktakingRecord.findUnique.mockResolvedValue({
        id: 'record-1',
        status: 'APPROVED',
      });

      const service = new StocktakingService(mockPrisma as unknown as PrismaService);

      await expect(service.reject('record-1')).rejects.toThrow(BadRequestException);
    });

    it('should record status history on approve', async () => {
      const productsMap = new Map([['p1', { id: 'p1', stock: 10 }]]);
      const mockPrisma = createMockPrisma(productsMap);

      mockPrisma.stocktakingRecord.findUnique.mockResolvedValue({
        id: 'record-1',
        status: 'PENDING',
        items: [{ id: 'item-1', productId: 'p1', systemQuantity: 10, actualQuantity: 8, discrepancy: -2 }],
      });
      mockPrisma.stocktakingRecord.update.mockResolvedValue({
        id: 'record-1',
        status: 'APPROVED',
        items: [],
        creator: { id: 'user-1', name: 'Test', email: 'test@test.com', role: 'MANAGER' },
      });

      const service = new StocktakingService(mockPrisma as unknown as PrismaService);
      await service.approve('record-1', 'user-1');

      expect(mockPrisma.stocktakingStatusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'APPROVED', changedBy: 'user-1' }),
        }),
      );
    });
  });

  describe('getStatusHistory()', () => {
    it('should throw NotFoundException for non-existent record', async () => {
      const mockPrisma = createMockPrisma(new Map());
      mockPrisma.stocktakingRecord.findUnique.mockResolvedValue(null);

      const service = new StocktakingService(mockPrisma as unknown as PrismaService);

      await expect(service.getStatusHistory('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  /**
   * Property 16: Tính toán chênh lệch kiểm kê
   * **Validates: Requirements 12.2**
   */
  describe('Property 16: Tính toán chênh lệch', () => {
    it('discrepancy = actual - system cho mọi (system, actual)', () => {
      const service = new StocktakingService({} as PrismaService);

      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100000 }),
          fc.integer({ min: 0, max: 100000 }),
          (systemQuantity, actualQuantity) => {
            const items = [{ systemQuantity, actualQuantity }];
            const result = service.calculateDiscrepancies(items);
            expect(result[0].discrepancy).toBe(actualQuantity - systemQuantity);
          },
        ),
      );
    });
  });

  /**
   * Property: validateDiscrepancyReasons
   */
  describe('validateDiscrepancyReasons', () => {
    it('rejects when discrepancy != 0 and no reason', () => {
      const service = new StocktakingService({} as PrismaService);

      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100000 }),
          (discrepancy) => {
            const result = service.validateDiscrepancyReasons([
              { discrepancy, discrepancyReason: null },
            ]);
            expect(result.valid).toBe(false);
          },
        ),
      );
    });

    it('accepts when discrepancy = 0 regardless of reason', () => {
      const service = new StocktakingService({} as PrismaService);
      const result = service.validateDiscrepancyReasons([
        { discrepancy: 0, discrepancyReason: null },
      ]);
      expect(result.valid).toBe(true);
    });
  });
});
