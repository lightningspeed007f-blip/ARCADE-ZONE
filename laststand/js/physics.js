// Lightweight collision world: oriented boxes (rotated only around Y),
// stored in a uniform XZ grid. Used for the player, enemies and bullets.

const CELL = 4;

export class Physics {
  constructor(minX, minZ, maxX, maxZ) {
    this.minX = minX; this.minZ = minZ;
    this.nx = Math.ceil((maxX - minX) / CELL); this.nz = Math.ceil((maxZ - minZ) / CELL);
    this.cells = new Array(this.nx * this.nz);
    this.boxes = [];
    this.stamp = 1;
  }

  // Box centred at (cx, cy, cz), half sizes hx, hy, hz, rotated by yaw around Y.
  add(cx, cy, cz, hx, hy, hz, yaw = 0, tag = null) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const ex = Math.abs(c) * hx + Math.abs(s) * hz, ez = Math.abs(s) * hx + Math.abs(c) * hz;
    const b = {
      cx, cy, cz, hx, hy, hz, c, s,
      minX: cx - ex, maxX: cx + ex, minZ: cz - ez, maxZ: cz + ez,
      minY: cy - hy, maxY: cy + hy, enabled: true, tag, mark: 0,
    };
    this.boxes.push(b);
    this._insert(b);
    return b;
  }

  _insert(b) {
    const x0 = this._cx(b.minX), x1 = this._cx(b.maxX), z0 = this._cz(b.minZ), z1 = this._cz(b.maxZ);
    for (let i = x0; i <= x1; i++) for (let k = z0; k <= z1; k++) {
      const id = k * this.nx + i;
      (this.cells[id] || (this.cells[id] = [])).push(b);
    }
  }
  _remove(b) {
    const x0 = this._cx(b.minX), x1 = this._cx(b.maxX), z0 = this._cz(b.minZ), z1 = this._cz(b.maxZ);
    for (let i = x0; i <= x1; i++) for (let k = z0; k <= z1; k++) {
      const list = this.cells[k * this.nx + i];
      if (!list) continue;
      const j = list.indexOf(b);
      if (j >= 0) list.splice(j, 1);
    }
  }

  // Move an existing box (vehicles, the shrine crate). Only a few boxes ever move, so a remove +
  // re-insert in the grid is cheap enough.
  update(b, cx, cy, cz, yaw = 0) {
    this._remove(b);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const ex = Math.abs(c) * b.hx + Math.abs(s) * b.hz, ez = Math.abs(s) * b.hx + Math.abs(c) * b.hz;
    b.cx = cx; b.cy = cy; b.cz = cz; b.c = c; b.s = s;
    b.minX = cx - ex; b.maxX = cx + ex; b.minZ = cz - ez; b.maxZ = cz + ez; b.minY = cy - b.hy; b.maxY = cy + b.hy;
    this._insert(b);
    return b;
  }

  _cx(x) { return Math.max(0, Math.min(this.nx - 1, Math.floor((x - this.minX) / CELL))); }
  _cz(z) { return Math.max(0, Math.min(this.nz - 1, Math.floor((z - this.minZ) / CELL))); }

  query(minX, minZ, maxX, maxZ, out) {
    out.length = 0;
    const st = ++this.stamp;
    const x0 = this._cx(minX), x1 = this._cx(maxX), z0 = this._cz(minZ), z1 = this._cz(maxZ);
    for (let i = x0; i <= x1; i++) for (let k = z0; k <= z1; k++) {
      const list = this.cells[k * this.nx + i];
      if (!list) continue;
      for (let j = 0; j < list.length; j++) {
        const b = list[j];
        if (b.mark === st || !b.enabled) continue;
        b.mark = st;
        if (b.maxX < minX || b.minX > maxX || b.maxZ < minZ || b.minZ > maxZ) continue;
        out.push(b);
      }
    }
    return out;
  }

  // Push a circle (x,z,r) out of one box. Returns [dx, dz] or null.
  static circlePush(b, x, z, r) {
    const lx0 = x - b.cx, lz0 = z - b.cz;
    const lx = lx0 * b.c - lz0 * b.s, lz = lx0 * b.s + lz0 * b.c;
    const qx = Math.max(-b.hx, Math.min(b.hx, lx)), qz = Math.max(-b.hz, Math.min(b.hz, lz));
    let dx = lx - qx, dz = lz - qz;
    const d2 = dx * dx + dz * dz;
    if (d2 > r * r) return null;
    let px, pz;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2), k = (r - d) / d;
      px = dx * k; pz = dz * k;
    } else {
      // centre inside: push out along the shallowest axis
      const ox = b.hx - Math.abs(lx), oz = b.hz - Math.abs(lz);
      if (ox < oz) { px = (lx >= 0 ? 1 : -1) * (ox + r); pz = 0; } else { pz = (lz >= 0 ? 1 : -1) * (oz + r); px = 0; }
    }
    // back to world
    return [px * b.c + pz * b.s, -px * b.s + pz * b.c];
  }

  static circleOverlaps(b, x, z, r) {
    const lx0 = x - b.cx, lz0 = z - b.cz;
    const lx = lx0 * b.c - lz0 * b.s, lz = lx0 * b.s + lz0 * b.c;
    const qx = Math.max(-b.hx, Math.min(b.hx, lx)), qz = Math.max(-b.hz, Math.min(b.hz, lz));
    const dx = lx - qx, dz = lz - qz;
    return dx * dx + dz * dz < r * r;
  }

  // Highest walkable surface under (x,z) not higher than maxY.
  groundAt(x, z, r, maxY) {
    const list = this.query(x - r, z - r, x + r, z + r, this._tmp || (this._tmp = []));
    let g = 0;
    // inside a hole (stairwell, tunnel) only real floors hold you up
    if (this.holes) for (const h of this.holes) if (x > h.x0 && x < h.x1 && z > h.z0 && z < h.z1 && maxY - 0.45 < h.maxY) { g = -1e9; break; }
    for (const b of list) {
      if (b.maxY > maxY || b.maxY <= g) continue;
      if (Physics.circleOverlaps(b, x, z, r)) g = b.maxY;
    }
    return g;
  }

  // Move a vertical cylinder. pos = feet position {x,y,z}; mutates pos.
  // Returns true when standing on something.
  moveCharacter(pos, dx, dz, vy, dt, r, h, step, state) {
    const len = Math.sqrt(dx * dx + dz * dz);
    const n = Math.max(1, Math.ceil(len / (r * 0.7)));
    const sx = dx / n, sz = dz / n;
    const tmp = this._tmp2 || (this._tmp2 = []);
    for (let i = 0; i < n; i++) {
      pos.x += sx; pos.z += sz;
      for (let it = 0; it < 3; it++) {
        const list = this.query(pos.x - r, pos.z - r, pos.x + r, pos.z + r, tmp);
        let moved = false;
        for (const b of list) {
          if (b.maxY <= pos.y + step || b.minY >= pos.y + h) continue;
          const p = Physics.circlePush(b, pos.x, pos.z, r);
          if (p) { pos.x += p[0]; pos.z += p[1]; moved = true; }
        }
        if (!moved) break;
      }
    }
    // vertical
    const ground = this.groundAt(pos.x, pos.z, r * 0.6, pos.y + step);
    state.vy = vy - 22 * dt;
    let ny = pos.y + state.vy * dt;
    if (state.vy > 0) {
      // ceiling
      const list = this.query(pos.x - r, pos.z - r, pos.x + r, pos.z + r, tmp);
      for (const b of list) {
        if (b.minY >= pos.y + h - 0.01 && b.minY < ny + h && Physics.circleOverlaps(b, pos.x, pos.z, r * 0.6)) { ny = b.minY - h; state.vy = 0; }
      }
    }
    if (ny <= ground) {
      state.fall = Math.max(0, (state.peak ?? pos.y) - ground);
      pos.y = ground; state.vy = 0; state.peak = ground;
      return true;
    }
    state.peak = Math.max(state.peak ?? pos.y, ny);
    pos.y = ny;
    return false;
  }

  // Ray against all boxes. Returns {t, nx, ny, nz, box} or null.
  raycast(ox, oy, oz, dx, dy, dz, maxT, ignoreTag) {
    // DDA over grid cells in XZ
    let best = maxT, hit = null;
    const st = ++this.stamp;
    let cx = Math.floor((ox - this.minX) / CELL), cz = Math.floor((oz - this.minZ) / CELL);
    const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tdx = Math.abs(dx) > 1e-9 ? CELL / Math.abs(dx) : Infinity;
    const tdz = Math.abs(dz) > 1e-9 ? CELL / Math.abs(dz) : Infinity;
    let tmx = Math.abs(dx) > 1e-9 ? ((dx > 0 ? (cx + 1) * CELL : cx * CELL) + this.minX - ox) / dx : Infinity;
    let tmz = Math.abs(dz) > 1e-9 ? ((dz > 0 ? (cz + 1) * CELL : cz * CELL) + this.minZ - oz) / dz : Infinity;
    let tEnter = 0;
    for (let guard = 0; guard < 400; guard++) {
      if (cx >= 0 && cz >= 0 && cx < this.nx && cz < this.nz) {
        const list = this.cells[cz * this.nx + cx];
        if (list) for (const b of list) {
          if (b.mark === st || !b.enabled) continue;
          b.mark = st;
          if (ignoreTag && b.tag === ignoreTag) continue;
          const r = rayBox(b, ox, oy, oz, dx, dy, dz, best);
          if (r) { best = r.t; hit = r; hit.box = b; }
        }
      } else if ((stepX > 0 && cx >= this.nx) || (stepX < 0 && cx < 0) || (stepZ > 0 && cz >= this.nz) || (stepZ < 0 && cz < 0)) break;
      if (tmx < tmz) { tEnter = tmx; tmx += tdx; cx += stepX; } else { tEnter = tmz; tmz += tdz; cz += stepZ; }
      if (tEnter > best) break;
    }
    return hit;
  }
}

