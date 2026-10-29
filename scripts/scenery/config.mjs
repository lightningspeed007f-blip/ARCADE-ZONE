// Per-model settings for the look-only scenery (see build.mjs).
// keep(nodeName, materialName): which parts of the upload to keep   scale / scaleY / yaw: into metres, front to -z
// crop [x0, y0, z0, x1, y1, z1]: keep triangles whose centre is inside (scaled and turned)   drop(vs, centre): more filters
// pre: crop / drop see the model recentred first (x centred, y and z from their lowest)   minPart: drop loose pieces
// smaller than this   simplify: target triangles (sloppy: for scans)   texFix / texMat: texture repairs   vcol: vertex colours
// the original uploads (Sketchfab .glb files), wherever you keep them: UPLOADS=/path/to/folder
const U = (process.env.UPLOADS || './uploads').replace(/\/?$/, '/');

// A PNG cut off in upload decodes with its last rows black: repeat the last good row down over them.
async function fillCutRows(sharp, png) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info, rowLen = w * 3;
  const black = (y) => { let s = 0; for (let x = 0; x < rowLen; x++) s += data[y * rowLen + x]; return s / rowLen < 2; };
  let changed = false;
  for (let y = 1; y < h; y++) if (black(y) && !black(y - 1)) {
    let e = y; while (e < h && black(e)) e++;
    // a band of black rows: fill from both sides, half each
    for (let k = y; k < e; k++) { const src = e < h && k >= (y + e) / 2 ? e : y - 1; data.copy(data, k * rowLen, src * rowLen, (src + 1) * rowLen); }
    changed = true; y = e;
  }
  return changed ? sharp(data, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer() : null;
}

const lift = (k) => (sharp, png) => sharp(png).linear(k, 0).png().toBuffer();
const normal = ([a, b, c]) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const l = Math.hypot(...n) || 1; return n.map((v) => v / l); };

export const CONFIG = {
  // a photo-scanned stone cottage from Provence. The scan is its front wall only (facing +z in the file, a few
  // degrees off square) with the patio in front; the game builds the body and roof behind it (js/scenery.js)
  provence: { src: U + '038687fc-provence_house_3d_scan_zenfone_ar.glb', scale: 1, yaw: Math.PI - 0.11, pre: true,
    // the patio and the plants out in front of the wall, anything behind it, and the vines floating over the roofline
    drop: (vs, c) => { const n = normal(vs); return (Math.abs(n[1]) > 0.6 && c[1] < 0.9) || c[1] > 4.6 || c[2] < 1.3 || c[2] > 4.7; },
    texFix: fillCutRows, minPart: 1500, simplify: 9000, sloppy: true },
  // "the house lost at sea": the tall gothic house on its grassy mound, with its trees; the sea, sky, mist,
  // floating debris, dust and the mirrored reflections under the water are left out
  seahouse: { src: U + '08df5c40-the_house_lost_at_sea.glb', scale: 0.55, yaw: 0,
    keep: (n, m) => !/^(Mist|Waves|ParticleDustShdr|Debris|ReflShdr|BushesRefl|ShrubsRefl|TreeTrunkRefl)$/.test(m) && !/^(Sea|Sky|Fog|Wave|particle|DebrisOk|Bushesefl|Object_108$|1$|3$|4$)/.test(n),
    drop: (vs, c) => c[1] < -0.35,
    mat: (m) => { if (/WindowLight/.test(m.getName())) m.setEmissiveFactor([1, 0.75, 0.4]); },
    // it was made for unlit display, its walls very dark (their light is in the texture): lift them for the town's lighting
    texMat: { HouseShdr: lift(3.2), WindowsInsideShdr: lift(2.2) },
    vcol: true,   // the grass, shrubs and window lights take their colour from the vertices
    simplify: 13000, simpErr: 0.02, q: 74 },
  // Mount Everest and the peaks around it (a terrain tile, about 12.8 km across): the far backdrop
  himalaya: { src: U + '1fd83abe-mount_everest_and_mountains__tibet__nepal.glb', scale: 1, yaw: 0,
    texFix: fillCutRows, tex: 1024, q: 82, simplify: 4200, simpErr: 0.01 },
  // ---- trees (js/trees.js): every tree in Jais, the valleys and the shrine islands. Each is 1 m tall here (the
  // game sizes each copy), stood on y = 0 and centred on its trunk. Three uploads were cut off in transfer: only
  // the pine's last texture rows and the broadleaf's leaf normal map (not used) were lost ----
  pine: { src: U + '4da865ca-pine_tree.glb', trunk: true, fitH: 1, tex: 512, texFix: fillCutRows },
  // the broadleaf with red-pink leaves (its leaves are cards: simplified gently so they keep their shape)
  leafy: { src: U + '4c307003-tree_2.glb', trunk: true, fitH: 1, tex: 1024, simplify: 3000, simpErr: 0.04 },
  // a scanned bare, dead tree
  dead: { src: U + 'a318deab-tree.glb', trunk: true, fitH: 1, tex: 1024, simplify: 6000, sloppy: true, minPart: 60 },
  // "drevo": a scanned fallen trunk; the snow-covered ground sheet it was scanned on is cut away
  fallen: { src: U + '9b60d394-drevo.glb', pre: true, centre: true, tex: 1024, texFix: fillCutRows, simplify: 2000, simpErr: 0.02, minPart: 300,
    drop: (vs, c) => c[1] < 0.4 && Math.abs(normal(vs)[1]) > 0.45 },
};
