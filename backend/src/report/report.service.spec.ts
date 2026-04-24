import { NotFoundException } from '@nestjs/common';
import { ReportService } from './report.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import * as ExcelJS from 'exceljs';

function createMockPrisma() {
  return {
    product: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

describe('ReportService', () => {
  describe('generateExcelReport', () => {
    it('should generate Excel buffer with correct columns when products exist', async () => {
      const mockProducts = [
        {
          id: 'p1',
          name: 'Sản phẩm A',
          sku: 'DONGHO-001-20240101',
          stock: 50,
          categoryId: 'cat-1',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-06-15'),
          category: { id: 'cat-1', name: 'Đồng hồ', code: 'DONGHO' },
          transactions: [
            { id: 't1', type: 'STOCK_IN', quantity: 100, createdAt: new Date() },
            { id: 't2', type: 'STOCK_OUT', quantity: 50, createdAt: new Date() },
          ],
        },
        {
          id: 'p2',
          name: 'Sản phẩm B',
          sku: 'DIENTHOAI-001-20240201',
          stock: 30,
          categoryId: 'cat-2',
          createdAt: new Date('2024-02-01'),
          updatedAt: new Date('2024-07-20'),
          category: { id: 'cat-2', name: 'Điện thoại', code: 'DIENTHOAI' },
          transactions: [
            { id: 't3', type: 'STOCK_IN', quantity: 30, createdAt: new Date() },
          ],
        },
      ];

      const mockPrisma = createMockPrisma();
      mockPrisma.product.findMany.mockResolvedValue(mockProducts);

      const service = new ReportService(mockPrisma as unknown as PrismaService);
      const buffer = await service.generateExcelReport({});

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // Parse the Excel to verify content
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
      const worksheet = workbook.getWorksheet('Báo cáo tồn kho');

      expect(worksheet).toBeDefined();

      // Verify headers
      const headerRow = worksheet!.getRow(1);
      expect(headerRow.getCell(1).value).toBe('Tên sản phẩm');
      expect(headerRow.getCell(2).value).toBe('SKU');
      expect(headerRow.getCell(3).value).toBe('Danh mục');
      expect(headerRow.getCell(4).value).toBe('Số lượng nhập');
      expect(headerRow.getCell(5).value).toBe('Số lượng xuất');
      expect(headerRow.getCell(6).value).toBe('Tồn kho hiện tại');
      expect(headerRow.getCell(7).value).toBe('Thời gian cập nhật cuối');

      // Verify data rows
      const row2 = worksheet!.getRow(2);
      expect(row2.getCell(1).value).toBe('Sản phẩm A');
      expect(row2.getCell(2).value).toBe('DONGHO-001-20240101');
      expect(row2.getCell(3).value).toBe('Đồng hồ');
      expect(row2.getCell(4).value).toBe(100);
      expect(row2.getCell(5).value).toBe(50);
      expect(row2.getCell(6).value).toBe(50);

      const row3 = worksheet!.getRow(3);
      expect(row3.getCell(1).value).toBe('Sản phẩm B');
      expect(row3.getCell(4).value).toBe(30);
      expect(row3.getCell(5).value).toBe(0);
      expect(row3.getCell(6).value).toBe(30);
    });

    it('should throw NotFoundException when no products match filters', async () => {
      const mockPrisma = createMockPrisma();
      mockPrisma.product.findMany.mockResolvedValue([]);

      const service = new ReportService(mockPrisma as unknown as PrismaService);

      await expect(
        service.generateExcelReport({ categoryId: 'nonexistent' }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.generateExcelReport({ categoryId: 'nonexistent' }),
      ).rejects.toThrow('Không có dữ liệu để xuất báo cáo');
    });

    it('should apply category filter when provided', async () => {
      const mockPrisma = createMockPrisma();
      mockPrisma.product.findMany.mockResolvedValue([]);

      const service = new ReportService(mockPrisma as unknown as PrismaService);

      try {
        await service.generateExcelReport({ categoryId: 'cat-1' });
      } catch {
        // Expected NotFoundException
      }

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ categoryId: 'cat-1' }),
        }),
      );
    });

    it('should apply date filters when provided', async () => {
      const mockPrisma = createMockPrisma();
      mockPrisma.product.findMany.mockResolvedValue([]);

      const service = new ReportService(mockPrisma as unknown as PrismaService);

      try {
        await service.generateExcelReport({
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        });
      } catch {
        // Expected NotFoundException
      }

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            updatedAt: {
              gte: new Date('2024-01-01'),
              lte: new Date('2024-12-31'),
            },
          }),
        }),
      );
    });
  });
});
