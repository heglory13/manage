import { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { api } from '../services/api';
import { formatDateTime } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { X } from 'lucide-react';
import * as XLSX from 'xlsx';

interface DeclarationsData {
  categories: { id: string; name: string; code?: string; createdAt: string }[];
  classifications: { id: string; name: string; createdAt: string }[];
  colors: { id: string; name: string; createdAt: string }[];
  sizes: { id: string; name: string; createdAt: string }[];
  materials: { id: string; name: string; createdAt: string }[];
  productConditions: { id: string; name: string; createdAt: string }[];
  warehouseTypes: { id: string; name: string; createdAt: string }[];
  storageZones: { id: string; name: string; maxCapacity: number; currentStock: number; createdAt: string }[];
}

interface SkuCombo {
  id: string;
  compositeSku: string;
  classification: { id: string; name: string };
  color: { id: string; name: string };
  size: { id: string; name: string };
  material: { id: string; name: string };
  createdAt: string;
}

interface ProductThreshold {
  id: string;
  name: string;
  sku: string;
  minThreshold: number;
  maxThreshold: number;
  stock: number;
  category?: { name: string };
}

type ColumnKey = 'categories' | 'classifications' | 'colors' | 'sizes' | 'materials' | 'productConditions' | 'storageZones' | 'warehouseTypes';

const COLUMN_CONFIG: Record<ColumnKey, { header: string; hasCapacity?: boolean }>[] = Object.fromEntries([
  ['categories', { header: 'Danh mục' }],
  ['classifications', { header: 'Phân loại' }],
  ['colors', { header: 'Màu sắc' }],
  ['sizes', { header: 'Kích thước' }],
  ['materials', { header: 'Chất liệu' }],
  ['productConditions', { header: 'Tình trạng' }],
  ['storageZones', { header: 'Thùng/Khu vực', hasCapacity: true }],
  ['warehouseTypes', { header: 'Loại kho' }],
]) as Record<ColumnKey, { header: string; hasCapacity?: boolean }>;

const COLUMN_KEYS: ColumnKey[] = ['categories', 'classifications', 'colors', 'sizes', 'materials', 'productConditions', 'storageZones', 'warehouseTypes'];

const ENDPOINT_MAP: Record<ColumnKey, string> = {
  categories: '/input-declarations/categories',
  classifications: '/input-declarations/classifications',
  colors: '/input-declarations/colors',
  sizes: '/input-declarations/sizes',
  materials: '/input-declarations/materials',
  productConditions: '/input-declarations/product-conditions',
  storageZones: '/input-declarations/storage-zones',
  warehouseTypes: '/input-declarations/warehouse-types',
};

export default function InputDeclarationPage() {
  const [activeTab, setActiveTab] = useState('declarations');
  const [declarations, setDeclarations] = useState<DeclarationsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New item states per column
  const [newItems, setNewItems] = useState<Record<ColumnKey, string>>(() => {
    const init: Record<string, string> = {};
    COLUMN_KEYS.forEach(k => init[k] = '');
    init.storageZones = '';
    return init as Record<ColumnKey, string>;
  });
  const [newCapacity, setNewCapacity] = useState<Record<string, string>>({});

  // SKU Combo states
  const [skuCombos, setSkuCombos] = useState<SkuCombo[]>([]);
  const [skuTotal, setSkuTotal] = useState(0);
  const [skuPage, setSkuPage] = useState(1);
  const [skuSearch, setSkuSearch] = useState('');
  const [skuLoading, setSkuLoading] = useState(false);
  const skuLimit = 20;

  // Min threshold states
  const [thresholds, setThresholds] = useState<ProductThreshold[]>([]);
  const [thresholdTotal, setThresholdTotal] = useState(0);
  const [thresholdPage, setThresholdPage] = useState(1);
  const [thresholdSearch, setThresholdSearch] = useState('');
  const [thresholdLoading, setThresholdLoading] = useState(false);
  const thresholdLimit = 20;

  // Editing threshold
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMinVal, setEditMinVal] = useState('');
  const [editMaxVal, setEditMaxVal] = useState('');

  const fetchDeclarations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/input-declarations/all');
      setDeclarations(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể tải dữ liệu khai báo');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSkuCombos = useCallback(async (page = 1, search = '') => {
    setSkuLoading(true);
    try {
      const res = await api.get('/input-declarations/sku-combos', {
        params: { page, limit: skuLimit, search },
      });
      setSkuCombos(res.data.data || []);
      setSkuTotal(res.data.total || 0);
      setSkuPage(page);
    } catch (err) {
      console.error('Error fetching SKU combos:', err);
    } finally {
      setSkuLoading(false);
    }
  }, [skuLimit]);

  const fetchThresholds = useCallback(async (page = 1, search = '') => {
    setThresholdLoading(true);
    try {
      const res = await api.get('/products', {
        params: { page, limit: thresholdLimit, search },
      });
      setThresholds(res.data.data || []);
      setThresholdTotal(res.data.total || 0);
      setThresholdPage(page);
    } catch (err) {
      console.error('Error fetching thresholds:', err);
    } finally {
      setThresholdLoading(false);
    }
  }, [thresholdLimit]);

  useEffect(() => {
    if (activeTab === 'declarations') {
      fetchDeclarations();
    } else if (activeTab === 'sku-combos') {
      fetchSkuCombos(1, skuSearch);
    } else if (activeTab === 'thresholds') {
      fetchThresholds(1, thresholdSearch);
    }
  }, [activeTab, fetchDeclarations, fetchSkuCombos, fetchThresholds]);

  const handleAdd = async (column: ColumnKey) => {
    const value = newItems[column]?.trim();
    if (!value) return;

    try {
      const endpoint = ENDPOINT_MAP[column];
      let payload: Record<string, unknown> = { name: value };

      // StorageZone requires maxCapacity
      if (column === 'storageZones') {
        const capacity = parseInt(newCapacity[column] || '0', 10);
        if (!capacity || capacity <= 0) {
          alert('Vui lòng nhập sức chứa hợp lệ (số nguyên > 0)');
          return;
        }
        payload = { name: value, maxCapacity: capacity };
      }

      await api.post(endpoint, payload);

      // Reset inputs
      setNewItems(prev => ({ ...prev, [column]: '' }));
      if (column === 'storageZones') {
        setNewCapacity(prev => ({ ...prev, storageZones: '' }));
      }

      // Refresh data
      fetchDeclarations();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể thêm mới';
      alert(msg);
    }
  };

  const handleDelete = async (column: ColumnKey, id: string) => {
    if (!confirm('Bạn có chắc muốn xóa?')) return;

    try {
      const endpoint = ENDPOINT_MAP[column];
      await api.delete(`${endpoint}/${id}`);
      fetchDeclarations();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể xóa';
      alert(msg);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, column: ColumnKey) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd(column);
    }
  };

  // Threshold editing
  const startEditThreshold = (item: ProductThreshold) => {
    setEditingId(item.id);
    setEditMinVal(String(item.minThreshold));
    setEditMaxVal(String(item.maxThreshold));
  };

  const cancelEditThreshold = () => {
    setEditingId(null);
    setEditMinVal('');
    setEditMaxVal('');
  };

  const saveThreshold = async (id: string) => {
    const minVal = parseInt(editMinVal, 10);
    const maxVal = parseInt(editMaxVal, 10);

    if (isNaN(minVal) || minVal < 0) {
      alert('Ngưỡng Min phải là số không âm');
      return;
    }
    if (isNaN(maxVal) || maxVal < 0) {
      alert('Ngưỡng Max phải là số không âm');
      return;
    }

    try {
      await api.patch(`/products/${id}`, { minThreshold: minVal, maxThreshold: maxVal });
      cancelEditThreshold();
      fetchThresholds(thresholdPage, thresholdSearch);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể cập nhật ngưỡng');
    }
  };

  // Export SKU combos to Excel
  const exportSkuCombos = () => {
    if (skuCombos.length === 0) return;
    const exportData = skuCombos.map((sku, idx) => ({
      'STT': idx + 1 + (skuPage - 1) * skuLimit,
      'Phân loại': sku.classification?.name || '',
      'Màu sắc': sku.color?.name || '',
      'Kích thước': sku.size?.name || '',
      'Chất liệu': sku.material?.name || '',
      'SKU Tổng hợp': sku.compositeSku,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SKU Combos');
    XLSX.writeFile(wb, 'sku-combos.xlsx');
  };

  const totalSkuPages = Math.ceil(skuTotal / skuLimit);
  const totalThresholdPages = Math.ceil(thresholdTotal / thresholdLimit);

  if (isLoading && !declarations) {
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Khai báo Input</h1>
        <p className="text-muted text-sm">Quản lý các trường thông tin đầu vào cho quy trình nhập/xuất kho</p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-red-700 text-sm border border-red-200">
          {error}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="declarations">Khai báo trường</TabsTrigger>
          <TabsTrigger value="sku-combos">SKU Tổng hợp</TabsTrigger>
          <TabsTrigger value="thresholds">Ngưỡng Min/Max</TabsTrigger>
        </TabsList>

        {/* TAB 1: Khai báo trường - 8 columns spreadsheet */}
        <TabsContent value="declarations">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Khai báo trường thông tin</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="spinner" style={{ borderTopColor: '#0d6efd' }}></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="grid gap-3 min-w-[900px]" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}>
                    {COLUMN_KEYS.map((colKey) => {
                      const config = COLUMN_CONFIG[colKey];
                      const items = (declarations?.[colKey] as any[]) || [];
                      const hasCapacity = config.hasCapacity;

                      return (
                        <div key={colKey} className="border rounded-lg p-3 bg-card">
                          {/* Header */}
                          <div className="font-semibold text-sm text-center mb-3 pb-2 border-b">
                            {config.header}
                          </div>

                          {/* Add form */}
                          <div className="space-y-2 mb-3">
                            <Input
                              size="sm"
                              placeholder={`Thêm...`}
                              value={newItems[colKey] || ''}
                              onChange={(e) => setNewItems(prev => ({ ...prev, [colKey]: e.target.value }))}
                              onKeyDown={(e) => handleKeyDown(e, colKey)}
                              className="text-xs h-8"
                            />
                            {hasCapacity && (
                              <Input
                                size="sm"
                                type="number"
                                placeholder="Sức chứa..."
                                value={newCapacity[colKey] || ''}
                                onChange={(e) => setNewCapacity(prev => ({ ...prev, [colKey]: e.target.value }))}
                                onKeyDown={(e) => handleKeyDown(e, colKey)}
                                className="text-xs h-8"
                                min={1}
                              />
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAdd(colKey)}
                              disabled={!newItems[colKey]?.trim() || (hasCapacity && !newCapacity[colKey])}
                              className="w-full text-xs h-8"
                            >
                              Thêm
                            </Button>
                          </div>

                          {/* Items list */}
                          <div className="space-y-1 max-h-[400px] overflow-y-auto">
                            {items.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-4">Chưa có dữ liệu</p>
                            ) : (
                              items.map((item: any) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between p-2 rounded hover:bg-muted/50 text-xs group"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="truncate font-medium">{item.name}</div>
                                    {hasCapacity && (
                                      <div className="text-muted-foreground text-[10px]">
                                        Sức chứa: {item.maxCapacity} | Hiện tại: {item.currentStock || 0}
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleDelete(colKey, item.id)}
                                    className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 ml-1 flex-shrink-0 p-1"
                                    title="Xóa"
                                  >
                                    Xóa
                                  </button>
                                </div>
                              ))
                            )}
                          </div>

                          {/* Count */}
                          <div className="mt-2 pt-2 border-t text-xs text-muted-foreground text-center">
                            {items.length} mục
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: SKU Tổng hợp */}
        <TabsContent value="sku-combos">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Danh sách SKU Tổng hợp</CardTitle>
                <div className="flex gap-2">
                  <div className="relative">
                    <Input
                      placeholder="Tìm kiếm SKU..."
                      value={skuSearch}
                      onChange={(e) => setSkuSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchSkuCombos(1, skuSearch)}
                      className="w-64 h-9"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchSkuCombos(1, skuSearch)}
                  >
                    Tìm
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportSkuCombos}>
                    Xuất Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {skuLoading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="spinner" style={{ borderTopColor: '#0d6efd' }}></div>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">STT</TableHead>
                          <TableHead>Phân loại</TableHead>
                          <TableHead>Màu sắc</TableHead>
                          <TableHead>Kích thước</TableHead>
                          <TableHead>Chất liệu</TableHead>
                          <TableHead>SKU Tổng hợp</TableHead>
                          <TableHead className="w-24">Ngày tạo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {skuCombos.map((sku, idx) => (
                          <TableRow key={sku.id}>
                            <TableCell>{(skuPage - 1) * skuLimit + idx + 1}</TableCell>
                            <TableCell>{sku.classification?.name || '-'}</TableCell>
                            <TableCell>{sku.color?.name || '-'}</TableCell>
                            <TableCell>{sku.size?.name || '-'}</TableCell>
                            <TableCell>{sku.material?.name || '-'}</TableCell>
                            <TableCell className="font-mono text-xs font-medium">{sku.compositeSku}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDateTime(sku.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {skuCombos.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              Chưa có SKU tổng hợp nào
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {skuTotal > 0 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Hiển thị {(skuPage - 1) * skuLimit + 1} - {Math.min(skuPage * skuLimit, skuTotal)} trong tổng {skuTotal} bản ghi
                      </p>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchSkuCombos(skuPage - 1, skuSearch)}
                          disabled={skuPage <= 1}
                        >
                          Trước
                        </Button>
                        {Array.from({ length: Math.min(5, totalSkuPages) }, (_, i) => {
                          const page = i + 1;
                          return (
                            <Button
                              key={page}
                              variant={page === skuPage ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => fetchSkuCombos(page, skuSearch)}
                            >
                              {page}
                            </Button>
                          );
                        })}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchSkuCombos(skuPage + 1, skuSearch)}
                          disabled={skuPage >= totalSkuPages}
                        >
                          Sau
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Ngưỡng Min/Max */}
        <TabsContent value="thresholds">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Cài đặt ngưỡng tồn kho</CardTitle>
                <div className="relative">
                  <Input
                    placeholder="Tìm kiếm sản phẩm..."
                    value={thresholdSearch}
                    onChange={(e) => setThresholdSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchThresholds(1, thresholdSearch)}
                    className="w-64 h-9"
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Ngưỡng Min: Cảnh báo khi tồn kho dưới mức này. Ngưỡng Max: Cảnh báo khi tồn kho vượt mức này.
              </p>
            </CardHeader>
            <CardContent>
              {thresholdLoading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="spinner" style={{ borderTopColor: '#0d6efd' }}></div>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">STT</TableHead>
                          <TableHead>Tên sản phẩm</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Danh mục</TableHead>
                          <TableHead className="text-right">Tồn kho</TableHead>
                          <TableHead className="text-right">Ngưỡng Min</TableHead>
                          <TableHead className="text-right">Ngưỡng Max</TableHead>
                          <TableHead className="w-28">Hành động</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {thresholds.map((item, idx) => (
                          <TableRow key={item.id}>
                            <TableCell>{(thresholdPage - 1) * thresholdLimit + idx + 1}</TableCell>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                            <TableCell>{item.category?.name || '-'}</TableCell>
                            <TableCell className="text-right font-medium">
                              <span className={
                                item.stock === 0 ? 'text-red-600' :
                                item.minThreshold > 0 && item.stock < item.minThreshold ? 'text-yellow-600' :
                                item.maxThreshold > 0 && item.stock > item.maxThreshold ? 'text-orange-600' :
                                'text-green-600'
                              }>
                                {item.stock}
                              </span>
                            </TableCell>

                            {editingId === item.id ? (
                              <>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={editMinVal}
                                    onChange={(e) => setEditMinVal(e.target.value)}
                                    className="w-20 h-8 text-right"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={editMaxVal}
                                    onChange={(e) => setEditMaxVal(e.target.value)}
                                    className="w-20 h-8 text-right"
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button size="sm" variant="default" onClick={() => saveThreshold(item.id)} className="h-7 px-2">
                                      Lưu
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={cancelEditThreshold} className="h-7 px-2">
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </>
                            ) : (
                              <>
                                <TableCell className="text-right text-muted-foreground">{item.minThreshold}</TableCell>
                                <TableCell className="text-right text-muted-foreground">{item.maxThreshold}</TableCell>
                                <TableCell>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => startEditThreshold(item)}
                                    className="h-7"
                                  >
                                    Sửa
                                  </Button>
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        ))}
                        {thresholds.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                              Chưa có sản phẩm nào
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {thresholdTotal > 0 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Hiển thị {(thresholdPage - 1) * thresholdLimit + 1} - {Math.min(thresholdPage * thresholdLimit, thresholdTotal)} trong tổng {thresholdTotal} bản ghi
                      </p>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchThresholds(thresholdPage - 1, thresholdSearch)}
                          disabled={thresholdPage <= 1}
                        >
                          Trước
                        </Button>
                        {Array.from({ length: Math.min(5, totalThresholdPages) }, (_, i) => {
                          const page = i + 1;
                          return (
                            <Button
                              key={page}
                              variant={page === thresholdPage ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => fetchThresholds(page, thresholdSearch)}
                            >
                              {page}
                            </Button>
                          );
                        })}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchThresholds(thresholdPage + 1, thresholdSearch)}
                          disabled={thresholdPage >= totalThresholdPages}
                        >
                          Sau
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
