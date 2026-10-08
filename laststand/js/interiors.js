// Enterable buildings: shells, partitions, stairs, furniture and the
// spots where loot, containers, photo frames and radios go.
// All templates work in a local frame: x across the frontage (-w/2..w/2),
// z from the front wall (0) to the back (d), y up. The front faces the road.
import { rgb } from './util.js';

export const FH = 3.2;      // floor height
export const WT = 0.2;      // wall thickness

const PAINTS = [0xbfd9e6, 0xd9e8c4, 0xf0d2d8, 0xf2e6c4, 0xe6e6e0, 0xc9d8f0, 0xf4dcb4, 0xd0e8e0].map(rgb);
const OUTER = [0xf1e3c6, 0xe8d0c0, 0xd8dccb, 0xf3eedd, 0xe6c79a, 0xc9d3dc, 0xe2b8a8, 0xd8c8e0].map(rgb);
const WOOD = rgb(0x9a6a44), DARK = rgb(0x2a2a2c), STEEL = rgb(0x8a9096), WHITE = rgb(0xf2f2ee);

export class Frame {
  constructor(W, x, z, yaw, y0 = 0) {
    this.W = W; this.x = x; this.z = z; this.yaw = yaw; this.y0 = y0;
    this.c = Math.cos(yaw); this.s = Math.sin(yaw);
  }
  p(lx, lz) { return [this.x + lx * this.c + lz * this.s, this.z - lx * this.s + lz * this.c]; }
  toLocal(wx, wz) {
    const dx = wx - this.x, dz = wz - this.z;
    return [dx * this.c - dz * this.s, dx * this.s + dz * this.c];
  }
  box(mat, lx, ly, lz, sx, sy, sz, color, opts, lyaw = 0) {
    const [wx, wz] = this.p(lx, lz);
    return this.W.B.box(mat, wx, ly + this.y0, wz, sx, sy, sz, this.yaw + lyaw, color, opts);
  }
  cyl(mat, lx, ly, lz, r, h, color, sides, opts) {
    const [wx, wz] = this.p(lx, lz);
    this.W.B.cylinder(mat, wx, ly + this.y0, wz, r, h, color, sides, opts);
  }
  floorQuad(mat, x0, z0, x1, z1, y, color, uv = 2) {
    const [wx, wz] = this.p((x0 + x1) / 2, (z0 + z1) / 2);
    this.W.B.ground(mat, wx, wz, x1 - x0, z1 - z0, this.yaw, y + this.y0, color, uv);
  }
  // Vertical decal quad on a wall (sign, frame, banner): centre lx,ly,lz, facing local direction yawFace.
  wallQuad(mat, lx, ly, lz, w, h, faceYaw, uv, color = [1, 1, 1]) {
    const yaw = this.yaw + faceYaw;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const [cx, cz] = this.p(lx, lz);
    const rx = c, rz = -s; // local +x of the quad
    const nx = s, nz = c;  // facing direction
    const P = (a, b) => [cx + rx * a, ly + this.y0 + b, cz + rz * a];
    this.W.B.quad(mat, P(-w / 2, -h / 2), P(w / 2, -h / 2), P(w / 2, h / 2), P(-w / 2, h / 2), [nx, 0, nz],
      [[uv.u0, uv.v0], [uv.u1, uv.v0], [uv.u1, uv.v1], [uv.u0, uv.v1]], color, [cx, cz]);
  }
  world(lx, ly, lz) { const [x, z] = this.p(lx, lz); return [x, ly + this.y0, z]; }
}

// ---------- walls with openings ----------
// openings: [{c: centre along wall, w, h, sill}]
function wallRun(F, along, fixed, a0, a1, y0, h, mat, color, openings = [], t = WT, opts = {}) {
  const ops = openings.filter((o) => o.c - o.w / 2 < a1 && o.c + o.w / 2 > a0).sort((p, q) => p.c - q.c);
  let cur = a0;
  const seg = (s0, s1, sy0, sy1) => {
    if (s1 - s0 < 0.01 || sy1 - sy0 < 0.01) return;
    const mid = (s0 + s1) / 2, len = s1 - s0;
    if (along === 'x') F.box(mat, mid, (sy0 + sy1) / 2, fixed, len, sy1 - sy0, t, color, opts);
    else F.box(mat, fixed, (sy0 + sy1) / 2, mid, t, sy1 - sy0, len, color, opts);
  };
  for (const o of ops) {
    const o0 = o.c - o.w / 2, o1 = o.c + o.w / 2;
    seg(cur, o0, y0, y0 + h);
    if (o.sill > 0) seg(o0, o1, y0, y0 + o.sill);
    seg(o0, o1, y0 + o.sill + o.h, y0 + h);
    if (o.grille) grille(F, along, fixed, o, y0, t);
    cur = o1;
  }
  seg(cur, a1, y0, y0 + h);
}

function grille(F, along, fixed, o, y0, t) {
  const n = Math.max(3, Math.round(o.w / 0.15));
  for (let i = 1; i < n; i++) {
    const a = o.c - o.w / 2 + (i * o.w) / n;
    if (along === 'x') F.box('plain', a, y0 + o.sill + o.h / 2, fixed, 0.025, o.h, 0.025, DARK, { collide: false });
    else F.box('plain', fixed, y0 + o.sill + o.h / 2, a, 0.025, o.h, 0.025, DARK, { collide: false });
  }
  // invisible block so nobody climbs through
  if (along === 'x') F.box('plain', o.c, y0 + o.sill + o.h / 2, fixed, o.w, o.h, t * 0.5, DARK, { collide: true, skip: ['top', 'bottom', 'px', 'nx', 'pz', 'nz'] });
  else F.box('plain', fixed, y0 + o.sill + o.h / 2, o.c, t * 0.5, o.h, o.w, DARK, { collide: true, skip: ['top', 'bottom', 'px', 'nx', 'pz', 'nz'] });
}

