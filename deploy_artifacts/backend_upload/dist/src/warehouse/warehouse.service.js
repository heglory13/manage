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
exports.WarehouseService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
let WarehouseService = class WarehouseService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    buildGridPosition(row, column) {
        return {
            x: column * 110,
            y: row * 90,
            width: 100,
            height: 80,
        };
    }
    async createLayout(dto) {
        const layoutMode = dto.layoutMode ?? 'GRID';
        const layout = await this.prisma.warehouseLayout.create({
            data: {
                name: dto.name,
                rows: dto.rows,
                columns: dto.columns,
                layoutMode,
            },
        });
        const positions = [];
        if (layoutMode === 'GRID') {
            for (let r = 0; r < dto.rows; r++) {
                for (let c = 0; c < dto.columns; c++) {
                    const rowLabel = String.fromCharCode(65 + r);
                    const colLabel = (c + 1).toString();
                    positions.push({
                        layoutId: layout.id,
                        row: r,
                        column: c,
                        label: `${rowLabel}${colLabel}`,
                        ...this.buildGridPosition(r, c),
                    });
                }
            }
        }
        if (positions.length > 0) {
            await this.prisma.warehousePosition.createMany({ data: positions });
        }
        return this.prisma.warehouseLayout.findUnique({
            where: { id: layout.id },
            include: {
                positions: {
                    include: { product: true },
                    orderBy: [{ row: 'asc' }, { column: 'asc' }],
                },
            },
        });
    }
    async updateLayout(id, dto) {
        const existing = await this.prisma.warehouseLayout.findUnique({
            where: { id },
        });
        if (!existing) {
            throw new common_1.NotFoundException('Layout không tồn tại');
        }
        const newRows = dto.rows ?? existing.rows;
        const newColumns = dto.columns ?? existing.columns;
        const layout = await this.prisma.warehouseLayout.update({
            where: { id },
            data: {
                name: dto.name ?? existing.name,
                rows: newRows,
                columns: newColumns,
            },
        });
        if ((dto.rows !== undefined && dto.rows !== existing.rows) ||
            (dto.columns !== undefined && dto.columns !== existing.columns)) {
            await this.prisma.warehousePosition.deleteMany({
                where: { layoutId: id },
            });
            const positions = [];
            for (let r = 0; r < newRows; r++) {
                for (let c = 0; c < newColumns; c++) {
                    const rowLabel = String.fromCharCode(65 + r);
                    const colLabel = (c + 1).toString();
                    positions.push({
                        layoutId: id,
                        row: r,
                        column: c,
                        label: `${rowLabel}${colLabel}`,
                        ...this.buildGridPosition(r, c),
                    });
                }
            }
            await this.prisma.warehousePosition.createMany({ data: positions });
        }
        return this.prisma.warehouseLayout.findUnique({
            where: { id: layout.id },
            include: {
                positions: {
                    include: { product: true },
                    orderBy: [{ row: 'asc' }, { column: 'asc' }],
                },
            },
        });
    }
    async deleteLayout(id) {
        const existing = await this.prisma.warehouseLayout.findUnique({
            where: { id },
        });
        if (!existing) {
            throw new common_1.NotFoundException('Layout không tồn tại');
        }
        await this.prisma.warehouseLayout.delete({ where: { id } });
    }
    async updateLayoutMode(id, mode, canvasWidth, canvasHeight) {
        const layout = await this.prisma.warehouseLayout.findUnique({ where: { id } });
        if (!layout) {
            throw new common_1.NotFoundException('Layout không tồn tại');
        }
        const updated = await this.prisma.warehouseLayout.update({
            where: { id },
            data: {
                layoutMode: mode,
                canvasWidth: canvasWidth ?? layout.canvasWidth,
                canvasHeight: canvasHeight ?? layout.canvasHeight,
            },
            include: {
                positions: {
                    include: { product: true },
                    orderBy: [{ row: 'asc' }, { column: 'asc' }],
                },
            },
        });
        return updated;
    }
    async getLayout() {
        const layout = await this.prisma.warehouseLayout.findFirst({
            include: {
                positions: {
                    include: { product: true },
                    orderBy: [{ row: 'asc' }, { column: 'asc' }],
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return layout;
    }
    async assignProductToPosition(positionId, productId) {
        const position = await this.prisma.warehousePosition.findUnique({
            where: { id: positionId },
        });
        if (!position) {
            throw new common_1.BadRequestException('Vị trí không hợp lệ trong sơ đồ kho');
        }
        if (productId) {
            const product = await this.prisma.product.findUnique({
                where: { id: productId },
            });
            if (!product) {
                throw new common_1.NotFoundException('Sản phẩm không tồn tại');
            }
        }
        return this.prisma.warehousePosition.update({
            where: { id: positionId },
            data: { productId: productId ?? null },
            include: { product: true },
        });
    }
    async validatePosition(positionId) {
        const position = await this.prisma.warehousePosition.findUnique({
            where: { id: positionId },
        });
        return !!position;
    }
    async movePosition(id, targetRow, targetCol) {
        const position = await this.prisma.warehousePosition.findUnique({
            where: { id },
        });
        if (!position) {
            throw new common_1.NotFoundException('Vị trí không tồn tại');
        }
        const targetPosition = await this.prisma.warehousePosition.findFirst({
            where: {
                layoutId: position.layoutId,
                row: targetRow,
                column: targetCol,
            },
        });
        if (targetPosition) {
            const [updatedA, updatedB] = await this.prisma.$transaction([
                this.prisma.warehousePosition.update({
                    where: { id: position.id },
                    data: { row: targetRow, column: targetCol },
                    include: { product: true },
                }),
                this.prisma.warehousePosition.update({
                    where: { id: targetPosition.id },
                    data: { row: position.row, column: position.column },
                    include: { product: true },
                }),
            ]);
            return [updatedA, updatedB];
        }
        else {
            const updated = await this.prisma.warehousePosition.update({
                where: { id },
                data: { row: targetRow, column: targetCol },
                include: { product: true },
            });
            return [updated];
        }
    }
    async updateLabel(id, label) {
        const position = await this.prisma.warehousePosition.findUnique({
            where: { id },
        });
        if (!position) {
            throw new common_1.NotFoundException('Vị trí không tồn tại');
        }
        const duplicate = await this.prisma.warehousePosition.findFirst({
            where: {
                layoutId: position.layoutId,
                label: label,
                id: { not: id },
            },
        });
        if (duplicate) {
            throw new common_1.BadRequestException('Nhãn vị trí đã tồn tại trong sơ đồ kho');
        }
        return this.prisma.warehousePosition.update({
            where: { id },
            data: { label },
            include: { product: true },
        });
    }
    async toggleActive(id) {
        const position = await this.prisma.warehousePosition.findUnique({
            where: { id },
        });
        if (!position) {
            throw new common_1.NotFoundException('Vị trí không tồn tại');
        }
        if (position.isActive) {
            if (position.currentStock > 0 || position.productId) {
                throw new common_1.BadRequestException('Vị trí này đang chứa hàng hóa, vui lòng di chuyển hàng trước khi vô hiệu hóa');
            }
        }
        return this.prisma.warehousePosition.update({
            where: { id },
            data: { isActive: !position.isActive },
            include: { product: true },
        });
    }
    async updateCapacity(id, maxCapacity) {
        const position = await this.prisma.warehousePosition.findUnique({
            where: { id },
        });
        if (!position) {
            throw new common_1.NotFoundException('Vị trí không tồn tại');
        }
        if (maxCapacity <= 0) {
            throw new common_1.BadRequestException('Sức chứa tối đa phải lớn hơn 0');
        }
        return this.prisma.warehousePosition.update({
            where: { id },
            data: { maxCapacity },
            include: { product: true },
        });
    }
    async updatePositionLayout(id, dto) {
        const position = await this.prisma.warehousePosition.findUnique({
            where: { id },
            include: { layout: true },
        });
        if (!position) {
            throw new common_1.NotFoundException('Vị trí không tồn tại');
        }
        const nextData = {
            x: dto.x ?? position.x,
            y: dto.y ?? position.y,
            width: dto.width ?? position.width,
            height: dto.height ?? position.height,
        };
        if (position.layout.layoutMode === 'GRID' && (dto.x !== undefined || dto.y !== undefined)) {
            throw new common_1.ForbiddenException('Layout dạng GRID không cho phép kéo thả tự do');
        }
        return this.prisma.warehousePosition.update({
            where: { id },
            data: nextData,
            include: { product: true },
        });
    }
    async createPosition(dto) {
        const layout = await this.prisma.warehouseLayout.findUnique({
            where: { id: dto.layoutId },
        });
        if (!layout) {
            throw new common_1.NotFoundException('Layout không tồn tại');
        }
        let row = dto.y !== undefined ? Math.floor(dto.y / 90) : 0;
        let column = dto.x !== undefined ? Math.floor(dto.x / 110) : 0;
        const existing = await this.prisma.warehousePosition.count({
            where: { layoutId: dto.layoutId },
        });
        const position = await this.prisma.warehousePosition.create({
            data: {
                layoutId: dto.layoutId,
                row,
                column,
                x: dto.x ?? 0,
                y: dto.y ?? 0,
                width: dto.width ?? 100,
                height: dto.height ?? 80,
                label: dto.label ?? `P${existing + 1}`,
            },
        });
        return position;
    }
    async deletePosition(id, force) {
        const position = await this.prisma.warehousePosition.findUnique({
            where: { id },
        });
        if (!position) {
            throw new common_1.NotFoundException('Vị trí không tồn tại');
        }
        if (!force && (position.currentStock > 0 || position.productId)) {
            throw new common_1.BadRequestException('Vị trí đang chứa hàng hóa. Dùng force=true để xóa bất chấp.');
        }
        await this.prisma.warehousePosition.delete({ where: { id } });
        return { success: true };
    }
    async getPositionSkus(id) {
        const position = await this.prisma.warehousePosition.findUnique({
            where: { id },
        });
        if (!position) {
            throw new common_1.NotFoundException('Vị trí không tồn tại');
        }
        const transactions = await this.prisma.inventoryTransaction.findMany({
            where: { warehousePositionId: id },
            include: {
                skuCombo: true,
            },
        });
        const skuMap = new Map();
        for (const txn of transactions) {
            if (!txn.skuComboId || !txn.skuCombo)
                continue;
            const key = txn.skuComboId;
            const existing = skuMap.get(key);
            const delta = txn.type === 'STOCK_IN' ? txn.quantity : -txn.quantity;
            if (existing) {
                existing.quantity += delta;
            }
            else {
                skuMap.set(key, {
                    skuComboId: txn.skuComboId,
                    compositeSku: txn.skuCombo.compositeSku,
                    quantity: delta,
                });
            }
        }
        return Array.from(skuMap.values()).filter((s) => s.quantity > 0);
    }
    async getLayoutWithSkus() {
        const layouts = await this.prisma.warehouseLayout.findMany({
            include: {
                positions: {
                    include: {
                        product: true,
                        inventoryTransactions: {
                            include: { skuCombo: true },
                        },
                    },
                    orderBy: [{ row: 'asc' }, { column: 'asc' }],
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        if (layouts.length === 0)
            return [];
        return layouts.map((layout) => {
            const positions = layout.positions.map((pos) => {
                const skuMap = new Map();
                for (const txn of pos.inventoryTransactions) {
                    if (!txn.skuComboId || !txn.skuCombo)
                        continue;
                    const key = txn.skuComboId;
                    const existing = skuMap.get(key);
                    const delta = txn.type === 'STOCK_IN' ? txn.quantity : -txn.quantity;
                    if (existing) {
                        existing.quantity += delta;
                    }
                    else {
                        skuMap.set(key, {
                            compositeSku: txn.skuCombo.compositeSku,
                            quantity: delta,
                        });
                    }
                }
                const skus = Array.from(skuMap.values()).filter((s) => s.quantity > 0);
                const { inventoryTransactions, ...posData } = pos;
                return { ...posData, skus };
            });
            return { ...layout, positions };
        });
    }
    async getSingleLayoutWithSkus() {
        const layouts = await this.getLayoutWithSkus();
        return layouts[0] ?? null;
    }
};
exports.WarehouseService = WarehouseService;
exports.WarehouseService = WarehouseService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService])
], WarehouseService);
//# sourceMappingURL=warehouse.service.js.map