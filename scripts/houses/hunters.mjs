// The Hunter's Rest: three uploads made into one walk-in house, before build.mjs / bake.mjs take over.
//   castle_style_door.glb   the arched double door on the front (its two leaves go to their own file, so they swing)
//   coridor_interior.glb    a scanned stone corridor behind the door
//   the_hunters_rest.glb    the candle-lit crypt hall at the end of the corridor (left exactly as it came)
// The hall came as an open cut-away (no front wall, no roof, open colonnades): the game closes it with its own
// walls and roof (config.mjs, shell). Its tiled floor is carried on 7 tiles further toward the corridor.
// usage: UPLOADS=/path node hunters.mjs  -> out/hunters_src.glb (the house, for build.mjs) and out/hunters_door.glb (the leaves)
import fs from 'fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, prune, unpartition, weld, textureCompress, meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const U = (process.env.UPLOADS || './uploads').replace(/\/?$/, '/');
const OUT = process.env.OUT || './out';
fs.mkdirSync(OUT, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
export const FILES = { door: 'castle_style_door.glb', corridor: 'coridor_interior.glb', hall: 'the_hunters_rest.glb' };
const find = (tail) => { const f = fs.readdirSync(U).find((n) => n.endsWith(tail)); if (!f) throw new Error('missing upload *' + tail); return U + f; };
async function load(tail) {
  let raw = fs.readFileSync(find(tail));
  const declared = raw.readUInt32LE(8);
  if (raw.length < declared) raw = Buffer.concat([raw, Buffer.alloc(declared - raw.length)]);   // cut off in upload
  return io.readBinary(new Uint8Array(raw));
}

// ---- the layout, in the house frame (metres; front faces -z, front edge near z = 0, centred on x) ----
export const L = {
  cs: 0.275,              // corridor scale (the scan is in odd units: 8 wide, 13.5 tall)
  cz0: -12, cz1: -48,     // the part of the scan kept: its near end and its far end (beyond -48 it is a smeared blob)
  cFloor: -4.3,           // the scan's floor height
  front: 0.15,            // where the corridor starts (inside the front wall, z 0..0.3)
  hallOpen: 15.45,        // the hall's open end (its floor carries on from here toward the corridor)
  ext: 7,                 // tiles added to the hall floor (74.1 cm each)
};
L.cEnd = L.front + (L.cz0 - L.cz1) * L.cs;      // 10.05
L.extStart = L.hallOpen - L.ext * 0.741;        // where the added floor begins
const HZ = L.hallOpen + 9.984;                  // hall: rotated half a turn (its altar at the back), cm -> m

// Bake each mesh node's world transform (and a function) into its vertices; nodes end with no transform.
function bake(doc, fn, keepTri) {
  const seen = new Set(), e = [], n3 = [];
  const nodes = doc.getRoot().listNodes();
  const mats = new Map(nodes.map((n) => [n, n.getWorldMatrix()]));
  for (const n of nodes) {
    const m = n.getMesh(); if (!m) continue;
    const W = mats.get(n);
    for (const p of m.listPrimitives()) {
      const P = p.getAttribute('POSITION'), N = p.getAttribute('NORMAL');
      if (seen.has(P)) throw new Error('shared accessor'); seen.add(P);
      const pa = new Float32Array(P.getCount() * 3), na = N ? new Float32Array(N.getCount() * 3) : null;
      for (let i = 0; i < P.getCount(); i++) {
        P.getElement(i, e);
        const w = [0, 1, 2].map((k) => W[k] * e[0] + W[4 + k] * e[1] + W[8 + k] * e[2] + W[12 + k]);
        const v = fn(w);
        pa.set(v, i * 3);
        if (N) {
          N.getElement(i, e);
          const nw = [0, 1, 2].map((k) => W[k] * e[0] + W[4 + k] * e[1] + W[8 + k] * e[2]);
          // the normal goes through the same map, by a small finite step
          const q = fn([w[0] + nw[0] * 0.01, w[1] + nw[1] * 0.01, w[2] + nw[2] * 0.01]);
          const d = [q[0] - v[0], q[1] - v[1], q[2] - v[2]], l = Math.hypot(...d) || 1;
          na.set([d[0] / l, d[1] / l, d[2] / l], i * 3);
        }
      }
      P.setArray(pa); if (N) N.setArray(na);
      p.setAttribute('TANGENT', null);
      if (keepTri) {
        const I = p.getIndices(), ia = I.getArray(), out = [];
        for (let t = 0; t < ia.length; t += 3) if (keepTri([ia[t], ia[t + 1], ia[t + 2]].map((i) => [pa[i * 3], pa[i * 3 + 1], pa[i * 3 + 2]]), p)) out.push(ia[t], ia[t + 1], ia[t + 2]);
        I.setArray(new Uint32Array(out));
      }
    }
  }
  for (const n of nodes) n.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  for (const s of doc.getRoot().listScenes()) for (const c of s.listChildren()) c.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

// ================= the hall =================
const hall = await load(FILES.hall);
// carry the tiled floor on: copies of the floor (whole tiles: 20 x 83.95 cm across, 20 x 74.1 cm along), kept only
// where the hall had no floor, between its open end and the corridor
{
  const floor = hall.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).find((p) => p.getMaterial().getName() === 'lambert17SG');
  const node = hall.getRoot().listNodes().find((n) => n.getMesh() && n.getMesh().listPrimitives().includes(floor));
  const W = node.getWorldMatrix();
  const P = floor.getAttribute('POSITION'), N = floor.getAttribute('NORMAL'), T = floor.getAttribute('TEXCOORD_0'), ia = floor.getIndices().getArray();
  const e = [], wp = [], wn = [];
  for (let i = 0; i < P.getCount(); i++) { P.getElement(i, e); wp.push([0, 1, 2].map((k) => W[k] * e[0] + W[4 + k] * e[1] + W[8 + k] * e[2] + W[12 + k])); N.getElement(i, e); wn.push([0, 1, 2].map((k) => W[k] * e[0] + W[4 + k] * e[1] + W[8 + k] * e[2])); }
  const z0 = 998.4, z1 = 998.4 + L.ext * 74.1 + 1, xMax = 1150;   // in the hall's own cm frame (open end at +z)
  const pos = [], nor = [], uv = [], idx = [];
  for (const dx of [-20 * 83.95, 0, 20 * 83.95]) {
    const dz = 20 * 74.1, map = new Map();
    for (let t = 0; t < ia.length; t += 3) {
      const c = [0, 1, 2].map((k) => (wp[ia[t]][k] + wp[ia[t + 1]][k] + wp[ia[t + 2]][k]) / 3);
      const cx = c[0] + dx, cz = c[2] + dz;
      if (cz <= z0 || cz > z1 || Math.abs(cx) > xMax) continue;
      for (const i of [ia[t], ia[t + 1], ia[t + 2]]) {
        if (!map.has(i)) { map.set(i, pos.length / 3); pos.push(wp[i][0] + dx, wp[i][1], wp[i][2] + dz); nor.push(...wn[i]); T.getElement(i, e); uv.push(e[0], e[1]); }
        idx.push(map.get(i));
      }
    }
  }
  const buf = hall.getRoot().listBuffers()[0];
  const acc = (type, arr) => hall.createAccessor().setType(type).setArray(arr).setBuffer(buf);
  const prim = hall.createPrimitive().setMaterial(floor.getMaterial())
    .setAttribute('POSITION', acc('VEC3', new Float32Array(pos))).setAttribute('NORMAL', acc('VEC3', new Float32Array(nor)))
    .setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array(uv))).setIndices(acc('SCALAR', new Uint32Array(idx)));
  // and the dark bed under the tiles (seen through the joints), as the hall has under its own floor
  const bedMat = hall.getRoot().listMaterials().find((m) => m.getName() === 'lambert27SG');
  const by = -12.36, bx = 1146, bz0 = z0 - 2, bz1 = z1 + 4;
  const bed = hall.createPrimitive().setMaterial(bedMat)
    .setAttribute('POSITION', acc('VEC3', new Float32Array([-bx, by, bz0, bx, by, bz0, bx, by, bz1, -bx, by, bz1])))
    .setAttribute('NORMAL', acc('VEC3', new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0])))
    .setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])))
    .setIndices(acc('SCALAR', new Uint32Array([0, 2, 1, 0, 3, 2])));
  const mesh = hall.createMesh('floorExt').addPrimitive(prim).addPrimitive(bed);
  const n = hall.createNode('floorExt').setMesh(mesh);
  hall.getRoot().listScenes()[0].addChild(n);
  console.log('floor carried on:', idx.length / 3, 'triangles');
}
bake(hall, ([x, y, z]) => [-x / 100, y / 100, HZ - z / 100]);

