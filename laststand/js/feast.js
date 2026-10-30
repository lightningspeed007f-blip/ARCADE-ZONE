// The feast: a zombie lies asleep in the road and a survivor crouches over him, biting.
//   models/zombies/fuzz.glb      the sleeping zombie (clip "sleep"); the same body is the crawler (enemies.js, "crawler")
//   models/zombies/survivor.glb  the one who bites (clip "bite")
// Both are rigged Mixamo bodies (scripts/zombies, "fuzz" and "survivor"). The pair is a set piece: a few of them are
// laid out along the streets each run (game.js spawnEnemies). The sleeper breathes and stirs; the biter bends over him,
// tears at him, straightens up and bends again, and every time his head comes down the bite is heard (and a little
// blood flies). They can be shot, and then they lie still.
import * as THREE from 'three';
import { cloneSkinned, lambertize, loadGLB } from './models.js';

// the quiet stretch of the sleep clip, played back and forth (later on the sleeper rolls over, out from under the biter)
const SLEEP_LO = 0.4, SLEEP_HI = 4.4;
// where the biter stands, in the sleeper's own frame (metres): beside his back, his head coming down on the sleeper's chest
const BITER = [0.1, -1.02];
// hit spheres: bone, radius, part, lift
const HS = [['Head', 0.15, 'head'], ['Spine2', 0.22, 'body'], ['Spine', 0.2, 'body'], ['Hips', 0.2, 'body'],
  ['LeftUpLeg', 0.13, 'leg'], ['RightUpLeg', 0.13, 'leg'], ['LeftLeg', 0.11, 'leg'], ['RightLeg', 0.11, 'leg'],
  ['LeftForeArm', 0.09, 'arm'], ['RightForeArm', 0.09, 'arm']];
const ACTIVE = 70, EAT_HEAR = 14, EAT_LOOPS = 3;
const clean = (n) => n.replace(/^mixamorig\d*:?/, '').replace(/_\d+$/, '');
const _v = new THREE.Vector3();

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

export class Feasts {
  constructor(game) {
    this.g = game;
    this.T = {};            // 'fuzz' / 'survivor' -> { src, clip }
    this.sites = [];
    this.started = false;
  }

  start() {
    if (this.started) return; this.started = true;
    for (const [key, file, clip] of [['fuzz', 'models/zombies/fuzz.glb', 'sleep'], ['survivor', 'models/zombies/survivor.glb', 'bite']]) {
      loadGLB(file).then((gltf) => {
        lambertize(gltf.scene, false, 0.07);
        gltf.scene.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
        this.T[key] = { src: gltf.scene, clip: gltf.animations.find((a) => a.name === clip) };
        for (const s of this.sites) this._build(s);
      }).catch((e) => console.warn('could not load', file, e));
    }
  }

  // a new run: the old pairs go
  clear() {
    for (const s of this.sites) { this._eat(s, false); if (s.group) this.g.scene.remove(s.group); }
    this.sites.length = 0;
  }

  place(x, z, yaw) {
    const s = { x, z, yaw, group: null, sleeper: null, biter: null, eat: null, t: Math.random() * 20, dip: false, blood: false };
    this.sites.push(s);
    this._build(s);
    return s;
  }

  _piece(key, kind) {
    const T = this.T[key];
    const root = cloneSkinned(T.src);
    const bones = {};
    root.traverse((o) => { if (o.isBone) bones[clean(o.name)] = o; });
    const mixer = new THREE.AnimationMixer(root), act = mixer.clipAction(T.clip);
    act.play();
    const p = { kind, root, bones, mixer, act, hp: kind === 'biter' ? 90 : 60, dead: false, deadT: 0, hs: HS.filter((h) => bones[h[0]]).map((h) => ({ b: bones[h[0]], r: h[1], part: h[2], p: new THREE.Vector3() })), site: null };
    p.damage = (dmg, part, dir, src) => this._damage(p, dmg, part, src);
    return p;
  }

  _build(s) {
    if (s.group || !this.T.fuzz || !this.T.survivor) return;
    const g = this.g, grp = s.group = new THREE.Group();
    grp.position.set(s.x, 0, s.z); grp.rotation.y = s.yaw;
    s.sleeper = this._piece('fuzz', 'sleeper'); s.biter = this._piece('survivor', 'biter');
    s.sleeper.site = s.biter.site = s;
    s.biter.root.position.set(BITER[0], 0, BITER[1]);
    grp.add(s.sleeper.root, s.biter.root);
    s.sleeper.act.time = SLEEP_LO; s.biter.act.time = Math.random() * 6;
    g.scene.add(grp);
    if (g.fx && g.fx.bloodPool) g.fx.bloodPool(s.x, 0, s.z, 1.8);
  }

