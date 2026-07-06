import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateLayoutDto } from './dto/create-layout.dto.js';
import type { UpdateLayoutDto } from './dto/update-layout.dto.js';
import type { UpdatePositionLayoutDto } from './dto/update-position-layout.dto.js';
import type { CreatePositionDto } from './dto/create-position.dto.js';

@Injectable()
export class WarehouseService {
  constructor(private readonly prisma: PrismaService) {}

  private buildGridPosition(row: number, column: number) {
    return {
      x: column * 110,
      y: row * 90,
      width: 100,
      height: 80,
    };
  }

  async createLayout(dto: CreateLayoutDto) {
    const layoutMode = dto.layoutMode ?? 'GRID';
    const layout = await this.prisma.warehouseLayout.create({
      data: {
        name: dto.name,
        rows: dto.rows,
        columns: dto.columns,
        layoutMode,
      },
    });

    // Auto-generate positions only for GRID layouts.
    // FREE layouts start empty so users can build custom L/U/irregular structures.
    const positions: {
      layoutId: string;
      row: number;
      column: number;
      label: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }[] = [];

    if (layoutMode === 'GRID') {
      for (let r = 0; r < dto.rows; r++) {
        for (let c = 0; c < dto.columns; c++) {
          const rowLabel = String.fromCharCode(65 + r); // A, B, C, ...
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
          orderBy: [{ row: 'asc' }, { column: 'asc' }],
        },
      },
    });
  }

  async updateLayout(id: string, dto: UpdateLayoutDto) {
    const existing = await this.prisma.warehouseLayout.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Layout không tồn tại');
    }

    const newRows = dto.rows ?? existing.rows;
    const newColumns = dto.columns ?? existing.columns;

    // Update layout metadata
    const layout = await this.prisma.warehouseLayout.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        rows: newRows,
        columns: newColumns,
      },
    });

    // If grid dimensions changed, regenerate positions
    if (
      (dto.rows !== undefined && dto.rows !== existing.rows) ||
      (dto.columns !== undefined && dto.columns !== existing.columns)
    ) {
      // Block if any active position still has stock
      const occupiedCount = await this.prisma.warehousePosition.count({
        where: { layoutId: id, isActive: true, currentStock: { gt: 0 } },
      });
      if (occupiedCount > 0) {
        throw new BadRequestException(
          `Không thể thay đổi kích thước lưới khi còn ${occupiedCount} vị trí đang chứa hàng. Vui lòng chuyển hàng ra trước.`,
        );
      }

      // Build new grid positions
      const newPositions: {
        label: string;
        row: number;
        column: number;
        layoutId: string;
        x: number;
        y: number;
        width: number;
        height: number;
      }[] = [];

      for (let r = 0; r < newRows; r++) {
        for (let c = 0; c < newColumns; c++) {
          const rowLabel = String.fromCharCode(65 + r);
          const colLabel = (c + 1).toString();
          newPositions.push({
            layoutId: id,
            row: r,
            column: c,
            label: `${rowLabel}${colLabel}`,
            ...this.buildGridPosition(r, c),
          });
        }
      }

      // Toàn bộ thao tác resize nằm trong 1 transaction — partial failure sẽ rollback
      const newLabels = newPositions.map((p) => p.label);
      await this.prisma.$transaction(async (tx) => {
        // Soft-delete all active positions — giữ UUID và transaction links
        await tx.warehousePosition.updateMany({
          where: { layoutId: id, isActive: true },
          data: { isActive: false },
        });

        // Lấy tất cả bản ghi cùng label để tái sử dụng (tránh vi phạm unique constraint)
        const existingByLabel = await tx.warehousePosition.findMany({
          where: { layoutId: id, label: { in: newLabels } },
        });
        const existingLabelMap = new Map(existingByLabel.map((p) => [p.label!, p]));

        // Reactivate bản ghi cũ nếu label khớp, tạo mới nếu chưa từng tồn tại
        const toCreate: typeof newPositions = [];
        for (const pos of newPositions) {
          const old = existingLabelMap.get(pos.label);
          if (old) {
            await tx.warehousePosition.update({
              where: { id: old.id },
              data: {
                isActive: true,
                row: pos.row,
                column: pos.column,
                x: pos.x,
                y: pos.y,
                width: pos.width,
                height: pos.height,
              },
            });
          } else {
            toCreate.push(pos);
          }
        }
        if (toCreate.length > 0) {
          await tx.warehousePosition.createMany({ data: toCreate });
        }
      });
    }

    return this.prisma.warehouseLayout.findUnique({
      where: { id: layout.id },
      include: {
        positions: {
          where: { isActive: true },
          orderBy: [{ row: 'asc' }, { column: 'asc' }],
        },
      },
    });
  }

  async deleteLayout(id: string) {
    const existing = await this.prisma.warehouseLayout.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Layout không tồn tại');
    }

    const positions = await this.prisma.warehousePosition.findMany({
      where: { layoutId: id },
      select: { id: true },
    });
    const positionIds = positions.map((p) => p.id);
    if (positionIds.length > 0) {
      const linkedTxCount = await this.prisma.inventoryTransaction.count({
        where: { warehousePositionId: { in: positionIds } },
      });
      if (linkedTxCount > 0) {
        throw new BadRequestException(
          `Không thể xóa layout này vì có ${linkedTxCount} giao dịch kho liên quan đến các vị trí trong layout.`,
        );
      }
    }

    // Cascade delete is handled by Prisma schema (onDelete: Cascade)
    await this.prisma.warehouseLayout.delete({ where: { id } });
  }

  async updateLayoutMode(
    id: string,
    mode: 'GRID' | 'FREE',
    canvasWidth?: number,
    canvasHeight?: number,
  ) {
    const layout = await this.prisma.warehouseLayout.findUnique({
      where: { id },
    });
    if (!layout) {
      throw new NotFoundException('Layout không tồn tại');
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
          where: { isActive: true },
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
          where: { isActive: true },
          orderBy: [{ row: 'asc' }, { column: 'asc' }],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return layout;
  }

  async validatePosition(positionId: string): Promise<boolean> {
    const position = await this.prisma.warehousePosition.findUnique({
      where: { id: positionId },
    });
    // Chỉ cho phép giao dịch mới link vào vị trí đang active
    return !!position && position.isActive;
  }

  async movePosition(id: string, targetRow: number, targetCol: number) {
    const position = await this.prisma.warehousePosition.findUnique({
      where: { id },
    });

    if (!position) {
      throw new NotFoundException('Vị trí không tồn tại');
    }

    // Chỉ tìm active position — không swap với inactive record
    const targetPosition = await this.prisma.warehousePosition.findFirst({
      where: {
        layoutId: position.layoutId,
        row: targetRow,
        column: targetCol,
        isActive: true,
      },
    });

    if (targetPosition) {
      // Swap coordinates
      const [updatedA, updatedB] = await this.prisma.$transaction([
        this.prisma.warehousePosition.update({
          where: { id: position.id },
          data: { row: targetRow, column: targetCol },
        }),
        this.prisma.warehousePosition.update({
          where: { id: targetPosition.id },
          data: { row: position.row, column: position.column },
        }),
      ]);
      return [updatedA, updatedB];
    } else {
      // Move to empty cell
      const updated = await this.prisma.warehousePosition.update({
        where: { id },
        data: { row: targetRow, column: targetCol },
      });
      return [updated];
    }
  }

  async updateLabel(id: string, label: string) {
    const position = await this.prisma.warehousePosition.findUnique({
      where: { id },
    });

    if (!position) {
      throw new NotFoundException('Vị trí không tồn tại');
    }

    // Kiểm tra cả active lẫn inactive — DB có unique constraint [layoutId, label]
    // nên rename sang label của inactive record cũng sẽ gây P2002 crash nếu không chặn trước.
    const duplicate = await this.prisma.warehousePosition.findFirst({
      where: {
        layoutId: position.layoutId,
        label: label,
        id: { not: id },
      },
    });

    if (duplicate) {
      const reason = duplicate.isActive
        ? 'Nhãn vị trí đã tồn tại trong sơ đồ kho'
        : 'Nhãn này đã được dùng bởi một vị trí đã xóa. Hãy tạo lại vị trí đó để khôi phục dữ liệu.';
      throw new BadRequestException(reason);
    }

    const matchedZone = await this.prisma.storageZone.findFirst({
      where: { name: label },
      select: { maxCapacity: true },
    });

    const updated = await this.prisma.warehousePosition.update({
      where: { id },
      data: {
        label,
        maxCapacity: matchedZone?.maxCapacity ?? position.maxCapacity,
      },
    });

    await this.syncWarehouseLayoutPosition(id);
    return updated;
  }

  async toggleActive(id: string) {
    const position = await this.prisma.warehousePosition.findUnique({
      where: { id },
    });

    if (!position) {
      throw new NotFoundException('Vị trí không tồn tại');
    }

    // If deactivating, check if position still has active stock.
    if (position.isActive) {
      if (position.currentStock > 0) {
        throw new BadRequestException(
          'Vị trí này đang chứa hàng hóa, vui lòng di chuyển hàng trước khi vô hiệu hóa',
        );
      }
    }

    return this.prisma.warehousePosition.update({
      where: { id },
      data: { isActive: !position.isActive },
    });
  }

  async updateCapacity(id: string, maxCapacity: number) {
    const position = await this.prisma.warehousePosition.findUnique({
      where: { id },
    });

    if (!position) {
      throw new NotFoundException('Vị trí không tồn tại');
    }

    if (maxCapacity <= 0) {
      throw new BadRequestException('Sức chứa tối đa phải lớn hơn 0');
    }

    if (maxCapacity < position.currentStock) {
      throw new BadRequestException(
        `Sức chứa tối đa không thể nhỏ hơn tồn kho hiện tại (${position.currentStock})`,
      );
    }

    return this.prisma.warehousePosition.update({
      where: { id },
      data: { maxCapacity },
    });
  }

  async updatePositionLayout(id: string, dto: UpdatePositionLayoutDto) {
    const position = await this.prisma.warehousePosition.findUnique({
      where: { id },
      include: { layout: true },
    });
    if (!position) {
      throw new NotFoundException('Vị trí không tồn tại');
    }

    const nextData = {
      x: dto.x ?? position.x,
      y: dto.y ?? position.y,
      width: dto.width ?? position.width,
      height: dto.height ?? position.height,
    };

    if (
      position.layout.layoutMode === 'GRID' &&
      (dto.x !== undefined || dto.y !== undefined)
    ) {
      throw new ForbiddenException(
        'Layout dạng GRID không cho phép kéo thả tự do',
      );
    }

    return this.prisma.warehousePosition.update({
      where: { id },
      data: nextData,
    });
  }

  async createPosition(dto: CreatePositionDto) {
    const layout = await this.prisma.warehouseLayout.findUnique({
      where: { id: dto.layoutId },
    });
    if (!layout) {
      throw new NotFoundException('Layout không tồn tại');
    }

    // Chỉ đếm active positions để auto-label không bị nhảy số khi có inactive records
    const activeCount = await this.prisma.warehousePosition.count({
      where: { layoutId: dto.layoutId, isActive: true },
    });
    const label = dto.label ?? `P${activeCount + 1}`;

    // Nếu đã tồn tại bản ghi cùng label (kể cả inactive), reactivate thay vì tạo mới.
    // Điều này đảm bảo UUID không thay đổi và toàn bộ lịch sử giao dịch được giữ nguyên.
    const existingByLabel = await this.prisma.warehousePosition.findFirst({
      where: { layoutId: dto.layoutId, label },
    });

    if (existingByLabel) {
      if (existingByLabel.isActive) {
        throw new BadRequestException('Nhãn vị trí đã tồn tại trong sơ đồ kho');
      }
      // Reactivate — khôi phục vị trí với UUID cũ, giữ nguyên transaction links
      const reactivated = await this.prisma.warehousePosition.update({
        where: { id: existingByLabel.id },
        data: {
          isActive: true,
          x: dto.x ?? existingByLabel.x,
          y: dto.y ?? existingByLabel.y,
          width: dto.width ?? existingByLabel.width,
          height: dto.height ?? existingByLabel.height,
          maxCapacity: dto.maxCapacity ?? existingByLabel.maxCapacity,
        },
      });
      // Sync position stock and skus
      await this.syncWarehouseLayoutPosition(reactivated.id);
      // Trả về flag để frontend biết đây là khôi phục vị trí cũ (có lịch sử tồn kho)
      return { ...reactivated, reactivated: true };
    }

    const row = dto.y !== undefined ? Math.floor(dto.y / 90) : 0;
    const column = dto.x !== undefined ? Math.floor(dto.x / 110) : 0;

    const created = await this.prisma.warehousePosition.create({
      data: {
        layoutId: dto.layoutId,
        row,
        column,
        x: dto.x ?? 0,
        y: dto.y ?? 0,
        width: dto.width ?? 100,
        height: dto.height ?? 80,
        label,
        maxCapacity: dto.maxCapacity ?? null,
      },
    });

    await this.syncWarehouseLayoutPosition(created.id);
    return created;
  }

  async deletePosition(id: string, force?: boolean) {
    const position = await this.prisma.warehousePosition.findUnique({
      where: { id },
    });
    if (!position) {
      throw new NotFoundException('Vị trí không tồn tại');
    }

    // Block if position has stock and not confirmed
    if (position.currentStock > 0 && !force) {
      throw new BadRequestException(
        'Vị trí đang chứa hàng hóa. Xác nhận để xóa bắt buộc.',
      );
    }

    // Soft delete — UUID và transaction links được giữ nguyên.
    // Khi tạo lại vị trí cùng label, hệ thống sẽ reactivate bản ghi này
    // thay vì tạo mới, đảm bảo toàn bộ lịch sử tồn kho không bị mất.
    await this.prisma.warehousePosition.update({
      where: { id },
      data: { isActive: false },
    });

    return { success: true };
  }

  async getPositionSkus(id: string) {
    const position = await this.prisma.warehousePosition.findUnique({
      where: { id },
    });

    if (!position) {
      throw new NotFoundException('Vị trí không tồn tại');
    }

    // Find matching storage zone by position label
    const zone = position.label
      ? await this.prisma.storageZone.findFirst({
          where: { name: position.label },
        })
      : null;

    const whereClause = zone
      ? {
          OR: [
            { warehousePositionId: id },
            { storageZoneId: zone.id },
          ],
          status: 'ACTIVE' as const,
        }
      : {
          warehousePositionId: id,
          status: 'ACTIVE' as const,
        };

    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: whereClause,
      include: {
        skuCombo: {
          include: {
            classification: true,
            color: true,
            size: true,
            material: true,
          },
        },
        category: true,
      },
    });

    const skuMap = new Map<
      string,
      {
        compositeSku: string;
        quantity: number;
        classification: string | null;
        color: string | null;
        size: string | null;
        material: string | null;
        categoryName: string | null;
      }
    >();

    for (const txn of transactions) {
      const delta = txn.type === 'STOCK_IN' ? txn.quantity : -txn.quantity;

      if (!txn.skuComboId && !txn.categoryId) continue;
      const key = txn.skuComboId ?? `cat:${txn.categoryId}`;
      const existing = skuMap.get(key);

      if (existing) {
        existing.quantity += delta;
      } else {
        skuMap.set(key, {
          compositeSku: txn.skuCombo?.compositeSku ?? '',
          quantity: delta,
          classification: txn.skuCombo?.classification?.name ?? null,
          color: txn.skuCombo?.color?.name ?? null,
          size: txn.skuCombo?.size?.name ?? null,
          material: txn.skuCombo?.material?.name ?? null,
          categoryName: txn.category?.name ?? null,
        });
      }
    }

    const skus = Array.from(skuMap.values()).filter((s) => s.quantity > 0);
    const finalStock = skus.reduce((sum, s) => sum + s.quantity, 0);

    return {
      skus,
      currentStock: finalStock,
    };
  }

  async getLayoutWithSkus() {
    const layouts = await this.prisma.warehouseLayout.findMany({
      include: {
        positions: {
          where: { isActive: true },
          orderBy: [{ row: 'asc' }, { column: 'asc' }],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (layouts.length === 0) return [];

    // Collect all position IDs and their labels
    const allPositionIds = layouts.flatMap((l) => l.positions.map((p) => p.id));
    const positionLabelMap = new Map<string, string[]>();
    for (const l of layouts) {
      for (const p of l.positions) {
        if (p.label) {
          const key = p.label.toLowerCase();
          const ids = positionLabelMap.get(key) ?? [];
          ids.push(p.id);
          positionLabelMap.set(key, ids);
        }
      }
    }

    // Find storage zones that match position labels (case-insensitive)
    const allZones = await this.prisma.storageZone.findMany();
    const zones = allZones.filter((z) => positionLabelMap.has(z.name.toLowerCase()));
    const zoneIdToLabel = new Map(zones.map((z) => [z.id, z.name]));

    // Fetch transactions by positionId OR by matching storageZoneId
    const allTransactions = allPositionIds.length > 0
      ? await this.prisma.inventoryTransaction.findMany({
          where: {
            OR: [
              { warehousePositionId: { in: allPositionIds } },
              ...(zones.length > 0
                ? [{ storageZoneId: { in: zones.map((z) => z.id) } }]
                : []),
            ],
            status: 'ACTIVE',
          },
          include: {
            skuCombo: {
              include: {
                classification: true,
                color: true,
                size: true,
                material: true,
              },
            },
            category: true,
          },
        })
      : [];

    // Group transactions by positionId
    const txByPosition = new Map<string, typeof allTransactions>();
    for (const tx of allTransactions) {
      if (tx.warehousePositionId) {
        const list = txByPosition.get(tx.warehousePositionId) ?? [];
        list.push(tx);
        txByPosition.set(tx.warehousePositionId, list);
      }
      // Also group transactions linked to a zone that matches a position label
      if (tx.storageZoneId) {
        const zoneName = zoneIdToLabel.get(tx.storageZoneId);
        if (zoneName) {
          const posIds = positionLabelMap.get(zoneName.toLowerCase()) ?? [];
          for (const posId of posIds) {
            if (posId !== tx.warehousePositionId) {
              const list = txByPosition.get(posId) ?? [];
              list.push(tx);
              txByPosition.set(posId, list);
            }
          }
        }
      }
    }

    return layouts.map((layout) => {
      const positions = layout.positions.map((pos) => {
        const transactions = txByPosition.get(pos.id) ?? [];

        // Compute SKUs from transactions (source of truth)
        const skuMap = new Map<string, {
          compositeSku: string;
          quantity: number;
          classification: string | null;
          color: string | null;
          size: string | null;
          material: string | null;
          categoryName: string | null;
        }>();

        for (const txn of transactions) {
          const delta = txn.type === 'STOCK_IN' ? txn.quantity : -txn.quantity;
          if (!txn.skuComboId && !txn.categoryId) continue;
          const key = txn.skuComboId ?? `cat:${txn.categoryId}`;
          const existing = skuMap.get(key);
          if (existing) {
            existing.quantity += delta;
          } else {
            skuMap.set(key, {
              compositeSku: txn.skuCombo?.compositeSku ?? '',
              quantity: delta,
              classification: txn.skuCombo?.classification?.name ?? null,
              color: txn.skuCombo?.color?.name ?? null,
              size: txn.skuCombo?.size?.name ?? null,
              material: txn.skuCombo?.material?.name ?? null,
              categoryName: txn.category?.name ?? null,
            });
          }
        }

        const skus = Array.from(skuMap.values()).filter((s) => s.quantity > 0);
        const computedStock = Math.max(0, skus.reduce((sum, s) => sum + s.quantity, 0));

        if (pos.currentStock !== computedStock) {
          console.warn(
            `[Warehouse Sync Warning] Position "${pos.label ?? pos.id}": DB currentStock=${pos.currentStock}, computed=${computedStock}. Using computed value.`,
          );
          // Fire-and-forget background resync to fix DB
          void this.prisma.warehousePosition.update({
            where: { id: pos.id },
            data: { currentStock: computedStock, skus: skus as any },
          }).catch(() => {/* ignore */});
        }

        return {
          ...pos,
          currentStock: computedStock,
          skus,
        };
      });

      return { ...layout, positions };
    });
  }

  async getSingleLayoutWithSkus() {
    const layouts = await this.getLayoutWithSkus();
    return layouts[0] ?? null;
  }

  async syncWarehouseLayoutPosition(positionId: string, tx?: any) {
    const client = tx ?? this.prisma;

    // 1. Fetch position details
    const position = await client.warehousePosition.findUnique({
      where: { id: positionId },
    });
    if (!position) return;

    // 2. Find matching storage zone by position label
    let zone = position.label
      ? await client.storageZone.findFirst({
          where: { name: position.label },
        })
      : null;

    // Fallback: case-insensitive matching
    if (!zone && position.label) {
      const allZones = await client.storageZone.findMany({
        select: { id: true, name: true },
      });
      zone = allZones.find(
        (z: { id: string; name: string }) => z.name.toLowerCase() === position.label!.toLowerCase(),
      ) ?? null;
      if (zone) {
        const fullZone = await client.storageZone.findUnique({
          where: { id: zone.id },
        });
        zone = fullZone;
      }
    }

    // 3. Fetch all active transactions for this position
    //    Include both transactions linked directly to the position AND
    //    transactions linked to the matching storage zone (without position)
    const positionWhere: Record<string, unknown>[] = [
      { warehousePositionId: positionId },
    ];
    if (zone) {
      positionWhere.push({ storageZoneId: zone.id });
    }

    const transactions = await client.inventoryTransaction.findMany({
      where: {
        OR: positionWhere,
        status: 'ACTIVE',
      },
      include: {
        skuCombo: {
          include: {
            classification: true,
            color: true,
            size: true,
            material: true,
          },
        },
        category: true,
      },
    });

    // 3. Compute SKUs map
    const skuMap = new Map<
      string,
      {
        compositeSku: string;
        quantity: number;
        classification: string | null;
        color: string | null;
        size: string | null;
        material: string | null;
        categoryName: string | null;
      }
    >();

    for (const txn of transactions) {
      const delta = txn.type === 'STOCK_IN' ? txn.quantity : -txn.quantity;

      if (!txn.skuComboId && !txn.categoryId) continue;
      const key = txn.skuComboId ?? `cat:${txn.categoryId}`;
      const existing = skuMap.get(key);

      if (existing) {
        existing.quantity += delta;
      } else {
        skuMap.set(key, {
          compositeSku: txn.skuCombo?.compositeSku ?? '',
          quantity: delta,
          classification: txn.skuCombo?.classification?.name ?? null,
          color: txn.skuCombo?.color?.name ?? null,
          size: txn.skuCombo?.size?.name ?? null,
          material: txn.skuCombo?.material?.name ?? null,
          categoryName: txn.category?.name ?? null,
        });
      }
    }

    const skus = Array.from(skuMap.values()).filter((s) => s.quantity > 0);
    const computedStock = skus.reduce((sum, s) => sum + s.quantity, 0);
    const finalStock = Math.max(0, computedStock);

    if (position.currentStock !== finalStock) {
      console.warn(
        `[Warehouse Sync Update] Position "${position.label ?? position.id}" stock mismatched! DB currentStock: ${position.currentStock}, ComputedStock: ${finalStock}. Resyncing DB value.`,
      );
    }

    // 4. Build update data
    const updateData: Record<string, unknown> = {
      currentStock: finalStock,
      skus: skus as any,
    };

    // 4a. Sync maxCapacity from matching storage zone (if different)
    if (zone && position.maxCapacity !== zone.maxCapacity) {
      console.warn(
        `[Warehouse Sync Update] Position "${position.label ?? position.id}" maxCapacity mismatched! DB: ${position.maxCapacity}, Zone: ${zone.maxCapacity}. Syncing to zone value.`,
      );
      updateData.maxCapacity = zone.maxCapacity;
    }

    // 4b. Update the DB cache
    await client.warehousePosition.update({
      where: { id: positionId },
      data: updateData,
    });
  }

  async syncLayoutPositionStock(positionLabel: string, tx?: any) {
    const client = tx ?? this.prisma;
    // Find the storage zone matching this position label
    const zone = await client.storageZone.findFirst({
      where: { name: positionLabel },
    });
    if (!zone) return;

    // Find the POSITION that matches this storage zone (by label within the zone's warehouse type)
    let position = await client.warehousePosition.findFirst({
      where: { label: positionLabel, isActive: true },
      select: { id: true },
    });

    // Fallback: case-insensitive matching
    if (!position) {
      const allPositions = await client.warehousePosition.findMany({
        where: { isActive: true },
        select: { id: true, label: true },
      });
      const matched = allPositions.find(
        (p: { id: string; label: string | null }) => p.label?.toLowerCase() === positionLabel.toLowerCase(),
      );
      if (matched) {
        position = { id: matched.id };
      }
    }

    if (position) {
      await this.syncWarehouseLayoutPosition(position.id, client);
    }
  }

  /**
   * Sync maxCapacity from storageZone to all matching warehouse positions.
   * Use this when a storage zone's capacity was updated but the corresponding
   * warehouse positions still have the old (often default 1) value.
   */
  async syncAllMaxCapacities(): Promise<{
    updated: number;
    total: number;
    details: Array<{ positionLabel: string; oldCapacity: number | null; newCapacity: number }>;
  }> {
    const positions = await this.prisma.warehousePosition.findMany({
      where: { isActive: true },
      select: { id: true, label: true, maxCapacity: true },
    });
    const zones = await this.prisma.storageZone.findMany({
      select: { name: true, maxCapacity: true },
    });
    const zoneMap = new Map<string, number>();
    for (const z of zones) {
      zoneMap.set(z.name.trim().toLowerCase(), z.maxCapacity);
    }

    const details: Array<{ positionLabel: string; oldCapacity: number | null; newCapacity: number }> = [];
    let updated = 0;

    for (const pos of positions) {
      if (!pos.label) continue;
      const zoneCapacity = zoneMap.get(pos.label.trim().toLowerCase());
      if (zoneCapacity === undefined) continue;
      if (pos.maxCapacity === zoneCapacity) continue;

      await this.prisma.warehousePosition.update({
        where: { id: pos.id },
        data: { maxCapacity: zoneCapacity },
      });
      details.push({
        positionLabel: pos.label,
        oldCapacity: pos.maxCapacity,
        newCapacity: zoneCapacity,
      });
      updated++;
    }

    return { updated, total: positions.length, details };
  }

  /**
   * Resync ALL warehouse positions — fixes any stale currentStock in DB.
   * Call once after deploy to clean up existing bad data.
   */
  async resyncAllPositions(): Promise<{ fixed: number; total: number }> {
    const positions = await this.prisma.warehousePosition.findMany({
      where: { isActive: true },
      select: { id: true, label: true, currentStock: true },
    });

    let fixed = 0;
    for (const pos of positions) {
      const before = pos.currentStock;
      await this.syncWarehouseLayoutPosition(pos.id);
      const after = await this.prisma.warehousePosition.findUnique({
        where: { id: pos.id },
        select: { currentStock: true },
      });
      if (after && after.currentStock !== before) {
        console.log(`[Resync] Fixed "${pos.label ?? pos.id}": ${before} → ${after.currentStock}`);
        fixed++;
      }
    }

    return { fixed, total: positions.length };
  }

  async toggleStorageLocation(id: string) {
    const position = await this.prisma.warehousePosition.findUnique({
      where: { id },
    });

    if (!position) {
      throw new NotFoundException('Vị trí không tồn tại');
    }

    // Nếu đang chứa hàng, không cho phép chuyển sang "không chứa hàng"
    if (position.isStorageLocation && position.currentStock > 0) {
      throw new BadRequestException(
        'Vị trí này đang chứa hàng hóa, vui lòng di chuyển hàng trước khi gán là vị trí không chứa hàng',
      );
    }

    return this.prisma.warehousePosition.update({
      where: { id },
      data: { isStorageLocation: !position.isStorageLocation },
    });
  }
}
