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
import { ProductService } from './product.service.js';
import {
  BatchProductDiscontinueDto,
  CreateProductDto,
  ProductQueryDto,
  UpdateMaxThresholdDto,
  UpdateProductDto,
  UpdateThresholdDto,
} from './dto/index.js';

@Controller('products')
@UseGuards(RolesGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  private checkPermission(
    user: UserPayload,
    action: 'view' | 'create' | 'edit' | 'delete',
  ) {
    if (!hasPermission(user.permissions, 'input', action)) {
      throw new ForbiddenException(
        `Ban khong co quyen thuc hien thao tac nay tren san pham`,
      );
    }
  }

  @Post()
  async create(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Body() dto: CreateProductDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'create');
    return this.productService.create(dto);
  }

  @Get()
  async findAll(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Query() query: ProductQueryDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'view');
    return this.productService.findAll(query);
  }

  @Patch(':id')
  async update(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.productService.update(id, dto);
  }

  @Patch(':id/threshold')
  async updateThreshold(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
    @Body() dto: UpdateThresholdDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.productService.updateThreshold(id, dto.minThreshold);
  }

  @Patch('batch/discontinue')
  async updateDiscontinuedBatch(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Body() dto: BatchProductDiscontinueDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.productService.updateDiscontinuedByCategoryIds(
      dto.categoryIds,
      dto.isDiscontinued,
    );
  }

  @Patch(':id/discontinue')
  async toggleDiscontinued(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.productService.toggleDiscontinued(id);
  }

  @Patch(':id/max-threshold')
  async updateMaxThreshold(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
    @Body() dto: UpdateMaxThresholdDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.productService.updateMaxThreshold(id, dto.maxThreshold);
  }

  @Delete(':id')
  async delete(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'delete');
    await this.productService.delete(id);
    return { message: 'Product deleted successfully' };
  }
}