export function wallX(F, z, x0, x1, y0, h, color, openings, mat = 'plaster', t = WT) { wallRun(F, 'x', z, x0, x1, y0, h, mat, color, openings, t); }
export function wallZ(F, x, z0, z1, y0, h, color, openings, mat = 'plaster', t = WT) { wallRun(F, 'z', x, z0, z1, y0, h, mat, color, openings, t); }

// Slab with an optional rectangular hole (stairwell). Top surface at y.
export function slab(F, x0, z0, x1, z1, y, hole, color = WHITE, th = 0.2) {
  const put = (a0, b0, a1, b1) => {
    if (a1 - a0 < 0.05 || b1 - b0 < 0.05) return;
    F.box('concrete', (a0 + a1) / 2, y - th / 2, (b0 + b1) / 2, a1 - a0, th, b1 - b0, color, { uv: 3 });
  };
  if (!hole) return put(x0, z0, x1, z1);
  const [hx0, hz0, hx1, hz1] = hole;
  put(x0, z0, x1, hz0);
  put(x0, hz1, x1, z1);
  put(x0, hz0, hx0, hz1);
  put(hx1, hz0, x1, hz1);
}

// Straight stair rising toward +z (dir 1) or -z (dir -1) along local x = sx.
export function stairs(F, sx, z0, y0, dir = 1, width = 1.0, rise = FH, steps = 11) {
  const r = rise / steps, run = 0.27;
  const len = run * steps;
  const b = F.world(sx, y0, z0 - dir * 0.5), t = F.world(sx, y0 + rise, z0 + dir * (len + 0.5));
  (F.W.stairsList || (F.W.stairsList = [])).push({ bx: b[0], bz: b[2], tx: t[0], tz: t[2], y0: b[1] });
  for (let i = 0; i < steps; i++) {
    const top = y0 + r * (i + 1);
    const z = z0 + dir * (run * i + run / 2);
    F.box('concrete', sx, (y0 + top) / 2, z, width, top - y0, run, rgb(0xb8b0a4), { uv: 1 });
  }
  return z0 + dir * run * steps; // landing z
}

