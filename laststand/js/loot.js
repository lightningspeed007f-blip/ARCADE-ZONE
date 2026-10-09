// Items lying in the world (food, ammo, weapons, objective items) and
// searchable containers. Every item kind is one instanced mesh.
import * as THREE from 'three';
import { part, merge, Bx, Cy } from './props.js';

export const FOOD = {
  biscuit: { name: 'बिस्कुट का पैकेट', en: 'Biscuits', heal: 10, model: 'pack', color: 0xd8a020 },
  bread:   { name: 'ब्रेड', en: 'Bread', heal: 15, model: 'loaf', color: 0xd09a58 },
  water:   { name: 'पानी की बोतल', en: 'Water', heal: 8, model: 'bottle', color: 0xa8d0ff, drink: true },
  juice:   { name: 'जूस', en: 'Juice', heal: 12, model: 'tetra', color: 0xff8a20, drink: true },
  namkeen: { name: 'नमकीन', en: 'Namkeen', heal: 10, model: 'pack', color: 0x2a8a3a },
  banana:  { name: 'केले', en: 'Bananas', heal: 9, model: 'banana', color: 0xf0d040 },
  roti:    { name: 'रोटी', en: 'Roti', heal: 14, model: 'disc', color: 0xd8b080 },
  noodles: { name: 'नूडल्स', en: 'Noodles', heal: 12, model: 'pack', color: 0xf0c020 },
  glucose: { name: 'ग्लूकोज़', en: 'Glucose', heal: 7, model: 'tetra', color: 0x2060c0, drink: true },
  laddoo:  { name: 'प्रसाद के लड्डू', en: 'Prasad laddoo', heal: 18, model: 'sweet', color: 0xf0a020 },
};
export const AMMO_PICK = { '9mm': [8, 15], '.32': [6, 12], '12G': [3, 6], '7.62': [10, 22] };
const AMMO_COL = { '9mm': 0x5a6a3a, '.32': 0x6a4a2a, '12G': 0xa02020, '7.62': 0x3a4a2a };

