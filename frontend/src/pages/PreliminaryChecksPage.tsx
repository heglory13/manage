import { useCallback, useEffect, useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { api } from '../services/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { compressImageForUpload } from '../lib/image';
import { formatNumber } from '../lib/utils';

type AttributeOption = {
  id: string;
  name: string;
};

type PreliminaryCheckStatus = 'PENDING' | 'COMPLETED';

type PreliminaryCheckRow = {
  id: string;
  quantity: number;
  status: PreliminaryCheckStatus;
  imageUrl?: string | null;
  note?: string | null;
  createdAt: string;
  classification: AttributeOption;
  warehouseType?: AttributeOption | null;
  creator: { id: string; name: string; email: string };
};

type PreliminaryCheckForm = {
  classificationId: string;
  quantity: number;
  warehouseTypeId: string;
  imageFile: File | null;
  imagePreview: string;
  note: string;
};

const defaultPreliminaryForm = (): PreliminaryCheckForm => ({
  classificationId: '',
  quantity: 1,
  warehouseTypeId: '',
  imageFile: null,
  imagePreview: '',
  note: '',
});

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function PreliminaryChecksPage() {
  const [classifications, setClassifications] = useState<AttributeOption[]>([]);
  const [warehouseTypes, setWarehouseTypes] = useState<AttributeOption[]>([]);
  const [rows, setRows] = useState<PreliminaryCheckRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState<PreliminaryCheckForm>(defaultPreliminaryForm);

  const fetchMetadata = useCallback(async () => {
    const res = await api.get('/input-declarations/all');
    setClassifications(res.data.classifications || []);
    setWarehouseTypes(res.data.warehouseTypes || []);
  }, []);

  const fetchRows = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/preliminary-checks', { params: { limit: 100 } });
      setRows(res.data.data || []);
    } catch (error) {
      console.error('Error fetching preliminary checks:', error);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMetadata();
    void fetchRows();
  }, [fetchMetadata, fetchRows]);

  const handleImageSelect = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file hình ảnh.');
      return;
    }

    const preview = URL.createObjectURL(file);
    setForm((prev) => ({
      ...prev,
      imageFile: file,
      imagePreview: preview,
    }));
  };

  const submit = async (keepOpen = false) => {
    try {
      const payload: Record<string, unknown> = {
        classificationId: form.classificationId,
        quantity: Number(form.quantity),
        warehouseTypeId: form.warehouseTypeId || undefined,
        note: form.note || undefined,
      };

      if (form.imageFile) {
        const body = new FormData();
        body.append('file', await compressImageForUpload(form.imageFile));
        const uploadRes = await api.post('/upload', body, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        payload.imageUrl = uploadRes.data.url;
      }

      await api.post('/preliminary-checks', payload);
      if (!keepOpen) {
        setShowCreateModal(false);
      }
      setForm(defaultPreliminaryForm());
      await fetchRows();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Không thể tạo phiếu kiểm sơ bộ.');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-[22px] font-semibold text-slate-950">Nhập kiểm sơ bộ</h2>
            <p className="mt-1 text-[15px] text-slate-500">
              Ghi nhận nhanh số lượng hàng nhận và loại kho trước khi thủ kho kiểm tra chi tiết.
            </p>
          </div>

          <Button className="h-11 rounded-2xl bg-violet-600 px-5 hover:bg-violet-700" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} />
            Tạo phiếu kiểm sơ bộ
          </Button>
        </div>

        <Card className="overflow-hidden rounded-[24px] border border-slate-200 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="spinner" />
              </div>
            ) : (
              <Table className="border-none">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">Ngày tạo</TableHead>
                    <TableHead>Phân loại hàng</TableHead>
                    <TableHead>Loại kho</TableHead>
                    <TableHead className="text-right">Số lượng nhận</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Người tạo</TableHead>
                    <TableHead>Ghi chú</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((item) => (
                    <TableRow key={item.id} className="h-[72px]">
                      <TableCell className="pl-4 text-[15px] text-slate-600">{formatDateTime(item.createdAt)}</TableCell>
                      <TableCell className="font-medium text-slate-900">{item.classification?.name || '-'}</TableCell>
                      <TableCell className="text-slate-600">{item.warehouseType?.name || '-'}</TableCell>
                      <TableCell className="text-right text-[18px] font-semibold text-slate-900">{formatNumber(item.quantity)}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                            item.status === 'PENDING'
                              ? 'border border-amber-200 bg-amber-50 text-amber-600'
                              : 'border border-emerald-200 bg-emerald-50 text-emerald-600'
                          }`}
                        >
                          {item.status === 'PENDING' ? 'Chờ kiểm tra chi tiết' : 'Đã kiểm tra chi tiết'}
                        </span>
                      </TableCell>
                      <TableCell className="text-[15px] text-slate-600">{item.creator?.name || '-'}</TableCell>
                      <TableCell className="text-[15px] italic text-slate-500">{item.note || '-'}</TableCell>
                    </TableRow>
                  ))}

                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-14 text-center text-slate-500">
                        Chưa có phiếu kiểm sơ bộ nào.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus size={18} />
              Nhập kiểm sơ bộ
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Phân loại hàng hóa nhận</Label>
              <select className="form-select" value={form.classificationId} onChange={(e) => setForm((prev) => ({ ...prev, classificationId: e.target.value }))}>
                <option value="">Chọn phân loại</option>
                {classifications.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Số lượng nhận</Label>
              <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))} />
            </div>

            <div className="space-y-2">
              <Label>Loại kho chứa</Label>
              <select className="form-select" value={form.warehouseTypeId} onChange={(e) => setForm((prev) => ({ ...prev, warehouseTypeId: e.target.value }))}>
                <option value="">Chọn loại kho</option>
                {warehouseTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Hình ảnh sản phẩm đã nhận</Label>
              <label className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 px-6 py-8 text-center">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageSelect(e.target.files?.[0])} />
                {form.imagePreview ? (
                  <img src={form.imagePreview} alt="preview" className="max-h-[160px] rounded-xl object-contain" />
                ) : (
                  <>
                    <Upload size={28} className="text-slate-400" />
                    <p className="mt-3 text-sm text-slate-500">Nhấn để tải lên hình ảnh sản phẩm đã nhận</p>
                  </>
                )}
              </label>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Ghi chú khác</Label>
              <textarea className="form-control min-h-[96px] py-3" value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} placeholder="Nhập ghi chú tùy ý" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
              Hủy
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => submit(true)}
              disabled={!form.classificationId || !form.quantity || !form.warehouseTypeId}
            >
              Thêm dòng
            </Button>
            <Button type="button" onClick={() => submit(false)} disabled={!form.classificationId || !form.quantity || !form.warehouseTypeId}>
              Tạo phiếu sơ bộ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
