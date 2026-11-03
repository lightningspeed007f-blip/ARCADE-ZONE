// Draw-cost control for the many-copy models (trees, parked cars, grass, headstones, corpses, houses).
//
//  * simplified(geo, ratio): a lighter copy of a geometry for far-away drawing. It shares the vertex buffers
//    with the original (no extra GPU memory except a shorter index list); meshoptimizer decides which
//    triangles go, so silhouettes and UVs hold up. Done once at load time, a few ms per mesh.
//  * InstanceLOD: an InstancedMesh used to be one draw that shaded EVERY copy in the world, even the ones
//    behind you or 400 m away in the fog. Now each frame every copy is tested against the camera (distance
//    and view frustum) and only those that can be seen are sent to the GPU, in the full model when close
//    and a simplified one when further. The source arrays are never changed, so nothing about placement,
//    colliders or gameplay moves.
import * as THREE from 'three';
import { MeshoptSimplifier } from '../lib/meshopt_simplifier.module.js';

let simplifierOK = false;
const ready = MeshoptSimplifier.ready.then(() => { simplifierOK = MeshoptSimplifier.supported; }, () => { simplifierOK = false; });
export const lodReady = () => ready;

const _f32 = (attr) => {
  if (attr.array instanceof Float32Array && !attr.isInterleavedBufferAttribute && attr.itemSize === 3) return attr.array;
  const out = new Float32Array(attr.count * 3);
  for (let i = 0; i < attr.count; i++) { out[i * 3] = attr.getX(i); out[i * 3 + 1] = attr.getY(i); out[i * 3 + 2] = attr.getZ(i); }
  return out;
};

// A lighter copy of `geo` with about `ratio` of its triangles (never fewer than `minTris`), or null when it
// can't be done / isn't worth it. `maxTris` caps the result in absolute terms (for the huge scans).
export function simplified(geo, ratio, { minTris = 30, maxTris = Infinity } = {}) {
  if (!simplifierOK || !geo || !geo.attributes.position || (geo.groups && geo.groups.length > 1)) return null;
  const pos = geo.attributes.position;
  const count = geo.index ? geo.index.count : pos.count;
  const tris = count / 3;
  const want = Math.max(minTris, Math.min(Math.floor(tris * ratio), maxTris));
  if (want >= tris * 0.85) return null;
  let idx;
  if (geo.index) idx = geo.index.array instanceof Uint32Array ? geo.index.array : Uint32Array.from(geo.index.array);
  else { idx = new Uint32Array(count); for (let i = 0; i < count; i++) idx[i] = i; }
  let res;
  try {
    // a generous error allowance: the triangle budget is what limits the result
    res = MeshoptSimplifier.simplify(idx, _f32(pos), 3, want * 3, 0.25)[0];
  } catch (e) { return null; }
  if (!res || res.length < 9) return null;
  const out = new THREE.BufferGeometry();
  for (const k in geo.attributes) out.setAttribute(k, geo.attributes[k]);        // shared with the original
  out.setIndex(new THREE.BufferAttribute(pos.count < 65536 ? Uint16Array.from(res) : res, 1));
  if (geo.boundingSphere) out.boundingSphere = geo.boundingSphere.clone();
  if (geo.boundingBox) out.boundingBox = geo.boundingBox.clone();
  return out;
}

const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _cp = new THREE.Vector3(), _v = new THREE.Vector3();

export class InstanceLOD {
  constructor() { this.sets = []; }

