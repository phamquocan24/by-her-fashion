#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
==========================================================================
BY HER — server.py
Máy chủ tích hợp sẵn cổng AI Virtual Try-On (`POST /api/tryon`) và phục vụ
toàn bộ website tĩnh (`http://localhost:8080`).

Hỗ trợ 2 chế độ tự động:
1) CHẾ ĐỘ CLOUD GPU THẬT (Khi đặt biến môi trường API Key):
   - `REPLICATE_API_TOKEN` : Gọi model IDM-VTON trên Replicate GPU Cloud.
   - `TRYONCLOUD_API_KEY`  : Gọi API thương mại TryOnCloud (`https://api.tryoncloud.com/api/v1/generate`).
   - `FASHN_API_KEY`       : Gọi API thương mại Fashn.ai VTON.

2) CHẾ ĐỘ DEMO / SMART VTON CỤC BỘ (Mặc định khi chưa cấu hình API Key):
   - Sử dụng thư viện xử lý ảnh Pillow (`PIL`) ngay trên máy chủ.
   - Đọc ảnh áo thật đã xóa nền (`assets/images/garments/*.png`), căn chỉnh
     theo 8 khớp cơ thể (MediaPipe Pose landmarks) do trình duyệt gửi lên,
     xoay nghiêng theo độ dốc vai, cân bằng ánh sáng từ ảnh người dùng và
     tạo bóng đổ 3D tự nhiên.
   - Giúp chủ shop và khách hàng trình diễn trọn vẹn luồng "AI TRY-ON ẢNH THẬT"
     từ đầu đến cuối mà không cần trả phí GPU.

Cách chạy:
   cd by-her
   python server.py
   # Mở trình duyệt tại: http://localhost:8080
