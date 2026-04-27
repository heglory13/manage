import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { api } from '../services/api';
import { formatNumber } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

interface WarehouseType {
  id: string;
  name: string;
}

interface StorageZone {
  id: string;
  name: string;
  maxCapacity: number;
  currentStock: number;
}

interface Position {
  id: string;
  label: string;
  row: number;
  column: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isActive: boolean;
  maxCapacity: number | null;
  currentStock: number;
  skus?: { compositeSku: string; quantity: number }[];
}

interface Layout {
  id: string;
  name: string;
  rows: number;
  columns: number;
  layoutMode: 'GRID' | 'FREE';
  canvasWidth: number;
  canvasHeight: number;
  positions: Position[];
}

const LAYOUT_COLORS = [
  { bg: 'bg-blue-50 border-blue-200 hover:bg-blue-100', active: 'bg-blue-600 text-white border-blue-600' },
  { bg: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100', active: 'bg-emerald-600 text-white border-emerald-600' },
  { bg: 'bg-violet-50 border-violet-200 hover:bg-violet-100', active: 'bg-violet-600 text-white border-violet-600' },
];

function getPositionFill(position: Position) {
  if (!position.isActive) return '#f1f5f9';
  if (position.currentStock <= 0) return '#e5e7eb';
  const cap = position.maxCapacity || 1;
  const ratio = position.currentStock / cap;
  if (ratio >= 1) return '#fecaca';
  if (ratio >= 0.8) return '#fef08a';
  return '#bbf7d0';
}

export default function WarehousePage() {
  const [warehouseTypes, setWarehouseTypes] = useState<WarehouseType[]>([]);
  const [storageZones, setStorageZones] = useState<StorageZone[]>([]);
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [selectedWarehouseTypeId, setSelectedWarehouseTypeId] = useState('');
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [showPositionDialog, setShowPositionDialog] = useState(false);
  const [editingLabel, setEditingLabel] = useState('');
  const [editingCapacity, setEditingCapacity] = useState('');
  const [editingWidth, setEditingWidth] = useState('');
  const [editingHeight, setEditingHeight] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggingPosition, setDraggingPosition] = useState<Position | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [newZoneId, setNewZoneId] = useState('');
  const canvasRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [declarationRes, layoutRes] = await Promise.all([
        api.get('/input-declarations/all'),
        api.get('/warehouse/layouts/with-skus'),
      ]);
      const declarationData = declarationRes.data;
      setWarehouseTypes(declarationData.warehouseTypes || []);
      setStorageZones(declarationData.storageZones || []);
      setLayouts(Array.isArray(layoutRes.data) ? layoutRes.data : []);
      if (!selectedWarehouseTypeId && declarationData.warehouseTypes?.length > 0) {
        setSelectedWarehouseTypeId(declarationData.warehouseTypes[0].id);
      }
    } catch (err) {
      console.error(err);
      setError('Không thể tải dữ liệu sơ đồ kho.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedWarehouseTypeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const selectedWarehouseType = useMemo(
    () => warehouseTypes.find((item) => item.id === selectedWarehouseTypeId) || null,
    [selectedWarehouseTypeId, warehouseTypes],
  );

  const selectedLayout = useMemo(
    () => layouts.find((layout) => layout.name === selectedWarehouseType?.name) || null,
    [layouts, selectedWarehouseType],
  );

  const assignedZoneNames = useMemo(() => {
    const map = new Map<string, string>();
    layouts.forEach((layout) => {
      layout.positions.forEach((position) => {
        if (position.label) {
          map.set(position.label.toLowerCase(), layout.name);
        }
      });
    });
    return map;
  }, [layouts]);

  const availableZones = useMemo(() => {
    if (!selectedWarehouseType) return [];
    return storageZones.filter((zone) => {
      const assignedLayout = assignedZoneNames.get(zone.name.toLowerCase());
      return !assignedLayout || assignedLayout === selectedWarehouseType.name;
    });
  }, [assignedZoneNames, selectedWarehouseType, storageZones]);

  const ensureLayout = async () => {
    if (!selectedWarehouseType) return null;
    if (selectedLayout) return selectedLayout;
    const res = await api.post('/warehouse/layout', {
      name: selectedWarehouseType.name,
      rows: 4,
      columns: 6,
      layoutMode: 'FREE',
    });
    await fetchData();
    return res.data as Layout;
  };

  const handleAddZone = async () => {
    if (!newZoneId || !selectedWarehouseType) return;
    const zone = storageZones.find((item) => item.id === newZoneId);
    if (!zone) return;
    const layout = await ensureLayout();
    if (!layout) return;

    const existingCount = layout.positions.length;
    await api.post('/warehouse/positions', {
      layoutId: layout.id,
      label: zone.name,
      x: 24 + (existingCount % 5) * 132,
      y: 24 + Math.floor(existingCount / 5) * 112,
      width: 128,
      height: 92,
    });
    setNewZoneId('');
    await fetchData();
  };

  const handlePositionClick = (position: Position) => {
    setSelectedPosition(position);
    setEditingLabel(position.label || '');
    setEditingCapacity(position.maxCapacity?.toString() || '');
    setEditingWidth(position.width?.toString() || '128');
    setEditingHeight(position.height?.toString() || '92');
    setShowPositionDialog(true);
  };

  const handleSavePosition = async () => {
    if (!selectedPosition) return;
    await api.patch(`/warehouse/positions/${selectedPosition.id}/label`, {
      label: editingLabel,
    });
    const capacityValue = parseInt(editingCapacity, 10);
    if (!Number.isNaN(capacityValue) && capacityValue > 0) {
      await api.patch(`/warehouse/positions/${selectedPosition.id}/capacity`, {
        maxCapacity: capacityValue,
      });
    }
    await api.patch(`/warehouse/positions/${selectedPosition.id}/layout`, {
      width: parseInt(editingWidth, 10) || 128,
      height: parseInt(editingHeight, 10) || 92,
    });
    setShowPositionDialog(false);
    await fetchData();
  };

  const handleDeletePosition = async () => {
    if (!selectedPosition) return;
    await api.delete(`/warehouse/positions/${selectedPosition.id}`, {
      data: { force: false },
    });
    setShowPositionDialog(false);
    setSelectedPosition(null);
    await fetchData();
  };

  const handleDragStart = (e: React.MouseEvent, position: Position) => {
    if (!selectedLayout || selectedLayout.layoutMode !== 'FREE') return;
    setDraggingPosition(position);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingPosition || !canvasRef.current || !selectedLayout) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const newX = Math.max(0, e.clientX - canvasRect.left - dragOffset.x);
    const newY = Math.max(0, e.clientY - canvasRect.top - dragOffset.y);

    const nextLayouts = layouts.map((layout) =>
      layout.id !== selectedLayout.id
        ? layout
        : {
            ...layout,
            positions: layout.positions.map((position) =>
              position.id === draggingPosition.id
                ? { ...position, x: newX, y: newY }
                : position,
            ),
          },
    );
    setLayouts(nextLayouts);
  };

  const handleMouseUp = async () => {
    if (!draggingPosition || !selectedLayout) return;
    const updatedPosition = layouts
      .find((layout) => layout.id === selectedLayout.id)
      ?.positions.find((position) => position.id === draggingPosition.id);
    if (updatedPosition) {
      await api.patch(`/warehouse/positions/${draggingPosition.id}/layout`, {
        x: updatedPosition.x,
        y: updatedPosition.y,
      });
    }
    setDraggingPosition(null);
    await fetchData();
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="spinner" />
        </div>
      </AppLayout>
    );
  }

  const selectedIndex = Math.max(
    0,
    warehouseTypes.findIndex((item) => item.id === selectedWarehouseTypeId),
  );
  const colorScheme = LAYOUT_COLORS[selectedIndex % LAYOUT_COLORS.length];

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-[22px] font-semibold text-slate-950">Sơ đồ kho hàng</h2>
            <p className="mt-1 text-[15px] text-slate-500">
              Chọn loại kho, gán thùng/khu vực và kéo thả vị trí trực tiếp trên sơ đồ.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              className="form-select min-w-[220px]"
              value={selectedWarehouseTypeId}
              onChange={(e) => setSelectedWarehouseTypeId(e.target.value)}
            >
              {warehouseTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
            <select
              className="form-select min-w-[220px]"
              value={newZoneId}
              onChange={(e) => setNewZoneId(e.target.value)}
            >
              <option value="">Chọn thùng / khu vực để gán</option>
              {availableZones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name} - Max {zone.maxCapacity}
                </option>
              ))}
            </select>
            <Button onClick={handleAddZone} disabled={!newZoneId || !selectedWarehouseType}>
              <Plus size={16} className="mr-2" />
              Thêm khu vực
            </Button>
          </div>
        </div>

        {error && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
          {warehouseTypes.map((type, index) => {
            const scheme = LAYOUT_COLORS[index % LAYOUT_COLORS.length];
            const isActive = type.id === selectedWarehouseTypeId;
            const mappedLayout = layouts.find((layout) => layout.name === type.name);
            return (
              <button
                key={type.id}
                onClick={() => setSelectedWarehouseTypeId(type.id)}
                className={`rounded-xl border px-4 py-3 text-left transition ${isActive ? scheme.active : scheme.bg}`}
              >
                <div className="font-semibold">{type.name}</div>
                <div className={`text-xs ${isActive ? 'text-white/80' : 'text-slate-500'}`}>
                  {mappedLayout ? `${mappedLayout.positions.length} vị trí` : 'Chưa có sơ đồ'}
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-slate-50/80">
              <CardTitle className="text-base">
                {selectedWarehouseType ? `Sơ đồ kho - ${selectedWarehouseType.name}` : 'Sơ đồ kho'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {!selectedLayout ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-16 text-center text-slate-500">
                  Loại kho này chưa có sơ đồ. Chọn thùng/khu vực ở dropdown phía trên để bắt đầu dựng sơ đồ.
                </div>
              ) : (
                <div className="max-w-full overflow-auto rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                  <div
                    ref={canvasRef}
                    className="relative rounded-2xl border-2 border-dashed border-slate-300"
                    style={{
                      width: selectedLayout.canvasWidth || 980,
                      height: selectedLayout.canvasHeight || 640,
                      minWidth: '100%',
                      background: 'linear-gradient(135deg, #fff7cc 0%, #fff4a8 100%)',
                    }}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                    {selectedLayout.positions.filter((position) => position.isActive).map((position) => (
                      <div
                        key={position.id}
                        className="absolute cursor-move rounded-xl border-2 p-2 text-center shadow-sm transition hover:shadow-lg"
                        style={{
                          left: position.x,
                          top: position.y,
                          width: position.width || 128,
                          height: position.height || 92,
                          backgroundColor: getPositionFill(position),
                          borderColor: selectedPosition?.id === position.id ? '#4f46e5' : '#cbd5e1',
                        }}
                        onMouseDown={(e) => handleDragStart(e, position)}
                        onClick={() => handlePositionClick(position)}
                      >
                        <div className="truncate text-sm font-bold text-slate-900">{position.label}</div>
                        <div className="mt-1 text-[11px] text-slate-600">
                          {position.currentStock}/{position.maxCapacity || '∞'}
                        </div>
                        {position.skus && position.skus.length > 0 && (
                          <div className="mt-2 space-y-1 text-[10px] leading-4 text-slate-700">
                            {position.skus.slice(0, 3).map((sku) => (
                              <div key={sku.compositeSku} className="truncate rounded bg-white/70 px-1.5 py-0.5">
                                {sku.compositeSku} ({sku.quantity})
                              </div>
                            ))}
                            {position.skus.length > 3 && <div className="text-[9px] text-slate-500">+{position.skus.length - 3} SKU</div>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded bg-slate-300" />
                  <span className="text-slate-500">Trống</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded bg-[#bbf7d0]" />
                  <span className="text-slate-500">Bình thường</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded bg-[#fef08a]" />
                  <span className="text-slate-500">Gần đầy (&gt;80%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded bg-[#fecaca]" />
                  <span className="text-slate-500">Đầy</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Thông tin loại kho</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-slate-500">Loại kho</p>
                  <p className="font-medium text-slate-900">{selectedWarehouseType?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Số vị trí đã gán</p>
                  <p className="font-medium text-slate-900">{selectedLayout?.positions.length || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Thùng/khu vực còn có thể gán</p>
                  <p className="font-medium text-slate-900">{availableZones.length}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Một thùng/khu vực chỉ được phép xuất hiện trong một loại kho. Khi xóa khỏi loại kho hiện tại, nó sẽ xuất hiện lại ở dropdown của loại kho khác.
                </div>
              </CardContent>
            </Card>

            {selectedPosition && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Chi tiết vị trí - {selectedPosition.label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-slate-500">Sức chứa</p>
                    <p className="font-medium text-slate-900">
                      {selectedPosition.currentStock} / {selectedPosition.maxCapacity || 'Không giới hạn'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">SKU đang có trong vị trí</p>
                    <div className="mt-2 max-h-[220px] space-y-2 overflow-auto">
                      {selectedPosition.skus && selectedPosition.skus.length > 0 ? (
                        selectedPosition.skus.map((sku) => (
                          <div key={sku.compositeSku} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                            <span className="truncate font-mono">{sku.compositeSku}</span>
                            <span className="font-medium">{formatNumber(sku.quantity)}</span>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">Chưa có SKU trong vị trí này.</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showPositionDialog} onOpenChange={setShowPositionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chỉnh sửa vị trí</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nhãn vị trí</Label>
              <Input value={editingLabel} onChange={(e) => setEditingLabel(e.target.value)} />
            </div>
            <div>
              <Label>Sức chứa tối đa</Label>
              <Input type="number" min={1} value={editingCapacity} onChange={(e) => setEditingCapacity(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Chiều rộng</Label>
                <Input type="number" min={80} value={editingWidth} onChange={(e) => setEditingWidth(e.target.value)} />
              </div>
              <div>
                <Label>Chiều cao</Label>
                <Input type="number" min={70} value={editingHeight} onChange={(e) => setEditingHeight(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPositionDialog(false)}>Hủy</Button>
            <Button variant="outline" onClick={handleDeletePosition}>
              <Trash2 size={16} className="mr-2" />
              Xóa vị trí
            </Button>
            <Button onClick={handleSavePosition}>Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
