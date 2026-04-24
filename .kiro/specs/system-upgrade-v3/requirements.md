# Tài liệu Yêu cầu - Nâng cấp Hệ thống Quản lý Kho V3 (System Upgrade V3)

## Giới thiệu

Tài liệu này mô tả các yêu cầu cho đợt nâng cấp V3 của Hệ thống Quản lý Kho hiện tại. Đợt nâng cấp bao gồm 4 module chính: (1) Dashboard Nâng cấp — cảnh báo tồn kho dưới/trên định mức, bảng xếp hạng top mã hàng và khu vực, biểu đồ 3 đường (Nhập, Xuất, Tồn) theo tuần/tháng, click vào ô tổng để xem chi tiết; (2) Bộ lọc lưu được (Saved Filters) — áp dụng chung cho tất cả các trang danh sách, cho phép lưu bộ lọc và tạo tab lọc nhanh; (3) Nhật ký hoạt động (Activity Log) — ghi nhận mọi thao tác thêm/xóa/sửa dữ liệu của người dùng; (4) Khai báo Input — hiển thị đầy đủ 8 cột khai báo trên trang Input Declaration dưới dạng bảng tính.

**Công nghệ sử dụng:** Giống hệ thống hiện tại — NestJS + Prisma + React + TypeScript + Tailwind CSS + Shadcn UI + React Query + PostgreSQL.

## Bảng thuật ngữ (Glossary)

- **Hệ_thống**: Ứng dụng web Quản lý Kho bao gồm cả Frontend và Backend
- **Backend**: Máy chủ API NestJS xử lý logic nghiệp vụ
- **Frontend**: Giao diện người dùng React chạy trên trình duyệt web
- **Người_dùng**: Bất kỳ ai tương tác với Hệ_thống (Admin, Manager, Staff)
- **Admin**: Vai trò có toàn quyền quản trị Hệ_thống
- **Manager**: Vai trò có quyền xem Dashboard và báo cáo
- **Dashboard**: Trang tổng quan hiển thị số liệu thống kê, cảnh báo và biểu đồ
- **Ngưỡng_Min**: Số lượng tồn kho tối thiểu đã cài đặt cho sản phẩm (trường minThreshold trong Product)
- **Ngưỡng_Max**: Số lượng tồn kho tối đa cho phép của sản phẩm (trường maxThreshold mới cần thêm vào Product)
- **Cảnh_báo_Tồn_kho**: Thông báo trên Dashboard khi tồn kho của sản phẩm nằm ngoài khoảng cho phép (dưới Ngưỡng_Min hoặc trên Ngưỡng_Max)
- **Ô_Tổng**: Các thẻ (card) hiển thị số liệu tổng hợp trên Dashboard (Tổng sản phẩm, Tổng tồn kho, Nhập kho tháng này, Xuất kho tháng này, Tỷ lệ sức chứa)
- **Bộ_lọc**: Tập hợp các điều kiện lọc dữ liệu áp dụng cho bảng danh sách
- **Bộ_lọc_Đã_lưu**: Một Bộ_lọc đã được đặt tên và lưu vào cơ sở dữ liệu để sử dụng lại
- **Tab_Lọc_Nhanh**: Nút bấm trên giao diện đại diện cho một Bộ_lọc_Đã_lưu, cho phép áp dụng bộ lọc bằng một click
- **Nhật_ký_Hoạt_động**: Bản ghi lưu trữ mọi thao tác thay đổi dữ liệu (thêm, sửa, xóa) trong Hệ_thống
- **Trang_Khai_báo_Input**: Trang giao diện quản lý khai báo các trường thông tin đầu vào
- **Khu_vực_Hàng_hoá**: Vùng lưu trữ hoặc thùng chứa hàng trong kho (StorageZone)
- **SKU_Tổng_hợp**: Mã định danh sản phẩm ghép từ Phân_loại + Màu + Size + Chất_liệu
- **Múi_giờ_GMT7**: Múi giờ Đông Dương (UTC+7), dùng làm chuẩn tính toán thời gian biểu đồ
- **Cuối_tuần**: Thời điểm 12:00 trưa Chủ nhật theo Múi_giờ_GMT7
- **React_Query_Cache**: Bộ nhớ đệm phía client do React Query quản lý

