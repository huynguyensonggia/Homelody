# Homelody Admin — cập nhật UI/UX ngày 01/11/2026

## Định hướng

Một không gian vận hành nhẹ, đồng bộ thương hiệu quán: sidebar xanh olive, nền kem, bề mặt sáng, tiêu đề serif và nội dung sans-serif. Ưu tiên tìm món, sửa giá và ẩn/hiện; các công cụ ít dùng và thao tác xóa được đặt ở cấp phụ.

## Đã triển khai

- Thiết kế lại trang đăng nhập, điều hướng, danh sách món, biểu mẫu và hộp thoại; tối ưu mobile.
- Bốn ô tổng quan lấy dữ liệu danh sách đã tải, bấm để lọc: tổng món, đang hiển thị, đang ẩn, nổi bật. Không hiển thị doanh thu, đơn hàng hoặc thống kê không có nguồn dữ liệu.
- Tìm kiếm không dấu; kết hợp lọc danh mục và trạng thái; tìm món chưa có ảnh; hiển thị số kết quả và nút xóa bộ lọc.
- Tải lại danh sách, trạng thái tải và thông báo lỗi rõ ràng. Thao tác ẩn/hiện không cho gửi lặp trong khi đang lưu.
- Tên món là nút có thể truy cập bằng bàn phím; tab hỗ trợ phím mũi tên, Home/End và thay đổi hướng theo bố cục màn hình.
- Cảnh báo khi đóng trình sửa món có dữ liệu chưa lưu, giữ lựa chọn tiếp tục chỉnh sửa.
- Hiện/ẩn mật khẩu; tách thao tác xóa toàn bộ vào mục nâng cao, giữ nguyên xác nhận xóa có sẵn.
- Giữ nhập XLSX/CSV, kiểm tra trùng, sao lưu JSON, thứ tự món, ảnh Câu chuyện/Không gian và logic phân quyền hiện có.
- Thêm khung Món yêu thích ngay trong Thực đơn: xem chính xác tối đa 6 món đang xuất hiện; chọn/tìm món và sắp xếp bằng ↑ ↓ trong hộp thoại riêng. Chỉ nhận món đang bán, có ảnh và danh mục đang bật; loại bỏ sự mơ hồ khi có nhiều cờ nổi bật cũ hơn giới hạn. Nhãn đếm và bộ lọc dùng đúng danh sách đang hiển thị. Có xác nhận bỏ thay đổi chưa lưu, xử lý lỗi/thử lại và chặn ghi đè phiên dữ liệu cũ.

## Phát hiện cần xử lý tiếp

1. **Đã xử lý trong lượt cập nhật tiếp theo ngày 01/11/2026:** tách đủ sáu ô Facebook/Instagram/Zalo/GrabFood/ShopeeFood/TikTok và điền đúng link đang dùng. Website và admin dùng chung `shop-settings.js`. Thêm `shop_settings.public_links` trên Supabase bằng SQL Editor, xác minh qua truy vấn và public API; ban đầu `{}` nên giữ các link gốc. Khi lưu, thông tin liên hệ công khai lấy từ cấu hình đã lưu; số điện thoại cũ không tự ghi đè số đang hiển thị. Có link xem giá trị hiện tại, kiểm tra HTTPS và thông báo lưu rõ ràng. Dữ liệu thử nghiệm cập nhật link chỉ chạy trong profile demo; không dùng link giả trên dữ liệu thật.
2. **Hữu ích khi bắt đầu giao cho nhân viên:** lịch sử thay đổi và khôi phục bản trước. Cần lưu trên máy chủ, kèm tài khoản thực hiện; không dùng localStorage để giả lập nhật ký quản trị thật.
3. **Đã bổ sung quản lý danh mục:** tab riêng để thêm tên Việt/Anh, đổi tên, thứ tự, ẩn/hiện và xóa nhóm trống. Đổi tên giữ aliases nên không sửa/xóa hàng loạt sản phẩm. Danh mục đang có món không cho xóa; có nút xem món để chuyển sản phẩm sang nhóm khác bằng trình sửa món. Website và bộ nhập Excel dùng danh mục được quản lý; nhóm ẩn không hiển thị trên website và không được tính vào số món công khai. Có kiểm tra phiên dữ liệu cũ trước khi ghi. Cột `menu_categories` đã thêm trên Supabase, ban đầu NULL để giữ cấu hình hiện có.

