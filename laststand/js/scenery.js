// Look-only scenery from uploaded models: the town's houses (a pack of 13 houses, 13 farm buildings and an autumn house, all
// in the list HOMES below), four Indian shops (a department store twice, a pan kiosk, a bhelpuri cart; they used to fill
// every street, now there are just four, on four different roads), a marble gazebo and two odd houses, all standing where
// the town used to put plain box houses, and the Himalaya on the horizon. None of it can be entered: it is there to be looked at.
//
//   models/scenery/h*.glb         the house pack (low-poly, 2 storeys, garages and porches; colours baked per vertex)
//   models/scenery/fc*.glb fp*.glb  half-timbered farm houses  barn*.glb  farm barns
//   models/scenery/autumn.glb     a clapboard house with a blue roof and a garage (leaf piles on the roof)
//   models/scenery/shop2.glb      "Kirana King": a department-store front with its steps (photo-scanned front, plain beige
//                                 sides). The house of the streets: it is scaled to each lot's width
//   models/scenery/streetshop.glb a red tin pan-ki-dukaan kiosk on stilts, shutter down
//   models/scenery/bhelpuri.glb   the Kailash Bhelpuri Center handcart
//   models/scenery/gazebo.glb     a marble gazebo with four stairways, a rangoli and a golden dome (the back blocks)
//   models/scenery/provence.glb   a photo-scanned stone cottage from Provence (the scan is its front wall;
//                                 the game builds the stone body and the tiled roof behind it)
//   models/scenery/seahouse.glb   "the house lost at sea": a tall gothic house with a tower, on its own
//                                 grassy mound with a dead tree, its windows lit
//   models/scenery/himalaya.glb   Mount Everest and the peaks around it, ringed round the far horizon
//
// The houses draw through ModelHouses (houses.js), like the walk-in houses: one InstancedMesh per part,
// only the ones in view. Each is one solid block for collisions, so you walk round it, not into it.
import * as THREE from 'three';
import { loadGLB, lambertize } from './models.js';
import { BOUNDS } from './layout.js';
import { HOMES } from './homes.js';

// In each model's own frame: metres, front faces -z with its front edge on z = 0, centred on x.
//   foot [x0, z0, x1, z1]  the ground it covers   top  its height   solid [x0, z0, x1, z1]  the block you bump into
export const SCENIC = {
  // the new ones are built (scripts/scenery) with the front facing -z, standing on y = 0
  shop2: { file: 'models/scenery/shop2.glb', foot: [-4.3, 0, 4.3, 7.41], top: 6, solid: [-4.2, 0.9, 4.2, 7.3], tint: 1.25, glow: 0.12, vcol: true, lit: 0.3, litAt: [0, 2.6, -1.4] },
  streetshop: { file: 'models/scenery/streetshop.glb', foot: [-1.32, 0, 1.32, 4.55], top: 3.6, solid: [-1.25, 0.1, 1.25, 4.45], tint: 1.25, glow: 0.12, lit: 0.25, litAt: [0, 2.4, -1.0] },
  bhelpuri: { file: 'models/scenery/bhelpuri.glb', foot: [-1.14, 0, 1.14, 1.65], top: 2.6, solid: [-1.1, 0.05, 1.1, 1.6], tint: 1.2, glow: 0.14, lit: 0.5, litAt: [0, 2.2, -0.8] },
  gazebo: { file: 'models/scenery/gazebo.glb', foot: [-4.9, 0, 4.9, 9.79], top: 4.5, solid: [-4.7, 0.1, 4.7, 9.7], tint: 1.2, glow: 0.1 },
  provence: { file: 'models/scenery/provence.glb', foot: [-7.15, 0, 7.15, 9.9], top: 5.9, solid: [-7.0, 0.6, 7.0, 9.7] },
  // the sea house was made for unlit display (its walls' textures are lifted in the build); tint / glow lift it a
  // little more to match the town, and its grass, shrubs and lit windows are coloured per vertex (vcol)
  seahouse: { file: 'models/scenery/seahouse.glb', foot: [-6.2, 0, 6.2, 13.7], top: 11.8, solid: [-5.2, 1.0, 5.2, 12.6], tint: 1.4, glow: 0.1, vcol: true },
};
// the houses: built by scripts/scenery (the FBX packs' palette colours are per vertex; the autumn house has its own texture)
const HOME_KINDS = Object.keys(HOMES), BARNS = HOME_KINDS.filter((k) => k.startsWith('barn'));
for (const k of HOME_KINDS) {
  const f = HOMES[k].foot;
  SCENIC[k] = { file: 'models/scenery/' + k + '.glb', foot: f, top: HOMES[k].top, solid: [f[0] + 0.15, f[1] + 0.15, f[2] - 0.15, f[3] - 0.15], glow: 0.06, tint: k === 'autumn' ? 1 : 1.15, vcol: k !== 'autumn', lit: 0.2, litAt: [0, 2.4, -0.8] };
}
export const SCENIC_KINDS = Object.keys(SCENIC);
// The Indian street's shops are rare now: four in all, each on a road of its own (world.js plans where)
export const INDIAN_SHOPS = ['shop2', 'shop2', 'streetshop', 'bhelpuri'];
// at most this many of each in town (the Indian shops: just the four above; the sea house is the heavier one to draw)
const CAP = { shop2: 2, streetshop: 1, bhelpuri: 1, gazebo: 10, provence: 6, seahouse: 3 };
for (const k of HOME_KINDS) CAP[k] = BARNS.includes(k) ? 7 : k === 'autumn' ? 14 : 20;
// how often each is picked, by where it is going: a street row, the bazaar, or the blocks behind the streets (the Indian shops are
// never picked at random: they are placed by INDIAN_SHOPS)
const homeWeights = (barn, autumn) => Object.fromEntries(HOME_KINDS.map((k) => [k, BARNS.includes(k) ? barn : k === 'autumn' ? autumn : 1]));
const WEIGHT = {
  street: { ...homeWeights(0.12, 0.9), provence: 0.3, seahouse: 0.15 },
  bazaar: { ...homeWeights(0.06, 0.9) },
  block: { ...homeWeights(0.45, 0.9), gazebo: 0.6, provence: 0.3, seahouse: 0.15 },
};
// a shop is scaled to fit its lot; the houses and the rest stay close to their own size
const SCALE_RANGE = { shop2: [0.62, 1.22], streetshop: [1, 1.25], bhelpuri: [1, 1.25], gazebo: [0.9, 1.1], provence: [1, 1], seahouse: [1, 1] };
for (const k of HOME_KINDS) SCALE_RANGE[k] = [0.9, 1.12];

