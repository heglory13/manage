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
  ImageIcon,
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
  X,
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
import { compressImageForUpload, compressReceiptImage } from '../lib/image';
import { formatNumber, matchSel } from '../lib/utils';
import { exportTransactionsToExcel } from '../lib/transactionExcel';
import { useAuth } from '../contexts/AuthContext';
import { defaultGeneralSettings, fetchGeneralSettings } from '../services/generalSettings';
import SmartFilter from '../components/common/SmartFilter';
import type { FilterField } from '../components/common/SmartFilter';
import { useSavedFilters } from '../hooks/useSavedFilters';
import { SearchableSelect } from '../components/ui/searchable-select';
import { TransactionExportDialog } from '../components/inventory/TransactionExportDialog';

const MAX_RECEIPT_IMAGES = 10;

type AttributeOption = {
  id: string;
  name: string;
  code?: string;
};

type StorageZone = {
  id: string;
  name: string;
  maxCapacity: number;
  currentStock: number;
  warehouseTypeId?: string | null;
};

type PositionOption = {
  id: string;
  label: string;
  currentStock: number;
};

type LayoutData = {
  id: string;
  name: string;
  positions: PositionOption[];
};

type TransactionRow = {
  id: string;
  categoryId: string | null;
  createdAt: string;
  actualStockDate: string | null;
  kind: 'ALL' | 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT' | 'TRANSFER';
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
  storageZoneId: string | null;
  warehousePositionId: string | null;
  productName: string | null;
  sku: string | null;
  skuComboId: string | null;
  receiptGroupId: string | null;
  classificationId: string | null;
  classificationName: string | null;
  colorId: string | null;
  colorName: string | null;
  sizeId: string | null;
  sizeName: string | null;
  materialId: string | null;
  materialName: string | null;
  productConditionId: string | null;
  productConditionName: string | null;
  warehouseTypeId: string | null;
  userName: string;
  note: string;
  imageUrls: string[];
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
  productName: string;
  sku: string;
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
  productName: string;
  sku: string;
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
  purchasePrice: number | null;
  salePrice: number;
  actualStockDate: string;
  notes: string;
};

type StockOutLineForm = {
  id: string;
  categoryId: string;
  storageZoneId: string;
  skuComboId: string;
  quantity: number;
  notes: string;
  search: string;
  selectedProduct: string;
};

type AdjustmentForm = {
  categoryId: string;
  skuComboId: string;
  storageZoneId: string;
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

type SearchSkuComboResult = {
  id: string;
  compositeSku: string;
  categoryId: string | null;
  categoryName: string | null;
  classification: { id: string; name: string };
  color: { id: string; name: string };
  size: { id: string; name: string };
  material: { id: string; name: string };
};

type EditTransactionForm = {
  quantity: number;
  purchasePrice: number;
  notes: string;
  categoryId: string;
  skuComboId: string;
  classificationId: string;
  colorId: string;
  sizeId: string;
  materialId: string;
  productConditionId: string;
  storageZoneId: string;
  warehouseTypeId: string;
  warehousePositionId: string;
  actualStockDate: string;
};

const transactionTabs = [
  { key: 'PRECHECK', label: 'Nhập kiểm sơ bộ' },
  { key: 'ALL', label: 'Tất cả' },
  { key: 'STOCK_IN', label: 'Nhập kho' },
  { key: 'STOCK_OUT', label: 'Xuất Kho' },
  { key: 'ADJUSTMENT', label: 'Điều chỉnh' },
  { key: 'TRANSFER', label: 'Điều chuyển kho' },
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
  purchasePrice: null,
  salePrice: 0,
  actualStockDate: new Date().toISOString().slice(0, 16),
  notes: '',
  ...overrides,
});

const createStockOutLine = (overrides: Partial<StockOutLineForm> = {}): StockOutLineForm => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  categoryId: '',
  storageZoneId: '',
  skuComboId: '',
  quantity: 1,
  notes: '',
  search: '',
  selectedProduct: '',
  ...overrides,
});

