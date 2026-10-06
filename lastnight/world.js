/* =====================================================================
   THE LAST NIGHT — the house
   Three floors of the Mehra haveli. Lowercase letters are floor cells
   (the letter is the room, which decides wall/floor/ceiling style and the
   footstep sound); everything else is solid.
     #  wall          J  window (moonlight)   O  stone pillar
     X  crate stack   D  door (see doors)     U/V stairs up/down
     F  front door    G  grille gate (a door) H  hidden cupboard (a door)
   ===================================================================== */
(function () {
"use strict";
const LN = window.LN = window.LN || {};
const W = LN.world = {};

const MAPS = {
    ground: [
        "############U#############",
        "#ssssss#hhh#h#hhhh#pppppp#",
        "Jssssss#hhh#G#hhhh#ppppppJ",
        "#ssssssDhhhhhhhhhhDpppppp#",
        "#ssssss#hhhhhhhhhh#pppppp#",
        "############hh############",
        "#llllll#vvvvvvvvvv#dddddd#",
        "#llllll#vOvvvvvvOv#dddddd#",
        "JllllllDvvccccccvvDddddddJ",
        "#llllll#vvccccccvv#dddddd#",
        "#llllll#vvccccccvv#dddddd#",
        "##H#####vvccccccvv###D####",
        "#rrrrrr#vvccccccvv#kkkkkk#",
        "#rrrrrrDvvccccccvvDkkkkkk#",
        "#rrrrrr#vOvvvvvvOv#kkkkkk#",
        "#rrrrrr#vvvvvvvvvv#kkkkkk#",
        "#n##########ee########D###",
        "#nnn#n##eeeeeeeeee####b###",
        "###n#n##eeeeeeeeee####V###",
        "#nnnnnnDeeeeeeeeee########",
        "#n######eeeeeeeeee########",
        "#########J##FF##J#########"
    ],
    upper: [
        "####################",
        "#mmmmmm#ttt#bbbbbbb#",
        "#mmmmmm#ttt#bbbbbbb#",
        "Jmmmmmm#tttDbbbbbbbJ",
        "#mmmmmm#ttt#bbbbbbb#",
        "###D#####D#####D####",
        "VqqqqqqqqqqqqqqqqqJ#",
        "#####D######q#######",
        "############q#######",
        "############q#######",
        "############q#######",
        "############J#######",
        "####################"
    ],
    basement: [
        "##U###############",
        "#aaaa#ccccccccccc#",
        "#aaaaacXXcXXcXXXc#",
        "#aaaa#cXXcccccXcc#",
        "######ccccXXcccXc#",
        "######cXcXXccXcXc#",
        "######cXcccXXcccc#",
        "######cccXXccccXc#",
        "###########z######",
        "#yyyy######z######",
        "#yyyyDzzzzzz######",
        "#yyyy#############",
        "#yyyy#############",
        "##################"
    ]
};

/* room styles: wall texture, floor, ceiling, footstep surface, display name */
const ZONES = {
    ground: {
        s: { wall: "w_study", win: "w_window_study", floor: "fl_wood", ceil: "ce_beams", surf: "wood", name: "Study" },
        h: { wall: "w_lime", win: "w_jaali", floor: "fl_redoxide", ceil: "ce_beams", surf: "stone", name: "Stair hall" },
        p: { wall: "w_prayer", win: "w_window_prayer", floor: "fl_marble", ceil: "ce_plaster", surf: "stone", name: "Prayer room" },
        l: { wall: "w_parlor", win: "w_window_parlor", floor: "fl_athangudi", ceil: "ce_beams", surf: "tile", name: "Parlour" },
        r: { wall: "w_store", win: "w_jaali", floor: "fl_cement", ceil: "ce_plaster", surf: "concrete", name: "Storeroom" },
        v: { wall: "w_lime", win: "w_jaali", floor: "fl_redoxide", ceil: "ce_beams", surf: "stone", name: "Verandah" },
        c: { wall: "w_lime", win: "w_jaali", floor: "fl_stone", ceil: "sky", surf: "wet", name: "Courtyard", sky: true },
        d: { wall: "w_dining", win: "w_window_dining", floor: "fl_athangudi", ceil: "ce_beams", surf: "tile", name: "Dining room" },
        k: { wall: "w_kitchen", win: "w_jaali", floor: "fl_kota", ceil: "ce_plaster", surf: "stone", name: "Kitchen" },
        e: { wall: "w_limeDark", win: "w_jaali", floor: "fl_redoxide", ceil: "ce_beams", surf: "stone", name: "Entrance hall" },
        n: { wall: "w_servant", win: "w_jaali", floor: "fl_brick", ceil: "ce_plaster", surf: "concrete", name: "Servants' passage" },
        b: { wall: "w_kitchenTop", win: "w_jaali", floor: "fl_cement", ceil: "ce_plaster", surf: "concrete", name: "Cellar stairs" }
    },
    upper: {
        m: { wall: "w_nursery", win: "w_window_nursery", floor: "fl_wood", ceil: "ce_plaster", surf: "wood", name: "Nursery" },
        t: { wall: "w_bath", win: "w_window_bath", floor: "fl_bath", ceil: "ce_plaster", surf: "tile", name: "Bathroom" },
        b: { wall: "w_bedroom", win: "w_window_bed", floor: "fl_redoxide", ceil: "ce_plaster", surf: "stone", name: "Bedroom" },
        q: { wall: "w_corridor", win: "w_window_corr", floor: "fl_carpet", ceil: "ce_plaster", surf: "carpet", name: "Upstairs corridor" }
    },
    basement: {
        a: { wall: "w_brick", win: "w_brick", floor: "fl_cement", ceil: "ce_concrete", surf: "concrete", name: "Cellar" },
        c: { wall: "w_brick", win: "w_brick", floor: "fl_cement", ceil: "ce_concrete", surf: "concrete", name: "Storage" },
        z: { wall: "w_brickDark", win: "w_brick", floor: "fl_cement", ceil: "ce_concrete", surf: "concrete", name: "Back passage" },
        y: { wall: "w_brickDark", win: "w_brick", floor: "fl_cement", ceil: "ce_concrete", surf: "concrete", name: "Locked room" }
    }
};

const FLOOR_CFG = {
    ground: { wallH: 1.3, fog: 0.07, fogCol: [6, 7, 10], ambient: [0.05, 0.05, 0.062], verb: 0.3, stairsUp: "w_stairsUp", stairsDown: "w_stairsDownK" },
    upper: { wallH: 1.08, fog: 0.08, fogCol: [6, 6, 8], ambient: [0.045, 0.045, 0.058], verb: 0.22, stairsUp: "w_stairsUp", stairsDown: "w_stairsDown" },
    basement: { wallH: 0.98, fog: 0.16, fogCol: [4, 4, 4], ambient: [0.022, 0.021, 0.02], verb: 0.5, stairsUp: "w_stairsUpB", stairsDown: "w_stairsDown" }
};

const LM = 4; // lightmap cells per tile
W.LM = LM;
W.floors = {};

/* face index: 0 N (seen from y-1), 1 E (seen from x+1), 2 S (seen from y+1), 3 W (seen from x-1) */
const FACE = { N: 0, E: 1, S: 2, W: 3 };
const FDX = [0, 1, 0, -1], FDY = [-1, 0, 1, 0];
W.FACE = FACE;

function isFloorChar(ch) { return ch >= "a" && ch <= "z"; }

function build(id) {
    const rows = MAPS[id], h = rows.length, w = rows[0].length;
    rows.forEach((r, i) => { if (r.length !== w) console.warn("map row width", id, i, r.length); });
    const cfg = FLOOR_CFG[id];
    const F = {
        id, w, h, cfg, rows,
        solid: new Uint8Array(w * h),     // 1 wall, 2 door
        zone: new Array(w * h).fill(null),
        sky: new Uint8Array(w * h),
        faces: new Array(w * h * 4).fill(null),
        jamb: false,
        doors: new Map(),
        doorList: [],
        decals: [],
        lights: [],
        sprites: [],
        lmW: w * LM, lmH: h * LM
    };
    F.lmBase = new Float32Array(F.lmW * F.lmH * 3);
    F.lmMoon = new Float32Array(F.lmW * F.lmH * 3);
    F.lm = new Float32Array(F.lmW * F.lmH * 3);
    const zones = ZONES[id];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const ch = rows[y][x], i = y * w + x;
        if (isFloorChar(ch)) { F.zone[i] = zones[ch]; if (zones[ch] && zones[ch].sky) F.sky[i] = 1; }
        else if (ch === "D" || ch === "G" || ch === "H") F.solid[i] = 2;
        else F.solid[i] = 1;
    }
    // doors inherit the zone of a neighbour for their floor/ceiling
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (F.solid[i] !== 2) continue;
        for (let k = 0; k < 4; k++) { const n = zoneAt(F, x + FDX[k], y + FDY[k]); if (n) { F.zone[i] = n; break; } }
    }
    W.floors[id] = F;
    return F;
}
function zoneAt(F, x, y) { if (x < 0 || y < 0 || x >= F.w || y >= F.h) return null; return F.zone[y * F.w + x]; }
W.zoneAt = zoneAt;

