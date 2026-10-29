// THE CREW — four fighters hiding in the houses of Jais. Each run they sit waiting in four different
// houses: one of them (any of the four) always in the Hunter's Rest, the castle-door house across the lane from
// the start, the others picked at random near the start. Walk in and press USE and they join you, follow you and
// fight the dead beside you. USE again: "hold here" / "follow me". If one goes down, USE revives them.
//
//   models/viking.glb    Ragnar, the viking: a bearded axe-man with a round shield. Slow, heavy chops that
//                        cleave through several zombies and knock them back. The most health.
//   models/samurai.glb   Hanzo, the masked ninja: a fast katana. Quick double-slashes.
//   models/soldier.glb   Sergeant Mark: full tactical gear and an assault rifle, three-round bursts at range.
//   models/tactical.glb  Ghost, the red-visor operative: a pump shotgun, brutal up close.
//
// The viking and the ninja came as statues (no skeleton): they were given one offline (a hand-placed
// humanoid skeleton and envelope weights), so all four are posed the same way here, in code: every limb
// is aimed at a direction in the character's own frame (+Y up, +Z forward, +X their left).
import * as THREE from 'three';
import { lambertize } from './models.js';
import { angleDiff, clamp } from './util.js';

export const CREW = {
  viking: {
    file: 'models/viking.glb', hi: 'रैग्नर', en: 'Ragnar the Viking', tag: 'RAGNAR', height: 0, hp: 240, speed: 4.4, col: '#e8a64a',
    melee: { dmg: 95, reach: 2.05, wind: 0.42, cool: 1.15, arc: 1.3, hits: 3, kb: 1.2, style: 'chop' },
    line: ['रैग्नर आपके साथ है', 'Ragnar: "Finally, a living soul. Point me at the dead."'],
  },
  samurai: {
    file: 'models/samurai.glb', hi: 'हांज़ो', en: 'Hanzo the Ninja', tag: 'HANZO', height: 0, hp: 160, speed: 5.3, col: '#e05050',
    melee: { dmg: 52, reach: 2.15, wind: 0.16, cool: 0.5, arc: 1.6, hits: 2, kb: 0.4, style: 'slash' },
    line: ['हांज़ो आपके साथ है', 'Hanzo: "My blade is yours. Stay close."'],
  },
  soldier: {
    file: 'models/soldier.glb', hi: 'सार्जेंट मार्क', en: 'Sergeant Mark', tag: 'MARK', height: 1.8, hp: 180, speed: 4.8, col: '#9ad070',
    gun: { kind: 'rifle', sound: 'rifle', dmg: 24, pellets: 1, burst: 3, rate: 0.1, rest: 0.85, range: 30, acc: 0.78, mag: 30, reload: 2.2 },
    line: ['सार्जेंट मार्क आपके साथ है', 'Sgt. Mark: "Copy that. I\'ve got your six."'],
  },
  tactical: {
    file: 'models/tactical.glb', hi: 'घोस्ट', en: 'Ghost', tag: 'GHOST', height: 1.84, hp: 150, speed: 5.0, col: '#6ac8f0',
    gun: { kind: 'shotgun', sound: 'shotgun', dmg: 17, pellets: 6, burst: 1, rate: 0.9, rest: 0, range: 14, acc: 0.8, mag: 6, reload: 2.6 },
    line: ['घोस्ट आपके साथ है', 'Ghost: "Shotgun\'s loaded. Let\'s move."'],
  },
};
const ORDER = ['viking', 'samurai', 'soldier', 'tactical'];
// where they stand around you while following (your frame: +x your right, -z behind you)
const SLOTS = [[-1.5, -1.8], [1.5, -1.8], [-2.4, -3.3], [2.4, -3.3]];
// houses a fighter may hide in (homes and small shops, never the stations or the police post)
const HOMES = ['gupta', 'haveli', 'narrow1', 'three', 'eastHouse', 'narrow2', 'stnHouse', 'abandoned1', 'e2house', 'dhaba', 'mainShop'];
// the same limbs under the names each rig uses (Mixamo, Character Creator, and the two rigs made for the statues)
const BONES = {
  hips: ['Hips', 'CC_Base_Hip'], spine: ['Spine', 'CC_Base_Waist'], chest: ['Spine2', 'CC_Base_Spine02'], head: ['Head', 'CC_Base_Head'],
  uaL: ['LeftArm', 'CC_Base_L_Upperarm'], faL: ['LeftForeArm', 'CC_Base_L_Forearm'], handL: ['LeftHand', 'CC_Base_L_Hand'],
  uaR: ['RightArm', 'CC_Base_R_Upperarm'], faR: ['RightForeArm', 'CC_Base_R_Forearm'], handR: ['RightHand', 'CC_Base_R_Hand'],
  thL: ['LeftUpLeg', 'CC_Base_L_Thigh'], shL: ['LeftLeg', 'CC_Base_L_Calf'], ftL: ['LeftFoot', 'CC_Base_L_Foot'],
  thR: ['RightUpLeg', 'CC_Base_R_Thigh'], shR: ['RightLeg', 'CC_Base_R_Calf'], ftR: ['RightFoot', 'CC_Base_R_Foot'],
};
const CHILD = { uaL: 'faL', faL: 'handL', uaR: 'faR', faR: 'handR', thL: 'shL', shL: 'ftL', thR: 'shR', shR: 'ftR' };
const clean = (n) => n.replace(/^mixamorig:?/, '').replace(/_\d+$/, '');

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _pw = new THREE.Quaternion(), _bw = new THREE.Quaternion();
const _e = new THREE.Euler(), _ri = new THREE.Quaternion(), _m = new THREE.Vector3();

