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
          include: { product: true },
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
      // Delete old positions
      await this.prisma.warehousePosition.deleteMany({
        where: { layoutId: id },
      });

      // Create new positions
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

  async deleteLayout(id: string) {
    const existing = await this.prisma.warehouseLayout.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Layout không tồn tại');
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
    const layout = await this.prisma.warehouseLayout.findUnique({ where: { id } });
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

  async assignProductToPosition(positionId: string, productId: string | null) {
    // Validate position exists
    const position = await this.prisma.warehousePosition.findUnique({
      where: { id: positionId },
    });

    if (!position) {
      throw new BadRequestException(
        'Vị trí không hợp lệ trong sơ đồ kho',
      );
    }

    // Validate product exists if assigning
    if (productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new NotFoundException('Sản phẩm không tồn tại');
      }
    }

    return this.prisma.warehousePosition.update({
      where: { id: positionId },
      data: { productId: productId ?? null },
      include: { product: true },
    });
  }

  async validatePosition(positionId: string): Promise<boolean> {
    const position = await this.prisma.warehousePosition.findUnique({
      where: { id: positionId },
    });
    return !!position;
  }

  async movePosition(id: string, targetRow: number, targetCol: number) {
    const position = await this.prisma.warehousePosition.findUnique({
      where: { id },
    });

    if (!position) {
      throw new NotFoundException('Vị trí không tồn tại');
    }

    // Find if there's a position at the target coordinates
    const targetPosition = await this.prisma.warehousePosition.findFirst({
      where: {
        layoutId: position.layoutId,
        row: targetRow,
        column: targetCol,
      },
    });

    if (targetPosition) {
      // Swap coordinates
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
    } else {
      // Move to empty cell
      const updated = await this.prisma.warehousePosition.update({
        where: { id },
        data: { row: targetRow, column: targetCol },
        include: { product: true },
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

    // Check for duplicate label in the same layout
    const duplicate = await this.prisma.warehousePosition.findFirst({
      where: {
        layoutId: position.layoutId,
        label: label,
        id: { not: id },
      },
    });

    if (duplicate) {
      throw new BadRequestException('Nhãn vị trí đã tồn tại trong sơ đồ kho');
    }

    return this.prisma.warehousePosition.update({
      where: { id },
      data: { label },
      include: { product: true },
    });
  }

  async toggleActive(id: string) {
    const position = await this.prisma.warehousePosition.findUnique({
      where: { id },
    });

    if (!position) {
      throw new NotFoundException('Vị trí không tồn tại');
    }

    // If deactivating, check if position has stock or product
    if (position.isActive) {
      if (position.currentStock > 0 || position.productId) {
        throw new BadRequestException(
          'Vị trí này đang chứa hàng hóa, vui lòng di chuyển hàng trước khi vô hiệu hóa',
        );
      }
    }

    return this.prisma.warehousePosition.update({
      where: { id },
      data: { isActive: !position.isActive },
      include: { product: true },
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

    return this.prisma.warehousePosition.update({
      where: { id },
      data: { maxCapacity },
      include: { product: true },
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

    if (position.layout.layoutMode === 'GRID' && (dto.x !== undefined || dto.y !== undefined)) {
      throw new ForbiddenException('Layout dạng GRID không cho phép kéo thả tự do');
    }

    return this.prisma.warehousePosition.update({
      where: { id },
      data: nextData,
      include: { product: true },
    });
  }

  async createPosition(dto: CreatePositionDto) {
    const layout = await this.prisma.warehouseLayout.findUnique({
      where: { id: dto.layoutId },
    });
    if (!layout) {
      throw new NotFoundException('Layout không tồn tại');
    }

    // Auto-assign next row/column based on existing positions
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

  async deletePosition(id: string, force?: boolean) {
    const position = await this.prisma.warehousePosition.findUnique({
      where: { id },
    });
    if (!position) {
      throw new NotFoundException('Vị trí không tồn tại');
    }

    if (!force && (position.currentStock > 0 || position.productId)) {
      throw new BadRequestException(
        'Vị trí đang chứa hàng hóa. Dùng force=true để xóa bất chấp.',
      );
    }

    await this.prisma.warehousePosition.delete({ where: { id } });
    return { success: true };
  }

  async getPositionSkus(id: string) {
    const position = await this.prisma.warehousePosition.findUnique({
      where: { id },
    });

    if (!position) {
      throw new NotFoundException('Vị trí không tồn tại');
    }

    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: { warehousePositionId: id },
      include: {
        skuCombo: true,
      },
    });

    // Group by skuComboId and sum quantities
    const skuMap = new Map<string, { skuComboId: string; compositeSku: string; quantity: number }>();

    for (const txn of transactions) {
      if (!txn.skuComboId || !txn.skuCombo) continue;
      const key = txn.skuComboId;
      const existing = skuMap.get(key);
      const delta = txn.type === 'STOCK_IN' ? txn.quantity : -txn.quantity;

      if (existing) {
        existing.quantity += delta;
      } else {
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

    if (layouts.length === 0) return [];

    return layouts.map((layout) => {
      const positions = layout.positions.map((pos) => {
        const skuMap = new Map<string, { compositeSku: string; quantity: number }>();

        for (const txn of pos.inventoryTransactions) {
          if (!txn.skuComboId || !txn.skuCombo) continue;
          const key = txn.skuComboId;
          const existing = skuMap.get(key);
          const delta = txn.type === 'STOCK_IN' ? txn.quantity : -txn.quantity;

          if (existing) {
            existing.quantity += delta;
          } else {
            skuMap.set(key, {
              compositeSku: txn.skuCombo.compositeSku,
              quantity: delta,
            });
          }
        }

        const skus = Array.from(skuMap.values()).filter((s) => s.quantity > 0);

        // Remove inventoryTransactions from response to keep it clean
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
}
