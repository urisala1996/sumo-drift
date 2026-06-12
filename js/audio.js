// ============================================================
//  Sound effects — Web Audio API, fully synthesized (no assets)
// ============================================================
// All sounds are generated at runtime, so there are no audio files to load and
// nothing to host. The AudioContext is created lazily and resumed on the first
// user gesture (browsers block audio before that). Every public function is a
// no-op when muted or if the context can't be created, so audio can never throw
// into the game loop.
//
// Mute state persists in localStorage. The host/local device plays sounds at the
// physics event sites; online clients re-derive them from net state (see rounds.js
// applyNetState/applyMeta and the proximity detector in main.js) since they don't
// run physics.

const KEY = "driftsumo_muted";
let ctx = null, master = null, noiseBuf = null;
let muted = localStorage.getItem(KEY) === "1";

function ensure() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);
  } catch (e) { ctx = null; }
  return ctx;
}

// Resume the context on the first interaction (autoplay policy).
function unlock() { if (ensure() && ctx.state === "suspended") ctx.resume(); }
["pointerdown", "keydown", "touchstart"].forEach(ev =>
  addEventListener(ev, unlock, { passive: true })
);

export function isMuted() { return muted; }
export function setMuted(v) {
  muted = !!v;
  try { localStorage.setItem(KEY, muted ? "1" : "0"); } catch (e) {}
  if (master) master.gain.value = muted ? 0 : 0.9;
}
export function toggleMuted() { setMuted(!muted); return muted; }

// One reusable white-noise buffer for crunch/whoosh textures.
function noiseSource() {
  if (!ctx) return null;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  return s;
}

// Attack/decay envelope on a gain node (exponential, so values stay > 0).
function env(g, t0, atk, peak, dec) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + atk + dec);
}

// Impact: low body sweep + a short noise crunch. strength 0..1 scales loudness.
export function thud(strength = 0.6) {
  if (!ensure() || muted) return;
  const t = ctx.currentTime, s = Math.max(0.15, Math.min(1, strength));
  const o = ctx.createOscillator(); o.type = "sine";
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
  const g = ctx.createGain(); env(g, t, 0.005, 0.5 * s, 0.13);
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.2);
  const n = noiseSource();
  if (n) {
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900;
    const ng = ctx.createGain(); env(ng, t, 0.004, 0.25 * s, 0.07);
    n.connect(f).connect(ng).connect(master); n.start(t); n.stop(t + 0.1);
  }
}

// Fall: descending band-passed noise sweep.
export function whoosh() {
  if (!ensure() || muted) return;
  const t = ctx.currentTime, n = noiseSource(); if (!n) return;
  const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.2;
  f.frequency.setValueAtTime(1200, t);
  f.frequency.exponentialRampToValueAtTime(170, t + 0.5);
  const g = ctx.createGain(); env(g, t, 0.05, 0.4, 0.5);
  n.connect(f).connect(g).connect(master); n.start(t); n.stop(t + 0.6);
}

// Ramp launch: quick upward chirp.
export function jump() {
  if (!ensure() || muted) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = "square";
  o.frequency.setValueAtTime(280, t);
  o.frequency.exponentialRampToValueAtTime(720, t + 0.14);
  const g = ctx.createGain(); env(g, t, 0.005, 0.18, 0.14);
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.2);
}

// Countdown tick (go=true → the higher, longer "GO!" tone).
export function beep(go = false) {
  if (!ensure() || muted) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = "triangle";
  o.frequency.value = go ? 880 : 440;
  const g = ctx.createGain(); env(g, t, 0.005, 0.25, go ? 0.3 : 0.12);
  o.connect(g).connect(master); o.start(t); o.stop(t + (go ? 0.35 : 0.15));
}

// Round won: bright single rising note.
export function point() {
  if (!ensure() || muted) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = "triangle";
  o.frequency.setValueAtTime(660, t);
  o.frequency.exponentialRampToValueAtTime(990, t + 0.12);
  const g = ctx.createGain(); env(g, t, 0.005, 0.22, 0.2);
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.27);
}

// Match won: short ascending arpeggio.
export function win() {
  if (!ensure() || muted) return;
  const t = ctx.currentTime;
  [523, 659, 784, 1047].forEach((hz, i) => {
    const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = hz;
    const g = ctx.createGain(); env(g, t + i * 0.09, 0.005, 0.22, 0.18);
    o.connect(g).connect(master); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.25);
  });
}

// Match lost / draw: two descending low notes.
export function lose() {
  if (!ensure() || muted) return;
  const t = ctx.currentTime;
  [392, 294].forEach((hz, i) => {
    const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = hz;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1100;
    const g = ctx.createGain(); env(g, t + i * 0.14, 0.005, 0.16, 0.22);
    o.connect(lp).connect(g).connect(master); o.start(t + i * 0.14); o.stop(t + i * 0.14 + 0.3);
  });
}
