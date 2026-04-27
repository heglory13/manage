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
