// Fixed landmarks: Maa Kamakhya Mandir + Alia market + well, railway with
// Jais City (former Kasimpur Halt) and Guru Gorakhnath Dham stations,
// level crossing, Naugazi trijunction and the bus adda.
import * as THREE from 'three';
import { rgb } from './util.js';
import { ROADS, RAIL, KAMAKHYA, NAUGAZI, frameOnRoad } from './layout.js';
import { Frame, Furn, shell, wallX, wallZ, door, stairs, FH, WT } from './interiors.js';

const WHITE = rgb(0xf4f1ea), SAFFRON = rgb(0xf08a1c), RED = rgb(0xb8202a), DARK = rgb(0x222224);

export function buildLandmarks(W) {
  temple(W);
  aliaAndWell(W);
  railway(W);
  jaisCity(W);
  ggd(W);
  crossing(W);
  naugazi(W);
  busAdda(W);
  overheadBanners(W);
}

// ================= MAA KAMAKHYA MANDIR =================
function temple(W) {
  const T = KAMAKHYA.temple;
  // origin = middle of the front (south) wall; local +z runs north into the compound
  const F = new Frame(W, T.x, T.z + T.d / 2, Math.PI);
  const w = T.w, d = T.d;
  W.reserve(T.x, T.z, w / 2 + 0.5, d / 2 + 0.5);
  F.floorQuad('tile', -w / 2, 0, w / 2, d, 0.035, [1.05, 1.0, 0.95], 1.0);
  // boundary wall, white with saffron coping; gate in the middle of the front
  const wh = 1.7;
  wallX(F, 0.12, -w / 2, w / 2, 0, wh, WHITE, [{ c: 0, w: 3.4, h: 3, sill: 0 }], 'plaster', 0.25);
  wallX(F, d - 0.12, -w / 2, w / 2, 0, wh, WHITE, [], 'plaster', 0.25);
  wallZ(F, -w / 2 + 0.12, 0.25, d - 0.25, 0, wh, WHITE, [], 'plaster', 0.25);
  wallZ(F, w / 2 - 0.12, 0.25, d - 0.25, 0, wh, WHITE, [], 'plaster', 0.25);
  for (const [x0, x1] of [[-w / 2, -1.7], [1.7, w / 2]]) F.box('plain', (x0 + x1) / 2, wh + 0.05, 0.12, x1 - x0, 0.1, 0.32, SAFFRON, { collide: false });
  F.box('plain', 0, wh + 0.05, d - 0.12, w, 0.1, 0.32, SAFFRON, { collide: false });
  F.box('plain', -w / 2 + 0.12, wh + 0.05, d / 2, 0.32, 0.1, d, SAFFRON, { collide: false });
  F.box('plain', w / 2 - 0.12, wh + 0.05, d / 2, 0.32, 0.1, d, SAFFRON, { collide: false });
  // gate: pillars + arch board
  for (const sx of [-1.95, 1.95]) {
    F.box('plaster', sx, 2.1, 0.12, 0.6, 4.2, 0.6, rgb(0xf6d6a0));
    F.box('plain', sx, 4.35, 0.12, 0.75, 0.3, 0.75, SAFFRON, { collide: false });
    F.cyl('plain', sx, 4.5, 0.12, 0.18, 0.45, rgb(0xd4a020), 8);
  }
  F.box('plaster', 0, 4.0, 0.12, 4.5, 0.25, 0.5, rgb(0xf6d6a0), { collide: false });
  const gateSign = W.signs.board('जय माँ कामाख्या दुर्गा पूजा समिति', 'JAY MAA KAMAKHYA DURGA POOJA SAMITI', '#b3261e', '#ffe9a8', 768, 160);
  F.wallQuad('sign', 0, 3.45, -0.15, 3.9, 0.82, Math.PI, gateSign);
  F.wallQuad('sign', 0, 3.45, 0.39, 3.9, 0.82, 0, gateSign);
  // Kamakhya image panel above the gate (user image "kamakhya")
  W.special.kamakhyaGate = { F, x: 0, y: 4.75, z: -0.05, w: 1.0, h: 1.0, faceYaw: Math.PI };

  // temple plinth + steps
  const pz0 = 6.8, pz1 = 15.6, ph = 1.0;
  F.box('concrete', 0, ph / 2, (pz0 + pz1) / 2, 8, ph, pz1 - pz0, rgb(0xe8dcc8), { uv: 1.5 });
  for (let i = 0; i < 3; i++) F.box('concrete', 0, (i + 1) * ph / 6, pz0 - 0.9 + i * 0.3, 3.2, (i + 1) * ph / 3, 0.3, rgb(0xd8ccb8));
  // mandapa: four pillars + flat roof with small domes
  const y0 = ph;
  for (const [px, pz] of [[-2.6, 7.3], [2.6, 7.3], [-2.6, 10.2], [2.6, 10.2]]) {
    F.box('plaster', px, y0 + 1.5, pz, 0.45, 3.0, 0.45, rgb(0xf6e2c0));
    F.box('plain', px, y0 + 0.15, pz, 0.6, 0.3, 0.6, SAFFRON, { collide: false });
  }
  F.box('concrete', 0, y0 + 3.1, 8.75, 6.2, 0.25, 3.5, rgb(0xf0dcc0), { collide: false });
  F.box('plain', 0, y0 + 3.3, 8.75, 6.3, 0.12, 3.6, SAFFRON, { collide: false });
  // garbhagriha (sanctum) walls with front entrance
  wallX(F, 10.6, -2.3, 2.3, y0, 3.4, rgb(0xf6e2c0), [{ c: 0, w: 1.4, h: 2.4, sill: 0 }], 'plaster', 0.3);
  wallX(F, 15.2, -2.3, 2.3, y0, 3.4, rgb(0xf6e2c0), [], 'plaster', 0.3);
  wallZ(F, -2.15, 10.75, 15.05, y0, 3.4, rgb(0xf6e2c0), [], 'plaster', 0.3);
  wallZ(F, 2.15, 10.75, 15.05, y0, 3.4, rgb(0xf6e2c0), [], 'plaster', 0.3);
  F.box('concrete', 0, y0 + 3.5, 12.9, 4.8, 0.2, 4.9, rgb(0xf0dcc0), { collide: false });
  F.floorQuad('tile', -2.0, 10.8, 2.0, 15.0, y0 + 0.012, [1.1, 0.9, 0.85], 0.8);
  // idol niche: red cloth + Kamakhya image (user image) + diyas
  F.box('fabric', 0, y0 + 1.5, 14.9, 2.6, 2.6, 0.06, RED, { collide: false });
  F.box('wood', 0, y0 + 0.4, 14.5, 2.2, 0.8, 0.8, rgb(0x8a3a20));
  W.special.kamakhyaIdol = { F, x: 0, y: y0 + 1.75, z: 14.84, w: 1.5, h: 1.5, faceYaw: Math.PI };
  for (const dx of [-0.9, -0.45, 0.45, 0.9]) {
    F.cyl('plain', dx, y0 + 0.8, 14.3, 0.05, 0.04, rgb(0xb06030), 6);
    W.fairy.push({ p: F.world(dx, y0 + 0.9, 14.3), c: 0xffb040, s: 0.25, diya: true });
  }
  const [sx, sy, sz] = F.world(0, y0 + 2.4, 13.6);
  W.lights.push({ x: sx, y: sy, z: sz, color: 0xff8a3a, intensity: 4.5, dist: 9, flicker: 1, major: true });
  const [mx, my, mz] = F.world(0, 4.2, 6.5);
  W.lights.push({ x: mx, y: my, z: mz, color: 0xffb060, intensity: 5, dist: 16, major: true });
  // bell at the mandapa entrance
  F.box('plain', 0, y0 + 2.95, 7.3, 0.05, 0.3, 0.05, DARK, { collide: false });
  F.cyl('plain', 0, y0 + 2.45, 7.3, 0.18, 0.38, rgb(0xc8962a), 10, { cap: true });
  W.special.bell = F.world(0, y0 + 2.4, 7.3);
  // shikhara: curved Nagara tower over the sanctum, built as a lathe
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    pts.push(new THREE.Vector2(2.4 * (1 - Math.pow(t, 1.6)) + 0.35, t * 8.0));
  }
  const [tx, ty, tz] = F.world(0, y0 + 3.6, 12.9);
  W.deferred.push((scene, mats) => {
    const g = new THREE.LatheGeometry(pts, 16);
    const m = new THREE.Mesh(g, mats.shikhara);
    m.position.set(tx, ty, tz); m.rotation.y = F.yaw + Math.PI / 16;
    scene.add(m);
    // ribs
    const rib = new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p.x * 1.04, p.y)), 4);
    const rm = new THREE.Mesh(rib, mats.shikharaRib);
    rm.position.copy(m.position); rm.rotation.y = F.yaw + Math.PI / 4;
    scene.add(rm);
    // amalaka + kalash
    const am = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.32, 16), mats.shikharaRib);
    am.position.set(tx, ty + 8.1, tz); scene.add(am);
    const ka = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), mats.gold);
    ka.position.set(tx, ty + 8.55, tz); scene.add(ka);
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.6, 8), mats.gold);
    sp.position.set(tx, ty + 9.05, tz); scene.add(sp);
    // saffron flag
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 5), mats.dark);
    pole.position.set(tx + 0.1, ty + 9.3, tz); scene.add(pole);
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1.5, -0.35, 0, 0, -0.75, 0], 3));
    fg.computeVertexNormals();
    const flag = new THREE.Mesh(fg, mats.flag);
    flag.position.set(tx + 0.1, ty + 10.55, tz); flag.userData.flag = true;
    scene.add(flag);
    W.special.flag = flag;
  });
  // fairy lights along the shikhara edges and compound wall
  for (let i = 0; i < 4; i++) {
    const a = F.yaw + Math.PI / 4 + i * Math.PI / 2;
    for (let k = 0; k < 14; k++) {
      const p = pts[k];
      W.fairy.push({ p: [tx + Math.sin(a) * p.x * 1.06, ty + p.y, tz + Math.cos(a) * p.x * 1.06], c: [0xff3030, 0x30ff60, 0xffd030, 0x3080ff][(k + i) % 4], s: 0.22 });
    }
  }
  for (let x = -w / 2; x <= w / 2; x += 0.7) {
    W.fairy.push({ p: F.world(x, wh + 0.2, 0.12), c: [0xff3030, 0xffd030, 0x30ff60, 0xff60c0][Math.abs(Math.round(x / 0.7)) % 4], s: 0.2 });
  }
  for (let x = -1.9; x <= 1.9; x += 0.35) W.fairy.push({ p: F.world(x, 4.2, -0.1), c: 0xffe080, s: 0.2 });

  // peepal tree with chabutra, inside the compound
  F.cyl('concrete', -6.2, 0, 5.0, 1.5, 0.5, rgb(0xd8ccb8), 12, { collide: true });
  W.props.trees.push({ p: F.world(-6.2, 0.5, 5.0), s: 1.5, type: 'peepal' });
  // green tin shed of the samiti store at the back (the green roof seen from above)
  for (const [px, pz] of [[-8.6, 14.2], [-1.4, 14.2], [-8.6, 17.6], [-1.4, 17.6]]) F.box('metal', px, 1.4, pz, 0.12, 2.8, 0.12, DARK);
  F.box('metal', -5, 2.85, 15.9, 7.8, 0.08, 4.0, rgb(0x3a9a5a), { collide: false });
  for (let i = 0; i < 6; i++) F.box('wood', -5, 0.15 + i * 0.12, 16.6, 6.5, 0.1, 0.1, rgb(0xb89a60), { collide: false });
  F.cyl('plain', -2.5, 0, 15.2, 0.35, 0.7, rgb(0x8a2020), 10, { collide: true });
  F.cyl('plain', -3.4, 0, 15.4, 0.3, 0.6, rgb(0x704020), 10, { collide: true });
  W.lootSpots.push({ p: F.world(-6, 0.05, 15.2), kind: 'food', w: 2, tag: 'prasad' });
  W.containers.push({ p: F.world(-7.5, 0.6, 16), type: 'trunk', label: 'समिति का बक्सा' });
  F.box('metal', -7.5, 0.25, 16.6, 0.9, 0.5, 0.55, rgb(0x2f6a4a));
  // sanctuary: zombies hesitate to cross the gate
  W.sanctuary.push({ F, x0: -w / 2, x1: w / 2, z0: 0, z1: d });
  W.templeFrame = F;
}

