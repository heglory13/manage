import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service.js';
import { normalizePermissions } from '../permissions.js';
import { UserPayload } from '../interfaces/index.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: UserPayload): Promise<UserPayload> {
    // Read role from DB for immediate role updates (Requirement 2.3)
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return payload;
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: normalizePermissions(user.permissions, user.role),
    };
  }
}