## Yêu cầu

---

## MODULE 1: Dashboard Nâng cấp

### Yêu cầu 1: Cảnh báo tồn kho dưới định mức

**User Story:** Là một Manager, tôi muốn nhìn thấy danh sách sản phẩm có tồn kho dưới ngưỡng tối thiểu trên Dashboard, để kịp thời bổ sung hàng hoá.

#### Tiêu chí chấp nhận

1. THE Backend SHALL trả về danh sách sản phẩm có số lượng tồn kho (stock) nhỏ hơn Ngưỡng_Min (minThreshold) của sản phẩm đó khi được gọi API cảnh báo tồn kho.
2. THE Frontend SHALL hiển thị khu vực "Cảnh báo tồn kho dưới định mức" trên Dashboard với danh sách sản phẩm bao gồm: tên sản phẩm, SKU, tồn kho hiện tại và Ngưỡng_Min.
3. WHEN không có sản phẩm nào có tồn kho dưới Ngưỡng_Min, THE Frontend SHALL hiển thị thông báo "Không có sản phẩm nào dưới định mức".
4. THE Backend SHALL chỉ bao gồm sản phẩm có Ngưỡng_Min lớn hơn 0 trong danh sách cảnh báo dưới định mức.

---

### Yêu cầu 2: Cảnh báo tồn kho trên định mức

**User Story:** Là một Manager, tôi muốn nhìn thấy danh sách sản phẩm có tồn kho vượt ngưỡng tối đa trên Dashboard, để điều chỉnh kế hoạch nhập hàng.

#### Tiêu chí chấp nhận

1. THE Backend SHALL bổ sung trường maxThreshold (số nguyên, mặc định 0) vào model Product trong Prisma schema.
2. THE Backend SHALL trả về danh sách sản phẩm có số lượng tồn kho (stock) lớn hơn Ngưỡng_Max (maxThreshold) của sản phẩm đó khi được gọi API cảnh báo tồn kho.
3. THE Frontend SHALL hiển thị khu vực "Cảnh báo tồn kho trên định mức" trên Dashboard với danh sách sản phẩm bao gồm: tên sản phẩm, SKU, tồn kho hiện tại và Ngưỡng_Max.
4. WHEN không có sản phẩm nào có tồn kho trên Ngưỡng_Max, THE Frontend SHALL hiển thị thông báo "Không có sản phẩm nào trên định mức".
5. THE Backend SHALL chỉ bao gồm sản phẩm có Ngưỡng_Max lớn hơn 0 trong danh sách cảnh báo trên định mức.

---

### Yêu cầu 3: Top 20 mã hàng tồn kho nhiều nhất và ít nhất

**User Story:** Là một Manager, tôi muốn xem bảng xếp hạng top 20 mã hàng có tồn kho nhiều nhất và ít nhất, để nắm bắt tình hình phân bổ hàng hoá.

#### Tiêu chí chấp nhận

1. THE Backend SHALL trả về danh sách 20 sản phẩm có số lượng tồn kho (stock) cao nhất, sắp xếp giảm dần theo stock.
2. THE Backend SHALL trả về danh sách 20 sản phẩm có số lượng tồn kho (stock) thấp nhất (stock lớn hơn hoặc bằng 0), sắp xếp tăng dần theo stock.
3. THE Frontend SHALL hiển thị bảng "Top 20 tồn kho nhiều nhất" trên Dashboard với các cột: STT, Tên sản phẩm, SKU, Tồn kho.
4. THE Frontend SHALL hiển thị bảng "Top 20 tồn kho ít nhất" trên Dashboard với các cột: STT, Tên sản phẩm, SKU, Tồn kho.