  // Take over a finished (static) InstancedMesh.
  //   far:   copies further than this are not drawn at all (the fog has taken them)
  //   tiers: [{ d, ratio, maxTris }] beyond d metres draw the simplified version
  //   pad:   extra radius for the visibility test
  //   base:  { ratio, maxTris } also lightens the close-up model itself (for scans with far more triangles than a
  //          phone can show on a few hundred pixels)
  add(im, { far = 170, tiers = [], pad = 0, base = null } = {}) {
    const n = im.count;
    if (!n) return null;
    if (!im.geometry.boundingSphere) im.geometry.computeBoundingSphere();
    const full = im.geometry;
    if (base) { const g = simplified(full, base.ratio, base); if (g) im.geometry = g; }
    const bs = im.geometry.boundingSphere, mat = new THREE.Matrix4(), e = new THREE.Vector3(), c = new THREE.Vector3();
    const src = new Float32Array(im.instanceMatrix.array.subarray(0, n * 16));
    const col = im.instanceColor ? new Float32Array(im.instanceColor.array.subarray(0, n * 3)) : null;
    const px = new Float32Array(n), py = new Float32Array(n), pz = new Float32Array(n), rad = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      mat.fromArray(src, i * 16);
      c.copy(bs.center).applyMatrix4(mat);
      px[i] = c.x; py[i] = c.y; pz[i] = c.z;
      const s = Math.sqrt(Math.max(e.setFromMatrixColumn(mat, 0).lengthSq(), e.setFromMatrixColumn(mat, 1).lengthSq(), e.setFromMatrixColumn(mat, 2).lengthSq()));
      rad[i] = bs.radius * s + pad;
    }
    // level 0 is the mesh itself; the lighter ones are new meshes sharing its material and vertex data
    const levels = [{ mesh: im, from: 0 }];
    for (const t of tiers) {
      const g = simplified(full, t.ratio, { maxTris: t.maxTris });
      if (!g) continue;
      const m = new THREE.InstancedMesh(g, im.material, n);
      m.renderOrder = im.renderOrder; m.frustumCulled = false; m.layers.mask = im.layers.mask;
      if (col) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
      m.name = (im.name || 'inst') + '_lod';
      if (im.parent) im.parent.add(m);
      levels.push({ mesh: m, from: t.d });
    }
    im.frustumCulled = false;
    for (const L of levels) {
      const m = L.mesh;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (m.instanceColor) m.instanceColor.setUsage(THREE.DynamicDrawUsage);
      L.ids = new Int32Array(n).fill(-1); L.count = -1; L.n = 0; L.slot = new Int32Array(n);
    }
    const set = { n, src, col, px, py, pz, rad, far, levels, bounds: levels.map((L) => L.from * L.from), visible: 0 };
    this.sets.push(set);
    return set;
  }

  update(camera) {
    _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _fr.setFromProjectionMatrix(_pm);
    camera.getWorldPosition(_cp);
    const cx = _cp.x, cy = _cp.y, cz = _cp.z, pl = _fr.planes;
    for (const S of this.sets) {
      const { n, src, col, px, py, pz, rad, levels, bounds, far } = S, nl = levels.length;
      for (let l = 0; l < nl; l++) levels[l].n = 0;
      let vis = 0;
      for (let i = 0; i < n; i++) {
        const x = px[i], y = py[i], z = pz[i], r = rad[i];
        const dx = x - cx, dz = z - cz, dy = y - cy;
        const d2 = dx * dx + dy * dy + dz * dz, fr = far + r;
        if (d2 > fr * fr) continue;
        let out = false;
        for (let k = 0; k < 6; k++) { const p = pl[k].normal; if (p.x * x + p.y * y + p.z * z + pl[k].constant < -r) { out = true; break; } }
        if (out) continue;
        // the lightest level whose distance has been passed (the near edge of the object counts, so big things switch late)
        let l = nl - 1;
        const dn = Math.max(0, Math.sqrt(d2) - r), dn2 = dn * dn;
        while (l > 0 && dn2 < bounds[l]) l--;
        const L = levels[l];
        L.slot[L.n++] = i;
        vis++;
      }
      S.visible = vis;
      for (let l = 0; l < nl; l++) {
        const L = levels[l], m = L.mesh, k = L.n, slot = L.slot, ids = L.ids;
        let changed = k !== L.count;
        if (!changed) for (let j = 0; j < k; j++) if (ids[j] !== slot[j]) { changed = true; break; }
        if (changed) {
          const ma = m.instanceMatrix.array, ca = m.instanceColor ? m.instanceColor.array : null;
          for (let j = 0; j < k; j++) {
            const i = slot[j];
            ids[j] = i;
            ma.set(src.subarray(i * 16, i * 16 + 16), j * 16);
            if (ca && col) { ca[j * 3] = col[i * 3]; ca[j * 3 + 1] = col[i * 3 + 1]; ca[j * 3 + 2] = col[i * 3 + 2]; }
          }
          if (k) {
            m.instanceMatrix.clearUpdateRanges(); m.instanceMatrix.addUpdateRange(0, k * 16); m.instanceMatrix.needsUpdate = true;
            if (m.instanceColor) { m.instanceColor.clearUpdateRanges(); m.instanceColor.addUpdateRange(0, k * 3); m.instanceColor.needsUpdate = true; }
          }
          L.count = k;
        }
        m.count = k;
        m.visible = k > 0;     // nothing to draw: not even a draw call
      }
    }
  }
}

// A single static mesh (a wreck, a ruin): a lighter geometry with distance, hidden when far.
export function lodMesh(mesh, { far = 170, tiers = [], base = null } = {}) {
  const full = mesh.geometry;
  if (base) { const g = simplified(full, base.ratio, base); if (g) mesh.geometry = g; }
  const levels = [{ d: 0, geo: mesh.geometry }];
  for (const t of tiers) { const g = simplified(full, t.ratio, { maxTris: t.maxTris }); if (g) levels.push({ d: t.d, geo: g }); }
  if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
  mesh.userData.lod = { levels, far };
  return mesh;
}

export function updateLodMeshes(list, camera) {
  camera.getWorldPosition(_cp);
  for (const m of list) {
    const L = m.userData.lod;
    const bs = m.geometry.boundingSphere;
    _v.copy(bs.center).applyMatrix4(m.matrixWorld);
    const dc = _v.distanceTo(_cp), d = Math.max(0, dc - bs.radius);
    m.visible = d < L.far;
    if (!m.visible) continue;
    let g = L.levels[0].geo;
    for (const lv of L.levels) if (d >= lv.d) g = lv.geo;
    if (m.geometry !== g) m.geometry = g;
  }
}
