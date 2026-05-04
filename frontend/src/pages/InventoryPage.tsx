import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, Search } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { api } from '../services/api';
import { formatNumber } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import SmartFilter, { type FilterField } from '../components/common/SmartFilter';
import { useSavedFilters } from '../hooks/useSavedFilters';

interface InventoryRow {
  key: string;
  skuComboId: string | null;
  categoryId: string | null;
  categoryName: string;
  productName: string;
  sku: string;
  stock: number;
  productConditionName: string | null;
  positionLabels: string[];
  storageZoneNames: string[];
  latestPurchasePrice: number | null;
}

export default function InventoryPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const savedFilterHook = useSavedFilters({ pageKey: 'inventory' });

  const filterFields = useMemo<FilterField[]>(() => [
    { key: 'productName', label: 'Tên sản phẩm', type: 'text', placeholder: 'Tìm sản phẩm...' },
    { key: 'sku', label: 'SKU', type: 'text', placeholder: 'Tìm SKU...' },
    { key: 'categoryName', label: 'Danh mục', type: 'text', placeholder: 'Tìm danh mục...' },
    { key: 'storageZone', label: 'Thùng/Khu vực', type: 'text', placeholder: 'Tìm thùng...' },
    { key: 'position', label: 'Vị trí', type: 'text', placeholder: 'Tìm vị trí...' },
  ], []);

  const filteredRows = useMemo(() => {
    const f = savedFilterHook.filters;
    let result = rows;

    // Global search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((row) =>
        row.productName.toLowerCase().includes(q) ||
        row.sku.toLowerCase().includes(q) ||
        row.categoryName.toLowerCase().includes(q) ||
        row.storageZoneNames.some(z => z.toLowerCase().includes(q)) ||
        row.positionLabels.some(p => p.toLowerCase().includes(q))
      );
    }

    // SmartFilter filters
    if (Object.keys(f).length > 0) {
      result = result.filter((row) => {
        if (f.productName && !row.productName.toLowerCase().includes((f.productName as string).toLowerCase())) return false;
        if (f.sku && !row.sku.toLowerCase().includes((f.sku as string).toLowerCase())) return false;
        if (f.categoryName && !row.categoryName.toLowerCase().includes((f.categoryName as string).toLowerCase())) return false;
        if (f.storageZone && !row.storageZoneNames.some(z => z.toLowerCase().includes((f.storageZone as string).toLowerCase()))) return false;
        if (f.position && !row.positionLabels.some(p => p.toLowerCase().includes((f.position as string).toLowerCase()))) return false;
        return true;
      });
    }

    return result;
  }, [rows, searchQuery, savedFilterHook.filters]);

  const fetchInventory = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/inventory/by-sku', { params: { limit: 500 } });
      setRows(res.data.data || []);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const toggleSelect = (key: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[22px] font-semibold text-slate-950">Quản lý tồn kho</h2>
            <p className="mt-1 text-[15px] text-slate-500">Xem tồn kho theo danh mục, chọn sản phẩm để in tem mã vạch.</p>
          </div>
          {selectedIds.size > 0 && (
            <Button className="gap-2" onClick={openBarcodeDialog}>
              <Printer size={16} />
              In mã vạch ({selectedIds.size} sản phẩm)
            </Button>
          )}
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-10 h-11 rounded-2xl"
            placeholder="Tìm theo tên sản phẩm, SKU, danh mục, thùng hoặc vị trí..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <SmartFilter
          fields={filterFields}
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
            {isLoading ? (
              <div className="flex h-64 items-center justify-center"><div className="spinner" /></div>
            ) : filteredRows.length === 0 ? (
              <div className="py-14 text-center text-slate-500">Chưa có dữ liệu tồn kho.</div>
            ) : (
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
                    <TableHead>Tình trạng</TableHead>
                    <TableHead>Thùng/Khu vực</TableHead>
                    <TableHead>Vị trí</TableHead>
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
                        <TableCell className="text-sm text-slate-600">{row.productConditionName || '-'}</TableCell>
                        <TableCell className="text-sm text-slate-600">{row.storageZoneNames.length > 0 ? row.storageZoneNames.join(', ') : '-'}</TableCell>
                        <TableCell className="text-sm text-slate-600">{row.positionLabels.length > 0 ? row.positionLabels.join(', ') : '-'}</TableCell>
                      </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
