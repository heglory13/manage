import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { api } from '../../services/api';
import { formatNumber } from '../../lib/utils';
import { Download, Search } from 'lucide-react';

interface NxtReportData {
  categoryId: string | null;
  categoryName: string;
  openingStock: number;
  totalIn: number;
  totalOut: number;
  closingStock: number;
}

interface NxtReportTabProps {
  warehouseId?: string;
}

export default function NxtReportTab({ warehouseId }: NxtReportTabProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState<NxtReportData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchReport = async () => {
    if (!startDate || !endDate) {
      alert('Vui lòng chọn khoảng thời gian');
      return;
    }

    setIsLoading(true);
    try {
      const params: Record<string, string> = {
        startDate,
        endDate,
      };
      if (warehouseId) {
        params.warehouseId = warehouseId;
      }

      const res = await api.get('/reports/nxt', { params });
      setReportData(res.data.data || res.data || []);
    } catch (err) {
      console.error('Error fetching NXT report:', err);
      alert('Không thể tải báo cáo');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportExcel = () => {
    window.open(
      `/api/reports/nxt/export?startDate=${startDate}&endDate=${endDate}${warehouseId ? `&warehouseId=${warehouseId}` : ''}`,
      '_blank'
    );
  };

  const handleDownloadTemplate = () => {
    window.open('/api/reports/stock-in/template', '_blank');
  };

  const totalOpening = reportData.reduce((sum, item) => sum + item.openingStock, 0);
  const totalStockIn = reportData.reduce((sum, item) => sum + item.totalIn, 0);
  const totalStockOut = reportData.reduce((sum, item) => sum + item.totalOut, 0);
  const totalClosing = reportData.reduce((sum, item) => sum + item.closingStock, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bao cao Nhap - Xuat - Ton theo danh muc</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label>Từ ngày</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Đến ngày</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1" />
            </div>
            <div className="flex gap-2">
              <Button onClick={fetchReport} disabled={isLoading}>
                <Search className="mr-2 h-4 w-4" />
                Xem báo cáo
              </Button>
              {reportData.length > 0 && (
                <Button variant="outline" onClick={handleExportExcel}>
                  <Download className="mr-2 h-4 w-4" />
                  Xuất Excel
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {reportData.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Kết quả NXT: {startDate} - {endDate}
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                {reportData.length} danh mục
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã danh mục</TableHead>
                    <TableHead>Danh mục</TableHead>
                    <TableHead className="text-right">Tồn đầu kỳ</TableHead>
                    <TableHead className="text-right">Nhập trong kỳ</TableHead>
                    <TableHead className="text-right">Xuất trong kỳ</TableHead>
                    <TableHead className="text-right">Tồn cuối kỳ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">{item.categoryId ?? '-'}</TableCell>
                      <TableCell className="font-medium">{item.categoryName}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.openingStock)}</TableCell>
                      <TableCell className="text-right text-green-600">+{formatNumber(item.totalIn)}</TableCell>
                      <TableCell className="text-right text-red-600">-{formatNumber(item.totalOut)}</TableCell>
                      <TableCell className="text-right font-bold">{formatNumber(item.closingStock)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={2}>Tổng cộng</TableCell>
                    <TableCell className="text-right">{formatNumber(totalOpening)}</TableCell>
                    <TableCell className="text-right text-green-600">+{formatNumber(totalStockIn)}</TableCell>
                    <TableCell className="text-right text-red-600">-{formatNumber(totalStockOut)}</TableCell>
                    <TableCell className="text-right">{formatNumber(totalClosing)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nhập kho hàng loạt (Excel)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Tải mẫu Excel và nhập dữ liệu nhập kho hàng loạt từ file.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleDownloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Tải mẫu Excel
              </Button>
              <label>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" />
                <Button variant="outline" as="span" className="cursor-pointer">
                  Upload file đã điền
                </Button>
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Báo cáo tồn kho</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Xuất báo cáo tồn kho chi tiết theo thời gian.
            </p>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Xuất báo cáo tồn kho
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
