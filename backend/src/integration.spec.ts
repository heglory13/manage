import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';
import { PreliminaryCheckService } from './preliminary-check/preliminary-check.service.js';
import { ReportService } from './report/report.service.js';
import { StocktakingService } from './stocktaking/stocktaking.service.js';
import { WarehouseService } from './warehouse/warehouse.service.js';

describe('Integration: Warehouse flow', () => {
  it('create layout -> toggle cells -> set capacity -> drag/drop', async () => {
    const positions = [
      {
        id: 'p1',
        layoutId: 'L1',
        row: 0,
        column: 0,
        label: 'A1',
        isActive: true,
        currentStock: 0,
        productId: null,
        maxCapacity: null as number | null,
      },
      {
        id: 'p2',
        layoutId: 'L1',
        row: 0,
        column: 1,
        label: 'A2',
        isActive: true,
        currentStock: 0,
        productId: null,
        maxCapacity: null as number | null,
      },
    ];

    const mockPrisma: any = {
      warehousePosition: {
        findUnique: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(positions.find((p) => p.id === where.id) ?? null),
        ),
        findFirst: jest.fn().mockImplementation(({ where }: any) => {
          if (where.layoutId && where.row !== undefined && where.column !== undefined) {
            return Promise.resolve(
              positions.find(
                (p) =>
                  p.layoutId === where.layoutId &&
                  p.row === where.row &&
                  p.column === where.column,
              ) ?? null,
            );
          }
          if (where.label) {
            return Promise.resolve(
              positions.find((p) => p.label === where.label && p.id !== where.id?.not) ?? null,
            );
          }
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ where, data }: any) => {
          const pos = positions.find((p) => p.id === where.id);
          if (pos) Object.assign(pos, data);
          return Promise.resolve({ ...pos, product: null });
        }),
      },
      storageZone: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) =>
        Promise.all(ops),
      ),
    };

    const service = new WarehouseService(mockPrisma as PrismaService);

    const toggled = await service.toggleActive('p1');
    expect(toggled.isActive).toBe(false);

    positions[0].isActive = false;
    const reactivated = await service.toggleActive('p1');
    expect(reactivated.isActive).toBe(true);

    positions[0].isActive = true;
    const withCapacity = await service.updateCapacity('p1', 50);
    expect(withCapacity.maxCapacity).toBe(50);

    positions[0].maxCapacity = 50;
    mockPrisma.warehousePosition.findFirst.mockResolvedValueOnce(positions[1]);
    const swapped = await service.movePosition('p1', 0, 1);
    expect(swapped).toHaveLength(2);
  });
});

