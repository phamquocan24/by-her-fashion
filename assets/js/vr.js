/* ==========================================================================
   BY HER — vr.js
   BY HER 3D Garment Showroom (Three.js + GLTFLoader + DRACOLoader + OrbitControls)
   - Tải trực tiếp 3 mô hình 3D PBR nén Draco (.glb): bh01.glb, bh02.glb, bh03.glb
   - Đổi màu PBR thời gian thực cho toàn bộ 11 biến thể màu sắc BY HER
   - Xoay 360° đa trục (X, Y, Z) mượt mà + Zoom + Bật/tắt Lưới 3D (Wireframe) & Trục XYZ
   - 2 Chế độ: Tự động xoay 360° & Tự xoay thủ công + 5 góc nhìn nhanh
   ========================================================================== */

var vrProductId = 'BH01';
var vrColor = 'yellow';

const VR_MODELS = {
  BH01: 'assets/models/bh01.glb',
  BH02: 'assets/models/bh02.glb',
  BH03: 'assets/models/bh03.glb'
};

/* Bảng màu tint đã tinh chỉnh riêng cho vật liệu vải PBR trắng (giữ nguyên nếp gấp & bóng vải) */
const VR_FABRIC_TINT = {
  white:  { hex: '#ffffff', roughness: 0.84, metalness: 0.02 },
  black:  { hex: '#232022', roughness: 0.90, metalness: 0.03 },
  red:    { hex: '#a83444', roughness: 0.85, metalness: 0.02 },
  pink:   { hex: '#f0b2bf', roughness: 0.84, metalness: 0.02 },
  yellow: { hex: '#f6e08b', roughness: 0.84, metalness: 0.02 }
};

/* Trạng thái điều khiển */
let vrMode = 'auto';          // 'auto' | 'manual'
let vrIsPlaying = true;
let vrDirection = 1;          // 1: thuận chiều, -1: ngược chiều
let vrAngle = 0;              // Góc xoay trục Y (0..360 độ)
let vrTargetAngle = null;     // Góc mục tiêu khi bấm góc nhìn nhanh
let vrZoom = 1.0;             // 0.75..1.40
let vrShowWireframe = false;
let vrShowAxes = false;

/* Đối tượng Three.js (lazy-loaded khi mở trang 3D) */
let THREE_LIB = null;
let vrRenderer = null;
let vrScene = null;
let vrCamera = null;
let vrControls = null;
let vrGltfLoader = null;
let vrTurntableGroup = null;
let vrGarmentContainer = null;
let vrAxesHelper = null;
let vrCurrentModel = null;
let vrWireframeOverlay = null;
const vrModelCache = {};      // Cache các file .glb đã tải

let vrMounted = false;
let vrAnimId = null;
let vrResizeObserver = null;
let vrLoadSeq = 0;
let vrUserInteracting = false;

const VR_BASE_CAM_DIST = 4.75;
const VR_AUTO_SPEED = 0.0045; // Tốc độ xoay chậm rãi, sang trọng (~15°/giây)

/* ==========================================
   1. MỞ TRANG XEM 3D & ĐỒNG BỘ GIAO DIỆN
   ========================================== */
function openVR(id, color) {
  const p = id ? pget(id) : products[0];
  vrProductId = p ? p.id : products[0].id;
  const prod = pget(vrProductId);
  vrColor = (color && prod.colors.includes(color)) ? color : prod.colors[0];
  go('vr');
}

function vrMount() {
  vrMounted = true;
  vrSyncControlsUI();
  vrInitThree().then(ok => {
    if (!ok || !vrMounted) return;
    vrLoadGarment(vrProductId, vrColor);
    vrStartLoop();
  });
}

function vrUnmount() {
  vrMounted = false;
  if (vrAnimId) {
    cancelAnimationFrame(vrAnimId);
    vrAnimId = null;
  }
}

