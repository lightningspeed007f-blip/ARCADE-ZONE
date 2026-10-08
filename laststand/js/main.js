// Entry point: boot the game and show loading progress.
import { Game } from './game.js';

const bar = document.getElementById('loadFill'), txt = document.getElementById('loadText');
const game = new Game();
window.__jls = game; // handy for debugging from the console
game.init((p, label) => {
  bar.style.width = Math.round(p * 100) + '%';
  if (label) txt.textContent = label;
}).catch((e) => {
  console.error(e);
  txt.textContent = 'Error: ' + e.message;
});
