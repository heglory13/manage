import * as fc from 'fast-check';
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('InventoryService - Storage zone capacity', () => {
  let service: InventoryService;
  let prisma: Record<string, unknown>;

  beforeEach(async () => {
    prisma = {
      category: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'cat-1',
          name: 'Danh mục 1',
        }),
      },
      storageZone: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      warehousePosition: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
      preliminaryCheck: {
        update: jest.fn(),
      },
      inventoryTransaction: {
        findFirst: jest.fn().mockResolvedValue({ purchasePrice: 100 }),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'tx-1',
          ...data,
          createdAt: new Date(),
        })),
        count: jest.fn().mockResolvedValue(0),
      },
      warehouseConfig: {
        findFirst: jest.fn().mockResolvedValue({ maxCapacity: 1000 }),
      },
      $transaction: jest.fn().mockImplementation(async (ops) => {
        const results = [];
        for (const op of ops) results.push(await op);
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

  it('should reject stock-in exceeding remaining zone capacity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 0, max: 999 }),
        async (maxCapacity, currentStock) => {
          const validCurrentStock = Math.min(currentStock, maxCapacity);
          const remaining = maxCapacity - validCurrentStock;

          if (remaining <= 0) {
            (prisma.storageZone as Record<string, jest.Mock>).findUnique.mockResolvedValue({
              id: 'zone-1',
              name: 'Test Zone',
              maxCapacity,
              currentStock: maxCapacity,
            });

            await expect(
              service.stockIn('cat-1', 1, 'user-1', {
                storageZoneId: 'zone-1',
                purchasePrice: 100,
                salePrice: 150,
              }),
            ).rejects.toThrow(BadRequestException);
          } else {
            (prisma.storageZone as Record<string, jest.Mock>).findUnique.mockResolvedValue({
              id: 'zone-1',
              name: 'Test Zone',
              maxCapacity,
              currentStock: validCurrentStock,
            });

            await expect(
              service.stockIn('cat-1', remaining + 1, 'user-1', {
                storageZoneId: 'zone-1',
                purchasePrice: 100,
                salePrice: 150,
              }),
            ).rejects.toThrow(BadRequestException);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should reject with full-zone message when current stock reaches max capacity', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 1000 }), async (maxCapacity) => {
        (prisma.storageZone as Record<string, jest.Mock>).findUnique.mockResolvedValue({
          id: 'zone-1',
          name: 'Test Zone',
          maxCapacity,
          currentStock: maxCapacity,
        });

        await expect(
          service.stockIn('cat-1', 1, 'user-1', {
            storageZoneId: 'zone-1',
            purchasePrice: 100,
            salePrice: 150,
          }),
        ).rejects.toThrow('Khu vực này đã đầy, không thể nhập thêm hàng');
      }),
      { numRuns: 100 },
    );
  });
});
