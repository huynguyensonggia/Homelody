# Ảnh phần Không gian

Quản lý tại `/admin/` → **Hình ảnh** → **Ảnh Không gian**. Chọn ảnh theo vị trí, sửa mô tả rồi bấm **Lưu ảnh Không gian**. Có xem trước, hủy thay đổi và khôi phục ảnh mặc định.

Chưa cấu hình Supabase: ảnh lưu trên cùng trình duyệt và cùng địa chỉ website. Đã cấu hình: ảnh lưu trong bucket `menu-images`, thư mục `space/`; dữ liệu lưu ở `shop_settings.space_images`. Database cũ cần chạy một lần `supabase/space-images.sql`; cài mới dùng `supabase/setup.sql`.

Nếu muốn thay file mặc định thủ công, giữ nguyên tên và định dạng WEBP:

| File | Vị trí / nội dung | Kích thước khuyến nghị |
| --- | --- | --- |
| `story-vuon.webp` | Trên bên trái — Một góc học bài trên tầng hai | 1200 × 600px, ảnh ngang 2:1 |
| `hero-coffee-banner-960.webp` | Dưới bên trái — Một chỗ bên hiên | 1200 × 600px, ảnh ngang 2:1 |
| `homelody-entrance.webp` | Ảnh lớn bên phải — Homelody chào bạn | 1200 × 1200px, ảnh vuông 1:1 |

Đây là kích thước gợi ý theo bố cục desktop, không phải yêu cầu bắt buộc. Khung ảnh thay đổi theo màn hình; trên mobile cả ba ảnh xếp thành một cột. Website tự cắt ảnh vừa khung, nên đặt chủ thể ở vùng giữa và tránh chữ quan trọng sát mép ảnh.

- Xuất ảnh đúng định dạng WEBP; không chỉ đổi đuôi JPG/PNG thành WEBP.
- Nhấn Ctrl + F5 sau khi thay ảnh. Nếu website đã đưa lên hosting, tải file mới lên đúng đường dẫn này.
- Nếu dùng tên hoặc định dạng khác, cập nhật cả `src` trong khối `space-cards` ở `index.html` và dữ liệu `HOMELODY_SPACE_IMAGES` trong `assets/js/story-data.js`. Cập nhật `alt` khi đổi nội dung. Ảnh đã lưu qua admin được ưu tiên; chọn **Dùng ảnh ban đầu** rồi lưu để quay lại bộ mặc định.
- Ảnh trong thư mục này độc lập với ảnh Câu chuyện và hero. Thay ảnh tại đây chỉ ảnh hưởng phần Không gian.
