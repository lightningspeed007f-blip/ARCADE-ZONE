// THE JOKER — the real villain of the night.
//
// When Lohasur, the railyard giant (boss.js), is about to die, the Joker steps out of a puff of
// purple smoke, shoots the giant dead and takes his place: he laughs, lobs a laughing-gas canister
// at the player and everything goes white. The player wakes up in the Joker's Playground — the
// abandoned city street (models/street.glb), far from the town — and has to fight him there.
// At 60% health he lets his pet out: CatNap (models/catnap.glb), who stalks the player and
// breathes its red gas. Killing the Joker completes the game.
//
// The jester (models/joker.glb) has a rig but no animations, so every move is posed in code on
// top of his rest pose (see models.js: poseBone). CatNap plays the animations from its file.
import * as THREE from 'three';
import { loadModels, poseBone, restAll, STREET } from './models.js';
import { clamp, lerp, angleDiff, smooth } from './util.js';
import { BOMB } from './explosives.js';

export const JOKER = { name: 'जोकर', en: 'THE JOKER · KING OF JESTERS', hp: 1700 };
export const CATNAP = { name: 'कैटनैप', en: 'CATNAP', hp: 900 };
const AMBUSH_AT = 0.1;          // Lohasur's health share when the Joker steps in

// Collision boxes of the street model, in its own units: [cx, cz, half x, half z, y0, y1, yaw].
// Worked out from the mesh once (one box per building block / wreck, rotated to fit).
const BOXES = [[5.84,-1.38,1.68,1.75,-0.13,1.84,1.4],[-3.68,-7,1.57,1.85,-0.01,1.92,0.23],[-11.93,-2.47,1.43,1.43,-0.05,1.87,1.5],[-11.93,-2.47,1.43,1.43,1.75,3.67,1.5],[-6.12,-16.17,1.76,1.01,1.07,3.07,0.4],[-6.12,-16.17,1.76,1.01,-0.96,1.04,0.4],[-11.84,-8.74,1.76,1,0.32,2.32,1.31],[1.91,4.29,1,1.76,-0.05,1.95,0],[6.48,2.86,1,1.76,-0.05,1.95,0],[-0.21,-0.4,1,1.76,-0.05,1.95,0],[3.69,-8.19,1.76,1,-0.05,1.95,0],[-6.05,3.96,1,1.76,-0.05,1.95,0],[-3.62,8.87,1.1,1.51,0,1.42,1.38],[7.31,-2.27,1.09,1.5,1.4,2.83,0],[7.31,-5.28,1.09,1.5,1.4,2.83,0],[-6.29,-1.54,1.09,1.5,0,1.42,0],[0.23,6.09,1.09,1.5,0,1.42,0],[6.87,-2.27,1.09,1.5,0,1.42,0],[6.63,5.97,1.09,1.5,0,1.42,0],[6.87,-5.23,1.09,1.5,0,1.42,0],[-0.66,8.8,1.01,1.01,-0.08,1.89,0.33],[1.09,-7.62,1,1,-0.08,1.89,1.54],[-6.09,1.16,1,1,-0.08,1.89,0],[3.74,7.71,1.16,1.5,-0.06,1.02,1.13],[7.3,-8.02,1.16,1.5,1.04,2.13,0.82],[7.3,-7.08,1.16,1.5,-0.06,1.02,0.82],[1.08,-0.85,1.49,1.16,-0.06,1.02,0.82],[-6.51,-4.55,1.15,1.49,-0.06,1.02,0],[1.69,-2.75,1.15,1.49,-0.06,1.02,0],[-5.2,-7.34,1.01,1.01,-0.04,1.3,0.7],[0.05,3.58,1,1,-0.08,1.28,0],[-8.47,-14.98,1,1,1.08,2.42,0.4],[-8.47,-14.98,1,1,-0.22,1.12,0.4],[-12.35,-6.16,1,1,0.33,1.67,1.31],[-2.85,-8.18,1,1,-0.04,1.3,0],[-0.85,-8.18,1,1,-0.04,1.3,0],[-0.38,-3.03,1,1,-0.04,1.3,0],[6.3,0.23,1,1,-0.04,1.3,0],[-5.87,6.59,1,1,-0.04,1.3,0],[-12.05,-2.37,1.31,1,3.56,4.56,1.5],[0.05,3.58,0.62,0.95,1.27,2.56,0],[-5.46,-0.42,0.83,0.86,-0.13,0.84,1.4],[4.08,7.47,0.6,1.27,1.03,1.72,1.13],[2.04,-2.55,0.6,1.27,1.03,1.72,0],[-6.16,-4.35,0.6,1.27,1.03,1.72,0],[-8.56,-15.02,0.92,0.7,2.35,3.05,0.4],[-12.44,-6.11,0.91,0.7,1.6,2.3,1.31],[6.38,0.16,0.7,0.91,1.23,1.92,0],[-5.95,6.66,0.7,0.91,1.23,1.92,0],[-0.31,-3.1,0.7,0.91,1.23,1.92,0],[-2.92,-8.26,0.91,0.7,1.23,1.92,0],[-1.12,-8.26,0.91,0.7,1.23,1.92,0],[-3.21,8.97,0.6,0.92,1.4,2.09,1.38],[-6.49,-15.94,0.92,0.6,3.05,3.74,0.4],[-8.2,-15.21,0.92,0.6,3.05,3.74,0.4],[-12.37,-6.51,0.91,0.6,3.01,3.7,1.31],[-12.37,-6.51,0.91,0.6,2.3,2.99,1.31],[-11.88,-8.31,0.91,0.6,2.3,2.99,1.31],[-11.88,-8.31,0.91,0.6,3.02,3.72,1.31],[6.41,2.43,0.6,0.91,1.93,2.62,0],[-0.27,-2.69,0.6,0.91,1.93,2.62,0],[-5.98,6.26,0.6,0.91,1.93,2.62,0],[6.41,0.57,0.6,0.91,1.93,2.62,0],[-0.27,-0.83,0.6,0.91,1.93,2.62,0],[-6.32,-1.12,0.6,0.91,1.4,2.09,0],[-5.98,4.39,0.6,0.91,1.93,2.62,0],[-0.66,8.81,0.63,0.63,1.15,1.86,0.33],[1.09,-7.63,0.62,0.62,1.15,1.86,1.54],[-6.1,1.16,0.62,0.62,1.15,1.86,0],[-0.86,3.58,0.32,1,1.27,1.5,0]];
// the paved square inside the ring of buildings (model units)
const SQ = { x0: -7.55, x1: 8.25, z0: -7.5, z1: 8.3 };
const W = (mx, mz) => [STREET.x + mx * STREET.S, STREET.z + mz * STREET.S];
const PLAYER_IN = W(-3.4, 6.6), JOKER_IN = W(-3.6, 1.4);     // the far end of the west lane, ~21 m apart
const CAT_SPOTS = [[-3.6, -5.6], [4.3, -5.4], [-3.4, 6.4], [4.6, 3.0], [-4.2, 0.4], [4.5, 7.4], [-1.2, -5.8], [2.6, 1.6]];