/* ---------------- doors ---------------- */
/* axis "x": leaf spans along x (passage runs north–south).  axis "y": leaf spans along y.
   mode "hinge": leaf sits flush with one edge of the doorway and swings into it.
   mode "slide": leaf sits mid-cell and slides into the wall (gates, cupboards, steel door). */
function door(F, o) {
    const d = Object.assign({ open: 0, target: 0, speed: 1.4, locked: false, mode: "hinge", side: 0, hinge: 0, tex: "d_room", texBack: null }, o);
    d.floor = F.id;
    d.cell = d.y * F.w + d.x;
    F.doors.set(d.cell, d);
    F.doorList.push(d);
    return d;
}
W.doorAt = (F, x, y) => F.doors.get(y * F.w + x);
/* returns segment {ax,ay,bx,by,u0,u1} of the leaf */
W.doorSeg = function (d) {
    const L = 0.96;
    if (d.mode === "slide") {
        const vis = 1 - d.open;
        if (d.axis === "x") { const yy = d.y + 0.5, hx = d.x + d.hinge, cx = d.hinge ? -1 : 1; return { ax: hx, ay: yy, bx: hx + cx * vis, by: yy, u0: d.open, u1: 1 }; }
        const xx = d.x + 0.5, hy = d.y + d.hinge, cy = d.hinge ? -1 : 1; return { ax: xx, ay: hy, bx: xx, by: hy + cy * vis, u0: d.open, u1: 1 };
    }
    const phi = d.open * Math.PI / 2 * 0.97;
    if (d.axis === "x") {
        const yy = d.y + (d.side ? 0.97 : 0.03), hx = d.x + d.hinge, cx = d.hinge ? -1 : 1, oy = d.side ? -1 : 1;
        return { ax: hx, ay: yy, bx: hx + (cx * Math.cos(phi)) * L, by: yy + (oy * Math.sin(phi)) * L, u0: 0, u1: 1 };
    }
    const xx = d.x + (d.side ? 0.97 : 0.03), hy = d.y + d.hinge, cy = d.hinge ? -1 : 1, ox = d.side ? -1 : 1;
    return { ax: xx, ay: hy, bx: xx + (ox * Math.sin(phi)) * L, by: hy + (cy * Math.cos(phi)) * L, u0: 0, u1: 1 };
};
W.doorPassable = (d) => d.open > 0.82;

