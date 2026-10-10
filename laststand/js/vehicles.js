// Cars of the night: abandoned wrecks along the roads, a few still burning,
// and one old army-green jeep that actually drives.
//
// Wrecks and burning shells are merged into two static meshes (two draw
// calls for all of them) with ordinary box colliders, placed before the
// navigation grid is built so zombies walk around them. Fire is drawn with
// the shared particle system in explosives.js; each burning car also gets
// a flickering light source (picked up by the light pool), a glow on the
// road and a crackling sound.
import * as THREE from 'three';
import { part, merge, Bx, Cy, WHEEL } from './props.js';
import { ROADS, roadInfo } from './layout.js';
import { clamp, lerp, rgb, makeRng } from './util.js';
import { Physics } from './physics.js';
import { FIRE } from './explosives.js';

// where the cars are: along a road (t metres from its start, `off` metres across it)
const WRECKS = [
  { road: 'MAIN', t: 236, off: -3.4, dyaw: 0.25, color: 0xb8bcc0, door: 'L' },
  { road: 'MAIN', t: 94, off: 3.3, dyaw: Math.PI - 0.2, color: 0x8a1010, hood: true },
  { road: 'MAIN', t: 52, off: 3.6, dyaw: Math.PI + 0.35, color: 0xd8d0b8, wheel: 2, door: 'R' },
  { road: 'MAIN', t: 6, off: -2.6, dyaw: 0.6, color: 0x1a4a8a, flip: true },
  { road: 'WAHAB', t: 72, off: 2.1, dyaw: Math.PI - 0.4, color: 0x2a2a2e, door: 'R' },
  { road: 'WAHAB', t: 168, off: -2.0, dyaw: 0.15, color: 0xf0f0f0, wheel: 0, hood: true },
  { road: 'STN', t: 26, off: -2.3, dyaw: Math.PI + 0.1, color: 0x6a7a5a, door: 'L' },
  { road: 'SW', t: 62, off: 2.2, dyaw: 0.3, color: 0x5a3a8a, hood: true },
  { road: 'SE', t: 80, off: -2.4, dyaw: Math.PI - 0.3, color: 0xc8a040, door: 'L', wheel: 3 },
  { at: [106, -137], yaw: 0.9, color: 0x3a6a6a, flip: true },
];
const BURNING = [
  { road: 'MAIN', t: 136, off: -2.6, dyaw: 0.5 },
  { road: 'STN', t: 60, off: 2.0, dyaw: -0.25 },
  { road: 'WAHAB', t: 122, off: -1.9, dyaw: 0.3 },
];
const JEEP_AT = { road: 'MAIN', t: 182, off: 3.3, dyaw: Math.PI };   // just south of the Wahabganj junction, facing north

const shade = (hex, k) => { const c = rgb(hex); return (Math.round(c[0] * k * 255) << 16) | (Math.round(c[1] * k * 255) << 8) | Math.round(c[2] * k * 255); };

