/* ==========================================================================
   BY HER — assistant.js
   Trợ lý ảo tư vấn khách hàng (chạy hoàn toàn trên trình duyệt).
   - Hiểu tiếng Việt có dấu / không dấu, viết tắt thường gặp (sz, bn, ship, ib…).
   - Trả lời tức thì từ kho kiến thức (data.js: products, SIZE_CHART, SHOP_INFO, STYLE_TIPS).
   - Nhớ ngữ cảnh: mẫu đang hỏi, màu, size, chiều cao/cân nặng → hỏi tiếp không cần nhắc lại.
   - Hành động thật: tư vấn size, mở sản phẩm, thêm vào giỏ, thanh toán, tra đơn, gọi shop.
   - Câu hỏi chưa trả lời được → chuyển nhân viên + ghi lại (localStorage) để shop bổ sung kiến thức.
   - Tùy chọn: chuyển câu khó sang AI (ASSISTANT_API.endpoint) khi có backend.
   Phụ thuộc: data.js, core.js, shop.js, cart.js, checkout.js
   ========================================================================== */

const BOT_STORE = 'byher_chat_v1';
const BOT_MISS_STORE = 'byher_bot_unanswered';
const BOT = {
  open: false,
  busy: false,
  log: [],
  ctx: { product: null, color: null, size: null, qty: 1, h: null, w: null, await: null }
};

/* ---------------- Chuẩn hóa văn bản ---------------- */
function botNorm(s) {
  return ' ' + String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
}
function botWords(s) {
  return ' ' + String(s || '').toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim() + ' ';
}
function botHasDia(s) {
  const l = String(s || '').toLowerCase();
  return l.includes('đ') || /[\u0300-\u036f]/.test(l.normalize('NFD'));
}
function botHas(t, kws) { return kws.some(k => t.includes(' ' + k + ' ')); }
function botCount(t, kws) { return kws.reduce((n, k) => n + (t.includes(' ' + k + ' ') ? (k.includes(' ') ? 2 : 1) : 0), 0); }

/* ---------------- Nhận diện thực thể ---------------- */
const BOT_PRODUCT_ALIASES = {
  BH01: ['bh01', 'bh 01', 'co vuong', 'tay dai', 'ao vuong'],
  BH02: ['bh02', 'bh 02', 'ao tron', 'tron basic', 'thun tron', 'co tron', 'basic tron', 'ao thun basic'],
  BH03: ['bh03', 'bh 03', 'co tim', 'co v', 'v neck', 'vneck']
};
const BOT_COLOR_WORDS = {
  pink: { dia: ['hồng'], plain: ['hong'] },
  yellow: { dia: ['vàng'], plain: ['vang'] },
  white: { dia: ['trắng'], plain: ['trang'] },
  red: { dia: ['đỏ', 'đô', 'burgundy'], plain: ['do', 'burgundy'] },
  black: { dia: ['đen'], plain: ['den'] }
};

function botFindProduct(t) {
  for (const id in BOT_PRODUCT_ALIASES) if (botHas(t, BOT_PRODUCT_ALIASES[id])) return id;
  return null;
}

/* Màu: văn bản có dấu → so khớp chính xác ("đỏ" ≠ "đồ"); không dấu → chỉ nhận khi có chữ "màu",
   có tên sản phẩm hoặc trợ lý đang chờ khách chọn màu (tránh nhầm "do", "den", "vang") */
function botFindColor(raw, t, productFound) {
  const dia = botHasDia(raw), words = botWords(raw);
  if (!dia && !(botHas(t, ['mau']) || productFound || BOT.ctx.await === 'buy')) return null;
  for (const c in BOT_COLOR_WORDS) {
    const list = dia ? BOT_COLOR_WORDS[c].dia : BOT_COLOR_WORDS[c].plain;
    if (list.some(k => (dia ? words : t).includes(' ' + k + ' '))) return c;
  }
  return null;
}

function botFindSize(t) {
  const m = t.match(/ (?:size|sz|sai|co|lay|chon|mac) ([sml]) /);
  if (m) return m[1].toUpperCase();
  if (BOT.ctx.await === 'buy' && /^ [sml] $/.test(t)) return t.trim().toUpperCase();
  return null;
}

function botFindQty(t) {
  const m = t.match(/ (\d{1,2}) (?:cai|chiec|ao|sp|san pham) /) || t.match(/ (?:lay|mua|dat|them) (\d{1,2}) /);
  const n = m ? Number(m[1]) : 0;
  return n >= 1 && n <= 20 ? n : null;
}

