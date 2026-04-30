import { Module } from '@nestjs/common';
import { PreliminaryCheckController } from './preliminary-check.controller.js';
import { PreliminaryCheckService } from './preliminary-check.service.js';

@Module({
  controllers: [PreliminaryCheckController],
  providers: [PreliminaryCheckService],
  exports: [PreliminaryCheckService],
})
export class PreliminaryCheckModule {}
