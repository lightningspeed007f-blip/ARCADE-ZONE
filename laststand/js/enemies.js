// Zombies and hostile humans. The zombies wear the four uploaded zombie models (creatures.js: the prisoner,
// the girl scout, the zombie girl and the parasite, each with its own Mixamo clips). People are built from
// rounded, vertex-coloured parts (skull with a face, tapered torso, capsule limbs, hands and shoes), drawn with
// one instanced mesh per part (~16 draw calls for every enemy on the map) and animated procedurally: thieves
// (chor) wear dark clothes and a bright gamchha wrapped over the face and sneak in a crouch; armed looters stand
// upright with a cap and gun. Until a zombie's model has downloaded it is drawn the same way (pale, blood-stained,
// reaching forward, glowing eyes).
import * as THREE from 'three';
import { clamp, lerp, angleDiff, rgb } from './util.js';
import { Physics } from './physics.js';
import { BOMB } from './explosives.js';
import { ZOMBIE_SKINS, ROAR } from './creatures.js';

// a zombie's scream is heard only this close (metres), and it stops the moment that zombie dies
const SCREAM_RANGE = 6;
// ...but the scream that goes with the scream animation carries as far as the zombie can see you from
const ROAR_RANGE = 30;
// Feeding: an idle zombie may crouch over one of the town's dead (corpses.js) and eat, and a zombie that kills
// someone eats them. You hear the eating this close (metres); at most this many feeding zombies at once.
const FEED_HEAR = 15, FEED_LOOPS = 3;
const FEED_LOOK = 14;                                   // how far an idle zombie looks for a body to eat
const EDIBLE = new Set(['body1', 'body2', 'body3']);   // not the row of body bags, not the pumpkins

const MAX = 170;
// model: 'zombie' wears one of the four zombie models (creatures.js); roar: stops and screams when it first sees you
export const TYPES = {
  walker: { hp: 70, speed: 1.15, chase: 1.55, dmg: 12, reach: 1.45, wind: 0.55, sight: 17, scale: 1, growl: 'growl', model: 'zombie' },
  runner: { hp: 50, speed: 1.4, chase: 4.6, dmg: 9, reach: 1.4, wind: 0.35, sight: 24, scale: 0.96, growl: 'scream', model: 'zombie' },
  brute:  { hp: 260, speed: 1.0, chase: 1.9, dmg: 30, reach: 1.7, wind: 0.8, sight: 15, scale: 1.25, growl: 'growlBig', model: 'zombie' },
  human:  { hp: 95, speed: 1.6, chase: 3.6, dmg: 0, reach: 0, wind: 0, sight: 34, scale: 1, growl: null },
  // chor: a masked knife thief. Fast, melee, grabs food from the bag and bolts.
  thief:  { hp: 60, speed: 1.55, chase: 5.0, dmg: 9, reach: 1.5, wind: 0.4, sight: 30, scale: 0.98, growl: null },
  // the outlands' beasts: a tough ghoul (a zombie that screams when it spots you) and a fast zombie hound
  ghoul:  { hp: 190, speed: 1.0, chase: 2.5, dmg: 20, reach: 1.65, wind: 0.6, sight: 22, scale: 1.05, growl: 'growlBig', model: 'zombie', roar: true },
  hound:  { hp: 55, speed: 1.9, chase: 6.4, dmg: 9, reach: 1.55, wind: 0.32, sight: 28, scale: 1, growl: 'growl', model: 'hound', roar: true },
};
const THIEF_GUN = { dmg: 0, rate: 1, burst: 0, sound: 'pistol', drop: 'katta' };
const HUMAN_GUNS = {
  pistol: { dmg: 9, rate: 0.65, burst: 2, sound: 'pistol', drop: 'pistol' },
  rifle: { dmg: 7, rate: 0.16, burst: 3, sound: 'rifle', drop: 'rifle' },
  shotgun: { dmg: 20, rate: 1.4, burst: 1, sound: 'shotgun', drop: 'dunali' },
};

// zombies: grey-green, waxy and bruised; people: North-Indian brown skin tones
const SKIN_Z = [0x9aa58c, 0xa3a08a, 0x8e9a84, 0xb0aa92, 0x8a8478, 0x9c9a90];
const SKIN_H = [0x8d5a3c, 0xa06a48, 0x7a4a30, 0xb07a58, 0x94603f];
// what the dead were wearing: faded shirts, kurtas, vests, school and work clothes
const CLOTH = [0xcfc8b4, 0x6a7a9a, 0x8a3a34, 0x4a5e44, 0xb8964a, 0x5a5068, 0x8a6a4a, 0xbcbcc4, 0x3a4a66, 0xa0785a];
const LEGS = [0x2a3040, 0x403a30, 0xc8c4b8, 0x5a5048, 0x30302a, 0x4a4a52];
const HAIR = [0x141210, 0x1c1814, 0x2a221c, 0x0e0e0e, 0x3a342e, 0x5a5650];
// thieves: dark kurta / shirt, with a loud gamchha (checked cotton towel) tied over head and face
const THIEF_TOP = [0x1e1e24, 0x26221e, 0x1f2a24, 0x2a1e22];
const GAMCHHA = [0xd8401a, 0xe0a010, 0xc02040, 0xd86a10, 0x2a8ad0];
// looters: olive, khaki and dark jackets, jeans, a cap
const LOOTER_TOP = [0x4a5236, 0x6a5e40, 0x2e3440, 0x5a3a28, 0x3a3a3a];
const CAPS = [0x2a2a2e, 0x6a1a1a, 0x3a4a2a, 0xb8a888, 0x1c2a4a];

// ---------- geometry kit: rounded parts with UVs and baked shading colours ----------
// Each part is tinted per instance (skin, shirt, trousers...), so baked colours
// are multipliers: white takes the instance colour, dark values make eyes,
// brows, belts and shoes.
function P(geo, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));
  const c = rgb(col), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c[0]; a[i * 3 + 1] = c[1]; a[i * 3 + 2] = c[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}
function M(parts) {
  let n = 0;
  for (const p of parts) n += p.attributes.position.count;
  const out = new THREE.BufferGeometry();
  for (const [k, w] of [['position', 3], ['normal', 3], ['uv', 2], ['color', 3]]) {
    const a = new Float32Array(n * w); let o = 0;
    for (const p of parts) { a.set(p.attributes[k].array, o); o += p.attributes[k].array.length; }
    out.setAttribute(k, new THREE.BufferAttribute(a, w));
  }
  out.computeBoundingSphere();
  return out;
}
const S = (seg = 10, rings = 8, th = Math.PI) => new THREE.SphereGeometry(1, seg, rings, 0, Math.PI * 2, 0, th);
const C = (r0, r1, h, seg = 10, open = false) => new THREE.CylinderGeometry(r0, r1, h, seg, 1, open);
const K = (r, len, rad = 8) => new THREE.CapsuleGeometry(r, len, 2, rad);
const B = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const W = 0xffffff;

