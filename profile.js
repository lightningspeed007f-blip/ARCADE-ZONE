/* =========================================================
   PLAYER PROFILE — one name per phone, asked only once
   ---------------------------------------------------------
   The first time someone plays, they type their name ONE time. It is saved on
   their phone together with a random 4-character PLAYER TAG, e.g.  UTSAV #K7QX.
   The tag never changes (even if they later fix a typo in their name), and it is
   shown next to their name on every scoreboard. Two players called "RAHUL" get
   different tags, so a winner is easy to check: ask them to open their profile
   (tap the round badge on the Game Zone home) and match the tag with the board.

   Use in a page:  <script src="profile.js"></script>
     GZProfile.get()          → { name, tag, since } or null
     GZProfile.require()      → Promise of the profile (asks for a name if none yet)
     GZProfile.openCard()     → shows the profile card
     GZProfile.label(p)       → "UTSAV #K7QX"

   Honest limit: there is no login server, so the profile lives in this phone's
   browser. Clearing browser data makes a new tag.
   ========================================================= */
(function () {
  var KEY = 'gz_profile_v1';
  var TAG_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O or 1/I, easy to read out loud
  var memory = null;                                    // used when the browser blocks storage

  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} }
  function oldName(k) { try { var v = JSON.parse(lsGet(k) || '""'); return typeof v === 'string' ? v : ''; } catch (e) { return ''; } }

  function cleanName(n) { return String(n || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12); }
  function validName(n) { return /^[A-Z0-9 ]{2,12}$/.test(n); }
  function validTag(t) { return /^[A-HJ-NP-Z2-9]{4}$/.test(t || ''); }
  function newTag() {
    var out = '', buf = null;
    try { buf = new Uint8Array(4); window.crypto.getRandomValues(buf); } catch (e) { buf = null; }
    for (var i = 0; i < 4; i++) out += TAG_CHARS[(buf ? buf[i] : Math.floor(Math.random() * 256)) % TAG_CHARS.length];
    return out;
  }

  function get() {
    if (memory) return memory;
    try {
      var p = JSON.parse(lsGet(KEY) || 'null');
      if (p && validName(p.name) && validTag(p.tag)) { memory = p; return p; }
    } catch (e) {}
    return null;
  }
  function save(name) {
    var cur = get();
    var p = { name: name, tag: cur ? cur.tag : newTag(), since: cur ? cur.since : Date.now() };
    memory = p;
    lsSet(KEY, JSON.stringify(p));
    // keep the games' old name boxes in step
    lsSet('jx_name', JSON.stringify(name));
    lsSet('tp_name', JSON.stringify(name));
    listeners.forEach(function (fn) { try { fn(p); } catch (e) {} });
    return p;
  }
  function label(p) { p = p || get(); return p ? p.name + ' #' + p.tag : ''; }
  var listeners = [];
  function onChange(fn) { listeners.push(fn); }

  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Number(n || 0).toLocaleString('en-IN'); }

  /* ---------- look ---------- */
  var styled = false;
  function addStyle() {
    if (styled) return; styled = true;
    var css =
      '.gzp-back{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;' +
        'background:rgba(3,3,8,.78);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);font-family:Rajdhani,"Segoe UI",sans-serif;color:#eef4f8;}' +
      '.gzp-box{width:100%;max-width:340px;max-height:100%;overflow-y:auto;background:linear-gradient(180deg,#141028,#0a0912);border:1.5px solid rgba(0,240,255,.45);' +
        'border-radius:20px;padding:20px 18px 16px;text-align:center;box-shadow:0 0 40px rgba(0,240,255,.25),0 0 80px rgba(255,45,138,.18);}' +
      '.gzp-h{font-family:Orbitron,sans-serif;font-weight:900;font-size:17px;letter-spacing:2px;color:#00f0ff;text-shadow:0 0 12px rgba(0,240,255,.5);}' +
      '.gzp-p{color:#c4cce0;font-size:15px;line-height:1.35;margin:8px 0 14px;}' +
      '.gzp-in{width:100%;background:rgba(14,12,26,.95);color:#fff;border:1.5px solid rgba(255,255,255,.2);border-radius:14px;padding:13px 14px;' +
        'font-family:Orbitron,sans-serif;font-size:16px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-align:center;outline:none;}' +
      '.gzp-in:focus{border-color:#00f0ff;}' +
      '.gzp-err{color:#ff5a6e;font-size:13px;min-height:18px;margin-top:6px;}' +
      '.gzp-btn{width:100%;margin-top:8px;padding:13px;border:0;border-radius:14px;cursor:pointer;font-family:Orbitron,sans-serif;font-weight:900;' +
        'font-size:14px;letter-spacing:2px;color:#05060a;background:linear-gradient(90deg,#00f0ff,#b46bff);}' +
      '.gzp-btn.alt{background:rgba(255,255,255,.06);color:#eef4f8;border:1px solid rgba(255,255,255,.18);font-size:12px;}' +
      '.gzp-btn:active{transform:scale(.97);}' +
      '.gzp-av{width:74px;height:74px;margin:2px auto 10px;border-radius:50%;display:flex;align-items:center;justify-content:center;' +
        'font-family:Orbitron,sans-serif;font-weight:900;font-size:30px;color:#05060a;background:linear-gradient(135deg,#00f0ff,#ff2d8a);box-shadow:0 0 24px rgba(0,240,255,.45);}' +
      '.gzp-name{font-family:Orbitron,sans-serif;font-weight:900;font-size:22px;letter-spacing:1.5px;word-break:break-word;}' +
      '.gzp-tag{display:inline-block;margin-top:8px;padding:5px 16px;border-radius:30px;font-family:Orbitron,sans-serif;font-weight:900;font-size:20px;' +
        'letter-spacing:4px;color:#ffcf3f;border:1.5px solid rgba(255,207,63,.7);background:rgba(255,207,63,.08);}' +
      '.gzp-small{color:#9aa3bd;font-size:12.5px;letter-spacing:.5px;margin-top:4px;}' +
      '.gzp-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0 6px;}' +
      '.gzp-grid div{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:8px 6px;}' +
      '.gzp-grid small{display:block;color:#9aa3bd;font-size:11px;letter-spacing:1px;}' +
      '.gzp-grid b{font-family:Orbitron,sans-serif;font-size:15px;color:#fff;}' +
      '.gzp-note{color:#c4cce0;font-size:13.5px;line-height:1.35;margin:10px 0 4px;padding:9px 10px;border-radius:12px;background:rgba(0,240,255,.07);border:1px dashed rgba(0,240,255,.35);}' +
      '.gzp-note b{color:#ffcf3f;}' +
      '.gzp-chip{display:inline-flex;align-items:center;gap:8px;max-width:100%;padding:8px 14px;border-radius:30px;cursor:pointer;' +
        'background:rgba(14,12,26,.85);border:1.5px solid rgba(0,240,255,.4);color:#eef4f8;font-family:Orbitron,sans-serif;font-weight:700;font-size:13px;letter-spacing:1px;}' +
      '.gzp-chip .t{color:#ffcf3f;}' +
      '.gzp-chip small{font-family:Rajdhani,sans-serif;font-size:12px;color:#9aa3bd;letter-spacing:.5px;}';
    var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
  }

  function overlay(html) {
    addStyle();
    var back = document.createElement('div');
    back.className = 'gzp-back';
    back.innerHTML = '<div class="gzp-box" role="dialog" aria-modal="true">' + html + '</div>';
    // keep taps inside the card away from the game underneath
    ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown'].forEach(function (ev) {
      back.addEventListener(ev, function (e) { e.stopPropagation(); }, false);
    });
    document.body.appendChild(back);
    return back;
  }

  /* ---------- ask for the name (first time, or to fix a typo) ---------- */
  var asking = null;
  function askName(editing) {
    if (asking) return asking;
    asking = new Promise(function (resolve) {
      var cur = get();
      var start = cur ? cur.name : cleanName(oldName('jx_name') || oldName('tp_name'));
      var back = overlay(
        '<div class="gzp-h">' + (editing ? 'CHANGE NAME' : 'WELCOME, PLAYER!') + '</div>' +
        '<p class="gzp-p">' + (editing
          ? 'Your player tag <b style="color:#ffcf3f">#' + esc(cur.tag) + '</b> stays the same.'
          : 'Type your name <b>once</b>. It will be used in every game and on every scoreboard.') + '</p>' +
        '<input class="gzp-in" maxlength="12" placeholder="YOUR NAME" autocomplete="off" value="' + esc(start) + '">' +
        '<div class="gzp-err"></div>' +
        '<button class="gzp-btn" type="button">' + (editing ? 'SAVE' : "LET'S PLAY") + '</button>' +
        (editing ? '<button class="gzp-btn alt" type="button" data-x>CANCEL</button>' : ''));
      var input = back.querySelector('input'), err = back.querySelector('.gzp-err');
      function done(p) { back.parentNode && back.parentNode.removeChild(back); asking = null; resolve(p); }
      function submit() {
        var n = cleanName(input.value);
        if (!validName(n)) { err.textContent = 'Use 2–12 letters or numbers.'; input.focus(); return; }
        done(save(n));
      }
      back.querySelector('.gzp-btn').addEventListener('click', submit);
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
      var x = back.querySelector('[data-x]');
      if (x) x.addEventListener('click', function () { done(cur); });
      setTimeout(function () { try { input.focus(); } catch (e) {} }, 60);
    });
    return asking;
  }
  function require() { var p = get(); return p ? Promise.resolve(p) : askName(false); }

  /* ---------- profile card ---------- */
  function openCard() {
    var p = get();
    if (!p) { askName(false); return; }
    var dev = lsGet('gz_device_id');
    var jx = Number(lsGet('jx_best')) || 0, tp = Number(lsGet('tp_best')) || 0;
    var since = new Date(p.since || Date.now());
    var back = overlay(
      '<div class="gzp-av">' + esc(p.name.charAt(0)) + '</div>' +
      '<div class="gzp-name">' + esc(p.name) + '</div>' +
      '<div class="gzp-tag">#' + esc(p.tag) + '</div>' +
      '<div class="gzp-small">PLAYER TAG' + (/^\d{4}$/.test(dev || '') ? ' · PLAYER ID ' + esc(dev) : '') +
        ' · SINCE ' + since.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase() + '</div>' +
      '<div class="gzp-grid"><div><small>JAIS EXPRESS BEST</small><b>' + fmt(jx) + '</b></div>' +
        '<div><small>PANDA BEST</small><b>' + fmt(tp) + '</b></div></div>' +
      '<div class="gzp-note">Won a prize? Show this card to the organizer. The <b>#' + esc(p.tag) +
        '</b> next to your name on the scoreboard proves it was you.</div>' +
      '<button class="gzp-btn" type="button" data-x>CLOSE</button>' +
      '<button class="gzp-btn alt" type="button" data-edit>CHANGE NAME</button>');
    function close() { back.parentNode && back.parentNode.removeChild(back); }
    back.querySelector('[data-x]').addEventListener('click', close);
    back.querySelector('[data-edit]').addEventListener('click', function () { close(); askName(true); });
    back.addEventListener('click', function (e) { if (e.target === back) close(); });
  }

  /* ---------- small "playing as" chip for game start screens ---------- */
  function chipHTML(p) {
    p = p || get();
    return p ? '<small>PLAYING AS</small> ' + esc(p.name) + ' <span class="t">#' + esc(p.tag) + '</span>'
             : '<small>TAP TO</small> SET YOUR NAME';
  }
  function mountChip(el) {
    if (!el) return;
    addStyle();
    el.classList.add('gzp-chip');
    el.innerHTML = chipHTML();
    el.addEventListener('click', function (e) { e.stopPropagation(); get() ? openCard() : askName(false); });
    onChange(function (p) { el.innerHTML = chipHTML(p); });
  }

  window.GZProfile = {
    get: get, require: require, askName: askName, openCard: openCard, label: label,
    mountChip: mountChip, onChange: onChange, validTag: validTag, esc: esc
  };
})();
