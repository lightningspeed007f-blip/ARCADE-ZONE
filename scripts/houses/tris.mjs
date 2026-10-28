// world-space triangles of a glb (positions only), scaled
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
export const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
export async function triangles(path, s = 1) {
  const doc = await io.read(path); const out = [];
  for (const n of doc.getRoot().listNodes()) { const m = n.getMesh(); if (!m) continue; const W = n.getWorldMatrix();
    for (const p of m.listPrimitives()) { const P = p.getAttribute('POSITION'), I = p.getIndices(); const e = [];
      const v = (i) => { P.getElement(i, e); const [x, y, z] = e; return [(W[0] * x + W[4] * y + W[8] * z + W[12]) * s, (W[1] * x + W[5] * y + W[9] * z + W[13]) * s, (W[2] * x + W[6] * y + W[10] * z + W[14]) * s]; };
      const n3 = I ? I.getCount() : P.getCount();
      for (let i = 0; i < n3; i += 3) { const a = I ? [I.getScalar(i), I.getScalar(i + 1), I.getScalar(i + 2)] : [i, i + 1, i + 2]; out.push(...v(a[0]), ...v(a[1]), ...v(a[2])); }
    } }
  return new Float32Array(out);
}
