/* ==========================================================================
   BY HER — main.js
   Điểm khởi động: đổ ảnh/nội dung động vào DOM rồi mở trang theo URL hash.
   Phải nạp CUỐI CÙNG (sau data, core, shop, cart, checkout, arcode, ar, vr).
   ========================================================================== */

const SOCIAL_ICONS = {
  facebook: '<svg class="fi" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>',
  instagram: '<svg class="fi" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
  tiktok: '<svg class="fi" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>'
};

function renderSocial() {
  document.getElementById('socialLinks').innerHTML = SOCIAL.map(s => `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${SOCIAL_ICONS[s.icon] || ''}${s.name}</a>`).join('');
}

function renderFeedbacks() {
  const el = document.getElementById('homeFeedbacks');
  if (!el || typeof FEEDBACKS === 'undefined') return;
  el.innerHTML = FEEDBACKS.map(f => `<article class="feedbackcard"><div class="feedback-top"><div class="feedback-media"><img src="${IMG[f.avatar]}" alt="Khách hàng ${escapeHtml(f.author.replace(/^—\s*/, ''))}" loading="lazy"></div><div class="stars" aria-label="Đánh giá 5 trên 5 sao">${escapeHtml(f.stars)}</div></div><blockquote>${escapeHtml(f.quote)}</blockquote><cite class="author">${escapeHtml(f.author)}</cite></article>`).join('');
}

/* Link chia sẻ AR: ?p=BH03&c=pink#ar → mở thẳng phòng thử áo với đúng mẫu/màu (dùng cho mã QR) */
function applyShareParams() {
  const q = new URLSearchParams(location.search), id = q.get('p');
  if (!id || !pget(id)) return;
  arProductId = id;
  const c = q.get('c');
  arColor = pget(id).colors.includes(c) ? c : pget(id).colors[0];
}

function initHeaderScroll() {
  const header = document.getElementById('siteHeader');
  if (!header) return;
  let lastY = window.pageYOffset || document.documentElement.scrollTop;
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const curY = window.pageYOffset || document.documentElement.scrollTop;
        const diff = curY - lastY;

        if (curY <= 50) {
          header.classList.remove('header--hidden');
          header.classList.remove('header--scrolled');
        } else {
          header.classList.add('header--scrolled');
          if (diff > 10 && curY > 80) {
            header.classList.add('header--hidden');
          } else if (diff < -8) {
            header.classList.remove('header--hidden');
          }
        }
        lastY = curY;
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

function init() {
  document.getElementById('navLogo').src = IMG['logo'];
  document.getElementById('hero1').src = IMG['bh03-hong'];
  document.getElementById('hero2').src = IMG['bh01-vang'];
  document.getElementById('brandphoto').src = IMG['package'];
  document.getElementById('homeCategories').innerHTML = products.map(category).join('');
  document.getElementById('homeFeatured').innerHTML = products.map(productCard).join('');
  document.getElementById('filterType').innerHTML += [...products].map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  [['sizeImg', 'size'], ['packageImg', 'package'], ['policyImg', 'policy'], ['careImg', 'care'],
   ['policySize', 'size'], ['policyPolicy', 'policy'], ['policyCare', 'care'], ['policyPackaging', 'package']]
    .forEach(([id, key]) => document.getElementById(id).src = IMG[key]);
  renderSocial();
  renderFeedbacks();
  updateCart();
  arBindEvents();
  botInit();
  initHeaderScroll();
  applyShareParams();
  let h = location.hash.slice(1);
  go(ENTRY_PAGES.includes(h) ? h : 'home', true);
}

window.addEventListener('DOMContentLoaded', init);