export function scenicSize(kind, s = 1) { const f = SCENIC[kind].foot; return { w: (f[2] - f[0]) * s, d: (f[3] - f[1]) * s }; }

// The scale for kind on a lot of width w (the lot's own width, or 0 for no preference).
export function scenicScale(kind, w, r) {
  const [lo, hi] = SCALE_RANGE[kind];
  if (kind === 'shop2' && w) return Math.min(hi, Math.max(lo, w / 7.6));
  return lo === hi ? lo : lo + r() * (hi - lo);
}

// Kinds still under their cap, in a random order (heavier weights first more often). where: 'street' | 'bazaar' | 'block'
export function pickScenic(W, r, where = 'street') {
  const n = W.scenicCount || {}, wt = WEIGHT[where];
  return Object.keys(wt).filter((k) => (n[k] || 0) < CAP[k]).map((k) => [k, -Math.log(1 - r() * 0.999) / wt[k]]).sort((a, b) => a[1] - b[1]).map((a) => a[0]);
}

const STONE = [0.74, 0.69, 0.6], STONE_DARK = [0.6, 0.56, 0.5], ROOF = [0.78, 0.46, 0.34];

// Build one, scaled by k. F is the lot's frame (Frame from interiors.js): front edge centre, facing the road.
export function placeScenic(W, F, kind, k = 1) {
  const D = SCENIC[kind], P = W.P;
  const { w, d } = scenicSize(kind, k);
  (W.scenicCount || (W.scenicCount = {}))[kind] = (W.scenicCount[kind] || 0) + 1;
  // one solid block: you walk round it, bullets stop on it, zombies path round it
  const s = D.solid, top = D.top * k;
  const [bx, bz] = F.p((s[0] + s[2]) / 2 * k, (s[1] + s[3]) / 2 * k);
  P.add(bx, top / 2, bz, (s[2] - s[0]) / 2 * k, top / 2, (s[3] - s[1]) / 2 * k, F.yaw);
  if (kind === 'provence') provenceBody(F);
  W.buildings.push({ F, w, d, floors: Math.max(1, Math.round(top / 3.2)), solid: true, scenic: kind });
  const [cx, cz] = F.p(0, d / 2);
  (W.modelHouses || (W.modelHouses = [])).push({ kind, file: D.file, x: F.x, z: F.z, yaw: F.yaw, cx, cz, rad: Math.hypot(w, d) / 2 + 1, top: top + 1, k });
  // the shops keep a lamp or two on after dark, like the box shops did
  if (D.lit && W.rng.chance(D.lit)) {
    const [lx, ly, lz] = F.world(D.litAt[0] * k, D.litAt[1] * k, D.litAt[2] * k);
    W.lights.push({ x: lx, y: ly, z: lz, color: 0xffe0b0, intensity: 3, dist: 9, flicker: W.rng.chance(0.3) ? 1 : 0 });
  }
}

