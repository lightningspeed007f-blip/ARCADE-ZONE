// Weapons: stats, first-person models, firing, reloading, recoil, spread,
// muzzle flash, ejected casings, impacts and the bamboo lathi for melee.
import * as THREE from 'three';
import { clamp, lerp } from './util.js';
import { part, merge } from './props.js';

export const AMMO = { '9mm': '9mm', '.32': '.32', '12G': '12 बोर', '7.62': '7.62', rocket: 'रॉकेट', mg: 'MG' };

// rpm = rounds per minute, spread/recoil in degrees
export const WEAPONS = {
  lathi:    { name: 'मुक्का', en: 'FISTS', melee: true, dmg: 34, rpm: 95, range: 2.3, sound: 'whoosh' },
  katta:    { name: 'देसी कट्टा', en: 'KATTA', ammo: '12G', mag: 1, dmg: 95, pellets: 1, rpm: 70, reload: 2.3, spread: 2.0, adsSpread: 0.9, recoil: 5.5, noise: 95, sound: 'katta', fov: 62 },
  pistol:   { name: '9mm पिस्टल', en: 'PISTOL', ammo: '9mm', mag: 12, dmg: 30, pellets: 1, rpm: 330, reload: 1.5, spread: 1.1, adsSpread: 0.35, recoil: 1.7, noise: 70, sound: 'pistol', fov: 60 },
  revolver: { name: '.32 रिवॉल्वर', en: 'REVOLVER', ammo: '.32', mag: 6, dmg: 48, pellets: 1, rpm: 150, reload: 2.9, spread: 0.8, adsSpread: 0.25, recoil: 2.8, noise: 75, sound: 'revolver', fov: 58 },
  dunali:   { name: 'दुनाली बंदूक', en: 'DOUBLE BARREL', ammo: '12G', mag: 2, dmg: 15, pellets: 9, rpm: 160, reload: 2.6, spread: 4.2, adsSpread: 3.2, recoil: 6, noise: 100, sound: 'shotgun', fov: 62 },
  rifle:    { name: 'राइफल', en: 'RIFLE', ammo: '7.62', mag: 30, dmg: 27, pellets: 1, rpm: 600, auto: true, reload: 2.5, spread: 1.6, adsSpread: 0.3, recoil: 1.15, noise: 90, sound: 'rifle', fov: 48 },
  // fires a real projectile (see explosives.js); one rocket in the tube, slow reload
  rpg:      { name: 'रॉकेट लॉन्चर', en: 'ROCKET LAUNCHER', ammo: 'rocket', mag: 1, dmg: 0, pellets: 1, rocket: true, rpm: 45, reload: 3.0, spread: 0.9, adsSpread: 0.25, recoil: 7.5, noise: 120, sound: 'rocket', fov: 56, ads: [0.12, -0.125, -0.5] },
  // the machine gun (falls from the sky in the hidden Kalidham): one 200-round belt and that is all
  // you ever get. No reload, no spare ammo anywhere in the game, so every round counts.
  mg:       { name: 'मशीन गन', en: 'MACHINE GUN', ammo: 'mg', mag: 200, noReload: true, dmg: 50, pellets: 1, rpm: 720, auto: true, reload: 1, spread: 1.7, adsSpread: 0.4, recoil: 0.95, noise: 110, sound: 'mg', fov: 50, hip: [0.17, -0.2, -0.44], ads: [0, -0.096, -0.32] },
};

const DEG = Math.PI / 180;
const THROW = 0.95;     // seconds for the whole bomb throw (matches the body's throw clip, player.js)

// ---------- view models ----------
function vm(build) {
  const g = new THREE.Group();
  build(g);
  g.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.renderOrder = 10; } });
  return g;
}
function bx(g, mat, sx, sy, sz, x, y, z, rx = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat); m.position.set(x, y, z); m.rotation.x = rx; g.add(m); return m;
}
function cy(g, mat, r, len, x, y, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); g.add(m); return m;
}

// A faint cool rim on view-model silhouettes, so the gun and hands separate from a dark
// street without adding a light (same trick as the enemies' material).
function addRim(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
      float rimK = 1.0 - max(dot(normalize(vViewPosition), normal), 0.0);
      outgoingLight += diffuseColor.rgb * vec3(0.14, 0.17, 0.26) * pow(rimK, 3.0);
      #include <opaque_fragment>`);
  };
  return mat;
}

