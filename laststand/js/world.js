// Builds the static town: ground, roads, every building and landmark.
import { Physics } from './physics.js';
import { Builder } from './builder.js';
import { SignAtlas, FACADE } from './textures.js';
import { makeRng, rgb } from './util.js';
import { ROADS, BOUNDS, roadInfo, frameOnRoad, KAMAKHYA } from './layout.js';
import { Frame, Templates, FH } from './interiors.js';
import { buildLandmarks } from './landmarks.js';

const OUTER = [0xf1e3c6, 0xe8d0c0, 0xd8dccb, 0xf3eedd, 0xe6c79a, 0xc9d3dc, 0xe2b8a8, 0xd8c8e0, 0xc8e0d0, 0xf0c8c8, 0xe0e0e0, 0xb8c8e8].map(rgb);

const SHOPS = [
  ['गुप्ता जनरल स्टोर', 'GUPTA GENERAL STORE', '#c8102e'],
  ['अंसारी टेलर्स', 'ANSARI TAILORS', '#1d4e9e'],
  ['जायस मोबाइल सेंटर', 'JAIS MOBILE CENTRE', '#0a7a3a'],
  ['यादव स्वीट हाउस', 'YADAV SWEET HOUSE', '#e07a10'],
  ['राजा फुटवियर', 'RAJA FOOTWEAR', '#6a1b9a'],
  ['मौर्या हार्डवेयर', 'MAURYA HARDWARE', '#b71c1c'],
  ['खान बिरयानी सेंटर', 'KHAN BIRYANI CENTRE', '#2e7d32'],
  ['पाल किराना स्टोर', 'PAL KIRANA STORE', '#f9a825'],
  ['सिंह साइकिल वर्क्स', 'SINGH CYCLE WORKS', '#37474f'],
  ['वर्मा ज्वैलर्स', 'VERMA JEWELLERS', '#8d1c1c'],
  ['फ़ातिमा लेडीज़ कॉर्नर', 'FATIMA LADIES CORNER', '#ad1457'],
  ['जन सेवा केंद्र', 'JAN SEVA KENDRA', '#00695c'],
  ['पांडेय कोचिंग सेंटर', 'PANDEY COACHING CENTRE', '#283593'],
  ['अली बुक डिपो', 'ALI BOOK DEPOT', '#4e342e'],
  ['दुबे फर्नीचर', 'DUBEY FURNITURE', '#5d4037'],
  ['मिश्रा फोटो स्टूडियो', 'MISHRA PHOTO STUDIO', '#212121'],
  ['कमल ऑटो पार्ट्स', 'KAMAL AUTO PARTS', '#c62828'],
  ['नेहा ब्यूटी पार्लर', 'NEHA BEAUTY PARLOUR', '#d81b60'],
  ['श्री राम वस्त्रालय', 'SHRI RAM VASTRALAY', '#ef6c00'],
  ['न्यू इंडिया बेकरी', 'NEW INDIA BAKERY', '#795548'],
  ['रहमान फल भंडार', 'RAHMAN FRUIT BHANDAR', '#558b2f'],
  ['तिवारी पान भंडार', 'TIWARI PAAN BHANDAR', '#1b5e20'],
  ['सोनी इलेक्ट्रॉनिक्स', 'SONI ELECTRONICS', '#0d47a1'],
  ['अवध डेयरी', 'AWADH DAIRY', '#0277bd'],
  ['बाबा ढाबा', 'BABA DHABA', '#bf360c'],
  ['मॉडर्न सैलून', 'MODERN SALOON', '#4527a0'],
];

// ---------- rectangle overlap (SAT) ----------
function axes(r) { const c = Math.cos(r.yaw), s = Math.sin(r.yaw); return [[c, -s], [s, c]]; }
export function rectsOverlap(a, b) {
  const A = axes(a), Bx = axes(b);
  const dx = b.x - a.x, dz = b.z - a.z;
  for (const ax of [...A, ...Bx]) {
    const ra = a.hx * Math.abs(A[0][0] * ax[0] + A[0][1] * ax[1]) + a.hz * Math.abs(A[1][0] * ax[0] + A[1][1] * ax[1]);
    const rb = b.hx * Math.abs(Bx[0][0] * ax[0] + Bx[0][1] * ax[1]) + b.hz * Math.abs(Bx[1][0] * ax[0] + Bx[1][1] * ax[1]);
    if (Math.abs(dx * ax[0] + dz * ax[1]) > ra + rb) return false;
  }
  return true;
}

