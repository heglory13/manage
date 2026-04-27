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
  productId: string;
  createdAt: string;
  actualStockDate: string | null;
  kind: 'ALL' | 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT';
  type: 'STOCK_IN' | 'STOCK_OUT';
  status: 'ACTIVE' | 'SUSPENDED';
  quantity: number;
  signedQuantity: number;
  purchasePrice: number | null;
  salePrice: number | null;
  productName: string;
  productSku: string;
  positionLabel: string | null;
  userName: string;
  note: string;
};

type TransferForm = {
  productId: string;
  currentPositionId: string;
  targetPositionId: string;
  quantity: number;
};

type NxtReportApiRow = {
  skuComboId: string;
  compositeSku: string;
  productName?: string;
  classification: string;
  color: string;
  size: string;
  material: string;
  openingStock: number;
  openingValue?: number;
  totalIn: number;
  totalInValue?: number;
  totalOut: number;
  totalOutValue?: number;
  closingStock: number;
  closingValue?: number;
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
  purchasePrice: number;
  salePrice: number;
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

type BarcodePrintItem = {
  transactionId: string;
  productName: string;
  sku: string;
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
  purchasePrice: 0,
  salePrice: 0,
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

const defaultTransferForm = (): TransferForm => ({
  productId: '',
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
  const { user } = useAuth();
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
  const [productDetailOpen, setProductDetailOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [barcodeDialogOpen, setBarcodeDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionRow | null>(null);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [barcodeItems, setBarcodeItems] = useState<BarcodePrintItem[]>([]);
  const [transferForm, setTransferForm] = useState<TransferForm>(defaultTransferForm);
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
  const [generalSettings, setGeneralSettings] = useState(defaultGeneralSettings);

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
  const selectedTransferProduct = useMemo(() => products.find((product) => product.id === transferForm.productId), [products, transferForm.productId]);
  const selectedTransferCurrentPosition = useMemo(
    () => positions.find((position) => position.id === transferForm.currentPositionId),
    [positions, transferForm.currentPositionId],
  );
  const selectedStockOutPosition = useMemo(() => positions.find((position) => position.id === stockOutForm.warehousePositionId), [positions, stockOutForm.warehousePositionId]);
  const selectedAdjustmentPosition = useMemo(
    () => positions.find((position) => position.id === adjustmentForm.warehousePositionId),
    [positions, adjustmentForm.warehousePositionId]
  );
  const pendingPreliminaryChecks = useMemo(
    () => preliminaryChecks.filter((item) => item.status === 'PENDING'),
    [preliminaryChecks]
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

  useEffect(() => {
    if (!selectedStockInProduct) return;
    setStockInForm((prev) => ({
      ...prev,
      salePrice:
        prev.productId === selectedStockInProduct.id && prev.salePrice > 0
          ? prev.salePrice
          : selectedStockInProduct.price ?? 0,
    }));
  }, [selectedStockInProduct]);

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

  const submitPreliminaryCheck = async (keepOpen = false) => {
    try {
      const payload: Record<string, unknown> = {
        classificationId: preliminaryForm.classificationId,
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
        purchasePrice: Number(stockInForm.purchasePrice),
        salePrice: Number(stockInForm.salePrice),
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

        return {
          sku: row.compositeSku,
          productName: matchedProduct?.name || `${row.classification} ${row.material}`.trim(),
          unit: 'Cái',
          openingQty: row.openingStock,
          openingValue: (row as any).openingValue ?? 0,
          inQty: row.totalIn,
          inValue: (row as any).totalInValue ?? 0,
          outQty: row.totalOut,
          outValue: (row as any).totalOutValue ?? 0,
          closingQty: row.closingStock,
          closingValue: (row as any).closingValue ?? 0,
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
        productName: row.productName,
        sku: row.productSku,
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

  const handleOpenTransfer = (row: TransactionRow) => {
    const product = products.find((item) => item.sku === row.productSku);
    const currentPosition = positions.find((item) => item.label === row.positionLabel);

    if (!product) {
      alert('Không tìm thấy sản phẩm tương ứng để chuyển vị trí.');
      return;
    }

    if (!currentPosition) {
      alert('Không tìm thấy vị trí hiện tại của sản phẩm.');
      return;
    }

    setSelectedTransaction(row);
    setTransferForm({
      productId: product.id,
      currentPositionId: currentPosition.id,
      targetPositionId: '',
      quantity: 1,
    });
    setTransferOpen(true);
  };

  const handleSubmitTransfer = async () => {
    if (!selectedTransaction) return;

    try {
      await api.post('/inventory/stock-out', {
        productId: transferForm.productId,
        warehousePositionId: transferForm.currentPositionId,
        quantity: Number(transferForm.quantity),
        notes: `Chuyển vị trí từ ${selectedTransferCurrentPosition?.label || selectedTransaction.positionLabel || '-'} sang ${
          positions.find((position) => position.id === transferForm.targetPositionId)?.label || '-'
        }`,
      });

      await api.post('/inventory/stock-in', {
        productId: transferForm.productId,
        purchasePrice:
          selectedTransaction.purchasePrice ??
          products.find((item) => item.id === transferForm.productId)?.price ??
          1,
        salePrice:
          selectedTransaction.salePrice ??
          products.find((item) => item.id === transferForm.productId)?.price ??
          1,
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
      alert(err.response?.data?.message || 'Không thể chuyển vị trí sản phẩm');
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
            <Button variant="outline" className="h-11 rounded-2xl border-emerald-200 px-5 text-emerald-700 hover:bg-emerald-50" onClick={() => setActiveTab('STOCK_IN')}>
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
                      <TableHead>Sản phẩm</TableHead>
                      <TableHead>Vị trí</TableHead>
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
                    {rows.map((row) => {
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
                            <div className="text-[17px] font-semibold leading-6 text-slate-900">{row.productName}</div>
                            <div className="text-sm text-slate-500">{row.productSku}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-[15px] text-slate-600">
                              <MapPin size={15} className="text-slate-400" />
                              <span>{row.positionLabel || '-'}</span>
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
                              <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={() => handleViewProductDetail(row)}>
                                <Eye size={15} />
                              </Button>
                              {row.type === 'STOCK_IN' && (
                                <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={() => openBarcodeDialog([row])}>
                                  <Printer size={15} />
                                </Button>
                              )}
                              {row.positionLabel && row.status === 'ACTIVE' && (
                                <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={() => handleOpenTransfer(row)}>
                                  <MapPin size={15} />
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
            <Button
              variant="outline"
              onClick={() => submitPreliminaryCheck(true)}
              disabled={!preliminaryForm.classificationId || !preliminaryForm.quantity || !preliminaryForm.warehouseTypeId}
            >
              Thêm dòng
            </Button>
            <Button onClick={() => submitPreliminaryCheck(false)} disabled={!preliminaryForm.classificationId || !preliminaryForm.quantity || !preliminaryForm.warehouseTypeId}>
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
              Chi tiết sản phẩm
            </DialogTitle>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="text-[20px] font-semibold text-slate-950">{selectedTransaction.productName}</div>
                <div className="mt-1 text-sm text-slate-500">{selectedTransaction.productSku}</div>
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
                  <div className="text-sm font-medium text-slate-500">Vị trí hiện tại</div>
                  <div className="text-[16px] font-semibold text-slate-950">{selectedTransaction.positionLabel || '-'}</div>
                </div>
                <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-medium text-slate-500">Số lượng</div>
                  <div className={`text-[18px] font-semibold ${selectedTransaction.signedQuantity >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {selectedTransaction.signedQuantity >= 0 ? '+' : ''}
                    {formatNumber(selectedTransaction.signedQuantity)}
                  </div>
                </div>
                <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-medium text-slate-500">Người tạo</div>
                  <div className="text-[16px] font-semibold text-slate-950">{selectedTransaction.userName}</div>
                </div>
                <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-medium text-slate-500">Thời gian tạo phiếu</div>
                  <div className="text-[16px] font-semibold text-slate-950">{formatDateTime(selectedTransaction.createdAt)}</div>
                </div>
                <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-medium text-slate-500">Thời gian nhập kho</div>
                  <div className="text-[16px] font-semibold text-slate-950">{formatDateOnly(selectedTransaction.actualStockDate)}</div>
                </div>
                <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-medium text-slate-500">Giá nhập</div>
                  <div className="text-[16px] font-semibold text-slate-950">
                    {selectedTransaction.purchasePrice !== null ? formatCurrency(selectedTransaction.purchasePrice) : '-'}
                  </div>
                </div>
                <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-medium text-slate-500">Giá bán</div>
                  <div className="text-[16px] font-semibold text-slate-950">
                    {selectedTransaction.salePrice !== null ? formatCurrency(selectedTransaction.salePrice) : '-'}
                  </div>
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
              Chuyển vị trí sản phẩm
            </DialogTitle>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="text-sm font-medium text-slate-500">Sản phẩm hiện tại</div>
                  <div className="text-[17px] font-semibold text-slate-950">{selectedTransaction.productName}</div>
                  <div className="text-sm text-slate-500">{selectedTransaction.productSku}</div>
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
                !transferForm.productId ||
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
              In tem ma vach san pham
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {barcodeItems.map((item) => (
              <div key={item.transactionId} className="grid gap-4 rounded-2xl border border-slate-200 p-4 md:grid-cols-[1.6fr,1fr,140px]">
                <div>
                  <div className="font-semibold text-slate-900">{item.productName}</div>
                  <div className="text-sm text-slate-500">{item.sku}</div>
                  <div className="mt-1 text-sm font-medium text-slate-700">{formatCurrency(item.salePrice)}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
                  <div className="text-xs uppercase tracking-wide text-slate-400">Mau tem</div>
                  <div className="mt-2 text-sm text-slate-700">Ten SP + Ma vach SKU + Gia ban</div>
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
              <Input
                type="number"
                min={1}
                value={stockInForm.quantity}
                onChange={(e) => {
                  const nextQuantity = Number(e.target.value);
                  if (selectedPreliminaryCheck && nextQuantity !== selectedPreliminaryCheck.quantity) {
                    alert(`Số lượng chi tiết phải khớp với kiểm sơ bộ: ${selectedPreliminaryCheck.quantity}`);
                  }
                  setStockInForm((prev) => ({ ...prev, quantity: nextQuantity }));
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Giá nhập *</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={stockInForm.purchasePrice}
                onChange={(e) => setStockInForm((prev) => ({ ...prev, purchasePrice: Number(e.target.value) }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Giá bán SP *</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={stockInForm.salePrice}
                onChange={(e) => setStockInForm((prev) => ({ ...prev, salePrice: Number(e.target.value) }))}
              />
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
            <Button onClick={submitStockIn} disabled={!stockInForm.productId || !stockInForm.quantity || stockInForm.purchasePrice <= 0 || stockInForm.salePrice <= 0}>
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




