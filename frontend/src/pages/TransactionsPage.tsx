import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpToLine,
  CalendarDays,
  Download,
  FileText,
  MapPin,
  PackagePlus,
  Plus,
  RefreshCcw,
  Search,
  Upload,
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { api } from '../services/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { formatNumber } from '../lib/utils';

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  price?: number;
};

type AttributeOption = {
  id: string;
  name: string;
};

type StorageZone = {
  id: string;
  name: string;
};

type PositionOption = {
  id: string;
  label: string;
  currentStock: number;
};

type TransactionRow = {
  id: string;
  createdAt: string;
  actualStockDate: string | null;
  kind: 'ALL' | 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT';
  type: 'STOCK_IN' | 'STOCK_OUT';
  quantity: number;
  signedQuantity: number;
  productName: string;
  productSku: string;
  positionLabel: string | null;
  userName: string;
  note: string;
};

type NxtReportApiRow = {
  skuComboId: string;
  compositeSku: string;
  classification: string;
  color: string;
  size: string;
  material: string;
  openingStock: number;
  totalIn: number;
  totalOut: number;
  closingStock: number;
};

type NxtReportRow = {
  sku: string;
  productName: string;
  unit: string;
  openingQty: number;
  openingValue: number;
  inQty: number;
  inValue: number;
  outQty: number;
  outValue: number;
  closingQty: number;
  closingValue: number;
};

type StockInForm = {
  productId: string;
  classificationId: string;
  materialId: string;
  colorId: string;
  sizeId: string;
  productConditionId: string;
  storageZoneId: string;
  warehousePositionId: string;
  quantity: number;
  actualStockDate: string;
  notes: string;
};

type StockOutForm = {
  productId: string;
  warehousePositionId: string;
  quantity: number;
  notes: string;
};

type AdjustmentForm = {
  productId: string;
  warehousePositionId: string;
  quantity: number;
  type: 'INCREASE' | 'DECREASE';
  reason: string;
};

type PreliminaryCheckStatus = 'PENDING' | 'COMPLETED';

type PreliminaryCheckRow = {
  id: string;
  quantity: number;
  status: PreliminaryCheckStatus;
  imageUrl?: string | null;
  note?: string | null;
  createdAt: string;
  classification: AttributeOption;
  warehouseType?: AttributeOption | null;
  creator: { id: string; name: string; email: string };
};

type PreliminaryCheckForm = {
  classificationId: string;
  quantity: number;
  warehouseTypeId: string;
  imageFile: File | null;
  imagePreview: string;
  note: string;
};

const transactionTabs = [
  { key: 'PRECHECK', label: 'Nhập kiểm sơ bộ' },
  { key: 'ALL', label: 'Tất Cả' },
  { key: 'STOCK_IN', label: 'Nhập Kho' },
  { key: 'STOCK_OUT', label: 'Xuất Kho' },
  { key: 'ADJUSTMENT', label: 'Điều Chỉnh' },
  { key: 'REPORT', label: 'Báo Cáo Nhập Xuất Tồn' },
] as const;

const defaultStockInForm = (): StockInForm => ({
  productId: '',
  classificationId: '',
  materialId: '',
  colorId: '',
  sizeId: '',
  productConditionId: '',
  storageZoneId: '',
  warehousePositionId: '',
  quantity: 1,
  actualStockDate: new Date().toISOString().slice(0, 16),
  notes: '',
});

const defaultStockOutForm = (): StockOutForm => ({
  productId: '',
  warehousePositionId: '',
  quantity: 1,
  notes: '',
});

const defaultAdjustmentForm = (): AdjustmentForm => ({
  productId: '',
  warehousePositionId: '',
  quantity: 1,
  type: 'INCREASE',
  reason: '',
});

