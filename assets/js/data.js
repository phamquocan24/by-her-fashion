/* ==========================================================================
   BY HER — data.js
   Dữ liệu tĩnh của cửa hàng: ảnh, bảng màu, sản phẩm, liên hệ, mạng xã hội, cấu hình AR/VR.
   Muốn thêm/sửa sản phẩm: chỉnh file này (không đụng logic).
   Nguồn nội dung: "Yêu cầu chi tiết.pdf".
   ========================================================================== */

/* Khóa ảnh → đường dẫn file trong assets/images */
const IMG = {
  'bh01-vang': 'assets/images/products/bh01-co-vuong-tay-dai-vang.jpg',
  'bh01-trang': 'assets/images/products/bh01-co-vuong-tay-dai-trang.jpg',
  'bh01-do': 'assets/images/products/bh01-co-vuong-tay-dai-do.jpg',
  'bh01-den': 'assets/images/products/bh01-co-vuong-tay-dai-den.jpg',
  'bh02-trang': 'assets/images/products/bh02-ao-tron-basic-trang.jpg',
  'bh02-den': 'assets/images/products/bh02-ao-tron-basic-den.jpg',
  'bh02-do': 'assets/images/products/bh02-ao-tron-basic-do.jpg',
  'bh03-hong': 'assets/images/products/bh03-co-tim-hong.jpg',
  'bh03-do': 'assets/images/products/bh03-co-tim-do.jpg',
  'bh03-trang': 'assets/images/products/bh03-co-tim-trang.jpg',
  'bh03-den': 'assets/images/products/bh03-co-tim-den.jpg',
  'size': 'assets/images/brand/bang-size.jpg',
  'package': 'assets/images/brand/bao-bi.jpg',
  'policy': 'assets/images/brand/chinh-sach-khach-hang.jpg',
  'care': 'assets/images/brand/huong-dan-bao-quan.jpg',
  'logo': 'assets/images/brand/logo.png',
  'hero-logo': 'assets/images/brand/hero-logo.png',
  'fb1': 'assets/images/feedback/fb-01-minh-anh.jpg',
  'fb2': 'assets/images/feedback/fb-02-ngoc-linh.jpg',
  'fb3': 'assets/images/feedback/fb-03-thu-ha.jpg',
  'fb4': 'assets/images/feedback/fb-04-khanh-vy.jpg',
  'fb5': 'assets/images/feedback/fb-05-phuong-anh.jpg',
  'fb6': 'assets/images/feedback/fb-06-bao-chau.jpg'
};

const COLORS = {
  pink: { name: 'Hồng', hex: '#eeb7c2' },
  yellow: { name: 'Vàng', hex: '#f3e2a0' },
  white: { name: 'Trắng', hex: '#f8f7f3' },
  red: { name: 'Đỏ', hex: '#a63c49' },
  black: { name: 'Đen', hex: '#292627' }
};

const products = [
  {
    id: 'BH01',
    name: 'Áo cổ vuông tay dài',
    price: 129000,
    colors: ['yellow', 'white', 'red', 'black'],
    images: { yellow: ['bh01-vang'], white: ['bh01-trang'], red: ['bh01-do'], black: ['bh01-den'] },
    note: 'Ảnh sản phẩm lấy từ tài liệu BY HER.'
  },
  {
    id: 'BH02',
    name: 'Áo trơn basic',
    price: 109000,
    colors: ['white', 'black', 'red'],
    images: { white: ['bh02-trang'], black: ['bh02-den'], red: ['bh02-do'] },
    note: 'Ảnh sản phẩm lấy từ tài liệu BY HER.'
  },
  {
    id: 'BH03',
    name: 'Áo cổ tim',
    price: 119000,
    colors: ['pink', 'red', 'white', 'black'],
    images: { pink: ['bh03-hong'], red: ['bh03-do'], white: ['bh03-trang'], black: ['bh03-den'] },
    note: 'Ảnh sản phẩm lấy từ tài liệu BY HER.'
  }
];

/* Khoảng giá cho bộ lọc (min ≤ giá < max) */
const PRICE_RANGES = {
  low: { min: 0, max: 110000 },
  mid: { min: 110000, max: 120000 },
  high: { min: 120000, max: Infinity }
};

/* Mạng xã hội ở chân trang — THAY bằng link trang chính thức của BY HER khi có */
const SOCIAL = [
  { name: 'Facebook', url: 'https://www.facebook.com/', icon: 'facebook' },
  { name: 'Instagram', url: 'https://www.instagram.com/', icon: 'instagram' },
  { name: 'TikTok', url: 'https://www.tiktok.com/', icon: 'tiktok' }
];

/* ---- AR Code (https://ar-code.com) ----
   links: dán link AR Code (mô hình 3D / WebAR) của từng sản phẩm vào đây sau khi tạo trên nền tảng.
          Để trống '' → mã QR sẽ trỏ tới phòng thử áo AR của chính website (cần website chạy HTTPS).
   qrService: dịch vụ tạo ảnh QR từ link (chỉ gửi URL công khai, không gửi dữ liệu người dùng). */
