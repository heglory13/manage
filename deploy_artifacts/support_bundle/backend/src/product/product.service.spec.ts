import * as fc from 'fast-check';
import { BadRequestException } from '@nestjs/common';
import { ProductService } from './product.service.js';
import { SkuGeneratorService } from './sku-generator.service.js';

/**
 * Feature: inventory-management-system
 * Property-based tests for Product Service
 */

describe('Feature: inventory-management-system', () => {
  /**
   * Property 2: Tên sản phẩm bắt buộc
   * Validates: Requirements 3.2, 3.3
   *
   * Với bất kỳ chuỗi rỗng/whitespace, tạo sản phẩm phải bị từ chối
   */
  describe('Property 2: Tên sản phẩm bắt buộc - Với bất kỳ chuỗi rỗng/whitespace, tạo sản phẩm phải bị từ chối', () => {
    let productService: ProductService;
    let mockPrisma: any;
    let mockSkuGenerator: any;

    beforeEach(() => {
      mockPrisma = {
        category: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'cat-1',
            name: 'Đồng hồ',
            code: 'DONGHO',
          }),
        },
        product: {
          create: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
          findUnique: jest.fn(),
          count: jest.fn().mockResolvedValue(0),
          update: jest.fn(),
        },
      };

      mockSkuGenerator = {
        generateSku: jest.fn().mockResolvedValue('DONGHO-001-20231027'),
        removeDiacritics: jest.fn((text: string) => text.toUpperCase()),
        parseSku: jest.fn(),
        formatSku: jest.fn(),
      };

      productService = new ProductService(mockPrisma, mockSkuGenerator);
    });

    // Generate empty/whitespace-only strings
    const emptyOrWhitespaceArb = fc.oneof(
      fc.constant(''),
      fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r', '\f'), {
        minLength: 1,
        maxLength: 20,
      }),
    );

    it('should reject product creation with empty or whitespace-only names', async () => {
      await fc.assert(
        fc.asyncProperty(emptyOrWhitespaceArb, async (name: string) => {
          await expect(
            productService.create({
              name,
              categoryId: 'cat-1',
              price: 100,
            }),
          ).rejects.toThrow(BadRequestException);

          await expect(
            productService.create({
              name,
              categoryId: 'cat-1',
              price: 100,
            }),
          ).rejects.toThrow('Tên sản phẩm là bắt buộc');
        }),
      );
    });

    it('should reject product update with empty or whitespace-only names', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        name: 'Existing Product',
        sku: 'DONGHO-001-20231027',
      });

      await fc.assert(
        fc.asyncProperty(emptyOrWhitespaceArb, async (name: string) => {
          // Only test non-empty whitespace strings for update
          // (empty string with @IsOptional would skip validation)
          if (name.length > 0) {
            await expect(
              productService.update('prod-1', { name }),
            ).rejects.toThrow(BadRequestException);

            await expect(
              productService.update('prod-1', { name }),
            ).rejects.toThrow('Tên sản phẩm là bắt buộc');
          }
        }),
      );
    });
  });

  /**
   * Tests for updateThreshold and toggleDiscontinued
   */
  describe('updateThreshold and toggleDiscontinued', () => {
    let productService: ProductService;
    let mockPrisma: any;
    let mockSkuGenerator: any;

    beforeEach(() => {
      mockPrisma = {
        category: {
          findUnique: jest.fn(),
        },
        product: {
          create: jest.fn(),
          findMany: jest.fn(),
          findUnique: jest.fn(),
          count: jest.fn(),
          update: jest.fn(),
        },
      };

      mockSkuGenerator = {
        generateSku: jest.fn(),
      };

      productService = new ProductService(mockPrisma, mockSkuGenerator);
    });

    it('should update threshold with valid non-negative value', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        name: 'Test',
        minThreshold: 0,
      });
      mockPrisma.product.update.mockResolvedValue({
        id: 'prod-1',
        name: 'Test',
        minThreshold: 10,
      });

      const result = await productService.updateThreshold('prod-1', 10);
      expect(result.minThreshold).toBe(10);
    });

    it('should reject negative threshold', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        name: 'Test',
        minThreshold: 0,
      });

      await expect(
        productService.updateThreshold('prod-1', -1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should toggle isDiscontinued from false to true', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        isDiscontinued: false,
      });
      mockPrisma.product.update.mockResolvedValue({
        id: 'prod-1',
        isDiscontinued: true,
      });

      const result = await productService.toggleDiscontinued('prod-1');
      expect(result.isDiscontinued).toBe(true);
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isDiscontinued: true },
        }),
      );
    });

    it('should toggle isDiscontinued from true to false', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        isDiscontinued: true,
      });
      mockPrisma.product.update.mockResolvedValue({
        id: 'prod-1',
        isDiscontinued: false,
      });

      const result = await productService.toggleDiscontinued('prod-1');
      expect(result.isDiscontinued).toBe(false);
    });
  });
});
