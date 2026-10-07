/* =====================================================================
   THE LAST NIGHT — core
   State, input, movement, interaction, inventory/journal, hiding,
   checkpoints, the ghost, floor transitions, the story player and the
   main loop. The house's script lives in content.js.
   ===================================================================== */
(function () {
"use strict";
const LN = window.LN;
const A = LN.audio, ART = LN.art, W = LN.world, R = LN.render;
const G = LN.G = {};
const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const isTouch = (window.matchMedia && matchMedia("(pointer: coarse)").matches) || "ontouchstart" in window;
G.isTouch = isTouch;

/* ---------------- story media (upload these to the repo root) ----------------
   Any file that is missing is simply skipped. Order: video first, then images. */
const STORY = {
    video: ["lastnight_intro.mp4", "lastnight_intro.webm"],
    images: [
        ["lastnight_story1.jpg", "lastnight_story1.png", "lastnight_story1.jpeg", "lastnight_story1.webp"],
        ["lastnight_story2.jpg", "lastnight_story2.png", "lastnight_story2.jpeg", "lastnight_story2.webp"],
        ["lastnight_story3.jpg", "lastnight_story3.png", "lastnight_story3.jpeg", "lastnight_story3.webp"]
    ],
    imageSeconds: 7
};

const CFG = { walk: 1.75, run: 2.95, radius: 0.2, eye: 0.6, turnKey: 2.4, sens: 0.0023, ghostH: 0.78 };
G.CFG = CFG;

/* ---------------- state ---------------- */
let S = null;
const RT = {
    time: 0, mode: "loading", keys: {}, mouseDX: 0, target: null, hold: null, bob: 0, stepSide: 0,
    stamina: 1, staminaWait: 0, swayX: 0, swayY: 0, turnVel: 0, fade: 1, fadeTarget: 0, fadeSpeed: 1.2,
    timers: [], flash: 1, flashOff: 0, lightning: 0, moonMul: 1, shake: 0, hidden: null, stillT: 0, moving: false,
    rain: [], dust: [], overlay: null, lockedMsgT: 0, joyX: 0, joyY: 0, runBtn: false, deathT: 0, transit: null, flashOn: true
};
G.RT = RT;
G.S = () => S;

function fresh() {
    return { floor: "ground", x: 12.5, y: 19.4, a: -Math.PI / 2, inv: [], notes: [], flags: {}, ev: {}, phase: 1, t: 0, power: false };
}
G.floor = () => W.floors[S.floor];
G.flag = (k, v) => { if (v === undefined) return !!S.flags[k]; S.flags[k] = v; };
G.once = (id, cond, fn) => { if (!S.ev[id] && cond()) { S.ev[id] = true; fn(); return true; } return false; };
G.later = (sec, fn, tag) => RT.timers.push({ t: RT.time + sec, fn, tag });
G.cancel = (tag) => { RT.timers = RT.timers.filter(t => t.tag !== tag); };
G.dist = (x, y) => Math.hypot(S.x - x, S.y - y);
G.cam = () => ({ x: S.x, y: S.y, a: S.a, z: RT.camZ || CFG.eye });

/* ======================================================================
   HUD
   ====================================================================== */
let thoughtTimer = null;
G.think = function (text, dur) {
    const el = $("thought");
    el.textContent = text; el.classList.add("on");
    clearTimeout(thoughtTimer);
    thoughtTimer = setTimeout(() => el.classList.remove("on"), (dur || Math.max(3.2, text.length * 0.065)) * 1000);
};
let toastTimer = null;
G.toast = function (text) {
    const el = $("toast"); el.textContent = text; el.classList.add("on");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("on"), 2600);
};
G.subtitle = function (lines, done) {
    const el = $("subtitle"); let i = 0;
    const step = () => {
        if (i >= lines.length) { el.classList.remove("on"); done && done(); return; }
        const [txt, dur, fn] = lines[i++];
        el.innerHTML = txt; el.classList.add("on");
        fn && fn();
        G.later(dur, step, "subs");
    };
    step();
};

/* ---------------- inventory ---------------- */
G.has = (id) => S.inv.includes(id);
G.give = function (id, quiet) {
    if (G.has(id)) return;
    S.inv.push(id); A.pickup(); refreshInv();
    const it = LN.content.ITEMS[id];
    if (!quiet && it) G.toast("Mil gaya: " + it.name);
    if (!S.flags.journalHint) { S.flags.journalHint = true; G.later(2.8, () => G.toast(isTouch ? "Apna saamaan dekhne ke liye ☰ dabao" : "Apna saamaan dekhne ke liye TAB dabao")); }
};
G.take = function (id) { S.inv = S.inv.filter(i => i !== id); refreshInv(); };
function refreshInv() {
    const el = $("inv"); el.innerHTML = "";
    S.inv.forEach(id => {
        const it = LN.content.ITEMS[id]; if (!it) return;
        const d = document.createElement("div"); d.className = "slot"; d.title = it.name;
        d.style.backgroundImage = `url(${ART.icon(id)})`;
        el.appendChild(d);
    });
}

/* ---------------- notes & overlays ---------------- */
G.readNote = function (id) {
    const n = LN.content.NOTES[id]; if (!n) return;
    if (!S.notes.includes(id)) S.notes.push(id);
    A.paper();
    const v = $("noteView");
    v.className = "overlay note-" + (n.style || "paper");
    $("noteTitle").textContent = n.title;
    $("noteBody").innerHTML = n.body;
    const art = $("noteArt");
    if (n.drawing) { art.style.display = "block"; const c = art.getContext("2d"); c.fillStyle = "#d8d2be"; c.fillRect(0, 0, art.width, art.height); ART.drawChildArt(c, n.drawing, 10, 10, art.width - 20, art.height - 20, true); }
    else art.style.display = "none";
    openOverlay("noteView", n.onClose);
    n.onRead && n.onRead();
};
function openOverlay(id, onClose) {
    if (RT.overlay) closeOverlay(true);
    RT.overlay = { id, onClose };
    $(id).classList.add("show");
    if (document.pointerLockElement) document.exitPointerLock();
    RT.keys = {};
    stopHold();
}
function closeOverlay(silent) {
    if (!RT.overlay) return;
    const o = RT.overlay; RT.overlay = null;
    $(o.id).classList.remove("show");
    if (!silent && o.onClose) o.onClose();
    if (RT.mode === "play" && !isTouch) requestLock();
}
G.openOverlay = openOverlay; G.closeOverlay = closeOverlay;

function openJournal() {
    const inv = $("jInv"), notes = $("jNotes");
    inv.innerHTML = S.inv.length ? "" : "<p class='empty'>Abhi kuch nahi.</p>";
    S.inv.forEach(id => {
        const it = LN.content.ITEMS[id];
        const d = document.createElement("div"); d.className = "jitem";
        d.innerHTML = `<img src="${ART.icon(id)}" alt=""><div><b>${it.name}</b><span>${it.desc}</span></div>`;
        inv.appendChild(d);
    });
    notes.innerHTML = S.notes.length ? "" : "<p class='empty'>Abhi tak kuch nahi padha.</p>";
    S.notes.forEach(id => {
        const n = LN.content.NOTES[id];
        const b = document.createElement("button"); b.className = "jnote"; b.textContent = n.title;
        b.onclick = () => { closeOverlay(true); G.readNote(id); RT.overlay.onClose = null; };
        notes.appendChild(b);
    });
    openOverlay("journal");
}

/* ---------------- clock puzzle UI ---------------- */
const clockUI = { h: 12, m: 0, cb: null };
G.openClock = function (h, m, intro, cb) {
    clockUI.h = h; clockUI.m = m; clockUI.cb = cb;
    $("clockIntro").textContent = intro || "";
    drawClockUI();
    openOverlay("clockView");
};
function drawClockUI() {
    const c = $("clockCanvas"), x = c.getContext("2d"), s = c.width;
    x.clearRect(0, 0, s, s);
    x.fillStyle = "#3a2414"; x.beginPath(); x.arc(s / 2, s / 2, s * 0.48, 0, TAU); x.fill();
    x.fillStyle = "#cbbd9c"; x.beginPath(); x.arc(s / 2, s / 2, s * 0.42, 0, TAU); x.fill();
    x.fillStyle = "#2a1d12"; x.font = `${s * 0.075}px 'IM Fell English', Georgia, serif`; x.textAlign = "center"; x.textBaseline = "middle";
    const rom = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; x.fillText(rom[i], s / 2 + Math.sin(a) * s * 0.33, s / 2 - Math.cos(a) * s * 0.33); }
    for (let i = 0; i < 60; i++) { const a = i / 60 * TAU, r0 = s * (i % 5 ? 0.39 : 0.375); x.fillRect(s / 2 + Math.sin(a) * r0 - 1, s / 2 - Math.cos(a) * r0 - 1, 2, 2); }
    const ha = ((clockUI.h % 12) + clockUI.m / 60) / 12 * TAU, ma = clockUI.m / 60 * TAU;
    x.strokeStyle = "#140d08"; x.lineCap = "round";
    x.lineWidth = s * 0.03; x.beginPath(); x.moveTo(s / 2, s / 2); x.lineTo(s / 2 + Math.sin(ha) * s * 0.2, s / 2 - Math.cos(ha) * s * 0.2); x.stroke();
    x.lineWidth = s * 0.016; x.beginPath(); x.moveTo(s / 2, s / 2); x.lineTo(s / 2 + Math.sin(ma) * s * 0.32, s / 2 - Math.cos(ma) * s * 0.32); x.stroke();
    x.fillStyle = "#8a6a34"; x.beginPath(); x.arc(s / 2, s / 2, s * 0.025, 0, TAU); x.fill();
    $("clockRead").textContent = `${clockUI.h}:${String(clockUI.m).padStart(2, "0")}`;
}
function clockAdj(dh, dm) {
    clockUI.m += dm;
    while (clockUI.m >= 60) { clockUI.m -= 60; dh += 1; }
    while (clockUI.m < 0) { clockUI.m += 60; dh -= 1; }
    clockUI.h = ((clockUI.h - 1 + dh) % 12 + 12) % 12 + 1;
    A.tick(null, dm % 2 !== 0, 0.3);
    drawClockUI();
}
function clockSubmit() {
    const cb = clockUI.cb;
    closeOverlay(true);
    cb && cb(clockUI.h, clockUI.m);
}

