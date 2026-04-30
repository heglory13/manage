import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { formatDateTime } from '../../lib/utils';

interface ActivityLogDiffViewProps {
  log: {
    action: string;
    entityType: string;
    entityName: string;
    userName: string;
    createdAt: string;
    changes?: Record<string, { old: string; new: string }>;
  } | null;
}

const fieldLabels: Record<string, string> = {
  name: 'Tên',
  code: 'Mã',
  status: 'Trạng thái',
  quantity: 'Số lượng',
  capacity: 'Sức chứa',
  email: 'Email',
  role: 'Vai trò',
  isActive: 'Hoạt động',
};

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
            <span className="font-medium">{log.action}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Đối tượng:</span>{' '}
            <span className="font-medium">{log.entityName}</span>
          </div>
        </div>

        {log.changes && Object.keys(log.changes).length > 0 && (
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
                  {Object.entries(log.changes).map(([field, change]) => (
                    <tr key={field}>
                      <td className="border p-2 font-medium">
                        {fieldLabels[field] || field}
                      </td>
                      <td className="border p-2 text-red-600 line-through">
                        {change.old || '(trống)'}
                      </td>
                      <td className="border p-2 text-green-600">
                        {change.new || '(trống)'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(!log.changes || Object.keys(log.changes).length === 0) && (
          <p className="text-sm text-muted-foreground">Không có chi tiết thay đổi</p>
        )}
      </CardContent>
    </Card>
  );
}