const AR_CODE = {
  links: { BH01: '', BH02: '', BH03: '' },
  qrService: 'https://api.qrserver.com/v1/create-qr-code/',
  platformUrl: 'https://ar-code.com/vi'
};

/* ---- VR (WebXR qua A-Frame) ---- */
const VR_LIB_URL = 'https://aframe.io/releases/1.5.0/aframe.min.js';

/* ---- Ảnh áo thật tách nền (PNG trong suốt) dùng cho Phòng thử đồ AR & AI Virtual Try-On ---- */
const GARMENT_PNG = {
  BH01: {
    yellow: 'assets/images/garments/bh01-yellow.png',
    white: 'assets/images/garments/bh01-white.png',
    red: 'assets/images/garments/bh01-red.png',
    black: 'assets/images/garments/bh01-black.png'
  },
  BH02: {
    white: 'assets/images/garments/bh02-white.png',
    black: 'assets/images/garments/bh02-black.png',
    red: 'assets/images/garments/bh02-red.png'
  },
  BH03: {
    pink: 'assets/images/garments/bh03-pink.png',
    red: 'assets/images/garments/bh03-red.png',
    white: 'assets/images/garments/bh03-white.png',
    black: 'assets/images/garments/bh03-black.png'
  }
};

/* ---- Thử đồ (theo AR_AI_Virtual_TryOn_Ecommerce_README.md) ----
   tryon.category: loại trang phục (top). garments: ảnh áo PNG tách nền từng màu. */
products.forEach(p => { p.tryon = { enabled: true, category: 'top', model3d: '', garments: GARMENT_PNG[p.id] || {} }; });

/* Nhận dạng dáng người (MediaPipe Pose Landmarker, chạy trong trình duyệt, Apache-2.0).
   Muốn chạy offline: tải bundle + wasm + model về assets/vendor/ và đổi URL (cần phục vụ qua http). */
const POSE_CFG = {
  bundle: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs',
  wasm: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
  model: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
};

/* AI Try-On ảnh thật (Chế độ 2 · Beta).
   - Mặc định trỏ tới '/api/tryon' (server.js / server.py đi kèm dự án).
   - Nếu chạy web tĩnh không bật backend, tryon-ai.js tự động chuyển sang bộ ghép AI cục bộ (Local Smart VTON)
     để khách hàng & chủ shop luôn trải nghiệm được trọn vẹn luồng sinh ảnh thử đồ từ đầu đến cuối. */
const TRYON_API = { endpoint: '/api/tryon', fallbackEndpoint: 'http://localhost:8080/api/tryon', timeoutMs: 90000 };

/* Bảng size BY HER (ảnh bang-size.jpg): chiều cao cm, cân nặng kg tối đa */
const SIZE_CHART = [
  { size: 'S', hMax: 160, wMax: 52 },
  { size: 'M', hMax: 170, wMax: 65 },
  { size: 'L', hMax: 180, wMax: 78 }
];

/* Đánh giá thực tế từ khách hàng (giữ nguyên văn nội dung nhận xét, đa dạng nghề nghiệp/tệp khách hàng) */
const FEEDBACKS = [
  {
    avatar: 'fb1',
    stars: '★★★★★',
    quote: '“Áo thun basic trơn mặc rất thoải mái, form vừa vặn, chất vải dễ chịu. Mình có thể phối với quần jeans hay chân váy đều đẹp.”',
    author: '— Minh Anh • Sinh viên Đại học'
  },
  {
    avatar: 'fb2',
    stars: '★★★★★',
    quote: '“Áo croptop basic có kiểu dáng trẻ trung, dễ phối đồ. Mặc đi chơi hay đi cà phê đều xinh, đúng phong cách mình thích.”',
    author: '— Ngọc Linh • Content Creator'
  },
  {
    avatar: 'fb3',
    stars: '★★★★★',
    quote: '“Áo ôm body co giãn tốt, mặc lên tôn dáng nhưng vẫn thoải mái khi vận động. Mình khá hài lòng với sản phẩm.”',
    author: '— Thu Hà • Chuyên viên Marketing'
  },
  {
    avatar: 'fb4',
    stars: '★★★★★',
    quote: '“Áo cổ vuông có thiết kế nữ tính, nhìn đơn giản nhưng vẫn rất cuốn hút. Mình thích nhất là có thể phối với nhiều kiểu chân váy khác nhau.”',
    author: '— Khánh Vy • Graphic Designer'
  },
  {
    avatar: 'fb5',
    stars: '★★★★★',
    quote: '“Áo thun form rộng mặc thoải mái, năng động. Form áo rộng vừa phải, phù hợp để mặc hằng ngày hoặc phối theo phong cách casual.”',
    author: '— Phương Anh • Nhân viên văn phòng'
  },
  {
    avatar: 'fb6',
    stars: '★★★★★',
    quote: '“Áo cổ tim có gam màu nhẹ nhàng, chất vải mềm mịn và thoáng mát. Mặc đi dạo phố hay chụp ảnh ngoài trời đều rất tôn dáng và thanh lịch.”',
    author: '— Bảo Châu • Freelancer / Stylist'
  }
];

