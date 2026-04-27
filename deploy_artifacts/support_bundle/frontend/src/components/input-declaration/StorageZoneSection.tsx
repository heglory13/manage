import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useState } from 'react';

interface StorageZoneSectionProps {
  zones: { id: number; name: string; warehouseTypeId: number }[];
  warehouseTypes: { id: number; name: string }[];
  onAdd: (zone: { name: string; warehouseTypeId: number }) => void;
  onDelete: (id: number) => void;
}

export default function StorageZoneSection({ zones, warehouseTypes, onAdd, onDelete }: StorageZoneSectionProps) {
  const [newZone, setNewZone] = useState({ name: '', warehouseTypeId: 0 });

  const handleAdd = () => {
    if (!newZone.name.trim() || !newZone.warehouseTypeId) return;
    onAdd(newZone);
    setNewZone({ name: '', warehouseTypeId: 0 });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Khu vực lưu trữ</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Tên khu vực..."
            value={newZone.name}
            onChange={e => setNewZone({ ...newZone, name: e.target.value })}
            className="flex-1"
          />
          <select
            value={newZone.warehouseTypeId}
            onChange={e => setNewZone({ ...newZone, warehouseTypeId: Number(e.target.value) })}
            className="rounded-md border border-input bg-background px-3 py-2"
          >
            <option value={0}>Chọn loại kho</option>
            {warehouseTypes.map(wt => (
              <option key={wt.id} value={wt.id}>{wt.name}</option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={!newZone.name.trim() || !newZone.warehouseTypeId}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Thêm
          </button>
        </div>

        <div className="space-y-2">
          {zones.map(zone => (
            <div
              key={zone.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div>
                <p className="font-medium">{zone.name}</p>
                <p className="text-sm text-muted-foreground">
                  {warehouseTypes.find(wt => wt.id === zone.warehouseTypeId)?.name || '-'}
                </p>
              </div>
              <button
                onClick={() => onDelete(zone.id)}
                className="text-red-600 hover:text-red-700"
              >
                Xóa
              </button>
            </div>
          ))}
          {zones.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">Chưa có khu vực nào</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
