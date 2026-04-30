import { NotFoundException } from '@nestjs/common';
import { PreliminaryCheckService } from './preliminary-check.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

function createMockPrisma() {
  return {
    classification: {
      findUnique: jest.fn().mockResolvedValue({ id: 'cls-1', name: 'Test' }),
    },
    warehouseType: {
      findUnique: jest.fn().mockResolvedValue({ id: 'wt-1', name: 'Kho sản xuất' }),
    },
    preliminaryCheck: {
      create: jest.fn().mockImplementation(({ data }) => {
        return Promise.resolve({
          id: 'pc-1',
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          classification: { id: data.classificationId, name: 'Test' },
          warehouseType: data.warehouseTypeId ? { id: data.warehouseTypeId, name: 'Kho' } : null,
          creator: { id: data.createdBy, name: 'User', email: 'user@test.com' },
        });
      }),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
  };
}

describe('PreliminaryCheckService', () => {
  it('should create a preliminary check with PENDING status', async () => {
    const mockPrisma = createMockPrisma();
    const service = new PreliminaryCheckService(mockPrisma as unknown as PrismaService);

    const result = await service.create(
      { classificationId: 'cls-1', quantity: 10 },
      'user-1',
    );

    expect(result.status).toBe('PENDING');
    expect(result.classificationId).toBe('cls-1');
    expect(mockPrisma.preliminaryCheck.create).toHaveBeenCalled();
  });

  it('should throw NotFoundException for invalid classification', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.classification.findUnique.mockResolvedValue(null);
    const service = new PreliminaryCheckService(mockPrisma as unknown as PrismaService);

    await expect(
      service.create({ classificationId: 'invalid', quantity: 5 }, 'user-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw NotFoundException for invalid warehouseType', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.warehouseType.findUnique.mockResolvedValue(null);
    const service = new PreliminaryCheckService(mockPrisma as unknown as PrismaService);

    await expect(
      service.create(
        { classificationId: 'cls-1', quantity: 5, warehouseTypeId: 'invalid' },
        'user-1',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw NotFoundException for non-existent check in findOne', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.preliminaryCheck.findUnique.mockResolvedValue(null);
    const service = new PreliminaryCheckService(mockPrisma as unknown as PrismaService);

    await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
  });

  it('should return paginated results from findAll', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.preliminaryCheck.findMany.mockResolvedValue([{ id: 'pc-1' }]);
    mockPrisma.preliminaryCheck.count.mockResolvedValue(1);
    const service = new PreliminaryCheckService(mockPrisma as unknown as PrismaService);

    const result = await service.findAll({ page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });
});
