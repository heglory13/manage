import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client/index';
import { Roles } from '../auth/decorators/index.js';
import { ActivityLogService } from './activity-log.service.js';
import { ActivityLogQueryDto } from './dto/index.js';

@Controller('activity-logs')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get()
  @Roles(Role.ADMIN)
  async findAll(@Query() query: ActivityLogQueryDto) {
    return this.activityLogService.findAll(query);
  }
}