/* ==========================================================================
   KHO KIẾN THỨC CỦA TRỢ LÝ ẢO (assistant.js đọc từ đây)
   Nguồn: ảnh "Chính sách khách hàng", "Hướng dẫn bảo quản", "Bảng size" và "Yêu cầu chi tiết.pdf".
   Sửa nội dung trả lời của trợ lý = sửa tại đây, KHÔNG cần sửa logic.
   ========================================================================== */
const SHOP_INFO = {
  phone: '0354 605 263',
  tel: '0354605263',
  email: 'byher@gmail.com',
  material: '56% Cotton, 38% Modal, 6% Elastane',
  stretch: 'Co giãn linh hoạt, tạo cảm giác thoải mái khi vận động.',
  exchange: [
    'Đổi hàng nguyên giá 1 lần trong 30 ngày.',
    'Quý khách vui lòng hỗ trợ 45.000₫ chi phí vận chuyển 2 chiều.',
    'Sản phẩm lỗi sau khi nhận hàng: BY HER chịu phí đổi hàng 2 chiều.',
    'Sản phẩm đổi còn nguyên tag, mác, chưa qua giặt sấy.'
  ],
  returns: [
    'Linh hoạt trả hàng không lý do trong vòng 05 ngày.',
    'Hoàn tiền nhanh chóng trong vòng 07 ngày.'
  ],
  policyNotes: [
    'Không hỗ trợ đổi với quần lót, phụ kiện, sản phẩm giảm giá hoặc sale quá 30%.',
    'Áp dụng 01 ưu đãi duy nhất trên mỗi đơn hàng.',
    'Đơn hàng online vui lòng quay video quá trình mở hàng để được hỗ trợ nhanh nhất khi thiếu hàng hoặc lỗi sản phẩm.'
  ],
  care: [
    'Ưu tiên giặt tay với nước ở nhiệt độ thường dưới 30°C.',
    'Chọn chế độ giặt nhẹ đối với vải mềm, tránh vắt mạnh.',
    'Sử dụng túi giặt nếu giặt máy.',
    'Giặt riêng đồ sáng và tối màu, không dùng chất tẩy mạnh.',
    'Phơi ở nơi thoáng mát, tránh nắng gắt trực tiếp.',
    'Không sấy, là ủi ở nhiệt độ cao.',
    'Tránh gấp đồ cúp áo với áo lót có form hoặc mút.'
  ],
  payment: [
    'Thanh toán khi nhận hàng (COD).',
    'Chuyển khoản ngân hàng (BY HER xác nhận thông tin chuyển khoản sau khi nhận đơn).'
  ],
  shipping: 'Phí vận chuyển và thời gian giao hàng được BY HER xác nhận khi chốt đơn (tùy khu vực nhận hàng).',
  orderSteps: [
    'Chọn mẫu áo, màu sắc và size.',
    'Bấm "Thêm vào giỏ hàng" hoặc "Mua ngay".',
    'Nhập họ tên, số điện thoại, địa chỉ nhận hàng.',
    'Chọn phương thức thanh toán và xác nhận đơn.',
    'BY HER xác nhận đơn, đóng gói và bàn giao cho đơn vị vận chuyển.'
  ]
};

/* Gợi ý phối đồ cho từng mẫu (nội dung tư vấn — chỉnh theo định hướng của shop) */
const STYLE_TIPS = {
  BH01: 'Cổ vuông giúp khoe xương quai xanh, tay dài hợp ngày se lạnh. Phối cùng chân váy ngắn, chân váy midi hoặc quần jeans ống rộng — đi học, đi làm, đi chơi đều xinh.',
  BH02: 'Dáng trơn basic dễ phối nhất: quần jeans, chân váy, quần short hoặc khoác thêm cardigan/blazer. Hợp mặc hằng ngày theo phong cách casual.',
  BH03: 'Cổ tim giúp phần cổ trông thon dài, gương mặt thanh thoát hơn. Phối với quần jeans cạp cao hoặc chân váy midi để đi làm, đi cà phê.'
};

/* Trợ lý dùng AI (LLM) — TÙY CHỌN. Để trống = trợ lý chạy hoàn toàn bằng kho kiến thức ở trên (nhanh, miễn phí, riêng tư).
   Khi có backend: POST {message, history, knowledge} → {reply}. KHÔNG đặt API key ở frontend. Xem docs/ASSISTANT.md */
const ASSISTANT_API = { endpoint: '', timeoutMs: 20000 };
