// THE WORM DESERT — the last stop of the night, after the Joker.
//
// When the Joker dies (joker.js) you wake up back in Jais. The last bus out of the Jais bus adda takes
// you to a sand bowl far from town, ringed by dunes and cliffs, with the wreck of an older bus where the
// road gives out. Two giants live there:
//   THE GIANT WARRIOR (models/warrior.glb): a 5.6 m brute with iron weights on his wrists. He walks you
//       down (the model's own Walking clip), spins a backhand when you are close, jumps and ground-pounds
//       (a shockwave), hurls boulders when you keep your distance and charges when he loses patience.
//   THE GIANT WORM (models/worm.glb): a 9 m sand worm. It moves under the sand (a trail of dust), bursts
//       out next to you, strikes and lunges (sections of its one long clip) or spits acid, then dives again.
//       It can only be hurt while it is above the sand.
// Kill both to finish the game. The acid gun from the Joker's crate is the gun for them; acid ammo lies
// by the wreck and in the dunes.
//
// Both models are rigged; the warrior's attacks are done by moving and tilting his whole body on top of
// the walk, so they never depend on how the rig's bones are oriented.
import * as THREE from 'three';
import { loadGLB, lambertize } from './models.js';
import { clamp, lerp, angleDiff, smooth } from './util.js';
import { part, merge, Bx, Cy } from './props.js';

export const DESERT = { x: -420, z: 560, R: 44 };          // the bowl's centre and how far you can walk from it
export const WARRIOR = { name: 'दैत्य योद्धा', en: 'THE GIANT WARRIOR', hp: 3400, height: 5.6 };
export const WORM = { name: 'रेत का कीड़ा', en: 'THE GIANT WORM', hp: 2800, height: 9 };
const L = (x, z) => [DESERT.x + x, DESERT.z + z];
const ARRIVE = L(0, 31), WRECK = L(3.5, 36);
const ROCKS = [[-14, -10, 2.6, 9], [16, -6, 2.2, 7.5], [-6, 14, 1.8, 6], [12, 15, 2.4, 8], [-24, 5, 2, 7], [25, 12, 2.3, 9.5], [2, -22, 2.8, 10], [-17, -25, 1.9, 6.5]];
// sections of the worm's one long clip (seconds)
const CLIP = { idle: [56, 64], roar: [49, 55.5], strike: [79, 89], lunge: [90, 97.5] };
const ease = (t) => smooth(clamp(t, 0, 1));
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

// ---------- collision, boundary and lights: built with the town (before the light pool) ----------
export function buildDesert(W_) {
  const P = W_.P, R = DESERT.R;
  // a ring of invisible walls just inside the dunes
  const n = 28;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, [x, z] = L(Math.sin(a) * (R + 1), Math.cos(a) * (R + 1));
    P.add(x, 6, z, (Math.PI * 2 * (R + 1)) / n / 2 + 0.6, 6, 0.6, a);
  }
  for (const [x, z, r, h] of ROCKS) { const [wx, wz] = L(x, z); P.add(wx, h / 2, wz, r * 0.8, h / 2, r * 0.8, 0.4); }
  P.add(WRECK[0], 1.5, WRECK[1], 1.3, 1.5, 5.2, 1.35);
  // flares by the wreck, braziers in the bowl, a cold moon over the middle
  const Lt = (x, z, y, color, intensity, dist, flicker = 0) => { const [wx, wz] = L(x, z); W_.lights.push({ x: wx, y, z: wz, color, intensity, dist, flicker }); };
  Lt(-1.5, 33, 1.5, 0xff7030, 7, 16, 1); Lt(7, 31, 1.5, 0xff7030, 6, 14, 1);
  Lt(-20, -14, 3, 0xff9040, 6, 20, 1); Lt(20, -16, 3, 0xff9040, 6, 20, 1); Lt(-22, 18, 3, 0xff9040, 5, 18, 1); Lt(22, 22, 3, 0xff9040, 5, 18, 1);
  Lt(0, 0, 16, 0x8090c0, 6, 60);
}

