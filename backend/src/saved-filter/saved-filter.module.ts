import { Module } from '@nestjs/common';
import { SavedFilterController } from './saved-filter.controller.js';
import { SavedFilterService } from './saved-filter.service.js';

@Module({
  controllers: [SavedFilterController],
  providers: [SavedFilterService],
})
export class SavedFilterModule {}
