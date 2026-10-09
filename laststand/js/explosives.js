// Fire, smoke and things that go bang: a light GPU particle system (one draw
// call for all flames, one for all smoke), the rocket launcher's rockets,
// explosions with area damage that falls off with distance, and the chunks
// of debris the railway giant throws.
import * as THREE from 'three';
import { clamp } from './util.js';

// ---------- sprite textures drawn in code ----------
function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const flameTex = () => canvasTex(64, (x, S) => {
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.65)'); g.addColorStop(0.65, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
});
// a lumpy smoke puff: several soft blobs, so smoke never looks like clean discs
const puffTex = () => canvasTex(128, (x, S) => {
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * S * 0.2;
    const cx = S / 2 + Math.cos(a) * r, cy = S / 2 + Math.sin(a) * r, rad = S * (0.18 + Math.random() * 0.2);
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
    const v = 200 + (Math.random() * 55 | 0);
    g.addColorStop(0, `rgba(${v},${v},${v},0.5)`); g.addColorStop(1, `rgba(${v},${v},${v},0)`);
    x.fillStyle = g; x.fillRect(0, 0, S, S);
  }
});

const VS = `
attribute float size; attribute float alpha; attribute vec3 tint;
uniform float uScale;
varying float vA; varying vec3 vC;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // fade out anything right in front of the lens, so a puff never fills the screen
  vA = alpha * smoothstep(0.9, 3.2, -mv.z); vC = tint;
  gl_PointSize = min(size * uScale / max(0.2, -mv.z), 512.0);
  gl_Position = projectionMatrix * mv;
}`;
const FS = `
uniform sampler2D map;
varying float vA; varying vec3 vC;
void main() {
  vec4 t = texture2D(map, gl_PointCoord);
  gl_FragColor = vec4(vC * t.rgb, t.a * vA);
  if (gl_FragColor.a < 0.004) discard;
}`;

// Particles with per-particle size, colour (start -> end), alpha, buoyancy and drag.
export class Particles {
  constructor(scene, n, additive, map) {
    this.n = n; this.i = 0; this.live = 0;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3);
    this.size = new Float32Array(n); this.alpha = new Float32Array(n); this.tint = new Float32Array(n * 3);
    this.life = new Float32Array(n); this.max = new Float32Array(n);
    this.s0 = new Float32Array(n); this.s1 = new Float32Array(n); this.a0 = new Float32Array(n);
    this.c0 = new Float32Array(n * 3); this.c1 = new Float32Array(n * 3);
    this.lift = new Float32Array(n); this.drag = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('tint', new THREE.BufferAttribute(this.tint, 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: map }, uScale: { value: 400 } }, vertexShader: VS, fragmentShader: FS,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 6 : 5;
    scene.add(this.points);
  }

  // x,y,z position; vx,vy,vz velocity; life seconds; s0 -> s1 size in metres;
  // c0 -> c1 colour [r,g,b]; a alpha; lift (up acceleration, negative = gravity); drag per second
  emit(x, y, z, vx, vy, vz, life, s0, s1, c0, c1, a, lift = 0, drag = 0) {
    const i = this.i; this.i = (this.i + 1) % this.n;
    const k = i * 3;
    this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z;
    this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz;
    this.life[i] = life; this.max[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a;
    this.c0[k] = c0[0]; this.c0[k + 1] = c0[1]; this.c0[k + 2] = c0[2];
    this.c1[k] = c1[0]; this.c1[k + 1] = c1[1]; this.c1[k + 2] = c1[2];
    this.lift[i] = lift; this.drag[i] = drag;
  }

  clear() { this.life.fill(0); this.alpha.fill(0); this.size.fill(0); this._dirty(); }

  _dirty() {
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = true; a.size.needsUpdate = true; a.alpha.needsUpdate = true; a.tint.needsUpdate = true;
  }

  update(dt, uScale) {
    this.mat.uniforms.uScale.value = uScale;
    let live = 0;
    for (let i = 0; i < this.n; i++) {
      let l = this.life[i];
      if (l <= 0) { if (this.alpha[i] !== 0) { this.alpha[i] = 0; this.size[i] = 0; } continue; }
      l -= dt; this.life[i] = l;
      if (l <= 0) { this.alpha[i] = 0; this.size[i] = 0; continue; }
      live++;
      const k = i * 3, t = 1 - l / this.max[i];
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[k] *= dr; this.vel[k + 1] = this.vel[k + 1] * dr + this.lift[i] * dt; this.vel[k + 2] *= dr;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * Math.sqrt(t);
      this.alpha[i] = this.a0[i] * Math.min(1, t * 10) * (1 - t) * (1 - t * 0.3);
      for (let c = 0; c < 3; c++) this.tint[k + c] = this.c0[k + c] + (this.c1[k + c] - this.c0[k + c]) * t;
    }
    this.live = live;
    this._dirty();
  }
}