function models() {
  return {
    pack: merge([part(Bx(0.2, 0.05, 0.12), 0xffffff, 0, 0.025, 0), part(Bx(0.08, 0.051, 0.121), 0xf0f0f0, 0.05, 0.025, 0)]),
    loaf: merge([part(Bx(0.26, 0.11, 0.12), 0xffffff, 0, 0.055, 0), part(Bx(0.24, 0.03, 0.1), 0xd8b080, 0, 0.12, 0)]),
    bottle: merge([part(Cy(0.035, 0.035, 0.22, 8), 0xffffff, 0, 0.11, 0), part(Cy(0.015, 0.02, 0.04, 6), 0x2050c0, 0, 0.24, 0), part(Cy(0.036, 0.036, 0.06, 8), 0x30a0e0, 0, 0.12, 0)]),
    tetra: merge([part(Bx(0.065, 0.12, 0.045), 0xffffff, 0, 0.06, 0), part(Cy(0.004, 0.004, 0.06, 4), 0xffffff, 0.02, 0.14, 0)]),
    banana: merge([part(Bx(0.18, 0.04, 0.04), 0xffffff, 0, 0.02, 0, 0, 0, 0.25), part(Bx(0.18, 0.04, 0.04), 0xffffff, 0.01, 0.02, 0.045, 0, 0.2, 0.25), part(Bx(0.18, 0.04, 0.04), 0xffffff, 0, 0.06, 0.02, 0, -0.1, 0.25)]),
    disc: merge([part(Cy(0.11, 0.11, 0.02, 12), 0xffffff, 0, 0.01, 0), part(Cy(0.11, 0.11, 0.02, 12), 0xe0c090, 0.02, 0.03, 0.01)]),
    sweet: merge([part(new THREE.SphereGeometry(0.035, 8, 6), 0xffffff, -0.04, 0.035, 0), part(new THREE.SphereGeometry(0.035, 8, 6), 0xffffff, 0.04, 0.035, 0), part(new THREE.SphereGeometry(0.035, 8, 6), 0xffffff, 0, 0.035, 0.06), part(Bx(0.2, 0.01, 0.2), 0x30a040, 0, 0.003, 0.02)]),
    ammo: merge([part(Bx(0.14, 0.07, 0.09), 0xffffff, 0, 0.035, 0), part(Bx(0.142, 0.02, 0.092), 0xd8c070, 0, 0.06, 0)]),
    pistol: merge([part(Bx(0.035, 0.04, 0.2), 0x2a2a2c, 0, 0.03, 0, 0, 0, Math.PI / 2), part(Bx(0.035, 0.11, 0.045), 0x2a2a2c, 0, 0.03, 0.08, Math.PI / 2 - 0.25, 0, Math.PI / 2)]),
    revolver: merge([part(Bx(0.03, 0.03, 0.2), 0x3a3a3c, 0, 0.03, -0.04, 0, 0, Math.PI / 2), part(Bx(0.05, 0.05, 0.05), 0x3a3a3c, 0, 0.03, 0.04), part(Bx(0.035, 0.1, 0.045), 0x6a4024, 0, 0.03, 0.1, Math.PI / 2 - 0.3, 0, Math.PI / 2)]),
    katta: merge([part(Bx(0.03, 0.03, 0.24), 0x4a4a48, 0, 0.03, -0.05, 0, 0, Math.PI / 2), part(Bx(0.04, 0.12, 0.05), 0x6a4024, 0, 0.03, 0.1, Math.PI / 2 - 0.4, 0, Math.PI / 2)]),
    dunali: merge([part(Bx(0.07, 0.04, 0.7), 0x2a2a2c, 0, 0.04, -0.3), part(Bx(0.06, 0.07, 0.45), 0x6a4024, 0, 0.04, 0.25)]),
    rifle: merge([part(Bx(0.05, 0.07, 0.6), 0x252527, 0, 0.04, -0.1), part(Bx(0.04, 0.04, 0.35), 0x252527, 0, 0.05, -0.55), part(Bx(0.05, 0.08, 0.25), 0x5a3a20, 0, 0.04, 0.3), part(Bx(0.035, 0.14, 0.06), 0x252527, 0, 0.0, -0.05, 0.35, 0, 0)]),
    key: merge([part(Cy(0.03, 0.03, 0.01, 10), 0xd4aa30, 0, 0.005, 0), part(Bx(0.012, 0.01, 0.12), 0xd4aa30, 0, 0.005, 0.07), part(Bx(0.02, 0.01, 0.012), 0xd4aa30, 0.012, 0.005, 0.12)]),
    fuse: merge([part(Cy(0.03, 0.03, 0.1, 10), 0xf0f0e8, 0, 0.03, 0, 0, 0, Math.PI / 2), part(Cy(0.032, 0.032, 0.02, 10), 0xb0b0b8, 0.055, 0.03, 0, 0, 0, Math.PI / 2), part(Cy(0.032, 0.032, 0.02, 10), 0xb0b0b8, -0.055, 0.03, 0, 0, 0, Math.PI / 2)]),
  };
}

export class Loot {
  constructor(scene, mat) {
    this.scene = scene;
    this.geo = models();
    this.mat = mat;
    this.items = [];
    this.meshes = {};
    this.beacon = null; this.nb = 0;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._v = new THREE.Vector3(); this._c = new THREE.Color();
  }

  clear() {
    for (const k in this.meshes) { this.scene.remove(this.meshes[k]); this.meshes[k].dispose(); }
    this.meshes = {}; this.items = [];
    this.nb = 0;
    if (this.beacon) { this.beacon.geometry.attributes.position.array.fill(-9999); this.beacon.geometry.attributes.position.needsUpdate = true; }
  }