// ---------- wreck geometry (local frame: x across, z forward, y up) ----------
function carShell(o, R) {
  const burnt = !!o.burnt;
  const body = burnt ? 0x1d1a18 : o.color, p = [];
  const rust = burnt ? 0x4a2a1a : shade(o.color, 0.45), metal = burnt ? 0x2c2724 : 0x9a9a9a;
  p.push(part(Bx(1.62, 0.55, 3.75), body, 0, 0.6, 0));
  p.push(part(Bx(1.64, 0.08, 3.6), burnt ? 0x141210 : 0x161616, 0, 0.32, 0));           // sills / underside
  // crumpled front end, hood sometimes bent up
  if (o.hood) p.push(part(Bx(1.5, 0.06, 1.05), body, 0, 1.18, 1.05, -0.85, 0.06, 0));
  else p.push(part(Bx(1.5, 0.12, 1.1), shade(body, 0.85), 0, 0.92, 1.28, 0.1, R() * 0.12, 0.05));
  p.push(part(Bx(1.55, 0.16, 0.12), metal, 0.12, 0.36, 1.9, 0, 0.1, 0.22));              // hanging bumper
  p.push(part(Bx(1.5, 0.14, 0.1), metal, 0, 0.4, -1.88));
  // pillars + dented roof
  for (const [x, z] of [[0.68, 0.74], [-0.68, 0.74], [0.68, -1.22], [-0.68, -1.22]]) p.push(part(Bx(0.08, 0.56, 0.08), body, x, 1.14, z, z > 0 ? -0.38 : 0.3, 0, 0));
  p.push(part(Bx(1.45, 0.07, 1.78), body, 0, 1.43, -0.25, 0.02, 0, R() < 0.5 ? 0.05 : -0.04));
  p.push(part(Bx(0.5, 0.05, 0.6), shade(body, 0.7), 0.25, 1.4, -0.2, 0.08, 0, 0.12));    // dent
  // glass: windscreen with a crack, one side window gone (you can see in), rear window
  if (!burnt) {
    p.push(part(Bx(1.3, 0.52, 0.03), 0x29323c, 0, 1.13, 0.82, -0.62, 0, 0));
    p.push(part(Bx(0.95, 0.025, 0.035), 0x9aa6b0, 0.05, 1.16, 0.83, -0.62, 0, 0.55), part(Bx(0.6, 0.025, 0.035), 0x9aa6b0, -0.15, 1.08, 0.83, -0.62, 0, -0.7));
    p.push(part(Bx(0.03, 0.4, 1.6), 0x29323c, 0.72, 1.14, -0.24));
    p.push(part(Bx(1.3, 0.4, 0.03), 0x29323c, 0, 1.13, -1.32, 0.45, 0, 0));
  }
  // seats (burnt: charred springs)
  p.push(part(Bx(1.3, 0.42, 0.5), burnt ? 0x141110 : 0x3a2a22, 0, 0.98, -0.05), part(Bx(1.3, 0.5, 0.18), burnt ? 0x141110 : 0x3a2a22, 0, 1.15, -0.35));
  p.push(part(Bx(1.3, 0.48, 0.5), burnt ? 0x141110 : 0x3a2a22, 0, 0.98, -0.95));
  // wheels: tyres (burnt cars only keep the steel rims)
  [[0.76, 1.18], [-0.76, 1.18], [0.76, -1.22], [-0.76, -1.22]].forEach(([x, z], i) => {
    if (i === o.wheel) return;
    if (burnt) p.push(part(WHEEL(0.24, 0.16), 0x3a3430, x, 0.24, z, 0, 0, Math.PI / 2));
    else p.push(part(WHEEL(0.31, 0.21), 0x111111, x, 0.31, z, 0, 0, Math.PI / 2), part(WHEEL(0.16, 0.22), 0x6a6a6a, x, 0.31, z, 0, 0, Math.PI / 2));
  });
  // dead lights, rust streaks
  p.push(part(Bx(0.3, 0.1, 0.05), 0x30302a, 0.5, 0.66, 1.88), part(Bx(0.3, 0.1, 0.05), 0x30302a, -0.5, 0.66, 1.88));
  p.push(part(Bx(0.3, 0.1, 0.05), 0x3a0606, 0.55, 0.72, -1.88), part(Bx(0.3, 0.1, 0.05), 0x3a0606, -0.55, 0.72, -1.88));
  for (let k = 0; k < 5; k++) { const s = R() < 0.5 ? 1 : -1; p.push(part(Bx(0.02, 0.15 + R() * 0.25, 0.3 + R() * 0.6), rust, s * 0.815, 0.55 + R() * 0.2, (R() - 0.5) * 3)); }
  // an open door, swung out on its front hinge
  if (o.door) {
    const sd = o.door === 'L' ? 1 : -1, a = o.doorAng;
    p.push(part(Bx(0.07, 0.72, 1.05), body, sd * (0.82 + Math.sin(a) * 0.52), 0.9, 0.72 - Math.cos(a) * 0.52, 0, -sd * a, 0));
  }
  return merge(p);
}

// glass shards, a loose tyre and bits of trim on the road around a wreck (world-space parts)
function debris(x, z, R, n) {
  const p = [];
  for (let i = 0; i < n; i++) {
    const a = R() * 6.28, r = 1.2 + R() * 2.6;
    p.push(part(Bx(0.06 + R() * 0.12, 0.012, 0.05 + R() * 0.1), R() < 0.6 ? 0x8a9aa6 : 0x3a3a3a, x + Math.cos(a) * r, 0.03, z + Math.sin(a) * r, 0, R() * 3, 0));
  }
  if (R() < 0.6) { const a = R() * 6.28; p.push(part(WHEEL(0.31, 0.2), 0x121212, x + Math.cos(a) * 2.8, 0.11, z + Math.sin(a) * 2.8, 0, 0, 0)); }
  return p;
}

