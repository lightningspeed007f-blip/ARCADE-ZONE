// Static geometry batching. Everything that never moves is written into a
// few big meshes per material and per map chunk, so the whole town costs
// only a few dozen draw calls and still gets frustum culled.
import * as THREE from 'three';

class Acc {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; this.n = 0; }
}

export class Builder {
  constructor(physics, chunk = 48) {
    this.physics = physics;
    this.chunk = chunk;
    this.accs = new Map(); // key mat|cx|cz -> Acc
  }

  acc(mat, x, z) {
    const cx = Math.floor(x / this.chunk), cz = Math.floor(z / this.chunk);
    const key = mat + '|' + cx + '|' + cz;
    let a = this.accs.get(key);
    if (!a) { a = new Acc(); a.mat = mat; this.accs.set(key, a); }
    return a;
  }

  // p0..p3 world points [x,y,z], n desired normal, uvs [[u,v]x4], color [r,g,b]
  quad(mat, p0, p1, p2, p3, n, uvs, color, ref) {
    // winding check
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
    const bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
    const cxn = ay * bz - az * by, cyn = az * bx - ax * bz, czn = ax * by - ay * bx;
    const flip = cxn * n[0] + cyn * n[1] + czn * n[2] < 0;
    const a = this.acc(mat, ref ? ref[0] : (p0[0] + p2[0]) / 2, ref ? ref[1] : (p0[2] + p2[2]) / 2);
    const base = a.n;
    const ps = [p0, p1, p2, p3];
    for (let i = 0; i < 4; i++) {
      a.pos.push(ps[i][0], ps[i][1], ps[i][2]);
      a.nor.push(n[0], n[1], n[2]);
      a.uv.push(uvs[i][0], uvs[i][1]);
      const c = color.length === 4 ? color[i] : color;
      a.col.push(c[0], c[1], c[2]);
    }
    if (flip) a.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    else a.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    a.n += 4;
  }

