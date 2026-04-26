import { ActivityLog } from '@prisma/client/index';
import { PrismaService } from '../prisma/prisma.service.js';
export interface ActivityLogCreateData {
    userId: string;
    userName: string;
    action: string;
    tableName: string;
    recordId: string;
    oldData?: Record<string, unknown> | null;
    newData?: Record<string, unknown> | null;
}
export interface ActivityLogQuery {
    userId?: string;
    action?: string;
    tableName?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
}
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
export declare class ActivityLogService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(logData: ActivityLogCreateData): Promise<ActivityLog>;
    findAll(query: ActivityLogQuery): Promise<PaginatedResponse<ActivityLog>>;
}
