// All sound effects are synthesised at start-up (no downloads), then played
// through Web Audio with 3D panning, distance filtering and a small reverb.
import { ASSET_ROOT, MANIFEST } from './assets.js';

const SR = 22050;

// ---------- DSP helpers on Float32Arrays ----------
const rnd = () => Math.random() * 2 - 1;
function buf(sec) { return new Float32Array(Math.ceil(sec * SR)); }
function lp(a, f) { const k = 1 - Math.exp(-2 * Math.PI * f / SR); let y = 0; for (let i = 0; i < a.length; i++) { y += k * (a[i] - y); a[i] = y; } return a; }
function hp(a, f) { const k = Math.exp(-2 * Math.PI * f / SR); let y = 0, px = 0; for (let i = 0; i < a.length; i++) { y = k * (y + a[i] - px); px = a[i]; a[i] = y; } return a; }
function bp(a, f, q) { // RBJ band-pass biquad
  const w = 2 * Math.PI * f / SR, al = Math.sin(w) / (2 * q), c = Math.cos(w);
  const b0 = al, b2 = -al, a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y; out[i] = y;
  }
  return out;
}
function env(a, att, dec, curve = 1) {
  const A = att * SR, n = a.length;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = i < A ? i / A : Math.exp(-(t - att) / dec * curve);
    a[i] *= e;
  }
  return a;
}
function norm(a, peak = 0.9) { let m = 0; for (const v of a) m = Math.max(m, Math.abs(v)); if (m > 0) for (let i = 0; i < a.length; i++) a[i] *= peak / m; return a; }
function mix(...arrs) { const n = Math.max(...arrs.map((x) => x.length)); const o = new Float32Array(n); for (const a of arrs) for (let i = 0; i < a.length; i++) o[i] += a[i]; return o; }
function noise(sec) { const a = buf(sec); for (let i = 0; i < a.length; i++) a[i] = rnd(); return a; }
function sine(sec, f0, f1 = f0, dec = 1e9) { const a = buf(sec); let ph = 0; for (let i = 0; i < a.length; i++) { const t = i / a.length; ph += 2 * Math.PI * (f0 + (f1 - f0) * t) / SR; a[i] = Math.sin(ph) * Math.exp(-i / SR / dec); } return a; }
function saw(sec, f0, f1 = f0, jitter = 0) { const a = buf(sec); let ph = 0; for (let i = 0; i < a.length; i++) { const t = i / a.length; ph += (f0 + (f1 - f0) * t) * (1 + jitter * rnd()) / SR; a[i] = 2 * (ph % 1) - 1; } return a; }
function scale(a, k) { for (let i = 0; i < a.length; i++) a[i] *= k; return a; }

