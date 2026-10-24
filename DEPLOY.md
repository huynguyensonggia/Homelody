# Deploy Homelody miễn phí trên Cloudflare Pages

Website HTML/CSS/JavaScript, không cần server Node.js chạy liên tục. Dữ liệu vẫn đọc từ Supabase hiện có; deploy frontend không sao chép hoặc đổi dữ liệu.

## Cách khuyến nghị: kết nối GitHub

1. Đăng nhập https://dash.cloudflare.com/ → **Workers & Pages** → **Create application** → **Pages** → kết nối GitHub (tên nút có thể thay đổi).
2. Cho phép truy cập repository `huynguyensonggia/Homelody`, chọn repository đó.
3. Cấu hình:

   | Mục | Giá trị |
   | --- | --- |
   | Project name | `homelody` hoặc tên còn trống |
   | Production branch | `main` |
   | Framework preset | `None` |
   | Root directory | Để trống (gốc repository) |
   | Build command | `node scripts/build-site.mjs` |
   | Build output directory | `dist` |
   | Environment variables | Không cần |

4. Chọn **Save and Deploy**. Cloudflare cấp địa chỉ `https://<project-name>.pages.dev` và HTTPS. Mỗi lần push `main` sau đó sẽ tự deploy.
5. Mở trang chủ và `/admin/`, thử đăng nhập bằng tài khoản quản trị hiện có, kiểm tra menu và ảnh. Không cần chạy lại SQL để deploy frontend.

## Cách upload thủ công

```powershell
node scripts/build-site.mjs
Compress-Archive -Path .\dist\* -DestinationPath .\homelody-cloudflare-pages.zip -Force
```

Tạo Pages bằng **Direct Upload / Upload assets**, kéo file ZIP hoặc thư mục `dist` vào, rồi deploy. ZIP có `index.html` ở gốc. Direct Upload không tự cập nhật từ GitHub; muốn tự deploy thì chọn Git integration ngay từ đầu. Đây là hai cách tạo project khác nhau.

## Nội dung bản deploy

- Chỉ có `index.html`, `404.html`, `_headers`, `admin/`, `assets/` và `public/` cùng giấy phép thư viện SheetJS.
- Không phục vụ `.git/`, `reports/`, `outputs/`, `scripts/`, `supabase/`, bản sao lưu hay tài liệu nội bộ.
- `assets/js/config.js` dùng publishable key được phép nằm trong trình duyệt. Không thay bằng secret key/service-role key.
- Gói build kiểm tra giới hạn 25 MiB/tệp và 20.000 tệp của Pages Free.
- Hosting frontend miễn phí trong giới hạn Free; Supabase và tên miền riêng có gói/chi phí riêng. Địa chỉ `pages.dev` không cần mua tên miền.

## Kiểm tra trước khi deploy

```powershell
node scripts/build-site.mjs
node scripts/check-supabase-connection.mjs
python -m http.server 8000 --directory dist
```

Mở http://localhost:8000/ và http://localhost:8000/admin/. Dừng server bằng Ctrl+C. Script kiểm tra Supabase chỉ đọc dữ liệu và kiểm tra ảnh, không sửa database.

## Tài liệu chính thức

- https://developers.cloudflare.com/pages/framework-guides/deploy-anything/
- https://developers.cloudflare.com/pages/configuration/git-integration/
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/pages/get-started/direct-upload/