// ================= ALIA MARKET + WELL =================
function aliaAndWell(W) {
  // market arch over the lane entrance from the L2 lane
  const F = new Frame(W, -98.5, 40, 0);
  for (const dz of [-2.3, 2.3]) F.box('metal', 0, 2.6, dz, 0.16, 5.2, 0.16, rgb(0x2a4a6a));
  const s = W.signs.board('आलिया मार्केट', 'ALIA MARKET', '#1565c0', '#fff', 512, 128);
  F.wallQuad('sign', 0.06, 4.6, 0, 4.4, 1.1, Math.PI / 2, s);
  F.wallQuad('sign', -0.06, 4.6, 0, 4.4, 1.1, -Math.PI / 2, s);
  // chowk around the well: keep it open
  const wx = KAMAKHYA.well.x, wz = KAMAKHYA.well.z;
  W.reserve(wx, (42.5 + 63.5) / 2, 10, 10.5);
  W.B.ground('concrete', wx, (43 + 63.5) / 2, 18, 20.5, 0, 0.03, [0.85, 0.82, 0.78], 3);
  const B = W.B;
  // the well: brick shaft + plaster rim, dark water inside
  const r = 1.35;
  B.cylinder('brick', wx, 0, wz, r, 0.85, [0.95, 0.9, 0.88], 16, { cap: false, collide: true, uv: 1 });
  B.cylinder('plaster', wx, 0.85, wz, r + 0.06, 0.12, WHITE, 16, { cap: false });
  for (let i = 0; i < 16; i++) { // rim top ring
    const a0 = (i / 16) * Math.PI * 2, a1 = ((i + 1) / 16) * Math.PI * 2;
    const p = (a, rr) => [wx + Math.cos(a) * rr, 0.97, wz + Math.sin(a) * rr];
    B.quad('plaster', p(a0, r - 0.25), p(a1, r - 0.25), p(a1, r + 0.06), p(a0, r + 0.06), [0, 1, 0], [[0, 0], [0.2, 0], [0.2, 0.1], [0, 0.1]], WHITE, [wx, wz]);
  }
  W.special.wellWater = { x: wx, z: wz, r: r - 0.25 };
  // pulley frame
  for (const dx of [-1.15, 1.15]) B.box('wood', wx + dx, 1.35, wz, 0.14, 2.7, 0.14, [0.7, 0.6, 0.5], { collide: false });
  B.box('wood', wx, 2.65, wz, 2.5, 0.12, 0.12, [0.7, 0.6, 0.5], { collide: false });
  B.cylinder('metal', wx, 2.42, wz, 0.18, 0.06, DARK, 10);
  B.box('plain', wx, 1.5, wz, 0.02, 1.8, 0.02, rgb(0xb8a070), { collide: false });
  B.cylinder('metal', wx + 0.9, 0.97, wz + 0.5, 0.17, 0.3, rgb(0x707070), 8);
  W.special.well = [wx, 1.0, wz];
  // a hand pump and bench by the well
  W.pumps.push({ p: [wx + 6.5, 0, wz + 5] });
  Furn.bench(new Frame(W, wx - 6, wz + 4, 0), 0, 0, 0, 2);
  W.props.trees.push({ p: [wx - 7.5, 0, wz - 6.5], s: 1.1 });
  const [lx, lz] = [wx + 3, wz + 3];
  W.props.poles.push({ p: [lx, 0, lz], lamp: true, yaw: Math.PI, major: true });
}