/* ---------------- collision & sight ---------------- */
W.blocked = function (F, x, y) {
    const cx = Math.floor(x), cy = Math.floor(y);
    if (cx < 0 || cy < 0 || cx >= F.w || cy >= F.h) return true;
    const s = F.solid[cy * F.w + cx];
    if (s === 1) return true;
    if (s === 2) { const d = F.doors.get(cy * F.w + cx); return !d || !W.doorPassable(d); }
    return false;
};
W.cellOpen = function (F, cx, cy, forGhost) {
    if (cx < 0 || cy < 0 || cx >= F.w || cy >= F.h) return false;
    const s = F.solid[cy * F.w + cx];
    if (s === 1) return false;
    if (s === 2) { const d = F.doors.get(cy * F.w + cx); if (!d) return false; if (forGhost) return !d.locked && !d.ghostProof; return W.doorPassable(d); }
    return true;
};
/* line of sight between two points (walls and mostly-closed doors block) */
W.los = function (F, x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, dist = Math.hypot(dx, dy), steps = Math.ceil(dist / 0.1);
    for (let i = 1; i < steps; i++) {
        const t = i / steps, x = x0 + dx * t, y = y0 + dy * t, cx = Math.floor(x), cy = Math.floor(y);
        const s = F.solid[cy * F.w + cx];
        if (s === 1) return false;
        if (s === 2) { const d = F.doors.get(cy * F.w + cx); if (d && d.open < 0.5) return false; }
    }
    return true;
};

