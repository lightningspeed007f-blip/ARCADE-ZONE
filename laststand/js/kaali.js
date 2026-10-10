// The hidden Kalidham: a second trapdoor in the Maa Kamakhya Mandir courtyard (east side, beside
// the peepal chabutra) leads down a torch-lit brick tunnel into a roofless valley under the night
// sky. Built exactly like the Shivdham (secret.js), which stays untouched:
//
//   * the tunnel exists twice — under the temple (A) and at the valley (B) — and the player is
//     moved between the two copies at a blind corner, so the walk feels continuous;
//   * the valley is far from the town (north, ~900 m past the railway) and from the Shivdham,
//     so neither is ever in view from the other;
//   * the user's four images, in the order they asked for, as you walk out of the tunnel:
//       1. maakaali1 — a colossus on the left of the path,
//       2. maakaali3 — a colossus in the centre, by the ghat,
//       3. maakaali2 — the great colossus on the island, behind the lake, in the golden glow,
//       4. maakaali4 — high in the night sky above the valley, see-through, with a faint glow.
//   * music/maakaalisong swells in once you are round the blind corner; footsteps are silent
//     while it plays.
import * as THREE from 'three';
import { rgb, clamp } from './util.js';
import { ASSET_ROOT } from './assets.js';
import { coreTexture, raysTexture, columnTexture, bandTexture, blurF, statueCanvases, reliefGeometry } from './secret.js';

// ---------- fixed geometry (the Shivdham tunnel mirrored east, a few metres south) ----------
const STEPS = 24, RUN = 0.3, RISE = 0.25, CH = 3.2;
const FLOOR_A = -STEPS * RISE;                                    // -6
const SX = -118.4, TOPZ = 29.3;                                   // stairs: east side of the courtyard
const BOTTOMZ = TOPZ - RUN * STEPS;                               // 22.1
const O = { x: 0, y: -FLOOR_A, z: -1100 };                        // A -> B offset (B floor at y = 0)
const C1 = { x0: -119.5, x1: -117.3, z0: 13.1, z1: 22.1 };        // north corridor
const C2 = { x0: -117.3, x1: -108.2, z0: 13.1, z1: 15.3 };        // east corridor (the blind corner)
const C3 = { x0: -110.4, x1: -108.2 };                            // last corridor, toward the valley
const C3Z0_A = 10.1, C3Z0_B = 2.7;                                // dead end (A) / tunnel mouth (B)
const TRIG_A = -112.9, TRIG_B = -113.9;                           // hysteresis on x inside C2
export const KX0 = (C3.x0 + C3.x1) / 2 + O.x;                     // valley centre line (-109.3)
const ZM = C3Z0_B + O.z;                                          // the tunnel mouth (-1097.3)
const Z = (v) => ZM + 0.6 + v;                                    // Shivdham valley numbers -> here
const LAKE = { z0: Z(-108), z1: Z(-152), y: -0.65 };
const BRICK = [0.62, 0.5, 0.44], STONE = [0.55, 0.52, 0.5], ROCK = [0.46, 0.42, 0.44];

// The three standing images: [file, x offset, z, height, glow colour]. Heights are of the same
// order as the Shivdham colossus (260 m): from the path you have to look up to see their faces.
const FIGS = {
  k1: { x: KX0 - 66, z: Z(-66), h: 150, look: [KX0, Z(-30)], rim: 0xff6a40, core: 0xff9050 },
  k3: { x: KX0, z: Z(-100), h: 135, look: [KX0, Z(-60)], rim: 0xffb060, core: 0xffb868 },
  k2: { x: KX0, z: Z(-212), h: 215, look: [KX0, Z(-60)], rim: 0xff8a50, core: 0xffa060, main: true },
};
const SKY = { x: KX0, y: 780, z: Z(-360), h: 560 };               // maakaali4, high over the valley (clear above the great colossus)

// Uploaded file names first (exact case — GitHub Pages is case-sensitive), then the usual variants.
const FILES = {
  k1: ['maakaali1.png', 'maakaali1.PNG', 'maakaali1.jpg', 'maakaali1.JPG', 'maakaali1.jpeg', 'maakaali1.webp'],
  k3: ['maakaali3.JPG', 'maakaali3.jpg', 'maakaali3.png', 'maakaali3.PNG', 'maakaali3.jpeg', 'maakaali3.webp'],
  k2: ['maakaali2.png', 'maakaali2.PNG', 'maakaali2.jpg', 'maakaali2.JPG', 'maakaali2.jpeg', 'maakaali2.webp'],
  sky: ['maakaali4.JPG', 'maakaali4.jpg', 'maakaali4.png', 'maakaali4.PNG', 'maakaali4.jpeg', 'maakaali4.webp'],
};

function canvas(w, h, read = false) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d', read ? { willReadFrequently: true } : undefined)]; }
function tex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const ssf = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function loadFirst(names) {
  return new Promise((resolve) => {
    let k = 0;
    const next = () => {
      if (k >= names.length) return resolve(null);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => { k++; next(); };
      img.src = ASSET_ROOT + names[k];
    };
    next();
  });
}