function rayBox(b, ox, oy, oz, dx, dy, dz, maxT) {
  // to local frame
  const lx0 = ox - b.cx, lz0 = oz - b.cz;
  const lox = lx0 * b.c - lz0 * b.s, loz = lx0 * b.s + lz0 * b.c, loy = oy - b.cy;
  const ldx = dx * b.c - dz * b.s, ldz = dx * b.s + dz * b.c, ldy = dy;
  let tmin = 0, tmax = maxT, axis = -1, sign = 0;
  const o = [lox, loy, loz], d = [ldx, ldy, ldz], h = [b.hx, b.hy, b.hz];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) { if (o[i] < -h[i] || o[i] > h[i]) return null; continue; }
    const inv = 1 / d[i];
    let t1 = (-h[i] - o[i]) * inv, t2 = (h[i] - o[i]) * inv, s = -1;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; s = 1; }
    if (t1 > tmin) { tmin = t1; axis = i; sign = s; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (axis < 0) return null; // started inside
  let nx = 0, ny = 0, nz = 0;
  if (axis === 0) nx = sign; else if (axis === 1) ny = sign; else nz = sign;
  // local normal back to world
  const wx = nx * b.c + nz * b.s, wz = -nx * b.s + nz * b.c;
  return { t: tmin, nx: wx, ny, nz: wz };
}