/* ---------------- textures for wall faces ---------------- */
function baseFor(F, x, y, face) {
    const ch = F.rows[y][x], nz = zoneAt(F, x + FDX[face], y + FDY[face]);
    if (!nz) return null;
    if (ch === "J") return nz.win;
    if (ch === "O") return "w_pillar";
    if (ch === "X") return "w_crates";
    if (ch === "U") return F.cfg.stairsUp;
    if (ch === "V") return F.cfg.stairsDown;
    const h = ((x * 73856093) ^ (y * 19349663) ^ (face * 83492791)) >>> 0;
    const v = h % 3;
    return v && LN.art.tex[nz.wall + "#" + v] ? nz.wall + "#" + v : nz.wall;
}
function buildFaces(F) {
    const ART = LN.art;
    for (let y = 0; y < F.h; y++) for (let x = 0; x < F.w; x++) {
        if (F.solid[y * F.w + x] !== 1) continue;
        for (let f = 0; f < 4; f++) {
            const b = baseFor(F, x, y, f);
            if (b) F.faces[(y * F.w + x) * 4 + f] = ART.tex[b];
        }
    }
    F.decals.forEach(dc => W.refreshDecal(F, dc));
}
/* decals: {x,y,face,decal,state,id,base?} */
function decal(F, x, y, face, name, state, id) {
    const dc = { x, y, face: FACE[face], decal: name, state: state || {}, id };
    F.decals.push(dc);
    if (id) W.decalById[id] = dc;
    dc.floor = F.id;
    return dc;
}
W.decalById = {};
W.refreshDecal = function (F, dc) {
    const base = dc.base || baseFor(F, dc.x, dc.y, dc.face);
    F.faces[(dc.y * F.w + dc.x) * 4 + dc.face] = LN.art.compose(base, dc.decal, dc.state);
};
W.setDecal = function (id, patch) {
    const dc = W.decalById[id]; if (!dc) return;
    Object.assign(dc.state, patch);
    W.refreshDecal(W.floors[dc.floor], dc);
};

/* ---------------- lights ---------------- */
/* {x,y,r,col,i,kind:"static"|"moon"|"dyn", flicker, on, id} */
function light(F, o) {
    const L = Object.assign({ r: 4, col: [1, 0.8, 0.55], i: 1, kind: "dyn", on: true, flicker: null, cur: 1 }, o);
    L.floor = F.id;
    F.lights.push(L);
    if (o.id) W.lightById[o.id] = L;
    return L;
}
W.lightById = {};

function lightVisible(F, x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, dist = Math.hypot(dx, dy), steps = Math.ceil(dist / 0.12);
    for (let i = 1; i < steps; i++) {
        const t = i / steps, cx = Math.floor(x0 + dx * t), cy = Math.floor(y0 + dy * t);
        if (F.solid[cy * F.w + cx] === 1) return false;
    }
    return true;
}
function computeLight(F, L) {
    const x0 = Math.max(0, Math.floor((L.x - L.r) * LM)), x1 = Math.min(F.lmW - 1, Math.ceil((L.x + L.r) * LM));
    const y0 = Math.max(0, Math.floor((L.y - L.r) * LM)), y1 = Math.min(F.lmH - 1, Math.ceil((L.y + L.r) * LM));
    const rw = x1 - x0 + 1, rh = y1 - y0 + 1, data = new Float32Array(rw * rh);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const wx = (x + 0.5) / LM, wy = (y + 0.5) / LM, cx = Math.floor(wx), cy = Math.floor(wy);
        if (F.solid[cy * F.w + cx] === 1) continue;
        const d = Math.hypot(wx - L.x, wy - L.y);
        if (d > L.r) continue;
        if (!lightVisible(F, L.x, L.y, wx, wy)) continue;
        const f = 1 - d / L.r;
        data[(y - y0) * rw + (x - x0)] = f * f * (0.7 + 0.3 * f) + 0.12 / (1 + d * d * 4);
    }
    L.reg = { x0, y0, rw, rh, data };
}
function addLight(F, L, target, scale) {
    const R = L.reg, cr = L.col[0] * scale, cg = L.col[1] * scale, cb = L.col[2] * scale;
    for (let y = 0; y < R.rh; y++) {
        let li = ((y + R.y0) * F.lmW + R.x0) * 3, ri = y * R.rw;
        for (let x = 0; x < R.rw; x++, li += 3, ri++) {
            const v = R.data[ri];
            if (v === 0) continue;
            target[li] += v * cr; target[li + 1] += v * cg; target[li + 2] += v * cb;
        }
    }
}
W.bakeLights = function (F) {
    const a = F.cfg.ambient;
    for (let i = 0; i < F.lmBase.length; i += 3) { F.lmBase[i] = a[0]; F.lmBase[i + 1] = a[1]; F.lmBase[i + 2] = a[2]; }
    F.lmMoon.fill(0);
    F.lights.forEach(L => {
        if (!L.reg) computeLight(F, L);
        if (L.kind === "static" && L.on) addLight(F, L, F.lmBase, L.i);
        else if (L.kind === "moon") addLight(F, L, F.lmMoon, L.i);
    });
    F.dynLights = F.lights.filter(L => L.kind === "dyn");
};
/* per frame: lm = base + moon*m + dynamic lights at their current level */
W.combineLights = function (F, moonMul) {
    const lm = F.lm, b = F.lmBase, m = F.lmMoon, n = lm.length;
    for (let i = 0; i < n; i++) lm[i] = b[i] + m[i] * moonMul;
    const dl = F.dynLights;
    for (let k = 0; k < dl.length; k++) { const L = dl[k]; if (L.on && L.cur > 0.01) addLight(F, L, lm, L.i * L.cur); }
};