export function createWorldContext() {
  const P = new Physics(BOUNDS.minX - 1010, BOUNDS.minZ - 150, BOUNDS.maxX + 10, BOUNDS.maxZ + 10); // west part: hidden valley
  const B = new Builder(P, 60);
  const W = {
    B, P, signs: new SignAtlas(2048), rng: makeRng(20240611),
    doors: [], containers: [], lootSpots: [], enemySpots: [], frameSlots: [], radioSlots: [], lights: [], fans: [],
    pumps: [], buildings: [], rects: [], banners: [], interact: [], keySpots: [], fuseSpots: [], special: {},
    props: { poles: [], trees: [], bikes: [], cars: [], autos: [], tanks: [], dishes: [], buses: [], carts: [], cows: [], wires: [], sleepers: [], masts: [], fences: [], barriers: [] },
    deferred: [], fairy: [], sanctuary: [],
    currentBuilding: null, shopBoards: [],
  };
  W.reserve = (x, z, hx, hz, yaw = 0) => W.rects.push({ x, z, hx, hz, yaw });
  W.free = (r) => !W.rects.some((q) => rectsOverlap(r, q));
  return W;
}

// ---------- facade (non-enterable) building ----------
const cellUV = (i) => {
  const col = i % 4, row = Math.floor(i / 4), m = 0.003;
  return [col / 4 + m, 1 - (row + 1) / 4 + m, (col + 1) / 4 - m, 1 - row / 4 - m];
};

function faceBays(W, F, face, w, d, floors, pick, tint) {
  // face: 'front' (z=0), 'back' (z=d), 'left' (x=-w/2), 'right' (x=w/2)
  const L = face === 'front' || face === 'back' ? w : d;
  const nb = Math.max(1, Math.round(L / 3.1));
  const bw = L / nb;
  for (let f = 0; f < floors; f++) for (let b = 0; b < nb; b++) {
    const cell = pick(f, b, nb);
    const [u0, v0, u1, v1] = cellUV(cell);
    const y0 = f * FH, y1 = y0 + FH;
    let pA, pB, n; // pA = texture left edge, pB = right edge (at y0)
    const a0 = b * bw, a1 = (b + 1) * bw;
    if (face === 'front') { pA = [w / 2 - a0, 0]; pB = [w / 2 - a1, 0]; n = [0, -1]; }
    else if (face === 'back') { pA = [-w / 2 + a0, d]; pB = [-w / 2 + a1, d]; n = [0, 1]; }
    else if (face === 'left') { pA = [-w / 2, a0]; pB = [-w / 2, a1]; n = [-1, 0]; }
    else { pA = [w / 2, d - a0]; pB = [w / 2, d - a1]; n = [1, 0]; }
    const A0 = F.world(pA[0], y0, pA[1]), B0 = F.world(pB[0], y0, pB[1]);
    const A1 = [A0[0], y1 + F.y0, A0[2]], B1 = [B0[0], y1 + F.y0, B0[2]];
    const wn = [n[0] * F.c + n[1] * F.s, 0, -n[0] * F.s + n[1] * F.c];
    const shadeK = face === 'front' ? 1 : 0.88;
    const col = [tint[0] * shadeK, tint[1] * shadeK, tint[2] * shadeK];
    // slight darkening at street level (dust)
    const colLow = f === 0 ? col.map((v) => v * 0.9) : col;
    W.B.quad('facade', A0, B0, B1, A1, wn, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], [colLow, colLow, col, col], [F.x, F.z]);
  }
}