// ---------- the jeep ----------
function jeepBody() {
  const OL = 0x4b5a34, OLd = 0x3a4628, BK = 0x161616, ST = 0x6a6a68, SEAT = 0x3a2c22;
  const p = [];
  p.push(part(Bx(1.66, 0.62, 3.2), OL, 0, 0.78, -0.15));                  // tub
  p.push(part(Bx(1.56, 0.34, 1.05), OL, 0, 0.92, 1.42));                  // bonnet
  p.push(part(Bx(1.5, 0.5, 0.08), BK, 0, 0.82, 1.96));                    // grille
  for (let i = -3; i <= 3; i++) p.push(part(Bx(0.05, 0.42, 0.03), 0x2a2a2a, i * 0.17, 0.82, 2.0));
  p.push(part(Bx(1.78, 0.14, 0.18), BK, 0, 0.5, 2.06));                   // front bumper
  p.push(part(Bx(1.78, 0.14, 0.16), BK, 0, 0.52, -1.82));                 // rear bumper
  for (const s of [-1, 1]) {
    p.push(part(Bx(0.18, 0.08, 0.9), BK, s * 0.88, 1.0, 1.28));           // front fender flares
    p.push(part(Bx(0.18, 0.08, 0.9), BK, s * 0.88, 1.0, -1.18));
    p.push(part(Bx(0.06, 0.05, 1.4), OLd, s * 0.84, 1.1, -0.35));         // tub rim
  }
  // windscreen frame (folded up), roll bar, seats, spare wheel, jerrycan
  p.push(part(Bx(1.56, 0.06, 0.06), OLd, 0, 1.12, 0.86), part(Bx(1.56, 0.06, 0.06), OLd, 0, 1.68, 0.78));
  for (const s of [-1, 1]) p.push(part(Bx(0.06, 0.58, 0.06), OLd, s * 0.75, 1.4, 0.82, -0.14, 0, 0));
  for (const s of [-1, 1]) p.push(part(Bx(0.07, 0.8, 0.07), ST, s * 0.76, 1.48, -0.85));
  p.push(part(Bx(1.58, 0.07, 0.07), ST, 0, 1.86, -0.85));
  for (const s of [-1, 1]) p.push(part(Bx(0.5, 0.14, 0.5), SEAT, s * 0.38, 1.02, -0.05), part(Bx(0.5, 0.55, 0.12), SEAT, s * 0.38, 1.3, -0.33, -0.12, 0, 0));
  p.push(part(Bx(1.3, 0.14, 0.55), SEAT, 0, 1.02, -1.2));
  p.push(part(Cy(0.36, 0.36, 0.22, 12), 0x121212, 0, 1.02, -1.98, Math.PI / 2, 0, 0), part(Cy(0.18, 0.18, 0.24, 10), OLd, 0, 1.02, -1.98, Math.PI / 2, 0, 0));
  p.push(part(Bx(0.18, 0.42, 0.3), 0x5a6a3a, 0.62, 1.2, -1.7));
  p.push(part(Cy(0.17, 0.17, 0.04, 14), BK, -0.38, 1.36, 0.5, 1.1, 0, 0));  // steering wheel
  p.push(part(Bx(1.4, 0.3, 0.3), 0x262626, 0, 1.08, 0.62));              // dashboard
  // lamps (lit glow sprites sit in front of them while driving)
  for (const s of [-1, 1]) p.push(part(Cy(0.11, 0.11, 0.05, 12), 0xd8d8c8, s * 0.6, 0.98, 1.99, Math.PI / 2, 0, 0), part(Bx(0.14, 0.1, 0.04), 0x8a0a0a, s * 0.7, 0.8, -1.9));
  p.push(part(Bx(1.0, 0.18, 0.02), 0xe8e8e0, 0, 0.62, 2.16));             // number plate
  return merge(p);
}
function wheelGeo() { return merge([part(WHEEL(0.38, 0.26), 0x111111, 0, 0, 0, 0, 0, Math.PI / 2), part(WHEEL(0.2, 0.27), 0x4b5a34, 0, 0, 0, 0, 0, Math.PI / 2)]); }
function driverGeo() {
  return merge([
    part(Bx(0.42, 0.55, 0.26), 0x3c4148, 0, 1.45, -0.1), part(Bx(0.24, 0.27, 0.25), 0xa8714c, 0, 1.86, -0.08),
    part(Bx(0.26, 0.08, 0.27), 0x222222, 0, 2.0, -0.08),
    part(Bx(0.1, 0.1, 0.48), 0x3c4148, -0.2, 1.48, 0.18, -0.3, 0, 0), part(Bx(0.1, 0.1, 0.48), 0x3c4148, 0.2, 1.48, 0.18, -0.3, 0, 0),
  ]);
}

export class Vehicles {
  constructor(game) {
    this.g = game;
    this.burning = []; this.wrecks = [];
    this.driving = false;
    this.car = null;
  }

  // a road placement -> world {x, z, yaw}, nudged along the road until the spot is clear
  _place(spec, P, rad = 2.1) {
    if (spec.at) return P.groundAt(spec.at[0], spec.at[1], rad, 50) < 0.15 ? { x: spec.at[0], z: spec.at[1], yaw: spec.yaw } : null;
    const road = ROADS[spec.road], i = roadInfo(road);
    for (const dt of [0, 2.5, -2.5, 5, -5, 8, -8, 12, -12]) {
      for (const k of [1, 0.75, 0.5]) {
        const t = spec.t + dt, off = spec.off * k;
        const x = road.a[0] + i.ux * t + i.nx * off, z = road.a[1] + i.uz * t + i.nz * off;
        if (P.groundAt(x, z, rad, 50) < 0.15) return { x, z, yaw: i.yaw + spec.dyaw };
      }
    }
    return null;
  }

