import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { useState } from 'react';

interface WarehouseTypeSectionProps {
  types: { id: number; name: string }[];
  onAdd: (name: string) => void;
  onDelete: (id: number) => void;
}

export default function WarehouseTypeSection({ types, onAdd, onDelete }: WarehouseTypeSectionProps) {
  const [newType, setNewType] = useState('');

  const handleAdd = () => {
    if (!newType.trim()) return;
    onAdd(newType.trim());
    setNewType('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Loại kho hàng</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Thêm loại kho..."
            value={newType}
            onChange={e => setNewType(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button
            onClick={handleAdd}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Thêm
          </button>
        </div>

        <div className="space-y-2">
          {types.map(type => (
            <div
              key={type.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <span className="font-medium">{type.name}</span>
              <button
                onClick={() => onDelete(type.id)}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Xóa
              </button>
            </div>
          ))}
          {types.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">Chưa có loại kho nào</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
