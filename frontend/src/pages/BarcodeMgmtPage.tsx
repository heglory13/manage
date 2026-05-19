import { useCallback, useEffect, useRef, useState } from 'react';
import { BookmarkPlus, Check, Download, Eye, Printer, Search, X as XIcon } from 'lucide-react';
import * as XLSX from 'xlsx';
import AppLayout from '../components/layout/AppLayout';
import { useAuth } from '../contexts/AuthContext';
import { BarcodeProductPrintPanel } from '../components/barcode/BarcodeProductPrintPanel';
import { api } from '../services/api';
import { formatNumber } from '../lib/utils';
import { loadFontForPreview } from '../lib/barcode';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

interface CustomLabelTemplate {
  id: string;
  name: string;
  client?: string | null;
  product?: string | null;
  size?: string | null;
  material?: string | null;
  origin?: string | null;
  website?: string | null;
  slogan?: string | null;
  paperSize?: string | null;
  extraImageData?: string | null;
  logoLine1?: string | null;
  logoLine2?: string | null;
  logoFontFamily?: string | null;
  logoLine2FontFamily?: string | null;
  logoLine1Weight?: number | null;
  logoLine2Weight?: number | null;
  sloganWeight?: number | null;
  websiteFontFamily?: string | null;
  websiteWeight?: number | null;
  sloganFontFamily?: string | null;
  createdAt: string;
}

// Convert ảnh (blob URL hoặc data URL) → base64 JPEG đã resize/compress
// maxW: chiều rộng tối đa (px) — dùng PNG để giữ chất lượng sắc nét cho logo
async function compressImageToBase64(url: string, maxW = 600): Promise<string> {
  if (!url) return '';
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = img.width > maxW ? maxW / img.width : 1;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = url;
  });
}

interface PrintLogRow {
  id: string;
  userName: string;
  productName: string;
  sku: string;
  salePrice: number;
  quantity: number;
  status: 'PENDING' | 'APPROVED' | 'PRINTED' | 'REJECTED';
  paperSize: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  printedAt: string | null;
  rejectReason: string | null;
  createdAt: string;
}

type BarcodeTab = 'product-print' | 'custom-print' | 'print-logs';

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  PENDING: { label: 'Chờ duyệt', class: 'border-amber-200 bg-amber-50 text-amber-600' },
  APPROVED: { label: 'Đã duyệt', class: 'border-blue-200 bg-blue-50 text-blue-600' },
  PRINTED: { label: 'Đã in', class: 'border-emerald-200 bg-emerald-50 text-emerald-600' },
  REJECTED: { label: 'Từ chối', class: 'border-rose-200 bg-rose-50 text-rose-600' },
};

const PAPER_LABELS: Record<string, string> = {
  '74x22': 'Khổ 2 tem - 74 x 22 mm',
  '72x22': 'Khổ 2 tem - 72 x 22 mm',
  '40x30': 'Khổ 1 tem - 40 x 30 mm',
  '110x22': 'Khổ 3 tem - 110 x 22 mm',
  '80': 'Khổ rộng - 80 mm',
};

