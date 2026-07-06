import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { api } from '../services/api';
import { formatDateTime } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Eye } from 'lucide-react';
import SmartFilter, { type FilterField } from '../components/common/SmartFilter';
import { useSavedFilters } from '../hooks/useSavedFilters';

type ActivityLogChange = {
  key: string;
  label: string;
  oldValue: string | null;
  newValue: string | null;
  changed: boolean;
};

type ActivityLog = {
  id: string;
  userId: string;
  userName: string;
  action: string;
  tableName: string;
  tableLabel: string;
  recordId: string;
  recordLabel: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  changes: ActivityLogChange[];
  createdAt: string;
};

type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const ACTION_BADGE_CLASS: Record<string, string> = {
  CREATE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  UPDATE: 'border-blue-200 bg-blue-50 text-blue-700',
  DELETE: 'border-rose-200 bg-rose-50 text-rose-700',
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Tạo mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Xóa',
};

function getActionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

function getActionBadgeClass(action: string) {
  return (
    ACTION_BADGE_CLASS[action] ??
    'border-slate-200 bg-slate-50 text-slate-700'
  );
}

function renderChangeValue(value: string | null) {
  return value ?? 'Trống';
}

function findChange(changes: ActivityLogChange[], key: string): ActivityLogChange | undefined {
  return changes.find((c) => c.key === key);
}

function getCurrentValue(changes: ActivityLogChange[], key: string): string | null {
  const change = findChange(changes, key);
  if (!change) return null;
  return change.newValue ?? change.oldValue ?? null;
}

const TRANSACTION_DISPLAY_KEYS = new Set([
  'warehousePositionId',
  'storageZoneId',
  'warehouseTypeId',
  'purchasePrice',
  'notes',
  'type',
  'salePrice',
  'quantity',
  'receiptGroupId',
]);

