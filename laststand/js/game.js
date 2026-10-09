// JAIS: LAST STAND — game orchestration.
import * as THREE from 'three';
import { buildTextures } from './textures.js';
import { createWorldContext, buildWorld } from './world.js';
import { buildProps, part, merge, Bx, Cy, WHEEL } from './props.js';
import { Nav } from './nav.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { Arsenal, WEAPONS, AMMO } from './weapons.js';
import { Enemies } from './enemies.js';
import { Loot, FOOD, AMMO_PICK, rollFood, rollAmmo, rollWeapon, containerLoot } from './loot.js';
import { Audio } from './audio.js';
import { LightPool } from './lights.js';
import { loadUserAssets } from './assets.js';
import { buildDisplays, animateDisplays } from './displays.js';
import { TownMap } from './minimap.js';
import { buildSecret, prepareMaterials, Secret } from './secret.js';
import { ROADS, ZONES, RAIL, KAMAKHYA, roadInfo, BOUNDS } from './layout.js';
import { makeRng, clamp, store } from './util.js';
import { Physics } from './physics.js';

const $ = (id) => document.getElementById(id);

const BROADCAST = [
  ['...खर्र... यह आपातकालीन प्रसारण है... जो भी ज़िंदा है, सुनें...', '...this is an emergency broadcast... anyone alive, listen...'],
  ['आख़िरी राहत ट्रेन भोर से पहले गुरु गोरखनाथ धाम स्टेशन पर रुकेगी।', 'The last relief train stops at Guru Gorakhnath Dham station before dawn.'],
  ['पर स्टेशन का सिग्नल बंद पड़ा है। केबिन की चाबी और एक नया फ्यूज़ चाहिए।', 'But the station signal is dead. You need the signal-cabin key and a new fuse.'],
  ['चाबी... जायस सिटी स्टेशन मास्टर, बस अड्डे के दफ़्तर या नौगजी चौकी में...', 'The key... with the Jais City station master, the bus adda office, or the Naugazi chowki...'],
  ['फ्यूज़... वहाबगंज की बिजली की दुकान... आलिया मार्केट... खर्र...', 'A fuse... the electrical shop in Wahabganj... Alia Market... (static)'],
  ['आवाज़ मत करना। वो आवाज़ सुनकर आते हैं। ...खर्र...', "Don't make noise. They come to sound. ...(static)"],
];

export class Game {
  constructor() {
    this.state = 'boot';
    this.canvas = $('game');
    this.time = 0; this.dt = 0.016;
  }

