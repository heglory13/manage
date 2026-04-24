# Tài liệu Yêu cầu - Module Khai báo Input (Input Declaration Module)

## Giới thiệu

Module Khai báo Input là một phần mở rộng của Hệ thống Quản lý Kho hiện tại, cung cấp trang quản lý khai báo các trường thông tin đầu vào cho quy trình nhập/xuất kho. Module bao gồm ba khu vực khai báo chính: (1) Khai báo thuộc tính sản phẩm (Phân loại, Màu, Size, Chất liệu) với tự động sinh SKU, (2) Khai báo tình trạng hàng hoá, và (3) Khai báo khu vực/thùng chứa hàng hoá với kiểm soát sức chứa tối đa. Tất cả các giá trị khai báo sẽ trở thành tùy chọn trong form nhập/xuất kho.

**Công nghệ sử dụng:** Giống hệ thống hiện tại — NestJS + Prisma + React + TypeScript + Tailwind CSS + Shadcn UI + React Query + PostgreSQL.

## Bảng thuật ngữ (Glossary)

- **Hệ_thống**: Ứng dụng web Quản lý Kho bao gồm cả Frontend và Backend
- **Backend**: Máy chủ API NestJS xử lý logic nghiệp vụ
- **Frontend**: Giao diện người dùng React chạy trên trình duyệt web
- **Người_dùng**: Bất kỳ ai tương tác với Hệ_thống (Admin, Manager, Staff)
- **Trang_Khai_báo_Input**: Trang giao diện chứa ba khu vực khai báo: Thuộc tính sản phẩm, Tình trạng hàng hoá, và Khu vực hàng hoá
- **Thuộc_tính_Sản_phẩm**: Tập hợp bốn trường thông tin mô tả sản phẩm: Phân_loại, Màu, Size, Chất_liệu
- **Phân_loại**: Trường phân loại/kiểu sản phẩm (ví dụ: Oversize, Slim Fit, Regular)
- **Màu**: Trường màu sắc sản phẩm (ví dụ: Đen, Trắng, Xanh)
- **Size**: Trường kích cỡ sản phẩm (ví dụ: S, M, L, XL)
- **Chất_liệu**: Trường chất liệu sản phẩm (ví dụ: Cotton, Polyester, Linen)
- **SKU_Tổng_hợp**: Mã định danh sản phẩm được tự động sinh bằng cách ghép nối Phân_loại + Màu + Size + Chất_liệu (ví dụ: "Oversize-Đen-XL-Cotton")
- **Tình_trạng_Hàng_hoá**: Trạng thái chất lượng/phân loại của hàng hoá (ví dụ: "Đạt tiêu chuẩn", "Lỗi/Hỏng", "Hàng khách kí gửi")
- **Khu_vực_Hàng_hoá**: Vùng lưu trữ hoặc thùng chứa hàng trong kho (ví dụ: OV1, OV2, BO1)
- **Sức_chứa_Tối_đa**: Giới hạn số lượng hàng hoá tối đa mà một Khu_vực_Hàng_hoá có thể chứa
- **Tồn_kho_Thực_tế**: Số lượng hàng hoá hiện đang lưu trữ trong một Khu_vực_Hàng_hoá cụ thể
- **Số_lượng_Còn_nhập_được**: Hiệu số giữa Sức_chứa_Tối_đa và Tồn_kho_Thực_tế của một Khu_vực_Hàng_hoá
- **So_sánh_Không_phân_biệt_Hoa_thường**: Phương thức so sánh chuỗi bỏ qua sự khác biệt giữa chữ hoa và chữ thường (ví dụ: "oversize" và "Oversize" được coi là giống nhau)
- **Form_Nhập_Xuất_Kho**: Giao diện form nhập kho hoặc xuất kho hiện có trong Hệ_thống

## Yêu cầu

### Yêu cầu 1: Quản lý danh sách Phân loại sản phẩm (Classification)

**User Story:** Là một Người_dùng, tôi muốn khai báo và quản lý danh sách các loại phân loại sản phẩm, để có thể chọn phân loại khi tạo sản phẩm và thực hiện nhập/xuất kho.

