// Uploaded Mixamo packs (one character .fbx + one .fbx per animation) -> one game-ready .glb each:
// the character, its animations as named clips, a far-away low-poly copy of its body, small webp textures.
//
// usage: UPLOADS=/folder/with/the/unzipped/packs node build.mjs [name|all]   -> out/<name>.glb
// then copy out/*.glb to laststand/assets/models/ (see laststand/assets/README.md, "The zombies and MAW").
//
// What it does to each one:
//   - converts the FBX files with FBX2glTF (metres, Y up, the character faces +Z)
//   - copies every animation onto the character's own bones (matched by name) and names the clip
//   - takes the walk forward out of the moving clips (walk, run, crawls: "root motion"), keeping the bob and
//     the sway, and stores how fast each one walks (metres a second, at the model's own size) in the scene's
//     extras, so the game can match the stride to the speed and the feet don't slide
//   - makes the transparent-looking materials opaque (FBX2glTF reads their factor as 0); hair cards keep a cut-out
//   - drops normal maps (the game lights everything with Lambert), shrinks the textures to webp
//   - simplifies the body a little, and adds a much lower copy of it (nodes named "LOD_far") for zombies far away
//   - meshopt-compresses the lot
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, weld, simplify, resample, textureCompress, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
await MeshoptEncoder.ready; await MeshoptDecoder.ready; await MeshoptSimplifier.ready;