/* Chiều cao / cân nặng: "1m58", "1m6", "1.6m", "160cm", "cao 160", "48kg", "nặng 48", "48 ký" */
function botFindMeasures(raw, t) {
  const s = String(raw || '').toLowerCase().replace(/,/g, '.');
  let h = null, w = null, m;
  if ((m = s.match(/(\d)\s*m\s*(\d{1,2})(?!\d)/))) h = 100 * +m[1] + (m[2].length === 1 ? +m[2] * 10 : +m[2]);
  else if ((m = s.match(/(\d)\.(\d{1,2})\s*m(?![a-z])/))) h = 100 * +m[1] + (m[2].length === 1 ? +m[2] * 10 : +m[2]);
  else if ((m = s.match(/(\d{3})\s*cm/))) h = +m[1];
  else if ((m = t.match(/ cao (\d{3}) /))) h = +m[1];
  if ((m = s.match(/(\d{2,3}(?:\.\d)?)\s*(?:kg|kí|ký|ki|ky|kilo|cân|can)(?![a-z])/))) w = Math.round(+m[1]);
  else if ((m = t.match(/ (?:nang|can) (\d{2,3}) /))) w = +m[1];
  /* Số trần khi đang hỏi số đo: "158 48" */
  if ((!h || !w) && (BOT.ctx.await === 'measure' || botHas(t, ['size', 'sz', 'cao', 'nang']))) {
    const nums = (t.match(/ \d{2,3} /g) || []).map(x => +x.trim());
    nums.forEach(n => {
      if (!h && n >= 140 && n <= 200) h = n;
      else if (!w && n >= 30 && n <= 120 && n !== h) w = n;
    });
  }
  if (h && (h < 120 || h > 220)) h = null;
  if (w && (w < 25 || w > 200)) w = null;
  return { h, w };
}

/* ---------------- Ý định (intent) ---------------- */
const BOT_INTENTS = [
  { id: 'greet', kws: ['chao', 'hello', 'hi', 'helo', 'alo', 'xin chao', 'shop oi', 'ad oi', 'admin', 'hey'] },
  { id: 'thanks', kws: ['cam on', 'thank', 'thanks', 'tks', 'thank you', 'ok shop', 'oke', 'ok'] },
  { id: 'bye', kws: ['tam biet', 'bye', 'hen gap lai'] },
  { id: 'size', kws: ['size', 'sz', 'sai', 'kich co', 'kich thuoc', 'bang size', 'chon size', 'mac vua', 'vua khong', 'co vua', 'rong khong', 'chat khong', 'bo sat', 'mac size', 'm may', 'size nao', 'can nang', 'chieu cao'] },
  { id: 'price', kws: ['gia', 'bao nhieu', 'bn', 'nhieu tien', 'bao tien', 'tien', 'gia ca', 'bao nhieu tien'] },
  { id: 'catalog', kws: ['san pham', 'mau ao', 'co nhung', 'nhung mau', 'loai ao', 'cac mau', 'bo suu tap', 'goi y', 'nen mua', 'tu van ao', 'ban gi', 'co gi', 'xem ao', 'mau nao dep', 'mau moi', 'ban chay', 'hot'] },
  { id: 'colors', kws: ['mau sac', 'may mau', 'nhung mau gi', 'co mau', 'mau gi', 'bang mau'] },
  { id: 'material', kws: ['chat lieu', 'vai', 'cotton', 'modal', 'elastane', 'spandex', 'co gian', 'thun', 'day khong', 'mong khong', 'nong khong', 'mat khong', 'xu long', 'bi xu', 'phai mau', 'ra mau', 'tham hut', 'thoang'] },
  { id: 'care', kws: ['giat', 'bao quan', 'phoi do', 'ui', 'la ui', 'say', 'giat may', 'giat tay', 'tay trang'] },
  { id: 'exchange', kws: ['doi', 'doi hang', 'doi size', 'doi tra', 'tra hang', 'hoan tien', 'hoan', 'bao hanh', 'loi', 'hong', 'rach', 'khong vua', 'tra lai'] },
  { id: 'shipping', kws: ['ship', 'giao', 'giao hang', 'van chuyen', 'phi ship', 'bao lau', 'may ngay', 'khi nao nhan', 'nhan hang', 'freeship', 'free ship', 'mien phi van chuyen', 'tinh', 'ngoai tinh', 'cod khong'] },
  { id: 'payment', kws: ['thanh toan', 'cod', 'chuyen khoan', 'ck', 'tra tien', 'the', 'momo', 'vi dien tu', 'stk', 'so tai khoan'] },
  { id: 'howto', kws: ['cach mua', 'cach dat', 'dat hang the nao', 'mua the nao', 'mua nhu the nao', 'dat nhu the nao', 'huong dan dat', 'huong dan mua', 'lam sao de mua', 'order the nao'] },
  { id: 'order', kws: ['don hang', 'don cua toi', 'kiem tra don', 'tra cuu don', 'ma don', 'tinh trang don', 'don toi', 'da dat', 'huy don'] },
  { id: 'contact', kws: ['lien he', 'sdt', 'so dien thoai', 'hotline', 'zalo', 'email', 'mail', 'dia chi', 'cua hang', 'shop o dau', 'fanpage', 'facebook', 'instagram', 'tiktok', 'goi'] },
  { id: 'human', kws: ['nhan vien', 'tu van vien', 'nguoi that', 'gap nguoi', 'noi chuyen voi nguoi', 'gap shop', 'ib', 'inbox'] },
  { id: 'styling', kws: ['phoi', 'mix', 'mac voi', 'mac cung', 'di lam', 'di choi', 'di hoc', 'di tiec', 'cafe', 'ca phe', 'hop voi', 'set do', 'outfit'] },
  { id: 'promo', kws: ['giam gia', 'khuyen mai', 'sale', 'voucher', 'ma giam', 'uu dai', 'discount', 'qua tang', 'mua nhieu'] },
  { id: 'unavailable', kws: ['croptop', 'crop top', 'om body', 'body', 'form rong', 'oversize', 'quan', 'vay', 'dam', 'chan vay rieng', 'ao khoac', 'so mi', 'size xl', 'xl', 'xxl', 'size xs', 'xs'] },
  { id: 'complaint', kws: ['buc', 'te qua', 'kem', 'that vong', 'lua dao', 'tham', 'khong hai long', 'cham qua'] },
  { id: 'ar', kws: ['thu ao', 'thu do', 'ar', 'vr', 'camera', 'mac thu'] },
  { id: 'buy', kws: ['lay', 'chot', 'dat', 'mua', 'them vao gio', 'cho vao gio', 'bo vao gio', 'order', 'len don', 'ship cho'] }
];