// ================= the corridor =================
const cor = await load(FILES.corridor);
// its centre line drifts a little across the scan: straighten it
const cx = (z) => -1 + (z + 14) * 0.064;
bake(cor, ([x, y, z]) => [(x - cx(z)) * L.cs, (y - L.cFloor) * L.cs, L.front + (L.cz0 - z) * L.cs],
  (vs) => vs.every((v) => v[2] >= L.front - 0.1 && v[2] <= L.cEnd + 0.15 && Math.abs(v[0]) < 1.5 && v[1] < 4.25));
// the scan was lit when it was made (an unlit material): it shows its own light, softly
for (const m of cor.getRoot().listMaterials()) {
  for (const e of m.listExtensions()) m.setExtension(e.extensionName, null);
  m.setEmissiveTexture(m.getBaseColorTexture()); m.setEmissiveFactor([0.55, 0.55, 0.55]);
}
// one of its pictures was cut off in upload: the lost rows are filled with a mirror of the rows above
for (const t of cor.getRoot().listTextures()) {
  const im = Buffer.from(t.getImage());
  try { await sharp(im).raw().toBuffer(); continue; } catch (e) { /* damaged */ }
  const { data, info } = await sharp(im, { failOn: 'none' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  // the first damaged row: where a row stops looking like the one above it
  const diff = (y) => { let s = 0; for (let x = 0; x < w; x++) for (let k = 0; k < 3; k++) s += Math.abs(data[(y * w + x) * 3 + k] - data[((y - 1) * w + x) * 3 + k]); return s / w; };
  // or where rows go flat (one colour right across: the decoder ran out of data)
  const flat = (y) => { let m = 0, v = 0; for (let x = 0; x < w; x++) m += data[(y * w + x) * 3]; m /= w; for (let x = 0; x < w; x++) v += (data[(y * w + x) * 3] - m) ** 2; return Math.sqrt(v / w) < 3; };
  let bad = h; for (let y = 8; y < h; y++) { if (diff(y) > 60 || (flat(y) && flat(y + 1 < h ? y + 1 : y) && flat(Math.min(h - 1, y + 4)))) { bad = y; break; } }
  bad = Math.max(1, bad - 2);
  for (let y = bad; y < h; y++) { let sy = 2 * bad - y - 1; while (sy < 0) sy += bad; data.copy(data, y * w * 3, sy * w * 3, (sy + 1) * w * 3); }
  t.setImage(new Uint8Array(await sharp(data, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 92 }).toBuffer())).setMimeType('image/jpeg');
  console.log('repaired corridor texture from row', bad, 'of', h);
}

// ================= the door =================
const door = await load(FILES.door);
for (const m of door.getRoot().listMaterials()) {
  for (const e of m.listExtensions()) m.setExtension(e.extensionName, null);
  if (m.getName() === 'Glass') { m.setBaseColorFactor([0.16, 0.2, 0.22, 0.55]); m.setAlphaMode('BLEND'); }
}
for (const t of door.getRoot().listTextures()) { try { await sharp(Buffer.from(t.getImage())).raw().toBuffer(); } catch (e) { t.dispose(); } }   // the glass's (unused) damaged map
const DZ = -0.08;     // the frame stands just in front of the wall
// the two leaves (Frame.001 right, Frame.002 left) go to their own file: each with its hinge at the origin, the leaf
// along +x, as the game's doors are (the right one turned half round, as the game hangs it)
const leafDoc = await load(FILES.door);
for (const m of leafDoc.getRoot().listMaterials()) { for (const e of m.listExtensions()) m.setExtension(e.extensionName, null); if (m.getName() === 'Glass') { m.setBaseColorFactor([0.16, 0.2, 0.22, 0.55]); m.setAlphaMode('BLEND'); } }
for (const t of leafDoc.getRoot().listTextures()) { try { await sharp(Buffer.from(t.getImage())).raw().toBuffer(); } catch (e) { t.dispose(); } }
{
  const scene = leafDoc.getRoot().listScenes()[0];
  const groups = { leafL: leafDoc.createNode('leafL'), leafR: leafDoc.createNode('leafR') };
  for (const n of leafDoc.getRoot().listNodes()) {
    const nm = n.getName();
    if (!n.getMesh()) continue;
    if (!/^Frame\.00[12]/.test(nm)) { n.getMesh().dispose(); n.dispose(); }
  }
  bake(leafDoc, (v) => v);
  for (const n of leafDoc.getRoot().listNodes()) {
    const m = n.getMesh(); if (!m || groups[n.getName()]) continue;
    const right = /^Frame\.001/.test(n.getName());
    for (const p of m.listPrimitives()) {
      const P = p.getAttribute('POSITION'), N = p.getAttribute('NORMAL'), a = P.getArray(), na = N.getArray();
      for (let i = 0; i < a.length; i += 3) {
        if (right) { a[i] = 0.71 - a[i]; a[i + 2] = -a[i + 2]; na[i] = -na[i]; na[i + 2] = -na[i + 2]; } else a[i] += 0.71;
      }
      P.setArray(a); N.setArray(na);
    }
    n.getParentNode() ? n.getParentNode().removeChild(n) : scene.removeChild(n);
    groups[right ? 'leafR' : 'leafL'].addChild(n);
  }
  for (const s of leafDoc.getRoot().listScenes()) for (const c of s.listChildren()) s.removeChild(c);
  scene.addChild(groups.leafL).addChild(groups.leafR);
  for (const m of leafDoc.getRoot().listMaterials()) { m.setMetallicFactor(0); m.setRoughnessFactor(1); m.setNormalTexture(null); m.setOcclusionTexture(null); m.setMetallicRoughnessTexture(null); }
  await leafDoc.transform(prune(), weld(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 78 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  fs.writeFileSync(`${OUT}/hunters_door.glb`, await io.writeBinary(leafDoc));
}
// the house keeps the frame (wood and glass), not the leaves
for (const n of door.getRoot().listNodes()) if (n.getMesh() && /^Frame\.00[12]/.test(n.getName())) { n.getMesh().dispose(); n.dispose(); }
bake(door, ([x, y, z]) => [x, y, z + DZ]);

// ================= together =================
await hall.transform(unpartition()); await cor.transform(unpartition()); await door.transform(unpartition());
mergeDocuments(hall, cor); mergeDocuments(hall, door);
// one scene, one buffer
const scenes = hall.getRoot().listScenes();
for (const s of scenes.slice(1)) { for (const c of s.listChildren()) { s.removeChild(c); scenes[0].addChild(c); } s.dispose(); }
await hall.transform(unpartition(), prune());
fs.writeFileSync(`${OUT}/hunters_src.glb`, await io.writeBinary(hall));
console.log('wrote', `${OUT}/hunters_src.glb`, 'corridor', L.front, '->', L.cEnd.toFixed(2), 'floor added', L.extStart.toFixed(2), '->', L.hallOpen, 'hall back', (HZ + 10.065).toFixed(2));
