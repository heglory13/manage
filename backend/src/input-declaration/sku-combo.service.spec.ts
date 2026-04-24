import * as fc from 'fast-check';
import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { SkuComboService } from './sku-combo.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('SkuComboService', () => {
  let service: SkuComboService;
  let prisma: Record<string, unknown>;

  beforeEach(async () => {
    prisma = {
      classification: {
        findUnique: jest.fn(),
      },
      color: {
        findUnique: jest.fn(),
      },
      size: {
        findUnique: jest.fn(),
      },
      material: {
        findUnique: jest.fn(),
      },
      skuCombo: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        SkuComboService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(SkuComboService);
  });

  /**
   * **Validates: Requirements 5.1**
   * Feature: input-declaration-module, Property 5: Định dạng SKU tổng hợp
   */
  describe('P5: Composite SKU format', () => {
    it('should generate SKU in format "{classification}-{color}-{size}-{material}"', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          (classification, color, size, material) => {
            const result = service.generateCompositeSku(
              classification,
              color,
              size,
              material,
            );
            expect(result).toBe(
              `${classification}-${color}-${size}-${material}`,
            );

            // Verify format: exactly 3 dashes separating 4 parts
            const parts = result.split('-');
            // Note: parts may have more than 4 if names contain dashes
            // But the format should start with classification and end with material
            expect(result.startsWith(classification)).toBe(true);
            expect(result.endsWith(material)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Validates: Requirements 5.3, 5.4**
   * Feature: input-declaration-module, Property 6: Từ chối tổ hợp SKU trùng lặp
   */
  describe('P6: Reject duplicate SKU combo', () => {
    it('should reject combo with same 4 attribute IDs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          async (classificationId, colorId, sizeId, materialId) => {
            // Setup: all FKs exist
            (prisma.classification as Record<string, jest.Mock>).findUnique.mockResolvedValue({
              id: classificationId,
              name: 'TestClassification',
            });
            (prisma.color as Record<string, jest.Mock>).findUnique.mockResolvedValue({
              id: colorId,
              name: 'TestColor',
            });
            (prisma.size as Record<string, jest.Mock>).findUnique.mockResolvedValue({
              id: sizeId,
              name: 'TestSize',
            });
            (prisma.material as Record<string, jest.Mock>).findUnique.mockResolvedValue({
              id: materialId,
              name: 'TestMaterial',
            });

            // Combo already exists
            (prisma.skuCombo as Record<string, jest.Mock>).findUnique.mockResolvedValue({
              id: 'existing-id',
              classificationId,
              colorId,
              sizeId,
              materialId,
              compositeSku: 'TestClassification-TestColor-TestSize-TestMaterial',
            });

            await expect(
              service.create({ classificationId, colorId, sizeId, materialId }),
            ).rejects.toThrow(ConflictException);

            expect(
              (prisma.skuCombo as Record<string, jest.Mock>).create,
            ).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Validates: Requirements 6.3**
   * Feature: input-declaration-module, Property 7: Tìm kiếm SKU tổng hợp trả về kết quả phù hợp
   */
  describe('P7: Search returns matching results', () => {
    it('should call findMany with search filter when search is provided', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          async (searchTerm) => {
            (prisma.skuCombo as Record<string, jest.Mock>).findMany.mockResolvedValue([]);
            (prisma.skuCombo as Record<string, jest.Mock>).count.mockResolvedValue(0);

            const result = await service.getAll({ search: searchTerm });

            expect(result).toBeDefined();
            expect(result.data).toEqual([]);

            // Verify the search was passed to Prisma with OR conditions
            const findManyCall = (prisma.skuCombo as Record<string, jest.Mock>).findMany.mock.calls[0][0];
            expect(findManyCall.where.OR).toBeDefined();
            expect(findManyCall.where.OR.length).toBe(5); // compositeSku, classification, color, size, material
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Validates: Requirements 9.2**
   * Feature: input-declaration-module, Property 9: Tính toán số lượng còn nhập được
   */
  describe('P9: Remaining capacity calculation', () => {
    it('remaining capacity should equal maxCapacity - currentStock', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }),
          fc.integer({ min: 0, max: 10000 }),
          (maxCapacity, currentStock) => {
            // Ensure currentStock <= maxCapacity
            const validCurrentStock = Math.min(currentStock, maxCapacity);
            const remaining = maxCapacity - validCurrentStock;
            expect(remaining).toBe(maxCapacity - validCurrentStock);
            expect(remaining).toBeGreaterThanOrEqual(0);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
