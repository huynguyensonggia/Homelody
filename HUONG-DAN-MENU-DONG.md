# HOMELODY v2 — Menu động + chuyển động mới

## Có gì mới so với bản cũ
- **Hero không gian (10/2026):** đầu trang là ảnh thật mặt tiền Homelody tràn màn hình; header trong suốt trên ảnh, chuyển nền kem khi cuộn. Thứ tự trang: Hero → Đồ uống → Câu chuyện → Không gian → Thực đơn → Ghé quán.
- **Khung trưng bày đồ uống:** nền kem, không bàn. Mỗi món tự căn giữa theo phần ảnh nhìn thấy và có kích thước riêng (ly cao, tách có đĩa không bị ép cùng chiều cao; món dáng ngang nhỏ hơn một chút). Đổi món: món cũ mờ và trượt trái, món mới hiện từ phải (~0,4 giây); tên, giá, số thứ tự đổi cùng lúc.
- **Bảng chi tiết:** bấm "Xem chi tiết", bấm vào ly hoặc một món trong thực đơn → bảng mở gọn (trên điện thoại là bảng trượt từ dưới lên, kéo thanh trên cùng xuống để đóng). Phím Esc để đóng.
- **Thực đơn dạng tab** theo nhóm món có trong dữ liệu (chỉ hiện tab khi có từ 2 nhóm trở lên). Món chưa có ảnh hiện dạng chữ, không dùng ảnh tạm.
- **Bàn xoay chỉ hiện món Nổi bật đã có ảnh ly tách nền.** Món chưa có ảnh vẫn nằm trong thực đơn; tải ảnh lên ở `/admin` là món tự xuất hiện trên bàn. Món đứng đầu danh sách là món hiện mặc định.
- **Hiện dần khi cuộn** cho các section bên dưới hero.
- **Câu chuyện:** cụm 3 ảnh xếp chồng bung ra khi cuộn, đoạn chữ rõ dần. Khi có ảnh thật cho hiên và quầy: chép ảnh dọc 3:4 vào `assets/images/` (gợi ý `story-hien.jpg`, `story-quay.jpg`) rồi thêm 2 dòng `<figure>` có sẵn trong ghi chú ngay trên section Câu chuyện của `index.html` — cụm tự chuyển sang 5 ảnh.
- **Dải số liệu dưới ảnh đầu trang:** số đếm từ 0 khi cuộn tới. Sửa trong `assets/js/config.js` → `stats` (value, suffix, label). Số hiện tại là **số mẫu**; khi đã có số thật, đổi `statsVerified: true` để ẩn dòng ghi chú "số liệu mẫu". Muốn ẩn cả dải: `stats: []`.
- **Menu động:** món, giá, ảnh, thông tin quán lấy từ Supabase. Chủ quán sửa ở trang `/admin` (dùng được trên điện thoại), không cần đụng code.
- **Thực đơn chia theo nhóm** (Cà phê, Trà & Matcha…), số món không giới hạn. Bàn xoay đầu trang chỉ hiện các món được đánh dấu **Nổi bật** (tối đa 6).
- **Ảnh nhẹ hơn:** ảnh mặt tiền giảm từ 5,8MB xuống 0,4MB, ảnh ly chuyển sang WebP.
- Người dùng bật "giảm chuyển động" trong máy sẽ không thấy hiệu ứng, mọi chức năng vẫn chạy.

## Cấu trúc
```
index.html                 trang web
assets/css/styles.css      giao diện + bảng màu thương hiệu
assets/css/motion.css      lớp chuyển động mới
assets/js/config.js        ← ĐIỀN thông tin Supabase ở đây
assets/js/menu-data.js     dữ liệu dự phòng (khi chưa/không kết nối được Supabase)
assets/js/main.js          tải dữ liệu + toàn bộ chuyển động
admin/                     trang quản lý thực đơn
supabase/setup.sql         tạo database, phân quyền, kho ảnh
```

---