describe('Integration: Stocktaking V2 flow', () => {
  it('create full -> submit -> approve -> verify adjustment transactions', async () => {
    const categories = [
      { id: 'c1', code: 'CAT-1', name: 'Category 1', stock: 100 },
      { id: 'c2', code: 'CAT-2', name: 'Category 2', stock: 50 },
    ];
    const stockState = new Map(categories.map((item) => [item.id, item.stock]));
    const createdTransactions: Array<Record<string, unknown>> = [];

    const mockPrisma: any = {
      category: {
        findMany: jest.fn().mockImplementation((args?: any) => {
          const ids = args?.where?.id?.in;
          const source = ids
            ? categories.filter((item) => ids.includes(item.id))
            : categories;
          return Promise.resolve(
            source.map((item) => ({
              id: item.id,
              code: item.code,
              name: item.name,
            })),
          );
        }),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      preliminaryCheck: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      inventoryTransaction: {
        findFirst: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(
            stockState.has(where.categoryId)
              ? { purchasePrice: 100, salePrice: 120 }
              : null,
          ),
        ),
        create: jest.fn().mockImplementation(({ data }: any) => {
          createdTransactions.push(data);
          const current = stockState.get(data.categoryId) ?? 0;
          stockState.set(
            data.categoryId,
            data.type === 'STOCK_IN' ? current + data.quantity : current - data.quantity,
          );
          return Promise.resolve({ id: `txn-${createdTransactions.length}`, ...data });
        }),
      },
      stocktakingRecord: {
        create: jest.fn().mockImplementation(({ data }: any) => {
          const items = data.items.create.map((item: any, index: number) => ({
            id: `item-${index}`,
            recordId: 'r-1',
            ...item,
            product: null,
            category: {
              id: item.categoryId,
              code: item.itemCode,
              name: item.itemLabel,
            },
            discrepancyReason: null,
          }));
          return Promise.resolve({
            id: 'r-1',
            status: data.status,
            mode: data.mode,
            cutoffTime: data.cutoffTime,
            submittedAt: null,
            createdBy: data.createdBy,
            createdAt: new Date(),
            updatedAt: new Date(),
            items,
            creator: {
              id: 'user-1',
              name: 'User',
              email: 'u@t.com',
              role: 'STAFF',
            },
          });
        }),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      stocktakingItem: {
        update: jest.fn().mockResolvedValue({}),
      },
      stocktakingStatusHistory: {
        create: jest.fn().mockResolvedValue({ id: 'h-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) =>
        Promise.all(ops),
      ),
    };

    const mockInventoryService = {
      getCurrentStockByCategory: jest.fn().mockImplementation((categoryId: string) =>
        Promise.resolve(stockState.get(categoryId) ?? 0),
      ),
    };

    const service = new StocktakingService(
      mockPrisma as PrismaService,
      mockInventoryService as any,
    );

    const record = await service.create('full', 'user-1');
    expect(record.status).toBe('CHECKING');
    expect(record.items).toHaveLength(2);

    mockPrisma.stocktakingRecord.findUnique.mockResolvedValue({
      id: 'r-1',
      status: 'CHECKING',
      items: record.items.map((item: any) => ({
        ...item,
        actualQuantity: 0,
        discrepancy: 0,
        discrepancyReason: null,
        evidenceUrl: null,
      })),
    });
    mockPrisma.stocktakingRecord.update.mockResolvedValue({ id: 'r-1', status: 'PENDING' });
    mockPrisma.stocktakingRecord.findUnique.mockResolvedValueOnce({
      id: 'r-1',
      status: 'CHECKING',
      items: record.items,
    });

    await service.submit('r-1', [
      { itemId: 'item-0', actualQuantity: 95, discrepancyReason: 'Hàng hỏng' },
      { itemId: 'item-1', actualQuantity: 50 },
    ]);

    mockPrisma.stocktakingRecord.findUnique.mockResolvedValue({
      id: 'r-1',
      status: 'PENDING',
      createdBy: 'user-1',
      items: [
        {
          id: 'item-0',
          categoryId: 'c1',
          itemCode: 'CAT-1',
          itemLabel: 'Category 1',
          systemQuantity: 100,
          actualQuantity: 95,
          discrepancy: -5,
        },
        {
          id: 'item-1',
          categoryId: 'c2',
          itemCode: 'CAT-2',
          itemLabel: 'Category 2',
          systemQuantity: 50,
          actualQuantity: 50,
          discrepancy: 0,
        },
      ],
    });
    mockPrisma.stocktakingRecord.update.mockResolvedValue({
      id: 'r-1',
      status: 'APPROVED',
      items: [],
      creator: { id: 'user-1', name: 'U', email: 'u@t.com', role: 'MANAGER' },
    });

    await service.approve('r-1', 'user-1');

    expect(createdTransactions).toHaveLength(1);
    expect(createdTransactions[0]).toMatchObject({
      categoryId: 'c1',
      type: 'STOCK_OUT',
      quantity: 5,
    });
    expect(stockState.get('c1')).toBe(95);
    expect(stockState.get('c2')).toBe(50);
  });
});

describe('Integration: Preliminary -> Detail flow', () => {
  it('create preliminary -> verify PENDING status', async () => {
    const mockPrisma: any = {
      classification: {
        findUnique: jest.fn().mockResolvedValue({ id: 'cls-1', name: 'Áo' }),
      },
      warehouseType: {
        findUnique: jest.fn().mockResolvedValue({ id: 'wt-1', name: 'Kho sản xuất' }),
      },
      preliminaryCheck: {
        create: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({
            id: 'pc-1',
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
            classification: { id: data.classificationId, name: 'Áo' },
            warehouseType: { id: data.warehouseTypeId, name: 'Kho sản xuất' },
            creator: { id: data.createdBy, name: 'User', email: 'u@t.com' },
          }),
        ),
      },
    };

    const service = new PreliminaryCheckService(mockPrisma as PrismaService);

    const check = await service.create(
      { classificationId: 'cls-1', quantity: 100, warehouseTypeId: 'wt-1' },
      'user-1',
    );

    expect(check.status).toBe('PENDING');
    expect(check.quantity).toBe(100);
  });
});

describe('Integration: NXT Report flow', () => {
  it('getNxtReport maintains closingStock = openingStock + totalIn - totalOut', async () => {
    const mockPrisma: any = {
      category: {
        findMany: jest.fn().mockResolvedValue([{ id: 'c1', name: 'Danh mục 1' }]),
      },
      inventoryTransaction: {
        findMany: jest.fn().mockResolvedValue([
          {
            categoryId: 'c1',
            category: { id: 'c1', name: 'Danh mục 1' },
            type: 'STOCK_IN',
            quantity: 100,
            purchasePrice: 10,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
          {
            categoryId: 'c1',
            category: { id: 'c1', name: 'Danh mục 1' },
            type: 'STOCK_OUT',
            quantity: 30,
            purchasePrice: 10,
            createdAt: new Date('2026-01-02T00:00:00.000Z'),
          },
          {
            categoryId: 'c1',
            category: { id: 'c1', name: 'Danh mục 1' },
            type: 'STOCK_IN',
            quantity: 50,
            purchasePrice: 10,
            createdAt: new Date('2026-02-05T00:00:00.000Z'),
          },
          {
            categoryId: 'c1',
            category: { id: 'c1', name: 'Danh mục 1' },
            type: 'STOCK_OUT',
            quantity: 20,
            purchasePrice: 10,
            createdAt: new Date('2026-02-10T00:00:00.000Z'),
          },
        ]),
      },
    };

    const service = new ReportService(mockPrisma as PrismaService);
    const result = await service.getNxtReport('2026-02-01', '2026-02-28');

    expect(result).toHaveLength(1);
    const item = result[0];
    expect(item.openingStock).toBe(70);
    expect(item.totalIn).toBe(50);
    expect(item.totalOut).toBe(20);
    expect(item.closingStock).toBe(100);
    expect(item.closingStock).toBe(item.openingStock + item.totalIn - item.totalOut);
  });
});

describe('Integration: Excel Import flow', () => {
  it('validateImportRow rejects missing required fields', () => {
    const service = new ReportService({} as PrismaService);

    const lookups = {
      categories: new Map([['áo', 'cat-1']]),
      conditions: new Map([['đạt tiêu chuẩn', 'cond-1']]),
    };

    const result1 = service.validateImportRow({ category: '', quantity: 10 }, 2, lookups);
    expect(result1.valid).toBe(false);
    expect(result1.errors.some((error) => error.field === 'Danh mục')).toBe(true);

    const result2 = service.validateImportRow({ category: 'Áo', quantity: 0 }, 3, lookups);
    expect(result2.valid).toBe(false);
    expect(result2.errors.some((error) => error.field === 'Số lượng')).toBe(true);

    const result3 = service.validateImportRow({ category: 'Áo', quantity: 10 }, 4, lookups);
    expect(result3.valid).toBe(true);
  });
});

describe('Integration: Guard rails', () => {
  it('still surfaces framework exceptions for invalid warehouse actions', async () => {
    const service = new WarehouseService({
      warehousePosition: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as any);

    await expect(service.movePosition('missing', 0, 0)).rejects.toThrow(NotFoundException);
    await expect(service.updateCapacity('missing', 0)).rejects.toThrow(NotFoundException);
  });
});
