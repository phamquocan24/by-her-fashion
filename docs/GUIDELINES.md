# GUIDELINES — Giữ dự án đúng hướng

Tài liệu cho mọi người tham gia (dev, designer, content, QA). Đọc trước khi sửa code.

## 1. Mục đích & giá trị cho khách

| | |
|---|---|
| Khách hàng | Thương hiệu **BY HER** — áo basic nữ tối giản (BH01 ôm body, BH02 croptop, BH03 cổ vuông, BH04 cổ tim) |
| Mục tiêu | Giới thiệu sản phẩm đẹp, dễ chọn màu/size, **thử áo AR** để tăng tự tin mua, mô phỏng quy trình đặt hàng |
| Giá trị khác biệt | Phòng thử đồ AR **riêng tư** (không upload ảnh), giao diện nhẹ nhàng, không cần backend |
| Thành công = | Khách demo mượt trên điện thoại; mã nguồn dễ bàn giao & mở rộng; không lỗi console |

**Không phải mục tiêu:** đo cơ thể chính xác, thanh toán thật, quản trị kho (chưa có trong phạm vi).

## 2. Nguyên tắc vàng (không được vi phạm)

1. **Không đổi nội dung của khách**: văn bản tiếng Việt, tên sản phẩm, giá, màu, thông tin liên hệ, bố cục, màu sắc thương hiệu. Muốn đổi → hỏi khách, ghi vào `CHECKLIST.md` mục "cần quyết định".
2. **Chỉ sửa 3 loại**: lỗi / sai logic / chắp vá. Mỗi sửa phải ghi vào bảng lỗi trong `CHECKLIST.md` (mức độ, nguyên nhân, cách sửa, file).
3. **Một việc – một nơi**: dữ liệu sản phẩm ở `data.js`; style ở `main.css`/`ar.css`; không rải inline mới.
4. **Mở `index.html` bằng `file://` phải chạy** (trừ camera). Vì vậy: không ES module, không `fetch` file cục bộ.
5. **Riêng tư mặc định**: không gửi ảnh/video người dùng ra ngoài; camera chỉ bật khi người dùng bấm.
6. **Thứ tự nạp script là hợp đồng**: `data → core → shop → cart → checkout → ar → main`.

## 3. Quy trình làm việc cho mỗi thay đổi

1. Đọc `CHECKLIST.md` → chọn/ghi mục việc.
2. Tái hiện lỗi → viết ngắn nguyên nhân gốc (root cause), không vá triệu chứng.
3. Sửa tối thiểu (diff nhỏ).
4. Kiểm tra: mở console không lỗi; đi đủ luồng *Trang chủ → Chi tiết → Giỏ → Thanh toán → Đơn hàng* và *AR → Lưu ảnh*; thử 390px (mobile) và 1280px.
5. Tick `[x]` + thêm dòng vào bảng lỗi.

## 4. Hướng dẫn theo vai trò chuyên gia

### 4.1 Senior Frontend Engineer
- Vanilla JS, hàm nhỏ, tên rõ; tránh biến global mới (đã có các `let` state ở `core.js`).
- Render bằng template string → **luôn `escapeHtml`** với dữ liệu người dùng/localStorage.
- Mọi dữ liệu đọc từ `localStorage` phải qua `sanitize*` (dữ liệu cũ có thể sai cấu trúc).
- Khi thêm trang: thêm `<section id="x" class="page">`, xử lý trong `go()`, cân nhắc `ENTRY_PAGES`.
- Khi thêm sản phẩm: chỉ sửa `products`, `IMG`, thêm ảnh; riêng AR cần thêm hình dáng SVG trong `arGarmentSVG()`.

### 4.2 UI/UX Designer
- Giữ biến màu `:root` (`--rose`, `--wine`, `--ink`…); không thêm màu tùy hứng.
- Font: Playfair Display (tiêu đề) + Be Vietnam Pro (nội dung).
- Mobile-first ≤ 650px; vùng chạm ≥ 44px; mô tả AR phải nói rõ là **lớp phủ 2D**, không hứa độ vừa vặn.
- Việc cần thiết kế: menu mobile thật (hiện `☰` chỉ dẫn tới Sản phẩm).