const ease = (t) => smooth(clamp(t, 0, 1));
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _e = new THREE.Euler(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
const Q = (x, y, z) => _qa.setFromEuler(_e.set(x, y, z, 'XYZ'));
const LEFT_ARM = new THREE.Vector3(1, 0, 0), RIGHT_ARM = new THREE.Vector3(-1, 0, 0);

// ---------- the arena: collision, boundary, lights (built with the town, before the light pool) ----------
export function buildArena(W_) {
  const P = W_.P, S = STREET.S;
  for (const [cx, cz, hx, hz, y0, y1, yaw] of BOXES) {
    const [x, z] = W(cx, cz);
    const lo = Math.max(0, y0 * S + STREET.y), hi = y1 * S + STREET.y;
    if (hi < 0.2) continue;
    P.add(x, (lo + hi) / 2, z, hx * S, (hi - lo) / 2, hz * S, yaw);
  }
  // invisible walls round the square so nobody wanders off into the void
  const [x0, z0] = W(SQ.x0, SQ.z0), [x1, z1] = W(SQ.x1, SQ.z1), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  P.add(cx, 6, z0 - 0.5, (x1 - x0) / 2 + 1, 6, 0.5); P.add(cx, 6, z1 + 0.5, (x1 - x0) / 2 + 1, 6, 0.5);
  P.add(x0 - 0.5, 6, cz, 0.5, 6, (z1 - z0) / 2 + 1); P.add(x1 + 0.5, 6, cz, 0.5, 6, (z1 - z0) / 2 + 1);
  // sickly carnival lights
  const L = (mx, mz, y, color, intensity, dist, flicker = 0) => { const [x, z] = W(mx, mz); W_.lights.push({ x, y, z, color, intensity, dist, flicker }); };
  L(-3.4, 5.2, 4.5, 0xffc070, 7, 20, 1); L(4.2, -4.6, 4.5, 0x50ff80, 8, 20); L(-4.4, -4.8, 4, 0xb050ff, 8, 20, 1);
  L(4.4, 4.2, 4, 0xff40a0, 7, 18); L(-4.6, 0.6, 4, 0x50ff80, 6, 18, 1); L(3.9, -0.6, 4, 0xffc070, 6, 16); L(1.0, 1.7, 5, 0xb050ff, 6, 18);
}

// ---------- a little grid path-finder for the arena (1 m cells) ----------
class ArenaNav {
  constructor(P) {
    const [x0, z0] = W(SQ.x0, SQ.z0), [x1, z1] = W(SQ.x1, SQ.z1);
    this.x0 = x0; this.z0 = z0; this.w = Math.ceil(x1 - x0); this.h = Math.ceil(z1 - z0);
    const n = this.w * this.h;
    this.block = new Uint8Array(n);
    const tmp = [];
    for (let k = 0; k < this.h; k++) for (let i = 0; i < this.w; i++) {
      const x = x0 + i + 0.5, z = z0 + k + 0.5;
      for (const b of P.query(x - 0.6, z - 0.6, x + 0.6, z + 0.6, tmp)) {
        if (b.minY < 1.6 && b.maxY > 0.4 && P.constructor.circleOverlaps(b, x, z, 0.55)) { this.block[k * this.w + i] = 1; break; }
      }
    }
    this.queue = new Int32Array(n);
  }
  idx(x, z) { const i = Math.floor(x - this.x0), k = Math.floor(z - this.z0); return i < 0 || k < 0 || i >= this.w || k >= this.h ? -1 : k * this.w + i; }
  centre(i) { return [this.x0 + (i % this.w) + 0.5, this.z0 + ((i / this.w) | 0) + 0.5]; }
  free(i) { return i >= 0 && !this.block[i]; }
  // breadth-first distances (in cells) from (x, z); 65535 = unreachable
  field(x, z, out) {
    out = out || new Uint16Array(this.w * this.h);
    out.fill(65535);
    let s = this.idx(x, z);
    if (s < 0) return out;
    if (this.block[s]) { // standing against a wall: start from the nearest free neighbour
      let best = -1;
      for (let r = 1; r < 4 && best < 0; r++) for (let dk = -r; dk <= r && best < 0; dk++) for (let di = -r; di <= r; di++) { const j = s + dk * this.w + di; if (this.free(j)) { best = j; break; } }
      if (best < 0) return out; s = best;
    }
    const q = this.queue; let head = 0, tail = 0;
    out[s] = 0; q[tail++] = s;
    while (head < tail) {
      const i = q[head++], d = out[i], ix = i % this.w;
      if (ix > 0 && !this.block[i - 1] && out[i - 1] === 65535) { out[i - 1] = d + 1; q[tail++] = i - 1; }
      if (ix < this.w - 1 && !this.block[i + 1] && out[i + 1] === 65535) { out[i + 1] = d + 1; q[tail++] = i + 1; }
      if (i >= this.w && !this.block[i - this.w] && out[i - this.w] === 65535) { out[i - this.w] = d + 1; q[tail++] = i - this.w; }
      if (i + this.w < out.length && !this.block[i + this.w] && out[i + this.w] === 65535) { out[i + this.w] = d + 1; q[tail++] = i + this.w; }
    }
    return out;
  }
  // direction down the field from (x, z), or null when there or lost
  step(f, x, z) {
    const i = this.idx(x, z);
    if (i < 0) return null;
    const here = f[i];
    let best = here, bi = -1;
    const ix = i % this.w;
    for (let dk = -1; dk <= 1; dk++) for (let di = -1; di <= 1; di++) {
      if (!di && !dk) continue;
      if ((ix === 0 && di < 0) || (ix === this.w - 1 && di > 0)) continue;
      const j = i + dk * this.w + di;
      if (j < 0 || j >= f.length) continue;
      if (di && dk && (f[i + di] === 65535 || f[i + dk * this.w] === 65535)) continue;
      const d = f[j] + (di && dk ? 0.4 : 0);
      if (d < best) { best = d; bi = j; }
    }
    if (bi < 0) return null;
    const [tx, tz] = this.centre(bi), dx = tx - x, dz = tz - z, l = Math.hypot(dx, dz) || 1;
    return [dx / l, dz / l, here];
  }
}

// ---------- shared hit-sphere ray test (as the boss does it) ----------
function sphereHit(owner, hs, o, d, maxT) {
  let best = null;
  for (const h of hs) {
    const sx = h.p.x - o.x, sy = h.p.y - o.y, sz = h.p.z - o.z;
    const t = sx * d.x + sy * d.y + sz * d.z;
    if (t < 0) continue;
    const q = sx * sx + sy * sy + sz * sz - t * t, r2 = h.r * h.r;
    if (q > r2) continue;
    const th = t - Math.sqrt(r2 - q);
    if (th < maxT && (!best || th < best.t)) best = { e: owner, part: h.part, t: th, boss: true };
  }
  return best;
}

// ======================================================================================
export class Joker {
  constructor(game) {
    this.g = game;
    this.load = 'idle';            // idle | loading | ready | failed
    this.pos = { x: 0, y: 0, z: 0 }; this.st = { vy: 0, peak: 0, fall: 0 }; this.vel = { x: 0, z: 0 };
    this.hs = []; this.yaw = 0; this.t = 0;
    this.state = 'OFF'; this.stateT = 0; this.dead = false;
    this.hp = JOKER.hp; this.maxHp = JOKER.hp;
    this.arena = false;
    // his own light (made with the town so adding it never recompiles the scene's shaders)
    this.light = new THREE.PointLight(0xb070ff, 0, 11, 1.5);
    game.scene.add(this.light);
  }

  // ---------- loading ----------
  preload() {
    if (this.load === 'loading' || this.load === 'ready') return;
    this.load = 'loading'; this.loadStart = performance.now();
    loadModels().then((m) => this.setup(m)).catch((e) => { console.warn('Joker models failed to load', e); this.load = 'failed'; });
  }

  // 'yes' when he can step in now, 'wait' while his models are still on the way, 'no' otherwise
  canAmbush() {
    if (this.used) return 'no';
    if (this.load === 'ready') return 'yes';
    if (this.load === 'idle' || this.load === 'failed') this.preload();
    if (this.load === 'loading' && performance.now() - this.loadStart < 45000) return 'wait';
    return 'no';
  }

  setup(m) {
    const g = this.g;
    this.rig = m.joker;
    this.root = new THREE.Group(); this.root.add(this.rig.root); this.root.visible = false; this.root.rotation.order = 'YXZ';
    g.scene.add(this.root);
    this.street = m.street.root; this.street.visible = false; g.scene.add(this.street);
    // his revolver: long purple barrel, ivory grip
    const gm = new THREE.MeshLambertMaterial({ color: 0x2a2630 }), pm = new THREE.MeshLambertMaterial({ color: 0x6a2a8a }), im = new THREE.MeshLambertMaterial({ color: 0xe8dcc0 });
    const gun = this.gun = new THREE.Group();
    const add = (geo, mat, x, y, z, rx = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.x = rx; gun.add(o); };
    add(new THREE.CylinderGeometry(0.018, 0.018, 0.26, 8), pm, 0, 0.03, 0.15, Math.PI / 2);
    add(new THREE.CylinderGeometry(0.04, 0.04, 0.07, 8), gm, 0, 0.025, 0.02, Math.PI / 2);
    add(new THREE.BoxGeometry(0.035, 0.11, 0.05), im, 0, -0.04, -0.03, -0.35);
    add(new THREE.BoxGeometry(0.03, 0.02, 0.12), gm, 0, 0.055, 0.08);
    gun.visible = false; g.scene.add(gun);
    this.muzzle = new THREE.Object3D(); this.muzzle.position.set(0, 0.03, 0.29); gun.add(this.muzzle);
    // laser sight and tracers
    const lineMat = (c, o) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, toneMapped: false, depthWrite: false });
    const mkLine = (mat) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)); const l = new THREE.Line(geo, mat); l.frustumCulled = false; l.visible = false; g.scene.add(l); return l; };
    this.laser = mkLine(lineMat(0xff2040, 0.85));
    this.tracers = [0, 1, 2, 3].map(() => ({ l: mkLine(lineMat(0xffe0a0, 0.9)), t: 0 }));
    // the laughing-gas canister
    this.can = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.24, 10), new THREE.MeshBasicMaterial({ color: 0x60ff70, toneMapped: false }));
    this.can.visible = false; g.scene.add(this.can);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: g.tex.glow, color: 0x50ff60, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    glow.scale.setScalar(0.8); this.can.add(glow);
    // hit spheres on his bones (metres)
    const B = this.rig.bones;
    const sp = (bone, r, part, oy = 0) => this.hs.push({ b: B[bone], r, part, oy, p: new THREE.Vector3() });
    sp('head', 0.26, 'head', 0.05); sp('Bone003', 0.27, 'body'); sp('Bone007', 0.22, 'body'); sp('Bone001', 0.24, 'body');
    for (const s of ['L', 'R']) { sp('leg' + s + '001', 0.15, 'leg'); sp('leg' + s + '002', 0.13, 'leg'); sp('leg' + s + '003', 0.12, 'leg'); sp('arm' + s + '001', 0.12, 'arm'); }
    this.cat = new CatNap(g, m.cat);
    this.nav = new ArenaNav(g.physics);
    this.pf = new Uint16Array(this.nav.w * this.nav.h); this.mf = new Uint16Array(this.nav.w * this.nav.h);
    this.load = 'ready';
  }

  // ---------- state ----------
  reset() {
    this.leave();
    this.used = false; this.state = 'OFF'; this.stateT = 0; this.dead = false; this.won = false;
    this.hp = this.maxHp = JOKER.hp; this.shownHp = this.hp; this.enraged = false; this.summoned = false;
    this.cool = { act: 1, shoot: 2, bomb: 6, vanish: 4, laugh: 9 };
    this.recent = 0; this.flinch = 0; this.vis = 1; this.lines = {}; this.moveSpeed = 0; this.aimAt = null;
    this.vel.x = this.vel.z = 0; this.st.vy = 0;
    if (this.root) this.root.visible = false;
    if (this.light) this.light.intensity = 0;
    if (this.gun) this.gun.visible = false;
    if (this.laser) this.laser.visible = false;
    if (this.can) this.can.visible = false;
    if (this.cat) this.cat.reset();
    this.fx('');
    this.thrown = false; this.canFly = null; this.announced = false; this.boss = null; this.act = null; this.spot = null;
    this._l2 = this._l3 = this._l4 = this._ban = this._thud = false;
    const cat = document.getElementById('catHud'); if (cat) cat.classList.remove('show');
    const hud = document.getElementById('bossHud'); if (hud) hud.classList.remove('joker');
  }

  get active() { return this.state !== 'OFF'; }
  solid() { return this.state === 'FIGHT' && this.vis > 0.5; }
  shielded() { return this.state === 'GAS' || this.state === 'WAKE' || (this.state === 'AMBUSH' && this.stateT > 6.2); }

  fx(cls) { const el = document.getElementById('jokerFx'); if (el) el.className = cls; }

  // the screen tint during the gas / white-out
  laugh(vol = 1, pos) {
    const a = this.g.audio, p = pos || [this.pos.x, this.pos.y + 2, this.pos.z];
    if (a.has('jokerLaugh')) a.play('jokerLaugh', { pos: p, vol: 1.4 * vol, ref: 8, max: 400, vary: 0.03 });
    else a.play('laugh', { pos: p, vol: 1.2 * vol, ref: 8, max: 400, verbAmt: 0.9 });
  }

  say(key, hi, en, sec = 3.2) {
    if (this.lines[key]) return; this.lines[key] = true;
    this.g.subtitle(hi, en);
    clearTimeout(this._subT); this._subT = setTimeout(() => this.g.subtitle(''), sec * 1000);
  }

  // ---------- 1. the ambush in town ----------
  ambush(boss) {
    const g = this.g, P = g.player;
    this.used = true; this.boss = boss;
    const bc = boss.chestPos();
    // stand where the player can see both of them: beside the giant, 7-12 m off
    const bx = boss.pos.x, bz = boss.pos.z, ax = bx - P.pos.x, az = bz - P.pos.z, al = Math.hypot(ax, az) || 1;
    let spot = null;
    for (const r of [7, 9, 5.5, 11]) for (const a of [0.75, -0.75, 1.1, -1.1, 0.45, -0.45, 1.6, -1.6]) {
      if (spot) break;
      const c = Math.cos(a), s = Math.sin(a), dx = (-ax * c + az * s) / al, dz = (-ax * s - az * c) / al;
      const x = bx + dx * r, z = bz + dz * r;
      if (this.clear(x, z) && this.seen(x, z)) spot = [x, z];
    }
    if (!spot) { const x = (P.pos.x + bx) / 2 + az / al * 3, z = (P.pos.z + bz) / 2 - ax / al * 3; spot = [x, z]; }
    this.pos.x = spot[0]; this.pos.z = spot[1]; this.pos.y = g.physics.groundAt(spot[0], spot[1], 0.3, 2.5); if (this.pos.y < -1e8) this.pos.y = 0;
    this.yaw = Math.atan2(bc[0] - this.pos.x, bc[2] - this.pos.z);
    this.to('AMBUSH');
    this.root.visible = true; this.vis = 1;
    this.puff(this.pos.x, this.pos.z, 26);
    this.laugh(1.1);
    g.toast('हा… हा… हा…', 'Someone is laughing behind the giant…');
  }

  clear(x, z) {
    const P = this.g.physics, tmp = [];
    const gy = P.groundAt(x, z, 0.3, 2.5);
    if (gy < -1e8 || gy > 1.5) return false;
    for (const b of P.query(x - 0.6, z - 0.6, x + 0.6, z + 0.6, tmp)) if (b.maxY > gy + 0.4 && b.minY < gy + 2.3 && P.constructor.circleOverlaps(b, x, z, 0.5)) return false;
    return true;
  }
  seen(x, z) {
    const P = this.g.player, cam = this.g.camera.position, ty = 1.6;
    const dx = x - cam.x, dy = ty - cam.y, dz = z - cam.z, l = Math.hypot(dx, dy, dz);
    return l > 3 && !this.g.physics.raycast(cam.x, cam.y, cam.z, dx / l, dy / l, dz / l, l - 0.5);
  }
  puff(x, z, n, col = [0.42, 0.18, 0.55]) {
    const S = this.g.explosives.smoke;
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, sp = 0.6 + Math.random() * 2.2; S.emit(x + Math.cos(a) * 0.3, 0.4 + Math.random() * 1.6, z + Math.sin(a) * 0.3, Math.cos(a) * sp, 0.4 + Math.random() * 1.2, Math.sin(a) * sp, 1.4 + Math.random() * 1.2, 0.8, 2.6, col, [0.2, 0.12, 0.25], 0.75, 0.3, 1.6); }
    this.g.fx.burst([x, 1.2, z], [0, 0.4, 0], 14, [0.7, 0.3, 1], 4, 0.5);
  }

  updateAmbush(dt) {
    const g = this.g, P = g.player, T = this.stateT, B = this.boss;
    const toPlayer = Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
    if (T < 2.3 && B && B.hs.length) {
      const h = B.hs.find((q) => q.part === 'head').p;
      this.aimAt = [h.x, h.y, h.z];
      this.face(h.x, h.z, dt, 6);
      if (T > 1.1 && !this.cued) { this.cued = true; g.audio.play('click', { pos: [this.pos.x, 1.6, this.pos.z], vol: 0.8, rate: 0.7 }); }
      if (T > 1.9 && !this.struck) {
        this.struck = true;
        this.fire(this.aimAt, true);
        g.fx.burst(this.aimAt, [0, 0.3, 0], 30, [0.45, 0.03, 0.02], 4, 0.9);
        B.killedByJoker();
      }
    } else {
      this.aimAt = null;
      this.yaw += angleDiff(this.yaw, toPlayer) * Math.min(1, dt * 3);
    }
    if (T > 2.4 && !this._l2) { this._l2 = true; this.laugh(1.2); }
    if (T > 2.6) this.say('kill', 'इतना सीरियस क्यों? अब यह खेल मेरा है!', 'Why so serious? This is MY game now!', 3);
    if (T > 5.6 && !this.thrown) {
      this.thrown = true;
      this.say('gas', 'चलो… कहीं और खेलते हैं!', "Let's play somewhere more… fun!", 3);
      // the gas canister: a lob that lands at the player's feet
      const hand = this.handPos(), to = [P.pos.x + (P.vel.x || 0) * 0.4, P.pos.y + 0.1, P.pos.z + (P.vel.y || 0) * 0.4];
      const dx = to[0] - hand.x, dz = to[2] - hand.z, Tf = clamp(Math.hypot(dx, dz) / 16, 0.8, 2.0), G = 14;
      this.canFly = { p: hand.clone(), v: new THREE.Vector3(dx / Tf, (to[1] - hand.y) / Tf + 0.5 * G * Tf, dz / Tf), t: 0, T: Tf, G };
      this.can.visible = true;
      g.audio.play('whoosh', { pos: [hand.x, hand.y, hand.z], vol: 0.8 });
    }
    if (this.canFly) {
      const c = this.canFly; c.t += dt; c.v.y -= c.G * dt; c.p.addScaledVector(c.v, dt);
      this.can.position.copy(c.p); this.can.rotation.x += dt * 9; this.can.rotation.z += dt * 5;
      if (c.t >= c.T) { this.canFly = null; this.can.visible = false; this.gas(c.p.x, c.p.z); this.to('GAS'); }
    }
  }

  gas(x, z) {
    const g = this.g, S = g.explosives.smoke;
    for (let i = 0; i < 70; i++) { const a = Math.random() * 6.28, sp = 1 + Math.random() * 4.5; S.emit(x, 0.3 + Math.random() * 1.4, z, Math.cos(a) * sp, 0.3 + Math.random() * 1.6, Math.sin(a) * sp, 3 + Math.random() * 2, 1.2, 5, [0.35, 0.95, 0.35], [0.2, 0.5, 0.25], 0.7, 0.4, 1.6); }
    g.audio.play(g.audio.has('gas') ? 'gas' : 'whoosh', { pos: [x, 1, z], vol: 1.3 });
    g.audio.play('bang', { pos: [x, 0.5, z], vol: 0.5, rate: 1.4 });
    this.fx('gas');
  }

  // ---------- 2. into the Playground ----------
  updateGas(dt) {
    const g = this.g, T = this.stateT;
    if (T > 0.8 && !this._l3) { this._l3 = true; this.laugh(1.3, [g.player.pos.x + 3, 2, g.player.pos.z]); }
    if (T > 1.6) this.fx('gas white');
    if (T > 3.4) this.enterArena();
  }

  enterArena() {
    const g = this.g, P = g.player;
    if (g.vehicles.driving) g.vehicles.exit(true);
    this.arena = true;
    this.street.visible = true;
    P.spawn(PLAYER_IN[0], 0, PLAYER_IN[1], Math.atan2(PLAYER_IN[0] - JOKER_IN[0], PLAYER_IN[1] - JOKER_IN[1]));
    P.health = Math.max(P.health, 75);
    this.pos.x = JOKER_IN[0]; this.pos.z = JOKER_IN[1]; this.pos.y = 0;
    this.yaw = Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
    // the town forgets you for now
    for (const e of g.enemies.list) if (!e.dead) { e.state = e.human ? 'PATROL' : 'IDLE'; e.alert = 0; e.stateT = 0; }
    g.chaseOn = false; g._chaseHold = 0; g.audio.fade('zombieChase', 0, 0.5);
    const fog = g.scene.fog; fog.color.setHex(0x160b1e); fog.density = 0.021;
    if (g.audio.hasTrack('jokerMusic')) g.audio.fade('jokerMusic', 0.55, 3);
    else if (!this.music && g.audio.ctx) { this.music = g.audio.loop('musicbox', 0, g.audio.music); this.music.gain.gain.linearRampToValueAtTime(0.3, g.audio.ctx.currentTime + 3); }
    this.to('WAKE');
    this.fx('white');
  }

  leave() {
    const g = this.g;
    if (this.arena) {
      this.arena = false;
      const fog = g.scene.fog; fog.color.setHex(0x0d1520); fog.density = 0.0165;
    }
    if (this.street) this.street.visible = false;
    if (this.music) { try { this.music.stop(); } catch (e) { /* stopped */ } this.music = null; }
    if (g.audio && g.audio.hasTrack && g.audio.hasTrack('jokerMusic')) g.audio.fade('jokerMusic', 0, 1);
    clearTimeout(this._subT);
  }

  updateWake(dt) {
    const g = this.g, T = this.stateT;
    if (T > 0.6) this.fx('fadeout');
    this.face(g.player.pos.x, g.player.pos.z, dt, 4);
    if (T > 1.4 && !this._l4) {
      this._l4 = true; this.laugh(1.2);
      this.say('wel', 'मेरे खेल के मैदान में स्वागत है!', 'Welcome to my playground!', 3);
    }
    if (T > 3.2 && !this._ban) {
      this._ban = true;
      g.banner(JOKER.name, JOKER.en, 'joker');
      this.ui(true);
    }
    if (T > 4.4) { this.fx(''); this.to('FIGHT'); this.act = 'MOVE'; this.actT = 0; this.cool.act = 0.5; this.pickSpot(); }
  }

  // ---------- HUD ----------
  ui(on) {
    const el = document.getElementById('bossHud');
    if (!el) return;
    if (on) {
      document.getElementById('bossName').innerHTML = `${JOKER.name} <small>${JOKER.en}</small>`;
      el.classList.remove('gone', 'rage'); el.classList.add('show', 'joker', 'pulse');
      document.getElementById('bossFill').style.width = '100%'; document.getElementById('bossTrail').style.width = '100%';
    } else el.classList.remove('show');
    this._uiHp = -1;
  }
  uiUpdate(dt) {
    this.shownHp = lerp(this.shownHp, this.hp, 1 - Math.exp(-dt * 2.5));
    const k = Math.max(0, this.hp / this.maxHp), kt = Math.max(0, this.shownHp / this.maxHp);
    if (Math.abs(k - this._uiHp) > 0.0005 || Math.abs(kt - (this._uiTr || 0)) > 0.002) {
      this._uiHp = k; this._uiTr = kt;
      document.getElementById('bossFill').style.width = (k * 100).toFixed(1) + '%';
      document.getElementById('bossTrail').style.width = (kt * 100).toFixed(1) + '%';
      document.getElementById('bossHud').classList.toggle('rage', this.enraged);
    }
    this.cat.uiUpdate();
  }

  // ---------- damage ----------
  hitTest(o, d, maxT) {
    let best = null;
    if (this.solid()) {
      const c = this.hs[1].p, cx = c.x - o.x, cy = c.y - o.y, cz = c.z - o.z, tc = cx * d.x + cy * d.y + cz * d.z;
      if (tc > -2 && tc < maxT + 2 && cx * cx + cy * cy + cz * cz - tc * tc < 4) best = sphereHit(this, this.hs, o, d, maxT);
    }
    if (this.cat && this.cat.solid()) { const h = this.cat.hitTest(o, d, best ? best.t : maxT); if (h) best = h; }
    return best;
  }

  damage(dmg, part, dir, src) {
    if (src === 'joker' || !this.solid()) return false;
    const n = dmg * (part === 'head' ? 2 : part === 'leg' || part === 'arm' ? 0.7 : 1);
    this.hp -= n; this.recent += n; this.flinch = Math.min(1, this.flinch + n / 80);
    if (Math.random() < 0.3) this.g.audio.play('laugh', { pos: [this.pos.x, 2, this.pos.z], vol: 0.5, rate: 1.4 + Math.random() * 0.3 });
    if (!this.summoned && this.hp < this.maxHp * 0.6 && this.hp > 0) this.summon();
    if (!this.enraged && this.hp < this.maxHp * 0.3 && this.hp > 0) {
      this.enraged = true; this.laugh(1.4);
      this.say('rage', 'अब आएगा असली मज़ा!', 'NOW it gets funny!', 2.6);
      this.g.toast('जोकर पागल हो गया!', 'The Joker has lost it — faster, deadlier!');
    }
    if (this.hp <= 0) { this.hp = 0; this.die(); return true; }
    return false;
  }

  blast(x, y, z, R, maxD, src) {
    let hit = false;
    if (src !== 'joker' && this.solid()) {
      const c = this.hs[1].p, d = Math.max(0, Math.hypot(c.x - x, c.y - 0.8 - y, c.z - z) - 0.4);
      if (d < R) { this.damage(maxD * 0.8 * Math.pow(1 - d / R, 1.1), 'body', null, src); hit = true; }
    }
    if (this.cat && this.cat.blast(x, y, z, R, maxD, src)) hit = true;
    return hit;
  }

  die() {
    const g = this.g;
    this.to('DEAD'); this.dead = true;
    this.laser.visible = false; this.gun.visible = false;
    g.stats.kills++;
    this.laugh(0.9);
    if (this.cat.state !== 'OFF' && this.cat.state !== 'DEAD') this.cat.die();
  }

  summon() {
    this.summoned = true;
    const P = this.g.player;
    let best = null, bd = -1;
    for (const [mx, mz] of CAT_SPOTS) {
      const [x, z] = W(mx, mz), d = Math.hypot(x - P.pos.x, z - P.pos.z);
      if (d > 14 && d < 40 && this.nav.free(this.nav.idx(x, z)) && (bd < 0 || Math.abs(d - 22) < Math.abs(bd - 22))) { best = [x, z]; bd = d; }
    }
    if (!best) best = W(4.3, -5.4);
    this.say('cat', 'किटी! खाना आ गया!', "Kitty! Dinner's here!", 3);
    this.g.toast('कैटनैप आ गया!', 'The Joker let his pet out — CATNAP!');
    this.cat.spawn(best[0], best[1]);
  }

  // ---------- per frame ----------
  update(dt) {
    if (this.load !== 'ready' || this.state === 'OFF') return;
    const g = this.g;
    this.t += dt; this.stateT += dt;
    for (const k in this.cool) this.cool[k] -= dt;
    this.flinch = Math.max(0, this.flinch - dt * 2); this.recent = Math.max(0, this.recent - dt * 60);
    if (this.state === 'AMBUSH') this.updateAmbush(dt);
    else if (this.state === 'GAS') this.updateGas(dt);
    else if (this.state === 'WAKE') this.updateWake(dt);
    else if (this.state === 'FIGHT') this.fight(dt);
    else if (this.state === 'DEAD') this.dying(dt);
    for (const tr of this.tracers) if (tr.l.visible && (tr.t -= dt) <= 0) tr.l.visible = false;
    if (this.arena) {
      this._pfT = (this._pfT || 0) - dt;
      if (this._pfT <= 0) { this._pfT = 0.35; this.nav.field(g.player.pos.x, g.player.pos.z, this.pf); }
      this.cat.update(dt, this);
      if (this.state === 'FIGHT' || this.state === 'DEAD') this.uiUpdate(dt);
    }
    this.pose(dt);
  }

  to(s) { this.state = s; this.stateT = 0; this.struck = false; this.cued = false; }
  face(tx, tz, dt, k = 5) { this.yaw += angleDiff(this.yaw, Math.atan2(tx - this.pos.x, tz - this.pos.z)) * Math.min(1, dt * k); }

  handPos() { return this.rig.bones.handR001.getWorldPosition(new THREE.Vector3()); }

  // a revolver shot from the muzzle toward `to`; at the giant it always lands
  fire(to, sure) {
    const g = this.g, m = this.muzzle.getWorldPosition(_v2);
    const P = g.player;
    g.audio.play(g.audio.has('revolver') ? 'revolver' : 'pistol', { pos: [m.x, m.y, m.z], vol: 1.1, far: 30, max: 300 });
    g.enemyMuzzle([m.x, m.y, m.z]);
    const L = g.arsenal.flashLight; L.position.copy(m); L.distance = 12; L.intensity = Math.max(L.intensity, 30);
    let end = to, hit = !!sure;
    if (!sure) {
      const tx = P.pos.x, ty = P.pos.y + 1.25, tz = P.pos.z;
      const dx = tx - m.x, dy = ty - m.y, dz = tz - m.z, d = Math.hypot(dx, dy, dz);
      const pv = P.vel ? Math.hypot(P.vel.x, P.vel.y) : 0;
      const chance = clamp((this.enraged ? 0.92 : 0.82) - d * 0.014 - pv * 0.05 - (P.crouched ? 0.1 : 0), 0.22, 0.9);
      const wall = g.physics.raycast(m.x, m.y, m.z, dx / d, dy / d, dz / d, d - 0.3);
      if (wall) { end = [m.x + dx / d * wall.t, m.y + dy / d * wall.t, m.z + dz / d * wall.t]; g.fx.hole(end, [wall.nx, wall.ny, wall.nz]); g.fx.burst(end, [wall.nx, wall.ny, wall.nz], 5, [0.75, 0.7, 0.6], 1.6, 0.4); hit = false; }
      else if (Math.random() < chance) { end = [tx, ty, tz]; hit = true; g.hurtPlayer((g.vehicles.driving ? 6 : 9) + Math.random() * 4, this); }
      else {
        // a near miss: whips past and smacks the ground or a wall behind
        const ox = (Math.random() - 0.5) * 1.6, oy = (Math.random() - 0.3) * 1.2, ex = tx + ox - m.x, ey = ty + oy - m.y, ez = tz + (Math.random() - 0.5) * 1.6 - m.z, el = Math.hypot(ex, ey, ez);
        const w2 = g.physics.raycast(m.x, m.y, m.z, ex / el, ey / el, ez / el, 60);
        const t = w2 ? w2.t : 40; end = [m.x + ex / el * t, m.y + ey / el * t, m.z + ez / el * t];
        if (w2) g.fx.hole(end, [w2.nx, w2.ny, w2.nz]);
        g.audio.play('ricochet', { pos: [tx + ox, ty, tz], vol: 0.5 });
      }
    }
    const tr = this.tracers.find((q) => !q.l.visible) || this.tracers[0];
    const a = tr.l.geometry.attributes.position.array; a[0] = m.x; a[1] = m.y; a[2] = m.z; a[3] = end[0]; a[4] = end[1]; a[5] = end[2];
    tr.l.geometry.attributes.position.needsUpdate = true; tr.l.visible = true; tr.t = 0.06;
    return hit;
  }

  // ---------- 3. the fight ----------
  pickSpot() {
    const g = this.g, N = this.nav, P = g.player, f = this.pf;
    const want = this.enraged ? [6, 12] : [8, 15];
    let best = -1, score = -1e9;
    for (let k = 0; k < 40; k++) {
      const i = (Math.random() * f.length) | 0;
      if (!N.free(i) || f[i] === 65535) continue;
      const [x, z] = N.centre(i), d = f[i];
      let s = -Math.abs(d - (want[0] + want[1]) / 2) - Math.hypot(x - this.pos.x, z - this.pos.z) * 0.15 + Math.random() * 3;
      if (d < want[0]) s -= 8;
      const dx = P.pos.x - x, dz = P.pos.z - z, dl = Math.hypot(dx, dz);
      if (dl > 1 && !g.physics.raycast(x, 1.8, z, dx / dl, (P.pos.y + 1.5 - 1.8) / dl, dz / dl, dl - 0.5)) s += 6;
      if (s > score) { score = s; best = i; }
    }
    this.spot = best >= 0 ? N.centre(best) : null;
    if (this.spot) N.field(this.spot[0], this.spot[1], this.mf);
    this.spotT = 3 + Math.random() * 2.5;
  }

  sees() {
    const g = this.g, P = g.player, h = this.hs[0].p;
    const dx = P.pos.x - h.x, dy = P.pos.y + P.eye - h.y, dz = P.pos.z - h.z, l = Math.hypot(dx, dy, dz);
    return !g.physics.raycast(h.x, h.y, h.z, dx / l, dy / l, dz / l, l - 0.4);
  }

  move(dx, dz, speed, dt) {
    const g = this.g, l = Math.hypot(dx, dz);
    if (l > 1e-4) { dx /= l; dz /= l; }
    this.vel.x = lerp(this.vel.x, dx * speed, 1 - Math.exp(-dt * 7)); this.vel.z = lerp(this.vel.z, dz * speed, 1 - Math.exp(-dt * 7));
    const ox = this.pos.x, oz = this.pos.z;
    g.physics.moveCharacter(this.pos, this.vel.x * dt, this.vel.z * dt, this.st.vy, dt, 0.35, 2.3, 0.45, this.st);
    this.moveSpeed = Math.hypot(this.pos.x - ox, this.pos.z - oz) / Math.max(dt, 1e-4);
  }

  vanish() {
    const g = this.g, N = this.nav, f = this.pf, P = g.player;
    this.puff(this.pos.x, this.pos.z, 30);
    this.laugh(0.9);
    let best = -1, bs = -1e9;
    for (let k = 0; k < 60; k++) {
      const i = (Math.random() * f.length) | 0;
      if (!N.free(i) || f[i] === 65535 || f[i] < 9) continue;
      const s = -Math.abs(f[i] - 13) + Math.random() * 4;
      if (s > bs) { bs = s; best = i; }
    }
    if (best >= 0) { const [x, z] = N.centre(best); this.pos.x = x; this.pos.z = z; }
    this.vel.x = this.vel.z = 0;
    this.act = 'POOF'; this.actT = 0; this.vis = 0; this.cool.vanish = (this.enraged ? 4 : 6.5) + Math.random() * 3; this.recent = 0;
    this.pickSpot();
  }

  lob() {
    const g = this.g, P = g.player, from = this.handPos(), lead = 0.5;
    const tx = P.pos.x + (P.vel.x || 0) * lead + (Math.random() - 0.5) * 2.5, tz = P.pos.z + (P.vel.y || 0) * lead + (Math.random() - 0.5) * 2.5;
    const dx = tx - from.x, dz = tz - from.z, T = clamp(Math.hypot(dx, dz) / 12, 0.75, 1.8), G = 16;
    g.explosives.throwBomb(from, new THREE.Vector3(dx / T, (P.pos.y + 0.1 - from.y) / T + 0.5 * G * T, dz / T), 'joker', BOMB.enemyFuse - 0.5);
    g.audio.play('whoosh', { pos: [from.x, from.y, from.z], vol: 0.7, rate: 0.9 });
  }

  fight(dt) {
    const g = this.g, P = g.player, rage = this.enraged ? 1.25 : 1;
    const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z, d = Math.hypot(dx, dz);
    this.dist = d;
    this.actT += dt;
    this._seeT = (this._seeT || 0) - dt;
    if (this._seeT <= 0) { this._seeT = 0.25; this.canSee = this.sees(); }
    this.aimAt = null; this.laser.visible = false;
    if (P.dead) { this.move(0, 0, 0, dt); this.act = 'LAUGH'; return; }
    if (this.act === 'POOF') {
      this.move(0, 0, 0, dt);
      if (this.actT > 0.55) { this.vis = 1; this.puff(this.pos.x, this.pos.z, 18); this.act = 'MOVE'; this.actT = 0; this.cool.act = 0.4; }
      return;
    }
    // too close or hurt badly in a moment: gone in a puff of smoke
    if ((this.recent > 170 || (d < 3.2 && Math.random() < dt * 1.5)) && this.cool.vanish <= 0 && this.act !== 'SLASH') { this.vanish(); return; }
    switch (this.act) {
      case 'MOVE': {
        this.spotT -= dt;
        if (!this.spot || this.spotT <= 0) this.pickSpot();
        let mx = 0, mz = 0, sp = (d > 18 ? 5 : 3.8) * rage;
        if (this.spot) {
          const s = this.nav.step(this.mf, this.pos.x, this.pos.z);
          if (s && s[2] > 0) { mx = s[0]; mz = s[1]; } else if (Math.hypot(this.spot[0] - this.pos.x, this.spot[1] - this.pos.z) < 1.2) { this.spot = null; sp = 0; }
        }
        if (d < 2.6) { mx = -dx; mz = -dz; sp = 4 * rage; }
        this.move(mx, mz, sp, dt);
        if (this.canSee || d < 6) this.face(P.pos.x, P.pos.z, dt, 5);
        else if (Math.hypot(this.vel.x, this.vel.z) > 0.5) this.yaw += angleDiff(this.yaw, Math.atan2(this.vel.x, this.vel.z)) * Math.min(1, dt * 6);
        if (this.cool.act > 0) break;
        if (d < 2.4 && Math.abs(P.pos.y - this.pos.y) < 1.5) { this.act = 'SLASH'; this.actT = 0; this.struck = false; break; }
        if (this.canSee && d < 34 && this.cool.shoot <= 0) { this.act = 'AIM'; this.actT = 0; this.shots = this.enraged ? 5 : 3; break; }
        if (d > 5 && d < 22 && this.cool.bomb <= 0 && (this.canSee || Math.random() < 0.3)) { this.act = 'THROW'; this.actT = 0; this.struck = false; break; }
        if (this.cool.laugh <= 0 && d > 9) { this.act = 'LAUGH'; this.actT = 0; this.laugh(1); this.cool.laugh = 10 + Math.random() * 8; break; }
        break;
      }
      case 'AIM': {
        this.move(0, 0, 0, dt);
        this.face(P.pos.x, P.pos.z, dt, 8);
        this.aimAt = [P.pos.x, P.pos.y + 1.25, P.pos.z];
        const m = this.muzzle.getWorldPosition(_v), a = this.laser.geometry.attributes.position.array;
        const ex = this.aimAt[0] - m.x, ey = this.aimAt[1] - m.y, ez = this.aimAt[2] - m.z, el = Math.hypot(ex, ey, ez) || 1;
        const w = g.physics.raycast(m.x, m.y, m.z, ex / el, ey / el, ez / el, el);
        const t = w ? w.t : el;
        a[0] = m.x; a[1] = m.y; a[2] = m.z; a[3] = m.x + ex / el * t; a[4] = m.y + ey / el * t; a[5] = m.z + ez / el * t;
        this.laser.geometry.attributes.position.needsUpdate = true; this.laser.visible = true;
        this.laser.material.opacity = 0.45 + 0.4 * Math.sin(this.actT * 30);
        if (!this.cued) { this.cued = true; g.audio.play('click', { pos: [m.x, m.y, m.z], vol: 0.7, rate: 0.75 }); }
        if (this.actT > (this.enraged ? 0.45 : 0.62)) { this.act = 'SHOOT'; this.actT = 0; this.shotT = 0; this.cued = false; }
        break;
      }
      case 'SHOOT': {
        this.move(0, 0, 0, dt);
        this.face(P.pos.x, P.pos.z, dt, 6);
        this.aimAt = [P.pos.x, P.pos.y + 1.25, P.pos.z];
        this.shotT -= dt;
        if (this.shotT <= 0 && this.shots > 0) { this.shots--; this.shotT = this.enraged ? 0.16 : 0.22; this.fire(null, false); this.kick = 1; }
        if (this.shots <= 0 && this.shotT <= -0.25) { this.act = 'MOVE'; this.actT = 0; this.cool.act = 0.5; this.cool.shoot = (this.enraged ? 1.4 : 2.2) + Math.random() * 1.2; }
        break;
      }
      case 'THROW': {
        this.move(0, 0, 0, dt);
        this.face(P.pos.x, P.pos.z, dt, 6);
        if (this.actT > 0.55 && !this.struck) { this.struck = true; this.lob(); if (this.enraged && Math.random() < 0.5) setTimeout(() => this.state === 'FIGHT' && this.lob(), 350); }
        if (this.actT > 1.0) { this.act = 'MOVE'; this.actT = 0; this.cool.act = 0.5; this.cool.bomb = (this.enraged ? 5 : 8) + Math.random() * 3; }
        break;
      }
      case 'SLASH': {
        this.move(0, 0, 0, dt);
        if (this.actT < 0.32) this.face(P.pos.x, P.pos.z, dt, 8);
        if (this.actT > 0.36 && !this.struck) {
          this.struck = true;
          g.audio.play('whoosh', { pos: [this.pos.x, 1.4, this.pos.z], vol: 0.9, rate: 1.3 });
          const ang = Math.abs(angleDiff(this.yaw, Math.atan2(dx, dz)));
          if (d < 2.9 && ang < 1.2) { g.hurtPlayer(15 + Math.random() * 6, this); g.physics.moveCharacter(P.pos, dx / (d || 1) * 1.1, dz / (d || 1) * 1.1, 0, 0.016, P.radius, 1.75, 0.45, P.state); }
        }
        if (this.actT > 0.75) { this.act = 'MOVE'; this.actT = 0; this.cool.act = 0.3; if (this.cool.vanish <= 0) this.vanish(); }
        break;
      }
      case 'LAUGH': {
        this.move(0, 0, 0, dt);
        this.face(P.pos.x, P.pos.z, dt, 3);
        if (this.actT > 1.6) { this.act = 'MOVE'; this.actT = 0; this.cool.act = 0.2; }
        break;
      }
      default: this.act = 'MOVE';
    }
    // keep the player out of his coat
    if (!g.vehicles.driving && d < 0.75 && d > 1e-3) g.physics.moveCharacter(P.pos, dx / d * (0.75 - d), dz / d * (0.75 - d), 0, 0.016, P.radius, 1.75, 0.45, P.state);
    // pegs on concrete
    if (this.moveSpeed > 0.5) {
      const s = Math.sin(this.phase || 0) > 0 ? 1 : 0;
      if (s !== this.stepS) { this.stepS = s; g.audio.play('step_wood', { pos: [this.pos.x, 0.2, this.pos.z], vol: 0.5, rate: 1.3, ref: 3 }); }
    }
  }

  dying(dt) {
    const g = this.g, T = this.stateT;
    this.move(0, 0, 0, dt);
    if (T > 1.4 && !this._thud) { this._thud = true; g.audio.play('slam', { pos: [this.pos.x, 0.3, this.pos.z], vol: 0.9, rate: 0.8 }); this.puff(this.pos.x, this.pos.z, 14, [0.3, 0.3, 0.32]); }
    if (T > 2.6 && !this.announced) {
      this.announced = true;
      g.banner('THE JOKER IS DEAD', 'जोकर मारा गया · MISSION COMPLETE', 'win');
      document.getElementById('bossHud').classList.add('gone');
      if (this.music) this.music.gain.gain.linearRampToValueAtTime(0, g.audio.ctx.currentTime + 4);
      if (g.audio.hasTrack('jokerMusic')) g.audio.fade('jokerMusic', 0, 4);
    }
    if (T > 7 && !this.won) { this.won = true; g.jokerVictory(); }
  }

  // ---------- procedural animation ----------
  pose(dt) {
    const rig = this.rig, t = this.t, st = this.state, act = this.act;
    restAll(rig);
    const R = this.root;
    R.visible = this.vis > 0.5;
    R.position.set(this.pos.x, this.pos.y, this.pos.z);
    R.rotation.set(0, this.yaw, 0);
    const sp = st === 'FIGHT' ? Math.min(1, (this.moveSpeed || 0) / 3.5) : 0;
    this.phase = (this.phase || 0) + ((this.moveSpeed || 0) * 2.1 + 0.0001) * dt;
    const ph = this.phase;
    let armL = [0, 0, -1.3], armR = [0, 0, 1.3], foreL = 0, foreR = 0, spine = 0.05, head = [0, 0, Math.sin(t * 0.9) * 0.28], bob = 0, hip = [0, 0];
    // walking: a skipping, bouncing jester gait
    if (sp > 0.05) {
      const a = Math.sin(ph) * 0.65 * sp;
      poseBone(rig, 'legL', Q(-a, 0, 0)); poseBone(rig, 'legR', Q(a, 0, 0));
      poseBone(rig, 'legL002', Q(Math.max(0, Math.sin(ph + 1.2)) * 1.1 * sp, 0, 0)); poseBone(rig, 'legR002', Q(Math.max(0, Math.sin(ph + 1.2 + Math.PI)) * 1.1 * sp, 0, 0));
      armL = [a * 0.7, 0, -1.25]; armR = [-a * 0.7, 0, 1.25];
      bob = Math.abs(Math.sin(ph)) * 0.16 * sp; spine = 0.12 * sp;
      head = [0, Math.sin(ph) * 0.12, Math.sin(t * 0.9) * 0.2];
    } else {
      // idle: a slow sway and that tilted, staring head
      hip = [Math.sin(t * 1.3) * 0.04, Math.sin(t * 0.7) * 0.05];
      poseBone(rig, 'legL', Q(0, 0, 0.05)); poseBone(rig, 'legR', Q(0, 0, -0.05));
      armL = [Math.sin(t * 1.1) * 0.08, 0, -1.15]; armR = [-Math.sin(t * 1.1) * 0.08, 0, 1.15];
      foreL = 0.3; foreR = 0.3;
    }
    let laughK = 0;
    if ((st === 'AMBUSH' && this.stateT > 2.3 && this.stateT < 5.3) || (st === 'WAKE' && this.stateT > 1.3) || (st === 'FIGHT' && act === 'LAUGH') || (st === 'GAS')) laughK = 1;
    if (laughK) {
      // the cackle: head thrown back, shoulders shaking, arms flung wide
      const sh = Math.sin(t * 26) * 0.07;
      spine = -0.28 + sh; head = [-0.45 + sh * 2, 0, Math.sin(t * 2) * 0.15];
      armL = [-0.2, 0, 0.35 + sh * 3]; armR = [-0.2, 0, -0.35 - sh * 3]; foreL = -0.6; foreR = -0.6;
      bob = Math.abs(sh) * 0.6;
    }
    // throwing (the gas canister in town, bombs in the arena): left hand, over the top
    let throwK = -1;
    if (st === 'AMBUSH' && this.stateT > 5.0 && this.stateT < 6.2) throwK = (this.stateT - 5.0) / 0.6;
    if (st === 'FIGHT' && act === 'THROW') throwK = this.actT / 0.55;
    if (throwK >= 0) {
      const k = throwK < 1 ? ease(throwK) : 1 - ease((throwK - 1) * 2);
      const sw = throwK < 1 ? lerp(-0.3, 2.4, k) : lerp(2.4, -1.4, ease((throwK - 1) * 2.5));
      armL = [-sw, 0, -1.35]; spine = 0.1 + (throwK < 1 ? -0.15 * k : 0.25);
      head = [0.1, 0, 0];
    }
    if (st === 'FIGHT' && act === 'SLASH') {
      const k = this.actT < 0.36 ? ease(this.actT / 0.36) : 1 - ease((this.actT - 0.36) / 0.3);
      armR = [-1.2 * k, this.actT < 0.36 ? -0.9 * k : lerp(-0.9, 1.2, ease((this.actT - 0.36) / 0.2)), 1.2 - 0.9 * k]; spine = 0.25 * k;
    }
    if (st === 'DEAD') {
      const u = ease(this.stateT / 1.4);
      spine = -0.4 * u; head = [-0.6 * u, 0, 0.3 * u]; armL = [-0.6 * u, 0, -1.3 + 0.7 * u]; armR = [-0.6 * u, 0, 1.3 - 0.7 * u];
      R.rotation.x = -u * 1.45; R.position.y = this.pos.y + Math.sin(u * Math.PI) * 0.3 + u * 0.2;
      poseBone(rig, 'legL', Q(-0.6 * u, 0, 0.1)); poseBone(rig, 'legR', Q(-0.3 * u, 0, -0.1));
    }
    // flinch from hits
    spine -= this.flinch * 0.3;
    poseBone(rig, 'Bone001', Q(hip[0], hip[1], 0));
    poseBone(rig, 'Bone003', Q(spine, 0, 0));
    poseBone(rig, 'head', Q(head[0], head[1], head[2]));
    poseBone(rig, 'armL', Q(armL[0], armL[1], armL[2]));
    poseBone(rig, 'armL001', Q(0, 0, -foreL));
    // the gun arm: points straight at what he is shooting at
    const aiming = this.aimAt && (st !== 'FIGHT' || act === 'AIM' || act === 'SHOOT');
    if (aiming) {
      const a = this.aimAt, sh = rig.bones.armR.getWorldPosition(_v);
      _v2.set(a[0] - sh.x, a[1] - sh.y, a[2] - sh.z).normalize().applyAxisAngle(THREE.Object3D.DEFAULT_UP, -this.yaw);
      this.kick = Math.max(0, (this.kick || 0) - dt * 8);
      _v2.y += this.kick * 0.25; _v2.normalize();
      poseBone(rig, 'armR', _qb.setFromUnitVectors(RIGHT_ARM, _v2));
    } else {
      poseBone(rig, 'armR', Q(armR[0], armR[1], armR[2]));
      poseBone(rig, 'armR001', Q(0, 0, foreR));
    }
    R.position.y += bob;
    R.updateMatrixWorld(true);
    // a sickly purple-green glow in front of him so he reads at night
    const Lt = this.light, on = R.visible && st !== 'OFF';
    Lt.intensity = on ? (this.arena ? 5 : 12) * (st === 'DEAD' ? Math.max(0, 1 - this.stateT / 3) : 1) * (0.85 + Math.sin(t * 7) * 0.15) : 0;
    if (on) { Lt.position.set(this.pos.x + Math.sin(this.yaw) * 1.3, this.pos.y + 2.4, this.pos.z + Math.cos(this.yaw) * 1.3); Lt.color.setHSL(0.78 - Math.max(0, Math.sin(t * 0.8)) * 0.42, 0.85, 0.6); }
    // the revolver rides in his right hand
    const G = this.gun;
    G.visible = R.visible && st !== 'DEAD' && st !== 'OFF';
    if (G.visible) {
      const hand = rig.bones.handR001.getWorldPosition(_v), fore = rig.bones.armR002.getWorldPosition(_v2);
      G.position.copy(hand);
      _v2.subVectors(hand, fore).normalize().multiplyScalar(2).add(hand);
      G.lookAt(_v2);
      G.updateMatrixWorld(true);
    }
    for (const h of this.hs) { h.b.getWorldPosition(h.p); h.p.y += h.oy; }
  }
}

