import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  FileDown,
  FileText,
  Package,
  TrendingDown,
  TrendingUp,
  Warehouse,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import AppLayout from '../components/layout/AppLayout';
import { api } from '../services/api';
import { formatDateTime, formatNumber } from '../lib/utils';
import { exportTransactionsToExcel } from '../lib/transactionExcel';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { TransactionExportDialog } from '../components/inventory/TransactionExportDialog';

type Period = 'week' | 'month' | 'quarter' | 'year';
type DetailType = 'products' | 'stock' | 'stock_in' | 'stock_out' | 'order_plans';

interface DashboardSummary {
  totalCategories: number;
  totalStock: number;
  totalInventoryValue: number;
  monthlyStockIn: number;
  monthlyStockOut: number;
  totalOrderPlanQuantity: number;
  capacityRatio: number;
}

interface ChartDataV2 {
  labels: string[];
  stockIn: number[];
  stockOut: number[];
  inventory: number[];
  period: Period;
}


interface AlertCategory {
  categoryId: string;
  categoryName: string;
  stock: number;
  sku?: string | null;
  groupName?: string | null;
}

interface TopZone {
  rank: number;
  id: string;
  name: string;
  maxCapacity: number;
  currentStock: number;
  usagePercent: number;
}

interface TopCategory {
  rank: number;
  categoryId: string;
  categoryName: string;
  stock: number;
  sku?: string | null;
  groupName?: string | null;
}

