import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/index.js';
import { RolesGuard } from '../auth/guards/index.js';
import { hasPermission } from '../auth/permissions.js';
import type { UserPayload } from '../auth/interfaces/index.js';
import { InputDeclarationService } from './input-declaration.service.js';
import { SkuComboService } from './sku-combo.service.js';
import {
  CreateAttributeDto,
  CreateStorageZoneDto,
  CreateSkuComboDto,
  SkuComboQueryDto,
  UpdateStorageZoneDto,
} from './dto/index.js';

@Controller('input-declarations')
@UseGuards(RolesGuard)
export class InputDeclarationController {
  constructor(
    private readonly inputDeclarationService: InputDeclarationService,
    private readonly skuComboService: SkuComboService,
  ) {}

  private checkPermission(
    user: UserPayload,
    action: 'view' | 'create' | 'edit' | 'delete',
  ): void {
    if (!hasPermission(user.permissions, 'input', action)) {
      throw new ForbiddenException(
        `Ban khong co quyen thuc hien thao tac nay tren khai bao input`,
      );
    }
  }

  // === Bulk fetch all declarations for spreadsheet view ===
  @Get('all')
  getAllDeclarations(@CurrentUser() currentUser: Record<string, unknown>) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'view');
    return this.inputDeclarationService.getAllDeclarations();
  }

  @Get('import-template')
  async downloadImportTemplate(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Res() res: Response,
  ): Promise<void> {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'view');
    const buffer = await this.inputDeclarationService.generateImportTemplate();

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="input-declarations-template.xlsx"',
      'Content-Length': buffer.length.toString(),
    });

    res.end(buffer);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  importDeclarations(
    @CurrentUser() currentUser: Record<string, unknown>,
    @UploadedFile() file: { buffer: Buffer },
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'create');
    if (!file?.buffer) {
      throw new BadRequestException('File is required');
    }
    return this.inputDeclarationService.importDeclarationsFromExcel(
      file.buffer,
    );
  }

  // === Danh má»¥c (Category) ===
  @Get('categories')
  getCategories(@CurrentUser() currentUser: Record<string, unknown>) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'view');
    return this.inputDeclarationService.getAllCategories();
  }

  @Post('categories')
  createCategory(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Body() dto: CreateAttributeDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'create');
    return this.inputDeclarationService.createCategory(dto.name);
  }

  @Patch('categories/:id')
  updateCategory(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
    @Body() dto: CreateAttributeDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.inputDeclarationService.updateCategory(id, dto.name);
  }

  @Delete('categories/:id')
  deleteCategory(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'delete');
    return this.inputDeclarationService.deleteAttribute('category', id);
  }

  // === PhÃ¢n loáº¡i (Classification) ===
  @Get('classifications')
  getClassifications(@CurrentUser() currentUser: Record<string, unknown>) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'view');
    return this.inputDeclarationService.getAll('classification');
  }

  @Post('classifications')
  createClassification(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Body() dto: CreateAttributeDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'create');
    return this.inputDeclarationService.create('classification', dto.name);
  }

  @Patch('classifications/:id')
  updateClassification(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
    @Body() dto: CreateAttributeDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.inputDeclarationService.updateAttribute(
      'classification',
      id,
      dto.name,
    );
  }

  @Delete('classifications/:id')
  deleteClassification(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'delete');
    return this.inputDeclarationService.deleteAttribute('classification', id);
  }

  // === MÃ u sáº¯c (Color) ===
  @Get('colors')
  getColors(@CurrentUser() currentUser: Record<string, unknown>) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'view');
    return this.inputDeclarationService.getAll('color');
  }

  @Post('colors')
  createColor(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Body() dto: CreateAttributeDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'create');
    return this.inputDeclarationService.create('color', dto.name);
  }

  @Patch('colors/:id')
  updateColor(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
    @Body() dto: CreateAttributeDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.inputDeclarationService.updateAttribute('color', id, dto.name);
  }

  @Delete('colors/:id')
  deleteColor(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'delete');
    return this.inputDeclarationService.deleteAttribute('color', id);
  }

  // === Size ===
  @Get('sizes')
  getSizes(@CurrentUser() currentUser: Record<string, unknown>) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'view');
    return this.inputDeclarationService.getAll('size');
  }

  @Post('sizes')
  createSize(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Body() dto: CreateAttributeDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'create');
    return this.inputDeclarationService.create('size', dto.name);
  }

  @Patch('sizes/:id')
  updateSize(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
    @Body() dto: CreateAttributeDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.inputDeclarationService.updateAttribute('size', id, dto.name);
  }

  @Delete('sizes/:id')
  deleteSize(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'delete');
    return this.inputDeclarationService.deleteAttribute('size', id);
  }

  // === Cháº¥t liá»‡u (Material) ===
  @Get('materials')
  getMaterials(@CurrentUser() currentUser: Record<string, unknown>) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'view');
    return this.inputDeclarationService.getAll('material');
  }

  @Post('materials')
  createMaterial(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Body() dto: CreateAttributeDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'create');
    return this.inputDeclarationService.create('material', dto.name);
  }

  @Patch('materials/:id')
  updateMaterial(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
    @Body() dto: CreateAttributeDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.inputDeclarationService.updateAttribute(
      'material',
      id,
      dto.name,
    );
  }

  @Delete('materials/:id')
  deleteMaterial(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'delete');
    return this.inputDeclarationService.deleteAttribute('material', id);
  }

  // === TÃ¬nh tráº¡ng hÃ ng hoÃ¡ (ProductCondition) ===
  @Get('product-conditions')
  getProductConditions(@CurrentUser() currentUser: Record<string, unknown>) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'view');
    return this.inputDeclarationService.getAllProductConditions();
  }

  @Post('product-conditions')
  createProductCondition(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Body() dto: CreateAttributeDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'create');
    return this.inputDeclarationService.createProductCondition(dto.name);
  }

  @Patch('product-conditions/:id')
  updateProductCondition(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
    @Body() dto: CreateAttributeDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.inputDeclarationService.updateProductCondition(id, dto.name);
  }

  @Delete('product-conditions/:id')
  deleteProductCondition(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'delete');
    return this.inputDeclarationService.deleteAttribute('productCondition', id);
  }

  // === Loáº¡i kho (WarehouseType) ===
  @Get('warehouse-types')
  getWarehouseTypes(@CurrentUser() currentUser: Record<string, unknown>) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'view');
    return this.inputDeclarationService.getAllWarehouseTypes();
  }

  @Post('warehouse-types')
  createWarehouseType(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Body() dto: CreateAttributeDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'create');
    return this.inputDeclarationService.createWarehouseType(dto.name);
  }

  @Patch('warehouse-types/:id')
  updateWarehouseType(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
    @Body() dto: CreateAttributeDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.inputDeclarationService.updateWarehouseType(id, dto.name);
  }

  @Delete('warehouse-types/:id')
  deleteWarehouseType(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'delete');
    return this.inputDeclarationService.deleteAttribute('warehouseType', id);
  }

  // === Khu vá»±c hÃ ng hoÃ¡ (StorageZone) ===
  @Get('storage-zones')
  getStorageZones(@CurrentUser() currentUser: Record<string, unknown>) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'view');
    return this.inputDeclarationService.getAllStorageZones();
  }

  @Post('storage-zones')
  createStorageZone(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Body() dto: CreateStorageZoneDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'create');
    return this.inputDeclarationService.createStorageZone(
      dto.name,
      dto.maxCapacity,
      dto.warehouseTypeId,
    );
  }

  @Patch('storage-zones/:id')
  updateStorageZone(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
    @Body() dto: UpdateStorageZoneDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.inputDeclarationService.updateStorageZone(
      id,
      dto.name,
      dto.maxCapacity,
      dto.warehouseTypeId,
    );
  }

  @Delete('storage-zones/:id')
  deleteStorageZone(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'delete');
    return this.inputDeclarationService.deleteAttribute('storageZone', id);
  }

  // === SKU tá»•ng há»£p (SkuCombo) ===
  @Get('sku-combos')
  getSkuCombos(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Query() query: SkuComboQueryDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'view');
    return this.skuComboService.getAll(query);
  }

  @Post('sku-combos')
  createSkuCombo(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Body() dto: CreateSkuComboDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'create');
    return this.skuComboService.create(dto);
  }

  @Post('sku-combos/find-or-create')
  findOrCreateSkuCombo(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Body() dto: CreateSkuComboDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'create');
    return this.skuComboService.findOrCreate(dto);
  }

  @Delete('sku-combos/:id')
  deleteSkuCombo(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'delete');
    return this.skuComboService.delete(id);
  }

  @Patch('sku-combos/:id/threshold')
  updateSkuComboThreshold(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
    @Body() dto: { minThreshold: number; maxThreshold: number },
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.skuComboService.updateThreshold(
      id,
      dto.minThreshold,
      dto.maxThreshold,
    );
  }

  @Patch('sku-combos/batch-discontinue')
  batchUpdateSkuComboDiscontinued(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Body() dto: { ids: string[]; isDiscontinued: boolean },
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.skuComboService.batchUpdateDiscontinued(
      dto.ids,
      dto.isDiscontinued,
    );
  }
}
