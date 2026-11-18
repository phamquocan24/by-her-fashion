/* ==========================================================================
   BY HER — checkout.js
   Thanh toán (đơn mẫu lưu localStorage), danh sách đơn hàng, form liên hệ.
   Phụ thuộc: data.js, core.js, cart.js
   ========================================================================== */

function renderCheckout() {
  let items = document.getElementById('checkoutItems'), totals = document.getElementById('checkoutTotals');
  if (!items) return;
  items.innerHTML = cart.map(x => {
    let p = pget(x.id);
    return `<div class="itemline"><img src="${img(p, x.color)}" alt="${p.name}"><div><b>${p.name}</b><p>${COLORS[x.color].name} · Size ${x.size} · SL ${x.qty}</p><strong>${money(p.price * x.qty)}</strong></div></div>`;
  }).join('') || '<p>Chưa có sản phẩm.</p>';
  totals.innerHTML = `<div class="summaryline"><span>Tạm tính</span><b>${money(cartTotal())}</b></div><div class="summaryline"><span>Phí vận chuyển</span><span>Sẽ xác nhận sau</span></div><div class="summaryline total"><span>Tổng tiền sản phẩm</span><span>${money(cartTotal())}</span></div>`;
}

/* ---------------- Kiểm tra & Báo lỗi trường bắt buộc ---------------- */
function validateFormFields(form, rules) {
  let hasError = false;
  let firstInvalid = null;

  form.querySelectorAll('.field-error-msg').forEach(el => el.remove());
  form.querySelectorAll('.field-invalid').forEach(el => el.classList.remove('field-invalid'));

  for (const [name, rule] of Object.entries(rules)) {
    const field = form.querySelector(`[name="${name}"]`);
    if (!field) continue;
    const val = String(field.value || '').trim();

    let error = '';
    if (rule.required && !val) {
      error = rule.requiredMsg || 'Vui lòng điền thông tin này (không được bỏ trống)';
    } else if (val && rule.pattern && !rule.pattern.test(val)) {
      error = rule.patternMsg || 'Thông tin không hợp lệ';
    }

    if (error) {
      hasError = true;
      field.classList.add('field-invalid');
      const errEl = document.createElement('span');
      errEl.className = 'field-error-msg';
      errEl.innerHTML = `<svg class="err-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>${escapeHtml(error)}</span>`;
      field.parentNode.appendChild(errEl);

      if (!firstInvalid) firstInvalid = field;
    }

    if (!field.dataset.boundValidate) {
      field.dataset.boundValidate = '1';
      const clearError = () => {
        if (String(field.value || '').trim()) {
          field.classList.remove('field-invalid');
          const msg = field.parentNode.querySelector('.field-error-msg');
          if (msg) msg.remove();
        }
      };
      field.addEventListener('input', clearError);
      field.addEventListener('change', clearError);
    }
  }

  if (firstInvalid) {
    firstInvalid.focus();
    firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return !hasError;
}

const CHECKOUT_RULES = {
  fullname: { required: true, requiredMsg: 'Họ và tên không được bỏ trống' },
  phone: {
    required: true,
    requiredMsg: 'Số điện thoại không được bỏ trống',
    pattern: /^[0-9+(). -]{9,16}$/,
    patternMsg: 'Số điện thoại không hợp lệ (tối thiểu 9 số)'
  },
  province: { required: true, requiredMsg: 'Tỉnh / Thành phố không được bỏ trống' },
  district: { required: true, requiredMsg: 'Quận / Huyện / Phường / Xã không được bỏ trống' },
  street: { required: true, requiredMsg: 'Địa chỉ cụ thể không được bỏ trống' }
};

const CONTACT_RULES = {
  name: { required: true, requiredMsg: 'Họ và tên không được bỏ trống' },
  email: {
    required: true,
    requiredMsg: 'Email không được bỏ trống',
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    patternMsg: 'Địa chỉ email không hợp lệ (vd: name@example.com)'
  },
  message: { required: true, requiredMsg: 'Nội dung tin nhắn không được bỏ trống' }
};

function completeOrder(e) {
  e.preventDefault();
  if (!cart.length) { toast('Giỏ hàng trống'); go('shop'); return; }
  const form = e.target;
  if (!validateFormFields(form, CHECKOUT_RULES)) {
    toast('Vui lòng điền đầy đủ các thông tin bắt buộc (không được bỏ trống)!');
    return;
  }
  let fd = new FormData(form), data = Object.fromEntries(fd.entries());
  let order = {
    id: 'BH-' + Date.now().toString().slice(-9),
    date: new Date().toLocaleString('vi-VN'),
    customer: data,
    items: cart.map(x => ({ ...x })),
    total: cartTotal(),
    status: 'Đơn mẫu đã ghi nhận trên trình duyệt'
  };
  orders.unshift(order);
  cart = [];
  save();
  updateCart();
  document.getElementById('successText').textContent = `Cảm ơn ${data.fullname}! Đơn mẫu ${order.id} đã được lưu trên thiết bị.`;
  document.getElementById('successDetail').innerHTML = `<p><strong>Người nhận:</strong> ${escapeHtml(data.fullname)} · <strong>Điện thoại:</strong> ${escapeHtml(data.phone)}</p><p><strong>Địa chỉ:</strong> ${escapeHtml(data.street)}, ${escapeHtml(data.district)}, ${escapeHtml(data.province)}</p><p><strong>Thanh toán:</strong> ${data.payment === 'transfer' ? 'Chuyển khoản ngân hàng (chờ BY HER xác nhận)' : 'Thanh toán khi nhận hàng (COD)'}</p>${order.items.map(x => `<div class="summaryline"><span>${pget(x.id).name} · ${COLORS[x.color].name} · Size ${x.size} × ${x.qty}</span><b>${money(pget(x.id).price * x.qty)}</b></div>`).join('')}<p><strong>Tổng tiền sản phẩm:</strong> ${money(order.total)}</p>`;
  renderArQr('successQr', order.items[0].id, order.items[0].color, 120);
  form.reset();
  form.querySelectorAll('.field-error-msg').forEach(el => el.remove());
  form.querySelectorAll('.field-invalid').forEach(el => el.classList.remove('field-invalid'));
  go('success');
}

function renderOrders() {
  document.getElementById('orderList').innerHTML = orders.length ? orders.map(o => `<article class="panel" style="margin-bottom:20px"><div class="summaryline"><b>${escapeHtml(o.id)}</b><span>${escapeHtml(o.date)}</span></div><p class="tiny">${escapeHtml(o.status)}</p>${o.items.map(x => `<div class="summaryline"><span>${pget(x.id).name} · ${COLORS[x.color].name} · ${x.size} × ${x.qty}</span><b>${money(pget(x.id).price * x.qty)}</b></div>`).join('')}<div class="summaryline total"><span>Tổng tiền sản phẩm</span><span>${money(o.total)}</span></div><p class="tiny">Nhận hàng: ${escapeHtml(o.customer.street)}, ${escapeHtml(o.customer.district)}, ${escapeHtml(o.customer.province)}</p></article>`).join('') : '<div class="emptystate"><h2>Chưa có đơn hàng</h2><p>Đơn hàng mẫu sẽ xuất hiện ở đây sau khi nàng thử đặt mua.</p><button class="btn" onclick="go(\'shop\')">MUA SẮM NGAY</button></div>';
}

function sendMessage(e) {
  e.preventDefault();
  const form = e.target;
  if (!validateFormFields(form, CONTACT_RULES)) {
    toast('Vui lòng điền đầy đủ các thông tin bắt buộc (không được bỏ trống)!');
    return;
  }
  let d = new FormData(form);
  let subject = encodeURIComponent('Liên hệ BY HER từ ' + d.get('name'));
  let body = encodeURIComponent('Họ tên: ' + d.get('name') + '\nEmail: ' + d.get('email') + '\n\n' + d.get('message'));
  window.location.href = 'mailto:byher@gmail.com?subject=' + subject + '&body=' + body;
}
