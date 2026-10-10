// The hidden Shivdham: a trapdoor in the Maa Kamakhya Mandir courtyard leads
// down a torch-lit brick tunnel that opens into a roofless valley under the
// night sky, where a colossal Shivji stands beyond a sacred lake, lit from
// behind by a huge golden glow.
//
// The valley is built far outside the town (so nothing of Jais is ever in
// view from it). The tunnel is built twice — under the temple (A) and at the
// valley (B) — and the player is moved between the two copies at a blind
// corner, so the walk feels continuous.
import * as THREE from 'three';
import { rgb, clamp } from './util.js';
import { WEAPONS, AMMO } from './weapons.js';
import { FIRE } from './explosives.js';

// ---------- fixed geometry ----------
const SX = -134, TOPZ = 26, STEPS = 24, RUN = 0.3, RISE = 0.25;   // stairs under the temple
const FLOOR_A = -STEPS * RISE;                                    // -6
const O = { x: -900, y: -FLOOR_A, z: 0 };                         // A -> B offset (B floor at y = 0)
const C1 = { x0: -135.1, x1: -132.9, z0: 9.8, z1: 18.8 };         // north corridor
const C2 = { x0: -144.2, x1: -135.1, z0: 9.8, z1: 12.0 };         // west corridor (the blind corner)
const C3 = { x0: -144.2, x1: -142.0 };                            // last corridor, toward the valley
const TRIG_A = -139.5, TRIG_B = -138.5;                           // hysteresis on x inside C2
const X0 = (C3.x0 + C3.x1) / 2 + O.x;                             // valley centre line
const STATUE = { x: X0, z: -208, h: 260 };                        // ~260 m (2.25x the earlier 116 m): from the tunnel mouth his head is ~51° up, from the ghat ~67° — you have to look up to see his face
const LAKE = { z0: -108, z1: -152, y: -0.65 };
const CH = 3.2;                                                   // corridor height

const BRICK = [0.62, 0.5, 0.44], STONE = [0.55, 0.52, 0.5], ROCK = [0.5, 0.47, 0.48];

// ---------- textures drawn in code ----------
function canvas(w, h, read = false) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d', read ? { willReadFrequently: true } : undefined)]; }
function tex(c, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }

