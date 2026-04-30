import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class BackupService {
  constructor(private readonly prisma: PrismaService) {}

  async exportDatabase() {
    const [
      users,
      categories,
      products,
      classifications,
      colors,
      sizes,
      materials,
      skuCombos,
      productConditions,
      storageZones,
      warehouseTypes,
      preliminaryChecks,
      warehouseLayouts,
      warehousePositions,
      inventoryTransactions,
      stocktakingRecords,
      stocktakingItems,
      stocktakingStatusHistory,
      warehouseConfig,
      savedFilters,
      activityLogs,
    ] = await Promise.all([
      this.prisma.user.findMany(),
      this.prisma.category.findMany(),
      this.prisma.product.findMany(),
      this.prisma.classification.findMany(),
      this.prisma.color.findMany(),
      this.prisma.size.findMany(),
      this.prisma.material.findMany(),
      this.prisma.skuCombo.findMany(),
      this.prisma.productCondition.findMany(),
      this.prisma.storageZone.findMany(),
      this.prisma.warehouseType.findMany(),
      this.prisma.preliminaryCheck.findMany(),
      this.prisma.warehouseLayout.findMany(),
      this.prisma.warehousePosition.findMany(),
      this.prisma.inventoryTransaction.findMany(),
      this.prisma.stocktakingRecord.findMany(),
      this.prisma.stocktakingItem.findMany(),
      this.prisma.stocktakingStatusHistory.findMany(),
      this.prisma.warehouseConfig.findMany(),
      this.prisma.savedFilter.findMany(),
      this.prisma.activityLog.findMany(),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      version: 1,
      data: {
        users,
        categories,
        products,
        classifications,
        colors,
        sizes,
        materials,
        skuCombos,
        productConditions,
        storageZones,
        warehouseTypes,
        preliminaryChecks,
        warehouseLayouts,
        warehousePositions,
        inventoryTransactions,
        stocktakingRecords,
        stocktakingItems,
        stocktakingStatusHistory,
        warehouseConfig,
        savedFilters,
        activityLogs,
      },
    };
  }
}
