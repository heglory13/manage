import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { formatDateTime } from '../../lib/utils';
import { Button } from '../ui/button';

interface ActivityLogTableProps {
  logs: {
    id: string;
    action: string;
    tableName: string;
    tableLabel: string;
    recordId: string;
    recordLabel: string;
    userId: string;
    userName: string;
    changes?: { key: string; label: string; oldValue: string | null; newValue: string | null; changed: boolean }[];
    createdAt: string;
  }[];
  onViewDetails?: (id: string) => void;
}

const actionLabels: Record<string, string> = {
  CREATE: 'Tạo mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Xóa',
};

export default function ActivityLogTable({ logs, onViewDetails }: ActivityLogTableProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Thời gian</TableHead>
              <TableHead>Người dùng</TableHead>
              <TableHead>Hành động</TableHead>
              <TableHead>Loại</TableHead>
              <TableHead>Đối tượng</TableHead>
              <TableHead>Chi tiết</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map(log => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap text-xs">
                  {formatDateTime(log.createdAt)}
                </TableCell>
                <TableCell className="font-medium">{log.userName}</TableCell>
                <TableCell>{actionLabels[log.action] || log.action}</TableCell>
                <TableCell>{log.tableLabel}</TableCell>
                <TableCell className="font-medium">{log.recordLabel || log.recordId}</TableCell>
                <TableCell>
                  {log.changes && log.changes.length > 0 && (
                    <div className="max-w-xs space-y-1 text-xs">
                      {log.changes.slice(0, 2).map((change) => (
                        <div key={change.key}>
                          <span className="font-medium">{change.label}:</span>{' '}
                          {change.changed ? (
                            <>
                              <span className="text-red-500 line-through">{change.oldValue ?? 'Trống'}</span>
                              {' → '}
                              <span className="text-green-500">{change.newValue ?? 'Trống'}</span>
                            </>
                          ) : (
                            <span>{change.oldValue ?? 'Trống'}</span>
                          )}
                        </div>
                      ))}
                      {log.changes.length > 2 && (
                        <span className="text-muted-foreground">
                          +{log.changes.length - 2} thay đổi khác
                        </span>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
