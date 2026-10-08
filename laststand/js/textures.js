// Procedural textures drawn on canvases at load time.
// Nothing here comes from map imagery: every surface is painted in code.
import * as THREE from 'three';
import { makeRng } from './util.js';

const R = makeRng(7771);
const HINDI = '"Noto Sans Devanagari", "Kohinoor Devanagari", "Devanagari Sangam MN", "Mangal", sans-serif';
export const FONT_HI = HINDI;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTex(c, repeat = true, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// Draw something that wraps across canvas edges so the texture tiles.
function wrapDraw(ctx, w, h, x, y, r, fn) {
  for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
    if (x + ox + r < 0 || x + ox - r > w || y + oy + r < 0 || y + oy - r > h) continue;
    fn(x + ox, y + oy);
  }
}

function speckle(ctx, w, h, n, colors, rmin, rmax, alpha) {
  for (let i = 0; i < n; i++) {
    const x = R() * w, y = R() * h, r = rmin + R() * (rmax - rmin);
    ctx.globalAlpha = alpha * (0.4 + R() * 0.6);
    ctx.fillStyle = colors[(R() * colors.length) | 0];
    wrapDraw(ctx, w, h, x, y, r, (px, py) => { ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill(); });
  }
  ctx.globalAlpha = 1;
}

function blotches(ctx, w, h, n, color, rmin, rmax, alpha) {
  for (let i = 0; i < n; i++) {
    const x = R() * w, y = R() * h, r = rmin + R() * (rmax - rmin);
    wrapDraw(ctx, w, h, x, y, r, (px, py) => {
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, color.replace('A', alpha * (0.5 + R() * 0.5)));
      g.addColorStop(1, color.replace('A', 0));
      ctx.fillStyle = g;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }
}

// ---------- tiling surfaces ----------

function plaster() {
  const [c, x] = canvas(512, 512);
  x.fillStyle = '#e9e5dc'; x.fillRect(0, 0, 512, 512);
  blotches(x, 512, 512, 40, 'rgba(120,110,95,A)', 30, 120, 0.12);
  blotches(x, 512, 512, 14, 'rgba(70,75,60,A)', 20, 70, 0.14);
  speckle(x, 512, 512, 3000, ['#d6d0c4', '#f6f3ec', '#bdb5a6'], 0.5, 1.8, 0.5);
  // rain streaks
  for (let i = 0; i < 26; i++) {
    const sx = R() * 512, len = 60 + R() * 200;
    const g = x.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, 'rgba(60,55,45,0.18)'); g.addColorStop(1, 'rgba(60,55,45,0)');
    x.fillStyle = g; x.fillRect(sx, R() * 300, 2 + R() * 5, len);
  }
  // hairline cracks
  x.strokeStyle = 'rgba(80,70,60,0.35)'; x.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    let px = R() * 512, py = R() * 512; x.beginPath(); x.moveTo(px, py);
    for (let k = 0; k < 6; k++) { px += (R() - 0.5) * 40; py += R() * 30; x.lineTo(px, py); }
    x.stroke();
  }
  return toTex(c);
}

function brick() {
  const [c, x] = canvas(512, 512);
  x.fillStyle = '#7d756c'; x.fillRect(0, 0, 512, 512);
  const bh = 512 / 16, bw = 512 / 4;
  for (let row = 0; row < 16; row++) {
    const off = (row % 2) * bw / 2;
    for (let col = -1; col < 5; col++) {
      const r = 140 + R() * 50, g = 62 + R() * 30, b = 45 + R() * 20;
      x.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      x.fillRect(col * bw + off + 2, row * bh + 2, bw - 4, bh - 4);
      x.globalAlpha = 0.25; x.fillStyle = R() < 0.5 ? '#2b1a12' : '#e0b090';
      x.fillRect(col * bw + off + 2 + R() * bw * 0.6, row * bh + 2 + R() * 10, 10 + R() * 30, 4 + R() * 8);
      x.globalAlpha = 1;
    }
  }
  speckle(x, 512, 512, 1500, ['#3a2a20', '#c09070'], 0.5, 1.6, 0.4);
  blotches(x, 512, 512, 12, 'rgba(30,30,25,A)', 40, 120, 0.25);
  return toTex(c);
}

