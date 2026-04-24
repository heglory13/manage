import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/index.js';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto): Promise<Omit<User, 'password' | 'refreshToken'>> {
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        role: dto.role,
      },
    });
    const { password: _, refreshToken: __, ...result } = user;
    return result;
  }

  async updateRole(id: string, role: Role): Promise<Omit<User, 'password' | 'refreshToken'>> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { role },
    });
    const { password: _, refreshToken: __, ...result } = updated;
    return result;
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

  async findAll(): Promise<Omit<User, 'password' | 'refreshToken'>[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return users.map(({ password: _, refreshToken: __, ...rest }) => rest);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
