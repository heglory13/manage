import { GeneralSettingsService } from './general-settings.service.js';
export declare class GeneralSettingsController {
    private readonly generalSettingsService;
    constructor(generalSettingsService: GeneralSettingsService);
    getSettings(): Promise<import("./general-settings.service.js").GeneralSettings>;
    updateSettings(body: Record<string, string>): Promise<import("./general-settings.service.js").GeneralSettings>;
}
