import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { ActivityLogService } from './activity-log.service.js';

// Map HTTP methods to action names
const METHOD_ACTION_MAP: Record<string, string> = {
  POST: 'CREATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

// Map route paths to table names
function getTableNameFromPath(path: string): string {
  // Remove /api prefix and extract the resource name
  const cleaned = path.replace(/^\/api\//, '').replace(/^\//, '');
  const segments = cleaned.split('/');
  const resource = segments[0] ?? '';

  const TABLE_MAP: Record<string, string> = {
    products: 'Product',
    inventory: 'InventoryTransaction',
    users: 'User',
    categories: 'Category',
    'input-declarations': 'InputDeclaration',
    'storage-zones': 'StorageZone',
    stocktaking: 'StocktakingRecord',
    'saved-filters': 'SavedFilter',
    'preliminary-checks': 'PreliminaryCheck',
    warehouse: 'WarehouseLayout',
  };

  return TABLE_MAP[resource] ?? resource;
}

function getRecordIdFromPath(path: string): string {
  const segments = path.split('/').filter(Boolean);
  // Look for UUID-like segments
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i].match(/^[0-9a-f-]{36}$/i)) {
      return segments[i];
    }
  }
  return '';
}

@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  constructor(private readonly activityLogService: ActivityLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only log mutations
    if (!['POST', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    // Skip auth routes and activity-log routes
    const path = request.route?.path ?? request.url ?? '';
    if (path.includes('/auth/') || path.includes('/activity-logs')) {
      return next.handle();
    }

    const action = METHOD_ACTION_MAP[method] ?? method;
    const tableName = getTableNameFromPath(request.url ?? '');
    const recordId = getRecordIdFromPath(request.url ?? '');
    const user = request.user;

    if (!user) {
      return next.handle();
    }

    const userId = user.userId ?? '';
    const userName = user.name ?? user.email ?? '';

    return next.handle().pipe(
      tap((responseData) => {
        // Fire-and-forget: don't await
        const newData = action === 'DELETE' ? null : (responseData as Record<string, unknown>);
        const logRecordId = recordId || (responseData as Record<string, unknown>)?.id as string || '';

        this.activityLogService
          .create({
            userId,
            userName,
            action,
            tableName,
            recordId: String(logRecordId),
            oldData: null,
            newData: newData as Record<string, unknown> | null,
          })
          .catch(() => {
            // Silently ignore logging errors
          });
      }),
    );
  }
}
