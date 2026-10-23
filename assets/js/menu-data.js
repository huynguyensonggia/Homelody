/* HOMELODY — dữ liệu DỰ PHÒNG
 * Chỉ được dùng khi:
 *   - chưa điền Supabase trong config.js, hoặc
 *   - không kết nối được Supabase (mất mạng, dự án bị tạm dừng...).
 * Khi đã dùng trang /admin, KHÔNG cần sửa file này nữa.
 *
 * Trường của mỗi món:
 *   name, category, price (VND), description, note (ghi chú hương vị),
 *   ingredients (danh sách), image (ảnh ly nền trong suốt, đáy ly = mép dưới ảnh),
 *   alt (mô tả ảnh), featured (true = hiện ở đầu trang)
 */
window.HOMELODY_FALLBACK = {
  drinks: [
    {
      name: 'Matcha Latte',
      category: 'Trà',
      price: 55000,
      description: 'Matcha thanh nhẹ, quyện cùng sữa tươi béo dịu.',
      note: 'Thanh nhẹ · Béo dịu · Hậu trà',
      ingredients: ['Bột matcha', 'Sữa tươi', 'Đá viên'],
      image: 'assets/images/drink-matcha-latte.webp',
      alt: 'Ly Matcha Latte đá',
      featured: true
    },
    {
      name: 'Bạc xỉu',
      category: 'Cà phê Việt',
      price: 45000,
      description: 'Sữa béo dịu, điểm chút cà phê đậm thơm.',
      note: 'Ngọt dịu · Thơm cà phê',
      ingredients: ['Cà phê phin', 'Sữa đặc', 'Sữa tươi', 'Đá viên'],
      image: 'assets/images/drink-iced-latte.webp',
      alt: 'Ly Bạc xỉu đá (ảnh tạm)',
      featured: true
    },
    {
      name: 'Cà phê sữa đá',
      category: 'Cà phê Việt',
      price: 39000,
      description: 'Cà phê đậm vị, sữa đặc ngọt vừa, thêm đá mát lành.',
      note: 'Đậm đà · Ngọt béo',
      ingredients: ['Cà phê phin', 'Sữa đặc', 'Đá viên'],
      image: '',
      alt: 'Ảnh Cà phê sữa đá đang chờ bổ sung',
      featured: true
    },
    {
      name: 'Cold brew cam',
      category: 'Cà phê Việt',
      price: 55000,
      description: 'Cà phê ủ lạnh kết hợp vị cam tươi sáng.',
      note: 'Êm dịu · Tươi mát · Hương cam',
      ingredients: ['Cà phê ủ lạnh (cold brew)', 'Nước cam tươi', 'Lát cam', 'Đá viên'],
      image: '',
      alt: 'Ảnh Cold brew cam đang chờ bổ sung',
      featured: true
    }
  ],

  // Thông tin quán — để trống thì web hiện [chỗ trống] và nút Chỉ đường/Liên hệ chưa bấm được
  shop: {
    address: '100 Lý thường kiệt, Hội An, Thành Phố Đà Nẵng',
    hours: 'Hằng ngày · 6:30 – 22:00',
    phone: '0773 558 945',
    directionsUrl: '',   // trống → tự tạo link Google Maps từ địa chỉ
    contactUrl: '',      // trống → gọi điện (tel:). Có thể dán link Zalo: https://zalo.me/09xxxxxxxx
    social: { Instagram: '', Facebook: '', TikTok: '' }
  }
};
