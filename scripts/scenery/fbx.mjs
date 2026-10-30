// Tolerant reader for binary FBX (v7400): pulls the Geometry nodes out of an upload that was cut off in transfer
// (the Objects section is short, the Connections section after it is gone, so no node transforms or materials).
// A Geometry node is complete or it is skipped. Output: a glb of one geometry per call (build.mjs "fbx" config), in
// the FBX's own axes turned Z-up -> Y-up, with the first UV set. The model uses one colour-palette texture.
import fs from 'fs';
import zlib from 'zlib';
import { Document, NodeIO } from '@gltf-transform/core';

export function readFBX(file) {
  const b = fs.readFileSync(file), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (dv.getUint32(23, true) >= 7500) throw new Error('64-bit offsets are not supported');
  const prop = (o) => {
    const t = String.fromCharCode(b[o]); o++;
    const arr = (read) => {
      const n = dv.getUint32(o, true), enc = dv.getUint32(o + 4, true), cl = dv.getUint32(o + 8, true); o += 12;
      if (o + cl > b.length) throw new Error('cut');
      let raw = b.subarray(o, o + cl); o += cl;
      if (enc) raw = zlib.inflateSync(raw);
      return [read(new Uint8Array(raw).buffer, n), o];
    };
    switch (t) {
      case 'Y': return [dv.getInt16(o, true), o + 2];
      case 'C': return [b[o], o + 1];
      case 'I': return [dv.getInt32(o, true), o + 4];
      case 'F': return [dv.getFloat32(o, true), o + 4];
      case 'D': return [dv.getFloat64(o, true), o + 8];
      case 'L': return [Number(dv.getBigInt64(o, true)), o + 8];
      case 'f': return arr((u, n) => new Float32Array(u, 0, n));
      case 'd': return arr((u, n) => new Float64Array(u, 0, n));
      case 'i': return arr((u, n) => new Int32Array(u, 0, n));
      case 'l': return arr((u, n) => Array.from(new BigInt64Array(u, 0, n), Number));
      case 'b': return arr((u, n) => new Uint8Array(u, 0, n));
      case 'S': case 'R': { const n = dv.getUint32(o, true); o += 4; if (o + n > b.length) throw new Error('cut'); return [t === 'S' ? b.toString('latin1', o, o + n) : b.subarray(o, o + n), o + n]; }
      default: throw new Error('bad property ' + t);
    }
  };
  const node = (o) => {
    if (o + 13 > b.length) return null;
    const end = dv.getUint32(o, true), np = dv.getUint32(o + 4, true), nl = b[o + 12];
    if (end === 0) return { nul: true, next: o + 13 };
    const n = { name: b.toString('latin1', o + 13, o + 13 + nl), props: [], kids: [] };
    let p = o + 13 + nl;
    try {
      for (let i = 0; i < np; i++) { const [v, q] = prop(p); n.props.push(v); p = q; }
      if (end > b.length) n.cut = true;
      while (p < (n.cut ? b.length : end)) {            // a cut node runs to the end of the file
        const k = node(p); if (!k) { n.cut = true; break; }
        if (k.nul) { p = k.next; break; }
        n.kids.push(k); p = k.next; if (k.cut) { n.cut = true; break; }
      }
    } catch (e) { n.cut = true; }
    n.next = n.cut ? b.length : end;
    return n;
  };
  const top = []; let o = 27;
  while (o < b.length) { const n = node(o); if (!n || n.nul) break; top.push(n); o = n.next; }
  return top;
}

// every complete Geometry as { name, pos, nor, uv } per triangle corner, Z-up
export function geometries(file) {
  const out = [];
  for (const g of readFBX(file).find((n) => n.name === 'Objects').kids) {
    if (g.name !== 'Geometry' || g.cut) continue;
    const V = g.kids.find((c) => c.name === 'Vertices')?.props[0], I = g.kids.find((c) => c.name === 'PolygonVertexIndex')?.props[0];
    if (!V || !I) continue;
    const nl = g.kids.find((c) => c.name === 'LayerElementNormal'), ul = g.kids.find((c) => c.name === 'LayerElementUV');
    const N = nl?.kids.find((c) => c.name === 'Normals')?.props[0];
    const U = ul?.kids.find((c) => c.name === 'UV')?.props[0], UI = ul?.kids.find((c) => c.name === 'UVIndex')?.props[0];
    const byVertex = /^ByVert/.test(nl?.kids.find((c) => c.name === 'MappingInformationType')?.props[0] || '');
    const pos = [], nor = [], uv = [];
    const corner = (c, vi) => {
      pos.push(V[vi * 3], V[vi * 3 + 1], V[vi * 3 + 2]);
      if (N) { const ni = byVertex ? vi : c; nor.push(N[ni * 3], N[ni * 3 + 1], N[ni * 3 + 2]); }
      if (U) { const ui = UI ? UI[c] : c; uv.push(U[ui * 2], U[ui * 2 + 1]); }
    };
    let start = 0;
    for (let i = 0; i < I.length; i++) if (I[i] < 0) {      // the last index of a polygon is stored as ~index: fan it into triangles
      for (let k = start + 1; k < i; k++) for (const c of [start, k, k + 1]) corner(c, I[c] < 0 ? ~I[c] : I[c]);
      start = i + 1;
    }
    out.push({ name: String(g.props[1]).split('\0')[0], pos, nor, uv });
  }
  return out;
}

const cache = new Map();
// one geometry (by name) as a glb with the palette texture, Y up
export async function fbxToGLB(file, name, texFile) {
  if (!cache.has(file)) cache.set(file, geometries(file));
  const g = cache.get(file).find((x) => x.name === name);
  if (!g) throw new Error(`no complete geometry "${name}" in ${file}`);
  const doc = new Document(), buf = doc.createBuffer();
  const tex = doc.createTexture('palette').setImage(new Uint8Array(fs.readFileSync(texFile))).setMimeType('image/jpeg');
  const mat = doc.createMaterial('palette').setBaseColorTexture(tex).setMetallicFactor(0).setRoughnessFactor(1);
  const n = g.pos.length / 3, P = new Float32Array(n * 3), N = new Float32Array(n * 3), T = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    P.set([g.pos[i * 3], g.pos[i * 3 + 2], -g.pos[i * 3 + 1]], i * 3);
    if (g.nor.length) N.set([g.nor[i * 3], g.nor[i * 3 + 2], -g.nor[i * 3 + 1]], i * 3); else N.set([0, 1, 0], i * 3);
    T.set([g.uv[i * 2] ?? 0, 1 - (g.uv[i * 2 + 1] ?? 0)], i * 2);
  }
  const acc = (type, a) => doc.createAccessor().setType(type).setArray(a).setBuffer(buf);
  const prim = doc.createPrimitive().setAttribute('POSITION', acc('VEC3', P)).setAttribute('NORMAL', acc('VEC3', N)).setAttribute('TEXCOORD_0', acc('VEC2', T)).setMaterial(mat);
  const scene = doc.createScene().addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
  doc.getRoot().setDefaultScene(scene);
  return Buffer.from(await new NodeIO().writeBinary(doc));
}
