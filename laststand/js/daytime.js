// Time of day over Jais: night -> morning -> day -> evening -> night, round and round.
//
// A run starts at night. The clock only runs while you play. The town's sky, fog, fill light,
// sun/moon, stars and street lamps all follow it. The valleys, the outlands, the Joker's Playground
// and the Worm Desert keep their own night look (they set their own fog and sky), so out there
// the lights stay at night values and the town picks the clock up again when you come back.
import * as THREE from 'three';

// seconds each part of the day lasts (one full day = 12 minutes)
export const DAY = { night: 300, morning: 150, day: 120, evening: 150 };
const TOTAL = DAY.night + DAY.morning + DAY.day + DAY.evening;

export const PHASES = {
  night:   { hi: 'रात', en: 'Night', icon: '🌙' },
  morning: { hi: 'सुबह', en: 'Morning', icon: '🌅' },
  day:     { hi: 'दिन', en: 'Day', icon: '☀️' },
  evening: { hi: 'शाम', en: 'Evening', icon: '🌇' },
};

// Looks along the day. u = position in the cycle (0..1). Colours as hex (sRGB).
//   top/hor/glow: sky dome   cloudLo/cloudHi: cloud colour low/high   fog/fogD: town fog
//   hemi/ground/hemiI: fill light   sun/sunI: key light (the moon at night)
//   stars: star opacity   lamps: street lamps 0..1   disc/discS: the moon/sun sprite colour and size
//   exp: renderer exposure
const N0 = DAY.night / TOTAL, M0 = N0, D0 = (DAY.night + DAY.morning) / TOTAL, E0 = (DAY.night + DAY.morning + DAY.day) / TOTAL;
const NIGHT = { top: 0x000001, hor: 0x030408, glow: 0x0b0604, cloudLo: 0x241d1a, cloudHi: 0x13161c, fog: 0x0d1520, fogD: 0.0165,
  hemi: 0x5d6f9c, ground: 0x342b20, hemiI: 0.92, sun: 0xb0c2ff, sunI: 0.95, stars: 0.8, lamps: 1, disc: 0xdfe8ff, discS: 16, exp: 1.15 };
const KEYS = [
  [0, NIGHT],
  [N0 - 0.035, NIGHT],
  // first light: the sky greys, a pink-orange band on the horizon, the lamps still on
  [N0, { top: 0x1c2a48, hor: 0x8a5a58, glow: 0xd06a3a, cloudLo: 0x8a5a50, cloudHi: 0x3a3a4a, fog: 0x4a4048, fogD: 0.0165,
    hemi: 0x7a7a9a, ground: 0x3a3028, hemiI: 1.0, sun: 0xff9a5a, sunI: 0.7, stars: 0.25, lamps: 0.8, disc: 0xffa060, discS: 22, exp: 1.15 }],
  // morning: soft gold, a little mist
  [M0 + (D0 - M0) * 0.5, { top: 0x4a78b8, hor: 0xd8b898, glow: 0xe09050, cloudLo: 0xe8c8b0, cloudHi: 0xc0c8d8, fog: 0xa8a8a8, fogD: 0.0155,
    hemi: 0xb0bcd8, ground: 0x6a5a40, hemiI: 1.35, sun: 0xffd8a8, sunI: 1.7, stars: 0, lamps: 0, disc: 0xfff0d0, discS: 18, exp: 1.1 }],
  // day: clear and bright
  [D0 + (E0 - D0) * 0.5, { top: 0x3a70c0, hor: 0xb8d0e8, glow: 0x9aa8b8, cloudLo: 0xf0f0f0, cloudHi: 0xe4e8f0, fog: 0xb4c2d0, fogD: 0.012,
    hemi: 0xc0d0ec, ground: 0x7a6a50, hemiI: 1.5, sun: 0xfff4e0, sunI: 2.1, stars: 0, lamps: 0, disc: 0xfffaf0, discS: 14, exp: 1.05 }],
  // evening: warm orange, long low light; the lamps come on
  [E0 + (1 - E0) * 0.45, { top: 0x3a4a80, hor: 0xe8905a, glow: 0xf07030, cloudLo: 0xf0a070, cloudHi: 0x9a7a90, fog: 0x9a7060, fogD: 0.0145,
    hemi: 0xb09a9a, ground: 0x5a4030, hemiI: 1.2, sun: 0xffa050, sunI: 1.5, stars: 0.05, lamps: 0.4, disc: 0xff9040, discS: 24, exp: 1.12 }],
  // dusk: purple and fading
  [E0 + (1 - E0) * 0.8, { top: 0x141a38, hor: 0x5a3a50, glow: 0x9a4a3a, cloudLo: 0x5a3a40, cloudHi: 0x2a2a3a, fog: 0x2a2230, fogD: 0.016,
    hemi: 0x6a6a90, ground: 0x342b20, hemiI: 0.98, sun: 0xc0a0d0, sunI: 0.8, stars: 0.5, lamps: 1, disc: 0xdfe8ff, discS: 16, exp: 1.15 }],
  [1, NIGHT],
];
const NUMS = ['fogD', 'hemiI', 'sunI', 'stars', 'lamps', 'discS', 'exp'];
const COLS = ['top', 'hor', 'glow', 'cloudLo', 'cloudHi', 'fog', 'hemi', 'ground', 'sun', 'disc'];
// The sky shader writes its colours straight to the screen, so these are kept as they are shown
// (no sRGB -> linear step). The night values are the town's old sky, written that way.
const SKY = new Set(['top', 'hor', 'glow', 'cloudLo', 'cloudHi']);
const smooth = (k) => k * k * (3 - 2 * k);
const SUNUP = N0 - 0.0175, SUNDOWN = E0 + (1 - E0) * 0.8;

