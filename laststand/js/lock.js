// PIN gate for JAIS: Last Stand. The game does not start until the PIN is typed.
// The PIN is checked in the browser, so it keeps out casual players, not a determined one.
const PIN = '100000';
const OK_KEY = 'ls_pin_ok';        // sessionStorage: stays unlocked for this tab
const GUARD_KEY = 'ls_pin_guard';  // localStorage: counts wrong PINs

function readGuard() { try { return JSON.parse(localStorage.getItem(GUARD_KEY) || '{}'); } catch (e) { return {}; } }
function writeGuard(g) { try { localStorage.setItem(GUARD_KEY, JSON.stringify(g)); } catch (e) {} }
function isUnlocked() { try { return sessionStorage.getItem(OK_KEY) === '1'; } catch (e) { return false; } }

// Resolves once the right PIN is typed (at once if this tab already unlocked it).
export function pinGate() {
  if (isUnlocked()) return Promise.resolve();
  const gate = document.getElementById('lock');
  const form = document.getElementById('lockForm');
  const input = document.getElementById('lockInput');
  const msg = document.getElementById('lockMsg');
  gate.classList.remove('hidden');
  input.focus();
  return new Promise((resolve) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const g = readGuard();
      const wait = Math.ceil(((g.until || 0) - Date.now()) / 1000);
      if (wait > 0) { msg.textContent = 'Too many wrong PINs. Try again in ' + wait + ' sec.'; return; }
      if (input.value === PIN) {
        writeGuard({});
        try { sessionStorage.setItem(OK_KEY, '1'); } catch (err) {}
        gate.classList.add('hidden');
        resolve();
        return;
      }
      // 5 wrong PINs: wait 1 min, then 2, 4, 8... (max 30 min)
      g.fails = (g.fails || 0) + 1;
      if (g.fails >= 5) {
        const mins = Math.min(30, Math.pow(2, g.fails - 5));
        g.until = Date.now() + mins * 60000;
        msg.textContent = 'Too many wrong PINs. Locked for ' + mins + ' min.';
      } else {
        const left = 5 - g.fails;
        msg.textContent = 'Wrong PIN. ' + left + (left === 1 ? ' try' : ' tries') + ' left.';
      }
      writeGuard(g);
      input.value = '';
      input.focus();
    });
  });
}
