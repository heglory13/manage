import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { api } from '../services/api';
import { formatNumber, formatDateTime } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Package, Warehouse, TrendingUp, AlertTriangle, ChevronDown, TrendingDown, Minus } from 'lucide-react';

interface DashboardSummary {
  totalProducts: number;
  totalStock: number;
  monthlyStockIn: number;
  monthlyStockOut: number;
  capacityRatio: number;
}

interface AlertProduct {
  id: string;
  name: string;
  sku: string;
  stock: number;
  minThreshold: number;
  maxThreshold: number;
  category?: { name: string };
}

interface TopProduct {
  rank: number;
  id: string;
  name: string;
  sku: string;
  stock: number;
}

interface TopZone {
  rank: number;
  id: string;
  name: string;
  maxCapacity: number;
  currentStock: number;
  usagePercent: number;
}

interface ChartDataV2 {
  labels: string[];
  stockIn: number[];
  stockOut: number[];
  inventory: number[];
  period: 'week' | 'month';
}

interface TransactionDetail {
  id: string;
  createdAt: string;
  productName: string;
  productSku: string;
  quantity: number;
  userName: string;
}

interface PaginatedData {
  data: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface DetailDialogProps {
  open: boolean;
  onClose: () => void;
  type: string;
  data: any[];
  total: number;
  loading: boolean;
  page: number;
  onPageChange: (page: number) => void;
}

function DetailDialog({ open, onClose, type, data, total, loading, page, onPageChange }: DetailDialogProps) {
  const totalPages = Math.ceil(total / 20);

  const getColumns = () => {
    switch (type) {
      case 'products':
        return ['Tên sản phẩm', 'SKU', 'Danh mục', 'Tồn kho'];
      case 'stock':
        return ['Tên sản phẩm', 'SKU', 'Tồn kho'];
      case 'stock_in':
        return ['Ngày', 'Sản phẩm', 'SKU', 'Số lượng', 'Người thực hiện'];
      case 'stock_out':
        return ['Ngày', 'Sản phẩm', 'SKU', 'Số lượng', 'Người thực hiện'];
      default:
        return [];
    }
  };

  const columns = getColumns();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {type === 'products' && 'Danh sách sản phẩm'}
            {type === 'stock' && 'Danh sách tồn kho'}
            {type === 'stock_in' && 'Giao dịch nhập kho tháng này'}
            {type === 'stock_out' && 'Giao dịch xuất kho tháng này'}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="spinner" style={{ borderTopColor: '#0d6efd' }}></div>
          </div>
        ) : (
          <>
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead key={col}>{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((item: any, idx: number) => (
                    <TableRow key={item.id || idx}>
                      {type === 'products' && (
                        <>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                          <TableCell>{item.category?.name || '-'}</TableCell>
                          <TableCell className="text-right font-medium">{formatNumber(item.stock)}</TableCell>
                        </>
                      )}
                      {type === 'stock' && (
                        <>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                          <TableCell className="text-right font-medium">{formatNumber(item.stock)}</TableCell>
                        </>
                      )}
                      {(type === 'stock_in' || type === 'stock_out') && (
                        <>
                          <TableCell className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</TableCell>
                          <TableCell>{item.productName}</TableCell>
                          <TableCell className="font-mono text-xs">{item.productSku}</TableCell>
                          <TableCell className="text-right font-medium">{formatNumber(item.quantity)}</TableCell>
                          <TableCell>{item.userName}</TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                  {data.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                        Không có dữ liệu
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {total > 0 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Tổng: {formatNumber(total)} bản ghi
                </p>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
                    Trước
                  </Button>
                  <span className="px-3 py-1 text-sm">Trang {page}/{totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
                    Sau
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [chartData, setChartData] = useState<ChartDataV2 | null>(null);
  const [alertsBelowMin, setAlertsBelowMin] = useState<AlertProduct[]>([]);
  const [alertsAboveMax, setAlertsAboveMax] = useState<AlertProduct[]>([]);
  const [topProductsHighest, setTopProductsHighest] = useState<TopProduct[]>([]);
  const [topProductsLowest, setTopProductsLowest] = useState<TopProduct[]>([]);
  const [topZonesHighest, setTopZonesHighest] = useState<TopZone[]>([]);
  const [topZonesLowest, setTopZonesLowest] = useState<TopZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month'>('month');

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailType, setDetailType] = useState('');
  const [detailData, setDetailData] = useState<any[]>([]);
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailPage, setDetailPage] = useState(1);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const [summaryRes, chartRes, belowMinRes, aboveMaxRes, topHighRes, topLowRes, zonesHighRes, zonesLowRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get(`/dashboard/chart-v2?period=${period}`),
        api.get('/dashboard/alerts/below-min'),
        api.get('/dashboard/alerts/above-max'),
        api.get('/dashboard/top-products?type=highest&limit=20'),
        api.get('/dashboard/top-products?type=lowest&limit=20'),
        api.get('/dashboard/top-zones?type=highest&limit=10'),
        api.get('/dashboard/top-zones?type=lowest&limit=10'),
      ]);

      setSummary(summaryRes.data);
      setChartData(chartRes.data);
      setAlertsBelowMin(belowMinRes.data || []);
      setAlertsAboveMax(aboveMaxRes.data || []);
      setTopProductsHighest(topHighRes.data || []);
      setTopProductsLowest(topLowRes.data || []);
      setTopZonesHighest(zonesHighRes.data || []);
      setTopZonesLowest(zonesLowRes.data || []);
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const openDetail = async (type: string) => {
    setDetailType(type);
    setDetailOpen(true);
    setDetailPage(1);
    await fetchDetail(type, 1);
  };

  const fetchDetail = async (type: string, page: number) => {
    setDetailLoading(true);
    try {
      let endpoint = '';
      switch (type) {
        case 'products':
          endpoint = `/dashboard/detail/products?page=${page}&limit=20`;
          break;
        case 'stock':
          endpoint = `/dashboard/detail/stock?page=${page}&limit=20`;
          break;
        case 'stock_in':
          endpoint = `/dashboard/detail/transactions?type=stock_in&page=${page}&limit=20`;
          break;
        case 'stock_out':
          endpoint = `/dashboard/detail/transactions?type=stock_out&page=${page}&limit=20`;
          break;
      }

      const res = await api.get(endpoint);
      setDetailData(res.data.data || []);
      setDetailTotal(res.data.total || 0);
      setDetailPage(page);
    } catch (err) {
      console.error('Error fetching detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDetailPageChange = async (page: number) => {
    await fetchDetail(detailType, page);
  };

  // Prepare chart data
  const chartDataFormatted = chartData?.labels.map((label, i) => ({
    name: label,
    'Nhập': chartData.stockIn[i],
    'Xuất': chartData.stockOut[i],
    'Tồn': chartData.inventory[i],
  })) || [];

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="spinner" style={{ borderTopColor: '#0d6efd' }}></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted text-sm">Tổng quan hệ thống</p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          <button
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${period === 'week' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setPeriod('week')}
          >
            Tuần
          </button>
          <button
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${period === 'month' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setPeriod('month')}
          >
            Tháng
          </button>
        </div>
      </div>

      {/* Summary Cards - Clickable */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => openDetail('products')}
          className="text-left hover:bg-muted/50 rounded-lg transition-colors"
        >
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tổng sản phẩm</p>
                  <p className="text-2xl font-bold">{formatNumber(summary?.totalProducts || 0)}</p>
                </div>
                <Package className="w-8 h-8 text-blue-500 opacity-20" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Click để xem chi tiết</p>
            </CardContent>
          </Card>
        </button>

        <button
          onClick={() => openDetail('stock')}
          className="text-left hover:bg-muted/50 rounded-lg transition-colors"
        >
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tổng tồn kho</p>
                  <p className="text-2xl font-bold">{formatNumber(summary?.totalStock || 0)}</p>
                </div>
                <Warehouse className="w-8 h-8 text-green-500 opacity-20" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Click để xem chi tiết</p>
            </CardContent>
          </Card>
        </button>

        <button
          onClick={() => openDetail('stock_in')}
          className="text-left hover:bg-muted/50 rounded-lg transition-colors"
        >
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Nhập kho tháng này</p>
                  <p className="text-2xl font-bold text-green-600">{formatNumber(summary?.monthlyStockIn || 0)}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500 opacity-20" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Click để xem chi tiết</p>
            </CardContent>
          </Card>
        </button>

        <button
          onClick={() => openDetail('stock_out')}
          className="text-left hover:bg-muted/50 rounded-lg transition-colors"
        >
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Xuất kho tháng này</p>
                  <p className="text-2xl font-bold text-red-600">{formatNumber(summary?.monthlyStockOut || 0)}</p>
                </div>
                <TrendingDown className="w-8 h-8 text-red-500 opacity-20" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Click để xem chi tiết</p>
            </CardContent>
          </Card>
        </button>
      </div>

      {/* Alerts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Below Min Alert */}
        <Card className={alertsBelowMin.length > 0 ? 'border-yellow-300' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${alertsBelowMin.length > 0 ? 'text-yellow-600' : 'text-muted-foreground'}`} />
              Cảnh báo tồn kho dưới định mức
              {alertsBelowMin.length > 0 && (
                <span className="ml-auto bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full">
                  {alertsBelowMin.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alertsBelowMin.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Không có sản phẩm nào dưới định mức
              </p>
            ) : (
              <div className="max-h-[200px] overflow-y-auto space-y-2">
                {alertsBelowMin.slice(0, 10).map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded bg-yellow-50 border border-yellow-100">
                    <div>
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600">{formatNumber(p.stock)}</p>
                      <p className="text-xs text-muted-foreground">/ {formatNumber(p.minThreshold)}</p>
                    </div>
                  </div>
                ))}
                {alertsBelowMin.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    ...và {alertsBelowMin.length - 10} sản phẩm khác
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Above Max Alert */}
        <Card className={alertsAboveMax.length > 0 ? 'border-orange-300' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${alertsAboveMax.length > 0 ? 'text-orange-600' : 'text-muted-foreground'}`} />
              Cảnh báo tồn kho trên định mức
              {alertsAboveMax.length > 0 && (
                <span className="ml-auto bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded-full">
                  {alertsAboveMax.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alertsAboveMax.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Không có sản phẩm nào trên định mức
              </p>
            ) : (
              <div className="max-h-[200px] overflow-y-auto space-y-2">
                {alertsAboveMax.slice(0, 10).map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded bg-orange-50 border border-orange-100">
                    <div>
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-orange-600">{formatNumber(p.stock)}</p>
                      <p className="text-xs text-muted-foreground">/ {formatNumber(p.maxThreshold)}</p>
                    </div>
                  </div>
                ))}
                {alertsAboveMax.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    ...và {alertsAboveMax.length - 10} sản phẩm khác
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart - 3 lines */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">
            Biểu đồ Nhập - Xuất - Tồn ({period === 'week' ? '12 tuần gần nhất' : '12 tháng gần nhất'})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartDataFormatted}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(value: number) => formatNumber(value)} />
              <Legend />
              <Line type="monotone" dataKey="Nhập" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Xuất" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Tồn" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Top 20 Products Highest */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Top 20 tồn kho nhiều nhất
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[300px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">STT</TableHead>
                    <TableHead>Tên sản phẩm</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Tồn kho</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProductsHighest.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-muted-foreground">{p.rank}</TableCell>
                      <TableCell className="font-medium truncate max-w-[150px]">{p.name}</TableCell>
                      <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">{formatNumber(p.stock)}</TableCell>
                    </TableRow>
                  ))}
                  {topProductsHighest.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                        Không có dữ liệu
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Top 20 Products Lowest */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-600" />
              Top 20 tồn kho ít nhất
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[300px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">STT</TableHead>
                    <TableHead>Tên sản phẩm</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Tồn kho</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProductsLowest.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-muted-foreground">{p.rank}</TableCell>
                      <TableCell className="font-medium truncate max-w-[150px]">{p.name}</TableCell>
                      <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                      <TableCell className={`text-right font-medium ${p.stock === 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                        {formatNumber(p.stock)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {topProductsLowest.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                        Không có dữ liệu
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Zones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 10 Zones Highest */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-green-600" />
              Top 10 khu vực chứa nhiều nhất
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[300px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">STT</TableHead>
                    <TableHead>Tên khu vực</TableHead>
                    <TableHead className="text-right">Sức chứa</TableHead>
                    <TableHead className="text-right">Hiện tại</TableHead>
                    <TableHead>% Sử dụng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topZonesHighest.map((z) => (
                    <TableRow key={z.id}>
                      <TableCell className="text-muted-foreground">{z.rank}</TableCell>
                      <TableCell className="font-medium">{z.name}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatNumber(z.maxCapacity)}</TableCell>
                      <TableCell className="text-right font-medium">{formatNumber(z.currentStock)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-12 rounded-full bg-gray-200">
                            <div
                              className={`h-2 rounded-full ${
                                z.usagePercent > 90 ? 'bg-red-500' :
                                z.usagePercent > 70 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(100, z.usagePercent)}%` }}
                            />
                          </div>
                          <span className="text-xs">{z.usagePercent}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {topZonesHighest.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                        Không có dữ liệu
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Top 10 Zones Lowest */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-muted-foreground" />
              Top 10 khu vực chứa ít nhất
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[300px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">STT</TableHead>
                    <TableHead>Tên khu vực</TableHead>
                    <TableHead className="text-right">Sức chứa</TableHead>
                    <TableHead className="text-right">Hiện tại</TableHead>
                    <TableHead>% Sử dụng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topZonesLowest.map((z) => (
                    <TableRow key={z.id}>
                      <TableCell className="text-muted-foreground">{z.rank}</TableCell>
                      <TableCell className="font-medium">{z.name}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatNumber(z.maxCapacity)}</TableCell>
                      <TableCell className="text-right font-medium">{formatNumber(z.currentStock)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-12 rounded-full bg-gray-200">
                            <div
                              className={`h-2 rounded-full bg-muted-foreground`}
                              style={{ width: `${Math.min(100, z.usagePercent)}%` }}
                            />
                          </div>
                          <span className="text-xs">{z.usagePercent}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {topZonesLowest.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                        Không có dữ liệu
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <DetailDialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        type={detailType}
        data={detailData}
        total={detailTotal}
        loading={detailLoading}
        page={detailPage}
        onPageChange={handleDetailPageChange}
      />
    </AppLayout>
  );
}
