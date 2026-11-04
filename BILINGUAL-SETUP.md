# Thiết lập tiếng Việt / tiếng Anh

Website mặc định tiếng Việt. Nút VI / EN trên header dùng `?lang=vi` và `?lang=en`, đồng thời ghi nhớ lựa chọn trên trình duyệt. Nội dung EN bao gồm landing page, menu, chi tiết món và nhãn điều hướng. Giá vẫn là VND. Đánh giá được dịch có nhãn cho biết đây là bản dịch; tên khách được giữ nguyên.

## Bật lưu nội dung tiếng Anh trong admin

1. Mở đúng project Supabase của Homelody (`qtoiphhaxmqkuggsiidy`).
2. Vào **SQL Editor → New query**.
3. Sao chép toàn bộ file `supabase/bilingual-menu.sql`, rồi chọn **Run**.
4. Tải lại `/admin/`, mở **Thêm món** hoặc **Sửa món**. Nhóm **Nội dung tiếng Anh** sẽ được bật.

SQL thêm 5 cột: `name_en`, `description_en`, `note_en`, `ingredients_en`, `image_alt_en`. File có bản dịch cho 51 món đang công khai lúc chuẩn bị; chỉ bổ sung các trường EN còn trống. Không đổi giá, ảnh, nội dung VI hoặc chính sách phân quyền. Có thể chạy lại mà không ghi đè nội dung EN đã lưu.

Món mới cần tên tiếng Anh; mô tả, hương vị, thành phần và mô tả ảnh có thể bổ sung trong cùng form. Hương vị tối đa 3 ở cả VI và EN. Admin vẫn sử dụng tiếng Việt.

Trong lúc chưa chạy SQL, ô EN được khóa với hướng dẫn, form VI vẫn hoạt động. Website EN dùng bản dịch đi kèm trong `assets/js/i18n-data.js` cho menu hiện có. Món mới chưa có bản dịch giữ tên gốc và không tự bịa mô tả tiếng Anh.

## Kiểm tra trước khi triển khai

```powershell
python scripts/build-assets.py
node scripts/build-site.mjs
python -m http.server 8000 --directory dist
```

Kiểm tra `/?lang=vi`, `/?lang=en`, popup chi tiết, menu mobile và form thêm/sửa món. Các thao tác kiểm tra admin tự động dùng dữ liệu demo trong trình duyệt riêng, không ghi vào database thật.

File SQL không nằm trong bản build công khai. Cần chạy SQL trên Supabase riêng; push GitHub không tự thay đổi cấu trúc database.