export function rockTexture() {
  const [c, x] = canvas(512, 512);
  x.fillStyle = '#5b5552'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40; i++) { // strata
    const y = Math.random() * 512, h = 4 + Math.random() * 22;
    x.fillStyle = `rgba(${Math.random() < 0.5 ? '30,26,24' : '120,110,100'},${0.12 + Math.random() * 0.2})`;
    x.fillRect(0, y, 512, h);
  }
  for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? 20 : 150},${Math.random() < 0.5 ? 18 : 140},${Math.random() < 0.5 ? 16 : 130},0.35)`; x.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 3, 1 + Math.random() * 2); }
  x.strokeStyle = 'rgba(15,12,10,0.5)';
  for (let i = 0; i < 30; i++) { x.lineWidth = 0.5 + Math.random() * 1.5; let px = Math.random() * 512, py = Math.random() * 512; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (Math.random() - 0.5) * 50; py += Math.random() * 40; x.lineTo(px, py); } x.stroke(); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

function radial(size, stops) {
  const [c, x] = canvas(size, size);
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) g.addColorStop(o, col);
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  return c;
}

// Golden core: not a clean disc — stretched upward, with soft lobes and grain.
export function coreTexture() {
  const [c, x] = canvas(512, 512);
  x.globalCompositeOperation = 'lighter';
  const blob = (cx, cy, rx, ry, a) => {
    x.save(); x.translate(cx, cy); x.scale(rx / 256, ry / 256);
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 256);
    g.addColorStop(0, `rgba(255,236,190,${a})`); g.addColorStop(0.25, `rgba(255,200,110,${a * 0.6})`);
    g.addColorStop(0.6, `rgba(230,140,40,${a * 0.18})`); g.addColorStop(1, 'rgba(200,100,20,0)');
    x.fillStyle = g; x.fillRect(-256, -256, 512, 512); x.restore();
  };
  blob(256, 250, 250, 256, 0.75);
  blob(256, 200, 140, 200, 0.6);
  for (let i = 0; i < 7; i++) blob(256 + (Math.random() - 0.5) * 140, 230 + (Math.random() - 0.5) * 160, 60 + Math.random() * 90, 60 + Math.random() * 120, 0.18);
  return tex(c);
}

// Fan of light rays with random widths, faded toward the edge.
export function raysTexture() {
  const S = 1024, [c, x] = canvas(S, S);
  x.translate(S / 2, S / 2);
  x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 90; i++) {
    const a = Math.random() * Math.PI * 2, w = 0.004 + Math.random() * 0.03, len = S * (0.25 + Math.random() * 0.25);
    const g = x.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
    const al = 0.05 + Math.random() * 0.16;
    g.addColorStop(0, `rgba(255,220,150,${al})`); g.addColorStop(1, 'rgba(255,180,80,0)');
    x.fillStyle = g;
    x.beginPath(); x.moveTo(0, 0);
    x.lineTo(Math.cos(a - w) * len, Math.sin(a - w) * len); x.lineTo(Math.cos(a + w) * len, Math.sin(a + w) * len);
    x.closePath(); x.fill();
  }
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalCompositeOperation = 'destination-in';
  const m = x.createRadialGradient(S / 2, S / 2, S * 0.05, S / 2, S / 2, S / 2);
  m.addColorStop(0, 'rgba(0,0,0,0.4)'); m.addColorStop(0.25, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = m; x.fillRect(0, 0, S, S);
  return tex(c);
}

export function bandTexture(r, g, b) { // soft horizontal band for haze / mist
  const [c, x] = canvas(256, 128);
  const v = x.createLinearGradient(0, 0, 0, 128);
  v.addColorStop(0, `rgba(${r},${g},${b},0)`); v.addColorStop(0.55, `rgba(${r},${g},${b},0.85)`); v.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = v; x.fillRect(0, 0, 256, 128);
  x.globalCompositeOperation = 'destination-in';
  const h = x.createLinearGradient(0, 0, 256, 0);
  h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(0.2, 'rgba(0,0,0,1)'); h.addColorStop(0.8, 'rgba(0,0,0,1)'); h.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = h; x.fillRect(0, 0, 256, 128);
  return tex(c);
}

export function columnTexture() {
  const [c, x] = canvas(64, 512);
  const v = x.createLinearGradient(0, 512, 0, 0);
  v.addColorStop(0, 'rgba(255,210,130,0.9)'); v.addColorStop(0.5, 'rgba(255,190,100,0.35)'); v.addColorStop(1, 'rgba(255,180,90,0)');
  x.fillStyle = v; x.fillRect(0, 0, 64, 512);
  x.globalCompositeOperation = 'destination-in';
  const h = x.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(0.5, 'rgba(0,0,0,1)'); h.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = h; x.fillRect(0, 0, 64, 512);
  return tex(c);
}

function halfMoonTexture() {
  const S = 256, [c, x] = canvas(S, S), r = 70, cx = S / 2, cy = S / 2;
  const halo = x.createRadialGradient(cx, cy, r * 0.8, cx, cy, S / 2);
  halo.addColorStop(0, 'rgba(190,210,255,0.22)'); halo.addColorStop(1, 'rgba(190,210,255,0)');
  x.fillStyle = halo; x.fillRect(0, 0, S, S);
  // dark side, barely visible (earthshine)
  x.fillStyle = 'rgba(70,85,120,0.25)'; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  // lit half (first quarter)
  x.save(); x.beginPath(); x.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2); x.closePath(); x.clip();
  const lit = x.createLinearGradient(cx, 0, cx + r, 0);
  lit.addColorStop(0, '#c9d2e4'); lit.addColorStop(0.15, '#eef2fa'); lit.addColorStop(1, '#fdfdf8');
  x.fillStyle = lit; x.fillRect(cx, cy - r, r, r * 2);
  for (let i = 0; i < 22; i++) { // maria / craters
    x.fillStyle = `rgba(120,130,150,${0.1 + Math.random() * 0.18})`;
    x.beginPath(); x.arc(cx + Math.random() * r, cy + (Math.random() - 0.5) * r * 1.7, 3 + Math.random() * 12, 0, 7); x.fill();
  }
  x.restore();
  return tex(c);
}

// ---------- the statue: the user's image turned into a glowing colossus ----------
// Separable box blur (3 passes ~ gaussian) on a float map.
export function blurF(src, w, h, r) {
  r = Math.max(1, Math.round(r));
  let a = Float32Array.from(src), t = new Float32Array(w * h);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      let acc = 0; const row = y * w;
      for (let x = -r; x <= r; x++) acc += a[row + clamp(x, 0, w - 1)];
      for (let x = 0; x < w; x++) {
        t[row + x] = acc / (2 * r + 1);
        acc += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += t[clamp(y, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = acc / (2 * r + 1);
        acc += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x];
      }
    }
  }
  return a;
}
const ssf = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Where is the figure? Its body is dense with detail and light; empty space
// is smooth and dark. A soft prior keeps the head, torso and open palm solid
// even where they are dark and smooth.
function figureMask(img) {
  const h = 384, w = Math.max(8, Math.round(img.width * h / img.height));
  const [c, x] = canvas(w, h, true);
  x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
  const lb = blurF(lum, w, h, 2);
  const hp = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) hp[i] = Math.min(1, Math.abs(lum[i] - lb[i]) * 5);
  const en = blurF(hp, w, h, 7);
  const sorted = Array.from(en).sort((p, q) => p - q), p97 = sorted[Math.floor(sorted.length * 0.97)] || 1;
  let m = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x2 = 0; x2 < w; x2++) {
    const i = y * w + x2, u = x2 / w - 0.5, v = y / h;
    const core = Math.exp(-Math.pow((u / 0.3) ** 2 + ((v - 0.36) / 0.34) ** 2, 1.4));
    const palm = Math.exp(-Math.pow(((u + 0.07) / 0.33) ** 2 + ((v - 0.61) / 0.15) ** 2, 1.4));
    m[i] = Math.max(ssf(0.25, 0.6, core), ssf(0.25, 0.6, palm), ssf(0.32, 0.62, en[i] / p97));
  }
  m = blurF(m, w, h, 3);
  const near = blurF(m, w, h, 10), lumB = blurF(lum, w, h, 1);
  for (let y = 0; y < h; y++) for (let x2 = 0; x2 < w; x2++) {
    const i = y * w + x2, v = y / h;
    const u = x2 / w;
    // never touch the picture's own border: no straight edges in the sky
    const border = ssf(0.0, 0.14, u) * ssf(0.0, 0.14, 1 - u) * ssf(0.0, 0.05, v);
    m[i] = Math.max(m[i], ssf(0.08, 0.3, lumB[i]) * ssf(0.1, 0.3, near[i])) * (1 - ssf(0.86, 0.985, v)) * border;
  }
  return { m, w, h };
}

export function statueCanvases(img) {
  const k = Math.min(1, 1024 / Math.max(img.width, img.height));
  const W = Math.max(8, Math.round(img.width * k)), H = Math.max(8, Math.round(img.height * k));
  const [c, x] = canvas(W, H, true);
  x.drawImage(img, 0, 0, W, H);
  const data = x.getImageData(0, 0, W, H), d = data.data;
  // Real transparency in the upload wins; otherwise find the figure ourselves.
  let transp = 0;
  for (let i = 3; i < d.length; i += 4 * 11) if (d[i] < 240) transp++;
  const hasAlpha = transp / (d.length / 44) > 0.02;
  const fm = hasAlpha ? null : figureMask(c);
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const i = (py * W + px) * 4;
    let a;
    if (hasAlpha) a = (d[i + 3] / 255) * (1 - ssf(0.9, 0.995, py / H));
    else a = fm.m[Math.min(fm.h - 1, (py * fm.h / H) | 0) * fm.w + Math.min(fm.w - 1, (px * fm.w / W) | 0)];
    d[i + 3] = Math.round(a * 255);
  }
  x.putImageData(data, 0, 0);
  // golden rim: the grown silhouette minus the figure itself = light around his outline
  const small = (f) => { const [s, sx] = canvas(Math.max(4, W / f | 0), Math.max(4, H / f | 0), true); sx.drawImage(c, 0, 0, s.width, s.height); return s; };
  const [rim, rx] = canvas(W / 4 | 0, H / 4 | 0);
  rx.imageSmoothingQuality = 'high';
  rx.drawImage(small(40), 0, 0, rim.width, rim.height);
  rx.drawImage(small(64), 0, 0, rim.width, rim.height);
  rx.globalCompositeOperation = 'source-in';
  rx.fillStyle = '#ff9a40'; rx.fillRect(0, 0, rim.width, rim.height);
  const depth = small(20); // soft silhouette used to give the figure body
  return { c, rim, depth, aspect: W / H };
}

export function reliefGeometry(w, h, depthCanvas, depth) {
  const g = new THREE.PlaneGeometry(w, h, 40, 72);
  const dx = depthCanvas.getContext('2d').getImageData(0, 0, depthCanvas.width, depthCanvas.height).data;
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i), v = 1 - uv.getY(i);
    const px = Math.min(depthCanvas.width - 1, Math.floor(u * depthCanvas.width)), py = Math.min(depthCanvas.height - 1, Math.floor(v * depthCanvas.height));
    const a = dx[(py * depthCanvas.width + px) * 4 + 3] / 255;
    pos.setZ(i, depth * Math.pow(a, 1.6) * (0.75 + 0.25 * Math.cos(u * Math.PI * 2 - Math.PI)));
  }
  g.computeVertexNormals();
  return g;
}

// ====================== static part (built with the town) ======================
export function prepareMaterials(mats) {
  mats.rock = new THREE.MeshLambertMaterial({ map: rockTexture(), vertexColors: true });
  // the ground and courtyard floor are not drawn over the open stairwell
  for (const k of ['dirt', 'tile']) {
    const m = mats[k];
    m.stencilWrite = true; m.stencilRef = 1; m.stencilFunc = THREE.NotEqualStencilFunc;
    m.stencilFail = THREE.KeepStencilOp; m.stencilZFail = THREE.KeepStencilOp; m.stencilZPass = THREE.KeepStencilOp; m.stencilWriteMask = 0;
  }
}

export function buildSecret(W) {
  const B = W.B, P = W.P;
  P.holes = P.holes || [];
  // ---- A: stairs under the temple courtyard ----
  for (let i = 0; i < STEPS; i++) {
    const top = -RISE * (i + 1), z = TOPZ - RUN * (i + 0.5);
    B.box('concrete', SX, (top + FLOOR_A - 0.3) / 2, z, 2.0, top - FLOOR_A + 0.3, RUN, 0, STONE, { uv: 1 });
  }
  const bottomZ = TOPZ - RUN * STEPS;                                     // 18.8
  for (const wx of [C1.x0 - 0.15, C1.x1 + 0.15]) B.box('brick', wx, (FLOOR_A - 0.3) / 2, (bottomZ + TOPZ) / 2, 0.3, -FLOOR_A + 0.3, TOPZ - bottomZ + 0.2, 0, BRICK, { uv: 2 });
  B.box('brick', SX, (FLOOR_A + CH + 0) / 2, bottomZ - 0.15, 2.8, -(FLOOR_A + CH), 0.3, 0, BRICK, { uv: 2 }); // earth face above the tunnel mouth
  P.holes.push({ x0: C1.x0, x1: C1.x1, z0: bottomZ, z1: TOPZ, maxY: 1 });  // open shaft
  W.stairMask = { x0: C1.x0 + 0.1, x1: C1.x1 - 0.1, z0: bottomZ, z1: TOPZ };
  W.lights.push({ x: SX, y: FLOOR_A + 2.4, z: bottomZ + 1.2, color: 0xffa040, intensity: 7, dist: 12, flicker: 1, interior: true });
  W.lights.push({ x: SX, y: -2.2, z: TOPZ - 3.5, color: 0xffb060, intensity: 3, dist: 7, interior: true });
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
  const t = 0.3;
  // floors (old stone) and ceilings
  box('concrete', C1.x0, C1.x1, f - 0.3, f, C1.z0, C1.z1, STONE);
  box('concrete', C2.x0, C2.x1, f - 0.3, f, C2.z0, C2.z1, STONE);
  const c3z0 = isB ? -0.6 : 6.8;
  box('concrete', C3.x0, C3.x1, f - 0.3, f, c3z0, C2.z0, STONE);
  box('concrete', C1.x0 - t, C1.x1 + t, c, c + 0.3, C1.z0 - t, C1.z1, STONE);
  box('concrete', C2.x0 - t, C2.x1, c, c + 0.3, C2.z0 - t, C2.z1 + t, STONE);
  box('concrete', C3.x0 - t, C3.x1 + t, c, c + 0.3, c3z0, C2.z0, STONE);
  // walls
  box('brick', C1.x1, C1.x1 + t, f - 0.3, c, C1.z0 - t, C1.z1, BRICK);          // C1 east
  box('brick', C1.x0 - t, C1.x0, f - 0.3, c, C2.z1, C1.z1, BRICK);              // C1 west (above the C2 opening)
  box('brick', C2.x0 + (C3.x1 - C3.x0), C1.x1, f - 0.3, c, C1.z0 - t, C1.z0, BRICK); // north wall of C2/C1, leaves C3 open
  box('brick', C2.x0 - t, C2.x1, f - 0.3, c, C2.z1, C2.z1 + t, BRICK);          // C2 south
  box('brick', C2.x0 - t, C2.x0, f - 0.3, c, c3z0, C2.z1 + t, BRICK);           // C2 west end + C3 west
  box('brick', C3.x1, C3.x1 + t, f - 0.3, c, c3z0, C2.z0 - t, BRICK);           // C3 east
  if (!isB) box('brick', C3.x0, C3.x1, f - 0.3, c, c3z0 - t, c3z0, BRICK);      // A: dead end (never reached)
  // torches (identical in both copies)
  const torch = (x, z, face) => {
    box('wood', x - 0.05, x + 0.05, f + 1.6, f + 2.1, z - 0.05, z + 0.05, [0.4, 0.28, 0.18], { collide: false });
    const p = [x + ox + face[0] * 0.05, f + 2.2, z + oz + face[1] * 0.05];
    W.fairy.push({ p, c: 0xffa040, s: 0.3, diya: true });
    W.lights.push({ x: p[0] + face[0] * 0.3, y: p[1], z: p[2] + face[1] * 0.3, color: 0xff9a40, intensity: 3.2, dist: 9, flicker: 1, interior: true });
  };
  torch(C1.x1 - 0.05, 15.5, [-1, 0]);
  torch(C1.x1 - 0.05, 11.0, [-1, 0]);
  torch(-139.3, C2.z1 - 0.05, [0, -1]);
  torch(C3.x1 - 0.05, 8.2, [-1, 0]);
  if (!isB) {
    // tunnels sit below the town: below y = -1 the ground is open, the floors carry you
    W.P.holes.push({ x0: C1.x0, x1: C1.x1, z0: C1.z0, z1: C1.z1 + 0.01, maxY: -1 });
    W.P.holes.push({ x0: C2.x0, x1: C2.x1 + 0.01, z0: C2.z0, z1: C2.z1, maxY: -1 });
    W.P.holes.push({ x0: C3.x0, x1: C3.x1, z0: c3z0, z1: C2.z0 + 0.01, maxY: -1 });
  }
}

function valley(W) {
  const B = W.B, P = W.P, r = W.rng;
  const hw = (z) => 46 + Math.min(1, Math.max(0, -z / 170)) * 74;       // half width of the valley floor
  // floor: in front of the lake, either side of it, and the island plateau behind
  B.ground('dirt', X0, (6 - 100) / 2, 250, 106, 0, 0, [0.42, 0.42, 0.5], 6);
  // cliff behind the player with the tunnel mouth in it
  const cz0 = -0.6, cz1 = 7;
  B.box('rock', (X0 - 90 + C3.x0 + O.x - 0.3) / 2, 22, (cz0 + cz1) / 2, (C3.x0 + O.x - 0.3) - (X0 - 90), 44, cz1 - cz0, 0, ROCK, { uv: 10 });
  B.box('rock', (C3.x1 + O.x + 0.3 + X0 + 90) / 2, 22, (cz0 + cz1) / 2, (X0 + 90) - (C3.x1 + O.x + 0.3), 44, cz1 - cz0, 0, ROCK, { uv: 10 });
  B.box('rock', X0, (CH + 0.3 + 44) / 2, (cz0 + cz1) / 2, 3.2, 44 - CH - 0.3, cz1 - cz0, 0, ROCK, { uv: 10 });
  // carved stone frame around the mouth
  for (const sx of [-1.45, 1.45]) B.box('concrete', X0 + sx, 1.8, cz0 - 0.15, 0.5, 3.6, 0.4, 0, [0.7, 0.62, 0.52]);
  B.box('concrete', X0, 3.75, cz0 - 0.15, 3.6, 0.5, 0.45, 0, [0.7, 0.62, 0.52]);
  // side cliffs, irregular, open to the sky
  for (let z = 4; z > -330; z -= 11 + r() * 5) {
    for (const s of [-1, 1]) {
      const h = (z > -120 ? 34 : 48) + r() * 40, w = 18 + r() * 14, d = 13 + r() * 8;
      const x = X0 + s * (hw(z) + w / 2 - 2 + r() * 6);
      B.box('rock', x, h / 2 - 1, z, w, h, d, (r() - 0.5) * 0.5, ROCK.map((v) => v * (0.8 + r() * 0.25)), { uv: 9 });
      if (r() < 0.6) B.box('rock', x - s * w * 0.3, h + 3 - 1, z + (r() - 0.5) * 6, w * 0.6, 8 + r() * 10, d * 0.7, r() * 3, ROCK, { uv: 9, collide: false });
    }
  }
  // wall of rock far behind the statue, catching the golden light
  for (let x = X0 - 170; x < X0 + 170; x += 16 + r() * 8) {
    const h = 70 + r() * 60;
    B.box('rock', x, h / 2 - 1, -300 - r() * 25, 22 + r() * 10, h, 20, (r() - 0.5) * 0.4, ROCK.map((v) => v * 0.85), { uv: 10 });
  }
  // invisible limits of the walkable part (terrace side of the lake)
  for (const s of [-1, 1]) P.add(X0 + s * 92, 10, -55, 1, 20, 70);
  P.add(X0, 3, LAKE.z0 - 0.4, 120, 6, 0.3);                               // water's edge
  // stone path from the mouth to the terrace, diyas along it
  for (let z = -2; z > -84; z -= 2.6) {
    B.ground('concrete', X0 + (r() - 0.5) * 0.3, z, 2.6 + r() * 0.4, 2.2, (r() - 0.5) * 0.1, 0.03, [0.62, 0.58, 0.54], 2);
    if (Math.round(-z) % 13 < 3) for (const s of [-1, 1]) {
      B.cylinder('plain', X0 + s * 2.2, 0, z, 0.12, 0.08, rgb(0x9a5030), 6);
      W.fairy.push({ p: [X0 + s * 2.2, 0.16, z], c: 0xffb050, s: 0.3, diya: true });
    }
  }
  // rocks and boulders scattered on the floor for scale
  for (let i = 0; i < 70; i++) {
    const z = -6 - r() * 95, s = r() < 0.5 ? -1 : 1, x = X0 + s * (6 + r() * (hw(z) - 12));
    const sz = 0.6 + r() * r() * 5;
    B.box('rock', x, sz * 0.35, z, sz * (1 + r()), sz * 0.8, sz * (1 + r()), r() * 3, ROCK, { uv: 4, collide: sz > 1.2 });
  }
  // terrace + ghat steps down to the water
  B.ground('concrete', X0, -92, 70, 16, 0, 0.04, [0.68, 0.64, 0.6], 3);
  for (let i = 0; i < 5; i++) {
    const top = -0.16 * (i + 1), z = -100.8 - i * 1.6;
    B.box('concrete', X0, (top - 1.2) / 2, z, 120, top + 1.2, 1.6, 0, [0.62, 0.58, 0.54], { uv: 2 });
  }
  P.holes.push({ x0: X0 - 120, x1: X0 + 120, z0: LAKE.z0 - 0.5, z1: -100, maxY: 1 });
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { // stone lamp posts on the terrace
    const x = X0 + s * (6 + k * 8);
    B.box('concrete', x, 0.6, -99.4, 0.5, 1.2, 0.5, 0, [0.66, 0.6, 0.55]);
    W.fairy.push({ p: [x, 1.3, -99.4], c: 0xffb050, s: 0.35, diya: true });
  }
  W.lights.push({ x: X0, y: 2.5, z: -97, color: 0xffb060, intensity: 4, dist: 18, major: true });
  // the island: giant steps rising out of the lake (each one waist-high to a person)
  for (let i = 0; i < 6; i++) {
    const top = -0.3 + 0.55 * i, z = -140 - i * 2.4;
    B.box('concrete', X0, (top - 3) / 2, z, 50 - i * 3, top + 3, 2.4, 0, [0.6, 0.55, 0.5], { uv: 2 });
  }
  B.box('rock', X0, 0, -240, 300, 5, 180, 0, ROCK, { uv: 10, skip: ['bottom'] });   // plateau, top at y = 2.5
  B.box('concrete', X0, 2.6, -165, 46, 0.2, 18, 0, [0.62, 0.58, 0.54], { uv: 3 });  // forecourt
  B.box('concrete', X0, 2.6, STATUE.z + 23, 80, 0.2, 22, 0, [0.62, 0.58, 0.54], { uv: 3 });  // inner forecourt at the statue's feet
  // rock ridge in front of the statue's base: hides where the figure meets the ground
  for (let i = 0; i < 26; i++) {
    const x = X0 + (r() - 0.5) * 44, h = 2 + r() * 3.5, w = 3 + r() * 6;
    B.box('rock', x, 2.5 + h / 2 - 0.5, STATUE.z + 9 + r() * 6, w, h, 3 + r() * 4, r() * 2, ROCK.map((v) => v * 0.8), { uv: 4 });
  }
  // twin lamp pillars (deepstambh), 14 m — a person is a tenth of them
  for (const s of [-1, 1]) {
    const x = X0 + s * 17, z = STATUE.z + 22;
    B.cylinder('concrete', x, 2.5, z, 0.9, 14, [0.62, 0.56, 0.5], 12, { collide: true });
    for (let k = 1; k <= 6; k++) {
      B.cylinder('concrete', x, 2.5 + k * 2.2, z, 1.4, 0.18, [0.7, 0.62, 0.52], 12);
      for (let a = 0; a < 8; a++) W.fairy.push({ p: [x + Math.cos(a * 0.785) * 1.3, 2.5 + k * 2.2 + 0.35, z + Math.sin(a * 0.785) * 1.3], c: 0xffb040, s: 0.4, diya: true });
    }
    W.lights.push({ x, y: 12, z: z + 2, color: 0xffa040, intensity: 8, dist: 26, flicker: 1, major: true });
  }
  // a small shrine at the feet — about twice a person's height
  const sx = X0 + 8, sz = STATUE.z + 16;
  B.box('concrete', sx, 3.0, sz, 3.2, 1.0, 3.2, 0, [0.72, 0.66, 0.58]);
  B.box('plaster', sx, 4.6, sz, 2.4, 2.2, 2.4, 0, [0.9, 0.86, 0.78]);
  W.deferred.push((scene, mats) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3.2, 8), mats.shikhara); cone.position.set(sx, 7.3, sz); scene.add(cone);
  });
  W.fairy.push({ p: [sx, 4.2, sz + 1.25], c: 0xffc060, s: 0.35, diya: true });
  // trees on the island (10–12 m tall)
  for (const [dx, dz, s] of [[-26, 10, 2.1], [-35, -6, 2.4], [24, 12, 2.0], [33, -4, 2.5], [-45, 24, 1.8], [44, 22, 1.9], [-14, 30, 1.5], [15, 32, 1.6]]) W.props.trees.push({ p: [X0 + dx, 2.5, STATUE.z + dz], s, type: s > 2 ? 'peepal' : undefined });
  for (let i = 0; i < 10; i++) { const z = -20 - r() * 70; W.props.trees.push({ p: [X0 + (r() < 0.5 ? -1 : 1) * (18 + r() * (hw(z) - 26)), 0, z], s: 1.1 + r() * 0.6 }); }
  // golden light from behind the statue, spilling on rocks, trees and water
  for (const s of [-1, 1]) W.lights.push({ x: X0 + s * 40, y: 24, z: STATUE.z - 6, color: 0xffb040, intensity: 70, dist: 150, major: true, valley: true });
  W.lights.push({ x: X0, y: 5, z: STATUE.z + 14, color: 0xffc070, intensity: 22, dist: 70, major: true, valley: true });
  W.special.secret = { X0, statue: STATUE, lake: LAKE };
}

// The divine crate: a wooden chest bound in brass with a glowing ॐ, lid on a back hinge.
function omTexture() {
  const [c, x] = canvas(256, 256);
  x.fillStyle = '#5a3418'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '30,16,6' : '120,80,40'},0.25)`; x.fillRect(0, Math.random() * 256, 256, 1 + Math.random() * 3); }
  x.strokeStyle = '#d8a030'; x.lineWidth = 10; x.strokeRect(10, 10, 236, 236);
  x.fillStyle = '#ffd060'; x.shadowColor = '#ffb030'; x.shadowBlur = 24;
  x.font = 'bold 150px "Noto Sans Devanagari", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('ॐ', 128, 140);
  return tex(c);
}

