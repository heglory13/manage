import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WarehouseService } from './warehouse/warehouse.service.js';
import { StocktakingService } from './stocktaking/stocktaking.service.js';
import { InventoryService } from './inventory/inventory.service.js';
import { PreliminaryCheckService } from './preliminary-check/preliminary-check.service.js';
import { ReportService, computeNxtReport } from './report/report.service.js';
import { PrismaService } from './prisma/prisma.service.js';

/**
 * Feature: system-upgrade-v2
 * Integration Tests — verifying end-to-end flows with mocked Prisma
 */

describe('Integration: Warehouse flow', () => {
  it('create layout → toggle cells → set capacity → drag/drop', async () => {
    // Simulate the warehouse flow
    const positions = [
      { id: 'p1', layoutId: 'L1', row: 0, column: 0, label: 'A1', isActive: true, currentStock: 0, productId: null, maxCapacity: null as number | null },
      { id: 'p2', layoutId: 'L1', row: 0, column: 1, label: 'A2', isActive: true, currentStock: 0, productId: null, maxCapacity: null as number | null },
    ];

    const mockPrisma: any = {
      warehousePosition: {
        findUnique: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(positions.find((p) => p.id === where.id) ?? null),
        ),
        findFirst: jest.fn().mockImplementation(({ where }: any) => {
          if (where.layoutId && where.row !== undefined && where.column !== undefined) {
            return Promise.resolve(
              positions.find((p) => p.layoutId === where.layoutId && p.row === where.row && p.column === where.column) ?? null,
            );
          }
          if (where.label) {
            return Promise.resolve(positions.find((p) => p.label === where.label && p.id !== where.id?.not) ?? null);
          }
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ where, data }: any) => {
          const pos = positions.find((p) => p.id === where.id);
          if (pos) Object.assign(pos, data);
          return Promise.resolve({ ...pos, product: null });
        }),
      },
      $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const service = new WarehouseService(mockPrisma as PrismaService);

    // 1. Toggle cell to inactive (no stock, no product)
    const toggled = await service.toggleActive('p1');
    expect(toggled.isActive).toBe(false);

    // 2. Toggle back to active
    positions[0].isActive = false;
    const reactivated = await service.toggleActive('p1');
    expect(reactivated.isActive).toBe(true);

    // 3. Set capacity
    positions[0].isActive = true;
    const withCapacity = await service.updateCapacity('p1', 50);
    expect(withCapacity.maxCapacity).toBe(50);

    // 4. Drag/drop (swap)
    positions[0].maxCapacity = 50;
    mockPrisma.warehousePosition.findFirst.mockResolvedValueOnce(positions[1]);
    const swapped = await service.movePosition('p1', 0, 1);
    expect(swapped).toHaveLength(2);
  });
});