export function facadeBuilding(W, F, w, d, floors, o = {}) {
  const r = W.rng;
  const tint = o.tint || r.pick(OUTER);
  const H = floors * FH;
  // solid collider + roof
  F.box('concrete', 0, H - 0.1, d / 2, w, 0.2, d, [0.62, 0.6, 0.57], { collide: false, skip: ['bottom'] , uv: 3});
  const [cx, cz] = F.p(0, d / 2);
  W.P.add(cx, H / 2, cz, w / 2, H / 2, d / 2, F.yaw);
  const shops = !!o.shops;
  const brickSides = r.chance(0.4);
  const litChance = o.lit ?? 0.14;
  faceBays(W, F, 'front', w, d, floors, (f, b, nb) => {
    if (f === 0) {
      if (shops) return r.chance(0.18) ? FACADE.SHOP_LIT : r.chance(0.5) ? FACADE.SHUTTER : r.chance(0.6) ? FACADE.SHUTTER_HALF : FACADE.SHUTTER;
      if (b === Math.floor(nb / 2)) return r.chance(0.3) ? FACADE.GATE : FACADE.DOOR;
      return r.pick([FACADE.WIN_SHUT, FACADE.WIN_GRILLE, FACADE.PLAIN, FACADE.POSTERS, FACADE.WIN_SHUT]);
    }
    if (r.chance(litChance)) return FACADE.WIN_LIT;
    return r.pick([FACADE.WIN_SHUT, FACADE.WIN_GRILLE, FACADE.BALC_DOOR, FACADE.PLAIN, FACADE.WIN_GRILLE, FACADE.VENT]);
  }, tint);
  for (const side of ['left', 'right']) {
    faceBays(W, F, side, w, d, floors, (f) => {
      if (brickSides) return r.chance(0.2) ? FACADE.BRICK_WIN : FACADE.BRICK;
      if (f === 0 && r.chance(0.25)) return FACADE.PAINTED_AD;
      return r.pick([FACADE.PLAIN, FACADE.PLAIN2, FACADE.POSTERS, FACADE.WIN_GRILLE, FACADE.VENT]);
    }, tint);
  }
  faceBays(W, F, 'back', w, d, floors, () => r.pick([FACADE.PLAIN, FACADE.WIN_GRILLE, FACADE.BRICK, FACADE.PLAIN2, FACADE.VENT]), tint);
  // parapet
  const ph = 0.8 + r() * 0.4, pt = 0.15;
  const pc = tint.map((v) => v * 0.95);
  F.box('plaster', 0, H + ph / 2, pt / 2, w, ph, pt, pc, { collide: false });
  F.box('plaster', 0, H + ph / 2, d - pt / 2, w, ph, pt, pc, { collide: false });
  F.box('plaster', -w / 2 + pt / 2, H + ph / 2, d / 2, pt, ph, d, pc, { collide: false });
  F.box('plaster', w / 2 - pt / 2, H + ph / 2, d / 2, pt, ph, d, pc, { collide: false });
  // floor bands / chhajja lines on the front
  for (let f = 1; f < floors; f++) F.box('concrete', 0, f * FH - 0.05, -0.18, w, 0.12, 0.36, [0.8, 0.78, 0.74], { collide: false });
  // balcony on first floor
  if (floors >= 2 && r.chance(0.45)) {
    const bw = Math.min(w - 0.6, 2.5 + r() * 3);
    F.box('concrete', 0, FH - 0.08, -0.55, bw, 0.16, 1.1, [0.82, 0.8, 0.76], { collide: false });
    F.box('metal', 0, FH + 0.45, -1.08, bw, 0.9, 0.04, [0.18, 0.2, 0.22], { collide: false });
    if (r.chance(0.5)) F.box('fabric', 0, FH + 0.75, -1.1, bw * 0.8, 0.5, 0.02, rgb(r.pick([0xd04040, 0x3050a0, 0xe0c040, 0x40a060])), { collide: false });
  }
  // rooftop: water tanks, dish, mumty
  if (r.chance(0.65)) W.props.tanks.push({ p: F.world(-w / 4 + r() * w / 2, H, d * (0.3 + r() * 0.5)), s: 0.7 + r() * 0.5 });
  if (r.chance(0.4)) W.props.dishes.push({ p: F.world(w / 2 - 0.6, H + 0.4, 0.8), yaw: F.yaw + Math.PI + (r() - 0.5) });
  if (floors >= 2 && r.chance(0.35)) {
    const mw = 2.6, md = 3;
    F.box('plaster', -w / 2 + mw / 2 + 0.3, H + 1.25, d - md / 2 - 0.3, mw, 2.5, md, tint.map((v) => v * 0.9), { collide: false });
  }
  if (r.chance(0.2) && floors >= 2) { // rebar sticking up: unfinished next floor, very common
    for (let i = 0; i < 4; i++) F.box('plain', -w / 2 + 0.3 + i * (w - 0.6) / 3, H + 1.0, d - 0.3, 0.05, 2.0, 0.05, [0.3, 0.2, 0.15], { collide: false });
  }
  // shop front details
  if (shops) {
    F.box('concrete', 0, 0.12, -0.6, w, 0.24, 1.2, [0.7, 0.68, 0.64], { uv: 2 });
    const sign = o.sign || (W.shopBoards.length ? r.pick(W.shopBoards) : null);
    if (sign) F.wallQuad('sign', 0, 2.75, -0.05, Math.min(w - 0.3, 5.5), Math.min(1.2, (w - 0.3) / 4.2), Math.PI, sign);
    if (r.chance(0.55)) awning(W, F, w, r);
    if (r.chance(0.5)) W.props.bikes.push({ p: F.world(-w / 4 + r() * w / 2, 0, -2.0 - r() * 0.6), yaw: F.yaw + Math.PI / 2 + (r() - 0.5) * 0.6 });
    if (o.lightShop !== false && r.chance(0.25)) {
      const [lx, ly, lz] = F.world(0, 2.6, -1.0);
      W.lights.push({ x: lx, y: ly, z: lz, color: 0xffe0b0, intensity: 3, dist: 9, flicker: r.chance(0.3) ? 1 : 0 });
      F.box('glow', 0, 2.45, -0.12, 0.9, 0.05, 0.05, [1, 1, 0.95], { collide: false });
    }
  }
  W.buildings.push({ F, w, d, floors, solid: true });
  return tint;
}

