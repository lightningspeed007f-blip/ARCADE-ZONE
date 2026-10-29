// Bodies for the uploaded creatures. Their minds are the zombies' own (enemies.js); this file only gives
// them skinned bodies, animation and hit spheres.
//
//   THE ZOMBIES (models/zombies/*.glb): four Mixamo zombies from the Scary Zombie Packs (the prisoner, the
//       girl scout, the zombie girl and the parasite). Every walker, runner, brute and ghoul in the game wears
//       one of them. Each file carries its own clips (idle, walk, run, attack, scream, death, dying, crawl,
//       running crawl; converted by scripts/zombies). The walk forward was taken out of the moving clips and
//       stored as a speed, so the stride is matched to how fast the zombie really moves.
//       The nearest few of each kind get a real animated body; the rest (the hordes further off) are drawn
//       as a low-poly copy of the same model, posed once per frame of its walk, run or crawl when it loads and
//       instanced: hundreds cost a handful of draw calls.
//       A zombie shot through the legs may drop and crawl after you.
//   THE HOUND (models/hound.glb): a zombie dog. Its one clip is a howl (it howls when it spots you, and
//       the pack comes). Its first frame is the standing pose; the gallop, the lunge and the fall are posed
//       in code.
// A small pool of bodies is shared out to the nearest creatures every frame.
import * as THREE from 'three';
import { cloneSkinned, lambertize, loadGLB } from './models.js';

const _q = new THREE.Quaternion(), _t = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3();
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _r = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
const D = (x, y = 0, z = 0) => _q.setFromEuler(_e.set(x, y, z, 'XYZ'));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// the four zombies, and how tall each one stands (the height of its head bone, metres)
export const ZOMBIE_SKINS = ['prisoner', 'girlscout', 'zombiegirl', 'parasite'];
const SKIN = { prisoner: { head: 1.64 }, girlscout: { head: 1.46 }, zombiegirl: { head: 1.56 }, parasite: { head: 1.68 } };
// hit spheres on a Mixamo rig: bone, radius, part, lift
const HUMAN_HS = [['Head', 0.16, 'head', 0.06], ['Spine2', 0.24, 'body'], ['Spine', 0.22, 'body'], ['Hips', 0.2, 'body'],
  ['LeftUpLeg', 0.13, 'leg', 0.2], ['RightUpLeg', 0.13, 'leg', 0.2], ['LeftLeg', 0.11, 'leg'], ['RightLeg', 0.11, 'leg'],
  ['LeftForeArm', 0.09, 'arm'], ['RightForeArm', 0.09, 'arm'], ['LeftArm', 0.1, 'arm'], ['RightArm', 0.1, 'arm']];
// the zombie attack clip: the claws land this far into it
const ATTACK_HIT = 0.39;
// The scream clip, as the game plays it (a zombie that spots you: enemies.js roar()). It draws breath with its head
// thrown back (clip 0-0.85 s), screams hunched forward with its arms out (0.85-1.95 s, slowed down so the scream
// has time to be heard), then straightens up (1.95 s to the end). The scream sound (sounds/zombie_roar.mp3, trimmed
// to this) starts as the mouth opens and fades out as it straightens.
const ROAR_IN = 0.85, ROAR_OUT = 1.95, ROAR_END = 2.708, ROAR_FAST = 1.1, ROAR_HOLD = 0.7;
export const ROAR = {
  total: ROAR_IN / ROAR_FAST + (ROAR_OUT - ROAR_IN) / ROAR_HOLD + (ROAR_END - ROAR_OUT) / ROAR_FAST,
  cry: ROAR_IN / ROAR_FAST - 0.04,        // when the scream sound starts, seconds into the roar
};
const roarClipTime = (age) => {
  const a = ROAR_IN / ROAR_FAST, b = a + (ROAR_OUT - ROAR_IN) / ROAR_HOLD;
  return age < a ? age * ROAR_FAST : age < b ? ROAR_IN + (age - a) * ROAR_HOLD : ROAR_OUT + (age - b) * ROAR_FAST;
};
// Feeding: crouched over a body, held in the deepest part of the scream clip, the head tearing down into it. Each
// bite follows the loudness of the eating sound, so the chewing lands on the crunches you hear.
const FEED_LO = 1.25, FEED_SWAY = 0.45;
// the frames the far-away copies are posed in: clip, and where in it (0..1)
const FAR = {
  idle: ['idle', [0.3]],
  walk: ['walk', [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6]],
  run: ['run', [0, 0.25, 0.5, 0.75]],
  crawl: ['crawl', [0, 0.25, 0.5, 0.75]],
  dead: ['death', [1]],
};