function formatCurrency(value: number) {
  return `${formatNumber(value)}đ`;
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

function isCustomPrintLog(log: PrintLogRow) {
  return log.sku === 'CUSTOM';
}

function getPrintTypeLabel(log: PrintLogRow) {
  return isCustomPrintLog(log) ? 'In tem tùy chỉnh' : 'In tem sản phẩm';
}

export default function BarcodeMgmtPage() {
  const { user } = useAuth();
  const canCreate = user?.permissions?.barcodePrint?.create ?? false;
  const canEdit = user?.permissions?.barcodePrint?.edit ?? false;
  const canDelete = user?.permissions?.barcodePrint?.delete ?? false;
  const canSave = user?.permissions?.barcodePrint?.save ?? false;

  const [activeTab, setActiveTab] = useState<BarcodeTab>('product-print');
  const [printLogs, setPrintLogs] = useState<PrintLogRow[]>([]);
  const [printLogsLoading, setPrintLogsLoading] = useState(false);
  const [printLogsTotal, setPrintLogsTotal] = useState(0);
  const [plPage, setPlPage] = useState(1);
  const [plPageSize, setPlPageSize] = useState(50);
  const [detailLog, setDetailLog] = useState<PrintLogRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ salePrice: 0, quantity: 0, paperSize: '' });
  const [customForm, setCustomForm] = useState({
    client: '',
    product: '',
    size: '',
    material: '',
    origin: 'Viet Nam',
    website: 'WWW.HAVIAS.ASIA',
    slogan: 'ALWAYS IN YOUR HEART',
    quantity: 1,
  });
  const [logoLine1, setLogoLine1] = useState('HAVIAS');
  const [logoLine2, setLogoLine2] = useState('');
  const [logoFontFamily, setLogoFontFamily] = useState('Arial');
  const [logoLine2FontFamily, setLogoLine2FontFamily] = useState('Arial');
  const [, setFontLoaded] = useState(0);
  const [logoLine1Weight, setLogoLine1Weight] = useState<number>(900);
  const [logoLine2Weight, setLogoLine2Weight] = useState<number>(400);
  const [sloganWeight, setSloganWeight] = useState<number>(700);
  const [websiteFontFamily, setWebsiteFontFamily] = useState('Arial');
  const [websiteWeight, setWebsiteWeight] = useState<number>(400);
  const [sloganFontFamily, setSloganFontFamily] = useState('Arial');
  const [extraImage, setExtraImage] = useState('');
  const [customPaperSize, setCustomPaperSize] = useState('40x30');

  // Template states
  const [templates, setTemplates] = useState<CustomLabelTemplate[]>([]);
  const [templatesTotal, setTemplatesTotal] = useState(0);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const CUSTOM_PAPER_SIZES = [
    { value: '40x30', label: 'Khổ 1 tem - 40 x 30 mm', width: '40mm' },
    { value: '72x22', label: 'Khổ 2 tem - 72 x 22 mm', width: '36mm' },
    { value: '74x22', label: 'Khổ 2 tem - 74 x 22 mm', width: '37mm' },
    { value: '80', label: 'Khổ rộng - 80 mm', width: '80mm' },
    { value: '110x22', label: 'Khổ 3 tem - 110 x 22 mm', width: '36mm' },
  ];

  const fetchPrintLogs = useCallback(async (page = plPage) => {
    setPrintLogsLoading(true);
    try {
      const res = await api.get('/barcode-prints', { params: { limit: plPageSize, page } });
      setPrintLogs(res.data.data || []);
      setPrintLogsTotal(res.data.total || 0);
      setPlPage(page);
    } catch (err) {
      console.error('Error fetching print logs:', err);
    } finally {
      setPrintLogsLoading(false);
    }
  }, [plPageSize, plPage]);

  useEffect(() => {
    if (activeTab === 'print-logs') {
      fetchPrintLogs();
    }
  }, [activeTab, fetchPrintLogs]);

  useEffect(() => { void loadFontForPreview(logoFontFamily).then(() => setFontLoaded(n => n + 1)); }, [logoFontFamily]);
  useEffect(() => { void loadFontForPreview(logoLine2FontFamily).then(() => setFontLoaded(n => n + 1)); }, [logoLine2FontFamily]);
  useEffect(() => { void loadFontForPreview(websiteFontFamily).then(() => setFontLoaded(n => n + 1)); }, [websiteFontFamily]);
  useEffect(() => { void loadFontForPreview(sloganFontFamily).then(() => setFontLoaded(n => n + 1)); }, [sloganFontFamily]);

  const handleApprove = async (id: string) => {
    try {
      await api.patch(`/barcode-prints/${id}/approve`);
      fetchPrintLogs();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể duyệt phiếu in tem');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.patch(`/barcode-prints/${id}/reject`, { reason: rejectReason || undefined });
      fetchPrintLogs();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể từ chối phiếu in tem');
    }
  };

  const handlePrintFromLog = async (log: PrintLogRow) => {
    try {
      await api.patch(`/barcode-prints/${log.id}/printed`);
      fetchPrintLogs();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể đánh dấu đã in');
      return;
    }

    const { openBarcodePrintWindow } = await import('../lib/barcode');
    await openBarcodePrintWindow([{
      categoryName: log.productName,
      productName: log.productName,
      barcodeValue: log.sku,
      salePrice: Number(log.salePrice),
      quantity: log.quantity,
    }], log.paperSize || '72x22');
  };

  const handleDeleteLog = async (id: string) => {
    if (!confirm('Xóa phiếu in tem này?')) return;

    try {
      await api.delete(`/barcode-prints/${id}`);
      fetchPrintLogs();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể xóa phiếu in tem');
    }
  };

  const startEdit = (log: PrintLogRow) => {
    setEditForm({
      salePrice: Number(log.salePrice),
      quantity: log.quantity,
      paperSize: log.paperSize || '',
    });
    setIsEditing(true);
  };

  const submitEdit = async () => {
    if (!detailLog) return;

    try {
      await api.patch(`/barcode-prints/${detailLog.id}`, editForm);
      setIsEditing(false);
      setDetailLog(null);
      await fetchPrintLogs();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể cập nhật phiếu in tem');
    }
  };

  const fetchTemplates = useCallback(async (search = templateSearch) => {
    setTemplatesLoading(true);
    try {
      const res = await api.get('/barcode-prints/templates', { params: { search: search || undefined, limit: 50 } });
      setTemplates(res.data.data || []);
      setTemplatesTotal(res.data.total || 0);
    } catch {
      // silent
    } finally {
      setTemplatesLoading(false);
    }
  }, [templateSearch]);

  useEffect(() => {
    if (activeTab === 'custom-print') fetchTemplates('');
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps


  const handleTemplateSearchChange = (val: string) => {
    setTemplateSearch(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => fetchTemplates(val), 300);
  };

  const handleSaveTemplate = async () => {
    if (!saveName.trim()) return;
    setSavingTemplate(true);
    try {
      const extraImageData = await compressImageToBase64(extraImage, 6400);
      await api.post('/barcode-prints/templates', {
        name: saveName.trim(),
        client: customForm.client || undefined,
        product: customForm.product || undefined,
        size: customForm.size || undefined,
        material: customForm.material || undefined,
        origin: customForm.origin || undefined,
        website: customForm.website || undefined,
        slogan: customForm.slogan || undefined,
        paperSize: customPaperSize || undefined,
        extraImageData: extraImageData || undefined,
        logoLine1: logoLine1 || undefined,
        logoLine2: logoLine2 || undefined,
        logoFontFamily: logoFontFamily || undefined,
        logoLine2FontFamily: logoLine2FontFamily || undefined,
        logoLine1Weight: logoLine1Weight || undefined,
        logoLine2Weight: logoLine2Weight || undefined,
        sloganWeight: sloganWeight || undefined,
        websiteFontFamily: websiteFontFamily || undefined,
        websiteWeight: websiteWeight || undefined,
        sloganFontFamily: sloganFontFamily || undefined,
      });
      setShowSaveDialog(false);
      setSaveName('');
      fetchTemplates(templateSearch);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể lưu template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleLoadTemplate = (tpl: CustomLabelTemplate) => {
    setCustomForm((prev) => ({
      ...prev,
      client:   tpl.client   ?? prev.client,
      product:  tpl.product  ?? prev.product,
      size:     tpl.size     ?? prev.size,
      material: tpl.material ?? prev.material,
      origin:   tpl.origin   ?? prev.origin,
      website:  tpl.website  ?? prev.website,
      slogan:   tpl.slogan   ?? prev.slogan,
    }));
    if (tpl.paperSize) setCustomPaperSize(tpl.paperSize);
    if (tpl.extraImageData !== undefined) setExtraImage(tpl.extraImageData || '');
    if (tpl.logoLine1 != null) setLogoLine1(tpl.logoLine1);
    if (tpl.logoLine2 != null) setLogoLine2(tpl.logoLine2);
    if (tpl.logoFontFamily != null) setLogoFontFamily(tpl.logoFontFamily);
    if (tpl.logoLine2FontFamily != null) setLogoLine2FontFamily(tpl.logoLine2FontFamily);
    if (tpl.logoLine1Weight != null) setLogoLine1Weight(tpl.logoLine1Weight);
    if (tpl.logoLine2Weight != null) setLogoLine2Weight(tpl.logoLine2Weight);
    if (tpl.sloganWeight != null) setSloganWeight(tpl.sloganWeight);
    if (tpl.websiteFontFamily != null) setWebsiteFontFamily(tpl.websiteFontFamily);
    if (tpl.websiteWeight != null) setWebsiteWeight(tpl.websiteWeight);
    if (tpl.sloganFontFamily != null) setSloganFontFamily(tpl.sloganFontFamily);
  };

  const handlePrintFromTemplate = async (tpl: CustomLabelTemplate) => {
    const qty   = customForm.quantity;
    const paper = tpl.paperSize ?? customPaperSize;
    try {
      await Promise.all([
        loadFontForPreview(tpl.logoFontFamily ?? logoFontFamily),
        loadFontForPreview(tpl.logoLine2FontFamily ?? logoLine2FontFamily),
        loadFontForPreview(tpl.websiteFontFamily ?? websiteFontFamily),
        loadFontForPreview(tpl.sloganFontFamily ?? sloganFontFamily),
      ]);
      const { openCustomBarcodePrintPdf } = await import('../lib/barcode');
      await openCustomBarcodePrintPdf(
        {
          client:         tpl.client   || '',
          product:        tpl.product  || '',
          size:           tpl.size     || '',
          material:       tpl.material || '',
          origin:         tpl.origin   || '',
          website:        tpl.website  || 'WWW.HAVIAS.ASIA',
          slogan:         tpl.slogan   || 'ALWAYS IN YOUR HEART',
          logoLine1:           tpl.logoLine1           ?? logoLine1,
          logoLine2:           tpl.logoLine2           ?? logoLine2,
          logoFontFamily:      tpl.logoFontFamily      ?? logoFontFamily,
          logoLine2FontFamily: tpl.logoLine2FontFamily ?? logoLine2FontFamily,
          logoLine1Weight:     tpl.logoLine1Weight     ?? logoLine1Weight,
          logoLine2Weight:     tpl.logoLine2Weight     ?? logoLine2Weight,
          sloganWeight:        tpl.sloganWeight        ?? sloganWeight,
          websiteFontFamily:   tpl.websiteFontFamily   ?? websiteFontFamily,
          websiteWeight:       tpl.websiteWeight       ?? websiteWeight,
          sloganFontFamily:    tpl.sloganFontFamily    ?? sloganFontFamily,
          extraImage:     tpl.extraImageData || '',
        },
        qty,
        paper,
      );
    } catch (err) {
      console.error('Lỗi tạo PDF:', err);
      alert('Không thể tạo file PDF. Vui lòng thử lại.');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Xóa template tem này?')) return;
    try {
      await api.delete(`/barcode-prints/templates/${id}`);
      fetchTemplates(templateSearch);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể xóa template');
    }
  };

  const handleCustomPrint = async () => {
    try {
      await api.post('/barcode-prints/custom', {
        client: customForm.client,
        product: customForm.product,
        quantity: customForm.quantity,
        paperSize: customPaperSize,
      });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể lưu lịch sử in tem tùy chỉnh');
      return;
    }

    try {
      await Promise.all([
        loadFontForPreview(logoFontFamily),
        loadFontForPreview(logoLine2FontFamily),
        loadFontForPreview(websiteFontFamily),
        loadFontForPreview(sloganFontFamily),
      ]);
      const { openCustomBarcodePrintPdf } = await import('../lib/barcode');
      await openCustomBarcodePrintPdf(
        {
          client:         customForm.client,
          product:        customForm.product,
          size:           customForm.size,
          material:       customForm.material,
          origin:         customForm.origin,
          website:        customForm.website,
          slogan:         customForm.slogan,
          logoLine1,
          logoLine2,
          logoFontFamily,
          logoLine2FontFamily,
          logoLine1Weight,
          logoLine2Weight,
          sloganWeight,
          websiteFontFamily,
          websiteWeight,
          sloganFontFamily,
          extraImage,
        },
        customForm.quantity,
        customPaperSize,
      );
    } catch (err) {
      console.error('Lỗi tạo PDF:', err);
      alert('Không thể tạo file PDF. Vui lòng thử lại.');
    }
  };

  const handleExportExcel = () => {
    const data = printLogs.map((log) => ({
      'Thời gian tạo': formatDateTime(log.createdAt),
      'Người tạo': log.userName,
      'Sản phẩm': log.productName,
      'SKU': log.sku,
      'Giá bán': isCustomPrintLog(log) ? '-' : Number(log.salePrice),
      'Số lượng tem': log.quantity,
      'Trạng thái': (STATUS_CONFIG[log.status] || STATUS_CONFIG.PENDING).label,
      'Khổ in': log.paperSize ? (PAPER_LABELS[log.paperSize] || log.paperSize) : '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lịch sử in tem');
    XLSX.writeFile(wb, 'lich-su-in-tem.xlsx');
  };

  const resetDetailDialog = () => {
    setDetailLog(null);
    setRejectReason('');
    setIsEditing(false);
  };

  const canEditPendingLog = detailLog && !isCustomPrintLog(detailLog) && detailLog.status === 'PENDING' && (canSave || canEdit);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-[22px] font-semibold text-slate-950">In tem mã vạch</h2>
          <p className="mt-1 text-[15px] text-slate-500">Gồm in tem sản phẩm, in tem tùy chỉnh và lịch sử in tem chung.</p>
        </div>

        <div className="flex overflow-x-auto border-b border-slate-200 pb-[2px] scrollbar-none">
          {[
            { key: 'product-print' as const, label: 'In tem sản phẩm' },
            { key: 'custom-print' as const, label: 'In tem tùy chỉnh' },
            { key: 'print-logs' as const, label: `Lịch sử in Tem${printLogsTotal ? ` (${printLogsTotal})` : ''}` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-[15px] font-medium transition ${
                activeTab === tab.key
                  ? 'border-violet-500 text-violet-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'product-print' && (
          <BarcodeProductPrintPanel embedded onCreated={() => setActiveTab('print-logs')} />
        )}

        {activeTab === 'custom-print' && (
          <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
            <Card className="rounded-2xl">
              <CardContent className="space-y-5 p-6">
                <h3 className="text-lg font-semibold text-slate-900">Thông tin tem tùy chỉnh</h3>

                <div className="space-y-2">
                  <Label>Logo (hiển thị trên đầu tem)</Label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Dòng 1 (lớn)</Label>
                      <Input value={logoLine1} onChange={(e) => setLogoLine1(e.target.value)} placeholder="VD: HAVIAS" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Dòng 2 (nhỏ)</Label>
                      <Input value={logoLine2} onChange={(e) => setLogoLine2(e.target.value)} placeholder="VD: Factory" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Font chữ dòng 1</Label>
                      <select
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        value={logoFontFamily}
                        onChange={(e) => setLogoFontFamily(e.target.value)}
                      >
                        {[
                          { label: 'Arial (System — PDF in NotoSans)', value: 'Arial' },
                          { label: 'Georgia (System — PDF in NotoSans)', value: 'Georgia' },
                          { label: 'Impact (System — PDF in NotoSans)', value: 'Impact' },
                          { label: 'Courier New (System — PDF in NotoSans)', value: 'Courier New' },
                          { label: 'UTM AVO', value: 'UTM AVO' },
                          { label: 'Arkhip', value: 'Arkhip' },
                          { label: 'Roboto', value: 'Roboto' },
                          { label: 'Lato', value: 'Lato' },
                          { label: 'Montserrat', value: 'Montserrat' },
                          { label: 'Poppins', value: 'Poppins' },
                          { label: 'Raleway', value: 'Raleway' },
                          { label: 'Oswald', value: 'Oswald' },
                          { label: 'Nunito', value: 'Nunito' },
                          { label: 'Ubuntu', value: 'Ubuntu' },
                          { label: 'Playfair Display', value: 'Playfair Display' },
                          { label: 'Cormorant Garamond', value: 'Cormorant Garamond' },
                          { label: 'Cinzel', value: 'Cinzel' },
                          { label: 'Bebas Neue', value: 'Bebas Neue' },
                          { label: 'Pacifico', value: 'Pacifico' },
                          { label: 'Dancing Script', value: 'Dancing Script' },
                          { label: 'Source Code Pro', value: 'Source Code Pro' },
                        ].map((f) => (
                          <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Font chữ dòng 2</Label>
                      <select
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        value={logoLine2FontFamily}
                        onChange={(e) => setLogoLine2FontFamily(e.target.value)}
                      >
                        {[
                          { label: 'Arial (System — PDF in NotoSans)', value: 'Arial' },
                          { label: 'Georgia (System — PDF in NotoSans)', value: 'Georgia' },
                          { label: 'Impact (System — PDF in NotoSans)', value: 'Impact' },
                          { label: 'Courier New (System — PDF in NotoSans)', value: 'Courier New' },
                          { label: 'UTM AVO', value: 'UTM AVO' },
                          { label: 'Arkhip', value: 'Arkhip' },
                          { label: 'Roboto', value: 'Roboto' },
                          { label: 'Lato', value: 'Lato' },
                          { label: 'Montserrat', value: 'Montserrat' },
                          { label: 'Poppins', value: 'Poppins' },
                          { label: 'Raleway', value: 'Raleway' },
                          { label: 'Oswald', value: 'Oswald' },
                          { label: 'Nunito', value: 'Nunito' },
                          { label: 'Ubuntu', value: 'Ubuntu' },
                          { label: 'Playfair Display', value: 'Playfair Display' },
                          { label: 'Cormorant Garamond', value: 'Cormorant Garamond' },
                          { label: 'Cinzel', value: 'Cinzel' },
                          { label: 'Bebas Neue', value: 'Bebas Neue' },
                          { label: 'Pacifico', value: 'Pacifico' },
                          { label: 'Dancing Script', value: 'Dancing Script' },
                          { label: 'Source Code Pro', value: 'Source Code Pro' },
                        ].map((f) => (
                          <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Độ đậm dòng 1</Label>
                      <select
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        value={logoLine1Weight}
                        onChange={(e) => setLogoLine1Weight(Number(e.target.value))}
                      >
                        <option value={400}>Normal (400)</option>
                        <option value={700}>Bold (700)</option>
                        <option value={900}>Black (900) — PDF in là Bold</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Độ đậm dòng 2</Label>
                      <select
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        value={logoLine2Weight}
                        onChange={(e) => setLogoLine2Weight(Number(e.target.value))}
                      >
                        <option value={300}>Light (300)</option>
                        <option value={400}>Normal (400)</option>
                        <option value={700}>Bold (700)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Client</Label>
                    <Input value={customForm.client} onChange={(e) => setCustomForm((prev) => ({ ...prev, client: e.target.value }))} placeholder="VD: SLC Education" />
                  </div>
                  <div className="space-y-2">
                    <Label>Product</Label>
                    <Input value={customForm.product} onChange={(e) => setCustomForm((prev) => ({ ...prev, product: e.target.value }))} placeholder="VD: Premium T-shirt" />
                  </div>
                  <div className="space-y-2">
                    <Label>Size</Label>
                    <Input value={customForm.size} onChange={(e) => setCustomForm((prev) => ({ ...prev, size: e.target.value }))} placeholder="VD: S / M / L / XL / XXL" />
                  </div>
                  <div className="space-y-2">
                    <Label>Material</Label>
                    <Input value={customForm.material} onChange={(e) => setCustomForm((prev) => ({ ...prev, material: e.target.value }))} placeholder="VD: Korea Cotton 100%" />
                  </div>
                  <div className="space-y-2">
                    <Label>Original</Label>
                    <Input value={customForm.origin} onChange={(e) => setCustomForm((prev) => ({ ...prev, origin: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Số lượng in</Label>
                    <Input type="number" min={1} value={customForm.quantity} onChange={(e) => setCustomForm((prev) => ({ ...prev, quantity: Number(e.target.value) || 1 }))} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Website / Slogan (footer)</Label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Website</Label>
                      <Input value={customForm.website} onChange={(e) => setCustomForm((prev) => ({ ...prev, website: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Slogan</Label>
                      <Input value={customForm.slogan} onChange={(e) => setCustomForm((prev) => ({ ...prev, slogan: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Font chữ Website</Label>
                      <select
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        value={websiteFontFamily}
                        onChange={(e) => setWebsiteFontFamily(e.target.value)}
                      >
                        {[
                          { label: 'Arial (System — PDF in NotoSans)', value: 'Arial' },
                          { label: 'Georgia (System — PDF in NotoSans)', value: 'Georgia' },
                          { label: 'Impact (System — PDF in NotoSans)', value: 'Impact' },
                          { label: 'Courier New (System — PDF in NotoSans)', value: 'Courier New' },
                          { label: 'UTM AVO', value: 'UTM AVO' },
                          { label: 'Arkhip', value: 'Arkhip' },
                          { label: 'Roboto', value: 'Roboto' },
                          { label: 'Lato', value: 'Lato' },
                          { label: 'Montserrat', value: 'Montserrat' },
                          { label: 'Poppins', value: 'Poppins' },
                          { label: 'Raleway', value: 'Raleway' },
                          { label: 'Oswald', value: 'Oswald' },
                          { label: 'Nunito', value: 'Nunito' },
                          { label: 'Ubuntu', value: 'Ubuntu' },
                          { label: 'Playfair Display', value: 'Playfair Display' },
                          { label: 'Cormorant Garamond', value: 'Cormorant Garamond' },
                          { label: 'Cinzel', value: 'Cinzel' },
                          { label: 'Bebas Neue', value: 'Bebas Neue' },
                          { label: 'Pacifico', value: 'Pacifico' },
                          { label: 'Dancing Script', value: 'Dancing Script' },
                          { label: 'Source Code Pro', value: 'Source Code Pro' },
                        ].map((f) => (
                          <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Font chữ Slogan</Label>
                      <select
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        value={sloganFontFamily}
                        onChange={(e) => setSloganFontFamily(e.target.value)}
                      >
                        {[
                          { label: 'Arial (System — PDF in NotoSans)', value: 'Arial' },
                          { label: 'Georgia (System — PDF in NotoSans)', value: 'Georgia' },
                          { label: 'Impact (System — PDF in NotoSans)', value: 'Impact' },
                          { label: 'Courier New (System — PDF in NotoSans)', value: 'Courier New' },
                          { label: 'UTM AVO', value: 'UTM AVO' },
                          { label: 'Arkhip', value: 'Arkhip' },
                          { label: 'Roboto', value: 'Roboto' },
                          { label: 'Lato', value: 'Lato' },
                          { label: 'Montserrat', value: 'Montserrat' },
                          { label: 'Poppins', value: 'Poppins' },
                          { label: 'Raleway', value: 'Raleway' },
                          { label: 'Oswald', value: 'Oswald' },
                          { label: 'Nunito', value: 'Nunito' },
                          { label: 'Ubuntu', value: 'Ubuntu' },
                          { label: 'Playfair Display', value: 'Playfair Display' },
                          { label: 'Cormorant Garamond', value: 'Cormorant Garamond' },
                          { label: 'Cinzel', value: 'Cinzel' },
                          { label: 'Bebas Neue', value: 'Bebas Neue' },
                          { label: 'Pacifico', value: 'Pacifico' },
                          { label: 'Dancing Script', value: 'Dancing Script' },
                          { label: 'Source Code Pro', value: 'Source Code Pro' },
                        ].map((f) => (
                          <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Độ đậm Website</Label>
                      <select
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        value={websiteWeight}
                        onChange={(e) => setWebsiteWeight(Number(e.target.value))}
                      >
                        <option value={400}>Normal (400)</option>
                        <option value={700}>Bold (700)</option>
                        <option value={900}>Black (900) — PDF in là Bold</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Độ đậm Slogan</Label>
                      <select
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        value={sloganWeight}
                        onChange={(e) => setSloganWeight(Number(e.target.value))}
                      >
                        <option value={400}>Normal (400)</option>
                        <option value={700}>Bold (700)</option>
                        <option value={900}>Black (900) — PDF in là Bold</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Hình QR Code / Hình phụ (góc phải dòng Original)</Label>
                  {extraImage ? (
                    <div className="relative inline-block">
                      <img src={extraImage} alt="Extra" className="h-20 rounded border" />
                      <button type="button" className="absolute -right-2 -top-2 rounded-full bg-rose-500 p-0.5 text-white" onClick={() => setExtraImage('')}>
                        <XIcon size={12} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-xs text-slate-400 hover:border-violet-400">
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setExtraImage(URL.createObjectURL(file)); }} />
                      + Hình
                    </label>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Chọn khổ in</Label>
                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                    {CUSTOM_PAPER_SIZES.map((paper) => (
                      <label
                        key={paper.value}
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                          customPaperSize === paper.value ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input type="radio" name="customPaperSize" checked={customPaperSize === paper.value} onChange={() => setCustomPaperSize(paper.value)} />
                        {paper.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button className="gap-2 bg-violet-600 hover:bg-violet-700" onClick={handleCustomPrint} disabled={!canCreate || (!customForm.client && !customForm.product)}>
                    <Printer size={16} />
                    In tem tùy chỉnh ({customForm.quantity} tem)
                  </Button>
                  <Button variant="outline" className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => { setSaveName(customForm.client || customForm.product || ''); setShowSaveDialog(true); }} disabled={!customForm.client && !customForm.product}>
                    <BookmarkPlus size={16} />
                    Lưu tem
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardContent className="p-6">
                <h3 className="mb-4 text-base font-semibold text-slate-900">Xem trước tem</h3>
                <div
                  className="border border-slate-900 bg-white"
                  style={{ maxWidth: '280px', fontFamily: 'Arial, sans-serif', padding: '6px 8px' }}
                >
                  {/* Header */}
                  <div className="border-b border-slate-900 pb-1" style={{ marginBottom: '4px' }}>
                    <div style={{ lineHeight: 1, padding: '2px 0', textAlign: 'center' }}>
                      <div style={{ display: 'inline-block', lineHeight: 1 }}>
                        {logoLine1 && (
                          <div style={{ fontSize: '22px', fontWeight: logoLine1Weight, fontFamily: logoFontFamily, color: '#000', lineHeight: 1, display: 'block' }}>{logoLine1}</div>
                        )}
                        {logoLine2 && (
                          <div style={{ fontSize: '13px', fontWeight: logoLine2Weight, fontFamily: logoLine2FontFamily, color: '#000', lineHeight: 1, marginTop: '0px', display: 'block', textAlign: 'right' }}>{logoLine2}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Data rows */}
                  {[
                    { label: 'Client:', value: customForm.client },
                    { label: 'Product:', value: customForm.product },
                    { label: 'Size:', value: customForm.size },
                    { label: 'Material:', value: customForm.material },
                  ].map((row) => (
                    <div key={row.label} className="flex" style={{ borderBottom: '0.5px solid #ccc', padding: '2px 0' }}>
                      <div style={{ width: '68px', fontSize: '10px', color: '#000', flexShrink: 0 }}>{row.label}</div>
                      <div style={{ flex: 1, fontSize: '10px', color: '#000' }}>{row.value || '-'}</div>
                    </div>
                  ))}

                  {/* Orginal row */}
                  <div className="flex items-center" style={{ padding: '2px 0' }}>
                    <div style={{ width: '68px', fontSize: '10px', color: '#000', flexShrink: 0 }}>Orginal:</div>
                    <div style={{ flex: 1, fontSize: '10px', color: '#000' }}>{customForm.origin || '-'}</div>
                    {extraImage && <img src={extraImage} alt="" style={{ marginLeft: '4px', height: '20px' }} />}
                  </div>

                  {/* Footer */}
                  <div className="border-t border-slate-900 text-center" style={{ marginTop: '4px', paddingTop: '3px' }}>
                    {customForm.website && (
                      <div style={{ fontSize: '6px', color: '#999', fontFamily: websiteFontFamily, fontWeight: websiteWeight }}>{customForm.website}</div>
                    )}
                    <div style={{ fontSize: '8px', fontWeight: sloganWeight, color: '#000', fontFamily: sloganFontFamily }}>── {customForm.slogan} ──</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Panel tem đã lưu ─────────────────────────────────────────── */}
          <Card className="rounded-2xl overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
                <h3 className="text-base font-semibold text-slate-900">
                  Tem đã lưu
                  {templatesTotal > 0 && (
                    <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">{templatesTotal}</span>
                  )}
                </h3>
                <div className="relative w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm theo tên, client, sản phẩm..."
                    value={templateSearch}
                    onChange={(e) => handleTemplateSearchChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200"
                  />
                </div>
              </div>

              {templatesLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <div className="spinner" />
                </div>
              ) : templates.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">
                  {templateSearch ? 'Không tìm thấy template nào.' : 'Chưa có tem nào được lưu.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium text-slate-500">
                        <th className="px-4 py-2.5">Tên</th>
                        <th className="px-3 py-2.5">Client</th>
                        <th className="px-3 py-2.5">Sản phẩm</th>
                        <th className="px-3 py-2.5">Size</th>
                        <th className="px-3 py-2.5">Material</th>
                        <th className="px-3 py-2.5">Khổ</th>
                        <th className="px-4 py-2.5 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {templates.map((tpl) => (
                        <tr key={tpl.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-medium text-slate-900">{tpl.name}</td>
                          <td className="px-3 py-2.5 text-slate-600">{tpl.client || '-'}</td>
                          <td className="px-3 py-2.5 text-slate-600">{tpl.product || '-'}</td>
                          <td className="px-3 py-2.5 text-slate-500">{tpl.size || '-'}</td>
                          <td className="px-3 py-2.5 text-slate-500">{tpl.material || '-'}</td>
                          <td className="px-3 py-2.5 text-slate-500">{tpl.paperSize ? (PAPER_LABELS[tpl.paperSize] || tpl.paperSize) : '-'}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleLoadTemplate(tpl)}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Load
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePrintFromTemplate(tpl)}
                                className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-700"
                              >
                                <Printer size={11} className="mr-1 inline" />
                                In
                              </button>
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTemplate(tpl.id)}
                                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                                >
                                  <XIcon size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          </div>
        )}

        {activeTab === 'print-logs' && (
          <Card className="overflow-hidden rounded-[22px]">
            <CardContent className="p-0">
              <div className="flex items-center justify-end px-4 py-3 border-b border-slate-200">
                <Button variant="outline" className="gap-2" onClick={handleExportExcel}>
                  <Download size={16} />
                  Xuất Excel
                </Button>
              </div>
              {printLogsLoading ? (
                <div className="flex h-64 items-center justify-center"><div className="spinner" /></div>
              ) : printLogs.length === 0 ? (
                <div className="py-14 text-center text-slate-500">Chưa có phiếu in tem nào.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Thời gian tạo</TableHead>
                      <TableHead>Loại in</TableHead>
                      <TableHead>Người tạo</TableHead>
                      <TableHead>Sản phẩm</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Giá bán</TableHead>
                      <TableHead className="text-right">SL tem</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Duyệt / In</TableHead>
                      <TableHead className="pr-4 text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {printLogs.map((log) => {
                      const statusConfig = STATUS_CONFIG[log.status] || STATUS_CONFIG.PENDING;
                      const customLog = isCustomPrintLog(log);

                      return (
                        <TableRow key={log.id}>
                          <TableCell className="pl-4 text-sm text-slate-600">{formatDateTime(log.createdAt)}</TableCell>
                          <TableCell>
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${customLog ? 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700' : 'border-sky-200 bg-sky-50 text-sky-700'}`}>
                              {getPrintTypeLabel(log)}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium text-slate-900">{log.userName}</TableCell>
                          <TableCell className="text-sm text-slate-700">{log.productName}</TableCell>
                          <TableCell className="text-xs font-mono text-indigo-600">{log.sku}</TableCell>
                          <TableCell className="text-right text-sm text-slate-700">{customLog ? '-' : formatCurrency(Number(log.salePrice))}</TableCell>
                          <TableCell className="text-right text-lg font-semibold text-slate-900">{formatNumber(log.quantity)}</TableCell>
                          <TableCell>
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusConfig.class}`}>
                              {statusConfig.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">
                            {log.approvedAt && <div>Duyệt: {formatDateTime(log.approvedAt)}</div>}
                            {log.printedAt && <div>In: {formatDateTime(log.printedAt)}</div>}
                            {log.rejectReason && <div className="text-rose-500">Lý do: {log.rejectReason}</div>}
                          </TableCell>
                          <TableCell className="pr-4">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setDetailLog(log)}>
                                <Eye size={13} /> Chi tiết
                              </Button>
                              {!customLog && log.status === 'APPROVED' && (
                                <Button size="sm" className="h-8 gap-1 bg-blue-600 hover:bg-blue-700" onClick={() => handlePrintFromLog(log)}>
                                  <Printer size={13} /> In tem
                                </Button>
                              )}
                              {canDelete && (
                                <Button size="sm" variant="outline" className="h-8 text-slate-400" onClick={() => handleDeleteLog(log.id)}>
                                  <XIcon size={13} />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}

              {/* Pagination */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span>Hiển thị</span>
                  <select
                    className="form-select page-size-select h-9 w-20 text-sm"
                    value={plPageSize}
                    onChange={(e) => { setPlPageSize(Number(e.target.value)); setPlPage(1); }}
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                  <span>/ trang • Tổng {printLogsTotal} mục</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" disabled={plPage <= 1} onClick={() => fetchPrintLogs(plPage - 1)}>
                    Trước
                  </Button>
                  <span className="px-3 text-sm font-medium text-slate-700">
                    Trang {plPage} / {Math.ceil(printLogsTotal / plPageSize) || 1}
                  </span>
                  <Button variant="outline" size="sm" disabled={plPage >= Math.ceil(printLogsTotal / plPageSize)} onClick={() => fetchPrintLogs(plPage + 1)}>
                    Sau
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Dialog lưu template tem ─────────────────────────────────────── */}
      <Dialog open={showSaveDialog} onOpenChange={(open) => { if (!open) { setShowSaveDialog(false); setSaveName(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookmarkPlus size={18} />
              Lưu tem tùy chỉnh
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-slate-500">Đặt tên gợi nhớ để tìm lại dễ hơn sau này.</p>
            <div className="space-y-1.5">
              <Label>Tên template</Label>
              <Input
                autoFocus
                placeholder="VD: SLC - Premium T-shirt / HAVIAS mùa hè..."
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTemplate(); }}
              />
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500 space-y-0.5">
              {customForm.client && <div><span className="font-medium">Client:</span> {customForm.client}</div>}
              {customForm.product && <div><span className="font-medium">Product:</span> {customForm.product}</div>}
              {customForm.size && <div><span className="font-medium">Size:</span> {customForm.size}</div>}
              {customForm.material && <div><span className="font-medium">Material:</span> {customForm.material}</div>}
              <div><span className="font-medium">Khổ:</span> {PAPER_LABELS[customPaperSize] || customPaperSize}</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Hủy</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveTemplate} disabled={!saveName.trim() || savingTemplate}>
              {savingTemplate ? 'Đang lưu...' : 'Lưu template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailLog} onOpenChange={(open) => { if (!open) resetDetailDialog(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye size={18} />
              {isEditing ? 'Sửa phiếu in tem' : 'Chi tiết phiếu in tem'}
            </DialogTitle>
          </DialogHeader>

          {detailLog && !isEditing && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex rounded-full border px-4 py-1.5 text-sm font-medium ${(STATUS_CONFIG[detailLog.status] || STATUS_CONFIG.PENDING).class}`}>
                    {(STATUS_CONFIG[detailLog.status] || STATUS_CONFIG.PENDING).label}
                  </span>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${isCustomPrintLog(detailLog) ? 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700' : 'border-sky-200 bg-sky-50 text-sky-700'}`}>
                    {getPrintTypeLabel(detailLog)}
                  </span>
                </div>
                <span className="text-sm text-slate-500">{formatDateTime(detailLog.createdAt)}</span>
              </div>

              <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-lg font-semibold text-slate-900">{detailLog.productName}</div>
                <div className="text-sm font-mono text-indigo-600">{detailLog.sku}</div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm text-slate-500">Người tạo</div>
                  <div className="mt-1 font-semibold text-slate-900">{detailLog.userName}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm text-slate-500">Giá bán</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {isCustomPrintLog(detailLog) ? '-' : formatCurrency(Number(detailLog.salePrice))}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm text-slate-500">Số lượng tem</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{formatNumber(detailLog.quantity)}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm text-slate-500">Khổ in</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {detailLog.paperSize ? (PAPER_LABELS[detailLog.paperSize] || detailLog.paperSize) : 'Chưa chọn'}
                  </div>
                </div>
              </div>

              {(detailLog.approvedAt || detailLog.printedAt || detailLog.rejectReason) && (
                <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-700">Lịch sử xử lý</div>
                  {detailLog.approvedAt && <div className="text-sm text-emerald-600">Đã duyệt: {formatDateTime(detailLog.approvedAt)}</div>}
                  {detailLog.printedAt && <div className="text-sm text-blue-600">Đã in: {formatDateTime(detailLog.printedAt)}</div>}
                  {detailLog.rejectReason && <div className="text-sm text-rose-600">Từ chối: {detailLog.rejectReason}</div>}
                </div>
              )}

              {canEditPendingLog && (
                <div className="space-y-2">
                  <Label>Lý do từ chối (nếu từ chối)</Label>
                  <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Nhập lý do nếu muốn từ chối..." />
                </div>
              )}
            </div>
          )}

          {detailLog && isEditing && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-lg font-semibold text-slate-900">{detailLog.productName}</div>
                <div className="text-sm font-mono text-indigo-600">{detailLog.sku}</div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Giá bán (VND)</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={editForm.salePrice ? formatNumber(editForm.salePrice) : ''}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      setEditForm((prev) => ({ ...prev, salePrice: Number(raw) || 0 }));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Số lượng tem</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editForm.quantity}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, quantity: Number(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Khổ in</Label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(PAPER_LABELS)
                    .filter(([value]) => value !== '80')
                    .map(([value, label]) => (
                      <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${editForm.paperSize === value ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'}`}>
                        <input type="radio" name="editPaperSize" checked={editForm.paperSize === value} onChange={() => setEditForm((prev) => ({ ...prev, paperSize: value }))} />
                        {label}
                      </label>
                    ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={resetDetailDialog}>
              {isEditing ? 'Hủy' : 'Đóng'}
            </Button>
            {canEditPendingLog && !isEditing && (
              <>
                <Button variant="outline" className="gap-1" onClick={() => startEdit(detailLog)}>
                  Sửa phiếu
                </Button>
                <Button variant="outline" className="gap-1 border-rose-200 text-rose-600" onClick={async () => { await handleReject(detailLog.id); resetDetailDialog(); }}>
                  <XIcon size={14} /> Từ chối
                </Button>
                <Button className="gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={async () => { await handleApprove(detailLog.id); resetDetailDialog(); }}>
                  <Check size={14} /> Duyệt phiếu
                </Button>
              </>
            )}
            {detailLog && !isEditing && !isCustomPrintLog(detailLog) && detailLog.status === 'APPROVED' && (
              <Button className="gap-1 bg-blue-600 hover:bg-blue-700" onClick={async () => { await handlePrintFromLog(detailLog); resetDetailDialog(); }}>
                <Printer size={14} /> In tem
              </Button>
            )}
            {isEditing && (
              <Button className="gap-1 bg-violet-600 hover:bg-violet-700" onClick={submitEdit} disabled={editForm.quantity <= 0 || editForm.salePrice <= 0}>
                Lưu thay đổi
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