function asphalt() {
  const [c, x] = canvas(512, 512);
  x.fillStyle = '#4a4a4c'; x.fillRect(0, 0, 512, 512);
  speckle(x, 512, 512, 9000, ['#2f2f31', '#6a6a6a', '#575553', '#3a3836'], 0.6, 1.8, 0.8);
  blotches(x, 512, 512, 18, 'rgba(25,25,25,A)', 30, 110, 0.35);
  blotches(x, 512, 512, 10, 'rgba(120,105,85,A)', 30, 90, 0.25); // dust
  // patch repairs
  for (let i = 0; i < 5; i++) {
    x.fillStyle = `rgba(30,30,32,${0.4 + R() * 0.3})`;
    const px = R() * 440, py = R() * 440;
    x.beginPath(); x.moveTo(px, py);
    for (let k = 0; k < 7; k++) x.lineTo(px + R() * 70, py + R() * 70);
    x.fill();
  }
  x.strokeStyle = 'rgba(15,15,15,0.6)'; x.lineWidth = 1.2;
  for (let i = 0; i < 10; i++) {
    let px = R() * 512, py = R() * 512; x.beginPath(); x.moveTo(px, py);
    for (let k = 0; k < 8; k++) { px += (R() - 0.5) * 30; py += (R() - 0.5) * 30; x.lineTo(px, py); }
    x.stroke();
  }
  return toTex(c);
}

function dirt() {
  const [c, x] = canvas(512, 512);
  x.fillStyle = '#6e604c'; x.fillRect(0, 0, 512, 512);
  blotches(x, 512, 512, 40, 'rgba(90,80,60,A)', 30, 100, 0.5);
  blotches(x, 512, 512, 25, 'rgba(50,60,35,A)', 20, 80, 0.35); // dry grass tufts
  speckle(x, 512, 512, 8000, ['#8a7a60', '#4c4234', '#a09078', '#5a5a40'], 0.5, 2, 0.7);
  for (let i = 0; i < 200; i++) { // pebbles
    x.fillStyle = R() < 0.5 ? '#9a9088' : '#3d3830';
    const px = R() * 512, py = R() * 512;
    x.beginPath(); x.ellipse(px, py, 1 + R() * 3, 1 + R() * 2, R() * 3, 0, 7); x.fill();
  }
  return toTex(c);
}

// "Khadanja": brick-paved lane, very common in UP towns.
function khadanja() {
  const [c, x] = canvas(512, 512);
  x.fillStyle = '#5a4a40'; x.fillRect(0, 0, 512, 512);
  const n = 16, s = 512 / n;
  for (let r = 0; r < n; r++) for (let k = 0; k < n / 2; k++) {
    const herring = (r + k) % 2;
    const v = 105 + R() * 45;
    x.fillStyle = `rgb(${v | 0},${(v * 0.55) | 0},${(v * 0.42) | 0})`;
    if (herring) x.fillRect(k * s * 2 + 2, r * s + 2, s * 2 - 4, s - 4);
    else { x.fillRect(k * s * 2 + 2, r * s + 2, s - 4, s - 4); x.fillRect(k * s * 2 + s + 2, r * s + 2, s - 4, s - 4); }
  }
  blotches(x, 512, 512, 30, 'rgba(60,55,45,A)', 30, 90, 0.5);
  speckle(x, 512, 512, 3000, ['#3a2d25', '#9a8a70'], 0.5, 1.5, 0.5);
  return toTex(c);
}

function tile() {
  const [c, x] = canvas(512, 512);
  x.fillStyle = '#b8b2a8'; x.fillRect(0, 0, 512, 512);
  speckle(x, 512, 512, 14000, ['#8a8478', '#d8d2c6', '#6a6458', '#a85a48', '#f0ece0'], 0.6, 2.2, 0.9); // terrazzo chips
  x.strokeStyle = 'rgba(60,55,50,0.6)'; x.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    x.beginPath(); x.moveTo(i * 128, 0); x.lineTo(i * 128, 512); x.stroke();
    x.beginPath(); x.moveTo(0, i * 128); x.lineTo(512, i * 128); x.stroke();
  }
  blotches(x, 512, 512, 10, 'rgba(70,60,45,A)', 40, 120, 0.2);
  return toTex(c);
}