  // ================= static part: built with the town, before navigation =================
  buildStatic(W, scene, mats) {
    const P = W.P, R = makeRng(4242), wreckParts = [], hotParts = [];   // own RNG: the town itself stays exactly as before
    const put = (geo, x, y, z, yaw, rx = 0, rz = 0) => {
      geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, yaw, rz, 'YXZ')), new THREE.Vector3(1, 1, 1)));
      wreckParts.push(geo);
    };
    for (const w of WRECKS) {
      const at = this._place(w, P);
      if (!at) continue;
      w.doorAng = 0.75 + R() * 0.5;
      const geo = carShell(w, R);
      if (w.flip) put(geo, at.x, 1.5, at.z, at.yaw, 0, Math.PI + 0.06);         // on its roof
      else if (w.wheel !== undefined) put(geo, at.x, -0.08, at.z, at.yaw, (w.wheel < 2 ? 1 : -1) * 0.05, (w.wheel % 2 ? -1 : 1) * 0.07); // sagging on the missing wheel
      else put(geo, at.x, 0, at.z, at.yaw, 0, (R() - 0.5) * 0.04);
      wreckParts.push(...debris(at.x, at.z, R, 9));
      P.add(at.x, 0.75, at.z, 0.84, 0.75, 1.92, at.yaw);
      if (w.door && !w.flip) {
        const sd = w.door === 'L' ? 1 : -1, c = Math.cos(at.yaw), sn = Math.sin(at.yaw);
        const lx = sd * (0.82 + Math.sin(w.doorAng) * 0.52), lz = 0.72 - Math.cos(w.doorAng) * 0.52;
        P.add(at.x + lx * c + lz * sn, 0.9, at.z - lx * sn + lz * c, 0.05, 0.4, 0.52, at.yaw - sd * w.doorAng);
      }
      W.reserve(at.x, at.z, 1.2, 2.3, at.yaw);
      this.wrecks.push(at);
    }
    for (const b of BURNING) {
      const at = this._place(b, P, 2.4);
      if (!at) continue;
      put(carShell({ burnt: true, door: R() < 0.5 ? 'L' : null, doorAng: 0.9, hood: R() < 0.5 }, R), at.x, -0.04, at.z, at.yaw, 0, (R() - 0.5) * 0.05);
      wreckParts.push(...debris(at.x, at.z, R, 12));
      // glowing hot spots inside the shell (cabin, engine bay)
      const c = Math.cos(at.yaw), s = Math.sin(at.yaw), L = (lx, lz) => [at.x + lx * c + lz * s, at.z - lx * s + lz * c];
      for (const [lx, ly, lz, sx, sy, sz] of [[0, 0.7, 1.25, 1.05, 0.18, 0.7], [0, 0.78, -0.4, 0.95, 0.2, 1.3], [0.3, 0.8, -1.2, 0.45, 0.14, 0.4]]) {
        const [wx, wz] = L(lx, lz);
        hotParts.push(part(Bx(sx, sy, sz), 0xffffff, wx, ly, wz, 0, at.yaw, 0));
      }
      P.add(at.x, 0.75, at.z, 0.86, 0.75, 1.95, at.yaw);
      W.reserve(at.x, at.z, 1.3, 2.4, at.yaw);
      const emit = [[0, 1.0, 1.25, 1.0], [0, 1.15, -0.35, 1.3], [0, 0.9, -1.4, 0.6], [0.78, 0.35, 1.18, 0.25], [-0.78, 0.35, -1.22, 0.25]].map(([lx, ly, lz, w]) => { const [wx, wz] = L(lx, lz); return { x: wx, y: ly, z: wz, w }; });
      const light = { x: at.x, y: 2.4, z: at.z, color: 0xff7a24, intensity: 14, dist: 20, flicker: 1, fire: true, major: true };
      W.lights.push(light);
      this.burning.push({ ...at, emit, light, acc: [0, 0, 0], sparkT: 1 + R() * 2, phase: R() * 10 });
    }
    if (wreckParts.length) { const m = new THREE.Mesh(merge(wreckParts), mats.vcol); m.matrixAutoUpdate = false; scene.add(m); }
    if (hotParts.length) {
      this.hotMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xff6a18, toneMapped: false });
      const m = new THREE.Mesh(merge(hotParts), this.hotMat); m.matrixAutoUpdate = false; scene.add(m);
    }
    // orange glow on the road under each fire (cheap fake bounce light)
    const glowMat = this.glowMat = new THREE.MeshBasicMaterial({ map: this.g.tex.glow, color: 0xff6a20, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const b of this.burning) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(13, 13).rotateX(-Math.PI / 2), glowMat);
      m.position.set(b.x, 0.07, b.z); m.renderOrder = 2; scene.add(m);
    }
    // the jeep (its collider is added per run, after the navigation grid exists)
    this.jeepAt = this._place(JEEP_AT, P, 2.3) || { x: 3.3, z: -16, yaw: Math.PI };
    W.reserve(this.jeepAt.x, this.jeepAt.z, 1.1, 2.2, this.jeepAt.yaw);
    this.buildJeep(scene, mats);
  }

  buildJeep(scene, mats) {
    const g = new THREE.Group();
    g.rotation.order = 'YXZ';
    const bodyM = new THREE.Mesh(jeepBody(), mats.vcol); g.add(bodyM);
    const wg = wheelGeo();
    this.wheels = [];
    for (const [x, z] of [[0.82, 1.15], [-0.82, 1.15], [0.82, -1.15], [-0.82, -1.15]]) {
      const pivot = new THREE.Group(); pivot.position.set(x, 0.38, z);
      const w = new THREE.Mesh(wg, mats.vcol); pivot.add(w); g.add(pivot);
      this.wheels.push({ pivot, w, front: z > 0 });
    }
    this.driver = new THREE.Mesh(driverGeo(), mats.vcol); this.driver.position.x = -0.38; this.driver.visible = false; g.add(this.driver);
    const lamp = (x, y, z, col, s) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.g.tex.glow, color: col, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); sp.position.set(x, y, z); sp.scale.setScalar(s); sp.visible = false; g.add(sp); return sp; };
    this.lamps = [lamp(0.6, 0.98, 2.1, 0xfff2c8, 1.3), lamp(-0.6, 0.98, 2.1, 0xfff2c8, 1.3), lamp(0.7, 0.8, -1.98, 0xff2010, 0.55), lamp(-0.7, 0.8, -1.98, 0xff2010, 0.55)];
    scene.add(g);
    this.mesh = g;
  }

  // ================= per run =================
  reset() {
    const g = this.g, A = this.jeepAt;
    if (this.driving) this.exit(true);
    this.car = { x: A.x, y: 0, z: A.z, yaw: A.yaw, speed: 0, steer: 0, spin: 0, lean: 0, pitch: 0, crashT: 0 };
    if (!this.box) this.box = g.physics.add(A.x, 0.8, A.z, 0.88, 0.75, 1.92, A.yaw, 'vehicle');
    this._syncMesh(); this._syncBox();
    this.camYaw = 0; this.camPitch = 0; this.lookIdle = 0;
    // fire sounds: one crackling loop per burning car (stopped with every other loop on game over)
    const a = g.audio;
    if (a.ctx) this.burning.forEach((b, i) => { a.loops['fire' + i] = a.loop('fire', 0.95, a.amb, Object.assign([b.x, 1.2, b.z], { ref: 3.5 })); });
  }

  _syncMesh() {
    const c = this.car, m = this.mesh;
    m.position.set(c.x, c.y, c.z); m.rotation.set(c.pitch, c.yaw, c.lean);
  }
  _syncBox() { const c = this.car; this.g.physics.update(this.box, c.x, c.y + 0.8, c.z, c.yaw); }

  near(r = 3.6) { const c = this.car, P = this.g.player.pos; return c && Math.hypot(c.x - P.x, c.z - P.z) < r && Math.abs(P.y - c.y) < 1.5; }

  consider(fn) { if (!this.driving && this.car) fn([this.car.x, this.car.y + 1.0, this.car.z], 3.3, { type: 'vehicle' }); }

  // ================= enter / exit =================
  enter() {
    const g = this.g, P = g.player;
    if (this.driving || P.dead) return;
    this.driving = true;
    g.input.crouch = false; g.input.aim = false; g.input.fire = false;
    g.arsenal.holder.visible = false; g.arsenal.flash.visible = false; g.arsenal.adsT = 0;
    this.driver.visible = true;
    for (const l of this.lamps) l.visible = true;
    this.camYaw = 0; this.camPitch = 0;
    g.audio.play('slam', { vol: 0.5, rate: 1.2 }); g.audio.play('clank', { vol: 0.3, delay: 0.25 });
    if (g.audio.ctx) { this.engine = g.audio.loop('engine', 0.0, g.audio.sfx); this.engine.gain.gain.setTargetAtTime(0.32, g.audio.ctx.currentTime, 0.3); }
    document.body.classList.add('driving');
    g.toast('जीप चालू', g.input.touch ? 'Drive with the stick or ◀ ▶ GAS BRAKE · EXIT to get out' : 'W/S throttle · A/D steer · Space handbrake · G or E to get out');
  }

  // Find a free spot beside the jeep: driver side, other side, behind, in front, then a wider ring.
  exitSpot() {
    const g = this.g, c = this.car, P = g.physics;
    const f = [Math.sin(c.yaw), Math.cos(c.yaw)], r = [Math.cos(c.yaw), -Math.sin(c.yaw)];
    const cand = [[-1.75, 0.2], [1.75, 0.2], [0, -3.0], [0, 3.1], [-1.9, -1.6], [1.9, -1.6], [-1.9, 1.8], [1.9, 1.8]];
    for (let a = 0; a < 16; a++) cand.push([Math.cos(a * 0.3927) * 3.6, Math.sin(a * 0.3927) * 3.6]);
    const tmp = [];
    for (const [lx, lz] of cand) {
      const x = c.x + r[0] * lx + f[0] * lz, z = c.z + r[1] * lx + f[1] * lz;
      const gy = P.groundAt(x, z, 0.2, c.y + 0.6);
      if (gy < c.y - 1.2 || gy > c.y + 0.6) continue;                         // a hole or a ledge
      let blocked = false;
      for (const b of P.query(x - 0.45, z - 0.45, x + 0.45, z + 0.45, tmp)) {
        if (b.maxY <= gy + 0.45 || b.minY >= gy + 1.75) continue;
        if (Physics.circleOverlaps(b, x, z, 0.42)) { blocked = true; break; }
      }
      if (blocked) continue;
      // and not through a wall: the path from the jeep's side to the spot must be open
      const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz);
      const hit = P.raycast(c.x, gy + 1.0, c.z, dx / d, 0, dz / d, d, 'vehicle');
      if (hit && hit.box !== this.box) continue;
      return [x, gy, z];
    }
    return null;
  }

  exit(force) {
    const g = this.g, P = g.player, c = this.car;
    if (!this.driving) return false;
    let spot = this.exitSpot();
    if (!spot) {
      if (!force) { g.toast('बाहर निकलने की जगह नहीं', 'No room to get out here — move the jeep.'); g.audio.play('beepLow', { vol: 0.4 }); return false; }
      spot = [c.x, c.y + 1.8, c.z];                                           // last resort (run reset): on the roll bar
    }
    this.driving = false;
    c.speed = 0;
    P.pos.x = spot[0]; P.pos.y = spot[1]; P.pos.z = spot[2];
    P.smoothY = spot[1]; P.state.vy = 0; P.state.peak = spot[1]; P.state.fall = 0;
    P.yaw = c.yaw + Math.PI; P.pitch = -0.05; P.vel.set(0, 0);
    g.arsenal.holder.visible = true;
    this.driver.visible = false;
    for (const l of this.lamps) l.visible = false;
    if (this.engine) { try { this.engine.stop(); } catch (e) { /* stopped */ } this.engine = null; }
    g.audio.play('slam', { vol: 0.5, rate: 1.15 });
    document.body.classList.remove('driving');
    g.torch.distance = 32; g.torch.angle = 0.42;
    return true;
  }

  // ================= driving =================
  drive(dt, I) {
    const g = this.g, c = this.car, Ph = g.physics, P = g.player;
    const H = I.hold || {};
    // inputs: keys / joystick (move), touch pedals and steering buttons
    let thr = I.move.y + (H.gas ? 1 : 0) - (H.brake ? 1 : 0);
    let st = I.move.x + (H.steerR ? 1 : 0) - (H.steerL ? 1 : 0);
    thr = clamp(thr, -1, 1); st = clamp(st, -1, 1);
    const hand = !!(I.keys.Space);
    const MAX = 17, REV = 6;
    if (thr > 0.05) {
      if (c.speed < -0.3) c.speed = Math.min(0, c.speed + 16 * dt);           // braking out of reverse
      else c.speed = Math.min(MAX, c.speed + (c.speed < 6 ? 9 : 5.5) * thr * dt);
    } else if (thr < -0.05) {
      if (c.speed > 0.3) c.speed = Math.max(0, c.speed - 18 * dt);            // brake
      else c.speed = Math.max(-REV, c.speed - 5 * -thr * dt);                 // reverse
    } else c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), (2.2 + Math.abs(c.speed) * 0.08) * dt);
    if (hand) c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 22 * dt);
    // steering: lighter at speed
    const steerT = st * 0.55 * (1 - 0.45 * Math.min(1, Math.abs(c.speed) / MAX));
    c.steer = lerp(c.steer, steerT, 1 - Math.exp(-dt * 7));
    c.yaw += c.speed * Math.tan(c.steer) / 2.3 * dt * (hand ? 1.35 : 1);
    // move in small sub-steps with collision
    const ox = c.x, oz = c.z;
    const dist = c.speed * dt, n = Math.max(1, Math.ceil(Math.abs(dist) / 0.25));
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    let nx = 0, nz = 0, hit = false;
    const tmp = this._tmp || (this._tmp = []);
    for (let s = 0; s < n; s++) {
      c.x += fx * dist / n; c.z += fz * dist / n;
      for (let it = 0; it < 3; it++) {
        let moved = false;
        for (const off of [-1.22, 0, 1.22]) {
          const cx = c.x + fx * off, cz = c.z + fz * off, r = 0.9;
          for (const b of Ph.query(cx - r, cz - r, cx + r, cz + r, tmp)) {
            if (b === this.box || b.maxY <= c.y + 0.5 || b.minY >= c.y + 1.8) continue;
            const p = Physics.circlePush(b, cx, cz, r);
            if (p) { c.x += p[0]; c.z += p[1]; nx += p[0]; nz += p[1]; moved = hit = true; }
          }
        }
        if (!moved) break;
      }
    }
    // the giant is an obstacle too (and does not like being run into)
    const B = g.boss;
    if (B && B.solid()) {
      const dx = c.x - B.pos.x, dz = c.z - B.pos.z, d = Math.hypot(dx, dz);
      if (d < 2.5 && d > 1e-3) {
        c.x += dx / d * (2.5 - d); c.z += dz / d * (2.5 - d); nx += dx / d; nz += dz / d; hit = true;
        if (Math.abs(c.speed) > 4 && g.time > (this._bossHitT || 0)) { this._bossHitT = g.time + 1; B.damage(Math.abs(c.speed) * 5, 'body', { x: fx, z: fz }, 'player'); }
      }
    } else if (B && B.state === 'SLEEP' && Math.hypot(c.x - B.pos.x, c.z - B.pos.z) < 3) { B.wake('player'); c.speed *= -0.3; }
    if (hit) {
      const l = Math.hypot(nx, nz) || 1, into = -(fx * nx + fz * nz) / l * Math.sign(c.speed || 1);
      const impact = Math.abs(c.speed) * Math.max(0, into);
      if (impact > 5 && g.time > c.crashT) {
        c.crashT = g.time + 0.5;
        g.audio.play('bang', { pos: [c.x, 1, c.z], vol: clamp(impact / 12, 0.4, 1.1), rate: 0.9 });
        g.audio.play('wall', { pos: [c.x, 1, c.z], vol: 0.7 });
        g.fx.burst([c.x + fx * 1.9 * Math.sign(c.speed), 0.8, c.z + fz * 1.9 * Math.sign(c.speed)], [-fx, 0.5, -fz], 10, [0.6, 0.6, 0.55], 3);
        P.shake = Math.max(P.shake, clamp(impact / 14, 0.2, 0.8));
        g.noise({ x: c.x, z: c.z }, 25, 'crash');
        c.speed *= -0.25;
      } else c.speed *= 1 - 0.85 * clamp(into, 0, 1) * Math.min(1, dt * 12);
    }
    // stay on the ground; never drive into a hole (the temple stair shaft) or off a high ledge
    const gy = Ph.groundAt(c.x, c.z, 0.9, c.y + 0.5);
    if (gy < c.y - 1.0) { c.x = ox; c.z = oz; c.speed = 0; }
    else c.y = gy > c.y ? lerp(c.y, gy, 1 - Math.exp(-dt * 14)) : Math.max(gy, c.y - 9 * dt);
    // run zombies down (each one can be hit at most once every 0.8 s)
    this.ram(dt, fx, fz);
    // body motion: lean into turns, pitch with acceleration, wheels spin and steer
    const acc = (c.speed - (this._lastSpeed ?? c.speed)) / Math.max(dt, 1e-3); this._lastSpeed = c.speed;
    c.lean = lerp(c.lean, -c.steer * c.speed * 0.012, 1 - Math.exp(-dt * 5));
    c.pitch = lerp(c.pitch, clamp(-acc * 0.006, -0.05, 0.05), 1 - Math.exp(-dt * 5));
    c.spin += c.speed * dt / 0.38;
    for (const w of this.wheels) { w.w.rotation.x = c.spin; if (w.front) w.pivot.rotation.y = c.steer; }
    this._syncMesh(); this._syncBox();
    // the player rides along: zombies, the minimap, trains and noises all follow the jeep
    P.pos.x = c.x; P.pos.y = c.y; P.pos.z = c.z; P.smoothY = c.y; P.state.peak = c.y; P.state.vy = 0;
    P.yaw = c.yaw + Math.PI; P.crouched = false; P.onGround = true;
    P.speedNow = Math.abs(c.speed); P.distance += Math.hypot(c.x - ox, c.z - oz);
    P.noise = 9 + Math.abs(c.speed) * 1.2;
    P.shake = Math.max(0, P.shake - dt * 2.5);
    // engine note follows speed and throttle
    if (this.engine) { this.engine.playbackRate.value = 0.75 + Math.abs(c.speed) / MAX * 1.25 + Math.max(0, thr) * 0.12; this.engine.gain.gain.value = 0.26 + Math.abs(thr) * 0.14; }
    this.followCam(dt, I);
  }

  ram(dt, fx, fz) {
    const g = this.g, c = this.car, sp = Math.abs(c.speed), now = g.time;
    const rx = fz, rz = -fx;                       // right vector
    for (const e of g.enemies.list) {
      if (e.dead) continue;
      const dx = e.pos.x - c.x, dz = e.pos.z - c.z;
      if (Math.abs(dx) > 3 || Math.abs(dz) > 3 || Math.abs(e.pos.y - c.y) > 1.6) continue;
      const lz = dx * fx + dz * fz, lx = dx * rx + dz * rz;
      if (Math.abs(lx) > 1.2 || Math.abs(lz) > 2.3) continue;
      if (sp > 3 && now > (e._carT || 0)) {
        e._carT = now + 0.8;
        const dir = { x: fx * Math.sign(c.speed), z: fz * Math.sign(c.speed) };
        const killed = g.enemies.damage(e, sp * 9, 'body', dir, 'player');
        e.stagger = Math.max(e.stagger, 0.9);
        const side = lx >= 0 ? 1 : -1, k = Math.min(2.2, sp * 0.12);
        g.physics.moveCharacter(e.pos, dir.x * k + rx * side * k, dir.z * k + rz * side * k, 0, 0.016, 0.3, 1.7, 0.45, e.st);
        g.audio.play('flesh', { pos: [e.pos.x, 1.2, e.pos.z], vol: 1 }); g.audio.play('bang', { pos: [e.pos.x, 1, e.pos.z], vol: 0.45, rate: 1.3 });
        g.fx.burst([e.pos.x, 1.1, e.pos.z], [dir.x, 0.6, dir.z], 12, [0.45, 0.02, 0.02], 3.5, 0.7);
        if (killed) g.fx.bloodPool(e.pos.x, e.pos.y, e.pos.z, 1.2);
        g.hitMarker(false, killed);
        c.speed *= killed ? 0.92 : e.type === 'brute' ? 0.4 : 0.72;
      } else {
        // slow: just shove them out of the way, never let anyone stand inside the jeep
        const side = lx >= 0 ? 1 : -1, push = 1.25 - Math.abs(lx);
        if (push > 0) g.physics.moveCharacter(e.pos, rx * side * push, rz * side * push, 0, 0.016, 0.3, 1.7, 0.45, e.st);
      }
    }
  }

  followCam(dt, I) {
    const g = this.g, c = this.car, cam = g.camera;
    // drag to look around the jeep; it swings back behind after a moment
    if (Math.abs(I.look.x) + Math.abs(I.look.y) > 1e-5) this.lookIdle = 0; else this.lookIdle += dt;
    this.camYaw -= I.look.x; this.camPitch = clamp(this.camPitch + I.look.y * 0.6, -0.35, 0.6);
    I.look.x = 0; I.look.y = 0;
    if (this.lookIdle > 1.6) { this.camYaw *= Math.exp(-dt * 2.5); this.camPitch *= Math.exp(-dt * 2.5); }
    const a = c.yaw + Math.PI + this.camYaw, dist = 7.4 - this.camPitch * 2;
    let tx = c.x + Math.sin(a) * dist, tz = c.z + Math.cos(a) * dist, ty = c.y + 3.0 + this.camPitch * 4;
    // don't put the camera inside a wall
    const hx = c.x, hy = c.y + 1.9, hz = c.z, dx = tx - hx, dy = ty - hy, dz = tz - hz, d = Math.hypot(dx, dy, dz);
    const hit = g.physics.raycast(hx, hy, hz, dx / d, dy / d, dz / d, d, 'vehicle');
    if (hit) { const k = Math.max(0.8, hit.t - 0.35) / d; tx = hx + dx * k; ty = hy + dy * k; tz = hz + dz * k; }
    const k = 1 - Math.exp(-dt * 7);
    cam.position.x += (tx - cam.position.x) * k; cam.position.y += (ty - cam.position.y) * k; cam.position.z += (tz - cam.position.z) * k;
    const sh = g.player.shake * g.player.shake * 0.08;
    cam.position.x += (Math.random() - 0.5) * sh; cam.position.y += (Math.random() - 0.5) * sh;
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    cam.lookAt(c.x + fx * 3, c.y + 1.3, c.z + fz * 3);
    if (cam.fov !== 70) { cam.fov = 70; cam.updateProjectionMatrix(); }
    // the camera torch doubles as the headlights
    g.torch.intensity = 38; g.torch.distance = 48; g.torch.angle = 0.5;
  }

  // ================= fire =================
  update(dt) {
    const g = this.g, cam = g.camera.position;
    const valley = g.inValley ? g.inValley() : g.secret && g.secret.mode;
    if (this.hotMat) { const f = 0.55 + Math.sin(g.time * 9) * 0.12 + Math.sin(g.time * 23) * 0.08 + Math.random() * 0.1; this.hotMat.color.setRGB(0.95 * f, 0.32 * f, 0.06 * f); }
    if (this.glowMat) this.glowMat.opacity = 0.62 + Math.sin(g.time * 7.3) * 0.08 + Math.random() * 0.06;
    if (valley) return;
    const X = g.explosives;
    for (const b of this.burning) {
      if (Math.abs(b.x - cam.x) > 115 || Math.abs(b.z - cam.z) > 115) continue;
      const wind = [0.5 + Math.sin(g.time * 0.3 + b.phase) * 0.3, 0.25];
      // flames: rate per second split over the emitters by weight
      b.acc[0] += dt * 70;
      while (b.acc[0] >= 1) {
        b.acc[0] -= 1;
        const e = b.emit[(Math.random() * Math.random() * b.emit.length) | 0];
        const big = e.w;
        X.fire.emit(e.x + (Math.random() - 0.5) * 0.9 * big, e.y + Math.random() * 0.2, e.z + (Math.random() - 0.5) * 0.9 * big,
          wind[0] * 0.4 + (Math.random() - 0.5) * 0.5, 2.0 + Math.random() * 2.4 * big, wind[1] * 0.4 + (Math.random() - 0.5) * 0.5,
          0.5 + Math.random() * 0.6 * big, 1.0 + big * 0.9, 0.2, FIRE.core, FIRE.deep, 0.9, 2.2, 0.9);
      }
      // a bright, short-lived core low in the cabin and engine bay
      if (Math.random() < dt * 30) { const e = b.emit[(Math.random() * 2) | 0]; X.fire.emit(e.x, e.y + 0.1, e.z, 0, 0.6, 0, 0.3, 1.6, 0.9, FIRE.white, FIRE.hot, 0.8, 0, 0); }
      // smoke from above the flames
      b.acc[1] += dt * 11;
      while (b.acc[1] >= 1) {
        b.acc[1] -= 1;
        // the base of the column is lit orange by the flames, then it cools to grey and drifts off
        X.smoke.emit(b.x + (Math.random() - 0.5) * 1.2, 2.4 + Math.random() * 0.6, b.z + (Math.random() - 0.5) * 1.6,
          wind[0] + (Math.random() - 0.5) * 0.4, 1.5 + Math.random() * 0.9, wind[1] + (Math.random() - 0.5) * 0.4,
          5.5 + Math.random() * 2.5, 1.2, 6.5 + Math.random() * 2.5, [0.42, 0.22, 0.1], [0.2, 0.2, 0.21], 0.62, 0.3, 0.15);
      }
      // embers drifting up
      b.acc[2] += dt * 5;
      while (b.acc[2] >= 1) {
        b.acc[2] -= 1;
        X.fire.emit(b.x + (Math.random() - 0.5) * 1.4, 1.5, b.z + (Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 1.5 + wind[0], 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 1.5, 1.6 + Math.random() * 1.6, 0.13, 0.05, FIRE.ember, FIRE.deep, 1, 0.3, 0.4);
      }
      // now and then something pops and throws sparks
      b.sparkT -= dt;
      if (b.sparkT <= 0) {
        b.sparkT = 0.8 + Math.random() * 2.2;
        g.fx.burst([b.x + (Math.random() - 0.5), 1.2, b.z + (Math.random() - 0.5) * 2], [0, 1, 0], 8 + (Math.random() * 8 | 0), [1, 0.65, 0.25], 4, 0.6);
        if (Math.random() < 0.35) g.audio.play('wall', { pos: [b.x, 1.2, b.z], vol: 0.35, rate: 1.6 });
      }
    }
  }
}
