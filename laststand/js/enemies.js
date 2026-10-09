// Zombies and hostile humans. Bodies are drawn with instanced box limbs
// (7 draw calls for every enemy on the map) and animated procedurally.
import * as THREE from 'three';
import { clamp, lerp, angleDiff } from './util.js';
import { Physics } from './physics.js';

const MAX = 130;
export const TYPES = {
  walker: { hp: 70, speed: 1.15, chase: 1.55, dmg: 12, reach: 1.45, wind: 0.55, sight: 17, scale: 1, growl: 'growl' },
  runner: { hp: 50, speed: 1.4, chase: 4.6, dmg: 9, reach: 1.4, wind: 0.35, sight: 24, scale: 0.96, growl: 'scream' },
  brute:  { hp: 260, speed: 1.0, chase: 1.9, dmg: 30, reach: 1.7, wind: 0.8, sight: 15, scale: 1.25, growl: 'growlBig' },
  human:  { hp: 95, speed: 1.6, chase: 3.6, dmg: 0, reach: 0, wind: 0, sight: 34, scale: 1, growl: null },
  // chor: a masked knife thief. Fast, melee, grabs food from the bag and bolts.
  thief:  { hp: 60, speed: 1.55, chase: 5.0, dmg: 9, reach: 1.5, wind: 0.4, sight: 30, scale: 0.98, growl: null },
};
const THIEF_GUN = { dmg: 0, rate: 1, burst: 0, sound: 'pistol', drop: 'katta' };
const HUMAN_GUNS = {
  pistol: { dmg: 9, rate: 0.65, burst: 2, sound: 'pistol', drop: 'pistol' },
  rifle: { dmg: 7, rate: 0.16, burst: 3, sound: 'rifle', drop: 'rifle' },
  shotgun: { dmg: 20, rate: 1.4, burst: 1, sound: 'shotgun', drop: 'dunali' },
};

const SKIN_Z = [0x7d8a72, 0x8a8a78, 0x6f7a68, 0x93907a, 0x7a7060];
const SKIN_H = [0x8d5a3c, 0xa06a48, 0x7a4a30, 0xb07a58];
const CLOTH = [0xe8e2d0, 0x6a7a9a, 0x9a3030, 0x3a5a3a, 0xc8a040, 0x504860, 0x8a6a4a, 0xd0d0d8, 0x2a3a5a];
const LEGS = [0x2a3040, 0x403a30, 0xd8d4c8, 0x5a5048, 0x30302a];

class Rig {
  constructor() {
    const O = () => new THREE.Object3D();
    this.root = O(); this.body = O(); this.pelvis = O(); this.spine = O(); this.chest = O(); this.neck = O(); this.head = O();
    this.sh = [O(), O()]; this.ua = [O(), O()]; this.el = [O(), O()]; this.fa = [O(), O()];
    this.hip = [O(), O()]; this.th = [O(), O()]; this.kn = [O(), O()]; this.sn = [O(), O()]; this.gun = O();
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
  }
}

