// Bodies for the two uploaded creatures: the ghoul (models/ghoul.glb, a rotting zombie on a Mixamo rig)
// and the hound (models/hound.glb, a zombie dog). Their minds are the zombies' own (enemies.js);
// this file only gives them skinned bodies, animation and hit spheres.
//
// Each file carries a single clip, so the rest is done in code on top of it:
//   ghoul: the clip is cut into a roar (when it spots you) and a swaying, claws-out stalk; while it
//          walks, its legs are swung in code under the stalking upper body.
//   hound: the clip is a howl (it howls when it spots you, and the pack comes). Its first frame is
//          the standing pose; the gallop, the lunge and the fall are all posed in code.
// A small pool of bodies is shared out to the nearest creatures every frame.
import * as THREE from 'three';
import { cloneSkinned, lambertize } from './models.js';

const _q = new THREE.Quaternion(), _t = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3();
const D = (x, y = 0, z = 0) => _q.setFromEuler(_e.set(x, y, z, 'XYZ'));

const KINDS = {
  ghoul: {
    pool: 10, head: 1.66, glow: 0.1, headBone: 'Head',
    // leg bones left out of the walking clip (posed in code instead)
    legs: /(UpLeg|Leg|Foot|ToeBase|Toe_End)$/,
    hs: [['Head', 0.17, 'head', 0.06], ['Spine2', 0.25, 'body'], ['Spine', 0.23, 'body'], ['Hips', 0.2, 'body'],
      ['LeftUpLeg', 0.13, 'leg', 0.2], ['RightUpLeg', 0.13, 'leg', 0.2], ['LeftLeg', 0.11, 'leg'], ['RightLeg', 0.11, 'leg'],
      ['LeftForeArm', 0.09, 'arm'], ['RightForeArm', 0.09, 'arm'], ['LeftArm', 0.1, 'arm'], ['RightArm', 0.1, 'arm']],
  },
  hound: {
    pool: 12, shoulder: 0.82, glow: 0.18,
    legs: /(Clavicle|UpperArm|ForeArm|FrAnkle|Wrist|Fingers|Thigh|Calf|Ankle|Foot|Toe|HorseLink)/,
    hs: [['Bone_WH_Head', 0.17, 'head', 0.08], ['Bone_WH_Neck2', 0.16, 'body'], ['Bone_WH_Spine3', 0.24, 'body'], ['Bone_WH_Spine2', 0.24, 'body'],
      ['Bone_WH_Spine1', 0.22, 'body'], ['Bone_WH_Pelvis', 0.2, 'body'], ['Bone_WH_ForeArm_L', 0.09, 'leg'], ['Bone_WH_ForeArm_R', 0.09, 'leg'],
      ['Bone_WH_Calf_L', 0.1, 'leg'], ['Bone_WH_Calf_R', 0.1, 'leg']],
  },
};
// strip the "mixamorig:" prefix and the exporter's _123 suffix
const clean = (n) => n.replace(/^mixamorig:?/, '').replace(/_\d+$/, '');

export class Creatures {
  constructor(game) {
    this.g = game;
    this.t = {};                    // kind -> template + pool
  }
  has(kind) { return !!this.t[kind]; }

