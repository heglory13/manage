import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { formatNumber } from '../../lib/utils';

interface TopZonesTableProps {
  data: { name: string; warehouseName: string; usagePercent: number; totalItems: number }[];
}

export default function TopZonesTable({ data }: TopZonesTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>STT</TableHead>
          <TableHead>Khu vực</TableHead>
          <TableHead>Kho</TableHead>
          <TableHead className="text-right">Số lượng</TableHead>
          <TableHead>% Sử dụng</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.slice(0, 10).map((zone, idx) => (
          <TableRow key={idx}>
            <TableCell>{idx + 1}</TableCell>
            <TableCell className="font-medium">{zone.name}</TableCell>
            <TableCell>{zone.warehouseName}</TableCell>
            <TableCell className="text-right">{formatNumber(zone.totalItems)}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <div className="h-2 w-16 rounded-full bg-gray-200">
                  <div
                    className={`h-2 rounded-full ${
                      zone.usagePercent > 90 ? 'bg-red-500' :
                      zone.usagePercent > 70 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${zone.usagePercent}%` }}
                  />
                </div>
                <span className="text-sm">{zone.usagePercent}%</span>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
