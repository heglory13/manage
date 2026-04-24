# Kế hoạch Triển khai - Hệ thống Quản lý Kho

## Giai đoạn 1: Khởi tạo dự án và cơ sở hạ tầng

- [x] 1.1 Khởi tạo monorepo với cấu trúc thư mục `backend/` và `frontend/`
  - [x] 1.1.1 Tạo NestJS project trong `backend/` với TypeScript strict mode
  - [ ] 1.1.2 Tạo React + Vite project trong `frontend/` với TypeScript
  - [x] 1.1.3 Cấu hình Tailwind CSS và Shadcn UI cho frontend
  - [x] 1.1.4 Cấu hình ESLint và Prettier cho cả backend và frontend
- [x] 1.2 Cấu hình Prisma ORM và Database
  - [x] 1.2.1 Cài đặt Prisma và tạo file `schema.prisma` với toàn bộ data models theo design document
  - [x] 1.2.2 Tạo migration ban đầu và seed data (admin user mặc định, categories mẫu)
  - [x] 1.2.3 Tạo Prisma service module trong NestJS (`PrismaModule`, `PrismaService`)
- [x] 1.3 Cấu hình testing framework
  - [x] 1.3.1 Cấu hình Jest + fast-check cho backend
  - [x] 1.3.2 Cấu hình Vitest + React Testing Library + fast-check cho frontend

## Giai đoạn 2: Module Xác thực và Phân quyền (Auth & RBAC)

- [x] 2.1 Triển khai Auth Module (Backend)
  - [x] 2.1.1 Tạo `AuthModule` với `AuthController` và `AuthService`
  - [x] 2.1.2 Triển khai endpoint `POST /auth/login` - xác thực email/password, trả về JWT access token + refresh token
  - [x] 2.1.3 Triển khai endpoint `POST /auth/refresh` - refresh token rotation
  - [x] 2.1.4 Triển khai endpoint `POST /auth/logout` - vô hiệu hóa refresh token
  - [x] 2.1.5 Triển khai `JwtStrategy` và `JwtAuthGuard` cho Passport.js
- [x] 2.2 Triển khai RBAC (Backend)
  - [x] 2.2.1 Tạo `@Roles()` decorator và `RolesGuard` kiểm tra vai trò từ JWT payload
  - [x] 2.2.2 Áp dụng `JwtAuthGuard` globally, exclude endpoint login
  - [x] 2.2.3 Triển khai logic cập nhật role ngay lập tức (không cần re-login)
- [x] 2.3 Triển khai User Module (Backend)
  - [x] 2.3.1 Tạo `UserModule` với `UserController` và `UserService`
  - [x] 2.3.2 Triển khai CRUD user: tạo (chỉ Admin), cập nhật role, xóa (chặn tự xóa)
- [x] 2.4 Triển khai Auth Frontend
  - [x] 2.4.1 Tạo `AuthContext` với state management cho JWT tokens
  - [x] 2.4.2 Tạo `LoginPage` với form đăng nhập (email, password)
  - [x] 2.4.3 Tạo Axios interceptor: tự động gắn JWT header, xử lý 401 redirect
  - [x] 2.4.4 Tạo `ProtectedRoute` component kiểm tra auth state và role
- [x] 2.5 Viết tests cho Auth & RBAC
  - [x] 2.5.1 Unit tests: login thành công/thất bại, refresh token, logout
  - [x] 2.5.2 [PBT] Property 1: RBAC access control - *Với bất kỳ cặp (vai trò, tài nguyên), hệ thống chỉ cho phép truy cập khi vai trò nằm trong danh sách được phép*

## Giai đoạn 3: Module Quản lý Sản phẩm và SKU

- [x] 3.1 Triển khai SKU Generator Service (Backend)
  - [x] 3.1.1 Triển khai hàm `removeDiacritics()` - chuyển đổi tiếng Việt có dấu thành viết hoa không dấu
  - [x] 3.1.2 Triển khai hàm `generateSku()` - sinh SKU theo format DANHMUC-NNN-YYYYMMDD
  - [x] 3.1.3 Triển khai hàm `parseSku()` và `formatSku()` - phân tích và ghép lại SKU
  - [x] 3.1.4 Triển khai logic xử lý SKU collision (tăng ID cho đến khi unique)