  // ---------- templates ----------
  add(kind, gltf) {
    const K = KINDS[kind], scene = gltf.scene;
    lambertize(scene, kind === 'ghoul', K.glow);
    scene.traverse((o) => { if (o.isSkinnedMesh) o.frustumCulled = false; if (o.isMesh && kind === 'hound') { o.material.alphaTest = 0.5; o.material.transparent = false; } });
    // measure in the bind pose: scale to a man-sized ghoul / a big dog
    scene.updateMatrixWorld(true);
    const bones = {};
    scene.traverse((o) => { if (o.isBone) bones[clean(o.name)] = o; });
    const measure = () => { scene.traverse((o) => { if (o.isSkinnedMesh) o.boundingBox = null; }); return new THREE.Box3().setFromObject(scene); };
    let base = measure();
    const holder = new THREE.Group(), off = new THREE.Group();
    off.add(scene); holder.add(off);
    let s;
    if (kind === 'ghoul') {
      const clip = gltf.animations[0];
      // stand it in its idle pose to measure the head height (the bind pose is a T-pose in model units)
      const m = new THREE.AnimationMixer(scene); m.clipAction(clip).play(); m.update(0.1); scene.updateMatrixWorld(true);
      base = measure();
      const hy = bones.Head.getWorldPosition(_v).y - base.min.y;
      s = K.head / hy; m.stopAllAction(); m.uncacheRoot(scene);
    } else {
      const m = new THREE.AnimationMixer(scene); m.clipAction(gltf.animations[0]).play(); m.update(0); scene.updateMatrixWorld(true);
      base = measure();
      const sy = bones.Bone_WH_Spine3.getWorldPosition(_v).y - base.min.y;
      s = K.shoulder / sy; m.stopAllAction(); m.uncacheRoot(scene);
    }
    off.position.set(0, -base.min.y, 0);
    holder.scale.setScalar(s);
    // clips
    const full = gltf.animations[0], fps = 30;
    const sub = (name, a, b, filterLegs) => {
      const c = THREE.AnimationUtils.subclip(full, name, Math.round(a * fps), Math.round(b * fps), fps);
      if (filterLegs) c.tracks = c.tracks.filter((t) => !K.legs.test(clean(t.name.split('.')[0])));
      return c;
    };
    const clips = kind === 'ghoul'
      ? { roar: sub('roar', 4.4, 6.2), stalk: sub('stalk', 6.0, 11.6), walk: sub('walk', 6.0, 11.6, true) }
      : { howl: sub('howl', 0, 3.8), stand: sub('stand', 0, 0.1), run: sub('run', 0, 0.1, true) };
    this.t[kind] = { K, src: holder, clips, scale: s, pool: [], kind };
  }

  _make(T) {
    const root = cloneSkinned(T.src);
    root.visible = false; root.rotation.order = 'YXZ';
    this.g.scene.add(root);
    const bones = {};
    root.traverse((o) => { if (o.isBone) bones[clean(o.name)] = o; });
    const mixer = new THREE.AnimationMixer(root);
    const acts = {};
    for (const k in T.clips) acts[k] = mixer.clipAction(T.clips[k]);
    // rest pose of every leg bone in the creature's own frame (+Y up, +Z forward), for posing in code
    root.updateMatrixWorld(true);
    const rq = new THREE.Quaternion(); root.getWorldQuaternion(rq); rq.invert();
    const rest = new Map();
    for (const k in bones) {
      const b = bones[k];
      const w = b.getWorldQuaternion(new THREE.Quaternion()).premultiply(rq);
      rest.set(k, { b, q: b.quaternion.clone(), w, wi: w.clone().invert() });
    }
    const hs = T.K.hs.filter((h) => bones[h[0]]).map((h) => ({ b: bones[h[0]], r: h[1], part: h[2], oy: h[3] || 0 }));
    return { root, bones, mixer, acts, rest, hs, owner: null, cur: null, kind: T.kind, s: T.scale };
  }

  // rotate a bone by a rotation in the creature's own frame, relative to its rest pose
  _pose(I, name, q) {
    const r = I.rest.get(name); if (!r) return;
    _t.copy(r.wi).multiply(q).multiply(r.w);
    r.b.quaternion.copy(r.q).multiply(_t);
  }

  _play(I, name, fade = 0.3, ts = 1, once = false) {
    const a = I.acts[name]; if (!a) return;
    a.timeScale = ts;
    if (I.cur === a) return;
    a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = once; a.play();
    if (I.cur) I.cur.crossFadeTo(a, fade, false);
    I.cur = a;
  }

