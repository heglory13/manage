# Kế hoạch Triển khai - Nâng cấp Hệ thống V3

## Task 1: Cập nhật Prisma Schema và Migration

- [ ] 1.1 Thêm trường `maxThreshold Int @default(0)` vào model `Product` trong `backend/prisma/schema.prisma`
- [x] 1.2 Tạo model `SavedFilter` mới trong schema (id, userId, pageKey, name, filters Json, createdAt, relation User, index [userId, pageKey], @@map "saved_filters")
- [x] 1.3 Tạo model `ActivityLog` mới trong schema (id, userId, userName, action, tableName, recordId, oldData Json?, newData Json?, createdAt, indexes [userId], [tableName], [action], [createdAt], @@map "activity_logs")
- [x] 1.4 Thêm relation `savedFilters SavedFilter[]` vào model `User`
- [x] 1.5 Chạy `npx prisma migrate dev --name v3-upgrade` để tạo migration
- [x] 1.6 Chạy `npx prisma generate` để cập nhật Prisma Client

## Task 2: Backend — Dashboard Alerts API

- [x] 2.1 Thêm method `getAlertsBelowMin()` vào `DashboardService`: query products WHERE stock < minThreshold AND minThreshold > 0, include category
- [x] 2.2 Thêm method `getAlertsAboveMax()` vào `DashboardService`: query products WHERE stock > maxThreshold AND maxThreshold > 0, include category
- [x] 2.3 Thêm endpoint `GET /dashboard/alerts/below-min` vào `DashboardController` với `@Roles(Role.MANAGER, Role.ADMIN)`
- [x] 2.4 Thêm endpoint `GET /dashboard/alerts/above-max` vào `DashboardController` với `@Roles(Role.MANAGER, Role.ADMIN)`
- [x] 2.5 Viết property test P1: lọc cảnh báo dưới định mức — generate random products, verify filter correctness (file: `backend/src/dashboard/dashboard.pbt.spec.ts`)
- [x] 2.6 Viết property test P2: lọc cảnh báo trên định mức — generate random products, verify filter correctness (file: `backend/src/dashboard/dashboard.pbt.spec.ts`)

## Task 3: Backend — Dashboard Top Products & Zones API

- [x] 3.1 Thêm method `getTopProducts(type: 'highest' | 'lowest', limit: number)` vào `DashboardService`: query products orderBy stock desc/asc, take limit
- [x] 3.2 Thêm method `getTopZones(type: 'highest' | 'lowest', limit: number)` vào `DashboardService`: query storageZones orderBy currentStock desc/asc, take limit, tính usagePercent
- [x] 3.3 Tạo DTOs: `TopProductsQueryDto` (type, limit) và `TopZonesQueryDto` (type, limit) trong `backend/src/dashboard/dto/`
- [x] 3.4 Thêm endpoints `GET /dashboard/top-products` và `GET /dashboard/top-zones` vào `DashboardController`
- [x] 3.5 Viết property test P3: sắp xếp và giới hạn Top N — generate random items, verify sort order và length constraint (file: `backend/src/dashboard/dashboard.pbt.spec.ts`)

## Task 4: Backend — Dashboard Enhanced Chart API (3 đường)

- [x] 4.1 Thêm method `getChartDataV2(period)` vào `DashboardService`: trả về `ChartDataV2` với 3 arrays (stockIn, stockOut, inventory)
- [x] 4.2 Implement logic tính tuần: cutoff = Chủ nhật 12:00 GMT+7 (05:00 UTC), tính tổng nhập/xuất trong tuần, tính tổng tồn kho tại cutoff
- [x] 4.3 Implement logic tính tháng: cutoff = ngày cuối tháng 23:59:59, tính tổng nhập/xuất trong tháng, tính tổng tồn kho tại cutoff
- [x] 4.4 Thêm endpoint `GET /dashboard/chart-v2` vào `DashboardController`
- [x] 4.5 Viết property test P4: cutoff tuần GMT+7 — generate random dates, verify cutoff luôn là Chủ nhật 05:00 UTC (file: `backend/src/dashboard/dashboard.pbt.spec.ts`)

