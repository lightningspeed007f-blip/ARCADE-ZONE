// BEYOND JAIS — three far-off places built from uploaded models, joined to the town by road and metro,
// and the pickup, the ghouls and the hounds that load with them.
//
//   THE FOREST ROAD (models/forest.glb): the Amethi road runs out of town past a highway sign at its end.
//       Drive (or walk) on and you come out on a winding dirt road through pines at night. Hound packs
//       hunt here; there is a dead campfire-camp at the bend. The far end of the road reaches...
//   THE DEAD CITY (models/city.glb): a curved avenue between tower blocks, lamp-lit, full of ghouls.
//       At the top of the avenue: a metro entrance.
//   THE OLD METRO (models/metro.glb): two station halls joined by a loop of graffiti tunnel. The south
//       hall climbs back up to the city; the north hall comes out at the metro entrance by Jais City station.
// So a night can go town -> forest -> city -> metro -> town (or back the way you came). Cars come along
// on the road; the metro is on foot.
//
// Each model was baked offline (assets/models/<place>.json): collision boxes for walls and floors, and a
// walkable height grid (forest ground, enemy path-finding, spawn spots). Everything here loads in the
// background after the town is ready, smallest first; a road or stair whose place hasn't arrived yet
// just tells you so.
import * as THREE from 'three';
import { loadGLB, lambertize } from './models.js';
import { ASSET_ROOT } from './assets.js';
import { ROADS, roadInfo } from './layout.js';
import { Creatures } from './creatures.js';
import { rollAmmo, rollFood } from './loot.js';
import { part, merge, Bx, Cy } from './props.js';
import { LANDMARKS } from './minimap.js';
import { FIRE } from './explosives.js';

// where each place sits in the world (x > -600 and z > -600: clear of the Shivdham / Kalidham checks)
export const PLACES = {
  forest: { model: 'models/forest.glb', bake: 'models/forest.json', o: [620, 0], fog: [0x0a110d, 0.03], terrain: true, surface: 'dirt' },
  city: { model: 'models/city.glb', bake: 'models/city.json', o: [620, 460], fog: [0x0d1118, 0.022], surface: 'asphalt' },
  metro: { model: 'models/metro.glb', bake: 'models/metro.json', o: [300, 700], fog: [0x060709, 0.032], indoor: true, surface: 'tile', normals: true },
};
const TOWN_FOG = [0x0d1520, 0.0165];

// the forest road, south to north (local metres)
const ROAD_F = [[21, 62], [8, 48.5], [-5.5, 39], [-19, 30], [-23.5, 22], [-23.5, 11], [-20, 0.5], [-8, -9], [5, -14], [18.5, -23.5], [28, -31.5], [31, -36], [29, -43.5], [26.5, -49.5]];
const CAMP = [-27, 5];                     // a burnt-out camp at the bend: the only fire in the forest
// lamp heads along the dead city's avenue (local metres, from the model)
const CITY_LAMPS = [[-4, -10.8], [2.4, -18], [13.6, -25.2], [-17.2, -12.4], [-6, -28.4], [-13.2, -21.2], [6.8, -36], [-4.6, 4], [-4.6, 16], [-4.6, 28], [-18.4, 5], [-18.4, 17], [-18.4, 29]];
const CITY_KIOSK = { x: 25, z: -39, yaw: -0.77 };
// the metro: the loop's centre line and the two halls
const METRO_RING = [[25.7, -10], [25.7, 0], [25.7, 10], [15, 17.6], [0, 18], [-15, 17.6], [-25.7, 10], [-25.7, 0], [-25.7, -10], [-15, -17.6], [0, -18], [15, -17.6]];

// ---------- signs and the metro entrance kiosk ----------
function signTexture(lines, bg, fg, w = 512, h = 192) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  x.strokeStyle = fg; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16);
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  lines.forEach(([t, size, font], i) => { x.font = `700 ${size}px ${font || "'Noto Sans Devanagari', sans-serif"}`; x.fillText(t, w / 2, h * (i + 0.5) / lines.length + 4); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function signMesh(tex, w, h, lit = 1) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(lit, lit, lit), toneMapped: false, fog: true }));
  return m;
}

