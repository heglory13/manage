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
exports.SavedFilterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
let SavedFilterService = class SavedFilterService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(userId, pageKey) {
        return this.prisma.savedFilter.findMany({
            where: { userId, pageKey },
            orderBy: { createdAt: 'desc' },
        });
    }
    async create(userId, dto) {
        const trimmedName = dto.name?.trim();
        if (!trimmedName) {
            throw new common_1.BadRequestException('Tên bộ lọc không được để trống');
        }
        const count = await this.prisma.savedFilter.count({
            where: { userId, pageKey: dto.pageKey },
        });
        if (count >= 20) {
            throw new common_1.BadRequestException('Đã đạt giới hạn tối đa 20 bộ lọc cho trang này');
        }
        return this.prisma.savedFilter.create({
            data: {
                userId,
                pageKey: dto.pageKey,
                name: trimmedName,
                filters: dto.filters,
            },
        });
    }
    async delete(id, userId) {
        const filter = await this.prisma.savedFilter.findUnique({
            where: { id },
        });
        if (!filter) {
            throw new common_1.NotFoundException('Bộ lọc không tồn tại');
        }
        if (filter.userId !== userId) {
            throw new common_1.ForbiddenException('Bạn không có quyền xóa bộ lọc này');
        }
        await this.prisma.savedFilter.delete({ where: { id } });
    }
};
exports.SavedFilterService = SavedFilterService;
exports.SavedFilterService = SavedFilterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService])
], SavedFilterService);
//# sourceMappingURL=saved-filter.service.js.map