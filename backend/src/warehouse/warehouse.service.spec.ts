import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WarehouseService } from './warehouse.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('WarehouseService - V2 Methods', () => {
  let service: WarehouseService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      warehousePosition: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      warehouseLayout: {
        findFirst: jest.fn(),
      },
      inventoryTransaction: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) =>
        Promise.all(ops),
      ),
    };

    service = new WarehouseService(mockPrisma as unknown as PrismaService);
  });

  describe('movePosition', () => {
    it('should swap two positions when target is occupied', async () => {
      const posA = { id: 'a', layoutId: 'layout-1', row: 0, column: 0, isActive: true };
      const posB = { id: 'b', layoutId: 'layout-1', row: 1, column: 1, isActive: true };

      mockPrisma.warehousePosition.findUnique.mockResolvedValue(posA);
      mockPrisma.warehousePosition.findFirst.mockResolvedValue(posB);
      mockPrisma.warehousePosition.update.mockImplementation(({ where, data }: any) => ({
        ...where.id === 'a' ? posA : posB,
        ...data,
      }));
      mockPrisma.$transaction.mockResolvedValue([
        { ...posA, row: 1, column: 1 },
        { ...posB, row: 0, column: 0 },
      ]);

      const result = await service.movePosition('a', 1, 1);
      expect(result).toHaveLength(2);
    });

    it('should move to empty cell when target is unoccupied', async () => {
      const posA = { id: 'a', layoutId: 'layout-1', row: 0, column: 0 };

      mockPrisma.warehousePosition.findUnique.mockResolvedValue(posA);
      mockPrisma.warehousePosition.findFirst.mockResolvedValue(null);
      mockPrisma.warehousePosition.update.mockResolvedValue({
        ...posA,
        row: 2,
        column: 3,
      });

      const result = await service.movePosition('a', 2, 3);
      expect(result).toHaveLength(1);
    });

    it('should throw NotFoundException for non-existent position', async () => {
      mockPrisma.warehousePosition.findUnique.mockResolvedValue(null);
      await expect(service.movePosition('nonexistent', 0, 0)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateLabel', () => {
    it('should update label when no duplicate exists', async () => {
      mockPrisma.warehousePosition.findUnique.mockResolvedValue({
        id: 'pos-1',
        layoutId: 'layout-1',
        label: 'A1',
      });
      mockPrisma.warehousePosition.findFirst.mockResolvedValue(null);
      mockPrisma.warehousePosition.update.mockResolvedValue({
        id: 'pos-1',
        label: 'S1',
      });

      const result = await service.updateLabel('pos-1', 'S1');
      expect(result.label).toBe('S1');
    });

    it('should reject duplicate label', async () => {
      mockPrisma.warehousePosition.findUnique.mockResolvedValue({
        id: 'pos-1',
        layoutId: 'layout-1',
        label: 'A1',
      });
      mockPrisma.warehousePosition.findFirst.mockResolvedValue({
        id: 'pos-2',
        label: 'S1',
      });

      await expect(service.updateLabel('pos-1', 'S1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('toggleActive', () => {
    it('should deactivate position with no stock', async () => {
      mockPrisma.warehousePosition.findUnique.mockResolvedValue({
        id: 'pos-1',
        isActive: true,
        currentStock: 0,
        productId: null,
      });
      mockPrisma.warehousePosition.update.mockResolvedValue({
        id: 'pos-1',
        isActive: false,
      });

      const result = await service.toggleActive('pos-1');
      expect(result.isActive).toBe(false);
    });

    it('should reject deactivation when position has stock', async () => {
      mockPrisma.warehousePosition.findUnique.mockResolvedValue({
        id: 'pos-1',
        isActive: true,
        currentStock: 5,
        productId: null,
      });

      await expect(service.toggleActive('pos-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject deactivation when position has product', async () => {
      mockPrisma.warehousePosition.findUnique.mockResolvedValue({
        id: 'pos-1',
        isActive: true,
        currentStock: 0,
        productId: 'prod-1',
      });

      await expect(service.toggleActive('pos-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should activate inactive position', async () => {
      mockPrisma.warehousePosition.findUnique.mockResolvedValue({
        id: 'pos-1',
        isActive: false,
        currentStock: 0,
        productId: null,
      });
      mockPrisma.warehousePosition.update.mockResolvedValue({
        id: 'pos-1',
        isActive: true,
      });

      const result = await service.toggleActive('pos-1');
      expect(result.isActive).toBe(true);
    });
  });

  describe('updateCapacity', () => {
    it('should update capacity with valid positive value', async () => {
      mockPrisma.warehousePosition.findUnique.mockResolvedValue({
        id: 'pos-1',
        maxCapacity: null,
      });
      mockPrisma.warehousePosition.update.mockResolvedValue({
        id: 'pos-1',
        maxCapacity: 100,
      });

      const result = await service.updateCapacity('pos-1', 100);
      expect(result.maxCapacity).toBe(100);
    });

    it('should reject capacity <= 0', async () => {
      mockPrisma.warehousePosition.findUnique.mockResolvedValue({
        id: 'pos-1',
      });

      await expect(service.updateCapacity('pos-1', 0)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateCapacity('pos-1', -5)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
