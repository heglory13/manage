import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface StockInNewFormProps {
  onSubmit: (data: StockInData) => Promise<void>;
  onCancel: () => void;
}

interface StockInData {
  categoryId: number;
  material: string;
  color: string;
  size: string;
  sku: string;
  condition: string;
  warehouseZoneId: number;
  boxId: number;
  quantity: number;
  actualImportDate: string;
  notes?: string;
}

export default function StockInNewForm({ onSubmit, onCancel }: StockInNewFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<StockInData>({
    categoryId: 0,
    material: '',
    color: '',
    size: '',
    sku: '',
    condition: 'STANDARD',
    warehouseZoneId: 0,
    boxId: 0,
    quantity: 1,
    actualImportDate: new Date().toISOString().slice(0, 16),
    notes: '',
  });

  // Auto-generate SKU
  useEffect(() => {
    const sku = `${formData.categoryId || 'XX'}-${formData.material || 'XX'}-${formData.color || 'XX'}-${formData.size || 'XX'}`;
    setFormData(prev => ({ ...prev, sku }));
  }, [formData.categoryId, formData.material, formData.color, formData.size]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsLoading(false);
    }
  };

  // Mock data for dropdowns
  const categories = [
    { id: 1, name: 'Thời trang' },
    { id: 2, name: 'Điện tử' },
    { id: 3, name: 'Gia dụng' },
  ];

  const materials = ['Cotton', 'Polyester', 'Da', 'Vải tổng hợp'];
  const colors = ['Đen', 'Trắng', 'Xanh', 'Đỏ', 'Vàng'];
  const sizes = ['S', 'M', 'L', 'XL', 'XXL'];

  return (
    <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
      {/* Header - Dark Blue with Cube Icon */}
      <div className="bg-[#1a365d] px-6 py-5 flex items-center gap-4">
        <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center">
          <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Nhập kho</h2>
          <p className="text-white/70 text-sm">Thêm sản phẩm vào kho</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        <div className="space-y-5">
          {/* Row 1: Phân loại */}
          <div>
            <Label className="text-gray-700 font-semibold text-sm mb-2 block">Phân loại hàng hóa</Label>
            <select
              className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              value={formData.categoryId}
              onChange={e => setFormData({ ...formData, categoryId: Number(e.target.value) })}
              required
            >
              <option value={0}>Chọn phân loại</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Row 2: Chất liệu + Màu sắc */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-700 font-semibold text-sm mb-2 block">Chất liệu</Label>
              <select
                className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                value={formData.material}
                onChange={e => setFormData({ ...formData, material: e.target.value })}
                required
              >
                <option value="">Chọn chất liệu</option>
                {materials.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-gray-700 font-semibold text-sm mb-2 block">Màu sắc</Label>
              <select
                className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                value={formData.color}
                onChange={e => setFormData({ ...formData, color: e.target.value })}
                required
              >
                <option value="">Chọn màu sắc</option>
                {colors.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Size + SKU */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-700 font-semibold text-sm mb-2 block">Kích cỡ/Size</Label>
              <select
                className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                value={formData.size}
                onChange={e => setFormData({ ...formData, size: e.target.value })}
                required
              >
                <option value="">Chọn kích cỡ</option>
                {sizes.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-gray-700 font-semibold text-sm mb-2 block">Mã SKU dự kiến</Label>
              <Input
                value={formData.sku}
                readOnly
                className="bg-gray-50 cursor-not-allowed border-2 border-gray-200 rounded-lg py-3"
              />
            </div>
          </div>

          {/* Row 4: Tình trạng + Kho vực */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-700 font-semibold text-sm mb-2 block">Tình trạng hàng</Label>
              <select
                className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                value={formData.condition}
                onChange={e => setFormData({ ...formData, condition: e.target.value })}
                required
              >
                <option value="STANDARD">Đặt tiêu chuẩn</option>
                <option value="SECOND">Hàng thứ 2</option>
                <option value="DAMAGED">Hàng hỏng</option>
              </select>
            </div>
            <div>
              <Label className="text-gray-700 font-semibold text-sm mb-2 block">Vị trí lưu trữ - Kho vực</Label>
              <select
                className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                value={formData.warehouseZoneId}
                onChange={e => setFormData({ ...formData, warehouseZoneId: Number(e.target.value) })}
                required
              >
                <option value={0}>Chọn kho vực</option>
                <option value={1}>Khu A</option>
                <option value={2}>Khu B</option>
                <option value={3}>Khu C</option>
              </select>
            </div>
          </div>

          {/* Row 5: Thùng + Số lượng */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-700 font-semibold text-sm mb-2 block">Vị trí lưu trữ - Thùng</Label>
              <select
                className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                value={formData.boxId}
                onChange={e => setFormData({ ...formData, boxId: Number(e.target.value) })}
                required
              >
                <option value={0}>Chọn thùng</option>
                <option value={1}>Thùng 01</option>
                <option value={2}>Thùng 02</option>
                <option value={3}>Thùng 03</option>
              </select>
            </div>
            <div>
              <Label className="text-gray-700 font-semibold text-sm mb-2 block">Số lượng nhập</Label>
              <Input
                type="number"
                min={1}
                value={formData.quantity}
                onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })}
                required
                className="border-2 border-gray-200 rounded-lg py-3"
              />
            </div>
          </div>

          {/* Row 6: Thời gian */}
          <div>
            <Label className="text-gray-700 font-semibold text-sm mb-2 block">Thời gian hàng nhập kho thực tế</Label>
            <Input
              type="datetime-local"
              value={formData.actualImportDate}
              onChange={e => setFormData({ ...formData, actualImportDate: e.target.value })}
              required
              className="border-2 border-gray-200 rounded-lg py-3"
            />
          </div>

          {/* Row 7: Ghi chú */}
          <div>
            <Label className="text-gray-700 font-semibold text-sm mb-2 block">Ghi chú</Label>
            <textarea
              className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all resize-none"
              rows={3}
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Nhập ghi chú nếu có..."
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
            className="bg-[#1a365d] hover:bg-[#2d4a7c] text-white font-semibold px-8 py-2.5 rounded-lg shadow-md transition-all"
          >
            {isLoading ? 'Đang xử lý...' : 'Xác nhận nhập hàng'}
          </Button>
        </div>
      </form>
    </div>
  );
}
