/* ==========================================================================
   BY HER — vr.js
   Phòng trưng bày 360°: Xoay 360 độ từng mẫu quần áo độc lập trên bục 3D studio.
   - Chế độ 1: Tự động xoay 360° liên tục, mượt mà (có nút tạm dừng, đảo chiều).
   - Chế độ 2: Tự xoay thủ công (kéo chuột trên máy tính hoặc vuốt ngón tay trên điện thoại,
               thanh trượt góc 0°–360°, các nút góc nhìn nhanh).
   - Đổi kiểu áo (BH01, BH02, BH03) và màu sắc tức thì từ GARMENT_PNG.
   - Liên kết trực tiếp: Thử áo AR, Thêm giỏ hàng, Mua ngay.
   - Chạy 100% Canvas 2D/WebGL độc lập, tải 0 giây, không phụ thuộc thư viện ngoài.
   Phụ thuộc: data.js, core.js, cart.js
   ========================================================================== */

let vrProductId = 'BH01';
let vrColor = 'yellow';
let vrMode = 'auto'; // 'auto' | 'manual'
let vrAngle = 0; // 0 đến 360 độ
let vrTargetAngle = null; // tween về góc đích
let vrIsPlaying = true;
let vrDirection = 1; // 1: xoay sang phải, -1: xoay sang trái
let vrRotateSpeed = 0.28; // độ mỗi frame (tốc độ quay chậm rãi, êm ái chuẩn showroom thời trang)
let vrZoom = 1.0; // 0.75 đến 1.4

// Tương tác kéo chuột / vuốt cảm ứng
let vrIsDragging = false;
let vrDragStartX = 0;
let vrDragStartAngle = 0;
let vrLastDragX = 0;
let vrVelocity = 0;
let vrAnimFrameId = null;

// Cache ảnh áo
const vrImageCache = {};
let vrCurrentImage = null;
let vrIsImageLoading = false;

/* ==========================================
   KHỞI TẠO & ĐIỀU HƯỚNG
   ========================================== */

function openVR(id, color) {
  if (id && pget(id)) vrProductId = id;
  const p = pget(vrProductId);
  if (color && p.colors.includes(color)) {
    vrColor = color;
  } else if (!p.colors.includes(vrColor)) {
    vrColor = p.colors[0];
  }
  go('vr');
}

function vrSetStatus(s) {
  const el = document.getElementById('vrStatus');
  if (el) el.textContent = s;
}

function vrChangeProduct(id) {
  if (!pget(id)) return;
  vrProductId = id;
  const p = pget(id);
  if (!p.colors.includes(vrColor)) {
    vrColor = p.colors[0];
  }
  vrLoadGarment();
  vrRenderControls();
  vrUpdateStatusInfo();
}

function vrPickColor(c) {
  const p = pget(vrProductId);
  if (!p.colors.includes(c)) return;
  vrColor = c;
  vrLoadGarment();
  vrRenderControls();
  vrUpdateStatusInfo();
}

function vrUpdateStatusInfo() {
  const p = pget(vrProductId);
  const colorName = COLORS[vrColor]?.name || vrColor;
  vrSetStatus(`Đang ngắm: ${p.name} — Màu ${colorName} · ${money(p.price)} · Bục xoay 360° Studio`);
}

/* Tải ảnh áo PNG tách nền */
function vrLoadGarment() {
  const garmentSrc = (GARMENT_PNG[vrProductId] && GARMENT_PNG[vrProductId][vrColor])
    || (products.find(p => p.id === vrProductId)?.images[vrColor]?.[0] ? IMG[products.find(p => p.id === vrProductId).images[vrColor][0]] : '');

  if (!garmentSrc) return;

  const cacheKey = `${vrProductId}-${vrColor}`;
  if (vrImageCache[cacheKey]) {
    vrCurrentImage = vrImageCache[cacheKey];
    vrIsImageLoading = false;
    return;
  }

  vrIsImageLoading = true;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = garmentSrc;
  img.onload = () => {
    vrImageCache[cacheKey] = img;
    if (`${vrProductId}-${vrColor}` === cacheKey) {
      vrCurrentImage = img;
      vrIsImageLoading = false;
    }
  };
  img.onerror = () => {
    vrIsImageLoading = false;
    vrSetStatus('Không thể tải ảnh chi tiết mẫu áo này.');
  };
}

