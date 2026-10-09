// Places the user's images in the world: photo frames, flex banners,
// and the Maa Kamakhya images.
import * as THREE from 'three';
import { coverFit } from './assets.js';

function planeAt(scene, mat, pos, yaw, w, h, offset = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(pos[0] + Math.sin(yaw) * offset, pos[1], pos[2] + Math.cos(yaw) * offset);
  m.rotation.y = yaw;
  scene.add(m);
  return m;
}

export function buildDisplays(W, scene, A, tex) {
  const out = { halo: null, haloBase: 1, shivLight: null, anim: [], photos: [] };
  // ---- photo frames (inside houses) ----
  for (const s of W.frameSlots) {
    const ph = A.photos[s.idx - 1];
    if (!ph) continue;
    const t = ph.texture.clone(); t.needsUpdate = true;
    coverFit(t, ph.aspect, 0.52, 0.7);
    const mat = new THREE.MeshLambertMaterial({ map: t });
    const yaw = s.F.yaw + s.faceYaw;
    out.photos.push(planeAt(scene, mat, s.F.world(s.x, s.y, s.z), yaw, 0.52, 0.7, 0.025));
  }
  // ---- flex banners ----
  for (const b of W.banners) {
    const bn = A.banners[b.idx - 1];
    if (!bn) continue;
    const t = bn.texture.clone(); t.needsUpdate = true;
    coverFit(t, bn.aspect, b.w, b.h);
    const mat = new THREE.MeshLambertMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.08 });
    planeAt(scene, mat, b.p, b.yaw, b.w, b.h, 0);
    if (b.ropes) {
      // printed on both sides when strung across a street
      planeAt(scene, mat, b.p, b.yaw + Math.PI, b.w, b.h, 0.01);
      const g = new THREE.BufferGeometry();
      const [x, y, z] = b.p;
      const half = b.w / 2, c = Math.cos(b.yaw), s = Math.sin(b.yaw);
      const L = [x - c * half, y + b.h / 2, z + s * half], R = [x + c * half, y + b.h / 2, z - s * half];
      const [a0, a1] = b.ropes;
      const near = (p, q) => Math.hypot(p[0] - q[0], p[2] - q[2]);
      const [ra, rb] = near(L, a0) < near(L, a1) ? [a0, a1] : [a1, a0];
      g.setAttribute('position', new THREE.Float32BufferAttribute([...L, ...ra, ...R, ...rb], 3));
      scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x222222 })));
    }
  }
  // ---- Maa Kamakhya: sanctum and gate ----
  const K = A.kamakhya;
  for (const key of ['kamakhyaIdol', 'kamakhyaGate']) {
    const s = W.special[key];
    if (!s || !K) continue;
    const w = K.aspect >= 1 ? s.w : s.h * K.aspect, h = K.aspect >= 1 ? s.w / K.aspect : s.h;
    const mat = new THREE.MeshBasicMaterial({ map: K.texture, toneMapped: false, color: key === 'kamakhyaIdol' ? 0xffe8d0 : 0xffffff });
    planeAt(scene, mat, s.F.world(s.x, s.y, s.z), s.F.yaw + s.faceYaw, w, h, 0.02);
  }
  // (Shivji is no longer shown in the temple courtyard: he appears only in the hidden Shivdham, see secret.js)
  return out;
}

export function animateDisplays(D, t) {
  if (D.halo) {
    const k = 1 + Math.sin(t * 0.9) * 0.035;
    D.halo.scale.setScalar(k);
    D.halo.material.opacity = 0.5 + Math.sin(t * 0.6) * 0.05;
    D.bloom.material.opacity = 0.3 + Math.sin(t * 1.3 + 1) * 0.03;
    D.beam.material.opacity = 0.065 + Math.sin(t * 0.4) * 0.01;
  }
}
