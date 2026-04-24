import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface StockOutNewFormProps {
  onSubmit: (data: StockOutData) => Promise<void>;
  onCancel: () => void;
}

interface StockOutData {
  productId: number;
  quantity: number;
  notes?: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  quantity: number;
}

export default function StockOutNewForm({ onSubmit, onCancel }: StockOutNewFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [showProductList, setShowProductList] = useState(false);
  const [productQuantities, setProductQuantities] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState('');

  // Mock data - sản phẩm có sẵn trong kho
  const availableProducts: Product[] = [
    { id: 1, name: 'Áo Thun Nam Size M', sku: 'AO-TH-M', quantity: 50 },
    { id: 2, name: 'Quần Jean Nữ Size 28', sku: 'QUAN-JN-28', quantity: 30 },
    { id: 3, name: 'Áo Sơ Mi Trắng Size L', sku: 'AO-SM-TL', quantity: 25 },
    { id: 4, name: 'Váy Hoa Size S', sku: 'VAY-H-S', quantity: 15 },
    { id: 5, name: 'Giày Thể Thao Nam', sku: 'GIAY-TT-N', quantity: 20 },
  ];

  const toggleProduct = (product: Product) => {
    const isSelected = selectedProducts.some(p => p.id === product.id);
    if (isSelected) {
      setSelectedProducts(selectedProducts.filter(p => p.id !== product.id));
      const newQuantities = { ...productQuantities };
      delete newQuantities[product.id];
      setProductQuantities(newQuantities);
    } else {
      setSelectedProducts([...selectedProducts, product]);
      setProductQuantities({ ...productQuantities, [product.id]: 1 });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedProducts.length === 0) {
      alert('Vui lòng chọn ít nhất một sản phẩm');
      return;
    }

    setIsLoading(true);
    try {
      for (const product of selectedProducts) {
        const data: StockOutData = {
          productId: product.id,
          quantity: productQuantities[product.id] || 1,
          notes,
        };
        await onSubmit(data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updateQuantity = (productId: number, quantity: number) => {
    const product = selectedProducts.find(p => p.id === productId);
    if (product && quantity <= product.quantity) {
      setProductQuantities({ ...productQuantities, [productId]: quantity });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
      {/* Header - Dark Blue with Cube Icon */}
      <div className="bg-[#c53030] px-6 py-5 flex items-center gap-4">
        <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center">
          <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Xuất kho</h2>
          <p className="text-white/70 text-sm">Xuất sản phẩm khỏi kho</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        <div className="space-y-5">
          {/* Sản phẩm - Checkbox */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-gray-700 font-semibold text-sm">Sản phẩm</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowProductList(!showProductList)}
                className="text-xs"
              >
                {showProductList ? 'Ẩn danh sách' : 'Hiện danh sách'}
              </Button>
            </div>

            {/* Selected products */}
            {selectedProducts.length > 0 && (
              <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-2">Đã chọn ({selectedProducts.length}):</p>
                <div className="space-y-2">
                  {selectedProducts.map(product => (
                    <div key={product.id} className="flex items-center gap-3 bg-white p-2 rounded border">
                      <input
                        type="checkbox"
                        checked={true}
                        onChange={() => toggleProduct(product)}
                        className="w-4 h-4 text-red-500"
                      />
                      <span className="flex-1 text-sm">
                        <span className="font-medium">{product.name}</span>
                        <span className="text-gray-400 ml-2 text-xs">({product.sku})</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">SL:</span>
                        <input
                          type="number"
                          min={1}
                          max={product.quantity}
                          value={productQuantities[product.id] || 1}
                          onChange={(e) => updateQuantity(product.id, Number(e.target.value))}
                          className="w-16 px-2 py-1 border rounded text-sm text-center"
                        />
                        <span className="text-xs text-gray-400">/ {product.quantity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Product list dropdown */}
            {showProductList && (
              <div className="border-2 border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                {availableProducts.map(product => (
                  <div
                    key={product.id}
                    className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 ${
                      selectedProducts.some(p => p.id === product.id) ? 'bg-red-50' : ''
                    } ${product.quantity === 0 ? 'opacity-50' : ''}`}
                    onClick={() => product.quantity > 0 && toggleProduct(product)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedProducts.some(p => p.id === product.id)}
                      onChange={() => {}}
                      className="w-4 h-4 text-red-500"
                      disabled={product.quantity === 0}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{product.name}</p>
                      <p className="text-xs text-gray-400">{product.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${product.quantity > 10 ? 'text-green-600' : product.quantity > 0 ? 'text-orange-500' : 'text-red-500'}`}>
                        {product.quantity}
                      </p>
                      <p className="text-xs text-gray-400">còn lại</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ghi chú */}
          <div>
            <Label className="text-gray-700 font-semibold text-sm">Ghi chú</Label>
            <textarea
              className="mt-2 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Lý do xuất, mã đơn hàng..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-gray-200">
          <Button type="button" variant="outline" className="px-6 py-2.5 rounded-lg border-2 border-gray-300 hover:bg-gray-50">
            Hủy
          </Button>
          <Button
            type="submit"
            disabled={isLoading || selectedProducts.length === 0}
            className="bg-[#c53030] hover:bg-[#9b2c2c] text-white font-semibold px-8 py-2.5 rounded-lg shadow-md transition-all"
          >
            {isLoading ? 'Đang xử lý...' : 'Xác nhận xuất hàng'}
          </Button>
        </div>
      </form>
    </div>
  );
}
