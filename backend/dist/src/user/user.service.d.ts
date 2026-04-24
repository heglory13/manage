import { Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/index.js';
export declare class UserService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(dto: CreateUserDto): Promise<Omit<User, 'password' | 'refreshToken'>>;
    updateRole(id: string, role: Role): Promise<Omit<User, 'password' | 'refreshToken'>>;
    delete(id: string, currentUserId: string): Promise<void>;
    findAll(): Promise<Omit<User, 'password' | 'refreshToken'>[]>;
    findByEmail(email: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
}
