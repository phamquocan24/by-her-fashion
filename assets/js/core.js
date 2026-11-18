/* ==========================================================================
   BY HER — core.js
   Tiện ích dùng chung, trạng thái ứng dụng, lưu trữ localStorage, điều hướng (router).
   Phụ thuộc: data.js
   ========================================================================== */

const STORAGE_KEYS = { cart: 'byher_cart_v2', orders: 'byher_orders_v2' };
/* Các trang cho phép mở trực tiếp từ URL hash (detail/checkout/success cần trạng thái nên không nằm đây) */
const ENTRY_PAGES = ['home', 'shop', 'about', 'contact', 'policies', 'orders', 'ar', 'vr'];

const money = n => new Intl.NumberFormat('vi-VN').format(n) + '₫';

/* ---- Trạng thái trang chi tiết ---- */
let current = null, chosenColor = '', chosenSize = 'M', qty = 1, galleryIndex = 0;
/* Màu đang chọn trên từng thẻ sản phẩm */
let cardsColor = {};

/* ---- Lưu trữ ---- */
function load(key, def) {
  try { return JSON.parse(localStorage.getItem(key)) || def; } catch { return def; }
}

/* Dữ liệu localStorage có thể cũ/hỏng (vd. sản phẩm đã bị xóa khỏi danh mục) → lọc để tránh lỗi runtime */
function validLine(x) {
  const p = x && pget(x.id);
  return !!p && p.colors.includes(x.color) && ['S', 'M', 'L'].includes(x.size) && Number.isFinite(x.qty) && x.qty > 0;
}
function sanitizeCart(list) {
  return Array.isArray(list) ? list.filter(validLine) : [];
}
function sanitizeOrders(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter(o => o && Array.isArray(o.items) && o.customer && typeof o.customer === 'object')
    .map(o => ({ ...o, items: o.items.filter(validLine) }));
}

let cart = sanitizeCart(load(STORAGE_KEYS.cart, []));
let orders = sanitizeOrders(load(STORAGE_KEYS.orders, []));

function save() {
  try {
    localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(cart));
    localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(orders));
  } catch { /* trình duyệt chặn lưu trữ (chế độ riêng tư) — bỏ qua */ }
}

/* ---- Helpers ---- */
function pget(id) { return products.find(p => p.id === id); }

function img(p, c) { return IMG[(p.images[c] || p.images[p.colors[0]])[0]]; }

/* Gợi ý size theo bảng size BY HER (dùng chung cho phòng thử AR và trợ lý ảo).
   Chọn size lớn hơn giữa size theo chiều cao và size theo cân nặng. */
function suggestSize(h, w) {
  const idx = (val, key) => { const i = SIZE_CHART.findIndex(r => val <= r[key]); return i < 0 ? SIZE_CHART.length - 1 : i; };
  const last = SIZE_CHART[SIZE_CHART.length - 1];
  const i = Math.max(idx(h, 'hMax'), idx(w, 'wMax'));
  return { size: SIZE_CHART[i].size, outOfRange: h < 150 || h > last.hMax || w >= last.wMax };
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(window.toasttimer);
  window.toasttimer = setTimeout(() => t.classList.remove('on'), 2400);
}

/* ---- Router (single-page, dựa trên URL hash) ----
   fromHistory = true: không đẩy thêm mục vào history (dùng cho nút Back/Forward & lần tải đầu) */
function go(page, fromHistory) {
  if (page !== 'ar' && document.getElementById('arVideo')?.srcObject) arStopCamera();
  const pages = [...document.querySelectorAll('.page')];
  if (!pages.some(e => e.id === page)) page = 'home';
  pages.forEach(e => e.classList.toggle('active', e.id === page));
  window.scrollTo(0, 0);
  if (!fromHistory && location.hash !== '#' + page) {
    try { history.pushState(null, '', '#' + page); } catch { /* file:// một số trình duyệt chặn */ }
  }
  if (page !== 'vr') vrUnmount();
  if (page === 'vr') vrMount();
  if (page === 'ar') arInitialize();
  if (page === 'shop') renderShop();
  if (page === 'checkout') renderCheckout();
  if (page === 'orders') renderOrders();
  closeCart();
}

window.addEventListener('popstate', () => {
  let h = location.hash.slice(1) || 'home';
  if (h === 'detail' && !current) h = 'home';
  if (h === 'checkout' && !cart.length) h = 'home';
  if (h === 'success') h = 'home';
  go(h, true);
});

window.addEventListener('keydown', e => { if (e.key === 'Escape') closeCart(); });
