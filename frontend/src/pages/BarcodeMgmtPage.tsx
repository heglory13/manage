import { useCallback, useEffect, useState } from 'react';
import { Check, Eye, Printer, X as XIcon } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { api } from '../services/api';
import { formatNumber } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

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

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  PENDING: { label: 'Chờ duyệt', class: 'border-amber-200 bg-amber-50 text-amber-600' },
  APPROVED: { label: 'Đã duyệt', class: 'border-blue-200 bg-blue-50 text-blue-600' },
  PRINTED: { label: 'Đã in', class: 'border-emerald-200 bg-emerald-50 text-emerald-600' },
  REJECTED: { label: 'Từ chối', class: 'border-rose-200 bg-rose-50 text-rose-600' },
};

function formatCurrency(value: number) {
  return formatNumber(value) + 'đ';
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

const PAPER_LABELS: Record<string, string> = {
  '74x22': 'Khổ 2 tem - 74 x 22 mm',
  '72x22': 'Khổ 2 tem - 72 x 22 mm',
  '40x30': 'Khổ 1 tem - 40 x 30 mm',
  '110x22': 'Khổ 3 tem - 110 x 22 mm',
};

export default function BarcodeMgmtPage() {
  const [activeTab, setActiveTab] = useState<'print-logs' | 'custom-print'>('print-logs');

  // Print logs state
  const [printLogs, setPrintLogs] = useState<PrintLogRow[]>([]);
  const [printLogsLoading, setPrintLogsLoading] = useState(false);
  const [printLogsTotal, setPrintLogsTotal] = useState(0);
  const [detailLog, setDetailLog] = useState<PrintLogRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ salePrice: 0, quantity: 0, paperSize: '' });

  // Custom print template state
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
  const [logoImage, setLogoImage] = useState<string>('');
  const [extraImage, setExtraImage] = useState<string>('');
  const [footerImage, setFooterImage] = useState<string>('');
  const [customPaperSize, setCustomPaperSize] = useState('80');

  const CUSTOM_PAPER_SIZES = [
    { value: '40x30', label: 'Khổ 1 tem - 40 x 30 mm', width: '40mm' },
    { value: '74x22', label: 'Khổ 2 tem - 74 x 22 mm', width: '37mm' },
    { value: '72x22', label: 'Khổ 2 tem - 72 x 22 mm', width: '36mm' },
    { value: '80', label: 'Khổ rộng - 80 mm', width: '80mm' },
    { value: '110x22', label: 'Khổ 3 tem - 110 x 22 mm', width: '36mm' },
  ];

  const fetchPrintLogs = useCallback(async () => {
    setPrintLogsLoading(true);
    try {
      const res = await api.get('/barcode-prints', { params: { limit: 100 } });
      setPrintLogs(res.data.data || []);
      setPrintLogsTotal(res.data.total || 0);
    } catch (err) {
      console.error('Error fetching print logs:', err);
    } finally {
      setPrintLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'print-logs') fetchPrintLogs();
  }, [activeTab, fetchPrintLogs]);

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
    openBarcodePrintWindow([{
      categoryName: log.productName,
      productName: log.productName,
      barcodeValue: log.sku,
      salePrice: Number(log.salePrice),
      quantity: log.quantity,
    }]);
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
      fetchPrintLogs();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể cập nhật phiếu in tem');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-[22px] font-semibold text-slate-950">In tem mã vạch</h2>
          <p className="mt-1 text-[15px] text-slate-500">Quản lý lịch sử in tem và in tem tùy chỉnh.</p>
        </div>

        <div className="flex items-center gap-6 border-b border-slate-200 pb-[2px]">
          {[
            { key: 'print-logs' as const, label: 'Lịch sử in tem' },
            { key: 'custom-print' as const, label: 'In tem tùy chỉnh' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`border-b-2 px-4 py-3 text-[15px] font-medium transition ${
                activeTab === tab.key
                  ? 'border-violet-500 text-violet-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'print-logs' && (
          <Card className="overflow-hidden rounded-[22px]">
            <CardContent className="p-0">
              {printLogsLoading ? (
                <div className="flex h-64 items-center justify-center"><div className="spinner" /></div>
              ) : printLogs.length === 0 ? (
                <div className="py-14 text-center text-slate-500">Chưa có phiếu in tem nào.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Thời gian tạo</TableHead>
                      <TableHead>Người tạo</TableHead>
                      <TableHead>Sản phẩm</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Giá bán</TableHead>
                      <TableHead className="text-right">SL tem</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Duyệt / In</TableHead>
                      <TableHead className="text-right pr-4">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {printLogs.map((log) => {
                      const sc = STATUS_CONFIG[log.status] || STATUS_CONFIG.PENDING;
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="pl-4 text-sm text-slate-600">{formatDateTime(log.createdAt)}</TableCell>
                          <TableCell className="font-medium text-slate-900">{log.userName}</TableCell>
                          <TableCell className="text-sm text-slate-700">{log.productName}</TableCell>
                          <TableCell className="text-xs font-mono text-indigo-600">{log.sku}</TableCell>
                          <TableCell className="text-right text-sm text-slate-700">{formatCurrency(Number(log.salePrice))}</TableCell>
                          <TableCell className="text-right text-lg font-semibold text-slate-900">{formatNumber(log.quantity)}</TableCell>
                          <TableCell>
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${sc.class}`}>
                              {sc.label}
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
                              {log.status === 'APPROVED' && (
                                <Button size="sm" className="h-8 gap-1 bg-blue-600 hover:bg-blue-700" onClick={() => handlePrintFromLog(log)}>
                                  <Printer size={13} /> In tem
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="h-8 text-slate-400" onClick={() => handleDeleteLog(log.id)}>
                                <XIcon size={13} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'custom-print' && (
          <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
            {/* Form */}
            <Card className="rounded-2xl">
              <CardContent className="p-6 space-y-5">
                <h3 className="text-lg font-semibold text-slate-900">Thông tin tem tùy chỉnh</h3>

                {/* Logo upload */}
                <div className="space-y-2">
                  <Label>Logo (hiển thị trên đầu tem)</Label>
                  <div className="flex items-center gap-4">
                    {logoImage ? (
                      <div className="relative">
                        <img src={logoImage} alt="Logo" className="h-16 rounded border" />
                        <button type="button" className="absolute -top-2 -right-2 rounded-full bg-rose-500 p-0.5 text-white" onClick={() => setLogoImage('')}><XIcon size={12} /></button>
                      </div>
                    ) : (
                      <label className="flex h-16 w-32 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-xs text-slate-400 hover:border-violet-400">
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setLogoImage(URL.createObjectURL(f)); }} />
                        + Upload Logo
                      </label>
                    )}
                  </div>
                </div>

                {/* Fields */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Client</Label>
                    <Input value={customForm.client} onChange={(e) => setCustomForm(p => ({ ...p, client: e.target.value }))} placeholder="VD: SLC Education" />
                  </div>
                  <div className="space-y-2">
                    <Label>Product</Label>
                    <Input value={customForm.product} onChange={(e) => setCustomForm(p => ({ ...p, product: e.target.value }))} placeholder="VD: Premium T-shirt" />
                  </div>
                  <div className="space-y-2">
                    <Label>Size</Label>
                    <Input value={customForm.size} onChange={(e) => setCustomForm(p => ({ ...p, size: e.target.value }))} placeholder="VD: S / M / L / XL / XXL" />
                  </div>
                  <div className="space-y-2">
                    <Label>Material</Label>
                    <Input value={customForm.material} onChange={(e) => setCustomForm(p => ({ ...p, material: e.target.value }))} placeholder="VD: Korea Cotton 100%" />
                  </div>
                  <div className="space-y-2">
                    <Label>Original</Label>
                    <Input value={customForm.origin} onChange={(e) => setCustomForm(p => ({ ...p, origin: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Số lượng in</Label>
                    <Input type="number" min={1} value={customForm.quantity} onChange={(e) => setCustomForm(p => ({ ...p, quantity: Number(e.target.value) || 1 }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input value={customForm.website} onChange={(e) => setCustomForm(p => ({ ...p, website: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Slogan</Label>
                    <Input value={customForm.slogan} onChange={(e) => setCustomForm(p => ({ ...p, slogan: e.target.value }))} />
                  </div>
                </div>

                {/* Extra image upload (QR code / hình phụ góc phải) */}
                <div className="space-y-2">
                  <Label>Hình QR Code / Hình phụ (góc phải dòng Original)</Label>
                    {extraImage ? (
                      <div className="relative inline-block">
                        <img src={extraImage} alt="Extra" className="h-20 rounded border" />
                        <button type="button" className="absolute -top-2 -right-2 rounded-full bg-rose-500 p-0.5 text-white" onClick={() => setExtraImage('')}><XIcon size={12} /></button>
                      </div>
                    ) : (
                      <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-xs text-slate-400 hover:border-violet-400">
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setExtraImage(URL.createObjectURL(f)); }} />
                        + Hình
                      </label>
                    )}
                  </div>

                {/* Footer image upload */}
                <div className="space-y-2">
                  <Label>Hình footer (thay thế website + slogan)</Label>
                  <div className="flex items-center gap-4">
                    {footerImage ? (
                      <div className="relative">
                        <img src={footerImage} alt="Footer" className="h-16 rounded border" />
                        <button type="button" className="absolute -top-2 -right-2 rounded-full bg-rose-500 p-0.5 text-white" onClick={() => setFooterImage('')}><XIcon size={12} /></button>
                      </div>
                    ) : (
                      <label className="flex h-16 w-40 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-xs text-slate-400 hover:border-violet-400">
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFooterImage(URL.createObjectURL(f)); }} />
                        + Upload Footer
                      </label>
                    )}
                    <span className="text-xs text-slate-400">Nếu không upload, sẽ hiện Website + Slogan mặc định</span>
                  </div>
                </div>

                {/* Paper size selection */}
                <div className="space-y-2">
                  <Label>Chọn khổ in</Label>
                  <div className="grid gap-2 grid-cols-2 lg:grid-cols-3">
                    {CUSTOM_PAPER_SIZES.map((p) => (
                      <label key={p.value} className={`flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer text-sm transition ${customPaperSize === p.value ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                        <input type="radio" name="customPaperSize" checked={customPaperSize === p.value} onChange={() => setCustomPaperSize(p.value)} />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>

                <Button
                  className="gap-2 bg-violet-600 hover:bg-violet-700"
                  onClick={() => {
                    const pw = window.open('', '_blank', 'width=800,height=600');
                    if (!pw) return;
                    const selectedPaper = CUSTOM_PAPER_SIZES.find((p) => p.value === customPaperSize) || CUSTOM_PAPER_SIZES[3];
                    const labelWidth = selectedPaper.width;
                    const labels = Array.from({ length: customForm.quantity }, () => customForm);
                    pw.document.write(`<!doctype html><html><head><meta charset="UTF-8"><title>In tem tùy chỉnh</title>
<style>
@page { margin: 2mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; }
.sheet { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; padding: 4px; }
.label { width: ${labelWidth}; border: 2px solid #111; padding: 3mm; break-inside: avoid; page-break-inside: avoid; background: #fff; }
.header { text-align: center; border-bottom: 3px solid #111; padding-bottom: 3mm; margin-bottom: 3mm; }
.header .brand { font-size: 22pt; font-weight: 900; letter-spacing: 2px; }
.header .sub { font-size: 14pt; font-style: italic; font-weight: 600; }
.row { display: flex; border-bottom: 2px solid #888; padding: 2mm 0; }
.row .lbl { width: 28mm; font-size: 10pt; font-weight: 600; }
.row .val { flex: 1; font-size: 10pt; font-weight: 700; }
.row:last-child { border-bottom: none; }
.footer { text-align: center; margin-top: 3mm; padding-top: 2mm; border-top: 2px solid #111; }
.footer .web { font-size: 7pt; letter-spacing: 2px; }
.footer .slogan { font-size: 9pt; font-weight: 700; }
.footer-row { display: flex; align-items: center; justify-content: space-between; }
.logo-img { max-height: 14mm; max-width: 30mm; }
.qr-img { max-height: 12mm; max-width: 12mm; }
.extra-img { max-height: 14mm; max-width: 14mm; }
</style></head><body><div class="sheet">
${labels.map(() => `<div class="label">
  <div class="header">
    ${logoImage ? `<img src="${logoImage}" class="logo-img" />` : '<div class="brand">HAVIAS</div>'}
  </div>
  <div class="row"><div class="lbl">Client:</div><div class="val">${customForm.client || '-'}</div></div>
  <div class="row"><div class="lbl">Product:</div><div class="val">${customForm.product || '-'}</div></div>
  <div class="row"><div class="lbl">Size:</div><div class="val">${customForm.size || '-'}</div></div>
  <div class="row"><div class="lbl">Material:</div><div class="val">${customForm.material || '-'}</div></div>
  <div class="row"><div class="lbl">Original:</div><div class="val">${customForm.origin || '-'}</div>${extraImage ? `<img src="${extraImage}" class="extra-img" />` : ''}</div>
  <div class="footer">
      ${footerImage ? `<img src="${footerImage}" style="max-height:16mm;max-width:100%;" />` : `<div class="web">${customForm.website}</div><div class="slogan">━━ ${customForm.slogan} ━━</div>`}
  </div>
</div>`).join('')}
</div><script>window.onload=()=>{window.focus();window.print();};<\/script></body></html>`);
                    pw.document.close();
                  }}
                  disabled={!customForm.client && !customForm.product}
                >
                  <Printer size={16} />
                  In tem tùy chỉnh ({customForm.quantity} tem)
                </Button>
              </CardContent>
            </Card>

            {/* Preview */}
            <Card className="rounded-2xl">
              <CardContent className="p-6">
                <h3 className="text-base font-semibold text-slate-900 mb-4">Xem trước tem</h3>
                <div className="border-2 border-slate-900 bg-white p-4 rounded" style={{ maxWidth: '320px' }}>
                  {/* Header */}
                  <div className="text-center border-b-[3px] border-slate-900 pb-3 mb-3">
                    {logoImage ? (
                      <img src={logoImage} alt="Logo" className="mx-auto max-h-12" />
                    ) : (
                      <div className="text-2xl font-black tracking-wider">HAVIAS</div>
                    )}
                  </div>
                  {/* Rows */}
                  {[
                    { label: 'Client:', value: customForm.client },
                    { label: 'Product:', value: customForm.product },
                    { label: 'Size:', value: customForm.size },
                    { label: 'Material:', value: customForm.material },
                  ].map((r) => (
                    <div key={r.label} className="flex border-b-2 border-slate-300 py-2">
                      <div className="w-24 text-sm font-semibold text-slate-700">{r.label}</div>
                      <div className="flex-1 text-sm font-bold text-slate-900">{r.value || '-'}</div>
                    </div>
                  ))}
                  <div className="flex py-2 items-center">
                    <div className="w-24 text-sm font-semibold text-slate-700">Original:</div>
                    <div className="flex-1 text-sm font-bold text-slate-900">{customForm.origin || '-'}</div>
                    {extraImage && <img src={extraImage} alt="" className="h-10 ml-2" />}
                  </div>
                  {/* Footer */}
                  <div className="border-t-2 border-slate-900 pt-2 mt-2 text-center">
                    {footerImage ? (
                      <img src={footerImage} alt="Footer" className="mx-auto max-h-10" />
                    ) : (
                      <>
                        <div className="text-[8px] tracking-[2px] text-slate-500">{customForm.website}</div>
                        <div className="text-xs font-bold">━━ {customForm.slogan} ━━</div>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailLog} onOpenChange={(open) => { if (!open) { setDetailLog(null); setRejectReason(''); setIsEditing(false); } }}>
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
                <span className={`inline-flex rounded-full border px-4 py-1.5 text-sm font-medium ${(STATUS_CONFIG[detailLog.status] || STATUS_CONFIG.PENDING).class}`}>
                  {(STATUS_CONFIG[detailLog.status] || STATUS_CONFIG.PENDING).label}
                </span>
                <span className="text-sm text-slate-500">{formatDateTime(detailLog.createdAt)}</span>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
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
                  <div className="mt-1 text-lg font-semibold text-slate-900">{formatCurrency(Number(detailLog.salePrice))}</div>
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
                <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                  <div className="text-sm font-semibold text-slate-700">Lịch sử xử lý</div>
                  {detailLog.approvedAt && <div className="text-sm text-emerald-600">✓ Đã duyệt: {formatDateTime(detailLog.approvedAt)}</div>}
                  {detailLog.printedAt && <div className="text-sm text-blue-600">🖨 Đã in: {formatDateTime(detailLog.printedAt)}</div>}
                  {detailLog.rejectReason && <div className="text-sm text-rose-600">✕ Từ chối: {detailLog.rejectReason}</div>}
                </div>
              )}

              {detailLog.status === 'PENDING' && (
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
                <div className="grid gap-2 grid-cols-2">
                  {Object.entries(PAPER_LABELS).map(([value, label]) => (
                    <label key={value} className={`flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer text-sm ${editForm.paperSize === value ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'}`}>
                      <input type="radio" name="editPaperSize" checked={editForm.paperSize === value} onChange={() => setEditForm((prev) => ({ ...prev, paperSize: value }))} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDetailLog(null); setRejectReason(''); setIsEditing(false); }}>
              {isEditing ? 'Hủy' : 'Đóng'}
            </Button>
            {detailLog && !isEditing && detailLog.status === 'PENDING' && (
              <>
                <Button variant="outline" className="gap-1" onClick={() => startEdit(detailLog)}>
                  Sửa phiếu
                </Button>
                <Button variant="outline" className="gap-1 text-rose-600 border-rose-200" onClick={async () => { await handleReject(detailLog.id); setDetailLog(null); setRejectReason(''); }}>
                  <XIcon size={14} /> Từ chối
                </Button>
                <Button className="gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={async () => { await handleApprove(detailLog.id); setDetailLog(null); }}>
                  <Check size={14} /> Duyệt phiếu
                </Button>
              </>
            )}
            {detailLog && !isEditing && detailLog.status === 'APPROVED' && (
              <Button className="gap-1 bg-blue-600 hover:bg-blue-700" onClick={async () => { await handlePrintFromLog(detailLog); setDetailLog(null); }}>
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
