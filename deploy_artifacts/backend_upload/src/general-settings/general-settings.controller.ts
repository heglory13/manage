import { Body, Controller, Get, Put } from '@nestjs/common';
import { Role } from '@prisma/client/index';
import { Roles } from '../auth/decorators/index.js';
import { GeneralSettingsService } from './general-settings.service.js';

@Controller('general-settings')
export class GeneralSettingsController {
  constructor(private readonly generalSettingsService: GeneralSettingsService) {}

  @Get()
  async getSettings() {
    return this.generalSettingsService.getSettings();
  }

  @Put()
  @Roles(Role.ADMIN)
  async updateSettings(@Body() body: Record<string, string>) {
    return this.generalSettingsService.updateSettings(body);
  }
}
