// Instanced props: electric poles + wires, street lamps, trees, parked
// vehicles, rooftop tanks, dish antennas, sleepers, cows, carts...
// Each prop type is ONE draw call no matter how many copies exist.
import * as THREE from 'three';
import { ROADS, roadInfo } from './layout.js';
import { rgb } from './util.js';

// ---------- tiny geometry kit: merge coloured primitives ----------
function part(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
  const c = rgb(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c[0]; arr[i * 3 + 1] = c[1]; arr[i * 3 + 2] = c[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  g.deleteAttribute('uv');
  return g;
}
const Bx = (sx, sy, sz) => new THREE.BoxGeometry(sx, sy, sz);
const Cy = (r0, r1, h, n = 10) => new THREE.CylinderGeometry(r0, r1, h, n);
function merge(parts) {
  let total = 0;
  for (const p of parts) total += p.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
  let o = 0;
  for (const p of parts) {
    pos.set(p.attributes.position.array, o * 3); nor.set(p.attributes.normal.array, o * 3); col.set(p.attributes.color.array, o * 3);
    o += p.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

const WHEEL = (r, w) => Cy(r, r, w, 10);
export { part, merge, Bx, Cy, WHEEL };
export const GEO = {
  pole() { // PCC pole with cross-arm and insulators
    return merge([
      part(Bx(0.22, 8.6, 0.16), 0x9a968e, 0, 4.3, 0),
      part(Bx(1.6, 0.1, 0.1), 0x6a6a6a, 0, 7.9, 0),
      part(Cy(0.04, 0.05, 0.16, 6), 0xdad6c8, -0.7, 8.03, 0), part(Cy(0.04, 0.05, 0.16, 6), 0xdad6c8, 0.7, 8.03, 0),
      part(Cy(0.04, 0.05, 0.16, 6), 0xdad6c8, 0, 8.68, 0),
      part(Bx(0.5, 0.4, 0.3), 0x5a5a58, 0, 2.6, 0.18), // meter box
    ]);
  },
  lampArm() {
    return merge([part(Bx(0.06, 0.06, 1.7), 0x555555, 0, 7.0, 0.85), part(Bx(0.22, 0.1, 0.5), 0x3a3a3a, 0, 6.95, 1.65)]);
  },
  tree() { return merge([part(Cy(0.16, 0.26, 3.2, 7), 0x5a4632, 0, 1.6, 0), part(Cy(0.06, 0.1, 1.6, 5), 0x5a4632, 0.5, 3.2, 0.2, 0, 0, -0.6), part(Cy(0.06, 0.1, 1.6, 5), 0x5a4632, -0.4, 3.3, -0.2, 0.3, 0, 0.6)]); },
  canopy(detail = 1) { return new THREE.IcosahedronGeometry(1, detail); },
  bike() {
    return merge([
      part(WHEEL(0.31, 0.1), 0x151515, 0, 0.31, 0.68, 0, 0, Math.PI / 2), part(WHEEL(0.31, 0.1), 0x151515, 0, 0.31, -0.68, 0, 0, Math.PI / 2),
      part(Bx(0.26, 0.32, 0.9), 0xffffff, 0, 0.62, 0), part(Bx(0.3, 0.18, 0.45), 0xffffff, 0, 0.86, 0.22),
      part(Bx(0.26, 0.1, 0.55), 0x1a1a1a, 0, 0.88, -0.25), part(Bx(0.7, 0.04, 0.04), 0x2a2a2a, 0, 1.08, 0.62),
      part(Bx(0.06, 0.5, 0.06), 0x777777, 0, 0.8, 0.62, 0.35, 0, 0), part(Cy(0.08, 0.08, 0.08, 8), 0xdddddd, 0, 1.0, 0.72, Math.PI / 2, 0, 0),
      part(Bx(0.12, 0.08, 0.6), 0x888888, 0.15, 0.35, -0.25),
    ]);
  },
  car() {
    return merge([
      part(Bx(1.6, 0.6, 3.7), 0xffffff, 0, 0.55, 0), part(Bx(1.45, 0.55, 2.0), 0xffffff, 0, 1.12, -0.25),
      part(Bx(1.47, 0.4, 1.7), 0x1a2028, 0, 1.15, -0.25), part(Bx(1.3, 0.38, 0.05), 0x1a2028, 0, 1.12, 0.77, -0.5, 0, 0),
      ...[[0.7, 1.15], [-0.7, 1.15], [0.7, -1.2], [-0.7, -1.2]].map(([x, z]) => part(WHEEL(0.3, 0.2), 0x111111, x, 0.3, z, 0, 0, Math.PI / 2)),
      part(Bx(0.3, 0.1, 0.05), 0xfff0c0, 0.5, 0.65, 1.86), part(Bx(0.3, 0.1, 0.05), 0xfff0c0, -0.5, 0.65, 1.86),
      part(Bx(0.3, 0.1, 0.05), 0x900000, 0.55, 0.7, -1.86), part(Bx(0.3, 0.1, 0.05), 0x900000, -0.55, 0.7, -1.86),
      part(Bx(1.0, 0.15, 0.05), 0xf0f0f0, 0, 0.42, 1.86),
    ]);
  },
  auto() { // three-wheeler: green lower body, yellow canopy
    return merge([
      part(Bx(1.3, 0.55, 2.4), 0x2f8a3a, 0, 0.6, 0), part(Bx(1.0, 0.6, 0.5), 0x2f8a3a, 0, 0.9, 1.1),
      part(Bx(1.36, 0.9, 2.0), 0xe8c020, 0, 1.55, -0.1), part(Bx(1.25, 0.6, 1.6), 0x101010, 0, 1.3, -0.1),
      part(Bx(1.0, 0.45, 0.04), 0x1a2028, 0, 1.45, 1.0, -0.2, 0, 0),
      part(WHEEL(0.22, 0.14), 0x111111, 0, 0.22, 1.1, 0, 0, Math.PI / 2),
      part(WHEEL(0.22, 0.14), 0x111111, 0.62, 0.22, -0.8, 0, 0, Math.PI / 2), part(WHEEL(0.22, 0.14), 0x111111, -0.62, 0.22, -0.8, 0, 0, Math.PI / 2),
      part(Bx(1.1, 0.35, 0.5), 0x3a2a20, 0, 0.95, -0.6),
    ]);
  },
  bus() {
    const p = [
      part(Bx(2.5, 1.2, 10), 0xffffff, 0, 1.15, 0), part(Bx(2.52, 0.9, 9.4), 0x1a2028, 0, 2.15, -0.2), part(Bx(2.5, 0.4, 10), 0xffffff, 0, 2.8, 0),
      part(Bx(2.52, 0.18, 10.02), 0xc04020, 0, 1.5, 0), part(Bx(2.3, 1.0, 0.05), 0x22303a, 0, 2.1, 5.0),
      part(Bx(1.6, 0.3, 0.05), 0xffa000, 0, 2.8, 5.02), part(Bx(2.4, 0.15, 9.6), 0xcccccc, 0, 3.05, 0),
    ];
    for (const [x, z] of [[1.1, 3.4], [-1.1, 3.4], [1.1, -3.2], [-1.1, -3.2]]) p.push(part(WHEEL(0.5, 0.3), 0x111111, x, 0.5, z, 0, 0, Math.PI / 2));
    return merge(p);
  },
  cart() {
    return merge([
      part(Bx(1.1, 0.08, 2.0), 0x8a6a44, 0, 0.82, 0), part(Bx(1.1, 0.25, 0.05), 0x7a5a34, 0, 0.95, 1.0), part(Bx(1.1, 0.25, 0.05), 0x7a5a34, 0, 0.95, -1.0),
      part(WHEEL(0.38, 0.06), 0x333333, 0.6, 0.38, 0.2, 0, 0, Math.PI / 2), part(WHEEL(0.38, 0.06), 0x333333, -0.6, 0.38, 0.2, 0, 0, Math.PI / 2),
      part(Bx(0.05, 0.8, 0.05), 0x7a5a34, 0, 0.4, -0.9), part(Bx(1.3, 0.04, 2.2), 0x2a5fa8, 0, 1.9, 0),
      part(Bx(0.04, 1.1, 0.04), 0x7a5a34, 0.5, 1.35, 0.9), part(Bx(0.04, 1.1, 0.04), 0x7a5a34, -0.5, 1.35, -0.9),
      part(Bx(0.9, 0.25, 1.6), 0xc08040, 0, 0.98, 0),
    ]);
  },
  cow() {
    return merge([
      part(Bx(0.6, 0.55, 1.4), 0xffffff, 0, 0.55, 0), part(Bx(0.32, 0.36, 0.5), 0xffffff, 0, 0.6, 0.85, 0.5, 0, 0),
      part(Bx(0.06, 0.18, 0.06), 0x9a9080, 0.12, 0.88, 0.8, -0.3, 0, 0.3), part(Bx(0.06, 0.18, 0.06), 0x9a9080, -0.12, 0.88, 0.8, -0.3, 0, -0.3),
      part(Bx(0.5, 0.3, 0.3), 0xffffff, 0, 0.42, 0.95), // folded legs (resting)
      part(Bx(0.2, 0.2, 0.3), 0xffffff, 0.25, 0.15, -0.4), part(Bx(0.2, 0.2, 0.3), 0xffffff, -0.25, 0.15, 0.3),
      part(Bx(0.32, 0.25, 0.25), 0xe8d0b0, 0, 0.9, 0.0),
    ]);
  },
  tank() { return merge([part(Cy(0.62, 0.62, 1.15, 12), 0x161616, 0, 0.6, 0), part(Cy(0.25, 0.25, 0.12, 10), 0x202020, 0, 1.22, 0), part(Bx(0.08, 0.6, 0.08), 0x666666, 0.7, 0.3, 0)]); },
  dish() { return merge([part(Cy(0.32, 0.18, 0.05, 12), 0xd8d8d8, 0, 0.15, 0, -1.1, 0, 0), part(Bx(0.04, 0.6, 0.04), 0x777777, 0, -0.15, -0.05)]); },
  sleeper() { return merge([part(Bx(2.4, 0.14, 0.24), 0x8a8680, 0, 0.12, 0)]); },
  barrier() {
    const p = [part(Bx(0.3, 1.1, 0.3), 0x333333, 0, 0.55, 0)];
    for (let i = 0; i < 7; i++) p.push(part(Bx(0.9, 0.12, 0.08), i % 2 ? 0xd02020 : 0xf0f0f0, 0.6 + i * 0.9, 1.0, 0));
    return merge(p);
  },
  fan() { return merge([part(Cy(0.1, 0.12, 0.12, 8), 0x8a8a8a, 0, -0.25, 0), part(Bx(0.02, 0.25, 0.02), 0x555555, 0, -0.12, 0),
    part(Bx(0.55, 0.01, 0.1), 0xbbbbbb, 0.33, -0.3, 0), part(Bx(0.55, 0.01, 0.1), 0xbbbbbb, -0.16, -0.3, 0.29, 0, 2.094, 0), part(Bx(0.55, 0.01, 0.1), 0xbbbbbb, -0.16, -0.3, -0.29, 0, -2.094, 0)]); },
};

function instanced(scene, geo, mat, list, setup) {
  if (!list.length) return null;
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), c = new THREE.Color();
  list.forEach((it, i) => {
    const o = setup(it, i);
    v.set(o.x, o.y, o.z); q.setFromEuler(new THREE.Euler(o.rx || 0, o.yaw || 0, o.rz || 0)); s.setScalar(o.s || 1);
    if (o.sv) s.set(...o.sv);
    m.compose(v, q, s); im.setMatrixAt(i, m);
    if (o.color !== undefined) im.setColorAt(i, c.set(o.color));
  });
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.computeBoundingSphere();
  scene.add(im);
  return im;
}

// ---------- generate pole lines along every road ----------
function poleLines(W) {
  const r = W.rng, P = W.P;
  const blocked = (x, z) => P.groundAt(x, z, 0.3, 50) > 0.3;
  for (const [name, road] of Object.entries(ROADS)) {
    const i = roadInfo(road);
    const lane = road.s === 'lane';
    const side = name.length % 2 ? 1 : -1;
    const step = lane ? 24 : 27;
    const off = road.w / 2 + (lane ? 0.25 : 0.95);
    let prev = null, idx = 0;
    for (let t = 6; t < i.len - 4; t += step + r.range(-3, 3)) {
      const x = road.a[0] + i.ux * t + i.nx * side * off, z = road.a[1] + i.uz * t + i.nz * side * off;
      if (blocked(x, z)) { prev = null; continue; }
      const lamp = !lane || idx % 2 === 0;
      const pole = { p: [x, 0, z], lamp, yaw: Math.atan2(-i.nx * side, -i.nz * side), road: name };
      W.props.poles.push(pole);
      if (prev) {
        for (const h of [8.0, 7.6]) W.props.wires.push({ line: [[prev.p[0] - 0.7 * i.uz, h, prev.p[2] + 0.7 * i.ux], [x - 0.7 * i.uz, h, z + 0.7 * i.ux]], sag: 0.45 });
        W.props.wires.push({ line: [[prev.p[0], 8.65, prev.p[2]], [x, 8.65, z]], sag: 0.35 });
      }
      // service drops to houses across / beside the road
      for (let k = 0; k < 2; k++) {
        const across = r.chance(0.5) ? -side : side;
        const ex = x + i.nx * across * (road.w + 1.5) + i.ux * r.range(-8, 8), ez = z + i.nz * across * (road.w + 1.5) + i.uz * r.range(-8, 8);
        const top = P.groundAt(ex, ez, 0.2, 40);
        if (top > 3) W.props.wires.push({ line: [[x, 7.5, z], [ex, Math.min(top - 0.4, 6.2), ez]], sag: 0.6 });
      }
      prev = pole; idx++;
    }
  }
}

function parkedVehicles(W) {
  const r = W.rng, P = W.P;
  const clear = (x, z, rad) => P.groundAt(x, z, rad, 50) < 0.15;
  for (const [name, road] of Object.entries(ROADS)) {
    if (road.s === 'lane') continue;
    const i = roadInfo(road);
    for (let t = 8; t < i.len - 8; t += r.range(9, 18)) {
      const side = r.chance(0.5) ? 1 : -1;
      const off = road.w / 2 - 1.1;
      const x = road.a[0] + i.ux * t + i.nx * side * off, z = road.a[1] + i.uz * t + i.nz * side * off;
      if (!clear(x, z, 1.4)) continue;
      const roll = r();
      const yaw = i.yaw + (r.chance(0.5) ? 0 : Math.PI) + r.range(-0.08, 0.08);
      if (roll < 0.35) W.props.bikes.push({ p: [x, 0, z], yaw: i.yaw + Math.PI / 2 + r.range(-0.4, 0.4) });
      else if (roll < 0.6) W.props.cars.push({ p: [x, 0, z], yaw });
      else if (roll < 0.75) W.props.autos.push({ p: [x, 0, z], yaw });
      else if (roll < 0.82) W.props.carts.push({ p: [x, 0, z], yaw });
    }
    // one crashed car across the road
    if (name === 'MAIN' || name === 'WAHAB') {
      const t = i.len * (name === 'MAIN' ? 0.42 : 0.25);
      W.props.cars.push({ p: [road.a[0] + i.ux * t, 0, road.a[1] + i.uz * t], yaw: i.yaw + 1.1, wreck: true });
    }
  }
}

// ---------- build everything ----------
export function buildProps(W, scene, mats, tex) {
  poleLines(W);
  parkedVehicles(W);
  const P = W.P;
  const pr = W.props;
  const vc = mats.vcol;
  const out = { lampHeads: [], glows: null, fans: null, flagT: 0 };

  instanced(scene, GEO.pole(), vc, pr.poles, (p) => { P.add(p.p[0], p.p[1] + 4, p.p[2], 0.14, 4, 0.12, p.yaw); return { x: p.p[0], y: p.p[1], z: p.p[2], yaw: p.yaw }; });
  const lamps = pr.poles.filter((p) => p.lamp);
  instanced(scene, GEO.lampArm(), vc, lamps, (p) => ({ x: p.p[0], y: p.p[1], z: p.p[2], yaw: p.yaw }));
  // lamp states
  const r = W.rng;
  for (const p of lamps) {
    const hx = p.p[0] + Math.sin(p.yaw) * 1.65, hz = p.p[2] + Math.cos(p.yaw) * 1.65, hy = p.p[1] + 6.85;
    const broken = !p.major && r.chance(0.22);
    const flicker = !broken && r.chance(0.15);
    const color = p.rail ? 0xfff2d6 : r.chance(0.6) ? 0xffc47a : 0xe8f0ff; // sodium vs LED
    p.head = [hx, hy, hz]; p.broken = broken;
    if (!broken) W.lights.push({ baseY: p.p[1], x: hx, y: hy - 0.3, z: hz, color, intensity: p.major ? 9 : 6, dist: p.major ? 22 : 17, flicker: flicker ? 1 : 0, street: true, pool: true, glow: true });
    out.lampHeads.push({ x: hx, y: hy, z: hz, on: !broken, color });
  }
  // trees: trunk + three canopy blobs
  const trees = pr.trees;
  instanced(scene, GEO.tree(), vc, trees, (t) => { P.add(t.p[0], t.p[1] + 1.5, t.p[2], 0.25, 1.5, 0.25); return { x: t.p[0], y: t.p[1], z: t.p[2], s: t.s * (t.type === 'peepal' ? 1.3 : 1), yaw: t.p[0] * 3.1 }; });
  const blobs = [];
  for (const t of trees) {
    const k = t.s * (t.type === 'peepal' ? 1.45 : 1);
    const greens = t.type === 'peepal' ? [0x2f5a2a, 0x3a6a30, 0x2a4e26] : [0x34502c, 0x3e5e34, 0x2c4626, 0x4a5e30];
    const seed = Math.abs(Math.sin(t.p[0] * 12.9898 + t.p[2] * 78.233)) * 43758.5453;
    for (let b = 0; b < 4; b++) {
      const a = b * 1.9 + seed;
      const rad = b === 0 ? 0 : 1.3 * k;
      blobs.push({ x: t.p[0] + Math.cos(a) * rad, y: t.p[1] + (3.6 + (b === 0 ? 1.2 : 0.3 * b)) * k, z: t.p[2] + Math.sin(a) * rad, s: (b === 0 ? 2.2 : 1.6) * k, color: greens[(b + Math.floor(seed)) % greens.length], yaw: a });
    }
  }
  instanced(scene, GEO.canopy(W.lowPoly ? 0 : 1), mats.leaves, blobs, (b) => ({ x: b.x, y: b.y, z: b.z, sv: [b.s, b.s * 0.72, b.s], yaw: b.yaw, color: b.color }));

  const BIKE_C = [0x1a1a1a, 0xb01010, 0x1040a0, 0x202020, 0xe0e0e0, 0x404040];
  const CAR_C = [0xf0f0f0, 0xb8bcc0, 0x8a1010, 0x2a2a2e, 0x1a4a8a, 0xd8d0b8];
  instanced(scene, GEO.bike(), vc, pr.bikes, (b, i) => { P.add(b.p[0], 0.5, b.p[2], 0.25, 0.5, 0.95, b.yaw); return { x: b.p[0], y: 0, z: b.p[2], yaw: b.yaw, rz: 0.12, color: BIKE_C[i % BIKE_C.length] }; });
  instanced(scene, GEO.car(), vc, pr.cars, (c, i) => { P.add(c.p[0], 0.75, c.p[2], 0.82, 0.75, 1.88, c.yaw); return { x: c.p[0], y: 0, z: c.p[2], yaw: c.yaw, rz: c.wreck ? 0.08 : 0, color: c.wreck ? 0x4a3a30 : CAR_C[i % CAR_C.length] }; });
  instanced(scene, GEO.auto(), vc, pr.autos, (a) => { P.add(a.p[0], 1, a.p[2], 0.68, 1, 1.3, a.yaw); return { x: a.p[0], y: 0, z: a.p[2], yaw: a.yaw, color: 0xffffff }; });
  instanced(scene, GEO.bus(), vc, pr.buses, (b) => { P.add(b.p[0], 1.6, b.p[2], 1.27, 1.6, 5.05, b.yaw); return { x: b.p[0], y: 0, z: b.p[2], yaw: b.yaw, color: b.color }; });
  instanced(scene, GEO.cart(), vc, pr.carts, (c) => { P.add(c.p[0], 0.5, c.p[2], 0.6, 0.5, 1.05, c.yaw); return { x: c.p[0], y: 0, z: c.p[2], yaw: c.yaw, color: 0xffffff }; });
  instanced(scene, GEO.cow(), vc, pr.cows, (c, i) => { P.add(c.p[0], 0.5, c.p[2], 0.35, 0.5, 0.75, c.yaw); return { x: c.p[0], y: 0, z: c.p[2], yaw: c.yaw, color: i % 2 ? 0xf2efe8 : 0xb89878 }; });
  instanced(scene, GEO.tank(), vc, pr.tanks, (t) => ({ x: t.p[0], y: t.p[1], z: t.p[2], s: t.s, yaw: t.p[0] }));
  instanced(scene, GEO.dish(), vc, pr.dishes, (d) => ({ x: d.p[0], y: d.p[1], z: d.p[2], yaw: d.yaw }));
  instanced(scene, GEO.sleeper(), vc, pr.sleepers, (s) => ({ x: s[0], y: 0.05, z: s[1], yaw: Math.PI / 2 }));
  instanced(scene, GEO.barrier(), vc, pr.barriers, (b) => { P.add(b.p[0], 0.55, b.p[2], 0.15, 0.55, 0.15); return { x: b.p[0], y: 0, z: b.p[2], yaw: b.yaw, rz: 0.0 }; });
  out.fans = instanced(scene, GEO.fan(), vc, W.fans, (f) => ({ x: f[0], y: f[1], z: f[2] }));

  // wires: one LineSegments for the whole town
  const wp = [], wc = [];
  for (const w of pr.wires) {
    const [a, b] = w.line;
    const n = w.sag ? 8 : 1;
    const col = rgb(w.color || 0x111111);
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const P0 = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0 - w.sag * 4 * t0 * (1 - t0), a[2] + (b[2] - a[2]) * t0];
      const P1 = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1 - w.sag * 4 * t1 * (1 - t1), a[2] + (b[2] - a[2]) * t1];
      wp.push(...P0, ...P1); wc.push(...col, ...col);
    }
  }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
  wg.setAttribute('color', new THREE.Float32BufferAttribute(wc, 3));
  scene.add(new THREE.LineSegments(wg, mats.wire));

  // lamp glows (one Points draw) and ground light pools (one instanced draw)
  const gp = [], gc = [];
  for (const h of out.lampHeads) {
    gp.push(h.x, h.y - 0.1, h.z);
    const c = new THREE.Color(h.on ? h.color : 0x202020);
    gc.push(c.r, c.g, c.b);
  }
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
  gg.setAttribute('color', new THREE.Float32BufferAttribute(gc, 3));
  out.glows = new THREE.Points(gg, mats.glowPoints);
  // festive string lights + diyas: small points, twinkled by the game loop
  const fp = [], fc = [];
  for (const f of W.fairy) { fp.push(...f.p); const c = new THREE.Color(f.c); fc.push(c.r, c.g, c.b); }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  fg.setAttribute('color', new THREE.Float32BufferAttribute(fc, 3));
  out.fairy = new THREE.Points(fg, mats.fairyPoints);
  out.fairyBase = fc.slice();
  scene.add(out.fairy);
  out.glowBase = gc.slice();
  out.lampCount = out.lampHeads.length;
  scene.add(out.glows);

  const pools = W.lights.filter((l) => l.pool);
  if (W.special.highMast) pools.push({ x: W.special.highMast[0], z: W.special.highMast[2], color: 0xffd9a0, big: true });
  out.pools = instanced(scene, new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mats.pool, pools, (l) => ({ x: l.x, y: (l.baseY || 0) + 0.09, z: l.z, s: l.big ? 30 : 11, color: l.color }));
  out.poolLights = pools;
  return out;
}