function concrete() {
  const [c, x] = canvas(256, 256);
  x.fillStyle = '#9a968e'; x.fillRect(0, 0, 256, 256);
  speckle(x, 256, 256, 3000, ['#7a766e', '#b8b4aa', '#6a665e'], 0.5, 1.5, 0.6);
  blotches(x, 256, 256, 12, 'rgba(50,48,40,A)', 20, 60, 0.3);
  return toTex(c);
}

function wood() {
  const [c, x] = canvas(256, 256);
  x.fillStyle = '#7a5434'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    x.strokeStyle = `rgba(${40 + R() * 40},${25 + R() * 20},10,${0.2 + R() * 0.4})`;
    x.lineWidth = 0.5 + R() * 2;
    const y = R() * 256;
    x.beginPath(); x.moveTo(0, y);
    for (let k = 0; k <= 8; k++) x.lineTo(k * 32, y + Math.sin(k + i) * 3);
    x.stroke();
  }
  return toTex(c);
}

function metal() {
  const [c, x] = canvas(256, 256);
  x.fillStyle = '#8b8f94'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 32; i++) {
    const g = x.createLinearGradient(0, i * 8, 0, i * 8 + 8);
    g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(0.5, 'rgba(0,0,0,0.15)'); g.addColorStop(1, 'rgba(255,255,255,0.1)');
    x.fillStyle = g; x.fillRect(0, i * 8, 256, 8);
  }
  blotches(x, 256, 256, 18, 'rgba(120,60,20,A)', 10, 50, 0.45); // rust
  return toTex(c);
}

function fabric() {
  const [c, x] = canvas(128, 128);
  x.fillStyle = '#ddd'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 128; i += 4) { x.fillStyle = 'rgba(0,0,0,0.08)'; x.fillRect(i, 0, 2, 128); x.fillRect(0, i, 128, 2); }
  blotches(x, 128, 128, 8, 'rgba(60,40,30,A)', 10, 30, 0.3);
  return toTex(c);
}

// Grime used on zombie clothes / skin
function grime() {
  const [c, x] = canvas(128, 128);
  x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 128);
  blotches(x, 128, 128, 14, 'rgba(70,20,15,A)', 6, 26, 0.7);
  blotches(x, 128, 128, 10, 'rgba(40,40,30,A)', 8, 30, 0.5);
  speckle(x, 128, 128, 300, ['#888', '#552'], 0.4, 1.2, 0.5);
  return toTex(c);
}

// ---------- facade atlas: 4x4 bays of a North-Indian street wall ----------
// Each cell is one 3 m wide x 3.2 m tall bay. Walls are painted near-white so
// per-building vertex colours tint them; frames/shutters keep their own colour.
export const FACADE = {
  PLAIN: 0, WIN_SHUT: 1, WIN_GRILLE: 2, WIN_LIT: 3, DOOR: 4, SHUTTER: 5, SHUTTER_HALF: 6, SHOP_LIT: 7,
  BRICK: 8, BRICK_WIN: 9, POSTERS: 10, PAINTED_AD: 11, PLAIN2: 12, VENT: 13, BALC_DOOR: 14, GATE: 15,
};

