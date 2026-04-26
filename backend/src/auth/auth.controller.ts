import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LoginDto, RefreshTokenDto } from './dto/index.js';
import type { TokenResponse, UserPayload } from './interfaces/index.js';
import { CurrentUser, Public } from './decorators/index.js';
import { JwtAuthGuard } from './guards/index.js';
import { UserService } from '../user/user.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<TokenResponse> {
    const user = await this.authService.validateUser(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException(
        'Thông tin đăng nhập không chính xác',
      );
    }
    return this.authService.generateTokens(user);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto): Promise<TokenResponse> {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: Record<string, unknown>): Promise<{ message: string }> {
    const payload = user as unknown as UserPayload;
    await this.authService.invalidateRefreshToken(payload.userId);
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('me')
  @HttpCode(HttpStatus.OK)
  async me(@CurrentUser() user: Record<string, unknown>) {
    const payload = user as unknown as UserPayload;
    return this.userService.getSafeById(payload.userId);
  }
}
