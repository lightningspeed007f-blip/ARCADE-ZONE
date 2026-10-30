// Bakes out/<name>.json (written by build.mjs) for the new houses into laststand/js/homes.js: each one's footprint and height.
// usage: node homes.mjs     (after building them all; see laststand/assets/README.md)
import fs from 'fs';
import { CONFIG } from './config.mjs';
const OUT = process.env.OUT || './out';
const names = Object.keys(CONFIG).filter((n) => CONFIG[n].fbx || n === 'autumn');
const rows = names.map((n) => { const j = JSON.parse(fs.readFileSync(`${OUT}/${n}.json`, 'utf8')); return `  ${n}: { foot: [${j.foot.join(', ')}], top: ${j.top} },`; });
fs.writeFileSync('../../laststand/js/homes.js', `// Baked by scripts/scenery/homes.mjs from the built models (models/scenery/<name>.glb): the ground each one covers [x0, z0, x1, z1] and
// its height, in metres, front toward -z on z = 0, centred on x. Do not edit by hand.
export const HOMES = {
${rows.join('\n')}
};
`);
console.log('wrote', names.length);
