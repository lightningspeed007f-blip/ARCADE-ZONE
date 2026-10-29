// Uploaded models that replace the town's box-built stand-ins, and the grass that breaks through the roads.
//
//   models/rusty_car.glb    an old rusty saloon: the parked cars, and some of the wrecks
//   models/police_car.glb   a burnt-out police car: the crashed cars across the roads, and some wrecks and parked cars
//   models/police_car2.glb  the same wreck upside down: the overturned wreck
//   models/rickshaw.glb     an Indian cycle rickshaw: every auto-rickshaw in town (the tempus)
//   models/bobber_lite.glb  a bobber motorbike, light enough to stand all over town: every parked bike
//   models/bobber.glb       the same bike in full: the one you can ride (vehicles.js, in the jeep's old place)
//   models/dry_grass.glb    seven dry tufts, and models/grass06.glb a fan of green blades
//
// Everything loads in the background after the town is up. Until a model arrives its box stand-in stays; when
// it does, the stand-in is hidden and the model is drawn at the same spots (colliders were added with the town).
// The burning cars keep their own geometry (vehicles.js). The box rickshaws and bikes are not drawn at all while their
// models load (only if a file fails do they come back).
// The files are pre-shrunk (1024 px JPEG / PNG textures, no normal or specular maps) by the conversion script
// described in assets/README.md. models/grass06.glb's own texture was cut off in the upload: the blade was rebuilt
// from the part that survived.
import * as THREE from 'three';
import { loadGLB, lambertize } from './models.js';
import { ROADS, roadInfo } from './layout.js';
import { makeRng } from './util.js';

const FILES = {
  rusty: 'models/rusty_car.glb', police: 'models/police_car.glb', flipped: 'models/police_car2.glb',
  rickshaw: 'models/rickshaw.glb', bobber: 'models/bobber.glb', bobberLite: 'models/bobber_lite.glb',
  dry: 'models/dry_grass.glb', blades: 'models/grass06.glb',
};
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

export class Swaps {
  constructor(game) {
    this.g = game;
    this.model = {};            // name -> [{ geo, mat }] (one entry per mesh in the file)
    this.grass = null;
  }

  start() {
    const g = this.g;
    let q = new Promise((r) => setTimeout(r, g.mobile ? 3500 : 1500));
    const step = (name, fn, fail) => { q = q.then(() => loadGLB(FILES[name]).then((gltf) => { this.model[name] = this._meshes(gltf, name); fn && fn(); }).catch((e) => { console.warn('could not load', FILES[name], e); fail && fail(); })); };
    step('bobber', () => g.vehicles.setBike(this.model.bobber));      // the bike you can ride comes first
    step('rickshaw', () => this.autos(), () => { const P = g.props; if (P && P.autoMesh) P.autoMesh.visible = true; });
    step('bobberLite', () => this.bikes(), () => { const P = g.props; if (P && P.bikeMesh) P.bikeMesh.visible = true; });
    step('rusty');
    step('police');
    step('flipped', () => { this.cars(); this.wrecks(); });
    this.grass = this._scatter();
    step('dry', () => this._grassModel('dry'));
    step('blades', () => this._grassModel('blades'));
  }

