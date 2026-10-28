// The three uploaded 3D models (glTF), loaded on demand for the Joker finale (the acid gun and the desert
// giants load separately: weapons.js, giants.js):
//
//   models/joker.glb   the jester ("the Joker") — rigged, no animations: posed in code
//   models/catnap.glb  CatNap — rigged, with its own animations (stalk, pursue, gas attack…)
//   models/street.glb  an abandoned city street — the Joker's Playground arena
//
// The files in the repo are already cleaned and compressed (meshopt geometry, webp textures):
// the jester's broken collar and right forearm were removed and the forearm rebuilt as a
// mirror of the left one. Materials are swapped for Lambert so they light like the rest of
// the town (and cost less on phones).
import * as THREE from 'three';
import { GLTFLoader } from '../lib/GLTFLoader.js';
import { MeshoptDecoder } from '../lib/meshopt_decoder.module.js';
import { ASSET_ROOT } from './assets.js';

const FILES = { joker: 'models/joker.glb', cat: 'models/catnap.glb', street: 'models/street.glb' };

function lambert(m, keepNormal, glow) {
  const L = new THREE.MeshLambertMaterial({
    map: m.map || null, color: m.color ? m.color.clone() : new THREE.Color(1, 1, 1),
    emissive: m.emissive ? m.emissive.clone() : new THREE.Color(0, 0, 0), emissiveMap: m.emissiveMap || null,
    emissiveIntensity: m.emissiveIntensity ?? 1,
    transparent: !!m.transparent, opacity: m.opacity ?? 1, alphaTest: m.alphaTest || 0, side: m.side,
  });
  // characters glow faintly with their own colours so they read at night
  if (glow && m.map && !m.emissiveMap) { L.emissiveMap = m.map; L.emissive.setScalar(glow); }
  if (keepNormal && m.normalMap) { L.normalMap = m.normalMap; if (m.normalScale) L.normalScale.copy(m.normalScale); }
  L.name = m.name;
  return L;
}

function swapMaterials(root, keepNormal, glow = 0) {
  const cache = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const one = (m) => { if (!cache.has(m)) cache.set(m, lambert(m, keepNormal, glow)); return cache.get(m); };
    o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
  });
}

// ---------- the jester ----------
// Bind pose with every skinned bone, then the bones that carry no skin (the face mask, eyes)
// keep their authored offsets. Result: a clean T-pose, facing +Z, +X = his left hand.
export const JOKER_HEAD = 2.05;            // height of his head bone in metres (about 2.5 m to the hat's tip)
function prepJoker(gltf) {
  const scene = gltf.scene;
  const skinned = [];
  let skel = null;
  scene.traverse((o) => { if (o.isSkinnedMesh) { skinned.push(o); skel = o.skeleton; o.frustumCulled = false; } });
  const bones = skel.bones;
  const used = new Set();
  for (const m of skinned) {
    const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight;
    const map = m.skeleton.bones;
    for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > 0.001) used.add(map[si.getComponent(i, k)]);
  }
  const saved = new Map(bones.map((b) => [b, [b.position.clone(), b.quaternion.clone(), b.scale.clone()]]));
  const all = new Set();
  for (const m of skinned) for (const b of m.skeleton.bones) all.add(b);
  for (const m of skinned) m.skeleton.pose();
  const carries = (b) => used.has(b) || b.children.some((c) => c.isBone && carries(c));
  for (const b of all) if (!carries(b) && saved.has(b)) { const s = saved.get(b); b.position.copy(s[0]); b.quaternion.copy(s[1]); b.scale.copy(s[2]); }
  scene.rotation.x = Math.PI / 2;                       // the root bone lost the Sketchfab z-up wrapper in pose()
  swapMaterials(scene, true, 0.22);
  const named = {};
  scene.traverse((o) => { if (o.isBone) named[o.name.replace(/_\d+$/, '')] = o; });
  // stand him on the origin: pegs at y = 0, head at 2.05 m
  const off = new THREE.Group(), holder = new THREE.Group();
  off.add(scene); holder.add(off);
  holder.updateMatrixWorld(true);
  const base = named.Bone.getWorldPosition(new THREE.Vector3()), head = named.head.getWorldPosition(new THREE.Vector3());
  off.position.copy(base).negate();
  holder.scale.setScalar(JOKER_HEAD / (head.y - base.y));
  holder.updateMatrixWorld(true);
  const rest = new Map();
  const hq = new THREE.Quaternion();
  for (const b of all) rest.set(b, { q: b.quaternion.clone(), w: b.getWorldQuaternion(new THREE.Quaternion()).premultiply(hq), wi: null });
  for (const r of rest.values()) r.wi = r.w.clone().invert();
  return { root: holder, bones: named, rest };
}

