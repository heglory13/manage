import { ActivityLogService } from './activity-log.service.js';
import { ActivityLogQueryDto } from './dto/index.js';
export declare class ActivityLogController {
    private readonly activityLogService;
    constructor(activityLogService: ActivityLogService);
    findAll(query: ActivityLogQueryDto): Promise<import("./activity-log.service.js").PaginatedResponse<{
        id: string;
        createdAt: Date;
        userId: string;
        recordId: string;
        userName: string;
        action: string;
        tableName: string;
        oldData: import("@prisma/client/runtime/library").JsonValue | null;
        newData: import("@prisma/client/runtime/library").JsonValue | null;
    }>>;
}
