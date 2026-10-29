// The graves and the wrecks of Jais: uploaded models placed at fixed spots in the town (metres, see layout.js).
//
//   models/tombstone_bonaventure.glb  a tall headstone scan: forty of them in one straight line along the
//                                     north side of the railway, beside Jais City station
//   models/tombstone_koszeg.glb       a grey stone scan: six graves on the far side of the track, around MAW
//   models/eclipso_car.glb            a post-apocalypse car, parked on the lane west of the Mandir road
//   models/l200_pickup.glb            a red pickup, parked on the waste ground south-west of the main road
//   models/aircraft_wreck.glb         a small aircraft down in the fields at the south-west edge of town
//   models/destroyed_building.glb     a bombed-out house on the east side of the bazaar
//
// The models come in at their own sizes and orientations, so each one is scaled to the town's metres, stood
// on the ground and centred on its spot when it loads (in the background, after the town is up). Stones and
// wrecks get colliders, so you walk around them rather than through them. Until a model arrives nothing is
// drawn there, and a failed download just leaves the spot empty.
import * as THREE from 'three';
import { loadGLB, lambertize } from './models.js';

// the straight row: forty stones from x0 to x1, all facing the same way (toward the station)
const STONE_ROW = { x0: -170, x1: -110, z: -188, n: 40 };
// six graves beside MAW, north of the railway (x, z, yaw); he lies at (73.6, -182.6)
const MAW_GRAVES = [[60, -190, 0.3], [66, -191.5, -0.2], [72, -189, 0.1], [78, -192, 0.5], [85, -189.5, -0.4], [91, -191, 0.2]];
// model scale is metres per model unit (each file is a different size); yaw turns it around the up axis
const STONE_SCALE = { bonaventure: 0.82, koszeg: 0.086 };
const WRECKS = [
  { file: 'eclipso_car', s: 0.86, x: -106, z: 124, yaw: Math.PI / 2 },           // long axis along the lane
  { file: 'l200_pickup', s: 0.6, x: -22, z: -68, yaw: 0 },                       // long axis along z
  { file: 'aircraft_wreck', s: 0.5, x: -62, z: 184, yaw: 0.2 },                 // down in the fields, nose to the south
  { file: 'destroyed_building', s: 14, x: 34, z: 20, yaw: -0.15 },              // the bombed house by the bazaar
];

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);

// Load one model, bake its scale and orientation into the geometry, and centre it on x/z with its base on y = 0.
// Returns the meshes ({ geo, mat }) and the size of the result in metres.
async function prepared(file, s, glow) {
  const gltf = await loadGLB('models/' + file + '.glb');
  const root = lambertize(gltf.scene, false, glow);
  root.scale.setScalar(s);
  root.updateMatrixWorld(true);
  const parts = [], box = new THREE.Box3();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
    geo.computeBoundingBox();
    box.union(geo.boundingBox);
    parts.push({ geo, mat: o.material });
  });
  const c = box.getCenter(new THREE.Vector3());
  for (const p of parts) p.geo.translate(-c.x, -box.min.y, -c.z);
  return { parts, size: box.getSize(new THREE.Vector3()) };
}

export class Graves {
  constructor(game) {
    this.g = game;
    this.stone = null;
  }

  start() {
    const g = this.g;
    const wait = new Promise((r) => setTimeout(r, g.mobile ? 3500 : 1500));
    wait.then(() => this.load()).catch((e) => console.warn('graves: could not load', e));
  }

  async load() {
    const g = this.g;
    const [bon, kos] = await Promise.all([
      prepared('tombstone_bonaventure', STONE_SCALE.bonaventure, 0.08).catch((e) => (console.warn('no headstone', e), null)),
      prepared('tombstone_koszeg', STONE_SCALE.koszeg, 0.08).catch((e) => (console.warn('no stone', e), null)),
    ]);
    if (bon) this.row(bon);
    if (kos) this.mutant(kos);
    for (const w of WRECKS) {
      prepared(w.file, w.s, 0.06).then((m) => this.wreck(m, w)).catch((e) => console.warn('could not load', w.file, e));
    }
  }

  // forty identical stones in one straight line, one InstancedMesh per part of the model
  row(model) {
    const g = this.g, n = STONE_ROW.n;
    const at = [];
    for (let i = 0; i < n; i++) at.push({ x: STONE_ROW.x0 + (STONE_ROW.x1 - STONE_ROW.x0) * i / (n - 1), z: STONE_ROW.z, yaw: 0 });
    this.instances(model, at);
    this.colliders(model, at);
  }

  mutant(model) {
    const at = MAW_GRAVES.map(([x, z, yaw]) => ({ x, z, yaw }));
    this.instances(model, at);
    this.colliders(model, at);
  }

  instances(model, at) {
    for (const { geo, mat } of model.parts) {
      const im = new THREE.InstancedMesh(geo, mat, at.length);
      at.forEach((o, i) => {
        _m.compose(_v.set(o.x, 0, o.z), _q.setFromAxisAngle(UP, o.yaw), _one);
        im.setMatrixAt(i, _m);
      });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      this.g.scene.add(im);
    }
  }

  // a thin box per stone, so you walk round them (there are gaps between the stones to pass through)
  colliders(model, at) {
    const { x, y, z } = model.size;
    for (const o of at) this.g.physics.add(o.x, y / 2, o.z, x * 0.42, y / 2, z * 0.42, o.yaw, null);
  }

  // a wreck or ruin: one group of meshes, a box collider the size of its footprint
  wreck(model, w) {
    const g = this.g;
    const grp = new THREE.Group();
    for (const { geo, mat } of model.parts) grp.add(new THREE.Mesh(geo, mat));
    grp.position.set(w.x, 0, w.z);
    grp.rotation.y = w.yaw;
    g.scene.add(grp);
    const { x, y, z } = model.size;
    g.physics.add(w.x, y / 2, w.z, x / 2, y / 2, z / 2, w.yaw, null);
  }
}
