import { UserService } from './user.service.js';
import { CreateUserDto, UpdatePermissionsDto, UpdateRoleDto } from './dto/index.js';
export declare class UserController {
    private readonly userService;
    constructor(userService: UserService);
    findAll(): Promise<{
        permissions: import("../auth/permissions.js").PermissionState;
        id: string;
        email: string;
        name: string;
        role: import(".prisma/client").$Enums.Role;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    create(dto: CreateUserDto): Promise<{
        permissions: import("../auth/permissions.js").PermissionState;
        id: string;
        email: string;
        name: string;
        role: import(".prisma/client").$Enums.Role;
        createdAt: Date;
        updatedAt: Date;
    }>;
    updateRole(id: string, dto: UpdateRoleDto): Promise<{
        permissions: import("../auth/permissions.js").PermissionState;
        id: string;
        email: string;
        name: string;
        role: import(".prisma/client").$Enums.Role;
        createdAt: Date;
        updatedAt: Date;
    }>;
    updatePermissions(id: string, dto: UpdatePermissionsDto): Promise<{
        permissions: import("../auth/permissions.js").PermissionState;
        id: string;
        email: string;
        name: string;
        role: import(".prisma/client").$Enums.Role;
        createdAt: Date;
        updatedAt: Date;
    }>;
    delete(id: string, currentUser: Record<string, unknown>): Promise<{
        message: string;
    }>;
}