## Bước 1 — Chạy thử ngay (chưa cần Supabase)
Trong thư mục này mở Terminal/PowerShell:
```
python -m http.server 8000
```
- Web: http://localhost:8000
- Trang quản lý: http://localhost:8000/admin/ → **chế độ xem thử**, nhập email và mật khẩu bất kỳ.
  Sửa món ở đây rồi tải lại trang web trên **cùng trình duyệt** là thấy thay đổi (rất tiện để demo cho chủ quán).
  Dữ liệu chỉ nằm trong trình duyệt đó, chưa phải dữ liệu thật.

## Bước 2 — Kết nối Supabase (miễn phí, khoảng 15 phút)
1. Vào https://supabase.com → **New project**. Đặt tên `homelody`, chọn **Region: Singapore** (gần Việt Nam nhất), đặt mật khẩu database rồi lưu lại.
2. Mở `supabase/setup.sql`, kéo xuống **mục 6** và đổi `email-cua-ban@gmail.com` thành email sẽ đăng nhập trang quản lý (có thể thêm nhiều dòng cho nhiều người).
3. Supabase → **SQL Editor** → New query → dán **toàn bộ** file → **Run**. Kết quả phải là "Success".
4. **Authentication → Users → Add user → Create new user**: nhập đúng email ở bước 2 và một mật khẩu, tích **Auto Confirm User**.
5. (Nên làm) **Authentication → Sign In / Providers** → tắt **Allow new users to sign up**. Dù không tắt thì người lạ đăng ký được cũng không sửa được menu, nhưng tắt đi cho gọn.
6. **Project Settings → API Keys**: copy **Project URL** và **Publishable key** (`sb_publishable_…`), hoặc khoá **anon public** nếu chỉ thấy loại đó. Dán vào `assets/js/config.js`:
   ```js
   supabaseUrl: 'https://xxxx.supabase.co',
   supabaseKey: 'sb_publishable_xxxxxxxx',
   ```
   ⚠️ Tuyệt đối **không** dán khoá *secret* hay *service_role*.
7. Tải lại web, mở `/admin/` và đăng nhập bằng tài khoản vừa tạo. Bốn món mẫu đã có sẵn, sửa tiếp từ đó.

## Bước 3 — Đưa web lên mạng (miễn phí)
Cách nhanh nhất là **Netlify Drop**: vào https://app.netlify.com/drop và kéo **cả thư mục** này vào. Netlify sẽ cho một địa chỉ dạng `homelody-xxx.netlify.app`.
- Trang quản lý: `https://homelody-xxx.netlify.app/admin/`
- Khi chỉ đổi **món hoặc giá** thì **không** cần tải lại lên Netlify: sửa ở `/admin` là web cập nhật ngay.
- Chỉ phải kéo thả lại khi sửa code hoặc ảnh trong thư mục `assets`.
- Muốn tên miền riêng (homelody.vn…) thì mua ở nhà đăng ký tên miền rồi gắn vào Netlify ở mục *Domain management*.

## Dùng hằng ngày (cho chủ quán)
- Trên điện thoại mở `…/admin/` → Chia sẻ → **Thêm vào màn hình chính** để có biểu tượng như một ứng dụng.
- **Hết món:** gạt công tắc tắt, món ẩn khỏi web ngay. Gạt lại để hiện.
- **Đổi giá:** bấm Sửa, gõ `45000` hoặc `45k` hoặc `45`, đều hiểu là 45.000đ.
- **Thứ tự:** nút ↑ ↓ đổi chỗ trong cùng nhóm.
- **Món nổi bật:** bật ở món muốn đưa lên bàn xoay đầu trang (nên 4–6 món).
- **Thông tin quán:** tab "Thông tin quán" (địa chỉ, giờ mở cửa, điện thoại, link Zalo, mạng xã hội).

