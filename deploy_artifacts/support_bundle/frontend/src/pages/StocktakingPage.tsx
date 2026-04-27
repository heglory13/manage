import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, Clock3, Eye, History, Plus, Printer, RefreshCcw, Search, ShieldAlert, Upload, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import AppLayout from '../components/layout/AppLayout';
import { api } from '../services/api';
import { compressImageForUpload } from '../lib/image';
import { formatDateTime, formatNumber } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { defaultGeneralSettings, fetchGeneralSettings } from '../services/generalSettings';

type StocktakingStatus = 'CHECKING' | 'PENDING' | 'APPROVED' | 'REJECTED';

type StocktakingItem = {
  id: string;
  systemQuantity: number;
  actualQuantity: number;
  discrepancy: number;
  discrepancyReason?: string;
  evidenceUrl?: string;
  product: {
    id: string;
    name: string;
    sku: string;
  };
};

type StocktakingRecord = {
  id: string;
  status: StocktakingStatus;
  createdAt: string;
  cutoffTime: string;
  submittedAt?: string;
  mode: 'full' | 'selected';
  creator: { id: string; name: string };
  items: StocktakingItem[];
  statusHistory?: Array<{
    id: string;
    status: string;
    changedAt: string;
    note?: string;
  }>;
};

type ProductOption = {
  id: string;
  name: string;
  sku: string;
};

type PositionOption = {
  id: string;
  label: string;
};

type AdjustmentForm = {
  productId: string;
  warehousePositionId: string;
  quantity: number;
  type: 'INCREASE' | 'DECREASE';
  reason: string;
};

const STATUS_LABELS: Record<StocktakingStatus, string> = {
  CHECKING: 'Đang kiểm kê',
  PENDING: 'Chờ duyệt',
  APPROVED: 'Hoàn thành',
  REJECTED: 'Từ chối',
};

const STATUS_TEXT_COLORS: Record<StocktakingStatus, string> = {
  CHECKING: 'text-blue-600',
  PENDING: 'text-amber-600',
  APPROVED: 'text-emerald-600',
  REJECTED: 'text-rose-600',
};

const COMPANY_INFO = {
  name: 'HỆ THỐNG QUẢN LÝ KHO IMS',
  address: 'Địa chỉ: 123 Đường ABC, Quận 1, TP.HCM',
  phone: 'Điện thoại: 0123.456.789',
};

