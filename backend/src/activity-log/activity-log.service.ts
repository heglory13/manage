import { Injectable } from '@nestjs/common';
import { ActivityLog, Prisma } from '@prisma/client/index';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ActivityLogCreateData {
  userId: string;
  userName: string;
  action: string;
  tableName: string;
  recordId: string;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  snapshot?: Record<string, unknown> | null;
}

export interface ActivityLogQuery {
  userId?: string;
  userName?: string;
  action?: string;
  tableName?: string;
  keyword?: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  startDate?: string;
  endDate?: string;
  page?: number | string;
  limit?: number | string;
}

export interface ActivityLogChange {
  key: string;
  label: string;
  oldValue: string | null;
  newValue: string | null;
  changed: boolean;
}

export interface ActivityLogListItem extends ActivityLog {
  recordLabel: string;
  tableLabel: string;
  changes: ActivityLogChange[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type ResolverMaps = {
  categories: Map<string, string>;
  storageZones: Map<string, string>;
  warehousePositions: Map<string, string>;
  skuCombos: Map<string, string>;
  warehouseTypes: Map<string, string>;
  users: Map<string, string>;
  productConditions: Map<string, string>;
  classifications: Map<string, string>;
  colors: Map<string, string>;
  sizes: Map<string, string>;
  materials: Map<string, string>;
  products: Map<string, string>;
  orderPlans: Map<string, string>;
  preliminaryChecks: Map<string, string>;
  stocktakingRecords: Map<string, string>;
  warehouseLayouts: Map<string, string>;
  savedFilters: Map<string, string>;
  activityLogs: Map<string, string>;
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Tạo mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Xóa',
};

const TABLE_LABELS: Record<string, string> = {
  Product: 'Sản phẩm',
  InventoryTransaction: 'Giao dịch kho',
  User: 'Người dùng',
  Category: 'Danh mục',
  InputDeclaration: 'Khai báo Input',
  StorageZone: 'Khu vực / Thùng',
  StocktakingRecord: 'Kiểm kê',
  SavedFilter: 'Bộ lọc đã lưu',
  PreliminaryCheck: 'Kiểm sơ bộ',
  WarehouseLayout: 'Sơ đồ kho',
  WarehousePosition: 'Vị trí kho',
  Classification: 'Phân loại',
  Color: 'Màu sắc',
  Size: 'Kích thước',
  Material: 'Chất liệu',
  ProductCondition: 'Tình trạng hàng',
  WarehouseType: 'Loại kho',
  SkuCombo: 'SKU tổng hợp',
  OrderPlan: 'Kế hoạch đặt hàng',
  ActivityLog: 'Nhật ký hoạt động',
};

const FIELD_LABELS: Record<string, string> = {
  action: 'Hành động',
  actualStockDate: 'Ngày nhập thực tế',
  categoryId: 'Danh mục',
  categoryName: 'Danh mục',
  classificationId: 'Phân loại',
  code: 'Mã',
  colorId: 'Màu sắc',
  compositeSku: 'SKU tổng hợp',
  currentStock: 'Tồn kho hiện tại',
  customerName: 'Khách hàng',
  customerPhone: 'Số điện thoại',
  cutoffTime: 'Thời gian chốt',
  email: 'Email',
  expectedArrivalDate: 'Ngày dự kiến có hàng',
  filters: 'Bộ lọc',
  isActive: 'Kích hoạt',
  isDiscontinued: 'Ngừng sản xuất',
  label: 'Tên vị trí',
  layoutMode: 'Chế độ sơ đồ',
  materialId: 'Chất liệu',
  maxCapacity: 'Sức chứa tối đa',
  maxThreshold: 'Ngưỡng tối đa',
  minThreshold: 'Ngưỡng tối thiểu',
  mode: 'Phạm vi',
  name: 'Tên',
  note: 'Ghi chú',
  notes: 'Ghi chú',
  pageKey: 'Màn hình',
  price: 'Giá',
  productConditionId: 'Tình trạng hàng',
  purchasePrice: 'Giá nhập',
  quantity: 'Số lượng',
  recordId: 'Bản ghi',
  role: 'Vai trò',
  salePrice: 'Giá bán',
  sizeId: 'Kích thước',
  sku: 'SKU',
  skuComboId: 'SKU',
  status: 'Trạng thái',
  stock: 'Tồn kho',
  storageZoneId: 'Khu vực / Thùng',
  submittedAt: 'Thời gian nộp',
  tableName: 'Module',
  type: 'Loại',
  userId: 'Nhân viên',
  warehousePositionId: 'Vị trí kho',
  warehouseTypeId: 'Loại kho',
};

const HIDDEN_KEYS = new Set([
  'createdAt',
  'updatedAt',
  'password',
  'refreshToken',
  'token',
  'imageUrl',
  'imageUrls',
  'internalFlags',
  'metadata',
  'recordId',
  'id',
  'oldData',
  'newData',
]);

function isUuid(value: string) {
  return /^[0-9a-f-]{36}$/i.test(value);
}

function toTitleCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getFieldLabel(key: string) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  if (key.endsWith('Id')) {
    return toTitleCase(key.slice(0, -2));
  }
  return toTitleCase(key);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function normalizeAction(action?: string) {
  const raw = action?.trim();
  if (!raw) return undefined;
  const upper = raw.toUpperCase();
  if (ACTION_LABELS[upper]) return upper;
  const byLabel = Object.entries(ACTION_LABELS).find(
    ([, label]) => label.toLowerCase() === raw.toLowerCase(),
  );
  return byLabel?.[0];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function collectResolverIds(
  source: unknown,
  collector: Record<keyof ResolverMaps, Set<string>>,
) {
  if (Array.isArray(source)) {
    source.forEach((item) => collectResolverIds(item, collector));
    return;
  }

  const record = asRecord(source);
  if (!record) return;

  for (const [key, rawValue] of Object.entries(record)) {
    if (Array.isArray(rawValue) || typeof rawValue === 'object') {
      collectResolverIds(rawValue, collector);
      continue;
    }

    if (typeof rawValue !== 'string' || !isUuid(rawValue)) continue;

    switch (key) {
      case 'categoryId':
        collector.categories.add(rawValue);
        break;
      case 'storageZoneId':
        collector.storageZones.add(rawValue);
        break;
      case 'warehousePositionId':
        collector.warehousePositions.add(rawValue);
        break;
      case 'skuComboId':
        collector.skuCombos.add(rawValue);
        break;
      case 'warehouseTypeId':
        collector.warehouseTypes.add(rawValue);
        break;
      case 'userId':
      case 'createdBy':
        collector.users.add(rawValue);
        break;
      case 'productConditionId':
        collector.productConditions.add(rawValue);
        break;
      case 'classificationId':
        collector.classifications.add(rawValue);
        break;
      case 'colorId':
        collector.colors.add(rawValue);
        break;
      case 'sizeId':
        collector.sizes.add(rawValue);
        break;
      case 'materialId':
        collector.materials.add(rawValue);
        break;
      case 'productId':
        collector.products.add(rawValue);
        break;
      case 'orderPlanId':
        collector.orderPlans.add(rawValue);
        break;
      case 'preliminaryCheckId':
        collector.preliminaryChecks.add(rawValue);
        break;
      case 'stocktakingRecordId':
        collector.stocktakingRecords.add(rawValue);
        break;
      case 'layoutId':
        collector.warehouseLayouts.add(rawValue);
        break;
      case 'savedFilterId':
        collector.savedFilters.add(rawValue);
        break;
      case 'activityLogId':
        collector.activityLogs.add(rawValue);
        break;
      default:
        break;
    }
  }
}

function buildEmptyResolvers(): ResolverMaps {
  return {
    categories: new Map(),
    storageZones: new Map(),
    warehousePositions: new Map(),
    skuCombos: new Map(),
    warehouseTypes: new Map(),
    users: new Map(),
    productConditions: new Map(),
    classifications: new Map(),
    colors: new Map(),
    sizes: new Map(),
    materials: new Map(),
    products: new Map(),
    orderPlans: new Map(),
    preliminaryChecks: new Map(),
    stocktakingRecords: new Map(),
    warehouseLayouts: new Map(),
    savedFilters: new Map(),
    activityLogs: new Map(),
  };
}

function resolveIdLabel(
  key: string,
  id: string,
  resolvers: ResolverMaps,
): string {
  const getOrDeleted = (map: Map<string, string>) =>
    map.get(id) ?? `[Đã xóa] ${id}`;

  switch (key) {
    case 'categoryId':
      return getOrDeleted(resolvers.categories);
    case 'storageZoneId':
      return getOrDeleted(resolvers.storageZones);
    case 'warehousePositionId':
      return getOrDeleted(resolvers.warehousePositions);
    case 'skuComboId':
      return getOrDeleted(resolvers.skuCombos);
    case 'warehouseTypeId':
      return getOrDeleted(resolvers.warehouseTypes);
    case 'userId':
    case 'createdBy':
      return getOrDeleted(resolvers.users);
    case 'productConditionId':
      return getOrDeleted(resolvers.productConditions);
    case 'classificationId':
      return getOrDeleted(resolvers.classifications);
    case 'colorId':
      return getOrDeleted(resolvers.colors);
    case 'sizeId':
      return getOrDeleted(resolvers.sizes);
    case 'materialId':
      return getOrDeleted(resolvers.materials);
    case 'productId':
      return getOrDeleted(resolvers.products);
    case 'layoutId':
      return getOrDeleted(resolvers.warehouseLayouts);
    default:
      return `[Đã xóa] ${id}`;
  }
}

function formatPrimitiveValue(
  key: string,
  value: unknown,
  resolvers: ResolverMaps,
): string | null {
  if (value === null || value === undefined || value === '') return null;

  if (Array.isArray(value)) {
    const items = value
      .map((item) => formatPrimitiveValue(key, item, resolvers))
      .filter(Boolean);
    return items.length > 0 ? items.join(', ') : null;
  }

  if (typeof value === 'boolean') {
    return value ? 'Có' : 'Không';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }

  if (typeof value === 'string') {
    if (isUuid(value) && key.endsWith('Id')) {
      return resolveIdLabel(key, value, resolvers);
    }

    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return formatDateTime(value);
    }

    return value;
  }

  const record = asRecord(value);
  if (record) {
    const fragments = Object.entries(record)
      .filter(([childKey]) => !HIDDEN_KEYS.has(childKey))
      .map(([childKey, childValue]) =>
        `${getFieldLabel(childKey)}: ${formatPrimitiveValue(childKey, childValue, resolvers) ?? '-'}`,
      );
    return fragments.length > 0 ? fragments.join(' | ') : null;
  }

  return String(value);
}

function formatActivityLogChanges(
  oldData: unknown,
  newData: unknown,
  resolvers: ResolverMaps,
): ActivityLogChange[] {
  const oldRecord = asRecord(oldData) ?? {};
  const newRecord = asRecord(newData) ?? {};
  const keys = new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)]);

  return Array.from(keys)
    .filter((key) => !HIDDEN_KEYS.has(key))
    .map((key) => {
      const oldValue = formatPrimitiveValue(key, oldRecord[key], resolvers);
      const newValue = formatPrimitiveValue(key, newRecord[key], resolvers);
      const changed = oldValue !== newValue;

      return {
        key,
        label: getFieldLabel(key),
        oldValue,
        newValue,
        changed,
      };
    })
    .filter((item) => item.oldValue !== null || item.newValue !== null);
}