interface WarehouseTypeOption {
  id: string;
  name: string;
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
  type,
  title,
  rows,
  loading,
  canExportTransactions,
  onOpenExport,
}: {
  open: boolean;
  onClose: () => void;
  type: DetailType | null;
  title: string;
  rows: any[];
  loading: boolean;
  canExportTransactions: boolean;
  onOpenExport: () => void;
}) {
  const isCategoryType = type === 'products';
  const isSkuStockType = type === 'stock';
  const isTransactionType = type === 'stock_in' || type === 'stock_out';
  const isOrderPlanType = type === 'order_plans';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] sm:w-full">
        <DialogHeader className="flex flex-row items-center justify-between gap-3 pr-10">
          <div>
            <DialogTitle>{title}</DialogTitle>
            {!loading && rows.length > 0 && (
              <p className="mt-0.5 text-sm text-slate-500">{rows.length} dòng dữ liệu</p>
            )}
          </div>
          {canExportTransactions && (
            <Button variant="outline" className="h-10 rounded-xl" onClick={onOpenExport}>
              <Download className="h-4 w-4" />
              Xuất Excel
            </Button>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="spinner" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-14 text-center text-slate-500">
            <p className="text-base font-medium">Không có dữ liệu</p>
            <p className="mt-1 text-sm">Không có dữ liệu trong khoảng thời gian đã chọn.</p>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto">
            {isCategoryType && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-center">#</TableHead>
                    <TableHead>Tên danh mục</TableHead>
                    <TableHead>Mã danh mục</TableHead>
                    <TableHead className="text-right">Tồn kho</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow key={row.categoryId ?? idx}>
                      <TableCell className="text-center text-slate-400">{idx + 1}</TableCell>
                      <TableCell className="font-semibold text-slate-900">{row.categoryName || '-'}</TableCell>
                      <TableCell className="font-mono text-xs text-indigo-600">{row.sku || '-'}</TableCell>
                      <TableCell className={`text-right font-bold ${(row.stock ?? 0) > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {formatNumber(row.stock ?? 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {isSkuStockType && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-center">#</TableHead>
                    <TableHead>Tên sản phẩm</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Danh mục</TableHead>
                    <TableHead className="text-right">Tồn kho</TableHead>
                    <TableHead className="text-right">Đơn giá</TableHead>
                    <TableHead className="text-right">Tổng giá trị</TableHead>
                    <TableHead className="text-right">Ngưỡng min</TableHead>
                    <TableHead className="text-right">Ngưỡng max</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow key={row.categoryId ?? idx}>
                      <TableCell className="text-center text-slate-400">{idx + 1}</TableCell>
                      <TableCell className="font-semibold text-slate-900">{row.categoryName || '-'}</TableCell>
                      <TableCell className="font-mono text-xs text-indigo-600">{row.sku || '-'}</TableCell>
                      <TableCell className="text-sm text-slate-500">{row.groupName || '-'}</TableCell>
                      <TableCell className={`text-right font-bold ${(row.stock ?? 0) > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {formatNumber(row.stock ?? 0)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-500">
                        {(row.purchasePrice ?? 0) > 0 ? `${formatNumber(row.purchasePrice ?? 0)}đ` : '-'}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${(row.totalValue ?? 0) > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                        {(row.totalValue ?? 0) > 0 ? `${formatNumber(row.totalValue ?? 0)}đ` : '-'}
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-500">
                        {row.minThreshold != null ? formatNumber(row.minThreshold) : '-'}
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-500">
                        {row.maxThreshold != null ? formatNumber(row.maxThreshold) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {isTransactionType && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ngày</TableHead>
                    <TableHead>Tên sản phẩm</TableHead>
                    <TableHead className="text-right">Số lượng</TableHead>
                    <TableHead>Người thực hiện</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow key={row.id ?? idx}>
                      <TableCell className="text-sm text-slate-600">
                        {row.createdAt ? formatDateTime(row.createdAt) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-slate-900">{row.categoryName || '-'}</div>
                        {row.groupName && <div className="text-xs text-slate-500">{row.groupName}</div>}
                      </TableCell>
                      <TableCell className="text-right text-lg font-bold text-indigo-600">
                        {formatNumber(row.quantity ?? 0)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">{row.userName || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {isOrderPlanType && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ngày tạo</TableHead>
                    <TableHead>Tên sản phẩm</TableHead>
                    <TableHead className="text-right">Số lượng đặt</TableHead>
                    <TableHead>Người tạo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow key={row.id ?? idx}>
                      <TableCell className="text-sm text-slate-600">
                        {row.createdAt ? formatDateTime(row.createdAt) : '-'}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900">{row.categoryName || '-'}</TableCell>
                      <TableCell className="text-right text-lg font-bold text-violet-600">
                        {formatNumber(row.quantity ?? 0)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">{row.userName || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
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
  const [belowMin, setBelowMin] = useState<AlertCategory[]>([]);
  const [aboveMax, setAboveMax] = useState<AlertCategory[]>([]);
  const [topZonesHighest, setTopZonesHighest] = useState<TopZone[]>([]);
  const [topZonesLowest, setTopZonesLowest] = useState<TopZone[]>([]);
  const [topCategoriesHighest, setTopCategoriesHighest] = useState<TopCategory[]>([]);
  const [topCategoriesLowest, setTopCategoriesLowest] = useState<TopCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('month');
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [detailTitle, setDetailTitle] = useState('');
  const [detailRows, setDetailRows] = useState<any[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailType, setDetailType] = useState<DetailType | null>(null);
  const [transactionExportOpen, setTransactionExportOpen] = useState(false);
  const [transactionExporting, setTransactionExporting] = useState(false);
  const [warehouseTypes, setWarehouseTypes] = useState<WarehouseTypeOption[]>([]);
  const [selectedWarehouseTypeId, setSelectedWarehouseTypeId] = useState('all');

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const commonParams =
        selectedWarehouseTypeId !== 'all'
          ? { warehouseTypeId: selectedWarehouseTypeId }
          : {};
      const params = { startDate, endDate, ...commonParams };
      const [
        summaryRes,
        chartRes,
        belowMinRes,
        aboveMaxRes,
        topZonesHighestRes,
        topZonesLowestRes,
        topCategoriesHighestRes,
        topCategoriesLowestRes,
      ] = await Promise.allSettled([
        api.get('/dashboard/summary', { params }),
        api.get('/dashboard/chart-v2', { params: { period, ...commonParams } }),
        api.get('/dashboard/alerts/below-min', { params: commonParams }),
        api.get('/dashboard/alerts/above-max', { params: commonParams }),
        api.get('/dashboard/top-zones', { params: { type: 'highest', limit: 10, ...commonParams } }),
        api.get('/dashboard/top-zones', { params: { type: 'lowest', limit: 10, ...commonParams } }),
        api.get('/dashboard/top-categories', { params: { type: 'highest', limit: 20, ...commonParams } }),
        api.get('/dashboard/top-categories', { params: { type: 'lowest', limit: 20, ...commonParams } }),
      ]);

      setSummary(summaryRes.status === 'fulfilled' ? summaryRes.value.data : null);
      setChartData(chartRes.status === 'fulfilled' ? chartRes.value.data : null);
      setBelowMin(belowMinRes.status === 'fulfilled' ? belowMinRes.value.data || [] : []);
      setAboveMax(aboveMaxRes.status === 'fulfilled' ? aboveMaxRes.value.data || [] : []);
      setTopZonesHighest(
        topZonesHighestRes.status === 'fulfilled' ? topZonesHighestRes.value.data || [] : [],
      );
      setTopZonesLowest(
        topZonesLowestRes.status === 'fulfilled' ? topZonesLowestRes.value.data || [] : [],
      );
      setTopCategoriesHighest(
        topCategoriesHighestRes.status === 'fulfilled'
          ? topCategoriesHighestRes.value.data || []
          : [],
      );
      setTopCategoriesLowest(
        topCategoriesLowestRes.status === 'fulfilled'
          ? topCategoriesLowestRes.value.data || []
          : [],
      );

      if (summaryRes.status === 'rejected' || chartRes.status === 'rejected') {
        setErrorMessage(
          'Dashboard dang co API loi o backend hoac database schema chua cap nhat.',
        );
      }
    } catch (error) {
      console.error('Dashboard error:', error);
      setErrorMessage('Khong tai duoc du lieu dashboard. Vui long kiem tra backend va database.');
    } finally {
      setIsLoading(false);
    }
  }, [endDate, period, selectedWarehouseTypeId, startDate]);

  useEffect(() => {
    const fetchWarehouseTypes = async () => {
      try {
        const res = await api.get('/input-declarations/warehouse-types');
        setWarehouseTypes(res.data || []);
      } catch (error) {
        console.error('Warehouse types error:', error);
      }
    };

    void fetchWarehouseTypes();
  }, []);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const openDetail = async (
    type: DetailType,
    title: string,
  ) => {
    setDetailTitle(title);
    setDetailType(type);
    setDetailOpen(true);
    setDetailLoading(true);

    try {
      const params = {
        page: 1,
        limit: 500,
        startDate,
        endDate,
        ...(selectedWarehouseTypeId !== 'all'
          ? { warehouseTypeId: selectedWarehouseTypeId }
          : {}),
      };
      const endpoint =
        type === 'products'
          ? '/dashboard/detail/categories'
          : type === 'stock'
            ? '/dashboard/detail/stock'
            : type === 'order_plans'
              ? '/dashboard/detail/order-plans'
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

  const exportDetailTransactions = useCallback(async (includeFilters: boolean) => {
    if (detailType !== 'stock_in' && detailType !== 'stock_out') return;

    setTransactionExporting(true);
    try {
      const params: Record<string, string | number> = {
        type: detailType,
        page: 1,
        limit: 100000,
      };

      if (includeFilters) {
        params.startDate = startDate;
        params.endDate = endDate;
        if (selectedWarehouseTypeId !== 'all') {
          params.warehouseTypeId = selectedWarehouseTypeId;
        }
      }

      const res = await api.get('/dashboard/detail/transactions', { params });
      const exportRows = (res.data.data || []).map((row: Record<string, unknown>) => ({
        ...row,
        kind: detailType === 'stock_in' ? 'STOCK_IN' : 'STOCK_OUT',
      }));

      if (exportRows.length === 0) {
        alert('Không có transaction nào để xuất Excel.');
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      exportTransactionsToExcel(
        exportRows,
        `dashboard-${detailType}-${includeFilters ? 'filtered' : 'all'}-${today}.xlsx`,
      );
      setTransactionExportOpen(false);
    } catch (error) {
      console.error('Detail export error:', error);
      alert('Không thể xuất Excel transaction');
    } finally {
      setTransactionExporting(false);
    }
  }, [detailType, endDate, selectedWarehouseTypeId, startDate]);

  const exportBelowMin = () => {
    if (belowMin.length === 0) { alert('Khong co du lieu canh bao duoi nguong'); return; }
    const ws = XLSX.utils.json_to_sheet(
      belowMin.map((item, i) => ({
        STT: i + 1,
        'Ten san pham': item.categoryName,
        SKU: item.groupName || '-',
        'Ton kho': item.stock,
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Canh bao duoi nguong');
    XLSX.writeFile(wb, `canh-bao-duoi-nguong-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportAboveMax = () => {
    if (aboveMax.length === 0) { alert('Khong co du lieu canh bao vuot nguong'); return; }
    const ws = XLSX.utils.json_to_sheet(
      aboveMax.map((item, i) => ({
        STT: i + 1,
        'Ten san pham': item.categoryName,
        SKU: item.groupName || '-',
        'Ton kho': item.stock,
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Canh bao vuot nguong');
    XLSX.writeFile(wb, `canh-bao-vuot-nguong-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportTopZones = async (type: 'highest' | 'lowest') => {
    try {
      const commonParams = selectedWarehouseTypeId !== 'all' ? { warehouseTypeId: selectedWarehouseTypeId } : {};
      const res = await api.get('/dashboard/top-zones', { params: { type, limit: 9999, ...commonParams } });
      const data: TopZone[] = res.data || [];
      if (data.length === 0) { alert('Khong co du lieu vi tri'); return; }
      const ws = XLSX.utils.json_to_sheet(
        data.map((z) => ({
          STT: z.rank,
          'Vi tri': z.name,
          'Ton hien tai': z.currentStock,
          'Suc chua toi da': z.maxCapacity > 0 ? z.maxCapacity : '-',
          'Ti le su dung (%)': z.maxCapacity > 0 ? z.usagePercent : '-',
        })),
      );
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, type === 'highest' ? 'Vi tri nhieu nhat' : 'Vi tri it nhat');
      XLSX.writeFile(wb, `top-vi-tri-${type}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      alert('Khong the xuat Excel vi tri');
    }
  };

  const exportTopCategories = async (type: 'highest' | 'lowest') => {
    try {
      const commonParams = selectedWarehouseTypeId !== 'all' ? { warehouseTypeId: selectedWarehouseTypeId } : {};
      const res = await api.get('/dashboard/top-categories', { params: { type, limit: 9999, ...commonParams } });
      const data: TopCategory[] = res.data || [];
      if (data.length === 0) { alert('Khong co du lieu san pham'); return; }
      const ws = XLSX.utils.json_to_sheet(
        data.map((c) => ({
          STT: c.rank,
          'Ten san pham': c.categoryName,
          'Danh muc': c.groupName || '-',
          'Ton kho': c.stock,
        })),
      );
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, type === 'highest' ? 'Ton nhieu nhat' : 'Ton it nhat');
      XLSX.writeFile(wb, `top-san-pham-${type}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      alert('Khong the xuat Excel san pham');
    }
  };

  const renderZoneList = (zones: TopZone[], accent: 'violet' | 'emerald') => {
    const accentText = accent === 'violet' ? 'text-violet-600' : 'text-emerald-600';
    const accentBar = accent === 'violet' ? 'bg-violet-500' : 'bg-emerald-500';

    if (zones.length === 0) {
      return <div className="py-8 text-center text-slate-500">Chua co du lieu vi tri.</div>;
    }

    return zones.map((zone) => (
      <div
        key={zone.id}
        className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 px-4 py-3"
      >
        <div className="flex min-w-0 items-center gap-4">
          <div className="w-8 text-sm font-semibold text-slate-400">{zone.rank}.</div>
          <div className="min-w-0">
            <div className="truncate font-semibold text-slate-900">{zone.name}</div>
            <div className="text-sm text-slate-500">
              {formatNumber(zone.currentStock)} san pham
              {zone.maxCapacity > 0 ? ` - ${zone.usagePercent}% suc chua` : ''}
            </div>
          </div>
        </div>

        <div className="flex min-w-[180px] items-center gap-4">
          <div className={`w-14 text-right text-2xl font-bold ${accentText}`}>
            {formatNumber(zone.currentStock)}
          </div>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full ${accentBar}`}
              style={{
                width: `${Math.min(
                  zone.maxCapacity > 0 ? zone.usagePercent : zone.currentStock > 0 ? 100 : 0,
                  100,
                )}%`,
              }}
            />
          </div>
        </div>
      </div>
    ));
  };

  const renderCategoryList = (categories: TopCategory[], accent: 'violet' | 'emerald') => {
    const accentText = accent === 'violet' ? 'text-violet-600' : 'text-emerald-600';

    if (categories.length === 0) {
      return <div className="py-8 text-center text-slate-500">Chua co du lieu san pham.</div>;
    }

    return categories.map((category) => (
      <div
        key={category.categoryId}
        className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-3"
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="w-7 shrink-0 text-sm font-semibold text-slate-400">{category.rank}.</div>
          <div className="min-w-0">
            <div className="break-words font-semibold text-slate-900 text-sm leading-snug">
              {category.categoryName}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {category.groupName ? `Danh muc: ${category.groupName}` : 'Tong ton theo san pham'}
            </div>
          </div>
        </div>

        <div className={`shrink-0 min-w-[48px] text-right text-xl font-bold ${accentText}`}>
          {formatNumber(category.stock)}
        </div>
      </div>
    ));
  };

  const chartRows =
    chartData?.labels.map((label, index) => ({
      name: label,
      'Nhap kho': chartData.stockIn[index],
      'Xuat kho': chartData.stockOut[index],
      'Ton kho': chartData.inventory[index],
    })) ?? [];

  const cards = [
    {
      title: 'Tổng danh mục',
      value: summary?.totalCategories ?? 0,
      icon: Package,
      onClick: () => openDetail('products', 'Danh sách danh mục & tồn kho'),
    },
    {
      title: 'Tổng tồn kho',
      value: summary?.totalStock ?? 0,
      icon: Warehouse,
      onClick: () => openDetail('stock', 'Chi tiết tồn kho theo sản phẩm'),
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
      title: 'SL kế hoạch nhập hàng',
      value: summary?.totalOrderPlanQuantity ?? 0,
      icon: FileText,
      onClick: () => openDetail('order_plans', 'Kế hoạch đặt hàng trong khoảng chọn'),
    },
    {
      title: 'Tổng giá trị hàng tồn kho',
      value: summary?.totalInventoryValue ?? 0,
      icon: Warehouse,
      onClick: () => openDetail('stock', 'Chi tiết tồn kho theo sản phẩm'),
      isCurrency: true,
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-950">Dashboard</h2>
            <p className="text-sm text-slate-500">
              Theo doi nhanh tinh hinh kho theo khoang thoi gian chon.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2">
              <span className="text-sm text-slate-500">Loai kho</span>
              <select
                value={selectedWarehouseTypeId}
                onChange={(e) => setSelectedWarehouseTypeId(e.target.value)}
                className="bg-transparent text-sm outline-none"
              >
                <option value="all">Tat ca</option>
                {warehouseTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2">
              <span className="text-sm text-slate-500">Tu ngay</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-sm outline-none"
              />
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2">
              <span className="text-sm text-slate-500">Den ngay</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-sm outline-none"
              />
            </div>
            <Button className="rounded-2xl" onClick={() => void fetchDashboard()}>
              Xem du lieu
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.title}
                onClick={() => void card.onClick()}
                className="text-left"
              >
                <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-slate-500">{card.title}</p>
                        <p className="mt-2 text-3xl font-bold text-slate-950">
                          {'isCurrency' in card && card.isCurrency
                            ? `${formatNumber(card.value)}d`
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
            <CardTitle>Bieu do nhap xuat ton</CardTitle>
            <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
              {([
                ['week', 'Tuần'],
                ['month', 'Tháng'],
                ['quarter', 'Quý'],
                ['year', 'Năm'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    period === key
                      ? 'bg-white font-medium text-slate-950 shadow-sm'
                      : 'text-slate-500'
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
                    <Line
                      type="monotone"
                      dataKey="Nhap kho"
                      stroke="#16a34a"
                      strokeWidth={2.5}
                    />
                    <Line
                      type="monotone"
                      dataKey="Xuat kho"
                      stroke="#e11d48"
                      strokeWidth={2.5}
                    />
                    <Line
                      type="monotone"
                      dataKey="Ton kho"
                      stroke="#4f46e5"
                      strokeWidth={2.5}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Canh bao duoi nguong toi thieu
                {belowMin.length > 0 && (
                  <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    {belowMin.length}
                  </span>
                )}
              </CardTitle>
              <button
                type="button"
                onClick={exportBelowMin}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                title="Xuat toan bo danh sach canh bao"
              >
                <FileDown size={13} />
                Xuat Excel
              </button>
            </CardHeader>
            <CardContent className="space-y-3">
              {belowMin.length > 0 ? (
                belowMin.slice(0, 6).map((item) => (
                  <div
                    key={item.categoryId}
                    className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"
                  >
                    <div>
                      <div className="font-medium text-slate-900">{item.categoryName}</div>
                      {item.groupName && <div className="text-xs text-slate-500">{item.groupName}</div>}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-amber-600">
                        {formatNumber(item.stock)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-500">
                  Khong co canh bao duoi nguong.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-rose-500" />
                Canh bao vuot nguong toi da
                {aboveMax.length > 0 && (
                  <span className="ml-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                    {aboveMax.length}
                  </span>
                )}
              </CardTitle>
              <button
                type="button"
                onClick={exportAboveMax}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                title="Xuat toan bo danh sach canh bao"
              >
                <FileDown size={13} />
                Xuat Excel
              </button>
            </CardHeader>
            <CardContent className="space-y-3">
              {aboveMax.length > 0 ? (
                aboveMax.slice(0, 6).map((item) => (
                  <div
                    key={item.categoryId}
                    className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"
                  >
                    <div>
                      <div className="font-medium text-slate-900">{item.categoryName}</div>
                      {item.groupName && <div className="text-xs text-slate-500">{item.groupName}</div>}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-rose-600">
                        {formatNumber(item.stock)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-500">
                  Khong co canh bao vuot nguong.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-base">Top 10 vi tri chua nhieu nhat</CardTitle>
              <button
                type="button"
                onClick={() => void exportTopZones('highest')}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                title="Xuat toan bo danh sach vi tri"
              >
                <FileDown size={13} />
                Xuat Excel
              </button>
            </CardHeader>
            <CardContent className="space-y-3">
              {renderZoneList(topZonesHighest, 'violet')}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-base">Top 10 vi tri chua it nhat</CardTitle>
              <button
                type="button"
                onClick={() => void exportTopZones('lowest')}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                title="Xuat toan bo danh sach vi tri"
              >
                <FileDown size={13} />
                Xuat Excel
              </button>
            </CardHeader>
            <CardContent className="space-y-3">
              {renderZoneList(topZonesLowest, 'emerald')}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-base">Top 20 san pham ton nhieu nhat</CardTitle>
              <button
                type="button"
                onClick={() => void exportTopCategories('highest')}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                title="Xuat toan bo danh sach san pham"
              >
                <FileDown size={13} />
                Xuat Excel
              </button>
            </CardHeader>
            <CardContent className="space-y-3">
              {renderCategoryList(topCategoriesHighest, 'violet')}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-base">Top 20 san pham ton thap nhat</CardTitle>
              <button
                type="button"
                onClick={() => void exportTopCategories('lowest')}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                title="Xuat toan bo danh sach san pham"
              >
                <FileDown size={13} />
                Xuat Excel
              </button>
            </CardHeader>
            <CardContent className="space-y-3">
              {renderCategoryList(topCategoriesLowest, 'emerald')}
            </CardContent>
          </Card>
        </div>
      </div>

      <DetailDialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        type={detailType}
        title={detailTitle}
        rows={detailRows}
        loading={detailLoading}
        canExportTransactions={detailType === 'stock_in' || detailType === 'stock_out'}
        onOpenExport={() => setTransactionExportOpen(true)}
      />

      <TransactionExportDialog
        open={transactionExportOpen}
        onOpenChange={setTransactionExportOpen}
        title="Xuất Excel Transaction"
        onExportAll={() => exportDetailTransactions(false)}
        onExportFiltered={() => exportDetailTransactions(true)}
        isExporting={transactionExporting}
      />
    </AppLayout>
  );
}


