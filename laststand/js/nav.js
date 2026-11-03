// Ground-level navigation: a 1 m walkability grid rasterised from the
// collision boxes, plus a flow field (BFS) toward the player that every
// chasing enemy can follow for free.
import { BOUNDS } from './layout.js';

export class Nav {
  constructor(physics) {
    const cs = this.cs = 0.5;
    this.x0 = BOUNDS.minX; this.z0 = BOUNDS.minZ;
    this.w = Math.ceil((BOUNDS.maxX - BOUNDS.minX) / cs); this.h = Math.ceil((BOUNDS.maxZ - BOUNDS.minZ) / cs);
    this.grid = new Uint8Array(this.w * this.h); // 0 free, 1 blocked, 2 door
    for (const b of physics.boxes) {
      if (b.maxY < 0.42 || b.minY > 1.5 || b.tag === 'slab') continue;   // slab: a raised floor or step in a model house
      const door = b.tag === 'door';
      const pad = 0.2;
      const x0 = Math.floor((b.minX - pad - this.x0) / cs), x1 = Math.ceil((b.maxX + pad - this.x0) / cs);
      const z0 = Math.floor((b.minZ - pad - this.z0) / cs), z1 = Math.ceil((b.maxZ + pad - this.z0) / cs);
      for (let gx = Math.max(0, x0); gx <= Math.min(this.w - 1, x1); gx++) for (let gz = Math.max(0, z0); gz <= Math.min(this.h - 1, z1); gz++) {
        const px = this.x0 + (gx + 0.5) * cs, pz = this.z0 + (gz + 0.5) * cs;
        const lx0 = px - b.cx, lz0 = pz - b.cz;
        const lx = lx0 * b.c - lz0 * b.s, lz = lx0 * b.s + lz0 * b.c;
        if (Math.abs(lx) <= b.hx + pad && Math.abs(lz) <= b.hz + pad) {
          const i = gz * this.w + gx;
          if (door) { if (this.grid[i] !== 1) this.grid[i] = 2; } else this.grid[i] = 1;
        }
      }
    }
    // door cells must stay passable even where the wall padding overlapped them
    for (const b of physics.boxes) if (b.tag === 'door') {
      // walk along the door leaf and through the wall thickness
      for (let a = -b.hx; a <= b.hx; a += cs * 0.5) for (let t = -0.4; t <= 0.4; t += cs * 0.5) {
        const px = b.cx + a * b.c + t * b.s, pz = b.cz - a * b.s + t * b.c;
        const gx = Math.floor((px - this.x0) / cs), gz = Math.floor((pz - this.z0) / cs);
        if (gx >= 0 && gz >= 0 && gx < this.w && gz < this.h && Math.abs(a) < b.hx - 0.15) this.grid[gz * this.w + gx] = 2;
      }
    }
    // flow field window
    this.F = 280; this.dist = new Uint16Array(this.F * this.F); this.queue = new Int32Array(this.F * this.F);
    this.fx0 = 0; this.fz0 = 0; this.valid = false;
    // the next field is grown a slice per frame in a second buffer and swapped in when finished (see request/step)
    this.back = new Uint16Array(this.F * this.F); this.job = null; this.lastX = 1e9; this.lastZ = 1e9; this.age = 0;
  }

  cell(x, z) { return [Math.floor((x - this.x0) / this.cs), Math.floor((z - this.z0) / this.cs)]; }
  free(x, z) {
    const [gx, gz] = this.cell(x, z);
    if (gx < 0 || gz < 0 || gx >= this.w || gz >= this.h) return false;
    return this.grid[gz * this.w + gx] !== 1;
  }

  // BFS from target over a window centred on it, all at once (a place's first field, so nobody stands without one).
  build(tx, tz) {
    this.job = null;
    this._begin(tx, tz, this.dist);
    this._run(this.job, Infinity);
    this._finish();
  }

