import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Download, FileText, Pencil, ShoppingCart, Trash2, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';
import AppLayout from '../components/layout/AppLayout';
import { api } from '../services/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { formatNumber, matchSel } from '../lib/utils';
import SmartFilter, { type FilterField } from '../components/common/SmartFilter';
import { useSavedFilters } from '../hooks/useSavedFilters';
import { SearchableSelect } from '../components/ui/searchable-select';

type AttributeOption = {
  id: string;
  name: string;
};

type OrderPlanType = 'STOCK' | 'PREORDER';
type OrderPlanStatus = 'PLANNED' | 'ORDERED';

type OrderPlanRow = {
  id: string;
  type: OrderPlanType;
  status: OrderPlanStatus;
  quantity: number;
  customerName?: string | null;
  customerPhone?: string | null;
  note?: string | null;
  expectedArrivalDate?: string | null;
  createdAt: string;
  category?: AttributeOption | null;
  warehouseType?: AttributeOption | null;
  creator: { id: string; name: string; email: string };
};

type OrderPlanForm = {
  type: OrderPlanType;
  categoryId: string;
  quantity: number;
  warehouseTypeId: string;
  customerName: string;
  customerPhone: string;
  note: string;
};

const noteHelperText =
  'Nhap chi tiet loai Hang can nhap / Size / Mau sac / Thoi gian can co va Cac ghi chu can thiet khac .. de dam bao nhap hang chinh xac du va dung thoi gian';

