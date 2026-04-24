# Kế hoạch Triển khai - Module Khai báo Input

## Task 1: Prisma Schema và Migration

- [x] 1.1 Thêm model `Classification` vào `backend/prisma/schema.prisma` với các trường: id (uuid), name (unique), createdAt. Map sang bảng `classifications`.
- [x] 1.2 Thêm model `Color` vào `backend/prisma/schema.prisma` với các trường: id (uuid), name (unique), createdAt. Map sang bảng `colors`.
- [x] 1.3 Thêm model `Size` vào `backend/prisma/schema.prisma` với các trường: id (uuid), name (unique), createdAt. Map sang bảng `sizes`.
- [x] 1.4 Thêm model `Material` vào `backend/prisma/schema.prisma` với các trường: id (uuid), name (unique), createdAt. Map sang bảng `materials`.
- [x] 1.5 Thêm model `SkuCombo` vào `backend/prisma/schema.prisma` với các trường: id (uuid), classificationId (FK), colorId (FK), sizeId (FK), materialId (FK), compositeSku (unique), createdAt. Thêm unique constraint trên tổ hợp 4 FK. Map sang bảng `sku_combos`.
- [x] 1.6 Thêm model `ProductCondition` vào `backend/prisma/schema.prisma` với các trường: id (uuid), name (unique), createdAt. Map sang bảng `product_conditions`.
- [x] 1.7 Thêm model `StorageZone` vào `backend/prisma/schema.prisma` với các trường: id (uuid), name (unique), maxCapacity (Int), currentStock (Int, default 0), createdAt. Map sang bảng `storage_zones`.
- [x] 1.8 Mở rộng model `InventoryTransaction` thêm 3 trường optional: skuComboId (String?), productConditionId (String?), storageZoneId (String?) với relations tương ứng.
- [x] 1.9 Chạy `prisma migrate dev` để tạo migration và `prisma generate` để cập nhật Prisma Client.

## Task 2: Seed Data cho Tình trạng hàng hoá mặc định

- [x] 2.1 Cập nhật `backend/prisma/seed.ts` để tạo 3 giá trị mặc định cho ProductCondition: "Đạt tiêu chuẩn", "Lỗi/Hỏng", "Hàng khách kí gửi" (sử dụng upsert để tránh trùng khi chạy lại).

## Task 3: Backend - InputDeclaration Module (DTOs)

- [x] 3.1 Tạo file `backend/src/input-declaration/dto/create-attribute.dto.ts` với class `CreateAttributeDto` chứa trường `name` (IsString, IsNotEmpty).
- [x] 3.2 Tạo file `backend/src/input-declaration/dto/create-storage-zone.dto.ts` với class `CreateStorageZoneDto` chứa trường `name` (IsString, IsNotEmpty) và `maxCapacity` (IsInt, Min(1)).
- [x] 3.3 Tạo file `backend/src/input-declaration/dto/create-sku-combo.dto.ts` với class `CreateSkuComboDto` chứa 4 trường: classificationId, colorId, sizeId, materialId (tất cả IsString, IsNotEmpty).
- [x] 3.4 Tạo file `backend/src/input-declaration/dto/sku-combo-query.dto.ts` với class `SkuComboQueryDto` chứa trường search (optional), page (optional), limit (optional).
- [x] 3.5 Tạo file `backend/src/input-declaration/dto/index.ts` export tất cả DTOs.

## Task 4: Backend - InputDeclaration Service

- [x] 4.1 Tạo file `backend/src/input-declaration/input-declaration.service.ts` với các method: `getAll(type)` trả về danh sách thuộc tính theo type, `create(type, name)` tạo thuộc tính mới với logic trim whitespace, validate không rỗng, kiểm tra trùng lặp case-insensitive bằng Prisma `findFirst` với `mode: 'insensitive'`.
- [x] 4.2 Thêm method `getAllProductConditions()` và `createProductCondition(name)` vào InputDeclarationService với cùng logic validate/dedup.
- [x] 4.3 Thêm method `getAllStorageZones()` và `createStorageZone(name, maxCapacity)` vào InputDeclarationService với logic validate tên + maxCapacity > 0 + dedup case-insensitive.

