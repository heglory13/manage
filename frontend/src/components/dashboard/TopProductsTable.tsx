import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { formatNumber } from '../../lib/utils';

interface TopProductsTableProps {
  data: { name: string; quantity: number; value: number }[];
}

export default function TopProductsTable({ data }: TopProductsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>STT</TableHead>
          <TableHead>Sản phẩm</TableHead>
          <TableHead className="text-right">Số lượng</TableHead>
          <TableHead className="text-right">Giá trị</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.slice(0, 10).map((product, idx) => (
          <TableRow key={idx}>
            <TableCell>{idx + 1}</TableCell>
            <TableCell className="font-medium">{product.name}</TableCell>
            <TableCell className="text-right">{formatNumber(product.quantity)}</TableCell>
            <TableCell className="text-right">{formatNumber(product.value)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