function awning(W, F, w, r) {
  const col = rgb(r.pick([0x2a5fa8, 0x2f8a4a, 0xc0392b, 0xe6a817, 0x5a6a7a]));
  const y0 = 2.45, y1 = 2.1, out = 1.3 + r() * 0.5;
  const a = F.world(-w / 2 + 0.2, y0, -0.05), b = F.world(w / 2 - 0.2, y0, -0.05);
  const c = F.world(w / 2 - 0.2, y1, -out), d = F.world(-w / 2 + 0.2, y1, -out);
  const n = [-F.s * 0.9, 0.45, -F.c * 0.9];
  W.B.quad('fabric', a, b, c, d, [n[0], 0.9, n[2]], [[0, 0], [w / 2, 0], [w / 2, 1], [0, 1]], col, [F.x, F.z]);
  // bamboo props
  for (const sx of [-w / 2 + 0.3, w / 2 - 0.3]) F.box('wood', sx, y1 / 2, -out + 0.05, 0.06, y1, 0.06, [0.7, 0.6, 0.4], { collide: false });
}

// ---------- roads ----------
function buildRoads(W) {
  const B = W.B;
  let k = 0;
  for (const [name, r] of Object.entries(ROADS)) {
    const i = roadInfo(r);
    const y = 0.02 + (k++) * 0.002 + (r.s === 'lane' ? 0 : 0.01);
    const mat = r.s === 'lane' ? 'khadanja' : 'asphalt';
    const ext = r.s === 'lane' ? 0 : 1.5;
    B.ground(mat, i.cx, i.cz, r.w, i.len + ext, i.yaw, y, [1, 1, 1], r.s === 'lane' ? 3 : 6);
    W.reserve(i.cx, i.cz, r.w / 2 + 0.7, i.len / 2 + 1, i.yaw);
    if (r.s !== 'lane') {
      // open drains (naali) with concrete edges on both sides
      for (const sd of [1, -1]) {
        const ox = i.nx * sd * (r.w / 2 + 0.35), oz = i.nz * sd * (r.w / 2 + 0.35);
        B.ground('plain', i.cx + ox, i.cz + oz, 0.5, i.len, i.yaw, 0.012 + k * 0.001, [0.08, 0.08, 0.07]);
        const ex = i.nx * sd * (r.w / 2 + 0.66), ez = i.nz * sd * (r.w / 2 + 0.66);
        B.ground('concrete', i.cx + ex, i.cz + ez, 0.14, i.len, i.yaw, 0.08, [0.75, 0.73, 0.7], 2);
      }
      // faded centre line dashes on the main road
      if (name === 'MAIN' || name === 'STN') {
        for (let t = 4; t < i.len - 4; t += 9) {
          B.ground('plain', r.a[0] + i.ux * t, r.a[1] + i.uz * t, 0.14, 3, i.yaw, y + 0.004, [0.62, 0.6, 0.55]);
        }
      }
    }
  }
}

