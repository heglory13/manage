import { Module } from '@nestjs/common';
import { GeneralSettingsController } from './general-settings.controller.js';
import { GeneralSettingsService } from './general-settings.service.js';

@Module({
  controllers: [GeneralSettingsController],
  providers: [GeneralSettingsService],
  exports: [GeneralSettingsService],
})
export class GeneralSettingsModule {}
