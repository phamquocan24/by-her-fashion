/* ==========================================================================
   BY HER — garment.js
   Hệ thống dựng & khớp ẢNH ÁO THẬT ĐÃ TÁCH NỀN (.png trong suốt, đã khoét lỗ cổ)
   bằng Lưới Biến Dạng Động Lực Học Mềm Mại (Anatomical Dual-Spline Ribbon Mesh):
   - Cầu vai, cổ vuông/tròn/tim, quai áo & toàn bộ thân áo:
     Dựng nguyên khối 100% trong MỘT lượt vẽ duy nhất theo phép Affine chuẩn xác,
     KHÔNG cắt xẻ thân áo thành các tam giác nhỏ nên bề mặt vải phẳng mịn tuyệt đối,
     không có bất kỳ đường sọc hay vết rạn nào, quai áo & cổ áo liền khít hoàn hảo.
   - Ống tay dài (BH01):
     + Khi đứng yên / tay buông tự nhiên: hiển thị 100% ảnh chụp áo thật nguyên bản sắc nét.
     + Khi giơ tay / gập cánh tay: ống tay uốn cong mềm mại theo đường cong spline giải phẫu
       (Vai -> Khuỷu tay -> Cổ tay) với khớp fillet bo tròn tự nhiên tại khuỷu,
       nối liền khít 100% tại chân nách (v = 0.301) mà không có bất kỳ khe hở nào!
   ========================================================================== */

const GARMENT_STYLES = {
  BH01: {
    neck: 'square',
    sleeve: 'long',
    shL: { u: 0.215, v: 0.068 },
    shR: { u: 0.785, v: 0.068 },
    hipC: { u: 0.500, v: 0.880 },
    widthBoost: 1.15,
    torsoLenMul: 1.15
  },
  BH02: {
    neck: 'round',
    sleeve: 'short',
    shL: { u: 0.205, v: 0.088 },
    shR: { u: 0.795, v: 0.088 },
    hipC: { u: 0.500, v: 0.910 },
    widthBoost: 1.14,
    torsoLenMul: 1.15
  },
  BH03: {
    neck: 'v',
    sleeve: 'short',
    shL: { u: 0.195, v: 0.082 },
    shR: { u: 0.805, v: 0.082 },
    hipC: { u: 0.500, v: 0.910 },
    widthBoost: 1.14,
    torsoLenMul: 1.15
  }
};

/* Vị trí mặc định (tọa độ chuẩn hóa 0..1) khi chưa nhận dạng được người */
const DEFAULT_LANDMARKS = (() => {
  const a = [];
  a[11] = { x: .36, y: .32 }; a[12] = { x: .64, y: .32 };
  a[13] = { x: .30, y: .52 }; a[14] = { x: .70, y: .52 };
  a[15] = { x: .27, y: .72 }; a[16] = { x: .73, y: .72 };
  a[23] = { x: .41, y: .72 }; a[24] = { x: .59, y: .72 };
  return a;
})();

const GARMENT_VIS_MIN = 0.40;
const GARMENT_CACHE = {};

function garmentImageUrl(type, color) {
  const map = (typeof GARMENT_PNG !== 'undefined' && GARMENT_PNG[type]) || {};
  return map[color] || map[Object.keys(map)[0]] || '';
}

function loadGarmentImage(type, color, onReady) {
  const url = garmentImageUrl(type, color);
  if (!url) return null;
  let entry = GARMENT_CACHE[url];
  if (!entry) {
    const img = new Image();
    entry = GARMENT_CACHE[url] = { img, loaded: false, error: false, cbs: [] };
    if (onReady) entry.cbs.push(onReady);
    img.onload = () => {
      entry.loaded = true;
      const list = entry.cbs.splice(0);
      list.forEach(fn => { try { fn(img); } catch { /* bỏ qua */ } });
    };
    img.onerror = () => { entry.error = true; entry.cbs.length = 0; };
    img.src = url;
  } else if (!entry.loaded && !entry.error && onReady) {
    entry.cbs.push(onReady);
  }
  return entry.loaded ? entry.img : null;
}

function preloadAllGarments(onEach) {
  if (typeof GARMENT_PNG === 'undefined') return;
  Object.keys(GARMENT_PNG).forEach(type => {
    Object.keys(GARMENT_PNG[type]).forEach(color => loadGarmentImage(type, color, onEach));
  });
}

