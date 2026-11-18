# Trợ lý ảo BY HER — Kiến trúc, Kịch bản Tư vấn & Hướng dẫn Mở rộng

> Tài liệu này hướng dẫn cách vận hành, cập nhật câu trả lời và mở rộng **Trợ lý ảo BY HER** (`assets/js/assistant.js` & `assets/css/assistant.css`).

---

## 1. Mục tiêu & Đặc điểm nổi bật

1. **Phản hồi tức thì (< 0.5 giây), 0₫ chi phí, hoạt động 100% offline/web tĩnh:**
   - Bộ xử lý ngôn ngữ tự nhiên tiếng Việt (NLU) chạy trực tiếp trên trình duyệt, hiểu cả **tiếng Việt có dấu, không dấu và từ viết tắt phổ biến** (`sz`, `bn`, `ship`, `ck`, `ib`, `1m58 48kg`…).
2. **Đúng chính xác 100% dữ liệu thật của BY HER (Không bịa thông tin):**
   - Toàn bộ câu trả lời được lấy trực tiếp từ `products`, `SIZE_CHART`, `SHOP_INFO` và `STYLE_TIPS` trong `assets/js/data.js` (trích xuất nguyên văn từ ảnh *Bảng size*, *Chính sách khách hàng*, *Hướng dẫn bảo quản* và *Yêu cầu chi tiết.pdf*).
3. **Nhớ ngữ cảnh hội thoại (Stateful Multi-turn Context) & Nhận biết trang đang xem:**
   - Mở hộp chat khi đang ở trang chi tiết **Áo cổ tim (BH03)** → trợ lý chào đúng mẫu `BH03` và gợi ý nút tư vấn cho riêng mẫu đó.
   - Nhớ số đo chiều cao, cân nặng, mẫu áo, màu sắc qua các lượt hỏi. Ví dụ: khách hỏi *"Mình cao 1m58 nặng 49kg"* (trợ lý báo **Size S**) → khách nhắn tiếp *"Lấy áo cổ vuông màu đỏ"* → trợ lý tự ghép `BH01 + Đỏ + Size S` và **thêm thẳng vào giỏ hàng**.
4. **Thực thi hành động thật ngay trong hộp chat:**
   - Hiển thị thẻ sản phẩm có ảnh thật, giá tiền, chấm màu và nút **Chi tiết** / **Chọn mua**.
   - Tự động thêm vào giỏ hàng, cập nhật số lượng trên thanh menu, mở ngăn giỏ hàng, chuyển tới trang Thanh toán, tra cứu mã đơn hàng `BH-...`, gọi điện `0354 605 263` hoặc mở email.

---

## 2. Danh sách 20+ Chủ đề (Intents) Trợ lý hỗ trợ

