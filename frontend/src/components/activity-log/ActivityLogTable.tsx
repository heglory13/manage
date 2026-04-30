import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { formatDateTime } from '../../lib/utils';
import { Button } from '../ui/button';

interface ActivityLogTableProps {
  logs: {
    id: number;
    action: string;
    entityType: string;
    entityId: number;
    entityName: string;
    userId: number;
    userName: string;
    changes?: Record<string, { old: string; new: string }>;
    createdAt: string;
  }[];
  onViewDetails?: (id: number) => void;
}

const entityTypeLabels: Record<string, string> = {
  PRODUCT: 'Sản phẩm',
  INVENTORY: 'Kho',
  WAREHOUSE: 'Kho hàng',
  STOCKTAKING: 'Kiểm kho',
  USER: 'Người dùng',
  INPUT_DECLARATION: 'Khai báo nhập',
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
                <TableCell>{log.action}</TableCell>
                <TableCell>{entityTypeLabels[log.entityType] || log.entityType}</TableCell>
                <TableCell className="font-medium">{log.entityName}</TableCell>
                <TableCell>
                  {log.changes && Object.keys(log.changes).length > 0 && (
                    <div className="max-w-xs space-y-1 text-xs">
                      {Object.entries(log.changes).slice(0, 2).map(([field, change]) => (
                        <div key={field}>
                          <span className="font-medium">{field}:</span>{' '}
                          <span className="text-red-500 line-through">{change.old}</span>{' → '}
                          <span className="text-green-500">{change.new}</span>
                        </div>
                      ))}
                      {Object.keys(log.changes).length > 2 && (
                        <span className="text-muted-foreground">
                          +{Object.keys(log.changes).length - 2} thay đổi khác
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
