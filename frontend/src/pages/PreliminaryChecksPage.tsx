import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Pencil, Plus, Trash2, Upload } from 'lucide-react';
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
import SmartFilter, { type FilterField } from '../components/common/SmartFilter';
import { useSavedFilters } from '../hooks/useSavedFilters';
import { SearchableSelect } from '../components/ui/searchable-select';

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
  category?: AttributeOption | null;
  classification?: AttributeOption | null;
  warehouseType?: AttributeOption | null;
  creator: { id: string; name: string; email: string };
};

type PreliminaryCheckForm = {
  categoryId: string;
  quantity: number;
  warehouseTypeId: string;
  imageFile: File | null;
  imagePreview: string;
  note: string;
};

const defaultPreliminaryForm = (): PreliminaryCheckForm => ({
  categoryId: '',
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
  const [categories, setCategories] = useState<AttributeOption[]>([]);
  const [warehouseTypes, setWarehouseTypes] = useState<AttributeOption[]>([]);
  const [rows, setRows] = useState<PreliminaryCheckRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [editingRow, setEditingRow] = useState<PreliminaryCheckRow | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<PreliminaryCheckForm>(defaultPreliminaryForm);

  const isEditing = Boolean(editingRow);

  const savedFilterHook = useSavedFilters({ pageKey: 'preliminary-checks' });

  const filterFields = useMemo<FilterField[]>(() => [
    {
      key: 'status',
      label: 'Trạng thái',
      type: 'select',
      options: [
        { value: 'PENDING', label: 'Cho kiem tra chi tiet' },
        { value: 'COMPLETED', label: 'Da kiem tra chi tiet' },
      ],
    },
    {
      key: 'category',
      label: 'Danh mục SP',
      type: 'select',
      options: categories.map((c) => ({ value: c.id, label: c.name })),
    },
    {
      key: 'quantity',
      label: 'Số lượng',
      type: 'text',
      placeholder: 'Lọc số lượng...',
    },
    {
      key: 'creator',
      label: 'Người tạo',
      type: 'text',
      placeholder: 'Lọc người tạo...',
    },
    {
      key: 'date',
      label: 'Ngày tạo',
      type: 'date',
    },
  ], [categories]);

  const filteredRows = useMemo(() => {
    const f = savedFilterHook.filters;
    if (Object.keys(f).length === 0) return rows;

    return rows.filter((item) => {
      if (f.status && item.status !== f.status) return false;
      if (f.category && item.category?.id !== f.category) return false;
      if (f.quantity && !String(item.quantity).includes(String(f.quantity))) return false;
      if (f.creator && !item.creator?.name?.toLowerCase().includes(String(f.creator).toLowerCase())) return false;
      if (f.date) {
        const itemDate = new Date(item.createdAt).toISOString().slice(0, 10);
        if (itemDate !== f.date) return false;
      }
      return true;
    });
  }, [rows, savedFilterHook.filters]);

  const fetchMetadata = useCallback(async () => {
    const res = await api.get('/input-declarations/all');
    setCategories(res.data.categories || []);
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

  useEffect(() => {
    return () => {
      if (form.imagePreview?.startsWith('blob:')) {
        URL.revokeObjectURL(form.imagePreview);
      }
    };
  }, [form.imagePreview]);

  const resetForm = useCallback(() => {
    setForm(defaultPreliminaryForm());
    setEditingRow(null);
  }, []);

  const statusBadgeClass = useCallback((status: PreliminaryCheckStatus) => {
    return status === 'PENDING'
      ? 'border border-amber-200 bg-amber-50 text-amber-600'
      : 'border border-emerald-200 bg-emerald-50 text-emerald-600';
  }, []);

  const statusLabel = useCallback((status: PreliminaryCheckStatus) => {
    return status === 'PENDING' ? 'Cho kiem tra chi tiet' : 'Da kiem tra chi tiet';
  }, []);

  const getRowCategoryLabel = useCallback((row: PreliminaryCheckRow) => {
    return row.category?.name || row.classification?.name || '-';
  }, []);

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (row: PreliminaryCheckRow) => {
    setEditingRow(row);
    setForm({
      categoryId: row.category?.id || '',
      quantity: row.quantity,
      warehouseTypeId: row.warehouseType?.id || '',
      imageFile: null,
      imagePreview: row.imageUrl || '',
      note: row.note || '',
    });
    setShowCreateModal(true);
  };

  const handleImageSelect = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Vui long chon file hinh anh.');
      return;
    }

    if (form.imagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(form.imagePreview);
    }

    const preview = URL.createObjectURL(file);
    setForm((prev) => ({
      ...prev,
      imageFile: file,
      imagePreview: preview,
    }));
  };

  const canSubmit = useMemo(
    () => Boolean(form.categoryId && form.quantity > 0 && form.warehouseTypeId),
    [form.categoryId, form.quantity, form.warehouseTypeId],
  );

  const submit = async () => {
    if (!canSubmit) return;

    try {
      setIsSubmitting(true);
      const payload: Record<string, unknown> = {
        categoryId: form.categoryId,
        quantity: Number(form.quantity),
        warehouseTypeId: form.warehouseTypeId || undefined,
        note: form.note.trim() || undefined,
      };

      if (form.imageFile) {
        const body = new FormData();
        body.append('file', await compressImageForUpload(form.imageFile));
        const uploadRes = await api.post('/upload', body, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        payload.imageUrl = uploadRes.data.url;
      } else if (editingRow?.imageUrl) {
        payload.imageUrl = editingRow.imageUrl;
      }

      if (editingRow) {
        await api.patch(`/preliminary-checks/${editingRow.id}`, payload);
      } else {
        await api.post('/preliminary-checks', payload);
      }

      setShowCreateModal(false);
      resetForm();
      await fetchRows();
    } catch (error: any) {
      alert(error.response?.data?.message || (editingRow ? 'Khong the cap nhat phieu kiem so bo.' : 'Khong the tao phieu kiem so bo.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (row: PreliminaryCheckRow) => {
    if (!window.confirm(`Xoa phieu kiem so bo tao luc ${formatDateTime(row.createdAt)}?`)) {
      return;
    }

    try {
      await api.delete(`/preliminary-checks/${row.id}`);
      await fetchRows();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Khong the xoa phieu kiem so bo.');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-3xl">
            <h2 className="text-[22px] font-semibold text-slate-950">Nhap kiem so bo</h2>
            <p className="mt-1 text-[15px] text-slate-500">
              Ghi nhan tong so luong hang da nhan theo danh muc san pham va loai kho truoc khi chia chi tiet de nhap kho.
            </p>
          </div>

          <Button className="h-11 rounded-2xl bg-violet-600 px-5 hover:bg-violet-700" onClick={openCreateModal}>
            <Plus size={16} />
            Tao phieu kiem so bo
          </Button>
        </div>

        <SmartFilter
          fields={filterFields}
          filters={savedFilterHook.filters}
          savedFilters={savedFilterHook.savedFilters}
          activeFilterId={savedFilterHook.activeFilterId}
          onUpdateFilter={savedFilterHook.updateFilter}
          onRemoveFilter={savedFilterHook.removeFilter}
          onClearFilters={savedFilterHook.clearFilters}
          onApplyFilter={savedFilterHook.applyFilter}
          onSaveFilter={savedFilterHook.saveFilter}
          onDeleteFilter={savedFilterHook.deleteFilter}
        />

        <Card className="overflow-hidden rounded-[24px] border border-slate-200 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="spinner" />
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="py-14 text-center text-slate-500">Chua co phieu kiem so bo nao.</div>
            ) : (
              <>
                <div className="hidden lg:block">
                  <Table className="border-none">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-4">Ngay tao</TableHead>
                        <TableHead>Danh muc SP</TableHead>
                        <TableHead>Loai kho</TableHead>
                        <TableHead className="text-right">So luong</TableHead>
                        <TableHead>Trang thai</TableHead>
                        <TableHead>Hinh anh</TableHead>
                        <TableHead>Ghi chu</TableHead>
                        <TableHead className="text-right pr-4">Thao tac</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.map((item) => (
                        <TableRow key={item.id} className="align-top">
                          <TableCell className="pl-4 text-[15px] text-slate-600">{formatDateTime(item.createdAt)}</TableCell>
                          <TableCell className="font-medium text-slate-900">{getRowCategoryLabel(item)}</TableCell>
                          <TableCell className="text-slate-600">{item.warehouseType?.name || '-'}</TableCell>
                          <TableCell className="text-right text-[18px] font-semibold text-slate-900">{formatNumber(item.quantity)}</TableCell>
                          <TableCell>
                            <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${statusBadgeClass(item.status)}`}>
                              {statusLabel(item.status)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {item.imageUrl ? (
                              <button className="text-sm font-medium text-violet-700 hover:text-violet-800" onClick={() => setPreviewImageUrl(item.imageUrl || '')}>
                                Xem hinh
                              </button>
                            ) : (
                              <span className="text-sm text-slate-400">Khong co</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[280px] text-[15px] text-slate-500 whitespace-normal break-words">{item.note || '-'}</TableCell>
                          <TableCell className="pr-4">
                            <div className="flex justify-end gap-2">
                              {item.imageUrl && (
                                <Button variant="outline" size="sm" onClick={() => setPreviewImageUrl(item.imageUrl || '')}>
                                  <Eye size={14} />
                                  Xem
                                </Button>
                              )}
                              <Button variant="outline" size="sm" onClick={() => openEditModal(item)}>
                                <Pencil size={14} />
                                Sua
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleDelete(item)}>
                                <Trash2 size={14} />
                                Xoa
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-3 p-3 lg:hidden">
                  {filteredRows.map((item) => (
                    <div key={item.id} className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm text-slate-500">{formatDateTime(item.createdAt)}</div>
                          <div className="mt-1 text-base font-semibold text-slate-950">{getRowCategoryLabel(item)}</div>
                          <div className="mt-1 text-sm text-slate-500">{item.warehouseType?.name || 'Chua chon loai kho'}</div>
                        </div>
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(item.status)}`}>
                          {statusLabel(item.status)}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-3 sm:grid-cols-2">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-400">So luong</div>
                          <div className="mt-1 text-xl font-semibold text-slate-950">{formatNumber(item.quantity)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-400">Nguoi tao</div>
                          <div className="mt-1 text-sm font-medium text-slate-800">{item.creator?.name || '-'}</div>
                        </div>
                        <div className="sm:col-span-2">
                          <div className="text-xs uppercase tracking-wide text-slate-400">Ghi chu</div>
                          <div className="mt-1 text-sm text-slate-600">{item.note || '-'}</div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {item.imageUrl && (
                          <Button variant="outline" size="sm" onClick={() => setPreviewImageUrl(item.imageUrl || '')}>
                            <Eye size={14} />
                            Xem hinh
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => openEditModal(item)}>
                          <Pencil size={14} />
                          Sua
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(item)}>
                          <Trash2 size={14} />
                          Xoa
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={showCreateModal}
        onOpenChange={(open) => {
          setShowCreateModal(open);
          if (!open) {
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus size={18} />
              {isEditing ? 'Sua phieu kiem so bo' : 'Nhap kiem so bo'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Danh muc san pham da nhan</Label>
              <SearchableSelect
                options={categories.map((item) => ({ value: item.id, label: item.name }))}
                value={form.categoryId}
                onChange={(v) => setForm((prev) => ({ ...prev, categoryId: v }))}
                placeholder="Chon danh muc"
              />
            </div>

            <div className="space-y-2">
              <Label>So luong nhan</Label>
              <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))} />
            </div>

            <div className="space-y-2">
              <Label>Loai kho chua</Label>
              <SearchableSelect
                options={warehouseTypes.map((item) => ({ value: item.id, label: item.name }))}
                value={form.warehouseTypeId}
                onChange={(v) => setForm((prev) => ({ ...prev, warehouseTypeId: v }))}
                placeholder="Chon loai kho"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Hinh anh hang da nhan</Label>
              <label className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageSelect(e.target.files?.[0])} />
                {form.imagePreview ? (
                  <div className="space-y-3">
                    <img src={form.imagePreview} alt="preview" className="mx-auto max-h-[220px] rounded-xl object-contain" />
                    <p className="text-sm text-slate-500">Nhan de doi hinh khac</p>
                  </div>
                ) : (
                  <>
                    <Upload size={28} className="text-slate-400" />
                    <p className="mt-3 text-sm text-slate-500">Nhan de tai len hinh anh da nhan</p>
                  </>
                )}
              </label>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Ghi chu</Label>
              <textarea
                className="form-control min-h-[120px] py-3"
                value={form.note}
                onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Ghi chú thêm các thông tin liên quan khác về hàng hoá đã nhận (Ví dụ như Phí ship đã trả 30.000đ , Hàng khách hoàn trả mẫu kí gửi , Hàng khách kí gửi để in ấn ,...)"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
              Huy
            </Button>
            <Button type="button" onClick={submit} disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? 'Dang luu...' : isEditing ? 'Luu cap nhat' : 'Tao phieu so bo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(previewImageUrl)} onOpenChange={(open) => !open && setPreviewImageUrl('')}>
        <DialogContent className="max-w-4xl p-3 sm:p-5">
          <DialogHeader>
            <DialogTitle>Xem hinh anh da upload</DialogTitle>
          </DialogHeader>
          {previewImageUrl && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2">
              <img src={previewImageUrl} alt="preview" className="max-h-[75vh] w-full rounded-xl object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