function fit(img, max) {
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const [c, x] = canvas(Math.max(8, Math.round(img.width * k)), Math.max(8, Math.round(img.height * k)), true);
  x.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

// maakaali3 is a JPG whose "transparent" background is a painted grey/white checkerboard.
// Cut it away: flood-fill the pale, colourless pixels from the picture's border, eat one more
// pixel of light fringe, then soften the edge.
function cutChecker(img) {
  const c = fit(img, 1024), W = c.width, H = c.height, x = c.getContext('2d', { willReadFrequently: true });
  const data = x.getImageData(0, 0, W, H), d = data.data, n = W * H;
  const pale = new Uint8Array(n), fringe = new Uint8Array(n), bg = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    pale[i] = mx - mn <= 18 && mn >= 192 ? 1 : 0;
    fringe[i] = mx - mn <= 46 && mn >= 150 ? 1 : 0;
  }
  const st = [];
  const push = (i) => { if (pale[i] && !bg[i]) { bg[i] = 1; st.push(i); } };
  for (let px = 0; px < W; px++) { push(px); push((H - 1) * W + px); }
  for (let py = 0; py < H; py++) { push(py * W); push(py * W + W - 1); }
  const fill = () => {
    while (st.length) {
      const i = st.pop(), px = i % W, py = (i / W) | 0;
      if (px > 0) push(i - 1); if (px < W - 1) push(i + 1);
      if (py > 0) push(i - W); if (py < H - 1) push(i + W);
    }
  };
  fill();
  // checkerboard pockets enclosed by the figure (between an arm and the trishul…): any other
  // big pale patch is background too; small ones (ash marks, highlights) are kept
  const seen = new Uint8Array(n), comp = [];
  for (let s0 = 0; s0 < n; s0++) {
    if (!pale[s0] || bg[s0] || seen[s0]) continue;
    comp.length = 0; comp.push(s0); seen[s0] = 1;
    for (let q = 0; q < comp.length; q++) {
      const i = comp[q], px = i % W, py = (i / W) | 0;
      for (const j of [px > 0 ? i - 1 : -1, px < W - 1 ? i + 1 : -1, py > 0 ? i - W : -1, py < H - 1 ? i + W : -1]) {
        if (j >= 0 && pale[j] && !bg[j] && !seen[j]) { seen[j] = 1; comp.push(j); }
      }
    }
    if (comp.length >= 140) for (const i of comp) { bg[i] = 1; st.push(i); }
  }
  st.length = 0;
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (bg[i]) continue;
    const px = i % W, py = (i / W) | 0;
    const nearBg = (px > 0 && bg[i - 1]) || (px < W - 1 && bg[i + 1]) || (py > 0 && bg[i - W]) || (py < H - 1 && bg[i + W]);
    a[i] = nearBg && fringe[i] ? 0 : 1;
  }
  const s = blurF(a, W, H, 1);
  for (let i = 0; i < n; i++) d[i * 4 + 3] = Math.round(Math.min(a[i], s[i] * 1.4) * 255);
  x.putImageData(data, 0, 0);
  return c;
}

// maakaali4 in the sky: not a rectangle. Its own dark background melts into the night (a soft oval
// edge, and near-black pixels half see-through), the face itself stays clearly visible (~88 % opaque).
function skyCanvas(img) {
  const c = fit(img, 1024), W = c.width, H = c.height, x = c.getContext('2d', { willReadFrequently: true });
  const data = x.getImageData(0, 0, W, H), d = data.data;
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const i = (py * W + px) * 4, u = (px + 0.5) / W - 0.5, v = (py + 0.5) / H - 0.5;
    const r = Math.hypot(u / 0.5, v / 0.5);
    const edge = 1 - ssf(0.6, 0.98, r);
    const lum = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
    d[i + 3] = Math.round(255 * 0.88 * edge * (0.62 + 0.38 * ssf(0.02, 0.18, lum)));
    // lifted a little so the dark face reads against the night (hue kept)
    for (let k = 0; k < 3; k++) d[i + k] = Math.min(255, d[i + k] * 1.45 + 6);
  }
  x.putImageData(data, 0, 0);
  return c;
}

// ====================== static part (built with the town) ======================
export function buildKaali(W) {
  const B = W.B, P = W.P;
  P.holes = P.holes || [];
  // ---- A: stairs under the temple courtyard ----
  for (let i = 0; i < STEPS; i++) {
    const top = -RISE * (i + 1), z = TOPZ - RUN * (i + 0.5);
    B.box('concrete', SX, (top + FLOOR_A - 0.3) / 2, z, 2.0, top - FLOOR_A + 0.3, RUN, 0, STONE, { uv: 1 });
  }
  for (const wx of [C1.x0 - 0.15, C1.x1 + 0.15]) B.box('brick', wx, (FLOOR_A - 0.3) / 2, (BOTTOMZ + TOPZ) / 2, 0.3, -FLOOR_A + 0.3, TOPZ - BOTTOMZ + 0.2, 0, BRICK, { uv: 2 });
  B.box('brick', SX, (FLOOR_A + CH + 0) / 2, BOTTOMZ - 0.15, 2.8, -(FLOOR_A + CH), 0.3, 0, BRICK, { uv: 2 }); // earth face above the tunnel mouth
  P.holes.push({ x0: C1.x0, x1: C1.x1, z0: BOTTOMZ, z1: TOPZ, maxY: 1 });  // open shaft
  W.kaaliMask = { x0: C1.x0 + 0.1, x1: C1.x1 - 0.1, z0: BOTTOMZ, z1: TOPZ };
  W.lights.push({ x: SX, y: FLOOR_A + 2.4, z: BOTTOMZ + 1.2, color: 0xff7040, intensity: 7, dist: 12, flicker: 1, interior: true });
  W.lights.push({ x: SX, y: -2.2, z: TOPZ - 3.5, color: 0xff9060, intensity: 3, dist: 7, interior: true });
  module(W, 0, 0, 0, false);
  // ---- B: the same tunnel at the valley, plus the valley itself ----
  module(W, O.x, O.y, O.z, true);
  valley(W);
}

