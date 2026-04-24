import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { UserService } from './user.service.js';
import { CreateUserDto, UpdateRoleDto } from './dto/index.js';
import { Roles } from '../auth/decorators/index.js';
import { CurrentUser } from '../auth/decorators/index.js';
import { RolesGuard } from '../auth/guards/index.js';
import type { UserPayload } from '../auth/interfaces/index.js';

@Controller('users')
@UseGuards(RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Roles(Role.ADMIN)
  async findAll() {
    return this.userService.findAll();
  }

  @Post()
  @Roles(Role.ADMIN)
  async create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Patch(':id/role')
  @Roles(Role.ADMIN)
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.userService.updateRole(id, dto.role);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async delete(
    @Param('id') id: string,
    @CurrentUser() currentUser: Record<string, unknown>,
  ) {
    const user = currentUser as unknown as UserPayload;
    await this.userService.delete(id, user.userId);
    return { message: 'User deleted successfully' };
  }
}
