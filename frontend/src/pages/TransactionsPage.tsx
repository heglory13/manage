import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpToLine,
  CheckCircle2,
  CalendarDays,
  Download,
  Eye,
  FileText,
  Lock,
  MapPin,
  Pencil,
  Plus,
  PackagePlus,
  Printer,
  RefreshCcw,
  Search,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { api } from '../services/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { openBarcodePrintWindow } from '../lib/barcode';
import { compressImageForUpload } from '../lib/image';
import { formatNumber } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { defaultGeneralSettings, fetchGeneralSettings } from '../services/generalSettings';
import SmartFilter from '../components/common/SmartFilter';
import type { FilterField } from '../components/common/SmartFilter';
import { useSavedFilters } from '../hooks/useSavedFilters';
import { SearchableSelect } from '../components/ui/searchable-select';

type AttributeOption = {
  id: string;
  name: string;
  code?: string;
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
  categoryId: string | null;
  createdAt: string;
  actualStockDate: string | null;
  kind: 'ALL' | 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT';
  type: 'STOCK_IN' | 'STOCK_OUT';
  status: 'ACTIVE' | 'SUSPENDED';
  quantity: number;
  signedQuantity: number;
  purchasePrice: number | null;
  salePrice: number | null;
  categoryName: string;
  positionLabel: string | null;
  warehouseTypeName: string | null;
  storageZoneName: string | null;
  productName: string | null;
  sku: string | null;
  userName: string;
  note: string;
};

type TransferForm = {
  categoryId: string;
  currentPositionId: string;
  targetPositionId: string;
  quantity: number;
};

type NxtReportApiRow = {
  categoryId: string | null;
  categoryName: string;
  openingStock: number;
  openingValue: number;
  totalIn: number;
  totalInValue: number;
  totalOut: number;
  totalOutValue: number;
  closingStock: number;
  closingValue: number;
};

type NxtReportRow = {
  categoryId: string | null;
  categoryName: string;
  openingQty: number;
  openingValue: number;
  inQty: number;
  inValue: number;
  outQty: number;
  outValue: number;
  closingQty: number;
  closingValue: number;
};

type StockInLineForm = {
  id: string;
  categoryId: string;
  classificationId: string;
  colorId: string;
  sizeId: string;
  materialId: string;
  productConditionId: string;
  storageZoneId: string;
  warehouseTypeId: string;
  quantity: number;
  purchasePrice: number;
  salePrice: number;
  actualStockDate: string;
  notes: string;
};

type StockOutForm = {
  categoryId: string;
  warehousePositionId: string;
  skuComboId: string;
  quantity: number;
  notes: string;
};

type AdjustmentForm = {
  categoryId: string;
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
  category?: AttributeOption | null;
  classification?: AttributeOption | null;
  warehouseType?: AttributeOption | null;
  creator: { id: string; name: string; email: string };
};

type PreliminaryCheckForm = {
  categoryId: string;
  quantity: number;
  warehouseTypeId: string;
  imageFile: File | null;
  imagePreview: string;
  note: string;
};

type BarcodePrintItem = {
  transactionId: string;
  categoryName: string;
  productName: string;
  barcodeValue: string;
  salePrice: number;
  quantity: number;
};

const transactionTabs = [
  { key: 'PRECHECK', label: 'Nhập kiểm sơ bộ' },
  { key: 'ALL', label: 'Tất cả' },
  { key: 'STOCK_IN', label: 'Nhập kho' },
  { key: 'STOCK_OUT', label: 'Xuất Kho' },
  { key: 'ADJUSTMENT', label: 'Điều chỉnh' },
  { key: 'REPORT', label: 'Báo cáo nhập xuất tồn' },
] as const;

const createStockInLine = (overrides: Partial<StockInLineForm> = {}): StockInLineForm => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  categoryId: '',
  classificationId: '',
  colorId: '',
  sizeId: '',
  materialId: '',
  productConditionId: '',
  storageZoneId: '',
  warehouseTypeId: '',
  quantity: 1,
  purchasePrice: 0,
  salePrice: 0,
  actualStockDate: new Date().toISOString().slice(0, 16),
  notes: '',
  ...overrides,
});

const defaultStockOutForm = (): StockOutForm => ({
  categoryId: '',
  warehousePositionId: '',
  skuComboId: '',
  quantity: 1,
  notes: '',
});

const defaultAdjustmentForm = (): AdjustmentForm => ({
  categoryId: '',
  warehousePositionId: '',
  quantity: 1,
  type: 'INCREASE',
  reason: '',
});

const defaultPreliminaryForm = (): PreliminaryCheckForm => ({
  categoryId: '',
  quantity: 1,
  warehouseTypeId: '',
  imageFile: null,
  imagePreview: '',
  note: '',
});

