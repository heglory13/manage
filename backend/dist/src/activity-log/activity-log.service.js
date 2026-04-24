"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityLogService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
let ActivityLogService = class ActivityLogService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(logData) {
        return this.prisma.activityLog.create({
            data: {
                userId: logData.userId,
                userName: logData.userName,
                action: logData.action,
                tableName: logData.tableName,
                recordId: logData.recordId,
                oldData: logData.oldData ?? undefined,
                newData: logData.newData ?? undefined,
            },
        });
    }
    async findAll(query) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;
        const where = {};
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
            const createdAt = {};
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
};
exports.ActivityLogService = ActivityLogService;
exports.ActivityLogService = ActivityLogService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService])
], ActivityLogService);
//# sourceMappingURL=activity-log.service.js.map