import * as fc from 'fast-check';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Feature: inventory-management-system
 * Property-Based Tests for Inventory Module
 */

// Helper to create a mock PrismaService
function createMockPrisma(initialStock = 0) {
  let currentStock = initialStock;
  let lastTransaction: Record<string, unknown> | null = null;

  const mockPrisma = {
    product: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) => {
        if (where.id === 'nonexistent') return Promise.resolve(null);
        return Promise.resolve({
          id: where.id,
          name: 'Test Product',
          sku: 'TEST-001-20240101',
          price: 100,
          categoryId: 'cat-1',
          stock: currentStock,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }),
      update: jest.fn().mockImplementation(({ data }: { data: { stock: { increment?: number; decrement?: number } } }) => {
        if (data.stock.increment) {
          currentStock += data.stock.increment;
        }
        if (data.stock.decrement) {
          currentStock -= data.stock.decrement;
        }
        return Promise.resolve({ stock: currentStock });
      }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockImplementation(() => {
        return Promise.resolve({ _sum: { stock: currentStock } });
      }),
    },
    inventoryTransaction: {
      findFirst: jest.fn().mockResolvedValue({ purchasePrice: 100 }),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        lastTransaction = {
          id: 'txn-' + Math.random().toString(36).substring(7),
          ...data,
          createdAt: new Date(),
        };
        return Promise.resolve(lastTransaction);
      }),
    },
    warehouseConfig: {
      findFirst: jest.fn().mockResolvedValue({ id: 'config-1', maxCapacity: 1000 }),
    },
    $transaction: jest.fn().mockImplementation((operations: Promise<unknown>[]) => {
      return Promise.all(operations);
    }),
    getCurrentStock: () => currentStock,
    getLastTransaction: () => lastTransaction,
  };

  return mockPrisma;
}

