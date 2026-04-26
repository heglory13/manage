"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportService = void 0;
exports.computeNxtReport = computeNxtReport;
const common_1 = require("@nestjs/common");
const index_1 = require("@prisma/client/index");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
const ExcelJS = __importStar(require("exceljs"));
const inventory_valuation_util_js_1 = require("../inventory/inventory-valuation.util.js");
function computeNxtReport(skuCombos, transactionsBefore, transactionsInPeriod) {
    const skuComboMap = new Map(skuCombos.map((combo) => [combo.id, combo]));
    const syntheticDateBefore = new Date('2000-01-01T00:00:00.000Z');
    const syntheticDateInPeriod = new Date('2000-01-02T00:00:00.000Z');
    const rows = [...transactionsBefore, ...transactionsInPeriod]
        .filter((transaction) => Boolean(transaction.skuComboId))
        .map((transaction) => {
        const combo = skuComboMap.get(transaction.skuComboId);
        return {
            id: `${transaction.skuComboId}-${transaction.type}-${transaction.quantity}-${transaction === transactionsBefore[0] ? 'before' : 'period'}`,
            productId: transaction.skuComboId,
            productName: combo?.compositeSku ?? transaction.skuComboId,
            productSku: combo?.compositeSku ?? transaction.skuComboId,
            skuComboId: transaction.skuComboId,
            compositeSku: combo?.compositeSku ?? transaction.skuComboId,
            classification: combo?.classification?.name ?? '-',
            color: combo?.color?.name ?? '-',
            size: combo?.size?.name ?? '-',
            material: combo?.material?.name ?? '-',
            type: transaction.type,
            quantity: transaction.quantity,
            purchasePrice: transaction.purchasePrice ?? 0,
            createdAt: transactionsBefore.includes(transaction)
                ? syntheticDateBefore
                : syntheticDateInPeriod,
            status: index_1.InventoryTransactionStatus.ACTIVE,
        };
    });
    return (0, inventory_valuation_util_js_1.buildInventoryValuationBuckets)(rows, new Date('2000-01-02T00:00:00.000Z'), new Date('2000-01-02T23:59:59.999Z')).map((bucket) => ({
        skuComboId: bucket.key.startsWith('product:') ? null : bucket.key,
        compositeSku: bucket.compositeSku,
        productName: bucket.productName,
        classification: bucket.classification,
        color: bucket.color,
        size: bucket.size,
        material: bucket.material,
        openingStock: bucket.openingQty,
        openingValue: bucket.openingValue,
        totalIn: bucket.totalInQty,
        totalInValue: bucket.totalInValue,
        totalOut: bucket.totalOutQty,
        totalOutValue: bucket.totalOutValue,
        closingStock: bucket.closingQty,
        closingValue: bucket.closingValue,
    }));
}
let ReportService = class ReportService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async generateExcelReport(filters) {
        const where = {};
        if (filters.categoryId) {
            where.categoryId = filters.categoryId;
        }
        if (filters.startDate || filters.endDate) {
            const updatedAt = {};
            if (filters.startDate) {
                updatedAt.gte = new Date(filters.startDate);
            }
            if (filters.endDate) {
                updatedAt.lte = new Date(filters.endDate);
            }
            where.updatedAt = updatedAt;
        }
        const products = await this.prisma.product.findMany({
            where,
            include: {
                category: true,
                transactions: true,
            },
            orderBy: { name: 'asc' },
        });
        if (products.length === 0) {
            throw new common_1.NotFoundException('Không có dữ liệu để xuất báo cáo');
        }
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Báo cáo tồn kho');
        worksheet.columns = [
            { header: 'Tên sản phẩm', key: 'name', width: 30 },
            { header: 'SKU', key: 'sku', width: 25 },
            { header: 'Danh mục', key: 'category', width: 20 },
            { header: 'Số lượng nhập', key: 'stockIn', width: 15 },
            { header: 'Số lượng xuất', key: 'stockOut', width: 15 },
            { header: 'Tồn kho hiện tại', key: 'currentStock', width: 18 },
            { header: 'Thời gian cập nhật cuối', key: 'updatedAt', width: 25 },
        ];
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.alignment = { horizontal: 'center' };
        for (const product of products) {
            const totalStockIn = product.transactions
                .filter((t) => t.type === 'STOCK_IN')
                .reduce((sum, t) => sum + t.quantity, 0);
            const totalStockOut = product.transactions
                .filter((t) => t.type === 'STOCK_OUT')
                .reduce((sum, t) => sum + t.quantity, 0);
            worksheet.addRow({
                name: product.name,
                sku: product.sku,
                category: product.category.name,
                stockIn: totalStockIn,
                stockOut: totalStockOut,
                currentStock: product.stock,
                updatedAt: product.updatedAt.toISOString(),
            });
        }
        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }
    async getNxtReport(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const transactions = await this.prisma.inventoryTransaction.findMany({
            where: {
                createdAt: { lte: end },
                status: index_1.InventoryTransactionStatus.ACTIVE,
            },
            include: {
                product: true,
                skuCombo: {
                    include: {
                        classification: true,
                        color: true,
                        size: true,
                        material: true,
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
        return (0, inventory_valuation_util_js_1.buildInventoryValuationBuckets)(transactions.map((transaction) => ({
            id: transaction.id,
            productId: transaction.productId,
            productName: transaction.product.name,
            productSku: transaction.product.sku,
            skuComboId: transaction.skuComboId,
            compositeSku: transaction.skuCombo?.compositeSku ?? null,
            classification: transaction.skuCombo?.classification?.name ?? null,
            color: transaction.skuCombo?.color?.name ?? null,
            size: transaction.skuCombo?.size?.name ?? null,
            material: transaction.skuCombo?.material?.name ?? null,
            type: transaction.type,
            quantity: transaction.quantity,
            purchasePrice: transaction.purchasePrice
                ? Number(transaction.purchasePrice)
                : Number(transaction.product.price ?? 0),
            createdAt: transaction.createdAt,
            status: transaction.status,
        })), start, end).map((bucket) => ({
            skuComboId: bucket.key.startsWith('product:') ? null : bucket.key,
            compositeSku: bucket.compositeSku,
            productName: bucket.productName,
            classification: bucket.classification,
            color: bucket.color,
            size: bucket.size,
            material: bucket.material,
            openingStock: bucket.openingQty,
            openingValue: bucket.openingValue,
            totalIn: bucket.totalInQty,
            totalInValue: bucket.totalInValue,
            totalOut: bucket.totalOutQty,
            totalOutValue: bucket.totalOutValue,
            closingStock: bucket.closingQty,
            closingValue: bucket.closingValue,
        }));
    }
    async exportNxtExcel(startDate, endDate) {
        const data = await this.getNxtReport(startDate, endDate);
        if (data.length === 0) {
            throw new common_1.NotFoundException('Không có dữ liệu trong khoảng thời gian đã chọn');
        }
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Báo cáo NXT');
        worksheet.columns = [
            { header: 'SKU', key: 'compositeSku', width: 30 },
            { header: 'Ten san pham', key: 'productName', width: 30 },
            { header: 'Phân loại', key: 'classification', width: 20 },
            { header: 'Màu', key: 'color', width: 15 },
            { header: 'Size', key: 'size', width: 10 },
            { header: 'Chất liệu', key: 'material', width: 15 },
            { header: 'Tồn đầu kỳ', key: 'openingStock', width: 15 },
            { header: 'Giá trị tồn đầu', key: 'openingValue', width: 18 },
            { header: 'Nhập', key: 'totalIn', width: 12 },
            { header: 'Giá trị nhập', key: 'totalInValue', width: 18 },
            { header: 'Xuất', key: 'totalOut', width: 12 },
            { header: 'Giá trị xuất', key: 'totalOutValue', width: 18 },
            { header: 'Tồn cuối kỳ', key: 'closingStock', width: 15 },
            { header: 'Giá trị tồn cuối', key: 'closingValue', width: 18 },
        ];
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.alignment = { horizontal: 'center' };
        for (const item of data) {
            worksheet.addRow(item);
        }
        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }
    async generateTemplate() {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Template Nhập kho');
        worksheet.columns = [
            { header: 'Phân loại', key: 'classification', width: 20 },
            { header: 'Màu', key: 'color', width: 15 },
            { header: 'Size', key: 'size', width: 10 },
            { header: 'Chất liệu', key: 'material', width: 15 },
            { header: 'Số lượng', key: 'quantity', width: 12 },
            { header: 'Giá nhập', key: 'purchasePrice', width: 14 },
            { header: 'Giá bán', key: 'salePrice', width: 14 },
            { header: 'Tình trạng hàng', key: 'condition', width: 20 },
            { header: 'Vị trí kho', key: 'position', width: 15 },
            { header: 'Loại kho', key: 'warehouseType', width: 15 },
            { header: 'Ghi chú', key: 'note', width: 25 },
        ];
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.alignment = { horizontal: 'center' };
        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }
    validateImportRow(row, rowIndex, lookups) {
        const errors = [];
        const classification = String(row.classification || '').trim();
        const color = String(row.color || '').trim();
        const size = String(row.size || '').trim();
        const material = String(row.material || '').trim();
        const quantity = Number(row.quantity);
        const rawPurchasePrice = row.purchasePrice;
        const rawSalePrice = row.salePrice;
        const purchasePrice = rawPurchasePrice === undefined || rawPurchasePrice === null || rawPurchasePrice === ''
            ? null
            : Number(rawPurchasePrice);
        const salePrice = rawSalePrice === undefined || rawSalePrice === null || rawSalePrice === ''
            ? null
            : Number(rawSalePrice);
        if (!classification) {
            errors.push({ row: rowIndex, field: 'Phân loại', message: 'Phân loại là bắt buộc' });
        }
        else if (!lookups.classifications.has(classification.toLowerCase())) {
            errors.push({ row: rowIndex, field: 'Phân loại', message: `Phân loại "${classification}" không tồn tại` });
        }
        if (!color) {
            errors.push({ row: rowIndex, field: 'Màu', message: 'Màu là bắt buộc' });
        }
        else if (!lookups.colors.has(color.toLowerCase())) {
            errors.push({ row: rowIndex, field: 'Màu', message: `Màu "${color}" không tồn tại` });
        }
        if (!size) {
            errors.push({ row: rowIndex, field: 'Size', message: 'Size là bắt buộc' });
        }
        else if (!lookups.sizes.has(size.toLowerCase())) {
            errors.push({ row: rowIndex, field: 'Size', message: `Size "${size}" không tồn tại` });
        }
        if (!material) {
            errors.push({ row: rowIndex, field: 'Chất liệu', message: 'Chất liệu là bắt buộc' });
        }
        else if (!lookups.materials.has(material.toLowerCase())) {
            errors.push({ row: rowIndex, field: 'Chất liệu', message: `Chất liệu "${material}" không tồn tại` });
        }
        if (isNaN(quantity) || quantity <= 0) {
            errors.push({ row: rowIndex, field: 'Số lượng', message: 'Số lượng phải lớn hơn 0' });
        }
        if (purchasePrice !== null && (isNaN(purchasePrice) || purchasePrice <= 0)) {
            errors.push({ row: rowIndex, field: 'Gia nhap', message: 'Gia nhap la bat buoc va phai lon hon 0' });
        }
        if (salePrice !== null && (isNaN(salePrice) || salePrice <= 0)) {
            errors.push({ row: rowIndex, field: 'Gia ban', message: 'Gia ban la bat buoc va phai lon hon 0' });
        }
        return { valid: errors.length === 0, errors };
    }
    async importStockIn(fileBuffer, userId) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(fileBuffer);
        const worksheet = workbook.getWorksheet(1);
        if (!worksheet) {
            throw new common_1.BadRequestException('File không đúng định dạng template');
        }
        const [classifications, colors, sizes, materials, conditions] = await Promise.all([
            this.prisma.classification.findMany(),
            this.prisma.color.findMany(),
            this.prisma.size.findMany(),
            this.prisma.material.findMany(),
            this.prisma.productCondition.findMany(),
        ]);
        const classificationMap = new Map(classifications.map((c) => [c.name.toLowerCase(), c.id]));
        const colorMap = new Map(colors.map((c) => [c.name.toLowerCase(), c.id]));
        const sizeMap = new Map(sizes.map((s) => [s.name.toLowerCase(), s.id]));
        const materialMap = new Map(materials.map((m) => [m.name.toLowerCase(), m.id]));
        const conditionMap = new Map(conditions.map((c) => [c.name.toLowerCase(), c.id]));
        const lookups = {
            classifications: classificationMap,
            colors: colorMap,
            sizes: sizeMap,
            materials: materialMap,
            conditions: conditionMap,
        };
        const rows = [];
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1)
                return;
            rows.push({
                classification: row.getCell(1).value,
                color: row.getCell(2).value,
                size: row.getCell(3).value,
                material: row.getCell(4).value,
                quantity: row.getCell(5).value,
                purchasePrice: row.getCell(6).value,
                salePrice: row.getCell(7).value,
                condition: row.getCell(8).value,
                position: row.getCell(9).value,
                warehouseType: row.getCell(10).value,
                note: row.getCell(11).value,
            });
        });
        if (rows.length === 0) {
            throw new common_1.BadRequestException('File không có dữ liệu');
        }
        const allErrors = [];
        for (let i = 0; i < rows.length; i++) {
            const { errors } = this.validateImportRow(rows[i], i + 2, lookups);
            allErrors.push(...errors);
        }
        if (allErrors.length > 0) {
            return {
                success: false,
                totalRows: rows.length,
                importedRows: 0,
                errors: allErrors,
            };
        }
        const operations = rows.map((row) => {
            const classificationName = String(row.classification).trim().toLowerCase();
            const colorName = String(row.color).trim().toLowerCase();
            const sizeName = String(row.size).trim().toLowerCase();
            const materialName = String(row.material).trim().toLowerCase();
            const quantity = Number(row.quantity);
            const purchasePrice = row.purchasePrice === undefined || row.purchasePrice === null || row.purchasePrice === ''
                ? 0
                : Number(row.purchasePrice);
            const salePrice = row.salePrice === undefined || row.salePrice === null || row.salePrice === ''
                ? 0
                : Number(row.salePrice);
            const conditionName = row.condition ? String(row.condition).trim().toLowerCase() : null;
            const classificationId = classificationMap.get(classificationName);
            const colorId = colorMap.get(colorName);
            const sizeId = sizeMap.get(sizeName);
            const materialId = materialMap.get(materialName);
            const productConditionId = conditionName ? conditionMap.get(conditionName) : undefined;
            return {
                classificationId,
                colorId,
                sizeId,
                materialId,
                quantity,
                purchasePrice,
                salePrice,
                productConditionId,
            };
        });
        let importedRows = 0;
        const txnOps = [];
        for (const op of operations) {
            const skuCombo = await this.prisma.skuCombo.findFirst({
                where: {
                    classificationId: op.classificationId,
                    colorId: op.colorId,
                    sizeId: op.sizeId,
                    materialId: op.materialId,
                },
            });
            if (!skuCombo) {
                continue;
            }
            const product = await this.prisma.product.findFirst();
            if (!product)
                continue;
            txnOps.push(this.prisma.inventoryTransaction.create({
                data: {
                    productId: product.id,
                    type: 'STOCK_IN',
                    quantity: op.quantity,
                    purchasePrice: op.purchasePrice,
                    salePrice: op.salePrice,
                    status: index_1.InventoryTransactionStatus.ACTIVE,
                    userId,
                    skuComboId: skuCombo.id,
                    productConditionId: op.productConditionId || null,
                    actualStockDate: new Date(),
                },
            }));
            txnOps.push(this.prisma.product.update({
                where: { id: product.id },
                data: {
                    stock: { increment: op.quantity },
                    price: op.salePrice,
                },
            }));
            importedRows++;
        }
        if (txnOps.length > 0) {
            await this.prisma.$transaction(txnOps);
        }
        return {
            success: true,
            totalRows: rows.length,
            importedRows,
        };
    }
};
exports.ReportService = ReportService;
exports.ReportService = ReportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService])
], ReportService);
//# sourceMappingURL=report.service.js.map