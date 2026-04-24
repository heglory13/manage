import * as fc from 'fast-check';
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('InventoryService - Storage Zone Capacity', () => {
  let service: InventoryService;
  let prisma: Record<string, unknown>;

  beforeEach(async () => {
    prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'product-1',
          name: 'Test Product',
          stock: 100,
        }),
        update: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _sum: { stock: 0 } }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      storageZone: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      inventoryTransaction: {
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'tx-1',
          ...data,
          createdAt: new Date(),
        })),
      },
      warehouseConfig: {
        findFirst: jest.fn().mockResolvedValue({ maxCapacity: 1000 }),
      },
      $transaction: jest.fn().mockImplementation(async (ops) => {
        const results = [];
        for (const op of ops) {
          results.push(await op);
        }
        return results;
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(InventoryService);
  });

  /**
   * **Validates: Requirements 9.3, 9.4**
   * Feature: input-declaration-module, Property 10: Từ chối nhập kho vượt sức chứa khu vực
   */
  describe('P10: Reject stock-in exceeding zone capacity', () => {
    it('should reject when quantity exceeds remaining capacity', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 0, max: 999 }),
          async (maxCapacity, currentStock) => {
            // Ensure currentStock <= maxCapacity
            const validCurrentStock = Math.min(currentStock, maxCapacity);
            const remaining = maxCapacity - validCurrentStock;

            // Generate quantity that exceeds remaining
            if (remaining <= 0) {
              // Zone is full
              (prisma.storageZone as Record<string, jest.Mock>).findUnique.mockResolvedValue({
                id: 'zone-1',
                name: 'Test Zone',
                maxCapacity,
                currentStock: maxCapacity,
              });

              await expect(
                service.stockIn('product-1', 1, 'user-1', {
                  storageZoneId: 'zone-1',
                }),
              ).rejects.toThrow(BadRequestException);
            } else {
              // Zone has some capacity but we try to exceed it
              const excessQuantity = remaining + 1;

              (prisma.storageZone as Record<string, jest.Mock>).findUnique.mockResolvedValue({
                id: 'zone-1',
                name: 'Test Zone',
                maxCapacity,
                currentStock: validCurrentStock,
              });

              await expect(
                service.stockIn('product-1', excessQuantity, 'user-1', {
                  storageZoneId: 'zone-1',
                }),
              ).rejects.toThrow(BadRequestException);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject with "đã đầy" message when zone is at max capacity', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }),
          async (maxCapacity) => {
            (prisma.storageZone as Record<string, jest.Mock>).findUnique.mockResolvedValue({
              id: 'zone-1',
              name: 'Test Zone',
              maxCapacity,
              currentStock: maxCapacity,
            });

            await expect(
              service.stockIn('product-1', 1, 'user-1', {
                storageZoneId: 'zone-1',
              }),
            ).rejects.toThrow('Khu vực này đã đầy, không thể nhập thêm hàng');
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