function botScoreIntents(t) {
  return BOT_INTENTS.map(i => ({ id: i.id, score: botCount(t, i.kws) })).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
}

/* ---------------- Tiện ích trả lời ---------------- */
const BOT_MAIN_CHIPS = [
  { label: 'Tư vấn chọn size', say: 'Tư vấn size giúp mình' },
  { label: 'Xem các mẫu áo', say: 'Shop có những mẫu áo nào?' },
  { label: 'Chính sách đổi trả', say: 'Chính sách đổi trả thế nào?' },
  { label: 'Phí ship & thanh toán', say: 'Phí ship và thanh toán thế nào?' },
  { label: 'Gặp nhân viên', say: 'Mình muốn gặp nhân viên' }
];
function botColorList(p) { return p.colors.map(c => COLORS[c].name).join(', '); }
function botBullets(list) { return list.map(x => '• ' + x).join('\n'); }
function botName(id) { const p = pget(id); return `${p.name} (${p.id})`; }
function botContactChips() {
  return [
    { label: '☎ Gọi ' + SHOP_INFO.phone, act: 'tel' },
    { label: '✉ Gửi email', act: 'mail' },
    { label: 'Mở trang Liên hệ', act: 'go', page: 'contact' }
  ];
}

/* ---------------- Các câu trả lời ---------------- */
const BOT_REPLY = {
  greet() {
    const p = BOT.ctx.product && pget(BOT.ctx.product);
    if (p) return {
      text: `Chào nàng ♡ Mình là trợ lý BY HER. Nàng đang xem **${botName(p.id)}** — ${money(p.price)}. Mình có thể tư vấn size, màu hoặc cách phối cho mẫu này nhé!`,
      chips: [{ label: 'Tư vấn size mẫu này', say: 'Tư vấn size cho ' + p.id }, { label: 'Phối đồ thế nào?', say: 'Phối ' + p.id + ' thế nào?' }, { label: 'Chất liệu áo', say: 'Chất liệu áo thế nào?' }, ...BOT_MAIN_CHIPS.slice(2, 4)]
    };
    return {
      text: 'Chào nàng ♡ Mình là trợ lý ảo của **BY HER**. Mình có thể giúp nàng chọn size, tư vấn mẫu áo và màu sắc, giải đáp chính sách đổi trả, phí ship và hỗ trợ đặt hàng. Nàng cần mình giúp gì ạ?',
      chips: BOT_MAIN_CHIPS
    };
  },
  thanks() { return { text: 'Dạ không có gì ạ ♡ Nàng cần thêm thông tin gì cứ nhắn mình nhé!', chips: BOT_MAIN_CHIPS.slice(0, 3) }; },
  bye() { return { text: 'Cảm ơn nàng đã ghé BY HER ♡ Chúc nàng một ngày thật xinh!' }; },

  catalog() {
    return {
      text: `BY HER hiện có **${products.length} mẫu áo basic**, đều size S · M · L và chất liệu ${SHOP_INFO.material}:\n` +
        products.map(p => `• **${p.name}** (${p.id}) — ${money(p.price)} · ${botColorList(p)}`).join('\n'),
      cards: products.map(p => ({ id: p.id })),
      chips: [{ label: 'Tư vấn size', say: 'Tư vấn size giúp mình' }, { label: 'Mẫu nào dễ phối nhất?', say: 'Mẫu nào dễ phối đồ nhất?' }, { label: 'Phí ship', say: 'Phí ship thế nào?' }]
    };
  },

  product(id) {
    const p = pget(id);
    const color = BOT.ctx.color && p.colors.includes(BOT.ctx.color) ? BOT.ctx.color : p.colors[0];
    return {
      text: `**${botName(id)}** — ${money(p.price)}\n• Màu: ${botColorList(p)}\n• Size: S, M, L\n• Chất liệu: ${SHOP_INFO.material} — ${SHOP_INFO.stretch}\n• Gợi ý: ${STYLE_TIPS[id]}`,
      cards: [{ id, color }],
      chips: [{ label: 'Tư vấn size mẫu này', say: 'Tư vấn size cho ' + id }, { label: 'Chọn mua', say: 'Lấy ' + id }, { label: 'Xem mẫu khác', say: 'Shop có những mẫu áo nào?' }]
    };
  },

  price() {
    const id = BOT.ctx.product;
    if (id) {
      const p = pget(id);
      return { text: `**${botName(id)}** có giá **${money(p.price)}**. Phí vận chuyển được BY HER xác nhận khi chốt đơn.`, cards: [{ id, color: BOT.ctx.color }], chips: [{ label: 'Chọn mua', say: 'Lấy ' + id }, { label: 'Tư vấn size', say: 'Tư vấn size cho ' + id }] };
    }
    return {
      text: 'Bảng giá BY HER:\n' + products.map(p => `• ${p.name} (${p.id}): **${money(p.price)}**`).join('\n') + '\nPhí vận chuyển được BY HER xác nhận khi chốt đơn.',
      chips: products.map(p => ({ label: p.name, say: 'Xem ' + p.id }))
    };
  },

  colors() {
    const id = BOT.ctx.product;
    if (id) {
      const p = pget(id);
      return { text: `**${botName(id)}** có ${p.colors.length} màu: ${botColorList(p)}. Nàng muốn xem màu nào ạ?`, chips: p.colors.map(c => ({ label: COLORS[c].name, act: 'product', id, color: c })) };
    }
    return { text: 'Màu sắc từng mẫu:\n' + products.map(p => `• ${p.name}: ${botColorList(p)}`).join('\n'), chips: products.map(p => ({ label: p.name, say: 'Xem ' + p.id })) };
  },

  colorQuery(color) {
    const list = products.filter(p => p.colors.includes(color));
    if (!list.length) return { text: `Hiện BY HER chưa có mẫu màu ${COLORS[color].name}.`, chips: BOT_MAIN_CHIPS.slice(1, 2) };
    return {
      text: `Các mẫu có màu **${COLORS[color].name}**:\n` + list.map(p => `• ${p.name} (${p.id}) — ${money(p.price)}`).join('\n'),
      cards: list.map(p => ({ id: p.id, color })),
      chips: list.map(p => ({ label: 'Lấy ' + p.name + ' ' + COLORS[color].name, say: `Lấy ${p.id} màu ${COLORS[color].name}` }))
    };
  },

  size() {
    const { h, w, product } = BOT.ctx;
    if (h && w) {
      const r = suggestSize(h, w);
      BOT.ctx.size = r.size;
      BOT.ctx.await = null;
      const forP = product ? ` cho **${botName(product)}**` : '';
      const text = r.outOfRange
        ? `Với **${h} cm · ${w} kg**, số đo nằm ngoài bảng size chuẩn của BY HER. Mình tạm gợi ý **size ${r.size}**${forP}, nhưng nàng nên gọi shop (${SHOP_INFO.phone}) để được tư vấn chính xác hơn nhé.`
        : `Với **${h} cm · ${w} kg**, nàng mặc **size ${r.size}**${forP} là vừa đẹp theo bảng size BY HER ♡\nNếu nàng thích mặc ôm hơn có thể cân nhắc size nhỏ hơn, thích thoải mái thì chọn size lớn hơn — áo co giãn tốt nên khá dễ mặc.`;
      const chips = product
        ? [{ label: `Lấy ${pget(product).name} size ${r.size}`, say: `Lấy ${product} size ${r.size}` }, { label: 'Xem bảng size', act: 'sizeChart' }]
        : [...products.map(p => ({ label: `${p.name} size ${r.size}`, say: `Lấy ${p.id} size ${r.size}` })), { label: 'Xem bảng size', act: 'sizeChart' }];
      return { text, chips };
    }
    BOT.ctx.await = 'measure';
    const chart = SIZE_CHART.map((r, i) => {
      const lo = i ? SIZE_CHART[i - 1].hMax : 150;
      return `• **${r.size}**: cao ${(lo / 100).toFixed(2).replace('.', 'm')} – ${(r.hMax / 100).toFixed(2).replace('.', 'm')}, nặng dưới ${r.wMax} kg`;
    }).join('\n');
    const partial = h ? `Mình đã ghi nhận chiều cao ${h} cm. ` : w ? `Mình đã ghi nhận cân nặng ${w} kg. ` : '';
    return {
      text: `Bảng size BY HER (áp dụng cho cả 3 mẫu):\n${chart}\n${partial}Nàng cho mình xin **chiều cao và cân nặng** (ví dụ: *1m58 48kg*) để mình chọn size chuẩn nhé!`,
      chips: [{ label: '1m55 · 45kg', say: '1m55 45kg' }, { label: '1m60 · 50kg', say: '1m60 50kg' }, { label: '1m65 · 58kg', say: '1m65 58kg' }, { label: 'Xem ảnh bảng size', act: 'sizeChart' }]
    };
  },

  material() {
    return {
      text: `Cả 3 mẫu áo BY HER đều dùng chất liệu **${SHOP_INFO.material}**.\n• Cotton + Modal: mềm, thoáng, thấm hút tốt, dễ chịu khi mặc cả ngày.\n• Elastane: ${SHOP_INFO.stretch}\nĐể áo giữ màu và form lâu, nàng nên giặt nhẹ dưới 30°C và tránh sấy nhiệt cao.`,
      chips: [{ label: 'Hướng dẫn bảo quản', say: 'Hướng dẫn giặt và bảo quản' }, { label: 'Tư vấn size', say: 'Tư vấn size giúp mình' }]
    };
  },

  care() {
    return { text: 'Hướng dẫn bảo quản áo BY HER:\n' + botBullets(SHOP_INFO.care), chips: [{ label: 'Xem ảnh hướng dẫn', act: 'go', page: 'policies' }, { label: 'Chính sách đổi trả', say: 'Chính sách đổi trả thế nào?' }] };
  },

  exchange(t) {
    const defect = botHas(t, ['loi', 'hong', 'rach', 'thieu', 'sai mau', 'sai size', 'giao sai']);
    const head = defect
      ? 'Mình rất tiếc về sự cố này 😔 Với **sản phẩm lỗi sau khi nhận hàng, BY HER chịu phí đổi hàng 2 chiều**. Nàng vui lòng gửi video mở hàng và liên hệ shop để được xử lý nhanh nhất nhé.\n\n'
      : '';
    return {
      text: head + '**Đổi hàng:**\n' + botBullets(SHOP_INFO.exchange) + '\n\n**Trả hàng – hoàn tiền:**\n' + botBullets(SHOP_INFO.returns) + '\n\n**Lưu ý:**\n' + botBullets(SHOP_INFO.policyNotes),
      chips: defect ? botContactChips() : [{ label: 'Xem ảnh chính sách', act: 'go', page: 'policies' }, { label: 'Liên hệ đổi hàng', say: 'Mình muốn gặp nhân viên' }]
    };
  },

  shipping() {
    return {
      text: `${SHOP_INFO.shipping}\nSau khi nàng đặt hàng, BY HER sẽ xác nhận đơn, đóng gói và bàn giao cho đơn vị vận chuyển. Hỗ trợ **thanh toán khi nhận hàng (COD)**.\nCần biết phí chính xác cho khu vực của nàng, gọi shop ${SHOP_INFO.phone} nhé.`,
      chips: [{ label: 'Hình thức thanh toán', say: 'Thanh toán thế nào?' }, { label: '☎ Gọi shop', act: 'tel' }]
    };
  },

  payment() {
    return { text: 'BY HER hỗ trợ:\n' + botBullets(SHOP_INFO.payment), chips: [{ label: 'Cách đặt hàng', say: 'Hướng dẫn đặt hàng' }, { label: 'Mở giỏ hàng', act: 'cart' }] };
  },

  howto() {
    return {
      text: 'Đặt hàng tại BY HER chỉ vài bước:\n' + SHOP_INFO.orderSteps.map((s, i) => `${i + 1}. ${s}`).join('\n') + '\nHoặc nàng nhắn mình *"Lấy BH01 màu trắng size M"* — mình thêm vào giỏ giúp nàng luôn ♡',
      chips: [{ label: 'Xem sản phẩm', act: 'go', page: 'shop' }, { label: 'Mở giỏ hàng', act: 'cart' }]
    };
  },

  order(t, raw) {
    if (!orders.length) return { text: 'Trên trình duyệt này chưa có đơn hàng nào. Nếu nàng đã đặt qua kênh khác, vui lòng gọi shop để kiểm tra nhé.', chips: [{ label: '☎ Gọi shop', act: 'tel' }, { label: 'Xem sản phẩm', act: 'go', page: 'shop' }] };
    const m = String(raw).toUpperCase().match(/BH-?(\d{6,})/);
    const o = (m && orders.find(x => x.id.replace('-', '').endsWith(m[1]))) || orders[0];
    const items = o.items.map(x => `• ${pget(x.id).name} · ${COLORS[x.color].name} · Size ${x.size} × ${x.qty}`).join('\n');
    return {
      text: `${m && !o.id.includes(m[1]) ? 'Mình không thấy mã đơn đó, đây là đơn gần nhất:\n' : ''}**Đơn ${o.id}** (${o.date})\n${items}\nTổng tiền sản phẩm: **${money(o.total)}**\nTrạng thái: ${o.status}.\nĐể xác nhận tình trạng giao hàng thực tế, nàng gọi shop ${SHOP_INFO.phone} nhé.`,
      chips: [{ label: 'Xem tất cả đơn hàng', act: 'go', page: 'orders' }, { label: '☎ Gọi shop', act: 'tel' }]
    };
  },

  contact() {
    return { text: `Thông tin liên hệ BY HER:\n• Điện thoại: **${SHOP_INFO.phone}**\n• Email: **${SHOP_INFO.email}**`, chips: botContactChips() };
  },
  human() {
    return { text: `Mình kết nối nàng với nhân viên BY HER nhé ♡\nNàng gọi **${SHOP_INFO.phone}** hoặc email **${SHOP_INFO.email}** — shop sẽ hỗ trợ trực tiếp.`, chips: botContactChips() };
  },

  styling() {
    const id = BOT.ctx.product;
    if (id) return { text: `Gợi ý phối **${botName(id)}**:\n${STYLE_TIPS[id]}`, cards: [{ id, color: BOT.ctx.color }], chips: [{ label: 'Chọn mua', say: 'Lấy ' + id }, { label: 'Tư vấn size', say: 'Tư vấn size cho ' + id }] };
    return {
      text: 'Gợi ý phối đồ từ BY HER:\n' + products.map(p => `• **${p.name}**: ${STYLE_TIPS[p.id]}`).join('\n') + '\nDễ phối nhất là **Áo trơn basic (BH02)** — hợp với hầu hết quần jeans và chân váy.',
      cards: [{ id: 'BH02' }]
    };
  },

  promo() {
    return {
      text: `Hiện mình chưa có thông tin chương trình khuyến mãi cụ thể. Theo chính sách, **mỗi đơn hàng áp dụng 01 ưu đãi duy nhất**. Nàng gọi shop ${SHOP_INFO.phone} để hỏi ưu đãi đang áp dụng nhé!`,
      chips: [{ label: '☎ Gọi shop', act: 'tel' }, { label: 'Xem sản phẩm', act: 'go', page: 'shop' }]
    };
  },

  unavailable() {
    return {
      text: `Hiện BY HER tập trung vào **${products.length} mẫu áo basic** (size S · M · L), chưa kinh doanh mẫu/size nàng hỏi. Nàng tham khảo các mẫu đang có nhé:`,
      cards: products.map(p => ({ id: p.id })),
      chips: [{ label: 'Tư vấn size', say: 'Tư vấn size giúp mình' }, { label: 'Hỏi shop thêm', say: 'Mình muốn gặp nhân viên' }]
    };
  },

  complaint() {
    return { text: `BY HER thành thật xin lỗi vì trải nghiệm chưa tốt của nàng 😔 Nàng vui lòng gọi **${SHOP_INFO.phone}** hoặc email **${SHOP_INFO.email}** để shop hỗ trợ trực tiếp và xử lý ngay nhé.`, chips: botContactChips() };
  },

  ar() {
    return { text: 'Nàng có thể xem trước áo trên người bằng **phòng thử áo AR** (camera hoặc ảnh tải lên — ảnh không gửi đi đâu) hoặc ngắm các màu trong **phòng VR 360°**.', chips: [{ label: 'Mở phòng thử AR', act: 'go', page: 'ar' }, { label: 'Mở phòng VR', act: 'go', page: 'vr' }] };
  },

  /* Luồng chốt đơn: đủ mẫu + màu + size → thêm vào giỏ */
  buy() {
    const c = BOT.ctx;
    if (!c.product) {
      c.await = 'buy';
      return { text: 'Nàng muốn lấy mẫu nào ạ?', cards: products.map(p => ({ id: p.id })), chips: products.map(p => ({ label: p.name, say: 'Lấy ' + p.id })) };
    }
    const p = pget(c.product);
    if (!c.color || !p.colors.includes(c.color)) {
      c.await = 'buy';
      return { text: `**${botName(p.id)}** — ${money(p.price)}. Nàng chọn màu nào ạ?`, cards: [{ id: p.id }], chips: p.colors.map(co => ({ label: COLORS[co].name, say: 'màu ' + COLORS[co].name })) };
    }
    if (!c.size) {
      c.await = 'buy';
      return {
        text: `${p.name} màu **${COLORS[c.color].name}** — nàng lấy size nào ạ? Chưa chắc size thì gửi mình chiều cao, cân nặng (vd: *1m58 48kg*) nhé.`,
        chips: [...['S', 'M', 'L'].map(s => ({ label: 'Size ' + s, say: 'size ' + s })), { label: 'Tư vấn size', say: 'Tư vấn size cho ' + p.id }]
      };
    }
    const qty = c.qty || 1;
    addToCart(p.id, c.color, c.size, qty, false, true);
    const line = `${p.name} · ${COLORS[c.color].name} · Size ${c.size} × ${qty}`;
    c.await = null; c.qty = 1;
    return {
      text: `Đã thêm **${line}** vào giỏ hàng ♡\nGiỏ hàng: ${cartCount()} sản phẩm · Tạm tính **${money(cartTotal())}** (chưa gồm phí vận chuyển).`,
      chips: [{ label: 'Thanh toán ngay', act: 'checkout' }, { label: 'Xem giỏ hàng', act: 'cart' }, { label: 'Mua thêm mẫu khác', say: 'Shop có những mẫu áo nào?' }]
    };
  },

  fallback(raw) {
    botLogMiss(raw);
    return {
      text: `Xin lỗi nàng, mình chưa hiểu rõ câu hỏi này 😅 Nàng có thể chọn một chủ đề bên dưới, hoặc gọi **${SHOP_INFO.phone}** để nhân viên hỗ trợ trực tiếp nhé.`,
      chips: [...BOT_MAIN_CHIPS.slice(0, 4), { label: '☎ Gọi shop', act: 'tel' }]
    };
  }
};

