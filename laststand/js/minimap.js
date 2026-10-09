// Town map: one static picture of Jais is painted once, then the corner
// minimap shows a rotating window of it around the player, and the full
// map shows all of it with landmarks and the current objective.
import { ROADS, RAIL, BOUNDS, KAMAKHYA, NAUGAZI } from './layout.js';

const PX = 2; // pixels per metre in the static picture
const HI = '"Noto Sans Devanagari", sans-serif';

export const LANDMARKS = [
  { hi: 'वहाबगंज', en: 'Wahabganj', x: -90, z: -9 },
  { hi: 'माँ कामाख्या मंदिर', en: 'Kamakhya Mandir', x: KAMAKHYA.temple.x, z: KAMAKHYA.temple.z, icon: 'temple' },
  { hi: 'आलिया मार्केट', en: 'Alia Market', x: -160, z: 50 },
  { hi: 'कुआँ', en: 'Well', x: KAMAKHYA.well.x + 3, z: KAMAKHYA.well.z + 6, icon: 'well' },
  { hi: 'नौगजी तिराहा', en: 'Naugazi', x: NAUGAZI[0] + 16, z: NAUGAZI[1] + 2 },
  { hi: 'बस अड्डा', en: 'Bus Adda', x: 90, z: 118, icon: 'bus' },
  { hi: 'जायस सिटी स्टेशन', en: 'Jais City Stn', x: -140, z: -186, icon: 'train' },
  { hi: 'गुरु गोरखनाथ धाम', en: 'Guru Gorakhnath Dham', x: 139, z: -190, icon: 'train' },
  { hi: 'रेलवे फाटक', en: 'Crossing', x: 18, z: -168 },
  { hi: 'स्टेशन रोड', en: 'Station Road', x: 56, z: -134 },
  { hi: 'स्कूल', en: 'School', x: 45, z: -76 },
];

export class TownMap {
  constructor(W) {
    this.W = W;
    this.build();
  }

  build() {
    const W = this.W;
    this.revealed = false;
    const w = (BOUNDS.maxX - BOUNDS.minX) * PX, h = (BOUNDS.maxZ - BOUNDS.minZ) * PX;
    const c = this.base = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.scale(PX, PX); x.translate(-BOUNDS.minX, -BOUNDS.minZ);
    // ground
    x.fillStyle = '#1c2026'; x.fillRect(BOUNDS.minX, BOUNDS.minZ, w, h);
    // buildings (every reserved footprint that is not a road)
    x.fillStyle = '#39404a';
    for (const r of W.rects) {
      if (r.hz > 40 || r.hx > 40) continue; // roads and long strips
      x.save(); x.translate(r.x, r.z); x.rotate(-r.yaw); x.fillRect(-r.hx, -r.hz, r.hx * 2, r.hz * 2); x.restore();
    }
    // enterable buildings slightly warmer so you can spot them
    x.fillStyle = '#5a4a36';
    for (const b of W.buildings) {
      if (!b.tpl) continue;
      x.save(); const [cx, cz] = b.F.p(0, b.d / 2); x.translate(cx, cz); x.rotate(-b.F.yaw); x.fillRect(-b.w / 2, -b.d / 2, b.w, b.d); x.restore();
    }
    // roads
    x.lineCap = 'round';
    for (const r of Object.values(ROADS)) {
      x.strokeStyle = r.s === 'lane' ? '#8a6a4e' : '#c9c2b2'; x.lineWidth = r.w * (r.s === 'lane' ? 0.85 : 0.9);
      x.beginPath(); x.moveTo(r.a[0], r.a[1]); x.lineTo(r.b[0], r.b[1]); x.stroke();
    }
    // railway
    x.strokeStyle = '#6d7480'; x.lineWidth = 3.4; x.beginPath(); x.moveTo(RAIL.x0, RAIL.mainZ); x.lineTo(RAIL.x1, RAIL.mainZ); x.stroke();
    x.strokeStyle = '#1c2026'; x.lineWidth = 1.4; x.setLineDash([2, 2]); x.beginPath(); x.moveTo(RAIL.x0, RAIL.mainZ); x.lineTo(RAIL.x1, RAIL.mainZ); x.stroke(); x.setLineDash([]);
    x.strokeStyle = '#6d7480'; x.lineWidth = 2.6; x.beginPath(); x.moveTo(86, RAIL.loopZ); x.lineTo(192, RAIL.loopZ); x.stroke();
    // platforms
    x.fillStyle = '#8c8577';
    x.fillRect(RAIL.jaisCity.x0, RAIL.mainZ + 1.8, RAIL.jaisCity.x1 - RAIL.jaisCity.x0, 12);
    x.fillRect(RAIL.ggd.x0, RAIL.loopZ + 1.8, RAIL.ggd.x1 - RAIL.ggd.x0, 10);
    this.bx = x;
    // house markers: one dot per house you can walk into. A couple are left off on purpose and
    // only appear once you get close, so the town keeps a few secrets.
    this.hidden = new Set(['abandoned2', 'e2house']);
    this.dots = [];
    for (const b of W.buildings) {
      if (!b.tpl || ['jaisCity', 'ggd', 'cabin'].includes(b.name)) continue;
      const [cx, cz] = b.F.p(0, b.d / 2);
      const dot = { name: b.name, x: cx, z: cz, shown: false };
      this.dots.push(dot);
      if (!this.hidden.has(b.name)) this.paintDot(dot);
    }
    // temple compound in saffron
    const T = KAMAKHYA.temple;
    x.fillStyle = '#b8641c'; x.fillRect(T.x - T.w / 2, T.z - T.d / 2, T.w, T.d);
    x.fillStyle = '#f0a040'; x.fillRect(T.x - 3, T.z - 3, 6, 7);
    // well
    x.fillStyle = '#3a6a9a'; x.beginPath(); x.arc(KAMAKHYA.well.x, KAMAKHYA.well.z, 2.2, 0, 7); x.fill();
  }

