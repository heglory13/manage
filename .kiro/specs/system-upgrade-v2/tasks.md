# Kế hoạch Triển khai - Nâng cấp Hệ thống V2

## Phase 1: Database Schema Migration

- [x] 1. Cập nhật Prisma schema và tạo migration
  - [x] 1.1 Thêm enum `PreliminaryCheckStatus` (PENDING, COMPLETED) vào schema.prisma
  - [x] 1.2 Thêm giá trị `CHECKING` vào enum `StocktakingStatus` (CHECKING, PENDING, APPROVED, REJECTED)
  - [x] 1.3 Thêm fields `minThreshold` (Int, default 0) và `isDiscontinued` (Boolean, default false) vào model Product
  - [x] 1.4 Thêm fields `isActive` (Boolean, default true), `maxCapacity` (Int?, nullable), `currentStock` (Int, default 0) vào model WarehousePosition
  - [x] 1.5 Thêm fields `actualStockDate` (DateTime?), `warehousePositionId` (String?), `preliminaryCheckId` (String?) vào model InventoryTransaction, kèm relations
  - [x] 1.6 Thêm fields `cutoffTime` (DateTime, default now), `submittedAt` (DateTime?), `mode` (String, default "full") vào model StocktakingRecord
  - [x] 1.7 Thêm field `discrepancyReason` (String?) vào model StocktakingItem
  - [x] 1.8 Tạo model `StocktakingStatusHistory` (id, recordId, status, changedBy, changedAt, note) với relation tới StocktakingRecord
  - [x] 1.9 Tạo model `WarehouseType` (id, name unique, createdAt)
  - [x] 1.10 Tạo model `PreliminaryCheck` (id, classificationId, quantity, warehouseTypeId?, imageUrl?, note?, status, createdBy, createdAt, updatedAt) với relations
  - [x] 1.11 Cập nhật relations: User → preliminaryChecks, Classification → preliminaryChecks, WarehousePosition → inventoryTransactions
  - [x] 1.12 Chạy `prisma migrate dev` để tạo migration và `prisma generate` để cập nhật client

## Phase 2: Module 5 — Khai báo Input (Bổ sung)

- [x] 2. Backend: Thêm Loại kho (WarehouseType)
  - [x] 2.1 Thêm methods `getAllWarehouseTypes()` và `createWarehouseType(name)` vào InputDeclarationService (pattern giống attribute hiện có: trim, validate empty, check duplicate case-insensitive)
  - [x] 2.2 Thêm endpoints `GET /input-declarations/warehouse-types` và `POST /input-declarations/warehouse-types` vào InputDeclarationController
  - [x] 2.3 Viết unit tests cho WarehouseType CRUD trong input-declaration.service.spec.ts

- [x] 3. Backend: Thêm Ngưỡng Min cho Product
  - [x] 3.1 Tạo DTO `UpdateThresholdDto` (minThreshold: number, @Min(0)) trong backend/src/product/dto/
  - [x] 3.2 Thêm endpoint `PATCH /products/:id/threshold` vào ProductController
  - [x] 3.3 Thêm method `updateThreshold(id, minThreshold)` vào ProductService — validate >= 0, update Product
  - [x] 3.4 Thêm endpoint `PATCH /products/:id/discontinue` vào ProductController để toggle isDiscontinued
  - [x] 3.5 Viết unit tests cho updateThreshold và toggleDiscontinued

- [x] 4. Frontend: Mở rộng trang Khai báo Input
  - [x] 4.1 Tạo component `WarehouseTypeSection.tsx` trong frontend/src/components/input-declaration/ — bảng + form thêm mới (pattern giống AttributeSection)
  - [x] 4.2 Thêm hooks `useWarehouseTypes()` và `useCreateWarehouseType()` vào useInputDeclarations.ts
  - [x] 4.3 Tạo component `MinThresholdSection.tsx` — bảng sản phẩm với cột Ngưỡng Min editable (inline input + save button)
  - [x] 4.4 Thêm hooks `useUpdateThreshold()` và `useToggleDiscontinued()` vào useInputDeclarations.ts hoặc useProducts.ts
  - [x] 4.5 Cập nhật InputDeclarationPage.tsx — thêm section Loại kho và section Ngưỡng Min
  - [x] 4.6 Thêm types `WarehouseType` vào frontend/src/types/index.ts