function bodyParts() {
  const eyesAt = (col, r, z) => [P(S(6, 4), col, -0.038, 0.022, z, 0, 0, 0, r, r * 0.8, r * 0.6), P(S(6, 4), col, 0.038, 0.022, z, 0, 0, 0, r, r * 0.8, r * 0.6)];
  return {
    // skull, jaw, nose, ears, eye sockets, brows, mouth and neck; centred like the old 26 cm head box
    head: M([
      P(S(12, 10), W, 0, 0.012, 0, 0, 0, 0, 0.096, 0.118, 0.108),
      P(S(10, 6), W, 0, -0.058, 0.018, 0, 0, 0, 0.078, 0.06, 0.082),
      P(B(0.026, 0.05, 0.04), 0xf0e8e4, 0, -0.008, 0.104, -0.25),
      P(S(6, 4), 0xe8e0dc, -0.096, 0.004, -0.004, 0, 0, 0, 0.018, 0.032, 0.014),
      P(S(6, 4), 0xe8e0dc, 0.096, 0.004, -0.004, 0, 0, 0, 0.018, 0.032, 0.014),
      ...eyesAt(0x1a1412, 0.02, 0.092),
      P(B(0.05, 0.011, 0.016), 0x302420, -0.04, 0.05, 0.096, 0, 0, 0.12), P(B(0.05, 0.011, 0.016), 0x302420, 0.04, 0.05, 0.096, 0, 0, -0.12),
      P(B(0.046, 0.01, 0.012), 0x4a2826, 0, -0.064, 0.094),
      P(C(0.05, 0.056, 0.14, 8), 0xe4dcd8, 0, -0.13, -0.008),
    ]),
    // hair: a cap of hair over the crown and back of the skull, a few tufts
    hair: M([
      P(S(12, 6, Math.PI * 0.56), W, 0, 0.018, -0.012, 0.5, 0, 0, 0.104, 0.124, 0.116),
      P(S(6, 4), W, 0.05, 0.1, 0.02, 0, 0, 0, 0.04, 0.03, 0.05), P(S(6, 4), W, -0.045, 0.098, 0.035, 0, 0, 0, 0.04, 0.028, 0.045),
    ]),
    // looter's cap: crown and a brim over the eyes
    cap: M([
      P(S(12, 6, Math.PI * 0.5), W, 0, 0.04, -0.004, 0.12, 0, 0, 0.108, 0.1, 0.118),
      P(C(0.075, 0.08, 0.012, 12), 0xd8d8d8, 0, 0.04, 0.1, 0.1, 0, 0, 1, 1, 0.75),
    ]),
    // thief's gamchha: cloth over the head, a band over nose and mouth (eyes left open), the knot behind
    wrap: M([
      P(S(12, 6, Math.PI * 0.55), W, 0, 0.022, -0.01, 0.5, 0, 0, 0.108, 0.13, 0.12),
      P(C(0.1, 0.088, 0.085, 12, true), W, 0, -0.04, 0.012, 0, 0, 0, 1.02, 1, 1.12),
      P(C(0.101, 0.101, 0.012, 12, true), 0x9a9a9a, 0, -0.01, 0.012, 0, 0, 0, 1.03, 1, 1.13),
      P(C(0.093, 0.09, 0.012, 12, true), 0x9a9a9a, 0, -0.066, 0.012, 0, 0, 0, 1.03, 1, 1.13),
      P(S(6, 4), W, 0, 0.0, -0.125, 0, 0, 0, 0.035, 0.03, 0.03),
      P(B(0.05, 0.16, 0.012), W, 0.012, -0.08, -0.13, 0.15, 0, 0.12),
    ]),
    // zombie eyes: drawn with an unlit material so they glow in the dark
    eyes: M(eyesAt(W, 0.017, 0.098)),
    // tapered torso with shoulders, collar, button placket and a belt
    chest: M([
      P(C(0.2, 0.162, 0.5, 12), W, 0, 0.02, 0, 0, 0, 0, 1, 1, 0.6),
      P(S(10, 6), W, -0.19, 0.22, 0, 0, 0, 0, 0.085, 0.07, 0.09), P(S(10, 6), W, 0.19, 0.22, 0, 0, 0, 0, 0.085, 0.07, 0.09),
      P(S(12, 6, Math.PI / 2), W, 0, 0.265, 0, 0, 0, 0, 0.2, 0.06, 0.12),
      P(C(0.058, 0.064, 0.04, 10, true), 0xb8b8b8, 0, 0.29, 0),
      P(B(0.022, 0.42, 0.012), 0xc8c8c8, 0, 0.04, 0.1),
      P(C(0.166, 0.166, 0.05, 12), 0x3a3030, 0, -0.245, 0, 0, 0, 0, 1, 1, 0.62),
    ]),
    // blood soaked into the zombie's shirt, front and back
    gore: M([
      P(S(8, 6), W, 0.06, 0.06, 0.112, 0, 0, 0.4, 0.075, 0.1, 0.012),
      P(S(8, 6), W, -0.08, -0.1, 0.105, 0, 0, -0.3, 0.06, 0.08, 0.012),
      P(S(8, 6), W, -0.02, 0.22, 0.09, 0, 0, 0, 0.09, 0.05, 0.03),
      P(S(8, 6), W, 0.04, -0.05, -0.105, 0, 0, 0.2, 0.08, 0.11, 0.012),
    ]),
    pelvis: M([P(C(0.168, 0.16, 0.22, 12), W, 0, 0, 0, 0, 0, 0, 1, 1, 0.66)]),
    ua: M([P(K(0.058, 0.2), W)]),
    // forearm and hand (fingers as a mitt and a thumb)
    fa: M([P(K(0.049, 0.19), W, 0, 0.005), P(S(8, 6), 0xf0eae8, 0, -0.18, 0.004, 0, 0, 0, 0.042, 0.062, 0.03), P(S(6, 4), 0xf0eae8, 0.01, -0.15, 0.03, 0, 0, 0, 0.016, 0.03, 0.016)]),
    th: M([P(K(0.078, 0.3), W)]),
    // shin and a shoe (dark sole and upper)
    sn: M([P(K(0.062, 0.31), W, 0, 0.01), P(B(0.098, 0.075, 0.24), 0x3a3634, 0, -0.205, 0.045), P(B(0.1, 0.02, 0.25), 0x1a1818, 0, -0.24, 0.045)]),
    // looter's gun: receiver, barrel, magazine, wooden stock (long axis = z)
    gun: M([
      P(B(0.05, 0.075, 0.3), 0x2a2a2c, 0, 0, -0.02), P(C(0.014, 0.014, 0.3, 6), 0x1e1e20, 0, 0.015, -0.32, Math.PI / 2),
      P(B(0.035, 0.12, 0.05), 0x2a2a2c, 0, -0.08, -0.06, 0.3), P(B(0.045, 0.08, 0.22), 0x6a4024, 0, -0.015, 0.22),
    ]),
    // ---- far LOD (beyond ~30 m): a few tapered blocks per part, same proportions ----
    farHead: M([P(B(0.19, 0.24, 0.21), W), P(B(0.2, 0.08, 0.22), 0x2a2420, 0, 0.09, -0.01), P(C(0.05, 0.05, 0.12, 4), W, 0, -0.14, 0)]),
    farChest: M([P(C(0.2, 0.16, 0.56, 6), W, 0, 0, 0, 0, 0, 0, 1, 1, 0.6)]),
    farPelvis: M([P(B(0.33, 0.22, 0.21), W)]),
    farUa: M([P(B(0.11, 0.32, 0.11), W)]),
    farFa: M([P(B(0.095, 0.38, 0.095), W, 0, -0.04)]),
    farTh: M([P(B(0.15, 0.46, 0.15), W)]),
    farSn: M([P(B(0.12, 0.46, 0.12), W), P(B(0.1, 0.07, 0.22), 0x3a3634, 0, -0.2, 0.05)]),
    // thief's knife: wooden handle, steel blade (long axis = z)
    knife: M([P(B(0.03, 0.038, 0.11), 0x4a3020, 0, 0, -0.02), P(B(0.026, 0.012, 0.03), 0x8a8a8a, 0, 0, 0.045), P(B(0.008, 0.034, 0.2), 0xd8dce4, 0, 0.004, 0.16), P(B(0.008, 0.02, 0.04), 0xd8dce4, 0, 0.012, 0.27, 0.5)]),
  };
}

class Rig {
  constructor() {
    const O = () => new THREE.Object3D();
    this.root = O(); this.body = O(); this.pelvis = O(); this.spine = O(); this.chest = O(); this.neck = O(); this.head = O();
    this.sh = [O(), O()]; this.ua = [O(), O()]; this.el = [O(), O()]; this.fa = [O(), O()];
    this.hip = [O(), O()]; this.th = [O(), O()]; this.kn = [O(), O()]; this.sn = [O(), O()]; this.gun = O(); this.knife = O();
    this.root.add(this.body); this.body.add(this.pelvis); this.pelvis.position.y = 0.95;
    this.pelvis.add(this.spine); this.spine.position.y = 0.08;
    this.spine.add(this.chest); this.chest.position.y = 0.29;
    this.spine.add(this.neck); this.neck.position.y = 0.6;
    this.neck.add(this.head); this.head.position.y = 0.14;
    for (let i = 0; i < 2; i++) {
      const sx = i ? 0.27 : -0.27;
      this.spine.add(this.sh[i]); this.sh[i].position.set(sx, 0.52, 0);
      this.sh[i].add(this.ua[i]); this.ua[i].position.y = -0.15;
      this.sh[i].add(this.el[i]); this.el[i].position.y = -0.3;
      this.el[i].add(this.fa[i]); this.fa[i].position.y = -0.14;
      this.pelvis.add(this.hip[i]); this.hip[i].position.set(i ? 0.1 : -0.1, -0.03, 0);
      this.hip[i].add(this.th[i]); this.th[i].position.y = -0.22;
      this.hip[i].add(this.kn[i]); this.kn[i].position.y = -0.44;
      this.kn[i].add(this.sn[i]); this.sn[i].position.y = -0.23;
    }
    this.el[1].add(this.gun); this.gun.position.set(0, -0.26, -0.18); this.gun.rotation.x = Math.PI / 2;
    // the knife sits in the fist, blade along the forearm
    this.el[1].add(this.knife); this.knife.position.set(0, -0.29, 0.02); this.knife.rotation.x = Math.PI / 2;
  }
}

