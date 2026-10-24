/* HOMELODY — cấu hình kết nối menu động (Supabase)
 *
 * Để TRỐNG hai dòng dưới  → web dùng dữ liệu mẫu trong menu-data.js,
 *                            trang /admin chạy ở "chế độ xem thử" (lưu trên trình duyệt).
 * Điền đủ hai dòng dưới    → web đọc món và thông tin quán từ Supabase,
 *                            chủ quán sửa trực tiếp tại /admin.
 *
 * Lấy ở: Supabase Dashboard → Project Settings → API (Data API / API Keys)
 *   supabaseUrl: "Project URL", dạng https://xxxx.supabase.co
 *   supabaseKey: "Publishable key" (sb_publishable_...) hoặc "anon public" key.
 * Hai giá trị này được phép công khai. TUYỆT ĐỐI không dán "secret" / "service_role" key vào đây.
 */
window.HOMELODY_CONFIG = {
  supabaseUrl: 'https://qtoiphhaxmqkuggsiidy.supabase.co',
  supabaseKey: 'sb_publishable_nRz6yKlHQhGYNx3SrNdL8g_mMJzFLWL',

  // Tên bucket lưu ảnh món (tạo sẵn bởi supabase/setup.sql)
  imageBucket: 'menu-images',

  // Số món tối đa hiện ở phần "Món được yêu thích" đầu trang
  maxFeatured: 6,

  // Điền số liệu đã xác nhận. null hiển thị dấu gạch, không tự tạo số liệu.
  statistics: {
    reviewCount: 265,
    rating: 4.7,
    menuCount: 60,
    foundedYear: 2024
  },

  // Đánh giá do chủ quán cung cấp. Điểm theo từng tiêu chí, không suy ra điểm tổng.
  customerReviews: [
    {
      name: 'Matt Allen',
      text: 'Ordered delicious coconut coffee and iced americano each morning while in Hoi An. Delivered on Grab. Highly recommend',
      sourceUrl: 'https://www.google.com/maps/contrib/110531273930218661003/reviews?hl=vi',
      scores: { food: 5, service: 5 }
    },
    {
      name: 'Bạch Thành Nhân',
      text: 'quán đẹp view không có điểm nào chê, mọi nhân viên đều dễ thương và nhiệt tình, một không gian ấm áp, cảm ơn những lần đã cùng nhau, cảm ơn tất cả và hẹn gặp lại Homelody🫶',
      sourceUrl: 'https://www.google.com/maps/contrib/115593067867393173805/reviews?hl=vi',
      scores: { food: 5, service: 5, atmosphere: 5 }
    },
    {
      name: 'GOLA GLAVA',
      text: 'Cute yard with fish pond and plants. Delicious coffee and decent cheesecake.',
      sourceUrl: 'https://www.google.com/maps/contrib/118062777312361878479/reviews?hl=vi',
      scores: { food: 5, service: 5, atmosphere: 5 }
    },
    {
      name: 'StableKat',
      text: 'Great hot and iced egg coffee.',
      sourceUrl: 'https://www.google.com/maps/contrib/115407456281684241047/reviews?hl=vi'
    },
    {
      name: 'CJ',
      text: "Visited Hoi An with my friends and stopped by this cafe for refreshments and I couldn't recommend more! I had ordered the blueberry smoothie which was delicious, and their tiramisu is to die for! The atmosphere was lovely, air conditioned inside and out, and a beautiful fish pond to addsoem ambiance as you enjoy your drinks. Loved this place so much we even ordered a takeaway before we caught our flight! Highly recommended to anyone visiting Hoi An!",
      sourceUrl: 'https://www.google.com/maps/contrib/118127512276955360564/reviews?hl=vi',
      scores: { food: 5, service: 5, atmosphere: 5 }
    },
    {
      name: 'Đs Hthi',
      text: 'nước khá là ngon, giá hợp lý, view quán cây cối thoáng mát. Nhân viên nhiệt tình, có cơ hội sẽ quay lại thử nhiều món khác.',
      sourceUrl: 'https://www.google.com/maps/contrib/113809990929392249164/reviews?hl=vi',
      scores: { food: 5, service: 5, atmosphere: 5 }
    },
    {
      name: 'Đồng Võ',
      text: 'quán thoáng mát nhân viên dễ thương gọi là có mặt , nhiệt tình đồ uống ngon bánh phô mai rất thơm và béo',
      sourceUrl: 'https://www.google.com/maps/contrib/115460140153735835113/reviews?hl=vi',
      scores: { food: 5, service: 5, atmosphere: 5 }
    },
    {
      name: 'Tĩnh Võ',
      text: 'đồ uống ngon thu ngân dễ thương phục vụ nhiệt tình',
      sourceUrl: 'https://www.google.com/maps/contrib/100614704773026420719/reviews?hl=vi',
      scores: { food: 5, service: 5, atmosphere: 5 }
    },
    {
      name: 'Trang Thùy',
      text: 'nv dth nhiệt tình đồ ăn ngon rất nên quay lại',
      sourceUrl: 'https://www.google.com/maps/contrib/103715241221373357133/reviews?hl=vi',
      scores: { food: 5, service: 5, atmosphere: 5 }
    },
    {
      name: 'Imene Doudou',
      text: "First came there because it was near my airbnb and lasted to come once in the morning and once late in the evening lmaooo. Maybe one of my top 3 coffee shop I ever tried (around the world). I've tried the egg coffee : sweet and not tiresome. I've also tried the tiramisu coffee (good one too). Not expensive and very local. The old quarter was making me overwhelmed, so I escaped to this coffee shop. 10000/10. The staff was very sweet and adorable too <33 Love y'all :)",
      sourceUrl: 'https://www.google.com/maps/contrib/104147455020854140811/reviews?hl=vi',
      scores: { food: 5, service: 5, atmosphere: 5 }
    },
    {
      name: 'J Fox',
      text: 'Quiet cafe with scenic pond and good drinks. Had amazing iced egg coffee, iced salt coffee and Brazilian pão de queijo (cheese bread).',
      sourceUrl: 'https://www.google.com/maps/contrib/115443167429161782393/reviews?hl=vi',
      scores: { food: 5, service: 4, atmosphere: 4 }
    },
    {
      name: 'Mai Lan',
      text: 'Cộng một quán coffee yêu thích.. 🫶🏻',
      sourceUrl: 'https://www.google.com/maps/contrib/116395388112415340662/reviews?hl=vi',
      scores: { food: 5, service: 5, atmosphere: 5 }
    }
  ],

  // Nguồn duy nhất cho các liên kết công khai. URL thiếu được giữ trống.
  links: {
    ZALO_URL: 'https://zalo.me/0935983263',
    GRABFOOD_URL: '', // TODO: URL trang quán trên GrabFood.
    SHOPEEFOOD_URL: '', // TODO: URL trang quán trên ShopeeFood.
    MAPS_URL: 'https://www.google.com/maps/place/Homelody+Coffee+%26+Brunch+Hoi+An/@15.8815697,108.3379925,17z/data=!3m1!4b1!4m6!3m5!1s0x31420d9a44676551:0x8cc83eb21a505ba7!8m2!3d15.8815697!4d108.3379925!16s%2Fg%2F11wj47gg6n?hl=vi',
    PHONE: 'tel:0773558945',
    FACEBOOK_URL: 'https://www.facebook.com/Homelody.coffee',
    INSTAGRAM_URL: 'https://www.instagram.com/homelody.coffee/',
    TIKTOK_URL: 'https://www.tiktok.com/@homelodycoffee.hoian'
  },
  // TODO: Tài liệu menu xác nhận chưa có brunch mặn; không tự tạo món/giá.
  // TODO: Đối chiếu tên "bánh" trong dữ liệu cũ với ảnh trước khi gán loại bánh cụ thể.
  productDisplayOverrides: {},
  menuCategories: [
    { name: 'Cà phê Việt', en: 'Vietnamese Coffee', aliases: ['Cà phê', 'Coffee', 'Cà Phê Việt (Vietnamese Coffee)'] },
    { name: 'Bánh ngọt & tráng miệng', en: 'Pastries & Desserts', aliases: ['Bánh', 'Bánh ngọt', 'Bánh Mì Ngọt (Pastries)', 'Bánh Ngọt & Tráng Miệng (Cakes & Desserts)', 'Bánh Ngọt & Tráng Miệng (Pastries & Desserts)'] },
    { name: 'Dừa', en: 'Coco & More', aliases: ['Coco & More', 'Dừa (Coco & More)'] },
    { name: 'Cà phê Ý', en: 'Italian Coffee', aliases: ['Cà phê máy', 'Espresso', 'Cà Phê Ý (Italian Coffee)'] },
    { name: 'Trà', en: 'Tea', aliases: ['Trà & Matcha', 'Tea', 'Trà (Tea)'] },
    { name: 'Nước ép', en: 'Fruit Juice', aliases: ['Nước Ép (Fruit Juice)'] },
    { name: 'Đá xay', en: 'Ice Blended', aliases: ['Đá Xay (Ice Blended)'] },
    { name: 'Thêm', en: 'Extras', aliases: ['Extras', 'Thêm (Extras)'] },
    { name: 'Sinh tố', en: 'Smoothie' },
    { name: 'Brunch', en: 'Brunch' }
  ]
};