// One merged mesh per hand: palm, four fingers curled round the grip, thumb, wrist,
// cuff and a round sleeve (was two plain boxes = two draw calls per hand).
function handGeometry(skinSrgb, sleeveSrgb) {
  // part() writes hex/255 straight into the vertex colours, which the shader treats as
  // linear, so convert first: the hands then match the old skin/sleeve materials exactly
  const lin = (c) => c.getHex(THREE.LinearSRGBColorSpace);
  const skinHex = lin(new THREE.Color(skinSrgb)), sleeveHex = lin(new THREE.Color(sleeveSrgb));
  const dk = lin(new THREE.Color(skinSrgb).multiplyScalar(0.8));
  const cuff = lin(new THREE.Color(sleeveSrgb).multiplyScalar(0.7));
  const X = Math.PI / 2;
  const p = [
    part(new THREE.BoxGeometry(0.07, 0.072, 0.085), skinHex, 0, 0, 0.004),          // back of the hand
    part(new THREE.BoxGeometry(0.024, 0.026, 0.06), skinHex, -0.041, 0.02, -0.022), // thumb along the grip
  ];
  for (let i = 0; i < 4; i++) p.push(part(new THREE.BoxGeometry(0.074, 0.016, 0.03), i % 2 ? dk : skinHex, 0.003, 0.026 - i * 0.018, -0.05)); // fingers
  p.push(part(new THREE.CylinderGeometry(0.031, 0.034, 0.06, 10), skinHex, 0, -0.01, 0.07, X));   // wrist
  p.push(part(new THREE.CylinderGeometry(0.054, 0.054, 0.026, 12), cuff, 0, -0.018, 0.1, X));    // cuff
  p.push(part(new THREE.CylinderGeometry(0.05, 0.056, 0.17, 12), sleeveHex, 0, -0.022, 0.19, X)); // forearm in the sleeve
  return merge(p);
}

