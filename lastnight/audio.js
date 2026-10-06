/* =====================================================================
   THE LAST NIGHT — audio
   Everything is synthesised with WebAudio so it can be placed in the
   house (stereo pan + distance + muffling through walls) and timed by
   the game. Only the low drone bed and the final scream use files.
   ===================================================================== */
(function () {
"use strict";
const LN = window.LN = window.LN || {};
const A = LN.audio = {};

let ctx = null, master, sfx, amb, verbIn, verbWet, comp;
let noiseBuf, brownBuf;
const L = { x: 0, y: 0, a: 0, floor: "" };
A.occlusion = null; // (x,y,floor) -> 0..1 audibility, set by the game
A.enabled = false;

A.init = function () {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.25;
    master = ctx.createGain(); master.gain.value = 0.9;
    master.connect(comp); comp.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.connect(master);
    amb = ctx.createGain(); amb.gain.value = 1; amb.connect(master);
    // reverb
    const conv = ctx.createConvolver();
    conv.buffer = impulse(2.6, 2.4);
    verbIn = ctx.createGain(); verbWet = ctx.createGain(); verbWet.gain.value = 0.32;
    verbIn.connect(conv); conv.connect(verbWet); verbWet.connect(master);
    noiseBuf = makeNoise(false); brownBuf = makeNoise(true);
    A.enabled = true;
    startAmbience();
};
A.ctx = () => ctx;
A.setListener = (x, y, a, floor) => { L.x = x; L.y = y; L.a = a; L.floor = floor; };
A.setReverb = (wet) => { if (verbWet) verbWet.gain.setTargetAtTime(wet, ctx.currentTime, 0.5); };
A.setMaster = (v, t) => { if (master) master.gain.setTargetAtTime(v, ctx.currentTime, t || 0.3); };

function impulse(sec, decay) {
    const rate = ctx.sampleRate, len = rate * sec, b = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
}
function makeNoise(brown) {
    const len = ctx.sampleRate * 3, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
}
function noise(brown) { const s = ctx.createBufferSource(); s.buffer = brown ? brownBuf : noiseBuf; s.loop = true; return s; }
function osc(type, f) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; }
function gain(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
function filt(type, f, q) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q !== undefined) b.Q.value = q; return b; }
const now = () => ctx.currentTime;

/* ---- spatial routing ---- */
function spatial(pos) {
    if (!pos) return { pan: 0, gain: 1, muffle: 1 };
    const dx = pos.x - L.x, dy = pos.y - L.y, d = Math.hypot(dx, dy);
    let rel = Math.atan2(dy, dx) - L.a;
    const pan = Math.max(-1, Math.min(1, Math.sin(rel) * Math.min(1, d / 1.2)));
    let g = 1 / (1 + d * 0.32);
    let muffle = 1;
    if (pos.floor && pos.floor !== L.floor) { g *= pos.above ? 0.7 : 0.5; muffle = 0.12; }
    else if (A.occlusion) { const o = A.occlusion(pos.x, pos.y); if (o < 1) { muffle = 0.15 + 0.85 * o; g *= 0.55 + 0.45 * o; } }
    if (Math.cos(rel) < 0) g *= 0.85; // slightly quieter behind
    return { pan, gain: g, muffle };
}
/* returns an input node; everything connected to it is placed at pos */
function out(pos, vol, verb) {
    const sp = spatial(pos);
    const g = gain(vol * sp.gain);
    let tail = g;
    if (sp.muffle < 0.98) { const f = filt("lowpass", 250 + sp.muffle * 7000, 0.7); tail.connect(f); tail = f; }
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = sp.pan; tail.connect(p); tail = p; }
    tail.connect(sfx);
    const send = gain(verb === undefined ? 0.5 : verb); tail.connect(send); send.connect(verbIn);
    return g;
}
function envGain(t, a, peak, d) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    return g;
}
function burst(dest, t, opt) {
    const n = noise(opt.brown); const f = filt(opt.type || "bandpass", opt.f, opt.q === undefined ? 1 : opt.q);
    const e = envGain(t, opt.a || 0.003, opt.v || 1, opt.d || 0.1);
    n.connect(f); f.connect(e); e.connect(dest);
    n.start(t, Math.random() * 2); n.stop(t + (opt.a || 0.003) + (opt.d || 0.1) + 0.05);
}
function tone(dest, t, opt) {
    const o = osc(opt.type || "sine", opt.f);
    if (opt.f2) o.frequency.exponentialRampToValueAtTime(opt.f2, t + (opt.slide || opt.d || 0.1));
    const e = envGain(t, opt.a || 0.003, opt.v || 1, opt.d || 0.2);
    o.connect(e); e.connect(dest); o.start(t); o.stop(t + (opt.a || 0.003) + (opt.d || 0.2) + 0.05);
    return o;
}

