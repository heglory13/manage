import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { api } from '../../services/api';
import { formatNumber, formatDateTime } from '../../lib/utils';
import { Download, Search } from 'lucide-react';

interface NxtReportData {
  sku: string;
  productName: string;
  classification: string;
  color: string;
  size: string;
  material: string;
  openingStock: number;
  stockIn: number;
  stockOut: number;
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
  const totalStockIn = reportData.reduce((sum, item) => sum + item.stockIn, 0);
  const totalStockOut = reportData.reduce((sum, item) => sum + item.stockOut, 0);
  const totalClosing = reportData.reduce((sum, item) => sum + item.closingStock, 0);

  return (
    <div className="space-y-6">
      {/* Date Range Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Báo cáo Nhập - Xuất - Tồn (NXT)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label>Từ ngày</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Đến ngày</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={fetchReport} disabled={isLoading}>
                <Search className="w-4 h-4 mr-2" />
                Xem báo cáo
              </Button>
              {reportData.length > 0 && (
                <Button variant="outline" onClick={handleExportExcel}>
                  <Download className="w-4 h-4 mr-2" />
                  Xuất Excel
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Table */}
      {reportData.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Kết quả NXT: {startDate} - {endDate}
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                {reportData.length} SKU
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Sản phẩm</TableHead>
                    <TableHead>Tình trạng</TableHead>
                    <TableHead>Màu</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead className="text-right">Tồn đầu kỳ</TableHead>
                    <TableHead className="text-right">Nhập trong kỳ</TableHead>
                    <TableHead className="text-right">Xuất trong kỳ</TableHead>
                    <TableHead className="text-right">Tồn cuối kỳ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell>{item.classification}</TableCell>
                      <TableCell>{item.color}</TableCell>
                      <TableCell>{item.size}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.openingStock)}</TableCell>
                      <TableCell className="text-right text-green-600">+{formatNumber(item.stockIn)}</TableCell>
                      <TableCell className="text-right text-red-600">-{formatNumber(item.stockOut)}</TableCell>
                      <TableCell className="text-right font-bold">{formatNumber(item.closingStock)}</TableCell>
                    </TableRow>
                  ))}
                  {/* Total Row */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={5}>Tổng cộng</TableCell>
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

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nhập kho hàng loạt (Excel)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Tải mẫu Excel và nhập dữ liệu nhập kho hàng loạt từ file.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleDownloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
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
            <p className="text-sm text-muted-foreground mb-4">
              Xuất báo cáo tồn kho chi tiết theo thời gian.
            </p>
            <div className="flex gap-2">
              <div className="flex gap-2 items-end">
                <div>
                  <Label className="text-xs">Từ ngày</Label>
                  <Input type="date" className="mt-1 h-9" />
                </div>
                <div>
                  <Label className="text-xs">Đến ngày</Label>
                  <Input type="date" className="mt-1 h-9" />
                </div>
              </div>
            </div>
            <Button variant="outline" className="mt-3">
              <Download className="w-4 h-4 mr-2" />
              Xuất báo cáo tồn kho
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