// ---------- sound recipes ----------
const R = {
  gun(kind) {
    const p = { pistol: [0.22, 3200, 0.06, 90, 0.5], rifle: [0.3, 2600, 0.07, 80, 0.7], shotgun: [0.5, 1800, 0.12, 60, 1.0], katta: [0.55, 1500, 0.14, 55, 1.1], revolver: [0.35, 2300, 0.09, 70, 0.8], mg: [0.36, 2100, 0.08, 62, 0.85] }[kind];
    const crack = env(lp(noise(p[0]), p[1]), 0.0008, p[2], 1);
    const thump = env(sine(p[0], p[3] * 1.6, p[3] * 0.6), 0.001, p[2] * 1.5);
    const tail = env(lp(noise(p[4]), 900), 0.01, p[4] * 0.35);
    return norm(mix(crack, scale(thump, 0.9), scale(tail, 0.35)), 0.95);
  },
  click() { return norm(env(hp(noise(0.03), 3000), 0.0005, 0.006)); },
  clank(f = 1) { return norm(env(mix(sine(0.25, 1300 * f), scale(sine(0.25, 2750 * f), 0.6), scale(sine(0.25, 4100 * f), 0.4), scale(hp(noise(0.25), 2000), 0.5)), 0.001, 0.035)); },
  slide() { const n = bp(noise(0.18), 2200, 1.2); return norm(env(n, 0.01, 0.06)); },
  shell() { return norm(env(mix(sine(0.15, 5200), scale(sine(0.15, 7300), 0.5)), 0.0005, 0.03), 0.4); },
  step(kind, v) {
    const len = 0.12 + Math.random() * 0.03;
    let n = noise(len);
    if (kind === 'dirt') n = mix(lp(n, 700), scale(hp(noise(len), 3000), 0.15));
    else if (kind === 'tile') n = mix(bp(n, 1800, 1.5), scale(sine(len, 180, 120, 0.02), 0.5));
    else if (kind === 'wood') n = mix(bp(n, 400, 1.2), scale(sine(len, 140, 100, 0.03), 1.0));
    else if (kind === 'metal') n = mix(bp(n, 2400, 3), scale(sine(len, 900 + v * 50, 880, 0.05), 0.4));
    else n = mix(bp(n, 1000 + v * 80, 0.9), scale(lp(noise(len), 300), 0.6));
    return norm(env(n, 0.004, 0.035), 0.7);
  },
  creak() {
    const a = buf(0.9); let ph = 0;
    for (let i = 0; i < a.length; i++) { const t = i / SR; const f = 90 + 60 * Math.sin(t * 7) + 40 * Math.sin(t * 23); ph += f / SR; a[i] = (ph % 1 < 0.08 ? 1 : 0) * 0.8 + rnd() * 0.05; }
    return norm(env(bp(a, 900, 2), 0.05, 0.4));
  },
  slam() { return norm(mix(env(sine(0.4, 120, 50), 0.001, 0.08), scale(env(lp(noise(0.4), 1200), 0.001, 0.06), 0.7))); },
  bang() { return norm(mix(env(sine(0.5, 90, 40), 0.001, 0.1), scale(env(lp(noise(0.5), 700), 0.001, 0.09), 0.9), scale(env(bp(noise(0.5), 300, 4), 0.001, 0.2), 0.5))); },
  growl(pitch = 1) {
    const len = 1.1 + Math.random() * 0.6;
    const src = mix(saw(len, 75 * pitch, 60 * pitch, 0.25), scale(noise(len), 0.4));
    const f1 = bp(src, 480 * pitch, 4), f2 = bp(src, 1150 * pitch, 6);
    const a = mix(f1, scale(f2, 0.6));
    for (let i = 0; i < a.length; i++) a[i] *= 0.6 + 0.4 * Math.sin(i / SR * (5 + pitch * 4)) ** 2;
    return norm(env(a, 0.12, len * 0.5), 0.85);
  },
  scream() {
    const len = 0.9;
    const src = mix(saw(len, 420, 280, 0.2), scale(noise(len), 0.5));
    return norm(env(mix(bp(src, 900, 3), scale(bp(src, 2400, 4), 0.7)), 0.03, 0.4), 0.85);
  },
  whoosh() { const n = noise(0.3); const o = buf(0.3); let y = 0; for (let i = 0; i < n.length; i++) { const f = 300 + 2500 * (i / n.length); const k = 1 - Math.exp(-2 * Math.PI * f / SR); y += k * (n[i] - y); o[i] = y; } return norm(env(o, 0.08, 0.08)); },
  flesh() { return norm(mix(env(sine(0.25, 110, 60), 0.001, 0.05), scale(env(lp(noise(0.25), 1500), 0.001, 0.04), 0.8))); },
  wall() { return norm(mix(env(hp(noise(0.15), 1500), 0.0005, 0.02), scale(env(lp(noise(0.15), 600), 0.001, 0.04), 0.5))); },
  ricochet() { return norm(env(sine(0.35, 3400, 900), 0.002, 0.12), 0.5); },
  rustle() { return norm(env(bp(noise(0.35), 3000, 0.8), 0.05, 0.12), 0.5); },
  crunch() { const parts = []; for (let k = 0; k < 4; k++) { const a = buf(0.7); const s = env(hp(noise(0.08), 1500), 0.002, 0.02); a.set(s, Math.floor((k * 0.16 + Math.random() * 0.04) * SR)); parts.push(a); } return norm(mix(...parts), 0.6); },
  gulp() { const parts = []; for (let k = 0; k < 3; k++) { const a = buf(0.8); a.set(env(sine(0.12, 300, 150), 0.01, 0.04), Math.floor(k * 0.24 * SR)); parts.push(a); } return norm(mix(...parts), 0.6); },
  heart() { const a = buf(0.9); a.set(env(sine(0.15, 60, 40), 0.005, 0.05), 0); a.set(env(sine(0.15, 55, 38), 0.005, 0.05), Math.floor(0.22 * SR)); return norm(a, 0.8); },
  bark() {
    const a = buf(1.0);
    const n = 2 + (Math.random() * 2 | 0);
    for (let k = 0; k < n; k++) {
      const len = 0.16;
      const src = mix(saw(len, 420, 260, 0.1), scale(noise(len), 0.5));
      const w = env(mix(bp(src, 900, 3), scale(bp(src, 2200, 4), 0.5)), 0.005, 0.05);
      a.set(w.subarray(0, Math.min(w.length, a.length - Math.floor(k * 0.28 * SR))), Math.floor(k * 0.28 * SR));
    }
    return norm(a, 0.8);
  },
  horn() {
    const len = 2.6;
    const s = mix(saw(len, 311), saw(len, 370), saw(len, 466), scale(saw(len, 155), 0.5));
    const o = lp(lp(s, 1600), 2200);
    for (let i = 0; i < o.length; i++) { const t = i / SR; o[i] *= Math.min(1, t / 0.15) * (t > len - 0.4 ? (len - t) / 0.4 : 1); }
    return norm(o, 0.9);
  },
  bell() {
    const len = 3.5, f = 620;
    const parts = [[1, 1, 2.2], [2.0, 0.5, 1.4], [2.76, 0.4, 1.0], [5.4, 0.25, 0.5], [8.9, 0.12, 0.3]];
    const a = mix(...parts.map(([m, g, d]) => scale(sine(len, f * m, f * m, d), g)));
    return norm(env(a, 0.002, 1.5, 0.6), 0.85);
  },
  beep(f = 1000, len = 0.12) { return norm(env(sine(len, f), 0.005, len * 0.6), 0.5); },
  splash() { return norm(mix(env(lp(noise(0.8), 1800), 0.01, 0.25), scale(env(sine(0.4, 400, 120), 0.005, 0.08), 0.4)), 0.7); },
  staticNoise(len = 2) { const a = bp(noise(len), 2500, 0.5); for (let i = 0; i < a.length; i++) if (Math.random() < 0.002) a[i] *= 6; return norm(a, 0.35); },
  // loops
  wind() { const a = lp(noise(8), 380); for (let i = 0; i < a.length; i++) a[i] *= 0.6 + 0.4 * Math.sin(i / SR * 0.7 + Math.sin(i / SR * 0.23) * 2); return norm(a, 0.6); },
  crickets() {
    const len = 6, a = buf(len);
    for (let c = 0; c < 26; c++) {
      const f = 3800 + Math.random() * 1600, start = Math.random() * len, n = 3 + (Math.random() * 4 | 0);
      for (let k = 0; k < n; k++) {
        const s0 = Math.floor((start + k * 0.06) * SR) % a.length;
        for (let i = 0; i < 0.035 * SR; i++) { const j = (s0 + i) % a.length; a[j] += Math.sin(2 * Math.PI * f * i / SR) * Math.sin(Math.PI * i / (0.035 * SR)) * 0.25; }
      }
    }
    return norm(a, 0.4);
  },
  hum() { const a = lp(lp(noise(6), 140), 200); return norm(a, 0.5); },
  drone() { const len = 8; return norm(mix(sine(len, 110), scale(sine(len, 110.4), 0.8), scale(sine(len, 165), 0.5), scale(sine(len, 220.6), 0.3)), 0.45); },
  rumble() { const a = lp(lp(noise(4), 90), 160); for (let i = 0; i < a.length; i++) a[i] *= 0.75 + 0.25 * Math.sin(i / SR * 2 * Math.PI * 3.1) ** 8; return norm(a, 0.8); },
  alarm() { const a = buf(1.2); let ph = 0; for (let i = 0; i < a.length; i++) { const f = (i / SR) % 0.6 < 0.3 ? 880 : 660; ph += f / SR; a[i] = (ph % 1 < 0.5 ? 1 : -1) * 0.3; } return lp(a, 3000); },
  // rocket launcher: a hard pop, then the motor's hiss tearing away
  rocket() {
    const pop = env(mix(sine(0.5, 120, 45), scale(lp(noise(0.5), 900), 0.9)), 0.001, 0.07);
    const n = noise(1.3), hiss = buf(1.3); let y = 0;
    for (let i = 0; i < n.length; i++) { const t = i / n.length; const k = 1 - Math.exp(-2 * Math.PI * (3200 - 2400 * t) / SR); y += k * (n[i] - y); hiss[i] = y * Math.min(1, t * 30) * Math.pow(1 - t, 1.6); }
    return norm(mix(pop, scale(hiss, 0.8)), 0.95);
  },
  // explosion: deep thump, rolling low noise and a crackle of debris
  explosion() {
    const len = 2.6;
    const thump = env(sine(len, 75, 22), 0.002, 0.35);
    const body = env(lp(lp(noise(len), 380), 520), 0.004, 0.55);
    const crack = env(hp(noise(len), 1800), 0.0008, 0.05);
    const debris = buf(len); for (let k = 0; k < 26; k++) { const s = env(hp(noise(0.03), 2500), 0.0005, 0.008); debris.set(s, Math.floor((0.15 + Math.random() * 1.3) * SR)); }
    return norm(mix(scale(thump, 1.2), body, scale(crack, 0.5), scale(env(debris, 0.01, 0.9), 0.25)), 0.98);
  },
  // a lit bomb fuse (sutli): a hard spitting hiss full of tiny crackles; loops cleanly
  fuse() {
    const len = 1.5, a = hp(noise(len), 2600);
    for (let i = 0; i < a.length; i++) a[i] *= 0.55 + 0.45 * Math.abs(Math.sin(i / SR * 2 * Math.PI * 6)) * (0.7 + 0.3 * rnd());
    const cr = buf(len);
    for (let k = 0; k < 90; k++) { const s = env(bp(noise(0.012), 2500 + Math.random() * 4000, 2), 0.0002, 0.003); const at = Math.floor(Math.random() * (len - 0.02) * SR); for (let i = 0; i < s.length; i++) cr[at + i] += s[i] * (0.4 + Math.random()); }
    return norm(mix(scale(a, 0.6), cr), 0.75);
  },
  // looping fire: low roar with random pops and crackles
  fire() {
    const len = 4, a = lp(lp(noise(len), 260), 400);
    for (let i = 0; i < a.length; i++) a[i] *= 0.7 + 0.3 * Math.sin(i / SR * 2 * Math.PI * 0.5) ** 2;
    const cr = buf(len);
    for (let k = 0; k < 120; k++) { const s = env(bp(noise(0.02), 1500 + Math.random() * 3000, 1.5), 0.0003, 0.004 + Math.random() * 0.01); const at = Math.floor(Math.random() * (len - 0.03) * SR); for (let i = 0; i < s.length; i++) cr[at + i] += s[i] * (0.3 + Math.random()); }
    return norm(mix(a, scale(cr, 0.55)), 0.7);
  },
  // jeep engine idle (2 s, every partial a whole number of cycles so it loops cleanly)
  engine() {
    const len = 2, a = buf(len);
    for (let i = 0; i < a.length; i++) {
      const t = i / SR;
      a[i] = Math.sin(2 * Math.PI * 34 * t) * 0.6 + Math.sin(2 * Math.PI * 68 * t) * 0.45 + Math.sin(2 * Math.PI * 102 * t) * 0.25 + Math.sin(2 * Math.PI * 17 * t) * 0.3;
      a[i] *= 0.65 + 0.35 * Math.abs(Math.sin(2 * Math.PI * 8.5 * t));
    }
    return norm(mix(lp(a, 700), scale(lp(noise(len), 500), 0.12)), 0.75);
  },
  // the railway giant's roar: very low, long, rising then breaking up
  roar() {
    const len = 2.8, src = buf(len); let ph = 0;
    for (let i = 0; i < src.length; i++) { const t = i / src.length; const f = 48 + 30 * Math.sin(t * Math.PI) + rnd() * 10; ph += f / SR; src[i] = (2 * (ph % 1) - 1) * 0.8 + rnd() * 0.45; }
    const a = mix(bp(src, 300, 2.5), scale(bp(src, 760, 4), 0.7), scale(lp(src, 160), 0.8));
    for (let i = 0; i < a.length; i++) { const t = i / SR; a[i] *= Math.min(1, t / 0.25) * (t > len - 0.8 ? (len - t) / 0.8 : 1) * (0.75 + 0.25 * Math.sin(t * 31) ** 2); }
    return norm(a, 0.95);
  },
  // the Joker's cackle: a run of "ha"s, each a buzzy glottal pulse through an open "a" vowel,
  // falling in pitch and speeding up, with a long wheeze at the end
  laugh(pitch = 1) {
    const len = 2.4, a = buf(len), n = 8;
    let t0 = 0.05;
    for (let k = 0; k < n; k++) {
      const last = k === n - 1, dur = last ? 0.42 : 0.12 + Math.random() * 0.03;
      const f0 = (k === 0 ? 420 : 360 - k * 16) * pitch;
      const src = mix(saw(dur, f0 * 1.12, f0 * (last ? 0.6 : 0.86), 0.03), scale(noise(dur), last ? 0.7 : 0.3));
      const v = mix(bp(src, 800 * pitch, 5), scale(bp(src, 1250 * pitch, 6), 0.75), scale(bp(src, 2700 * pitch, 7), 0.3));
      env(v, 0.01, dur * (last ? 0.6 : 0.4));
      const at = Math.floor(t0 * SR);
      for (let i = 0; i < v.length && at + i < a.length; i++) a[at + i] += v[i];
      t0 += dur + 0.07 - k * 0.004;
    }
    return norm(a, 0.92);
  },
  // a slightly out-of-tune music box playing a minor waltz (loops: 8 bars of 3/4)
  musicbox() {
    const beat = 0.42, len = beat * 24, a = buf(len);
    const mel = [69, 72, 76, 74, 72, 71, 69, 64, 69, 68, 71, 76, 74, 72, 71, 72, 69, 65, 64, 68, 71, 69, 0, 0];
    const bass = [45, 52, 40, 47, 45, 53, 40, 45];
    const note = (m, t, vol, dec) => {
      const f = 440 * Math.pow(2, (m - 69) / 12) * (1 + (Math.random() - 0.5) * 0.012);
      const n = Math.floor(Math.min(1.6, len - t) * SR), at = Math.floor(t * SR);
      for (let i = 0; i < n; i++) {
        const tt = i / SR, e = Math.exp(-tt / dec) * Math.min(1, tt / 0.003);
        a[(at + i) % a.length] += vol * e * (Math.sin(2 * Math.PI * f * tt) + 0.35 * Math.sin(2 * Math.PI * f * 2.01 * tt) * Math.exp(-tt * 3) + 0.12 * Math.sin(2 * Math.PI * f * 4.2 * tt) * Math.exp(-tt * 9));
      }
    };
    mel.forEach((m, i) => { if (m) note(m, i * beat, 0.5, 0.55); });
    bass.forEach((m, i) => { note(m, i * beat * 3, 0.32, 0.9); note(m + 12, i * beat * 3 + beat, 0.16, 0.4); note(m + 19, i * beat * 3 + beat * 2, 0.16, 0.4); });
    return norm(lp(a, 5000), 0.6);
  },
  // a burst of pressurised gas
  gas() { const n = hp(noise(2.2), 1200); for (let i = 0; i < n.length; i++) { const t = i / SR; n[i] *= Math.min(1, t / 0.03) * Math.exp(-t / 0.9); } return norm(mix(n, scale(env(lp(noise(2.2), 400), 0.01, 0.4), 0.6)), 0.8); },
  // shimmering divine chime: rising glissandi with sparkles
  magic() {
    const len = 4.5, parts = [];
    for (const f of [523, 659, 784, 1047, 1319]) parts.push(scale(env(sine(len, f * 0.5, f * 1.5, 2.2), 0.4, 1.8), 0.25));
    const sp = buf(len); for (let k = 0; k < 70; k++) { const s = env(sine(0.15, 2500 + Math.random() * 3500), 0.002, 0.04); sp.set(s, Math.floor(Math.random() * (len - 0.2) * SR)); }
    return norm(mix(...parts, scale(sp, 0.35)), 0.8);
  },
  // ---- the Joker's five silly sounds (assets/music/joker*.mp3 replace them, see MANIFEST.userAudio) ----
  // a rubber clown horn: two squeezes of a reedy, nasal square wave
  honk() {
    const a = buf(0.75);
    for (const [t0, f] of [[0, 330], [0.34, 300]]) {
      const n = Math.floor(0.3 * SR), at = Math.floor(t0 * SR); let ph = 0;
      for (let i = 0; i < n; i++) { const t = i / SR, ff = f * (1 + 0.04 * Math.sin(t * 40)); ph += ff / SR; a[at + i] += ((ph % 1) < 0.35 ? 1 : -1) * Math.min(1, t / 0.02) * Math.min(1, (0.3 - t) / 0.05); }
    }
    return norm(mix(bp(a, 900, 2.5), scale(bp(a, 2200, 3), 0.5)), 0.8);
  },
  // a kazoo tootling a little "ta-da-da-dum" tune: buzzy saw through a narrow vocal band
  kazoo() {
    const notes = [[67, 0.16], [72, 0.16], [76, 0.16], [74, 0.12], [72, 0.12], [79, 0.5]];
    const len = notes.reduce((s, n) => s + n[1] + 0.03, 0.1), a = buf(len);
    let t0 = 0.02;
    for (const [m, d] of notes) {
      const f = 440 * Math.pow(2, (m - 69) / 12), s = mix(saw(d, f * 0.99, f * 1.01, 0.02), scale(noise(d), 0.15));
      env(s, 0.015, d * 0.9); a.set(s.subarray(0, Math.min(s.length, a.length - Math.floor(t0 * SR))), Math.floor(t0 * SR)); t0 += d + 0.03;
    }
    return norm(mix(bp(a, 1100, 3), scale(bp(a, 2600, 4), 0.6)), 0.75);
  },
  // a slide whistle swooping up and back down
  whistle() {
    const len = 1.1, a = buf(len); let ph = 0;
    for (let i = 0; i < a.length; i++) { const t = i / SR, u = t / len, f = 700 + 1500 * Math.sin(u * Math.PI) ** 1.4; ph += f / SR; a[i] = Math.sin(2 * Math.PI * ph) * Math.min(1, t / 0.04) * Math.min(1, (len - t) / 0.1) * (1 + 0.15 * Math.sin(t * 38)); }
    return norm(mix(a, scale(bp(noise(len), 2000, 2), 0.06)), 0.6);
  },
  // a cartoon spring: a wobbling tone that boings down
  boing() {
    const len = 0.8, a = buf(len); let ph = 0;
    for (let i = 0; i < a.length; i++) { const t = i / SR, f = 160 + 260 * Math.exp(-t * 3) * (1 + 0.5 * Math.sin(t * 60)); ph += f / SR; a[i] = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 3.2) * Math.min(1, t / 0.005); }
    return norm(a, 0.8);
  },
  // a sing-song "nyah-nyah-na-nyah-nyah" taunt in the Joker's nasal voice
  taunt() {
    const notes = [[72, 0.2], [69, 0.2], [74, 0.14], [72, 0.2], [69, 0.36]];
    const len = notes.reduce((s, n) => s + n[1] + 0.05, 0.1), a = buf(len);
    let t0 = 0.02;
    for (const [m, d] of notes) {
      const f = 440 * Math.pow(2, (m - 69) / 12), s = saw(d, f * 1.03, f * 0.97, 0.03);
      const v = mix(bp(s, 650, 4), scale(bp(s, 1700, 5), 0.8), scale(bp(s, 2900, 6), 0.3));
      env(v, 0.02, d * 0.7); a.set(v.subarray(0, Math.min(v.length, a.length - Math.floor(t0 * SR))), Math.floor(t0 * SR)); t0 += d + 0.05;
    }
    return norm(a, 0.85);
  },
  // the acid gun: a wet pressurised spit with a falling gurgle
  acid() { return norm(mix(env(bp(noise(0.5), 1400, 0.9), 0.003, 0.09), scale(env(sine(0.5, 520, 90), 0.002, 0.12), 0.7), scale(env(lp(noise(0.5), 300), 0.002, 0.15), 0.6)), 0.9); },
  // acid eating into flesh or stone
  sizzle() { const n = hp(noise(1.2), 2500); for (let i = 0; i < n.length; i++) { const t = i / SR; n[i] *= Math.min(1, t / 0.02) * Math.exp(-t / 0.45) * (0.6 + 0.4 * Math.random()); } return norm(n, 0.55); },
};

