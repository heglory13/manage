import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('AuthService', () => {
  let authService: AuthService;
  let prismaService: {
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let jwtService: {
    signAsync: jest.Mock;
    verifyAsync: jest.Mock;
  };

  const mockUser = {
    id: 'user-1',
    email: 'admin@example.com',
    password: '', // will be set in beforeEach
    name: 'Admin',
    role: 'ADMIN' as const,
    refreshToken: null as string | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockUser.password = await bcrypt.hash('password123', 10);

    prismaService = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    jwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                JWT_SECRET: 'test-secret',
                JWT_REFRESH_SECRET: 'test-refresh-secret',
                JWT_EXPIRES_IN: '15m',
                JWT_REFRESH_EXPIRES_IN: '7d',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('validateUser', () => {
    it('should return user when credentials are valid', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.validateUser(
        'admin@example.com',
        'password123',
      );

      expect(result).toEqual(mockUser);
    });

    it('should return null when email does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const result = await authService.validateUser(
        'nonexistent@example.com',
        'password123',
      );

      expect(result).toBeNull();
    });

    it('should return null when password is incorrect', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.validateUser(
        'admin@example.com',
        'wrongpassword',
      );

      expect(result).toBeNull();
    });
  });

  describe('generateTokens', () => {
    it('should return access and refresh tokens', async () => {
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      prismaService.user.update.mockResolvedValue(mockUser);

      const result = await authService.generateTokens(mockUser);

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { refreshToken: expect.any(String) },
      });
    });
  });

  describe('refreshTokens', () => {
    it('should return new tokens when refresh token is valid', async () => {
      const refreshToken = 'valid-refresh-token';
      const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
      const userWithRefresh = {
        ...mockUser,
        refreshToken: hashedRefreshToken,
      };

      jwtService.verifyAsync.mockResolvedValue({
        userId: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
      prismaService.user.findUnique.mockResolvedValue(userWithRefresh);
      jwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');
      prismaService.user.update.mockResolvedValue(userWithRefresh);

      const result = await authService.refreshTokens(refreshToken);

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('should throw UnauthorizedException when refresh token is invalid', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      await expect(
        authService.refreshTokens('invalid-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user has no stored refresh token', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        userId: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
      prismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        refreshToken: null,
      });

      await expect(
        authService.refreshTokens('some-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('invalidateRefreshToken', () => {
    it('should set refresh token to null', async () => {
      prismaService.user.update.mockResolvedValue(mockUser);

      await authService.invalidateRefreshToken('user-1');

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { refreshToken: null },
      });
    });
  });
});
