# Tài liệu Yêu cầu - Nâng cấp Hệ thống Quản lý Kho V2 (System Upgrade V2)

## Giới thiệu

Tài liệu này mô tả các yêu cầu cho đợt nâng cấp lớn (V2) của Hệ thống Quản lý Kho hiện tại. Đợt nâng cấp bao gồm 5 module chính: (1) Sơ đồ Kho — hỗ trợ drag/drop vị trí thùng hàng, cấu trúc kho tùy chỉnh không bắt buộc hình vuông, hiển thị SKU trực tiếp trên ô vị trí, giới hạn sức chứa từng khu vực; (2) Kiểm kê định kỳ — xuất biên bản kiểm kê với thời gian cut-off, ghi nhận/xác nhận kiểm kê chi tiết, lịch sử kiểm kê; (3) Quản lý Tồn kho — thêm cột trạng thái hàng hóa, loại hàng hoá, bộ lọc nâng cao và xuất Excel; (4) Nhập/Xuất Kho — tab nhập kiểm sơ bộ, nâng cấp nhập/xuất chi tiết, phân biệt thời gian tạo phiếu và nhập kho thực tế, báo cáo nhập xuất tồn, import/export Excel; (5) Khai báo Input — bổ sung loại kho và cài đặt ngưỡng Min cho sản phẩm.

**Công nghệ sử dụng:** Giống hệ thống hiện tại — NestJS + Prisma + React + TypeScript + Tailwind CSS + Shadcn UI + React Query + PostgreSQL.

## Bảng thuật ngữ (Glossary)

- **Hệ_thống**: Ứng dụng web Quản lý Kho bao gồm cả Frontend và Backend
- **Backend**: Máy chủ API NestJS xử lý logic nghiệp vụ
- **Frontend**: Giao diện người dùng React chạy trên trình duyệt web
- **Người_dùng**: Bất kỳ ai tương tác với Hệ_thống (Admin, Manager, Staff)
- **Admin**: Vai trò có toàn quyền quản trị Hệ_thống
- **Manager**: Vai trò có quyền duyệt biên bản kiểm kê và xem báo cáo
- **Staff**: Vai trò có quyền thực hiện nhập kho, xuất kho và kiểm kê
- **Sơ_đồ_kho**: Bản đồ trực quan thể hiện bố trí vật lý của kho và vị trí các thùng hàng/khu vực
- **Vị_trí_kho**: Một ô hoặc khu vực cụ thể trên Sơ_đồ_kho nơi hàng hóa được lưu trữ (ví dụ: S1, A1, B2)
- **Ô_trống**: Một ô trong lưới Sơ_đồ_kho không phải là Vị_trí_kho, dùng để tạo hình dạng kho tùy chỉnh (hình L, hình U)
- **SKU_Tổng_hợp**: Mã định danh sản phẩm ghép từ Phân_loại + Màu + Size + Chất_liệu (ví dụ: "Oversize-Đen-XL-Cotton")
- **Sức_chứa_Vị_trí**: Giới hạn tối đa về số lượng hàng hóa mà một Vị_trí_kho cụ thể có thể chứa
- **Tồn_kho_Vị_trí**: Số lượng hàng hóa hiện đang lưu trữ tại một Vị_trí_kho cụ thể
- **Biên_bản_kiểm_kê**: Tài liệu ghi nhận kết quả kiểm kê, bao gồm danh sách SKU, số lượng hệ thống, số lượng thực tế và thời gian cut-off
- **Thời_gian_Cut_off**: Mốc thời gian chính xác (giờ:phút ngày/tháng/năm) tại đó dữ liệu tồn kho được "chốt" để tạo biên bản kiểm kê
- **Nguyên_nhân_Chênh_lệch**: Lý do giải thích cho sự khác biệt giữa số lượng hệ thống và số lượng thực tế trong kiểm kê
- **Trạng_thái_Hàng_hóa**: Trạng thái kinh doanh của sản phẩm: Còn hàng, Hết hàng, Sắp hết hàng, Ngừng kinh doanh
- **Ngưỡng_Min**: Số lượng tồn kho tối thiểu được cài đặt cho mỗi sản phẩm; khi tồn kho dưới ngưỡng này, trạng thái chuyển thành "Sắp hết hàng"
- **Loại_Hàng_hoá**: Tình trạng/phân loại chất lượng hàng hoá: Đạt tiêu chuẩn, Lỗi/Hỏng, Hàng khách kí gửi
- **Phiếu_Nhập_Kiểm_Sơ_Bộ**: Phiếu ghi nhận sơ bộ khi hàng về kho, chỉ đếm số lượng tổng quát chưa kiểm tra chi tiết
- **Loại_Kho**: Phân loại kho lưu trữ (Kho sản xuất, Kho lẻ, ...) được khai báo trong module Khai báo Input
- **Thời_gian_Tạo_Phiếu**: Thời điểm phiếu nhập/xuất kho được tạo trên Hệ_thống
- **Thời_gian_Nhập_Kho_Thực_tế**: Thời điểm hàng hóa thực sự được nhận/nhập vào kho vật lý
- **Template_Excel**: File Excel mẫu có cấu trúc cố định dùng để import dữ liệu nhập kho hàng loạt
- **Color_Coding**: Hệ thống phân loại màu sắc trực quan cho các ô Vị_trí_kho trên Sơ_đồ_kho
- **React_Query_Cache**: Bộ nhớ đệm phía client do React Query quản lý