## Phase 3: Module 3 — Quản lý Tồn kho (Nâng cấp)

- [x] 5. Backend: businessStatus computed field
  - [x] 5.1 Thêm method `computeBusinessStatus(product)` vào InventoryService — pure function trả về 'CON_HANG' | 'HET_HANG' | 'SAP_HET' | 'NGUNG_KD'
  - [x] 5.2 Tạo DTO `InventoryQueryV2Dto` với thêm fields: businessStatus, productConditionId, search (SKU keyword)
  - [x] 5.3 Thêm endpoint `GET /inventory/v2` vào InventoryController — trả về danh sách tồn kho kèm businessStatus computed
  - [x] 5.4 Thêm endpoint `GET /inventory/export-v2` vào InventoryController — xuất Excel với cột mới (businessStatus, loại hàng, vị trí)
  - [x] 5.5 Viết property test cho computeBusinessStatus (Property 13) — generate random (stock, minThreshold, isDiscontinued) tuples

- [x] 6. Frontend: Nâng cấp trang Tồn kho
  - [x] 6.1 Cập nhật InventoryPage.tsx — thêm cột "Trạng thái" với color coding (xanh/đỏ/vàng/xám) và cột "Loại hàng hoá"
  - [x] 6.2 Mở rộng bộ lọc — thêm dropdown businessStatus, productCondition, search input cho SKU
  - [x] 6.3 Thêm hook `useInventoryV2()` và `useExportExcelV2()` vào useInventory.ts
  - [x] 6.4 Cập nhật types/index.ts — thêm InventoryItemV2, InventoryQueryV2

## Phase 4: Module 1 — Sơ đồ Kho (Nâng cấp lớn)

- [x] 7. Backend: Mở rộng Warehouse API
  - [x] 7.1 Tạo DTOs mới: MovePositionDto, UpdateLabelDto, UpdateCapacityDto trong backend/src/warehouse/dto/
  - [x] 7.2 Thêm method `movePosition(id, targetRow, targetCol)` vào WarehouseService — swap logic: tìm position tại target, hoán đổi tọa độ trong transaction
  - [x] 7.3 Thêm method `updateLabel(id, label)` vào WarehouseService — validate unique label trong layout
  - [x] 7.4 Thêm method `toggleActive(id)` vào WarehouseService — validate không có hàng trước khi deactivate
  - [x] 7.5 Thêm method `updateCapacity(id, maxCapacity)` vào WarehouseService — validate > 0
  - [x] 7.6 Thêm method `getPositionSkus(id)` vào WarehouseService — query InventoryTransaction grouped by skuComboId cho position
  - [x] 7.7 Thêm method `getLayoutWithSkus()` vào WarehouseService — trả về layout kèm SKU info cho mỗi position
  - [x] 7.8 Thêm endpoints vào WarehouseController: PATCH positions/:id/move, PATCH positions/:id/label, PATCH positions/:id/toggle-active, PATCH positions/:id/capacity, GET positions/:id/skus, GET layout/with-skus
  - [x] 7.9 Cập nhật stockIn trong InventoryService — thêm kiểm tra capacity của warehousePosition (nếu warehousePositionId được cung cấp)
  - [x] 7.10 Viết unit tests cho movePosition, updateLabel, toggleActive, updateCapacity