const KINDS = {
  hound: {
    pool: 12, shoulder: 0.82, glow: 0.18,
    legs: /(Clavicle|UpperArm|ForeArm|FrAnkle|Wrist|Fingers|Thigh|Calf|Ankle|Foot|Toe|HorseLink)/,
    hs: [['Bone_WH_Head', 0.17, 'head', 0.08], ['Bone_WH_Neck2', 0.16, 'body'], ['Bone_WH_Spine3', 0.24, 'body'], ['Bone_WH_Spine2', 0.24, 'body'],
      ['Bone_WH_Spine1', 0.22, 'body'], ['Bone_WH_Pelvis', 0.2, 'body'], ['Bone_WH_ForeArm_L', 0.09, 'leg'], ['Bone_WH_ForeArm_R', 0.09, 'leg'],
      ['Bone_WH_Calf_L', 0.1, 'leg'], ['Bone_WH_Calf_R', 0.1, 'leg']],
  },
};
for (const s of ZOMBIE_SKINS) KINDS['z:' + s] = { zombie: true, skin: s, pool: 7, head: SKIN[s].head, glow: 0.07, hs: HUMAN_HS };
// strip the "mixamorig:" prefix and the exporter's _123 suffix
const clean = (n) => n.replace(/^mixamorig\d*:?/, '').replace(/_\d+$/, '');
const isFar = (o) => { for (let p = o; p; p = p.parent) if (p.name && p.name.startsWith('LOD_far')) return true; return false; };

export class Creatures {
  constructor(game) {
    this.g = game;
    this.t = {};                    // kind -> template + pool
  }
  has(kind) { return !!this.t[kind]; }
  // the outlands' creatures can be set loose: the hounds and at least one zombie are in
  beastsReady() { return this.has('hound') && ZOMBIE_SKINS.some((s) => this.has('z:' + s)); }

  // the four zombies download one after another, right away (until one arrives its zombies keep the box bodies)
  loadZombies() {
    if (this._loading) return; this._loading = true;
    const pool = this.g.mobile ? 4 : 7;
    let q = new Promise((r) => setTimeout(r, this.g.mobile ? 1200 : 300));
    for (const s of ZOMBIE_SKINS) {
      KINDS['z:' + s].pool = pool;
      q = q.then(() => loadGLB('models/zombies/' + s + '.glb')).then((m) => this.add('z:' + s, m)).catch((e) => console.warn('could not load zombie', s, e));
    }
  }

  // ---------- templates ----------
  add(kind, gltf) {
    const K = KINDS[kind];
    if (K.zombie) return this._addZombie(kind, K, gltf);
    const scene = gltf.scene;
    lambertize(scene, false, K.glow);
    scene.traverse((o) => { if (o.isSkinnedMesh) o.frustumCulled = false; if (o.isMesh) { o.material.alphaTest = 0.5; o.material.transparent = false; } });
    scene.updateMatrixWorld(true);
    const bones = {};
    scene.traverse((o) => { if (o.isBone) bones[clean(o.name)] = o; });
    const holder = new THREE.Group(), off = new THREE.Group();
    off.add(scene); holder.add(off);
    // measure in the standing pose: scale to a big dog
    const m = new THREE.AnimationMixer(scene); m.clipAction(gltf.animations[0]).play(); m.update(0); scene.updateMatrixWorld(true);
    const base = this._measure(scene);
    const s = K.shoulder / (bones.Bone_WH_Spine3.getWorldPosition(_v).y - base.min.y); m.stopAllAction(); m.uncacheRoot(scene);
    off.position.set(0, -base.min.y, 0);
    holder.scale.setScalar(s);
    const full = gltf.animations[0], fps = 30;
    const sub = (name, a, b, filterLegs) => {
      const c = THREE.AnimationUtils.subclip(full, name, Math.round(a * fps), Math.round(b * fps), fps);
      if (filterLegs) c.tracks = c.tracks.filter((t) => !K.legs.test(clean(t.name.split('.')[0])));
      return c;
    };
    const clips = { howl: sub('howl', 0, 3.8), stand: sub('stand', 0, 0.1), run: sub('run', 0, 0.1, true) };
    this.t[kind] = { K, src: holder, clips, scale: s, pool: [], kind };
  }

