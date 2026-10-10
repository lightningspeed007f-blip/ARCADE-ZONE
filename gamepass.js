/* =========================================================
   GAME PASS — one-time entry codes for locked games
   ---------------------------------------------------------
   How it works (same idea as the Spin & Win codes):
   1. The player opens a locked game. Their phone shows a 4-digit PLAYER ID.
   2. Staff open organizer.html, type that ID and pick the game.
      A 6-digit code is made for THAT phone, THAT game, valid ~10 minutes.
   3. The player types the code. It works only once, only on that phone.
      Going back to the Game Zone ends the pass; the next player needs a new code.

   Use in a game page (inside <head>):
     <script src="gamepass.js" data-game="horror"></script>
   ========================================================= */
(function () {
  var CONFIG = {
    ORGANIZER_PIN: '241176',             // PIN for organizer.html
    SECRET: 'MKG-30d5ae327473d2e3911a2bdd',  // random words that make codes impossible to guess
    CODE_VALID_MIN: 10                   // a code works for about this many minutes
  };
  var GAMES = {
    horror: 'The Last Night',
    dharma: 'Dharma Quiz',
    spin:   'Spin The Wheel',
    jais:   'Jais Express'
  };
  // Games unlocked ONCE per phone: after one valid code the phone stays unlocked for good
  // (it does not relock when the player goes back to the Game Zone). Every other game needs a
  // fresh code each visit.
  var ONE_TIME = { jais: true };

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

  /* The one-time unlock is tied to this phone's Player ID, so copying the stored value to
     another phone (which has a different ID) does nothing. */
  function unlockToken(game) { return String(cyrb53(CONFIG.SECRET + '|ONCE|' + game + '|' + deviceId())); }
  function hasPass(game) {
    if (ONE_TIME[game]) return get('localStorage', 'gz_once_' + game) === unlockToken(game);
    return get('sessionStorage', 'gz_pass_' + game) === '1';
  }
  function grantPass(game) {
    if (ONE_TIME[game]) set('localStorage', 'gz_once_' + game, unlockToken(game));
    else set('sessionStorage', 'gz_pass_' + game, '1');
  }
  // Ends the per-visit passes. One-time unlocks are kept.
  function endAllPasses() { for (var g in GAMES) if (!ONE_TIME[g]) del('sessionStorage', 'gz_pass_' + g); }

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
    CONFIG: CONFIG, GAMES: GAMES, ONE_TIME: ONE_TIME, makeCode: makeCode, checkCode: checkCode,
    deviceId: deviceId, hasPass: hasPass, endAllPasses: endAllPasses, locked: false,
    checkPin: checkPin, staffOk: staffOk, staffLogout: staffLogout, autoLock: autoLock,
    isAdmin: isAdmin, setAdmin: setAdmin
  };

  /* ---------- the lock screen ---------- */
  var me = document.currentScript;
  var game = me && me.getAttribute('data-game');
  var gameKey = game && GAMES[game] ? game : null;
  if (document.body) showAdminBadge(); else document.addEventListener('DOMContentLoaded', showAdminBadge);
  if (!game || !GAMES[game]) return;
  // Staff who unlocked the Staff page can open the Spin organizer without a player code
  if (game === 'spin' && /[?&]organizer/.test(location.search) && staffOk()) return;

  var gate = null;
  var realPlay = HTMLMediaElement.prototype.play;
  // While locked, games may not start their music/video behind the lock screen
  HTMLMediaElement.prototype.play = function () {
    if (window.GamePass.locked) return Promise.reject(new Error('locked'));
    return realPlay.apply(this, arguments);
  };

  var CSS =
    '#gzGate{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;' +
    'background:radial-gradient(circle at 50% 30%,#1a0f30 0%,#05060a 75%);font-family:Rajdhani,"Segoe UI",system-ui,sans-serif;color:#eef4f8;' +
    '-webkit-user-select:none;user-select:none}' +
    '#gzGate .gz-card{width:100%;max-width:360px;text-align:center;background:rgba(15,17,30,.92);border:1px solid rgba(0,240,255,.35);' +
    'border-radius:20px;padding:22px 18px;box-shadow:0 0 40px rgba(0,240,255,.15)}' +
    '#gzGate .gz-lock{font-size:40px;line-height:1}' +
    '#gzGate h2{font-family:Orbitron,sans-serif;font-size:19px;letter-spacing:2px;color:#00f0ff;margin:8px 0 4px}' +
    '#gzGate p{font-size:15px;color:#c4cce0;margin:6px 0;line-height:1.35}' +
    '#gzGate .gz-id{font-family:Orbitron,monospace;font-size:44px;font-weight:900;letter-spacing:8px;color:#ffcf3f;margin:6px 0 10px;' +
    'text-shadow:0 0 14px rgba(255,207,63,.5)}' +
    '#gzGate input{width:100%;font-family:Orbitron,monospace;font-size:26px;letter-spacing:6px;text-align:center;padding:10px;margin-top:6px;' +
    'border-radius:12px;border:1px solid #2a3550;background:#0a0d18;color:#fff;-webkit-user-select:text;user-select:text}' +
    '#gzGate input:focus{outline:2px solid #00f0ff;outline-offset:1px}' +
    '#gzGate .gz-err{color:#ff5a6e;min-height:20px;font-size:14px}' +
    '#gzGate .gz-row{display:flex;gap:10px;margin-top:8px}' +
    '#gzGate button,#gzGate a{flex:1;display:block;padding:12px;border-radius:12px;font-family:Orbitron,sans-serif;font-size:13px;font-weight:700;' +
    'text-decoration:none;cursor:pointer;border:1px solid #2a3550;background:#141a2c;color:#c4cce0}' +
    '#gzGate button.gz-go{background:#00f0ff;border-color:#00f0ff;color:#04121a}';

  function buildGate() {
    if (gate) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    gate = document.createElement('div');
    gate.id = 'gzGate';
    gate.innerHTML =
      '<div class="gz-card" role="dialog" aria-modal="true" aria-labelledby="gzTitle">' +
        '<div class="gz-lock">🔒</div>' +
        '<h2 id="gzTitle">' + GAMES[game].toUpperCase() + '</h2>' +
        '<p>' + (ONE_TIME[game] ? 'This game needs a one-time code. Show this Player ID at the counter to get yours:' : 'This game is locked. Show this Player ID at the counter to get your code:') + '</p>' +
        '<div class="gz-id" id="gzId"></div>' +
        '<input id="gzCode" type="tel" inputmode="numeric" maxlength="7" placeholder="------" autocomplete="off" aria-label="6-digit code">' +
        '<div class="gz-err" id="gzErr" role="alert"></div>' +
        '<div class="gz-row"><a href="index.html">← BACK</a><button class="gz-go" id="gzGo">UNLOCK</button></div>' +
        '<p style="font-size:12px;color:#7d88a3;margin-top:12px">' + (ONE_TIME[game]
          ? 'Enter it once — this phone then stays unlocked and never needs another code for this game. The code works on this phone only, for about ' + CONFIG.CODE_VALID_MIN + ' minutes.'
          : 'Each code works once, on this phone only, for about ' + CONFIG.CODE_VALID_MIN + ' minutes.') + '</p>' +
      '</div>';
    // Nothing typed or tapped on the lock screen reaches the game underneath
    ['click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'keydown', 'keyup', 'wheel'].forEach(function (t) {
      gate.addEventListener(t, function (e) { e.stopPropagation(); });
    });
    document.body.appendChild(gate);
    document.getElementById('gzId').textContent = deviceId();
    document.getElementById('gzGo').addEventListener('click', tryUnlock);
    document.getElementById('gzCode').addEventListener('keydown', function (e) { if (e.key === 'Enter') tryUnlock(); });
  }

  function tryUnlock() {
    var code = document.getElementById('gzCode').value.replace(/\D/g, '');
    var err = document.getElementById('gzErr');
    if (code.length !== 6) { err.textContent = 'Enter the 6-digit code from the counter.'; return; }
    if (usedCodes().indexOf(code) >= 0) { err.textContent = 'This code was already used. Ask for a new one.'; return; }
    if (!checkCode(deviceId(), game, code)) { err.textContent = 'Wrong or expired code. Check your Player ID and ask for a new code.'; return; }
    markUsed(code);
    grantPass(game);
    unlock();
  }

  function lock() {
    window.GamePass.locked = true;
    buildGate();
    gate.style.display = 'flex';
    document.getElementById('gzCode').value = '';
    document.getElementById('gzErr').textContent = '';
  }
  function unlock() {
    window.GamePass.locked = false;
    if (gate) gate.style.display = 'none';
    try { if (navigator.vibrate) navigator.vibrate(40); } catch (e) {}
  }

  // Admin Mode (owner's phone): no lock screen, no code used, nothing recorded
  if (!hasPass(game) && !isAdmin()) {
    window.GamePass.locked = true;
    if (document.body) lock(); else document.addEventListener('DOMContentLoaded', lock);
  }
  // Coming back with the browser's Back/Forward button after the pass ended → lock again
  window.addEventListener('pageshow', function () { if (!hasPass(game) && !isAdmin()) lock(); });
})();
