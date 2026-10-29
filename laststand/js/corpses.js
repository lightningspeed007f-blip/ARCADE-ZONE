// The dead of Jais: the uploaded bodies lying about the town, and rotten pumpkins among them.
// The bus adda has the most, in uneven heaps: some bodies in a pile, some alone in the gaps.
//   models/body1.glb     a body under a bloodstained sheet (about 2.2 x 2.8 m)
//   models/body2.glb     a body in grey wrapping, blood on the cloth (about 0.9 x 2.3 m)
//   models/body3.glb     a body under a dark cover (about 2.4 x 1.5 m)
//   models/bodybags.glb  six Christmas body bags in a row (about 5.6 x 1.9 m)
//   models/pumpkin.glb   a rotten pumpkin (scaled down to about 0.6 m across)
//   models/deer.glb      a dead deer (about 2 x 1.9 m)
//   models/hazmat.glb    a dead woman in a yellow hazmat suit, slumped (about 1 x 1.1 m)
//   models/people1..3.glb  a body under a cloth, three of them (scaled to about 2 x 1.5 m)
// The deer, the hazmat woman and the three covered bodies are scattered about the town too, and lie inside the
// walk-in houses (the dark rooms are the point). Zombies, crawlers included, feed on all of them.
// Placement runs once, when the town is built, from its own seeded random numbers, so the layout
// never changes between runs and the town's own layout stays as it was. The models load in the
// background after the town is ready. They have no colliders (you walk over them, like the sleepers).
import * as THREE from 'three';
import { makeRng } from './util.js';
import { loadGLB, lambertize } from './models.js';
import { BOUNDS, ZONES } from './layout.js';

const KINDS = {
  body1: { file: 'models/body1.glb', r: 1.3, s: [0.95, 1.05], town: 2, adda: 3 },
  body2: { file: 'models/body2.glb', r: 1.2, s: [0.95, 1.05], town: 2, adda: 3 },
  body3: { file: 'models/body3.glb', r: 1.3, s: [0.95, 1.05], town: 2, adda: 3 },
  bodybags: { file: 'models/bodybags.glb', r: 2.8, s: [0.97, 1.03], town: 1, adda: 1 },
  pumpkin: { file: 'models/pumpkin.glb', r: 0.5, s: [0.22, 0.3], town: 2, adda: 3 },
  // the later uploads: placed in a second pass (see NEW below), so the first layout stays as it was. feed: how far
  // from the middle a zombie crouches to eat; home: how often one lies in a house
  deer: { file: 'models/deer.glb', r: 1.1, s: [0.95, 1.05], town: 0, adda: 0, feed: 1.0, home: 0 },
  hazmat: { file: 'models/hazmat.glb', r: 0.75, s: [0.95, 1.05], town: 0, adda: 0, feed: 0.75, home: 2 },
  people1: { file: 'models/people1.glb', r: 1.2, s: [0.65, 0.72], town: 0, adda: 0, feed: 0.95, home: 1 },
  people2: { file: 'models/people2.glb', r: 1.2, s: [0.65, 0.72], town: 0, adda: 0, feed: 0.95, home: 1 },
  people3: { file: 'models/people3.glb', r: 1.3, s: [0.65, 0.72], town: 0, adda: 0, feed: 0.95, home: 1 },
};
const NEW = { deer: 3, hazmat: 3, people1: 2, people2: 2, people3: 2 };   // town weights of the later uploads
const NEW_TOWN = 18;        // of them across the town, outside the bus adda
const NEW_ADDA = 4;         // and in the bus adda's yard
const SINK = 0.05;          // a little below the ground: the bodies look pressed into the dirt, not floating
const TOWN_TARGET = 46;     // bodies scattered across the town, outside the bus adda
const ADDA_CLUSTERS = 5;    // piles of uneven size at the bus adda, plus loners in the gaps
const ADDA_LONERS = 6;
const ADDA_ZONE = ZONES.find((z) => z.en === 'BUS ADDA');

