import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AppLayout from '../components/layout/AppLayout';
import { api } from '../services/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { compressImageForUpload } from '../lib/image';
import { formatNumber, matchSel } from '../lib/utils';
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
  imageFiles: File[];
  imagePreviews: string[];   // blob: for new files, real URL for existing
  note: string;
};

const defaultPreliminaryForm = (): PreliminaryCheckForm => ({
  categoryId: '',
  quantity: 1,
  warehouseTypeId: '',
  imageFiles: [],
  imagePreviews: [],
  note: '',
});

function parseImageUrls(imageUrl?: string | null): string[] {
  if (!imageUrl) return [];
  if (imageUrl.startsWith('[')) {
    try { return JSON.parse(imageUrl) as string[]; } catch { return [imageUrl]; }
  }
  return [imageUrl];
}

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
  const { user } = useAuth();
  const canCreate = Boolean(user?.permissions?.preliminaryChecks?.create);
  const canEdit = Boolean(user?.permissions?.preliminaryChecks?.edit);
  const canDelete = Boolean(user?.permissions?.preliminaryChecks?.delete);
  const canSave = Boolean(user?.permissions?.preliminaryChecks?.save);
  const [categories, setCategories] = useState<AttributeOption[]>([]);
  const [warehouseTypes, setWarehouseTypes] = useState<AttributeOption[]>([]);
  const [rows, setRows] = useState<PreliminaryCheckRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pcPage, setPcPage] = useState(1);
  const [pcPageSize, setPcPageSize] = useState(50);
  const [pcTotal, setPcTotal] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [editingRow, setEditingRow] = useState<PreliminaryCheckRow | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<PreliminaryCheckForm>(defaultPreliminaryForm);

  const isEditing = Boolean(editingRow);

  const savedFilterHook = useSavedFilters({ pageKey: 'preliminary-checks' });

  const filterFields = useMemo<FilterField[]>(() => {
    return [
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
      placeholder: 'Gõ để tìm danh mục...',
      asyncLoad: async () => {
        const res = await api.get('/categories');
        const items = res.data.data || res.data || [];
        return items.map((c: any) => ({ value: c.id, label: c.name }));
      },
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
      placeholder: 'Gõ để tìm người tạo...',
      asyncLoad: async () => {
        const res = await api.get('/users');
        const items = res.data.data || res.data || [];
        return items.map((u: any) => ({ value: u.name, label: u.name }));
      },
    },
    {
      key: 'dateFrom',
      label: 'Từ ngày',
      type: 'date',
    },
    {
      key: 'dateTo',
      label: 'Đến ngày',
      type: 'date',
    },
    ];
  }, []);

  const filteredRows = useMemo(() => {
    const f = savedFilterHook.filters;
    if (Object.keys(f).length === 0) return rows;

    return rows.filter((item) => {
      if (!matchSel(f.status, item.status)) return false;
      if (!matchSel(f.category, item.category?.id)) return false;
      if (f.quantity && !String(item.quantity).includes(String(f.quantity))) return false;
      if (f.creator && !item.creator?.name?.toLowerCase().includes(String(f.creator).toLowerCase())) return false;
      if (f.dateFrom) {
        const from = new Date(f.dateFrom as string);
        if (new Date(item.createdAt) < from) return false;
      }
      if (f.dateTo) {
        const to = new Date(f.dateTo as string);
        to.setHours(23, 59, 59, 999);
        if (new Date(item.createdAt) > to) return false;
      }
      return true;
    });
  }, [rows, savedFilterHook.filters]);

  const fetchMetadata = useCallback(async () => {
    const res = await api.get('/input-declarations/all');
    setCategories(res.data.categories || []);
    setWarehouseTypes(res.data.warehouseTypes || []);
  }, []);

  const fetchRows = useCallback(async (page = pcPage) => {
    setIsLoading(true);
    try {
      const res = await api.get('/preliminary-checks', { params: { limit: pcPageSize, page } });
      setRows(res.data.data || []);
      setPcTotal(res.data.total || 0);
      setPcPage(page);
    } catch (error) {
      console.error('Error fetching preliminary checks:', error);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [pcPageSize, pcPage]);

  useEffect(() => {
    void fetchMetadata();
    void fetchRows();
  }, [fetchMetadata, fetchRows]);

  useEffect(() => {
    return () => {
      form.imagePreviews.forEach((p) => {
        if (p.startsWith('blob:')) URL.revokeObjectURL(p);
      });
    };
  }, [form.imagePreviews]);

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
      imageFiles: [],
      imagePreviews: parseImageUrls(row.imageUrl),
      note: row.note || '',
    });
    setShowCreateModal(true);
  };

  const handleImagesAdd = (files: FileList | null) => {
    if (!files) return;
    const valid = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!valid.length) return;
    const newPreviews = valid.map((f) => URL.createObjectURL(f));
    setForm((prev) => ({
      ...prev,
      imageFiles: [...prev.imageFiles, ...valid],
      imagePreviews: [...prev.imagePreviews, ...newPreviews],
    }));
  };

  const handleImageRemove = (index: number) => {
    setForm((prev) => {
      const preview = prev.imagePreviews[index];
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
      // find corresponding file index (blob previews come after existing URL previews)
      const existingCount = prev.imagePreviews.filter((p) => !p.startsWith('blob:')).length;
      const fileIndex = index - existingCount;
      const newFiles = fileIndex >= 0
        ? prev.imageFiles.filter((_, i) => i !== fileIndex)
        : prev.imageFiles;
      return {
        ...prev,
        imageFiles: newFiles,
        imagePreviews: prev.imagePreviews.filter((_, i) => i !== index),
      };
    });
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

      // Upload new files in parallel
      const newUrls: string[] = await Promise.all(
        form.imageFiles.map(async (file) => {
          const compressed = await compressImageForUpload(file);
          const body = new FormData();
          body.append('file', compressed);
          const res = await api.post('/upload', body, { headers: { 'Content-Type': 'multipart/form-data' } });
          return res.data.url as string;
        }),
      );
      // Existing URLs (non-blob previews kept by user)
      const existingUrls = form.imagePreviews.filter((p) => !p.startsWith('blob:'));
      const allUrls = [...existingUrls, ...newUrls];
      if (allUrls.length > 0) {
        payload.imageUrls = allUrls;
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

          <Button className="h-11 rounded-2xl bg-violet-600 px-5 hover:bg-violet-700" onClick={openCreateModal} disabled={!canCreate}>
            <Plus size={16} />
            Tao phieu kiem so bo
          </Button>
        </div>

        <SmartFilter
          fields={filterFields}
          filters={savedFilterHook.filters}
          draftFilters={savedFilterHook.draftFilters}
          savedFilters={savedFilterHook.savedFilters}
          activeFilterId={savedFilterHook.activeFilterId}
          hasPendingChanges={savedFilterHook.hasPendingChanges}
          onUpdateFilter={savedFilterHook.updateFilter}
          onRemoveFilter={savedFilterHook.removeFilter}
          onClearFilters={savedFilterHook.clearFilters}
          onApplyDraftFilters={savedFilterHook.applyDraftFilters}
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
                <div className="hidden lg:block overflow-x-auto">
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
                            {parseImageUrls(item.imageUrl).length > 0 ? (
                              <button className="text-sm font-medium text-violet-700 hover:text-violet-800" onClick={() => setPreviewImages(parseImageUrls(item.imageUrl))}>
                                {parseImageUrls(item.imageUrl).length} anh
                              </button>
                            ) : (
                              <span className="text-sm text-slate-400">Khong co</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[150px] md:max-w-[280px] text-[15px] text-slate-500 whitespace-normal break-words">{item.note || '-'}</TableCell>
                          <TableCell className="pr-4">
                            <div className="flex justify-end gap-2">
                              {parseImageUrls(item.imageUrl).length > 0 && (
                                <Button variant="outline" size="sm" onClick={() => setPreviewImages(parseImageUrls(item.imageUrl))}>
                                  <Eye size={14} />
                                  Xem ({parseImageUrls(item.imageUrl).length})
                                </Button>
                              )}
                              <Button variant="outline" size="sm" onClick={() => openEditModal(item)} disabled={!canEdit}>
                                <Pencil size={14} />
                                Sua
                              </Button>
                              {canDelete && (
                                <Button variant="outline" size="sm" onClick={() => handleDelete(item)}>
                                  <Trash2 size={14} />
                                  Xoa
                                </Button>
                              )}
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
                        {parseImageUrls(item.imageUrl).length > 0 && (
                          <Button variant="outline" size="sm" onClick={() => setPreviewImages(parseImageUrls(item.imageUrl))}>
                            <Eye size={14} />
                            Xem anh ({parseImageUrls(item.imageUrl).length})
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

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>Hiển thị</span>
                <select
                  className="form-select page-size-select h-9 w-20 text-sm"
                  value={pcPageSize}
                  onChange={(e) => { setPcPageSize(Number(e.target.value)); setPcPage(1); }}
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
                <span>/ trang • Tổng {pcTotal} mục</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={pcPage <= 1} onClick={() => fetchRows(pcPage - 1)}>
                  Trước
                </Button>
                <span className="px-3 text-sm font-medium text-slate-700">
                  Trang {pcPage} / {Math.ceil(pcTotal / pcPageSize) || 1}
                </span>
                <Button variant="outline" size="sm" disabled={pcPage >= Math.ceil(pcTotal / pcPageSize)} onClick={() => fetchRows(pcPage + 1)}>
                  Sau
                </Button>
              </div>
            </div>
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

          <div className="grid gap-4 sm:grid-cols-2">
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
              <div className="flex items-center justify-between">
                <Label>Hinh anh hang da nhan</Label>
                <span className="text-xs text-slate-400">{form.imagePreviews.length > 0 ? `${form.imagePreviews.length} anh` : 'Chua co anh'}</span>
              </div>

              {form.imagePreviews.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {form.imagePreviews.map((src, idx) => (
                    <div key={idx} className="relative group aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                      <img src={src} alt={`anh-${idx + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleImageRemove(idx)}
                        className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition"
                        title="Xoa anh"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 px-4 py-4 text-center hover:border-violet-300 hover:bg-violet-50/40 transition">
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleImagesAdd(e.target.files)} />
                <Upload size={18} className="text-slate-400" />
                <span className="text-sm text-slate-500">
                  {form.imagePreviews.length > 0 ? 'Them anh khac' : 'Nhan de tai len hinh anh (co the chon nhieu anh)'}
                </span>
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
            <Button type="button" onClick={submit} disabled={!canSubmit || isSubmitting || (isEditing ? !canSave : !canCreate)}>
              {isSubmitting ? 'Dang luu...' : isEditing ? 'Luu cap nhat' : 'Tao phieu so bo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewImages.length > 0} onOpenChange={(open) => !open && setPreviewImages([])}>
        <DialogContent className="max-w-4xl p-3 sm:p-5">
          <DialogHeader>
            <DialogTitle>Hinh anh ({previewImages.length} anh)</DialogTitle>
          </DialogHeader>
          <div className={`grid gap-3 ${previewImages.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {previewImages.map((url, idx) => (
              <div key={idx} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <img src={url} alt={`anh-${idx + 1}`} className="max-h-[60vh] w-full object-contain" />
                <p className="py-1 text-center text-xs text-slate-400">Anh {idx + 1}/{previewImages.length}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