- [x] 8. Frontend: Nâng cấp Sơ đồ kho
  - [x] 8.1 Cập nhật PositionCell.tsx — hiển thị SKU list (max 3 + "+N"), color coding theo trạng thái (xanh/xám/đỏ/vàng), hiển thị capacity info
  - [x] 8.2 Tạo component `PositionDetailPopup.tsx` — popup khi click ô, hiển thị danh sách SKU + số lượng chi tiết
  - [x] 8.3 Tạo component `PositionConfigDialog.tsx` — dialog cấu hình label, maxCapacity cho Admin
  - [x] 8.4 Cập nhật WarehouseGrid.tsx — thêm drag/drop cho position swap (dùng @dnd-kit), toggle active khi click (Admin), hiển thị ô trống khác biệt
  - [x] 8.5 Thêm hooks vào useWarehouse.ts: useMovePosition, useUpdateLabel, useToggleActive, useUpdateCapacity, usePositionSkus, useLayoutWithSkus
  - [x] 8.6 Cập nhật WarehousePage.tsx — tích hợp các component mới
  - [x] 8.7 Cập nhật types/index.ts — mở rộng WarehousePosition type với isActive, maxCapacity, currentStock
  - [x] 8.8 Tạo utility function `getPositionColorClass(position)` và `truncateSkuList(skus, max)` trong frontend/src/lib/
  - [x] 8.9 Viết property tests cho getPositionColorClass (Property 5) và truncateSkuList (Property 6)

## Phase 5: Module 2 — Kiểm kê (Nâng cấp lớn)

- [x] 9. Backend: Nâng cấp Stocktaking
  - [x] 9.1 Cập nhật CreateStocktakingDto — thêm field `mode: 'full' | 'selected'` và `productIds?: string[]`
  - [x] 9.2 Cập nhật method `create()` trong StocktakingService — hỗ trợ mode full (lấy tất cả products) và selected (lấy theo productIds), set status=CHECKING, ghi cutoffTime
  - [x] 9.3 Thêm method `submit(id, items)` vào StocktakingService — validate discrepancyReason cho items có chênh lệch, chuyển CHECKING→PENDING, set submittedAt
  - [x] 9.4 Cập nhật methods `approve()` và `reject()` — chỉ cho phép từ PENDING, ghi StocktakingStatusHistory
  - [x] 9.5 Thêm method `recordStatusChange(recordId, status, userId, note?)` — tạo StocktakingStatusHistory entry
  - [x] 9.6 Thêm method `getStatusHistory(recordId)` vào StocktakingService
  - [x] 9.7 Cập nhật StocktakingQueryDto — thêm fields startDate, endDate cho filter thời gian
  - [x] 9.8 Thêm endpoints vào StocktakingController: PATCH :id/submit, GET :id/history
  - [x] 9.9 Viết unit tests cho create (full/selected), submit validation, status transitions

- [x] 10. Frontend: Nâng cấp trang Kiểm kê
  - [x] 10.1 Cập nhật StocktakingForm.tsx — thêm mode selection (radio: "Kiểm tra toàn bộ" / "Kiểm kê theo danh sách"), hiển thị product picker khi mode=selected
  - [x] 10.2 Tạo component `StocktakingDetail.tsx` — hiển thị chi tiết biên bản, cho phép nhập actualQuantity + discrepancyReason cho từng dòng, nút Submit
  - [x] 10.3 Tạo component `StocktakingStatusHistory.tsx` — timeline hiển thị lịch sử trạng thái
  - [x] 10.4 Tạo component `StocktakingPrintView.tsx` — layout in biên bản, gọi window.print()
  - [x] 10.5 Cập nhật StocktakingPage.tsx — thêm filter thời gian, hiển thị cutoffTime, trạng thái CHECKING, nút In
  - [x] 10.6 Thêm hooks vào useStocktaking.ts: useSubmitStocktaking, useStocktakingStatusHistory
  - [x] 10.7 Cập nhật types/index.ts — thêm StocktakingStatusHistory type, mở rộng StocktakingRecord, StocktakingItem types

## Phase 6: Module 4 — Nhập/Xuất Kho (Nâng cấp lớn)

