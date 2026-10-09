// लोहासुर · LOHASUR — the one and only boss: a giant railway-gang zombie who
// sleeps in the gravel beside the main line west of Guru Gorakhnath Dham.
//
// He wakes only when the station signal is set (the final objective), when
// the player deliberately wakes him (USE beside him, shooting him, a rocket,
// ramming him with the jeep) — never on his own. Then he rises, roars and
// hunts the player with the town's flow field, swiping, slamming the ground,
// charging and, when he cannot reach you, throwing chunks of concrete.
// Killing him completes the game.
//
// The body is built from merged coloured boxes, one mesh per bone (about 20
// draw calls), animated procedurally like the ordinary zombies.
import * as THREE from 'three';
import { part, merge, Bx, Cy } from './props.js';
import { clamp, lerp, angleDiff, smooth } from './util.js';

export const BOSS = {
  name: 'लोहासुर', en: 'LOHASUR · THE RAILYARD BEHEMOTH',
  hp: 2600,
  // lying on his back in the gravel north of the main line, feet to the west, head toward the station
  x: 73.6, z: -182.6, yaw: -Math.PI / 2,
};

const SKIN = 0x76806a, SKIN_D = 0x5a6352, PANTS = 0x262c40, VEST = 0xd8601a, STRIPE = 0xd8d8c8, BONE = 0xd8ccb0, WOUND = 0x4a0808, STEEL = 0x6a6c70, RUST = 0x5a3020;
const ease = (t) => smooth(clamp(t, 0, 1));

export class Boss {
  constructor(game) {
    this.g = game;
    this.pos = { x: BOSS.x, y: 0, z: BOSS.z };
    this.st = { vy: 0, peak: 0, fall: 0 };
    this.vel = { x: 0, z: 0 };
    this.hs = [];
    this.build();
    this.reset();
  }

  // ---------- the lair: crushed sleepers, a bent rail, bones and a dying red signal lamp ----------
  static buildLair(W) {
    const B = W.B, x = BOSS.x + 2.3, z = BOSS.z;
    for (let i = 0; i < 7; i++) B.box('concrete', x - 3 + i * 0.95 + Math.sin(i * 7) * 0.3, 0.08, z + Math.sin(i * 3.3) * 0.5, 0.3, 0.16, 2.5, 0.25 + Math.sin(i * 5) * 0.5, [0.52, 0.5, 0.47], { collide: false });
    B.box('metal', x + 1.0, 0.25, z + 2.2, 7.5, 0.13, 0.09, 0.32, [0.6, 0.58, 0.56], { collide: false });
    B.box('metal', x + 4.8, 0.7, z + 3.3, 2.8, 0.13, 0.09, 0.32, [0.6, 0.58, 0.56], { collide: false });
    for (let i = 0; i < 9; i++) B.box('plain', x - 4 + Math.sin(i * 9.1) * 4, 0.05, z + Math.cos(i * 4.7) * 2.8, 0.06, 0.06, 0.35 + Math.abs(Math.sin(i)) * 0.3, i * 1.3, [0.85, 0.8, 0.7], { collide: false });
    for (const [dx, dz, w, d, a] of [[-1.2, 0.3, 2.6, 1.5, 0.4], [0.6, -0.2, 1.8, 1.1, -0.7], [-2.6, 0.7, 1.2, 0.8, 1.2], [1.6, 0.6, 0.9, 0.6, 0.2]]) B.ground('plain', x + dx, z + dz, w, d, a, 0.06 + w * 0.001, [0.12, 0.02, 0.015]);
    // a broken signal post leaning over him, its red lamp still flickering
    B.box('metal', x + 6, 2.2, z - 2.3, 0.18, 4.4, 0.18, 0.2, [0.2, 0.2, 0.2]);
    W.fairy.push({ p: [x + 6.2, 4.3, z - 2.1], c: 0xff1a10, s: 0.5 });
    W.lights.push({ x: x + 6, y: 4, z: z - 1.4, color: 0xff2a14, intensity: 5, dist: 13, flicker: 1 });
  }