  // ---------- every frame: share the bodies out to the nearest creatures and pose them ----------
  draw(list, cam, dt) {
    const cx = cam.position.x, cz = cam.position.z;
    for (const T of Object.values(this.t)) {
      const mine = list.filter((e) => e.T.model === T.kind);
      for (const e of mine) e._cd = Math.hypot(e.pos.x - cx, e.pos.z - cz) - (e._inst ? 6 : 0);   // a little stickiness: no popping
      mine.sort((a, b) => a._cd - b._cd);
      const keep = new Set(mine.slice(0, T.K.pool));
      for (const e of mine) if (!keep.has(e)) { if (e._inst) this._release(e); e.hs.length = 0; }
      for (const I of T.pool) if (I.owner && !keep.has(I.owner)) this._release(I.owner);
      for (const e of keep) {
        if (!e._inst) {
          let I = T.pool.find((x) => !x.owner);
          if (!I) { I = this._make(T); T.pool.push(I); }
          I.owner = e; e._inst = I; I.root.visible = true; I.cur = null; I.mixer.stopAllAction();
          I.deadPose = false;
        }
        if (T.kind === 'ghoul') this._ghoul(e, e._inst, dt); else this._hound(e, e._inst, dt);
      }
    }
  }
  _release(e) { const I = e._inst; if (!I) return; I.owner = null; I.root.visible = false; e._inst = null; e.hs.length = 0; }
  // creatures that left the list (old corpses): free their bodies
  sweep(list) {
    const alive = new Set(list);
    for (const T of Object.values(this.t)) for (const I of T.pool) if (I.owner && !alive.has(I.owner)) this._release(I.owner);
  }

  _place(e, I) {
    I.root.position.set(e.pos.x, e.pos.y, e.pos.z);
    I.root.rotation.set(0, e.yaw, 0);
    I.root.scale.setScalar(I.s * e.scale);         // the model's own units times this creature's size
  }

  _hits(e, I) {
    I.root.updateMatrixWorld(true);
    if (e.dead) { e.hs.length = 0; return; }
    const hs = e.hs; hs.length = 0;
    for (const h of I.hs) { h.b.getWorldPosition(_v); hs.push([_v.x, _v.y + h.oy * e.scale, _v.z, h.r * e.scale, h.part]); }
    const hd = I.hs[0].b.getWorldPosition(_v); e.headPos = [hd.x, hd.y, hd.z];
  }

  // ---------- the ghoul ----------
  _ghoul(e, I, dt) {
    this._place(e, I);
    const sp = e.dead ? 0 : (e.moveSpeed || 0);
    const chase = e.state === 'CHASE' || e.state === 'ATTACK' || e.state === 'HUNT';
    if (e.dead) {
      // the clip freezes; the body topples back or forward over its feet
      if (I.cur) I.cur.paused = true;
      const k = Math.min(1, e.deathT / 0.8), ease = k * k * (3 - 2 * k);
      I.root.rotation.x = e.fallDir * ease * 1.45;
      I.root.position.y = e.pos.y - ease * 0.05 - Math.max(0, e.deathT - 30) * 0.06;
      this._hits(e, I); return;
    }
    if (e.roarT > 0) this._play(I, 'roar', 0.25, 1.15, true);
    else if (sp > 0.25) this._play(I, 'walk', 0.35, chase ? 1.25 : 0.8);
    else this._play(I, 'stalk', 0.45, chase ? 1.1 : 0.55);
    if (I.cur) I.cur.paused = false;
    I.mixer.update(dt);
    // legs: a heavy, dragging stride while it moves (the clip owns them when it stands)
    if (I.cur === I.acts.walk) {
      e.phase += sp * 2.1 * dt;
      const ph = e.phase, sw = Math.min(1, sp / 1.1), A = (0.42 + Math.min(0.35, sp * 0.12)) * sw;
      for (const [side, s] of [['Left', 1], ['Right', -1]]) {
        const p = ph + (s > 0 ? 0 : Math.PI);
        const lift = Math.max(0, Math.sin(p + 1.2));
        const limp = s > 0 && e.limp ? 1 - e.limp : 1;
        this._pose(I, side + 'UpLeg', D(-Math.sin(p) * A * limp - 0.12, 0, 0));
        this._pose(I, side + 'Leg', D(0.15 + lift * 0.95 * sw * limp, 0, 0));
        this._pose(I, side + 'Foot', D(-0.15 * sw, 0, 0));
      }
    }
    // the swipe: both arms come down at you at the end of the wind-up
    if (e.state === 'ATTACK' || (e.state === 'HUNT' && e.huntAtk)) {
      const k = Math.max(0, Math.min(1, 1 - Math.max(0, e.attackT) / e.T.wind)), sw = Math.sin(k * Math.PI);
      this._pose(I, 'LeftArm', D(-1.2 - sw * 0.9, 0, -0.3));
      this._pose(I, 'RightArm', D(-1.2 - sw * 0.9, 0, 0.3));
      this._pose(I, 'Spine1', D(0.15 + sw * 0.4));
    }
    // flinch
    if (e.flinch > 0.05) this._pose(I, 'Spine', D(-e.flinch * 0.5));
    this._hits(e, I);
  }

