import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module.js';
import { InputDeclarationModule } from '../input-declaration/input-declaration.module.js';
import { ReportController } from './report.controller.js';
import { ReportService } from './report.service.js';

@Module({
  imports: [InventoryModule, InputDeclarationModule],
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule {}