// a sandy canvas texture (ripples and grit)
function sandTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#9a7a52'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) { const v = 120 + Math.random() * 60; x.fillStyle = `rgba(${v + 30},${v + 10},${v - 30},0.35)`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  x.strokeStyle = 'rgba(70,48,28,0.25)'; x.lineWidth = 3;
  for (let k = 0; k < 9; k++) { x.beginPath(); for (let i = 0; i <= 256; i += 8) x.lineTo(i, k * 30 + Math.sin(i / 30 + k) * 8); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(14, 14); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function signTexture(hi, en) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const x = c.getContext('2d');
  x.fillStyle = '#5a1a10'; x.fillRect(0, 0, 512, 160); x.strokeStyle = '#e8c080'; x.lineWidth = 6; x.strokeRect(8, 8, 496, 144);
  x.fillStyle = '#f0d8a0'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = "700 56px 'Noto Sans Devanagari', sans-serif"; x.fillText(hi, 256, 60);
  x.font = "700 34px Rajdhani, sans-serif"; x.fillText(en, 256, 118);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// shared hit-sphere ray test
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
const findBone = (root, re) => { let b = null; root.traverse((o) => { if (!b && o.isBone && re.test(o.name.replace(/[.\s]/g, ''))) b = o; }); return b; };

// ======================================================================================
export class Giants {
  constructor(game) {
    this.g = game;
    this.load = 'idle';                 // idle | loading | ready | failed
    this.stage = 'off';                 // off | bus (Joker dead, go to the bus adda) | fight | won
    this.mode = false;                  // you are in the desert
    this.buildScenery();
    // a glow over the waiting bus at the bus adda
    this.beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: game.tex.glow, color: 0xffd060, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.beacon.scale.setScalar(4); this.beacon.visible = false; game.scene.add(this.beacon);
    this.warrior = new Warrior(game, this);
    this.worm = new Worm(game, this);
  }

  // ---------- loading ----------
  preload() {
    if (this.load === 'loading' || this.load === 'ready') return;
    this.load = 'loading';
    Promise.all([loadGLB('models/warrior.glb'), loadGLB('models/worm.glb')])
      .then(([w, k]) => { this.warrior.setup(w); this.worm.setup(k); this.load = 'ready'; })
      .catch((e) => { console.warn('giant models failed to load', e); this.load = 'failed'; });
  }
  available() { if (this.load === 'idle') this.preload(); return this.load !== 'failed'; }
  foes() { return this.mode ? [this.warrior, this.worm] : []; }

  // ---------- the desert itself (hidden until you get there) ----------
  buildScenery() {
    const g = this.g, root = this.root = new THREE.Group(), R = DESERT.R;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R + 60, 48).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: sandTexture() }));
    floor.position.set(DESERT.x, 0.04, DESERT.z); root.add(floor);
    const p = [];
    // dunes and cliffs all round
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2 + Math.random() * 0.05, r = R + 7 + Math.random() * 7, h = 5 + Math.random() * 9;
      const dune = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); dune.scale(9 + Math.random() * 5, h, 6 + Math.random() * 4);
      p.push(part(dune, i % 3 ? 0x8a6a44 : 0x7a5a38, Math.sin(a) * r, 0, Math.cos(a) * r, 0, a, 0));
      if (i % 4 === 0) p.push(part(Cy(3 + Math.random() * 2, 4.5 + Math.random() * 2, h + 8, 6), 0x6a4a30, Math.sin(a) * (r + 6), (h + 8) / 2, Math.cos(a) * (r + 6), 0, Math.random() * 3, 0));
    }
    // sandstone pillars (the ones you can hide behind)
    for (const [x, z, rr, h] of ROCKS) {
      p.push(part(Cy(rr * 0.7, rr, h, 7), 0x7a5634, x, h / 2, z, 0, 0.4, 0));
      p.push(part(Cy(rr * 1.05, rr * 0.75, 1.2, 7), 0x8a6640, x, h + 0.4, z, 0.08, 0.9, 0));
    }
    // the ribs of something the worm ate long ago
    for (const [x, z, yaw] of [[-12, 6, 0.6], [14, -18, 2.2]]) {
      for (let k = 0; k < 6; k++) p.push(part(new THREE.TorusGeometry(3.2 - Math.abs(k - 2.5) * 0.35, 0.18, 5, 12, Math.PI), 0xd8d0b8, x + Math.sin(yaw) * (k - 2.5) * 1.4, 0, z + Math.cos(yaw) * (k - 2.5) * 1.4, 0, yaw + Math.PI / 2, 0));
      p.push(part(Cy(0.25, 0.25, 9, 6), 0xd0c8b0, x, 0.25, z, Math.PI / 2, yaw, 0));
    }
    // the wreck of an older bus where the road gives out, half sunk in the sand
    const wb = [part(Bx(2.5, 2.6, 10.2), 0x9a5a20, 0, 1.2, 0), part(Bx(2.55, 0.8, 9.6), 0x202428, 0, 2.0, 0.1), part(Bx(2.3, 0.15, 10), 0x6a3a14, 0, 2.6, 0)];
    for (const z of [-3.4, 3.4]) for (const x of [-1.25, 1.25]) wb.push(part(Cy(0.5, 0.5, 0.35, 10), 0x1a1a1a, x, 0.35, z, 0, 0, Math.PI / 2));
    for (const q of wb) q.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.06, 1.35, -0.12)).setPosition(WRECK[0] - DESERT.x, -0.2, WRECK[1] - DESERT.z));
    p.push(...wb);
    // braziers
    for (const [x, z] of [[-20, -14], [20, -16], [-22, 18], [22, 22], [-1.5, 33], [7, 31]]) p.push(part(Cy(0.5, 0.35, 1.1, 8), 0x2a2420, x, 0.55, z), part(Cy(0.55, 0.55, 0.12, 8), 0xff8030, x, 1.12, z));
    const m = new THREE.Mesh(merge(p), g.mats.vcol); m.position.set(DESERT.x, 0, DESERT.z); root.add(m);
    this.flames = [[-20, -14], [20, -16], [-22, 18], [22, 22], [-1.5, 33], [7, 31]].map(([x, z]) => L(x, z));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.0), new THREE.MeshBasicMaterial({ map: signTexture('कीड़ों का रेगिस्तान', 'THE WORM DESERT'), toneMapped: false }));
    sign.position.set(ARRIVE[0] - 4, 2.6, ARRIVE[1] + 1); sign.rotation.y = Math.PI; root.add(sign);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6), new THREE.MeshLambertMaterial({ color: 0x3a3028 })); post.position.set(ARRIVE[0] - 4, 1.1, ARRIVE[1] + 1.05); root.add(post);
    root.visible = false;
    g.scene.add(root);
  }

  // ---------- per run ----------
  reset() {
    this.leave();
    this.stage = 'off'; this.busT = 0; this.travel = null; this.introT = 0; this.wonT = 0;
    this.beacon.visible = false;
    this.warrior.reset(); this.worm.reset();
    const span = document.querySelector('#catHud span'); if (span) span.textContent = 'कैटनैप · CATNAP';
    const hud = document.getElementById('bossHud'); if (hud) hud.classList.remove('giants');
  }

  // ---------- after the Joker: back to town ----------
  afterJoker() {
    const g = this.g, J = g.joker, P = g.player;
    this.stage = 'bus';
    J.fx('white');
    setTimeout(() => {
      if (g.state !== 'play') return;
      J.leave();
      const a = J.ambushFrom || [g.W.special.busAdda.x, g.W.special.busAdda.z];
      P.spawn(a[0], 0, a[1], P.yaw);
      P.health = Math.max(P.health, 80);
      g.arsenal.bombs = Math.max(g.arsenal.bombs, 2);
      document.getElementById('bossHud').classList.remove('show', 'joker', 'gone');
      J.fx('fadeout');
      setTimeout(() => J.fx(''), 2600);
      g.toast('आख़िरी बस…', 'You wake up back in Jais. The last bus is waiting at the BUS ADDA — it goes to the Worm Desert.');
      g.updateObjective();
    }, 1400);
  }

  // the bus at the bus adda that takes you to the desert, and the wreck that brings you back
  busSpots() {
    if (this._spots) return this._spots;
    const b = this.g.W.props.buses[0]; if (!b) return (this._spots = []);
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw), at = (lx, lz) => [b.p[0] + lx * c + lz * s, 1.4, b.p[2] - lx * s + lz * c];
    this._busTop = at(0, 0);
    return (this._spots = [at(2.0, 3.2), at(-2.0, 3.2), at(2.0, -1.5), at(-2.0, -1.5)]);
  }
  consider(fn) {
    if (this.stage === 'bus' && !this.mode && !this.travel) for (const p of this.busSpots()) fn(p, 3.2, { type: 'giantBus' });
  }
  prompt() {
    if (this.load === 'loading') return ['WAIT', 'बस तैयार हो रही है… the driver is starting the engine'];
    return ['RIDE', 'आख़िरी बस · to the Worm Desert'];
  }
  use() {
    const g = this.g;
    if (this.load !== 'ready' || this.travel) { if (this.load === 'idle') this.preload(); return; }
    if (g.vehicles.driving) g.vehicles.exit(true);
    this.travel = { t: 0, done: false };
    g.outlands.fade(true);
    g.audio.play('engine', { vol: 0.8 }); g.audio.play('horn', { vol: 0.6, delay: 0.4 });
  }

  enter() {
    const g = this.g, P = g.player;
    this.mode = true; this.root.visible = true; this.beacon.visible = false;
    P.spawn(ARRIVE[0], 0, ARRIVE[1], Math.atan2(ARRIVE[0] - DESERT.x, ARRIVE[1] - DESERT.z));
    P.health = Math.max(P.health, 90);
    // the town forgets you
    for (const e of g.enemies.list) if (!e.dead) { e.state = e.human ? 'PATROL' : 'IDLE'; e.alert = 0; e.stateT = 0; e.lastSeen = null; }
    g.chaseOn = false; g._chaseHold = 0; g.audio.fade('zombieChase', 0, 0.5);
    const fog = g.scene.fog; fog.color.setHex(0x2c1c12); fog.density = 0.013;
    if (g.audio.ctx && !this.wind) { this.wind = g.audio.loop('wind', 0, g.audio.amb); this.wind.gain.gain.linearRampToValueAtTime(0.5, g.audio.ctx.currentTime + 3); }
    // acid by the wreck and in the dunes, a little food
    if (!this.stocked) {
      this.stocked = true;
      const drop = (kind, id, x, z, n) => g.loot.drop({ kind, id, n, p: [DESERT.x + x, 0.05, DESERT.z + z] });
      drop('ammo', 'acid', 1.5, 29, 30); drop('ammo', 'acid', -26, -6, 20); drop('ammo', 'acid', 27, 4, 20); drop('ammo', 'acid', 0, -30, 25);
      drop('ammo', '7.62', -2, 29, 30); drop('ammo', '12G', 3, 28.5, 8);
      drop('food', 'water', -1, 30, 0); drop('food', 'laddoo', 18, 20, 0); drop('food', 'bread', -18, -20, 0);
      drop('bomb', 'bomb', 4, 29, 0); drop('bomb', 'bomb', -12, -2, 0);
      if (!g.arsenal.owned.includes('acid')) drop('weapon', 'acid', 0.5, 28, 0);
    }
    this.stage = 'fight'; this.introT = 0;
    this.warrior.place(L(-6, -24), 0); this.worm.reset();
    g.updateObjective();
  }

  leave() {
    const g = this.g;
    if (this.mode) {
      this.mode = false;
      const fog = g.scene.fog; fog.color.setHex(0x0d1520); fog.density = 0.0165;
    }
    this.root.visible = false;
    this.warrior.hide(); this.worm.hide();
    if (this.wind) { try { this.wind.stop(); } catch (e) { /* stopped */ } this.wind = null; }
    if (this.drone) { try { this.drone.stop(); } catch (e) { /* stopped */ } this.drone = null; }
    const hud = document.getElementById('bossHud'); if (hud && hud.classList.contains('giants')) hud.classList.remove('show', 'giants');
  }

  busy() { return !!this.travel || (this.mode && this.introT < 3); }

  // ---------- HUD: the warrior on the big bar, the worm on the small one ----------
  ui(on) {
    const el = document.getElementById('bossHud'); if (!el) return;
    if (!on) { el.classList.remove('show'); return; }
    document.getElementById('bossName').innerHTML = `${WARRIOR.name} <small>${WARRIOR.en}</small>`;
    const span = document.querySelector('#catHud span'); if (span) span.textContent = `${WORM.name} · ${WORM.en}`;
    el.classList.remove('gone', 'rage', 'joker'); el.classList.add('show', 'giants', 'pulse');
    document.getElementById('catHud').classList.add('show');
    this._uiA = this._uiB = -1;
  }
  uiUpdate() {
    const a = Math.max(0, this.warrior.hp / this.warrior.maxHp), b = Math.max(0, this.worm.hp / this.worm.maxHp);
    if (Math.abs(a - this._uiA) > 0.002) { this._uiA = a; document.getElementById('bossFill').style.width = (a * 100).toFixed(1) + '%'; document.getElementById('bossTrail').style.width = (a * 100).toFixed(1) + '%'; document.getElementById('bossHud').classList.toggle('rage', this.warrior.enraged); }
    if (Math.abs(b - this._uiB) > 0.002) { this._uiB = b; document.getElementById('catFill').style.width = (b * 100).toFixed(1) + '%'; }
  }

  // ---------- combat hooks ----------
  hitTest(o, d, maxT) {
    if (!this.mode) return null;
    const a = this.warrior.hitTest(o, d, maxT);
    const b = this.worm.hitTest(o, d, a ? a.t : maxT);
    return b || a;
  }
  blast(x, y, z, R, maxD, src) { if (!this.mode) return false; const a = this.warrior.blast(x, y, z, R, maxD, src), b = this.worm.blast(x, y, z, R, maxD, src); return a || b; }
  shake(k) { const P = this.g.player; P.shake = Math.max(P.shake || 0, k); }
  dust(x, z, n, sp = 3, col = [0.6, 0.48, 0.32]) {
    const S = this.g.explosives.smoke;
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = sp * (0.4 + Math.random()); S.emit(x + Math.cos(a) * 0.8, 0.3 + Math.random() * 0.8, z + Math.sin(a) * 0.8, Math.cos(a) * v, 0.5 + Math.random() * 1.5, Math.sin(a) * v, 1.6 + Math.random() * 1.4, 1, 3.5, col, [col[0] * 0.7, col[1] * 0.7, col[2] * 0.7], 0.7, 0.3, 1.2); }
  }

  // ---------- every frame ----------
  update(dt) {
    const g = this.g, P = g.player;
    if (this.stage === 'bus' && !this.mode) {
      this.busSpots();
      if (this._busTop) { this.beacon.visible = true; this.beacon.position.set(this._busTop[0], 4.6 + Math.sin(g.time * 3) * 0.25, this._busTop[2]); this.beacon.material.opacity = 0.6 + 0.3 * Math.sin(g.time * 4); }
    } else this.beacon.visible = false;
    if (this.travel) {
      const T = this.travel; T.t += dt;
      if (!T.done && T.t >= 0.9) { T.done = true; this.enter(); g.outlands.fade(false); }
      if (T.t > 1.6) this.travel = null;
    }
    if (!this.mode) return;
    // walked out of the bowl somehow (a jump off a rock, a glitch): back to the wreck
    if (Math.hypot(P.pos.x - DESERT.x, P.pos.z - DESERT.z) > DESERT.R + 6) P.spawn(ARRIVE[0], 0, ARRIVE[1], P.yaw);
    for (const [x, z] of this.flames) if (Math.random() < dt * 6) g.explosives.fire && g.explosives.fire.emit(x, 1.25, z, (Math.random() - 0.5) * 0.3, 0.9, (Math.random() - 0.5) * 0.3, 0.5, 0.5, 0.15, [1, 0.7, 0.3], [1, 0.3, 0.05], 0.9);
    if (this.stage === 'fight') {
      this.introT += dt;
      if (this.introT > 1.2 && !this._rumble) { this._rumble = true; g.audio.play('rumble', { vol: 0.9 }); this.shake(0.35); g.subtitle('ज़मीन काँप रही है…', 'The sand is shaking…'); setTimeout(() => g.subtitle(''), 2600); }
      if (this.introT > 2.6 && !this._intro) {
        this._intro = true;
        this.worm.burst(true);
        this.warrior.wake();
        g.banner('रेगिस्तान के दानव', 'THE GIANT WARRIOR · THE GIANT WORM', 'giants');
        this.ui(true);
        if (g.audio.ctx && !this.drone) { this.drone = g.audio.loop('drone', 0, g.audio.music); this.drone.gain.gain.linearRampToValueAtTime(0.35, g.audio.ctx.currentTime + 4); }
      }
      if (this._intro) this.uiUpdate();
      if (this.warrior.dead && this.worm.dead && !this.wonT) {
        this.wonT = g.time; this.stage = 'won';
        setTimeout(() => { if (g.state === 'play' && !P.dead) g.banner('THE GIANTS ARE DEAD', 'रेगिस्तान शांत है · MISSION COMPLETE', 'win'); document.getElementById('bossHud').classList.add('gone'); }, 2500);
        if (this.drone) this.drone.gain.gain.linearRampToValueAtTime(0, g.audio.ctx.currentTime + 4);
      }
    }
    if (this.stage === 'won' && g.time - this.wonT > 8 && !P.dead) { this.stage = 'done'; g.win('giants'); }
    this.warrior.update(dt);
    this.worm.update(dt);
  }
}

