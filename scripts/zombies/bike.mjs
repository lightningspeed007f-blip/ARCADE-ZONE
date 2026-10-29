// Converts the uploaded rusty motorbike for Last Stand (see laststand/assets/README.md, "Cars, ambulances and road grass").
//   node bike.mjs <rusty_motorbike.glb> <out bike.glb>
// - turned so it lies along z (the old box bike's way), centred, wheels on y = 0, about 2.3 m long
// - 81k triangles simplified to about 9k (the town has dozens of them), normal and other maps dropped, textures to webp
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, weld, simplify, flatten, join, textureCompress, meshopt, getBounds } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';

const [src, out] = process.argv.slice(2);
await MeshoptEncoder.ready; await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(src);
const root = doc.getRoot();
for (const m of root.listMaterials()) { m.setNormalTexture(null); m.setOcclusionTexture(null); m.setMetallicRoughnessTexture(null); m.setEmissiveTexture(null); }
// The upload splits its vertices at every normal / UV seam, so the stock simplifier finds nothing it may collapse.
// Join the vertices that share a position, simplify on those, and keep each survivor's first normal and UV: a few
// triangles at the seams smear a little, which nobody sees on a rusty bike in the dark.
const KEEP = 0.075;
for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
  const pos = prim.getAttribute('POSITION'), n = pos.getCount(), idx = prim.getIndices().getArray();
  const key = new Map(), rep = [], up = [], map = new Uint32Array(n), a = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    pos.getElement(i, a);
    const k = a.map((v) => Math.round(v * 1e5)).join(',');
    let u = key.get(k);
    if (u === undefined) { u = rep.length; key.set(k, u); rep.push(i); up.push(a[0], a[1], a[2]); }
    map[i] = u;
  }
  const uidx = Uint32Array.from(idx, (i) => map[i]);
  const target = Math.max(60, Math.round(uidx.length * KEEP / 3) * 3);
  const [out] = MeshoptSimplifier.simplify(uidx, new Float32Array(up), 3, target, 0.08, []);
  const used = new Map(); for (const u of out) if (!used.has(u)) used.set(u, used.size);
  const order = [...used.keys()];
  for (const sem of prim.listSemantics()) {
    const acc = prim.getAttribute(sem), cs = acc.getElementSize(), arr = new (acc.getArray().constructor)(order.length * cs), e = new Array(cs);
    order.forEach((u, j) => { acc.getElement(rep[u], e); arr.set(e, j * cs); });
    acc.setArray(arr);
  }
  prim.getIndices().setArray(Uint32Array.from(out, (u) => used.get(u)));
}
await doc.transform(flatten(), join(), prune(), dedup(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 80 }));
// lengthways along x in the upload: turn it a quarter, centre it, stand it on the ground
const sc = root.listScenes()[0];
const wrap = doc.createNode('bike').setRotation([0, Math.SQRT1_2, 0, Math.SQRT1_2]);
for (const c of sc.listChildren()) { sc.removeChild(c); wrap.addChild(c); }
sc.addChild(wrap);
let b = getBounds(sc); console.log('before', b.min, b.max);
wrap.setTranslation([-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2]);
const size = b.max.map((v, i) => +(v - b.min[i]).toFixed(2)).join(' x ');
await doc.transform(prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(out, doc);
let tris = 0; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? 0) / 3;
console.log('triangles', Math.round(tris), 'size m', size);
