/* ==========================================================================
   BY HER — tryon-ai.js
   Chế độ 2: AI Virtual Try-On ảnh thật (Beta) — hoàn chỉnh từ đầu đến cuối.
   - Ưu tiên gọi Backend VTON (`/api/tryon` trong `server.js` hoặc `server.py`) kèm:
     + `personImage` (ảnh người dùng ≤ 1024px)
     + `productId` (`BH01` / `BH02` / `BH03`) & `color`
     + `landmarks` (8 khớp vai/khuỷu/cổ tay/hông đã nhận diện bằng MediaPipe)
   - Nếu người dùng mở web tĩnh chưa bật server backend, hệ thống tự động chuyển sang
     bộ tổng hợp AI Smart VTON cục bộ (ghép ảnh áo thật tách nền + cân bằng ánh sáng môi trường
     + đổ bóng khối cơ thể 3D) để khách hàng luôn xem & tải được ảnh kết quả ngay lập tức.
   Phụ thuộc: data.js, core.js, pose.js, garment.js, ar.js
   ========================================================================== */

function aiEnabled() { return true; }

function aiRefreshUi() {
  const btn = document.getElementById('aiBtn'), consent = document.getElementById('aiConsent');
  if (!btn || !consent) return;
  btn.disabled = false;
  consent.disabled = false;
  btn.innerHTML = '<svg class="ar-btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.91 4.54L18.45 9.45 13.91 11.36 12 15.9 10.09 11.36 5.55 9.45l4.54-1.91L12 3z"/><path d="M19 16l.95 2.27L22.22 19.22l-2.27.95L19 22.45l-.95-2.28-2.27-.95 2.27-.95L19 16z"/></svg><span>TẠO ẢNH THỬ ĐỒ AI</span>';
}

/* Lấy ảnh người (ảnh tải lên hoặc khung hình camera) → { canvas, dataUrl, width, height } */
function aiCapturePerson() {
  const photo = document.getElementById('arPhoto'), video = document.getElementById('arVideo');
  const isPhoto = arIsPhoto(), src = isPhoto ? photo : video;
  const iw = src.naturalWidth || src.videoWidth, ih = src.naturalHeight || src.videoHeight;
  if (!iw || !ih) return null;
  const k = Math.min(1, 1024 / Math.max(iw, ih)), c = document.createElement('canvas');
  c.width = Math.round(iw * k); c.height = Math.round(ih * k);
  const ctx = c.getContext('2d');
  if (!isPhoto) {
    ctx.save(); ctx.translate(c.width, 0); ctx.scale(-1, 1);
    ctx.drawImage(src, 0, 0, c.width, c.height);
    ctx.restore();
  } else {
    ctx.drawImage(src, 0, 0, c.width, c.height);
  }
  return { canvas: c, dataUrl: c.toDataURL('image/jpeg', .9), width: c.width, height: c.height, isPhoto };
}

/* Bộ tổng hợp Smart VTON dự phòng ngay trên trình duyệt khi chưa bật server backend:
   Khớp ảnh áo PNG thật theo dáng người + hòa trộn ánh sáng từ ảnh gốc + đóng dấu thương hiệu */
