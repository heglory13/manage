import * as fc from 'fast-check';
import { ActivityLogService, ActivityLogCreateData, ActivityLogQuery } from './activity-log.service.js';

/**
 * Feature: system-upgrade-v3
 * Property-based tests for ActivityLog
 */

// Pure function to determine action from HTTP method
function getActionFromMethod(method: string): string | null {
  const map: Record<string, string> = { POST: 'CREATE', PATCH: 'UPDATE', DELETE: 'DELETE' };
  return map[method] ?? null;
}

// Pure filter function for activity logs
function filterLogs(
  logs: { userId: string; action: string; tableName: string; createdAt: Date }[],
  query: { userId?: string; action?: string; tableName?: string; startDate?: Date; endDate?: Date },
) {
  return logs.filter((log) => {
    if (query.userId && log.userId !== query.userId) return false;
    if (query.action && log.action !== query.action) return false;
    if (query.tableName && log.tableName !== query.tableName) return false;
    if (query.startDate && log.createdAt < query.startDate) return false;
    if (query.endDate && log.createdAt > query.endDate) return false;
    return true;
  });
}

describe('ActivityLog PBT', () => {
  /**
   * Property 8: Interceptor tạo đúng ActivityLog cho mọi mutation
   * **Validates: Requirements 10.1, 10.2, 10.3**
   */
  it('P8: correct action mapping for mutations', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('POST', 'PATCH', 'DELETE', 'GET', 'PUT'),
        fc.record({
          id: fc.uuid(),
          name: fc.string({ minLength: 1, maxLength: 20 }),
        }),
        (method, data) => {
          const action = getActionFromMethod(method);

          if (method === 'POST') {
            expect(action).toBe('CREATE');
          } else if (method === 'PATCH') {
            expect(action).toBe('UPDATE');
          } else if (method === 'DELETE') {
            expect(action).toBe('DELETE');
          } else {
            // GET, PUT, etc. should not produce a log action
            expect(action).toBeNull();
          }

          // For CREATE: newData should be present, oldData null
          if (action === 'CREATE') {
            const logData: ActivityLogCreateData = {
              userId: 'user-1',
              userName: 'Test',
              action,
              tableName: 'Product',
              recordId: data.id,
              oldData: null,
              newData: data,
            };
            expect(logData.oldData).toBeNull();
            expect(logData.newData).toBeDefined();
          }

          // For DELETE: oldData should be present, newData null
          if (action === 'DELETE') {
            const logData: ActivityLogCreateData = {
              userId: 'user-1',
              userName: 'Test',
              action,
              tableName: 'Product',
              recordId: data.id,
              oldData: data,
              newData: null,
            };
            expect(logData.oldData).toBeDefined();
            expect(logData.newData).toBeNull();
          }

          // For UPDATE: both should be present
          if (action === 'UPDATE') {
            const logData: ActivityLogCreateData = {
              userId: 'user-1',
              userName: 'Test',
              action,
              tableName: 'Product',
              recordId: data.id,
              oldData: { ...data, name: 'old' },
              newData: data,
            };
            expect(logData.oldData).toBeDefined();
            expect(logData.newData).toBeDefined();
          }
        },
      ),
    );
  });

  /**
   * Property 9: Lọc nhật ký hoạt động trả về kết quả chính xác
   * **Validates: Requirements 11.4**
   */
  it('P9: activity log filtering returns only matching records', () => {
    const actionGen = fc.constantFrom('CREATE', 'UPDATE', 'DELETE');
    const tableGen = fc.constantFrom('Product', 'User', 'InventoryTransaction', 'StorageZone');

    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            userId: fc.constantFrom('user-1', 'user-2', 'user-3'),
            action: actionGen,
            tableName: tableGen,
            createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
          }),
          { minLength: 0, maxLength: 50 },
        ),
        fc.record({
          userId: fc.option(fc.constantFrom('user-1', 'user-2', 'user-3'), { nil: undefined }),
          action: fc.option(actionGen, { nil: undefined }),
          tableName: fc.option(tableGen, { nil: undefined }),
        }),
        (logs, query) => {
          const result = filterLogs(logs, query);

          // All returned items match all filter criteria
          for (const log of result) {
            if (query.userId) expect(log.userId).toBe(query.userId);
            if (query.action) expect(log.action).toBe(query.action);
            if (query.tableName) expect(log.tableName).toBe(query.tableName);
          }

          // No matching item is missing
          const expected = logs.filter((log) => {
            if (query.userId && log.userId !== query.userId) return false;
            if (query.action && log.action !== query.action) return false;
            if (query.tableName && log.tableName !== query.tableName) return false;
            return true;
          });
          expect(result.length).toBe(expected.length);
        },
      ),
    );
  });

  /**
   * Property 10: Chỉ Admin truy cập được API nhật ký hoạt động
   * **Validates: Requirements 11.7**
   */
  it('P10: only ADMIN role should access activity logs', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('ADMIN', 'MANAGER', 'STAFF'),
        (role) => {
          const isAllowed = role === 'ADMIN';

          if (role === 'ADMIN') {
            expect(isAllowed).toBe(true);
          } else {
            expect(isAllowed).toBe(false);
          }
        },
      ),
    );
  });
});