  // Oriented box. opts: collide (true), uv (metres per texture repeat), skip ['top','bottom',...], tag, shadeSides
  box(mat, cx, cy, cz, sx, sy, sz, yaw, color, opts = {}) {
    if (Array.isArray(yaw)) { opts = color || {}; color = yaw; yaw = 0; } // yaw may be omitted
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const W = (lx, ly, lz) => [cx + lx * c + lz * s, cy + ly, cz - lx * s + lz * c];
    const N = (lx, ly, lz) => [lx * c + lz * s, ly, -lx * s + lz * c];
    const us = 1 / (opts.uv || 2);
    const skip = opts.skip || [];
    const ox = opts.uvOff ? opts.uvOff[0] : (cx + cz) * 0.37, oy = opts.uvOff ? opts.uvOff[1] : 0;
    const ref = [cx, cz];
    const sh = opts.flat ? 1 : 0.86; // a touch darker on sides => readable shapes at night
    const sc = [color[0] * sh, color[1] * sh, color[2] * sh];
    const face = (name, n, corners, uvf, col) => {
      if (skip.includes(name)) return;
      this.quad(mat, ...corners.map((p) => W(...p)), N(...n), corners.map(uvf), col, ref);
    };
    face('top', [0, 1, 0], [[-hx, hy, -hz], [hx, hy, -hz], [hx, hy, hz], [-hx, hy, hz]], (p) => [(p[0] + ox) * us, (p[2] + oy) * us], color);
    face('bottom', [0, -1, 0], [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]], (p) => [(p[0] + ox) * us, (p[2]) * us], sc);
    face('px', [1, 0, 0], [[hx, -hy, -hz], [hx, -hy, hz], [hx, hy, hz], [hx, hy, -hz]], (p) => [(p[2] + ox) * us, (p[1] + cy + oy) * us], sc);
    face('nx', [-1, 0, 0], [[-hx, -hy, hz], [-hx, -hy, -hz], [-hx, hy, -hz], [-hx, hy, hz]], (p) => [(-p[2] + ox) * us, (p[1] + cy + oy) * us], sc);
    face('pz', [0, 0, 1], [[hx, -hy, hz], [-hx, -hy, hz], [-hx, hy, hz], [hx, hy, hz]], (p) => [(-p[0] + ox) * us, (p[1] + cy + oy) * us], color);
    face('nz', [0, 0, -1], [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz]], (p) => [(p[0] + ox) * us, (p[1] + cy + oy) * us], color);
    if (opts.collide !== false) return this.physics.add(cx, cy, cz, hx, hy, hz, yaw, opts.tag || null);
    return null;
  }

  // Vertical cylinder approximated with n sides (no collider unless asked).
  cylinder(mat, x, y0, z, r, h, color, sides = 10, opts = {}) {
    const us = 1 / (opts.uv || 2);
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2;
      const p0 = [x + Math.cos(a0) * r, y0, z + Math.sin(a0) * r], p1 = [x + Math.cos(a1) * r, y0, z + Math.sin(a1) * r];
      const am = (a0 + a1) / 2;
      const u0 = (a0 * r) * us, u1 = (a1 * r) * us;
      this.quad(mat, p0, p1, [p1[0], y0 + h, p1[2]], [p0[0], y0 + h, p0[2]], [Math.cos(am), 0, Math.sin(am)],
        [[u0, y0 * us], [u1, y0 * us], [u1, (y0 + h) * us], [u0, (y0 + h) * us]], color, [x, z]);
      if (opts.cap !== false) {
        const top = [x, y0 + h, z];
        this.quad(mat, [p0[0], y0 + h, p0[2]], [p1[0], y0 + h, p1[2]], top, top, [0, 1, 0],
          [[0, 0], [0.1, 0], [0.05, 0.05], [0.05, 0.05]], color, [x, z]);
      }
    }
    if (opts.collide) this.physics.add(x, y0 + h / 2, z, r * 0.9, h / 2, r * 0.9, 0, opts.tag || null);
  }

  // A flat quad lying on the ground, rotated, with UVs continuous in world space.
  ground(mat, cx, cz, sx, sz, yaw, y, color, uvScale = 4, uvRot = false) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const hx = sx / 2, hz = sz / 2;
    const W = (lx, lz) => [cx + lx * c + lz * s, y, cz - lx * s + lz * c];
    const us = 1 / uvScale;
    const ox = cx * c - cz * s, oz = cx * s + cz * c;
    const uvOf = (p) => (uvRot ? [(p[1] + oz) * us, (p[0] + ox) * us] : [(p[0] + ox) * us, (p[1] + oz) * us]);
    // long strips are cut into chunk sized pieces so culling still works
    const n = Math.max(1, Math.ceil(Math.max(sx, sz) / this.chunk));
    for (let i = 0; i < n; i++) {
      const t0 = i / n - 0.5, t1 = (i + 1) / n - 0.5;
      let pts;
      if (sx >= sz) pts = [[t0 * sx, -hz], [t1 * sx, -hz], [t1 * sx, hz], [t0 * sx, hz]];
      else pts = [[-hx, t0 * sz], [hx, t0 * sz], [hx, t1 * sz], [-hx, t1 * sz]];
      const w = pts.map((p) => W(...p));
      this.quad(mat, w[0], w[1], w[2], w[3], [0, 1, 0], pts.map(uvOf), color, [(w[0][0] + w[2][0]) / 2, (w[0][2] + w[2][2]) / 2]);
    }
  }

  build(scene, materials) {
    const meshes = [];
    for (const a of this.accs.values()) {
      if (!a.n) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(a.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(a.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(a.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(a.col, 3));
      g.setIndex(a.n > 65000 ? new THREE.Uint32BufferAttribute(a.idx, 1) : new THREE.Uint16BufferAttribute(a.idx, 1));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, materials[a.mat]);
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      scene.add(m);
      meshes.push(m);
    }
    this.accs.clear();
    return meshes;
  }
}
