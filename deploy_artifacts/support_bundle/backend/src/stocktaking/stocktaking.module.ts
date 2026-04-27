import { Module } from '@nestjs/common';
import { StocktakingController } from './stocktaking.controller.js';
import { StocktakingService } from './stocktaking.service.js';

@Module({
  controllers: [StocktakingController],
  providers: [StocktakingService],
  exports: [StocktakingService],
})
export class StocktakingModule {}
