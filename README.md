# BY HER — Website bán áo basic nữ (kèm phòng thử đồ AR)

> *Simple Style, Made for Her.* Website tĩnh (HTML/CSS/JS thuần), không cần build, không cần backend.

## Chạy dự án

### Cách 1: Chạy kèm Server AI Try-On (Khuyên dùng)
Dự án đã tích hợp sẵn máy chủ backend mẫu (`server.py` bằng Python hoặc `server.js` bằng Node.js) phục vụ cả trang web lẫn cổng **`POST /api/tryon`** cho tính năng **AI TRY-ON ẢNH THẬT · BETA**:

```bash
cd by-her
python server.py          # hoặc: node server.js
# mở http://localhost:8080
```
- **Chế độ Demo / Smart VTON cục bộ (Mặc định):** Không cần API Key, `server.py` tự động xử lý bằng Pillow (khớp ảnh áo PNG thật đã xóa nền theo 8 khớp MediaPipe, cân bằng ánh sáng môi trường và đổ bóng 3D).
- **Chế độ Cloud GPU thật:** Đặt biến môi trường `REPLICATE_API_TOKEN` (IDM-VTON) hoặc `TRYONCLOUD_API_KEY` trước khi chạy `server.py` / `server.js`.

### Cách 2: Mở nhanh không cần Backend
Mở trực tiếp `index.html` hoặc chạy `python -m http.server 8080`. Khi không bật backend, nút **✦ TẠO ẢNH THỬ ĐỒ AI** sẽ tự động chuyển sang bộ ghép Smart VTON ngay trong trình duyệt.

## Cấu trúc thư mục

```
by-her/
├─ index.html                 # Khung trang (SPA: mỗi <section class="page"> là một "trang")
├─ server.py                  # Backend Python (HTTP + cổng POST /api/tryon: Cloud GPU & Pillow Smart VTON)
├─ server.js                  # Backend Node.js không phụ thuộc ngoài (HTTP + cổng POST /api/tryon)
├─ assets/
│  ├─ css/
│  │  ├─ main.css             # Giao diện chung (layout, shop, giỏ hàng, checkout, feedback…)
│  │  ├─ ar.css               # Phòng thử đồ AR & kết quả AI Try-On
│  │  ├─ vr.css               # Phòng VR, mã QR AR, quy trình mua hàng
│  │  └─ assistant.css        # Trợ lý ảo tư vấn khách hàng (floating chat widget)
│  ├─ js/                     # Thứ tự nạp trong index.html là BẮT BUỘC
│  │  ├─ data.js              # 1) Ảnh, GARMENT_PNG, sản phẩm, feedback, kho kiến thức trợ lý, cấu hình AR/VR
│  │  ├─ core.js              # 2) Tiện ích, state, localStorage, suggestSize(), router go()
│  │  ├─ shop.js              # 3) Trang chủ / danh sách / chi tiết
│  │  ├─ cart.js              # 4) Giỏ hàng (drawer)
│  │  ├─ checkout.js          # 5) Thanh toán mẫu, đơn hàng, form liên hệ
│  │  ├─ arcode.js            # 6) Mã QR AR Code (ar-code.com)
│  │  ├─ pose.js              # 7) Nhận diện dáng người (MediaPipe Pose Landmarker)
│  │  ├─ garment.js           # 8) Khớp ảnh áo thật tách nền (.png) lên cơ thể theo vai & thân
│  │  ├─ ar.js                # 9) Phòng thử đồ AR ảnh thật + gợi ý size
│  │  ├─ tryon-ai.js          # 10) Chế độ 2: AI Virtual Try-On ảnh thật (gọi server.py/server.js + fallback)
│  │  ├─ vr.js                # 11) Phòng trưng bày VR (A-Frame / WebXR)
│  │  ├─ assistant.js         # 12) Trợ lý ảo tư vấn, chọn size & chốt đơn trong chat
│  │  └─ main.js              # 13) init() — nạp cuối cùng
│  └─ images/
│     ├─ garments/            # 11 ảnh áo thật tách nền PNG (bh01-*.png, bh02-*.png, bh03-*.png)
│     ├─ products/            # Ảnh mẫu mặc sản phẩm (bhXX-<kiểu>-<màu>.jpg)
│     ├─ brand/               # logo, bảng size, bao bì, chính sách, bảo quản
│     ├─ feedback/            # fb-01-minh-anh.jpg … fb-06-bao-chau.jpg
│     └─ favicon.svg
└─ docs/
   ├─ ASSISTANT.md            # Kiến trúc & hướng dẫn vận hành Trợ lý ảo BY HER
   ├─ AR-TRYON-SOLUTION.md    # Giải pháp AR / AI Virtual Try-On tối ưu cho BY HER
   ├─ AR-VR.md                # Hướng dẫn cấu hình & vận hành AR Code + VR
   ├─ CHECKLIST.md            # Checklist công việc + lỗi đã sửa
   └─ GUIDELINES.md           # Định hướng & nguyên tắc không đi lệch
```

## Tài liệu dự án

| File | Dùng để |
|---|---|
| [docs/ASSISTANT.md](docs/ASSISTANT.md) | Kiến trúc, kịch bản tư vấn & cách cập nhật Trợ lý ảo khách hàng |
| [docs/AR-TRYON-SOLUTION.md](docs/AR-TRYON-SOLUTION.md) | Phân tích `AR_AI_Virtual_TryOn_Ecommerce_README.md` & kiến trúc thử đồ 4 tầng |
| [docs/AR-VR.md](docs/AR-VR.md) | Hướng dẫn cấu hình AR Code, Pose AR, AI VTON & VR Showroom |
| [docs/CHECKLIST.md](docs/CHECKLIST.md) | Theo dõi tiến độ, lỗi đã sửa, việc còn lại |
| [docs/GUIDELINES.md](docs/GUIDELINES.md) | Mục đích, kỹ năng & hướng dẫn của chuyên gia/senior, quy tắc giữ đúng hướng |

## Lưu ý quan trọng

- Đây là **website mẫu**: đơn hàng chỉ lưu `localStorage` trên trình duyệt, chưa gửi về cửa hàng, chưa có thanh toán thật.
- Nội dung, văn bản, màu sắc, bố cục **giữ nguyên bản của khách**; chỉ sửa lỗi và tái cấu trúc (xem `docs/CHECKLIST.md`).
- File gốc `BY_HER_website_them_AR.html` được giữ nguyên ở thư mục cha để đối chiếu.


