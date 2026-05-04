import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, FileText, Pencil, ShoppingCart, Trash2, User } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { api } from '../services/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { formatNumber } from '../lib/utils';
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
  const [categories, setCategories] = useState<AttributeOption[]>([]);
  const [warehouseTypes, setWarehouseTypes] = useState<AttributeOption[]>([]);
  const [rows, setRows] = useState<OrderPlanRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
      options: categories.map((c) => ({ value: c.id, label: c.name })),
    },
    {
      key: 'customerName',
      label: 'Khách hàng',
      type: 'text',
      placeholder: 'Lọc khách hàng...',
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
      if (f.type && item.type !== f.type) return false;
      if (f.status && item.status !== f.status) return false;
      if (f.category && item.category?.id !== f.category) return false;
      if (f.customerName && !item.customerName?.toLowerCase().includes(String(f.customerName).toLowerCase())) return false;
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
      const res = await api.get('/order-plans', { params: { limit: 100 } });
      setRows(res.data.data || []);
    } catch (error) {
      console.error('Error fetching order plans:', error);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

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

          <Button className="h-11 rounded-2xl bg-violet-600 px-5 hover:bg-violet-700" onClick={openCreateModal}>
            <FileText size={16} />
            Tao ke hoach dat hang
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
              <div className="py-14 text-center text-slate-500">Chua co ke hoach dat hang nao.</div>
            ) : (
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
                      <TableCell className="max-w-[260px] text-[15px] text-slate-500">{item.note || '-'}</TableCell>
                      <TableCell className="pr-4">
                        <div className="flex justify-end gap-2">
                          {item.status === 'PLANNED' && (
                            <Button variant="outline" size="sm" onClick={() => openConfirmModal(item)}>
                              <CalendarClock size={14} />
                              Xac nhan da dat hang
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
              <ShoppingCart size={18} />
              {isEditing ? 'Cap nhat ke hoach dat hang' : 'Tao ke hoach dat hang'}
            </DialogTitle>
          </DialogHeader>

          {createStep === 1 ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
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
            <div className="grid gap-4 md:grid-cols-2">
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
            <div className="grid gap-4 md:grid-cols-2">
              {form.type === 'PREORDER' ? (
                <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4 md:col-span-2">
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

              <div className="space-y-2 md:col-span-2">
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
              <Button type="button" onClick={submit} disabled={!canSubmit || isSubmitting}>
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