export class Enemies {
  constructor(scene, mats, game) {
    this.game = game;
    this.list = [];
    this.rig = new Rig();
    const mat = new THREE.MeshLambertMaterial({ map: mats.grime, vertexColors: true });
    // a faint cold rim of moonlight on the silhouette, so bodies outside the torch beam
    // never sink into pure black (one extra line in the shader, no extra lights)
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
        float rimK = 1.0 - max(dot(normalize(vViewPosition), normal), 0.0);
        outgoingLight += diffuseColor.rgb * (vec3(0.22, 0.27, 0.4) * pow(rimK, 2.2) + 0.035);
        #include <opaque_fragment>`);
    };
    // glowing zombie eyes: unlit, so they read in the dark from across a street
    const eyeMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false });
    const mk = (geo, n, m = mat) => { const im = new THREE.InstancedMesh(geo, m, n); im.count = 0; im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(im); im.setColorAt(0, new THREE.Color()); return im; };
    const G = bodyParts();
    this.im = {
      head: mk(G.head, MAX), hair: mk(G.hair, MAX), cap: mk(G.cap, MAX), wrap: mk(G.wrap, MAX), eyes: mk(G.eyes, MAX, eyeMat),
      chest: mk(G.chest, MAX), gore: mk(G.gore, MAX), pelvis: mk(G.pelvis, MAX),
      ua: mk(G.ua, MAX * 2), fa: mk(G.fa, MAX * 2), th: mk(G.th, MAX * 2), sn: mk(G.sn, MAX * 2),
      gun: mk(G.gun, MAX), knife: mk(G.knife, MAX),
    };
    // distant bodies use the cheap shapes (a few hundred triangles instead of ~3000)
    this.imFar = {
      head: mk(G.farHead, MAX), chest: mk(G.farChest, MAX), pelvis: mk(G.farPelvis, MAX),
      ua: mk(G.farUa, MAX * 2), fa: mk(G.farFa, MAX * 2), th: mk(G.farTh, MAX * 2), sn: mk(G.farSn, MAX * 2),
    };
    // soft contact shadow under every body: grounds them, helps judge distance at night
    const sc = document.createElement('canvas'); sc.width = sc.height = 64;
    const sx = sc.getContext('2d'), sg = sx.createRadialGradient(32, 32, 0, 32, 32, 32);
    sg.addColorStop(0, 'rgba(0,0,0,0.75)'); sg.addColorStop(0.55, 'rgba(0,0,0,0.35)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    sx.fillStyle = sg; sx.fillRect(0, 0, 64, 64);
    const shMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, color: 0xffffff });
    this.shadow = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), shMat, MAX);
    this.shadow.count = 0; this.shadow.frustumCulled = false; this.shadow.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.shadow.renderOrder = 1;
    scene.add(this.shadow);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s3 = new THREE.Vector3();
    this._c = new THREE.Color(); this._v = new THREE.Vector3();
    this.tmpBoxes = [];
  }

  clear() { for (const e of this.list) this.endFeed(e); this.list.length = 0; }
  get alive() { return this.list.filter((e) => !e.dead); }

  spawn(type, x, y, z, o = {}) {
    if (this.list.length >= MAX) {
      // recycle the oldest corpse
      const i = this.list.findIndex((e) => e.dead);
      if (i < 0) return null;
      this.list.splice(i, 1);
    }
    const T = TYPES[type], r = Math.random;
    const human = type === 'human' || type === 'thief';
    const thief = type === 'thief';
    const pick = (a) => a[(r() * a.length) | 0];
    const e = {
      type, T, human, pos: { x, y, z }, yaw: o.yaw ?? r() * 6.28, hp: T.hp * (o.hpK || 1), maxHp: T.hp,
      state: o.state || (thief ? (o.wait ? 'WAIT' : 'PATROL') : human ? 'PATROL' : 'IDLE'), stateT: 0, t: r() * 10, phase: r() * 6,
      vel: { x: 0, z: 0 }, st: { vy: 0, peak: y, fall: 0 }, dead: false, deathT: 0, fallDir: 1,
      scale: T.scale * (0.94 + r() * 0.12), speedK: 0.85 + r() * 0.3, limp: !human && r() < 0.3 ? 0.3 + r() * 0.4 : 0,
      limpArm: !human && type !== 'brute' && r() < 0.3 ? (r() < 0.5 ? 0 : 1) : -1,
      colors: thief ? {
        // dark kurta and trousers, black gloves, a bright gamchha over the face
        skin: pick(SKIN_H), top: pick(THIEF_TOP), legs: pick([0x1c1c22, 0x24201c, 0x1a1e24]), fa: 0x161618, wrap: pick(GAMCHHA),
      } : human ? {
        skin: pick(SKIN_H), top: pick(LOOTER_TOP), legs: pick([0x22283a, 0x2a2a2a, 0x3a3428, 0x2c3448]), hair: pick(HAIR.slice(0, 4)), cap: r() < 0.7 ? pick(CAPS) : null,
      } : {
        skin: pick(SKIN_Z), top: pick(CLOTH), legs: pick(LEGS), hair: pick(HAIR), bald: r() < 0.18,
        gore: pick([0x4a0806, 0x5a0a08, 0x3a0604]), eye: type === 'brute' ? 0xff3a20 : type === 'runner' ? 0xfff0a0 : pick([0xe8f070, 0xd8e8a0, 0xf0e070]),
      },
      wanderYaw: r() * 6.28, nextGrowl: 2 + r() * 8, attackT: 0, stagger: 0, flinch: 0,
      lastSeen: null, losT: 0, seeT: 0, alert: 0, investigate: null, stuckT: 0, sideT: 0, side: 1,
      route: o.route || null, routeI: 0, thief, loot: null, tunnel: o.tunnel || false, zone: o.zone || null, hold: o.hold || false,
      gun: thief ? THIEF_GUN : human ? HUMAN_GUNS[o.gun || pick(['pistol', 'pistol', 'rifle', 'shotgun'])] : null,
      ammo: 0, coolT: 0, burstLeft: 0, cover: null, coverT: 0, peek: null, react: 0, hs: [], home: { x, z },
      inside: o.inside || false, frozen: o.frozen || false, aimT: 0,
      // about a third of the armed looters carry one desi bomb
      bomb: human && !thief && r() < 0.35 ? 1 : 0, throwT: 0,
    };
    if (e.gun && !thief) e.gunKey = o.gun || Object.keys(HUMAN_GUNS).find((k) => HUMAN_GUNS[k] === e.gun);
    if (type === 'brute') { e.colors.top = 0x3a2a20; e.colors.legs = 0x2a2620; }
    // which body it wears: one of the four zombies (the big ones lean to the parasite), or its own model
    if (T.model === 'zombie') {
      e.skin = o.skin || ((type === 'brute' || type === 'ghoul') && r() < 0.6 ? 'parasite' : pick(ZOMBIE_SKINS));
      e.mkind = 'z:' + e.skin;
    } else e.mkind = T.model || null;
    if (!human) e.colors.fa = e.colors.skin;
    else if (!thief) e.colors.fa = e.colors.skin;
    this.list.push(e);
    return e;
  }

  // A ghoul roars when it first sees you; a hound howls and the rest of its pack comes running.
  roar(e) {
    const g = this.game, P = g.player;
    e.roared = true;
    const hound = e.type === 'hound';
    e.roarT = hound ? 1.5 : 1.6;
    if (hound) {
      g.audio.play('bark', { pos: [e.pos.x, e.pos.y + 0.8, e.pos.z], vol: 1.1, rate: 0.75, max: 160 });
      this.zombieScream(e, { pos: [e.pos.x, e.pos.y + 0.8, e.pos.z], vol: 0.55, rate: 1.6, delay: 0.25 });
      for (const o of this.list) {
        if (o === e || o.dead || o.type !== 'hound' || o.state === 'CHASE' || o.state === 'ATTACK') continue;
        if (Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) > 45) continue;
        o.state = 'CHASE'; o.lastSeen = { x: P.pos.x, z: P.pos.z }; o.lostT = 0; o.hold = false; o.roared = true;
      }
    } else {
      // it stands and screams (creatures.js plays the scream clip on the same clock): the sound starts as its mouth opens
      e.roarT = ROAR.total;
      if (g.audio.has('zombieRoar')) this.zombieScream(e, { key: 'zombieRoar', range: ROAR_RANGE, pos: [e.pos.x, e.pos.y + 1.5, e.pos.z], vol: 1, ref: 4, vary: 0.02, delay: ROAR.cry });
      else {
        g.audio.play('growlBig', { pos: [e.pos.x, e.pos.y + 1.6, e.pos.z], vol: 1.1, rate: 0.85, max: 140 });
        this.zombieScream(e, { pos: [e.pos.x, e.pos.y + 1.6, e.pos.z], vol: 0.7, rate: 0.6, delay: 0.35 });
      }
    }
  }

  // ---------- hit test: ray vs body spheres ----------
  hitTest(o, d, maxT, ignore) {
    let best = null;
    for (const e of this.list) {
      if (e.dead || e === ignore || !e.hs.length) continue;
      // quick reject with bounding sphere
      const cx = e.pos.x - o.x, cy = e.pos.y + 1 - o.y, cz = e.pos.z - o.z;
      const tc = cx * d.x + cy * d.y + cz * d.z;
      if (tc < 0 || tc > maxT + 2) continue;
      const dd = cx * cx + cy * cy + cz * cz - tc * tc;
      if (dd > 1.6 * e.scale) continue;
      for (const s of e.hs) {
        const sx = s[0] - o.x, sy = s[1] - o.y, sz = s[2] - o.z;
        const t = sx * d.x + sy * d.y + sz * d.z;
        if (t < 0) continue;
        const q = sx * sx + sy * sy + sz * sz - t * t;
        const r2 = s[3] * s[3];
        if (q > r2) continue;
        const th = t - Math.sqrt(r2 - q);
        if (th < maxT && (!best || th < best.t)) best = { e, part: s[4], t: th };
      }
    }
    return best;
  }

  damage(e, dmg, part, dir, src) {
    if (e.dead) return false;
    const mul = part === 'head' ? (e.human ? 2.6 : 3.4) : part === 'leg' ? 0.65 : part === 'arm' ? 0.75 : 1;
    const n = dmg * mul;
    e.hp -= n;
    e.flinch = Math.min(1, e.flinch + n / 40);
    if (dir) { e.hitDir = Math.atan2(dir.x, dir.z); e.lastHitPos = { x: e.pos.x - dir.x * 2, z: e.pos.z - dir.z * 2 }; }
    e.lastHitBy = src;
    if (!e.human && e.type !== 'brute' && n > 20) e.stagger = 0.35;
    if (part === 'leg' && !e.human) {
      e.limp = Math.min(0.75, e.limp + 0.2);
      // legs shot to pieces: a zombie may drop and come crawling (only the modelled zombies have the clips)
      if (e.limp >= 0.7 && !e.crawler && e.T.model === 'zombie' && e.type !== 'brute' && Math.random() < 0.5) e.crawler = true;
    }
    // being shot always reveals the shooter
    if (src === 'player') { e.alert = 1; e.lastSeen = { x: this.game.player.pos.x, z: this.game.player.pos.z }; if (e.thief) { if (e.state !== 'FLEE') e.state = 'CHASE'; } else if (e.human) { e.state = 'ATTACK'; e.react = 0.1; } else e.state = 'CHASE'; if (e.zone) this.alertZone(e); }
    if (e.hp <= 0) { this.kill(e, part, dir, src); return true; }
    if (e.human && !e.thief && e.hp < e.maxHp * 0.3 && e.state !== 'RETREAT') { e.state = 'RETREAT'; e.stateT = 0; }
    return false;
  }

  // a zombie's scream: only within SCREAM_RANGE, and one at a time per zombie so it can be cut off
  // (o.key / o.range: another scream sound, heard further)
  zombieScream(e, o) {
    const g = this.game, P = g.player, range = o.range || SCREAM_RANGE;
    if (e.dead || Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) > range) return;
    this.stopScream(e);
    e.screamSrc = g.audio.play(o.key || 'scream', { ...o, max: range + 2 });
  }

  // ---------- feeding ----------
  // crouch over a body at (cx, cz), on the side the zombie comes from
  _feed(e, cx, cz, until, prop, body) {
    const dx = e.pos.x - cx, dz = e.pos.z - cz, l = Math.hypot(dx, dz) || 1;
    const off = prop ? 0.85 : 0.75;
    e.meal = { x: cx + dx / l * off, z: cz + dz / l * off, cx, cz, until, c: prop || null, body: body || null };
    if (prop) prop.eater = e;
    e.state = 'FEED'; e.stateT = 0; e.eating = false; e.hold = false;
  }
  canFeed(e) { return e.T.model === 'zombie' && !e.crawler && !e.dead && e.t > (e.nextFeed || 0); }
  // an idle zombie looks round for one of the town's dead nobody is eating yet
  feedOnProp(e) {
    const list = this.game.W && this.game.W.corpses;
    if (!list || !this.canFeed(e) || e.hold || e.tunnel || e.pos.y > 0.6) return false;
    let best = null, bd = FEED_LOOK;
    for (const c of list) {
      if (!EDIBLE.has(c.k) || (c.eater && !c.eater.dead && c.eater.meal && c.eater.meal.c === c)) continue;
      const d = Math.hypot(c.x - e.pos.x, c.z - e.pos.z);
      if (d < bd) { bd = d; best = c; }
    }
    if (!best) return false;
    this._feed(e, best.x, best.z, 25 + Math.random() * 35, best, null);
    return true;
  }
  endFeed(e) {
    const m = e.meal;
    if (m && m.c && m.c.eater === e) m.c.eater = null;
    e.meal = null; e.eating = false;
    this.stopEat(e);
    if (m) e.nextFeed = e.t + 25 + Math.random() * 35;
  }
  stopEat(e) { if (e.eatSrc) { e.eatSrc.stop(); e.eatSrc = null; this.eatLoops--; } }
  // the eating sound, while it is feeding and you are near enough (and not shut in a building away from it)
  _eatSound(e, d) {
    const g = this.game;
    const want = e.state === 'FEED' && e.eating && !e.dead && g.audibleFrom(e.pos.x, e.pos.y, e.pos.z);
    if (e.eatSrc) { if (!want || d > FEED_HEAR + 2) this.stopEat(e); return; }
    if (!want || d > FEED_HEAR || (this.eatLoops || 0) >= FEED_LOOPS || !g.audio.has('zombieEat')) return;
    e.eatSrc = g.audio.loopAt('zombieEat', 0.8, [e.meal.cx, e.pos.y + 0.5, e.meal.cz], { ref: 2.2, rate: 0.95 + Math.random() * 0.1, verbAmt: 0.25 });
    if (e.eatSrc) this.eatLoops = (this.eatLoops || 0) + 1;
  }

  stopScream(e) {
    if (!e.screamSrc) return;
    try { e.screamSrc.stop(); } catch (err) { /* already finished */ }
    e.screamSrc = null;
  }

  kill(e, part, dir, src) {
    e.dead = true; e.deathT = 0;
    this.stopScream(e); this.endFeed(e);
    e.fallDir = dir ? (Math.cos(e.yaw) * dir.z + Math.sin(e.yaw) * dir.x > 0 ? -1 : 1) : 1;
    // the zombie models: knocked back when hit from the front, a slumping collapse otherwise
    e.dieClip = e.fallDir > 0 ? 'death' : 'dying';
    const g = this.game;
    g.audio.play(e.human ? 'flesh' : (e.type === 'brute' ? 'growlBig' : 'growl'), { pos: [e.pos.x, e.pos.y + 1.4, e.pos.z], vol: 0.6, rate: 0.7 });
    g.fx.bloodPool(e.pos.x, e.pos.y, e.pos.z, 1.2 + Math.random());
    if (src === 'player') g.stats.kills++;
    if (e.thief) g.dropFromThief(e); else if (e.human) g.dropFromHuman(e);
  }

  // ---------- perception ----------
  canSee(e, tx, ty, tz) {
    const ox = e.pos.x, oy = e.pos.y + 1.6 * e.scale, oz = e.pos.z;
    const dx = tx - ox, dy = ty - oy, dz = tz - oz, d = Math.hypot(dx, dy, dz);
    if (d < 0.01) return true;
    return !this.game.physics.raycast(ox, oy, oz, dx / d, dy / d, dz / d, d - 0.3);
  }

  hear(pos, radius, kind) {
    for (const e of this.list) {
      if (e.dead) continue;
      if (e.tunnel && !this.game.secret.underground) continue;
      const d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z);
      if (d > radius) continue;
      if (e.human) {
        if (e.thief) {
          if (e.state === 'PATROL' || e.state === 'WAIT' || e.state === 'SEARCH') { e.state = 'HEAR'; e.stateT = 0; e.investigate = { x: pos.x, z: pos.z }; }
        } else if (e.state === 'PATROL' || e.state === 'IDLE' || e.state === 'SEARCH') { e.state = 'HEAR'; e.stateT = 0; e.investigate = { x: pos.x, z: pos.z }; }
      } else if (e.zone && kind === 'gun' && d < radius * 0.75 && e.state !== 'CHASE' && e.state !== 'ATTACK') {
        // a gunshot near an ambush pack: the whole pack comes at once
        e.state = 'CHASE'; e.lastSeen = { x: pos.x, z: pos.z }; e.lostT = 0; e.nextGrowl = Math.random() * 2;
      } else if (e.state === 'IDLE' || e.state === 'ALERT') {
        e.state = 'ALERT'; e.investigate = { x: pos.x + (Math.random() - 0.5) * 6, z: pos.z + (Math.random() - 0.5) * 6 }; e.stateT = 0;
        if (kind === 'gun' && d < radius * 0.6 && Math.random() < 0.4 && e.nextGrowl > 1) e.nextGrowl = Math.random();
      }
    }
  }

  // Everyone in the same ambush pack (or within shouting distance) joins the chase.
  alertZone(src) {
    const P = this.game.player;
    for (const o of this.list) {
      if (o === src || o.dead || o.human || (o.state !== 'IDLE' && o.state !== 'ALERT')) continue;
      const dd = Math.hypot(o.pos.x - src.pos.x, o.pos.z - src.pos.z);
      if (dd > 25 || (dd > 9 && !(src.zone && o.zone === src.zone))) continue;
      o.state = 'CHASE'; o.lastSeen = { x: P.pos.x, z: P.pos.z }; o.lostT = 0; o.nextGrowl = Math.random() * 1.5; o.hold = false;
    }
  }

  // ---------- movement ----------
  move(e, dx, dz, speed, dt) {
    const g = this.game;
    const l = Math.hypot(dx, dz);
    if (l > 1e-3) { dx /= l; dz /= l; }
    // separation from neighbours
    for (const o of this.list) {
      if (o === e || o.dead) continue;
      const ox = e.pos.x - o.pos.x, oz = e.pos.z - o.pos.z, d2 = ox * ox + oz * oz;
      if (d2 < 0.64 && d2 > 1e-4 && Math.abs(o.pos.y - e.pos.y) < 1) { const d = Math.sqrt(d2); dx += ox / d * (0.8 - d) * 1.5; dz += oz / d * (0.8 - d) * 1.5; }
    }
    let vx = dx * speed, vz = dz * speed;
    // temple sanctuary: zombies refuse to step inside the compound
    if (!e.human && g.inSanctuary(e.pos.x + vx * 0.4, e.pos.z + vz * 0.4)) {
      if (!g.inSanctuary(e.pos.x, e.pos.z)) { vx = 0; vz = 0; e.blockedBySanctuary = true; }
    }
    e.vel.x = lerp(e.vel.x, vx, 1 - Math.exp(-dt * 8)); e.vel.z = lerp(e.vel.z, vz, 1 - Math.exp(-dt * 8));
    const ox = e.pos.x, oz = e.pos.z;
    g.physics.moveCharacter(e.pos, e.vel.x * dt, e.vel.z * dt, e.st.vy, dt, 0.3, 1.7 * e.scale, 0.45, e.st);
    const moved = Math.hypot(e.pos.x - ox, e.pos.z - oz);
    const want = Math.hypot(e.vel.x, e.vel.z) * dt;
    if (want > 0.005) {
      if (moved < want * 0.25) e.stuckT += dt; else e.stuckT = Math.max(0, e.stuckT - dt * 2);
      const ty = Math.atan2(-e.vel.x, -e.vel.z) + Math.PI;
      e.yaw += angleDiff(e.yaw, ty) * Math.min(1, dt * 6);
    }
    e.moveSpeed = moved / Math.max(dt, 1e-4);
    return moved;
  }

  // Head toward a point: flow field if it targets the player, else steer + slide.
  goTo(e, tx, tz, speed, dt, useFlow) {
    let dx = tx - e.pos.x, dz = tz - e.pos.z;
    if (useFlow) {
      const f = this.game.nav.flow(e.pos.x, e.pos.z);
      if (f && f[2] > 3) { dx = f[0]; dz = f[1]; }
    }
    if (e.sideT > 0) {
      e.sideT -= dt;
      const l = Math.hypot(dx, dz) || 1;
      dx = dx / l * 0.3 + (-dz / l) * e.side; dz = dz / l * 0.3 + (dx / l) * e.side;
    } else if (e.stuckT > 0.8) {
      // blocked: a door in the way?
      const door = this.game.doorNear(e.pos.x, e.pos.z, 1.4);
      if (door && !door.open) {
        if (e.human && !door.locked) this.game.openDoor(door, false);
        else { e.state = e.human ? e.state : 'BANG'; e.door = door; e.stateT = 0; }
      } else { e.sideT = 0.8; e.side = Math.random() < 0.5 ? -1 : 1; }
      e.stuckT = 0;
    }
    return this.move(e, dx, dz, speed, dt);
  }

  // ---------- main update ----------
  update(dt, cam) {
    const g = this.game, P = g.player;
    const px = P.pos.x, pz = P.pos.z, py = P.pos.y;
    const peye = py + P.eye;
    for (const e of this.list) {
      e.t += dt;
      if (e.dead) { e.deathT += dt; continue; }
      const d = Math.hypot(e.pos.x - px, e.pos.z - pz);
      e.dist = d;
      if (e.eatSrc && d > FEED_HEAR + 2) this.stopEat(e);
      if (e.frozen && d > 45) continue;
      e.frozen = false;
      // far enemies tick slower
      if (d > 70) { e.slowAcc = (e.slowAcc || 0) + dt; if (e.slowAcc < 0.25) continue; dt = e.slowAcc; e.slowAcc = 0; }
      e.stagger = Math.max(0, e.stagger - dt);
      e.flinch = Math.max(0, e.flinch - dt * 3);
      if (e.thief) this.updateThief(e, dt, d, px, pz, peye, P);
      else if (e.human) this.updateHuman(e, dt, d, px, pz, peye, P);
      else this.updateZombie(e, dt, d, px, pz, peye, P);
      dt = g.dt;
    }
    // remove old corpses
    for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].dead && this.list[i].deathT > 40) this.list.splice(i, 1);
    if (this.creatures) this.creatures.sweep(this.list);
    this.draw(cam);
  }

  updateZombie(e, dt, d, px, pz, peye, P) {
    const g = this.game, T = e.T;
    e.stateT += dt;
    if (e.meal && e.state !== 'FEED') this.endFeed(e);   // spotted you, shot, ...: it leaves the body
    // growls (not while its mouth is full: the eating is heard instead)
    e.nextGrowl -= dt;
    if (e.state === 'FEED' && e.eating) e.nextGrowl = Math.max(e.nextGrowl, 1);
    // heard only nearby (a chasing one a little further), and not at all from outside while the player is indoors
    if (e.nextGrowl <= 0 && d < (e.state === 'CHASE' ? 28 : 16) && g.audibleFrom(e.pos.x, e.pos.y, e.pos.z)) {
      const dog = e.type === 'hound';
      const sound = dog ? (e.state === 'CHASE' ? 'bark' : 'growl') : e.state === 'CHASE' && e.type === 'runner' ? 'scream' : T.growl === 'scream' ? 'growl' : T.growl;
      const cry = { pos: [e.pos.x, e.pos.y + (dog ? 0.8 : 1.6), e.pos.z], vol: e.state === 'CHASE' ? 0.9 : 0.55, rate: e.type === 'brute' || e.type === 'ghoul' ? 0.8 : dog ? 0.85 + Math.random() * 0.3 : 1, ref: 2.5, max: 30 };
      if (sound === 'scream') this.zombieScream(e, cry); else g.audio.play(sound, cry);
      // a runner's chase cry is a scream, so it comes much less often than the other growls
      e.nextGrowl = (e.state === 'CHASE' ? (e.type === 'runner' ? 7 : 2.5) : 6) + Math.random() * 6;
    }
    // perception (throttled line of sight)
    e.losT -= dt;
    let looked = false;
    if (!P.dead && d < 40 && e.losT <= 0) {
      e.losT = 0.25 + Math.random() * 0.15; looked = true;
      let sight = T.sight * (g.torchOn ? 1.6 : 1) * (P.crouched ? 0.6 : 1) * (g.playerLit ? 1.3 : 1);
      const hearing = P.noise * (e.type === 'runner' ? 1.4 : 1);
      const close = d < 2.5 || d < hearing;
      const facing = Math.abs(angleDiff(e.yaw, Math.atan2(px - e.pos.x, pz - e.pos.z))) < 1.5;
      e.sees = (close || (d < sight && (facing || d < sight * 0.4))) && this.canSee(e, px, peye, pz);
      if (e.sees) { e.lastSeen = { x: px, z: pz }; e.lostT = 0; e.prey = null; if (e.state !== 'CHASE' && e.state !== 'ATTACK') { e.state = 'CHASE'; e.hold = false; if (e.zone || Math.random() < 0.35) this.alertZone(e); if (e.type === 'runner') this.zombieScream(e, { pos: [e.pos.x, e.pos.y + 1.6, e.pos.z], vol: 0.9 }); if (T.roar && !e.roared) this.roar(e); } }
    }
    // no player in sight: a living person close by is food too (thieves and looters get torn into)
    if (looked && !e.sees && !e.hold && (e.state === 'IDLE' || e.state === 'ALERT')) {
      let best = null, bd = 9;
      for (const o of this.list) {
        if (!o.human || o.dead || o.tunnel !== e.tunnel || Math.abs(o.pos.y - e.pos.y) > 1.5) continue;
        const dd = Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z);
        if (dd < bd) { bd = dd; best = o; }
      }
      const cp = g.crew && g.crew.prey(e, bd);           // your crew smell like food too
      if (cp) { best = cp[0]; bd = cp[1]; }
      if (best && this.canSee(e, best.pos.x, best.pos.y + 1.4, best.pos.z)) { e.prey = best; e.state = 'HUNT'; e.stateT = 0; }
    }
    if (e.stagger > 0) { this.move(e, 0, 0, 0, dt); return; }
    const speedK = e.speedK * (1 - e.limp * 0.5);
    switch (e.state) {
      case 'IDLE': {
        if (e.stateT > 3 + Math.random() * 4) {
          e.stateT = 0; e.wanderYaw += (Math.random() - 0.5) * 2.5; e.idleWalk = Math.random() < 0.6;
          if (Math.random() < 0.4 && this.feedOnProp(e)) break;   // hungry: goes to eat one of the dead
        }
        if (e.hold) e.idleWalk = false;
        if (e.idleWalk && !e.hold) this.goTo(e, e.pos.x + Math.sin(e.wanderYaw) * 3, e.pos.z + Math.cos(e.wanderYaw) * 3, T.speed * 0.5 * speedK, dt, false);
        else this.move(e, 0, 0, 0, dt);
        break;
      }
      case 'ALERT': {
        if (!e.investigate) { e.state = 'IDLE'; break; }
        const dd = Math.hypot(e.investigate.x - e.pos.x, e.investigate.z - e.pos.z);
        if (dd < 1.5 || e.stateT > 25) { e.state = 'IDLE'; e.stateT = 0; break; }
        this.goTo(e, e.investigate.x, e.investigate.z, T.speed * speedK * 1.1, dt, false);
        break;
      }
      case 'CHASE': {
        if (P.dead) { e.state = 'IDLE'; break; }
        // the ghoul's roar / the hound's howl: it stands its ground for a moment, facing you
        if (e.roarT > 0) { e.roarT -= dt; this.move(e, 0, 0, 0, dt); e.yaw += angleDiff(e.yaw, Math.atan2(px - e.pos.x, pz - e.pos.z)) * Math.min(1, dt * 5); break; }
        if (!e.sees) { e.lostT = (e.lostT || 0) + dt; if (e.lostT > 8) { e.state = 'ALERT'; e.investigate = e.lastSeen; e.stateT = 0; } }
        const dy = Math.abs(P.pos.y - e.pos.y);
        // one of your crew is in the way: it goes for them
        const cv = g.crew && g.crew.victim(e, T.reach, dy < 1.3 ? d : 99);
        if (cv) { e.state = 'ATTACK'; e.attackT = T.wind; e.victim = cv; break; }
        if (d < T.reach && dy < 1.3) { e.state = 'ATTACK'; e.attackT = T.wind; e.victim = null; break; }
        // player upstairs in a building: head for its stairs
        let tx = e.lastSeen ? e.lastSeen.x : px, tz = e.lastSeen ? e.lastSeen.z : pz;
        let flow = e.sees || d < 25;
        if (dy > 1.6 && d < 14) { const s = g.stairFor(e, P); if (s) { tx = s[0]; tz = s[1]; flow = false; } }
        this.goTo(e, tx, tz, T.chase * speedK, dt, flow && (P.pos.y < 1.2 || !!g.outlands?.zone) && !e.tunnel);
        break;
      }
      case 'ATTACK': {
        const v = e.victim && !g.crew.isDown(e.victim) ? e.victim : null;
        this.move(e, 0, 0, 0, dt);
        e.yaw += angleDiff(e.yaw, Math.atan2((v ? v.pos.x : px) - e.pos.x, (v ? v.pos.z : pz) - e.pos.z)) * Math.min(1, dt * 8);
        e.attackT -= dt;
        if (e.attackT <= 0 && v) {
          if (Math.hypot(v.pos.x - e.pos.x, v.pos.z - e.pos.z) < T.reach + 0.4) { g.crew.hurt(v, T.dmg * (0.85 + Math.random() * 0.3)); g.audio.play('flesh', { pos: [v.pos.x, v.pos.y + 1.2, v.pos.z], vol: 0.7 }); }
          else g.audio.play('whoosh', { pos: [e.pos.x, e.pos.y + 1.2, e.pos.z], vol: 0.4 });
          e.state = 'CHASE'; e.recover = 0.4; e.victim = null;
        } else if (e.attackT <= 0) {
          if (d < T.reach + 0.35 && Math.abs(P.pos.y - e.pos.y) < 1.4 && !P.dead) {
            g.hurtPlayer(T.dmg * (0.85 + Math.random() * 0.3), e);
            g.audio.play('flesh', { pos: [px, P.pos.y + 1.2, pz], vol: 0.8 });
          } else g.audio.play('whoosh', { pos: [e.pos.x, e.pos.y + 1.2, e.pos.z], vol: 0.4 });
          e.state = 'CHASE'; e.recover = 0.4;
        }
        break;
      }
      case 'HUNT': {
        const h = e.prey, crew = !!(h && h.S);
        const hd = h ? Math.hypot(h.pos.x - e.pos.x, h.pos.z - e.pos.z) : 99;
        if (!h || (crew ? g.crew.isDown(h) : h.dead) || hd > 20 || e.stateT > 30) { e.state = 'ALERT'; e.investigate = h ? { x: h.pos.x, z: h.pos.z } : null; e.prey = null; e.stateT = 0; break; }
        if (hd < T.reach) {
          // same wind-up and cooldown as an attack on the player
          this.move(e, 0, 0, 0, dt);
          e.yaw += angleDiff(e.yaw, Math.atan2(h.pos.x - e.pos.x, h.pos.z - e.pos.z)) * Math.min(1, dt * 8);
          e.attackT = (e.attackT > 0 ? e.attackT : T.wind) - dt;
          e.huntAtk = true;
          if (e.attackT <= 0) {
            const dd = { x: (h.pos.x - e.pos.x) / (hd || 1), z: (h.pos.z - e.pos.z) / (hd || 1) };
            const killed = crew ? (g.crew.hurt(h, T.dmg), false) : this.damage(h, T.dmg * 1.5, 'body', dd, 'zombie');
            g.audio.play('flesh', { pos: [h.pos.x, h.pos.y + 1.2, h.pos.z], vol: 0.6 });
            e.attackT = T.wind + 0.6;
            // it brought them down: it crouches over them and eats (until the body is gone)
            if (killed && this.canFeed(e)) { e.nextFeed = 0; this._feed(e, h.pos.x, h.pos.z, 32, null, h); e.prey = null; }
          }
        } else { e.huntAtk = false; e.attackT = 0; this.goTo(e, h.pos.x, h.pos.z, T.chase * speedK, dt, false); }
        break;
      }
      case 'FEED': {
        const m = e.meal;
        if (!m || e.stateT > m.until || (m.body && !this.list.includes(m.body))) { this.endFeed(e); e.state = 'IDLE'; e.stateT = 0; break; }
        if (!e.eating) {
          // walking over to the body; it gives up if it can't get there
          if (Math.hypot(m.x - e.pos.x, m.z - e.pos.z) > 0.35 && e.stateT < 20) { this.goTo(e, m.x, m.z, T.speed * speedK, dt, false); break; }
          if (e.stateT >= 20) { this.endFeed(e); e.state = 'IDLE'; e.stateT = 0; break; }
          e.eating = true; e.stateT = 0;
        }
        this.move(e, 0, 0, 0, dt);
        e.yaw += angleDiff(e.yaw, Math.atan2(m.cx - e.pos.x, m.cz - e.pos.z)) * Math.min(1, dt * 4);
        break;
      }
      case 'BANG': {
        const door = e.door;
        if (!door || door.open || door.broken) { e.state = e.lastSeen ? 'CHASE' : 'IDLE'; break; }
        this.move(e, 0, 0, 0, dt);
        e.yaw += angleDiff(e.yaw, Math.atan2(door.cx - e.pos.x, door.cz - e.pos.z)) * Math.min(1, dt * 6);
        e.attackT -= dt;
        if (e.attackT <= 0) {
          e.attackT = 1.1 + Math.random() * 0.4;
          g.audio.play('bang', { pos: [door.cx, 1.2, door.cz], vol: 0.9 });
          door.hp -= e.type === 'brute' ? 40 : 9;
          if (door.hp <= 0) g.breakDoor(door);
        }
        if (d > 30 && e.stateT > 8) { e.state = 'IDLE'; }
        break;
      }
      default: e.state = 'IDLE';
    }
    this._eatSound(e, d);
  }

  updateHuman(e, dt, d, px, pz, peye, P) {
    const g = this.game, T = e.T;
    e.stateT += dt; e.coolT -= dt; e.throwT = Math.max(0, e.throwT - dt);
    // nearest threatening zombie
    let zt = null, zd = 14;
    for (const o of this.list) {
      if (o.human || o.dead) continue;
      const dd = Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z);
      if (dd < zd) { zd = dd; zt = o; }
    }
    // sight check for the player (stealth meter)
    e.losT -= dt;
    if (!P.dead && d < 50 && e.losT <= 0) {
      e.losT = 0.2;
      const vis = g.playerVisibility();
      const range = (8 + 34 * vis) * (P.crouched ? 0.65 : 1) * (P.speedNow > 4 ? 1.2 : 1);
      const ang = Math.abs(angleDiff(e.yaw, Math.atan2(px - e.pos.x, pz - e.pos.z)));
      const inCone = ang < 1.05 || d < 3;
      e.sees = d < range && inCone && this.canSee(e, px, peye, pz);
      if (e.sees) {
        e.lastSeen = { x: px, z: pz };
        e.alert = Math.min(1.2, e.alert + (0.2 + (1 - d / range)) * 0.55);
      } else e.alert = Math.max(0, e.alert - 0.04);
    }
    if (e.sees && e.alert >= 1 && !['ATTACK', 'COVER', 'RETREAT', 'DETECT'].includes(e.state)) {
      e.state = 'DETECT'; e.stateT = 0; e.react = 0.35 + Math.random() * 0.5;
      g.audio.play('beepLow', { pos: [e.pos.x, e.pos.y + 1.6, e.pos.z], vol: 0.01 });
    }
    const target = () => {
      // fight zombies that get close unless already locked on the player
      if (zt && (zd < 6 || (e.state !== 'ATTACK' && e.state !== 'COVER'))) return { x: zt.pos.x, y: zt.pos.y + 1.3, z: zt.pos.z, z_: zt };
      return { x: px, y: peye - 0.35, z: pz, z_: null };
    };
    const speed = T.speed * e.speedK;
    switch (e.state) {
      case 'IDLE':
      case 'PATROL': {
        if (zt && zd < 12 && this.canSee(e, zt.pos.x, zt.pos.y + 1.3, zt.pos.z)) { this.shootAt(e, target(), dt); this.move(e, 0, 0, 0, dt); break; }
        if (!e.route || !e.route.length) { this.move(e, 0, 0, 0, dt); break; }
        const wp = e.route[e.routeI % e.route.length];
        const dd = Math.hypot(wp[0] - e.pos.x, wp[1] - e.pos.z);
        if (dd < 1.2) { e.pause = (e.pause || 0) + dt; this.move(e, 0, 0, 0, dt); e.yaw += Math.sin(e.t * 0.8) * dt * 0.8; if (e.pause > 2.5) { e.pause = 0; e.routeI++; } }
        else this.goTo(e, wp[0], wp[1], speed * 0.8, dt, false);
        break;
      }
      case 'HEAR': {
        this.move(e, 0, 0, 0, dt);
        if (e.investigate) e.yaw += angleDiff(e.yaw, Math.atan2(e.investigate.x - e.pos.x, e.investigate.z - e.pos.z)) * Math.min(1, dt * 4);
        if (e.stateT > 1.2) { e.state = 'INVESTIGATE'; e.stateT = 0; }
        break;
      }
      case 'INVESTIGATE': {
        if (!e.investigate) { e.state = 'PATROL'; break; }
        const dd = Math.hypot(e.investigate.x - e.pos.x, e.investigate.z - e.pos.z);
        if (dd < 2 || e.stateT > 20) { e.state = 'SEARCH'; e.stateT = 0; e.lastSeen = e.investigate; break; }
        this.goTo(e, e.investigate.x, e.investigate.z, speed * 1.1, dt, false);
        break;
      }
      case 'DETECT': {
        this.move(e, 0, 0, 0, dt);
        e.yaw += angleDiff(e.yaw, Math.atan2(px - e.pos.x, pz - e.pos.z)) * Math.min(1, dt * 6);
        e.react -= dt;
        if (e.react <= 0) { e.state = 'ATTACK'; e.stateT = 0; e.burstLeft = e.gun.burst; g.noise(e.pos, 30, 'shout'); }
        break;
      }
      case 'ATTACK': {
        const tg = target();
        const seeT = tg.z_ ? this.canSee(e, tg.x, tg.y, tg.z) : e.sees;
        if (P.dead && !tg.z_) { e.state = 'PATROL'; break; }
        if (seeT) {
          e.aimT += dt;
          // strafe a little while shooting
          const sx = Math.cos(e.t * 0.9) * 0.6;
          const ang = Math.atan2(tg.x - e.pos.x, tg.z - e.pos.z);
          this.move(e, Math.cos(ang) * sx, -Math.sin(ang) * sx, speed * 0.5, dt);
          e.yaw = e.yaw + angleDiff(e.yaw, ang) * Math.min(1, dt * 8);
          this.shootAt(e, tg, dt);
          if (e.burstLeft <= 0 && !tg.z_) { e.state = 'COVER'; e.stateT = 0; e.cover = this.findCover(e, px, peye, pz); }
        } else {
          e.aimT = 0;
          // you went behind cover: a looter with a bomb lobs it over to flush you out
          if (e.bomb > 0 && !tg.z_ && e.lastSeen && e.stateT > 1.2 && !P.dead) {
            const dd = Math.hypot(e.lastSeen.x - e.pos.x, e.lastSeen.z - e.pos.z);
            if (dd > 7 && dd < 26) this.lobBomb(e, e.lastSeen);
          }
          // reposition toward last known position
          if (e.lastSeen) {
            const dd = Math.hypot(e.lastSeen.x - e.pos.x, e.lastSeen.z - e.pos.z);
            if (dd < 2 || e.stateT > 12) { e.state = 'SEARCH'; e.stateT = 0; }
            else this.goTo(e, e.lastSeen.x, e.lastSeen.z, speed * 1.2, dt, d < 60);
          } else e.state = 'SEARCH';
        }
        break;
      }
      case 'COVER': {
        const c = e.cover;
        if (!c) { e.state = 'ATTACK'; e.burstLeft = e.gun.burst; break; }
        const dd = Math.hypot(c[0] - e.pos.x, c[1] - e.pos.z);
        if (dd > 0.6 && e.stateT < 5) this.goTo(e, c[0], c[1], T.chase * e.speedK, dt, false);
        else {
          this.move(e, 0, 0, 0, dt);
          e.yaw += angleDiff(e.yaw, Math.atan2(px - e.pos.x, pz - e.pos.z)) * Math.min(1, dt * 4);
          if (e.stateT > 1.6 + Math.random() * 1.5) { e.state = 'ATTACK'; e.stateT = 0; e.burstLeft = e.gun.burst + (Math.random() * 2 | 0); e.aimT = 0; }
        }
        break;
      }
      case 'SEARCH': {
        const c = e.lastSeen || e.home;
        if (!e.searchPt || e.searchT <= 0) { e.searchPt = [c.x + (Math.random() - 0.5) * 14, c.z + (Math.random() - 0.5) * 14]; e.searchT = 4; }
        e.searchT -= dt;
        this.goTo(e, e.searchPt[0], e.searchPt[1], speed, dt, false);
        if (e.stateT > 22) { e.state = 'PATROL'; e.alert = 0; e.stateT = 0; }
        break;
      }
      case 'RETREAT': {
        const ax = e.pos.x - px, az = e.pos.z - pz, l = Math.hypot(ax, az) || 1;
        this.goTo(e, e.pos.x + ax / l * 8, e.pos.z + az / l * 8, T.chase * 1.1, dt, false);
        if (e.sees && e.coolT <= 0 && Math.random() < 0.02) { e.burstLeft = 1; this.shootAt(e, target(), dt); }
        if (d > 35 || e.stateT > 10) { e.state = 'COVER'; e.cover = this.findCover(e, px, peye, pz); e.stateT = 0; }
        break;
      }
      default: e.state = 'PATROL';
    }
  }

  // ---------- thieves (chor): sneak, rush, stab, grab food and run ----------
  updateThief(e, dt, d, px, pz, peye, P) {
    const g = this.game, T = e.T;
    e.stateT += dt;
    // eyes: same stealth rules as armed humans, but a shorter reach in the dark
    e.losT -= dt;
    if (!P.dead && d < 45 && e.losT <= 0) {
      e.losT = 0.2;
      const vis = g.playerVisibility();
      const range = (7 + 26 * vis) * (P.crouched ? 0.65 : 1) * (P.speedNow > 4 ? 1.2 : 1);
      const ang = Math.abs(angleDiff(e.yaw, Math.atan2(px - e.pos.x, pz - e.pos.z)));
      e.sees = (d < 3 || (d < range && ang < 1.2) || d < P.noise) && this.canSee(e, px, peye, pz);
      if (e.sees) { e.lastSeen = { x: px, z: pz }; e.alert = Math.min(1.2, e.alert + 0.5); } else e.alert = Math.max(0, e.alert - 0.05);
    }
    if (e.stagger > 0) { this.move(e, 0, 0, 0, dt); return; }
    if (e.sees && e.alert >= 0.8 && ['PATROL', 'WAIT', 'HEAR', 'INVESTIGATE', 'SEARCH'].includes(e.state)) {
      e.state = 'DETECT'; e.stateT = 0; e.react = 0.25 + Math.random() * 0.3; e.hold = false;
    }
    const speed = T.speed * e.speedK;
    // a zombie right on top of a thief: he bolts (they carry knives, not guns)
    if (e.flinch > 0.2 && e.lastHitBy === 'zombie' && e.state !== 'FLEE' && e.state !== 'ATTACK') { e.state = 'FLEE'; e.stateT = 0; e.fleeFrom = e.lastHitPos; }
    switch (e.state) {
      case 'WAIT': {
        this.move(e, 0, 0, 0, dt);
        e.yaw += Math.sin(e.t * 0.6) * dt * 0.5;
        break;
      }
      case 'PATROL': {
        if (!e.route || !e.route.length) {
          // no route: loiter around home
          if (e.stateT > 4) { e.stateT = 0; e.wp = [e.home.x + (Math.random() - 0.5) * 12, e.home.z + (Math.random() - 0.5) * 12]; }
          if (e.wp && Math.hypot(e.wp[0] - e.pos.x, e.wp[1] - e.pos.z) > 1.2) this.goTo(e, e.wp[0], e.wp[1], speed * 0.7, dt, false);
          else this.move(e, 0, 0, 0, dt);
          break;
        }
        const wp = e.route[e.routeI % e.route.length];
        if (Math.hypot(wp[0] - e.pos.x, wp[1] - e.pos.z) < 1.3) { e.pause = (e.pause || 0) + dt; this.move(e, 0, 0, 0, dt); if (e.pause > 1.5) { e.pause = 0; e.routeI++; } }
        else this.goTo(e, wp[0], wp[1], speed * 0.75, dt, false);
        break;
      }
      case 'HEAR': {
        this.move(e, 0, 0, 0, dt);
        if (e.investigate) e.yaw += angleDiff(e.yaw, Math.atan2(e.investigate.x - e.pos.x, e.investigate.z - e.pos.z)) * Math.min(1, dt * 4);
        if (e.stateT > 0.8) { e.state = 'INVESTIGATE'; e.stateT = 0; }
        break;
      }
      case 'INVESTIGATE': {
        if (!e.investigate) { e.state = 'PATROL'; break; }
        if (Math.hypot(e.investigate.x - e.pos.x, e.investigate.z - e.pos.z) < 2 || e.stateT > 18) { e.state = 'SEARCH'; e.stateT = 0; break; }
        this.goTo(e, e.investigate.x, e.investigate.z, speed * 1.1, dt, false);
        break;
      }
      case 'SEARCH': {
        const c = e.lastSeen || e.home;
        if (!e.searchPt || e.searchT <= 0) { e.searchPt = [c.x + (Math.random() - 0.5) * 10, c.z + (Math.random() - 0.5) * 10]; e.searchT = 3.5; }
        e.searchT -= dt;
        this.goTo(e, e.searchPt[0], e.searchPt[1], speed, dt, false);
        if (e.stateT > 16) { e.state = e.route ? 'PATROL' : 'WAIT'; e.alert = 0; e.stateT = 0; }
        break;
      }
      case 'DETECT': {
        this.move(e, 0, 0, 0, dt);
        e.yaw += angleDiff(e.yaw, Math.atan2(px - e.pos.x, pz - e.pos.z)) * Math.min(1, dt * 7);
        e.react -= dt;
        if (e.react <= 0) { e.state = 'CHASE'; e.stateT = 0; g.noise(e.pos, 14, 'shout'); }
        break;
      }
      case 'CHASE': {
        if (P.dead) { e.state = 'SEARCH'; break; }
        if (e.sees) e.lostT = 0; else { e.lostT = (e.lostT || 0) + dt; if (e.lostT > 9) { e.state = 'SEARCH'; e.stateT = 0; break; } }
        const dy = Math.abs(P.pos.y - e.pos.y);
        if (d < T.reach && dy < 1.3) { e.state = 'ATTACK'; e.attackT = T.wind; break; }
        let tx = e.lastSeen ? e.lastSeen.x : px, tz = e.lastSeen ? e.lastSeen.z : pz, flow = e.sees || d < 25;
        if (dy > 1.6 && d < 14) { const st = g.stairFor(e, P); if (st) { tx = st[0]; tz = st[1]; flow = false; } }
        this.goTo(e, tx, tz, T.chase * e.speedK * 0.9, dt, flow && P.pos.y < 1.2 && !e.tunnel);
        break;
      }
      case 'ATTACK': {
        this.move(e, 0, 0, 0, dt);
        e.yaw += angleDiff(e.yaw, Math.atan2(px - e.pos.x, pz - e.pos.z)) * Math.min(1, dt * 9);
        e.attackT -= dt;
        if (e.attackT <= 0) {
          if (d < T.reach + 0.4 && Math.abs(P.pos.y - e.pos.y) < 1.4 && !P.dead) {
            g.hurtPlayer(T.dmg * (0.85 + Math.random() * 0.3), e);
            g.audio.play('flesh', { pos: [px, P.pos.y + 1.2, pz], vol: 0.8 });
            // snatch a bite of food and run
            if (!e.loot && g.food.length && Math.random() < 0.55) {
              e.loot = g.food.splice((Math.random() * g.food.length) | 0, 1)[0];
              g.toast('चोर ने खाना चुरा लिया!', 'A thief snatched food from your bag — kill him to get it back.');
              g.updateHud && g.updateHud();
              e.state = 'FLEE'; e.stateT = 0; break;
            }
          } else g.audio.play('whoosh', { pos: [e.pos.x, e.pos.y + 1.2, e.pos.z], vol: 0.4 });
          e.state = 'CHASE'; e.stateT = 0;
        }
        break;
      }
      case 'FLEE': {
        const from = e.fleeFrom && e.stateT < 4 ? e.fleeFrom : { x: px, z: pz };
        const ax = e.pos.x - from.x, az = e.pos.z - from.z, l = Math.hypot(ax, az) || 1;
        this.goTo(e, e.pos.x + ax / l * 10, e.pos.z + az / l * 10, T.chase * 1.1, dt, false);
        if (e.stateT > 9 || d > 45) { e.state = 'SEARCH'; e.stateT = 0; e.alert = 0; e.fleeFrom = null; }
        break;
      }
      default: e.state = e.route ? 'PATROL' : 'WAIT';
    }
  }

  lobBomb(e, tgt) {
    const g = this.game, P = g.player;
    e.bomb--; e.throwT = 0.5;
    e.yaw = Math.atan2(tgt.x - e.pos.x, tgt.z - e.pos.z);
    const from = new THREE.Vector3(e.pos.x + Math.sin(e.yaw) * 0.4, e.pos.y + 1.7 * e.scale, e.pos.z + Math.cos(e.yaw) * 0.4);
    // not a perfect throw: lands within a couple of metres of where you were
    const tx = tgt.x + (Math.random() - 0.5) * 3.5, tz = tgt.z + (Math.random() - 0.5) * 3.5;
    const dx = tx - from.x, dz = tz - from.z, T = clamp(Math.hypot(dx, dz) / 11, 0.75, 1.7), G = 16;
    const vel = new THREE.Vector3(dx / T, (P.pos.y + 0.1 - from.y) / T + 0.5 * G * T, dz / T);
    g.explosives.throwBomb(from, vel, 'human', BOMB.enemyFuse);
    g.audio.play('whoosh', { pos: [from.x, from.y, from.z], vol: 0.6, rate: 0.9 });
    g.noise(e.pos, 14, 'shout');
  }

  findCover(e, px, peye, pz) {
    const g = this.game;
    let best = null, bestScore = 1e9;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3, r = 2.5 + Math.random() * 7;
      const cx = e.pos.x + Math.sin(a) * r, cz = e.pos.z + Math.cos(a) * r;
      if (!g.nav.free(cx, cz)) continue;
      const dp = Math.hypot(cx - px, cz - pz);
      if (dp < 7) continue;
      const dx = px - cx, dy = peye - (e.pos.y + 1.2), dz = pz - cz, l = Math.hypot(dx, dy, dz);
      const hidden = g.physics.raycast(cx, e.pos.y + 1.2, cz, dx / l, dy / l, dz / l, l - 0.5);
      if (!hidden) continue;
      const score = r + Math.abs(dp - 15) * 0.3;
      if (score < bestScore) { bestScore = score; best = [cx, cz]; }
    }
    return best;
  }

  shootAt(e, tg, dt) {
    const g = this.game, gun = e.gun;
    if (e.coolT > 0 || e.burstLeft <= 0 && tg.z_ === null) return;
    if (tg.z_ && e.burstLeft <= 0) e.burstLeft = gun.burst;
    e.coolT = gun.rate * (0.8 + Math.random() * 0.5);
    e.burstLeft--;
    if (e.burstLeft <= 0 && tg.z_) e.coolT += 0.8;
    const muzzle = [e.pos.x + Math.sin(e.yaw) * 0.5, e.pos.y + 1.4 * e.scale, e.pos.z + Math.cos(e.yaw) * 0.5];
    g.audio.play(gun.sound, { pos: muzzle, vol: 1, far: 25, roll: 0.8, max: 300 });
    g.noise(e.pos, 70, 'gun');
    e.shotFlash = 0.06;
    g.enemyMuzzle(muzzle);
    const dx = tg.x - muzzle[0], dy = tg.y - muzzle[1], dz = tg.z - muzzle[2];
    const dist = Math.hypot(dx, dy, dz);
    if (tg.z_) {
      // shooting at a zombie
      if (Math.random() < 0.55) this.damage(tg.z_, gun.dmg * 2.2, Math.random() < 0.2 ? 'head' : 'body', { x: dx / dist, z: dz / dist }, 'human');
      g.fx.tracer(muzzle, [tg.x, tg.y, tg.z]);
      return;
    }
    const P = g.player;
    let hit = 0.5 - dist * 0.011 - Math.min(0.25, P.speedNow * 0.04) - (P.crouched ? 0.1 : 0) + Math.min(0.2, e.aimT * 0.08);
    if (g.playerVisibility() < 0.4) hit -= 0.12;
    hit = clamp(hit, 0.06, 0.8);
    if (Math.random() < hit) {
      g.hurtPlayer(gun.dmg * (0.8 + Math.random() * 0.4), e);
      g.fx.tracer(muzzle, [tg.x, tg.y, tg.z]);
    } else {
      // miss: bullet cracks past and hits the world near the player
      const ox = (Math.random() - 0.5) * 2.2, oy = (Math.random() - 0.3) * 1.2, oz = (Math.random() - 0.5) * 2.2;
      const ex = tg.x + ox - muzzle[0], ey = tg.y + oy - muzzle[1], ez = tg.z + oz - muzzle[2], el = Math.hypot(ex, ey, ez);
      const h = g.physics.raycast(muzzle[0], muzzle[1], muzzle[2], ex / el, ey / el, ez / el, 120);
      const end = h ? [muzzle[0] + ex / el * h.t, muzzle[1] + ey / el * h.t, muzzle[2] + ez / el * h.t] : [tg.x + ox * 3, tg.y + oy, tg.z + oz * 3];
      g.fx.tracer(muzzle, end);
      if (h) { g.fx.hole(end, [h.nx, h.ny, h.nz]); g.fx.burst(end, [h.nx, h.ny, h.nz], 5, [0.7, 0.65, 0.55], 1.5); g.audio.play(Math.random() < 0.3 ? 'ricochet' : 'wall', { pos: end, vol: 0.6 }); }
    }
  }

  // ---------- pose + instancing ----------
  draw(cam) {
    const R = this.rig, im = this.im;
    const imF = this.imFar;
    const counts = { head: 0, hair: 0, cap: 0, wrap: 0, eyes: 0, chest: 0, gore: 0, pelvis: 0, ua: 0, fa: 0, th: 0, sn: 0, gun: 0, knife: 0 };
    const countsF = { head: 0, chest: 0, pelvis: 0, ua: 0, fa: 0, th: 0, sn: 0 };
    const c = this._c;
    let lod = false;
    const put = (key, node, col) => {
      const far = lod && imF[key], set = far ? imF : im, cnt = far ? countsF : counts;
      const i = cnt[key]++;
      set[key].setMatrixAt(i, node.matrixWorld);
      set[key].setColorAt(i, c.set(col));
    };
    const cx = cam.position.x, cz = cam.position.z;
    let ns = 0;
    const sh = this.shadow, m = this._m, q = this._q, sv = this._s3, v = this._v;
    const models = this._models || (this._models = []); models.length = 0;
    for (const e of this.list) {
      const far = Math.hypot(e.pos.x - cx, e.pos.z - cz);
      if (far > 105) { e.hs.length = 0; continue; }
      // the zombies and hounds have bodies of their own (a zombie whose model is still downloading keeps the box body)
      if (e.T.model) {
        if (this.creatures && this.creatures.has(e.mkind)) { models.push(e); continue; }
        if (e.T.model !== 'zombie') { e.hs.length = 0; continue; }
      }
      this.pose(e);
      R.root.updateMatrixWorld(true);
      const col = e.colors;
      lod = far > 30;
      put('head', R.head, col.skin); put('chest', R.chest, col.top); put('pelvis', R.pelvis, col.legs);
      for (let i = 0; i < 2; i++) {
        put('ua', R.ua[i], e.human ? col.top : col.skin); put('fa', R.fa[i], col.fa);
        put('th', R.th[i], col.legs); put('sn', R.sn[i], col.legs);
      }
      // far away only what reads at a distance: the thief's bright mask, guns, the zombies' eyes
      if (e.thief) { put('wrap', R.head, col.wrap); if (!lod) put('knife', R.knife, 0xffffff); }
      else if (e.human) { if (!lod) { if (col.cap) put('cap', R.head, col.cap); else put('hair', R.head, col.hair); } put('gun', R.gun, 0xffffff); }
      else {
        if (!col.bald && !lod) put('hair', R.head, col.hair);
        if (!lod) put('gore', R.chest, col.gore);
        if (!e.dead) put('eyes', R.head, col.eye);
      }
      // contact shadow on the ground under the pelvis
      if (far < 60) {
        v.setFromMatrixPosition(R.pelvis.matrixWorld);
        const k = e.dead ? 1.5 : 0.95;
        sv.set(k * e.scale, 1, (e.dead ? 1.9 : 0.75) * e.scale); q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, e.yaw);
        v.y = e.pos.y + 0.03;
        m.compose(v, q, sv); sh.setMatrixAt(ns++, m);
      }
      // hit spheres
      if (!e.dead) {
        const hs = e.hs; hs.length = 0;
        const add = (node, r, part) => { v.setFromMatrixPosition(node.matrixWorld); hs.push([v.x, v.y, v.z, r * e.scale, part]); };
        add(R.head, 0.15, 'head'); add(R.chest, 0.26, 'body'); add(R.pelvis, 0.22, 'body');
        add(R.th[0], 0.12, 'leg'); add(R.th[1], 0.12, 'leg'); add(R.sn[0], 0.11, 'leg'); add(R.sn[1], 0.11, 'leg');
        add(R.ua[0], 0.09, 'arm'); add(R.ua[1], 0.09, 'arm');
        v.setFromMatrixPosition(R.head.matrixWorld); e.headPos = [v.x, v.y, v.z];
      }
    }
    if (this.creatures) {
      this.creatures.draw(models, cam, this.game.dt || 0.016);
      for (const e of models) {
        if (!e._inst && !e._far) { e.hs.length = 0; continue; }
        if (Math.hypot(e.pos.x - cx, e.pos.z - cz) > 60 || ns >= MAX) continue;
        const dog = e.type === 'hound';
        v.set(e.pos.x, e.pos.y + 0.03, e.pos.z);
        sv.set((dog ? (e.dead ? 1.1 : 0.7) : (e.dead ? 1.5 : 0.95)) * e.scale, 1, (dog ? 1.5 : e.dead ? 1.9 : 0.75) * e.scale);
        q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, e.yaw); m.compose(v, q, sv); sh.setMatrixAt(ns++, m);
      }
    }
    for (const k in im) {
      im[k].count = counts[k]; im[k].visible = counts[k] > 0;
      im[k].instanceMatrix.needsUpdate = true;
      if (im[k].instanceColor) im[k].instanceColor.needsUpdate = true;
    }
    for (const k in imF) {
      imF[k].count = countsF[k]; imF[k].visible = countsF[k] > 0;
      imF[k].instanceMatrix.needsUpdate = true;
      if (imF[k].instanceColor) imF[k].instanceColor.needsUpdate = true;
    }
    sh.count = ns; sh.visible = ns > 0; sh.instanceMatrix.needsUpdate = true;
  }

  pose(e) {
    const R = this.rig;
    R.root.position.set(e.pos.x, e.pos.y, e.pos.z);
    R.root.rotation.set(0, e.yaw, 0);
    R.root.scale.setScalar(e.scale);
    const sp = e.dead ? 0 : (e.moveSpeed || 0);
    const run = Math.min(1, sp / 4);
    e.phase += (sp * 2.2 + 0.0001) * (this.game.dt || 0.016) * (e.human ? 1 : 0.9);
    const ph = e.phase, sw = Math.min(1, sp / 1.2);
    const legA = Math.sin(ph) * (0.45 + run * 0.35) * sw;
    // reset
    R.body.position.set(0, 0, 0); R.body.rotation.set(0, 0, 0);
    R.spine.rotation.set(0, 0, 0); R.neck.rotation.set(0, 0, 0);
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      R.hip[i].rotation.set(legA * s, 0, 0);
      R.kn[i].rotation.set(Math.max(0, -Math.sin(ph + (i ? Math.PI : 0) + 0.8)) * 0.9 * sw, 0, 0);
      R.sh[i].rotation.set(0, 0, 0); R.el[i].rotation.set(0, 0, 0);
    }
    R.body.position.y = Math.abs(Math.cos(ph)) * 0.04 * sw;
    const fl = e.flinch;
    if (!e.human) {
      // zombie: arms reaching forward, head lolling, lurching gait
      const reach = e.state === 'CHASE' || e.state === 'ATTACK' || e.state === 'HUNT' ? 1 : 0.55;
      for (let i = 0; i < 2; i++) {
        const s = i ? 1 : -1;
        R.sh[i].rotation.set(-1.35 * reach + Math.sin(e.t * 2 + i) * 0.12 + legA * 0.2 * s, 0, s * 0.12);
        R.el[i].rotation.set(-0.25 - Math.sin(e.t * 1.7 + i * 2) * 0.15, 0, 0);
      }
      R.spine.rotation.set(0.18 + (e.type === 'runner' ? 0.25 * run : 0) - fl * 0.5, Math.sin(ph) * 0.12, Math.sin(e.t * 0.7) * 0.08 + e.limp * 0.15);
      R.neck.rotation.set(0.15 + Math.sin(e.t * 1.3) * 0.12, Math.sin(e.t * 0.5) * 0.3, Math.sin(e.t * 0.9) * 0.25);
      if (e.state === 'ATTACK' || (e.state === 'HUNT' && e.huntAtk)) {
        const k = clamp(1 - Math.max(0, e.attackT) / e.T.wind, 0, 1);
        for (let i = 0; i < 2; i++) R.sh[i].rotation.x = -1.2 - Math.sin(k * Math.PI) * 0.9;
        R.spine.rotation.x = 0.1 + Math.sin(k * Math.PI) * 0.35;
      }
      if (e.state === 'BANG') { const k = Math.sin(e.t * 6); for (let i = 0; i < 2; i++) R.sh[i].rotation.x = -1.9 - k * 0.5; }
      else if (e.limpArm >= 0 && e.state !== 'ATTACK') {
        // a dead arm swinging loose at the side
        const i = e.limpArm, s = i ? 1 : -1;
        R.sh[i].rotation.set(-0.1 + Math.sin(ph + i * Math.PI) * 0.25 * sw, 0, s * 0.1);
        R.el[i].rotation.set(-0.15 - Math.sin(e.t * 1.3) * 0.08, 0, 0);
      }
      if (e.limp) R.hip[0].rotation.x *= 1 - e.limp;
    } else {
      // human: gun held forward, aim when attacking
      const aiming = ['ATTACK', 'COVER', 'DETECT', 'RETREAT'].includes(e.state);
      R.sh[1].rotation.set(aiming ? -1.45 : -0.6, aiming ? 0.15 : 0, 0);
      R.el[1].rotation.set(aiming ? -0.1 : -0.7, 0, 0);
      R.sh[0].rotation.set(aiming ? -1.35 : -0.5, aiming ? -0.5 : 0, 0);
      R.el[0].rotation.set(aiming ? -0.35 : -0.9, 0, 0);
      R.spine.rotation.set(-fl * 0.4, aiming ? 0.05 : 0, 0);
      if (e.thief) {
        const chasing = e.state === 'CHASE' || e.state === 'FLEE' || e.state === 'DETECT';
        R.sh[0].rotation.set(chasing ? -0.5 : -0.2, 0, 0); R.el[0].rotation.set(-0.5, 0, 0);
        R.sh[1].rotation.set(chasing ? -1.0 : -0.5, 0, 0); R.el[1].rotation.set(-0.5, 0, 0);
        R.spine.rotation.x = chasing ? 0.3 - fl * 0.4 : -fl * 0.4;
        if (e.state === 'ATTACK') { const k = 1 - Math.max(0, e.attackT) / e.T.wind; R.sh[1].rotation.x = -1.0 - Math.sin(k * Math.PI) * 1.2; R.spine.rotation.x = 0.1 + Math.sin(k * Math.PI) * 0.4; }
        // not yet onto you: a low, sneaking crouch with the knife held close
        if (!e.dead && ['PATROL', 'WAIT', 'HEAR', 'INVESTIGATE', 'SEARCH'].includes(e.state)) {
          R.body.position.y -= 0.1;
          for (let i = 0; i < 2; i++) { R.hip[i].rotation.x = R.hip[i].rotation.x * 0.7 - 0.55; R.kn[i].rotation.x += 0.85; }
          R.spine.rotation.x += 0.38; R.neck.rotation.x -= 0.32;
          R.sh[1].rotation.x = -0.75; R.el[1].rotation.x = -0.9;
        }
      }
      if (e.state === 'COVER' && e.stateT > 0.5) { R.body.position.y = -0.35; R.hip[0].rotation.x = -1.2; R.hip[1].rotation.x = -0.2; R.kn[0].rotation.x = 1.6; R.kn[1].rotation.x = 1.4; }
      if (!aiming && !e.thief) { R.sh[0].rotation.x += legA * 0.4; }
      // overarm bomb throw with the free (left) arm
      if (e.throwT > 0) { const k = e.throwT / 0.5; R.sh[0].rotation.set(-0.6 - 2.4 * k, 0, -0.2); R.el[0].rotation.set(-0.8 * k, 0, 0); R.spine.rotation.x += 0.25 * (1 - k) - 0.15 * k; }
    }
    if (e.dead) {
      // fall: rotate the whole body around the feet, then sink slowly much later
      const k = Math.min(1, e.deathT / 0.65);
      const ease = k * k * (3 - 2 * k);
      R.body.rotation.x = e.fallDir * ease * 1.5;
      R.body.position.y = -ease * 0.08 - Math.max(0, e.deathT - 30) * 0.06;
      for (let i = 0; i < 2; i++) { R.sh[i].rotation.x = -0.4 - ease * 1.2; R.kn[i].rotation.x = ease * 0.4 * (i ? 1 : 0.2); }
      R.neck.rotation.x = 0.5 * ease;
    }
  }
}
