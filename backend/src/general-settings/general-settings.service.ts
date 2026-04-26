import { Injectable } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';

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

const DEFAULT_SETTINGS: GeneralSettings = {
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

@Injectable()
export class GeneralSettingsService {
  private readonly settingsPath = join(process.cwd(), 'storage', 'general-settings.json');

  private async ensureFile() {
    await mkdir(dirname(this.settingsPath), { recursive: true });

    try {
      await readFile(this.settingsPath, 'utf-8');
    } catch {
      await writeFile(this.settingsPath, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf-8');
    }
  }

  async getSettings(): Promise<GeneralSettings> {
    await this.ensureFile();

    try {
      const raw = await readFile(this.settingsPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<GeneralSettings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  async updateSettings(payload: Partial<GeneralSettings>) {
    const current = await this.getSettings();
    const next: GeneralSettings = {
      ...current,
      ...payload,
      brandName: payload.brandName?.trim() || current.brandName,
      storeName: payload.storeName?.trim() || current.storeName,
      phone: payload.phone?.trim() || '',
      email: payload.email?.trim() || '',
      businessField: payload.businessField?.trim() || '',
      address: payload.address?.trim() || '',
      province: payload.province?.trim() || '',
      ward: payload.ward?.trim() || '',
      logoUrl: payload.logoUrl?.trim() || '',
    };

    await this.ensureFile();
    await writeFile(this.settingsPath, JSON.stringify(next, null, 2), 'utf-8');

    return next;
  }
}
