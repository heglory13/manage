import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { ActivityLogService, RECENT_LOG_KEYS } from './activity-log.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const METHOD_ACTION_MAP: Record<string, string> = {
  POST: 'CREATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

function getTableNameFromPath(path: string): string {
  const cleaned = path.replace(/^\/api\//, '').replace(/^\//, '');
  const segments = cleaned.split('/');
  const resource = segments[0] ?? '';

  const tableMap: Record<string, string> = {
    products: 'Product',
    inventory: 'InventoryTransaction',
    users: 'User',
    categories: 'Category',
    'input-declarations': 'InputDeclaration',
    'order-plans': 'OrderPlan',
    'storage-zones': 'StorageZone',
    stocktaking: 'StocktakingRecord',
    'saved-filters': 'SavedFilter',
    'preliminary-checks': 'PreliminaryCheck',
    warehouse: 'WarehouseLayout',
  };

  return tableMap[resource] ?? resource;
}

function getRecordIdFromPath(path: string): string {
  const segments = path.split('/').filter(Boolean);
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    if (segments[index].match(/^[0-9a-f-]{36}$/i)) {
      return segments[index];
    }
  }
  return '';
}

function sanitizeData(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const source = data as Record<string, unknown>;
  const skipKeys = new Set([
    'password',
    'refreshToken',
    'token',
    'id',
    'createdAt',
    'updatedAt',
    'imageUrl',
    'imageUrls',
    'metadata',
  ]);

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(source)) {
    if (skipKeys.has(key) || value === undefined) continue;

    if (value === null) {
      result[key] = null;
      continue;
    }

    if (Array.isArray(value)) {
      if (key === 'imageUrls') continue;
      result[key] = value;
      continue;
    }

    if (value instanceof Date) {
      result[key] = value.toISOString();
      continue;
    }

    if (typeof value === 'object') {
      const nested = sanitizeData(value);
      if (nested && Object.keys(nested).length > 0) {
        result[key] = nested;
      }
      continue;
    }

    result[key] = value;
  }

  return result;
}