// A metro entrance: a stairwell going down behind a low parapet, a canopy, and the red M on a post.
// Local frame: the open end (where you go down) faces +Z.
function kiosk(scene, mats, P, x, y, z, yaw, label) {
  const g = new THREE.Group();
  const C = 0x8a8a84, D = 0x3a3a3c, R = 0xb8261e, p = [];
  // stairwell: dark steps falling away
  for (let i = 0; i < 7; i++) p.push(part(Bx(2.1, 0.06, 0.42), i % 2 ? 0x1c1c1e : 0x262628, 0, 0.03, 1.3 - i * 0.42));
  p.push(part(Bx(2.1, 0.02, 3.0), 0x050506, 0, 0.012, -0.2));
  // parapet round three sides, rails on top
  p.push(part(Bx(0.22, 0.95, 3.6), C, 1.2, 0.475, -0.1), part(Bx(0.22, 0.95, 3.6), C, -1.2, 0.475, -0.1), part(Bx(2.62, 0.95, 0.22), C, 0, 0.475, -1.8));
  p.push(part(Bx(0.06, 0.06, 3.6), 0x9a9a9a, 1.2, 1.12, -0.1), part(Bx(0.06, 0.06, 3.6), 0x9a9a9a, -1.2, 1.12, -0.1));
  // canopy on four posts
  for (const [px, pz] of [[1.25, 1.6], [-1.25, 1.6], [1.25, -1.75], [-1.25, -1.75]]) p.push(part(Bx(0.1, 2.7, 0.1), D, px, 1.35, pz));
  p.push(part(Bx(2.9, 0.08, 3.8), 0x2a3a44, 0, 2.75, -0.08, 0.06, 0, 0), part(Bx(3.0, 0.16, 0.12), R, 0, 2.62, 1.75));
  // the M post
  p.push(part(Cy(0.07, 0.07, 3.6, 8), D, 1.75, 1.8, 1.4));
  const body = new THREE.Mesh(merge(p), mats.vcol); g.add(body);
  const m = signMesh(signTexture([['M', 110, 'Rajdhani, sans-serif']], '#c0261c', '#ffffff', 160, 160), 0.7, 0.7, 1.4);
  m.position.set(1.75, 3.7, 1.42); g.add(m);
  const m2 = m.clone(); m2.rotation.y = Math.PI; m2.position.z = 1.38; g.add(m2);
  const board = signMesh(signTexture([[label[0], 64], [label[1], 40, 'Rajdhani, sans-serif']], '#13202c', '#e8f0f8', 512, 160), 2.6, 0.8, 1.15);
  board.position.set(0, 2.25, 1.83); g.add(board);
  g.position.set(x, y, z); g.rotation.y = yaw;
  g.updateMatrixWorld(true);
  g.traverse((o) => { o.matrixAutoUpdate = false; });
  scene.add(g);
  // colliders: the parapet (you go in at the open end), the posts
  const c = Math.cos(yaw), s = Math.sin(yaw), W = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const add = (lx, lz, hx, hy, hz) => { const [wx, wz] = W(lx, lz); P.add(wx, y + hy, wz, hx, hy, hz, yaw); };
  add(1.2, -0.1, 0.12, 0.6, 1.8); add(-1.2, -0.1, 0.12, 0.6, 1.8); add(0, -1.8, 1.3, 0.6, 0.12);
  add(0, -0.1, 1.08, 0.35, 1.7);                     // the stairwell itself: you take the stairs with USE
  add(1.75, 1.4, 0.1, 1.8, 0.1);
  const [ux, uz] = W(0, 2.0), [ax, az] = W(0, 3.6);
  return { group: g, use: [ux, y + 1.0, uz], arrive: [ax, az, yaw], light: (() => { const [lx, lz] = W(1.75, 1.6); return { x: lx, y: y + 3.4, z: lz }; })() };
}

// ---------- path-finding inside a place: the town's flow field, on the place's own grid ----------
class PlaceNav {
  constructor(f) {
    this.f = f; this.w = f.nx; this.h = f.nz; this.cs = f.cs;
    this.dist = new Uint16Array(this.w * this.h); this.queue = new Int32Array(this.w * this.h);
    this.valid = false;
  }
  idx(x, z) { const i = Math.floor((x - this.f.x0) / this.cs), k = Math.floor((z - this.f.z0) / this.cs); return i < 0 || k < 0 || i >= this.w || k >= this.h ? -1 : k * this.w + i; }
  free(x, z) { const i = this.idx(x, z); return i >= 0 && !Number.isNaN(this.f.H[i]); }
  build(tx, tz) {
    const H = this.f.H, D = this.dist, Q = this.queue, w = this.w;
    D.fill(65535); this.valid = false;
    let s = this.idx(tx, tz);
    if (s < 0) return;
    if (Number.isNaN(H[s])) {                       // against a wall: start from the nearest open cell
      let best = -1;
      for (let r = 1; r < 5 && best < 0; r++) for (let dk = -r; dk <= r && best < 0; dk++) for (let di = -r; di <= r; di++) { const j = s + dk * w + di; if (j >= 0 && j < H.length && !Number.isNaN(H[j])) { best = j; break; } }
      if (best < 0) return; s = best;
    }
    let head = 0, tail = 0; D[s] = 0; Q[tail++] = s;
    while (head < tail) {
      const i = Q[head++], d = D[i], ix = i % w, hi = H[i];
      for (let k = 0; k < 4; k++) {
        if ((k === 0 && ix === w - 1) || (k === 1 && ix === 0)) continue;
        const j = k === 0 ? i + 1 : k === 1 ? i - 1 : k === 2 ? i + w : i - w;
        if (j < 0 || j >= H.length || D[j] !== 65535) continue;
        const hj = H[j];
        if (Number.isNaN(hj) || Math.abs(hj - hi) > 0.6) continue;
        D[j] = d + 1; Q[tail++] = j;
      }
    }
    this.valid = true;
  }
  flow(x, z) {
    if (!this.valid) return null;
    const i = this.idx(x, z); if (i < 0) return null;
    const D = this.dist, w = this.w, ix = i % w;
    const here = D[i];
    let best = here, bi = -1;
    for (let dk = -1; dk <= 1; dk++) for (let di = -1; di <= 1; di++) {
      if (!di && !dk) continue;
      if ((ix === 0 && di < 0) || (ix === w - 1 && di > 0)) continue;
      const j = i + dk * w + di; if (j < 0 || j >= D.length) continue;
      if (di && dk && (D[i + di] === 65535 || D[i + dk * w] === 65535)) continue;
      const d = D[j] + (di && dk ? 0.4 : 0);
      if (d < best) { best = d; bi = j; }
    }
    if (bi < 0) return null;
    const tx = this.f.x0 + ((bi % w) + 0.5) * this.cs, tz = this.f.z0 + (((bi / w) | 0) + 0.5) * this.cs;
    const dx = tx - x, dz = tz - z, l = Math.hypot(dx, dz) || 1;
    return [dx / l, dz / l, here];
  }
}