## Yêu cầu


---

## MODULE 1: Sơ đồ Kho (Warehouse Visualizer) — NÂNG CẤP LỚN

### Yêu cầu 1: Drag/Drop kéo thả vị trí thùng hàng

**User Story:** Là một Người_dùng, tôi muốn kéo thả để di chuyển vị trí thùng hàng/khu vực trên Sơ_đồ_kho, để cập nhật bố trí kho khi hàng hóa được dịch chuyển vật lý.

#### Tiêu chí chấp nhận

1. WHEN Người_dùng kéo một Vị_trí_kho đến vị trí mới trên lưới Sơ_đồ_kho, THE Frontend SHALL cập nhật vị trí hiển thị của Vị_trí_kho đó theo tọa độ mới trên lưới.
2. WHEN Người_dùng thả Vị_trí_kho vào tọa độ mới, THE Backend SHALL lưu tọa độ (row, column) mới của Vị_trí_kho đó vào cơ sở dữ liệu.
3. IF Người_dùng thả Vị_trí_kho vào tọa độ đã có Vị_trí_kho khác, THEN THE Frontend SHALL hoán đổi (swap) vị trí của hai Vị_trí_kho đó và Backend SHALL lưu cả hai tọa độ mới.
4. WHEN Người_dùng nhấn đúp (double-click) vào nhãn của một Vị_trí_kho, THE Frontend SHALL hiển thị ô nhập liệu cho phép đổi tên nhãn (ví dụ: S1 thành S2).
5. WHEN Người_dùng xác nhận tên nhãn mới cho Vị_trí_kho, THE Backend SHALL cập nhật nhãn của Vị_trí_kho đó trong cơ sở dữ liệu.
6. IF tên nhãn mới trùng với nhãn của Vị_trí_kho khác trong cùng Sơ_đồ_kho, THEN THE Backend SHALL từ chối thao tác và trả về thông báo "Nhãn vị trí đã tồn tại trong sơ đồ kho".
7. THE Backend SHALL chỉ cho phép Người_dùng có vai trò Admin thực hiện thao tác kéo thả và đổi tên Vị_trí_kho.

---

### Yêu cầu 2: Cấu trúc kho tùy chỉnh (không bắt buộc hình vuông)

**User Story:** Là một Admin, tôi muốn cấu hình Sơ_đồ_kho với hình dạng tùy chỉnh (hình L, hình U, hoặc bất kỳ), để phản ánh đúng bố trí thực tế của kho.

#### Tiêu chí chấp nhận

