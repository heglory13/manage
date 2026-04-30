import * as fc from 'fast-check';
import { BadRequestException } from '@nestjs/common';
import { StocktakingService } from './stocktaking.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Feature: system-upgrade-v2
 * Property-Based Tests for Stocktaking Module
 */

function createMockPrisma(productsMap: Map<string, { id: string; stock: number }>) {
  let recordIdCounter = 0;

  return {
    product: {
      findMany: jest.fn().mockImplementation((args?: { where?: Record<string, unknown> }) => {
        if (!args?.where || Object.keys(args.where).length === 0) {
          return Promise.resolve(
            Array.from(productsMap.values()).map((p) => ({
              id: p.id, name: `P-${p.id}`, sku: `SKU-${p.id}`, stock: p.stock,
              price: 100, categoryId: 'c1', createdAt: new Date(), updatedAt: new Date(),
            })),
          );
        }
        const ids = (args.where.id as { in: string[] })?.in ?? [];
        return Promise.resolve(
          ids.filter((id: string) => productsMap.has(id)).map((id: string) => {
            const p = productsMap.get(id)!;
            return { id: p.id, name: `P-${p.id}`, sku: `SKU-${p.id}`, stock: p.stock,
              price: 100, categoryId: 'c1', createdAt: new Date(), updatedAt: new Date() };
          }),
        );
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    stocktakingRecord: {
      create: jest.fn().mockImplementation(({ data }: any) => {
        const rid = `r-${++recordIdCounter}`;
        const items = data.items.create.map((item: any, i: number) => ({
          id: `item-${rid}-${i}`, recordId: rid, ...item,
          product: { id: item.productId, name: `P-${item.productId}` },
        }));
        return Promise.resolve({
          id: rid, status: data.status, mode: data.mode, cutoffTime: data.cutoffTime,
          submittedAt: null, createdBy: data.createdBy, createdAt: new Date(), updatedAt: new Date(),
          items, creator: { id: data.createdBy, name: 'User', email: 'u@t.com', role: 'STAFF' },
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
    $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
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

            const productsMap = new Map(uniqueProducts.map((p) => [p.id, p]));
            const mockPrisma = createMockPrisma(productsMap);
            const service = new StocktakingService(mockPrisma as unknown as PrismaService);

            const result = await service.create('full', 'user-1');

            expect(result.items).toHaveLength(uniqueProducts.length);
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

            const productsMap = new Map(uniqueProducts.map((p) => [p.id, p]));
            const selectedIds = uniqueProducts.slice(0, Math.ceil(uniqueProducts.length / 2)).map((p) => p.id);

            const mockPrisma = createMockPrisma(productsMap);
            const service = new StocktakingService(mockPrisma as unknown as PrismaService);

            const result = await service.create('selected', 'user-1', selectedIds);

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

            const productsMap = new Map([['p1', { id: 'p1', stock: systemQuantity }]]);
            const mockPrisma = createMockPrisma(productsMap);

            mockPrisma.stocktakingRecord.findUnique.mockResolvedValue({
              id: 'r-1', status: 'CHECKING',
              items: [{ id: 'item-1', productId: 'p1', systemQuantity, actualQuantity: 0, discrepancy: 0, discrepancyReason: null, evidenceUrl: null }],
            });

            const service = new StocktakingService(mockPrisma as unknown as PrismaService);

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
        fc.asyncProperty(
          fc.uuid(),
          async (userId) => {
            const productsMap = new Map([['p1', { id: 'p1', stock: 10 }]]);
            const mockPrisma = createMockPrisma(productsMap);
            const service = new StocktakingService(mockPrisma as unknown as PrismaService);

            await service.create('full', userId);

            expect(mockPrisma.stocktakingStatusHistory.create).toHaveBeenCalledWith(
              expect.objectContaining({
                data: expect.objectContaining({ status: 'CHECKING', changedBy: userId }),
              }),
            );
          },
        ),
      );
    });

    it('records history on approve (APPROVED)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (userId) => {
            const productsMap = new Map([['p1', { id: 'p1', stock: 10 }]]);
            const mockPrisma = createMockPrisma(productsMap);

            mockPrisma.stocktakingRecord.findUnique.mockResolvedValue({
              id: 'r-1', status: 'PENDING',
              items: [{ id: 'i-1', productId: 'p1', systemQuantity: 10, actualQuantity: 10, discrepancy: 0 }],
            });
            mockPrisma.stocktakingRecord.update.mockResolvedValue({
              id: 'r-1', status: 'APPROVED', items: [], creator: { id: userId, name: 'U', email: 'u@t.com', role: 'MANAGER' },
            });

            const service = new StocktakingService(mockPrisma as unknown as PrismaService);
            await service.approve('r-1', userId);

            expect(mockPrisma.stocktakingStatusHistory.create).toHaveBeenCalledWith(
              expect.objectContaining({
                data: expect.objectContaining({ status: 'APPROVED', changedBy: userId }),
              }),
            );
          },
        ),
      );
    });
  });
});
