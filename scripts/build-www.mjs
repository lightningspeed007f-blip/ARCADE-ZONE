// Builds www/, the folder Capacitor packages into the Android app.
// The game is the page laststand.html (served as index.html) plus the whole laststand/ folder,
// copied exactly as it is in the repo: nothing is rewritten, so every file the game loads is there.
import { cp, copyFile, rm, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'www');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await copyFile(join(root, 'laststand.html'), join(out, 'index.html'));
await cp(join(root, 'laststand'), join(out, 'laststand'), { recursive: true });
await access(join(out, 'laststand', 'js', 'main.js'));   // fail loudly if the copy is incomplete
console.log('www/ ready: index.html + laststand/');
