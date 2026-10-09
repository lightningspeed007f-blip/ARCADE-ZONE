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
    const p = { pistol: [0.22, 3200, 0.06, 90, 0.5], rifle: [0.3, 2600, 0.07, 80, 0.7], shotgun: [0.5, 1800, 0.12, 60, 1.0], katta: [0.55, 1500, 0.14, 55, 1.1], revolver: [0.35, 2300, 0.09, 70, 0.8] }[kind];
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
};

export class Audio {
  constructor() { this.ctx = null; this.b = {}; this.enabled = true; this.loops = {}; this.radios = []; }

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
    for (const g of ['pistol', 'rifle', 'shotgun', 'katta', 'revolver']) set(g, () => R.gun(g), 2);
    set('click', R.click); set('clank', () => R.clank(0.9 + Math.random() * 0.3), 3); set('slide', R.slide); set('shell', R.shell, 2);
    for (const s of ['asphalt', 'dirt', 'tile', 'wood', 'metal']) set('step_' + s, () => R.step(s, Math.random() * 10), 4);
    set('creak', R.creak); set('slam', R.slam); set('bang', R.bang, 2);
    set('growl', () => R.growl(0.8 + Math.random() * 0.5), 5); set('growlBig', () => R.growl(0.55), 2); set('scream', R.scream, 2);
    set('whoosh', R.whoosh); set('flesh', R.flesh, 2); set('wall', R.wall, 2); set('ricochet', R.ricochet);
    set('rustle', R.rustle); set('crunch', R.crunch); set('gulp', R.gulp); set('heart', R.heart); set('bark', R.bark, 3);
    set('horn', R.horn); set('bell', R.bell); set('beep', () => R.beep(1200)); set('beepLow', () => R.beep(500, 0.2)); set('splash', R.splash);
    set('static', () => R.staticNoise(2.5));
    set('wind', R.wind); set('crickets', R.crickets); set('hum', R.hum); set('drone', R.drone); set('rumble', R.rumble); set('alarm', R.alarm);
    this._loadGunSounds();
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

  stopAll() {
    for (const r of this.radios) r.stop();
    for (const k in this.loops) { try { this.loops[k].stop(); } catch (e) { /* already stopped */ } }
    this.loops = {};
    this.radios = [];
  }
}