- [x] 11. Backend: PreliminaryCheck module mới
  - [x] 11.1 Tạo thư mục backend/src/preliminary-check/ với module, controller, service, dto
  - [x] 11.2 Tạo PreliminaryCheckService — methods: create(dto, userId), findAll(query), findOne(id)
  - [x] 11.3 Tạo PreliminaryCheckController — endpoints: POST /, GET /, GET /:id
  - [x] 11.4 Tạo DTOs: CreatePreliminaryCheckDto (classificationId required, quantity required @Min(1), warehouseTypeId?, imageUrl?, note?), PreliminaryCheckQueryDto
  - [x] 11.5 Đăng ký PreliminaryCheckModule vào AppModule
  - [x] 11.6 Viết unit tests cho PreliminaryCheckService

- [x] 12. Backend: Mở rộng Stock In/Out
  - [x] 12.1 Mở rộng StockInDto — thêm fields: preliminaryCheckId?, actualStockDate?, warehousePositionId?
  - [x] 12.2 Cập nhật InventoryService.stockIn() — lưu actualStockDate (default = now nếu null), warehousePositionId, preliminaryCheckId; cập nhật PreliminaryCheck status=COMPLETED nếu có
  - [x] 12.3 Cập nhật InventoryService.stockIn() — kiểm tra capacity của WarehousePosition nếu warehousePositionId được cung cấp, cập nhật currentStock của position
  - [x] 12.4 Viết unit tests cho stock-in mở rộng

- [x] 13. Backend: Báo cáo NXT (Nhập-Xuất-Tồn)
  - [x] 13.1 Tạo DTO NxtReportQueryDto (startDate, endDate required) trong backend/src/report/dto/
  - [x] 13.2 Thêm method `getNxtReport(startDate, endDate)` vào ReportService — tính openingStock, totalIn, totalOut, closingStock per SKU combo
  - [x] 13.3 Thêm method `exportNxtExcel(startDate, endDate)` vào ReportService — tạo Excel file
  - [x] 13.4 Thêm endpoints `GET /reports/nxt` và `GET /reports/nxt/export` vào ReportController
  - [x] 13.5 Viết property test cho NXT invariant (Property 18): closingStock = openingStock + totalIn - totalOut

- [x] 14. Backend: Excel Import/Export cho nhập kho
  - [x] 14.1 Thêm method `generateTemplate()` vào ReportService — tạo Excel template với headers: Phân loại, Màu, Size, Chất liệu, Số lượng, Tình trạng hàng, Vị trí kho, Loại kho, Ghi chú
  - [x] 14.2 Thêm method `importStockIn(file, userId)` vào ReportService — parse Excel, validate từng dòng, tạo transactions trong single transaction (rollback nếu lỗi)
  - [x] 14.3 Thêm method `validateImportRow(row, rowIndex)` vào ReportService — validate required fields, lookup FK values, return errors
  - [x] 14.4 Thêm endpoints `GET /reports/stock-in/template` và `POST /reports/stock-in/import` (với Multer file upload) vào ReportController
  - [x] 14.5 Cài đặt multer dependency nếu chưa có: `npm install @nestjs/platform-express` (đã có) + configure file upload
  - [x] 14.6 Viết property test cho import atomicity (Property 19) và row validation (Property 20)

- [x] 15. Frontend: Tab Nhập kiểm sơ bộ + Nhập chi tiết
  - [x] 15.1 Tạo component `PreliminaryCheckForm.tsx` — form 5 trường: dropdown Phân loại, input Số lượng, dropdown Loại kho, upload Hình ảnh, textarea Ghi chú
  - [x] 15.2 Tạo component `PreliminaryCheckList.tsx` — bảng danh sách phiếu sơ bộ với status badge
  - [x] 15.3 Tạo component `DetailedCheckForm.tsx` — form kiểm tra chi tiết từ phiếu sơ bộ: dropdowns Phân loại/Màu/Size/Chất liệu, input Số lượng thực tế, dropdown Tình trạng, dropdown Vị trí, textarea Ghi chú; hiển thị warning nếu số lượng khác sơ bộ
  - [x] 15.4 Tạo hook `usePreliminaryCheck.ts` — usePreliminaryChecks, useCreatePreliminaryCheck
  - [x] 15.5 Thêm types PreliminaryCheck, CreatePreliminaryCheckPayload vào types/index.ts