function vrSyncControlsUI() {
  const sel = document.getElementById('vrProduct');
  if (sel) {
    if (!sel.options.length) {
      sel.innerHTML = products.map(p => `<option value="${p.id}">${p.name} (${p.id})</option>`).join('');
    }
    sel.value = vrProductId;
  }

  const p = pget(vrProductId);
  const colorText = document.getElementById('vrColorText');
  if (colorText && COLORS[vrColor]) colorText.textContent = COLORS[vrColor].name;

  const swatchesEl = document.getElementById('vrSwatches');
  if (swatchesEl && p) {
    swatchesEl.innerHTML = p.colors.map(c =>
      `<button type="button" aria-label="Màu ${COLORS[c].name}" title="${COLORS[c].name}" class="swatch ${c === vrColor ? 'selected' : ''}" style="background:${COLORS[c].hex};width:34px;height:34px" onclick="vrPickColor('${c}')"></button>`
    ).join('');
  }

  const tabAuto = document.getElementById('vrTabAuto');
  const tabManual = document.getElementById('vrTabManual');
  if (tabAuto && tabManual) {
    tabAuto.classList.toggle('active', vrMode === 'auto');
    tabAuto.setAttribute('aria-selected', vrMode === 'auto' ? 'true' : 'false');
    tabManual.classList.toggle('active', vrMode === 'manual');
    tabManual.setAttribute('aria-selected', vrMode === 'manual' ? 'true' : 'false');
  }

  const hudDot = document.getElementById('vrHudDot');
  const hudModeText = document.getElementById('vrHudModeText');
  const hint = document.getElementById('vrStageHint');
  if (hudDot) hudDot.classList.toggle('paused', vrMode === 'manual' || !vrIsPlaying);
  if (hudModeText) {
    hudModeText.textContent = vrMode === 'auto'
      ? (vrIsPlaying ? 'Tự động xoay 360°' : 'Đã tạm dừng xoay')
      : 'Tự xoay 3D đa trục';
  }
  if (hint) {
    hint.classList.toggle('show', vrMode === 'manual');
  }

  const btnWire = document.getElementById('vrBtnWireframe');
  if (btnWire) btnWire.classList.toggle('active', vrShowWireframe);

  const btnAxes = document.getElementById('vrBtnAxes');
  if (btnAxes) btnAxes.classList.toggle('active', vrShowAxes);

  vrUpdatePlayIcon();
  vrUpdateStatus();
  vrUpdateHUD();
}

function vrUpdatePlayIcon() {
  const icon = document.getElementById('vrPlayPauseIcon');
  if (!icon) return;
  if (vrMode === 'auto' && vrIsPlaying) {
    icon.innerHTML = '<path d="M6 4h4v16H6zm8 0h4v16h-4z"/>';
  } else {
    icon.innerHTML = '<path d="M8 5v14l11-7z"/>';
  }
}

function vrUpdateStatus() {
  const st = document.getElementById('vrStatus');
  if (!st) return;
  const p = pget(vrProductId);
  if (!p) return;
  st.textContent = `Đang xem 3D: ${p.name} — Màu ${COLORS[vrColor].name} · ${money(p.price)} · Mô hình 3D PBR tương tác`;
}

function vrAngleLabel(deg) {
  const a = ((Math.round(deg) % 360) + 360) % 360;
  if (a >= 335 || a < 25) return 'Mặt trước';
  if (a >= 25 && a < 65) return 'Nghiêng trước (phải)';
  if (a >= 65 && a < 115) return 'Cạnh bên phải';
  if (a >= 115 && a < 155) return 'Nghiêng sau (phải)';
  if (a >= 155 && a < 205) return 'Mặt sau';
  if (a >= 205 && a < 245) return 'Nghiêng sau (trái)';
  if (a >= 245 && a < 295) return 'Cạnh bên trái';
  return 'Nghiêng trước (trái)';
}

function vrUpdateHUD() {
  const deg = ((Math.round(vrAngle) % 360) + 360) % 360;
  const hudAngle = document.getElementById('vrHudAngle');
  if (hudAngle) hudAngle.textContent = `${deg}° · ${vrAngleLabel(deg)}`;

  const slider = document.getElementById('vrAngleSlider');
  if (slider && document.activeElement !== slider) slider.value = deg;

  const valEl = document.getElementById('vrAngleValue');
  if (valEl) valEl.textContent = `${deg}°`;

  [0, 45, 90, 180, 270].forEach(preset => {
    const btn = document.getElementById('vrPreset' + preset);
    if (!btn) return;
    let diff = Math.abs(deg - preset);
    if (diff > 180) diff = 360 - diff;
    btn.classList.toggle('active', diff <= 12);
  });
}

function vrSetLoader(visible, text) {
  const el = document.getElementById('vrLoader');
  const txt = document.getElementById('vrLoaderText');
  if (txt && text) txt.textContent = text;
  if (el) el.classList.toggle('hidden', !visible);
}

/* ==========================================
   2. KHỞI TẠO THREE.JS STUDIO 3D ENGINE
   ========================================== */
