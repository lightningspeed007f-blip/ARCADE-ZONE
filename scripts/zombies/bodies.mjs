// Converts the uploaded dead-body models for Last Stand (see laststand/assets/README.md, "The dead of Jais").
//   node bodies.mjs <folder with deer_dead_body.glb, dead_people.glb, dead_hazmat_female.glb> <out folder>
// - dead_people.glb is three bodies in a row on a ground slab (and a pole): it is cut into three models
// - dead_hazmat_female.glb comes with a placeholder wall and window behind it: both are dropped
// - everything is scaled to metres, the textures shrunk to webp, the geometry meshopt-compressed
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress, meshopt, getBounds, metalRough } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error('usage: node bodies.mjs <uploads folder> <out folder>'); process.exit(1); }
fs.mkdirSync(out, { recursive: true });
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

// keep: names of the nodes (under the model's RootNode) to keep; everything else under it goes
const JOBS = [
  { file: 'deer_dead_body.glb', name: 'deer', tex: 1024, scale: 1 },
  { file: 'dead_hazmat_female.glb', name: 'hazmat', tex: 1024, scale: 1, drop: ['PlaceHolder_Glass', 'PlaceHolder_Wall'] },
  { file: 'dead_people.glb', name: 'people1', tex: 1024, scale: 0.01, keep: ['cloth_2'] },
  { file: 'dead_people.glb', name: 'people2', tex: 1024, scale: 0.01, keep: ['cloth_1'] },
  { file: 'dead_people.glb', name: 'people3', tex: 1024, scale: 0.01, keep: ['cloth'] },
];

for (const J of JOBS) {
  const doc = await io.read(path.join(src, J.file));
  const root = doc.getRoot();
  const rootNode = (function find2(ns) { for (const n of ns) { if (n.getName() === 'RootNode') return n; const r = find2(n.listChildren()); if (r) return r; } return null; })(root.listScenes()[0].listChildren());
  if (rootNode) {
    for (const c of rootNode.listChildren()) {
      if (J.keep && !J.keep.includes(c.getName())) { c.dispose(); continue; }
      if (J.drop && J.drop.includes(c.getName())) c.dispose();
    }
  }
  root.listScenes()[0].setExtras({});
  // the hazmat suit came as specular-glossiness, which the game's loader does not read: make it metal-rough first
  await doc.transform(metalRough(), prune(), dedup(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [J.tex, J.tex], quality: 80 }));
  // normal maps are dropped: the game lights everything with Lambert
  for (const m of root.listMaterials()) { m.setNormalTexture(null); }
  if (J.scale !== 1) {
    const sc = root.listScenes()[0], wrap = doc.createNode('metres').setScale([J.scale, J.scale, J.scale]);
    for (const c of sc.listChildren()) { sc.removeChild(c); wrap.addChild(c); }
    sc.addChild(wrap);
  }
  await doc.transform(prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const f = path.join(out, J.name + '.glb');
  await io.write(f, doc);
  const sc = root.listScenes()[0];
  const b = getBounds(sc);
  console.log(J.name, (fs.statSync(f).size / 1024).toFixed(0) + ' KB', 'size m', b.max.map((v, i) => +(v - b.min[i]).toFixed(2)).join(' x '));
}
