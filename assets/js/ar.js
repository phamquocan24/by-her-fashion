/* ==========================================================================
   BY HER — ar.js
   Phòng thử áo AR: camera trực tiếp hoặc ảnh tải lên → nhận dạng dáng người (pose.js)
   → áo (garment.js) tự khớp vai/thân/tay → tinh chỉnh → gợi ý size → thêm giỏ / mua ngay.
   Riêng tư: mọi xử lý trong trình duyệt, không upload.
   Phụ thuộc: data.js, core.js, cart.js, arcode.js, pose.js, garment.js
   ========================================================================== */

let arProductId = 'BH01', arColor = 'yellow', arSize = 'M', arCameraStream = null, arPhotoUrl = null, arScale = 100;

/* Trạng thái thử áo: lm = landmark đã làm mượt; ox/oy = lệch thủ công (tỉ lệ so với khung) */
const AR = { lm: null, auto: true, ox: 0, oy: 0, mw: 0, mh: 0, drag: null, raf: 0, lastT: -1, miss: 0, poseFailed: false };

function arInitialize() {
  const sel = document.getElementById('arProduct');
  if (!sel.options.length) sel.innerHTML = products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  arProductId = pget(arProductId) ? arProductId : 'BH01';
  sel.value = arProductId;
  const p = pget(arProductId);
  if (!p.colors.includes(arColor)) arColor = p.colors[0];
  arRenderControls();
  preloadAllGarments(() => arRender());
  aiRefreshUi();
  arRender();
}

function openAR(id, color) {
  if (pget(id)) arProductId = id;
  const p = pget(arProductId);
  arColor = p.colors.includes(color) ? color : (p.colors.includes(arColor) ? arColor : p.colors[0]);
  go('ar');
}

function arChangeProduct(id) { arProductId = id; arColor = pget(id).colors[0]; arRenderControls(); arRender(); }
function arSetColor(c) { if (!pget(arProductId).colors.includes(c)) return; arColor = c; arRenderControls(); arRender(); }

function arRenderControls() {
  const p = pget(arProductId);
  document.getElementById('arProduct').value = arProductId;
  document.getElementById('arColorText').textContent = COLORS[arColor].name;
  document.getElementById('arSwatches').innerHTML = p.colors.map(c => `<button type="button" aria-label="Màu ${COLORS[c].name}" title="${COLORS[c].name}" class="swatch ${c === arColor ? 'selected' : ''}" style="background:${COLORS[c].hex};width:33px;height:33px" onclick="arSetColor('${c}')"></button>`).join('');
  document.getElementById('arSizes').innerHTML = ['S', 'M', 'L'].map(s => `<button type="button" class="size ${s === arSize ? 'on' : ''}" onclick="arSetSize('${s}')">${s}</button>`).join('');
  document.getElementById('arPrice').textContent = `${p.name} · ${money(p.price)}`;
  document.getElementById('arScale').value = arScale;
  document.getElementById('arScaleText').textContent = arScale + '%';
  renderArQr('arQr', arProductId, arColor, 130);
}

function arSetStatus(s) { document.getElementById('arStatus').textContent = s; }
function arHasMedia() { return document.getElementById('arStage').classList.contains('has-media'); }
function arIsPhoto() { return document.getElementById('arStage').classList.contains('photo-mode'); }

/* ---------------- Vẽ ---------------- */
function arResizeCanvas() {
  const cv = document.getElementById('arCanvas'), stage = document.getElementById('arStage');
  const dpr = Math.min(window.devicePixelRatio || 1, 2), W = stage.clientWidth, H = stage.clientHeight;
  if (!W || !H) return null;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, W, H };
}

/* Mirror: camera hiển thị lật gương; dùng fitMode = 'contain' khớp với kích thước thật của phần tử video/img */
function arPaint(ctx, W, H, mw, mh, mirror) {
  const lm = AR.auto && AR.lm ? AR.lm : DEFAULT_LANDMARKS;
  const fitMode = arIsPhoto() ? 'contain' : 'cover';
  const geo = garmentGeometry(lm, garmentMapper(W, H, mw, mh, mirror, fitMode));
  drawGarment(ctx, geo, {
    type: arProductId,
    colorKey: arColor,
    color: COLORS[arColor].hex,
    scale: arScale / 100,
    ox: AR.ox * W,
    oy: AR.oy * H,
    onImageLoad: () => arRender()
  });
}

function arRender() {
  const r = arResizeCanvas();
  if (!r) return;
  r.ctx.clearRect(0, 0, r.W, r.H);
  if (!arHasMedia() || !AR.mw) return;
  arPaint(r.ctx, r.W, r.H, AR.mw, AR.mh, !arIsPhoto());
}

