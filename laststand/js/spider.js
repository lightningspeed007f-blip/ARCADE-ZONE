// THE GIANT SPIDER — a showcase. A huge spider drifts across the sky over Jais, a few times per run.
//
// It never attacks and has no collisions: it fades in, glides slowly across the sky above the town,
// then fades out and is gone for a while. It only appears while you are in the town itself (not
// indoors, not in the valleys or the outlands), and only SPIDER.count times per run.
// music/spider.mp3 (or sounds/spider.mp3) plays five times during each crossing, see MANIFEST.userAudio.
//
//   models/spider.glb   the spider (static, one texture). Lambert like the rest of the town.
import * as THREE from 'three';
import { loadGLB, lambertize } from './models.js';
import { BOUNDS } from './layout.js';
import { clamp, smooth } from './util.js';

export const SPIDER = {
  S: 55,                 // metres per model unit: the body is about 60 m across and tall
  y: 118,                // height of its centre above the ground
  count: 3,              // appearances per run
  first: [70, 110],      // seconds spent in town before the first appearance
  gap: [150, 220],       // seconds between appearances
  span: 130,             // how far it glides across (metres)
  fly: 42,               // seconds for one crossing
  plays: 5,              // how often its sound (music/spider.mp3, a 2-3 s clip) plays in one crossing
};

const rand = (a, b) => a + (b - a) * Math.random();

export class Spider {
  constructor(g) {
    this.g = g;
    this.root = null;      // the model, once it has loaded
    this.mats = [];
    this.count = 0;        // appearances so far this run
    this.stage = 'wait';   // 'wait' -> 'fly' -> 'wait' ... (no more waiting after the last one)
    this.waitT = rand(...SPIDER.first);
    this.t = 0;
    this.played = 0;       // sound plays so far in this crossing
    this.from = new THREE.Vector3();
    this.to = new THREE.Vector3();

    loadGLB('models/spider.glb').then((gltf) => {
      const root = this.root = new THREE.Group();
      const model = lambertize(gltf.scene, false, 0.15);      // a faint glow, so it reads against the night sky
      model.scale.setScalar(SPIDER.S);
      root.add(model);
      root.visible = false;
      // the sky is not foggy: fog would hide a 60 m spider at 130 m, so it is switched off here
      model.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of [].concat(o.material)) { m.fog = false; m.transparent = true; m.opacity = 0; this.mats.push(m); }
      });
      g.scene.add(root);
    }).catch(() => { /* no model file: the spider simply never appears */ });
  }

  reset() {
    this.count = 0;
    this.stage = 'wait';
    this.waitT = rand(...SPIDER.first);
    this.t = 0;
    this.setOpacity(0);
  }

  // Whether you are in the main town: outdoors, not in a valley or the outlands.
  inTown() {
    const P = this.g.player.pos;
    return !this.g.inside && !this.g.inValley() &&
      P.x > BOUNDS.minX && P.x < BOUNDS.maxX && P.z > BOUNDS.minZ && P.z < BOUNDS.maxZ;
  }

  setOpacity(o) {
    for (const m of this.mats) m.opacity = o;
    if (this.root) this.root.visible = o > 0.01;
  }

  // Start a crossing over the spot where you stand (a little random), from one side to the other.
  begin() {
    const P = this.g.player.pos;
    const a = Math.random() * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    const cx = P.x + rand(-30, 30), cz = P.z + rand(-30, 30), h = SPIDER.span / 2;
    this.from.set(cx - dx * h, SPIDER.y, cz - dz * h);
    this.to.set(cx + dx * h, SPIDER.y, cz + dz * h);
    this.count++;
    this.stage = 'fly';
    this.t = 0;
    this.played = 0;
  }

  end() {
    this.stage = 'wait';
    this.waitT = rand(...SPIDER.gap);
    this.setOpacity(0);
  }

  update(dt) {
    if (!this.root) return;
    if (this.stage === 'wait') {
      if (this.count >= SPIDER.count || !this.inTown()) return;
      this.waitT -= dt;
      if (this.waitT <= 0) this.begin();
      return;
    }
    // walked out of the town mid-flight: it goes away at once
    if (!this.inTown()) return this.end();

    this.t += dt;
    const u = clamp(this.t / SPIDER.fly, 0, 1);
    this.root.position.lerpVectors(this.from, this.to, u);
    this.root.position.y += Math.sin(this.g.time * 0.5) * 2.5;           // a slow float
    this.root.rotation.set(0, Math.atan2(this.to.x - this.from.x, this.to.z - this.from.z), 0);
    // fade in over the first part of the flight, out over the last part
    this.setOpacity(smooth(clamp(u / 0.12, 0, 1)) * smooth(clamp((1 - u) / 0.15, 0, 1)));
    // its sound, spread evenly over the crossing: one play at the middle of each slice of time
    while (this.played < SPIDER.plays && this.t >= (SPIDER.fly * (this.played + 0.5)) / SPIDER.plays) {
      this.played++;
      this.g.audio.play('spider', { vol: 0.9, verb: false });
    }
    if (u >= 1) this.end();
  }
}