async function vrInitThree() {
  if (vrRenderer) {
    vrResizeThree();
    return true;
  }

  const stage = document.getElementById('vrStage');
  const canvas = document.getElementById('vrCanvas');
  if (!stage || !canvas) return false;

  vrSetLoader(true, 'Đang khởi tạo không gian 3D...');

  try {
    const [THREE, { OrbitControls }, { GLTFLoader }, { DRACOLoader }, { RoomEnvironment }] = await Promise.all([
      import('three'),
      import('three/addons/controls/OrbitControls.js'),
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/loaders/DRACOLoader.js'),
      import('three/addons/environments/RoomEnvironment.js')
    ]);
    THREE_LIB = THREE;

    /* 1. Renderer PBR chất lượng cao */
    vrRenderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    vrRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    vrRenderer.outputColorSpace = THREE.SRGBColorSpace;
    vrRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    vrRenderer.toneMappingExposure = 1.05;
    vrRenderer.shadowMap.enabled = true;
    vrRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

    /* 2. Scene & Studio Environment (ánh sáng phản xạ dịu nhẹ chuẩn thời trang) */
    vrScene = new THREE.Scene();

    const pmremGenerator = new THREE.PMREMGenerator(vrRenderer);
    vrScene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    vrScene.environmentIntensity = 0.55;
    pmremGenerator.dispose();

    /* 3. Camera */
    const rect = stage.getBoundingClientRect();
    const w = Math.max(rect.width, 300);
    const h = Math.max(rect.height, 360);
    vrCamera = new THREE.PerspectiveCamera(36, w / h, 0.1, 100);
    vrCamera.position.set(0, 0.35, VR_BASE_CAM_DIST);

    /* 4. Hệ thống ánh sáng Studio 3 điểm */
    const hemiLight = new THREE.HemisphereLight(0xfffaf6, 0xead8d3, 0.85);
    vrScene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
    keyLight.position.set(3.2, 5.2, 4.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.bias = -0.0005;
    vrScene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xfff0ec, 0.65);
    fillLight.position.set(-4.0, 2.2, 2.5);
    vrScene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffe8ee, 0.75);
    rimLight.position.set(0, 3.0, -4.5);
    vrScene.add(rimLight);

    /* 5. Nhóm Bục xoay 3D & Chứa áo */
    vrTurntableGroup = new THREE.Group();
    vrScene.add(vrTurntableGroup);

    vrBuildPedestal(THREE);

    vrGarmentContainer = new THREE.Group();
    vrTurntableGroup.add(vrGarmentContainer);

    /* Trục tọa độ 3D (X: đỏ, Y: xanh lá, Z: xanh dương) */
    vrAxesHelper = new THREE.AxesHelper(1.1);
    vrAxesHelper.position.set(-1.15, -1.05, 0);
    vrAxesHelper.visible = vrShowAxes;
    vrScene.add(vrAxesHelper);

    /* 6. OrbitControls: Xoay 360° đa trục & Zoom mượt */
    vrControls = new OrbitControls(vrCamera, canvas);
    vrControls.enableDamping = true;
    vrControls.dampingFactor = 0.07;
    vrControls.enablePan = false;
    vrControls.minDistance = 2.2;
    vrControls.maxDistance = 6.0;
    vrControls.minPolarAngle = Math.PI * 0.12;  // Cho phép nhìn nghiêng từ trên xuống cổ/vai
    vrControls.maxPolarAngle = Math.PI * 0.82;  // Cho phép nhìn từ dưới lên gấu áo
    vrControls.target.set(0, 0.05, 0);

    vrControls.addEventListener('start', () => {
      vrUserInteracting = true;
      vrTargetAngle = null;
    });
    vrControls.addEventListener('end', () => {
      vrUserInteracting = false;
    });
    vrControls.addEventListener('change', () => {
      // Đồng bộ thanh trượt Zoom khi người dùng cuộn chuột / chụm ngón tay
      const dist = vrCamera.position.distanceTo(vrControls.target);
      const pct = Math.round(Math.max(75, Math.min(140, (VR_BASE_CAM_DIST / dist) * 100)));
      const zSlider = document.getElementById('vrZoomSlider');
      const zVal = document.getElementById('vrZoomValue');
      if (zSlider && document.activeElement !== zSlider) zSlider.value = pct;
      if (zVal) zVal.textContent = `${pct}%`;
    });

    /* 7. GLTFLoader + DRACOLoader */
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    dracoLoader.preload();

    vrGltfLoader = new GLTFLoader();
    vrGltfLoader.setDRACOLoader(dracoLoader);

    /* 8. Responsive ResizeObserver */
    vrResizeThree();
    if (typeof ResizeObserver !== 'undefined') {
      vrResizeObserver = new ResizeObserver(() => vrResizeThree());
      vrResizeObserver.observe(stage);
    }
    window.addEventListener('resize', vrResizeThree);

    return true;
  } catch (err) {
    console.error('[BY HER 3D] Init error:', err);
    vrSetLoader(true, 'Không thể khởi tạo WebGL 3D trên trình duyệt này.');
    return false;
  }
}

