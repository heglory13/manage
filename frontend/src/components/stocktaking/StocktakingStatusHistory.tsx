import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { formatDateTime } from '../../lib/utils';

interface StatusHistoryItem {
  status: string;
  changedBy: { name: string };
  changedAt: string;
  notes?: string;
}

interface StocktakingStatusHistoryProps {
  history: StatusHistoryItem[];
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Nháp',
  SUBMITTED: 'Đã gửi',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
};

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  SUBMITTED: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

export default function StocktakingStatusHistory({ history }: StocktakingStatusHistoryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lịch sử trạng thái</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="absolute left-4 top-0 h-full w-0.5 bg-border" />
          <div className="space-y-6">
            {history.map((item, idx) => (
              <div key={idx} className="relative pl-10">
                <div className="absolute left-2 top-1 h-4 w-4 rounded-full bg-primary" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[item.status]}`}>
                      {statusLabels[item.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">
                    <span className="font-medium">{item.changedBy.name}</span> đã cập nhật
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(item.changedAt)}
                  </p>
                  {item.notes && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ghi chú: {item.notes}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
