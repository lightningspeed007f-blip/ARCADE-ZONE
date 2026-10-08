// Places the user's images in the world: photo frames, flex banners,
// the Maa Kamakhya images and the illuminated Shivji display.
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
  // ---- Shivji: illuminated display ----
  const S = W.special.shiv, SH = A.shivji;
  if (S && SH) {
    const yaw = S.F.yaw + S.faceYaw;
    const h = S.h, w = Math.min(4.6, h * SH.aspect);
    const hh = w / SH.aspect; // keep the image's real proportions
    const base = S.F.world(S.x, S.y + hh / 2 + 0.05, S.z);
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    // halo behind the figure
    const haloMat = new THREE.MeshBasicMaterial({ map: tex.halo, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: 0xffe6c0, opacity: 0.55 });
    const halo = planeAt(scene, haloMat, [base[0] - fx * 0.12, base[1] + hh * 0.08, base[2] - fz * 0.12], yaw, Math.max(w, hh) * 1.25, Math.max(w, hh) * 1.25);
    halo.renderOrder = 1;
    // soft bloom: blurred copy of the figure, additive, slightly larger
    const bloomMat = new THREE.MeshBasicMaterial({ map: SH.glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: 0x9fc4ff, opacity: 0.32 });
    const bloom = planeAt(scene, bloomMat, [base[0] - fx * 0.06, base[1], base[2] - fz * 0.06], yaw, w * 1.12, hh * 1.12);
    bloom.renderOrder = 2;
    // the figure itself: unlit so it reads as self-illuminated, alpha keeps its silhouette
    const figMat = new THREE.MeshBasicMaterial({ map: SH.texture, transparent: true, alphaTest: 0.02, toneMapped: false, color: 0xf4f6ff, depthWrite: true });
    const fig = planeAt(scene, figMat, base, yaw, w, hh, 0);
    fig.renderOrder = 3;
    // faint volumetric beam from above
    const beamMat = new THREE.MeshBasicMaterial({ map: tex.beam, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0.07, color: 0xcfe0ff, toneMapped: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.2, Math.max(w, 1.6) * 0.55, hh + 1.6, 20, 1, true), beamMat);
    beam.position.set(base[0] + fx * 0.5, base[1] + 0.6, base[2] + fz * 0.5);
    scene.add(beam);
    // light spill on the courtyard (handled by the light pool as a major light)
    W.lights.push({ x: base[0] + fx * 1.8, y: base[1] + 0.5, z: base[2] + fz * 1.8, color: 0xcfe0ff, intensity: 9, dist: 14, major: true, shiv: true });
    out.halo = halo; out.bloom = bloom; out.beam = beam;
    out.shivPos = base;
  }
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