export class DayCycle {
  constructor(g) {
    this.g = g;
    this.t = 0;
    this.phase = 'night';
    this.cur = {};
    for (const k of COLS) this.cur[k] = new THREE.Color();
    this._a = new THREE.Color(); this._b = new THREE.Color(); this._v = new THREE.Vector3();
    this.sample(0);
  }

  reset() { this.t = 0; this.phase = 'night'; this.sample(0); }

  get u() { return (this.t % TOTAL) / TOTAL; }

  phaseAt(sec) {
    const s = sec % TOTAL;
    if (s < DAY.night) return 'night';
    if (s < DAY.night + DAY.morning) return 'morning';
    if (s < DAY.night + DAY.morning + DAY.day) return 'day';
    return 'evening';
  }

  // seconds until the next part of the day starts
  untilNext() {
    const s = this.t % TOTAL, ends = [DAY.night, DAY.night + DAY.morning, DAY.night + DAY.morning + DAY.day, TOTAL];
    for (const e of ends) if (s < e) return e - s;
    return 0;
  }

  // fill this.cur with the look at cycle position u
  sample(u) {
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1][0] <= u) i++;
    const [u0, a] = KEYS[i], [u1, b] = KEYS[i + 1];
    const k = smooth(u1 > u0 ? Math.min(1, Math.max(0, (u - u0) / (u1 - u0))) : 0);
    for (const n of NUMS) this.cur[n] = a[n] + (b[n] - a[n]) * k;
    for (const c of COLS) { const cs = SKY.has(c) ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace; this.cur[c].copy(this._a.setHex(a[c], cs)).lerp(this._b.setHex(b[c], cs), k); }
    // The sun is up between SUNUP and SUNDOWN: it rises in the east and arcs over to set in the west.
    // The rest of the time the moon hangs where it always did. The disc fades out and back in as one
    // gives way to the other, so it never jumps across the sky.
    const day = u > SUNUP && u < SUNDOWN, p = day ? (u - SUNUP) / (SUNDOWN - SUNUP) : 0;
    this.cur.night = !day;
    this.cur.az = Math.PI * (1 - p);
    this.cur.el = -6 + 70 * Math.sin(Math.PI * p);
    this.cur.discA = Math.min(1, Math.abs(u - SUNUP) / 0.012, Math.abs(u - SUNDOWN) / 0.012);
  }

  update(dt) {
    const g = this.g;
    this._dt = dt;
    if (g.state === 'play') this.t += dt;
    const ph = this.phaseAt(this.t);
    if (ph !== this.phase) {
      this.phase = ph;
      const P = PHASES[ph];
      if (g.state === 'play' && !g.inValley()) g.toast(`${P.icon} ${P.hi}`, `${P.en} is here.`);
    }
    this.sample(this.u);
  }

  // What the town looks like now; outside town (valleys, outlands, arenas), null.
  look() { return this.g.inValley() ? null : this.cur; }
  // The look the lights should use: the town's now, plain night anywhere else.
  lights() { return this.look() || this.night || (this.night = this._nightLook()); }

  // Apply sky, fog, sun/moon, stars and lamps. Called from Game.render every frame.
  apply(cam) {
    const g = this.g, c = this.look(), L = this.lights();
    const su = g.sky.material.uniforms;
    if (c) {
      g.scene.fog.color.copy(c.fog); g.scene.fog.density = c.fogD;
      su.hor.value.copy(c.hor);
    }
    su.top.value.copy(L.top); su.glow.value.copy(L.glow);
    if (su.cloudLo) { su.cloudLo.value.copy(L.cloudLo); su.cloudHi.value.copy(L.cloudHi); }
    g.stars.material.opacity = L.stars;
    g.stars.visible = L.stars > 0.01;
    g.renderer.toneMappingExposure = L.exp;
    // moon at night (where it always was), the sun by day
    const D = this._v;
    if (L.night) D.set(-60, 75, -90).normalize();
    else { const el = L.el * Math.PI / 180; D.set(Math.cos(L.az) * Math.cos(el), Math.sin(el), Math.sin(L.az) * Math.cos(el) - 0.35).normalize(); }
    g.moon.position.copy(cam.position).addScaledVector(D, 125);
    g.moon.material.color.copy(L.disc).multiplyScalar(L.discA); g.moon.scale.setScalar(L.discS);
    // the light turns smoothly toward the disc (no jump in the shading when the moon hands over to the sun)
    if (!this._ld) this._ld = D.clone();
    else this._ld.lerp(D, Math.min(1, (this._dt || 0.016) * 0.8)).normalize();
    g.moonLight.position.copy(this._ld).multiplyScalar(140);
    g.moonLight.color.copy(L.sun);
    // street lamps fade out by day (their glow sprites, light pools and light cones too)
    const lamp = L.lamps;
    if (g.lightPool) g.lightPool.streetK = lamp;
    const m = g.mats;
    if (m.glowPoints) m.glowPoints.opacity = lamp;
    if (m.pool) m.pool.opacity = 0.32 * lamp;
    const cones = g.props && g.props.cones;
    if (cones) { cones.material.uniforms.k.value = 0.4 * lamp; cones.visible = lamp > 0.02; }
  }

  _nightLook() {
    const n = {};
    for (const k of NUMS) n[k] = NIGHT[k];
    for (const k of COLS) n[k] = new THREE.Color().setHex(NIGHT[k], SKY.has(k) ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace);
    n.az = 0; n.el = 50; n.night = true; n.discA = 1;
    return n;
  }

  label() { const P = PHASES[this.phase]; return `${P.icon} ${P.hi} · ${P.en}`; }
}
