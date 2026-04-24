# Tài liệu Yêu cầu - Hệ thống Quản lý Kho (Inventory Management System)

## Giới thiệu

Hệ thống Quản lý Kho là một ứng dụng web được thiết kế theo hướng Mobile-first, cho phép doanh nghiệp quản lý hàng tồn kho một cách hiệu quả. Hệ thống bao gồm các chức năng: xác thực và phân quyền người dùng, quản lý sản phẩm và SKU, nhập/xuất kho, quản lý tồn kho, báo cáo và dashboard, trực quan hóa sơ đồ kho, và kiểm kê hàng hóa.

**Công nghệ sử dụng:**
- Frontend: React (Vite), TypeScript, Tailwind CSS, Shadcn UI
- Backend: Node.js, NestJS, TypeScript
- Database: PostgreSQL + Prisma ORM
- Cache: React Query
- Xác thực: JWT + RBAC

## Bảng thuật ngữ (Glossary)

- **Hệ_thống**: Ứng dụng web Quản lý Kho bao gồm cả Frontend và Backend
- **Backend**: Máy chủ API xử lý logic nghiệp vụ, xác thực và phân quyền
- **Frontend**: Giao diện người dùng chạy trên trình duyệt web
- **Người_dùng**: Bất kỳ ai tương tác với Hệ_thống, bao gồm Admin, Manager và Staff
- **Admin**: Vai trò có toàn quyền quản trị Hệ_thống, bao gồm quản lý người dùng và cấu hình sơ đồ kho
- **Manager**: Vai trò có quyền duyệt biên bản kiểm kê và xem báo cáo/dashboard
- **Staff**: Vai trò có quyền thực hiện nhập kho, xuất kho và kiểm kê
- **SKU**: Stock Keeping Unit - Mã định danh duy nhất cho mỗi sản phẩm, theo định dạng DANHMUC-ID-NGAY
- **Sản_phẩm**: Mặt hàng được quản lý trong kho, có tên, danh mục, giá và SKU
- **Tồn_kho**: Số lượng hiện tại của một Sản_phẩm trong kho
- **Nhập_kho**: Thao tác thêm số lượng Sản_phẩm vào kho
- **Xuất_kho**: Thao tác lấy số lượng Sản_phẩm ra khỏi kho
- **Biên_bản_kiểm_kê**: Tài liệu ghi nhận kết quả so sánh giữa số lượng trên Hệ_thống và số lượng thực tế trong kho
- **Sơ_đồ_kho**: Bản đồ trực quan thể hiện bố trí vật lý của kho và vị trí các Sản_phẩm
- **Vị_trí_kho**: Một ô hoặc khu vực cụ thể trên Sơ_đồ_kho nơi Sản_phẩm được lưu trữ
- **Dashboard**: Trang tổng quan hiển thị các chỉ số và biểu đồ về tình hình kho
- **JWT**: JSON Web Token - Phương thức xác thực người dùng dựa trên token
- **RBAC**: Role-Based Access Control - Cơ chế phân quyền dựa trên vai trò
- **Sức_chứa_kho**: Giới hạn tối đa về số lượng hàng hóa mà kho có thể chứa
- **React_Query_Cache**: Bộ nhớ đệm phía client do React Query quản lý, giúp giảm số lần gọi API

## Yêu cầu

### Yêu cầu 1: Xác thực người dùng (Authentication)

**User Story:** Là một Người_dùng, tôi muốn đăng nhập vào Hệ_thống bằng tài khoản của mình, để có thể truy cập các chức năng được phân quyền.

#### Tiêu chí chấp nhận

1. WHEN Người_dùng gửi thông tin đăng nhập hợp lệ (email và mật khẩu), THE Backend SHALL xác thực thông tin và trả về một JWT access token cùng refresh token.
2. WHEN Người_dùng gửi thông tin đăng nhập không hợp lệ, THE Backend SHALL trả về mã lỗi 401 kèm thông báo "Thông tin đăng nhập không chính xác".
3. THE Backend SHALL yêu cầu JWT hợp lệ trong header Authorization cho mọi API endpoint ngoại trừ endpoint đăng nhập.
4. WHEN JWT hết hạn hoặc không hợp lệ, THE Backend SHALL trả về mã lỗi 401 và Frontend SHALL chuyển hướng Người_dùng về trang đăng nhập.
5. WHEN Người_dùng đăng xuất, THE Backend SHALL vô hiệu hóa refresh token hiện tại của Người_dùng đó.