// The tunnel module (corridors C1, C2, C3) at an offset. B is open toward the valley.
function module(W, ox, oy, oz, isB) {
  const B = W.B, P = W.P;
  const f = FLOOR_A + oy, c = f + CH;
  const box = (mat, x0, x1, y0, y1, z0, z1, col, opts) => B.box(mat, (x0 + x1) / 2 + ox, (y0 + y1) / 2, (z0 + z1) / 2 + oz, x1 - x0, y1 - y0, z1 - z0, 0, col, opts || { uv: 2 });
  const t = 0.3, w3 = C3.x1 - C3.x0;
  const c3z0 = isB ? C3Z0_B : C3Z0_A;
  // floors (old stone) and ceilings
  box('concrete', C1.x0, C1.x1, f - 0.3, f, C1.z0, C1.z1, STONE);
  box('concrete', C2.x0, C2.x1, f - 0.3, f, C2.z0, C2.z1, STONE);
  box('concrete', C3.x0, C3.x1, f - 0.3, f, c3z0, C2.z0, STONE);
  box('concrete', C1.x0 - t, C1.x1 + t, c, c + 0.3, C1.z0 - t, C1.z1, STONE);
  box('concrete', C2.x0, C2.x1 + t, c, c + 0.3, C2.z0 - t, C2.z1 + t, STONE);
  box('concrete', C3.x0 - t, C3.x1 + t, c, c + 0.3, c3z0, C2.z0, STONE);
  // walls
  box('brick', C1.x0 - t, C1.x0, f - 0.3, c, C1.z0 - t, C1.z1, BRICK);          // C1 west
  box('brick', C1.x1, C1.x1 + t, f - 0.3, c, C2.z1, C1.z1, BRICK);              // C1 east (above the C2 opening)
  box('brick', C1.x0, C2.x1 - w3, f - 0.3, c, C1.z0 - t, C1.z0, BRICK);         // north wall of C1/C2, leaves C3 open
  box('brick', C2.x0, C2.x1 + t, f - 0.3, c, C2.z1, C2.z1 + t, BRICK);          // C2 south
  box('brick', C2.x1, C2.x1 + t, f - 0.3, c, c3z0, C2.z1 + t, BRICK);           // C2 east end + C3 east
  box('brick', C3.x0 - t, C3.x0, f - 0.3, c, c3z0, C2.z0 - t, BRICK);           // C3 west
  if (!isB) box('brick', C3.x0, C3.x1, f - 0.3, c, c3z0 - t, c3z0, BRICK);      // A: dead end (never reached)
  // torches (identical in both copies), a deeper red than the Shivdham's
  const torch = (x, z, face) => {
    box('wood', x - 0.05, x + 0.05, f + 1.6, f + 2.1, z - 0.05, z + 0.05, [0.4, 0.28, 0.18], { collide: false });
    const p = [x + ox + face[0] * 0.05, f + 2.2, z + oz + face[1] * 0.05];
    W.fairy.push({ p, c: 0xff8040, s: 0.3, diya: true });
    W.lights.push({ x: p[0] + face[0] * 0.3, y: p[1], z: p[2] + face[1] * 0.3, color: 0xff8a40, intensity: 3.2, dist: 9, flicker: 1, interior: true });
  };
  torch(C1.x0 + 0.05, 18.8, [1, 0]);
  torch(C1.x0 + 0.05, 14.3, [1, 0]);
  torch(-113.1, C2.z1 - 0.05, [0, -1]);
  torch(C3.x0 + 0.05, 11.5, [1, 0]);
  if (!isB) {
    // tunnels sit below the town: below y = -1 the ground is open, the floors carry you
    P.holes.push({ x0: C1.x0, x1: C1.x1, z0: C1.z0, z1: C1.z1 + 0.01, maxY: -1 });
    P.holes.push({ x0: C2.x0 - 0.01, x1: C2.x1, z0: C2.z0, z1: C2.z1, maxY: -1 });
    P.holes.push({ x0: C3.x0, x1: C3.x1, z0: c3z0, z1: C2.z0 + 0.01, maxY: -1 });
  }
}