/* ================= AMBIENCE ================= */
const ambState = { wind: null, rain: null, rainG: null, roomG: null, hum: null, humG: null, drone: null, droneG: null, droneF: null };
let droneEl = null;
function startAmbience() {
    // wind: brown noise through a slowly wandering lowpass
    const w = noise(true), wf = filt("lowpass", 400, 0.8), wg = gain(0.0);
    w.connect(wf); wf.connect(wg); wg.connect(amb); w.start();
    const lfo = osc("sine", 0.07), lg = gain(220); lfo.connect(lg); lg.connect(wf.frequency); lfo.start();
    ambState.wind = wg; ambState.windF = wf;
    // rain: hiss + band
    const r = noise(false), rf = filt("highpass", 1200, 0.5), rb = filt("lowpass", 6500, 0.5), rg = gain(0.0);
    r.connect(rf); rf.connect(rb); rb.connect(rg); rg.connect(amb); r.start();
    ambState.rainG = rg; ambState.rainF = rb;
    // room tone
    const rt = noise(true), rtf = filt("lowpass", 160, 0.7), rtg = gain(0.12);
    rt.connect(rtf); rtf.connect(rtg); rtg.connect(amb); rt.start();
    ambState.roomG = rtg;
    // mains hum (only when the power is on)
    const hum = gain(0); [50, 100, 150].forEach((f, i) => { const o = osc(i ? "sine" : "triangle", f); const g = gain([0.05, 0.02, 0.012][i]); o.connect(g); g.connect(hum); o.start(); });
    hum.connect(amb); ambState.humG = hum;
    // tension drone
    const dg = gain(0), df = filt("lowpass", 180, 2);
    [41.2, 41.7, 61.7].forEach(f => { const o = osc("sawtooth", f); o.connect(df); o.start(); });
    const sub = osc("sine", 30.9); const sg = gain(0.6); sub.connect(sg); sg.connect(dg); sub.start();
    df.connect(dg); dg.connect(amb);
    ambState.droneG = dg; ambState.droneF = df;
    // heartbeat/breath bus
    // file bed (low drone)
    droneEl = new Audio("ambient.mp3"); droneEl.loop = true; droneEl.volume = 0.0;
    droneEl.play().catch(() => {});
}
A.ambience = function (o) {
    if (!ctx) return;
    const t = now();
    if (o.wind !== undefined) ambState.wind.gain.setTargetAtTime(o.wind, t, 0.8);
    if (o.rain !== undefined) ambState.rainG.gain.setTargetAtTime(o.rain, t, 0.5);
    if (o.rainMuffle !== undefined) ambState.rainF.frequency.setTargetAtTime(600 + o.rainMuffle * 6000, t, 0.4);
    if (o.room !== undefined) ambState.roomG.gain.setTargetAtTime(o.room, t, 0.5);
    if (o.hum !== undefined) ambState.humG.gain.setTargetAtTime(o.hum, t, o.hum ? 0.05 : 0.3);
    if (o.bed !== undefined && droneEl) droneEl.volume = Math.max(0, Math.min(1, o.bed));
};
A.tension = function (x) { // 0..1
    if (!ctx) return;
    const t = now();
    ambState.droneG.gain.setTargetAtTime(x * 0.22, t, 0.6);
    ambState.droneF.frequency.setTargetAtTime(120 + x * 500, t, 0.6);
};
A.stopAll = function () {
    if (!ctx) return;
    A.ambience({ wind: 0, rain: 0, room: 0, hum: 0, bed: 0 }); A.tension(0);
    emitters.forEach(e => e.stop && e.stop()); emitters.length = 0;
};

