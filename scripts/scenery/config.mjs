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
  // ---- the Indian street (js/scenery.js, swaps.js, vehicles.js). Look-only shops: front to -z, height set by fitH ----
  // the street shop, the other shop, the bhelpuri stall and the gazebo; the rickshaw and the bobber are vehicles (fitXZ: their length)
  streetshop: { src: U + '99bf9b3c-indian_street_shop_2.glb', yaw: Math.PI / 2, fitH: 3.6, tex: 1024, q: 78 },
  shop2: { src: U + '231a6ec9-indian_shop_2.glb', yaw: Math.PI / 2, fitH: 6, sideTint: [0.86, 0.72, 0.52], tex: 1024, q: 78 },
  bhelpuri: { src: U + '376f5247-bhelpuri_shop_by_ajay_indian_local_shop.glb', yaw: Math.PI, bakeSkin: true, fitH: 2.6, tex: 1024, q: 78, texFix: fillCutRows, simplify: 6000, simpErr: 0.2 },
  gazebo: { src: U + 'cb1d2f6f-indian_gazebo_2.glb', yaw: 0, fitH: 4.5, tex: 1024, q: 76, simplify: 10000, sloppy: true },
  rickshaw: { src: U + '20d83032-indian_ricksha.glb', yaw: 0, centre: true, fitXZ: 2.75, tex: 512, q: 80, simplify: 26000, sloppy: true },
  // the bobber faces +x in the upload: turned to face +z, centred on its wheelbase. bobber is the one you ride, bobber_lite the parked ones
  bobber: { src: U + '240be6c0-bobber_indian.glb', yaw: -Math.PI / 2, centre: true, fitXZ: 2.2, tex: 1024, q: 80, simplify: 14000, sloppy: true },
  bobber_lite: { src: U + '240be6c0-bobber_indian.glb', yaw: -Math.PI / 2, centre: true, fitXZ: 2.2, tex: 512, q: 72, simplify: 6500, sloppy: true },
};


// ---- the new houses (js/scenery.js, "homes"): look-only, they replace most of the Indian shops. The two FBX packs came cut
// off in transfer (fbx.mjs reads what is there: nearly every house survived, but not the node transforms); the buildings
// of both share one colour-palette texture. Front to -z: yaw 0 for the ones that already face it, PI for those with the door on +z.
const HOUSE_PACK = U + 'c6219efa-LowPoly_House_20_Pack_fbx.fbx', FARM_PACK = U + '6d3e3f0f-LowPoly_Farm_02_FBX.fbx', PALETTE = U + 'textures/color_512x512.jpg';
// [name, geometry in the FBX, yaw]
const PACK_HOUSES = [['h001', 'Cube.001', 0], ['h002', 'Cube.002', 0], ['h024', 'Cube.024', 0], ['h042', 'Cube.042', Math.PI], ['h050', 'Cube.050', 0], ['h054', 'Cube.054', 0], ['h056', 'Cube.056', Math.PI],
  ['h072', 'Cube.072', 0], ['h076', 'Cube.076', 0], ['h092', 'Cube.092', 0], ['h098', 'Cube.098', Math.PI], ['h123', 'Cube.123', Math.PI], ['h180', 'Cube.180', 0]];
const FARM_BUILDINGS = [['fc013', 'Cube.013', Math.PI], ['fc546', 'Cube.546', Math.PI], ['fp005', 'Plane.005', Math.PI], ['fp014', 'Plane.014', Math.PI], ['fc909', 'Cube.909', Math.PI], ['fc963', 'Cube.963', Math.PI],
  ['fc1139', 'Cube.1139', Math.PI], ['fp002', 'Plane.002', Math.PI], ['fp003', 'Plane.003', Math.PI],
  ['barn1', 'Cube.1313', Math.PI], ['barn2', 'Plane.219', Math.PI], ['barn3', 'Cube.1332', Math.PI], ['barn4', 'Cube.1338', Math.PI]];
for (const [name, geo, yaw] of PACK_HOUSES) CONFIG[name] = { fbx: { file: HOUSE_PACK, geo, tex: PALETTE }, scale: 0.75, yaw, palette: true, vcol: true, simplify: 4500, sloppy: true };
for (const [name, geo, yaw] of FARM_BUILDINGS) CONFIG[name] = { fbx: { file: FARM_PACK, geo, tex: PALETTE }, scale: 0.72, yaw, palette: true, vcol: true, simplify: 5000, sloppy: true };
// "autumn house": a diorama (a round hill with a road, a car and trees); only the house itself is kept
CONFIG.autumn = { src: U + '6a2ab94a-autumn_house.glb', scale: 0.45, yaw: Math.PI / 2, crop: [-15, 1.2, 3, 15, 40, 21].map((v) => v * 0.45),     // the house's own box, turned with it (yaw PI/2: x' = z, z' = -x)
  // the lawn and its leaf piles (flat, low) round the house go too: the town has its own ground
  drop: (vs, c) => Math.abs(normal(vs)[1]) > 0.85 && c[1] < 2.6 * 0.45, tex: 1024, q: 80, simplify: 9000, simpErr: 0.01 };