// ======================================================================================
// CatNap: the Joker's pet. Hunts the player through the arena with the grid path-finder.
class CatNap {
  constructor(g, m) {
    this.g = g; this.m = m;
    this.root = m.root; this.root.visible = false; this.root.rotation.order = 'YXZ'; g.scene.add(this.root);
    this.mixer = new THREE.AnimationMixer(m.scene);
    this.acts = {};
    for (const [k, c] of Object.entries(m.clips)) this.acts[k] = this.mixer.clipAction(c);
    this.pos = { x: 0, y: 0, z: 0 }; this.st = { vy: 0, peak: 0, fall: 0 }; this.vel = { x: 0, z: 0 };
    const B = m.bones;
    this.hs = [];
    const sp = (bone, r, part) => { if (B[bone]) this.hs.push({ b: B[bone], r, part, p: new THREE.Vector3() }); };
    sp('JNT_Head', 0.5, 'head'); sp('JNT_Spine_02', 0.5, 'body'); sp('JNT_Spine_04', 0.5, 'body'); sp('JNT_Spine_06', 0.45, 'body'); sp('JNT_Spine_01', 0.45, 'body');
    for (const s of ['L', 'R']) for (const e of ['Front', 'Back']) sp(`JNT_${s}_${e}_Knee`, 0.25, 'leg');
    this.gasBone = B.JNT_Head_RedGasSocket || B.JNT_Head;
    this.reset();
  }

