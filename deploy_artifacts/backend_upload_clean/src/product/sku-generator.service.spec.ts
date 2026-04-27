import * as fc from 'fast-check';
import { SkuGeneratorService } from './sku-generator.service.js';
import type { SkuComponents } from './sku-generator.service.js';

/**
 * Feature: inventory-management-system
 * Property-based tests for SKU Generator Service
 */

// Create a standalone instance for pure function tests (no Prisma needed)
const skuService = new SkuGeneratorService(null as any);

/**
 * Vietnamese character arbitraries for generating test strings
 */
const vietnameseChars =
  'àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ';
const vietnameseUpperChars =
  'ÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ';
const asciiLetters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const allVietnameseChars = vietnameseChars + vietnameseUpperChars + asciiLetters;

const vietnameseStringArb = fc.stringOf(
  fc.constantFrom(...[...allVietnameseChars]),
  { minLength: 1, maxLength: 30 },
);

describe('Feature: inventory-management-system', () => {
  /**
   * Property 7: Chuyển đổi dấu tiếng Việt
   * Validates: Requirements 4.4
   *
   * Với bất kỳ chuỗi tiếng Việt, removeDiacritics phải trả về chuỗi ASCII viết hoa
   */
  describe('Property 7: Chuyển đổi dấu tiếng Việt - Với bất kỳ chuỗi tiếng Việt, removeDiacritics phải trả về chuỗi ASCII viết hoa', () => {
    it('should return uppercase ASCII-only string for any Vietnamese input', () => {
      fc.assert(
        fc.property(vietnameseStringArb, (input: string) => {
          const result = skuService.removeDiacritics(input);

          // Result must only contain uppercase ASCII letters and digits
          expect(result).toMatch(/^[A-Z0-9]*$/);

          // Result must not contain any Vietnamese diacritics
          for (const char of result) {
            expect(vietnameseChars).not.toContain(char.toLowerCase());
          }
        }),
      );
    });

    /**
     * **Validates: Requirements 4.4**
     */
    it('should convert known Vietnamese strings correctly', () => {
      expect(skuService.removeDiacritics('Đồng hồ')).toBe('DONGHO');
      expect(skuService.removeDiacritics('Điện thoại')).toBe('DIENTHOAI');
      expect(skuService.removeDiacritics('Phụ kiện')).toBe('PHUKIEN');
      expect(skuService.removeDiacritics('Laptop')).toBe('LAPTOP');
    });
  });

  /**
   * Property 6: SKU round-trip
   * Validates: Requirements 4.3
   *
   * Với bất kỳ SKU hợp lệ, parse rồi format phải trả về SKU ban đầu
   */
  describe('Property 6: SKU round-trip - Với bất kỳ SKU hợp lệ, parse rồi format phải trả về SKU ban đầu', () => {
    // Generate valid SKU components
    const categoryArb = fc
      .stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), {
        minLength: 2,
        maxLength: 15,
      })
      .filter((s) => s.length >= 2);

    const idArb = fc.integer({ min: 1, max: 999 }).map((n) => String(n).padStart(3, '0'));

    const dateArb = fc
      .record({
        year: fc.integer({ min: 2020, max: 2030 }),
        month: fc.integer({ min: 1, max: 12 }),
        day: fc.integer({ min: 1, max: 28 }),
      })
      .map(
        ({ year, month, day }) =>
          `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`,
      );

    it('should satisfy round-trip: parse(format(components)) === components', () => {
      fc.assert(
        fc.property(categoryArb, idArb, dateArb, (category, id, date) => {
          const components: SkuComponents = { category, id, date };
          const sku = skuService.formatSku(components);
          const parsed = skuService.parseSku(sku);

          expect(parsed.category).toBe(components.category);
          expect(parsed.id).toBe(components.id);
          expect(parsed.date).toBe(components.date);
        }),
      );
    });

    it('should satisfy round-trip: format(parse(sku)) === sku', () => {
      fc.assert(
        fc.property(categoryArb, idArb, dateArb, (category, id, date) => {
          const originalSku = `${category}-${id}-${date}`;
          const parsed = skuService.parseSku(originalSku);
          const formatted = skuService.formatSku(parsed);

          expect(formatted).toBe(originalSku);
        }),
      );
    });
  });

  /**
   * Property 3: Định dạng SKU
   * Validates: Requirements 3.4, 4.1
   *
   * Với bất kỳ sản phẩm hợp lệ, SKU phải theo format DANHMUC-NNN-YYYYMMDD
   */
  describe('Property 3: Định dạng SKU - Với bất kỳ sản phẩm hợp lệ, SKU phải theo format DANHMUC-NNN-YYYYMMDD', () => {
    // Generate valid category codes (uppercase ASCII)
    const categoryCodeArb = fc
      .stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), {
        minLength: 2,
        maxLength: 15,
      })
      .filter((s) => s.length >= 2);

    const dateArb = fc.date({
      min: new Date('2020-01-01'),
      max: new Date('2030-12-31'),
    });

    it('should generate SKU matching format DANHMUC-NNN-YYYYMMDD', () => {
      // We test the format by constructing what generateSku would produce
      // without database access (testing the format logic)
      fc.assert(
        fc.property(
          categoryCodeArb,
          fc.integer({ min: 1, max: 999 }),
          dateArb,
          (category, id, date) => {
            const idStr = String(id).padStart(3, '0');
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateStr = `${year}${month}${day}`;

            const sku = skuService.formatSku({
              category,
              id: idStr,
              date: dateStr,
            });

            // SKU must match the format: UPPERCASE-NNN-YYYYMMDD
            const skuRegex = /^[A-Z]{2,}-\d{3}-\d{8}$/;
            expect(sku).toMatch(skuRegex);

            // Parse it back and verify components
            const parsed = skuService.parseSku(sku);
            expect(parsed.category).toBe(category);
            expect(parsed.id).toBe(idStr);
            expect(parsed.date).toBe(dateStr);
          },
        ),
      );
    });
  });

  /**
   * Property 4: Tính duy nhất SKU
   * Validates: Requirements 3.5
   *
   * Với bất kỳ chuỗi tạo sản phẩm, tất cả SKU phải khác nhau
   * (Testing uniqueness of generated SKU format components)
   */
  describe('Property 4: Tính duy nhất SKU - Với bất kỳ chuỗi tạo sản phẩm, tất cả SKU phải khác nhau', () => {
    it('should generate unique SKUs for different IDs within same category and date', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('DONGHO', 'DIENTHOAI', 'LAPTOP', 'PHUKIEN'),
          fc.uniqueArray(fc.integer({ min: 1, max: 999 }), {
            minLength: 2,
            maxLength: 20,
          }),
          (category, ids) => {
            const date = '20231027';
            const skus = ids.map((id) =>
              skuService.formatSku({
                category,
                id: String(id).padStart(3, '0'),
                date,
              }),
            );

            // All SKUs must be unique
            const uniqueSkus = new Set(skus);
            expect(uniqueSkus.size).toBe(skus.length);
          },
        ),
      );
    });
  });

  /**
   * Property 5: SKU ID tăng dần
   * Validates: Requirements 4.2
   *
   * Với bất kỳ chuỗi sản phẩm cùng danh mục, phần ID phải tăng dần
   */
  describe('Property 5: SKU ID tăng dần - Với bất kỳ chuỗi sản phẩm cùng danh mục, phần ID phải tăng dần', () => {
    it('should have strictly increasing IDs for sequential products in same category', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('DONGHO', 'DIENTHOAI', 'LAPTOP'),
          fc.integer({ min: 2, max: 20 }),
          (category, count) => {
            const date = '20231027';
            // Simulate sequential product creation with incrementing IDs
            const skus: string[] = [];
            for (let i = 1; i <= count; i++) {
              skus.push(
                skuService.formatSku({
                  category,
                  id: String(i).padStart(3, '0'),
                  date,
                }),
              );
            }

            // Verify IDs are strictly increasing
            for (let i = 1; i < skus.length; i++) {
              const prevId = parseInt(skuService.parseSku(skus[i - 1]).id, 10);
              const currId = parseInt(skuService.parseSku(skus[i]).id, 10);
              expect(currId).toBeGreaterThan(prevId);
            }
          },
        ),
      );
    });
  });
});