1. THE Frontend SHALL hiển thị Sơ_đồ_kho dưới dạng lưới (grid) cho phép mỗi ô có trạng thái "Vị_trí_kho hoạt động" hoặc "Ô_trống".
2. WHEN Admin nhấn vào một ô trên lưới, THE Frontend SHALL cho phép chuyển đổi trạng thái ô giữa "Vị_trí_kho hoạt động" và "Ô_trống".
3. WHEN Admin lưu cấu hình Sơ_đồ_kho, THE Backend SHALL lưu trạng thái hoạt động/trống của từng ô trong lưới.
4. THE Frontend SHALL hiển thị Ô_trống với giao diện khác biệt rõ ràng so với Vị_trí_kho hoạt động (ví dụ: màu xám nhạt, không có viền).
5. THE Frontend SHALL cho phép lưới Sơ_đồ_kho có các hàng với số lượng ô hoạt động khác nhau, tạo thành hình dạng tùy chỉnh.
6. IF Admin chuyển một Vị_trí_kho đang chứa hàng hóa thành Ô_trống, THEN THE Frontend SHALL hiển thị cảnh báo "Vị trí này đang chứa hàng hóa, vui lòng di chuyển hàng trước khi vô hiệu hóa".

---

### Yêu cầu 3: Hiển thị SKU trực tiếp trên ô vị trí

**User Story:** Là một Người_dùng, tôi muốn nhìn thấy trực tiếp các SKU bên trong mỗi ô Vị_trí_kho trên Sơ_đồ_kho, để nhanh chóng xác định thùng hàng chứa sản phẩm cần tìm.

#### Tiêu chí chấp nhận

1. THE Frontend SHALL hiển thị danh sách SKU_Tổng_hợp (Phân loại + Màu + Size + Chất liệu) trực tiếp trên mỗi ô Vị_trí_kho của Sơ_đồ_kho.
2. THE Frontend SHALL áp dụng Color_Coding cho mỗi ô Vị_trí_kho dựa trên trạng thái: màu xanh lá cho ô có hàng, màu xám cho ô trống, màu đỏ cho ô đã đầy sức chứa, màu vàng cho ô gần đầy (trên 80% sức chứa).
3. WHEN Người_dùng nhấn vào một ô Vị_trí_kho, THE Frontend SHALL hiển thị popup chi tiết chứa danh sách từng SKU_Tổng_hợp kèm số lượng cụ thể tại vị trí đó.
4. THE Frontend SHALL giới hạn hiển thị tối đa 3 SKU_Tổng_hợp trên mỗi ô Vị_trí_kho; nếu có nhiều hơn 3 SKU, Frontend SHALL hiển thị số lượng SKU còn lại dưới dạng "+N".
5. THE Backend SHALL cung cấp API trả về danh sách SKU_Tổng_hợp kèm số lượng cho mỗi Vị_trí_kho trong Sơ_đồ_kho.

---

### Yêu cầu 4: Giới hạn sức chứa mỗi khu vực/thùng

**User Story:** Là một Admin, tôi muốn thiết lập giới hạn sức chứa tối đa cho mỗi Vị_trí_kho, để hệ thống cảnh báo khi nhập kho vượt quá sức chứa của vị trí cụ thể.

#### Tiêu chí chấp nhận

1. WHEN Admin tạo hoặc chỉnh sửa Vị_trí_kho, THE Frontend SHALL hiển thị trường nhập Sức_chứa_Vị_trí cho vị trí đó.
2. WHEN Admin thiết lập Sức_chứa_Vị_trí cho một Vị_trí_kho, THE Backend SHALL lưu giá trị Sức_chứa_Vị_trí vào cơ sở dữ liệu.
3. THE Backend SHALL yêu cầu Sức_chứa_Vị_trí là số nguyên dương lớn hơn 0.
4. WHEN Người_dùng nhập kho vào Vị_trí_kho có Tồn_kho_Vị_trí đã bằng Sức_chứa_Vị_trí, THE Backend SHALL từ chối thao tác và trả về thông báo "Vị trí này đã đầy, không thể nhập thêm hàng".
5. IF số lượng nhập kho cộng với Tồn_kho_Vị_trí hiện tại vượt quá Sức_chứa_Vị_trí, THEN THE Backend SHALL từ chối thao tác và trả về thông báo "Chỉ cho phép nhập tối đa X" trong đó X bằng Sức_chứa_Vị_trí trừ Tồn_kho_Vị_trí.
6. THE Frontend SHALL hiển thị thông tin Sức_chứa_Vị_trí, Tồn_kho_Vị_trí và số lượng còn nhập được trên mỗi ô Vị_trí_kho của Sơ_đồ_kho.