/* ---------------- Dáng người ---------------- */
const AR_JOINTS = [11, 12, 13, 14, 15, 16, 23, 24];
function arApplyPose(lm) {
  if (!lm) {
    if (++AR.miss > 20 && AR.lm) { AR.lm = null; arSetStatus('Chưa thấy dáng người trong khung. Hãy đứng chính diện, thấy rõ vai và thân.'); }
    return;
  }
  if (AR.miss > 20) arSetStatus('Đã khớp áo theo dáng người. Có thể tinh chỉnh bằng cách kéo áo / thanh trượt.');
  AR.miss = 0;
  if (!AR.lm) { AR.lm = []; AR_JOINTS.forEach(i => AR.lm[i] = { ...lm[i] }); return; }
  AR_JOINTS.forEach(i => {   /* làm mượt chống rung */
    const o = AR.lm[i], n = lm[i];
    AR.lm[i] = { x: o.x + (n.x - o.x) * .55, y: o.y + (n.y - o.y) * .55, visibility: n.visibility };
  });
}

function arLoop() {
  AR.raf = requestAnimationFrame(arLoop);
  const v = document.getElementById('arVideo');
  if (!arCameraStream || v.readyState < 2 || !v.videoWidth) return;
  AR.mw = v.videoWidth; AR.mh = v.videoHeight;
  if (AR.auto && !AR.poseFailed && POSE.landmarker && POSE.mode === 'VIDEO' && v.currentTime !== AR.lastT) {
    AR.lastT = v.currentTime;
    try { arApplyPose(poseDetectVideo(v, performance.now())); } catch { /* khung hình lỗi — bỏ qua */ }
  }
  arRender();
}

async function arDetectPhoto() {
  const el = document.getElementById('arPhoto');
  AR.lm = null; AR.miss = 0;
  /* Vẽ ngay lập tức bằng khung chuẩn để khách thấy áo thật ngay tức thì (0 giây chờ) */
  arRender();
  if (!AR.auto) return;
  arSetStatus('Đang căn chỉnh áo theo dáng người trong ảnh…');
  try {
    await poseSetMode('IMAGE');
    const lm = poseDetectImage(el);
    if (lm) { arApplyPose(lm); arSetStatus('Đã khớp áo thật theo dáng người trong ảnh. Kéo áo / dùng thanh trượt để tinh chỉnh.'); }
    else arSetStatus('Đã đặt áo thật lên ảnh. Kéo áo hoặc dùng thanh trượt để căn chỉnh vừa vặn hơn.');
  } catch {
    AR.poseFailed = true;
    arSetStatus('Đã đặt áo thật lên ảnh. Kéo áo hoặc dùng thanh trượt để căn chỉnh vị trí.');
  }
  arRender();
}

function arToggleAuto(on) {
  AR.auto = !!on;
  AR.lm = null; AR.miss = 0;
  if (arHasMedia() && arIsPhoto()) arDetectPhoto(); else arRender();
}

/* ---------------- Tinh chỉnh ---------------- */
function arResize(v) { arScale = Number(v); document.getElementById('arScaleText').textContent = arScale + '%'; arRender(); }
function arReset() { AR.ox = 0; AR.oy = 0; arScale = 100; document.getElementById('arScale').value = 100; document.getElementById('arScaleText').textContent = '100%'; arRender(); }

/* ---------------- Camera / ảnh ---------------- */
function arStopCamera() {
  cancelAnimationFrame(AR.raf);
  if (arCameraStream) { arCameraStream.getTracks().forEach(t => t.stop()); arCameraStream = null; }
  const v = document.getElementById('arVideo');
  if (v) v.srcObject = null;
  const stage = document.getElementById('arStage');
  if (stage && !stage.classList.contains('photo-mode')) { stage.classList.remove('has-media'); AR.lm = null; }
  arSetStatus('Camera đã tắt. Ảnh của nàng chỉ được xử lý trong trình duyệt.');
  arRender();
}

async function arStartCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    arSetStatus('Trình duyệt không hỗ trợ camera tại địa chỉ này. Hãy mở website bằng HTTPS/localhost hoặc tải ảnh lên.');
    return;
  }
  arStopCamera();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 1200 } }, audio: false });
    arCameraStream = stream;
    const v = document.getElementById('arVideo');
    v.srcObject = stream;
    await v.play();
    const stage = document.getElementById('arStage');
    stage.classList.remove('photo-mode'); stage.classList.add('has-media');
    AR.lm = null; AR.miss = 0; AR.lastT = -1;
    arSetStatus('Camera đang bật trên thiết bị. BY HER không thu thập hình ảnh của nàng.');
    cancelAnimationFrame(AR.raf); AR.raf = requestAnimationFrame(arLoop);
    if (AR.auto) {
      arSetStatus('Đang tải bộ nhận dạng dáng người (lần đầu mất vài giây)…');
      try { await poseSetMode('VIDEO'); AR.poseFailed = false; arSetStatus('Đứng chính diện, thấy rõ vai và thân — áo sẽ tự khớp.'); }
      catch { AR.poseFailed = true; arSetStatus('Không tải được bộ nhận dạng dáng (cần Internet). Hãy kéo áo vào đúng vị trí thủ công.'); }
    }
  } catch (e) {
    arSetStatus('Không thể bật camera: ' + (e.name === 'NotAllowedError' ? 'chưa cấp quyền truy cập.' : 'hãy kiểm tra quyền camera hoặc sử dụng HTTPS.'));
  }
}

