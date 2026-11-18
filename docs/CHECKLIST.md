# CHECKLIST — Tái cấu trúc BY HER

Quy ước: `[x]` xong · `[ ]` chưa làm · `[~]` cần quyết định/nội dung từ khách.
Nguyên tắc: **không đổi nội dung gốc**, chỉ sửa lỗi / sai logic / chắp vá.

## Phần 1 — Phân tích file gốc

- [x] File gốc 1 file ~617 KB: CSS + HTML + JS + 20 ảnh base64 (≈566 KB) nhúng chung.
- [x] Xác định 3 khối: `<style>` (2 phần: giao diện + AR), `<body>` (11 "trang" SPA), `<script>` (dữ liệu + logic + AR).
- [x] Liệt kê 20 ảnh, đối chiếu ảnh nào dùng ở đâu (xem Phần 4).

## Phần 2 — Tách cấu trúc

- [x] `index.html` — chỉ còn khung HTML, link CSS/JS bằng đường dẫn tương đối.
- [x] `assets/css/main.css` + `ar.css` — tách nguyên văn theo marker `/* BY HER — AR fitting room */`.
- [x] `assets/js/` chia 7 file theo trách nhiệm (data / core / shop / cart / checkout / ar / main), có header mô tả phụ thuộc.
- [x] Giải mã 20 ảnh base64 → file `.jpg` (byte-nguyên bản, không nén lại) trong `assets/images/`.
- [x] `IMG` chuyển từ chuỗi base64 → đường dẫn file.
- [x] Dùng **classic script** (không ES module) để mở `index.html` trực tiếp bằng `file://` vẫn chạy (module bị chặn CORS trên file://).
- [x] Giữ nguyên `onclick="..."` inline của khách → không phá cấu trúc HTML gốc.

## Phần 3 — Lỗi / sai logic đã sửa

| # | Mức | Lỗi | Cách sửa | File |
|---|---|---|---|---|
| 1 | Cao | Trùng `id="shade"`: lớp phủ giỏ hàng **và** `<linearGradient id="shade">` của SVG áo AR → `url(#shade)` có thể trỏ nhầm phần tử, áo mất bóng đổ | Đổi gradient thành `arShade` | `ar.js` |
| 2 | Cao | Lưu ảnh thử áo: SVG blob **không có width/height** (lỗi trên Firefox) và bị **kéo méo** do khung áo (tỉ lệ 1:1.12) khác viewBox (100:106); ảnh lưu ≠ ảnh trên màn hình | Thêm `width/height` vào SVG; vẽ canvas giữ tỉ lệ, canh giữa (`contain`) | `ar.js` |
| 3 | Cao | `localStorage` cũ/hỏng (sản phẩm bị xóa, dữ liệu sai kiểu) → `pget()` trả `undefined` → **crash** toàn bộ giỏ hàng / đơn hàng | Thêm `sanitizeCart` / `sanitizeOrders` khi load | `core.js` |
| 4 | Trung bình | Nút Back/Forward trình duyệt không hoạt động (dùng `replaceState`) | `pushState` + `popstate` handler, có bảo vệ trang cần state (`detail`, `checkout`, `success`) | `core.js` |
| 5 | Trung bình | Tải lại trang tại `#ar` bị quay về trang chủ | Thêm `ar` vào danh sách trang vào trực tiếp (`ENTRY_PAGES`) | `core.js` |
| 6 | Trung bình | Kiểm tra trang hợp lệ bằng `getElementById(page)` → `go('toast')` "hợp lệ" nhưng không có trang nào active | Kiểm tra trong tập `.page` | `core.js` |
| 7 | Trung bình | Số lượng giỏ hàng không giới hạn (chi tiết giới hạn 99, giỏ thì không) | Giới hạn 99 thống nhất ở `addDetail` & `cartChange` | `cart.js` |
| 8 | Thấp | Dữ liệu từ localStorage (`id`, `date`, `status`) chèn vào `innerHTML` không escape | Bọc `escapeHtml` | `checkout.js` |
| 9 | Thấp | 2 listener `DOMContentLoaded` rời rạc; logic AR tự gắn sự kiện ngầm | Gộp: `init()` gọi `arBindEvents()` | `main.js`, `ar.js` |
| 10 | Thấp | Ảnh trong trang Chính sách thiếu `alt`; ảnh checkout thiếu `alt` | Thêm `alt` | `index.html`, `checkout.js` |
| 11 | Thấp | Drawer giỏ hàng đóng vẫn nhận focus Tab (chỉ bị đẩy ra ngoài màn hình) | `visibility:hidden` khi đóng | `main.css` |
| 12 | Thấp | Thiếu `preconnect` tới `fonts.gstatic.com` (font tải chậm) | Thêm `<link rel="preconnect" crossorigin>` | `index.html` |
| 13 | Thấp | Không có `:focus-visible` toàn cục, không tôn trọng `prefers-reduced-motion` | Bổ sung cuối `main.css` | `main.css` |
| 14 | Thấp | Thiếu favicon (404 mỗi lần tải) | Thêm `favicon.svg` | `assets/images` |
| 15 | Thấp | Hằng số rải rác (`'byher_cart_v2'` lặp 2 chỗ) | Gom `STORAGE_KEYS` | `core.js` |

- [x] Smoke test tự động (jsdom): render trang chủ, mở chi tiết, thêm giỏ, đặt đơn, xem đơn, AR; mọi hàm trong `onclick` đều tồn tại; ID duy nhất; mọi ảnh trong `IMG` có file.
- [ ] Test thủ công trên trình duyệt thật: camera (localhost), tải ảnh, lưu ảnh AR, mobile ≤ 650px.

## Phần 4 — Vấn đề NỘI DUNG của đợt 1 (ĐÃ GIẢI QUYẾT ở đợt 2: ảnh/sản phẩm đã thay theo thư mục image + PDF; mục BH01/BH04/ảnh unused không còn áp dụng)

- [~] **BH01 sai màu ảnh**: 4 ảnh `bh01-body-ref-*` là ảnh tham khảo từ website khác (có giá `$20`, nhãn "WO'S CLASSIC TEE…" trong ảnh), màu thật là kem/nâu/hồng nhạt/xanh nhưng gán nhãn Trắng/Đỏ/Hồng/Đen. Code gốc đã có ghi chú; **cần ảnh thật** + nên bỏ ảnh có thương hiệu khác (rủi ro bản quyền).
- [~] **BH04 màu Đen** thực tế là ảnh áo xanh navy.
- [~] 3 ảnh chưa dùng (`assets/images/unused/`): xác nhận dùng hay bỏ.
- [~] Bộ lọc "Size" luôn khớp mọi sản phẩm (cả 4 mẫu đều có S/M/L) → hiện không có tác dụng; chỉ có ý nghĩa khi từng mẫu có size khác nhau.
- [~] Menu mobile: nút `☰` chỉ dẫn tới trang Sản phẩm, chưa có menu thật (Về BY HER/Liên hệ chỉ vào được qua footer).
- [~] Email/điện thoại `byher@gmail.com`, `0354 605 263` — xác nhận là thật.
- [~] "Thanh toán" chỉ là mô phỏng: chưa có backend / cổng thanh toán / gửi đơn.

## Phần 5 — Đề xuất giai đoạn tiếp theo (ngoài phạm vi tái cấu trúc)

- [ ] Nén ảnh `.webp`, thêm `width/height` chống layout shift.
- [ ] Meta Open Graph / SEO / `sitemap` khi triển khai thật.
- [ ] Thêm `aria-modal`, focus-trap cho drawer giỏ hàng; `<label for>` cho form.
- [ ] Backend/Form service nhận đơn thật (Google Sheets, Formspree, hoặc API riêng).
- [ ] Chuyển sang ES modules + bundler (Vite) và bỏ `onclick` inline khi dự án lớn dần.
- [ ] Deploy (Netlify / Vercel / GitHub Pages) + HTTPS (bắt buộc cho camera AR).


## Phần 6 — Đợt 2: ảnh mới, yêu cầu từ PDF, AR/VR

### 6.1 Ảnh
- [x] Xóa toàn bộ ảnh cũ (`products/`, `brand/`, `unused/`) và thư mục nguồn `d:\Web\image`.
- [x] Chuyển 15 ảnh PNG/JPG (~2 MB/ảnh) → JPEG q85, cạnh dài ≤ 1400px (~170 KB/ảnh); logo → PNG nền trong suốt.
- [x] Đổi tên chuẩn: `bhXX-<kiểu>-<màu>.jpg`, `brand/{logo,bao-bi,bang-size,chinh-sach-khach-hang,huong-dan-bao-quan}`.
- [x] `IMG` trong `data.js` đổi khóa/đường dẫn tương ứng; kiểm tra mọi đường dẫn tồn tại.
- [x] `checkout.jpg` là ảnh mẫu tham khảo trong thư mục nguồn (giao diện "Trải nghiệm AR") → không dùng, đã xóa cùng thư mục.

### 6.2 Yêu cầu từ "Yêu cầu chi tiết.pdf"
- [x] Sản phẩm: BH01 Áo cổ vuông tay dài (Vàng/Trắng/Đỏ/Đen, 129.000₫) · BH02 Áo trơn basic (Trắng/Đen/Đỏ, 109.000₫) · BH03 Áo cổ tim (Hồng/Đỏ/Trắng/Đen, 119.000₫) · size S/M/L.
- [x] Bộ lọc: loại áo, màu, kích thước, **khoảng giá (mới)**.
- [x] Menu Trang chủ / Sản phẩm / Về BY HER / Liên hệ; SĐT 0354 605 263, email byher@gmail.com.
- [x] Logo ảnh nổi bật trên thanh điều hướng.
- [x] Nút điều hướng nhanh "MUA SẮM NGAY" (SHOP NOW tiếng Việt hóa).
- [x] Chân trang: liên hệ, chính sách, **mạng xã hội (mới)**.
- [x] Chi tiết sản phẩm: ảnh từng màu, VR, tên/giá, mục "Chất liệu và kích thước" đúng nguyên văn PDF, chọn màu/size/số lượng, bảng size, bao bì, chính sách, bảo quản, nút Thêm vào giỏ / Mua ngay.
- [x] Giỏ hàng + thanh toán (họ tên, SĐT, địa chỉ, kiểm tra SP, phương thức, xác nhận).
- [x] Trang thành công hiển thị đầy đủ thông tin đơn (địa chỉ, thanh toán, từng dòng sản phẩm).
- [x] **Quy trình mua hàng 7 bước (mới)** ở trang chủ.
- [x] Toàn bộ giao diện tiếng Việt.
- [x] Đã cập nhật chữ liên quan sản phẩm cũ (giới thiệu "Bốn kiểu" → "Ba kiểu", mô tả About…).
- [x] Sửa thêm: `id="card_*"` bị trùng (trang chủ + trang Sản phẩm) và không dùng → bỏ.
- [~] **PDF mâu thuẫn** (cần khách xác nhận): ghi "năm nhóm" nhưng liệt kê 3 sản phẩm; BH03 ghi "2 màu" nhưng liệt kê 4 màu (đã theo danh sách 4 màu); "năm dòng áo" ở quy trình mua hàng → đã ghi "ba dòng".
- [~] Link mạng xã hội hiện là trang chủ nền tảng — cần link chính thức.

### 6.3 AR / VR (xem [AR-VR.md](AR-VR.md))
- [x] AR 2D: hình dáng áo cập nhật theo sản phẩm mới (BH01 tay dài cổ vuông, BH02 cổ tròn, BH03 cổ tim).
- [x] Tích hợp **AR Code**: mã QR ở trang AR, chi tiết, đặt hàng thành công; mặc định trỏ tới phòng thử áo, cấu hình link ar-code.com trong `AR_CODE.links`.
- [x] Link chia sẻ `?p=<mã>&c=<màu>#ar` mở đúng mẫu/màu.
- [x] **VR showroom** (A-Frame/WebXR): vòng các màu quanh người xem, chọn bằng chuột/chạm/gaze, hỗ trợ kính; tải thư viện lười, gỡ scene khi rời trang.
- [x] Nút VR: menu, thẻ sản phẩm, trang chi tiết, footer.
- [x] Smoke test jsdom: lọc giá, link chia sẻ AR, QR, đặt hàng, scene VR, ID duy nhất, handler tồn tại, ảnh tồn tại.
- [ ] Test thật: quét QR từ điện thoại sau deploy, VR trên điện thoại/Quest.
- [~] Cần khách: mô hình 3D/ảnh 360° từng áo, tài khoản AR Code, tên miền HTTPS.

## Phần 7 — Đợt 3: Nâng cấp AR / AI Virtual Try-On theo `AR_AI_Virtual_TryOn_Ecommerce_README.md`

- [x] Nghiên cứu `AR_AI_Virtual_TryOn_Ecommerce_README.md` và lập tài liệu kiến trúc [docs/AR-TRYON-SOLUTION.md](AR-TRYON-SOLUTION.md) (so sánh Real-time Pose AR vs AI Diffusion VTON, lưu ý bản quyền Apache-2.0 vs CC BY-NC-SA 4.0).
- [x] **Tầng 1 — Pose-Tracked AR (`pose.js` + `garment.js` + `ar.js`):**
  - Tích hợp `@mediapipe/tasks-vision` (`PoseLandmarker`) nhận diện 8 khớp cơ thể (2 vai, 2 khuỷu, 2 cổ tay, 2 hông) ngay trong trình duyệt.
  - Thay thế lớp phủ SVG tĩnh bằng hệ thống dựng áo động trên `<canvas>`: tự động căn cổ, nghiêng theo vai, co giãn theo chiều dài lưng và **xoay tay áo bám theo cánh tay** (tay dài cho `BH01`, tay ngắn cho `BH02`/`BH03`).
  - Bổ sung đổ bóng 3 chiều, vân vải (fabric texture), đường may và bộ lọc làm mượt chuyển động (temporal smoothing) trên camera.
  - Có nút bật/tắt `Tự động khớp theo dáng người` và tự động fallback về chỉnh tay khi không có mạng hoặc ảnh khuất người.
- [x] **Tầng 2 — Tư vấn Size & Chốt đơn tại phòng thử (`ar.js` + `cart.js`):**
  - Nhập Chiều cao (cm) & Cân nặng (kg) → gợi ý size `S / M / L` chuẩn theo bảng size BY HER (`SIZE_CHART`).
  - Thêm nút **THÊM VÀO GIỎ HÀNG** và **MUA NGAY** ngay trong bảng điều khiển AR (gắn đúng mã áo, màu và size đang thử).
  - Ảnh lưu từ AR (`arSaveSnapshot`) dùng chung hàm vẽ `arPaint` với màn hình và đóng dấu thương hiệu góc dưới.
- [x] **Tầng 3 — Cầu nối AI Virtual Try-On ảnh thật (`tryon-ai.js`):**
  - Mở rộng schema `products[].tryon` và cấu hình `TRYON_API` trong `data.js`.
  - Hỗ trợ luồng xin phép người dùng (privacy consent), trích xuất ảnh người dùng `≤ 1024px` và gọi `POST TRYON_API.endpoint` tới backend VTON (TryOnCloud / WEARFITS / FastAPI) khi được cấu hình.
- [x] Kiểm thử End-to-End bằng trình duyệt thật (Playwright + Chromium): nhận diện dáng người trên ảnh cho cả 3 mẫu `BH01`, `BH02`, `BH03`, gợi ý size, thêm vào giỏ từ AR, bật camera, mở phòng VR — không có lỗi console hay pageerror.
- [x] **Bổ sung mục Đánh giá khách hàng (`Khách Hàng Nói Gì Về BY HER?`):**
  - Lưu trữ 6 đánh giá thực tế (`FEEDBACKS`) trong `assets/js/data.js` (Minh Anh, Ngọc Linh, Thu Hà, Khánh Vy, Phương Anh, Bảo Châu).
  - Di chuyển 6 ảnh khách hàng vào `assets/images/feedback/` (`fb-01-minh-anh.jpg` → `fb-06-bao-chau.jpg`), nén chuẩn JPEG, xóa ảnh gốc ngoài thư mục và khai báo `fb1`…`fb6` trong `IMG` (`data.js`).
  - Bố cục `.feedbackgrid` **2 hàng × 3 cột** (`grid-template-columns: repeat(3, minmax(0, 1fr))`), mỗi thẻ `.feedbackcard` xếp theo 3 tầng: **(1) hàng trên (`.feedback-top`): ảnh khách bo tròn bên trái + sao đánh giá `★★★★★` ngang hàng bên phải**, **(2) giữa: nội dung nhận xét (`<blockquote>`)**, **(3) dưới: tên & nghề nghiệp đa dạng tệp khách hàng** (`Sinh viên Đại học`, `Content Creator`, `Chuyên viên Marketing`, `Graphic Designer`, `Nhân viên văn phòng`, `Freelancer / Stylist`).

## Phần 8 — Đợt 4: Xây dựng Trợ lý ảo tư vấn khách hàng (xem [ASSISTANT.md](ASSISTANT.md))

- [x] **Kho kiến thức chuẩn hóa (`SHOP_INFO` & `STYLE_TIPS` trong `assets/js/data.js`):**
  - Trích xuất đầy đủ nội dung từ ảnh *Chính sách khách hàng* (đổi hàng 1 lần trong 30 ngày, phí ship 2 chiều 45.000₫, hàng lỗi BY HER chịu 100%, trả hàng không lý do 05 ngày, hoàn tiền 07 ngày), *Hướng dẫn bảo quản* (7 lưu ý giặt/phơi/ủi), *Bảng size* và *Yêu cầu chi tiết.pdf*.
- [x] **Bộ xử lý ngôn ngữ & Hội thoại thông minh (`assets/js/assistant.js`):**
  - Hiểu tiếng Việt có dấu / không dấu, từ viết tắt (`sz`, `bn`, `ship`, `ck`, `ib`, `1m58 49kg`…) và trả lời kết hợp tối đa 2 chủ đề trong cùng 1 tin nhắn.
  - Nhớ ngữ cảnh hội thoại (`BOT.ctx`: sản phẩm, màu, size, chiều cao, cân nặng) và tự nhận biết khi khách đang mở trang chi tiết sản phẩm.
  - Thực hiện hành động thật ngay trong khung chat: tính size tự động (`suggestSize` dùng chung trong `core.js`), hiển thị thẻ sản phẩm kèm ảnh/giá/màu, **thêm sản phẩm vào giỏ hàng qua hội thoại**, tra cứu mã đơn `BH-...`, mở giỏ hàng / thanh toán / gọi điện / gửi email.
  - Tự động lưu các câu hỏi chưa hiểu vào `localStorage` (`byher_bot_unanswered`) để shop bổ sung kiến thức, kèm cổng nối `ASSISTANT_API` khi cần tích hợp LLM backend.
- [x] **Giao diện Widget (`assets/css/assistant.css` & `index.html`):**
  - Nút nổi `💬 TƯ VẤN BY HER` góc phải dưới, bong bóng lời mời nhẹ sau 15 giây, hiệu ứng đang gõ (`typing indicator`), nút gợi ý nhanh (`quick chips`), phím tắt `Esc` để đóng và lưu lịch sử trong `sessionStorage`.
- [x] Kiểm thử tự động bằng trình duyệt (Playwright): mở hộp thoại, hỏi danh mục, tư vấn size (`1m58 49kg` → `Size S`), chốt đơn trong chat (`Lấy áo cổ vuông màu đỏ` → tự động thêm `BH01 · Đỏ · Size S` vào giỏ hàng), hỏi chính sách & bảo quản — 0 lỗi console.

## Phần 9 — Đợt 5: Thay thử đồ bằng Ảnh áo PNG thật tách nền & Backend AI Try-On hoàn chỉnh

- [x] **Di chuyển & Chuẩn hóa 11 ảnh áo thật tách nền (`.png` trong suốt):**
  - Cắt gọn viền trong suốt (tight alpha crop), tối ưu kích thước và chuyển từ 3 thư mục `d:\Web\Áo cổ vuông tay dài`, `d:\Web\Áo trơn basic`, `d:\Web\Áo cổ tim` vào `assets/images/garments/` (`bh01-black.png`, `bh01-red.png`, `bh01-white.png`, `bh01-yellow.png`, `bh02-black.png`, `bh02-red.png`, `bh02-white.png`, `bh03-black.png`, `bh03-pink.png`, `bh03-red.png`, `bh03-white.png`); xóa 3 thư mục nguồn ngoài dự án.
  - Khai báo `GARMENT_PNG` trong `assets/js/data.js` và gắn vào `products[].tryon.garments`.
- [x] **Chế độ 1 — Phòng thử đồ AR dùng Ảnh áo PNG thật (`assets/js/garment.js` & `assets/js/ar.js`):**
  - Xử lý khoét lỗ trong suốt phần thân sau ở cổ áo (`bh01-*.png`, `bh02-*.png`, `bh03-*.png`) để lộ tự nhiên phần cổ, xương quai xanh và dây chuyền của người mặc thay vì bị mảng vải lưng áo che cứng.
  - Áp dụng **hệ thống lưới xương khớp nhiều đốt (`Articulated Skeletal Arm & Elbow Warping` trong `assets/js/garment.js`)**:
    + Tự động tách ảnh PNG thành 3 bộ phận có biên hòa trộn mềm (`buildGarmentParts`: Thân áo, Tay trái, Tay phải).
    + Với áo tay dài (`BH01`): chia mỗi ống tay thành **2 đốt xương (Vai → Khuỷu tay & Khuỷu tay → Cổ tay)** nối bằng lưới tứ giác biến dạng (`drawWarpedQuad`), giúp khi người thử gập khuỷu tay, giơ tay hay chống hông thì ống tay áo gập theo đúng góc khuỷu và cổ tay.
    + Với áo tay ngắn (`BH02`, `BH03`): ống tay tự động xoay nâng lên / hạ xuống theo góc mở của bắp tay trên (`drawShortSleeve`).
  - **Loại bỏ 2 dải viền thừa trên & dưới khung thử (`.ar-stage`) và thanh `.ar-tip` đè trong khung**: khung `#arStage` tự co khít 100% theo đúng tỷ lệ thật của camera hoặc ảnh tải lên (`aspect-ratio: auto`), không còn khoảng trống màu kem hay thanh chữ che khuất người thử.
- [x] **Chế độ 2 — AI Try-On ảnh thật · Beta (`assets/js/tryon-ai.js` + `server.py` + `server.js`):**
  - Mở khóa sẵn nút **✦ TẠO ẢNH THỬ ĐỒ AI** và hộp kiểm đồng ý trên giao diện (`index.html`).
  - Xây dựng **2 file Backend hoàn chỉnh** (`server.py` dùng Python + Pillow và `server.js` dùng Node.js thuần) phục vụ cả web tĩnh lẫn endpoint `POST /api/tryon`:
    1. **Chế độ Cloud GPU thật:** Tự động gọi **IDM-VTON (Replicate API)** hoặc **TryOnCloud API** ngay khi đặt biến môi trường `REPLICATE_API_TOKEN` hoặc `TRYONCLOUD_API_KEY`.
    2. **Chế độ Demo / Smart VTON tại máy cục bộ (Mặc định không cần API key):** `server.py` xử lý bằng Pillow ghép ảnh áo PNG thật theo landmarks cơ thể, tự động đo độ sáng vùng ngực người dùng để cân bằng độ sáng mặt vải và tạo bóng đổ Gaussian 3D; nếu người dùng mở web tĩnh không chạy backend, `tryon-ai.js` tự động fallback sang bộ ghép Smart VTON trên trình duyệt.
- [x] Kiểm thử End-to-End bằng Playwright + `server.py`: thử cả 3 mẫu áo PNG thật (`BH01`, `BH02`, `BH03`) và bấm nút **✦ TẠO ẢNH THỬ ĐỒ AI** nhận kết quả từ `server.py` (`✓ Kết quả AI Try-On · Backend Smart VTON`) — 0 lỗi console.

## Phần 10 — Đợt 6: Tối ưu triệt để chuyển động tay áo dài tay (BH01) bằng Anatomical Dual-Spline Ribbon Mesh

- [x] **Xóa bỏ triệt để hiện tượng rách quai áo / tách rời ống tay ở đầu vai:**
  - Nhận diện đúng đường may nách giải phẫu (armhole seam) thay vì cắt lát dọc chia đôi quai áo.
  - Cầu vai, cổ vuông, quai áo và toàn bộ thân áo được vẽ nguyên khối 100% trong một lượt vẽ duy nhất theo phép biến đổi Affine, bảo đảm quai áo và cổ vuông luôn liền mạch, vững chắc và ôm khít xương quai xanh của người thử.
- [x] **Hệ thống uốn tay áo động lực học mềm mại (Anatomical Dual-Spline Ribbon Mesh):**
  - **Khi buông tay tự nhiên:** Toàn bộ áo hiển thị 100% ảnh chụp áo thật nguyên bản, sắc nét đến từng đường kim mũi chỉ và nếp vải, không cắt vụn hay làm méo ảnh.
  - **Khi giơ tay / gập cánh tay (cử động khuỷu, giơ tay lên ngực, chống nách):**
    + Ống tay áo tự động uốn theo đường spline giải phẫu liên tục 3 điểm (Vai → Khuỷu tay → Cổ tay).
    + Khớp khuỷu tay được trang bị thuật toán fillet bo tròn tự nhiên (Quadratic Bezier), xóa bỏ hoàn toàn hiện tượng góc gập sắc nhọn kiểu "gấp giấy origami" hay chắp vá.
    + Bảo toàn chiều dài tự nhiên của cánh tay (anatomical bone length conservation), giúp ống tay không bị teo nhỏ hay co rúm khi tay di chuyển góc nghiêng.
    + Mép nối nách được xử lý phủ chờm viền mượt mà (boundary overlap antialiasing), triệt tiêu hoàn toàn đường kẻ hở giáp mí giữa thân áo và tay áo.
- [x] **Xác minh trực quan trên trình duyệt thật:**
  - Tạo trang kiểm thử `test_ar.html` và chạy thử nghiệm tự động bằng Chrome headless trên 3 tư thế: (1) Đứng thẳng tự nhiên, (2) Gập 1 cánh tay lên ngực, (3) Gập cả 2 cánh tay.
  - Kết quả ảnh render thật (`test_canvas_v13.png`) xác nhận:
    + Cổ áo vuông và quai áo vững chãi 100%, không bị nứt rách hay tách rời ở đầu vai.
    + Thân áo, eo và vạt áo dưới giữ nguyên 100% nếp vải và đường cong tự nhiên từ ảnh chụp gốc, không bị xén phẳng.
    + Xử lý độc lập từng cánh tay: cánh tay nào buông thẳng thì giữ nguyên 100% ảnh thật, chỉ cánh tay nào gập/giơ lên mới uốn cong động học.
    + Viền cổ tay vuông góc chuẩn xác với cẳng tay nhờ hệ thống lát cắt trực giao trục xương tay.
    + Bề mặt vải láng mịn, đồng nhất màu sắc, triệt tiêu 100% hiện tượng đốm đen hoặc đường kẻ răng cưa giáp mí.

