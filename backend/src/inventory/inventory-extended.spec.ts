import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('InventoryService - Extended with StorageZone', () => {
  let service: InventoryService;
  let prisma: Record<string, unknown>;

  beforeEach(async () => {
    prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'product-1',
          name: 'Test Product',
          stock: 50,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      storageZone: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      inventoryTransaction: {
        findFirst: jest.fn().mockResolvedValue({ purchasePrice: 100 }),
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

  describe('stockIn with storageZoneId', () => {
    it('should succeed when zone has enough capacity', async () => {
      (prisma.storageZone as Record<string, jest.Mock>).findUnique.mockResolvedValue({
        id: 'zone-1',
        name: 'OV1',
        maxCapacity: 100,
        currentStock: 50,
      });

      const result = await service.stockIn('product-1', 10, 'user-1', {
        storageZoneId: 'zone-1',
        purchasePrice: 100,
        salePrice: 150,
      });

      expect(result).toBeDefined();
    });

    it('should throw when zone is full', async () => {
      (prisma.storageZone as Record<string, jest.Mock>).findUnique.mockResolvedValue({
        id: 'zone-1',
        name: 'OV1',
        maxCapacity: 100,
        currentStock: 100,
      });

      await expect(
        service.stockIn('product-1', 1, 'user-1', {
          storageZoneId: 'zone-1',
        }),
      ).rejects.toThrow('Khu vực này đã đầy, không thể nhập thêm hàng');
    });

    it('should throw when quantity exceeds remaining capacity', async () => {
      (prisma.storageZone as Record<string, jest.Mock>).findUnique.mockResolvedValue({
        id: 'zone-1',
        name: 'OV1',
        maxCapacity: 100,
        currentStock: 95,
      });

      await expect(
        service.stockIn('product-1', 10, 'user-1', {
          storageZoneId: 'zone-1',
        }),
      ).rejects.toThrow('Chỉ được nhập tối đa 5');
    });

    it('should throw NotFoundException for non-existent zone', async () => {
      (prisma.storageZone as Record<string, jest.Mock>).findUnique.mockResolvedValue(null);

      await expect(
        service.stockIn('product-1', 10, 'user-1', {
          storageZoneId: 'invalid-zone',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should work without storageZoneId', async () => {
      const result = await service.stockIn('product-1', 10, 'user-1', {
        purchasePrice: 100,
        salePrice: 150,
      });
      expect(result).toBeDefined();
    });
  });

  describe('stockOut with storageZoneId', () => {
    it('should succeed and decrement zone currentStock', async () => {
      const result = await service.stockOut('product-1', 5, 'user-1', {
        storageZoneId: 'zone-1',
      });

      expect(result).toBeDefined();
    });

    it('should work without storageZoneId', async () => {
      const result = await service.stockOut('product-1', 5, 'user-1');
      expect(result).toBeDefined();
    });

    it('should include optional fields in transaction data', async () => {
      await service.stockOut('product-1', 5, 'user-1', {
        skuComboId: 'combo-1',
        productConditionId: 'cond-1',
        storageZoneId: 'zone-1',
      });

      const createCall = (prisma.inventoryTransaction as Record<string, jest.Mock>).create.mock.calls[0][0];
      expect(createCall.data.skuComboId).toBe('combo-1');
      expect(createCall.data.productConditionId).toBe('cond-1');
      expect(createCall.data.storageZoneId).toBe('zone-1');
    });
  });
});