| Nhóm | Câu hỏi mẫu của khách | Hành động của Trợ lý |
|---|---|---|
| **Tư vấn chọn Size** | *"Tư vấn size"*, *"1m60 52kg mặc size gì"*, *"cao 165 nặng 60"* | Tính toán theo `SIZE_CHART` (`S / M / L`), cảnh báo nếu ngoài khung chuẩn, gợi ý nút mua đúng size vừa tính. |
| **Danh mục & Gợi ý mẫu** | *"Shop có những mẫu nào?"*, *"Tư vấn áo"*, *"Bán chạy"* | Liệt kê 3 mẫu `BH01`, `BH02`, `BH03` kèm thẻ sản phẩm trực quan. |
| **Chi tiết từng mẫu** | *"Xem BH01"*, *"Áo cổ vuông tay dài"*, *"Áo cổ tim"* | Báo giá, danh sách màu, chất liệu, mẹo phối đồ và thẻ ảnh đúng mẫu. |
| **Tìm theo màu sắc** | *"Có áo màu hồng không?"*, *"Màu vàng"*, *"Mấy màu"* | Lọc ra đúng các mẫu có màu khách hỏi và hiển thị ảnh đúng màu đó. |
| **Giá bán** | *"Giá bao nhiêu?"*, *"Áo cổ tim bn tiền?"* | Báo giá mẫu đang hỏi (hoặc bảng giá cả 3 mẫu). |
| **Chất liệu & Độ co giãn** | *"Vải gì?"*, *"Có nóng/xù lông không?"*, *"Co giãn không?"* | Giải thích thành phần `56% Cotton · 38% Modal · 6% Elastane`. |
| **Phối đồ (Styling)** | *"Phối với gì đẹp?"*, *"Mặc đi làm/đi học"* | Tư vấn cách mix chân váy, quần jeans, blazer theo từng dáng cổ áo. |
| **Hướng dẫn bảo quản** | *"Giặt máy được không?"*, *"Cách bảo quản"* | Trả lời 7 gạch đầu dòng từ bảng *Hướng dẫn bảo quản BY HER*. |
| **Chính sách đổi trả & Hàng lỗi** | *"Đổi size được không?"*, *"Trả hàng hoàn tiền"*, *"Áo bị lỗi"* | Nêu rõ: Đổi nguyên giá 1 lần trong 30 ngày (phí ship 2 chiều 45.000₫, lỗi do shop thì BY HER chịu 100%), trả hàng 05 ngày, hoàn tiền 07 ngày. |
| **Vận chuyển & Thanh toán** | *"Phí ship bao nhiêu?"*, *"Có COD không?"*, *"Chuyển khoản"* | Giải thích quy trình xác nhận phí ship, COD và chuyển khoản. |
| **Đặt hàng trực tiếp trong chat** | *"Lấy BH01 màu đỏ size M"*, *"Mua 2 cái áo trơn trắng"* | Nếu thiếu mẫu/màu/size sẽ hỏi từng bước; khi đủ sẽ gọi `addToCart()` thêm vào giỏ ngay. |
| **Tra cứu đơn hàng** | *"Kiểm tra đơn hàng"*, *"Đơn BH-123456789"* | Đọc `orders` từ trình duyệt, hiển thị chi tiết sản phẩm, tổng tiền và trạng thái. |
| **Phòng thử AR & VR** | *"Thử áo AR"*, *"Xem VR"* | Dẫn khách mở thẳng phòng thử áo AR hoặc phòng trưng bày VR 360°. |
| **Gặp nhân viên / Khiếu nại** | *"Gặp nhân viên"*, *"Số điện thoại shop"* | Hiển thị nút gọi nhanh `0354 605 263`, gửi email `byher@gmail.com` và trang Liên hệ. |

---

## 3. Cách chỉnh sửa nội dung trả lời (Không cần biết lập trình)

Mọi thông tin chính sách, số điện thoại, chất liệu, mẹo phối đồ đều nằm gọn trong **`assets/js/data.js`** tại 2 biến:
- `SHOP_INFO`: Số điện thoại, email, chất liệu, điều kiện đổi hàng (`exchange`), trả hàng (`returns`), lưu ý (`policyNotes`), bảo quản (`care`), thanh toán (`payment`), vận chuyển (`shipping`).
- `STYLE_TIPS`: Lời khuyên phối đồ cho `BH01`, `BH02`, `BH03`.

Khi shop thay đổi chính sách hoặc thêm sản phẩm mới vào mảng `products` trong `data.js`, trợ lý ảo sẽ **tự động cập nhật câu trả lời và thẻ sản phẩm** mà không cần sửa file `assistant.js`.

---

## 4. Theo dõi câu hỏi khách chưa được giải đáp & Nâng cấp AI (LLM)

1. **Xem các câu hỏi trợ lý chưa hiểu (`byher_bot_unanswered`):**
   - Mỗi khi gặp câu hỏi lạ ngoài kịch bản, trợ lý lịch sự chuyển khách sang hotline nhân viên đồng thời lưu câu hỏi đó vào `localStorage` với khóa `byher_bot_unanswered` (tối đa 50 câu gần nhất) để chủ shop xem và bổ sung từ khóa.
2. **Kết nối AI (OpenAI / Gemini / Claude) qua Backend (Tùy chọn):**
   - Trong `assets/js/data.js` đã có sẵn cấu hình:
     ```js
     const ASSISTANT_API = { endpoint: '', timeoutMs: 20000 };
     ```
   - Khi điền URL backend vào `ASSISTANT_API.endpoint`, những câu hỏi nằm ngoài kịch bản có sẵn sẽ được gửi kèm toàn bộ dữ liệu thật của shop (`botKnowledgeText()`) lên AI để trả lời linh hoạt mà vẫn bám sát chính sách của BY HER.