const defaultTransferForm = (): TransferForm => ({
  categoryId: '',
  currentPositionId: '',
  targetPositionId: '',
  quantity: 1,
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
  const { user } = useAuth();
  const defaultRange = useMemo(() => getDefaultReportRange(), []);
  const [activeTab, setActiveTab] = useState<(typeof transactionTabs)[number]['key']>('ALL');
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [categories, setCategories] = useState<AttributeOption[]>([]);
  const [classifications, setClassifications] = useState<AttributeOption[]>([]);
  const [colors, setColors] = useState<AttributeOption[]>([]);
  const [sizes, setSizes] = useState<AttributeOption[]>([]);
  const [materials, setMaterials] = useState<AttributeOption[]>([]);
  const [productConditions, setProductConditions] = useState<AttributeOption[]>([]);
  const [storageZones, setStorageZones] = useState<StorageZone[]>([]);
  const [warehouseTypes, setWarehouseTypes] = useState<AttributeOption[]>([]);
  const [preliminaryChecks, setPreliminaryChecks] = useState<PreliminaryCheckRow[]>([]);
  const [preliminaryLoading, setPreliminaryLoading] = useState(false);
  const [preliminaryOpen, setPreliminaryOpen] = useState(false);
  const [productDetailOpen, setProductDetailOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [barcodeDialogOpen, setBarcodeDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionRow | null>(null);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [editTransactionOpen, setEditTransactionOpen] = useState(false);
  const [editTransactionForm, setEditTransactionForm] = useState<{
    quantity: number;
    purchasePrice: number;
    notes: string;
  }>({ quantity: 0, purchasePrice: 0, notes: '' });
  const [barcodeItems, setBarcodeItems] = useState<BarcodePrintItem[]>([]);
  const [transferForm, setTransferForm] = useState<TransferForm>(defaultTransferForm);
  const [preliminaryForm, setPreliminaryForm] = useState<PreliminaryCheckForm>(defaultPreliminaryForm);
  const [selectedPreliminaryCheck, setSelectedPreliminaryCheck] = useState<PreliminaryCheckRow | null>(null);
  const [stockInOpen, setStockInOpen] = useState(false);
  const [pickPreliminaryOpen, setPickPreliminaryOpen] = useState(false);
  const [stockOutOpen, setStockOutOpen] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [stockInLines, setStockInLines] = useState<StockInLineForm[]>([createStockInLine()]);
  const [stockOutForm, setStockOutForm] = useState<StockOutForm>(defaultStockOutForm);
  const [stockOutSearch, setStockOutSearch] = useState('');
  const [stockOutSearchResults, setStockOutSearchResults] = useState<Array<{
    id: string;
    compositeSku: string;
    categoryId: string | null;
    categoryName: string | null;
    classification: { id: string; name: string };
    color: { id: string; name: string };
    size: { id: string; name: string };
    material: { id: string; name: string };
  }>>([]);
  const [stockOutSearchOpen, setStockOutSearchOpen] = useState(false);
  const [stockOutSelectedProduct, setStockOutSelectedProduct] = useState<string>('');
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentForm>(defaultAdjustmentForm);
  const [adjustSearch, setAdjustSearch] = useState('');
  const [adjustSearchResults, setAdjustSearchResults] = useState<typeof stockOutSearchResults>([]);
  const [adjustSearchOpen, setAdjustSearchOpen] = useState(false);
  const [adjustSelectedProduct, setAdjustSelectedProduct] = useState('');
  const [reportStartDate, setReportStartDate] = useState(defaultRange.startDate);
  const [reportEndDate, setReportEndDate] = useState(defaultRange.endDate);
  const [reportSearch, setReportSearch] = useState('');
  const [reportRows, setReportRows] = useState<NxtReportApiRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [generalSettings, setGeneralSettings] = useState(defaultGeneralSettings);

  // Smart filter
  const transactionFilterFields = useMemo<FilterField[]>(() => [
    {
      key: 'kind',
      label: 'Loại',
      type: 'select',
      options: [
        { value: 'STOCK_IN', label: 'Nhập kho' },
        { value: 'STOCK_OUT', label: 'Xuất kho' },
        { value: 'ADJUSTMENT', label: 'Điều chỉnh' },
      ],
    },
    {
      key: 'status',
      label: 'Trạng thái',
      type: 'select',
      options: [
        { value: 'ACTIVE', label: 'Đang GD' },
        { value: 'SUSPENDED', label: 'Ngưng GD' },
      ],
    },
    {
      key: 'categoryName',
      label: 'Danh mục',
      type: 'text',
      placeholder: 'Tìm danh mục...',
    },
    {
      key: 'productName',
      label: 'Sản phẩm',
      type: 'text',
      placeholder: 'Tìm sản phẩm...',
    },
    {
      key: 'sku',
      label: 'SKU',
      type: 'text',
      placeholder: 'Tìm SKU...',
    },
    {
      key: 'positionLabel',
      label: 'Vị trí',
      type: 'text',
      placeholder: 'Tìm vị trí...',
    },
    {
      key: 'userName',
      label: 'Người tạo',
      type: 'text',
      placeholder: 'Tìm người tạo...',
    },
    {
      key: 'dateFrom',
      label: 'Từ ngày',
      type: 'date',
    },
    {
      key: 'dateTo',
      label: 'Đến ngày',
      type: 'date',
    },
  ], []);

  const savedFilterHook = useSavedFilters({ pageKey: 'transactions' });

  const filteredRows = useMemo(() => {
    const f = savedFilterHook.filters;
    if (Object.keys(f).length === 0) return rows;

    return rows.filter((row) => {
      if (f.kind && row.kind !== f.kind) return false;
      if (f.status && row.status !== f.status) return false;
      if (f.categoryName && !row.categoryName.toLowerCase().includes((f.categoryName as string).toLowerCase())) return false;
      if (f.productName && !(row.productName || '').toLowerCase().includes((f.productName as string).toLowerCase())) return false;
      if (f.sku && !(row.sku || '').toLowerCase().includes((f.sku as string).toLowerCase())) return false;
      if (f.positionLabel && !(row.positionLabel || '').toLowerCase().includes((f.positionLabel as string).toLowerCase())) return false;
      if (f.userName && !row.userName.toLowerCase().includes((f.userName as string).toLowerCase())) return false;
      if (f.dateFrom) {
        const from = new Date(f.dateFrom as string);
        const rowDate = new Date(row.createdAt);
        if (rowDate < from) return false;
      }
      if (f.dateTo) {
        const to = new Date(f.dateTo as string);
        to.setHours(23, 59, 59, 999);
        const rowDate = new Date(row.createdAt);
        if (rowDate > to) return false;
      }
      return true;
    });
  }, [rows, savedFilterHook.filters]);

  const selectedStockOutCategory = useMemo(() => categories.find((category) => category.id === stockOutForm.categoryId), [categories, stockOutForm.categoryId]);
  const selectedAdjustmentCategory = useMemo(() => categories.find((category) => category.id === adjustmentForm.categoryId), [categories, adjustmentForm.categoryId]);
  const selectedTransferCurrentPosition = useMemo(
    () => positions.find((position) => position.id === transferForm.currentPositionId),
    [positions, transferForm.currentPositionId],
  );
  const selectedStockOutPosition = useMemo(() => positions.find((position) => position.id === stockOutForm.warehousePositionId), [positions, stockOutForm.warehousePositionId]);
  const selectedAdjustmentPosition = useMemo(
    () => positions.find((position) => position.id === adjustmentForm.warehousePositionId),
    [positions, adjustmentForm.warehousePositionId]
  );
  const categoryStockMap = useMemo(() => {
    const map = new Map<string, number>();
    rows
      .filter((row) => row.status === 'ACTIVE' && row.categoryId)
      .forEach((row) => {
        const key = row.categoryId as string;
        map.set(key, (map.get(key) || 0) + row.signedQuantity);
      });
    return map;
  }, [rows]);
  const pendingPreliminaryChecks = useMemo(
    () => preliminaryChecks.filter((item) => item.status === 'PENDING'),
    [preliminaryChecks]
  );
  const stockInTotalQuantity = useMemo(
    () => stockInLines.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [stockInLines],
  );
  const canDeleteTransactions = user?.role === 'ADMIN' && Boolean(user?.permissions?.transactions?.delete);
  const canSuspendTransactions =
    (user?.role === 'ADMIN' || user?.role === 'MANAGER') && Boolean(user?.permissions?.transactions?.edit);
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedTransactionIds.includes(row.id)),
    [rows, selectedTransactionIds],
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
      const [declarationRes, categoriesRes, layoutRes] = await Promise.all([
        api.get('/input-declarations/all'),
        api.get('/input-declarations/categories'),
        api.get('/warehouse/layout'),
      ]);

      const declarationData = declarationRes.data;
      setCategories(categoriesRes.data || []);
      setClassifications(declarationData.classifications || []);
      setColors(declarationData.colors || []);
      setSizes(declarationData.sizes || []);
      setMaterials(declarationData.materials || []);
      setProductConditions(declarationData.productConditions || []);
      setStorageZones(declarationData.storageZones || []);
      setWarehouseTypes(declarationData.warehouseTypes || []);
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
    const loadSettings = async () => {
      try {
        const data = await fetchGeneralSettings();
        setGeneralSettings(data);
      } catch (error) {
        console.error('Error loading general settings:', error);
      }
    };

    void loadSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'REPORT') {
      fetchReport();
    }
  }, [activeTab, fetchReport]);

  useEffect(() => {
    setSelectedTransactionIds((prev) => prev.filter((id) => rows.some((row) => row.id === id)));
  }, [rows]);

  const resetStockInModal = useCallback(() => {
    setStockInLines([createStockInLine()]);
    setSelectedPreliminaryCheck(null);
  }, []);

  const updateStockInLine = useCallback((lineId: string, patch: Partial<StockInLineForm>) => {
    setStockInLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        return { ...line, ...patch };
      }),
    );
  }, []);

  const addStockInLine = useCallback(() => {
    setStockInLines((prev) => [...prev, createStockInLine()]);
  }, []);

  const removeStockInLine = useCallback((lineId: string) => {
    setStockInLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.id !== lineId)));
  }, []);

  const openStockInModal = useCallback((preliminaryCheck?: PreliminaryCheckRow | null) => {
    setSelectedPreliminaryCheck(preliminaryCheck ?? null);
    setStockInLines([
      createStockInLine({
        quantity: preliminaryCheck?.quantity ?? 1,
      }),
    ]);
    setStockInOpen(true);
  }, []);

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

  const getPreliminaryCategoryLabel = useCallback((item: PreliminaryCheckRow) => {
    return item.category?.name || item.classification?.name || '-';
  }, []);

  const submitPreliminaryCheck = async (keepOpen = false) => {
    try {
      const payload: Record<string, unknown> = {
        categoryId: preliminaryForm.categoryId,
        quantity: Number(preliminaryForm.quantity),
        warehouseTypeId: preliminaryForm.warehouseTypeId || undefined,
        note: preliminaryForm.note || undefined,
      };

      if (preliminaryForm.imageFile) {
        const formData = new FormData();
        formData.append('file', await compressImageForUpload(preliminaryForm.imageFile));
        const uploadRes = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        payload.imageUrl = uploadRes.data.url;
      }

      await api.post('/preliminary-checks', payload);
      if (!keepOpen) {
        setPreliminaryOpen(false);
      }
      setPreliminaryForm(defaultPreliminaryForm());
      fetchPreliminaryChecks();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể tạo phiếu kiểm sơ bộ');
    }
  };

  const startDetailedCheck = (check: PreliminaryCheckRow) => {
    openStockInModal(check);
    setActiveTab('STOCK_IN');
  };

  const submitStockIn = async () => {
    try {
      // Validate all required fields per line
      const missingFields: string[] = [];
      stockInLines.forEach((line, index) => {
        const lineNum = index + 1;
        if (!line.categoryId) missingFields.push(`Dòng ${lineNum}: chưa chọn Danh mục`);
        if (!line.classificationId) missingFields.push(`Dòng ${lineNum}: chưa chọn Phân loại`);
        if (!line.colorId) missingFields.push(`Dòng ${lineNum}: chưa chọn Màu sắc`);
        if (!line.sizeId) missingFields.push(`Dòng ${lineNum}: chưa chọn Kích thước`);
        if (!line.materialId) missingFields.push(`Dòng ${lineNum}: chưa chọn Chất liệu`);
        if (!line.productConditionId) missingFields.push(`Dòng ${lineNum}: chưa chọn Tình trạng hàng`);
        if (line.quantity <= 0) missingFields.push(`Dòng ${lineNum}: Số lượng phải lớn hơn 0`);
        if (!line.warehouseTypeId) missingFields.push(`Dòng ${lineNum}: chưa chọn Loại kho`);
        if (!line.storageZoneId) missingFields.push(`Dòng ${lineNum}: chưa chọn Khu vực / Thùng`);
        if (line.purchasePrice <= 0) missingFields.push(`Dòng ${lineNum}: Giá nhập phải lớn hơn 0`);
      });

      if (missingFields.length > 0) {
        alert(`Vui lòng điền đầy đủ thông tin:\n\n${missingFields.join('\n')}`);
        return;
      }

      // Resolve SKU combos for lines that have all 4 attributes
      const resolvedLines: Array<{
        categoryId: string;
        purchasePrice: number;
        salePrice: number;
        productConditionId?: string;
        storageZoneId?: string;
        warehousePositionId?: string;
        quantity: number;
        actualStockDate: string;
        notes?: string;
        skuComboId?: string;
      }> = [];

      for (const item of stockInLines) {
        if (!item.categoryId || item.quantity <= 0) continue;

        let skuComboId: string | undefined;

        if (item.classificationId && item.colorId && item.sizeId && item.materialId) {
          try {
            const res = await api.post('/input-declarations/sku-combos/find-or-create', {
              classificationId: item.classificationId,
              colorId: item.colorId,
              sizeId: item.sizeId,
              materialId: item.materialId,
              categoryId: item.categoryId,
            });
            skuComboId = res.data.id;
          } catch (err: any) {
            alert(`Dòng ${resolvedLines.length + 1}: Không thể tạo SKU - ${err.response?.data?.message || 'Lỗi không xác định'}`);
            return;
          }
        }

        // Find warehousePosition matching the storageZone name
        let warehousePositionId: string | undefined;
        if (item.storageZoneId) {
          const zone = storageZones.find((z) => z.id === item.storageZoneId);
          if (zone) {
            const matchingPosition = positions.find(
              (p) => p.label.toLowerCase() === zone.name.toLowerCase(),
            );
            if (matchingPosition) {
              warehousePositionId = matchingPosition.id;
            }
          }
        }

        resolvedLines.push({
          categoryId: item.categoryId,
          purchasePrice: Number(item.purchasePrice),
          salePrice: Number(item.purchasePrice),
          productConditionId: item.productConditionId || undefined,
          storageZoneId: item.storageZoneId || undefined,
          warehousePositionId,
          quantity: Number(item.quantity),
          actualStockDate: item.actualStockDate,
          notes: item.notes || undefined,
          skuComboId,
        });
      }

      if (resolvedLines.length === 0) {
        alert('Vui lòng nhập ít nhất một dòng hàng hợp lệ.');
        return;
      }

      if (selectedPreliminaryCheck && stockInTotalQuantity !== selectedPreliminaryCheck.quantity) {
        const diff = stockInTotalQuantity - selectedPreliminaryCheck.quantity;
        const diffText = diff > 0
          ? `thừa ${formatNumber(diff)}`
          : `thiếu ${formatNumber(Math.abs(diff))}`;
        alert(
          `⚠️ Tổng số lượng hàng nhập chưa khớp với Số lượng tổng kiểm tra sơ bộ!\n\n` +
          `• Kiểm sơ bộ: ${formatNumber(selectedPreliminaryCheck.quantity)}\n` +
          `• Đang nhập: ${formatNumber(stockInTotalQuantity)} (${diffText})\n\n` +
          `Vui lòng kiểm tra lại số lượng hoặc nhấn "Thêm dòng" để bổ sung sản phẩm.`
        );
        return;
      }

      if (resolvedLines.some((item) => !item.categoryId || item.purchasePrice <= 0 || item.quantity <= 0)) {
        alert('Mỗi dòng nhập kho cần có danh mục, số lượng và giá nhập hợp lệ.');
        return;
      }

      if (resolvedLines.length === 1) {
        await api.post('/inventory/stock-in', {
          ...resolvedLines[0],
          preliminaryCheckId: selectedPreliminaryCheck?.id || undefined,
        });
      } else {
        await api.post('/inventory/stock-in/batch', {
          preliminaryCheckId: selectedPreliminaryCheck?.id || undefined,
          items: resolvedLines,
        });
      }
      setStockInOpen(false);
      resetStockInModal();
      fetchTransactions();
      fetchMetadata();
      fetchPreliminaryChecks();
      if (activeTab === 'REPORT') fetchReport();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể nhập hàng');
    }
  };

  const searchSkuCombos = useCallback(async (query: string, target: 'stockOut' | 'adjust' = 'stockOut') => {
    if (!query || query.length < 1) {
      if (target === 'stockOut') {
        setStockOutSearchResults([]);
        setStockOutSearchOpen(false);
      } else {
        setAdjustSearchResults([]);
        setAdjustSearchOpen(false);
      }
      return;
    }
    try {
      const res = await api.get('/input-declarations/sku-combos', {
        params: { search: query, limit: 10 },
      });
      if (target === 'stockOut') {
        setStockOutSearchResults(res.data.data || []);
        setStockOutSearchOpen(true);
      } else {
        setAdjustSearchResults(res.data.data || []);
        setAdjustSearchOpen(true);
      }
    } catch {
      if (target === 'stockOut') setStockOutSearchResults([]);
      else setAdjustSearchResults([]);
    }
  }, []);

  const submitStockOut = async () => {
    try {
      await api.post('/inventory/stock-out', {
        categoryId: stockOutForm.categoryId,
        skuComboId: stockOutForm.skuComboId || undefined,
        warehousePositionId: stockOutForm.warehousePositionId || undefined,
        quantity: Number(stockOutForm.quantity),
        notes: stockOutForm.notes || undefined,
      });
      setStockOutOpen(false);
      setStockOutForm(defaultStockOutForm());
      setStockOutSearch('');
      setStockOutSelectedProduct('');
      setStockOutSearchResults([]);
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
        categoryId: adjustmentForm.categoryId,
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
      .map((row) => ({
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        openingQty: row.openingStock,
        openingValue: row.openingValue ?? 0,
        inQty: row.totalIn,
        inValue: row.totalInValue ?? 0,
        outQty: row.totalOut,
        outValue: row.totalOutValue ?? 0,
        closingQty: row.closingStock,
        closingValue: row.closingValue ?? 0,
      }))
      .filter(
        (row) =>
          !keyword ||
          row.categoryName.toLowerCase().includes(keyword) ||
          (row.categoryId || '').toLowerCase().includes(keyword),
      );
  }, [reportRows, reportSearch]);

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
    const base = `${api.defaults.baseURL || '/api'}`.replace(/\/+$/, '');
    window.open(`${base}/reports/nxt/export?startDate=${reportStartDate}&endDate=${reportEndDate}`, '_blank');
  };

  const toggleTransactionSelection = (transactionId: string) => {
    setSelectedTransactionIds((prev) =>
      prev.includes(transactionId)
        ? prev.filter((id) => id !== transactionId)
        : [...prev, transactionId],
    );
  };

  const toggleSelectAllTransactions = () => {
    setSelectedTransactionIds((prev) =>
      prev.length === rows.length ? [] : rows.map((row) => row.id),
    );
  };

  const clearSelection = () => {
    setSelectedTransactionIds([]);
  };

  const openBarcodeDialog = (targetRows: TransactionRow[]) => {
    const printableRows = targetRows.filter(
      (row) => row.type === 'STOCK_IN' && row.status === 'ACTIVE',
    );

    if (printableRows.length === 0) {
      alert('Chi co the in tem cho cac dong nhap kho dang hoat dong.');
      return;
    }

    setBarcodeItems(
      printableRows.map((row) => ({
        transactionId: row.id,
        categoryName: row.categoryName,
        productName: row.productName || row.categoryName,
        barcodeValue: row.sku || row.categoryId || row.id,
        salePrice: row.salePrice ?? 0,
        quantity: 1,
      })),
    );
    setBarcodeDialogOpen(true);
  };

  const updateBarcodeQuantity = (transactionId: string, quantity: number) => {
    setBarcodeItems((prev) =>
      prev.map((item) =>
        item.transactionId === transactionId
          ? { ...item, quantity: Math.max(quantity || 1, 1) }
          : item,
      ),
    );
  };

  const handlePrintBarcodes = () => {
    openBarcodePrintWindow(barcodeItems);
  };

  const updateTransactionsStatus = async (status: 'ACTIVE' | 'SUSPENDED') => {
    if (!canSuspendTransactions || selectedTransactionIds.length === 0) return;

    try {
      await api.patch('/inventory/transactions/status', {
        transactionIds: selectedTransactionIds,
        status,
      });
      clearSelection();
      await fetchTransactions();
      await fetchMetadata();
      if (activeTab === 'REPORT') await fetchReport();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Khong the cap nhat trang thai giao dich');
    }
  };

  const deleteSelectedTransactions = async () => {
    if (!canDeleteTransactions || selectedTransactionIds.length === 0) return;
    if (!window.confirm(`Xoa ${selectedTransactionIds.length} giao dich da chon?`)) return;

    try {
      await api.delete('/inventory/transactions', {
        data: { transactionIds: selectedTransactionIds },
      });
      clearSelection();
      await fetchTransactions();
      await fetchMetadata();
      if (activeTab === 'REPORT') await fetchReport();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Khong the xoa giao dich');
    }
  };

  const handleViewProductDetail = (row: TransactionRow) => {
    setSelectedTransaction(row);
    setProductDetailOpen(true);
  };

  const handleEditTransaction = (row: TransactionRow) => {
    setSelectedTransaction(row);
    setEditTransactionForm({
      quantity: row.quantity,
      purchasePrice: row.purchasePrice ?? 0,
      notes: row.note || '',
    });
    setEditTransactionOpen(true);
  };

  const submitEditTransaction = async () => {
    if (!selectedTransaction) return;
    try {
      await api.patch(`/inventory/transactions/${selectedTransaction.id}`, {
        quantity: editTransactionForm.quantity,
        purchasePrice: editTransactionForm.purchasePrice,
        notes: editTransactionForm.notes || undefined,
      });
      setEditTransactionOpen(false);
      setSelectedTransaction(null);
      fetchTransactions();
      fetchMetadata();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể cập nhật giao dịch');
    }
  };

  const handleOpenTransfer = (row: TransactionRow) => {
    alert(`Chuyển vị trí theo danh mục chưa được hỗ trợ trong giai đoạn này: ${row.categoryName}`);
  };

  const handleSubmitTransfer = async () => {
    if (!selectedTransaction) return;

    try {
      await api.post('/inventory/stock-out', {
        categoryId: transferForm.categoryId,
        warehousePositionId: transferForm.currentPositionId,
        quantity: Number(transferForm.quantity),
        notes: `Chuyển vị trí từ ${selectedTransferCurrentPosition?.label || selectedTransaction.positionLabel || '-'} sang ${
          positions.find((position) => position.id === transferForm.targetPositionId)?.label || '-'
        }`,
      });

      await api.post('/inventory/stock-in', {
        categoryId: transferForm.categoryId,
        purchasePrice:
          selectedTransaction.purchasePrice ?? 1,
        salePrice:
          selectedTransaction.salePrice ?? 1,
        warehousePositionId: transferForm.targetPositionId,
        quantity: Number(transferForm.quantity),
        actualStockDate: new Date().toISOString().slice(0, 16),
        notes: `Nhận chuyển vị trí từ ${selectedTransferCurrentPosition?.label || selectedTransaction.positionLabel || '-'}`,
      });

      setTransferOpen(false);
      setSelectedTransaction(null);
      setTransferForm(defaultTransferForm());
      await fetchTransactions();
      await fetchMetadata();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể chuyển vị trí danh mục');
    }
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
            <Button variant="outline" className="h-11 rounded-2xl border-emerald-200 px-5 text-emerald-700 hover:bg-emerald-50" onClick={() => {
              setPickPreliminaryOpen(true);
            }}>
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
          {transactionTabs.filter((tab) => tab.key !== 'PRECHECK').map((tab) => (
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
                      <TableHead className="w-[48px] pl-4">
                        <input
                          type="checkbox"
                          checked={rows.length > 0 && selectedTransactionIds.length === rows.length}
                          onChange={toggleSelectAllTransactions}
                        />
                      </TableHead>
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
                        <TableCell className="font-medium text-slate-900">{getPreliminaryCategoryLabel(item)}</TableCell>
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
                          <tr key={row.categoryId || row.categoryName} className="bg-white">
                            <td className="border-b border-r border-slate-200 px-4 py-4 align-top">
                              <div className="text-[18px] font-semibold text-slate-950">{row.categoryName}</div>
                              <div className="text-[14px] text-slate-500">{row.categoryId || '-'}</div>
                            </td>
                            <td className="border-b border-r border-slate-200 px-4 py-4 text-center text-[18px] text-slate-700">-</td>
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
                          <div className="text-[16px] font-semibold text-slate-950">{getPreliminaryCategoryLabel(item)}</div>
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

            <SmartFilter
              fields={transactionFilterFields}
              filters={savedFilterHook.filters}
              savedFilters={savedFilterHook.savedFilters}
              activeFilterId={savedFilterHook.activeFilterId}
              onUpdateFilter={savedFilterHook.updateFilter}
              onRemoveFilter={savedFilterHook.removeFilter}
              onClearFilters={savedFilterHook.clearFilters}
              onApplyFilter={savedFilterHook.applyFilter}
              onSaveFilter={savedFilterHook.saveFilter}
              onDeleteFilter={savedFilterHook.deleteFilter}
            />

            <Card className="overflow-hidden rounded-[22px]">
              <CardContent className="p-0">
                {selectedTransactionIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4">
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white"
                      onClick={clearSelection}
                    >
                      <XCircle size={16} />
                    </button>
                    <div className="text-sm font-semibold text-slate-800">
                      Da chon {selectedTransactionIds.length} giao dich tren trang nay
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" className="h-10 rounded-xl" onClick={() => openBarcodeDialog(selectedRows)}>
                        <Printer size={15} />
                        In tem ma vach
                      </Button>
                      {canSuspendTransactions && (
                        <>
                          <Button variant="outline" className="h-10 rounded-xl" onClick={() => updateTransactionsStatus('SUSPENDED')}>
                            <Lock size={15} />
                            Ngung GD
                          </Button>
                          <Button variant="outline" className="h-10 rounded-xl" onClick={() => updateTransactionsStatus('ACTIVE')}>
                            <CheckCircle2 size={15} />
                            Kich hoat lai GD
                          </Button>
                        </>
                      )}
                      {canDeleteTransactions && (
                        <Button variant="outline" className="h-10 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50" onClick={deleteSelectedTransactions}>
                          <Trash2 size={15} />
                          Xoa GD
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                {isLoading ? (
                  <div className="flex h-64 items-center justify-center">
                    <div className="spinner" />
                  </div>
                ) : (
                  <Table className="border-none">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[52px] pl-4">
                        <input
                          type="checkbox"
                          checked={rows.length > 0 && selectedTransactionIds.length === rows.length}
                          onChange={toggleSelectAllTransactions}
                        />
                      </TableHead>
                      <TableHead className="pl-4">Thời gian tạo phiếu</TableHead>
                      <TableHead>Thời gian nhập kho</TableHead>
                      <TableHead>Loại</TableHead>
                      <TableHead>Trang thai</TableHead>
                      <TableHead>Danh mục</TableHead>
                      <TableHead>Sản phẩm</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Kho / Thùng</TableHead>
                      <TableHead className="text-right">Gia nhap</TableHead>
                      <TableHead className="text-right">Gia ban</TableHead>
                      <TableHead className="text-right">SL</TableHead>
                      <TableHead>Người tạo</TableHead>
                      <TableHead>Ghi chú</TableHead>
                      <TableHead className="text-right">Sua</TableHead>
                      <TableHead className="pr-4 text-right">Xoa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row) => {
                      const isIn = row.kind === 'STOCK_IN';
                      const isAdjustment = row.kind === 'ADJUSTMENT';
                      const isChecked = selectedTransactionIds.includes(row.id);
                      const typeLabel = isAdjustment ? 'Điều chỉnh' : isIn ? 'Nhập kho' : 'Xuất kho';
                      const typeClass = isAdjustment
                        ? 'border-amber-300 bg-amber-50 text-amber-600'
                        : isIn
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                          : 'border-rose-200 bg-rose-50 text-rose-600';
                      const statusClass =
                        row.status === 'ACTIVE'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                          : 'border-amber-200 bg-amber-50 text-amber-700';

                      return (
                        <TableRow key={row.id} className="h-[72px]">
                          <TableCell className="pl-4">
                            <input type="checkbox" checked={isChecked} onChange={() => toggleTransactionSelection(row.id)} />
                          </TableCell>
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
                            <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${statusClass}`}>
                              {row.status === 'ACTIVE' ? 'Dang GD' : 'Ngung GD'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="text-[17px] font-semibold leading-6 text-slate-900">{row.categoryName}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-slate-900">{row.productName || '-'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs font-mono text-indigo-600">{row.sku || '-'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-[13px] text-slate-600">
                              {row.warehouseTypeName && <div className="font-medium text-slate-800">{row.warehouseTypeName}</div>}
                              {row.storageZoneName && <div>{row.storageZoneName}</div>}
                              {!row.warehouseTypeName && !row.storageZoneName && '-'}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-[15px] text-slate-700">
                            {row.purchasePrice !== null ? formatCurrency(row.purchasePrice) : '-'}
                          </TableCell>
                          <TableCell className="text-right text-[15px] text-slate-700">
                            {row.salePrice !== null ? formatCurrency(row.salePrice) : '-'}
                          </TableCell>
                          <TableCell className={`text-right text-[18px] font-semibold ${row.signedQuantity >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {row.signedQuantity >= 0 ? '+' : ''}
                            {formatNumber(row.signedQuantity)}
                          </TableCell>
                          <TableCell className="text-[15px] text-slate-600">{row.userName}</TableCell>
                          <TableCell className="text-[15px] italic text-slate-500">{row.note || '-'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={() => handleEditTransaction(row)}>
                                <Pencil size={15} />
                              </Button>
                              <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={() => handleViewProductDetail(row)}>
                                <Eye size={15} />
                              </Button>
                              {row.type === 'STOCK_IN' && (
                                <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={() => openBarcodeDialog([row])}>
                                  <Printer size={15} />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="pr-4 text-right">
                            {canDeleteTransactions ? (
                              <Button
                                type="button"
                                variant="outline"
                                className="h-9 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50"
                                onClick={async () => {
                                  const currentSelection = selectedTransactionIds;
                                  setSelectedTransactionIds([row.id]);
                                  if (window.confirm('Xoa giao dich nay?')) {
                                    try {
                                      await api.delete('/inventory/transactions', {
                                        data: { transactionIds: [row.id] },
                                      });
                                      await fetchTransactions();
                                      await fetchMetadata();
                                      if (activeTab === 'REPORT') await fetchReport();
                                    } catch (error: any) {
                                      alert(error.response?.data?.message || 'Khong the xoa giao dich');
                                    }
                                  }
                                  setSelectedTransactionIds(currentSelection);
                                }}
                              >
                                <Trash2 size={15} />
                              </Button>
                            ) : (
                              <span className="text-sm text-slate-400">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={13} className="py-14 text-center text-slate-500">
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
              <Label>Danh mục sản phẩm nhận</Label>
              <select className="form-select" value={preliminaryForm.categoryId} onChange={(e) => setPreliminaryForm((prev) => ({ ...prev, categoryId: e.target.value }))}>
                <option value="">Chọn danh mục</option>
                {categories.map((item) => (
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
            <Button
              variant="outline"
              onClick={() => submitPreliminaryCheck(true)}
              disabled={!preliminaryForm.categoryId || !preliminaryForm.quantity || !preliminaryForm.warehouseTypeId}
            >
              Thêm dòng
            </Button>
            <Button onClick={() => submitPreliminaryCheck(false)} disabled={!preliminaryForm.categoryId || !preliminaryForm.quantity || !preliminaryForm.warehouseTypeId}>
              Tạo phiếu sơ bộ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={productDetailOpen}
        onOpenChange={(open) => {
          setProductDetailOpen(open);
          if (!open) {
            setSelectedTransaction(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye size={18} />
              Chi tiết giao dịch
            </DialogTitle>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="text-[20px] font-semibold text-slate-950">
                  {selectedTransaction.productName || selectedTransaction.categoryName}
                </div>
                {selectedTransaction.sku && (
                  <div className="mt-1 text-sm font-mono text-indigo-600">{selectedTransaction.sku}</div>
                )}
                <div className="mt-1 text-sm text-slate-500">Danh mục: {selectedTransaction.categoryName}</div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-medium text-slate-500">Loại giao dịch</div>
                  <div className="text-[16px] font-semibold text-slate-950">
                    {selectedTransaction.kind === 'ADJUSTMENT'
                      ? 'Điều chỉnh'
                      : selectedTransaction.kind === 'STOCK_IN'
                        ? 'Nhập kho'
                        : 'Xuất kho'}
                  </div>
                </div>
                <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-medium text-slate-500">Số lượng</div>
                  <div className={`text-[18px] font-semibold ${selectedTransaction.signedQuantity >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {selectedTransaction.signedQuantity >= 0 ? '+' : ''}
                    {formatNumber(selectedTransaction.signedQuantity)}
                  </div>
                </div>
                <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-medium text-slate-500">Loại kho</div>
                  <div className="text-[16px] font-semibold text-slate-950">{selectedTransaction.warehouseTypeName || '-'}</div>
                </div>
                <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-medium text-slate-500">Thùng / Khu vực</div>
                  <div className="text-[16px] font-semibold text-slate-950">{selectedTransaction.storageZoneName || '-'}</div>
                </div>
                <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-medium text-slate-500">Người tạo</div>
                  <div className="text-[16px] font-semibold text-slate-950">{selectedTransaction.userName}</div>
                </div>
                <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-medium text-slate-500">Giá nhập</div>
                  <div className="text-[16px] font-semibold text-slate-950">
                    {selectedTransaction.purchasePrice !== null ? formatCurrency(selectedTransaction.purchasePrice) : '-'}
                  </div>
                </div>
                <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-medium text-slate-500">Thời gian tạo phiếu</div>
                  <div className="text-[16px] font-semibold text-slate-950">{formatDateTime(selectedTransaction.createdAt)}</div>
                </div>
                <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-medium text-slate-500">Thời gian nhập kho</div>
                  <div className="text-[16px] font-semibold text-slate-950">{formatDateOnly(selectedTransaction.actualStockDate)}</div>
                </div>
              </div>

              <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                <div className="text-sm font-medium text-slate-500">Ghi chú</div>
                <div className="min-h-[56px] text-[15px] text-slate-700">{selectedTransaction.note || 'Không có ghi chú.'}</div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDetailOpen(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={transferOpen}
        onOpenChange={(open) => {
          setTransferOpen(open);
          if (!open) {
            setSelectedTransaction(null);
            setTransferForm(defaultTransferForm());
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin size={18} />
              Chuyển vị trí danh mục
            </DialogTitle>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="text-sm font-medium text-slate-500">Danh mục hiện tại</div>
                  <div className="text-[17px] font-semibold text-slate-950">{selectedTransaction.categoryName}</div>
                </div>
                <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="text-sm font-medium text-slate-500">Vị trí hiện tại</div>
                  <div className="text-[17px] font-semibold text-slate-950">{selectedTransferCurrentPosition?.label || selectedTransaction.positionLabel || '-'}</div>
                  <div className="text-sm text-slate-500">Tồn hiện tại: {formatNumber(selectedTransferCurrentPosition?.currentStock || 0)}</div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Vị trí chuyển đến</Label>
                  <select
                    className="form-select"
                    value={transferForm.targetPositionId}
                    onChange={(e) => setTransferForm((prev) => ({ ...prev, targetPositionId: e.target.value }))}
                  >
                    <option value="">Chọn vị trí chuyển đến</option>
                    {positions
                      .filter((position) => position.id !== transferForm.currentPositionId)
                      .map((position) => (
                        <option key={position.id} value={position.id}>
                          {position.label}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Số lượng chuyển</Label>
                  <Input
                    type="number"
                    min={1}
                    max={selectedTransferCurrentPosition?.currentStock || 1}
                    value={transferForm.quantity}
                    onChange={(e) =>
                      setTransferForm((prev) => ({
                        ...prev,
                        quantity: Math.min(
                          Math.max(Number(e.target.value) || 1, 1),
                          Math.max(selectedTransferCurrentPosition?.currentStock || 1, 1),
                        ),
                      }))
                    }
                  />
                  <p className="text-xs text-slate-500">
                    Chỉ được chuyển tối đa {formatNumber(selectedTransferCurrentPosition?.currentStock || 0)} sản phẩm từ vị trí hiện tại.
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={handleSubmitTransfer}
              disabled={
                !transferForm.categoryId ||
                !transferForm.currentPositionId ||
                !transferForm.targetPositionId ||
                transferForm.quantity <= 0
              }
            >
              Xác nhận chuyển vị trí
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={barcodeDialogOpen} onOpenChange={setBarcodeDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer size={18} />
              In tem mã vạch sản phẩm
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {barcodeItems.map((item) => (
              <div key={item.transactionId} className="grid gap-4 rounded-2xl border border-slate-200 p-4 md:grid-cols-[1.6fr,1fr,140px]">
                <div>
                  <div className="font-semibold text-slate-900">{item.productName}</div>
                  <div className="mt-1 text-xs font-mono text-indigo-600">{item.barcodeValue}</div>
                  <div className="mt-1 text-sm font-medium text-slate-700">{formatCurrency(item.salePrice)}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
                  <div className="text-xs uppercase tracking-wide text-slate-400">Mẫu tem</div>
                  <div className="mt-2 text-sm text-slate-700">Tên SP + Barcode SKU + Giá bán</div>
                </div>
                <div className="space-y-2">
                  <Label>So luong tem</Label>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateBarcodeQuantity(item.transactionId, Number(e.target.value))}
                  />
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBarcodeDialogOpen(false)}>
              Huy
            </Button>
            <Button onClick={handlePrintBarcodes}>
              <Printer size={15} />
              In tem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Transaction Dialog */}
      <Dialog open={editTransactionOpen} onOpenChange={setEditTransactionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil size={18} />
              Sửa giao dịch
            </DialogTitle>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">{selectedTransaction.categoryName}</div>
                {selectedTransaction.productName && (
                  <div className="mt-1 text-sm text-slate-600">{selectedTransaction.productName}</div>
                )}
                {selectedTransaction.sku && (
                  <div className="mt-0.5 text-xs font-mono text-indigo-600">{selectedTransaction.sku}</div>
                )}
                <div className="mt-2 text-xs text-slate-500">
                  {selectedTransaction.kind === 'STOCK_IN' ? 'Nhập kho' : selectedTransaction.kind === 'STOCK_OUT' ? 'Xuất kho' : 'Điều chỉnh'}
                  {' • '}{selectedTransaction.positionLabel || '-'}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Số lượng</Label>
                <Input
                  type="number"
                  min={1}
                  value={editTransactionForm.quantity}
                  onChange={(e) => setEditTransactionForm((prev) => ({ ...prev, quantity: Number(e.target.value) || 0 }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Giá nhập</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={editTransactionForm.purchasePrice ? formatNumber(editTransactionForm.purchasePrice) : ''}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    setEditTransactionForm((prev) => ({ ...prev, purchasePrice: Number(raw) || 0 }));
                  }}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Ghi chú</Label>
                <textarea
                  className="form-control min-h-[88px] py-3"
                  value={editTransactionForm.notes}
                  onChange={(e) => setEditTransactionForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Ghi chú"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTransactionOpen(false)}>Hủy</Button>
            <Button onClick={submitEditTransaction} disabled={editTransactionForm.quantity <= 0}>
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pick Preliminary Check Dialog */}
      <Dialog open={pickPreliminaryOpen} onOpenChange={setPickPreliminaryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chọn phiếu kiểm sơ bộ để nhập kho</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500">Chọn phiếu kiểm sơ bộ đang chờ xử lý để bắt đầu nhập kho chi tiết.</p>
          <div className="max-h-[400px] space-y-2 overflow-auto">
            {pendingPreliminaryChecks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-slate-500">
                Không có phiếu kiểm sơ bộ nào đang chờ xử lý.
              </div>
            ) : (
              pendingPreliminaryChecks.map((check) => (
                <button
                  key={check.id}
                  type="button"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left hover:border-violet-300 hover:bg-violet-50/50 transition"
                  onClick={() => {
                    setPickPreliminaryOpen(false);
                    setActiveTab('STOCK_IN');
                    openStockInModal(check);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">{getPreliminaryCategoryLabel(check)}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {check.warehouseType?.name || '-'} • Số lượng: {formatNumber(check.quantity)}
                      </div>
                    </div>
                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600">
                      Chờ kiểm tra
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickPreliminaryOpen(false)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stockInOpen} onOpenChange={(open) => {
        setStockInOpen(open);
        if (!open) {
          resetStockInModal();
        }
      }}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus size={18} />
              Nhập hàng vào kho theo nhiều dòng
            </DialogTitle>
          </DialogHeader>

          {selectedPreliminaryCheck && (
            <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-4 text-sm text-violet-800">
              <div className="font-semibold">Đang xử lý từ kiểm sơ bộ</div>
              <div className="mt-1">
                {getPreliminaryCategoryLabel(selectedPreliminaryCheck)} • {selectedPreliminaryCheck.warehouseType?.name || 'Chưa chọn loại kho'} • Tổng số lượng chi tiết phải khớp: {formatNumber(selectedPreliminaryCheck.quantity)}
              </div>
            </div>
          )}

          <div className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 md:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">Số dòng</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{stockInLines.length} dòng nhập kho</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">Tổng số lượng</p>
              <p className={`mt-1 text-sm font-medium ${selectedPreliminaryCheck && stockInTotalQuantity !== selectedPreliminaryCheck.quantity ? 'text-rose-600' : 'text-violet-700'}`}>
                {formatNumber(stockInTotalQuantity)}
                {selectedPreliminaryCheck && stockInTotalQuantity !== selectedPreliminaryCheck.quantity && (
                  <span className="ml-2 text-xs font-normal">
                    (Cần đúng {formatNumber(selectedPreliminaryCheck.quantity)} — {stockInTotalQuantity < selectedPreliminaryCheck.quantity ? `thiếu ${formatNumber(selectedPreliminaryCheck.quantity - stockInTotalQuantity)}` : `thừa ${formatNumber(stockInTotalQuantity - selectedPreliminaryCheck.quantity)}`})
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">Cách gửi</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{stockInLines.length > 1 ? 'Batch stock-in' : 'Single stock-in'}</p>
            </div>
          </div>

          <div className="space-y-4">
            {stockInLines.map((line, index) => {
              const selectedCategory = categories.find((category) => category.id === line.categoryId);
              const selectedClassification = classifications.find((c) => c.id === line.classificationId);
              const selectedColor = colors.find((c) => c.id === line.colorId);
              const selectedSize = sizes.find((c) => c.id === line.sizeId);
              const selectedMaterial = materials.find((c) => c.id === line.materialId);

              const productName = [selectedClassification?.name, selectedColor?.name, selectedSize?.name, selectedMaterial?.name].filter(Boolean).join(' - ');

              const generateSkuPreview = () => {
                if (!selectedCategory || !selectedClassification || !selectedColor || !selectedSize || !selectedMaterial) return '';
                const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                return `${norm(selectedCategory.name).slice(0, 2)}${norm(selectedClassification.name).slice(0, 2)}${norm(selectedColor.name).slice(0, 2)}${norm(selectedSize.name).slice(0, 2)}${norm(selectedMaterial.name).slice(0, 2)}`;
              };
              const skuPreview = generateSkuPreview();

              return (
                <div key={line.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[16px] font-semibold text-slate-950">Dòng nhập {index + 1}</div>
                      <div className="text-sm text-slate-500">
                        {productName || (selectedCategory ? selectedCategory.name : 'Chưa chọn danh mục')}
                      </div>
                      {skuPreview && (
                        <div className="text-xs text-indigo-600 font-mono mt-0.5">SKU: {skuPreview}</div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50"
                      onClick={() => removeStockInLine(line.id)}
                      disabled={stockInLines.length === 1}
                    >
                      <Trash2 size={15} />
                      Xóa dòng
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-2 xl:col-span-2">
                      <Label>Danh mục *</Label>
                      <SearchableSelect
                        options={categories.map((c) => ({ value: c.id, label: c.name }))}
                        value={line.categoryId}
                        onChange={(v) => updateStockInLine(line.id, { categoryId: v })}
                        placeholder="Chọn danh mục"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Phân loại</Label>
                      <SearchableSelect
                        options={classifications.map((c) => ({ value: c.id, label: c.name }))}
                        value={line.classificationId}
                        onChange={(v) => updateStockInLine(line.id, { classificationId: v })}
                        placeholder="Chọn phân loại"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Màu sắc</Label>
                      <SearchableSelect
                        options={colors.map((c) => ({ value: c.id, label: c.name }))}
                        value={line.colorId}
                        onChange={(v) => updateStockInLine(line.id, { colorId: v })}
                        placeholder="Chọn màu sắc"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Kích thước</Label>
                      <SearchableSelect
                        options={sizes.map((c) => ({ value: c.id, label: c.name }))}
                        value={line.sizeId}
                        onChange={(v) => updateStockInLine(line.id, { sizeId: v })}
                        placeholder="Chọn kích thước"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Chất liệu</Label>
                      <SearchableSelect
                        options={materials.map((c) => ({ value: c.id, label: c.name }))}
                        value={line.materialId}
                        onChange={(v) => updateStockInLine(line.id, { materialId: v })}
                        placeholder="Chọn chất liệu"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Tình trạng hàng</Label>
                      <SearchableSelect
                        options={productConditions.map((c) => ({ value: c.id, label: c.name }))}
                        value={line.productConditionId}
                        onChange={(v) => updateStockInLine(line.id, { productConditionId: v })}
                        placeholder="Chọn tình trạng"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Số lượng *</Label>
                      <Input type="number" min={1} value={line.quantity} onChange={(e) => updateStockInLine(line.id, { quantity: Number(e.target.value) || 0 })} />
                    </div>

                    <div className="space-y-2">
                      <Label>Loại kho</Label>
                      <SearchableSelect
                        options={warehouseTypes.map((t) => ({ value: t.id, label: t.name }))}
                        value={line.warehouseTypeId}
                        onChange={(v) => updateStockInLine(line.id, { warehouseTypeId: v })}
                        placeholder="Chọn loại kho"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Khu vực / Thùng</Label>
                      <SearchableSelect
                        options={storageZones.map((z) => ({ value: z.id, label: z.name }))}
                        value={line.storageZoneId}
                        onChange={(v) => updateStockInLine(line.id, { storageZoneId: v })}
                        placeholder="Chọn khu vực"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Giá nhập *</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={line.purchasePrice ? formatNumber(line.purchasePrice) : ''}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, '');
                          updateStockInLine(line.id, { purchasePrice: Number(raw) || 0 });
                        }}
                        placeholder="0"
                      />
                    </div>

                    <div className="space-y-2 xl:col-span-2">
                      <Label>Thời gian nhập kho thực tế</Label>
                      <Input type="datetime-local" value={line.actualStockDate} onChange={(e) => updateStockInLine(line.id, { actualStockDate: e.target.value })} />
                    </div>

                    {productName && (
                      <div className="xl:col-span-4 rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400">Tên sản phẩm (auto)</p>
                        <p className="mt-1 text-sm font-medium text-indigo-900">{productName}</p>
                        {skuPreview && <p className="mt-0.5 text-xs font-mono text-indigo-600">SKU: {skuPreview}</p>}
                      </div>
                    )}

                    <div className="space-y-2 xl:col-span-4">
                      <Label>Ghi chú</Label>
                      <textarea className="form-control min-h-[88px] py-3" value={line.notes} onChange={(e) => updateStockInLine(line.id, { notes: e.target.value })} placeholder="Ghi chú thêm các thông tin khác về hàng hoá (Ví dụ như hàng lỗi ghi chú cụ thể các lỗi là gì , Ví dụ Hàng kí gửi ghi chú rõ Tên & Số ĐT của KH kí gửi , ...)" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={addStockInLine}>
              <Plus size={15} />
              Thêm dòng
            </Button>
            <Button variant="outline" onClick={() => setStockInOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={submitStockIn}
              disabled={stockInLines.length === 0}
            >
              {stockInLines.length > 1 ? 'Xác nhận nhập nhiều dòng' : 'Xác nhận nhập hàng'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stockOutOpen} onOpenChange={(open) => {
        setStockOutOpen(open);
        if (!open) {
          setStockOutSearch('');
          setStockOutSelectedProduct('');
          setStockOutSearchResults([]);
          setStockOutSearchOpen(false);
        }
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Xuất hàng khỏi kho</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">Tồn tại vị trí</p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {selectedStockOutPosition ? `${selectedStockOutPosition.label} - ${formatNumber(selectedStockOutPosition.currentStock)}` : 'Chưa chọn vị trí'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2 relative">
              <Label>Tìm sản phẩm *</Label>
              <Input
                type="text"
                placeholder="Gõ tên sản phẩm, phân loại, màu sắc, kích thước..."
                value={stockOutSearch}
                onChange={(e) => {
                  setStockOutSearch(e.target.value);
                  searchSkuCombos(e.target.value);
                }}
                onFocus={() => { if (stockOutSearchResults.length > 0) setStockOutSearchOpen(true); }}
              />
              {stockOutSelectedProduct && (
                <div className="mt-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800 flex items-center justify-between">
                  <span>{stockOutSelectedProduct}</span>
                  <button
                    type="button"
                    className="ml-2 text-indigo-400 hover:text-indigo-700"
                    onClick={() => {
                      setStockOutSelectedProduct('');
                      setStockOutForm((prev) => ({ ...prev, skuComboId: '', categoryId: '' }));
                      setStockOutSearch('');
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
              {stockOutSearchOpen && stockOutSearchResults.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-60 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                  {stockOutSearchResults.map((combo) => {
                    const productLabel = [combo.classification?.name, combo.color?.name, combo.size?.name, combo.material?.name].filter(Boolean).join(' - ');
                    return (
                      <button
                        key={combo.id}
                        type="button"
                        className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                        onClick={() => {
                          setStockOutForm((prev) => ({
                            ...prev,
                            skuComboId: combo.id,
                            categoryId: combo.categoryId || '',
                          }));
                          setStockOutSelectedProduct(productLabel + (combo.categoryName ? ` (${combo.categoryName})` : ''));
                          setStockOutSearch('');
                          setStockOutSearchOpen(false);
                          setStockOutSearchResults([]);
                        }}
                      >
                        <div className="text-sm font-medium text-slate-900">{productLabel}</div>
                        <div className="text-xs text-slate-500">
                          <span className="font-mono">{combo.compositeSku}</span>
                          {combo.categoryName && <span className="ml-2">• {combo.categoryName}</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {stockOutSearchOpen && stockOutSearch.length >= 1 && stockOutSearchResults.length === 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-lg">
                  Không tìm thấy sản phẩm nào
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Vị trí xuất</Label>
              <SearchableSelect
                options={positions.map((p) => ({ value: p.id, label: `${p.label} (tồn: ${p.currentStock})` }))}
                value={stockOutForm.warehousePositionId}
                onChange={(v) => setStockOutForm((prev) => ({ ...prev, warehousePositionId: v }))}
                placeholder="Chọn vị trí xuất"
              />
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
            <Button onClick={submitStockOut} disabled={!stockOutForm.skuComboId || !stockOutForm.categoryId || !stockOutForm.quantity}>
              Xác nhận xuất hàng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adjustmentOpen} onOpenChange={(open) => {
        setAdjustmentOpen(open);
        if (!open) {
          setAdjustSearch('');
          setAdjustSelectedProduct('');
          setAdjustSearchResults([]);
          setAdjustSearchOpen(false);
        }
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Điều chỉnh tồn kho</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">Vị trí</p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {selectedAdjustmentPosition ? `${selectedAdjustmentPosition.label} - ${formatNumber(selectedAdjustmentPosition.currentStock)}` : 'Chưa chọn vị trí'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2 relative">
              <Label>Tìm sản phẩm *</Label>
              <Input
                type="text"
                placeholder="Gõ tên sản phẩm, phân loại, màu sắc, kích thước..."
                value={adjustSearch}
                onChange={(e) => {
                  setAdjustSearch(e.target.value);
                  searchSkuCombos(e.target.value, 'adjust');
                }}
                onFocus={() => { if (adjustSearchResults.length > 0) setAdjustSearchOpen(true); }}
              />
              {adjustSelectedProduct && (
                <div className="mt-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800 flex items-center justify-between">
                  <span>{adjustSelectedProduct}</span>
                  <button
                    type="button"
                    className="ml-2 text-indigo-400 hover:text-indigo-700"
                    onClick={() => {
                      setAdjustSelectedProduct('');
                      setAdjustmentForm((prev) => ({ ...prev, categoryId: '' }));
                      setAdjustSearch('');
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
              {adjustSearchOpen && adjustSearchResults.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-60 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                  {adjustSearchResults.map((combo) => {
                    const productLabel = [combo.classification?.name, combo.color?.name, combo.size?.name, combo.material?.name].filter(Boolean).join(' - ');
                    return (
                      <button
                        key={combo.id}
                        type="button"
                        className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                        onClick={() => {
                          setAdjustmentForm((prev) => ({
                            ...prev,
                            categoryId: combo.categoryId || '',
                          }));
                          setAdjustSelectedProduct(productLabel + (combo.categoryName ? ` (${combo.categoryName})` : ''));
                          setAdjustSearch('');
                          setAdjustSearchOpen(false);
                          setAdjustSearchResults([]);
                        }}
                      >
                        <div className="text-sm font-medium text-slate-900">{productLabel}</div>
                        <div className="text-xs text-slate-500">
                          <span className="font-mono">{combo.compositeSku}</span>
                          {combo.categoryName && <span className="ml-2">• {combo.categoryName}</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {adjustSearchOpen && adjustSearch.length >= 1 && adjustSearchResults.length === 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-lg">
                  Không tìm thấy sản phẩm nào
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Vị trí</Label>
              <SearchableSelect
                options={positions.map((p) => ({ value: p.id, label: p.label }))}
                value={adjustmentForm.warehousePositionId}
                onChange={(v) => setAdjustmentForm((prev) => ({ ...prev, warehousePositionId: v }))}
                placeholder="Chọn vị trí"
              />
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
            <Button onClick={submitAdjustment} disabled={!adjustmentForm.categoryId || !adjustmentForm.quantity || !adjustmentForm.reason.trim()}>
              Xác nhận điều chỉnh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