## Task 5: Backend — Dashboard Detail Drill-down API

- [x] 5.1 Thêm method `getDetailProducts(page, limit)` vào `DashboardService`: trả về tất cả sản phẩm phân trang
- [x] 5.2 Thêm method `getDetailStock(page, limit)` vào `DashboardService`: trả về sản phẩm sắp xếp theo stock giảm dần, phân trang
- [x] 5.3 Thêm method `getDetailTransactions(type, page, limit)` vào `DashboardService`: trả về giao dịch nhập/xuất tháng hiện tại, include product name, user name, phân trang
- [x] 5.4 Tạo DTOs: `DetailQueryDto` (page, limit) và `DetailTransactionsQueryDto` (type, page, limit) trong `backend/src/dashboard/dto/`
- [x] 5.5 Thêm endpoints `GET /dashboard/detail/products`, `GET /dashboard/detail/stock`, `GET /dashboard/detail/transactions` vào `DashboardController`

## Task 6: Backend — Product maxThreshold

- [x] 6.1 Tạo DTO `UpdateMaxThresholdDto` trong `backend/src/product/dto/` với validation `@IsInt()`, `@Min(0)`
- [x] 6.2 Thêm method `updateMaxThreshold(id, maxThreshold)` vào `ProductService`: validate >= 0, update product
- [x] 6.3 Thêm endpoint `PATCH /products/:id/max-threshold` vào `ProductController`
- [x] 6.4 Export DTO mới từ `backend/src/product/dto/index.ts`

## Task 7: Backend — SavedFilter Module

- [x] 7.1 Tạo `backend/src/saved-filter/saved-filter.module.ts` với controller và service
- [x] 7.2 Tạo `backend/src/saved-filter/saved-filter.service.ts` với methods: findAll(userId, pageKey), create(userId, dto), delete(id, userId)
- [x] 7.3 Implement validation trong create: tên không rỗng (trim), giới hạn 20 per user per pageKey
- [x] 7.4 Tạo `backend/src/saved-filter/saved-filter.controller.ts` với endpoints: GET /, POST /, DELETE /:id
- [x] 7.5 Tạo DTOs: `CreateSavedFilterDto` (pageKey, name, filters) trong `backend/src/saved-filter/dto/`
- [x] 7.6 Đăng ký `SavedFilterModule` trong `AppModule` (`backend/src/app.module.ts`)
- [x] 7.7 Viết property test P6: tên bộ lọc validation — generate whitespace strings, verify rejection (file: `backend/src/saved-filter/saved-filter.pbt.spec.ts`)
- [x] 7.8 Viết property test P7: giới hạn 20 bộ lọc — verify limit enforcement (file: `backend/src/saved-filter/saved-filter.pbt.spec.ts`)

## Task 8: Backend — ActivityLog Module

- [x] 8.1 Tạo `backend/src/activity-log/activity-log.module.ts` với controller, service, interceptor
- [x] 8.2 Tạo `backend/src/activity-log/activity-log.service.ts` với methods: create(logData), findAll(query)
- [x] 8.3 Tạo `backend/src/activity-log/activity-log.interceptor.ts`: NestJS Interceptor intercept POST/PATCH/DELETE, extract userId/userName từ request, xác định action/tableName từ route, ghi log async (fire-and-forget)
- [x] 8.4 Tạo `backend/src/activity-log/activity-log.controller.ts` với endpoint: GET / (Admin only, phân trang, lọc)
- [x] 8.5 Tạo DTOs: `ActivityLogQueryDto` (userId, action, tableName, startDate, endDate, page, limit) trong `backend/src/activity-log/dto/`
- [x] 8.6 Đăng ký `ActivityLogModule` trong `AppModule` và đăng ký `ActivityLogInterceptor` là global interceptor
- [x] 8.7 Viết property test P8: interceptor tạo đúng ActivityLog — generate (action, data) pairs, verify log correctness (file: `backend/src/activity-log/activity-log.pbt.spec.ts`)
- [x] 8.8 Viết property test P9: lọc nhật ký — generate logs + filters, verify filter correctness (file: `backend/src/activity-log/activity-log.pbt.spec.ts`)
- [x] 8.9 Viết property test P10: admin-only access — generate roles, verify 403 for non-admin (file: `backend/src/activity-log/activity-log.pbt.spec.ts`)