// ---------- CatNap ----------
export const CAT_SCALE = 0.3;
function prepCat(gltf) {
  const scene = gltf.scene;
  scene.traverse((o) => { if (o.isSkinnedMesh) o.frustumCulled = false; });
  swapMaterials(scene, true, 0.3);
  const holder = new THREE.Group();
  holder.add(scene); holder.scale.setScalar(CAT_SCALE);
  const clips = {};
  for (const c of gltf.animations) {
    const k = c.name.split('|').pop();
    // walk cycles drive the cat from code: drop the root's own travel
    c.tracks = c.tracks.filter((t) => !/^Root_02\.position$/.test(t.name));
    clips[k] = c;
  }
  const named = {};
  scene.traverse((o) => { if (o.isBone) named[o.name.replace(/_\d+$/, '')] = o; });
  return { root: holder, scene, clips, bones: named };
}

// ---------- the player's own body (third person) ----------
// models/vampire.glb: a static mesh (no rig, no clips), about 9.4 model units tall with its feet at y ≈ 0.
// It is scaled to the player's height and stood on the origin, so the player controller can place it directly.
const BODY_HEIGHT = 1.8;
export function prepVampire(gltf) {
  const holder = new THREE.Group();
  holder.add(gltf.scene);
  lambertize(gltf.scene, false, 0.12);
  const box = new THREE.Box3().setFromObject(holder);
  const c = box.getCenter(new THREE.Vector3());
  const k = BODY_HEIGHT / (box.max.y - box.min.y);
  holder.scale.setScalar(k);
  holder.position.set(-c.x * k, -box.min.y * k, -c.z * k);
  holder.traverse((o) => { o.frustumCulled = false; });
  return holder;
}

// ---------- the street ----------
export const STREET = { S: 4, x: -420, y: 0.22, z: -420 };   // metres per model unit, and where it sits (x, z > -600: clear of the Shivdham / Kalidham checks)
function prepStreet(gltf) {
  const scene = gltf.scene;
  swapMaterials(scene, false);
  scene.scale.setScalar(STREET.S);
  scene.position.set(STREET.x, STREET.y, STREET.z);
  scene.updateMatrixWorld(true);
  scene.traverse((o) => { o.matrixAutoUpdate = false; });
  return { root: scene };
}

let pending = null;
export function loadModels(onProgress) {
  if (pending) return pending;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const got = {};
  const one = (k) => new Promise((res, rej) => loader.load(ASSET_ROOT + FILES[k], (g) => res(g), (e) => { got[k] = e.total ? e.loaded / e.total : 0; onProgress && onProgress(got); }, rej));
  pending = Promise.all([one('joker'), one('cat'), one('street')]).then(([j, c, s]) => ({ joker: prepJoker(j), cat: prepCat(c), street: prepStreet(s) }));
  pending.catch(() => { pending = null; });   // a failed download can be retried later
  return pending;
}

// Rotate a bone by a rotation given in the character's own frame (+Y up, +Z forward,
// +X his left), relative to its rest pose. Children follow.
const _q = new THREE.Quaternion();
export function poseBone(rig, name, D) {
  const b = rig.bones[name]; if (!b) return;
  const r = rig.rest.get(b);
  _q.copy(r.wi).multiply(D).multiply(r.w);
  b.quaternion.copy(r.q).multiply(_q);
}
export function restAll(rig) { for (const [b, r] of rig.rest) b.quaternion.copy(r.q); }

// ---------- the night's other uploads: the pickup, the ghoul, the hound and three far-off places ----------
// Each loads on its own, in the background, once the town is ready (see outlands.js).
//   models/truck.glb   the zombie pickup (wheels cut out of the body so they can spin and steer)
//   models/ghoul.glb   a rotting zombie (Mixamo rig, one clip: a scream, then a swaying idle)
//   models/hound.glb   a zombie dog (one clip: a howl)
//   models/forest.glb, city.glb, metro.glb   the forest road, the dead city and the old metro
// Materials become Lambert like everything else in town.
const loader = { l: null };
export function loadGLB(path, onProgress) {
  if (!loader.l) { loader.l = new GLTFLoader(); loader.l.setMeshoptDecoder(MeshoptDecoder); }
  return new Promise((res, rej) => loader.l.load(ASSET_ROOT + path, res, (e) => onProgress && e.total && onProgress(e.loaded / e.total), rej));
}
export function lambertize(root, keepNormal = false, glow = 0) { swapMaterials(root, keepNormal, glow); return root; }

// A skinned model's own copy (meshes share geometry and materials, each gets its own bones).
export function cloneSkinned(src) {
  const map = new Map();
  const copy = src.clone(true);
  const a = [], b = [];
  src.traverse((o) => a.push(o)); copy.traverse((o) => b.push(o));
  a.forEach((o, i) => map.set(o, b[i]));
  copy.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const s = a[b.indexOf(o)].skeleton;
    o.bind(new THREE.Skeleton(s.bones.map((x) => map.get(x)), s.boneInverses), o.bindMatrix);
  });
  return copy;
}
