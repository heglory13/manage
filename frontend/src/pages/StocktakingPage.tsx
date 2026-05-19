import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, Clock3, Eye, History, Plus, Printer, RefreshCcw, ShieldAlert, Trash2, Upload, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';
import AppLayout from '../components/layout/AppLayout';
import { api } from '../services/api';
import { compressImageForUpload } from '../lib/image';
import { formatDateTime, formatNumber, matchSel } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { defaultGeneralSettings, fetchGeneralSettings } from '../services/generalSettings';
import SmartFilter, { type FilterField } from '../components/common/SmartFilter';
import { useSavedFilters } from '../hooks/useSavedFilters';
import { SearchableSelect } from '../components/ui/searchable-select';

type StocktakingStatus = 'CHECKING' | 'PENDING' | 'APPROVED' | 'REJECTED';

type StocktakingItem = {
  id: string;
  categoryId?: string;
  itemCode: string;
  itemLabel: string;
  systemQuantity: number;
  actualQuantity: number;
  discrepancy: number;
  discrepancyReason?: string;
  evidenceUrl?: string;
  isBalanced?: boolean;
  balancedAt?: string;
  product?: {
    id: string;
    name: string;
    sku: string;
    categoryId?: string;
  };
  category?: {
    id: string;
    name: string;
    code?: string;
  };
};