/* ======================================================================
   INPUT
   ====================================================================== */
function requestLock() {
    const c = $("view");
    if (!isTouch && c.requestPointerLock && !document.pointerLockElement) { try { const p = c.requestPointerLock(); p && p.catch && p.catch(() => {}); } catch (e) {} }
}
document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (["tab", " ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
    if (RT.mode === "story") { if (k === " " || k === "enter" || k === "e") storyNext(); if (k === "escape") storySkip(); return; }
    if (RT.mode !== "play") return;
    if (RT.overlay) {
        if (RT.overlay.id === "clockView") {
            if (k === "arrowup" || k === "w") clockAdj(0, 1);
            else if (k === "arrowdown" || k === "s") clockAdj(0, -1);
            else if (k === "arrowright" || k === "d") clockAdj(1, 0);
            else if (k === "arrowleft" || k === "a") clockAdj(-1, 0);
            else if (k === "enter") clockSubmit();
            else if (k === "escape" || k === "e") closeOverlay();
            return;
        }
        if (k === "escape" || k === "e" || k === "tab" || k === "j" || k === "enter" || k === " ") { if (!e.repeat) closeOverlay(); }
        return;
    }
    if (e.repeat) return;
    RT.keys[k] = true;
    if (k === "e" || k === "enter") useStart();
    else if (k === "tab" || k === "j" || k === "i") openJournal();
    else if (k === "escape") pause();
    else if (k === "f") { RT.flashOn = !RT.flashOn; A.tick(null, true, 0.4); }
});
document.addEventListener("keyup", (e) => {
    const k = e.key.toLowerCase();
    RT.keys[k] = false;
    if (k === "e" || k === "enter") stopHold();
});
document.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement && RT.mode === "play" && !RT.overlay) RT.mouseDX += e.movementX;
});
document.addEventListener("pointerlockchange", () => {
    if (!document.pointerLockElement && RT.mode === "play" && !RT.overlay && !isTouch) pause();
});
window.addEventListener("blur", () => { RT.keys = {}; stopHold(); });

function pause() {
    if (RT.mode !== "play" || RT.overlay) return;
    openOverlay("pause");
}

/* touch controls */
function setupTouch() {
    if (!isTouch) return;
    document.body.classList.add("touch");
    const joy = $("joy"), stick = $("stick");
    let jid = null;
    const jmove = (e) => {
        const r = joy.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        const m = r.width * 0.35, d = Math.hypot(dx, dy); if (d > m) { dx = dx / d * m; dy = dy / d * m; }
        stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        RT.joyX = dx / m; RT.joyY = -dy / m;
    };
    joy.addEventListener("pointerdown", (e) => { jid = e.pointerId; joy.setPointerCapture(jid); jmove(e); });
    joy.addEventListener("pointermove", (e) => { if (e.pointerId === jid) jmove(e); });
    const jend = () => { jid = null; RT.joyX = RT.joyY = 0; stick.style.transform = "translate(-50%,-50%)"; };
    joy.addEventListener("pointerup", jend); joy.addEventListener("pointercancel", jend);
    const view = $("view"); let lid = null, lx = 0;
    view.addEventListener("pointerdown", (e) => { if (lid === null) { lid = e.pointerId; lx = e.clientX; } });
    view.addEventListener("pointermove", (e) => { if (e.pointerId === lid) { RT.mouseDX += (e.clientX - lx) * 1.5; lx = e.clientX; } });
    const lend = (e) => { if (e.pointerId === lid) lid = null; };
    view.addEventListener("pointerup", lend); view.addEventListener("pointercancel", lend);
    const use = $("btnUse");
    use.addEventListener("pointerdown", (e) => { e.preventDefault(); if (RT.overlay) { closeOverlay(); return; } useStart(); });
    use.addEventListener("pointerup", stopHold); use.addEventListener("pointercancel", stopHold);
    const run = $("btnRun");
    run.addEventListener("pointerdown", (e) => { e.preventDefault(); RT.runBtn = true; run.classList.add("on"); });
    const rend = () => { RT.runBtn = false; run.classList.remove("on"); };
    run.addEventListener("pointerup", rend); run.addEventListener("pointercancel", rend);
    $("btnJournal").addEventListener("click", () => { if (RT.mode === "play" && !RT.overlay) openJournal(); else if (RT.overlay) closeOverlay(); });
}

/* ======================================================================
   INTERACTION
   ====================================================================== */
const INTER = [];
G.inter = function (o) { const it = Object.assign({ r: 1.45, z: 0.35, ang: 0.42 }, o); INTER.push(it); return it; };

