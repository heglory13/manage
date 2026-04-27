import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SkuComboService } from './sku-combo.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('SkuComboService - Unit Tests', () => {
  let service: SkuComboService;
  let prisma: Record<string, unknown>;

  beforeEach(async () => {
    prisma = {
      classification: {
        findUnique: jest.fn().mockResolvedValue({ id: 'c1', name: 'Oversize' }),
      },
      color: {
        findUnique: jest.fn().mockResolvedValue({ id: 'c2', name: 'Đen' }),
      },
      size: {
        findUnique: jest.fn().mockResolvedValue({ id: 's1', name: 'XL' }),
      },
      material: {
        findUnique: jest.fn().mockResolvedValue({ id: 'm1', name: 'Cotton' }),
      },
      skuCombo: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'combo-1',
          ...data,
          classification: { id: 'c1', name: 'Oversize' },
          color: { id: 'c2', name: 'Đen' },
          size: { id: 's1', name: 'XL' },
          material: { id: 'm1', name: 'Cotton' },
          createdAt: new Date(),
        })),
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

  describe('generateCompositeSku', () => {
    it('should generate correct format', () => {
      expect(
        service.generateCompositeSku('Oversize', 'Đen', 'XL', 'Cotton'),
      ).toBe('Oversize-Đen-XL-Cotton');
    });

    it('should handle Vietnamese characters', () => {
      expect(
        service.generateCompositeSku('Slim Fit', 'Trắng', 'M', 'Linen'),
      ).toBe('Slim Fit-Trắng-M-Linen');
    });
  });

  describe('create', () => {
    it('should create combo successfully', async () => {
      const result = await service.create({
        classificationId: 'c1',
        colorId: 'c2',
        sizeId: 's1',
        materialId: 'm1',
      });

      expect(result.compositeSku).toBe('Oversize-Đen-XL-Cotton');
    });

    it('should throw NotFoundException for missing classification', async () => {
      (prisma.classification as Record<string, jest.Mock>).findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          classificationId: 'invalid',
          colorId: 'c2',
          sizeId: 's1',
          materialId: 'm1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException for duplicate combo', async () => {
      (prisma.skuCombo as Record<string, jest.Mock>).findUnique.mockResolvedValue({
        id: 'existing',
      });

      await expect(
        service.create({
          classificationId: 'c1',
          colorId: 'c2',
          sizeId: 's1',
          materialId: 'm1',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getAll', () => {
    it('should return paginated results', async () => {
      (prisma.skuCombo as Record<string, jest.Mock>).findMany.mockResolvedValue([]);
      (prisma.skuCombo as Record<string, jest.Mock>).count.mockResolvedValue(0);

      const result = await service.getAll({ page: '1', limit: '10' });

      expect(result).toEqual({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });
    });

    it('should apply search filter', async () => {
      await service.getAll({ search: 'Oversize' });

      const call = (prisma.skuCombo as Record<string, jest.Mock>).findMany.mock.calls[0][0];
      expect(call.where.OR).toBeDefined();
      expect(call.where.OR).toHaveLength(5);
    });
  });
});
