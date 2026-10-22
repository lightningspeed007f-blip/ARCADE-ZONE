/* =========================================================
   GAME PASS — one-time entry codes for locked games
   ---------------------------------------------------------
   How it works (same idea as the Spin & Win codes):
   1. The player opens a locked game. Their phone shows a 4-digit PLAYER ID.
   2. Staff open organizer.html, type that ID and pick the game.
      A 6-digit code is made for THAT phone, THAT game, valid ~10 minutes.
   3. The player types the code. It works only once, only on that phone.
      Going back to the Game Zone ends the pass; the next player needs a new code.

   Spin The Wheel is unlocked differently: staff type the one fixed SPIN_CODE
   (below) on the player's phone, and each time it gives one spin.

   Jais Express and Tap The Panda (FIXED_GAMES below) use one fixed staff code
   (STAFF_CODE) instead: no Player ID, the same code works every time.

   Use in a game page (inside <head>):
     <script src="gamepass.js" data-game="horror"></script>
   ========================================================= */
(function () {
  var CONFIG = {
    ORGANIZER_PIN: '241176',             // PIN for organizer.html
    SECRET: 'MKG-30d5ae327473d2e3911a2bdd',  // random words that make codes impossible to guess
    CODE_VALID_MIN: 10,                  // a code works for about this many minutes
    SPIN_CODE: '786110',                 // Spin The Wheel: staff type this same code for every spin
    STAFF_CODE: '786110'                 // Jais Express + Tap The Panda: fixed code, never changes
  };
  var GAMES = {
    dharma: 'Dharma Quiz',
    cricket: 'Cricket KBC',
    jais:   'Jais Express',
    panda:  'Tap The Panda'
  };
  // These games open with the fixed STAFF_CODE (no Player ID, no one-time code)
  var FIXED_GAMES = { jais: true, panda: true };

  /* ---------- safe storage ---------- */
  function get(t, k) { try { return window[t].getItem(k); } catch (e) { return null; } }
  function set(t, k, v) { try { window[t].setItem(k, v); } catch (e) {} }
  function del(t, k) { try { window[t].removeItem(k); } catch (e) {} }

  /* ---------- codes ---------- */
  function cyrb53(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
  function h4(str) { return String(cyrb53(CONFIG.SECRET + '|' + str) % 10000); }
  function pad4(s) { return ('0000' + s).slice(-4); }
  function slotNow() { return Math.floor(Date.now() / (CONFIG.CODE_VALID_MIN * 60000)); }
  function codeFor(dev, game, slot, nonce) {
    return String(nonce) + pad4(h4('G|' + dev + '|' + game + '|' + slot + '|' + nonce));
  }
  function makeCode(dev, game) {
    return codeFor(dev, game, slotNow(), 10 + Math.floor(Math.random() * 90));
  }
  function checkCode(dev, game, code) {
    var nonce = code.slice(0, 2), s = slotNow();
    var slots = [s, s - 1, s + 1];
    for (var i = 0; i < slots.length; i++) if (codeFor(dev, game, slots[i], nonce) === code) return true;
    return false;
  }

  /* ---------- player ID (shared with Spin & Win when it exists) ---------- */
  function deviceId() {
    var id = get('localStorage', 'gz_device_id');
    if (!/^\d{4}$/.test(id || '')) {
      try { id = JSON.parse(get('localStorage', 'mkg_player_v2') || '{}').deviceId; } catch (e) { id = null; }
      if (!/^\d{4}$/.test(id || '')) id = String(1000 + Math.floor(Math.random() * 9000));
      set('localStorage', 'gz_device_id', id);
    }
    return id;
  }
  function usedCodes() { try { return JSON.parse(get('localStorage', 'gz_used_codes') || '[]'); } catch (e) { return []; } }
  function markUsed(code) {
    var u = usedCodes(); u.unshift(code);
    set('localStorage', 'gz_used_codes', JSON.stringify(u.slice(0, 300)));
  }
  /* ---------- staff PIN guard ----------
     Wrong PINs lock the PIN box: 5 wrong → wait 1 min, then 2, 4, 8… (max 30 min).
     The count is kept even if the page is reloaded. */
  var PIN_KEY = 'gz_pin_guard';
  function pinGuard() { try { return JSON.parse(get('localStorage', PIN_KEY) || '{}'); } catch (e) { return {}; } }
  function pinWaitSec() { return Math.max(0, Math.ceil(((pinGuard().until || 0) - Date.now()) / 1000)); }
  // returns { ok:true } or { ok:false, msg:'…' }
  function checkPin(value) {
    var wait = pinWaitSec();
    if (wait > 0) return { ok: false, msg: 'Too many wrong PINs. Try again in ' + fmtWait(wait) + '.' };
    var g = pinGuard();
    if (String(value) === CONFIG.ORGANIZER_PIN) { del('localStorage', PIN_KEY); set('sessionStorage', 'gz_org_ok', '1'); return { ok: true }; }
    g.fails = (g.fails || 0) + 1;
    if (g.fails >= 5) {
      var mins = Math.min(30, Math.pow(2, g.fails - 5));
      g.until = Date.now() + mins * 60000;
      set('localStorage', PIN_KEY, JSON.stringify(g));
      return { ok: false, msg: 'Too many wrong PINs. Locked for ' + mins + ' min.' };
    }
    set('localStorage', PIN_KEY, JSON.stringify(g));
    var left = 5 - g.fails;
    return { ok: false, msg: 'Wrong PIN. ' + left + (left === 1 ? ' try' : ' tries') + ' left.' };
  }
  function fmtWait(s) { return s >= 60 ? Math.ceil(s / 60) + ' min' : s + ' sec'; }
  function staffOk() { return get('sessionStorage', 'gz_org_ok') === '1'; }
  function staffLogout() { del('sessionStorage', 'gz_org_ok'); }
  // Staff screens lock themselves after this long with no taps
  function autoLock(onLock, minutes) {
    var t = null, ms = (minutes || 5) * 60000;
    function reset() { clearTimeout(t); t = setTimeout(function () { staffLogout(); onLock(); }, ms); }
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { document.addEventListener(ev, reset, true); });
    reset();
  }

  function hasPass(game) { return get('sessionStorage', 'gz_pass_' + game) === '1'; }
  function endAllPasses() { for (var g in GAMES) del('sessionStorage', 'gz_pass_' + g); }

  /* ---------- ADMIN MODE (the owner's own demo phone) ----------
     Turned on from the Staff page (organizer.html, behind the staff PIN) and remembered on
     THIS phone only (localStorage). While it is on, locked games open without a code, so the
     owner can demo them again and again. Nothing is written to codes, Player IDs or any other
     phone: other players keep needing a code for every game, exactly as before.
     The stored value is tied to this phone's Player ID, so copying it to another phone does nothing.
     Honest limit: this is a browser-only game with no server, so this is a convenience lock,
     not real security. Someone with developer tools on THIS phone could still change it. */
  var ADMIN_KEY = 'gz_admin_v1';
  function adminToken(dev, salt) { return String(cyrb53(CONFIG.SECRET + '|ADMIN|' + dev + '|' + salt)); }
  function isAdmin() {
    try {
      var a = JSON.parse(get('localStorage', ADMIN_KEY) || 'null');
      return !!(a && a.s && a.t === adminToken(deviceId(), a.s));
    } catch (e) { return false; }
  }
  // Only works while the staff PIN is unlocked (see checkPin). Returns true when changed.
  function setAdmin(on) {
    if (on) {
      if (!staffOk()) return false;
      var salt = String(Date.now()) + String(Math.random()).slice(2, 8);
      set('localStorage', ADMIN_KEY, JSON.stringify({ s: salt, t: adminToken(deviceId(), salt) }));
    } else del('localStorage', ADMIN_KEY);   // switching it OFF never needs the PIN
    showAdminBadge();
    return true;
  }
  var badge = null;
  function showAdminBadge() {
    var on = isAdmin();
    if (!on) { if (badge && badge.parentNode) badge.parentNode.removeChild(badge); badge = null; return; }
    if (badge || !document.body) return;
    badge = document.createElement('div');
    badge.id = 'gzAdminBadge';
    badge.textContent = 'ADMIN ∞';
    // On game pages the badge only shows; it never takes a tap away from the game.
    // In the Game Zone / StoryMode lobbies a tap offers to leave Admin Mode.
    var lobby = !gameKey;
    badge.style.cssText = 'position:fixed;left:calc(6px + env(safe-area-inset-left));bottom:calc(6px + env(safe-area-inset-bottom));' +
      'z-index:2147483001;padding:2px 8px;border-radius:10px;font:700 10px/16px Orbitron,Rajdhani,system-ui,sans-serif;letter-spacing:1px;' +
      'color:#ffcf3f;background:rgba(5,6,10,.72);border:1px solid rgba(255,207,63,.55);opacity:.85;' +
      (lobby ? 'cursor:pointer;' : 'pointer-events:none;');
    badge.title = 'Admin Mode is on for this phone: locked games open without a code.';
    if (lobby) badge.addEventListener('click', function (e) {
      e.stopPropagation(); e.preventDefault();
      if (window.confirm('Admin Mode is ON for this phone (unlimited plays).\n\nTurn Admin Mode OFF and go back to normal player mode?')) setAdmin(false);
    });
    document.body.appendChild(badge);
  }

  window.GamePass = {
    CONFIG: CONFIG, GAMES: GAMES, FIXED_GAMES: FIXED_GAMES, makeCode: makeCode, checkCode: checkCode,
    deviceId: deviceId, hasPass: hasPass, endAllPasses: endAllPasses, locked: false,
    checkPin: checkPin, staffOk: staffOk, staffLogout: staffLogout, autoLock: autoLock,
    isAdmin: isAdmin, setAdmin: setAdmin
  };

  // Games are open to everyone: no lock screen, no entry code.
  var me = document.currentScript;
  var game = me && me.getAttribute('data-game');
  var gameKey = game && GAMES[game] ? game : null;
  if (document.body) showAdminBadge(); else document.addEventListener('DOMContentLoaded', showAdminBadge);
})();