/* ---------------- Bộ não: chọn câu trả lời ---------------- */
function botAnswer(raw) {
  const t = botNorm(raw), c = BOT.ctx;
  const product = botFindProduct(t);
  const color = botFindColor(raw, t, product);
  const size = botFindSize(t);
  const qty = botFindQty(t);
  const { h, w } = botFindMeasures(raw, t);

  if (product && product !== c.product) { c.product = product; if (!color) c.color = null; }
  if (color) c.color = color;
  if (size) c.size = size;
  if (qty) c.qty = qty;
  if (h) c.h = h;
  if (w) c.w = w;

  const scores = botScoreIntents(t);
  const top = scores.map(s => s.id);
  const is = id => top.includes(id);

  /* 1. Tra mã đơn */
  if (/bh-?\d{6,}/i.test(raw)) return [BOT_REPLY.order(t, raw)];

  /* 2. Chốt đơn (trừ câu hỏi "mua thế nào") hoặc đang trong luồng chốt đơn */
  const buying = is('buy') && !is('howto') && !is('price') && !is('shipping') && (product || color || size || c.product);
  if (buying || (c.await === 'buy' && (product || color || size))) {
    if ((h || w) && !size && c.h && c.w) { const r = suggestSize(c.h, c.w); c.size = r.size; }
    return [BOT_REPLY.buy()];
  }

  /* 3. Có số đo → tư vấn size */
  if ((h || w) && (c.await === 'measure' || is('size') || (h && w))) return [BOT_REPLY.size()];

  /* 4. Theo ý định (tối đa 2 chủ đề trong một câu hỏi) */
  const skip = ['buy'];
  const main = scores.filter(s => !skip.includes(s.id));
  if (main.length) {
    const ids = main.slice(0, 2).map(s => s.id).filter((id, i, a) => !(id === 'greet' && a.length > 1));
    /* Hỏi về 1 mẫu cụ thể mà không rõ chủ đề → thông tin sản phẩm */
    if (product && ids.every(id => ['catalog', 'greet'].includes(id))) return [BOT_REPLY.product(product)];
    if (color && !product && ids.every(id => ['colors', 'catalog'].includes(id))) return [BOT_REPLY.colorQuery(color)];
    if (ids[0] === 'unavailable' && is('styling')) return [BOT_REPLY.styling()];
    return ids.map(id => BOT_REPLY[id](t, raw));
  }

  /* 5. Chỉ nhắc tên mẫu / màu */
  if (product) return [BOT_REPLY.product(product)];
  if (color) return [BOT_REPLY.colorQuery(color)];
  if (size && c.product) return [BOT_REPLY.buy()];
  return null;
}