function findTarget() {
    if (RT.hidden) return RT.hidden.spot.exitInter;
    const F = G.floor(), cam = G.cam();
    let best = null, bestScore = 1e9;
    const fx = Math.cos(S.a), fy = Math.sin(S.a);
    for (let i = 0; i < INTER.length; i++) {
        const it = INTER[i];
        if (it.floor !== S.floor) continue;
        if (it.when && !it.when()) continue;
        if (it.spriteId) { const sp = W.spriteById[it.spriteId]; if (!sp || !sp.visible) continue; it.x = sp.x; it.y = sp.y; }
        const dx = it.x - S.x, dy = it.y - S.y, d = Math.hypot(dx, dy);
        if (d > it.r) continue;
        const along = (dx * fx + dy * fy) / (d || 1);
        const ang = Math.acos(Math.max(-1, Math.min(1, along)));
        const maxA = Math.max(it.ang, Math.atan2(0.45, d));
        if (ang > maxA) continue;
        const back = Math.min(d * 0.9, it.losBack || 0.06);
        if (!W.los(F, S.x, S.y, it.x - dx * back / (d || 1), it.y - dy * back / (d || 1))) continue;
        const score = ang * 1.4 + d * 0.25;
        if (score < bestScore) { bestScore = score; best = it; }
    }
    return best;
}
function labelOf(it) { return typeof it.label === "function" ? it.label() : it.label; }
function useStart() {
    if (RT.mode !== "play" || RT.overlay || RT.transit || RT.dying) return;
    const it = RT.target; if (!it) return;
    const hold = typeof it.hold === "function" ? it.hold() : it.hold;
    if (hold) { RT.hold = { it, h: hold, t: hold.keep ? (it._progress || 0) : 0 }; hold.start && hold.start(); return; }
    it.use && it.use();
}
function stopHold() {
    if (!RT.hold) return;
    const h = RT.hold; RT.hold = null;
    if (h.h.keep) h.it._progress = h.t;
    h.h.cancel && h.h.cancel(h.t / h.h.dur);
}
function updateHold(dt) {
    const ring = $("holdRing");
    if (!RT.hold) { ring.style.opacity = 0; return; }
    const h = RT.hold;
    if (RT.target !== h.it && !RT.hidden) { stopHold(); return; }
    h.t += dt;
    const p = Math.min(1, h.t / h.h.dur);
    ring.style.opacity = 1;
    ring.style.background = `conic-gradient(rgba(230,210,170,.85) ${p * 360}deg, rgba(255,255,255,.08) 0deg)`;
    h.h.tick && h.h.tick(p, dt);
    if (p >= 1) { RT.hold = null; h.it._progress = 0; ring.style.opacity = 0; h.h.done && h.h.done(); }
}

/* ======================================================================
   DOORS
   ====================================================================== */
G.door = (id) => { for (const f in W.floors) for (const d of W.floors[f].doorList) if (d.id === id) return d; return null; };
G.openDoor = function (d, speed, silent) {
    if (!d) return;
    d.target = 1; if (speed) d.speed = speed;
    if (!silent) { if (d.mode === "slide") A.slide(doorPos(d), 1 / d.speed * 0.9, 0.6); else A.doorCreak(doorPos(d), 0.9 / d.speed + 0.3, 0.45); }
};
G.closeDoor = function (d, slam) {
    if (!d) return;
    if (occupied(d)) return false;
    d.target = 0;
    if (slam) { d.speed = 6; d._slam = true; }
    else { d.speed = d.mode === "slide" ? 0.8 : 1.4; if (d.mode === "slide") A.slide(doorPos(d), 1, 0.6); else A.doorCreak(doorPos(d), 0.8, 0.4); }
    return true;
};
function doorPos(d) { return { x: d.x + 0.5, y: d.y + 0.5, floor: d.floor }; }
G.doorPos = doorPos;
function occupied(d) {
    if (S.floor === d.floor && Math.floor(S.x) === d.x && Math.floor(S.y) === d.y) return true;
    const g = ghost; if (g.on && g.floor === d.floor && Math.floor(g.x) === d.x && Math.floor(g.y) === d.y) return true;
    return false;
}
function updateDoors(dt) {
    for (const f in W.floors) for (const d of W.floors[f].doorList) {
        if (d.open === d.target) continue;
        const dir = Math.sign(d.target - d.open);
        if (dir < 0 && occupied(d)) { d.target = d.open; continue; }
        d.open += dir * d.speed * dt;
        if ((dir > 0 && d.open >= d.target) || (dir < 0 && d.open <= d.target)) {
            d.open = d.target;
            if (d._slam) { d._slam = false; A.doorSlam(doorPos(d), 1); if (d.floor === S.floor && G.dist(d.x + 0.5, d.y + 0.5) < 6) RT.shake = 0.25; }
        }
    }
}
/* generic door interaction */
G.doorUse = function (d) {
    const c = LN.content;
    if (d.locked) {
        if (c.tryUnlock && c.tryUnlock(d)) return;
        A.rattle(doorPos(d), 0.7);
        if (d.lockMsg) G.think(d.lockMsg);
        return;
    }
    if (d.open > 0.5) G.closeDoor(d); else G.openDoor(d);
};

/* ======================================================================
   MOVEMENT
   ====================================================================== */
function collides(F, x, y, r) {
    if (W.blocked(F, x - r, y - r) || W.blocked(F, x + r, y - r) || W.blocked(F, x - r, y + r) || W.blocked(F, x + r, y + r)) return true;
    for (let i = 0; i < F.sprites.length; i++) {
        const s = F.sprites[i];
        if (!s.solid || !s.visible) continue;
        const dx = x - s.x, dy = y - s.y, m = s.solid + r;
        if (dx * dx + dy * dy < m * m) return true;
    }
    return false;
}
G.collides = collides;
function updateMovement(dt) {
    const F = G.floor();
    // look
    let turn = 0;
    if (RT.keys["arrowleft"]) turn -= 1;
    if (RT.keys["arrowright"]) turn += 1;
    const dA = turn * CFG.turnKey * dt + RT.mouseDX * CFG.sens * (S.flags.sens || 1);
    RT.mouseDX = 0;
    S.a += dA;
    RT.turnVel = RT.turnVel * 0.85 + dA / Math.max(dt, 0.001) * 0.15;
    if (RT.hidden || RT.transit || RT.lockMove) { RT.moving = false; return; }

    let fwd = 0, str = 0;
    if (RT.keys["w"] || RT.keys["arrowup"] || RT.keys["z"]) fwd += 1;
    if (RT.keys["s"] || RT.keys["arrowdown"]) fwd -= 1;
    if (RT.keys["a"] || RT.keys["q"]) str -= 1;
    if (RT.keys["d"]) str += 1;
    fwd += RT.joyY; str += RT.joyX;
    const mag = Math.hypot(fwd, str);
    if (mag > 1) { fwd /= mag; str /= mag; }
    const wantRun = (RT.keys["shift"] || RT.runBtn) && fwd > 0.2;
    let running = false;
    if (wantRun && RT.stamina > 0.02 && !RT.sprintLock) { running = true; RT.stamina -= dt / 4.6; RT.staminaWait = 0.9; if (RT.stamina <= 0) { RT.stamina = 0; RT.sprintLock = true; } }
    else { RT.staminaWait -= dt; if (RT.staminaWait <= 0) RT.stamina = Math.min(1, RT.stamina + dt / 6.5); if (RT.stamina > 0.35) RT.sprintLock = false; }
    RT.running = running;
    const sp = (running ? CFG.run : CFG.walk) * Math.min(1, Math.hypot(fwd, str));
    const fx = Math.cos(S.a), fy = Math.sin(S.a);
    const len = Math.hypot(fwd, str) || 1;
    const vx = (fx * fwd - fy * str) / len * sp * dt, vy = (fy * fwd + fx * str) / len * sp * dt;
    const r = CFG.radius;
    let moved = false;
    if (vx || vy) {
        if (!collides(F, S.x + vx, S.y, r)) { S.x += vx; moved = true; }
        if (!collides(F, S.x, S.y + vy, r)) { S.y += vy; moved = true; }
        // pushing against a door opens it
        if (fwd > 0.3) {
            const ax = S.x + fx * 0.5, ay = S.y + fy * 0.5, d = W.doorAt(F, Math.floor(ax), Math.floor(ay));
            if (d && d.open < 0.82 && d.target < 1) {
                if (!d.locked) G.openDoor(d, 2.2);
                else if (RT.time - RT.lockedMsgT > 2.5) { RT.lockedMsgT = RT.time; A.rattle(doorPos(d), 0.5); if (d.lockMsg) G.think(d.lockMsg); }
            }
        }
    }
    RT.moving = moved && Math.hypot(vx, vy) > 0.0005;
    if (RT.moving) {
        RT.stillT = 0;
        const prev = RT.bob;
        RT.bob += dt * (running ? 11.5 : 8.2);
        if (Math.floor(prev / Math.PI) !== Math.floor(RT.bob / Math.PI)) {
            A.footstep(W.surfaceAt(F, S.x, S.y), running ? 0.85 : 0.55, null);
            LN.content.onStep && LN.content.onStep(running);
        }
    } else { RT.stillT += dt; RT.bob += (Math.round(RT.bob / Math.PI) * Math.PI - RT.bob) * Math.min(1, dt * 6); }
}

