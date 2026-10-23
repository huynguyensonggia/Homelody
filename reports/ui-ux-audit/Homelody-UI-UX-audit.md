# Đánh giá màu sắc và typography Homelody

Ngày kiểm tra: 22/10/2026.

Đối chiếu tài liệu `Homelody_Phan_tich_tong_mau.pdf` với website tại `http://localhost:3000`, trên khung nhìn rộng 1440px và 390px. Đây là báo cáo đánh giá; chưa thay đổi giao diện.

## Nhận định chính

Bảng màu và ba font hiện tại phù hợp với tinh thần “ngôi nhà trong khu vườn nhiệt đới”: ấm, mộc, có chất vườn và đủ thanh lịch. Cần hoàn thiện cách phân vai màu sắc, thang chữ và nhịp chuyển giữa các phần.

Ba điểm lệch rõ nhất là nút đặt bàn màu đào, nền bánh thiên vàng caramel và footer nâu gần đen. Mỗi phần riêng lẻ có sức hút, nhưng khi đặt cạnh nhau chúng chưa tạo cảm giác cùng thuộc một hệ thiết kế.

## Cơ sở từ tài liệu

- Trang PDF 2–3: charcoal `#393C36` và golden tan `#D2AD81` là cặp nhận diện; kem `#F2EDE4`, gỗ, tường vôi và xanh là nhóm hỗ trợ.
- Trang PDF 4, mang số in 3: nền sáng chiếm ưu thế; charcoal/gỗ tạo điểm nghỉ tối; xanh và tan dùng tiết chế. Tỷ lệ 60/30/10 là định hướng thị giác, không nên ép thành phép chia diện tích cứng trên website có nhiều ảnh.
- Cùng trang: Playfair Display/Lora cho tiêu đề, Be Vietnam Pro/Nunito Sans cho nội dung, Dancing Script/Great Vibes cho vài câu nhấn.
- Trang PDF 5 chứa prompt và mã mẫu. Đây là nội dung tham khảo của tài liệu; không được coi là yêu cầu mới để xây lại trang, thêm nút hoặc thay thông tin kinh doanh.

## Đánh giá từ đầu trang đến cuối trang

