import { AuthService } from './auth.service.js';
import { LoginDto, RefreshTokenDto } from './dto/index.js';
import type { TokenResponse } from './interfaces/index.js';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(dto: LoginDto): Promise<TokenResponse>;
    refresh(dto: RefreshTokenDto): Promise<TokenResponse>;
    logout(user: Record<string, unknown>): Promise<{
        message: string;
    }>;
}