export class Enemies {
  constructor(scene, mats, game) {
    this.game = game;
    this.list = [];
    this.rig = new Rig();
    const mat = new THREE.MeshLambertMaterial({ map: mats.grime });
    const mk = (geo, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); m.setColorAt(0, new THREE.Color()); return m; };
    this.im = {
      head: mk(new THREE.BoxGeometry(0.21, 0.26, 0.24), MAX),
      chest: mk(new THREE.BoxGeometry(0.42, 0.58, 0.24), MAX),
      pelvis: mk(new THREE.BoxGeometry(0.37, 0.22, 0.22), MAX),
      ua: mk(new THREE.BoxGeometry(0.11, 0.32, 0.11), MAX * 2),
      fa: mk(new THREE.BoxGeometry(0.095, 0.3, 0.095), MAX * 2),
      th: mk(new THREE.BoxGeometry(0.15, 0.46, 0.15), MAX * 2),
      sn: mk(new THREE.BoxGeometry(0.13, 0.46, 0.13), MAX * 2),
      gun: mk(new THREE.BoxGeometry(0.06, 0.09, 0.6), MAX),
    };
    this._c = new THREE.Color(); this._v = new THREE.Vector3();
    this.tmpBoxes = [];
  }

  clear() { this.list.length = 0; }
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
      colors: {
        skin: thief ? 0x161616 : human ? pick(SKIN_H) : pick(SKIN_Z),   // thieves wear a black mask and gloves
        top: thief ? pick([0xd8541a, 0xe0a010, 0xc02840]) : human ? pick([0x2a2a30, 0x3a3020, 0x30402a, 0x5a1a1a]) : pick(CLOTH),
        legs: thief ? 0x1c1c22 : human ? pick([0x22283a, 0x2a2a2a, 0x3a3428]) : pick(LEGS),
      },
      wanderYaw: r() * 6.28, nextGrowl: 2 + r() * 8, attackT: 0, stagger: 0, flinch: 0,
      lastSeen: null, losT: 0, seeT: 0, alert: 0, investigate: null, stuckT: 0, sideT: 0, side: 1,
      route: o.route || null, routeI: 0, thief, loot: null, tunnel: o.tunnel || false, zone: o.zone || null, hold: o.hold || false,
      gun: thief ? THIEF_GUN : human ? HUMAN_GUNS[o.gun || pick(['pistol', 'pistol', 'rifle', 'shotgun'])] : null,
      ammo: 0, coolT: 0, burstLeft: 0, cover: null, coverT: 0, peek: null, react: 0, hs: [], home: { x, z },
      inside: o.inside || false, frozen: o.frozen || false, aimT: 0,
    };
    if (e.gun && !thief) e.gunKey = o.gun || Object.keys(HUMAN_GUNS).find((k) => HUMAN_GUNS[k] === e.gun);
    if (type === 'brute') e.colors.top = 0x3a2a20;
    this.list.push(e);
    return e;
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
    if (dir) { e.hitDir = Math.atan2(dir.x, dir.z); }
    if (!e.human && e.type !== 'brute' && n > 20) e.stagger = 0.35;
    if (part === 'leg' && !e.human) e.limp = Math.min(0.75, e.limp + 0.2);
    // being shot always reveals the shooter
    if (src === 'player') { e.alert = 1; e.lastSeen = { x: this.game.player.pos.x, z: this.game.player.pos.z }; if (e.thief) { if (e.state !== 'FLEE') e.state = 'CHASE'; } else if (e.human) { e.state = 'ATTACK'; e.react = 0.1; } else e.state = 'CHASE'; if (e.zone) this.alertZone(e); }
    if (e.hp <= 0) { this.kill(e, part, dir, src); return true; }
    if (e.human && !e.thief && e.hp < e.maxHp * 0.3 && e.state !== 'RETREAT') { e.state = 'RETREAT'; e.stateT = 0; }
    return false;
  }

  kill(e, part, dir, src) {
    e.dead = true; e.deathT = 0;
    e.fallDir = dir ? (Math.cos(e.yaw) * dir.z + Math.sin(e.yaw) * dir.x > 0 ? -1 : 1) : 1;
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
    this.draw(cam);
  }

  updateZombie(e, dt, d, px, pz, peye, P) {
    const g = this.game, T = e.T;
    e.stateT += dt;
    // growls
    e.nextGrowl -= dt;
    if (e.nextGrowl <= 0 && d < 45) {
      g.audio.play(e.state === 'CHASE' && e.type === 'runner' ? 'scream' : T.growl === 'scream' ? 'growl' : T.growl, { pos: [e.pos.x, e.pos.y + 1.6, e.pos.z], vol: e.state === 'CHASE' ? 0.9 : 0.55, rate: e.type === 'brute' ? 0.8 : 1, ref: 2.5 });
      e.nextGrowl = (e.state === 'CHASE' ? 2.5 : 6) + Math.random() * 6;
    }
    // perception (throttled line of sight)
    e.losT -= dt;
    if (!P.dead && d < 40 && e.losT <= 0) {
      e.losT = 0.25 + Math.random() * 0.15;
      let sight = T.sight * (g.torchOn ? 1.6 : 1) * (P.crouched ? 0.6 : 1) * (g.playerLit ? 1.3 : 1);
      const hearing = P.noise * (e.type === 'runner' ? 1.4 : 1);
      const close = d < 2.5 || d < hearing;
      const facing = Math.abs(angleDiff(e.yaw, Math.atan2(px - e.pos.x, pz - e.pos.z))) < 1.5;
      e.sees = (close || (d < sight && (facing || d < sight * 0.4))) && this.canSee(e, px, peye, pz);
      if (e.sees) { e.lastSeen = { x: px, z: pz }; e.lostT = 0; if (e.state !== 'CHASE' && e.state !== 'ATTACK') { e.state = 'CHASE'; e.hold = false; if (e.zone || Math.random() < 0.35) this.alertZone(e); if (e.type === 'runner') g.audio.play('scream', { pos: [e.pos.x, e.pos.y + 1.6, e.pos.z], vol: 0.9 }); } }
    }
    if (e.stagger > 0) { this.move(e, 0, 0, 0, dt); return; }
    const speedK = e.speedK * (1 - e.limp * 0.5);
    switch (e.state) {
      case 'IDLE': {
        if (e.stateT > 3 + Math.random() * 4) { e.stateT = 0; e.wanderYaw += (Math.random() - 0.5) * 2.5; e.idleWalk = Math.random() < 0.6; }
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
        if (!e.sees) { e.lostT = (e.lostT || 0) + dt; if (e.lostT > 8) { e.state = 'ALERT'; e.investigate = e.lastSeen; e.stateT = 0; } }
        const dy = Math.abs(P.pos.y - e.pos.y);
        if (d < T.reach && dy < 1.3) { e.state = 'ATTACK'; e.attackT = T.wind; break; }
        // player upstairs in a building: head for its stairs
        let tx = e.lastSeen ? e.lastSeen.x : px, tz = e.lastSeen ? e.lastSeen.z : pz;
        let flow = e.sees || d < 25;
        if (dy > 1.6 && d < 14) { const s = g.stairFor(e, P); if (s) { tx = s[0]; tz = s[1]; flow = false; } }
        this.goTo(e, tx, tz, T.chase * speedK, dt, flow && P.pos.y < 1.2 && !e.tunnel);
        break;
      }
      case 'ATTACK': {
        this.move(e, 0, 0, 0, dt);
        e.yaw += angleDiff(e.yaw, Math.atan2(px - e.pos.x, pz - e.pos.z)) * Math.min(1, dt * 8);
        e.attackT -= dt;
        if (e.attackT <= 0) {
          if (d < T.reach + 0.35 && Math.abs(P.pos.y - e.pos.y) < 1.4 && !P.dead) {
            g.hurtPlayer(T.dmg * (0.85 + Math.random() * 0.3), e);
            g.audio.play('flesh', { pos: [px, P.pos.y + 1.2, pz], vol: 0.8 });
          } else g.audio.play('whoosh', { pos: [e.pos.x, e.pos.y + 1.2, e.pos.z], vol: 0.4 });
          e.state = 'CHASE'; e.recover = 0.4;
        }
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
  }

  updateHuman(e, dt, d, px, pz, peye, P) {
    const g = this.game, T = e.T;
    e.stateT += dt; e.coolT -= dt;
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
        const ax = e.pos.x - px, az = e.pos.z - pz, l = Math.hypot(ax, az) || 1;
        this.goTo(e, e.pos.x + ax / l * 10, e.pos.z + az / l * 10, T.chase * 1.1, dt, false);
        if (e.stateT > 9 || d > 45) { e.state = 'SEARCH'; e.stateT = 0; e.alert = 0; }
        break;
      }
      default: e.state = e.route ? 'PATROL' : 'WAIT';
    }
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
    const counts = { head: 0, chest: 0, pelvis: 0, ua: 0, fa: 0, th: 0, sn: 0, gun: 0 };
    const c = this._c;
    const put = (key, node, col) => {
      const i = counts[key]++;
      im[key].setMatrixAt(i, node.matrixWorld);
      im[key].setColorAt(i, c.set(col));
    };
    const cx = cam.position.x, cz = cam.position.z;
    for (const e of this.list) {
      const far = Math.hypot(e.pos.x - cx, e.pos.z - cz);
      if (far > 105) { e.hs.length = 0; continue; }
      this.pose(e);
      R.root.updateMatrixWorld(true);
      const col = e.colors;
      put('head', R.head, col.skin); put('chest', R.chest, col.top); put('pelvis', R.pelvis, col.legs);
      for (let i = 0; i < 2; i++) {
        put('ua', R.ua[i], e.human ? col.top : col.skin); put('fa', R.fa[i], col.skin);
        put('th', R.th[i], col.legs); put('sn', R.sn[i], e.human ? 0x1a1a1a : col.legs);
      }
      if (e.human) put('gun', R.gun, e.thief ? 0xc4c8d0 : 0x1c1c1e);
      // hit spheres
      if (!e.dead) {
        const hs = e.hs; hs.length = 0;
        const v = this._v;
        const add = (node, r, part) => { v.setFromMatrixPosition(node.matrixWorld); hs.push([v.x, v.y, v.z, r * e.scale, part]); };
        add(R.head, 0.15, 'head'); add(R.chest, 0.26, 'body'); add(R.pelvis, 0.22, 'body');
        add(R.th[0], 0.12, 'leg'); add(R.th[1], 0.12, 'leg'); add(R.sn[0], 0.11, 'leg'); add(R.sn[1], 0.11, 'leg');
        add(R.ua[0], 0.09, 'arm'); add(R.ua[1], 0.09, 'arm');
        v.setFromMatrixPosition(R.head.matrixWorld); e.headPos = [v.x, v.y, v.z];
      }
    }
    for (const k in im) {
      im[k].count = counts[k];
      im[k].instanceMatrix.needsUpdate = true;
      if (im[k].instanceColor) im[k].instanceColor.needsUpdate = true;
    }
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
      const reach = e.state === 'CHASE' || e.state === 'ATTACK' ? 1 : 0.55;
      for (let i = 0; i < 2; i++) {
        const s = i ? 1 : -1;
        R.sh[i].rotation.set(-1.35 * reach + Math.sin(e.t * 2 + i) * 0.12 + legA * 0.2 * s, 0, s * 0.12);
        R.el[i].rotation.set(-0.25 - Math.sin(e.t * 1.7 + i * 2) * 0.15, 0, 0);
      }
      R.spine.rotation.set(0.18 + (e.type === 'runner' ? 0.25 * run : 0) - fl * 0.5, Math.sin(ph) * 0.12, Math.sin(e.t * 0.7) * 0.08 + e.limp * 0.15);
      R.neck.rotation.set(0.15 + Math.sin(e.t * 1.3) * 0.12, Math.sin(e.t * 0.5) * 0.3, Math.sin(e.t * 0.9) * 0.25);
      if (e.state === 'ATTACK') {
        const k = 1 - Math.max(0, e.attackT) / e.T.wind;
        for (let i = 0; i < 2; i++) R.sh[i].rotation.x = -1.2 - Math.sin(k * Math.PI) * 0.9;
        R.spine.rotation.x = 0.1 + Math.sin(k * Math.PI) * 0.35;
      }
      if (e.state === 'BANG') { const k = Math.sin(e.t * 6); for (let i = 0; i < 2; i++) R.sh[i].rotation.x = -1.9 - k * 0.5; }
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
      }
      if (e.state === 'COVER' && e.stateT > 0.5) { R.body.position.y = -0.35; R.hip[0].rotation.x = -1.2; R.hip[1].rotation.x = -0.2; R.kn[0].rotation.x = 1.6; R.kn[1].rotation.x = 1.4; }
      if (!aiming && !e.thief) { R.sh[0].rotation.x += legA * 0.4; }
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