  paintDot(d) {
    const x = this.bx; d.shown = true;
    x.save();
    x.fillStyle = '#ffcf5a'; x.strokeStyle = '#2a1a08'; x.lineWidth = 0.9;
    x.beginPath(); x.arc(d.x, d.z, 2.7, 0, Math.PI * 2); x.fill(); x.stroke();
    x.restore();
  }

  // Reveal a secret house's dot once the player is near it (or inside it).
  discover(px, pz) {
    for (const d of this.dots) if (!d.shown && Math.hypot(d.x - px, d.z - pz) < 10) { this.paintDot(d); this.revealed = true; }
  }

  // Objective markers for the current state of the run.
  targets(game) {
    const o = game.obj, S = this.W.special, out = [];
    if (!o) return out;
    if (o.signal) out.push({ x: 140, z: -164, label: 'प्लेटफ़ॉर्म 1', en: 'Platform 1' });
    else if (o.key && o.fuse) { const p = S.signalPanel; out.push({ x: p[0], z: p[2], label: 'सिग्नल केबिन', en: 'Signal cabin' }); }
    const B = game.boss;
    if (B && B.awake && !B.dead) out.push({ x: B.pos.x, z: B.pos.z, label: 'लोहासुर', en: 'Lohasur', boss: true });
    return out;
  }

