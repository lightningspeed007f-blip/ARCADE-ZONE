// User-replaceable assets. Drop files into laststand/assets/ with these names
// (any of .jpg .jpeg .png .webp works for images). Missing files fall back to
// painted placeholders, so the game always runs.
import * as THREE from 'three';
import { FONT_HI } from './textures.js';

export const ASSET_ROOT = 'laststand/assets/';
export const MANIFEST = {
  shivji: 'shivji',                                   // transparent PNG preferred
  kamakhya: 'kamakhya',                               // temple image / logo
  photos: Array.from({ length: 15 }, (_, i) => 'photos/photo' + String(i + 1).padStart(2, '0')),
  banners: Array.from({ length: 5 }, (_, i) => 'banners/banner' + String(i + 1).padStart(2, '0')),
  gunSounds: { pistol: 'pistol', revolver: 'revolver', dunali: 'shotgun', rifle: 'rifle', rifle_reload_out: 'rifle_reload_out', rifle_reload_in: 'rifle_reload_in' }, // sounds/<file> -> sound key
  songs: Array.from({ length: 6 }, (_, i) => 'music/song' + String(i + 1).padStart(2, '0') + '.mp3'),
  // the user's zombie / Shivji audio: sound key -> folder + accepted file names (first match wins)
  userAudio: {
    zombieChase:  { dir: 'sounds/', names: ['zombiechase', 'zombie chase', 'zombie_chase'], loop: true },          // zombies on your heels
    zombieByeBye: { dir: 'sounds/', names: ['zombie bye bye', 'zombiebyebye', 'zombie_bye_bye'] },                // a zombie kills you
    zombieScream: { dir: 'sounds/', names: ['zombie scream', 'zombiescream', 'zombie_scream'] },                  // far-off screams
    shivMusic:    { dir: 'music/', names: ['Shiv Ji background music', 'shiv ji background music', 'shivji_music'], loop: true }, // the Shivdham reveal
  },
  userAudioExts: ['.mp3', '.m4a', '.wav', '.ogg'],
};
const EXTS = ['.png', '.jpg', '.jpeg', '.webp'];

function loadImage(base) {
  return new Promise((resolve) => {
    let k = 0;
    const tryNext = () => {
      if (k >= EXTS.length) return resolve(null);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => { k++; tryNext(); };
      img.src = ASSET_ROOT + base + EXTS[k];
    };
    tryNext();
  });
}

function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d', { willReadFrequently: true })]; }
function tex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

// Resize big uploads so phones don't run out of GPU memory.
function fitCanvas(img, maxSide) {
  const k = Math.min(1, maxSide / Math.max(img.width, img.height));
  const [c, x] = cv(Math.max(1, Math.round(img.width * k)), Math.max(1, Math.round(img.height * k)));
  x.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

// ---------- Shivji: keep details, remove the background, never distort ----------
export function processShivji(img) {
  const c = fitCanvas(img, 1536);
  const x = c.getContext('2d', { willReadFrequently: true });
  const W = c.width, H = c.height;
  const data = x.getImageData(0, 0, W, H);
  const d = data.data;
  // already transparent?
  let transparent = 0;
  for (let i = 3; i < d.length; i += 4 * 7) if (d[i] < 240) transparent++;
  if (transparent / (d.length / 28) > 0.02) return { canvas: c, mode: 'alpha' };
  // sample border colour
  const border = [];
  const push = (px, py) => { const i = (py * W + px) * 4; border.push([d[i], d[i + 1], d[i + 2]]); };
  for (let px = 0; px < W; px += 3) { push(px, 0); push(px, H - 1); }
  for (let py = 0; py < H; py += 3) { push(0, py); push(W - 1, py); }
  const med = [0, 1, 2].map((ch) => border.map((b) => b[ch]).sort((a, b) => a - b)[border.length >> 1]);
  let spread = 0;
  for (const b of border) spread += Math.abs(b[0] - med[0]) + Math.abs(b[1] - med[1]) + Math.abs(b[2] - med[2]);
  spread /= border.length;
  const alpha = new Float32Array(W * H).fill(1);
  if (spread < 45) {
    // plain background: flood-fill from the edges through pixels close to the background colour
    const tol = Math.max(38, spread * 2.4);
    const diff = (i) => { const j = i * 4; return Math.abs(d[j] - med[0]) + Math.abs(d[j + 1] - med[1]) + Math.abs(d[j + 2] - med[2]); };
    const seen = new Uint8Array(W * H);
    const stack = [];
    for (let px = 0; px < W; px++) { stack.push(px, (H - 1) * W + px); }
    for (let py = 0; py < H; py++) { stack.push(py * W, py * W + W - 1); }
    while (stack.length) {
      const i = stack.pop();
      if (seen[i]) continue;
      seen[i] = 1;
      const df = diff(i);
      if (df > tol * 1.6) continue;
      alpha[i] = df < tol ? 0 : (df - tol) / (tol * 0.6);
      if (df >= tol) continue;
      const px = i % W, py = (i / W) | 0;
      if (px > 0) stack.push(i - 1); if (px < W - 1) stack.push(i + 1);
      if (py > 0) stack.push(i - W); if (py < H - 1) stack.push(i + W);
    }
  } else {
    // busy photo background: soft arched shrine mask instead of a hard rectangle
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const u = (px / W - 0.5) * 2, v = py / H;
      const archTop = 0.28;
      let a;
      if (v < archTop) { const vy = (archTop - v) / archTop; a = 1 - Math.hypot(u, vy); }
      else a = 1 - Math.abs(u);
      const bottom = (1 - v) / 0.06;
      alpha[py * W + px] = Math.max(0, Math.min(1, a / 0.12, bottom));
    }
  }
  // feather the mask (two box-blur passes)
  const tmp = new Float32Array(W * H);
  for (let pass = 0; pass < 2; pass++) {
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      let s = 0, n = 0;
      for (let k = -2; k <= 2; k++) { const q = px + k; if (q >= 0 && q < W) { s += alpha[py * W + q]; n++; } }
      tmp[py * W + px] = s / n;
    }
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      let s = 0, n = 0;
      for (let k = -2; k <= 2; k++) { const q = py + k; if (q >= 0 && q < H) { s += tmp[q * W + px]; n++; } }
      alpha[py * W + px] = s / n;
    }
  }
  for (let i = 0; i < W * H; i++) d[i * 4 + 3] = Math.round(Math.min(alpha[i], d[i * 4 + 3] / 255) * 255);
  x.putImageData(data, 0, 0);
  return { canvas: c, mode: spread < 45 ? 'keyed' : 'arch' };
}

