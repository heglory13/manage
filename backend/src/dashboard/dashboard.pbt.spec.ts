import * as fc from 'fast-check';
import { DashboardService } from './dashboard.service.js';

/**
 * Feature: system-upgrade-v3
 * Property-based tests for Dashboard alerts, top N, and week cutoff
 */

// Pure filter functions extracted for testability
function filterBelowMin(products: { stock: number; minThreshold: number }[]) {
  return products.filter((p) => p.stock < p.minThreshold && p.minThreshold > 0);
}

function filterAboveMax(products: { stock: number; maxThreshold: number }[]) {
  return products.filter((p) => p.stock > p.maxThreshold && p.maxThreshold > 0);
}

function sortAndLimit<T extends { value: number }>(
  items: T[],
  type: 'highest' | 'lowest',
  limit: number,
): T[] {
  const sorted = [...items].sort((a, b) =>
    type === 'highest' ? b.value - a.value : a.value - b.value,
  );
  return sorted.slice(0, limit);
}

describe('Dashboard PBT', () => {
  /**
   * Property 1: Lọc cảnh báo tồn kho dưới định mức
   * **Validates: Requirements 1.1, 1.4**
   */
  it('P1: below-min alert filter returns exactly the products with stock < minThreshold AND minThreshold > 0', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            stock: fc.integer({ min: 0, max: 1000 }),
            minThreshold: fc.integer({ min: 0, max: 100 }),
          }),
          { minLength: 0, maxLength: 50 },
        ),
        (products) => {
          const result = filterBelowMin(products);

          // All returned items satisfy both conditions
          for (const p of result) {
            expect(p.stock).toBeLessThan(p.minThreshold);
            expect(p.minThreshold).toBeGreaterThan(0);
          }

          // No qualifying item is missing
          const expected = products.filter(
            (p) => p.stock < p.minThreshold && p.minThreshold > 0,
          );
          expect(result.length).toBe(expected.length);
        },
      ),
    );
  });

  /**
   * Property 2: Lọc cảnh báo tồn kho trên định mức
   * **Validates: Requirements 2.2, 2.5**
   */
  it('P2: above-max alert filter returns exactly the products with stock > maxThreshold AND maxThreshold > 0', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            stock: fc.integer({ min: 0, max: 1000 }),
            maxThreshold: fc.integer({ min: 0, max: 100 }),
          }),
          { minLength: 0, maxLength: 50 },
        ),
        (products) => {
          const result = filterAboveMax(products);

          // All returned items satisfy both conditions
          for (const p of result) {
            expect(p.stock).toBeGreaterThan(p.maxThreshold);
            expect(p.maxThreshold).toBeGreaterThan(0);
          }

          // No qualifying item is missing
          const expected = products.filter(
            (p) => p.stock > p.maxThreshold && p.maxThreshold > 0,
          );
          expect(result.length).toBe(expected.length);
        },
      ),
    );
  });

  /**
   * Property 3: Sắp xếp và giới hạn Top N
   * **Validates: Requirements 3.1, 3.2, 4.1, 4.2**
   */
  it('P3: top N sort order and length constraint', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ value: fc.integer({ min: 0, max: 10000 }) }),
          { minLength: 0, maxLength: 100 },
        ),
        fc.integer({ min: 1, max: 50 }),
        fc.constantFrom('highest' as const, 'lowest' as const),
        (items, limit, type) => {
          const result = sortAndLimit(items, type, limit);

          // Length constraint
          expect(result.length).toBeLessThanOrEqual(limit);
          if (items.length <= limit) {
            expect(result.length).toBe(items.length);
          } else {
            expect(result.length).toBe(limit);
          }

          // Sort order
          for (let i = 1; i < result.length; i++) {
            if (type === 'highest') {
              expect(result[i - 1].value).toBeGreaterThanOrEqual(result[i].value);
            } else {
              expect(result[i - 1].value).toBeLessThanOrEqual(result[i].value);
            }
          }
        },
      ),
    );
  });

  /**
   * Property 4: Tính toán cutoff tuần theo GMT+7
   * **Validates: Requirements 5.2**
   */
  it('P4: week cutoff is always Sunday 05:00 UTC (12:00 GMT+7)', () => {
    fc.assert(
      fc.property(
        fc.date({
          min: new Date('2020-01-01'),
          max: new Date('2030-12-31'),
        }),
        (date) => {
          const cutoff = DashboardService.getWeekCutoff(date);

          // Must be a Sunday (UTC day 0)
          expect(cutoff.getUTCDay()).toBe(0);

          // Must be 05:00 UTC
          expect(cutoff.getUTCHours()).toBe(5);
          expect(cutoff.getUTCMinutes()).toBe(0);
          expect(cutoff.getUTCSeconds()).toBe(0);
          expect(cutoff.getUTCMilliseconds()).toBe(0);

          // Cutoff must be <= the input date (or at most 7 days before)
          const diffMs = date.getTime() - cutoff.getTime();
          expect(diffMs).toBeGreaterThanOrEqual(0);
          expect(diffMs).toBeLessThan(7 * 24 * 60 * 60 * 1000 + 1);
        },
      ),
    );
  });
});