// ---------- signboards for shop pool ----------
function makeShopBoards(W) {
  for (const s of SHOPS) W.shopBoards.push(W.signs.board(s[0], s[1], s[2], '#fff', 384, 96));
}

// ---------- enterable buildings ----------
function enterable(W, tpl, F, spec) {
  W.currentBuilding = { name: spec.name || tpl, F, w: spec.w, d: spec.d, floors: spec.floors || 1, tpl };
  W.buildings.push(W.currentBuilding);
  Templates[tpl](F, spec);
  const [cx, cz] = F.p(0, spec.d / 2);
  W.reserve(cx, cz, spec.w / 2 + 0.3, spec.d / 2 + 0.3, F.yaw);
  // a little space in front so lots don't block the door
  const [fx, fz] = F.p(0, -1.5);
  W.reserve(fx, fz, spec.w / 2, 1.4, F.yaw);
  const b = W.currentBuilding;
  W.currentBuilding = null;
  return b;
}

function placeEnterables(W) {
  const S = W.signs;
  const sign = (hi, en, c) => S.board(hi, en, c, '#fff', 384, 96);
  const R = ROADS;
  const list = [];
  const add = (tpl, road, t, side, spec) => {
    const F0 = frameOnRoad(road, t, side, spec.setback ?? 0.9);
    const F = new Frame(W, F0.x, F0.z, F0.yaw);
    const b = enterable(W, tpl, F, spec);
    list.push(b);
    return b;
  };
  // START: small house on lane L1 in Wahabganj
  const start = add('small', R.L1, 24, -1, { name: 'start', w: 7.4, d: 9, photos: [1, 2], powered: true, radio: true });
  W.special.start = start;
  add('shopHouse', R.WAHAB, 68, -1, { name: 'gupta', w: 6.4, d: 11, floors: 2, photos: [3], radio: true, sign: sign('गुप्ता जनरल स्टोर', 'GUPTA GENERAL STORE', '#c8102e'), powered: true });
  const elec = add('shop', R.WAHAB, 112, 1, { name: 'bijli', w: 5, d: 8.5, sign: sign('न्यू बिजली घर इलेक्ट्रिकल्स', 'NEW BIJLI GHAR ELECTRICALS', '#0d47a1'), food: false });
  W.fuseSpots.push({ b: elec, p: elec.F.world(-0.4, 1.06, 2.0), label: 'वहाबगंज इलेक्ट्रिकल्स' });
  add('shop', R.WAHAB, 30, -1, { name: 'medical', w: 5, d: 8.5, sign: sign('शर्मा मेडिकल स्टोर', 'SHARMA MEDICAL STORE', '#2e7d32'), powered: true });
  add('courtyard', R.L2, 22, 1, { name: 'haveli', w: 14, d: 14, photos: [4, 5], radio: true });
  add('narrow', R.L1, 44, 1, { name: 'narrow1', w: 4.4, d: 13, floors: 2, photos: [6] });
  add('small', R.L3, 62, 1, { name: 'abandoned1', w: 7.4, d: 9, abandoned: true });
  add('small', R.L3, 128, -1, { name: 'abandoned2', w: 7.4, d: 9, abandoned: true, locked: true });
  // Three-floor house south of the well street, facing the well
  const three = add('three', R.WELLST, 30, 1, { name: 'three', w: 12, d: 12, floors: 3, photos: [7, 8, 9], radio: true, powered: true, setback: 0.9,
    sign: S.board('निवास', 'NIWAS', '#5d4037', '#fff', 256, 64) });
  W.fuseSpots.push({ b: three, p: three.F.world(2, 3 * FH + 0.05, 9), label: 'तीन मंज़िला मकान की छत' });
  const alia = add('shop', R.ALIA, 8, 1, { name: 'aliaShop', w: 5, d: 8.5, sign: sign('आलिया जनरल मर्चेंट', 'ALIA GENERAL MERCHANT', '#ad1457') });
  W.fuseSpots.push({ b: alia, p: alia.F.world(-0.4, 1.06, 2.0), label: 'आलिया मार्केट की दुकान' });
  add('shop', R.ALIA, 52, 1, { name: 'aliaShop2', w: 5, d: 8.5, sign: sign('आलिया टेलर्स', 'ALIA TAILORS', '#4527a0') });
  // east side
  add('school', R.E3, 34, 1, { name: 'school', w: 22, d: 10, photos: [11], sign: sign('प्राथमिक विद्यालय जायस', 'PRIMARY SCHOOL JAIS', '#1b5e20') });
  add('small', R.E1, 30, 1, { name: 'eastHouse', w: 7.4, d: 9, photos: [10], radio: true, powered: true });
  add('shopHouse', R.MAIN, 150, 1, { name: 'mainShop', w: 6.4, d: 11, floors: 2, photos: [12], sign: sign('सोनी इलेक्ट्रॉनिक्स', 'SONI ELECTRONICS', '#0d47a1'), food: false });
  add('narrow', R.SW, 34, 1, { name: 'narrow2', w: 4.4, d: 13, floors: 2, photos: [13], radio: true });
  add('small', R.E2, 40, -1, { name: 'e2house', w: 7.4, d: 9, photos: [14], locked: true });
  add('small', R.STN, 44, -1, { name: 'stnHouse', w: 7.4, d: 9, photos: [15] });
  const chowki = add('chowki', R.MAIN, 266, 1, { name: 'chowki', w: 7, d: 6.5, sign: S.board('पुलिस सहायता केंद्र', 'POLICE HELP CENTRE · NAUGAZI', '#0d2a6a', '#fff', 512, 96), powered: true });
  W.keySpots.push({ b: chowki, p: chowki.F.world(-1.8, 0.8, 2.6), label: 'नौगजी पुलिस चौकी' });
  add('dhaba', R.SE, 30, -1, { name: 'dhaba', w: 9, d: 8, sign: sign('बाबा ढाबा · चाय नाश्ता', 'BABA DHABA', '#bf360c'), radio: true, powered: true });
  W.enterables = list;
  // flex banners 1-3 on house fronts (user banners)
  const front = (b, y, z, w, h, idx) => W.banners.push({ p: b.F.world(0, y, z), yaw: b.F.yaw + Math.PI, w, h, idx });
  front(start, 3.0, -0.07, 3.0, 1.0, 1);
  front(list.find((b) => b.name === 'gupta'), FH + 0.75, -1.2, 3.6, 1.2, 2);
  front(list.find((b) => b.name === 'eastHouse'), 3.0, -0.07, 3.0, 1.0, 3);
}