// ---------- furniture ----------
export const Furn = {
  bed(F, x, z, ly = 0, rot = 0) {
    const W = F.W, r = W.rng;
    const sw = rot ? 2.0 : 1.6, sd = rot ? 1.6 : 2.0;
    F.box('wood', x, ly + 0.22, z, sw, 0.44, sd, WOOD);
    F.box('fabric', x, ly + 0.52, z, sw - 0.1, 0.16, sd - 0.1, rgb(r.pick([0xc04050, 0x4060a0, 0xd0a040, 0x50a070, 0xe0e0e0])), { collide: false });
    F.box('wood', rot ? x - sw / 2 + 0.04 : x, ly + 0.6, rot ? z : z + sd / 2 - 0.04, rot ? 0.08 : sw, 1.2, rot ? sd : 0.08, WOOD);
    W.lootSpots.push({ p: F.world(x, ly + 0.62, z), kind: 'any', w: 0.6 });
  },
  charpai(F, x, z, ly = 0, yaw = 0) {
    F.box('fabric', x, ly + 0.42, z, 0.95, 0.08, 1.9, rgb(0xcab58a), {}, yaw);
    for (const [a, b] of [[-0.42, -0.9], [0.42, -0.9], [-0.42, 0.9], [0.42, 0.9]]) {
      const c = Math.cos(yaw), s = Math.sin(yaw);
      F.box('wood', x + a * c + b * s, ly + 0.2, z - a * s + b * c, 0.07, 0.4, 0.07, WOOD, { collide: false });
    }
  },
  almirah(F, x, z, ly = 0, faceYaw = 0) {
    F.box('metal', x, ly + 0.95, z, 0.95, 1.9, 0.55, rgb(0x7f8a8c), {}, faceYaw);
    const [fx, fz] = [Math.sin(faceYaw) * 0.32, Math.cos(faceYaw) * 0.32];
    F.W.containers.push({ p: F.world(x + fx * 1.2, ly + 1.0, z + fz * 1.2), type: 'almirah', label: 'अलमारी' });
  },
  fridge(F, x, z, ly = 0, faceYaw = 0) {
    F.box('plain', x, ly + 0.8, z, 0.6, 1.6, 0.62, rgb(0xd8dee0), {}, faceYaw);
    const [fx, fz] = [Math.sin(faceYaw) * 0.5, Math.cos(faceYaw) * 0.5];
    F.W.containers.push({ p: F.world(x + fx, ly + 1.0, z + fz), type: 'fridge', label: 'फ्रिज' });
  },
  trunk(F, x, z, ly = 0, yaw = 0) {
    F.box('metal', x, ly + 0.25, z, 0.9, 0.5, 0.55, rgb(F.W.rng.pick([0x3a6a8a, 0x2f6a4a, 0x8a3a3a])), {}, yaw);
    F.W.containers.push({ p: F.world(x, ly + 0.55, z), type: 'trunk', label: 'बक्सा' });
  },
  table(F, x, z, ly = 0, chairs = true) {
    F.box('wood', x, ly + 0.74, z, 1.2, 0.05, 0.7, WOOD);
    for (const [a, b] of [[-0.55, -0.3], [0.55, -0.3], [-0.55, 0.3], [0.55, 0.3]]) F.box('wood', x + a, ly + 0.36, z + b, 0.05, 0.72, 0.05, WOOD, { collide: false });
    F.W.lootSpots.push({ p: F.world(x, ly + 0.78, z), kind: 'any', w: 1 });
    if (chairs) {
      const col = rgb(F.W.rng.pick([0xc03030, 0xe8e8e8, 0x3060b0, 0x2a8a4a]));
      for (const b of [-0.75, 0.75]) {
        F.box('plain', x + b * 0.4, ly + 0.45, z + b, 0.45, 0.06, 0.45, col, { collide: false });
        F.box('plain', x + b * 0.4, ly + 0.22, z + b, 0.42, 0.44, 0.42, col.map((v) => v * 0.8));
        F.box('plain', x + b * 0.4, ly + 0.72, z + b + Math.sign(b) * 0.2, 0.45, 0.5, 0.05, col, { collide: false });
      }
    }
  },
  kitchen(F, x0, x1, zWall, ly, dir) {
    // platform along a wall: dir = +1 means wall at larger z
    const zc = zWall - dir * 0.32, len = x1 - x0, xm = (x0 + x1) / 2;
    F.box('concrete', xm, ly + 0.42, zc, len, 0.84, 0.6, rgb(0x6a6a6a));
    F.box('plain', xm, ly + 0.86, zc, len, 0.04, 0.62, rgb(0x2a2a2a), { collide: false }); // granite top
    F.box('plain', xm - len * 0.2, ly + 0.92, zc, 0.6, 0.08, 0.36, DARK, { collide: false });      // gas stove
    F.cyl('plain', xm + len * 0.3, ly, zc - dir * 0.6, 0.16, 0.6, rgb(0xb82020), 8);             // LPG cylinder
    for (let i = 0; i < 4; i++) F.cyl('plain', xm + len * 0.1 + i * 0.16, ly + 0.88, zc + dir * 0.12, 0.06, 0.12 + i * 0.03, STEEL, 6);
    F.box('wood', xm, ly + 1.6, zWall - dir * 0.15, len, 0.04, 0.3, WOOD, { collide: false }); // shelf
    F.W.lootSpots.push({ p: F.world(xm + len * 0.15, ly + 0.9, zc), kind: 'food', w: 2 });
    F.W.lootSpots.push({ p: F.world(xm - len * 0.35, ly + 1.64, zWall - dir * 0.15), kind: 'food', w: 1.5 });
  },
  tv(F, x, z, ly = 0, faceYaw = 0) {
    F.box('wood', x, ly + 0.3, z, 1.2, 0.6, 0.45, WOOD, {}, faceYaw);
    F.box('plain', x, ly + 0.85, z, 0.95, 0.55, 0.06, DARK, { collide: false }, faceYaw);
  },
  shelves(F, x, z, w, ly = 0, faceYaw = 0, food = true) {
    const W = F.W;
    F.box('wood', x, ly + 1.1, z, w, 2.2, 0.45, WOOD, {}, faceYaw);
    const c = Math.cos(F.yaw + faceYaw), s = Math.sin(F.yaw + faceYaw);
    for (let k = 0; k < 4; k++) for (let i = 0; i < Math.floor(w / 0.22); i++) {
      if (W.rng() < 0.3) continue;
      const lx = -w / 2 + 0.12 + i * 0.22;
      const px = x + lx * Math.cos(faceYaw) + 0.25 * Math.sin(faceYaw), pz = z - lx * Math.sin(faceYaw) + 0.25 * Math.cos(faceYaw);
      const h = 0.12 + W.rng() * 0.2;
      F.box('plain', px, ly + 0.3 + k * 0.5 + h / 2, pz, 0.16, h, 0.12, rgb(W.rng.pick([0xd04030, 0xe0b020, 0x2060c0, 0x30a050, 0xf0f0f0, 0xe07020])), { collide: false }, faceYaw);
    }
    void c; void s;
    const [fx, fz] = [Math.sin(faceYaw) * 0.45, Math.cos(faceYaw) * 0.45];
    W.containers.push({ p: F.world(x + fx, ly + 1.0, z + fz), type: food ? 'shelf' : 'shelfx', label: 'रैक' });
  },
  counter(F, x, z, w, ly = 0, yaw = 0) {
    F.box('wood', x, ly + 0.5, z, w, 1.0, 0.6, rgb(0x6a4a30), {}, yaw);
    F.box('plain', x, ly + 1.02, z, w + 0.05, 0.04, 0.65, rgb(0x303030), { collide: false }, yaw);
    F.W.lootSpots.push({ p: F.world(x, ly + 1.06, z), kind: 'any', w: 1.5 });
  },
  sacks(F, x, z, ly = 0) {
    for (let i = 0; i < 3; i++) F.box('fabric', x + i * 0.5, ly + 0.3, z, 0.45, 0.6, 0.7, rgb(0xd8ccaa));
    F.box('fabric', x + 0.25, ly + 0.85, z, 0.45, 0.5, 0.7, rgb(0xd8ccaa), { collide: false });
  },
  matka(F, x, z, ly = 0) { F.cyl('plain', x, ly, z, 0.2, 0.45, rgb(0x9a4a28), 8); F.W.lootSpots.push({ p: F.world(x + 0.4, ly + 0.05, z), kind: 'water', w: 0.6 }); },
  tube(F, x, ly, z, faceYaw, powered) {
    F.box(powered ? 'glow' : 'plain', x, ly, z, 1.2, 0.05, 0.05, powered ? rgb(0xe8f4ff) : rgb(0x9a9a9a), { collide: false }, faceYaw);
    if (powered) {
      const [px, py, pz] = F.world(x + Math.sin(faceYaw) * 0.5, ly - 0.3, z + Math.cos(faceYaw) * 0.5);
      F.W.lights.push({ x: px, y: py, z: pz, color: 0xdfe8ff, intensity: 3.2, dist: 8, flicker: F.W.rng() < 0.3 ? 1 : 0, interior: true });
    }
  },
  fan(F, x, ly, z) { F.W.fans.push(F.world(x, ly, z)); },
  photo(F, x, ly, z, faceYaw, idx) {
    // photo frame slot: idx is 1-based number of the uploaded photo
    if (!idx) return;
    F.box('wood', x, ly, z, 0.62, 0.8, 0.04, rgb(0x4a2a18), { collide: false }, faceYaw);
    F.W.frameSlots.push({ F, x, y: ly, z, faceYaw, idx });
  },
  radio(F, x, z, ly = 0, faceYaw = 0) {
    F.box('plain', x, ly + 0.12, z, 0.34, 0.22, 0.12, rgb(0x5a3a2a), { collide: false }, faceYaw);
    F.W.radioSlots.push({ p: F.world(x, ly + 0.15, z), building: F.W.currentBuilding });
  },
  debris(F, x, z, ly = 0, n = 6) {
    const r = F.W.rng;
    for (let i = 0; i < n; i++) {
      const s = 0.15 + r() * 0.5;
      F.box(r() < 0.5 ? 'brick' : 'concrete', x + (r() - 0.5) * 2, ly + s * 0.3, z + (r() - 0.5) * 2, s, s * 0.6, s * 0.8, [0.8, 0.78, 0.75], { collide: s > 0.4 }, r() * 3);
    }
  },
  bench(F, x, z, ly = 0, len = 1.6, yaw = 0) {
    F.box('wood', x, ly + 0.45, z, len, 0.06, 0.4, WOOD, { collide: false }, yaw);
    F.box('wood', x, ly + 0.22, z, len - 0.1, 0.44, 0.3, rgb(0x5a4030), {}, yaw);
  },
};