---

### Yêu cầu 4: Top 10 khu vực chứa hàng hoá nhiều nhất và ít nhất

**User Story:** Là một Manager, tôi muốn xem bảng xếp hạng top 10 khu vực/thùng chứa hàng hoá nhiều nhất và ít nhất, để đánh giá mức độ sử dụng khu vực kho.

#### Tiêu chí chấp nhận

1. THE Backend SHALL trả về danh sách 10 Khu_vực_Hàng_hoá có currentStock cao nhất, sắp xếp giảm dần theo currentStock.
2. THE Backend SHALL trả về danh sách 10 Khu_vực_Hàng_hoá có currentStock thấp nhất, sắp xếp tăng dần theo currentStock.
3. THE Frontend SHALL hiển thị bảng "Top 10 khu vực chứa nhiều nhất" trên Dashboard với các cột: STT, Tên khu vực, Sức chứa tối đa, Tồn kho hiện tại, Tỷ lệ sử dụng (%).
4. THE Frontend SHALL hiển thị bảng "Top 10 khu vực chứa ít nhất" trên Dashboard với các cột: STT, Tên khu vực, Sức chứa tối đa, Tồn kho hiện tại, Tỷ lệ sử dụng (%).

---

### Yêu cầu 5: Biểu đồ 12 tuần gần nhất (3 đường: Nhập, Xuất, Tồn)

**User Story:** Là một Manager, tôi muốn xem biểu đồ biến động nhập-xuất-tồn kho theo 12 tuần gần nhất, để theo dõi xu hướng ngắn hạn.

#### Tiêu chí chấp nhận

1. WHEN Người_dùng chọn chế độ xem "Tuần" trên Dashboard, THE Backend SHALL trả về dữ liệu biểu đồ cho 12 tuần gần nhất.
2. THE Backend SHALL tính toán mỗi điểm dữ liệu tuần tại thời điểm Cuối_tuần (12:00 trưa Chủ nhật theo Múi_giờ_GMT7).
3. THE Backend SHALL trả về ba chuỗi dữ liệu cho mỗi tuần: tổng số lượng nhập kho trong tuần, tổng số lượng xuất kho trong tuần và tổng tồn kho tại thời điểm Cuối_tuần.
4. THE Frontend SHALL hiển thị biểu đồ đường (line chart) với 3 đường: "Nhập" (màu xanh dương), "Xuất" (màu đỏ), "Tồn" (màu xanh lá).
5. THE Frontend SHALL hiển thị giá trị số lượng trên mỗi điểm dữ liệu của biểu đồ.

---

### Yêu cầu 6: Biểu đồ 12 tháng gần nhất (3 đường: Nhập, Xuất, Tồn)

**User Story:** Là một Manager, tôi muốn xem biểu đồ biến động nhập-xuất-tồn kho theo 12 tháng gần nhất, để theo dõi xu hướng dài hạn.

#### Tiêu chí chấp nhận

1. WHEN Người_dùng chọn chế độ xem "Tháng" trên Dashboard, THE Backend SHALL trả về dữ liệu biểu đồ cho 12 tháng gần nhất.
2. THE Backend SHALL tính toán mỗi điểm dữ liệu tháng tại thời điểm cuối tháng (ngày cuối cùng của tháng, 23:59:59).
3. THE Backend SHALL trả về ba chuỗi dữ liệu cho mỗi tháng: tổng số lượng nhập kho trong tháng, tổng số lượng xuất kho trong tháng và tổng tồn kho tại thời điểm cuối tháng.
4. THE Frontend SHALL hiển thị biểu đồ đường (line chart) với 3 đường: "Nhập" (màu xanh dương), "Xuất" (màu đỏ), "Tồn" (màu xanh lá).
5. THE Frontend SHALL hiển thị giá trị số lượng trên mỗi điểm dữ liệu của biểu đồ.

