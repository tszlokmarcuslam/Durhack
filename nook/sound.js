// Nook's sounds and its calm background music.
//  - Sound effects: Kenney "Interface Sounds" (CC0, www.kenney.nl), converted to small mp3s in sounds/.
//  - Music: made right here with Web Audio, an endless calm piece (soft pads, a low bass, a few gentle piano notes)
//    that never plays the same way twice. No music file to download.
// Browsers only allow audio after the first click or key press, so everything starts then.
const FX = { click: .22, open: .35, back: .3, match: .5, ring: .5, left: .4, message: .45, request: .5, friend: .5, nope: .35, join: .45, wave: .4, tick: .35, start: .5, toggle: .35 };
const MUSIC_VOL = .16;
// chords as MIDI notes: calm, warm, jazzy (Cmaj7, Am9, Fmaj7, G6, Em7, Dm9...)
const PROGS = [
  [[48, 55, 59, 64], [45, 52, 59, 60], [41, 48, 52, 57], [43, 50, 55, 59]],
  [[41, 48, 52, 57], [40, 47, 50, 55], [38, 45, 48, 53], [43, 50, 53, 59]],
  [[45, 52, 55, 60], [41, 48, 53, 57], [48, 55, 60, 64], [43, 50, 55, 62]]
];
const SCALE = [60, 62, 64, 67, 69, 72, 74, 76, 79];   // C major pentatonic for the piano
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const pick = a => a[Math.floor(Math.random() * a.length)];

