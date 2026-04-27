import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client/index';
import { PrismaService } from '../prisma/prisma.service.js';
import type { TokenResponse } from './interfaces/index.js';
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    private readonly configService;
    constructor(prisma: PrismaService, jwtService: JwtService, configService: ConfigService);
    validateUser(email: string, password: string): Promise<User | null>;
    generateTokens(user: User): Promise<TokenResponse>;
    refreshTokens(refreshToken: string): Promise<TokenResponse>;
    invalidateRefreshToken(userId: string): Promise<void>;
}
