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
export declare class GeneralSettingsService {
    private readonly settingsPath;
    private ensureFile;
    getSettings(): Promise<GeneralSettings>;
    updateSettings(payload: Partial<GeneralSettings>): Promise<GeneralSettings>;
}
