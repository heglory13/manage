import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Integration test: Stock flow
 * tạo sản phẩm → nhập kho → xuất kho → kiểm tra tồn kho
 */
describe('Stock Flow (e2e)', () => {
  let app: INestApplication<App>;

  const mockUser = {
    id: 'user-1',
    email: 'staff@test.com',
    password: '',
    name: 'Test Staff',
    role: 'STAFF' as const,
    refreshToken: null as string | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCategory = {
    id: 'cat-1',
    name: 'Đồng hồ',
    code: 'DONGHO',
  };

  let currentProductStock = 0;

  const mockProduct = {
    id: 'prod-1',
    name: 'Đồng hồ Casio',
    sku: 'DONGHO-001-20240101',
    price: 500000,
    categoryId: 'cat-1',
    get stock() {
      return currentProductStock;
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    category: mockCategory,
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
    mockUser.password = await bcrypt.hash('password123', 10);

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

    // Login to get access token
    mockPrismaService.user.findUnique.mockResolvedValue({ ...mockUser });
    mockPrismaService.user.update.mockResolvedValue({ ...mockUser });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'staff@test.com', password: 'password123' });

    accessToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure user lookup works for JWT validation
    mockPrismaService.user.findUnique.mockResolvedValue({ ...mockUser });
  });

  describe('Complete Stock Flow: create product → stock in → stock out → verify', () => {
    it('Step 1: Should create a product', async () => {
      currentProductStock = 0;

      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      // SKU generator calls findMany with startsWith filter
      mockPrismaService.product.findMany.mockResolvedValue([]);
      mockPrismaService.product.findUnique.mockResolvedValue(null); // No SKU collision
      mockPrismaService.product.count.mockResolvedValue(0);
      mockPrismaService.product.create.mockResolvedValue({
        ...mockProduct,
        stock: 0,
      });

      const response = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Đồng hồ Casio',
          categoryId: 'cat-1',
          price: 500000,
        })
        .expect(201);

      expect(response.body).toHaveProperty('sku');
      expect(response.body.name).toBe('Đồng hồ Casio');
    });

    it('Step 2: Should stock in (add 50 units)', async () => {
      currentProductStock = 0;

      mockPrismaService.product.findUnique.mockResolvedValue({
        ...mockProduct,
        stock: 0,
      });

      const stockInTransaction = {
        id: 'txn-1',
        productId: 'prod-1',
        type: 'STOCK_IN',
        quantity: 50,
        userId: 'user-1',
        createdAt: new Date(),
      };

      mockPrismaService.$transaction.mockResolvedValue([
        { ...mockProduct, stock: 50 },
        stockInTransaction,
      ]);

      const response = await request(app.getHttpServer())
        .post('/inventory/stock-in')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId: 'prod-1', quantity: 50 })
        .expect(201);

      expect(response.body.type).toBe('STOCK_IN');
      expect(response.body.quantity).toBe(50);
      currentProductStock = 50;
    });

    it('Step 3: Should stock out (remove 20 units)', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue({
        ...mockProduct,
        stock: 50,
      });

      const stockOutTransaction = {
        id: 'txn-2',
        productId: 'prod-1',
        type: 'STOCK_OUT',
        quantity: 20,
        userId: 'user-1',
        createdAt: new Date(),
      };

      mockPrismaService.$transaction.mockResolvedValue([
        { ...mockProduct, stock: 30 },
        stockOutTransaction,
      ]);

      const response = await request(app.getHttpServer())
        .post('/inventory/stock-out')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId: 'prod-1', quantity: 20 })
        .expect(201);

      expect(response.body.type).toBe('STOCK_OUT');
      expect(response.body.quantity).toBe(20);
      currentProductStock = 30;
    });

    it('Step 3b: Should reject stock out exceeding current stock', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue({
        ...mockProduct,
        stock: 30,
      });

      const response = await request(app.getHttpServer())
        .post('/inventory/stock-out')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId: 'prod-1', quantity: 100 })
        .expect(400);

      expect(response.body.message).toBe(
        'Không thể xuất quá số lượng tồn kho hiện tại',
      );
    });

    it('Step 4: Should verify stock via capacity endpoint', async () => {
      mockPrismaService.warehouseConfig.findFirst.mockResolvedValue({
        id: 'config-1',
        maxCapacity: 1000,
      });
      mockPrismaService.product.aggregate.mockResolvedValue({
        _sum: { stock: 30 },
      });

      const response = await request(app.getHttpServer())
        .get('/inventory/capacity')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.currentTotal).toBe(30);
      expect(response.body.maxCapacity).toBe(1000);
      expect(response.body.ratio).toBeCloseTo(0.03);
      expect(response.body.isWarning).toBe(false);
    });

    it('Step 4b: Should reject stock in with invalid quantity', async () => {
      const response = await request(app.getHttpServer())
        .post('/inventory/stock-in')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId: 'prod-1', quantity: 0 })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });
  });
});