// ======================================================================================
export class Outlands {
  constructor(game) {
    this.g = game;
    this.places = {};             // key -> { root, field, nav, rect, lights, ... } once loaded
    this.prog = {};               // key -> download progress 0..1
    this.zone = null;             // the place you are in (null: Jais)
    this.travel = null; this.inGate = null;
    this.spawned = {};
    this.creatures = null;
  }

  // ================= with the town (before navigation and the light pool) =================
  buildStatic(W, scene, mats) {
    const P = W.P;
    this.scene = scene; this.mats = mats; this.W = W;
    // ---- the highway out of town at the end of the Amethi road ----
    const r = ROADS.SE, i = roadInfo(r);
    this.hwy = { r, i };
    const at = (t, off) => [r.a[0] + i.ux * t + i.nx * off, r.a[1] + i.uz * t + i.nz * off];
    const [sx, sz] = at(i.len - 7, r.w / 2 + 1.8);
    const g = new THREE.Group(), p = [];
    for (const o of [-1.9, 1.9]) p.push(part(Cy(0.08, 0.08, 4.4, 8), 0x6a6e70, o, 2.2, 0));
    p.push(part(Bx(4.3, 1.7, 0.06), 0x1a1a1a, 0, 3.45, -0.05));
    g.add(new THREE.Mesh(merge(p), mats.vcol));
    const board = signMesh(signTexture([['लखनऊ हाईवे →', 74], ['HIGHWAY · FOREST ROAD', 40, 'Rajdhani, sans-serif']], '#0d5a2e', '#f4f4ee', 512, 200), 4.2, 1.6, 0.95);
    board.position.set(0, 3.45, 0.0); g.add(board);
    g.position.set(sx, 0, sz); g.rotation.y = i.yaw + Math.PI;     // reads as you drive toward it
    scene.add(g);
    P.add(sx + Math.cos(i.yaw) * 1.9, 2, sz - Math.sin(i.yaw) * 1.9, 0.1, 2, 0.1); P.add(sx - Math.cos(i.yaw) * 1.9, 2, sz + Math.sin(i.yaw) * 1.9, 0.1, 2, 0.1);
    // a broken boom barrier lifted over the road, oil drums
    const [bx, bz] = at(i.len - 3, -r.w / 2 - 0.6);
    const bar = [];
    bar.push(part(Bx(0.3, 1.1, 0.3), 0x8a8a84, 0, 0.55, 0));
    for (let k = 0; k < 8; k++) bar.push(part(Bx(0.12, 0.12, 0.9), k % 2 ? 0xd8d8d0 : 0xc02020, 0, 1.15 + k * 0.38, 0.25 + k * 0.33, -0.86, 0, 0));
    const bm = new THREE.Mesh(merge(bar), mats.vcol); bm.position.set(bx, 0, bz); bm.rotation.y = i.yaw; scene.add(bm);
    P.add(bx, 0.55, bz, 0.18, 0.55, 0.18, i.yaw);
    for (const [t, off] of [[i.len - 9, -r.w / 2 - 1.2], [i.len - 8.2, -r.w / 2 - 1.9]]) {
      const [dx, dz] = at(t, off);
      const d = new THREE.Mesh(merge([part(Cy(0.3, 0.3, 0.9, 10), 0x3a5a7a, 0, 0.45, 0), part(Cy(0.31, 0.31, 0.06, 10), 0x2a2a2a, 0, 0.62, 0)]), mats.vcol);
      d.position.set(dx, 0, dz); scene.add(d); P.add(dx, 0.45, dz, 0.3, 0.45, 0.3);
    }
    W.lights.push({ x: sx, y: 4.6, z: sz, color: 0x9ad0ff, intensity: 5, dist: 13, flicker: 1 });
    LANDMARKS.push({ hi: 'हाईवे', en: 'Highway', x: sx - 6, z: sz - 6 });
    // ---- the metro entrance on the forecourt of Jais City station, its stairs open toward the town ----
    let spot = null;
    for (const [cx, cz] of [[-132, -143], [-132, -141], [-131, -145], [-117, -153]]) {
      if (P.groundAt(cx, cz, 3.4, 60) < 0.12) { spot = [cx, cz]; break; }
    }
    spot = spot || [-132, -143];
    this.townKiosk = kiosk(scene, mats, P, spot[0], 0, spot[1], 0, ['जायस मेट्रो', 'METRO · JAIS CITY']);
    W.lights.push({ ...this.townKiosk.light, color: 0xdfe8ff, intensity: 6, dist: 13 });
    LANDMARKS.push({ hi: 'मेट्रो', en: 'Metro', x: spot[0] + 8, z: spot[1] + 4 });
  }

