import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface StockAdjustmentFormProps {
  onSubmit: (data: StockAdjustmentData) => Promise<void>;
  onCancel: () => void;
}

interface StockAdjustmentData {
  productId: number;
  warehousePositionId: number;
  adjustmentQuantity: number; // số âm = giảm, số dương = tăng
  reason: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  currentQuantity: number;
}

export default function StockAdjustmentForm({ onSubmit, onCancel }: StockAdjustmentFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<StockAdjustmentData>({
    productId: 0,
    warehousePositionId: 0,
    adjustmentQuantity: 0,
    reason: '',
  });
  const [adjustmentType, setAdjustmentType] = useState<'increase' | 'decrease'>('increase');

  // Mock data
  const products: Product[] = [
    { id: 1, name: 'Áo Thun Nam Size M', sku: 'AO-TH-M', currentQuantity: 50 },
    { id: 2, name: 'Quần Jean Nữ Size 28', sku: 'QUAN-JN-28', currentQuantity: 30 },
    { id: 3, name: 'Áo Sơ Mi Trắng Size L', sku: 'AO-SM-TL', currentQuantity: 25 },
  ];

  const positions = [
    { id: 1, name: 'Khu A - Thùng 01' },
    { id: 2, name: 'Khu A - Thùng 02' },
    { id: 3, name: 'Khu B - Thùng 01' },
    { id: 4, name: 'Khu B - Thùng 02' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Convert to actual quantity (negative for decrease)
      const quantity = adjustmentType === 'increase' 
        ? Math.abs(formData.adjustmentQuantity) 
        : -Math.abs(formData.adjustmentQuantity);
      
      await onSubmit({ ...formData, adjustmentQuantity: quantity });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
      {/* Header - Dark Blue with Cube Icon */}
      <div className="bg-[#c05621] px-6 py-5 flex items-center gap-4">
        <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center">
          <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Điều chỉnh tồn kho</h2>
          <p className="text-white/70 text-sm">Điều chỉnh số lượng sản phẩm</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        <div className="space-y-5">
          {/* Sản phẩm */}
          <div>
            <Label className="text-gray-700 font-semibold text-sm">Sản phẩm</Label>
            <select
              className="mt-2 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
              value={formData.productId}
              onChange={e => setFormData({ ...formData, productId: Number(e.target.value) })}
              required
            >
              <option value={0}>Chọn sản phẩm</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku}) - Còn: {p.currentQuantity}
                </option>
              ))}
            </select>
          </div>

          {/* Vị trí */}
          <div>
            <Label className="text-gray-700 font-semibold text-sm">Vị trí</Label>
            <select
              className="mt-2 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
              value={formData.warehousePositionId}
              onChange={e => setFormData({ ...formData, warehousePositionId: Number(e.target.value) })}
              required
            >
              <option value={0}>Chọn vị trí</option>
              {positions.map(pos => (
                <option key={pos.id} value={pos.id}>{pos.name}</option>
              ))}
            </select>
          </div>

          {/* Số lượng điều chỉnh */}
          <div>
            <Label className="text-gray-700 font-semibold text-sm">Số lượng điều chỉnh</Label>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setAdjustmentType('increase')}
                className={`flex-1 py-2.5 rounded-md font-medium transition-colors ${
                  adjustmentType === 'increase'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Tăng (+)
              </button>
              <button
                type="button"
                onClick={() => setAdjustmentType('decrease')}
                className={`flex-1 py-2.5 rounded-md font-medium transition-colors ${
                  adjustmentType === 'decrease'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Giảm (-)
              </button>
            </div>
            <Input
              type="number"
              min={1}
              value={formData.adjustmentQuantity}
              onChange={e => setFormData({ ...formData, adjustmentQuantity: Number(e.target.value) })}
              required
              className="mt-2"
              placeholder="Nhập số lượng cần điều chỉnh"
            />
            <p className="text-xs text-gray-500 mt-1">
              {adjustmentType === 'increase' ? '+' : '-'}{formData.adjustmentQuantity} sản phẩm
            </p>
          </div>

          {/* Lý do điều chỉnh */}
          <div>
            <Label className="text-gray-700 font-semibold text-sm">Lý do điều chỉnh</Label>
            <textarea
              className="mt-2 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
              rows={4}
              value={formData.reason}
              onChange={e => setFormData({ ...formData, reason: e.target.value })}
              placeholder="VD: Sai lệch kiểm kê, hàng hỏng, nhập thiếu, xuất thừa..."
              required
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-gray-200">
          <Button type="button" variant="outline" className="px-6 py-2.5 rounded-lg border-2 border-gray-300 hover:bg-gray-50">
            Hủy
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            className="bg-[#c05621] hover:bg-[#9c4221] text-white font-semibold px-8 py-2.5 rounded-lg shadow-md transition-all"
          >
            {isLoading ? 'Đang xử lý...' : 'Xác nhận điều chỉnh'}
          </Button>
        </div>
      </form>
    </div>
  );
}