---

## MODULE 2: Kiểm kê định kỳ (Stocktaking) — NÂNG CẤP LỚN

### Yêu cầu 5: Xuất biên bản kiểm kê

**User Story:** Là một Staff, tôi muốn xuất biên bản kiểm kê theo hai chế độ (toàn bộ hoặc theo danh sách chọn), để linh hoạt kiểm kê theo nhu cầu thực tế.

#### Tiêu chí chấp nhận

1. WHEN Người_dùng nhấn nút "Kiểm tra toàn bộ", THE Backend SHALL tạo Biên_bản_kiểm_kê chứa toàn bộ sản phẩm trong Hệ_thống kèm số lượng tồn kho tại Thời_gian_Cut_off.
2. WHEN Người_dùng nhấn nút "Kiểm kê theo danh sách", THE Frontend SHALL hiển thị danh sách SKU_Tổng_hợp để Người_dùng chọn các sản phẩm cần kiểm kê.
3. WHEN Người_dùng xác nhận danh sách SKU đã chọn, THE Backend SHALL tạo Biên_bản_kiểm_kê chỉ chứa các sản phẩm đã chọn kèm số lượng tồn kho tại Thời_gian_Cut_off.
4. THE Backend SHALL ghi nhận Thời_gian_Cut_off chính xác đến phút (giờ:phút ngày/tháng/năm) vào mỗi Biên_bản_kiểm_kê.
5. THE Frontend SHALL hiển thị Thời_gian_Cut_off rõ ràng trên Biên_bản_kiểm_kê.
6. WHEN Người_dùng nhấn nút "In biên bản", THE Frontend SHALL mở hộp thoại chọn máy in của trình duyệt và cho phép in Biên_bản_kiểm_kê.

---

### Yêu cầu 6: Ghi nhận và xác nhận kiểm kê

**User Story:** Là một Staff, tôi muốn nhập số liệu thực tế vào biên bản kiểm kê và ghi nhận nguyên nhân chênh lệch, để hoàn thành quy trình kiểm kê đầy đủ.

#### Tiêu chí chấp nhận

1. WHEN Biên_bản_kiểm_kê được tạo, THE Backend SHALL ghi nhận bản ghi (record) với trạng thái "Đang kiểm kê" và thời gian tạo.
2. WHEN Người_dùng mở Biên_bản_kiểm_kê có trạng thái "Đang kiểm kê", THE Frontend SHALL hiển thị nút "Xác nhận kiểm kê" và cho phép nhập số lượng thực tế cho từng dòng sản phẩm.
3. THE Frontend SHALL hiển thị ô nhập "Nguyên_nhân_Chênh_lệch" cho mỗi dòng sản phẩm có chênh lệch giữa số lượng hệ thống và số lượng thực tế.
4. THE Frontend SHALL hiển thị nút upload file đính kèm (hình chụp biên bản kiểm kê giấy) cho mỗi Biên_bản_kiểm_kê.
5. IF Biên_bản_kiểm_kê có dòng chênh lệch mà chưa điền Nguyên_nhân_Chênh_lệch, THEN THE Backend SHALL từ chối submit và trả về thông báo "Vui lòng điền nguyên nhân chênh lệch cho tất cả các dòng có sai lệch".
6. WHEN Người_dùng nhấn Submit sau khi điền đầy đủ thông tin, THE Backend SHALL cập nhật trạng thái Biên_bản_kiểm_kê thành "Chờ duyệt" và ghi nhận thời gian submit.

---

### Yêu cầu 7: Lịch sử kiểm kê

**User Story:** Là một Manager, tôi muốn xem toàn bộ lịch sử kiểm kê, để theo dõi và đánh giá quy trình kiểm kê theo thời gian.

#### Tiêu chí chấp nhận