/* ==========================================
   RENDER CONTROLS GIAO DIỆN
   ========================================== */

function vrRenderControls() {
  // Cập nhật dropdown chọn kiểu áo
  const sel = document.getElementById('vrProduct');
  if (sel) {
    if (!sel.options.length) {
      sel.innerHTML = products.map(p => `<option value="${p.id}">${p.name} (${p.id})</option>`).join('');
    }
    sel.value = vrProductId;
  }

  // Cập nhật tên màu và swatches
  const p = pget(vrProductId);
  const colorText = document.getElementById('vrColorText');
  if (colorText) colorText.textContent = COLORS[vrColor]?.name || vrColor;

  const swatchesEl = document.getElementById('vrSwatches');
  if (swatchesEl) {
    swatchesEl.innerHTML = p.colors.map(c =>
      `<button type="button" aria-label="Màu ${COLORS[c].name}" title="${COLORS[c].name}" class="swatch ${c === vrColor ? 'selected' : ''}" style="background:${COLORS[c].hex};width:34px;height:34px" onclick="vrPickColor('${c}')"></button>`
    ).join('');
  }

  // Cập nhật UI Chế độ
  vrUpdateModeUI();

  // Cập nhật Slider góc & Zoom
  const slider = document.getElementById('vrAngleSlider');
  if (slider) slider.value = Math.round(vrAngle) % 360;
  const angleVal = document.getElementById('vrAngleValue');
  if (angleVal) angleVal.textContent = `${Math.round(vrAngle) % 360}°`;

  const zoomSlider = document.getElementById('vrZoomSlider');
  if (zoomSlider) zoomSlider.value = Math.round(vrZoom * 100);
  const zoomVal = document.getElementById('vrZoomValue');
  if (zoomVal) zoomVal.textContent = `${Math.round(vrZoom * 100)}%`;

  vrUpdatePlayPauseButton();
}

function vrUpdateModeUI() {
  const tabAuto = document.getElementById('vrTabAuto');
  const tabManual = document.getElementById('vrTabManual');
  const hudModeText = document.getElementById('vrHudModeText');
  const hudDot = document.getElementById('vrHudDot');
  const hint = document.getElementById('vrStageHint');

  if (vrMode === 'auto') {
    if (tabAuto) { tabAuto.classList.add('active'); tabAuto.setAttribute('aria-selected', 'true'); }
    if (tabManual) { tabManual.classList.remove('active'); tabManual.setAttribute('aria-selected', 'false'); }
    if (hudModeText) hudModeText.textContent = vrIsPlaying ? 'Tự động xoay 360°' : 'Tạm dừng xoay';
    if (hudDot) { hudDot.style.background = vrIsPlaying ? '#309b5f' : '#b27f30'; }
    if (hint) hint.classList.remove('show');
  } else {
    if (tabAuto) { tabAuto.classList.remove('active'); tabAuto.setAttribute('aria-selected', 'false'); }
    if (tabManual) { tabManual.classList.add('active'); tabManual.setAttribute('aria-selected', 'true'); }
    if (hudModeText) hudModeText.textContent = 'Tự xoay thủ công';
    if (hudDot) { hudDot.style.background = '#8c5261'; }
    if (hint) hint.classList.add('show');
  }
}

function vrUpdatePlayPauseButton() {
  const icon = document.getElementById('vrPlayPauseIcon');
  const btn = document.getElementById('vrBtnTogglePlay');
  if (!icon || !btn) return;
  if (vrIsPlaying && vrMode === 'auto') {
    icon.innerHTML = '<path d="M6 4h4v16H6zm8 0h4v16h-4z"/>';
    btn.title = 'Tạm dừng tự động xoay';
  } else {
    icon.innerHTML = '<path d="M8 5v14l11-7z"/>';
    btn.title = 'Tiếp tục tự động xoay';
  }
}