/* ================= ONE-SHOTS ================= */
const SURF = {
    wood:     { f: 520, q: 1.3, d: 0.09, th: 110, tv: 0.55, v: 0.55 },
    stone:    { f: 1900, q: 0.9, d: 0.05, th: 80, tv: 0.35, v: 0.5 },
    tile:     { f: 2600, q: 1.2, d: 0.045, th: 90, tv: 0.3, v: 0.45 },
    carpet:   { f: 380, q: 0.7, d: 0.07, th: 70, tv: 0.35, v: 0.35 },
    concrete: { f: 1100, q: 0.8, d: 0.07, th: 75, tv: 0.45, v: 0.55 },
    wet:      { f: 2300, q: 0.6, d: 0.09, th: 70, tv: 0.3, v: 0.5 },
    ghost:    { f: 300, q: 1.0, d: 0.16, th: 60, tv: 0.9, v: 0.8 }
};
A.footstep = function (surface, vol, pos) {
    if (!ctx) return;
    const s = SURF[surface] || SURF.wood, t = now(), o = out(pos, (vol || 1) * s.v, 0.6);
    burst(o, t, { f: s.f * (0.85 + Math.random() * 0.3), q: s.q, d: s.d, v: 0.9 });
    tone(o, t, { f: s.th, f2: s.th * 0.5, d: 0.09, v: s.tv });
    if (surface === "wet") burst(o, t + 0.03, { f: 4000, q: 0.5, d: 0.12, v: 0.4 });
    if ((surface === "wood" || surface === "carpet") && Math.random() < 0.12) A.creak(pos, 0.25, 0.35);
};
A.creak = function (pos, vol, dur) {
    if (!ctx) return;
    const t = now(), d = dur || 0.5 + Math.random() * 0.7, o = out(pos, vol || 0.5, 0.7);
    const base = 70 + Math.random() * 90;
    const saw = osc("sawtooth", base);
    saw.frequency.setValueAtTime(base, t); saw.frequency.linearRampToValueAtTime(base * (0.8 + Math.random() * 0.6), t + d);
    const am = osc("square", 18 + Math.random() * 30), amg = gain(0.5); am.connect(amg);
    const vca = gain(0.5); amg.connect(vca.gain);
    const bp = filt("bandpass", 900 + Math.random() * 900, 7);
    const e = envGain(t, 0.05, 1, d);
    saw.connect(vca); vca.connect(bp); bp.connect(e); e.connect(o);
    saw.start(t); am.start(t); saw.stop(t + d + 0.1); am.stop(t + d + 0.1);
};
A.doorCreak = function (pos, dur, vol) {
    if (!ctx) return;
    const t = now(), d = dur || 1.4, o = out(pos, vol || 0.6, 0.7);
    const saw = osc("sawtooth", 140);
    saw.frequency.setValueAtTime(110, t); saw.frequency.linearRampToValueAtTime(260, t + d * 0.6); saw.frequency.linearRampToValueAtTime(180, t + d);
    const am = osc("square", 24), amg = gain(0.6); am.connect(amg); am.frequency.linearRampToValueAtTime(40, t + d);
    const vca = gain(0.4); amg.connect(vca.gain);
    const bp = filt("bandpass", 1300, 9), bp2 = filt("bandpass", 600, 5);
    const e = envGain(t, 0.08, 1, d);
    saw.connect(vca); vca.connect(bp); vca.connect(bp2); bp.connect(e); bp2.connect(e); e.connect(o);
    saw.start(t); am.start(t); saw.stop(t + d + 0.2); am.stop(t + d + 0.2);
};
A.doorSlam = function (pos, vol) {
    if (!ctx) return;
    const t = now(), o = out(pos, vol || 1, 0.9);
    burst(o, t, { f: 260, type: "lowpass", q: 0.8, d: 0.35, v: 1.4, brown: true });
    tone(o, t, { f: 70, f2: 38, d: 0.35, v: 1.0 });
    burst(o, t + 0.01, { f: 1800, q: 1, d: 0.06, v: 0.6 });
};
A.rattle = function (pos, vol) {
    if (!ctx) return;
    const t = now(), o = out(pos, vol || 0.7, 0.5);
    for (let i = 0; i < 5; i++) {
        const tt = t + i * 0.07 + Math.random() * 0.02;
        burst(o, tt, { f: 900 + Math.random() * 600, q: 2, d: 0.05, v: 0.7 });
        tone(o, tt, { f: 2400 + Math.random() * 800, d: 0.05, v: 0.12, type: "triangle" });
    }
};
A.unlock = function (pos) {
    if (!ctx) return;
    const t = now(), o = out(pos, 0.9, 0.4);
    burst(o, t, { f: 2500, q: 3, d: 0.04, v: 0.8 });
    burst(o, t + 0.12, { f: 1400, q: 2, d: 0.08, v: 1.0 });
    tone(o, t + 0.12, { f: 3200, d: 0.12, v: 0.15, type: "triangle" });
};
A.knock = function (pos, n, vol) {
    if (!ctx) return;
    const t = now(), o = out(pos, vol || 0.9, 0.6), k = n || 3;
    for (let i = 0; i < k; i++) {
        const tt = t + i * (0.32 + Math.random() * 0.08);
        tone(o, tt, { f: 110, f2: 70, d: 0.12, v: 1 });
        burst(o, tt, { f: 500, type: "lowpass", d: 0.08, v: 0.8 });
    }
};
A.thump = function (pos, vol) {
    if (!ctx) return;
    const t = now(), o = out(pos, vol || 1, 0.8);
    tone(o, t, { f: 55, f2: 30, d: 0.6, v: 1.2 });
    burst(o, t, { f: 200, type: "lowpass", d: 0.4, v: 0.9, brown: true });
};
A.fall = function (pos, vol) { // something knocked over in another room
    if (!ctx) return;
    const t = now(), o = out(pos, vol || 0.8, 0.7);
    tone(o, t, { f: 90, f2: 50, d: 0.3, v: 0.8 });
    for (let i = 0; i < 6; i++) {
        const tt = t + 0.05 + i * (0.06 + Math.random() * 0.1);
        burst(o, tt, { f: 1500 + Math.random() * 2000, q: 4, d: 0.05, v: 0.5 / (1 + i * 0.4) });
        tone(o, tt, { f: 1800 + Math.random() * 1500, d: 0.15, v: 0.08 / (1 + i * 0.4), type: "triangle" });
    }
};
A.whisper = function (pos, dur, vol) {
    if (!ctx) return;
    const t = now(), d = dur || 2 + Math.random() * 1.5, o = out(pos, vol || 0.5, 0.8);
    const n = noise(false), hp = filt("highpass", 500);
    n.connect(hp);
    const syl = gain(0);
    // syllable-like amplitude pattern
    let tt = t;
    syl.gain.setValueAtTime(0, t);
    while (tt < t + d) {
        const len = 0.08 + Math.random() * 0.22;
        syl.gain.linearRampToValueAtTime(0.6 + Math.random() * 0.4, tt + len * 0.3);
        syl.gain.linearRampToValueAtTime(0.05, tt + len);
        tt += len + Math.random() * 0.12;
    }
    syl.gain.linearRampToValueAtTime(0, t + d + 0.1);
    [700, 1250, 2600, 3400].forEach((f, i) => {
        const bp = filt("bandpass", f, 8 + i * 2);
        bp.frequency.setValueAtTime(f, t);
        for (let k = 0; k < 6; k++) bp.frequency.linearRampToValueAtTime(f * (0.75 + Math.random() * 0.5), t + (k + 1) * d / 6);
        const g = gain([1, 0.8, 0.5, 0.3][i]);
        hp.connect(bp); bp.connect(g); g.connect(syl);
    });
    syl.connect(o);
    n.start(t); n.stop(t + d + 0.3);
};
A.tick = function (pos, tock, vol) {
    if (!ctx) return;
    const t = now(), o = out(pos, vol || 0.35, 0.3);
    burst(o, t, { f: tock ? 1900 : 2800, q: 6, d: 0.025, v: 1 });
    tone(o, t, { f: tock ? 1200 : 1600, d: 0.03, v: 0.2, type: "triangle" });
};
A.chime = function (pos, vol) { // grandfather clock strike
    if (!ctx) return;
    const t = now(), o = out(pos, vol || 0.8, 1.0), f0 = 196;
    [[1, 1], [2.0, 0.5], [2.76, 0.35], [5.4, 0.2], [8.9, 0.1]].forEach(([m, v]) => tone(o, t, { f: f0 * m, d: 4.5 / m * 1.6, v: v * 0.5, a: 0.004 }));
};
A.bell = function (pos, vol) { // small temple bell
    if (!ctx) return;
    const t = now(), o = out(pos, vol || 0.6, 0.8), f0 = 880;
    [[1, 1], [2.4, 0.4], [3.9, 0.25], [5.8, 0.1]].forEach(([m, v]) => tone(o, t, { f: f0 * m * (1 + Math.random() * 0.003), d: 2.6 / Math.sqrt(m), v: v * 0.35, a: 0.002 }));
};
A.sting = function (vol) { // low hit when something is seen
    if (!ctx) return;
    const t = now(), o = out(null, vol || 0.8, 1.0);
    tone(o, t, { f: 48, f2: 30, d: 1.8, v: 1.1 });
    burst(o, t, { f: 120, type: "lowpass", d: 1.4, v: 0.9, brown: true });
    const s = osc("sawtooth", 233), g = envGain(t, 0.02, 0.06, 1.6), f = filt("bandpass", 1200, 6);
    s.detune.linearRampToValueAtTime(-300, t + 1.6);
    s.connect(f); f.connect(g); g.connect(o); s.start(t); s.stop(t + 1.8);
};
A.swell = function (dur, vol) { // rising dread before an event
    if (!ctx) return;
    const t = now(), d = dur || 3, o = out(null, vol || 0.5, 1.0);
    const n = noise(false), f = filt("bandpass", 300, 3), g = gain(0);
    f.frequency.linearRampToValueAtTime(2400, t + d);
    g.gain.linearRampToValueAtTime(0.7, t + d * 0.95); g.gain.linearRampToValueAtTime(0, t + d + 0.05);
    n.connect(f); f.connect(g); g.connect(o); n.start(t); n.stop(t + d + 0.2);
};
A.thunder = function (vol) {
    if (!ctx) return;
    const t = now(), o = out(null, vol || 0.7, 0.6), n = noise(true), f = filt("lowpass", 180, 0.7), g = gain(0);
    g.gain.setValueAtTime(0, t);
    let tt = t;
    for (let i = 0; i < 5; i++) { tt += 0.2 + Math.random() * 0.5; g.gain.linearRampToValueAtTime(0.6 + Math.random() * 0.8, tt); g.gain.linearRampToValueAtTime(0.25, tt + 0.3); }
    g.gain.linearRampToValueAtTime(0, tt + 2.5);
    n.connect(f); f.connect(g); g.connect(o); n.start(t); n.stop(tt + 2.6);
};
A.drip = function (pos) {
    if (!ctx) return;
    const t = now(), o = out(pos, 0.25, 0.9);
    tone(o, t, { f: 1800 + Math.random() * 900, f2: 700, slide: 0.04, d: 0.06, v: 0.5 });
};
A.chain = function (pos, vol) { // well chain / rope crank step
    if (!ctx) return;
    const t = now(), o = out(pos, vol || 0.6, 0.5);
    for (let i = 0; i < 3; i++) { const tt = t + i * 0.05; tone(o, tt, { f: 3100 + Math.random() * 900, d: 0.08, v: 0.12, type: "triangle" }); burst(o, tt, { f: 2400, q: 5, d: 0.03, v: 0.4 }); }
    A.creak(pos, 0.25, 0.25);
};
A.splash = function (pos, vol) {
    if (!ctx) return;
    const t = now(), o = out(pos, vol || 0.6, 0.9);
    burst(o, t, { f: 900, type: "lowpass", d: 0.5, v: 0.9 });
    tone(o, t, { f: 300, f2: 120, d: 0.2, v: 0.4 });
};
A.powerOn = function () {
    if (!ctx) return;
    const t = now(), o = out(null, 0.9, 0.7);
    tone(o, t, { f: 60, f2: 40, d: 0.4, v: 1.2 }); burst(o, t, { f: 400, type: "lowpass", d: 0.3, v: 1, brown: true });
    const b = osc("sawtooth", 100), bg = envGain(t + 0.05, 0.1, 0.15, 1.6), bf = filt("bandpass", 700, 4);
    b.connect(bf); bf.connect(bg); bg.connect(o); b.start(t); b.stop(t + 2);
};
A.powerOff = function () {
    if (!ctx) return;
    const t = now(), o = out(null, 1, 0.8);
    burst(o, t, { f: 3000, q: 1, d: 0.08, v: 1.2 });
    tone(o, t, { f: 100, f2: 30, d: 0.9, v: 0.7, type: "sawtooth" });
};
A.flickerBuzz = function (pos) {
    if (!ctx) return;
    const t = now(), o = out(pos, 0.25, 0.3);
    const s = osc("sawtooth", 100), e = envGain(t, 0.01, 0.4, 0.25), f = filt("bandpass", 2000, 3);
    s.connect(f); f.connect(e); e.connect(o); s.start(t); s.stop(t + 0.3);
};
A.slide = function (pos, dur, vol) { // heavy door / cupboard dragging
    if (!ctx) return;
    const t = now(), d = dur || 1.2, o = out(pos, vol || 0.7, 0.6), n = noise(true), f = filt("bandpass", 260, 1.5), g = gain(0);
    const am = osc("square", 9), amg = gain(0.4); am.connect(amg); amg.connect(g.gain);
    g.gain.setValueAtTime(0.5, t); g.gain.setTargetAtTime(0, t + d, 0.1);
    n.connect(f); f.connect(g); g.connect(o); n.start(t); am.start(t); n.stop(t + d + 0.4); am.stop(t + d + 0.4);
};
A.paper = function () {
    if (!ctx) return;
    const t = now(), o = out(null, 0.4, 0.1);
    for (let i = 0; i < 3; i++) burst(o, t + i * 0.05, { f: 3500 + Math.random() * 2000, q: 0.8, d: 0.06, v: 0.5 });
};
A.pickup = function () {
    if (!ctx) return;
    const t = now(), o = out(null, 0.5, 0.2);
    burst(o, t, { f: 2200, q: 3, d: 0.05, v: 0.6 }); tone(o, t + 0.02, { f: 2600, d: 0.12, v: 0.1, type: "triangle" });
};
A.matchStrike = function () {
    if (!ctx) return;
    const t = now(), o = out(null, 0.4, 0.2);
    burst(o, t, { f: 3000, q: 0.6, d: 0.15, v: 0.9 });
};
A.scream = function () {
    if (!ctx) return;
    try { const el = new Audio("chilla1.mp3"); el.volume = 0.85; el.play().catch(() => {}); setTimeout(() => { el.pause(); }, 2600); } catch (e) {}
    const t = now(), o = out(null, 0.7, 0.8);
    const s = osc("sawtooth", 600), s2 = osc("sawtooth", 913), f = filt("bandpass", 1400, 2), g = envGain(t, 0.02, 0.6, 1.4);
    s.frequency.linearRampToValueAtTime(380, t + 1.4); s2.frequency.linearRampToValueAtTime(640, t + 1.4);
    s.connect(f); s2.connect(f); f.connect(g); g.connect(o); s.start(t); s2.start(t); s.stop(t + 1.6); s2.stop(t + 1.6);
    burst(o, t, { f: 2500, q: 0.5, d: 1.2, v: 0.8 });
};
A.static = function (dur, vol) {
    if (!ctx) return;
    const t = now(), o = out(null, vol || 0.3, 0.1);
    burst(o, t, { f: 3000, q: 0.4, d: dur || 0.4, v: 1, a: 0.01 });
};