#### Tiêu chí chấp nhận

1. WHEN Người_dùng truy cập Trang_Khai_báo_Input, THE Frontend SHALL hiển thị danh sách tất cả Phân_loại đã khai báo dưới dạng bảng.
2. WHEN Người_dùng nhập tên Phân_loại mới và xác nhận, THE Backend SHALL lưu Phân_loại mới vào cơ sở dữ liệu.
3. THE Backend SHALL yêu cầu tên Phân_loại là bắt buộc và không được để trống hoặc chỉ chứa khoảng trắng.
4. WHEN Người_dùng nhập tên Phân_loại trùng với Phân_loại đã tồn tại (So_sánh_Không_phân_biệt_Hoa_thường), THE Backend SHALL từ chối tạo mới và trả về thông báo "Phân loại này đã tồn tại".
5. WHEN Phân_loại mới được tạo thành công, THE Frontend SHALL cập nhật danh sách hiển thị ngay lập tức mà không cần tải lại trang.

---

### Yêu cầu 2: Quản lý danh sách Màu sắc (Color)

**User Story:** Là một Người_dùng, tôi muốn khai báo và quản lý danh sách các màu sắc sản phẩm, để có thể chọn màu khi tạo sản phẩm và thực hiện nhập/xuất kho.

#### Tiêu chí chấp nhận

1. WHEN Người_dùng truy cập Trang_Khai_báo_Input, THE Frontend SHALL hiển thị danh sách tất cả Màu đã khai báo dưới dạng bảng.
2. WHEN Người_dùng nhập tên Màu mới và xác nhận, THE Backend SHALL lưu Màu mới vào cơ sở dữ liệu.
3. THE Backend SHALL yêu cầu tên Màu là bắt buộc và không được để trống hoặc chỉ chứa khoảng trắng.
4. WHEN Người_dùng nhập tên Màu trùng với Màu đã tồn tại (So_sánh_Không_phân_biệt_Hoa_thường), THE Backend SHALL từ chối tạo mới và trả về thông báo "Màu sắc này đã tồn tại".
5. WHEN Màu mới được tạo thành công, THE Frontend SHALL cập nhật danh sách hiển thị ngay lập tức mà không cần tải lại trang.

---

### Yêu cầu 3: Quản lý danh sách Size (Size)

**User Story:** Là một Người_dùng, tôi muốn khai báo và quản lý danh sách các kích cỡ sản phẩm, để có thể chọn size khi tạo sản phẩm và thực hiện nhập/xuất kho.

#### Tiêu chí chấp nhận

1. WHEN Người_dùng truy cập Trang_Khai_báo_Input, THE Frontend SHALL hiển thị danh sách tất cả Size đã khai báo dưới dạng bảng.
2. WHEN Người_dùng nhập tên Size mới và xác nhận, THE Backend SHALL lưu Size mới vào cơ sở dữ liệu.
3. THE Backend SHALL yêu cầu tên Size là bắt buộc và không được để trống hoặc chỉ chứa khoảng trắng.
4. WHEN Người_dùng nhập tên Size trùng với Size đã tồn tại (So_sánh_Không_phân_biệt_Hoa_thường), THE Backend SHALL từ chối tạo mới và trả về thông báo "Size này đã tồn tại".
5. WHEN Size mới được tạo thành công, THE Frontend SHALL cập nhật danh sách hiển thị ngay lập tức mà không cần tải lại trang.

---

### Yêu cầu 4: Quản lý danh sách Chất liệu (Material)

**User Story:** Là một Người_dùng, tôi muốn khai báo và quản lý danh sách các chất liệu sản phẩm, để có thể chọn chất liệu khi tạo sản phẩm và thực hiện nhập/xuất kho.

#### Tiêu chí chấp nhận