  _damage(p, dmg, part, src) {
    if (p.dead) return false;
    p.hp -= dmg * (part === 'head' ? 2 : 1);
    const g = this.g;
    if (p.hp > 0) return false;
    p.dead = true; p.deadT = 0;
    p.act.paused = true;
    p.root.getWorldPosition(_v);
    g.audio.play(p.kind === 'biter' ? 'growl' : 'flesh', { pos: [_v.x, 1, _v.z], vol: 0.6, rate: 0.7 });
    g.fx.bloodPool(_v.x, 0, _v.z, 1.2);
    if (src === 'player') g.stats.kills++;
    if (p.kind === 'biter') this._eat(p.site, false);
    return true;
  }

  _eat(s, on) {
    const E = this.g.enemies;
    if (!on) { if (s.eat) { s.eat.stop(); s.eat = null; E.eatLoops = Math.max(0, (E.eatLoops || 0) - 1); } return; }
    if (s.eat || (E.eatLoops || 0) >= EAT_LOOPS || !this.g.audio.has('zombieEat')) return;
    const w = s.biter.hs[0].p;
    s.eat = this.g.audio.loopAt('zombieEat', 0.8, [s.x, 0.4, s.z], { ref: 2.2, rate: 0.95 + Math.random() * 0.1, verbAmt: 0.25 });
    if (s.eat) E.eatLoops = (E.eatLoops || 0) + 1;
  }

  update(dt) {
    const g = this.g, P = g.player.pos;
    for (const s of this.sites) {
      if (!s.group) continue;
      const d = Math.hypot(P.x - s.x, P.z - s.z);
      s.group.visible = d < 140;
      if (d > ACTIVE) { this._eat(s, false); continue; }
      s.t += dt;
      const { sleeper: sl, biter: bi } = s;
      // the sleeper: back and forth over the quiet stretch of his clip
      if (!sl.dead) {
        const L = SLEEP_HI - SLEEP_LO, ph = s.t % (2 * L);
        sl.act.paused = true; sl.act.time = SLEEP_LO + (ph < L ? ph : 2 * L - ph);
      }
      sl.mixer.update(sl.dead ? 0 : 0.0001);
      // the biter: the whole bite clip, over and over
      bi.mixer.update(bi.dead ? 0 : dt);
      if (bi.dead) {
        bi.deadT += dt;
        const k = Math.min(1, bi.deadT / 0.6), e = k * k * (3 - 2 * k);
        bi.root.rotation.z = e * 1.45; bi.root.position.y = e * 0.12;
      }
      s.group.updateMatrixWorld(true);
      for (const p of [sl, bi]) for (const h of p.hs) h.b.getWorldPosition(h.p);
      if (bi.dead) continue;
      // each time his head comes down on the sleeper: the bite
      const head = bi.hs[0].p;
      if (head.y < 0.17 && !s.dip) {
        s.dip = true;
        g.audio.play('crunch', { pos: [head.x, 0.2, head.z], vol: 0.9, vary: 0.1 });
        g.fx.burst([head.x, 0.25, head.z], [0, 0.4, 0], 4, [0.45, 0.02, 0.02], 1.4, 0.5);
      } else if (head.y > 0.24) s.dip = false;
      this._eat(s, d < EAT_HEAR);
      if (s.eat && d > EAT_HEAR + 2) this._eat(s, false);
    }
  }

  hitTest(o, d, maxT) {
    let best = null;
    for (const s of this.sites) {
      if (!s.group || !s.group.visible) continue;
      const cx = s.x - o.x, cz = s.z - o.z, tc = cx * d.x + cz * d.z + (0.3 - o.y) * d.y;
      if (cx * cx + cz * cz > 12 * 12 && Math.hypot(cx, cz) > 12 + Math.max(0, tc) * 0) continue;
      for (const p of [s.sleeper, s.biter]) {
        if (p.dead) continue;
        const h = sphereHit(p, p.hs, o, d, best ? best.t : maxT);
        if (h) best = h;
      }
    }
    return best;
  }
}