// ======================================================================================
// THE GIANT WARRIOR
class Warrior {
  constructor(game, G) {
    this.g = game; this.G = G;
    this.pos = { x: 0, y: 0, z: 0 }; this.st = { vy: 0, peak: 0, fall: 0 }; this.vel = { x: 0, z: 0 };
    this.hs = []; this.bodyR = 1.2; this.yaw = 0; this.t = 0;
    this.rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75, 0), new THREE.MeshLambertMaterial({ color: 0x7a5a3a, flatShading: true }));
    this.rock.visible = false; game.scene.add(this.rock);
    this.reset();
  }
  setup(gltf) {
    const g = this.g, scene = lambertize(gltf.scene, false, 0.14);
    scene.traverse((o) => { if (o.isSkinnedMesh) o.frustumCulled = false; });
    const holder = new THREE.Group(), root = this.root = new THREE.Group();
    holder.add(scene); root.add(holder);
    // the walk carries his hips forward and back: keep it in place (the AI moves him)
    const walk = gltf.animations.find((a) => /walk/i.test(a.name)) || gltf.animations[0];
    for (const tr of walk.tracks) if (/position$/.test(tr.name) && /spine_?01|root/i.test(tr.name)) for (let i = 3; i < tr.values.length; i += 3) { tr.values[i] = tr.values[0]; tr.values[i + 2] = tr.values[2]; }
    this.mixer = new THREE.AnimationMixer(scene);
    this.walk = this.mixer.clipAction(walk); this.walk.play();
    this.mixer.update(0.5); root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene, true), S = WARRIOR.height / (box.max.y - box.min.y);
    holder.scale.setScalar(S); holder.position.y = -box.min.y * S;
    this.S = S;
    root.visible = false; g.scene.add(root);
    const sp = (re, r, part, oy = 0) => { const b = findBone(scene, re); if (b) this.hs.push({ b, r, part, oy, p: new THREE.Vector3() }); };
    sp(/^spine_?01/, 0.75, 'body'); sp(/^spine003/, 0.85, 'body'); sp(/^spine006/, 0.5, 'head', 0.25);
    for (const s of ['L', 'R']) { sp(new RegExp('^thigh' + s), 0.42, 'leg'); sp(new RegExp('^shin' + s), 0.36, 'leg'); sp(new RegExp('^upper_?arm' + s), 0.35, 'arm'); sp(new RegExp('^hand' + s), 0.55, 'arm'); }
    if (this.hs.length < 3) { this.hs = []; for (const [y, r, part] of [[1.4, 0.8, 'leg'], [2.8, 1.0, 'body'], [3.9, 1.0, 'body'], [5.0, 0.55, 'head']]) this.hs.push({ b: null, y, r, part, oy: 0, p: new THREE.Vector3() }); }
  }
  reset() {
    this.hp = this.maxHp = WARRIOR.hp; this.dead = false; this.enraged = false;
    this.state = 'OFF'; this.stateT = 0; this.act = 'WALK'; this.actT = 0;
    this.cool = { act: 1, slam: 3, hurl: 6, charge: 9, swipe: 0 };
    this.flinch = 0; this.rockFly = null; this.rock.visible = false; this.lean = 0; this.twist = 0; this.hop = 0;
    if (this.root) this.root.visible = false;
  }
  hide() { if (this.root) this.root.visible = false; this.rock.visible = false; }
  place(p, yaw) { this.pos.x = p[0]; this.pos.z = p[1]; this.pos.y = 0; this.yaw = yaw; }
  wake() { this.state = 'FIGHT'; this.stateT = 0; this.act = 'WALK'; this.actT = 0; this.g.audio.play('roar', { pos: [this.pos.x, 5, this.pos.z], vol: 1.6, rate: 0.7, max: 400 }); }
  solid() { return this.state === 'FIGHT' && !this.dead; }

  hitTest(o, d, maxT) {
    if (!this.solid() || !this.root) return null;
    const cx = this.pos.x - o.x, cy = this.pos.y + 3 - o.y, cz = this.pos.z - o.z, tc = cx * d.x + cy * d.y + cz * d.z;
    if (tc < -4 || tc > maxT + 4 || cx * cx + cy * cy + cz * cz - tc * tc > 16) return null;
    return sphereHit(this, this.hs, o, d, maxT);
  }
  damage(dmg, part, dir, src) {
    if (!this.solid()) return false;
    const n = dmg * (part === 'head' ? 2 : part === 'leg' || part === 'arm' ? 0.75 : 1);
    this.hp -= n; this.flinch = Math.min(1, this.flinch + n / 300);
    if (Math.random() < 0.2) this.g.audio.play('growlBig', { pos: [this.pos.x, 4.5, this.pos.z], vol: 0.9, rate: 0.5 });
    if (!this.enraged && this.hp < this.maxHp * 0.4 && this.hp > 0) {
      this.enraged = true; this.g.audio.play('roar', { pos: [this.pos.x, 5, this.pos.z], vol: 1.8, rate: 0.6, max: 400 });
      this.g.toast('दैत्य भड़क उठा!', 'The Giant Warrior is enraged — faster, and he jumps more!');
    }
    if (this.hp <= 0) { this.hp = 0; this.die(); return true; }
    return false;
  }
  blast(x, y, z, R, maxD, src) {
    if (!this.solid()) return false;
    const d = Math.max(0, Math.hypot(this.pos.x - x, this.pos.y + 2.5 - y, this.pos.z - z) - 1.4);
    if (d > R) return false;
    this.damage(maxD * Math.pow(1 - d / R, 1.1), 'body', null, src); return true;
  }
  die() {
    const g = this.g;
    this.dead = true; this.state = 'DEAD'; this.stateT = 0; this.rock.visible = false; this.rockFly = null;
    g.stats.kills++;
    g.audio.play('roar', { pos: [this.pos.x, 4, this.pos.z], vol: 1.4, rate: 0.45, max: 400 });
    g.toast('दैत्य गिर गया!', 'The Giant Warrior falls!' + (this.G.worm.dead ? '' : ' Now the worm…'));
  }

  // the ground pound / landing shockwave: hurts and shoves you within R
  quake(R, dmg) {
    const g = this.g, P = g.player, G = this.G;
    const fx = this.pos.x + Math.sin(this.yaw) * 1.6, fz = this.pos.z + Math.cos(this.yaw) * 1.6;
    G.dust(fx, fz, 26, 6); g.audio.play('slam', { pos: [fx, 0.3, fz], vol: 1.4, rate: 0.5 }); g.audio.play('explosion', { pos: [fx, 0.3, fz], vol: 0.6, rate: 0.6 });
    const dx = P.pos.x - fx, dz = P.pos.z - fz, d = Math.hypot(dx, dz);
    G.shake(clamp(1 - d / 30, 0.15, 0.7));
    if (d < R && P.pos.y < 1.5) { g.hurtPlayer(dmg * (d < R * 0.5 ? 1 : 0.55), this); g.physics.moveCharacter(P.pos, dx / (d || 1) * 2.2, dz / (d || 1) * 2.2, 0, 0.016, P.radius, 1.75, 0.45, P.state); }
  }

  update(dt) {
    if (!this.root || this.state === 'OFF') return;
    const g = this.g, P = g.player;
    this.t += dt; this.stateT += dt; this.actT += dt;
    for (const k in this.cool) this.cool[k] -= dt;
    this.flinch = Math.max(0, this.flinch - dt * 2);
    const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z, d = Math.hypot(dx, dz), toP = Math.atan2(dx, dz);
    let speed = 0, anim = 1;
    this.lean = lerp(this.lean, 0, 1 - Math.exp(-dt * 6)); this.twist = lerp(this.twist, 0, 1 - Math.exp(-dt * 6)); this.hop = 0;
    if (this.state === 'DEAD') {
      const u = ease(this.stateT / 1.8);
      this.lean = u * 1.5; anim = Math.max(0, 1 - this.stateT * 2);
      if (this.stateT > 1.6 && !this._thud) { this._thud = true; this.G.dust(this.pos.x + Math.sin(this.yaw) * 3, this.pos.z + Math.cos(this.yaw) * 3, 30, 5); g.audio.play('slam', { pos: [this.pos.x, 0.5, this.pos.z], vol: 1.5, rate: 0.4 }); this.G.shake(0.5); }
    } else if (P.dead) { anim = 0; }
    else {
      const rage = this.enraged ? 1.3 : 1;
      switch (this.act) {
        case 'WALK': {
          this.yaw += angleDiff(this.yaw, toP) * Math.min(1, dt * 2.5);
          speed = (d > 3.4 ? 2.7 : 0) * rage;
          if (this.cool.act > 0) break;
          if (d < 4.6 && this.cool.swipe <= 0) { this.act = 'SWIPE'; this.actT = 0; this.struck = false; this.dir = Math.random() < 0.5 ? 1 : -1; break; }
          if (d < 9 && this.cool.slam <= 0) { this.act = 'POUND'; this.actT = 0; this.struck = false; break; }
          if (d > 14 && d < 40 && this.cool.hurl <= 0) { this.act = 'HURL'; this.actT = 0; this.struck = false; break; }
          if (d > 10 && d < 32 && this.cool.charge <= 0) { this.act = 'CHARGE'; this.actT = 0; this.struck = false; g.audio.play('roar', { pos: [this.pos.x, 5, this.pos.z], vol: 1.3, rate: 0.8 }); break; }
          break;
        }
        case 'SWIPE': {
          // wind up turning away, then a full-body backhand with the iron weights
          const T = this.actT, k = T < 0.45 ? ease(T / 0.45) : 1 - ease((T - 0.45) / 0.35);
          this.twist = (T < 0.45 ? -0.7 * k : lerp(-0.7, 1.1, ease((T - 0.45) / 0.25))) * this.dir; anim = 0.3;
          if (T < 0.4) this.yaw += angleDiff(this.yaw, toP) * Math.min(1, dt * 4);
          if (T > 0.55 && !this.struck) {
            this.struck = true; g.audio.play('whoosh', { pos: [this.pos.x, 3, this.pos.z], vol: 1.2, rate: 0.5 });
            if (d < 5.4 && Math.abs(angleDiff(this.yaw, toP)) < 1.4) { g.hurtPlayer(24 + Math.random() * 8, this); g.physics.moveCharacter(P.pos, dx / (d || 1) * 3, dz / (d || 1) * 3, 0, 0.016, P.radius, 1.75, 0.45, P.state); this.G.shake(0.5); }
          }
          if (T > 1.1) this.done(0.4, 'swipe', 1.6);
          break;
        }
        case 'POUND': {
          // crouch, jump, land on both fists: a shockwave
          const T = this.actT;
          if (T < 0.45) { this.hop = -0.5 * ease(T / 0.45); this.lean = -0.2; this.yaw += angleDiff(this.yaw, toP) * Math.min(1, dt * 3); }
          else if (T < 1.05) { const u = (T - 0.45) / 0.6; this.hop = Math.sin(u * Math.PI) * 3 - 0.5 * (1 - u); this.lean = lerp(-0.2, 0.55, u); speed = Math.min(d, 7) / 0.6 * 0.85; }
          else { this.lean = 0.55 * (1 - ease((T - 1.05) / 0.6)); anim = 0; }
          if (T > 1.05 && !this.struck) { this.struck = true; this.quake(7.5, 30); }
          if (T > 1.8) this.done(0.6, 'slam', this.enraged ? 4 : 6);
          break;
        }
        case 'HURL': {
          // tear a boulder out of the sand and throw it
          const T = this.actT; anim = 0;
          this.yaw += angleDiff(this.yaw, toP) * Math.min(1, dt * 3);
          this.lean = T < 0.7 ? -0.35 * ease(T / 0.7) : lerp(-0.35, 0.4, ease((T - 0.7) / 0.25));
          if (T < 0.75) { this.rock.visible = true; this.rock.position.set(this.pos.x - Math.sin(this.yaw) * 0.6, this.pos.y + 6.2, this.pos.z - Math.cos(this.yaw) * 0.6); this.rock.rotation.x += dt * 2; }
          if (T > 0.75 && !this.struck) {
            this.struck = true;
            const from = this.rock.position.clone(), lead = 0.6, tx = P.pos.x + (P.vel.x || 0) * lead, tz = P.pos.z + (P.vel.y || 0) * lead;
            const ddx = tx - from.x, ddz = tz - from.z, Tf = clamp(Math.hypot(ddx, ddz) / 18, 0.9, 2.2), Gr = 14;
            this.rockFly = { p: from, v: new THREE.Vector3(ddx / Tf, (0.5 - from.y) / Tf + 0.5 * Gr * Tf, ddz / Tf), t: 0, T: Tf, G: Gr };
            g.audio.play('whoosh', { pos: [from.x, from.y, from.z], vol: 1, rate: 0.6 });
          }
          if (T > 1.3) this.done(0.5, 'hurl', this.enraged ? 5 : 7);
          break;
        }
        case 'CHARGE': {
          const T = this.actT;
          this.yaw += angleDiff(this.yaw, toP) * Math.min(1, dt * (T < 0.4 ? 4 : 1.2));
          speed = T < 0.4 ? 0 : 8.5 * rage; anim = 2.4; this.lean = 0.25;
          if (!this.struck && d < 3.4 && T > 0.4) { this.struck = true; g.hurtPlayer(28, this); g.physics.moveCharacter(P.pos, dx / (d || 1) * 3.5, dz / (d || 1) * 3.5, 0, 0.016, P.radius, 1.75, 0.45, P.state); this.G.shake(0.6); }
          if (T > 2.4 || this.struck || (T > 0.8 && this.moveSpeed < 1)) this.done(0.8, 'charge', this.enraged ? 7 : 10);
          break;
        }
        default: this.act = 'WALK';
      }
    }
    // the boulder in flight
    if (this.rockFly) {
      const R = this.rockFly; R.t += dt; R.v.y -= R.G * dt; R.p.addScaledVector(R.v, dt);
      this.rock.position.copy(R.p); this.rock.rotation.x += dt * 6; this.rock.rotation.z += dt * 4;
      if (R.t >= R.T || R.p.y < 0.4) {
        this.rockFly = null; this.rock.visible = false;
        this.G.dust(R.p.x, R.p.z, 18, 4); g.audio.play('slam', { pos: [R.p.x, 0.3, R.p.z], vol: 1.2, rate: 0.7 });
        const pd = Math.hypot(P.pos.x - R.p.x, P.pos.z - R.p.z);
        if (pd < 2.8) g.hurtPlayer(26 * (1 - pd / 4), this);
        this.G.shake(clamp(0.5 - pd / 40, 0.05, 0.45));
      }
    }
    // move
    const ox = this.pos.x, oz = this.pos.z;
    if (speed > 0) {
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      this.vel.x = lerp(this.vel.x, fx * speed, 1 - Math.exp(-dt * 5)); this.vel.z = lerp(this.vel.z, fz * speed, 1 - Math.exp(-dt * 5));
    } else { this.vel.x *= Math.exp(-dt * 8); this.vel.z *= Math.exp(-dt * 8); }
    if (this.state === 'FIGHT') g.physics.moveCharacter(this.pos, this.vel.x * dt, this.vel.z * dt, 0, dt, 1.1, 5, 0.6, this.st);
    this.pos.y = 0;
    this.moveSpeed = Math.hypot(this.pos.x - ox, this.pos.z - oz) / Math.max(dt, 1e-4);
    // keep you out of his legs
    if (!this.dead && d < 1.6 && d > 1e-3) g.physics.moveCharacter(P.pos, dx / d * (1.6 - d), dz / d * (1.6 - d), 0, 0.016, P.radius, 1.75, 0.45, P.state);
    // footsteps you feel
    if (this.moveSpeed > 1 && this.state === 'FIGHT') { this.stepT = (this.stepT || 0) - dt * this.moveSpeed / 2.7; if (this.stepT <= 0) { this.stepT = 0.55; g.audio.play('slam', { pos: [this.pos.x, 0.2, this.pos.z], vol: 0.6, rate: 0.35 }); if (d < 14) this.G.shake(0.12); } }
    this.pose(dt, anim);
  }
  done(cool, key, k) { this.act = 'WALK'; this.actT = 0; this.cool.act = cool; this.cool[key] = k + Math.random() * 2; }

  pose(dt, anim) {
    const R = this.root;
    R.visible = this.G.mode;
    const walking = this.act === 'WALK' || this.act === 'CHARGE' || this.act === 'POUND';
    this.walk.timeScale = this.state === 'DEAD' ? 0 : (walking ? clamp(this.moveSpeed / 2.7, 0, 2.6) : 0.25) * (anim > 1 ? 1.3 : 1) + 0.0001;
    this.mixer.update(dt);
    R.position.set(this.pos.x, this.pos.y + Math.max(this.hop, -0.6), this.pos.z);
    R.rotation.set(this.lean - this.flinch * 0.15, this.yaw + this.twist, 0, 'YXZ');
    if (this.state === 'DEAD') { R.rotation.x = Math.min(this.lean, 1.5); R.position.y = -Math.max(0, this.stateT - 3) * 0.4; if (this.stateT > 12) R.visible = false; }
    R.updateMatrixWorld(true);
    for (const h of this.hs) { if (h.b) { h.b.getWorldPosition(h.p); h.p.y += h.oy; } else h.p.set(this.pos.x, this.pos.y + h.y, this.pos.z); }
  }
}

