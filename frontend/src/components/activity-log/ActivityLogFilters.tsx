import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface ActivityLogFiltersProps {
  filters: {
    tableName?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
  };
  onFiltersChange: (filters: Partial<NonNullable<ActivityLogFiltersProps['filters']>>) => void;
  users?: { id: string; name: string }[];
}

export default function ActivityLogFilters({ filters, onFiltersChange, users }: ActivityLogFiltersProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bộ lọc</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <Label htmlFor="tableName">Module</Label>
            <select
              id="tableName"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              value={filters.tableName || ''}
              onChange={e => onFiltersChange({ ...filters, tableName: e.target.value || undefined })}
            >
              <option value="">Tất cả</option>
              <option value="Product">Sản phẩm</option>
              <option value="InventoryTransaction">Giao dịch kho</option>
              <option value="User">Người dùng</option>
              <option value="Category">Danh mục</option>
              <option value="StorageZone">Khu vực / Thùng</option>
              <option value="StocktakingRecord">Kiểm kê</option>
              <option value="SavedFilter">Bộ lọc đã lưu</option>
              <option value="PreliminaryCheck">Kiểm sơ bộ</option>
              <option value="WarehouseLayout">Sơ đồ kho</option>
              <option value="OrderPlan">Kế hoạch đặt hàng</option>
            </select>
          </div>

          {users && (
            <div>
              <Label htmlFor="userId">Người dùng</Label>
              <select
                id="userId"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
                value={filters.userId || ''}
                onChange={e => onFiltersChange({ ...filters, userId: e.target.value || undefined })}
              >
                <option value="">Tất cả</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <Label htmlFor="dateFrom">Từ ngày</Label>
            <Input
              id="dateFrom"
              type="date"
              value={filters.dateFrom || ''}
              onChange={e => onFiltersChange({ ...filters, dateFrom: e.target.value || undefined })}
            />
          </div>

          <div>
            <Label htmlFor="dateTo">Đến ngày</Label>
            <Input
              id="dateTo"
              type="date"
              value={filters.dateTo || ''}
              onChange={e => onFiltersChange({ ...filters, dateTo: e.target.value || undefined })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