## Task 5: Backend - SkuCombo Service

- [x] 5.1 Tạo file `backend/src/input-declaration/sku-combo.service.ts` với method `generateCompositeSku(classificationName, colorName, sizeName, materialName)` trả về chuỗi `"{classification}-{color}-{size}-{material}"`.
- [x] 5.2 Thêm method `create(dto: CreateSkuComboDto)` vào SkuComboService: validate 4 FK tồn tại, kiểm tra unique constraint trên tổ hợp 4 FK, sinh compositeSku, lưu vào DB. Throw ConflictException nếu trùng.
- [x] 5.3 Thêm method `getAll(query: SkuComboQueryDto)` vào SkuComboService: hỗ trợ phân trang và tìm kiếm theo từ khóa (search trong compositeSku, tên classification, color, size, material bằng `contains` + `mode: 'insensitive'`).

## Task 6: Backend - InputDeclaration Controller

- [x] 6.1 Tạo file `backend/src/input-declaration/input-declaration.controller.ts` với các endpoint GET/POST cho classifications, colors, sizes, materials, product-conditions, storage-zones, sku-combos. Tất cả endpoint đều yêu cầu JwtAuthGuard (đã có global guard).
- [x] 6.2 Tạo file `backend/src/input-declaration/input-declaration.module.ts` đăng ký controller, providers (InputDeclarationService, SkuComboService), exports.

## Task 7: Backend - Đăng ký Module và Mở rộng Inventory

- [x] 7.1 Import `InputDeclarationModule` vào `backend/src/app.module.ts` trong mảng imports.
- [x] 7.2 Mở rộng `backend/src/inventory/dto/stock-in.dto.ts` thêm 3 trường optional: skuComboId, productConditionId, storageZoneId (IsOptional, IsString).
- [x] 7.3 Mở rộng `backend/src/inventory/dto/stock-out.dto.ts` thêm 3 trường optional tương tự.
- [x] 7.4 Mở rộng method `stockIn` trong `backend/src/inventory/inventory.service.ts`: nhận thêm storageZoneId optional, nếu có thì kiểm tra sức chứa (maxCapacity - currentStock >= quantity), từ chối nếu vượt, cập nhật currentStock của zone trong transaction.
- [x] 7.5 Mở rộng method `stockOut` trong `backend/src/inventory/inventory.service.ts`: nhận thêm storageZoneId optional, nếu có thì giảm currentStock của zone trong transaction.
- [x] 7.6 Cập nhật `backend/src/inventory/inventory.controller.ts` để truyền các trường mới từ DTO vào service methods.

## Task 8: Frontend - Types và API Hooks

- [x] 8.1 Thêm các interface mới vào `frontend/src/types/index.ts`: Classification, Color, Size, Material, ProductCondition, StorageZone, SkuCombo, CreateSkuComboPayload, SkuComboQuery.
- [x] 8.2 Mở rộng interface `StockInPayload` và `StockOutPayload` trong `frontend/src/types/index.ts` thêm 3 trường optional: skuComboId, productConditionId, storageZoneId.
- [x] 8.3 Tạo file `frontend/src/hooks/useInputDeclarations.ts` với React Query hooks: useClassifications, useColors, useSizes, useMaterials, useProductConditions, useStorageZones, useSkuCombos (với query params), và các mutation hooks tương ứng (useCreateClassification, useCreateColor, useCreateSize, useCreateMaterial, useCreateProductCondition, useCreateStorageZone, useCreateSkuCombo). Mỗi mutation hook phải invalidate query cache tương ứng sau khi thành công.

## Task 9: Frontend - Trang Khai báo Input

