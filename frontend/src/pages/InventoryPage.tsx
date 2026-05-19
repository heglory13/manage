import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowRightLeft, CheckCircle2, Download, LayoutDashboard, Lock, Printer, Search, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import AppLayout from '../components/layout/AppLayout';
import { api } from '../services/api';
import { formatNumber, matchSel, matchSelArr } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import SmartFilter, { type FilterField } from '../components/common/SmartFilter';
import { useSavedFilters } from '../hooks/useSavedFilters';
import { SearchableSelect } from '../components/ui/searchable-select';

interface PositionItem {
  id: string;
  label: string;
  currentStock: number;
  warehouseTypeName: string | null;
}

interface InventoryRow {
  key: string;
  productId: string | null;
  isDiscontinued: boolean;
  transactionIds: string[];
  skuComboId: string | null;
  categoryId: string | null;
  categoryName: string;
  productName: string;
  sku: string;
  stock: number;
  productConditionName: string | null;
  positionLabels: string[];
  warehouseTypeNames: string[];
  storageZoneNames: string[];
  latestPurchasePrice: number | null;
  positions: PositionItem[];
}

interface PositionMapItem {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  currentStock: number;
  maxCapacity: number | null;
  isActive: boolean;
}

interface LayoutMapItem {
  id: string;
  name: string;
  positions: PositionMapItem[];
}

interface TransferForm {
  sourcePositionId: string;
  targetPositionId: string;
  quantity: number;
  reason: string;
}

function getPositionMapFill(pos: PositionMapItem) {
  if (!pos.isActive) return '#f1f5f9';
  if (pos.currentStock <= 0) return '#e5e7eb';
  const cap = pos.maxCapacity || 1;
  const ratio = pos.currentStock / cap;
  if (ratio >= 1) return '#fecaca';
  if (ratio >= 0.8) return '#fef08a';
  return '#bbf7d0';
}

const defaultTransferForm = (): TransferForm => ({
  sourcePositionId: '',
  targetPositionId: '',
  quantity: 1,
  reason: '',
});