- [x] 16. Frontend: Tab Báo cáo NXT + Excel Import/Export
  - [x] 16.1 Tạo component `NxtReportTab.tsx` — date range picker + bảng NXT (SKU, Phân loại, Màu, Size, Chất liệu, Tồn đầu kỳ, Nhập, Xuất, Tồn cuối kỳ) + nút Xuất Excel
  - [x] 16.2 Tạo component `ExcelImportDialog.tsx` — dialog upload file Excel, hiển thị danh sách lỗi nếu có
  - [x] 16.3 Tạo component `ExcelTemplateButton.tsx` — nút tải template Excel
  - [x] 16.4 Thêm hooks useNxtReport, useExportNxtExcel, useDownloadTemplate, useImportExcel vào useReports.ts hoặc tạo hook mới

- [x] 17. Frontend: Cập nhật InventoryPage với tabs
  - [x] 17.1 Cập nhật InventoryPage.tsx — thêm Tabs component (Shadcn UI Tabs): "Tồn kho", "Nhập kiểm sơ bộ", "Nhập/Xuất chi tiết", "Báo cáo NXT"
  - [x] 17.2 Cập nhật StockInForm.tsx — thêm date-time picker cho actualStockDate, dropdown Vị trí kho (từ warehouse positions)
  - [x] 17.3 Tích hợp PreliminaryCheckForm + PreliminaryCheckList vào tab "Nhập kiểm sơ bộ"
  - [x] 17.4 Tích hợp DetailedCheckForm vào tab "Nhập/Xuất chi tiết"
  - [x] 17.5 Tích hợp NxtReportTab vào tab "Báo cáo NXT"
  - [x] 17.6 Tích hợp ExcelImportDialog + ExcelTemplateButton vào header của tab nhập kho

## Phase 7: Property-Based Tests

- [x] 18. Viết property-based tests cho các properties còn lại
  - [x] 18.1 Property test P1: Bất biến di chuyển/hoán đổi vị trí — generate random position pairs, verify swap preserves data
  - [x] 18.2 Property test P2: Nhãn vị trí duy nhất — generate random labels, verify duplicate rejection
  - [x] 18.3 Property test P7: Kiểm soát sức chứa vị trí — generate random (maxCapacity, currentStock, quantity), verify enforcement
  - [x] 18.4 Property test P8: Chế độ kiểm kê tạo đúng tập SP — generate random product sets + mode
  - [x] 18.5 Property test P10: Từ chối submit thiếu nguyên nhân — generate random items with discrepancies
  - [x] 18.6 Property test P12: Lịch sử trạng thái ghi nhận — generate random status transitions
  - [x] 18.7 Property test P14: Bộ lọc tồn kho chính xác — generate random (filters, dataset)
  - [x] 18.8 Property test P21: Tên Loại kho validation — generate random whitespace strings + case variations
  - [x] 18.9 Property test P22: Ngưỡng Min không âm — generate random integers

## Phase 8: Integration & Cleanup

- [x] 19. Integration tests và cleanup
  - [x] 19.1 Viết integration test: Warehouse flow (tạo layout → toggle cells → set capacity → drag/drop)
  - [x] 19.2 Viết integration test: Stocktaking V2 flow (tạo full → nhập thực tế + reason → submit → approve)
  - [x] 19.3 Viết integration test: Preliminary → Detail flow (tạo sơ bộ → kiểm tra chi tiết → verify stock-in)
  - [x] 19.4 Viết integration test: NXT Report flow (tạo transactions → query NXT → verify invariant)
  - [x] 19.5 Viết integration test: Excel Import flow (download template → fill → upload → verify)
  - [x] 19.6 Cập nhật seed.ts — thêm seed data cho WarehouseType mặc định ("Kho sản xuất", "Kho lẻ")
  - [x] 19.7 Cập nhật AppLayout.tsx nếu cần — đảm bảo navigation items phản ánh tabs mới
  - [x] 19.8 Chạy full test suite và fix lỗi
