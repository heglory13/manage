import { Module } from '@nestjs/common';
import { InputDeclarationController } from './input-declaration.controller.js';
import { InputDeclarationService } from './input-declaration.service.js';
import { SkuComboService } from './sku-combo.service.js';

@Module({
  controllers: [InputDeclarationController],
  providers: [InputDeclarationService, SkuComboService],
  exports: [InputDeclarationService, SkuComboService],
})
export class InputDeclarationModule {}