1. WHEN Người_dùng truy cập Trang_Khai_báo_Input, THE Frontend SHALL hiển thị danh sách tất cả Chất_liệu đã khai báo dưới dạng bảng.
2. WHEN Người_dùng nhập tên Chất_liệu mới và xác nhận, THE Backend SHALL lưu Chất_liệu mới vào cơ sở dữ liệu.
3. THE Backend SHALL yêu cầu tên Chất_liệu là bắt buộc và không được để trống hoặc chỉ chứa khoảng trắng.
4. WHEN Người_dùng nhập tên Chất_liệu trùng với Chất_liệu đã tồn tại (So_sánh_Không_phân_biệt_Hoa_thường), THE Backend SHALL từ chối tạo mới và trả về thông báo "Chất liệu này đã tồn tại".
5. WHEN Chất_liệu mới được tạo thành công, THE Frontend SHALL cập nhật danh sách hiển thị ngay lập tức mà không cần tải lại trang.

---

### Yêu cầu 5: Tự động sinh SKU tổng hợp từ thuộc tính sản phẩm

**User Story:** Là một Người_dùng, tôi muốn hệ thống tự động tạo SKU tổng hợp bằng cách ghép nối các thuộc tính sản phẩm, để dễ dàng nhận diện và chọn sản phẩm khi nhập/xuất kho.

#### Tiêu chí chấp nhận

1. WHEN Người_dùng chọn đầy đủ bốn thuộc tính (Phân_loại, Màu, Size, Chất_liệu), THE Backend SHALL tự động sinh SKU_Tổng_hợp bằng cách ghép nối bốn giá trị theo định dạng "Phân_loại-Màu-Size-Chất_liệu" (ví dụ: "Oversize-Đen-XL-Cotton").
2. THE Frontend SHALL hiển thị bảng tổng hợp tất cả các tổ hợp SKU_Tổng_hợp đã được tạo, bao gồm cột Phân_loại, Màu, Size, Chất_liệu và SKU_Tổng_hợp.
3. THE Backend SHALL đảm bảo mỗi SKU_Tổng_hợp là duy nhất trong toàn bộ Hệ_thống.
4. IF tổ hợp thuộc tính tạo ra SKU_Tổng_hợp trùng với SKU_Tổng_hợp đã tồn tại, THEN THE Backend SHALL từ chối tạo mới và trả về thông báo "Tổ hợp SKU này đã tồn tại".
5. WHEN thuộc tính mới (Phân_loại, Màu, Size hoặc Chất_liệu) được thêm vào hệ thống, THE Frontend SHALL hiển thị thuộc tính mới trong danh sách tùy chọn để tạo tổ hợp SKU_Tổng_hợp.

---

### Yêu cầu 6: Hiển thị bảng tổng hợp SKU dạng bảng tính

**User Story:** Là một Người_dùng, tôi muốn xem tất cả các tổ hợp SKU đã khai báo dưới dạng bảng giống Excel, để dễ dàng tra cứu và quản lý sản phẩm.

#### Tiêu chí chấp nhận

1. WHEN Người_dùng truy cập Trang_Khai_báo_Input, THE Frontend SHALL hiển thị bảng tổng hợp SKU_Tổng_hợp với các cột: STT, Phân_loại, Màu, Size, Chất_liệu, SKU_Tổng_hợp.
2. THE Frontend SHALL hỗ trợ phân trang cho bảng tổng hợp SKU_Tổng_hợp khi số lượng bản ghi vượt quá giới hạn hiển thị trên một trang.
3. WHEN Người_dùng tìm kiếm trong bảng tổng hợp, THE Frontend SHALL lọc và hiển thị các tổ hợp SKU_Tổng_hợp phù hợp với từ khóa tìm kiếm.
4. WHEN tổ hợp SKU_Tổng_hợp mới được tạo, THE Frontend SHALL thêm bản ghi mới vào bảng tổng hợp ngay lập tức mà không cần tải lại trang.

---

### Yêu cầu 7: Quản lý danh sách Tình trạng hàng hoá (Product Condition)

**User Story:** Là một Người_dùng, tôi muốn khai báo và quản lý danh sách các tình trạng hàng hoá, để có thể phân loại tình trạng hàng khi nhập/xuất kho.

#### Tiêu chí chấp nhận

