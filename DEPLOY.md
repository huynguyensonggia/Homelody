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
- Deploy bằng Netlify Drop; chưa kết nối tự cập nhật từ GitHub. Khi thay đổi mã, build và upload lại vào chính project này.

## Kiểm tra tại máy

```powershell
node scripts/build-site.mjs
python -m http.server 8000 --directory dist
```

Mở http://localhost:8000/ và http://localhost:8000/admin/. Dừng server bằng Ctrl+C.

## Tài liệu chính thức

- https://docs.netlify.com/build/configure-builds/file-based-configuration/
- https://docs.netlify.com/deploy/create-deploys/
- https://www.netlify.com/pricing/