---

### Yêu cầu 7: Click vào ô tổng để xem chi tiết

**User Story:** Là một Manager, tôi muốn click vào các ô hiển thị số tổng trên Dashboard để xem danh sách chi tiết, để nhanh chóng truy xuất dữ liệu cụ thể.

#### Tiêu chí chấp nhận

1. WHEN Người_dùng click vào Ô_Tổng "Tổng sản phẩm", THE Frontend SHALL hiển thị dialog/modal chứa danh sách tất cả sản phẩm với các cột: Tên, SKU, Danh mục, Tồn kho.
2. WHEN Người_dùng click vào Ô_Tổng "Tổng tồn kho", THE Frontend SHALL hiển thị dialog/modal chứa danh sách sản phẩm sắp xếp theo tồn kho giảm dần với các cột: Tên, SKU, Tồn kho.
3. WHEN Người_dùng click vào Ô_Tổng "Nhập kho tháng này", THE Frontend SHALL hiển thị dialog/modal chứa danh sách giao dịch nhập kho trong tháng hiện tại với các cột: Ngày, Sản phẩm, SKU, Số lượng, Người thực hiện.
4. WHEN Người_dùng click vào Ô_Tổng "Xuất kho tháng này", THE Frontend SHALL hiển thị dialog/modal chứa danh sách giao dịch xuất kho trong tháng hiện tại với các cột: Ngày, Sản phẩm, SKU, Số lượng, Người thực hiện.
5. THE Frontend SHALL hỗ trợ phân trang trong mỗi dialog chi tiết khi số lượng bản ghi vượt quá 20.
6. THE Backend SHALL cung cấp API trả về dữ liệu chi tiết cho từng loại Ô_Tổng với hỗ trợ phân trang.

---

## MODULE 2: Bộ lọc lưu được (Saved Filters) — ÁP DỤNG CHUNG

### Yêu cầu 8: Bộ lọc dữ liệu theo trường thông tin

**User Story:** Là một Người_dùng, tôi muốn lọc dữ liệu trong các bảng danh sách theo từng trường thông tin (giống Filter Excel), để tìm kiếm và xem dữ liệu theo nhu cầu.

#### Tiêu chí chấp nhận

1. THE Frontend SHALL hiển thị biểu tượng lọc (filter icon) trên tiêu đề mỗi cột của bảng danh sách trong các trang: Sản phẩm, Tồn kho, Kiểm kê, Khai báo Input.
2. WHEN Người_dùng click vào biểu tượng lọc của một cột, THE Frontend SHALL hiển thị dropdown chứa danh sách các giá trị duy nhất của cột đó để Người_dùng chọn.
3. WHEN Người_dùng chọn một hoặc nhiều giá trị trong dropdown lọc, THE Frontend SHALL lọc bảng danh sách chỉ hiển thị các bản ghi có giá trị cột tương ứng nằm trong tập giá trị đã chọn.
4. THE Frontend SHALL cho phép áp dụng bộ lọc đồng thời trên nhiều cột; kết quả hiển thị phải thỏa mãn tất cả điều kiện lọc.
5. THE Frontend SHALL hiển thị chỉ báo trực quan (visual indicator) trên tiêu đề cột đang có bộ lọc đang hoạt động.
6. WHEN Người_dùng nhấn nút "Xóa bộ lọc", THE Frontend SHALL xóa tất cả điều kiện lọc và hiển thị lại toàn bộ dữ liệu.

---

### Yêu cầu 9: Lưu bộ lọc để sử dụng lại

**User Story:** Là một Người_dùng, tôi muốn lưu các bộ lọc thường dùng và tạo tab lọc nhanh, để tiết kiệm thời gian khi lọc dữ liệu lặp lại.

#### Tiêu chí chấp nhận