// Fire colours (linear-ish, the flame material is not tone mapped)
export const FIRE = {
  core: [1.0, 0.85, 0.45], hot: [1.0, 0.55, 0.12], deep: [0.75, 0.16, 0.02], ember: [1.0, 0.45, 0.08],
  smokeDark: [0.08, 0.075, 0.07], smoke: [0.22, 0.21, 0.2], gold: [1.0, 0.78, 0.35], white: [1, 0.95, 0.85],
};

export class Explosives {
  constructor(game) {
    this.g = game;
    const scene = game.scene;
    this.fire = new Particles(scene, 900, true, flameTex());
    this.smoke = new Particles(scene, 700, false, puffTex());
    this.rockets = []; this.rocks = []; this.balls = [];
    // rocket model, pooled
    const olive = new THREE.MeshLambertMaterial({ color: 0x4a5236 }), dark = new THREE.MeshLambertMaterial({ color: 0x262624 });
    this.rocketGeo = { body: new THREE.CylinderGeometry(0.045, 0.045, 0.5, 8).rotateX(Math.PI / 2), nose: new THREE.ConeGeometry(0.06, 0.26, 8).rotateX(Math.PI / 2), fin: new THREE.BoxGeometry(0.24, 0.01, 0.12) };
    this.rocketMats = { olive, dark };
    this.glowMat = new THREE.SpriteMaterial({ map: game.tex.glow, color: 0xffb050, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    // fireballs: two big additive sprites per blast, pooled
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: game.tex.glow, color: 0xffc070, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
      s.visible = false; s.renderOrder = 7; scene.add(s);
      this.balls.push({ s, t: 1, dur: 0.6, size: 6 });
    }
    // scorch marks on the ground
    this.scorch = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: game.tex.hole, color: 0x050403, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }), 24);
    this.scorch.count = 0; this.scorchI = 0; this.scorch.frustumCulled = false; scene.add(this.scorch);
    // debris the boss throws
    this.rockGeo = new THREE.DodecahedronGeometry(0.45, 0);
    this.rockMat = new THREE.MeshLambertMaterial({ color: 0x8a8278, flatShading: true });
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3();
  }

  reset() {
    for (const r of this.rockets) r.mesh.visible = false;
    for (const r of this.rocks) r.mesh.visible = false;
    this.rockets.forEach((r) => (r.live = false)); this.rocks.forEach((r) => (r.live = false));
    for (const b of this.balls) { b.t = b.dur; b.s.visible = false; }
    this.fire.clear(); this.smoke.clear();
    this.scorch.count = 0;
  }

  _rocketMesh() {
    let r = this.rockets.find((q) => !q.live);
    if (r) return r;
    const { body, nose, fin } = this.rocketGeo, M = this.rocketMats;
    const g = new THREE.Group();
    g.add(new THREE.Mesh(body, M.olive));
    const n = new THREE.Mesh(nose, M.dark); n.position.z = 0.36; g.add(n);
    for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(fin, M.dark); f.position.z = -0.22; f.rotation.z = k * Math.PI / 4; g.add(f); }
    const glow = new THREE.Sprite(this.glowMat); glow.scale.setScalar(0.6); glow.position.z = -0.32; g.add(glow);
    g.visible = false; this.g.scene.add(g);
    r = { mesh: g, live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), t: 0, trail: 0 };
    this.rockets.push(r);
    return r;
  }

  // From the shooter's eye: the rocket appears a metre ahead (never inside the shooter). Point-blank
  // against a wall or a zombie it goes off right there instead of tunnelling through.
  launch(eye, dir, right, src = 'player') {
    const g = this.g, near = 1.05;
    const wall = g.physics.raycast(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, near);
    const eh = g.enemies.hitTest(eye, dir, near), bh = g.boss && g.boss.hitTest(eye, dir, near);
    const t = Math.min(wall ? wall.t : 9, eh ? eh.t : 9, bh ? bh.t : 9);
    if (t < 9) { const k = Math.max(0.2, t - 0.1); this.explode(eye.x + dir.x * k, eye.y + dir.y * k, eye.z + dir.z * k, { src }); return; }
    this.fireRocket(eye.clone().addScaledVector(dir, near).addScaledVector(right, 0.1), dir, src);
  }

  // origin: THREE.Vector3 just in front of the muzzle, dir: unit vector
  fireRocket(origin, dir, src = 'player') {
    const r = this._rocketMesh();
    r.live = true; r.t = 0; r.trail = 0; r.src = src;
    r.pos.copy(origin); r.vel.copy(dir).multiplyScalar(46);
    r.mesh.visible = true; r.mesh.position.copy(origin);
    r.mesh.lookAt(this._v.copy(origin).add(dir));
    // back-blast and launch smoke
    for (let i = 0; i < 14; i++) {
      const s = 1 + Math.random() * 2;
      this.smoke.emit(origin.x - dir.x * 2.6, origin.y - dir.y * 2.6, origin.z - dir.z * 2.6, -dir.x * s * 3 + (Math.random() - 0.5) * 2, -dir.y * s * 2 + Math.random(), -dir.z * s * 3 + (Math.random() - 0.5) * 2, 1.4 + Math.random(), 0.4, 2.0, FIRE.smoke, FIRE.smoke, 0.5, 0.5, 2.2);
    }
    for (let i = 0; i < 8; i++) this.fire.emit(origin.x, origin.y, origin.z, dir.x * 4 + (Math.random() - 0.5) * 3, dir.y * 4 + (Math.random() - 0.5) * 3, dir.z * 4 + (Math.random() - 0.5) * 3, 0.15, 0.5, 0.1, FIRE.core, FIRE.hot, 0.9);
  }

  // Boss debris: arcs from `from` to `to` ([x,y,z] arrays).
  throwRock(from, to, onHit) {
    let r = this.rocks.find((q) => !q.live);
    if (!r) { const m = new THREE.Mesh(this.rockGeo, this.rockMat); m.visible = false; this.g.scene.add(m); r = { mesh: m, pos: new THREE.Vector3(), vel: new THREE.Vector3() }; this.rocks.push(r); }
    const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
    const T = clamp(Math.hypot(dx, dz) / 19, 0.7, 2.2), G = 14;
    r.live = true; r.t = 0; r.onHit = onHit; r.spin = [Math.random() * 8, Math.random() * 8];
    r.pos.set(from[0], from[1], from[2]);
    r.vel.set(dx / T, dy / T + 0.5 * G * T, dz / T);
    r.mesh.position.copy(r.pos); r.mesh.visible = true;
  }

  // ---------- the blast ----------
  // o: { radius, dmg, src, self (max damage to the player), shake }
  explode(x, y, z, o = {}) {
    const g = this.g, R = o.radius ?? 7, maxD = o.dmg ?? 320, fx = g.fx, P = g.player;
    // fireballs
    this._ball(x, y + 0.4, z, 0.55, 7.5, 0xfff0c0);
    this._ball(x, y + 0.9, z, 0.9, 11, 0xff7a20);
    // flames, smoke, embers, sparks, debris
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9 + 0.1, sp = 3 + Math.random() * 7;
      this.fire.emit(x, y + 0.3, z, Math.cos(a) * sp * (1 - e * 0.5), e * sp * 0.9, Math.sin(a) * sp * (1 - e * 0.5), 0.35 + Math.random() * 0.6, 1.0 + Math.random(), 2.6 + Math.random() * 1.5, FIRE.core, FIRE.deep, 0.95, 3, 3);
    }
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 4;
      this.smoke.emit(x + (Math.random() - 0.5), y + 0.5 + Math.random(), z + (Math.random() - 0.5), Math.cos(a) * sp, 1.5 + Math.random() * 3, Math.sin(a) * sp, 2.8 + Math.random() * 2.5, 1.6, 5.5 + Math.random() * 2, FIRE.smokeDark, FIRE.smoke, 0.62, 0.9, 1.4);
    }
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, sp = 5 + Math.random() * 9;
      this.fire.emit(x, y + 0.3, z, Math.cos(a) * sp, 3 + Math.random() * 9, Math.sin(a) * sp, 1.0 + Math.random() * 1.4, 0.16, 0.06, FIRE.ember, FIRE.deep, 1, -11, 0.6);
    }
    fx.burst([x, y + 0.2, z], [0, 0.6, 0], 30, [1, 0.7, 0.3], 9, 0.5);
    fx.burst([x, y + 0.2, z], [0, 0.8, 0], 18, [0.22, 0.18, 0.14], 7, 1.0);
    // light: the shared muzzle-flash light, pushed hard for a moment
    const L = g.arsenal.flashLight;
    L.position.set(x, y + 1.5, z); L.distance = 34; L.intensity = 95;
    // scorch mark when it went off near the ground
    const gy = g.physics.groundAt(x, z, 0.3, y + 0.6);
    if (y - gy < 1.6) this._scorch(x, gy, z, 2.6 + Math.random());
    // sound + shake + every zombie in earshot hears it
    g.audio.play('explosion', { pos: [x, y + 1, z], vol: 1.5, max: 450, far: 45, roll: 0.5, ref: 8, verbAmt: 1.1, vary: 0.08 });
    const pd = Math.hypot(P.pos.x - x, P.pos.y + 1 - y, P.pos.z - z);
    P.shake = Math.max(P.shake, clamp(1.35 - pd / 22, 0, 1.25) * (o.shake ?? 1));
    g.noise({ x, z }, 95, 'gun');
    // ---- damage: every zombie / human in the radius once, falling off with distance ----
    let hits = 0, kills = 0;
    for (const e of g.enemies.list) {
      if (e.dead) continue;
      const ex = e.pos.x - x, ey = e.pos.y + 1 - y, ez = e.pos.z - z, d = Math.hypot(ex, ey, ez);
      if (d > R) continue;
      const k = 1 - d / R;
      let dmg = maxD * Math.pow(k, 1.25);
      // a wall between the blast and the target soaks most of it
      if (d > 0.8 && g.physics.raycast(x, y + 0.3, z, ex / d, (ey - 0.3) / d, ez / d, d - 0.4)) dmg *= 0.3;
      if (dmg < 1) continue;
      const dir = { x: ex / (d || 1), z: ez / (d || 1) };
      const killed = g.enemies.damage(e, dmg, 'body', dir, o.src || 'player');
      hits++; if (killed) kills++;
      e.stagger = Math.max(e.stagger, 0.6);
      if (!killed && e.type !== 'brute') g.physics.moveCharacter(e.pos, dir.x * k * 1.4, dir.z * k * 1.4, 0, 0.016, 0.3, 1.7, 0.45, e.st);
      if (killed) fx.bloodPool(e.pos.x, e.pos.y, e.pos.z, 1.1);
    }
    if (g.boss) { const r = g.boss.blast(x, y, z, R, maxD, o.src || 'player'); if (r) hits++; }
    if (hits && (o.src || 'player') === 'player') g.hitMarker(false, kills > 0);
    // the shooter is not immune: stand clear of your own rocket
    const selfMax = o.self ?? 34, selfR = R * 0.62;
    if (selfMax > 0 && pd < selfR && !P.dead) {
      g.hurtPlayer(selfMax * (1 - pd / selfR), { pos: { x, z } }, 'अपने ही धमाके में · caught in your own blast');
    }
    // doors nearby blow in
    for (const dd of g.doors) if (!dd.broken && !dd.metal && Math.hypot(dd.cx - x, dd.cz - z) < 4) g.breakDoor(dd);
  }

  _ball(x, y, z, dur, size, color) {
    const b = this.balls.reduce((a, q) => (q.t / q.dur > a.t / a.dur ? q : a));
    b.t = 0; b.dur = dur; b.size = size;
    b.s.position.set(x, y, z); b.s.material.color.setHex(color); b.s.material.rotation = Math.random() * 6; b.s.visible = true;
  }

  _scorch(x, y, z, s) {
    const i = this.scorchI++ % 24;
    this._v.set(x, y + 0.035, z); this._q.setFromEuler(new THREE.Euler(0, Math.random() * 6, 0)); this._s.set(s, 1, s);
    this._m.compose(this._v, this._q, this._s);
    this.scorch.setMatrixAt(i, this._m); this.scorch.count = Math.min(24, Math.max(this.scorch.count, i + 1));
    this.scorch.instanceMatrix.needsUpdate = true;
  }

  // ---------- per frame ----------
  update(dt) {
    const g = this.g, cam = g.camera;
    const uScale = g.renderer.domElement.height * 0.5 / Math.tan(cam.fov * Math.PI / 360);
    this.fire.update(dt, uScale); this.smoke.update(dt, uScale);
    for (const b of this.balls) {
      if (!b.s.visible) continue;
      b.t += dt;
      const k = b.t / b.dur;
      if (k >= 1) { b.s.visible = false; continue; }
      b.s.scale.setScalar(b.size * (0.35 + 0.65 * Math.sqrt(k)));
      b.s.material.opacity = 1 - k * k;
    }
    for (const r of this.rockets) if (r.live) this._rocket(r, dt);
    for (const r of this.rocks) if (r.live) this._rock(r, dt);
  }

  _rocket(r, dt) {
    const g = this.g, P = g.physics;
    r.t += dt;
    r.vel.y -= 1.6 * dt;
    const sx = r.vel.x * dt, sy = r.vel.y * dt, sz = r.vel.z * dt, len = Math.hypot(sx, sy, sz);
    const d = { x: sx / len, y: sy / len, z: sz / len }, o = r.pos;
    let best = len, hit = false;
    const wall = P.raycast(o.x, o.y, o.z, d.x, d.y, d.z, len);
    if (wall) { best = wall.t; hit = true; }
    const eh = g.enemies.hitTest(o, d, best);
    if (eh && eh.t < best) { best = eh.t; hit = true; }
    const bh = g.boss && g.boss.hitTest(o, d, best);
    if (bh && bh.t < best) { best = bh.t; hit = true; }
    const nx = o.x + d.x * best, ny = o.y + d.y * best, nz = o.z + d.z * best;
    const gy = P.groundAt(nx, nz, 0.05, ny + 0.3);
    if (ny <= gy + 0.05 && gy > -1e8) { hit = true; }
    // trail
    r.trail += best;
    while (r.trail > 0.45) {
      r.trail -= 0.45;
      const back = r.trail;
      const tx = nx - d.x * (back + 0.35), ty = ny - d.y * (back + 0.35), tz = nz - d.z * (back + 0.35);
      this.smoke.emit(tx, ty, tz, (Math.random() - 0.5) * 0.6, 0.2 + Math.random() * 0.4, (Math.random() - 0.5) * 0.6, 1.6 + Math.random() * 1.0, 0.25, 1.5, FIRE.smoke, [0.32, 0.31, 0.3], 0.5, 0.35, 0.8);
      this.fire.emit(tx, ty, tz, -d.x * 3, -d.y * 3, -d.z * 3, 0.1 + Math.random() * 0.06, 0.45, 0.12, FIRE.core, FIRE.hot, 0.9);
    }
    o.set(nx, Math.max(ny, gy + 0.05), nz);
    r.mesh.position.copy(o);
    r.mesh.lookAt(this._v.set(o.x + r.vel.x, o.y + r.vel.y, o.z + r.vel.z));
    if (hit || r.t > 5) {
      r.live = false; r.mesh.visible = false;
      this.explode(o.x - d.x * 0.15, o.y - d.y * 0.15, o.z - d.z * 0.15, { src: r.src });
    }
  }

  _rock(r, dt) {
    const g = this.g, P = g.physics;
    r.t += dt;
    r.vel.y -= 14 * dt;
    const sx = r.vel.x * dt, sy = r.vel.y * dt, sz = r.vel.z * dt, len = Math.hypot(sx, sy, sz) || 1e-6;
    const d = { x: sx / len, y: sy / len, z: sz / len }, o = r.pos;
    let best = len, hit = false;
    const wall = P.raycast(o.x, o.y, o.z, d.x, d.y, d.z, len);
    if (wall) { best = wall.t; hit = true; }
    o.set(o.x + d.x * best, o.y + d.y * best, o.z + d.z * best);
    const gy = P.groundAt(o.x, o.z, 0.1, o.y + 0.3);
    if (o.y <= gy + 0.3) hit = true;
    const pl = g.player.pos;
    if (Math.hypot(pl.x - o.x, pl.y + 1 - o.y, pl.z - o.z) < 0.9) hit = true;
    r.mesh.position.copy(o); r.mesh.rotation.x += r.spin[0] * dt; r.mesh.rotation.z += r.spin[1] * dt;
    if (r.t > 0.05 && Math.random() < 0.5) this.smoke.emit(o.x, o.y, o.z, 0, 0.2, 0, 1.0, 0.3, 0.9, FIRE.smoke, FIRE.smoke, 0.3, 0.2, 1);
    if (hit || r.t > 4) {
      r.live = false; r.mesh.visible = false;
      for (let i = 0; i < 16; i++) { const a = Math.random() * 6.28, sp = 1 + Math.random() * 3; this.smoke.emit(o.x, o.y + 0.2, o.z, Math.cos(a) * sp, 0.6 + Math.random(), Math.sin(a) * sp, 1.6 + Math.random(), 0.8, 2.6, [0.4, 0.37, 0.33], [0.3, 0.28, 0.26], 0.55, 0.3, 1.6); }
      g.fx.burst([o.x, o.y + 0.2, o.z], [0, 0.7, 0], 20, [0.5, 0.46, 0.4], 6, 0.9);
      g.audio.play('bang', { pos: [o.x, o.y, o.z], vol: 1, rate: 0.75 });
      if (r.onHit) r.onHit(o.x, o.y, o.z);
    }
  }
}