function vrBuildPedestal(THREE) {
  const pedY = -1.16;

  /* Thân bục xoay 3D tông hồng kem BY HER */
  const pedGeo = new THREE.CylinderGeometry(1.08, 1.14, 0.14, 64);
  const pedMat = new THREE.MeshStandardMaterial({
    color: 0xf4e4df,
    roughness: 0.55,
    metalness: 0.08
  });
  const pedMesh = new THREE.Mesh(pedGeo, pedMat);
  pedMesh.position.y = pedY;
  pedMesh.receiveShadow = true;
  vrTurntableGroup.add(pedMesh);

  /* Viền kim loại vàng hồng mảnh quanh mặt bục */
  const rimGeo = new THREE.TorusGeometry(1.08, 0.012, 16, 72);
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xc99ca6,
    roughness: 0.35,
    metalness: 0.45
  });
  const rimMesh = new THREE.Mesh(rimGeo, rimMat);
  rimMesh.rotation.x = Math.PI / 2;
  rimMesh.position.y = pedY + 0.071;
  vrTurntableGroup.add(rimMesh);

  /* Vạch chia độ 360° xoay theo bục */
  const tickMatMain = new THREE.MeshBasicMaterial({ color: 0x8f5763 });
  const tickMatSub = new THREE.MeshBasicMaterial({ color: 0xcba8b0 });
  for (let i = 0; i < 36; i++) {
    const isMain = i % 9 === 0;
    const len = isMain ? 0.12 : 0.055;
    const tickGeo = new THREE.BoxGeometry(isMain ? 0.014 : 0.007, 0.004, len);
    const tick = new THREE.Mesh(tickGeo, isMain ? tickMatMain : tickMatSub);
    const a = (i * 10 * Math.PI) / 180;
    const r = 1.0 - len / 2;
    tick.position.set(Math.sin(a) * r, pedY + 0.073, Math.cos(a) * r);
    tick.rotation.y = a;
    vrTurntableGroup.add(tick);
  }

  /* Bóng mềm trên mặt bục ngay dưới gấu áo */
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 256;
  const sctx = shadowCanvas.getContext('2d');
  const grad = sctx.createRadialGradient(128, 128, 10, 128, 128, 120);
  grad.addColorStop(0, 'rgba(73, 54, 58, 0.24)');
  grad.addColorStop(0.55, 'rgba(73, 54, 58, 0.08)');
  grad.addColorStop(1, 'rgba(73, 54, 58, 0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 256, 256);

  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 1.7),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = pedY + 0.075;
  vrTurntableGroup.add(shadowPlane);
}

function vrResizeThree() {
  if (!vrRenderer || !vrCamera) return;
  const stage = document.getElementById('vrStage');
  if (!stage) return;
  const rect = stage.getBoundingClientRect();
  const w = Math.max(Math.round(rect.width), 280);
  const h = Math.max(Math.round(rect.height), 340);
  vrCamera.aspect = w / h;
  vrCamera.updateProjectionMatrix();
  vrRenderer.setSize(w, h, false);
}

/* ==========================================
   3. TẢI MODEL .GLB & ÁP MÀU VẢI PBR
   ========================================== */
