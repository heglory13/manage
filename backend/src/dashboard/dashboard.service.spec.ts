import { DashboardService } from './dashboard.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

function createMockPrisma() {
  return {
    category: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    inventoryTransaction: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    warehouseConfig: {
      findFirst: jest.fn().mockResolvedValue({ id: 'config-1', maxCapacity: 1000 }),
    },
    storageZone: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    orderPlan: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  };
}

describe('DashboardService', () => {
  it('getSummary should return category-based totals', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.category.findMany.mockResolvedValue([
      { id: 'cat-1', name: 'Ao' },
      { id: 'cat-2', name: 'Quan' },
    ]);
    mockPrisma.inventoryTransaction.findMany.mockResolvedValue([
      { categoryId: 'cat-1', type: 'STOCK_IN', quantity: 100 },
      { categoryId: 'cat-1', type: 'STOCK_OUT', quantity: 20 },
      { categoryId: 'cat-2', type: 'STOCK_IN', quantity: 40 },
    ]);
    mockPrisma.inventoryTransaction.groupBy.mockResolvedValue([
      { type: 'STOCK_IN', _sum: { quantity: 140 } },
      { type: 'STOCK_OUT', _sum: { quantity: 20 } },
    ]);

    const service = new DashboardService(mockPrisma as unknown as PrismaService);
    const result = await service.getSummary();

    expect(result.totalCategories).toBe(2);
    expect(result.totalStock).toBe(120);
    expect(result.monthlyStockIn).toBe(140);
    expect(result.monthlyStockOut).toBe(20);
  });

  it('getChartData should return 12 points for month and week periods', async () => {
    const mockPrisma = createMockPrisma();
    const service = new DashboardService(mockPrisma as unknown as PrismaService);

    const monthly = await service.getChartData('month');
    const weekly = await service.getChartData('week');

    expect(monthly.labels).toHaveLength(12);
    expect(monthly.stockIn).toHaveLength(12);
    expect(monthly.stockOut).toHaveLength(12);
    expect(weekly.labels).toHaveLength(12);
    expect(weekly.stockIn).toHaveLength(12);
    expect(weekly.stockOut).toHaveLength(12);
  });

  it('getTopCategories should sort categories by net stock descending', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.category.findMany.mockResolvedValue([
      { id: 'cat-1', name: 'Ao thun' },
      { id: 'cat-2', name: 'Quan tay' },
    ]);
    mockPrisma.inventoryTransaction.findMany.mockResolvedValue([
      { categoryId: 'cat-1', type: 'STOCK_IN', quantity: 100 },
      { categoryId: 'cat-1', type: 'STOCK_OUT', quantity: 20 },
      { categoryId: 'cat-2', type: 'STOCK_IN', quantity: 40 },
    ]);

    const service = new DashboardService(mockPrisma as unknown as PrismaService);
    const result = await service.getTopCategories('highest', 20);

    expect(result).toEqual([
      {
        rank: 1,
        categoryId: 'cat-1',
        categoryName: 'Ao thun',
        stock: 80,
      },
      {
        rank: 2,
        categoryId: 'cat-2',
        categoryName: 'Quan tay',
        stock: 40,
      },
    ]);
  });

  it('getTopCategories should sort ascending for lowest query', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.category.findMany.mockResolvedValue([
      { id: 'cat-1', name: 'Ao thun' },
      { id: 'cat-2', name: 'Quan tay' },
    ]);
    mockPrisma.inventoryTransaction.findMany.mockResolvedValue([
      { categoryId: 'cat-1', type: 'STOCK_IN', quantity: 10 },
      { categoryId: 'cat-2', type: 'STOCK_IN', quantity: 25 },
    ]);

    const service = new DashboardService(mockPrisma as unknown as PrismaService);
    const result = await service.getTopCategories('lowest', 1);

    expect(result).toEqual([
      {
        rank: 1,
        categoryId: 'cat-1',
        categoryName: 'Ao thun',
        stock: 10,
      },
    ]);
  });

  it('getTopZones should sort by usagePercent', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.storageZone.findMany.mockResolvedValue([
      { id: 'z1', name: 'A', currentStock: 80, maxCapacity: 100 },
      { id: 'z2', name: 'B', currentStock: 90, maxCapacity: 200 },
    ]);

    const service = new DashboardService(mockPrisma as unknown as PrismaService);
    const result = await service.getTopZones('highest', 10);

    expect(result[0]).toMatchObject({ id: 'z1', usagePercent: 80 });
    expect(result[1]).toMatchObject({ id: 'z2', usagePercent: 45 });
  });
});