1. WHEN Người_dùng truy cập Trang_Khai_báo_Input, THE Frontend SHALL hiển thị danh sách tất cả Tình_trạng_Hàng_hoá đã khai báo dưới dạng bảng.
2. WHEN Người_dùng nhập tên Tình_trạng_Hàng_hoá mới và xác nhận, THE Backend SHALL lưu Tình_trạng_Hàng_hoá mới vào cơ sở dữ liệu.
3. THE Backend SHALL yêu cầu tên Tình_trạng_Hàng_hoá là bắt buộc và không được để trống hoặc chỉ chứa khoảng trắng.
4. WHEN Người_dùng nhập tên Tình_trạng_Hàng_hoá trùng với giá trị đã tồn tại (So_sánh_Không_phân_biệt_Hoa_thường), THE Backend SHALL từ chối tạo mới và trả về thông báo "Tình trạng hàng hoá này đã tồn tại".
5. WHEN Tình_trạng_Hàng_hoá mới được tạo thành công, THE Frontend SHALL cập nhật danh sách hiển thị ngay lập tức mà không cần tải lại trang.
6. THE Backend SHALL cung cấp các giá trị Tình_trạng_Hàng_hoá mặc định khi khởi tạo hệ thống: "Đạt tiêu chuẩn", "Lỗi/Hỏng", "Hàng khách kí gửi".

---

### Yêu cầu 8: Quản lý danh sách Khu vực hàng hoá (Storage Zone)

**User Story:** Là một Người_dùng, tôi muốn khai báo và quản lý danh sách các khu vực/thùng chứa hàng hoá trong kho, để phân bổ hàng hoá vào đúng vị trí lưu trữ.

#### Tiêu chí chấp nhận

1. WHEN Người_dùng truy cập Trang_Khai_báo_Input, THE Frontend SHALL hiển thị danh sách tất cả Khu_vực_Hàng_hoá đã khai báo dưới dạng bảng, bao gồm cột: Tên khu vực, Sức_chứa_Tối_đa, Tồn_kho_Thực_tế, Số_lượng_Còn_nhập_được.
2. WHEN Người_dùng nhập tên Khu_vực_Hàng_hoá mới kèm Sức_chứa_Tối_đa và xác nhận, THE Backend SHALL lưu Khu_vực_Hàng_hoá mới vào cơ sở dữ liệu.
3. THE Backend SHALL yêu cầu tên Khu_vực_Hàng_hoá là bắt buộc và không được để trống hoặc chỉ chứa khoảng trắng.
4. THE Backend SHALL yêu cầu Sức_chứa_Tối_đa là số nguyên dương lớn hơn 0.
5. WHEN Người_dùng nhập tên Khu_vực_Hàng_hoá trùng với giá trị đã tồn tại (So_sánh_Không_phân_biệt_Hoa_thường), THE Backend SHALL từ chối tạo mới và trả về thông báo "Khu vực hàng hoá này đã tồn tại".
6. WHEN Khu_vực_Hàng_hoá mới được tạo thành công, THE Frontend SHALL cập nhật danh sách hiển thị ngay lập tức mà không cần tải lại trang.

---

### Yêu cầu 9: Kiểm soát sức chứa khu vực khi nhập kho

**User Story:** Là một Người_dùng, tôi muốn hệ thống cảnh báo khi số lượng nhập kho vượt quá sức chứa tối đa của khu vực, để tránh nhập quá tải vào một khu vực.

#### Tiêu chí chấp nhận

1. WHEN Người_dùng chọn Khu_vực_Hàng_hoá trong Form_Nhập_Xuất_Kho, THE Frontend SHALL hiển thị Sức_chứa_Tối_đa, Tồn_kho_Thực_tế và Số_lượng_Còn_nhập_được của khu vực đó.
2. THE Backend SHALL tính toán Số_lượng_Còn_nhập_được bằng công thức: Sức_chứa_Tối_đa - Tồn_kho_Thực_tế.
3. IF Người_dùng nhập số lượng nhập kho lớn hơn Số_lượng_Còn_nhập_được của Khu_vực_Hàng_hoá đã chọn, THEN THE Backend SHALL từ chối thao tác và trả về thông báo "Chỉ được nhập tối đa X" trong đó X là Số_lượng_Còn_nhập_được.
4. IF Tồn_kho_Thực_tế của Khu_vực_Hàng_hoá đã bằng Sức_chứa_Tối_đa, THEN THE Backend SHALL từ chối mọi thao tác nhập kho vào khu vực đó và trả về thông báo "Khu vực này đã đầy, không thể nhập thêm hàng".

