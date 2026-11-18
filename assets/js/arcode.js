/* ==========================================================================
   BY HER — arcode.js
   Mã QR "Quét để thử áo AR trên điện thoại" — tích hợp AR Code (ar-code.com).
   - Nếu sản phẩm có link AR Code trong AR_CODE.links → QR trỏ tới mô hình 3D/WebAR đó.
   - Nếu chưa có → QR trỏ tới phòng thử áo AR của chính website (?p=<mã>&c=<màu>#ar).
   Dùng ở: trang AR, trang chi tiết, trang đặt hàng thành công (in lên bao bì/hóa đơn).
   Phụ thuộc: data.js, core.js
   ========================================================================== */

function arShareUrl(id, color) {
  const custom = AR_CODE.links[id];
  if (custom) return custom;
  const base = location.origin === 'null' || location.protocol === 'file:' ? '' : location.origin + location.pathname;
  return base ? `${base}?p=${encodeURIComponent(id)}&c=${encodeURIComponent(color)}#ar` : '';
}

function arQrSrc(url, size) {
  return `${AR_CODE.qrService}?size=${size}x${size}&margin=8&data=${encodeURIComponent(url)}`;
}

/* Hiển thị khối QR vào phần tử #containerId */
function renderArQr(containerId, id, color, size) {
  const box = document.getElementById(containerId);
  if (!box) return;
  const p = pget(id), url = arShareUrl(id, color);
  if (!p) { box.innerHTML = ''; return; }
  if (!url) {
    box.innerHTML = '<p class="tiny">Mã QR AR sẽ xuất hiện khi website được đưa lên tên miền HTTPS (hiện đang mở từ file hoặc máy cục bộ).</p>';
    return;
  }
  const custom = !!AR_CODE.links[id];
  box.innerHTML = `<img class="qr-img" src="${arQrSrc(url, size || 160)}" width="${size || 160}" height="${size || 160}" alt="Mã QR thử áo AR ${escapeHtml(p.name)}" loading="lazy"><div><b>${escapeHtml(p.name)}</b><p class="tiny">${custom ? 'Quét mã để xem mô hình 3D / AR của sản phẩm.' : 'Quét mã bằng camera điện thoại để thử áo AR ngay trên người.'}</p><a class="link" href="${escapeHtml(url)}" target="_blank" rel="noopener">MỞ LIÊN KẾT AR <svg class="ar-link-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a></div>`;
}
