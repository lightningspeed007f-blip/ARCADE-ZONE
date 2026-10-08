// A fixed pool of real point lights is moved to the light sources nearest
// the camera every few frames. Far lamps keep their glow sprite and ground
// pool, so the town looks lit while the GPU only shades a handful of lights.
import * as THREE from 'three';

export class LightPool {
  constructor(scene, sources, n) {
    this.sources = sources;
    this.pool = [];
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 10, 1.4);
      l.userData.src = null;
      scene.add(l);
      this.pool.push(l);
    }
    this.t = 0;
    this.blackout = 0;
    for (const s of sources) { s.phase = Math.random() * 100; s.on = true; }
  }

  update(dt, cam, time) {
    this.t -= dt;
    const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
    if (this.t <= 0) {
      this.t = 0.3;
      const scored = [];
      for (const s of this.sources) {
        if (!s.on) continue;
        const d = Math.hypot(s.x - cx, s.y - cy, s.z - cz);
        if (s.interior && d > 16) continue;
        if (d > s.dist + 45) continue;
        scored.push([d - (s.major ? 25 : 0) - (s.mast ? 40 : 0), s]);
      }
      scored.sort((a, b) => a[0] - b[0]);
      const chosen = scored.slice(0, this.pool.length).map((x) => x[1]);
      // keep lights that stay chosen on the same slot (no popping)
      const free = [];
      for (const l of this.pool) {
        const i = chosen.indexOf(l.userData.src);
        if (i >= 0) chosen.splice(i, 1); else free.push(l);
      }
      for (const l of free) {
        const s = chosen.shift();
        l.userData.src = s || null;
        l.userData.fade = 0;
        if (s) { l.position.set(s.x, s.y, s.z); l.color.setHex(s.color); l.distance = s.dist; }
      }
    }
    for (const l of this.pool) {
      const s = l.userData.src;
      if (!s) { l.intensity = Math.max(0, l.intensity - dt * 20); continue; }
      if (s.dynamic) l.position.set(s.x, s.y, s.z);
      l.userData.fade = Math.min(1, (l.userData.fade || 0) + dt * 3);
      let k = 1;
      if (s.flicker) {
        const f = Math.sin(time * 13 + s.phase) + Math.sin(time * 31 + s.phase * 2) + Math.sin(time * 3.1 + s.phase);
        k = f > 1.6 ? 0.15 : f < -2.2 ? 0.4 : 0.92 + Math.random() * 0.08;
        s.k = k;
      }
      l.intensity = s.intensity * k * l.userData.fade * (s.on ? 1 : 0);
    }
  }
}