  // ================= loading, in the background =================
  // The pickup and the creatures come first (they live in town). The three places (about 8 MB) wait until a
  // run has been going a little while, or until you head for the highway or a metro entrance.
  start() {
    if (this._started) return; this._started = true;
    this.queue = Promise.resolve();
    const step = (name, path, fn) => () => loadGLB(path, (k) => { this.prog[name] = k; }).then((m) => { this.prog[name] = 1; fn(m); }).catch((e) => { console.warn('could not load', path, e); this.prog[name] = -1; });
    this._chain([
      () => new Promise((r) => setTimeout(r, this.g.mobile ? 2500 : 800)),
      step('truck', 'models/truck.glb', (m) => this._truck(m)),
      step('hound', 'models/hound.glb', (m) => this._creature('hound', m)),
      step('ghoul', 'models/ghoul.glb', (m) => this._creature('ghoul', m)),
    ]);
  }
  startPlaces() {
    if (this._placesStarted) return; this._placesStarted = true;
    this._chain(['forest', 'city', 'metro'].map((k) => () => Promise.all([
      loadGLB(PLACES[k].model, (p) => { this.prog[k] = p * 0.97; }),
      fetch(ASSET_ROOT + PLACES[k].bake).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    ]).then(([m, b]) => { this._place(k, m, b); this.prog[k] = 1; }).catch((e) => { console.warn('could not load', k, e); this.prog[k] = -1; })));
  }
  // one download after another: the town keeps the bandwidth it needs
  _chain(jobs) { for (const j of jobs) this.queue = this.queue.then(j); }

  _truck(gltf) {
    const root = lambertize(gltf.scene, false, 0.04);
    const wheels = {};
    root.traverse((o) => { const m = /^wheel_(LF|RF|LB|RB)$/.exec(o.name); if (m) wheels[m[1]] = o; });
    this.g.vehicles.setTruck({ root, wheels });
  }

  _creature(kind, gltf) {
    const g = this.g;
    if (!this.creatures) { this.creatures = new Creatures(g); g.enemies.creatures = this.creatures; }
    this.creatures.add(kind, gltf);
    if ((g.state === 'play' || g.state === 'pause') && this.creatures.has('ghoul') && this.creatures.has('hound')) { this.spawnTown(); if (this.zone) this.enterPlace(this.zone); }
  }

