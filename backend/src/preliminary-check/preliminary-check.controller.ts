import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/index.js';
import { RolesGuard } from '../auth/guards/index.js';
import { hasPermission } from '../auth/permissions.js';
import type { UserPayload } from '../auth/interfaces/index.js';
import { PreliminaryCheckService } from './preliminary-check.service.js';
import {
  CreatePreliminaryCheckDto,
  PreliminaryCheckQueryDto,
  CompletePreliminaryCheckDto,
  UpdatePreliminaryCheckDto,
} from './dto/index.js';

@Controller('preliminary-checks')
@UseGuards(RolesGuard)
export class PreliminaryCheckController {
  constructor(
    private readonly preliminaryCheckService: PreliminaryCheckService,
  ) {}

  private checkPermission(
    user: UserPayload,
    action: 'view' | 'create' | 'edit' | 'delete',
  ) {
    if (!hasPermission(user.permissions, 'preliminaryChecks', action)) {
      throw new ForbiddenException(
        `Ban khong co quyen thuc hien thao tac nay tren phien kiem so bo`,
      );
    }
  }

  @Post()
  async create(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Body() dto: CreatePreliminaryCheckDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'create');
    return this.preliminaryCheckService.create(dto, user.userId);
  }

  @Get()
  async findAll(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Query() query: PreliminaryCheckQueryDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'view');
    return this.preliminaryCheckService.findAll({
      status: query.status || undefined,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'view');
    return this.preliminaryCheckService.findOne(id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
    @Body() dto: UpdatePreliminaryCheckDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.preliminaryCheckService.update(id, dto, user.role);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'delete');
    return this.preliminaryCheckService.remove(id, user.role);
  }

  @Patch(':id/complete')
  async complete(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
    @Body() dto: CompletePreliminaryCheckDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.preliminaryCheckService.complete(id, dto.status, user.role);
  }
}
