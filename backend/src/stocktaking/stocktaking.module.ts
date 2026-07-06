import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module.js';
import { StocktakingController } from './stocktaking.controller.js';
import { StocktakingService } from './stocktaking.service.js';

@Module({
  imports: [InventoryModule],
  controllers: [StocktakingController],
  providers: [StocktakingService],
  exports: [StocktakingService],
})
export class StocktakingModule {}
