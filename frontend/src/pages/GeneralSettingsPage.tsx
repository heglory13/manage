import { useEffect, useState } from 'react';
import { ArrowLeft, Save, Upload } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { compressImageForUpload } from '../lib/image';
import { api } from '../services/api';
import { defaultGeneralSettings, fetchGeneralSettings, type GeneralSettings, updateGeneralSettings } from '../services/generalSettings';

type SettingsForm = GeneralSettings;

export default function GeneralSettingsPage() {
  const [form, setForm] = useState<SettingsForm>(defaultGeneralSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
                      <Label>Tên cửa hàng</Label>
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
                  <h3 className="text-[28px] font-semibold text-slate-950">Địa chỉ cửa hàng</h3>
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

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-6">
                <Button variant="outline" onClick={() => setForm(defaultGeneralSettings)}>
                  Hủy
                </Button>
                <Button className="bg-[#3b82f6] hover:bg-[#2563eb]" onClick={handleSave} disabled={isSaving}>
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