@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  constructor(
    private readonly activityLogService: ActivityLogService,
    private readonly prisma: PrismaService,
  ) {}

  private async loadSnapshot(tableName: string, recordId: string) {
    if (!recordId) return null;

    switch (tableName) {
      case 'Product':
        return this.prisma.product.findUnique({
          where: { id: recordId },
          select: {
            categoryId: true,
            isDiscontinued: true,
            maxThreshold: true,
            minThreshold: true,
            name: true,
            price: true,
            sku: true,
            stock: true,
          },
        });
      case 'InventoryTransaction':
        return this.prisma.inventoryTransaction.findUnique({
          where: { id: recordId },
          select: {
            actualStockDate: true,
            categoryId: true,
            notes: true,
            productConditionId: true,
            purchasePrice: true,
            quantity: true,
            salePrice: true,
            skuComboId: true,
            status: true,
            storageZoneId: true,
            type: true,
            warehousePositionId: true,
            warehouseTypeId: true,
          },
        });
      case 'User':
        return this.prisma.user.findUnique({
          where: { id: recordId },
          select: {
            email: true,
            name: true,
            role: true,
          },
        });
      case 'Category':
        return this.prisma.category.findUnique({
          where: { id: recordId },
          select: { code: true, name: true },
        });
      case 'StorageZone':
        return this.prisma.storageZone.findUnique({
          where: { id: recordId },
          select: {
            currentStock: true,
            maxCapacity: true,
            name: true,
            warehouseTypeId: true,
          },
        });
      case 'OrderPlan':
        return this.prisma.orderPlan.findUnique({
          where: { id: recordId },
          select: {
            categoryId: true,
            customerName: true,
            customerPhone: true,
            expectedArrivalDate: true,
            note: true,
            quantity: true,
            status: true,
            type: true,
            warehouseTypeId: true,
          },
        });
      case 'PreliminaryCheck':
        return this.prisma.preliminaryCheck.findUnique({
          where: { id: recordId },
          select: {
            categoryId: true,
            note: true,
            quantity: true,
            status: true,
            warehouseTypeId: true,
          },
        });
      case 'WarehouseLayout':
        return this.prisma.warehouseLayout.findUnique({
          where: { id: recordId },
          select: {
            layoutMode: true,
            name: true,
          },
        });
      case 'SavedFilter':
        return this.prisma.savedFilter.findUnique({
          where: { id: recordId },
          select: {
            filters: true,
            name: true,
            pageKey: true,
          },
        });
      case 'StocktakingRecord':
        return this.prisma.stocktakingRecord.findUnique({
          where: { id: recordId },
          select: {
            cutoffTime: true,
            mode: true,
            status: true,
            submittedAt: true,
          },
        });
      default:
        return null;
    }
  }

  private isDuplicateLog(tableName: string, recordId: string, action: string): boolean {
    const key = `${tableName}:${recordId}:${action}`;
    const now = Date.now();
    const last = RECENT_LOG_KEYS.get(key);
    if (last && now - last < 5000) return true;
    RECENT_LOG_KEYS.set(key, now);
    if (RECENT_LOG_KEYS.size > 1000) {
      const cutoff = now - 10000;
      for (const [k, v] of RECENT_LOG_KEYS) {
        if (v < cutoff) RECENT_LOG_KEYS.delete(k);
      }
    }
    return false;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    if (!['POST', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const path = request.route?.path ?? request.url ?? '';
    if (path.includes('/auth/') || path.includes('/activity-logs')) {
      return next.handle();
    }

    const action = METHOD_ACTION_MAP[method] ?? method;
    const tableName = getTableNameFromPath(request.url ?? '');
    const recordIdFromPath = getRecordIdFromPath(request.url ?? '');
    const user = request.user;

    if (!user) {
      return next.handle();
    }

    const userId = user.userId ?? '';
    const userName = user.name ?? user.email ?? '';

    return next.handle().pipe(
      tap((responseData) => {
        (async () => {
          try {
            const resp = responseData as Record<string, unknown>;
            const transactions = resp?.transactions;

            if (Array.isArray(transactions) && transactions.length > 0) {
              const txLogs = transactions.map(async (tx: unknown) => {
                const txRecord = tx as Record<string, unknown>;
                const txId = String(txRecord?.id ?? '');
                if (!txId) return;
                if (this.isDuplicateLog(tableName, txId, action)) return;

                const oldSnapshot = sanitizeData(
                  action === 'CREATE' ? null : await this.loadSnapshot(tableName, recordIdFromPath),
                );
                const nextSnapshot =
                  action === 'DELETE'
                    ? null
                    : sanitizeData(await this.loadSnapshot(tableName, txId));
                await this.activityLogService.create({
                  userId,
                  userName,
                  action,
                  tableName,
                  recordId: txId,
                  oldData: oldSnapshot,
                  newData: nextSnapshot ?? sanitizeData(tx),
                });
                console.log('[ActivityLog Interceptor] Batch log created:', { action, tableName, recordId: txId });
              });
              await Promise.all(txLogs);
              return;
            }

            const responseRecordId =
              resp?.id as string | undefined;
            const requestRecordId =
              (request.body as Record<string, unknown>)?.id as string | undefined;
            const recordId = String(
              recordIdFromPath || responseRecordId || requestRecordId || '',
            );

            if (!recordId || this.isDuplicateLog(tableName, recordId, action)) return;

            const oldSnapshot = sanitizeData(
              action === 'CREATE'
                ? null
                : await this.loadSnapshot(tableName, recordIdFromPath),
            );

            const nextSnapshot =
              action === 'DELETE'
                ? null
                : sanitizeData(await this.loadSnapshot(tableName, recordId));

            let newData: Record<string, unknown> | null = nextSnapshot;
            if (newData === null) {
              newData =
                action === 'DELETE'
                  ? null
                  : (sanitizeData(responseData) ?? sanitizeData(request.body));
            }

            // Merge _-prefixed context fields from request body into newData (e.g., _storageZoneId -> storageZoneId)
            if (newData && request.body && typeof request.body === 'object') {
              for (const [key, value] of Object.entries(request.body as Record<string, unknown>)) {
                if (key.startsWith('_') && value !== undefined) {
                  (newData as Record<string, unknown>)[key.slice(1)] = value;
                }
              }
            }

            await this.activityLogService.create({
              userId,
              userName,
              action,
              tableName,
              recordId,
              oldData: oldSnapshot,
              newData,
            });
            console.log('[ActivityLog Interceptor] Log created:', { action, tableName, recordId });
          } catch (e) {
            console.error('[ActivityLog Interceptor] Failed:', e instanceof Error ? e.message : e);
          }
        })();
      }),
    );
  }
}
