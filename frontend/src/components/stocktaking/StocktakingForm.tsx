import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useWarehouse } from '../../hooks/useWarehouse';

interface StocktakingFormProps {
  onSubmit: (data: StocktakingData) => Promise<void>;
  onCancel: () => void;
}

interface StocktakingData {
  warehouseId: number;
  period: string;
  notes?: string;
}

export default function StocktakingForm({ onSubmit, onCancel }: StocktakingFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { data: warehouses } = useWarehouse({ limit: 100 });
  const [formData, setFormData] = useState<StocktakingData>({
    warehouseId: 0,
    period: new Date().toISOString().slice(0, 7),
    notes: '',
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
        <CardTitle>Tạo phiếu kiểm kho</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="warehouseId">Kho *</Label>
            <select
              id="warehouseId"
              className="mt-2 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={formData.warehouseId}
              onChange={e => setFormData({ ...formData, warehouseId: Number(e.target.value) })}
              required
            >
              <option value={0}>Chọn kho</option>
              {warehouses?.data.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="period">Kỳ kiểm kho *</Label>
            <Input
              id="period"
              type="month"
              value={formData.period}
              onChange={e => setFormData({ ...formData, period: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="notes">Ghi chú</Label>
            <textarea
              id="notes"
              className="mt-2 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              rows={3}
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Hủy
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Đang tạo...' : 'Tạo phiếu'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