/* ---------------- Ghi lại câu chưa trả lời được (để shop bổ sung kiến thức) ---------------- */
function botLogMiss(q) {
  try {
    const list = JSON.parse(localStorage.getItem(BOT_MISS_STORE) || '[]');
    list.unshift({ q: String(q).slice(0, 300), at: new Date().toISOString() });
    localStorage.setItem(BOT_MISS_STORE, JSON.stringify(list.slice(0, 50)));
  } catch { /* bỏ qua */ }
}

/* Kiến thức gửi kèm cho AI (nếu bật ASSISTANT_API) để AI chỉ trả lời theo dữ liệu thật của shop */
function botKnowledgeText() {
  return [
    'Cửa hàng BY HER — áo basic nữ. Liên hệ: ' + SHOP_INFO.phone + ', ' + SHOP_INFO.email,
    'Sản phẩm: ' + products.map(p => `${p.id} ${p.name} ${p.price}đ, màu ${botColorList(p)}, size S/M/L`).join('; '),
    'Chất liệu: ' + SHOP_INFO.material + '. ' + SHOP_INFO.stretch,
    'Bảng size: ' + SIZE_CHART.map(r => `${r.size} cao ≤${r.hMax}cm, nặng <${r.wMax}kg`).join('; '),
    'Đổi hàng: ' + SHOP_INFO.exchange.join(' '), 'Trả hàng: ' + SHOP_INFO.returns.join(' '), 'Lưu ý: ' + SHOP_INFO.policyNotes.join(' '),
    'Bảo quản: ' + SHOP_INFO.care.join(' '), 'Thanh toán: ' + SHOP_INFO.payment.join(' '), 'Vận chuyển: ' + SHOP_INFO.shipping
  ].join('\n');
}

