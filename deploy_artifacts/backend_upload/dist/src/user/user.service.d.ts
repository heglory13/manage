import { Role, User } from '@prisma/client/index';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/index.js';
export declare class UserService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private sanitizeUser;
    create(dto: CreateUserDto): Promise<ReturnType<UserService['sanitizeUser']>>;
    updateRole(id: string, role: Role): Promise<ReturnType<UserService['sanitizeUser']>>;
    updatePermissions(id: string, permissions: Record<string, unknown>): Promise<ReturnType<UserService['sanitizeUser']>>;
    delete(id: string, currentUserId: string): Promise<void>;
    findAll(): Promise<Array<ReturnType<UserService['sanitizeUser']>>>;
    findByEmail(email: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
    getSafeById(id: string): Promise<{
        permissions: import("../auth/permissions.js").PermissionState;
        id: string;
        email: string;
        name: string;
        role: import(".prisma/client").$Enums.Role;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
}
