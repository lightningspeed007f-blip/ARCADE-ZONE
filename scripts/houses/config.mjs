// Per-house settings. Final frame: metres, front faces -z with its front edge on z = 0, centred on x, ground y = 0.
// doors: {x, z, along ('x' = in a wall running along x), w, h, y (threshold), out (-1/+1: outward along the other axis), inner}
// floors: [x0, z0, x1, z1, y] a walkable floor (and a ceiling) the game adds, for shells with no floor of their own
// crop: [x0, z0, x1, z1] keep only this (scaled, before turning)   drop/cut: triangle filters   simplify: target triangles
// the original uploads (Sketchfab .glb files), wherever you keep them: UPLOADS=/path/to/folder
const U = (process.env.UPLOADS || './uploads').replace(/\/?$/, '/');
const OUT = process.env.OUT || './out';
export const CONFIG = {
  american: { src: U + '012e24be-american_house.glb', scale: 1, yaw: Math.PI, simplify: 10000, simpErr: 0.006,
    doors: [{ x: -2.58, z: 2.15, along: 'x', w: 0.95, h: 2.05, y: 0.68, out: -1 }],
    floors: [[-7.1, 2.3, 1.8, 9.5, 0.68]] },
  apocalypse: { src: U + 'a6177d40-low__house__building__apocalypse__dirty.glb', scale: 1, yaw: Math.PI,
    doors: [{ x: -1.1, z: 1.6, along: 'x', w: 1.3, h: 2.15, y: 0.5, out: -1 }] },
  abandoned: { src: U + '4ca39608-abandoned_house.glb', scale: 1, yaw: 0, crop: [-5.2, -3.3, 5.3, 5.5], simplify: 8000,
    doors: [{ x: 1.0, z: 2.8, along: 'x', w: 1.2, h: 2.2, y: 0.1, out: -1, open: true, depth: 0.5 }] },
  wooden: { src: U + '8b28b3b8-old__house__wooden__enterable__rusty.glb', scale: 1, yaw: 0, simplify: 12000, simpErr: 0.01, tex: 768,
    doors: [{ x: -1.87, z: 1.4, along: 'x', w: 1.05, h: 2.15, y: 0.15, out: -1 }] },
  farm: { src: U + 'b6f82519-farm_house.glb', scale: 0.1, yaw: 0,
    // the roof texture was cut off in upload: its last rows decode as green; refill them from the shingle rows one period up
    texFix: { '*': async (sharp, buf) => {
      const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const { width: w, height: h } = info, row = (y) => { let g = 0; for (let x = 0; x < w; x++) { const o = (y * w + x) * 3; g += data[o + 1] - (data[o] + data[o + 2]) / 2; } return g / w; };
      let bad = h; while (bad > 0 && row(bad - 1) > 25) bad--;
      if (bad === h) return null;
      bad = Math.max(0, bad - 4);
      const per = Math.round(h * 2 / 14);
      for (let y = bad; y < h; y++) { let sy = y - per; while (sy >= bad) sy -= per; data.copy(data, y * w * 3, sy * w * 3, (sy + 1) * w * 3); }
      return sharp(data, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
    } },
    doors: [{ x: 2.15, z: 1.6, along: 'x', w: 0.95, h: 1.9, y: 1.21, out: -1 }, { x: -4.35, z: 6.15, along: 'z', w: 0.95, h: 1.9, y: 1.21, out: -1 }],
    floors: [[-4.2, 1.75, 5.45, 8.95, 1.21]] },
  japan: { src: U + '862478e6-japan_house_restaurant_by_night..glb', scale: 0.01, yaw: Math.PI, simplify: 14000,
    drop: (vs) => vs.every((v) => v[1] < 0.04),
    doors: [{ x: 0.8, z: 2.0, along: 'x', w: 0.95, h: 2.15, y: 0.05, out: -1 }] },
  old: { src: U + '4a330be7-old_house.glb', scale: 0.01, yaw: Math.PI,
    doors: [{ x: -2.6, z: 1.95, along: 'x', w: 0.9, h: 2.0, y: 0.35, out: -1 }] },
  test: { src: U + 'cb244f3b-house_test.glb', scale: 0.01, yaw: -Math.PI / 2,
    doors: [{ x: 1.78, z: 1.3, along: 'x', w: 1.05, h: 2.2, y: 0.78, out: -1 }],
    floors: [[-4.45, 1.4, 3.75, 9.2, 0.78]] },
  horror: { src: U + 'b341426d-modular_kit_horror_house.glb', scale: 0.33, yaw: 0, crop: [-5.28, -33.3, 16.5, -8.25],
    doors: [{ x: 0, z: 4.4, along: 'x', w: 1.8, h: 1.95, y: 0.92, out: -1 }],
    floors: [[-4.4, 4.5, 4.4, 18.1, 0.92], [-6.6, 6.9, 6.6, 13.6, 0.92]] },
  // The Hunter's Rest: the castle door, the scanned corridor and the crypt hall, put together by hunters.mjs
  // (run that first). Not one of the town's random houses: it has its own lot (world.js) and one of the crew waits in it.
  hunters: { src: OUT + '/hunters_src.glb', scale: 1, yaw: 0, ref: [0, 0, 0], tex: 1024, special: true,
    // lifted 10 cm: the hall's stone tiles are uneven, most of their tops just below its zero, where the town's ground would cover them
    groundY: -0.1,
    // the castle door's two leaves (out/hunters_door.glb) swing in the front wall's opening
    doors: [{ x: 0, z: 0.15, along: 'x', w: 1.42, h: 2.32, y: 0.1, out: -1, depth: 0.15, leaves: 'hunters' }],
    // the walls and roofs the game builds round it: [x0, z0, x1, z1, y0, y1] (they are colliders too)
    shell: [
      [-1.9, 0, -0.71, 0.3, 0, 4.5], [0.71, 0, 1.9, 0.3, 0, 4.5], [-0.71, 0, 0.71, 0.3, 2.42, 4.5],      // front wall, round the door
      [-1.2, -0.4, 1.2, 0, 0, 0.1], [-0.71, 0, 0.71, 0.3, 0, 0.1],                                         // the stone step the door stands on
      [-1.9, 0.3, -1.55, 9.9, 0, 4.5], [1.55, 0.3, 1.9, 9.9, 0, 4.5], [-1.9, 0, 1.9, 9.9, 4.3, 4.5],      // the corridor's walls and roof
      [-11.8, 9.9, -1.0, 10.26, 0, 12.7], [1.0, 9.9, 11.8, 10.26, 0, 12.7], [-1.0, 9.9, 1.0, 10.26, 3.4, 12.7],   // the hall's front wall
      [-11.8, 10.26, -11.5, 35.8, 0, 12.7], [11.5, 10.26, 11.8, 35.8, 0, 12.7],                            // behind the colonnades
      [-11.8, 9.9, 11.8, 35.8, 12.45, 12.7],                                                                  // the roof
      [-11.5, 35.5, -1.6, 35.8, 0, 12.7], [1.6, 35.5, 11.5, 35.8, 0, 12.7], [-1.6, 35.5, 1.6, 35.8, 0, 5.6], [-1.6, 35.5, 1.6, 35.8, 9.4, 12.7],   // the back, open behind the round window
    ],
    // warm light for the candles (x, y, z, colour, strength, reach)
    lights: [[0, 3.2, 3.5, 0xff9a40, 2.5, 7], [0, 3.2, 8, 0xff9a40, 2.5, 7], [-5, 3.5, 15, 0xffb060, 5, 15], [5, 3.5, 15, 0xffb060, 5, 15], [-5, 3.5, 24, 0xffb060, 5, 15], [5, 3.5, 24, 0xffb060, 5, 15], [0, 4, 31, 0xffb060, 6, 14]],
    // the crew member waits on the hall floor, facing the corridor
    seat: [[-3, 22], [3, 22], [0, 19.5], [-4, 17.5], [4, 17.5]] },
};