---

### Yêu cầu 2: Phân quyền theo vai trò (RBAC)

**User Story:** Là một Admin, tôi muốn phân quyền cho từng người dùng theo vai trò (Admin, Manager, Staff), để đảm bảo mỗi người chỉ truy cập được chức năng phù hợp.

#### Tiêu chí chấp nhận

1. THE Backend SHALL phân quyền truy cập dựa trên ba vai trò: Admin, Manager và Staff.
2. THE Backend SHALL kiểm tra quyền truy cập tại tầng middleware trước khi xử lý mọi request.
3. WHEN Admin thay đổi vai trò của một Người_dùng, THE Backend SHALL cập nhật quyền truy cập ngay lập tức mà không yêu cầu Người_dùng đó đăng nhập lại.
4. IF Admin cố gắng xóa tài khoản của chính mình, THEN THE Backend SHALL từ chối thao tác và trả về thông báo lỗi "Admin không thể tự xóa tài khoản của chính mình".
5. WHEN Admin tạo tài khoản mới, THE Backend SHALL yêu cầu chỉ định vai trò (Admin, Manager hoặc Staff) cho tài khoản đó.

---

### Yêu cầu 3: Quản lý sản phẩm

**User Story:** Là một Staff, tôi muốn thêm và quản lý thông tin sản phẩm trong hệ thống, để có thể theo dõi hàng hóa trong kho.

#### Tiêu chí chấp nhận

1. WHEN Staff gửi form tạo sản phẩm với đầy đủ thông tin bắt buộc (tên sản phẩm, danh mục, giá), THE Backend SHALL tạo Sản_phẩm mới và lưu vào cơ sở dữ liệu.
2. THE Backend SHALL yêu cầu trường tên sản phẩm là bắt buộc và không được để trống.
3. IF trường tên sản phẩm bị bỏ trống khi tạo hoặc cập nhật, THEN THE Backend SHALL từ chối thao tác và trả về thông báo lỗi "Tên sản phẩm là bắt buộc".
4. WHEN Sản_phẩm được tạo, THE Backend SHALL tự động sinh mã SKU theo định dạng DANHMUC-ID-NGAY (ví dụ: DONGHO-001-20231027).
5. THE Backend SHALL đảm bảo mỗi SKU là duy nhất trong toàn bộ Hệ_thống.
6. IF mã SKU được sinh ra trùng với SKU đã tồn tại, THEN THE Backend SHALL tự động tạo SKU mới với ID tăng dần cho đến khi tìm được SKU duy nhất.
7. WHEN Người_dùng yêu cầu danh sách sản phẩm, THE Backend SHALL trả về danh sách có phân trang với thông tin tên, danh mục, giá và SKU.

---

### Yêu cầu 4: Tự động sinh mã SKU

**User Story:** Là một Staff, tôi muốn hệ thống tự động tạo mã SKU khi thêm sản phẩm mới, để đảm bảo mã SKU nhất quán và duy nhất.

#### Tiêu chí chấp nhận

1. WHEN Sản_phẩm mới được tạo, THE Backend SHALL sinh mã SKU theo định dạng: DANHMUC-ID-NGAY, trong đó DANHMUC là mã viết hoa không dấu của danh mục, ID là số thứ tự 3 chữ số (bắt đầu từ 001), và NGAY là ngày tạo theo định dạng YYYYMMDD.
2. THE Backend SHALL đảm bảo phần ID trong SKU tăng dần trong cùng một danh mục.
3. FOR ALL Sản_phẩm hợp lệ, việc phân tích (parse) SKU thành các thành phần (DANHMUC, ID, NGAY) rồi ghép lại SHALL tạo ra SKU giống với SKU ban đầu (thuộc tính round-trip).
4. THE SKU_Generator SHALL chuyển đổi tên danh mục tiếng Việt có dấu thành mã viết hoa không dấu (ví dụ: "Đồng hồ" thành "DONGHO").

---

### Yêu cầu 5: Nhập kho (Stock In)

**User Story:** Là một Staff, tôi muốn ghi nhận hàng nhập kho, để cập nhật chính xác số lượng tồn kho.

