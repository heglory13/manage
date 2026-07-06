import { Module } from '@nestjs/common';
import { BarcodePrintController } from './barcode-print.controller.js';
import { BarcodePrintService } from './barcode-print.service.js';

@Module({
  controllers: [BarcodePrintController],
  providers: [BarcodePrintService],
})
export class BarcodePrintModule {}