// a rifle and a pump shotgun, built from boxes (grip at the origin, barrel along +Z)
function gunMesh(kind) {
  const g = new THREE.Group();
  const black = new THREE.MeshLambertMaterial({ color: 0x232427 }), wood = new THREE.MeshLambertMaterial({ color: 0x6a4428 }), olive = new THREE.MeshLambertMaterial({ color: 0x3e4430 });
  const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); };
  if (kind === 'rifle') {
    box(0.055, 0.09, 0.42, black, 0, 0.06, 0.12); box(0.03, 0.03, 0.34, black, 0, 0.08, 0.5); box(0.04, 0.16, 0.06, black, 0, -0.04, 0.16);
    box(0.045, 0.1, 0.06, black, 0, -0.03, 0.0); box(0.05, 0.09, 0.26, olive, 0, 0.04, -0.2); box(0.03, 0.04, 0.12, black, 0, 0.13, 0.12);
  } else {
    box(0.05, 0.07, 0.36, black, 0, 0.06, 0.12); box(0.035, 0.035, 0.42, black, 0, 0.07, 0.5); box(0.045, 0.045, 0.24, wood, 0, 0.03, 0.42);
    box(0.045, 0.1, 0.06, wood, 0, -0.03, 0.0); box(0.05, 0.1, 0.26, wood, 0, 0.03, -0.2);
  }
  return g;
}

export class Companions {
  constructor(game) {
    this.g = game;
    this.list = ORDER.map((k) => ({ key: k, S: CREW[k], I: null, state: 'wait', hp: CREW[k].hp, maxHp: CREW[k].hp, pos: { x: 0, y: 0, z: 0 }, st: { vy: 0, peak: 0, fall: 0 }, yaw: 0, vel: { x: 0, z: 0 } }));
    this.houses = new Set();
    this.hintT = 0;
    this.tags = document.getElementById('crewTags');
    this.panel = document.getElementById('crew');
    for (const c of this.list) {
      const t = document.createElement('div'); t.className = 'ctag'; t.innerHTML = `<b>${c.S.tag}</b><i><u></u></i>`; t.style.setProperty('--c', c.S.col);
      this.tags && this.tags.appendChild(t); c.tagEl = t; c.tagBar = t.querySelector('u');
      const p = document.createElement('div'); p.className = 'cmem'; p.innerHTML = `<b>${c.S.tag}</b><i><u></u></i><s></s>`; p.style.setProperty('--c', c.S.col);
      this.panel && this.panel.appendChild(p); c.panEl = p; c.panBar = p.querySelector('u'); c.panState = p.querySelector('s');
    }
  }
  ready(k) { return !!this.list.find((c) => c.key === k).I; }