async function arUploadPhoto(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { arSetStatus('Vui lòng chọn file ảnh.'); return; }
  if (file.size > 15 * 1024 * 1024) { arSetStatus('Vui lòng chọn ảnh nhỏ hơn 15 MB.'); return; }
  arStopCamera();
  if (arPhotoUrl) URL.revokeObjectURL(arPhotoUrl);
  arPhotoUrl = URL.createObjectURL(file);
  const el = document.getElementById('arPhoto');
  el.src = arPhotoUrl;
  e.target.value = '';
  try { await el.decode(); } catch { arSetStatus('Không đọc được ảnh này. Hãy thử ảnh JPG/PNG khác.'); return; }
  AR.mw = el.naturalWidth; AR.mh = el.naturalHeight;
  document.getElementById('arStage').classList.add('photo-mode', 'has-media');
  arReset();
  await arDetectPhoto();
}

function arViewProduct() { openProduct(arProductId, arColor); }

/* ---------------- Gợi ý size theo bảng size BY HER ---------------- */
function arSetSize(s) { arSize = s; arRenderControls(); }

function arSuggestSize() {
  const h = Number(document.getElementById('arHeight').value), w = Number(document.getElementById('arWeight').value);
  const note = document.getElementById('arSizeNote');
  if (!h || !w || h < 100 || h > 220 || w < 25 || w > 200) { note.textContent = 'Nhập chiều cao (cm) và cân nặng (kg) hợp lệ, ví dụ 162 cm · 50 kg.'; return; }
  const r = suggestSize(h, w);
  arSize = r.size;
  arRenderControls();
  note.textContent = r.outOfRange
    ? `Số đo nằm ngoài bảng size BY HER — tạm gợi ý size ${arSize}. Vui lòng nhắn shop (0354 605 263) để được tư vấn.`
    : `Gợi ý size ${arSize} theo bảng size BY HER. Nếu nằm giữa hai size, nhắn shop để được tư vấn thêm.`;
}

function arAddToCart(buy) { addToCart(arProductId, arColor, arSize, 1, buy); }

/* ---------------- Lưu ảnh (cùng hàm vẽ với màn hình → ảnh lưu = ảnh đang xem) ---------------- */
function arSaveSnapshot() {
  const stage = document.getElementById('arStage'), photo = document.getElementById('arPhoto'), video = document.getElementById('arVideo');
  if (!arHasMedia()) { arSetStatus('Hãy bật camera hoặc tải ảnh lên trước khi lưu.'); return; }
  const isPhoto = arIsPhoto(), source = isPhoto ? photo : video;
  if (!source.naturalWidth && !source.videoWidth) { arSetStatus('Ảnh hoặc camera chưa sẵn sàng.'); return; }
  const iw = source.naturalWidth || source.videoWidth, ih = source.naturalHeight || source.videoHeight;
  const canvas = document.createElement('canvas');
  canvas.width = 1000; canvas.height = Math.round(1000 * ih / iw);
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  if (!isPhoto) { ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1); ctx.drawImage(video, 0, 0, W, H); ctx.restore(); } else ctx.drawImage(photo, 0, 0, W, H);
  arPaint(ctx, W, H, iw, ih, !isPhoto);
  ctx.font = '600 22px "Be Vietnam Pro",Arial,sans-serif'; ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 6;
  ctx.fillText(`by her · ${pget(arProductId).name} · ${COLORS[arColor].name}`, W - 24, H - 24);
  const a = document.createElement('a');
  a.download = `BY-HER-AR-${arProductId}-${arColor}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
  arSetStatus('Đã tạo ảnh thử áo. Nàng có thể lưu về thiết bị.');
}

/* Gắn sự kiện kéo áo + dọn dẹp khi rời trang. Gọi một lần từ main.js */
function arBindEvents() {
  const cv = document.getElementById('arCanvas'), stage = document.getElementById('arStage');
  cv.addEventListener('pointerdown', e => { e.preventDefault(); cv.setPointerCapture(e.pointerId); AR.drag = { x: e.clientX, y: e.clientY, ox: AR.ox, oy: AR.oy }; });
  cv.addEventListener('pointermove', e => {
    if (!AR.drag) return;
    const r = stage.getBoundingClientRect();
    AR.ox = Math.max(-.6, Math.min(.6, AR.drag.ox + (e.clientX - AR.drag.x) / r.width));
    AR.oy = Math.max(-.6, Math.min(.6, AR.drag.oy + (e.clientY - AR.drag.y) / r.height));
    arRender();
  });
  const end = () => { AR.drag = null; };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  window.addEventListener('resize', arRender);
  window.addEventListener('pagehide', () => {
    if (arCameraStream) arCameraStream.getTracks().forEach(t => t.stop());
    if (arPhotoUrl) URL.revokeObjectURL(arPhotoUrl);
  });
}