function facadeAtlas() {
  const S = 512, N = 4;
  const [c, x] = canvas(S * N, S * N);
  const [e, ex] = canvas(S * N, S * N);
  ex.fillStyle = '#000'; ex.fillRect(0, 0, S * N, S * N);
  const ads = ['सीमेंट', 'जनरल स्टोर', 'मोबाइल रिचार्ज', 'ट्यूशन सेंटर', 'साइकिल रिपेयर', 'टेलर्स'];

  const wallBase = (ox, oy) => {
    x.fillStyle = '#efebe3'; x.fillRect(ox, oy, S, S);
    x.save(); x.beginPath(); x.rect(ox, oy, S, S); x.clip();
    for (let i = 0; i < 6; i++) {
      const g = x.createRadialGradient(ox + R() * S, oy + R() * S, 0, ox + R() * S, oy + R() * S, 80 + R() * 160);
      g.addColorStop(0, 'rgba(90,80,65,0.16)'); g.addColorStop(1, 'rgba(90,80,65,0)');
      x.fillStyle = g; x.fillRect(ox, oy, S, S);
    }
    for (let i = 0; i < 14; i++) {
      const g = x.createLinearGradient(0, oy, 0, oy + S);
      g.addColorStop(0, 'rgba(50,45,35,0.22)'); g.addColorStop(1, 'rgba(50,45,35,0)');
      x.fillStyle = g; x.fillRect(ox + R() * S, oy, 2 + R() * 6, 80 + R() * 240);
    }
    // bottom damp line
    const g = x.createLinearGradient(0, oy + S - 90, 0, oy + S);
    g.addColorStop(0, 'rgba(40,40,30,0)'); g.addColorStop(1, 'rgba(40,40,30,0.35)');
    x.fillStyle = g; x.fillRect(ox, oy + S - 90, S, 90);
    // floor band
    x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(ox, oy, S, 14);
    x.restore();
  };
  const windowAt = (ox, oy, type) => {
    const wx = ox + 136, wy = oy + 120, ww = 240, wh = 230;
    x.fillStyle = '#5b4a3a'; x.fillRect(wx - 14, wy - 14, ww + 28, wh + 28); // frame
    x.fillStyle = '#c9c3b8'; x.fillRect(wx - 30, wy - 40, ww + 60, 22); // chhajja
    x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(wx - 30, wy - 18, ww + 60, 10);
    if (type === 'shut') {
      x.fillStyle = '#4f7a5e';
      x.fillRect(wx, wy, ww / 2 - 3, wh); x.fillRect(wx + ww / 2 + 3, wy, ww / 2 - 3, wh);
      x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 3;
      for (let i = 1; i < 8; i++) { x.beginPath(); x.moveTo(wx, wy + i * wh / 8); x.lineTo(wx + ww, wy + i * wh / 8); x.stroke(); }
    } else {
      const lit = type === 'lit';
      const g = x.createLinearGradient(0, wy, 0, wy + wh);
      g.addColorStop(0, lit ? '#e8c27a' : '#1a1c22'); g.addColorStop(1, lit ? '#a8743a' : '#0c0d10');
      x.fillStyle = g; x.fillRect(wx, wy, ww, wh);
      if (lit) {
        const eg = ex.createRadialGradient(wx + ww / 2, wy + wh / 2, 10, wx + ww / 2, wy + wh / 2, 170);
        eg.addColorStop(0, '#ffd890'); eg.addColorStop(1, '#a86a20');
        ex.fillStyle = eg; ex.fillRect(wx, wy, ww, wh);
        // curtain silhouette
        x.fillStyle = 'rgba(160,40,60,0.6)'; x.fillRect(wx, wy, 60, wh);
        ex.fillStyle = 'rgba(80,10,20,1)'; ex.fillRect(wx, wy, 60, wh);
      }
    }
    // iron grille
    x.strokeStyle = '#2a2a2a'; x.lineWidth = 6;
    for (let i = 1; i < 6; i++) { x.beginPath(); x.moveTo(wx + i * ww / 6, wy); x.lineTo(wx + i * ww / 6, wy + wh); x.stroke(); }
    x.lineWidth = 4; x.beginPath(); x.moveTo(wx, wy + wh / 2); x.lineTo(wx + ww, wy + wh / 2); x.stroke();
    ex.strokeStyle = '#000'; ex.lineWidth = 6;
    for (let i = 1; i < 6; i++) { ex.beginPath(); ex.moveTo(wx + i * ww / 6, wy); ex.lineTo(wx + i * ww / 6, wy + wh); ex.stroke(); }
  };
  const shutter = (ox, oy, open, lit) => {
    const sx = ox + 30, sy = oy + 110, sw = S - 60, sh = S - 110;
    x.fillStyle = '#2b2b2b'; x.fillRect(sx - 8, sy - 8, sw + 16, sh + 8);
    const top = open ? sy + sh * 0.55 : sy;
    if (open || lit) {
      const g = x.createLinearGradient(0, sy, 0, sy + sh);
      g.addColorStop(0, lit ? '#f2dca0' : '#15161a'); g.addColorStop(1, lit ? '#8a6a3a' : '#08090a');
      x.fillStyle = g; x.fillRect(sx, sy, sw, sh);
      // shelves with goods
      for (let s = 0; s < 4; s++) {
        x.fillStyle = 'rgba(60,40,20,0.8)'; x.fillRect(sx + 10, sy + 30 + s * 90, sw - 20, 8);
        for (let k = 0; k < 14; k++) {
          x.fillStyle = `hsl(${R() * 360},60%,${lit ? 50 : 15}%)`;
          x.fillRect(sx + 16 + k * 30, sy + 30 + s * 90 - 30 - R() * 20, 22, 30 + R() * 10);
        }
      }
      if (lit) {
        const eg = ex.createLinearGradient(0, sy, 0, sy + sh);
        eg.addColorStop(0, '#fff0c0'); eg.addColorStop(1, '#704a10');
        ex.fillStyle = eg; ex.fillRect(sx, sy, sw, sh);
      }
    }
    if (!lit) {
      const g = x.createLinearGradient(0, top, 0, sy + sh);
      x.fillStyle = '#7d8288'; x.fillRect(sx, open ? sy : top, sw, open ? sh * 0.55 : sh);
      for (let i = 0; i < (open ? 14 : 26); i++) {
        x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(sx, sy + i * 15, sw, 4);
        x.fillStyle = 'rgba(255,255,255,0.1)'; x.fillRect(sx, sy + i * 15 + 5, sw, 3);
      }
      g.addColorStop(0, 'rgba(110,50,20,0)'); g.addColorStop(1, 'rgba(110,50,20,0.45)');
      x.fillStyle = g; x.fillRect(sx, sy, sw, open ? sh * 0.55 : sh);
      if (!open) { x.fillStyle = '#c8a040'; x.fillRect(ox + S / 2 - 12, sy + sh - 40, 24, 30); }
    }
  };

  for (let i = 0; i < 16; i++) {
    const ox = (i % N) * S, oy = Math.floor(i / N) * S;
    if (i === FACADE.BRICK || i === FACADE.BRICK_WIN) {
      for (let row = 0; row < 32; row++) for (let col = -1; col < 9; col++) {
        const v = 120 + R() * 50;
        x.fillStyle = `rgb(${v | 0},${(v * 0.48) | 0},${(v * 0.36) | 0})`;
        x.fillRect(ox + col * 64 + (row % 2) * 32 + 2, oy + row * 16 + 2, 60, 12);
      }
      x.fillStyle = 'rgba(80,80,70,0.25)';
      for (let k = 0; k < 4; k++) x.fillRect(ox + R() * S, oy + R() * S, 80, 60);
      if (i === FACADE.BRICK_WIN) { x.fillStyle = '#121214'; x.fillRect(ox + 200, oy + 170, 110, 110); }
      continue;
    }
    wallBase(ox, oy);
    if (i === FACADE.WIN_SHUT) windowAt(ox, oy, 'shut');
    if (i === FACADE.WIN_GRILLE) windowAt(ox, oy, 'dark');
    if (i === FACADE.WIN_LIT) windowAt(ox, oy, 'lit');
    if (i === FACADE.DOOR || i === FACADE.GATE) {
      const dx = ox + 150, dy = oy + 90, dw = 210, dh = S - 90;
      x.fillStyle = '#4a3a2c'; x.fillRect(dx - 16, dy - 16, dw + 32, dh + 16);
      if (i === FACADE.DOOR) {
        x.fillStyle = R() < 0.5 ? '#6a4024' : '#3d5a78'; x.fillRect(dx, dy, dw, dh);
        x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(dx + dw / 2 - 2, dy, 4, dh);
        for (let k = 0; k < 3; k++) { x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 3; x.strokeRect(dx + 14, dy + 20 + k * 130, dw / 2 - 28, 110); x.strokeRect(dx + dw / 2 + 14, dy + 20 + k * 130, dw / 2 - 28, 110); }
        // swastik / shubh-labh style marks are left out; a simple painted toran line instead
        x.fillStyle = '#d04020'; for (let k = 0; k < 9; k++) { x.beginPath(); x.moveTo(dx + k * 26, dy - 14); x.lineTo(dx + k * 26 + 13, dy + 6); x.lineTo(dx + k * 26 + 26, dy - 14); x.fill(); }
      } else {
        x.fillStyle = '#0c0c0e'; x.fillRect(dx, dy, dw, dh);
        x.strokeStyle = '#3a4a3a'; x.lineWidth = 7;
        for (let k = 0; k < 9; k++) { x.beginPath(); x.moveTo(dx + k * dw / 8, dy); x.lineTo(dx + k * dw / 8, dy + dh); x.stroke(); }
        x.beginPath(); x.moveTo(dx, dy + 40); x.lineTo(dx + dw, dy + 40); x.stroke();
      }
    }
    if (i === FACADE.SHUTTER) shutter(ox, oy, false, false);
    if (i === FACADE.SHUTTER_HALF) shutter(ox, oy, true, false);
    if (i === FACADE.SHOP_LIT) shutter(ox, oy, true, true);
    if (i === FACADE.POSTERS) {
      for (let k = 0; k < 7; k++) {
        const pw = 80 + R() * 90, ph = 110 + R() * 70, px = ox + 20 + R() * (S - pw - 40), py = oy + 140 + R() * 200;
        x.save(); x.translate(px, py); x.rotate((R() - 0.5) * 0.12);
        x.fillStyle = `hsl(${R() * 360},55%,${45 + R() * 25}%)`; x.fillRect(0, 0, pw, ph);
        x.fillStyle = 'rgba(255,255,255,0.8)'; x.font = `bold 26px ${HINDI}`;
        x.fillText(['रैली', 'भंडारा', 'जागरण', 'कोचिंग', 'मेला'][k % 5], 8, 36);
        x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(8, 50, pw - 16, ph * 0.4);
        if (R() < 0.5) { x.fillStyle = 'rgba(230,225,215,0.9)'; x.fillRect(pw * 0.4, ph * 0.5, pw * 0.6, ph * 0.5); } // torn
        x.restore();
      }
    }
    if (i === FACADE.PAINTED_AD) {
      x.fillStyle = '#c23b22'; x.fillRect(ox + 20, oy + 150, S - 40, 220);
      x.fillStyle = '#fff6d8'; x.font = `bold 72px ${HINDI}`; x.textAlign = 'center';
      x.fillText(ads[(R() * ads.length) | 0], ox + S / 2, oy + 260);
      x.font = `bold 40px ${HINDI}`; x.fillText('मो. 94••• ••••', ox + S / 2, oy + 330);
      x.textAlign = 'left';
      x.fillStyle = 'rgba(230,225,215,0.5)'; for (let k = 0; k < 20; k++) x.fillRect(ox + 20 + R() * (S - 60), oy + 150 + R() * 200, 20, 10);
    }
    if (i === FACADE.VENT) {
      x.fillStyle = '#3a3a3c'; x.fillRect(ox + 200, oy + 120, 120, 80);
      x.fillStyle = '#20232a'; for (let k = 0; k < 5; k++) x.fillRect(ox + 205, oy + 126 + k * 15, 110, 8);
      x.strokeStyle = '#222'; x.lineWidth = 3; x.beginPath(); x.moveTo(ox + 260, oy + 200); x.lineTo(ox + 260, oy + S); x.stroke(); // pipe
    }
    if (i === FACADE.BALC_DOOR) {
      const dx = ox + 150, dy = oy + 100;
      x.fillStyle = '#4a3a2c'; x.fillRect(dx - 12, dy - 12, 236, S - dy + oy + 12);
      x.fillStyle = '#5a7088'; x.fillRect(dx, dy, 212, S - 100);
      x.fillStyle = '#1a1c22'; x.fillRect(dx + 20, dy + 20, 172, 150);
    }
  }
  const t = toTex(c, false); const te = toTex(e, false);
  return { map: t, emissive: te };
}