  // Weapons are small and dark, so each one gets a soft golden spark above it (one Points draw call
  // for all of them). It is hidden by walls, so it only shows once you can actually see the gun.
  _beaconFor(it) {
    if (it.kind !== 'weapon') return;
    if (!this.beacon) {
      const N = 160, c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,240,190,1)'); g.addColorStop(0.25, 'rgba(255,200,90,0.55)'); g.addColorStop(1, 'rgba(255,170,60,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3).fill(-9999), 3));
      const mat = new THREE.PointsMaterial({ map: new THREE.CanvasTexture(c), size: 0.7, sizeAttenuation: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      this.beacon = new THREE.Points(geo, mat); this.beacon.frustumCulled = false; this.beacon.renderOrder = 5;
      this.scene.add(this.beacon);
    }
    const pos = this.beacon.geometry.attributes.position;
    if (this.nb >= pos.count) return;
    it.bi = this.nb++;
    pos.setXYZ(it.bi, it.p[0], it.p[1] + 0.32, it.p[2]);
    pos.needsUpdate = true;
  }

  update(t) { if (this.beacon) this.beacon.material.opacity = 0.62 + 0.28 * Math.sin(t * 3.2); }

  // kind: 'food' | 'ammo' | 'weapon' | 'key' | 'fuse'
  add(it) {
    it.taken = false;
    it.model = it.kind === 'food' ? FOOD[it.id].model : it.kind === 'ammo' ? 'ammo' : it.kind === 'weapon' ? it.id : it.kind;
    it.color = it.kind === 'food' ? FOOD[it.id].color : it.kind === 'ammo' ? AMMO_COL[it.id] : 0xffffff;
    it.yaw = it.yaw ?? Math.random() * 6.28;
    this.items.push(it);
    this._beaconFor(it);
    return it;
  }

  build() {
    const groups = {};
    for (const it of this.items) (groups[it.model] || (groups[it.model] = [])).push(it);
    for (const k in groups) {
      const list = groups[k];
      const im = new THREE.InstancedMesh(this.geo[k], this.mat, list.length);
      list.forEach((it, i) => { it.im = im; it.ii = i; this._set(it); });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      this.scene.add(im); this.meshes[k] = im;
    }
  }

  _set(it) {
    const s = it.taken ? 0.0001 : it.kind === 'weapon' ? 1.7 : 1;
    this._v.set(it.p[0], it.p[1], it.p[2]); this._q.setFromEuler(new THREE.Euler(0, it.yaw, 0)); this._s.set(s, s, s);
    this._m.compose(this._v, this._q, this._s);
    it.im.setMatrixAt(it.ii, this._m);
    it.im.setColorAt(it.ii, this._c.set(it.color));
  }

  take(it) {
    it.taken = true;
    if (it.bi !== undefined && this.beacon) { this.beacon.geometry.attributes.position.setXYZ(it.bi, -9999, -9999, -9999); this.beacon.geometry.attributes.position.needsUpdate = true; }
    this._set(it);
    it.im.instanceMatrix.needsUpdate = true;
  }

  // Add an item after build (drops from enemies): its own small mesh.
  drop(it) {
    this.add(it);
    const im = new THREE.InstancedMesh(this.geo[it.model], this.mat, 1);
    it.im = im; it.ii = 0; this._set(it);
    this.scene.add(im); this.meshes['drop' + this.items.length] = im;
  }
}

// Pick what a spot or container gives. r = run RNG.
export function rollFood(r) { return r.pick(['biscuit', 'biscuit', 'bread', 'water', 'water', 'juice', 'namkeen', 'banana', 'roti', 'noodles', 'glucose']); }
export function rollAmmo(r, owned) {
  const pref = owned && owned.length > 1 && r.chance(0.6) ? r.pick(owned.filter((w) => w !== 'lathi')) : null;
  const map = { pistol: '9mm', revolver: '.32', katta: '12G', dunali: '12G', rifle: '7.62' };
  const t = pref ? map[pref] : r.pick(['9mm', '9mm', '9mm', '12G', '12G', '.32', '7.62']);
  const [a, b] = AMMO_PICK[t];
  return { t, n: r.int(a, b) };
}
export function rollWeapon(r) { return r.pick(['pistol', 'pistol', 'revolver', 'katta', 'katta', 'dunali', 'rifle']); }

export function containerLoot(type, r, owned) {
  const out = [];
  const empty = { almirah: 0.35, fridge: 0.3, trunk: 0.4, shelf: 0.25, shelfx: 0.55 }[type] ?? 0.4;
  if (r.chance(empty)) return out;
  if (type === 'fridge') { out.push({ kind: 'food', id: r.pick(['water', 'water', 'juice', 'roti', 'bread', 'banana']) }); if (r.chance(0.35)) out.push({ kind: 'food', id: 'water' }); }
  else if (type === 'shelf') { out.push({ kind: 'food', id: rollFood(r) }); if (r.chance(0.4)) out.push({ kind: 'food', id: rollFood(r) }); }
  else if (type === 'shelfx') { const a = rollAmmo(r, owned); out.push({ kind: 'ammo', id: a.t, n: a.n }); }
  else if (type === 'almirah') {
    if (r.chance(0.12)) out.push({ kind: 'weapon', id: r.pick(['revolver', 'katta', 'pistol']) });
    else if (r.chance(0.55)) { const a = rollAmmo(r, owned); out.push({ kind: 'ammo', id: a.t, n: a.n }); }
    else out.push({ kind: 'food', id: rollFood(r) });
  } else { // trunk
    if (r.chance(0.5)) { const a = rollAmmo(r, owned); out.push({ kind: 'ammo', id: a.t, n: a.n }); } else out.push({ kind: 'food', id: rollFood(r) });
  }
  return out;
}