/* ================= HEARTBEAT & BREATH (player body) ================= */
let hbTimer = 0, brTimer = 0, brPhase = 0;
A.body = function (dt, heart, breath) {
    if (!ctx) return;
    hbTimer -= dt;
    if (heart > 0.05 && hbTimer <= 0) {
        const t = now(), o = out(null, 0.5 + heart * 0.6, 0.05);
        tone(o, t, { f: 58, f2: 40, d: 0.12, v: 1 }); tone(o, t + 0.17, { f: 50, f2: 36, d: 0.14, v: 0.7 });
        hbTimer = 1.05 - heart * 0.55;
    }
    brTimer -= dt;
    if (breath > 0.1 && brTimer <= 0) {
        const t = now(), o = out(null, 0.12 + breath * 0.3, 0.05), inhale = brPhase % 2 === 0;
        const n = noise(false), f = filt("bandpass", inhale ? 1600 : 900, 1.2), g = gain(0);
        const d = inhale ? 0.45 : 0.55;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + d * 0.4); g.gain.linearRampToValueAtTime(0, t + d);
        if (inhale) f.frequency.linearRampToValueAtTime(2200, t + d);
        n.connect(f); f.connect(g); g.connect(o); n.start(t); n.stop(t + d + 0.1);
        brPhase++;
        brTimer = (inhale ? 0.5 : 0.65) * (1.4 - breath * 0.6);
    }
};

