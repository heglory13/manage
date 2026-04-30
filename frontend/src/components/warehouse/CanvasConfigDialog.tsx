import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface Zone {
  id?: number;
  name: string;
  color: string;
}

interface CanvasConfigDialogProps {
  open: boolean;
  onClose: () => void;
  zones: Zone[];
  onAddZone: (zone: Zone) => void;
  onDeleteZone: (id: number) => void;
  rows: number;
  columns: number;
  onGridSizeChange: (rows: number, columns: number) => void;
}

export default function CanvasConfigDialog({
  open,
  onClose,
  zones,
  onAddZone,
  onDeleteZone,
  rows,
  columns,
  onGridSizeChange,
}: CanvasConfigDialogProps) {
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneColor, setNewZoneColor] = useState('#3b82f6');

  const handleAddZone = () => {
    if (!newZoneName.trim()) return;
    onAddZone({ name: newZoneName, color: newZoneColor });
    setNewZoneName('');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cấu hình kho</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <h4 className="font-medium">Kích thước lưới</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="gridRows">Số hàng</Label>
                <Input
                  id="gridRows"
                  type="number"
                  min={1}
                  max={50}
                  value={rows}
                  onChange={e => onGridSizeChange(Number(e.target.value), columns)}
                />
              </div>
              <div>
                <Label htmlFor="gridCols">Số cột</Label>
                <Input
                  id="gridCols"
                  type="number"
                  min={1}
                  max={50}
                  value={columns}
                  onChange={e => onGridSizeChange(rows, Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Khu vực trong kho</h4>
            <div className="space-y-2">
              {zones.map(zone => (
                <div key={zone.id} className="flex items-center justify-between rounded border p-2">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full" style={{ backgroundColor: zone.color }} />
                    <span>{zone.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => zone.id && onDeleteZone(zone.id)}
                  >
                    Xóa
                  </Button>
                </div>
              ))}
            </div>
            
            <div className="flex gap-2">
              <Input
                placeholder="Tên khu vực"
                value={newZoneName}
                onChange={e => setNewZoneName(e.target.value)}
                className="flex-1"
              />
              <input
                type="color"
                value={newZoneColor}
                onChange={e => setNewZoneColor(e.target.value)}
                className="h-10 w-10 rounded border"
              />
              <Button onClick={handleAddZone}>Thêm</Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={onClose}>Đóng</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