1. THE Frontend SHALL hiển thị danh sách lịch sử tất cả Biên_bản_kiểm_kê đã tạo, bao gồm: thời gian tạo, Thời_gian_Cut_off, người tạo, trạng thái và thời gian submit (nếu có).
2. WHEN Người_dùng nhấn vào một Biên_bản_kiểm_kê trong danh sách lịch sử, THE Frontend SHALL hiển thị chi tiết biên bản bao gồm: danh sách sản phẩm, số lượng hệ thống, số lượng thực tế, chênh lệch, Nguyên_nhân_Chênh_lệch và file hình ảnh đính kèm.
3. THE Backend SHALL ghi nhận và lưu trữ toàn bộ lịch sử thay đổi trạng thái của mỗi Biên_bản_kiểm_kê (tạo, submit, duyệt/từ chối) kèm thời gian.
4. THE Frontend SHALL hỗ trợ lọc danh sách lịch sử kiểm kê theo trạng thái và khoảng thời gian.


---

## MODULE 3: Quản lý Tồn kho — NÂNG CẤP

### Yêu cầu 8: Cột trạng thái hàng hóa

**User Story:** Là một Người_dùng, tôi muốn xem trạng thái kinh doanh của từng sản phẩm (Còn hàng, Hết hàng, Sắp hết hàng, Ngừng kinh doanh), để nhanh chóng nắm bắt tình hình tồn kho.

#### Tiêu chí chấp nhận

1. THE Frontend SHALL hiển thị cột "Trạng thái" trong bảng quản lý tồn kho với bốn giá trị: "Còn hàng", "Hết hàng", "Sắp hết hàng", "Ngừng kinh doanh".
2. THE Backend SHALL tự động xác định Trạng_thái_Hàng_hóa là "Hết hàng" khi số lượng tồn kho của sản phẩm bằng 0.
3. THE Backend SHALL tự động xác định Trạng_thái_Hàng_hóa là "Sắp hết hàng" khi số lượng tồn kho của sản phẩm lớn hơn 0 và nhỏ hơn Ngưỡng_Min đã cài đặt cho sản phẩm đó.
4. THE Backend SHALL tự động xác định Trạng_thái_Hàng_hóa là "Còn hàng" khi số lượng tồn kho của sản phẩm lớn hơn hoặc bằng Ngưỡng_Min và sản phẩm chưa bị đánh dấu "Ngừng kinh doanh".
5. WHEN Người_dùng cập nhật trạng thái sản phẩm thành "Ngừng kinh doanh", THE Backend SHALL lưu trạng thái thủ công này và giữ nguyên cho đến khi Người_dùng thay đổi lại.
6. THE Frontend SHALL áp dụng Color_Coding cho cột trạng thái: xanh lá cho "Còn hàng", đỏ cho "Hết hàng", vàng cho "Sắp hết hàng", xám cho "Ngừng kinh doanh".

---

### Yêu cầu 9: Cột Loại hàng hoá (Tình trạng)

**User Story:** Là một Người_dùng, tôi muốn xem tình trạng chất lượng của từng sản phẩm trong bảng tồn kho, để phân biệt hàng đạt chuẩn, hàng lỗi và hàng ký gửi.

#### Tiêu chí chấp nhận

1. THE Frontend SHALL hiển thị cột "Loại hàng hoá" trong bảng quản lý tồn kho với các giá trị từ danh sách Tình_trạng_Hàng_hoá đã khai báo (Đạt tiêu chuẩn, Lỗi/Hỏng, Hàng khách kí gửi).
2. THE Backend SHALL liên kết mỗi bản ghi tồn kho với Tình_trạng_Hàng_hoá tương ứng từ giao dịch nhập kho gần nhất.
3. THE Frontend SHALL cho phép lọc bảng tồn kho theo cột "Loại hàng hoá".

---

### Yêu cầu 10: Bộ lọc nâng cao và xuất Excel cho tồn kho

**User Story:** Là một Manager, tôi muốn lọc bảng tồn kho theo nhiều trường thông tin và xuất kết quả ra file Excel, để phục vụ báo cáo và phân tích.

#### Tiêu chí chấp nhận

