// Upload -> game-ready scenery model (look-only: no doors, no collision bake).
// Final frame: metres, Y up, ground on y = 0, centred on x; houses face -z with their front edge on z = 0.
// usage: UPLOADS=/path/to/uploads node build.mjs <name>   -> out/<name>.glb   (node build.mjs all: every one)
// then copy out/*.glb to laststand/assets/models/scenery/ (see laststand/assets/README.md, "Look-only scenery")
import fs from 'fs';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { metalRough, flatten, join, dedup, weld, prune, textureCompress, meshopt, clearNodeTransform, simplify } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import { CONFIG } from './config.mjs';
import { MeshoptSimplifier as Sloppy } from 'meshoptimizer-sloppy';   // a newer meshoptimizer, only for simplifySloppy
await MeshoptEncoder.ready; await MeshoptDecoder.ready; await MeshoptSimplifier.ready; await Sloppy.ready;
const OUT = process.env.OUT || './out';
fs.mkdirSync(OUT, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const names = process.argv[2] === 'all' ? Object.keys(CONFIG) : [process.argv[2]];
for (const name of names) await build(name, CONFIG[name]);

async function build(name, C) {
  let raw = fs.readFileSync(C.src);
  const declared = raw.readUInt32LE(8);
  if (raw.length < declared) raw = Buffer.concat([raw, Buffer.alloc(declared - raw.length)]);   // cut off in upload
  const doc = await io.readBinary(new Uint8Array(raw));
  const root = doc.getRoot();
  // textures: decode whatever arrived (a cut-off PNG decodes with its last rows black), then the per-model fix
  for (const t of root.listTextures()) {
    let png;
    try { png = await sharp(Buffer.from(t.getImage()), { failOn: 'none' }).png().toBuffer(); } catch (e) { png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#808080' } }).png().toBuffer(); }
    if (C.texFix) png = (await C.texFix(sharp, png)) || png;
    t.setImage(new Uint8Array(png)).setMimeType('image/png');
  }
  await doc.transform(metalRough());
  await doc.transform(flatten());
  // drop the parts we don't want (sea, sky, mist, reflections...) before anything else
  for (const n of root.listNodes()) {
    const m = n.getMesh(); if (!m) continue;
    const mat = m.listPrimitives()[0]?.getMaterial()?.getName() || '';
    if (C.keep && !C.keep(n.getName(), mat)) { n.dispose(); continue; }
  }
  // rigs and morphs: everything here stands still, so keep the rest pose and drop the rest
  for (const n of root.listNodes()) if (n.getSkin()) n.setSkin(null);
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
    for (const t of p.listTargets()) t.dispose();
    for (const sem of p.listSemantics()) if (/^(JOINTS|WEIGHTS)_/.test(sem)) p.setAttribute(sem, null);
  }
  for (const a of root.listAnimations()) a.dispose();
  const det = (m) => m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]);
  const flip = (p) => { const ix = p.getIndices(); if (!ix) return; const a = ix.getArray().slice(); for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } ix.setArray(a); };
  for (const n of root.listNodes()) if (n.getMesh()) { const mir = det(n.getWorldMatrix()) < 0; clearNodeTransform(n); if (mir) n.getMesh().listPrimitives().forEach(flip); }
  for (const m of root.listMaterials()) {
    m.setMetallicFactor(0); m.setRoughnessFactor(1);
    m.setNormalTexture(null); m.setOcclusionTexture(null); m.setMetallicRoughnessTexture(null);
    for (const e of m.listExtensions()) m.setExtension(e.extensionName, null);
    if (C.mat) C.mat(m);
  }
  // per-material texture fixes (e.g. lift a texture whose light was meant to be shown unlit)
  if (C.texMat) for (const m of root.listMaterials()) { const f = C.texMat[m.getName()], t = m.getBaseColorTexture(); if (f && t) t.setImage(new Uint8Array(await f(sharp, Buffer.from(t.getImage())))); }
  // colours carried per vertex: give every part a COLOR_0 (white where it had none), so one material setting fits all
  if (C.vcol) for (const me of root.listMeshes()) for (const p of me.listPrimitives()) if (!p.getAttribute('COLOR_0')) {
    const n = p.getAttribute('POSITION').getCount();
    p.setAttribute('COLOR_0', doc.createAccessor().setType('VEC4').setArray(new Float32Array(n * 4).fill(1)).setBuffer(root.listBuffers()[0]));
  }
  await doc.transform(prune(), dedup(), join({ keepNamed: false }), weld(), prune());

  // ---- scale, turn, crop, recentre (on the vertex arrays) ----
  const prims = [], pas = []; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) prims.push(p);
  const s = C.scale || 1, sv = C.scaleY || s, cy = Math.cos(C.yaw || 0), sy = Math.sin(C.yaw || 0);
  for (const p of prims) {
    const P = p.getAttribute('POSITION'), N = p.getAttribute('NORMAL'), e = [];
    const pa = new Float32Array(P.getCount() * 3);
    for (let i = 0; i < P.getCount(); i++) { P.getElement(i, e); let [x, y, z] = C.up ? C.up(e) : e; x *= s; y *= sv; z *= s; pa.set([x * cy + z * sy, y, -x * sy + z * cy], i * 3); }
    P.setArray(pa);
    pas.push([p, pa]);
    if (N) { const na = new Float32Array(N.getCount() * 3); for (let i = 0; i < N.getCount(); i++) { N.getElement(i, e); let [x, y, z] = C.up ? C.up(e) : e; x /= s; y /= sv; z /= s; const l = Math.hypot(x, y, z) || 1; na.set([(x * cy + z * sy) / l, y / l, (-x * sy + z * cy) / l], i * 3); } N.setArray(na); }
    if (!p.getIndices()) { const ia = new Uint32Array(P.getCount()); ia.forEach((_, i) => { ia[i] = i; }); p.setIndices(doc.createAccessor().setType('SCALAR').setArray(ia).setBuffer(root.listBuffers()[0])); }
  }
  // with C.pre, crop / drop work in a frame recentred on everything that came in: x centred, y and z from their minimum
  const m0 = [1e9, 1e9, 1e9], m1 = [-1e9, -1e9, -1e9];
  for (const [, pa] of pas) for (let i = 0; i < pa.length; i++) { m0[i % 3] = Math.min(m0[i % 3], pa[i]); m1[i % 3] = Math.max(m1[i % 3], pa[i]); }
  const pre = C.pre ? [(m0[0] + m1[0]) / 2, m0[1], m0[2]] : [0, 0, 0];
  for (const [p, pa] of pas) {
    for (let i = 0; i < pa.length; i++) pa[i] -= pre[i % 3];
    p.getAttribute('POSITION').setArray(pa);
    if (C.crop || C.drop) {
      const I = p.getIndices(), ia = I.getArray(), out = [];
      for (let t = 0; t < ia.length; t += 3) {
        const vs = [0, 1, 2].map((k) => [pa[ia[t + k] * 3], pa[ia[t + k] * 3 + 1], pa[ia[t + k] * 3 + 2]]);
        const c = [0, 1, 2].map((k) => (vs[0][k] + vs[1][k] + vs[2][k]) / 3);
        if (C.crop && (c[0] < C.crop[0] || c[0] > C.crop[3] || c[1] < C.crop[1] || c[1] > C.crop[4] || c[2] < C.crop[2] || c[2] > C.crop[5])) continue;
        if (C.drop && C.drop(vs, c)) continue;
        out.push(ia[t], ia[t + 1], ia[t + 2]);
      }
      I.setArray(new Uint32Array(out));
    }
  }
  for (const p of prims) if (p.getIndices().getCount() === 0) p.dispose();
  await doc.transform(prune());
  // small loose pieces of a scan (floating specks): drop connected parts under C.minPart triangles
  if (C.minPart) for (const m of root.listMeshes()) for (const p of m.listPrimitives()) dropSpecks(p, C.minPart);
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  const live = []; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) live.push(p);
  for (const p of live) { const P = p.getAttribute('POSITION').getArray(); for (const i of p.getIndices().getArray()) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[i * 3 + k]); mx[k] = Math.max(mx[k], P[i * 3 + k]); } }
  const ref = [(mn[0] + mx[0]) / 2, C.groundY ?? mn[1], C.front ?? mn[2]];
  // C.centre: centred on z too (x/z of the box centre)   C.trunk: centred on the trunk where it meets the ground
  if (C.centre || C.trunk) ref[2] = (mn[2] + mx[2]) / 2;
  if (C.trunk) {
    const lo = mn[1] + (mx[1] - mn[1]) * 0.04, a = [0, 0, 0];
    for (const p of live) { const P = p.getAttribute('POSITION').getArray(); for (let i = 0; i < P.length; i += 3) if (P[i + 1] < lo) { a[0] += P[i]; a[1] += P[i + 2]; a[2]++; } }
    if (a[2]) { ref[0] = a[0] / a[2]; ref[2] = a[1] / a[2]; }
  }
  for (const p of live) { const P = p.getAttribute('POSITION'), a = P.getArray(); for (let i = 0; i < a.length; i += 3) { a[i] -= ref[0]; a[i + 1] -= ref[1]; a[i + 2] -= ref[2]; } P.setArray(a); }
  // C.fitH: scaled so it stands C.fitH tall (the game sizes each copy)
  if (C.fitH) {
    const k = C.fitH / (mx[1] - mn[1]);
    for (const p of live) { const P = p.getAttribute('POSITION'), a = P.getArray(); for (let i = 0; i < a.length; i++) a[i] *= k; P.setArray(a); }
    for (let i = 0; i < 3; i++) { mn[i] = ref[i] + (mn[i] - ref[i]) * k; mx[i] = ref[i] + (mx[i] - ref[i]) * k; }
  }
  let tris = 0; for (const p of live) tris += p.getIndices().getCount() / 3;
  if (C.simplify && tris > C.simplify && C.sloppy) {
    // a scan has a UV seam on nearly every edge: the normal simplifier can't collapse those, the sloppy one can
    await doc.transform(weld());
    for (const p of live) {
      const I = p.getIndices(), P = p.getAttribute('POSITION').getArray(), n0 = I.getCount();
      const [ia] = Sloppy.simplifySloppy(new Uint32Array(I.getArray()), new Float32Array(P), 3, null, Math.floor(n0 * C.simplify / tris / 3) * 3, 0.05);
      I.setArray(new Uint32Array(ia));
    }
    let t2 = 0; for (const p of live) t2 += p.getIndices().getCount() / 3; console.log(name, 'simplified (sloppy)', tris, '->', t2); tris = t2;
  } else if (C.simplify && tris > C.simplify) {
    await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: C.simplify / tris, error: C.simpErr ?? 0.004, lockBorder: !!C.lockBorder }));
    let t2 = 0; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) t2 += p.getIndices().getCount() / 3; console.log(name, 'simplified', tris, '->', t2); tris = t2;
  }
  await doc.transform(prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [C.tex || 1024, C.tex || 1024], quality: C.q || 80 }));
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(`${OUT}/${name}.glb`, doc);
  console.log(name, 'tris', tris, 'size', fs.statSync(`${OUT}/${name}.glb`).size, 'bounds', mn.map((v, k) => (v - ref[k]).toFixed(2)).join(' '), '|', mx.map((v, k) => (v - ref[k]).toFixed(2)).join(' '));
}