1. WHEN Người_dùng đã áp dụng bộ lọc và nhấn nút "Lưu bộ lọc", THE Frontend SHALL hiển thị dialog yêu cầu nhập tên cho Bộ_lọc_Đã_lưu.
2. WHEN Người_dùng xác nhận tên bộ lọc, THE Backend SHALL lưu Bộ_lọc_Đã_lưu vào cơ sở dữ liệu bao gồm: tên bộ lọc, trang áp dụng (pageKey), điều kiện lọc (filters dạng JSON) và userId của người tạo.
3. THE Frontend SHALL hiển thị danh sách Tab_Lọc_Nhanh phía trên bảng danh sách, mỗi tab đại diện cho một Bộ_lọc_Đã_lưu của Người_dùng hiện tại trên trang hiện tại.
4. WHEN Người_dùng click vào một Tab_Lọc_Nhanh, THE Frontend SHALL tự động áp dụng các điều kiện lọc đã lưu và cập nhật bảng danh sách.
5. WHEN Người_dùng nhấn nút xóa trên Tab_Lọc_Nhanh, THE Backend SHALL xóa Bộ_lọc_Đã_lưu tương ứng khỏi cơ sở dữ liệu.
6. THE Backend SHALL yêu cầu tên Bộ_lọc_Đã_lưu là bắt buộc và không được để trống hoặc chỉ chứa khoảng trắng.
7. THE Backend SHALL đảm bảo mỗi Người_dùng có thể lưu tối đa 20 Bộ_lọc_Đã_lưu cho mỗi trang.
8. IF Người_dùng đã đạt giới hạn 20 Bộ_lọc_Đã_lưu cho một trang, THEN THE Backend SHALL từ chối tạo mới và trả về thông báo "Đã đạt giới hạn tối đa 20 bộ lọc cho trang này".

---

## MODULE 3: Nhật ký hoạt động (Activity Log)

### Yêu cầu 10: Ghi nhận nhật ký hoạt động

**User Story:** Là một Admin, tôi muốn hệ thống tự động ghi nhận mọi thao tác thay đổi dữ liệu của người dùng, để theo dõi và kiểm soát hoạt động trên hệ thống.

#### Tiêu chí chấp nhận

1. WHEN Người_dùng thực hiện thao tác thêm mới dữ liệu (tạo sản phẩm, nhập kho, tạo khu vực, ...), THE Backend SHALL tạo một bản ghi Nhật_ký_Hoạt_động chứa: userId, tên người dùng, loại hành động ("CREATE"), tên bảng dữ liệu bị ảnh hưởng, ID bản ghi bị ảnh hưởng, dữ liệu mới (newData dạng JSON) và thời gian thực hiện.
2. WHEN Người_dùng thực hiện thao tác chỉnh sửa dữ liệu, THE Backend SHALL tạo một bản ghi Nhật_ký_Hoạt_động chứa: userId, tên người dùng, loại hành động ("UPDATE"), tên bảng dữ liệu bị ảnh hưởng, ID bản ghi bị ảnh hưởng, dữ liệu cũ (oldData dạng JSON), dữ liệu mới (newData dạng JSON) và thời gian thực hiện.
3. WHEN Người_dùng thực hiện thao tác xóa dữ liệu, THE Backend SHALL tạo một bản ghi Nhật_ký_Hoạt_động chứa: userId, tên người dùng, loại hành động ("DELETE"), tên bảng dữ liệu bị ảnh hưởng, ID bản ghi bị ảnh hưởng, dữ liệu cũ (oldData dạng JSON) và thời gian thực hiện.
4. THE Backend SHALL ghi nhận Nhật_ký_Hoạt_động cho tất cả các bảng dữ liệu chính: Product, InventoryTransaction, StorageZone, Classification, Color, Size, Material, ProductCondition, SkuCombo, WarehouseType, User, StocktakingRecord.
5. THE Backend SHALL lưu trữ Nhật_ký_Hoạt_động trong bảng riêng biệt (activity_logs) và ghi nhận không đồng bộ để không ảnh hưởng đến hiệu năng thao tác chính.

