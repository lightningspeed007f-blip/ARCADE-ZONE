// Entry point: boot the game and show loading progress.
import { Game } from './game.js';
import { pinGate } from './lock.js';

const bar = document.getElementById('loadFill'), txt = document.getElementById('loadText');
// The game does not start loading until the PIN is entered (see lock.js)
pinGate().then(() => {
  const game = new Game();
  window.__jls = game; // handy for debugging from the console
  game.init((p, label) => {
    bar.style.width = Math.round(p * 100) + '%';
    if (label) txt.textContent = label;
  }).catch((e) => {
    console.error(e);
    txt.textContent = 'Error: ' + e.message;
  });
});
