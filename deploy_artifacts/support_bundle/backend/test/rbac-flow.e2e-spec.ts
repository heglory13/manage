import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Integration test: RBAC flow
 * Truy cập endpoint với các vai trò khác nhau (ADMIN, MANAGER, STAFF)
 */
describe('RBAC Flow (e2e)', () => {
  let app: INestApplication<App>;

  const users = {
    admin: {
      id: 'admin-1',
      email: 'admin@test.com',
      password: '',
      name: 'Test Admin',
      role: 'ADMIN' as const,
      refreshToken: null as string | null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    manager: {
      id: 'manager-1',
      email: 'manager@test.com',
      password: '',
      name: 'Test Manager',
      role: 'MANAGER' as const,
      refreshToken: null as string | null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    staff: {
      id: 'staff-1',
      email: 'staff@test.com',
      password: '',
      name: 'Test Staff',
      role: 'STAFF' as const,
      refreshToken: null as string | null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
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
      groupBy: jest.fn(),
    },
    warehouseConfig: {
      findFirst: jest.fn(),
    },
    warehouseLayout: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    warehousePosition: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
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

  const tokens: Record<string, string> = {};

  async function loginAs(role: 'admin' | 'manager' | 'staff'): Promise<string> {
    if (tokens[role]) return tokens[role];

    const user = users[role];
    mockPrismaService.user.findUnique.mockResolvedValue({ ...user });
    mockPrismaService.user.update.mockResolvedValue({ ...user });

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: 'password123' });

    tokens[role] = res.body.accessToken;
    return tokens[role];
  }

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash('password123', 10);
    users.admin.password = hashedPassword;
    users.manager.password = hashedPassword;
    users.staff.password = hashedPassword;

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

    // Login all users
    await loginAs('admin');
    await loginAs('manager');
    await loginAs('staff');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to set up user lookup for JWT validation
  function setupUserLookup(role: 'admin' | 'manager' | 'staff') {
    mockPrismaService.user.findUnique.mockResolvedValue({ ...users[role] });
  }

  describe('Dashboard endpoints (Manager/Admin only)', () => {
    it('Admin should access dashboard summary', async () => {
      setupUserLookup('admin');
      mockPrismaService.product.count.mockResolvedValue(10);
      mockPrismaService.product.aggregate.mockResolvedValue({
        _sum: { stock: 100 },
      });
      mockPrismaService.inventoryTransaction.groupBy.mockResolvedValue([
        { type: 'STOCK_IN', _sum: { quantity: 50 } },
        { type: 'STOCK_OUT', _sum: { quantity: 20 } },
      ]);
      mockPrismaService.warehouseConfig.findFirst.mockResolvedValue({
        id: 'config-1',
        maxCapacity: 1000,
      });

      await request(app.getHttpServer())
        .get('/dashboard/summary')
        .set('Authorization', `Bearer ${tokens.admin}`)
        .expect(200);
    });

    it('Manager should access dashboard summary', async () => {
      setupUserLookup('manager');
      mockPrismaService.product.count.mockResolvedValue(10);
      mockPrismaService.product.aggregate.mockResolvedValue({
        _sum: { stock: 100 },
      });
      mockPrismaService.inventoryTransaction.groupBy.mockResolvedValue([
        { type: 'STOCK_IN', _sum: { quantity: 50 } },
        { type: 'STOCK_OUT', _sum: { quantity: 20 } },
      ]);
      mockPrismaService.warehouseConfig.findFirst.mockResolvedValue({
        id: 'config-1',
        maxCapacity: 1000,
      });

      await request(app.getHttpServer())
        .get('/dashboard/summary')
        .set('Authorization', `Bearer ${tokens.manager}`)
        .expect(200);
    });

    it('Staff should be forbidden from dashboard', async () => {
      setupUserLookup('staff');

      await request(app.getHttpServer())
        .get('/dashboard/summary')
        .set('Authorization', `Bearer ${tokens.staff}`)
        .expect(403);
    });
  });

  describe('User management endpoints (Admin only)', () => {
    it('Admin should list users', async () => {
      setupUserLookup('admin');
      mockPrismaService.user.findMany.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${tokens.admin}`)
        .expect(200);
    });

    it('Manager should be forbidden from user management', async () => {
      setupUserLookup('manager');

      await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${tokens.manager}`)
        .expect(403);
    });

    it('Staff should be forbidden from user management', async () => {
      setupUserLookup('staff');

      await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${tokens.staff}`)
        .expect(403);
    });
  });

  describe('Warehouse layout management (Admin only)', () => {
    it('Admin should create warehouse layout', async () => {
      setupUserLookup('admin');
      const layout = {
        id: 'layout-1',
        name: 'Main Warehouse',
        rows: 5,
        columns: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const layoutWithPositions = {
        ...layout,
        positions: [],
      };
      mockPrismaService.warehouseLayout.create.mockResolvedValue(layout);
      mockPrismaService.warehousePosition.createMany.mockResolvedValue({
        count: 25,
      });
      mockPrismaService.warehouseLayout.findUnique.mockResolvedValue(
        layoutWithPositions,
      );

      await request(app.getHttpServer())
        .post('/warehouse/layout')
        .set('Authorization', `Bearer ${tokens.admin}`)
        .send({ name: 'Main Warehouse', rows: 5, columns: 5 })
        .expect(201);
    });

    it('Manager should be forbidden from creating layout', async () => {
      setupUserLookup('manager');

      await request(app.getHttpServer())
        .post('/warehouse/layout')
        .set('Authorization', `Bearer ${tokens.manager}`)
        .send({ name: 'Main Warehouse', rows: 5, columns: 5 })
        .expect(403);
    });

    it('Staff should be forbidden from creating layout', async () => {
      setupUserLookup('staff');

      await request(app.getHttpServer())
        .post('/warehouse/layout')
        .set('Authorization', `Bearer ${tokens.staff}`)
        .send({ name: 'Main Warehouse', rows: 5, columns: 5 })
        .expect(403);
    });
  });

  describe('Stocktaking approval (Manager/Admin only)', () => {
    it('Manager should approve stocktaking', async () => {
      setupUserLookup('manager');

      const pendingRecord = {
        id: 'record-1',
        status: 'PENDING',
        createdBy: 'staff-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [
          {
            id: 'item-1',
            recordId: 'record-1',
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
          product: { id: 'prod-1', name: 'Test', stock: 45 },
        })),
        creator: {
          id: 'staff-1',
          name: 'Test Staff',
          email: 'staff@test.com',
          role: 'STAFF',
        },
      };

      mockPrismaService.$transaction.mockResolvedValue([approvedRecord]);

      await request(app.getHttpServer())
        .patch('/stocktaking/record-1/approve')
        .set('Authorization', `Bearer ${tokens.manager}`)
        .expect(200);
    });

    it('Staff should be forbidden from approving stocktaking', async () => {
      setupUserLookup('staff');

      await request(app.getHttpServer())
        .patch('/stocktaking/record-1/approve')
        .set('Authorization', `Bearer ${tokens.staff}`)
        .expect(403);
    });
  });

  describe('Products endpoints (all authenticated users)', () => {
    it('Staff should access products', async () => {
      setupUserLookup('staff');
      mockPrismaService.product.findMany.mockResolvedValue([]);
      mockPrismaService.product.count.mockResolvedValue(0);

      await request(app.getHttpServer())
        .get('/products')
        .set('Authorization', `Bearer ${tokens.staff}`)
        .expect(200);
    });

    it('Manager should access products', async () => {
      setupUserLookup('manager');
      mockPrismaService.product.findMany.mockResolvedValue([]);
      mockPrismaService.product.count.mockResolvedValue(0);

      await request(app.getHttpServer())
        .get('/products')
        .set('Authorization', `Bearer ${tokens.manager}`)
        .expect(200);
    });

    it('Unauthenticated user should be rejected', async () => {
      await request(app.getHttpServer()).get('/products').expect(401);
    });
  });

  describe('Report export (Manager/Admin only)', () => {
    it('Staff should be forbidden from exporting reports', async () => {
      setupUserLookup('staff');

      await request(app.getHttpServer())
        .get('/reports/export')
        .set('Authorization', `Bearer ${tokens.staff}`)
        .expect(403);
    });
  });
});
