/* ==========================================================================
   BY HER — shop.js
   Trang chủ (danh mục + sản phẩm nổi bật), trang Sản phẩm (lọc/sắp xếp), trang Chi tiết.
   Phụ thuộc: data.js, core.js
   ========================================================================== */

function category(p) {
  return `<article><a href="#detail" onclick="event.preventDefault();openProduct('${p.id}')" class="catimg"><img src="${img(p, p.colors[0])}" alt="${p.name}" loading="lazy"></a><div class="cat-info"><h3>${p.name}</h3><p>${p.colors.length} MÀU SẮC • S / M / L</p><button class="link" onclick="openProduct('${p.id}')">KHÁM PHÁ NGAY →</button></div></article>`;
}

function productCard(p) {
  let c = cardsColor[p.id] || p.colors[0];
  return `<article class="product"><div class="product-img" onclick="openProduct('${p.id}','${c}')"><img src="${img(p, c)}" alt="${p.name} màu ${COLORS[c].name}" loading="lazy"><span class="tag">${p.id}</span></div><button class="product-name" onclick="openProduct('${p.id}','${c}')">${p.name}</button><div class="price">${money(p.price)}</div><div class="swatches">${p.colors.map(co => `<button title="${COLORS[co].name}" aria-label="Màu ${COLORS[co].name}" class="swatch ${co === c ? 'selected' : ''}" style="background:${COLORS[co].hex}" onclick="cardsColor['${p.id}']='${co}';refreshCards()"></button>`).join('')}<span class="tiny">${COLORS[c].name}</span></div><div class="product-actions"><button class="btn outline" onclick="openProduct('${p.id}','${c}')">CHI TIẾT</button><button class="btn outline" onclick="openAR('${p.id}','${c}')">THỬ AR</button><button class="btn outline" onclick="openVR('${p.id}','${c}')">XOAY 360°</button></div></article>`;
}

function refreshCards() {
  renderShop();
  document.getElementById('homeFeatured').innerHTML = products.map(productCard).join('');
}

function renderShop() {
  let q = document.getElementById('search').value.toLowerCase().trim(),
    type = document.getElementById('filterType').value,
    co = document.getElementById('filterColor').value,
    sz = document.getElementById('filterSize').value,
    pr = document.getElementById('filterPrice').value,
    sort = document.getElementById('sort').value;
  let list = products.filter(p =>
    (type === 'all' || p.id === type) &&
    (co === 'all' || p.colors.includes(co)) &&
    (sz === 'all' || ['S', 'M', 'L'].includes(sz)) &&
    (pr === 'all' || (p.price >= PRICE_RANGES[pr].min && p.price < PRICE_RANGES[pr].max)) &&
    (p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)));
  if (sort === 'low') list.sort((a, b) => a.price - b.price);
  if (sort === 'high') list.sort((a, b) => b.price - a.price);
  if (co !== 'all') list.forEach(p => cardsColor[p.id] = co);
  document.getElementById('shopResult').textContent = `Hiển thị ${list.length} dòng sản phẩm • Chọn màu trực tiếp để đổi ảnh`;
  document.getElementById('shopGrid').innerHTML = list.map(productCard).join('') || '<p>Không tìm thấy sản phẩm phù hợp.</p>';
}

/* ---- Trang chi tiết ---- */
function openProduct(id, color) {
  current = pget(id);
  if (!current) return;
  chosenColor = current.colors.includes(color) ? color : current.colors[0];
  chosenSize = 'M';
  qty = 1;
  galleryIndex = 0;
  renderDetail();
  go('detail');
}

function renderDetail() {
  if (!current) return;
  let p = current;
  document.getElementById('crumbProduct').textContent = p.name;
  document.getElementById('detailName').textContent = p.name;
  document.getElementById('detailCode').textContent = 'MÃ SẢN PHẨM: ' + p.id;
  document.getElementById('detailPrice').textContent = money(p.price);
  document.getElementById('chosenColor').textContent = COLORS[chosenColor].name;
  document.getElementById('chosenSize').textContent = chosenSize;
  document.getElementById('detailQty').textContent = qty;
  document.getElementById('imageCaution').textContent = p.note;
  document.getElementById('detailSwatches').innerHTML = p.colors.map(c => `<button title="${COLORS[c].name}" aria-label="Chọn màu ${COLORS[c].name}" class="swatch ${c === chosenColor ? 'selected' : ''}" style="width:30px;height:30px;background:${COLORS[c].hex}" onclick="chooseColor('${c}')"></button>`).join('');
  document.getElementById('detailSizes').innerHTML = ['S', 'M', 'L'].map(s => `<button class="size ${s === chosenSize ? 'on' : ''}" onclick="chosenSize='${s}';renderDetail()">${s}</button>`).join('');
  let photos = [...(p.images[chosenColor] || [])];
  if (p.extra) photos.push(...p.extra);
  document.getElementById('detailMain').src = IMG[photos[galleryIndex] || photos[0]];
  document.getElementById('detailThumbs').innerHTML = photos.map((key, i) => `<button class="thumb ${galleryIndex === i ? 'on' : ''}" onclick="galleryIndex=${i};renderDetail()"><img src="${IMG[key]}" alt="Hình ${i + 1}"></button>`).join('');
  renderArQr('detailQr', p.id, chosenColor, 110);
}

function chooseColor(c) { chosenColor = c; galleryIndex = 0; renderDetail(); }

function setDetailQty(v) {
  qty = Math.max(1, Math.min(99, qty + v));
  document.getElementById('detailQty').textContent = qty;
}