async function vrLoadGarment(productId, colorKey) {
  if (!vrGltfLoader || !THREE_LIB) return;
  const seq = ++vrLoadSeq;
  const url = VR_MODELS[productId] || VR_MODELS.BH01;

  if (vrModelCache[productId]) {
    vrAttachModel(vrModelCache[productId], colorKey);
    vrSetLoader(false);
    return;
  }

  vrSetLoader(true, `Đang tải mô hình 3D ${productId}...`);

  vrGltfLoader.load(
    url,
    gltf => {
      if (seq !== vrLoadSeq) return;
      const root = gltf.scene;
      vrNormalizeModel(root);
      vrModelCache[productId] = root;
      vrAttachModel(root, vrColor);
      vrSetLoader(false);
    },
    xhr => {
      if (seq !== vrLoadSeq) return;
      if (xhr.total > 0) {
        const pct = Math.min(100, Math.round((xhr.loaded / xhr.total) * 100));
        vrSetLoader(true, `Đang tải mô hình 3D ${productId}... ${pct}%`);
      }
    },
    err => {
      if (seq !== vrLoadSeq) return;
      console.error('[BY HER 3D] Load GLB error:', err);
      vrSetLoader(true, 'Không thể tải mô hình 3D. Vui lòng thử lại.');
    }
  );
}

/* Căn giữa tâm & chuẩn hóa tỉ lệ mọi file GLB để đứng vừa đẹp trên bục xoay */
function vrNormalizeModel(root) {
  const THREE = THREE_LIB;
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const targetHeight = 1.85;
  const scale = targetHeight / (size.y || maxDim);

  root.scale.setScalar(scale);

  // Tính lại bounding box sau khi scale
  const scaledBox = new THREE.Box3().setFromObject(root);
  const scaledCenter = new THREE.Vector3();
  scaledBox.getCenter(scaledCenter);

  root.position.x -= scaledCenter.x;
  root.position.z -= scaledCenter.z;
  // Đặt đáy áo cách mặt bục xoay một khoảng nhẹ thanh thoát (-0.88)
  root.position.y -= scaledBox.min.y + 0.88;

  root.traverse(obj => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      if (obj.material) {
        obj.material = obj.material.clone();
        obj.material.side = THREE.DoubleSide;
      }
    }
  });
}

function vrAttachModel(modelGroup, colorKey) {
  const THREE = THREE_LIB;
  // Gỡ model cũ khỏi container (nhưng vẫn giữ trong cache để chuyển lại tức thì)
  while (vrGarmentContainer.children.length > 0) {
    vrGarmentContainer.remove(vrGarmentContainer.children[0]);
  }
  vrWireframeOverlay = null;

  vrCurrentModel = modelGroup;
  vrGarmentContainer.add(vrCurrentModel);

  // Tạo lớp phủ Wireframe 3D kỹ thuật (ẩn/hiện theo nút bật lưới)
  vrWireframeOverlay = vrCurrentModel.clone();
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x7cb8e8,
    wireframe: true,
    transparent: true,
    opacity: 0.28,
    depthTest: true
  });
  vrWireframeOverlay.traverse(obj => {
    if (obj.isMesh) {
      obj.material = wireMat;
      obj.castShadow = false;
      obj.receiveShadow = false;
    }
  });
  vrWireframeOverlay.scale.multiplyScalar(1.004);
  vrWireframeOverlay.visible = vrShowWireframe;
  vrGarmentContainer.add(vrWireframeOverlay);

  vrApplyFabricColor(colorKey);
}

function vrApplyFabricColor(colorKey) {
  if (!vrCurrentModel || !THREE_LIB) return;
  const preset = VR_FABRIC_TINT[colorKey] || {
    hex: (COLORS[colorKey] && COLORS[colorKey].hex) || '#ffffff',
    roughness: 0.85,
    metalness: 0.02
  };
  const tintColor = new THREE_LIB.Color(preset.hex);

  vrCurrentModel.traverse(obj => {
    if (obj.isMesh && obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(mat => {
        if (mat.color) mat.color.copy(tintColor);
        if (typeof mat.roughness === 'number') mat.roughness = preset.roughness;
        if (typeof mat.metalness === 'number') mat.metalness = preset.metalness;
        mat.needsUpdate = true;
      });
    }
  });
}

/* ==========================================
   4. VÒNG LẶP RENDER 60FPS
   ========================================== */