const defaultAdjustmentForm = (): AdjustmentForm => ({
  categoryId: '',
  skuComboId: '',
  storageZoneId: '',
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
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function formatCurrency(value: number) {
  return `${formatNumber(value)}đ`;
}

function escapeHtml(value?: string | null) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getStorageZoneRemaining(zone: StorageZone, reservedQuantity = 0) {
  return Math.max(zone.maxCapacity - zone.currentStock - reservedQuantity, 0);
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
  const [txPage, setTxPage] = useState(1);
  const [txPageSize, setTxPageSize] = useState(50);
  const [txTotal, setTxTotal] = useState(0);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [layouts, setLayouts] = useState<LayoutData[]>([]);
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
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionRow | null>(null);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [editTransactionOpen, setEditTransactionOpen] = useState(false);
  const [editTransactionForm, setEditTransactionForm] = useState<EditTransactionForm>({
    quantity: 0,
    purchasePrice: 0,
    notes: '',
    categoryId: '',
    skuComboId: '',
    classificationId: '',
    colorId: '',
    sizeId: '',
    materialId: '',
    productConditionId: '',
    storageZoneId: '',
    warehouseTypeId: '',
    warehousePositionId: '',
    actualStockDate: '',
  });
  const [editTransactionSearch, setEditTransactionSearch] = useState('');
  const [editTransactionSearchResults, setEditTransactionSearchResults] = useState<SearchSkuComboResult[]>([]);
  const [editTransactionSearchOpen, setEditTransactionSearchOpen] = useState(false);
  const [editTransactionSelectedProduct, setEditTransactionSelectedProduct] = useState('');
  const [editExistingImageUrls, setEditExistingImageUrls] = useState<string[]>([]);
  const [editReceiptImages, setEditReceiptImages] = useState<{ file: File; preview: string }[]>([]);
  const [transferForm, setTransferForm] = useState<TransferForm>(defaultTransferForm);
  const [preliminaryForm, setPreliminaryForm] = useState<PreliminaryCheckForm>(defaultPreliminaryForm);
  const [selectedPreliminaryCheck, setSelectedPreliminaryCheck] = useState<PreliminaryCheckRow | null>(null);
  const [stockInOpen, setStockInOpen] = useState(false);
  const [isStockInSubmitting, setIsStockInSubmitting] = useState(false);
  const [receiptImages, setReceiptImages] = useState<{ file: File; preview: string }[]>([]);
  const [receiptImageViewIndex, setReceiptImageViewIndex] = useState<number | null>(null);
  const [receiptDropActive, setReceiptDropActive] = useState(false);
  const [txImageView, setTxImageView] = useState<{ urls: string[]; index: number } | null>(null);
  const [pickPreliminaryOpen, setPickPreliminaryOpen] = useState(false);
  const [stockOutOpen, setStockOutOpen] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [stockInLines, setStockInLines] = useState<StockInLineForm[]>([createStockInLine()]);
  const [stockOutLines, setStockOutLines] = useState<StockOutLineForm[]>([createStockOutLine()]);
  const [stockOutSearchLineId, setStockOutSearchLineId] = useState<string | null>(null);
  const [stockOutSearchResults, setStockOutSearchResults] = useState<SearchSkuComboResult[]>([]);
  const [stockOutSearchOpen, setStockOutSearchOpen] = useState(false);
  const [stockOutZonesByLine, setStockOutZonesByLine] = useState<Record<string, Array<{ storageZoneId: string; storageZoneName: string; stock: number }>>>({});
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentForm>(defaultAdjustmentForm);
  const [adjustSearch, setAdjustSearch] = useState('');
  const [adjustSearchResults, setAdjustSearchResults] = useState<SearchSkuComboResult[]>([]);
  const [adjustSearchOpen, setAdjustSearchOpen] = useState(false);
  const [adjustSelectedProduct, setAdjustSelectedProduct] = useState('');
  const [reportStartDate, setReportStartDate] = useState(defaultRange.startDate);
  const [reportEndDate, setReportEndDate] = useState(defaultRange.endDate);
  const [reportSearch, setReportSearch] = useState('');
  const [reportRows, setReportRows] = useState<NxtReportApiRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [generalSettings, setGeneralSettings] = useState(defaultGeneralSettings);
  const [transactionExportOpen, setTransactionExportOpen] = useState(false);
  const [transactionExporting, setTransactionExporting] = useState(false);

  // Smart filter
  const transactionFilterFields = useMemo<FilterField[]>(() => {
    const buildOptions = (values: Array<string | number | null | undefined>) =>
      [...new Set(values
        .map((value) => (value ?? '').toString().trim())
        .filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'vi'))
        .map((value) => ({ value, label: value }));

    return [
      {
        key: 'kind',
        label: 'Loại',
        type: 'select',
        options: [
          { value: 'STOCK_IN', label: 'Nhập kho' },
          { value: 'STOCK_OUT', label: 'Xuất kho' },
          { value: 'ADJUSTMENT', label: 'Điều chỉnh' },
          { value: 'TRANSFER', label: 'Điều chuyển kho' },
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
      { key: 'dateFrom', label: 'Từ ngày', type: 'date' },
      { key: 'dateTo', label: 'Đến ngày', type: 'date' },
      {
        key: 'categoryName',
        label: 'Danh mục',
        type: 'text',
        placeholder: 'Chọn danh mục...',
        asyncLoad: async () => {
          const res = await api.get('/categories');
          const items = res.data.data || res.data || [];
          return items.map((c: any) => ({ value: c.name, label: c.name }));
        },
      },
      {
        key: 'productName',
        label: 'Sản phẩm',
        type: 'text',
        placeholder: 'Chọn sản phẩm...',
        options: buildOptions(rows.map((row) => row.productName)),
      },
      {
        key: 'sku',
        label: 'SKU',
        type: 'text',
        placeholder: 'Chọn SKU...',
        options: buildOptions(rows.map((row) => row.sku)),
      },
      {
        key: 'warehouseInfo',
        label: 'Kho / Thùng',
        type: 'text',
        placeholder: 'Chọn kho, thùng...',
        asyncLoad: async () => {
          const [zonesRes, typesRes] = await Promise.all([
            api.get('/input-declarations/storage-zones'),
            api.get('/input-declarations/warehouse-types'),
          ]);
          const zones = zonesRes.data.data || zonesRes.data || [];
          const types = typesRes.data.data || typesRes.data || [];
          return [
            ...zones.map((z: any) => ({ value: z.name, label: z.name })),
            ...types.map((t: any) => ({ value: t.name, label: t.name })),
          ];
        },
      },
      {
        key: 'purchasePrice',
        label: 'Giá nhập',
        type: 'number',
        options: buildOptions(rows.map((row) => row.purchasePrice)),
        placeholder: 'Chọn giá nhập...',
      },
      {
        key: 'userName',
        label: 'Người tạo',
        type: 'text',
        placeholder: 'Chọn người tạo...',
        asyncLoad: async () => {
          const res = await api.get('/users');
          const items = res.data.data || res.data || [];
          return items.map((u: any) => ({ value: u.name, label: u.name }));
        },
      },
    ];
  }, [rows]);

  const savedFilterHook = useSavedFilters({ pageKey: 'transactions' });

  const filteredRows = useMemo(() => {
    const f = savedFilterHook.filters;
    if (Object.keys(f).length === 0) return rows;

    const matchContains = (filterVal: unknown, itemVal: string) => {
      if (!filterVal || (Array.isArray(filterVal) && (filterVal as unknown[]).length === 0)) return true;
      const vals = Array.isArray(filterVal) ? (filterVal as string[]) : [String(filterVal)];
      return vals.some((v) => itemVal.toLowerCase().includes(v.toLowerCase()));
    };

    return rows.filter((row) => {
      if (!matchSel(f.kind, row.kind)) return false;
      if (!matchSel(f.status, row.status)) return false;
      if (!matchContains(f.categoryName, row.categoryName)) return false;
      if (!matchContains(f.productName, row.productName || '')) return false;
      if (!matchSel(f.sku, row.sku || '')) return false;
      if (
        f.warehouseInfo &&
        ![row.warehouseTypeName, row.storageZoneName, row.positionLabel]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes((f.warehouseInfo as string).toLowerCase()))
      ) return false;
      if (f.purchasePrice && Number(row.purchasePrice ?? -1) !== Number(f.purchasePrice)) return false;
      if (!matchContains(f.userName, row.userName)) return false;
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

  const selectedAdjustmentCategory = useMemo(() => categories.find((category) => category.id === adjustmentForm.categoryId), [categories, adjustmentForm.categoryId]);
  const selectedTransferCurrentZone = useMemo(
    () => storageZones.find((zone) => zone.id === (selectedTransaction?.storageZoneId || transferForm.currentPositionId)),
    [storageZones, selectedTransaction?.storageZoneId, transferForm.currentPositionId],
  );
  const selectedAdjustmentZone = useMemo(
    () => storageZones.find((zone) => zone.id === adjustmentForm.storageZoneId),
    [storageZones, adjustmentForm.storageZoneId]
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
  const getReservedQuantityForZone = useCallback((zoneId: string, currentLineId?: string) => {
    return stockInLines.reduce((sum, line) => {
      if (line.id === currentLineId || line.storageZoneId !== zoneId) return sum;
      return sum + Number(line.quantity || 0);
    }, 0);
  }, [stockInLines]);
  const getStorageZoneMeta = useCallback((line: StockInLineForm) => {
    const zone = storageZones.find((item) => item.id === line.storageZoneId);
    if (!zone) return null;

    const reservedQuantity = getReservedQuantityForZone(zone.id, line.id);
    const remaining = getStorageZoneRemaining(zone, reservedQuantity);

    return {
      zone,
      reservedQuantity,
      remaining,
      isExceeded: Number(line.quantity || 0) > remaining,
    };
  }, [getReservedQuantityForZone, storageZones]);
  const canDeleteTransactions = user?.role === 'ADMIN' && Boolean(user?.permissions?.transactions?.delete);
  const canSuspendTransactions =
    (user?.role === 'ADMIN' || user?.role === 'MANAGER') && Boolean(user?.permissions?.transactions?.edit);
  const canCreateTransactions = Boolean(user?.permissions?.transactions?.create);
  const canEditTransactions = Boolean(user?.permissions?.transactions?.edit);
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedTransactionIds.includes(row.id)),
    [rows, selectedTransactionIds],
  );

  const fetchTransactions = useCallback(async (page = txPage) => {
    setIsLoading(true);
    try {
      const kind = activeTab === 'REPORT' || activeTab === 'PRECHECK' ? 'ALL' : activeTab;
      const res = await api.get('/inventory/transactions', { params: { kind, limit: txPageSize, page } });
      setRows(res.data.data || []);
      setTxTotal(res.data.total || 0);
      setTxPage(page);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, txPageSize, txPage]);

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
      const [declarationRes, categoriesRes, layoutsRes] = await Promise.all([
        api.get('/input-declarations/all'),
        api.get('/input-declarations/categories'),
        api.get('/warehouse/layouts/with-skus'),
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

      const allLayouts: LayoutData[] = (layoutsRes.data || []).map((l: any) => ({
        id: l.id,
        name: l.name,
        positions: (l.positions || [])
          .filter((p: any) => p.label)
          .map((p: any) => ({ id: p.id, label: p.label, currentStock: p.currentStock })),
      }));
      setLayouts(allLayouts);
      setPositions(allLayouts.flatMap((l) => l.positions));
    } catch (error) {
      console.error('Error fetching transaction metadata:', error);
    }
  }, []);

  const getZonesForWarehouseType = useCallback((warehouseTypeId: string) => {
    if (!warehouseTypeId) return storageZones;
    // Compatible zones first, then incompatible ones so user can see them but with warning
    return [...storageZones].sort((a, b) => {
      const aOk = !a.warehouseTypeId || a.warehouseTypeId === warehouseTypeId;
      const bOk = !b.warehouseTypeId || b.warehouseTypeId === warehouseTypeId;
      if (aOk && !bOk) return -1;
      if (!aOk && bOk) return 1;
      return 0;
    });
  }, [storageZones]);

  const getZoneConflictName = useCallback((zone: StorageZone, warehouseTypeId: string): string | null => {
    if (!warehouseTypeId) return null;

    // Zone đã được gán rõ ràng vào một warehouse type
    if (zone.warehouseTypeId) {
      if (zone.warehouseTypeId === warehouseTypeId) return null;
      return warehouseTypes.find((t) => t.id === zone.warehouseTypeId)?.name ?? null;
    }

    // Zone chưa gán — suy ra từ position: tìm layout nào có position trùng tên zone
    for (const layout of layouts) {
      const hasPosition = layout.positions.some(
        (p) => p.label.toLowerCase() === zone.name.toLowerCase(),
      );
      if (hasPosition) {
        const matchingType = warehouseTypes.find(
          (t) => t.name.toLowerCase() === layout.name.toLowerCase(),
        );
        if (matchingType && matchingType.id !== warehouseTypeId) {
          return matchingType.name;
        }
      }
    }

    return null;
  }, [warehouseTypes, layouts]);

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
    setIsStockInSubmitting(false);
    setReceiptImages((prev) => {
      prev.forEach((img) => URL.revokeObjectURL(img.preview));
      return [];
    });
  }, []);

  const updateStockInLine = useCallback((lineId: string, patch: Partial<StockInLineForm>) => {
    setStockInLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        const nextLine = { ...line, ...patch };
        if (patch.warehouseTypeId !== undefined && patch.warehouseTypeId !== line.warehouseTypeId) {
          nextLine.storageZoneId = '';
        }
        return nextLine;
      }),
    );
  }, []);

  const addStockInLine = useCallback(() => {
    setStockInLines((prev) => [...prev, createStockInLine()]);
  }, []);

  const handleReceiptImageSelect = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!imageFiles.length) return;

    setReceiptImages((prev) => {
      const slots = MAX_RECEIPT_IMAGES - prev.length;
      if (slots <= 0) {
        alert(`Tối đa ${MAX_RECEIPT_IMAGES} ảnh mỗi phiếu.`);
        return prev;
      }
      return prev; // placeholder — real update below
    });

    const compressedAll = await Promise.all(
      imageFiles.slice(0, MAX_RECEIPT_IMAGES).map(async (file) => {
        const compressed = await compressReceiptImage(file);
        return { file: compressed, preview: URL.createObjectURL(compressed) };
      }),
    );

    setReceiptImages((prev) => {
      const slots = MAX_RECEIPT_IMAGES - prev.length;
      if (slots <= 0) return prev;
      const toAdd = compressedAll.slice(0, slots);
      return [...prev, ...toAdd];
    });
  }, []);

  const removeReceiptImage = useCallback((index: number) => {
    setReceiptImages((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
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
    if (isStockInSubmitting) return;
    setIsStockInSubmitting(true);
    try {
      // Validate all required fields per line
      const missingFields: string[] = [];
      stockInLines.forEach((line, index) => {
        const lineNum = index + 1;
        const zoneMeta = getStorageZoneMeta(line);
        if (!line.categoryId) missingFields.push(`Dòng ${lineNum}: chưa chọn Danh mục`);
        if (!line.classificationId) missingFields.push(`Dòng ${lineNum}: chưa chọn Phân loại`);
        if (!line.colorId) missingFields.push(`Dòng ${lineNum}: chưa chọn Màu sắc`);
        if (!line.sizeId) missingFields.push(`Dòng ${lineNum}: chưa chọn Kích thước`);
        if (!line.materialId) missingFields.push(`Dòng ${lineNum}: chưa chọn Chất liệu`);
        if (!line.productConditionId) missingFields.push(`Dòng ${lineNum}: chưa chọn Tình trạng hàng`);
        if (line.quantity <= 0) missingFields.push(`Dòng ${lineNum}: Số lượng phải lớn hơn 0`);
        if (!line.warehouseTypeId) missingFields.push(`Dòng ${lineNum}: chưa chọn Loại kho`);
        if (!line.storageZoneId) missingFields.push(`Dòng ${lineNum}: chưa chọn Khu vực / Thùng`);
        if (line.storageZoneId && line.warehouseTypeId) {
          const selectedZone = storageZones.find((z) => z.id === line.storageZoneId);
          const conflictTypeName = selectedZone ? getZoneConflictName(selectedZone, line.warehouseTypeId) : null;
          if (conflictTypeName) {
            missingFields.push(`Dòng ${lineNum}: Thùng "${selectedZone?.name}" đang được gán vào loại kho "${conflictTypeName}" — vui lòng chọn thùng khác`);
          }
        }
        if (zoneMeta && line.quantity > zoneMeta.remaining) {
          missingFields.push(`Dòng ${lineNum}: ${zoneMeta.zone.name} chỉ còn sức chứa ${formatNumber(zoneMeta.remaining)}/${formatNumber(zoneMeta.zone.maxCapacity)}`);
        }
        if (line.purchasePrice === null || line.purchasePrice < 0) missingFields.push(`Dòng ${lineNum}: Vui lòng nhập giá nhập kho (có thể nhập 0 nếu là hàng ký gửi)`);
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
        warehouseTypeId?: string;
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

        // Find warehousePosition matching the storageZone name, or auto-create if not found
        let warehousePositionId: string | undefined;
        if (item.storageZoneId) {
          const zone = storageZones.find((z) => z.id === item.storageZoneId);
          if (zone) {
            const warehouseType = warehouseTypes.find((t) => t.id === item.warehouseTypeId);
            const matchingLayout = warehouseType
              ? layouts.find((l) => l.name.toLowerCase() === warehouseType.name.toLowerCase())
              : undefined;
            const searchPositions = matchingLayout ? matchingLayout.positions : positions;
            const matchingPosition = searchPositions.find(
              (p) => p.label.toLowerCase() === zone.name.toLowerCase(),
            );
            if (matchingPosition) {
              warehousePositionId = matchingPosition.id;
            } else if (item.warehouseTypeId) {
              // Position not in cached layouts — fetch fresh and find or create
              try {
                const warehouseType = warehouseTypes.find((t) => t.id === item.warehouseTypeId);
                if (warehouseType) {
                  // Always fetch fresh layout data (cache may be stale)
                  const layoutRes = await api.get('/warehouse/layouts/with-skus');
                  let layout = (layoutRes.data || []).find(
                    (l: any) => l.name.toLowerCase() === warehouseType.name.toLowerCase(),
                  );
                  if (!layout) {
                    const createRes = await api.post('/warehouse/layout', {
                      name: warehouseType.name,
                      rows: 4,
                      columns: 6,
                      layoutMode: 'FREE',
                    });
                    layout = createRes.data;
                  }
                  if (layout) {
                    // Check if position already exists in fresh data before creating
                    const existingPos = (layout.positions || []).find(
                      (p: any) => p.label.toLowerCase() === zone.name.toLowerCase(),
                    );
                    if (existingPos) {
                      warehousePositionId = existingPos.id;
                    } else {
                      const posCount = layout.positions?.length || 0;
                      const newPosRes = await api.post('/warehouse/positions', {
                        layoutId: layout.id,
                        label: zone.name,
                        x: 24 + (posCount % 4) * 240,
                        y: 24 + Math.floor(posCount / 4) * 180,
                        width: 210,
                        height: 150,
                        maxCapacity: zone.maxCapacity,
                      });
                      warehousePositionId = newPosRes.data?.id;
                    }
                  }
                }
              } catch (err) {
                console.error('Auto-create position failed:', err);
              }
            }
          }
        }

        resolvedLines.push({
          categoryId: item.categoryId,
          purchasePrice: item.purchasePrice ?? 0,
          salePrice: Number(item.purchasePrice),
          productConditionId: item.productConditionId || undefined,
          storageZoneId: item.storageZoneId || undefined,
          warehouseTypeId: item.warehouseTypeId || undefined,
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

      if (resolvedLines.some((item) => !item.categoryId || item.purchasePrice < 0 || item.quantity <= 0)) {
        alert('Mỗi dòng nhập kho cần có danh mục, số lượng và giá nhập hợp lệ.');
        return;
      }

      // Upload receipt-level images
      const uploadedImageUrls: string[] = [];
      for (const img of receiptImages) {
        const formData = new FormData();
        formData.append('file', img.file);
        const uploadRes = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        uploadedImageUrls.push(uploadRes.data.url as string);
      }

      const linesWithImages = resolvedLines.map((line) => ({
        ...line,
        imageUrls: uploadedImageUrls.length > 0 ? uploadedImageUrls : undefined,
      }));

      if (linesWithImages.length === 1) {
        await api.post('/inventory/stock-in', {
          ...linesWithImages[0],
          preliminaryCheckId: selectedPreliminaryCheck?.id || undefined,
        });
      } else {
        await api.post('/inventory/stock-in/batch', {
          preliminaryCheckId: selectedPreliminaryCheck?.id || undefined,
          items: linesWithImages,
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
    } finally {
      setIsStockInSubmitting(false);
    }
  };

  const searchSkuCombos = useCallback(async (query: string, target: 'stockOut' | 'adjust' | 'edit' = 'stockOut') => {
    if (!query || query.length < 1) {
      if (target === 'stockOut') {
        setStockOutSearchResults([]);
        setStockOutSearchOpen(false);
      } else if (target === 'adjust') {
        setAdjustSearchResults([]);
        setAdjustSearchOpen(false);
      } else {
        setEditTransactionSearchResults([]);
        setEditTransactionSearchOpen(false);
      }
      return;
    }
    try {
      const res = await api.get('/input-declarations/sku-combos', {
        params: { search: query, limit: 10, ...(target === 'stockOut' ? { stockOut: 'true' } : {}) },
      });
      if (target === 'stockOut') {
        setStockOutSearchResults(res.data.data || []);
        setStockOutSearchOpen(true);
      } else if (target === 'adjust') {
        setAdjustSearchResults(res.data.data || []);
        setAdjustSearchOpen(true);
      } else {
        setEditTransactionSearchResults(res.data.data || []);
        setEditTransactionSearchOpen(true);
      }
    } catch {
      if (target === 'stockOut') setStockOutSearchResults([]);
      else if (target === 'adjust') setAdjustSearchResults([]);
      else setEditTransactionSearchResults([]);
    }
  }, []);

  const updateStockOutLine = (lineId: string, patch: Partial<StockOutLineForm>) => {
    setStockOutLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  };

  const fetchStockOutZonesForLine = async (lineId: string, skuComboId: string) => {
    try {
      const res = await api.get('/inventory/stock-by-zone', { params: { skuComboId } });
      setStockOutZonesByLine((prev) => ({ ...prev, [lineId]: res.data || [] }));
    } catch {
      setStockOutZonesByLine((prev) => ({ ...prev, [lineId]: [] }));
    }
  };

  const addStockOutLine = () => {
    setStockOutLines((prev) => [...prev, createStockOutLine()]);
  };

  const removeStockOutLine = (lineId: string) => {
    setStockOutLines((prev) => (prev.length === 1 ? prev : prev.filter((line) => line.id !== lineId)));
    if (stockOutSearchLineId === lineId) {
      setStockOutSearchLineId(null);
      setStockOutSearchResults([]);
      setStockOutSearchOpen(false);
    }
  };

  const submitStockOut = async () => {
    try {
      const resolvedLines = stockOutLines
        .filter((line) => line.categoryId && line.skuComboId && line.quantity > 0)
        .map((line) => ({
          categoryId: line.categoryId,
          skuComboId: line.skuComboId || undefined,
          storageZoneId: line.storageZoneId || undefined,
          quantity: Number(line.quantity),
          notes: line.notes || undefined,
        }));

      if (resolvedLines.length !== stockOutLines.length) {
        alert('Mỗi dòng xuất kho cần chọn sản phẩm, vị trí và số lượng hợp lệ.');
        return;
      }

      if (resolvedLines.length === 1) {
        await api.post('/inventory/stock-out', resolvedLines[0]);
      } else {
        await api.post('/inventory/stock-out/batch', {
          items: resolvedLines,
        });
      }
      setStockOutOpen(false);
      setStockOutLines([createStockOutLine()]);
      setStockOutSearchLineId(null);
      setStockOutSearchResults([]);
      setStockOutSearchOpen(false);
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
        skuComboId: adjustmentForm.skuComboId || undefined,
        storageZoneId: adjustmentForm.storageZoneId || undefined,
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
    const keywords = reportSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);

    return reportRows
      .map((row) => ({
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        productName: row.productName || row.categoryName,
        sku: row.sku || '-',
        openingQty: row.openingStock,
        openingValue: row.openingValue ?? 0,
        inQty: row.totalIn,
        inValue: row.totalInValue ?? 0,
        outQty: row.totalOut,
        outValue: row.totalOutValue ?? 0,
        closingQty: row.closingStock,
        closingValue: row.closingValue ?? 0,
      }))
      .filter((row) => {
        if (keywords.length === 0) return true;
        const searchableText = [row.productName, row.sku, row.categoryName].join(' ').toLowerCase();
        return keywords.every((kw) => searchableText.includes(kw));
      });
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

  const handleExportReportExcel = async () => {
    try {
      const res = await api.get('/reports/nxt/export', {
        params: { startDate: reportStartDate, endDate: reportEndDate },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bao-cao-nxt-${reportStartDate}-${reportEndDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      // When responseType is 'blob', error response data is also a blob
      let message = 'Không thể xuất file Excel. Có thể chưa có dữ liệu trong khoảng thời gian đã chọn.';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          if (json.message) message = json.message;
        } catch {
          // ignore parse error
        }
      } else if (err.response?.data?.message) {
        message = err.response.data.message;
      }
      alert(message);
    }
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

  const getTransactionSectionKind = useCallback(() => {
    if (activeTab === 'REPORT' || activeTab === 'PRECHECK') return 'ALL';
    return activeTab;
  }, [activeTab]);

  const buildTransactionExportParams = useCallback((includeFilters: boolean) => {
    const sectionKind = getTransactionSectionKind();
    const rawKind = savedFilterHook.filters.kind;
    const filterKinds = Array.isArray(rawKind)
      ? (rawKind as string[]).map((k) => k.toUpperCase())
      : typeof rawKind === 'string' && rawKind ? [rawKind.toUpperCase()] : [];

    if (includeFilters && sectionKind !== 'ALL' && filterKinds.length > 0 && !filterKinds.includes(sectionKind)) {
      return null;
    }

    const params: Record<string, string | number> = {
      kind: sectionKind !== 'ALL' ? sectionKind : includeFilters && filterKinds.length === 1 ? filterKinds[0] : 'ALL',
      page: 1,
      limit: 100000,
    };

    if (!includeFilters) {
      return params;
    }

    const { status, categoryName, productName, sku, warehouseInfo, purchasePrice, userName, dateFrom, dateTo } = savedFilterHook.filters;

    const toParam = (v: unknown) => Array.isArray(v) ? (v as string[]).join(',') : (typeof v === 'string' ? v : '');

    if (status && (Array.isArray(status) ? (status as string[]).length > 0 : status)) params.status = toParam(status);
    if (categoryName && (Array.isArray(categoryName) ? (categoryName as string[]).length > 0 : categoryName)) params.categoryName = toParam(categoryName);
    if (productName && (Array.isArray(productName) ? (productName as string[]).length > 0 : productName)) params.productName = toParam(productName);
    if (sku && (Array.isArray(sku) ? (sku as string[]).length > 0 : sku)) params.sku = toParam(sku);
    if (typeof warehouseInfo === 'string' && warehouseInfo) params.positionLabel = warehouseInfo;
    if (purchasePrice && (Array.isArray(purchasePrice) ? (purchasePrice as string[]).length > 0 : purchasePrice)) params.purchasePrice = toParam(purchasePrice);
    if (userName && (Array.isArray(userName) ? (userName as string[]).length > 0 : userName)) params.userName = toParam(userName);
    if (typeof dateFrom === 'string' && dateFrom) params.dateFrom = dateFrom;
    if (typeof dateTo === 'string' && dateTo) params.dateTo = dateTo;

    return params;
  }, [getTransactionSectionKind, savedFilterHook.filters]);

  const exportTransactionRows = useCallback(async (includeFilters: boolean) => {
    const params = buildTransactionExportParams(includeFilters);
    if (params === null) {
      alert('Không có transaction nào khớp với tab hiện tại và bộ lọc đang chọn.');
      return;
    }

    setTransactionExporting(true);
    try {
      const res = await api.get('/inventory/transactions', { params });
      const exportRows = res.data.data || [];

      if (exportRows.length === 0) {
        alert('Không có transaction nào để xuất Excel.');
        return;
      }

      const sectionKind = getTransactionSectionKind().toLowerCase();
      const mode = includeFilters ? 'filtered' : 'all';
      const today = new Date().toISOString().slice(0, 10);
      exportTransactionsToExcel(exportRows, `transactions-${sectionKind}-${mode}-${today}.xlsx`);
      setTransactionExportOpen(false);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Không thể xuất Excel transaction');
    } finally {
      setTransactionExporting(false);
    }
  }, [buildTransactionExportParams, getTransactionSectionKind]);

  const getSkuComboLabel = (combo: SearchSkuComboResult) =>
    [combo.classification?.name, combo.color?.name, combo.size?.name, combo.material?.name]
      .filter(Boolean)
      .join(' - ');

  const getTransactionAttributeLabel = (row: TransactionRow) =>
    [row.classificationName, row.colorName, row.sizeName, row.materialName]
      .filter(Boolean)
      .join(' - ');

  const getEditAttributeLabel = (form: EditTransactionForm) =>
    [
      classifications.find((item) => item.id === form.classificationId)?.name,
      colors.find((item) => item.id === form.colorId)?.name,
      sizes.find((item) => item.id === form.sizeId)?.name,
      materials.find((item) => item.id === form.materialId)?.name,
    ]
      .filter(Boolean)
      .join(' - ');

  const buildTransactionReceiptNumber = (row: TransactionRow) => {
    const prefix = row.type === 'STOCK_IN' ? 'PNK' : 'PXK';
    const compactId = (row.receiptGroupId || row.id).replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
    return `${prefix}-${compactId || row.id.slice(-6).toUpperCase()}`;
  };

  const getReceiptRows = (row: TransactionRow) => {
    if (row.receiptGroupId) {
      return rows
        .filter((item) => item.receiptGroupId === row.receiptGroupId && item.type === row.type)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }

    const anchorTime = new Date(row.createdAt).getTime();
    return rows
      .filter((item) => {
        if (item.type !== row.type) return false;
        if (item.userName !== row.userName) return false;
        const delta = Math.abs(new Date(item.createdAt).getTime() - anchorTime);
        return delta <= 10000;
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  };

  const buildTransactionPrintHtml = (receiptRows: TransactionRow[]) => {
    const anchorRow = receiptRows[0];
    const receiptTitle = anchorRow.type === 'STOCK_IN' ? 'PHIẾU NHẬP KHO' : 'PHIẾU XUẤT KHO';
    const quantityLabel = anchorRow.type === 'STOCK_IN' ? 'Số lượng nhập' : 'Số lượng xuất';
    const receiptNumber = buildTransactionReceiptNumber(anchorRow);
    const actualDateText = formatDateOnly(anchorRow.actualStockDate || anchorRow.createdAt);
    const totalQuantity = receiptRows.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const categoryText = Array.from(new Set(receiptRows.map((item) => item.categoryName).filter(Boolean))).join(', ') || '-';
    const locationText = Array.from(
      new Set(
        receiptRows
          .map((item) => [item.warehouseTypeName, item.storageZoneName || item.positionLabel].filter(Boolean).join(' - ') || '-')
          .filter(Boolean),
      ),
    ).join('; ');
    const conditionText = Array.from(new Set(receiptRows.map((item) => item.productConditionName || '-'))).join(', ');
    const companyName = escapeHtml(generalSettings.storeName || generalSettings.brandName || 'CÔNG TY');
    const companyAddress = escapeHtml(generalSettings.address || '-');
    const companyPhone = escapeHtml(generalSettings.phone || '-');
    const companyEmail = escapeHtml(generalSettings.email || '-');
    const noteText = escapeHtml(
      receiptRows
        .map((item, index) => {
          const cleanNote = item.note?.trim();
          if (!cleanNote) return '';
          const label = getTransactionAttributeLabel(item) || item.productName || item.categoryName || `Dòng ${index + 1}`;
          return `${label}: ${cleanNote}`;
        })
        .filter(Boolean)
        .join(' | ') || 'Không có ghi chú',
    );
    const receiptBodyRows = receiptRows
      .map((item, index) => {
        const productLabel = getTransactionAttributeLabel(item) || item.productName || item.categoryName || '-';
        return `
        <tr>
          <td class="text-center">${index + 1}</td>
          <td>${escapeHtml(item.categoryName || '-')}</td>
          <td>${escapeHtml(productLabel)}</td>
          <td>${escapeHtml(item.sku || '-')}</td>
          <td class="text-right">${formatNumber(item.quantity)}</td>
          <td class="text-center">Cái</td>
          <td>${escapeHtml(item.productConditionName || '-')}</td>
        </tr>`;
      })
      .join('');

    return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${receiptTitle}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: "Times New Roman", serif; margin: 24px; color: #111827; font-size: 16px; }
    .sheet { max-width: 900px; margin: 0 auto; }
    .top { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 32px; align-items: start; }
    .company { font-size: 15px; line-height: 1.55; }
    .company strong { font-size: 18px; text-transform: uppercase; }
    .form-meta { text-align: center; font-size: 15px; line-height: 1.45; }
    .form-meta strong { display: block; font-size: 19px; margin-bottom: 6px; }
    .title { margin-top: 28px; text-align: center; }
    .title h1 { margin: 0; font-size: 30px; letter-spacing: 0.4px; }
    .title p { margin: 8px 0 0; font-size: 18px; }
    .info { margin-top: 20px; font-size: 17px; line-height: 1.7; }
    .info-row { display: flex; gap: 8px; }
    .info-label { min-width: 120px; }
    .info-value { flex: 1; }
    table { width: 100%; border-collapse: collapse; margin-top: 18px; }
    th, td { border: 1px solid #111827; padding: 8px 10px; font-size: 16px; vertical-align: top; }
    th { text-align: center; background: #f3f4f6; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .note { margin-top: 10px; font-size: 16px; }
    .signatures { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 40px; text-align: center; }
    .sign-title { font-weight: 700; text-transform: uppercase; font-size: 15px; }
    .sign-sub { margin-top: 6px; font-style: italic; }
    .sign-space { height: 84px; }
    @media print { body { margin: 0; } .sheet { padding: 12px 16px; } }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="top">
      <div class="company">
        <div>Đơn vị:</div>
        <strong>${companyName}</strong>
        <div>Địa chỉ: ${companyAddress}</div>
        <div>Điện thoại: ${companyPhone}</div>
        <div>Email: ${companyEmail}</div>
      </div>
      <div class="form-meta">
        <strong>Mẫu số: 02 - VT</strong>
        <div>(Ban hành theo QĐ số 48/2006/QĐ-BTC</div>
        <div>ngày 14/09/2006 của Bộ trưởng BTC)</div>
      </div>
    </div>

    <div class="title">
      <h1>${receiptTitle}</h1>
      <p>Ngày: ${escapeHtml(actualDateText)}</p>
    </div>

    <div class="info">
      <div class="info-row"><div class="info-label">Số phiếu:</div><div class="info-value"><strong>${escapeHtml(receiptNumber)}</strong> (${receiptRows.length} dòng hàng)</div></div>
      <div class="info-row"><div class="info-label">Người lập phiếu:</div><div class="info-value">${escapeHtml(anchorRow.userName || '-')}</div></div>
      <div class="info-row"><div class="info-label">Danh mục:</div><div class="info-value">${escapeHtml(categoryText)}</div></div>
      <div class="info-row"><div class="info-label">Kho / Thùng:</div><div class="info-value">${escapeHtml(locationText)}</div></div>
      <div class="info-row"><div class="info-label">Tình trạng hàng:</div><div class="info-value">${escapeHtml(conditionText)}</div></div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 8%;">STT</th>
          <th style="width: 18%;">Danh mục</th>
          <th>Sản phẩm</th>
          <th style="width: 18%;">SKU</th>
          <th>${quantityLabel}</th>
          <th style="width: 12%;">Đơn vị</th>
          <th style="width: 14%;">Tình trạng</th>
        </tr>
      </thead>
      <tbody>
        ${receiptBodyRows}
        <tr>
          <td colspan="4" class="text-right"><strong>Cộng</strong></td>
          <td class="text-right"><strong>${formatNumber(totalQuantity)}</strong></td>
          <td class="text-center"><strong>Cái</strong></td>
          <td></td>
        </tr>
      </tbody>
    </table>

    <div class="note">Ghi chú: ${noteText}</div>

    <div class="signatures">
      <div>
        <div class="sign-title">Thủ trưởng đơn vị</div>
        <div class="sign-sub">(Ký, họ tên, đóng dấu)</div>
        <div class="sign-space"></div>
      </div>
      <div>
        <div class="sign-title">Kế toán trưởng</div>
        <div class="sign-sub">(Ký, họ tên)</div>
        <div class="sign-space"></div>
      </div>
      <div>
        <div class="sign-title">Người lập phiếu</div>
        <div class="sign-sub">(Ký, họ tên)</div>
        <div class="sign-space"></div>
      </div>
      <div>
        <div class="sign-title">${anchorRow.type === 'STOCK_IN' ? 'Người giao hàng' : 'Người nhận hàng'}</div>
        <div class="sign-sub">(Ký, họ tên)</div>
        <div class="sign-space"></div>
      </div>
    </div>
  </div>
  <script>window.onload=()=>{window.focus();window.print();};</script>
</body>
</html>`;
  };

  const handlePrintTransactionReceipt = (row: TransactionRow) => {
    if (row.kind === 'ADJUSTMENT') {
      alert('Phiếu điều chỉnh chưa hỗ trợ in mẫu riêng.');
      return;
    }

    const receiptRows = getReceiptRows(row);
    const printWindow = window.open('', '_blank', 'width=960,height=720');
    if (!printWindow) return;
    printWindow.document.write(buildTransactionPrintHtml(receiptRows));
    printWindow.document.close();
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
      categoryId: row.categoryId || '',
      skuComboId: row.skuComboId || '',
      classificationId: row.classificationId || '',
      colorId: row.colorId || '',
      sizeId: row.sizeId || '',
      materialId: row.materialId || '',
      productConditionId: row.productConditionId || '',
      storageZoneId: row.storageZoneId || '',
      warehouseTypeId: row.warehouseTypeId || '',
      warehousePositionId: row.warehousePositionId || '',
      actualStockDate: row.actualStockDate ? row.actualStockDate.slice(0, 16) : '',
    });
    setEditExistingImageUrls(row.imageUrls ?? []);
    setEditReceiptImages([]);
    setEditTransactionSelectedProduct(getTransactionAttributeLabel(row) || row.productName || row.sku || '');
    setEditTransactionSearch('');
    setEditTransactionSearchResults([]);
    setEditTransactionSearchOpen(false);
    setEditTransactionOpen(true);
  };

  const handleEditReceiptImageSelect = async (files: FileList | null) => {
    if (!files) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!imageFiles.length) return;
    const totalExisting = editExistingImageUrls.length + editReceiptImages.length;
    const slots = MAX_RECEIPT_IMAGES - totalExisting;
    if (slots <= 0) { alert(`Tối đa ${MAX_RECEIPT_IMAGES} ảnh mỗi phiếu.`); return; }
    const compressedAll = await Promise.all(
      imageFiles.slice(0, slots).map(async (file) => {
        const compressed = await compressReceiptImage(file);
        return { file: compressed, preview: URL.createObjectURL(compressed) };
      }),
    );
    setEditReceiptImages((prev) => [...prev, ...compressedAll].slice(0, MAX_RECEIPT_IMAGES - editExistingImageUrls.length));
  };

  const resolveEditTransactionSkuComboId = async () => {
    const { classificationId, colorId, sizeId, materialId, categoryId, skuComboId } = editTransactionForm;
    const hasAnyAttribute = [classificationId, colorId, sizeId, materialId].some(Boolean);
    const hasAllAttributes = [classificationId, colorId, sizeId, materialId].every(Boolean);

    if (!hasAnyAttribute) {
      return skuComboId || undefined;
    }

    if (!hasAllAttributes) {
      throw new Error('Vui lòng chọn đủ Phân loại, Màu sắc, Kích thước và Chất liệu để cập nhật sản phẩm.');
    }

    const res = await api.post('/input-declarations/sku-combos/find-or-create', {
      classificationId,
      colorId,
      sizeId,
      materialId,
      categoryId: categoryId || undefined,
    });

    return res.data.id as string;
  };

  const submitEditTransaction = async () => {
    if (!selectedTransaction) return;
    const validationErrors: string[] = [];
    if (editTransactionForm.quantity <= 0) validationErrors.push('Số lượng phải lớn hơn 0');
    if (selectedTransaction.kind === 'STOCK_IN') {
      if (!editTransactionForm.productConditionId) validationErrors.push('Vui lòng chọn Tình trạng hàng');
      if (!editTransactionForm.warehouseTypeId) validationErrors.push('Vui lòng chọn Loại kho');
      if (!editTransactionForm.storageZoneId) validationErrors.push('Vui lòng chọn Thùng / Khu vực');
      if (editTransactionForm.storageZoneId && editTransactionForm.warehouseTypeId) {
        const selZone = storageZones.find((z) => z.id === editTransactionForm.storageZoneId);
        const conflictName = selZone ? getZoneConflictName(selZone, editTransactionForm.warehouseTypeId) : null;
        if (conflictName) {
          validationErrors.push(`Thùng "${selZone?.name}" đang được gán vào loại kho "${conflictName}". Vui lòng chọn thùng khác.`);
        }
      }
    }
    if (validationErrors.length > 0) { alert(validationErrors.join('\n')); return; }
    try {
      const resolvedSkuComboId = await resolveEditTransactionSkuComboId();
      const uploadedNewUrls: string[] = [];
      for (const img of editReceiptImages) {
        const formData = new FormData();
        formData.append('file', img.file);
        const uploadRes = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        uploadedNewUrls.push(uploadRes.data.url);
      }
      const finalImageUrls = [...editExistingImageUrls, ...uploadedNewUrls];
      await api.patch(`/inventory/transactions/${selectedTransaction.id}`, {
        quantity: editTransactionForm.quantity,
        purchasePrice: editTransactionForm.purchasePrice,
        categoryId: editTransactionForm.categoryId || null,
        skuComboId: resolvedSkuComboId || null,
        productConditionId: editTransactionForm.productConditionId || null,
        storageZoneId: editTransactionForm.storageZoneId || null,
        warehousePositionId: editTransactionForm.warehousePositionId || null,
        warehouseTypeId: editTransactionForm.warehouseTypeId || null,
        actualStockDate: editTransactionForm.actualStockDate || null,
        notes: editTransactionForm.notes || null,
        imageUrls: finalImageUrls,
      });
      setEditTransactionOpen(false);
      setSelectedTransaction(null);
      setEditTransactionSelectedProduct('');
      setEditExistingImageUrls([]);
      setEditReceiptImages([]);
      fetchTransactions();
      fetchMetadata();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Không thể cập nhật giao dịch');
    }
  };

  const handleOpenTransfer = (row: TransactionRow) => {
    alert(`Chuyển vị trí theo danh mục chưa được hỗ trợ trong giai đoạn này: ${row.categoryName}`);
  };

  const handleSubmitTransfer = async () => {
    if (!selectedTransaction) return;

    try {
      const sourceZoneName = selectedTransaction.storageZoneName || '-';
      const targetZone = storageZones.find((z) => z.id === transferForm.targetPositionId);
      const targetZoneName = targetZone?.name || '-';

      await api.post('/inventory/stock-out', {
        categoryId: transferForm.categoryId,
        storageZoneId: selectedTransaction.storageZoneId || undefined,
        warehousePositionId: selectedTransaction.warehousePositionId || undefined,
        quantity: Number(transferForm.quantity),
        notes: `Chuyển khu vực từ ${sourceZoneName} sang ${targetZoneName}`,
      });

      await api.post('/inventory/stock-in', {
        categoryId: transferForm.categoryId,
        purchasePrice:
          selectedTransaction.purchasePrice ?? 1,
        salePrice:
          selectedTransaction.salePrice ?? 1,
        storageZoneId: transferForm.targetPositionId,
        quantity: Number(transferForm.quantity),
        actualStockDate: new Date().toISOString().slice(0, 16),
        notes: `Nhận chuyển khu vực từ ${sourceZoneName}`,
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
            {canCreateTransactions && (
              <Button variant="outline" className="h-11 rounded-2xl border-emerald-200 px-5 text-emerald-700 hover:bg-emerald-50" onClick={() => {
                setPickPreliminaryOpen(true);
              }}>
                <ArrowDownToLine size={16} />
                Nhập kho
              </Button>
            )}
            {canCreateTransactions && (
              <Button variant="outline" className="h-11 rounded-2xl border-rose-200 px-5 text-rose-600 hover:bg-rose-50" onClick={() => setStockOutOpen(true)}>
                <ArrowUpToLine size={16} />
                Xuất kho
              </Button>
            )}
            {canEditTransactions && (
              <Button variant="outline" className="h-11 rounded-2xl border-amber-300 px-5 text-amber-600 hover:bg-amber-50" onClick={() => setAdjustmentOpen(true)}>
                <RefreshCcw size={16} />
                Điều chỉnh
              </Button>
            )}
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
                  <div className="relative w-full md:max-w-[500px]">
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
                          <tr key={row.sku + row.categoryId} className="bg-white">
                            <td className="border-b border-r border-slate-200 px-4 py-4 align-top">
                              <div className="text-[16px] font-semibold text-slate-950">{row.productName}</div>
                              <div className="text-[12px] font-mono text-indigo-600">{row.sku}</div>
                              <div className="text-[12px] text-slate-400">{row.categoryName}</div>
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
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="text-[16px] font-semibold text-slate-950">{getPreliminaryCategoryLabel(item)}</div>
                          <div className="text-[14px] text-slate-500">
                            {formatDateTime(item.createdAt)} • {item.warehouseType?.name || 'Chưa chọn loại kho'} • SL sơ bộ: {formatNumber(item.quantity)}
                          </div>
                          {item.note && (
                            <div className="flex items-start gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                              <span className="mt-0.5 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Ghi chú:</span>
                              <span className="break-words">{item.note}</span>
                            </div>
                          )}
                        </div>
                        <Button className="h-10 shrink-0 rounded-2xl bg-violet-600 px-4 hover:bg-violet-700" onClick={() => startDetailedCheck(item)}>
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
              draftFilters={savedFilterHook.draftFilters}
              savedFilters={savedFilterHook.savedFilters}
              activeFilterId={savedFilterHook.activeFilterId}
              hasPendingChanges={savedFilterHook.hasPendingChanges}
              onUpdateFilter={savedFilterHook.updateFilter}
              onRemoveFilter={savedFilterHook.removeFilter}
              onClearFilters={savedFilterHook.clearFilters}
              onApplyDraftFilters={savedFilterHook.applyDraftFilters}
              onApplyFilter={savedFilterHook.applyFilter}
              onSaveFilter={savedFilterHook.saveFilter}
              onDeleteFilter={savedFilterHook.deleteFilter}
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-slate-500">
                Hiển thị {formatNumber(filteredRows.length)} transaction
              </div>
              <Button variant="outline" className="h-11 rounded-2xl border-violet-200 px-5 text-violet-600 hover:bg-violet-50" onClick={() => setTransactionExportOpen(true)}>
                <Download size={16} />
                Xuất Excel
              </Button>
            </div>

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
                  <div className="hidden md:block overflow-x-auto">
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
                      <TableHead className="text-right">SL</TableHead>
                      <TableHead>Người tạo</TableHead>
                      <TableHead>Ghi chú</TableHead>
                      <TableHead>Ảnh</TableHead>
                      <TableHead className="text-right">Sua</TableHead>
                      <TableHead className="pr-4 text-right">Xoa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row) => {
                      const isIn = row.kind === 'STOCK_IN';
                      const isAdjustment = row.kind === 'ADJUSTMENT';
                      const isTransfer = row.kind === 'TRANSFER';
                      const isChecked = selectedTransactionIds.includes(row.id);
                      const typeLabel = isTransfer ? 'Điều chuyển' : isAdjustment ? 'Điều chỉnh' : isIn ? 'Nhập kho' : 'Xuất kho';
                      const typeClass = isTransfer
                        ? 'border-sky-200 bg-sky-50 text-sky-700'
                        : isAdjustment
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
                          <TableCell className={`text-right text-[18px] font-semibold ${row.signedQuantity >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {row.signedQuantity >= 0 ? '+' : ''}
                            {formatNumber(row.signedQuantity)}
                          </TableCell>
                          <TableCell className="text-[15px] text-slate-600">{row.userName}</TableCell>
                          <TableCell className="text-[15px] italic text-slate-500">{row.note || '-'}</TableCell>
                          <TableCell>
                            {row.imageUrls?.length > 0 ? (
                              <button
                                type="button"
                                className="flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100"
                                onClick={() => setTxImageView({ urls: row.imageUrls, index: 0 })}
                              >
                                <ImageIcon size={12} />
                                {row.imageUrls.length}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {canEditTransactions && (
                                <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={() => handleEditTransaction(row)}>
                                  <Pencil size={15} />
                                </Button>
                              )}
                              <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={() => handleViewProductDetail(row)}>
                                <Eye size={15} />
                              </Button>
                              {row.kind !== 'ADJUSTMENT' && row.kind !== 'TRANSFER' && (
                                <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={() => handlePrintTransactionReceipt(row)}>
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
                  </div>
                )}

                {/* Mobile card list */}
                {!isLoading && (
                  <div className="md:hidden divide-y divide-slate-100">
                    {filteredRows.length === 0 ? (
                      <div className="py-14 text-center text-slate-500">Chưa có giao dịch phù hợp.</div>
                    ) : filteredRows.map((row) => {
                      const mIsIn = row.kind === 'STOCK_IN';
                      const mIsAdj = row.kind === 'ADJUSTMENT';
                      const mIsTrf = row.kind === 'TRANSFER';
                      const mChecked = selectedTransactionIds.includes(row.id);
                      const mTypeLabel = mIsTrf ? 'Điều chuyển' : mIsAdj ? 'Điều chỉnh' : mIsIn ? 'Nhập kho' : 'Xuất kho';
                      const mTypeClass = mIsTrf ? 'border-sky-200 bg-sky-50 text-sky-700' : mIsAdj ? 'border-amber-300 bg-amber-50 text-amber-600' : mIsIn ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-rose-200 bg-rose-50 text-rose-600';
                      const mStatusClass = row.status === 'ACTIVE' ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-amber-200 bg-amber-50 text-amber-700';
                      return (
                        <div key={row.id} className={`px-4 py-4 ${mChecked ? 'bg-indigo-50' : ''}`}>
                          <div className="flex items-start gap-3">
                            <input type="checkbox" className="mt-1 shrink-0" checked={mChecked} onChange={() => toggleTransactionSelection(row.id)} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex flex-wrap gap-1.5">
                                  <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${mTypeClass}`}>{mTypeLabel}</span>
                                  <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${mStatusClass}`}>{row.status === 'ACTIVE' ? 'Đang GD' : 'Ngưng GD'}</span>
                                </div>
                                <div className={`text-xl font-bold tabular-nums shrink-0 ${row.signedQuantity >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {row.signedQuantity >= 0 ? '+' : ''}{formatNumber(row.signedQuantity)}
                                </div>
                              </div>
                              <div className="mb-2">
                                <div className="font-semibold text-slate-900">{row.categoryName}</div>
                                {row.productName && <div className="text-sm text-slate-600">{row.productName}</div>}
                                {row.sku && <div className="text-xs font-mono text-indigo-600">{row.sku}</div>}
                              </div>
                              <div className="space-y-0.5 text-xs text-slate-500">
                                <div className="flex gap-2"><span className="w-16 shrink-0">Tạo lúc</span><span>{formatDateTime(row.createdAt)}</span></div>
                                {(row.warehouseTypeName || row.storageZoneName) && (
                                  <div className="flex gap-2"><span className="w-16 shrink-0">Kho</span><span>{[row.warehouseTypeName, row.storageZoneName].filter(Boolean).join(' / ')}</span></div>
                                )}
                                {row.purchasePrice !== null && (
                                  <div className="flex gap-2"><span className="w-16 shrink-0">Giá nhập</span><span>{formatCurrency(row.purchasePrice)}</span></div>
                                )}
                                <div className="flex gap-2"><span className="w-16 shrink-0">Người tạo</span><span>{row.userName}</span></div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {canEditTransactions && (
                                  <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => handleEditTransaction(row)}>
                                    <Pencil size={13} /> Sửa
                                  </Button>
                                )}
                                <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => handleViewProductDetail(row)}>
                                  <Eye size={13} /> Chi tiết
                                </Button>
                                {row.imageUrls?.length > 0 && (
                                  <Button type="button" variant="outline" size="sm" className="h-8 border-violet-200 text-violet-700" onClick={() => setTxImageView({ urls: row.imageUrls, index: 0 })}>
                                    <ImageIcon size={13} /> Ảnh ({row.imageUrls.length})
                                  </Button>
                                )}
                                {row.kind !== 'ADJUSTMENT' && row.kind !== 'TRANSFER' && (
                                  <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => handlePrintTransactionReceipt(row)}>
                                    <Printer size={13} /> In
                                  </Button>
                                )}
                                {canDeleteTransactions && (
                                  <Button type="button" variant="outline" size="sm" className="h-8 border-rose-200 text-rose-600 hover:bg-rose-50"
                                    onClick={async () => {
                                      const prevSel = selectedTransactionIds;
                                      setSelectedTransactionIds([row.id]);
                                      if (window.confirm('Xóa giao dịch này?')) {
                                        try {
                                          await api.delete('/inventory/transactions', { data: { transactionIds: [row.id] } });
                                          await fetchTransactions();
                                          await fetchMetadata();
                                          if (activeTab === 'REPORT') await fetchReport();
                                        } catch (err: any) {
                                          alert(err.response?.data?.message || 'Không thể xóa giao dịch');
                                        }
                                      }
                                      setSelectedTransactionIds(prevSel);
                                    }}
                                  >
                                    <Trash2 size={13} /> Xóa
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pagination */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span>Hiển thị</span>
                    <select
                      className="form-select page-size-select h-9 w-20 text-sm"
                      value={txPageSize}
                      onChange={(e) => { setTxPageSize(Number(e.target.value)); setTxPage(1); }}
                    >
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                    </select>
                    <span>/ trang • Tổng {txTotal} giao dịch</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" disabled={txPage <= 1} onClick={() => fetchTransactions(txPage - 1)}>
                      Trước
                    </Button>
                    <span className="px-3 text-sm font-medium text-slate-700">
                      Trang {txPage} / {Math.ceil(txTotal / txPageSize) || 1}
                    </span>
                    <Button variant="outline" size="sm" disabled={txPage >= Math.ceil(txTotal / txPageSize)} onClick={() => fetchTransactions(txPage + 1)}>
                      Sau
                    </Button>
                  </div>
                </div>
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

          <div className="grid gap-4 sm:grid-cols-2">
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

      <TransactionExportDialog
        open={transactionExportOpen}
        onOpenChange={setTransactionExportOpen}
        title="Xuất Excel Transaction"
        onExportAll={() => exportTransactionRows(false)}
        onExportFiltered={() => exportTransactionRows(true)}
        isExporting={transactionExporting}
      />

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
                  {getTransactionAttributeLabel(selectedTransaction) || selectedTransaction.productName || selectedTransaction.categoryName}
                </div>
                {selectedTransaction.sku && (
                  <div className="mt-1 text-sm font-mono text-indigo-600">{selectedTransaction.sku}</div>
                )}
                <div className="mt-1 text-sm text-slate-500">Danh mục: {selectedTransaction.categoryName}</div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-medium text-slate-500">Phân loại</div>
                  <div className="text-[16px] font-semibold text-slate-950">{selectedTransaction.classificationName || '-'}</div>
                </div>
                <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-medium text-slate-500">Màu sắc</div>
                  <div className="text-[16px] font-semibold text-slate-950">{selectedTransaction.colorName || '-'}</div>
                </div>
                <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-medium text-slate-500">Kích thước</div>
                  <div className="text-[16px] font-semibold text-slate-950">{selectedTransaction.sizeName || '-'}</div>
                </div>
                <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-medium text-slate-500">Chất liệu</div>
                  <div className="text-[16px] font-semibold text-slate-950">{selectedTransaction.materialName || '-'}</div>
                </div>
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
                  <div className="text-sm font-medium text-slate-500">Tình trạng hàng</div>
                  <div className="text-[16px] font-semibold text-slate-950">{selectedTransaction.productConditionName || '-'}</div>
                </div>
                <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-medium text-slate-500">Vị trí kho</div>
                  <div className="text-[16px] font-semibold text-slate-950">{selectedTransaction.positionLabel || '-'}</div>
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="text-sm font-medium text-slate-500">Danh mục hiện tại</div>
                  <div className="text-[17px] font-semibold text-slate-950">{selectedTransaction.categoryName}</div>
                </div>
                <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="text-sm font-medium text-slate-500">Thùng / Khu vực hiện tại</div>
                  <div className="text-[17px] font-semibold text-slate-950">{selectedTransferCurrentZone?.name || selectedTransaction.storageZoneName || '-'}</div>
                  <div className="text-sm text-slate-500">Tồn hiện tại: {formatNumber(selectedTransferCurrentZone?.currentStock || 0)}</div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Thùng / Khu vực chuyển đến</Label>
                  <SearchableSelect
                    options={storageZones
                      .filter((zone) => zone.id !== transferForm.currentPositionId)
                      .map((zone) => ({ value: zone.id, label: zone.name }))}
                    value={transferForm.targetPositionId}
                    onChange={(v) => setTransferForm((prev) => ({ ...prev, targetPositionId: v }))}
                    placeholder="Chọn thùng / khu vực chuyển đến"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Số lượng chuyển</Label>
                  <Input
                    type="number"
                    min={1}
                    max={selectedTransferCurrentZone?.currentStock || 1}
                    value={transferForm.quantity}
                    onChange={(e) =>
                      setTransferForm((prev) => ({
                        ...prev,
                        quantity: Math.min(
                          Math.max(Number(e.target.value) || 1, 1),
                          Math.max(selectedTransferCurrentZone?.currentStock || 1, 1),
                        ),
                      }))
                    }
                  />
                  <p className="text-xs text-slate-500">
                    Chỉ được chuyển tối đa {formatNumber(selectedTransferCurrentZone?.currentStock || 0)} sản phẩm từ khu vực hiện tại.
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

      {/* Edit Transaction Dialog */}
      <Dialog open={editTransactionOpen} onOpenChange={(open) => {
        setEditTransactionOpen(open);
        if (!open) {
          setEditTransactionSearch('');
          setEditTransactionSearchResults([]);
          setEditTransactionSearchOpen(false);
          setEditTransactionSelectedProduct('');
          setEditExistingImageUrls([]);
          setEditReceiptImages([]);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil size={18} />
              Sửa giao dịch
            </DialogTitle>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-4">
              {(() => {
                const editAttributeLabel = getEditAttributeLabel(editTransactionForm);

                return (
                  <>
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

              <div className="space-y-2 relative">
                <Label>Sản phẩm / SKU</Label>
                <Input
                  type="text"
                  placeholder="Tìm lại sản phẩm để đổi màu, size, chất liệu..."
                  value={editTransactionSearch}
                  onChange={(e) => {
                    setEditTransactionSearch(e.target.value);
                    searchSkuCombos(e.target.value, 'edit');
                  }}
                  onFocus={() => { if (editTransactionSearchResults.length > 0) setEditTransactionSearchOpen(true); }}
                />
                {editTransactionSelectedProduct && (
                  <div className="mt-1 flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
                    <span>{editTransactionSelectedProduct}</span>
                    <button
                      type="button"
                      className="ml-2 text-indigo-400 hover:text-indigo-700"
                      onClick={() => {
                        setEditTransactionSelectedProduct('');
                        setEditTransactionForm((prev) => ({
                          ...prev,
                          skuComboId: '',
                          categoryId: selectedTransaction.categoryId || '',
                          classificationId: '',
                          colorId: '',
                          sizeId: '',
                          materialId: '',
                        }));
                        setEditTransactionSearch('');
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
                {editTransactionSearchOpen && editTransactionSearchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    {editTransactionSearchResults
                      .filter((combo) => !selectedTransaction.categoryId || combo.categoryId === selectedTransaction.categoryId)
                      .map((combo) => {
                        const productLabel = getSkuComboLabel(combo);
                        return (
                          <button
                            key={combo.id}
                            type="button"
                            className="w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 last:border-b-0"
                            onClick={() => {
                              setEditTransactionForm((prev) => ({
                                ...prev,
                                skuComboId: combo.id,
                                categoryId: combo.categoryId || prev.categoryId,
                                classificationId: combo.classification?.id || '',
                                colorId: combo.color?.id || '',
                                sizeId: combo.size?.id || '',
                                materialId: combo.material?.id || '',
                              }));
                              setEditTransactionSelectedProduct(productLabel + (combo.categoryName ? ` (${combo.categoryName})` : ''));
                              setEditTransactionSearch('');
                              setEditTransactionSearchOpen(false);
                              setEditTransactionSearchResults([]);
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
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Phân loại</Label>
                  <SearchableSelect
                    options={classifications.map((item) => ({ value: item.id, label: item.name }))}
                    value={editTransactionForm.classificationId}
                    onChange={(v) => setEditTransactionForm((prev) => ({ ...prev, classificationId: v, skuComboId: '' }))}
                    placeholder="Chọn phân loại"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Màu sắc</Label>
                  <SearchableSelect
                    options={colors.map((item) => ({ value: item.id, label: item.name }))}
                    value={editTransactionForm.colorId}
                    onChange={(v) => setEditTransactionForm((prev) => ({ ...prev, colorId: v, skuComboId: '' }))}
                    placeholder="Chọn màu sắc"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kích thước</Label>
                  <SearchableSelect
                    options={sizes.map((item) => ({ value: item.id, label: item.name }))}
                    value={editTransactionForm.sizeId}
                    onChange={(v) => setEditTransactionForm((prev) => ({ ...prev, sizeId: v, skuComboId: '' }))}
                    placeholder="Chọn kích thước"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Chất liệu</Label>
                  <SearchableSelect
                    options={materials.map((item) => ({ value: item.id, label: item.name }))}
                    value={editTransactionForm.materialId}
                    onChange={(v) => setEditTransactionForm((prev) => ({ ...prev, materialId: v, skuComboId: '' }))}
                    placeholder="Chọn chất liệu"
                  />
                </div>
              </div>

              {(editAttributeLabel || editTransactionSelectedProduct) && (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.05em] text-indigo-500">Biến thể đang chọn</div>
                  <div className="mt-1 text-sm font-medium text-indigo-950">
                    {editAttributeLabel || editTransactionSelectedProduct}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Số lượng</Label>
                <Input
                  type="number"
                  min={1}
                  value={editTransactionForm.quantity}
                  onChange={(e) => setEditTransactionForm((prev) => ({ ...prev, quantity: Number(e.target.value) || 0 }))}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tình trạng hàng{selectedTransaction.kind === 'STOCK_IN' && <span className="ml-0.5 text-red-500">*</span>}</Label>
                  <SearchableSelect
                    options={productConditions.map((item) => ({ value: item.id, label: item.name }))}
                    value={editTransactionForm.productConditionId}
                    onChange={(v) => setEditTransactionForm((prev) => ({ ...prev, productConditionId: v }))}
                    placeholder="Chọn tình trạng"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Loại kho{selectedTransaction.kind === 'STOCK_IN' && <span className="ml-0.5 text-red-500">*</span>}</Label>
                  <SearchableSelect
                    options={warehouseTypes.map((item) => ({ value: item.id, label: item.name }))}
                    value={editTransactionForm.warehouseTypeId}
                    onChange={(v) => setEditTransactionForm((prev) => ({
                      ...prev,
                      warehouseTypeId: v,
                      storageZoneId: '',
                      warehousePositionId: '',
                    }))}
                    placeholder={selectedTransaction.warehouseTypeName || 'Chọn loại kho'}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Thùng / Khu vực{selectedTransaction.kind === 'STOCK_IN' && <span className="ml-0.5 text-red-500">*</span>}</Label>
                  <SearchableSelect
                    options={getZonesForWarehouseType(editTransactionForm.warehouseTypeId)
                      .map((zone) => {
                        const conflictTypeName = getZoneConflictName(zone, editTransactionForm.warehouseTypeId);
                        if (conflictTypeName) {
                          return {
                            value: zone.id,
                            label: `${zone.name} (Đang ở ${conflictTypeName} · Không thể chọn)`,
                            disabled: true,
                          };
                        }
                        const assignedLabel = zone.warehouseTypeId ? ` · Đã gán` : ` · Chưa gán kho`;
                        return {
                          value: zone.id,
                          label: `${zone.name} (Còn ${formatNumber(getStorageZoneRemaining(zone))}/${formatNumber(zone.maxCapacity)}${assignedLabel})`,
                        };
                      })}
                    value={editTransactionForm.storageZoneId}
                    onChange={(v) => {
                      const zone = storageZones.find((z) => z.id === v);
                      const wt = warehouseTypes.find((t) => t.id === editTransactionForm.warehouseTypeId);
                      const layout = wt ? layouts.find((l) => l.name.toLowerCase() === wt.name.toLowerCase()) : undefined;
                      const matchedPosition = layout
                        ? layout.positions.find((p) => p.label.toLowerCase() === (zone?.name || '').toLowerCase())
                        : positions.find((p) => p.label.toLowerCase() === (zone?.name || '').toLowerCase());
                      setEditTransactionForm((prev) => ({
                        ...prev,
                        storageZoneId: v,
                        warehousePositionId: matchedPosition?.id || '',
                      }));
                    }}
                    placeholder="Chọn khu vực"
                  />
                  {(() => {
                    const selZone = storageZones.find((z) => z.id === editTransactionForm.storageZoneId);
                    const conflict = selZone ? getZoneConflictName(selZone, editTransactionForm.warehouseTypeId) : null;
                    if (!conflict) return null;
                    return (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        Thùng &ldquo;{selZone?.name}&rdquo; đang được gán vào loại kho &ldquo;{conflict}&rdquo;. Vui lòng chọn thùng khác.
                      </div>
                    );
                  })()}
                </div>
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
                <Label>Thời gian nhập / xuất thực tế</Label>
                <Input
                  type="datetime-local"
                  value={editTransactionForm.actualStockDate}
                  onChange={(e) => setEditTransactionForm((prev) => ({ ...prev, actualStockDate: e.target.value }))}
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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    Ảnh chứng từ
                    {(editExistingImageUrls.length + editReceiptImages.length) > 0 && (
                      <span className="ml-1.5 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                        {editExistingImageUrls.length + editReceiptImages.length}/{MAX_RECEIPT_IMAGES}
                      </span>
                    )}
                  </Label>
                  {(editExistingImageUrls.length + editReceiptImages.length) < MAX_RECEIPT_IMAGES && (
                    <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
                      <Upload size={13} />
                      Thêm ảnh
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void handleEditReceiptImageSelect(e.target.files); e.target.value = ''; }} />
                    </label>
                  )}
                </div>
                {(editExistingImageUrls.length + editReceiptImages.length) === 0 ? (
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-6 text-sm text-slate-400 hover:border-violet-300 hover:text-violet-500">
                    <Upload size={24} />
                    <span className="font-medium">Nhấn để chọn ảnh</span>
                    <span className="text-xs">JPG · PNG · WEBP · Tối đa {MAX_RECEIPT_IMAGES} ảnh</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void handleEditReceiptImageSelect(e.target.files); e.target.value = ''; }} />
                  </label>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {editExistingImageUrls.map((url, idx) => (
                      <div key={`existing-${idx}`} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                        <img src={url} alt={`Ảnh ${idx + 1}`} className="h-full w-full object-cover transition-opacity group-hover:opacity-75" />
                        <button
                          type="button"
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-500"
                          onClick={() => setEditExistingImageUrls((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <X size={11} />
                        </button>
                        <div className="absolute bottom-1 left-1 rounded bg-black/50 px-1 text-[10px] text-white">{idx + 1}</div>
                      </div>
                    ))}
                    {editReceiptImages.map((img, idx) => (
                      <div key={`new-${idx}`} className="group relative aspect-square overflow-hidden rounded-xl border border-violet-200 bg-violet-50">
                        <img src={img.preview} alt={`Ảnh mới ${idx + 1}`} className="h-full w-full object-cover transition-opacity group-hover:opacity-75" />
                        <button
                          type="button"
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-500"
                          onClick={() => setEditReceiptImages((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <X size={11} />
                        </button>
                        <div className="absolute bottom-1 left-1 rounded bg-violet-600/70 px-1 text-[10px] text-white">Mới</div>
                      </div>
                    ))}
                    {(editExistingImageUrls.length + editReceiptImages.length) < MAX_RECEIPT_IMAGES && (
                      <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-violet-300 hover:text-violet-500">
                        <Upload size={18} />
                        <span className="text-xs">Thêm</span>
                        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void handleEditReceiptImageSelect(e.target.files); e.target.value = ''; }} />
                      </label>
                    )}
                  </div>
                )}
              </div>
                  </>
                );
              })()}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTransactionOpen(false)}>Hủy</Button>
            <Button
              onClick={submitEditTransaction}
              disabled={
                editTransactionForm.quantity <= 0 ||
                (selectedTransaction?.kind === 'STOCK_IN' && (
                  !editTransactionForm.productConditionId ||
                  !editTransactionForm.warehouseTypeId ||
                  !editTransactionForm.storageZoneId
                ))
              }
            >
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pick Preliminary Check Dialog */}
      <Dialog open={pickPreliminaryOpen} onOpenChange={setPickPreliminaryOpen}>
        <DialogContent className="flex max-h-[calc(100vh-1rem)] max-w-2xl flex-col overflow-hidden p-0 sm:max-h-[calc(100vh-2rem)]">
          <DialogHeader className="px-4 pb-0 pt-4 sm:px-6 sm:pt-6">
            <DialogTitle>Chọn phiếu kiểm sơ bộ để nhập kho</DialogTitle>
          </DialogHeader>
          <p className="px-4 text-sm text-slate-500 sm:px-6">Chọn phiếu kiểm sơ bộ đang chờ xử lý để bắt đầu nhập kho chi tiết.</p>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2 sm:px-6">
            <div className="space-y-2 py-2">
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
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900">{getPreliminaryCategoryLabel(check)}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {check.warehouseType?.name || '-'} • Số lượng: {formatNumber(check.quantity)}
                      </div>
                      {check.note && (
                        <div className="mt-2 flex items-start gap-1.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                          <span className="mt-0.5 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Ghi chú:</span>
                          <span className="text-sm text-slate-700 break-words">{check.note}</span>
                        </div>
                      )}
                    </div>
                    <span className="inline-flex shrink-0 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600">
                      Chờ kiểm tra
                    </span>
                  </div>
                </button>
              ))
            )}
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 z-10 border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setPickPreliminaryOpen(false)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stockInOpen} onOpenChange={(open) => {
        setStockInOpen(open);
        if (!open) {
          resetStockInModal();
        }
      }}>
        <DialogContent className="flex max-h-[calc(100vh-1rem)] max-w-5xl flex-col overflow-hidden p-0 sm:max-h-[calc(100vh-2rem)]">
          <DialogHeader className="px-4 pb-0 pt-4 sm:px-6 sm:pt-6">
            <DialogTitle className="flex items-center gap-2 pr-10">
              <PackagePlus size={18} />
              Nhập hàng vào kho theo nhiều dòng
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="space-y-4 pt-4">
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
                  const availableStorageZones = getZonesForWarehouseType(line.warehouseTypeId);
                  const selectedZoneMeta = getStorageZoneMeta(line);

                  return (
                    <div key={line.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="text-[16px] font-semibold text-slate-950">Dòng nhập {index + 1}</div>
                          <div className="text-sm text-slate-500">
                            {productName || (selectedCategory ? selectedCategory.name : 'Chưa chọn danh mục')}
                          </div>
                          {skuPreview && (
                            <div className="mt-0.5 font-mono text-xs text-indigo-600">SKU: {skuPreview}</div>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 sm:self-start"
                          onClick={() => removeStockInLine(line.id)}
                          disabled={stockInLines.length === 1}
                        >
                          <Trash2 size={15} />
                          Xóa dòng
                        </Button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                            options={availableStorageZones.map((zone) => {
                              const conflictTypeName = getZoneConflictName(zone, line.warehouseTypeId);
                              if (conflictTypeName) {
                                return {
                                  value: zone.id,
                                  label: `${zone.name} (Đang ở ${conflictTypeName} · Không thể chọn)`,
                                  disabled: true,
                                };
                              }
                              const reservedQuantity = getReservedQuantityForZone(zone.id, line.id);
                              const remaining = getStorageZoneRemaining(zone, reservedQuantity);
                              const assignedLabel = zone.warehouseTypeId ? ` · Đã gán` : ` · Chưa gán kho`;
                              return {
                                value: zone.id,
                                label: `${zone.name} (Còn ${formatNumber(remaining)}/${formatNumber(zone.maxCapacity)}${assignedLabel})`,
                              };
                            })}
                            value={line.storageZoneId}
                            onChange={(v) => updateStockInLine(line.id, { storageZoneId: v })}
                            placeholder="Chọn khu vực"
                          />
                          {(() => {
                            const selectedZone = storageZones.find((z) => z.id === line.storageZoneId);
                            const conflictName = selectedZone ? getZoneConflictName(selectedZone, line.warehouseTypeId) : null;
                            if (conflictName) {
                              return (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                                  Thùng &ldquo;{selectedZone?.name}&rdquo; đang được gán vào loại kho &ldquo;{conflictName}&rdquo;. Vui lòng chọn thùng khác.
                                </div>
                              );
                            }
                            if (selectedZoneMeta) {
                              return (
                                <div className={`rounded-xl border px-3 py-2 text-xs ${selectedZoneMeta.isExceeded ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                                  Sức chứa còn lại {selectedZoneMeta.zone.name}: {formatNumber(selectedZoneMeta.remaining)}/{formatNumber(selectedZoneMeta.zone.maxCapacity)}
                                  {selectedZoneMeta.reservedQuantity > 0 && ` • Đã tạm giữ ${formatNumber(selectedZoneMeta.reservedQuantity)} ở dòng khác`}
                                  {selectedZoneMeta.isExceeded && ` • Dòng này chỉ nên nhập tối đa ${formatNumber(selectedZoneMeta.remaining)}`}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>

                        <div className="space-y-2">
                          <Label>Giá nhập *</Label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={line.purchasePrice !== null ? formatNumber(line.purchasePrice) : ''}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, '');
                              updateStockInLine(line.id, { purchasePrice: raw === '' ? null : Number(raw) });
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

              {/* Receipt-level image upload */}
              <div
                className={`rounded-2xl border-2 bg-white p-4 transition-colors ${receiptDropActive ? 'border-violet-400 bg-violet-50' : 'border-slate-200'}`}
                onDragOver={(e) => { e.preventDefault(); setReceiptDropActive(true); }}
                onDragLeave={() => setReceiptDropActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setReceiptDropActive(false);
                  void handleReceiptImageSelect(e.dataTransfer.files);
                }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon size={15} className="text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">Ảnh chứng từ phiếu nhập</span>
                    {receiptImages.length > 0 && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                        {receiptImages.length}/{MAX_RECEIPT_IMAGES}
                      </span>
                    )}
                  </div>
                  {receiptImages.length < MAX_RECEIPT_IMAGES && (
                    <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
                      <Upload size={13} />
                      Thêm ảnh
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => { void handleReceiptImageSelect(e.target.files); e.target.value = ''; }}
                      />
                    </label>
                  )}
                </div>

                {receiptImages.length === 0 ? (
                  <label className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 text-sm transition-colors ${receiptDropActive ? 'border-violet-400 text-violet-500' : 'border-slate-200 text-slate-400 hover:border-violet-300 hover:text-violet-500'}`}>
                    <Upload size={28} />
                    <span className="font-medium">Kéo thả ảnh vào đây hoặc nhấn để chọn</span>
                    <span className="text-xs">JPG · PNG · WEBP · Tối đa {MAX_RECEIPT_IMAGES} ảnh · Tự động nén</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => { void handleReceiptImageSelect(e.target.files); e.target.value = ''; }}
                    />
                  </label>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                      {receiptImages.map((img, idx) => (
                        <div key={idx} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                          <img
                            src={img.preview}
                            alt={`Ảnh ${idx + 1}`}
                            className="h-full w-full cursor-pointer object-cover transition-opacity group-hover:opacity-75"
                            onClick={() => setReceiptImageViewIndex(idx)}
                          />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                            <Eye size={18} className="text-white drop-shadow" />
                          </div>
                          <button
                            type="button"
                            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-500"
                            onClick={(e) => { e.stopPropagation(); removeReceiptImage(idx); }}
                          >
                            <X size={11} />
                          </button>
                          <div className="absolute bottom-1 left-1 rounded bg-black/50 px-1 text-[10px] text-white">
                            {idx + 1}
                          </div>
                        </div>
                      ))}
                      {receiptImages.length < MAX_RECEIPT_IMAGES && (
                        <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-violet-300 hover:text-violet-500">
                          <Upload size={18} />
                          <span className="text-xs">Thêm</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => { void handleReceiptImageSelect(e.target.files); e.target.value = ''; }}
                          />
                        </label>
                      )}
                    </div>
                    <p className="text-center text-[11px] text-slate-400">
                      Kéo thả thêm ảnh vào đây · Ảnh tự động được nén còn tối đa 500 KB
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 z-10 border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={addStockInLine} disabled={isStockInSubmitting}>
              <Plus size={15} />
              Thêm dòng
            </Button>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setStockInOpen(false)} disabled={isStockInSubmitting}>
              Hủy
            </Button>
            <Button className="w-full sm:w-auto" onClick={submitStockIn} disabled={stockInLines.length === 0 || isStockInSubmitting}>
              {isStockInSubmitting ? 'Đang xử lý...' : stockInLines.length > 1 ? 'Xác nhận nhập nhiều dòng' : 'Xác nhận nhập hàng'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox xem ảnh giao dịch đã lưu */}
      <Dialog open={txImageView !== null} onOpenChange={(open) => { if (!open) setTxImageView(null); }}>
        <DialogContent className="max-w-3xl bg-black/90 p-0 border-0">
          <div className="relative flex items-center justify-center min-h-[60vh]">
            {txImageView && (
              <img
                src={txImageView.urls[txImageView.index]}
                alt={`Ảnh ${txImageView.index + 1}`}
                className="max-h-[80vh] max-w-full rounded object-contain"
              />
            )}
            {txImageView && txImageView.urls.length > 1 && (
              <>
                <button
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white hover:bg-white/40 text-lg"
                  onClick={() => setTxImageView((v) => v ? { ...v, index: (v.index - 1 + v.urls.length) % v.urls.length } : null)}
                >
                  ‹
                </button>
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white hover:bg-white/40 text-lg"
                  onClick={() => setTxImageView((v) => v ? { ...v, index: (v.index + 1) % v.urls.length } : null)}
                >
                  ›
                </button>
              </>
            )}
            {txImageView && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
                {txImageView.index + 1} / {txImageView.urls.length}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox xem ảnh phiếu nhập */}
      <Dialog open={receiptImageViewIndex !== null} onOpenChange={(open) => { if (!open) setReceiptImageViewIndex(null); }}>
        <DialogContent className="max-w-3xl bg-black/90 p-0 border-0">
          <div className="relative flex items-center justify-center min-h-[60vh]">
            {receiptImageViewIndex !== null && receiptImages[receiptImageViewIndex] && (
              <img
                src={receiptImages[receiptImageViewIndex].preview}
                alt={`Ảnh ${receiptImageViewIndex + 1}`}
                className="max-h-[80vh] max-w-full rounded object-contain"
              />
            )}
            {receiptImageViewIndex !== null && receiptImages.length > 1 && (
              <>
                <button
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white hover:bg-white/40"
                  onClick={() => setReceiptImageViewIndex((i) => i !== null ? (i - 1 + receiptImages.length) % receiptImages.length : 0)}
                >
                  ‹
                </button>
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white hover:bg-white/40"
                  onClick={() => setReceiptImageViewIndex((i) => i !== null ? (i + 1) % receiptImages.length : 0)}
                >
                  ›
                </button>
              </>
            )}
            {receiptImageViewIndex !== null && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
                {receiptImageViewIndex + 1} / {receiptImages.length}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={stockOutOpen} onOpenChange={(open) => {
        setStockOutOpen(open);
        if (!open) {
          setStockOutLines([createStockOutLine()]);
          setStockOutSearchLineId(null);
          setStockOutSearchResults([]);
          setStockOutSearchOpen(false);
          setStockOutZonesByLine({});
        }
      }}>
        <DialogContent className="flex max-h-[calc(100vh-1rem)] max-w-5xl flex-col overflow-hidden p-0 sm:max-h-[calc(100vh-2rem)]">
          <DialogHeader className="px-4 pb-0 pt-4 sm:px-6 sm:pt-6">
            <DialogTitle>Xuất hàng khỏi kho theo nhiều dòng</DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="space-y-4 pt-4">
              <div className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 md:grid-cols-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">Số dòng</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{stockOutLines.length} dòng xuất kho</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">Tổng số lượng</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {formatNumber(stockOutLines.reduce((sum, line) => sum + Number(line.quantity || 0), 0))}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">Cách gửi</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{stockOutLines.length > 1 ? 'Batch stock-out' : 'Single stock-out'}</p>
                </div>
              </div>

              <div className="space-y-4">
                {stockOutLines.map((line, index) => {
                  return (
                    <div key={line.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[16px] font-semibold text-slate-950">Dòng xuất {index + 1}</div>
                          <div className="text-sm text-slate-500">
                            {line.selectedProduct || 'Chưa chọn sản phẩm'}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50"
                          onClick={() => removeStockOutLine(line.id)}
                          disabled={stockOutLines.length === 1}
                        >
                          <Trash2 size={15} />
                          Xóa dòng
                        </Button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2 relative">
                          <Label>Tìm sản phẩm *</Label>
                          <Input
                            type="text"
                            placeholder="Gõ tên sản phẩm, phân loại, màu sắc, kích thước..."
                            value={line.search}
                            onChange={(e) => {
                              updateStockOutLine(line.id, { search: e.target.value });
                              setStockOutSearchLineId(line.id);
                              searchSkuCombos(e.target.value);
                            }}
                            onFocus={() => {
                              setStockOutSearchLineId(line.id);
                              if (stockOutSearchResults.length > 0) setStockOutSearchOpen(true);
                            }}
                          />
                          {line.selectedProduct && (
                            <div className="mt-1 flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
                              <span>{line.selectedProduct}</span>
                              <button
                                type="button"
                                className="ml-2 text-indigo-400 hover:text-indigo-700"
                                onClick={() => {
                                  updateStockOutLine(line.id, {
                                    selectedProduct: '',
                                    skuComboId: '',
                                    categoryId: '',
                                    storageZoneId: '',
                                    search: '',
                                  });
                                  setStockOutZonesByLine((prev) => {
                                    const next = { ...prev };
                                    delete next[line.id];
                                    return next;
                                  });
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          )}
                          {stockOutSearchLineId === line.id && stockOutSearchOpen && stockOutSearchResults.length > 0 && (
                            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                              {stockOutSearchResults.map((combo) => {
                                const productLabel = [combo.classification?.name, combo.color?.name, combo.size?.name, combo.material?.name].filter(Boolean).join(' - ');
                                return (
                                  <button
                                    key={combo.id}
                                    type="button"
                                    className="w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 last:border-b-0"
                                    onClick={() => {
                                      updateStockOutLine(line.id, {
                                        skuComboId: combo.id,
                                        categoryId: combo.categoryId || '',
                                        selectedProduct: productLabel + (combo.categoryName ? ` (${combo.categoryName})` : ''),
                                        search: '',
                                        storageZoneId: '',
                                      });
                                      setStockOutSearchOpen(false);
                                      setStockOutSearchResults([]);
                                      fetchStockOutZonesForLine(line.id, combo.id);
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
                          {stockOutSearchLineId === line.id && stockOutSearchOpen && line.search.length >= 1 && stockOutSearchResults.length === 0 && (
                            <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-lg">
                              Không tìm thấy sản phẩm nào
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Thùng / Khu vực xuất</Label>
                          {(() => {
                            const availableZones = stockOutZonesByLine[line.id] || [];
                            const selectedZoneStock = availableZones.find((z) => z.storageZoneId === line.storageZoneId);
                            return (
                              <>
                                <SearchableSelect
                                  options={
                                    line.skuComboId
                                      ? availableZones.map((z) => ({
                                          value: z.storageZoneId,
                                          label: `${z.storageZoneName} (tồn: ${formatNumber(z.stock)})`,
                                        }))
                                      : storageZones.map((z) => ({ value: z.id, label: z.name }))
                                  }
                                  value={line.storageZoneId || ''}
                                  onChange={(v) => updateStockOutLine(line.id, { storageZoneId: v })}
                                  placeholder={line.skuComboId ? (availableZones.length === 0 ? 'Sản phẩm chưa có tồn kho' : 'Chọn thùng / khu vực xuất') : 'Chọn sản phẩm trước'}
                                />
                                {selectedZoneStock && line.quantity > selectedZoneStock.stock && (
                                  <p className="text-xs text-rose-500">
                                    Số lượng xuất ({formatNumber(line.quantity)}) vượt quá tồn kho tại khu vực này ({formatNumber(selectedZoneStock.stock)})
                                  </p>
                                )}
                              </>
                            );
                          })()}
                        </div>

                        <div className="space-y-2">
                          <Label>Số lượng xuất</Label>
                          <Input type="number" min={1} value={line.quantity} onChange={(e) => updateStockOutLine(line.id, { quantity: Number(e.target.value) || 0 })} />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label>Ghi chú</Label>
                          <textarea className="form-control min-h-[96px] py-3" value={line.notes} onChange={(e) => updateStockOutLine(line.id, { notes: e.target.value })} placeholder="Nhập ghi chú xuất hàng" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 z-10 border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={addStockOutLine}>
              <Plus size={15} />
              Thêm dòng
            </Button>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setStockOutOpen(false)}>
              Hủy
            </Button>
            <Button className="w-full sm:w-auto" onClick={submitStockOut} disabled={stockOutLines.some((line) => !line.skuComboId || !line.categoryId || !line.quantity || !line.storageZoneId)}>
              {stockOutLines.length > 1 ? 'Xác nhận xuất nhiều dòng' : 'Xác nhận xuất hàng'}
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">Thùng / Khu vực</p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {selectedAdjustmentZone ? `${selectedAdjustmentZone.name} - Sức chứa: ${formatNumber(selectedAdjustmentZone.currentStock)}/${formatNumber(selectedAdjustmentZone.maxCapacity)}` : 'Chưa chọn thùng / khu vực'}
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
                      setAdjustmentForm((prev) => ({ ...prev, categoryId: '', skuComboId: '' }));
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
                            skuComboId: combo.id,
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
                options={storageZones.map((z) => ({ value: z.id, label: z.name }))}
                value={adjustmentForm.storageZoneId}
                onChange={(v) => setAdjustmentForm((prev) => ({ ...prev, storageZoneId: v }))}
                placeholder="Chọn thùng / khu vực"
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
