import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Package, TrendingDown, TrendingUp, Warehouse } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AppLayout from '../components/layout/AppLayout';
import { api } from '../services/api';
import { formatDateTime, formatNumber } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

type Period = 'week' | 'month' | 'quarter';

interface DashboardSummary {
  totalProducts: number;
  totalStock: number;
  totalInventoryValue: number;
  monthlyStockIn: number;
  monthlyStockOut: number;
  capacityRatio: number;
}

interface ChartDataV2 {
  labels: string[];
  stockIn: number[];
  stockOut: number[];
  inventory: number[];
  period: Period;
}

interface AlertProduct {
  id: string;
  name: string;
  sku: string;
  stock: number;
  minThreshold: number;
  maxThreshold: number;
}

interface TopZone {
  rank: number;
  id: string;
  name: string;
  maxCapacity: number;
  currentStock: number;
  usagePercent: number;
}

function getDefaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function DetailDialog({
  open,
  onClose,
  title,
  rows,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  rows: any[];
  loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="spinner" />
          </div>
        ) : (
          <div className="max-h-[65vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày</TableHead>
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Số lượng</TableHead>
                  <TableHead>Người thực hiện</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length > 0 ? (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.createdAt ? formatDateTime(row.createdAt) : '-'}</TableCell>
                      <TableCell>{row.productName ?? row.name ?? '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{row.productSku ?? row.sku ?? '-'}</TableCell>
                      <TableCell className="text-right font-medium">
                        {typeof row.quantity === 'number'
                          ? formatNumber(row.quantity)
                          : typeof row.stock === 'number'
                            ? formatNumber(row.stock)
                            : '-'}
                      </TableCell>
                      <TableCell>{row.userName ?? row.category?.name ?? '-'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-slate-500">
                      Không có dữ liệu trong khoảng thời gian đã chọn.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function DashboardPage() {
  const defaultRange = useMemo(() => getDefaultRange(), []);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [chartData, setChartData] = useState<ChartDataV2 | null>(null);
  const [belowMin, setBelowMin] = useState<AlertProduct[]>([]);
  const [aboveMax, setAboveMax] = useState<AlertProduct[]>([]);
  const [topZonesHighest, setTopZonesHighest] = useState<TopZone[]>([]);
  const [topZonesLowest, setTopZonesLowest] = useState<TopZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('month');
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [detailTitle, setDetailTitle] = useState('');
  const [detailRows, setDetailRows] = useState<any[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const params = { startDate, endDate };
      const [summaryRes, chartRes, belowMinRes, aboveMaxRes, topZonesHighestRes, topZonesLowestRes] = await Promise.allSettled([
        api.get('/dashboard/summary', { params }),
        api.get('/dashboard/chart-v2', { params: { period } }),
        api.get('/dashboard/alerts/below-min'),
        api.get('/dashboard/alerts/above-max'),
        api.get('/dashboard/top-zones', { params: { type: 'highest', limit: 10 } }),
        api.get('/dashboard/top-zones', { params: { type: 'lowest', limit: 10 } }),
      ]);

      if (summaryRes.status === 'fulfilled') {
        setSummary(summaryRes.value.data);
      } else {
        setSummary(null);
      }

      if (chartRes.status === 'fulfilled') {
        setChartData(chartRes.value.data);
      } else {
        setChartData(null);
      }

      setBelowMin(belowMinRes.status === 'fulfilled' ? belowMinRes.value.data || [] : []);
      setAboveMax(aboveMaxRes.status === 'fulfilled' ? aboveMaxRes.value.data || [] : []);
      setTopZonesHighest(topZonesHighestRes.status === 'fulfilled' ? topZonesHighestRes.value.data || [] : []);
      setTopZonesLowest(topZonesLowestRes.status === 'fulfilled' ? topZonesLowestRes.value.data || [] : []);

      if (summaryRes.status === 'rejected' || chartRes.status === 'rejected') {
        setErrorMessage('Dashboard đang có API lỗi ở backend hoặc database schema chưa cập nhật. Hãy chạy migrate database rồi tải lại trang.');
      }
    } catch (error) {
      console.error('Dashboard error:', error);
      setErrorMessage('Khong tai duoc du lieu dashboard. Vui long kiem tra backend va database.');
    } finally {
      setIsLoading(false);
    }
  }, [endDate, period, startDate]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const openDetail = async (type: 'products' | 'stock' | 'stock_in' | 'stock_out', title: string) => {
    setDetailTitle(title);
    setDetailOpen(true);
    setDetailLoading(true);

    try {
      const params = { page: 1, limit: 50, startDate, endDate };
      const endpoint =
        type === 'products'
          ? '/dashboard/detail/products'
          : type === 'stock'
            ? '/dashboard/detail/stock'
            : `/dashboard/detail/transactions?type=${type}`;
      const res = await api.get(endpoint, { params });
      setDetailRows(res.data.data || []);
    } catch (error) {
      console.error('Detail error:', error);
      setDetailRows([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const renderZoneList = (zones: TopZone[], accent: 'violet' | 'emerald') => {
    const accentText = accent === 'violet' ? 'text-violet-600' : 'text-emerald-600';
    const accentBar = accent === 'violet' ? 'bg-violet-500' : 'bg-emerald-500';

    if (zones.length === 0) {
      return <div className="py-8 text-center text-slate-500">Chưa có dữ liệu vị trí.</div>;
    }

    return zones.map((zone) => (
      <div key={zone.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-4">
          <div className="w-8 text-sm font-semibold text-slate-400">{zone.rank}.</div>
          <div className="min-w-0">
            <div className="truncate font-semibold text-slate-900">{zone.name}</div>
            <div className="text-sm text-slate-500">
              {formatNumber(zone.currentStock)} sản phẩm
              {zone.maxCapacity > 0 ? ` • ${zone.usagePercent}% sức chứa` : ''}
            </div>
          </div>
        </div>

        <div className="flex min-w-[180px] items-center gap-4">
          <div className={`w-14 text-right text-2xl font-bold ${accentText}`}>{formatNumber(zone.currentStock)}</div>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full ${accentBar}`}
              style={{
                width: `${Math.min(zone.maxCapacity > 0 ? zone.usagePercent : zone.currentStock > 0 ? 100 : 0, 100)}%`,
              }}
            />
          </div>
        </div>
      </div>
    ));
  };

  const chartRows =
    chartData?.labels.map((label, index) => ({
      name: label,
      'Nhập kho': chartData.stockIn[index],
      'Xuất kho': chartData.stockOut[index],
      'Tồn kho': chartData.inventory[index],
    })) ?? [];

  const cards = [
    {
      title: 'Tổng sản phẩm',
      value: summary?.totalProducts ?? 0,
      icon: Package,
      onClick: () => openDetail('products', 'Danh sách sản phẩm'),
    },
    {
      title: 'Tổng tồn kho',
      value: summary?.totalStock ?? 0,
      icon: Warehouse,
      onClick: () => openDetail('stock', 'Chi tiết tồn kho'),
    },
    {
      title: 'Nhập kho theo khoảng chọn',
      value: summary?.monthlyStockIn ?? 0,
      icon: TrendingUp,
      onClick: () => openDetail('stock_in', 'Giao dịch nhập kho'),
    },
    {
      title: 'Xuất kho theo khoảng chọn',
      value: summary?.monthlyStockOut ?? 0,
      icon: TrendingDown,
      onClick: () => openDetail('stock_out', 'Giao dịch xuất kho'),
    },
    {
      title: 'Tong gia tri hang ton kho',
      value: summary?.totalInventoryValue ?? 0,
      icon: Warehouse,
      onClick: () => openDetail('stock', 'Chi tiet ton kho'),
      isCurrency: true,
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-950">Dashboard</h2>
            <p className="text-sm text-slate-500">Theo dõi nhanh tình hình kho theo khoảng thời gian chọn.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2">
              <span className="text-sm text-slate-500">Từ ngày</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-sm outline-none" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2">
              <span className="text-sm text-slate-500">Đến ngày</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-sm outline-none" />
            </div>
            <Button className="rounded-2xl" onClick={() => void fetchDashboard()}>
              Xem dữ liệu
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <button key={card.title} onClick={() => void card.onClick()} className="text-left">
                <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-slate-500">{card.title}</p>
                        <p className="mt-2 text-3xl font-bold text-slate-950">
                          {'isCurrency' in card && card.isCurrency
                            ? `${formatNumber(card.value)}đ`
                            : formatNumber(card.value)}
                        </p>
                      </div>
                      <Icon className="h-8 w-8 text-violet-300" />
                    </div>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {errorMessage}
          </div>
        ) : null}

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b">
            <CardTitle>Biểu đồ nhập xuất tồn</CardTitle>
            <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
              {([
                ['week', 'Tuần'],
                ['month', 'Tháng'],
                ['quarter', 'Quý'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    period === key ? 'bg-white font-medium text-slate-950 shadow-sm' : 'text-slate-500'
                  }`}
                  onClick={() => setPeriod(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            {isLoading ? (
              <div className="flex h-[320px] items-center justify-center">
                <div className="spinner" />
              </div>
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartRows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="Nhập kho" stroke="#16a34a" strokeWidth={2.5} />
                    <Line type="monotone" dataKey="Xuất kho" stroke="#e11d48" strokeWidth={2.5} />
                    <Line type="monotone" dataKey="Tồn kho" stroke="#4f46e5" strokeWidth={2.5} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Cảnh báo dưới ngưỡng tối thiểu
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {belowMin.length > 0 ? (
                belowMin.slice(0, 6).map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                    <div>
                      <div className="font-medium text-slate-900">{item.name}</div>
                      <div className="font-mono text-xs text-slate-500">{item.sku}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-amber-600">{formatNumber(item.stock)}</div>
                      <div className="text-xs text-slate-400">Min: {formatNumber(item.minThreshold)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-500">Không có cảnh báo dưới ngưỡng.</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-rose-500" />
                Cảnh báo vượt ngưỡng tối đa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {aboveMax.length > 0 ? (
                aboveMax.slice(0, 6).map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                    <div>
                      <div className="font-medium text-slate-900">{item.name}</div>
                      <div className="font-mono text-xs text-slate-500">{item.sku}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-rose-600">{formatNumber(item.stock)}</div>
                      <div className="text-xs text-slate-400">Max: {formatNumber(item.maxThreshold)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-500">Không có cảnh báo vượt ngưỡng.</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top 10 vị trí chứa nhiều nhất</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">{renderZoneList(topZonesHighest, 'violet')}</CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top 10 vị trí chứa ít nhất</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">{renderZoneList(topZonesLowest, 'emerald')}</CardContent>
          </Card>
        </div>
      </div>

      <DetailDialog open={detailOpen} onClose={() => setDetailOpen(false)} title={detailTitle} rows={detailRows} loading={detailLoading} />
    </AppLayout>
  );
}
