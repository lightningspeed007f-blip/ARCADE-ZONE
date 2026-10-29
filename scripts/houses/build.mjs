// Upload -> game-ready house: metres, front facing -z with the front edge on z = 0, centred on x, ground on y = 0.
// usage: node build.mjs <name>  -> out/<name>.glb (then node bake.mjs <name>, and node gen.mjs once all are baked)
import fs from 'fs';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { metalRough, flatten, join, dedup, weld, prune, textureCompress, meshopt, clearNodeTransform, simplify } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import { CONFIG } from './config.mjs';
await MeshoptEncoder.ready; await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
const name = process.argv[2]; const C = CONFIG[name];
const OUT = process.env.OUT || './out';
fs.mkdirSync(OUT, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

let raw = fs.readFileSync(C.src);
const declared = raw.readUInt32LE(8);
if (raw.length < declared) raw = Buffer.concat([raw, Buffer.alloc(declared - raw.length)]);   // cut off in upload
const doc = await io.readBinary(new Uint8Array(raw));
for (const t of doc.getRoot().listTextures()) {
  try { t.setImage(new Uint8Array(await sharp(Buffer.from(t.getImage()), { failOn: 'none' }).png().toBuffer())).setMimeType('image/png'); } catch (e) { t.setImage(new Uint8Array(await sharp({ create: { width: 4, height: 4, channels: 3, background: '#808080' } }).png().toBuffer())); }
}
await doc.transform(metalRough());
await doc.transform(flatten());
const det = (m) => m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]);
const flip = (p) => { const ix = p.getIndices(); const a = ix.getArray().slice(); for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } ix.setArray(a); };
for (const n of doc.getRoot().listNodes()) if (n.getMesh()) { const mir = det(n.getWorldMatrix()) < 0; clearNodeTransform(n); if (mir) n.getMesh().listPrimitives().forEach(flip); }
for (const m of doc.getRoot().listMaterials()) {
  m.setMetallicFactor(0); m.setRoughnessFactor(1);
  m.setNormalTexture(null); m.setOcclusionTexture(null); m.setMetallicRoughnessTexture(null);
  for (const e of m.listExtensions()) m.setExtension(e.extensionName, null);
  if (C.mat && C.mat[m.getName()]) C.mat[m.getName()](m);
}
await doc.transform(dedup(), join({ keepNamed: false }), weld(), prune());

// ---- scale, crop, turn, recentre (done on the vertex arrays) ----
const prims = []; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) prims.push(p);
const s = C.scale, cy = Math.cos(C.yaw || 0), sy = Math.sin(C.yaw || 0);
const tf = (x, y, z) => { x *= s; y *= s; z *= s; return [x * cy + z * sy, y, -x * sy + z * cy]; };
// pass 1: scale + yaw positions and normals; crop triangles (crop rect and drop rules in scaled, pre-yaw coords)
for (const p of prims) {
  const P = p.getAttribute('POSITION'), N = p.getAttribute('NORMAL'); const e = [];
  const src = P.getArray().slice();
  const keep = (i) => true;
  const pa = new Float32Array(P.getCount() * 3);
  for (let i = 0; i < P.getCount(); i++) { P.getElement(i, e); const v = tf(...e); pa.set(v, i * 3); }
  if (N) { const na = new Float32Array(N.getCount() * 3); for (let i = 0; i < N.getCount(); i++) { N.getElement(i, e); na.set([e[0] * cy + e[2] * sy, e[1], -e[0] * sy + e[2] * cy], i * 3); } N.setArray(na); }
  // crop on scaled pre-yaw coords
  const I = p.getIndices(), ia = I.getArray(), out = [];
  for (let t = 0; t < ia.length; t += 3) {
    const vs = [0, 1, 2].map((k) => [src[ia[t + k] * 3] * s, src[ia[t + k] * 3 + 1] * s, src[ia[t + k] * 3 + 2] * s]);
    const c = [0, 1, 2].map((k) => (vs[0][k] + vs[1][k] + vs[2][k]) / 3);
    if (C.crop && (c[0] < C.crop[0] || c[0] > C.crop[2] || c[2] < C.crop[1] || c[2] > C.crop[3])) continue;
    if (C.drop && C.drop(vs, c)) continue;
    out.push(ia[t], ia[t + 1], ia[t + 2]);
  }
  I.setArray(new Uint32Array(out));
  P.setArray(pa);
}
// bounds of what is left -> recentre
let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
for (const p of prims) { const P = p.getAttribute('POSITION').getArray(), ia = p.getIndices().getArray(); for (const i of ia) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[i * 3 + k]); mx[k] = Math.max(mx[k], P[i * 3 + k]); } }
const ref = C.ref || [(mn[0] + mx[0]) / 2, mn[1], mn[2]];
const shift = [-ref[0], -(C.groundY ?? ref[1]), -ref[2]];
for (const p of prims) { const P = p.getAttribute('POSITION'), a = P.getArray(); for (let i = 0; i < a.length; i += 3) { a[i] += shift[0]; a[i + 1] += shift[1]; a[i + 2] += shift[2]; } P.setArray(a); }
// door panels: triangles entirely inside a doorway go (the game hangs its own door there)
const inDoor = (v, d, pad = 0.03) => { const al = d.along === 'x' ? v[0] - d.x : v[2] - d.z, ac = d.along === 'x' ? v[2] - d.z : v[0] - d.x; return Math.abs(al) <= d.w / 2 + pad && Math.abs(ac) <= (d.depth || 0.3) && v[1] >= (d.y || 0) - 0.05 && v[1] <= (d.y || 0) + d.h + pad; };
for (const p of prims) {
  const P = p.getAttribute('POSITION').getArray(), I = p.getIndices(), ia = I.getArray(), out = [];
  for (let t = 0; t < ia.length; t += 3) {
    const vs = [0, 1, 2].map((k) => [P[ia[t + k] * 3], P[ia[t + k] * 3 + 1], P[ia[t + k] * 3 + 2]]);
    if ((C.doors || []).some((d) => vs.every((v) => inDoor(v, d)))) continue;
    if (C.cut && C.cut(vs)) continue;
    out.push(ia[t], ia[t + 1], ia[t + 2]);
  }
  I.setArray(new Uint32Array(out));
}
for (const p of prims) if (p.getIndices().getCount() === 0) p.dispose();
await doc.transform(prune());
let tris = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
if (C.simplify && tris > C.simplify) {
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: C.simplify / tris, error: C.simpErr ?? 0.002, lockBorder: true }));
  let t2 = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) t2 += p.getIndices().getCount() / 3; console.log('simplified', tris, '->', t2); tris = t2;
}
if (C.texFix) for (const t of doc.getRoot().listTextures()) if (C.texFix[t.getName()] || C.texFix['*']) { const f = C.texFix[t.getName()] || C.texFix['*']; const r = await f(sharp, Buffer.from(t.getImage()), t.getName()); if (r) t.setImage(new Uint8Array(r)); }
await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [C.tex || 1024, C.tex || 1024], quality: 78 }));
await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(`${OUT}/${name}.glb`, doc);
mn = [1e9, 1e9, 1e9]; mx = [-1e9, -1e9, -1e9];
console.log(name, 'tris', tris, 'size', fs.statSync(`${OUT}/${name}.glb`).size, 'textures', doc.getRoot().listTextures().map((t) => t.getName()).join(','));