export default function InventoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = Boolean(user?.permissions?.inventory?.edit);
  const canDelete = Boolean(user?.permissions?.inventory?.delete);
  const canPrintBarcode = Boolean(user?.permissions?.barcodePrint?.create);
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [invPage, setInvPage] = useState(1);
  const [invPageSize, setInvPageSize] = useState(50);
  const [invTotal, setInvTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState<TransferForm>(defaultTransferForm);
  const [isTransferring, setIsTransferring] = useState(false);
  const [allPositions, setAllPositions] = useState<PositionItem[]>([]);
  const [allLayouts, setAllLayouts] = useState<LayoutMapItem[]>([]);
  const [warehouseMapOpen, setWarehouseMapOpen] = useState(false);
  const [mapSelectedLayoutId, setMapSelectedLayoutId] = useState('');

  // Debounce search input
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setInvPage(1);
    }, 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery]);

  const savedFilterHook = useSavedFilters({ pageKey: 'inventory' });

  const filterFields = useMemo<FilterField[]>(() => {
    const buildOptions = (values: Array<string | number | null | undefined>) =>
      [...new Set(values
        .map((value) => (value ?? '').toString().trim())
        .filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'vi'))
        .map((value) => ({ value, label: value }));

    return [
      {
        key: 'productName',
        label: 'Tên sản phẩm',
        type: 'text',
        placeholder: 'Chọn sản phẩm...',
        asyncLoad: async (q?: string) => {
          const localOptions = buildOptions(rows.map((row) => row.productName));
          try {
            const res = await api.get('/products', { params: { limit: 100, search: q } });
            const items = res.data.data || res.data || [];
            const apiOptions = items.map((p: any) => ({ value: p.name, label: p.name }));
            // merge apiOptions (priority) with localOptions
            const map = new Map<string, { value: string; label: string }>();
            apiOptions.forEach((o) => map.set(o.value, o));
            localOptions.forEach((o) => { if (!map.has(o.value)) map.set(o.value, o); });
            return Array.from(map.values());
          } catch (err) {
            return localOptions;
          }
        },
      },
      {
        key: 'sku',
        label: 'SKU',
        type: 'text',
        placeholder: 'Chọn SKU...',
        asyncLoad: async () => {
          const res = await api.get('/input-declarations/sku-combos', { params: { limit: 500 } });
          const items = res.data.data || res.data || [];
          return items.map((s: any) => ({ value: s.compositeSku, label: s.compositeSku }));
        },
      },
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
      { key: 'stock', label: 'Tồn kho', type: 'number', options: buildOptions(rows.map((row) => row.stock)), placeholder: 'Chọn số tồn...' },
      {
        key: 'isDiscontinued',
        label: 'Trạng thái SX',
        type: 'select',
        options: [
          { value: 'false', label: 'Đang hoạt động' },
          { value: 'true', label: 'Ngưng sản xuất' },
        ],
      },
      {
        key: 'productConditionName',
        label: 'Tình trạng hàng',
        type: 'text',
        placeholder: 'Chọn tình trạng...',
        asyncLoad: async () => {
          const res = await api.get('/input-declarations/product-conditions');
          const items = res.data.data || res.data || [];
          return items.map((c: any) => ({ value: c.name, label: c.name }));
        },
      },
      {
        key: 'storageZone',
        label: 'Thùng/Khu vực',
        type: 'text',
        placeholder: 'Chọn thùng/khu vực...',
        asyncLoad: async () => {
          const res = await api.get('/input-declarations/storage-zones');
          const items = res.data.data || res.data || [];
          return items.map((z: any) => ({ value: z.name, label: z.name }));
        },
      },
      {
        key: 'warehouseType',
        label: 'Loại kho',
        type: 'text',
        placeholder: 'Chọn loại kho...',
        asyncLoad: async () => {
          const res = await api.get('/input-declarations/warehouse-types');
          const items = res.data.data || res.data || [];
          return items.map((w: any) => ({ value: w.name, label: w.name }));
        },
      },
    ];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const f = savedFilterHook.filters;
    let result = rows;

    // Search is handled by backend API, no need to filter locally again

    if (Object.keys(f).length > 0) {
      result = result.filter((row) => {
        if (!matchSel(f.productName, row.productName)) return false;
        if (!matchSel(f.sku, row.sku)) return false;
        if (!matchSel(f.categoryName, row.categoryName)) return false;
        if (!matchSel(f.stock, row.stock)) return false;
        if (!matchSel(f.isDiscontinued, String(row.isDiscontinued))) return false;
        if (!matchSel(f.productConditionName, row.productConditionName || '')) return false;
        if (!matchSelArr(f.storageZone, row.storageZoneNames)) return false;
        if (!matchSelArr(f.warehouseType, row.warehouseTypeNames)) return false;
        return true;
      });
    }

    return result;
  }, [rows, savedFilterHook.filters]);

  const selectedRows = useMemo(
    () => filteredRows.filter((row) => selectedIds.has(row.key)),
    [filteredRows, selectedIds],
  );
  const selectedRow = selectedRows.length === 1 ? selectedRows[0] : null;
  const transferSourceOptions = useMemo(
    () => {
      const positions = selectedRow?.positions || [];
      if (positions.length > 0) {
        return positions.map((position) => ({
          value: position.id,
          label: `${position.label}${position.warehouseTypeName ? ` - ${position.warehouseTypeName}` : ''} - tồn ${formatNumber(position.currentStock)}`,
        }));
      }
      return allPositions.map((position) => ({
        value: position.id,
        label: `${position.label}${position.warehouseTypeName ? ` - ${position.warehouseTypeName}` : ''}`,
      }));
    },
    [selectedRow, allPositions],
  );
  const selectedTransferSourcePosition = useMemo(
    () =>
      selectedRow?.positions.find((p) => p.id === transferForm.sourcePositionId) ||
      allPositions.find((p) => p.id === transferForm.sourcePositionId) ||
      null,
    [selectedRow, allPositions, transferForm.sourcePositionId],
  );
  const transferTargetOptions = useMemo(
    () =>
      allPositions
        .filter((position) => position.id !== transferForm.sourcePositionId)
        .map((position) => ({
          value: position.id,
          label: `${position.label}${position.warehouseTypeName ? ` - ${position.warehouseTypeName}` : ''} - tồn ${formatNumber(position.currentStock)}`,
        })),
    [allPositions, transferForm.sourcePositionId],
  );

  const mapSelectedLayout = useMemo(
    () => allLayouts.find((l) => l.id === mapSelectedLayoutId) || allLayouts[0] || null,
    [allLayouts, mapSelectedLayoutId],
  );

  const fetchInventory = useCallback(async (page = invPage) => {
    setIsLoading(true);
    try {
      const [inventoryRes, layoutRes] = await Promise.all([
        api.get('/inventory/by-sku', { params: { limit: invPageSize, page, search: debouncedSearch || undefined } }),
        api.get('/warehouse/layouts/with-skus'),
      ]);
      setRows(inventoryRes.data.data || []);
      setInvTotal(inventoryRes.data.total || 0);
      setInvPage(page);
      const rawLayouts: any[] = layoutRes.data || [];
      setAllLayouts(
        rawLayouts.map((layout) => ({
          id: layout.id,
          name: layout.name,
          positions: (layout.positions || []).map((p: any) => ({
            id: p.id,
            label: p.label || '',
            x: p.x ?? 0,
            y: p.y ?? 0,
            width: p.width ?? 210,
            height: p.height ?? 150,
            currentStock: p.currentStock ?? 0,
            maxCapacity: p.maxCapacity ?? null,
            isActive: p.isActive !== false,
          })),
        })),
      );
      setAllPositions(
        rawLayouts.flatMap((layout: any) =>
          (layout.positions || [])
            .filter((position: any) => position.isActive !== false)
            .map((position: any) => ({
              id: position.id,
              label: position.label || layout.name,
              currentStock: position.currentStock ?? 0,
              warehouseTypeName: layout.name || null,
            })),
        ),
      );
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setIsLoading(false);
    }
  }, [invPageSize, invPage, debouncedSearch]);

  useEffect(() => {
    void fetchInventory();
  }, [fetchInventory]);

  const toggleSelect = (key: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRows.map((r) => r.key)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const openBarcodeDialog = () => {
    const selected = filteredRows.filter((r) => selectedIds.has(r.key));
    if (selected.length === 0) {
      alert('Vui lòng chọn ít nhất 1 sản phẩm để in tem.');
      return;
    }
    const items = selected.map((r) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      skuComboId: r.skuComboId || undefined,
      productName: r.productName,
      sku: r.sku,
      salePrice: 0,
      quantity: 100,
    }));
    navigate('/barcode-print', { state: { items } });
  };

  const updateDiscontinued = async (isDiscontinued: boolean) => {
    const ids = selectedRows.map((row) => row.skuComboId).filter(Boolean) as string[];
    if (ids.length === 0) return;

    try {
      await api.patch('/input-declarations/sku-combos/batch-discontinue', {
        ids,
        isDiscontinued,
      });
      clearSelection();
      await fetchInventory();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Không thể cập nhật trạng thái sản xuất');
    }
  };

  const deleteSelectedTransactions = async () => {
    const transactionIds = [...new Set(selectedRows.flatMap((row) => row.transactionIds))];
    if (transactionIds.length === 0) return;
    if (!window.confirm(`Xóa ${transactionIds.length} giao dịch đang tạo nên tồn kho đã chọn?`)) return;

    try {
      await api.delete('/inventory/transactions', {
        data: { transactionIds },
      });
      clearSelection();
      await fetchInventory();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Không thể xóa giao dịch');
    }
  };

  const handleExportExcel = () => {
    const data = filteredRows.map((row) => ({
      'Tên sản phẩm': row.productName,
      'SKU': row.sku,
      'Danh mục': row.categoryName,
      'Tồn kho': row.stock,
      'Tình trạng': row.productConditionName || '',
      'Thùng/Khu vực': row.storageZoneNames.join(', '),
      'Vị trí': row.positionLabels.join(', '),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tồn kho');
    XLSX.writeFile(wb, 'ton-kho.xlsx');
  };

  const handleOpenTransfer = () => {
    if (!selectedRow) {
      alert('Vui lòng chỉ chọn đúng 1 sản phẩm để điều chuyển kho.');
      return;
    }
    setTransferForm(defaultTransferForm());
    setTransferOpen(true);
  };

  const handleSubmitTransfer = async () => {
    if (!selectedRow || !selectedRow.categoryId || isTransferring) return;

    setIsTransferring(true);
    try {
      await api.post('/inventory/transfer', {
        categoryId: selectedRow.categoryId,
        skuComboId: selectedRow.skuComboId || undefined,
        sourcePositionId: transferForm.sourcePositionId,
        targetPositionId: transferForm.targetPositionId,
        quantity: Number(transferForm.quantity),
        reason: transferForm.reason.trim(),
      });
      setTransferOpen(false);
      setTransferForm(defaultTransferForm());
      clearSelection();
      await fetchInventory();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Không thể điều chuyển kho');
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[22px] font-semibold text-slate-950">Quản lý tồn kho</h2>
            <p className="mt-1 text-[15px] text-slate-500">Xem tồn kho theo sản phẩm, quản lý trạng thái sản xuất và điều chuyển giữa các kho.</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={handleExportExcel}>
            <Download size={16} />
            Xuất Excel
          </Button>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-10 h-11 rounded-2xl"
            placeholder="Tìm theo tên sản phẩm, SKU, danh mục, thùng hoặc loại kho..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <SmartFilter
          fields={filterFields}
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

        <Card className="overflow-hidden rounded-[22px]">
          <CardContent className="p-0">
            {selectedIds.size > 0 && (
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-sm font-semibold text-slate-800">
                  Đã chọn {selectedIds.size} sản phẩm
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canPrintBarcode && (
                    <Button className="gap-2" onClick={openBarcodeDialog}>
                      <Printer size={16} />
                      In mã vạch
                    </Button>
                  )}
                  <Button variant="outline" className="gap-2" onClick={handleExportExcel}>
                    <Download size={16} />
                    Xuất Excel
                  </Button>
                  <Button variant="outline" className="h-10 rounded-xl" onClick={() => void updateDiscontinued(true)} disabled={!canEdit}>
                    <Lock size={15} />
                    Ngưng sản xuất
                  </Button>
                  <Button variant="outline" className="h-10 rounded-xl" onClick={() => void updateDiscontinued(false)} disabled={!canEdit}>
                    <CheckCircle2 size={15} />
                    Kích hoạt lại
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 rounded-xl border-sky-200 text-sky-700 hover:bg-sky-50"
                    onClick={handleOpenTransfer}
                    disabled={selectedRows.length !== 1 || !canEdit}
                  >
                    <ArrowRightLeft size={15} />
                    Điều chuyển kho
                  </Button>
                  {canDelete && (
                    <Button
                      variant="outline"
                      className="h-10 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50"
                      onClick={() => void deleteSelectedTransactions()}
                    >
                      <Trash2 size={15} />
                      Xóa giao dịch
                    </Button>
                  )}
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="flex h-64 items-center justify-center"><div className="spinner" /></div>
            ) : filteredRows.length === 0 ? (
              <div className="py-14 text-center text-slate-500">Chưa có dữ liệu tồn kho.</div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 pl-4">
                          <input type="checkbox" checked={selectedIds.size === filteredRows.length && filteredRows.length > 0} onChange={toggleSelectAll} />
                        </TableHead>
                        <TableHead>Tên sản phẩm</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Danh mục</TableHead>
                        <TableHead className="text-right">Tồn kho</TableHead>
                        <TableHead>Trạng thái SX</TableHead>
                        <TableHead>Tình trạng hàng</TableHead>
                        <TableHead>Thùng/Khu vực</TableHead>
                        <TableHead>Loại kho</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.map((row) => (
                        <TableRow key={row.key}>
                          <TableCell className="pl-4">
                            <input type="checkbox" checked={selectedIds.has(row.key)} onChange={() => toggleSelect(row.key)} />
                          </TableCell>
                          <TableCell className="font-semibold text-slate-900">{row.productName}</TableCell>
                          <TableCell className="text-xs font-mono text-indigo-600">{row.sku}</TableCell>
                          <TableCell className="text-sm text-slate-600">{row.categoryName}</TableCell>
                          <TableCell className={`text-right text-lg font-semibold ${row.stock > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {formatNumber(row.stock)}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${row.isDiscontinued ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-emerald-200 bg-emerald-50 text-emerald-600'}`}>
                              {row.isDiscontinued ? 'Ngưng sản xuất' : 'Đang hoạt động'}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">{row.productConditionName || '-'}</TableCell>
                          <TableCell className="text-sm text-slate-600">{row.storageZoneNames.length > 0 ? row.storageZoneNames.join(', ') : '-'}</TableCell>
                          <TableCell className="text-sm text-slate-600">{row.warehouseTypeNames.length > 0 ? row.warehouseTypeNames.join(', ') : '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile card list */}
                <div className="md:hidden divide-y divide-slate-100">
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredRows.length && filteredRows.length > 0}
                      onChange={toggleSelectAll}
                    />
                    <span className="text-xs text-slate-500 font-medium">Chọn tất cả ({filteredRows.length} sản phẩm)</span>
                  </div>
                  {filteredRows.map((row) => (
                    <div
                      key={row.key}
                      className={`px-4 py-4 transition-colors ${selectedIds.has(row.key) ? 'bg-indigo-50' : 'bg-white'}`}
                      onClick={() => toggleSelect(row.key)}
                    >
                      {/* Header row: checkbox + name + stock */}
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 shrink-0"
                          checked={selectedIds.has(row.key)}
                          onChange={() => toggleSelect(row.key)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1" style={{overflow: 'hidden', minWidth: 0}}>
                              <div className="font-semibold text-slate-900 text-[15px] leading-snug break-words pr-1">{row.productName}</div>
                              <div className="mt-0.5 text-xs font-mono text-indigo-600 break-all">{row.sku}</div>
                            </div>
                            <div className={`shrink-0 ml-2 text-xl font-bold tabular-nums leading-none ${row.stock > 0 ? 'text-emerald-600' : 'text-slate-400'}`} style={{minWidth: '2rem', textAlign: 'right'}}>
                              {formatNumber(row.stock)}
                            </div>
                          </div>

                          {/* Details */}
                          <div className="mt-2.5 space-y-1.5">
                            {/* Category */}
                            <div className="flex items-center gap-1.5 text-sm">
                              <span className="text-slate-400 text-xs w-16 shrink-0">Danh mục</span>
                              <span className="text-slate-600">{row.categoryName}</span>
                            </div>

                            {/* Storage zones */}
                            {row.storageZoneNames.length > 0 && (
                              <div className="flex items-start gap-1.5 text-sm">
                                <span className="text-slate-400 text-xs w-16 shrink-0 mt-0.5">Thùng/KV</span>
                                <span className="text-slate-800 font-semibold break-words min-w-0">{row.storageZoneNames.join(', ')}</span>
                              </div>
                            )}

                            {/* Position labels */}
                            {row.positionLabels.length > 0 && (
                              <div className="flex items-start gap-1.5 text-sm">
                                <span className="text-slate-400 text-xs w-16 shrink-0 mt-0.5">Vị trí</span>
                                <span className="text-slate-800 font-semibold break-words min-w-0">{row.positionLabels.join(', ')}</span>
                              </div>
                            )}

                            {/* Warehouse type */}
                            {row.warehouseTypeNames.length > 0 && (
                              <div className="flex items-start gap-1.5 text-sm">
                                <span className="text-slate-400 text-xs w-16 shrink-0 mt-0.5">Loại kho</span>
                                <span className="text-slate-600 break-words min-w-0">{row.warehouseTypeNames.join(', ')}</span>
                              </div>
                            )}
                          </div>

                          {/* Badges */}
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${row.isDiscontinued ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-emerald-200 bg-emerald-50 text-emerald-600'}`}>
                              {row.isDiscontinued ? 'Ngưng sản xuất' : 'Đang hoạt động'}
                            </span>
                            {row.productConditionName && (
                              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-600">
                                {row.productConditionName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span className="shrink-0">Hiển thị</span>
                <select
                  className="form-select page-size-select h-9 w-20 text-sm"
                  value={invPageSize}
                  onChange={(e) => { setInvPageSize(Number(e.target.value)); setInvPage(1); }}
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
                <span className="shrink-0">/ trang • Tổng {invTotal} mục</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={invPage <= 1} onClick={() => fetchInventory(invPage - 1)}>
                  Trước
                </Button>
                <span className="px-3 text-sm font-medium text-slate-700 tabular-nums">
                  {invPage} / {Math.ceil(invTotal / invPageSize) || 1}
                </span>
                <Button variant="outline" size="sm" disabled={invPage >= Math.ceil(invTotal / invPageSize)} onClick={() => fetchInventory(invPage + 1)}>
                  Sau
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={transferOpen}
        onOpenChange={(open) => {
          setTransferOpen(open);
          if (!open) {
            setTransferForm(defaultTransferForm());
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Điều chuyển kho</DialogTitle>
          </DialogHeader>

          {selectedRow && (
            <div className="min-w-0 w-full space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 min-w-0">
                <div className="text-sm text-slate-500">Sản phẩm đang chọn</div>
                <div className="mt-1 truncate text-[17px] font-semibold text-slate-950">{selectedRow.productName}</div>
                <div className="mt-1 truncate text-sm text-slate-500">{selectedRow.sku} • Tồn tổng {formatNumber(selectedRow.stock)}</div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <Label>Vị trí / thùng nguồn</Label>
                  <SearchableSelect
                    options={transferSourceOptions}
                    value={transferForm.sourcePositionId}
                    onChange={(value) => setTransferForm((prev) => ({ ...prev, sourcePositionId: value, quantity: 1 }))}
                    placeholder="Chọn vị trí nguồn"
                  />
                </div>

                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <Label className="shrink-0">Thùng / khu vực đích</Label>
                    <button
                      type="button"
                      className="flex shrink-0 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition"
                      onClick={() => {
                        if (allLayouts.length > 0) setMapSelectedLayoutId(allLayouts[0].id);
                        setWarehouseMapOpen(true);
                      }}
                    >
                      <LayoutDashboard size={13} />
                      Sơ đồ kho
                    </button>
                  </div>
                  <SearchableSelect
                    options={transferTargetOptions}
                    value={transferForm.targetPositionId}
                    onChange={(value) => setTransferForm((prev) => ({ ...prev, targetPositionId: value }))}
                    placeholder="Tìm và chọn vị trí đích"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Số lượng cần chuyển</Label>
                <Input
                  type="number"
                  min={1}
                  max={Math.max(selectedTransferSourcePosition?.currentStock || 1, 1)}
                  value={transferForm.quantity}
                  onChange={(e) =>
                    setTransferForm((prev) => ({
                      ...prev,
                      quantity: Math.min(
                        Math.max(Number(e.target.value) || 1, 1),
                        Math.max(selectedTransferSourcePosition?.currentStock || 1, 1),
                      ),
                    }))
                  }
                />
                <p className="text-xs text-slate-500">
                  Chỉ được nhập nhỏ hơn hoặc bằng số lượng hiện có tại vị trí nguồn.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Ghi chú</Label>
                <textarea
                  className="form-select min-h-[120px] w-full resize-none"
                  value={transferForm.reason}
                  onChange={(e) => setTransferForm((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="Nhập lý do cụ thể vì sao cần phải điều chuyển hàng và mô tả chi tiết vấn đề"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={() => void handleSubmitTransfer()}
              disabled={
                isTransferring ||
                !selectedRow ||
                !transferForm.sourcePositionId ||
                !transferForm.targetPositionId ||
                !transferForm.reason.trim() ||
                transferForm.quantity <= 0
              }
            >
              {isTransferring ? 'Đang xử lý...' : 'Xác nhận điều chuyển'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Warehouse Map Dialog for target position selection */}
      <Dialog open={warehouseMapOpen} onOpenChange={setWarehouseMapOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Sơ đồ kho — Chọn vị trí đích</DialogTitle>
          </DialogHeader>

          {/* Layout tabs */}
          {allLayouts.length > 0 && (
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
              {allLayouts.map((layout) => (
                <button
                  key={layout.id}
                  type="button"
                  onClick={() => setMapSelectedLayoutId(layout.id)}
                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                    mapSelectedLayout?.id === layout.id
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {layout.name}
                  <span className={`ml-1.5 text-xs ${mapSelectedLayout?.id === layout.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                    ({layout.positions.filter((p) => p.isActive).length} vị trí)
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-[#e5e7eb]" />Trống</div>
            <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-[#bbf7d0]" />Bình thường</div>
            <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-[#fef08a]" />Gần đầy (&gt;80%)</div>
            <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-[#fecaca]" />Đầy</div>
            <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded border-2 border-indigo-500 bg-indigo-100" />Đang chọn</div>
            <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded border-2 border-rose-400 bg-rose-100 opacity-50" />Vị trí nguồn</div>
          </div>

          {/* Canvas */}
          <div className="flex-1 overflow-auto rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
            {!mapSelectedLayout || mapSelectedLayout.positions.filter((p) => p.isActive).length === 0 ? (
              <div className="flex h-32 items-center justify-center text-slate-400 text-sm">
                Loại kho này chưa có vị trí nào được khai báo.
              </div>
            ) : (
              <div
                className="relative rounded-2xl border-2 border-dashed border-slate-300"
                style={{
                  width: Math.max(...mapSelectedLayout.positions.map((p) => p.x + (p.width || 210) + 40), 700),
                  height: Math.max(...mapSelectedLayout.positions.map((p) => p.y + (p.height || 150) + 40), 350),
                  background: 'linear-gradient(135deg, #fff7cc 0%, #fff4a8 100%)',
                }}
              >
                {mapSelectedLayout.positions.filter((p) => p.isActive).map((pos) => {
                  const isSource = pos.id === transferForm.sourcePositionId;
                  const isTarget = pos.id === transferForm.targetPositionId;
                  return (
                    <button
                      key={pos.id}
                      type="button"
                      disabled={isSource}
                      onClick={() => {
                        setTransferForm((prev) => ({ ...prev, targetPositionId: pos.id }));
                        setWarehouseMapOpen(false);
                      }}
                      className={`absolute rounded-xl border-2 p-2 text-center shadow-sm transition text-left ${
                        isSource
                          ? 'cursor-not-allowed opacity-50 border-rose-400'
                          : isTarget
                            ? 'cursor-pointer border-indigo-500 shadow-indigo-200 shadow-lg ring-2 ring-indigo-400'
                            : 'cursor-pointer border-slate-300 hover:border-indigo-400 hover:shadow-md'
                      }`}
                      style={{
                        left: pos.x,
                        top: pos.y,
                        width: pos.width || 200,
                        height: pos.height || 150,
                        backgroundColor: isTarget ? '#e0e7ff' : isSource ? '#fee2e2' : getPositionMapFill(pos),
                      }}
                      title={isSource ? 'Vị trí nguồn (không thể chọn)' : `Chọn: ${pos.label}`}
                    >
                      <div className="truncate text-sm font-bold text-slate-900">{pos.label}</div>
                      <div className="mt-0.5 text-[11px] text-slate-600">
                        Tồn: {formatNumber(pos.currentStock)}{pos.maxCapacity ? ` / ${formatNumber(pos.maxCapacity)}` : ''}
                      </div>
                      {isSource && <div className="mt-1 text-[10px] font-medium text-rose-500">Vị trí nguồn</div>}
                      {isTarget && <div className="mt-1 text-[10px] font-semibold text-indigo-600">Đã chọn</div>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWarehouseMapOpen(false)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