type StocktakingRecord = {
  id: string;
  status: StocktakingStatus;
  createdAt: string;
  cutoffTime: string;
  submittedAt?: string;
  mode: 'full' | 'selected' | 'category' | 'warehouseType';
  creator: { id: string; name: string };
  items: StocktakingItem[];
  statusHistory?: Array<{
    id: string;
    status: string;
    changedAt: string;
    note?: string;
  }>;
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

function getStocktakingItemCode(item: StocktakingItem) {
  return item.itemCode || item.category?.code || item.product?.sku || '-';
}

function getStocktakingItemLabel(item: StocktakingItem) {
  return item.itemLabel || item.category?.name || item.product?.name || '-';
}

function getStocktakingItemCategoryId(item: StocktakingItem) {
  return item.categoryId || item.category?.id || item.product?.categoryId || '';
}

export default function StocktakingPage() {
  const { user } = useAuth();
  const canCreate = Boolean(user?.permissions?.audit?.create);
  const canSave = Boolean(user?.permissions?.audit?.save);
  const [records, setRecords] = useState<StocktakingRecord[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [warehouseTypes, setWarehouseTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showItemBalanceModal, setShowItemBalanceModal] = useState(false);
  const [balancingItem, setBalancingItem] = useState<StocktakingItem | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<StocktakingRecord | null>(null);
  const [createMode, setCreateMode] = useState<'full' | 'category' | 'warehouseType' | 'product'>('category');
  const [cutoffDate, setCutoffDate] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [cutoffTime, setCutoffTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedWarehouseTypeId, setSelectedWarehouseTypeId] = useState('');
  // Product mode: checkbox list of all SKUs
  const [allSkuCombos, setAllSkuCombos] = useState<Array<{
    id: string;
    compositeSku: string;
    classification: { name: string };
    color: { name: string };
    size: { name: string };
    material: { name: string };
  }>>([]);
  const [skuFilterQuery, setSkuFilterQuery] = useState('');
  const [selectedSkuIds, setSelectedSkuIds] = useState<Set<string>>(new Set());
  const [stocktakingProductSearch, setStocktakingProductSearch] = useState('');
  const [stocktakingSearchResults, setStocktakingSearchResults] = useState<Array<{
    id: string;
    compositeSku: string;
    categoryId: string | null;
    categoryName: string | null;
    classification: { id: string; name: string };
    color: { id: string; name: string };
    size: { id: string; name: string };
    material: { id: string; name: string };
  }>>([]);
  const [stocktakingSearchOpen, setStocktakingSearchOpen] = useState(false);
  const [stocktakingSelectedProduct, setStocktakingSelectedProduct] = useState('');
  const [isSubmittingConfirmation, setIsSubmittingConfirmation] = useState(false);
  const [signedDocuments, setSignedDocuments] = useState<Array<{ name: string; preview: string; url: string }>>([]);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [confirmForm, setConfirmForm] = useState<Record<string, { actualQuantity: number; discrepancyReason: string }>>({});
  const [generalSettings, setGeneralSettings] = useState(defaultGeneralSettings);

  const savedFilterHook = useSavedFilters({ pageKey: 'stocktaking' });

  const filterFields = useMemo<FilterField[]>(() => [
    {
      key: 'status',
      label: 'Trạng thái',
      type: 'select',
      options: [
        { value: 'CHECKING', label: 'Đang kiểm kê' },
        { value: 'PENDING', label: 'Chờ duyệt' },
        { value: 'APPROVED', label: 'Hoàn thành' },
        { value: 'REJECTED', label: 'Từ chối' },
      ],
    },
    {
      key: 'mode',
      label: 'Phạm vi',
      type: 'select',
      options: [
        { value: 'full', label: 'Toàn bộ kho' },
        { value: 'category', label: 'Theo danh mục' },
        { value: 'warehouseType', label: 'Theo loại kho' },
      ],
    },
    {
      key: 'productName',
      label: 'Tên sản phẩm',
      type: 'text',
      placeholder: 'Chọn sản phẩm...',
      asyncLoad: async (q?: string) => {
        const res = await api.get('/products', { params: { limit: 100, search: q } });
        const items = res.data.data || res.data || [];
        return items.map((p: any) => ({ value: p.name, label: p.name }));
      },
    },
    {
      key: 'sku',
      label: 'SKU',
      type: 'text',
      placeholder: 'Chọn SKU...',
      asyncLoad: async (q?: string) => {
        const res = await api.get('/input-declarations/sku-combos', { params: { limit: 100, search: q } });
        const items = res.data.data || res.data || [];
        return items.map((s: any) => ({ value: s.compositeSku, label: s.compositeSku }));
      },
    },
    {
      key: 'categoryName',
      label: 'Danh mục',
      type: 'text',
      placeholder: 'Chọn danh mục...',
      asyncLoad: async (q?: string) => {
        const res = await api.get('/categories', { params: { limit: 100, search: q } });
        const items = res.data.data || res.data || [];
        return items.map((c: any) => ({ value: c.name, label: c.name }));
      },
    },
    {
      key: 'creator',
      label: 'Nhân viên',
      type: 'text',
      placeholder: 'Gõ để tìm nhân viên...',
      asyncLoad: async () => {
        const res = await api.get('/users');
        const items = res.data.data || res.data || [];
        return items.map((u: any) => ({ value: u.name, label: u.name }));
      },
    },
    {
      key: 'date',
      label: 'Ngày tạo',
      type: 'date',
    },
  ], []);

  const filteredRecords = useMemo(() => {
    const f = savedFilterHook.filters;
    if (Object.keys(f).length === 0) return records;

    return records.filter((record) => {
      if (!matchSel(f.status, record.status)) return false;
      if (!matchSel(f.mode, record.mode)) return false;
      if (f.creator && !record.creator?.name?.toLowerCase().includes(String(f.creator).toLowerCase())) return false;
      if (f.date) {
        const recordDate = new Date(record.createdAt).toISOString().slice(0, 10);
        if (recordDate !== f.date) return false;
      }
      
      // Filter by product info (productName, sku, categoryName)
      if (f.productName || f.sku || f.categoryName) {
        const hasMatchingItem = record.items?.some((item) => {
          if (f.productName && !item.product?.name?.toLowerCase().includes(String(f.productName).toLowerCase())) return false;
          if (f.sku && !item.product?.sku?.toLowerCase().includes(String(f.sku).toLowerCase())) return false;
          if (f.categoryName && !item.category?.name?.toLowerCase().includes(String(f.categoryName).toLowerCase())) return false;
          return true;
        });
        if (!hasMatchingItem) return false;
      }
      
      return true;
    });
  }, [records, savedFilterHook.filters]);

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

  const fetchMetadata = useCallback(async () => {
    try {
      const [declarationRes, skuRes] = await Promise.all([
        api.get('/input-declarations/all'),
        api.get('/input-declarations/sku-combos', { params: { limit: 500 } }),
      ]);
      setCategories(declarationRes.data.categories || []);
      setWarehouseTypes(declarationRes.data.warehouseTypes || []);
      setAllSkuCombos(skuRes.data.data || []);
    } catch (err) {
      console.error('Error fetching stocktaking metadata:', err);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
    fetchMetadata();
  }, [fetchMetadata, fetchRecords]);

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

  const canSubmitCreate =
    createMode === 'full' ||
    (createMode === 'category' && Boolean(selectedCategoryId)) ||
    (createMode === 'warehouseType' && Boolean(selectedWarehouseTypeId)) ||
    (createMode === 'product' && selectedSkuIds.size > 0);


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

  const handleCreate = async () => {
    try {
      const payload: {
        mode: 'full' | 'category' | 'warehouseType' | 'product';
        categoryIds?: string[];
        warehouseTypeIds?: string[];
        skuComboIds?: string[];
        cutoffTime: string;
      } = {
        mode: createMode,
        cutoffTime: `${cutoffDate}T${cutoffTime}:00`,
      };
      if (createMode === 'category') payload.categoryIds = selectedCategoryId ? [selectedCategoryId] : [];
      if (createMode === 'warehouseType') payload.warehouseTypeIds = selectedWarehouseTypeId ? [selectedWarehouseTypeId] : [];
      if (createMode === 'product') payload.skuComboIds = [...selectedSkuIds];

      const res = await api.post('/stocktaking', payload);
      const created = res.data;

      setShowCreateModal(false);
      setSelectedCategoryId('');
      setSelectedWarehouseTypeId('');
      setSelectedSkuIds(new Set());
      setSkuFilterQuery('');
      setStocktakingProductSearch('');
      setStocktakingSelectedProduct('');
      setStocktakingSearchResults([]);
      setStocktakingSearchOpen(false);
      setCutoffDate((() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; })());
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
    setSignedDocuments([]);
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

  const handleSignedDocumentsAdd = async (files: FileList | null) => {
    if (!files) return;
    const valid = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!valid.length) return;

    try {
      const results = await Promise.all(
        valid.map(async (file) => {
          try {
            const compressed = await compressImageForUpload(file);
            const preview = URL.createObjectURL(compressed);
            const formData = new FormData();
            formData.append('file', compressed);
            const uploadRes = await api.post('/upload', formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
            return { name: file.name, preview, url: uploadRes.data.url as string };
          } catch {
            return null;
          }
        }),
      );
      const succeeded = results.filter(Boolean) as { name: string; preview: string; url: string }[];
      if (succeeded.length < valid.length) {
        alert(`${valid.length - succeeded.length} ảnh tải lên thất bại. Vui lòng thử lại.`);
      }
      if (succeeded.length > 0) {
        setSignedDocuments((prev) => [...prev, ...succeeded]);
      }
    } catch {
      alert('Tải ảnh lên thất bại. Vui lòng thử lại.');
    }
  };

  const handleSignedDocumentRemove = (idx: number) => {
    setSignedDocuments((prev) => {
      const doc = prev[idx];
      if (doc?.preview?.startsWith('blob:')) URL.revokeObjectURL(doc.preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  function parseEvidenceUrls(evidenceUrl?: string): string[] {
    if (!evidenceUrl) return [];
    if (evidenceUrl.startsWith('[')) {
      try { return JSON.parse(evidenceUrl) as string[]; } catch { return [evidenceUrl]; }
    }
    return [evidenceUrl];
  }

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
          evidenceUrls: signedDocuments.length > 0 ? signedDocuments.map((d) => d.url) : undefined,
        };
      });

      await api.patch(`/stocktaking/${selectedRecord.id}/submit`, { items });
      setShowConfirmModal(false);
      setSignedDocuments([]);
      await fetchRecords();
      await openDetail(selectedRecord.id);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể xác nhận số liệu kiểm kê');
    } finally {
      setIsSubmittingConfirmation(false);
    }
  };

  const escapeHtml = (text: string | null | undefined): string => {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const handlePrint = (record: StocktakingRecord) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Biên bản kiểm kê - ${escapeHtml(record.id)}</title>
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
              <div class="title">${escapeHtml(generalSettings.storeName || generalSettings.brandName)}</div>
              <div class="sub">Địa chỉ: ${escapeHtml(generalSettings.address) || '-'}</div>
              <div class="sub">Điện thoại: ${escapeHtml(generalSettings.phone) || '-'}</div>
            </div>
            <div class="right">
              <div class="title">Biên bản kiểm kê</div>
              <div class="sub">${escapeHtml(formatAuditCode(record))}</div>
            </div>
          </div>

          <div class="line"></div>

          <div class="meta">
            <div class="meta-left">
              <p><strong>Ngày tạo:</strong> ${formatDateTime(record.createdAt)}</p>
              <p><strong>Thời gian Cut-off:</strong> ${formatDateTime(record.cutoffTime)}</p>
              <p><strong>Nhân viên:</strong> ${escapeHtml(record.creator?.name) || '-'}</p>
            </div>
            <div class="meta-note">* Dữ liệu tồn kho được chốt tại thời điểm Cut-off.</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>STT</th>
                <th>Mã danh mục</th>
                <th>Tên danh mục</th>
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
                      <td><strong>${escapeHtml(getStocktakingItemCode(item))}</strong></td>
                      <td>${escapeHtml(getStocktakingItemLabel(item))}</td>
                      <td class="center"><strong>${item.systemQuantity}</strong></td>
                      <td class="center">${escapeHtml(actualValue)}</td>
                      <td class="center">${escapeHtml(discrepancyValue)}</td>
                      <td>${escapeHtml(noteValue)}</td>
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
      'Mã danh mục': getStocktakingItemCode(item),
      'Tên danh mục': getStocktakingItemLabel(item),
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

          <Button className="h-10 rounded-2xl bg-violet-600 px-4 hover:bg-violet-700 sm:h-11 sm:px-5" onClick={() => setShowCreateModal(true)} disabled={!canCreate}>
            <Plus size={17} />
            Tạo biên bản kiểm kê
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
              ) : filteredRecords.length > 0 ? (
                <div className="space-y-4">
                  {filteredRecords.map((record) => (
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
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[16px] font-semibold text-slate-950 sm:text-[17px]">{record.id}</span>
                            {record.status !== 'CHECKING' && (
                              record.items?.some((i) => i.discrepancy !== 0) ? (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Có chênh lệch</span>
                              ) : (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Không chênh lệch</span>
                              )
                            )}
                          </div>
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
                            disabled={!canSave}
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
                        <button
                          type="button"
                          className="rounded-xl p-2.5 text-slate-400 transition hover:bg-rose-100 hover:text-rose-600"
                          onClick={async () => {
                            if (!confirm(`Xóa biên bản kiểm kê ${record.id}?`)) return;
                            try {
                              await api.delete(`/stocktaking/${record.id}`);
                              await fetchRecords();
                            } catch (err: any) {
                              alert(err.response?.data?.message || 'Không thể xóa biên bản');
                            }
                          }}
                          aria-label="Xóa biên bản"
                        >
                          <Trash2 size={17} />
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
        <DialogContent className="flex max-h-[92vh] max-w-[720px] flex-col overflow-hidden rounded-[24px] p-0">
          <DialogHeader className="flex-shrink-0 border-b border-slate-200 px-5 py-4">
            <DialogTitle className="text-[18px] font-semibold text-slate-950">Tạo biên bản kiểm kê mới</DialogTitle>
            <p className="mt-1.5 text-[14px] text-slate-500">Chọn đúng phạm vi kiểm kê để hệ thống chốt số liệu tồn kho theo thời điểm cut-off.</p>
          </DialogHeader>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Ngày cut-off</Label>
                <Input type="date" value={cutoffDate} onChange={(e) => setCutoffDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Giờ cut-off</Label>
                <Input type="time" value={cutoffTime} onChange={(e) => setCutoffTime(e.target.value)} />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-[16px] font-semibold text-slate-950">Phạm vi kiểm kê</Label>
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setCreateMode('full')}
                  className={`rounded-[20px] border px-5 py-5 text-left transition ${
                    createMode === 'full' ? 'border-violet-500 bg-violet-50 shadow-[0_0_0_1px_rgba(99,102,241,0.15)]' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className={`mb-4 h-5 w-5 rounded-full border-2 ${createMode === 'full' ? 'border-violet-500 bg-white' : 'border-slate-300'}`} />
                  <div className="text-[17px] font-semibold text-slate-950">Toàn bộ kho</div>
                  <div className="mt-2 text-[14px] text-slate-500">Kiểm kê toàn bộ tồn kho theo từng danh mục</div>
                </button>

                <button
                  type="button"
                  onClick={() => setCreateMode('category')}
                  className={`rounded-[20px] border px-5 py-5 text-left transition ${
                    createMode === 'category' ? 'border-violet-500 bg-violet-50 shadow-[0_0_0_1px_rgba(99,102,241,0.15)]' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className={`mb-4 h-5 w-5 rounded-full border-2 ${createMode === 'category' ? 'border-violet-500 bg-white' : 'border-slate-300'}`} />
                  <div className="text-[17px] font-semibold text-slate-950">Theo danh mục</div>
                  <div className="mt-2 text-[14px] text-slate-500">Chốt số lượng thực tế cho một danh mục cụ thể</div>
                </button>

                <button
                  type="button"
                  onClick={() => setCreateMode('warehouseType')}
                  className={`rounded-[20px] border px-5 py-5 text-left transition ${
                    createMode === 'warehouseType' ? 'border-violet-500 bg-violet-50 shadow-[0_0_0_1px_rgba(99,102,241,0.15)]' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className={`mb-4 h-5 w-5 rounded-full border-2 ${createMode === 'warehouseType' ? 'border-violet-500 bg-white' : 'border-slate-300'}`} />
                  <div className="text-[17px] font-semibold text-slate-950">Theo loại kho</div>
                  <div className="mt-2 text-[14px] text-slate-500">Tổng hợp các danh mục phát sinh trong loại kho đã chọn</div>
                </button>

                <button
                  type="button"
                  onClick={() => setCreateMode('product')}
                  className={`rounded-[20px] border px-5 py-5 text-left transition ${
                    createMode === 'product' ? 'border-violet-500 bg-violet-50 shadow-[0_0_0_1px_rgba(99,102,241,0.15)]' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className={`mb-4 h-5 w-5 rounded-full border-2 ${createMode === 'product' ? 'border-violet-500 bg-white' : 'border-slate-300'}`} />
                  <div className="text-[17px] font-semibold text-slate-950">Chọn danh sách SKU</div>
                  <div className="mt-2 text-[14px] text-slate-500">Chỉ kiểm các mã được chọn</div>
                </button>
              </div>
            </div>

            {createMode === 'category' && (
              <div className="space-y-3">
                <Label className="text-[16px] font-semibold text-slate-950">Danh mục cần kiểm kê</Label>
                <SearchableSelect
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                  value={selectedCategoryId}
                  onChange={(v) => setSelectedCategoryId(v)}
                  placeholder="Chọn danh mục"
                />
              </div>
            )}

            {createMode === 'product' && (
              <div className="space-y-3">
                <Label className="text-[16px] font-semibold text-slate-950">
                  Danh sách SKU ({selectedSkuIds.size} đã chọn)
                </Label>
                <Input
                  type="text"
                  placeholder="Lọc theo tên sản phẩm hoặc mã SKU..."
                  value={skuFilterQuery}
                  onChange={(e) => setSkuFilterQuery(e.target.value)}
                />
                <div className="max-h-[280px] overflow-auto rounded-xl border border-slate-200 bg-white">
                  {allSkuCombos.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-slate-400">Chưa có sản phẩm nào trong hệ thống</div>
                  ) : (
                    allSkuCombos
                      .filter((combo) => {
                        if (!skuFilterQuery) return true;
                        // Chuẩn hóa: bỏ dấu + lowercase để "nuoc tay" match được "nước tẩy"
                        const norm = (s: string) =>
                          s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
                        const label = norm([combo.classification?.name, combo.color?.name, combo.size?.name, combo.material?.name].filter(Boolean).join(' '));
                        const sku = combo.compositeSku.toLowerCase();
                        const words = norm(skuFilterQuery).split(/\s+/).filter(Boolean);
                        return words.every((word) => label.includes(word) || sku.includes(word));
                      })
                      .map((combo) => {
                        const label = [combo.classification?.name, combo.color?.name, combo.size?.name, combo.material?.name].filter(Boolean).join(' - ');
                        const isChecked = selectedSkuIds.has(combo.id);
                        return (
                          <label
                            key={combo.id}
                            className={`flex items-center gap-3 border-b border-slate-100 px-4 py-3 cursor-pointer last:border-b-0 ${isChecked ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedSkuIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(combo.id)) next.delete(combo.id);
                                  else next.add(combo.id);
                                  return next;
                                });
                              }}
                              className="rounded"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-mono text-indigo-600">{combo.compositeSku}</span>
                              <span className="text-sm text-slate-600"> - {label}</span>
                            </div>
                          </label>
                        );
                      })
                  )}
                </div>
              </div>
            )}

            {createMode === 'warehouseType' && (
              <div className="space-y-3">
                <Label className="text-[16px] font-semibold text-slate-950">Loại kho cần kiểm kê</Label>
                <SearchableSelect
                  options={warehouseTypes.map((item) => ({ value: item.id, label: item.name }))}
                  value={selectedWarehouseTypeId}
                  onChange={(v) => setSelectedWarehouseTypeId(v)}
                  placeholder="Chọn loại kho"
                />
              </div>
            )}

            <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] leading-6 text-amber-700">
              Hệ thống sẽ chốt tồn kho tại thời điểm bạn nhấn khởi tạo. Mọi giao dịch phát sinh sau mốc này sẽ được đối soát riêng khỏi biên bản đang tạo.
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 border-t border-slate-200 px-5 py-4">
            <Button variant="outline" className="h-10 rounded-2xl px-4" onClick={() => setShowCreateModal(false)}>
              Hủy
            </Button>
            <Button
              className="h-10 rounded-2xl bg-violet-600 px-4 hover:bg-violet-700"
              onClick={handleCreate}
              disabled={!canSubmitCreate || !canCreate}
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
            setSignedDocuments([]);
          }
        }}
      >
        <DialogContent className="max-w-[1180px] rounded-[28px] p-0 max-h-[100vh] sm:max-h-[92vh] overflow-hidden flex flex-col">
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
              <div className="space-y-8 overflow-y-auto px-5 py-5 max-h-[calc(100vh-200px)] sm:max-h-[calc(92vh-150px)] sm:px-6">
                <div className="grid gap-4 rounded-[24px] border border-slate-200 bg-slate-50 p-5 sm:grid-cols-2 md:p-8">
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
                    <div>Danh mục</div>
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
                            <div className="text-[18px] font-semibold text-slate-950">{getStocktakingItemCode(item)}</div>
                            <div className="mt-1 text-[14px] text-slate-500 sm:text-[15px]">{getStocktakingItemLabel(item)}</div>
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
                                onChange={(e) => updateConfirmItem(item.id, 'actualQuantity', Math.max(0, Number(e.target.value)))}
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
                            {parseEvidenceUrls(item.evidenceUrl).length > 0 && (
                              <button
                                type="button"
                                className="mt-2 text-sm font-medium text-violet-700 hover:text-violet-800"
                                onClick={() => setPreviewImageUrl(parseEvidenceUrls(item.evidenceUrl)[0] || '')}
                              >
                                Xem {parseEvidenceUrls(item.evidenceUrl).length} hinh minh chung da luu
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[18px] font-semibold text-slate-950 sm:text-[20px]">
                      Hinh anh bien ban giay (Da ky xac nhan)
                    </div>
                    {signedDocuments.length > 0 && (
                      <span className="text-sm text-slate-500">{signedDocuments.length} anh</span>
                    )}
                  </div>

                  {signedDocuments.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {signedDocuments.map((doc, idx) => (
                        <div key={idx} className="relative group aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                          <img src={doc.preview} alt={doc.name} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleSignedDocumentRemove(idx)}
                            className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <label className="flex cursor-pointer items-center justify-center gap-3 rounded-[28px] border-2 border-dashed border-slate-200 bg-white px-6 py-6 text-center transition hover:border-violet-300 hover:bg-violet-50/40">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleSignedDocumentsAdd(e.target.files)}
                    />
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <Upload size={22} />
                    </div>
                    <div className="text-[15px] text-slate-400 sm:text-[16px]">
                      {signedDocuments.length > 0 ? 'Them anh bien ban khac' : 'Nhan de tai len anh bien ban (co the chon nhieu anh)'}
                    </div>
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

      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-[1100px] rounded-[24px] p-0 max-h-[100vh] sm:max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader className="border-b border-slate-200 px-5 py-4">
            <DialogTitle className="text-[18px] font-semibold text-slate-950">Biên bản kiểm kê kho hàng</DialogTitle>
          </DialogHeader>

          {selectedRecord && (
            <div className="px-6 py-6 overflow-y-auto flex-1 max-h-[calc(100vh-180px)] sm:max-h-[calc(92vh-140px)]">
              <div className="mx-auto w-full max-w-[900px] rounded-[10px] border border-slate-200 bg-white px-4 md:px-10 py-4 md:py-8 shadow-sm">
                <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_280px]">
                  <div>
                    <div className="text-[22px] font-bold uppercase text-slate-950">{generalSettings.storeName || generalSettings.brandName}</div>
                    <div className="mt-1 text-[15px] text-slate-700">Địa chỉ: {generalSettings.address || '-'}</div>
                    <div className="text-[15px] text-slate-700">Điện thoại: {generalSettings.phone || '-'}</div>
                  </div>

                  <div className="text-right">
                    <div className="text-[22px] font-bold uppercase text-slate-950">Biên bản kiểm kê</div>
                    <div className="mt-1 text-[15px] text-slate-700">{formatAuditCode(selectedRecord)}</div>
                  </div>
                </div>

                <div className="my-6 border-t-2 border-slate-900" />

                <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_320px]">
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
                        <th className="border border-slate-500 px-3 py-3 text-left font-semibold">Mã danh mục</th>
                        <th className="border border-slate-500 px-3 py-3 text-left font-semibold">Tên danh mục</th>
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
                            <td className="border border-slate-500 px-3 py-3 font-semibold">{getStocktakingItemCode(item)}</td>
                            <td className="border border-slate-500 px-3 py-3">{getStocktakingItemLabel(item)}</td>
                            <td className="border border-slate-500 px-3 py-3 text-center font-semibold">{formatNumber(item.systemQuantity)}</td>
                            <td className="border border-slate-500 px-3 py-3 text-center">{actualDisplay}</td>
                            <td className="border border-slate-500 px-3 py-3 text-center">{discrepancyDisplay}</td>
                            <td className="border border-slate-500 px-3 py-3 text-sm text-slate-700">
                              <span className="block">{noteDisplay}</span>
                              {parseEvidenceUrls(item.evidenceUrl).length > 0 && (
                                <button
                                  type="button"
                                  className="mt-1 text-sm font-medium text-violet-700 hover:text-violet-800"
                                  onClick={() => setPreviewImageUrl(parseEvidenceUrls(item.evidenceUrl)[0] || '')}
                                >
                                  Xem {parseEvidenceUrls(item.evidenceUrl).length} hinh minh chung
                                </button>
                              )}
                              {item.discrepancy !== 0 && (selectedRecord.status === 'PENDING' || selectedRecord.status === 'APPROVED') && (
                                item.isBalanced ? (
                                  <span className="mt-1 block text-[11px] font-semibold text-emerald-600">✓ Đã cân bằng kho</span>
                                ) : (
                                  <button
                                    type="button"
                                    className="mt-1 flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                                    onClick={() => { setBalancingItem(item); setShowItemBalanceModal(true); }}
                                  >
                                    <RefreshCcw size={11} />
                                    Cân bằng kho
                                  </button>
                                )
                              )}
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
                    Xác nhận kiểm kê
                  </Button>
                )}
                {(selectedRecord.status === 'PENDING' || selectedRecord.status === 'APPROVED') && selectedRecord.items.some((i) => i.discrepancy !== 0 && !i.isBalanced) && (
                  <Button
                    className="h-10 rounded-2xl bg-emerald-600 px-4 hover:bg-emerald-700"
                    onClick={() => setShowBalanceModal(true)}
                  >
                    <RefreshCcw size={16} />
                    Cân bằng kho toàn bộ
                  </Button>
                )}
                <Button variant="outline" className="h-10 rounded-2xl px-4" onClick={() => handleExportExcel(selectedRecord)}>
                  Excel
                </Button>
                <Button className="h-10 rounded-2xl bg-violet-600 px-4 hover:bg-violet-700" onClick={() => handlePrint(selectedRecord)}>
                  <Printer size={16} />
                  In biên bản
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(previewImageUrl)} onOpenChange={(open) => !open && setPreviewImageUrl('')}>
        <DialogContent className="max-w-4xl p-3 sm:p-5">
          <DialogHeader>
            <DialogTitle>Xem hinh anh minh chung</DialogTitle>
          </DialogHeader>
          {previewImageUrl && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2">
              <img src={previewImageUrl} alt="Minh chung" className="max-h-[75vh] w-full rounded-xl object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Balance Stock All Dialog */}
      <Dialog open={showBalanceModal} onOpenChange={setShowBalanceModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCcw size={18} />
              Cân bằng kho toàn bộ
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Hệ thống sẽ tự động tạo giao dịch Nhập/Xuất kho để cân bằng <strong>toàn bộ</strong> các dòng còn chênh lệch chưa được cân bằng trên biên bản kiểm kê này.
            </p>

            {selectedRecord && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                <div className="text-sm font-semibold text-slate-900">Biên bản: {selectedRecord.id}</div>
                <div className="text-sm text-slate-600">
                  {selectedRecord.items.filter((i) => i.discrepancy !== 0 && !i.isBalanced).length} dòng chênh lệch chưa cân bằng
                </div>
                <div className="space-y-1 max-h-40 overflow-auto">
                  {selectedRecord.items.filter((i) => i.discrepancy !== 0 && !i.isBalanced).map((item) => (
                    <div key={item.id} className="flex justify-between text-xs">
                      <span className="text-slate-700">{item.itemLabel}</span>
                      <span className={item.discrepancy > 0 ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
                        {item.discrepancy > 0 ? `+${item.discrepancy} (Nhập)` : `${item.discrepancy} (Xuất)`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Sau khi cân bằng, hệ thống sẽ tự động tạo giao dịch nhập/xuất kho cho toàn bộ các dòng chưa được cân bằng.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBalanceModal(false)}>
              Đang kiểm tra, chưa cân bằng
            </Button>
            <Button
              className="gap-1 bg-emerald-600 hover:bg-emerald-700"
              onClick={async () => {
                if (!selectedRecord) return;
                try {
                  const res = await api.post(`/stocktaking/${selectedRecord.id}/balance`);
                  alert(res.data.message || 'Cân bằng kho toàn bộ thành công!');
                  setShowBalanceModal(false);
                  await openDetail(selectedRecord.id);
                  await fetchRecords();
                } catch (err: any) {
                  alert(err.response?.data?.message || 'Không thể cân bằng kho');
                }
              }}
            >
              <Check size={14} />
              Xác nhận cân bằng kho toàn bộ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Balance Single Item Dialog */}
      <Dialog open={showItemBalanceModal} onOpenChange={(open) => { setShowItemBalanceModal(open); if (!open) setBalancingItem(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCcw size={18} />
              Cân bằng kho – xác nhận
            </DialogTitle>
          </DialogHeader>

          {balancingItem && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Xác nhận cân bằng kho cho dòng sau? Hệ thống sẽ tạo giao dịch kho ngay lập tức.
              </p>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm">
                <div><span className="font-semibold text-slate-700">Mã:</span> {balancingItem.itemCode}</div>
                <div><span className="font-semibold text-slate-700">Tên:</span> {balancingItem.itemLabel}</div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">Chênh lệch:</span>
                  <span className={`font-bold ${balancingItem.discrepancy > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {balancingItem.discrepancy > 0 ? `+${balancingItem.discrepancy} (Nhập kho)` : `${balancingItem.discrepancy} (Xuất kho)`}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Sau khi xác nhận, dòng này sẽ bị khoá và không thể cân bằng lại.
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowItemBalanceModal(false); setBalancingItem(null); }}>
              Chưa cân bằng
            </Button>
            <Button
              className="gap-1 bg-emerald-600 hover:bg-emerald-700"
              onClick={async () => {
                if (!balancingItem || !selectedRecord) return;
                try {
                  await api.post(`/stocktaking/items/${balancingItem.id}/balance`);
                  setShowItemBalanceModal(false);
                  setBalancingItem(null);
                  await openDetail(selectedRecord.id);
                  await fetchRecords();
                } catch (err: any) {
                  alert(err.response?.data?.message || 'Không thể cân bằng kho cho dòng này');
                }
              }}
            >
              <Check size={14} />
              Xác nhận cân bằng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