// ====================== live part ======================
export class Secret {
  constructor(game) {
    this.g = game;
    this.mode = false; this.revealed = false; this.glowK = 0.2; this.underground = false;
    this.opened = false; this.lidT = 0;
    this.armed = false; this.lastZ = null;
    this.magicK = 0; this.magic = null; this.triggered = false;
    this.revealU = { value: 0 };
    this.crate = null;
  }

  build() {
    const g = this.g, scene = g.scene, W = g.W, A = g.assets;
    // ---- stencil mask over the open shaft (drawn first) ----
    const m = W.stairMask;
    const maskMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    maskMat.stencilWrite = true; maskMat.stencilRef = 1; maskMat.stencilFunc = THREE.AlwaysStencilFunc; maskMat.stencilZPass = THREE.ReplaceStencilOp;
    const mask = new THREE.Mesh(new THREE.PlaneGeometry(m.x1 - m.x0, m.z1 - m.z0).rotateX(-Math.PI / 2), maskMat);
    mask.position.set((m.x0 + m.x1) / 2, 0.06, (m.z0 + m.z1) / 2); mask.renderOrder = -100;
    scene.add(mask);
    // ---- the old wooden trapdoor over it ----
    const lid = this.lid = new THREE.Group();
    lid.position.set(C1.x0, 0.04, (m.z0 + m.z1) / 2);
    const wood = new THREE.MeshLambertMaterial({ map: g.tex.wood, color: 0xd8b48a, emissive: 0x1a1008 });
    const L = m.z1 - m.z0 + 0.25;
    for (let i = 0; i < 5; i++) { // planks with gaps
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, L), wood);
      p.position.set(0.24 + i * 0.44, 0.04, 0); lid.add(p);
    }
    for (const z of [-L / 2 + 0.4, 0, L / 2 - 0.4]) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.12), g.mats.dark); b.position.set(1.1, 0.1, z); lid.add(b); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.015, 6, 12), g.mats.dark); ring.rotation.x = Math.PI / 2; ring.position.set(1.95, 0.1, L / 2 - 0.6); lid.add(ring);
    // golden light leaking through the plank gaps — the only hint
    const leakMat = this.leakMat = new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.leak = new THREE.Group();
    for (let i = 1; i < 5; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.018, L - 0.3).rotateX(-Math.PI / 2), leakMat); s.position.set(0.02 + i * 0.44, 0.085, 0); this.leak.add(s); }
    lid.add(this.leak);
    scene.add(lid);
    this.lidBox = g.physics.add(C1.x0 + 1.1, 0.06, (m.z0 + m.z1) / 2, 1.1, 0.06, L / 2, 0, 'door');
    // ---- valley: statue, glows, haze, moon, lake ----
    const S = STATUE, X = X0;
    const src = A.shivji && (A.shivji.source || A.shivji.canvas);
    const sc = statueCanvases(src);
    const H = S.h, Wd = H * sc.aspect;
    const grp = this.statueGroup = new THREE.Group();
    grp.position.set(X, 0, S.z);
    scene.add(grp);
    const add = (mesh, z, y, order) => { mesh.position.set(0, y, z); mesh.renderOrder = order; grp.add(mesh); return mesh; };
    const T = (c) => tex(c);
    const additive = (map, color, opacity) => new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false });
    const baseY = 2.5 - 2.5;                                                 // base hidden by the rock ridge and mist
    this.layers = [];
    const k = H / 50;
    const L1 = add(new THREE.Mesh(new THREE.PlaneGeometry(150 * k, 170 * k), additive(coreTexture(), 0xffb058, 0.72)), -7, baseY + H * 0.56, 1);
    const L2 = add(new THREE.Mesh(new THREE.PlaneGeometry(240 * k, 240 * k), additive(raysTexture(), 0xffd090, 0.46)), -6, baseY + H * 0.6, 1);
    const L3 = add(new THREE.Mesh(new THREE.PlaneGeometry(30 * k, 320 * k), additive(columnTexture(), 0xffc070, 0.11)), -8, baseY + 165 * k, 1);
    // golden rim: light wrapping around the body from behind (follows the figure, not the picture)
    const L4 = add(new THREE.Mesh(new THREE.PlaneGeometry(Wd * 1.16, H * 1.08), additive(T(sc.rim), 0xffb060, 0.22)), -0.8, baseY + H / 2 + 1.2, 2);
    // the artwork already carries its own golden lighting: show it as painted (unlit),
    // the night haze (fog) still settles on it with distance
    const ft = T(sc.c); ft.anisotropy = 8;
    const statueMat = new THREE.MeshBasicMaterial({ map: ft, transparent: true, alphaTest: 0.03, depthWrite: true, toneMapped: false, color: 0xf2f0ec });
    // "out of thin air": the figure is drawn in by light from his feet up to his crown. uReveal 0 = not
    // there at all, 1 = whole. A grain of noise breaks the line and its edge burns gold.
    const RU = this.revealU;
    statueMat.onBeforeCompile = (sh) => {
      sh.uniforms.uReveal = RU;
      sh.fragmentShader = 'uniform float uReveal;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        float rn = fract(sin(dot(floor(vMapUv * vec2(70.0, 120.0)), vec2(12.9898, 78.233))) * 43758.5453);
        float rv = vMapUv.y * 0.82 + rn * 0.18;
        float rth = uReveal * 1.25 - 0.1;
        if (rv > rth) discard;
        float redge = smoothstep(rth - 0.07, rth, rv) * step(uReveal, 0.999);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.7, 1.25, 0.55), redge);`);
    };
    statueMat.customProgramCacheKey = () => 'shivReveal';
    const fig = add(new THREE.Mesh(reliefGeometry(Wd, H, sc.depth, 2.6 * H / 58), statueMat), 0, baseY + H / 2, 3);
    // mist in front of the base and across the lake
    const M1 = add(new THREE.Mesh(new THREE.PlaneGeometry(90 * k * 0.7, 16 * k * 0.7), additive(bandTexture(255, 190, 110), 0xffffff, 0.55)), 8, 5, 4);
    const M2 = add(new THREE.Mesh(new THREE.PlaneGeometry(240, 26), additive(bandTexture(120, 140, 200), 0xffffff, 0.16)), 40, 6, 4);
    // [mesh, opacity, belongs to the statue (hidden until he appears)]
    this.layers = [[L1, 0.72, true], [L2, 0.46, true], [L3, 0.11, true], [L4, 0.22, true], [M1, 0.55], [M2, 0.16]];
    this.rays = L2; this.fig = fig;
    // far golden horizon behind everything, lighting the back cliffs
    const hor = new THREE.Mesh(new THREE.PlaneGeometry(560, 170), additive(bandTexture(255, 170, 70), 0xffffff, 0.3));
    hor.position.set(X, 35, -285); hor.renderOrder = 0; scene.add(hor);
    this.layers.push([hor, 0.3]);
    const haze = new THREE.Mesh(new THREE.PlaneGeometry(260, 22), additive(bandTexture(110, 130, 190), 0xffffff, 0.12));
    haze.position.set(X, 6, -55); haze.renderOrder = 4; scene.add(haze);
    // the lake: dark water with a golden path of reflected light
    const water = new THREE.Mesh(new THREE.PlaneGeometry(300, LAKE.z0 - LAKE.z1 + 8).rotateX(-Math.PI / 2), new THREE.MeshPhongMaterial({ color: 0x050a12, specular: 0xffc070, shininess: 60 }));
    water.position.set(X, LAKE.y, (LAKE.z0 + LAKE.z1) / 2); scene.add(water);
    const glit = new THREE.Mesh(new THREE.PlaneGeometry(16, LAKE.z0 - LAKE.z1).rotateX(-Math.PI / 2), additive(columnTexture(), 0xffc070, 0.28));
    glit.rotation.y = Math.PI; glit.position.set(X, LAKE.y + 0.02, (LAKE.z0 + LAKE.z1) / 2); glit.renderOrder = 1; scene.add(glit);
    this.layers.push([glit, 0.28]);
    // half moon, up and to the left of Shivji
    const moon = this.halfMoon = new THREE.Sprite(new THREE.SpriteMaterial({ map: halfMoonTexture(), fog: false, depthWrite: false, toneMapped: false, color: 0xe8eeff }));
    moon.position.set(X - 300, 560, -600); moon.scale.setScalar(90); moon.renderOrder = 0;   // raised (and pushed back) to stay clear of the colossus, inside the 900 m sky dome
    scene.add(moon);
    // the appearance: a pillar of light and a blinding flash at the statue
    this.pillar = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true), additive(columnTexture(), 0xffd890, 0));
    this.pillar.material.side = THREE.DoubleSide; this.pillar.position.set(X, 0, S.z + 4); this.pillar.renderOrder = 5; this.pillar.visible = false; scene.add(this.pillar);
    this.burst = new THREE.Sprite(new THREE.SpriteMaterial({ map: g.tex.glow, color: 0xffe8b0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, transparent: true, opacity: 0 }));
    this.burst.position.set(X, H * 0.45, S.z + 10); this.burst.visible = false; this.burst.renderOrder = 6; scene.add(this.burst);
    this.statueH = H; this.statueW = Wd;
    this.buildCrate();
    this.setLayers(this.glowK);
    this.drone = null;
  }

  buildCrate() {
    const g = this.g, grp = new THREE.Group();
    const wood = new THREE.MeshLambertMaterial({ map: g.tex.wood, color: 0x9a6a40 }), brass = new THREE.MeshPhongMaterial({ color: 0xd4a020, emissive: 0x3a2800, shininess: 80 });
    const om = new THREE.MeshLambertMaterial({ map: omTexture(), emissive: 0xffb040, emissiveIntensity: 0.35, emissiveMap: null });
    const W = 1.5, H = 0.8, D = 1.0;
    const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [wood, wood, wood, wood, om, om]); body.position.y = H / 2; grp.add(body);
    for (const x of [-W / 2 + 0.12, W / 2 - 0.12]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, H + 0.02, D + 0.02), brass); b.position.set(x, H / 2, 0); grp.add(b); }
    const lid = this.crateLid = new THREE.Group(); lid.position.set(0, H, -D / 2); grp.add(lid);
    const top = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, 0.14, D + 0.04), [wood, wood, om, wood, wood, wood]); top.position.set(0, 0.07, D / 2); lid.add(top);
    for (const x of [-W / 2 + 0.12, W / 2 - 0.12]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, D + 0.06), brass); b.position.set(x, 0.07, D / 2); lid.add(b); }
    // the glow inside, seen when the lid opens
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.1, D - 0.1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd070, toneMapped: false }));
    inner.position.y = H - 0.02; grp.add(inner);
    this.crateGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: g.tex.glow, color: 0xffc860, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, transparent: true }));
    this.crateGlow.scale.setScalar(4); this.crateGlow.position.y = 0.7; grp.add(this.crateGlow);
    grp.visible = false;
    g.scene.add(grp);
    this.crate = grp;
    this.crateBox = g.physics.add(-2000, -50, 0, W / 2, H / 2, D / 2, 0, 'crate'); this.crateBox.enabled = false;
    this.crateLight = { x: 0, y: 1.6, z: 0, color: 0xffc060, intensity: 7, dist: 12, on: false, phase: 0, dynamic: true, major: true };
    g.W.lights.push(this.crateLight);
  }

  setLayers(k) { for (const [m, o, statue] of this.layers) m.material.opacity = o * k * (statue ? this.magicK : 1); }

  reset() {
    this.opened = false; this.lidT = 0; this.revealed = false; this.glowK = 0.2;
    this.armed = false; this.lastZ = null; this._musicIn = false; this.musicOn = false;
    // the valley is empty again until he appears
    this.triggered = false; this.magic = null; this.magicK = 0; this.revealU.value = 0;
    this.fig.visible = false; this.pillar.visible = false; this.burst.visible = false;
    this.crateState = 'none'; this.crate.visible = false; this.crateBox.enabled = false; this.crateLight.on = false; this.crateLid.rotation.x = 0;
    this.g.audio.fade('shivMusic', 0, 0);
    this.lid.rotation.z = 0; this.leak.visible = true; this.lidBox.enabled = true;
    this.setLayers(this.glowK);
    this.setMode(false);
    if (this.drone) { try { this.drone.stop(); } catch (e) { /* stopped */ } this.drone = null; }
  }

  // ---- interaction with the trapdoor ----
  consider(fn) {
    if (this.crateState === 'landed') { const c = this.crate.position; fn([c.x, 0.8, c.z], 2.8, { type: 'secret', what: 'crate' }); }
    if (this.opened) return;
    const m = this.g.W.stairMask, P = this.g.player.pos;
    fn([C1.x0 + 1.1, 0.15, clamp(P.z, m.z0 + 0.4, m.z1 - 0.4)], 2.6, { type: 'secret' });
  }
  prompt(t) { return t && t.what === 'crate' ? ['OPEN', 'दिव्य शस्त्र-पेटी · divine weapons crate'] : ['OPEN', 'पुराना तख़्ता · old trapdoor']; }
  use(t) {
    if (t && t.what === 'crate') return this.openCrate();
    if (this.opened) return;
    this.opened = true; this.lidBox.enabled = false; this.leak.visible = false;
    const a = this.g.audio;
    a.play('creak', { pos: [SX, 0.5, 22], vol: 0.9, rate: 0.6 });
    a.play('slam', { pos: [SX, 0.5, 22], vol: 0.6, delay: 0.7, rate: 0.7 });
  }

  // ---- valley look: open sky, deep blue haze, far view ----
  setMode(on) {
    const g = this.g;
    if (on === this.mode) return;
    this.mode = on;
    const fog = g.scene.fog;
    if (on) { fog.color.setHex(0x060a18); fog.density = 0.0024; }
    else { fog.color.setHex(0x0d1520); fog.density = 0.0165; }
    g.camera.far = on ? 950 : 170; g.camera.updateProjectionMatrix();
    g.sky.scale.setScalar(on ? 6 : 1); g.stars.scale.setScalar(on ? 6 : 1);
    g.sky.material.uniforms.hor.value.setHex(on ? 0x0c1630 : 0x1a2230);
    g.moon.visible = !on; this.halfMoon.visible = on;
  }

  update(dt) {
    const g = this.g, P = g.player;
    // trapdoor swings up against the courtyard wall
    if (!this.opened) this.leakMat.opacity = 0.2 + 0.12 * Math.sin(g.time * 1.3); // faint, breathing light
    if (this.opened && this.lidT < 1) { this.lidT = Math.min(1, this.lidT + dt * 0.8); const k = this.lidT; this.lid.rotation.z = 1.75 * k * k * (3 - 2 * k); }
    // seamless switch between the two copies of the tunnel, at the blind corner
    const p = P.pos;
    if (p.y < FLOOR_A + 3 && p.y > FLOOR_A - 1 && p.x < TRIG_A && p.x > C2.x0 - 1 && p.z > C2.z0 - 0.3 && p.z < C2.z1 + 0.3) this.shift(1);
    else if (p.y < 3 && p.y > -1 && p.x > TRIG_B + O.x && p.x < C1.x1 + O.x + 1 && p.z > C1.z0 - 0.3 && p.z < C1.z1 + 0.3 && p.x < -600) this.shift(-1);
    const inB = p.x < -600;
    this.underground = (p.y < -1 && p.x > -150 && p.x < -128 && p.z > 6 && p.z < 27) || (inB && p.z > -0.5 && p.z < 20);
    this.setMode(inB);
    // first time at the foot of the stairs, on the tunnel floor: the tunnel arms you (once per run)
    if (!this.armed && p.y < FLOOR_A + 1 && p.y > FLOOR_A - 1 && p.x > C1.x0 - 0.2 && p.x < C1.x1 + 0.2 && p.z < C1.z1 + 0.4 && p.z > C1.z0) this.arm();
    // the reveal: round the blind corner (about halfway through) and walking down the last
    // corridor toward the valley, Shivji's golden glow fills the mouth ahead
    this.lastZ = p.z;
    // the valley is empty when you walk out of the tunnel; a few steps onto the path and he appears
    if (inB && !this.triggered && p.z < -3.2) { this.triggered = true; this.magic = { t: 0, flashed: false, crate: false }; this.g.audio.play('magic', { vol: 0.9, verbAmt: 1.3 }); this.g.audio.play('bell', { vol: 0.35, rate: 0.5, verbAmt: 1.4 }); }
    if (this.magic) this.appear(dt);
    this.crateUpdate(dt);
    if (this.revealed && this.glowK < 1) { this.glowK = Math.min(1, this.glowK + dt / 5); this.setLayers(this.glowK * this.glowK * (3 - 2 * this.glowK)); }
    if (this.mode) {
      // keep the colossus turned toward the visitor (he never shows his edge)
      const sg = this.statueGroup;
      const yaw = clamp(Math.atan2(p.x - sg.position.x, p.z - sg.position.z), -0.32, 0.32);
      sg.rotation.y += (yaw - sg.rotation.y) * Math.min(1, dt * 2);
      this.rays.rotation.z += dt * 0.012;
      const t = g.time;
      this.layers[0][0].material.opacity = 0.72 * this.glowK * this.magicK * (0.94 + Math.sin(t * 0.7) * 0.06);
      // with the Shivji music loaded the drone sits underneath it; otherwise it carries the scene alone
      if (this.drone && this.drone.gain) this.drone.gain.gain.value = g.audio.hasTrack('shivMusic') ? 0.14 : 0.4;
    } else if (this.drone && this.drone.gain) this.drone.gain.gain.value = 0;
    // Shivji music: slow swell after the reveal, dips under a chase, fades out when you go back
    const music = this.mode && this.revealed && !P.dead ? (g.chaseOn ? 0.28 : 0.62) : 0;
    g.audio.fade('shivMusic', music, music > 0 ? (this._musicIn ? 2.5 : 9) : 3);
    this.musicOn = music > 0 && g.audio.hasTrack('shivMusic');     // footsteps are silent while it plays
    if (music > 0) this._musicIn = true; else if (!this.mode) this._musicIn = false;
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

  // The tunnel's gift: a rifle with spare magazines, given through the normal arsenal (once per run).
  arm() {
    this.armed = true;
    const g = this.g, A = g.arsenal, id = 'rifle', w = WEAPONS[id], extra = 60;
    const fresh = A.give(id);
    A.reserve[w.ammo] += extra;
    A.equip(id);
    g.feed(fresh ? '+ ' + w.name : `+${w.mag} ${AMMO[w.ammo]}`);
    g.feed(`+${extra} ${AMMO[w.ammo]}`);
    g.toast('सुरंग में राइफल मिली', `A ${w.en.toLowerCase()} and ${extra} spare rounds lie at the foot of the stairs.`);
    g.updateHud(true);
  }

  // ---- the appearance, out of thin air ----
  appear(dt) {
    const g = this.g, m = this.magic, X = g.explosives, S = STATUE, P = g.player.pos, H = this.statueH;
    m.t += dt;
    const t = m.t;
    // 1) gathering: golden motes swirl in toward the empty spot and a pillar of light grows (0 - 3 s)
    if (t < 3.6) {
      const n = Math.floor((m.acc = (m.acc || 0) + dt * 70)); m.acc -= n;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, r = 25 + Math.random() * 55, y = Math.random() * 60;
        const x = X0 + Math.cos(a) * r, z = S.z + 8 + Math.sin(a) * r * 0.6;
        X.fire.emit(x, y, z, -Math.cos(a) * r * 0.3 - Math.sin(a) * 9, 5 + Math.random() * 9, -Math.sin(a) * r * 0.18 + Math.cos(a) * 6, 2.4 + Math.random(), 3 + Math.random() * 3, 0.8, FIRE.gold, FIRE.white, 0.9, 1, 0.3);
      }
      // and a few right around the player, drifting toward him
      if (Math.random() < dt * 25) X.fire.emit(P.x + (Math.random() - 0.5) * 8, 0.2 + Math.random() * 2, P.z + (Math.random() - 0.5) * 8, 0, 0.6 + Math.random(), -2 - Math.random() * 3, 3, 0.18, 0.05, FIRE.gold, FIRE.white, 1, 0.3, 0.1);
      const k = clamp(t / 3, 0, 1);
      this.pillar.visible = true; this.pillar.scale.set(1 + k * 16, 900, 1 + k * 16); this.pillar.position.y = 0;
      this.pillar.material.opacity = 0.05 + k * 0.45;
      g.player.shake = Math.max(g.player.shake, 0.06 + k * 0.12);
    }
    // 2) the flash
    if (t >= 3 && !m.flashed) {
      m.flashed = true;
      const fl = document.getElementById('flash'); fl.classList.remove('show'); void fl.offsetWidth; fl.classList.add('show');
      g.audio.play('explosion', { vol: 0.7, rate: 0.42, verbAmt: 1.5, vary: 0 });
      g.audio.play('bell', { vol: 0.9, rate: 0.5, verbAmt: 1.6 });
      g.audio.play('bell', { vol: 0.5, rate: 0.75, verbAmt: 1.6, delay: 1.4 });
      g.player.shake = Math.max(g.player.shake, 0.7);
      this.burst.visible = true;
      this.fig.visible = true;
      this.revealed = true;                       // the Shivji music and drone start now
      if (!this.drone) this.drone = g.audio.loop('drone', 0.4, g.audio.sfx);
    }
    if (m.flashed) {
      const k = t - 3;
      this.burst.scale.setScalar(80 + k * 420); this.burst.material.opacity = Math.max(0, 1 - k / 1.6);
      if (k > 1.6) this.burst.visible = false;
      // 3) he is drawn in by light, feet to crown (5 s), the glow behind him rising with it
      const u = clamp(k / 5, 0, 1);
      this.revealU.value = u * u * (3 - 2 * u);
      this.magicK = clamp(k / 4, 0, 1);
      this.setLayers(this.glowK * this.glowK * (3 - 2 * this.glowK));
      this.pillar.material.opacity = Math.max(0, 0.5 - k * 0.12);
      if (this.pillar.material.opacity <= 0) this.pillar.visible = false;
      // sparks along the line where the figure is appearing
      if (u < 1) {
        const ey = clamp((this.revealU.value * 1.25 - 0.1) / 0.82, 0, 1) * H;
        for (let i = 0; i < 4; i++) X.fire.emit(X0 + (Math.random() - 0.5) * this.statueW * 0.55, ey, S.z + 6, (Math.random() - 0.5) * 6, 2 + Math.random() * 6, 3, 1.2 + Math.random(), 4 + Math.random() * 4, 1, FIRE.white, FIRE.gold, 1, -2, 0.3);
      }
    }
    // 4) a gift falls from the sky in front of you
    if (t > 8.6 && !m.crate) {
      m.crate = true;
      g.banner('हर हर महादेव', 'SHIVJI HAS APPEARED · A GIFT FALLS FROM THE SKY', 'divine');
      this.dropCrate();
    }
    if (t > 11) this.magic = null;
  }

  dropCrate() {
    const P = this.g.player.pos;
    let z = clamp(P.z - 8, -80, -10);
    if (Math.abs(z - P.z) < 3) z = clamp(P.z - 4, -80, -8);
    this.crateAt = { x: X0, z };
    this.crateState = 'falling'; this.crateT = 0;
    this.crate.visible = true; this.crate.position.set(X0, 60, z); this.crate.rotation.set(0, 0.35, 0);
    this.crateLid.rotation.x = 0;
  }

  crateUpdate(dt) {
    const g = this.g, c = this.crate, X = g.explosives;
    if (this.crateState === 'falling') {
      this.crateT += dt;
      const k = clamp(this.crateT / 1.5, 0, 1);
      c.position.y = 60 * (1 - k * k);
      c.rotation.y = 0.35 + (1 - k) * 3;
      X.fire.emit(c.position.x + (Math.random() - 0.5), c.position.y + 1, c.position.z + (Math.random() - 0.5), 0, 2, 0, 1.2, 1.2, 0.3, FIRE.gold, FIRE.white, 0.9);
      if (k >= 1) {
        this.crateState = 'landed';
        const A = this.crateAt;
        g.audio.play('bang', { pos: [A.x, 0.5, A.z], vol: 1, rate: 0.7 }); g.audio.play('slam', { pos: [A.x, 0.5, A.z], vol: 0.8, rate: 0.6 });
        g.player.shake = Math.max(g.player.shake, 0.5);
        for (let i = 0; i < 24; i++) { const a = i / 24 * 6.28; X.smoke.emit(A.x, 0.3, A.z, Math.cos(a) * 4, 0.5, Math.sin(a) * 4, 1.6, 0.6, 2.4, [0.5, 0.47, 0.42], [0.4, 0.38, 0.35], 0.45, 0.2, 2); }
        for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, sp = 2 + Math.random() * 5; X.fire.emit(A.x, 0.6, A.z, Math.cos(a) * sp, 2 + Math.random() * 5, Math.sin(a) * sp, 1 + Math.random(), 0.35, 0.08, FIRE.gold, FIRE.white, 1, -5, 0.5); }
        g.physics.update(this.crateBox, A.x, 0.4, A.z, 0.35); this.crateBox.enabled = true;
        Object.assign(this.crateLight, { x: A.x, y: 1.6, z: A.z, on: true });
        g.toast('दिव्य शस्त्र-पेटी', g.input.touch ? 'A divine weapons crate — walk up and press USE.' : 'A divine weapons crate — walk up and press E.');
      }
    } else if (this.crateState === 'landed' || this.crateState === 'opened') {
      const t = g.time, open = this.crateState === 'opened';
      this.crateGlow.material.opacity = open ? Math.max(0, this.crateGlow.material.opacity - dt * 0.4) : 0.55 + Math.sin(t * 3) * 0.2;
      if (!open && Math.random() < dt * 8) X.fire.emit(c.position.x + (Math.random() - 0.5) * 1.4, 0.9, c.position.z + (Math.random() - 0.5) * 0.9, 0, 0.8 + Math.random(), 0, 1.5, 0.12, 0.04, FIRE.gold, FIRE.white, 1, 0.2, 0.2);
      if (open && this.crateLid.rotation.x > -1.9) this.crateLid.rotation.x = Math.max(-1.9, this.crateLid.rotation.x - dt * 5);
    }
  }

  // Shivji's gift: three guns, ammunition, and a rocket launcher with five rockets.
  openCrate() {
    if (this.crateState !== 'landed') return;
    this.crateState = 'opened';
    const g = this.g, A = g.arsenal, c = this.crate.position;
    g.audio.play('creak', { pos: [c.x, 0.8, c.z], vol: 0.8, rate: 1.3 }); g.audio.play('magic', { vol: 0.5, rate: 1.4 });
    for (let i = 0; i < 50; i++) { const a = Math.random() * 6.28, sp = 1 + Math.random() * 3; g.explosives.fire.emit(c.x, 0.9, c.z, Math.cos(a) * sp, 3 + Math.random() * 5, Math.sin(a) * sp, 1.4 + Math.random(), 0.3, 0.06, FIRE.gold, FIRE.white, 1, -3, 0.6); }
    const gifts = [['pistol', 24], ['revolver', 12], ['dunali', 10]];
    for (const [id, n] of gifts) {
      const w = WEAPONS[id], fresh = A.give(id);
      A.reserve[w.ammo] += n;
      g.feed(fresh ? '+ ' + w.name : `+${w.mag} ${AMMO[w.ammo]}`); g.feed(`+${n} ${AMMO[w.ammo]}`);
    }
    A.reserve['7.62'] += 60; g.feed(`+60 ${AMMO['7.62']}`);
    const fresh = A.give('rpg');
    A.reserve.rocket += 4;                           // one in the tube + four spare = five rockets
    A.equip('rpg');
    g.feed(fresh ? '+ ' + WEAPONS.rpg.name : '+ ' + AMMO.rocket); g.feed('+5 ' + AMMO.rocket);
    g.stats.supplies += 5;
    g.toast('शिवजी का आशीर्वाद', 'Pistol, revolver, double barrel, rifle rounds — and a ROCKET LAUNCHER with 5 rockets.');
    g.updateHud(true);
  }


}