/* ================= EMITTERS (looping, positioned) ================= */
const emitters = [];
function emitter(pos, build) {
    const e = { pos, nodes: [], input: gain(1), out: gain(0), pan: ctx.createStereoPanner ? ctx.createStereoPanner() : null, lp: filt("lowpass", 8000, 0.7), vol: 1, alive: true };
    e.input.connect(e.lp); e.lp.connect(e.out);
    if (e.pan) { e.out.connect(e.pan); e.pan.connect(sfx); } else e.out.connect(sfx);
    const send = gain(0.35); e.out.connect(send); send.connect(verbIn);
    build(e);
    e.stop = () => { e.alive = false; e.out.gain.setTargetAtTime(0, now(), 0.05); setTimeout(() => e.nodes.forEach(n => { try { n.stop(); } catch (x) {} }), 400); };
    emitters.push(e);
    return e;
}
A.updateEmitters = function () {
    if (!ctx) return;
    const t = now();
    for (let i = emitters.length - 1; i >= 0; i--) {
        const e = emitters[i];
        if (!e.alive) { emitters.splice(i, 1); continue; }
        const sp = spatial(e.pos);
        e.out.gain.setTargetAtTime(e.vol * sp.gain, t, 0.08);
        e.lp.frequency.setTargetAtTime(250 + sp.muffle * 7500, t, 0.1);
        if (e.pan) e.pan.pan.setTargetAtTime(sp.pan, t, 0.08);
    }
};

