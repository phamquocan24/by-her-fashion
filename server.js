#!/usr/bin/env node
/**
 * ==========================================================================
 * BY HER — server.js (Zero-dependency Node.js Server)
 * Phục vụ website tĩnh (`http://localhost:8080`) và cổng `POST /api/tryon`.
 *
 * Hỗ trợ 2 chế độ:
 * 1) CHẾ ĐỘ CLOUD GPU THẬT (Khi có biến môi trường `REPLICATE_API_TOKEN` hoặc `TRYONCLOUD_API_KEY`):
 *    - Tự động chuyển tiếp ảnh người dùng + ảnh áo PNG tách nền sang Cloud GPU VTON
 *      và trả về ảnh kết quả photorealistic.
 * 2) CHẾ ĐỘ DEMO CỤC BỘ:
 *    - Nếu chạy `node server.js` mà chưa đặt API key, server trả tín hiệu để trình duyệt
 *      kích hoạt bộ ghép Smart VTON cục bộ (hoặc bạn có thể chạy `python server.py`
 *      để xử lý ảnh ngay trên backend bằng Pillow).
 *
 * Cách chạy:
 *   cd by-her
 *   node server.js
 * ==========================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function fileToDataUrl(relPath) {
  const full = path.join(ROOT, relPath);
  const buf = fs.readFileSync(full);
  return 'data:image/png;base64,' + buf.toString('base64');
}

async function callCloudVton(payload) {
  const replicateToken = (process.env.REPLICATE_API_TOKEN || '').trim();
  const tryonCloudKey = (process.env.TRYONCLOUD_API_KEY || '').trim();
  const productId = payload.productId || 'BH01';
  const color = payload.color || 'white';
  const garmentRel = payload.garmentPath || `assets/images/garments/${productId.toLowerCase()}-${color}.png`;
  const garmentDataUrl = fileToDataUrl(garmentRel);

  if (tryonCloudKey) {
    const res = await fetch('https://api.tryoncloud.com/api/v1/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tryonCloudKey}` },
      body: JSON.stringify({ person_image: payload.personImage, garment_image: garmentDataUrl, category: 'upper_body' })
    });
    if (res.ok) {
      const data = await res.json();
      const outUrl = data.result_url || data.image_url || data.output;
      if (outUrl) return { success: true, resultUrl: outUrl, provider: 'tryoncloud', note: 'Ảnh được sinh bởi Cloud GPU (TryOnCloud VTON API).' };
    }
  }

  if (replicateToken) {
    const res = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${replicateToken}`,
        Prefer: 'wait=60'
      },
      body: JSON.stringify({
        version: 'c871bb9b046607b680449ecbae55fd8c6d945e0a1948644bf2361b3d021d3ff4',
        input: {
          human_img: payload.personImage,
          garm_img: garmentDataUrl,
          garment_des: payload.productName || 'women basic top shirt',
          category: 'upper_body',
          crop: false,
          steps: 30
        }
      })
    });
    if (res.ok) {
      const pred = await res.json();
      const outUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output;
      if (typeof outUrl === 'string' && outUrl) {
        return { success: true, resultUrl: outUrl, provider: 'replicate-idm-vton', note: 'Ảnh được sinh bởi mô hình Diffusion IDM-VTON trên Cloud GPU.' };
      }
    }
  }
  return null;
}

const { spawn } = require('child_process');

function getApiDashboardHtml() {
  const mode = (process.env.REPLICATE_API_TOKEN || process.env.TRYONCLOUD_API_KEY) ? 'CLOUD GPU API' : 'LOCAL SMART VTON (DEMO)';
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BY HER — AI Virtual Try-On API</title>
  <link rel="icon" type="image/svg+xml" href="/assets/images/favicon.svg">
  <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #faf6f0;
      color: #2b2b2b;
      margin: 0;
      padding: 40px 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .card {
      max-width: 620px;
      width: 100%;
      background: #ffffff;
      padding: 36px 32px;
      border-radius: 20px;
      box-shadow: 0 16px 40px rgba(38, 20, 26, 0.08);
      border: 1px solid #eadcd0;
      text-align: left;
    }
    .status-badge {
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
    }
    .status-dot {
      width: 8px;
      height: 8px;
      background: #4caf50;
      border-radius: 50%;
      box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.25);
    }
    h1 {
      font-size: 22px;
      margin: 0 0 10px;
      color: #24141a;
      letter-spacing: -0.02em;
    }
    p {
      color: #5d4949;
      line-height: 1.6;
      font-size: 14.5px;
      margin: 0 0 16px;
    }
    .code-box {
      background: #f7f2ec;
      border: 1px solid #e5d7cc;
      border-radius: 12px;
      padding: 14px 18px;
      font-family: Consolas, monospace;
      font-size: 13px;
      color: #333;
      margin: 18px 0 22px;
      line-height: 1.7;
    }
    .code-box b { color: #7a1c36; }
    .btn-row { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
    .btn {
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
    }
    .btn:hover { background: #7a1c36; transform: translateY(-1px); }
    .btn-secondary {
      background: #f0e6dd;
      color: #4a342f;
    }
    .btn-secondary:hover { background: #e5d7cb; }
    .footer-note {
      margin-top: 22px;
      padding-top: 16px;
      border-top: 1px dashed #ebdcd0;
      font-size: 12.5px;
      color: #887;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="status-badge"><span class="status-dot"></span> ĐANG HOẠT ĐỘNG (ONLINE) · SẴN SÀNG</div>
    <h1>BY HER — Cổng AI Virtual Try-On API</h1>
    <p>Bạn vừa truy cập trực tiếp vào cổng dịch vụ <strong>AI Try-On</strong> của thương hiệu thời trang <strong>BY HER</strong>. Đây là endpoint kỹ thuật nhận yêu cầu <strong>POST</strong> từ giao diện web.</p>

    <div class="code-box">
      • <b>Endpoint:</b> POST /api/tryon<br>
      • <b>Chế độ VTON:</b> ${mode}<br>
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
</html>`;
}

function runPythonVton(payload) {
  return new Promise(resolve => {
    try {
      const py = spawn('python', [path.join(ROOT, 'server.py'), '--vton-cli'], {
        cwd: ROOT,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      let out = '', err = '';
      py.stdout.on('data', d => { out += d.toString('utf-8'); });
      py.stderr.on('data', d => { err += d.toString('utf-8'); });
      py.on('close', code => {
        if (code === 0 && out.trim()) {
          try {
            const data = JSON.parse(out.trim());
            return resolve(data);
          } catch (_) {}
        }
        resolve(null);
      });
      py.on('error', () => resolve(null));
      py.stdin.write(JSON.stringify(payload));
      py.stdin.end();
    } catch (_) {
      resolve(null);
    }
  });
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  if (req.method === 'GET' && (urlPath === '/health' || urlPath === '/api/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), time: new Date().toISOString() }));
  }

  if (req.method === 'POST' && urlPath === '/api/log') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const outDir = path.join(ROOT, '..', 'scratch');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        fs.appendFileSync(path.join(outDir, 'client_err.log'), body + '\n');
        console.log('[CLIENT ERROR]', body);
      } catch (_) {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  if (req.method === 'POST' && urlPath === '/api/save_test') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const base64Data = body.replace(/^data:image\/\w+;base64,/, '');
        const buf = Buffer.from(base64Data, 'base64');
        const outDir = path.join(ROOT, '..', 'scratch');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'test_canvas.png'), buf);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (urlPath.replace(/\/$/, '') === '/api/tryon') {
    if (req.method === 'GET') {
      const accept = req.headers.accept || '';
      if (accept.includes('application/json') || (req.url && req.url.includes('format=json'))) {
        const mode = (process.env.REPLICATE_API_TOKEN || process.env.TRYONCLOUD_API_KEY) ? 'CLOUD GPU API' : 'LOCAL SMART VTON (DEMO)';
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
          status: 'online',
          service: 'BY HER AI Virtual Try-On API',
          endpoint: 'POST /api/tryon',
          methods: ['GET', 'POST', 'OPTIONS'],
          mode,
          message: 'Cổng AI Try-On đang hoạt động bình thường 🟢. Hãy gửi yêu cầu POST với payload JSON để tạo ảnh thử đồ.'
        }, null, 2));
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(getApiDashboardHtml());
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; if (body.length > 20 * 1024 * 1024) req.destroy(); });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body);
          const cloud = await callCloudVton(payload);
          if (cloud) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify(cloud));
          }
          /* Thử xử lý nội bộ qua Python Pillow */
          const pyRes = await runPythonVton(payload);
          if (pyRes && pyRes.success) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify(pyRes));
          }
          /* Fallback sang client Smart VTON Canvas */
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, fallback: 'client-smart-vton' }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, message: e.message }));
        }
      });
      return;
    }
  }

  let filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    return res.end('Not found');
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log('============================================================');
  console.log(` BY HER — Node.js Server đang chạy tại http://localhost:${PORT}`);
  console.log(` • Cổng AI Try-On: POST http://localhost:${PORT}/api/tryon`);
  console.log('============================================================');
});
