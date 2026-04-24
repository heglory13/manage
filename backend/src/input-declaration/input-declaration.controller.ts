import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { InputDeclarationService } from './input-declaration.service.js';
import { SkuComboService } from './sku-combo.service.js';
import {
  CreateAttributeDto,
  CreateStorageZoneDto,
  CreateSkuComboDto,
  SkuComboQueryDto,
} from './dto/index.js';

@Controller('input-declarations')
export class InputDeclarationController {
  constructor(
    private readonly inputDeclarationService: InputDeclarationService,
    private readonly skuComboService: SkuComboService,
  ) {}

  // === Bulk fetch all declarations for spreadsheet view ===
  @Get('all')
  getAllDeclarations() {
    return this.inputDeclarationService.getAllDeclarations();
  }

  // === Danh mục (Category) ===
  @Get('categories')
  getCategories() {
    return this.inputDeclarationService.getAllCategories();
  }

  @Post('categories')
  createCategory(@Body() dto: CreateAttributeDto) {
    return this.inputDeclarationService.createCategory(dto.name);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.inputDeclarationService.deleteAttribute('category', id);
  }

  // === Phân loại (Classification) ===
  @Get('classifications')
  getClassifications() {
    return this.inputDeclarationService.getAll('classification');
  }

  @Post('classifications')
  createClassification(@Body() dto: CreateAttributeDto) {
    return this.inputDeclarationService.create('classification', dto.name);
  }

  @Delete('classifications/:id')
  deleteClassification(@Param('id') id: string) {
    return this.inputDeclarationService.deleteAttribute('classification', id);
  }

  // === Màu sắc (Color) ===
  @Get('colors')
  getColors() {
    return this.inputDeclarationService.getAll('color');
  }

  @Post('colors')
  createColor(@Body() dto: CreateAttributeDto) {
    return this.inputDeclarationService.create('color', dto.name);
  }

  @Delete('colors/:id')
  deleteColor(@Param('id') id: string) {
    return this.inputDeclarationService.deleteAttribute('color', id);
  }

  // === Size ===
  @Get('sizes')
  getSizes() {
    return this.inputDeclarationService.getAll('size');
  }

  @Post('sizes')
  createSize(@Body() dto: CreateAttributeDto) {
    return this.inputDeclarationService.create('size', dto.name);
  }

  @Delete('sizes/:id')
  deleteSize(@Param('id') id: string) {
    return this.inputDeclarationService.deleteAttribute('size', id);
  }

  // === Chất liệu (Material) ===
  @Get('materials')
  getMaterials() {
    return this.inputDeclarationService.getAll('material');
  }

  @Post('materials')
  createMaterial(@Body() dto: CreateAttributeDto) {
    return this.inputDeclarationService.create('material', dto.name);
  }

  @Delete('materials/:id')
  deleteMaterial(@Param('id') id: string) {
    return this.inputDeclarationService.deleteAttribute('material', id);
  }

  // === Tình trạng hàng hoá (ProductCondition) ===
  @Get('product-conditions')
  getProductConditions() {
    return this.inputDeclarationService.getAllProductConditions();
  }

  @Post('product-conditions')
  createProductCondition(@Body() dto: CreateAttributeDto) {
    return this.inputDeclarationService.createProductCondition(dto.name);
  }

  @Delete('product-conditions/:id')
  deleteProductCondition(@Param('id') id: string) {
    return this.inputDeclarationService.deleteAttribute('productCondition', id);
  }

  // === Loại kho (WarehouseType) ===
  @Get('warehouse-types')
  getWarehouseTypes() {
    return this.inputDeclarationService.getAllWarehouseTypes();
  }

  @Post('warehouse-types')
  createWarehouseType(@Body() dto: CreateAttributeDto) {
    return this.inputDeclarationService.createWarehouseType(dto.name);
  }

  @Delete('warehouse-types/:id')
  deleteWarehouseType(@Param('id') id: string) {
    return this.inputDeclarationService.deleteAttribute('warehouseType', id);
  }

  // === Khu vực hàng hoá (StorageZone) ===
  @Get('storage-zones')
  getStorageZones() {
    return this.inputDeclarationService.getAllStorageZones();
  }

  @Post('storage-zones')
  createStorageZone(@Body() dto: CreateStorageZoneDto) {
    return this.inputDeclarationService.createStorageZone(
      dto.name,
      dto.maxCapacity,
    );
  }

  @Delete('storage-zones/:id')
  deleteStorageZone(@Param('id') id: string) {
    return this.inputDeclarationService.deleteAttribute('storageZone', id);
  }

  // === SKU tổng hợp (SkuCombo) ===
  @Get('sku-combos')
  getSkuCombos(@Query() query: SkuComboQueryDto) {
    return this.skuComboService.getAll(query);
  }

  @Post('sku-combos')
  createSkuCombo(@Body() dto: CreateSkuComboDto) {
    return this.skuComboService.create(dto);
  }

  @Delete('sku-combos/:id')
  deleteSkuCombo(@Param('id') id: string) {
    return this.skuComboService.delete(id);
  }
}
