// Collision bake for a game-ready house: voxelise (0.1 m x 0.05 m), runs per column, greedy-merge into boxes.
// Also a walk map: flood-fill from outside with the player's step (0.45 m), height (1.7 m) and radius (0.3 m).
// usage: node bake.mjs <name>  -> out/<name>.bake.json and out/walk_<name>.png
import fs from 'fs'; import sharp from 'sharp';
import { triangles } from './tris.mjs';
import { CONFIG } from './config.mjs';
const name = process.argv[2], C = CONFIG[name], OUT = process.env.OUT || './out';
const T = await triangles(`${OUT}/${name}.glb`, 1);
const cs = 0.1, vy = 0.05, STEP = 0.45, HEAD = 1.7;
let mnx = 1e9, mnz = 1e9, mxx = -1e9, mxz = -1e9, mxy = 0;
for (let i = 0; i < T.length; i += 3) { mnx = Math.min(mnx, T[i]); mxx = Math.max(mxx, T[i]); mxy = Math.max(mxy, T[i + 1]); mnz = Math.min(mnz, T[i + 2]); mxz = Math.max(mxz, T[i + 2]); }
const M = 1.5, X0 = Math.floor((mnx - M) * 10) / 10, Z0 = Math.floor((mnz - M) * 10) / 10;
const nx = Math.ceil((mxx + M - X0) / cs), nz = Math.ceil((mxz + M - Z0) / cs), ny = Math.ceil((mxy + 0.5) / vy) + 1;
const vox = new Uint8Array(nx * nz * ny);
const V = (gx, gz, gy) => (gz * nx + gx) * ny + gy;
const mark = (x, y, z) => { const gx = Math.floor((x - X0) / cs), gz = Math.floor((z - Z0) / cs), gy = Math.floor(y / vy); if (gx < 0 || gz < 0 || gx >= nx || gz >= nz || gy < 0 || gy >= ny) return; vox[V(gx, gz, gy)] = 1; };
const skipTri = C.noCollide || (() => false);
for (let i = 0; i < T.length; i += 9) {
  const a = T.subarray(i, i + 3), b = T.subarray(i + 3, i + 6), c = T.subarray(i + 6, i + 9);
  if (skipTri([a, b, c])) continue;
  const L = Math.max(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]), Math.hypot(b[0] - c[0], b[1] - c[1], b[2] - c[2]));
  const n = Math.max(1, Math.ceil(L / 0.035));
  for (let u = 0; u <= n; u++) for (let v = 0; v <= n - u; v++) { const w = n - u - v; mark((a[0] * u + b[0] * v + c[0] * w) / n, (a[1] * u + b[1] * v + c[1] * w) / n, (a[2] * u + b[2] * v + c[2] * w) / n); }
}
// extra solid volumes: the added floors, and steps up to a raised door: [x0,z0,x1,z1,y0,y1]
const solids = [...(C.solids || []), ...(C.floors || []).map((f) => [f[0], f[1], f[2], f[3], f[4] - 0.2, f[4]])];
const steps = [];
for (const d of C.doors || []) {
  if (d.inner || !(d.y > 0.3)) continue;
  const n = Math.ceil(d.y / 0.25), rise = d.y / n, hw = d.w / 2 + 0.25;
  for (let i = 0; i < n; i++) {      // i = 0: the landing at the threshold, right outside the door
    const a0 = i ? 0.77 + (i - 1) * 0.32 : 0.15, a1 = 0.77 + i * 0.32, top = d.y - i * rise;
    const o0 = d.out * a0, o1 = d.out * a1, lo = Math.min(o0, o1), hi = Math.max(o0, o1);
    const box = d.along === 'x' ? [d.x - hw, d.z + lo, d.x + hw, d.z + hi, Math.max(0, top - 0.2), top] : [d.x + lo, d.z - hw, d.x + hi, d.z + hw, Math.max(0, top - 0.2), top];
    solids.push(box); steps.push(box);
  }
}
for (const f of solids) for (let x = f[0]; x < f[2]; x += cs * 0.5) for (let z = f[1]; z < f[3]; z += cs * 0.5) for (let y = f[4]; y <= f[5]; y += vy * 0.5) mark(x, y, z);
// doorways: clear the voxels (a little wider than the panel so the frame's inner edge doesn't snag)
for (const d of C.doors || []) {
  for (let gx = 0; gx < nx; gx++) for (let gz = 0; gz < nz; gz++) {
    const x = X0 + (gx + 0.5) * cs, z = Z0 + (gz + 0.5) * cs;
    const al = d.along === 'x' ? x - d.x : z - d.z, ac = d.along === 'x' ? z - d.z : x - d.x;
    if (Math.abs(al) > d.w / 2 - 0.02 || Math.abs(ac) > (d.depth || 0.3) + 0.05) continue;
    for (let gy = Math.ceil(((d.y || 0) + 0.06) / vy); gy * vy < (d.y || 0) + Math.min(d.h, 2.0); gy++) if (gy < ny) vox[V(gx, gz, gy)] = 0;
  }
}
// runs per column (gaps under 0.25 m close up)
const runs = new Array(nx * nz);
for (let k = 0; k < nx * nz; k++) {
  const gx = k % nx, gz = (k / nx) | 0, r = []; let y0 = -1, last = -10;
  for (let gy = 0; gy < ny; gy++) if (vox[V(gx, gz, gy)]) { if (y0 < 0) y0 = gy; else if (gy - last > 5) { r.push([y0 * vy, (last + 1) * vy]); y0 = gy; } last = gy; }
  if (y0 >= 0) r.push([y0 * vy, (last + 1) * vy]);
  const roof = 2.6;    // nothing upstairs is reachable: the colliders stop at head height (+ a margin for jumps)
  runs[k] = r.filter((q) => q[1] > 0.12 && q[0] < roof).map((q) => q[1] >= 2.3 && q[0] <= 0.35 ? [0.05, roof + 0.4] : [q[0], Math.min(q[1], roof + 0.4)]);   // full-height walls all alike, so they merge   // ground-flush bits go; the roof is out of reach
}
// ---- walk map ----
const R = 3;   // radius in cells
const stand = (k, h) => { let g = 0; for (const [a, b] of runs[k]) if (b <= h + STEP && b > g) g = b; return g; };
const blockedAt = (gx, gz, g) => { for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) { if (dx * dx + dz * dz > R * R) continue; const x = gx + dx, z = gz + dz; if (x < 0 || z < 0 || x >= nx || z >= nz) continue; for (const [a, b] of runs[z * nx + x]) if (b > g + STEP && a < g + HEAD) return true; } return false; };
const best = new Float32Array(nx * nz).fill(NaN); const reach = [];
const q = [];
for (let gx = 0; gx < nx; gx++) for (const gz of [0, nz - 1]) q.push([gx, gz, 0]);
for (let gz = 0; gz < nz; gz++) for (const gx of [0, nx - 1]) q.push([gx, gz, 0]);
const seen = new Map();
while (q.length) {
  const [gx, gz, h] = q.pop(); const k = gz * nx + gx;
  const g = stand(k, h);
  const key = k * 64 + Math.round(g / 0.25);
  if (seen.has(key)) continue; seen.set(key, 1);
  if (blockedAt(gx, gz, g)) continue;
  if (Number.isNaN(best[k]) || g > best[k]) best[k] = g;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = gx + dx, z = gz + dz; if (x >= 0 && z >= 0 && x < nx && z < nz) q.push([x, z, g]); }
}
if (process.env.TRACE) for (const pt of process.env.TRACE.split(' ')) { const [x, z] = pt.split(',').map(Number); const gx = Math.floor((x - X0) / cs), gz = Math.floor((z - Z0) / cs), k = gz * nx + gx; console.log('trace', pt, 'best', best[k], 'runs', JSON.stringify(runs[k].map((r) => r.map((v) => +v.toFixed(2)))), 'blocked@0.5', blockedAt(gx, gz, 0.5), 'blocked@0.6', blockedAt(gx, gz, 0.6)); }
// ---- boxes: greedy merge of runs with matching (0.1 m-quantised) heights ----
const qz = (v) => Math.round(v * 10) / 10;
const items = runs.map((r) => r.map(([a, b]) => ({ a: qz(a), b: Math.max(qz(b), qz(a) + 0.1), used: false })));
const find = (k, a, b) => items[k].find((it) => !it.used && Math.abs(it.a - a) < 0.15 && Math.abs(it.b - b) < 0.15);
const boxes = [];
for (let gz = 0; gz < nz; gz++) for (let gx = 0; gx < nx; gx++) for (const it of items[gz * nx + gx]) {
  if (it.used) continue; it.used = true; let a = it.a, b = it.b;
  let x1 = gx; while (x1 + 1 < nx) { const o = find(gz * nx + x1 + 1, it.a, it.b); if (!o) break; o.used = true; a = Math.min(a, o.a); b = Math.max(b, o.b); x1++; }
  let z1 = gz;
  for (;;) { if (z1 + 1 >= nz) break; const row = []; let ok = true; for (let x = gx; x <= x1; x++) { const o = find((z1 + 1) * nx + x, it.a, it.b); if (!o) { ok = false; break; } row.push(o); } if (!ok) break; for (const o of row) { o.used = true; a = Math.min(a, o.a); b = Math.max(b, o.b); } z1++; }
  const cx = X0 + (gx + x1 + 1) / 2 * cs, cz = Z0 + (gz + z1 + 1) / 2 * cs;
  const bx = [+cx.toFixed(2), +cz.toFixed(2), +((x1 - gx + 1) * cs / 2).toFixed(2), +((z1 - gz + 1) * cs / 2).toFixed(2), +a.toFixed(2), +b.toFixed(2)];
  if (b - a <= 0.3 && b <= 1.4 && b > 0.4) bx.push(1);
  if (bx[2] * bx[3] * 4 < 0.025 && b - a < 0.6 && b < 0.9) continue;     // a loose plank or a brick: step over it
  boxes.push(bx);
}
// floor spots: reachable cells under a roof (something overhead), clear of walls by 0.6 m, for loot and spawns
const wallAt = (k, g) => runs[k].some(([a, b]) => b > g + 1.2 && a < g + 1.0);
const enclosed = (gx, gz, g) => { let n = 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { for (let s = 1; s < 90; s++) { const x = gx + dx * s, z = gz + dz * s; if (x < 0 || z < 0 || x >= nx || z >= nz) break; if (wallAt(z * nx + x, g)) { n++; break; } } } return n >= 4; };
const roofed = (k, g) => true;
const spots = [];
for (const R6 of [4, 2]) {
  if (spots.length >= 4) break;
  spots.length = 0;
for (let gz = 0; gz < nz; gz += 4) for (let gx = 0; gx < nx; gx += 4) {
  const k = gz * nx + gx, g = best[k]; if (Number.isNaN(g) || !roofed(k, g)) continue;
  let clear = true; for (let dx = -R6; dx <= R6 && clear; dx += 2) for (let dz = -R6; dz <= R6; dz += 2) { const x = gx + dx, z = gz + dz; if (x < 0 || z < 0 || x >= nx || z >= nz || Number.isNaN(best[z * nx + x]) || Math.abs(best[z * nx + x] - g) > 0.1) { clear = false; break; } }
  if (clear && enclosed(gx, gz, g)) spots.push([+(X0 + (gx + 0.5) * cs).toFixed(2), +g.toFixed(2), +(Z0 + (gz + 0.5) * cs).toFixed(2)]);
}
}
// footprint: everything above 0.5 m
let fx0 = 1e9, fx1 = -1e9, fz0 = 1e9, fz1 = -1e9, top = 0;
for (const b of boxes) if (b[5] > 0.5) { fx0 = Math.min(fx0, b[0] - b[2]); fx1 = Math.max(fx1, b[0] + b[2]); fz0 = Math.min(fz0, b[1] - b[3]); fz1 = Math.max(fz1, b[1] + b[3]); top = Math.max(top, b[5]); }
fx0 = mnx; fx1 = mxx; fz0 = mnz; fz1 = mxz; top = mxy;     // footprint and height of what you see
fs.writeFileSync(`${OUT}/${name}.bake.json`, JSON.stringify({ name, foot: [+fx0.toFixed(2), +fz0.toFixed(2), +fx1.toFixed(2), +fz1.toFixed(2)], top: +top.toFixed(2), boxes, spots, doors: C.doors || [], floors: C.floors || [] }));
// picture
const PX = 5, W = nx * PX, H = nz * PX, img = Buffer.alloc(W * H * 3, 255);
for (let k = 0; k < nx * nz; k++) {
  const gx = k % nx, gz = (k / nx) | 0, g = best[k];
  let col;
  if (!Number.isNaN(g)) { const t = Math.min(1, g / 4); col = g < 0.05 ? [235, 225, 200] : [Math.round(120 - 100 * t), Math.round(220 - 60 * t), Math.round(120 + 135 * t)]; }
  else col = runs[k].some(([a, b]) => b > 0.45 && a < 1.8) ? [25, 25, 25] : runs[k].length ? [150, 150, 150] : [255, 120, 120];
  for (let py = 0; py < PX; py++) for (let px = 0; px < PX; px++) { const o = ((gz * PX + py) * W + gx * PX + px) * 3; img[o] = col[0]; img[o + 1] = col[1]; img[o + 2] = col[2]; }
}
let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
for (let x = Math.ceil(X0); x <= X0 + nx * cs; x++) { const p = (x - X0) / cs * PX; svg += `<line x1="${p}" y1="0" x2="${p}" y2="${H}" stroke="${x % 5 ? '#f66' : '#00f'}" stroke-width="1" opacity="0.5"/><text x="${p + 2}" y="12" font-size="11" fill="#00f">${x}</text>`; }
for (let z = Math.ceil(Z0); z <= Z0 + nz * cs; z++) { const p = (z - Z0) / cs * PX; svg += `<line x1="0" y1="${p}" x2="${W}" y2="${p}" stroke="${z % 5 ? '#f66' : '#00f'}" stroke-width="1" opacity="0.5"/><text x="2" y="${p - 2}" font-size="11" fill="#00f">${z}</text>`; }
for (const s of spots) svg += `<circle cx="${(s[0] - X0) / cs * PX}" cy="${(s[2] - Z0) / cs * PX}" r="3" fill="#f0f"/>`;
for (const d of C.doors || []) svg += `<circle cx="${(d.x - X0) / cs * PX}" cy="${(d.z - Z0) / cs * PX}" r="5" fill="none" stroke="#f80" stroke-width="2"/>`;
svg += '</svg>';
await sharp(img, { raw: { width: W, height: H, channels: 3 } }).composite([{ input: Buffer.from(svg) }]).png().toFile(`${OUT}/walk_${name}.png`);
console.log(name, 'boxes', boxes.length, 'spots', spots.length, 'foot', fx0.toFixed(1), fz0.toFixed(1), fx1.toFixed(1), fz1.toFixed(1), 'top', top.toFixed(1));
