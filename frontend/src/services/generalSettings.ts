import { api } from './api';

export type GeneralSettings = {
  brandName: string;
  storeName: string;
  phone: string;
  email: string;
  businessField: string;
  address: string;
  province: string;
  ward: string;
  logoUrl: string;
};

export const defaultGeneralSettings: GeneralSettings = {
  brandName: 'IMS & WMS HAVIASGroup',
  storeName: 'HAVIAS',
  phone: '0123.456.789',
  email: '',
  businessField: 'Khác',
  address: '123 Đường ABC, Quận 1, TP.HCM',
  province: 'TP.HCM',
  ward: '',
  logoUrl: '',
};

export async function fetchGeneralSettings() {
  const response = await api.get('/general-settings');
  return {
    ...defaultGeneralSettings,
    ...(response.data || {}),
  } as GeneralSettings;
}

export async function updateGeneralSettings(payload: Partial<GeneralSettings>) {
  const response = await api.put('/general-settings', payload);
  return response.data as GeneralSettings;
}

export async function downloadDatabaseBackup() {
  const response = await api.get('/backup/full', {
    responseType: 'blob',
  });
  return response.data as Blob;
}

export type SkuAdminResult = {
  id: string;
  compositeSku: string;
  categoryName: string | null;
  stock: number;
};

export async function searchSkusForAdmin(q: string): Promise<SkuAdminResult[]> {
  const response = await api.get('/backup/sku-search', { params: { q } });
  return response.data as SkuAdminResult[];
}

export async function deleteSkuData(skuComboIds: string[]): Promise<{ message: string; deletedTransactions: number }> {
  const response = await api.post('/backup/delete-sku-data', { skuComboIds });
  return response.data as { message: string; deletedTransactions: number };
}

export async function resetTestData(): Promise<{ message: string; deleted: Record<string, number> }> {
  const response = await api.post('/backup/reset-test-data', { confirm: 'XOA DU LIEU' });
  return response.data as { message: string; deleted: Record<string, number> };
}

export async function restoreFilesFromBackup(zipFile: File): Promise<{ message: string; restored: string[] }> {
  const formData = new FormData();
  formData.append('file', zipFile);
  const response = await api.post('/backup/restore-files', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data as { message: string; restored: string[] };
}
