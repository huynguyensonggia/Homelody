# Kết nối Supabase Homelody

- Project: `qtoiphhaxmqkuggsiidy`, URL `https://qtoiphhaxmqkuggsiidy.supabase.co`.
- Website và admin dùng publishable key trong `assets/js/config.js`.
- `public.drinks`: sản phẩm, giá, thành phần, mô tả và đường dẫn ảnh.
- `public.shop_settings`: thông tin quán, `story_images` và `space_images`.
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
