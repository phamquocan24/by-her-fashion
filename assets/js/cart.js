/* ==========================================================================
   BY HER — cart.js
   Giỏ hàng (drawer): thêm / đổi số lượng / xóa / tổng tiền.
   Phụ thuộc: data.js, core.js
   ========================================================================== */

/* Thêm 1 dòng vào giỏ (gộp nếu trùng mã + màu + size). Dùng chung cho trang chi tiết, phòng thử áo AR và trợ lý ảo.
   stay = true: không tự mở ngăn giỏ hàng (dùng khi thêm từ khung chat) */
function addToCart(id, color, size, quantity, buy, stay) {
  let found = cart.find(x => x.id === id && x.color === color && x.size === size);
  if (found) found.qty = Math.min(99, found.qty + quantity); else cart.push({ id, color, size, qty: quantity });
  save();
  updateCart();
  toast('Đã thêm sản phẩm vào giỏ hàng');
  if (buy) startCheckout(); else if (!stay) openCart();
}

function addDetail(buy) { addToCart(current.id, chosenColor, chosenSize, qty, buy); }

function cartTotal() { return cart.reduce((s, x) => s + (pget(x.id)?.price || 0) * x.qty, 0); }
function cartCount() { return cart.reduce((s, x) => s + x.qty, 0); }

function updateCart() {
  document.getElementById('cartBadge').textContent = cartCount();
  document.getElementById('cartTitleCount').textContent = cartCount();
  document.getElementById('cartBody').innerHTML = cart.length ? cart.map((x, i) => {
    let p = pget(x.id);
    return `<div class="itemline"><img src="${img(p, x.color)}" alt="${p.name}"><div><b>${p.name}</b><p>${p.id} · ${COLORS[x.color].name} · Size ${x.size}</p><strong>${money(p.price * x.qty)}</strong><div class="mini-qty"><button onclick="cartChange(${i},-1)">−</button>${x.qty}<button onclick="cartChange(${i},1)">+</button><button onclick="removeItem(${i})">Xóa</button></div></div></div>`;
  }).join('') : '<div class="emptystate"><h3>Giỏ hàng đang trống</h3><p>Hãy chọn mẫu áo nàng yêu thích nhé!</p><button class="btn outline" onclick="go(\'shop\')">XEM SẢN PHẨM</button></div>';
  document.getElementById('drawerTotals').innerHTML = `<div class="summaryline total"><span>Tạm tính</span><span>${money(cartTotal())}</span></div><p class="tiny">Phí vận chuyển chưa được tính. Cửa hàng sẽ xác nhận sau.</p>`;
  document.querySelector('.drawerfoot .btn').disabled = !cart.length;
}

function cartChange(i, v) {
  cart[i].qty = Math.min(99, cart[i].qty + v);
  if (cart[i].qty <= 0) cart.splice(i, 1);
  save();
  updateCart();
  renderCheckout();
}

function removeItem(i) { cart.splice(i, 1); save(); updateCart(); renderCheckout(); }

function openCart() {
  updateCart();
  document.getElementById('shade').classList.add('on');
  document.getElementById('cartDrawer').classList.add('on');
}

function closeCart() {
  document.getElementById('shade').classList.remove('on');
  document.getElementById('cartDrawer').classList.remove('on');
}

function startCheckout() {
  if (!cart.length) { toast('Giỏ hàng trống'); return; }
  go('checkout');
}
