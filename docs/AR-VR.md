# AR & VR — hướng dẫn cấu hình và vận hành

> Xem thêm tài liệu kiến trúc chi tiết và phân tích lựa chọn công nghệ tại [docs/AR-TRYON-SOLUTION.md](AR-TRYON-SOLUTION.md).

## Tổng quan 4 lớp

| Lớp | Công nghệ | Dùng để | File |
|---|---|---|---|
| AR thử áo theo dáng người | MediaPipe Pose Landmarker + Canvas 2D | Tự động nhận diện vai/khuỷu/cổ tay/hông, khớp áo & tay áo theo cơ thể, gợi ý size, lưu ảnh PNG | `pose.js`, `garment.js`, `ar.js` |
| AI Try-On ảnh thật (tùy chọn) | REST Bridge (`POST /api/tryon`) | Gửi ảnh người + mã áo lên backend VTON (TryOnCloud/WEARFITS/FastAPI) khi cấu hình `TRYON_API.endpoint` | `tryon-ai.js` |
| AR Code (QR) | Mã QR → AR/3D trên điện thoại ([ar-code.com](https://ar-code.com/vi)) | Đặt trên bao bì, hóa đơn, trang thanh toán, trang sản phẩm | `arcode.js` |
| VR showroom | A-Frame + WebXR | Đứng giữa phòng 360°, các màu của sản phẩm xếp quanh; hỗ trợ kính VR/Cardboard | `vr.js` |

Mọi xử lý ảnh/camera ở trình duyệt, không upload. Mã QR chỉ chứa **URL công khai**.

## 1. AR Code — cách dùng

Mặc định (chưa cấu hình): QR trỏ tới `https://<tên-miền>/?p=BH03&c=pink#ar` → khách quét bằng điện thoại sẽ mở **đúng phòng thử áo** với đúng mẫu/màu. Cần website chạy **HTTPS** (khi mở bằng file/localhost, mã QR ẩn và hiện thông báo).

Nâng cấp lên mô hình 3D/WebAR của AR Code:
1. Tạo tài khoản trên https://ar-code.com/vi, tải mô hình 3D `.glb/.usdz` của từng áo (cần thiết kế 3D riêng — hiện dự án **chưa có** file 3D).
2. Tạo AR Code cho BH01, BH02, BH03 và copy link.
3. Dán vào `assets/js/data.js`:
   ```js
   const AR_CODE = { links: { BH01: 'https://…', BH02: 'https://…', BH03: 'https://…' }, … };
   ```
4. QR trên trang AR / chi tiết / đặt hàng thành công tự đổi sang link đó.
5. In QR lên bao bì: tải ảnh QR (nhấp phải ảnh QR → lưu) hoặc dùng bản xuất của AR Code.

> Gói/giá/giới hạn của AR Code do nhà cung cấp quy định — kiểm tra trên trang của họ trước khi cam kết với khách.

QR được tạo bằng dịch vụ `api.qrserver.com` (đổi ở `AR_CODE.qrService`). Muốn không phụ thuộc bên thứ ba: thay bằng thư viện QR chạy tại chỗ.

## 2. VR showroom

- Mở từ: menu **XEM VR ✦**, nút **XEM VR** trên thẻ sản phẩm, nút trên trang chi tiết.
- Điện thoại: xoay máy hoặc kéo để nhìn quanh · Máy tính: kéo chuột, bấm ảnh để chọn màu · Kính VR: bấm biểu tượng kính, nhìn ảnh ~1,5 giây để chọn.
- Thư viện A-Frame (CDN, ~1 MB) **chỉ tải khi mở trang VR**; scene được gỡ khi rời trang.
- Cần Internet + HTTPS/localhost (texture ảnh bị chặn khi mở bằng `file://`).
- Muốn "VR từng sản phẩm" thật sự 360° quanh áo: cần ảnh chụp xoay 360° hoặc mô hình 3D `.glb`; có thể thay `<a-image>` bằng `<a-gltf-model>` trong `vrSceneHTML()`.

## 3. Việc cần khách cung cấp

- [ ] Mô hình 3D/ảnh 360° từng áo (BH01–BH03, từng màu nếu có).
- [ ] Tài khoản + link AR Code.
- [ ] Tên miền HTTPS để deploy (AR camera & VR cần).
- [ ] Link mạng xã hội chính thức (hiện là trang chủ Facebook/Instagram/TikTok, sửa trong `SOCIAL`).

## 4. Kiểm thử

- Quét QR từ điện thoại thật sau khi deploy; kiểm tra mở đúng mẫu/màu.
- VR: Chrome Android (gyro), desktop (chuột), Meta Quest Browser (WebXR).