// ---------- door registry ----------
// Door at local x along front/inner wall at z (along 'x') or along x wall (along 'z').
export function door(F, along, fixed, c, ly, opts = {}) {
  const w = opts.w || 0.95, h = opts.h || 2.1;
  const W = F.W;
  const hingeL = along === 'x' ? [c - w / 2, fixed] : [fixed, c - w / 2];
  const hinge = F.world(hingeL[0], ly, hingeL[1]);
  const closedYaw = F.yaw + (along === 'x' ? 0 : -Math.PI / 2);
  W.doors.push({
    hinge, closedYaw, w, h, t: 0.06,
    open: false, locked: !!opts.locked, kick: opts.kick !== false, hp: opts.hp || 120,
    metal: !!opts.metal, label: opts.label || 'दरवाज़ा', building: W.currentBuilding,
    swing: opts.swing || 1,
  });
}

// ---------- building shell ----------
// Outer walls, slabs, roof parapet. frontOps/backOps/sideOps: per-floor opening lists.
export function shell(F, w, d, floors, o = {}) {
  const W = F.W;
  const col = o.color || W.rng.pick(OUTER);
  const H = floors * FH;
  const x0 = -w / 2, x1 = w / 2;
  for (let f = 0; f < floors; f++) {
    const y = f * FH;
    const fr = (o.front && o.front[f]) || [];
    const bk = (o.back && o.back[f]) || [];
    const lf = (o.left && o.left[f]) || [];
    const rt = (o.right && o.right[f]) || [];
    wallX(F, WT / 2, x0, x1, y, FH, col, fr, o.mat);
    wallX(F, d - WT / 2, x0, x1, y, FH, col, bk, o.mat);
    wallZ(F, x0 + WT / 2, WT, d - WT, y, FH, col, lf, o.mat);
    wallZ(F, x1 - WT / 2, WT, d - WT, y, FH, col, rt, o.mat);
    // chhajja over openings on the front
    for (const op of fr) if (op.h > 1) F.box('concrete', op.c, y + op.sill + op.h + 0.12, -0.25, op.w + 0.5, 0.08, 0.5, [0.85, 0.83, 0.8], { collide: false });
    // interior paint: inner skin quads are skipped; partitions carry the paint
    const fh = f > 0 && o.holes && o.holes[f];
    const fq = (a0, b0, a1, b1) => { if (a1 - a0 > 0.05 && b1 - b0 > 0.05) F.floorQuad('tile', a0, b0, a1, b1, y + 0.015, o.floorCol || [1, 1, 1], 1.2); };
    if (!fh) fq(x0 + WT, WT, x1 - WT, d - WT);
    else {
      fq(x0 + WT, WT, x1 - WT, fh[1]); fq(x0 + WT, fh[3], x1 - WT, d - WT);
      fq(x0 + WT, fh[1], fh[0], fh[3]); fq(fh[2], fh[1], x1 - WT, fh[3]);
    }
  }
  // upper slabs (with stair holes) + roof
  for (let f = 1; f <= floors; f++) {
    const hole = (o.holes && o.holes[f]) || null;
    if (f === floors && !o.roofAccess) slab(F, x0, 0, x1, d, H, null);
    else slab(F, x0 + WT, WT, x1 - WT, d - WT, f * FH, hole);
  }
  // parapet
  const ph = 0.9;
  F.box('plaster', 0, H + ph / 2, 0.08, w, ph, 0.16, col);
  F.box('plaster', 0, H + ph / 2, d - 0.08, w, ph, 0.16, col);
  F.box('plaster', x0 + 0.08, H + ph / 2, d / 2, 0.16, ph, d, col);
  F.box('plaster', x1 - 0.08, H + ph / 2, d / 2, 0.16, ph, d, col);
  return col;
}

export function pickPaint(W) { return W.rng.pick(PAINTS); }

// Partition wall with doorway (always has a gap so rooms connect).
function part(F, along, fixed, a0, a1, y, col, doorAt, doorObj) {
  const ops = doorAt != null ? [{ c: doorAt, w: 1.0, h: 2.15, sill: 0 }] : [];
  if (along === 'x') wallX(F, fixed, a0, a1, y, FH, col, ops, 'plaster', 0.14);
  else wallZ(F, fixed, a0, a1, y, FH, col, ops, 'plaster', 0.14);
  if (doorObj && doorAt != null) door(F, along, fixed, doorAt, y, { w: 0.9 });
}

const winOp = (c, w = 1.2) => ({ c, w, h: 1.3, sill: 0.9, grille: true });
const doorOp = (c, w = 1.0) => ({ c, w, h: 2.15, sill: 0 });
const shopOp = (c, w) => ({ c, w, h: 2.5, sill: 0 });

