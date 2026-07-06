import { Module } from '@nestjs/common';
import { ProductController } from './product.controller.js';
import { ProductService } from './product.service.js';
import { SkuGeneratorService } from './sku-generator.service.js';

@Module({
  controllers: [ProductController],
  providers: [ProductService, SkuGeneratorService],
  exports: [ProductService, SkuGeneratorService],
})
export class ProductModule {}
