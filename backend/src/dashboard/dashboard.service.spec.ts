import { DashboardService } from './dashboard.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

function createMockPrisma() {
  return {
    product: {
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _sum: { stock: 0 } }),
    },
    inventoryTransaction: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    },
    warehouseConfig: {
      findFirst: jest.fn().mockResolvedValue({ id: 'config-1', maxCapacity: 1000 }),
    },
    storageZone: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

describe('DashboardService', () => {
  describe('getSummary', () => {
    it('should return correct summary with all metrics', async () => {
      const mockPrisma = createMockPrisma();
      mockPrisma.product.count.mockResolvedValue(25);
      mockPrisma.product.aggregate.mockResolvedValue({ _sum: { stock: 500 } });
      mockPrisma.inventoryTransaction.groupBy.mockResolvedValue([
        { type: 'STOCK_IN', _sum: { quantity: 200 } },
        { type: 'STOCK_OUT', _sum: { quantity: 80 } },
      ]);
      mockPrisma.warehouseConfig.findFirst.mockResolvedValue({
        id: 'config-1',
        maxCapacity: 1000,
      });

      const service = new DashboardService(mockPrisma as unknown as PrismaService);
      const result = await service.getSummary();

      expect(result.totalProducts).toBe(25);
      expect(result.totalStock).toBe(500);
      expect(result.totalInventoryValue).toBe(0);
      expect(result.monthlyStockIn).toBe(200);
      expect(result.monthlyStockOut).toBe(80);
      expect(result.capacityRatio).toBeCloseTo(0.5, 5);
    });

    it('should handle zero values gracefully', async () => {
      const mockPrisma = createMockPrisma();
      mockPrisma.product.count.mockResolvedValue(0);
      mockPrisma.product.aggregate.mockResolvedValue({ _sum: { stock: null } });
      mockPrisma.inventoryTransaction.groupBy.mockResolvedValue([]);
      mockPrisma.warehouseConfig.findFirst.mockResolvedValue(null);

      const service = new DashboardService(mockPrisma as unknown as PrismaService);
      const result = await service.getSummary();

      expect(result.totalProducts).toBe(0);
      expect(result.totalStock).toBe(0);
      expect(result.totalInventoryValue).toBe(0);
      expect(result.monthlyStockIn).toBe(0);
      expect(result.monthlyStockOut).toBe(0);
      expect(result.capacityRatio).toBe(0);
    });

    it('should filter transactions by current month', async () => {
      const mockPrisma = createMockPrisma();
      const service = new DashboardService(mockPrisma as unknown as PrismaService);

      await service.getSummary();

      const groupByCall = mockPrisma.inventoryTransaction.groupBy.mock.calls[0][0];
      expect(groupByCall.where.createdAt.gte).toBeInstanceOf(Date);
      expect(groupByCall.where.createdAt.lte).toBeInstanceOf(Date);

      // Verify it's the current month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      expect(groupByCall.where.createdAt.gte.getMonth()).toBe(startOfMonth.getMonth());
      expect(groupByCall.where.createdAt.gte.getFullYear()).toBe(startOfMonth.getFullYear());
    });
  });

  describe('getChartData', () => {
    it('should return 12 data points for monthly period', async () => {
      const mockPrisma = createMockPrisma();
      const service = new DashboardService(mockPrisma as unknown as PrismaService);

      const result = await service.getChartData('month');

      expect(result.labels).toHaveLength(12);
      expect(result.stockIn).toHaveLength(12);
      expect(result.stockOut).toHaveLength(12);
      expect(result.period).toBe('month');
    });

    it('should return 12 data points for weekly period', async () => {
      const mockPrisma = createMockPrisma();
      const service = new DashboardService(mockPrisma as unknown as PrismaService);

      const result = await service.getChartData('week');

      expect(result.labels).toHaveLength(12);
      expect(result.stockIn).toHaveLength(12);
      expect(result.stockOut).toHaveLength(12);
      expect(result.period).toBe('week');
    });

    it('should default to month period', async () => {
      const mockPrisma = createMockPrisma();
      const service = new DashboardService(mockPrisma as unknown as PrismaService);

      const result = await service.getChartData('month');

      expect(result.period).toBe('month');
    });

    it('should aggregate stock-in and stock-out data per period', async () => {
      const mockPrisma = createMockPrisma();
      // Return data for each groupBy call
      mockPrisma.inventoryTransaction.groupBy.mockImplementation(
        ({ where }: { where: { createdAt: { gte: Date; lte: Date }; type?: string } }) => {
          // Return some data for the most recent month
          const now = new Date();
          const queryMonth = where.createdAt.gte.getMonth();
          if (queryMonth === now.getMonth()) {
            return Promise.resolve([
              { type: 'STOCK_IN', _sum: { quantity: 150 } },
              { type: 'STOCK_OUT', _sum: { quantity: 75 } },
            ]);
          }
          return Promise.resolve([]);
        },
      );

      const service = new DashboardService(mockPrisma as unknown as PrismaService);
      const result = await service.getChartData('month');

      // The last entry (most recent month) should have data
      expect(result.stockIn[11]).toBe(150);
      expect(result.stockOut[11]).toBe(75);
    });

    it('should format monthly labels as MM/YYYY', async () => {
      const mockPrisma = createMockPrisma();
      const service = new DashboardService(mockPrisma as unknown as PrismaService);

      const result = await service.getChartData('month');

      // Each label should match MM/YYYY format
      for (const label of result.labels) {
        expect(label).toMatch(/^\d{2}\/\d{4}$/);
      }
    });

    it('should format weekly labels as DD/MM', async () => {
      const mockPrisma = createMockPrisma();
      const service = new DashboardService(mockPrisma as unknown as PrismaService);

      const result = await service.getChartData('week');

      // Each label should match DD/MM format
      for (const label of result.labels) {
        expect(label).toMatch(/^\d{2}\/\d{2}$/);
      }
    });
  });

  describe('getTopProducts', () => {
    it('should aggregate stock by classification and sort highest first', async () => {
      const mockPrisma = createMockPrisma();
      mockPrisma.inventoryTransaction.findMany.mockResolvedValue([
        {
          type: 'STOCK_IN',
          quantity: 100,
          product: { id: 'p1', name: 'Ao', sku: 'AO-01' },
          skuCombo: {
            classification: { id: 'cls-1', name: 'Ao thun' },
          },
        },
        {
          type: 'STOCK_OUT',
          quantity: 20,
          product: { id: 'p1', name: 'Ao', sku: 'AO-01' },
          skuCombo: {
            classification: { id: 'cls-1', name: 'Ao thun' },
          },
        },
        {
          type: 'STOCK_IN',
          quantity: 40,
          product: { id: 'p2', name: 'Quan', sku: 'QUAN-01' },
          skuCombo: {
            classification: { id: 'cls-2', name: 'Quan tay' },
          },
        },
      ]);

      const service = new DashboardService(mockPrisma as unknown as PrismaService);
      const result = await service.getTopProducts('highest', 20);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        rank: 1,
        id: 'cls-1',
        name: 'Ao thun',
        stock: 80,
      });
      expect(result[1]).toMatchObject({
        rank: 2,
        id: 'cls-2',
        name: 'Quan tay',
        stock: 40,
      });
    });

    it('should sort lowest first when requested', async () => {
      const mockPrisma = createMockPrisma();
      mockPrisma.inventoryTransaction.findMany.mockResolvedValue([
        {
          type: 'STOCK_IN',
          quantity: 10,
          product: { id: 'p1', name: 'Ao', sku: 'AO-01' },
          skuCombo: {
            classification: { id: 'cls-1', name: 'Ao thun' },
          },
        },
        {
          type: 'STOCK_IN',
          quantity: 25,
          product: { id: 'p2', name: 'Quan', sku: 'QUAN-01' },
          skuCombo: {
            classification: { id: 'cls-2', name: 'Quan tay' },
          },
        },
      ]);

      const service = new DashboardService(mockPrisma as unknown as PrismaService);
      const result = await service.getTopProducts('lowest', 1);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        rank: 1,
        id: 'cls-1',
        stock: 10,
      });
    });
  });

  describe('getTopZones', () => {
    it('should sort zones by usage percent instead of current stock', async () => {
      const mockPrisma = createMockPrisma();
      mockPrisma.storageZone.findMany.mockResolvedValue([
        { id: 'z1', name: 'A', currentStock: 80, maxCapacity: 100 },
        { id: 'z2', name: 'B', currentStock: 90, maxCapacity: 200 },
      ]);

      const service = new DashboardService(mockPrisma as unknown as PrismaService);
      const result = await service.getTopZones('highest', 10);

      expect(result[0]).toMatchObject({
        id: 'z1',
        usagePercent: 80,
      });
      expect(result[1]).toMatchObject({
        id: 'z2',
        usagePercent: 45,
      });
    });
  });
});