/* ======================================================================
   FLOOR TRANSITIONS
   ====================================================================== */
G.goFloor = function (st) {
    if (RT.transit) return;
    RT.transit = { st, t: 0, switched: false };
    RT.fadeTarget = 1; RT.fadeSpeed = 2.4;
    stopHold();
    const surf = st.to === "basement" || st.from === "basement" ? "concrete" : "wood";
    for (let i = 0; i < 6; i++) G.later(0.12 + i * 0.26, () => A.footstep(surf, 0.6), "stairs");
};
function updateTransit(dt) {
    const tr = RT.transit; if (!tr) return;
    tr.t += dt;
    if (!tr.switched && RT.fade >= 0.99) {
        tr.switched = true;
        const from = S.floor;
        S.floor = tr.st.to; S.x = tr.st.at[0]; S.y = tr.st.at[1]; S.a = tr.st.angle;
        A.setReverb(G.floor().cfg.verb);
        ghostFollow(from, tr.st);
        LN.content.onFloor && LN.content.onFloor(S.floor, from);
    }
    if (tr.switched && tr.t > 1.2) { RT.fadeTarget = 0; RT.fadeSpeed = 1.6; RT.transit = null; }
}

/* ======================================================================
   HIDING
   ====================================================================== */
G.hide = function (spot) {
    RT.hidden = { spot, t: 0, back: { x: S.x, y: S.y, a: S.a } };
    S.x = spot.view.x; S.y = spot.view.y; S.a = spot.view.a;
    $("hideMask").className = "show " + spot.mask;
    A.creak({ x: S.x, y: S.y }, 0.4, 0.5);
    spot.exitInter = { label: "Bahar niklo", use: G.unhide };
    if (ghost.on && (ghost.mode === "hunt" || ghost.mode === "search") && ghost.floor === S.floor) ghostOnHide(spot);
};
G.unhide = function () {
    const h = RT.hidden; if (!h) return;
    RT.hidden = null;
    S.x = h.spot.exit.x; S.y = h.spot.exit.y; S.a = h.spot.exit.a;
    $("hideMask").className = "";
    A.creak({ x: S.x, y: S.y }, 0.4, 0.5);
    if (ghost.on && (ghost.mode === "passby" || ghost.mode === "hunt")) { ghost.mode = "hunt"; ghost.lastSeenT = RT.time; ghost.lx = S.x; ghost.ly = S.y; }
};

/* ======================================================================
   THE GHOST
   ====================================================================== */
const ghost = { on: false, mode: "", floor: "ground", x: 0, y: 0, alpha: 0, h: CFG.ghostH, speed: 0, path: [], repath: 0, lastSeenT: -99, lx: 0, ly: 0, seen: 0, t: 0, stepT: 0, opts: {}, spr: { x: 0, y: 0, w: 0.25, h: CFG.ghostH, z: 0, alpha: 1, tex: null } };
G.ghost = ghost;
function ghostReset() { ghost.on = false; ghost.mode = ""; ghost.path = []; ghost.alpha = 0; ghost.follow = null; }
G.ghostOff = function (fade) { if (!ghost.on) return; if (fade) { ghost.mode = "fade"; ghost.t = 0; } else ghostReset(); };
G.ghostAppear = function (floor, x, y, opts) {
    ghostReset();
    Object.assign(ghost, { on: true, mode: "appear", floor, x, y, alpha: opts && opts.alpha || 0.92, seen: 0, t: 0, h: CFG.ghostH, opts: Object.assign({ vanishDist: 3.4, seenTime: 1.1, timeout: 30 }, opts) });
};
G.ghostCross = function (floor, x0, y0, x1, y1, speed, opts) {
    ghostReset();
    Object.assign(ghost, { on: true, mode: "cross", floor, x: x0, y: y0, tx: x1, ty: y1, speed: speed || 2.6, alpha: 0.85, t: 0, h: CFG.ghostH, opts: opts || {} });
};
G.ghostHunt = function (floor, x, y, opts) {
    ghostReset();
    Object.assign(ghost, { on: true, mode: "hunt", floor, x, y, alpha: 0.95, t: 0, h: CFG.ghostH, lastSeenT: RT.time, lx: S.x, ly: S.y, repath: 0, opts: Object.assign({ speed: 2.3, ramp: 2.5 }, opts) });
};
G.ghostRise = function (floor, x, y, opts) {
    ghostReset();
    Object.assign(ghost, { on: true, mode: "rise", floor, x, y, alpha: 0, t: 0, h: 0.2, opts: Object.assign({ dur: 2.3 }, opts) });
};
G.ghostStalk = function (floor, x, y, opts) {
    ghostReset();
    Object.assign(ghost, { on: true, mode: "stalk", floor, x, y, alpha: 0.95, t: 0, h: CFG.ghostH, repath: 0, opts: Object.assign({ speed: 1.15 }, opts) });
};

function ghostCanSee() {
    if (!ghost.on || ghost.floor !== S.floor) return false;
    const F = G.floor();
    const d = Math.hypot(S.x - ghost.x, S.y - ghost.y);
    if (d > 13) return false;
    return W.los(F, ghost.x, ghost.y, S.x, S.y);
}
function ghostOnScreen() {
    if (!ghost.on || ghost.floor !== S.floor) return false;
    const p = R.project(G.cam(), ghost.x, ghost.y, 0.4);
    return !!(p && p.visible && p.sx > 0.04 && p.sx < 0.96 && W.los(G.floor(), S.x, S.y, ghost.x, ghost.y));
}
G.ghostOnScreen = ghostOnScreen;

function bfs(F, sx, sy, tx, ty, avoid) {
    const w = F.w, h = F.h, start = sy * w + sx, goal = ty * w + tx;
    if (start === goal) return [];
    const prev = new Int32Array(w * h).fill(-1), q = [start];
    prev[start] = start;
    for (let qi = 0; qi < q.length; qi++) {
        const c = q[qi]; if (c === goal) break;
        const cx = c % w, cy = (c / w) | 0;
        for (let k = 0; k < 4; k++) {
            const nx = cx + [1, -1, 0, 0][k], ny = cy + [0, 0, 1, -1][k], n = ny * w + nx;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h || prev[n] !== -1) continue;
            if (!W.cellOpen(F, nx, ny, true)) continue;
            if (avoid && avoid(nx, ny)) continue;
            prev[n] = c; q.push(n);
        }
    }
    if (prev[goal] === -1) return null;
    const path = []; let c = goal;
    while (c !== start) { path.unshift({ x: (c % w) + 0.5, y: ((c / w) | 0) + 0.5 }); c = prev[c]; }
    return path;
}
G.bfs = bfs;
const safeZone = (F) => (x, y) => { const z = W.zoneAt(F, x, y); return z && z.name === "Prayer room"; };
G.inSafeZone = () => { const z = W.zoneAt(G.floor(), Math.floor(S.x), Math.floor(S.y)); return !!(z && z.name === "Prayer room"); };

