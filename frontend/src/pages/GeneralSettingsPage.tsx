import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, Save, Search, Trash2, Upload } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { compressImageForUpload } from '../lib/image';
import { api } from '../services/api';
import {
  defaultGeneralSettings,
  deleteSkuData,
  downloadDatabaseBackup,
  fetchGeneralSettings,
  type GeneralSettings,
  resetTestData,
  restoreFilesFromBackup,
  searchSkusForAdmin,
  type SkuAdminResult,
  updateGeneralSettings,
} from '../services/generalSettings';

type SettingsForm = GeneralSettings;

export default function GeneralSettingsPage() {
  const { user } = useAuth();
  const canSave = user?.permissions?.generalSettings?.save ?? false;
  const canEdit = user?.permissions?.generalSettings?.edit ?? false;

  const [form, setForm] = useState<SettingsForm>(defaultGeneralSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);
  const [isRestoringFiles, setIsRestoringFiles] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const resetInputRef = useRef<HTMLInputElement>(null);

  const [showSkuDeleteModal, setShowSkuDeleteModal] = useState(false);
  const [skuSearchQuery, setSkuSearchQuery] = useState('');
  const [skuSearchResults, setSkuSearchResults] = useState<SkuAdminResult[]>([]);
  const [skuSearchLoading, setSkuSearchLoading] = useState(false);
  const [selectedSkuIds, setSelectedSkuIds] = useState<Set<string>>(new Set());
  const [isDeletingSkus, setIsDeletingSkus] = useState(false);
  const skuSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchGeneralSettings();
        setForm(data);
      } catch (error) {
        console.error('Error loading general settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const updateField = (field: keyof SettingsForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = async (file?: File | null) => {
    if (!file) return;

    const body = new FormData();
    body.append('file', await compressImageForUpload(file));

    try {
      const response = await api.post('/upload', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateField('logoUrl', response.data.url);
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Không thể tải logo lên lúc này.');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const saved = await updateGeneralSettings(form);
      setForm(saved);
      alert('Đã lưu cấu hình thông tin chung.');
    } catch (error) {
      console.error('Error saving general settings:', error);
      alert('Không thể lưu cấu hình thông tin chung.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadBackup = async () => {
    setIsDownloadingBackup(true);
    try {
      const blob = await downloadDatabaseBackup();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup-full-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading backup:', error);
      alert('Không thể tải backup lúc này.');
    } finally {
      setIsDownloadingBackup(false);
    }
  };

  const handleRestoreFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!file.name.endsWith('.zip')) {
      alert('Vui lòng chọn file backup .zip');
      return;
    }
    if (!confirm(`Khôi phục hình ảnh và cài đặt từ file "${file.name}"?\nCác file cùng tên sẽ bị ghi đè.`)) return;
    setIsRestoringFiles(true);
    try {
      const result = await restoreFilesFromBackup(file);
      alert(`✅ ${result.message}`);
    } catch (error: any) {
      alert(`Lỗi khôi phục: ${error.response?.data?.message || error.message || 'Không xác định'}`);
    } finally {
      setIsRestoringFiles(false);
    }
  };

  const handleSkuSearch = useCallback((q: string) => {
    setSkuSearchQuery(q);
    if (skuSearchTimer.current) clearTimeout(skuSearchTimer.current);
    skuSearchTimer.current = setTimeout(async () => {
      setSkuSearchLoading(true);
      try {
        const results = await searchSkusForAdmin(q);
        setSkuSearchResults(results);
      } catch {
        setSkuSearchResults([]);
      } finally {
        setSkuSearchLoading(false);
      }
    }, 300);
  }, []);

  const toggleSkuSelect = (id: string) => {
    setSelectedSkuIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDeleteSelectedSkus = async () => {
    if (!selectedSkuIds.size) return;
    const count = selectedSkuIds.size;
    if (!confirm(`Xóa toàn bộ giao dịch của ${count} sản phẩm đã chọn?\nThao tác này không thể hoàn tác.`)) return;
    setIsDeletingSkus(true);
    try {
      const result = await deleteSkuData([...selectedSkuIds]);
      alert(`✅ ${result.message}`);
      setSelectedSkuIds(new Set());
      // Refresh search results
      const refreshed = await searchSkusForAdmin(skuSearchQuery);
      setSkuSearchResults(refreshed);
    } catch (error: any) {
      alert(`Lỗi: ${error.response?.data?.message || error.message || 'Không xác định'}`);
    } finally {
      setIsDeletingSkus(false);
    }
  };

  const handleResetTestData = async () => {
    if (resetConfirmText !== 'XOA DU LIEU') return;
    setIsResetting(true);
    try {
      const result = await resetTestData();
      setShowResetModal(false);
      setResetConfirmText('');
      alert(`✅ ${result.message}\n\nĐã xóa:\n` +
        Object.entries(result.deleted)
          .map(([k, v]) => `• ${k}: ${v} bản ghi`)
          .join('\n')
      );
    } catch (error: any) {
      alert(`Lỗi: ${error.response?.data?.message || error.message || 'Không xác định'}`);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3 text-slate-900">
          <ArrowLeft size={20} className="text-slate-500" />
          <div>
            <h2 className="text-[30px] font-semibold tracking-[-0.02em]">Thông tin cửa hàng</h2>
            <p className="mt-1 text-[15px] text-slate-500">Cấu hình thông tin chung dùng cho biên bản in và thông tin liên hệ.</p>
          </div>
        </div>

        {isLoading ? (
          <Card className="rounded-[28px] border border-slate-200 shadow-sm">
            <CardContent className="flex h-64 items-center justify-center">
              <div className="spinner" />
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-[28px] border border-slate-200 shadow-sm">
            <CardContent className="space-y-12 p-8">
              <div className="grid gap-10 lg:grid-cols-[340px_minmax(0,1fr)]">
                <div>
                  <h3 className="text-[28px] font-semibold text-slate-950">Thông tin liên hệ</h3>
                  <p className="mt-3 text-[18px] leading-8 text-slate-500">
                    Thông tin được sử dụng để hiển thị trên biên bản in và giúp khách hàng liên hệ đến cửa hàng.
                  </p>
                </div>

                <div className="rounded-[24px] bg-slate-50 p-6">
                  <div className="mb-6 flex flex-wrap items-center gap-5 rounded-[20px] bg-white p-5 shadow-sm">
                    <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-[20px] border border-dashed border-slate-200 bg-slate-50">
                      {form.logoUrl ? (
                        <img src={form.logoUrl} alt="logo" className="h-full w-full object-contain" />
                      ) : (
                        <span className="text-4xl font-semibold text-slate-300">{(form.storeName || 'H').slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>

                    <label className="cursor-pointer">
                      <div className="text-[22px] font-semibold text-violet-700">Tải lên ảnh đại diện cửa hàng</div>
                      <div className="mt-2 text-[16px] text-slate-500">Dung lượng tối đa 2MB, định dạng PNG, JPG, JPEG hoặc GIF.</div>
                      <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
                        <Upload size={16} />
                        Chọn logo
                      </div>
                      <input type="file" accept="image/png,image/jpeg,image/jpg,image/gif" className="hidden" onChange={(e) => handleLogoUpload(e.target.files?.[0])} />
                    </label>
                  </div>

                  <div className="grid gap-5">
                    <div className="space-y-2">
                      <Label>Tên thương hiệu hiển thị</Label>
                      <Input value={form.brandName} onChange={(e) => updateField('brandName', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Tên Công Ty</Label>
                      <Input value={form.storeName} onChange={(e) => updateField('storeName', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Số điện thoại</Label>
                      <Input value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
                    </div>
                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Địa chỉ email</Label>
                        <Input value={form.email} onChange={(e) => updateField('email', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Lĩnh vực kinh doanh</Label>
                        <Input value={form.businessField} onChange={(e) => updateField('businessField', e.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-10 lg:grid-cols-[340px_minmax(0,1fr)]">
                <div>
                  <h3 className="text-[28px] font-semibold text-slate-950">Địa chỉ Công Ty</h3>
                  <p className="mt-3 text-[18px] leading-8 text-slate-500">
                    Thông tin này được dùng trong các thông báo và sẽ hiện trên các biên bản in của hệ thống.
                  </p>
                </div>

                <div className="rounded-[24px] bg-slate-50 p-6">
                  <div className="grid gap-5">
                    <div className="space-y-2">
                      <Label>Địa chỉ</Label>
                      <Input value={form.address} onChange={(e) => updateField('address', e.target.value)} />
                    </div>
                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Khu vực</Label>
                        <Input value={form.province} onChange={(e) => updateField('province', e.target.value)} placeholder="Ví dụ: TP.HCM" />
                      </div>
                      <div className="space-y-2">
                        <Label>Phường xã</Label>
                        <Input value={form.ward} onChange={(e) => updateField('ward', e.target.value)} placeholder="Ví dụ: Phường 9" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-10 lg:grid-cols-[340px_minmax(0,1fr)]">
                <div>
                  <h3 className="text-[28px] font-semibold text-slate-950">Backup du lieu</h3>
                  <p className="mt-3 text-[18px] leading-8 text-slate-500">
                    Tai ve toan bo du lieu he thong de luu tren may tinh. File backup hien dang o dinh dang JSON day du de luu tru dinh ky.
                  </p>
                </div>

                <div className="space-y-4 rounded-[24px] bg-slate-50 p-6">
                  <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="text-[18px] font-semibold text-slate-900">Tải backup toàn bộ</div>
                    <div className="mt-1 text-[14px] text-slate-500">
                      Backup bao gồm database, hình ảnh và cài đặt. Nên backup định kỳ trước khi deploy code mới lên server.
                    </div>
                    <div className="mt-4">
                      <Button variant="outline" onClick={handleDownloadBackup} disabled={isDownloadingBackup}>
                        <Download size={16} />
                        {isDownloadingBackup ? 'Đang tạo file backup...' : 'Tải backup .zip về máy'}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-amber-200 bg-white p-5 shadow-sm">
                    <div className="text-[18px] font-semibold text-slate-900">Khôi phục hình ảnh sau khi deploy</div>
                    <div className="mt-1 text-[14px] text-slate-500">
                      Nếu hình ảnh bị mất sau khi upcode lên VPS, upload file backup .zip để khôi phục lại toàn bộ ảnh và cài đặt cửa hàng.
                    </div>
                    <div className="mt-4">
                      <label className="inline-block">
                        <input
                          type="file"
                          accept=".zip"
                          className="hidden"
                          onChange={handleRestoreFiles}
                          disabled={isRestoringFiles}
                        />
                        <Button variant="outline" asChild disabled={isRestoringFiles} className="cursor-pointer border-amber-300 text-amber-700 hover:bg-amber-50">
                          <span>
                            <Upload size={16} />
                            {isRestoringFiles ? 'Đang khôi phục...' : 'Khôi phục từ file backup .zip'}
                          </span>
                        </Button>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {user?.role === 'ADMIN' && (
                <div className="grid gap-10 lg:grid-cols-[340px_minmax(0,1fr)]">
                  <div>
                    <h3 className="text-[28px] font-semibold text-red-600">Vùng nguy hiểm</h3>
                    <p className="mt-3 text-[18px] leading-8 text-slate-500">
                      Các thao tác này không thể hoàn tác. Chỉ dùng khi muốn xóa dữ liệu test trước khi bàn giao thực tế.
                    </p>
                  </div>

                  <div className="space-y-4 rounded-[24px] bg-red-50 p-6">
                    <div className="rounded-[20px] border border-red-200 bg-white p-5 shadow-sm">
                      <div className="text-[18px] font-semibold text-red-700">Xóa theo sản phẩm / SKU</div>
                      <div className="mt-1 text-[14px] text-slate-500">
                        Tìm đúng sản phẩm cần xóa (theo tên hoặc SKU), chọn rồi xóa toàn bộ giao dịch của sản phẩm đó. Các sản phẩm khác không bị ảnh hưởng.
                      </div>
                      <div className="mt-4">
                        <Button
                          variant="outline"
                          className="border-red-300 text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setShowSkuDeleteModal(true);
                            setSkuSearchQuery('');
                            setSkuSearchResults([]);
                            setSelectedSkuIds(new Set());
                            setTimeout(() => handleSkuSearch(''), 0);
                          }}
                        >
                          <Search size={16} />
                          Tìm và xóa theo sản phẩm
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-[20px] border border-red-200 bg-white p-5 shadow-sm">
                      <div className="text-[18px] font-semibold text-red-700">Xóa toàn bộ dữ liệu giao dịch</div>
                      <div className="mt-1 text-[14px] text-slate-500">
                        Xóa tất cả phiếu nhập/xuất, kiểm kê, điều chỉnh, lịch sử hoạt động và reset tồn kho về 0.
                        Giữ lại: tài khoản, danh mục, SKU, cài đặt kho.
                      </div>
                      <div className="mt-4">
                        <Button
                          variant="outline"
                          className="border-red-300 text-red-700 hover:bg-red-50"
                          onClick={() => { setShowResetModal(true); setResetConfirmText(''); setTimeout(() => resetInputRef.current?.focus(), 100); }}
                        >
                          <Trash2 size={16} />
                          Xóa toàn bộ dữ liệu test
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {showSkuDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                  <div className="flex w-full max-w-2xl flex-col rounded-[24px] bg-white shadow-2xl" style={{ maxHeight: '85vh' }}>
                    <div className="flex items-center justify-between border-b border-slate-100 px-8 py-5">
                      <div className="flex items-center gap-3 text-red-600">
                        <Trash2 size={22} />
                        <h3 className="text-[20px] font-semibold">Xóa dữ liệu theo sản phẩm</h3>
                      </div>
                      <button onClick={() => setShowSkuDeleteModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
                    </div>

                    <div className="px-8 py-4 border-b border-slate-100">
                      <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input
                          className="pl-9"
                          placeholder="Nhập tên sản phẩm hoặc mã SKU..."
                          value={skuSearchQuery}
                          onChange={(e) => handleSkuSearch(e.target.value)}
                          autoFocus
                        />
                      </div>
                      {selectedSkuIds.size > 0 && (
                        <div className="mt-3 text-[13px] text-slate-500">
                          Đã chọn <strong className="text-red-600">{selectedSkuIds.size}</strong> sản phẩm
                        </div>
                      )}
                    </div>

                    <div className="flex-1 overflow-y-auto px-8 py-3">
                      {skuSearchLoading ? (
                        <div className="flex justify-center py-8 text-slate-400 text-[14px]">Đang tìm...</div>
                      ) : skuSearchResults.length === 0 ? (
                        <div className="flex justify-center py-8 text-slate-400 text-[14px]">Không tìm thấy sản phẩm nào</div>
                      ) : (
                        <div className="space-y-2">
                          {skuSearchResults.map((sku) => (
                            <label
                              key={sku.id}
                              className={`flex cursor-pointer items-center gap-4 rounded-[14px] border px-4 py-3 transition-colors ${
                                selectedSkuIds.has(sku.id)
                                  ? 'border-red-300 bg-red-50'
                                  : 'border-slate-200 bg-white hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedSkuIds.has(sku.id)}
                                onChange={() => toggleSkuSelect(sku.id)}
                                className="accent-red-600 h-4 w-4 flex-shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[14px] font-medium text-slate-800">{sku.compositeSku}</div>
                                {sku.categoryName && (
                                  <div className="truncate text-[12px] text-slate-500">{sku.categoryName}</div>
                                )}
                              </div>
                              <div className={`flex-shrink-0 text-[13px] font-semibold ${sku.stock > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                                Tồn: {sku.stock}
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-100 px-8 py-5">
                      <button
                        className="text-[13px] text-slate-500 hover:text-slate-700"
                        onClick={() => setSelectedSkuIds(new Set())}
                        disabled={selectedSkuIds.size === 0}
                      >
                        Bỏ chọn tất cả
                      </button>
                      <div className="flex gap-3">
                        <Button variant="outline" onClick={() => setShowSkuDeleteModal(false)} disabled={isDeletingSkus}>
                          Đóng
                        </Button>
                        <Button
                          className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
                          disabled={selectedSkuIds.size === 0 || isDeletingSkus}
                          onClick={() => void handleDeleteSelectedSkus()}
                        >
                          <Trash2 size={15} />
                          {isDeletingSkus ? 'Đang xóa...' : `Xóa ${selectedSkuIds.size > 0 ? selectedSkuIds.size + ' sản phẩm' : ''}`}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {showResetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                  <div className="w-full max-w-md rounded-[24px] bg-white p-8 shadow-2xl">
                    <div className="mb-2 flex items-center gap-3 text-red-600">
                      <Trash2 size={24} />
                      <h3 className="text-[22px] font-semibold">Xác nhận xóa dữ liệu</h3>
                    </div>
                    <p className="mt-3 text-[15px] text-slate-600">
                      Hành động này sẽ <strong>xóa vĩnh viễn</strong> toàn bộ dữ liệu giao dịch kho (nhập, xuất, kiểm kê, lịch sử) và reset tồn kho về 0.
                    </p>
                    <p className="mt-3 text-[15px] text-slate-600">
                      Để xác nhận, nhập chính xác: <strong className="text-red-600 select-none">XOA DU LIEU</strong>
                    </p>
                    <Input
                      ref={resetInputRef}
                      className="mt-4 border-red-200 font-mono"
                      placeholder="Nhập XOA DU LIEU để xác nhận"
                      value={resetConfirmText}
                      onChange={(e) => setResetConfirmText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && resetConfirmText === 'XOA DU LIEU') void handleResetTestData(); }}
                    />
                    <div className="mt-6 flex justify-end gap-3">
                      <Button variant="outline" onClick={() => { setShowResetModal(false); setResetConfirmText(''); }} disabled={isResetting}>
                        Hủy
                      </Button>
                      <Button
                        className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
                        disabled={resetConfirmText !== 'XOA DU LIEU' || isResetting}
                        onClick={() => void handleResetTestData()}
                      >
                        {isResetting ? 'Đang xóa...' : 'Xác nhận xóa'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-6">
                <Button variant="outline" onClick={() => setForm(defaultGeneralSettings)}>
                  Hủy
                </Button>
                <Button className="bg-[#3b82f6] hover:bg-[#2563eb]" onClick={handleSave} disabled={isSaving || (!canSave && !canEdit)}>
                  <Save size={16} />
                  {isSaving ? 'Đang lưu...' : 'Lưu'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
