import { NotFoundException } from '@nestjs/common';
import { ReportService } from './report.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import * as ExcelJS from 'exceljs';

function createMockPrisma() {
  return {
    category: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    inventoryTransaction: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
    },
    productCondition: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

describe('ReportService', () => {
  it('getNxtReport should aggregate by categoryId and categoryName', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.category.findMany.mockResolvedValue([
      { id: 'cat-1', name: 'Dong ho' },
      { id: 'cat-2', name: 'Dien thoai' },
    ]);
    mockPrisma.inventoryTransaction.findMany.mockResolvedValue([
      {
        categoryId: 'cat-1',
        category: { id: 'cat-1', name: 'Dong ho' },
        type: 'STOCK_IN',
        quantity: 100,
        purchasePrice: 10,
        createdAt: new Date('2024-01-01T08:00:00.000Z'),
      },
      {
        categoryId: 'cat-1',
        category: { id: 'cat-1', name: 'Dong ho' },
        type: 'STOCK_OUT',
        quantity: 40,
        purchasePrice: 10,
        createdAt: new Date('2024-01-15T08:00:00.000Z'),
      },
      {
        categoryId: 'cat-2',
        category: { id: 'cat-2', name: 'Dien thoai' },
        type: 'STOCK_IN',
        quantity: 20,
        purchasePrice: 50,
        createdAt: new Date('2024-01-20T08:00:00.000Z'),
      },
    ]);

    const service = new ReportService(mockPrisma as unknown as PrismaService);
    const result = await service.getNxtReport('2024-01-01', '2024-01-31');

    // Results sorted by productName (Vietnamese locale): 'Dien thoai' < 'Dong ho'
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          categoryId: 'cat-1',
          categoryName: 'Dong ho',
          totalIn: 100,
          totalOut: 40,
          closingStock: 60,
        }),
        expect.objectContaining({
          categoryId: 'cat-2',
          categoryName: 'Dien thoai',
          totalIn: 20,
          totalOut: 0,
          closingStock: 20,
        }),
      ]),
    );
  });

  it('generateExcelReport should export category-based headers', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.category.findMany.mockResolvedValue([
      { id: 'cat-1', name: 'Dong ho' },
    ]);
    mockPrisma.inventoryTransaction.findMany.mockResolvedValue([
      {
        categoryId: 'cat-1',
        category: { id: 'cat-1', name: 'Dong ho' },
        type: 'STOCK_IN',
        quantity: 10,
        purchasePrice: 100,
        createdAt: new Date('2024-01-10T08:00:00.000Z'),
      },
    ]);

    const service = new ReportService(mockPrisma as unknown as PrismaService);
    const buffer = await service.generateExcelReport({
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const worksheet = workbook.getWorksheet('Bao cao ton kho');

    expect(worksheet).toBeDefined();
    expect(worksheet!.getRow(1).getCell(1).value).toBe('Danh mục');
    expect(worksheet!.getRow(2).getCell(1).value).toBe('Dong ho');
  });

  it('generateExcelReport should throw NotFoundException when no category data exists', async () => {
    const mockPrisma = createMockPrisma();
    const service = new ReportService(mockPrisma as unknown as PrismaService);

    await expect(
      service.generateExcelReport({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        categoryId: 'missing-category',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('getNxtReport should pass categoryId filter to transaction query', async () => {
    const mockPrisma = createMockPrisma();
    const service = new ReportService(mockPrisma as unknown as PrismaService);

    await service.getNxtReport('2024-01-01', '2024-01-31', 'cat-1');

    // Service filters inventoryTransaction directly with categoryId, not category.findMany
    expect(mockPrisma.inventoryTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ categoryId: 'cat-1' }),
      }),
    );
  });
});