function vrStartLoop() {
  if (vrAnimId) cancelAnimationFrame(vrAnimId);
  const tick = () => {
    if (!vrMounted) return;
    vrAnimId = requestAnimationFrame(tick);

    if (vrTurntableGroup) {
      if (vrTargetAngle !== null) {
        let diff = vrTargetAngle - vrAngle;
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;
        if (Math.abs(diff) < 0.4) {
          vrAngle = vrTargetAngle;
          vrTargetAngle = null;
        } else {
          vrAngle += diff * 0.14;
        }
        vrTurntableGroup.rotation.y = (vrAngle * Math.PI) / 180;
        vrUpdateHUD();
      } else if (vrMode === 'auto' && vrIsPlaying && !vrUserInteracting) {
        vrAngle = (vrAngle + (VR_AUTO_SPEED * 180 / Math.PI) * vrDirection + 360) % 360;
        vrTurntableGroup.rotation.y = (vrAngle * Math.PI) / 180;
        vrUpdateHUD();
      }
    }

    if (vrControls) vrControls.update();
    if (vrRenderer && vrScene && vrCamera) {
      vrRenderer.render(vrScene, vrCamera);
    }
  };
  vrAnimId = requestAnimationFrame(tick);
}

/* ==========================================
   5. CÁC HÀM TƯƠNG TÁC NGƯỜI DÙNG
   ========================================== */
function vrSetMode(mode) {
  vrMode = mode === 'manual' ? 'manual' : 'auto';
  vrTargetAngle = null;
  if (vrMode === 'auto') vrIsPlaying = true;
  vrSyncControlsUI();
}

function vrTogglePlay() {
  if (vrMode === 'manual') {
    vrMode = 'auto';
    vrIsPlaying = true;
  } else {
    vrIsPlaying = !vrIsPlaying;
  }
  vrSyncControlsUI();
}

function vrToggleDirection() {
  vrDirection *= -1;
  if (vrMode === 'manual') {
    vrMode = 'auto';
    vrIsPlaying = true;
  }
  vrSyncControlsUI();
}

function vrResetAngle() {
  vrTargetAngle = 0;
  vrZoom = 1.0;
  if (vrCamera && vrControls) {
    vrCamera.position.set(0, 0.35, VR_BASE_CAM_DIST);
    vrControls.target.set(0, 0.05, 0);
    vrControls.update();
  }
  const zSlider = document.getElementById('vrZoomSlider');
  const zVal = document.getElementById('vrZoomValue');
  if (zSlider) zSlider.value = 100;
  if (zVal) zVal.textContent = '100%';
  vrUpdateHUD();
}

function vrSetAngle(deg) {
  vrMode = 'manual';
  vrTargetAngle = ((deg % 360) + 360) % 360;
  vrSyncControlsUI();
}

function vrOnSliderAngle(val) {
  vrMode = 'manual';
  vrTargetAngle = null;
  vrAngle = Number(val) || 0;
  if (vrTurntableGroup) {
    vrTurntableGroup.rotation.y = (vrAngle * Math.PI) / 180;
  }
  vrSyncControlsUI();
}

function vrOnSliderZoom(val) {
  const pct = Number(val) || 100;
  vrZoom = pct / 100;
  const zVal = document.getElementById('vrZoomValue');
  if (zVal) zVal.textContent = `${pct}%`;

  if (vrCamera && vrControls && THREE_LIB) {
    const dir = new THREE_LIB.Vector3()
      .subVectors(vrCamera.position, vrControls.target)
      .normalize();
    const newDist = Math.max(2.2, Math.min(6.0, VR_BASE_CAM_DIST / vrZoom));
    vrCamera.position.copy(vrControls.target).addScaledVector(dir, newDist);
    vrControls.update();
  }
}

function vrToggleWireframe() {
  vrShowWireframe = !vrShowWireframe;
  if (vrWireframeOverlay) vrWireframeOverlay.visible = vrShowWireframe;
  const btn = document.getElementById('vrBtnWireframe');
  if (btn) btn.classList.toggle('active', vrShowWireframe);
}

function vrToggleAxes() {
  vrShowAxes = !vrShowAxes;
  if (vrAxesHelper) vrAxesHelper.visible = vrShowAxes;
  const btn = document.getElementById('vrBtnAxes');
  if (btn) btn.classList.toggle('active', vrShowAxes);
}

function vrChangeProduct(id) {
  const p = pget(id);
  if (!p) return;
  vrProductId = p.id;
  if (!p.colors.includes(vrColor)) vrColor = p.colors[0];
  vrSyncControlsUI();
  vrLoadGarment(vrProductId, vrColor);
}

function vrPickColor(colorKey) {
  const p = pget(vrProductId);
  if (!p || !p.colors.includes(colorKey)) return;
  vrColor = colorKey;
  vrSyncControlsUI();
  vrApplyFabricColor(vrColor);
}

function vrAddToCart(buyNow) {
  addToCart(vrProductId, vrColor, 'M', 1, !!buyNow);
}