function pickKind(r, slot) {
  const keys = Object.keys(KINDS), total = keys.reduce((a, k) => a + KINDS[k][slot], 0);
  let v = r() * total;
  for (const k of keys) { v -= KINDS[k][slot]; if (v < 0) return k; }
  return keys[0];
}
// one of the weighted kinds (the later uploads, or the ones that lie indoors)
function pickFrom(r, weights) {
  const keys = Object.keys(weights), total = keys.reduce((a, k) => a + weights[k], 0);
  let v = r() * total;
  for (const k of keys) { v -= weights[k]; if (v < 0) return k; }
  return keys[0];
}

// Are we on bare ground, clear of walls, buses, carts, poles and trees? (their colliders are in P)
function clearAt(W, x, z, rad) { return W.P.groundAt(x, z, rad, 50) < 0.15; }
function spaced(list, x, z, r) { return list.every((c) => Math.hypot(c.x - x, c.z - z) >= (c.r + r) * 0.75); }

export function placeCorpses(W) {
  const r = makeRng(0xB0D1E5), list = [];
  const put = (k, x, z) => {
    const K = KINDS[k], s = r.range(K.s[0], K.s[1]);
    list.push({ k, x, z, y: 0, r: K.r, s, yaw: r() * Math.PI * 2, feed: K.feed });
  };

  // across the town: random spots on any clear ground (roads, lanes, yards, waste ground)
  let placed = 0;
  for (let tries = 0; tries < 900 && placed < TOWN_TARGET; tries++) {
    const x = r.range(BOUNDS.minX + 8, BOUNDS.maxX - 8), z = r.range(BOUNDS.minZ + 8, BOUNDS.maxZ - 8);
    if (x > ADDA_ZONE.x0 - 4 && x < ADDA_ZONE.x1 + 4 && z > ADDA_ZONE.z0 - 4 && z < ADDA_ZONE.z1 + 4) continue; // the adda has its own
    const k = pickKind(r, 'town'), R = KINDS[k].r;
    if (!clearAt(W, x, z, R) || !spaced(list, x, z, R)) continue;
    put(k, x, z); placed++;
  }

  // the bus adda: uneven piles in the yard, clear of the buses, the office, the shed and the walls
  const F = W.special.busAdda;
  if (F) {
    const yard = (lx, lz) => lx > -20 && lx < 20 && lz > 3.5 && lz < 27.5 && !(Math.abs(lx) < 6.5 && lz < 5);
    const gauss = () => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(Math.PI * 2 * r());
    const tryAt = (lx, lz, k) => {
      if (!yard(lx, lz)) return false;
      const [x, z] = F.p(lx, lz), R = KINDS[k].r;
      if (!clearAt(W, x, z, R) || !spaced(list, x, z, R)) return false;
      put(k, x, z); return true;
    };
    for (let c = 0; c < ADDA_CLUSTERS; c++) {
      const cx = r.range(-14, 14), cz = r.range(7, 24), spread = r.range(1.2, 3.2), want = r.int(1, 8);
      let got = 0;
      for (let tries = 0; tries < 40 && got < want; tries++) {
        if (tryAt(cx + gauss() * spread, cz + gauss() * spread, pickKind(r, 'adda'))) got++;
      }
    }
    for (let n = 0, tries = 0; n < ADDA_LONERS && tries < 200; tries++) {
      if (tryAt(r.range(-19, 19), r.range(4, 27), pickKind(r, 'adda'))) n++;
    }
  }

  // the later uploads, in a pass of their own with their own random numbers
  const r2 = makeRng(0xDEAD5E), put2 = (k, x, y, z, house) => {
    const K = KINDS[k];
    list.push({ k, x, z, y, r: K.r, s: r2.range(K.s[0], K.s[1]), yaw: r2() * Math.PI * 2, feed: K.feed, house });
  };
  let n2 = 0;
  for (let tries = 0; tries < 900 && n2 < NEW_TOWN; tries++) {
    const x = r2.range(BOUNDS.minX + 8, BOUNDS.maxX - 8), z = r2.range(BOUNDS.minZ + 8, BOUNDS.maxZ - 8);
    if (x > ADDA_ZONE.x0 - 4 && x < ADDA_ZONE.x1 + 4 && z > ADDA_ZONE.z0 - 4 && z < ADDA_ZONE.z1 + 4) continue;
    const k = pickFrom(r2, NEW), R = KINDS[k].r;
    if (!clearAt(W, x, z, R) || !spaced(list, x, z, R)) continue;
    put2(k, x, 0, z); n2++;
  }
  if (F) {
    for (let n = 0, tries = 0; n < NEW_ADDA && tries < 200; tries++) {
      const lx = r2.range(-19, 19), lz = r2.range(4, 27);
      if (!(lx > -20 && lx < 20 && lz > 3.5 && lz < 27.5 && !(Math.abs(lx) < 6.5 && lz < 5))) continue;
      const [x, z] = F.p(lx, lz), k = pickFrom(r2, NEW), R = KINDS[k].r;
      if (!clearAt(W, x, z, R) || !spaced(list, x, z, R)) continue;
      put2(k, x, 0, z); n++;
    }
  }

  // inside the walk-in houses: one or two bodies on the open floor (the Hunter's Rest gets three), clear of the
  // furniture and the loot. A dead house is a dark house.
  const home = {}; for (const k in KINDS) if (KINDS[k].home) home[k] = KINDS[k].home;
  const P = W.P, circle = P.constructor.circleOverlaps;
  const blocked = (x, y, z, rad) => P.query(x - rad, z - rad, x + rad, z + rad, []).some((b) => b.maxY > y + 0.35 && b.minY < y + 1.5 && circle(b, x, z, rad));
  for (const b of W.buildings) {
    if (b.tpl !== 'model' || !b.spots.length) continue;
    const want = b.kind === 'hunters' ? 3 : r2.chance(0.7) ? (r2.chance(0.4) ? 2 : 1) : 0;
    let got = 0;
    for (const p of r2.shuffle(b.spots.slice())) {
      if (got >= want) break;
      const k = pickFrom(r2, home), R = KINDS[k].r;
      if (W.lootSpots.some((l) => l.house && Math.hypot(l.p[0] - p[0], l.p[2] - p[2]) < R + 0.6 && Math.abs(l.p[1] - p[1]) < 1)) continue;
      if (!spaced(list, p[0], p[2], R) || blocked(p[0], p[1], p[2], R * 0.75)) continue;
      put2(k, p[0], p[1], p[2], true); got++;
    }
  }
  W.corpses = list;
  return list;
}