  reset() {
    this.state = 'OFF'; this.stateT = 0; this.hp = CATNAP.hp; this.root.visible = false; this.cur = null; this.mixer.stopAllAction();
    this.root.rotation.set(0, 0, 0);
  }
  solid() { return this.state !== 'OFF' && this.state !== 'DEAD'; }

  play(name, fade = 0.25, ts = 1, once = false) {
    const a = this.acts[name]; if (!a) return;
    if (this.cur === a) { a.timeScale = ts; return; }
    a.reset(); a.timeScale = ts; a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = once;
    a.play();
    if (this.cur) this.cur.crossFadeTo(a, fade, false);
    this.cur = a;
  }

  spawn(x, z) {
    const g = this.g, P = g.player;
    this.pos.x = x; this.pos.z = z; this.pos.y = 0;
    this.yaw = Math.atan2(P.pos.x - x, P.pos.z - z);
    this.state = 'INTRO'; this.stateT = 0; this.hp = CATNAP.hp;
    this.root.visible = true;
    this.play('A_CatNap_Search_PlayerSpotted', 0, 1.1, true);
    const S = g.explosives.smoke;
    for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, s = 1 + Math.random() * 3; S.emit(x, 0.4 + Math.random() * 2, z, Math.cos(a) * s, 0.5 + Math.random(), Math.sin(a) * s, 2 + Math.random() * 1.5, 1, 3.5, [0.75, 0.08, 0.1], [0.3, 0.05, 0.08], 0.7, 0.3, 1.4); }
    g.audio.play('roar', { pos: [x, 2, z], vol: 1.2, rate: 1.9, max: 300 });
    g.audio.play('scream', { pos: [x, 2, z], vol: 0.9, rate: 0.55 });
    const hud = document.getElementById('catHud'); if (hud) hud.classList.add('show');
    this._ui = -1;
  }

  uiUpdate() {
    if (this.state === 'OFF') return;
    const k = Math.max(0, this.hp / CATNAP.hp);
    if (Math.abs(k - this._ui) > 0.002) { this._ui = k; const f = document.getElementById('catFill'); if (f) f.style.width = (k * 100).toFixed(1) + '%'; }
  }

  hitTest(o, d, maxT) { return sphereHit(this, this.hs, o, d, maxT); }

  damage(dmg, part, dir, src) {
    if (!this.solid() || src === 'joker') return false;
    const n = dmg * (part === 'head' ? 1.8 : part === 'leg' ? 0.7 : 1);
    this.hp -= n;
    if (Math.random() < 0.2) this.g.audio.play('growl', { pos: [this.pos.x, 2, this.pos.z], vol: 0.7, rate: 0.7 });
    if (this.hp <= 0) { this.hp = 0; this.die(); return true; }
    return false;
  }
  blast(x, y, z, R, maxD, src) {
    if (!this.solid() || src === 'joker') return false;
    const c = this.hs[1].p, d = Math.max(0, Math.hypot(c.x - x, c.y - 0.8 - y, c.z - z) - 0.8);
    if (d > R) return false;
    this.damage(maxD * Math.pow(1 - d / R, 1.1), 'body', null, src);
    return true;
  }
  die() {
    if (this.state === 'DEAD' || this.state === 'OFF') return;
    this.state = 'DEAD'; this.stateT = 0;
    this.g.audio.play('scream', { pos: [this.pos.x, 2, this.pos.z], vol: 1, rate: 0.45 });
    this.g.stats.kills++;
    if (this.cur) this.cur.timeScale = 0.25;
    const hud = document.getElementById('catHud'); if (hud) hud.classList.remove('show');
    const J = this.g.joker;
    if (J && J.state === 'FIGHT') J.say('catdead', 'मेरी किटी! तुम्हें इसकी क़ीमत चुकानी होगी!', "My kitty! You'll pay for that!", 3);
  }

  move(dx, dz, speed, dt) {
    const g = this.g, l = Math.hypot(dx, dz);
    if (l > 1e-4) { dx /= l; dz /= l; }
    this.vel.x = lerp(this.vel.x, dx * speed, 1 - Math.exp(-dt * 5)); this.vel.z = lerp(this.vel.z, dz * speed, 1 - Math.exp(-dt * 5));
    const ox = this.pos.x, oz = this.pos.z;
    g.physics.moveCharacter(this.pos, this.vel.x * dt, this.vel.z * dt, this.st.vy, dt, 0.6, 2.4, 0.5, this.st);
    this.moveSpeed = Math.hypot(this.pos.x - ox, this.pos.z - oz) / Math.max(dt, 1e-4);
    if (this.moveSpeed > 0.3) this.yaw += angleDiff(this.yaw, Math.atan2(this.vel.x, this.vel.z)) * Math.min(1, dt * 5);
  }

  update(dt, J) {
    if (this.state === 'OFF') return;
    const g = this.g, P = g.player;
    this.stateT += dt;
    const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z, d = Math.hypot(dx, dz);
    const rage = J.enraged ? 1.15 : 1;
    switch (this.state) {
      case 'INTRO':
        this.move(0, 0, 0, dt);
        this.yaw += angleDiff(this.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 3);
        if (this.stateT > 2.6) { this.state = 'HUNT'; this.stateT = 0; this.cool = 1.5; this.gasCool = 4; }
        break;
      case 'HUNT': {
        this.cool -= dt; this.gasCool -= dt;
        let mx = dx, mz = dz;
        const s = J.nav.step(J.pf, this.pos.x, this.pos.z);
        if (s && s[2] > 1) { mx = s[0]; mz = s[1]; }
        const speed = (d > 14 ? 5.2 : 4.3) * rage;
        if (d > 2.2) this.move(mx, mz, speed, dt); else { this.move(0, 0, 0, dt); this.yaw += angleDiff(this.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 6); }
        this.play(this.moveSpeed > 0.4 ? 'A_CatNap_Pursue_Walk' : 'A_CatNap_Idle_Search', 0.3, this.moveSpeed > 0.4 ? clamp(this.moveSpeed / 3.6, 0.7, 1.8) : 1);
        if (this.cool <= 0 && d < 2.9 && Math.abs(P.pos.y - this.pos.y) < 1.6) { this.state = 'SWIPE'; this.stateT = 0; this.struck = false; this.play('A_catnap_stalk_kill_03', 0.15, 1.7, true); }
        else if (this.gasCool <= 0 && d > 4 && d < 10) {
          // only breathes when it can see you
          const h = this.hs[0].p, ex = P.pos.x - h.x, ey = P.pos.y + 1.4 - h.y, ez = P.pos.z - h.z, el = Math.hypot(ex, ey, ez);
          if (!g.physics.raycast(h.x, h.y, h.z, ex / el, ey / el, ez / el, el - 0.4)) { this.state = 'GAS'; this.stateT = 0; this.play('A_catnap_attk_killPlayer_gas', 0.2, 1.15, true); g.audio.play('growlBig', { pos: [h.x, h.y, h.z], vol: 1, rate: 0.8 }); }
          else this.gasCool = 1;
        }
        break;
      }
      case 'SWIPE':
        this.move(0, 0, 0, dt);
        if (this.stateT < 0.4) this.yaw += angleDiff(this.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 7);
        if (this.stateT > 0.55 && !this.struck) {
          this.struck = true;
          g.audio.play('whoosh', { pos: [this.pos.x, 1.5, this.pos.z], vol: 1, rate: 0.7 });
          const ang = Math.abs(angleDiff(this.yaw, Math.atan2(dx, dz)));
          if (d < 3.4 && ang < 1.1) { g.hurtPlayer(20 + Math.random() * 6, this); g.physics.moveCharacter(P.pos, dx / (d || 1) * 1.5, dz / (d || 1) * 1.5, 0, 0.016, P.radius, 1.75, 0.45, P.state); }
        }
        if (this.stateT > 1.25) { this.state = 'HUNT'; this.stateT = 0; this.cool = 0.9 / rage; }
        break;
      case 'GAS': {
        this.move(0, 0, 0, dt);
        this.yaw += angleDiff(this.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 2.5);
        if (this.stateT > 0.8 && this.stateT < 2.2) {
          const m = this.gasBone.getWorldPosition(_v), fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
          const S = g.explosives.smoke;
          for (let i = 0; i < 3; i++) S.emit(m.x, m.y, m.z, fx * (5 + Math.random() * 3) + (Math.random() - 0.5) * 2, -0.6 + Math.random(), fz * (5 + Math.random() * 3) + (Math.random() - 0.5) * 2, 1.4 + Math.random(), 0.4, 2.6, [0.85, 0.08, 0.1], [0.35, 0.04, 0.06], 0.75, 0.2, 2.2);
          const ang = Math.abs(angleDiff(this.yaw, Math.atan2(dx, dz)));
          if (d < 9 && ang < 0.45) { this._gasD = (this._gasD || 0) + dt * 16; if (this._gasD > 4) { g.hurtPlayer(this._gasD, this, 'कैटनैप की लाल गैस · CatNap\'s red smoke'); this._gasD = 0; } }
        }
        if (this.stateT > 2.6) { this.state = 'HUNT'; this.stateT = 0; this.cool = 0.6; this.gasCool = (J.enraged ? 4.5 : 6.5) + Math.random() * 2; }
        break;
      }
      case 'DEAD': {
        const u = ease(this.stateT / 1.6);
        this.root.rotation.z = u * 1.45;
        this.pos.y = -Math.max(0, this.stateT - 4) * 0.25;
        if (this.stateT > 12) { this.state = 'OFF'; this.root.visible = false; }
        break;
      }
    }
    // keep the player out of its body
    if (this.solid() && d < 1.3 && d > 1e-3) g.physics.moveCharacter(P.pos, dx / d * (1.3 - d), dz / d * (1.3 - d), 0, 0.016, P.radius, 1.75, 0.45, P.state);
    this.mixer.update(dt);
    this.root.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.root.rotation.y = this.yaw;
    this.root.updateMatrixWorld(true);
    for (const h of this.hs) h.b.getWorldPosition(h.p);
  }
}
