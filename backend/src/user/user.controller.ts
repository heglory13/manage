import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client/index';
import { UserService } from './user.service.js';
import {
  ChangePasswordDto,
  CreateUserDto,
  UpdatePermissionsDto,
  UpdateRoleDto,
} from './dto/index.js';
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

  // Admin: tạo mọi vai trò. Manager: chỉ tạo STAFF.
  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() currentUser: Record<string, unknown>,
  ) {
    const user = currentUser as unknown as UserPayload;
    if (user.role === Role.MANAGER && dto.role !== Role.STAFF) {
      throw new ForbiddenException(
        'Quản lý chỉ được phép tạo tài khoản Nhân viên',
      );
    }
    return this.userService.create(dto);
  }

  // Admin: đổi mọi vai trò. Manager: chỉ đổi vai trò của STAFF và chỉ về STAFF.
  @Patch(':id/role')
  @Roles(Role.ADMIN, Role.MANAGER)
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() currentUser: Record<string, unknown>,
  ) {
    const user = currentUser as unknown as UserPayload;
    if (user.role === Role.MANAGER) {
      const targetUser = await this.userService.findById(id);
      if (!targetUser) throw new NotFoundException('Người dùng không tồn tại');
      if (targetUser.role !== Role.STAFF) {
        throw new ForbiddenException(
          'Quản lý chỉ được phép thay đổi vai trò của Nhân viên',
        );
      }
      if (dto.role !== Role.STAFF) {
        throw new ForbiddenException(
          'Quản lý chỉ được phép gán vai trò Nhân viên',
        );
      }
    }
    return this.userService.updateRole(id, dto.role);
  }

  // Admin: set mọi quyền cho Manager và Staff.
  // Manager: chỉ set quyền cho Staff, không được set quyền Xoá.
  // Staff: không được gọi endpoint này (blocked bởi @Roles).
  @Patch(':id/permissions')
  @Roles(Role.ADMIN, Role.MANAGER)
  async updatePermissions(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionsDto,
    @CurrentUser() currentUser: Record<string, unknown>,
  ) {
    const user = currentUser as unknown as UserPayload;

    if (user.role === Role.MANAGER) {
      const targetUser = await this.userService.findById(id);
      if (!targetUser) throw new NotFoundException('Người dùng không tồn tại');
      if (targetUser.role === Role.ADMIN) {
        throw new ForbiddenException(
          'Quản lý không được phép thay đổi quyền của Quản trị viên',
        );
      }
      if (targetUser.role === Role.MANAGER) {
        throw new ForbiddenException(
          'Quản lý không được phép thay đổi quyền của Quản lý khác',
        );
      }

      // Manager không được set quyền Xoá cho Nhân viên — strip delete khỏi toàn bộ module
      const sanitized: Record<string, unknown> = {};
      for (const [moduleKey, flags] of Object.entries(dto.permissions ?? {})) {
        if (flags && typeof flags === 'object') {
          const { delete: _removed, ...rest } = flags as Record<
            string,
            unknown
          >;
          sanitized[moduleKey] = rest;
        } else {
          sanitized[moduleKey] = flags;
        }
      }
      return this.userService.updatePermissions(id, sanitized);
    }

    return this.userService.updatePermissions(id, dto.permissions);
  }

  // Chỉ Admin mới được đổi mật khẩu cho user khác
  @Patch(':id/password')
  @Roles(Role.ADMIN)
  async changePassword(
    @Param('id') id: string,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.userService.changePassword(id, dto.newPassword);
    return { message: 'Đổi mật khẩu thành công' };
  }

  // Admin và Manager có thể xoá người dùng; Manager chỉ xoá được STAFF
  @Delete(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  async delete(
    @Param('id') id: string,
    @CurrentUser() currentUser: Record<string, unknown>,
  ) {
    const user = currentUser as unknown as UserPayload;
    await this.userService.delete(id, user.userId, user.role);
    return { message: 'Xoá tài khoản thành công' };
  }
}