function valley(W) {
  const B = W.B, P = W.P, r = W.rng, X0 = KX0;
  const hw = (z) => 46 + Math.min(1, Math.max(0, -(z - ZM) / 170)) * 74;  // half width of the valley floor
  // floor in front of the lake
  B.ground('dirt', X0, Z((6 - 100) / 2), 250, 106, 0, 0, [0.4, 0.38, 0.44], 6);
  // cliff behind the player with the tunnel mouth in it
  const cz0 = ZM, cz1 = ZM + 7.6;
  B.box('rock', (X0 - 90 + C3.x0 + O.x - 0.3) / 2, 22, (cz0 + cz1) / 2, (C3.x0 + O.x - 0.3) - (X0 - 90), 44, cz1 - cz0, 0, ROCK, { uv: 10 });
  B.box('rock', (C3.x1 + O.x + 0.3 + X0 + 90) / 2, 22, (cz0 + cz1) / 2, (X0 + 90) - (C3.x1 + O.x + 0.3), 44, cz1 - cz0, 0, ROCK, { uv: 10 });
  B.box('rock', X0, (CH + 0.3 + 44) / 2, (cz0 + cz1) / 2, 3.2, 44 - CH - 0.3, cz1 - cz0, 0, ROCK, { uv: 10 });
  // carved stone frame around the mouth, a band of sindoor red on the lintel
  for (const sx of [-1.45, 1.45]) B.box('concrete', X0 + sx, 1.8, cz0 - 0.15, 0.5, 3.6, 0.4, 0, [0.7, 0.62, 0.52]);
  B.box('concrete', X0, 3.75, cz0 - 0.15, 3.6, 0.5, 0.45, 0, [0.7, 0.62, 0.52]);
  B.box('plain', X0, 3.75, cz0 - 0.39, 3.0, 0.16, 0.04, 0, rgb(0xb01818), { collide: false });
  // side cliffs, irregular, open to the sky
  for (let z = 4; z > -330; z -= 11 + r() * 5) {
    for (const s of [-1, 1]) {
      const h = (z > -120 ? 34 : 48) + r() * 40, w = 18 + r() * 14, d = 13 + r() * 8;
      const x = X0 + s * (hw(Z(z)) + w / 2 - 2 + r() * 6);
      B.box('rock', x, h / 2 - 1, Z(z), w, h, d, (r() - 0.5) * 0.5, ROCK.map((v) => v * (0.8 + r() * 0.25)), { uv: 9 });
      if (r() < 0.6) B.box('rock', x - s * w * 0.3, h + 3 - 1, Z(z) + (r() - 0.5) * 6, w * 0.6, 8 + r() * 10, d * 0.7, r() * 3, ROCK, { uv: 9, collide: false });
    }
  }
  // wall of rock far behind the great colossus, catching the glow
  for (let x = X0 - 170; x < X0 + 170; x += 16 + r() * 8) {
    const h = 70 + r() * 60;
    B.box('rock', x, h / 2 - 1, Z(-300 - r() * 25), 22 + r() * 10, h, 20, (r() - 0.5) * 0.4, ROCK.map((v) => v * 0.85), { uv: 10 });
  }
  // invisible limits of the walkable part: the path, the terrace and the ghat (the colossi stand outside)
  for (const s of [-1, 1]) P.add(X0 + s * 40, 10, Z(-52), 1, 20, 54);
  P.add(X0, 3, LAKE.z0 - 0.4, 120, 6, 0.3);                               // water's edge
  // stone path from the mouth to the terrace, diyas along it
  for (let z = -2; z > -84; z -= 2.6) {
    B.ground('concrete', X0 + (r() - 0.5) * 0.3, Z(z), 2.6 + r() * 0.4, 2.2, (r() - 0.5) * 0.1, 0.03, [0.62, 0.58, 0.54], 2);
    if (Math.round(-z) % 13 < 3) for (const s of [-1, 1]) {
      B.cylinder('plain', X0 + s * 2.2, 0, Z(z), 0.12, 0.08, rgb(0x9a5030), 6);
      W.fairy.push({ p: [X0 + s * 2.2, 0.16, Z(z)], c: 0xff9040, s: 0.3, diya: true });
    }
  }
  // rocks and boulders scattered on the floor for scale
  for (let i = 0; i < 70; i++) {
    const z = Z(-6 - r() * 95), s = r() < 0.5 ? -1 : 1, x = X0 + s * (6 + r() * (hw(z) - 12));
    const sz = 0.6 + r() * r() * 5;
    B.box('rock', x, sz * 0.35, z, sz * (1 + r()), sz * 0.8, sz * (1 + r()), r() * 3, ROCK, { uv: 4, collide: sz > 1.2 });
  }
  // terrace + ghat steps down to the water
  B.ground('concrete', X0, Z(-92), 70, 16, 0, 0.04, [0.68, 0.64, 0.6], 3);
  for (let i = 0; i < 5; i++) {
    const top = -0.16 * (i + 1), z = Z(-100.8 - i * 1.6);
    B.box('concrete', X0, (top - 1.2) / 2, z, 120, top + 1.2, 1.6, 0, [0.62, 0.58, 0.54], { uv: 2 });
  }
  P.holes.push({ x0: X0 - 120, x1: X0 + 120, z0: LAKE.z0 - 0.5, z1: Z(-100), maxY: 1 });
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { // stone lamp posts on the terrace
    const x = X0 + s * (6 + k * 8);
    B.box('concrete', x, 0.6, Z(-99.4), 0.5, 1.2, 0.5, 0, [0.66, 0.6, 0.55]);
    W.fairy.push({ p: [x, 1.3, Z(-99.4)], c: 0xffa050, s: 0.35, diya: true });
  }
  W.lights.push({ x: X0, y: 2.5, z: Z(-97), color: 0xffa060, intensity: 4, dist: 18, major: true });
  // the island: giant steps rising out of the lake
  for (let i = 0; i < 6; i++) {
    const top = -0.3 + 0.55 * i, z = Z(-140 - i * 2.4);
    B.box('concrete', X0, (top - 3) / 2, z, 50 - i * 3, top + 3, 2.4, 0, [0.6, 0.55, 0.5], { uv: 2 });
  }
  B.box('rock', X0, 0, Z(-240), 300, 5, 180, 0, ROCK, { uv: 10, skip: ['bottom'] });   // plateau, top at y = 2.5
  B.box('concrete', X0, 2.6, Z(-165), 46, 0.2, 18, 0, [0.62, 0.58, 0.54], { uv: 3 });  // forecourt
  // a stone plinth and a ridge of rock in front of each colossus: hides where the figure meets the ground
  for (const k of ['k1', 'k3', 'k2']) {
    const F = FIGS[k], y0 = k === 'k2' ? 2.5 : 0, wide = k === 'k2' ? 44 : 34;
    const yaw = Math.atan2(F.look[0] - F.x, F.look[1] - F.z);
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    B.box('concrete', F.x, y0 + 1.2, F.z, wide * 0.8, 2.4, 12, yaw, [0.6, 0.55, 0.5], { uv: 3 });
    B.box('plain', F.x + fx * 6.05, y0 + 1.6, F.z + fz * 6.05, wide * 0.6, 0.35, 0.1, yaw, rgb(0xa81818), { collide: false }); // sindoor band
    for (let i = 0; i < 22; i++) {
      const a = (r() - 0.5) * wide, h = 2 + r() * 3.5, w = 3 + r() * 6, dd = 8 + r() * 5;
      B.box('rock', F.x + fx * dd + fz * a, y0 + h / 2 - 0.5, F.z + fz * dd - fx * a, w, h, 3 + r() * 4, r() * 2, ROCK.map((v) => v * 0.8), { uv: 4 });
    }
    // lamp pillars (deepstambh) either side
    for (const s of [-1, 1]) {
      const x = F.x + fz * s * (wide * 0.42) + fx * 10, z = F.z - fx * s * (wide * 0.42) + fz * 10, ph = k === 'k2' ? 14 : 10;
      B.cylinder('concrete', x, y0, z, 0.9, ph, [0.62, 0.56, 0.5], 12, { collide: true });
      for (let q = 1; q <= (k === 'k2' ? 6 : 4); q++) {
        B.cylinder('concrete', x, y0 + q * 2.2, z, 1.4, 0.18, [0.7, 0.62, 0.52], 12);
        for (let a = 0; a < 8; a++) W.fairy.push({ p: [x + Math.cos(a * 0.785) * 1.3, y0 + q * 2.2 + 0.35, z + Math.sin(a * 0.785) * 1.3], c: a % 2 ? 0xffb040 : 0xff5030, s: 0.4, diya: true });
      }
      W.lights.push({ x, y: y0 + ph - 2, z: z + 2, color: 0xff8a40, intensity: 8, dist: 26, flicker: 1, major: true });
    }
  }
  // trees on the island and along the valley
  for (const [dx, dz, s] of [[-26, 10, 2.1], [-35, -6, 2.4], [24, 12, 2.0], [33, -4, 2.5], [-45, 24, 1.8], [44, 22, 1.9]]) W.props.trees.push({ p: [X0 + dx, 2.5, FIGS.k2.z + dz], s, type: s > 2 ? 'peepal' : undefined });
  for (let i = 0; i < 10; i++) { const z = Z(-20 - r() * 70); W.props.trees.push({ p: [X0 + (r() < 0.5 ? -1 : 1) * (14 + r() * 20), 0, z], s: 1.1 + r() * 0.6 }); }
  // golden-red light from behind the colossi, spilling on rocks, trees and water
  for (const s of [-1, 1]) W.lights.push({ x: X0 + s * 40, y: 24, z: FIGS.k2.z - 6, color: 0xffa040, intensity: 70, dist: 150, major: true, valley: true });
  W.lights.push({ x: X0, y: 5, z: FIGS.k2.z + 14, color: 0xffb070, intensity: 22, dist: 70, major: true, valley: true });
  for (const k of ['k1', 'k3']) W.lights.push({ x: FIGS[k].x, y: 22, z: FIGS[k].z + 8, color: FIGS[k].rim, intensity: 34, dist: 90, major: true, valley: true });
  W.special.kaali = { X0, mouth: ZM, figs: FIGS, sky: SKY, lake: LAKE };
}

