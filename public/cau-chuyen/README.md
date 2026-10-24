# Ảnh phần Câu chuyện

Quản lý tại `/admin/` → **Hình ảnh**: chọn ảnh cho từng khung, sửa mô tả rồi bấm **Lưu ảnh**.
Ảnh được xem trước và nén tự động. **Hủy thay đổi** trả lại bộ ảnh đã lưu; **Dùng ảnh ban đầu** trả riêng khung đó về ảnh trong project (cần bấm Lưu ảnh).

Chưa cấu hình Supabase: ảnh chỉ lưu trên cùng trình duyệt và cùng địa chỉ website.
Đã cấu hình Supabase: ảnh lưu trong bucket `menu-images`, thư mục `story/`; đường dẫn và mô tả lưu trong `shop_settings.story_images`.
Database đã cài từ trước cần chạy một lần `supabase/story-images.sql`; cài mới dùng `supabase/setup.sql`.

Các ảnh mặc định hiện tại: `story-nhan-vien.png`, `story-ho-ca.png`, `story-vuon.png`, `story-garden-seating.png`, `story-khach-hang.png`.

Nếu thay file thủ công, dùng các đường dẫn mặc định sau:

| File | Nội dung hiện tại |
| --- | --- |
| `story-nhan-vien.png` | Nhân viên |
| `story-ho-ca.png` | Hồ cá |
| `story-vuon.png` | Khu vườn |
| `story-garden-seating.png` | Khách ngồi trong vườn |
| `story-khach-hang.png` | Khách hàng |

- Giữ nguyên tên file và định dạng ảnh. Không chỉ đổi đuôi JPG thành WEBP/PNG; hãy xuất ảnh đúng định dạng.
- Ưu tiên ảnh dọc tỉ lệ 3:4, chiều rộng từ 600px. Website tự cắt ảnh vừa khung.
- Sau khi thay ảnh, nhấn Ctrl + F5 để tải lại. Nếu website đã đưa lên hosting, tải cả file ảnh mới lên cùng đường dẫn.
- Nếu dùng tên file hoặc định dạng khác, sửa cả dữ liệu trong `assets/js/story-data.js` và thẻ ảnh trong cụm `story__carousel` ở `index.html`. Cập nhật mô tả ảnh khi thay nội dung. Ảnh đã lưu từ admin được ưu tiên; chọn **Dùng ảnh ban đầu** rồi **Lưu ảnh** để quay về bộ mặc định.

Thư mục này chỉ dùng cho cụm ảnh Câu chuyện. Thay ảnh tại đây không ảnh hưởng ảnh đang dùng ở section Không gian.