// ---------- sign atlas: shop boards, road signs, station boards ----------
// Each sign gets a rectangle in one big canvas; callers receive UV rects.
export class SignAtlas {
  constructor(size = 2048) {
    [this.c, this.x] = canvas(size, size);
    this.size = size; this.cx = 0; this.cy = 0; this.rowH = 0;
    this.x.fillStyle = '#000'; this.x.fillRect(0, 0, size, size);
    this.texture = null;
  }
  // w/h in pixels; draw(ctx, w, h) paints into a translated context.
  alloc(w, h, draw) {
    if (this.cx + w > this.size) { this.cx = 0; this.cy += this.rowH + 4; this.rowH = 0; }
    if (this.cy + h > this.size) { console.warn('sign atlas full'); return { u0: 0, v0: 0, u1: 0.01, v1: 0.01 }; }
    const x = this.cx, y = this.cy;
    this.x.save(); this.x.translate(x, y); this.x.beginPath(); this.x.rect(0, 0, w, h); this.x.clip();
    draw(this.x, w, h); this.x.restore();
    this.cx += w + 4; this.rowH = Math.max(this.rowH, h);
    const s = this.size;
    return { u0: x / s, v0: 1 - (y + h) / s, u1: (x + w) / s, v1: 1 - y / s };
  }
  // Common Indian shop board: bright flex with Hindi and English lines.
  board(hi, en, bg = '#c8102e', fg = '#fff', w = 512, h = 128, sub = '') {
    return this.alloc(w, h, (x, W, H) => {
      const g = x.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, bg); g.addColorStop(1, shade(bg, -0.35));
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.strokeStyle = fg; x.globalAlpha = 0.5; x.lineWidth = 4; x.strokeRect(6, 6, W - 12, H - 12); x.globalAlpha = 1;
      x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
      const hasEn = !!en;
      x.font = `bold ${Math.round(H * (hasEn ? 0.42 : 0.6))}px ${HINDI}`;
      fitText(x, hi, W / 2, H * (hasEn ? 0.38 : 0.52), W - 30);
      if (hasEn) { x.font = `bold ${Math.round(H * 0.22)}px "Rajdhani", Arial, sans-serif`; fitText(x, en, W / 2, H * 0.78, W - 30); }
      if (sub) { x.font = `${Math.round(H * 0.14)}px Arial`; x.globalAlpha = 0.8; x.fillText(sub, W / 2, H * 0.93); x.globalAlpha = 1; }
      // weathering
      for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(0,0,0,${R() * 0.15})`; x.fillRect(R() * W, R() * H, 4 + R() * 30, 2 + R() * 10); }
    });
  }
  // Indian Railways style yellow station board (Hindi / English / Urdu-less simple).
  station(hi, en, code) {
    this.cache = this.cache || {};
    const k = 'st|' + hi + en;
    if (this.cache[k]) return this.cache[k];
    return (this.cache[k] = this.alloc(640, 214, (x, W, H) => {
      x.fillStyle = '#1a1a1a'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#f2c81e'; x.fillRect(10, 10, W - 20, H - 20);
      x.fillStyle = '#111'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = `bold 78px ${HINDI}`; fitText(x, hi, W / 2, 72, W - 50);
      x.font = 'bold 54px Arial, sans-serif'; fitText(x, en, W / 2, 152, W - 50);
      if (code) { x.font = 'bold 22px Arial'; x.textAlign = 'right'; x.fillText(code, W - 20, H - 20); }
    }));
  }
  // Green road direction board
  road(lines, bg = '#1d6b3a') {
    return this.alloc(512, 256, (x, W, H) => {
      x.fillStyle = '#eee'; x.fillRect(0, 0, W, H);
      x.fillStyle = bg; x.fillRect(8, 8, W - 16, H - 16);
      x.fillStyle = '#fff'; x.textBaseline = 'middle';
      const lh = (H - 30) / lines.length;
      lines.forEach((l, i) => {
        x.textAlign = 'left'; x.font = `bold ${Math.round(lh * 0.5)}px ${HINDI}`;
        fitText(x, l[0], 30, 20 + lh * (i + 0.5), W - 140, 'left');
        if (l[1]) { x.textAlign = 'right'; x.font = `bold ${Math.round(lh * 0.55)}px Arial`; x.fillText(l[1], W - 24, 20 + lh * (i + 0.5)); }
      });
    });
  }
  finish() {
    this.texture = toTex(this.c, false);
    this.texture.anisotropy = 8;
    return this.texture;
  }
}

function fitText(x, s, cx, cy, maxW, align) {
  const m = x.measureText(s).width;
  if (m > maxW) {
    x.save(); x.translate(cx, cy); x.scale(maxW / m, 1);
    x.fillText(s, align === 'left' ? 0 : 0, 0); x.restore();
  } else x.fillText(s, cx, cy);
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + v * amt)));
  return `rgb(${f(n >> 16 & 255)},${f(n >> 8 & 255)},${f(n & 255)})`;
}

// Soft round glow used for lamps, halos, muzzle flash.
export function glowTexture(inner = 'rgba(255,240,200,1)', outer = 'rgba(255,180,80,0)') {
  const [c, x] = canvas(128, 128);
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner); g.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.5)')); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return toTex(c, false);
}

// Light pool painted on the ground under a lamp (additive decal).
export function poolTexture() {
  const [c, x] = canvas(128, 128);
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.4, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return toTex(c, false, false);
}

// Halo for the Shivji display: warm core, faint rays, cool rim.
function haloTexture() {
  const [c, x] = canvas(512, 512);
  const g = x.createRadialGradient(256, 256, 0, 256, 256, 256);
  g.addColorStop(0, 'rgba(255,250,235,0.95)'); g.addColorStop(0.18, 'rgba(255,225,170,0.6)');
  g.addColorStop(0.45, 'rgba(170,200,255,0.18)'); g.addColorStop(1, 'rgba(120,150,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const len = 150 + (i % 3) * 50;
    const rg = x.createLinearGradient(256, 256, 256 + Math.cos(a) * len, 256 + Math.sin(a) * len);
    rg.addColorStop(0, 'rgba(255,235,190,0.10)'); rg.addColorStop(1, 'rgba(255,235,190,0)');
    x.strokeStyle = rg; x.lineWidth = 6;
    x.beginPath(); x.moveTo(256, 256); x.lineTo(256 + Math.cos(a) * len, 256 + Math.sin(a) * len); x.stroke();
  }
  return toTex(c, false);
}

function beamTexture() {
  const [c, x] = canvas(64, 256);
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 256);
  const h = x.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
  x.globalCompositeOperation = 'destination-out'; x.fillStyle = h; x.fillRect(0, 0, 64, 256);
  return toTex(c, false);
}

// Bullet hole decal
function holeTexture() {
  const [c, x] = canvas(64, 64);
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(10,8,6,1)'); g.addColorStop(0.25, 'rgba(25,20,15,0.95)'); g.addColorStop(0.5, 'rgba(60,50,40,0.5)'); g.addColorStop(1, 'rgba(60,50,40,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return toTex(c, false);
}

export function buildTextures() {
  const fac = facadeAtlas();
  return {
    plaster: plaster(), brick: brick(), asphalt: asphalt(), dirt: dirt(), khadanja: khadanja(),
    tile: tile(), concrete: concrete(), wood: wood(), metal: metal(), fabric: fabric(), grime: grime(),
    facade: fac.map, facadeEmissive: fac.emissive,
    glow: glowTexture(), pool: poolTexture(), halo: haloTexture(), beam: beamTexture(), hole: holeTexture(),
  };
}