function buildModels(mats) {
  const { gun, wood, skin, sleeve, brass } = mats;
  for (const m of [gun, wood, skin, sleeve, brass, mats.olive, mats.olive2]) if (m) addRim(m);
  const handMat = addRim(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const handGeo = handGeometry(skin.color.getHex(), sleeve.color.getHex());
  const hand = (g, x, y, z) => { const m = new THREE.Mesh(handGeo, handMat); m.position.set(x, y, z); m.visible = false; g.add(m); if (!g.userData.grip) g.userData.grip = m.position.clone(); };   // third person: the body's own hand holds the gun
  const B = (x, y, z) => new THREE.BoxGeometry(x, y, z);
  // trigger guard + trigger (+ any extra small parts), merged into ONE extra mesh per gun.
  // yb: bottom of the guard loop, zf: its front, zt: the trigger
  const guard = (g, yb, zf, zt, extra = []) => {
    const m = new THREE.Mesh(merge([
      part(B(0.008, 0.004, 0.045), 0xffffff, 0, yb, zf + 0.0225),
      part(B(0.008, 0.028, 0.004), 0xffffff, 0, yb + 0.014, zf),
      part(B(0.006, 0.018, 0.005), 0xffffff, 0, yb + 0.014, zt, 0.25, 0, 0),
      ...extra,
    ]), gun);
    g.add(m);
  };
  const M = {};
  // bare fists (no stick): nothing drawn, the body is the fighter
  M.lathi = vm((g) => {
    g.userData.melee = true;
  });
  M.pistol = vm((g) => {
    bx(g, gun, 0.035, 0.045, 0.2, 0, 0.03, -0.08); bx(g, gun, 0.032, 0.11, 0.05, 0, -0.035, -0.0, 0.25);
    bx(g, gun, 0.03, 0.02, 0.06, 0, -0.005, -0.06); hand(g, 0, -0.07, 0.02); g.userData.muzzle = new THREE.Vector3(0, 0.03, -0.19); g.userData.eject = new THREE.Vector3(0.02, 0.04, -0.06);
    g.userData.slide = g.children[0];
    // sights ride on the slide (same mesh, so they recoil with it)
    g.children[0].geometry = merge([part(new THREE.BoxGeometry(0.035, 0.045, 0.2), 0xffffff),
      part(B(0.006, 0.01, 0.01), 0xffffff, 0, 0.0275, -0.088),
      part(B(0.008, 0.01, 0.01), 0xffffff, -0.009, 0.0275, 0.09), part(B(0.008, 0.01, 0.01), 0xffffff, 0.009, 0.0275, 0.09)]);
    guard(g, -0.038, -0.083, -0.056);
  });
  M.revolver = vm((g) => {
    cy(g, gun, 0.012, 0.18, 0, 0.035, -0.13); cy(g, gun, 0.026, 0.05, 0, 0.025, -0.03); bx(g, gun, 0.03, 0.03, 0.08, 0, 0.04, -0.02);
    bx(g, wood, 0.03, 0.1, 0.045, 0, -0.03, 0.02, 0.35); hand(g, 0, -0.07, 0.04); g.userData.muzzle = new THREE.Vector3(0, 0.035, -0.23); g.userData.cyl = g.children[1];
    guard(g, -0.005, -0.055, -0.03, [part(B(0.005, 0.012, 0.012), 0xffffff, 0, 0.051, -0.21)]); // + front sight
  });
  M.katta = vm((g) => {
    cy(g, gun, 0.016, 0.22, 0, 0.03, -0.14); bx(g, gun, 0.04, 0.05, 0.08, 0, 0.025, -0.01);
    bx(g, wood, 0.035, 0.12, 0.05, 0, -0.04, 0.03, 0.45); hand(g, 0, -0.08, 0.05); g.userData.muzzle = new THREE.Vector3(0, 0.03, -0.26);
    guard(g, -0.022, -0.05, -0.028);
  });
  M.dunali = vm((g) => {
    cy(g, gun, 0.018, 0.62, -0.019, 0.02, -0.38); cy(g, gun, 0.018, 0.62, 0.019, 0.02, -0.38);
    bx(g, gun, 0.06, 0.05, 0.12, 0, 0.0, -0.03); bx(g, wood, 0.05, 0.06, 0.3, 0, -0.02, -0.25); bx(g, wood, 0.045, 0.09, 0.32, 0, -0.06, 0.16, -0.2);
    hand(g, 0.0, -0.08, 0.06); hand(g, -0.02, -0.06, -0.32);
    guard(g, -0.052, -0.045, -0.018);
    g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.7); g.userData.barrels = true;
  });
  M.rifle = vm((g) => {
    bx(g, gun, 0.05, 0.07, 0.45, 0, 0.0, -0.2); cy(g, gun, 0.012, 0.3, 0, 0.015, -0.56); bx(g, gun, 0.035, 0.14, 0.06, 0, -0.08, -0.12, 0.35);
    bx(g, wood, 0.045, 0.07, 0.25, 0, -0.03, 0.15); bx(g, wood, 0.05, 0.05, 0.2, 0, -0.03, -0.34); bx(g, gun, 0.02, 0.04, 0.03, 0, 0.055, -0.36);
    hand(g, 0.0, -0.09, 0.0); hand(g, -0.01, -0.06, -0.33);
    guard(g, -0.065, -0.07, -0.04, [part(B(0.022, 0.016, 0.02), 0xffffff, 0, 0.043, -0.03)]); // + rear sight
    g.userData.muzzle = new THREE.Vector3(0, 0.015, -0.72); g.userData.eject = new THREE.Vector3(0.03, 0.03, -0.15); g.userData.mag = g.children[2];
  });
  // rocket launcher: olive tube on the shoulder, flared back end, grip, sight and the warhead poking out
  M.rpg = vm((g) => {
    const olive = mats.olive || gun;
    cy(g, olive, 0.045, 0.86, 0, 0.02, -0.18);
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.048, 0.14, 12, 1, true), gun); bell.rotation.x = -Math.PI / 2; bell.position.set(0, 0.02, 0.31); g.add(bell);
    cy(g, gun, 0.05, 0.06, 0, 0.02, -0.5); cy(g, gun, 0.05, 0.05, 0, 0.02, 0.1);
    bx(g, gun, 0.03, 0.12, 0.05, 0, -0.07, -0.1, 0.25); bx(g, gun, 0.03, 0.1, 0.05, 0, -0.06, -0.36, 0.15);
    bx(g, gun, 0.03, 0.05, 0.08, -0.06, 0.07, -0.25); bx(g, brass, 0.012, 0.012, 0.012, -0.06, 0.1, -0.22);
    const head = new THREE.Group(); head.position.set(0, 0.02, -0.62);
    const war = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.044, 0.15, 10), mats.olive2 || olive); war.rotation.x = -Math.PI / 2; head.add(war);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.064, 0.18, 10), gun); tip.rotation.x = -Math.PI / 2; tip.position.z = -0.18; head.add(tip);
    g.add(head);
    hand(g, 0, -0.12, -0.06); hand(g, -0.01, -0.11, -0.33);
    g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.8); g.userData.warhead = head;
  });
  // machine gun (a belt-fed light machine gun): boxy receiver, long barrel in a ventilated heat
  // shield, carry handle, folded bipod, a drum-like ammo box hanging under the left side with the
  // brass belt feeding in, pistol grip and a solid stock
  M.mg = vm((g) => {
    const olive = mats.olive || gun;
    bx(g, gun, 0.062, 0.08, 0.36, 0, 0.0, -0.12);                                   // receiver
    cy(g, gun, 0.013, 0.42, 0, 0.012, -0.5);                                       // barrel
    const shield = new THREE.Mesh(merge([
      part(new THREE.CylinderGeometry(0.026, 0.026, 0.24, 10, 1, true), 0xffffff, 0, 0.012, -0.42, Math.PI / 2, 0, 0),
      ...[0, 1, 2, 3, 4].map((i) => part(new THREE.CylinderGeometry(0.029, 0.029, 0.012, 10), 0xffffff, 0, 0.012, -0.32 - i * 0.05, Math.PI / 2, 0, 0)),
      part(new THREE.CylinderGeometry(0.019, 0.016, 0.06, 8), 0xffffff, 0, 0.012, -0.72, Math.PI / 2, 0, 0),   // flash hider
      part(B(0.006, 0.03, 0.01), 0xffffff, 0, 0.04, -0.68),                       // front sight post
    ]), gun); g.add(shield);
    bx(g, gun, 0.07, 0.022, 0.2, 0, 0.051, -0.13);                                 // feed cover
    const handle = new THREE.Mesh(merge([
      part(B(0.012, 0.045, 0.012), 0xffffff, 0, 0.085, -0.2), part(B(0.012, 0.045, 0.012), 0xffffff, 0, 0.085, -0.06),
      part(B(0.016, 0.014, 0.17), 0xffffff, 0, 0.11, -0.13),
      part(B(0.022, 0.016, 0.02), 0xffffff, 0, 0.07, 0.03),                        // rear sight
    ]), gun); g.add(handle);
    const ammoBox = bx(g, olive, 0.07, 0.11, 0.12, -0.045, -0.085, -0.1);           // ammo box
    bx(g, brass, 0.014, 0.05, 0.08, -0.04, 0.02, -0.1, 0.0);                       // belt rounds feeding in
    bx(g, gun, 0.034, 0.12, 0.05, 0, -0.09, 0.03, 0.3);                            // pistol grip
    bx(g, wood || gun, 0.05, 0.075, 0.24, 0, -0.02, 0.17);                         // stock
    bx(g, gun, 0.055, 0.1, 0.02, 0, -0.03, 0.295);                                 // butt plate
    bx(g, gun, 0.05, 0.035, 0.16, 0, -0.045, -0.33);                               // handguard under the barrel
    const bipod = new THREE.Mesh(merge([                                           // folded bipod legs
      part(B(0.01, 0.01, 0.2), 0xffffff, -0.018, -0.012, -0.52), part(B(0.01, 0.01, 0.2), 0xffffff, 0.018, -0.012, -0.52),
      part(B(0.05, 0.016, 0.02), 0xffffff, 0, -0.008, -0.62),
    ]), gun); g.add(bipod);
    hand(g, 0.0, -0.1, 0.03); hand(g, -0.01, -0.07, -0.33);
    guard(g, -0.06, -0.035, -0.008);
    g.userData.muzzle = new THREE.Vector3(0, 0.012, -0.76); g.userData.eject = new THREE.Vector3(0.035, 0.0, -0.1);
    g.userData.ammoBox = ammoBox;
  });
  return M;
}

