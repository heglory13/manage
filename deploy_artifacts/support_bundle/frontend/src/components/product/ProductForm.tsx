import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface ProductFormProps {
  onSubmit: (data: ProductData) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<ProductData>;
}

interface ProductData {
  sku: string;
  name: string;
  categoryId?: number;
  unit?: string;
  minStock?: number;
  isActive: boolean;
}

export default function ProductForm({ onSubmit, onCancel, initialData }: ProductFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<ProductData>({
    sku: initialData?.sku || '',
    name: initialData?.name || '',
    categoryId: initialData?.categoryId,
    unit: initialData?.unit || '',
    minStock: initialData?.minStock || 0,
    isActive: initialData?.isActive ?? true,
  });

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
        <CardTitle>{initialData?.sku ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="sku">SKU *</Label>
            <Input
              id="sku"
              value={formData.sku}
              onChange={e => setFormData({ ...formData, sku: e.target.value })}
              required
              disabled={!!initialData?.sku}
            />
          </div>

          <div>
            <Label htmlFor="name">Tên sản phẩm *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="categoryId">Danh mục</Label>
            <select
              id="categoryId"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              value={formData.categoryId || ''}
              onChange={e => setFormData({ ...formData, categoryId: e.target.value ? Number(e.target.value) : undefined })}
            >
              <option value="">Chọn danh mục</option>
            </select>
          </div>

          <div>
            <Label htmlFor="unit">Đơn vị</Label>
            <Input
              id="unit"
              value={formData.unit}
              onChange={e => setFormData({ ...formData, unit: e.target.value })}
              placeholder="VD: Cái, Kg, Gói"
            />
          </div>

          <div>
            <Label htmlFor="minStock">Tồn kho tối thiểu</Label>
            <Input
              id="minStock"
              type="number"
              min={0}
              value={formData.minStock}
              onChange={e => setFormData({ ...formData, minStock: Number(e.target.value) })}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
            />
            <Label htmlFor="isActive">Hoạt động</Label>
          </div>

          <div className="flex justify-end gap-2">
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
