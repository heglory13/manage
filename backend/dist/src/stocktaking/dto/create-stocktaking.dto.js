"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmitStocktakingDto = exports.SubmitStocktakingItemDto = exports.CreateStocktakingDto = exports.CreateStocktakingItemDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class CreateStocktakingItemDto {
    productId;
    actualQuantity;
    evidenceUrl;
}
exports.CreateStocktakingItemDto = CreateStocktakingItemDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateStocktakingItemDto.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateStocktakingItemDto.prototype, "actualQuantity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateStocktakingItemDto.prototype, "evidenceUrl", void 0);
class CreateStocktakingDto {
    mode;
    productIds;
}
exports.CreateStocktakingDto = CreateStocktakingDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['full', 'selected']),
    __metadata("design:type", String)
], CreateStocktakingDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateStocktakingDto.prototype, "productIds", void 0);
class SubmitStocktakingItemDto {
    itemId;
    actualQuantity;
    discrepancyReason;
    evidenceUrl;
}
exports.SubmitStocktakingItemDto = SubmitStocktakingItemDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SubmitStocktakingItemDto.prototype, "itemId", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SubmitStocktakingItemDto.prototype, "actualQuantity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmitStocktakingItemDto.prototype, "discrepancyReason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmitStocktakingItemDto.prototype, "evidenceUrl", void 0);
class SubmitStocktakingDto {
    items;
}
exports.SubmitStocktakingDto = SubmitStocktakingDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SubmitStocktakingItemDto),
    __metadata("design:type", Array)
], SubmitStocktakingDto.prototype, "items", void 0);
//# sourceMappingURL=create-stocktaking.dto.js.map