function ghostMove(F, dt, speed) {
    const n = ghost.path[0]; if (!n) return false;
    const dx = n.x - ghost.x, dy = n.y - ghost.y, d = Math.hypot(dx, dy);
    if (d < 0.08) { ghost.path.shift(); return true; }
    const st = Math.min(d, speed * dt);
    ghost.x += dx / d * st; ghost.y += dy / d * st;
    // throw doors open as it passes
    const door = W.doorAt(F, Math.floor(ghost.x + dx / d * 0.45), Math.floor(ghost.y + dy / d * 0.45));
    if (door && door.open < 0.85 && !door.locked) { door.target = 1; door.speed = 5; A.doorSlam(doorPos(door), 0.8); }
    ghost.stepT -= dt;
    if (ghost.stepT <= 0) { ghost.stepT = 0.62 * 2.2 / Math.max(1, speed); A.footstep("ghost", 0.9, { x: ghost.x, y: ghost.y, floor: ghost.floor }); }
    return true;
}
function ghostPathTo(F, tx, ty) {
    const p = bfs(F, Math.floor(ghost.x), Math.floor(ghost.y), Math.floor(tx), Math.floor(ty), safeZone(F));
    ghost.path = p || [];
    if (p && p.length) p[p.length - 1] = { x: tx, y: ty };
    return !!p;
}
function ghostOnHide(spot) {
    const seen = ghostCanSee() && Math.hypot(ghost.x - S.x, ghost.y - S.y) < 4.2;
    if (seen) { ghost.mode = "found"; ghost.target = spot; return; }
    ghost.mode = "passby"; ghost.t = 0; ghost.spot = spot; ghost.stage = 0;
    // walk to a spot near the hiding place
    const F = G.floor();
    const near = spot.near || { x: spot.view.x, y: spot.view.y };
    ghostPathTo(F, near.x, near.y);
}
function ghostFollow(from, st) {
    if (!ghost.on || ghost.floor !== from) return;
    if (!(ghost.mode === "hunt" || ghost.mode === "search")) return;
    if (RT.time - ghost.lastSeenT > 5) return;
    const d = Math.hypot(ghost.x - (st.x + 0.5), ghost.y - (st.y + 0.5));
    const delay = Math.max(2.6, Math.min(6, d / ghost.opts.speed + 1.5));
    ghost.floor = "__between";
    ghost.follow = { t: RT.time + delay, st };
}

function updateGhost(dt) {
    const g = ghost;
    if (!g.on) return;
    g.t += dt;
    if (g.follow) {
        if (RT.time >= g.follow.t) {
            const st = g.follow.st; g.follow = null;
            g.floor = st.to; g.x = st.at[0]; g.y = st.at[1];
            g.mode = "hunt"; g.lastSeenT = RT.time; g.lx = S.x; g.ly = S.y; g.path = [];
            A.thump({ x: g.x, y: g.y, floor: g.floor }, 0.8);
            LN.content.onGhostArrive && LN.content.onGhostArrive(g.floor);
        }
        return;
    }
    if (g.floor !== S.floor && g.mode !== "hunt" && g.mode !== "search") { if (g.mode === "appear" || g.mode === "cross") ghostReset(); return; }
    const F = W.floors[g.floor];
    const d = Math.hypot(S.x - g.x, S.y - g.y);
    switch (g.mode) {
        case "appear": {
            if (ghostOnScreen()) {
                if (g.seen === 0 && g.opts.onSeen) g.opts.onSeen();
                g.seen += dt;
            }
            if (d < g.opts.vanishDist || g.seen > g.opts.seenTime || g.t > g.opts.timeout) {
                if (d < g.opts.vanishDist) RT.flashOff = 0.28;
                g.mode = "fade"; g.t = 0;
            }
            break;
        }
        case "cross": {
            const dx = g.tx - g.x, dy = g.ty - g.y, dd = Math.hypot(dx, dy);
            if (dd < 0.1) { ghostReset(); break; }
            const st = Math.min(dd, g.speed * dt); g.x += dx / dd * st; g.y += dy / dd * st;
            break;
        }
        case "fade": g.alpha -= dt * 4; if (g.alpha <= 0) ghostReset(); break;
        case "rise": {
            const p = Math.min(1, g.t / g.opts.dur);
            g.h = CFG.ghostH * (0.25 + 0.75 * p * p); g.alpha = Math.min(0.95, p * 1.5);
            if (p >= 1) { g.h = CFG.ghostH; G.ghostHunt(g.floor, g.x, g.y, g.opts.hunt); }
            break;
        }
        case "hunt": case "search": {
            if (g.floor !== S.floor) { // player left this floor without being followed
                if (RT.time - g.lastSeenT > 8) endChase();
                break;
            }
            // at the start of a chase it hunts by sound: it always knows roughly where you are
            const hears = g.mode === "hunt" && g.t < (g.opts.track || 0) && !RT.hidden && !G.inSafeZone();
            const see = !RT.hidden && (ghostCanSee() || hears) && !G.inSafeZone();
            if (see) { g.lastSeenT = RT.time; g.lx = S.x; g.ly = S.y; if (g.mode === "search") g.mode = "hunt"; }
            const ramp = Math.min(1, g.t / (g.opts.ramp || 0.01));
            const speed = g.mode === "search" ? 1.3 : (1.3 + (g.opts.speed - 1.3) * ramp);
            g.repath -= dt;
            if (g.repath <= 0) {
                g.repath = 0.3;
                const tx = see ? S.x : g.lx, ty = see ? S.y : g.ly;
                if (g.mode === "search" && !g.path.length) {
                    // wander near where it last saw you
                    for (let k = 0; k < 8; k++) {
                        const wx = Math.floor(g.lx + (Math.random() - 0.5) * 7), wy = Math.floor(g.ly + (Math.random() - 0.5) * 7);
                        if (W.cellOpen(F, wx, wy, true) && !safeZone(F)(wx, wy)) { ghostPathTo(F, wx + 0.5, wy + 0.5); break; }
                    }
                } else if (g.mode === "hunt") ghostPathTo(F, tx, ty);
            }
            ghostMove(F, dt, speed);
            if (!RT.hidden && d < 0.5 && !G.inSafeZone()) { die(); break; }
            if (g.mode === "hunt" && RT.time - g.lastSeenT > 6.5) { g.mode = "search"; g.searchT = 0; g.path = []; }
            if (g.mode === "search") { g.searchT = (g.searchT || 0) + dt; if (g.searchT > 9) endChase(); }
            if (G.inSafeZone() && d < 6 && !g.bellRung) { g.bellRung = true; A.bell({ x: 22.5, y: 1.2, floor: "ground" }, 0.7); W.lightById.diyas && (W.lightById.diyas.flare = 1.5); G.later(3.5, () => { if (ghost.on && G.inSafeZone()) endChase(); }); }
            break;
        }
        case "passby": {
            const moving = ghostMove(F, dt, 1.25);
            if (!moving || !g.path.length) {
                g.t2 = (g.t2 || 0) + dt;
                if (g.stage === 0 && g.t2 > 0.2) { g.stage = 1; LN.content.onPassbyStop && LN.content.onPassbyStop(); }
                if (g.t2 > 3.8 && g.stage === 1) {
                    g.stage = 2;
                    for (let k = 0; k < 12; k++) {
                        const wx = Math.floor(g.x + (Math.random() - 0.5) * 12), wy = Math.floor(g.y + (Math.random() - 0.5) * 12);
                        if (W.cellOpen(F, wx, wy, true) && Math.hypot(wx - g.x, wy - g.y) > 4) { ghostPathTo(F, wx + 0.5, wy + 0.5); break; }
                    }
                    G.later(3.0, () => { if (ghost.on && ghost.mode === "passby") endChase(); });
                }
            }
            break;
        }
        case "found": {
            const sp = g.target;
            const near = sp.near || sp.view;
            if (!g.path.length) ghostPathTo(F, near.x, near.y);
            ghostMove(F, dt, 2.0);
            if (Math.hypot(g.x - near.x, g.y - near.y) < 0.7) { G.unhide(); die(); }
            break;
        }
        case "stalk": {
            const watched = ghostOnScreen();
            g.repath -= dt;
            if (!watched) {
                if (g.repath <= 0) { g.repath = 0.4; ghostPathTo(F, S.x, S.y); }
                ghostMove(F, dt, g.opts.speed);
            }
            if (d < 0.55) die();
            break;
        }
    }
    g.spr.x = g.x; g.spr.y = g.y; g.spr.h = g.h; g.spr.alpha = Math.max(0, Math.min(1, g.alpha));
    const tex = ART.ghost; g.spr.tex = tex;
    if (tex) g.spr.w = g.h * tex.w / tex.h;
    g.spr.jitter = (g.mode === "hunt" || g.mode === "stalk" || g.mode === "found") ? 0.4 : 0.08;
}
function endChase() {
    if (!ghost.on) return;
    G.ghostOff(true);
    LN.content.onChaseEnd && LN.content.onChaseEnd();
}
G.endChase = endChase;