---

### Yêu cầu 11: Xem nhật ký hoạt động

**User Story:** Là một Admin, tôi muốn xem nhật ký hoạt động của tất cả người dùng trong tab riêng trên trang Quản trị người dùng, để giám sát và kiểm tra lịch sử thay đổi dữ liệu.

#### Tiêu chí chấp nhận

1. THE Frontend SHALL hiển thị tab "Nhật ký hoạt động" trên trang Quản trị người dùng, chỉ hiển thị cho Người_dùng có vai trò Admin.
2. THE Frontend SHALL hiển thị bảng nhật ký với các cột: Thời gian, Người thực hiện, Hành động (Thêm/Sửa/Xóa), Bảng dữ liệu, Mô tả thay đổi.
3. WHEN Người_dùng click vào một dòng nhật ký, THE Frontend SHALL hiển thị chi tiết thay đổi bao gồm: dữ liệu cũ và dữ liệu mới (hiển thị dạng diff so sánh trước/sau).
4. THE Frontend SHALL hỗ trợ lọc nhật ký theo: người thực hiện, loại hành động (CREATE/UPDATE/DELETE), bảng dữ liệu và khoảng thời gian.
5. THE Frontend SHALL hỗ trợ phân trang cho bảng nhật ký với mặc định 20 bản ghi mỗi trang.
6. THE Backend SHALL cung cấp API trả về danh sách Nhật_ký_Hoạt_động với hỗ trợ lọc và phân trang.
7. THE Backend SHALL chỉ cho phép Người_dùng có vai trò Admin truy cập API nhật ký hoạt động.

---

## MODULE 4: Khai báo Input — Hiển thị đầy đủ 8 cột

### Yêu cầu 12: Hiển thị đầy đủ 8 cột khai báo trên trang Input Declaration

**User Story:** Là một Người_dùng, tôi muốn nhìn thấy đầy đủ 8 cột khai báo (Danh mục, Phân loại, Màu, Size, Chất liệu, Tình trạng, Thùng/Khu vực, Kho tổng) trên trang Khai báo Input dưới dạng bảng tính, để quản lý tất cả trường thông tin đầu vào tại một nơi.

#### Tiêu chí chấp nhận

1. THE Frontend SHALL hiển thị khu vực "Khai báo trường thông tin" trên Trang_Khai_báo_Input với 8 cột dạng bảng tính: Danh mục (Category), Phân loại (Classification), Màu (Color), Size, Chất liệu (Material), Tình trạng (ProductCondition), Thùng/Khu vực (StorageZone), Kho tổng (WarehouseType).
2. THE Frontend SHALL hiển thị mỗi cột dưới dạng danh sách dọc chứa tất cả giá trị đã khai báo của trường tương ứng.
3. WHEN Người_dùng nhấn nút "Thêm" ở cuối một cột, THE Frontend SHALL hiển thị ô nhập liệu cho phép thêm giá trị mới vào danh sách của cột đó.
4. WHEN Người_dùng xác nhận giá trị mới, THE Backend SHALL lưu giá trị vào bảng dữ liệu tương ứng (categories, classifications, colors, sizes, materials, product_conditions, storage_zones, warehouse_types).
5. THE Frontend SHALL cập nhật cột tương ứng ngay lập tức sau khi thêm giá trị mới mà không cần tải lại trang.
6. THE Frontend SHALL hiển thị cột "Sức chứa" (Capacity) bên cạnh cột "Thùng/Khu vực" để hiển thị giá trị maxCapacity của mỗi StorageZone.
7. WHEN Người_dùng thêm giá trị mới cho cột "Thùng/Khu vực", THE Frontend SHALL yêu cầu nhập thêm giá trị "Sức chứa tối đa" kèm theo.