A.phone = function (pos) { // old bell telephone: trrring-trrring ... pause
    if (!ctx) return null;
    return emitter(pos, (e) => {
        const f1 = osc("sine", 1180), f2 = osc("sine", 1460), f3 = osc("triangle", 2350);
        const am = osc("square", 22), amg = gain(0.5), vca = gain(0.5);
        am.connect(amg); amg.connect(vca.gain);
        const gate = gain(0);
        [f1, f2, f3].forEach((o, i) => { const g = gain([0.5, 0.4, 0.15][i]); o.connect(g); g.connect(vca); o.start(); e.nodes.push(o); });
        vca.connect(gate); gate.connect(e.input); am.start(); e.nodes.push(am);
        const t0 = now() + 0.05;
        for (let k = 0; k < 40; k++) {
            const t = t0 + k * 3.0;
            gate.gain.setValueAtTime(0, t); gate.gain.linearRampToValueAtTime(0.7, t + 0.02); gate.gain.setValueAtTime(0.7, t + 0.4); gate.gain.linearRampToValueAtTime(0, t + 0.42);
            gate.gain.linearRampToValueAtTime(0.7, t + 0.62); gate.gain.setValueAtTime(0.7, t + 1.0); gate.gain.linearRampToValueAtTime(0, t + 1.02);
        }
        e.vol = 1.1;
    });
};