async function botAskAI(raw) {
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), ASSISTANT_API.timeoutMs);
  try {
    const res = await fetch(ASSISTANT_API.endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({ message: raw, history: BOT.log.slice(-8).map(m => ({ role: m.from, text: m.text })), knowledge: botKnowledgeText() })
    });
    const data = await res.json();
    return res.ok && data.reply ? { text: String(data.reply).slice(0, 1500), chips: BOT_MAIN_CHIPS.slice(0, 3) } : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

/* ---------------- Giao diện ---------------- */
function botFmt(s) {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/\n/g, '<br>');
}

function botCardHTML(card) {
  const p = pget(card.id);
  if (!p) return '';
  const c = p.colors.includes(card.color) ? card.color : p.colors[0];
  return `<div class="bot-card"><img src="${img(p, c)}" alt="${escapeHtml(p.name)} màu ${COLORS[c].name}" loading="lazy"><div class="bot-card-body"><b>${escapeHtml(p.name)}</b><span class="bot-price">${money(p.price)}</span><span class="bot-dots">${p.colors.map(co => `<i style="background:${COLORS[co].hex}" title="${COLORS[co].name}"></i>`).join('')}</span><div class="bot-card-actions"><button type="button" data-act="product" data-id="${p.id}" data-color="${c}"><svg class="bot-mini-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span>Chi tiết</span></button><button type="button" data-act="say" data-say="Lấy ${p.id} màu ${COLORS[c].name}"><svg class="bot-mini-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg><span>Chọn mua</span></button></div></div></div>`;
}

