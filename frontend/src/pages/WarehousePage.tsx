import { useState, useEffect, useCallback, useRef } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { api } from '../services/api';
import { formatNumber } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';

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
  product?: { id: string; name: string; sku: string };
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
  { bg: 'bg-blue-50 border-blue-200 hover:bg-blue-100', active: 'bg-blue-600 text-white border-blue-600', icon: '🏭' },
  { bg: 'bg-green-50 border-green-200 hover:bg-green-100', active: 'bg-green-600 text-white border-green-600', icon: '📦' },
  { bg: 'bg-purple-50 border-purple-200 hover:bg-purple-100', active: 'bg-purple-600 text-white border-purple-600', icon: '🏬' },
  { bg: 'bg-orange-50 border-orange-200 hover:bg-orange-100', active: 'bg-orange-600 text-white border-orange-600', icon: '🗃️' },
  { bg: 'bg-pink-50 border-pink-200 hover:bg-pink-100', active: 'bg-pink-600 text-white border-pink-600', icon: '📋' },
  { bg: 'bg-teal-50 border-teal-200 hover:bg-teal-100', active: 'bg-teal-600 text-white border-teal-600', icon: '🗂️' },
];

export default function WarehousePage() {
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [selectedLayout, setSelectedLayout] = useState<Layout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [showPositionDialog, setShowPositionDialog] = useState(false);
  const [editingLabel, setEditingLabel] = useState('');
  const [editingCapacity, setEditingCapacity] = useState('');
  const [editingWidth, setEditingWidth] = useState('');
  const [editingHeight, setEditingHeight] = useState('');

  const [showNewLayoutDialog, setShowNewLayoutDialog] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState('');
  const [newLayoutRows, setNewLayoutRows] = useState(4);
  const [newLayoutCols, setNewLayoutCols] = useState(6);
  const [newLayoutMode, setNewLayoutMode] = useState<'GRID' | 'FREE'>('GRID');

  const [draggingPosition, setDraggingPosition] = useState<Position | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);

  const fetchLayouts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/warehouse/layouts/with-skus');
      const layoutData = Array.isArray(res.data) ? res.data : [];
      setLayouts(layoutData);
      if (layoutData.length > 0) {
        setSelectedLayout((prev) => layoutData.find((layout: Layout) => layout.id === prev?.id) || layoutData[0]);
      } else {
        setSelectedLayout(null);
      }
    } catch (err) {
      console.error('Error fetching layouts:', err);
      setError('Không thể tải dữ liệu kho');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLayouts();
  }, [fetchLayouts]);

  const getPositionColor = (position: Position) => {
    if (!position.isActive) return '#f3f4f6';
    if (position.currentStock === 0) return '#d1d5db';
    const capacity = position.maxCapacity || 1;
    const usage = position.currentStock / capacity;
    if (usage >= 1) return '#fecaca';
    if (usage >= 0.8) return '#fef08a';
    return '#bbf7d0';
  };

  const getCurrentColorScheme = () => {
    const index = selectedLayout ? Math.max(0, layouts.findIndex((layout) => layout.id === selectedLayout.id)) : 0;
    return LAYOUT_COLORS[index % LAYOUT_COLORS.length];
  };

  const getCanvasBackground = () => {
    const index = selectedLayout ? Math.max(0, layouts.findIndex((layout) => layout.id === selectedLayout.id)) : 0;
    const backgrounds = [
      'linear-gradient(135deg, #fef9c3 0%, #fef08a 100%)',
      'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)',
      'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
      'linear-gradient(135deg, #ccfbf1 0%, #99f6e4 100%)',
      'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)',
      'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    ];
    return backgrounds[index % backgrounds.length];
  };

  const handlePositionClick = (position: Position) => {
    setSelectedPosition(position);
    setEditingLabel(position.label || '');
    setEditingCapacity(position.maxCapacity?.toString() || '');
    setEditingWidth(position.width?.toString() || '100');
    setEditingHeight(position.height?.toString() || '80');
    setShowPositionDialog(true);
  };

  const handlePositionDoubleClick = (position: Position) => {
    handlePositionClick(position);
  };

  const handleSavePosition = async () => {
    if (!selectedPosition) return;

    try {
      const requests = [api.patch(`/warehouse/positions/${selectedPosition.id}/label`, { label: editingLabel })];
      const capacityValue = parseInt(editingCapacity, 10);
      const widthValue = parseInt(editingWidth, 10);
      const heightValue = parseInt(editingHeight, 10);

      if (!Number.isNaN(capacityValue) && capacityValue > 0) {
        requests.push(api.patch(`/warehouse/positions/${selectedPosition.id}/capacity`, { maxCapacity: capacityValue }));
      }

      if (!Number.isNaN(widthValue) && !Number.isNaN(heightValue)) {
        requests.push(
          api.patch(`/warehouse/positions/${selectedPosition.id}/layout`, {
            width: widthValue,
            height: heightValue,
          })
        );
      }

      await Promise.all(requests);
      setShowPositionDialog(false);
      await fetchLayouts();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể cập nhật vị trí');
    }
  };

  const handleToggleActive = async (position: Position) => {
    if (position.currentStock > 0) {
      alert('Vị trí đang chứa hàng hóa, không thể vô hiệu hóa');
      return;
    }

    try {
      await api.patch(`/warehouse/positions/${position.id}/toggle-active`);
      await fetchLayouts();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể thay đổi trạng thái');
    }
  };

  const handleCreateLayout = async () => {
    if (!newLayoutName.trim()) {
      alert('Vui lòng nhập tên kho');
      return;
    }

    try {
      await api.post('/warehouse/layout', {
        name: newLayoutName,
        rows: newLayoutRows,
        columns: newLayoutCols,
        layoutMode: newLayoutMode,
      });
      setShowNewLayoutDialog(false);
      setNewLayoutName('');
      setNewLayoutRows(4);
      setNewLayoutCols(6);
      await fetchLayouts();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể tạo kho');
    }
  };

  const handleAddFreePosition = async () => {
    if (!selectedLayout || selectedLayout.layoutMode !== 'FREE') return;

    const existingCount = selectedLayout.positions.length;
    try {
      await api.post('/warehouse/positions', {
        layoutId: selectedLayout.id,
        label: `P${existingCount + 1}`,
        x: 24 + (existingCount % 6) * 116,
        y: 24 + Math.floor(existingCount / 6) * 96,
        width: 120,
        height: 84,
      });
      await fetchLayouts();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể thêm vị trí mới');
    }
  };

  const handleDeletePosition = async () => {
    if (!selectedPosition) return;
    if (!confirm(`Xóa vị trí ${selectedPosition.label || 'này'}?`)) return;

    try {
      await api.delete(`/warehouse/positions/${selectedPosition.id}`);
      setSelectedPosition(null);
      setShowPositionDialog(false);
      await fetchLayouts();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể xóa vị trí');
    }
  };

  const handleDragStart = (e: React.MouseEvent, position: Position) => {
    if (selectedLayout?.layoutMode !== 'FREE') return;
    setDraggingPosition(position);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingPosition || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const newX = Math.max(0, e.clientX - canvasRect.left - dragOffset.x);
    const newY = Math.max(0, e.clientY - canvasRect.top - dragOffset.y);

    setSelectedLayout((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        positions: prev.positions.map((p) => (p.id === draggingPosition.id ? { ...p, x: newX, y: newY } : p)),
      };
    });
  };

  const handleMouseUp = async () => {
    if (!draggingPosition || !selectedLayout) return;

    const updatedPos = selectedLayout.positions.find((p) => p.id === draggingPosition.id);
    if (updatedPos) {
      try {
        await api.patch(`/warehouse/positions/${draggingPosition.id}/layout`, {
          x: updatedPos.x,
          y: updatedPos.y,
        });
      } catch (err) {
        console.error('Error updating position:', err);
      }
    }

    setDraggingPosition(null);
  };

  const getSkuDisplay = (position: Position) => {
    if (!position.skus || position.skus.length === 0) return [];
    return position.skus.slice(0, 2);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="spinner" style={{ borderTopColor: '#0d6efd' }}></div>
        </div>
      </AppLayout>
    );
  }

  const colorScheme = getCurrentColorScheme();

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Kho hàng</h1>
        <div className="flex flex-wrap items-center gap-3">
          {selectedLayout?.layoutMode === 'FREE' && (
            <Button variant="outline" onClick={handleAddFreePosition}>
              <Plus size={16} className="mr-2" />
              Thêm vị trí
            </Button>
          )}
          <Button onClick={() => setShowNewLayoutDialog(true)}>Tạo sơ đồ kho</Button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {layouts.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
          {layouts.map((layout, index) => {
            const currentScheme = LAYOUT_COLORS[index % LAYOUT_COLORS.length];

            return (
              <button
                key={layout.id}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                  selectedLayout?.id === layout.id ? currentScheme.active : `${currentScheme.bg} border-gray-200 text-foreground`
                }`}
                onClick={() => setSelectedLayout(layout)}
              >
                <span className="text-lg">{currentScheme.icon}</span>
                <div className="text-left">
                  <div className="font-semibold">{layout.name}</div>
                  <div className={`text-xs ${selectedLayout?.id === layout.id ? 'text-white/80' : 'text-muted-foreground'}`}>
                    {layout.layoutMode === 'GRID' ? 'Lưới' : 'Tự do'} • {layout.rows}×{layout.columns}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Card>
            <CardHeader className="border-b" style={{ backgroundColor: 'rgba(239, 246, 255, 0.7)' }}>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="text-2xl">{colorScheme.icon}</span>
                Sơ đồ kho - {selectedLayout?.name || 'Chưa chọn'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedLayout ? (
                <div className="py-12 text-center text-muted-foreground">
                  <p>Chưa có sơ đồ kho nào.</p>
                  <Button className="mt-4" onClick={() => setShowNewLayoutDialog(true)}>
                    Tạo sơ đồ kho đầu tiên
                  </Button>
                </div>
              ) : selectedLayout.layoutMode === 'GRID' ? (
                <div className="overflow-x-auto">
                  <div
                    className="inline-block min-w-full rounded-xl p-4"
                    style={{
                      minWidth: selectedLayout.columns * 60,
                      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                    }}
                  >
                    <div className="mb-1 flex">
                      <div className="w-12" />
                      {Array.from({ length: selectedLayout.columns }, (_, i) => (
                        <div key={i} className="flex-1 py-1 text-center text-xs text-muted-foreground">
                          C{i + 1}
                        </div>
                      ))}
                    </div>

                    {Array.from({ length: selectedLayout.rows }, (_, rowIdx) => (
                      <div key={rowIdx} className="flex">
                        <div className="flex w-12 items-center justify-center text-xs text-muted-foreground">
                          {String.fromCharCode(65 + rowIdx)}
                        </div>
                        {Array.from({ length: selectedLayout.columns }, (_, colIdx) => {
                          const position = selectedLayout.positions.find((p) => p.row === rowIdx && p.column === colIdx);

                          if (!position || !position.isActive) {
                            return (
                              <div key={colIdx} className="flex-1 p-0.5">
                                <div className="h-16 rounded border border-dashed border-gray-200 bg-gray-50" />
                              </div>
                            );
                          }

                          const skuDisplay = getSkuDisplay(position);

                          return (
                            <div key={colIdx} className="flex-1 p-0.5">
                              <button
                                onClick={() => handlePositionClick(position)}
                                onDoubleClick={() => handlePositionDoubleClick(position)}
                                className="relative flex h-16 w-full flex-col items-center justify-center rounded border-2 text-xs font-medium transition-all hover:shadow-md"
                                style={{
                                  backgroundColor: getPositionColor(position),
                                  borderColor: selectedPosition?.id === position.id ? '#3b82f6' : 'transparent',
                                }}
                              >
                                <span className="font-bold">{position.label || '?'}</span>
                                {position.maxCapacity && (
                                  <span className="text-[10px] text-gray-600">
                                    {position.currentStock}/{position.maxCapacity}
                                  </span>
                                )}
                                {skuDisplay.length > 0 && (
                                  <div className="mt-0.5 w-full truncate px-1 text-center text-[9px] text-gray-600">
                                    {skuDisplay.map((s) => s.compositeSku.split('-')[0]).join(', ')}
                                  </div>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="max-w-full overflow-auto rounded-xl">
                  <div
                    ref={canvasRef}
                    className="relative rounded-xl"
                    style={{
                      width: selectedLayout.canvasWidth || 800,
                      minWidth: '100%',
                      height: selectedLayout.canvasHeight || 600,
                      minHeight: 400,
                      background: getCanvasBackground(),
                      border: '2px dashed #94a3b8',
                    }}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                    {selectedLayout.positions
                      .filter((p) => p.isActive)
                      .map((position) => {
                        const skuDisplay = getSkuDisplay(position);
                        const isDragging = draggingPosition?.id === position.id;

                        return (
                          <div
                            key={position.id}
                            className={`absolute flex cursor-move select-none flex-col items-center justify-center rounded-lg border-2 transition-shadow ${
                              isDragging ? 'z-50 shadow-xl' : 'hover:shadow-lg'
                            }`}
                            style={{
                              left: position.x,
                              top: position.y,
                              width: position.width || 100,
                              height: position.height || 80,
                              backgroundColor: getPositionColor(position),
                              borderColor: selectedPosition?.id === position.id ? '#3b82f6' : '#d1d5db',
                            }}
                            onClick={() => handlePositionClick(position)}
                            onDoubleClick={() => handlePositionDoubleClick(position)}
                            onMouseDown={(e) => handleDragStart(e, position)}
                          >
                            <span className="text-sm font-bold">{position.label || '?'}</span>
                            {position.maxCapacity && (
                              <span className="text-[10px] text-gray-600">
                                {position.currentStock}/{position.maxCapacity}
                              </span>
                            )}
                            {skuDisplay.length > 0 && (
                              <div className="max-w-full truncate px-1 text-center text-[9px] text-gray-600">
                                {skuDisplay.map((s) => s.compositeSku.split('-')[0]).join(', ')}
                              </div>
                            )}
                            {position.skus && position.skus.length > 3 && (
                              <span className="text-[9px] text-gray-500">+{position.skus.length - 3}</span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded" style={{ backgroundColor: '#d1d5db' }} />
                  <span className="text-muted-foreground">Trống</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded" style={{ backgroundColor: '#bbf7d0' }} />
                  <span className="text-muted-foreground">Bình thường</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded" style={{ backgroundColor: '#fef08a' }} />
                  <span className="text-muted-foreground">Gần đầy (&gt;80%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded" style={{ backgroundColor: '#fecaca' }} />
                  <span className="text-muted-foreground">Đầy</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Thông tin kho</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedLayout ? (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Tên kho</p>
                    <p className="break-words font-medium">{selectedLayout.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Chế độ</p>
                    <p className="font-medium">{selectedLayout.layoutMode === 'GRID' ? 'Lưới vuông' : 'Tự do (Kéo thả)'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Kích thước</p>
                    <p className="font-medium">
                      {selectedLayout.rows} × {selectedLayout.columns}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tổng vị trí hoạt động</p>
                    <p className="font-medium">{selectedLayout.positions.filter((p) => p.isActive).length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tổng tồn kho</p>
                    <p className="font-medium">{formatNumber(selectedLayout.positions.reduce((sum, p) => sum + p.currentStock, 0))}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tổng sức chứa</p>
                    <p className="font-medium">{formatNumber(selectedLayout.positions.reduce((sum, p) => sum + (p.maxCapacity || 0), 0))}</p>
                  </div>
                </>
              ) : (
                <p className="text-center text-muted-foreground">Chưa chọn kho</p>
              )}
            </CardContent>
          </Card>

          {selectedPosition && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base">Chi tiết vị trí - {selectedPosition.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Tọa độ</p>
                  <p className="font-medium">
                    Hàng {selectedPosition.row + 1}, Cột {selectedPosition.column + 1}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sức chứa</p>
                  <p className="font-medium">
                    {selectedPosition.currentStock} / {selectedPosition.maxCapacity || 'Không giới hạn'}
                  </p>
                  {selectedPosition.maxCapacity && (
                    <div className="mt-1 h-2 rounded-full bg-gray-200">
                      <div
                        className={`h-2 rounded-full ${
                          selectedPosition.currentStock >= selectedPosition.maxCapacity
                            ? 'bg-red-500'
                            : selectedPosition.currentStock >= selectedPosition.maxCapacity * 0.8
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                        }`}
                        style={{
                          width: `${Math.min(100, (selectedPosition.currentStock / selectedPosition.maxCapacity) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </div>

                {selectedPosition.skus && selectedPosition.skus.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm text-muted-foreground">SKU trong vị trí</p>
                    <div className="max-h-[150px] space-y-1 overflow-y-auto">
                      {selectedPosition.skus.map((sku, idx) => (
                        <div key={idx} className="flex justify-between rounded bg-muted p-2 text-xs">
                          <span className="truncate font-mono">{sku.compositeSku}</span>
                          <span className="ml-2 font-medium">{formatNumber(sku.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleActive(selectedPosition)}
                    disabled={selectedPosition.currentStock > 0}
                  >
                    {selectedPosition.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
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
              <Input value={editingLabel} onChange={(e) => setEditingLabel(e.target.value)} placeholder="VD: A1, B2..." />
            </div>
            <div>
              <Label>Sức chứa tối đa</Label>
              <Input
                type="number"
                min={0}
                value={editingCapacity}
                onChange={(e) => setEditingCapacity(e.target.value)}
                placeholder="0 = Không giới hạn"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Chiều rộng</Label>
                <Input type="number" min={60} value={editingWidth} onChange={(e) => setEditingWidth(e.target.value)} />
              </div>
              <div>
                <Label>Chiều cao</Label>
                <Input type="number" min={60} value={editingHeight} onChange={(e) => setEditingHeight(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPositionDialog(false)}>
              Hủy
            </Button>
            {selectedLayout?.layoutMode === 'FREE' && (
              <Button variant="outline" onClick={handleDeletePosition}>
                <Trash2 size={16} className="mr-2" />
                Xóa vị trí
              </Button>
            )}
            <Button onClick={handleSavePosition}>Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewLayoutDialog} onOpenChange={setShowNewLayoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo sơ đồ kho mới</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tên kho</Label>
              <Input value={newLayoutName} onChange={(e) => setNewLayoutName(e.target.value)} placeholder="VD: Kho chính" />
            </div>
            <div>
              <Label>Chế độ</Label>
              <div className="mt-1 flex gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="layoutMode"
                    value="GRID"
                    checked={newLayoutMode === 'GRID'}
                    onChange={() => setNewLayoutMode('GRID')}
                  />
                  <span>Lưới vuông</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="layoutMode"
                    value="FREE"
                    checked={newLayoutMode === 'FREE'}
                    onChange={() => setNewLayoutMode('FREE')}
                  />
                  <span>Tự do (Kéo thả)</span>
                </label>
              </div>
            </div>
            {newLayoutMode === 'GRID' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Số hàng</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={newLayoutRows}
                    onChange={(e) => setNewLayoutRows(parseInt(e.target.value, 10) || 1)}
                  />
                </div>
                <div>
                  <Label>Số cột</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={newLayoutCols}
                    onChange={(e) => setNewLayoutCols(parseInt(e.target.value, 10) || 1)}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewLayoutDialog(false)}>
              Hủy
            </Button>
            <Button onClick={handleCreateLayout}>Tạo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