// Drop connected pieces smaller than n triangles (photogrammetry leaves floating specks).
function dropSpecks(p, n) {
  const I = p.getIndices(), ia = I.getArray(), P = p.getAttribute('POSITION').getArray();
  // vertices may be duplicated at seams: join them by position
  const key = new Map(), id = new Uint32Array(P.length / 3);
  for (let i = 0; i < id.length; i++) { const k = `${Math.round(P[i * 3] * 1e3)},${Math.round(P[i * 3 + 1] * 1e3)},${Math.round(P[i * 3 + 2] * 1e3)}`; if (!key.has(k)) key.set(k, key.size); id[i] = key.get(k); }
  const par = new Int32Array(key.size).map((_, i) => i);
  const find = (a) => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
  for (let t = 0; t < ia.length; t += 3) { const a = find(id[ia[t]]), b = find(id[ia[t + 1]]), c = find(id[ia[t + 2]]); par[b] = a; par[find(c)] = a; }
  const cnt = new Map();
  for (let t = 0; t < ia.length; t += 3) { const r = find(id[ia[t]]); cnt.set(r, (cnt.get(r) || 0) + 1); }
  const out = [];
  for (let t = 0; t < ia.length; t += 3) if (cnt.get(find(id[ia[t]])) >= n) out.push(ia[t], ia[t + 1], ia[t + 2]);
  I.setArray(new Uint32Array(out));
}