/* ======================================================================
   DEATH / CHECKPOINTS
   ====================================================================== */
function die() {
    if (RT.dying) return;
    RT.dying = { t: 0 };
    stopHold();
    A.scream(); A.sting(1);
    RT.shake = 0.8;
    LN.content.onDeath && LN.content.onDeath();
}
G.die = die;
function updateDeath(dt) {
    const d = RT.dying; if (!d) return;
    d.t += dt;
    // it is right in your face
    ghost.on = true; ghost.floor = S.floor;
    ghost.x = S.x + Math.cos(S.a) * 0.32; ghost.y = S.y + Math.sin(S.a) * 0.32;
    ghost.h = CFG.ghostH * (1 + d.t * 0.6); ghost.alpha = 1; ghost.mode = "dying";
    ghost.spr.x = ghost.x; ghost.spr.y = ghost.y; ghost.spr.h = ghost.h; ghost.spr.alpha = 1; ghost.spr.z = -0.1; ghost.spr.jitter = 1.2;
    if (ART.ghost) ghost.spr.w = ghost.h * ART.ghost.w / ART.ghost.h;
    if (d.t > 0.85 && !d.shown) {
        d.shown = true;
        ghost.spr.z = 0;
        RT.mode = "dead";
        A.stopAll();
        if (document.pointerLockElement) document.exitPointerLock();
        $("deathScreen").classList.add("show");
    }
}

function captureWorld() {
    const out = { doors: {}, decals: {}, sprites: {}, lights: {} };
    for (const f in W.floors) {
        const F = W.floors[f];
        F.doorList.forEach(d => out.doors[f + ":" + d.id] = { open: d.target, target: d.target, locked: d.locked, tex: d.tex });
        F.sprites.forEach(s => { if (s.id) out.sprites[f + ":" + s.id] = { x: s.x, y: s.y, spr: s.spr, visible: s.visible, solid: s.solid }; });
        F.lights.forEach(L => { if (L.id) out.lights[L.id] = { on: L.on, i: L.i }; });
    }
    for (const id in W.decalById) out.decals[id] = JSON.parse(JSON.stringify(W.decalById[id].state));
    return out;
}
function restoreWorld(w) {
    for (const f in W.floors) {
        const F = W.floors[f];
        F.doorList.forEach(d => { const s = w.doors[f + ":" + d.id]; if (s) Object.assign(d, s); });
        F.sprites.forEach(s => { if (s.id && w.sprites[f + ":" + s.id]) Object.assign(s, w.sprites[f + ":" + s.id]); });
        F.lights.forEach(L => { if (L.id && w.lights[L.id]) Object.assign(L, w.lights[L.id]); });
    }
    for (const id in w.decals) { const dc = W.decalById[id]; if (dc) { dc.state = w.decals[id]; W.refreshDecal(W.floors[dc.floor], dc); } }
}
G.checkpoint = function (name) {
    const data = JSON.stringify({ name, S, world: captureWorld() });
    RT.cp = data;
    try { localStorage.setItem("lastnight_cp_v2", data); } catch (e) {}
};
function loadCheckpoint(data) {
    const o = JSON.parse(data);
    S = o.S;
    W.build();
    restoreWorld(o.world);
    resetRuntime();
    refreshInv();
    A.setReverb(G.floor().cfg.verb);
    LN.content.onRestore && LN.content.onRestore(o.name);
}
function resetRuntime() {
    RT.timers = []; RT.hold = null; RT.hidden = null; RT.dying = null; RT.transit = null; RT.overlay = null;
    RT.fade = 1; RT.fadeTarget = 0; RT.fadeSpeed = 0.8; RT.stamina = 1; RT.sprintLock = false; RT.shake = 0; RT.flashOff = 0;
    $("hideMask").className = "";
    ["noteView", "clockView", "journal", "pause", "deathScreen", "endScreen"].forEach(id => $(id).classList.remove("show"));
    $("subtitle").classList.remove("on");
    ghostReset();
    INTER.length = 0;
    LN.content.register();
}

/* ======================================================================
   ATMOSPHERE: lights, rain, dust
   ====================================================================== */
