import { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { api } from '../services/api';
import { formatDateTime } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Eye, ChevronDown, ChevronRight } from 'lucide-react';

interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  tableName: string;
  recordId: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  createdAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);

  const [filters, setFilters] = useState({
    tableName: '',
    action: '',
    startDate: '',
    endDate: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Detail dialog
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  const fetchLogs = useCallback(async (pageNum = 1) => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(pageNum),
        limit: String(pageSize),
      };
      if (filters.tableName) params.tableName = filters.tableName;
      if (filters.action) params.action = filters.action;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const res = await api.get('/activity-logs', { params });
      const data = res.data as PaginatedResponse<ActivityLog>;
      setLogs(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
      setPage(pageNum);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [pageSize, filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-800';
      case 'UPDATE': return 'bg-blue-100 text-blue-800';
      case 'DELETE': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'CREATE': return 'Tạo mới';
      case 'UPDATE': return 'Cập nhật';
      case 'DELETE': return 'Xóa';
      default: return action;
    }
  };

  const getTableLabel = (tableName: string) => {
    const labels: Record<string, string> = {
      Product: 'Sản phẩm',
      InventoryTransaction: 'Giao dịch kho',
      User: 'Người dùng',
      Category: 'Danh mục',
      InputDeclaration: 'Khai báo Input',
      StorageZone: 'Khu vực lưu trữ',
      StocktakingRecord: 'Kiểm kê',
      SavedFilter: 'Bộ lọc đã lưu',
      PreliminaryCheck: 'Kiểm tra sơ bộ',
      WarehouseLayout: 'Sơ đồ kho',
      WarehousePosition: 'Vị trí kho',
      Classification: 'Phân loại',
      Color: 'Màu sắc',
      Size: 'Kích thước',
      Material: 'Chất liệu',
      ProductCondition: 'Tình trạng',
      WarehouseType: 'Loại kho',
      SkuCombo: 'SKU tổng hợp',
    };
    return labels[tableName] || tableName;
  };

  const renderDiff = (oldData: Record<string, unknown> | null | undefined, newData: Record<string, unknown> | null | undefined) => {
    if (!oldData && !newData) return <p className="text-muted-foreground">Không có dữ liệu</p>;

    const allKeys = new Set([
      ...Object.keys(oldData || {}),
      ...Object.keys(newData || {}),
    ]);

    const ignoredKeys = ['id', 'createdAt', 'updatedAt', 'password', 'userId'];

    return (
      <div className="space-y-2">
        {Array.from(allKeys).filter(key => !ignoredKeys.includes(key)).map(key => {
          const oldVal = oldData?.[key];
          const newVal = newData?.[key];
          const hasChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);

          return (
            <div key={key} className={`text-sm ${hasChanged ? 'bg-yellow-50 p-2 rounded border-l-2 border-yellow-400' : ''}`}>
              <span className="font-medium text-muted-foreground">{key}: </span>
              {hasChanged && (
                <>
                  <span className="text-red-600 line-through mr-2">{oldVal !== undefined ? String(oldVal) : '(rỗng)'}</span>
                  <span className="text-green-600">{newVal !== undefined ? String(newVal) : '(rỗng)'}</span>
                </>
              )}
              {!hasChanged && <span>{newVal !== undefined ? String(newVal) : '(rỗng)'}</span>}
            </div>
          );
        })}
      </div>
    );
  };

  const toggleFieldExpand = (field: string) => {
    const newExpanded = new Set(expandedFields);
    if (newExpanded.has(field)) {
      newExpanded.delete(field);
    } else {
      newExpanded.add(field);
    }
    setExpandedFields(newExpanded);
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Nhật ký hoạt động</h1>
        <p className="text-muted text-sm">Theo dõi tất cả thao tác thay đổi dữ liệu trong hệ thống</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Lịch sử hoạt động</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              Bộ lọc
            </Button>
          </div>

          {showFilters && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs">Loại bảng</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm h-9"
                    value={filters.tableName}
                    onChange={(e) => setFilters({ ...filters, tableName: e.target.value })}
                  >
                    <option value="">Tất cả</option>
                    <option value="Product">Sản phẩm</option>
                    <option value="InventoryTransaction">Giao dịch kho</option>
                    <option value="User">Người dùng</option>
                    <option value="Category">Danh mục</option>
                    <option value="StorageZone">Khu vực lưu trữ</option>
                    <option value="StocktakingRecord">Kiểm kê</option>
                    <option value="WarehouseLayout">Sơ đồ kho</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Hành động</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm h-9"
                    value={filters.action}
                    onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                  >
                    <option value="">Tất cả</option>
                    <option value="CREATE">Tạo mới</option>
                    <option value="UPDATE">Cập nhật</option>
                    <option value="DELETE">Xóa</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Từ ngày</Label>
                  <Input
                    type="date"
                    className="mt-1 h-9"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Đến ngày</Label>
                  <Input
                    type="date"
                    className="mt-1 h-9"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button size="sm" onClick={() => fetchLogs(1)}>
                  Áp dụng
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setFilters({ tableName: '', action: '', startDate: '', endDate: '' });
                    fetchLogs(1);
                  }}
                >
                  Xóa bộ lọc
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="spinner"></div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">STT</TableHead>
                      <TableHead>Thời gian</TableHead>
                      <TableHead>Người dùng</TableHead>
                      <TableHead>Hành động</TableHead>
                      <TableHead>Bảng</TableHead>
                      <TableHead>ID bản ghi</TableHead>
                      <TableHead className="w-12">Chi tiết</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log, idx) => (
                      <TableRow key={log.id}>
                        <TableCell>{(page - 1) * pageSize + idx + 1}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{formatDateTime(log.createdAt)}</TableCell>
                        <TableCell className="font-medium">{log.userName || '-'}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getActionBadgeClass(log.action)}`}>
                            {getActionLabel(log.action)}
                          </span>
                        </TableCell>
                        <TableCell>{getTableLabel(log.tableName)}</TableCell>
                        <TableCell className="font-mono text-xs">{log.recordId?.slice(0, 8) || '-'}...</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {logs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Không có nhật ký nào
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {total > 0 && (
                <div className="flex items-center justify-between mt-4 border-t pt-4">
                  <p className="text-sm text-muted-foreground">
                    Hiển thị {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} trong tổng {total} bản ghi
                  </p>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => fetchLogs(page - 1)} disabled={page <= 1}>
                      Trước
                    </Button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(p => (
                      <Button
                        key={p}
                        variant={p === page ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => fetchLogs(p)}
                      >
                        {p}
                      </Button>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => fetchLogs(page + 1)} disabled={page >= totalPages}>
                      Sau
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết nhật ký hoạt động</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Người thực hiện</Label>
                  <p className="font-medium">{selectedLog.userName || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Thời gian</Label>
                  <p className="text-sm">{formatDateTime(selectedLog.createdAt)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Hành động</Label>
                  <p>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getActionBadgeClass(selectedLog.action)}`}>
                      {getActionLabel(selectedLog.action)}
                    </span>
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Bảng</Label>
                  <p>{getTableLabel(selectedLog.tableName)}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">ID bản ghi</Label>
                  <p className="font-mono text-sm">{selectedLog.recordId || '-'}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="text-muted-foreground mb-2 block">Thay đổi dữ liệu</Label>
                {renderDiff(selectedLog.oldData, selectedLog.newData)}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
