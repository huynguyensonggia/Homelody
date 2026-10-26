# Deploy Homelody trên Netlify Free

Website HTML/CSS/JavaScript dùng địa chỉ `https://<project-name>.netlify.app` để gửi chủ quán xem. Sau này có thể gắn tên miền riêng. Dữ liệu tiếp tục dùng Supabase hiện có.

## Deploy từ GitHub

1. Đăng nhập https://app.netlify.com/ và chọn gói **Free**.
2. Chọn **Add new project → Import an existing project → GitHub**.
3. Cho phép truy cập repository `huynguyensonggia/Homelody`, chọn repository và nhánh `main`.
4. Netlify tự đọc `netlify.toml`: build command `node scripts/build-site.mjs`, publish directory `dist`, Node.js `22`. Base directory để trống, không cần biến môi trường.
5. Chọn **Deploy**. Lấy link `netlify.app` gửi chủ quán. Push `main` sau đó sẽ tự cập nhật website.
6. Kiểm tra trang chủ, ảnh, menu và `/admin/` bằng tài khoản quản trị hiện có. Không chạy lại SQL khi deploy frontend.

## Upload nhanh bản đã build

Mở https://app.netlify.com/drop khi đã đăng nhập, kéo thư mục `dist` hoặc `homelody-netlify.zip` vào để deploy. Cách này không tự cập nhật từ GitHub.

Tạo lại bản upload khi mã nguồn thay đổi:

```powershell
node scripts/build-site.mjs
python scripts/package-site.py
```

Chỉ upload `dist` hoặc ZIP đã build, không upload toàn bộ repository. ZIP có `index.html` ở gốc.

## Nội dung bản deploy

- Chỉ có trang chủ, trang 404, cấu hình headers, `admin/`, `assets/`, `public/` và giấy phép SheetJS.
- Không phục vụ `.git/`, `reports/`, `outputs/`, `scripts/`, `supabase/` hoặc bản sao lưu.
- `assets/js/config.js` chứa publishable key dùng cho trình duyệt. Không dùng secret key hoặc service-role key ở frontend.
- Tài khoản hiện dùng Free Legacy; các tài khoản Free mới có thể dùng hạn mức credits. Xem Usage trong tài khoản để kiểm tra đúng hạn mức. Không cần mua tên miền để dùng `netlify.app`. Supabase có hạn mức riêng.

## Bản xem trước đã xuất bản

- Website: https://homelody-hoian-preview.netlify.app/
- Dashboard: https://app.netlify.com/projects/homelody-hoian-preview
- Project ID: `eac0361a-8fd9-48e8-a559-0ed74a6d096c`.
- Đã liên kết GitHub `huynguyensonggia/Homelody`, nhánh production `main`, ngày 26/10/2026. Mỗi lần push lên `main`, Netlify tự build bằng `node scripts/build-site.mjs` và publish thư mục `dist`; không cần upload thủ công.
- Lần build đầu tiên từ GitHub đã publish lúc 19:01 ngày 26/10/2026 (GMT+7), commit `b39062f`, deploy ID `6adf4128aa6a5b923e45fe61`.
- Bản tối ưu đã publish lúc 12:30 ngày 24/10/2026 (GMT+7), deploy ID `6adc425abe8fe8f7523efa78`.
- Bản cập nhật UI/UX đã publish lúc 23:42 ngày 24/10/2026 (GMT+7), deploy ID `6adce00e1bb8fcf37f92e8e6`. Đã kiểm tra trực tiếp production: chọn danh mục mobile, vuốt ngang, tổng51 món, link GrabFood/ShopeeFood, thông tin ghé quán, nội dung rút gọn và bản đồ tải theo yêu cầu.
- PageSpeed Insights sau deploy: [báo cáo mobile/desktop](https://pagespeed.web.dev/analysis/https-homelody-hoian-preview-netlify-app/bg9yoy6918?form_factor=mobile). Mobile Performance 92, LCP 2,7s, CLS 0,003; desktop Performance 96, LCP 0,6s, CLS 0,009. Đây là số đo lab của một lượt chạy, chưa có dữ liệu người dùng thực tế.

## Kiểm tra tại máy

```powershell
node scripts/build-site.mjs
python -m http.server 8000 --directory dist
```

Mở http://localhost:8000/ và http://localhost:8000/admin/. Dừng server bằng Ctrl+C.

## Ảnh tối ưu và kiểm tra hiệu năng

Landing page dùng WebP trong `assets/images/optimized/`, với ánh xạ từ URL gốc ở `assets/js/image-variants.js`. Card menu dùng bản 400px, ảnh sản phẩm dùng tối đa 800px, Câu chuyện dùng 480px, Không gian có `srcset` 480/960px. Logo nhỏ dùng `assets/images/homelody-logo.webp`. Ảnh gốc vẫn giữ để dùng trong quản trị và làm nguồn xuất lại.

Build Netlify chỉ cần `node scripts/build-site.mjs`, không cần tải ảnh hoặc cài Pillow. Các file tối ưu đã có trong mã nguồn.

Khi thay ảnh nguồn ở máy, chạy `python scripts/build-image-variants.py` (cần Pillow) để tạo lại WebP. Script giữ các ánh xạ ảnh đã tải từ Supabase. Để tạo bản nhỏ cho ảnh mới trên quản trị, dùng `--snapshot <file.json>` với dữ liệu công khai dạng `{ "drinks": [...], "shop": [...] }` từ bảng `drinks` và `shop_settings`, rồi build và deploy lại. URL ảnh mới chưa có trong ánh xạ vẫn dùng ảnh gốc, không làm hỏng trang. Script không sửa database.

Đo bằng `scripts/check-performance.cjs`; báo cáo và ảnh kiểm tra nằm trong `reports/performance/`. Số đo cục bộ dùng dữ liệu công khai cố định để so sánh, không thay thế PageSpeed Insights trên URL đã deploy.

## Tài liệu chính thức

- https://docs.netlify.com/build/configure-builds/file-based-configuration/
- https://docs.netlify.com/deploy/create-deploys/
- https://www.netlify.com/pricing/
