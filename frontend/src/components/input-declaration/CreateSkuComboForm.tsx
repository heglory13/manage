import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useState } from 'react';

interface SkuComboItem {
  sku: string;
  productName: string;
  classificationId?: number;
  colorId?: number;
  sizeId?: number;
  materialId?: number;
  productConditionId?: number;
  warehouseTypeId?: number;
  storageZoneId?: number;
  minThreshold: number;
}

interface SkuComboTableProps {
  items: SkuComboItem[];
  onAdd: (item: SkuComboItem) => void;
  onDelete: (sku: string) => void;
  onUpdate: (sku: string, updates: Partial<SkuComboItem>) => void;
  classifications: { id: number; name: string }[];
  colors: { id: number; name: string }[];
  sizes: { id: number; name: string }[];
  materials: { id: number; name: string }[];
  productConditions: { id: number; name: string }[];
  warehouseTypes: { id: number; name: string }[];
  storageZones: { id: number; name: string }[];
}

export default function SkuComboTable({
  items,
  onAdd,
  onDelete,
  onUpdate,
  classifications,
  colors,
  sizes,
  materials,
  productConditions,
  warehouseTypes,
  storageZones,
}: SkuComboTableProps) {
  const [newItem, setNewItem] = useState<Partial<SkuComboItem>>({
    sku: '',
    productName: '',
    minThreshold: 0,
  });

  const handleAdd = () => {
    if (!newItem.sku || !newItem.productName) return;
    onAdd(newItem as SkuComboItem);
    setNewItem({ sku: '', productName: '', minThreshold: 0 });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Combo SKU</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <Input
            placeholder="SKU *"
            value={newItem.sku}
            onChange={e => setNewItem({ ...newItem, sku: e.target.value })}
          />
          <Input
            placeholder="Tên sản phẩm *"
            value={newItem.productName}
            onChange={e => setNewItem({ ...newItem, productName: e.target.value })}
          />
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={newItem.classificationId || ''}
            onChange={e => setNewItem({ ...newItem, classificationId: Number(e.target.value) || undefined })}
          >
            <option value="">Phân loại</option>
            {classifications.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={newItem.colorId || ''}
            onChange={e => setNewItem({ ...newItem, colorId: Number(e.target.value) || undefined })}
          >
            <option value="">Màu sắc</option>
            {colors.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={newItem.sizeId || ''}
            onChange={e => setNewItem({ ...newItem, sizeId: Number(e.target.value) || undefined })}
          >
            <option value="">Kích thước</option>
            {sizes.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={newItem.materialId || ''}
            onChange={e => setNewItem({ ...newItem, materialId: Number(e.target.value) || undefined })}
          >
            <option value="">Chất liệu</option>
            {materials.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={newItem.productConditionId || ''}
            onChange={e => setNewItem({ ...newItem, productConditionId: Number(e.target.value) || undefined })}
          >
            <option value="">Tình trạng</option>
            {productConditions.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <Input
            type="number"
            placeholder="Ngưỡng tối thiểu"
            value={newItem.minThreshold}
            onChange={e => setNewItem({ ...newItem, minThreshold: Number(e.target.value) })}
          />
        </div>
        <Button onClick={handleAdd} disabled={!newItem.sku || !newItem.productName}>
          Thêm SKU
        </Button>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Tên</TableHead>
              <TableHead>Phân loại</TableHead>
              <TableHead>Màu</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Ngưỡng</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(item => (
              <TableRow key={item.sku}>
                <TableCell className="font-medium">{item.sku}</TableCell>
                <TableCell>{item.productName}</TableCell>
                <TableCell>{classifications.find(c => c.id === item.classificationId)?.name || '-'}</TableCell>
                <TableCell>{colors.find(c => c.id === item.colorId)?.name || '-'}</TableCell>
                <TableCell>{sizes.find(s => s.id === item.sizeId)?.name || '-'}</TableCell>
                <TableCell>{item.minThreshold}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(item.sku)} className="text-red-600">
                    Xóa
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