  // ================= setup =================
  async init(progress) {
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.mobile = touch && Math.min(screen.width, screen.height) < 900;
    const saved = store('jls_settings') || {};
    this.quality = saved.quality && saved.quality !== 'auto' ? saved.quality : this.mobile ? 'med' : 'high';
    const R = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: this.quality === 'high', powerPreference: 'high-performance', stencil: true });
    this.maxDpr = this.quality === 'high' ? Math.min(devicePixelRatio, 1.75) : this.quality === 'med' ? Math.min(devicePixelRatio, 1.4) : 1;
    this.dpr = this.maxDpr;
    R.setPixelRatio(this.dpr);
    R.setSize(innerWidth, innerHeight);
    R.outputColorSpace = THREE.SRGBColorSpace;
    R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.15;
    R.autoClear = false; R.info.autoReset = false;
    const scene = this.scene = new THREE.Scene();
    this.wscene = new THREE.Scene(); // view-model scene
    const cam = this.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 170);
    scene.add(cam);
    addEventListener('resize', () => this.resize());
    progress(0.05, 'बनावट तैयार हो रही है… textures');
    await (document.fonts?.ready || Promise.resolve());
    try { await document.fonts.load('bold 40px "Noto Sans Devanagari"'); } catch (e) { /* system font */ }
    await tick();
    const tex = this.tex = buildTextures();
    progress(0.18, 'जायस बन रहा है… building the town');
    await tick();
    const W = this.W = createWorldContext();
    buildWorld(W);
    buildSecret(W);
    const signTex = W.signs.finish();
    this.physics = W.P;
    const mats = this.mats = this.makeMaterials(tex, signTex);
    prepareMaterials(mats);
    progress(0.4, 'सड़कें, खंभे, तार… props');
    await tick();
    this.doors = this.buildDoors();
    W.lowPoly = this.quality !== 'high';
    this.props = buildProps(W, scene, mats, tex);
    W.B.build(scene, mats);
    this.buildWell();
    this.buildSky();
    for (const fn of W.deferred) fn(scene, mats);
    progress(0.55, 'रास्ते… navigation');
    await tick();
    this.nav = new Nav(this.physics);
    this.townMap = new TownMap(W);
    progress(0.62, 'तस्वीरें और बैनर… your images');
    this.assets = await loadUserAssets((p) => progress(0.62 + p * 0.25, 'तस्वीरें और बैनर… your images'));
    this.displays = buildDisplays(W, scene, this.assets, tex);
    // lights
    scene.add(new THREE.HemisphereLight(0x6f86c0, 0x2a2218, 1.05));
    const moon = new THREE.DirectionalLight(0xa8bcff, 0.75); moon.position.set(-60, 120, -40); scene.add(moon);
    this.lightPool = new LightPool(scene, W.lights, this.quality === 'high' ? 8 : this.quality === 'med' ? 5 : 3);
    this.torch = new THREE.SpotLight(0xfff1dc, 0, 32, 0.42, 0.55, 1.2);
    cam.add(this.torch); this.torch.position.set(0.15, -0.1, 0); cam.add(this.torch.target); this.torch.target.position.set(0, 0, -5);
    this.torchOn = false;
    // systems
    this.audio = new Audio();
    this.input = new Input(this.canvas, $('touch'));
    this.player = new Player(cam, this.physics, this.audio);
    const gunMats = {
      gun: new THREE.MeshPhongMaterial({ color: 0x2c2d30, shininess: 60, specular: 0x444444 }),
      wood: new THREE.MeshLambertMaterial({ map: tex.wood, color: 0xa87a54 }),
      skin: new THREE.MeshLambertMaterial({ color: 0xa8714c }),
      sleeve: new THREE.MeshLambertMaterial({ color: 0x3c4148 }),
      brass: new THREE.MeshLambertMaterial({ color: 0xc8a040 }),
    };
    this.wscene.add(new THREE.HemisphereLight(0x8090b0, 0x302820, 1.4));
    const wl = new THREE.DirectionalLight(0xffffff, 0.5); wl.position.set(1, 2, 1); this.wscene.add(wl);
    this.arsenal = new Arsenal(cam, scene, this.wscene, tex, gunMats, this.audio);
    this.fx = this.arsenal.fx;
    this.enemies = new Enemies(scene, { grime: tex.grime }, this);
    this.loot = new Loot(scene, mats.vcol);
    this.buildTrains();
    this.secret = new Secret(this);
    this.secret.build();
    // cached lists
    this.enterables = W.buildings.filter((b) => b.tpl);
    this.stairs = this.collectStairs();
    progress(0.95, 'तैयार… ready');
    this.bindUI();
    this.state = 'menu';
    this.renderMenuBackdrop();
    requestAnimationFrame((t) => this.frame(t));
  }

  makeMaterials(tex, signTex) {
    const L = (o) => new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true }, o));
    return {
      facade: L({ map: tex.facade, emissiveMap: tex.facadeEmissive, emissive: 0xffd9a0, emissiveIntensity: 0.9 }),
      plaster: L({ map: tex.plaster }), brick: L({ map: tex.brick }), asphalt: L({ map: tex.asphalt }), dirt: L({ map: tex.dirt }),
      khadanja: L({ map: tex.khadanja }), tile: L({ map: tex.tile }), concrete: L({ map: tex.concrete }), wood: L({ map: tex.wood }),
      metal: L({ map: tex.metal }), fabric: L({ map: tex.fabric, side: THREE.DoubleSide }),
      sign: L({ map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: 0.3 }),
      plain: L({}), glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
      vcol: L({}), leaves: new THREE.MeshLambertMaterial({ flatShading: true }),
      wire: new THREE.LineBasicMaterial({ vertexColors: true }),
      fairyPoints: new THREE.PointsMaterial({ size: 0.42, map: tex.glow, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      glowPoints: new THREE.PointsMaterial({ size: 1.3, map: tex.glow, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      pool: new THREE.MeshBasicMaterial({ map: tex.pool, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.32, toneMapped: false }),
      shikhara: new THREE.MeshLambertMaterial({ map: tex.plaster, color: 0xf6e2c4 }),
      shikharaRib: new THREE.MeshLambertMaterial({ color: 0xe08a30 }),
      gold: new THREE.MeshPhongMaterial({ color: 0xd4a020, emissive: 0x3a2a00, shininess: 80 }),
      dark: new THREE.MeshLambertMaterial({ color: 0x222222 }),
      flag: new THREE.MeshBasicMaterial({ color: 0xff7a10, side: THREE.DoubleSide }),
      water: new THREE.MeshPhongMaterial({ color: 0x050a0e, shininess: 120, specular: 0x8899aa }),
    };
  }

  resize() {
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
  }

  // ================= doors =================
  buildDoors() {
    const W = this.W, list = [];
    const woodM = new THREE.MeshLambertMaterial({ map: this.tex.wood, color: 0xb08060 });
    const metalM = new THREE.MeshLambertMaterial({ map: this.tex.metal, color: 0x9aa4ac });
    for (const d of W.doors) {
      const pivot = new THREE.Group();
      pivot.position.set(d.hinge[0], d.hinge[1], d.hinge[2]);
      pivot.rotation.y = d.closedYaw;
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(d.w, d.h, d.t), d.metal ? metalM : woodM);
      leaf.position.set(d.w / 2, d.h / 2, 0);
      pivot.add(leaf);
      // a small handle
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.08), this.mats.dark); h.position.set(d.w - 0.1, 1.0, 0); pivot.add(h);
      this.scene.add(pivot);
      d.pivot = pivot; d.angle = 0; d.target = 0;
      const c = Math.cos(d.closedYaw), s = Math.sin(d.closedYaw);
      d.cx = d.hinge[0] + c * d.w / 2; d.cz = d.hinge[2] - s * d.w / 2;
      d.box = this.physics.add(d.cx, d.hinge[1] + d.h / 2, d.cz, d.w / 2, d.h / 2, 0.06, d.closedYaw, 'door');
      d.maxHp = d.hp;
      list.push(d);
    }
    return list;
  }

  resetDoors() {
    for (const d of this.doors) {
      d.open = false; d.broken = false; d.target = 0; d.angle = 0; d.hp = d.maxHp;
      d.pivot.rotation.set(0, d.closedYaw, 0); d.pivot.visible = true; d.box.enabled = true;
      d.locked = d.origLocked ?? d.locked; d.origLocked = d.locked;
    }
  }

  doorNear(x, z, r) {
    let best = null, bd = r;
    for (const d of this.doors) {
      if (d.open || d.broken) continue;
      const dd = Math.hypot(d.cx - x, d.cz - z);
      if (dd < bd) { bd = dd; best = d; }
    }
    return best;
  }

  openDoor(d, byPlayer) {
    if (d.broken) return;
    const P = this.player;
    const c = Math.cos(d.closedYaw), s = Math.sin(d.closedYaw);
    // which side of the door plane is the opener on? swing away from them
    const ref = byPlayer ? P.pos : (this._doorOpener || P.pos);
    const nz = (ref.x - d.cx) * s + (ref.z - d.cz) * c;
    d.open = true; d.target = nz > 0 ? 1.55 : -1.55; d.box.enabled = false;
    this.audio.play('creak', { pos: [d.cx, 1.2, d.cz], vol: 0.55 });
    this.noise({ x: d.cx, z: d.cz }, 6, 'door');
  }

  closeDoor(d) {
    // don't close onto the player
    if (Physics.circleOverlaps(d.box, this.player.pos.x, this.player.pos.z, 0.4)) return;
    d.open = false; d.target = 0; d.box.enabled = true;
    this.audio.play('slam', { pos: [d.cx, 1.2, d.cz], vol: 0.35 });
  }

  breakDoor(d) {
    d.broken = true; d.open = true; d.box.enabled = false; d.target = 1.55;
    d.pivot.rotation.z = 0.3;
    this.audio.play('bang', { pos: [d.cx, 1.2, d.cz], vol: 1, rate: 0.7 });
    this.fx.burst([d.cx, 1.0, d.cz], [0, 0.5, 0], 14, [0.45, 0.32, 0.2], 2.5);
    this.noise({ x: d.cx, z: d.cz }, 20, 'door');
  }

  // ================= well, sky, trains =================
  buildWell() {
    const w = this.W.special.wellWater;
    const m = new THREE.Mesh(new THREE.CircleGeometry(w.r, 20).rotateX(-Math.PI / 2), this.mats.water);
    m.position.set(w.x, 0.08, w.z); this.scene.add(m);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(w.r, w.r, 0.9, 20, 1, true), new THREE.MeshLambertMaterial({ map: this.tex.brick, side: THREE.BackSide, color: 0x6a5a50 }));
    inner.position.set(w.x, 0.5, w.z); this.scene.add(inner);
  }

  buildSky() {
    const fogCol = new THREE.Color(0x0d1520);
    this.scene.fog = new THREE.FogExp2(fogCol, 0.0165);
    this.scene.background = fogCol;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 24, 12), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x03060d) }, hor: { value: new THREE.Color(0x1a2230) }, glow: { value: new THREE.Color(0x3a2c22) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 glow; varying vec3 vP; void main(){ float h = max(vP.y, 0.0); vec3 c = mix(hor, top, pow(h, 0.45)); c += glow * pow(1.0 - h, 6.0) * 0.6; gl_FragColor = vec4(c, 1.0); }',
    }));
    sky.renderOrder = -10;
    this.sky = sky; this.scene.add(sky);
    // stars + moon
    const sp = [];
    for (let i = 0; i < 700; i++) {
      const a = Math.random() * Math.PI * 2, y = 0.15 + Math.random() * 0.85, r = Math.sqrt(1 - y * y);
      sp.push(Math.cos(a) * r * 140, y * 140, Math.sin(a) * r * 140);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 0.9, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8, depthWrite: false }));
    this.scene.add(this.stars);
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glow, color: 0xdfe8ff, fog: false, depthWrite: false, toneMapped: false }));
    this.moon.scale.setScalar(16); this.scene.add(this.moon);
  }

  buildTrains() {
    const loco = (c1, c2) => merge([
      part(Bx(3.1, 3.2, 18), c1, 0, 2.3, 0), part(Bx(3.12, 0.6, 18.02), c2, 0, 1.5, 0), part(Bx(2.6, 0.9, 0.08), 0x1a2028, 0, 3.2, 9.02),
      part(Bx(3.0, 0.4, 17), 0x444444, 0, 4.1, 0), part(Bx(0.4, 0.4, 0.1), 0xfff2c0, 0, 3.9, 9.05),
      ...[-6, -4, 4, 6].map((z) => part(WHEEL(0.55, 0.3), 0x111111, 1.3, 0.55, z, 0, 0, Math.PI / 2)),
      ...[-6, -4, 4, 6].map((z) => part(WHEEL(0.55, 0.3), 0x111111, -1.3, 0.55, z, 0, 0, Math.PI / 2)),
    ]);
    const coach = (c) => {
      const p = [part(Bx(3.1, 2.9, 21), c, 0, 2.25, 0), part(Bx(3.0, 0.5, 20.6), 0x555555, 0, 3.9, 0), part(Bx(3.14, 0.12, 21.02), 0xe8d8a0, 0, 2.9, 0)];
      for (let i = -4; i <= 4; i++) p.push(part(Bx(3.14, 0.7, 1.2), 0x1a2028, 0, 2.6, i * 2.1));
      for (const z of [-9.6, 9.6]) p.push(part(Bx(3.14, 2.0, 0.9), 0x2a2a30, 0, 1.95, z));
      for (const z of [-7, -5.5, 5.5, 7]) { p.push(part(WHEEL(0.48, 0.25), 0x111111, 1.3, 0.48, z, 0, 0, Math.PI / 2)); p.push(part(WHEEL(0.48, 0.25), 0x111111, -1.3, 0.48, z, 0, 0, Math.PI / 2)); }
      return merge(p);
    };
    const wagon = () => merge([part(Bx(3.0, 3.0, 14), 0x6a3a28, 0, 2.2, 0), part(Bx(3.02, 0.2, 14.02), 0x3a2a20, 0, 3.7, 0),
      ...[-5, -3.6, 3.6, 5].map((z) => part(WHEEL(0.45, 0.25), 0x111111, 1.2, 0.45, z, 0, 0, Math.PI / 2)),
      ...[-5, -3.6, 3.6, 5].map((z) => part(WHEEL(0.45, 0.25), 0x111111, -1.2, 0.45, z, 0, 0, Math.PI / 2))]);
    const mat = this.mats.vcol;
    const make = (cars) => {
      const g = new THREE.Group();
      let x = 0;
      for (const c of cars) {
        const m = new THREE.Mesh(c.geo, mat);
        m.rotation.y = Math.PI / 2;
        m.position.x = x - c.len / 2; x -= c.len + 0.8;
        g.add(m);
      }
      g.userData.len = -x;
      const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glow, color: 0xfff0c0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      head.scale.setScalar(3); head.position.set(0.2, 3.9, 0); g.add(head);
      g.visible = false; this.scene.add(g);
      return g;
    };
    const lg = loco(0x8a1c1c, 0xe8d8a0), cg = coach(0x2a4a8a), wg = wagon();
    this.freight = make([{ geo: loco(0x2a4a7a, 0xe0c040), len: 18 }, ...Array.from({ length: 16 }, () => ({ geo: wg, len: 14 }))]);
    this.rescue = make([{ geo: lg, len: 18 }, ...Array.from({ length: 6 }, () => ({ geo: cg, len: 21 }))]);
    this.trainLight = { x: 0, y: 4, z: 0, color: 0xfff0c0, intensity: 0, dist: 30, dynamic: true, major: true, on: false };
    this.W.lights.push(this.trainLight);
  }

  // ================= footstep surfaces =================
  surface(x, z) {
    if (this.inside) return 'tile';
    for (const r of this._roads || (this._roads = Object.values(ROADS).map((r) => ({ r, i: roadInfo(r) })))) {
      const dx = x - r.r.a[0], dz = z - r.r.a[1];
      const along = dx * r.i.ux + dz * r.i.uz, across = Math.abs(dx * r.i.nx + dz * r.i.nz);
      if (along > -1 && along < r.i.len + 1 && across < r.r.w / 2) return r.r.s === 'lane' ? 'tile' : 'asphalt';
    }
    if (z < -160 && z > -192) return 'dirt';
    return 'dirt';
  }
  indoorFloor() { return this.inside ? 'tile' : 'asphalt'; }

  // ================= stairs lookup for zombies =================
  collectStairs() { return this.W.stairsList || []; }
  stairFor(e, P) {
    let best = null, bd = 12;
    for (const s of this.stairs) {
      if (Math.abs(s.y0 - e.pos.y) > 0.6) continue;
      const d = Math.hypot(s.bx - e.pos.x, s.bz - e.pos.z);
      const dp = Math.hypot(s.tx - P.pos.x, s.tz - P.pos.z);
      if (dp > 16) continue;
      if (d < bd) { bd = d; best = s; }
    }
    if (!best) return null;
    return bd < 0.8 ? [best.tx, best.tz] : [best.bx, best.bz];
  }

  // ================= run lifecycle =================
  newRun() {
    const r = this.rng = makeRng((Math.random() * 1e9) | 0);
    const W = this.W;
    this.audio.init(); this.audio.resume();
    this.audio.stopAll();
    this.player.dead = false; this.player.health = 100; this.player.stamina = 100; this.player.distance = 0; this.player.recoil.x = this.player.recoil.y = 0;
    this.arsenal.reset();
    this.food = [];
    this.stats = { kills: 0, supplies: 0, t: 0, farthest: 'वहाबगंज' };
    this.obj = { key: false, fuse: false, cabin: false, signal: false, trainT: 0, phase: 'radio' };
    this.resetDoors();
    this.used = new Set();
    // player spawn: start house living room facing the door
    const S = W.special.start;
    const [sx, , sz] = S.F.world(-1.2, 0, 2.6);
    this.player.spawn(sx, 0, sz, S.F.yaw + Math.PI);
    // loot
    this.loot.clear();
    this.containers = W.containers.map((c) => ({ ...c, searched: false }));
    this.spawnLoot(r);
    this.loot.build();
    // enemies
    this.enemies.clear();
    this.spawnEnemies(r);
    // radios: shuffle songs into the radio houses each run
    const songs = r.shuffle([0, 1, 2, 3, 4, 5]);
    this.radios = [];
    let si = 0;
    for (const slot of W.radioSlots) {
      const isStart = slot.building && slot.building.name === 'start';
      const rad = this.audio.makeRadio(slot.p, isStart ? null : songs[si++ % 6]);
      if (rad) { rad.building = slot.building; rad.start_ = isStart; this.radios.push(rad); }
    }
    if (this.townMap.revealed) this.townMap.build();
    this.audio.startAmbience(this.displays.shivPos);
    // trains
    this.freight.visible = false; this.rescue.visible = false;
    this.nextFreight = 70 + r() * 60; this.train = null; this.trainLight.on = false;
    // misc
    this.chaseOn = false; this._chaseHold = 0;
    this.ambT = 5; this.zoneT = 0; this.curZone = null; this.inside = null; this.searchJob = null;
    this.spawnT = 20; this.flowT = 0; this.visT = 0; this.vis = 0.4;
    this.playerLit = false;
    this.broadcastI = 0; this.broadcastT = 2;
    this.hint('', '');
    this.secret.reset();
    this.state = 'play';
    this.input.resetState();
    this.input.enabled = true;
    document.body.classList.add('playing');
    $('menu').classList.add('hidden'); $('over').classList.add('hidden'); $('pause').classList.add('hidden');
    this.updateHud(true);
    this.toast('जायस — रात', 'JAIS — NIGHT. Find a way out.');
  }

  spawnLoot(r) {
    const W = this.W, L = this.loot;
    const spots = r.shuffle(W.lootSpots.slice());
    const start = W.special.start.F;
    const sp = start.world(0, 0, 0);
    let pistolPlaced = false;
    for (const s of spots) {
      const near = Math.hypot(s.p[0] - sp[0], s.p[2] - sp[2]);
      const pos = [s.p[0] + (r() - 0.5) * 0.2, s.p[1], s.p[2] + (r() - 0.5) * 0.2];
      // guaranteed early pistol close to the start
      if (!pistolPlaced && near < 60 && near > 6 && (s.kind === 'any' || s.kind === 'weapon')) {
        L.add({ kind: 'weapon', id: 'pistol', p: pos }); pistolPlaced = true;
        L.add({ kind: 'ammo', id: '9mm', n: 10, p: [pos[0] + 0.25, pos[1], pos[2]] });
        continue;
      }
      const chance = s.kind === 'weapon' ? 0.7 : s.kind === 'food' ? 0.55 : 0.45;
      if (!r.chance(chance)) continue;
      let kind = s.kind;
      if (kind === 'any') kind = r.pick(['food', 'food', 'food', 'ammo', 'ammo', 'weapon']);
      if (kind === 'water') { L.add({ kind: 'food', id: 'water', p: pos }); continue; }
      if (s.tag === 'prasad') { L.add({ kind: 'food', id: 'laddoo', p: pos }); continue; }
      if (s.tag === 'police') { L.add({ kind: 'weapon', id: r.chance(0.6) ? 'rifle' : 'pistol', p: pos }); continue; }
      if (kind === 'food') L.add({ kind: 'food', id: rollFood(r), p: pos });
      else if (kind === 'ammo') { const a = rollAmmo(r, null); L.add({ kind: 'ammo', id: a.t, n: a.n, p: pos }); }
      else if (kind === 'weapon') { if (r.chance(0.55)) L.add({ kind: 'weapon', id: rollWeapon(r), p: pos }); else { const a = rollAmmo(r, null); L.add({ kind: 'ammo', id: a.t, n: a.n, p: pos }); } }
    }
    this.placeHouseLoot(r, spots);
    // objective items: one key spot, one fuse spot per run
    const ks = r.pick(W.keySpots), fs = r.pick(W.fuseSpots);
    this.keySpot = ks; this.fuseSpot = fs;
    this.keyItem = L.add({ kind: 'key', id: 'key', p: [ks.p[0] + 0.15, ks.p[1], ks.p[2]] });
    this.fuseItem = L.add({ kind: 'fuse', id: 'fuse', p: [fs.p[0] - 0.1, fs.p[1], fs.p[2] + 0.1] });
    this.keyWhere = ks.label; this.fuseWhere = fs.label;
  }

  // Every enterable house rolls a "personality" so exploring pays off but is never certain:
  // some hide a weapon, a few an arsenal, some only ammo or food, some nothing at all.
  placeHouseLoot(r, spots) {
    const W = this.W, L = this.loot;
    this.houseLoot = {};
    for (const b of W.enterables || []) {
      if (b.name === 'start') continue;
      const mine = spots.filter((s) => {
        if (s.tag || s.kind === 'water') return false;
        const [lx, lz] = b.F.toLocal(s.p[0], s.p[2]);
        return Math.abs(lx) < b.w / 2 - 0.3 && lz > 0.3 && lz < b.d - 0.3 && s.p[1] < 1.4;
      });
      if (!mine.length) continue;
      let roll = r();
      if (b.locked || (b.name || '').startsWith('abandoned')) roll *= 0.7;   // hard-to-enter houses pay better
      const tier = roll < 0.22 ? 'armed' : roll < 0.3 ? 'arsenal' : roll < 0.5 ? 'ammo' : roll < 0.7 ? 'supplies' : 'empty';
      this.houseLoot[b.name] = tier;
      const slots = r.shuffle(mine.slice());
      let n = 0;
      const put = (item) => {
        const s = slots[n++ % slots.length];
        const j = n > slots.length ? 0.35 : 0.12;
        L.add({ ...item, p: [s.p[0] + (r() - 0.5) * j, s.p[1], s.p[2] + (r() - 0.5) * j] });
      };
      const gunWithAmmo = (id) => { put({ kind: 'weapon', id }); const t = WEAPONS[id].ammo, [a, c] = AMMO_PICK[t]; put({ kind: 'ammo', id: t, n: r.int(a, c) }); };
      if (tier === 'armed') gunWithAmmo(rollWeapon(r));
      else if (tier === 'arsenal') { gunWithAmmo(r.pick(['rifle', 'dunali', 'revolver'])); put({ kind: 'food', id: rollFood(r) }); const a = rollAmmo(r, null); put({ kind: 'ammo', id: a.t, n: a.n }); }
      else if (tier === 'ammo') { const a = rollAmmo(r, null); put({ kind: 'ammo', id: a.t, n: a.n }); if (r.chance(0.4)) { const c = rollAmmo(r, null); put({ kind: 'ammo', id: c.t, n: c.n }); } }
      else if (tier === 'supplies') { put({ kind: 'food', id: rollFood(r) }); put({ kind: 'food', id: rollFood(r) }); if (r.chance(0.5)) { const a = rollAmmo(r, null); put({ kind: 'ammo', id: a.t, n: a.n }); } }
    }
  }

  // Find a walkable ground point near (cx, cz); null if none.
  freeSpot(cx, cz, rad, minFromPlayer = 0) {
    const r = Math.random, P = this.player.pos;
    for (let k = 0; k < 24; k++) {
      const a = r() * 6.283, d = k === 0 ? 0 : r() * rad;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (!this.nav.free(x, z) || this.inSanctuary(x, z)) continue;
      if (Math.hypot(x - P.x, z - P.z) < minFromPlayer) continue;
      return [x, z];
    }
    return null;
  }

  // A pack of zombies standing around a point until the player gets close or fires a gun.
  spawnPack(r, cx, cz, n, rad, extra = {}) {
    const zone = extra.zone || ('z' + cx + ',' + cz);
    let made = 0;
    for (let i = 0; i < n; i++) {
      const p = this.freeSpot(cx, cz, rad, 30);
      if (!p) continue;
      const roll = r();
      this.enemies.spawn(roll < (extra.runners ?? 0.12) ? 'runner' : roll < (extra.runners ?? 0.12) + (extra.brutes ?? 0.08) ? 'brute' : 'walker', p[0], 0, p[1], { zone, hold: true });
      made++;
    }
    return made;
  }

  spawnThieves(r) {
    const W = this.W, E = this.enemies, sp = this.player.pos;
    const mob = this.lite;
    // 1) waiting inside houses (they wake when you walk in)
    for (const b of W.enterables || []) {
      if (b.name === 'start') continue;
      const aband = (b.name || '').startsWith('abandoned');
      if (!r.chance(aband ? 0.8 : 0.3)) continue;
      for (let k = 0; k < 8; k++) {
        const [x, , z] = b.F.world(r.range(-b.w / 2 + 1, b.w / 2 - 1), 0, r.range(b.d * 0.3, b.d * 0.8));
        if (!this.nav.free(x, z) || Math.hypot(x - sp.x, z - sp.z) < 20) continue;
        E.spawn('thief', x, 0, z, { wait: true, inside: true, frozen: true, yaw: b.F.yaw + Math.PI });
        break;
      }
    }
    // 2) guarding the key and the fuse
    for (const spot of [this.keySpot, this.fuseSpot]) {
      if (!spot || !r.chance(0.55)) continue;
      const p = this.freeSpot(spot.p[0], spot.p[2], 3, 15);
      if (p) E.spawn('thief', p[0], 0, p[1], { wait: true, frozen: true });
    }
    // 3) patrolling the lanes: two-way routes along a road
    const roads = r.shuffle(Object.values(ROADS).filter((q) => q.s === 'lane' || q.w < 9));
    let patrols = mob ? 4 : 6;
    for (const road of roads) {
      if (patrols <= 0) break;
      const i = roadInfo(road), t0 = r.range(8, Math.max(9, i.len - 40)), len = Math.min(i.len - t0 - 2, r.range(18, 34));
      const pt = (t) => [road.a[0] + i.ux * t + i.nx * (r() - 0.5) * road.w * 0.5, road.a[1] + i.uz * t + i.nz * (r() - 0.5) * road.w * 0.5];
      const route = [pt(t0), pt(t0 + len * 0.5), pt(t0 + len), pt(t0 + len * 0.5)];
      if (route.some((q) => !this.nav.free(q[0], q[1]) || this.inSanctuary(q[0], q[1])) || Math.hypot(route[0][0] - sp.x, route[0][1] - sp.z) < 40) continue;
      E.spawn('thief', route[0][0], 0, route[0][1], { route });
      patrols--;
    }
    // 4) loiterers near Alia market and the temple approaches
    for (const [x, z] of [[-140, 52], [-100, 14], [-155, 42]]) {
      if (mob && r.chance(0.5)) continue;
      const p = this.freeSpot(x, z, 6, 30);
      if (p) E.spawn('thief', p[0], 0, p[1], {});
    }
  }

  // Dark corridor under the Maa Kamakhya Mandir: one tunnel exists twice (under the town and
  // at the valley), so each copy gets its own pair. Enemies are carried across the blind corner
  // together with the player (see Secret.shift).
  spawnTunnelEnemies() {
    const E = this.enemies, o = { tunnel: true, frozen: true, inside: true };
    E.spawn('walker', -138.4, -5.95, 10.9, { ...o, hold: true, yaw: Math.PI / 2 });          // round the first turn
    E.spawn('thief', -133.9, -5.95, 13.6, { ...o, wait: true, yaw: Math.PI });              // in the shadow beside the torch-less stretch
    E.spawn('walker', -1043.5, 0, 3.8, { ...o, hold: true, yaw: 0 });                        // the last stretch before the valley
    E.spawn('thief', -1042.7, 0, 7.4, { ...o, wait: true, yaw: Math.PI });
  }

  dropFromThief(e) {
    const p = [e.pos.x + 0.3, e.pos.y + 0.05, e.pos.z + 0.3];
    if (e.loot) this.loot.drop({ kind: 'food', id: e.loot, p });
    const r = Math.random();
    if (r < 0.4) { const a = rollAmmo(this.rng, null); this.loot.drop({ kind: 'ammo', id: a.t, n: a.n, p: [p[0] - 0.5, p[1], p[2]] }); }
    else if (r < 0.65) this.loot.drop({ kind: 'food', id: rollFood(this.rng), p: [p[0] - 0.4, p[1], p[2] - 0.3] });
    if (Math.random() < 0.18) this.loot.drop({ kind: 'weapon', id: 'katta', p: [p[0], p[1], p[2] - 0.6] });
  }

  spawnEnemies(r) {
    const W = this.W, E = this.enemies;
    const sp = this.player.pos;
    // zombies inside some buildings (the frozen ones wake up when you come near)
    for (const p of W.enemySpots) {
      if (Math.hypot(p[0] - sp.x, p[2] - sp.z) < 18) continue;
      if (r.chance(0.42)) E.spawn(r.chance(0.12) ? 'runner' : r.chance(0.08) ? 'brute' : 'walker', p[0], p[1], p[2], { inside: true, frozen: true });
    }
    // wandering zombies on the streets (fewer on phones)
    const lite = this.lite = this.liteMode();
    for (let i = 0; i < (lite ? 40 : 52); i++) this.spawnStreetZombie(r, 35);
    // stationary ambush packs: stand still until you come close or fire a shot, then rush together
    const packs = [
      ['WAHAB', 0.3, 5], ['E2', 0.45, 5], ['E1', 0.4, 4], ['L2', 0.75, 5], ['SE', 0.4, 4], ['L1', 0.7, 4], ['SW', 0.55, 5], ['L3', 0.45, 4], ['STN', 0.5, 4],
      // the approaches to the Maa Kamakhya Mandir (the secret staircase is in its courtyard)
      ['ALIA', 0.12, 4], ['ALIA', 0.82, 4], ['WELLST', 0.4, 4], ['L2', 0.18, 4],
    ];
    for (const [name, t, n] of r.shuffle(packs.slice(0, 9)).slice(0, lite ? 5 : 9).concat(packs.slice(9))) {
      const road = ROADS[name], i = roadInfo(road);
      this.spawnPack(r, road.a[0] + i.ux * i.len * t, road.a[1] + i.uz * i.len * t, lite ? Math.max(3, n - 1) : n, 3.5);
    }
    // a few roaming mobs that drift slowly together (they chase as one when one of them sees you)
    for (let i = 0; i < (lite ? 2 : 3); i++) {
      const p = this.spawnStreetZombie(r, 60);
      if (!p) continue;
      for (let k = 0; k < 3; k++) { const q = this.freeSpot(p.pos.x, p.pos.z, 3, 40); if (q) this.enemies.spawn('walker', q[0], 0, q[1], { zone: 'mob' + i }); }
      p.zone = 'mob' + i;
    }
    this.spawnThieves(r);
    this.spawnTunnelEnemies();
    // human looter groups at a few landmarks
    const sites = r.shuffle([
      { c: [134, -140], route: [[118, -138], [150, -138], [150, -128], [118, -130]] },          // GGD forecourt
      { c: [-137, -158], route: [[-150, -157], [-125, -157], [-125, -150], [-150, -150]] },    // Jais City
      { c: [80, 112], route: null },                                                          // bus adda
      { c: [8, 70], route: [[4, 60], [4, 80], [-4, 80], [-4, 60]] },                           // near Naugazi
      { c: [45, -55], route: [[30, -58], [60, -58], [60, -66], [30, -66]] },                   // school
    ]).slice(0, 3);
    for (const s of sites) {
      let route = s.route;
      if (!route) { const F = W.special.busAdda; route = [F.world(-14, 0, 16), F.world(10, 0, 16), F.world(10, 0, 6), F.world(-14, 0, 6)].map((p) => [p[0], p[2]]); s.c = route[0]; }
      const n = 2 + (r.chance(0.4) ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const p = route[i % route.length];
        E.spawn('human', p[0] + r.range(-1, 1), 0, p[1] + r.range(-1, 1), { route: r.shuffle(route.slice()), gun: i === 0 && r.chance(0.5) ? 'rifle' : undefined });
      }
    }
  }

  spawnStreetZombie(r, minDist, maxDist = 1e9) {
    const roads = Object.values(ROADS);
    for (let k = 0; k < 12; k++) {
      const road = r.pick(roads), i = roadInfo(road);
      const t = r() * i.len, off = (r() - 0.5) * road.w * 0.8;
      const x = road.a[0] + i.ux * t + i.nx * off, z = road.a[1] + i.uz * t + i.nz * off;
      const d = Math.hypot(x - this.player.pos.x, z - this.player.pos.z);
      if (d < minDist || d > maxDist || !this.nav.free(x, z) || this.inSanctuary(x, z)) continue;
      const roll = r();
      return this.enemies.spawn(roll < 0.16 ? 'runner' : roll < 0.24 ? 'brute' : 'walker', x, 0, z);
    }
    return null;
  }

  liteMode() { try { return matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600; } catch (e) { return false; } }

  inSanctuary(x, z) {
    for (const s of this.W.sanctuary) {
      const [lx, lz] = s.F.toLocal(x, z);
      if (lx > s.x0 + 0.4 && lx < s.x1 - 0.4 && lz > s.z0 - 0.6 && lz < s.z1) return true;
    }
    return false;
  }

  // ================= combat hooks =================
  fireRay(origin, dir, dmg, src, w) {
    const P = this.physics;
    const wall = P.raycast(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, 160);
    const maxT = wall ? wall.t : 160;
    const hit = this.enemies.hitTest(origin, dir, maxT);
    if (hit) {
      const e = hit.e;
      const pt = [origin.x + dir.x * hit.t, origin.y + dir.y * hit.t, origin.z + dir.z * hit.t];
      const killed = this.enemies.damage(e, dmg * (hit.t > 40 ? 0.8 : 1), hit.part, dir, src);
      this.fx.burst(pt, [-dir.x * 0.4, 0.2, -dir.z * 0.4], hit.part === 'head' ? 14 : 8, [0.45, 0.02, 0.02], 2.2, 0.7);
      this.audio.play('flesh', { pos: pt, vol: 0.5 });
      if (src === 'player') this.hitMarker(hit.part === 'head', killed);
      if (Math.random() < 0.4) this.fx.bloodPool(e.pos.x + dir.x * 0.6, e.pos.y, e.pos.z + dir.z * 0.6, 0.5);
      return;
    }
    if (wall) {
      const pt = [origin.x + dir.x * wall.t, origin.y + dir.y * wall.t, origin.z + dir.z * wall.t];
      const n = [wall.nx, wall.ny, wall.nz];
      this.fx.hole(pt, n);
      this.fx.burst(pt, n, 6, [0.75, 0.7, 0.6], 1.6, 0.5);
      if (Math.random() < 0.3) this.fx.burst(pt, n, 3, [1, 0.8, 0.4], 4, 0.15);
      this.audio.play(Math.random() < 0.15 ? 'ricochet' : 'wall', { pos: pt, vol: 0.5 });
      // doors take bullet damage too
      if (wall.box.tag === 'door') { const d = this.doors.find((x) => x.box === wall.box); if (d) { d.hp -= dmg; if (d.hp <= 0 && !d.metal) this.breakDoor(d); } }
    }
  }

  melee(origin, dir, dmg, range) {
    const hit = this.enemies.hitTest(origin, dir, range);
    if (hit) {
      const killed = this.enemies.damage(hit.e, dmg * (hit.part === 'head' ? 1.2 : 1), hit.part === 'head' ? 'head' : 'body', dir, 'player');
      hit.e.stagger = Math.max(hit.e.stagger, 0.5);
      const kb = hit.e.type === 'brute' ? 0.1 : 0.6;
      this.physics.moveCharacter(hit.e.pos, dir.x * kb, dir.z * kb, 0, 0.016, 0.3, 1.7, 0.45, hit.e.st);
      this.audio.play('flesh', { pos: [hit.e.pos.x, 1.4, hit.e.pos.z], vol: 0.9 });
      this.hitMarker(false, killed);
      this.noise(this.player.pos, 6, 'melee');
    } else {
      const wall = this.physics.raycast(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, range);
      if (wall) this.audio.play('wall', { pos: [origin.x + dir.x * wall.t, origin.y + dir.y * wall.t, origin.z + dir.z * wall.t], vol: 0.6 });
    }
  }

  hurtPlayer(dmg, from) {
    const P = this.player;
    if (P.dead || this.state !== 'play') return;
    P.damage(dmg, from);
    P.shake = Math.max(P.shake, 0.45);
    this.audio.play('flesh', { vol: 0.6 });
    // directional indicator
    if (from) {
      const ang = Math.atan2(from.pos.x - P.pos.x, from.pos.z - P.pos.z);
      const rel = ang - (P.yaw + Math.PI);
      const el = $('hurtDir');
      el.style.transform = `translate(-50%,-50%) rotate(${-rel}rad)`;
      el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    }
    const v = $('vignette'); v.classList.remove('hit'); void v.offsetWidth; v.classList.add('hit');
    if (P.dead) {
      this.gameOver(from && from.thief ? 'चोरों ने मार डाला' : from && from.human ? 'लुटेरों ने मार डाला' : 'ज़ॉम्बी ने मार डाला');
      if (from && !from.human) this.audio.play('zombieByeBye', { vol: 2.2, vary: 0, verbAmt: 0.3 });   // only a zombie's kill (the clip is mixed ~9 dB quieter than the others)
    }
  }

  noise(pos, radius, kind) { this.enemies.hear(pos, radius, kind); }

  // Zombies on the player's heels: the chase track comes in while any zombie is chasing close by,
  // rises as they close the gap, and fades out a few seconds after the last one gives up or dies.
  updateChaseAudio(dt) {
    const P = this.player;
    let near = Infinity;
    if (!P.dead) for (const e of this.enemies.list) {
      if (e.dead || e.human || (e.state !== 'CHASE' && e.state !== 'ATTACK') || !(e.dist < 32) || Math.abs(e.pos.y - P.pos.y) > 4) continue;
      near = Math.min(near, e.dist);
    }
    if (near < Infinity) { this._chaseHold = 3; this._chaseNear = near; } else this._chaseHold = Math.max(0, (this._chaseHold || 0) - dt);
    this.chaseOn = this._chaseHold > 0;
    const vol = this.chaseOn ? Math.round((0.4 + 0.4 * clamp(1 - this._chaseNear / 32, 0, 1)) * 10) / 10 : 0;
    this.audio.fade('zombieChase', vol, vol > 0 ? 0.8 : 2.5);
  }

  // A zombie screaming far away: a warning, never close. With the user's scream it comes from a real
  // zombie 45-110 m off (or a random far point), at most every ~35-60 s and never over a chase.
  distantScream(pos) {
    if (!this.audio.has('zombieScream')) { this.audio.play('scream', { pos, vol: 0.35, rate: 0.8 }); return; }
    if (this.chaseOn || this.time < (this._screamAt || 0)) return;
    const P = this.player;
    const far = this.enemies.list.filter((e) => !e.dead && !e.human && e.dist > 45 && e.dist < 110 && Math.abs(e.pos.y - P.pos.y) < 8);
    if (far.length) { const e = far[(Math.random() * far.length) | 0]; pos = [e.pos.x, e.pos.y + 1.6, e.pos.z]; }
    this._screamAt = this.time + 35 + Math.random() * 25;
    this.audio.play('zombieScream', { pos, vol: 0.8, ref: 12, far: 30, verbAmt: 1, max: 160, vary: 0.04 });
  }

  enemyMuzzle(p) {
    this.flashSrc = this.flashSrc || [];
    this.fx.burst(p, [0, 0, 0], 4, [1, 0.8, 0.4], 0.6, 0.08);
  }

  dropFromHuman(e) {
    const p = [e.pos.x + 0.4, e.pos.y + 0.05, e.pos.z + 0.3];
    const w = e.gun.drop;
    if (Math.random() < 0.55) this.loot.drop({ kind: 'weapon', id: w, p });
    const map = { pistol: '9mm', rifle: '7.62', dunali: '12G' };
    this.loot.drop({ kind: 'ammo', id: map[w], n: 6 + ((Math.random() * 10) | 0), p: [p[0] - 0.5, p[1], p[2]] });
    if (Math.random() < 0.5) this.loot.drop({ kind: 'food', id: rollFood(this.rng), p: [p[0], p[1], p[2] - 0.5] });
  }

  hitMarker(head, killed) {
    const el = $('hitm');
    el.className = killed ? 'kill' : head ? 'head' : 'hit';
    void el.offsetWidth; el.classList.add('show');
    this.audio.play('click', { vol: killed ? 0.35 : 0.18, rate: killed ? 0.6 : 1.4, verb: false });
  }

  playerVisibility() {
    if (this.torchOn) return 1;
    return this.vis;
  }

  // ================= interaction =================
  findInteract() {
    const P = this.player, cam = this.camera;
    const fwd = this._fwd || (this._fwd = new THREE.Vector3());
    cam.getWorldDirection(fwd);
    const eye = cam.position;
    let best = null, bestScore = 0.72;
    const consider = (pos, reach, obj) => {
      const dx = pos[0] - eye.x, dy = pos[1] - eye.y, dz = pos[2] - eye.z, d = Math.hypot(dx, dy, dz);
      if (d > reach) return;
      const dot = (dx * fwd.x + dy * fwd.y + dz * fwd.z) / d;
      const score = dot + (d < 1 ? 0.15 : 0);
      if (score > bestScore) { bestScore = score; best = obj; best._d = d; best._pos = pos; }
    };
    for (const it of this.loot.items) if (!it.taken && Math.abs(it.p[0] - P.pos.x) < 3 && Math.abs(it.p[2] - P.pos.z) < 3) consider(it.p, 2.4, { type: 'item', it });
    for (const c of this.containers) if (!c.searched && Math.abs(c.p[0] - P.pos.x) < 3 && Math.abs(c.p[2] - P.pos.z) < 3) consider(c.p, 2.3, { type: 'container', c });
    for (const d of this.doors) {
      if (d.broken || Math.abs(d.cx - P.pos.x) > 3 || Math.abs(d.cz - P.pos.z) > 3) continue;
      if (Math.abs(d.hinge[1] - P.pos.y) > 1.5) continue;
      consider([d.cx, d.hinge[1] + 1.1, d.cz], 2.5, { type: 'door', d });
    }
    for (const p of this.W.pumps) consider([p.p[0], p.p[1] + 0.9, p.p[2]], 2.2, { type: 'pump', p });
    const S = this.W.special;
    consider(S.well, 2.6, { type: 'well' });
    consider(S.bell, 2.6, { type: 'bell' });
    consider(S.signalPanel, 2.4, { type: 'signal' });
    this.secret.consider(consider);
    for (const r of this.radios) consider(r.pos, 2.0, { type: 'radio', r });
    if (this.train && this.train.kind === 'rescue' && this.train.stopped) {
      const x = clamp(P.pos.x, this.train.x + 2, this.train.x + this.rescue.userData.len - 2);
      consider([x, 1.6, RAIL.loopZ + 1.6], 3.2, { type: 'board' });
    }
    if (!best) return null;
    // must not be behind a wall
    const p = best._pos;
    const dx = p[0] - eye.x, dy = p[1] - eye.y, dz = p[2] - eye.z, d = Math.hypot(dx, dy, dz);
    const h = this.physics.raycast(eye.x, eye.y, eye.z, dx / d, dy / d, dz / d, d - 0.35, 'door');
    if (h && best.type !== 'door') return null;
    return best;
  }

  promptFor(t) {
    if (!t) return null;
    switch (t.type) {
      case 'item': {
        const it = t.it;
        if (it.kind === 'food') return ['TAKE', FOOD[it.id].name];
        if (it.kind === 'ammo') return ['TAKE', `${AMMO[it.id]} गोलियाँ ×${it.n}`];
        if (it.kind === 'weapon') return ['TAKE', WEAPONS[it.id].name];
        if (it.kind === 'key') return ['TAKE', 'सिग्नल केबिन की चाबी'];
        if (it.kind === 'fuse') return ['TAKE', 'फ्यूज़'];
        return ['TAKE', ''];
      }
      case 'container': return ['SEARCH', t.c.label];
      case 'door': {
        const d = t.d;
        if (d.open) return ['CLOSE', d.label];
        if (d === this.W.special.cabinDoor && d.locked) return this.obj.key ? ['UNLOCK', 'सिग्नल केबिन'] : ['LOCKED', 'चाबी चाहिए · needs key'];
        if (d.locked) return ['KICK', 'बंद दरवाज़ा · locked'];
        return ['OPEN', d.label];
      }
      case 'pump': return [t.p.tap ? 'DRINK' : 'PUMP', t.p.tap ? 'नल' : 'हैंडपंप'];
      case 'well': return ['DRAW', 'कुआँ · well'];
      case 'bell': return ['RING', 'घंटी · bell'];
      case 'radio': return [t.r.on ? 'OFF' : 'ON', 'रेडियो'];
      case 'signal': return this.obj.signal ? ['—', 'सिग्नल हरा है'] : this.obj.fuse ? ['SET SIGNAL', 'फ्यूज़ लगाएं'] : ['NO FUSE', 'फ्यूज़ चाहिए'];
      case 'board': return ['BOARD', 'ट्रेन में चढ़ें'];
      case 'secret': return this.secret.prompt();
    }
    return null;
  }

  use(t) {
    const P = this.player, A = this.arsenal, r = this.rng;
    switch (t.type) {
      case 'item': return this.takeItem(t.it);
      case 'container': this.searchJob = { c: t.c, t: 0, dur: 1.1 }; this.audio.play('rustle', { vol: 0.6 }); this.noise(P.pos, 3, 'search'); return;
      case 'door': {
        const d = t.d;
        if (d.open) return this.closeDoor(d);
        if (d === this.W.special.cabinDoor && d.locked) {
          if (!this.obj.key) { this.audio.play('click', { vol: 0.6 }); this.toast('केबिन बंद है', 'The cabin is locked. Find the key.'); return; }
          d.locked = false; this.obj.cabin = true; this.audio.play('clank', { vol: 0.8 }); this.openDoor(d, true); this.updateObjective(); return;
        }
        if (d.locked) {
          this.audio.play('bang', { pos: [d.cx, 1.1, d.cz], vol: 0.9 }); this.noise(P.pos, 28, 'kick'); P.shake = 0.3;
          d.hp -= 45;
          if (d.hp <= 0) { d.locked = false; this.breakDoor(d); }
          return;
        }
        return this.openDoor(d, true);
      }
      case 'pump': {
        const k = 'pump' + t.p.p.join();
        if (this.used.has(k) && this.time - this.used[k] < 90) { this.toast('पानी कम आ रहा है', 'Barely a trickle. Try later.'); return; }
        this.used.add(k); this.used[k] = this.time;
        this.audio.play('splash', { pos: t.p.p, vol: 0.6 }); this.audio.play('gulp', { vol: 0.6, delay: 0.5 });
        P.heal(4); this.feed('+4 पानी'); this.noise(P.pos, 8, 'pump');
        return;
      }
      case 'well': {
        if (this.used.has('well')) { this.toast('बाल्टी खाली', 'The bucket comes up empty.'); return; }
        this.used.add('well');
        this.audio.play('creak', { pos: this.W.special.well, vol: 0.6 }); this.audio.play('splash', { pos: this.W.special.well, vol: 0.7, delay: 1.2 });
        const roll = r();
        if (roll < 0.45) { P.heal(7); this.feed('+7 कुएँ का पानी'); }
        else if (roll < 0.8) { const a = rollAmmo(r, A.owned); A.reserve[a.t] += a.n; this.feed(`+${a.n} ${AMMO[a.t]} (टिन का डिब्बा)`); this.stats.supplies++; }
        else this.toast('बाल्टी खाली', 'The bucket comes up empty.');
        return;
      }
      case 'bell': this.audio.play('bell', { pos: this.W.special.bell, vol: 1, verbAmt: 1, max: 400, roll: 0.6 }); this.noise(P.pos, 55, 'bell'); return;
      case 'radio': t.r.on = !t.r.on; if (!t.r.on) t.r.stop(); this.audio.play('click', { vol: 0.5 }); return;
      case 'signal': {
        if (this.obj.signal || !this.obj.fuse) { this.audio.play('beepLow', { vol: 0.5 }); return; }
        this.obj.signal = true; this.obj.trainT = 100;
        this.audio.play('clank', { vol: 0.9 }); this.audio.play('beep', { vol: 0.6, delay: 0.4 });
        this.signalAlarm = this.audio.loop('alarm', 0.5, this.audio.sfx, Object.assign([...this.W.special.signalPanel], { ref: 6 }));
        this.noise(P.pos, 120, 'alarm');
        this.toast('सिग्नल हरा!', 'Signal set. The train is coming — hold out on platform 1.');
        this.updateObjective();
        return;
      }
      case 'board': return this.win();
      case 'secret': return this.secret.use();
    }
  }

  takeItem(it) {
    const A = this.arsenal;
    if (it.kind === 'food') {
      if (this.food.length >= 8) { this.toast('झोला भरा है', 'Bag full — eat something first.'); return; }
      this.food.push(it.id); this.feed('+ ' + FOOD[it.id].name);
    } else if (it.kind === 'ammo') { A.reserve[it.id] += it.n; this.feed(`+${it.n} ${AMMO[it.id]}`); }
    else if (it.kind === 'weapon') { const fresh = A.give(it.id); this.feed(fresh ? '+ ' + WEAPONS[it.id].name : `+${WEAPONS[it.id].mag} ${AMMO[WEAPONS[it.id].ammo]}`); }
    else if (it.kind === 'key') { this.obj.key = true; this.feed('+ सिग्नल केबिन की चाबी'); this.updateObjective(); }
    else if (it.kind === 'fuse') { this.obj.fuse = true; this.feed('+ फ्यूज़'); this.updateObjective(); }
    this.loot.take(it);
    this.stats.supplies++;
    this.audio.play('rustle', { vol: 0.7 });
  }

  eat() {
    if (!this.food.length) { this.toast('खाने को कुछ नहीं', 'No food in the bag.'); return; }
    const P = this.player;
    const missing = P.maxHealth - P.health;
    if (missing < 1) { this.toast('पेट भरा है', 'You are not hurt.'); return; }
    // pick the item that fits the missing health best
    let bi = 0, bs = 1e9;
    this.food.forEach((id, i) => { const s = Math.abs(FOOD[id].heal - missing); if (s < bs) { bs = s; bi = i; } });
    const id = this.food.splice(bi, 1)[0];
    P.heal(FOOD[id].heal);
    this.audio.play(FOOD[id].drink ? 'gulp' : 'crunch', { vol: 0.8 });
    this.feed(`${FOOD[id].name}  +${FOOD[id].heal}`);
  }

  // ================= objectives / HUD =================
  objectiveText() {
    const o = this.obj;
    if (o.phase === 'radio') return ['रेडियो सुनें', 'Listen to the radio'];
    if (o.signal && this.train && this.train.stopped) return ['प्लेटफ़ॉर्म 1 पर ट्रेन में चढ़ें', 'Board the train on platform 1'];
    if (o.signal) return [`ट्रेन आ रही है… ${Math.ceil(o.trainT)}s — प्लेटफ़ॉर्म 1 पर टिके रहें`, `Train arriving in ${Math.ceil(o.trainT)}s — hold out at platform 1`];
    if (o.key && o.fuse) return ['गुरु गोरखनाथ धाम के सिग्नल केबिन जाएँ', 'Go to the Guru Gorakhnath Dham signal cabin'];
    const need = [];
    if (!o.key) need.push(['केबिन की चाबी', 'cabin key']);
    if (!o.fuse) need.push(['फ्यूज़', 'fuse']);
    return [need.map((n) => n[0]).join(' और ') + ' ढूँढें', 'Find the ' + need.map((n) => n[1]).join(' and ')];
  }

  updateObjective() {
    const [hi, en] = this.objectiveText();
    $('objHi').textContent = hi; $('objEn').textContent = en;
    const el = $('objective'); el.classList.add('show');
    clearTimeout(this._objT); this._objT = setTimeout(() => el.classList.remove('show'), 7000);
    this.hint(this.obj.key ? '' : 'चाबी: जायस सिटी स्टेशन / बस अड्डा / नौगजी चौकी', this.obj.fuse ? '' : 'फ्यूज़: वहाबगंज बिजली घर / आलिया मार्केट / तीन मंज़िला मकान');
  }

  hint(a, b) { $('hintKey').textContent = a; $('hintFuse').textContent = b; }

  toast(hi, en) {
    const el = $('toast');
    el.innerHTML = `<b>${hi}</b><span>${en}</span>`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }

  feed(text) {
    const box = $('feed');
    const d = document.createElement('div'); d.textContent = text; box.appendChild(d);
    setTimeout(() => d.classList.add('out'), 2200); setTimeout(() => d.remove(), 3000);
    while (box.children.length > 4) box.firstChild.remove();
  }

  subtitle(hi, en) {
    const el = $('subtitle');
    if (!hi) { el.classList.remove('show'); return; }
    el.innerHTML = `<b>${hi}</b><span>${en}</span>`; el.classList.add('show');
  }

  updateHud(force) {
    const P = this.player, A = this.arsenal, w = A.w;
    const hp = Math.ceil(P.health);
    if (force || hp !== this._hp) {
      this._hp = hp;
      $('hpFill').style.width = hp + '%'; $('hpNum').textContent = hp;
      $('hp').classList.toggle('low', hp <= 30);
    }
    const ammo = w.melee ? '—' : `${A.mag[A.cur]}<small> / ${A.reserve[w.ammo]}</small>`;
    if (force || ammo !== this._ammo) { this._ammo = ammo; $('ammoNum').innerHTML = ammo; }
    const wn = w.name + (A.reloadT > 0 ? ' · रीलोड' : '');
    if (force || wn !== this._wn) { this._wn = wn; $('wName').textContent = wn; }
    const fc = this.food.length;
    if (force || fc !== this._fc) { this._fc = fc; $('foodCount').textContent = fc; $('btnEat').classList.toggle('dim', fc === 0); }
    $('stam').style.width = P.stamina + '%';
    $('stamWrap').classList.toggle('show', P.stamina < 98);
    // crosshair spread
    const sp = w.melee ? 4 : 4 + A.spreadRad(P, this.input) * 600;
    const ch = $('cross');
    ch.style.setProperty('--gap', Math.min(40, sp).toFixed(1) + 'px');
    ch.classList.toggle('ads', A.adsT > 0.6 && !w.melee);
    $('torchBtn').classList.toggle('on', this.torchOn);
  }

  // ================= main loop =================
  frame(tms) {
    requestAnimationFrame((t) => this.frame(t));
    const now = tms / 1000;
    let dt = Math.min(0.05, now - (this._last || now)); this._last = now;
    if (dt <= 0) dt = 0.016;
    this.dt = dt;
    if (this.state === 'play') this.update(dt);
    else if (this.state === 'menu' || this.state === 'dead' || this.state === 'win') this.menuCam(dt);
    this.render(dt);
  }

  menuCam(dt) {
    if (this.secret && this.secret.mode) this.secret.setMode(false);
    this.time += dt;
    const t = this.time * 0.05;
    const T = KAMAKHYA.temple;
    this.camera.position.set(T.x + Math.sin(t) * 26, 7 + Math.sin(t * 0.7) * 1.5, T.z + 18 + Math.cos(t) * 20);
    this.camera.lookAt(T.x, 5, T.z);
    if (this.camera.fov !== 60) { this.camera.fov = 60; this.camera.updateProjectionMatrix(); }
    this.lightPool.update(dt, this.camera, this.time);
    animateDisplays(this.displays, this.time);
  }

  update(dt) {
    this.time += dt;
    const P = this.player, I = this.input, A = this.arsenal;
    this.stats.t += dt;
    I.pollKeys();
    // presses
    if (I.consume('pause')) return this.pause();
    if (I.consume('map')) { this.showMap(); return; }
    if (I.consume('reload')) A.startReload();
    if (I.consume('swap')) A.cycle();
    if (I.consume('melee')) A.equip('lathi');
    for (let k = 1; k <= 4; k++) if (I.consume('w' + k) && A.owned[k - 1]) A.equip(A.owned[k - 1]);
    if (I.consume('torch')) { this.torchOn = !this.torchOn; this.audio.play('click', { vol: 0.4 }); }
    if (I.consume('eat')) this.eat();
    const mv = P.update(dt, I, this, A);
    this.torch.intensity = this.torchOn ? 26 : 0;
    // interaction
    const t = this.findInteract();
    this.target = t;
    const pr = this.promptFor(t);
    const pe = $('prompt');
    if (pr && !this.searchJob) {
      const key = pr[0] + pr[1];
      if (key !== this._pr) { this._pr = key; pe.innerHTML = `<b>${I.touch ? '' : '[E] '}${pr[0]}</b> ${pr[1]}`; }
      pe.classList.add('show'); $('btnUse').classList.add('ready');
    } else { pe.classList.remove('show'); this._pr = null; $('btnUse').classList.remove('ready'); }
    if (I.consume('use') && t && !this.searchJob) this.use(t);
    // container search progress
    if (this.searchJob) {
      const j = this.searchJob;
      j.t += dt;
      const still = this.target && this.target.type === 'container' && this.target.c === j.c;
      $('searchRing').style.setProperty('--p', (j.t / j.dur * 100).toFixed(0));
      $('searchRing').classList.add('show');
      if (!still && j.t > 0.15) { this.searchJob = null; $('searchRing').classList.remove('show'); }
      else if (j.t >= j.dur) {
        j.c.searched = true; this.searchJob = null; $('searchRing').classList.remove('show');
        const got = containerLoot(j.c.type, this.rng, A.owned);
        if (!got.length) this.feed(j.c.label + ': खाली');
        for (const g of got) {
          if (g.kind === 'food') { if (this.food.length < 8) { this.food.push(g.id); this.feed('+ ' + FOOD[g.id].name); } }
          else if (g.kind === 'ammo') { A.reserve[g.id] += g.n; this.feed(`+${g.n} ${AMMO[g.id]}`); }
          else if (g.kind === 'weapon') { const fresh = A.give(g.id); this.feed(fresh ? '+ ' + WEAPONS[g.id].name : `+${WEAPONS[g.id].mag} ${AMMO[WEAPONS[g.id].ammo]}`); }
          this.stats.supplies++;
        }
        this.audio.play('rustle', { vol: 0.8 });
      }
    }
    A.update(dt, { player: P, input: I, game: this, sprinting: mv.sprinting });
    // footsteps & movement noise reach enemies
    if (P.noise > 0) { this._nT = (this._nT || 0) - dt; if (this._nT <= 0) { this._nT = 0.5; this.noise(P.pos, P.noise, 'step'); } }
    // flow field toward the player
    this.flowT -= dt;
    if (this.flowT <= 0) { this.flowT = 0.35; this.nav.build(P.pos.x, P.pos.z); }
    this.enemies.update(dt, this.camera);
    this.loot.update(this.time);
    this.updateDoors(dt);
    this.updateWorld(dt);
    this.updateTrains(dt);
    this.secret.update(dt);
    this.updateHud();
    this.drawMinimap(dt);
    if (P.dead && this.state === 'play') this.gameOver('');
  }

  updateDoors(dt) {
    for (const d of this.doors) {
      if (Math.abs(d.angle - d.target) < 0.001) continue;
      d.angle += Math.sign(d.target - d.angle) * Math.min(Math.abs(d.target - d.angle), dt * 4.5);
      d.pivot.rotation.y = d.closedYaw + d.angle;
    }
  }

  updateWorld(dt) {
    const P = this.player;
    // which enterable building is the player in?
    this._inT = (this._inT || 0) - dt;
    if (this._inT <= 0) {
      this._inT = 0.25;
      let inside = null;
      for (const b of this.enterables) {
        const [lx, lz] = b.F.toLocal(P.pos.x, P.pos.z);
        if (Math.abs(lx) < b.w / 2 - 0.1 && lz > 0.1 && lz < b.d - 0.1 && P.pos.y < (b.floors || 1) * 3.2 + 0.5) { inside = b; break; }
      }
      if (inside !== this.inside) {
        this.inside = inside;
        for (const r of this.radios) { if (r.building === inside && r.on) r.start(); else if (r.playing) r.stop(); }
        if (inside && inside.name === 'start' && this.obj.phase === 'radio') this.broadcastT = 0.5;
      }
      // distance-cull small separate meshes (doors, photo frames)
      for (const d of this.doors) d.pivot.visible = Math.abs(d.cx - P.pos.x) < 50 && Math.abs(d.cz - P.pos.z) < 50;
      for (const m of this.displays.photos) m.visible = Math.abs(m.position.x - P.pos.x) < 22 && Math.abs(m.position.z - P.pos.z) < 22;
      // visibility of the player to human eyes
      let lit = false;
      for (const l of this.W.lights) {
        if (!l.on || l.interior && !inside) continue;
        if (Math.abs(l.x - P.pos.x) > l.dist || Math.abs(l.z - P.pos.z) > l.dist) continue;
        if (Math.hypot(l.x - P.pos.x, l.z - P.pos.z) < l.dist * 0.5) { lit = true; break; }
      }
      this.playerLit = lit;
      if (!this.secret.mode) this.townMap.discover(P.pos.x, P.pos.z);
      this.vis = lit ? 0.8 : inside ? 0.22 : 0.38;
    }
    this.audio.setListener(this.camera, !!this.inside || this.secret.underground);
    this.updateChaseAudio(dt);
    // start-house broadcast
    if (this.obj.phase === 'radio') {
      this.broadcastT -= dt;
      if (this.broadcastT <= 0) {
        if (this.broadcastI < BROADCAST.length) {
          this.subtitle(...BROADCAST[this.broadcastI]); this.broadcastI++; this.broadcastT = 4.6;
          this.audio.play('static', { vol: 0.25 });
        } else { this.subtitle(); this.obj.phase = 'search'; this.updateObjective(); }
      }
    }
    // area title
    this.zoneT -= dt;
    if (this.zoneT <= 0) {
      this.zoneT = 0.5;
      const z = ZONES.find((q) => P.pos.x > q.x0 && P.pos.x < q.x1 && P.pos.z > q.z0 && P.pos.z < q.z1);
      if (z && z !== this.curZone) {
        this.curZone = z;
        if (z.en !== 'JAIS') { this.stats.farthest = z.name; $('areaHi').textContent = z.name; $('areaEn').textContent = z.en; const a = $('area'); a.classList.remove('show'); void a.offsetWidth; a.classList.add('show'); }
      }
    }
    // ambience: dogs, distant screams, gunfire, train horn
    this.ambT -= dt;
    if (this.ambT <= 0 && this.secret.mode) this.ambT = 5; // the valley is silent but for its own sounds
    if (this.ambT <= 0) {
      this.ambT = 6 + Math.random() * 12;
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 60;
      const pos = [P.pos.x + Math.cos(a) * d, 2, P.pos.z + Math.sin(a) * d];
      const roll = Math.random();
      if (roll < 0.45) this.audio.play('bark', { pos, vol: 0.7, far: 20 });
      else if (roll < 0.6) this.distantScream(pos);
      else if (roll < 0.72) { this.audio.play(Math.random() < 0.5 ? 'rifle' : 'pistol', { pos, vol: 0.5, far: 8 }); this.noise({ x: pos[0], z: pos[2] }, 60, 'gun'); }
      else if (roll < 0.82) this.audio.play('growl', { pos, vol: 0.5, rate: 0.8 });
    }
    // keep the streets populated, far from the player
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = this.obj.signal ? 2.5 : 9;
      const alive = this.enemies.list.filter((e) => !e.dead && !e.human && !e.zone && !e.tunnel).length;
      const target = Math.min(this.lite ? 56 : 70, (this.lite ? 38 : 48) + Math.floor(this.stats.t / 60) * 2 + (this.obj.signal ? 14 : 0));
      if (alive < target) {
        const e = this.obj.signal
          ? this.spawnNear(110, -160, 35, 70)
          : this.spawnStreetZombie(this.rng, 55, 110);
        if (e && this.obj.signal) { e.state = 'ALERT'; e.investigate = { x: 150, z: -160 }; }
      }
      // forget zombies that wandered very far away
      for (const e of this.enemies.list) if (!e.dead && !e.human && !e.zone && !e.tunnel && e.dist > 150 && e.state === 'IDLE') e.dead = true, e.deathT = 41;
    }
    // ceiling fans, flag, displays, lamp glows
    if (this.props.fans) {
      const f = this.props.fans, m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
      this._fanA = (this._fanA || 0) + dt * 5;
      for (let i = 0; i < f.count; i++) { const p = this.W.fans[i]; v.set(p[0], p[1], p[2]); q.setFromEuler(new THREE.Euler(0, this._fanA + i, 0)); m.compose(v, q, s); f.setMatrixAt(i, m); }
      f.instanceMatrix.needsUpdate = true;
    }
    if (this.W.special.flag) this.W.special.flag.rotation.y = Math.sin(this.time * 2.1) * 0.4;
    animateDisplays(this.displays, this.time);
    this.twinkle(dt);
    // heartbeat at low health
    if (P.health < 30) { this._hb = (this._hb || 0) - dt; if (this._hb <= 0) { this._hb = 0.9 + P.health / 40; this.audio.play('heart', { vol: 0.6, verb: false }); } }
    // objective timer
    if (this.obj.signal && this.obj.trainT > 0) {
      this.obj.trainT -= dt;
      $('objHi').textContent = this.objectiveText()[0]; $('objEn').textContent = this.objectiveText()[1];
      $('objective').classList.add('show');
      if (this.obj.trainT <= 0) this.startRescue();
    }
  }

  spawnNear(x, z, rMin, rMax) {
    for (let k = 0; k < 10; k++) {
      const a = Math.random() * 6.28, r = rMin + Math.random() * (rMax - rMin);
      const px = x + Math.cos(a) * r, pz = z + Math.abs(Math.sin(a)) * r;
      if (!this.nav.free(px, pz) || Math.hypot(px - this.player.pos.x, pz - this.player.pos.z) < 25) continue;
      return this.enemies.spawn(Math.random() < 0.3 ? 'runner' : 'walker', px, 0, pz, { state: 'ALERT' });
    }
    return null;
  }

  twinkle(dt) {
    const g = this.props.fairy; if (!g) return;
    this._tw = (this._tw || 0) - dt;
    if (this._tw > 0) return;
    this._tw = 0.12;
    const col = g.geometry.attributes.color, base = this.props.fairyBase;
    for (let i = 0; i < col.count; i++) {
      const k = Math.random() < 0.08 ? 0.25 : 1;
      col.array[i * 3] = base[i * 3] * k; col.array[i * 3 + 1] = base[i * 3 + 1] * k; col.array[i * 3 + 2] = base[i * 3 + 2] * k;
    }
    col.needsUpdate = true;
  }

  // ================= trains =================
  updateTrains(dt) {
    const P = this.player;
    this.nextFreight -= dt;
    if (!this.train && this.nextFreight <= 0 && !this.obj.signal) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.train = { kind: 'freight', g: this.freight, x: dir > 0 ? -300 : 300 + this.freight.userData.len, v: 21 * dir, z: RAIL.mainZ, horned: false };
      this.freight.visible = true; this.freight.rotation.y = dir > 0 ? 0 : Math.PI;
      this.trainLight.on = true;
    }
    const T = this.train;
    if (!T) return;
    if (T.kind === 'rescue' && !T.stopped) {
      // brake to a stop with the engine at the west end of platform 1
      const stopX = 100;
      const dist = T.x - stopX;
      T.v = -Math.max(0.6, Math.min(16, Math.sqrt(Math.max(0, dist) * 2 * 0.9)));
      if (dist <= 0.3) { T.v = 0; T.stopped = true; this.audio.play('horn', { pos: [T.x, 4, T.z], vol: 0.7 }); this.toast('ट्रेन आ गई!', 'The train is here — BOARD at platform 1!'); this.updateObjective(); }
    }
    T.x += T.v * dt;
    // span along x and the front of the engine
    const len = T.g.userData.len;
    const tx0 = T.kind === 'rescue' ? T.x : T.x - len, tx1 = T.kind === 'rescue' ? T.x + len : T.x;
    const head = T.kind === 'rescue' || T.v < 0 ? tx0 : tx1;
    if (T.kind === 'rescue') { T.g.position.set(T.x, 0.2, T.z); }
    else T.g.position.set(T.v > 0 ? T.x : T.x - T.g.userData.len, 0.2, T.z);
    this.trainLight.x = head + (T.kind === 'rescue' || T.v < 0 ? -9 : 9); this.trainLight.y = 4; this.trainLight.z = T.z;
    this.trainLight.intensity = 14;
    if (!T.horned && Math.abs(head - P.pos.x) < 170) { T.horned = true; this.audio.play('horn', { pos: [head, 4, T.z], vol: 1, max: 500, roll: 0.4, far: 60 }); this.noise({ x: head, z: T.z }, 60, 'train'); }
    // rumble follows the train
    if (!T.rumble) T.rumble = this.audio.loop('rumble', 0.9, this.audio.sfx, Object.assign([T.x, 1, T.z], { ref: 10 }));
    if (T.rumble && T.rumble.panner) { const pos = clamp(P.pos.x, tx0, tx1); T.rumble.panner.positionX.value = pos; T.rumble.gain.gain.value = T.stopped ? 0.15 : 0.9; }
    // getting hit by a train is fatal
    if (!T.stopped && Math.abs(P.pos.z - T.z) < 1.9 && P.pos.x > tx0 && P.pos.x < tx1 + 1 && P.pos.y < 3) { P.damage(999); this.gameOver('ट्रेन की चपेट में'); }
    for (const e of this.enemies.list) if (!e.dead && !T.stopped && Math.abs(e.pos.z - T.z) < 1.9 && e.pos.x > tx0 && e.pos.x < tx1) this.enemies.kill(e, 'body', { x: Math.sign(T.v), z: 0 }, 'train');
    if (T.kind === 'freight' && (T.v > 0 ? tx0 > 300 : tx1 < -300)) {
      T.g.visible = false; this.train = null; this.trainLight.on = false;
      if (T.rumble) { T.rumble.stop(); }
      this.nextFreight = 150 + Math.random() * 120;
    }
  }

  startRescue() {
    if (this.train && this.train.rumble) this.train.rumble.stop();
    if (this.train) this.train.g.visible = false;
    this.rescue.visible = true; this.rescue.rotation.y = Math.PI;
    this.train = { kind: 'rescue', g: this.rescue, x: 100 + 260, v: -16, z: RAIL.loopZ, horned: false };
    this.rescue.position.set(this.train.x, 0.2, RAIL.loopZ);
    this.trainLight.on = true;
    if (this.signalAlarm) { this.signalAlarm.stop(); this.signalAlarm = null; }
  }

  // ================= render =================
  render(dt) {
    const R = this.renderer, cam = this.camera;
    if (this.state === 'play') this.lightPool.update(dt, cam, this.time);
    this.sky.position.copy(cam.position); this.stars.position.copy(cam.position);
    this.moon.position.set(cam.position.x - 60, cam.position.y + 75, cam.position.z - 90);
    R.info.reset(); R.clear();
    R.render(this.scene, cam);
    if (this.state === 'play') { R.clearDepth(); R.render(this.wscene, cam); }
    this.adaptResolution(dt);
  }

  adaptResolution(dt) {
    this._fa = (this._fa || 0.016) * 0.95 + dt * 0.05;
    this._rt = (this._rt || 0) + dt;
    if (this._rt < 2) return;
    this._rt = 0;
    let d = this.dpr;
    if (this._fa > 0.026 && d > 0.7) d = Math.max(0.7, d - 0.15);
    else if (this._fa < 0.017 && d < this.maxDpr) d = Math.min(this.maxDpr, d + 0.1);
    if (d !== this.dpr) { this.dpr = d; this.renderer.setPixelRatio(d); }
    const fpsEl = $('fps'); if (fpsEl && !fpsEl.classList.contains('hidden')) fpsEl.textContent = Math.round(1 / this._fa) + ' fps · ' + d.toFixed(2) + 'x · ' + this.renderer.info.render.calls + ' calls';
  }

  // ================= screens =================
  renderMenuBackdrop() { /* the camera orbits the temple while the menu is open */ }

  pause() {
    if (this.state !== 'play') return;
    this.state = 'pause'; this.input.enabled = false;
    document.exitPointerLock?.();
    $('pause').classList.remove('hidden');
    const [hi, en] = this.objectiveText();
    $('pObj').innerHTML = `<b>${hi}</b><span>${en}</span>`;
    $('pHints').innerHTML = (this.obj.key ? '' : '<div>चाबी: जायस सिटी स्टेशन मास्टर ऑफिस · बस अड्डा पूछताछ · नौगजी पुलिस चौकी</div>') + (this.obj.fuse ? '' : '<div>फ्यूज़: वहाबगंज बिजली घर · आलिया मार्केट की दुकान · तीन मंज़िला मकान की छत</div>');
    for (const r of this.radios) if (r.el) r.el.pause();
    this.audio.pauseTracks();
    this.audio.ctx?.suspend();
  }

  resume() {
    $('pause').classList.add('hidden'); $('mapView').classList.add('hidden');
    this.state = 'play'; this.input.enabled = true; this.input.resetState();
    this.audio.resume();
    for (const r of this.radios) if (r.playing && r.el && !r.failed) r.el.play().catch(() => {});
    this.audio.resumeTracks();
    if (!this.input.touch) this.canvas.requestPointerLock?.();
  }

  showMap() {
    this.pause();
    $('pause').classList.add('hidden');
    $('mapView').classList.remove('hidden');
    this.drawMap($('mapCanvas'));
  }

  drawMap(c) { this.townMap.drawFull(c, this); }

  drawMinimap(dt) {
    const c = $('minimap');
    if (!c || !this.input.settings.minimap) return;
    c.style.visibility = this.secret.mode ? 'hidden' : '';
    if (this.secret.mode) return;
    this._mmT = (this._mmT || 0) - dt;
    if (this._mmT > 0) return;
    this._mmT = 0.066;
    const css = c.clientWidth || 112, dpr = Math.min(2, devicePixelRatio || 1), size = Math.round(css * dpr);
    if (c.width !== size) { c.width = size; c.height = size; }
    this.townMap.drawMini(c.getContext('2d'), size, this);
  }

  gameOver(reason) {
    if (this.state !== 'play') return;
    this.state = 'dead'; this.input.enabled = false;
    document.exitPointerLock?.();
    document.body.classList.remove('playing');
    this.audio.stopAll();
    this.chaseOn = false; this._chaseHold = 0;
    if (this.secret.drone && this.secret.drone.gain) this.secret.drone.gain.gain.value = 0;
    if (this.signalAlarm) { this.signalAlarm = null; }
    if (this.train) { this.train.g.visible = false; this.train = null; }
    $('overTitle').textContent = 'YOU DIED';
    $('overSub').textContent = reason || 'आप मारे गए';
    this.fillStats();
    $('over').classList.remove('hidden');
  }

  win() {
    this.state = 'win'; this.input.enabled = false;
    document.exitPointerLock?.();
    document.body.classList.remove('playing');
    this.audio.stopAll();
    $('overTitle').textContent = 'YOU MADE IT OUT';
    $('overSub').textContent = 'आप जायस से निकल गए — the relief train pulls away from Guru Gorakhnath Dham.';
    this.fillStats();
    $('over').classList.remove('hidden');
    $('over').classList.add('won');
  }

  fillStats() {
    const s = this.stats, t = Math.floor(s.t);
    $('stArea').textContent = `${s.farthest} · ${Math.round(this.player.distance)} m`;
    $('stKills').textContent = s.kills;
    $('stTime').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    $('stSup').textContent = s.supplies;
  }

  // ================= DOM wiring =================
  bindUI() {
    const go = () => { $('over').classList.remove('won'); this.newRun(); if (!this.input.touch) this.canvas.requestPointerLock?.(); tryLandscape(); };
    $('btnPlay').onclick = go;
    $('btnRestart').onclick = go;
    $('btnMenu').onclick = () => { $('over').classList.add('hidden'); $('menu').classList.remove('hidden'); this.state = 'menu'; };
    $('btnControls').onclick = () => $('controlsView').classList.remove('hidden');
    $('btnCredits').onclick = () => $('creditsView').classList.remove('hidden');
    $('btnSettings').onclick = $('pSettings').onclick = () => this.openSettings();
    document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => b.closest('.view').classList.add('hidden')));
    $('pResume').onclick = () => this.resume();
    $('pMap').onclick = () => { $('pause').classList.add('hidden'); $('mapView').classList.remove('hidden'); this.drawMap($('mapCanvas')); };
    $('mapView').onclick = () => this.resume();
    document.body.classList.toggle('nomini', !this.input.settings.minimap);
    $('pQuit').onclick = () => { $('pause').classList.add('hidden'); this.audio.stopAll(); this.state = 'menu'; document.body.classList.remove('playing'); $('menu').classList.remove('hidden'); this.audio.resume(); };
    $('pauseBtn').addEventListener('touchstart', (e) => { e.preventDefault(); this.pause(); }, { passive: false });
    $('pauseBtn').onclick = () => this.pause();
    document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && this.state === 'play' && !this.input.touch) this.pause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play') this.pause(); });
    $('loading').classList.add('hidden');
    $('menu').classList.remove('hidden');
    if (this.assets.report.missing.length) $('assetNote').textContent = `${this.assets.report.found.length} of ${this.assets.report.found.length + this.assets.report.missing.length} custom images found — the rest use placeholders.`;
  }

  openSettings() {
    const S = this.input.settings, v = $('settingsView');
    v.classList.remove('hidden');
    const bind = (id, key, fn = (x) => +x) => { const el = $(id); el.value = S[key]; el.oninput = () => { S[key] = el.type === 'checkbox' ? el.checked : fn(el.value); if (el.type === 'checkbox') el.value = el.checked; this.input.saveSettings(); this.input.applyLayout(); }; if (el.type === 'checkbox') el.checked = !!S[key]; };
    bind('sMini', 'minimap'); document.body.classList.toggle('nomini', !S.minimap);
    $('sMini').addEventListener('change', () => document.body.classList.toggle('nomini', !S.minimap));
    bind('sSens', 'sens'); bind('sTouch', 'touchSens'); bind('sBtn', 'btnScale'); bind('sInvert', 'invertY'); bind('sLefty', 'leftHanded'); bind('sBob', 'bob');
    const q = $('sQuality'); q.value = S.quality || 'auto'; q.onchange = () => { S.quality = q.value; this.input.saveSettings(); $('qNote').textContent = 'Applies after reload.'; };
    $('sFps').checked = !$('fps').classList.contains('hidden'); $('sFps').onchange = () => $('fps').classList.toggle('hidden', !$('sFps').checked);
    $('sEdit').onclick = () => {
      this.input.editMode = !this.input.editMode;
      document.body.classList.toggle('editing', this.input.editMode);
      $('sEdit').textContent = this.input.editMode ? 'DONE' : 'EDIT BUTTON LAYOUT';
      if (this.input.editMode) { v.classList.add('hidden'); $('editBar').classList.remove('hidden'); }
    };
    $('editDone').onclick = () => { this.input.editMode = false; document.body.classList.remove('editing'); $('editBar').classList.add('hidden'); $('sEdit').textContent = 'EDIT BUTTON LAYOUT'; };
    $('sReset').onclick = () => this.input.resetLayout();
  }
}

function tick() { return new Promise((r) => setTimeout(r, 0)); }
function tryLandscape() { try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch (e) { /* not supported */ } }
