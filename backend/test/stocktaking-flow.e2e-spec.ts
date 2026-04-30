import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Integration test: Stocktaking flow
 * tạo biên bản → phê duyệt → kiểm tra tồn kho cập nhật
 */
describe('Stocktaking Flow (e2e)', () => {
  let app: INestApplication<App>;

  const mockManager = {
    id: 'manager-1',
    email: 'manager@test.com',
    password: '',
    name: 'Test Manager',
    role: 'MANAGER' as const,
    refreshToken: null as string | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProduct = {
    id: 'prod-1',
    name: 'Đồng hồ Casio',
    sku: 'DONGHO-001-20240101',
    price: 500000,
    categoryId: 'cat-1',
    stock: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    category: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    inventoryTransaction: {
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    warehouseConfig: {
      findFirst: jest.fn(),
    },
    warehouseLayout: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    warehousePosition: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    stocktakingRecord: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
  };

  let accessToken: string;

  beforeAll(async () => {
    mockManager.password = await bcrypt.hash('password123', 10);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    // Login as manager
    mockPrismaService.user.findUnique.mockResolvedValue({ ...mockManager });
    mockPrismaService.user.update.mockResolvedValue({ ...mockManager });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'manager@test.com', password: 'password123' });

    accessToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaService.user.findUnique.mockResolvedValue({ ...mockManager });
  });

  describe('Complete Stocktaking Flow: create → approve → verify stock updated', () => {
    const stocktakingRecordId = 'record-1';

    it('Step 1: Should create a stocktaking record with discrepancy', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([
        { ...mockProduct, stock: 50 },
      ]);

      const createdRecord = {
        id: stocktakingRecordId,
        status: 'PENDING',
        createdBy: 'manager-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [
          {
            id: 'item-1',
            recordId: stocktakingRecordId,
            productId: 'prod-1',
            systemQuantity: 50,
            actualQuantity: 45,
            discrepancy: -5,
            evidenceUrl: 'https://example.com/evidence.jpg',
            product: mockProduct,
          },
        ],
        creator: {
          id: 'manager-1',
          name: 'Test Manager',
          email: 'manager@test.com',
          role: 'MANAGER',
        },
      };

      mockPrismaService.stocktakingRecord.create.mockResolvedValue(
        createdRecord,
      );

      const response = await request(app.getHttpServer())
        .post('/stocktaking')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          items: [
            {
              productId: 'prod-1',
              actualQuantity: 45,
              evidenceUrl: 'https://example.com/evidence.jpg',
            },
          ],
        })
        .expect(201);

      expect(response.body.status).toBe('PENDING');
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].discrepancy).toBe(-5);
      expect(response.body.items[0].systemQuantity).toBe(50);
      expect(response.body.items[0].actualQuantity).toBe(45);
    });

    it('Step 1b: Should reject stocktaking without evidence for discrepancy', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([
        { ...mockProduct, stock: 50 },
      ]);

      const response = await request(app.getHttpServer())
        .post('/stocktaking')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          items: [
            {
              productId: 'prod-1',
              actualQuantity: 45,
              // No evidenceUrl - should be rejected
            },
          ],
        })
        .expect(400);

      expect(response.body.message).toBe(
        'Yêu cầu đính kèm ảnh/file minh chứng cho các sản phẩm có sai lệch',
      );
    });

    it('Step 2: Should approve the stocktaking record (Manager)', async () => {
      const pendingRecord = {
        id: stocktakingRecordId,
        status: 'PENDING',
        createdBy: 'manager-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [
          {
            id: 'item-1',
            recordId: stocktakingRecordId,
            productId: 'prod-1',
            systemQuantity: 50,
            actualQuantity: 45,
            discrepancy: -5,
            evidenceUrl: 'https://example.com/evidence.jpg',
          },
        ],
      };

      mockPrismaService.stocktakingRecord.findUnique.mockResolvedValue(
        pendingRecord,
      );

      const approvedRecord = {
        ...pendingRecord,
        status: 'APPROVED',
        items: pendingRecord.items.map((item) => ({
          ...item,
          product: { ...mockProduct, stock: 45 },
        })),
        creator: {
          id: 'manager-1',
          name: 'Test Manager',
          email: 'manager@test.com',
          role: 'MANAGER',
        },
      };

      mockPrismaService.$transaction.mockResolvedValue([approvedRecord]);

      const response = await request(app.getHttpServer())
        .patch(`/stocktaking/${stocktakingRecordId}/approve`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.status).toBe('APPROVED');
    });

    it('Step 3: Should verify stock was updated after approval', async () => {
      // After approval, stock should be updated to actual quantity (45)
      mockPrismaService.warehouseConfig.findFirst.mockResolvedValue({
        id: 'config-1',
        maxCapacity: 1000,
      });
      mockPrismaService.product.aggregate.mockResolvedValue({
        _sum: { stock: 45 },
      });

      const response = await request(app.getHttpServer())
        .get('/inventory/capacity')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.currentTotal).toBe(45);
    });

    it('Step 4: Should reject stocktaking and keep stock unchanged', async () => {
      const pendingRecord = {
        id: 'record-2',
        status: 'PENDING',
        createdBy: 'manager-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [
          {
            id: 'item-2',
            recordId: 'record-2',
            productId: 'prod-1',
            systemQuantity: 45,
            actualQuantity: 40,
            discrepancy: -5,
            evidenceUrl: 'https://example.com/evidence2.jpg',
          },
        ],
      };

      mockPrismaService.stocktakingRecord.findUnique.mockResolvedValue(
        pendingRecord,
      );

      const rejectedRecord = {
        ...pendingRecord,
        status: 'REJECTED',
        items: pendingRecord.items.map((item) => ({
          ...item,
          product: { ...mockProduct, stock: 45 }, // Stock unchanged
        })),
        creator: {
          id: 'manager-1',
          name: 'Test Manager',
          email: 'manager@test.com',
          role: 'MANAGER',
        },
      };

      mockPrismaService.stocktakingRecord.update.mockResolvedValue(
        rejectedRecord,
      );

      const response = await request(app.getHttpServer())
        .patch('/stocktaking/record-2/reject')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.status).toBe('REJECTED');
    });
  });
});
