import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';

interface PreliminaryCheckListProps {
  checks: {
    id: number;
    type: string;
    status: string;
    checkedPositions: number;
    totalPositions: number;
    createdAt: string;
  }[];
  onView: (id: number) => void;
}

export default function PreliminaryCheckList({ checks, onView }: PreliminaryCheckListProps) {
  const statusLabels: Record<string, string> = {
    PENDING: 'Chờ',
    IN_PROGRESS: 'Đang kiểm',
    COMPLETED: 'Hoàn thành',
  };

  const statusColors: Record<string, string> = {
    PENDING: 'bg-gray-100 text-gray-800',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    COMPLETED: 'bg-green-100 text-green-800',
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Loại</TableHead>
          <TableHead>Trạng thái</TableHead>
          <TableHead className="text-right">Đã kiểm</TableHead>
          <TableHead className="text-right">Tổng vị trí</TableHead>
          <TableHead>Ngày tạo</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {checks.map(check => (
          <TableRow key={check.id}>
            <TableCell>{check.type === 'PRELIMINARY' ? 'Sơ bộ' : 'Chi tiết'}</TableCell>
            <TableCell>
              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusColors[check.status]}`}>
                {statusLabels[check.status]}
              </span>
            </TableCell>
            <TableCell className="text-right">{check.checkedPositions}</TableCell>
            <TableCell className="text-right">{check.totalPositions}</TableCell>
            <TableCell>{new Date(check.createdAt).toLocaleDateString('vi-VN')}</TableCell>
            <TableCell>
              <Button variant="outline" size="sm" onClick={() => onView(check.id)}>
                Xem
              </Button>
            </TableCell>
          </TableRow>
        ))}
        {checks.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center">Không có phiếu kiểm tra nào</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
