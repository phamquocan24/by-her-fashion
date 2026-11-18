/* ==========================================================================
   BY HER — pose.js
   Nhận dạng dáng người bằng MediaPipe Pose Landmarker (tải lười khi mở phòng thử áo).
   Chạy hoàn toàn trong trình duyệt: ảnh/camera không rời thiết bị.
   Phụ thuộc: data.js (POSE_CFG)
   ========================================================================== */

const POSE = { ready: null, landmarker: null, mode: null };

function poseLoad(timeoutMs) {
  if (POSE.landmarker) return Promise.resolve(POSE.landmarker);
  if (POSE.ready) return POSE.ready;
  const loadPromise = (async () => {
    const vision = await import(POSE_CFG.bundle);
    const fileset = await vision.FilesetResolver.forVisionTasks(POSE_CFG.wasm);
    const make = delegate => vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: POSE_CFG.model, delegate },
      runningMode: 'IMAGE',
      numPoses: 1
    });
    try { POSE.landmarker = await make('GPU'); } catch { POSE.landmarker = await make('CPU'); }
    POSE.mode = 'IMAGE';
    return POSE.landmarker;
  })();
  const timerPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('pose_timeout')), timeoutMs || 8000));
  POSE.ready = Promise.race([loadPromise, timerPromise]).catch(e => { POSE.ready = null; throw e; });
  return POSE.ready;
}

/* mode: 'IMAGE' (ảnh tĩnh) hoặc 'VIDEO' (camera) */
async function poseSetMode(mode) {
  await poseLoad();
  if (POSE.mode !== mode) {
    await POSE.landmarker.setOptions({ runningMode: mode });
    POSE.mode = mode;
  }
}

function poseDetectImage(el) {
  const r = POSE.landmarker.detect(el);
  return r.landmarks && r.landmarks[0] ? r.landmarks[0] : null;
}

function poseDetectVideo(video, ts) {
  const r = POSE.landmarker.detectForVideo(video, ts);
  return r.landmarks && r.landmarks[0] ? r.landmarks[0] : null;
}