| Khu vực | Hiện trạng và mức phù hợp | Đề xuất |
| --- | --- | --- |
| Header | Nền kem và logo hợp thương hiệu. Chữ điều hướng Be Vietnam Pro dễ đọc. Nút đặt bàn hiện là đào `#FEC195`, trong khi CTA hero là tan. | Dùng tan `#D2AD81` và chữ charcoal cho hệ nút đặt bàn. Cân lại lá trang trí để kích thước và chuyển động vừa đủ, giữ điểm nhấn của nút. |
| Hero | Ảnh lớn, tiêu đề Playfair có một vế nghiêng và nút tan tạo cảm giác ấm, có chủ đích. Tiêu đề khoảng 86px trên desktop, 48px trên mobile, phân cấp tốt. Đoạn dẫn đang weight 600 và có bóng đen. | Giữ cấu trúc và CTA. Thử đoạn dẫn weight 400–500, lớp phủ rêu sẫm có kiểm soát để chữ vẫn rõ trên ảnh. Cân nhiệt độ màu ảnh với nhóm ảnh không gian ở dưới. |
| Dải số liệu | Nền kem tạo khoảng nghỉ tốt sau ảnh hero. Kiểu số serif phù hợp. Nhãn xuống 12px trên mobile. | Giữ nền và kiểu số; tăng nhãn lên khoảng 13px nếu diện tích cho phép. Liên kết khoảng cách với phần đồ uống để hai phần cùng thành một nhịp nội dung. |
| Đồ uống nổi bật | Nền kem, chữ charcoal và ảnh đồ uống nổi bật là lựa chọn phù hợp. Nền xanh nhạt quanh matcha có quan hệ trực tiếp với sản phẩm. Tiêu đề Playfair, tên sản phẩm sans-serif giúp phân biệt câu chuyện và thông tin mua hàng. | Giữ hướng thiết kế. Giới hạn các nền đổi theo sản phẩm vào một nhóm màu dịu, cùng độ bão hòa. Thống nhất màu giá, trạng thái chọn và đường viền với thực đơn. |
| Bánh nhà làm | Nền chuyển sắc từ `#F9EED8` tới `#E8D1AF` khá vàng; ảnh bánh cũng vàng nên cả phần bị dồn vào cùng một sắc. Playfair hợp nội dung, nhưng dòng nghiêng tiếp tục lặp lại công thức của phần đồ uống. | Dùng tường vôi pha kem sáng hơn, giảm sắc vàng và độ rõ của gradient. Để màu bánh tạo cảm giác ấm. Giảm một cấp nhấn trang trí nếu cả slogan viết tay và vế nghiêng cùng cạnh tranh với tiêu đề. |
| Câu chuyện | Kem sáng, tiêu đề serif và ảnh sân vườn phù hợp. Nội dung Be Vietnam Pro 20px desktop, 17,5px mobile dễ đọc. Chữ mờ theo cuộn tạo trải nghiệm riêng nhưng làm một phần nội dung khó đọc trong quá trình chuyển động. | Giữ nền kem và bố cục. Tinh chỉnh hiệu ứng theo hướng ít nhòe hơn, các từ tới vùng đọc cần rõ nhanh. Có thể thử 18–19px cho nội dung desktop nếu muốn gọn hơn; đây là tinh chỉnh thẩm mỹ, không phải lỗi cỡ chữ. |
| Không gian | Nền `#E8E2D6` phân biệt nhẹ với câu chuyện; ảnh lớn và chuyển động phủ lên đã tạo khác biệt. Tiêu đề serif, mô tả sans-serif hợp vai trò. | Giữ nhịp nền này. Đồng nhất sắc xanh và độ ấm giữa ảnh; kiểm tra chữ chú thích khi ảnh đổi vùng sáng. Bố cục ảnh là điểm thu hút chính của phần này. |
| Thực đơn | Nền ngà `#FAF7F1` nhẹ, chữ charcoal rõ, tên món sans-serif dễ quét; đây là phần cần ưu tiên tính thực dụng. Playfair cho tên nhóm là một cầu nối tốt với phần kể chuyện. | Giữ nền sáng. Gom các sắc kem thành một hệ nền có tên và vai trò rõ; thống nhất cỡ tên món, giá và mô tả giữa các thẻ. Ưu tiên trạng thái lọc rõ ràng và ảnh sản phẩm nhất quán. |
| Tiện ích “Ở Homelody” | Mảng xanh `#303B2F` giúp trang có nhịp tối, chữ kem dễ đọc. Tuy nhiên đây là một sắc xanh riêng, trong khi phần ghé thăm dùng rêu chuẩn. | Ưu tiên charcoal `#393C36` cho phần tiện ích: vẫn giữ được cảm giác ấm, đồng thời dành mảng rêu lớn cho phần ghé thăm. Tăng khoảng nghỉ giữa các mục trên điện thoại vừa đủ để người đọc lướt nhanh. |
| Đánh giá | Nền kem sau phần tối tạo nhịp tốt. Thẻ ngà và nội dung sans-serif 16px desktop/15px mobile phù hợp. Nhãn đầu phần 11px/10px, chú thích nguồn 11px khá nhỏ. | Giữ nền kem. Tăng các nhãn quan trọng lên 12–13px, tên khách 14px; duy trì khả năng dừng chuyển động hiện có. Cân tốc độ để người đọc hoàn thành một thẻ mà không phải đuổi theo chữ. |
| Ghé thăm | Rêu `#2C2F1E`, tiêu đề kem và điểm nhấn tan bám bảng màu tốt, phân biệt rõ với đánh giá. Bản đồ và thẻ sáng nổi trên nền tối. Có hai câu Dancing Script gần nhau ở phần đầu và thẻ liên hệ. | Giữ phối màu hiện tại. Chọn một câu viết tay làm điểm nhấn của cụm; câu còn lại dùng sans-serif hoặc lược bớt theo nội dung. Tăng nhãn địa chỉ/giờ mở cửa từ 12px lên 13px nếu cần ưu tiên dễ đọc. |
| Footer | Nền `#1B100A` nâu gần đen khiến kết trang nặng hơn các phần phía trên. Chữ serif ở tên cột và sans-serif ở liên kết đúng vai trò; chữ phụ hơi nhỏ. | Dùng charcoal `#393C36`, chữ kem và nhấn tan để kết trang quay về cặp màu thương hiệu. Giữ liên kết khoảng 14px và tạo sự phân biệt rõ giữa tiêu đề cột, liên kết và thông tin phụ. |

## Hệ chữ đề xuất

Không cần thêm font. Trình duyệt xác nhận Playfair Display, Be Vietnam Pro và Dancing Script đều được sử dụng thực tế; các điểm kiểm tra không bị thay bằng font hệ thống ngoài ý muốn.

| Vai trò | Font | Cỡ đề xuất desktop / mobile | Lưu ý |
| --- | --- | --- | --- |
| Tiêu đề hero | Playfair Display 400 | 76–88px / 44–48px | Có thể giữ một vế nghiêng. |
| Tiêu đề phần tiêu chuẩn | Playfair Display 400 | 48px / 34px | Dùng một mức nền tảng; các khoảng dao động cần có mục đích. |
| Tiêu đề kể chuyện nổi bật | Playfair Display 400 | 56px / 36px | Chỉ dành cho vài điểm muốn nhấn, không áp cho mọi phần. |
| Tên món, tiêu đề chức năng | Be Vietnam Pro 500–600 | 18–20px / 18px | Dễ quét khi chọn món. Tên sản phẩm trong vùng giới thiệu lớn có thể dùng 26–30px. |
| Nội dung chính | Be Vietnam Pro 400 | 17–18px / 16–17px | Giãn dòng khoảng 1,6–1,8; tránh dòng quá dài. |
| Nút, tab lọc | Be Vietnam Pro 500–600 | 16px / 16px | Thống nhất độ đậm giữa các nhóm điều khiển. |
| Nhãn phụ, nguồn đánh giá | Be Vietnam Pro 400–500 | 12–13px / 12–13px | Nhãn thông tin cần đọc nên ưu tiên 13px. |
| Slogan/lời chào | Dancing Script | 22–26px / 20–24px | Mỗi cụm nội dung chỉ cần một câu viết tay nổi bật. |

