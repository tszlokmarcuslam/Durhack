// First-person view for the World games, and the drone move into it: the camera lifts, swings round to the front
// of your avatar while turning to face it, dives into its face, a quick blink, and you are looking out of its eyes
// at the other player. The same path backwards takes you out again.
// worldgame.js calls update() every frame, after world.js has placed the normal third-person camera, and blends
// from that camera, so the move always starts and ends exactly where the normal view is.
export function createDrone(T) {
  const FLY = 1.9, SWAP = .86, FOV = 72;   // seconds for the whole move, where the blink swaps the view, first-person field of view
  const UP = new T.Vector3(0, 1, 0), Z = new T.Vector3(0, 0, 1);
  const tp = new T.Vector3(), tq = new T.Quaternion(), eye = new T.Vector3(), front = new T.Vector3(), face = new T.Vector3();
  const fwd = new T.Vector3(), side = new T.Vector3(), c1 = new T.Vector3(), c2 = new T.Vector3(), p = new T.Vector3();
  const m4 = new T.Matrix4(), q = new T.Quaternion(), roll = new T.Quaternion();
  let k = 0, dir = 0, fov0 = null, lid = null, swing = 1, camRef = null;
  const smooth = v => { v = Math.max(0, Math.min(1, v)); return v * v * (3 - 2 * v); };
  const lookQ = (from, to, out) => out.setFromRotationMatrix(m4.lookAt(from, to, UP));
  function blink(v) {   // 0 open, 1 shut
    if (typeof document === 'undefined' || (!lid && v <= 0)) return;
    if (!lid) { lid = document.createElement('div'); lid.style.cssText = 'position:fixed;inset:0;z-index:30;pointer-events:none;background:radial-gradient(circle at 50% 50%,#1A2216 0,#070906 70%);opacity:0'; document.body.appendChild(lid); }
    lid.style.opacity = v.toFixed(3);
  }
  function setFov(cam, f) { if (Math.abs(cam.fov - f) > .01) { cam.fov = f; cam.updateProjectionMatrix(); } }
  return {
    k: () => k,
    first: () => k >= SWAP,            // looking out of the eyes: hide your own head
    go(d) { dir = d; },                // 1 fly in, -1 fly back out
    // me: { head: world position of your head, face: which way your avatar looks (radians), s: avatar size }
    // target: what you look at in first person (the other player's face)
    update(cam, dt, me, target) {
      camRef = cam; if (fov0 == null) fov0 = cam.fov;
      if (dir) k = Math.max(0, Math.min(1, k + dir * dt / FLY));
      if (k <= 0) { blink(0); setFov(cam, fov0); return; }
      tp.copy(cam.position); tq.copy(cam.quaternion);
      const s = me.s || 1;
      fwd.set(Math.sin(me.face), 0, Math.cos(me.face)); side.set(fwd.z, 0, -fwd.x);
      face.copy(me.head).addScaledVector(fwd, .12 * s);                               // the front of the face
      eye.copy(me.head).addScaledVector(fwd, .17 * s).addScaledVector(UP, .03 * s);   // just in front of it, where the eyes look from
      front.copy(eye).addScaledVector(fwd, 1.1 * s).addScaledVector(UP, .08 * s);     // hovering in front of the face, looking at it
      let fov = fov0, shut = 0;
      if (k < .72) {   // swing round to the front, turning to look at the face, banking like a drone
        const u = smooth(k / .72), a = 1 - u;
        if (k < .06) swing = Math.sign(side.dot(p.copy(tp).sub(eye))) || 1;   // go round on the side the camera is already on
        c1.copy(tp).addScaledVector(UP, .9 * s);
        c2.copy(front).addScaledVector(side, 1.6 * s * swing).addScaledVector(fwd, .3 * s);
        p.set(0, 0, 0).addScaledVector(tp, a * a * a).addScaledVector(c1, 3 * a * a * u).addScaledVector(c2, 3 * a * u * u).addScaledVector(front, u * u * u);
        cam.position.copy(p); cam.quaternion.copy(tq).slerp(lookQ(p, face, q), u);
        cam.quaternion.multiply(roll.setFromAxisAngle(Z, Math.sin(u * Math.PI) * .22 * swing));
      } else {         // dive into the face, blink, then look out of the eyes
        const v = (k - .72) / .28;
        cam.position.lerpVectors(front, eye, smooth(Math.min(1, v * 1.15)));
        if (k < SWAP) lookQ(cam.position, face, cam.quaternion);
        else { lookQ(eye, target, cam.quaternion); fov = fov0 + (FOV - fov0) * smooth((k - SWAP) / (1 - SWAP)); }
        shut = Math.max(0, 1 - Math.abs(k - SWAP) / .09);
      }
      blink(shut); setFov(cam, fov);
    },
    reset() { k = 0; dir = 0; if (lid) { lid.remove(); lid = null; } if (camRef && fov0 != null) setFov(camRef, fov0); fov0 = null; }
  };
}