1. THE Frontend SHALL cung cấp bộ lọc cho bảng tồn kho theo các trường: danh mục, Trạng_thái_Hàng_hóa, Loại_Hàng_hoá, Vị_trí_kho, khoảng thời gian và từ khóa tìm kiếm SKU_Tổng_hợp.
2. WHEN Người_dùng áp dụng bộ lọc, THE Backend SHALL trả về danh sách tồn kho phù hợp với tất cả điều kiện lọc đã chọn.
3. WHEN Người_dùng nhấn nút "Xuất Excel" sau khi áp dụng bộ lọc, THE Backend SHALL tạo file Excel (.xlsx) chứa dữ liệu tồn kho đã lọc.
4. THE Backend SHALL bao gồm các cột trong file Excel: Tên sản phẩm, SKU_Tổng_hợp, Danh mục, Số lượng tồn, Trạng_thái_Hàng_hóa, Loại_Hàng_hoá, Vị_trí_kho và Thời gian cập nhật cuối.
5. IF không có dữ liệu phù hợp với bộ lọc, THEN THE Backend SHALL trả về thông báo "Không có dữ liệu để xuất báo cáo".


---

## MODULE 4: Nhập/Xuất Kho — NÂNG CẤP LỚN

### Yêu cầu 11: Tab "Nhập kiểm sơ bộ" (MỚI)

**User Story:** Là một Staff, tôi muốn ghi nhận nhanh thông tin sơ bộ khi hàng về kho (chỉ đếm số lượng, chưa kiểm tra chi tiết), để không làm chậm quy trình tiếp nhận hàng.

#### Tiêu chí chấp nhận

1. THE Frontend SHALL hiển thị tab "Nhập kiểm sơ bộ" trong trang Nhập/Xuất kho.
2. WHEN Người_dùng tạo Phiếu_Nhập_Kiểm_Sơ_Bộ, THE Frontend SHALL yêu cầu nhập 5 trường: Phân loại hàng hoá, Số lượng nhận, Loại_Kho, Upload hình ảnh và Ghi chú.
3. THE Backend SHALL lưu Phiếu_Nhập_Kiểm_Sơ_Bộ với trạng thái "Chờ kiểm tra chi tiết" và ghi nhận thời gian tạo.
4. THE Backend SHALL yêu cầu trường "Phân loại hàng hoá" và "Số lượng nhận" là bắt buộc; "Số lượng nhận" phải là số nguyên dương lớn hơn 0.
5. THE Frontend SHALL hiển thị dropdown "Loại_Kho" với các giá trị đã khai báo trong module Khai báo Input.
6. THE Backend SHALL phân quyền riêng cho tab "Nhập kiểm sơ bộ": chỉ Người_dùng có quyền được cấu hình mới truy cập được.
7. IF Người_dùng không có quyền truy cập tab "Nhập kiểm sơ bộ", THEN THE Frontend SHALL ẩn tab đó khỏi giao diện.

---

### Yêu cầu 12: Tab Nhập/Xuất chi tiết (nâng cấp)

**User Story:** Là một Staff (Thủ kho), tôi muốn kiểm tra chi tiết từng dòng hàng từ phiếu kiểm sơ bộ và khai báo thông tin cụ thể (SKU, tình trạng, vị trí), để ghi nhận chính xác hàng nhập kho.

#### Tiêu chí chấp nhận

1. THE Frontend SHALL hiển thị danh sách các Phiếu_Nhập_Kiểm_Sơ_Bộ có trạng thái "Chờ kiểm tra chi tiết" trong tab Nhập/Xuất chi tiết.
2. WHEN Thủ kho chọn một dòng Phiếu_Nhập_Kiểm_Sơ_Bộ, THE Frontend SHALL hiển thị form kiểm tra chi tiết với các trường: Phân loại, Màu, Size, Chất liệu, Số lượng thực tế, Tình trạng hàng, Vị trí hàng và Ghi chú.
3. THE Backend SHALL tự động sinh SKU_Tổng_hợp từ tổ hợp Phân loại + Màu + Size + Chất liệu khi Thủ kho hoàn thành kiểm tra chi tiết.
4. IF số lượng thực tế kiểm tra chi tiết khác với số lượng trong Phiếu_Nhập_Kiểm_Sơ_Bộ, THEN THE Frontend SHALL hiển thị cảnh báo "Số lượng kiểm tra chi tiết khác với kiểm sơ bộ, vui lòng kiểm tra lại" và yêu cầu Thủ kho xác nhận.
5. WHEN Thủ kho xác nhận kiểm tra chi tiết, THE Backend SHALL cập nhật trạng thái dòng Phiếu_Nhập_Kiểm_Sơ_Bộ thành "Đã kiểm tra chi tiết" và ghi nhận giao dịch nhập kho.
6. THE Frontend SHALL hiển thị trường "Tình trạng hàng" dưới dạng dropdown với các giá trị từ danh sách Tình_trạng_Hàng_hoá đã khai báo.
7. THE Frontend SHALL hiển thị trường "Vị trí hàng" dưới dạng dropdown với các Vị_trí_kho từ Sơ_đồ_kho.

