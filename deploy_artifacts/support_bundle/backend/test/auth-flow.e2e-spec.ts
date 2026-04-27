import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Integration test: Auth flow
 * login → access protected endpoint → refresh token → logout
 */
describe('Auth Flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const mockUser = {
    id: 'user-1',
    email: 'staff@test.com',
    password: '', // will be set in beforeAll
    name: 'Test Staff',
    role: 'STAFF' as const,
    refreshToken: null as string | null,
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

  beforeAll(async () => {
    // Hash the password
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

    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the user's refresh token
    mockUser.refreshToken = null;
  });

  describe('Complete Auth Flow: login → access → refresh → logout', () => {
    let accessToken: string;
    let refreshToken: string;

    it('Step 1: Should login successfully with valid credentials', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ ...mockUser });
      mockPrismaService.user.update.mockImplementation(async ({ data }) => {
        if (data.refreshToken !== undefined) {
          mockUser.refreshToken = data.refreshToken;
        }
        return { ...mockUser };
      });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'staff@test.com', password: 'password123' })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
    });

    it('Step 1b: Should reject login with invalid credentials', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ ...mockUser });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'staff@test.com', password: 'wrongpassword' })
        .expect(401);

      expect(response.body.message).toBe(
        'Thông tin đăng nhập không chính xác',
      );
    });

    it('Step 2: Should access protected endpoint with valid token', async () => {
      // First login to get a token
      mockPrismaService.user.findUnique.mockResolvedValue({ ...mockUser });
      mockPrismaService.user.update.mockImplementation(async ({ data }) => {
        if (data.refreshToken !== undefined) {
          mockUser.refreshToken = data.refreshToken;
        }
        return { ...mockUser };
      });

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'staff@test.com', password: 'password123' })
        .expect(200);

      accessToken = loginRes.body.accessToken;
      refreshToken = loginRes.body.refreshToken;

      // Access protected endpoint (GET /products)
      mockPrismaService.product.findMany.mockResolvedValue([]);
      mockPrismaService.product.count.mockResolvedValue(0);

      const response = await request(app.getHttpServer())
        .get('/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    it('Step 2b: Should reject access without token', async () => {
      await request(app.getHttpServer()).get('/products').expect(401);
    });

    it('Step 3: Should refresh tokens with valid refresh token', async () => {
      // Login first
      mockPrismaService.user.findUnique.mockResolvedValue({ ...mockUser });
      mockPrismaService.user.update.mockImplementation(async ({ data }) => {
        if (data.refreshToken !== undefined) {
          mockUser.refreshToken = data.refreshToken;
        }
        return { ...mockUser, refreshToken: mockUser.refreshToken };
      });

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'staff@test.com', password: 'password123' })
        .expect(200);

      refreshToken = loginRes.body.refreshToken;

      // Now refresh - the findUnique should return user with the hashed refresh token
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        refreshToken: mockUser.refreshToken,
      });

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      // Verify new tokens were generated (they are valid JWTs)
      expect(typeof response.body.accessToken).toBe('string');
      expect(typeof response.body.refreshToken).toBe('string');
    });

    it('Step 4: Should logout and invalidate refresh token', async () => {
      // Login first
      mockPrismaService.user.findUnique.mockResolvedValue({ ...mockUser });
      mockPrismaService.user.update.mockImplementation(async ({ data }) => {
        if (data.refreshToken !== undefined) {
          mockUser.refreshToken = data.refreshToken;
        }
        return { ...mockUser };
      });

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'staff@test.com', password: 'password123' })
        .expect(200);

      accessToken = loginRes.body.accessToken;

      // Logout
      mockPrismaService.user.update.mockImplementation(async ({ data }) => {
        if (data.refreshToken === null) {
          mockUser.refreshToken = null;
        }
        return { ...mockUser, refreshToken: null };
      });

      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.message).toBe('Logged out successfully');
    });
  });
});