function gDist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function gLerp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }

function garmentMapper(W, H, mw, mh, mirror, fitMode) {
  const s = fitMode === 'contain' ? Math.min(W / mw, H / mh) : Math.max(W / mw, H / mh);
  const dx = (W - mw * s) / 2, dy = (H - mh * s) / 2;
  return p => ({ x: mirror ? W - (dx + p.x * mw * s) : dx + p.x * mw * s, y: dy + p.y * mh * s });
}

/* Giải ma trận Affine 2D biến 3 điểm nguồn (s0, s1, s2) thành 3 điểm đích (d0, d1, d2) */
function applyTriangleTransform(ctx, s0, s1, s2, d0, d1, d2) {
  const sx1 = s1.x - s0.x, sy1 = s1.y - s0.y;
  const sx2 = s2.x - s0.x, sy2 = s2.y - s0.y;
  const det = sx1 * sy2 - sx2 * sy1;
  if (Math.abs(det) < 1e-5) return false;
  const invDet = 1 / det;
  const dx1 = d1.x - d0.x, dy1 = d1.y - d0.y;
  const dx2 = d2.x - d0.x, dy2 = d2.y - d0.y;
  const a = (dx1 * sy2 - dx2 * sy1) * invDet;
  const c = (-dx1 * sx2 + dx2 * sx1) * invDet;
  const b = (dy1 * sy2 - dy2 * sy1) * invDet;
  const d = (-dy1 * sx2 + dy2 * sx1) * invDet;
  const e = d0.x - a * s0.x - c * s0.y;
  const f = d0.y - b * s0.x - d * s0.y;
  ctx.transform(a, b, c, d, e, f);
  return true;
}

/* Ánh xạ điểm chuẩn hóa (u, v) trên ảnh PNG sang tọa độ màn hình theo ma trận Affine của thân áo */
function mapAffinePt(uNorm, vNorm, iw, ih, srcShL, srcShR, srcHip, dstShL, dstShR, dstHip) {
  const sx = uNorm * iw, sy = vNorm * ih;
  const sx1 = srcShR.x - srcShL.x, sy1 = srcShR.y - srcShL.y;
  const sx2 = srcHip.x - srcShL.x, sy2 = srcHip.y - srcShL.y;
  const det = sx1 * sy2 - sx2 * sy1 || 1;
  const t1 = ((sx - srcShL.x) * sy2 - (sy - srcShL.y) * sx2) / det;
  const t2 = (-(sx - srcShL.x) * sy1 + (sy - srcShL.y) * sx1) / det;
  return {
    x: dstShL.x + t1 * (dstShR.x - dstShL.x) + t2 * (dstHip.x - dstShL.x),
    y: dstShL.y + t1 * (dstShR.y - dstShL.y) + t2 * (dstHip.y - dstShL.y)
  };
}

/* Vẽ tam giác vân ảnh với độ phủ viền khử răng cưa mượt */
function drawMeshTri(ctx, img, s0, s1, s2, d0, d1, d2) {
  const cx = (d0.x + d1.x + d2.x) / 3, cy = (d0.y + d1.y + d2.y) / 3;
  const expand = pt => {
    const dx = pt.x - cx, dy = pt.y - cy, l = Math.hypot(dx, dy) || 1;
    return { x: pt.x + (dx / l) * 1.5, y: pt.y + (dy / l) * 1.5 };
  };
  const p0 = expand(d0), p1 = expand(d1), p2 = expand(d2);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.closePath();
  ctx.clip();
  if (applyTriangleTransform(ctx, s0, s1, s2, d0, d1, d2)) {
    ctx.drawImage(img, 0, 0);
  }
  ctx.restore();
}

