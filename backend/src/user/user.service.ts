import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, User } from '@prisma/client/index';
import * as bcrypt from 'bcrypt';
import { normalizePermissions } from '../auth/permissions.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/index.js';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  private sanitizeUser(user: User) {
    const { password: _, refreshToken: __, ...result } = user;
    return {
      ...result,
      permissions: normalizePermissions(result.permissions, result.role),
    };
  }

  async create(dto: CreateUserDto): Promise<ReturnType<UserService['sanitizeUser']>> {
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        role: dto.role,
        permissions: normalizePermissions(undefined, dto.role),
      },
    });
    return this.sanitizeUser(user);
  }

  async updateRole(id: string, role: Role): Promise<ReturnType<UserService['sanitizeUser']>> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        role,
        permissions: normalizePermissions(user.permissions, role),
      },
    });
    return this.sanitizeUser(updated);
  }

  async updatePermissions(
    id: string,
    permissions: Record<string, unknown>,
  ): Promise<ReturnType<UserService['sanitizeUser']>> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        permissions: normalizePermissions(permissions, user.role),
      },
    });

    return this.sanitizeUser(updated);
  }

  async delete(id: string, currentUserId: string): Promise<void> {
    if (id === currentUserId) {
      throw new BadRequestException(
        'Admin không thể tự xóa tài khoản của chính mình',
      );
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.prisma.user.delete({ where: { id } });
  }

  async findAll(): Promise<Array<ReturnType<UserService['sanitizeUser']>>> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return users.map((user) => this.sanitizeUser(user));
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async getSafeById(id: string) {
    const user = await this.findById(id);
    return user ? this.sanitizeUser(user) : null;
  }
}