  // the meshes of a loaded file, Lambert-lit like the rest of the town (the files have no node transforms)
  _meshes(gltf, name) {
    const root = lambertize(gltf.scene, false, name === 'dry' || name === 'blades' ? 0.3 : 0.06);
    const out = [];
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!o.isMesh) return;
      const mat = o.material;
      if (name === 'dry' || name === 'blades') { mat.transparent = false; mat.alphaTest = 0.45; mat.depthWrite = true; mat.side = THREE.DoubleSide; }
      out.push({ geo: o.geometry, mat });
    });
    return out;
  }

  // one InstancedMesh per mesh of the model; `at` is a list of { x, y, z, yaw, rx, rz, s, sv, color }
  _place(name, at, parts = this.model[name]) {
    if (!at.length) return [];
    const made = [];
    for (const { geo, mat } of parts) {
      const im = new THREE.InstancedMesh(geo, mat, at.length);
      at.forEach((o, i) => {
        _v.set(o.x, o.y || 0, o.z); _q.setFromEuler(_e.set(o.rx || 0, o.yaw || 0, o.rz || 0, 'YXZ'));
        if (o.sv) _s.set(...o.sv); else _s.setScalar(o.s || 1);
        im.setMatrixAt(i, _m.compose(_v, _q, _s));
        if (o.color !== undefined) im.setColorAt(i, new THREE.Color(o.color));
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      this.g.scene.add(im);
      made.push(im);
    }
    return made;
  }

  // ---------- parked cars: mostly the rusty saloon, now and then a burnt police car; the crashed ones are police wrecks ----------
  cars() {
    const P = this.g.props;
    if (!P || !P.cars || !P.carMesh) return;
    const rusty = !!this.model.rusty, police = !!this.model.police;
    if (!rusty && !police) return;
    const by = { rusty: [], police: [] };
    P.cars.forEach((c, i) => {
      const k = !rusty ? 'police' : !police ? 'rusty' : c.wreck || i % 3 === 2 ? 'police' : 'rusty';
      by[k].push({ x: c.p[0], y: 0, z: c.p[2], yaw: c.yaw, rz: c.wreck ? 0.08 : 0 });
    });
    this._place('rusty', rusty ? by.rusty : []); this._place('police', police ? by.police : []);
    P.carMesh.visible = false;
  }

  // ---------- the abandoned wrecks along the roads (not the burning ones) ----------
  wrecks() {
    const V = this.g.vehicles;
    if (!V || !V.wreckShell || !V.wrecks.length) return;
    const by = { rusty: [], police: [], flipped: [] };
    V.wrecks.forEach((w, i) => {
      const s = w.spec;
      let k = s.flip && this.model.flipped ? 'flipped' : i % 2 ? 'police' : 'rusty';
      if (!this.model[k]) k = this.model.rusty ? 'rusty' : 'police';
      if (!this.model[k]) return;
      const o = { x: w.x, y: 0, z: w.z, yaw: w.yaw, rx: 0, rz: 0 };
      if (s.flip) o.rz = 0.05;
      else if (s.wheel !== undefined) { o.y = -0.08; o.rx = (s.wheel < 2 ? 1 : -1) * 0.05; o.rz = (s.wheel % 2 ? -1 : 1) * 0.07; }   // sagging on the missing wheel
      by[k].push(o);
    });
    for (const k in by) this._place(k, by[k]);
    V.wreckShell.visible = false;
  }

  // ---------- the rickshaws (the tempus) ----------
  autos() {
    const P = this.g.props;
    if (!P || !P.autos || !P.autoMesh || !this.model.rickshaw) return;
    this._place('rickshaw', P.autos.map((a) => ({ x: a.p[0], y: 0, z: a.p[2], yaw: a.yaw })));
    P.autoMesh.visible = false;
  }

  // ---------- the parked bikes: all of them the bobber, leaning on its stand (only the one in vehicles.js rides) ----------
  bikes() {
    const P = this.g.props;
    if (!P || !P.bikes || !P.bikeMesh || !this.model.bobberLite) return;
    this._place('bobberLite', P.bikes.map((b) => ({ x: b.p[0], y: 0, z: b.p[2], yaw: b.yaw, rz: 0.1 })));
    P.bikeMesh.visible = false;
  }

  // ---------- grass: tufts along both kerbs, in the cracks and in small patches in the middle of the road ----------
  _scatter() {
    const g = this.g, P = g.physics, R = makeRng(9091), list = [];
    const thin = g.mobile ? 1.8 : 1;
    const clear = (x, z) => P.groundAt(x, z, 0.35, 50) < 0.15;
    const add = (x, z, big) => {
      if (!clear(x, z)) return;
      const blades = R() < 0.3;
      const s = big ? R.range(1.2, 2.0) : R.range(0.8, 1.5);
      list.push({
        kind: blades ? 'blades' : 'dry', v: Math.floor(R() * 7),
        x, y: 0.005, z, yaw: R() * 6.283, rx: R.range(-0.1, 0.1), rz: R.range(-0.1, 0.1),
        sv: blades ? [s * 0.6, s * R.range(0.9, 1.3), s * 0.6] : [s, s * R.range(0.8, 1.25), s],
        color: blades ? new THREE.Color().setHSL(R.range(0.2, 0.27), 0.35, R.range(0.6, 0.9)).getHex() : new THREE.Color().setScalar(R.range(0.65, 1)).getHex(),
      });
    };
    for (const road of Object.values(ROADS)) {
      const i = roadInfo(road), half = road.w / 2;
      const at = (t, off) => [road.a[0] + i.ux * t + i.nx * off, road.a[1] + i.uz * t + i.nz * off];
      // along the kerbs, in clumps with gaps between
      for (const side of [-1, 1]) {
        for (let t = 2; t < i.len - 2; t += R.range(0.6, 1.5) * thin) {
          const run = R() < 0.18 ? 3 : 1;                               // now and then a few tufts together
          for (let k = 0; k < run; k++) {
            const [x, z] = at(t + k * R.range(0.3, 0.7), side * (half - R.range(0.05, 0.9)));
            add(x, z, false);
          }
        }
      }
      // cracks and potholes: small patches anywhere across the road
      const patches = Math.round(i.len / 9 / thin);
      for (let p = 0; p < patches; p++) {
        const t = R.range(3, i.len - 3), off = R.range(-half + 0.8, half - 0.8);
        const n = 2 + Math.floor(R() * 4);
        for (let k = 0; k < n; k++) {
          const [x, z] = at(t + R.range(-1, 1), off + R.range(-0.6, 0.6));
          add(x, z, k === 0);
        }
      }
    }
    return list;
  }

  _grassModel(name) {
    if (!this.model[name]) return;
    const mine = this.grass.filter((t) => t.kind === name);
    if (name === 'dry') {
      const n = this.model.dry.length;
      this.model.dry.forEach((part, j) => {
        const at = mine.filter((t) => t.v % n === j);
        if (!at.length) return;
        this._place('dry', at, [part]);
      });
    } else this._place(name, mine);
  }
}