/* Từ landmark → hình học giải phẫu (vai, khuỷu, cổ tay, hông) */
function garmentGeometry(lm, map) {
  const vis = i => lm[i] && (lm[i].visibility === undefined || lm[i].visibility >= GARMENT_VIS_MIN);
  const P = i => map(lm[i]);
  const a = P(11), b = P(12);
  const ids = a.x <= b.x ? [[11, 13, 15, 23], [12, 14, 16, 24]] : [[12, 14, 16, 24], [11, 13, 15, 23]];
  const side = s => ({
    sh: P(s[0]),
    el: s[1] && lm[s[1]] ? P(s[1]) : null,
    wr: s[2] && lm[s[2]] ? P(s[2]) : null,
    hip: s[3] && lm[s[3]] ? P(s[3]) : null,
    elOk: vis(s[1]),
    wrOk: vis(s[2]),
    hipOk: vis(s[3])
  });
  const L = side(ids[0]), R = side(ids[1]);
  const w = Math.max(gDist(L.sh, R.sh), 1);
  const N = gLerp(L.sh, R.sh, .5);
  let ux = R.sh.x - L.sh.x, uy = R.sh.y - L.sh.y;
  const ul = Math.hypot(ux, uy) || 1;
  const u = { x: ux / ul, y: uy / ul }, v = { x: -u.y, y: u.x };

  const hipsOk = L.hipOk && R.hipOk && L.hip && R.hip;
  let hipCenter = hipsOk ? gLerp(L.hip, R.hip, .5) : { x: N.x + v.x * 1.28 * w, y: N.y + v.y * 1.28 * w };
  let torsoVec = { x: hipCenter.x - N.x, y: hipCenter.y - N.y };
  let torsoLen = Math.hypot(torsoVec.x, torsoVec.y);
  if (!hipsOk || torsoLen < 0.98 * w || torsoLen > 1.55 * w) {
    torsoLen = 1.28 * w;
    hipCenter = { x: N.x + v.x * torsoLen, y: N.y + v.y * torsoLen };
  } else {
    const lateral = Math.max(-0.14 * w, Math.min(0.14 * w, torsoVec.x * u.x + torsoVec.y * u.y));
    const vertical = Math.max(1.05 * w, Math.min(1.42 * w, torsoVec.x * v.x + torsoVec.y * v.y));
    torsoLen = Math.hypot(lateral, vertical);
    hipCenter = { x: N.x + u.x * lateral + v.x * vertical, y: N.y + u.y * lateral + v.y * vertical };
  }
  const p = (x, y) => ({ x: N.x + u.x * x + v.x * y, y: N.y + u.y * x + v.y * y });
  return { N, u, v, w, Ht: torsoLen, hipCenter, p, L, R, hipsOk };
}

/* Kiểm tra xem cánh tay có đang gập / giơ lên / dang rộng hay không */
function checkArmActive(sh, el, wr, w) {
  if (!el || !wr) return false;
  /* 1. Bàn tay nâng cao hơn khuỷu tay */
  if (wr.y < el.y + 0.08 * w) return true;
  /* 2. Góc gập khuỷu tay (góc giữa bắp tay và cẳng tay < 145 độ) */
  const v1x = sh.x - el.x, v1y = sh.y - el.y;
  const v2x = wr.x - el.x, v2y = wr.y - el.y;
  const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
  if (l1 > 1e-2 && l2 > 1e-2) {
    const cosAng = (v1x * v2x + v1y * v2y) / (l1 * l2);
    if (cosAng > -0.80) return true;
  }
  /* 3. Khuỷu tay dang rộng ra khỏi thân áo */
  const dx = Math.abs(el.x - sh.x);
  const dy = el.y - sh.y;
  if (dy > 1e-2 && (dx / dy) > 0.45) return true;
  return false;
}

/* Bộ đệm offscreen để gộp lưới thành 1 hình duy nhất trước khi áp bóng đổ */
let GARMENT_BUFFER = null;
function getGarmentBuffer(W, H) {
  if (!GARMENT_BUFFER) GARMENT_BUFFER = document.createElement('canvas');
  if (GARMENT_BUFFER.width !== W || GARMENT_BUFFER.height !== H) {
    GARMENT_BUFFER.width = W;
    GARMENT_BUFFER.height = H;
  } else {
    GARMENT_BUFFER.getContext('2d').clearRect(0, 0, W, H);
  }
  return GARMENT_BUFFER;
}

/* ==========================================================================
   BẢNG LÁT CẮT TOÀN DIỆN ỐNG TAY BH01 (Từ đầu vai v=0.080 đến cổ tay v=0.950)
   Cấu trúc mỗi lát: [uOut, vOut, uIn, vIn, widthNorm]
   ========================================================================== */