- [x] 9.1 Tạo component `frontend/src/components/input-declaration/AttributeSection.tsx`: component tái sử dụng hiển thị bảng danh sách thuộc tính + form thêm mới (input + button). Props: title, items, onAdd, isLoading. Hiển thị danh sách hiện có trước input field.
- [x] 9.2 Tạo component `frontend/src/components/input-declaration/ProductConditionSection.tsx`: sử dụng AttributeSection cho tình trạng hàng hoá.
- [x] 9.3 Tạo component `frontend/src/components/input-declaration/StorageZoneSection.tsx`: bảng hiển thị Tên, Sức chứa tối đa, Tồn kho thực tế, Số lượng còn nhập được. Form thêm mới có 2 trường: tên + sức chứa tối đa.
- [x] 9.4 Tạo component `frontend/src/components/input-declaration/CreateSkuComboForm.tsx`: form với 4 dropdown (Phân loại, Màu, Size, Chất liệu) + button tạo tổ hợp. Preview SKU tổng hợp trước khi submit.
- [x] 9.5 Tạo component `frontend/src/components/input-declaration/SkuComboTable.tsx`: bảng tổng hợp SKU với cột STT, Phân loại, Màu, Size, Chất liệu, SKU tổng hợp. Hỗ trợ phân trang và ô tìm kiếm.
- [x] 9.6 Tạo trang `frontend/src/pages/InputDeclarationPage.tsx`: layout 3 khu vực riêng biệt sử dụng các component trên. Khu vực 1: Thuộc tính sản phẩm (4 AttributeSection + CreateSkuComboForm + SkuComboTable). Khu vực 2: Tình trạng hàng hoá (ProductConditionSection). Khu vực 3: Khu vực hàng hoá (StorageZoneSection). Thiết kế Mobile-first responsive.

## Task 10: Frontend - Tích hợp vào hệ thống hiện có

- [x] 10.1 Thêm route `/input-declarations` vào `frontend/src/App.tsx` trong nhóm authenticated routes, trỏ đến `InputDeclarationPage`.
- [x] 10.2 Thêm nav item "Khai báo Input" vào mảng `navItems` trong `frontend/src/components/layout/AppLayout.tsx` (không giới hạn role, icon phù hợp).
- [x] 10.3 Mở rộng `frontend/src/components/inventory/StockInForm.tsx`: thêm 3 dropdown mới (SKU tổng hợp, Tình trạng hàng hoá, Khu vực hàng hoá). Khi chọn khu vực, hiển thị thông tin sức chứa (maxCapacity, currentStock, remaining). Truyền 3 trường mới vào onSubmit payload.
- [x] 10.4 Mở rộng `frontend/src/components/inventory/StockOutForm.tsx`: thêm 3 dropdown mới tương tự (không cần hiển thị sức chứa).

## Task 11: Backend - Property-Based Tests

- [x] 11.1 Tạo file `backend/src/input-declaration/input-declaration.service.spec.ts` với property tests P1-P4: test tạo thuộc tính hợp lệ, từ chối tên rỗng/whitespace, phát hiện trùng lặp case-insensitive, trim whitespace. Sử dụng fast-check, mỗi test chạy tối thiểu 100 iterations.
- [x] 11.2 Tạo file `backend/src/input-declaration/sku-combo.service.spec.ts` với property tests P5-P7: test định dạng SKU tổng hợp (pure function), từ chối tổ hợp trùng, tìm kiếm trả về kết quả phù hợp. Sử dụng fast-check.
- [x] 11.3 Thêm property tests P8-P10 vào file spec tương ứng: test từ chối maxCapacity <= 0, tính toán remaining capacity, từ chối nhập kho vượt sức chứa. Sử dụng fast-check.

## Task 12: Backend - Unit Tests

- [x] 12.1 Thêm unit tests cho InputDeclarationController: test các endpoint GET/POST trả về đúng status code và data.
- [x] 12.2 Thêm unit tests cho SkuComboService: test tạo combo thành công, tìm kiếm, phân trang.
- [x] 12.3 Thêm unit tests cho mở rộng InventoryService: test stockIn/stockOut với storageZoneId, kiểm tra cập nhật currentStock.

## Task 13: Frontend - Unit Tests

- [x] 13.1 Tạo file test cho InputDeclarationPage: verify render 3 khu vực, thêm giá trị mới, hiển thị lỗi trùng lặp.
- [x] 13.2 Tạo file test cho StockInForm mở rộng: verify 3 dropdown mới hiển thị, thông tin sức chứa hiển thị khi chọn khu vực.
- [x] 13.3 Tạo file test cho StockOutForm mở rộng: verify 3 dropdown mới hiển thị.