function botMsgHTML(m) {
  const cards = m.cards && m.cards.length ? `<div class="bot-cards">${m.cards.map(botCardHTML).join('')}</div>` : '';
  return `<div class="bot-msg ${m.from === 'user' ? 'from-user' : 'from-bot'}"><div class="bot-bubble">${botFmt(m.text)}</div>${cards}</div>`;
}

function botChipHTML(ch) {
  const attrs = Object.entries(ch).filter(([k]) => k !== 'label').map(([k, v]) => `data-${k}="${escapeHtml(v)}"`).join(' ');
  return `<button type="button" class="bot-chip" ${ch.say ? 'data-act="say"' : ''} ${attrs}>${escapeHtml(ch.label)}</button>`;
}

function botRender() {
  const box = document.getElementById('botMessages');
  box.innerHTML = BOT.log.map(botMsgHTML).join('');
  const last = [...BOT.log].reverse().find(m => m.from === 'bot');
  document.getElementById('botChips').innerHTML = last && last.chips ? last.chips.map(botChipHTML).join('') : '';
  box.scrollTop = box.scrollHeight;
}

function botSave() {
  try { sessionStorage.setItem(BOT_STORE, JSON.stringify({ log: BOT.log.slice(-40), ctx: BOT.ctx })); } catch { /* bỏ qua */ }
}