### 4.3 Accessibility (WCAG 2.2 AA)
- Mọi `<img>` có `alt`; nút icon có `aria-label`; vùng trạng thái dùng `aria-live`.
- Giữ `:focus-visible`; hỗ trợ `Esc` đóng giỏ hàng.
- Việc tiếp: focus-trap & `aria-modal` cho drawer, `<label for>` cho form, kiểm tra tương phản chữ `--muted` (#89787a trên nền sáng ≈ biên giới AA).

### 4.4 Performance
- Ảnh: nén `.webp`, kích thước đúng hiển thị, `loading="lazy"` (đã có) — hero giữ eager.
- Tránh phình `main.css`; không thêm thư viện cho việc JS thuần làm được.
- Mục tiêu: LCP < 2.5s trên 4G; tổng trang < 1 MB (hiện ~0.45 MB ảnh + 30 KB code).

### 4.5 Security & Privacy
- Chống XSS: `escapeHtml` (đã có) cho mọi dữ liệu động ngoài `products` do dev kiểm soát.
- Camera: chỉ HTTPS/localhost; luôn `stop()` track khi rời trang (đã có trong `go()` & `pagehide`).
- Khi có backend: validate phía server, CSRF, không lưu ảnh AR, tuân thủ luật bảo vệ dữ liệu cá nhân (NĐ 13/2023/NĐ-CP).

### 4.6 QA
- Checklist hồi quy nhanh: lọc/tìm kiếm, đổi màu trên thẻ, chọn size/số lượng, thêm giỏ trùng biến thể (cộng dồn), xóa, đặt đơn, reload (giỏ còn), Back/Forward, AR (tải ảnh, kéo, đổi màu/kiểu, lưu PNG), camera từ chối quyền.
- Test trên: Chrome, Safari iOS, Firefox, Android Chrome.

### 4.7 Content / SEO
- Giữ giọng văn "nàng", ngắn, nhẹ nhàng. Chính tả/diacritics tiếng Việt chuẩn UTF-8.
- Khi triển khai thật: `title`/`description` từng trang, Open Graph, schema `Product`.

### 4.8 DevOps
- Hosting tĩnh (Netlify/Vercel/GitHub Pages) có HTTPS miễn phí → AR camera hoạt động.
- Cache dài cho `assets/` (đặt tên file có hash khi có build tool).

### 4.9 Product Owner
- Mọi yêu cầu mới ghi vào `CHECKLIST.md` Phần 5, phân loại *must / should / could*.
- Ưu tiên: (1) ảnh sản phẩm thật, (2) nhận đơn thật, (3) menu mobile, (4) AR nâng cao (nhận diện cơ thể) — chỉ làm khi khách đồng ý ngân sách.

## 5. Quy ước code

- Thụt lề 2 spaces, UTF-8, LF, dấu `;` đầy đủ, `const` ưu tiên hơn `let`.
- Tên file ảnh: `bhXX-<kiểu>-<màu>.jpg`, chữ thường, gạch ngang.
- Commit: `fix(ar): …`, `feat(cart): …`, `refactor(core): …`, `docs: …`.
- Comment giải thích **vì sao**, không lặp lại **cái gì**.

## 6. Dấu hiệu đang đi lệch hướng → dừng lại

- Sửa nội dung/giọng văn/giá mà khách chưa duyệt.
- Thêm framework/build tool "cho đẹp" khi chưa cần.
- Vá lỗi bằng `try/catch` nuốt lỗi hoặc `setTimeout` thay vì tìm nguyên nhân.
- Thêm tính năng ngoài mục 1 mà không cập nhật checklist.
- Tính năng AR gửi dữ liệu người dùng ra ngoài.

## 7. Định nghĩa "Hoàn thành" (Definition of Done)

- [ ] Không lỗi/cảnh báo console ở mọi trang.
- [ ] Đủ luồng mua hàng + AR chạy trên mobile & desktop.
- [ ] Nội dung khớp file gốc (trừ mục đã duyệt).
- [ ] `CHECKLIST.md` cập nhật; lỗi đã sửa có ghi nhận.
- [ ] Mở trực tiếp `index.html` và qua `localhost` đều hoạt động.