  _measure(scene) {
    scene.traverse((o) => { if (o.isSkinnedMesh) o.boundingBox = null; });
    return new THREE.Box3().setFromObject(scene);
  }

  _addZombie(kind, K, gltf) {
    const scene = gltf.scene;
    lambertize(scene, false, K.glow);
    const far = [];
    scene.traverse((o) => { if (!o.isMesh) return; o.frustumCulled = false; if (isFar(o)) far.push(o); });
    // the far copy must not count when measuring
    for (const o of far) o.visible = false;
    const bones = {};
    scene.traverse((o) => { if (o.isBone) bones[clean(o.name)] = o; });
    const clips = {};
    for (const a of gltf.animations) clips[a.name] = a;
    const speeds = Object.assign({ walk: 0.37, run: 3.3, crawl: 0.47, crawlRun: 2.4 }, scene.userData.speeds || {});
    const holder = new THREE.Group(), off = new THREE.Group();
    off.add(scene); holder.add(off);
    // stand it in its idle pose to measure the head height
    const m = new THREE.AnimationMixer(scene);
    if (clips.idle) { m.clipAction(clips.idle).play(); m.update(0); }
    scene.updateMatrixWorld(true);
    const base = this._measure(scene);
    const s = K.head / (bones.Head.getWorldPosition(_v).y - base.min.y);
    m.stopAllAction(); m.uncacheRoot(scene);
    off.position.set(0, -base.min.y, 0);
    holder.scale.setScalar(s);
    holder.updateMatrixWorld(true);
    const T = { K, src: holder, clips, speeds, scale: s, pool: [], kind };
    T.far = this._bake(T, scene, holder, far, bones);
    // the near bodies don't carry the far copy
    for (const o of far) o.parent.remove(o);
    this.t[kind] = T;
    if (this.g.outlands) this.g.outlands.beastsIn();       // the outlands' ghouls can come out now
  }