/* ==========================================
   CÁC HÀNH ĐỘNG ĐIỀU KHIỂN GÓC XOAY
   ========================================== */

function vrSetMode(mode) {
  vrMode = mode;
  if (mode === 'auto') {
    vrIsPlaying = true;
    vrTargetAngle = null;
  }
  vrUpdateModeUI();
  vrUpdatePlayPauseButton();
}

function vrTogglePlay() {
  if (vrMode === 'manual') {
    vrSetMode('auto');
    vrIsPlaying = true;
  } else {
    vrIsPlaying = !vrIsPlaying;
  }
  vrUpdateModeUI();
  vrUpdatePlayPauseButton();
}

function vrToggleDirection() {
  vrDirection = -vrDirection;
  toast(vrDirection > 0 ? 'Đã đổi: Xoay sang phải' : 'Đã đổi: Xoay sang trái');
}

function vrResetAngle() {
  vrSetAngle(0);
}

function vrSetAngle(target) {
  target = ((target % 360) + 360) % 360;
  vrTargetAngle = target;
  document.querySelectorAll('.vr-preset-btn').forEach(btn => btn.classList.remove('active'));
  const targetBtn = document.getElementById(`vrPreset${target}`);
  if (targetBtn) targetBtn.classList.add('active');
}

function vrOnSliderAngle(val) {
  vrMode = 'manual';
  vrIsPlaying = false;
  vrTargetAngle = null;
  vrAngle = parseFloat(val) % 360;
  vrUpdateModeUI();
  vrUpdatePlayPauseButton();
  vrUpdateHUD();
}

function vrOnSliderZoom(val) {
  vrZoom = parseFloat(val) / 100;
  const zoomVal = document.getElementById('vrZoomValue');
  if (zoomVal) zoomVal.textContent = `${Math.round(vrZoom * 100)}%`;
}

function vrAddToCart(buyNow) {
  addToCart(vrProductId, vrColor, 'M', 1, buyNow, false);
}

function vrViewProduct() {
  openProduct(vrProductId, vrColor);
}