- [x] 3.2 Triển khai Product Module (Backend)
  - [x] 3.2.1 Tạo `ProductModule` với `ProductController` và `ProductService`
  - [x] 3.2.2 Triển khai `POST /products` - tạo sản phẩm với validation (tên bắt buộc) và auto-generate SKU
  - [x] 3.2.3 Triển khai `GET /products` - danh sách sản phẩm có phân trang
  - [x] 3.2.4 Triển khai `PATCH /products/:id` - cập nhật sản phẩm với validation
  - [x] 3.2.5 Triển khai `DELETE /products/:id` - xóa sản phẩm
- [x] 3.3 Triển khai Product Frontend
  - [x] 3.3.1 Tạo `ProductsPage` với bảng danh sách sản phẩm (Shadcn DataTable)
  - [x] 3.3.2 Tạo `ProductForm` component cho tạo/sửa sản phẩm (Shadcn Dialog + Form)
  - [x] 3.3.3 Tạo React Query hooks: `useProducts`, `useCreateProduct`, `useUpdateProduct`, `useDeleteProduct`
- [x] 3.4 Viết tests cho Product & SKU
  - [x] 3.4.1 [PBT] Property 2: Tên sản phẩm bắt buộc - *Với bất kỳ chuỗi rỗng/whitespace, tạo sản phẩm phải bị từ chối*
  - [x] 3.4.2 [PBT] Property 3: Định dạng SKU - *Với bất kỳ sản phẩm hợp lệ, SKU phải theo format DANHMUC-NNN-YYYYMMDD*
  - [x] 3.4.3 [PBT] Property 4: Tính duy nhất SKU - *Với bất kỳ chuỗi tạo sản phẩm, tất cả SKU phải khác nhau*
  - [x] 3.4.4 [PBT] Property 5: SKU ID tăng dần - *Với bất kỳ chuỗi sản phẩm cùng danh mục, phần ID phải tăng dần*
  - [x] 3.4.5 [PBT] Property 6: SKU round-trip - *Với bất kỳ SKU hợp lệ, parse rồi format phải trả về SKU ban đầu*
  - [x] 3.4.6 [PBT] Property 7: Chuyển đổi dấu tiếng Việt - *Với bất kỳ chuỗi tiếng Việt, removeDiacritics phải trả về chuỗi ASCII viết hoa*

## Giai đoạn 4: Module Nhập/Xuất Kho (Inventory Operations)

- [x] 4.1 Triển khai Inventory Module (Backend)
  - [x] 4.1.1 Tạo `InventoryModule` với `InventoryController` và `InventoryService`
  - [x] 4.1.2 Triển khai `POST /inventory/stock-in` - nhập kho với validation (quantity > 0), cập nhật stock, ghi transaction
  - [x] 4.1.3 Triển khai `POST /inventory/stock-out` - xuất kho với validation (quantity > 0, không vượt tồn kho), cập nhật stock, ghi transaction
  - [x] 4.1.4 Triển khai `GET /inventory` - danh sách tồn kho với bộ lọc (danh mục, thời gian, vị trí) và phân trang
  - [x] 4.1.5 Triển khai `GET /inventory/capacity` - tính toán tỷ lệ sức chứa kho
- [x] 4.2 Triển khai Inventory Frontend
  - [x] 4.2.1 Tạo `InventoryPage` với bảng tồn kho và bộ lọc (Shadcn Select, DatePicker)
  - [x] 4.2.2 Tạo `StockInForm` và `StockOutForm` components (Shadcn Dialog + Form)
  - [x] 4.2.3 Tạo React Query hooks với optimistic updates: `useStockIn`, `useStockOut`, `useInventory`
  - [x] 4.2.4 Tạo `CapacityWarning` component hiển thị cảnh báo khi sức chứa > 90%
  - [x] 4.2.5 Triển khai validation bộ lọc: yêu cầu ít nhất một điều kiện lọc