#### Tiêu chí chấp nhận

1. WHEN Staff gửi yêu cầu nhập kho với Sản_phẩm và số lượng hợp lệ, THE Backend SHALL tăng Tồn_kho của Sản_phẩm đó theo đúng số lượng nhập.
2. IF số lượng nhập kho nhỏ hơn hoặc bằng 0, THEN THE Backend SHALL từ chối thao tác và trả về thông báo lỗi "Số lượng nhập kho phải lớn hơn 0".
3. WHEN nhập kho thành công, THE Backend SHALL ghi nhận lịch sử giao dịch bao gồm: Sản_phẩm, số lượng, thời gian, và Người_dùng thực hiện.
4. WHEN nhập kho thành công, THE Frontend SHALL cập nhật React_Query_Cache để hiển thị số lượng tồn kho mới mà không cần tải lại trang.

---

### Yêu cầu 6: Xuất kho (Stock Out)

**User Story:** Là một Staff, tôi muốn ghi nhận hàng xuất kho, để cập nhật chính xác số lượng tồn kho.

#### Tiêu chí chấp nhận

1. WHEN Staff gửi yêu cầu xuất kho với Sản_phẩm và số lượng hợp lệ, THE Backend SHALL giảm Tồn_kho của Sản_phẩm đó theo đúng số lượng xuất.
2. IF số lượng xuất kho nhỏ hơn hoặc bằng 0, THEN THE Backend SHALL từ chối thao tác và trả về thông báo lỗi "Số lượng xuất kho phải lớn hơn 0".
3. IF số lượng xuất kho lớn hơn Tồn_kho hiện tại của Sản_phẩm, THEN THE Backend SHALL từ chối thao tác và trả về thông báo lỗi "Không thể xuất quá số lượng tồn kho hiện tại".
4. WHEN xuất kho thành công, THE Backend SHALL ghi nhận lịch sử giao dịch bao gồm: Sản_phẩm, số lượng, thời gian, và Người_dùng thực hiện.
5. WHEN xuất kho thành công, THE Frontend SHALL cập nhật React_Query_Cache để hiển thị số lượng tồn kho mới mà không cần tải lại trang.

---

### Yêu cầu 7: Cảnh báo sức chứa kho

**User Story:** Là một Manager, tôi muốn nhận cảnh báo khi kho gần đầy, để có thể lên kế hoạch xử lý kịp thời.

#### Tiêu chí chấp nhận

1. WHEN tổng số lượng hàng trong kho vượt quá 90% Sức_chứa_kho sau một thao tác nhập kho, THE Frontend SHALL hiển thị thông báo cảnh báo dạng UI Notification với nội dung "Sức chứa kho đã vượt quá 90%".
2. WHILE tổng số lượng hàng trong kho vượt quá 90% Sức_chứa_kho, THE Frontend SHALL hiển thị biểu tượng cảnh báo trên thanh điều hướng.
3. THE Backend SHALL tính toán tỷ lệ sức chứa kho dựa trên tổng số lượng hàng hiện tại chia cho Sức_chứa_kho đã cấu hình.

---

### Yêu cầu 8: Quản lý và hiển thị tồn kho

**User Story:** Là một Staff, tôi muốn xem danh sách tồn kho theo thời gian thực với bộ lọc linh hoạt, để nhanh chóng tìm được thông tin cần thiết.

#### Tiêu chí chấp nhận

1. WHEN Người_dùng truy cập trang tồn kho, THE Frontend SHALL hiển thị danh sách tồn kho với số lượng được cập nhật theo thời gian thực thông qua React_Query_Cache.
2. THE Frontend SHALL cung cấp bộ lọc theo danh mục, khoảng thời gian và Vị_trí_kho.
3. WHEN Người_dùng áp dụng bộ lọc, THE Frontend SHALL yêu cầu ít nhất một điều kiện lọc được chọn trước khi gửi request.
4. IF Người_dùng nhấn nút lọc mà chưa chọn điều kiện lọc nào, THEN THE Frontend SHALL hiển thị thông báo "Vui lòng chọn ít nhất một điều kiện lọc".
5. WHEN Người_dùng áp dụng bộ lọc hợp lệ, THE Backend SHALL trả về danh sách tồn kho phù hợp với các điều kiện lọc, có phân trang.