  // ================= a model arrived =================
  add(key, gltf) {
    const g = this.g, c = this.list.find((x) => x.key === key);
    const scene = lambertize(gltf.scene, false, 0.12);
    scene.traverse((o) => { if (o.isSkinnedMesh) o.frustumCulled = false; if (o.isMesh && o.material) for (const m of [].concat(o.material)) m.side = THREE.DoubleSide; });
    const holder = new THREE.Group(), root = new THREE.Group();
    holder.add(scene); root.add(holder);
    // stand it on the ground at its height (the statues were already made man-sized)
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene, true);
    const s = c.S.height ? c.S.height / (box.max.y - box.min.y) : 1;
    holder.scale.setScalar(s); holder.position.y = -box.min.y * s;
    root.updateMatrixWorld(true);
    const B = {}, byName = {};
    scene.traverse((o) => { if (o.isBone) byName[clean(o.name)] = o; });
    for (const k in BONES) for (const n of BONES[k]) if (byName[n]) { B[k] = byName[n]; break; }
    const rest = new Map(); scene.traverse((o) => { if (o.isBone) rest.set(o, o.quaternion.clone()); });
    const hipY = B.hips.getWorldPosition(_a).y;
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.46, 0.5), new THREE.MeshLambertMaterial({ map: g.tex.wood, color: 0x8a6a48 }));
    crate.position.y = 0.23; crate.visible = false;
    g.scene.add(crate);
    const gun = c.S.gun ? gunMesh(c.S.gun.kind) : null;
    if (gun) { gun.visible = false; g.scene.add(gun); }
    root.visible = false; root.rotation.order = 'YXZ';
    g.scene.add(root);
    c.I = { root, holder, baseY: holder.position.y, B, rest, hipY, crate, gun, ph: 0 };
    if (c.home) this._seat(c);
  }

  // ================= per run =================
  reset(r) {
    const g = this.g, W = g.W, sp = W.special.start.F.world(0, 0, 0);
    this.houses.clear();
    // four different houses, picked among the eight nearest the start so the crew can be found early
    const near = W.enterables.filter((b) => HOMES.includes(b.name))
      .map((b) => ({ b, d: Math.hypot(b.F.world(0, 0, b.d / 2)[0] - sp[0], b.F.world(0, 0, b.d / 2)[2] - sp[2]) }))
      .sort((a, b) => a.d - b.d).slice(0, 8).map((x) => x.b);
    const picks = r.shuffle(near.slice()).slice(0, 4);
    // one of the four always waits in the Hunter's Rest (which of them changes from run to run)
    const hr = W.special.hunters;
    if (hr) { picks.length = Math.min(picks.length, 3); picks.splice(r.int(0, picks.length), 0, hr); }
    this.list.forEach((c, i) => {
      c.state = 'wait'; c.hp = c.maxHp; c.home = picks[i % picks.length]; c.target = null; c.atkT = 0; c.cool = 0; c.ride = false; c.downT = 0; c.hurtAt = -99;
      c.ammo = c.S.gun ? c.S.gun.mag : 0; c.reloadT = 0; c.burstLeft = 0; c.stuckT = 0; c.sideT = 0; c.seen = false; c.kills = 0;
      this.houses.add(c.home.name);
      this._seatSpot(c, r);
      if (c.I) this._seat(c);
    });
    this.hintT = 7;
  }
  // a free spot at the back of the house's ground floor, facing the door
  _seatSpot(c, r) {
    const b = c.home, nav = this.g.townNav;
    let spot = null;
    // a house with its own seats (the Hunter's Rest: on the hall floor, facing the way in)
    if (b.seats) {
      for (const p of r.shuffle(b.seats.slice())) if (nav.free(p[0], p[2]) && nav.free(p[0], p[2] + 0.6) && nav.free(p[0] + 0.6, p[2]) && nav.free(p[0] - 0.6, p[2])) { spot = [p[0], p[2]]; break; }
      if (spot) { c.seat = { x: spot[0], z: spot[1], yaw: b.F.yaw + Math.PI }; return; }
    }
    for (let k = 0; k < 30 && !spot; k++) {
      const lx = (r() - 0.5) * Math.max(0.5, b.w - 2.4), lz = b.d * (0.55 + r() * 0.25);
      const [x, , z] = b.F.world(lx, 0, lz);
      if (nav.free(x, z) && nav.free(x, z + 0.6) && nav.free(x + 0.6, z) && nav.free(x - 0.6, z)) spot = [x, z];
    }
    if (!spot) { const [x, , z] = b.F.world(0, 0, b.d * 0.6); spot = [x, z]; }
    c.seat = { x: spot[0], z: spot[1], yaw: b.F.yaw + Math.PI };
  }
  _seat(c) {
    c.pos.x = c.seat.x; c.pos.z = c.seat.z; c.pos.y = 0; c.yaw = c.seat.yaw; c.st.vy = 0; c.st.fall = 0;
    const I = c.I; I.crate.position.set(c.seat.x - Math.sin(c.yaw) * 0.06, 0.23, c.seat.z - Math.cos(c.yaw) * 0.06); I.crate.rotation.y = c.yaw;
  }

  get joined() { return this.list.filter((c) => c.I && (c.state === 'follow' || c.state === 'hold' || c.state === 'down')); }

  // ================= USE =================
  consider(fn) {
    for (const c of this.list) {
      if (!c.I || c.ride) continue;
      const h = this._headPos(c);
      if (c.state === 'wait') fn([h.x, h.y - 0.3, h.z], 2.8, { type: 'crew', c });
      else if (c.state === 'down') fn([c.pos.x, c.pos.y + 0.4, c.pos.z], 2.4, { type: 'crew', c });
      else fn([h.x, h.y - 0.4, h.z], 2.0, { type: 'crew', c });
    }
  }
  prompt(t) {
    const c = t.c;
    if (c.state === 'wait') return ['RECRUIT', `${c.S.hi} · ${c.S.en} · साथ लें`];
    if (c.state === 'down') return ['REVIVE', `${c.S.hi} घायल है · ${c.S.en} is down`];
    if (c.state === 'hold') return ['FOLLOW', `${c.S.hi} · follow me`];
    return ['HOLD', `${c.S.hi} · hold this spot`];
  }
  use(t) {
    const g = this.g, c = t.c;
    if (c.state === 'wait') {
      c.state = 'follow'; c.I.crate.visible = true;            // the crate stays where he sat
      g.audio.play('clank', { vol: 0.5 });
      g.toast(c.S.line[0], c.S.line[1]);
      g.feed('+ ' + c.S.en);
    } else if (c.state === 'down') {
      c.state = 'follow'; c.hp = Math.round(c.maxHp * 0.5); c.hurtAt = g.time;
      g.audio.play('gulp', { vol: 0.5 }); g.feed(`${c.S.en} is back up`);
    } else if (c.state === 'hold') { c.state = 'follow'; g.feed(`${c.S.tag}: following`); g.audio.play('click', { vol: 0.4 }); }
    else { c.state = 'hold'; c.holdAt = { x: c.pos.x, y: c.pos.y, z: c.pos.z }; g.feed(`${c.S.tag}: holding here`); g.audio.play('click', { vol: 0.4 }); }
  }

  // ================= the zombies' side =================
  // a crew member within a zombie's reach (and closer to it than you are)
  victim(e, reach, dPlayer) {
    let best = null, bd = Math.min(reach + 0.25, dPlayer);
    for (const c of this.list) {
      if (!c.I || c.ride || (c.state !== 'follow' && c.state !== 'hold') || Math.abs(c.pos.y - e.pos.y) > 1.3) continue;
      const d = Math.hypot(c.pos.x - e.pos.x, c.pos.z - e.pos.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  // someone for a zombie that can't see you to go after
  prey(e, maxD) {
    let best = null, bd = maxD;
    for (const c of this.list) {
      if (!c.I || c.ride || (c.state !== 'follow' && c.state !== 'hold') || Math.abs(c.pos.y - e.pos.y) > 1.5) continue;
      const d = Math.hypot(c.pos.x - e.pos.x, c.pos.z - e.pos.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best ? [best, bd] : null;
  }
  hurt(c, dmg) {
    const g = this.g;
    if (c.state !== 'follow' && c.state !== 'hold') return;
    c.hp -= dmg * 0.8; c.hurtAt = g.time; c.flinch = 1;
    g.fx.burst([c.pos.x, c.pos.y + 1.3, c.pos.z], [0, 0.3, 0], 6, [0.4, 0.04, 0.03], 1.8, 0.5);
    if (c.hp <= 0) {
      c.hp = 0; c.state = 'down'; c.downT = 0; c.target = null;
      g.toast(`${c.S.hi} गिर गया!`, `${c.S.en} is down — get to him and press USE to revive.`);
      g.audio.play('growl', { pos: [c.pos.x, c.pos.y + 1, c.pos.z], vol: 0.4, rate: 0.6 });
    }
  }
  // a crew member's dead weight for e.prey checks in enemies.js
  isDown(c) { return c.state !== 'follow' && c.state !== 'hold'; }

  // everything the crew can pick a fight with: the zombies and thieves, plus MAW and the Joker once they are up and fighting
  _targets() {
    const g = this.g, out = g.enemies.list.slice(), B = g.boss, J = g.joker;
    if (B && B.solid() && B.state !== 'DOOMED') out.push(B);
    if (J && J.solid() && !J.dead) out.push(J);
    if (g.giants) for (const f of g.giants.foes()) if (f.solid()) out.push(f);
    return out;
  }
  // hit a target with the right damage call: the two big ones take hits on their own methods
  _hit(T, dmg, part, dir) {
    const g = this.g;
    if (T === g.boss || T === g.joker || (g.giants && (T === g.giants.warrior || T === g.giants.worm))) return T.damage(dmg, part, dir, 'crew');
    return g.enemies.damage(T, dmg, part, dir, 'crew');
  }

  // ================= every frame =================
  update(dt) {
    const g = this.g, P = g.player;
    if (this.hintT > 0 && g.state === 'play') {
      this.hintT -= dt;
      if (this.hintT <= 0) g.toast('चार लड़ाके घरों में छिपे हैं', 'Four fighters are hiding in houses around Jais — find them and press USE to team up.');
    }
    const driving = !!g.vehicles.driving;
    for (const c of this.list) {
      const I = c.I; if (!I) continue;
      const d = Math.hypot(c.pos.x - P.pos.x, c.pos.z - P.pos.z);
      c.dist = d;
      if (c.state === 'wait') {
        I.crate.visible = d < 60;
        if (d > 60) { I.root.visible = false; continue; }
        if (d < 25) c.seen = true;
        this._pose(c, dt, 'sit');
        continue;
      }
      // riding along in the car: out of sight, they get out wherever you do
      if (driving) { c.ride = true; I.root.visible = false; if (I.gun) I.gun.visible = false; c.pos.x = P.pos.x; c.pos.z = P.pos.z; c.pos.y = P.pos.y; continue; }
      if (c.ride) { c.ride = false; this._teleport(c); }
      c.cool = Math.max(0, c.cool - dt); c.flinch = Math.max(0, (c.flinch || 0) - dt * 3);
      if (c.state === 'down') {
        c.downT += dt;
        if (c.downT > 45) { c.state = 'follow'; c.hp = Math.round(c.maxHp * 0.25); g.feed(`${c.S.en} got back up`); }
        this._pose(c, dt, 'down'); continue;
      }
      // healing slowly once out of the fight
      if (g.time - c.hurtAt > 8) c.hp = Math.min(c.maxHp, c.hp + dt * 3);
      // far behind (a road trip, a tunnel, the Playground): catch up
      if (d > 45 || Math.abs(c.pos.y - P.pos.y) > 6 || (c.stuckT > 4 && d > 10)) this._teleport(c);
      this._think(c, dt, d);
    }
    this._ui();
  }

  // your facing (forward) and right, from your yaw
  _frame() { const y = this.g.player.yaw, fx = -Math.sin(y), fz = -Math.cos(y); return [fx, fz, -fz, fx]; }
  _slot(c, k = 1) { const P = this.g.player.pos, s = SLOTS[this.list.indexOf(c)], [fx, fz, rx, rz] = this._frame(); return [P.x + (rx * s[0] + fx * s[1]) * k, P.z + (rz * s[0] + fz * s[1]) * k]; }
  _teleport(c) {
    const g = this.g, P = g.player;
    // his slot behind you, else anywhere around you that is open floor (never inside you)
    const tries = [1, 0.6].map((k) => this._slot(c, k));
    // behind you first, then to the sides, in front last (your back is at angle yaw)
    for (const r of [1.7, 1.1]) for (const k of [0, 1, -1, 2, -2, 3, -3, 4]) { const a = P.yaw + k * 0.6 + (this.list.indexOf(c) - 1.5) * 0.25; tries.push([P.pos.x + Math.sin(a) * r, P.pos.z + Math.cos(a) * r]); }
    const ok = tries.find(([x, z]) => g.nav.free(x, z) && !this._wall(P.pos, x, z)) || tries[tries.length - 1];
    c.pos.x = ok[0]; c.pos.z = ok[1];
    c.pos.y = P.pos.y; c.st.vy = 0; c.st.fall = 0; c.stuckT = 0; c.yaw = P.yaw + Math.PI; c.target = null;
    if (c.state === 'hold') c.state = 'follow';
  }

  _wall(p, x, z) { const dx = x - p.x, dz = z - p.z, l = Math.hypot(dx, dz) || 1; return !!this.g.physics.raycast(p.x, p.y + 1, p.z, dx / l, 0, dz / l, l + 0.3); }

  // ---------- the mind ----------
  _think(c, dt, d) {
    const g = this.g, P = g.player, E = g.enemies;
    // pick a fight (re-checked a few times a second)
    c.scanT = (c.scanT || 0) - dt;
    if (c.scanT <= 0) {
      c.scanT = 0.25 + Math.random() * 0.1;
      const anchor = c.state === 'hold' ? c.holdAt : P.pos;
      const range = c.S.gun ? c.S.gun.range : 11;
      let best = null, bs = 1e9;
      for (const e of this._targets()) {
        if (e.dead || (e.human && !['ATTACK', 'CHASE', 'DETECT', 'COVER', 'RETREAT', 'FLEE'].includes(e.state))) continue;
        if (Math.abs(e.pos.y - c.pos.y) > 2.2) continue;
        const de = Math.hypot(e.pos.x - c.pos.x, e.pos.z - c.pos.z);
        if (de > range || Math.hypot(e.pos.x - anchor.x, e.pos.z - anchor.z) > range + 6) continue;
        const score = de - (e.state === 'ATTACK' || e.state === 'CHASE' ? 4 : 0);
        if (score < bs && this._los(c, e)) { bs = score; best = e; }
      }
      c.target = best;
    }
    const T = c.target && !c.target.dead ? c.target : null;
    let speed = 0, tx = null, tz = null, run = false;
    if (T) {
      const de = Math.hypot(T.pos.x - c.pos.x, T.pos.z - c.pos.z);
      const face = Math.atan2(T.pos.x - c.pos.x, T.pos.z - c.pos.z);
      if (c.S.melee) {
        if (de > c.S.melee.reach * 0.85 && !(c.atkT > 0)) { tx = T.pos.x; tz = T.pos.z; run = true; }
        else { c.yaw += angleDiff(c.yaw, face) * Math.min(1, dt * 10); if (!(c.atkT > 0) && c.cool <= 0) { c.atkT = c.S.melee.wind + 0.35; c.struck = false; } }
      } else {
        c.yaw += angleDiff(c.yaw, face) * Math.min(1, dt * 10);
        if (Math.abs(angleDiff(c.yaw, face)) < 0.35) this._shoot(c, T, de, dt);
        if (de > c.S.gun.range * 0.8) { tx = T.pos.x; tz = T.pos.z; }
      }
    } else {
      c.burstLeft = 0;
      if (c.state === 'hold') { if (Math.hypot(c.holdAt.x - c.pos.x, c.holdAt.z - c.pos.z) > 0.8) { tx = c.holdAt.x; tz = c.holdAt.z; } }
      else {
        const [sx, sz] = this._slot(c);
        const ds = Math.hypot(sx - c.pos.x, sz - c.pos.z);
        // indoors they stand quietly, turned to face you, until a zombie shows up
        if (g.inside) c.yaw += angleDiff(c.yaw, P.yaw + Math.PI) * Math.min(1, dt * 2);
        else if (ds > 1.0) { tx = sx; tz = sz; run = ds > 5; }
        else c.yaw += angleDiff(c.yaw, P.yaw + Math.PI) * Math.min(1, dt * 2);
      }
    }
    // the swing lands at the end of the wind-up
    if (c.atkT > 0) {
      c.atkT -= dt;
      if (!c.struck && c.atkT <= 0.35) { c.struck = true; this._strike(c); c.cool = c.S.melee.cool; }
    }
    if (tx !== null) {
      speed = c.S.speed * (run ? 1 : 0.55);
      this._move(c, tx, tz, speed, dt, d > 8 && !T && c.state === 'follow');
    } else this._move(c, c.pos.x, c.pos.z, 0, dt, false);
    this._pose(c, dt, T ? 'fight' : 'stand');
  }

  _los(c, e) {
    const ox = c.pos.x, oy = c.pos.y + 1.4, oz = c.pos.z, tx = e.pos.x - ox, ty = e.pos.y + 1.2 - oy, tz = e.pos.z - oz, l = Math.hypot(tx, ty, tz);
    if (l < 0.5) return true;
    return !this.g.physics.raycast(ox, oy, oz, tx / l, ty / l, tz / l, l - 0.4);
  }

  _move(c, tx, tz, speed, dt, flow) {
    const g = this.g, P = g.player;
    let dx = tx - c.pos.x, dz = tz - c.pos.z;
    if (flow) { const f = g.nav.flow(c.pos.x, c.pos.z); if (f && f[2] > 3) { dx = f[0]; dz = f[1]; } }
    // you are upstairs: take the stairs
    if (P.pos.y - c.pos.y > 1.6 && c.dist < 14) { const s = g.stairFor(c, P); if (s) { dx = s[0] - c.pos.x; dz = s[1] - c.pos.z; } }
    const l = Math.hypot(dx, dz); if (l > 1e-3) { dx /= l; dz /= l; }
    if (c.sideT > 0) { c.sideT -= dt; const ox = dx; dx = dx * 0.3 - dz * c.side; dz = dz * 0.3 + ox * c.side; }
    // keep a little room from you and from each other
    for (const o of [P, ...this.list]) {
      if (o === c || (o.I && (o.state === 'wait' || o.ride))) continue;
      const ox = c.pos.x - o.pos.x, oz = c.pos.z - o.pos.z, d2 = ox * ox + oz * oz;
      if (d2 < 1.1 && d2 > 1e-4) { const dd = Math.sqrt(d2); dx += ox / dd * (1.05 - dd) * 1.6; dz += oz / dd * (1.05 - dd) * 1.6; }
    }
    const k = 1 - Math.exp(-dt * 8);
    c.vel.x += (dx * speed - c.vel.x) * k; c.vel.z += (dz * speed - c.vel.z) * k;
    const ox = c.pos.x, oz = c.pos.z;
    g.physics.moveCharacter(c.pos, c.vel.x * dt, c.vel.z * dt, c.st.vy, dt, 0.3, 1.75, 0.45, c.st);
    const moved = Math.hypot(c.pos.x - ox, c.pos.z - oz), want = Math.hypot(c.vel.x, c.vel.z) * dt;
    if (want > 0.005) {
      if (moved < want * 0.3) c.stuckT += dt; else c.stuckT = Math.max(0, c.stuckT - dt * 2);
      if (c.stuckT > 0.8 && !(c.sideT > 0)) { c.sideT = 0.7; c.side = Math.random() < 0.5 ? -1 : 1; }
      if (!c.target || c.S.melee) c.yaw += angleDiff(c.yaw, Math.atan2(c.vel.x, c.vel.z)) * Math.min(1, dt * 8);
    } else c.stuckT = 0;
    c.moveSpeed = moved / Math.max(dt, 1e-4);
  }

  // ---------- melee: one swing hits everything in the arc in front ----------
  _strike(c) {
    const g = this.g, M = c.S.melee;
    let n = 0;
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    const hits = this._targets().filter((e) => !e.dead && Math.abs(e.pos.y - c.pos.y) < 1.4)
      .map((e) => [e, Math.hypot(e.pos.x - c.pos.x, e.pos.z - c.pos.z)]).filter(([e, d]) => d < M.reach + 0.3 && Math.abs(angleDiff(c.yaw, Math.atan2(e.pos.x - c.pos.x, e.pos.z - c.pos.z))) < M.arc / 2 + (d < 0.9 ? 1 : 0))
      .sort((a, b) => a[1] - b[1]);
    for (const [e] of hits) {
      if (n++ >= M.hits) break;
      const dir = { x: fx, z: fz }, head = Math.random() < 0.25;
      const killed = this._hit(e, M.dmg * (0.9 + Math.random() * 0.2), head ? 'head' : 'body', dir);
      g.fx.burst([e.pos.x, e.pos.y + 1.3, e.pos.z], [fx * 0.6, 0.3, fz * 0.6], head ? 14 : 9, [0.45, 0.03, 0.02], 2.4, 0.6);
      g.audio.play('flesh', { pos: [e.pos.x, e.pos.y + 1.3, e.pos.z], vol: 0.85 });
      if (!killed) {
        const big = e === g.boss || e === g.joker;
        if (!big) { e.stagger = Math.max(e.stagger || 0, M.kb > 1 ? 0.7 : 0.3); }
        if (!big && e.type !== 'brute' && e.type !== 'ghoul') g.physics.moveCharacter(e.pos, fx * M.kb * 0.5, fz * M.kb * 0.5, 0, 0.016, 0.3, 1.7, 0.45, e.st);
        this._provoke(e, c);
      } else c.kills++;
    }
    g.audio.play('whoosh', { pos: [c.pos.x, c.pos.y + 1.3, c.pos.z], vol: 0.6, rate: c.key === 'viking' ? 0.7 : 1.3 });
    g.noise(c.pos, 6, 'melee');
  }
  // a zombie hit by the crew turns on them (unless it is already after you)
  _provoke(e, c) {
    if (e.human || e.dead || e.state === 'CHASE' || e.state === 'ATTACK' || e === this.g.boss || e === this.g.joker) return;
    e.state = 'HUNT'; e.prey = c; e.stateT = 0; e.hold = false;
  }

  // ---------- guns ----------
  _shoot(c, T, de, dt) {
    const g = this.g, G = c.S.gun;
    if (c.reloadT > 0) { c.reloadT -= dt; if (c.reloadT <= 0) c.ammo = G.mag; return; }
    if (c.cool > 0) return;
    if (c.burstLeft <= 0) c.burstLeft = G.burst;
    c.burstLeft--; c.ammo--;
    c.cool = c.burstLeft > 0 ? G.rate : G.rate + G.rest * (0.8 + Math.random() * 0.4);
    if (c.ammo <= 0) { c.reloadT = G.reload; c.burstLeft = 0; g.audio.play('clank', { pos: [c.pos.x, c.pos.y + 1.2, c.pos.z], vol: 0.5 }); }
    const mz = this._muzzle(c);
    g.audio.play(G.sound, { pos: mz, vol: 0.9, far: 25, roll: 0.8, max: 300 });
    g.enemyMuzzle(mz); c.flash = 0.06;
    g.noise(c.pos, 40, 'gun');
    const ty = T.pos.y + (T.type === 'hound' ? 0.6 : 1.3);
    let dmg = 0, head = false;
    for (let k = 0; k < G.pellets; k++) {
      const acc = G.acc - de * (G.pellets > 1 ? 0.035 : 0.008);
      if (Math.random() < acc) { dmg += G.dmg; if (G.pellets === 1 && Math.random() < 0.22) head = true; }
    }
    if (dmg > 0) {
      const dir = { x: (T.pos.x - c.pos.x) / (de || 1), z: (T.pos.z - c.pos.z) / (de || 1) };
      const killed = this._hit(T, dmg, head ? 'head' : 'body', dir);
      g.fx.tracer(mz, [T.pos.x, ty, T.pos.z]);
      g.fx.burst([T.pos.x, ty, T.pos.z], [-dir.x * 0.4, 0.2, -dir.z * 0.4], head ? 12 : 7, [0.45, 0.02, 0.02], 2.2, 0.6);
      if (killed) { c.kills++; c.target = null; } else this._provoke(T, c);
    } else g.fx.tracer(mz, [T.pos.x + (Math.random() - 0.5) * 1.6, ty + (Math.random() - 0.3), T.pos.z + (Math.random() - 0.5) * 1.6]);
  }
  _muzzle(c) {
    const I = c.I;
    if (I.gun && I.gun.visible) { _a.set(0, 0.075, c.S.gun.kind === 'rifle' ? 0.7 : 0.74); I.gun.localToWorld(_a); return [_a.x, _a.y, _a.z]; }
    return [c.pos.x + Math.sin(c.yaw) * 0.6, c.pos.y + 1.4, c.pos.z + Math.cos(c.yaw) * 0.6];
  }

  _headPos(c) {
    const I = c.I;
    if (I.root.visible && I.B.head) { I.B.head.getWorldPosition(_m); return _m; }
    return _m.set(c.pos.x, c.pos.y + (c.state === 'wait' ? 1.25 : 1.65), c.pos.z);
  }

  // ================= posing =================
  // rotate a bone by a rotation given in the character's frame
  _rotW(b, qChar) {
    const root = b.__root;
    _ri.copy(root.quaternion);
    _q.copy(_ri).multiply(qChar).multiply(_ri.invert());          // char frame -> world
    b.parent.getWorldQuaternion(_pw);
    _bw.copy(_pw).multiply(b.quaternion).premultiply(_q);
    b.quaternion.copy(_pw.invert().multiply(_bw));
  }
  _rot(I, k, x, y, z) { const b = I.B[k]; if (!b) return; b.__root = I.root; this._rotW(b, _e.set(x, y, z) && new THREE.Quaternion().setFromEuler(_e)); }
  // point a limb (bone -> its child joint) along a direction in the character's frame
  _aim(I, k, x, y, z) {
    const b = I.B[k], ch = I.B[CHILD[k]]; if (!b || !ch) return;
    b.getWorldPosition(_a); ch.getWorldPosition(_b);
    _b.sub(_a).normalize();
    const t = new THREE.Vector3(x, y, z).normalize().applyQuaternion(I.root.quaternion);
    b.__root = I.root;
    // already a world rotation: apply it directly
    _q.setFromUnitVectors(_b, t);
    b.parent.getWorldQuaternion(_pw);
    _bw.copy(_pw).multiply(b.quaternion).premultiply(_q);
    b.quaternion.copy(_pw.invert().multiply(_bw));
  }

  _pose(c, dt, mode) {
    const I = c.I, S = c.S, root = I.root, g = this.g;
    root.visible = true;
    root.position.set(c.pos.x, c.pos.y, c.pos.z);
    root.rotation.set(0, c.yaw, 0);
    I.holder.position.y = I.baseY; I.holder.rotation.set(0, 0, 0);
    for (const [b, q] of I.rest) b.quaternion.copy(q);
    root.updateMatrixWorld(true);
    const sp = c.moveSpeed || 0, run = Math.min(1, sp / 4.5), walk = Math.min(1, sp / 1.2);
    I.ph += (sp * 2.3 + 0.0001) * dt;
    const ph = I.ph, t = g.time;
    const gun = I.gun;
    let gunMode = 'low';
    if (mode === 'sit') {
      I.holder.position.y = I.baseY - (I.hipY - 0.5);
      this._rot(I, 'spine', 0.18 + Math.sin(t * 0.8) * 0.02, 0, 0);
      const look = c.dist < 7 ? clamp(angleDiff(c.yaw, Math.atan2(g.player.pos.x - c.pos.x, g.player.pos.z - c.pos.z)), -0.9, 0.9) : Math.sin(t * 0.3) * 0.3;
      this._rot(I, 'head', c.dist < 7 ? -0.15 : 0.15, look, 0);
      for (const s of [1, -1]) {
        const L = s > 0 ? 'L' : 'R';
        this._aim(I, 'th' + L, s * 0.12, -0.08, 1); this._aim(I, 'sh' + L, s * 0.05, -1, 0.12);
        if (!(c.key === 'viking' && s < 0)) { this._aim(I, 'ua' + L, s * 0.18, -0.85, 0.45); this._aim(I, 'fa' + L, -s * 0.15, -0.3, 1); }
      }
      gunMode = 'lap';
    } else if (mode === 'down') {
      I.holder.rotation.x = -1.45; I.holder.position.y = I.baseY + 0.15;
      for (const s of [1, -1]) { const L = s > 0 ? 'L' : 'R'; this._aim(I, 'ua' + L, s * 0.7, -0.2, -0.6); this._aim(I, 'th' + L, s * 0.15, -1, 0); }
      gunMode = 'ground';
    } else {
      // legs: a stride that grows into a run
      const A = (0.42 + run * 0.35) * walk;
      for (const s of [1, -1]) {
        const L = s > 0 ? 'L' : 'R', p = ph + (s > 0 ? 0 : Math.PI);
        const a = Math.sin(p) * A, k = Math.max(0, Math.sin(p + 1.3)) * (0.5 + run * 0.7) * walk + 0.05;
        this._aim(I, 'th' + L, s * 0.06, -Math.cos(a), Math.sin(a));
        this._aim(I, 'sh' + L, s * 0.04, -Math.cos(a - k), Math.sin(a - k));
      }
      I.holder.position.y = I.baseY - Math.abs(Math.sin(ph)) * 0.04 * walk - run * 0.04;
      this._rot(I, 'spine', run * 0.18 + (c.flinch || 0) * -0.3, 0, 0);
      const swing = Math.sin(ph) * 0.5 * walk;
      if (S.melee) {
        const atk = c.atkT > 0 ? clamp(1 - (c.atkT - 0.35) / S.melee.wind, 0, 1.5) : -1;   // 0..1 wind-up, 1..1.5 follow-through
        if (c.key === 'viking') {
          // the shield arm swings a little; the axe rides on his shoulder until he chops
          this._aim(I, 'uaL', 0.25, -1, 0.1 - swing * 0.4);
          if (atk >= 0) {
            if (atk < 1) { const k = atk; this._aim(I, 'uaR', -0.25, 0.3 + 0.6 * k, 0.6 - 0.3 * k); this._aim(I, 'faR', -0.05, 0.5 + 0.4 * k, -0.4 - 0.5 * k); this._rot(I, 'chest', -0.2 * k, 0.3 * k, 0); }
            else { const k = (atk - 1) * 2; this._aim(I, 'uaR', -0.1, 0.25 - 0.6 * k, 1); this._aim(I, 'faR', 0.05, -0.2 - 0.8 * k, 1); this._rot(I, 'chest', 0.35 * k, -0.25, 0); }
          }
        } else {
          this._aim(I, 'uaL', 0.2, -1, 0.05 - swing * 0.5); this._aim(I, 'faL', 0.05, -1, 0.3);
          if (atk < 0) { this._aim(I, 'uaR', -0.28, -1, 0.15 + (mode === 'fight' ? 0.4 : swing * 0.3)); this._aim(I, 'faR', -0.05, -0.55, 1); }
          else if (atk < 1) { const k = atk; this._aim(I, 'uaR', -0.7, 0.2 + 0.6 * k, 0.2); this._aim(I, 'faR', -0.2, 1, 0.3 - 0.5 * k); this._rot(I, 'chest', 0, 0.45 * k, 0); }
          else { const k = (atk - 1) * 2; this._aim(I, 'uaR', -0.6 + 0.9 * k, 0.1 - 0.3 * k, 1); this._aim(I, 'faR', 0.3 + 0.7 * k, -0.4, 0.8); this._rot(I, 'chest', 0, 0.45 - 0.9 * k, 0); }
        }
      } else {
        const aiming = mode === 'fight' && c.reloadT <= 0;
        gunMode = aiming ? 'aim' : 'low';
        if (aiming) {
          this._aim(I, 'uaR', -0.25, -0.2, 1); this._aim(I, 'faR', 0.15, 0.05, 1);
          this._aim(I, 'uaL', 0.25, -0.3, 1); this._aim(I, 'faL', -0.5, 0.1, 1);
        } else {
          this._aim(I, 'uaR', -0.18, -1, 0.3); this._aim(I, 'faR', 0.35, -0.35, 1);
          this._aim(I, 'uaL', 0.22, -0.9, 0.45); this._aim(I, 'faL', -0.6, -0.1, 1);
        }
      }
    }
    root.updateMatrixWorld(true);
    // the gun follows the right hand but always points the way he looks
    if (gun) {
      gun.visible = true;
      const h = I.B.handR.getWorldPosition(_a);
      if (gunMode === 'lap') { I.B.hips.getWorldPosition(_b); gun.position.set(_b.x + Math.sin(c.yaw) * 0.3, _b.y + 0.12, _b.z + Math.cos(c.yaw) * 0.3); gun.rotation.set(0, c.yaw + Math.PI / 2, 0); }
      else if (gunMode === 'ground') { gun.position.set(c.pos.x + Math.cos(c.yaw) * 0.5, c.pos.y + 0.05, c.pos.z - Math.sin(c.yaw) * 0.5); gun.rotation.set(0, c.yaw + 0.4, Math.PI / 2); }
      else {
        const pitch = gunMode === 'aim' && c.target ? -Math.atan2(c.target.pos.y + 1.2 - h.y, Math.max(1, Math.hypot(c.target.pos.x - h.x, c.target.pos.z - h.z))) : 0.45;
        gun.position.copy(h); gun.rotation.set(pitch, c.yaw, 0, 'YXZ');
      }
    }
  }

  // ================= name tags and the party panel =================
  _ui() {
    const g = this.g, cam = g.camera, W = innerWidth, H = innerHeight;
    let any = false;
    for (const c of this.list) {
      const show = c.I && !c.ride && (c.state !== 'wait' ? c.dist < 35 : c.dist < 9) && g.state === 'play';
      if (c.tagEl) {
        if (!show) c.tagEl.style.display = 'none';
        else {
          const h = this._headPos(c);
          _b.set(h.x, h.y + (c.state === 'down' ? 0.5 : 0.38), h.z).project(cam);
          if (_b.z > 1 || Math.abs(_b.x) > 1.1 || Math.abs(_b.y) > 1.1) c.tagEl.style.display = 'none';
          else {
            c.tagEl.style.display = 'block';
            c.tagEl.style.transform = `translate(${((_b.x + 1) / 2 * W).toFixed(1)}px, ${((1 - _b.y) / 2 * H).toFixed(1)}px) translate(-50%, -100%)`;
            c.tagBar.style.width = (c.hp / c.maxHp * 100).toFixed(0) + '%';
            c.tagEl.classList.toggle('waiting', c.state === 'wait'); c.tagEl.classList.toggle('down', c.state === 'down');
          }
        }
      }
      const j = c.I && c.state !== 'wait';
      if (c.panEl) {
        c.panEl.style.display = j ? '' : 'none';
        if (j) {
          any = true;
          c.panBar.style.width = (c.hp / c.maxHp * 100).toFixed(0) + '%';
          const st = c.state === 'down' ? 'DOWN' : c.state === 'hold' ? 'HOLD' : c.ride ? 'CAR' : c.reloadT > 0 ? 'RELOAD' : c.target ? 'FIGHT' : '';
          if (c._st !== st) { c._st = st; c.panState.textContent = st; c.panEl.classList.toggle('down', st === 'DOWN'); }
        }
      }
    }
    if (this.panel) this.panel.classList.toggle('show', any);
  }

  hideAll() { for (const c of this.list) { if (c.tagEl) c.tagEl.style.display = 'none'; } if (this.panel) this.panel.classList.remove('show'); }
}
