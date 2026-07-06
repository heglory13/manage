import { Module } from '@nestjs/common';
import { CategoryController } from './category.controller.js';

@Module({
  controllers: [CategoryController],
})
export class CategoryModule {}