const defaultOrderPlanForm = (): OrderPlanForm => ({
  type: 'STOCK',
  categoryId: '',
  quantity: 1,
  warehouseTypeId: '',
  customerName: '',
  customerPhone: '',
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

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

export default function OrderPlansPage() {
  const { user } = useAuth();
  const canCreate = Boolean(user?.permissions?.orderPlans?.create);
  const canEdit = Boolean(user?.permissions?.orderPlans?.edit);
  const canDelete = Boolean(user?.permissions?.orderPlans?.delete);
  const canSave = Boolean(user?.permissions?.orderPlans?.save);
  const [categories, setCategories] = useState<AttributeOption[]>([]);
  const [warehouseTypes, setWarehouseTypes] = useState<AttributeOption[]>([]);
  const [rows, setRows] = useState<OrderPlanRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [opPage, setOpPage] = useState(1);
  const [opPageSize, setOpPageSize] = useState(50);
  const [opTotal, setOpTotal] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [editingRow, setEditingRow] = useState<OrderPlanRow | null>(null);
  const [selectedRow, setSelectedRow] = useState<OrderPlanRow | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [form, setForm] = useState<OrderPlanForm>(defaultOrderPlanForm);
  const [expectedArrivalDate, setExpectedArrivalDate] = useState('');

  const isEditing = Boolean(editingRow);

  const savedFilterHook = useSavedFilters({ pageKey: 'order-plans' });

  const filterFields = useMemo<FilterField[]>(() => [
    {
      key: 'type',
      label: 'Loại kế hoạch',
      type: 'select',
      options: [
        { value: 'STOCK', label: 'Đặt hàng dự trữ lưu kho' },
        { value: 'PREORDER', label: 'Đặt hàng cho khách Pre-order' },
      ],
    },
    {
      key: 'status',
      label: 'Trạng thái',
      type: 'select',
      options: [
        { value: 'PLANNED', label: 'Cho xac nhan dat hang' },
        { value: 'ORDERED', label: 'Da xac nhan dat hang' },
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
      key: 'customerName',
      label: 'Khách hàng',
      type: 'text',
      placeholder: 'Lọc khách hàng...',
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
  ], []);

  const filteredRows = useMemo(() => {
    const f = savedFilterHook.filters;
    if (Object.keys(f).length === 0) return rows;

    return rows.filter((item) => {
      if (!matchSel(f.type, item.type)) return false;
      if (!matchSel(f.status, item.status)) return false;
      if (!matchSel(f.category, item.category?.id)) return false;
      if (f.customerName && !item.customerName?.toLowerCase().includes(String(f.customerName).toLowerCase())) return false;
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

  const fetchRows = useCallback(async (page = opPage) => {
    setIsLoading(true);
    try {
      const res = await api.get('/order-plans', { params: { limit: opPageSize, page } });
      setRows(res.data.data || []);
      setOpTotal(res.data.total || 0);
      setOpPage(page);
    } catch (error) {
      console.error('Error fetching order plans:', error);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [opPageSize, opPage]);

  useEffect(() => {
    void fetchMetadata();
    void fetchRows();
  }, [fetchMetadata, fetchRows]);

  const resetForm = useCallback(() => {
    setForm(defaultOrderPlanForm());
    setEditingRow(null);
    setCreateStep(1);
  }, []);

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (row: OrderPlanRow) => {
    setEditingRow(row);
    setForm({
      type: row.type,
      categoryId: row.category?.id || '',
      quantity: row.quantity,
      warehouseTypeId: row.warehouseType?.id || '',
      customerName: row.customerName || '',
      customerPhone: row.customerPhone || '',
      note: row.note || '',
    });
    setCreateStep(row.type === 'PREORDER' ? 2 : 3);
    setShowCreateModal(true);
  };

  const openConfirmModal = (row: OrderPlanRow) => {
    setSelectedRow(row);
    setExpectedArrivalDate(new Date().toISOString().slice(0, 10));
    setShowConfirmModal(true);
  };

  const typeLabel = (type: OrderPlanType) =>
    type === 'STOCK' ? 'Dat hang du tru luu kho' : 'Dat hang cho khach Pre-order';

  const statusLabel = (status: OrderPlanStatus) =>
    status === 'PLANNED' ? 'Cho xac nhan dat hang' : 'Da xac nhan dat hang';

  const statusBadgeClass = (status: OrderPlanStatus) =>
    status === 'PLANNED'
      ? 'border border-amber-200 bg-amber-50 text-amber-600'
      : 'border border-emerald-200 bg-emerald-50 text-emerald-600';

  const canProceedTypeStep = Boolean(form.type);
  const canProceedCustomerStep =
    form.type !== 'PREORDER' || Boolean(form.customerName.trim() && form.customerPhone.trim());

  const canSubmit = useMemo(
    () => Boolean(form.categoryId && form.quantity > 0 && form.warehouseTypeId),
    [form.categoryId, form.quantity, form.warehouseTypeId],
  );

  const handleNext = () => {
    if (createStep === 1 && canProceedTypeStep) {
      setCreateStep(form.type === 'PREORDER' ? 2 : 3);
      return;
    }

    if (createStep === 2 && canProceedCustomerStep) {
      setCreateStep(3);
    }
  };

  const handleBack = () => {
    if (createStep === 3 && form.type === 'PREORDER') {
      setCreateStep(2);
      return;
    }
    if (createStep > 1) {
      setCreateStep(1);
    }
  };

  const submit = async () => {
    if (!canSubmit) return;

    try {
      setIsSubmitting(true);
      const payload: Record<string, unknown> = {
        type: form.type,
        categoryId: form.categoryId,
        quantity: Number(form.quantity),
        warehouseTypeId: form.warehouseTypeId || undefined,
        note: form.note.trim() || undefined,
      };

      if (form.type === 'PREORDER') {
        payload.customerName = form.customerName.trim();
        payload.customerPhone = form.customerPhone.trim();
      }

      if (editingRow) {
        await api.patch(`/order-plans/${editingRow.id}`, payload);
      } else {
        await api.post('/order-plans', payload);
      }

      setShowCreateModal(false);
      resetForm();
      await fetchRows();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Khong the luu ke hoach dat hang.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmOrdered = async () => {
    if (!selectedRow || !expectedArrivalDate) return;

    try {
      setIsSubmitting(true);
      await api.patch(`/order-plans/${selectedRow.id}/confirm-ordered`, {
        expectedArrivalDate,
      });
      setShowConfirmModal(false);
      setSelectedRow(null);
      await fetchRows();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Khong the xac nhan da dat hang.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportExcel = () => {
    const data = filteredRows.map((row) => ({
      'Ngày tạo': formatDateTime(row.createdAt),
      'Loại kế hoạch': typeLabel(row.type),
      'Danh mục SP': row.category?.name || '-',
      'Loại kho': row.warehouseType?.name || '-',
      'Số lượng': row.quantity,
      'Khách hàng': row.customerName || '-',
      'SĐT': row.customerPhone || '-',
      'Trạng thái': statusLabel(row.status),
      'Ngày dự kiến': formatDate(row.expectedArrivalDate),
      'Ghi chú': row.note || '-',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kế hoạch đặt hàng');
    XLSX.writeFile(wb, 'ke-hoach-dat-hang.xlsx');
  };

  const handleDelete = async (row: OrderPlanRow) => {
    if (!window.confirm(`Xoa ke hoach dat hang tao luc ${formatDateTime(row.createdAt)}?`)) {
      return;
    }

    try {
      await api.delete(`/order-plans/${row.id}`);
      await fetchRows();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Khong the xoa ke hoach dat hang.');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-3xl">
            <h2 className="text-[22px] font-semibold text-slate-950">Ke hoach dat hang</h2>
            <p className="mt-1 text-[15px] text-slate-500">
              Theo doi nhanh cac ke hoach dat hang du tru luu kho va don dat cho khach Pre-order de dam bao co hang kip thoi.
            </p>
          </div>

          <Button className="h-11 rounded-2xl bg-violet-600 px-5 hover:bg-violet-700" onClick={openCreateModal} disabled={!canCreate}>
            <FileText size={16} />
            Tao ke hoach dat hang
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleExportExcel}>
            <Download size={16} />
            Xuất Excel
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
              <div className="py-14 text-center text-slate-500">Chua co ke hoach dat hang nao.</div>
            ) : (
              <div className="hidden md:block overflow-x-auto">
              <Table className="border-none">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">Ngay tao</TableHead>
                    <TableHead>Loai ke hoach</TableHead>
                    <TableHead>Danh muc SP</TableHead>
                    <TableHead>Loai kho</TableHead>
                    <TableHead className="text-right">So luong</TableHead>
                    <TableHead>Khach hang</TableHead>
                    <TableHead>Trang thai</TableHead>
                    <TableHead>Ngay du kien co hang</TableHead>
                    <TableHead>Ghi chu</TableHead>
                    <TableHead className="text-right pr-4">Thao tac</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((item) => (
                    <TableRow key={item.id} className="align-top">
                      <TableCell className="pl-4 text-[15px] text-slate-600">{formatDateTime(item.createdAt)}</TableCell>
                      <TableCell className="font-medium text-slate-900">{typeLabel(item.type)}</TableCell>
                      <TableCell className="font-medium text-slate-900">{item.category?.name || '-'}</TableCell>
                      <TableCell className="text-slate-600">{item.warehouseType?.name || '-'}</TableCell>
                      <TableCell className="text-right text-[18px] font-semibold text-slate-900">{formatNumber(item.quantity)}</TableCell>
                      <TableCell className="text-[15px] text-slate-600">
                        {item.type === 'PREORDER' ? (
                          <div>
                            <div className="font-medium text-slate-900">{item.customerName || '-'}</div>
                            <div className="text-sm text-slate-500">{item.customerPhone || '-'}</div>
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${statusBadgeClass(item.status)}`}>
                          {statusLabel(item.status)}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-600">{formatDate(item.expectedArrivalDate)}</TableCell>
                      <TableCell className="max-w-[150px] md:max-w-[260px] text-[15px] text-slate-500">{item.note || '-'}</TableCell>
                      <TableCell className="pr-4">
                        <div className="flex justify-end gap-2">
                          {item.status === 'PLANNED' && canSave && (
                            <Button variant="outline" size="sm" onClick={() => openConfirmModal(item)}>
                              <CalendarClock size={14} />
                              Xac nhan da dat hang
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
            )}

            {/* Mobile card list */}
            {!isLoading && filteredRows.length > 0 && (
              <div className="md:hidden divide-y divide-slate-100">
                {filteredRows.map((item) => (
                  <div key={item.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${item.type === 'PREORDER' ? 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700' : 'border-sky-200 bg-sky-50 text-sky-700'}`}>
                          {typeLabel(item.type)}
                        </span>
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(item.status)}`}>
                          {statusLabel(item.status)}
                        </span>
                      </div>
                      <div className="text-xl font-bold tabular-nums text-slate-900 shrink-0">{formatNumber(item.quantity)}</div>
                    </div>

                    <div className="mb-2">
                      <div className="font-semibold text-slate-900">{item.category?.name || '-'}</div>
                      {item.warehouseType?.name && <div className="text-sm text-slate-500">{item.warehouseType.name}</div>}
                      {item.type === 'PREORDER' && item.customerName && (
                        <div className="text-sm text-slate-600 mt-0.5">{item.customerName}{item.customerPhone ? ` · ${item.customerPhone}` : ''}</div>
                      )}
                    </div>

                    <div className="space-y-0.5 text-xs text-slate-500 mb-3">
                      <div className="flex gap-2"><span className="w-20 shrink-0">Ngày tạo</span><span>{formatDateTime(item.createdAt)}</span></div>
                      {item.expectedArrivalDate && (
                        <div className="flex gap-2"><span className="w-20 shrink-0">Dự kiến có</span><span>{formatDate(item.expectedArrivalDate)}</span></div>
                      )}
                      {item.note && <div className="flex gap-2"><span className="w-20 shrink-0">Ghi chú</span><span>{item.note}</span></div>}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {item.status === 'PLANNED' && canSave && (
                        <Button variant="outline" size="sm" className="h-8" onClick={() => openConfirmModal(item)}>
                          <CalendarClock size={13} /> Xác nhận
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="h-8" onClick={() => openEditModal(item)} disabled={!canEdit}>
                        <Pencil size={13} /> Sửa
                      </Button>
                      {canDelete && (
                        <Button variant="outline" size="sm" className="h-8 border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(item)}>
                          <Trash2 size={13} /> Xóa
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>Hiển thị</span>
                <select
                  className="form-select page-size-select h-9 w-20 text-sm"
                  value={opPageSize}
                  onChange={(e) => { setOpPageSize(Number(e.target.value)); setOpPage(1); }}
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
                <span>/ trang • Tổng {opTotal} mục</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={opPage <= 1} onClick={() => fetchRows(opPage - 1)}>
                  Trước
                </Button>
                <span className="px-3 text-sm font-medium text-slate-700">
                  Trang {opPage} / {Math.ceil(opTotal / opPageSize) || 1}
                </span>
                <Button variant="outline" size="sm" disabled={opPage >= Math.ceil(opTotal / opPageSize)} onClick={() => fetchRows(opPage + 1)}>
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
              <ShoppingCart size={18} />
              {isEditing ? 'Cap nhat ke hoach dat hang' : 'Tao ke hoach dat hang'}
            </DialogTitle>
          </DialogHeader>

          {createStep === 1 ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  className={`rounded-3xl border p-5 text-left transition ${form.type === 'STOCK' ? 'border-violet-500 bg-violet-50' : 'border-slate-200 bg-white hover:border-violet-300'}`}
                  onClick={() => setForm((prev) => ({ ...prev, type: 'STOCK' }))}
                >
                  <div className="text-lg font-semibold text-slate-950">Dat hang du tru luu kho</div>
                  <p className="mt-2 text-sm text-slate-500">Lap ke hoach dat hang de bo sung ton kho san sang cho van hanh.</p>
                </button>

                <button
                  type="button"
                  className={`rounded-3xl border p-5 text-left transition ${form.type === 'PREORDER' ? 'border-violet-500 bg-violet-50' : 'border-slate-200 bg-white hover:border-violet-300'}`}
                  onClick={() => setForm((prev) => ({ ...prev, type: 'PREORDER' }))}
                >
                  <div className="text-lg font-semibold text-slate-950">Dat hang cho khach Pre-order</div>
                  <p className="mt-2 text-sm text-slate-500">Ghi nhan don hang can dat rieng cho khach va theo doi ngay du kien co hang.</p>
                </button>
              </div>
            </div>
          ) : null}

          {createStep === 2 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Ten KH</Label>
                <Input value={form.customerName} onChange={(e) => setForm((prev) => ({ ...prev, customerName: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>So dien thoai</Label>
                <Input value={form.customerPhone} onChange={(e) => setForm((prev) => ({ ...prev, customerPhone: e.target.value }))} />
              </div>
            </div>
          ) : null}

          {createStep === 3 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {form.type === 'PREORDER' ? (
                <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4 sm:col-span-2">
                  <div className="flex items-start gap-3">
                    <User size={18} className="mt-0.5 text-violet-600" />
                    <div>
                      <div className="font-medium text-slate-900">{form.customerName || 'Khach hang pre-order'}</div>
                      <div className="text-sm text-slate-500">{form.customerPhone || '-'}</div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>Danh muc san pham</Label>
                <SearchableSelect
                  options={categories.map((item) => ({ value: item.id, label: item.name }))}
                  value={form.categoryId}
                  onChange={(v) => setForm((prev) => ({ ...prev, categoryId: v }))}
                  placeholder="Chon danh muc"
                />
              </div>

              <div className="space-y-2">
                <Label>So luong can dat</Label>
                <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))} />
              </div>

              <div className="space-y-2">
                <Label>Loai kho</Label>
                <SearchableSelect
                  options={warehouseTypes.map((item) => ({ value: item.id, label: item.name }))}
                  value={form.warehouseTypeId}
                  onChange={(v) => setForm((prev) => ({ ...prev, warehouseTypeId: v }))}
                  placeholder="Chon loai kho"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Sau khi tao se hien thi thanh 1 dong giao dich de theo doi va co the xac nhan da dat hang kem ngay du kien co hang.
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Ghi chu</Label>
                <p className="text-xs text-slate-500">{noteHelperText}</p>
                <textarea
                  className="form-control min-h-[120px] py-3"
                  value={form.note}
                  onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder={noteHelperText}
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => (createStep === 1 ? setShowCreateModal(false) : handleBack())} disabled={isSubmitting}>
              {createStep === 1 ? 'Huy' : 'Quay lai'}
            </Button>
            {createStep < 3 ? (
              <Button type="button" onClick={handleNext} disabled={(createStep === 1 && !canProceedTypeStep) || (createStep === 2 && !canProceedCustomerStep)}>
                Tiep tuc
              </Button>
            ) : (
              <Button type="button" onClick={submit} disabled={!canSubmit || isSubmitting || (isEditing ? !canSave : !canCreate)}>
                {isSubmitting ? 'Dang luu...' : isEditing ? 'Luu cap nhat' : 'Tao ke hoach'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Xac nhan da dat hang</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="font-medium text-slate-900">{selectedRow?.category?.name || '-'}</div>
              <div className="mt-1 text-sm text-slate-500">So luong can dat: {formatNumber(selectedRow?.quantity || 0)}</div>
            </div>

            <div className="space-y-2">
              <Label>Ngay du kien co hang</Label>
              <Input type="date" value={expectedArrivalDate} onChange={(e) => setExpectedArrivalDate(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmModal(false)} disabled={isSubmitting}>
              Huy
            </Button>
            <Button onClick={confirmOrdered} disabled={!expectedArrivalDate || isSubmitting}>
              {isSubmitting ? 'Dang luu...' : 'Xac nhan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