describe('Integration: Stocktaking V2 flow', () => {
  it('create full → fill actual + reason → submit → approve → verify stock update', async () => {
    const products = [
      { id: 'p1', stock: 100 },
      { id: 'p2', stock: 50 },
    ];
    const stockState = new Map(products.map((p) => [p.id, p.stock]));

    const mockPrisma: any = {
      product: {
        findMany: jest.fn().mockResolvedValue(
          products.map((p) => ({ ...p, name: `P-${p.id}`, sku: `SKU-${p.id}`, price: 100, categoryId: 'c1', createdAt: new Date(), updatedAt: new Date() })),
        ),
        update: jest.fn().mockImplementation(({ where, data }: any) => {
          stockState.set(where.id, data.stock);
          return Promise.resolve({ id: where.id, stock: data.stock });
        }),
      },
      stocktakingRecord: {
        create: jest.fn().mockImplementation(({ data }: any) => {
          const items = data.items.create.map((item: any, i: number) => ({
            id: `item-${i}`, recordId: 'r-1', ...item,
            product: { id: item.productId, name: `P-${item.productId}` },
            discrepancyReason: null,
          }));
          return Promise.resolve({
            id: 'r-1', status: data.status, mode: data.mode, cutoffTime: data.cutoffTime,
            submittedAt: null, createdBy: data.createdBy, createdAt: new Date(), updatedAt: new Date(),
            items, creator: { id: 'user-1', name: 'User', email: 'u@t.com', role: 'STAFF' },
          });
        }),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      stocktakingItem: {
        update: jest.fn().mockResolvedValue({}),
      },
      stocktakingStatusHistory: {
        create: jest.fn().mockResolvedValue({ id: 'h-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const service = new StocktakingService(mockPrisma as PrismaService);

    // 1. Create full stocktaking
    const record = await service.create('full', 'user-1');
    expect(record.status).toBe('CHECKING');
    expect(record.items).toHaveLength(2);

    // 2. Submit with actual quantities and reasons
    mockPrisma.stocktakingRecord.findUnique.mockResolvedValue({
      id: 'r-1', status: 'CHECKING',
      items: record.items.map((item: any) => ({
        ...item, systemQuantity: item.systemQuantity, actualQuantity: 0, discrepancy: 0, discrepancyReason: null, evidenceUrl: null,
      })),
    });
    mockPrisma.stocktakingRecord.update.mockResolvedValue({ id: 'r-1', status: 'PENDING' });

    // findUnique for the final return
    mockPrisma.stocktakingRecord.findUnique.mockResolvedValueOnce({
      id: 'r-1', status: 'CHECKING',
      items: record.items,
    });

    await service.submit('r-1', [
      { itemId: 'item-0', actualQuantity: 95, discrepancyReason: 'Hàng hỏng' },
      { itemId: 'item-1', actualQuantity: 50 }, // no discrepancy
    ]);

    // 3. Approve
    mockPrisma.stocktakingRecord.findUnique.mockResolvedValue({
      id: 'r-1', status: 'PENDING',
      items: [
        { id: 'item-0', productId: 'p1', systemQuantity: 100, actualQuantity: 95, discrepancy: -5 },
        { id: 'item-1', productId: 'p2', systemQuantity: 50, actualQuantity: 50, discrepancy: 0 },
      ],
    });
    mockPrisma.stocktakingRecord.update.mockResolvedValue({
      id: 'r-1', status: 'APPROVED', items: [], creator: { id: 'user-1', name: 'U', email: 'u@t.com', role: 'MANAGER' },
    });

    await service.approve('r-1', 'user-1');

    // Verify stock was updated
    expect(stockState.get('p1')).toBe(95);
    expect(stockState.get('p2')).toBe(50);
  });
});

describe('Integration: Preliminary → Detail flow', () => {
  it('create preliminary → verify PENDING status', async () => {
    const mockPrisma: any = {
      classification: {
        findUnique: jest.fn().mockResolvedValue({ id: 'cls-1', name: 'Áo' }),
      },
      warehouseType: {
        findUnique: jest.fn().mockResolvedValue({ id: 'wt-1', name: 'Kho sản xuất' }),
      },
      preliminaryCheck: {
        create: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({
            id: 'pc-1', ...data, createdAt: new Date(), updatedAt: new Date(),
            classification: { id: data.classificationId, name: 'Áo' },
            warehouseType: { id: data.warehouseTypeId, name: 'Kho sản xuất' },
            creator: { id: data.createdBy, name: 'User', email: 'u@t.com' },
          }),
        ),
      },
    };

    const service = new PreliminaryCheckService(mockPrisma as PrismaService);

    const check = await service.create(
      { classificationId: 'cls-1', quantity: 100, warehouseTypeId: 'wt-1' },
      'user-1',
    );

    expect(check.status).toBe('PENDING');
    expect(check.quantity).toBe(100);
  });
});

describe('Integration: NXT Report flow', () => {
  it('computeNxtReport maintains closingStock = openingStock + totalIn - totalOut', () => {
    const skuCombos = [
      {
        id: 'combo-1',
        compositeSku: 'AO-DO-M-COTTON',
        classification: { name: 'Áo' },
        color: { name: 'Đỏ' },
        size: { name: 'M' },
        material: { name: 'Cotton' },
      },
    ];

    const transactionsBefore = [
      { skuComboId: 'combo-1', type: 'STOCK_IN', quantity: 100 },
      { skuComboId: 'combo-1', type: 'STOCK_OUT', quantity: 30 },
    ];

    const transactionsInPeriod = [
      { skuComboId: 'combo-1', type: 'STOCK_IN', quantity: 50 },
      { skuComboId: 'combo-1', type: 'STOCK_OUT', quantity: 20 },
    ];

    const result = computeNxtReport(skuCombos, transactionsBefore, transactionsInPeriod);

    expect(result).toHaveLength(1);
    const item = result[0];
    expect(item.openingStock).toBe(70); // 100 - 30
    expect(item.totalIn).toBe(50);
    expect(item.totalOut).toBe(20);
    expect(item.closingStock).toBe(100); // 70 + 50 - 20
    // Invariant: closingStock = openingStock + totalIn - totalOut
    expect(item.closingStock).toBe(item.openingStock + item.totalIn - item.totalOut);
  });
});

describe('Integration: Excel Import flow', () => {
  it('validateImportRow rejects missing required fields', () => {
    const mockPrisma: any = {};
    const service = new ReportService(mockPrisma as PrismaService);

    const lookups = {
      classifications: new Map([['áo', 'cls-1']]),
      colors: new Map([['đỏ', 'col-1']]),
      sizes: new Map([['m', 'sz-1']]),
      materials: new Map([['cotton', 'mat-1']]),
      conditions: new Map([['đạt tiêu chuẩn', 'cond-1']]),
    };

    // Missing classification
    const result1 = service.validateImportRow({ classification: '', color: 'Đỏ', size: 'M', material: 'Cotton', quantity: 10 }, 2, lookups);
    expect(result1.valid).toBe(false);
    expect(result1.errors.some((e) => e.field === 'Phân loại')).toBe(true);

    // Invalid quantity
    const result2 = service.validateImportRow({ classification: 'Áo', color: 'Đỏ', size: 'M', material: 'Cotton', quantity: 0 }, 3, lookups);
    expect(result2.valid).toBe(false);
    expect(result2.errors.some((e) => e.field === 'Số lượng')).toBe(true);

    // All valid
    const result3 = service.validateImportRow({ classification: 'Áo', color: 'Đỏ', size: 'M', material: 'Cotton', quantity: 10 }, 4, lookups);
    expect(result3.valid).toBe(true);
  });
});
