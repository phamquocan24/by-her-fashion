# Giải pháp AR / AI Virtual Try-On & VR cho BY HER

> Tài liệu này đối chiếu nghiên cứu từ `AR_AI_Virtual_TryOn_Ecommerce_README.md` với đặc thù dự án **BY HER** (thương hiệu áo basic nữ tối giản, web tĩnh, ưu tiên quyền riêng tư & tốc độ tải) để đưa ra kiến trúc tối ưu nhất cho khách mua hàng.

---

## 1. Phân tích bài toán & Lựa chọn kiến trúc từ tài liệu nghiên cứu

Tài liệu `AR_AI_Virtual_TryOn_Ecommerce_README.md` chỉ ra 2 hướng chính và kiến trúc **Multi-tier (Nhiều tầng)** từ các repo chuẩn mực (`Haigatu/clothes-try-on`, `Mije31/Virtual_Fitting_Room`):

| Tiêu chí | Hướng 1: Real-time Browser AR (MediaPipe + Canvas/WebGL) | Hướng 2: AI Image VTON (CatVTON / IDM-VTON / TryOnCloud API) | Giải pháp áp dụng cho BY HER |
|---|---|---|---|
| **Tốc độ phản hồi** | Tức thì (Real-time ~30-60 FPS trên camera, < 1s trên ảnh) | Chậm (~15–30 giây chờ GPU sinh ảnh) | **Kết hợp cả hai (Hybrid):** Mặc định chạy Hướng 1 ngay trên trình duyệt; mở sẵn cổng nối Hướng 2 khi có Backend. |
| **Chi phí vận hành** | **0₫** (Chạy bằng CPU/GPU thiết bị của khách) | Tốn phí GPU Server hoặc phí API theo lượt | Phù hợp tuyệt đối cho giai đoạn chạy web tĩnh, không phát sinh phí ngầm. |
| **Quyền riêng tư** | **Tuyệt đối** — ảnh/video không rời khỏi trình duyệt | Phải gửi ảnh người dùng lên máy chủ bên thứ 3 | Giữ nguyên cam kết thương hiệu BY HER; nếu dùng AI phải có checkbox đồng ý (Consent). |
| **Bản quyền (License)** | MediaPipe Tasks Vision: **Apache-2.0** (An toàn thương mại 100%) | CatVTON / IDM-VTON / OOTDiffusion: **CC BY-NC-SA 4.0** (Cấm thương mại mặc định) | Tránh rủi ro pháp lý khi đưa web vào kinh doanh thực tế. |

---

## 2. Kiến trúc 4 tầng đã triển khai trong dự án

```text
                       TRANG SẢN PHẨM / MENU BY HER
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ↓                          ↓                          ↓
 [Tầng 1: AR Pose Try-On]   [Tầng 2: AI VTON Bridge]   [Tầng 3 & 4: VR & AR Code]
 MediaPipe Pose Landmarker   POST /api/tryon (Opt-in)   A-Frame 360° & QR AR Code
         │                          │                          │
         ├── Nhận diện 8 khớp       ├── TryOnCloud / WEARFITS  ├── Phòng trưng bày 360°
         │   (vai, khuỷu, cổ tay,   │   hoặc FastAPI tự host   ├── QR mở thẳng mẫu/màu
         │    hông)                 └── Trả về ảnh photoreal   │   trên điện thoại
         ├── Tự động xoay/co giãn                              └── Sẵn sàng gắn link 3D
         │   áo theo dáng người                                    từ ar-code.com
         └── Gợi ý Size (S/M/L)
                     │
                     ↓
        [THÊM VÀO GIỎ HÀNG / MUA NGAY]
```

### Tầng 1 — Real-time Pose-Tracked AR (`pose.js` + `garment.js` + `ar.js`)
Khắc phục hoàn toàn nhược điểm "hình dán 2D tĩnh" ban đầu:
1. **Nhận diện khung xương (Pose Tracking):** Sử dụng `@mediapipe/tasks-vision` (`PoseLandmarker`) phát hiện vị trí 2 vai (`11, 12`), 2 khuỷu tay (`13, 14`), 2 cổ tay (`15, 16`) và 2 hông (`23, 24`).
2. **Biến dạng áo theo cơ thể (`garment.js`):**
   - Thân áo tự động căn giữa cổ, nghiêng theo độ dốc hai vai và co giãn chiều dài theo khoảng cách vai – hông.
   - **Tay áo khớp theo cánh tay:** khi người dùng giơ tay hoặc chống hông, tay áo (dài ở `BH01`, ngắn ở `BH02/BH03`) tự động xoay bám theo vector vai → khuỷu → cổ tay.
   - Đổ bóng 3 chiều, tạo vân vải (fabric noise texture) và đường may để chiếc áo có chiều sâu tự nhiên.