A.radio = function (pos, music) { // battery valve radio: static, and later a warped song
    if (!ctx) return null;
    return emitter(pos, (e) => {
        const n = noise(false), bp = filt("bandpass", 2200, 0.5), sg = gain(music ? 0.1 : 0.35);
        n.connect(bp); bp.connect(sg); sg.connect(e.input); n.start(); e.nodes.push(n);
        const crackle = osc("square", 7), cg = gain(0.12); crackle.connect(cg); cg.connect(sg.gain); crackle.start(); e.nodes.push(crackle);
        e.static = sg;
        if (music) {
            // a slow, out-of-tune melody through a small speaker
            const mel = gain(0), sp = filt("bandpass", 1000, 1.2), ws = ctx.createWaveShaper();
            const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 3); } ws.curve = curve;
            mel.connect(ws); ws.connect(sp); sp.connect(e.input);
            const notes = [64, 67, 71, 69, 67, 66, 64, 62, 64, 59, 64, 67, 69, 71, 69, 67, 66, 64];
            const wow = osc("sine", 0.6), wg = gain(18); wow.connect(wg); wow.start(); e.nodes.push(wow);
            const t0 = now() + 0.2;
            for (let rep = 0; rep < 6; rep++) notes.forEach((m, i) => {
                const t = t0 + (rep * notes.length + i) * 0.62;
                const o = osc("triangle", 440 * Math.pow(2, (m - 69) / 12));
                wg.connect(o.detune);
                const g = envGain(t, 0.02, 0.35, 0.58);
                o.connect(g); g.connect(mel); o.start(t); o.stop(t + 0.7);
            });
            mel.gain.value = 0.5;
        }
        e.vol = 0.8;
    });
};