Hiện tiêu đề phần trên desktop trải từ 44px tới gần 60px. Đây chưa phải lỗi: bố cục biên tập có thể dùng nhiều mức. Điểm cần bổ sung là quy ước rõ phần nào được dùng cỡ lớn và phần nào dùng cỡ tiêu chuẩn, tránh điều chỉnh riêng từng section thiếu hệ thống.

## Nhịp nền đề xuất

Ảnh hero → kem cho số liệu/đồ uống → tường vôi sáng cho bánh → kem cho câu chuyện → be tường vôi cho không gian → ngà sáng cho thực đơn → charcoal cho tiện ích → kem cho đánh giá → rêu cho ghé thăm → charcoal cho footer.

Độ thu hút đến từ cả nền, tỷ lệ ảnh và mật độ bố cục. Các đoạn sáng cần có ảnh lớn, khoảng nghỉ và cấu trúc khác nhau để tạo nhịp. Đổi sang nhiều màu mới sẽ làm thương hiệu khó nhất quán hơn.

## Các cặp màu chữ cần giữ

Tỷ lệ dưới đây được tính từ mã màu sRGB hiện có, chưa phải một cuộc kiểm định tương phản toàn bộ website trên ảnh và mọi trạng thái chuyển động.

| Chữ / nền | Tỷ lệ gần đúng | Cách sử dụng |
| --- | --- | --- |
| Charcoal / kem | 9,61:1 | Nội dung, tiêu đề trên nền sáng. |
| Kem / rêu | 11,75:1 | Tiêu đề, nội dung chính ở phần ghé thăm. |
| Tan / charcoal | 5,36:1 | Chữ nhấn và icon trên nền tối. |
| Espresso / tan | 5,56:1 | Chữ nút CTA hiện tại. |
| Olive / thẻ `#FDFBF7` | 6,31:1 | Chữ phụ trong thẻ liên hệ. |
| Tan / kem | 1,79:1 | Chỉ dùng trang trí; tránh dùng cho thông tin cần đọc. |

## Thứ tự hoàn thiện

1. **Màu và khả năng đọc:** đồng bộ nút đặt bàn về tan; cân lại nền bánh; chuyển footer về charcoal; tăng nhãn nhỏ ở đánh giá và liên hệ.
2. **Hệ thiết kế:** xác định vai trò các mức tiêu đề; gom các biến thể nền sáng; thống nhất màu trạng thái chọn, đường viền và nút. Có thể dùng quy ước bo góc 12px cho nút, 16px cho thẻ, 24px cho khối ảnh lớn.
3. **Nhịp trải nghiệm:** dùng charcoal ở tiện ích và rêu ở ghé thăm; chọn lọc các câu viết tay; cân tốc độ và cường độ hiệu ứng để giữ cảm giác thư giãn.
4. **Hình ảnh:** thống nhất nhiệt độ màu ấm vừa, giữ xanh tự nhiên; điều chỉnh độ sáng theo chức năng ảnh, tránh làm mọi ảnh cùng vàng hoặc quá bão hòa.

## Phạm vi kiểm tra và bằng chứng

- Đã chụp 11 vùng nội dung trên hai kích thước và kiểm tra font thực tế tại hero, nội dung dẫn, chữ viết tay và tên nhóm menu.
- Bản chụp dùng hồ sơ trình duyệt riêng. Menu có thể hiển thị dữ liệu dự phòng khác dữ liệu localStorage trong trình duyệt đang dùng của chủ quán; báo cáo không đánh giá số lượng món hay tình trạng ảnh sản phẩm từ dữ liệu dự phòng đó.
- Ảnh chụp có thể ghi lại trạng thái giữa chuyển động, đặc biệt phần số liệu và chữ rõ dần. Không dùng giá trị đang đếm trong ảnh để kết luận dữ liệu kinh doanh sai.
- Không sửa HTML, CSS hoặc JavaScript của website trong lần đánh giá này.
- [Tổng quan desktop](contact-sheet-1440.jpg).
- [Tổng quan mobile](contact-sheet-390.jpg).
- [Số đo kiểu chữ và màu nền](measured-styles.json).
