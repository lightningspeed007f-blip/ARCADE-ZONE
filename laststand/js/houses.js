// Walk-in houses built from uploaded models. They stand where the town used to put plain box houses (the
// street rows away from the bazaar, and the blocks behind them), and you can walk into every one.
//
//   models/houses/american.glb    a two-storey clapboard house with a porch and a garage
//   models/houses/apocalypse.glb  a rusty-roofed shack with a lean-to
//   models/houses/abandoned.glb   a collapsing timber house (open doorway, no door left)
//   models/houses/wooden.glb      a plank house on a concrete base, ladder to the balcony
//   models/houses/farm.glb        a square farmhouse on a stone plinth, front and side doors
//   models/houses/japan.glb       a narrow Japanese shop-house
//   models/houses/old.glb         a low timber cottage with a veranda
//   models/houses/test.glb        a small clapboard cabin with a brick chimney
//   models/houses/horror.glb      a big two-storey house with a wraparound porch
//   models/houses/hunters.glb     THE HUNTER'S REST: an arched castle door, a scanned stone corridor and a candle-lit
//                                 crypt hall (three uploads put together, scripts/houses/hunters.mjs). Only one, on its
//                                 own lot (world.js), and one of the crew always waits in it (companions.js). The game
//                                 builds its outer walls and roof (the hall came as an open cut-away) and hangs the
//                                 door's two leaves (models/houses/hunters_door.glb) so they swing.
//
// Everything that matters for play is fixed when the town is built (housedata.js, baked from the models):
// the walls, floors and steps are colliders, the doorways carry the game's own doors (open, close, kick,
// locked now and then, broken by zombies), a few floor spots get loot, and the house counts as indoors.
// The models only draw: they load during the loading screen (about 6 MB), one InstancedMesh per part, and
// every frame only the houses in front of the camera and within sight are drawn.
import * as THREE from 'three';
import { HOUSE_DATA } from './housedata.js';
import { Frame, door } from './interiors.js';
import { loadGLB, lambertize } from './models.js';
import { SCENIC } from './scenery.js';

// the town's random houses (a special one has its own lot)
export const HOUSE_KINDS = Object.keys(HOUSE_DATA).filter((k) => !HOUSE_DATA[k].special);
// a dark model reads better with a little of its own colour as glow
const GLOW = { hunters: 0.28 };
// the outer walls the game builds round a model: dark stone
const SHELL_COL = [0.3, 0.29, 0.31];
// how often each kind is picked (the big ones are hard to fit anyway; the wooden one is the heaviest to draw)
const WEIGHT = { american: 1, apocalypse: 1.2, abandoned: 0.9, wooden: 0.7, farm: 1.1, japan: 1, old: 1.3, test: 1.3, horror: 0.6 };
// and at most this many of each in town (about 70 in all: every one is walk-in, and they cost more to draw than a box)
const CAP = { american: 7, apocalypse: 9, abandoned: 8, wooden: 5, farm: 8, japan: 9, old: 10, test: 10, horror: 2 };
const VIEW = 175;            // camera far plane is 170 m
const SCENIC_VIEW = 140;     // the look-only houses: past this they are lost in the haze anyway, so they aren't drawn

export function houseSize(kind) {
  const f = HOUSE_DATA[kind].foot;
  return { w: f[2] - f[0], d: f[3] - f[1] };
}

// Kinds in a random order, heavier weights first more often.
export function pickKinds(W, r) {
  const n = W.houseCount || {};
  return HOUSE_KINDS.filter((k) => (n[k] || 0) < CAP[k]).map((k) => [k, -Math.log(1 - r() * 0.999) / WEIGHT[k]]).sort((a, b) => a[1] - b[1]).map((a) => a[0]);
}