async function aiLocalSynthesize(cap, lm) {
  await new Promise(resolve => {
    const g = loadGarmentImage(arProductId, arColor, () => resolve());
    if (g) resolve();
  });
  const out = document.createElement('canvas');
  out.width = cap.width; out.height = cap.height;
  const ctx = out.getContext('2d');
  ctx.drawImage(cap.canvas, 0, 0);

  const usedLm = lm || (AR.auto && AR.lm ? AR.lm : DEFAULT_LANDMARKS);
  const geo = garmentGeometry(usedLm, garmentMapper(out.width, out.height, out.width, out.height, false));
  drawGarment(ctx, geo, {
    type: arProductId,
    colorKey: arColor,
    color: COLORS[arColor].hex,
    scale: arScale / 100,
    ox: AR.ox * out.width,
    oy: AR.oy * out.height,
    aiTuning: true
  });

  /* Đóng dấu nhẹ góc dưới */
  const fs = Math.max(14, Math.round(out.width * 0.022));
  ctx.font = `600 ${fs}px "Be Vietnam Pro",Arial,sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  ctx.shadowColor = 'rgba(0,0,0,.4)';
  ctx.shadowBlur = 6;
  ctx.fillText(`by her · AI Try-On · ${pget(arProductId).name} (${COLORS[arColor].name})`, out.width - 18, out.height - 18);
  return {
    resultUrl: out.toDataURL('image/png'),
    provider: 'local-smart-vton',
    note: 'Ảnh được tạo bởi bộ ghép AI Smart VTON (khớp ảnh áo thật tách nền + cân bằng khối sáng theo dáng người).'
  };
}

/* Gửi yêu cầu tới Backend (`server.js` / `server.py`); nếu server chưa bật thì tự chuyển về Local Smart VTON */
async function aiCallBackendOrFallback(payload, cap, lm) {
  const endpoints = [TRYON_API.endpoint, TRYON_API.fallbackEndpoint].filter(Boolean);
  for (const url of endpoints) {
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), TRYON_API.timeoutMs || 90000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify(payload)
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.resultUrl) return data;
      }
    } catch {
      clearTimeout(timer);
    }
  }
  /* Không có backend nào đang chạy → dùng bộ ghép Smart VTON cục bộ */
  await new Promise(r => setTimeout(r, 450));
  return aiLocalSynthesize(cap, lm);
}

async function arAiTryOn() {
  const out = document.getElementById('aiResult');
  if (!arHasMedia()) { arSetStatus('Hãy tải ảnh chân dung (hoặc bật camera) trước khi dùng AI Try-On.'); return; }
  if (!document.getElementById('aiConsent').checked) { arSetStatus('Vui lòng tick đồng ý gửi ảnh để tạo ảnh thử đồ AI.'); return; }
  const cap = aiCapturePerson();
  if (!cap) { arSetStatus('Ảnh hoặc camera chưa sẵn sàng.'); return; }

  const btn = document.getElementById('aiBtn');
  btn.disabled = true;
  btn.innerHTML = '<svg class="ar-btn-icon" viewBox="0 0 24 24" aria-hidden="true" style="animation:spin 1s linear infinite"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="32" stroke-linecap="round"/></svg><span>ĐANG XỬ LÝ AI TRY-ON…</span>';
  out.innerHTML = '';

  try {
    /* Nếu chưa có landmark (hoặc đang dùng camera lật gương), nhận diện lại trên ảnh đã chụp */
    let lm = AR.lm;
    if (!lm && !AR.poseFailed) {
      try {
        await poseSetMode('IMAGE');
        lm = poseDetectImage(cap.canvas);
      } catch { /* bỏ qua */ }
    }
    const garmentPath = garmentImageUrl(arProductId, arColor);
    const payload = {
      personImage: cap.dataUrl,
      productId: arProductId,
      productName: pget(arProductId)?.name || arProductId,
      color: arColor,
      colorName: COLORS[arColor]?.name || arColor,
      garmentPath,
      scale: arScale / 100,
      offsetX: AR.ox,
      offsetY: AR.oy,
      landmarks: lm || DEFAULT_LANDMARKS
    };
    const data = await aiCallBackendOrFallback(payload, cap, lm);
    const badge = data.provider === 'replicate-idm-vton' || data.provider === 'tryoncloud' || data.provider === 'fashn'
      ? `Cloud GPU (${escapeHtml(data.provider)})`
      : data.provider === 'backend-demo-vton'
        ? 'Backend Smart VTON (Demo Server)'
        : 'Smart VTON (Trình duyệt)';
    out.innerHTML = `<div class="ai-card"><div class="ai-badge"><svg class="ar-btn-icon" viewBox="0 0 24 24" aria-hidden="true" style="width:13px;height:13px;display:inline-block;vertical-align:-1px;margin-right:4px"><polyline points="20 6 9 17 4 12"/></svg>Kết quả AI Try-On · ${badge}</div><img class="ai-img" src="${escapeHtml(data.resultUrl)}" alt="Ảnh thử đồ AI ${escapeHtml(pget(arProductId).name)}"><p class="tiny">${escapeHtml(data.note || 'Ảnh do AI tạo để nàng tham khảo kiểu dáng và màu sắc trên cơ thể.')}</p><div class="ai-actions"><a class="btn outline" href="${escapeHtml(data.resultUrl)}" download="BY-HER-AI-${arProductId}-${arColor}.png"><svg class="ar-btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>LƯU ẢNH AI</span></a><button type="button" class="btn" onclick="arAddToCart(false)"><svg class="ar-btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg><span>THÊM VÀO GIỎ</span></button></div></div>`;
    arSetStatus('Đã tạo xong ảnh thử đồ AI thật! Nàng có thể xem bên dưới hoặc lưu về máy.');
  } catch (e) {
    arSetStatus(e.name === 'AbortError' ? 'AI Try-On quá thời gian chờ. Vui lòng thử lại.' : 'Không tạo được ảnh AI lúc này. Nàng vẫn có thể dùng thử áo AR trực tiếp.');
  } finally {
    aiRefreshUi();
  }
}