  // Ask for a fresh field around (tx, tz). The BFS is the one big recurring cost of the AI (tens of thousands of
  // cells), so it is spread over several frames instead of landing on one: step() advances it a little each frame.
  // Not rebuilt while the player stands still (the grid never changes).
  request(tx, tz, dt) {
    this.age += dt;
    if (!this.valid) return this.build(tx, tz);
    if (this.job) return;
    if (Math.abs(tx - this.lastX) + Math.abs(tz - this.lastZ) < 0.7 && this.age < 4) return;
    this.age = 0; this.lastX = tx; this.lastZ = tz;
    this._begin(tx, tz, this.back);
  }
  step(budget = 5000) {
    const j = this.job;
    if (!j || j.out !== this.back) return;
    if (this._run(j, budget)) this._finish();
  }

  _begin(tx, tz, out) {
    const F = this.F, half = F >> 1;
    const [cx, cz] = this.cell(tx, tz);
    out.fill(65535);
    this.job = { out, fx0: cx - half, fz0: cz - half, head: 0, tail: 0 };
    const j = this.job, i = half * F + half;
    out[i] = 0; this.queue[j.tail++] = i;
  }

  // advance the BFS by up to `budget` cells; true when it has finished
  _run(j, budget) {
    const F = this.F, dist = j.out, queue = this.queue, grid = this.grid, W = this.w, H = this.h, fx0 = j.fx0, fz0 = j.fz0;
    let head = j.head, tail = j.tail, n = 0;
    while (head < tail && n++ < budget) {
      const i = queue[head++];
      const lx = i % F, lz = (i / F) | 0, d = dist[i];
      for (let k = 0; k < 4; k++) {
        const nx = lx + (k === 0 ? 1 : k === 1 ? -1 : 0), nz = lz + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (nx < 0 || nz < 0 || nx >= F || nz >= F) continue;
        const gx = fx0 + nx, gz = fz0 + nz;
        if (gx < 0 || gz < 0 || gx >= W || gz >= H) continue;
        const g = grid[gz * W + gx];
        if (g === 1) continue;
        const ni = nz * F + nx;
        if (dist[ni] !== 65535) continue;
        dist[ni] = d + (g === 2 ? 3 : 1);
        queue[tail++] = ni;
      }
    }
    j.head = head; j.tail = tail;
    return head >= tail;
  }

  _finish() {
    const j = this.job; this.job = null;
    if (j.out === this.back) { this.back = this.dist; this.dist = j.out; }
    this.fx0 = j.fx0; this.fz0 = j.fz0;
    this.valid = true;
  }

  // Direction to step from (x,z) following the flow field, or null if outside / unreachable.
  flow(x, z) {
    if (!this.valid) return null;
    const F = this.F;
    const c = this.cell(x, z), gx = c[0] - this.fx0, gz = c[1] - this.fz0;
    if (gx < 1 || gz < 1 || gx >= F - 1 || gz >= F - 1) return null;
    const here = this.dist[gz * F + gx];
    let best = here, bx = 0, bz = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const d = this.dist[(gz + dz) * F + gx + dx];
      // no diagonal corner cutting
      if (dx && dz && (this.dist[gz * F + gx + dx] === 65535 || this.dist[(gz + dz) * F + gx] === 65535)) continue;
      const dd = d + (dx && dz ? 0.4 : 0);
      if (dd < best) { best = dd; bx = dx; bz = dz; }
    }
    if (here === 65535 && best === 65535) return null;
    if (!bx && !bz) return null;
    const l = Math.hypot(bx, bz);
    // aim at the centre of the next cell to stay off walls
    const tx = this.x0 + (this.fx0 + gx + bx + 0.5) * this.cs, tz = this.z0 + (this.fz0 + gz + bz + 0.5) * this.cs;
    const ddx = tx - x, ddz = tz - z, dl = Math.hypot(ddx, ddz) || 1;
    return [(ddx / dl + bx / l) / 2, (ddz / dl + bz / l) / 2, here];
  }
}