Hiện chưa cần thêm biểu đồ doanh thu/đơn hàng vì hệ thống này quản lý nội dung website, chưa có dữ liệu bán hàng đáng tin cậy để dựng các biểu đồ đó.

## Kiểm chứng

- Kiểm tra bằng Chromium cô lập; dữ liệu demo của bài kiểm tra không phải số liệu thật của quán. Bài kiểm tra workspace chặn toàn bộ request đến Supabase thật.
- `node scripts/check-admin-workspace.mjs`: tìm kiếm không dấu, bộ lọc, ẩn/hiện cập nhật số liệu, thêm món, tải lại, hộp thoại nhập, cảnh báo chưa lưu, đăng xuất; bố cục menu/ảnh/hồ sơ/editor ở 320, 390, 768, 1024, 1440px.
- `node scripts/check-drink-import.mjs`: nhập Excel thực tế, phát hiện trùng/sai, thử lại sau lỗi lưu, giữ cờ trạng thái và hiển thị đúng trên trang công khai bằng dữ liệu demo.
- `node scripts/check-security.mjs`: CSP tiếp tục chặn script inline; trang đăng nhập admin tải được không có lỗi khởi tạo.
- `node scripts/check-shop-links.mjs`: kiểm thử URL an toàn, điền sẵn đủ sáu link gốc, giữ số điện thoại đã chốt, lưu/tải lại, truyền giá trị sang tất cả icon/nút công khai và phục hồi link gốc khi bỏ trống. Kiểm tra trên demo có chặn toàn bộ request tới backend thật.
- `node scripts/check-menu-categories.mjs`: kiểm thử thêm/sửa/đổi thứ tự, tên trùng, aliases, chọn nhóm mới trong món, số lượng sản phẩm, không cho xóa nhóm có món, xóa nhóm trống, ẩn/hiện nhóm trên website và từ chối ghi đè dữ liệu cũ. Đã xem ảnh giao diện 1440px và 390px; kiểm tra không tràn ngang ở 320px.
- `node scripts/check-featured-menu.mjs`: kiểm thử giới hạn 6, đủ điều kiện, tìm không dấu, thứ tự, cảnh báo chưa lưu, lỗi ghi/thử lại, lưu/tải lại, danh sách và bộ đếm trên landing page, món bị ẩn không tự được thay thế, chặn danh sách rỗng và ghi đè phiên dữ liệu cũ. Bài kiểm tra dùng dữ liệu demo cô lập và chặn mọi request đến Supabase thật. Đã xem ảnh desktop/mobile của cả khung xem trước và hộp thoại.
- Xác minh vận hành thật: mở hộp chọn trong admin đang đăng nhập, đối chiếu đúng 6 món và thứ tự đang hiển thị, rồi lưu nguyên danh sách đó. Admin báo thành công và public API xác nhận `featured_drink_ids` có 6 mục. Không dùng món thử hoặc đổi thứ tự thật. Sáu món giữ nguyên: Cà phê sữa, Cà phê muối, Cà phê kem trứng, Cà phê Tiramisu, Espresso, Cappuccino.
- Đã xem ảnh chụp desktop/mobile và chỉnh lại kích cỡ chữ, dropdown, trạng thái modal và cuộn trong hộp thoại.

Chưa deploy lên tên miền thật. Xem ngay mã nguồn đang chạy ở `http://localhost:8000/admin/`.