export class Audio {
  constructor() { this.ctx = null; this.b = {}; this.enabled = true; this.loops = {}; this.radios = []; this.tracks = {}; }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.amb = ctx.createGain(); this.amb.gain.value = 0.7;
    this.ambLP = ctx.createBiquadFilter(); this.ambLP.type = 'lowpass'; this.ambLP.frequency.value = 18000;
    this.amb.connect(this.ambLP); this.ambLP.connect(this.master);
    this.music = ctx.createGain(); this.music.connect(this.master);
    // short generated reverb
    this.verb = ctx.createConvolver();
    const ir = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 1.6), ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = rnd() * Math.pow(1 - i / d.length, 3.2) * 0.5; }
    this.verb.buffer = ir;
    this.verbGain = ctx.createGain(); this.verbGain.gain.value = 0.28;
    this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
    this._make();
  }

  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume(); }

  _ab(arr) { const b = this.ctx.createBuffer(1, arr.length, SR); b.getChannelData(0).set(arr); return b; }
  _make() {
    const set = (name, fn, n = 1) => { this.b[name] = []; for (let i = 0; i < n; i++) this.b[name].push(this._ab(fn())); };
    for (const g of ['pistol', 'rifle', 'shotgun', 'katta', 'revolver', 'mg']) set(g, () => R.gun(g), 2);
    set('click', R.click); set('clank', () => R.clank(0.9 + Math.random() * 0.3), 3); set('slide', R.slide); set('shell', R.shell, 2);
    for (const s of ['asphalt', 'dirt', 'tile', 'wood', 'metal']) set('step_' + s, () => R.step(s, Math.random() * 10), 4);
    set('creak', R.creak); set('slam', R.slam); set('bang', R.bang, 2);
    set('growl', () => R.growl(0.8 + Math.random() * 0.5), 5); set('growlBig', () => R.growl(0.55), 2); set('scream', R.scream, 2);
    set('whoosh', R.whoosh); set('flesh', R.flesh, 2); set('wall', R.wall, 2); set('ricochet', R.ricochet);
    set('rustle', R.rustle); set('crunch', R.crunch); set('gulp', R.gulp); set('heart', R.heart); set('bark', R.bark, 3);
    set('horn', R.horn); set('bell', R.bell); set('beep', () => R.beep(1200)); set('beepLow', () => R.beep(500, 0.2)); set('splash', R.splash);
    set('static', () => R.staticNoise(2.5));
    set('wind', R.wind); set('crickets', R.crickets); set('hum', R.hum); set('drone', R.drone); set('rumble', R.rumble); set('alarm', R.alarm);
    set('rocket', R.rocket); set('fuse', R.fuse); set('explosion', R.explosion, 2); set('fire', R.fire); set('engine', R.engine); set('roar', R.roar); set('magic', R.magic);
    set('laugh', () => R.laugh(0.88 + Math.random() * 0.25), 3); set('musicbox', R.musicbox); set('gas', R.gas);
    set('jkHonk', R.honk); set('jkKazoo', R.kazoo); set('jkWhistle', R.whistle); set('jkBoing', R.boing); set('jkTaunt', R.taunt);
    set('acid', R.acid, 2); set('sizzle', R.sizzle);
    this._loadGunSounds();
    this._loadUserAudio();
  }

  // Custom fire sounds: drop assets/sounds/<name>.mp3 (or .wav / .ogg). Missing files keep the generated sound.
  _loadGunSounds() {
    for (const [file, key] of Object.entries(MANIFEST.gunSounds)) {
      (async () => {
        for (const ext of ['.mp3', '.wav', '.ogg']) {
          try {
            const res = await fetch(ASSET_ROOT + 'sounds/' + file + ext);
            if (!res.ok) continue;
            this.b[key] = [await this.ctx.decodeAudioData(await res.arrayBuffer())];
            return;
          } catch (e) { /* not a valid audio file, try the next extension */ }
        }
      })();
    }
  }

  // decodeAudioData: promise form, with the callback form older iPhone Safari needs
  _decode(ab) {
    return new Promise((res, rej) => { const p = this.ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });
  }

  // The user's zombie / Shivji audio (MANIFEST.userAudio). One-shots are decoded into buffers;
  // loops become tracks that fade in and out. Big loops stream from an <audio> element instead
  // of being decoded whole, so phones don't run out of memory. Missing files: nothing happens.
  _loadUserAudio() {
    const BIG = 1.5e6;
    for (const [key, spec] of Object.entries(MANIFEST.userAudio)) {
      (async () => {
        for (const dir of spec.dirs) for (const name of spec.names) for (const ext of MANIFEST.userAudioExts) {
          const url = ASSET_ROOT + dir + encodeURIComponent(name) + ext;
          try {
            const head = await fetch(url, { method: 'HEAD' });
            if (!head.ok) continue;
            const size = +head.headers.get('content-length') || 0;
            if (spec.loop && size > BIG) { this._track(key, null, url); return; }
            const buf = await this._decode(await (await fetch(url)).arrayBuffer());
            if (spec.loop) this._track(key, buf, url); else this.b[key] = [buf];
            return;
          } catch (e) { /* missing or not decodable: try the next name */ }
        }
      })();
    }
  }

  _track(key, buffer, url) {
    const ctx = this.ctx, g = ctx.createGain();
    g.gain.value = 0; g.connect(this.music);
    const t = { g, buffer, el: null, src: null, on: false, vol: 0, stopT: 0 };
    if (!buffer) {
      const el = t.el = new window.Audio();
      el.src = url; el.loop = true; el.preload = 'auto'; el.crossOrigin = 'anonymous'; el.playsInline = true; el.setAttribute('playsinline', '');
      try { ctx.createMediaElementSource(el).connect(g); } catch (e) { return; }
      // iPhone Safari only lets an <audio> element start from a tap: prime it (silently) on the next one
      const unlock = () => {
        for (const ev of ['touchend', 'click', 'keydown']) window.removeEventListener(ev, unlock, true);
        if (t.on) return;
        const p = el.play();
        if (p && p.then) p.then(() => { if (!t.on) el.pause(); }).catch(() => {});
      };
      for (const ev of ['touchend', 'click', 'keydown']) window.addEventListener(ev, unlock, true);
    }
    this.tracks[key] = t;
  }

  hasTrack(key) { return !!this.tracks[key]; }

  // Fade a looping track toward vol over sec seconds. It starts from the top when it was silent
  // and stops once it has faded to 0. Calling it again with the same volume does nothing.
  fade(key, vol, sec = 2) {
    const t = this.tracks[key];
    if (!t || !this.ctx || (vol === t.vol && !(vol <= 0 && sec <= 0 && t.on))) return;
    t.vol = vol;
    const now = this.ctx.currentTime, gp = t.g.gain;
    gp.cancelScheduledValues(now); gp.setValueAtTime(gp.value, now);
    if (sec > 0) gp.linearRampToValueAtTime(vol, now + sec); else gp.setValueAtTime(vol, now);
    clearTimeout(t.stopT);
    if (vol > 0 && !t.on) {
      t.on = true;
      if (t.buffer) { const s = t.src = this.ctx.createBufferSource(); s.buffer = t.buffer; s.loop = true; s.connect(t.g); s.start(); }
      else { try { t.el.currentTime = 0; } catch (e) { /* not loaded yet */ } t.el.play().catch(() => {}); }
    } else if (vol <= 0 && t.on) {
      const stop = () => { if (t.vol > 0) return; t.on = false; if (t.src) { try { t.src.stop(); } catch (e) { /* stopped */ } t.src = null; } if (t.el) t.el.pause(); };
      if (sec > 0) t.stopT = setTimeout(stop, sec * 1000 + 200); else stop();
    }
  }

  // pause menu: <audio> elements keep running while the context is suspended, so hold them too
  pauseTracks() { for (const k in this.tracks) { const t = this.tracks[k]; if (t.on && t.el) t.el.pause(); } if (this.pa) this.pa.el.pause(); }
  resumeTracks() { for (const k in this.tracks) { const t = this.tracks[k]; if (t.on && t.el) t.el.play().catch(() => {}); } if (this.pa) { this.pa.sync(); this.pa.el.play().catch(() => {}); } }

  has(name) { return !!(this.b[name] && this.b[name].length); }

  // Play a one-shot. pos = [x,y,z] for 3D, otherwise 2D.
  play(name, o = {}) {
    if (!this.ctx || !this.b[name]) return null;
    const ctx = this.ctx;
    const list = this.b[name];
    const src = ctx.createBufferSource();
    src.buffer = list[(Math.random() * list.length) | 0];
    src.playbackRate.value = (o.rate || 1) * (1 + (o.vary ?? 0.06) * rnd());
    const g = ctx.createGain(); g.gain.value = o.vol ?? 1;
    src.connect(g);
    let out = g;
    if (o.pos && this.lp) {
      const dx = o.pos[0] - this.lp[0], dy = o.pos[1] - this.lp[1], dz = o.pos[2] - this.lp[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > (o.max || 120)) return null;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.value = Math.max(400, 18000 / (1 + dist / (o.far || 14)) * (this.muffled ? 0.25 : 1));
      const p = ctx.createPanner();
      p.panningModel = 'equalpower'; p.distanceModel = 'inverse';
      p.refDistance = o.ref || 3; p.rolloffFactor = o.roll ?? 1; p.maxDistance = 1000;
      p.positionX.value = o.pos[0]; p.positionY.value = o.pos[1]; p.positionZ.value = o.pos[2];
      out.connect(f); f.connect(p); out = p;
    }
    out.connect(o.bus || this.sfx);
    if (o.verb !== false) { const s = ctx.createGain(); s.gain.value = o.verbAmt ?? 0.5; out.connect(s); s.connect(this.verb); }
    src.start(ctx.currentTime + (o.delay || 0));
    return src;
  }

  loop(name, vol, bus, pos) {
    if (!this.ctx) return null;
    const src = this.ctx.createBufferSource(); src.buffer = this.b[name][0]; src.loop = true;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(g);
    let out = g;
    if (pos) {
      const p = this.ctx.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = pos.ref || 4; p.rolloffFactor = 1.3;
      p.positionX.value = pos[0]; p.positionY.value = pos[1]; p.positionZ.value = pos[2];
      g.connect(p); out = p; src.panner = p;
    }
    out.connect(bus || this.amb);
    src.start(); src.gain = g;
    return src;
  }

  startAmbience(templePos) {
    if (!this.ctx || this.loops.wind) return;
    this.loops.wind = this.loop('wind', 0.25);
    this.loops.crickets = this.loop('crickets', 0.22);
    this.loops.hum = this.loop('hum', 0.12);
    if (templePos) this.loops.drone = this.loop('drone', 0.35, this.sfx, Object.assign([...templePos], { ref: 5 }));
  }

  setListener(cam, inside) {
    if (!this.ctx) return;
    const L = this.ctx.listener, p = cam.position;
    this.lp = [p.x, p.y, p.z];
    const t = this.ctx.currentTime;
    const fw = cam.getWorldDirection(this._v || (this._v = cam.position.clone()));
    if (L.positionX) {
      L.positionX.setTargetAtTime(p.x, t, 0.02); L.positionY.setTargetAtTime(p.y, t, 0.02); L.positionZ.setTargetAtTime(p.z, t, 0.02);
      L.forwardX.setTargetAtTime(fw.x, t, 0.02); L.forwardY.setTargetAtTime(fw.y, t, 0.02); L.forwardZ.setTargetAtTime(fw.z, t, 0.02);
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else { L.setPosition(p.x, p.y, p.z); L.setOrientation(fw.x, fw.y, fw.z, 0, 1, 0); }
    // temple loudspeakers: each horn's sound arrives late by its distance (so the far ones echo the near
    // one, as in a real lane) and fades out entirely across town
    if (this.pa) for (const h of this.pa.horns) {
      const d = Math.hypot(h.pos[0] - p.x, h.pos[1] - p.y, h.pos[2] - p.z);
      h.d.delayTime.setTargetAtTime(Math.min(1.4, d / 343), t, 0.3);
      h.g.gain.setTargetAtTime(Math.max(0, Math.min(1, (230 - d) / 90)), t, 0.5);
    }
    if (inside !== this.muffled) {
      this.muffled = inside;
      this.ambLP.frequency.setTargetAtTime(inside ? 700 : 18000, t, 0.3);
      this.amb.gain.setTargetAtTime(inside ? 0.45 : 0.7, t, 0.3);
    }
  }

  // ---------- radios that play the user's songs ----------
  makeRadio(pos, songIndex) {
    if (!this.ctx) return null;
    const ctx = this.ctx;
    const p = ctx.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 2.2; p.rolloffFactor = 1.6;
    p.positionX.value = pos[0]; p.positionY.value = pos[1]; p.positionZ.value = pos[2];
    const g = ctx.createGain(); g.gain.value = 0;
    // a cheap transistor-radio colour: band-limited
    const hpF = ctx.createBiquadFilter(); hpF.type = 'highpass'; hpF.frequency.value = 180;
    const lpF = ctx.createBiquadFilter(); lpF.type = 'lowpass'; lpF.frequency.value = 5500;
    g.connect(hpF); hpF.connect(lpF); lpF.connect(p); p.connect(this.music);
    const r = { pos, g, el: null, playing: false, failed: false, staticSrc: null, on: true, song: songIndex };
    r.start = () => {
      if (r.playing || !r.on) return;
      r.playing = true;
      g.gain.setTargetAtTime(0.9, ctx.currentTime, 0.4);
      if (songIndex == null) { r.staticSrc = this.loop('static', 0.6, g); return; }
      if (!r.el && !r.failed) {
        const el = new window.Audio();
        el.src = ASSET_ROOT + MANIFEST.songs[songIndex];
        el.loop = true; el.preload = 'auto'; el.crossOrigin = 'anonymous';
        el.addEventListener('error', () => { r.failed = true; if (r.playing && !r.staticSrc) r.staticSrc = this.loop('static', 0.5, g); });
        try { ctx.createMediaElementSource(el).connect(g); } catch (e) { r.failed = true; }
        r.el = el;
      }
      if (r.failed) { if (!r.staticSrc) r.staticSrc = this.loop('static', 0.5, g); return; }
      r.el.play().catch(() => {});
    };
    r.stop = () => {
      if (!r.playing) return;
      r.playing = false;
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
      setTimeout(() => { if (!r.playing) { if (r.el) r.el.pause(); if (r.staticSrc) { r.staticSrc.stop(); r.staticSrc = null; } } }, 1600);
    };
    this.radios.push(r);
    return r;
  }

  // ---------- the Kamakhya Mandir's loudspeakers ----------
  // One <audio> through one "amplifier" feeds all four horns, so they always play the same moment of the
  // song. The song runs on the wall clock, never from the top: arrive (or start a new run) and it is
  // wherever it would be had the samiti switched it on long ago, looping all night.
  startTemplePA(speakers) {
    if (!this.ctx || this.pa || !speakers || !speakers.length) return;
    const ctx = this.ctx;
    const el = new window.Audio();
    el.src = ASSET_ROOT + MANIFEST.templeSong;
    el.loop = true; el.preload = 'auto'; el.crossOrigin = 'anonymous';
    let src;
    try { src = ctx.createMediaElementSource(el); } catch (e) { return; }
    // the amplifier + horn colour: no bass, a honky presence bump, a touch of overdrive
    const hpF = ctx.createBiquadFilter(); hpF.type = 'highpass'; hpF.frequency.value = 300;
    const bump = ctx.createBiquadFilter(); bump.type = 'peaking'; bump.frequency.value = 2200; bump.Q.value = 0.9; bump.gain.value = 6;
    const lpF = ctx.createBiquadFilter(); lpF.type = 'lowpass'; lpF.frequency.value = 5200;
    const drive = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) { const x = (i / (curve.length - 1)) * 2 - 1; curve[i] = Math.tanh(2.2 * x) / Math.tanh(2.2); }
    drive.curve = curve;
    const amp = ctx.createGain(); amp.gain.value = 0.85;
    src.connect(hpF); hpF.connect(bump); bump.connect(drive); drive.connect(lpF); lpF.connect(amp);
    const horns = speakers.map((s) => {
      const d = ctx.createDelay(1.5);
      const g = ctx.createGain(); g.gain.value = 0;
      const p = ctx.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse';
      p.refDistance = 7; p.rolloffFactor = 1.1; p.maxDistance = 10000;
      p.coneInnerAngle = 80; p.coneOuterAngle = 230; p.coneOuterGain = 0.35;    // horns throw forward
      if (p.positionX) {
        p.positionX.value = s.p[0]; p.positionY.value = s.p[1]; p.positionZ.value = s.p[2];
        p.orientationX.value = s.dir[0]; p.orientationY.value = -0.2; p.orientationZ.value = s.dir[1];
      } else { p.setPosition(...s.p); p.setOrientation(s.dir[0], -0.2, s.dir[1]); }
      amp.connect(d); d.connect(g); g.connect(p); p.connect(this.amb);   // amb bus: muffled indoors like the rest of the street
      return { pos: s.p, d, g };
    });
    const sync = () => { if (el.duration > 0 && isFinite(el.duration)) { try { el.currentTime = (Date.now() / 1000) % el.duration; } catch (e) { /* not seekable yet */ } } };
    el.addEventListener('loadedmetadata', sync, { once: true });
    el.addEventListener('error', () => { if (this.pa && this.pa.el === el) this.stopTemplePA(); });
    el.play().catch(() => {});
    this.pa = { el, src, amp, horns, sync };
  }

  stopTemplePA() {
    if (!this.pa) return;
    const { el, src, amp } = this.pa;
    this.pa = null;
    el.pause();
    try { src.disconnect(); amp.disconnect(); } catch (e) { /* already disconnected */ }
  }

  stopAll() {
    this.stopTemplePA();
    for (const k in this.tracks) this.fade(k, 0, 0);
    for (const r of this.radios) r.stop();
    for (const k in this.loops) { try { this.loops[k].stop(); } catch (e) { /* already stopped */ } }
    this.loops = {};
    this.radios = [];
  }
}