// ======================================================================================
// THE GIANT WORM
class Worm {
  constructor(game, G) {
    this.g = game; this.G = G;
    this.pos = { x: 0, y: 0, z: 0 }; this.hs = []; this.bodyR = 1.4; this.yaw = 0; this.t = 0;
    this.globs = [];
    const gm = new THREE.MeshBasicMaterial({ color: 0x60ff40, toneMapped: false });
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), gm); m.visible = false; game.scene.add(m); this.globs.push({ m, on: false }); }
    this.reset();
  }
  setup(gltf) {
    const g = this.g, scene = lambertize(gltf.scene, false, 0.16);
    scene.traverse((o) => { if (o.isSkinnedMesh) o.frustumCulled = false; });
    const holder = new THREE.Group(), root = this.root = new THREE.Group();
    holder.add(scene); root.add(holder);
    this.mixer = new THREE.AnimationMixer(scene);
    this.action = this.mixer.clipAction(gltf.animations[0]); this.action.play(); this.action.paused = true;
    this.action.time = CLIP.roar[0] + 3; this.mixer.update(0); root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene, true), S = WORM.height / (box.max.y - box.min.y);
    holder.scale.setScalar(S); holder.position.y = -box.min.y * S - 1.2;     // the tail stays under the sand
    holder.rotation.y = -Math.PI / 2;                                         // the model looks along +X
    root.visible = false; g.scene.add(root);
    this.head = findBone(scene, /^b_head_root/);
    if (this.head) this.hs.push({ b: this.head, r: 1.25, part: 'head', p: new THREE.Vector3() });
    for (let i = 0; i <= 16; i += 2) { const b = findBone(scene, new RegExp('^b_body' + String(i).padStart(2, '0'))); if (b) this.hs.push({ b, r: 1.05, part: 'body', p: new THREE.Vector3() }); }
  }
  reset() {
    this.hp = this.maxHp = WORM.hp; this.dead = false; this.enraged = false;
    this.state = 'OFF'; this.stateT = 0; this.seg = 'idle'; this.segT = 0; this.rise = 0;
    this.cool = { spit: 3, hit: 0 }; this.upFor = 10; this.recent = 0; this.flinch = 0;
    for (const b of this.globs) { b.on = false; b.m.visible = false; }
    if (this.root) this.root.visible = false;
  }
  hide() { if (this.root) this.root.visible = false; for (const b of this.globs) { b.on = false; b.m.visible = false; } }
  solid() { return !this.dead && (this.state === 'UP' || (this.state === 'EMERGE' && this.stateT > 0.5) || (this.state === 'DIVE' && this.stateT < 0.6)); }
  to(s) { this.state = s; this.stateT = 0; }
  play(seg) { this.seg = seg; this.segT = 0; this.struck = 0; }

  // come up out of the sand near the player (first: in front of him, at a distance)
  burst(first) {
    const P = this.g.player;
    let a = first ? P.yaw + Math.PI : Math.random() * Math.PI * 2, r = first ? 14 : 5.5 + Math.random() * 3;
    for (let k = 0; k < 12; k++) {
      const x = P.pos.x + Math.sin(a) * r, z = P.pos.z + Math.cos(a) * r;
      if (Math.hypot(x - DESERT.x, z - DESERT.z) < DESERT.R - 5 && !ROCKS.some(([rx, rz, rr]) => Math.hypot(DESERT.x + rx - x, DESERT.z + rz - z) < rr + 2.5)) { this.pos.x = x; this.pos.z = z; break; }
      a += 0.9; r = Math.max(4.5, r - 0.5);
    }
    this.yaw = Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
    this.to('EMERGE'); this.play('roar'); this.struck = 0;
    const g = this.g;
    g.audio.play('explosion', { pos: [this.pos.x, 0.5, this.pos.z], vol: 0.8, rate: 0.5 });
    g.audio.play('roar', { pos: [this.pos.x, 5, this.pos.z], vol: 1.7, rate: 0.55, max: 400, delay: 0.3 });
    this.G.dust(this.pos.x, this.pos.z, 40, 7); this.G.shake(0.55);
  }

  hitTest(o, d, maxT) {
    if (!this.solid() || !this.root) return null;
    const cx = this.pos.x - o.x, cy = 4 - o.y, cz = this.pos.z - o.z, tc = cx * d.x + cy * d.y + cz * d.z;
    if (tc < -7 || tc > maxT + 7 || cx * cx + cy * cy + cz * cz - tc * tc > 49) return null;
    return sphereHit(this, this.hs, o, d, maxT);
  }
  damage(dmg, part, dir, src) {
    if (!this.solid()) return false;
    const n = dmg * (part === 'head' ? 1.8 : 1);
    this.hp -= n; this.recent += n; this.flinch = Math.min(1, this.flinch + n / 250);
    if (Math.random() < 0.25) this.g.audio.play('growlBig', { pos: [this.pos.x, 6, this.pos.z], vol: 0.9, rate: 0.7 });
    if (!this.enraged && this.hp < this.maxHp * 0.4 && this.hp > 0) { this.enraged = true; this.g.toast('कीड़ा पागल हो गया!', 'The Giant Worm is frenzied — it surfaces faster!'); }
    if (this.hp <= 0) { this.hp = 0; this.die(); return true; }
    return false;
  }
  blast(x, y, z, R, maxD, src) {
    if (!this.solid()) return false;
    const d = Math.max(0, Math.hypot(this.pos.x - x, this.pos.z - z) - 1.6);
    if (d > R) return false;
    this.damage(maxD * Math.pow(1 - d / R, 1.1), 'body', null, src); return true;
  }
  die() {
    const g = this.g;
    this.dead = true; this.to('DEAD'); this.play('roar');
    g.stats.kills++;
    g.audio.play('roar', { pos: [this.pos.x, 6, this.pos.z], vol: 1.6, rate: 0.4, max: 400 });
    g.toast('कीड़ा मर गया!', 'The Giant Worm is dead!' + (this.G.warrior.dead ? '' : ' Now the warrior…'));
  }

  spit() {
    const g = this.g, P = g.player, b = this.globs.find((q) => !q.on); if (!b || !this.head) return;
    const from = this.head.getWorldPosition(new THREE.Vector3());
    const lead = 0.5, tx = P.pos.x + (P.vel.x || 0) * lead + (Math.random() - 0.5) * 2, tz = P.pos.z + (P.vel.y || 0) * lead + (Math.random() - 0.5) * 2;
    const dx = tx - from.x, dz = tz - from.z, T = clamp(Math.hypot(dx, dz) / 16, 0.7, 2), Gr = 12;
    b.on = true; b.p = from; b.v = new THREE.Vector3(dx / T, (0.3 - from.y) / T + 0.5 * Gr * T, dz / T); b.t = 0; b.T = T; b.G = Gr; b.m.visible = true;
    g.audio.play('acid', { pos: [from.x, from.y, from.z], vol: 1.1, rate: 0.6 });
  }

  update(dt) {
    const g = this.g, P = g.player, G = this.G;
    // acid globs in flight
    for (const b of this.globs) if (b.on) {
      b.t += dt; b.v.y -= b.G * dt; b.p.addScaledVector(b.v, dt); b.m.position.copy(b.p);
      if (b.t >= b.T || b.p.y < 0.2) {
        b.on = false; b.m.visible = false;
        g.fx.burst([b.p.x, 0.3, b.p.z], [0, 0.8, 0], 20, [0.35, 1, 0.25], 3, 0.8);
        G.dust(b.p.x, b.p.z, 6, 1.5, [0.35, 0.85, 0.3]);
        g.audio.play('sizzle', { pos: [b.p.x, 0.3, b.p.z], vol: 0.9 });
        const pd = Math.hypot(P.pos.x - b.p.x, P.pos.z - b.p.z);
        if (pd < 2.4 && P.pos.y < 1.5) g.hurtPlayer(18 * (1 - pd / 3.5), this);
      }
    }
    if (!this.root || this.state === 'OFF') return;
    this.t += dt; this.stateT += dt; this.segT += dt;
    for (const k in this.cool) this.cool[k] -= dt;
    this.flinch = Math.max(0, this.flinch - dt * 2); this.recent = Math.max(0, this.recent - dt * 40);
    const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z, d = Math.hypot(dx, dz), toP = Math.atan2(dx, dz);
    const fast = this.enraged ? 1.35 : 1;
    switch (this.state) {
      case 'UNDER': {
        // a dust wake racing toward you under the sand
        const tx = P.pos.x - dx / (d || 1) * 5, tz = P.pos.z - dz / (d || 1) * 5, ex = tx - this.pos.x, ez = tz - this.pos.z, el = Math.hypot(ex, ez);
        if (el > 0.5) { const v = Math.min(el, 11 * fast * dt); this.pos.x += ex / el * v; this.pos.z += ez / el * v; }
        this._dustT = (this._dustT || 0) - dt;
        if (this._dustT <= 0) { this._dustT = 0.08; G.dust(this.pos.x, this.pos.z, 2, 1.2); }
        if (this.stateT > (this.enraged ? 2 : 3.2) && (el < 2 || this.stateT > 6)) this.burst(false);
        break;
      }
      case 'EMERGE': {
        this.rise = ease(this.stateT / 1.1);
        if (this.stateT > 0.35 && !this.struck && d < 4 && P.pos.y < 2) { this.struck = 1; g.hurtPlayer(22, this); g.physics.moveCharacter(P.pos, dx / (d || 1) * 3, dz / (d || 1) * 3, 0, 0.016, P.radius, 1.75, 0.45, P.state); }
        if (this.stateT > 1.1) { this.to('UP'); this.upFor = (this.enraged ? 7 : 10) + Math.random() * 3; this.play('roar'); }
        break;
      }
      case 'UP': {
        this.rise = 1;
        this.yaw += angleDiff(this.yaw, toP) * Math.min(1, dt * 1.6);
        const [s0, s1] = CLIP[this.seg];
        if (this.segT > s1 - s0) {
          // pick the next move: bite if you are in reach, spit if you are not, now and then a roar
          if (d < 7.5) this.play(Math.random() < 0.6 ? 'strike' : 'lunge');
          else if (Math.random() < 0.25) this.play('roar');
          else this.play('idle');
        }
        // the head does the damage: wherever the clip throws it
        if ((this.seg === 'strike' || this.seg === 'lunge') && this.head && this.cool.hit <= 0) {
          const h = this.head.getWorldPosition(_v);
          if (Math.hypot(h.x - P.pos.x, h.z - P.pos.z) < 2.6 && h.y < P.pos.y + 3.2) { this.cool.hit = 1.1; g.hurtPlayer(this.seg === 'lunge' ? 32 : 22, this); g.audio.play('crunch', { pos: [h.x, h.y, h.z], vol: 1 }); G.shake(0.4); }
        }
        if (this.seg !== 'strike' && this.seg !== 'lunge' && d > 7 && this.cool.spit <= 0) { this.spit(); if (this.enraged) setTimeout(() => this.state === 'UP' && this.spit(), 400); this.cool.spit = (this.enraged ? 1.8 : 2.8) + Math.random(); }
        if (this.stateT > this.upFor || this.recent > 420) { this.to('DIVE'); this.recent = 0; g.audio.play('rumble', { pos: [this.pos.x, 0.5, this.pos.z], vol: 0.8 }); G.dust(this.pos.x, this.pos.z, 24, 4); }
        break;
      }
      case 'DIVE': {
        this.rise = 1 - ease(this.stateT / 1.1);
        if (this.stateT > 1.1) { this.to('UNDER'); this.rise = 0; }
        break;
      }
      case 'DEAD': {
        this.rise = 1 - ease(Math.max(0, this.stateT - 2) / 4) * 0.85;
        if (this.stateT > 2 && !this._thud) { this._thud = true; G.dust(this.pos.x, this.pos.z, 40, 6); g.audio.play('slam', { pos: [this.pos.x, 0.5, this.pos.z], vol: 1.5, rate: 0.35 }); G.shake(0.5); }
        break;
      }
    }
    this.pose(dt);
  }

  pose(dt) {
    const R = this.root;
    R.visible = this.G.mode && this.rise > 0.02;
    const [s0, s1] = CLIP[this.seg];
    const speed = this.state === 'DEAD' ? 0.4 : this.enraged ? 1.25 : 1;
    this.action.time = s0 + Math.min(this.segT * speed, s1 - s0 - 0.01);
    this.mixer.update(0);
    R.position.set(this.pos.x, (this.rise - 1) * WORM.height * 1.1 - this.flinch * 0.4, this.pos.z);
    R.rotation.set(0, this.yaw, 0);
    R.updateMatrixWorld(true);
    for (const h of this.hs) h.b.getWorldPosition(h.p);
  }
}
