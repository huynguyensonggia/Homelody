# Rà soát bảo mật Homelody — 01/11/2026

## Phạm vi và trạng thái

Rà soát mã nguồn `homelody-v2`, kiểm tra CSP trong Chromium trên máy cục bộ và bốn yêu cầu chỉ đọc tới Supabase đã cấu hình trong project. Không quét tấn công tên miền, thử mật khẩu, tạo tải lớn, sửa hoặc xóa dữ liệu thật. Chưa deploy các thay đổi bảo mật lên `homelodyhoian.com`.

Connector Supabase trả về danh sách dự án rỗng, nên chưa có quyền kiểm tra catalog/policies hoặc cập nhật cấu hình quản trị của dự án `qtoiphhaxmqkuggsiidy`. Không có phiên quản trị hosting được dùng trong lượt làm việc này.

Cập nhật sau khi người dùng mở Dashboard trong Chrome: đã đọc được đúng dự án qua UI đang đăng nhập. Tổng quan hiển thị Healthy và Last backup: No backups. Security Advisor hiển thị 0 errors, 1 warning và 1 info; cảnh báo đã đọc là **Leaked Password Protection Disabled**. Chưa đọc mục info, chưa xác minh policy bằng catalog và chưa thay đổi cấu hình trên dịch vụ. Kết nối MCP vẫn trả về danh sách dự án rỗng; truy cập UI thành công không đồng nghĩa MCP đã được cấp quyền.

## Những điểm đã gia cố trong mã nguồn

- `_headers`: CSP chặn JavaScript inline và HTML event handlers; không cho object/embed, base URL hoặc iframe nhúng website; chỉ cho kết nối script tới chính website và backend Supabase đã xác định. Cho phép CDN SDK quản trị, Google Fonts và Google Maps đang sử dụng. CSS inline được giữ để tương thích giao diện. Ảnh HTTPS bên ngoài vẫn được phép, nên đây chưa phải chính sách ảnh theo allowlist từng host.
- Bật HSTS một năm, chặn sniff MIME và tắt quyền camera/microphone/geolocation/payment/USB. Headers có hiệu lực khi hosting thực sự phục vụ `_headers`, không có hiệu lực tự động trên Python `http.server`.
- Chuyển bootstrap từ script inline sang file riêng để tương thích CSP.
- Trang quản trị từ chối chế độ demo khi không ở localhost. Đây là biện pháp tránh cấu hình nhầm; database RLS vẫn là ranh giới phân quyền thực sự.
- Phiên quản trị mới dùng `sessionStorage`, không nhận session từ URL và xác minh user qua Auth. Token cũ đã lưu trước thay đổi không được tự động thu hồi. Token vẫn có thể bị đánh cắp nếu thiết bị hoặc JavaScript được tin cậy bị chiếm quyền.
- Chặn ảnh đầu ra quá 3MB/sai MIME và chặn canvas xử lý ảnh quá 24 megapixel hoặc quá 10.000px mỗi cạnh. Đây là giới hạn phía trình duyệt; bucket phải tự thực thi MIME/kích thước trên dịch vụ.
- Build từ chối key không phải publishable, kiểm tra backend khớp CSP và từ chối đích build là symlink. Bộ build chỉ đóng gói các thư mục đã định, không đưa SQL, `.git`, báo cáo hoặc thông tin môi trường vào dist.
- `setup.sql` thu hồi quyền bảng mặc định dư thừa rồi cấp lại quyền tối thiểu. File SQL đang có xác minh admin qua danh sách riêng và email đã xác nhận; chưa xác minh được định nghĩa tương ứng trong database thật.

## Kiểm tra

