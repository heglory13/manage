import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Printer, FileText, Search, Trash2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { api } from '../services/api';
import { formatNumber } from '../lib/utils';
import { openBarcodePrintWindow } from '../lib/barcode';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

interface BarcodeLineItem {
  id: string;
  skuComboId?: string;
  productName: string;
  sku: string;
  quantity: number;
  salePrice: number;
}

type PaperSize = '74x22' | '72x22' | '40x30' | '110x22';

const PAPER_SIZES: { value: PaperSize; label: string; cols: number; width: string; height: string }[] = [
  { value: '74x22', label: 'Khổ 74 x 22 mm', cols: 2, width: '37mm', height: '22mm' },
  { value: '72x22', label: 'Khổ 72 x 22 mm', cols: 2, width: '36mm', height: '22mm' },
  { value: '40x30', label: 'Khổ 40 x 30 mm', cols: 1, width: '40mm', height: '30mm' },
  { value: '110x22', label: 'Khổ 110 x 22 mm', cols: 3, width: '36mm', height: '22mm' },
];

function formatCurrency(value: number) {
  return formatNumber(value) + ' VND';
}

export default function BarcodePrintPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [items, setItems] = useState<BarcodeLineItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  // Template settings
  const [showName, setShowName] = useState(true);
  const [showBarcode, setShowBarcode] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showCurrency, setShowCurrency] = useState(true);
  const [showWide, setShowWide] = useState(true);
  const [paperSize, setPaperSize] = useState<PaperSize>('74x22');

  const selectedPaper = PAPER_SIZES.find((p) => p.value === paperSize) || PAPER_SIZES[1];

  // Load items from navigation state (from InventoryPage)
  useEffect(() => {
    const state = location.state as { items?: BarcodeLineItem[] } | null;
    if (state?.items && state.items.length > 0) {
      setItems(state.items);
    }
  }, [location.state]);

  const searchSkuCombos = useCallback(async (query: string) => {
    if (!query || query.length < 1) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    try {
      const res = await api.get('/input-declarations/sku-combos', {
        params: { search: query, limit: 10 },
      });
      setSearchResults(res.data.data || []);
      setSearchOpen(true);
    } catch {
      setSearchResults([]);
    }
  }, []);

  const addItem = (combo: any) => {
    const productName = [combo.classification?.name, combo.color?.name, combo.size?.name, combo.material?.name].filter(Boolean).join(' - ');
    const exists = items.find((i) => i.sku === combo.compositeSku);
    if (exists) {
      setItems((prev) => prev.map((i) => i.sku === combo.compositeSku ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setItems((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          skuComboId: combo.id,
          productName,
          sku: combo.compositeSku,
          quantity: 100,
          salePrice: 0,
        },
      ]);
    }
    setSearchQuery('');
    setSearchOpen(false);
    setSearchResults([]);
  };

  const updateItem = (id: string, field: 'quantity' | 'salePrice', value: number) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, [field]: value } : i));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleCreateTicket = async () => {
    const validItems = items.filter((i) => i.quantity > 0 && i.salePrice > 0);
    if (validItems.length === 0) {
      alert('Vui lòng thêm ít nhất 1 sản phẩm với số lượng và giá bán > 0.');
      return;
    }

    try {
      await api.post('/barcode-prints', {
        items: validItems.map((i) => ({
          skuComboId: i.skuComboId,
          productName: i.productName,
          sku: i.sku,
          salePrice: i.salePrice,
          quantity: i.quantity,
          paperSize,
        })),
      });
      alert(`Đã tạo ${validItems.length} phiếu in tem thành công! Chờ duyệt tại mục Quản lý tồn kho > Lịch sử in tem.`);
      navigate('/inventory');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể tạo phiếu in tem');
    }
  };



  // Preview label for template section
  const previewItem = items[0] || { productName: 'Áo thun 30/4 Rồng tiên Cotton 100% - Size 2 - Trắng', sku: 'TS57CMT-2', salePrice: 398000 };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800"
            onClick={() => navigate('/inventory')}
          >
            <ArrowLeft size={16} />
            Quay lại danh sách sản phẩm
          </button>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate('/inventory')}>Thoát</Button>
            <Button className="gap-2 bg-violet-600 hover:bg-violet-700" onClick={handleCreateTicket}>
              <Check size={16} />
              Tạo phiếu in tem
            </Button>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[300px]">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Search size={16} />
            </div>
            <Input
              className="pl-10"
              placeholder="Tìm theo tên, mã SKU, hoặc quét mã Barcode..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                searchSkuCombos(e.target.value);
              }}
              onFocus={() => { if (searchResults.length > 0) setSearchOpen(true); }}
            />
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-60 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                {searchResults.map((combo: any) => {
                  const label = [combo.classification?.name, combo.color?.name, combo.size?.name, combo.material?.name].filter(Boolean).join(' - ');
                  return (
                    <button
                      key={combo.id}
                      type="button"
                      className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                      onClick={() => addItem(combo)}
                    >
                      <div className="text-sm font-medium text-slate-900">{label}</div>
                      <div className="text-xs text-slate-500 font-mono">{combo.compositeSku}</div>
                    </button>
                  );
                })}
              </div>
            )}
            {searchOpen && searchQuery.length >= 1 && searchResults.length === 0 && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-lg">
                Không tìm thấy sản phẩm nào
              </div>
            )}
          </div>
        </div>

        {/* Product table */}
        <Card className="rounded-2xl">
          <CardContent className="p-0">
            {items.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                Tìm và thêm sản phẩm cần in tem mã vạch ở ô tìm kiếm phía trên.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3 w-12">STT</th>
                      <th className="px-4 py-3">Mã barcode</th>
                      <th className="px-4 py-3">Tên sản phẩm</th>
                      <th className="px-4 py-3 text-right w-32">Số lượng</th>
                      <th className="px-4 py-3 text-right w-40">Đơn giá</th>
                      <th className="px-4 py-3 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                        <td className="px-4 py-3 font-mono text-sm text-blue-600">{item.sku}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{item.productName}</td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            min={1}
                            className="h-9 w-28 text-right ml-auto"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value) || 0)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="text"
                            inputMode="numeric"
                            className="h-9 w-36 text-right ml-auto"
                            value={item.salePrice ? formatNumber(item.salePrice) : ''}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, '');
                              updateItem(item.id, 'salePrice', Number(raw) || 0);
                            }}
                            placeholder="0"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button type="button" className="text-slate-400 hover:text-rose-500" onClick={() => removeItem(item.id)}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bottom section: Template settings + Paper size */}
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Template settings */}
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Thiết lập mẫu in tem</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-[200px_1fr]">
                {/* Checkboxes */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} className="rounded" />
                    Tên sản phẩm
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={showBarcode} onChange={(e) => setShowBarcode(e.target.checked)} className="rounded" />
                    Mã Barcode
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} className="rounded" />
                    Giá bán
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={showCurrency} onChange={(e) => setShowCurrency(e.target.checked)} className="rounded" />
                    Giá kèm đơn vị tiền VND
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={showWide} onChange={(e) => setShowWide(e.target.checked)} className="rounded" />
                    Khổ rộng
                  </label>
                </div>

                {/* Preview */}
                <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6">
                  <div
                    className="border border-slate-400 bg-white flex flex-col items-center justify-center text-center overflow-hidden"
                    style={{
                      width: showWide ? '200px' : '160px',
                      height: '100px',
                      padding: '4px 6px',
                    }}
                  >
                    {showName && (
                      <div className="text-[9px] font-medium leading-tight max-h-[24px] overflow-hidden w-full">
                        {previewItem.productName}
                      </div>
                    )}
                    {showBarcode && (
                      <>
                        <div style={{ fontFamily: "'Libre Barcode 128', cursive", fontSize: '32px', lineHeight: '0.85', marginTop: '2px' }}>
                          {previewItem.sku}
                        </div>
                        <div className="text-[8px] font-semibold mt-0.5">{previewItem.sku}</div>
                      </>
                    )}
                    {showPrice && previewItem.salePrice > 0 && (
                      <div className="text-[11px] font-bold mt-0.5">
                        {formatNumber(previewItem.salePrice)}{showCurrency ? ' VND' : ''}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Paper size */}
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Chọn khổ in và giấy in</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'Khổ 1 tem', cols: 1 },
                { label: 'Khổ 2 tem', cols: 2 },
                { label: 'Khổ 3 tem', cols: 3 },
              ].map((group) => {
                const sizes = PAPER_SIZES.filter((p) => p.cols === group.cols);
                if (sizes.length === 0) return null;
                return (
                  <div key={group.cols}>
                    <p className="text-sm font-semibold text-slate-700 mb-3">{group.label}</p>
                    <div className="space-y-2">
                      {sizes.map((p) => (
                        <label key={p.value} className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition ${paperSize === p.value ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                          <input
                            type="radio"
                            name="paperSize"
                            checked={paperSize === p.value}
                            onChange={() => setPaperSize(p.value)}
                          />
                          <span className="text-sm">{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