// Each model is one instanced mesh per primitive: the whole town costs a few draw calls.
export class Corpses {
  constructor(scene, list) {
    this.scene = scene;
    this.list = list || [];
    this.started = false;
    this.meshes = [];
  }

  start() {
    if (this.started) return;
    this.started = true;
    for (const key of Object.keys(KINDS)) {
      const items = this.list.filter((c) => c.k === key);
      if (!items.length) continue;
      loadGLB(KINDS[key].file)
        .then((gltf) => this.add(items, gltf))
        .catch((e) => console.warn('could not load', KINDS[key].file, e));
    }
  }

  add(items, gltf) {
    const root = lambertize(gltf.scene);
    root.updateMatrixWorld(true);
    // stand the body on the ground, centred on its own origin, so the yaw turns it in place
    const bb = new THREE.Box3().setFromObject(root);
    const base = new THREE.Matrix4().makeTranslation(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
    const meshes = [];
    root.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), sc = new THREE.Vector3(), m = new THREE.Matrix4();
    for (const o of meshes) {
      const im = new THREE.InstancedMesh(o.geometry, o.material, items.length);
      items.forEach((c, i) => {
        pos.set(c.x, (c.y || 0) + SINK, c.z);
        quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.yaw);
        sc.setScalar(c.s);
        m.compose(pos, quat, sc).multiply(base).multiply(o.matrixWorld);
        im.setMatrixAt(i, m);
      });
      im.instanceMatrix.needsUpdate = true;
      this.scene.add(im);
      this.meshes.push(im);
    }
  }
}
