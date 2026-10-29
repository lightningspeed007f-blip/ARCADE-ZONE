// The uploaded tree models, in place of the box-and-blob trees (props.js) everywhere in Jais, the valleys and on the
// shrine islands:
//
//   models/trees/pine.glb     a pine
//   models/trees/leafy.glb    a broadleaf with red-pink leaves (also every peepal, drawn bigger)
//   models/trees/dead.glb     a scanned bare, dead tree
//   models/trees/fallen.glb   a scanned fallen trunk ("drevo"), lying on the ground at a few of the spots
//
// Which model stands at a spot is fixed by its position (treeKind), so props.js can give a fallen trunk a long, low
// collider instead of the standing trunk's post. The box trees stay until the models arrive, then are hidden.
// The files were converted by scripts/scenery (1 m tall, centred on the trunk, webp textures, meshopt geometry).
import * as THREE from 'three';
import { loadGLB, lambertize } from './models.js';
import { BOUNDS } from './layout.js';

const FILES = { pine: 'models/trees/pine.glb', leafy: 'models/trees/leafy.glb', dead: 'models/trees/dead.glb', fallen: 'models/trees/fallen.glb' };
// height of a standing tree at s = 1 (the old box tree was about 6.5 m), and the fallen trunk's size
const H = { pine: 7.6, leafy: 6.8, dead: 6.6, peepal: 9.2 };
const FALLEN = { k: 1.9, hx: 1.32, hy: 0.5, hz: 0.42 };   // file units -> metres at s = 1; collider half sizes in file units
const CELL = 120;                                          // instances are split into cells this wide, so off-screen ones are culled

const hash = (x, z) => { const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return v - Math.floor(v); };

// in the belt of trees around the edge of town, clear of every lane
const inside = (x, z) => x > BOUNDS.minX && x < BOUNDS.maxX && z > BOUNDS.minZ && z < BOUNDS.maxZ;
const edge = (x, z) => inside(x, z) && (x < BOUNDS.minX + 12 || x > BOUNDS.maxX - 12 || z < BOUNDS.minZ + 12 || z > BOUNDS.maxZ - 12);
// pine, leafy, dead or fallen; peepals are always the broadleaf, and trunks only lie fallen in the edge belt
export function treeKind(t) {
  if (t.type === 'peepal') return 'leafy';
  const h = hash(t.p[0], t.p[2]);
  if (t.p[1] === 0 && h < 0.12 && edge(t.p[0], t.p[2])) return 'fallen';
  return h < 0.5 ? 'pine' : h < 0.85 ? 'leafy' : 'dead';
}
export const treeYaw = (t) => hash(t.p[2], t.p[0]) * Math.PI * 2;
// the fallen trunk's collider, in world units: [cy, hx, hy, hz]
export function fallenBox(t) { const k = FALLEN.k * t.s; return [t.p[1] + FALLEN.hy * k, FALLEN.hx * k, FALLEN.hy * k, FALLEN.hz * k]; }

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

export class Trees {
  constructor(game) { this.g = game; this.model = {}; this.meshes = []; }

  start() {
    const g = this.g, P = g.props;
    if (!P || !P.trees || !P.trees.length) return;
    const want = new Set(P.trees.map(treeKind));
    const names = Object.keys(FILES).filter((k) => want.has(k));
    let left = names.length;
    const done = () => { if (--left === 0) this._swap(); };
    // after the town is up, behind the cars (swaps.js)
    setTimeout(() => {
      for (const k of names) loadGLB(FILES[k]).then((gltf) => { this.model[k] = this._parts(gltf); }).catch((e) => console.warn('could not load', FILES[k], e)).finally(done);
    }, g.mobile ? 2500 : 1000);
  }

  _parts(gltf) {
    const root = lambertize(gltf.scene, false, 0.05), out = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      if (m.transparent || m.alphaTest) { m.transparent = false; m.alphaTest = 0.5; m.depthWrite = true; }
      m.side = THREE.DoubleSide;   // leaf cards, and scanned bark seen from inside a hollow
      out.push({ geo: o.geometry, mat: m });
    });
    return out;
  }

  // every model that loaded replaces its box trees; spots whose model failed keep theirs
  _swap() {
    const P = this.g.props, cells = new Map();
    let all = true;
    for (const t of P.trees) {
      const kind = treeKind(t);
      if (!this.model[kind]) { all = false; continue; }
      const key = `${kind}|${Math.floor(t.p[0] / CELL)}|${Math.floor(t.p[2] / CELL)}`;
      if (!cells.has(key)) cells.set(key, { kind, at: [] });
      cells.get(key).at.push(t);
    }
    if (!all) return;   // keep the box trees rather than leave gaps
    for (const { kind, at } of cells.values()) for (const { geo, mat } of this.model[kind]) {
      const im = new THREE.InstancedMesh(geo, mat, at.length);
      at.forEach((t, i) => {
        const v = hash(t.p[0] + 7, t.p[2] - 3);
        _v.set(t.p[0], t.p[1], t.p[2]);
        _q.setFromEuler(_e.set(0, treeYaw(t), 0));
        if (kind === 'fallen') _s.setScalar(FALLEN.k * t.s);
        else { const h = (t.type === 'peepal' ? H.peepal : H[kind]) * t.s * (0.92 + v * 0.16); _s.set(h * (0.9 + v * 0.2), h, h * (0.9 + v * 0.2)); }
        im.setMatrixAt(i, _m.compose(_v, _q, _s));
        im.setColorAt(i, _c.setScalar(kind === 'fallen' ? 0.6 + v * 0.12 : 0.82 + v * 0.22));   // the fallen trunk's scanned snow, dulled
      });
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      this.g.scene.add(im);
      this.meshes.push(im);
    }
    for (const m of P.treeMeshes) if (m) m.visible = false;
  }
}
