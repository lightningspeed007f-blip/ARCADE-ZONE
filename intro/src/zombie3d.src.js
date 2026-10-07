/* =========================================================
   GAME ZONE — 3D ZOMBIE for the cinematic intro
   ---------------------------------------------------------
   Source file. The browser loads the bundled build
   intro/zombie3d.js (three.js + this file). Rebuild with:
     npx esbuild intro/src/zombie3d.src.js --bundle --minify \
       --format=iife --target=es2017 --outfile=intro/zombie3d.js

   intro.js stays in charge of the timeline, scenery, sounds and
   the real cards. Each frame it calls update() with the time and
   its screen geometry, then render(). This module only poses and
   draws the character:
     - the Mixamo "zombie walk" clip for the entrance,
     - the arm raise / snap / present / wind-up / throw on top of
       it by aiming the arm bones, so no extra clips are needed.

   window.ArcadeZombie3D = {
     load(url) -> Promise, ready(), create(canvas, quality) -> view
   }
   view = { resize, setQuality, update(T, g) -> screen points,
            render(), destroy }
   ========================================================= */
import {
  BufferAttribute, WebGLRenderer, Scene, PerspectiveCamera, Group, Vector3, Quaternion,
  HemisphereLight, DirectionalLight, MeshStandardMaterial, MeshLambertMaterial,
  Color, AnimationMixer, LoopRepeat, SRGBColorSpace
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

/* Same timeline as intro.js (ms) */
var T_WALK0 = 150, T_WALK1 = 1750, T_RAISE = 1850, T_SNAP = 2450, T_CARDS = 2600,
    T_WINDUP = 3450, T_FLICK = 3680;

var MODEL_H = 1.8;            // metres; intro.js gives pixels per metre for this height
var CAM_D = 7;                // camera distance (m): mild, filmic perspective
var WALK_YAW = 50;            // degrees: enters walking diagonally towards the camera
var WALK_RATE = 1.45;         // clip seconds per real second (zombie lurch, a touch faster)

var asset = null, loading = null;

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function prog(T, s, d) { return clamp((T - s) / d, 0, 1); }
function eOutC(t) { return 1 - Math.pow(1 - t, 3); }
function eInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

/* ---------- loading ---------- */
function load(url) {
  if (loading) return loading;
  loading = new Promise(function (resolve, reject) {
    var loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(url, function (gltf) {
      var clip = gltf.animations[0];
      if (!clip) { reject(new Error("no animation")); return; }
      /* The clip walks forward (root motion on the hips). Keep that curve
         to move the character without foot sliding, and remove it from
         the clip so the body stays over its own origin. */
      var root = null;
      clip.tracks.forEach(function (t) {
        if (/Hips\.position$/.test(t.name)) {
          var v = t.values, n = v.length / 3;
          root = { times: t.times.slice(), z: new Float32Array(n), x0: v[0], z0: v[2] };
          for (var i = 0; i < n; i++) {
            root.z[i] = v[i * 3 + 2] - root.z0;
            v[i * 3] = root.x0; v[i * 3 + 2] = root.z0;
          }
        }
      });
      gltf.scene.traverse(function (o) { if (o.isMesh) paintSkin(o.geometry, /Joints/i.test(o.name)); });
      asset = { scene: gltf.scene, clip: clip, root: root };
      resolve(asset);
    }, undefined, function (e) { reject(e); });
  });
  return loading;
}

/* distance walked (m) at clip time t, continuing across loops */
function rootAt(t) {
  var r = asset.root;
  if (!r) return t * 0.34;
  var dur = asset.clip.duration, n = r.times.length, loops = Math.floor(t / dur), lt = t - loops * dur;
  var per = r.z[n - 1], i = 1;
  while (i < n - 1 && r.times[i] < lt) i++;
  var a = r.times[i - 1], b = r.times[i], k = b > a ? clamp((lt - a) / (b - a), 0, 1) : 0;
  return loops * per + lerp(r.z[i - 1], r.z[i], k);
}

/* ---------- rotten skin: blotches baked into vertex colours once ----------
   (no texture download; the colours ride along with the skinning) */
function hash3(x, y, z) {
  var h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
function vnoise(x, y, z) {
  var ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  function L(a, b, t) { return a + (b - a) * t; }
  return L(L(L(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), fx), L(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), fx), fy),
           L(L(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), fx), L(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), fx), fy), fz);
}
function paintSkin(geo, joints) {
  var pos = geo.attributes.position, n = pos.count, col = new Float32Array(n * 3);
  geo.computeBoundingBox();
  var bb = geo.boundingBox, sx = bb.max.x - bb.min.x || 1, sy = bb.max.y - bb.min.y || 1;
  var f = 9 / Math.max(sx, sy);                        // a few blotches per body height, whatever the units
  for (var i = 0; i < n; i++) {
    var x = pos.getX(i) * f, y = pos.getY(i) * f, z = pos.getZ(i) * f;
    var big = vnoise(x, y, z), mid = vnoise(x * 2.7 + 5, y * 2.7, z * 2.7), fine = vnoise(x * 7, y * 7, z * 7);
    var hy = (pos.getY(i) - bb.min.y) / sy;             // 0 = feet, 1 = head
    var rot = clamp((big * 0.65 + mid * 0.35 - 0.5) * 4, 0, 1);   // dark rotten patches
    var blood = clamp((mid - 0.66) * 6, 0, 1) * clamp((fine - 0.35) * 3, 0, 1);
    var grime = hy < 0.12 ? 0.5 : 1;                    // filthy feet
    var r, g, b;
    if (joints) { r = 0.55; g = 0.17; b = 0.15; }       // raw, sinewy joints
    else { r = 0.55; g = 0.68; b = 0.45; }              // pale green-grey skin
    var shade = (0.8 + 0.35 * fine) * grime;
    r = lerp(r, 0.2, rot * 0.8); g = lerp(g, 0.22, rot * 0.8); b = lerp(b, 0.12, rot * 0.8);
    r = lerp(r, 0.45, blood); g = lerp(g, 0.04, blood); b = lerp(b, 0.04, blood);
    col[i * 3] = Math.min(1, r * shade); col[i * 3 + 1] = Math.min(1, g * shade); col[i * 3 + 2] = Math.min(1, b * shade);
  }
  geo.setAttribute("color", new BufferAttribute(col, 3));
}