// ---------- effects pools ----------
class Effects {
  constructor(scene, tex) {
    this.scene = scene;
    // bullet holes
    this.holes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.11, 0.11), new THREE.MeshBasicMaterial({ map: tex.hole, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), 120);
    this.holes.count = 0; this.holeI = 0; this.holes.frustumCulled = false;
    scene.add(this.holes);
    // blood decals on ground
    this.blood = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex.hole, color: 0x5a0606, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }), 60);
    this.blood.count = 0; this.bloodI = 0; this.blood.frustumCulled = false;
    scene.add(this.blood);
    // particles (dust, sparks, blood spray)
    const N = 300;
    this.pN = N; this.pPos = new Float32Array(N * 3); this.pCol = new Float32Array(N * 3); this.pVel = new Float32Array(N * 3); this.pLife = new Float32Array(N);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.07, vertexColors: true, transparent: true, depthWrite: false, map: tex.glow, sizeAttenuation: true }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.pI = 0;
    // casings
    this.cas = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.006, 0.006, 0.022, 6), new THREE.MeshLambertMaterial({ color: 0xc8a040 }), 30);
    this.cas.frustumCulled = false; this.casings = []; this.cas.count = 0;
    scene.add(this.cas);
    // tracers (enemy fire)
    this.trPos = new Float32Array(12 * 6);
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(this.trPos, 3));
    this.tracers = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.7 }));
    this.tracers.frustumCulled = false; this.trLife = new Float32Array(12); this.trI = 0;
    scene.add(this.tracers);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1);
  }
  hole(p, n) {
    const i = this.holeI++ % 120;
    this._v.set(p[0] + n[0] * 0.01, p[1] + n[1] * 0.01, p[2] + n[2] * 0.01);
    this._q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(n[0], n[1], n[2]));
    const s = 0.7 + Math.random() * 0.6; this._s.set(s, s, s);
    this._m.compose(this._v, this._q, this._s);
    this.holes.setMatrixAt(i, this._m); this.holes.count = Math.min(120, Math.max(this.holes.count, i + 1));
    this.holes.instanceMatrix.needsUpdate = true;
  }
  bloodPool(x, y, z, s) {
    const i = this.bloodI++ % 60;
    this._v.set(x, y + 0.03 + Math.random() * 0.01, z); this._q.setFromEuler(new THREE.Euler(0, Math.random() * 6, 0)); this._s.set(s, 1, s * (0.7 + Math.random() * 0.5));
    this._m.compose(this._v, this._q, this._s);
    this.blood.setMatrixAt(i, this._m); this.blood.count = Math.min(60, Math.max(this.blood.count, i + 1));
    this.blood.instanceMatrix.needsUpdate = true;
  }
  burst(p, n, count, color, speed, life = 0.6, grav = 1) {
    for (let k = 0; k < count; k++) {
      const i = this.pI++ % this.pN;
      this.pPos.set(p, i * 3);
      this.pVel[i * 3] = (n[0] + (Math.random() - 0.5) * 1.4) * speed; this.pVel[i * 3 + 1] = (n[1] + Math.random() * 0.8) * speed; this.pVel[i * 3 + 2] = (n[2] + (Math.random() - 0.5) * 1.4) * speed;
      this.pCol[i * 3] = color[0]; this.pCol[i * 3 + 1] = color[1]; this.pCol[i * 3 + 2] = color[2];
      this.pLife[i] = life * (0.5 + Math.random() * 0.5) * (grav ? 1 : -1);
    }
  }
  casing(p, v) {
    this.casings.push({ p: [...p], v, life: 2.5, rot: Math.random() * 6 });
    if (this.casings.length > 30) this.casings.shift();
  }
  tracer(a, b) {
    const i = this.trI++ % 12;
    this.trPos.set([...a, ...b], i * 6); this.trLife[i] = 0.06;
  }
  update(dt, physics, audio) {
    for (let i = 0; i < this.pN; i++) {
      let l = this.pLife[i];
      if (l === 0) continue;
      const grav = l > 0;
      l = Math.abs(l) - dt;
      if (l <= 0) { this.pLife[i] = 0; this.pPos[i * 3 + 1] = -100; continue; }
      this.pLife[i] = grav ? l : -l;
      if (grav) this.pVel[i * 3 + 1] -= 9.8 * dt;
      this.pPos[i * 3] += this.pVel[i * 3] * dt; this.pPos[i * 3 + 1] += this.pVel[i * 3 + 1] * dt; this.pPos[i * 3 + 2] += this.pVel[i * 3 + 2] * dt;
      const fade = Math.min(1, l * 3);
      this.pCol[i * 3] *= 0.99 + fade * 0.01;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    // casings with a bounce
    let n = 0;
    for (const c of this.casings) {
      c.life -= dt;
      if (c.life <= 0) continue;
      if (!c.rest) {
        c.v[1] -= 9.8 * dt;
        c.p[0] += c.v[0] * dt; c.p[1] += c.v[1] * dt; c.p[2] += c.v[2] * dt; c.rot += dt * 20;
        const g = physics.groundAt(c.p[0], c.p[2], 0.01, c.p[1] + 0.05) + 0.01;
        if (c.p[1] < g) {
          c.p[1] = g;
          if (Math.abs(c.v[1]) > 1) { c.v[1] *= -0.35; c.v[0] *= 0.5; c.v[2] *= 0.5; if (!c.tinked) { c.tinked = true; audio.play('shell', { pos: c.p, vol: 0.35, ref: 1 }); } }
          else c.rest = true;
        }
      }
      this._v.set(...c.p); this._q.setFromEuler(new THREE.Euler(c.rot, c.rot * 0.5, Math.PI / 2)); this._s.set(1, 1, 1);
      this._m.compose(this._v, this._q, this._s); this.cas.setMatrixAt(n++, this._m);
    }
    this.casings = this.casings.filter((c) => c.life > 0);
    this.cas.count = n; this.cas.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 12; i++) if (this.trLife[i] > 0) { this.trLife[i] -= dt; if (this.trLife[i] <= 0) this.trPos.fill(0, i * 6, i * 6 + 6); }
    this.tracers.geometry.attributes.position.needsUpdate = true;
  }
}