- [x] 4.3 Viết tests cho Inventory
  - [x] 4.3.1 [PBT] Property 8: Nhập kho tăng tồn kho - *Với bất kỳ (stock, quantity>0), stock mới = stock + quantity*
  - [x] 4.3.2 [PBT] Property 9: Xuất kho giảm tồn kho - *Với bất kỳ (stock>=n, n>0), stock mới = stock - n*
  - [x] 4.3.3 [PBT] Property 10: Từ chối số lượng không hợp lệ - *Với bất kỳ n<=0, nhập/xuất kho bị từ chối*
  - [x] 4.3.4 [PBT] Property 11: Không xuất vượt tồn kho - *Với bất kỳ (stock, n>stock), xuất kho bị từ chối*
  - [x] 4.3.5 [PBT] Property 12: Ghi nhận giao dịch - *Với bất kỳ thao tác thành công, transaction record được tạo đúng*
  - [x] 4.3.6 [PBT] Property 13: Tỷ lệ sức chứa kho - *Với bất kỳ (total, capacity>0), ratio = total/capacity, warning iff ratio > 0.9*
  - [x] 4.3.7 [PBT] Property 14: Bộ lọc yêu cầu điều kiện - *Với bất kỳ filter rỗng, yêu cầu bị từ chối*
  - [x] 4.3.8 [PBT] Property 15: Bộ lọc trả về kết quả chính xác - *Với bất kỳ (filter, data), kết quả thỏa mãn mọi điều kiện*

## Giai đoạn 5: Module Báo cáo và Dashboard

- [x] 5.1 Triển khai Report Module (Backend)
  - [x] 5.1.1 Tạo `ReportModule` với `ReportController` và `ReportService`
  - [x] 5.1.2 Triển khai `GET /reports/export` - tạo file Excel (.xlsx) với các cột theo yêu cầu, sử dụng thư viện `exceljs`
  - [x] 5.1.3 Xử lý trường hợp không có dữ liệu (trả về thông báo lỗi)
- [x] 5.2 Triển khai Dashboard Module (Backend)
  - [x] 5.2.1 Tạo `DashboardModule` với `DashboardController` và `DashboardService`
  - [x] 5.2.2 Triển khai `GET /dashboard/summary` - tổng sản phẩm, tổng tồn kho, nhập/xuất tháng, tỷ lệ sức chứa
  - [x] 5.2.3 Triển khai `GET /dashboard/chart` - dữ liệu biểu đồ nhập/xuất theo tuần hoặc tháng (12 kỳ gần nhất)
  - [x] 5.2.4 Áp dụng `@Roles(Role.MANAGER, Role.ADMIN)` cho tất cả dashboard endpoints
- [x] 5.3 Triển khai Report & Dashboard Frontend
  - [x] 5.3.1 Tạo `DashboardPage` với `SummaryCards` (Shadcn Card) hiển thị 5 chỉ số tổng quan
  - [x] 5.3.2 Tạo `LineChart` component sử dụng Recharts cho biểu đồ nhập/xuất
  - [x] 5.3.3 Tạo `PeriodToggle` component chuyển đổi giữa chế độ tuần/tháng
  - [x] 5.3.4 Tạo nút xuất Excel trên trang tồn kho, sử dụng React Query mutation để tải file
- [x] 5.4 Viết tests cho Report & Dashboard
  - [x] 5.4.1 Unit tests: xuất Excel thành công, không có dữ liệu, RBAC dashboard
  - [x] 5.4.2 Unit tests: summary data, chart data theo tuần/tháng

## Giai đoạn 6: Module Sơ đồ Kho (Warehouse Visualizer)

- [x] 6.1 Triển khai Warehouse Module (Backend)
  - [x] 6.1.1 Tạo `WarehouseModule` với `WarehouseController` và `WarehouseService`
  - [x] 6.1.2 Triển khai CRUD layout: `POST/PATCH/DELETE /warehouse/layout` (chỉ Admin)
  - [x] 6.1.3 Triển khai `GET /warehouse/layout` - lấy sơ đồ kho hiện tại với tất cả vị trí
  - [x] 6.1.4 Triển khai `PATCH /warehouse/positions/:id/product` - gán sản phẩm vào vị trí với validation
- [x] 6.2 Triển khai Warehouse Frontend
  - [x] 6.2.1 Tạo `WarehousePage` với `WarehouseGrid` component hiển thị lưới vị trí kho
  - [x] 6.2.2 Triển khai drag & drop sử dụng `@dnd-kit/core` cho kéo thả sản phẩm vào vị trí
  - [x] 6.2.3 Tạo `PositionCell` component hiển thị thông tin sản phẩm tại mỗi vị trí
  - [x] 6.2.4 Tạo giao diện cấu hình layout cho Admin (tạo/sửa/xóa grid)