A.musicBox = function (pos) {
    if (!ctx) return null;
    return emitter(pos, (e) => {
        const notes = [76, 79, 83, 81, 79, 78, 76, 0, 74, 76, 78, 79, 78, 76, 74, 71];
        const t0 = now() + 0.1;
        let t = t0;
        notes.concat(notes).forEach((m, i) => {
            const slow = 1 + i * 0.035; // the spring running down
            if (m) {
                const f = 440 * Math.pow(2, (m - 69) / 12) * (1 + (Math.random() - 0.5) * 0.008);
                const o = osc("sine", f), o2 = osc("sine", f * 4.01);
                const g = envGain(t, 0.002, 0.3, 1.1), g2 = envGain(t, 0.001, 0.08, 0.25);
                o.connect(g); o2.connect(g2); g.connect(e.input); g2.connect(e.input);
                o.start(t); o2.start(t); o.stop(t + 1.3); o2.stop(t + 0.4);
            }
            t += 0.42 * slow;
        });
        e.vol = 0.9;
        e.duration = t - t0;
    });
};

A.ticking = function (pos, vol) { // continuous ticking clock (an emitter so it can stop dead)
    if (!ctx) return null;
    return emitter(pos, (e) => {
        const src = noise(false), bp = filt("bandpass", 2600, 6), gate = gain(0);
        src.connect(bp); bp.connect(gate); gate.connect(e.input); src.start(); e.nodes.push(src);
        const t0 = now() + 0.05;
        for (let k = 0; k < 600; k++) { const t = t0 + k * 0.5; gate.gain.setValueAtTime(0, t); gate.gain.linearRampToValueAtTime(k % 2 ? 0.6 : 1, t + 0.003); gate.gain.exponentialRampToValueAtTime(0.0001, t + 0.03); }
        e.vol = vol || 0.4;
    });
};

A.hum = function (pos) { // electric lock / panel buzz
    if (!ctx) return null;
    return emitter(pos, (e) => { const o = osc("sawtooth", 100), f = filt("bandpass", 600, 3), g = gain(0.06); o.connect(f); f.connect(g); g.connect(e.input); o.start(); e.nodes.push(o); e.vol = 0.6; });
};

})();