---

### Yêu cầu 9: Xuất báo cáo Excel

**User Story:** Là một Manager, tôi muốn xuất báo cáo nhập-xuất-tồn ra file Excel, để phục vụ công tác báo cáo và lưu trữ.

#### Tiêu chí chấp nhận

1. WHEN Người_dùng yêu cầu xuất báo cáo, THE Backend SHALL tạo file Excel (.xlsx) chứa dữ liệu nhập-xuất-tồn theo bộ lọc đã áp dụng.
2. THE Backend SHALL bao gồm các cột: Tên sản phẩm, SKU, Danh mục, Số lượng nhập, Số lượng xuất, Tồn kho hiện tại, và Thời gian cập nhật cuối trong file Excel.
3. WHEN file Excel được tạo thành công, THE Backend SHALL trả về file để Frontend tải xuống cho Người_dùng.
4. IF không có dữ liệu phù hợp với bộ lọc, THEN THE Backend SHALL trả về thông báo "Không có dữ liệu để xuất báo cáo".

---

### Yêu cầu 10: Dashboard tổng quan

**User Story:** Là một Manager, tôi muốn xem dashboard tổng quan tình hình kho, để nắm bắt nhanh các chỉ số quan trọng.

#### Tiêu chí chấp nhận

1. THE Backend SHALL chỉ cho phép Người_dùng có vai trò Manager hoặc Admin truy cập API dashboard.
2. IF Người_dùng có vai trò Staff cố gắng truy cập dashboard, THEN THE Backend SHALL trả về mã lỗi 403 và Frontend SHALL hiển thị thông báo "Bạn không có quyền truy cập trang này".
3. WHEN Manager hoặc Admin truy cập dashboard, THE Frontend SHALL hiển thị các chỉ số tổng quan: tổng số sản phẩm, tổng tồn kho, số lượng nhập/xuất trong tháng, và tỷ lệ sức chứa kho.
4. THE Frontend SHALL hiển thị biểu đồ đường (Line Chart) theo dõi biến động nhập/xuất kho trong 12 tuần hoặc 12 tháng gần nhất.
5. WHEN Manager hoặc Admin chuyển đổi giữa chế độ xem tuần và tháng, THE Frontend SHALL cập nhật biểu đồ tương ứng mà không cần tải lại trang.

---

### Yêu cầu 11: Sơ đồ kho (Warehouse Visualizer)

**User Story:** Là một Admin, tôi muốn cấu hình sơ đồ kho trực quan và cho phép nhân viên sắp xếp sản phẩm vào vị trí, để quản lý không gian kho hiệu quả.

#### Tiêu chí chấp nhận

1. THE Frontend SHALL hiển thị Sơ_đồ_kho dưới dạng lưới (grid) trực quan với các Vị_trí_kho.
2. WHEN Người_dùng kéo thả (drag & drop) một Sản_phẩm vào một Vị_trí_kho trống, THE Frontend SHALL gửi yêu cầu cập nhật vị trí đến Backend.
3. THE Backend SHALL xác nhận Vị_trí_kho nằm trong Sơ_đồ_kho đã được cấu hình trước khi chấp nhận thao tác sắp xếp.
4. IF Người_dùng cố gắng đặt Sản_phẩm vào Vị_trí_kho không tồn tại trong Sơ_đồ_kho, THEN THE Backend SHALL từ chối thao tác và trả về thông báo lỗi "Vị trí không hợp lệ trong sơ đồ kho".
5. THE Backend SHALL chỉ cho phép Admin tạo, chỉnh sửa hoặc xóa cấu hình Sơ_đồ_kho.
6. IF Người_dùng không phải Admin cố gắng thay đổi cấu hình Sơ_đồ_kho, THEN THE Backend SHALL trả về mã lỗi 403 kèm thông báo "Chỉ Admin mới được thay đổi sơ đồ kho".

---

### Yêu cầu 12: Tạo biên bản kiểm kê

**User Story:** Là một Staff, tôi muốn tạo biên bản kiểm kê để ghi nhận kết quả kiểm tra thực tế so với hệ thống.

#### Tiêu chí chấp nhận