  // ---------- body ----------
  build() {
    const g = this.g, mat = g.mats.vcol;
    const O = () => new THREE.Object3D();
    const R = this.rig = {};
    const node = (parent, x, y, z) => { const o = O(); o.position.set(x, y, z); parent.add(o); return o; };
    const skin = (parent, parts) => { const m = new THREE.Mesh(merge(parts), mat); parent.add(m); return m; };
    const mark = (parent, x, y, z, r, partName) => { const o = node(parent, x, y, z); this.hs.push({ o, r, part: partName, p: new THREE.Vector3() }); return o; };
    R.root = new THREE.Group(); R.root.rotation.order = 'YXZ';
    R.body = node(R.root, 0, 0, 0);
    R.hips = node(R.body, 0, 1.85, 0);
    skin(R.hips, [part(Bx(1.15, 0.55, 0.8), PANTS, 0, 0, 0), part(Bx(1.18, 0.1, 0.82), 0x3a2a1a, 0, 0.22, 0), part(Bx(0.16, 0.12, 0.05), 0x8a7a50, 0, 0.22, 0.42)]);
    mark(R.hips, 0, 0, 0, 0.58, 'body');
    R.hip = []; R.knee = [];
    for (const s of [-1, 1]) {
      const h = node(R.hips, s * 0.4, -0.15, 0);
      skin(h, [part(Bx(0.52, 0.85, 0.56), PANTS, 0, -0.42, 0), part(Bx(0.3, 0.3, 0.05), SKIN, s * 0.05, -0.55, 0.29), part(Bx(0.54, 0.12, 0.58), 0x1c2030, 0, -0.84, 0)]);
      mark(h, 0, -0.45, 0, 0.34, 'leg');
      const k = node(h, 0, -0.85, 0);
      skin(k, [part(Bx(0.45, 0.82, 0.48), SKIN, 0, -0.41, 0), part(Bx(0.2, 0.3, 0.05), WOUND, -s * 0.08, -0.3, 0.25), part(Bx(0.5, 0.22, 0.78), SKIN_D, 0, -0.8, 0.13)]);
      mark(k, 0, -0.42, 0, 0.3, 'leg');
      R.hip.push(h); R.knee.push(k);
    }
    R.spine = node(R.hips, 0, 0.2, 0);
    skin(R.spine, [part(Bx(1.25, 0.6, 0.92), SKIN, 0, 0.25, 0.04), part(Bx(0.5, 0.3, 0.04), WOUND, -0.25, 0.28, 0.5)]);
    mark(R.spine, 0, 0.25, 0.05, 0.62, 'body');
    R.chest = node(R.spine, 0, 0.55, 0);
    skin(R.chest, [
      part(Bx(1.85, 1.15, 1.05), SKIN, 0, 0.55, 0),
      // torn orange railway vest with reflective stripes, ripped open on his right
      part(Bx(0.85, 0.98, 0.06), VEST, -0.45, 0.5, 0.54), part(Bx(0.5, 0.55, 0.06), VEST, 0.5, 0.73, 0.54),
      part(Bx(0.86, 0.1, 0.07), STRIPE, -0.45, 0.32, 0.55), part(Bx(0.86, 0.1, 0.07), STRIPE, -0.45, 0.66, 0.55), part(Bx(0.5, 0.1, 0.07), STRIPE, 0.5, 0.66, 0.55),
      part(Bx(1.86, 0.98, 0.06), VEST, 0, 0.55, -0.54),
      // the open wound with ribs showing
      part(Bx(0.55, 0.5, 0.03), WOUND, 0.5, 0.25, 0.535),
      part(Bx(0.45, 0.06, 0.05), BONE, 0.5, 0.1, 0.55), part(Bx(0.45, 0.06, 0.05), BONE, 0.5, 0.25, 0.55), part(Bx(0.45, 0.06, 0.05), BONE, 0.5, 0.4, 0.55),
      // a length of rail driven through his back, and rebar out of his shoulder
      part(Bx(0.14, 0.18, 2.7), STEEL, 0.25, 0.75, -0.55, 0.95, 0.25, 0), part(Bx(0.3, 0.05, 2.7), STEEL, 0.25, 0.66, -0.55, 0.95, 0.25, 0),
      part(Cy(0.035, 0.035, 0.8, 5), RUST, -0.8, 1.25, -0.1, 0.3, 0, 0.5), part(Cy(0.035, 0.035, 0.7, 5), RUST, -0.65, 1.2, 0.15, -0.2, 0, 0.7), part(Cy(0.035, 0.035, 0.6, 5), RUST, -0.9, 1.1, 0.05, 0.1, 0, 0.9),
      part(Bx(0.4, 0.4, 0.04), WOUND, -0.2, 0.8, -0.56),
    ]);
    this.chestMark = mark(R.chest, 0, 0.55, 0.05, 0.82, 'body'); mark(R.chest, -0.6, 0.6, 0, 0.5, 'body'); mark(R.chest, 0.6, 0.6, 0, 0.5, 'body');
    R.neck = node(R.chest, 0, 1.12, 0.25);
    skin(R.neck, [part(Bx(0.55, 0.4, 0.55), SKIN_D, 0, 0.1, 0)]);
    R.head = node(R.neck, 0, 0.3, 0.02);
    skin(R.head, [
      part(Bx(0.66, 0.62, 0.66), SKIN_D, 0, 0.28, 0), part(Bx(0.72, 0.13, 0.22), 0x3a4236, 0, 0.44, 0.28),
      part(Bx(0.46, 0.07, 0.04), BONE, 0, 0.1, 0.335), part(Bx(0.12, 0.12, 0.05), 0x2a2a22, 0, 0.24, 0.34),
      part(Bx(0.06, 0.4, 0.06), RUST, 0.18, 0.66, -0.05, 0.3, 0, -0.4), part(Bx(0.06, 0.32, 0.06), RUST, -0.2, 0.62, 0.05, -0.2, 0, 0.5),
      part(Bx(0.2, 0.25, 0.04), WOUND, 0.25, 0.3, -0.335),
    ]);
    mark(R.head, 0, 0.26, 0.05, 0.4, 'head');
    // eyes: glowing coals
    this.eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2a10, toneMapped: false });
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.07, 0.04), this.eyeMat); e.position.set(s * 0.15, 0.33, 0.335); R.head.add(e); }
    this.eyeGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: g.tex.glow, color: 0xff3010, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.eyeGlow.position.set(0, 0.33, 0.45); this.eyeGlow.scale.setScalar(0.9); R.head.add(this.eyeGlow);
    R.jaw = node(R.head, 0, 0.06, 0.05);
    skin(R.jaw, [part(Bx(0.56, 0.18, 0.58), SKIN_D, 0, -0.08, 0.04), part(Bx(0.46, 0.07, 0.04), BONE, 0, 0.03, 0.31), part(Bx(0.4, 0.05, 0.4), 0x2a0606, 0, 0.02, 0.06)]);
    R.sh = []; R.el = []; R.fist = [];
    for (const s of [-1, 1]) {
      const sh = node(R.chest, s * 1.05, 1.0, 0);
      skin(sh, [part(Bx(0.62, 0.52, 0.62), SKIN, 0, 0, 0), part(Bx(0.5, 1.0, 0.5), SKIN, 0, -0.5, 0), part(Bx(0.3, 0.4, 0.04), WOUND, 0, -0.55, s > 0 ? 0.26 : -0.26)]);
      mark(sh, 0, -0.45, 0, 0.36, 'arm');
      const el = node(sh, 0, -1.0, 0);
      const chain = s > 0 ? [0, 1, 2, 3].map((i) => part(new THREE.TorusGeometry(0.1, 0.03, 4, 8), STEEL, 0, -0.25 - i * 0.14, 0.25, 0, i % 2 ? Math.PI / 2 : 0, 0)) : [];
      skin(el, [part(Bx(0.46, 0.95, 0.46), SKIN, 0, -0.47, 0), part(Bx(0.5, 0.18, 0.5), RUST, 0, -0.2, 0), ...chain,
        part(Bx(0.62, 0.55, 0.62), SKIN_D, 0, -1.05, 0.02), part(Bx(0.08, 0.2, 0.08), 0x1a1a14, -0.2, -1.38, 0.2), part(Bx(0.08, 0.22, 0.08), 0x1a1a14, 0, -1.4, 0.22), part(Bx(0.08, 0.2, 0.08), 0x1a1a14, 0.2, -1.38, 0.2)]);
      mark(el, 0, -0.45, 0, 0.32, 'arm');
      const fist = mark(el, 0, -1.05, 0.02, 0.38, 'arm');
      R.sh.push(sh); R.el.push(el); R.fist.push(fist);
    }
    // red warning ring on the ground for the slam
    const rc = document.createElement('canvas'); rc.width = rc.height = 128;
    const x = rc.getContext('2d'), gr = x.createRadialGradient(64, 64, 40, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,40,20,0)'); gr.addColorStop(0.75, 'rgba(255,40,20,0.25)'); gr.addColorStop(0.92, 'rgba(255,60,30,0.95)'); gr.addColorStop(1, 'rgba(255,40,20,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    this.ring = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(rc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    this.ring.visible = false; this.ring.renderOrder = 3;
    g.scene.add(this.ring);
    g.scene.add(R.root);
  }

  reset() {
    this.state = 'SLEEP'; this.stateT = 0; this.t = Math.random() * 10;
    this.hp = BOSS.hp; this.maxHp = BOSS.hp; this.shownHp = BOSS.hp; this.dead = false; this.enraged = false;
    this.pos.x = BOSS.x; this.pos.y = 0; this.pos.z = BOSS.z; this.yaw = BOSS.yaw;
    this.st.vy = 0; this.st.peak = 0; this.vel.x = this.vel.z = 0;
    this.cool = { act: 1, slam: 3, charge: 5, throw: 4 };
    this.phase = 0; this.stagger = 0; this.flinch = 0; this.stuckT = 0; this.stuckLong = 0; this.sideT = 0; this.side = 1;
    this.losT = 0; this.sees = false; this.snoreT = 3; this.twitchT = 4; this.twitch = null; this.stepS = 0;
    this.victoryT = -1; this.announced = false; this.woken = null;
    this.eyeK = 0; this.ring.visible = false;
    this.ui(false);
    this.pose(0); this.finish();
  }

  solid() { return this.state !== 'SLEEP' && this.state !== 'DEAD'; }
  get awake() { return this.state !== 'SLEEP'; }

  // ---------- waking ----------
  wake(reason) {
    if (this.state !== 'SLEEP') return;           // exactly once per run
    const g = this.g;
    this.state = 'WAKE'; this.stateT = 0; this.woken = reason;
    g.audio.play('growlBig', { pos: this.chestPos(), vol: 1.1, rate: 0.45, max: 300 });
    if (reason === 'final') g.toast('पटरी पर कुछ जाग गया है…', 'Something huge has woken on the tracks west of the station…');
    else g.toast('लोहासुर जाग गया!', 'You woke LOHASUR. Run — or fight.');
    this.ui(true);
  }

  consider(fn) {
    if (this.state !== 'SLEEP') return;
    const c = this.chestPos();
    fn([c[0], 0.9, c[2]], 4.2, { type: 'boss' });
  }

  chestPos() { const h = this.hs.find((q) => q.o === this.chestMark); return [h.p.x, h.p.y, h.p.z]; }

  // ---------- HUD ----------
  ui(on) {
    const el = document.getElementById('bossHud');
    if (!el) return;
    if (on) { document.getElementById('bossName').innerHTML = `${BOSS.name} <small>${BOSS.en}</small>`; el.classList.remove('gone'); el.classList.add('show'); }
    else el.classList.remove('show');
    this._uiHp = -1;
  }
  uiUpdate(dt) {
    if (!this.awake) return;
    this.shownHp = lerp(this.shownHp, this.hp, 1 - Math.exp(-dt * 2.5));
    const k = Math.max(0, this.hp / this.maxHp), kt = Math.max(0, this.shownHp / this.maxHp);
    if (Math.abs(k - this._uiHp) > 0.0005 || Math.abs(kt - (this._uiTr || 0)) > 0.002) {
      this._uiHp = k; this._uiTr = kt;
      document.getElementById('bossFill').style.width = (k * 100).toFixed(1) + '%';
      document.getElementById('bossTrail').style.width = (kt * 100).toFixed(1) + '%';
      document.getElementById('bossHud').classList.toggle('rage', this.enraged);
    }
  }

  // ---------- damage ----------
  hitTest(o, d, maxT) {
    if (this.state === 'DEAD' || !this.hs.length) return null;
    // quick reject against a sphere around the whole body (standing or lying down)
    const c = this.centre, cx = c.x - o.x, cy = c.y - o.y, cz = c.z - o.z;
    const tc = cx * d.x + cy * d.y + cz * d.z;
    if (tc < -3.5 || tc > maxT + 3.5) return null;
    if (cx * cx + cy * cy + cz * cz - tc * tc > 12.25) return null;
    let best = null;
    for (const h of this.hs) {
      const sx = h.p.x - o.x, sy = h.p.y - o.y, sz = h.p.z - o.z;
      const t = sx * d.x + sy * d.y + sz * d.z;
      if (t < 0) continue;
      const q = sx * sx + sy * sy + sz * sz - t * t, r2 = h.r * h.r;
      if (q > r2) continue;
      const th = t - Math.sqrt(r2 - q);
      if (th < maxT && (!best || th < best.t)) best = { e: this, part: h.part, t: th, boss: true };
    }
    return best;
  }

  damage(dmg, part, dir, src) {
    if (this.state === 'DEAD') return false;
    if (this.state === 'SLEEP') this.wake('player');
    const mul = part === 'head' ? 2.0 : part === 'leg' || part === 'arm' ? 0.7 : 1;
    const n = dmg * mul;
    this.hp -= n;
    this.flinch = Math.min(1, this.flinch + n / 120);
    if (n >= 110 && (this.state === 'CHASE' || this.state === 'RECOVER')) this.stagger = 0.55;
    if (Math.random() < 0.25 || n > 100) this.g.audio.play('growlBig', { pos: this.chestPos(), vol: 0.8, rate: 0.5 + Math.random() * 0.15 });
    if (!this.enraged && this.hp < this.maxHp * 0.4 && this.hp > 0) {
      this.enraged = true;
      this.g.audio.play('roar', { pos: this.chestPos(), vol: 1.6, rate: 1.1, max: 400 });
      this.g.toast('लोहासुर भड़क उठा!', 'LOHASUR is enraged — faster and angrier!');
    }
    if (this.hp <= 0) { this.hp = 0; this.die(); return true; }
    return false;
  }

  // explosion: once per blast, falls off with distance from his chest
  blast(x, y, z, R, maxD, src) {
    if (this.state === 'DEAD') return false;
    const c = this.chestPos(), d = Math.max(0, Math.hypot(c[0] - x, c[1] - 0.8 - y, c[2] - z) - 0.9);
    if (d > R) return false;
    this.damage(maxD * Math.pow(1 - d / R, 1.1), 'body', { x: c[0] - x, z: c[2] - z }, src);
    return true;
  }

  die() {
    const g = this.g;
    this.state = 'DEAD'; this.stateT = 0; this.dead = true; this.ring.visible = false;
    g.audio.play('roar', { pos: this.chestPos(), vol: 1.7, rate: 0.7, max: 500 });
    g.stats.kills++;
    g.stats.boss = true;
  }

  // ---------- per frame ----------
  update(dt) {
    const g = this.g, P = g.player;
    this.t += dt; this.stateT += dt;
    for (const k in this.cool) this.cool[k] -= dt;
    this.stagger = Math.max(0, this.stagger - dt); this.flinch = Math.max(0, this.flinch - dt * 2);
    const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z, d = Math.hypot(dx, dz), dy = P.pos.y - this.pos.y;
    this.dist = d;
    // far away and asleep: nothing to do but breathe (and he is not drawn past the fog)
    if (this.state === 'SLEEP') {
      this.sleep(dt, d);
      this.pose(dt); this.finish();
      return;
    }
    if (this.state === 'WAKE') this.rise(dt);
    else if (this.state === 'DEAD') this.dying(dt);
    else this.fight(dt, d, dx, dz, dy);
    this.pose(dt); this.finish();
    // keep the player out of his body
    if (this.solid() && !g.vehicles.driving && d < 1.35 && Math.abs(dy) < 3 && d > 1e-3) g.physics.moveCharacter(P.pos, dx / d * (1.35 - d), dz / d * (1.35 - d), 0, 0.016, P.radius, 1.75, 0.45, P.state);
    // and shove ordinary zombies aside
    if (this.solid()) for (const e of g.enemies.list) {
      if (e.dead) continue;
      const ex = e.pos.x - this.pos.x, ez = e.pos.z - this.pos.z, ed = Math.hypot(ex, ez);
      if (ed < 1.3 && ed > 1e-3 && Math.abs(e.pos.y - this.pos.y) < 2) g.physics.moveCharacter(e.pos, ex / ed * (1.3 - ed), ez / ed * (1.3 - ed), 0, 0.016, 0.3, 1.7, 0.45, e.st);
    }
    this.uiUpdate(dt);
  }

  finish() {
    // past the fog he is not drawn at all
    const cam = this.g.camera.position;
    this.rig.root.visible = Math.abs(cam.x - this.pos.x) < 140 && Math.abs(cam.z - this.pos.z) < 140;
    this.rig.root.updateMatrixWorld(true);
    const c = this.centre || (this.centre = new THREE.Vector3());
    c.set(0, 0, 0);
    for (const h of this.hs) { h.p.setFromMatrixPosition(h.o.matrixWorld); c.add(h.p); }
    c.multiplyScalar(1 / this.hs.length);
  }

  sleep(dt, d) {
    const g = this.g;
    // snoring, only when you are close enough to hear it
    this.snoreT -= dt;
    if (this.snoreT <= 0) {
      this.snoreT = 3.6 + Math.random() * 1.5;
      if (d < 22) g.audio.play('growlBig', { pos: this.chestPos(), vol: 0.32, rate: 0.36, ref: 3, vary: 0.04 });
    }
    // now and then a twitch: a hand, a foot, the head
    this.twitchT -= dt;
    if (this.twitchT <= 0) { this.twitchT = 4 + Math.random() * 8; this.twitch = { what: (Math.random() * 3) | 0, t: 0, s: Math.random() < 0.5 ? 0 : 1 }; }
    if (this.twitch) { this.twitch.t += dt; if (this.twitch.t > 0.7) this.twitch = null; }
    this.eyeK = 0;
  }

  rise(dt) {
    const g = this.g, t = this.stateT, P = g.player;
    this.eyeK = clamp((t - 0.3) * 2, 0, 1);
    if (t > 1.0 && !this._g1) { this._g1 = true; g.audio.play('growlBig', { pos: this.chestPos(), vol: 1.2, rate: 0.42 }); }
    // turn toward the player while getting up
    const ty = Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
    if (t > 2.4) this.yaw += angleDiff(this.yaw, ty) * Math.min(1, dt * 1.6);
    if (t > 4.0 && !this._roared) {
      this._roared = true;
      g.audio.play('roar', { pos: this.chestPos(), vol: 1.9, max: 600, roll: 0.35, ref: 10, verbAmt: 1.2 });
      g.noise(this.pos, 120, 'gun');
      P.shake = Math.max(P.shake, clamp(1.4 - this.dist / 60, 0.35, 1.2));
      this.dustRing(4, 26);
      g.banner(BOSS.name, BOSS.en, 'boss');
      document.getElementById('bossHud').classList.add('pulse');
    }
    if (t > 5.8) { this.state = 'CHASE'; this.stateT = 0; this._g1 = this._roared = false; this.cool.act = 0.4; }
  }

  dying(dt) {
    const g = this.g, t = this.stateT;
    this.eyeK = clamp(1 - (t - 2.2) / 1.8, 0, 1);
    if (t > 2.2 && !this._thud) {
      this._thud = true;
      g.audio.play('explosion', { pos: [this.pos.x, 0.5, this.pos.z], vol: 0.9, rate: 0.5, verbAmt: 0.6 });
      g.player.shake = Math.max(g.player.shake, clamp(1.1 - this.dist / 40, 0.2, 0.9));
      this.dustRing(5, 30);
    }
    if (t > 3.0 && !this.announced) {
      this.announced = true;
      g.banner('BOSS DEFEATED', 'लोहासुर मारा गया · MISSION COMPLETE', 'win');
      document.getElementById('bossHud').classList.add('gone');
    }
    if (t > 7.5 && this.victoryT < 0) { this.victoryT = t; g.bossVictory(); }
  }

  dustRing(r, n) {
    const X = this.g.explosives;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, sp = 3 + Math.random() * 3;
      X.smoke.emit(this.pos.x + Math.cos(a) * r * 0.3, this.pos.y + 0.3, this.pos.z + Math.sin(a) * r * 0.3, Math.cos(a) * sp, 0.4 + Math.random() * 0.6, Math.sin(a) * sp, 1.8 + Math.random(), 0.9, 3.2, [0.36, 0.33, 0.3], [0.26, 0.24, 0.22], 0.5, 0.2, 1.8);
    }
    this.g.fx.burst([this.pos.x, this.pos.y + 0.3, this.pos.z], [0, 0.6, 0], 16, [0.5, 0.45, 0.38], 6, 0.8);
  }

  // ---------- fighting ----------
  _move(dx, dz, speed, dt) {
    const g = this.g, l = Math.hypot(dx, dz);
    if (l > 1e-4) { dx /= l; dz /= l; }
    this.vel.x = lerp(this.vel.x, dx * speed, 1 - Math.exp(-dt * 6)); this.vel.z = lerp(this.vel.z, dz * speed, 1 - Math.exp(-dt * 6));
    const ox = this.pos.x, oz = this.pos.z;
    g.physics.moveCharacter(this.pos, this.vel.x * dt, this.vel.z * dt, this.st.vy, dt, 0.95, 4.3, 0.95, this.st);
    const moved = Math.hypot(this.pos.x - ox, this.pos.z - oz), want = Math.hypot(this.vel.x, this.vel.z) * dt;
    this.moveSpeed = moved / Math.max(dt, 1e-4);
    if (want > 0.004) {
      if (moved < want * 0.3) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt * 2);
      this.yaw += angleDiff(this.yaw, Math.atan2(this.vel.x, this.vel.z)) * Math.min(1, dt * 5);
    }
    return want > 0.004 ? moved / want : 1;
  }

  // Beyond the flow field's reach: cross the railway boundary fence only through its gaps.
  waypoint(T) {
    const FZ = -160.5, GAPS = [-150, 0, 89, 193], p = this.pos;
    if ((p.z < FZ) === (T.z < FZ)) return null;
    let gx = GAPS[0], best = 1e9;
    for (const x of GAPS) { const c = Math.abs(p.x - x) + Math.abs(x - T.x); if (c < best) { best = c; gx = x; } }
    if (Math.abs(p.x - gx) > 1.5) return [gx, p.z < FZ ? FZ - 3 : FZ + 3];
    return [gx, T.z < FZ ? FZ - 4 : FZ + 4];
  }

  // A passing freight train hurls him off the line.
  trainHit(T) {
    if (!this.solid() || this.g.time < (this._trainT || 0)) return;
    this._trainT = this.g.time + 1.2;
    const side = this.pos.z > T.z ? 1 : -1;
    this.g.physics.moveCharacter(this.pos, Math.sign(T.v) * 2, side * 3.5, 0, 0.016, 0.95, 4.3, 0.95, this.st);
    this.g.audio.play('bang', { pos: this.chestPos(), vol: 1.2, rate: 0.5 });
    this.damage(160, 'body', { x: Math.sign(T.v), z: 0 }, 'train');
    if (this.state !== 'DEAD') { this.to('STUN'); }
  }

  face(tx, tz, dt, k = 5) { this.yaw += angleDiff(this.yaw, Math.atan2(tx - this.pos.x, tz - this.pos.z)) * Math.min(1, dt * k); }

  to(s) { this.state = s; this.stateT = 0; this.struck = false; this.cued = false; this.ring.visible = false; }

  fight(dt, d, dx, dz, dy) {
    const g = this.g, P = g.player, rage = this.enraged ? 1.25 : 1;
    this.eyeK = 1;
    // line of sight, throttled
    this.losT -= dt;
    if (this.losT <= 0) {
      this.losT = 0.3;
      const h = this.hs.find((q) => q.part === 'head').p, ex = P.pos.x - h.x, ey = P.pos.y + P.eye - h.y, ez = P.pos.z - h.z, el = Math.hypot(ex, ey, ez);
      this.sees = !g.physics.raycast(h.x, h.y, h.z, ex / el, ey / el, ez / el, el - 0.4);
    }
    if (P.dead) { this._move(0, 0, 0, dt); return; }
    switch (this.state) {
      case 'CHASE': {
        if (this.stagger > 0) { this._move(0, 0, 0, dt); break; }
        let mx = dx, mz = dz;
        if (this.sideT > 0) { this.sideT -= dt; const l = d || 1; mx = dx / l * 0.25 - dz / l * this.side; mz = dz / l * 0.25 + dx / l * this.side; }
        else if (P.pos.y < 1.3 && d > 3) {
          const f = g.nav.flow(this.pos.x, this.pos.z);
          if (f && f[2] > 4) { mx = f[0]; mz = f[1]; }
          else { const w = this.waypoint(P.pos); if (w) { mx = w[0] - this.pos.x; mz = w[1] - this.pos.z; } }
        }
        // far away he lopes to close the distance; close in he stalks
        const speed = (d > 40 ? 4.2 : 2.5) * rage;
        if (d > 2.6) this._move(mx, mz, speed, dt); else { this._move(0, 0, 0, dt); this.face(P.pos.x, P.pos.z, dt); }
        if (this.stuckT > 1.0) { this.sideT = 1.1; this.side = Math.random() < 0.5 ? -1 : 1; this.stuckT = 0; this.stuckLong += 1; }
        if (this.moveSpeed > 0.8) this.stuckLong = Math.max(0, this.stuckLong - dt * 0.3);
        if (this.cool.act > 0) break;
        const flat = Math.abs(dy) < 1.6;
        if (d < 3.7 && Math.abs(dy) < 2.3) this.to('SWIPE');
        else if (d < 7.5 && flat && this.cool.slam <= 0) this.to('SLAM');
        else if (d > 10 && d < 34 && flat && this.sees && this.cool.charge <= 0) this.to('CHARGE_WIND');
        else if ((dy > 2 || this.stuckLong >= 3 || (g.vehicles.driving && d > 8)) && this.sees && d < 48 && this.cool.throw <= 0) this.to('THROW');
        break;
      }
      case 'SWIPE': {
        const wind = this.enraged ? 0.6 : 0.78;
        this._move(0, 0, 0, dt);
        if (this.stateT < wind) this.face(P.pos.x, P.pos.z, dt, 3);
        if (!this.cued) { this.cued = true; g.audio.play('growlBig', { pos: this.chestPos(), vol: 0.9, rate: 0.55 }); }
        if (this.stateT >= wind && !this.struck) {
          this.struck = true;
          g.audio.play('whoosh', { pos: this.chestPos(), vol: 1, rate: 0.5 });
          const ang = Math.abs(angleDiff(this.yaw, Math.atan2(dx, dz)));
          if (d < 4.1 && ang < 1.25 && Math.abs(dy) < 2.4) {
            g.hurtPlayer(30 + Math.random() * 8, this);
            g.audio.play('bang', { vol: 0.8, rate: 0.8 });
            if (!g.vehicles.driving) g.physics.moveCharacter(P.pos, dx / (d || 1) * 1.4, dz / (d || 1) * 1.4, 0, 0.016, P.radius, 1.75, 0.45, P.state);
            else g.vehicles.car.speed *= 0.3;
          }
        }
        if (this.stateT > wind + 0.5) { this.to('CHASE'); this.cool.act = 0.6 / rage; }
        break;
      }
      case 'SLAM': {
        const wind = this.enraged ? 0.85 : 1.05;
        this._move(0, 0, 0, dt);
        if (this.stateT < wind) {
          this.face(P.pos.x, P.pos.z, dt, 2);
          const k = this.stateT / wind, R = 6.8;
          this.ring.visible = true; this.ring.position.set(this.pos.x, this.pos.y + 0.08, this.pos.z);
          this.ring.scale.setScalar(R * (0.35 + 0.65 * k)); this.ring.material.opacity = 0.55 + 0.45 * Math.sin(this.stateT * 22);
        }
        if (this.stateT >= wind && !this.struck) {
          this.struck = true; this.ring.visible = false;
          g.audio.play('explosion', { pos: [this.pos.x, 0.4, this.pos.z], vol: 1.1, rate: 0.6, verbAmt: 0.7 });
          g.audio.play('bang', { pos: [this.pos.x, 0.4, this.pos.z], vol: 1, rate: 0.6 });
          this.dustRing(6.8, 34);
          P.shake = Math.max(P.shake, clamp(1.2 - d / 30, 0.2, 1));
          if (d < 6.8 && Math.abs(dy) < 1.6 && (P.onGround || g.vehicles.driving)) {
            g.hurtPlayer(12 + 30 * (1 - d / 6.8), this);
            if (!g.vehicles.driving) P.state.vy = 5;
          }
          for (const e of g.enemies.list) if (!e.dead && Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < 6.8) g.enemies.damage(e, 60, 'body', null, 'boss');
          g.noise(this.pos, 60, 'gun');
        }
        if (this.stateT > wind + 0.9) { this.to('CHASE'); this.cool.act = 0.7 / rage; this.cool.slam = (this.enraged ? 4 : 6) + Math.random() * 2; }
        break;
      }
      case 'CHARGE_WIND': {
        this._move(0, 0, 0, dt);
        this.face(P.pos.x, P.pos.z, dt, 4);
        if (!this.struck) { this.struck = true; g.audio.play('roar', { pos: this.chestPos(), vol: 1.4, rate: 1.35, max: 400 }); }
        if (this.stateT > (this.enraged ? 0.75 : 0.95)) {
          const l = d || 1;
          this.chargeDir = { x: dx / l, z: dz / l }; this.yaw = Math.atan2(dx, dz);
          this.to('CHARGE');
        }
        break;
      }
      case 'CHARGE': {
        const sp = 10.5 * rage, cd = this.chargeDir;
        const ratio = this._move(cd.x, cd.z, sp, dt);
        if (this.stateT > 0.25 && ratio < 0.35 && Math.hypot(this.vel.x, this.vel.z) > 3) {
          // slammed into something solid: stunned
          g.audio.play('bang', { pos: this.chestPos(), vol: 1.2, rate: 0.5 }); g.audio.play('explosion', { pos: this.chestPos(), vol: 0.5, rate: 0.8 });
          g.fx.burst([this.pos.x + cd.x * 1.2, 2.5, this.pos.z + cd.z * 1.2], [-cd.x, 0.5, -cd.z], 22, [0.6, 0.55, 0.5], 6);
          P.shake = Math.max(P.shake, clamp(0.9 - d / 30, 0.1, 0.7));
          this.vel.x = this.vel.z = 0;
          this.to('STUN'); this.cool.charge = 7;
          break;
        }
        if (Math.random() < dt * 14) this.g.explosives.smoke.emit(this.pos.x, 0.3, this.pos.z, -cd.x * 2, 0.6, -cd.z * 2, 1.2, 0.8, 2.4, [0.36, 0.33, 0.3], [0.28, 0.26, 0.24], 0.45, 0.2, 1.5);
        if (d < 2.4 && Math.abs(dy) < 2.2) {
          g.hurtPlayer(28 + Math.random() * 6, this);
          g.audio.play('bang', { vol: 1, rate: 0.7 });
          P.shake = Math.max(P.shake, 0.9);
          if (g.vehicles.driving) { const c = g.vehicles.car; c.speed = 0; g.physics.moveCharacter(c, cd.x * 2, cd.z * 2, 0, 0.016, 1.0, 1.6, 0.45, { vy: 0 }); }
          else g.physics.moveCharacter(P.pos, cd.x * 3, cd.z * 3, 0, 0.016, P.radius, 1.75, 0.45, P.state);
          this.to('RECOVER'); this.cool.charge = 7 + Math.random() * 3;
          break;
        }
        for (const e of g.enemies.list) if (!e.dead && Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < 1.7) g.enemies.damage(e, 200, 'body', cd, 'boss');
        if (this.stateT > 2.3) { this.to('RECOVER'); this.cool.charge = 6 + Math.random() * 3; }
        break;
      }
      case 'THROW': {
        this._move(0, 0, 0, dt);
        this.face(P.pos.x, P.pos.z, dt, 4);
        if (this.stateT > 0.9 && !this.struck) {
          this.struck = true;
          const f = this.rig.fist[1], hp = new THREE.Vector3().setFromMatrixPosition(f.matrixWorld);
          const lead = g.vehicles.driving ? 0.6 : 0.35, pv = P.vel || { x: 0, y: 0 };
          const to = [P.pos.x + (pv.x || 0) * lead, P.pos.y + 1.0, P.pos.z + (pv.y || 0) * lead];
          g.audio.play('whoosh', { pos: [hp.x, hp.y, hp.z], vol: 1, rate: 0.6 });
          g.explosives.throwRock([hp.x, hp.y, hp.z], to, (x, y, z) => {
            const pd = Math.hypot(P.pos.x - x, P.pos.y + 1 - y, P.pos.z - z);
            if (pd < 2.8) g.hurtPlayer(8 + 22 * (1 - pd / 2.8), this);
          });
          this.stuckLong = 0;
        }
        if (this.stateT > 1.6) { this.to('CHASE'); this.cool.act = 0.8; this.cool.throw = (this.enraged ? 2.5 : 3.5) + Math.random() * 2; }
        break;
      }
      case 'STUN': {
        this._move(0, 0, 0, dt);
        if (Math.random() < dt * 6) g.fx.burst([this.pos.x, 4.4, this.pos.z], [0, 1, 0], 2, [1, 0.9, 0.5], 1.5, 0.4);
        if (this.stateT > 2.0) { this.to('CHASE'); this.cool.act = 0.5; }
        break;
      }
      case 'RECOVER': {
        this._move(0, 0, 0, dt);
        this.face(P.pos.x, P.pos.z, dt, 2);
        if (this.stateT > (this.enraged ? 0.7 : 1.0)) { this.to('CHASE'); this.cool.act = 0.4; }
        break;
      }
      default: this.to('CHASE');
    }
    // heavy footsteps
    if (this.moveSpeed > 0.5) {
      const s = Math.sin(this.phase) > 0 ? 1 : 0;
      if (s !== this.stepS) {
        this.stepS = s;
        g.audio.play('slam', { pos: [this.pos.x, 0.3, this.pos.z], vol: 0.6, rate: 0.55, ref: 4 });
        if (d < 18) P.shake = Math.max(P.shake, 0.18 * (1 - d / 18) * (this.state === 'CHARGE' ? 2 : 1));
      }
    }
  }

  // ---------- procedural animation ----------
  pose(dt) {
    const R = this.rig, t = this.t;
    R.root.position.set(this.pos.x, this.pos.y, this.pos.z);
    R.root.rotation.set(0, this.yaw, 0);
    R.body.position.set(0, 0, 0); R.body.rotation.set(0, 0, 0);
    R.hips.rotation.set(0, 0, 0); R.spine.rotation.set(0.35, 0, 0); R.chest.rotation.set(0, 0, 0); R.chest.scale.set(1, 1, 1);
    R.neck.rotation.set(-0.25, 0, 0); R.head.rotation.set(0, 0, 0); R.jaw.rotation.set(0.12, 0, 0);
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      R.hip[i].rotation.set(0, 0, 0); R.knee[i].rotation.set(0, 0, 0);
      R.sh[i].rotation.set(-0.3, 0, s * 0.12); R.el[i].rotation.set(-0.35, 0, 0);
    }
    const st = this.state, T = this.stateT;
    if (st === 'SLEEP' || st === 'WAKE') {
      // on his back; one arm resting on the chest
      let a = -Math.PI / 2, sp = 0, lift = 0.53;
      R.spine.rotation.x = 0; R.neck.rotation.x = 0.15;
      R.sh[0].rotation.set(-1.15, 0, -0.35); R.el[0].rotation.set(-1.4, 0, 0);
      R.sh[1].rotation.set(0.05, 0, 0.1); R.el[1].rotation.set(-0.15, 0, 0);
      R.hip[0].rotation.z = -0.08; R.hip[1].rotation.z = 0.12; R.knee[1].rotation.x = 0.25;
      const br = Math.sin(t * 1.5);
      R.chest.scale.set(1, 1, 1 + br * 0.045); R.head.rotation.z = Math.sin(t * 0.23) * 0.12; R.jaw.rotation.x = 0.18 + br * 0.04;
      if (st === 'SLEEP' && this.twitch) {
        const k = Math.sin(this.twitch.t / 0.7 * Math.PI) * 0.35;
        if (this.twitch.what === 0) R.el[this.twitch.s].rotation.x -= k; else if (this.twitch.what === 1) R.knee[this.twitch.s].rotation.x += k; else R.head.rotation.y += k;
      }
      if (st === 'WAKE') {
        if (T < 1.3) { const j = Math.max(0, T - 0.4) * 3; R.el[1].rotation.x -= Math.abs(Math.sin(j * 7)) * 0.5 * Math.min(1, j); R.head.rotation.y = Math.sin(T * 5) * 0.4 * Math.min(1, T); }
        else if (T < 2.6) {
          const u = ease((T - 1.3) / 1.3);
          sp = u * (Math.PI / 2 - 0.1);
          for (let i = 0; i < 2; i++) { R.sh[i].rotation.set(lerp(R.sh[i].rotation.x, 0.5, u), 0, (i ? 1 : -1) * 0.35); R.el[i].rotation.x = lerp(R.el[i].rotation.x, -0.2, u); }
          R.head.rotation.x = -0.3 * u;
        } else {
          const u = ease((T - 2.6) / 1.4);
          a = -Math.PI / 2 * (1 - u); sp = (Math.PI / 2 - 0.1) * (1 - u) + 0.35 * u; lift = 0.53 * (1 - u);
          const b = Math.sin(u * Math.PI);
          for (let i = 0; i < 2; i++) { R.hip[i].rotation.x = -0.9 * b; R.knee[i].rotation.x = 1.3 * b; R.sh[i].rotation.set(0.5 * (1 - u) - 0.3 * u - 0.4 * b, 0, (i ? 1 : -1) * 0.35); R.el[i].rotation.x = -0.3; }
          R.chest.scale.set(1, 1, 1);
          if (T > 4.0) {
            // the roar: head thrown back, arms wide, jaw open
            const r = ease((T - 4.0) / 0.35) * (1 - ease((T - 5.4) / 0.4));
            sp = lerp(sp, -0.15, r); R.neck.rotation.x = lerp(-0.25, -0.75, r); R.jaw.rotation.x = lerp(0.12, 0.75, r);
            for (let i = 0; i < 2; i++) { const s = i ? 1 : -1; R.sh[i].rotation.set(lerp(-0.3, -0.5, r), 0, s * lerp(0.35, 1.25, r)); R.el[i].rotation.x = lerp(-0.3, -0.9, r); }
            R.chest.scale.set(1 + r * 0.06, 1 + r * 0.04, 1 + r * 0.08);
            R.body.position.x = Math.sin(T * 40) * 0.02 * r;
          }
        }
        R.spine.rotation.x = sp;
      }
      R.root.rotation.x = a; R.root.position.y = this.pos.y + lift;
    } else if (st === 'DEAD') {
      const u1 = ease(T / 1.0), u2 = ease((T - 1.0) / 1.2);
      R.spine.rotation.x = lerp(0.35, -0.35, u1) * (1 - u2) + 0.5 * u2; R.neck.rotation.x = lerp(-0.25, -0.8, u1) * (1 - u2); R.jaw.rotation.x = 0.7 * (1 - u2 * 0.5);
      for (let i = 0; i < 2; i++) { const s = i ? 1 : -1; R.sh[i].rotation.set(-0.6 - Math.sin(T * 9 + i) * 0.4 * (1 - u2), 0, s * 0.9 * (1 - u2) + s * 0.2); R.knee[i].rotation.x = 1.1 * Math.sin(u2 * Math.PI) ; R.hip[i].rotation.x = -0.6 * Math.sin(u2 * Math.PI); }
      R.root.rotation.x = u2 * (Math.PI / 2 - 0.04); R.root.position.y = this.pos.y + 0.55 * u2;
    } else {
      // walking / running: heavy lurching gait
      const sp = this.moveSpeed || 0, sw = Math.min(1, sp / 2.2), run = Math.min(1, sp / 8);
      this.phase += (sp * 1.25 + 0.0001) * dt;
      const ph = this.phase, legA = Math.sin(ph) * (0.42 + run * 0.35) * sw;
      for (let i = 0; i < 2; i++) {
        const s = i ? 1 : -1;
        R.hip[i].rotation.x = legA * s; R.knee[i].rotation.x = Math.max(0, -Math.sin(ph + (i ? Math.PI : 0) + 0.8)) * (0.8 + run * 0.6) * sw;
        R.sh[i].rotation.x = -0.3 - legA * s * 0.6 - run * 0.5; R.el[i].rotation.x = -0.35 - run * 0.4;
      }
      R.body.position.y = Math.abs(Math.cos(ph)) * 0.14 * sw;
      R.spine.rotation.set(0.35 + run * 0.35 - this.flinch * 0.4, Math.sin(ph) * 0.08 * sw, Math.sin(ph) * 0.06 * sw);
      R.neck.rotation.y = Math.sin(t * 0.6) * 0.15; R.jaw.rotation.x = 0.15 + Math.max(0, Math.sin(t * 2.3)) * 0.12;
      if (this.stagger > 0) { R.spine.rotation.x -= 0.45 * Math.sin(this.stagger / 0.55 * Math.PI); R.neck.rotation.x -= 0.3; }
      if (st === 'SWIPE') {
        const wind = this.enraged ? 0.6 : 0.78, k = T < wind ? ease(T / wind) : 1 - ease((T - wind) / 0.25);
        R.sh[1].rotation.set(-0.3 - 2.3 * k, 0, 0.4 * k); R.el[1].rotation.x = -0.9 * k;
        if (T >= wind) { const s = ease((T - wind) / 0.2); R.sh[1].rotation.set(lerp(-2.6, -1.0, s), lerp(0, -0.9, s), lerp(0.4, -0.2, s)); R.spine.rotation.y = -0.5 * s; }
        else R.spine.rotation.y = 0.35 * k;
        R.jaw.rotation.x = 0.5;
      } else if (st === 'SLAM') {
        const wind = this.enraged ? 0.85 : 1.05, up = T < wind ? ease(T / wind) : 1 - ease((T - wind) / 0.12);
        for (let i = 0; i < 2; i++) { R.sh[i].rotation.set(-0.3 - 2.6 * up, 0, (i ? 1 : -1) * 0.25); R.el[i].rotation.x = -0.4 * up; }
        R.spine.rotation.x = 0.35 - 0.45 * up + (T >= wind ? 0.5 : 0); R.body.position.y = 0.2 * up;
        R.jaw.rotation.x = 0.6;
      } else if (st === 'CHARGE_WIND' || st === 'CHARGE') {
        R.spine.rotation.x = 0.85; R.neck.rotation.x = -0.6; R.jaw.rotation.x = 0.55;
        if (st === 'CHARGE_WIND') { R.hip[0].rotation.x = -0.3 + Math.sin(T * 14) * 0.25; R.body.position.y = 0; }
        for (let i = 0; i < 2; i++) R.sh[i].rotation.z = (i ? 1 : -1) * 0.5;
      } else if (st === 'THROW') {
        const k = T < 0.9 ? ease(T / 0.9) : 1 - ease((T - 0.9) / 0.2);
        R.sh[1].rotation.set(-0.3 - 2.4 * k + (T >= 0.9 ? -1.0 : 0), 0, 0.2); R.el[1].rotation.x = -1.2 * k;
        R.spine.rotation.y = 0.5 * k; R.spine.rotation.x = 0.35 - 0.3 * k;
      } else if (st === 'STUN') {
        R.neck.rotation.set(0.3 + Math.sin(T * 5) * 0.25, Math.sin(T * 3.3) * 0.5, Math.sin(T * 4.1) * 0.3); R.jaw.rotation.x = 0.4;
        for (let i = 0; i < 2; i++) R.sh[i].rotation.x = -0.1;
      } else if (st === 'RECOVER') {
        R.chest.scale.set(1, 1 + Math.sin(T * 9) * 0.03, 1 + Math.sin(T * 9) * 0.05);
      }
    }
    // eyes
    const ek = this.eyeK * (this.enraged ? 1.3 : 1) * (0.85 + Math.sin(t * 13) * 0.08) * ((st === 'SWIPE' || st === 'SLAM' || st === 'CHARGE_WIND') ? 1.35 : 1);
    this.eyeMat.color.setRGB(0.15 + ek * 1.0, 0.03 + ek * 0.12, 0.02 + ek * 0.03);
    this.eyeGlow.visible = ek > 0.05; this.eyeGlow.material.opacity = Math.min(1, ek); this.eyeGlow.scale.setScalar(0.7 + ek * 0.6);
  }
}