// ================= RAILWAY =================
function railway(W) {
  const B = W.B;
  const lines = [[RAIL.mainZ, RAIL.x0, RAIL.x1], [RAIL.loopZ, 86, 192]];
  for (const [z, x0, x1] of lines) {
    const len = x1 - x0, cx = (x0 + x1) / 2;
    B.ground('concrete', cx, z, len, 3.6, 0, 0.05, [0.55, 0.52, 0.48], 2);
    for (let x = x0; x < x1; x += 0.7) W.props.sleepers.push([x, z]);
    for (let x = x0; x < x1; x += 30) {
      const seg = Math.min(30, x1 - x);
      for (const dz of [-0.75, 0.75]) B.box('metal', x + seg / 2, 0.22, z + dz, seg, 0.13, 0.08, [0.75, 0.72, 0.7], { collide: false });
    }
    W.reserve(cx, z, len / 2, 3);
  }
  // OHE masts with cantilever every 45 m; contact wire as lines
  for (let x = RAIL.x0 + 10; x < RAIL.x1; x += 45) {
    B.box('metal', x, 3.8, RAIL.mainZ - 3.4, 0.3, 7.6, 0.3, [0.5, 0.52, 0.5]);
    B.box('metal', x, 6.9, RAIL.mainZ - 1.6, 0.12, 0.12, 3.6, [0.5, 0.52, 0.5], { collide: false });
  }
  W.props.wires.push({ line: [[RAIL.x0, 6.1, RAIL.mainZ], [RAIL.x1, 6.1, RAIL.mainZ]], sag: 0 });
  W.props.wires.push({ line: [[RAIL.x0, 6.8, RAIL.mainZ], [RAIL.x1, 6.8, RAIL.mainZ]], sag: 0 });
  // railway boundary fence along the town side, with gaps at stations and the crossing
  const fz = -160.5;
  const gaps = [[-158, -142], [-7, 7], [86, 92], [186, 200]];
  let x = RAIL.x0;
  const segs = [];
  for (const g of gaps) { segs.push([x, g[0]]); x = g[1]; }
  segs.push([x, RAIL.x1]);
  for (const [a, b] of segs) {
    if (b - a < 0.5) continue;
    W.P.add((a + b) / 2, 0.8, fz, (b - a) / 2, 0.8, 0.1);
    for (let px = a; px <= b; px += 3) B.box('concrete', px, 0.8, fz, 0.14, 1.6, 0.14, [0.7, 0.68, 0.64], { collide: false });
    for (const h of [0.5, 1.0, 1.45]) W.props.wires.push({ line: [[a, h, fz], [b, h, fz]], sag: 0.05, color: 0x55524c });
    W.reserve((a + b) / 2, fz, (b - a) / 2, 0.6);
  }
  // north edge fields beyond the line
  for (let xx = RAIL.x0 + 5; xx < RAIL.x1; xx += 7) W.props.trees.push({ p: [xx + W.rng() * 4, 0, -192 - W.rng() * 6], s: 0.8 + W.rng() * 0.6 });
  // ambient: a stack of old sleepers and a rusty wagon wheel near the line
  for (let i = 0; i < 6; i++) B.box('concrete', -60 + i * 0.05, 0.12 + i * 0.22, -167, 2.6, 0.2, 0.3, [0.6, 0.58, 0.55], { collide: i === 0 });
}