## Task 9: Frontend — Dashboard Alerts & Rankings

- [x] 9.1 Thêm hooks vào `frontend/src/hooks/useDashboard.ts`: `useAlertsBelowMin()`, `useAlertsAboveMax()`, `useTopProducts(type)`, `useTopZones(type)`
- [x] 9.2 Tạo component `frontend/src/components/dashboard/AlertSection.tsx`: hiển thị bảng cảnh báo (tên, SKU, tồn kho, ngưỡng), empty state message
- [x] 9.3 Tạo component `frontend/src/components/dashboard/TopProductsTable.tsx`: bảng top 20 (STT, Tên, SKU, Tồn kho)
- [x] 9.4 Tạo component `frontend/src/components/dashboard/TopZonesTable.tsx`: bảng top 10 (STT, Tên, Sức chứa, Tồn kho, Tỷ lệ %)
- [x] 9.5 Cập nhật `frontend/src/pages/DashboardPage.tsx`: thêm AlertSection (dưới/trên), TopProductsTable, TopZonesTable

## Task 10: Frontend — Dashboard Enhanced Chart (3 đường + data labels)

- [x] 10.1 Thêm hook `useDashboardChartV2(period)` vào `frontend/src/hooks/useDashboard.ts`: gọi `/dashboard/chart-v2`
- [x] 10.2 Cập nhật type `ChartDataV2` trong `frontend/src/types/index.ts`: thêm `inventory: number[]`
- [x] 10.3 Cập nhật `frontend/src/components/dashboard/LineChart.tsx`: thêm đường "Tồn" (màu xanh lá), thêm `<LabelList>` trên mỗi đường để hiển thị giá trị
- [x] 10.4 Cập nhật `DashboardPage.tsx`: sử dụng `useDashboardChartV2` thay vì `useDashboardChart`

## Task 11: Frontend — Dashboard Summary Card Drill-down

- [x] 11.1 Thêm hooks vào `useDashboard.ts`: `useDetailProducts(page)`, `useDetailStock(page)`, `useDetailTransactions(type, page)`
- [x] 11.2 Tạo component `frontend/src/components/dashboard/SummaryDetailDialog.tsx`: dialog hiển thị bảng chi tiết với phân trang (> 20 bản ghi)
- [x] 11.3 Cập nhật `frontend/src/components/dashboard/SummaryCards.tsx`: thêm `onClick` handler cho mỗi card, mở SummaryDetailDialog với loại tương ứng
- [x] 11.4 Thêm types mới vào `frontend/src/types/index.ts`: `AlertProduct`, `TopProduct`, `TopZone`, `TransactionDetail`

## Task 12: Frontend — Saved Filters (Column Filter + Tabs)