// The scan is only the cottage's front wall (z 0 to 3.3; the garage on one end stands proud of it).
// Behind it: stone walls, a low plinth and a Provençal roof of terracotta tiles, from the town's own materials.
function provenceBody(F) {
  const z0 = 3.3, z1 = 9.6, hw = 6.95, wallH = 3.75, ridge = 5.75, eave = 0.45;
  const o = { collide: false };
  F.box('plaster', 0, wallH / 2, (z0 + z1) / 2, hw * 2, wallH, z1 - z0, STONE, Object.assign({ uv: 2.5 }, o));
  F.box('concrete', 0, 0.22, z1 + 0.05, hw * 2 + 0.1, 0.44, 0.2, STONE_DARK, o);           // plinth along the back
  // gable ends (plaster triangles) and the two roof slopes (tiles), ridge along the frontage
  const zm = (z0 + z1) / 2 - 0.6;
  const W = F.W, B = W.B;
  for (const sx of [-1, 1]) {
    const a = F.world(sx * hw, wallH, z0 - 0.2), b = F.world(sx * hw, wallH, z1), c = F.world(sx * hw, ridge, zm);
    const n = [sx * F.c, 0, -sx * F.s];
    B.quad('plaster', a, b, c, c, n, [[0, 0], [3, 0], [1.5, 0.8], [1.5, 0.8]], STONE, [F.x, F.z]);
  }
  // one roof slope, from its eave (at local z = za) up to the ridge
  const slope = (za) => {
    const ya = wallH - 0.25, ext = hw + eave;
    const p0 = F.world(-ext, ya, za), p1 = F.world(ext, ya, za), p2 = F.world(ext, ridge, zm), p3 = F.world(-ext, ridge, zm);
    const dz = zm - za, dy = ridge - ya, len = Math.hypot(dz, dy);
    const ny = Math.abs(dz) / len, nz = -Math.sign(dz) * dy / len;                     // local normal: up, and out over the eave
    const n = [nz * F.s, ny, nz * F.c];
    B.quad('tile', p0, p1, p2, p3, n, [[0, 0], [ext * 2 / 1.5, 0], [ext * 2 / 1.5, len / 1.5], [0, len / 1.5]], ROOF, [F.x, F.z]);
    // the underside, so the eaves are not see-through from below
    B.quad('plaster', p0, p1, p2, p3, [-n[0], -n[1], -n[2]], [[0, 0], [1, 0], [1, 1], [0, 1]], STONE_DARK, [F.x, F.z]);
  };
  slope(z0 - 0.75); slope(z1 + 0.55);
  // a ridge cap and a chimney
  F.box('tile', 0, ridge + 0.06, zm, hw * 2 + eave * 2, 0.16, 0.34, ROOF.map((v) => v * 0.85), o);
  F.box('plaster', hw * 0.45, ridge + 0.2, zm + 1.2, 0.7, 1.6, 0.7, STONE, o);
  F.box('concrete', hw * 0.45, ridge + 1.05, zm + 1.2, 0.85, 0.12, 0.85, STONE_DARK, o);
}

// ---------- the Himalaya ----------
// Six copies of the Everest tile stand in a ring round the camera, past everything you can reach (it moves
// with the camera, so it stays on the horizon wherever you go). Each copy shows a different face of the
// range, and their sizes differ, so the skyline doesn't repeat. They are lit by the town's own moon or sun
// and fill light. From the middle of town they are a faint shape behind the haze; in the direction of the
// town's edge they come out clear, so at the end of the map the whole range stands over the fields.
const RING = 112;                    // metres from the camera to the near edge (the far plane is 170: the far corners stay inside it)
const BASE = -16;                    // the foot of the range, well below the eye (it sinks into the haze)
const COPIES = [
  // [angle (deg, 0 = north), face (deg: which side of the tile looks at you), width m, height m, mirror]
  [0, 180, 190, 58, false],
  [62, 90, 165, 46, false],
  [118, 0, 180, 42, true],
  [180, 270, 170, 50, false],
  [240, 180, 185, 44, true],
  [300, 0, 175, 54, false],
];