3. **Làm mượt chuyển động (Temporal Smoothing):** Nội suy vị trí khớp giữa các khung hình camera giúp áo không bị rung giật.
4. **Cơ chế dự phòng (Geometric Fallback):** Nếu khách tắt mạng hoặc ảnh khuất người, hệ thống tự chuyển về khung chuẩn và cho phép kéo/phóng to thủ công.

### Tầng 2 — Tư vấn Size & Chốt đơn ngay tại phòng thử (`ar.js`)
Bám sát luồng của `Mije31/Virtual_Fitting_Room` (thử đồ gắn liền với chuyển đổi mua hàng):
- Khách nhập **Chiều cao (cm)** và **Cân nặng (kg)** → hệ thống đối chiếu trực tiếp với `SIZE_CHART` chuẩn của BY HER (`S: ≤1m60, ≤52kg` · `M: ≤1m70, ≤65kg` · `L: ≤1m80, ≤78kg`) để chọn sẵn nút Size.
- Nút **THÊM VÀO GIỎ HÀNG** và **MUA NGAY** nằm ngay trong bảng điều khiển AR, tự động truyền đúng `Mã áo + Màu đang thử + Size đã chọn` vào giỏ hàng mà không bắt khách quay lại trang chi tiết.

### Tầng 3 — Cầu nối AI Photorealistic VTON (`tryon-ai.js`)
Thiết kế sẵn theo đúng mục 8 & 9 của `AR_AI_Virtual_TryOn_Ecommerce_README.md`:
- Dữ liệu sản phẩm trong `data.js` đã mở rộng thuộc tính `tryon: { enabled: true, category: 'top', model3d: '' }`.
- Khi doanh nghiệp có backend (FastAPI/Node nối với **TryOnCloud** hoặc **WEARFITS**), chỉ cần điền đường dẫn vào `TRYON_API.endpoint` trong `assets/js/data.js`:
  ```js
  const TRYON_API = { endpoint: 'https://api.byher.vn/api/tryon', timeoutMs: 90000 };
  ```
- Nút **TẠO ẢNH THỬ ĐỒ AI** và hộp kiểm **Đồng ý gửi ảnh** sẽ tự động mở khóa. Ảnh người dùng được nén chuẩn `≤ 1024px` trước khi gửi và hiển thị kết quả ngay dưới bảng điều khiển.

### Tầng 4 — Phòng trưng bày VR 360° & Mã QR AR Code (`vr.js` + `arcode.js`)
- **VR Showroom (`vr.js`):** Xây dựng không gian 3D 360° bằng A-Frame/WebXR. Khách xoay điện thoại, kéo chuột hoặc đeo kính VR để ngắm toàn bộ các phiên bản màu của dòng áo đang chọn xung quanh mình, bấm/nhìn vào từng áo để đổi màu.
- **AR Code (`arcode.js`):** Tự động sinh mã QR cho từng cặp `Sản phẩm + Màu` tại trang Chi tiết, trang AR và trang Đặt hàng thành công (để in lên bao bì/phiếu cảm ơn). Khi có mô hình `.glb` trên `ar-code.com`, chỉ cần dán link vào `AR_CODE.links` trong `data.js`.

---

## 3. Lưu ý pháp lý & Bản quyền (Quan trọng trước khi thương mại hóa)

1. **Không tự ý dùng checkpoint `CatVTON`, `IDM-VTON`, `OOTDiffusion`, `FitDiT` cho web bán hàng thương mại** vì trọng số (weights) của các model này đi kèm giấy phép **CC BY-NC-SA 4.0** (chỉ phi thương mại).
2. Nếu cần tính năng sinh ảnh AI thương mại: ưu tiên dùng API có điều khoản thương mại rõ ràng (**TryOnCloud**, **WEARFITS**, **Genlook**) thông qua backend riêng để giấu API Key.
3. Toàn bộ thư viện đang chạy trực tiếp trên web hiện tại (**MediaPipe Tasks Vision** — Apache 2.0, **A-Frame** — MIT) đều **hợp lệ 100% cho mục đích thương mại**.