  _place(key, gltf, B) {
    const g = this.g, Z = PLACES[key], [ox, oz] = Z.o, P = g.physics;
    const root = lambertize(gltf.scene, !!Z.normals, 0);
    if (key === 'forest') root.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.alphaTest) { m.alphaTest = 0.5; m.transparent = false; m.side = THREE.DoubleSide; } });
    root.scale.setScalar(B.scale); root.position.set(ox, B.yoff, oz);
    root.updateMatrixWorld(true);
    root.traverse((o) => { o.matrixAutoUpdate = false; });
    root.visible = this.zone === key;
    g.scene.add(root);
    // collision
    for (const [cx, cz, hx, hz, y0, y1] of B.boxes) P.add(ox + cx, (y0 + y1) / 2, oz + cz, hx, (y1 - y0) / 2, hz);
    // the walkable grid (heights in metres, NaN where you can't stand)
    const f = B.field, raw = atob(f.h), u = new Uint16Array(f.nx * f.nz);
    for (let i = 0; i < u.length; i++) u[i] = raw.charCodeAt(i * 2) | (raw.charCodeAt(i * 2 + 1) << 8);
    const H = new Float32Array(u.length);
    for (let i = 0; i < u.length; i++) H[i] = u[i] ? (u[i] - 1) / 100 : NaN;
    const field = { x0: ox + f.x0, z0: oz + f.z0, cs: f.cs, nx: f.nx, nz: f.nz, H };
    field.x1 = field.x0 + f.nx * f.cs; field.z1 = field.z0 + f.nz * f.cs;
    field.at = (x, z) => {
      const fx = (x - field.x0) / field.cs - 0.5, fz = (z - field.z0) / field.cs - 0.5;
      const i0 = Math.max(0, Math.min(field.nx - 2, Math.floor(fx))), k0 = Math.max(0, Math.min(field.nz - 2, Math.floor(fz)));
      const tx = Math.max(0, Math.min(1, fx - i0)), tz = Math.max(0, Math.min(1, fz - k0));
      let s = 0, w = 0;
      for (const [di, dk, ww] of [[0, 0, (1 - tx) * (1 - tz)], [1, 0, tx * (1 - tz)], [0, 1, (1 - tx) * tz], [1, 1, tx * tz]]) {
        const h = H[(k0 + dk) * field.nx + i0 + di];
        if (!Number.isNaN(h) && ww > 0) { s += h * ww; w += ww; }
      }
      return w > 0 ? s / w : 0;
    };
    if (Z.terrain) (P.fields || (P.fields = [])).push(field);
    const pl = { key, root, field, nav: new PlaceNav(field), rect: [field.x0 - 2, field.z0 - 2, field.x1 + 2, field.z1 + 2], L: (x, z) => [ox + x, oz + z] };
    this.places[key] = pl;
    // lights, signs and the rest of the dressing for each place
    const W = this.W, lit = (x, z, y, color, intensity, dist, flicker = 0) => { const [wx, wz] = pl.L(x, z); const s = { x: wx, y, z: wz, color, intensity, dist, flicker, on: true, phase: Math.random() * 100 }; W.lights.push(s); return s; };
    const floor = (x, z) => { const [wx, wz] = pl.L(x, z); return P.groundAt(wx, wz, 0.2, 60); };
    if (key === 'forest') {
      const [cx, cz] = pl.L(CAMP[0], CAMP[1]), cy = field.at(cx, cz);
      this.camp = { x: cx, y: cy, z: cz, acc: [0, 0], phase: 0 };
      this.camp.light = lit(CAMP[0], CAMP[1], cy + 1.6, 0xff7a24, 12, 18, 1);
      // the burnt camp: logs round the fire, a collapsed tent, crates
      const p = [];
      for (let k = 0; k < 6; k++) { const a = k * 1.05; p.push(part(Cy(0.09, 0.11, 1.1, 6), 0x2a1a10, Math.cos(a) * 0.35, 0.12, Math.sin(a) * 0.35, Math.PI / 2, a, 0)); }
      for (let k = 0; k < 8; k++) { const a = k * 0.785; p.push(part(Bx(0.28, 0.2, 0.22), 0x4a4a48, Math.cos(a) * 0.75, 0.1, Math.sin(a) * 0.75, 0, a, 0)); }
      p.push(part(Bx(2.6, 0.06, 2.2), 0x3a4a2a, 3.2, 0.7, -0.6, 0.55, 0.3, 0), part(Bx(2.6, 0.06, 2.2), 0x34442a, 3.4, 0.45, 0.9, -0.35, 0.3, 0.1));
      p.push(part(Bx(0.8, 0.6, 0.6), 0x6a5034, -2.2, 0.3, 1.4, 0, 0.4, 0), part(Bx(0.6, 0.45, 0.5), 0x5a4228, -2.0, 0.82, 1.3, 0, 0.9, 0));
      const cm = new THREE.Mesh(merge(p), this.mats.vcol); cm.position.set(cx, cy, cz); g.scene.add(cm);
      P.add(cx - 2.2, cy + 0.5, cz + 1.4, 0.45, 0.5, 0.35, 0.4);
      pl.extra = [cm];
    } else if (key === 'city') {
      for (const [x, z] of CITY_LAMPS) lit(x, z, floor(x, z) + 4.1, 0xffae5a, 9, 16, Math.random() < 0.35 ? 1 : 0);
      const [kx, kz] = pl.L(CITY_KIOSK.x, CITY_KIOSK.z);
      this.cityKiosk = kiosk(g.scene, this.mats, P, kx, floor(CITY_KIOSK.x, CITY_KIOSK.z), kz, CITY_KIOSK.yaw, ['मेट्रो', 'METRO']);
      W.lights.push({ ...this.cityKiosk.light, color: 0xdfe8ff, intensity: 7, dist: 14, on: true, phase: 0 });
      // the road out, at the bottom of the avenue
      const sg = signMesh(signTexture([['जंगल का रास्ता ↓', 64], ['FOREST ROAD · JAIS', 38, 'Rajdhani, sans-serif']], '#0d5a2e', '#f4f4ee', 512, 180), 3.4, 1.2, 0.9);
      const [qx, qz] = pl.L(-3.5, 38); sg.position.set(qx, floor(-3.5, 38) + 3.2, qz); sg.rotation.y = Math.PI; g.scene.add(sg);
      pl.extra = [this.cityKiosk.group, sg];
    } else if (key === 'metro') {
      for (const [x, z] of METRO_RING) lit(x, z, 4.0, 0xc8dcff, 6, 12, Math.random() < 0.5 ? 1 : 0);
      for (const s of [-1, 1]) { lit(-4, 33 * s, 5.6, 0xffe4b8, 7, 14, 0); lit(4, 33 * s, 5.6, 0xffe4b8, 7, 14, 1); lit(0, 24 * s, 3.4, 0xc8dcff, 5, 10, 1); }
      // exit signs and dark doorways at the east end of each hall
      this.metroExits = [];
      for (const [s, hi, en, to] of [[1, '↑ निकास · शहर', 'EXIT · CITY', 'cityKiosk'], [-1, '↑ निकास · जायस', 'EXIT · JAIS CITY', 'townKiosk']]) {
        const [x, z] = pl.L(8.02, 33 * s), y = floor(7.5, 33 * s);     // the hall's east end wall
        const door = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.5), new THREE.MeshBasicMaterial({ color: 0x020203 }));
        door.position.set(x - 0.05, y + 1.25, z); door.rotation.y = -Math.PI / 2; g.scene.add(door);
        const sg = signMesh(signTexture([[hi, 58], [en, 38, 'Rajdhani, sans-serif']], '#0e6a34', '#ffffff', 512, 170), 1.9, 0.63, 1.3);
        sg.position.set(x - 0.06, y + 2.95, z); sg.rotation.y = -Math.PI / 2; g.scene.add(sg);
        lit(6.6, 33 * s, y + 2.9, 0xe0ffe8, 2.2, 6, 0);
        this.metroExits.push({ use: [x - 0.9, y + 1.2, z], to });
      }
      pl.extra = [];
    }
    for (const o of pl.extra || []) o.visible = this.zone === key;
    // a run already going: if you are standing in this place, it comes alive now
    if (this.zone === key) this.enterPlace(key);
  }

  // ================= per run =================
  reset() {
    this.setZone(null);
    this.travel = null; this.inGate = null; this.spawned = {}; this.townDone = false; this._crackle = null;
    this.fade(false, true);
    if (this.creatures && this.creatures.has('ghoul') && this.creatures.has('hound')) this.spawnTown();
  }

  // the ghouls and hounds loose in Jais (once per run, once their models are in)
  spawnTown() {
    const g = this.g, E = g.enemies;
    if (this.townDone || g.state === 'menu') return;
    this.townDone = true;
    const nav = g.nav; g.nav = g.townNav;              // spots are picked on the town's own grid, wherever you are
    const packs = [[150, 150], [-205, 120], [180, -40], [-60, 150]];
    packs.forEach(([cx, cz], n) => {
      const k = n < 2 ? 3 : 2;
      for (let i = 0; i < k; i++) { const p = g.freeSpot(cx, cz, 7, 45); if (p) E.spawn('hound', p[0], 0, p[1], { zone: 'hounds' + n, hold: n % 2 === 0 }); }
    });
    for (const [cx, cz] of [[60, -118], [18, 100], [-160, 58], [96, 40]]) { const p = g.freeSpot(cx, cz, 8, 45); if (p) E.spawn('ghoul', p[0], 0, p[1], { zone: 'ghoul' + cx }); }
    g.nav = nav;
  }

  // what lives in each place (once per run, on your first visit)
  enterPlace(key) {
    if (!this.places[key]) return;
    const S = this.spawned[key] || (this.spawned[key] = { first: false, beasts: false });
    const beasts = !!(this.creatures && this.creatures.has('ghoul') && this.creatures.has('hound'));
    if (S.first && (S.beasts || !beasts)) return;
    const first = !S.first; S.first = true; S.beasts = S.beasts || beasts;
    // make room: the town's idle stragglers far behind you are forgotten (the town fills up again when you are back)
    if (first) {
      const P = this.g.player.pos, E = this.g.enemies;
      for (let i = E.list.length - 1; i >= 0; i--) {
        const e = E.list[i];
        if (e.zone || e.tunnel || e.human) continue;
        if (e.dead || ((e.state === 'IDLE' || e.state === 'ALERT') && Math.hypot(e.pos.x - P.x, e.pos.z - P.z) > 150)) E.list.splice(i, 1);
      }
    }
    const g = this.g, E = g.enemies, pl = this.places[key], r = Math.random;
    const spot = (lx, lz, rad, avoid = 14) => {
      const P = g.player.pos;
      for (let k = 0; k < 30; k++) {
        const a = r() * 6.283, d = k === 0 ? 0 : r() * rad, [x, z] = pl.L(lx + Math.cos(a) * d, lz + Math.sin(a) * d);
        if (!pl.nav.free(x, z) || Math.hypot(x - P.x, z - P.z) < avoid) continue;
        const i = pl.nav.idx(x, z);
        return [x, pl.field.H[i] + 0.05, z];
      }
      return null;
    };
    const put = (type, lx, lz, rad, o = {}) => {
      const model = type === 'ghoul' || type === 'hound';
      if (model ? !beasts : !first) return null;           // the zombies come with the first visit, the beasts when they have loaded
      const p = spot(lx, lz, rad); return p ? E.spawn(type, p[0], p[1], p[2], { zone: 'out-' + key + (o.pack || ''), frozen: !o.awake, hold: !!o.hold, yaw: r() * 6.28 }) : null;
    };
    const drop = (it, lx, lz, rad) => { if (!first) return; const p = spot(lx, lz, rad, 4); if (p) g.loot.drop({ ...it, p: [p[0], p[1] + 0.03, p[2]] }); };
    const ammo = () => { const a = rollAmmo(g.rng, g.arsenal.owned); return { kind: 'ammo', id: a.t, n: a.n }; };
    const food = () => ({ kind: 'food', id: rollFood(g.rng) });
    if (key === 'forest') {
      // hound packs along the road, a few ghouls in the trees, walkers drifting
      for (const [i, n] of [[3, 3], [6, 4], [9, 3], [12, 3]]) for (let k = 0; k < n; k++) put('hound', ROAD_F[i][0] + (r() - 0.5) * 16, ROAD_F[i][1] + (r() - 0.5) * 16, 6, { pack: 'p' + i, hold: true });
      for (const [x, z] of [[-35, 30], [10, -30], [35, 10]]) put('ghoul', x, z, 8);
      put('ghoul', CAMP[0] + 3, CAMP[1] - 3, 3, { pack: 'camp', hold: true });
      for (let k = 0; k < 5; k++) { const p = ROAD_F[(r() * ROAD_F.length) | 0]; put(r() < 0.3 ? 'runner' : 'walker', p[0] + (r() - 0.5) * 30, p[1] + (r() - 0.5) * 30, 6); }
      // what the campers left
      drop({ kind: 'weapon', id: 'dunali' }, CAMP[0] + 1.5, CAMP[1] + 2, 1);
      drop(ammo(), CAMP[0] - 1.6, CAMP[1] + 1.2, 1); drop(food(), CAMP[0] + 2, CAMP[1] - 1.5, 1); drop({ kind: 'bomb', id: 'bomb' }, CAMP[0] - 2.4, CAMP[1] + 1.8, 1);
      for (const i of [2, 5, 8, 11]) drop(r() < 0.6 ? ammo() : food(), ROAD_F[i][0], ROAD_F[i][1], 5);
    } else if (key === 'city') {
      for (const [x, z] of [[-12, 20], [-12, -5], [-6, -25], [8, -30], [-30, 10], [25, 10], [20, -42]]) put('ghoul', x, z, 6, { pack: 'g' + x });
      for (let k = 0; k < 9; k++) put(r() < 0.2 ? 'runner' : r() < 0.1 ? 'brute' : 'walker', -12 + (r() - 0.5) * 20, 40 - r() * 75, 8);
      for (let k = 0; k < 3; k++) put('hound', 30, 25, 5, { pack: 'h', hold: true });
      drop({ kind: 'weapon', id: 'rifle' }, 30, 30, 4);
      for (const [x, z] of [[-30, 25], [-14, 0], [5, -20], [22, -36], [33, 0], [-10, -30]]) drop(r() < 0.65 ? ammo() : food(), x, z, 4);
      drop({ kind: 'bomb', id: 'bomb' }, -28, 40, 3);
    } else if (key === 'metro') {
      for (const [x, z] of [[25.7, 4], [-25.7, -6], [0, 18.5], [-10, -17.8]]) put('ghoul', x, z, 2.5, { pack: 'g' + x });
      for (const [x, z] of [[20, 14], [-20, 15], [25.7, -12], [-25.7, 8], [12, -17.8]]) put(r() < 0.25 ? 'runner' : 'walker', x, z, 3);
      for (let k = 0; k < 2; k++) put('hound', 0, -18, 3, { pack: 'h', hold: true });
      for (const [x, z] of [[25.7, -2], [-25.7, 2], [8, 18], [-6, -18], [0, 30], [0, -30]]) drop(r() < 0.6 ? ammo() : food(), x, z, 2);
      drop({ kind: 'bomb', id: 'bomb' }, 25.7, 12, 2); drop({ kind: 'bomb', id: 'bomb' }, -25.7, -12, 2);
    }
  }

  // ================= where you are =================
  setZone(key) {
    const g = this.g;
    if (key === this.zone) return;
    this.zone = key;
    const fog = g.scene.fog, Z = key && PLACES[key];
    const [col, den] = Z ? Z.fog : TOWN_FOG;
    fog.color.setHex(col); fog.density = den;
    for (const k in this.places) { const pl = this.places[k]; pl.root.visible = k === key; for (const o of pl.extra || []) o.visible = k === key; }
    g.nav = key && this.places[key] ? this.places[key].nav : g.townNav;
    g.flowT = 0;
    if (key) this.enterPlace(key);
  }
  get indoor() { return !!(this.zone && PLACES[this.zone].indoor); }
  surface() { return this.zone ? PLACES[this.zone].surface : null; }
  _detect() {
    const p = this.g.player.pos;
    for (const k in this.places) { const R = this.places[k].rect; if (p.x > R[0] && p.x < R[2] && p.z > R[1] && p.z < R[3]) return k; }
    return null;
  }

  // ================= the roads and stairs between places =================
  // A place's arrival point: [x, z, yaw] in the world.
  arrival(name) {
    const H = this.hwy, F = this.places.forest, C = this.places.city, M = this.places.metro;
    switch (name) {
      case 'town': { const t = H.i.len - 22, off = H.r.w * 0.18; return [H.r.a[0] + H.i.ux * t + H.i.nx * off, H.r.a[1] + H.i.uz * t + H.i.nz * off, H.i.yaw + Math.PI]; }
      case 'forestS': return F && [...F.L(10.5, 51), -2.18];
      case 'forestN': return F && [...F.L(29.5, -41), 0.26];
      case 'cityS': return C && [...C.L(-12, 35), Math.PI];
      case 'cityKiosk': return this.cityKiosk && this.cityKiosk.arrive;
      case 'townKiosk': return this.townKiosk.arrive;
      case 'metroS': return M && [...M.L(0, 32), Math.PI];
      case 'metroN': return M && [...M.L(0, -32), 0];
    }
    return null;
  }

  // the road ends you drive or walk into
  _gate() {
    const p = this.g.player.pos, H = this.hwy;
    if (!this.zone) {
      const dx = p.x - H.r.a[0], dz = p.z - H.r.a[1];
      const along = dx * H.i.ux + dz * H.i.uz, across = Math.abs(dx * H.i.nx + dz * H.i.nz);
      if (along > H.i.len - 2.5 && across < H.r.w / 2 + 4) return { id: 'hwy', place: 'forest', to: 'forestS' };
      return null;
    }
    const lx = p.x - PLACES[this.zone].o[0], lz = p.z - PLACES[this.zone].o[1];
    if (this.zone === 'forest') {
      if (lz > 58.5 && lx > 6 && lx < 34) return { id: 'fS', to: 'town' };
      if (lz < -45.8 && lx > 16 && lx < 38) return { id: 'fN', place: 'city', to: 'cityS' };
    } else if (this.zone === 'city') {
      if (lz > 41.2 && lx > -25 && lx < 1) return { id: 'cS', place: 'forest', to: 'forestN' };
    }
    return null;
  }

  go(to, place) {
    const g = this.g;
    if (this.travel) return;
    if (place && !this.places[place]) {
      this.startPlaces();
      const k = this.prog[place];
      if (k === -1) g.toast('रास्ता बंद है', 'This way is blocked tonight (it could not be loaded).');
      else g.toast('रास्ता अभी खुल रहा है…', `The way ahead is still loading — ${Math.round((k || 0) * 100)}%. Try again in a moment.`);
      g.audio.play('beepLow', { vol: 0.35 });
      return;
    }
    this.travel = { to, t: 0, done: false };
    this.fade(true);
    g.audio.play(g.vehicles.driving ? 'whoosh' : 'rustle', { vol: 0.5 });
  }

  _arrive(to) {
    const g = this.g, P = g.player, V = g.vehicles;
    const a = this.arrival(to); if (!a) return;
    const [x, z, yaw] = a;
    const y = Math.max(0, g.physics.groundAt(x, z, 0.25, 80));
    if (V.driving) { V.teleport(x, y, z, yaw); V.car.speed = Math.max(-5, Math.min(V.car.speed, 9)); }
    else { P.spawn(x, y, z, yaw); if (P.vel) P.vel.set(0, 0); P.state.fall = 0; }
    // the place you left forgets you
    for (const e of g.enemies.list) if (!e.dead && (e.state === 'CHASE' || e.state === 'ATTACK') && Math.hypot(e.pos.x - x, e.pos.z - z) > 120) { e.state = e.human ? 'PATROL' : 'IDLE'; e.alert = 0; e.stateT = 0; e.lastSeen = null; }
    g.chaseOn = false; g._chaseHold = 0; if (g.audio.fade) g.audio.fade('zombieChase', 0, 0.5);
    this.setZone(this._detect());
    this.inGate = this._gate()?.id || null;
    g.nav.build(P.pos.x, P.pos.z); g.flowT = 0.35;
  }

  fade(on, instant) {
    const el = document.getElementById('travelFx'); if (!el) return;
    el.classList.toggle('instant', !!instant);
    el.classList.toggle('on', !!on);
  }

  // ================= every frame (from Game.afterMove) =================
  update(dt) {
    const g = this.g;
    if (!this._placesStarted && this._started) {
      const p = g.player.pos, H = this.hwy.r.b, K = this.townKiosk.use;
      if (g.stats.t > 20 || Math.hypot(p.x - H[0], p.z - H[1]) < 70 || Math.hypot(p.x - K[0], p.z - K[2]) < 50) this.startPlaces();
    }
    if (this.travel) {
      const T = this.travel; T.t += dt;
      if (!T.done && T.t >= 0.5) { T.done = true; this._arrive(T.to); this.fade(false); }
      if (T.t > 1.2) this.travel = null;
    } else {
      this.setZone(this._detect());
      const gate = this._gate();
      const id = gate ? gate.id : null;
      if (id && id !== this.inGate) this.go(gate.to, gate.place);
      this.inGate = id;
    }
    // the camp fire in the forest
    if (this.zone === 'forest' && this.camp) this._fire(dt);
  }

  _fire(dt) {
    const g = this.g, X = g.explosives, c = this.camp;
    if (!X || !X.fire) return;
    c.acc[0] += dt * 26;
    while (c.acc[0] >= 1) {
      c.acc[0] -= 1;
      X.fire.emit(c.x + (Math.random() - 0.5) * 0.5, c.y + 0.2, c.z + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.3, 1.2 + Math.random() * 1.4, (Math.random() - 0.5) * 0.3,
        0.45 + Math.random() * 0.4, 0.9, 0.2, FIRE.core, FIRE.deep, 0.9, 1.6, 0.9);
    }
    c.acc[1] += dt * 4;
    while (c.acc[1] >= 1) {
      c.acc[1] -= 1;
      X.smoke.emit(c.x + (Math.random() - 0.5) * 0.4, c.y + 1.4, c.z + (Math.random() - 0.5) * 0.4, 0.3 + (Math.random() - 0.5) * 0.3, 1.0 + Math.random() * 0.6, (Math.random() - 0.5) * 0.3,
        4 + Math.random() * 2, 0.8, 4.5, [0.3, 0.18, 0.1], [0.16, 0.16, 0.17], 0.5, 0.3, 0.15);
    }
    if (!this._crackle && g.audio.ctx) { this._crackle = g.audio.loop('fire', 0.7, g.audio.amb, Object.assign([c.x, c.y + 1, c.z], { ref: 3 })); g.audio.loops.campfire = this._crackle; }
  }

  // ================= the metro stairs (USE) =================
  consider(fn) {
    if (this.travel) return;
    if (!this.zone && this.townKiosk) fn(this.townKiosk.use, 2.6, { type: 'outland', to: 'metroN', place: 'metro', hi: 'मेट्रो · नीचे जाएँ', en: 'go down to the metro', act: 'ENTER' });
    if (this.zone === 'city' && this.cityKiosk) fn(this.cityKiosk.use, 2.6, { type: 'outland', to: 'metroS', place: 'metro', hi: 'मेट्रो · नीचे जाएँ', en: 'go down to the metro', act: 'ENTER' });
    if (this.zone === 'metro' && this.metroExits) for (const e of this.metroExits) fn(e.use, 2.6, { type: 'outland', to: e.to, place: e.to === 'cityKiosk' ? 'city' : null, hi: e.to === 'cityKiosk' ? 'सीढ़ियाँ · शहर' : 'सीढ़ियाँ · जायस', en: e.to === 'cityKiosk' ? 'climb up to the city' : 'climb up to Jais City station', act: 'CLIMB' });
  }
  prompt(t) { return [t.act, `${t.hi} · ${t.en}`]; }
  use(t) { this.go(t.to, t.place); }
}

