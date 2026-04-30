import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Download,
  Filter,
  MoreHorizontal,
  PackagePlus,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import AppLayout from '../components/layout/AppLayout';
import { api } from '../services/api';
import { useSavedFilters } from '../hooks/useSavedFilters';
import { formatNumber } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

type InventoryRow = {
  id: string;
  sku: string;
  name: string;
  stock: number;
  businessStatus: 'CON_HANG' | 'HET_HANG' | 'SAP_HET' | 'NGUNG_KD';
  attributes?: string;
  positionLabels?: string[];
  latestProductCondition?: { id: string; name: string } | null;
};

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  price: number;
};

type AttributeOption = {
  id: string;
  name: string;
};

type StorageZone = {
  id: string;
  name: string;
  maxCapacity: number;
  currentStock: number;
  remainingCapacity: number;
};

type PositionOption = {
  id: string;
  label: string;
  currentStock: number;
  maxCapacity: number | null;
  remainingCapacity: number | null;
};

type InventoryFilters = {
  search: string;
  categoryId: string;
  businessStatus: string;
  classificationId: string;
  materialId: string;
  colorId: string;
  sizeId: string;
  productConditionId: string;
  storageZoneId: string;
  positionId: string;
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

const defaultFilters: InventoryFilters = {
  search: '',
  categoryId: '',
  businessStatus: '',
  classificationId: '',
  materialId: '',
  colorId: '',
  sizeId: '',
  productConditionId: '',
  storageZoneId: '',
  positionId: '',
};

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

const statusLabelMap: Record<InventoryRow['businessStatus'], string> = {
  CON_HANG: 'Còn hàng',
  HET_HANG: 'Hết hàng',
  SAP_HET: 'Sắp hết',
  NGUNG_KD: 'Ngừng KD',
};

const statusColorMap: Record<InventoryRow['businessStatus'], string> = {
  CON_HANG: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
  HET_HANG: 'bg-rose-50 text-rose-600 border border-rose-200',
  SAP_HET: 'bg-amber-50 text-amber-600 border border-amber-200',
  NGUNG_KD: 'bg-slate-100 text-slate-500 border border-slate-200',
};

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

function parseAttributes(attributes?: string) {
  return attributes ? attributes.split('/').map((item) => item.trim()).filter(Boolean) : [];
}

export default function InventoryPage() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<InventoryFilters>(defaultFilters);
  const [categories, setCategories] = useState<AttributeOption[]>([]);
  const [classifications, setClassifications] = useState<AttributeOption[]>([]);
  const [materials, setMaterials] = useState<AttributeOption[]>([]);
  const [colors, setColors] = useState<AttributeOption[]>([]);
  const [sizes, setSizes] = useState<AttributeOption[]>([]);
  const [productConditions, setProductConditions] = useState<AttributeOption[]>([]);
  const [storageZones, setStorageZones] = useState<StorageZone[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [showSaveFilter, setShowSaveFilter] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [stockInOpen, setStockInOpen] = useState(false);
  const [stockOutOpen, setStockOutOpen] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [stockInForm, setStockInForm] = useState<StockInForm>(defaultStockInForm);
  const [stockOutForm, setStockOutForm] = useState<StockOutForm>(defaultStockOutForm);
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentForm>(defaultAdjustmentForm);
  const [stockInSkuComboId, setStockInSkuComboId] = useState('');

  const { savedFilters, activeFilterId, applyFilter, clearFilters, saveFilter, deleteFilter, updateFilter } = useSavedFilters({
    pageKey: 'inventory-v2',
    onFiltersChange: (nextFilters) => {
      setFilters({
        search: String(nextFilters.search ?? ''),
        categoryId: String(nextFilters.categoryId ?? ''),
        businessStatus: String(nextFilters.businessStatus ?? ''),
        classificationId: String(nextFilters.classificationId ?? ''),
        materialId: String(nextFilters.materialId ?? ''),
        colorId: String(nextFilters.colorId ?? ''),
        sizeId: String(nextFilters.sizeId ?? ''),
        productConditionId: String(nextFilters.productConditionId ?? ''),
        storageZoneId: String(nextFilters.storageZoneId ?? ''),
        positionId: String(nextFilters.positionId ?? ''),
      });
    },
  });

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
  const selectedStockInPosition = useMemo(
    () => positions.find((position) => position.id === stockInForm.warehousePositionId),
    [positions, stockInForm.warehousePositionId]
  );
  const selectedStockInZone = useMemo(
    () => storageZones.find((zone) => zone.id === stockInForm.storageZoneId),
    [storageZones, stockInForm.storageZoneId]
  );

  const stockInMaxAllowed = useMemo(() => {
    const positionRemaining = selectedStockInPosition?.remainingCapacity;
    const zoneRemaining = selectedStockInZone?.remainingCapacity;

    const candidates = [positionRemaining, zoneRemaining].filter((value): value is number => value !== null && value !== undefined);
    return candidates.length > 0 ? Math.max(0, Math.min(...candidates)) : null;
  }, [selectedStockInPosition, selectedStockInZone]);

  const stockInCapacityMessage = useMemo(() => {
    if (stockInMaxAllowed === null) return null;
    if (stockInMaxAllowed <= 0) return 'Vị trí/khu vực đã đầy, không thể nhập thêm.';
    return `Chỉ cho phép nhập tối đa ${formatNumber(stockInMaxAllowed)} sản phẩm vào vị trí hiện tại.`;
  }, [stockInMaxAllowed]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const fetchInventory = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/inventory/v2', { params: filters });
      setRows(res.data.data || []);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const fetchMetadata = useCallback(async () => {
    try {
      const [declarationRes, productRes, layoutRes] = await Promise.all([
        api.get('/input-declarations/all'),
        api.get('/products', { params: { limit: 1000 } }),
        api.get('/warehouse/layout'),
      ]);

      const declarationData = declarationRes.data;
      setCategories(declarationData.categories || []);
      setClassifications(declarationData.classifications || []);
      setMaterials(declarationData.materials || []);
      setColors(declarationData.colors || []);
      setSizes(declarationData.sizes || []);
      setProductConditions(declarationData.productConditions || []);
      setStorageZones(
        (declarationData.storageZones || []).map((zone: any) => ({
          id: zone.id,
          name: zone.name,
          maxCapacity: zone.maxCapacity,
          currentStock: zone.currentStock,
          remainingCapacity: Math.max(0, (zone.maxCapacity || 0) - (zone.currentStock || 0)),
        }))
      );
      setProducts((productRes.data.data || productRes.data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        stock: item.stock,
        price: Number(item.price || 0),
      })));
      setPositions(
        (layoutRes.data?.positions || [])
          .filter((position: any) => position.label)
          .map((position: any) => ({
            id: position.id,
            label: position.label,
            currentStock: position.currentStock,
            maxCapacity: position.maxCapacity,
            remainingCapacity: position.maxCapacity === null ? null : Math.max(0, position.maxCapacity - position.currentStock),
          }))
      );
    } catch (err) {
      console.error('Error fetching inventory metadata:', err);
    }
  }, []);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

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

  const handleFilterChange = (key: keyof InventoryFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    updateFilter(key, value);
  };

  const handleSearchSubmit = () => {
    fetchInventory();
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
    clearFilters();
    setShowFilterDialog(false);
  };

  const handleSaveCurrentFilter = async () => {
    if (!filterName.trim()) return;
    try {
      await saveFilter(filterName);
      setFilterName('');
      setShowSaveFilter(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleExportExcel = () => {
    const exportRows = rows.map((row) => ({
      'Mã SKU': row.sku,
      'Tên sản phẩm': row.name,
      'Thuộc tính': row.attributes || '-',
      'Vị trí': row.positionLabels?.join(', ') || '-',
      'Số lượng': row.stock,
      'Trạng thái': statusLabelMap[row.businessStatus],
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'TonKho');
    XLSX.writeFile(workbook, `quan-ly-ton-kho-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleStockInQuantityChange = (nextValue: number) => {
    if (!Number.isFinite(nextValue) || nextValue <= 0) {
      setStockInForm((prev) => ({ ...prev, quantity: 1 }));
      return;
    }

    if (stockInMaxAllowed !== null && nextValue > stockInMaxAllowed) {
      alert(`Vị trí đang gần đầy. Chỉ cho phép nhập tối đa ${stockInMaxAllowed}.`);
      setStockInForm((prev) => ({ ...prev, quantity: Math.max(1, stockInMaxAllowed) }));
      return;
    }

    setStockInForm((prev) => ({ ...prev, quantity: nextValue }));
  };

  const submitStockIn = async () => {
    try {
      await api.post('/inventory/stock-in', {
        productId: stockInForm.productId,
        purchasePrice: Number(stockInForm.purchasePrice),
        salePrice: Number(stockInForm.salePrice),
        skuComboId: stockInSkuComboId || undefined,
        productConditionId: stockInForm.productConditionId || undefined,
        storageZoneId: stockInForm.storageZoneId || undefined,
        warehousePositionId: stockInForm.warehousePositionId || undefined,
        quantity: Number(stockInForm.quantity),
        actualStockDate: stockInForm.actualStockDate,
        notes: stockInForm.notes || undefined,
      });
      setStockInOpen(false);
      setStockInForm(defaultStockInForm());
      setStockInSkuComboId('');
      fetchInventory();
      fetchMetadata();
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
      fetchInventory();
      fetchMetadata();
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
      fetchInventory();
      fetchMetadata();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể điều chỉnh tồn kho');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[360px] flex-1 max-w-[600px]">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              className="h-11 rounded-2xl border-slate-200 bg-white pl-14 pr-4 text-base"
              placeholder="Tìm kiếm theo tên, SKU, hoặc vị trí..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearchSubmit();
              }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="h-11 rounded-xl px-4" onClick={() => setShowFilterDialog(true)}>
              <Filter size={16} />
              Bộ lọc
            </Button>
            <Button variant="outline" className="h-11 rounded-xl px-4" onClick={handleExportExcel}>
              <Download size={16} />
              Xuất file
            </Button>
            <Button className="hidden h-11 rounded-xl bg-emerald-600 px-5 hover:bg-emerald-700" onClick={() => setStockInOpen(true)}>
              <ArrowDownToLine size={16} />
              Nhập hàng
            </Button>
            <Button className="hidden h-11 rounded-xl bg-pink-600 px-5 hover:bg-pink-700" onClick={() => setStockOutOpen(true)}>
              <ArrowUpToLine size={16} />
              Xuất hàng
            </Button>
            <Button className="hidden h-11 rounded-xl bg-amber-500 px-5 hover:bg-amber-600" onClick={() => setAdjustmentOpen(true)}>
              <SlidersHorizontal size={16} />
              Điều chỉnh
            </Button>
          </div>
        </div>

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
                    <TableHead className="w-[140px] pl-4">Mã SKU</TableHead>
                    <TableHead>Tên sản phẩm</TableHead>
                    <TableHead>Thuộc tính</TableHead>
                    <TableHead className="w-[190px]">Vị trí</TableHead>
                    <TableHead className="w-[120px] text-right">Số lượng</TableHead>
                    <TableHead className="w-[150px]">Trạng thái</TableHead>
                    <TableHead className="w-[56px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const attributeItems = parseAttributes(row.attributes);
                    return (
                      <TableRow key={row.id} className="h-[72px]">
                        <TableCell className="pl-4 font-mono text-[13px] text-slate-500">{row.sku}</TableCell>
                        <TableCell>
                          <div className="text-[17px] font-semibold leading-6 text-slate-900">{row.name}</div>
                          <div className="text-sm text-slate-500">{row.latestProductCondition?.name || 'Ví da'}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {attributeItems.length > 0 ? (
                              attributeItems.map((item) => (
                                <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                                  {item}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-slate-400">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3 text-[15px] text-slate-600">
                            <span className="h-3 w-3 rounded-full bg-[#7d7df7]" />
                            <span>{row.positionLabels?.[0] || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-[18px] font-semibold text-slate-900">{formatNumber(row.stock)}</TableCell>
                        <TableCell>
                          <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${statusColorMap[row.businessStatus]}`}>
                            {statusLabelMap[row.businessStatus]}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <details className="relative inline-block">
                            <summary className="list-none rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                              <MoreHorizontal size={18} />
                            </summary>
                            <div className="absolute right-0 top-10 z-20 min-w-[180px] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                              <button
                                type="button"
                                className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                onClick={() => alert(`SKU: ${row.sku}\nTên: ${row.name}\nVị trí: ${row.positionLabels?.join(', ') || '-'}`)}
                              >
                                Xem chi tiết
                              </button>
                              <button
                                type="button"
                                className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                onClick={() => {
                                  setStockOutForm((prev) => ({ ...prev, productId: row.id }));
                                  setStockOutOpen(true);
                                }}
                              >
                                Chuyển vị trí
                              </button>
                            </div>
                          </details>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-14 text-center text-slate-500">
                        Không có dữ liệu tồn kho phù hợp.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Bộ lọc tồn kho</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Danh mục</Label>
                <select className="form-select" value={filters.categoryId} onChange={(e) => handleFilterChange('categoryId', e.target.value)}>
                  <option value="">Tất cả danh mục</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Trạng thái</Label>
                <select className="form-select" value={filters.businessStatus} onChange={(e) => handleFilterChange('businessStatus', e.target.value)}>
                  <option value="">Tất cả trạng thái</option>
                  <option value="CON_HANG">Còn hàng</option>
                  <option value="SAP_HET">Sắp hết</option>
                  <option value="HET_HANG">Hết hàng</option>
                  <option value="NGUNG_KD">Ngừng KD</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Phân loại hàng hóa</Label>
                <select className="form-select" value={filters.classificationId} onChange={(e) => handleFilterChange('classificationId', e.target.value)}>
                  <option value="">Tất cả phân loại</option>
                  {classifications.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Chất liệu</Label>
                <select className="form-select" value={filters.materialId} onChange={(e) => handleFilterChange('materialId', e.target.value)}>
                  <option value="">Tất cả chất liệu</option>
                  {materials.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Màu sắc</Label>
                <select className="form-select" value={filters.colorId} onChange={(e) => handleFilterChange('colorId', e.target.value)}>
                  <option value="">Tất cả màu sắc</option>
                  {colors.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Kích cỡ</Label>
                <select className="form-select" value={filters.sizeId} onChange={(e) => handleFilterChange('sizeId', e.target.value)}>
                  <option value="">Tất cả kích cỡ</option>
                  {sizes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tình trạng hàng</Label>
                <select className="form-select" value={filters.productConditionId} onChange={(e) => handleFilterChange('productConditionId', e.target.value)}>
                  <option value="">Tất cả tình trạng</option>
                  {productConditions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Thùng / Khu vực</Label>
                <select className="form-select" value={filters.storageZoneId} onChange={(e) => handleFilterChange('storageZoneId', e.target.value)}>
                  <option value="">Tất cả khu vực</option>
                  {storageZones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Vị trí</Label>
              <select className="form-select" value={filters.positionId} onChange={(e) => handleFilterChange('positionId', e.target.value)}>
                <option value="">Tất cả vị trí</option>
                {positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.label} {position.maxCapacity !== null ? `(còn ${position.remainingCapacity})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {savedFilters.length > 0 && (
              <div className="space-y-2">
                <Label>Lịch sử bộ lọc</Label>
                <div className="flex flex-wrap gap-2">
                  {savedFilters.map((savedFilter) => (
                    <button
                      key={savedFilter.id}
                      className={`rounded-full border px-3 py-1 text-sm ${activeFilterId === savedFilter.id ? 'border-violet-600 bg-violet-50 text-violet-700' : 'border-slate-200 bg-white text-slate-600'}`}
                      onClick={() => applyFilter(savedFilter as any)}
                    >
                      {savedFilter.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setShowSaveFilter(true)}>
                Lưu lịch sử bộ lọc
              </Button>
              {activeFilterCount > 0 && (
                <Button variant="outline" onClick={handleResetFilters}>
                  Xóa bộ lọc
                </Button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFilterDialog(false)}>
              Hủy
            </Button>
            <Button
              onClick={() => {
                fetchInventory();
                setShowFilterDialog(false);
              }}
            >
              Áp dụng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSaveFilter} onOpenChange={setShowSaveFilter}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Lưu bộ lọc</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Tên bộ lọc</Label>
            <Input value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="VD: Hàng sắp hết khu A" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveFilter(false)}>
              Hủy
            </Button>
            <Button onClick={handleSaveCurrentFilter}>Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stockInOpen} onOpenChange={setStockInOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus size={18} />
              Nhập hàng vào kho
            </DialogTitle>
          </DialogHeader>

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

          {(selectedStockInPosition || selectedStockInZone) && (
            <div className="grid gap-3 rounded-2xl border border-amber-100 bg-amber-50/80 p-4 md:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-amber-500">Vị trí kho</p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  {selectedStockInPosition
                    ? `${selectedStockInPosition.label} - còn ${formatNumber(selectedStockInPosition.remainingCapacity ?? 0)} chỗ trống`
                    : 'Chưa chọn vị trí'}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-amber-500">Khu vực / Thùng</p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  {selectedStockInZone
                    ? `${selectedStockInZone.name} - còn ${formatNumber(selectedStockInZone.remainingCapacity)} chỗ trống`
                    : 'Chưa chọn khu vực'}
                </p>
              </div>
              {stockInCapacityMessage && (
                <div className="md:col-span-2 rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm text-amber-700">
                  {stockInCapacityMessage}
                </div>
              )}
            </div>
          )}

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
                    {zone.name} (còn {zone.remainingCapacity})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Số lượng hàng</Label>
              <Input type="number" min={1} max={stockInMaxAllowed ?? undefined} value={stockInForm.quantity} onChange={(e) => handleStockInQuantityChange(Number(e.target.value))} />
            </div>

            <div className="space-y-2">
              <Label>Giá nhập *</Label>
              <Input type="number" min={1} step="0.01" value={stockInForm.purchasePrice} onChange={(e) => setStockInForm((prev) => ({ ...prev, purchasePrice: Number(e.target.value) }))} />
            </div>

            <div className="space-y-2">
              <Label>Giá bán SP *</Label>
              <Input type="number" min={1} step="0.01" value={stockInForm.salePrice} onChange={(e) => setStockInForm((prev) => ({ ...prev, salePrice: Number(e.target.value) }))} />
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
            <Button onClick={submitStockIn} disabled={!stockInForm.productId || !stockInForm.quantity || stockInForm.purchasePrice <= 0 || stockInForm.salePrice <= 0 || (stockInMaxAllowed !== null && stockInMaxAllowed <= 0)}>
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