const defaultPreliminaryForm = (): PreliminaryCheckForm => ({
  classificationId: '',
  quantity: 1,
  warehouseTypeId: '',
  imageFile: null,
  imagePreview: '',
  note: '',
});

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatDateOnly(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function formatCurrency(value: number) {
  return `${formatNumber(value)}đ`;
}

function buildCompositeSku(parts: {
  classification?: AttributeOption;
  material?: AttributeOption;
  color?: AttributeOption;
  size?: AttributeOption;
}) {
  return [parts.classification?.name, parts.color?.name, parts.size?.name, parts.material?.name]
    .filter(Boolean)
    .join('-')
    .toUpperCase();
}

function getDefaultReportRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export default function TransactionsPage() {
  const defaultRange = useMemo(() => getDefaultReportRange(), []);
  const [activeTab, setActiveTab] = useState<(typeof transactionTabs)[number]['key']>('ALL');
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [classifications, setClassifications] = useState<AttributeOption[]>([]);
  const [materials, setMaterials] = useState<AttributeOption[]>([]);
  const [colors, setColors] = useState<AttributeOption[]>([]);
  const [sizes, setSizes] = useState<AttributeOption[]>([]);
  const [productConditions, setProductConditions] = useState<AttributeOption[]>([]);
  const [storageZones, setStorageZones] = useState<StorageZone[]>([]);
  const [warehouseTypes, setWarehouseTypes] = useState<AttributeOption[]>([]);
  const [preliminaryChecks, setPreliminaryChecks] = useState<PreliminaryCheckRow[]>([]);
  const [preliminaryLoading, setPreliminaryLoading] = useState(false);
  const [preliminaryOpen, setPreliminaryOpen] = useState(false);
  const [preliminaryForm, setPreliminaryForm] = useState<PreliminaryCheckForm>(defaultPreliminaryForm);
  const [selectedPreliminaryCheck, setSelectedPreliminaryCheck] = useState<PreliminaryCheckRow | null>(null);
  const [stockInOpen, setStockInOpen] = useState(false);
  const [stockOutOpen, setStockOutOpen] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [stockInForm, setStockInForm] = useState<StockInForm>(defaultStockInForm);
  const [stockOutForm, setStockOutForm] = useState<StockOutForm>(defaultStockOutForm);
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentForm>(defaultAdjustmentForm);
  const [stockInSkuComboId, setStockInSkuComboId] = useState('');
  const [reportStartDate, setReportStartDate] = useState(defaultRange.startDate);
  const [reportEndDate, setReportEndDate] = useState(defaultRange.endDate);
  const [reportSearch, setReportSearch] = useState('');
  const [reportRows, setReportRows] = useState<NxtReportApiRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);

  const selectedClassification = useMemo(
    () => classifications.find((item) => item.id === stockInForm.classificationId),
    [classifications, stockInForm.classificationId]
  );
  const selectedMaterial = useMemo(() => materials.find((item) => item.id === stockInForm.materialId), [materials, stockInForm.materialId]);
  const selectedColor = useMemo(() => colors.find((item) => item.id === stockInForm.colorId), [colors, stockInForm.colorId]);
  const selectedSize = useMemo(() => sizes.find((item) => item.id === stockInForm.sizeId), [sizes, stockInForm.sizeId]);

  const generatedSku = useMemo(
    () =>
      buildCompositeSku({
        classification: selectedClassification,
        material: selectedMaterial,
        color: selectedColor,
        size: selectedSize,
      }),
    [selectedClassification, selectedMaterial, selectedColor, selectedSize]
  );

  const selectedStockInProduct = useMemo(() => products.find((product) => product.id === stockInForm.productId), [products, stockInForm.productId]);
  const selectedStockOutProduct = useMemo(() => products.find((product) => product.id === stockOutForm.productId), [products, stockOutForm.productId]);
  const selectedAdjustmentProduct = useMemo(() => products.find((product) => product.id === adjustmentForm.productId), [products, adjustmentForm.productId]);
  const selectedStockOutPosition = useMemo(() => positions.find((position) => position.id === stockOutForm.warehousePositionId), [positions, stockOutForm.warehousePositionId]);
  const selectedAdjustmentPosition = useMemo(
    () => positions.find((position) => position.id === adjustmentForm.warehousePositionId),
    [positions, adjustmentForm.warehousePositionId]
  );
  const pendingPreliminaryChecks = useMemo(
    () => preliminaryChecks.filter((item) => item.status === 'PENDING'),
    [preliminaryChecks]
  );

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const kind = activeTab === 'REPORT' || activeTab === 'PRECHECK' ? 'ALL' : activeTab;
      const res = await api.get('/inventory/transactions', { params: { kind, limit: 100 } });
      setRows(res.data.data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  const fetchPreliminaryChecks = useCallback(async () => {
    setPreliminaryLoading(true);
    try {
      const res = await api.get('/preliminary-checks', { params: { limit: 100 } });
      setPreliminaryChecks(res.data.data || []);
    } catch (error) {
      console.error('Error fetching preliminary checks:', error);
      setPreliminaryChecks([]);
    } finally {
      setPreliminaryLoading(false);
    }
  }, []);

  const fetchReport = useCallback(async () => {
    if (!reportStartDate || !reportEndDate) return;

    setReportLoading(true);
    try {
      const res = await api.get('/reports/nxt', {
        params: {
          startDate: reportStartDate,
          endDate: reportEndDate,
        },
      });
      setReportRows(res.data.data || res.data || []);
    } catch (error) {
      console.error('Error fetching NXT report:', error);
      setReportRows([]);
    } finally {
      setReportLoading(false);
    }
  }, [reportEndDate, reportStartDate]);

  const fetchMetadata = useCallback(async () => {
    try {
      const [declarationRes, productRes, layoutRes] = await Promise.all([
        api.get('/input-declarations/all'),
        api.get('/products', { params: { limit: 1000 } }),
        api.get('/warehouse/layout'),
      ]);

      const declarationData = declarationRes.data;
      setClassifications(declarationData.classifications || []);
      setMaterials(declarationData.materials || []);
      setColors(declarationData.colors || []);
      setSizes(declarationData.sizes || []);
      setProductConditions(declarationData.productConditions || []);
      setStorageZones(declarationData.storageZones || []);
      setWarehouseTypes(declarationData.warehouseTypes || []);
      setProducts(
        (productRes.data.data || productRes.data || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          stock: item.stock,
          price: Number(item.price || 0),
        }))
      );
      setPositions(
        (layoutRes.data?.positions || [])
          .filter((position: any) => position.label)
          .map((position: any) => ({
            id: position.id,
            label: position.label,
            currentStock: position.currentStock,
          }))
      );
    } catch (error) {
      console.error('Error fetching transaction metadata:', error);
    }
  }, []);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    fetchPreliminaryChecks();
  }, [fetchPreliminaryChecks]);

  useEffect(() => {
    if (activeTab === 'REPORT') {
      fetchReport();
    }
  }, [activeTab, fetchReport]);

  useEffect(() => {
    if (!generatedSku) {
      setStockInSkuComboId('');
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/input-declarations/sku-combos', {
          params: { search: generatedSku, limit: 10 },
        });
        const match = (res.data.data || []).find((item: any) => item.compositeSku === generatedSku);
        setStockInSkuComboId(match?.id || '');
      } catch {
        setStockInSkuComboId('');
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [generatedSku]);

  const handlePreliminaryImageSelect = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file hình ảnh');
      return;
    }

    const preview = URL.createObjectURL(file);
    setPreliminaryForm((prev) => ({
      ...prev,
      imageFile: file,
      imagePreview: preview,
    }));
  };

  const submitPreliminaryCheck = async () => {
    try {
      const payload: Record<string, unknown> = {
        classificationId: preliminaryForm.classificationId,
        quantity: Number(preliminaryForm.quantity),
        warehouseTypeId: preliminaryForm.warehouseTypeId || undefined,
        note: preliminaryForm.note || undefined,
      };

      if (preliminaryForm.imageFile) {
        const formData = new FormData();
        formData.append('file', preliminaryForm.imageFile);
        const uploadRes = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        payload.imageUrl = uploadRes.data.url;
      }

      await api.post('/preliminary-checks', payload);
      setPreliminaryOpen(false);
      setPreliminaryForm(defaultPreliminaryForm());
      fetchPreliminaryChecks();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể tạo phiếu kiểm sơ bộ');
    }
  };

  const startDetailedCheck = (check: PreliminaryCheckRow) => {
    setSelectedPreliminaryCheck(check);
    setStockInForm({
      ...defaultStockInForm(),
      classificationId: check.classification.id,
      quantity: check.quantity,
      notes: check.note || '',
    });
    setStockInOpen(true);
    setActiveTab('STOCK_IN');
  };

  const submitStockIn = async () => {
    try {
      if (selectedPreliminaryCheck && Number(stockInForm.quantity) !== selectedPreliminaryCheck.quantity) {
        alert(`Số lượng chi tiết phải khớp với kiểm sơ bộ: ${selectedPreliminaryCheck.quantity}. Vui lòng kiểm tra lại.`);
        return;
      }

      await api.post('/inventory/stock-in', {
        productId: stockInForm.productId,
        skuComboId: stockInSkuComboId || undefined,
        productConditionId: stockInForm.productConditionId || undefined,
        storageZoneId: stockInForm.storageZoneId || undefined,
        warehousePositionId: stockInForm.warehousePositionId || undefined,
        preliminaryCheckId: selectedPreliminaryCheck?.id || undefined,
        quantity: Number(stockInForm.quantity),
        actualStockDate: stockInForm.actualStockDate,
        notes: stockInForm.notes || undefined,
      });
      setStockInOpen(false);
      setStockInForm(defaultStockInForm());
      setStockInSkuComboId('');
      setSelectedPreliminaryCheck(null);
      fetchTransactions();
      fetchMetadata();
      fetchPreliminaryChecks();
      if (activeTab === 'REPORT') fetchReport();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể nhập hàng');
    }
  };

  const submitStockOut = async () => {
    try {
      await api.post('/inventory/stock-out', {
        productId: stockOutForm.productId,
        warehousePositionId: stockOutForm.warehousePositionId || undefined,
        quantity: Number(stockOutForm.quantity),
        notes: stockOutForm.notes || undefined,
      });
      setStockOutOpen(false);
      setStockOutForm(defaultStockOutForm());
      fetchTransactions();
      fetchMetadata();
      if (activeTab === 'REPORT') fetchReport();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể xuất hàng');
    }
  };

  const submitAdjustment = async () => {
    try {
      await api.post('/inventory/adjust', {
        productId: adjustmentForm.productId,
        warehousePositionId: adjustmentForm.warehousePositionId || undefined,
        quantity: Number(adjustmentForm.quantity),
        type: adjustmentForm.type,
        reason: adjustmentForm.reason,
      });
      setAdjustmentOpen(false);
      setAdjustmentForm(defaultAdjustmentForm());
      fetchTransactions();
      fetchMetadata();
      if (activeTab === 'REPORT') fetchReport();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể điều chỉnh tồn kho');
    }
  };

  const displayReportRows = useMemo<NxtReportRow[]>(() => {
    const keyword = reportSearch.trim().toLowerCase();

    return reportRows
      .map((row) => {
        const matchedProduct = products.find((product) => product.sku === row.compositeSku);
        const price = matchedProduct?.price ?? 0;

        return {
          sku: row.compositeSku,
          productName: matchedProduct?.name || `${row.classification} ${row.material}`.trim(),
          unit: 'Cái',
          openingQty: row.openingStock,
          openingValue: row.openingStock * price,
          inQty: row.totalIn,
          inValue: row.totalIn * price,
          outQty: row.totalOut,
          outValue: row.totalOut * price,
          closingQty: row.closingStock,
          closingValue: row.closingStock * price,
        };
      })
      .filter((row) => !keyword || row.sku.toLowerCase().includes(keyword) || row.productName.toLowerCase().includes(keyword));
  }, [products, reportRows, reportSearch]);

  const reportSummary = useMemo(() => {
    return displayReportRows.reduce(
      (acc, row) => {
        acc.openingQty += row.openingQty;
        acc.openingValue += row.openingValue;
        acc.inQty += row.inQty;
        acc.inValue += row.inValue;
        acc.outQty += row.outQty;
        acc.outValue += row.outValue;
        acc.closingQty += row.closingQty;
        acc.closingValue += row.closingValue;
        return acc;
      },
      {
        openingQty: 0,
        openingValue: 0,
        inQty: 0,
        inValue: 0,
        outQty: 0,
        outValue: 0,
        closingQty: 0,
        closingValue: 0,
      }
    );
  }, [displayReportRows]);

  const handleExportReportExcel = () => {
    window.open(`/api/reports/nxt/export?startDate=${reportStartDate}&endDate=${reportEndDate}`, '_blank');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-[22px] font-semibold text-slate-950">Giao dịch kho</h2>
            <p className="text-lg text-slate-500">Lịch sử tất cả các biến động nhập, xuất và điều chỉnh kho.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="h-11 rounded-2xl border-violet-200 px-5 text-violet-700 hover:bg-violet-50" onClick={() => setPreliminaryOpen(true)}>
              <Plus size={16} />
              Nhập kiểm sơ bộ
            </Button>
            <Button variant="outline" className="h-11 rounded-2xl border-emerald-200 px-5 text-emerald-700 hover:bg-emerald-50" onClick={() => setStockInOpen(true)}>
              <ArrowDownToLine size={16} />
              Nhập kho
            </Button>
            <Button variant="outline" className="h-11 rounded-2xl border-rose-200 px-5 text-rose-600 hover:bg-rose-50" onClick={() => setStockOutOpen(true)}>
              <ArrowUpToLine size={16} />
              Xuất kho
            </Button>
            <Button variant="outline" className="h-11 rounded-2xl border-amber-300 px-5 text-amber-600 hover:bg-amber-50" onClick={() => setAdjustmentOpen(true)}>
              <RefreshCcw size={16} />
              Điều chỉnh
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-8 border-b border-slate-200 pb-[2px]">
          {transactionTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`border-b-2 px-5 py-3 text-[15px] font-medium transition ${
                activeTab === tab.key
                  ? 'rounded-t-xl border-violet-500 bg-white text-violet-600 shadow-[0_0_0_1px_rgba(99,102,241,0.18)]'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'PRECHECK' ? (
          <Card className="overflow-hidden rounded-[24px] border border-slate-200 shadow-sm">
            <CardContent className="p-0">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-6">
                <div>
                  <h3 className="text-[22px] font-semibold text-slate-950">Nhập kiểm sơ bộ</h3>
                  <p className="mt-1 text-[16px] text-slate-500">Ghi nhận nhanh loại hàng, số lượng nhận, loại kho, hình ảnh và ghi chú trước khi thủ kho kiểm tra chi tiết.</p>
                </div>
                <Button className="h-11 rounded-2xl bg-violet-600 px-5 hover:bg-violet-700" onClick={() => setPreliminaryOpen(true)}>
                  <Plus size={16} />
                  Tạo phiếu kiểm sơ bộ
                </Button>
              </div>

              {preliminaryLoading ? (
                <div className="flex h-64 items-center justify-center">
                  <div className="spinner" />
                </div>
              ) : (
                <Table className="border-none">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-4">Ngày tạo</TableHead>
                      <TableHead>Phân loại hàng</TableHead>
                      <TableHead>Loại kho</TableHead>
                      <TableHead className="text-right">Số lượng nhận</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Người tạo</TableHead>
                      <TableHead>Ghi chú</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preliminaryChecks.map((item) => (
                      <TableRow key={item.id} className="h-[72px]">
                        <TableCell className="pl-4 text-[15px] text-slate-600">{formatDateTime(item.createdAt)}</TableCell>
                        <TableCell className="font-medium text-slate-900">{item.classification?.name || '-'}</TableCell>
                        <TableCell className="text-slate-600">{item.warehouseType?.name || '-'}</TableCell>
                        <TableCell className="text-right text-[18px] font-semibold text-slate-900">{formatNumber(item.quantity)}</TableCell>
                        <TableCell>
                          <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${item.status === 'PENDING' ? 'border border-amber-200 bg-amber-50 text-amber-600' : 'border border-emerald-200 bg-emerald-50 text-emerald-600'}`}>
                            {item.status === 'PENDING' ? 'Chờ kiểm tra chi tiết' : 'Đã kiểm tra chi tiết'}
                          </span>
                        </TableCell>
                        <TableCell className="text-[15px] text-slate-600">{item.creator?.name || '-'}</TableCell>
                        <TableCell className="text-[15px] italic text-slate-500">{item.note || '-'}</TableCell>
                      </TableRow>
                    ))}
                    {preliminaryChecks.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-14 text-center text-slate-500">
                          Chưa có phiếu kiểm sơ bộ nào.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ) : activeTab === 'REPORT' ? (
          <Card className="overflow-hidden rounded-[24px] border border-slate-200 shadow-sm">
            <CardContent className="p-0">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-violet-50 p-2 text-violet-600">
                      <FileText size={20} />
                    </div>
                    <h3 className="text-[22px] font-semibold text-slate-950">Báo cáo Xuất Nhập Tồn Sản phẩm</h3>
                  </div>
                  <p className="text-[16px] text-slate-500">Thống kê biến động kho theo khoảng thời gian</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div className="flex items-center gap-3">
                      <CalendarDays size={18} className="text-slate-400" />
                      <input
                        type="date"
                        className="bg-transparent text-[15px] font-medium text-slate-700 outline-none"
                        value={reportStartDate}
                        onChange={(e) => setReportStartDate(e.target.value)}
                      />
                    </div>
                    <ArrowRight size={16} className="text-slate-300" />
                    <div className="flex items-center gap-3">
                      <input
                        type="date"
                        className="bg-transparent text-[15px] font-medium text-slate-700 outline-none"
                        value={reportEndDate}
                        onChange={(e) => setReportEndDate(e.target.value)}
                      />
                      <CalendarDays size={18} className="text-slate-400" />
                    </div>
                  </div>

                  <Button variant="outline" className="h-11 rounded-2xl border-violet-200 px-5 text-violet-600 hover:bg-violet-50" onClick={handleExportReportExcel}>
                    <Download size={18} />
                    Xuất file Excel
                  </Button>
                </div>
              </div>

              <div className="border-b border-slate-200 px-6 py-5">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="relative w-full max-w-[500px]">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <Input
                      className="h-11 rounded-2xl border-slate-200 pl-12 text-[15px]"
                      placeholder="Tìm theo SKU hoặc tên sản phẩm..."
                      value={reportSearch}
                      onChange={(e) => setReportSearch(e.target.value)}
                    />
                  </div>

                  <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[15px] text-slate-600">
                    Tổng {displayReportRows.length} sản phẩm
                  </div>

                  <Button variant="outline" className="h-11 rounded-2xl px-4" onClick={fetchReport}>
                    Xem báo cáo
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-white">
                      <th rowSpan={2} className="border-b border-r border-slate-200 px-4 py-5 text-left text-[18px] font-semibold text-slate-950">
                        Phiên bản sản phẩm
                      </th>
                      <th rowSpan={2} className="border-b border-r border-slate-200 px-4 py-5 text-center text-[18px] font-semibold text-slate-950">
                        ĐVT
                      </th>
                      <th colSpan={2} className="border-b border-r border-slate-200 bg-indigo-50/50 px-4 py-4 text-center text-[18px] font-semibold text-slate-950">
                        Tồn kho đầu kỳ
                      </th>
                      <th colSpan={2} className="border-b border-r border-slate-200 bg-emerald-50/50 px-4 py-4 text-center text-[18px] font-semibold text-slate-950">
                        Số lượng nhập trong kỳ
                      </th>
                      <th colSpan={2} className="border-b border-r border-slate-200 bg-rose-50/50 px-4 py-4 text-center text-[18px] font-semibold text-slate-950">
                        Số lượng xuất trong kỳ
                      </th>
                      <th colSpan={2} className="border-b border-slate-200 bg-amber-50/50 px-4 py-4 text-center text-[18px] font-semibold text-slate-950">
                        Tồn kho cuối kỳ
                      </th>
                    </tr>
                    <tr className="bg-white">
                      <th className="border-b border-r border-slate-200 px-4 py-4 text-center text-[14px] font-medium uppercase tracking-wide text-slate-500">Số lượng</th>
                      <th className="border-b border-r border-slate-200 px-4 py-4 text-center text-[14px] font-medium uppercase tracking-wide text-slate-500">Giá trị</th>
                      <th className="border-b border-r border-slate-200 px-4 py-4 text-center text-[14px] font-medium uppercase tracking-wide text-slate-500">Số lượng</th>
                      <th className="border-b border-r border-slate-200 px-4 py-4 text-center text-[14px] font-medium uppercase tracking-wide text-slate-500">Giá trị</th>
                      <th className="border-b border-r border-slate-200 px-4 py-4 text-center text-[14px] font-medium uppercase tracking-wide text-slate-500">Số lượng</th>
                      <th className="border-b border-r border-slate-200 px-4 py-4 text-center text-[14px] font-medium uppercase tracking-wide text-slate-500">Giá trị</th>
                      <th className="border-b border-r border-slate-200 px-4 py-4 text-center text-[14px] font-medium uppercase tracking-wide text-slate-500">Số lượng</th>
                      <th className="border-b border-slate-200 px-4 py-4 text-center text-[14px] font-medium uppercase tracking-wide text-slate-500">Giá trị</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportLoading ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-16 text-center text-slate-500">
                          Đang tải báo cáo...
                        </td>
                      </tr>
                    ) : displayReportRows.length > 0 ? (
                      <>
                        {displayReportRows.map((row) => (
                          <tr key={row.sku} className="bg-white">
                            <td className="border-b border-r border-slate-200 px-4 py-4 align-top">
                              <div className="text-[18px] font-semibold text-slate-950">{row.sku}</div>
                              <div className="text-[16px] text-slate-500">{row.productName}</div>
                            </td>
                            <td className="border-b border-r border-slate-200 px-4 py-4 text-center text-[18px] text-slate-700">{row.unit}</td>
                            <td className="border-b border-r border-slate-200 px-4 py-4 text-center text-[20px] font-semibold text-slate-950">{formatNumber(row.openingQty)}</td>
                            <td className="border-b border-r border-slate-200 px-4 py-4 text-right text-[18px] text-slate-700">{formatCurrency(row.openingValue)}</td>
                            <td className="border-b border-r border-slate-200 px-4 py-4 text-center text-[20px] font-semibold text-emerald-600">{formatNumber(row.inQty)}</td>
                            <td className="border-b border-r border-slate-200 px-4 py-4 text-right text-[18px] text-slate-700">{formatCurrency(row.inValue)}</td>
                            <td className="border-b border-r border-slate-200 px-4 py-4 text-center text-[20px] font-semibold text-rose-600">{formatNumber(row.outQty)}</td>
                            <td className="border-b border-r border-slate-200 px-4 py-4 text-right text-[18px] text-slate-700">{formatCurrency(row.outValue)}</td>
                            <td className="border-b border-r border-slate-200 px-4 py-4 text-center text-[20px] font-semibold text-violet-600">{formatNumber(row.closingQty)}</td>
                            <td className="border-b border-slate-200 px-4 py-4 text-right text-[18px] font-semibold text-slate-950">{formatCurrency(row.closingValue)}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50">
                          <td className="border-r border-slate-200 px-4 py-4 text-[17px] font-semibold text-slate-950">Tổng cộng</td>
                          <td className="border-r border-slate-200 px-4 py-4 text-center text-[17px] font-medium text-slate-600">-</td>
                          <td className="border-r border-slate-200 px-4 py-4 text-center text-[18px] font-semibold text-slate-950">{formatNumber(reportSummary.openingQty)}</td>
                          <td className="border-r border-slate-200 px-4 py-4 text-right text-[17px] font-medium text-slate-700">{formatCurrency(reportSummary.openingValue)}</td>
                          <td className="border-r border-slate-200 px-4 py-4 text-center text-[18px] font-semibold text-emerald-600">{formatNumber(reportSummary.inQty)}</td>
                          <td className="border-r border-slate-200 px-4 py-4 text-right text-[17px] font-medium text-slate-700">{formatCurrency(reportSummary.inValue)}</td>
                          <td className="border-r border-slate-200 px-4 py-4 text-center text-[18px] font-semibold text-rose-600">{formatNumber(reportSummary.outQty)}</td>
                          <td className="border-r border-slate-200 px-4 py-4 text-right text-[17px] font-medium text-slate-700">{formatCurrency(reportSummary.outValue)}</td>
                          <td className="border-r border-slate-200 px-4 py-4 text-center text-[18px] font-semibold text-violet-600">{formatNumber(reportSummary.closingQty)}</td>
                          <td className="px-4 py-4 text-right text-[18px] font-semibold text-slate-950">{formatCurrency(reportSummary.closingValue)}</td>
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <td colSpan={10} className="px-4 py-16 text-center text-slate-500">
                          Không có dữ liệu báo cáo trong khoảng thời gian đã chọn.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {activeTab === 'STOCK_IN' && (
              <Card className="rounded-[24px] border border-slate-200 shadow-sm">
                <CardContent className="p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-[18px] font-semibold text-slate-950">Dòng chờ kiểm tra chi tiết</h3>
                      <p className="mt-1 text-[14px] text-slate-500">Chọn dòng kiểm sơ bộ để khai thông tin chi tiết. Số lượng chi tiết phải khớp với số lượng kiểm sơ bộ đã nhận.</p>
                    </div>
                    <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-sm font-medium text-violet-700">
                      {pendingPreliminaryChecks.length} dòng chờ
                    </span>
                  </div>

                  <div className="space-y-3">
                    {pendingPreliminaryChecks.length > 0 ? pendingPreliminaryChecks.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                        <div className="space-y-1">
                          <div className="text-[16px] font-semibold text-slate-950">{item.classification?.name || '-'}</div>
                          <div className="text-[14px] text-slate-500">
                            {formatDateTime(item.createdAt)} • {item.warehouseType?.name || 'Chưa chọn loại kho'} • SL sơ bộ: {formatNumber(item.quantity)}
                          </div>
                        </div>
                        <Button className="h-10 rounded-2xl bg-violet-600 px-4 hover:bg-violet-700" onClick={() => startDetailedCheck(item)}>
                          Kiểm tra chi tiết
                        </Button>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-slate-500">
                        Không có dòng kiểm sơ bộ nào đang chờ xử lý.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="overflow-hidden rounded-[22px]">
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex h-64 items-center justify-center">
                    <div className="spinner" />
                  </div>
                ) : (
                  <Table className="border-none">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-4">Thời gian tạo phiếu</TableHead>
                      <TableHead>Thời gian nhập kho</TableHead>
                      <TableHead>Loại</TableHead>
                      <TableHead>Sản phẩm</TableHead>
                      <TableHead>Vị trí</TableHead>
                      <TableHead className="text-right">SL</TableHead>
                      <TableHead>Người tạo</TableHead>
                      <TableHead>Ghi chú</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const isIn = row.kind === 'STOCK_IN';
                      const isAdjustment = row.kind === 'ADJUSTMENT';
                      const typeLabel = isAdjustment ? 'Điều chỉnh' : isIn ? 'Nhập kho' : 'Xuất kho';
                      const typeClass = isAdjustment
                        ? 'border-amber-300 bg-amber-50 text-amber-600'
                        : isIn
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                          : 'border-rose-200 bg-rose-50 text-rose-600';

                      return (
                        <TableRow key={row.id} className="h-[72px]">
                          <TableCell className="pl-4">
                            <div className="flex items-center gap-2 text-[15px] text-slate-600">
                              <CalendarDays size={15} className="text-slate-400" />
                              <span>{formatDateTime(row.createdAt)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-[15px] font-medium text-slate-900">
                              <CalendarDays size={15} className="text-[#7d7df7]" />
                              <span>{formatDateOnly(row.actualStockDate)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${typeClass}`}>{typeLabel}</span>
                          </TableCell>
                          <TableCell>
                            <div className="text-[17px] font-semibold leading-6 text-slate-900">{row.productName}</div>
                            <div className="text-sm text-slate-500">{row.productSku}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-[15px] text-slate-600">
                              <MapPin size={15} className="text-slate-400" />
                              <span>{row.positionLabel || '-'}</span>
                            </div>
                          </TableCell>
                          <TableCell className={`text-right text-[18px] font-semibold ${row.signedQuantity >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {row.signedQuantity >= 0 ? '+' : ''}
                            {formatNumber(row.signedQuantity)}
                          </TableCell>
                          <TableCell className="text-[15px] text-slate-600">{row.userName}</TableCell>
                          <TableCell className="text-[15px] italic text-slate-500">{row.note || '-'}</TableCell>
                        </TableRow>
                      );
                    })}

                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-14 text-center text-slate-500">
                          Chưa có giao dịch phù hợp.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={preliminaryOpen} onOpenChange={setPreliminaryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus size={18} />
              Nhập kiểm sơ bộ
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Phân loại hàng hóa nhận</Label>
              <select className="form-select" value={preliminaryForm.classificationId} onChange={(e) => setPreliminaryForm((prev) => ({ ...prev, classificationId: e.target.value }))}>
                <option value="">Chọn phân loại</option>
                {classifications.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Số lượng nhận</Label>
              <Input type="number" min={1} value={preliminaryForm.quantity} onChange={(e) => setPreliminaryForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))} />
            </div>

            <div className="space-y-2">
              <Label>Loại kho chứa</Label>
              <select className="form-select" value={preliminaryForm.warehouseTypeId} onChange={(e) => setPreliminaryForm((prev) => ({ ...prev, warehouseTypeId: e.target.value }))}>
                <option value="">Chọn loại kho</option>
                {warehouseTypes.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Hình ảnh sản phẩm đã nhận</Label>
              <label className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 px-6 py-8 text-center">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePreliminaryImageSelect(e.target.files?.[0])} />
                {preliminaryForm.imagePreview ? (
                  <img src={preliminaryForm.imagePreview} alt="preview" className="max-h-[160px] rounded-xl object-contain" />
                ) : (
                  <>
                    <Upload size={28} className="text-slate-400" />
                    <p className="mt-3 text-sm text-slate-500">Nhấn để tải lên hình ảnh sản phẩm đã nhận</p>
                  </>
                )}
              </label>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Ghi chú khác</Label>
              <textarea className="form-control min-h-[96px] py-3" value={preliminaryForm.note} onChange={(e) => setPreliminaryForm((prev) => ({ ...prev, note: e.target.value }))} placeholder="Nhập ghi chú tùy ý" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreliminaryOpen(false)}>Hủy</Button>
            <Button onClick={submitPreliminaryCheck} disabled={!preliminaryForm.classificationId || !preliminaryForm.quantity || !preliminaryForm.warehouseTypeId}>
              Tạo phiếu sơ bộ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stockInOpen} onOpenChange={(open) => {
        setStockInOpen(open);
        if (!open) {
          setSelectedPreliminaryCheck(null);
        }
      }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus size={18} />
              Nhập hàng vào kho
            </DialogTitle>
          </DialogHeader>

          {selectedPreliminaryCheck && (
            <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-4 text-sm text-violet-800">
              <div className="font-semibold">Đang xử lý từ kiểm sơ bộ</div>
              <div className="mt-1">
                {selectedPreliminaryCheck.classification?.name || '-'} • {selectedPreliminaryCheck.warehouseType?.name || 'Chưa chọn loại kho'} • Số lượng phải khớp: {formatNumber(selectedPreliminaryCheck.quantity)}
              </div>
            </div>
          )}

          <div className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 md:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">Sản phẩm</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{selectedStockInProduct?.name || 'Chưa chọn'}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">SKU tự động</p>
              <p className="mt-1 text-sm font-medium text-violet-700">{generatedSku || 'Chọn đủ 4 thuộc tính'}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">SKU Combo</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{stockInSkuComboId ? 'Đã khớp combo' : 'Chưa có combo phù hợp'}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Sản phẩm</Label>
              <select className="form-select" value={stockInForm.productId} onChange={(e) => setStockInForm((prev) => ({ ...prev, productId: e.target.value }))}>
                <option value="">Chọn sản phẩm</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.sku})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Tình trạng hàng</Label>
              <select className="form-select" value={stockInForm.productConditionId} onChange={(e) => setStockInForm((prev) => ({ ...prev, productConditionId: e.target.value }))}>
                <option value="">Chọn tình trạng</option>
                {productConditions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Phân loại hàng hóa</Label>
              <select className="form-select" value={stockInForm.classificationId} onChange={(e) => setStockInForm((prev) => ({ ...prev, classificationId: e.target.value }))}>
                <option value="">Chọn phân loại</option>
                {classifications.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Chất liệu</Label>
              <select className="form-select" value={stockInForm.materialId} onChange={(e) => setStockInForm((prev) => ({ ...prev, materialId: e.target.value }))}>
                <option value="">Chọn chất liệu</option>
                {materials.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Màu sắc</Label>
              <select className="form-select" value={stockInForm.colorId} onChange={(e) => setStockInForm((prev) => ({ ...prev, colorId: e.target.value }))}>
                <option value="">Chọn màu sắc</option>
                {colors.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Kích cỡ</Label>
              <select className="form-select" value={stockInForm.sizeId} onChange={(e) => setStockInForm((prev) => ({ ...prev, sizeId: e.target.value }))}>
                <option value="">Chọn kích cỡ</option>
                {sizes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Mã SKU tự động</Label>
              <Input value={generatedSku} readOnly placeholder="Chọn đủ 4 trường để tạo SKU" />
            </div>

            <div className="space-y-2">
              <Label>Vị trí lưu trữ</Label>
              <select className="form-select" value={stockInForm.warehousePositionId} onChange={(e) => setStockInForm((prev) => ({ ...prev, warehousePositionId: e.target.value }))}>
                <option value="">Chọn vị trí</option>
                {positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Khu vực / Thùng</Label>
              <select className="form-select" value={stockInForm.storageZoneId} onChange={(e) => setStockInForm((prev) => ({ ...prev, storageZoneId: e.target.value }))}>
                <option value="">Chọn khu vực</option>
                {storageZones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Số lượng hàng</Label>
              <Input type="number" min={1} value={stockInForm.quantity} onChange={(e) => setStockInForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))} />
            </div>

            <div className="space-y-2">
              <Label>Thời gian nhập hàng kho thực tế</Label>
              <Input type="datetime-local" value={stockInForm.actualStockDate} onChange={(e) => setStockInForm((prev) => ({ ...prev, actualStockDate: e.target.value }))} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Ghi chú</Label>
              <textarea className="form-control min-h-[96px] py-3" value={stockInForm.notes} onChange={(e) => setStockInForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Nhập ghi chú nếu có" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStockInOpen(false)}>
              Hủy
            </Button>
            <Button onClick={submitStockIn} disabled={!stockInForm.productId || !stockInForm.quantity}>
              Xác nhận nhập hàng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stockOutOpen} onOpenChange={setStockOutOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Xuất hàng khỏi kho</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 md:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">Tồn sản phẩm</p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {selectedStockOutProduct ? `${selectedStockOutProduct.name} - ${formatNumber(selectedStockOutProduct.stock)}` : 'Chưa chọn sản phẩm'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">Tồn tại vị trí</p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {selectedStockOutPosition ? `${selectedStockOutPosition.label} - ${formatNumber(selectedStockOutPosition.currentStock)}` : 'Chưa chọn vị trí'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sản phẩm</Label>
              <select className="form-select" value={stockOutForm.productId} onChange={(e) => setStockOutForm((prev) => ({ ...prev, productId: e.target.value }))}>
                <option value="">Chọn sản phẩm</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.sku})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Vị trí xuất</Label>
              <select className="form-select" value={stockOutForm.warehousePositionId} onChange={(e) => setStockOutForm((prev) => ({ ...prev, warehousePositionId: e.target.value }))}>
                <option value="">Chọn vị trí xuất</option>
                {positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.label} (tồn: {position.currentStock})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Số lượng xuất</Label>
              <Input type="number" min={1} value={stockOutForm.quantity} onChange={(e) => setStockOutForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))} />
            </div>

            <div className="space-y-2">
              <Label>Ghi chú</Label>
              <textarea className="form-control min-h-[96px] py-3" value={stockOutForm.notes} onChange={(e) => setStockOutForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Nhập ghi chú xuất hàng" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStockOutOpen(false)}>
              Hủy
            </Button>
            <Button onClick={submitStockOut} disabled={!stockOutForm.productId || !stockOutForm.quantity}>
              Xác nhận xuất hàng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adjustmentOpen} onOpenChange={setAdjustmentOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Điều chỉnh tồn kho</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 md:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">Sản phẩm</p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {selectedAdjustmentProduct ? `${selectedAdjustmentProduct.name} (${selectedAdjustmentProduct.sku})` : 'Chưa chọn sản phẩm'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">Vị trí</p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {selectedAdjustmentPosition ? `${selectedAdjustmentPosition.label} - ${formatNumber(selectedAdjustmentPosition.currentStock)}` : 'Chưa chọn vị trí'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sản phẩm</Label>
              <select className="form-select" value={adjustmentForm.productId} onChange={(e) => setAdjustmentForm((prev) => ({ ...prev, productId: e.target.value }))}>
                <option value="">Chọn sản phẩm</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.sku})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Vị trí</Label>
              <select className="form-select" value={adjustmentForm.warehousePositionId} onChange={(e) => setAdjustmentForm((prev) => ({ ...prev, warehousePositionId: e.target.value }))}>
                <option value="">Chọn vị trí</option>
                {positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Loại điều chỉnh</Label>
              <div className="flex gap-2">
                <Button type="button" variant={adjustmentForm.type === 'INCREASE' ? 'default' : 'outline'} onClick={() => setAdjustmentForm((prev) => ({ ...prev, type: 'INCREASE' }))}>
                  Tăng
                </Button>
                <Button type="button" variant={adjustmentForm.type === 'DECREASE' ? 'default' : 'outline'} onClick={() => setAdjustmentForm((prev) => ({ ...prev, type: 'DECREASE' }))}>
                  Giảm
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Số lượng điều chỉnh</Label>
              <Input type="number" min={1} value={adjustmentForm.quantity} onChange={(e) => setAdjustmentForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))} />
            </div>

            <div className="space-y-2">
              <Label>Lý do điều chỉnh</Label>
              <textarea className="form-control min-h-[96px] py-3" value={adjustmentForm.reason} onChange={(e) => setAdjustmentForm((prev) => ({ ...prev, reason: e.target.value }))} placeholder="Nhập lý do điều chỉnh" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustmentOpen(false)}>
              Hủy
            </Button>
            <Button onClick={submitAdjustment} disabled={!adjustmentForm.productId || !adjustmentForm.quantity || !adjustmentForm.reason.trim()}>
              Xác nhận điều chỉnh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
