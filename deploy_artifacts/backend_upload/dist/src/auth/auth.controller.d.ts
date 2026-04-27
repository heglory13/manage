import { AuthService } from './auth.service.js';
import { LoginDto, RefreshTokenDto } from './dto/index.js';
import type { TokenResponse } from './interfaces/index.js';
import { UserService } from '../user/user.service.js';
export declare class AuthController {
    private readonly authService;
    private readonly userService;
    constructor(authService: AuthService, userService: UserService);
    login(dto: LoginDto): Promise<TokenResponse>;
    refresh(dto: RefreshTokenDto): Promise<TokenResponse>;
    logout(user: Record<string, unknown>): Promise<{
        message: string;
    }>;
    me(user: Record<string, unknown>): Promise<{
        permissions: import("./permissions.js").PermissionState;
        id: string;
        email: string;
        name: string;
        role: import(".prisma/client").$Enums.Role;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
}
