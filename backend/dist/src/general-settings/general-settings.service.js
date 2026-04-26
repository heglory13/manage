"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeneralSettingsService = void 0;
const common_1 = require("@nestjs/common");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const DEFAULT_SETTINGS = {
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
let GeneralSettingsService = class GeneralSettingsService {
    settingsPath = (0, path_1.join)(process.cwd(), 'storage', 'general-settings.json');
    async ensureFile() {
        await (0, promises_1.mkdir)((0, path_1.dirname)(this.settingsPath), { recursive: true });
        try {
            await (0, promises_1.readFile)(this.settingsPath, 'utf-8');
        }
        catch {
            await (0, promises_1.writeFile)(this.settingsPath, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf-8');
        }
    }
    async getSettings() {
        await this.ensureFile();
        try {
            const raw = await (0, promises_1.readFile)(this.settingsPath, 'utf-8');
            const parsed = JSON.parse(raw);
            return { ...DEFAULT_SETTINGS, ...parsed };
        }
        catch {
            return { ...DEFAULT_SETTINGS };
        }
    }
    async updateSettings(payload) {
        const current = await this.getSettings();
        const next = {
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
        await (0, promises_1.writeFile)(this.settingsPath, JSON.stringify(next, null, 2), 'utf-8');
        return next;
    }
};
exports.GeneralSettingsService = GeneralSettingsService;
exports.GeneralSettingsService = GeneralSettingsService = __decorate([
    (0, common_1.Injectable)()
], GeneralSettingsService);
//# sourceMappingURL=general-settings.service.js.map