describe('InventoryService - Property-Based Tests', () => {
  /**
   * Property 8: Nhập kho tăng tồn kho
   * Với bất kỳ (stock, quantity>0), stock mới = stock + quantity
   *
   * **Validates: Requirements 5.1**
   */
  describe('Property 8: Nhập kho tăng tồn kho', () => {
    it('stock mới = stock cũ + quantity cho mọi (stock, quantity>0)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.nat({ max: 10000 }),  // initial stock
          fc.integer({ min: 1, max: 10000 }),  // quantity > 0
          async (initialStock, quantity) => {
            const mockPrisma = createMockPrisma(initialStock);
            const service = new InventoryService(mockPrisma as unknown as PrismaService);

            await service.stockIn('product-1', quantity, 'user-1', {
              purchasePrice: 100,
              salePrice: 150,
            });

            const newStock = mockPrisma.getCurrentStock();
            expect(newStock).toBe(initialStock + quantity);
          },
        ),
      );
    });
  });

  /**
   * Property 9: Xuất kho giảm tồn kho
   * Với bất kỳ (stock>=n, n>0), stock mới = stock - n
   *
   * **Validates: Requirements 6.1**
   */
  describe('Property 9: Xuất kho giảm tồn kho', () => {
    it('stock mới = stock cũ - quantity cho mọi (stock>=n, n>0)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }),  // quantity > 0
          fc.integer({ min: 0, max: 10000 }),  // extra stock above quantity
          async (quantity, extra) => {
            const initialStock = quantity + extra;  // ensure stock >= quantity
            const mockPrisma = createMockPrisma(initialStock);
            const service = new InventoryService(mockPrisma as unknown as PrismaService);

            await service.stockOut('product-1', quantity, 'user-1');

            const newStock = mockPrisma.getCurrentStock();
            expect(newStock).toBe(initialStock - quantity);
          },
        ),
      );
    });
  });

  /**
   * Property 10: Từ chối số lượng không hợp lệ
   * Với bất kỳ n<=0, nhập/xuất kho bị từ chối
   *
   * **Validates: Requirements 5.2, 6.2**
   */
  describe('Property 10: Từ chối số lượng không hợp lệ', () => {
    it('nhập kho bị từ chối với mọi quantity <= 0', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: -10000, max: 0 }),  // n <= 0
          async (quantity) => {
            const mockPrisma = createMockPrisma(100);
            const service = new InventoryService(mockPrisma as unknown as PrismaService);

            await expect(
              service.stockIn('product-1', quantity, 'user-1'),
            ).rejects.toThrow(BadRequestException);

            // Stock unchanged
            expect(mockPrisma.getCurrentStock()).toBe(100);
          },
        ),
      );
    });

    it('xuất kho bị từ chối với mọi quantity <= 0', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: -10000, max: 0 }),  // n <= 0
          async (quantity) => {
            const mockPrisma = createMockPrisma(100);
            const service = new InventoryService(mockPrisma as unknown as PrismaService);

            await expect(
              service.stockOut('product-1', quantity, 'user-1'),
            ).rejects.toThrow(BadRequestException);

            // Stock unchanged
            expect(mockPrisma.getCurrentStock()).toBe(100);
          },
        ),
      );
    });
  });

  /**
   * Property 11: Không xuất vượt tồn kho
   * Với bất kỳ (stock, n>stock), xuất kho bị từ chối
   *
   * **Validates: Requirements 6.3**
   */
  describe('Property 11: Không xuất vượt tồn kho', () => {
    it('xuất kho bị từ chối khi quantity > stock', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.nat({ max: 9999 }),  // stock (0 to 9999)
          fc.integer({ min: 1, max: 10000 }),  // extra amount above stock
          async (stock, extra) => {
            const quantity = stock + extra;  // ensure quantity > stock
            const mockPrisma = createMockPrisma(stock);
            const service = new InventoryService(mockPrisma as unknown as PrismaService);

            await expect(
              service.stockOut('product-1', quantity, 'user-1'),
            ).rejects.toThrow(BadRequestException);

            // Stock unchanged
            expect(mockPrisma.getCurrentStock()).toBe(stock);
          },
        ),
      );
    });
  });

  /**
   * Property 12: Ghi nhận giao dịch
   * Với bất kỳ thao tác thành công, transaction record được tạo đúng
   *
   * **Validates: Requirements 5.3, 6.4**
   */
  describe('Property 12: Ghi nhận giao dịch', () => {
    it('nhập kho tạo transaction record đúng', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.nat({ max: 10000 }),  // initial stock
          fc.integer({ min: 1, max: 10000 }),  // quantity
          async (initialStock, quantity) => {
            const mockPrisma = createMockPrisma(initialStock);
            const service = new InventoryService(mockPrisma as unknown as PrismaService);

            await service.stockIn('product-1', quantity, 'user-1', {
              purchasePrice: 100,
              salePrice: 150,
            });

            const txn = mockPrisma.getLastTransaction();
            expect(txn).not.toBeNull();
            expect(txn!.productId).toBe('product-1');
            expect(txn!.type).toBe('STOCK_IN');
            expect(txn!.quantity).toBe(quantity);
            expect(txn!.userId).toBe('user-1');
          },
        ),
      );
    });

    it('xuất kho tạo transaction record đúng', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }),  // quantity
          fc.integer({ min: 0, max: 10000 }),  // extra
          async (quantity, extra) => {
            const initialStock = quantity + extra;
            const mockPrisma = createMockPrisma(initialStock);
            const service = new InventoryService(mockPrisma as unknown as PrismaService);

            await service.stockOut('product-1', quantity, 'user-1');

            const txn = mockPrisma.getLastTransaction();
            expect(txn).not.toBeNull();
            expect(txn!.productId).toBe('product-1');
            expect(txn!.type).toBe('STOCK_OUT');
            expect(txn!.quantity).toBe(quantity);
            expect(txn!.userId).toBe('user-1');
          },
        ),
      );
    });
  });

  /**
   * Property 13: Tỷ lệ sức chứa kho
   * Với bất kỳ (total, capacity>0), ratio = total/capacity, warning iff ratio > 0.9
   *
   * **Validates: Requirements 7.1, 7.3**
   */
  describe('Property 13: Tỷ lệ sức chứa kho', () => {
    it('ratio = total/capacity và warning khi ratio > 0.9', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.nat({ max: 100000 }),  // total stock
          fc.integer({ min: 1, max: 100000 }),  // max capacity > 0
          async (totalStock, maxCapacity) => {
            const mockPrisma = createMockPrisma(0);
            mockPrisma.product.aggregate.mockResolvedValue({
              _sum: { stock: totalStock },
            });
            mockPrisma.warehouseConfig.findFirst.mockResolvedValue({
              id: 'config-1',
              maxCapacity,
            });

            const service = new InventoryService(mockPrisma as unknown as PrismaService);
            const result = await service.getCapacityRatio();

            const expectedRatio = totalStock / maxCapacity;
            expect(result.ratio).toBeCloseTo(expectedRatio, 10);
            expect(result.currentTotal).toBe(totalStock);
            expect(result.maxCapacity).toBe(maxCapacity);
            expect(result.isWarning).toBe(expectedRatio > 0.9);
          },
        ),
      );
    });
  });

  /**
   * Property 14: Bộ lọc yêu cầu điều kiện
   * Với bất kỳ filter rỗng, yêu cầu bị từ chối
   *
   * **Validates: Requirements 8.3**
   */
  describe('Property 14: Bộ lọc yêu cầu điều kiện', () => {
    it('từ chối khi tất cả filter đều rỗng', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            page: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
            limit: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
          }),
          async (paginationOnly) => {
            const mockPrisma = createMockPrisma(0);
            const service = new InventoryService(mockPrisma as unknown as PrismaService);

            // All filter fields are empty/undefined - only pagination
            await expect(
              service.getInventory({
                page: paginationOnly.page,
                limit: paginationOnly.limit,
              }),
            ).rejects.toThrow(BadRequestException);
          },
        ),
      );
    });
  });

  /**
   * Property 15: Bộ lọc trả về kết quả chính xác
   * Với bất kỳ (filter, data), kết quả thỏa mãn mọi điều kiện
   *
   * **Validates: Requirements 8.5**
   */
  describe('Property 15: Bộ lọc trả về kết quả chính xác', () => {
    it('kết quả thỏa mãn mọi điều kiện lọc đã áp dụng', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            categoryId: fc.option(fc.uuid(), { nil: undefined }),
            startDate: fc.option(
              fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }).map(d => d.toISOString()),
              { nil: undefined },
            ),
            endDate: fc.option(
              fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }).map(d => d.toISOString()),
              { nil: undefined },
            ),
          }).filter(f => !!(f.categoryId || f.startDate || f.endDate)),  // at least one filter
          async (filters) => {
            const mockPrisma = createMockPrisma(0);

            // Generate mock products that match the filter
            const matchingProducts = [
              {
                id: 'p1',
                name: 'Product 1',
                sku: 'SKU-001',
                stock: 10,
                categoryId: filters.categoryId ?? 'cat-1',
                createdAt: filters.startDate ? new Date(filters.startDate) : new Date(),
                category: { name: 'Category 1' },
                warehousePositions: [],
              },
            ];

            mockPrisma.product.findMany.mockResolvedValue(matchingProducts);
            mockPrisma.product.count.mockResolvedValue(matchingProducts.length);

            const service = new InventoryService(mockPrisma as unknown as PrismaService);
            const result = await service.getInventory(filters);

            // Verify findMany was called with correct where clause
            const findManyCall = mockPrisma.product.findMany.mock.calls[0][0];
            const where = findManyCall.where;

            if (filters.categoryId) {
              expect(where.categoryId).toBe(filters.categoryId);
            }

            if (filters.startDate) {
              expect(where.createdAt).toBeDefined();
              expect(where.createdAt.gte).toEqual(new Date(filters.startDate));
            }

            if (filters.endDate) {
              expect(where.createdAt).toBeDefined();
              expect(where.createdAt.lte).toEqual(new Date(filters.endDate));
            }

            // Verify pagination structure
            expect(result).toHaveProperty('data');
            expect(result).toHaveProperty('total');
            expect(result).toHaveProperty('page');
            expect(result).toHaveProperty('limit');
            expect(result).toHaveProperty('totalPages');
          },
        ),
      );
    });
  });

  /**
   * Feature: system-upgrade-v2, Property 13: Tính toán businessStatus
   * **Validates: Requirements 8.2, 8.3, 8.4, 17.5**
   *
   * Với bất kỳ (stock, minThreshold, isDiscontinued):
   * - isDiscontinued=true → NGUNG_KD
   * - stock==0 → HET_HANG
   * - 0 < stock < minThreshold → SAP_HET
   * - stock >= minThreshold → CON_HANG
   */
  describe('Property 13: computeBusinessStatus', () => {
    it('should return correct status for all valid input combinations', () => {
      const mockPrisma = createMockPrisma(0);
      const service = new InventoryService(mockPrisma as unknown as PrismaService);

      fc.assert(
        fc.property(
          fc.nat({ max: 10000 }),  // stock
          fc.nat({ max: 10000 }),  // minThreshold
          fc.boolean(),            // isDiscontinued
          (stock, minThreshold, isDiscontinued) => {
            const result = service.computeBusinessStatus({
              stock,
              minThreshold,
              isDiscontinued,
            });

            if (isDiscontinued) {
              expect(result).toBe('NGUNG_KD');
            } else if (stock === 0) {
              expect(result).toBe('HET_HANG');
            } else if (stock < minThreshold) {
              expect(result).toBe('SAP_HET');
            } else {
              expect(result).toBe('CON_HANG');
            }
          },
        ),
      );
    });
  });
});
