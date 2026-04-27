import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ActivityLogService } from './activity-log.service.js';
export declare class ActivityLogInterceptor implements NestInterceptor {
    private readonly activityLogService;
    constructor(activityLogService: ActivityLogService);
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown>;
}