- `node --check admin/admin.js`, `node --check assets/js/bootstrap.js`: đạt.
- `node scripts/build-site.mjs`: đạt, 144 file, khoảng 41 MiB.
- `node scripts/check-security.mjs`: đạt. Chromium thật chặn script inline và HTML event handlers; bootstrap và các script ứng dụng tải được; menu hiển thị và trang đăng nhập mở không có lỗi khởi tạo dưới CSP. Python server trên cổng 8000 không cung cấp các headers này.
- `node scripts/check-security-api.mjs`: đạt. Khách ẩn danh đọc được menu công khai, không đọc được món ẩn hoặc danh sách admin; RPC `is_admin` trả về false. Bài kiểm tra không chứng minh quyền ghi/xóa an toàn và không thay thế audit toàn bộ RLS.
- SQL mới **chưa chạy trên database thật**. `supabase/security-audit.sql` chỉ đọc; `supabase/security-hardening.sql` chuẩn bị thu hồi quyền dư và khôi phục các policy đã rà soát. Script sẽ dừng nếu policy dự kiến thiếu hoặc có policy lạ trên các bảng ứng dụng. Không chạy mù khi chưa xem audit và xác nhận định nghĩa `is_admin` thực tế.

## Phần cần hoàn tất trên dịch vụ trước khi coi là sẵn sàng production

1. Kết nối tài khoản chứa đúng Supabase project; chạy audit, kiểm tra advisors và grants/RLS cho mọi bảng/view/function được expose, kể cả Storage. Xác minh `homelody_private` không được expose. Kiểm tra quyền bằng tài khoản quản trị và tài khoản thường trong môi trường thử nghiệm; không dùng production để thử xóa.
2. Xác nhận bucket `menu-images` thực thi tối đa 3MB, chỉ JPEG/PNG/WebP và chỉ admin được ghi/xóa. Rà soát tất cả Storage policy vì policy cho phép khác có thể mở quyền ngoài dự kiến.
3. Tắt đăng ký công khai và anonymous sign-ins nếu quán không dùng. Cấu hình giới hạn đăng nhập phía Auth, mật khẩu mạnh, và MFA cho tài khoản quản trị. Tài khoản GitHub, hosting, DNS và Supabase Dashboard cũng cần MFA. Trang quản trị hiện chưa có bước CAPTCHA/MFA; cần tích hợp giao diện tương ứng trước khi bật yêu cầu cho đăng nhập. Không chỉ thêm bộ đếm sai mật khẩu trong JavaScript vì bot có thể bỏ qua.
4. Bật và kiểm tra HTTPS cho `homelodyhoian.com`, deploy `dist`, rồi xác minh response headers trên tên miền thật. Nếu dùng hosting khác Netlify/Cloudflare Pages phải chuyển cấu hình headers sang định dạng của hosting đó.
5. Cấu hình WAF/chống bot, giới hạn truy cập và cảnh báo lưu lượng ở lớp CDN/hosting theo gói đang dùng. Bảo vệ `/admin/` bằng cổng truy cập riêng nếu có. Các biện pháp này không tự bảo vệ endpoint Supabase trực tiếp; nếu cần chặn spam đọc dữ liệu/quota mạnh hơn, cần API/proxy có giới hạn trên máy chủ và khóa đường truy cập trực tiếp phù hợp.
6. Bật cảnh báo dung lượng/chi phí, theo dõi lỗi và sao lưu database/ảnh có lịch; thử phục hồi. Lưu bản sao ngoài cùng tài khoản để giảm rủi ro khi tài khoản bị chiếm.

Website tĩnh không có biểu mẫu ghi công khai trong mã nguồn đã rà soát. Bề mặt đáng chú ý vẫn là Auth, API dữ liệu, Storage, tài khoản quản trị và giới hạn lưu lượng/chi phí. Không có cấu hình nào bảo đảm miễn nhiễm mọi tấn công hoặc DDoS.

## Tài liệu đối chiếu

- [Supabase: bảo vệ Data API, grants và RLS](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase: Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits)
- [Supabase: CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha)
- [MDN: Content-Security-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy)
- [Netlify: Firewall Traffic Rules](https://docs.netlify.com/manage/security/secure-access-to-sites/traffic-rules/)
