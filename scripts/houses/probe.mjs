// print the vertical runs (from the bake boxes) at points: node probe.mjs name x,z x,z ...
import fs from 'fs';
const [name, ...pts] = process.argv.slice(2); const B = JSON.parse(fs.readFileSync(`${process.env.OUT || './out'}/${name}.bake.json`));
for (const p of pts) { const [x, z] = p.split(',').map(Number); const r = B.boxes.filter((b) => Math.abs(x - b[0]) <= b[2] && Math.abs(z - b[1]) <= b[3]).map((b) => b[4] + '-' + b[5]).sort((a, b) => parseFloat(a) - parseFloat(b)); console.log(p, r.join('  ')); }