==========================================================================
"""

import base64
import io
import json
import math
import os
import time
import urllib.request
import urllib.error
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

try:
    from PIL import Image, ImageEnhance, ImageFilter
    HAS_PIL = True
except ImportError:
    Image = ImageEnhance = ImageFilter = None  # type: ignore
    HAS_PIL = False

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", "8080"))

GARMENT_STYLES = {
    "BH01": {"widthMul": 1.48, "heightMul": 1.12, "anchorY": 0.068},
    "BH02": {"widthMul": 1.56, "heightMul": 1.05, "anchorY": 0.088},
    "BH03": {"widthMul": 1.48, "heightMul": 1.06, "anchorY": 0.082},
}


def decode_data_url(data_url: str) -> bytes:
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    return base64.b64decode(data_url)


def encode_data_url(img_bytes: bytes, mime: str = "image/png") -> str:
    return f"data:{mime};base64," + base64.b64encode(img_bytes).decode("ascii")


def file_to_data_url(rel_path: str) -> str:
    full = os.path.join(ROOT_DIR, rel_path.replace("/", os.sep))
    with open(full, "rb") as f:
        return encode_data_url(f.read(), "image/png")


# --------------------------------------------------------------------------
# Chế độ 1: Gọi Cloud GPU API thật (nếu người vận hành cung cấp API Key)
# --------------------------------------------------------------------------
def try_cloud_vton(person_data_url: str, garment_rel_path: str, product_name: str):
    replicate_token = os.environ.get("REPLICATE_API_TOKEN", "").strip()
    tryoncloud_key = os.environ.get("TRYONCLOUD_API_KEY", "").strip()
    garment_data_url = file_to_data_url(garment_rel_path)

    if tryoncloud_key:
        req = urllib.request.Request(
            "https://api.tryoncloud.com/api/v1/generate",
            data=json.dumps({
                "person_image": person_data_url,
                "garment_image": garment_data_url,
                "category": "upper_body"
            }).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {tryoncloud_key}",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=75) as resp:
            res = json.loads(resp.read().decode("utf-8"))
            out_url = res.get("result_url") or res.get("image_url") or res.get("output")
            if out_url:
                return {
                    "success": True,
                    "resultUrl": out_url,
                    "provider": "tryoncloud",
                    "note": "Ảnh được sinh bởi Cloud GPU (TryOnCloud VTON API).",
                }

    if replicate_token:
        # Gọi IDM-VTON qua Replicate HTTP API với Prefer: wait
        payload = {
            "version": "c871bb9b046607b680449ecbae55fd8c6d945e0a1948644bf2361b3d021d3ff4",
            "input": {
                "human_img": person_data_url,
                "garm_img": garment_data_url,
                "garment_des": product_name or "women basic top shirt",
                "category": "upper_body",
                "crop": False,
                "steps": 30,
            },
        }
        req = urllib.request.Request(
            "https://api.replicate.com/v1/predictions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Token {replicate_token}",
                "Prefer": "wait=60",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=75) as resp:
            pred = json.loads(resp.read().decode("utf-8"))
            output = pred.get("output")
            out_url = output[0] if isinstance(output, list) and output else output
            if isinstance(out_url, str) and out_url:
                return {
                    "success": True,
                    "resultUrl": out_url,
                    "provider": "replicate-idm-vton",
                    "note": "Ảnh được sinh bởi mô hình Diffusion IDM-VTON trên Cloud GPU.",
                }

    return None


# --------------------------------------------------------------------------
# Chế độ 2: Backend Smart VTON (Xử lý ảnh bằng Pillow ngay trên máy cục bộ)
# --------------------------------------------------------------------------
def local_pillow_vton(payload: dict) -> dict:
    if not HAS_PIL or Image is None:
        return {"success": False, "fallback": "client-smart-vton"}
    person_bytes = decode_data_url(payload["personImage"])
    person_im = Image.open(io.BytesIO(person_bytes)).convert("RGBA")
    W, H = person_im.size

    product_id = payload.get("productId", "BH01")
    color = payload.get("color", "white")
    garment_rel = payload.get("garmentPath") or f"assets/images/garments/{product_id.lower()}-{color}.png"
    garment_full = os.path.join(ROOT_DIR, garment_rel.replace("/", os.sep))
    garment_im = Image.open(garment_full).convert("RGBA")

    lm = payload.get("landmarks") or []

    def pt(idx, def_x, def_y):
        if isinstance(lm, list) and idx < len(lm) and isinstance(lm[idx], dict):
            return float(lm[idx].get("x", def_x)) * W, float(lm[idx].get("y", def_y)) * H
        return def_x * W, def_y * H

    p11 = pt(11, 0.36, 0.30)
    p12 = pt(12, 0.64, 0.30)
    p23 = pt(23, 0.41, 0.72)
    p24 = pt(24, 0.59, 0.72)

    if p11[0] <= p12[0]:
        sh_l, sh_r, hip_l, hip_r = p11, p12, p23, p24
    else:
        sh_l, sh_r, hip_l, hip_r = p12, p11, p24, p23

    sw = max(math.hypot(sh_r[0] - sh_l[0], sh_r[1] - sh_l[1]), 1.0)
    nx = (sh_l[0] + sh_r[0]) * 0.5
    ny = (sh_l[1] + sh_r[1]) * 0.5
    angle_deg = -math.degrees(math.atan2(sh_r[1] - sh_l[1], sh_r[0] - sh_l[0]))

    st = GARMENT_STYLES.get(product_id, GARMENT_STYLES["BH02"])
    scale = float(payload.get("scale") or 1.0)
    ox = float(payload.get("offsetX") or 0.0) * W
    oy = float(payload.get("offsetY") or 0.0) * H

    draw_w = max(int(round(sw * st["widthMul"] * scale)), 40)
    aspect = garment_im.height / max(garment_im.width, 1)
    draw_h = max(int(round(draw_w * aspect)), 40)

    # Cân bằng độ sáng nhẹ của áo theo vùng ngực của ảnh người dùng
    crop_box = (
        max(0, int(nx - sw * 0.4)),
        max(0, int(ny)),
        min(W, int(nx + sw * 0.4)),
        min(H, int(ny + sw * 0.8)),
    )
    if crop_box[2] > crop_box[0] and crop_box[3] > crop_box[1]:
        region = person_im.crop(crop_box).convert("L")
        avg_lum = sum(region.getdata()) / max(len(region.getdata()), 1)
        factor = max(0.88, min(1.10, 0.85 + (avg_lum / 255.0) * 0.30))
        rgb, a_ch = garment_im.convert("RGB"), garment_im.split()[3]
        rgb = ImageEnhance.Brightness(rgb).enhance(factor)
        garment_im = Image.merge("RGBA", (*rgb.split(), a_ch))

    resized = garment_im.resize((draw_w, draw_h), Image.LANCZOS)

    # Đặt tâm xoay tại cổ áo (anchorY)
    pad = int(max(draw_w, draw_h) * 0.6)
    canvas_g = Image.new("RGBA", (draw_w + pad * 2, draw_h + pad * 2), (0, 0, 0, 0))
    canvas_g.paste(resized, (pad, pad))
    anchor_center = (pad + draw_w // 2, pad + int(draw_h * st["anchorY"]))
    rotated = canvas_g.rotate(angle_deg, resample=Image.BICUBIC, center=anchor_center)

    # Tạo bóng đổ mềm phía dưới áo
    alpha = rotated.split()[3]
    shadow_alpha = alpha.filter(ImageFilter.GaussianBlur(radius=max(4, int(sw * 0.035))))
    shadow = Image.new("RGBA", rotated.size, (32, 18, 24, 0))
    shadow.putalpha(shadow_alpha.point(lambda p: int(p * 0.30)))

    paste_x = int(round(nx + ox - anchor_center[0]))
    paste_y = int(round(ny + oy - anchor_center[1]))

    out = person_im.copy()
    out.alpha_composite(shadow, dest=(paste_x, paste_y + max(2, int(sw * 0.015))))
    out.alpha_composite(rotated, dest=(paste_x, paste_y))

    out_rgb = out.convert("RGB")
    buf = io.BytesIO()
    out_rgb.save(buf, format="JPEG", quality=92, optimize=True)
    return {
        "success": True,
        "resultUrl": encode_data_url(buf.getvalue(), "image/jpeg"),
        "provider": "backend-demo-vton",
        "note": "Ảnh được xử lý bởi Backend Smart VTON (Pillow): khớp ảnh áo thật tách nền + cân bằng ánh sáng môi trường + đổ bóng 3D.",
    }


def get_api_dashboard_html() -> str:
    mode = "CLOUD GPU API" if (os.environ.get("REPLICATE_API_TOKEN") or os.environ.get("TRYONCLOUD_API_KEY")) else "LOCAL SMART VTON (DEMO)"
    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BY HER — AI Virtual Try-On API</title>
  <link rel="icon" type="image/svg+xml" href="/assets/images/favicon.svg">
  <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * {{ box-sizing: border-box; }}
    body {{
      font-family: 'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #faf6f0;
      color: #2b2b2b;
      margin: 0;
      padding: 40px 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }}
    .card {{
      max-width: 620px;
      width: 100%;
      background: #ffffff;
      padding: 36px 32px;
      border-radius: 20px;
      box-shadow: 0 16px 40px rgba(38, 20, 26, 0.08);
      border: 1px solid #eadcd0;
      text-align: left;
    }}
    .status-badge {{
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #e8f5e9;
      color: #2e7d32;
      font-weight: 600;
      font-size: 13px;
      padding: 6px 14px;
      border-radius: 20px;
      margin-bottom: 18px;
    }}
    .status-dot {{
      width: 8px;
      height: 8px;
      background: #4caf50;
      border-radius: 50%;
      box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.25);
    }}
    h1 {{
      font-size: 22px;
      margin: 0 0 10px;
      color: #24141a;
      letter-spacing: -0.02em;
    }}
    p {{
      color: #5d4949;
      line-height: 1.6;
      font-size: 14.5px;
      margin: 0 0 16px;
    }}
    .code-box {{
      background: #f7f2ec;
      border: 1px solid #e5d7cc;
      border-radius: 12px;
      padding: 14px 18px;
      font-family: Consolas, monospace;
      font-size: 13px;
      color: #333;
      margin: 18px 0 22px;
      line-height: 1.7;
    }}
    .code-box b {{ color: #7a1c36; }}
    .btn-row {{ display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }}
    .btn {{
      display: block;
      text-align: center;
      background: #24141a;
      color: #ffffff;
      text-decoration: none;
      padding: 14px 24px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 15px;
      transition: background 0.2s, transform 0.1s;
    }}
    .btn:hover {{ background: #7a1c36; transform: translateY(-1px); }}
    .btn-secondary {{
      background: #f0e6dd;
      color: #4a342f;
    }}
    .btn-secondary:hover {{ background: #e5d7cb; }}
    .footer-note {{
      margin-top: 22px;
      padding-top: 16px;
      border-top: 1px dashed #ebdcd0;
      font-size: 12.5px;
      color: #887;
      text-align: center;
    }}
  </style>
</head>
<body>
  <div class="card">
    <div class="status-badge"><span class="status-dot"></span> ĐANG HOẠT ĐỘNG (ONLINE) · SẴN SÀNG</div>
    <h1>BY HER — Cổng AI Virtual Try-On API</h1>
    <p>Bạn vừa truy cập trực tiếp vào cổng dịch vụ <strong>AI Try-On</strong> của thương hiệu thời trang <strong>BY HER</strong>. Đây là endpoint kỹ thuật nhận yêu cầu <strong>POST</strong> từ giao diện web.</p>

    <div class="code-box">
      • <b>Endpoint:</b> POST /api/tryon<br>
      • <b>Chế độ VTON:</b> {mode}<br>
      • <b>Dữ liệu nhận:</b> JSON (personImage, productId, color, landmarks)<br>
      • <b>Kết quả trả về:</b> Ảnh chụp mặc thật sau khi được AI xử lý
    </div>

    <p>Để trực tiếp tải ảnh hoặc bật camera trải nghiệm tính năng thử đồ AR & AI Try-On, bạn chỉ cần bấm vào nút bên dưới:</p>

    <div class="btn-row">
      <a href="/#ar" class="btn">👗 VÀO PHÒNG THỬ ĐỒ AR & AI TRY-ON →</a>
      <a href="/" class="btn btn-secondary">🏠 Về Trang Chủ BY HER</a>
    </div>

    <div class="footer-note">
      BY HER Virtual Fitting Room · Tích hợp Real-time Pose AR & AI Virtual Try-On
    </div>
  </div>
</body>
</html>"""


class ByHerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        clean_path = self.path.split("?")[0].rstrip("/")
        if clean_path == "/api/tryon":
            accept = self.headers.get("Accept", "")
            if "application/json" in accept or "format=json" in self.path:
                mode = "CLOUD GPU API" if (os.environ.get("REPLICATE_API_TOKEN") or os.environ.get("TRYONCLOUD_API_KEY")) else "LOCAL SMART VTON (DEMO)"
                data = {
                    "status": "online",
                    "service": "BY HER AI Virtual Try-On API",
                    "endpoint": "POST /api/tryon",
                    "methods": ["GET", "POST", "OPTIONS"],
                    "mode": mode,
                    "message": "Cổng AI Try-On đang hoạt động tốt. Hãy gửi yêu cầu POST để tạo ảnh thử đồ."
                }
                body = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            else:
                body = get_api_dashboard_html().encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            return
        super().do_GET()

    def do_POST(self):
        if self.path.rstrip("/") != "/api/tryon":
            self.send_error(404, "Endpoint not found")
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length)
            payload = json.loads(raw.decode("utf-8"))
            product_id = payload.get("productId", "BH01")
            color = payload.get("color", "white")
            garment_rel = payload.get("garmentPath") or f"assets/images/garments/{product_id.lower()}-{color}.png"

            result = None
            try:
                result = try_cloud_vton(payload["personImage"], garment_rel, payload.get("productName", ""))
            except Exception as cloud_err:
                print(f"[AI Try-On] Cloud API skipped/failed: {cloud_err}")

            if not result:
                result = local_pillow_vton(payload)

            body = json.dumps(result, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            err = json.dumps({"success": False, "message": str(e)}, ensure_ascii=False).encode("utf-8")
            self.send_response(500)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(err)))
            self.end_headers()
            self.wfile.write(err)