const BH01_RIGHT_SLEEVE_SLICES = [
  [0.8376, 0.0800, 0.7527, 0.0800, 0.1300],
  [0.8538, 0.1258, 0.7600, 0.1258, 0.1300],
  [0.8645, 0.1716, 0.7600, 0.1716, 0.1300],
  [0.8710, 0.2174, 0.7570, 0.2174, 0.1300],
  [0.8774, 0.2632, 0.7441, 0.2632, 0.1300],
  [0.8817, 0.3089, 0.7516, 0.3089, 0.1280],
  [0.8871, 0.3547, 0.7613, 0.3547, 0.1260],
  [0.8925, 0.4005, 0.7720, 0.4005, 0.1240],
  [0.8989, 0.4463, 0.7817, 0.4463, 0.1220],
  [0.9065, 0.4921, 0.7817, 0.4921, 0.1220],
  [0.9140, 0.5379, 0.8011, 0.5379, 0.1200],
  [0.9237, 0.5837, 0.8022, 0.5837, 0.1200],
  [0.9333, 0.6295, 0.8097, 0.6295, 0.1200],
  [0.9419, 0.6753, 0.8215, 0.6753, 0.1180],
  [0.9495, 0.7211, 0.8387, 0.7211, 0.1150],
  [0.9581, 0.7668, 0.8527, 0.7668, 0.1120],
  [0.9677, 0.8126, 0.8548, 0.8126, 0.1100],
  [0.9763, 0.8584, 0.8742, 0.8584, 0.1080],
  [0.9849, 0.9042, 0.8925, 0.9042, 0.1060],
  [0.9925, 0.9500, 0.8871, 0.9500, 0.1054]
];

const BH01_LEFT_SLEEVE_SLICES = [
  [0.1624, 0.0800, 0.2473, 0.0800, 0.1300],
  [0.1462, 0.1258, 0.2400, 0.1258, 0.1300],
  [0.1355, 0.1716, 0.2400, 0.1716, 0.1300],
  [0.1290, 0.2174, 0.2430, 0.2174, 0.1300],
  [0.1226, 0.2632, 0.2559, 0.2632, 0.1300],
  [0.1183, 0.3089, 0.2484, 0.3089, 0.1280],
  [0.1129, 0.3547, 0.2387, 0.3547, 0.1260],
  [0.1075, 0.4005, 0.2280, 0.4005, 0.1240],
  [0.1011, 0.4463, 0.2183, 0.4463, 0.1220],
  [0.0935, 0.4921, 0.2183, 0.4921, 0.1220],
  [0.0860, 0.5379, 0.1989, 0.5379, 0.1200],
  [0.0763, 0.5837, 0.1978, 0.5837, 0.1200],
  [0.0667, 0.6295, 0.1903, 0.6295, 0.1200],
  [0.0581, 0.6753, 0.1785, 0.6753, 0.1180],
  [0.0505, 0.7211, 0.1613, 0.7211, 0.1150],
  [0.0419, 0.7668, 0.1473, 0.7668, 0.1120],
  [0.0323, 0.8126, 0.1452, 0.8126, 0.1100],
  [0.0237, 0.8584, 0.1258, 0.8584, 0.1080],
  [0.0151, 0.9042, 0.1075, 0.9042, 0.1060],
  [0.0075, 0.9500, 0.1129, 0.9500, 0.1054]
];

