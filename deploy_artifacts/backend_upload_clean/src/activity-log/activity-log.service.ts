import { Injectable } from '@nestjs/common';
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

@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  async create(logData: ActivityLogCreateData): Promise<ActivityLog> {
    return this.prisma.activityLog.create({
      data: {
        userId: logData.userId,
        userName: logData.userName,
        action: logData.action,
        tableName: logData.tableName,
        recordId: logData.recordId,
        oldData: logData.oldData as object ?? undefined,
        newData: logData.newData as object ?? undefined,
      },
    });
  }

  async findAll(query: ActivityLogQuery): Promise<PaginatedResponse<ActivityLog>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (query.userId) {
      where.userId = query.userId;
    }
    if (query.action) {
      where.action = query.action;
    }
    if (query.tableName) {
      where.tableName = query.tableName;
    }
    if (query.startDate || query.endDate) {
      const createdAt: Record<string, Date> = {};
      if (query.startDate) {
        createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        createdAt.lte = new Date(query.endDate);
      }
      where.createdAt = createdAt;
    }

    const [data, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
