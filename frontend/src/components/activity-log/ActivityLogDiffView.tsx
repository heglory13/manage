import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { formatDateTime } from '../../lib/utils';

const actionLabels: Record<string, string> = {
  CREATE: 'Tạo mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Xóa',
};

const fieldLabels: Record<string, string> = {
  name: 'Tên',
  code: 'Mã',
  status: 'Trạng thái',
  quantity: 'Số lượng',
  maxCapacity: 'Sức chứa',
  email: 'Email',
  role: 'Vai trò',
  isActive: 'Hoạt động',
  categoryId: 'Danh mục',
  storageZoneId: 'Khu vực / Thùng',
  warehousePositionId: 'Vị trí kho',
  skuComboId: 'SKU',
  warehouseTypeId: 'Loại kho',
  userId: 'Nhân viên',
};

interface ActivityLogDiffViewProps {
  log: {
    id: string;
    action: string;
    tableName: string;
    tableLabel: string;
    recordId: string;
    recordLabel: string;
    userName: string;
    createdAt: string;
    changes?: { key: string; label: string; oldValue: string | null; newValue: string | null; changed: boolean }[];
  } | null;
}

export default function ActivityLogDiffView({ log }: ActivityLogDiffViewProps) {
  if (!log) {
    return (
      <Card>
        <CardContent className="flex h-64 items-center justify-center text-muted-foreground">
          Chọn một nhật ký để xem chi tiết
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chi tiết thay đổi</CardTitle>
        <p className="text-sm text-muted-foreground">
          {log.userName} - {formatDateTime(log.createdAt)}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Hành động:</span>{' '}
            <span className="font-medium">{actionLabels[log.action] || log.action}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Module:</span>{' '}
            <span className="font-medium">{log.tableLabel}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Bản ghi:</span>{' '}
            <span className="font-medium">{log.recordLabel || log.recordId}</span>
          </div>
        </div>

        {log.changes && log.changes.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium">Các trường thay đổi:</h4>
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="border p-2 text-left">Trường</th>
                    <th className="border p-2 text-left">Giá trị cũ</th>
                    <th className="border p-2 text-left">Giá trị mới</th>
                  </tr>
                </thead>
                <tbody>
                  {log.changes.map((change) => (
                    <tr key={change.key}>
                      <td className="border p-2 font-medium">
                        {fieldLabels[change.key] || change.label}
                      </td>
                      <td className={`border p-2 ${change.changed ? 'text-red-600 line-through' : ''}`}>
                        {change.oldValue ?? '(trống)'}
                      </td>
                      <td className={`border p-2 ${change.changed ? 'text-green-600' : ''}`}>
                        {change.newValue ?? '(trống)'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(!log.changes || log.changes.length === 0) && (
          <p className="text-sm text-muted-foreground">Không có chi tiết thay đổi</p>
        )}
      </CardContent>
    </Card>
  );
}