- [x] 12.1 Tạo hook `frontend/src/hooks/useSavedFilters.ts`: `useSavedFilters(pageKey)`, `useCreateSavedFilter()`, `useDeleteSavedFilter()`
- [x] 12.2 Tạo component `frontend/src/components/common/ColumnFilter.tsx`: dropdown filter cho cột bảng (hiển thị giá trị duy nhất, multi-select, visual indicator khi active)
- [x] 12.3 Tạo component `frontend/src/components/common/SavedFilterTabs.tsx`: hiển thị tabs lọc nhanh phía trên bảng, nút "Lưu bộ lọc", nút xóa trên mỗi tab
- [x] 12.4 Tạo component `frontend/src/components/common/FilterableTable.tsx`: wrapper table tích hợp ColumnFilter + SavedFilterTabs
- [x] 12.5 Viết property test P5: bộ lọc đa cột — generate random data + filters, verify intersection logic (file: `frontend/src/components/common/ColumnFilter.test.ts`)
- [ ] 12.6 Tích hợp FilterableTable vào `ProductsPage.tsx`
- [ ] 12.7 Tích hợp FilterableTable vào `InventoryPage.tsx` (tab Tồn kho)
- [ ] 12.8 Tích hợp FilterableTable vào `StocktakingPage.tsx`
- [ ] 12.9 Thêm types mới vào `frontend/src/types/index.ts`: `SavedFilter`, `CreateSavedFilterPayload`

## Task 13: Frontend — Activity Log Tab

- [ ] 13.1 Tạo hook `frontend/src/hooks/useActivityLogs.ts`: `useActivityLogs(query)` với lọc và phân trang
- [ ] 13.2 Tạo component `frontend/src/components/activity-log/ActivityLogFilters.tsx`: bộ lọc (người thực hiện, hành động, bảng dữ liệu, khoảng thời gian)
- [ ] 13.3 Tạo component `frontend/src/components/activity-log/ActivityLogDiffView.tsx`: hiển thị diff so sánh oldData/newData (highlight thay đổi)
- [ ] 13.4 Tạo component `frontend/src/components/activity-log/ActivityLogTable.tsx`: bảng nhật ký (Thời gian, Người thực hiện, Hành động, Bảng, Mô tả), click mở DiffView, phân trang 20/trang
- [ ] 13.5 Cập nhật `frontend/src/pages/UsersPage.tsx`: thêm Tabs component, tab "Người dùng" (nội dung hiện tại) và tab "Nhật ký hoạt động" (chỉ hiển thị cho Admin)
- [ ] 13.6 Thêm types mới vào `frontend/src/types/index.ts`: `ActivityLog`, `ActivityLogQuery`

## Task 14: Frontend — Input Declaration 8 cột bảng tính

- [ ] 14.1 Tạo component `frontend/src/components/input-declaration/SpreadsheetColumn.tsx`: cột đơn (tiêu đề, danh sách dọc, nút "Thêm" ở cuối, ô nhập liệu inline)
- [ ] 14.2 Tạo component `frontend/src/components/input-declaration/SpreadsheetLayout.tsx`: layout 8 cột song song (Category, Classification, Color, Size, Material, ProductCondition, StorageZone + Capacity, WarehouseType), responsive scroll ngang
- [ ] 14.3 Thêm hook `useCategories()` vào `frontend/src/hooks/useInputDeclarations.ts`: gọi `GET /categories`
- [ ] 14.4 Cập nhật `frontend/src/pages/InputDeclarationPage.tsx`: thay thế layout hiện tại bằng SpreadsheetLayout ở khu vực "Khai báo trường thông tin", giữ nguyên các section SKU Combo, Tình trạng, Khu vực, Loại kho, Ngưỡng Min bên dưới (hoặc tích hợp vào spreadsheet)

## Task 15: Kiểm tra tổng thể và hoàn thiện

- [ ] 15.1 Chạy tất cả property tests backend: `cd backend && npx jest --testPathPattern=pbt`
- [ ] 15.2 Chạy tất cả property tests frontend: `cd frontend && npx vitest run --testPathPattern=test`
- [ ] 15.3 Chạy build backend: `cd backend && npm run build`
- [ ] 15.4 Chạy build frontend: `cd frontend && npm run build`
- [ ] 15.5 Kiểm tra không có lỗi TypeScript hoặc lint