// ---------- placeholders ----------
function phPhoto(i) {
  const [c, x] = cv(384, 512);
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#d9c7a4'); g.addColorStop(1, '#8a7356');
  x.fillStyle = g; x.fillRect(0, 0, 384, 512);
  x.fillStyle = 'rgba(60,40,25,0.55)';
  const n = 1 + (i % 3);
  for (let k = 0; k < n; k++) {
    const cx = 384 * (k + 1) / (n + 1);
    x.beginPath(); x.arc(cx, 200, 42, 0, 7); x.fill();
    x.beginPath(); x.ellipse(cx, 380, 70, 130, 0, 0, 7); x.fill();
  }
  x.fillStyle = 'rgba(40,25,15,0.7)'; x.font = `bold 30px ${FONT_HI}`; x.textAlign = 'center';
  x.fillText('photo' + String(i + 1).padStart(2, '0'), 192, 490);
  return c;
}
function phBanner(i) {
  const [c, x] = cv(1200, 400);
  const cols = [['#c2185b', '#ffd54f'], ['#1565c0', '#fff'], ['#e65100', '#fff8e1'], ['#2e7d32', '#ffeb3b'], ['#6a1b9a', '#fff']][i % 5];
  const g = x.createLinearGradient(0, 0, 1200, 400);
  g.addColorStop(0, cols[0]); g.addColorStop(1, '#111');
  x.fillStyle = g; x.fillRect(0, 0, 1200, 400);
  x.fillStyle = cols[1]; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `bold 110px ${FONT_HI}`;
  x.fillText(['हार्दिक शुभकामनाएं', 'शुभ विवाह', 'जन्मदिन मुबारक', 'भव्य जागरण', 'स्वागत है'][i % 5], 600, 170);
  x.font = 'bold 44px Arial'; x.fillText('banner' + String(i + 1).padStart(2, '0') + ' — your image here', 600, 320);
  return c;
}
function phShiv() {
  const [c, x] = cv(768, 1152);
  x.clearRect(0, 0, 768, 1152);
  // crescent + trishul + damru silhouette with Om
  x.fillStyle = 'rgba(210,230,255,0.95)';
  x.strokeStyle = 'rgba(210,230,255,0.95)'; x.lineWidth = 18; x.lineCap = 'round';
  x.beginPath(); x.moveTo(384, 1080); x.lineTo(384, 240); x.stroke();
  x.beginPath(); x.moveTo(270, 200); x.quadraticCurveTo(290, 330, 384, 340); x.quadraticCurveTo(478, 330, 498, 200); x.stroke();
  x.beginPath(); x.moveTo(384, 340); x.lineTo(384, 150); x.stroke();
  x.beginPath(); x.moveTo(360, 170); x.lineTo(384, 110); x.lineTo(408, 170); x.fill();
  x.beginPath(); x.moveTo(250, 220); x.lineTo(270, 160); x.lineTo(292, 220); x.fill();
  x.beginPath(); x.moveTo(476, 220); x.lineTo(498, 160); x.lineTo(518, 220); x.fill();
  x.beginPath(); x.moveTo(330, 470); x.lineTo(438, 560); x.lineTo(438, 470); x.lineTo(330, 560); x.closePath(); x.fill();
  x.beginPath(); x.arc(384, 700, 120, Math.PI * 0.15, Math.PI * 0.85, true); x.lineWidth = 26; x.stroke();
  x.font = `bold 150px ${FONT_HI}`; x.textAlign = 'center'; x.fillText('ॐ', 384, 900);
  x.font = `bold 64px ${FONT_HI}`; x.fillText('ॐ नमः शिवाय', 384, 1040);
  return c;
}
function phKamakhya() {
  const [c, x] = cv(512, 512);
  const g = x.createRadialGradient(256, 256, 20, 256, 256, 300);
  g.addColorStop(0, '#ff6a2a'); g.addColorStop(1, '#7a0a0a');
  x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  x.strokeStyle = '#ffd36a'; x.lineWidth = 10; x.strokeRect(14, 14, 484, 484);
  x.fillStyle = '#ffe9a8'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `bold 170px ${FONT_HI}`; x.fillText('ॐ', 256, 210);
  x.font = `bold 52px ${FONT_HI}`; x.fillText('जय माँ कामाख्या', 256, 390);
  return c;
}