function formatPrice(value: string | null): string {
  if (!value) return '-';
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return new Intl.NumberFormat('vi-VN').format(num) + 'đ';
}

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const initialFilters = useMemo(() => {
    const params: Record<string, unknown> = {};
    const sp = new URLSearchParams(searchParams);
    const allowed = ['keyword', 'action', 'userId', 'tableName', 'dateFrom', 'dateTo'];
    for (const key of allowed) {
      const val = sp.get(key);
      if (val) {
        if (key === 'action' || key === 'userId' || key === 'tableName') {
          params[key] = val.includes(',') ? val.split(',') : [val];
        } else {
          params[key] = val;
        }
      }
    }
    return params;
  }, []);

  const savedFilterHook = useSavedFilters({
    pageKey: 'activity-logs',
    initialFilters: Object.keys(initialFilters).length > 0 ? initialFilters : undefined,
    onFiltersChange: () => setPage(1),
  });

  const filterFields = useMemo<FilterField[]>(
    () => [
      {
        key: 'keyword',
        label: 'Từ khóa',
        type: 'text',
        placeholder: 'Tìm theo nhân viên, module, mã bản ghi...',
      },
      {
        key: 'action',
        label: 'Hành động',
        type: 'select',
        options: [
          { value: 'CREATE', label: 'Tạo mới' },
          { value: 'UPDATE', label: 'Cập nhật' },
          { value: 'DELETE', label: 'Xóa' },
        ],
      },
      {
        key: 'userId',
        label: 'Nhân viên',
        type: 'text',
        placeholder: 'Gõ để tìm nhân viên...',
        asyncLoad: async (query?: string) => {
          const res = await api.get('/users', {
            params: { limit: 100, search: query },
          });
          const items = res.data.data || res.data || [];
          return items.map((item: any) => ({
            value: item.id,
            label: item.name,
          }));
        },
      },
      {
        key: 'tableName',
        label: 'Module',
        type: 'select',
        options: [
          { value: 'InventoryTransaction', label: 'Giao dịch kho' },
          { value: 'PreliminaryCheck', label: 'Kiểm sơ bộ' },
          { value: 'StocktakingRecord', label: 'Kiểm kê' },
          { value: 'Product', label: 'Sản phẩm' },
          { value: 'User', label: 'Người dùng' },
          { value: 'Category', label: 'Danh mục' },
          { value: 'StorageZone', label: 'Khu vực / Thùng' },
          { value: 'WarehouseLayout', label: 'Sơ đồ kho' },
          { value: 'OrderPlan', label: 'Kế hoạch đặt hàng' },
          { value: 'SavedFilter', label: 'Bộ lọc đã lưu' },
        ],
      },
      {
        key: 'dateFrom',
        label: 'Từ ngày',
        type: 'date',
      },
      {
        key: 'dateTo',
        label: 'Đến ngày',
        type: 'date',
      },
    ],
    [],
  );

  const fetchLogs = useCallback(
    async (pageNum = 1) => {
      setIsLoading(true);
      try {
        const filters = savedFilterHook.filters;
        const queryParams: Record<string, string> = {
          page: String(pageNum),
          limit: String(pageSize),
        };

        if (filters.keyword) queryParams.keyword = String(filters.keyword);
        if (filters.action) {
          const actionVal = filters.action;
          queryParams.action = Array.isArray(actionVal) ? actionVal.join(',') : String(actionVal);
        }
        if (filters.userId) {
          const userIdVal = filters.userId;
          queryParams.userId = Array.isArray(userIdVal) ? userIdVal.join(',') : String(userIdVal);
        }
        if (filters.tableName) {
          const tableVal = filters.tableName;
          queryParams.tableName = Array.isArray(tableVal) ? tableVal.join(',') : String(tableVal);
        }
        if (filters.dateFrom) queryParams.dateFrom = String(filters.dateFrom);
        if (filters.dateTo) queryParams.dateTo = String(filters.dateTo);

        const res = await api.get('/activity-logs', { params: queryParams });
        const data = res.data as PaginatedResponse<ActivityLog>;
        setLogs(data.data || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 0);
        setPage(pageNum);

        // Sync filters to URL for reload persistence
        const urlParams = new URLSearchParams();
        const syncKeys = ['keyword', 'action', 'userId', 'tableName', 'dateFrom', 'dateTo'];
        for (const key of syncKeys) {
          const val = queryParams[key];
          if (val) urlParams.set(key, val);
        }
        setSearchParams(urlParams, { replace: true });
      } catch (error) {
        console.error('Error fetching activity logs:', error);
        setLogs([]);
        setTotal(0);
        setTotalPages(0);
      } finally {
        setIsLoading(false);
      }
    },
    [pageSize, savedFilterHook.filters, setSearchParams],
  );

  useEffect(() => {
    void fetchLogs(1);
  }, [fetchLogs]);

  const visiblePageNumbers = useMemo(() => {
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
  }, [page, totalPages]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Nhật ký hoạt động</h1>
          <p className="mt-1 text-sm text-slate-500">
            Theo dõi các thay đổi dữ liệu theo nhân viên, module và thời gian.
          </p>
        </div>

        <SmartFilter
          fields={filterFields}
          filters={savedFilterHook.filters}
          draftFilters={savedFilterHook.draftFilters}
          savedFilters={savedFilterHook.savedFilters}
          activeFilterId={savedFilterHook.activeFilterId}
          onUpdateFilter={savedFilterHook.updateFilter}
          onRemoveFilter={savedFilterHook.removeFilter}
          onClearFilters={savedFilterHook.clearFilters}
          onApplyFilter={savedFilterHook.applyFilter}
          onSaveFilter={savedFilterHook.saveFilter}
          onDeleteFilter={savedFilterHook.deleteFilter}
        />

        <Card className="overflow-hidden rounded-[24px] border border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-base">
              Lịch sử hoạt động
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="spinner" />
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto lg:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">STT</TableHead>
                        <TableHead>Thời gian</TableHead>
                        <TableHead>Nhân viên</TableHead>
                        <TableHead>Hành động</TableHead>
                        <TableHead>Module</TableHead>
                        <TableHead>Bản ghi</TableHead>
                        <TableHead className="w-36">Khu vực / Thùng</TableHead>
                        <TableHead className="w-28 text-right">Giá nhập</TableHead>
                        <TableHead className="w-36">Ghi chú</TableHead>
                        <TableHead className="w-20 text-right">Chi tiết</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log, index) => (
                        <TableRow key={log.id}>
                          <TableCell>{(page - 1) * pageSize + index + 1}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-slate-600">
                            {formatDateTime(log.createdAt)}
                          </TableCell>
                          <TableCell className="font-medium text-slate-900">
                            {log.userName || '-'}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getActionBadgeClass(log.action)}`}>
                              {getActionLabel(log.action)}
                            </span>
                          </TableCell>
                          <TableCell>{log.tableLabel}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm text-slate-600">
                            {log.recordLabel || log.recordId || '-'}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {log.tableName === 'InventoryTransaction'
                              ? (() => {
                                  const zone = getCurrentValue(log.changes, 'storageZoneId');
                                  const pos = getCurrentValue(log.changes, 'warehousePositionId');
                                  const parts = [];
                                  if (zone && pos) parts.push(`${zone} (${pos})`);
                                  else if (zone) parts.push(zone);
                                  else if (pos) parts.push(pos);
                                  const wType = getCurrentValue(log.changes, 'warehouseTypeId');
                                  if (wType) parts.push(wType);
                                  return parts.length > 0 ? parts.join(' / ') : '-';
                                })()
                              : '-'}
                          </TableCell>
                          <TableCell className="text-right text-sm text-slate-600">
                            {log.tableName === 'InventoryTransaction'
                              ? formatPrice(getCurrentValue(log.changes, 'purchasePrice'))
                              : '-'}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm text-slate-600">
                            {log.tableName === 'InventoryTransaction'
                              ? (getCurrentValue(log.changes, 'notes') || '-')
                              : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-2"
                              onClick={() => setSelectedLog(log)}
                            >
                              <Eye className="h-4 w-4" />
                              Xem
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {logs.length === 0 && (
                        <TableRow>
                           <TableCell colSpan={10} className="py-10 text-center text-sm text-slate-400">
                            Không có dữ liệu phù hợp với bộ lọc hiện tại.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="divide-y divide-slate-100 lg:hidden">
                  {logs.length === 0 ? (
                    <div className="py-10 text-center text-sm text-slate-400">
                      Không có dữ liệu phù hợp với bộ lọc hiện tại.
                    </div>
                  ) : (
                    logs.map((log, index) => (
                      <div key={log.id} className="space-y-3 px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <span className="text-xs text-slate-400">
                                {(page - 1) * pageSize + index + 1}.
                              </span>
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getActionBadgeClass(log.action)}`}>
                                {getActionLabel(log.action)}
                              </span>
                            </div>
                            <div className="font-medium text-slate-900">{log.userName || '-'}</div>
                            <div className="mt-1 text-xs text-slate-500">{log.tableLabel}</div>
                            <div className="mt-1 text-xs text-slate-400">{formatDateTime(log.createdAt)}</div>
                            <div className="mt-2 text-sm text-slate-600">{log.recordLabel || log.recordId || '-'}</div>
                            {log.tableName === 'InventoryTransaction' && (
                              <>
                                {(() => {
                                  const zone = getCurrentValue(log.changes, 'storageZoneId');
                                  const pos = getCurrentValue(log.changes, 'warehousePositionId');
                                  const parts = [];
                                  if (zone && pos) parts.push(`${zone} (${pos})`);
                                  else if (zone) parts.push(zone);
                                  else if (pos) parts.push(pos);
                                  const wType = getCurrentValue(log.changes, 'warehouseTypeId');
                                  if (wType) parts.push(wType);
                                  return parts.length > 0 ? (
                                    <div className="mt-1 text-xs text-slate-600">
                                      <span className="font-medium">Khu vực / Thùng:</span> {parts.join(' / ')}
                                    </div>
                                  ) : null;
                                })()}
                                <div className="mt-1 text-xs text-slate-600">
                                  <span className="font-medium">Giá nhập:</span>{' '}
                                  {formatPrice(getCurrentValue(log.changes, 'purchasePrice'))}
                                </div>
                                <div className="mt-1 text-xs text-slate-600">
                                  <span className="font-medium">Ghi chú:</span>{' '}
                                  {getCurrentValue(log.changes, 'notes') || '-'}
                                </div>
                              </>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0"
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {total > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-4">
                    <p className="text-sm text-slate-500">
                      Hiển thị {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} trong tổng {total} bản ghi
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void fetchLogs(page - 1)}
                        disabled={page <= 1}
                      >
                        Trước
                      </Button>
                      {visiblePageNumbers.map((pageNumber) => (
                        <Button
                          key={pageNumber}
                          variant={pageNumber === page ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => void fetchLogs(pageNumber)}
                        >
                          {pageNumber}
                        </Button>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void fetchLogs(page + 1)}
                        disabled={page >= totalPages}
                      >
                        Sau
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(selectedLog)} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết nhật ký hoạt động</DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-5">
              <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Nhân viên</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{selectedLog.userName || '-'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Thời gian</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{formatDateTime(selectedLog.createdAt)}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Hành động</div>
                  <div className="mt-1">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getActionBadgeClass(selectedLog.action)}`}>
                      {getActionLabel(selectedLog.action)}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Module</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{selectedLog.tableLabel}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Bản ghi</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{selectedLog.recordLabel || selectedLog.recordId || '-'}</div>
                </div>
              </div>

              {selectedLog.tableName === 'InventoryTransaction' && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <div className="mb-3 text-sm font-semibold text-blue-900">Thông tin giao dịch</div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Mã phiếu</div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {selectedLog.recordLabel || '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Loại giao dịch</div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {(() => {
                          const type = getCurrentValue(selectedLog.changes, 'type');
                          if (type === 'STOCK_IN') return 'Nhập kho';
                          if (type === 'STOCK_OUT') return 'Xuất kho';
                          return type || '-';
                        })()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Số lượng</div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {getCurrentValue(selectedLog.changes, 'quantity') || '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Khu vực / Thùng</div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {(() => {
                          const zone = getCurrentValue(selectedLog.changes, 'storageZoneId');
                          const pos = getCurrentValue(selectedLog.changes, 'warehousePositionId');
                          const parts = [];
                          if (zone && pos) parts.push(`${zone} (${pos})`);
                          else if (zone) parts.push(zone);
                          else if (pos) parts.push(pos);
                          const wType = getCurrentValue(selectedLog.changes, 'warehouseTypeId');
                          if (wType) parts.push(wType);
                          return parts.length > 0 ? parts.join(' / ') : '-';
                        })()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Giá nhập</div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {formatPrice(getCurrentValue(selectedLog.changes, 'purchasePrice'))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Giá bán</div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {formatPrice(getCurrentValue(selectedLog.changes, 'salePrice'))}
                      </div>
                    </div>
                    <div className="sm:col-span-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ghi chú</div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {getCurrentValue(selectedLog.changes, 'notes') || '-'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <div className="mb-3 text-sm font-semibold text-slate-900">Thay đổi dữ liệu</div>
                {selectedLog.changes.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    Không có dữ liệu thay đổi để hiển thị.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedLog.changes
                      .filter((change) => selectedLog.tableName !== 'InventoryTransaction' || !TRANSACTION_DISPLAY_KEYS.has(change.key))
                      .map((change) => (
                      <div
                        key={change.key}
                        className={`rounded-2xl border px-4 py-4 ${
                          change.changed
                            ? 'border-amber-200 bg-amber-50'
                            : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <div className="mb-3 text-sm font-semibold text-slate-900">
                          {change.label}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Trước
                            </div>
                            <div className={`mt-1 rounded-xl px-3 py-2 text-sm ${change.changed ? 'bg-white text-rose-600 line-through' : 'bg-white text-slate-700'}`}>
                              {renderChangeValue(change.oldValue)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Sau
                            </div>
                            <div className={`mt-1 rounded-xl px-3 py-2 text-sm ${change.changed ? 'bg-white text-emerald-700' : 'bg-white text-slate-700'}`}>
                              {renderChangeValue(change.newValue)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
