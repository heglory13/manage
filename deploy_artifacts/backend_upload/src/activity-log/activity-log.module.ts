import { Module } from '@nestjs/common';
import { ActivityLogController } from './activity-log.controller.js';
import { ActivityLogService } from './activity-log.service.js';
import { ActivityLogInterceptor } from './activity-log.interceptor.js';

@Module({
  controllers: [ActivityLogController],
  providers: [ActivityLogService, ActivityLogInterceptor],
  exports: [ActivityLogService, ActivityLogInterceptor],
})
export class ActivityLogModule {}