function updateLights(dt) {
    const F = G.floor();
    RT.lightning = Math.max(0, RT.lightning - dt * 3.2);
    RT.moonMul = 1 + RT.lightning * 4;
    const gNear = ghost.on && ghost.floor === S.floor && ghost.mode !== "fade";
    for (const L of F.lights) {
        if (L.kind !== "dyn") continue;
        let c = 1;
        if (L.flicker === "candle") c = 0.82 + Math.sin(RT.time * 9 + L.x * 3) * 0.06 + Math.sin(RT.time * 23 + L.y) * 0.05 + (Math.random() - 0.5) * 0.06;
        if (L.flare) { c += L.flare; L.flare = Math.max(0, L.flare - dt * 0.8); }
        if (L.flickerT > 0) { L.flickerT -= dt; c *= Math.random() < 0.5 ? 0.08 : 0.9 + Math.random() * 0.2; }
        if (L.warm !== undefined && L.warm < 1) { L.warm = Math.min(1, L.warm + dt * 1.5); c *= Math.random() < L.warm ? L.warm : 0.1; }
        if (gNear && L.bulb !== undefined) {
            const d = Math.hypot(L.x - ghost.x, L.y - ghost.y);
            if (d < 5 && Math.random() < 0.35) c *= Math.random() * 0.6;
        }
        L.cur = Math.max(0, c);
    }
    W.combineLights(F, RT.moonMul);
}
function updateRain(dt) {
    const F = G.floor();
    const want = S.floor === "ground" ? 240 : 0;
    while (RT.rain.length < want) RT.rain.push({ x: 0, y: 0, z: -1 });
    if (!want) { RT.rain.length = 0; return; }
    const WH = F.cfg.wallH;
    for (const d of RT.rain) {
        d.z -= dt * 7.5;
        if (d.z < 0) {
            for (let k = 0; k < 4; k++) {
                const x = S.x + (Math.random() - 0.5) * 14, y = S.y + (Math.random() - 0.5) * 14;
                const cx = Math.floor(x), cy = Math.floor(y);
                if (cx > 0 && cy > 0 && cx < F.w && cy < F.h && F.sky[cy * F.w + cx]) { d.x = x; d.y = y; d.z = WH * (0.3 + Math.random() * 0.7); break; }
                d.z = -1;
            }
            if (d.z < 0) d.z = Math.random() * WH * 0.5 - WH; // try again later
        }
    }
}
function updateDust(dt) {
    while (RT.dust.length < 46) RT.dust.push({ x: S.x, y: S.y, z: 0.5, vx: 0, vy: 0, vz: 0 });
    for (const d of RT.dust) {
        d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
        if (Math.hypot(d.x - S.x, d.y - S.y) > 2.6 || d.z < 0.05 || d.z > 1.1) {
            const a = S.a + (Math.random() - 0.5) * 1.2, r = 0.3 + Math.random() * 2.2;
            d.x = S.x + Math.cos(a) * r; d.y = S.y + Math.sin(a) * r; d.z = 0.2 + Math.random() * 0.8;
            d.vx = (Math.random() - 0.5) * 0.06; d.vy = (Math.random() - 0.5) * 0.06; d.vz = (Math.random() - 0.6) * 0.03;
        }
    }
}
/* how exposed to the rain the player is: 1 standing in it, ~0.4 under the verandah, 0 deep inside */
function rainExposure() {
    const F = G.floor(); if (S.floor !== "ground") return 0;
    let best = 9;
    const cx = Math.floor(S.x), cy = Math.floor(S.y);
    for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 4; x <= cx + 4; x++) {
        if (x < 0 || y < 0 || x >= F.w || y >= F.h || !F.sky[y * F.w + x]) continue;
        const d = Math.hypot(x + 0.5 - S.x, y + 0.5 - S.y);
        if (d < best && (d < 0.8 || W.los(F, S.x, S.y, x + 0.5, y + 0.5))) best = d;
    }
    return best >= 9 ? 0 : Math.max(0, 1 - best / 5);
}

/* ======================================================================
   MAIN LOOP
   ====================================================================== */
let last = performance.now(), fpsAcc = 0, fpsN = 0;
function frame(now) {
    const rawDt = (now - last) / 1000; last = now;
    const dt = Math.min(0.067, rawDt);
    if (RT.mode === "play") {
        fpsAcc += rawDt; fpsN++;
        if (fpsN === 120) { if (fpsAcc / fpsN > 1 / 34 && !R.lowRes) { R.lowRes = true; R.resize(); } fpsAcc = 0; fpsN = 0; }
        if (!RT.overlay) tick(dt);
        draw(dt);
    } else if (RT.mode === "dead" || RT.mode === "end") {
        draw(0);
    }
    requestAnimationFrame(frame);
}
function tick(dt) {
    RT.time += dt; S.t += dt;
    // timers
    if (RT.timers.length) {
        const due = RT.timers.filter(t => t.t <= RT.time);
        if (due.length) { RT.timers = RT.timers.filter(t => t.t > RT.time); due.forEach(t => t.fn()); }
    }
    if (RT.dying) { updateDeath(dt); return; }
    updateMovement(dt);
    updateTransit(dt);
    updateDoors(dt);
    updateGhost(dt);
    LN.content.update(dt);
    updateLights(dt);
    updateRain(dt);
    updateDust(dt);
    RT.target = (RT.transit || RT.dying) ? null : findTarget();
    updateHold(dt);
    // flashlight
    RT.flashOff = Math.max(0, RT.flashOff - dt);
    let fl = RT.flashOn ? 1 : 0;
    const gd = ghost.on && ghost.floor === S.floor ? Math.hypot(ghost.x - S.x, ghost.y - S.y) : 99;
    const prox = Math.max(0, 1 - gd / 7) * (ghost.mode === "fade" ? 0 : 1);
    if (prox > 0.35 && Math.random() < prox * 0.35) fl *= Math.random() * 0.5;
    if (RT.flashOff > 0) fl *= Math.random() < 0.7 ? 0.04 : 0.6;
    if (RT.flicker > 0) { RT.flicker -= dt; if (Math.random() < 0.4) fl *= Math.random() * 0.3; }
    RT.flash += (fl - RT.flash) * Math.min(1, dt * 25);
    RT.prox = prox;
    // audio
    A.setListener(S.x, S.y, S.a, S.floor);
    const exp = rainExposure();
    const chase = ghost.on && (ghost.mode === "hunt" || ghost.mode === "search" || ghost.mode === "passby" || ghost.mode === "stalk" || ghost.mode === "found");
    A.ambience({ rain: (S.floor === "ground" ? 0.035 + exp * 0.2 : S.floor === "upper" ? 0.05 : 0.008) * (S.flags.dawn ? 0.4 : 1), rainMuffle: S.floor === "ground" ? 0.2 + exp * 0.8 : 0.08, wind: S.floor === "basement" ? 0.03 : 0.09, room: S.floor === "basement" ? 0.2 : 0.1, hum: S.power ? 0.6 : 0, bed: S.flags.dawn ? 0 : (chase ? 0.05 : 0.16) });
    A.tension(chase ? 0.85 : Math.max(prox * 0.9, LN.content.tension ? LN.content.tension() : 0));
    A.body(dt, chase ? Math.max(0.45, prox) : (RT.hidden && ghost.on ? 0.8 : prox * 0.7), Math.max(RT.running ? 0.35 : 0, (1 - RT.stamina) * (RT.stamina < 0.6 ? 1 : 0), chase ? 0.55 : 0, RT.hidden && ghost.on ? 0.25 : 0));
    A.updateEmitters();
    RT.shake = Math.max(0, RT.shake - dt * 1.6);
    RT.fade += Math.sign(RT.fadeTarget - RT.fade) * Math.min(Math.abs(RT.fadeTarget - RT.fade), dt * RT.fadeSpeed);
}
function draw(dt) {
    const F = G.floor();
    const bobY = Math.sin(RT.bob) * (RT.running ? 0.016 : 0.01);
    RT.camZ = CFG.eye + bobY;
    const sh = RT.shake;
    const cam = { x: S.x, y: S.y, a: S.a + (sh ? (Math.random() - 0.5) * sh * 0.05 : 0), z: RT.camZ, horizon: (sh ? (Math.random() - 0.5) * sh * 14 : 0) + Math.cos(RT.bob * 2) * 0.6 };
    RT.swayX += ((-RT.turnVel * 9) + Math.sin(RT.bob * 0.5) * 4 - RT.swayX) * 0.12;
    RT.swayY += (Math.abs(Math.sin(RT.bob)) * 3 - RT.swayY) * 0.15;
    const extra = [];
    if (ghost.on && ghost.floor === S.floor && ghost.spr.tex && ghost.alpha > 0.01) extra.push(ghost.spr);
    if (LN.content.extraSprites) LN.content.extraSprites(extra);
    R.render(F, cam, {
        flash: RT.flash * (RT.hidden ? 0 : 1), exposure: RT.hidden ? 3.2 : 1, swayX: Math.max(-40, Math.min(40, RT.swayX)), swayY: RT.swayY,
        time: RT.time, rain: RT.rain, dust: RT.dust, extra, lightning: RT.lightning > 0.3, moon: (S.floor === "basement" ? 0 : RT.moonMul) * (S.flags.dawn ? 1.8 : 1),
        skyMul: (1 + RT.lightning * 2.5) * (S.flags.dawn ? 2.2 : 1), distort: (RT.prox || 0) * (RT.prox || 0) * 0.9 + (RT.dying ? 1 : 0)
    });
    $("fade").style.opacity = RT.fade;
    // HUD
    const t = RT.target, pr = $("prompt");
    if (t && RT.mode === "play" && !RT.overlay) {
        const lbl = labelOf(t);
        if (lbl) {
            const holdIt = typeof t.hold === "function" ? t.hold() : t.hold;
            pr.innerHTML = (isTouch ? "" : `<kbd>E</kbd>`) + `<span>${lbl}${holdIt ? " <i>(dabaye rakho)</i>" : ""}</span>`;
            pr.classList.add("on");
            $("btnUse").classList.add("on"); $("btnUse").textContent = lbl.replace(/\s*\(.*\)$/, "").split(" ").pop();
            $("dot").classList.add("live");
        } else hidePrompt();
    } else hidePrompt();
    $("lockHint").classList.toggle("on", RT.mode === "play" && !RT.overlay && !isTouch && !document.pointerLockElement && !RT.dying && RT.fade < 0.5);
    const st = $("stamina");
    st.style.opacity = RT.stamina < 0.98 ? 0.9 : 0;
    st.firstElementChild.style.transform = `scaleX(${RT.stamina})`;
    st.classList.toggle("tired", RT.sprintLock);
}
function hidePrompt() { $("prompt").classList.remove("on"); $("btnUse").classList.remove("on"); $("dot").classList.remove("live"); }