- [x] 6.3 Viết tests cho Warehouse
  - [x] 6.3.1 Unit tests: CRUD layout, gán sản phẩm, vị trí không hợp lệ, RBAC
  - [x] 6.3.2 Unit tests: drag-drop handler, grid rendering

## Giai đoạn 7: Module Kiểm kê (Stocktaking & Audit)

- [x] 7.1 Triển khai Stocktaking Module (Backend)
  - [x] 7.1.1 Tạo `StocktakingModule` với `StocktakingController` và `StocktakingService`
  - [x] 7.1.2 Triển khai `POST /stocktaking` - tạo biên bản kiểm kê với auto-calculate discrepancy và evidence validation
  - [x] 7.1.3 Triển khai `PATCH /stocktaking/:id/approve` - phê duyệt biên bản, cập nhật tồn kho theo số thực tế (chỉ Manager/Admin)
  - [x] 7.1.4 Triển khai `PATCH /stocktaking/:id/reject` - từ chối biên bản, giữ nguyên tồn kho (chỉ Manager/Admin)
  - [x] 7.1.5 Triển khai `GET /stocktaking` - danh sách biên bản kiểm kê có phân trang
- [x] 7.2 Triển khai Stocktaking Frontend
  - [x] 7.2.1 Tạo `StocktakingPage` với bảng danh sách biên bản kiểm kê
  - [x] 7.2.2 Tạo `StocktakingForm` component cho tạo biên bản (chọn sản phẩm, nhập số thực tế)
  - [x] 7.2.3 Tạo `EvidenceUpload` component cho upload ảnh/file minh chứng
  - [x] 7.2.4 Tạo giao diện phê duyệt/từ chối cho Manager/Admin
- [x] 7.3 Viết tests cho Stocktaking
  - [x] 7.3.1 [PBT] Property 16: Tính toán chênh lệch - *Với bất kỳ (system, actual), discrepancy = actual - system*
  - [x] 7.3.2 [PBT] Property 17: Yêu cầu minh chứng - *Với bất kỳ item có discrepancy≠0 mà không có evidence, từ chối lưu*
  - [x] 7.3.3 [PBT] Property 18: Phê duyệt điều chỉnh tồn kho - *Với bất kỳ biên bản, phê duyệt cập nhật stock = actual quantity*
  - [x] 7.3.4 [PBT] Property 19: Từ chối giữ nguyên tồn kho - *Với bất kỳ biên bản, từ chối giữ nguyên stock*

## Giai đoạn 8: Layout, Navigation và Mobile-first

- [x] 8.1 Triển khai Layout chung
  - [x] 8.1.1 Tạo `AppLayout` với Sidebar (desktop) và Bottom Navigation (mobile) sử dụng Shadcn Sheet
  - [x] 8.1.2 Tạo `Header` component với user info, capacity warning icon, và logout button
  - [x] 8.1.3 Cấu hình React Router với tất cả routes và `ProtectedRoute` wrappers
- [x] 8.2 Tạo trang quản lý Users (Admin)
  - [x] 8.2.1 Tạo `UsersPage` với bảng danh sách users và form tạo/sửa user
- [x] 8.3 Responsive và Mobile optimization
  - [x] 8.3.1 Kiểm tra và điều chỉnh responsive cho tất cả các trang (320px - 1920px)
  - [x] 8.3.2 Tối ưu touch targets và spacing cho mobile

## Giai đoạn 9: Integration Tests và Hoàn thiện

- [x] 9.1 Viết Integration Tests
  - [x] 9.1.1 Integration test: Auth flow (login → access → refresh → logout)
  - [x] 9.1.2 Integration test: Stock flow (tạo sản phẩm → nhập kho → xuất kho → kiểm tra tồn kho)
  - [x] 9.1.3 Integration test: Stocktaking flow (tạo biên bản → phê duyệt → kiểm tra tồn kho cập nhật)
  - [x] 9.1.4 Integration test: RBAC flow (truy cập endpoint với các vai trò khác nhau)
- [x] 9.2 Hoàn thiện và tối ưu
  - [x] 9.2.1 Review và tối ưu React Query cache configuration (staleTime, cacheTime)
  - [x] 9.2.2 Thêm input sanitization middleware cho NestJS (class-validator + class-transformer)
  - [x] 9.2.3 Cấu hình CORS, rate limiting, và helmet cho NestJS