function botPush(m) { BOT.log.push(m); botRender(); botSave(); }

function botTyping(on) {
  const box = document.getElementById('botMessages');
  const el = document.getElementById('botTypingDots');
  if (on && !el) { box.insertAdjacentHTML('beforeend', '<div class="bot-msg from-bot" id="botTypingDots"><div class="bot-bubble bot-typing"><i></i><i></i><i></i></div></div>'); box.scrollTop = box.scrollHeight; }
  if (!on && el) el.remove();
}

async function botSend(text) {
  const raw = String(text || '').trim().slice(0, 300);
  if (!raw || BOT.busy) return;
  BOT.busy = true;
  botPush({ from: 'user', text: raw });
  document.getElementById('botChips').innerHTML = '';
  botTyping(true);
  let replies = botAnswer(raw);
  if (!replies && ASSISTANT_API.endpoint) { const ai = await botAskAI(raw); if (ai) replies = [ai]; }
  if (!replies) replies = [BOT_REPLY.fallback(raw)];
  /* Phản hồi gần như tức thì, có khoảng nghỉ ngắn cho tự nhiên */
  const len = replies.reduce((n, r) => n + r.text.length, 0);
  await new Promise(r => setTimeout(r, Math.min(650, 220 + len * 1.2)));
  botTyping(false);
  replies.forEach((r, i) => botPush({ from: 'bot', text: r.text, cards: r.cards, chips: i === replies.length - 1 ? r.chips : (replies.length > 1 ? null : r.chips) }));
  BOT.busy = false;
}

function botAction(el) {
  const d = el.dataset;
  switch (d.act) {
    case 'say': botSend(d.say); break;
    case 'product': botClose(); openProduct(d.id, d.color); break;
    case 'go': botClose(); go(d.page); break;
    case 'cart': botClose(); openCart(); break;
    case 'checkout': botClose(); startCheckout(); break;
    case 'sizeChart': botClose(); go('policies'); break;
    case 'tel': location.href = 'tel:' + SHOP_INFO.tel; break;
    case 'mail': location.href = 'mailto:' + SHOP_INFO.email + '?subject=' + encodeURIComponent('Hỗ trợ khách hàng BY HER'); break;
    case 'reset': botReset(); break;
  }
}

/* Đồng bộ ngữ cảnh với trang đang xem (vd. mở chat ở trang chi tiết BH03 → trợ lý biết nàng đang xem BH03) */
function botSyncPage() {
  if (document.getElementById('detail')?.classList.contains('active') && current) {
    if (BOT.ctx.product !== current.id) { BOT.ctx.product = current.id; BOT.ctx.color = chosenColor; BOT.ctx.size = null; }
    return true;
  }
  return false;
}

function botOpen() {
  BOT.open = true;
  const onDetail = botSyncPage();
  document.getElementById('botPanel').classList.add('on');
  document.getElementById('botLauncher').setAttribute('aria-expanded', 'true');
  document.getElementById('botLauncher').classList.remove('has-dot');
  document.getElementById('botTeaser')?.remove();
  if (!BOT.log.length || (onDetail && BOT.log[BOT.log.length - 1]?.productCtx !== current.id)) {
    const g = BOT_REPLY.greet();
    botPush({ from: 'bot', text: g.text, chips: g.chips, productCtx: onDetail ? current.id : null });
  } else botRender();
  setTimeout(() => document.getElementById('botInput').focus(), 50);
}

function botClose() {
  BOT.open = false;
  document.getElementById('botPanel').classList.remove('on');
  document.getElementById('botLauncher').setAttribute('aria-expanded', 'false');
}

function botToggle() { BOT.open ? botClose() : botOpen(); }

function botReset() {
  BOT.log = [];
  BOT.ctx = { product: null, color: null, size: null, qty: 1, h: null, w: null, await: null };
  botSave();
  botOpen();
}

function botInit() {
  try {
    const s = JSON.parse(sessionStorage.getItem(BOT_STORE) || 'null');
    if (s && Array.isArray(s.log)) { BOT.log = s.log; Object.assign(BOT.ctx, s.ctx || {}); }
  } catch { /* bỏ qua */ }
  const panel = document.getElementById('botPanel');
  panel.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (el) botAction(el); });
  document.getElementById('botForm').addEventListener('submit', e => {
    e.preventDefault();
    const input = document.getElementById('botInput');
    botSend(input.value);
    input.value = '';
  });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && BOT.open) botClose(); });
  /* Lời mời nhẹ nhàng 1 lần mỗi phiên, sau 15 giây */
  if (!BOT.log.length && !sessionStorage.getItem('byher_bot_teased')) {
    setTimeout(() => {
      if (BOT.open || BOT.log.length) return;
      sessionStorage.setItem('byher_bot_teased', '1');
      document.getElementById('botLauncher').classList.add('has-dot');
      document.body.insertAdjacentHTML('beforeend', '<button type="button" id="botTeaser" class="bot-teaser" onclick="botOpen()">Nàng cần tư vấn size hay chọn mẫu? Nhắn BY HER nhé ♡</button>');
      setTimeout(() => document.getElementById('botTeaser')?.remove(), 9000);
    }, 15000);
  }
}
