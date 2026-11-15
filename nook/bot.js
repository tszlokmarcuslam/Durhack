// The flying companion robot, rebuilt for the Nook page from the React app's src/world/Pet.tsx: the same shape (cat
// ears, visor face, floating arms, hover ball), the same faces and gestures, the fairy flight and the sparkle trail.
// Home screen: it has its own see-through layer over the page, so it can rest by your avatar's shoulder, then perch
// next to the chat panel and fly around while the companion answers, without being hidden behind the panel.
// Island: it is a real object in the island scene and follows you around.
// Games: it perches at the top right of the screen and comments on the match (react(): fixed lines, no AI), e.g.
// it roasts you when your rocket hits an asteroid.
// Its colours are the ones picked in the React app (localStorage "echoworld-pet"), so it is the same robot.
const PI = Math.PI, sin = Math.sin, cos = Math.cos;
const FACE_Z = .262, SLEEP_AFTER = 45, GESTURE_SECONDS = 1.8, SPARKS = 18, BUBBLE_CHARS = 220;
const GESTURES = ['swing', 'open', 'point', 'beat', 'wave', 'swing', 'beat'];
// What it says in games. A key with _game (start_rocket) wins over the plain key (start). {name}: the other player.
const QUIPS = {
  start: [['Let’s gooo, don’t embarrass me', 'happy'], ['I brought snacks. Show me something', 'happy'], ['Warm up, champ. I’m watching', 'wink']],
  start_rocket: [['Buckle up, space cadet 🚀', 'happy'], ['Try not to hit EVERY rock this time', 'wink'], ['Asteroids are not speed bumps, ok?', 'surprised']],
  start_six: [['Six… seven… GO 🤲', 'happy'], ['Hands up, hands down. Don’t think, just flap', 'wink'], ['Show me those scales ⚖️', 'happy']],
  sixSeven: [['SIX SEVEN!!! 🤲🤲', 'love'], ['67?? You actually did the thing', 'surprised']],
  sixSevenThem: [['{name} hit 67. That’s bad news for us', 'sad'], ['{name} is a 6-7 machine 😳', 'surprised']],
  start_chess: [['Big brain time 🧠', 'thinking'], ['Don’t hang your queen. I’m begging', 'sad'], ['Pawns first. Panic later', 'wink']],
  start_boxing: [['Hands up, chin down 🥊', 'happy'], ['Float like a butterfly, dodge like you mean it', 'wink']],
  crash: [['Bro that asteroid was the size of a HOUSE 💀', 'surprised'], ['Who taught you to fly, a fridge?', 'wink'], ['Asteroids: 1. You: 0.', 'sad'],
    ['That rock had right of way 😭', 'surprised'], ['Insurance is NOT covering that', 'sad'], ['Did you close your eyes??', 'surprised'], ['It’s called STEERING. Look it up', 'wink'],
    ['Space is 99% empty and you found the 1%', 'surprised'], ['Another one?? I’m telling everyone', 'happy'], ['NASA just blocked you', 'sad'], ['Bumper cars is a different game, bro', 'wink']],
  theyCrash: [['LMAO {name} just ate a rock', 'happy'], ['{name} found the asteroid. With their face', 'happy'], ['Rest in pieces, {name} 💥', 'wink'], ['{name} drives like you, ngl', 'wink']],
  gotHit: [['Hands UP bro 🥊', 'surprised'], ['You felt that one in 4K', 'sad'], ['Bro is blocking with his face', 'surprised'], ['That’s gonna leave a mark', 'sad']],
  landed: [['OOF clean hit!', 'happy'], ['Do it again, do it again!', 'love'], ['{name} felt that one', 'wink']],
  dodged: [['Matrix moves 😎', 'happy'], ['Too slow, {name}!', 'wink']],
  take: [['Yoink 😤', 'happy'], ['Nom nom, free piece', 'happy'], ['{name} didn’t need that anyway', 'wink']],
  takeQueen: [['YOU TOOK THE QUEEN 👑', 'love'], ['Queen’s gone. {name} is crying rn', 'happy']],
  lost: [['Hey, that was ours!', 'sad'], ['Bro gave it away for free', 'surprised'], ['We call that a “sacrifice”. Right? RIGHT?', 'thinking']],
  lostQueen: [['Bro… your QUEEN 💀', 'surprised'], ['She deserved better', 'sad'], ['Never speak to me again', 'sad']],
  check: [['Check! Look at you, Magnus', 'happy'], ['Run, king, run', 'wink']],
  inCheck: [['Your king is sweating rn', 'surprised'], ['Check?! Do something!', 'surprised']],
  rpsWin: [['Called it 😎', 'happy'], ['Big brain hands', 'wink']],
  rpsLose: [['Bro threw the worst hand possible', 'surprised'], ['{name} read you like a book', 'sad']],
  rpsTie: [['Great minds… or both bad', 'thinking']],
  win: [['GG EZ 😎', 'love'], ['I knew you had it in you (I didn’t)', 'happy'], ['Screenshot that, it won’t happen again', 'wink']],
  win_rocket: [['First place! Somehow!', 'love'], ['Fastest pilot in the galaxy (today)', 'happy']],
  win_chess: [['Grandmaster vibes 🧠', 'love'], ['Checkmate! Put it on your CV', 'happy']],
  lose: [['{name} cooked you 🍳', 'sad'], ['Losing builds character. You have SO much character', 'wink'], ['I’m not mad. Just disappointed', 'sad'], ['Rematch. Now. My honour is at stake', 'surprised']],
  lose_rocket: [['{name} lapped you. In SPACE', 'sad'], ['Maybe stick to walking', 'wink']],
  win_six: [['Fastest hands on the island 🤲', 'love'], ['Your arms will hurt tomorrow. Worth it', 'happy']],
  lose_six: [['{name}’s hands were a blur. Yours were… there', 'sad'], ['Arm day. Every day. Starting now', 'wink']],
  lose_chess: [['Your king just retired', 'sad'], ['Maybe try checkers?', 'wink']],
  draw: [['A draw?? Boring. Again!', 'thinking'], ['Nobody wins, everybody’s sad', 'sad']]
};
// arm poses as [rotation.x, rotation.z]; x < 0 swings the arm forward, z = side * angle swings it outward
function gesturePose(g, side, t) {
  if (g === 'swing') return [sin(t * 4 + (side > 0 ? PI : 0)) * .7, side * .15];        // explaining while moving
  if (g === 'open') return [-.3, side * (1 + sin(t * 5) * .1)];                           // "ta-da"
  if (g === 'point') return side > 0 ? [-1.4 + sin(t * 6) * .08, side * .1] : [.15, side * .15];
  if (g === 'beat') return [-.8 - Math.abs(sin(t * 6)) * .35, side * .25];                // both hands bob on each phrase
  return side > 0 ? [0, side * (2.3 + sin(t * 10) * .3)] : [.1, side * .15];              // wave
}
const CSS = `.nb-layer{position:fixed;inset:0;width:100%;height:100%;z-index:14;pointer-events:none;display:none}
.nb-bubble{position:fixed;left:0;top:0;z-index:15;max-width:230px;padding:8px 12px;border:1px solid rgba(43,42,39,.07);border-radius:16px;background:#FBF8F1;color:#2B2A27;box-shadow:0 8px 22px rgba(43,42,39,.16);font:600 13px/1.35 'Figtree',system-ui,sans-serif;text-align:left;cursor:pointer;transform-origin:50% 100%;transition:opacity .2s ease}
.nb-bubble:after{content:'';position:absolute;left:50%;bottom:-6px;width:12px;height:12px;margin-left:-6px;background:#FBF8F1;border-right:1px solid rgba(43,42,39,.07);border-bottom:1px solid rgba(43,42,39,.07);transform:rotate(45deg)}
.nb-bubble:hover{filter:brightness(.98)}`;

