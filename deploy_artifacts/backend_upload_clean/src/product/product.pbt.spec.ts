import * as fc from 'fast-check';
import { BadRequestException } from '@nestjs/common';
import { ProductService } from './product.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SkuGeneratorService } from './sku-generator.service.js';

/**
 * Feature: system-upgrade-v2
 * Property-Based Tests for Product Module
 */

describe('Product PBT', () => {
  /**
   * Property 22: Ngưỡng Min không âm
   * Negative minThreshold must be rejected. Non-negative must succeed.
   *
   * **Validates: Requirements 17.3, 17.4**
   */
  describe('P22: Min threshold non-negative', () => {
    it('rejects negative minThreshold', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: -100000, max: -1 }),
          async (negativeThreshold) => {
            const mockPrisma = {
              product: {
                findUnique: jest.fn().mockResolvedValue({
                  id: 'p-1',
                  name: 'Test',
                  minThreshold: 0,
                }),
                update: jest.fn(),
              },
            };

            const service = new ProductService(
              mockPrisma as unknown as PrismaService,
              {} as SkuGeneratorService,
            );

            await expect(service.updateThreshold('p-1', negativeThreshold)).rejects.toThrow(BadRequestException);
            expect(mockPrisma.product.update).not.toHaveBeenCalled();
          },
        ),
      );
    });

    it('accepts non-negative minThreshold', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 100000 }),
          async (validThreshold) => {
            const mockPrisma = {
              product: {
                findUnique: jest.fn().mockResolvedValue({
                  id: 'p-1',
                  name: 'Test',
                  minThreshold: 0,
                }),
                update: jest.fn().mockImplementation(({ data }: any) =>
                  Promise.resolve({ id: 'p-1', minThreshold: data.minThreshold, category: { name: 'Cat' } }),
                ),
              },
            };

            const service = new ProductService(
              mockPrisma as unknown as PrismaService,
              {} as SkuGeneratorService,
            );

            const result = await service.updateThreshold('p-1', validThreshold);
            expect(result.minThreshold).toBe(validThreshold);
          },
        ),
      );
    });
  });
});