export class Mountains {
  constructor(g) {
    this.g = g;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.ready = false;
    this.uni = { hazeColor: { value: new THREE.Color() }, camXZ: { value: new THREE.Vector2() }, bMin: { value: new THREE.Vector2(BOUNDS.minX, BOUNDS.minZ) }, bMax: { value: new THREE.Vector2(BOUNDS.maxX, BOUNDS.maxZ) } };
    g.scene.add(this.group);
  }

  load() {
    return loadGLB('models/scenery/himalaya.glb').then((gltf) => this._build(gltf)).catch((e) => console.warn('could not load the mountains', e));
  }

  _build(gltf) {
    let src = null;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => { if (o.isMesh && !src) src = o; });
    if (!src) return;
    lambertize(gltf.scene);
    // dequantise and bake the node transform, then centre the tile: x and z on 0, the lowest point on y = 0
    const geo = src.geometry.clone();
    for (const k of ['position', 'normal']) {
      const a = geo.attributes[k]; if (!a || a.array instanceof Float32Array) continue;
      const f = new Float32Array(a.count * 3);
      for (let i = 0; i < a.count; i++) { f[i * 3] = a.getX(i); f[i * 3 + 1] = a.getY(i); f[i * 3 + 2] = a.getZ(i); }
      geo.setAttribute(k, new THREE.BufferAttribute(f, 3));
    }
    geo.applyMatrix4(src.matrixWorld);
    geo.computeBoundingBox();
    const bb = geo.boundingBox, sz = bb.getSize(new THREE.Vector3());
    geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
    const mat = src.material;
    mat.fog = false;
    mat.side = THREE.DoubleSide;        // the mirrored copies turn their faces round
    const U = this.uni;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vMW; varying float vLY;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvec4 lp = instanceMatrix * vec4(transformed, 1.0); vLY = lp.y; vMW = (modelMatrix * lp).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vMW; varying float vLY; uniform vec3 hazeColor; uniform vec2 camXZ; uniform vec2 bMin; uniform vec2 bMax;')
        .replace('#include <fog_fragment>', `
          // how far the town goes on in this direction: the nearer its edge, the clearer the range
          vec2 dir = normalize(vMW.xz - camXZ + vec2(1e-4));
          vec2 tx = (mix(bMin, bMax, step(0.0, dir)) - camXZ) / (abs(dir) + 1e-4) * sign(dir + 1e-6);
          float edge = max(0.0, min(tx.x, tx.y));
          float clear = 1.0 - smoothstep(25.0, 230.0, edge);
          // and the foot of the range always melts into the haze
          float foot = smoothstep(0.12, 0.62, (vLY - ${BASE.toFixed(1)}) / 50.0);
          // still a long way off: even at the edge, some of the air between stays in front
          float k = clamp((0.18 + 0.62 * clear) * foot, 0.0, 1.0);
          gl_FragColor.rgb = mix(hazeColor, gl_FragColor.rgb, k);`);
    };
    mat.customProgramCacheKey = () => 'himalaya';
    const im = new THREE.InstancedMesh(geo, mat, COPIES.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    COPIES.forEach(([ang, face, wid, hgt, mir], i) => {
      const a = ang * Math.PI / 180;
      // the face we want toward the centre: turn the tile so that side looks back at the camera
      const f = face * Math.PI / 180;
      const across = face % 180 === 0 ? sz.x : sz.z, deep = face % 180 === 0 ? sz.z : sz.x;
      const kw = wid / across, kh = hgt / sz.y, kd = Math.min(kw, 22 / deep);
      // scale in the tile's own axes, before turning it: x is along the face for faces 0/180, z for 90/270
      if (face % 180 === 0) s.set(kw * (mir ? -1 : 1), kh, kd); else s.set(kd, kh, kw * (mir ? -1 : 1));
      q.setFromAxisAngle(up, f - a - Math.PI);
      p.set(Math.sin(a) * (RING + deep * kd * 0.5), BASE, -Math.cos(a) * (RING + deep * kd * 0.5));
      im.setMatrixAt(i, m.compose(p, q, s));
    });
    im.frustumCulled = false;
    im.renderOrder = -9;                 // just after the sky dome
    this.group.add(im);
    this.mesh = im;
    this.ready = true;
  }

  // Every frame, after the day cycle has set the fog: follow the camera, show only over the town.
  update(cam) {
    const g = this.g;
    const on = this.ready && !g.inValley();
    this.group.visible = on;
    if (!on) return;
    this.group.position.set(cam.position.x, cam.position.y, cam.position.z);
    this.uni.camXZ.value.set(cam.position.x, cam.position.z);
    this.uni.hazeColor.value.copy(g.scene.fog.color);
  }
}