// ---------- fill streets with facade buildings ----------
function fillLots(W) {
  const r = W.rng;
  for (const [name, road] of Object.entries(ROADS)) {
    const i = roadInfo(road);
    const lane = road.s === 'lane';
    const bazaar = name === 'WAHAB' || name === 'MAIN' || name === 'ALIA' || name === 'SE' || name === 'SW';
    for (const side of [1, -1]) {
      let t = 1;
      while (t < i.len - 3) {
        const w = lane ? r.range(4.2, 8) : r.range(4.5, 9.5);
        const d = r.range(8, 13);
        const floors = r.chance(0.28) ? 1 : r.chance(0.65) ? 2 : 3;
        const setback = (lane ? 0.3 : 0.95) + r() * (lane ? 0.5 : 0.9);
        const F0 = frameOnRoad(road, t + w / 2, side, setback);
        const F = new Frame(W, F0.x, F0.z, F0.yaw);
        const [cx, cz] = F.p(0, d / 2);
        const rect = { x: cx, z: cz, hx: w / 2 - 0.05, hz: d / 2 - 0.05, yaw: F.yaw };
        const inside = cx - w > BOUNDS.minX + 25 && cx + w < BOUNDS.maxX - 25 && cz - w > BOUNDS.minZ + 30 && cz + w < BOUNDS.maxZ - 20;
        if (inside && W.free(rect)) {
          W.rects.push(rect);
          facadeBuilding(W, F, w, d, floors, { shops: bazaar && r.chance(0.8) || (lane && r.chance(0.15)) });
          t += w + (r.chance(0.12) ? r.range(1.6, 3.5) : r.range(0, 0.25));
        } else t += 1.2;
      }
    }
  }
}

