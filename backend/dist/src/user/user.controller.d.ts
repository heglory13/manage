import { UserService } from './user.service.js';
import { CreateUserDto, UpdateRoleDto } from './dto/index.js';
export declare class UserController {
    private readonly userService;
    constructor(userService: UserService);
    findAll(): Promise<Omit<{
        id: string;
        email: string;
        password: string;
        name: string;
        role: import(".prisma/client").$Enums.Role;
        createdAt: Date;
        updatedAt: Date;
        refreshToken: string | null;
    }, "password" | "refreshToken">[]>;
    create(dto: CreateUserDto): Promise<Omit<{
        id: string;
        email: string;
        password: string;
        name: string;
        role: import(".prisma/client").$Enums.Role;
        createdAt: Date;
        updatedAt: Date;
        refreshToken: string | null;
    }, "password" | "refreshToken">>;
    updateRole(id: string, dto: UpdateRoleDto): Promise<Omit<{
        id: string;
        email: string;
        password: string;
        name: string;
        role: import(".prisma/client").$Enums.Role;
        createdAt: Date;
        updatedAt: Date;
        refreshToken: string | null;
    }, "password" | "refreshToken">>;
    delete(id: string, currentUser: Record<string, unknown>): Promise<{
        message: string;
    }>;
}