1. WHEN Staff tạo biên bản kiểm kê, THE Backend SHALL tạo Biên_bản_kiểm_kê với trạng thái "Chờ duyệt" và ghi nhận danh sách Sản_phẩm kèm số lượng hệ thống và số lượng thực tế.
2. THE Backend SHALL tự động tính toán chênh lệch giữa số lượng hệ thống và số lượng thực tế cho mỗi Sản_phẩm trong Biên_bản_kiểm_kê.
3. IF có chênh lệch giữa số lượng hệ thống và số lượng thực tế cho bất kỳ Sản_phẩm nào, THEN THE Backend SHALL yêu cầu đính kèm ảnh hoặc file minh chứng cho Sản_phẩm đó.
4. IF Biên_bản_kiểm_kê có sai lệch mà không đính kèm ảnh hoặc file minh chứng, THEN THE Backend SHALL từ chối lưu biên bản và trả về thông báo lỗi "Yêu cầu đính kèm ảnh/file minh chứng cho các sản phẩm có sai lệch".

---

### Yêu cầu 13: Phê duyệt biên bản kiểm kê

**User Story:** Là một Manager, tôi muốn duyệt biên bản kiểm kê, để xác nhận kết quả kiểm kê và cập nhật tồn kho chính xác.

#### Tiêu chí chấp nhận

1. THE Backend SHALL chỉ cho phép Người_dùng có vai trò Manager hoặc Admin phê duyệt Biên_bản_kiểm_kê.
2. WHEN Manager phê duyệt Biên_bản_kiểm_kê, THE Backend SHALL cập nhật trạng thái biên bản thành "Đã duyệt" và điều chỉnh Tồn_kho theo số lượng thực tế.
3. WHEN Manager từ chối Biên_bản_kiểm_kê, THE Backend SHALL cập nhật trạng thái biên bản thành "Từ chối" và giữ nguyên Tồn_kho hiện tại.
4. IF Người_dùng có vai trò Staff cố gắng phê duyệt hoặc từ chối Biên_bản_kiểm_kê, THEN THE Backend SHALL trả về mã lỗi 403 kèm thông báo "Chỉ Manager trở lên mới được phê duyệt biên bản kiểm kê".

---

### Yêu cầu 14: Giao diện Mobile-first

**User Story:** Là một Người_dùng, tôi muốn sử dụng ứng dụng mượt mà trên trình duyệt di động, để có thể thao tác quản lý kho mọi lúc mọi nơi.

#### Tiêu chí chấp nhận

1. THE Frontend SHALL thiết kế giao diện theo nguyên tắc Mobile-first, ưu tiên trải nghiệm trên màn hình có chiều rộng từ 320px đến 768px.
2. THE Frontend SHALL sử dụng Tailwind CSS responsive utilities để đảm bảo giao diện hiển thị chính xác trên cả mobile, tablet và desktop.
3. THE Frontend SHALL sử dụng React_Query_Cache để lưu trữ dữ liệu đã tải, tránh gọi lại API khi Người_dùng điều hướng giữa các trang.
4. WHEN Người_dùng thực hiện thao tác nhập/xuất kho trên mobile, THE Frontend SHALL cập nhật giao diện ngay lập tức (optimistic update) và đồng bộ với Backend trong nền.

---

### Yêu cầu 15: Bảo mật API

**User Story:** Là một Admin, tôi muốn đảm bảo tất cả API được bảo mật nghiêm ngặt, để ngăn chặn truy cập trái phép.

#### Tiêu chí chấp nhận

1. THE Backend SHALL xác thực JWT token trong header Authorization cho mọi request đến API được bảo vệ.
2. THE Backend SHALL kiểm tra quyền RBAC tại tầng middleware trước khi chuyển request đến controller.
3. IF request không có JWT token hoặc token không hợp lệ, THEN THE Backend SHALL trả về mã lỗi 401 kèm thông báo "Unauthorized".
4. IF Người_dùng không có quyền truy cập tài nguyên được yêu cầu, THEN THE Backend SHALL trả về mã lỗi 403 kèm thông báo "Forbidden".
5. THE Backend SHALL sử dụng parameterized queries thông qua Prisma ORM để ngăn chặn SQL injection.
6. THE Backend SHALL xác thực và làm sạch (sanitize) tất cả dữ liệu đầu vào từ Người_dùng trước khi xử lý.