// Build one house. F0 is the lot: front edge centre (x, z) and the yaw the front faces away from.
// The model's footprint is centred on the lot across, its front edge on the lot's front.
export function placeHouse(W, F0, kind, name) {
  const D = HOUSE_DATA[kind], f = D.foot, P = W.P;
  const { w, d } = houseSize(kind);
  const ox = -(f[0] + f[2]) / 2, oz = -f[1];             // model frame -> lot frame
  const F = new Frame(W, F0.x, F0.z, F0.yaw);
  const b = { name, F, w, d, floors: 1, tpl: 'model', kind, spots: [] };
  (W.houseCount || (W.houseCount = {}))[kind] = (W.houseCount[kind] || 0) + 1;
  W.buildings.push(b);
  (W.enterables || (W.enterables = [])).push(b);
  W.currentBuilding = b;
  for (const q of D.boxes) {
    const [x, z] = F.p(q[0] + ox, q[1] + oz);
    P.add(x, (q[4] + q[5]) / 2, z, q[2], (q[5] - q[4]) / 2, q[3], F.yaw, q[6] ? 'slab' : null);
  }
  D.floors.forEach(([x0, z0, x1, z1, y], i) => {
    y += i * 0.012;                                         // overlapping rooms: no two surfaces at one height
    F.floorQuad('wood', x0 + ox, z0 + oz, x1 + ox, z1 + oz, y + 0.012, [0.62, 0.5, 0.4], 1.5);
    // these shells are hollow to the roof: a plain ceiling over the room
    F.box('plaster', (x0 + x1) / 2 + ox, y + 2.85, (z0 + z1) / 2 + oz, x1 - x0, 0.06, z1 - z0, [0.78, 0.76, 0.72], { collide: false, skip: ['top'] });
  });
  // walls and roof round a model that has none of its own (their colliders are in D.boxes, up to head height)
  for (const [x0, z0, x1, z1, y0, y1] of D.shell || []) {
    F.box('concrete', (x0 + x1) / 2 + ox, (y0 + y1) / 2, (z0 + z1) / 2 + oz, x1 - x0, y1 - y0, z1 - z0, SHELL_COL, { collide: false, uv: 3 });
  }
  for (const [x, y, z, color, intensity, dist] of D.lights || []) {
    const p = F.world(x + ox, y, z + oz);
    W.lights.push({ x: p[0], y: p[1], z: p[2], color, intensity, dist, flicker: 1, interior: true });
  }
  if (D.seat) b.seats = D.seat.map(([x, z]) => F.world(x + ox, 0, z + oz));
  for (const dd of D.doors) {
    if (dd.open) continue;
    if (dd.leaves) {
      // a double door: two leaves, hinged at the two sides, that open together (never locked: someone waits inside)
      const hw = dd.w / 2, o = { w: hw, h: dd.h, label: 'दरवाज़ा', model: dd.leaves };
      const a = door(F, 'x', dd.z + oz, dd.x + ox - hw / 2, dd.y, Object.assign({ leaf: 'L' }, o));
      const c = door(F, 'x', dd.z + oz, dd.x + ox + hw / 2, dd.y, Object.assign({ leaf: 'R', flip: true }, o));
      a.pair = c; c.pair = a;
      continue;
    }
    const r = W.rng, locked = r.chance(0.12);
    if (dd.along === 'x') door(F, 'x', dd.z + oz, dd.x + ox, dd.y, { w: dd.w, h: dd.h, locked, label: locked ? 'बंद दरवाज़ा' : 'दरवाज़ा' });
    else door(F, 'z', dd.x + ox, dd.z + oz, dd.y, { w: dd.w, h: dd.h, locked, label: locked ? 'बंद दरवाज़ा' : 'दरवाज़ा' });
    if (locked) b.locked = true;
  }
  W.currentBuilding = null;
  // floor spots: all of them for people waiting indoors, three or so for loot
  const r = W.rng;
  b.spots = D.spots.map(([x, y, z]) => F.world(x + ox, y, z + oz));
  for (const p of r.shuffle(b.spots.slice()).slice(0, Math.min(3, b.spots.length))) W.lootSpots.push({ p: [p[0], p[1] + 0.05, p[2]], kind: 'any', w: 0.6, house: true });
  // drawing: the model's origin sits at the lot's (ox, oz)
  const [mx, mz] = F.p(ox, oz);
  const [cx, cz] = F.p(0, d / 2);
  (W.modelHouses || (W.modelHouses = [])).push({ kind, x: mx, z: mz, yaw: F.yaw, cx, cz, rad: Math.hypot(w, d) / 2 + 1, top: D.top + 4 });
  return b;
}

// a look-only house as one collider-style box [cx, cz, hx, hz, y0, y1]
const scenicBox = (S) => [(S.solid[0] + S.solid[2]) / 2, (S.solid[1] + S.solid[3]) / 2, (S.solid[2] - S.solid[0]) / 2, (S.solid[3] - S.solid[1]) / 2, 0, S.top];

// ---------- drawing ----------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _up = new THREE.Vector3(0, 1, 0);
const _sph = new THREE.Sphere(), _fr = new THREE.Frustum(), _pm = new THREE.Matrix4();

export class ModelHouses {
  constructor(scene, list) {
    this.scene = scene;
    this.list = list || [];
    this.byKind = {};
    for (const h of this.list) {
      (this.byKind[h.kind] || (this.byKind[h.kind] = [])).push(h);
      h.m = new THREE.Matrix4().compose(_p.set(h.x, 0, h.z), _q.setFromAxisAngle(_up, h.yaw), _s.setScalar(h.k || 1));   // k: a shop scaled to its lot
    }
    this.parts = {};           // kind -> [InstancedMesh]
  }

