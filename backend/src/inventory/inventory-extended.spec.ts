import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('InventoryService - StorageZone flow', () => {
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
        update: jest.fn().mockResolvedValue({}),
      },
      warehousePosition: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      preliminaryCheck: {
        update: jest.fn().mockResolvedValue({}),
      },
      inventoryTransaction: {
        findFirst: jest.fn().mockResolvedValue({ purchasePrice: 100 }),
        findMany: jest.fn().mockImplementation(({ where }: any) => {
          // When querying by skuComboId, return zone-enriched transactions
          if (where?.skuComboId) {
            return Promise.resolve([
              {
                type: 'STOCK_IN',
                quantity: 50,
                storageZoneId: 'zone-1',
                storageZone: { id: 'zone-1', name: 'OV1' },
              },
            ]);
          }
          return Promise.resolve([
            { type: 'STOCK_IN', quantity: 50, status: 'ACTIVE' },
          ]);
        }),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'tx-1',
          ...data,
          createdAt: new Date(),
        })),
        count: jest.fn().mockResolvedValue(0),
      },
      product: {
        findFirst: jest.fn().mockResolvedValue({ isDiscontinued: false }),
      },
      warehouseConfig: {
        findFirst: jest.fn().mockResolvedValue({ maxCapacity: 1000 }),
      },
      $transaction: jest.fn().mockImplementation((fnOrOps: unknown) =>
        typeof fnOrOps === 'function'
          ? (fnOrOps as (tx: unknown) => Promise<unknown>)(prisma)
          : Promise.all(fnOrOps as Array<Promise<unknown>>),
      ),
    };

    const module = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(InventoryService);
  });

  it('stockIn should succeed when zone has enough capacity', async () => {
    (
      prisma.storageZone as Record<string, jest.Mock>
    ).findUnique.mockResolvedValue({
      id: 'zone-1',
      name: 'OV1',
      maxCapacity: 100,
      currentStock: 50,
    });

    const result = await service.stockIn('cat-1', 10, 'user-1', {
      storageZoneId: 'zone-1',
      purchasePrice: 100,
      salePrice: 150,
    });

    expect(result).toBeDefined();
  });

  it('stockIn should throw when zone is full', async () => {
    (
      prisma.storageZone as Record<string, jest.Mock>
    ).findUnique.mockResolvedValue({
      id: 'zone-1',
      name: 'OV1',
      maxCapacity: 100,
      currentStock: 100,
    });

    await expect(
      service.stockIn('cat-1', 1, 'user-1', {
        storageZoneId: 'zone-1',
        purchasePrice: 100,
        salePrice: 150,
      }),
    ).rejects.toThrow('Khu vực này đã đầy, không thể nhập thêm hàng');
  });

  it('stockIn should throw when quantity exceeds remaining capacity', async () => {
    (
      prisma.storageZone as Record<string, jest.Mock>
    ).findUnique.mockResolvedValue({
      id: 'zone-1',
      name: 'OV1',
      maxCapacity: 100,
      currentStock: 95,
    });

    await expect(
      service.stockIn('cat-1', 10, 'user-1', {
        storageZoneId: 'zone-1',
        purchasePrice: 100,
        salePrice: 150,
      }),
    ).rejects.toThrow('Chỉ được nhập tối đa 5');
  });

  it('stockIn should throw for non-existent zone', async () => {
    (
      prisma.storageZone as Record<string, jest.Mock>
    ).findUnique.mockResolvedValue(null);

    await expect(
      service.stockIn('cat-1', 10, 'user-1', {
        storageZoneId: 'invalid-zone',
        purchasePrice: 100,
        salePrice: 150,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('stockOut should include optional category-based fields only', async () => {
    await service.stockOut('cat-1', 5, 'user-1', {
      skuComboId: 'combo-1',
      productConditionId: 'cond-1',
      storageZoneId: 'zone-1',
    });

    const createCall = (
      prisma.inventoryTransaction as Record<string, jest.Mock>
    ).create.mock.calls[0][0];
    expect(createCall.data.categoryId).toBe('cat-1');
    expect(createCall.data.skuComboId).toBe('combo-1');
    expect(createCall.data.productConditionId).toBe('cond-1');
    expect(createCall.data.storageZoneId).toBe('zone-1');
  });
});