/* Vẽ ống tay áo BH01 bằng đường spline giải phẫu liên tục */
function drawRibbonSleeve(bctx, img, isLeft, sideObj, w, iw, ih, mapFn, ox, oy, fabricColor, N) {
  const slices = isLeft ? BH01_LEFT_SLEEVE_SLICES : BH01_RIGHT_SLEEVE_SLICES;
  const K = slices.length;
  const scaleFactor = (w / (0.57 * iw));

  /* Tọa độ nách & vai: khớp nối giải phẫu chính xác với vòng nách áo (armhole) */
  const topCen = isLeft ? mapFn(0.215, 0.068) : mapFn(0.785, 0.068);

  /* Điểm mặc định lúc buông tay */
  const restEl = isLeft ? mapFn(0.081, 0.538) : mapFn(0.917, 0.538);
  const restWr = isLeft ? mapFn(0.004, 0.950) : mapFn(0.997, 0.950);

  const L_upper_natural = Math.hypot(restEl.x - topCen.x, restEl.y - topCen.y);
  const L_fore_natural  = Math.hypot(restWr.x - restEl.x, restWr.y - restEl.y);

  const hasEl = sideObj.elOk && sideObj.el;
  const hasWr = sideObj.wrOk && sideObj.wr;

  let pEl = hasEl ? { x: sideObj.el.x + ox, y: sideObj.el.y + oy } : restEl;
  let pWr = hasWr ? { x: sideObj.wr.x + ox, y: sideObj.wr.y + oy } : restWr;

  /* Bảo toàn chiều dài tự nhiên của cánh tay khi uốn gập hoặc giơ cao */
  const dirUpper = { x: pEl.x - topCen.x, y: pEl.y - topCen.y };
  const lenUpper = Math.hypot(dirUpper.x, dirUpper.y);
  if (lenUpper > 1e-2) {
    const kLen = Math.max(0.85, Math.min(1.15, lenUpper / L_upper_natural));
    pEl = {
      x: topCen.x + (dirUpper.x / lenUpper) * (L_upper_natural * kLen),
      y: topCen.y + (dirUpper.y / lenUpper) * (L_upper_natural * kLen)
    };
  } else {
    pEl = restEl;
  }

  const dirFore = { x: pWr.x - pEl.x, y: pWr.y - pEl.y };
  const lenFore = Math.hypot(dirFore.x, dirFore.y);
  if (lenFore > 1e-2) {
    const kFore = Math.max(0.85, Math.min(1.15, lenFore / L_fore_natural));
    pWr = {
      x: pEl.x + (dirFore.x / lenFore) * (L_fore_natural * kFore),
      y: pEl.y + (dirFore.y / lenFore) * (L_fore_natural * kFore)
    };
  } else {
    pWr = { x: pEl.x + (restWr.x - restEl.x), y: pEl.y + (restWr.y - restEl.y) };
  }

  /* Đường spline giải phẫu mềm với khớp fillet bo tròn tại khuỷu tay (tEl ~ 0.50) */
  const P0 = topCen, P1 = pEl, P2 = pWr;
  const tEl = 0.50, rFillet = 0.18;

  function getSpine(t) {
    if (t < tEl - rFillet) {
      const s = t / tEl;
      const pos = { x: P0.x + (P1.x - P0.x) * s, y: P0.y + (P1.y - P0.y) * s };
      const dx = P1.x - P0.x, dy = P1.y - P0.y, l = Math.hypot(dx, dy) || 1;
      return { pos, tang: { x: dx / l, y: dy / l } };
    } else if (t > tEl + rFillet) {
      const s = (t - tEl) / (1 - tEl);
      const pos = { x: P1.x + (P2.x - P1.x) * s, y: P1.y + (P2.y - P1.y) * s };
      const dx = P2.x - P1.x, dy = P2.y - P1.y, l = Math.hypot(dx, dy) || 1;
      return { pos, tang: { x: dx / l, y: dy / l } };
    } else {
      const uF = (t - (tEl - rFillet)) / (2 * rFillet);
      const A = { x: P0.x + (P1.x - P0.x) * (1 - rFillet / tEl), y: P0.y + (P1.y - P0.y) * (1 - rFillet / tEl) };
      const B = { x: P1.x + (P2.x - P1.x) * (rFillet / (1 - tEl)), y: P1.y + (P2.y - P1.y) * (rFillet / (1 - tEl)) };
      const invU = 1 - uF;
      const pos = {
        x: invU * invU * A.x + 2 * invU * uF * P1.x + uF * uF * B.x,
        y: invU * invU * A.y + 2 * invU * uF * P1.y + uF * uF * B.y
      };
      const derivX = 2 * invU * (P1.x - A.x) + 2 * uF * (B.x - P1.x);
      const derivY = 2 * invU * (P1.y - A.y) + 2 * uF * (B.y - P1.y);
      const l = Math.hypot(derivX, derivY) || 1;
      return { pos, tang: { x: derivX / l, y: derivY / l } };
    }
  }

  const srcRings = [], dstRings = [];
  for (let k = 0; k < K; k++) {
    const t = k / (K - 1);
    const sl = slices[k];

    srcRings.push({
      out: { x: sl[0] * iw, y: sl[1] * ih },
      in:  { x: sl[2] * iw, y: sl[3] * ih }
    });

    const { pos, tang } = getSpine(t);

    /* Vector pháp tuyến: luôn hướng RA NGOÀI so với tâm ngực N */
    let cand = { x: -tang.y, y: tang.x };
    const fromBody = { x: pos.x - N.x, y: pos.y - N.y };
    if (cand.x * fromBody.x + cand.y * fromBody.y < 0) {
      cand.x = -cand.x; cand.y = -cand.y;
    }
    const norm = cand; // Luôn hướng ra ngoài, không bao giờ bị lộn ngược hay xoắn 180 độ!

    // Độ rộng lát cắt: chuyển tiếp mượt từ đầu vai đến ống tay
    const wPx = sl[4] * iw * scaleFactor;
    const curW = wPx;

    dstRings.push({
      out: { x: pos.x + norm.x * (curW * 0.5), y: pos.y + norm.y * (curW * 0.5) },
      in:  { x: pos.x - norm.x * (curW * 0.5), y: pos.y - norm.y * (curW * 0.5) }
    });
  }

  /* 1. Lót nền màu vải bên dưới để triệt tiêu hoàn toàn hiện tượng hở viền antialiasing của Canvas */
  bctx.save();
  bctx.fillStyle = fabricColor || '#ffd166';
  bctx.beginPath();
  bctx.moveTo(dstRings[0].out.x, dstRings[0].out.y);
  for (let k = 1; k < K; k++) {
    bctx.lineTo(dstRings[k].out.x, dstRings[k].out.y);
  }
  bctx.lineTo(dstRings[K - 1].in.x, dstRings[K - 1].in.y);
  for (let k = K - 2; k >= 0; k--) {
    bctx.lineTo(dstRings[k].in.x, dstRings[k].in.y);
  }
  bctx.closePath();
  bctx.fill();
  bctx.restore();

  /* 2. Dựng lưới tam giác có bề mặt liên tục với độ phủ viền khử răng cưa mượt */
  for (let k = 0; k < K - 1; k++) {
    const s0 = srcRings[k], s1 = srcRings[k + 1];
    const d0 = dstRings[k], d1 = dstRings[k + 1];

    drawMeshTri(bctx, img, s0.out, s0.in, s1.out, d0.out, d0.in, d1.out);
    drawMeshTri(bctx, img, s0.in, s1.in, s1.out, d0.in, d1.in, d1.out);
  }
}