function monthMatches(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function formatAuditCode(record: StocktakingRecord) {
  return record.id.startsWith('AUD-') ? record.id : `AUD-${record.id}`;
}

export default function StocktakingPage() {
  const [records, setRecords] = useState<StocktakingRecord[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<StocktakingRecord | null>(null);
  const [createMode, setCreateMode] = useState<'full' | 'selected'>('selected');
  const [cutoffDate, setCutoffDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cutoffTime, setCutoffTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [skuSearch, setSkuSearch] = useState('');
  const [isSubmittingConfirmation, setIsSubmittingConfirmation] = useState(false);
  const [signedDocument, setSignedDocument] = useState<{ name: string; preview: string; url: string } | null>(null);
  const [confirmForm, setConfirmForm] = useState<Record<string, { actualQuantity: number; discrepancyReason: string }>>({});
  const [generalSettings, setGeneralSettings] = useState(defaultGeneralSettings);
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentForm>({
    productId: '',
    warehousePositionId: '',
    quantity: 1,
    type: 'DECREASE',
    reason: '',
  });

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/stocktaking', { params: { limit: 100 } });
      setRecords(res.data.data || res.data || []);
    } catch (err) {
      console.error('Error fetching stocktaking records:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const [productRes, layoutRes] = await Promise.all([
        api.get('/products', { params: { limit: 1000 } }),
        api.get('/warehouse/layout'),
      ]);
      const data = productRes.data.data || productRes.data || [];
      setProducts(
        data.map((item: any) => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
        }))
      );
      setPositions(
        (layoutRes.data?.positions || [])
          .filter((position: any) => position.label)
          .map((position: any) => ({
            id: position.id,
            label: position.label,
          }))
      );
    } catch (err) {
      console.error('Error fetching products for stocktaking:', err);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
    fetchProducts();
  }, [fetchProducts, fetchRecords]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await fetchGeneralSettings();
        setGeneralSettings(data);
      } catch (error) {
        console.error('Error loading general settings:', error);
      }
    };

    void loadSettings();
  }, []);

  const currentMonthApproved = useMemo(
    () => records.filter((record) => record.status === 'APPROVED' && monthMatches(record.createdAt)),
    [records]
  );

  const discrepancyStats = useMemo(() => {
    const approvedItems = currentMonthApproved.flatMap((record) => record.items || []);
    const totalDiscrepancy = approvedItems.reduce((sum, item) => sum + Math.abs(item.discrepancy), 0);
    const totalSystemQty = approvedItems.reduce((sum, item) => sum + item.systemQuantity, 0);
    const matchedQty = approvedItems.reduce((sum, item) => sum + Math.min(item.systemQuantity, item.actualQuantity), 0);
    const matchRate = totalSystemQty > 0 ? (matchedQty / totalSystemQty) * 100 : 100;

    return {
      totalDiscrepancy,
      matchRate,
    };
  }, [currentMonthApproved]);

  const filteredProducts = useMemo(() => {
    const keyword = skuSearch.trim().toLowerCase();
    return products.filter((product) => !keyword || product.sku.toLowerCase().includes(keyword) || product.name.toLowerCase().includes(keyword));
  }, [products, skuSearch]);

  const selectedCount = selectedProductIds.length;

  const openAdjustment = (item: StocktakingItem) => {
    setAdjustmentForm({
      productId: item.product.id,
      warehousePositionId: '',
      quantity: Math.max(Math.abs(item.discrepancy) || 1, 1),
      type: item.discrepancy >= 0 ? 'INCREASE' : 'DECREASE',
      reason: item.discrepancyReason || 'Điều chỉnh từ kiểm kê định kỳ',
    });
    setShowAdjustmentModal(true);
  };

  const openDetail = async (recordId: string) => {
    try {
      const res = await api.get(`/stocktaking/${recordId}`);
      const record = res.data as StocktakingRecord;
      setSelectedRecord(record);
      setShowConfirmModal(false);
      setShowDetailModal(true);
    } catch (err) {
      console.error('Error fetching stocktaking detail:', err);
    }
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((prev) => (prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]));
  };

  const handleCreate = async () => {
    try {
      const payload: { mode: 'full' | 'selected'; productIds?: string[]; cutoffTime: string } = {
        mode: createMode,
        cutoffTime: `${cutoffDate}T${cutoffTime}:00`,
      };
      if (createMode === 'selected') payload.productIds = selectedProductIds;

      const res = await api.post('/stocktaking', payload);
      const created = res.data;

      setShowCreateModal(false);
      setSelectedProductIds([]);
      setSkuSearch('');
      setCutoffDate(new Date().toISOString().slice(0, 10));
      setCutoffTime(new Date().toTimeString().slice(0, 5));
      await fetchRecords();
      await openDetail(created.id);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể tạo biên bản kiểm kê');
    }
  };

  const openConfirmation = (record: StocktakingRecord) => {
    setConfirmForm(
      Object.fromEntries(
        (record.items || []).map((item) => [
          item.id,
          {
            actualQuantity: item.actualQuantity || item.systemQuantity,
            discrepancyReason: item.discrepancyReason || '',
          },
        ])
      )
    );
    setSignedDocument(null);
    setSelectedRecord(record);
    setShowDetailModal(false);
    setShowConfirmModal(true);
  };

  const updateConfirmItem = (itemId: string, field: 'actualQuantity' | 'discrepancyReason', value: number | string) => {
    setConfirmForm((prev) => ({
      ...prev,
      [itemId]: {
        actualQuantity: prev[itemId]?.actualQuantity ?? 0,
        discrepancyReason: prev[itemId]?.discrepancyReason ?? '',
        [field]: value,
      },
    }));
  };

  const handleSignedDocumentChange = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file hình ảnh');
      return;
    }

    const compressedFile = await compressImageForUpload(file);
    const preview = URL.createObjectURL(compressedFile);
    const formData = new FormData();
    formData.append('file', compressedFile);
    const uploadRes = await api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    setSignedDocument({
      name: file.name,
      preview,
      url: uploadRes.data.url,
    });
  };

  const handleConfirmSubmit = async () => {
    if (!selectedRecord) return;

    try {
      setIsSubmittingConfirmation(true);

      const items = selectedRecord.items.map((item) => {
        const formValue = confirmForm[item.id] ?? {
          actualQuantity: item.actualQuantity || item.systemQuantity,
          discrepancyReason: item.discrepancyReason || '',
        };

        return {
          itemId: item.id,
          actualQuantity: Number(formValue.actualQuantity) || 0,
          discrepancyReason: formValue.discrepancyReason.trim() || undefined,
          evidenceUrl: signedDocument?.url || undefined,
        };
      });

      await api.patch(`/stocktaking/${selectedRecord.id}/submit`, { items });
      setShowConfirmModal(false);
      setSignedDocument(null);
      await fetchRecords();
      await openDetail(selectedRecord.id);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể xác nhận số liệu kiểm kê');
    } finally {
      setIsSubmittingConfirmation(false);
    }
  };

  const handleAdjustmentSubmit = async () => {
    try {
      await api.post('/inventory/adjust', {
        productId: adjustmentForm.productId,
        warehousePositionId: adjustmentForm.warehousePositionId || undefined,
        quantity: Number(adjustmentForm.quantity),
        type: adjustmentForm.type,
        reason: adjustmentForm.reason,
      });

      setShowAdjustmentModal(false);
      setAdjustmentForm({
        productId: '',
        warehousePositionId: '',
        quantity: 1,
        type: 'DECREASE',
        reason: '',
      });

      await fetchRecords();
      if (selectedRecord) {
        await openDetail(selectedRecord.id);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể điều chỉnh tồn kho từ biên bản kiểm kê');
    }
  };

  const handlePrint = (record: StocktakingRecord) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Biên bản kiểm kê - ${record.id}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #111827; }
          .wrap { max-width: 920px; margin: 0 auto; }
          .head { display: grid; grid-template-columns: 1fr 280px; gap: 24px; }
          .title { font-size: 28px; font-weight: 800; text-transform: uppercase; margin: 0; }
          .sub { font-size: 16px; margin-top: 6px; color: #334155; }
          .right { text-align: right; }
          .line { border-top: 3px solid #111827; margin: 26px 0; }
          .meta { display: grid; grid-template-columns: 1fr 320px; gap: 24px; margin-bottom: 28px; }
          .meta-left p { margin: 0 0 12px; font-size: 16px; }
          .meta-note { text-align: right; font-size: 15px; color: #6b7280; font-style: italic; }
          table { width: 100%; border-collapse: collapse; font-size: 15px; }
          th, td { border: 1px solid #475569; padding: 12px; }
          th { background: #f1f5f9; text-align: left; }
          td.center, th.center { text-align: center; }
          .sign { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; text-align: center; margin-top: 72px; }
          .sign-space { height: 88px; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="head">
            <div>
              <div class="title">${generalSettings.brandName || generalSettings.storeName}</div>
              <div class="sub">Địa chỉ: ${generalSettings.address || '-'}</div>
              <div class="sub">Điện thoại: ${generalSettings.phone || '-'}</div>
            </div>
            <div class="right">
              <div class="title">Biên bản kiểm kê</div>
              <div class="sub">${formatAuditCode(record)}</div>
            </div>
          </div>

          <div class="line"></div>

          <div class="meta">
            <div class="meta-left">
              <p><strong>Ngày tạo:</strong> ${formatDateTime(record.createdAt)}</p>
              <p><strong>Thời gian Cut-off:</strong> ${formatDateTime(record.cutoffTime)}</p>
              <p><strong>Nhân viên:</strong> ${record.creator?.name || '-'}</p>
            </div>
            <div class="meta-note">* Dữ liệu tồn kho được chốt tại thời điểm Cut-off.</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>STT</th>
                <th>SKU</th>
                <th>Tên sản phẩm</th>
                <th class="center">Tồn hệ thống</th>
                <th class="center">Tồn thực tế</th>
                <th class="center">Chênh lệch</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              ${record.items
                .map((item, index) => {
                  const actualValue = item.actualQuantity === 0 ? '........' : String(item.actualQuantity);
                  const discrepancyValue = item.actualQuantity === 0 ? '........' : `${item.discrepancy > 0 ? '+' : ''}${item.discrepancy}`;
                  const noteValue = item.discrepancyReason || '....................';
                  return `
                    <tr>
                      <td class="center">${index + 1}</td>
                      <td><strong>${item.product?.sku || '-'}</strong></td>
                      <td>${item.product?.name || '-'}</td>
                      <td class="center"><strong>${item.systemQuantity}</strong></td>
                      <td class="center">${actualValue}</td>
                      <td class="center">${discrepancyValue}</td>
                      <td>${noteValue}</td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>

          <div class="sign">
            <div>
              <div><strong>Người lập biểu</strong></div>
              <div class="sign-space"></div>
              <div>(Ký, họ tên)</div>
            </div>
            <div>
              <div><strong>Nhân viên kiểm kê</strong></div>
              <div class="sign-space"></div>
              <div>(Ký, họ tên)</div>
            </div>
            <div>
              <div><strong>Quản lý kho</strong></div>
              <div class="sign-space"></div>
              <div>(Ký, họ tên)</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleExportExcel = (record: StocktakingRecord) => {
    const exportData = record.items.map((item, index) => ({
      STT: index + 1,
      SKU: item.product?.sku || '-',
      'Tên sản phẩm': item.product?.name || '-',
      'Tồn hệ thống': item.systemQuantity,
      'Tồn thực tế': item.actualQuantity === 0 ? '' : item.actualQuantity,
      'Chênh lệch': item.actualQuantity === 0 ? '' : item.discrepancy,
      'Ghi chú': item.discrepancyReason || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bien ban kiem ke');
    XLSX.writeFile(wb, `bien-ban-kiem-ke-${record.id}.xlsx`);
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-[20px] font-semibold text-slate-950 sm:text-[22px]">Kiểm kê định kỳ</h2>
            <p className="text-[15px] text-slate-500 sm:text-[17px]">Quản lý biên bản kiểm kê, đối soát tồn kho thực tế và hệ thống.</p>
          </div>

          <Button className="h-10 rounded-2xl bg-violet-600 px-4 hover:bg-violet-700 sm:h-11 sm:px-5" onClick={() => setShowCreateModal(true)}>
            <Plus size={17} />
            Tạo biên bản kiểm kê
          </Button>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <Card className="rounded-[22px] border border-slate-200 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="mb-5 flex items-center gap-3">
                <History size={18} className="text-slate-400" />
                <h3 className="text-[18px] font-semibold text-slate-950 sm:text-[20px]">Lịch sử & Danh sách kiểm kê</h3>
              </div>

              {isLoading ? (
                <div className="flex h-64 items-center justify-center">
                  <div className="spinner" />
                </div>
              ) : records.length > 0 ? (
                <div className="space-y-4">
                  {records.map((record) => (
                    <div key={record.id} className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-slate-100 bg-white px-4 py-4 shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                          record.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' :
                          record.status === 'PENDING' ? 'bg-amber-50 text-amber-600' :
                          record.status === 'REJECTED' ? 'bg-rose-50 text-rose-600' :
                          'bg-blue-50 text-blue-600'
                        }`}>
                          {record.status === 'APPROVED' ? <CheckCircle2 size={19} /> : <Clock3 size={19} />}
                        </div>

                        <div>
                          <div className="text-[16px] font-semibold text-slate-950 sm:text-[17px]">{record.id}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-slate-500 sm:text-[14px]">
                            <span>Xuất: {formatDateTime(record.createdAt)}</span>
                            <span>|</span>
                            <span className={STATUS_TEXT_COLORS[record.status]}>
                              {STATUS_LABELS[record.status]}: {formatDateTime(record.status === 'APPROVED' && record.submittedAt ? record.submittedAt : record.cutoffTime)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {record.status === 'CHECKING' ? (
                          <Button
                            className="h-10 rounded-2xl bg-violet-600 px-4 text-white shadow-sm hover:bg-violet-700"
                            onClick={() => openConfirmation(record)}
                          >
                            <Check size={16} />
                            Xác nhận kiểm kê
                          </Button>
                        ) : (
                          <Button variant="outline" className="h-10 rounded-2xl border-slate-300 px-4 shadow-sm" onClick={() => openDetail(record.id)}>
                            <Eye size={16} />
                            Chi tiết
                          </Button>
                        )}
                        <button
                          type="button"
                          className="rounded-xl p-2.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          onClick={() => handlePrint(record)}
                          aria-label="In biên bản"
                        >
                          <Printer size={17} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center text-slate-500">Chưa có biên bản kiểm kê nào.</div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-5">
            <div className="rounded-[22px] bg-gradient-to-br from-violet-700 via-violet-600 to-indigo-500 p-5 text-white shadow-[0_18px_40px_rgba(79,70,229,0.24)]">
              <div className="mb-3 flex items-center gap-3 text-[17px] font-semibold">
                <ShieldAlert size={18} />
                <span>Lưu ý Cut-off</span>
              </div>
              <p className="text-[15px] leading-7 text-white/90">
                Thời gian Cut-off là thời điểm hệ thống chốt số tồn để đối soát. Mọi giao dịch sau thời điểm này sẽ không
                được tính vào biên bản hiện tại.
              </p>
            </div>

            <Card className="rounded-[22px] border border-slate-200 shadow-sm">
              <CardContent className="space-y-4 p-5">
                <h3 className="text-[18px] font-semibold text-slate-950">Thống kê chênh lệch</h3>

                <div className="rounded-[18px] border border-rose-100 bg-rose-50 px-5 py-4">
                  <div className="text-[12px] font-semibold uppercase tracking-wide text-rose-500">Tổng chênh lệch (tháng này)</div>
                  <div className="mt-2 text-[20px] font-semibold text-rose-600">
                    -{formatNumber(discrepancyStats.totalDiscrepancy)} <span className="text-[15px] font-medium">sản phẩm</span>
                  </div>
                </div>

                <div className="rounded-[18px] border border-emerald-100 bg-emerald-50 px-5 py-4">
                  <div className="text-[12px] font-semibold uppercase tracking-wide text-emerald-500">Tỷ lệ khớp kho</div>
                  <div className="mt-2 text-[20px] font-semibold text-emerald-600">
                    {discrepancyStats.matchRate.toFixed(1)}%
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-[720px] overflow-hidden rounded-[24px] p-0">
          <DialogHeader className="border-b border-slate-200 px-5 py-4">
            <DialogTitle className="text-[18px] font-semibold text-slate-950">Tạo biên bản kiểm kê mới</DialogTitle>
            <p className="mt-1.5 text-[14px] text-slate-500">Chọn phạm vi kiểm kê để hệ thống chốt số liệu tồn kho (Cut-off).</p>
          </DialogHeader>

          <div className="space-y-5 px-5 py-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Ngày Cut-off</Label>
                <Input type="date" value={cutoffDate} onChange={(e) => setCutoffDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Giờ Cut-off</Label>
                <Input type="time" value={cutoffTime} onChange={(e) => setCutoffTime(e.target.value)} />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-[16px] font-semibold text-slate-950">Phạm vi kiểm kê</Label>
              <div className="grid gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setCreateMode('full')}
                  className={`rounded-[20px] border px-5 py-5 text-left transition ${
                    createMode === 'full' ? 'border-violet-500 bg-violet-50 shadow-[0_0_0_1px_rgba(99,102,241,0.15)]' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className={`mb-4 h-5 w-5 rounded-full border-2 ${createMode === 'full' ? 'border-violet-500 bg-white' : 'border-slate-300'}`} />
                  <div className="text-[17px] font-semibold text-slate-950">Kiểm tra toàn bộ</div>
                  <div className="mt-2 text-[14px] text-slate-500">Tất cả sản phẩm trong kho</div>
                </button>

                <button
                  type="button"
                  onClick={() => setCreateMode('selected')}
                  className={`rounded-[20px] border px-5 py-5 text-left transition ${
                    createMode === 'selected' ? 'border-violet-500 bg-violet-50 shadow-[0_0_0_1px_rgba(99,102,241,0.15)]' : 'border-slate-200 bg-white'
                  }`}
                >
                  <Search size={24} className={createMode === 'selected' ? 'text-violet-600' : 'text-slate-400'} />
                  <div className="mt-3 text-[17px] font-semibold text-slate-950">Chọn danh sách SKU</div>
                  <div className="mt-2 text-[14px] text-slate-500">Chỉ kiểm các mã được chọn</div>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-[16px] font-semibold text-slate-950">Danh sách SKU ({selectedCount} đã chọn)</Label>
                {createMode === 'selected' && (
                  <div className="relative w-full max-w-[300px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      className="h-9 rounded-2xl pl-10"
                      placeholder="Tìm theo SKU hoặc tên sản phẩm..."
                      value={skuSearch}
                      onChange={(e) => setSkuSearch(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className={`max-h-[260px] overflow-y-auto rounded-[18px] border border-slate-200 ${createMode === 'full' ? 'opacity-60' : ''}`}>
                <div className="space-y-1 p-3">
                  {filteredProducts.map((product) => {
                    const checked = selectedProductIds.includes(product.id);
                    return (
                      <label key={product.id} className="flex cursor-pointer items-center gap-4 rounded-2xl px-4 py-3 transition hover:bg-slate-50">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
                          checked={createMode === 'full' ? false : checked}
                          disabled={createMode === 'full'}
                          onChange={() => toggleProductSelection(product.id)}
                        />
                        <span className="text-[15px] text-slate-900 sm:text-[16px]">
                          {product.sku} - {product.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] leading-6 text-amber-700">
              Hệ thống sẽ ghi nhận tồn kho tại thời điểm nhấn nút "Khởi tạo". Mọi thay đổi sau đó sẽ được đối soát dựa trên
              mốc thời gian này.
            </div>
          </div>

          <DialogFooter className="border-t border-slate-200 px-5 py-4">
            <Button variant="outline" className="h-10 rounded-2xl px-4" onClick={() => setShowCreateModal(false)}>
              Hủy
            </Button>
            <Button
              className="h-10 rounded-2xl bg-violet-600 px-4 hover:bg-violet-700"
              onClick={handleCreate}
              disabled={createMode === 'selected' && selectedProductIds.length === 0}
            >
              Khởi tạo & Xuất biên bản
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showConfirmModal}
        onOpenChange={(open) => {
          setShowConfirmModal(open);
          if (!open) {
            setSignedDocument(null);
          }
        }}
      >
        <DialogContent className="max-w-[1180px] rounded-[28px] p-0 sm:max-h-[92vh] sm:overflow-hidden">
          <DialogHeader className="border-b border-slate-200 px-5 py-5 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-[28px] font-semibold leading-tight text-slate-950">
                  Xac nhan so lieu kiem ke thuc te
                </DialogTitle>
                <p className="mt-3 text-[16px] text-slate-500 sm:text-[18px]">
                  Nhap so luong thuc te dem duoc va giai trinh chenh lech (neu co).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Dong popup xac nhan"
              >
                <X size={28} />
              </button>
            </div>
          </DialogHeader>

          {selectedRecord && (
            <>
              <div className="space-y-8 overflow-y-auto px-5 py-5 sm:max-h-[calc(92vh-150px)] sm:px-6">
                <div className="grid gap-4 rounded-[24px] border border-slate-200 bg-slate-50 p-5 md:grid-cols-2 md:p-8">
                  <div>
                    <div className="text-[14px] font-semibold uppercase tracking-wide text-slate-400">Ma bien ban</div>
                    <div className="mt-2 text-[24px] font-semibold text-slate-950 sm:text-[28px]">
                      {formatAuditCode(selectedRecord)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[14px] font-semibold uppercase tracking-wide text-slate-400">Thoi gian Cut-off</div>
                    <div className="mt-2 text-[24px] font-semibold text-slate-950 sm:text-[28px]">
                      {formatDateTime(selectedRecord.cutoffTime)}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="hidden grid-cols-[minmax(260px,1.7fr)_140px_240px_minmax(220px,1.4fr)] gap-4 px-4 text-[13px] font-semibold uppercase tracking-wide text-slate-400 lg:grid">
                    <div>San pham / SKU</div>
                    <div className="text-center">He thong</div>
                    <div className="text-center">Thuc te</div>
                    <div>Nguyen nhan chenh lech</div>
                  </div>

                  <div className="space-y-3">
                    {selectedRecord.items.map((item) => {
                      const formValue = confirmForm[item.id] ?? {
                        actualQuantity: item.actualQuantity || item.systemQuantity,
                        discrepancyReason: item.discrepancyReason || '',
                      };
                      const discrepancy = formValue.actualQuantity - item.systemQuantity;

                      return (
                        <div
                          key={item.id}
                          className="grid gap-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(220px,1.5fr)_120px_220px_minmax(220px,1.3fr)_140px] lg:items-center"
                        >
                          <div>
                            <div className="text-[18px] font-semibold text-slate-950">{item.product?.sku || '-'}</div>
                            <div className="mt-1 text-[14px] text-slate-500 sm:text-[15px]">{item.product?.name || '-'}</div>
                          </div>

                          <div className="flex items-center justify-between text-[16px] text-slate-500 lg:block lg:text-center">
                            <span className="font-semibold uppercase tracking-wide text-slate-400 lg:hidden">He thong</span>
                            <span className="text-[20px] font-medium text-slate-950">{formatNumber(item.systemQuantity)}</span>
                          </div>

                          <div className="flex items-center justify-between gap-3 lg:block">
                            <span className="font-semibold uppercase tracking-wide text-slate-400 lg:hidden">Thuc te</span>
                            <div className="lg:mx-auto lg:max-w-[240px]">
                              <Input
                                type="number"
                                min={0}
                                value={formValue.actualQuantity}
                                onChange={(e) => updateConfirmItem(item.id, 'actualQuantity', Number(e.target.value))}
                                className="h-16 rounded-[24px] border-slate-300 px-6 text-center text-[22px] font-semibold text-slate-950 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.04)]"
                              />
                              <div className={`mt-2 text-center text-[13px] font-medium ${discrepancy === 0 ? 'text-slate-400' : discrepancy > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {discrepancy === 0 ? 'Khong chenh lech' : `${discrepancy > 0 ? '+' : ''}${formatNumber(discrepancy)} so voi he thong`}
                              </div>
                            </div>
                          </div>

                          <div>
                            <div className="mb-2 font-semibold uppercase tracking-wide text-slate-400 lg:hidden">Nguyen nhan chenh lech</div>
                            <Input
                              value={formValue.discrepancyReason}
                              onChange={(e) => updateConfirmItem(item.id, 'discrepancyReason', e.target.value)}
                              placeholder="Nhap ly do..."
                              className="h-16 rounded-[24px] border-slate-300 px-5 text-[16px]"
                            />
                          </div>

                          <div className="flex justify-end lg:justify-center">
                            <Button type="button" variant="outline" className="h-11 rounded-2xl px-4" onClick={() => openAdjustment(item)}>
                              <RefreshCcw size={16} />
                              Điều chỉnh
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="text-[18px] font-semibold text-slate-950 sm:text-[20px]">
                    Hinh anh bien ban giay (Da ky xac nhan)
                  </div>

                  <label className="flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-[28px] border-2 border-dashed border-slate-200 bg-white px-6 py-10 text-center transition hover:border-violet-300 hover:bg-violet-50/40">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleSignedDocumentChange(e.target.files?.[0])}
                    />

                    {signedDocument?.preview ? (
                      <div className="space-y-4">
                        <div className="mx-auto h-24 w-24 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                          <img src={signedDocument.preview} alt={signedDocument.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="text-[18px] font-medium text-slate-700">{signedDocument.name}</div>
                        <div className="text-[15px] text-slate-400">Nhan de thay doi hoac keo tha anh khac</div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <Upload size={34} />
                        </div>
                        <div className="text-[15px] text-slate-400 sm:text-[16px]">
                          Nhan de tai len hoac keo tha anh bien ban
                        </div>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <DialogFooter className="border-t border-slate-200 px-5 py-4 sm:px-6">
                <Button variant="outline" className="h-12 rounded-[20px] px-6 text-[16px]" onClick={() => setShowConfirmModal(false)}>
                  Huy
                </Button>
                <Button
                  className="h-12 rounded-[20px] bg-violet-600 px-6 text-[16px] hover:bg-violet-700"
                  onClick={handleConfirmSubmit}
                  disabled={isSubmittingConfirmation}
                >
                  <Check size={18} />
                  Hoan thanh & Ghi so
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showAdjustmentModal} onOpenChange={setShowAdjustmentModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCcw size={18} />
              Điều chỉnh tồn kho từ kiểm kê
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Sản phẩm</Label>
              <select
                className="form-select"
                value={adjustmentForm.productId}
                onChange={(e) => setAdjustmentForm((prev) => ({ ...prev, productId: e.target.value }))}
              >
                <option value="">Chọn sản phẩm</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} - {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Vị trí</Label>
                <select
                  className="form-select"
                  value={adjustmentForm.warehousePositionId}
                  onChange={(e) => setAdjustmentForm((prev) => ({ ...prev, warehousePositionId: e.target.value }))}
                >
                  <option value="">Chọn vị trí</option>
                  {positions.map((position) => (
                    <option key={position.id} value={position.id}>
                      {position.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Loại điều chỉnh</Label>
                <select
                  className="form-select"
                  value={adjustmentForm.type}
                  onChange={(e) => setAdjustmentForm((prev) => ({ ...prev, type: e.target.value as 'INCREASE' | 'DECREASE' }))}
                >
                  <option value="INCREASE">Tăng tồn</option>
                  <option value="DECREASE">Giảm tồn</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Số lượng điều chỉnh</Label>
              <Input
                type="number"
                min={1}
                value={adjustmentForm.quantity}
                onChange={(e) => setAdjustmentForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Lý do điều chỉnh</Label>
              <textarea
                className="form-control min-h-[96px] py-3"
                value={adjustmentForm.reason}
                onChange={(e) => setAdjustmentForm((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="Nhập lý do điều chỉnh"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowAdjustmentModal(false)}>
              Hủy
            </Button>
            <Button
              type="button"
              onClick={handleAdjustmentSubmit}
              disabled={!adjustmentForm.productId || !adjustmentForm.quantity || !adjustmentForm.reason.trim()}
            >
              <RefreshCcw size={16} />
              Xác nhận điều chỉnh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-[1100px] rounded-[24px] p-0">
          <DialogHeader className="border-b border-slate-200 px-5 py-4">
            <DialogTitle className="text-[18px] font-semibold text-slate-950">Biên bản kiểm kê kho hàng</DialogTitle>
          </DialogHeader>

          {selectedRecord && (
            <div className="px-6 py-6">
              <div className="mx-auto w-full max-w-[900px] rounded-[10px] border border-slate-200 bg-white px-10 py-8 shadow-sm">
                <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
                  <div>
                    <div className="text-[22px] font-bold uppercase text-slate-950">{generalSettings.brandName || generalSettings.storeName}</div>
                    <div className="mt-1 text-[15px] text-slate-700">Địa chỉ: {generalSettings.address || '-'}</div>
                    <div className="text-[15px] text-slate-700">Điện thoại: {generalSettings.phone || '-'}</div>
                  </div>

                  <div className="text-right">
                    <div className="text-[22px] font-bold uppercase text-slate-950">Biên bản kiểm kê</div>
                    <div className="mt-1 text-[15px] text-slate-700">{formatAuditCode(selectedRecord)}</div>
                  </div>
                </div>

                <div className="my-6 border-t-2 border-slate-900" />

                <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-3 text-[16px] text-slate-900">
                    <div><span className="font-semibold">Ngày tạo:</span> {formatDateTime(selectedRecord.createdAt)}</div>
                    <div><span className="font-semibold">Thời gian Cut-off:</span> {formatDateTime(selectedRecord.cutoffTime)}</div>
                    <div><span className="font-semibold">Nhân viên:</span> {selectedRecord.creator?.name || '-'}</div>
                  </div>

                  <div className="text-right text-[15px] italic text-slate-500">
                    * Dữ liệu tồn kho được chốt tại thời điểm Cut-off.
                  </div>
                </div>

                <div className="mt-8 overflow-x-auto">
                  <table className="w-full border-collapse text-[15px] text-slate-900">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-slate-500 px-3 py-3 text-left font-semibold">STT</th>
                        <th className="border border-slate-500 px-3 py-3 text-left font-semibold">SKU</th>
                        <th className="border border-slate-500 px-3 py-3 text-left font-semibold">Tên sản phẩm</th>
                        <th className="border border-slate-500 px-3 py-3 text-center font-semibold">Tồn hệ thống</th>
                        <th className="border border-slate-500 px-3 py-3 text-center font-semibold">Tồn thực tế</th>
                        <th className="border border-slate-500 px-3 py-3 text-center font-semibold">Chênh lệch</th>
                        <th className="border border-slate-500 px-3 py-3 text-left font-semibold">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRecord.items.map((item, index) => {
                        const actualDisplay = item.actualQuantity === 0 ? '........' : formatNumber(item.actualQuantity);
                        const discrepancyDisplay = item.actualQuantity === 0 ? '........' : `${item.discrepancy > 0 ? '+' : ''}${formatNumber(item.discrepancy)}`;
                        const noteDisplay = item.discrepancyReason || '....................';

                        return (
                          <tr key={item.id}>
                            <td className="border border-slate-500 px-3 py-3 text-center">{index + 1}</td>
                            <td className="border border-slate-500 px-3 py-3 font-semibold">{item.product?.sku || '-'}</td>
                            <td className="border border-slate-500 px-3 py-3">{item.product?.name || '-'}</td>
                            <td className="border border-slate-500 px-3 py-3 text-center font-semibold">{formatNumber(item.systemQuantity)}</td>
                            <td className="border border-slate-500 px-3 py-3 text-center">{actualDisplay}</td>
                            <td className="border border-slate-500 px-3 py-3 text-center">{discrepancyDisplay}</td>
                            <td className="border border-slate-500 px-3 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <span>{noteDisplay}</span>
                                <Button type="button" variant="outline" className="h-9 rounded-xl px-3" onClick={() => openAdjustment(item)}>
                                  <RefreshCcw size={14} />
                                  Điều chỉnh
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-20 grid grid-cols-3 gap-6 text-center text-slate-900">
                  <div>
                    <div className="text-[18px] font-semibold">Người lập biểu</div>
                    <div className="h-20" />
                    <div className="text-[15px]">(Ký, họ tên)</div>
                  </div>
                  <div>
                    <div className="text-[18px] font-semibold">Nhân viên kiểm kê</div>
                    <div className="h-20" />
                    <div className="text-[15px]">(Ký, họ tên)</div>
                  </div>
                  <div>
                    <div className="text-[18px] font-semibold">Quản lý kho</div>
                    <div className="h-20" />
                    <div className="text-[15px]">(Ký, họ tên)</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="border-t border-slate-200 px-5 py-4">
            <Button variant="outline" className="h-10 rounded-2xl px-4" onClick={() => setShowDetailModal(false)}>
              Đóng
            </Button>
            {selectedRecord && (
              <>
                {selectedRecord.status === 'CHECKING' && (
                  <Button
                    variant="outline"
                    className="h-10 rounded-2xl border-violet-200 px-4 text-violet-700 hover:bg-violet-50"
                    onClick={() => openConfirmation(selectedRecord)}
                  >
                    <Check size={16} />
                    Xac nhan kiem ke
                  </Button>
                )}
                <Button variant="outline" className="h-10 rounded-2xl px-4" onClick={() => handleExportExcel(selectedRecord)}>
                  Excel
                </Button>
                <Button className="h-10 rounded-2xl bg-violet-600 px-4 hover:bg-violet-700" onClick={() => handlePrint(selectedRecord)}>
                  <Printer size={16} />
                  In biên bản (Chọn máy in)
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