  // ---------- corner minimap: rotates so "up" is where you are looking ----------
  drawMini(ctx, size, game) {
    const P = game.player, r = size / 2, view = 70; // metres across
    const k = size / view;
    ctx.save();
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath(); ctx.arc(r, r, r - 1, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#1c2026'; ctx.fillRect(0, 0, size, size);
    ctx.translate(r, r);
    ctx.rotate(P.yaw);
    ctx.scale(k / PX, k / PX);
    ctx.translate(-(P.pos.x - BOUNDS.minX) * PX, -(P.pos.z - BOUNDS.minZ) * PX);
    ctx.globalAlpha = 0.95;
    ctx.drawImage(this.base, 0, 0);
    ctx.restore();
    // objective markers (clamped to the rim when far away)
    for (const t of this.targets(game)) {
      const dx = t.x - P.pos.x, dz = t.z - P.pos.z;
      // same rotation as the map: the view direction points up
      const c = Math.cos(P.yaw), s = Math.sin(P.yaw);
      let sx = (dx * c - dz * s) * k, sy = (dx * s + dz * c) * k;
      const d = Math.hypot(sx, sy), lim = r - 9;
      if (d > lim) { sx *= lim / d; sy *= lim / d; }
      marker(ctx, r + sx, r + sy, t.boss ? 6 : 5, t.boss);
    }
    // the jeep (when you are not in it)
    const V = game.vehicles;
    if (V && V.car && !V.driving) {
      const dx = V.car.x - P.pos.x, dz = V.car.z - P.pos.z, c = Math.cos(P.yaw), s = Math.sin(P.yaw);
      const sx = (dx * c - dz * s) * k, sy = (dx * s + dz * c) * k;
      if (Math.hypot(sx, sy) < r - 6) jeepMark(ctx, r + sx, r + sy, 4);
    }
    // player arrow (always points up)
    ctx.save(); ctx.translate(r, r);
    ctx.fillStyle = '#ffd36a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // north (world -z) marked on the rim
    const ax = r + Math.sin(P.yaw) * (r - 8), ay = r - Math.cos(P.yaw) * (r - 8);
    ctx.fillStyle = '#e8b04a'; ctx.font = 'bold 11px Rajdhani, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('N', ax, ay);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(r, r, r - 1, 0, Math.PI * 2); ctx.stroke();
  }

  // ---------- full map ----------
  drawFull(c, game) {
    const W = BOUNDS.maxX - BOUNDS.minX, H = BOUNDS.maxZ - BOUNDS.minZ;
    const s = Math.min((innerWidth - 32) / W, (innerHeight - 70) / H);
    const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = Math.round(W * s * dpr); c.height = Math.round(H * s * dpr);
    c.style.width = Math.round(W * s) + 'px'; c.style.height = Math.round(H * s) + 'px';
    const x = c.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.drawImage(this.base, 0, 0, c.width, c.height);
    const k = s * dpr;
    const P = (wx, wz) => [(wx - BOUNDS.minX) * k, (wz - BOUNDS.minZ) * k];
    // labels
    x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const L of LANDMARKS) {
      const [px, py] = P(L.x, L.z);
      x.font = `700 ${Math.round(12 * dpr)}px ${HI}`;
      x.lineWidth = 3 * dpr; x.strokeStyle = 'rgba(0,0,0,0.85)'; x.strokeText(L.hi, px, py);
      x.fillStyle = L.icon === 'temple' ? '#ffb35a' : '#f2ead8'; x.fillText(L.hi, px, py);
      x.font = `600 ${Math.round(9 * dpr)}px Rajdhani, sans-serif`;
      x.strokeText(L.en.toUpperCase(), px, py + 12 * dpr); x.fillStyle = '#b9b2a2'; x.fillText(L.en.toUpperCase(), px, py + 12 * dpr);
    }
    // objective
    for (const t of this.targets(game)) { const [px, py] = P(t.x, t.z); marker(x, px, py, 8 * dpr, t.boss); }
    const V = game.vehicles;
    if (V && V.car && !V.driving) { const [jx, jy] = P(V.car.x, V.car.z); jeepMark(x, jx, jy, 6 * dpr); }
    // player
    const pl = game.player;
    const [px, py] = P(pl.pos.x, pl.pos.z);
    x.save(); x.translate(px, py); x.rotate(-pl.yaw);
    x.fillStyle = '#ffd36a'; x.strokeStyle = '#000'; x.lineWidth = 2 * dpr;
    const a = 9 * dpr;
    x.beginPath(); x.moveTo(0, -a); x.lineTo(a * 0.7, a * 0.7); x.lineTo(0, a * 0.35); x.lineTo(-a * 0.7, a * 0.7); x.closePath(); x.fill(); x.stroke();
    x.restore();
    // compass
    x.fillStyle = '#e8b04a'; x.font = `700 ${Math.round(14 * dpr)}px Rajdhani, sans-serif`; x.fillText('N ↑', 24 * dpr, 18 * dpr);
  }
}

function jeepMark(ctx, x, y, r) {
  ctx.save();
  ctx.fillStyle = '#7fc97a'; ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(1, r * 0.3);
  ctx.fillRect(x - r, y - r * 0.6, r * 2, r * 1.2); ctx.strokeRect(x - r, y - r * 0.6, r * 2, r * 1.2);
  ctx.restore();
}

function marker(ctx, x, y, r, boss) {
  ctx.save();
  ctx.fillStyle = boss ? '#8a0000' : '#ff4a3a'; ctx.strokeStyle = boss ? '#ff6a40' : '#fff'; ctx.lineWidth = Math.max(1.5, r * 0.3);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