/* ==========================================================================
   HÀM VẼ ÁO CHÍNH (drawGarment)
   ========================================================================== */
function drawGarment(ctx, geo, opts) {
  const st = GARMENT_STYLES[opts.type] || GARMENT_STYLES.BH02;
  const { N, u, w, Ht, hipCenter, L, R } = geo;
  const scale = opts.scale || 1;
  const ox = opts.ox || 0, oy = opts.oy || 0;
  const img = loadGarmentImage(opts.type, opts.colorKey, opts.onImageLoad);

  if (!img || !img.naturalWidth) {
    const c = geo.p(0, .35 * Ht);
    ctx.save();
    ctx.fillStyle = opts.color || '#eeb7c2';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(c.x + ox, c.y + oy, w * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return false;
  }

  const iw = img.naturalWidth, ih = img.naturalHeight;
  const boost = (st.widthBoost || 1.14) * scale;

  const srcShL = { x: st.shL.u * iw, y: st.shL.v * ih };
  const srcShR = { x: st.shR.u * iw, y: st.shR.v * ih };
  const srcHip = { x: st.hipC.u * iw, y: st.hipC.v * ih };

  const dstShL = {
    x: N.x - u.x * (0.5 * w * boost) + ox,
    y: N.y - u.y * (0.5 * w * boost) + oy
  };
  const dstShR = {
    x: N.x + u.x * (0.5 * w * boost) + ox,
    y: N.y + u.y * (0.5 * w * boost) + oy
  };
  const spineDir = { x: hipCenter.x - N.x, y: hipCenter.y - N.y };
  const spineLen = Math.hypot(spineDir.x, spineDir.y) || 1;
  const hemDist = Ht * (st.torsoLenMul || 1.15) * scale;
  const dstHip = {
    x: N.x + (spineDir.x / spineLen) * hemDist + ox,
    y: N.y + (spineDir.y / spineLen) * hemDist + oy
  };

  const mapFn = (uNorm, vNorm) => mapAffinePt(uNorm, vNorm, iw, ih, srcShL, srcShR, srcHip, dstShL, dstShR, dstHip);

  /* Với áo tay ngắn (BH02, BH03): toàn bộ áo vẽ nguyên tấm bằng Affine 3 điểm (100% form chuẩn) */
  if (st.sleeve !== 'long') {
    ctx.save();
    ctx.shadowColor = 'rgba(38, 20, 26, 0.20)';
    ctx.shadowBlur = Math.max(5, 0.03 * w);
    ctx.shadowOffsetY = Math.max(1, 0.01 * w);
    if (applyTriangleTransform(ctx, srcShL, srcShR, srcHip, dstShL, dstShR, dstHip)) {
      ctx.drawImage(img, 0, 0);
    }
    ctx.restore();
    return true;
  }

  /* Với BH01 (áo cổ vuông tay dài):
     Kiểm tra xem người mặc có đang chủ động gập / cử động từng cánh tay hay không */
  const pElL = L.el ? { x: L.el.x + ox, y: L.el.y + oy } : null;
  const pWrL = L.wr ? { x: L.wr.x + ox, y: L.wr.y + oy } : null;
  const pElR = R.el ? { x: R.el.x + ox, y: R.el.y + oy } : null;
  const pWrR = R.wr ? { x: R.wr.x + ox, y: R.wr.y + oy } : null;

  const leftActive  = L.elOk && L.wrOk && checkArmActive(dstShL, pElL, pWrL, w);
  const rightActive = R.elOk && R.wrOk && checkArmActive(dstShR, pElR, pWrR, w);

  if (!leftActive && !rightActive) {
    /* Đứng thẳng không cử động tay: vẽ nguyên tấm ảnh PNG thật, sắc nét 100% */
    ctx.save();
    ctx.shadowColor = 'rgba(38, 20, 26, 0.20)';
    ctx.shadowBlur = Math.max(5, 0.03 * w);
    ctx.shadowOffsetY = Math.max(1, 0.01 * w);
    if (applyTriangleTransform(ctx, srcShL, srcShR, srcHip, dstShL, dstShR, dstHip)) {
      ctx.drawImage(img, 0, 0);
    }
    ctx.restore();
    return true;
  }

  /* Có cử động tay: dựng bằng bộ đệm mềm động lực học */
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  const tMat = ctx.getTransform();
  const logicalW = Math.round(cw / (tMat.a || 1)), logicalH = Math.round(ch / (tMat.d || 1));
  const buf = getGarmentBuffer(logicalW, logicalH);
  const bctx = buf.getContext('2d');

  /* 1. THÂN ÁO, CẦU VAI & CÁC BỘ PHẬN ĐỨNG YÊN:
     Vẽ toàn bộ áo nguyên bản sắc nét 100% bằng ma trận affine, bảo toàn trọn vẹn:
     - Quai áo & cổ vuông nguyên vẹn (không bị cắt cụt)
     - Ngực, eo và vạt áo bo cong mềm mại tự nhiên (không bị cắt cụt)
     - Ống tay bên nào đứng yên thì giữ nguyên 100% ảnh thật không bị chia lát! */
  bctx.save();
  if (applyTriangleTransform(bctx, srcShL, srcShR, srcHip, dstShL, dstShR, dstHip)) {
    bctx.drawImage(img, 0, 0);
  }
  bctx.restore();

  /* 2. KHỬ BỎ ỐNG TAY TĨNH BÊN CÓ CỬ ĐỘNG (BẰNG destination-out TẠI NÁCH ÁO v>=0.298):
     Chỉ xóa vùng cánh tay buông thõng bên cử động để thay thế bằng ống tay uốn động học,
     hoàn toàn không chạm vào quai áo, cổ áo, ngực áo hay vạt áo! */
  /* 2. KHỬ BỎ ỐNG TAY TĨNH BÊN CÓ CỬ ĐỘNG (BẰNG destination-out TỪ ĐẦU VAI v>=0.070):
     Xóa trọn vẹn toàn bộ cánh tay tĩnh từ quai áo trở ra ngoài để ống tay uốn động học
     nối trực tiếp vào quai áo, triệt tiêu hoàn toàn ống tay áo cộc bị cắt cụt! */
  if (rightActive) {
    bctx.save();
    bctx.globalCompositeOperation = 'destination-out';
    bctx.beginPath();
    bctx.moveTo(mapFn(0.785, -0.200).x, mapFn(0.785, -0.200).y);
    bctx.lineTo(mapFn(0.785, 0.070).x, mapFn(0.785, 0.070).y);
    bctx.lineTo(mapFn(0.770, 0.160).x, mapFn(0.770, 0.160).y);
    bctx.lineTo(mapFn(0.755, 0.280).x, mapFn(0.755, 0.280).y);
    bctx.lineTo(mapFn(0.730, 0.360).x, mapFn(0.730, 0.360).y);
    bctx.lineTo(mapFn(0.718, 0.450).x, mapFn(0.718, 0.450).y);
    bctx.lineTo(mapFn(0.705, 0.550).x, mapFn(0.705, 0.550).y);
    bctx.lineTo(mapFn(0.720, 0.650).x, mapFn(0.720, 0.650).y);
    bctx.lineTo(mapFn(0.750, 0.800).x, mapFn(0.750, 0.800).y);
    bctx.lineTo(mapFn(0.790, 0.950).x, mapFn(0.790, 0.950).y);
    bctx.lineTo(mapFn(0.850, 1.250).x, mapFn(0.850, 1.250).y);
    bctx.lineTo(mapFn(1.300, 1.250).x, mapFn(1.300, 1.250).y);
    bctx.lineTo(mapFn(1.300, -0.200).x, mapFn(1.300, -0.200).y);
    bctx.closePath();
    bctx.fill();
    bctx.restore();
  }

  if (leftActive) {
    bctx.save();
    bctx.globalCompositeOperation = 'destination-out';
    bctx.beginPath();
    bctx.moveTo(mapFn(0.215, -0.200).x, mapFn(0.215, -0.200).y);
    bctx.lineTo(mapFn(0.215, 0.070).x, mapFn(0.215, 0.070).y);
    bctx.lineTo(mapFn(0.230, 0.160).x, mapFn(0.230, 0.160).y);
    bctx.lineTo(mapFn(0.245, 0.280).x, mapFn(0.245, 0.280).y);
    bctx.lineTo(mapFn(0.270, 0.360).x, mapFn(0.270, 0.360).y);
    bctx.lineTo(mapFn(0.282, 0.450).x, mapFn(0.282, 0.450).y);
    bctx.lineTo(mapFn(0.295, 0.550).x, mapFn(0.295, 0.550).y);
    bctx.lineTo(mapFn(0.280, 0.650).x, mapFn(0.280, 0.650).y);
    bctx.lineTo(mapFn(0.250, 0.800).x, mapFn(0.250, 0.800).y);
    bctx.lineTo(mapFn(0.210, 0.950).x, mapFn(0.210, 0.950).y);
    bctx.lineTo(mapFn(0.150, 1.250).x, mapFn(0.150, 1.250).y);
    bctx.lineTo(mapFn(-0.300, 1.250).x, mapFn(-0.300, 1.250).y);
    bctx.lineTo(mapFn(-0.300, -0.200).x, mapFn(-0.300, -0.200).y);
    bctx.closePath();
    bctx.fill();
    bctx.restore();
  }

  /* 3. VẼ ỐNG TAY UỐN ĐỘNG HỌC (CHỈ DÀNH CHO BÊN ĐANG CỬ ĐỘNG TAY):
     Khớp nối tại cầu vai phủ kín mép nách, liền mạch 100% không để lại mẩu thừa! */
  const fabricColor = opts.color || '#ffd166';
  const bodyCenter = { x: N.x + ox, y: N.y + oy };
  if (leftActive) {
    drawRibbonSleeve(bctx, img, true, L, w, iw, ih, mapFn, ox, oy, fabricColor, bodyCenter);
  }
  if (rightActive) {
    drawRibbonSleeve(bctx, img, false, R, w, iw, ih, mapFn, ox, oy, fabricColor, bodyCenter);
  }

  /* Vẽ kết quả hoàn chỉnh lên canvas chính với bóng đổ dịu mắt */
  ctx.save();
  ctx.shadowColor = 'rgba(38, 20, 26, 0.20)';
  ctx.shadowBlur = Math.max(5, 0.03 * w);
  ctx.shadowOffsetY = Math.max(1, 0.01 * w);
  ctx.drawImage(buf, 0, 0, logicalW, logicalH);
  ctx.restore();
  return true;
}