  // Pose the low-poly copy once for each far frame and keep the posed vertices: a static mesh per frame,
  // drawn instanced. The hit spheres are posed with it.
  _bake(T, scene, holder, far, bones) {
    if (!far.length) return null;
    const mixer = new THREE.AnimationMixer(scene), frames = {}, cap = 170;
    const hsB = T.K.hs.filter((h) => bones[h[0]]).map((h) => ({ b: bones[h[0]], r: h[1], part: h[2], oy: h[3] || 0 }));
    const bake = (mesh) => {
      const g = mesh.geometry, n = g.attributes.position.count, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { mesh.getVertexPosition(i, _v); _v.applyMatrix4(mesh.matrixWorld); pos[i * 3] = _v.x; pos[i * 3 + 1] = _v.y; pos[i * 3 + 2] = _v.z; }
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      if (g.attributes.uv) out.setAttribute('uv', g.attributes.uv);
      out.setIndex(g.index);
      out.computeVertexNormals();
      return out;
    };
    for (const key in FAR) {
      const [cn, us] = FAR[key], clip = T.clips[cn];
      if (!clip) continue;
      const act = mixer.clipAction(clip); act.play();
      frames[key] = us.map((u) => {
        act.time = Math.min(clip.duration - 1e-3, u * clip.duration); mixer.update(0);
        holder.updateMatrixWorld(true);
        const ims = far.map((mesh) => {
          const im = new THREE.InstancedMesh(bake(mesh), mesh.material, cap);
          im.count = 0; im.visible = false; im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          this.g.scene.add(im);
          return im;
        });
        const hs = hsB.map((h) => { h.b.getWorldPosition(_v); return [_v.x, _v.y, _v.z, h.r, h.part, h.oy]; });
        return { ims, hs };
      });
      act.stop();
    }
    mixer.uncacheRoot(scene);
    if (!frames.idle) return null;
    return { frames, all: Object.values(frames).flat().flatMap((f) => f.ims) };
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
    // rest pose of every bone in the creature's own frame (+Y up, +Z forward), for posing in code
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
  // the same, on top of whatever the clip has the bone doing
  _add(I, name, q) {
    const r = I.rest.get(name); if (!r) return;
    _t.copy(r.wi).multiply(q).multiply(r.w);
    r.b.quaternion.multiply(_t);
  }

  _play(I, name, fade = 0.3, ts = 1, once = false, randomStart = false) {
    const a = I.acts[name]; if (!a) return null;
    a.timeScale = ts; a.paused = false;
    if (I.cur === a) return a;
    a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = once; a.play();
    if (randomStart) a.time = Math.random() * a.getClip().duration;
    if (I.cur) I.cur.crossFadeTo(a, fade, false);
    I.cur = a;
    return a;
  }

  // ---------- every frame: share the bodies out to the nearest creatures and pose them ----------
  draw(list, cam, dt) {
    const cx = cam.position.x, cz = cam.position.z;
    for (const T of Object.values(this.t)) {
      const F = T.far;
      if (F) for (const im of F.all) im.count = 0;
      const mine = list.filter((e) => e.mkind === T.kind);
      for (const e of mine) { e._far = false; e._cd = Math.hypot(e.pos.x - cx, e.pos.z - cz) - (e._inst ? 6 : 0); }   // a little stickiness: no popping
      mine.sort((a, b) => a._cd - b._cd);
      const keep = new Set(mine.slice(0, T.K.pool));
      for (const e of mine) if (!keep.has(e)) { if (e._inst) this._release(e); if (F) this._farPut(e, T, dt); else e.hs.length = 0; }
      for (const I of T.pool) if (I.owner && !keep.has(I.owner)) this._release(I.owner);
      for (const e of keep) {
        if (!e._inst) {
          let I = T.pool.find((x) => !x.owner);
          if (!I) { I = this._make(T); T.pool.push(I); }
          I.owner = e; e._inst = I; I.root.visible = true; I.cur = null; I.mixer.stopAllAction();
          I.deadPose = false; I.follow = 0;
        }
        if (T.K.zombie) this._zombie(e, e._inst, T, dt); else this._hound(e, e._inst, dt);
      }
      if (F) for (const im of F.all) { im.visible = im.count > 0; if (im.count) im.instanceMatrix.needsUpdate = true; }
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

  // which loop a zombie is in, and how fast it plays (the stride matched to its real speed)
  _gait(e, T, sp) {
    const S = T.speeds, sc = T.scale * e.scale;
    if (e.crawler) return sp > 1.0 ? ['crawlRun', clamp(sp / (S.crawlRun * sc), 0.6, 1.8)] : ['crawl', sp > 0.1 ? clamp(sp / (S.crawl * sc), 0.6, 2.6) : 0.25];
    if (sp > 1.0) return ['run', clamp(sp / (S.run * sc), 0.55, 1.7)];
    if (sp > 0.12) return ['walk', clamp(sp / (S.walk * sc), 0.6, 2.6)];
    return ['idle', 1];
  }

  // ---------- a zombie ----------
  _zombie(e, I, T, dt) {
    this._place(e, I);
    if (e.dead) {
      // its death clip once (from where it had got to, if it only just came into view), then it lies there
      if (!I.deadPose) {
        I.deadPose = true;
        const a = this._play(I, e.dieClip || 'death', 0.12, 1, true);
        if (a) a.time = Math.min(e.deathT, a.getClip().duration - 0.01);
      }
      I.mixer.update(dt);
      I.root.position.y = e.pos.y - Math.max(0, e.deathT - 30) * 0.06;
      this._hits(e, I); return;
    }
    const sp = e.moveSpeed || 0;
    const attacking = e.state === 'ATTACK' || (e.state === 'HUNT' && e.huntAtk);
    const feeding = e.state === 'FEED' && e.eating && !e.crawler;
    if (e.roarT > 0 && !e.crawler) {
      // the clip follows the roar's own clock, the same one that starts the scream sound
      const a = this._play(I, 'scream', 0.2, 1, true);
      if (a) { a.paused = true; a.time = clamp(roarClipTime(ROAR.total - e.roarT), 0, a.getClip().duration - 0.01); }
    } else if (feeding) {
      const a = this._play(I, 'scream', 0.5, 1, false);
      if (a) { a.paused = true; e.feedSway = (e.feedSway || 0) + dt * 0.9; a.time = FEED_LO + FEED_SWAY * (0.5 - 0.5 * Math.cos(e.feedSway)); }
    } else if (attacking && !e.crawler) {
      // the wind-up runs the clip up to the moment the claws land, exactly as the bite lands (enemies.js)
      const a = this._play(I, 'attack', 0.15, 1, true);
      if (a) { a.paused = true; a.time = clamp(1 - Math.max(0, e.attackT) / e.T.wind, 0, 1) * ATTACK_HIT * a.getClip().duration; }
      I.follow = 0.45;
    } else if (I.follow > 0 && I.cur === I.acts.attack && !e.crawler) {
      // the follow-through after the strike
      I.follow -= dt; I.cur.paused = false; I.cur.timeScale = 1.4;
    } else if (e.state === 'BANG') this._play(I, 'attack', 0.2, 1.25);
    else { const [clip, ts] = this._gait(e, T, sp); this._play(I, clip, 0.3, ts, false, !I.cur); }
    I.mixer.update(dt);
    // a crawler lunging at you: the clip, faster
    if (attacking && e.crawler) this._play(I, 'crawlRun', 0.2, 1.6);
    if (feeding) this._feedPose(e, I, dt);
    // flinch: thrown back a little by the hit
    if (e.flinch > 0.05) this._add(I, 'Spine', D(-e.flinch * 0.45));
    this._hits(e, I);
  }

  // hunched lower over the body, hands down in it, the head dipping to tear at it on every bite
  _feedPose(e, I, dt) {
    const A = this.g.audio, h = e.eatSrc, env = h && A.envelope(h.name);
    e.chewT = (e.chewT ?? Math.random() * 9) + dt;
    let bite;
    if (env) bite = clamp((env[Math.min(env.length - 1, Math.floor(h.at() / 0.05))] - 0.15) / 0.6, 0, 1);
    else { bite = Math.pow(Math.max(0, Math.sin(e.chewT * 10.5)), 2); }   // too far to hear: its own rhythm
    // a quick dip, a slower lift back up
    const k = bite > (e.bite || 0) ? 1 - Math.exp(-dt * 25) : 1 - Math.exp(-dt * 7);
    const b = e.bite = (e.bite || 0) + (bite - (e.bite || 0)) * k;
    this._add(I, 'Spine', D(0.15)); this._add(I, 'Spine1', D(0.1)); this._add(I, 'Spine2', D(0.15 + 0.1 * b));
    this._add(I, 'Neck', D(0.25 + 0.3 * b)); this._add(I, 'Head', D(0.15 + 0.25 * b, 0.15 * Math.sin(e.chewT * 2.3)));
    this._add(I, 'LeftArm', D(0.5, 0, -0.45)); this._add(I, 'RightArm', D(0.5, 0, 0.45));
    this._add(I, 'LeftForeArm', D(0, 0.35 * b)); this._add(I, 'RightForeArm', D(0, -0.35 * b));
  }

  // a zombie too far off for a body of its own: one of the posed copies
  _farPut(e, T, dt) {
    const F = T.far;
    let key, ts = 1;
    if (e.dead) key = 'dead';
    else { const g = this._gait(e, T, e.moveSpeed || 0); key = g[0] === 'crawlRun' ? 'crawl' : g[0]; ts = g[1]; }
    const set = F.frames[key] || F.frames.idle;
    const clip = T.clips[FAR[key] ? FAR[key][0] : 'idle'];
    e.cyc = ((e.cyc || Math.random()) + dt * ts / (clip ? clip.duration : 1)) % 1;
    const fr = set[Math.min(set.length - 1, Math.floor(e.cyc * set.length))];
    _p.set(e.pos.x, e.pos.y - (e.dead ? Math.max(0, e.deathT - 30) * 0.06 : 0), e.pos.z);
    _r.setFromAxisAngle(_up, e.yaw); _s.setScalar(e.scale);
    _m.compose(_p, _r, _s);
    for (const im of fr.ims) if (im.count < im.instanceMatrix.count) im.setMatrixAt(im.count++, _m);
    e._far = true;
    // hit spheres from the same frame
    const hs = e.hs; hs.length = 0;
    if (e.dead) return;
    for (const h of fr.hs) { _v.set(h[0], h[1], h[2]).applyMatrix4(_m); hs.push([_v.x, _v.y + h[5] * e.scale, _v.z, h[3] * e.scale, h[4]]); }
    e.headPos = [hs[0][0], hs[0][1], hs[0][2]];
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
