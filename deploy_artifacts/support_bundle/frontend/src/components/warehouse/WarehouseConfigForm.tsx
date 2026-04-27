import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useState } from 'react';

interface WarehouseConfigFormProps {
  onSubmit: (data: WarehouseData) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<WarehouseData>;
}

interface WarehouseData {
  name: string;
  code: string;
  rows: number;
  columns: number;
}

export default function WarehouseConfigForm({ onSubmit, onCancel, initialData }: WarehouseConfigFormProps) {
  const [formData, setFormData] = useState<WarehouseData>({
    name: initialData?.name || '',
    code: initialData?.code || '',
    rows: initialData?.rows || 10,
    columns: initialData?.columns || 10,
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialData?.name ? 'Sửa kho' : 'Thêm kho mới'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="code">Mã kho *</Label>
            <Input
              id="code"
              value={formData.code}
              onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              required
              disabled={!!initialData?.code}
              placeholder="VD: WH001"
            />
          </div>

          <div>
            <Label htmlFor="name">Tên kho *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="VD: Kho chính"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="rows">Số hàng</Label>
              <Input
                id="rows"
                type="number"
                min={1}
                max={100}
                value={formData.rows}
                onChange={e => setFormData({ ...formData, rows: Number(e.target.value) })}
                required
              />
            </div>
            <div>
              <Label htmlFor="columns">Số cột</Label>
              <Input
                id="columns"
                type="number"
                min={1}
                max={100}
                value={formData.columns}
                onChange={e => setFormData({ ...formData, columns: Number(e.target.value) })}
                required
              />
            </div>
          </div>

          <p className="text-sm text-gray-600 font-medium">
            Tổng vị trí: <span className="text-blue-600">{formData.rows * formData.columns}</span>
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Hủy
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Đang lưu...' : 'Lưu'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