  // ---------- the hound ----------
  _hound(e, I, dt) {
    this._place(e, I);
    const sp = e.dead ? 0 : (e.moveSpeed || 0);
    if (e.dead) {
      if (I.cur) I.cur.paused = true;
      // falls on its side, legs out
      const k = Math.min(1, e.deathT / 0.5), ease = k * k * (3 - 2 * k);
      I.root.rotation.z = e.fallDir * ease * 1.45;
      I.root.position.y = e.pos.y + ease * 0.12 - Math.max(0, e.deathT - 30) * 0.05;
      this._hits(e, I); return;
    }
    if (e.roarT > 0) this._play(I, 'howl', 0.2, 1.05, true);
    else if (sp > 0.3) this._play(I, 'run', 0.15);
    else this._play(I, 'stand', 0.3);
    if (I.cur) I.cur.paused = false;
    I.mixer.update(dt);
    if (I.cur === I.acts.run) {
      // a bounding gallop: front legs together, hind legs together, a beat apart
      const run = Math.min(1, sp / 5);
      e.phase += (5 + sp * 1.4) * dt;
      const ph = e.phase, A = 0.35 + run * 0.45;
      for (const [s, o] of [['L', 0], ['R', 0.35]]) {
        const f = ph + o, h = ph + o + Math.PI;
        this._pose(I, 'Bone_WH_UpperArm_' + s, D(Math.sin(f) * A, 0, 0));
        this._pose(I, 'Bone_WH_ForeArm_' + s, D(Math.max(0, Math.cos(f)) * 0.8 * run, 0, 0));
        this._pose(I, 'Bone_WH_Thigh_' + s, D(Math.sin(h) * A * 0.9, 0, 0));
        this._pose(I, 'Bone_WH_Calf_' + s, D(-Math.max(0, Math.cos(h)) * 0.7 * run, 0, 0));
      }
      // the spine flexes with the stride, the head stays low and level
      this._pose(I, 'Bone_WH_Spine2', D(Math.sin(ph * 1) * 0.12 * run, 0, 0));
      this._pose(I, 'Bone_WH_Neck', D(0.12 * run - Math.sin(ph) * 0.06, 0, 0));
      I.root.position.y += Math.abs(Math.sin(ph)) * 0.08 * run;
    }
    // the lunge: rear back, then snap forward with the jaws
    if (e.state === 'ATTACK' || (e.state === 'HUNT' && e.huntAtk)) {
      const k = Math.max(0, Math.min(1, 1 - Math.max(0, e.attackT) / e.T.wind));
      const back = k < 0.6 ? k / 0.6 : 1 - (k - 0.6) / 0.4;
      this._pose(I, 'Bone_WH_Spine1', D(-0.25 * back, 0, 0));
      this._pose(I, 'Bone_WH_Neck', D(k > 0.6 ? 0.35 : -0.2 * back, 0, 0));
      this._pose(I, 'Bone_WH_Face_Jaw', D(0, 0, k > 0.55 ? 0.5 : 0.15));
      I.root.position.addScaledVector(_v.set(Math.sin(e.yaw), 0, Math.cos(e.yaw)), k > 0.6 ? 0.35 * e.scale : -0.1 * back);
    }
    if (e.flinch > 0.05) this._pose(I, 'Bone_WH_Spine2', D(-e.flinch * 0.4));
    this._hits(e, I);
  }
}
