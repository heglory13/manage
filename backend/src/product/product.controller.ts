import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductService } from './product.service.js';
import { CreateProductDto, UpdateProductDto, ProductQueryDto, UpdateThresholdDto, UpdateMaxThresholdDto } from './dto/index.js';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  async create(@Body() dto: CreateProductDto) {
    return this.productService.create(dto);
  }

  @Get()
  async findAll(@Query() query: ProductQueryDto) {
    return this.productService.findAll(query);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productService.update(id, dto);
  }

  @Patch(':id/threshold')
  async updateThreshold(
    @Param('id') id: string,
    @Body() dto: UpdateThresholdDto,
  ) {
    return this.productService.updateThreshold(id, dto.minThreshold);
  }

  @Patch(':id/discontinue')
  async toggleDiscontinued(@Param('id') id: string) {
    return this.productService.toggleDiscontinued(id);
  }

  @Patch(':id/max-threshold')
  async updateMaxThreshold(
    @Param('id') id: string,
    @Body() dto: UpdateMaxThresholdDto,
  ) {
    return this.productService.updateMaxThreshold(id, dto.maxThreshold);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.productService.delete(id);
    return { message: 'Product deleted successfully' };
  }
}