// ===================== TEMPLATES =====================
// Each returns nothing; it registers everything on W.

export const Templates = {
  // 1. small house: living room in front, bedroom + kitchen behind
  small(F, spec) {
    const { w = 7.4, d = 9 } = spec;
    const W = F.W;
    const broken = spec.abandoned;
    shell(F, w, d, 1, {
      front: [[doorOp(0), winOp(-w / 4 - 0.3), winOp(w / 4 + 0.3)]],
      back: [[winOp(-w / 4), winOp(w / 4)]],
      left: [[broken ? { c: d * 0.7, w: 1.6, h: 1.8, sill: 0.4 } : winOp(d * 0.7, 1)]],
      right: [[]],
    });
    door(F, 'x', WT / 2, 0, 0, { locked: spec.locked, label: spec.locked ? 'बंद दरवाज़ा' : 'दरवाज़ा' });
    const pc = pickPaint(W), pc2 = pickPaint(W);
    part(F, 'x', 4.6, -w / 2 + WT, w / 2 - WT, 0, pc, -w / 4, !broken);
    part(F, 'z', 0.4, 4.6, d - WT, 0, pc2, 6.8, false);
    // living room
    Furn.charpai(F, -w / 2 + 1.0, 2.4, 0);
    Furn.tv(F, w / 2 - 0.8, 2.4, 0, -Math.PI / 2);
    Furn.photo(F, 0.8, 1.9, 4.5, Math.PI, spec.photos?.[0]);
    Furn.tube(F, 0, 2.7, 4.5, Math.PI, spec.powered);
    Furn.fan(F, 0, 3.0, 2.3);
    if (spec.radio) Furn.radio(F, w / 2 - 0.8, 2.4, 0.62, -Math.PI / 2);
    // bedroom (left back)
    Furn.bed(F, -w / 2 + 1.3, d - 1.4, 0);
    Furn.almirah(F, -0.6, 5.2, 0, 0);
    Furn.photo(F, -w / 2 + 0.13, 1.8, 7, Math.PI / 2, spec.photos?.[1]);
    // kitchen (right back)
    Furn.kitchen(F, 0.6, w / 2 - WT, d - WT, 0, 1);
    Furn.fridge(F, w / 2 - 0.5, 5.2, 0, -Math.PI / 2);
    Furn.matka(F, 1.0, 5.1, 0);
    if (broken) { Furn.debris(F, -1.5, 2.5, 0, 9); Furn.debris(F, 1.5, 7, 0, 6); }
    W.enemySpots.push(F.world(-1.5, 0, 2.5), F.world(2, 0, 7));
  },

  // 2. shop downstairs, stairs, residence upstairs
  shopHouse(F, spec) {
    const { w = 6.4, d = 11 } = spec;
    const W = F.W;
    const holes = { 1: [w / 2 - 1.35, 5.4, w / 2 - WT, 8.6] };
    shell(F, w, d, 2, {
      front: [[shopOp(-0.4, 3.6), doorOp(w / 2 - 0.9, 0.9)], [doorOp(0, 1.0), winOp(-w / 4 - 0.4, 0.9), winOp(w / 4 + 0.4, 0.9)]],
      back: [[winOp(0, 1)], [winOp(-1, 1), winOp(1.4, 1)]],
      holes,
    });
    door(F, 'x', WT / 2, w / 2 - 0.9, 0, { label: 'दरवाज़ा' });
    // rolling shutter, open or half closed
    const sh = spec.shutter ?? W.rng.pick(['open', 'half', 'half']);
    if (sh === 'half') F.box('metal', -0.4, 2.5 - 0.55, 0.05, 3.6, 1.1, 0.05, STEEL, { collide: false });
    if (spec.sign) F.wallQuad('sign', -0.4, 2.95, -0.04, 3.8, 0.85, Math.PI, spec.sign);
    const pc = pickPaint(W);
    part(F, 'x', 5.0, -w / 2 + WT, w / 2 - WT - 1.4, 0, pc, 0.9, true);
    Furn.counter(F, -0.6, 2.2, 2.6);
    Furn.shelves(F, -w / 2 + 0.35, 2.4, 2.4, 0, Math.PI / 2, spec.food !== false);
    Furn.shelves(F, -1.1, 4.65, 2.2, 0, Math.PI, spec.food !== false);
    Furn.sacks(F, 0.6, 3.6, 0);
    Furn.tube(F, -0.4, 2.8, 4.8, Math.PI, spec.powered);
    // back room + stairs
    stairs(F, w / 2 - 0.75, 5.5, 0, 1, 1.1);
    Furn.trunk(F, -w / 2 + 0.8, d - 0.6, 0);
    Furn.charpai(F, -0.6, 7.6, 0, Math.PI / 2);
    // first floor
    const y = FH;
    part(F, 'z', 0.2, WT, 5.0, y, pickPaint(W), 2.6, true);
    Furn.bed(F, -w / 2 + 1.1, 1.5, y, 0);
    Furn.almirah(F, -w / 2 + 0.4, 4.2, y, Math.PI / 2);
    Furn.photo(F, -1.2, y + 1.8, d - WT - 0.03, Math.PI, spec.photos?.[0]);
    Furn.table(F, -0.8, 8, y);
    Furn.kitchen(F, -w / 2 + WT, -0.6, d - WT, y, 1);
    Furn.fan(F, 0, y + 3.0, 3);
    if (spec.radio) Furn.radio(F, -0.8, 8.2, y + 0.78, Math.PI);
    // balcony
    F.box('concrete', 0, y - 0.1, -0.6, w, 0.2, 1.2, [0.85, 0.85, 0.82]);
    F.box('metal', 0, y + 0.5, -1.15, w, 0.9, 0.04, DARK, {});
    W.enemySpots.push(F.world(0, 0, 3), F.world(0, y, 7));
  },

  // 3. courtyard (aangan) family house
  courtyard(F, spec) {
    const { w = 14, d = 14 } = spec;
    const W = F.W;
    const col = shell(F, w, d, 1, {
      front: [[doorOp(0, 1.3), winOp(-4.5), winOp(4.5)]],
      back: [[winOp(-4.5), winOp(4.5)]],
      left: [[winOp(10)]], right: [[winOp(10)]],
      holes: { 1: [-2.6, 4.0, 2.6, 9.6] }, roofAccess: true, // open-to-sky aangan
    });
    door(F, 'x', WT / 2, 0, 0, { w: 1.25, label: 'फाटक' });
    const pc = pickPaint(W);
    // inner ring walls around the aangan (x -2.6..2.6, z 4..9.6)
    part(F, 'x', 4.0, -w / 2 + WT, -1.2, 0, pc, -4.5, true);
    part(F, 'x', 4.0, 1.2, w / 2 - WT, 0, pc, 4.5, true);
    part(F, 'z', -2.6, 4.0, d - WT, 0, pc, 6.5, true);
    part(F, 'z', 2.6, 4.0, d - WT, 0, pc, 11.5, true);
    part(F, 'x', 9.6, -2.6, 2.6, 0, pc, 0, false);
    part(F, 'x', 9.6, -w / 2 + WT, -2.6, 0, pickPaint(W), -4.5, true);
    // deodhi passage walls
    part(F, 'z', -1.2, WT, 4.0, 0, col, null, false);
    part(F, 'z', 1.2, WT, 4.0, 0, col, null, false);
    // aangan: handpump + tulsi chaura + clothes line
    F.box('concrete', 0, 0.35, 7.2, 0.9, 0.7, 0.9, rgb(0xd07040));
    F.box('plain', 0, 0.85, 7.2, 0.25, 0.3, 0.25, rgb(0x3a8a3a), { collide: false });
    W.pumps.push({ p: F.world(-1.6, 0, 5) });
    F.box('metal', -1.6, 0.6, 5, 0.12, 1.2, 0.12, rgb(0x3a3a3a));
    // rooms
    Furn.charpai(F, -5, 1.6, 0, Math.PI / 2);
    Furn.photo(F, -4.5, 1.8, 3.92, Math.PI, spec.photos?.[0]);
    Furn.table(F, -4.5, 2.4, 0, true);
    Furn.sacks(F, 3.8, 1.2, 0); Furn.trunk(F, 5.6, 3.0, 0);
    Furn.bed(F, -5, 7.5, 0); Furn.almirah(F, -3.2, 4.6, 0, 0);
    Furn.photo(F, -6.85, 1.8, 7, Math.PI / 2, spec.photos?.[1]);
    Furn.kitchen(F, 3.0, w / 2 - WT, d - WT, 0, 1); Furn.fridge(F, 6.3, 9.0, 0, -Math.PI / 2);
    Furn.bed(F, 5, 6.4, 0); Furn.trunk(F, 3.4, 5.0, 0);
    Furn.bed(F, -4.8, 12.4, 0, 1); Furn.almirah(F, -1.0, 13.3, 0, Math.PI);
    if (spec.radio) Furn.radio(F, -4.5, 2.4, 0.78, 0);
    Furn.tube(F, -4.5, 2.7, 3.9, Math.PI, spec.powered);
    Furn.tube(F, 5, 2.7, 4.1, 0, spec.powered);
    W.enemySpots.push(F.world(0, 0, 6), F.world(-5, 0, 6), F.world(5, 0, 12));
  },

  // 4. narrow traditional house, two floors
  narrow(F, spec) {
    const { w = 4.4, d = 13 } = spec;
    const W = F.W;
    const holes = { 1: [w / 2 - 1.2, 8.6, w / 2 - WT, 11.9] };
    shell(F, w, d, 2, {
      front: [[doorOp(-0.6, 0.95), winOp(1.3, 0.8)], [winOp(0, 1.4)]],
      back: [[], [winOp(0, 1)]],
      holes,
    });
    door(F, 'x', WT / 2, -0.6, 0, { locked: spec.locked });
    const pc = pickPaint(W);
    part(F, 'x', 4.5, -w / 2 + WT, w / 2 - WT, 0, pc, -0.8, false);
    part(F, 'x', 7.4, -w / 2 + WT, w / 2 - WT, 0, pc, -0.8, true);
    Furn.charpai(F, 0.8, 2.4, 0);
    Furn.photo(F, -w / 2 + 0.13, 1.8, 2.3, Math.PI / 2, spec.photos?.[0]);
    Furn.kitchen(F, -0.15, w / 2 - WT, 7.33, 0, 1);
    Furn.matka(F, 1.2, 5.3, 0);
    Furn.trunk(F, -1.2, 11.8, 0);
    stairs(F, w / 2 - 0.65, 8.7, 0, 1, 0.9);
    const y = FH;
    part(F, 'x', 6.5, -w / 2 + WT, w / 2 - WT, y, pickPaint(W), 0, true);
    Furn.bed(F, -0.6, 2.0, y);
    Furn.almirah(F, 1.4, 5.8, y, Math.PI);
    Furn.trunk(F, -1.2, 10.5, y);
    if (spec.radio) Furn.radio(F, -1.2, 10.5, y + 0.5, 0);
    Furn.tube(F, 0, y + 2.7, 6.42, Math.PI, spec.powered);
    W.enemySpots.push(F.world(0, 0, 6.5), F.world(0, y, 3));
  },

  // 5. THREE-FLOOR house with roof access (Kamakhya composition)
  three(F, spec) {
    const { w = 12, d = 12 } = spec;
    const W = F.W;
    // switch-back stairwell: flights alternate between two columns
    const sxA = w / 2 - 0.75, sxB = w / 2 - 1.85;
    const colA = [w / 2 - 1.35, 6.6, w / 2 - WT, 9.8], colB = [w / 2 - 2.45, 6.6, w / 2 - 1.3, 9.8];
    const holes = { 1: colA, 2: colB, 3: colA };
    shell(F, w, d, 3, {
      color: rgb(0xf0d8a8),
      front: [[doorOp(-1.5, 1.2), winOp(-4.2), winOp(2.2)], [doorOp(0, 1.1), winOp(-3.8), winOp(3.6)], [winOp(-3.8), winOp(0), winOp(3.6)]],
      back: [[winOp(-3)], [winOp(-3), winOp(2)], [winOp(-3), winOp(2)]],
      left: [[winOp(6)], [winOp(6)], [winOp(6)]],
      right: [[], [], []],
      holes, roofAccess: true,
    });
    door(F, 'x', WT / 2, -1.5, 0, { w: 1.15, label: 'मुख्य दरवाज़ा' });
    if (spec.sign) F.wallQuad('sign', -1.5, 2.75, -0.04, 1.8, 0.45, Math.PI, spec.sign);
    // stairs for each floor
    stairs(F, sxA, 6.75, 0, 1, 1.1);
    stairs(F, sxB, 9.72, FH, -1, 1.1);
    stairs(F, sxA, 6.75, 2 * FH, 1, 1.1);
    // mumty (stair room) on the roof
    const H = 3 * FH;
    wallX(F, 6.5, w / 2 - 1.6, w / 2, H, 2.6, rgb(0xf0d8a8));
    wallZ(F, w / 2 - 1.55, 6.5, 10.4, H, 2.6, rgb(0xf0d8a8));
    wallX(F, 10.4, w / 2 - 1.6, w / 2, H, 2.6, rgb(0xf0d8a8), [doorOp(w / 2 - 0.8, 1.0)]);
    wallZ(F, w / 2 - 0.1, 6.5, 10.4, H, 2.6, rgb(0xf0d8a8));
    F.box('concrete', w / 2 - 0.8, H + 2.7, 8.45, 1.7, 0.2, 4.1, [0.8, 0.8, 0.78]);
    // water tank + clothes line on roof
    F.cyl('plain', -4, H, 9.5, 0.7, 1.2, rgb(0x1a1a1a), 12, { collide: true });
    W.lootSpots.push({ p: F.world(-2, H + 0.05, 3), kind: 'any', w: 2 }, { p: F.world(2, H + 0.05, 9), kind: 'weapon', w: 1.5 });
    // floors
    const pcs = [pickPaint(W), pickPaint(W), pickPaint(W)];
    // ground: hall + kitchen
    part(F, 'x', 6.0, -w / 2 + WT, w / 2 - 2.6, 0, pcs[0], -2.5, true);
    Furn.charpai(F, -4.4, 3, 0); Furn.tv(F, 3.5, 2.6, 0, -Math.PI / 2);
    Furn.table(F, -0.8, 3.2, 0);
    Furn.photo(F, -1.2, 1.9, 5.92, Math.PI, spec.photos?.[0]);
    Furn.kitchen(F, -w / 2 + WT, 1.5, d - WT, 0, 1); Furn.fridge(F, -w / 2 + 0.5, 7.2, 0, Math.PI / 2);
    Furn.tube(F, -1.5, 2.7, 5.92, Math.PI, spec.powered); Furn.fan(F, -1, 3, 3);
    // first: two bedrooms
    const y1 = FH;
    part(F, 'z', -0.5, WT, d - WT, y1, pcs[1], 3.0, true);
    Furn.bed(F, -3.8, 2.0, y1); Furn.almirah(F, -w / 2 + 0.4, 6.5, y1, Math.PI / 2);
    Furn.photo(F, -3.2, y1 + 1.8, d - WT - 0.03, Math.PI, spec.photos?.[1]);
    Furn.bed(F, 2.4, 2.0, y1); Furn.trunk(F, 1.8, 10.8, y1);
    if (spec.radio) Furn.radio(F, -3.8, 10.5, y1 + 0.1, 0);
    // balcony floor 1
    F.box('concrete', 0, y1 - 0.1, -0.7, w, 0.2, 1.4, [0.85, 0.85, 0.82]);
    F.box('metal', 0, y1 + 0.5, -1.35, w, 0.9, 0.04, DARK);
    // second: study + store
    const y2 = 2 * FH;
    part(F, 'x', 6.0, -w / 2 + WT, w / 2 - 2.6, y2, pcs[2], 0, true);
    Furn.table(F, -3, 3, y2); Furn.shelves(F, 2.5, 5.6, 2.2, y2, Math.PI, false);
    Furn.photo(F, -w / 2 + 0.13, y2 + 1.8, 3.0, Math.PI / 2, spec.photos?.[2]);
    Furn.sacks(F, -4.5, 9.5, y2); Furn.trunk(F, -1.5, 10.9, y2); Furn.debris(F, 1.5, 9.5, y2, 4);
    W.enemySpots.push(F.world(0, 0, 3), F.world(-3, y1, 8), F.world(-3, y2, 9));
  },

  // 7. small shop with back room
  shop(F, spec) {
    const { w = 5, d = 8.5 } = spec;
    const W = F.W;
    shell(F, w, d, 1, { front: [[shopOp(0, 3.4)]], back: [[winOp(0, 0.8)]] });
    if (spec.sign) F.wallQuad('sign', 0, 2.95, -0.04, 4.6, 0.75, Math.PI, spec.sign);
    const sh = spec.shutter ?? W.rng.pick(['open', 'half']);
    if (sh === 'half') F.box('metal', 0, 2.5 - 0.6, 0.05, 3.4, 1.2, 0.05, STEEL, { collide: false });
    const pc = pickPaint(W);
    part(F, 'x', 5.2, -w / 2 + WT, w / 2 - WT, 0, pc, 1.4, true);
    Furn.counter(F, -0.4, 2.0, 2.8);
    Furn.shelves(F, -0.9, 4.9, 2.6, 0, Math.PI, spec.food !== false);
    Furn.shelves(F, -w / 2 + 0.35, 3.0, 1.8, 0, Math.PI / 2, spec.food !== false);
    Furn.sacks(F, -1.6, 7.6, 0); Furn.trunk(F, 1.2, 7.7, 0);
    if (spec.photos?.[0]) Furn.photo(F, w / 2 - 0.13, 1.9, 3.2, -Math.PI / 2, spec.photos[0]);
    Furn.tube(F, 0, 2.8, 5.1, Math.PI, spec.powered);
    if (spec.radio) Furn.radio(F, -0.8, 2.0, 1.04, 0);
    W.enemySpots.push(F.world(0, 0, 6.8));
  },

  // police chowki: one office + lock-up
  chowki(F, spec) {
    const { w = 7, d = 6.5 } = spec;
    const W = F.W;
    shell(F, w, d, 1, { color: rgb(0xe8d8b8), front: [[doorOp(-1.5, 1), winOp(1.5, 1.2)]], back: [[winOp(-1.5, 0.8)]] });
    door(F, 'x', WT / 2, -1.5, 0, { label: 'चौकी' });
    F.wallQuad('sign', 0, 2.85, -0.04, 5.0, 0.6, Math.PI, spec.sign);
    // lock-up bars
    for (let i = 0; i < 14; i++) F.box('metal', 0.5 + i * 0.2, 1.4, 4.0, 0.04, 2.8, 0.04, DARK, { collide: false });
    F.box('plain', 1.9, 1.4, 4.0, 2.8, 2.8, 0.05, DARK, { collide: true, skip: ['top', 'bottom', 'px', 'nx', 'pz', 'nz'] });
    Furn.table(F, -1.8, 2.6, 0, true);
    Furn.almirah(F, -w / 2 + 0.4, 5.0, 0, Math.PI / 2);
    Furn.trunk(F, -1.2, 5.7, 0);
    W.lootSpots.push({ p: F.world(-1.8, 0.8, 2.6), kind: 'weapon', w: 4, tag: 'police' });
    Furn.tube(F, -1.0, 2.8, 3.99, Math.PI, spec.powered);
    Furn.photo(F, -w / 2 + 0.13, 1.9, 2.5, Math.PI / 2, spec.photos?.[0]);
    W.enemySpots.push(F.world(-1, 0, 3));
  },

  // dhaba / chai shop: open front, tables, back kitchen
  dhaba(F, spec) {
    const { w = 9, d = 8 } = spec;
    const W = F.W;
    shell(F, w, d, 1, { front: [[shopOp(-1.5, 5.4)]], back: [[winOp(2, 1)]], color: rgb(0xd8c0a0) });
    F.wallQuad('sign', -0.5, 2.95, -0.04, 7.0, 0.8, Math.PI, spec.sign);
    part(F, 'x', 5.4, -w / 2 + WT, w / 2 - WT, 0, pickPaint(W), 2.8, true);
    Furn.table(F, -2.5, 2.2, 0); Furn.table(F, 1.0, 2.2, 0);
    Furn.bench(F, -2.5, 4.4, 0, 2); Furn.bench(F, 2.4, 4.4, 0, 2);
    F.cyl('concrete', 3.2, 0, 1.0, 0.5, 0.9, rgb(0x8a5a40), 10, { collide: true }); // tandoor
    Furn.kitchen(F, -w / 2 + WT, 1.6, d - WT, 0, 1); Furn.fridge(F, 3.7, 6.2, 0, -Math.PI / 2);
    Furn.sacks(F, 2.2, 7.4, 0);
    if (spec.radio) Furn.radio(F, -2.5, 2.2, 0.78, 0);
    Furn.tube(F, 0, 2.8, 5.32, Math.PI, spec.powered);
    W.enemySpots.push(F.world(0, 0, 3), F.world(0, 0, 6.8));
  },

  // primary school: verandah + 3 classrooms
  school(F, spec) {
    const { w = 22, d = 10 } = spec;
    const W = F.W;
    const col = rgb(0xe8c068);
    shell(F, w, d, 1, { color: col, front: [[doorOp(-7.3, 1), doorOp(0, 1), doorOp(7.3, 1)]], back: [[winOp(-7.3, 2), winOp(0, 2), winOp(7.3, 2)]] });
    F.wallQuad('sign', 0, 2.9, -0.04, 9, 0.7, Math.PI, spec.sign);
    part(F, 'z', -3.7, WT, d - WT, 0, rgb(0xf0f0e0), null, false);
    part(F, 'z', 3.7, WT, d - WT, 0, rgb(0xf0f0e0), null, false);
    for (const cx of [-7.3, 0, 7.3]) {
      door(F, 'x', WT / 2, cx, 0, { label: 'कक्षा' });
      F.box('plain', cx, 1.6, d - WT - 0.03, 3, 1.1, 0.04, rgb(0x1e3a2a), { collide: false }); // blackboard
      for (let r = 0; r < 3; r++) Furn.bench(F, cx, 2.6 + r * 1.9, 0, 3.0);
      F.W.lootSpots.push({ p: F.world(cx + 2, 0.9, 8.5), kind: 'any', w: 1 });
    }
    Furn.almirah(F, 10.2, 8.8, 0, -Math.PI / 2);
    Furn.photo(F, -10.85, 1.8, 5, Math.PI / 2, spec.photos?.[0]);
    // verandah roof posts in front
    for (let i = -5; i <= 5; i++) F.box('concrete', i * 2.1, 1.45, -2.2, 0.25, 2.9, 0.25, col);
    F.box('concrete', 0, 3.0, -1.2, w, 0.2, 2.4, [0.82, 0.8, 0.78]);
    W.enemySpots.push(F.world(-7, 0, 5), F.world(7, 0, 5));
  },
};
