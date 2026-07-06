import { Injectable } from '@nestjs/common';
import archiverLib = require('archiver');
import { createWriteStream, existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { Readable } from 'stream';
import unzipper = require('unzipper');
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class BackupService {
  constructor(private readonly prisma: PrismaService) {}

  private async safeQuery<T>(
    name: string,
    fn: () => Promise<T[]>,
  ): Promise<T[]> {
    try {
      return await fn();
    } catch (err) {
      console.error(`[Backup] Failed to query "${name}":`, err);
      return [];
    }
  }

  async getDatabasePayload() {
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
      orderPlans,
      barcodePrintLogs,
      customLabelTemplates,
    ] = await Promise.all([
      this.safeQuery('user', () =>
        this.prisma.user.findMany({
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            permissions: true,
            createdAt: true,
            updatedAt: true,
            // password và refreshToken bị loại bỏ để bảo mật
          },
        }),
      ),
      this.safeQuery('category', () => this.prisma.category.findMany()),
      this.safeQuery('product', () => this.prisma.product.findMany()),
      this.safeQuery('classification', () =>
        this.prisma.classification.findMany(),
      ),
      this.safeQuery('color', () => this.prisma.color.findMany()),
      this.safeQuery('size', () => this.prisma.size.findMany()),
      this.safeQuery('material', () => this.prisma.material.findMany()),
      this.safeQuery('skuCombo', () => this.prisma.skuCombo.findMany()),
      this.safeQuery('productCondition', () =>
        this.prisma.productCondition.findMany(),
      ),
      this.safeQuery('storageZone', () => this.prisma.storageZone.findMany()),
      this.safeQuery('warehouseType', () =>
        this.prisma.warehouseType.findMany(),
      ),
      this.safeQuery('preliminaryCheck', () =>
        this.prisma.preliminaryCheck.findMany(),
      ),
      this.safeQuery('warehouseLayout', () =>
        this.prisma.warehouseLayout.findMany(),
      ),
      this.safeQuery('warehousePosition', () =>
        this.prisma.warehousePosition.findMany(),
      ),
      this.safeQuery('inventoryTransaction', () =>
        this.prisma.inventoryTransaction.findMany(),
      ),
      this.safeQuery('stocktakingRecord', () =>
        this.prisma.stocktakingRecord.findMany(),
      ),
      this.safeQuery('stocktakingItem', () =>
        this.prisma.stocktakingItem.findMany(),
      ),
      this.safeQuery('stocktakingStatusHistory', () =>
        this.prisma.stocktakingStatusHistory.findMany(),
      ),
      this.safeQuery('warehouseConfig', () =>
        this.prisma.warehouseConfig.findMany(),
      ),
      this.safeQuery('savedFilter', () => this.prisma.savedFilter.findMany()),
      this.safeQuery('activityLog', () => this.prisma.activityLog.findMany()),
      this.safeQuery('orderPlan', () => this.prisma.orderPlan.findMany()),
      this.safeQuery('barcodePrintLog', () =>
        this.prisma.barcodePrintLog.findMany(),
      ),
      this.safeQuery('customLabelTemplate', () =>
        this.prisma.customLabelTemplate.findMany(),
      ),
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
        orderPlans,
        barcodePrintLogs,
        customLabelTemplates,
      },
    };
  }

  async exportDatabase() {
    return this.getDatabasePayload();
  }

  async createFullBackupArchive(): Promise<archiverLib.Archiver> {
    const dbPayload = await this.getDatabasePayload();
    const jsonString = JSON.stringify(dbPayload, null, 2);

    const archive = new (archiverLib as any).ZipArchive({
      zlib: { level: 9 },
    }) as archiverLib.Archiver;

    archive.append(jsonString, { name: 'database.json' });

    const uploadsDir = join(process.cwd(), 'uploads');
    if (existsSync(uploadsDir)) {
      archive.directory(uploadsDir, 'uploads');
    }

    const storageDir = join(process.cwd(), 'storage');
    if (existsSync(storageDir)) {
      archive.directory(storageDir, 'storage');
    }

    // Do NOT call finalize() here — caller must pipe() before finalize()
    return archive;
  }

  async searchSkusForAdmin(q: string): Promise<
    Array<{
      id: string;
      compositeSku: string;
      categoryName: string | null;
      stock: number;
    }>
  > {
    const keyword = q.trim();
    const skuCombos = await this.prisma.skuCombo.findMany({
      where: keyword
        ? {
            OR: [
              { compositeSku: { contains: keyword } },
              { classification: { name: { contains: keyword } } },
              { color: { name: { contains: keyword } } },
              { size: { name: { contains: keyword } } },
              { material: { name: { contains: keyword } } },
            ],
          }
        : undefined,
      take: 30,
      orderBy: { createdAt: 'desc' },
      include: {
        inventoryTransactions: {
          where: { categoryId: { not: null } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { category: { select: { name: true } } },
        },
      },
    });

    const ids = skuCombos.map((s) => s.id);
    const transactions = ids.length
      ? await this.prisma.inventoryTransaction.findMany({
          where: { skuComboId: { in: ids }, status: 'ACTIVE' },
          select: { skuComboId: true, type: true, quantity: true },
        })
      : [];

    const stockMap = new Map<string, number>();
    for (const tx of transactions) {
      if (!tx.skuComboId) continue;
      const cur = stockMap.get(tx.skuComboId) ?? 0;
      stockMap.set(
        tx.skuComboId,
        cur + (tx.type === 'STOCK_IN' ? tx.quantity : -tx.quantity),
      );
    }

    return skuCombos.map((s) => ({
      id: s.id,
      compositeSku: s.compositeSku,
      categoryName: s.inventoryTransactions[0]?.category?.name ?? null,
      stock: stockMap.get(s.id) ?? 0,
    }));
  }

  async deleteSkuData(
    skuComboIds: string[],
  ): Promise<{ deletedTransactions: number }> {
    if (!skuComboIds.length) return { deletedTransactions: 0 };

    // Collect affected zones/positions before deleting
    const affected = await this.prisma.inventoryTransaction.findMany({
      where: { skuComboId: { in: skuComboIds } },
      select: { storageZoneId: true, warehousePositionId: true },
    });

    const zoneIds = [
      ...new Set(affected.map((t) => t.storageZoneId).filter(Boolean)),
    ] as string[];
    const posIds = [
      ...new Set(affected.map((t) => t.warehousePositionId).filter(Boolean)),
    ] as string[];

    const { count } = await this.prisma.inventoryTransaction.deleteMany({
      where: { skuComboId: { in: skuComboIds } },
    });

    // Recalculate zone stocks from remaining transactions
    await Promise.all(
      zoneIds.map(async (zoneId) => {
        const txs = await this.prisma.inventoryTransaction.findMany({
          where: { storageZoneId: zoneId, status: 'ACTIVE' },
          select: { type: true, quantity: true },
        });
        const stock = txs.reduce(
          (s, t) => s + (t.type === 'STOCK_IN' ? t.quantity : -t.quantity),
          0,
        );
        await this.prisma.storageZone.update({
          where: { id: zoneId },
          data: { currentStock: Math.max(0, stock) },
        });
      }),
    );

    // Recalculate position stocks from remaining transactions
    await Promise.all(
      posIds.map(async (posId) => {
        const txs = await this.prisma.inventoryTransaction.findMany({
          where: { warehousePositionId: posId, status: 'ACTIVE' },
          select: { type: true, quantity: true },
        });
        const stock = txs.reduce(
          (s, t) => s + (t.type === 'STOCK_IN' ? t.quantity : -t.quantity),
          0,
        );
        await this.prisma.warehousePosition.update({
          where: { id: posId },
          data: { currentStock: Math.max(0, stock) },
        });
      }),
    );

    return { deletedTransactions: count };
  }

  async resetTestData(): Promise<{ deleted: Record<string, number> }> {
    // Order matters: delete child records before parents (FK constraints)
    const [txCount] = await Promise.all([
      this.prisma.inventoryTransaction.deleteMany(),
    ]);
    const [siCount, sshCount] = await Promise.all([
      this.prisma.stocktakingItem.deleteMany(),
      this.prisma.stocktakingStatusHistory.deleteMany(),
    ]);
    const [srCount, pcCount, opCount, alCount, bplCount] = await Promise.all([
      this.prisma.stocktakingRecord.deleteMany(),
      this.prisma.preliminaryCheck.deleteMany(),
      this.prisma.orderPlan.deleteMany(),
      this.prisma.activityLog.deleteMany(),
      this.prisma.barcodePrintLog.deleteMany(),
    ]);

    // Reset all stock counters
    await Promise.all([
      this.prisma.warehousePosition.updateMany({ data: { currentStock: 0 } }),
      this.prisma.storageZone.updateMany({ data: { currentStock: 0 } }),
    ]);

    return {
      deleted: {
        inventoryTransactions: txCount.count,
        stocktakingItems: siCount.count,
        stocktakingStatusHistory: sshCount.count,
        stocktakingRecords: srCount.count,
        preliminaryChecks: pcCount.count,
        orderPlans: opCount.count,
        activityLogs: alCount.count,
        barcodePrintLogs: bplCount.count,
      },
    };
  }

  async restoreFilesFromZip(
    zipBuffer: Buffer,
  ): Promise<{ restored: string[] }> {
    const uploadsDir = join(process.cwd(), 'uploads');
    const storageDir = join(process.cwd(), 'storage');
    const restored: string[] = [];

    await new Promise<void>((resolve, reject) => {
      const stream = Readable.from(zipBuffer);
      stream
        .pipe(unzipper.Parse())
        .on('entry', (entry: unzipper.Entry) => {
          const filePath: string = entry.path;

          if (filePath.startsWith('uploads/') && filePath !== 'uploads/') {
            const relative = filePath.slice('uploads/'.length);
            if (!relative) {
              entry.autodrain();
              return;
            }
            const dest = join(uploadsDir, relative);
            mkdir(dirname(dest), { recursive: true })
              .then(() => {
                const ws = createWriteStream(dest);
                entry.pipe(ws);
                ws.on('finish', () => restored.push(filePath));
                ws.on('error', () => entry.autodrain());
              })
              .catch(() => entry.autodrain());
          } else if (
            filePath.startsWith('storage/') &&
            filePath !== 'storage/'
          ) {
            const relative = filePath.slice('storage/'.length);
            if (!relative) {
              entry.autodrain();
              return;
            }
            const dest = join(storageDir, relative);
            mkdir(dirname(dest), { recursive: true })
              .then(() => {
                const ws = createWriteStream(dest);
                entry.pipe(ws);
                ws.on('finish', () => restored.push(filePath));
                ws.on('error', () => entry.autodrain());
              })
              .catch(() => entry.autodrain());
          } else {
            entry.autodrain();
          }
        })
        .on('finish', resolve)
        .on('error', reject);
    });

    return { restored };
  }
}
