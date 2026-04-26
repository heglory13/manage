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
import { Role } from '@prisma/client/index';
import { UserService } from './user.service.js';
import { CreateUserDto, UpdatePermissionsDto, UpdateRoleDto } from './dto/index.js';
import { Roles } from '../auth/decorators/index.js';
import { CurrentUser } from '../auth/decorators/index.js';
import { RolesGuard } from '../auth/guards/index.js';
import type { UserPayload } from '../auth/interfaces/index.js';

@Controller('users')
@UseGuards(RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER)
  async findAll() {
    return this.userService.findAll();
  }

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  async create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Patch(':id/role')
  @Roles(Role.ADMIN, Role.MANAGER)
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.userService.updateRole(id, dto.role);
  }

  @Patch(':id/permissions')
  @Roles(Role.ADMIN, Role.MANAGER)
  async updatePermissions(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionsDto,
  ) {
    return this.userService.updatePermissions(id, dto.permissions);
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