## Ảnh món (quan trọng để bàn xoay đẹp)
- Chụp thẳng ngang thân ly, ánh sáng đều.
- **Tách nền** trước khi tải lên (remove.bg hoặc Canva → "Xóa nền"), lưu PNG.
- Trang quản lý tự cắt sát đáy ly, thu nhỏ còn tối đa 900px và nén sang WebP. Nếu ảnh chưa tách nền, trang sẽ cảnh báo.

## Lưu ý khi dùng gói miễn phí
- Supabase tạm dừng dự án miễn phí nếu **7 ngày liền gần như không có truy cập**. Web có khách xem mỗi ngày thì không sao.
  Nếu bị dừng: web tự dùng bản menu đã lưu trên máy khách quen, máy khác thì thấy dữ liệu mẫu. Vào Supabase Dashboard → chọn project → **Resume project**.
- Để web không bao giờ hiện dữ liệu mẫu sai giá, sau khi chốt menu hãy sửa luôn `menu-data.js` cho giống menu thật.

## Khắc phục sự cố
| Hiện tượng | Cách xử lý |
|---|---|
| Đăng nhập báo "chưa có quyền sửa menu" | Email chưa có trong bảng `admin_users`. Chạy: `insert into admin_users (email) values ('email@...');` |
| Web vẫn hiện "Thực đơn demo" | `config.js` chưa điền đúng, hoặc Supabase đang tạm dừng. Mở F12 → Console để xem lỗi. |
| Tải ảnh lên báo lỗi | Kiểm tra mục 5 trong `setup.sql` đã chạy chưa (bucket `menu-images`). Ảnh gốc tối đa 15MB. |
| Chuyển động nhanh/chậm quá | Trong `main.js`, tìm hàm `select` (đổi món) và `openDetails`/`closeDetails` (thẻ chi tiết), sửa các số `duration`/`delay` (đơn vị mili giây). |

## Đã kiểm tra
- Chrome (Playwright) ở 390, 768, 1024, 1440px: đổi món, bấm liên tục nhiều món, mở/đóng chi tiết từ đầu trang và từ thực đơn, phím Esc, chế độ giảm chuyển động. Không có lỗi JavaScript.
- Trang quản lý chạy với thư viện Supabase thật (v2.116.0) trên một máy chủ Supabase **giả lập**: đăng nhập, sai mật khẩu, thêm/sửa/xoá món, tải và thay ảnh (ảnh cũ tự xoá), ẩn/hiện, sắp xếp, lưu thông tin quán, web đọc dữ liệu thật.
- **Chưa** chạy trên một dự án Supabase thật, chưa thử Safari/iPhone thật. Lần đầu kết nối, hãy thử một vòng: thêm món → xem web → xoá món.
# Nhập đồ uống bằng Excel hoặc Google Sheets

1. Mở `/admin/`, vào **Thực đơn**, bấm **Tải file Excel mẫu**.
2. Điền tab **Do uong** từ dòng 2. Bắt buộc có **Tên món**, **Nhóm**, **Giá (VNĐ)**. Tab **Huong dan** giải thích từng cột.
3. Bấm **Nhập từ sheet**, chọn file `.xlsx` hoặc `.csv` UTF-8 rồi xem trước kết quả kiểm tra.
4. Bấm **Nhập … món hợp lệ**. Các dòng lỗi và món trùng tên + nhóm được bỏ qua. Chỉ thêm món mới; không ghi đè hoặc xóa món cũ.

Có thể mở file mẫu trong Google Sheets, điền dữ liệu rồi tải về dạng Microsoft Excel (.xlsx). Tối đa 500 dòng dữ liệu và 5MB mỗi lần. Không dùng công thức trong dữ liệu nhập.

Cột **Link ảnh** nhận URL hoặc đường dẫn ảnh có sẵn trên website. Ảnh chèn trong ô Excel không được nhập; để trống link rồi dùng **Sửa món** để tải ảnh từ máy. Khi đang ở chế độ xem thử, dữ liệu chỉ lưu trên trình duyệt đang dùng.