---

### Yêu cầu 10: Tích hợp thuộc tính khai báo vào form nhập/xuất kho

**User Story:** Là một Người_dùng, tôi muốn các giá trị đã khai báo (thuộc tính sản phẩm, tình trạng hàng hoá, khu vực hàng hoá) xuất hiện dưới dạng tùy chọn trong form nhập/xuất kho, để thao tác nhanh chóng và nhất quán.

#### Tiêu chí chấp nhận

1. WHEN Người_dùng mở Form_Nhập_Xuất_Kho, THE Frontend SHALL hiển thị dropdown chọn SKU_Tổng_hợp chứa tất cả tổ hợp SKU đã khai báo.
2. WHEN Người_dùng mở Form_Nhập_Xuất_Kho, THE Frontend SHALL hiển thị dropdown chọn Tình_trạng_Hàng_hoá chứa tất cả tình trạng đã khai báo.
3. WHEN Người_dùng mở Form_Nhập_Xuất_Kho, THE Frontend SHALL hiển thị dropdown chọn Khu_vực_Hàng_hoá chứa tất cả khu vực đã khai báo.
4. WHEN giá trị khai báo mới được thêm vào Trang_Khai_báo_Input, THE Frontend SHALL tự động cập nhật các dropdown trong Form_Nhập_Xuất_Kho để bao gồm giá trị mới mà không cần tải lại trang.

---

### Yêu cầu 11: Xử lý trùng lặp tự động (Auto-merge Duplicates)

**User Story:** Là một Người_dùng, tôi muốn hệ thống tự động phát hiện và ngăn chặn nhập trùng lặp, để danh sách khai báo luôn sạch sẽ và không có bản ghi trùng.

#### Tiêu chí chấp nhận

1. THE Backend SHALL so sánh tên giá trị mới với tất cả giá trị hiện có bằng So_sánh_Không_phân_biệt_Hoa_thường khi tạo Phân_loại, Màu, Size, Chất_liệu, Tình_trạng_Hàng_hoá hoặc Khu_vực_Hàng_hoá.
2. THE Backend SHALL loại bỏ khoảng trắng thừa ở đầu và cuối tên giá trị trước khi lưu vào cơ sở dữ liệu.
3. WHEN Người_dùng nhập giá trị trùng lặp, THE Frontend SHALL hiển thị thông báo lỗi cụ thể cho từng loại khai báo (ví dụ: "Phân loại này đã tồn tại", "Màu sắc này đã tồn tại").
4. THE Frontend SHALL hiển thị danh sách giá trị hiện có trước khi Người_dùng nhập giá trị mới, để Người_dùng có thể kiểm tra trước khi thêm.

---

### Yêu cầu 12: Giao diện Trang Khai báo Input

**User Story:** Là một Người_dùng, tôi muốn trang khai báo input được tổ chức rõ ràng với ba khu vực riêng biệt, để dễ dàng quản lý từng loại khai báo.

#### Tiêu chí chấp nhận

1. THE Frontend SHALL hiển thị Trang_Khai_báo_Input với ba khu vực riêng biệt: "Thuộc tính sản phẩm", "Tình trạng hàng hoá", và "Khu vực hàng hoá".
2. THE Frontend SHALL thiết kế Trang_Khai_báo_Input theo nguyên tắc Mobile-first, hiển thị chính xác trên màn hình từ 320px đến desktop.
3. WHEN Người_dùng thêm giá trị mới trong bất kỳ khu vực nào, THE Frontend SHALL cập nhật giao diện ngay lập tức thông qua React_Query_Cache (optimistic update).
4. THE Frontend SHALL thêm mục "Khai báo Input" vào thanh điều hướng (sidebar) của Hệ_thống, cho phép tất cả Người_dùng đã đăng nhập truy cập.