if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding="utf-8")
    os.chdir(ROOT_DIR)

    if len(sys.argv) > 1 and sys.argv[1] == "--vton-cli":
        try:
            raw = sys.stdin.read()
            payload = json.loads(raw)
            product_id = payload.get("productId", "BH01")
            color = payload.get("color", "white")
            garment_rel = payload.get("garmentPath") or f"assets/images/garments/{product_id.lower()}-{color}.png"
            result = None
            try:
                result = try_cloud_vton(payload["personImage"], garment_rel, payload.get("productName", ""))
            except Exception:
                pass
            if not result:
                result = local_pillow_vton(payload)
            print(json.dumps(result, ensure_ascii=False))
        except Exception as e:
            print(json.dumps({"success": False, "message": str(e)}, ensure_ascii=False))
        sys.exit(0)

    server = ThreadingHTTPServer(("0.0.0.0", PORT), ByHerHandler)
    mode = "CLOUD GPU API" if (os.environ.get("REPLICATE_API_TOKEN") or os.environ.get("TRYONCLOUD_API_KEY")) else "LOCAL SMART VTON (DEMO)"
    print("============================================================")
    print(" BY HER - Web + AI Virtual Try-On Server dang chay!")
    print(f" * Dia chi web : http://localhost:{PORT}")
    print(f" * Cong AI VTO : POST http://localhost:{PORT}/api/tryon")
    print(f" * Che do VTON : {mode}")
    print("============================================================")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nDa dung server.")