export class Arsenal {
  constructor(camera, scene, wscene, tex, mats, audio) {
    this.cam = camera; this.audio = audio;
    this.models = buildModels(mats);
    this.holder = new THREE.Group();
    wscene.add(this.holder);
    for (const k in this.models) { this.models[k].visible = false; this.holder.add(this.models[k]); }
    // left hand with a sutli bomb, shown only while throwing
    const bh = this.bombHand = new THREE.Group();
    bx(bh, mats.skin, 0.07, 0.075, 0.08, 0, 0, 0); bx(bh, mats.skin, 0.06, 0.12, 0.06, 0, -0.09, 0.01); bx(bh, mats.sleeve, 0.085, 0.24, 0.085, 0, -0.27, 0.02);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), mats.jute || mats.wood); ball.position.set(0, 0.06, -0.02); bh.add(ball);
    const fz = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.05, 5), mats.gun); fz.position.set(0, 0.13, -0.02); bh.add(fz);
    const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow, color: 0xffd080, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    spark.scale.setScalar(0.09); spark.position.set(0, 0.16, -0.02); bh.add(spark);
    bh.userData.ball = ball; bh.userData.fz = fz; bh.userData.spark = spark;
    bh.traverse((o) => { o.frustumCulled = false; o.renderOrder = 10; });
    bh.visible = false; this.holder.add(bh);
    this.fx = new Effects(scene, tex);
    // muzzle flash
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow, color: 0xffc070, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false }));
    this.flash.visible = false; this.flash.renderOrder = 20; wscene.add(this.flash);
    this.flashLight = new THREE.PointLight(0xffb060, 0, 14, 1.5);
    scene.add(this.flashLight);
    this.reset();
  }

  reset() {
    this.owned = ['lathi'];
    this.mag = { lathi: 0 };
    this.reserve = { '9mm': 0, '.32': 0, '12G': 0, '7.62': 0, rocket: 0, mg: 0 };
    this.cur = 'lathi';
    this.cool = 0; this.reloadT = 0; this.switchT = 0; this.adsT = 0;
    this.kick = 0; this.bloom = 0; this.swingT = 0; this.shotsFired = 0; this.sprintT = 0;
    this.bombs = 1; this.throwT = 0; this.releaseT = 0;     // start with one desi bomb; find more
    clearTimeout(this._autoReload);
    if (this.bombHand) this.bombHand.visible = false;
    this.sway = { x: 0, y: 0 };
    this.lastYaw = null;
    for (const k in this.models) this.models[k].visible = k === 'lathi';
  }

  get w() { return WEAPONS[this.cur]; }

  give(id) {
    const fresh = !this.owned.includes(id);
    if (fresh) { this.owned.push(id); this.mag[id] = WEAPONS[id].mag; this.equip(id); }
    else if (!WEAPONS[id].noReload) this.reserve[WEAPONS[id].ammo] += WEAPONS[id].mag;   // the machine gun never gets more
    return fresh;
  }

  equip(id) {
    if (id === this.cur || !this.owned.includes(id)) return;
    this.cur = id; this.switchT = 0.45; this.reloadT = 0;
    for (const k in this.models) this.models[k].visible = k === id;
    this.audio.play('clank', { vol: 0.25 });
  }

  cycle() { const i = this.owned.indexOf(this.cur); this.equip(this.owned[(i + 1) % this.owned.length]); }

  // Light the fuse and throw. Returns 'ok', 'none' (no bombs) or 'busy'.
  throwBomb() {
    if (this.bombs <= 0) return 'none';
    if (this.throwT > 0 || this.switchT > 0 || this.reloadT > 0) return 'busy';
    this.bombs--; this.throwT = THROW; this.releaseT = 0.6;   // leaves the hand at the top of the swing
    this.audio.play('click', { vol: 0.4, rate: 0.6 });
    return 'ok';
  }

  _release(game, player) {
    const cam = this.cam;
    const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
    const right = new THREE.Vector3().crossVectors(fwd, cam.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    const from = player.handAt(new THREE.Vector3());   // from the body's own hand
    // a firm overarm throw: about 20 m on flat ground when aimed level, further when aimed up
    const vel = fwd.clone().multiplyScalar(13.5); vel.y += 3.6;
    vel.x += player.vel.x * 0.6; vel.z += player.vel.y * 0.6;
    game.explosives.throwBomb(from, vel, 'player');
    this.audio.play('whoosh', { vol: 0.5, rate: 1.2 });
  }

  startReload() {
    const w = this.w;
    if (w.melee || w.noReload || this.reloadT > 0 || this.mag[this.cur] >= w.mag || this.reserve[w.ammo] <= 0) return false;
    this.reloadT = w.reload;
    this.reloadPhase = 0;
    if (this.cur === 'rifle' && this.audio.has('rifle_reload_out')) this.audio.play('rifle_reload_out', { vol: 0.9, vary: 0, verbAmt: 0.3 });
    else this.audio.play('clank', { vol: 0.5, delay: 0.1 });
    return true;
  }

  // ctx: {player, input, game}
  update(dt, ctx) {
    const { player, input, game } = ctx;
    const w = this.w;
    this.cool -= dt; this.switchT = Math.max(0, this.switchT - dt); this.kick *= Math.pow(0.002, dt);
    if (this.throwT > 0) {
      this.throwT = Math.max(0, this.throwT - dt);
      if (this.releaseT > 0) { this.releaseT -= dt; if (this.releaseT <= 0) this._release(game, player); }
    }
    this.bloom = Math.max(0, this.bloom - dt * 3.5);
    const wantAds = input.aim && !w.melee && this.reloadT <= 0 && !ctx.sprinting;
    this.adsT = clamp(this.adsT + (wantAds ? dt : -dt) * 6, 0, 1);
    // reload
    if (this.reloadT > 0) {
      const before = this.reloadT;
      this.reloadT -= dt;
      if (before > w.reload * 0.45 && this.reloadT <= w.reload * 0.45) {
        if (this.cur === 'rifle' && this.audio.has('rifle_reload_in')) this.audio.play('rifle_reload_in', { vol: 0.9, vary: 0, verbAmt: 0.3 });
        else this.audio.play(w.mag > 2 ? 'clank' : 'click', { vol: 0.6 });
      }
      if (this.reloadT <= 0) {
        const need = w.mag - this.mag[this.cur];
        const take = Math.min(need, this.reserve[w.ammo]);
        this.mag[this.cur] += take; this.reserve[w.ammo] -= take;
        if (!(this.cur === 'rifle' && this.audio.has('rifle_reload_in'))) this.audio.play(this.cur === 'pistol' || this.cur === 'rifle' ? 'slide' : 'click', { vol: 0.6 });
      }
    }
    // fire
    if (input.fire && this.switchT <= 0 && this.reloadT <= 0 && this.cool <= 0 && this.throwT <= 0) {
      if (w.melee) { this.swing(ctx); this.cool = 60 / w.rpm; }
      else if (this.mag[this.cur] > 0) { this.shoot(ctx); this.cool = 60 / w.rpm; if (!w.auto) input.fire = input.touch ? input.fire && false : false; }
      else { this.audio.play('click', { vol: 0.6 }); this.cool = 0.3; if (!w.auto) input.fire = false; if (!this.startReload() && !input.touch) { /* empty */ } }
    }
    // camera FOV for aiming
    const fov = lerp(72, w.fov || 72, this.adsT);
    if (Math.abs(this.cam.fov - fov) > 0.05) { this.cam.fov = fov; this.cam.updateProjectionMatrix(); }
    this._pose(dt, player, ctx);
    this.fx.update(dt, game.physics, this.audio);
    this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 400);
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.flash.visible = false; }
  }

  _pose(dt, player, ctx) {
    const m = this.models[this.cur];
    const w = this.w;
    // sway from turning
    if (this.lastYaw !== null) {
      this.sway.x = lerp(this.sway.x, clamp((player.yaw - this.lastYaw) * 3, -0.06, 0.06), 1 - Math.exp(-dt * 10));
      this.sway.y = lerp(this.sway.y, clamp((player.pitch - this.lastPitch) * 3, -0.05, 0.05), 1 - Math.exp(-dt * 10));
    }
    this.lastYaw = player.yaw; this.lastPitch = player.pitch;
    const a = this.adsT;
    const hip = w.hip || (w.melee ? [0.25, -0.33, -0.5] : w.rocket ? [0.24, -0.2, -0.55] : [0.16, -0.19, -0.42]), adsP = w.ads || [0, w.en === 'RIFLE' ? -0.083 : w.en === 'DOUBLE BARREL' ? -0.082 : -0.085, -0.3];
    let x = lerp(hip[0], adsP[0], a), y = lerp(hip[1], adsP[1], a), z = lerp(hip[2], adsP[2], a);
    const bob = player.bobAmt * (1 - a * 0.8);
    x += Math.cos(player.bobT) * 0.012 * bob + this.sway.x * (1 - a * 0.7);
    y += Math.abs(Math.sin(player.bobT)) * 0.012 * bob - this.sway.y * 0.5;
    // the running pose blends in and out: sprint can switch on/off on consecutive frames (stamina at
    // its limit, a thumb at the joystick's rim), and snapping straight between the two poses made the
    // gun / lathi flicker while running
    this.sprintT = clamp((this.sprintT || 0) + (ctx.sprinting ? dt : -dt) * 7, 0, 1);
    const sk = this.sprintT * this.sprintT * (3 - 2 * this.sprintT);
    x += 0.04 * sk; y -= 0.05 * sk;
    z += this.kick * 0.06;
    let rx = lerp(this.kick * 0.25, -0.2, sk), ry = 0.5 * sk, rz = 0;
    // reload: dip and tilt
    if (this.reloadT > 0) {
      const t = 1 - this.reloadT / w.reload;
      const k = Math.sin(Math.min(1, t * 1.15) * Math.PI);
      y -= 0.12 * k; rz = 0.6 * k; rx += -0.3 * k;
    }
    if (this.switchT > 0) y -= this.switchT * 0.5;
    // throwing: the gun dips out of the way while the left hand swings the bomb up and over
    const bh = this.bombHand;
    if (this.throwT > 0) {
      const t = 1 - this.throwT / THROW, k = Math.sin(Math.min(1, t * 1.3) * Math.PI);
      y -= 0.16 * k; rx -= 0.25 * k;
      const held = this.releaseT > 0, u = held ? t / (0.2 / THROW) : (t - 0.2 / THROW) / (1 - 0.2 / THROW);
      // wind-up: from low left up beside the head; then the arm whips forward and drops out of view
      if (held) bh.position.set(-0.24 + 0.04 * u, -0.34 + 0.24 * u, -0.5 + 0.06 * u), bh.rotation.set(0.5 * u, 0, 0.25);
      else bh.position.set(-0.2 + 0.1 * u, -0.1 - 0.4 * u * u, -0.44 - 0.16 * u), bh.rotation.set(0.5 - 1.5 * u, 0, 0.25);
      bh.userData.ball.visible = bh.userData.fz.visible = bh.userData.spark.visible = held;
      bh.userData.spark.scale.setScalar(0.06 + Math.random() * 0.06);
      bh.visible = false;   // the body's throw animation shows it now
    } else bh.visible = false;
    if (w.melee && this.swingT > 0) {
      const t = 1 - this.swingT / 0.35;
      const k = Math.sin(t * Math.PI);
      rx += -0.9 * k; ry = 0.75 * k; rz = 0.35 * k; x -= 0.14 * k; y += 0.04 * k;
      this.swingT -= dt;
    }
    // third person: the grip sits in the body's right hand; only the bob, kick and reload dips stay
    const gp = m.userData.grip || { x: 0, y: 0, z: 0 };
    m.position.set(x - lerp(hip[0], adsP[0], a) - gp.x, y - lerp(hip[1], adsP[1], a) - gp.y, z - lerp(hip[2], adsP[2], a) - gp.z);
    this.holder.visible = this.throwT <= 0 && !(ctx.game && ctx.game.vehicles.driving);   // put away while the right hand throws (and in a vehicle)
    m.rotation.set(rx, ry, rz);
    if (m.userData.warhead) m.userData.warhead.visible = this.mag[this.cur] > 0 || (this.reloadT > 0 && this.reloadT < w.reload * 0.45);
    player.handAt(this.holder.position);      // third person: held by the body's right hand
    this.holder.quaternion.copy(this.cam.quaternion);
  }

  spreadRad(player, input) {
    const w = this.w;
    let s = lerp(w.spread, w.adsSpread, this.adsT);
    s *= 1 + Math.min(1.5, player.speedNow / 3.4) * (1 - this.adsT * 0.6);
    if (player.crouched) s *= 0.75;
    if (!player.onGround) s *= 2;
    s += this.bloom * w.spread * 0.6;
    return s * DEG;
  }

  shoot(ctx) {
    const { player, game, input } = ctx;
    const w = this.w;
    this.mag[this.cur]--;
    this.shotsFired++;
    const cam = this.cam;
    const origin = cam.position.clone();
    const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
    const right = new THREE.Vector3().crossVectors(fwd, cam.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    const spread = this.spreadRad(player, input);
    for (let p = 0; p < w.pellets; p++) {
      const r = Math.sqrt(Math.random()) * spread, a = Math.random() * Math.PI * 2;
      const dir = fwd.clone().addScaledVector(right, Math.cos(a) * Math.tan(r)).addScaledVector(up, Math.sin(a) * Math.tan(r)).normalize();
      // the rocket starts a metre ahead of the eye, so it can never hit the shooter
      if (w.rocket) game.explosives.launch(origin, dir, right, 'player');
      else game.fireRay(origin, dir, w.dmg, 'player', w);
    }
    // recoil: kick up, random side
    const rk = w.recoil * DEG * (1 - this.adsT * 0.35) * (player.crouched ? 0.8 : 1);
    player.recoil.y += rk * 0.75; player.recoil.x += (Math.random() - 0.5) * rk * 0.6;
    this.kick = Math.min(1.4, this.kick + w.recoil * 0.12);
    this.bloom = Math.min(3, this.bloom + 0.6);
    player.shake = Math.max(player.shake, Math.min(0.35, w.recoil * 0.05));
    // flash
    const m = this.models[this.cur];
    const mp = m.userData.muzzle.clone(); m.updateMatrixWorld(); m.localToWorld(mp);
    this.flash.position.copy(mp); this.flash.material.rotation = Math.random() * 6;
    this.flash.material.color.setHex(0xffc070);
    const fs = w.rocket ? 0.55 : w.pellets > 1 || this.cur === 'katta' ? 0.5 : 0.3;
    this.flash.scale.setScalar(fs * (0.8 + Math.random() * 0.4)); this.flash.visible = true; this.flashT = 0.045;
    // world-space flash light at the muzzle direction
    this.flashLight.position.copy(origin).addScaledVector(fwd, 0.8);
    this.flashLight.intensity = w.rocket ? 30 : 14; this.flashLight.distance = 14;
    // casing
    if (m.userData.eject) {
      const ep = m.userData.eject.clone(); m.localToWorld(ep);
      // view-model is in its own scene glued to the camera, same world coords
      const v = right.clone().multiplyScalar(1.8 + Math.random()).addScaledVector(up, 1.5 + Math.random()).addScaledVector(fwd, -0.4);
      this.fx.casing([ep.x, ep.y, ep.z], [v.x, v.y, v.z]);
    }
    this.audio.play(w.sound, { vol: 1, verbAmt: 0.9 });
    game.noise(player.pos, w.noise, 'gun');
    // auto-reload an empty gun a moment later (only if it is still the gun in hand)
    const id = this.cur;
    if (this.mag[id] === 0 && this.reserve[w.ammo] > 0) { clearTimeout(this._autoReload); this._autoReload = setTimeout(() => { if (this.cur === id) this.startReload(); }, 250); }
  }

  swing(ctx) {
    const { game } = ctx;
    this.swingT = 0.35;
    this.audio.play('whoosh', { vol: 0.6 });
    const cam = this.cam;
    const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
    setTimeout(() => game.melee(cam.position.clone(), fwd, this.w.dmg, this.w.range), 120);
  }
}
