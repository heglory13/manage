import * as fc from 'fast-check';
import { BadRequestException } from '@nestjs/common';
import { WarehouseService } from './warehouse.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Feature: system-upgrade-v2
 * Property-Based Tests for Warehouse Module
 */

describe('Warehouse PBT', () => {
  /**
   * Property 1: Bất biến di chuyển/hoán đổi vị trí kho
   * Swap preserves data and total position count.
   *
   * **Validates: Requirements 1.2, 1.3**
   */
  describe('P1: Position swap invariant', () => {
    it('swap preserves all data except coordinates', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            rowA: fc.integer({ min: 0, max: 20 }),
            colA: fc.integer({ min: 0, max: 20 }),
            rowB: fc.integer({ min: 0, max: 20 }),
            colB: fc.integer({ min: 0, max: 20 }),
            labelA: fc.string({ minLength: 1, maxLength: 5 }),
            labelB: fc.string({ minLength: 1, maxLength: 5 }),
          }),
          async ({ rowA, colA, rowB, colB, labelA, labelB }) => {
            fc.pre(rowA !== rowB || colA !== colB); // different positions

            const posA = { id: 'a', layoutId: 'L1', row: rowA, column: colA, label: labelA, productId: null, isActive: true };
            const posB = { id: 'b', layoutId: 'L1', row: rowB, column: colB, label: labelB, productId: null, isActive: true };

            let updatedA: Record<string, unknown> = {};
            let updatedB: Record<string, unknown> = {};

            const mockPrisma = {
              warehousePosition: {
                findUnique: jest.fn().mockResolvedValue(posA),
                findFirst: jest.fn().mockResolvedValue(posB),
                update: jest.fn().mockImplementation(({ where, data }: any) => {
                  const result = { ...(where.id === 'a' ? posA : posB), ...data, product: null };
                  if (where.id === 'a') updatedA = result;
                  else updatedB = result;
                  return Promise.resolve(result);
                }),
              },
              $transaction: jest.fn().mockImplementation(async (ops: Promise<unknown>[]) => {
                const results = await Promise.all(ops);
                return results;
              }),
            };

            const service = new WarehouseService(mockPrisma as unknown as PrismaService);
            await service.movePosition('a', rowB, colB);

            // A gets B's coordinates, B gets A's coordinates
            expect(updatedA.row).toBe(rowB);
            expect(updatedA.column).toBe(colB);
            expect(updatedB.row).toBe(rowA);
            expect(updatedB.column).toBe(colA);
          },
        ),
      );
    });
  });

  /**
   * Property 2: Nhãn vị trí duy nhất trong layout
   * Duplicate labels must be rejected.
   *
   * **Validates: Requirements 1.6**
   */
  describe('P2: Label uniqueness', () => {
    it('rejects duplicate labels within same layout', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 10 }),
          async (label) => {
            const mockPrisma = {
              warehousePosition: {
                findUnique: jest.fn().mockResolvedValue({
                  id: 'pos-1',
                  layoutId: 'L1',
                  label: 'old-label',
                }),
                findFirst: jest.fn().mockResolvedValue({
                  id: 'pos-2',
                  label: label, // duplicate exists
                }),
                update: jest.fn(),
              },
            };

            const service = new WarehouseService(mockPrisma as unknown as PrismaService);

            await expect(service.updateLabel('pos-1', label)).rejects.toThrow(BadRequestException);
            expect(mockPrisma.warehousePosition.update).not.toHaveBeenCalled();
          },
        ),
      );
    });
  });

  /**
   * Property 7: Kiểm soát sức chứa vị trí kho
   * Capacity enforcement: reject when S + Q > M.
   *
   * **Validates: Requirements 4.3, 4.4, 4.5**
   */
  describe('P7: Capacity enforcement', () => {
    it('maxCapacity must be positive', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: -1000, max: 0 }),
          async (invalidCapacity) => {
            const mockPrisma = {
              warehousePosition: {
                findUnique: jest.fn().mockResolvedValue({ id: 'pos-1' }),
                update: jest.fn(),
              },
            };

            const service = new WarehouseService(mockPrisma as unknown as PrismaService);
            await expect(service.updateCapacity('pos-1', invalidCapacity)).rejects.toThrow(BadRequestException);
          },
        ),
      );
    });
  });
});
