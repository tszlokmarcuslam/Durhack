// Webcam motion tracking for Nook. Two MediaPipe models run in the browser:
//  - Face Landmarker: head turn, nod and tilt
//  - Pose Landmarker: shoulders, elbows and wrists, so the avatar copies your arms and body lean
// The camera picture is shown in `stage` (mirrored, with a skeleton drawn over it) and never leaves the browser.
const VER = '0.10.14';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}`;
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const POSE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
// Mirror mode: you turn right, the avatar turns to the screen's right. Flip a sign if one axis feels backwards.
const SIGN = { yaw: -1, pitch: -1, roll: -1 };
const clamp = (v, a) => Math.max(-a, Math.min(a, v));
// Bones drawn on the camera preview (MediaPipe pose landmark indices).
const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [15, 19], [16, 20]];
const JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

export async function startTracking({ stage, onPose }) {
  // Ask for the camera first so the permission prompt appears straight away.
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
  let face, pose;
  try {
    const vision = await import(`${CDN}/vision_bundle.mjs`);
    const files = await vision.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
    const make = (Task, model, extra) => {
      const opts = delegate => Object.assign({ baseOptions: { modelAssetPath: model, delegate }, runningMode: 'VIDEO' }, extra);
      return Task.createFromOptions(files, opts('GPU')).catch(() => Task.createFromOptions(files, opts('CPU')));
    };
    [face, pose] = await Promise.all([
      make(vision.FaceLandmarker, FACE_MODEL, { numFaces: 1, outputFacialTransformationMatrixes: true }),
      make(vision.PoseLandmarker, POSE_MODEL, { numPoses: 1 })
    ]);
  } catch (e) { stream.getTracks().forEach(t => t.stop()); throw e; }

  const fit = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scaleX(-1)';
  const video = Object.assign(document.createElement('video'), { srcObject: stream, muted: true, playsInline: true });
  video.style.cssText = fit;
  const cv = document.createElement('canvas'); cv.style.cssText = fit + ';pointer-events:none';
  const g = cv.getContext('2d');
  if (stage) { stage.textContent = ''; stage.append(video, cv); }
  await video.play();

  // MediaPipe world coordinates (metres, x right in the camera image, y down, z away) -> avatar space seen in a mirror.
  const A = p => [-p.x, -p.y, -p.z];
  const sub = (a, b) => { const v = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const vis = (lm, ...ids) => Math.min(...ids.map(i => lm[i].visibility ?? 1));

  let alive = true, raf = 0, last = -1;
  const loop = () => {
    if (!alive) return; raf = requestAnimationFrame(loop);
    if (video.readyState < 2 || video.currentTime === last) return; last = video.currentTime;
    const ts = performance.now();
    const fr = face.detectForVideo(video, ts), pr = pose.detectForVideo(video, ts);

    let head = null;
    const m = fr.facialTransformationMatrixes && fr.facialTransformationMatrixes[0];
    if (m) { const d = m.data; head = { yaw: clamp(SIGN.yaw * Math.atan2(d[8], d[10]), .9), pitch: clamp(SIGN.pitch * Math.asin(clamp(d[9], 1)), .6), roll: clamp(SIGN.roll * Math.atan2(d[1], d[5]), .6) }; }

    let body = null;
    const lm = pr.landmarks && pr.landmarks[0], wl = pr.worldLandmarks && pr.worldLandmarks[0];
    if (lm && wl && vis(lm, 11, 12) > .5) {
      const W = wl.map(A), sh = sub(W[12], W[11]);
      // Your right side shows on the screen's right in a mirror, which is the avatar's left side (+x).
      // limb = [root, middle, end] joints: shoulder/elbow/wrist or hip/knee/ankle
      const limb = i => ({ up: sub(W[i[1]], W[i[0]]), fore: sub(W[i[2]], W[i[1]]), w: Math.max(0, Math.min(1, (vis(lm, ...i) - .45) / .3)) });
      body = {
        arms: { 1: limb([12, 14, 16]), [-1]: limb([11, 13, 15]) },
        legs: { 1: limb([24, 26, 28]), [-1]: limb([23, 25, 27]) },
        roll: clamp(Math.atan2(sh[1], sh[0]), .35), yaw: clamp(Math.atan2(-sh[2], sh[0]), .7)
      };
    }
    onPose({ head, body });

    // skeleton overlay
    if (cv.width !== video.videoWidth) { cv.width = video.videoWidth; cv.height = video.videoHeight; }
    g.clearRect(0, 0, cv.width, cv.height);
    if (lm) {
      const P = i => [lm[i].x * cv.width, lm[i].y * cv.height], ok = i => (lm[i].visibility ?? 1) > .5, u = cv.width / 320;
      g.lineCap = 'round'; g.lineWidth = 4 * u; g.strokeStyle = 'rgba(248,244,236,.9)';
      BONES.forEach(([a, b]) => { if (!ok(a) || !ok(b)) return; const p = P(a), q = P(b); g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); });
      JOINTS.forEach(i => { if (!ok(i)) return; const p = P(i); g.beginPath(); g.arc(p[0], p[1], 4.5 * u, 0, Math.PI * 2); g.fillStyle = '#5E683C'; g.fill(); g.lineWidth = 2 * u; g.strokeStyle = '#F8F4EC'; g.stroke(); });
      if (ok(0) && ok(7) && ok(8)) { const n = P(0), r = Math.hypot(P(7)[0] - P(8)[0], P(7)[1] - P(8)[1]) * .62; g.beginPath(); g.arc(n[0], n[1] - r * .2, r, 0, Math.PI * 2); g.lineWidth = 3 * u; g.strokeStyle = 'rgba(248,244,236,.85)'; g.stroke(); }
    }
  };
  loop();
  return {
    stop() {
      alive = false; cancelAnimationFrame(raf); stream.getTracks().forEach(t => t.stop());
      face.close(); pose.close(); video.remove(); cv.remove(); onPose(null);
    }
  };
}