// Blurred copy used for the soft bloom layer.
export function blurred(canvas, factor = 16) {
  const [s, sx] = cv(Math.max(4, canvas.width / factor | 0), Math.max(4, canvas.height / factor | 0));
  sx.drawImage(canvas, 0, 0, s.width, s.height);
  const [m, mx] = cv(Math.max(8, canvas.width / 4 | 0), Math.max(8, canvas.height / 4 | 0));
  mx.imageSmoothingQuality = 'high';
  mx.drawImage(s, 0, 0, m.width, m.height);
  return m;
}

export async function loadUserAssets(onProgress) {
  const out = { photos: [], banners: [], shivji: null, kamakhya: null, report: { found: [], missing: [] } };
  let done = 0; const total = 2 + MANIFEST.photos.length + MANIFEST.banners.length;
  const tick = () => onProgress && onProgress(++done / total);
  const note = (name, ok) => (ok ? out.report.found : out.report.missing).push(name);
  const jobs = [];
  jobs.push(loadImage(MANIFEST.shivji).then((img) => {
    note('shivji', !!img);
    const p = img ? processShivji(img) : { canvas: phShiv(), mode: 'placeholder' };
    out.shivji = { canvas: p.canvas, mode: p.mode, texture: tex(p.canvas), glow: tex(blurred(p.canvas)), aspect: p.canvas.width / p.canvas.height, source: img || p.canvas };
    tick();
  }));
  jobs.push(loadImage(MANIFEST.kamakhya).then((img) => {
    note('kamakhya', !!img);
    const c = img ? fitCanvas(img, 1024) : phKamakhya();
    out.kamakhya = { texture: tex(c), aspect: c.width / c.height }; tick();
  }));
  MANIFEST.photos.forEach((p, i) => jobs.push(loadImage(p).then((img) => {
    note(p, !!img);
    const c = img ? fitCanvas(img, 768) : phPhoto(i);
    out.photos[i] = { texture: tex(c), aspect: c.width / c.height }; tick();
  })));
  MANIFEST.banners.forEach((p, i) => jobs.push(loadImage(p).then((img) => {
    note(p, !!img);
    const c = img ? fitCanvas(img, 1600) : phBanner(i);
    out.banners[i] = { texture: tex(c), aspect: c.width / c.height }; tick();
  })));
  await Promise.all(jobs);
  return out;
}

// Set texture repeat/offset so the image COVERS a w x h rectangle without stretching.
export function coverFit(t, imgAspect, w, h) {
  const a = w / h;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  if (imgAspect > a) { const k = a / imgAspect; t.repeat.set(k, 1); t.offset.set((1 - k) / 2, 0); }
  else { const k = imgAspect / a; t.repeat.set(1, k); t.offset.set(0, (1 - k) / 2); }
  t.needsUpdate = true;
}
