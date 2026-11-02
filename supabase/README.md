# Kết nối Supabase Homelody

- Project: `qtoiphhaxmqkuggsiidy`, URL `https://qtoiphhaxmqkuggsiidy.supabase.co`.
- Website và admin dùng publishable key trong `assets/js/config.js`.
- `public.drinks`: sản phẩm, giá, thành phần, mô tả và đường dẫn ảnh.
- `public.shop_settings`: thông tin quán, `story_images`, `space_images` và `public_links`.
- `public_links` lưu sáu liên kết mạng xã hội/đặt món, Google Maps và số gọi điện. Admin và website dùng chung bộ phân giải `assets/js/shop-settings.js`: ưu tiên link đã lưu; khi chưa lưu, dùng đúng các link hiện có trong cấu hình website, bỏ qua các cột liên hệ cũ chưa đồng bộ.
- Với dự án cũ, chạy `public-links.sql` một lần để thêm trường JSON. Đã áp dụng và xác minh qua Dashboard cho dự án Homelody ngày 01/11/2026; cột mới ban đầu là `{}` nên không đổi các link đang chạy. Sau đó chỉnh/sửa/lưu ở admin; trang công khai nhận giá trị mới khi tải lại.
- `menu_categories` là danh sách nhóm thực đơn theo thứ tự. Chạy `menu-categories.sql` để thêm cột cho dự án cũ; đã áp dụng và kiểm tra trên dự án Homelody ngày 01/11/2026. `NULL` dùng cấu hình danh mục hiện tại; mảng rỗng là danh sách trống có chủ ý.
- Danh mục có ID ổn định, tên Việt/Anh, tên cũ (`aliases`) và cờ hiển thị. Đổi tên giữ aliases để sản phẩm cũ vẫn thuộc nhóm mà không phải cập nhật hàng loạt. Chỉ cho xóa nhóm không có món; ẩn nhóm không xóa sản phẩm. Lưu bằng so sánh `updated_at` để từ chối ghi đè một phiên dữ liệu đã cũ.
- `featured_drink_ids` lưu thứ tự Món yêu thích, tối đa 6 ID; cột nullable được thêm bằng `featured-menu.sql` và đã xác minh qua Dashboard/API ngày 01/11/2026. Khi NULL, giữ cách chọn món hiện tại; sau khi lưu, website dùng đúng danh sách đó, không tự chèn món khác khi món đã chọn bị ẩn/xóa/thiếu ảnh. Admin cho lưu 1–6 món hợp lệ, kiểm tra lại dữ liệu mới nhất trước khi ghi và từ chối phiên dữ liệu cũ qua `updated_at`. Các cờ `drinks.is_featured` cũ chỉ còn phục vụ tương thích khi chưa có lựa chọn riêng.
- `public.admin_users`: email được quyền quản trị, chỉ sửa qua SQL Editor.
- `homelody_private.is_admin()`: kiểm tra người dùng đã xác nhận email trong Supabase Auth. Schema này không expose qua Data API.
- Bucket `menu-images`: public, giới hạn 3MB, nhận WebP/PNG/JPEG. Chỉ tài khoản quản trị được thêm, sửa và xóa ảnh.

Đăng nhập `/admin/` bằng tài khoản đã tạo trong Supabase Authentication. Email được chuẩn bị cho quán là `admin@homelody.local`; chủ quán tự đặt mật khẩu ở biểu mẫu Create user trong Dashboard. Giữ **Auto confirm user** khi tạo tài khoản nội bộ này. Nếu muốn dùng email khác, thêm đúng email vào `admin_users`.

`setup.sql` tạo cấu trúc và RLS, không thêm sản phẩm mẫu hoặc mật khẩu. Tạo bucket qua Dashboard/Storage API. Khi tạo dự án mới, thêm email quản trị được chủ quán xác nhận và chuyển dữ liệu thực tế riêng.

Kiểm tra kết nối chỉ đọc:

```powershell
node scripts/check-supabase-connection.mjs
```

Các script kiểm tra giao diện dùng cấu hình demo trong trình duyệt riêng, không thao tác database thật. Nút **Sao lưu dữ liệu** trong admin tải về bản JSON chứa sản phẩm, đường dẫn ảnh và thông tin quán.
