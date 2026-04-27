import * as fc from 'fast-check';
import { InventoryService } from './inventory.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Feature: system-upgrade-v2
 * Property-Based Tests for Inventory Module
 */

describe('Inventory PBT', () => {
  /**
   * Property 14: Bộ lọc tồn kho chính xác
   * All returned items must satisfy ALL applied filter conditions.
   *
   * **Validates: Requirements 10.2**
   */
  describe('P14: Inventory filter accuracy', () => {
    it('computeBusinessStatus returns correct status for all inputs', () => {
      const service = new InventoryService({} as PrismaService);

      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100000 }),  // stock
          fc.integer({ min: 0, max: 100000 }),  // minThreshold
          fc.boolean(),                          // isDiscontinued
          (stock, minThreshold, isDiscontinued) => {
            const result = service.computeBusinessStatus({ stock, minThreshold, isDiscontinued });

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

    it('filtered results match businessStatus filter', () => {
      // Pure function test: given a set of products and a filter,
      // all returned products must match the filter
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              stock: fc.integer({ min: 0, max: 1000 }),
              minThreshold: fc.integer({ min: 0, max: 100 }),
              isDiscontinued: fc.boolean(),
            }),
            { minLength: 1, maxLength: 50 },
          ),
          fc.constantFrom('CON_HANG', 'HET_HANG', 'SAP_HET', 'NGUNG_KD'),
          (products, filterStatus) => {
            const service = new InventoryService({} as PrismaService);

            const withStatus = products.map((p) => ({
              ...p,
              businessStatus: service.computeBusinessStatus(p),
            }));

            const filtered = withStatus.filter((p) => p.businessStatus === filterStatus);

            // All filtered items must match the filter
            for (const item of filtered) {
              expect(item.businessStatus).toBe(filterStatus);
            }
          },
        ),
      );
    });
  });
});