  // Load every kind that is in town; resolves when all have arrived or failed.
  load(onProgress) {
    const kinds = Object.keys(this.byKind), got = {};
    const tell = () => onProgress && onProgress(kinds.reduce((s, k) => s + (got[k] || 0), 0) / Math.max(1, kinds.length));
    // the walk-in houses, and the look-only ones from scenery.js
    const file = (k) => (SCENIC[k] ? SCENIC[k].file : 'models/houses/' + k + '.glb');
    return Promise.all(kinds.map((k) => loadGLB(file(k), (p) => { got[k] = p; tell(); })
      .then((gltf) => { got[k] = 1; tell(); this._build(k, gltf); })
      .catch((e) => { got[k] = 1; console.warn('could not load house', k, e); this._standIn(k); })));
  }

  _build(kind, gltf) {
    const S = SCENIC[kind];
    const root = lambertize(gltf.scene, false, S && S.glow != null ? S.glow : GLOW[kind] ?? 0.05);
    // a model drawn for unlit display has its light baked into its textures: brighten it so the town's light doesn't darken it twice
    // and one whose parts take their colour from the vertices needs that switched on
    if (S && (S.tint || S.vcol)) { const done = new Set(); root.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (!done.has(m)) { done.add(m); if (S.tint) m.color.multiplyScalar(S.tint); if (S.vcol) m.vertexColors = true; } }); }
    root.updateMatrixWorld(true);
    const n = this.byKind[kind].length, out = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      // the files are quantised (int16 positions scaled by the node): go to floats before baking the node in
      const geo = o.geometry.clone();
      for (const k of ['position', 'normal']) {
        const a = geo.attributes[k]; if (!a || a.array instanceof Float32Array) continue;
        const f = new Float32Array(a.count * 3);
        for (let i = 0; i < a.count; i++) { f[i * 3] = a.getX(i); f[i * 3 + 1] = a.getY(i); f[i * 3 + 2] = a.getZ(i); }
        geo.setAttribute(k, new THREE.BufferAttribute(f, 3));
      }
      geo.applyMatrix4(o.matrixWorld);
      const mats = [].concat(o.material);
      for (const m of mats) { m.side = THREE.DoubleSide; if (m.transparent && m.opacity > 0.9) { m.transparent = false; m.alphaTest = 0.5; } }
      const im = new THREE.InstancedMesh(geo, o.material, n);
      im.frustumCulled = false; im.count = 0;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.scene.add(im);
      out.push(im);
    });
    this.parts[kind] = out;
  }

  // a model that failed to download: draw its colliders as plain plaster blocks, so the walls are not invisible
  _standIn(kind) {
    const geos = [];
    const boxes = HOUSE_DATA[kind] ? HOUSE_DATA[kind].boxes : [scenicBox(SCENIC[kind])];
    for (const q of boxes) {
      if (q[6] || q[5] - q[4] < 0.3) continue;
      const g = new THREE.BoxGeometry(q[2] * 2, q[5] - q[4], q[3] * 2);
      g.translate(q[0], (q[4] + q[5]) / 2, q[1]);
      geos.push(g);
    }
    if (!geos.length) return;
    let n = 0; for (const g of geos) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), idx = [];
    let o = 0;
    for (const g of geos) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); for (const i of g.index.array) idx.push(i + o); o += g.attributes.position.count; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setIndex(idx);
    const im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xb8ae9c }), this.byKind[kind].length);
    im.frustumCulled = false; im.count = 0;
    this.scene.add(im);
    this.parts[kind] = [im];
  }

  // Every frame: only the houses in view and within sight go to the GPU.
  update(camera) {
    _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _fr.setFromProjectionMatrix(_pm);
    const cp = camera.getWorldPosition(_p);
    for (const kind in this.parts) {
      const parts = this.parts[kind];
      const far = SCENIC[kind] ? SCENIC_VIEW : VIEW;
      let n = 0;
      for (const h of this.byKind[kind]) {
        const dx = h.cx - cp.x, dz = h.cz - cp.z;
        if (dx * dx + dz * dz > (far + h.rad) * (far + h.rad)) continue;
        _sph.center.set(h.cx, h.top / 2, h.cz); _sph.radius = h.rad + h.top / 2;
        if (!_fr.intersectsSphere(_sph)) continue;
        for (const im of parts) im.setMatrixAt(n, h.m);
        n++;
      }
      for (const im of parts) { im.count = n; im.instanceMatrix.needsUpdate = true; }
    }
  }
}
