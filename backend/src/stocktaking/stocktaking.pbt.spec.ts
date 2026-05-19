import * as fc from 'fast-check';
import { BadRequestException } from '@nestjs/common';
import { StocktakingService } from './stocktaking.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Feature: system-upgrade-v2
 * Property-Based Tests for Stocktaking Module
 */

function createMockPrisma(
  productsMap: Map<string, { id: string; stock: number }>,
) {
  let recordIdCounter = 0;

  return {
    category: {
      findMany: jest
        .fn()
        .mockImplementation((args?: { where?: { id?: { in: string[] } } }) => {
          const ids =
            args?.where?.id?.in ??
            Array.from(productsMap.keys()).map((id) => `cat-${id}`);
          return Promise.resolve(
            ids.map((id) => ({
              id,
              code: id.toUpperCase(),
              name: `Category ${id}`,
            })),
          );
        }),
    },
    product: {
      findMany: jest
        .fn()
        .mockImplementation((args?: { where?: Record<string, unknown> }) => {
          if (!args?.where || Object.keys(args.where).length === 0) {
            return Promise.resolve(
              Array.from(productsMap.values()).map((p) => ({
                id: p.id,
                name: `P-${p.id}`,
                sku: `SKU-${p.id}`,
                stock: p.stock,
                price: 100,
                categoryId: `cat-${p.id}`,
                createdAt: new Date(),
                updatedAt: new Date(),
              })),
            );
          }
          const ids = (args.where.id as { in: string[] })?.in ?? [];
          return Promise.resolve(
            ids
              .filter((id: string) => productsMap.has(id))
              .map((id: string) => {
                const p = productsMap.get(id)!;
                return {
                  id: p.id,
                  name: `P-${p.id}`,
                  sku: `SKU-${p.id}`,
                  stock: p.stock,
                  price: 100,
                  categoryId: `cat-${p.id}`,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                };
              }),
          );
        }),
      update: jest.fn().mockResolvedValue({}),
    },
    stocktakingRecord: {
      create: jest.fn().mockImplementation(({ data }: any) => {
        const rid = `r-${++recordIdCounter}`;
        const items = data.items.create.map((item: any, i: number) => ({
          id: `item-${rid}-${i}`,
          recordId: rid,
          ...item,
          product: null,
          category: item.categoryId
            ? { id: item.categoryId, code: item.itemCode, name: item.itemLabel }
            : null,
        }));
        return Promise.resolve({
          id: rid,
          status: data.status,
          mode: data.mode,
          cutoffTime: data.cutoffTime,
          submittedAt: null,
          createdBy: data.createdBy,
          createdAt: new Date(),
          updatedAt: new Date(),
          items,
          creator: {
            id: data.createdBy,
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
    inventoryTransaction: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest
        .fn()
        .mockImplementation(
          (args?: { where?: { categoryId?: { in?: string[] } } }) => {
            const catIds = args?.where?.categoryId?.in;
            const source = catIds
              ? Array.from(productsMap.entries()).filter(([id]) =>
                  catIds.includes(`cat-${id}`),
                )
              : Array.from(productsMap.entries());
            return Promise.resolve(
              source.flatMap(([id, p]) =>
                p.stock > 0
                  ? [
                      {
                        categoryId: `cat-${id}`,
                        type: 'STOCK_IN',
                        quantity: p.stock,
                        skuComboId: null,
                        status: 'ACTIVE',
                      },
                    ]
                  : [],
              ),
            );
          },
        ),
      create: jest.fn().mockResolvedValue({ id: 'txn-1' }),
    },
    skuCombo: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    preliminaryCheck: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest
      .fn()
      .mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

function createMockInventoryService(
  productsMap: Map<string, { id: string; stock: number }>,
) {
  return {
    getCurrentStockByCategory: jest
      .fn()
      .mockImplementation((categoryId: string) => {
        const productId = categoryId.replace(/^cat-/, '');
        return Promise.resolve(productsMap.get(productId)?.stock ?? 0);
      }),
    balanceStockByCategory: jest.fn().mockResolvedValue({}),
  };
}

describe('Stocktaking PBT', () => {
  /**
   * Property 8: Chế độ kiểm kê tạo đúng tập sản phẩm
   * mode='full' → all products; mode='selected' → exact subset.
   *
   * **Validates: Requirements 5.1, 5.3**
   */
  describe('P8: Stocktaking mode creates correct product set', () => {
    it('mode=full includes all products', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.uuid(),
              stock: fc.integer({ min: 0, max: 10000 }),
            }),
            { minLength: 1, maxLength: 20 },
          ),
          async (products) => {
            // Ensure unique IDs
            const uniqueProducts = products.filter(
              (p, i, arr) => arr.findIndex((x) => x.id === p.id) === i,
            );
            fc.pre(uniqueProducts.length > 0);

            // Need at least one product with stock > 0 to have transactions to snapshot
            fc.pre(uniqueProducts.some((p) => p.stock > 0));

            const productsMap = new Map(uniqueProducts.map((p) => [p.id, p]));
            const mockPrisma = createMockPrisma(productsMap);
            const service = new StocktakingService(
              mockPrisma as unknown as PrismaService,
              createMockInventoryService(productsMap) as any,
            );

            const result = await service.create('full', 'user-1');
            const productsWithStock = uniqueProducts.filter((p) => p.stock > 0);
            expect(result.items).toHaveLength(productsWithStock.length);
            expect(result.status).toBe('CHECKING');
          },
        ),
      );
    });

    it('mode=selected includes exactly the specified products', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.uuid(),
              stock: fc.integer({ min: 0, max: 10000 }),
            }),
            { minLength: 2, maxLength: 20 },
          ),
          async (products) => {
            const uniqueProducts = products.filter(
              (p, i, arr) => arr.findIndex((x) => x.id === p.id) === i,
            );
            fc.pre(uniqueProducts.length >= 2);
            // Need at least one selected product with stock > 0 for transactions to exist
            const productsWithStock = uniqueProducts.filter((p) => p.stock > 0);
            fc.pre(productsWithStock.length > 0);

            const productsMap = new Map(uniqueProducts.map((p) => [p.id, p]));
            const selectedIds = productsWithStock
              .slice(0, Math.ceil(productsWithStock.length / 2))
              .map((p) => p.id);

            const mockPrisma = createMockPrisma(productsMap);
            const service = new StocktakingService(
              mockPrisma as unknown as PrismaService,
              createMockInventoryService(productsMap) as any,
            );

            const result = await service.create(
              'selected',
              'user-1',
              selectedIds,
            );

            expect(result.items).toHaveLength(selectedIds.length);
          },
        ),
      );
    });
  });

  /**
   * Property 10: Từ chối submit thiếu nguyên nhân chênh lệch
   * Items with discrepancy != 0 must have discrepancyReason.
   *
   * **Validates: Requirements 6.5**
   */
  describe('P10: Reject submit without discrepancy reason', () => {
    it('rejects when any item has discrepancy but no reason', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 10000 }), // systemQuantity
          fc.integer({ min: 0, max: 10000 }), // actualQuantity (different)
          async (systemQuantity, actualQuantity) => {
            fc.pre(actualQuantity !== systemQuantity);

            const productsMap = new Map([
              ['p1', { id: 'p1', stock: systemQuantity }],
            ]);
            const mockPrisma = createMockPrisma(productsMap);
            const mockInventoryService =
              createMockInventoryService(productsMap);

            mockPrisma.stocktakingRecord.findUnique.mockResolvedValue({
              id: 'r-1',
              status: 'CHECKING',
              items: [
                {
                  id: 'item-1',
                  categoryId: 'cat-p1',
                  itemCode: 'CAT-P1',
                  itemLabel: 'Category cat-p1',
                  systemQuantity,
                  actualQuantity: 0,
                  discrepancy: 0,
                  discrepancyReason: null,
                  evidenceUrl: null,
                },
              ],
            });

            const service = new StocktakingService(
              mockPrisma as unknown as PrismaService,
              mockInventoryService as any,
            );

            // Submit without reason
            await expect(
              service.submit('r-1', [{ itemId: 'item-1', actualQuantity }]),
            ).rejects.toThrow(BadRequestException);
          },
        ),
      );
    });
  });

  /**
   * Property 12: Lịch sử trạng thái ghi nhận
   * Every status change creates a StocktakingStatusHistory entry.
   *
   * **Validates: Requirements 7.3**
   */
  describe('P12: Status history recording', () => {
    it('records history on create (CHECKING)', async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), async (userId) => {
          const productsMap = new Map([['p1', { id: 'p1', stock: 10 }]]);
          const mockPrisma = createMockPrisma(productsMap);
          const service = new StocktakingService(
            mockPrisma as unknown as PrismaService,
            createMockInventoryService(productsMap) as any,
          );

          await service.create('full', userId);

          expect(
            mockPrisma.stocktakingStatusHistory.create,
          ).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                status: 'CHECKING',
                changedBy: userId,
              }),
            }),
          );
        }),
      );
    });

    it('records history on approve (APPROVED)', async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), async (userId) => {
          const productsMap = new Map([['p1', { id: 'p1', stock: 10 }]]);
          const mockPrisma = createMockPrisma(productsMap);
          const mockInventoryService = createMockInventoryService(productsMap);

          mockPrisma.stocktakingRecord.findUnique.mockResolvedValue({
            id: 'r-1',
            status: 'PENDING',
            createdBy: userId,
            items: [
              {
                id: 'i-1',
                categoryId: 'cat-p1',
                itemCode: 'CAT-P1',
                itemLabel: 'Category cat-p1',
                systemQuantity: 10,
                actualQuantity: 10,
                discrepancy: 0,
              },
            ],
          });
          mockPrisma.stocktakingRecord.update.mockResolvedValue({
            id: 'r-1',
            status: 'APPROVED',
            items: [],
            creator: {
              id: userId,
              name: 'U',
              email: 'u@t.com',
              role: 'MANAGER',
            },
          });

          const service = new StocktakingService(
            mockPrisma as unknown as PrismaService,
            mockInventoryService as any,
          );
          await service.approve('r-1', userId);

          expect(
            mockPrisma.stocktakingStatusHistory.create,
          ).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                status: 'APPROVED',
                changedBy: userId,
              }),
            }),
          );
        }),
      );
    });
  });
});