function convertDecimalsToNumbers(obj: unknown): unknown {
  if (obj instanceof Prisma.Decimal) return obj.toNumber();
  if (Array.isArray(obj)) return obj.map(convertDecimalsToNumbers);
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = convertDecimalsToNumbers(val);
    }
    return result;
  }
  return obj;
}

export const RECENT_LOG_KEYS = new Map<string, number>();

@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  async create(logData: ActivityLogCreateData): Promise<ActivityLog> {
    const oldData = logData.oldData ? convertDecimalsToNumbers(logData.oldData) : null;
    const newData = logData.newData ?? logData.snapshot;
    const finalNewData = newData ? convertDecimalsToNumbers(newData) : null;

    const log = await this.prisma.activityLog.create({
      data: {
        userId: logData.userId,
        userName: logData.userName,
        action: logData.action,
        tableName: logData.tableName,
        recordId: logData.recordId,
        oldData: (oldData as object) ?? undefined,
        newData: (finalNewData as object) ?? undefined,
      },
    });

    const key = `${logData.tableName}:${logData.recordId}:${logData.action}`;
    RECENT_LOG_KEYS.set(key, Date.now());
    if (RECENT_LOG_KEYS.size > 1000) {
      const cutoff = Date.now() - 10000;
      for (const [k, v] of RECENT_LOG_KEYS) {
        if (v < cutoff) RECENT_LOG_KEYS.delete(k);
      }
    }

    return log;
  }

  private async buildResolverMaps(logs: ActivityLog[]): Promise<ResolverMaps> {
    const resolvers = buildEmptyResolvers();
    const idCollector = Object.fromEntries(
      Object.keys(resolvers).map((key) => [key, new Set<string>()]),
    ) as Record<keyof ResolverMaps, Set<string>>;

    for (const log of logs) {
      collectResolverIds(log.oldData, idCollector);
      collectResolverIds(log.newData, idCollector);
      if (isUuid(log.recordId)) {
        switch (log.tableName) {
          case 'Product':
            idCollector.products.add(log.recordId);
            break;
          case 'Category':
            idCollector.categories.add(log.recordId);
            break;
          case 'StorageZone':
            idCollector.storageZones.add(log.recordId);
            break;
          case 'WarehousePosition':
            idCollector.warehousePositions.add(log.recordId);
            break;
          case 'SkuCombo':
            idCollector.skuCombos.add(log.recordId);
            break;
          case 'WarehouseType':
            idCollector.warehouseTypes.add(log.recordId);
            break;
          case 'User':
            idCollector.users.add(log.recordId);
            break;
          case 'ProductCondition':
            idCollector.productConditions.add(log.recordId);
            break;
          case 'Classification':
            idCollector.classifications.add(log.recordId);
            break;
          case 'Color':
            idCollector.colors.add(log.recordId);
            break;
          case 'Size':
            idCollector.sizes.add(log.recordId);
            break;
          case 'Material':
            idCollector.materials.add(log.recordId);
            break;
          case 'OrderPlan':
            idCollector.orderPlans.add(log.recordId);
            break;
          case 'PreliminaryCheck':
            idCollector.preliminaryChecks.add(log.recordId);
            break;
          case 'StocktakingRecord':
            idCollector.stocktakingRecords.add(log.recordId);
            break;
          case 'WarehouseLayout':
            idCollector.warehouseLayouts.add(log.recordId);
            break;
          case 'SavedFilter':
            idCollector.savedFilters.add(log.recordId);
            break;
          default:
            break;
        }
      }
    }

    const [
      categories,
      storageZones,
      warehousePositions,
      skuCombos,
      warehouseTypes,
      users,
      productConditions,
      classifications,
      colors,
      sizes,
      materials,
      products,
      orderPlans,
      preliminaryChecks,
      stocktakingRecords,
      warehouseLayouts,
      savedFilters,
    ] = await Promise.all([
      this.prisma.category.findMany({
        where: { id: { in: Array.from(idCollector.categories) } },
        select: { id: true, name: true },
      }),
      this.prisma.storageZone.findMany({
        where: { id: { in: Array.from(idCollector.storageZones) } },
        select: { id: true, name: true },
      }),
      this.prisma.warehousePosition.findMany({
        where: { id: { in: Array.from(idCollector.warehousePositions) } },
        select: { id: true, label: true },
      }),
      this.prisma.skuCombo.findMany({
        where: { id: { in: Array.from(idCollector.skuCombos) } },
        select: {
          id: true,
          compositeSku: true,
          classification: { select: { name: true } },
          color: { select: { name: true } },
          size: { select: { name: true } },
          material: { select: { name: true } },
        },
      }),
      this.prisma.warehouseType.findMany({
        where: { id: { in: Array.from(idCollector.warehouseTypes) } },
        select: { id: true, name: true },
      }),
      this.prisma.user.findMany({
        where: { id: { in: Array.from(idCollector.users) } },
        select: { id: true, name: true },
      }),
      this.prisma.productCondition.findMany({
        where: { id: { in: Array.from(idCollector.productConditions) } },
        select: { id: true, name: true },
      }),
      this.prisma.classification.findMany({
        where: { id: { in: Array.from(idCollector.classifications) } },
        select: { id: true, name: true },
      }),
      this.prisma.color.findMany({
        where: { id: { in: Array.from(idCollector.colors) } },
        select: { id: true, name: true },
      }),
      this.prisma.size.findMany({
        where: { id: { in: Array.from(idCollector.sizes) } },
        select: { id: true, name: true },
      }),
      this.prisma.material.findMany({
        where: { id: { in: Array.from(idCollector.materials) } },
        select: { id: true, name: true },
      }),
      this.prisma.product.findMany({
        where: { id: { in: Array.from(idCollector.products) } },
        select: { id: true, name: true, sku: true },
      }),
      this.prisma.orderPlan.findMany({
        where: { id: { in: Array.from(idCollector.orderPlans) } },
        select: { id: true, customerName: true, category: { select: { name: true } } },
      }),
      this.prisma.preliminaryCheck.findMany({
        where: { id: { in: Array.from(idCollector.preliminaryChecks) } },
        select: { id: true, category: { select: { name: true } }, quantity: true },
      }),
      this.prisma.stocktakingRecord.findMany({
        where: { id: { in: Array.from(idCollector.stocktakingRecords) } },
        select: { id: true, mode: true, status: true },
      }),
      this.prisma.warehouseLayout.findMany({
        where: { id: { in: Array.from(idCollector.warehouseLayouts) } },
        select: { id: true, name: true },
      }),
      this.prisma.savedFilter.findMany({
        where: { id: { in: Array.from(idCollector.savedFilters) } },
        select: { id: true, name: true },
      }),
    ]);

    categories.forEach((item) => resolvers.categories.set(item.id, item.name));
    storageZones.forEach((item) =>
      resolvers.storageZones.set(item.id, item.name),
    );
    warehousePositions.forEach((item) =>
      resolvers.warehousePositions.set(item.id, item.label ?? item.id),
    );
    skuCombos.forEach((item) => {
      const productName = [
        item.classification?.name,
        item.color?.name,
        item.size?.name,
        item.material?.name,
      ]
        .filter(Boolean)
        .join(' - ');
      resolvers.skuCombos.set(
        item.id,
        productName ? `${item.compositeSku} - ${productName}` : item.compositeSku,
      );
    });
    warehouseTypes.forEach((item) =>
      resolvers.warehouseTypes.set(item.id, item.name),
    );
    users.forEach((item) => resolvers.users.set(item.id, item.name));
    productConditions.forEach((item) =>
      resolvers.productConditions.set(item.id, item.name),
    );
    classifications.forEach((item) =>
      resolvers.classifications.set(item.id, item.name),
    );
    colors.forEach((item) => resolvers.colors.set(item.id, item.name));
    sizes.forEach((item) => resolvers.sizes.set(item.id, item.name));
    materials.forEach((item) => resolvers.materials.set(item.id, item.name));
    products.forEach((item) =>
      resolvers.products.set(item.id, `${item.sku} - ${item.name}`),
    );
    orderPlans.forEach((item) =>
      resolvers.orderPlans.set(
        item.id,
        item.customerName || item.category?.name || item.id,
      ),
    );
    preliminaryChecks.forEach((item) =>
      resolvers.preliminaryChecks.set(
        item.id,
        `${item.category?.name || 'Kiểm sơ bộ'} - SL ${item.quantity}`,
      ),
    );
    stocktakingRecords.forEach((item) =>
      resolvers.stocktakingRecords.set(item.id, `${item.mode} - ${item.status}`),
    );
    warehouseLayouts.forEach((item) =>
      resolvers.warehouseLayouts.set(item.id, item.name),
    );
    savedFilters.forEach((item) =>
      resolvers.savedFilters.set(item.id, item.name),
    );

    return resolvers;
  }

  private extractReceiptLabel(newData: unknown): string | null {
    if (!newData || typeof newData !== 'object') return null;
    const data = newData as Record<string, unknown>;
    const receiptGroupId = data.receiptGroupId as string | undefined;
    if (receiptGroupId) {
      const prefix = data.type === 'STOCK_OUT' ? 'PXK-' : 'PNK-';
      return prefix + receiptGroupId.slice(-6).toUpperCase();
    }
    const notes = data.notes as string | undefined;
    if (notes) {
      const match = String(notes).match(/\[RECEIPT_GROUP:(\w+-\d+-\w+)\]/);
      if (match) {
        const prefix = data.type === 'STOCK_OUT' ? 'PXK-' : 'PNK-';
        return prefix + match[1].slice(-6).toUpperCase();
      }
    }
    return null;
  }

  private buildRecordLabel(log: ActivityLog, resolvers: ResolverMaps) {
    if (!isUuid(log.recordId)) return log.recordId || '-';

    const getOrFallback = (map: Map<string, string>) =>
      map.get(log.recordId) ?? `[Đã xóa] ${log.recordId}`;

    switch (log.tableName) {
      case 'InventoryTransaction': {
        const receiptLabel = this.extractReceiptLabel(log.newData);
        if (receiptLabel) return receiptLabel;
        const typeLabel = (log.newData as Record<string, unknown> | null)?.type === 'STOCK_OUT' ? 'PXK' : 'PNK';
        return `${typeLabel}-${log.recordId.slice(0, 8).toUpperCase()}`;
      }
      case 'Product':
        return getOrFallback(resolvers.products);
      case 'Category':
        return getOrFallback(resolvers.categories);
      case 'StorageZone':
        return getOrFallback(resolvers.storageZones);
      case 'WarehousePosition':
        return getOrFallback(resolvers.warehousePositions);
      case 'SkuCombo':
        return getOrFallback(resolvers.skuCombos);
      case 'WarehouseType':
        return getOrFallback(resolvers.warehouseTypes);
      case 'User':
        return getOrFallback(resolvers.users);
      case 'OrderPlan':
        return getOrFallback(resolvers.orderPlans);
      case 'PreliminaryCheck':
        return getOrFallback(resolvers.preliminaryChecks);
      case 'StocktakingRecord':
        return getOrFallback(resolvers.stocktakingRecords);
      case 'WarehouseLayout':
        return getOrFallback(resolvers.warehouseLayouts);
      case 'SavedFilter':
        return getOrFallback(resolvers.savedFilters);
      default:
        return log.recordId;
    }
  }

  async findAll(
    query: ActivityLogQuery,
  ): Promise<PaginatedResponse<ActivityLogListItem>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(200, Number(query.limit) || 20));
    const skip = (page - 1) * limit;
    const dateFrom = query.dateFrom ?? query.startDate ?? query.date;
    const dateTo = query.dateTo ?? query.endDate ?? query.date;
    const whereAnd: Prisma.ActivityLogWhereInput[] = [];

    if (query.userId?.trim()) {
      const ids = query.userId
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (ids.length === 1) {
        whereAnd.push({ userId: ids[0] });
      } else if (ids.length > 1) {
        whereAnd.push({ userId: { in: ids } });
      }
    }
    if (query.userName?.trim()) {
      whereAnd.push({ userName: { contains: query.userName.trim() } });
    }
    if (query.action?.trim()) {
      const rawActions = query.action
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const normalizedActions = rawActions
        .map((a) => normalizeAction(a))
        .filter((a): a is string => !!a);
      if (normalizedActions.length === 1) {
        whereAnd.push({ action: normalizedActions[0] });
      } else if (normalizedActions.length > 1) {
        whereAnd.push({ action: { in: normalizedActions } });
      }
    }
    if (query.tableName?.trim()) {
      const tables = query.tableName
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      whereAnd.push(
        tables.length > 1
          ? { tableName: { in: tables } }
          : { tableName: tables[0] },
      );
    }
    if (query.keyword?.trim()) {
      const keyword = query.keyword.trim();
      const matchedAction = normalizeAction(keyword);
      const matchedTable = Object.entries(TABLE_LABELS).find(
        ([, label]) => label.toLowerCase().includes(keyword.toLowerCase()),
      )?.[0];

      const keywordConditions: Prisma.ActivityLogWhereInput[] = [
        { userName: { contains: keyword } },
        { tableName: { contains: keyword } },
        { recordId: { contains: keyword } },
        ...(matchedAction ? [{ action: matchedAction }] : []),
        ...(matchedTable ? [{ tableName: matchedTable }] : []),
      ];

      keywordConditions.push({
        tableName: 'InventoryTransaction',
        newData: { path: 'notes', string_contains: keyword },
      });

      keywordConditions.push({
        tableName: 'InventoryTransaction',
        newData: { path: 'receiptGroupId', string_contains: keyword },
      });

      whereAnd.push({
        OR: keywordConditions,
      });
    }
    if (dateFrom || dateTo) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (dateFrom) {
        createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        createdAt.lte = toDate;
      }
      whereAnd.push({ createdAt });
    }

    const where: Prisma.ActivityLogWhereInput =
      whereAnd.length > 0 ? { AND: whereAnd } : {};

    const [data, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    const resolvers = await this.buildResolverMaps(data);
    const enriched: ActivityLogListItem[] = data.map((log) => ({
      ...log,
      tableLabel: TABLE_LABELS[log.tableName] ?? log.tableName,
      recordLabel: this.buildRecordLabel(log, resolvers),
      changes: formatActivityLogChanges(log.oldData, log.newData, resolvers),
    }));

    return {
      data: enriched,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }
}
