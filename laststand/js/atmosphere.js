// The sky and the air over Jais at night: a low mist that drifts over the graves and the railway, and
// lightning far off over the fields, with its thunder a little later.
//
// The mist is a particle system (explosives.js), so it costs one draw call. It is thick at night and
// thin in the day, and it only drifts east with the wind. The lightning is a short lift of the fill
// light (the hemisphere light, which the day cycle sets every frame, so this runs after it) and only
// happens at night, in town, while you play.
import { Particles, puffTex } from './explosives.js';

// where the mist lies: the stone row by Jais City station, the graves by MAW, and the railway line itself
const MIST = [
  { x0: -178, x1: -104, z0: -196, z1: -182, rate: 1.4 },
  { x0: 52, x1: 98, z0: -198, z1: -184, rate: 1.0 },
  { x0: -232, x1: 232, z0: -180, z1: -172, rate: 0.9 },
];
const BOLT_GAP = [40, 110];      // seconds between lightning, at random within this range
const THUNDER_DELAY = [0.8, 2.6]; // seconds from the flash to the thunder (further off = later)
const rnd = (a, b) => a + Math.random() * (b - a);

export class Atmosphere {
  constructor(game) {
    this.g = game;
    this.mist = new Particles(game.scene, 320, false, puffTex());
    this.nextBolt = rnd(BOLT_GAP[0], BOLT_GAP[1]);
    this.bolt = -1;         // seconds since the last flash (negative: none is running)
    this.thunder = -1;      // seconds until the thunder (negative: none is due)
    this.lampsK = 0;        // night factor, smoothed
  }

  // called every render frame; the thunder and the timers only run while you play
  update(dt) {
    const g = this.g;
    const night = g.day.lights().lamps ?? 0;
    this.lampsK += (night - this.lampsK) * Math.min(1, dt * 0.5);

    // mist: puffs born low over each area, drifting east, fading in and out
    const k = 0.35 + 0.65 * this.lampsK;      // day haze is thin, night mist is thick
    for (const a of MIST) {
      // about 9 puffs a second per unit of rate; a fraction of a puff is a chance to emit one
      for (let n = a.rate * dt * 9; n > 0; n -= 1) {
        if (Math.random() > n) continue;
        const x = rnd(a.x0, a.x1), z = rnd(a.z0, a.z1), y = rnd(0.2, 0.7);
        const life = rnd(7, 11), s = rnd(3, 5.5);
        const tone = 0.42 + rnd(-0.05, 0.05);
        this.mist.emit(x, y, z, rnd(0.25, 0.55), rnd(-0.02, 0.04), rnd(-0.1, 0.1), life, s * 0.6, s,
          [tone, tone + 0.03, tone + 0.07], [tone + 0.05, tone + 0.08, tone + 0.1], 0.13 * k, 0.02, 0.05);
      }
    }
    const uScale = g.renderer.domElement.height * 0.5 / Math.tan(g.camera.fov * Math.PI / 360);
    this.mist.update(dt, uScale);

    if (g.state !== 'play') return;

    // lightning: at night only, after a random pause, with its thunder a moment later
    this.nextBolt -= dt;
    if (this.nextBolt <= 0 && this.lampsK > 0.6 && !g.inside) {
      this.bolt = 0;
      this.thunder = rnd(THUNDER_DELAY[0], THUNDER_DELAY[1]);
      this.nextBolt = rnd(BOLT_GAP[0], BOLT_GAP[1]);
    }
    if (this.thunder >= 0) {
      this.thunder -= dt;
      if (this.thunder < 0) { g.audio.play('thunder', { vol: rnd(0.45, 0.7) }); this.thunder = -1; }
    }
  }

  // the flash itself: a sharp double pulse on the fill light, called right after the day cycle sets it
  light(dt) {
    if (this.bolt < 0) return;
    this.bolt += dt;
    const t = this.bolt;
    const pulse = (t < 0.07 ? 1 : 0) + (t > 0.16 && t < 0.26 ? 0.55 : 0);
    const hemi = this.g.hemi;
    hemi.intensity += pulse * 2.2;
    if (t > 0.5) this.bolt = -1;
  }
}
