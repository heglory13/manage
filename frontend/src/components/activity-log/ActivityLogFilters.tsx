import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface ActivityLogFiltersProps {
  filters: {
    entityType?: string;
    userId?: number;
    startDate?: string;
    endDate?: string;
  };
  onFiltersChange: (filters: typeof ActivityLogFiltersProps.prototype.filters) => void;
  users?: { id: number; name: string }[];
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
            <Label htmlFor="entityType">Loại đối tượng</Label>
            <select
              id="entityType"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              value={filters.entityType || ''}
              onChange={e => onFiltersChange({ ...filters, entityType: e.target.value || undefined })}
            >
              <option value="">Tất cả</option>
              <option value="PRODUCT">Sản phẩm</option>
              <option value="INVENTORY">Kho</option>
              <option value="WAREHOUSE">Kho hàng</option>
              <option value="STOCKTAKING">Kiểm kho</option>
              <option value="USER">Người dùng</option>
              <option value="INPUT_DECLARATION">Khai báo nhập</option>
            </select>
          </div>

          {users && (
            <div>
              <Label htmlFor="userId">Người dùng</Label>
              <select
                id="userId"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
                value={filters.userId || ''}
                onChange={e => onFiltersChange({ ...filters, userId: e.target.value ? Number(e.target.value) : undefined })}
              >
                <option value="">Tất cả</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <Label htmlFor="startDate">Từ ngày</Label>
            <Input
              id="startDate"
              type="date"
              value={filters.startDate || ''}
              onChange={e => onFiltersChange({ ...filters, startDate: e.target.value || undefined })}
            />
          </div>

          <div>
            <Label htmlFor="endDate">Đến ngày</Label>
            <Input
              id="endDate"
              type="date"
              value={filters.endDate || ''}
              onChange={e => onFiltersChange({ ...filters, endDate: e.target.value || undefined })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
