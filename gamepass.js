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
    ORGANIZER_PIN: '2580',               // PIN for organizer.html
    SECRET: 'MKG-gamepass-change-this',  // change to any random words before uploading
    CODE_VALID_MIN: 10                   // a code works for about this many minutes
  };
  var GAMES = {
    horror: 'The Last Night',
    dharma: 'Dharma Quiz',
    spin:   'Spin The Wheel'
  };

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
  function hasPass(game) { return get('sessionStorage', 'gz_pass_' + game) === '1'; }
  function endAllPasses() { for (var g in GAMES) del('sessionStorage', 'gz_pass_' + g); }

  window.GamePass = {
    CONFIG: CONFIG, GAMES: GAMES, makeCode: makeCode, checkCode: checkCode,
    deviceId: deviceId, hasPass: hasPass, endAllPasses: endAllPasses, locked: false
  };

  /* ---------- the lock screen ---------- */
  var me = document.currentScript;
  var game = me && me.getAttribute('data-game');
  if (!game || !GAMES[game]) return;
  if (game === 'spin' && /[?&]organizer/.test(location.search)) return;  // staff panel stays reachable

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
        '<p>This game is locked. Show this Player ID at the counter to get your code:</p>' +
        '<div class="gz-id" id="gzId"></div>' +
        '<input id="gzCode" type="tel" inputmode="numeric" maxlength="7" placeholder="------" autocomplete="off" aria-label="6-digit code">' +
        '<div class="gz-err" id="gzErr" role="alert"></div>' +
        '<div class="gz-row"><a href="index.html">← BACK</a><button class="gz-go" id="gzGo">UNLOCK</button></div>' +
        '<p style="font-size:12px;color:#7d88a3;margin-top:12px">Each code works once, on this phone only, for about ' + CONFIG.CODE_VALID_MIN + ' minutes.</p>' +
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
    set('sessionStorage', 'gz_pass_' + game, '1');
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

  if (!hasPass(game)) {
    window.GamePass.locked = true;
    if (document.body) lock(); else document.addEventListener('DOMContentLoaded', lock);
  }
  // Coming back with the browser's Back/Forward button after the pass ended → lock again
  window.addEventListener('pageshow', function () { if (!hasPass(game)) lock(); });
})();