const require = createRequire(import.meta.url);
const FBX2GLTF = path.join(path.dirname(require.resolve('fbx2gltf/package.json')), 'bin', { linux: 'Linux', darwin: 'Darwin', win32: 'Windows_NT' }[process.platform], process.platform === 'win32' ? 'FBX2glTF.exe' : 'FBX2glTF');
const UPLOADS = process.env.UPLOADS || '.';
const OUT = process.env.OUT || './out';
const TMP = path.join(OUT, 'tmp');
fs.mkdirSync(TMP, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

// the zombie packs all carry the same twelve Mixamo clips; these are the ones the game uses
const ZOMBIE_CLIPS = {
  idle: 'zombie idle', walk: 'zombie walk', run: 'zombie run', attack: 'zombie attack',
  scream: 'zombie scream', death: 'zombie death', dying: 'zombie dying', crawl: 'zombie crawl', crawlRun: 'running crawl',
};
const CONFIG = {
  prisoner:   { dir: 'Scary_Zombie_Pack',   body: 'Prisoner B Styperek.fbx',    clips: ZOMBIE_CLIPS, tris: 9000, far: 1400, tex: 1024 },
  girlscout:  { dir: 'Scary_Zombie_Pack_1', body: 'Girlscout T Masuyama.fbx',   clips: ZOMBIE_CLIPS, tris: 9000, far: 1400, tex: 1024 },
  zombiegirl: { dir: 'Scary_Zombie_Pack_2', body: 'Zombiegirl W Kurniawan.fbx', clips: ZOMBIE_CLIPS, tris: 9000, far: 1400, tex: 1024 },
  parasite:   { dir: 'Scary_Zombie_Pack_3', body: 'Parasite L Starkie.fbx',     clips: ZOMBIE_CLIPS, tris: 9000, far: 1400, tex: 1024 },
  // the crawler and the feast: one new zombie (crawling, and lying asleep), and the survivor who bites it
  // (the clips are named after the FBX files: crawl.fbx, sleep.fbx, bite.fbx in UPLOADS/Feast)
  fuzz: { dir: 'Feast', body: 'crawl.fbx', clips: { crawl: 'crawl', crawlRun: 'crawl', death: 'sleep', sleep: 'sleep' }, tris: 9000, far: 0, tex: 1024 },
  survivor: { dir: 'Feast', body: 'bite.fbx', clips: { bite: 'bite' }, tris: 9000, far: 0, tex: 1024 },
  // the Creature NPC pack: MAW, the railyard giant (js/boss.js)
  maw: {
    dir: 'Creature_NPC_Pack', body: 'Maw J Laygo.fbx', tris: 14000, far: 0, tex: 2048,
    clips: { idle: 'mutant idle', breathe: 'mutant breathing idle', walk: 'mutant walking', run: 'mutant run', swipe: 'mutant swiping',
      jump: 'mutant jumping', dying: 'mutant dying', flex: 'mutant flexing muscles' },
    // its torn loincloth is drawn on a pale backing that an opacity map (not in the FBX) used to cut away:
    // cut it out of the diffuse here (the pale pixels in the loincloth's corner of the sheet)
    cutout: { tex: /diffuse/i, rect: [1775, 0, 2048, 525], pale: 85 },
  },
};
// clips that walk forward: the forward travel is taken out (and measured)
const MOVING = new Set(['walk', 'run', 'crawl', 'crawlRun']);

const clean = (n) => n.replace(/^mixamorig\d*:?/, '');
const names = !process.argv[2] || process.argv[2] === 'all' ? Object.keys(CONFIG) : process.argv.slice(2);
for (const name of names) await build(name, CONFIG[name]);

function fbx(src, out) {
  execFileSync(FBX2GLTF, ['-b', '-i', src, '-o', out], { stdio: 'pipe' });
  return out + '.glb';
}

async function build(name, C) {
  const dir = path.join(UPLOADS, C.dir);
  console.log('==', name);
  const doc = await io.read(fbx(path.join(dir, C.body), path.join(TMP, name)));
  const root = doc.getRoot(), buf = root.listBuffers()[0];
  for (const a of root.listAnimations()) a.dispose();
  for (const n of root.listNodes()) n.setName(clean(n.getName()));
  const byName = new Map(root.listNodes().map((n) => [n.getName(), n]));
  const hips = byName.get('Hips');
  const speeds = {};

  // ---- the animations ----
  for (const [clip, file] of Object.entries(C.clips)) {
    const src = await io.read(fbx(path.join(dir, file + '.fbx'), path.join(TMP, name + '_' + clip)));
    const a0 = src.getRoot().listAnimations().sort((a, b) => b.listChannels().length - a.listChannels().length)[0];
    const anim = doc.createAnimation(clip);
    let T = 0;
    for (const ch of a0.listChannels()) {
      const tn = ch.getTargetNode(); if (!tn) continue;
      const node = byName.get(clean(tn.getName())); if (!node) continue;
      const s = ch.getSampler(), inp = s.getInput().getArray().slice(), out = s.getOutput().getArray().slice();
      T = Math.max(T, inp[inp.length - 1]);
      if (node === hips && ch.getTargetPath() === 'translation') {
        const n = inp.length, t0 = inp[0], t1 = inp[n - 1] || 1;
        if (MOVING.has(clip)) {
          // take out the straight-line travel; what is left is the sway and the bob
          const dx = out[(n - 1) * 3] - out[0], dz = out[(n - 1) * 3 + 2] - out[2];
          for (let i = 0; i < n; i++) { const k = (inp[i] - t0) / (t1 - t0); out[i * 3] -= dx * k; out[i * 3 + 2] -= dz * k; }
          speeds[clip] = +(Math.hypot(dx, dz) / (t1 - t0)).toFixed(3);
        }
      }
      const sampler = doc.createAnimationSampler()
        .setInput(doc.createAccessor().setType('SCALAR').setArray(inp).setBuffer(buf))
        .setOutput(doc.createAccessor().setType(s.getOutput().getType()).setArray(out).setBuffer(buf))
        .setInterpolation(s.getInterpolation());
      anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(ch.getTargetPath()).setSampler(sampler));
    }
    console.log('  ', clip, T.toFixed(2) + 's', anim.listChannels().length, 'channels', speeds[clip] ? speeds[clip] + ' m/s' : '');
  }
  root.listScenes()[0].setExtras({ speeds });

  // ---- materials ----
  for (const m of root.listMaterials()) {
    m.setNormalTexture(null); m.setOcclusionTexture(null); m.setMetallicRoughnessTexture(null);
    m.setMetallicFactor(0); m.setRoughnessFactor(1);
    const f = m.getBaseColorFactor(); m.setBaseColorFactor([f[0], f[1], f[2], 1]);
    // cut-out only where the texture really has holes (hair cards, torn cloth); everything else opaque
    const t = m.getBaseColorTexture();
    if (t && C.cutout && C.cutout.tex.test(t.getName())) {
      const { data, info } = await sharp(Buffer.from(t.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const [x0, y0, x1, y1] = C.cutout.rect, W = info.width / 2048;
      for (let y = Math.round(y0 * W); y < Math.min(info.height, Math.round(y1 * W)); y++) for (let x = Math.round(x0 * W); x < Math.min(info.width, Math.round(x1 * W)); x++) {
        const i = (y * info.width + x) * 4;
        if (Math.max(data[i], data[i + 1], data[i + 2]) > C.cutout.pale) data[i + 3] = 0;
      }
      t.setImage(new Uint8Array(await sharp(data, { raw: info }).png().toBuffer())).setMimeType('image/png');
    }
    let holes = 0;
    if (t) {
      const { data, info } = await sharp(Buffer.from(t.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let n = 0; for (let i = 3; i < data.length; i += 4) if (data[i] < 128) n++;
      holes = n / (info.width * info.height);
    }
    if (holes > 0.002) { m.setAlphaMode('MASK'); m.setAlphaCutoff(0.5); m.setDoubleSided(true); } else m.setAlphaMode('OPAQUE');
    console.log('   material', m.getName(), m.getAlphaMode(), (holes * 100).toFixed(1) + '% holes', m.getEmissiveTexture() ? '+glow' : '');
  }

  await doc.transform(prune(), dedup(), weld());
  // ---- a little lighter ----
  const count = () => { let n = 0; for (const me of root.listMeshes()) for (const p of me.listPrimitives()) n += p.getIndices().getCount() / 3; return n; };
  const before = count();
  if (before > C.tris) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: C.tris / before, error: 0.004, lockBorder: true }));
  console.log('   triangles', before, '->', count());

  // ---- the far-away copy: same skin, far fewer triangles, its own (compacted) vertices ----
  if (C.far) {
    const near = count();
    for (const node of root.listNodes()) {
      const me = node.getMesh(); if (!me || node.getName().startsWith('LOD_far')) continue;
      const fm = doc.createMesh(me.getName() + '_far');
      for (const p of me.listPrimitives()) {
        const ix = p.getIndices().getArray(), P = p.getAttribute('POSITION').getArray();
        const want = Math.min(ix.length / 3, Math.max(60, Math.round((ix.length / 3) * (C.far / near)))) * 3;
        const [out] = MeshoptSimplifier.simplify(new Uint32Array(ix), P, 3, want, 0.05, []);
        // keep only the vertices it uses
        const map = new Map(), used = [];
        for (const v of out) if (!map.has(v)) { map.set(v, used.length); used.push(v); }
        const np = doc.createPrimitive().setMaterial(p.getMaterial());
        for (const sem of p.listSemantics()) {
          const a = p.getAttribute(sem), sz = a.getElementSize(), src = a.getArray();
          const dst = new src.constructor(used.length * sz);
          used.forEach((v, i) => { for (let k = 0; k < sz; k++) dst[i * sz + k] = src[v * sz + k]; });
          np.setAttribute(sem, doc.createAccessor().setType(a.getType()).setArray(dst).setNormalized(a.getNormalized()).setBuffer(buf));
        }
        np.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(out.map((v) => map.get(v)))).setBuffer(buf));
        fm.addPrimitive(np);
      }
      const fn = doc.createNode('LOD_far_' + node.getName()).setMesh(fm).setSkin(node.getSkin());
      for (const par of node.listParents()) if (par.propertyType === 'Node' || par.propertyType === 'Scene') { par.addChild(fn); break; }
    }
    let far = 0; for (const me of root.listMeshes()) if (me.getName().endsWith('_far')) for (const p of me.listPrimitives()) far += p.getIndices().getCount() / 3;
    console.log('   far copy', far, 'triangles');
  }

  // ---- textures, animation keys, compression ----
  await doc.transform(
    resample({ tolerance: 1e-4 }),
    prune({ keepAttributes: false }),
    dedup(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [C.tex, C.tex], quality: 82 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  // the eye texture of the girl scout is a full 2048 sheet for two small eyes: smaller is plenty
  for (const t of root.listTextures()) if (/eye/i.test(t.getName())) t.setImage(new Uint8Array(await sharp(Buffer.from(t.getImage())).resize(256, 256).webp({ quality: 82 }).toBuffer()));
  const file = path.join(OUT, name + '.glb');
  await io.write(file, doc);
  console.log('   ->', file, (fs.statSync(file).size / 1024 / 1024).toFixed(2), 'MB');
}