// ====================== live part ======================
export class Kaali {
  constructor(game) {
    this.g = game;
    this.mode = false; this.underground = false; this.opened = false; this.lidT = 0;
    this.musicOn = false; this._musicIn = false;
    this.skyK = 0; this.revealed = false;
    this.figs = {};
  }

  build() {
    const g = this.g, scene = g.scene, W = g.W;
    // ---- stencil mask over the open shaft (the same trick as the Shivdham stairs) ----
    const m = W.kaaliMask;
    const maskMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    maskMat.stencilWrite = true; maskMat.stencilRef = 1; maskMat.stencilFunc = THREE.AlwaysStencilFunc; maskMat.stencilZPass = THREE.ReplaceStencilOp;
    const mask = new THREE.Mesh(new THREE.PlaneGeometry(m.x1 - m.x0, m.z1 - m.z0).rotateX(-Math.PI / 2), maskMat);
    mask.position.set((m.x0 + m.x1) / 2, 0.06, (m.z0 + m.z1) / 2); mask.renderOrder = -100;
    scene.add(mask);
    // ---- the trapdoor: dark planks, hinged on the side by the compound wall ----
    const lid = this.lid = new THREE.Group();
    lid.position.set(C1.x1, 0.04, (m.z0 + m.z1) / 2);
    const wood = new THREE.MeshLambertMaterial({ map: g.tex.wood, color: 0xa86a5a, emissive: 0x1a0806 });
    const L = m.z1 - m.z0 + 0.25;
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, L), wood);
      p.position.set(-(0.24 + i * 0.44), 0.04, 0); lid.add(p);
    }
    for (const z of [-L / 2 + 0.4, 0, L / 2 - 0.4]) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.12), g.mats.dark); b.position.set(-1.1, 0.1, z); lid.add(b); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.015, 6, 12), g.mats.dark); ring.rotation.x = Math.PI / 2; ring.position.set(-1.95, 0.1, -L / 2 + 0.6); lid.add(ring);
    // red-gold light leaking through the gaps — the only hint
    const leakMat = this.leakMat = new THREE.MeshBasicMaterial({ color: 0xff5a30, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.leak = new THREE.Group();
    for (let i = 1; i < 5; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.018, L - 0.3).rotateX(-Math.PI / 2), leakMat); s.position.set(-(0.02 + i * 0.44), 0.085, 0); this.leak.add(s); }
    lid.add(this.leak);
    scene.add(lid);
    this.lidBox = g.physics.add(C1.x1 - 1.1, 0.06, (m.z0 + m.z1) / 2, 1.1, 0.06, L / 2, 0, 'door');
    // ---- the valley: glows, mist, lake, sky ----
    this.layers = [];
    const additive = (map, color, opacity) => new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false });
    const core = coreTexture(), rays = raysTexture(), col = columnTexture(), mistT = bandTexture(255, 150, 100), mistB = bandTexture(120, 110, 170);
    for (const key of ['k1', 'k3', 'k2']) {
      const F = FIGS[key], H = F.h, k = H / 50, baseY = key === 'k2' ? 0 : -1;
      const grp = new THREE.Group();
      grp.position.set(F.x, 0, F.z);
      grp.rotation.y = Math.atan2(F.look[0] - F.x, F.look[1] - F.z);
      scene.add(grp);
      const add = (mesh, z, y, order, op) => { mesh.position.set(0, y, z); mesh.renderOrder = order; grp.add(mesh); if (op !== undefined) this.layers.push([mesh, op]); return mesh; };
      const s = F.main ? 1 : 0.62;
      add(new THREE.Mesh(new THREE.PlaneGeometry(150 * k * s, 170 * k * s), additive(core, F.core, F.main ? 0.7 : 0.5)), -7, baseY + H * 0.56, 1, F.main ? 0.7 : 0.5);
      if (F.main) this.rays = add(new THREE.Mesh(new THREE.PlaneGeometry(170 * k, 170 * k), additive(rays, 0xffc890, 0.4)), -6, baseY + H * 0.6, 1, 0.4);
      add(new THREE.Mesh(new THREE.PlaneGeometry(30 * k * s, 320 * k * s), additive(col, 0xffb070, 0.1)), -8, baseY + 165 * k * s, 1, 0.1);
      add(new THREE.Mesh(new THREE.PlaneGeometry(90 * k * 0.7, 16 * k * 0.7), additive(mistT, 0xffffff, 0.5)), 8, 4, 4, 0.5);
      this.figs[key] = { F, grp, H, baseY, yaw0: grp.rotation.y, fig: null };
    }
    // mist across the lake, the far horizon glow behind everything, haze over the path
    const M2 = new THREE.Mesh(new THREE.PlaneGeometry(240, 26), additive(mistB, 0xffffff, 0.16));
    M2.position.set(KX0, 6, FIGS.k2.z + 40); M2.renderOrder = 4; scene.add(M2); this.layers.push([M2, 0.16]);
    const hor = new THREE.Mesh(new THREE.PlaneGeometry(560, 170), additive(bandTexture(255, 120, 60), 0xffffff, 0.3));
    hor.position.set(KX0, 35, Z(-285)); hor.renderOrder = 0; scene.add(hor); this.layers.push([hor, 0.3]);
    const haze = new THREE.Mesh(new THREE.PlaneGeometry(260, 22), additive(bandTexture(110, 100, 160), 0xffffff, 0.12));
    haze.position.set(KX0, 6, Z(-55)); haze.renderOrder = 4; scene.add(haze);
    // the lake: dark water with a golden-red path of reflected light
    const water = new THREE.Mesh(new THREE.PlaneGeometry(300, LAKE.z0 - LAKE.z1 + 8).rotateX(-Math.PI / 2), new THREE.MeshPhongMaterial({ color: 0x0a0610, specular: 0xffa070, shininess: 60 }));
    water.position.set(KX0, LAKE.y, (LAKE.z0 + LAKE.z1) / 2); scene.add(water);
    const glit = new THREE.Mesh(new THREE.PlaneGeometry(16, LAKE.z0 - LAKE.z1).rotateX(-Math.PI / 2), additive(col, 0xffa070, 0.28));
    glit.rotation.y = Math.PI; glit.position.set(KX0, LAKE.y + 0.02, (LAKE.z0 + LAKE.z1) / 2); glit.renderOrder = 1; scene.add(glit);
    this.layers.push([glit, 0.28]);
    // maakaali4 in the sky: a billboard high above the valley (filled in when the image is ready)
    this.sky = new THREE.Group(); this.sky.position.set(SKY.x, SKY.y, SKY.z); this.sky.visible = false; scene.add(this.sky);
    this.skyGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: g.tex.glow, color: 0xff6a3a, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, transparent: true, opacity: 0 }));
    this.skyGlow.scale.setScalar(SKY.h * 1.5); this.skyGlow.renderOrder = 0; this.sky.add(this.skyGlow);
    this.skyMesh = null;
    this.loadImages();
  }

  // The images load in the background after the town is built (they are only ever seen in the
  // valley), one at a time, so the loading screen isn't held up and phones don't stall.
  loadImages() {
    const jobs = [
      ['k1', (img) => this.setFigure('k1', statueCanvases(img))],
      ['k3', (img) => this.setFigure('k3', statueCanvases(cutChecker(img)))],
      ['k2', (img) => this.setFigure('k2', statueCanvases(img))],
      ['sky', (img) => this.setSky(skyCanvas(img))],
    ];
    this.ready = {};
    let chain = Promise.resolve();
    for (const [key, fn] of jobs) {
      const p = loadFirst(FILES[key]);
      chain = chain.then(() => p).then((img) => new Promise((res) => setTimeout(() => {
        try { if (img) { fn(img); this.ready[key] = true; } else console.warn('[kaali] image not found:', FILES[key][0]); }
        catch (e) { console.warn('[kaali] could not prepare', FILES[key][0], e); }
        res();
      }, 0)));
    }
    this.loaded = chain;
  }

  setFigure(key, sc) {
    const f = this.figs[key], H = f.H, Wd = H * sc.aspect;
    const rimMat = new THREE.MeshBasicMaterial({ map: tex(sc.rim), color: f.F.rim, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false });
    const rim = new THREE.Mesh(new THREE.PlaneGeometry(Wd * 1.16, H * 1.08), rimMat);
    rim.position.set(0, f.baseY + H / 2 + 1.2, -0.8); rim.renderOrder = 2; f.grp.add(rim); this.layers.push([rim, 0.24]);
    // shown as painted (unlit); the night haze (fog) still settles on it with distance
    const ft = tex(sc.c); ft.anisotropy = 8;
    const mat = new THREE.MeshBasicMaterial({ map: ft, transparent: true, alphaTest: 0.03, depthWrite: true, toneMapped: false, color: 0xf2f0ec });
    const fig = new THREE.Mesh(reliefGeometry(Wd, H, sc.depth, 2.6 * H / 58), mat);
    fig.position.set(0, f.baseY + H / 2, 0); fig.renderOrder = 3; f.grp.add(fig);
    f.fig = fig;
  }

  setSky(c) {
    const h = SKY.h, w = h * c.width / c.height;
    const mat = new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false });
    this.skyMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    this.skyMesh.renderOrder = 1;            // over the stars, under nothing solid (depth test stays on)
    this.sky.add(this.skyMesh);
    this.applySky();
  }

  applySky() {
    const k = this.skyK * this.skyK * (3 - 2 * this.skyK);
    if (this.skyMesh) this.skyMesh.material.opacity = k;
    this.skyGlow.material.opacity = 0.22 * k;
    this.sky.visible = this.mode && k > 0;
  }

  reset() {
    this.opened = false; this.lidT = 0; this._musicIn = false; this.musicOn = false;
    this.skyK = 0; this.revealed = false;
    this.g.audio.fade('kaaliMusic', 0, 0);
    this.lid.rotation.z = 0; this.leak.visible = true; this.lidBox.enabled = true;
    this.setMode(false);
    this.applySky();
  }

  // ---- interaction with the trapdoor ----
  consider(fn) {
    if (this.opened) return;
    const m = this.g.W.kaaliMask, P = this.g.player.pos;
    fn([C1.x1 - 1.1, 0.15, clamp(P.z, m.z0 + 0.4, m.z1 - 0.4)], 2.6, { type: 'kaali' });
  }
  prompt() { return ['OPEN', 'लाल तख़्ता · red trapdoor']; }
  use() {
    if (this.opened) return;
    this.opened = true; this.lidBox.enabled = false; this.leak.visible = false;
    const a = this.g.audio;
    a.play('creak', { pos: [SX, 0.5, TOPZ - 3], vol: 0.9, rate: 0.55 });
    a.play('slam', { pos: [SX, 0.5, TOPZ - 3], vol: 0.6, delay: 0.7, rate: 0.7 });
  }

  // ---- valley look: open sky, dark crimson-blue haze, far view ----
  setMode(on) {
    const g = this.g;
    if (on === this.mode) return;
    this.mode = on;
    const fog = g.scene.fog;
    if (on) { fog.color.setHex(0x0a0714); fog.density = 0.0024; }
    else { fog.color.setHex(0x0d1520); fog.density = 0.0165; }
    g.camera.far = on ? 950 : 170; g.camera.updateProjectionMatrix();
    g.sky.scale.setScalar(on ? 6 : 1); g.stars.scale.setScalar(on ? 6 : 1);
    g.sky.material.uniforms.hor.value.setHex(on ? 0x180c1e : 0x1a2230);
    g.moon.visible = !on;
    this.applySky();
  }

  update(dt) {
    const g = this.g, P = g.player, p = P.pos;
    // trapdoor swings up against the compound wall
    if (!this.opened) this.leakMat.opacity = 0.2 + 0.12 * Math.sin(g.time * 1.1 + 1);
    if (this.opened && this.lidT < 1) { this.lidT = Math.min(1, this.lidT + dt * 0.8); const k = this.lidT; this.lid.rotation.z = -1.52 * k * k * (3 - 2 * k); }
    // seamless switch between the two copies of the tunnel, at the blind corner
    if (p.y < FLOOR_A + 3 && p.y > FLOOR_A - 1 && p.x > TRIG_A && p.x < C2.x1 + 1 && p.z > C2.z0 - 0.3 && p.z < C2.z1 + 0.3 && p.z > -600) this.shift(1);
    else if (p.y < 3 && p.y > -1 && p.x < TRIG_B + O.x && p.x > C1.x0 + O.x - 1 && p.z > C1.z0 + O.z - 0.3 && p.z < C1.z1 + O.z + 0.3) this.shift(-1);
    const inB = p.z < -600;
    this.underground = (p.y < -1 && p.x > -122 && p.x < -104 && p.z > 8 && p.z < TOPZ + 1) || (inB && p.z > ZM - 0.5 && p.z < C1.z1 + O.z + 1);
    this.setMode(inB);
    if (this.mode) {
      // keep the colossi turned toward the visitor (they never show their edge)
      for (const key in this.figs) {
        const f = this.figs[key], grp = f.grp;
        const want = Math.atan2(p.x - grp.position.x, p.z - grp.position.z);
        let d = want - f.yaw0; d = Math.atan2(Math.sin(d), Math.cos(d));
        const yaw = f.yaw0 + clamp(d, -0.32, 0.32);
        grp.rotation.y += (yaw - grp.rotation.y) * Math.min(1, dt * 2);
      }
      if (this.rays) this.rays.rotation.z += dt * 0.012;
      // the face in the sky always looks down at you
      this.sky.lookAt(g.camera.position);
      // she appears in the sky a few steps after you walk out of the tunnel
      if (!this.revealed && p.z < ZM - 3.2) {
        this.revealed = true;
        g.audio.play('magic', { vol: 0.8, verbAmt: 1.3, rate: 0.85 });
        g.audio.play('bell', { vol: 0.4, rate: 0.45, verbAmt: 1.5 });
        g.banner('जय माँ काली', 'MAA KAALI WATCHES FROM THE SKY', 'divine');
      }
      if (this.revealed && this.skyK < 1) { this.skyK = Math.min(1, this.skyK + dt / 7); this.applySky(); }
      const t = g.time;
      for (const [mesh, op] of this.layers) mesh.material.opacity = op;
      if (this.layers[0]) this.layers[0][0].material.opacity = this.layers[0][1] * (0.94 + Math.sin(t * 0.7) * 0.06);
    }
    // Maa Kaali song: swells in once you are round the blind corner, dips under a chase, fades out if you go back
    const music = this.mode && !P.dead ? (g.chaseOn ? 0.28 : 0.62) : 0;
    g.audio.fade('kaaliMusic', music, music > 0 ? (this._musicIn ? 2.5 : 9) : 3);
    if (music > 0) this._musicIn = true; else if (!this.mode) this._musicIn = false;
    this.musicOn = music > 0 && g.audio.hasTrack('kaaliMusic');     // footsteps are silent while it plays
  }

  shift(dir) {
    const P = this.g.player;
    // anything chasing the player in the tunnel crosses over with them
    for (const e of this.g.enemies.list) {
      if (e.dead || !e.tunnel) continue;
      if (Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) < 14 && Math.abs(e.pos.y - P.pos.y) < 3) {
        e.pos.x += O.x * dir; e.pos.y += O.y * dir; e.pos.z += O.z * dir;
        if (e.lastSeen) { e.lastSeen.x += O.x * dir; e.lastSeen.z += O.z * dir; }
        if (e.st) e.st.peak = (e.st.peak ?? e.pos.y) + O.y * dir;
        e.frozen = false;
      }
    }
    P.pos.x += O.x * dir; P.pos.y += O.y * dir; P.pos.z += O.z * dir;
    P.smoothY += O.y * dir; P.state.peak = (P.state.peak ?? P.pos.y) + O.y * dir;
    this.g.camera.position.x += O.x * dir; this.g.camera.position.y += O.y * dir; this.g.camera.position.z += O.z * dir;
  }
}
