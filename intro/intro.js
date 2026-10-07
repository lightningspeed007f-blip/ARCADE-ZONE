/* =========================================================
   GAME ZONE — CINEMATIC INTRO (isolated module)
   ---------------------------------------------------------
   A ~6 s intro: a rugged carnival trickster walks in, snaps his
   fingers, the hub's REAL five game cards appear around him, he
   flicks them at the camera and they land in their real places
   on the card cylinder. No fake cards: this module only moves the
   existing .card elements and hands them back to index.html.

   index.html calls:
     ArcadeIntro.init(hooks)   once, after the cards exist
     ArcadeIntro.autoPlay()    from the "tap to enter" step

   Testing helpers (browser console):
     ArcadeIntro.play()        play it now
     ArcadeIntro.reset()       show the "tap to enter" splash (and intro) again on next load
   or open  index.html?intro=reset   (same, without the console)
   Force a performance level:  index.html?introperf=low | mid | high
   ========================================================= */
(function () {
  "use strict";

  var CONFIG = {
    /* true  = play on every visit (every time "TAP TO ENTER" is tapped)
       false = play only the first time on each device (remembered in localStorage) */
    PLAY_EVERY_VISIT: true,
    STORAGE_KEY: "gz_intro_seen_v1",
    TITLE: "CHOOSE YOUR GAME",
    /* Future artwork: a transparent PNG/WebP of the character, standing,
       feet at the bottom centre of the image. Leave "" to use the built-in
       drawn character. Example: "intro/assets/character.webp" */
    CHARACTER_IMAGE: "",
    /* Where the snapping hand is inside that image (0..1 of width / height) */
    CHARACTER_HAND: { x: 0.8, y: 0.1 }
  };

  /* Moments on the timeline (ms) */
  var T_WALK = 800, T_RAISE = 1850, T_SNAP = 2450, T_CARDS = 2600,
      T_WINDUP = 3450, T_FLICK = 3680, T_LAND = 4550, T_UI = 5000, T_END = 6000;

  var TIERS = {
    low:  { name: "low",  dpr: 1,   burst: 14, cardBurst: 0, dust: 0,  bulbs: 7,  glow: false, blur: false, detail: false, flash: 0.55 },
    mid:  { name: "mid",  dpr: 1.5, burst: 30, cardBurst: 4, dust: 14, bulbs: 12, glow: true,  blur: false, detail: true,  flash: 0.8 },
    high: { name: "high", dpr: 2,   burst: 54, cardBurst: 7, dust: 26, bulbs: 16, glow: true,  blur: true,  detail: true,  flash: 0.9 }
  };

  /* ---------- safe storage ---------- */
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch (e) {} }
  function ssDel(k) { try { window.sessionStorage.removeItem(k); } catch (e) {} }

  /* ---------- URL test switches (run before index.html reads the splash state) ---------- */
  var query = location.search || "";
  var forcedTier = (/[?&]introperf=(low|mid|high)\b/.exec(query) || [])[1] || null;
  if (/[?&]intro=reset\b/.test(query)) {
    lsDel(CONFIG.STORAGE_KEY);
    ssDel("gz_entered");
    try {
      var clean = query.replace(/([?&])intro=reset\b&?/, "$1").replace(/[?&]$/, "");
      history.replaceState(null, "", location.pathname + clean + location.hash);
    } catch (e) {}
  }

  function reducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
    catch (e) { return false; }
  }

  function detectTier() {
    if (forcedTier) return forcedTier;
    var nav = navigator, ua = nav.userAgent || "";
    var cores = nav.hardwareConcurrency || 4, mem = nav.deviceMemory || 4;
    if (nav.connection && nav.connection.saveData) return "low";
    if (/iPhone|iPad|iPod/i.test(ua)) return "mid";
    if (cores <= 2 || mem <= 2) return "low";
    if (/Android|Mobile/i.test(ua)) return (cores <= 4 || mem < 4) ? "low" : "mid";
    return cores >= 6 ? "high" : "mid";
  }

  /* ---------- math ---------- */
  var DEG = Math.PI / 180;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function prog(T, start, dur) { return clamp((T - start) / dur, 0, 1); }
  function eOutQ(t) { return 1 - (1 - t) * (1 - t); }
  function eOutC(t) { return 1 - Math.pow(1 - t, 3); }
  function eInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function eOutBack(t) { var c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function smooth(a, b, t) { t = clamp((t - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function mixRgb(a, b, t) {
    return Math.round(lerp(a[0], b[0], t)) + "," + Math.round(lerp(a[1], b[1], t)) + "," + Math.round(lerp(a[2], b[2], t));
  }

  /* =========================================================
     SOUND — tiny Web Audio effects, no audio files
     ========================================================= */
  var hooks = null;
  var Sfx = (function () {
    var ctx = null, master = null, noiseBuf = null, drone = null;
    function on() { return ctx && master && !(hooks && hooks.isMuted && hooks.isMuted()); }
    function unlock() {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (!ctx) ctx = new AC();
        if (ctx.state === "suspended" && ctx.resume) ctx.resume();
        if (!noiseBuf) {
          var len = Math.floor(ctx.sampleRate), d;
          noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
          d = noiseBuf.getChannelData(0);
          for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        }
        master = ctx.createGain();
        master.gain.value = 0.85;
        master.connect(ctx.destination);
      } catch (e) { master = null; }
    }
    function stop() {
      if (!master) return;
      var g = master;
      master = null; drone = null;
      try {
        g.gain.cancelScheduledValues(ctx.currentTime);
        g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.06);
        setTimeout(function () { try { g.disconnect(); } catch (e) {} }, 250);
      } catch (e) {}
    }
    function env(g, t, peak, a, d) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    }
    function tone(type, f0, f1, peak, a, d, delay) {
      var t = ctx.currentTime + (delay || 0);
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + a + d);
      env(g, t, peak, a, d);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + a + d + 0.05);
    }
    function hiss(type, f0, f1, q, peak, a, d, delay) {
      var t = ctx.currentTime + (delay || 0);
      var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noiseBuf;
      f.type = type; f.Q.value = q;
      f.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + a + d);
      env(g, t, peak, a, d);
      s.connect(f); f.connect(g); g.connect(master);
      s.start(t, Math.random() * 0.15); s.stop(t + a + d + 0.05);
    }
    function safe(fn) { return function (x) { if (!on()) return; try { fn(x); } catch (e) {} }; }
    return {
      unlock: unlock,
      stop: stop,
      droneOn: safe(function () {
        var t = ctx.currentTime, g = ctx.createGain(), o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
        o1.frequency.value = 55; o2.frequency.value = 82.4; o2.type = "triangle";
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.05, t + 1.4);
        o1.connect(g); o2.connect(g); g.connect(master);
        o1.start(t); o2.start(t);
        drone = { g: g, o: [o1, o2] };
      }),
      droneOff: function () {
        if (!drone || !ctx) return;
        try {
          var t = ctx.currentTime;
          drone.g.gain.cancelScheduledValues(t);
          drone.g.gain.setValueAtTime(drone.g.gain.value || 0.0001, t);
          drone.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
          drone.o[0].stop(t + 0.4); drone.o[1].stop(t + 0.4);
        } catch (e) {}
        drone = null;
      },
      step: safe(function () {
        hiss("lowpass", 520, 180, 0.7, 0.2, 0.004, 0.11);
        tone("sine", 90, 48, 0.16, 0.004, 0.12);
      }),
      snap: safe(function () {
        hiss("bandpass", 3300, 2100, 1.4, 0.95, 0.001, 0.07);      // the crack
        tone("triangle", 2500, 700, 0.3, 0.001, 0.035);            // the click
        tone("sine", 200, 90, 0.22, 0.002, 0.08);                  // finger thump
        tone("sine", 78, 38, 0.3, 0.012, 0.65, 0.03);              // lights-on boom
        tone("triangle", 1320, 1980, 0.045, 0.01, 0.4, 0.06);      // bulbs buzzing on
      }),
      shimmer: safe(function (k) {
        var f = 760 + k * 150;
        tone("sine", f, f * 1.5, 0.06, 0.008, 0.2);
        tone("triangle", f * 2, f * 2.4, 0.02, 0.005, 0.14);
      }),
      whoosh: safe(function (v) {
        hiss("bandpass", 320, 2600, 0.9, 0.36 * v, 0.28, 0.36);
      }),
      impact: safe(function (v) {
        tone("sine", 165, 52, 0.5 * v, 0.003, 0.18);
        hiss("lowpass", 1300, 300, 0.8, 0.28 * v, 0.002, 0.07);
      })
    };
  })();

  /* =========================================================
     STATE
     ========================================================= */
  var tier = TIERS[detectTier()] || TIERS.mid;
  var running = false, raf = 0, T = 0, lastNow = 0, handedOff = false;
  var back = null, cv = null, c2 = null, front = null, flashEl = null, titleEl = null, skipEl = null, replayBtn = null;
  var dpr = 1, W = 0, H = 0, scx = 0, scy = 0, cardW = 180, cardH = 266;
  var charH = 300, u = 3, footY = 0, horizonY = 0, chestY = 0, focal = { x: 0, y: 0 };
  var fanScale = 0.4, fanRx = 100, fanRy = 100, spreadX = 100, peakMax = 1.3;
  var bg = null, vig = null, sprites = null, bulbs = [], dust = [], parts = [];
  var cardSlot = [], cardOrder = [], landed = [], hand = null, charImg = null;
  var events = [], perfLog = [], classTimers = [];

  /* ---------- glow sprites (drawn once, then just stamped) ---------- */
  function sprite(rgb) {
    var s = document.createElement("canvas");
    s.width = s.height = 64;
    var g = s.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(" + rgb + ",1)");
    gr.addColorStop(0.22, "rgba(" + rgb + ",0.55)");
    gr.addColorStop(1, "rgba(" + rgb + ",0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return s;
  }
  function makeSprites() {
    if (sprites) return;
    sprites = { warm: sprite("255,190,90"), pink: sprite("255,45,138"), cyan: sprite("0,240,255"),
                white: sprite("255,248,235"), amber: sprite("255,160,50") };
  }

  /* seeded random so the scenery doesn't reshuffle on resize */
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

  /* =========================================================
     GEOMETRY
     ========================================================= */
  function measure() {
    W = window.innerWidth; H = window.innerHeight;
    var sr = hooks.stage.getBoundingClientRect();
    scx = sr.left + sr.width / 2; scy = sr.top + sr.height / 2;
    var c0 = hooks.cards[0];
    cardW = (c0 && c0.offsetWidth) || 180; cardH = (c0 && c0.offsetHeight) || 266;

    charH = Math.min(H * 0.58, W * 1.25, 560);
    u = charH / 100;
    footY = H * 0.9;
    horizonY = footY - charH * 0.2;
    chestY = footY - charH * 0.66;
    focal = { x: W / 2, y: footY - charH * 0.62 };

    fanScale = (charH * 0.36) / cardH;
    fanRx = Math.max(40, Math.min(charH * 0.5, W / 2 - fanScale * cardW * 0.62 - 10));
    fanRy = charH * 0.42;
    spreadX = Math.min(W * 0.23, 240);
    peakMax = Math.min(1.55, (H * 0.62) / cardH, (W * 0.6) / cardW);
    peakMax = Math.max(peakMax, fanScale * 1.6);

    sizeCanvas();
    buildBg();
    buildVignette();
    buildBulbs();
    buildDust();
    hand = null;
  }

  function sizeCanvas() {
    if (!cv) return;
    dpr = Math.min(tier.dpr, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }

  /* Static scenery: carnival tent, dark arcade cabinets, neon floor */
  function buildBg() {
    bg = bg || document.createElement("canvas");
    var bw = Math.ceil(W * 1.4), bh = Math.ceil(H), d = Math.min(dpr, 1.5), rnd = rng(7);
    bg.width = Math.round(bw * d); bg.height = Math.round(bh * d);
    var g = bg.getContext("2d"), gr, i, x;
    g.setTransform(d, 0, 0, d, 0, 0);
    g.clearRect(0, 0, bw, bh);

    gr = g.createLinearGradient(0, 0, 0, horizonY);
    gr.addColorStop(0, "#06050c"); gr.addColorStop(1, "#140a22");
    g.fillStyle = gr; g.fillRect(0, 0, bw, horizonY);

    /* tent canopy with scalloped edge */
    var th = Math.max(22, H * 0.06), sw = Math.max(28, Math.min(W, H) * 0.09);
    for (x = 0, i = 0; x < bw; x += sw, i++) {
      g.fillStyle = i % 2 ? "#2c0b19" : "#140920";
      g.beginPath();
      g.moveTo(x, 0); g.lineTo(x + sw, 0); g.lineTo(x + sw, th);
      g.quadraticCurveTo(x + sw / 2, th + sw * 0.42, x, th);
      g.closePath(); g.fill();
    }

    /* arcade cabinets along the back wall */
    var cols = ["0,240,255", "255,45,138", "255,200,60", "170,90,255"];
    var count = Math.max(6, Math.round(bw / Math.max(60, H * 0.12)));
    for (i = 0; i < count; i++) {
      var cw = Math.max(26, H * 0.075) * (0.85 + rnd() * 0.35);
      var ch = Math.max(70, H * 0.19) * (0.85 + rnd() * 0.3);
      x = (i + 0.2 + rnd() * 0.6) * (bw / count) - cw / 2;
      var y = horizonY - ch, col = cols[i % cols.length];
      g.fillStyle = "#0c0a16"; g.fillRect(x, y, cw, ch);
      g.fillStyle = "rgba(" + col + ",0.5)"; g.fillRect(x + 2, y + 2, cw - 4, ch * 0.1);
      g.fillStyle = "rgba(" + col + ",0.16)"; g.fillRect(x + cw * 0.14, y + ch * 0.2, cw * 0.72, ch * 0.3);
      g.fillStyle = "rgba(" + col + ",0.1)"; g.fillRect(x - 3, y - 3, cw + 6, 3);
    }

    /* floor */
    gr = g.createLinearGradient(0, horizonY, 0, bh);
    gr.addColorStop(0, "#170b28"); gr.addColorStop(1, "#05060a");
    g.fillStyle = gr; g.fillRect(0, horizonY, bw, bh - horizonY);
    g.strokeStyle = "rgba(0,240,255,0.09)"; g.lineWidth = 1;
    g.beginPath();
    for (i = -12; i <= 12; i++) {
      g.moveTo(bw / 2 + i * bw * 0.045, horizonY);
      g.lineTo(bw / 2 + i * bw * 0.17, bh);
    }
    for (i = 1; i <= 7; i++) {
      var fy = horizonY + (bh - horizonY) * Math.pow(i / 7, 1.8);
      g.moveTo(0, fy); g.lineTo(bw, fy);
    }
    g.stroke();
    g.strokeStyle = "rgba(255,45,138,0.35)"; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, horizonY); g.lineTo(bw, horizonY); g.stroke();
  }

  function buildVignette() {
    vig = vig || document.createElement("canvas");
    var s = 0.25;
    vig.width = Math.max(2, Math.round(W * s)); vig.height = Math.max(2, Math.round(H * s));
    var g = vig.getContext("2d");
    g.setTransform(s, 0, 0, s, 0, 0);
    var gr = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.22, W / 2, H * 0.55, Math.max(W, H) * 0.78);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.85)");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }

  /* Two strings of carnival bulbs — they switch on with the snap */
  function buildBulbs() {
    bulbs = [];
    var strings = [
      { x0: -0.05 * W, y0: H * 0.12, x1: 1.05 * W, y1: H * 0.1, sag: H * 0.07 },
      { x0: -0.05 * W, y0: H * 0.2, x1: 1.05 * W, y1: H * 0.23, sag: H * 0.06 }
    ];
    var kinds = ["warm", "pink", "warm", "cyan"];
    strings.forEach(function (s, si) {
      var n = tier.bulbs;
      s.pts = [];
      for (var j = 0; j < n; j++) {
        var t = (j + 0.5) / n;
        var b = { x: lerp(s.x0, s.x1, t), y: lerp(s.y0, s.y1, t) + s.sag * 4 * t * (1 - t),
                  kind: kinds[(j + si) % kinds.length], ph: j * 1.7 + si };
        s.pts.push(b);
        bulbs.push(b);
      }
    });
    bulbs.strings = strings;
  }

  function buildDust() {
    dust = [];
    var r = rng(3);
    for (var i = 0; i < tier.dust; i++) {
      dust.push({ x: r() * W, y: r() * H, v: 0.08 + r() * 0.2, s: 0.8 + r() * 1.6, ph: r() * 6.28 });
    }
  }

  function setTier(name) {
    tier = TIERS[name] || tier;
    if (running) { measure(); }
  }

  /* =========================================================
     THE CHARACTER — an original rugged carnival trickster
     (messy hair, worn long coat, gloves, playing card in the pocket)
     ========================================================= */
  function poseAt(T) {
    var P = { x: 0, sc: 1, walk: 0, ph: 0, aR1: 8, aR2: 14, aL1: 6, aL2: 12, lean: 0, tilt: 0,
              alpha: 1, eyes: 0, eyeAlpha: 1, flutter: 0, finger: 0 };
    var wp = prog(T, T_WALK, 1000);
    P.x = lerp(-W * 0.36, 0, eOutC(wp));
    P.sc = lerp(0.84, 1, eOutC(wp));
    P.walk = 1 - smooth(0.72, 1, wp);
    P.ph = wp * Math.PI * 4.2;
    P.alpha = eOutQ(prog(T, T_WALK, 500));

    var sw = Math.sin(P.ph) * 12 * P.walk;
    P.aR1 = 8 - sw; P.aR2 = P.aR1 + 8; P.aL1 = 6 + sw; P.aL2 = P.aL1 + 8;

    var r = eInOut(prog(T, T_RAISE, 520));                       // raise the hand
    P.aR1 = lerp(P.aR1, 82, r); P.aR2 = lerp(P.aR2, 166, r); P.tilt = 0.09 * r;
    P.aR2 -= 12 * prog(T, T_SNAP - 70, 70);                      // pinch...
    P.aR2 += 15 * eOutC(prog(T, T_SNAP, 120));                   // ...SNAP
    P.finger = T >= T_SNAP ? 1 - prog(T, T_SNAP + 250, 200) : 0;

    var pr = eInOut(prog(T, T_CARDS, 850));                      // present the cards
    P.aR1 = lerp(P.aR1, 70, pr); P.aR2 = lerp(P.aR2, 150, pr);
    P.aL1 = lerp(P.aL1, 40, pr); P.aL2 = lerp(P.aL2, 72, pr);

    var wu = eInOut(prog(T, T_WINDUP, 230));                     // wind up across the chest
    P.aR1 = lerp(P.aR1, -35, wu); P.aR2 = lerp(P.aR2, -95, wu);
    P.aL1 = lerp(P.aL1, 14, wu); P.aL2 = lerp(P.aL2, 22, wu);
    P.lean = -0.05 * wu; P.tilt = lerp(P.tilt, -0.05, wu);

    var fk = eOutC(prog(T, T_FLICK, 150));                       // FLICK
    P.aR1 = lerp(P.aR1, 80, fk); P.aR2 = lerp(P.aR2, 94, fk);
    P.lean = lerp(P.lean, 0.06, fk); P.tilt = lerp(P.tilt, 0.06, fk);
    P.sc *= 1 + 0.03 * fk * (1 - eInOut(prog(T, 3900, 600)));

    var rl = eInOut(prog(T, 4300, 800));                         // relax
    P.aR1 = lerp(P.aR1, 22, rl); P.aR2 = lerp(P.aR2, 28, rl);
    P.lean = lerp(P.lean, 0, rl); P.tilt = lerp(P.tilt, 0.04, rl);

    P.alpha *= 1 - eInOut(prog(T, 5050, 550));                   // fade into darkness
    P.sc *= 1 - 0.05 * eInOut(prog(T, 5000, 700));
    P.eyes = T < T_SNAP ? 0.45 * prog(T, 1200, 600) : 1;
    P.eyeAlpha = (1 - prog(T, 5350, 350)) * eOutQ(prog(T, T_WALK, 500));   // the eyes go last
    if (T >= T_FLICK && tier.detail) {
      var ft = T - T_FLICK;
      P.flutter = 3.5 * Math.exp(-ft / 350) * Math.sin(ft * 0.028);
    }
    return P;
  }

  function seg(aDeg, side, len) {
    var a = aDeg * DEG;
    return { x: side * Math.sin(a) * len, y: Math.cos(a) * len };
  }
  function add(p, q) { return { x: p.x + q.x, y: p.y + q.y }; }

  /* Joints in character units (100 = full height, origin between the feet) */
  function skeleton(P) {
    var bob = P.walk * Math.abs(Math.sin(P.ph)) * 1.4;
    var sway = P.walk * Math.sin(P.ph) * 1.1;
    var lx = P.lean * 40, S = {};
    S.hip = { x: sway * 0.5 + lx * 0.3, y: -46 - bob };
    S.neck = { x: sway + lx, y: -81 - bob };
    S.head = { x: S.neck.x + P.tilt * 4, y: S.neck.y - 7.5 };
    S.shL = { x: S.neck.x - 13, y: S.neck.y + 4 };
    S.shR = { x: S.neck.x + 13, y: S.neck.y + 4 };
    S.elR = add(S.shR, seg(P.aR1, 1, 15)); S.haR = add(S.elR, seg(P.aR2, 1, 14));
    S.elL = add(S.shL, seg(P.aL1, -1, 15)); S.haL = add(S.elL, seg(P.aL2, -1, 14));
    var lift = P.walk * 3.2;
    S.ftL = { x: -5.5 + sway * 0.4, y: -Math.max(0, Math.sin(P.ph)) * lift };
    S.ftR = { x: 5.5 + sway * 0.4, y: -Math.max(0, -Math.sin(P.ph)) * lift };
    return S;
  }

  function camAt(T) {
    var c = 1 + 0.08 * eInOut(prog(T, 1800, 600)) + 0.04 * eOutC(prog(T, T_FLICK, 250)) - 0.05 * eInOut(prog(T, 4400, 1200));
    if (T >= T_SNAP) c += 0.02 * Math.exp(-(T - T_SNAP) / 90);
    return c;
  }

  /* character point (units) → screen pixels */
  function toScreen(P, p, T) {
    var k = u * P.sc, wx = W / 2 + P.x + p.x * k, wy = footY + p.y * k, cam = camAt(T);
    return { x: focal.x + (wx - focal.x) * cam, y: focal.y + (wy - focal.y) * cam };
  }

  function handScreen(T) {
    var P = poseAt(T);
    if (charImg) {
      var iw = 100 * charImg.width / charImg.height;
      return toScreen(P, { x: (CONFIG.CHARACTER_HAND.x - 0.5) * iw, y: -100 + 100 * CONFIG.CHARACTER_HAND.y }, T);
    }
    return toScreen(P, skeleton(P).haR, T);
  }

  function oval(c, x, y, rx, ry) {
    c.beginPath(); c.save(); c.translate(x, y); c.scale(rx, ry); c.arc(0, 0, 1, 0, 6.2832); c.restore();
  }

  var HAIR = [[-5.8, 1], [-7.6, -2.6], [-5.6, -3.6], [-7.4, -7.6], [-3.8, -7], [-4.6, -11], [-1.2, -8.4], [0.6, -12.2],
              [2.4, -8.6], [5.6, -10.8], [4.8, -7], [8.2, -6], [5.8, -3], [7.4, 0.6], [5.6, 1.2],
              [4, -2.6], [2.2, -0.6], [0.6, -3.2], [-1.4, -0.4], [-3, -3.2], [-4.8, -0.2]];

  function drawCharacter(c, T, P) {
    var k = u * P.sc, rimRgb, rimA, S, n;
    var snapK = prog(T, T_SNAP, 220);
    rimRgb = mixRgb([0, 240, 255], [255, 70, 150], snapK);
    rimA = (0.25 + 0.45 * eOutQ(prog(T, 900, 900))) * (T >= T_SNAP ? 1.2 : 1);
    rimA = Math.min(0.8, rimA);
    /* back-light: strong on the right edges, a faint magenta kick on the left, dark in the middle */
    function rimGrad(span) {
      var g = c.createLinearGradient(-span, 0, span, 0);
      g.addColorStop(0, "rgba(255,45,138," + (rimA * 0.45).toFixed(3) + ")");
      g.addColorStop(0.42, "rgba(" + rimRgb + ",0)");
      g.addColorStop(0.58, "rgba(" + rimRgb + ",0)");
      g.addColorStop(1, "rgba(" + rimRgb + "," + rimA.toFixed(3) + ")");
      return g;
    }

    c.save();
    c.translate(W / 2 + P.x, footY);
    c.scale(k, k);
    c.globalAlpha = P.alpha;

    c.fillStyle = "rgba(0,0,0,0.55)";                            // floor shadow
    oval(c, 0, 0.6, 20, 3); c.fill();

    if (charImg) {                                               // future artwork slot
      var iw = 100 * charImg.width / charImg.height;
      c.translate(0, 0); c.rotate(P.lean * 0.6);
      c.drawImage(charImg, -iw / 2, -100 - P.walk * Math.abs(Math.sin(P.ph)) * 1.4, iw, 100);
      c.restore();
      return;
    }

    S = skeleton(P); n = S.neck;
    var rim = rimGrad(24);
    c.lineCap = "round"; c.lineJoin = "round";

    var hx = S.hip.x, sinp = Math.sin(P.ph) * P.walk * (tier.detail ? 2 : 1);
    var fl = 2 + sinp + P.flutter, fr = 2 - sinp + P.flutter * 0.7;

    c.fillStyle = "#24070f";                                     // coat lining, seen through the split
    c.beginPath(); c.moveTo(hx - 1.2, -31); c.lineTo(hx - 5, -10); c.lineTo(hx + 5, -10); c.lineTo(hx + 1.2, -31); c.fill();

    /* legs + boots */
    [[S.hip.x - 3.6, S.ftL], [S.hip.x + 3.6, S.ftR]].forEach(function (L) {
      c.beginPath(); c.moveTo(L[0], -28); c.lineTo(L[1].x, L[1].y - 1.8);
      c.strokeStyle = rim; c.lineWidth = 7.2; c.stroke();
      c.strokeStyle = "#0b0a10"; c.lineWidth = 6.2; c.stroke();
      c.fillStyle = "#060509"; oval(c, L[1].x + 0.6, L[1].y - 1.1, 4.4, 2); c.fill();
    });

    /* long worn coat with a ragged hem */
    c.beginPath();
    c.moveTo(n.x - 5, n.y + 1);
    c.lineTo(S.shL.x - 2, S.shL.y + 0.5);
    c.quadraticCurveTo(S.shL.x - 4.5, -50, hx - 21 - fl, -10 + P.flutter * 0.3);
    c.lineTo(hx - 16, -12); c.lineTo(hx - 12, -9.4); c.lineTo(hx - 8, -12.4); c.lineTo(hx - 4.6, -10.4);
    c.lineTo(hx - 1.2, -31); c.lineTo(hx + 1.2, -31);
    c.lineTo(hx + 4.6, -10.4); c.lineTo(hx + 8.5, -12.6); c.lineTo(hx + 12.5, -9.4); c.lineTo(hx + 16.5, -12);
    c.lineTo(hx + 21 + fr, -10 - P.flutter * 0.3);
    c.quadraticCurveTo(S.shR.x + 4.5, -50, S.shR.x + 2, S.shR.y + 0.5);
    c.lineTo(n.x + 5, n.y + 1);
    c.closePath();
    var g = c.createLinearGradient(0, n.y, 0, -10);
    g.addColorStop(0, "#221d2c"); g.addColorStop(0.5, "#121017"); g.addColorStop(1, "#08070c");
    c.fillStyle = g; c.fill();
    c.strokeStyle = rim; c.lineWidth = 0.65; c.stroke();
    if (tier.detail) {                                           // worn folds
      c.strokeStyle = "rgba(0,0,0,0.55)"; c.lineWidth = 0.6;
      c.beginPath();
      c.moveTo(hx - 10, -42); c.lineTo(hx - 15, -13);
      c.moveTo(hx - 5, -52); c.lineTo(hx - 7, -16);
      c.moveTo(hx + 9, -44); c.lineTo(hx + 14, -13);
      c.stroke();
    }

    /* burgundy waistcoat with diamond pattern */
    c.fillStyle = "#3b0f1f";
    c.beginPath(); c.moveTo(n.x - 4.5, n.y + 1.5); c.lineTo(n.x, n.y + 21); c.lineTo(n.x + 4.5, n.y + 1.5); c.closePath(); c.fill();
    if (tier.detail) {
      c.fillStyle = "#6e1a31";
      for (var dI = 0; dI < 3; dI++) {
        var dy = n.y + 6 + dI * 4;
        c.beginPath(); c.moveTo(n.x, dy - 1.3); c.lineTo(n.x + 0.9, dy); c.lineTo(n.x, dy + 1.3); c.lineTo(n.x - 0.9, dy); c.fill();
      }
    }
    c.strokeStyle = "#2b2735"; c.lineWidth = 0.9;               // lapels
    c.beginPath();
    c.moveTo(n.x - 5, n.y + 1); c.lineTo(n.x - 1.2, n.y + 22);
    c.moveTo(n.x + 5, n.y + 1); c.lineTo(n.x + 1.2, n.y + 22);
    c.stroke();

    /* playing card tucked in the breast pocket */
    c.save();
    c.translate(n.x - 8.4, n.y + 9.6); c.rotate(-0.26);
    c.fillStyle = "#e9e2cf"; c.fillRect(-1.6, -2.4, 3.2, 4.4);
    c.fillStyle = "#c8102e";
    c.beginPath(); c.moveTo(0, -1.3); c.lineTo(0.8, -0.3); c.lineTo(0, 0.7); c.lineTo(-0.8, -0.3); c.fill();
    c.restore();
    c.fillStyle = "#16131d"; c.fillRect(n.x - 11, n.y + 11.2, 5.6, 2);

    /* popped collar */
    c.fillStyle = "#221d2c";
    [[-1], [1]].forEach(function (s) {
      s = s[0];
      c.beginPath();
      c.moveTo(n.x + s * 5, n.y + 1.5); c.lineTo(n.x + s * 9.6, n.y - 7.5);
      c.lineTo(n.x + s * 6.4, n.y - 8.6); c.lineTo(n.x + s * 2.4, n.y - 1);
      c.closePath(); c.fill();
      c.strokeStyle = rim; c.lineWidth = 0.55; c.stroke();
    });

    /* neck + head */
    c.fillStyle = "#141119"; c.fillRect(n.x - 2, n.y - 3, 4, 4.5);
    c.save();
    c.translate(S.head.x, S.head.y); c.rotate(P.tilt);
    rim = rimGrad(9);
    c.fillStyle = "#1a1520"; oval(c, 0, 0, 5.2, 6.3); c.fill();
    c.strokeStyle = rim; c.lineWidth = 0.5; c.stroke();

    /* glowing narrow eyes + crooked grin (they outlast the body in the fade) */
    var ea = P.eyes * P.eyeAlpha;
    if (ea > 0.01) {
      c.globalAlpha = ea;
      if (tier.glow) {
        c.globalAlpha = ea * (T >= T_SNAP ? 0.75 : 0.45);
        c.drawImage(sprites.amber, -5, -3, 6, 5.4); c.drawImage(sprites.amber, -1, -3, 6, 5.4);
        c.globalAlpha = ea;
      }
      c.strokeStyle = "rgb(255,190,90)"; c.lineWidth = 0.6;
      c.beginPath(); c.moveTo(-3.1, -0.7); c.lineTo(-1.2, 0); c.moveTo(1.2, 0); c.lineTo(3.1, -0.7); c.stroke();
      c.strokeStyle = "rgba(230,218,195," + (0.2 + 0.3 * P.eyes).toFixed(2) + ")"; c.lineWidth = 0.4;
      c.beginPath(); c.moveTo(-2.4, 3); c.quadraticCurveTo(0.3, 4.4, 2.9, 2.2); c.lineTo(3.3, 1.6); c.stroke();
      c.globalAlpha = P.alpha;
    }

    /* messy hair */
    c.beginPath();
    for (var h = 0; h < HAIR.length; h++) {
      var wob = tier.detail ? Math.sin(T * 0.004 + h) * 0.3 * (0.4 + P.walk + Math.abs(P.flutter) * 0.3) : 0;
      var hxp = HAIR[h][0] + wob, hyp = HAIR[h][1] - 1.5 + (HAIR[h][1] < -5 ? wob : 0);
      if (h === 0) c.moveTo(hxp, hyp); else c.lineTo(hxp, hyp);
    }
    c.closePath();
    c.fillStyle = "#100d15"; c.fill();
    c.strokeStyle = rim; c.lineWidth = 0.5; c.stroke();
    c.restore();
    rim = rimGrad(24);

    /* arms in heavy coat sleeves, worn leather gloves */
    function arm(sh, el, ha, raised) {
      var wr = { x: lerp(el.x, ha.x, 0.82), y: lerp(el.y, ha.y, 0.82) };
      c.beginPath(); c.moveTo(sh.x, sh.y); c.lineTo(el.x, el.y); c.lineTo(wr.x, wr.y);
      c.strokeStyle = rim; c.lineWidth = 7.4; c.stroke();
      c.strokeStyle = "#17141e"; c.lineWidth = 6.4; c.stroke();
      c.fillStyle = "#3a2e25"; oval(c, ha.x, ha.y, 2.7, 2.7); c.fill();
      c.strokeStyle = rim; c.lineWidth = 0.5; c.stroke();
      c.fillStyle = "#7d6450"; oval(c, ha.x + 0.8, ha.y - 0.9, 0.9, 0.7); c.fill();
      if (raised && P.finger > 0.01) {                           // finger up after the snap
        c.globalAlpha = P.alpha * P.finger;
        c.strokeStyle = "#4a3b2f"; c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(ha.x, ha.y - 1); c.lineTo(ha.x + 0.6, ha.y - 4.4); c.stroke();
        c.globalAlpha = P.alpha;
      }
    }
    arm(S.shL, S.elL, S.haL, false);
    arm(S.shR, S.elR, S.haR, true);

    c.restore();
  }

  /* =========================================================
     SCENE
     ========================================================= */
  function drawScene(T, dt) {
    var c = c2, i, b;
    var P = poseAt(T), cam = camAt(T);
    var atm = T < T_WALK ? 0.3 * prog(T, 0, T_WALK) : lerp(0.3, 1, eOutQ(prog(T, T_WALK, 1000)));
    var spot = eOutQ(prog(T, 900, 900));
    var lit = T >= T_SNAP, snapAge = T - T_SNAP;
    var par = -P.x * 0.22;

    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalAlpha = 1;
    c.fillStyle = "#05060a"; c.fillRect(0, 0, W, H);

    c.translate(focal.x, focal.y); c.scale(cam, cam); c.translate(-focal.x, -focal.y);

    c.globalAlpha = atm * (lit ? 1 : 0.8);
    c.drawImage(bg, -W * 0.2 + par, 0, W * 1.4, H);

    /* spotlight cone + pool of light on the floor */
    var cx = W / 2 + P.x, spotRgb = lit ? mixRgb([190, 230, 255], [255, 200, 140], prog(T, T_SNAP, 300)) : "190,230,255";
    if (spot > 0) {
      c.globalAlpha = spot * (lit ? 1 : 0.8);
      var g = c.createLinearGradient(0, 0, 0, footY);
      g.addColorStop(0, "rgba(" + spotRgb + ",0.13)"); g.addColorStop(1, "rgba(" + spotRgb + ",0.02)");
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(W / 2 + par * 0.3 - W * 0.03, -10); c.lineTo(W / 2 + par * 0.3 + W * 0.03, -10);
      c.lineTo(cx + charH * 0.34, footY + charH * 0.04); c.lineTo(cx - charH * 0.34, footY + charH * 0.04);
      c.closePath(); c.fill();
      c.save();
      c.globalAlpha = 0.35 * spot;
      c.translate(cx, footY); c.scale(1, 0.14);
      c.drawImage(lit ? sprites.warm : sprites.white, -charH * 0.45, -charH * 0.45, charH * 0.9, charH * 0.9);
      c.restore();
    }

    /* carnival bulbs */
    var bpar = par * 0.5, boost = lit ? 1 + 0.9 * Math.exp(-snapAge / 180) : 1;
    c.globalAlpha = atm * 0.8;
    c.strokeStyle = "#1c1824"; c.lineWidth = 1;
    c.beginPath();
    bulbs.strings.forEach(function (s) {
      s.pts.forEach(function (p, j) { if (j === 0) c.moveTo(p.x + bpar, p.y); else c.lineTo(p.x + bpar, p.y); });
    });
    c.stroke();
    var hx = hand ? hand.x : W / 2;
    for (i = 0; i < bulbs.length; i++) {
      b = bulbs[i];
      var bx = b.x + bpar, onAt = T_SNAP + 20 + Math.abs(bx - hx) / W * 260;
      if (T >= onAt) {
        var r = (tier.glow ? 7 : 4) * boost * (1 + 0.12 * Math.sin(T * 0.012 + b.ph));
        c.globalAlpha = atm * Math.min(1, (T - onAt) / 60);
        if (tier.glow) c.drawImage(sprites[b.kind], bx - r * 1.6, b.y - r * 1.6, r * 3.2, r * 3.2);
        c.fillStyle = "#fff3d6"; c.fillRect(bx - 1.3, b.y - 1.3, 2.6, 2.6);
      } else {
        c.globalAlpha = atm * 0.7;
        c.fillStyle = "#4a3c2c"; c.fillRect(bx - 1.2, b.y - 1.2, 2.4, 2.4);
      }
    }

    /* floating dust in the light */
    if (dust.length) {
      c.fillStyle = "rgb(255,240,220)";
      for (i = 0; i < dust.length; i++) {
        var d = dust[i];
        d.y -= d.v * dt / 16; d.ph += dt * 0.002;
        if (d.y < -4) d.y = H + 4;
        c.globalAlpha = atm * (0.12 + 0.18 * spot) * (0.6 + 0.4 * Math.sin(d.ph));
        c.fillRect(d.x + Math.sin(d.ph) * 4 + par * 0.4, d.y, d.s, d.s);
      }
    }

    c.globalAlpha = 1;
    drawCharacter(c, T, P);

    /* the snap: magenta lighting hit + glow on the hand */
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (lit && snapAge < 450) {
      c.globalAlpha = 0.12 * (1 - snapAge / 450);
      c.fillStyle = "rgb(255,40,130)"; c.fillRect(0, 0, W, H);
    }
    if (lit && hand && snapAge < 900 && tier.glow) {
      var hr = charH * 0.18 * (1 + snapAge / 500);
      c.globalAlpha = 0.8 * (1 - snapAge / 900);
      c.drawImage(sprites.pink, hand.x - hr, hand.y - hr, hr * 2, hr * 2);
    }

    /* particles */
    for (i = parts.length - 1; i >= 0; i--) {
      var p = parts[i], f = dt / 16.67;
      p.life += dt;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      p.vx *= Math.pow(0.93, f); p.vy = p.vy * Math.pow(0.93, f) + 0.05 * f;
      p.x += p.vx * f; p.y += p.vy * f;
      var a = 1 - p.life / p.max;
      c.globalAlpha = a;
      if (tier.glow) c.drawImage(sprites[p.kind], p.x - p.s * 3, p.y - p.s * 3, p.s * 6, p.s * 6);
      else { c.fillStyle = p.col; c.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
    }

    c.globalAlpha = 1;
    c.drawImage(vig, 0, 0, W, H);

    var dark = eInOut(prog(T, T_UI, 500)) * 0.9;                 // everything sinks into darkness
    if (dark > 0) { c.globalAlpha = dark; c.fillStyle = "#05060a"; c.fillRect(0, 0, W, H); }
    c.globalAlpha = 1;
  }

  function burst(x, y, n, speed) {
    var kinds = ["white", "warm", "pink", "warm"], cols = ["#fff8eb", "#ffbe5a", "#ff2d8a", "#ffbe5a"];
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.2832, v = speed * (0.35 + Math.random() * 0.65);
      parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.15, life: 0,
                   max: 380 + Math.random() * 420, s: 1.2 + Math.random() * 2.2,
                   kind: kinds[i % 4], col: cols[i % 4] });
    }
  }

  /* =========================================================
     THE REAL CARDS
     ========================================================= */
  function prepCards() {
    var cards = hooks.cards, n = cards.length, idx = [], i;
    for (i = 0; i < n; i++) idx.push(i);
    var rests = idx.map(function (i) { return hooks.restPose(i); });
    /* fan slot = left-to-right order on the cylinder, so each card flies towards its own place */
    idx.slice().sort(function (a, b) { return rests[a].ry - rests[b].ry; })
       .forEach(function (ci, k) { cardSlot[ci] = k; });
    /* land the cards at the back first, the front card last (biggest impact) */
    idx.slice().sort(function (a, b) { return (rests[a].z - rests[b].z) || (Math.abs(rests[b].ry) - Math.abs(rests[a].ry)); })
       .forEach(function (ci, o) { cardOrder[ci] = o; });
    landed = [];
    cards.forEach(function (c) {
      c.style.visibility = "visible";
      c.style.opacity = "0";
      c.style.transform = "scale(0.01)";
    });
  }

  function setCard(c, x, y, s, rx, ry, rz, op, z, blur) {
    c.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) scale(" + s.toFixed(3) +
      ") perspective(900px) rotateX(" + rx.toFixed(1) + "deg) rotateY(" + ry.toFixed(1) + "deg) rotateZ(" + rz.toFixed(1) + "deg)";
    c.style.opacity = op.toFixed(3);
    c.style.zIndex = z;
    c.style.visibility = op < 0.02 ? "hidden" : "visible";
    if (tier.blur) c.style.filter = blur > 0.15 ? "blur(" + blur.toFixed(1) + "px)" : "";
  }

  function updateCards(T) {
    var cards = hooks.cards, n = cards.length, half = (n - 1) / 2 || 1;
    if (!hand) hand = handScreen(T_SNAP);
    for (var i = 0; i < n; i++) {
      var c = cards[i], k = cardSlot[i], o = cardOrder[i], rest = hooks.restPose(i);
      var norm = (k - half) / half, dir = norm < 0 ? -1 : 1, sp = Math.abs(norm);
      var th = norm * 64 * DEG;
      var fx = W / 2 + fanRx * Math.sin(th) - scx, fy = chestY - fanRy * Math.cos(th) - scy;
      var frz = norm * 32;
      var hx = hand.x - scx, hy = hand.y - scy;
      var px = norm * half * spreadX * 0.9, py = (H * 0.46 - scy) + sp * H * 0.05;
      var ps = peakMax * (1 - 0.2 * sp), prz = norm * -9, pry = -norm * 14;
      var tS = T_CARDS + k * 90, tT = T_FLICK + 20 + k * 30, tL = Math.max(T_LAND + o * 100, tT + 720);
      var p, e;

      if (T < tS) {
        setCard(c, hx, hy, 0.05, 0, 85, 0, 0, 100, 0);
      } else if (T < tS + 420) {                                 // summoned from the hand
        p = prog(T, tS, 420); e = eOutC(p);
        setCard(c, lerp(hx, fx, e), lerp(hy, fy, e) - Math.sin(p * Math.PI) * charH * 0.08,
                lerp(0.05, fanScale, eOutBack(p)), 0, lerp(85, 0, e), lerp(frz - dir * 150, frz, e),
                clamp(p * 2.5, 0, 1), 200 - Math.round(sp * 20), 0);
      } else if (T < tT) {                                       // fanned around him
        setCard(c, fx, fy + Math.sin(T * 0.004 + k * 1.3) * 3, fanScale, 0, 0, frz, 1, 200 - Math.round(sp * 20), 0);
      } else if (T < tT + 700) {                                 // thrown at the camera
        p = prog(T, tT, 700); e = eOutC(p);
        setCard(c, lerp(fx, px, e), lerp(fy, py, e), lerp(fanScale, ps, e),
                Math.sin(p * Math.PI) * 28, lerp(0, pry, e), lerp(frz, prz + 360 * dir, e),
                1, 300 - Math.round(sp * 20), 2.4 * Math.sin(p * Math.PI) * (1 - p * 0.5));
      } else if (T < tL) {                                       // hang in the air for a beat
        setCard(c, px, py + Math.sin((T - tT) * 0.006) * 4, ps, 0, pry, prz, 1, 300 - Math.round(sp * 20), 0);
      } else if (T < tL + 360) {                                 // land in the real slot
        p = prog(T, tL, 360); e = eOutC(p);
        setCard(c, lerp(px, rest.x, e), lerp(py, 0, e), lerp(ps, rest.s, eOutBack(p)),
                0, lerp(pry, rest.ry, e), lerp(prz, 0, e), lerp(1, rest.o, p * p), rest.z + 100, 0);
      } else {
        setCard(c, rest.x, 0, rest.s, 0, rest.ry, 0, rest.o, rest.z, 0);
        if (!landed[i]) {
          landed[i] = true;
          var front = o === n - 1;
          Sfx.impact(front ? 1 : rest.o > 0.3 ? 0.55 : 0.3);
          if (front) {
            pulseClass("iz-bump", 220);
            if (tier.cardBurst) burst(scx + rest.x, scy + cardH * rest.s * 0.5, tier.cardBurst * 2, 4);
          }
        }
      }
    }
  }

  /* =========================================================
     TIMELINE
     ========================================================= */
  function pulseClass(cls, ms) {
    var b = document.body;
    b.classList.remove(cls);
    void b.offsetWidth;                                          // restart the CSS animation
    b.classList.add(cls);
    classTimers.push(setTimeout(function () { b.classList.remove(cls); }, ms));
  }

  function buildEvents() {
    var n = hooks.cards.length, list = [];
    list.push({ t: 0, fn: function () { Sfx.droneOn(); } });
    list.push({ t: 300, fn: function () { skipEl.classList.add("show"); } });
    [1038, 1276, 1514, 1752].forEach(function (t) { list.push({ t: t, fn: function () { Sfx.step(); } }); });
    list.push({ t: T_SNAP, fn: function () {
      hand = handScreen(T_SNAP);
      Sfx.droneOff(); Sfx.snap();
      flashEl.style.setProperty("--fx", (hand.x / W * 100).toFixed(1) + "%");
      flashEl.style.setProperty("--fy", (hand.y / H * 100).toFixed(1) + "%");
      flashEl.classList.remove("on"); void flashEl.offsetWidth; flashEl.classList.add("on");
      pulseClass("iz-shake", 340);
      burst(hand.x, hand.y, tier.burst, 7);
      if (navigator.vibrate && !(hooks.isMuted && hooks.isMuted())) { try { navigator.vibrate(18); } catch (e) {} }
    } });
    for (var k = 0; k < n; k++) (function (k) {
      list.push({ t: T_CARDS + k * 90, fn: function () {
        Sfx.shimmer(k);
        if (tier.cardBurst && hand) burst(hand.x, hand.y, tier.cardBurst, 3.5);
      } });
    })(k);
    list.push({ t: 2650, fn: function () { titleEl.classList.add("show"); } });
    list.push({ t: T_FLICK, fn: function () { Sfx.whoosh(1); } });
    list.push({ t: T_FLICK + 90, fn: function () { Sfx.whoosh(0.55); } });
    list.push({ t: T_UI, fn: function () {
      titleEl.classList.remove("show");
      document.body.classList.remove("iz-hide-ui");
    } });
    list.push({ t: T_LAND + (n - 1) * 100 + 400, fn: handOff });
    list.sort(function (a, b) { return a.t - b.t; });
    return list;
  }

  /* All cards are home: give them back to index.html (same transforms, so no jump) */
  function handOff() {
    if (handedOff) return;
    handedOff = true;
    hooks.cards.forEach(function (c) { c.style.filter = ""; });
    hooks.hold(false);
    document.body.classList.remove("iz-on");
    if (skipEl) skipEl.classList.remove("show");
  }

  function frame(now) {
    if (!running) return;
    var dt = lastNow ? now - lastNow : 16;
    if (dt > 250 || dt < 0) dt = 16;                             // tab was hidden: resume where it left off
    lastNow = now;
    T += dt;

    if (T > 300 && T < 1600 && tier.name !== "low") {            // automatic performance fallback
      perfLog.push(dt);
      if (perfLog.length >= 24) {
        var sum = 0; for (var i = 0; i < perfLog.length; i++) sum += perfLog[i];
        if (sum / perfLog.length > 24) setTier(tier.name === "high" ? "mid" : "low");
        perfLog = [];
      }
    }

    while (events.length && events[0].t <= T) events.shift().fn();
    drawScene(T, dt);
    if (!handedOff) updateCards(T);
    back.style.opacity = (1 - eInOut(prog(T, 5400, T_END - 5400))).toFixed(3);

    if (T >= T_END) { finish(); return; }
    raf = requestAnimationFrame(frame);
  }

  function onKey(e) {
    if (e.key === "Escape" || e.key === "Esc") { e.preventDefault(); skip(); }
  }
  function onResize() { if (running) measure(); }

  /* =========================================================
     PUBLIC
     ========================================================= */
  function play() {
    if (running || !hooks || reducedMotion()) return false;
    if (hooks.canPlay && !hooks.canPlay()) return false;
    Sfx.unlock();                                                // inside the tap → audio allowed
    makeSprites();
    if (hooks.onStart) hooks.onStart();
    hooks.hold(true);

    back = document.createElement("div");
    back.className = "iz-back";
    cv = document.createElement("canvas");
    c2 = cv.getContext("2d");
    back.appendChild(cv);
    front = document.createElement("div");
    front.className = "iz-front";
    front.innerHTML = '<div class="iz-flash"></div><div class="iz-title"></div>' +
                      '<button type="button" class="iz-skip">SKIP INTRO &rsaquo;</button>';
    flashEl = front.querySelector(".iz-flash");
    flashEl.style.setProperty("--fpeak", tier.flash);
    titleEl = front.querySelector(".iz-title");
    titleEl.textContent = CONFIG.TITLE;
    skipEl = front.querySelector(".iz-skip");
    skipEl.addEventListener("click", function (e) { e.stopPropagation(); skip(); });
    skipEl.addEventListener("touchend", function (e) { e.preventDefault(); e.stopPropagation(); skip(); });
    document.body.appendChild(back);
    document.body.appendChild(front);
    document.body.classList.add("iz-on", "iz-hide-ui");

    running = true; handedOff = false; T = 0; lastNow = 0; parts = []; perfLog = [];
    measure();
    prepCards();
    events = buildEvents();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    raf = requestAnimationFrame(frame);
    return true;
  }

  function finish() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", onResize);
    classTimers.forEach(clearTimeout); classTimers = [];
    Sfx.stop();
    handOff();
    document.body.classList.remove("iz-on", "iz-hide-ui", "iz-shake", "iz-bump");
    if (back && back.parentNode) back.parentNode.removeChild(back);
    if (front && front.parentNode) front.parentNode.removeChild(front);
    back = cv = c2 = front = flashEl = titleEl = skipEl = null;
    parts = []; events = [];
    lsSet(CONFIG.STORAGE_KEY, "1");
    if (hooks.onEnd) hooks.onEnd();
  }

  function skip() { finish(); }

  function init(h) {
    hooks = h;
    if (CONFIG.CHARACTER_IMAGE) {
      var im = new Image();
      im.onload = function () { charImg = im; };
      im.src = CONFIG.CHARACTER_IMAGE;
    }
    replayBtn = document.createElement("button");
    replayBtn.type = "button";
    replayBtn.className = "sound-btn iz-replay";
    replayBtn.setAttribute("aria-label", "Replay intro");
    replayBtn.title = "Replay intro";
    replayBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3 4.5V9h4.5"/><path d="M10 8.8l5 3.2-5 3.2z" fill="currentColor"/></svg>';
    replayBtn.addEventListener("click", function (e) { e.stopPropagation(); play(); });
    document.body.appendChild(replayBtn);
  }

  window.ArcadeIntro = {
    init: init,
    autoPlay: function () {
      if (!hooks || reducedMotion()) return false;
      if (!CONFIG.PLAY_EVERY_VISIT && lsGet(CONFIG.STORAGE_KEY)) return false;
      return play();
    },
    play: play,
    skip: skip,
    reset: function () { lsDel(CONFIG.STORAGE_KEY); ssDel("gz_entered"); },
    isPlaying: function () { return running; },
    setPerformance: setTier,
    performance: function () { return tier.name; },
    config: CONFIG
  };
})();