export function createSound(o = {}) {
  let ctx = null, fxBus = null, musicBus = null, verb = null, unlocked = false;
  let sfxOn = o.sfx !== false, musicOn = o.music !== false, ducked = false;
  const bufs = {}, base = o.base || new URL('sounds/', document.baseURI).href;

  function setup() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    fxBus = ctx.createGain(); fxBus.gain.value = 1; fxBus.connect(ctx.destination);
    // music: soft low-pass + a long airy reverb (a noise burst that fades out)
    musicBus = ctx.createGain(); musicBus.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = .3;
    verb = ctx.createConvolver(); const len = ctx.sampleRate * 3.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    verb.buffer = ir; const wet = ctx.createGain(); wet.gain.value = .55;
    musicBus.connect(lp); lp.connect(ctx.destination); lp.connect(verb); verb.connect(wet); wet.connect(ctx.destination);
    Object.keys(FX).forEach(load);
  }
  function load(name) {
    if (bufs[name] !== undefined) return; bufs[name] = null;
    fetch(base + name + '.mp3').then(r => r.arrayBuffer()).then(a => ctx.decodeAudioData(a)).then(b => { bufs[name] = b; }).catch(() => { delete bufs[name]; });
  }
  // the first click or key press unlocks audio
  function unlock() {
    if (unlocked) return; unlocked = true; setup(); if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (musicOn) startMusic();
  }
  const onGesture = () => unlock();
  window.addEventListener('pointerdown', onGesture, { capture: true }); window.addEventListener('keydown', onGesture, { capture: true });

  /* ---------- sound effects ---------- */
  function play(name, opt = {}) {
    if (!sfxOn || !ctx || !unlocked) return;
    const b = bufs[name]; if (!b) { if (bufs[name] === undefined) load(name); return; }
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = b; s.playbackRate.value = opt.rate || 1; g.gain.value = (FX[name] || .4) * (opt.vol == null ? 1 : opt.vol);
    s.connect(g); g.connect(fxBus); s.start(ctx.currentTime + (opt.delay || 0));
  }
  // a phone-like ring while someone is calling (two soft bongs, then a pause)
  let ringT = null;
  function ring(on) {
    if (!on) { clearInterval(ringT); ringT = null; return; }
    if (ringT) return;
    const once = () => { play('ring'); play('ring', { delay: .18, rate: 1.19 }); };
    once(); ringT = setInterval(once, 1600);
  }
  // little made-up jingles for winning and losing a game
  function jingle(kind) {
    if (!sfxOn || !ctx || !unlocked) return;
    const notes = kind === 'win' ? [72, 76, 79, 84] : [67, 64, 60];
    const t0 = ctx.currentTime + .02;
    notes.forEach((m, i) => pluck(hz(m), t0 + i * (kind === 'win' ? .11 : .2), kind === 'win' ? .9 : 1.1, .22, fxBus));
  }

  /* ---------- the music ---------- */
  let nextBar = 0, bar = 0, prog = PROGS[0], sched = null;
  function pad(freq, t, dur, vol) {   // a soft, slowly swelling chord tone
    [0, 4].forEach((cents, k) => {
      const os = ctx.createOscillator(), g = ctx.createGain();
      os.type = k ? 'triangle' : 'sine'; os.frequency.value = freq; os.detune.value = cents * (k ? -1 : 1);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * (k ? .45 : 1), t + dur * .4); g.gain.linearRampToValueAtTime(0, t + dur + 1.5);
      os.connect(g); g.connect(musicBus); os.start(t); os.stop(t + dur + 1.6);
    });
  }
  function pluck(freq, t, len, vol, out) {   // a gentle piano-ish note
    const os = ctx.createOscillator(), os2 = ctx.createOscillator(), g = ctx.createGain();
    os.type = 'triangle'; os.frequency.value = freq; os2.type = 'sine'; os2.frequency.value = freq * 2;
    const g2 = ctx.createGain(); g2.gain.value = .25;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .012); g.gain.exponentialRampToValueAtTime(.0008, t + len);
    os.connect(g); os2.connect(g2); g2.connect(g); g.connect(out || musicBus);
    os.start(t); os2.start(t); os.stop(t + len + .05); os2.stop(t + len + .05);
  }
  function scheduleBar(t) {
    const BAR = 7.2, chord = prog[bar % prog.length];   // slow: about one chord every 7 seconds
    chord.forEach((m, i) => pad(hz(m + 12), t, BAR, i === 0 ? .05 : .035));
    pad(hz(chord[0] - 12), t, BAR, .07);   // low bass under it
    // a few piano notes, at gentle random times, mostly from the pentatonic scale
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const at = t + .6 + Math.random() * (BAR - 1.4), m = Math.random() < .35 ? chord[1 + Math.floor(Math.random() * 3)] + 12 : pick(SCALE);
      pluck(hz(m), at, 2.4 + Math.random() * 1.2, .05 + Math.random() * .03);
    }
    bar++; if (bar % (prog.length * 2) === 0) prog = pick(PROGS);   // a new progression every couple of rounds
    return t + BAR;
  }
  function startMusic() {
    if (!ctx || sched) return;
    nextBar = Math.max(nextBar, ctx.currentTime + .1);
    sched = setInterval(() => { while (nextBar < ctx.currentTime + 4) nextBar = scheduleBar(nextBar); }, 500);
    while (nextBar < ctx.currentTime + 4) nextBar = scheduleBar(nextBar);
    fadeMusic();
  }
  function stopMusic() { clearInterval(sched); sched = null; fadeMusic(); }
  function fadeMusic() {
    if (!ctx) return; const g = musicBus.gain, now = ctx.currentTime, to = musicOn && !ducked && sched ? MUSIC_VOL : 0;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(to, now + (to ? 2.5 : 1.2));
  }

  return {
    play, ring, jingle,
    setSfx(on) { sfxOn = !!on; if (!sfxOn) ring(false); },
    setMusic(on) { musicOn = !!on; if (!ctx) return; if (musicOn && unlocked) startMusic(); else if (!musicOn) { fadeMusic(); setTimeout(() => { if (!musicOn) stopMusic(); }, 1300); } },
    // fade the music out while people talk (calls, voice on the island), back in afterwards
    duck(on) { on = !!on; if (on === ducked) return; ducked = on; fadeMusic(); },
    get sfx() { return sfxOn; }, get music() { return musicOn; },
    // for checking in the browser console: nookSound.info()
    info() { return { audio: ctx ? ctx.state : 'not started (click once)', loaded: Object.keys(bufs).filter(k => bufs[k]), musicPlaying: !!sched, musicVolume: musicBus ? +musicBus.gain.value.toFixed(3) : 0, ducked, sfxOn, musicOn }; },
    dispose() { ring(false); clearInterval(sched); window.removeEventListener('pointerdown', onGesture, { capture: true }); window.removeEventListener('keydown', onGesture, { capture: true }); if (ctx) ctx.close().catch(() => {}); }
  };
}