---

### Yêu cầu 13: Thời gian tạo phiếu và thời gian nhập kho thực tế

**User Story:** Là một Manager, tôi muốn phân biệt thời gian tạo phiếu nhập kho trên hệ thống và thời gian hàng thực sự về kho, để theo dõi chính xác tiến độ nhập hàng.

#### Tiêu chí chấp nhận

1. THE Frontend SHALL hiển thị hai cột thời gian trong bảng nhập/xuất kho: "Thời gian tạo phiếu" và "Thời gian nhập kho thực tế".
2. WHEN Người_dùng tạo phiếu nhập kho, THE Backend SHALL tự động ghi nhận Thời_gian_Tạo_Phiếu là thời điểm hiện tại.
3. THE Frontend SHALL cho phép Người_dùng nhập Thời_gian_Nhập_Kho_Thực_tế dưới dạng bộ chọn ngày giờ (date-time picker).
4. IF Người_dùng không nhập Thời_gian_Nhập_Kho_Thực_tế, THEN THE Backend SHALL sử dụng Thời_gian_Tạo_Phiếu làm giá trị mặc định.
5. THE Backend SHALL lưu cả hai trường thời gian vào cơ sở dữ liệu cho mỗi giao dịch nhập kho.

---

### Yêu cầu 14: Tab "Báo cáo Nhập Xuất Tồn kho" (MỚI)

**User Story:** Là một Manager, tôi muốn xem và xuất báo cáo tổng hợp nhập-xuất-tồn theo khoảng thời gian, để phục vụ công tác quản lý và báo cáo.

#### Tiêu chí chấp nhận

1. THE Frontend SHALL hiển thị tab "Báo cáo Nhập Xuất Tồn" trong trang Nhập/Xuất kho.
2. THE Frontend SHALL cung cấp bộ chọn khoảng thời gian (từ ngày - đến ngày) cho báo cáo.
3. WHEN Người_dùng chọn khoảng thời gian và nhấn "Xem báo cáo", THE Backend SHALL trả về dữ liệu tổng hợp nhập-xuất-tồn theo SKU_Tổng_hợp trong khoảng thời gian đã chọn.
4. THE Backend SHALL tính toán cho mỗi SKU_Tổng_hợp: tồn đầu kỳ, tổng nhập trong kỳ, tổng xuất trong kỳ và tồn cuối kỳ.
5. WHEN Người_dùng nhấn nút "Xuất Excel", THE Backend SHALL tạo file Excel (.xlsx) chứa dữ liệu báo cáo nhập-xuất-tồn đã hiển thị.
6. THE Backend SHALL bao gồm các cột trong file Excel báo cáo: SKU_Tổng_hợp, Phân loại, Màu, Size, Chất liệu, Tồn đầu kỳ, Nhập trong kỳ, Xuất trong kỳ, Tồn cuối kỳ.
7. IF không có dữ liệu trong khoảng thời gian đã chọn, THEN THE Backend SHALL trả về thông báo "Không có dữ liệu trong khoảng thời gian đã chọn".

---

### Yêu cầu 15: Import/Export Excel cho nhập kho

**User Story:** Là một Staff, tôi muốn nhập kho hàng loạt bằng file Excel và xuất dữ liệu nhập kho ra Excel, để tiết kiệm thời gian khi xử lý số lượng lớn.

#### Tiêu chí chấp nhận