// o: { stage: { canvas }, island: scene, state(): { chatOpen, thinking, last, reply, failed, quiet, me, game }, onTap() }
//   game: true while a match runs on the island (the robot perches at the top right of the screen).
//   last: the newest chat message (any kind), to notice a new one. reply: it, if it is the companion's answer { text, expression }. me: { x, y, z, ry, s, cam, to } while you walk the island (cam: the camera's angle, to: island point -> screen pixels).
export function createBot(T, o) {
  let saved = {}; try { saved = (JSON.parse(localStorage.getItem('echoworld-pet')) || {}).state || {}; } catch (e) {}
  const bodyC = /^#[0-9a-f]{6}$/i.test(saved.bodyColor) ? saved.bodyColor : '#f1f5f9', glowC = /^#[0-9a-f]{6}$/i.test(saved.glowColor) ? saved.glowColor : '#5eead4';
  const shade = k => '#' + new T.Color(bodyC).multiplyScalar(k).getHexString();
  const shell = new T.MeshStandardMaterial({ color: bodyC, emissive: bodyC, emissiveIntensity: .18, roughness: .75 });   // soft matte plastic
  const trim = new T.MeshStandardMaterial({ color: shade(.82), roughness: .75 }), lid = new T.MeshStandardMaterial({ color: shade(.86), roughness: .75 });
  const glow = new T.MeshBasicMaterial({ color: glowC, toneMapped: false });   // the face is a screen: unlit
  const visor = new T.MeshStandardMaterial({ color: '#0b1220', roughness: .18 });
  // a box with rounded edges and corners
  const rbox = (w, h, d, r) => {
    const b = Math.min(r, d / 2 - .001, w / 2 - .001, h / 2 - .001), x = w / 2 - b, y = h / 2 - b, c = Math.min(Math.max(.001, r - b * .4), x, y), s = new T.Shape();
    s.moveTo(-x + c, -y); s.lineTo(x - c, -y); s.quadraticCurveTo(x, -y, x, -y + c); s.lineTo(x, y - c); s.quadraticCurveTo(x, y, x - c, y);
    s.lineTo(-x + c, y); s.quadraticCurveTo(-x, y, -x, y - c); s.lineTo(-x, -y + c); s.quadraticCurveTo(-x, -y, -x + c, -y);
    const g = new T.ExtrudeGeometry(s, { depth: Math.max(.0001, d - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 5 });
    g.translate(0, 0, -(d - 2 * b) / 2); return g;
  };
  const put = (par, geo, mat, p, r, s) => { const m = new T.Mesh(geo, mat); if (p) m.position.set(p[0], p[1], p[2]); if (r) m.rotation.set(r[0], r[1], r[2]); if (s) m.scale.set(s[0], s[1], s[2]); m.castShadow = mat !== glow; par.add(m); return m; };
  const grp = (par, p, r, s) => { const g = new T.Group(); if (p) g.position.set(p[0], p[1], p[2]); if (r) g.rotation.set(r[0], r[1], r[2]); if (s) g.scale.set(s[0], s[1], s[2]); par.add(g); return g; };

  /* ---------- the robot ---------- */
  const root = new T.Group(), body = grp(root, null, null, [1.25, 1.25, 1.25]);
  put(body, rbox(.44, .3, .34, .09), shell, [0, -.05, 0]);                        // torso
  put(body, rbox(.36, .12, .28, .05), shell, [0, -.26, 0]);                       // slimmer base
  put(body, rbox(.22, .19, .03, .012), lid, [0, -.06, .162]);                     // battery lid, two clips and a charge light
  [-.045, .045].forEach(x => put(body, new T.BoxGeometry(.035, .012, .012), trim, [x, .04, .178]));
  put(body, new T.PlaneGeometry(.07, .012), glow, [0, -.13, .179]);
  put(body, new T.SphereGeometry(.07, 18, 12), trim, [0, -.37, 0]);                // hover ball
  const arms = {}; [-1, 1].forEach(side => { arms[side] = grp(body, [side * .31, .04, 0]); put(arms[side], rbox(.1, .24, .1, .045), shell, [0, -.13, 0]); });   // floating arms
  const head = grp(body, [0, .38, 0]);
  put(head, rbox(.62, .46, .48, .15), shell); put(head, rbox(.5, .32, .12, .055), visor, [0, -.01, .2]);
  [-1, 1].forEach(side => {   // headphone discs and robotic cat ears with a glowing inside
    const hp = grp(head, [side * .31, -.02, 0], [0, 0, PI / 2]);
    put(hp, new T.CylinderGeometry(.1, .1, .06, 22), trim); put(hp, new T.CylinderGeometry(.05, .05, .01, 18), glow, [0, side * .032, 0]);
  });
  const ears = {}; [-1, 1].forEach(side => {
    const ear = ears[side] = grp(head, [side * .17, .2, -.02], [0, 0, -side * .35]);
    [[shell, null, [1, 1, .55]], [glow, [0, .01, .035], [.55, .6, .3]]].forEach(v => { const g = grp(ear, v[1], null, v[2]); put(g, new T.ConeGeometry(.11, .14, 20), v[0], [0, .07, 0]); put(g, new T.SphereGeometry(.062, 16, 12), v[0], [0, .06, 0]); });
  });
  // the face: every eye and mouth shape is built once and switched on or off
  const heart = new T.Shape(); heart.moveTo(0, -.04); heart.bezierCurveTo(-.07, 0, -.045, .06, 0, .025); heart.bezierCurveTo(.045, .06, .07, 0, 0, -.04);
  const eyesG = grp(head, [0, .03, FACE_Z]), mouthG = grp(head, [0, -.07, FACE_Z]), eye = {};
  [-1, 1].forEach(side => {
    const g = grp(eyesG, [side * .11, 0, 0]), sad = grp(g);
    put(sad, new T.CircleGeometry(.034, 18), glow, [0, -.01, 0], null, [1, 1.2, 1]); put(sad, new T.PlaneGeometry(.08, .014), glow, [0, .055, 0], [0, 0, side * -.4]);
    eye[side] = {
      dot: put(g, new T.CircleGeometry(.042, 18), glow, null, null, [1, 1.3, 1]), arc: put(g, new T.TorusGeometry(.045, .014, 8, 18, PI), glow), big: put(g, new T.CircleGeometry(.06, 22), glow),
      line: put(g, new T.PlaneGeometry(.09, .016), glow), heart: put(g, new T.ShapeGeometry(heart), glow, null, null, [1.1, 1.1, 1.1]), sad, think: put(g, new T.CircleGeometry(.036, 18), glow, [.015, .025, 0], null, [1, 1.3, 1])
    };
  });
  const mouth = {
    ring: put(mouthG, new T.TorusGeometry(.026, .01, 8, 18), glow), frown: put(mouthG, new T.CircleGeometry(.03, 18, 0, PI), glow, [0, -.018, 0]), smile: put(mouthG, new T.CircleGeometry(.034, 18, PI, PI), glow, [0, .012, 0]),
    flat: put(mouthG, new T.PlaneGeometry(.06, .014), glow), small: put(mouthG, new T.PlaneGeometry(.03, .014), glow)
  };
  const EYES = { happy: 'arc', surprised: 'big', sleepy: 'line', love: 'heart', sad: 'sad', thinking: 'think', neutral: 'dot' };
  let face = '';
  function setFace(f) {
    if (f === face) return; face = f;
    [-1, 1].forEach(side => { const kind = f === 'wink' ? (side < 0 ? 'arc' : 'line') : EYES[f] || 'dot'; Object.keys(eye[side]).forEach(k => { eye[side][k].visible = k === kind; }); });
    const m = f === 'surprised' ? 'ring' : f === 'sad' ? 'frown' : f === 'neutral' ? 'flat' : f === 'sleepy' || f === 'thinking' ? 'small' : 'smile';
    Object.keys(mouth).forEach(k => { mouth[k].visible = k === m; }); mouth.small.position.x = f === 'thinking' ? .02 : 0;
  }
  setFace('neutral');
  const sparkGeo = new T.OctahedronGeometry(1, 0), sparks = Array.from({ length: SPARKS }, () => { const m = new T.Mesh(sparkGeo, glow); m.visible = false; return { m, life: 0, x: 0, y: 0, z: 0 }; });
  root.userData.keep = true; sparks.forEach(s => { s.m.userData.keep = true; });   // not island scenery: World games leave them alone (worldgame.js)
  // Home screen: its own layer, drawn in screen pixels (x to the right, y up from the bottom of the window).
  if (!document.getElementById('nb-css')) { const st = document.createElement('style'); st.id = 'nb-css'; st.textContent = CSS; document.head.appendChild(st); }
  const layerEl = document.createElement('canvas'); layerEl.className = 'nb-layer'; layerEl.setAttribute('aria-hidden', 'true'); document.body.appendChild(layerEl);
  const own = new T.Scene(), cam = new T.OrthographicCamera(0, 1, 1, 0, -2000, 2000), paint = new T.WebGLRenderer({ canvas: layerEl, antialias: true, alpha: true });
  own.add(new T.HemisphereLight('#FFF8EE', '#D9CDBB', 1.9)); const key = new T.DirectionalLight('#FFF1DC', 2.3); key.position.set(.5, 1, .9); own.add(key);
  let LW = 0, LH = 0;
  const fit = () => { const w = window.innerWidth, h = window.innerHeight; if (w === LW && h === LH) return; LW = w; LH = h; paint.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); paint.setSize(w, h, false); cam.right = w; cam.top = h; cam.updateProjectionMatrix(); };

  /* ---------- its speech bubble ---------- */
  const bubble = document.createElement('button'); bubble.type = 'button'; bubble.className = 'nb-bubble'; bubble.style.display = 'none'; document.body.appendChild(bubble);
  bubble.onclick = () => { lastActive = clock; o.onTap && o.onTap(); };

  /* ---------- every frame ---------- */
  const target = new T.Vector3(), vel = new T.Vector3();
  let scene = null, flight = 0, clock = 0, lastActive = 0, sleepy = false, blinkAt = 2, twitchAt = 4, sparkClock = 0, nextSpark = 0, stageLast, stageUntil = 0, onStage = null, said = '';
  function frame(t, dt, view) {
    const st = o.state(), home = view === 'home', W = window.innerWidth, H = window.innerHeight; clock = t;
    const corner = view === 'world' && !!st.game, flat = home || corner;   // flat: drawn on its own layer, in window pixels
    // where it sits on the home screen, in window pixels: by your avatar's shoulder, or beside the chat panel while that is open
    const stage = home ? o.stage.canvas.getBoundingClientRect() : null;
    const perch = corner ? [W - 92, 205] : !home || st.quiet ? null : st.chatOpen ? (W >= 620 ? [Math.max(84, W - 384 - 92), 158] : null) : stage.width ? [stage.left + stage.width * .84, stage.top + stage.height * .2] : null;
    const want = flat ? (perch ? own : null) : view === 'world' && st.me ? o.island : null;
    layerEl.style.display = want === own ? 'block' : 'none';
    if (want !== scene) {   // moved between the home screen and the island (or off screen)
      if (scene) { scene.remove(root); sparks.forEach(s => { scene.remove(s.m); s.life = 0; s.m.visible = false; }); }
      scene = want; if (scene) { scene.add(root); sparks.forEach(s => scene.add(s.m)); root.userData.fresh = true; }
    }
    if (!scene) { bubble.style.display = 'none'; return; }
    if (scene === own) fit();
    // a new answer from the companion goes "on stage": the robot performs it for about as long as it takes to read
    if (st.last !== stageLast) { stageLast = st.last; onStage = st.reply; stageUntil = st.reply ? t + Math.min(15, 4 + st.reply.text.length * .06) : 0; }
    if (onStage && t > stageUntil) onStage = null;
    const talking = !!onStage, thinking = !!st.thinking;
    if (talking || thinking || st.chatOpen) lastActive = t;
    sleepy = t - lastActive > SLEEP_AFTER;
    setFace(thinking ? 'thinking' : onStage ? onStage.expression || 'happy' : st.failed && st.chatOpen ? 'sad' : sleepy ? 'sleepy' : 'neutral');

    // who it keeps company: your avatar on the home screen (standing at the middle of its stage) or on the island
    // u: the length of "one metre" where it is now (pixels on the home screen, island units on the island)
    const p = flat ? { x: perch[0], y: H - perch[1], z: 0, h: 0 } : { x: st.me.x, y: st.me.y, z: st.me.z, h: st.me.ry }, u = corner ? Math.max(110, Math.min(150, H * .19)) : home ? Math.max(150, Math.min(210, H * .26)) : st.me.s, size = .5 * u;
    let stiff;
    if (talking) {   // fairy flight: flit around you on a looping path that swells, dips and darts
      flight += dt * (1.1 + .6 * sin(t * .8)); const a = flight, r = (corner ? .2 + .05 * sin(a * 1.7 + 1) : home ? .52 + .1 * sin(a * 1.7 + 1) : 1.1 + .3 * sin(a * 1.7 + 1)) * u;
      if (corner) target.set(p.x - .2 * u + sin(a) * r, p.y + (sin(a * 2.1) * .18 + sin(t * 5.3) * .04) * u, cos(a) * r);   // little loops in its corner
      else if (home) {   // around your avatar's head, or just left of the chat panel; never off the edge of the window
        const cx = st.chatOpen ? p.x - 34 : Math.min(stage.left + stage.width * .5, W - r - 70);
        target.set(Math.max(r + 60, cx) + sin(a) * r + sin(a * 2.3) * .08 * u, p.y + (sin(a * 2.1) * .3 + sin(t * 5.3) * .04) * u, cos(a) * r);
      }
      else target.set(p.x + sin(a) * r + sin(a * 2.3) * .07 * u, p.y + (1.5 + sin(a * 2.1) * .22 + sin(t * 5.3) * .04) * u, p.z + cos(a) * r);
      stiff = 18;
    } else {         // rest beside your shoulder, bobbing gently
      const bob = sin(t * 2) * (sleepy ? .02 : .05) * u;
      // island: beside your character as the camera sees it, a little towards the camera. On the right; on the left while the chat panel covers the right
      const c = flat ? 0 : st.me.cam, side = st.chatOpen ? -.95 : .95;
      if (flat) target.set(p.x, p.y + bob, 0); else target.set(p.x + (cos(c) * side + sin(c) * .25) * u, p.y + 1.4 * u + bob, p.z + (-sin(c) * side + cos(c) * .25) * u);
      flight = Math.atan2(root.position.x - p.x, root.position.z - p.z); stiff = home && st.chatOpen ? 12 : 7;   // take off from where it is
    }
    if (root.userData.fresh) { root.position.copy(target); vel.set(0, 0, 0); root.userData.fresh = false; }
    // a critically damped spring: smooth take-off and a smooth glide home, no snapping
    const damp = 2 * Math.sqrt(stiff); vel.x += ((target.x - root.position.x) * stiff - vel.x * damp) * dt; vel.y += ((target.y - root.position.y) * stiff - vel.y * damp) * dt; vel.z += ((target.z - root.position.z) * stiff - vel.z * damp) * dt;
    root.position.addScaledVector(vel, dt);
    root.scale.setScalar(flat ? size * (1 + root.position.z / (u * 6)) : size);   // home: a little bigger when it swings towards you
    // it mostly looks out at whoever is at the keyboard: straight out of the home screen, towards the camera on the island
    const look = corner ? .55 + sin(t * .7) * .06 : home ? (st.chatOpen ? .38 : -.32) + sin(t * .7) * .06 : st.me.cam + (st.chatOpen ? .3 : -.3) + sin(t * .7) * .08, turn = Math.atan2(sin(look - root.rotation.y), cos(look - root.rotation.y));
    root.rotation.y += turn * Math.min(1, dt * 5);
    const yaw = root.rotation.y, sideways = (vel.x * cos(yaw) - vel.z * sin(yaw)) / u, ahead = (vel.x * sin(yaw) + vel.z * cos(yaw)) / u, k6 = Math.min(1, dt * 6);
    body.rotation.z += (Math.max(-.45, Math.min(.45, -sideways * .18)) + sin(t * 1.3) * .04 - body.rotation.z) * k6;   // bank into the turn
    body.rotation.x += (Math.max(-.3, Math.min(.3, ahead * .12)) - body.rotation.x) * k6;
    head.rotation.z += ((thinking ? .22 : sleepy ? .15 : sin(t * (talking ? 2.2 : .9)) * (talking ? .1 : .06)) - head.rotation.z) * k6;
    head.rotation.x += ((sleepy ? .18 : sin(t * 1.1) * .04) - head.rotation.x) * k6;
    const g = talking ? GESTURES[Math.floor(t / GESTURE_SECONDS + .5) % GESTURES.length] : null, k7 = Math.min(1, dt * 7);
    [-1, 1].forEach(side => { const pose = g ? gesturePose(g, side, t) : [0, side * .12 + sin(t * 2 + side) * .05]; arms[side].rotation.x += (pose[0] - arms[side].rotation.x) * k7; arms[side].rotation.z += (pose[1] - arms[side].rotation.z) * k7; });
    // fairy dust while flying
    sparkClock += dt;
    if (talking && sparkClock > .05) { sparkClock = 0; const s = sparks[nextSpark]; nextSpark = (nextSpark + 1) % SPARKS; s.life = 1; s.x = root.position.x + (Math.random() - .5) * .5 * size; s.y = root.position.y - .9 * size + (Math.random() - .5) * .3 * size; s.z = root.position.z + (Math.random() - .5) * .5 * size; }
    sparks.forEach(s => { s.life = Math.max(0, s.life - dt * 1.3); s.m.visible = s.life > 0; s.m.position.set(s.x, s.y - (1 - s.life) * .5 * size, s.z); s.m.scale.setScalar(.06 * size * s.life); s.m.rotation.y += dt * 6; });
    if (t > blinkAt + .13) blinkAt = t + 2.5 + Math.random() * 3;
    eyesG.scale.y = !sleepy && t > blinkAt ? .1 : 1;                                   // blink
    if (t > twitchAt + .3) twitchAt = t + 3 + Math.random() * 5;
    ears[-1].rotation.z = .35 + (t > twitchAt ? sin((t - twitchAt) * 30) * .15 : 0);   // an ear twitch now and then
    mouthG.scale.y = talking ? .6 + Math.abs(sin(t * 14)) * .9 : 1;                    // the mouth moves while it talks

    // the bubble above its ears: tap it to open the chat (home screen and island)
    if (flat) paint.render(own, cam);
    const text = corner ? (onStage ? onStage.text : '') : st.chatOpen ? '' : thinking ? '…' : onStage ? (onStage.text.length > BUBBLE_CHARS ? onStage.text.slice(0, BUBBLE_CHARS) + '…' : onStage.text) : sleepy ? '💤 Tap to wake me' : '💬 Tap to chat';
    if (!text) { bubble.style.display = 'none'; return; }
    if (text !== said) { said = text; bubble.textContent = text; bubble.setAttribute('aria-label', 'Your companion says: ' + text + '. Open the chat'); }
    const at = flat ? [root.position.x, H - root.position.y - 1.22 * size] : st.me.to ? st.me.to(root.position.x, root.position.y + 1.22 * size, root.position.z) : null;
    if (!at) { bubble.style.display = 'none'; return; }
    bubble.style.display = 'block';
    bubble.style.transform = 'translate(-50%,-100%) translate(' + Math.max(124, Math.min(W - 124, at[0])).toFixed(1) + 'px,' + (at[1] - 8).toFixed(1) + 'px)';
  }
  let quipAt = -99; const lastPick = {};
  // kind: 'crash', 'win', 'takeQueen'… (see QUIPS). ctx: { name: the other player, game }. Small things wait their turn
  // (it never talks over itself); the start and the result always get a line.
  function react(kind, ctx = {}) {
    const key = QUIPS[kind + '_' + ctx.game] ? kind + '_' + ctx.game : kind, L = QUIPS[key]; if (!L) return false;
    if (!/^(start|win|lose|draw)/.test(kind) && clock - quipAt < 2.8) return false;
    let i = Math.floor(Math.random() * L.length); if (L.length > 1 && i === lastPick[key]) i = (i + 1) % L.length; lastPick[key] = i;
    const text = L[i][0].replace(/\{name\}/g, ctx.name || 'they');
    quipAt = clock; lastActive = clock; onStage = { text, expression: L[i][1] }; stageUntil = clock + Math.min(6, 2.6 + text.length * .05);
    return true;
  }
  return {
    frame, setFace, react,
    // make it act out a line as if the companion had just said it (handy for demos: nookBot.perform('Hello!', 'love'))
    perform(text, expression) { onStage = { text: String(text || ''), expression: expression || 'happy' }; stageUntil = clock + Math.min(15, 4 + onStage.text.length * .06); },
    dispose() { if (scene) { scene.remove(root); sparks.forEach(s => scene.remove(s.m)); } bubble.remove(); layerEl.remove(); paint.dispose(); root.traverse(n => { if (n.geometry) n.geometry.dispose(); }); sparkGeo.dispose(); [shell, trim, lid, glow, visor].forEach(m => m.dispose()); }
  };
}