// Dense blocks behind the street rows so the town reads as solid from roofs.
function backfill(W) {
  const r = W.rng;
  for (let x = -185; x < 190; x += 10.5) for (let z = -150; z < 168; z += 10.5) {
    const w = r.range(7, 10), d = r.range(7, 10);
    const px = x + r.range(-1.5, 1.5), pz = z + r.range(-1.5, 1.5);
    const yaw = r.chance(0.7) ? 0 : r.range(-0.15, 0.15);
    const rect = { x: px, z: pz, hx: w / 2 + 0.4, hz: d / 2 + 0.4, yaw };
    if (!W.free(rect)) continue;
    if (Math.hypot(px - KAMAKHYA.well.x, pz - KAMAKHYA.well.z) < 9) continue;
    W.rects.push(rect);
    const F = new Frame(W, px - Math.sin(yaw) * d / 2, pz - Math.cos(yaw) * d / 2, yaw);
    facadeBuilding(W, F, w, d, r.chance(0.3) ? 1 : r.chance(0.6) ? 2 : 3, { lit: 0.08 });
  }
}

function groundAndBounds(W) {
  const B = W.B;
  const sx = BOUNDS.maxX - BOUNDS.minX + 80, sz = BOUNDS.maxZ - BOUNDS.minZ + 80;
  const cx = (BOUNDS.maxX + BOUNDS.minX) / 2, cz = (BOUNDS.maxZ + BOUNDS.minZ) / 2;
  // ground in tiles so it gets culled in chunks
  const T = 60;
  for (let x = cx - sx / 2; x < cx + sx / 2; x += T) for (let z = cz - sz / 2; z < cz + sz / 2; z += T) {
    B.ground('dirt', x + T / 2, z + T / 2, T, T, 0, 0, [0.9, 0.9, 0.9], 5);
  }
  // invisible boundary walls
  const P = W.P;
  P.add(cx, 5, BOUNDS.minZ - 1, sx / 2, 10, 1);
  P.add(cx, 5, BOUNDS.maxZ + 1, sx / 2, 10, 1);
  P.add(BOUNDS.minX - 1, 5, cz, 1, 10, sz / 2);
  P.add(BOUNDS.maxX + 1, 5, cz, 1, 10, sz / 2);
  // boundary walls of fields/orchards along the edges (visual edge of town)
  const r = W.rng;
  for (let x = BOUNDS.minX + 4; x < BOUNDS.maxX - 4; x += r.range(5, 9)) {
    W.props.trees.push({ p: [x, 0, BOUNDS.maxZ - 3 - r() * 6], s: r.range(0.9, 1.5) });
    W.props.trees.push({ p: [x, 0, BOUNDS.minZ + 3 + r() * 6], s: r.range(0.9, 1.5) });
  }
  for (let z = BOUNDS.minZ + 4; z < BOUNDS.maxZ - 4; z += r.range(5, 9)) {
    W.props.trees.push({ p: [BOUNDS.minX + 3 + r() * 6, 0, z], s: r.range(0.9, 1.5) });
    W.props.trees.push({ p: [BOUNDS.maxX - 3 - r() * 6, 0, z], s: r.range(0.9, 1.5) });
  }
}

export function buildWorld(W) {
  makeShopBoards(W);
  groundAndBounds(W);
  buildRoads(W);
  buildLandmarks(W);
  placeEnterables(W);
  fillLots(W);
  backfill(W);
  return W;
}