1. WHEN Người_dùng nhấn nút "Tải mẫu", THE Backend SHALL trả về file Template_Excel với cấu trúc cố định bao gồm các cột: Phân loại, Màu, Size, Chất liệu, Số lượng, Tình trạng hàng, Vị trí kho, Loại_Kho và Ghi chú.
2. WHEN Người_dùng upload file Excel đã điền dữ liệu, THE Backend SHALL đọc và xác thực từng dòng dữ liệu trong file.
3. IF file Excel chứa dòng dữ liệu không hợp lệ (thiếu trường bắt buộc, giá trị không tồn tại trong danh sách khai báo, số lượng không hợp lệ), THEN THE Backend SHALL trả về danh sách lỗi chi tiết cho từng dòng kèm số dòng và mô tả lỗi.
4. WHEN tất cả dòng dữ liệu hợp lệ, THE Backend SHALL tạo các giao dịch nhập kho tương ứng và cập nhật tồn kho.
5. WHEN Người_dùng nhấn nút "Xuất Excel", THE Backend SHALL tạo file Excel (.xlsx) chứa dữ liệu nhập kho (tổng quan hoặc chi tiết tùy theo chế độ xem hiện tại).
6. THE Backend SHALL xử lý import Excel trong một transaction duy nhất: nếu bất kỳ dòng nào thất bại, toàn bộ import bị rollback.


---

## MODULE 5: Khai báo Input — BỔ SUNG

### Yêu cầu 16: Thêm "Loại kho" vào khai báo

**User Story:** Là một Người_dùng, tôi muốn khai báo và quản lý danh sách các loại kho (Kho sản xuất, Kho lẻ, ...), để có thể phân loại kho khi nhập kiểm sơ bộ.

#### Tiêu chí chấp nhận

1. WHEN Người_dùng truy cập Trang Khai báo Input, THE Frontend SHALL hiển thị khu vực quản lý "Loại kho" dưới dạng bảng.
2. WHEN Người_dùng nhập tên Loại_Kho mới và xác nhận, THE Backend SHALL lưu Loại_Kho mới vào cơ sở dữ liệu.
3. THE Backend SHALL yêu cầu tên Loại_Kho là bắt buộc và không được để trống hoặc chỉ chứa khoảng trắng.
4. WHEN Người_dùng nhập tên Loại_Kho trùng với giá trị đã tồn tại (so sánh không phân biệt hoa thường), THE Backend SHALL từ chối tạo mới và trả về thông báo "Loại kho này đã tồn tại".
5. WHEN Loại_Kho mới được tạo thành công, THE Frontend SHALL cập nhật danh sách hiển thị ngay lập tức mà không cần tải lại trang.

---

### Yêu cầu 17: Cài đặt ngưỡng Min cho sản phẩm

**User Story:** Là một Người_dùng, tôi muốn thiết lập ngưỡng tồn kho tối thiểu (Min) cho từng sản phẩm, để hệ thống tự động xác định trạng thái "Sắp hết hàng".

#### Tiêu chí chấp nhận

1. WHEN Người_dùng truy cập Trang Khai báo Input, THE Frontend SHALL hiển thị khu vực "Cài đặt ngưỡng Min" với bảng danh sách sản phẩm kèm giá trị Ngưỡng_Min hiện tại.
2. WHEN Người_dùng nhập giá trị Ngưỡng_Min cho một sản phẩm và xác nhận, THE Backend SHALL lưu giá trị Ngưỡng_Min vào cơ sở dữ liệu.
3. THE Backend SHALL yêu cầu Ngưỡng_Min là số nguyên không âm (lớn hơn hoặc bằng 0).
4. IF Ngưỡng_Min là số âm, THEN THE Backend SHALL từ chối thao tác và trả về thông báo "Ngưỡng Min phải là số không âm".
5. WHEN Ngưỡng_Min được cập nhật, THE Backend SHALL tự động tính toán lại Trạng_thái_Hàng_hóa cho sản phẩm đó dựa trên tồn kho hiện tại và Ngưỡng_Min mới.
6. THE Frontend SHALL hiển thị giá trị Ngưỡng_Min mặc định là 0 cho sản phẩm chưa được cài đặt.