function platform(W, x0, x1, z0, z1, h = 0.84) {
  const B = W.B;
  B.box('concrete', (x0 + x1) / 2, h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0, [0.78, 0.75, 0.7], { uv: 2 });
  // yellow safety edge on the track side(s)
  B.ground('plain', (x0 + x1) / 2, z0 + 0.3, x1 - x0, 0.25, 0, h + 0.01, [0.85, 0.7, 0.15]);
  B.ground('plain', (x0 + x1) / 2, z1 - 0.3, x1 - x0, 0.25, 0, h + 0.01, [0.85, 0.7, 0.15]);
  W.reserve((x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2);
}

// 3 steps going down from a platform edge. dir: 'S' (toward +z), 'E', 'W'
function steps(W, cx, cz, width, dir, h = 0.84) {
  const n = 3, run = 0.32;
  for (let i = 0; i < n; i++) {
    const hh = h * (n - i) / (n + 1);
    const off = run * (i + 0.5);
    if (dir === 'S') W.B.box('concrete', cx, hh / 2, cz + off, width, hh, run, [0.72, 0.7, 0.66]);
    if (dir === 'N') W.B.box('concrete', cx, hh / 2, cz - off, width, hh, run, [0.72, 0.7, 0.66]);
    if (dir === 'E') W.B.box('concrete', cx + off, hh / 2, cz, run, hh, width, [0.72, 0.7, 0.66]);
    if (dir === 'W') W.B.box('concrete', cx - off, hh / 2, cz, run, hh, width, [0.72, 0.7, 0.66]);
  }
}

function stationBoard(W, x, z, hi, en) {
  const B = W.B;
  for (const dx of [-1.5, 1.5]) B.box('metal', x + dx, 1.6 + 0.84, z, 0.1, 3.2, 0.1, [0.15, 0.15, 0.15], { collide: false });
  const uv = W.signs.station(hi, en);
  const F = new Frame(W, x, z, 0, 0.84);
  F.wallQuad('sign', 0, 2.6, -0.03, 3.6, 1.2, Math.PI, uv);
  F.wallQuad('sign', 0, 2.6, 0.03, 3.6, 1.2, 0, uv);
  W.lights.push({ x, y: 4.2, z: z + 1, color: 0xfff0d0, intensity: 2, dist: 8 });
}

// ================= JAIS CITY (former Kasimpur Halt) =================
function jaisCity(W) {
  const J = RAIL.jaisCity;
  const pz0 = RAIL.mainZ + 1.8, pz1 = -162;
  platform(W, J.x0, J.x1, pz0, pz1);
  steps(W, -150, pz1, 10, 'S');
  steps(W, J.x0, (pz0 + pz1) / 2, 4, 'W');
  stationBoard(W, J.x0 + 7, pz0 + 1.6, 'जायस सिटी', 'JAIS CITY');
  stationBoard(W, J.x1 - 7, pz0 + 1.6, 'जायस सिटी', 'JAIS CITY');
  // small halt building on the platform, facing the town
  const F = new Frame(W, -137, pz1, Math.PI, 0.84);
  W.currentBuilding = { name: 'jaisCity', F, w: 10, d: 5.2, floors: 1, tpl: 'halt' };
  W.buildings.push(W.currentBuilding);
  shell(F, 10, 5.2, 1, {
    color: rgb(0xe8c89a),
    front: [[{ c: -2.5, w: 1.0, h: 2.15, sill: 0 }, { c: 2, w: 0.6, h: 0.5, sill: 1.0 }]],
    back: [[{ c: -2.5, w: 1.6, h: 2.3, sill: 0 }, { c: 2.5, w: 1.0, h: 2.15, sill: 0 }]],
  });
  door(F, 'x', WT / 2, -2.5, 0, { label: 'स्टेशन' });
  wallZ(F, 0.6, WT, 5.2 - WT, 0, FH, rgb(0xf0f0e0), [{ c: 2.6, w: 0.95, h: 2.15, sill: 0 }], 'plaster', 0.14);
  door(F, 'z', 0.6, 2.6, 0, { label: 'स्टेशन मास्टर', locked: false });
  Furn.bench(F, -2.5, 3.9, 0, 3);
  Furn.table(F, 2.6, 1.6, 0, true);
  Furn.almirah(F, 4.4, 4.2, 0, -Math.PI / 2);
  Furn.trunk(F, 2.0, 4.4, 0);
  Furn.tube(F, -2.5, 2.8, WT + 0.05, 0, false);
  const old = W.signs.board('कासिमपुर हॉल्ट', 'KASIMPUR HALT (पुराना नाम)', '#f2c81e', '#111', 448, 112);
  F.wallQuad('sign', -2.5, 2.75, -0.04, 3.0, 0.75, Math.PI, old);
  const nb = W.signs.board('जायस सिटी', 'JAIS CITY', '#f2c81e', '#111', 448, 112);
  F.wallQuad('sign', 0, 2.75, 5.24, 4.0, 1.0, 0, nb);
  W.keySpots.push({ b: W.currentBuilding, p: F.world(2.6, 0.8, 1.6), label: 'जायस सिटी स्टेशन मास्टर ऑफिस' });
  W.enemySpots.push(F.world(-2, 0, 2.5));
  W.currentBuilding = null;
  // platform shelter + benches + lamps
  for (const px of [-128, -122, -116]) for (const pz of [pz0 + 2, pz1 - 2]) W.B.box('metal', px, 0.84 + 1.5, pz, 0.2, 3.0, 0.2, [0.3, 0.32, 0.3]);
  W.B.box('metal', -122, 0.84 + 3.05, (pz0 + pz1) / 2, 14, 0.1, pz1 - pz0 - 2, [0.45, 0.5, 0.55], { collide: false });
  for (const px of [-126, -119]) Furn.bench(new Frame(W, px, -167.5, 0, 0.84), 0, 0, 0, 2);
  for (const px of [-164, -152, -116]) W.props.poles.push({ p: [px, 0.84, pz1 - 0.6], lamp: true, yaw: 0, rail: true });
}

// ================= GURU GORAKHNATH DHAM =================
function ggd(W) {
  const G = RAIL.ggd;
  const B = W.B;
  // platform 1 (town side, next to the loop line where the rescue train stops)
  const p1z0 = RAIL.loopZ + 1.8, p1z1 = -158;
  platform(W, G.x0, G.x1, p1z0, p1z1);
  steps(W, G.x1, (p1z0 + p1z1) / 2, 4, 'E');
  steps(W, G.x0, (p1z0 + p1z1) / 2, 4, 'W');
  // platform 2 across the main line, reached by a track-level crossing at the east end
  const p2z0 = -184, p2z1 = RAIL.mainZ - 1.8;
  platform(W, 104, 182, p2z0, p2z1);
  steps(W, 182, (p2z0 + p2z1) / 2, 4, 'E');
  B.ground('wood', 184, (RAIL.mainZ + RAIL.loopZ) / 2, 3, 12, 0, 0.3, [0.7, 0.65, 0.6], 1);
  stationBoard(W, 100, p1z0 + 1.4, 'गुरु गोरखनाथ धाम', 'GURU GORAKHNATH DHAM');
  stationBoard(W, 176, p1z0 + 1.4, 'गुरु गोरखनाथ धाम', 'GURU GORAKHNATH DHAM');
  stationBoard(W, 142, p2z1 - 1.2, 'गुरु गोरखनाथ धाम', 'GURU GORAKHNATH DHAM');
  // canopy over platform 1
  for (let px = 104; px <= 176; px += 8) B.box('metal', px, 0.84 + 2, p1z1 - 1.0, 0.25, 4.0, 0.25, [0.35, 0.38, 0.4]);
  B.box('metal', 140, 0.84 + 4.05, p1z1 - 3.6, 76, 0.12, 6.4, [0.5, 0.55, 0.6], { collide: false });
  for (let px = 108; px < 176; px += 16) Furn.bench(new Frame(W, px, p1z0 + 3.2, 0, 0.84), 0, 0, 0, 2);
  for (let px = 104; px <= 176; px += 18) W.props.poles.push({ p: [px, 0.84, p1z0 + 1.0], lamp: true, yaw: Math.PI, rail: true });
  for (let px = 110; px <= 176; px += 22) W.props.poles.push({ p: [px, 0.84, p2z0 + 1.0], lamp: true, yaw: 0, rail: true });
  // drinking water tap
  B.box('concrete', 160, 0.84 + 0.5, p1z1 - 1.0, 1.4, 1.0, 0.5, [0.7, 0.75, 0.8]);
  W.pumps.push({ p: [160, 0.84, p1z1 - 1.6], tap: true });

  // station building: floor at platform level on a plinth, entrance from the forecourt (south)
  const sx0 = 120, sx1 = 148, bz0 = -158, bz1 = -149.5;
  B.box('concrete', (sx0 + sx1) / 2, 0.42, (bz0 + bz1) / 2, sx1 - sx0, 0.84, bz1 - bz0, [0.75, 0.72, 0.68]);
  steps(W, 134, bz1, 12, 'S');
  W.reserve((sx0 + sx1) / 2, (bz0 + bz1) / 2 + 2, (sx1 - sx0) / 2 + 1, (bz1 - bz0) / 2 + 3);
  const F = new Frame(W, 134, bz1, Math.PI, 0.84);
  const w = sx1 - sx0, d = bz1 - bz0;
  W.currentBuilding = { name: 'ggd', F, w, d, floors: 1, tpl: 'station' };
  W.buildings.push(W.currentBuilding);
  const col = rgb(0xe9b97a);
  shell(F, w, d, 1, {
    color: col,
    front: [[{ c: 0, w: 2.4, h: 2.6, sill: 0 }, { c: -9, w: 1.4, h: 2.3, sill: 0 }, { c: 9, w: 1.4, h: 2.3, sill: 0 }, { c: -4.5, w: 1.4, h: 1.3, sill: 0.9, grille: true }, { c: 4.5, w: 1.4, h: 1.3, sill: 0.9, grille: true }]],
    back: [[{ c: 0, w: 3, h: 2.6, sill: 0 }, { c: -9, w: 1.4, h: 2.3, sill: 0 }, { c: 9, w: 1.4, h: 2.3, sill: 0 }]],
  });
  // partitions: waiting room | booking hall | SM office
  wallZ(F, -5.5, WT, d - WT, 0, FH, rgb(0xf2ead8), [], 'plaster', 0.14);
  wallZ(F, 5.5, WT, d - WT, 0, FH, rgb(0xf2ead8), [{ c: 4.2, w: 1.0, h: 2.15, sill: 0 }], 'plaster', 0.14);
  door(F, 'z', 5.5, 4.2, 0, { label: 'स्टेशन मास्टर' });
  door(F, 'x', WT / 2, 9, 0, { label: 'दरवाज़ा' });
  // booking windows
  F.box('wood', 3.6, 0.55, 2.4, 3.2, 1.1, 0.5, rgb(0x6a4a30));
  for (let i = 0; i < 6; i++) Furn.bench(F, -9 + (i % 2) * 3, 2.5 + Math.floor(i / 2) * 2, 0, 2.2);
  Furn.table(F, 9.5, 3.5, 0, true);
  Furn.almirah(F, 13.4, 6.5, 0, -Math.PI / 2);
  Furn.trunk(F, 7.0, 7.2, 0);
  F.box('plain', 0, 2.3, 7.95 - WT, 3.6, 1.2, 0.04, rgb(0x1a1a1a), { collide: false }); // timetable board
  Furn.tube(F, 0, 2.8, WT + 0.04, 0, false);
  Furn.tube(F, -9, 2.8, WT + 0.04, 0, false);
  W.lootSpots.push({ p: F.world(9.5, 0.8, 3.5), kind: 'weapon', w: 3 });
  // facade: big name board, clock, arches
  const big = W.signs.station('गुरु गोरखनाथ धाम', 'GURU GORAKHNATH DHAM');
  F.box('plaster', 0, FH + 0.9, 0.0, 12, 1.8, 0.3, col, { collide: false });
  F.wallQuad('sign', 0, FH + 0.9, -0.17, 7.2, 1.5, Math.PI, big);
  F.cyl('plain', 0, FH + 2.0, 0.0, 0.45, 0.12, rgb(0xf0f0e8), 14);
  for (const ax of [-9, 0, 9]) F.box('plaster', ax, 2.75, -0.15, ax === 0 ? 3.2 : 2.0, 0.25, 0.3, rgb(0xd09050), { collide: false });
  W.enemySpots.push(F.world(-8, 0, 4), F.world(9, 0, 6));
  W.currentBuilding = null;
  const [lx, ly, lz] = F.world(0, 3.4, -2.5);
  W.lights.push({ x: lx, y: ly, z: lz, color: 0xfff0d8, intensity: 4, dist: 14, major: true });
  // forecourt
  B.ground('concrete', 136, -138, 52, 22, 0, 0.03, [0.8, 0.78, 0.74], 3);
  W.reserve(136, -138, 26, 11);
  for (const [ax, az, yaw] of [[118, -135, 0.3], [122, -134, 0.2], [150, -141, -1.2], [154, -136, 1.4]]) W.props.autos.push({ p: [ax, 0, az], yaw });
  W.props.cars.push({ p: [140, 0, -133], yaw: Math.PI / 2 + 0.1 });
  for (const tx of [112, 160]) W.props.trees.push({ p: [tx, 0, -144], s: 1.3 });
  W.props.poles.push({ p: [128, 0, -146], lamp: true, yaw: Math.PI, major: true });
  W.props.poles.push({ p: [146, 0, -132], lamp: true, yaw: 0 });

  // signal cabin, two floors, east of platform 1
  const C = new Frame(W, 194, -153, Math.PI);
  W.currentBuilding = { name: 'cabin', F: C, w: 6, d: 6.5, floors: 2, tpl: 'cabin' };
  W.buildings.push(W.currentBuilding);
  shell(C, 6, 6.5, 2, {
    color: rgb(0xe0c090),
    front: [[{ c: -1.5, w: 1.0, h: 2.15, sill: 0 }], [{ c: -1.4, w: 1.6, h: 1.2, sill: 1.0 }, { c: 1.4, w: 1.6, h: 1.2, sill: 1.0 }]],
    back: [[], [{ c: 0, w: 4.4, h: 1.2, sill: 1.0 }]],
    left: [[], [{ c: 2.5, w: 3, h: 1.2, sill: 1.0 }]], right: [[], [{ c: 2.5, w: 2, h: 1.2, sill: 1.0 }]],
    holes: { 1: [1.6, 1.5, 2.8, 4.7] },
  });
  door(C, 'x', WT / 2, -1.5, 0, { label: 'सिग्नल केबिन', locked: true, kick: false, metal: true, hp: 99999 });
  W.special.cabinDoor = W.doors[W.doors.length - 1];
  stairs(C, 2.2, 1.6, 0, 1, 1.0);
  C.box('plain', -0.8, FH + 0.55, 5.95, 3.4, 1.1, 0.5, rgb(0x3a4a5a)); // lever frame / panel
  for (let i = 0; i < 10; i++) C.box('plain', -2.2 + i * 0.32, FH + 1.3, 5.85, 0.06, 0.5, 0.06, i % 3 ? RED : rgb(0x2050c0), { collide: false });
  W.special.signalPanel = C.world(-0.8, FH + 1.15, 5.5);
  C.wallQuad('sign', 0, 2.75, -0.04, 3.2, 0.6, Math.PI, W.signs.board('केबिन', 'SIGNAL CABIN · GGD', '#f2c81e', '#111', 384, 96));
  Furn.table(C, -1.2, 2.2, 0, true);
  W.enemySpots.push(C.world(-1, FH, 2));
  W.currentBuilding = null;
  W.reserve(194, -156.25, 4, 4);
  // signal post with red light
  B.box('metal', 188, 3, -167, 0.18, 6, 0.18, [0.2, 0.2, 0.2]);
  W.special.signalLamp = [188, 5.6, -166.8];
  W.special.trainStop = { x0: 100, x1: 182, z: RAIL.loopZ };
}

// ================= LEVEL CROSSING =================
function crossing(W) {
  const B = W.B;
  W.props.barriers.push({ p: [-6.5, 0, -163], yaw: 0 }, { p: [6.5, 0, -189], yaw: Math.PI });
  const hut = new Frame(W, 10.5, -166, -Math.PI / 2);
  B.box('plaster', 10.5, 1.3, -166, 2.4, 2.6, 2.4, rgb(0xe8c89a));
  B.box('concrete', 10.5, 2.65, -166, 2.8, 0.15, 2.8, [0.6, 0.6, 0.6], { collide: false });
  hut.wallQuad('sign', 0, 1.9, 1.24, 2.0, 0.5, Math.PI, W.signs.board('रेलवे फाटक', 'LEVEL CROSSING', '#f2c81e', '#111', 384, 96));
  const warn = W.signs.board('रुको · देखो · फिर जाओ', 'STOP · LOOK · GO', '#ffffff', '#c00', 448, 112);
  const sF = new Frame(W, -8, -158, 0);
  B.box('metal', -8, 1.4, -158, 0.1, 2.8, 0.1, DARK, { collide: false });
  sF.wallQuad('sign', 0, 2.6, -0.04, 1.8, 0.45, Math.PI, warn);
  sF.wallQuad('sign', 0, 2.6, 0.04, 1.8, 0.45, 0, warn);
  W.props.poles.push({ p: [9, 0, -158], lamp: true, yaw: -Math.PI / 2, major: true });
  W.lights.push({ x: 10.5, y: 2.4, z: -164.6, color: 0xffe0a0, intensity: 2, dist: 6, flicker: 1 });
}

// ================= NAUGAZI TRIJUNCTION =================
function naugazi(W) {
  const [nx, nz] = NAUGAZI;
  const B = W.B;
  const cx = nx, cz = nz + 7.5;
  B.cylinder('concrete', cx, 0, cz, 3.0, 0.55, [0.8, 0.76, 0.7], 16, { collide: true });
  B.cylinder('plain', cx, 0.55, cz, 3.05, 0.06, SAFFRON, 16);
  W.props.trees.push({ p: [cx, 0.55, cz], s: 2.1, type: 'peepal' });
  W.reserve(cx, cz, 3.5, 3.5);
  // signpost
  const pF = new Frame(W, cx + 2.2, cz - 3.6, 0);
  B.box('metal', cx + 2.2, 2.2, cz - 3.6, 0.12, 4.4, 0.12, DARK, { collide: false });
  const nb = W.signs.board('नौगजी तिराहा', 'NAUGAZI TIRAHA', '#1d6b3a', '#fff', 512, 128);
  pF.wallQuad('sign', 0, 3.7, -0.05, 2.6, 0.65, Math.PI, nb);
  pF.wallQuad('sign', 0, 3.7, 0.05, 2.6, 0.65, 0, nb);
  const dir = W.signs.road([['↑ रेलवे स्टेशन', '2 km'], ['↖ वहाबगंज', '1 km'], ['↙ सलोन', '28 km'], ['↘ अमेठी', '31 km']]);
  pF.wallQuad('sign', 0, 2.5, -0.05, 1.8, 0.9, Math.PI, dir);
  // high-mast light: the brightest thing in town, easy to navigate toward
  B.box('metal', cx - 4.5, 7, cz + 1.5, 0.35, 14, 0.35, [0.55, 0.57, 0.6]);
  W.special.highMast = [cx - 4.5, 13.8, cz + 1.5];
  W.lights.push({ x: cx - 4.5, y: 13, z: cz + 1.5, color: 0xffd9a0, intensity: 30, dist: 45, major: true, mast: true });
  // speed breakers on all three approaches
  for (const [x, z, yaw] of [[0, 75, 0], [-12, 99.5, -0.9], [12, 96.5, 1.0]]) {
    for (let i = 0; i < 6; i++) {
      const F = new Frame(W, x, z, yaw);
      F.box('plain', -3.75 + i * 1.5, 0.06, 0, 1.5, 0.1, 0.6, i % 2 ? [0.9, 0.75, 0.1] : [0.12, 0.12, 0.12], { collide: false });
    }
  }
  // cows resting near the junction
  W.props.cows.push({ p: [8, 0, 104], yaw: 0.7 }, { p: [-7, 0, 82], yaw: 2.1 });
  W.props.carts.push({ p: [-9, 0, 96], yaw: -0.9 }, { p: [9.5, 0, 92], yaw: 1.1 });
}

// ================= BUS ADDA =================
function busAdda(W) {
  const road = ROADS.SE;
  const F0 = frameOnRoad(road, 88, 1, 0.9);
  const F = new Frame(W, F0.x, F0.z, F0.yaw);
  const w = 46, d = 30;
  const [cx, cz] = F.p(0, d / 2);
  W.reserve(cx, cz, w / 2 + 0.5, d / 2 + 0.5, F.yaw);
  F.floorQuad('concrete', -w / 2, 0, w / 2, d, 0.03, [0.72, 0.7, 0.66], 3);
  // entrance arch
  for (const sx of [-5, 5]) F.box('plaster', sx, 2.6, 0.5, 0.7, 5.2, 0.7, rgb(0xe8d8b8));
  F.box('plaster', 0, 5.0, 0.5, 10.7, 0.8, 0.7, rgb(0xe8d8b8), { collide: false });
  const s = W.signs.board('बस स्टेशन जायस', 'BUS STATION JAIS', '#0d47a1', '#fff', 640, 128);
  F.wallQuad('sign', 0, 5.0, 0.13, 8.2, 0.75, Math.PI, s);
  F.wallQuad('sign', 0, 5.0, 0.87, 8.2, 0.75, 0, s);
  // boundary walls on the sides and back
  wallZ(F, -w / 2, 0.5, d, 0, 1.6, WHITE, [], 'plaster', 0.25);
  wallZ(F, w / 2, 0.5, d, 0, 1.6, WHITE, [{ c: 20, w: 4, h: 3, sill: 0 }], 'plaster', 0.25);
  wallX(F, d, -w / 2, w / 2, 0, 1.6, WHITE, [{ c: -8, w: 3, h: 3, sill: 0 }], 'plaster', 0.25);
  // waiting shed with benches
  for (let i = 0; i < 5; i++) F.box('metal', -16 + i * 4.5, 1.6, 24.5, 0.18, 3.2, 0.18, DARK);
  for (let i = 0; i < 5; i++) F.box('metal', -16 + i * 4.5, 1.6, 27.8, 0.18, 3.2, 0.18, DARK);
  F.box('metal', -7, 3.25, 26.2, 19, 0.08, 4.4, rgb(0x5a7080), { collide: false });
  for (let i = 0; i < 4; i++) Furn.bench(F, -14 + i * 4.5, 26.5, 0, 2.6);
  F.wallQuad('sign', -7, 2.8, 24.3, 3.6, 0.6, Math.PI, W.signs.board('यात्री प्रतीक्षालय', 'WAITING HALL', '#00695c', '#fff', 384, 96));
  // enquiry office (enterable)
  const [ox, oz] = F.p(14, 17);
  const O = new Frame(W, ox, oz, F.yaw);
  W.currentBuilding = { name: 'busOffice', F: O, w: 7, d: 6.5, floors: 1, tpl: 'chowki' };
  W.buildings.push(W.currentBuilding);
  shell(O, 7, 6.5, 1, { color: rgb(0xe0e8f0), front: [[{ c: -1.5, w: 1.0, h: 2.15, sill: 0 }, { c: 1.6, w: 1.6, h: 1.0, sill: 1.0, grille: true }]], back: [[{ c: 0, w: 1, h: 1.2, sill: 1, grille: true }]] });
  door(O, 'x', WT / 2, -1.5, 0, { label: 'पूछताछ' });
  O.wallQuad('sign', 0, 2.85, -0.04, 5.0, 0.6, Math.PI, W.signs.board('पूछताछ / टिकट', 'ENQUIRY / TICKETS', '#0d47a1', '#fff', 448, 96));
  Furn.table(O, 1.4, 2.6, 0, true);
  Furn.almirah(O, -3.1, 4.8, 0, Math.PI / 2);
  Furn.shelves(O, 1.0, 5.9, 2.4, 0, Math.PI, false);
  W.keySpots.push({ b: W.currentBuilding, p: O.world(1.4, 0.8, 2.6), label: 'बस अड्डा पूछताछ कार्यालय' });
  W.enemySpots.push(O.world(0, 0, 3.5));
  W.currentBuilding = null;
  // buses parked at angles; one abandoned across the yard
  const r = W.rng;
  for (const [bx, bz, yaw] of [[-15, 12, 0.35], [-6, 12, 0.35], [3, 12.5, 0.3], [-10, 4.5, 1.9]]) {
    const [px, pz] = F.p(bx, bz);
    W.props.buses.push({ p: [px, 0, pz], yaw: F.yaw + yaw, color: r.pick([0xd8d8d0, 0x2a6ab0, 0xc84030]) });
  }
  // tea stall + carts inside
  for (const [sx, sz, yaw] of [[18, 4, 0.2], [-20, 20, 1.4]]) { const [px, pz] = F.p(sx, sz); W.props.carts.push({ p: [px, 0, pz], yaw: F.yaw + yaw }); }
  for (const [lx, lz] of [[-12, 8], [8, 22]]) { const p = F.world(lx, 0, lz); W.props.poles.push({ p, lamp: true, yaw: F.yaw, major: true }); }
  W.props.trees.push({ p: F.world(-20, 0, 6), s: 1.4 }, { p: F.world(20, 0, 28), s: 1.2 });
  W.lootSpots.push({ p: F.world(-7, 0.5, 26.5), kind: 'any', w: 2 }, { p: F.world(5, 0.05, 20), kind: 'ammo', w: 2 });
  W.special.busAdda = F;
}

// two overhead flex banners strung across streets (user banners 4 and 5)
function overheadBanners(W) {
  W.banners.push({ p: [-86, 5.2, 0], yaw: Math.PI / 2, w: 4.2, h: 1.4, idx: 4, ropes: [[-86, 5.6, -4.6], [-86, 5.6, 4.6]] });
  W.banners.push({ p: [-108, 4.6, 40], yaw: Math.PI / 2, w: 3.6, h: 1.2, idx: 5, ropes: [[-108, 5, 37.6], [-108, 5, 42.4]] });
}