/* ---------------- sprites ---------------- */
/* {id,x,y,spr,w,h,z,solid,visible,fullbright,alpha} — w/h in tiles */
function sprite(F, o) {
    const s = Object.assign({ w: 0.8, h: 0.8, z: 0, solid: 0, visible: true, fullbright: false, alpha: 1 }, o);
    s.floor = F.id;
    F.sprites.push(s);
    if (o.id) W.spriteById[o.id] = s;
    return s;
}
W.spriteById = {};

/* ======================================================================
   POPULATE THE HOUSE
   ====================================================================== */
W.build = function () {
    W.decalById = {}; W.lightById = {}; W.spriteById = {};
    const G = build("ground"), U = build("upper"), B = build("basement");
    const moon = [0.38, 0.46, 0.66], warm = [1.0, 0.72, 0.42], bulb = [1.0, 0.86, 0.62], diya = [1.0, 0.62, 0.28];

    /* ---------- GROUND FLOOR ---------- */
    // doors
    door(G, { id: "studyDoor", x: 7, y: 3, axis: "y", side: 1, hinge: 0, tex: "d_study", locked: true, key: "studyKey", lockMsg: "Locked. A brass plate reads STUDY." });
    door(G, { id: "prayerDoor", x: 18, y: 3, axis: "y", side: 0, hinge: 1, tex: "d_room", open: 0.35, target: 0.35, ghostProof: true });
    door(G, { id: "gate", x: 12, y: 2, axis: "x", mode: "slide", hinge: 0, tex: "d_gate", locked: true, key: "gateKey", speed: 0.8, lockMsg: "A collapsible iron gate. The padlock is new." });
    door(G, { id: "parlorDoor", x: 7, y: 8, axis: "y", side: 1, hinge: 0, tex: "d_room", open: 1, target: 1 });
    door(G, { id: "diningDoor", x: 18, y: 8, axis: "y", side: 0, hinge: 1, tex: "d_room", open: 0.6, target: 0.6 });
    door(G, { id: "dkDoor", x: 21, y: 11, axis: "x", side: 0, hinge: 0, tex: "d_plain" });
    door(G, { id: "kitchenDoor", x: 18, y: 13, axis: "y", side: 0, hinge: 0, tex: "d_plain", open: 1, target: 1 });
    door(G, { id: "boltDoor", x: 7, y: 13, axis: "y", side: 1, hinge: 1, tex: "d_bolted", locked: true, key: "bolt", lockMsg: "It won't move. Bolted from the other side." });
    door(G, { id: "cellarDoor", x: 22, y: 16, axis: "x", side: 0, hinge: 1, tex: "d_cellar", locked: true, key: "cellarKey", lockMsg: "Chained shut. The padlock is heavy and old." });
    door(G, { id: "servantDoor", x: 7, y: 19, axis: "y", side: 0, hinge: 1, tex: "d_plain" });
    door(G, { id: "cupboard", x: 2, y: 11, axis: "x", mode: "slide", hinge: 0, tex: "d_cupboard", texBack: "d_cupboardBack", locked: true, key: "push", speed: 0.45, lockMsg: null });

    // decals
    decal(G, 12, 21, "N", "frontDoor", { half: "L", chain: true }, "frontL");
    decal(G, 13, 21, "N", "frontDoor", { half: "R", chain: true }, "frontR");
    decal(G, 10, 16, "S", "grandClock", { h: 3, m: 17, swing: 0 }, "grandClock");
    decal(G, 15, 16, "S", "photos", { seed: 3, variants: ["normal", "normal", "normal", "normal", "normal"] }, "hallPhotos");
    decal(G, 9, 0, "S", "familyPortrait", {}, "familyPortrait");
    decal(G, 16, 0, "S", "portrait", { kind: "man", variant: "normal", label: "R. MEHRA" }, "raviPortrait");
    decal(G, 22, 0, "S", "shrine", {}, "shrine");
    decal(G, 3, 5, "S", "wallClock", { h: 3, m: 9, swing: 0 }, "parlorClock");
    decal(G, 0, 8, "E", "curtains", { t: 0, amp: 0 }, "curtains");
    decal(G, 7, 10, "W", "photos", { seed: 9 }, "parlorPhotos");
    decal(G, 3, 5, "N", "wallClock", { h: 12, m: 0, swing: 0 }, "studyClock");
    decal(G, 3, 0, "S", "bookshelf", { seed: 3 });
    decal(G, 4, 0, "S", "bookshelf", { seed: 8 });
    decal(G, 0, 4, "E", "bookshelf", { seed: 13 });
    decal(G, 7, 1, "W", "newspaperWall", {});
    decal(G, 21, 5, "S", "sideboard", {});
    decal(G, 23, 5, "S", "photos", { seed: 21 }, "diningPhotos");
    decal(G, 25, 13, "W", "stove", {});
    decal(G, 20, 16, "N", "pantry", {}, "pantry");
    decal(G, 19, 11, "S", "calendar", {});
    decal(G, 0, 13, "E", "wardrobe", { wood: true }, "almirah");
    decal(G, 5, 16, "S", "scratches", { kind: "text", text: "MISTY\n  5 -\n  6 -\n  7 -", size: 9, x: 40, y: 34, seed: 4 });
    decal(G, 1, 21, "N", "drawing", { n: 3, tilt: 1, low: true }, "drawing3");
    decal(G, 7, 17, "E", "scratches", { kind: "text", text: "  we are\n  still\n  here", size: 9, x: 30, y: 46, seed: 6 }, "hallScratch");

    // lights — moonlight through every window, the sky over the courtyard
    G.rows.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === "J") {
            for (let f = 0; f < 4; f++) {
                const nx = x + FDX[f], ny = y + FDY[f];
                if (zoneAt(G, nx, ny)) light(G, { kind: "moon", x: nx + 0.5 - FDX[f] * 0.35, y: ny + 0.5 - FDY[f] * 0.35, r: 4.2, col: moon, i: 0.75 });
            }
        }
        if (G.sky[y * G.w + x]) light(G, { kind: "moon", x: x + 0.5, y: y + 0.5, r: 2.6, col: moon, i: 0.32 });
    }));
    light(G, { id: "diningCandle", x: 21.9, y: 8.4, r: 4.2, col: warm, i: 1.15, flicker: "candle" });
    light(G, { id: "diyas", x: 22.5, y: 1.4, r: 4.4, col: diya, i: 1.25, flicker: "candle" });
    light(G, { id: "lantern", x: 15.5, y: 1.6, r: 4.5, col: warm, i: 1.1, on: false, flicker: "candle" });
    light(G, { id: "dawn", x: 12.9, y: 20.2, r: 8, col: [0.72, 0.8, 0.95], i: 0, on: false });
    // bulbs (dead until the power returns)
    [["b_hall", 12.5, 18.6], ["b_verNW", 8.6, 6.6], ["b_verNE", 17.4, 6.6], ["b_verSW", 8.6, 15.4], ["b_verSE", 17.4, 15.4],
     ["b_parlor", 3.5, 8.5], ["b_dining", 21.5, 6.8], ["b_kitchen", 21.5, 13.5], ["b_stair", 12.5, 3.5], ["b_study", 3.5, 3.0], ["b_store", 3.5, 13.5]]
        .forEach(([id, x, y]) => { light(G, { id, x, y, r: 5, col: bulb, i: 1.0, on: false, flicker: "bulb", bulb: true }); sprite(G, { id: id + "_s", x, y, spr: "bulb", w: 0.07, h: 0.3, z: G.cfg.wallH - 0.3 }); });

    // props
    sprite(G, { id: "well", x: 13.0, y: 11.0, spr: "well", w: 1.05, h: 1.05, solid: 0.42 });
    sprite(G, { id: "tulsi", x: 10.8, y: 8.8, spr: "tulsi", w: 0.3, h: 0.4, solid: 0.18 });
    sprite(G, { id: "wheelchair", x: 8.7, y: 11.6, spr: "wheelchair", w: 0.42, h: 0.42, solid: 0.22 });
    sprite(G, { id: "rocker", x: 3.4, y: 8.0, spr: "rocker2", w: 0.46, h: 0.46, solid: 0.24 });
    sprite(G, { id: "phoneTable", x: 1.5, y: 6.7, spr: "phoneTable", w: 0.5, h: 0.5, solid: 0.2 });
    sprite(G, { id: "radio", x: 5.5, y: 6.6, spr: "radio", w: 0.5, h: 0.5, solid: 0.2 });
    sprite(G, { id: "sofa", x: 5.0, y: 10.3, spr: "sofa", w: 0.8, h: 0.53, solid: 0.38 });
    sprite(G, { id: "dining", x: 21.9, y: 8.4, spr: "dining", w: 1.15, h: 0.72, solid: 0.6 });
    sprite(G, { id: "diningFlame", x: 21.9, y: 8.39, spr: "flame", w: 0.045, h: 0.06, z: 0.52, fullbright: true });
    sprite(G, { id: "desk", x: 3.5, y: 2.2, spr: "desk", w: 0.84, h: 0.56, solid: 0.42 });
    sprite(G, { id: "covered1", x: 2.6, y: 13.2, spr: "covered", w: 0.55, h: 0.5, solid: 0.3 });
    sprite(G, { id: "covered2", x: 5.2, y: 14.6, spr: "covered", w: 0.7, h: 0.6, solid: 0.35 });
    sprite(G, { id: "storeCrate", x: 5.4, y: 12.4, spr: "crate", w: 0.4, h: 0.4, solid: 0.2 });
    sprite(G, { id: "kclock", x: 23.6, y: 12.7, spr: "kclock", w: 0.16, h: 0.08 });
    sprite(G, { id: "lantern", x: 15.5, y: 1.6, spr: "lantern", w: 0.12, h: 0.18 });
    sprite(G, { id: "lanternFlame", x: 15.5, y: 1.59, spr: "flame", w: 0.03, h: 0.05, z: 0.065, fullbright: true, visible: false });
    sprite(G, { id: "verChair", x: 17.3, y: 14.6, spr: "chair", w: 0.28, h: 0.38, solid: 0.16 });
    [0.31, 0.5, 0.69].forEach((o, i) => sprite(G, { id: "diya" + i, x: 22 + o, y: 1.03, spr: "flame", w: 0.045, h: 0.06, z: 0.255, fullbright: true }));
    
    sprite(G, { id: "fallen1", x: 9.0, y: 15.0, spr: "chair_fallen", w: 0.36, h: 0.27, solid: 0.28, visible: false });
    sprite(G, { id: "fallen2", x: 17.0, y: 9.5, spr: "chair_fallen", w: 0.36, h: 0.27, solid: 0.28, visible: false });

    /* ---------- UPPER FLOOR ---------- */
    door(U, { id: "nurseryDoor", x: 3, y: 5, axis: "x", side: 1, hinge: 0, tex: "d_room", open: 0.25, target: 0.25 });
    door(U, { id: "bathDoor", x: 9, y: 5, axis: "x", side: 1, hinge: 1, tex: "d_plain" });
    door(U, { id: "bedDoor", x: 15, y: 5, axis: "x", side: 1, hinge: 0, tex: "d_room", open: 1, target: 1 });
    door(U, { id: "bathBedDoor", x: 11, y: 3, axis: "y", side: 0, hinge: 0, tex: "d_plain", open: 0.4, target: 0.4 });
    door(U, { id: "atticDoor", x: 5, y: 7, axis: "x", side: 0, hinge: 0, tex: "d_attic", locked: true, key: "never", lockMsg: "Locked. Something on the other side scratches back." });

    decal(U, 6, 5, "S", "portrait", { kind: "man", variant: "normal", label: "RAVI" }, "pRavi");
    decal(U, 12, 5, "S", "portrait", { kind: "woman", variant: "normal", label: "KAMLA" }, "pKamla");
    decal(U, 17, 5, "S", "portrait", { kind: "girl", variant: "normal", label: "MISTY" }, "pMisty");
    decal(U, 9, 7, "N", "photos", { seed: 31 });
    decal(U, 2, 0, "S", "drawing", { n: 1, tilt: -1 }, "drawing1");
    decal(U, 6, 0, "S", "drawing", { n: 2, tilt: 1 }, "drawing2");
    decal(U, 9, 0, "S", "mirror", { basin: true, cracked: false, figure: false }, "bathMirror");
    decal(U, 14, 0, "S", "wardrobe", {}, "wardrobe");
    decal(U, 12, 4, "E", "photos", { seed: 41 });

    U.rows.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch !== "J") return;
        for (let f = 0; f < 4; f++) { const nx = x + FDX[f], ny = y + FDY[f]; if (zoneAt(U, nx, ny)) light(U, { kind: "moon", x: nx + 0.5 - FDX[f] * 0.35, y: ny + 0.5 - FDY[f] * 0.35, r: 4.4, col: moon, i: 0.85 }); }
    }));
    [["u_corrW", 4.5, 6.5], ["u_corrE", 14.5, 6.5], ["u_nursery", 3.5, 2.5], ["u_bath", 9.5, 2.5], ["u_bed", 15.5, 2.8]]
        .forEach(([id, x, y]) => { light(U, { id, x, y, r: 5, col: bulb, i: 1.0, on: false, flicker: "bulb", bulb: true }); sprite(U, { id: id + "_s", x, y, spr: "bulb", w: 0.07, h: 0.28, z: U.cfg.wallH - 0.28 }); });

    sprite(U, { id: "kidbed", x: 2.0, y: 1.6, spr: "kidbed", w: 0.6, h: 0.45, solid: 0.36 });
    sprite(U, { id: "doll", x: 2.0, y: 1.62, spr: "doll", w: 0.14, h: 0.14, z: 0.19 });
    sprite(U, { id: "toychest", x: 5.4, y: 1.5, spr: "toychest", w: 0.4, h: 0.3, solid: 0.24 });
    sprite(U, { id: "horse", x: 4.6, y: 3.7, spr: "horse", w: 0.34, h: 0.34, solid: 0.2 });
    sprite(U, { id: "bathtub", x: 9.0, y: 3.4, spr: "bathtub", w: 0.8, h: 0.8, solid: 0.38 });
    sprite(U, { id: "bed", x: 15.6, y: 1.5, spr: "bed", w: 0.9, h: 0.6, solid: 0.5 });
    sprite(U, { id: "coatstand", x: 18.2, y: 1.6, spr: "coatstand", w: 0.29, h: 0.76, solid: 0.18 });
    sprite(U, { id: "dressing", x: 18.3, y: 4.3, spr: "dressing", w: 0.44, h: 0.66, solid: 0.24 });
    sprite(U, { id: "dollCorridor", x: 12.5, y: 10.4, spr: "doll", w: 0.14, h: 0.14, visible: false });

    /* ---------- BASEMENT ---------- */
    door(B, { id: "steelDoor", x: 5, y: 10, axis: "y", mode: "slide", hinge: 0, tex: "d_steel", locked: true, key: "power", speed: 0.5, lockMsg: "A heavy steel door with an electric lock. The lock is dead." });
    decal(B, 0, 2, "E", "fusebox", { fuse: false, on: false }, "fusebox");
    decal(B, 4, 9, "E", "switchPanel", {}, null);
    decal(B, 0, 11, "E", "chains", {});
    decal(B, 2, 8, "S", "scratches", { kind: "tally", seed: 3 });
    decal(B, 4, 8, "S", "scratches", { kind: "text", text: "3:17 3:17\n3:17  3:17\n 3:17 3:17\n3:17 3:17", size: 11, x: 8, y: 34, seed: 9 });
    decal(B, 0, 9, "E", "photos", { seed: 51, scratched: true, pinned: true });
    decal(B, 0, 10, "E", "keyring", { taken: false }, "keyring");
    decal(B, 2, 13, "N", "scratches", { kind: "text", text: "THEY PUT ME\nBELOW THE\nLIGHT\n\nNOBODY LEAVES", size: 10, x: 14, y: 30, seed: 11 });
    light(B, { id: "cellarSpill", x: 2.5, y: 1.2, r: 2.8, col: [0.6, 0.5, 0.4], i: 0.35, kind: "static" });
    [["c_landing", 2.5, 2.5], ["c_store1", 11.5, 1.5], ["c_store2", 8.5, 6.5], ["c_corr", 8.5, 10.5], ["c_ravi", 2.5, 10.5]]
        .forEach(([id, x, y]) => { light(B, { id, x, y, r: 5, col: bulb, i: 1.0, on: false, flicker: "bulb", bulb: true }); sprite(B, { id: id + "_s", x, y, spr: "bulb", w: 0.07, h: 0.26, z: B.cfg.wallH - 0.26 }); });
    sprite(B, { id: "cot", x: 2.4, y: 12.2, spr: "cot", w: 0.78, h: 0.52, solid: 0.42 });
    sprite(B, { id: "bowl", x: 3.7, y: 11.4, spr: "bowl", w: 0.13, h: 0.065 });
    sprite(B, { id: "bcrate1", x: 3.6, y: 3.4, spr: "crate", w: 0.42, h: 0.42, solid: 0.22 });

    [G, U, B].forEach(F => { buildFaces(F); W.bakeLights(F); });
};

/* stair links: walking into these faces moves you between floors */
W.stairs = [
    { from: "ground", x: 12, y: 0, face: "S", to: "upper", at: [1.5, 6.5], angle: 0, label: "Go upstairs" },
    { from: "upper", x: 0, y: 6, face: "E", to: "ground", at: [12.5, 1.5], angle: Math.PI / 2, label: "Go downstairs" },
    { from: "ground", x: 22, y: 18, face: "N", to: "basement", at: [2.5, 1.4], angle: Math.PI / 2, label: "Go down to the cellar" },
    { from: "basement", x: 2, y: 0, face: "S", to: "ground", at: [22.5, 17.4], angle: -Math.PI / 2, label: "Go back up" }
];

W.surfaceAt = function (F, x, y) { const z = zoneAt(F, Math.floor(x), Math.floor(y)); return z ? z.surf : "wood"; };
W.roomAt = function (F, x, y) { const z = zoneAt(F, Math.floor(x), Math.floor(y)); return z ? z.name : ""; };

})();