/* ======================================================================
   STORY + LIFECYCLE
   ====================================================================== */
let storyQueue = [], storyCur = null, storyTimer = null;
function probeImage(cands) {
    return new Promise(res => {
        let i = 0;
        const next = () => { if (i >= cands.length) return res(null); const im = new Image(); const src = cands[i++]; im.onload = () => res(src); im.onerror = next; im.src = src; };
        next();
    });
}
function startStory() {
    RT.mode = "story";
    const el = $("story"); el.classList.add("show");
    const vid = $("storyVideo");
    storyQueue = [];
    const vidTry = (i) => {
        if (i >= STORY.video.length) return Promise.resolve(null);
        return new Promise(res => {
            const v = document.createElement("video");
            v.preload = "metadata"; v.muted = true;
            v.onloadedmetadata = () => res(STORY.video[i]);
            v.onerror = () => res(vidTry(i + 1));
            v.src = STORY.video[i];
        });
    };
    $("storyLoading").style.display = "block";
    Promise.all([vidTry(0)].concat(STORY.images.map(probeImage))).then(r => {
        $("storyLoading").style.display = "none";
        if (r[0]) storyQueue.push({ type: "video", src: r[0] });
        r.slice(1).forEach(src => { if (src) storyQueue.push({ type: "image", src }); });
        if (!storyQueue.length) { endStory(); return; }
        storyNext();
    });
    vid.onended = () => storyNext();
}
function storyNext() {
    clearTimeout(storyTimer);
    const vid = $("storyVideo"), im = $("storyImage");
    if (storyCur && storyCur.type === "video") { vid.pause(); }
    storyCur = storyQueue.shift();
    if (!storyCur) { endStory(); return; }
    if (storyCur.type === "video") {
        im.classList.remove("on"); vid.style.display = "block"; vid.src = storyCur.src; vid.muted = false;
        vid.play().catch(() => { vid.muted = true; vid.play().catch(() => storyNext()); });
        $("storyHint").textContent = isTouch ? "Skip karne ke liye tap karo" : "Skip karne ke liye SPACE dabao";
    } else {
        vid.style.display = "none"; vid.removeAttribute("src");
        im.classList.remove("on");
        setTimeout(() => { im.src = storyCur.src; im.classList.add("on"); }, 250);
        storyTimer = setTimeout(storyNext, STORY.imageSeconds * 1000);
        $("storyHint").textContent = isTouch ? "Aage badhne ke liye tap karo" : "Aage badhne ke liye SPACE dabao";
    }
}
function storySkip() { storyQueue = []; storyNext(); }
function endStory() {
    clearTimeout(storyTimer);
    const vid = $("storyVideo"); vid.pause(); vid.removeAttribute("src");
    $("story").classList.remove("show");
    beginPlay(null);
}
function beginPlay(cpData) {
    $("titleScreen").classList.remove("show");
    if (cpData) loadCheckpoint(cpData);
    else {
        S = fresh();
        W.build();
        resetRuntime();
        refreshInv();
        RT.fade = 1; RT.fadeSpeed = 0.5;
        LN.content.start();
        G.checkpoint("start");
    }
    RT.mode = "play";
    A.setReverb(G.floor().cfg.verb);
    A.setMaster(0.9, 1);
    if (!isTouch) requestLock();
    if (!S.flags.controlsShown) {
        S.flags.controlsShown = true;
        const h = $("controlsHint"); h.classList.add("on"); setTimeout(() => h.classList.remove("on"), 9000);
    }
}
G.retry = function () {
    $("deathScreen").classList.remove("show");
    A.init();
    beginPlay(RT.cp || localStorage.getItem("lastnight_cp_v2"));
};
G.finish = function () {
    RT.mode = "end";
    if (document.pointerLockElement) document.exitPointerLock();
    try { localStorage.removeItem("lastnight_cp_v2"); } catch (e) {}
    $("endScreen").classList.add("show");
};

function boot() {
    R.init($("view"));
    window.addEventListener("resize", () => R.resize());
    ART.build();
    setupTouch();
    A.occlusion = (x, y) => (S && W.floors[S.floor] && W.los(W.floors[S.floor], S.x, S.y, x, y)) ? 1 : 0;
    // title buttons
    let saved = null; try { saved = localStorage.getItem("lastnight_cp_v2"); } catch (e) {}
    if (saved) $("btnContinue").style.display = "inline-block";
    $("btnBegin").onclick = () => { A.init(); try { localStorage.removeItem("lastnight_cp_v2"); } catch (e) {} startStory(); };
    $("btnContinue").onclick = () => { A.init(); beginPlay(saved); };
    $("btnRetry").onclick = G.retry;
    $("btnAgain").onclick = () => { $("endScreen").classList.remove("show"); A.init(); RT.cp = null; startStory(); };
    $("btnResume").onclick = () => closeOverlay();
    $("btnPJournal").onclick = () => { closeOverlay(true); openJournal(); };
    $("story").addEventListener("click", (e) => { if (e.target.id === "storySkip") storySkip(); else storyNext(); });
    $("clockHU").onclick = () => clockAdj(1, 0); $("clockHD").onclick = () => clockAdj(-1, 0);
    $("clockMU").onclick = () => clockAdj(0, 1); $("clockMD").onclick = () => clockAdj(0, -1);
    $("clockM5U").onclick = () => clockAdj(0, 5); $("clockM5D").onclick = () => clockAdj(0, -5);
    $("clockSet").onclick = clockSubmit; $("clockLeave").onclick = () => closeOverlay();
    document.querySelectorAll(".closeOverlay").forEach(b => b.onclick = () => closeOverlay());
    $("sens").oninput = (e) => { if (S) S.flags.sens = parseFloat(e.target.value); };
    $("view").addEventListener("click", () => { if (RT.mode === "play" && !RT.overlay) requestLock(); });
    ART.loadGhost("ghost.png", () => {
        $("loading").classList.remove("show");
        $("titleScreen").classList.add("show");
        RT.mode = "title";
    });
    requestAnimationFrame(frame);
}
G.boot = boot;
window.addEventListener("load", boot);
})();