/* Cập nhật HUD hiển thị góc xoay & preset */
function vrUpdateHUD() {
  const norm = ((Math.round(vrAngle) % 360) + 360) % 360;
  const hudAngle = document.getElementById('vrHudAngle');
  const slider = document.getElementById('vrAngleSlider');
  const angleVal = document.getElementById('vrAngleValue');

  let desc = 'Mặt trước';
  if (norm >= 25 && norm < 70) desc = 'Nghiêng trước (phải)';
  else if (norm >= 70 && norm < 115) desc = 'Cạnh bên (phải)';
  else if (norm >= 115 && norm < 160) desc = 'Nghiêng sau (phải)';
  else if (norm >= 160 && norm <= 200) desc = 'Mặt sau';
  else if (norm > 200 && norm <= 245) desc = 'Nghiêng sau (trái)';
  else if (norm > 245 && norm <= 290) desc = 'Cạnh bên (trái)';
  else if (norm > 290 && norm <= 335) desc = 'Nghiêng trước (trái)';

  if (hudAngle) hudAngle.textContent = `${norm}° · ${desc}`;
  if (slider && document.activeElement !== slider) slider.value = norm;
  if (angleVal) angleVal.textContent = `${norm}°`;

  [0, 45, 90, 180, 270].forEach(p => {
    const btn = document.getElementById(`vrPreset${p}`);
    if (btn) {
      if (Math.abs(norm - p) <= 4) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });
}

/* ==========================================
   ENGINE ĐỒ HỌA 3D 360° CANVAS
   ========================================== */

function vrRenderFrame() {
  const canvas = document.getElementById('vrCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  if (w <= 0 || h <= 0) return;

  // 1. Cập nhật góc xoay
  if (vrTargetAngle !== null) {
    let diff = vrTargetAngle - vrAngle;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    if (Math.abs(diff) < 0.3) {
      vrAngle = vrTargetAngle;
      vrTargetAngle = null;
    } else {
      vrAngle += diff * 0.18;
    }
    vrUpdateHUD();
  } else if (vrMode === 'auto' && vrIsPlaying && !vrIsDragging) {
    vrAngle = (vrAngle + vrRotateSpeed * vrDirection + 360) % 360;
    vrUpdateHUD();
  } else if (vrMode === 'manual' && !vrIsDragging && Math.abs(vrVelocity) > 0.02) {
    vrAngle = (vrAngle + vrVelocity + 360) % 360;
    vrVelocity *= 0.92;
    vrUpdateHUD();
  }

  const rad = (vrAngle * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);

  // 2. Nền Studio sang trọng
  ctx.clearRect(0, 0, w, h);

  const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.42, 40, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
  bgGrad.addColorStop(0, '#fffaf7');
  bgGrad.addColorStop(0.55, '#f7ebe6');
  bgGrad.addColorStop(1, '#ebd7d1');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Ánh sáng spotlight từ trần studio
  const spotGrad = ctx.createRadialGradient(w * 0.5, h * 0.15, 10, w * 0.5, h * 0.38, w * 0.45);
  spotGrad.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
  spotGrad.addColorStop(0.6, 'rgba(255, 248, 245, 0.25)');
  spotGrad.addColorStop(1, 'rgba(255, 245, 240, 0)');
  ctx.fillStyle = spotGrad;
  ctx.fillRect(0, 0, w, h);

  // 3. Tọa độ bục xoay 3D (Showroom Luxury Pedestal)
  const cx = w * 0.5;
  const cyPedestal = h * 0.82;
  const pedRadiusX = Math.min(w * 0.36, 190);
  const pedRadiusY = pedRadiusX * 0.28;
  const pedHeight = 22;

  // Bóng đổ của toàn bộ bục xoay xuống sàn
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cyPedestal + pedHeight + 8, pedRadiusX * 1.08, pedRadiusY * 1.12, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(78, 54, 58, 0.12)';
  ctx.filter = 'blur(10px)';
  ctx.fill();
  ctx.restore();

  // Thân bục 3D (Độ dày trụ)
  ctx.save();
  const rimGrad = ctx.createLinearGradient(cx - pedRadiusX, 0, cx + pedRadiusX, 0);
  rimGrad.addColorStop(0, '#c7a39b');
  rimGrad.addColorStop(0.25, '#ebd1cb');
  rimGrad.addColorStop(0.5, '#f4ded9');
  rimGrad.addColorStop(0.8, '#d4aea5');
  rimGrad.addColorStop(1, '#b08a82');

  ctx.fillStyle = rimGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cyPedestal + pedHeight, pedRadiusX, pedRadiusY, 0, 0, Math.PI);
  ctx.lineTo(cx - pedRadiusX, cyPedestal);
  ctx.ellipse(cx, cyPedestal, pedRadiusX, pedRadiusY, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#e7cbc5';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Mặt trên của bục xoay (Mặt đĩa elip)
  ctx.save();
  const topGrad = ctx.createRadialGradient(cx, cyPedestal - pedRadiusY * 0.2, 10, cx, cyPedestal, pedRadiusX);
  topGrad.addColorStop(0, '#fef9f7');
  topGrad.addColorStop(0.7, '#f2e1dc');
  topGrad.addColorStop(1, '#dfc4bc');
  ctx.fillStyle = topGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cyPedestal, pedRadiusX, pedRadiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d2b2aa';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Vành chia độ 360° xoay theo nhịp (Turntable degree ticks)
  const numTicks = 36;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < numTicks; i++) {
    const tickDeg = (i * 10 + vrAngle) % 360;
    const tickRad = (tickDeg * Math.PI) / 180;
    const cosT = Math.cos(tickRad);
    const sinT = Math.sin(tickRad);

    const isMain = (i % 9 === 0);
    const rInner = isMain ? 0.78 : 0.86;
    const x1 = cx + cosT * (pedRadiusX * rInner);
    const y1 = cyPedestal + sinT * (pedRadiusY * rInner);
    const x2 = cx + cosT * (pedRadiusX * 0.94);
    const y2 = cyPedestal + sinT * (pedRadiusY * 0.94);

    ctx.strokeStyle = isMain ? '#8f5763' : 'rgba(164, 106, 120, 0.4)';
    ctx.lineWidth = isMain ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();

  // Bóng đổ của áo xuống mặt bục xoay
  ctx.save();
  ctx.beginPath();
  const shadowScaleX = Math.max(0.3, Math.abs(cosA));
  ctx.ellipse(cx, cyPedestal - 4, pedRadiusX * 0.45 * shadowScaleX, pedRadiusY * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(73, 54, 58, 0.22)';
  ctx.filter = 'blur(6px)';
  ctx.fill();
  ctx.restore();

  // 4. Vẽ Áo 360° Ở Giữa Bục Xoay (PNG tách nền trong suốt 100%, không nền thừa, không chắp vá)
  if (vrCurrentImage && vrCurrentImage.complete && vrCurrentImage.naturalWidth > 0) {
    ctx.save();

    const cyGarment = cyPedestal - pedRadiusY * 0.5 - 12;
    const targetH = Math.min(h * 0.62, 420) * vrZoom;
    const aspect = vrCurrentImage.naturalWidth / vrCurrentImage.naturalHeight;
    const baseW = targetH * aspect;

    const absCos = Math.abs(cosA);
    // Độ dày cạnh áo khi nhìn nghiêng góc 90°/270°, giúp áo có khối lập thể tự nhiên
    const minThickness = 0.12;
    const effScaleX = (absCos * (1 - minThickness) + minThickness) * (cosA >= 0 ? 1 : -1);

    ctx.translate(cx, cyGarment);

    // Nghiêng nhẹ phối cảnh theo góc quay
    const tilt = sinA * 0.035;
    ctx.rotate(tilt);
    ctx.scale(effScaleX, 1);

    const drawX = -baseW * 0.5;
    const drawY = -targetH;

    // Vẽ trực tiếp ảnh áo PNG đã tách nền trong suốt - sạch sẽ 100%, không bị nền trắng hay khung chữ nhật
    ctx.drawImage(vrCurrentImage, drawX, drawY, baseW, targetH);

    ctx.restore();
  } else if (vrIsImageLoading) {
    ctx.save();
    ctx.translate(cx, cyPedestal - 120);
    ctx.strokeStyle = '#a46a78';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const spinRad = (Date.now() / 250) % (Math.PI * 2);
    ctx.arc(0, 0, 24, spinRad, spinRad + Math.PI * 1.5);
    ctx.stroke();

    ctx.fillStyle = '#69454f';
    ctx.font = '500 13px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Đang nạp áo 360°…', 0, 45);
    ctx.restore();
  }
}

/* ==========================================
   VÒNG LẶP ANIMATION CHÍNH
   ========================================== */

function vrAnimationLoop() {
  vrRenderFrame();
  vrAnimFrameId = requestAnimationFrame(vrAnimationLoop);
}

function vrResizeCanvas() {
  const stage = document.getElementById('vrStage');
  const canvas = document.getElementById('vrCanvas');
  if (!stage || !canvas) return;

  const rect = stage.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const displayW = Math.max(rect.width, 320);
  const displayH = Math.max(rect.height, 460);

  if (canvas.width !== Math.round(displayW * dpr) || canvas.height !== Math.round(displayH * dpr)) {
    canvas.width = Math.round(displayW * dpr);
    canvas.height = Math.round(displayH * dpr);
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }
}

/* ==========================================
   TƯƠNG TÁC KÉO CHUỘT / VUỐT CẢM ỨNG (DRAG TO ROTATE)
   ========================================== */

let vrEventsBound = false;

function vrSetupInteractions() {
  const stage = document.getElementById('vrStage');
  if (!stage || vrEventsBound) return;
  vrEventsBound = true;

  // Chuột (Desktop)
  stage.addEventListener('mousedown', (e) => {
    if (e.target.closest('.vr-stage-btn') || e.target.closest('.vr-hud')) return;
    vrIsDragging = true;
    vrDragStartX = e.clientX;
    vrDragStartAngle = vrAngle;
    vrLastDragX = e.clientX;
    vrVelocity = 0;
    vrTargetAngle = null;
    stage.classList.add('grabbing');
  });

  window.addEventListener('mousemove', (e) => {
    if (!vrIsDragging) return;
    const dx = e.clientX - vrDragStartX;
    const deltaX = e.clientX - vrLastDragX;
    vrVelocity = deltaX * 0.45;
    vrLastDragX = e.clientX;

    if (Math.abs(dx) > 3 && vrMode === 'auto') {
      vrSetMode('manual');
    }

    vrAngle = ((vrDragStartAngle + dx * 0.55) % 360 + 360) % 360;
    vrUpdateHUD();
  });

  window.addEventListener('mouseup', () => {
    if (vrIsDragging) {
      vrIsDragging = false;
      const stageEl = document.getElementById('vrStage');
      if (stageEl) stageEl.classList.remove('grabbing');
    }
  });

  // Cảm ứng (Touch - Mobile)
  stage.addEventListener('touchstart', (e) => {
    if (e.target.closest('.vr-stage-btn') || e.target.closest('.vr-hud')) return;
    if (e.touches.length === 1) {
      vrIsDragging = true;
      vrDragStartX = e.touches[0].clientX;
      vrDragStartAngle = vrAngle;
      vrLastDragX = e.touches[0].clientX;
      vrVelocity = 0;
      vrTargetAngle = null;
    }
  }, { passive: true });

  stage.addEventListener('touchmove', (e) => {
    if (!vrIsDragging || e.touches.length !== 1) return;
    const curX = e.touches[0].clientX;
    const dx = curX - vrDragStartX;
    const deltaX = curX - vrLastDragX;
    vrVelocity = deltaX * 0.45;
    vrLastDragX = curX;

    if (Math.abs(dx) > 4 && vrMode === 'auto') {
      vrSetMode('manual');
    }

    vrAngle = ((vrDragStartAngle + dx * 0.55) % 360 + 360) % 360;
    vrUpdateHUD();
  }, { passive: true });

  stage.addEventListener('touchend', () => {
    vrIsDragging = false;
  }, { passive: true });

  // Cuộn chuột để Zoom
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomDelta = -e.deltaY * 0.001;
    vrZoom = Math.min(1.4, Math.max(0.75, vrZoom + zoomDelta));
    const zoomSlider = document.getElementById('vrZoomSlider');
    const zoomVal = document.getElementById('vrZoomValue');
    if (zoomSlider) zoomSlider.value = Math.round(vrZoom * 100);
    if (zoomVal) zoomVal.textContent = `${Math.round(vrZoom * 100)}%`;
  }, { passive: false });
}

/* ==========================================
   LIFECYCLE GẮN & GỠ (MOUNT & UNMOUNT)
   ========================================== */

let vrIsMounted = false;
let vrResizeObserver = null;

function vrMount() {
  vrIsMounted = true;

  vrLoadGarment();
  vrRenderControls();
  vrUpdateStatusInfo();

  setTimeout(() => {
    vrResizeCanvas();
  }, 30);

  const stage = document.getElementById('vrStage');
  if (stage && window.ResizeObserver && !vrResizeObserver) {
    vrResizeObserver = new ResizeObserver(() => {
      vrResizeCanvas();
    });
    vrResizeObserver.observe(stage);
  }

  vrSetupInteractions();

  if (!vrAnimFrameId) {
    vrAnimFrameId = requestAnimationFrame(vrAnimationLoop);
  }
}

function vrUnmount() {
  vrIsMounted = false;
  if (vrAnimFrameId) {
    cancelAnimationFrame(vrAnimFrameId);
    vrAnimFrameId = null;
  }
  if (vrResizeObserver) {
    vrResizeObserver.disconnect();
    vrResizeObserver = null;
  }
}
