import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import type { TokenResponse, UserPayload } from './interfaces/index.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return null;
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }
    return user;
  }

  async generateTokens(user: User): Promise<TokenResponse> {
    const payload: UserPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload } as Record<string, unknown>,
        {
          secret: this.configService.get<string>('JWT_SECRET'),
          expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') ?? '15m') as any,
        },
      ),
      this.jwtService.signAsync(
        { ...payload } as Record<string, unknown>,
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d') as any,
        },
      ),
    ]);

    // Store hashed refresh token in database
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRefreshToken },
    });

    return { accessToken, refreshToken };
  }

  async refreshTokens(refreshToken: string): Promise<TokenResponse> {
    let payload: UserPayload;
    try {
      payload = await this.jwtService.verifyAsync<UserPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Unauthorized');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Unauthorized');
    }

    const isRefreshTokenValid = await bcrypt.compare(
      refreshToken,
      user.refreshToken,
    );
    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.generateTokens(user);
  }

  async invalidateRefreshToken(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }
}