/* ---------- look: sickly skin, dark joints, neon rim light ---------- */
function makeMaterial(lowQ, base, rough) {
  var m = lowQ ? new MeshLambertMaterial({ color: base, vertexColors: true })
               : new MeshStandardMaterial({ color: base, roughness: rough, metalness: 0.05, vertexColors: true });
  var rim = { value: new Color(0x00f0ff) }, rimK = { value: 0.0 };
  m.userData.rim = rim; m.userData.rimK = rimK;
  m.onBeforeCompile = function (s) {
    s.uniforms.uRim = rim; s.uniforms.uRimK = rimK;
    s.fragmentShader = "uniform vec3 uRim;\nuniform float uRimK;\n" + s.fragmentShader.replace(
      "#include <dithering_fragment>",
      "float zf = 1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition)));\n" +
      "gl_FragColor.rgb += uRim * pow(zf, 2.6) * uRimK;\n#include <dithering_fragment>");
  };
  return m;
}

function create(canvas, quality) {
  if (!asset) throw new Error("model not loaded");
  var q = quality || "mid", lowQ = q === "low";
  var renderer = new WebGLRenderer({ canvas: canvas, alpha: true, antialias: !lowQ, powerPreference: "default" });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  var scene = new Scene();
  var camera = new PerspectiveCamera(30, 1, 0.5, 60);
  camera.position.set(0, 0, CAM_D);

  var hemi = new HemisphereLight(0x5a4a80, 0x0a0610, 0.55);
  var key = new DirectionalLight(0xbfe6ff, 0.6);       // the spotlight from above-front
  key.position.set(0.6, 4, 3);
  var rimR = new DirectionalLight(0x00f0ff, 1.6);      // back-light, right
  rimR.position.set(3, 1.5, -3);
  var rimL = new DirectionalLight(0xff2d8a, 0.9);      // back-light, left
  rimL.position.set(-3, 1, -2.5);
  scene.add(hemi, key, rimR, rimL, key.target, rimR.target, rimL.target);

  var body = cloneSkinned(asset.scene);
  var mats = [];
  body.traverse(function (o) {
    if (!o.isMesh) return;
    o.frustumCulled = false;                           // skinned bounds don't follow the walk
    var joints = /Joints/i.test(o.name);
    var m = joints ? makeMaterial(lowQ, 0x8a6a6a, 0.55) : makeMaterial(lowQ, 0xb4bcae, 0.9);
    o.material = m; mats.push(m);
  });
  var holder = new Group();
  holder.add(body);
  scene.add(holder);

  var mixer = new AnimationMixer(body);
  var walk = mixer.clipAction(asset.clip);
  walk.setLoop(LoopRepeat, Infinity);
  walk.play();

  var B = {};
  body.traverse(function (o) {
    if (o.isBone) B[o.name.replace(/^mixamorig:?/, "")] = o;
  });
  var hasRig = !!(B.Hips && B.Spine2 && B.Head && B.RightArm && B.RightForeArm && B.LeftArm && B.LeftForeArm);
  /* Bones pose() changes. The mixer only rewrites a bone when the clip
     value changes, so once the walk stops these must be put back by hand
     each frame or the extra rotations would pile up. */
  var touched = ["Spine", "Spine1", "Neck", "Head", "RightArm", "RightForeArm", "LeftArm", "LeftForeArm"]
    .map(function (n) { return B[n]; }).filter(Boolean);
  var baseQ = touched.map(function (b) { return b.quaternion.clone(); });

  var W = 1, H = 1, k = 300, walkEnd = 0, endDist = 0;
  var dpr = 1;
  function setQuality(name) {
    q = name;
    var cap = { min: 0.7, low: 1, mid: 1.25, high: 1.75 }[name] || 1;
    dpr = Math.min(cap, window.devicePixelRatio || 1);
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
  }
  function resize(w, h) { W = w; H = h; renderer.setSize(W, H, false); }
  setQuality(q);
  try { renderer.compile(scene, camera); } catch (e) {}   // compile shaders now, not on the first visible frame

  /* ---------- pose helpers (all directions in the model's own space:
     +Z = facing the camera, +Y = up, +X = the zombie's LEFT side) ---------- */
  var vA = new Vector3(), vB = new Vector3(), vC = new Vector3(), qA = new Quaternion(), qB = new Quaternion(), qC = new Quaternion();
  var modelQ = new Quaternion();

  /* rotate a bone so that it points (towards its first child) along dir */
  function aim(bone, dir, w) {
    if (!bone || w <= 0.001) return;
    var child = bone.children[0];
    if (!child) return;
    bone.updateWorldMatrix(true, true);
    bone.getWorldPosition(vA);
    child.getWorldPosition(vB);
    vB.sub(vA).normalize();
    vC.copy(dir).normalize().applyQuaternion(modelQ);
    qA.setFromUnitVectors(vB, vC);
    bone.getWorldQuaternion(qB);
    qA.multiply(qB);                                   // new world rotation
    bone.parent.getWorldQuaternion(qC).invert();
    qC.multiply(qA);                                   // back to local
    bone.quaternion.slerp(qC, w);
    bone.updateWorldMatrix(false, true);
  }
  /* extra rotation of a bone around an axis given in model space */
  function turn(bone, ax, ay, az, angle) {
    if (!bone || Math.abs(angle) < 1e-4) return;
    bone.updateWorldMatrix(true, false);
    vA.set(ax, ay, az).normalize().applyQuaternion(modelQ);
    qA.setFromAxisAngle(vA, angle);
    bone.getWorldQuaternion(qB);
    qA.multiply(qB);
    bone.parent.getWorldQuaternion(qC).invert();
    bone.quaternion.copy(qC.multiply(qA));
    bone.updateWorldMatrix(false, true);
  }
  function mix3(out, a, b, t) { out[0] = lerp(a[0], b[0], t); out[1] = lerp(a[1], b[1], t); out[2] = lerp(a[2], b[2], t); return out; }

  /* key poses: [upper arm dir, forearm dir] */
  var R_UP    = [[-0.3, 0.92, 0.25], [-0.05, 1, 0.2]];     // claw raised over the head
  var R_OPEN  = [[-0.85, 0.3, 0.45], [-0.65, 0.5, 0.6]];   // presenting the cards
  var L_OPEN  = [[0.85, 0.25, 0.45], [0.6, 0.45, 0.65]];
  var R_WIND  = [[0.35, 0.05, 0.94], [0.95, 0.3, -0.05]];  // across the chest
  var L_WIND  = [[0.55, -0.6, 0.55], [0.3, -0.3, 0.9]];
  var R_THROW = [[-0.2, 0.18, 1], [-0.12, 0.08, 1]];       // flung at the camera
  var ru = [0, 0, 0], rf = [0, 0, 0], lu = [0, 0, 0], lf = [0, 0, 0], dir = new Vector3();

  /* ---------- one frame ---------- */
  var out = { feetX: 0, feetY: 0, hand: { x: 0, y: 0 }, eyes: [{ x: 0, y: 0 }, { x: 0, y: 0 }], eyeR: 6, headY: 0 };
  function project(v, o) {
    vA.copy(v).project(camera);
    o.x = (vA.x + 1) / 2 * W; o.y = (1 - vA.y) / 2 * H;
    return o;
  }

  /* g = { W, H, fx, fy, k }: where intro.js wants the feet once he stands
     still, and how many pixels one metre is at that spot */
  function update(T, g) {
    if (g.W !== W || g.H !== H) resize(g.W, g.H);
    k = g.k;
    camera.aspect = W / H;
    camera.fov = 2 * Math.atan(H / (2 * CAM_D * k)) * 180 / Math.PI;
    camera.updateProjectionMatrix();
    var X = (g.fx - W / 2) / k, Y = (H / 2 - g.fy) / k;   // final spot, at depth 0

    /* the entrance: real walk-clip time, eased to a stop */
    var wp = prog(T, T_WALK0, T_WALK1 - T_WALK0);
    var span = (T_WALK1 - T_WALK0) / 1000 * WALK_RATE;
    if (!walkEnd) { walkEnd = span * 0.82; endDist = rootAt(walkEnd); }
    var ct = walkEnd * (1 - Math.pow(1 - wp, 1.6));       // slows down near the end
    var yaw = WALK_YAW * (1 - eInOut(prog(T, T_WALK1 - 450, 650))) * Math.PI / 180;
    var back = endDist - rootAt(ct);                      // metres still to walk
    var travel = WALK_YAW * Math.PI / 180;
    holder.position.set(X - Math.sin(travel) * back, Y, -Math.cos(travel) * back);
    holder.rotation.set(0, yaw, 0);

    /* small scale punch on the throw, shrink while fading (like the 2D one) */
    var fk = eOutC(prog(T, T_FLICK, 150));
    var s = (1 + 0.03 * fk * (1 - eInOut(prog(T, 3900, 600)))) * (1 - 0.05 * eInOut(prog(T, 5000, 700)));
    holder.scale.setScalar(s);
    holder.updateMatrixWorld(true);
    holder.getWorldQuaternion(modelQ);

    touched.forEach(function (b, i) { b.quaternion.copy(baseQ[i]); });
    mixer.setTime(ct);
    touched.forEach(function (b, i) { baseQ[i].copy(b.quaternion); });
    if (hasRig) pose(T);
    body.updateMatrixWorld(true);

    /* rim colour: cyan → magenta at the snap, like the 2D scene */
    var snapK = prog(T, T_SNAP, 220), rimK = lerp(0.35, 1.1, eOutC(prog(T, 900, 900))) * (T >= T_SNAP ? 1.15 : 1);
    mats.forEach(function (m) {
      m.userData.rim.value.setRGB(lerp(0, 1, snapK), lerp(0.94, 0.27, snapK), lerp(1, 0.59, snapK));
      m.userData.rimK.value = rimK;
    });
    var lit = T >= T_SNAP;
    key.color.setHex(lit ? 0xffe0c0 : 0xbfe6ff);
    key.intensity = lit ? 1.25 + 1.2 * Math.exp(-(T - T_SNAP) / 160) : lerp(0.15, 0.6, prog(T, 900, 900));
    rimR.color.copy(mats[0].userData.rim.value);

    /* screen points for intro.js */
    var base = vB.set(holder.position.x, holder.position.y, holder.position.z);
    project(base, vC); out.feetX = vC.x; out.feetY = vC.y;
    var hb = B.RightHandMiddle1 || B.RightHand;
    if (hb) { hb.getWorldPosition(dir); project(dir, out.hand); }
    if (B.Head) {
      B.Head.updateWorldMatrix(true, false);
      var e = B.Head.matrixWorld.elements;
      /* head axes in world space (bone scale removed) */
      var ax = vA.set(e[0], e[1], e[2]).normalize().clone(), ay = vB.set(e[4], e[5], e[6]).normalize().clone(), az = vC.set(e[8], e[9], e[10]).normalize().clone();
      var hp = new Vector3().setFromMatrixPosition(B.Head.matrixWorld);
      for (var i = 0; i < 2; i++) {
        var p = hp.clone().addScaledVector(ax, (i ? -1 : 1) * 0.034 * s).addScaledVector(ay, 0.085 * s).addScaledVector(az, 0.095 * s);
        project(p, out.eyes[i]);
      }
      out.eyeR = k * 0.05;
      out.headY = project(hp, vA.clone()).y;
    }
    return out;
  }

  function pose(T) {
    /* the walk clip already gives the classic zombie arms; the actions
       blend in over it and let go again at the end */
    var r = eInOut(prog(T, T_RAISE, 520));
    var pr = eInOut(prog(T, T_CARDS, 850));
    var wu = eInOut(prog(T, T_WINDUP, 230));
    var fk = eOutC(prog(T, T_FLICK, 150));
    var rl = eInOut(prog(T, 4300, 800));

    mix3(ru, R_UP[0], R_OPEN[0], pr); mix3(rf, R_UP[1], R_OPEN[1], pr);
    mix3(ru, ru, R_WIND[0], wu);      mix3(rf, rf, R_WIND[1], wu);
    mix3(ru, ru, R_THROW[0], fk);     mix3(rf, rf, R_THROW[1], fk);
    var wR = r * (1 - rl);
    /* snap: the forearm jerks back for an instant */
    var snapJ = T >= T_SNAP - 70 ? Math.sin(prog(T, T_SNAP - 70, 260) * Math.PI) : 0;
    rf[2] -= 0.6 * snapJ;
    aim(B.RightArm, dir.set(ru[0], ru[1], ru[2]), wR);
    aim(B.RightForeArm, dir.set(rf[0], rf[1], rf[2]), wR);

    mix3(lu, L_OPEN[0], L_WIND[0], wu); mix3(lf, L_OPEN[1], L_WIND[1], wu);
    var wL = pr * (1 - rl) * (1 - 0.5 * fk);
    aim(B.LeftArm, dir.set(lu[0], lu[1], lu[2]), wL);
    aim(B.LeftForeArm, dir.set(lf[0], lf[1], lf[2]), wL);

    /* body: rear back and roar on the snap, twist into the wind-up, lunge on the throw */
    var roar = T >= T_SNAP ? Math.exp(-(T - T_SNAP) / 380) * (1 - prog(T, T_SNAP + 900, 300)) : 0;
    var lean = -0.10 * r * (1 - pr) - 0.12 * roar + 0.05 * wu * (1 - fk) + 0.2 * fk * (1 - rl);
    var twist = 0.45 * wu * (1 - fk) - 0.35 * fk * (1 - rl);
    turn(B.Spine, 0, 1, 0, twist * 0.4);
    turn(B.Spine1, 0, 1, 0, twist * 0.6);
    turn(B.Spine1, 1, 0, 0, lean);
    /* head: looks up at the claw, throws itself back in the roar, breathing afterwards */
    var breathe = Math.sin(T * 0.004) * 0.04 * prog(T, T_WALK1, 400);
    turn(B.Neck, 1, 0, 0, -0.25 * r * (1 - pr) - 0.45 * roar + breathe);
    turn(B.Head, 0, 0, 1, Math.sin(T * 0.0023) * 0.08 * prog(T, T_WALK1, 600));   // twitchy tilt
  }

  function render() { renderer.render(scene, camera); }

  function destroy() {
    try {
      mixer.stopAllAction();
      body.traverse(function (o) { if (o.isMesh) o.material.dispose(); });
      renderer.dispose();
      if (renderer.forceContextLoss) renderer.forceContextLoss();
    } catch (e) {}
  }

  return { resize: resize, setQuality: setQuality, update: update, render: render, destroy: destroy };
}

window.ArcadeZombie3D = {
  load: load,
  ready: function () { return !!asset; },
  create: create
};
