import { Body, Controller, ForbiddenException, Get, Put } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/index.js';
import type { UserPayload } from '../auth/interfaces/index.js';
import { hasPermission } from '../auth/permissions.js';
import { GeneralSettingsService } from './general-settings.service.js';

@Controller('general-settings')
export class GeneralSettingsController {
  constructor(
    private readonly generalSettingsService: GeneralSettingsService,
  ) {}

  @Get()
  async getSettings() {
    return this.generalSettingsService.getSettings();
  }

  @Put()
  async updateSettings(
    @Body() body: Record<string, string>,
    @CurrentUser() currentUser: Record<string, unknown>,
  ) {
    const user = currentUser as unknown as UserPayload;
    if (!hasPermission(user.permissions, 'generalSettings', 'save')) {
      throw new ForbiddenException('Ban khong co quyen luu cau hinh chung');
    }
    return this.generalSettingsService.updateSettings(body);
  }
}
