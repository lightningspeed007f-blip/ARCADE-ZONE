/* =====================================================================
   THE LAST NIGHT — procedural art
   Every wall, floor, decal and prop is painted here at load time so the
   house has one consistent, slightly grimy look (no stock assets except
   the ghost silhouette, which is cut out of ghost.png).
   ===================================================================== */
(function () {
"use strict";
const LN = window.LN = window.LN || {};
const ART = LN.art = {};

/* ---------- helpers ---------- */
function rng(seed) {
    return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
ART.rng = rng;

function cv(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
function g2(c) { return c.getContext("2d", { willReadFrequently: true }); }
function toTex(c) {
    const d = g2(c).getImageData(0, 0, c.width, c.height).data;
    return { w: c.width, h: c.height, d };
}
ART.toTex = toTex;
ART.canvas = cv;

function rgb(r, g, b, a) { return a === undefined ? `rgb(${r|0},${g|0},${b|0})` : `rgba(${r|0},${g|0},${b|0},${a})`; }

/* value noise for stains */
function makeNoise(seed, size) {
    const r = rng(seed), n = size || 16, grid = new Float32Array(n * n);
    for (let i = 0; i < grid.length; i++) grid[i] = r();
    return function (x, y) {
        const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
        const a = grid[((yi % n + n) % n) * n + ((xi % n + n) % n)];
        const b = grid[((yi % n + n) % n) * n + (((xi + 1) % n + n) % n)];
        const c = grid[(((yi + 1) % n + n) % n) * n + ((xi % n + n) % n)];
        const d = grid[(((yi + 1) % n + n) % n) * n + (((xi + 1) % n + n) % n)];
        const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
        return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
    };
}
function fbm(noise, x, y) { return noise(x, y) * 0.55 + noise(x * 2.1, y * 2.1) * 0.3 + noise(x * 4.3, y * 4.3) * 0.15; }

/* per-pixel grit + optional stain field */
function grit(c, amount, seed, stain) {
    const ctx = g2(c), img = ctx.getImageData(0, 0, c.width, c.height), d = img.data, r = rng(seed);
    const nz = makeNoise(seed + 7, 16);
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        if (d[i + 3] === 0) continue;
        let k = 1 + (r() - 0.5) * amount;
        if (stain) {
            const s = fbm(nz, x / c.width * 4, y / c.height * 4);
            k *= 1 - Math.max(0, s - 0.45) * stain;
        }
        d[i] *= k; d[i + 1] *= k; d[i + 2] *= k;
    }
    ctx.putImageData(img, 0, 0);
}

function cracks(ctx, r, n, w, h, col) {
    ctx.strokeStyle = col || "rgba(20,14,10,0.55)";
    ctx.lineWidth = 1;
    for (let k = 0; k < n; k++) {
        let x = r() * w, y = r() * h * 0.8;
        ctx.beginPath(); ctx.moveTo(x, y);
        const len = 6 + r() * 18;
        for (let s = 0; s < len; s++) {
            x += (r() - 0.5) * 4; y += 1 + r() * 2;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
}

/* water seepage streaks from the ceiling */
function seepage(ctx, r, w, h, strength) {
    for (let k = 0; k < 5; k++) {
        const x = r() * w, len = h * (0.2 + r() * 0.55), wd = 3 + r() * 10;
        const gr = ctx.createLinearGradient(0, 0, 0, len);
        gr.addColorStop(0, `rgba(40,30,15,${0.35 * strength})`);
        gr.addColorStop(1, "rgba(40,30,15,0)");
        ctx.fillStyle = gr;
        ctx.fillRect(x, 0, wd, len);
    }
}

/* ======================================================================
   WALL BASES (128x128)
   ====================================================================== */
const WALL = 128;
const baseCanvases = {};
ART.tex = {};

function plaster(name, o) {
    const c = cv(WALL, WALL), ctx = g2(c), r = rng(o.seed || 1);
    ctx.fillStyle = rgb(...o.base); ctx.fillRect(0, 0, WALL, WALL);
    // limewash blotches
    const nz = makeNoise((o.seed || 1) * 3, 8);
    const img = ctx.getImageData(0, 0, WALL, WALL), d = img.data;
    for (let y = 0; y < WALL; y++) for (let x = 0; x < WALL; x++) {
        const v = fbm(nz, x / 32, y / 32) - 0.5, i = (y * WALL + x) * 4;
        d[i] += v * 30; d[i + 1] += v * 28; d[i + 2] += v * 22;
    }
    ctx.putImageData(img, 0, 0);
    if (o.dado) {
        ctx.fillStyle = rgb(...o.dado); ctx.fillRect(0, 84, WALL, 34);
        ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, 84, WALL, 2);
        ctx.fillStyle = "rgba(255,240,210,0.12)"; ctx.fillRect(0, 86, WALL, 1);
    }
    // cornice
    ctx.fillStyle = "rgba(255,245,225,0.10)"; ctx.fillRect(0, 0, WALL, 7);
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, 7, WALL, 2);
    // skirting
    ctx.fillStyle = rgb(...(o.skirt || [52, 36, 26])); ctx.fillRect(0, 118, WALL, 10);
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(0, 117, WALL, 1);
    seepage(ctx, r, WALL, WALL, o.seep === undefined ? 1 : o.seep);
    cracks(ctx, r, o.cracks || 3, WALL, WALL);
    if (o.peel) { // exposed brick where plaster fell
        for (let k = 0; k < o.peel; k++) {
            const x = r() * 100, y = 20 + r() * 70, w = 10 + r() * 18, h = 6 + r() * 12;
            ctx.fillStyle = "rgb(96,52,38)"; ctx.fillRect(x, y, w, h);
            ctx.fillStyle = "rgba(40,22,16,0.8)";
            for (let yy = y; yy < y + h; yy += 4) ctx.fillRect(x, yy, w, 1);
            ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.strokeRect(x, y, w, h);
        }
    }
    grit(c, 0.16, o.seed || 1, o.stain === undefined ? 0.7 : o.stain);
    baseCanvases[name] = c; ART.tex[name] = toTex(c);
}

function wallpaper(name, o) {
    const c = cv(WALL, WALL), ctx = g2(c), r = rng(o.seed || 2);
    ctx.fillStyle = rgb(...o.base); ctx.fillRect(0, 0, WALL, WALL);
    ctx.fillStyle = rgb(...o.motif);
    if (o.pattern === "damask") {
        for (let y = -8; y < WALL; y += 24) for (let x = 0; x < WALL; x += 32) {
            const ox = (Math.floor(y / 24) % 2) * 16;
            ctx.beginPath();
            ctx.ellipse(x + ox + 8, y + 12, 4, 8, 0, 0, Math.PI * 2);
            ctx.moveTo(x + ox + 8, y + 1); ctx.lineTo(x + ox + 13, y + 6); ctx.lineTo(x + ox + 8, y + 9); ctx.lineTo(x + ox + 3, y + 6);
            ctx.fill();
            ctx.fillRect(x + ox + 1, y + 12, 14, 1);
        }
    } else if (o.pattern === "stripe") {
        for (let x = 0; x < WALL; x += 16) { ctx.fillRect(x, 0, 5, WALL); ctx.fillRect(x + 8, 0, 1, WALL); }
    } else if (o.pattern === "floral") {
        for (let y = 4; y < WALL; y += 20) for (let x = 4; x < WALL; x += 20) {
            const ox = (Math.floor(y / 20) % 2) * 10;
            for (let p = 0; p < 5; p++) {
                const a = p / 5 * Math.PI * 2;
                ctx.beginPath(); ctx.arc(x + ox + Math.cos(a) * 3, y + Math.sin(a) * 3, 2, 0, Math.PI * 2); ctx.fill();
            }
        }
    } else if (o.pattern === "stars") {
        for (let y = 6; y < WALL; y += 22) for (let x = 6; x < WALL; x += 22) {
            const ox = (Math.floor(y / 22) % 2) * 11;
            ctx.beginPath();
            for (let p = 0; p < 10; p++) {
                const a = p / 10 * Math.PI * 2 - Math.PI / 2, rr = p % 2 ? 1.6 : 4;
                ctx.lineTo(x + ox + Math.cos(a) * rr, y + Math.sin(a) * rr);
            }
            ctx.fill();
        }
    }
    // seams
    ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(63, 0, 1, WALL);
    // dado: dark wood lower panel
    if (o.dado) {
        ctx.fillStyle = rgb(...o.dado); ctx.fillRect(0, 80, WALL, 48);
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        for (let x = 4; x < WALL; x += 32) ctx.strokeRect(x + 0.5, 88.5, 24, 24);
        ctx.fillStyle = "rgba(255,220,170,0.10)"; ctx.fillRect(0, 80, WALL, 2);
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 82, WALL, 1);
    }
    ctx.fillStyle = "rgba(0,0,0,0.30)"; ctx.fillRect(0, 0, WALL, 3);
    ctx.fillStyle = rgb(40, 26, 18); ctx.fillRect(0, 120, WALL, 8);
    // peeling corner + water damage
    if (o.peel && o.peelOn) {
        ctx.fillStyle = rgb(...(o.under || [150, 138, 110]));
        ctx.beginPath(); ctx.moveTo(90, 0); ctx.lineTo(128, 0); ctx.lineTo(128, 30); ctx.quadraticCurveTo(110, 26, 98, 12); ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath(); ctx.moveTo(98, 12); ctx.quadraticCurveTo(110, 26, 128, 30); ctx.lineTo(128, 33); ctx.quadraticCurveTo(108, 30, 96, 14); ctx.fill();
    }
    seepage(ctx, r, WALL, 80, 1.2);
    grit(c, 0.14, o.seed || 2, 0.8);
    baseCanvases[name] = c; ART.tex[name] = toTex(c);
}

function panel(name, o) {
    const c = cv(WALL, WALL), ctx = g2(c), r = rng(o.seed || 3);
    ctx.fillStyle = rgb(...o.base); ctx.fillRect(0, 0, WALL, WALL);
    // vertical boards with grain
    for (let x = 0; x < WALL; x += 16) {
        ctx.fillStyle = `rgba(0,0,0,${0.08 + r() * 0.12})`; ctx.fillRect(x, 0, 16, WALL);
        ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(x, 0, 1, WALL);
        ctx.strokeStyle = "rgba(0,0,0,0.12)";
        for (let k = 0; k < 4; k++) {
            ctx.beginPath(); let gx = x + 2 + r() * 12; ctx.moveTo(gx, 0);
            for (let y = 0; y < WALL; y += 8) { gx += (r() - 0.5) * 1.5; ctx.lineTo(gx, y); }
            ctx.stroke();
        }
    }
    // raised panels
    ctx.strokeStyle = "rgba(255,220,170,0.10)"; ctx.lineWidth = 2;
    ctx.strokeRect(10, 14, 108, 54); ctx.strokeRect(10, 78, 108, 34);
    ctx.strokeStyle = "rgba(0,0,0,0.45)"; ctx.lineWidth = 1;
    ctx.strokeRect(12.5, 16.5, 104, 50); ctx.strokeRect(12.5, 80.5, 104, 30);
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 0, WALL, 5); ctx.fillRect(0, 120, WALL, 8);
    grit(c, 0.12, o.seed || 3, 0.4);
    baseCanvases[name] = c; ART.tex[name] = toTex(c);
}

function tiles(name, o) {
    const c = cv(WALL, WALL), ctx = g2(c), r = rng(o.seed || 4);
    const top = o.upper ? o.upperH : 0;
    if (o.upper) {
        ctx.fillStyle = rgb(...o.upper); ctx.fillRect(0, 0, WALL, top);
        seepage(ctx, r, WALL, top, 1.5);
    }
    const s = o.size || 16;
    for (let y = top; y < WALL; y += s) for (let x = 0; x < WALL; x += s) {
        const v = (r() - 0.5) * 18;
        ctx.fillStyle = rgb(o.base[0] + v, o.base[1] + v, o.base[2] + v);
        ctx.fillRect(x, y, s, s);
        ctx.fillStyle = "rgba(255,255,255,0.10)"; ctx.fillRect(x + 1, y + 1, s - 3, 2);
        if (r() < 0.08) { // cracked or missing
            if (r() < 0.4) { ctx.fillStyle = "rgb(70,62,52)"; ctx.fillRect(x, y, s, s); }
            else { ctx.strokeStyle = "rgba(20,20,20,0.6)"; ctx.beginPath(); ctx.moveTo(x + r() * s, y); ctx.lineTo(x + r() * s, y + s); ctx.stroke(); }
        }
    }
    ctx.fillStyle = rgb(...o.grout);
    for (let y = top; y < WALL; y += s) ctx.fillRect(0, y, WALL, 1);
    for (let x = 0; x < WALL; x += s) ctx.fillRect(x, top, 1, WALL - top);
    // grime rising from floor
    const gr = ctx.createLinearGradient(0, 80, 0, WALL);
    gr.addColorStop(0, "rgba(40,30,20,0)"); gr.addColorStop(1, "rgba(40,30,20,0.55)");
    ctx.fillStyle = gr; ctx.fillRect(0, 80, WALL, 48);
    if (o.soot) { const sg = ctx.createLinearGradient(0, 0, 0, 60); sg.addColorStop(0, "rgba(10,8,6,0.6)"); sg.addColorStop(1, "rgba(10,8,6,0)"); ctx.fillStyle = sg; ctx.fillRect(0, 0, WALL, 60); }
    grit(c, 0.12, o.seed || 4, 0.5);
    baseCanvases[name] = c; ART.tex[name] = toTex(c);
}

function brick(name, o) {
    const c = cv(WALL, WALL), ctx = g2(c), r = rng(o.seed || 5);
    ctx.fillStyle = rgb(...o.mortar); ctx.fillRect(0, 0, WALL, WALL);
    for (let y = 0; y < WALL; y += 10) {
        const off = (y / 10) % 2 ? 0 : 12;
        for (let x = -24; x < WALL; x += 24) {
            const v = (r() - 0.5) * 30;
            ctx.fillStyle = rgb(o.base[0] + v, o.base[1] + v * 0.6, o.base[2] + v * 0.5);
            ctx.fillRect(x + off + 1, y + 1, 22, 8);
            ctx.fillStyle = "rgba(255,230,200,0.08)"; ctx.fillRect(x + off + 1, y + 1, 22, 1);
        }
    }
    // damp + efflorescence
    const gr = ctx.createLinearGradient(0, 60, 0, WALL);
    gr.addColorStop(0, "rgba(10,14,10,0)"); gr.addColorStop(1, "rgba(10,14,10,0.6)");
    ctx.fillStyle = gr; ctx.fillRect(0, 60, WALL, 68);
    for (let k = 0; k < 6; k++) {
        ctx.fillStyle = "rgba(200,200,190,0.12)";
        ctx.fillRect(r() * WALL, 70 + r() * 30, 2 + r() * 6, 10 + r() * 30);
    }
    grit(c, 0.18, o.seed || 5, 0.8);
    baseCanvases[name] = c; ART.tex[name] = toTex(c);
}

function crates(name, seed) {
    const c = cv(WALL, WALL), ctx = g2(c), r = rng(seed);
    ctx.fillStyle = "rgb(18,14,10)"; ctx.fillRect(0, 0, WALL, WALL);
    const rows = [[0, 44], [44, 42], [86, 42]];
    rows.forEach(([y, h], ri) => {
        let x = (ri % 2) * -20;
        while (x < WALL) {
            const w = 36 + r() * 30;
            if (r() < 0.25 && ri === 0) { x += w; continue; } // gap at top: darkness
            const sack = r() < 0.25;
            if (sack) {
                ctx.fillStyle = rgb(120 + r() * 20, 104, 74);
                ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2 + 2, w / 2 - 2, h / 2 - 2, 0, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.moveTo(x + w / 2, y + 6); ctx.lineTo(x + w / 2 + 3, y + h - 6); ctx.stroke();
            } else {
                const v = r() * 30;
                ctx.fillStyle = rgb(108 + v, 80 + v * 0.7, 50 + v * 0.4); ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
                ctx.fillStyle = "rgba(0,0,0,0.25)";
                for (let yy = y + 8; yy < y + h - 2; yy += 9) ctx.fillRect(x + 1, yy, w - 2, 1);
                ctx.strokeStyle = "rgba(40,26,14,0.9)"; ctx.lineWidth = 3;
                ctx.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
                ctx.beginPath(); ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + w - 3, y + h - 3); ctx.stroke();
                ctx.lineWidth = 1;
                if (r() < 0.4) { ctx.fillStyle = "rgba(20,10,5,0.6)"; ctx.font = "bold 9px monospace"; ctx.fillText(["NO.3", "AAM", "1986", "R.M."][Math.floor(r() * 4)], x + 8, y + h / 2 + 3); }
            }
            x += w;
        }
    });
    grit(c, 0.2, seed, 0.6);
    baseCanvases[name] = c; ART.tex[name] = toTex(c);
}

function stonePillar(name) {
    const c = cv(WALL, WALL), ctx = g2(c), r = rng(9);
    ctx.fillStyle = "rgb(150,118,86)"; ctx.fillRect(0, 0, WALL, WALL);
    for (let y = 0; y < WALL; y += 16) { ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(0, y, WALL, 1); }
    // carved capital and base
    ctx.fillStyle = "rgb(120,92,66)"; ctx.fillRect(0, 0, WALL, 14); ctx.fillRect(0, 108, WALL, 20);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    for (let x = 4; x < WALL; x += 12) { ctx.beginPath(); ctx.arc(x + 4, 8, 4, Math.PI, 0); ctx.fill(); }
    // flutes
    for (let x = 8; x < WALL; x += 16) { ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(x, 16, 4, 90); ctx.fillStyle = "rgba(255,230,190,0.10)"; ctx.fillRect(x + 4, 16, 1, 90); }
    // rain darkening at the bottom
    const gr = ctx.createLinearGradient(0, 70, 0, WALL); gr.addColorStop(0, "rgba(20,20,30,0)"); gr.addColorStop(1, "rgba(20,20,30,0.5)");
    ctx.fillStyle = gr; ctx.fillRect(0, 70, WALL, 58);
    cracks(ctx, r, 3, WALL, WALL);
    grit(c, 0.18, 9, 0.6);
    baseCanvases[name] = c; ART.tex[name] = toTex(c);
}

/* jaali / shuttered window. The night outside is painted bright so the
   room light ("moonlight") reads through it. */
function windowTex(name, kind, wallName) {
    const c = cv(WALL, WALL), ctx = g2(c), r = rng(11);
    ctx.drawImage(baseCanvases[wallName], 0, 0);
    const x0 = 30, y0 = 18, w = 68, h = 78;
    // night sky through the opening
    const sky = ctx.createLinearGradient(0, y0, 0, y0 + h);
    sky.addColorStop(0, "rgb(70,86,112)"); sky.addColorStop(1, "rgb(36,44,60)");
    ctx.fillStyle = sky;
    ctx.beginPath(); ctx.moveTo(x0, y0 + h); ctx.lineTo(x0, y0 + 20); ctx.quadraticCurveTo(x0 + w / 2, y0 - 12, x0 + w, y0 + 20); ctx.lineTo(x0 + w, y0 + h); ctx.fill();
    // tree silhouette / rain
    ctx.fillStyle = "rgb(18,22,28)";
    ctx.beginPath(); ctx.moveTo(x0, y0 + h); ctx.quadraticCurveTo(x0 + 20, y0 + 40, x0 + 30, y0 + 50); ctx.quadraticCurveTo(x0 + 50, y0 + 60, x0 + w, y0 + 52); ctx.lineTo(x0 + w, y0 + h); ctx.fill();
    ctx.strokeStyle = "rgba(200,210,230,0.22)";
    for (let k = 0; k < 26; k++) { const rx = x0 + r() * w, ry = y0 + r() * h; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 1, ry + 6); ctx.stroke(); }
    if (kind === "jaali") {
        ctx.strokeStyle = "rgb(110,84,62)"; ctx.lineWidth = 3;
        for (let k = -80; k < 120; k += 10) {
            ctx.beginPath(); ctx.moveTo(x0 + k, y0 - 10); ctx.lineTo(x0 + k + 90, y0 + h + 10); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x0 + k + 90, y0 - 10); ctx.lineTo(x0 + k, y0 + h + 10); ctx.stroke();
        }
        ctx.lineWidth = 1;
        // re-cut the arch outline
        ctx.drawImage(maskOutside(baseCanvases[wallName], x0, y0, w, h), 0, 0);
    } else {
        // wooden frame with bars (old Indian window)
        ctx.fillStyle = "rgb(58,40,26)";
        ctx.fillRect(x0 - 3, y0 + 18, 3, h - 18); ctx.fillRect(x0 + w, y0 + 18, 3, h - 18);
        ctx.fillRect(x0 - 3, y0 + h, w + 6, 4);
        ctx.fillRect(x0 + w / 2 - 1, y0 + 4, 3, h);
        ctx.fillStyle = "rgb(70,64,60)";
        for (let x = x0 + 8; x < x0 + w; x += 10) ctx.fillRect(x, y0 + 8, 2, h - 8);
        ctx.fillStyle = "rgba(160,190,220,0.12)"; ctx.fillRect(x0 + 4, y0 + 22, 20, 30);
    }
    // sill
    ctx.fillStyle = "rgb(96,76,56)"; ctx.fillRect(x0 - 6, y0 + h + 2, w + 12, 5);
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(x0 - 6, y0 + h + 7, w + 12, 2);
    baseCanvases[name] = c; ART.tex[name] = toTex(c);
    ART.tex[name].gm = skyMask(ART.tex[name]);
    windowBases[name] = true;
}
const windowBases = {};
/* pixels of the night sky seen through a window glow on their own */
function skyMask(t) {
    const m = new Uint8Array(t.w * t.h), d = t.d;
    for (let i = 0; i < m.length; i++) { const r = d[i * 4], b = d[i * 4 + 2]; if (b > r + 14 && b > 48) m[i] = 1; }
    return m;
}
function maskOutside(base, x0, y0, w, h) {
    const m = cv(WALL, WALL), mc = g2(m);
    mc.drawImage(base, 0, 0);
    mc.globalCompositeOperation = "destination-out";
    mc.beginPath(); mc.moveTo(x0, y0 + h); mc.lineTo(x0, y0 + 20); mc.quadraticCurveTo(x0 + w / 2, y0 - 12, x0 + w, y0 + 20); mc.lineTo(x0 + w, y0 + h); mc.fill();
    mc.globalCompositeOperation = "source-over";
    mc.strokeStyle = "rgb(90,68,50)"; mc.lineWidth = 4;
    mc.beginPath(); mc.moveTo(x0, y0 + h); mc.lineTo(x0, y0 + 20); mc.quadraticCurveTo(x0 + w / 2, y0 - 12, x0 + w, y0 + 20); mc.lineTo(x0 + w, y0 + h); mc.stroke();
    return m;
}

function stairsTex(name, dir, wallName) {
    const c = cv(WALL, WALL), ctx = g2(c);
    ctx.drawImage(baseCanvases[wallName], 0, 0);
    const x0 = 14, x1 = 114;
    ctx.fillStyle = "rgb(6,5,4)"; ctx.fillRect(x0, 4, x1 - x0, 124);
    if (dir === "up") {
        // steps rising away into darkness
        for (let i = 0; i < 12; i++) {
            const y = 124 - i * 9.5, sh = 1 - i / 13;
            ctx.fillStyle = rgb(96 * sh, 70 * sh, 48 * sh); ctx.fillRect(x0 + 4, y - 9, x1 - x0 - 8, 9);
            ctx.fillStyle = rgb(140 * sh, 104 * sh, 72 * sh); ctx.fillRect(x0 + 4, y - 9, x1 - x0 - 8, 2);
        }
        // banister
        ctx.strokeStyle = "rgb(60,40,26)"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(x1 - 6, 70); ctx.lineTo(x1 - 6, 10); ctx.stroke();
        ctx.lineWidth = 2;
        for (let y = 78; y < 124; y += 9) { ctx.beginPath(); ctx.moveTo(x1 - 12, y); ctx.lineTo(x1 - 12, y - 20); ctx.stroke(); }
        ctx.lineWidth = 1;
        const dark = ctx.createLinearGradient(0, 4, 0, 70); dark.addColorStop(0, "rgba(0,0,0,1)"); dark.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = dark; ctx.fillRect(x0, 4, x1 - x0, 70);
    } else {
        // steps dropping away below: the top step at the bottom edge, the rest vanish
        for (let i = 0; i < 6; i++) {
            const y = 128 - i * 5, sh = Math.max(0, 0.8 - i * 0.18);
            ctx.fillStyle = rgb(110 * sh, 100 * sh, 88 * sh); ctx.fillRect(x0 + 4, y - 5, x1 - x0 - 8, 5);
        }
        ctx.fillStyle = "rgb(58,40,26)"; ctx.fillRect(x0 + 2, 60, 4, 68); ctx.fillRect(x0 + 2, 60, 30, 4);
    }
    // frame
    ctx.strokeStyle = "rgb(70,50,34)"; ctx.lineWidth = 4; ctx.strokeRect(x0, 4, x1 - x0, 126); ctx.lineWidth = 1;
    baseCanvases[name] = c; ART.tex[name] = toTex(c);
}

/* ======================================================================
   DOOR LEAVES & FRAMES (128x128, full height)
   ====================================================================== */
function doorLeaf(name, o) {
    const c = cv(WALL, WALL), ctx = g2(c), r = rng(o.seed || 21);
    ctx.fillStyle = rgb(...o.base); ctx.fillRect(0, 0, WALL, WALL);
    for (let x = 0; x < WALL; x += 8) { ctx.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.1})`; ctx.fillRect(x, 0, 8, WALL); }
    if (o.panels) {
        ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 2;
        ctx.strokeRect(14, 10, 100, 48); ctx.strokeRect(14, 66, 100, 52);
        ctx.strokeStyle = "rgba(255,220,160,0.12)"; ctx.strokeRect(17, 13, 94, 42); ctx.strokeRect(17, 69, 94, 46);
        ctx.lineWidth = 1;
    }
    if (o.carved) {
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        for (let y = 20; y < 120; y += 24) for (let x = 24; x < 110; x += 24) { ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = "rgb(150,120,70)";
        for (let y = 8; y < 124; y += 12) { ctx.fillRect(4, y, 3, 3); ctx.fillRect(121, y, 3, 3); }
    }
    if (o.planks) {
        ctx.fillStyle = "rgba(0,0,0,0.5)"; for (let x = 0; x < WALL; x += 21) ctx.fillRect(x, 0, 1, WALL);
        ctx.fillStyle = rgb(o.base[0] * 0.8, o.base[1] * 0.8, o.base[2] * 0.8); ctx.fillRect(0, 22, WALL, 10); ctx.fillRect(0, 96, WALL, 10);
    }
    // handle
    ctx.fillStyle = "rgb(150,120,64)"; ctx.fillRect(o.handleX || 104, 66, 6, 10);
    ctx.fillStyle = "rgb(20,16,10)"; ctx.fillRect((o.handleX || 104) + 2, 78, 2, 4);
    if (o.plate) { ctx.fillStyle = "rgb(160,130,70)"; ctx.fillRect(46, 30, 36, 10); ctx.fillStyle = "rgb(30,20,10)"; ctx.font = "bold 7px serif"; ctx.fillText(o.plate, 50, 38); }
    if (o.scratches) {
        ctx.strokeStyle = "rgba(220,200,170,0.35)";
        for (let k = 0; k < 14; k++) { const x = 20 + r() * 90, y = 60 + r() * 50; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 6, y + 10 + r() * 14); ctx.stroke(); }
    }
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, 0, 2, WALL); ctx.fillRect(126, 0, 2, WALL);
    grit(c, 0.12, o.seed || 21, 0.5);
    if (o.extra) o.extra(ctx, r);
    baseCanvases[name] = c; ART.tex[name] = toTex(c);
}

function gateTex(name) {
    const c = cv(WALL, WALL), ctx = g2(c);
    ctx.fillStyle = "rgb(4,3,3)"; ctx.fillRect(0, 0, WALL, WALL);
    // faint stairs beyond
    for (let i = 0; i < 8; i++) { const y = 128 - i * 12, s = 0.35 - i * 0.04; ctx.fillStyle = rgb(90 * s, 70 * s, 50 * s); ctx.fillRect(10, y - 12, 108, 3); }
    ctx.fillStyle = "rgb(46,44,42)";
    for (let x = 6; x < WALL; x += 12) ctx.fillRect(x, 0, 3, WALL);
    ctx.fillRect(0, 8, WALL, 4); ctx.fillRect(0, 62, WALL, 4); ctx.fillRect(0, 116, WALL, 4);
    ctx.fillStyle = "rgba(255,255,255,0.12)"; for (let x = 6; x < WALL; x += 12) ctx.fillRect(x, 0, 1, WALL);
    // padlock
    ctx.fillStyle = "rgb(120,96,48)"; ctx.fillRect(56, 66, 14, 12);
    ctx.strokeStyle = "rgb(110,110,110)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(63, 66, 5, Math.PI, 0); ctx.stroke(); ctx.lineWidth = 1;
    grit(c, 0.15, 33, 0.4);
    baseCanvases[name] = c; ART.tex[name] = toTex(c);
}

function steelDoor(name, light) {
    const c = cv(WALL, WALL), ctx = g2(c);
    ctx.fillStyle = "rgb(84,88,86)"; ctx.fillRect(0, 0, WALL, WALL);
    for (let y = 0; y < WALL; y += 32) { ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, y, WALL, 1); ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(0, y + 1, WALL, 1); }
    ctx.fillStyle = "rgb(50,52,50)"; for (let y = 6; y < WALL; y += 16) { ctx.fillRect(4, y, 3, 3); ctx.fillRect(121, y, 3, 3); }
    // rust
    const r = rng(41);
    for (let k = 0; k < 18; k++) { ctx.fillStyle = `rgba(110,52,24,${0.2 + r() * 0.4})`; ctx.fillRect(r() * 120, 80 + r() * 46, 3 + r() * 8, 2 + r() * 10); }
    // lock box
    ctx.fillStyle = "rgb(30,30,30)"; ctx.fillRect(98, 52, 18, 26);
    ctx.fillStyle = light === "green" ? "rgb(80,255,120)" : light === "red" ? "rgb(255,40,30)" : "rgb(50,20,18)";
    ctx.fillRect(104, 56, 6, 4);
    ctx.fillStyle = "rgb(140,140,130)"; ctx.fillRect(102, 66, 10, 8);
    grit(c, 0.14, 41, 0.6);
    baseCanvases[name] = c; ART.tex[name] = toTex(c);
}

function jamb(name) {
    const c = cv(WALL, WALL), ctx = g2(c);
    ctx.fillStyle = "rgb(70,48,30)"; ctx.fillRect(0, 0, WALL, WALL);
    for (let x = 0; x < WALL; x += 32) { ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(x, 0, 1, WALL); }
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(0, 0, WALL, 6);
    grit(c, 0.15, 51, 0.4);
    baseCanvases[name] = c; ART.tex[name] = toTex(c);
}

/* ======================================================================
   FLOORS & CEILINGS (64x64)
   ====================================================================== */
const FL = 64;
function floorTex(name, painter, seed, gritAmt, stain) {
    const c = cv(FL, FL), ctx = g2(c), r = rng(seed);
    painter(ctx, r);
    grit(c, gritAmt === undefined ? 0.15 : gritAmt, seed, stain === undefined ? 0.6 : stain);
    ART.tex[name] = toTex(c);
}

function buildFloors() {
    floorTex("fl_redoxide", (ctx, r) => {
        ctx.fillStyle = "rgb(108,40,30)"; ctx.fillRect(0, 0, FL, FL);
        for (let k = 0; k < 40; k++) { ctx.fillStyle = `rgba(255,190,160,${r() * 0.06})`; ctx.fillRect(r() * 64, r() * 64, 6 + r() * 12, 2 + r() * 6); }
        ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, 0, FL, 1); ctx.fillRect(0, 0, 1, FL);
    }, 61, 0.08, 0.5);
    floorTex("fl_athangudi", (ctx, r) => {
        for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
            const x = tx * 32, y = ty * 32;
            ctx.fillStyle = "rgb(150,120,84)"; ctx.fillRect(x, y, 32, 32);
            ctx.fillStyle = "rgb(110,40,34)"; ctx.beginPath(); ctx.moveTo(x + 16, y + 2); ctx.lineTo(x + 30, y + 16); ctx.lineTo(x + 16, y + 30); ctx.lineTo(x + 2, y + 16); ctx.fill();
            ctx.fillStyle = "rgb(40,70,66)"; ctx.beginPath(); ctx.arc(x + 16, y + 16, 7, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "rgb(170,140,96)"; ctx.beginPath(); ctx.arc(x + 16, y + 16, 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "rgb(40,70,66)"; [[0, 0], [32, 0], [0, 32], [32, 32]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(x + a, y + b, 6, 0, Math.PI * 2); ctx.fill(); });
            ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(x, y, 32, 1); ctx.fillRect(x, y, 1, 32);
        }
    }, 62, 0.14, 0.9);
    floorTex("fl_wood", (ctx, r) => {
        for (let y = 0; y < FL; y += 8) {
            const v = r() * 20;
            ctx.fillStyle = rgb(70 + v, 46 + v * 0.7, 30 + v * 0.4); ctx.fillRect(0, y, FL, 8);
            ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, y, FL, 1);
            const j = Math.floor(r() * FL); ctx.fillRect(j, y, 1, 8);
            ctx.fillStyle = "rgba(0,0,0,0.12)"; for (let k = 0; k < 3; k++) ctx.fillRect(0, y + 2 + r() * 5, FL, 1);
        }
    }, 63, 0.12, 0.6);
    floorTex("fl_marble", (ctx, r) => {
        ctx.fillStyle = "rgb(186,180,168)"; ctx.fillRect(0, 0, FL, FL);
        ctx.strokeStyle = "rgba(90,86,80,0.35)";
        for (let k = 0; k < 6; k++) { ctx.beginPath(); let x = r() * 64, y = 0; ctx.moveTo(x, y); while (y < 64) { x += (r() - 0.5) * 10; y += 6; ctx.lineTo(x, y); } ctx.stroke(); }
        ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, 0, FL, 1); ctx.fillRect(0, 0, 1, FL); ctx.fillRect(0, 32, FL, 1); ctx.fillRect(32, 0, 1, FL);
    }, 64, 0.06, 0.8);
    floorTex("fl_stone", (ctx, r) => { // courtyard, wet
        for (let y = 0; y < FL; y += 16) for (let x = -32; x < FL; x += 32) {
            const off = (y / 16) % 2 ? 16 : 0, v = r() * 24;
            ctx.fillStyle = rgb(92 + v, 86 + v, 80 + v); ctx.fillRect(x + off, y, 32, 16);
            ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x + off, y, 32, 1); ctx.fillRect(x + off, y, 1, 16);
        }
        for (let k = 0; k < 12; k++) { ctx.fillStyle = "rgba(170,190,220,0.12)"; ctx.beginPath(); ctx.ellipse(r() * 64, r() * 64, 3 + r() * 7, 2 + r() * 3, 0, 0, Math.PI * 2); ctx.fill(); }
    }, 65, 0.16, 0.8);
    floorTex("fl_kota", (ctx, r) => {
        ctx.fillStyle = "rgb(84,94,88)"; ctx.fillRect(0, 0, FL, FL);
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 0, FL, 1); ctx.fillRect(0, 0, 1, FL); ctx.fillRect(0, 32, FL, 1); ctx.fillRect(32, 0, 1, FL);
        for (let k = 0; k < 10; k++) { ctx.fillStyle = "rgba(30,24,16,0.25)"; ctx.beginPath(); ctx.arc(r() * 64, r() * 64, 2 + r() * 6, 0, Math.PI * 2); ctx.fill(); }
    }, 66, 0.12, 0.9);
    floorTex("fl_bath", (ctx, r) => {
        for (let y = 0; y < FL; y += 8) for (let x = 0; x < FL; x += 8) { const v = r() * 20; ctx.fillStyle = rgb(170 + v, 176 + v, 170 + v); ctx.fillRect(x, y, 8, 8); }
        ctx.fillStyle = "rgb(70,72,66)"; for (let i = 0; i < FL; i += 8) { ctx.fillRect(0, i, FL, 1); ctx.fillRect(i, 0, 1, FL); }
    }, 67, 0.1, 1.0);
    floorTex("fl_cement", (ctx, r) => {
        ctx.fillStyle = "rgb(78,76,70)"; ctx.fillRect(0, 0, FL, FL);
        for (let k = 0; k < 6; k++) { ctx.fillStyle = "rgba(20,24,20,0.35)"; ctx.beginPath(); ctx.ellipse(r() * 64, r() * 64, 4 + r() * 12, 3 + r() * 8, r() * 3, 0, Math.PI * 2); ctx.fill(); }
        cracks(ctx, r, 2, FL, FL, "rgba(0,0,0,0.5)");
    }, 68, 0.22, 0.9);
    floorTex("fl_brick", (ctx, r) => {
        for (let y = 0; y < FL; y += 8) { const off = (y / 8) % 2 ? 8 : 0; for (let x = -16; x < FL; x += 16) { const v = r() * 26; ctx.fillStyle = rgb(90 + v, 50 + v * 0.5, 38); ctx.fillRect(x + off, y, 15, 7); } }
    }, 69, 0.2, 0.9);
    floorTex("fl_carpet", (ctx, r) => {
        ctx.fillStyle = "rgb(84,24,26)"; ctx.fillRect(0, 0, FL, FL);
        ctx.fillStyle = "rgb(120,90,46)"; ctx.fillRect(0, 4, FL, 2); ctx.fillRect(0, 58, FL, 2);
        ctx.fillStyle = "rgb(36,40,60)"; for (let x = 0; x < FL; x += 16) { ctx.beginPath(); ctx.moveTo(x + 8, 20); ctx.lineTo(x + 14, 32); ctx.lineTo(x + 8, 44); ctx.lineTo(x + 2, 32); ctx.fill(); }
        ctx.fillStyle = "rgba(0,0,0,0.25)"; for (let k = 0; k < 6; k++) ctx.fillRect(r() * 64, r() * 64, 8, 4);
    }, 70, 0.22, 0.7);

    // ceilings
    floorTex("ce_beams", (ctx, r) => {
        ctx.fillStyle = "rgb(120,108,90)"; ctx.fillRect(0, 0, FL, FL);
        ctx.fillStyle = "rgb(52,36,24)"; ctx.fillRect(0, 0, 10, FL); ctx.fillRect(32, 0, 10, FL);
        ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(10, 0, 2, FL); ctx.fillRect(42, 0, 2, FL);
        for (let y = 0; y < FL; y += 6) { ctx.fillStyle = "rgba(0,0,0,0.12)"; ctx.fillRect(12, y, 20, 1); ctx.fillRect(44, y, 20, 1); }
    }, 71, 0.15, 0.9);
    floorTex("ce_plaster", (ctx, r) => {
        ctx.fillStyle = "rgb(118,112,100)"; ctx.fillRect(0, 0, FL, FL);
        cracks(ctx, r, 3, FL, FL, "rgba(30,26,20,0.5)");
        for (let k = 0; k < 4; k++) { ctx.fillStyle = "rgba(70,56,30,0.25)"; ctx.beginPath(); ctx.arc(r() * 64, r() * 64, 4 + r() * 10, 0, Math.PI * 2); ctx.fill(); }
    }, 72, 0.15, 1.0);
    floorTex("ce_concrete", (ctx, r) => {
        ctx.fillStyle = "rgb(64,64,60)"; ctx.fillRect(0, 0, FL, FL);
        ctx.fillStyle = "rgb(38,36,34)"; ctx.fillRect(0, 26, FL, 8);
        ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(0, 26, FL, 1);
        ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(0, 34, FL, 1);
    }, 73, 0.2, 1.0);

    // sky: dark clouds
    const c = cv(128, 128), ctx = g2(c), nz = makeNoise(77, 8);
    const img = ctx.createImageData(128, 128), d = img.data;
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
        const v = fbm(nz, x / 32, y / 32), i = (y * 128 + x) * 4;
        d[i] = 22 + v * 46; d[i + 1] = 26 + v * 50; d[i + 2] = 38 + v * 58; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    ART.tex.sky = toTex(c);
}

/* ======================================================================
   DECALS — painted onto wall faces. Signature (ctx, state, base)
   ====================================================================== */
const DEC = {};
ART.decals = DEC;

function frame(ctx, x, y, w, h, col) {
    ctx.fillStyle = col || "rgb(120,92,40)"; ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
    ctx.fillStyle = "rgba(255,230,160,0.25)"; ctx.fillRect(x - 4, y - 4, w + 8, 2);
    ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(x - 4, y + h + 2, w + 8, 2); ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    // cast shadow on the wall
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(x + w + 4, y, 3, h + 6);
}

/* draw a painted person bust. kind: man|woman|girl. variant: normal|closed|away|empty|scratched */
function bust(ctx, cx, cy, s, kind, variant, skin) {
    if (variant === "empty") return;
    const sk = skin || "rgb(170,128,96)";
    // shoulders / clothes
    const cc = kind === "man" ? [176, 166, 146] : kind === "woman" ? [112, 26, 30] : [150, 104, 36];
    const cg = ctx.createLinearGradient(cx - s, 0, cx + s, 0);
    cg.addColorStop(0, rgb(cc[0] * 1.1, cc[1] * 1.1, cc[2] * 1.1)); cg.addColorStop(1, rgb(cc[0] * 0.45, cc[1] * 0.45, cc[2] * 0.45));
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.ellipse(cx, cy + s * 1.35, s * 1.05, s * 0.75, 0, Math.PI, 0); ctx.fill();
    if (kind === "man") { ctx.fillStyle = "rgb(60,40,30)"; ctx.fillRect(cx - s * 0.1, cy + s * 0.65, s * 0.2, s * 0.6); }
    // head
    if (variant === "away") {
        ctx.fillStyle = "rgb(20,16,14)";
        ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.42, s * 0.52, 0, 0, Math.PI * 2); ctx.fill();
        if (kind !== "man") { ctx.fillRect(cx - s * 0.08, cy + s * 0.2, s * 0.16, s * 0.7); }
        return;
    }
    const fg = ctx.createRadialGradient(cx - s * 0.12, cy - s * 0.15, s * 0.05, cx, cy, s * 0.55);
    fg.addColorStop(0, "rgb(196,152,116)"); fg.addColorStop(0.6, sk); fg.addColorStop(1, "rgb(92,62,44)");
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.38, s * 0.48, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(60,30,20,0.35)"; ctx.beginPath(); ctx.ellipse(cx + s * 0.18, cy + s * 0.05, s * 0.16, s * 0.36, 0, 0, Math.PI * 2); ctx.fill();
    // hair
    ctx.fillStyle = "rgb(20,16,14)";
    ctx.beginPath(); ctx.ellipse(cx, cy - s * 0.25, s * 0.42, s * 0.28, 0, Math.PI, 0); ctx.fill();
    if (kind === "woman") { // pallu over the head
        ctx.fillStyle = "rgb(120,26,30)";
        ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy + s * 0.9); ctx.quadraticCurveTo(cx - s * 0.6, cy - s * 0.7, cx, cy - s * 0.62); ctx.quadraticCurveTo(cx + s * 0.6, cy - s * 0.7, cx + s * 0.55, cy + s * 0.9); ctx.lineTo(cx + s * 0.4, cy + s * 0.9); ctx.quadraticCurveTo(cx + s * 0.42, cy - s * 0.4, cx, cy - s * 0.45); ctx.quadraticCurveTo(cx - s * 0.42, cy - s * 0.4, cx - s * 0.4, cy + s * 0.9); ctx.fill();
        ctx.fillStyle = "rgb(170,20,20)"; ctx.fillRect(cx - 1, cy - s * 0.2, 2, 2);
    }
    if (kind === "girl") {
        ctx.fillStyle = "rgb(20,16,14)";
        ctx.fillRect(cx - s * 0.45, cy - s * 0.1, s * 0.12, s * 0.8); ctx.fillRect(cx + s * 0.33, cy - s * 0.1, s * 0.12, s * 0.8);
        ctx.fillStyle = "rgb(190,40,60)"; ctx.fillRect(cx - s * 0.47, cy + s * 0.65, s * 0.16, s * 0.1); ctx.fillRect(cx + s * 0.31, cy + s * 0.65, s * 0.16, s * 0.1);
    }
    // eyes
    ctx.fillStyle = "rgb(16,12,10)";
    if (variant === "closed") {
        ctx.fillRect(cx - s * 0.2, cy - s * 0.02, s * 0.14, 1); ctx.fillRect(cx + s * 0.06, cy - s * 0.02, s * 0.14, 1);
    } else {
        ctx.fillRect(cx - s * 0.18, cy - s * 0.05, Math.max(1, s * 0.09), Math.max(1, s * 0.07));
        ctx.fillRect(cx + s * 0.09, cy - s * 0.05, Math.max(1, s * 0.09), Math.max(1, s * 0.07));
    }
    if (kind === "man") { ctx.fillRect(cx - s * 0.18, cy + s * 0.2, s * 0.36, Math.max(1, s * 0.06)); } // moustache
    ctx.fillStyle = "rgba(90,40,30,0.8)"; ctx.fillRect(cx - s * 0.08, cy + s * 0.3, s * 0.16, 1);
    if (variant === "scratched") {
        ctx.strokeStyle = "rgba(230,220,200,0.85)"; ctx.lineWidth = 1;
        for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.moveTo(cx - s * 0.45 + k * s * 0.1, cy - s * 0.5); ctx.lineTo(cx - s * 0.3 + k * s * 0.08, cy + s * 0.55); ctx.stroke(); }
    }
}

function portraitBg(ctx, x, y, w, h) {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, "rgb(52,44,34)"); g.addColorStop(1, "rgb(22,18,14)");
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(255,240,200,0.05)"; ctx.fillRect(x + 4, y + 4, w * 0.4, h * 0.3);
}

function agePainting(ctx, x, y, w, h, seed) {
    const r = rng(seed || 7);
    const v = ctx.createRadialGradient(x + w / 2, y + h * 0.42, Math.min(w, h) * 0.2, x + w / 2, y + h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, "rgba(150,110,40,0.10)"); v.addColorStop(1, "rgba(20,12,4,0.65)");
    ctx.fillStyle = v; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(15,10,5,0.35)"; ctx.lineWidth = 0.6;
    for (let k = 0; k < 18; k++) { let px = x + r() * w, py = y + r() * h; ctx.beginPath(); ctx.moveTo(px, py); for (let j = 0; j < 4; j++) { px += (r() - 0.5) * 8; py += (r() - 0.5) * 8; ctx.lineTo(Math.max(x, Math.min(x + w, px)), Math.max(y, Math.min(y + h, py))); } ctx.stroke(); }
    ctx.lineWidth = 1;
}
DEC.portrait = (ctx, st) => {
    const x = 36, y = 18, w = 56, h = 70;
    frame(ctx, x, y, w, h, "rgb(118,88,36)");
    portraitBg(ctx, x, y, w, h);
    bust(ctx, x + w / 2, y + 30, 22, st.kind, st.variant);
    agePainting(ctx, x, y, w, h, 11);
    // brass name plate
    ctx.fillStyle = "rgb(140,112,56)"; ctx.fillRect(x + 14, y + h + 6, w - 28, 6);
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.font = "5px serif"; ctx.fillText(st.label || "", x + 18, y + h + 11);
};

DEC.familyPortrait = (ctx, st) => {
    const x = 14, y = 16, w = 100, h = 64;
    frame(ctx, x, y, w, h, "rgb(118,88,36)");
    portraitBg(ctx, x, y, w, h);
    bust(ctx, x + 26, y + 26, 16, "man", st.ravi || "normal");
    bust(ctx, x + 74, y + 26, 16, "woman", st.kamla || "normal");
    bust(ctx, x + 50, y + 38, 11, "girl", st.misty || "normal");
    agePainting(ctx, x, y, w, h, 23);
    ctx.fillStyle = "rgb(140,112,56)"; ctx.fillRect(x + 34, y + h + 6, 32, 6);
};

DEC.photos = (ctx, st) => {
    const r = rng(st.seed || 5);
    const spots = [[20, 30, 22, 28], [50, 24, 28, 22], [86, 34, 20, 26], [36, 64, 24, 18], [70, 62, 22, 28]];
    spots.forEach(([x, y, w, h], i) => {
        frame(ctx, x, y, w, h, i % 2 ? "rgb(40,30,22)" : "rgb(110,84,40)");
        ctx.fillStyle = "rgb(150,140,120)"; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = "rgb(110,100,84)"; ctx.fillRect(x, y + h * 0.6, w, h * 0.4);
        const kinds = ["man", "woman", "girl"];
        bust(ctx, x + w / 2, y + h * 0.42, Math.min(w, h) * 0.32, kinds[i % 3], st.scratched ? "scratched" : (st.variants && st.variants[i]) || "normal", "rgb(120,100,84)");
        if (st.pinned) { ctx.fillStyle = "rgb(160,20,20)"; ctx.fillRect(x + w / 2 - 1, y - 2, 3, 3); }
    });
};

function clockFace(ctx, cx, cy, rad, h, m, opts) {
    ctx.fillStyle = "rgb(214,200,170)"; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "rgb(30,24,18)";
    for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        const x = cx + Math.sin(a) * rad * 0.8, y = cy - Math.cos(a) * rad * 0.8;
        ctx.fillRect(x - 0.6, y - 0.6, 1.4, 1.4);
    }
    if (opts && opts.crack) { ctx.strokeStyle = "rgba(20,20,20,0.7)"; ctx.beginPath(); ctx.moveTo(cx - rad * 0.8, cy - rad * 0.4); ctx.lineTo(cx, cy + 1); ctx.lineTo(cx + rad * 0.6, cy + rad * 0.7); ctx.stroke(); }
    const ha = ((h % 12) + m / 60) / 12 * Math.PI * 2, ma = m / 60 * Math.PI * 2;
    ctx.strokeStyle = "rgb(16,12,10)"; ctx.lineWidth = Math.max(1.5, rad * 0.12);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(ha) * rad * 0.5, cy - Math.cos(ha) * rad * 0.5); ctx.stroke();
    ctx.lineWidth = Math.max(1, rad * 0.07);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(ma) * rad * 0.78, cy - Math.cos(ma) * rad * 0.78); ctx.stroke();
    ctx.lineWidth = 1;
}
ART.clockFace = clockFace;

DEC.wallClock = (ctx, st) => {
    // round wall clock with pendulum box, hanging from a nail
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(66, 22, 30, 62);
    ctx.fillStyle = "rgb(70,44,26)"; ctx.fillRect(48, 26, 32, 58);
    ctx.fillStyle = "rgb(92,60,36)"; ctx.beginPath(); ctx.arc(64, 36, 19, 0, Math.PI * 2); ctx.fill();
    clockFace(ctx, 64, 36, 15, st.h, st.m);
    // pendulum window
    ctx.fillStyle = "rgb(16,12,10)"; ctx.fillRect(54, 58, 20, 22);
    const sw = st.swing || 0;
    ctx.strokeStyle = "rgb(150,120,60)"; ctx.beginPath(); ctx.moveTo(64, 58); ctx.lineTo(64 + sw * 6, 74); ctx.stroke();
    ctx.fillStyle = "rgb(170,140,70)"; ctx.beginPath(); ctx.arc(64 + sw * 6, 75, 3, 0, Math.PI * 2); ctx.fill();
    if (st.open) { ctx.fillStyle = "rgb(8,6,5)"; ctx.fillRect(54, 58, 20, 22); ctx.fillStyle = "rgb(92,60,36)"; ctx.fillRect(40, 58, 12, 22); }
    ctx.fillStyle = "rgba(255,255,255,0.10)"; ctx.fillRect(56, 60, 3, 18);
};

DEC.grandClock = (ctx, st) => {
    const x = 40, w = 48;
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(x + w, 10, 6, 112);
    ctx.fillStyle = "rgb(58,34,20)"; ctx.fillRect(x, 8, w, 114);
    ctx.fillStyle = "rgb(76,46,28)"; ctx.fillRect(x - 4, 4, w + 8, 8); ctx.fillRect(x - 3, 112, w + 6, 10);
    // hood
    ctx.fillStyle = "rgb(84,52,30)"; ctx.beginPath(); ctx.moveTo(x - 2, 12); ctx.quadraticCurveTo(x + w / 2, -2, x + w + 2, 12); ctx.fill();
    clockFace(ctx, x + w / 2, 30, 16, st.h, st.m);
    // trunk glass with pendulum
    ctx.fillStyle = "rgb(10,8,6)"; ctx.fillRect(x + 12, 52, w - 24, 52);
    const sw = st.swing || 0;
    ctx.strokeStyle = "rgb(150,120,60)"; ctx.beginPath(); ctx.moveTo(x + w / 2, 52); ctx.lineTo(x + w / 2 + sw * 7, 92); ctx.stroke();
    ctx.fillStyle = "rgb(180,150,70)"; ctx.beginPath(); ctx.arc(x + w / 2 + sw * 7, 94, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(x + 14, 54, 3, 48);
    ctx.fillStyle = "rgba(255,230,180,0.12)"; ctx.fillRect(x, 8, 2, 114);
};

DEC.bookshelf = (ctx, st) => {
    const r = rng(st.seed || 3);
    ctx.fillStyle = "rgb(46,28,16)"; ctx.fillRect(6, 6, 116, 116);
    for (let s = 0; s < 4; s++) {
        const y = 12 + s * 27;
        ctx.fillStyle = "rgb(16,10,6)"; ctx.fillRect(10, y, 108, 22);
        let x = 11;
        while (x < 116) {
            const w = 3 + Math.floor(r() * 5), h = 12 + r() * 9;
            if (r() < 0.08) { x += 8; continue; }
            const cols = [[100, 30, 24], [40, 60, 44], [110, 90, 50], [60, 40, 70], [80, 70, 60]];
            const cc = cols[Math.floor(r() * cols.length)];
            ctx.fillStyle = rgb(...cc); ctx.fillRect(x, y + 22 - h, w, h);
            ctx.fillStyle = "rgba(255,230,180,0.18)"; ctx.fillRect(x, y + 22 - h + 3, w, 1);
            x += w + (r() < 0.2 ? 1 : 0);
        }
        ctx.fillStyle = "rgb(60,38,22)"; ctx.fillRect(8, y + 22, 112, 4);
    }
};

DEC.shrine = (ctx, st) => {
    // a household mandir: a carved wooden niche, a framed devotional picture,
    // a brass kalash, marigolds, and a ledge for the diyas (flames are sprites)
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(30, 20, 72, 92);
    ctx.fillStyle = "rgb(96,58,30)"; ctx.fillRect(26, 18, 76, 90);
    ctx.fillStyle = "rgb(120,76,40)";
    ctx.beginPath(); ctx.moveTo(22, 30); ctx.quadraticCurveTo(64, -2, 106, 30); ctx.lineTo(106, 36); ctx.quadraticCurveTo(64, 6, 22, 36); ctx.fill();
    ctx.fillStyle = "rgb(30,18,12)";
    ctx.beginPath(); ctx.moveTo(34, 102); ctx.lineTo(34, 44); ctx.quadraticCurveTo(64, 18, 94, 44); ctx.lineTo(94, 102); ctx.fill();
    // framed picture, faded saffron with a golden halo
    ctx.fillStyle = "rgb(150,120,60)"; ctx.fillRect(48, 40, 32, 38);
    const g = ctx.createRadialGradient(64, 54, 2, 64, 58, 18); g.addColorStop(0, "rgb(230,170,80)"); g.addColorStop(1, "rgb(150,70,30)");
    ctx.fillStyle = g; ctx.fillRect(51, 43, 26, 32);
    ctx.strokeStyle = "rgba(255,220,120,0.8)"; ctx.beginPath(); ctx.arc(64, 54, 7, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgb(90,50,40)"; ctx.beginPath(); ctx.arc(64, 54, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(58, 74); ctx.quadraticCurveTo(64, 58, 70, 74); ctx.fill();
    ctx.fillStyle = "rgb(170,20,20)"; ctx.fillRect(63, 49, 2, 3); // tilak smeared on the glass
    // brass kalash with mango leaves
    ctx.fillStyle = "rgb(170,130,50)"; ctx.beginPath(); ctx.ellipse(84, 93, 7, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(81, 82, 6, 4);
    ctx.fillStyle = "rgb(60,90,40)"; [[-6, -4], [0, -7], [6, -4]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.ellipse(84 + dx, 80 + dy, 2, 5, dx * 0.15, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = "rgb(150,40,30)"; ctx.beginPath(); ctx.arc(84, 77, 3, 0, Math.PI * 2); ctx.fill(); // coconut wrapped in red
    // marigold garland along the arch, a few fallen petals
    ctx.fillStyle = "rgb(214,128,24)";
    for (let i = 0; i <= 14; i++) { const t = i / 14, x = 34 + t * 60, y = 44 - Math.sin(t * Math.PI) * 20 + Math.sin(t * Math.PI) * 8; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "rgb(200,100,20)"; [[40, 104], [52, 106], [88, 105]].forEach(([x, y]) => ctx.fillRect(x, y, 2, 1));
    // ledge with clay diyas
    ctx.fillStyle = "rgb(140,100,64)"; ctx.fillRect(22, 104, 84, 6);
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(22, 110, 84, 2);
    ctx.fillStyle = "rgb(150,74,40)"; [40, 64, 88].forEach(x => { ctx.beginPath(); ctx.ellipse(x, 103, 5, 2.6, 0, 0, Math.PI); ctx.fill(); });
    // brass bell on a chain, and soot above the lamps
    ctx.strokeStyle = "rgb(120,100,60)"; ctx.beginPath(); ctx.moveTo(100, 14); ctx.lineTo(100, 32); ctx.stroke();
    ctx.fillStyle = "rgb(176,140,60)"; ctx.beginPath(); ctx.moveTo(94, 40); ctx.quadraticCurveTo(100, 26, 106, 40); ctx.fill();
    const sg = ctx.createLinearGradient(0, 70, 0, 100); sg.addColorStop(0, "rgba(0,0,0,0)"); sg.addColorStop(1, "rgba(0,0,0,0.25)");
    ctx.fillStyle = sg; ctx.fillRect(34, 70, 60, 32);
};

DEC.drawing = (ctx, st) => {
    // child's crayon drawing taped to the wall at a child's height
    const x = 44, y = st.low ? 82 : 52, w = 40, h = 32;
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate((st.tilt || 0) * 0.07); ctx.translate(-(x + w / 2), -(y + h / 2));
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(x + 2, y + 2, w, h);
    ctx.fillStyle = "rgb(214,208,190)"; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(200,190,140,0.7)"; ctx.fillRect(x + 3, y - 2, 8, 4); ctx.fillRect(x + w - 11, y - 2, 8, 4);
    ART.drawChildArt(ctx, st.n, x, y, w, h, false);
    ctx.restore();
};

DEC.scratches = (ctx, st) => {
    ctx.strokeStyle = "rgba(225,210,180,0.55)"; ctx.fillStyle = "rgba(225,210,180,0.55)";
    const r = rng(st.seed || 12);
    if (st.kind === "tally") {
        for (let row = 0; row < 5; row++) for (let g = 0; g < 5; g++) {
            const bx = 12 + g * 22 + r() * 3, by = 18 + row * 18;
            for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(bx + k * 4, by); ctx.lineTo(bx + k * 4 + 1, by + 12); ctx.stroke(); }
            ctx.beginPath(); ctx.moveTo(bx - 2, by + 10); ctx.lineTo(bx + 16, by + 2); ctx.stroke();
        }
    } else {
        ctx.font = (st.size || 14) + "px monospace";
        const lines = st.text.split("\n");
        lines.forEach((ln, i) => {
            for (let p = 0; p < 2; p++) ctx.fillText(ln, (st.x || 14) + r() * 1.5, (st.y || 40) + i * ((st.size || 14) + 6) + r() * 1.5);
        });
    }
};

DEC.chains = (ctx) => {
    ctx.fillStyle = "rgb(40,38,36)"; ctx.fillRect(56, 34, 16, 10);
    ctx.strokeStyle = "rgb(84,80,76)"; ctx.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
        let x = 60 + i * 8, y = 44;
        for (let k = 0; k < 10; k++) { ctx.beginPath(); ctx.ellipse(x, y + 3, 2, 3.5, 0, 0, Math.PI * 2); ctx.stroke(); y += 6; x += (i ? 1 : -1) * 1.2; }
        ctx.beginPath(); ctx.arc(x, y + 6, 6, 0, Math.PI * 2); ctx.stroke(); // shackle
    }
    ctx.lineWidth = 1;
    ctx.fillStyle = "rgba(60,30,20,0.35)"; ctx.fillRect(40, 100, 50, 16);
};

DEC.keyring = (ctx, st) => {
    ctx.fillStyle = "rgb(30,26,22)"; ctx.fillRect(62, 40, 4, 4);
    if (!st.taken) {
        ctx.strokeStyle = "rgb(150,140,110)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(64, 52, 7, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "rgb(120,96,50)"; ctx.fillRect(58, 58, 3, 18); ctx.fillRect(55, 72, 6, 2); ctx.fillRect(55, 68, 4, 2);
        ctx.fillStyle = "rgb(150,130,70)"; ctx.fillRect(68, 58, 2, 10); ctx.fillRect(66, 66, 6, 3);
        ctx.lineWidth = 1;
    } else {
        ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.arc(64, 54, 6, 0, Math.PI * 2); ctx.fill();
    }
};

DEC.fusebox = (ctx, st) => {
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(40, 30, 54, 70);
    ctx.fillStyle = "rgb(70,74,72)"; ctx.fillRect(34, 24, 54, 70);
    ctx.fillStyle = "rgb(20,20,20)"; ctx.fillRect(38, 28, 46, 42);
    for (let i = 0; i < 3; i++) {
        const x = 42 + i * 14;
        ctx.fillStyle = "rgb(60,60,60)"; ctx.fillRect(x, 36, 10, 26);
        const has = i !== 1 || st.fuse;
        if (has) { ctx.fillStyle = "rgb(150,140,118)"; ctx.fillRect(x + 1, 40, 8, 18); ctx.fillStyle = "rgba(60,40,20,0.5)"; ctx.fillRect(x + 1, 52, 8, 6); ctx.fillStyle = "rgb(110,84,40)"; ctx.fillRect(x + 3, 38, 4, 2); ctx.fillRect(x + 3, 58, 4, 2); }
    }
    ctx.fillStyle = "rgb(168,156,124)"; ctx.fillRect(40, 74, 30, 8);
    ctx.fillStyle = "rgba(40,24,12,0.8)"; ctx.font = "italic 6px serif"; ctx.fillText("mains", 45, 80);
    // lever
    ctx.fillStyle = "rgb(30,30,30)"; ctx.fillRect(74, 72, 10, 18);
    ctx.fillStyle = "rgb(140,30,20)";
    if (st.on) ctx.fillRect(76, 66, 6, 10); else ctx.fillRect(76, 84, 6, 10);
    // dangling wire + warning
    ctx.strokeStyle = "rgb(30,30,30)"; ctx.beginPath(); ctx.moveTo(60, 94); ctx.quadraticCurveTo(64, 110, 58, 126); ctx.stroke();
    ctx.fillStyle = "rgba(60,40,20,0.45)"; ctx.fillRect(34, 24, 54, 3); // rust along the lid
    ctx.fillStyle = "rgba(110,60,30,0.35)"; ctx.fillRect(36, 88, 3, 6); ctx.fillRect(80, 30, 4, 9);
};

DEC.wardrobe = (ctx, st) => {
    // grey steel almirah, a fixture of every Indian bedroom
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(30, 10, 74, 114);
    ctx.fillStyle = st.wood ? "rgb(70,46,28)" : "rgb(96,100,98)"; ctx.fillRect(24, 8, 76, 114);
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(61, 10, 2, 110);
    ctx.fillStyle = "rgba(255,255,255,0.10)"; ctx.fillRect(26, 10, 2, 110); ctx.fillRect(64, 10, 2, 110);
    ctx.fillStyle = "rgb(30,30,30)"; ctx.fillRect(56, 60, 3, 12); ctx.fillRect(66, 60, 3, 12);
    if (st.wood) { ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.strokeRect(30, 16, 26, 98); ctx.strokeRect(68, 16, 26, 98); }
    else { ctx.fillStyle = "rgb(150,120,60)"; ctx.fillRect(56, 50, 14, 4); }
    if (st.ajar) { ctx.fillStyle = "rgb(4,4,4)"; ctx.fillRect(61, 10, 5, 110); }
};

DEC.pantry = (ctx) => {
    ctx.fillStyle = "rgb(84,62,40)"; ctx.fillRect(20, 30, 88, 92);
    ctx.fillStyle = "rgb(10,8,6)";
    for (let y = 40; y < 116; y += 6) { ctx.fillRect(28, y, 34, 2); ctx.fillRect(66, y, 34, 2); }
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(63, 32, 2, 88);
    ctx.fillStyle = "rgb(150,120,60)"; ctx.fillRect(58, 74, 3, 8); ctx.fillRect(67, 74, 3, 8);
    // shelf above with steel utensils
    ctx.fillStyle = "rgb(60,40,26)"; ctx.fillRect(14, 18, 100, 4);
    ctx.fillStyle = "rgb(150,150,150)"; [24, 40, 56, 76, 96].forEach((x, i) => { ctx.beginPath(); ctx.ellipse(x, 14, 6, 4 + (i % 2) * 2, 0, 0, Math.PI * 2); ctx.fill(); });
};

DEC.stove = (ctx) => {
    ctx.fillStyle = "rgb(90,84,74)"; ctx.fillRect(0, 76, 128, 44);
    ctx.fillStyle = "rgb(120,112,100)"; ctx.fillRect(0, 74, 128, 4);
    ctx.fillStyle = "rgb(20,16,12)"; ctx.fillRect(20, 80, 34, 26); ctx.fillRect(74, 80, 34, 26);
    ctx.fillStyle = "rgb(60,30,16)"; ctx.fillRect(22, 98, 30, 6);
    // pots
    ctx.fillStyle = "rgb(110,104,96)"; ctx.beginPath(); ctx.ellipse(37, 68, 14, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(23, 58, 28, 10);
    ctx.fillStyle = "rgb(70,40,20)"; ctx.beginPath(); ctx.ellipse(91, 70, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
    // soot above
    const g = ctx.createLinearGradient(0, 0, 0, 70); g.addColorStop(0, "rgba(0,0,0,0.5)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(10, 0, 108, 70);
};

DEC.calendar = (ctx) => {
    ctx.fillStyle = "rgb(200,190,170)"; ctx.fillRect(44, 24, 40, 52);
    ctx.fillStyle = "rgb(140,30,30)"; ctx.fillRect(44, 24, 40, 12);
    ctx.fillStyle = "rgb(230,220,200)"; ctx.font = "bold 6px monospace"; ctx.fillText("NOV 1987", 48, 32);
    ctx.fillStyle = "rgb(40,30,20)";
    for (let d = 0; d < 30; d++) { const x = 46 + (d % 7) * 5.4, y = 42 + Math.floor(d / 7) * 7; ctx.fillRect(x, y, 2, 2); }
    // 14th circled and the following days crossed out
    ctx.strokeStyle = "rgb(150,0,0)"; ctx.beginPath(); ctx.arc(46 + 6 * 5.4 + 1, 49 + 1, 3.5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(44, 64, 40, 12);
};

DEC.sideboard = (ctx) => {
    ctx.fillStyle = "rgb(60,38,22)"; ctx.fillRect(8, 80, 112, 40);
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(10, 86, 34, 28); ctx.fillRect(47, 86, 34, 28); ctx.fillRect(84, 86, 34, 28);
    ctx.fillStyle = "rgb(150,150,150)"; [30, 64, 98].forEach(x => { ctx.beginPath(); ctx.ellipse(x, 72, 12, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "rgb(110,110,110)"; });
    ctx.fillStyle = "rgb(210,200,180)"; ctx.fillRect(4, 78, 120, 3);
};

DEC.mirror = (ctx, st) => {
    ctx.fillStyle = "rgb(110,90,50)"; ctx.beginPath(); ctx.ellipse(64, 50, 26, 36, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createLinearGradient(40, 20, 90, 90); g.addColorStop(0, "rgb(70,80,86)"); g.addColorStop(1, "rgb(20,24,28)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(64, 50, 22, 32, 0, 0, Math.PI * 2); ctx.fill();
    if (st.figure) {
        // a hooded shape standing "behind" the viewer
        ctx.fillStyle = "rgba(6,6,8,0.92)";
        ctx.beginPath(); ctx.ellipse(70, 38, 6, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(60, 82); ctx.quadraticCurveTo(62, 44, 70, 44); ctx.quadraticCurveTo(78, 44, 80, 82); ctx.fill();
    }
    ctx.strokeStyle = "rgba(220,230,240,0.25)"; ctx.beginPath(); ctx.moveTo(50, 30); ctx.lineTo(56, 24); ctx.stroke(); ctx.beginPath(); ctx.moveTo(48, 40); ctx.lineTo(60, 28); ctx.stroke();
    if (st.cracked) { ctx.strokeStyle = "rgba(230,230,230,0.5)"; ctx.beginPath(); ctx.moveTo(52, 22); ctx.lineTo(66, 52); ctx.lineTo(58, 80); ctx.moveTo(66, 52); ctx.lineTo(84, 60); ctx.stroke(); }
    // basin below
    if (st.basin) { ctx.fillStyle = "rgb(190,190,180)"; ctx.fillRect(40, 92, 48, 10); ctx.fillStyle = "rgb(150,150,140)"; ctx.fillRect(58, 102, 12, 20); ctx.fillStyle = "rgba(90,60,30,0.6)"; ctx.fillRect(46, 92, 20, 2); }
};

DEC.curtains = (ctx, st) => {
    const t = st.t || 0, amp = st.amp || 0;
    for (let side = 0; side < 2; side++) {
        ctx.fillStyle = "rgb(96,30,32)";
        ctx.beginPath();
        const x0 = side ? 128 - 24 : 24;
        ctx.moveTo(side ? 128 - 38 : 24, 12);
        for (let y = 12; y <= 108; y += 6) {
            const sway = Math.sin(y * 0.08 + t * 2 + side) * amp * (y / 108) * 8;
            ctx.lineTo((side ? 128 - 38 - 6 * (y / 108) : 38 + 6 * (y / 108)) + sway, y);
        }
        ctx.lineTo(side ? 128 - 22 : 22, 108); ctx.lineTo(side ? 128 - 22 : 22, 12); ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.3)"; for (let k = 0; k < 3; k++) ctx.fillRect(x0 + (side ? -6 - k * 4 : k * 4), 14, 1, 92);
    }
    ctx.fillStyle = "rgb(60,40,24)"; ctx.fillRect(16, 9, 96, 4);
};

DEC.frontDoor = (ctx, st) => {
    // one half of the haveli's carved double door; st.half = "L" | "R"
    const L = st.half === "L";
    ctx.fillStyle = "rgb(56,34,20)"; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = "rgb(72,46,28)"; ctx.fillRect(L ? 12 : 0, 8, 116, 120);
    ctx.strokeStyle = "rgba(0,0,0,0.45)"; ctx.lineWidth = 2;
    for (let y = 18; y < 120; y += 34) ctx.strokeRect(L ? 22 : 10, y, 96, 28);
    ctx.lineWidth = 1;
    ctx.fillStyle = "rgb(140,112,60)";
    for (let y = 14; y < 124; y += 11) for (let x = (L ? 18 : 6); x < 124; x += 22) { ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill(); }
    // arch top
    ctx.fillStyle = "rgb(40,24,14)"; ctx.fillRect(0, 0, 128, 8);
    if (st.dawn) {
        ctx.fillStyle = "rgba(220,230,240,0.85)";
        ctx.fillRect(L ? 120 : 0, 8, 8, 120);
    }
    if (st.chain) {
        ctx.strokeStyle = "rgb(100,96,90)"; ctx.lineWidth = 3;
        const sx = L ? 70 : 0, ex = L ? 128 : 58;
        for (let x = sx; x < ex; x += 7) { ctx.beginPath(); ctx.ellipse(x + 3, 64 + Math.sin(x * 0.2) * 2, 4, 2.5, 0, 0, Math.PI * 2); ctx.stroke(); }
        ctx.lineWidth = 1;
        if (!L) { ctx.fillStyle = "rgb(120,100,50)"; ctx.fillRect(4, 62, 16, 18); ctx.fillStyle = "rgb(20,16,10)"; ctx.fillRect(11, 70, 2, 5); }
    }
    // ring knocker
    ctx.strokeStyle = "rgb(140,112,60)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(L ? 112 : 16, 84, 6, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1;
};

DEC.newspaperWall = (ctx) => {
    ctx.fillStyle = "rgb(190,180,150)"; ctx.fillRect(38, 26, 52, 64);
    ctx.fillStyle = "rgb(30,26,20)"; ctx.fillRect(42, 30, 44, 5);
    ctx.fillStyle = "rgba(30,26,20,0.6)"; for (let y = 40; y < 86; y += 4) ctx.fillRect(42, y, 20 + (y % 8 ? 22 : 18), 1);
};

DEC.switchPanel = (ctx, st) => {
    ctx.fillStyle = "rgb(190,186,170)"; ctx.fillRect(52, 54, 22, 30);
    ctx.fillStyle = "rgb(40,40,40)"; ctx.fillRect(57, 60, 5, 9); ctx.fillRect(65, 60, 5, 9);
    ctx.fillStyle = "rgb(20,20,20)"; ctx.fillRect(59, st.on ? 60 : 64, 2, 5);
};

/* ======================================================================
   CHILD ART (used on walls and in the full-screen viewer)
   ====================================================================== */
ART.drawChildArt = function (ctx, n, x, y, w, h, big) {
    const s = w / 68;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.lineWidth = big ? 1.4 : 1.1; ctx.lineCap = "round"; ctx.lineJoin = "round";
    const crayon = (col, pts) => { ctx.strokeStyle = col; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); };
    const text = (t, tx, ty, col, sz) => { ctx.fillStyle = col; ctx.font = `${sz || 5}px "Comic Sans MS", "Caveat", cursive`; ctx.fillText(t, tx, ty); };
    if (n === 1) {
        // the coat stand that "watches me sleep", a key in the pocket
        crayon("#355", [[4, 50], [64, 50]]);
        crayon("#222", [[40, 48], [40, 10]]); crayon("#222", [[34, 48], [46, 48]]);
        ctx.fillStyle = "#111"; ctx.beginPath(); ctx.moveTo(33, 14); ctx.lineTo(47, 14); ctx.lineTo(50, 44); ctx.lineTo(30, 44); ctx.fill();
        ctx.beginPath(); ctx.arc(40, 10, 4, 0, Math.PI * 2); ctx.fill();
        crayon("#c90", [[44, 30], [49, 30], [49, 32]]); ctx.fillStyle = "#c90"; ctx.beginPath(); ctx.arc(43, 30, 1.6, 0, Math.PI * 2); ctx.fill();
        crayon("#b33", [[8, 40], [20, 40], [20, 48], [8, 48], [8, 40]]); // small bed
        ctx.fillStyle = "#e9c"; ctx.beginPath(); ctx.arc(11, 38, 2.5, 0, Math.PI * 2); ctx.fill();
        text("papa ka coat", 30, 6, "#333", 4.5);
        text("sote waqt ghoorta hai", 4, 56, "#a22", 4.5);
        text("tehkhane ki chaabi", 4, 61, "#333", 4);
        text("jeb mein rehti hai", 4, 65.5, "#333", 4);
    } else if (n === 2) {
        // toy box with a glowing "light" hidden inside, papa below
        crayon("#753", [[10, 30], [34, 30], [34, 46], [10, 46], [10, 30]]);
        crayon("#753", [[10, 30], [14, 24], [38, 24], [34, 30]]);
        ctx.fillStyle = "#fc3"; ctx.beginPath(); ctx.arc(22, 38, 4, 0, Math.PI * 2); ctx.fill();
        crayon("#fc3", [[22, 31], [22, 29]]); crayon("#fc3", [[15, 38], [13, 38]]); crayon("#fc3", [[29, 38], [31, 38]]);
        crayon("#333", [[2, 50], [66, 50]]);
        ctx.fillStyle = "#111"; ctx.beginPath(); ctx.moveTo(48, 64); ctx.lineTo(52, 54); ctx.lineTo(56, 64); ctx.fill(); ctx.beginPath(); ctx.arc(52, 53, 2.4, 0, Math.PI * 2); ctx.fill();
        text("maine papa ki light", 4, 9, "#333", 4.8);
        text("toy box mein chhupa di", 4, 15, "#333", 4.8);
        text("wo upar na aa sake", 26, 60, "#a22", 4.2);
    } else if (n === 3) {
        // family: mummy, me, a tall faceless man, and "the guest"
        crayon("#a52", [[6, 26], [34, 8], [62, 26]]); crayon("#a52", [[10, 24], [10, 54], [58, 54], [58, 24]]);
        const fig = (fx, col, hgt) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(fx, 54 - hgt, 2.6, 0, Math.PI * 2); ctx.fill(); crayon(col, [[fx, 54 - hgt + 2], [fx, 50]]); crayon(col, [[fx - 3, 54], [fx, 50], [fx + 3, 54]]); };
        fig(20, "#c33", 14); fig(28, "#e9c", 9);
        ctx.fillStyle = "#111"; ctx.fillRect(38, 26, 6, 28); ctx.beginPath(); ctx.arc(41, 25, 3.4, 0, Math.PI * 2); ctx.fill();
        fig(52, "#36a", 13);
        ctx.fillStyle = "#642"; ctx.fillRect(55, 47, 6, 5); crayon("#642", [[57, 47], [57, 45.5], [59, 45.5], [59, 47]]);
        text("mummy", 13, 62, "#333", 4); text("main", 26, 66, "#333", 4); text("?", 40, 22, "#a22", 6); text("mehmaan", 46, 62, "#333", 4);
    }
    ctx.restore();
};

/* ======================================================================
   SPRITES (canvas with alpha) — free standing props
   ====================================================================== */
ART.spr = {};
const SPC = {}; // sprite canvases (for frames)
function sprite(name, w, h, painter) {
    const c = cv(w, h), ctx = g2(c);
    painter(ctx, rng(name.length * 97 + w));
    grit(c, 0.1, name.length * 13 + h, 0);
    SPC[name] = c; ART.spr[name] = toTex(c);
}

function buildSprites() {
    sprite("rocker", 64, 64, (ctx) => {
        ctx.strokeStyle = "rgb(70,44,26)"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(8, 56); ctx.quadraticCurveTo(32, 66, 58, 54); ctx.stroke(); // rockers
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(16, 58); ctx.lineTo(18, 36); ctx.moveTo(46, 58); ctx.lineTo(44, 36); ctx.stroke();
        ctx.fillStyle = "rgb(84,54,32)"; ctx.fillRect(14, 34, 34, 5);
        ctx.fillRect(16, 6, 30, 3);
        ctx.lineWidth = 2; ctx.strokeStyle = "rgb(76,48,28)";
        for (let x = 18; x <= 44; x += 6.5) { ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x, 34); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(14, 26); ctx.lineTo(8, 26); ctx.lineTo(10, 40); ctx.moveTo(48, 26); ctx.lineTo(54, 26); ctx.lineTo(52, 40); ctx.stroke();
        // a folded shawl
        ctx.fillStyle = "rgb(90,30,34)"; ctx.beginPath(); ctx.moveTo(20, 10); ctx.lineTo(42, 10); ctx.lineTo(40, 30); ctx.lineTo(24, 28); ctx.fill();
        ctx.fillStyle = "rgba(220,180,90,0.5)"; for (let y = 14; y < 28; y += 4) ctx.fillRect(22, y, 18, 1);
    });
    // rocking frames
    for (let f = 0; f < 5; f++) {
        const a = (f - 2) * 0.07, c = cv(64, 64), ctx = g2(c);
        ctx.translate(32, 60); ctx.rotate(a); ctx.translate(-32, -60); ctx.drawImage(SPC.rocker, 0, 0);
        ART.spr["rocker" + f] = toTex(c);
    }
    sprite("rocker_coat", 64, 64, (ctx) => {
        ctx.drawImage(SPC.rocker, 0, 0);
        ctx.fillStyle = "rgb(18,16,16)";
        ctx.beginPath(); ctx.moveTo(18, 6); ctx.lineTo(46, 6); ctx.lineTo(50, 40); ctx.lineTo(44, 58); ctx.lineTo(20, 58); ctx.lineTo(14, 40); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fillRect(31, 8, 2, 48);
    });
    for (let f = 0; f < 5; f++) {
        const a = (f - 2) * 0.07, c = cv(64, 64), ctx = g2(c);
        ctx.translate(32, 60); ctx.rotate(a); ctx.translate(-32, -60); ctx.drawImage(SPC.rocker_coat, 0, 0);
        ART.spr["rocker_coat" + f] = toTex(c);
    }
    sprite("phoneTable", 64, 64, (ctx) => {
        ctx.fillStyle = "rgb(64,40,24)"; ctx.beginPath(); ctx.ellipse(32, 36, 22, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(30, 38, 4, 22); ctx.fillRect(22, 58, 20, 3);
        ctx.fillStyle = "rgb(200,190,170)"; ctx.fillRect(16, 31, 14, 3); // newspaper
        ctx.fillStyle = "rgb(18,18,18)"; ctx.beginPath(); ctx.ellipse(38, 30, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(30, 22, 16, 5); ctx.beginPath(); ctx.arc(31, 24, 3, 0, Math.PI * 2); ctx.arc(45, 24, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgb(190,180,160)"; ctx.beginPath(); ctx.arc(38, 30, 3, 0, Math.PI * 2); ctx.fill();
    });
    sprite("phoneTable_off", 64, 64, (ctx) => { // receiver lifted off, dangling
        ctx.drawImage(SPC.phoneTable, 0, 0);
        ctx.clearRect(28, 18, 20, 9);
        ctx.fillStyle = "rgb(64,40,24)"; ctx.beginPath(); ctx.ellipse(32, 36, 22, 5, 0, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = "rgb(18,18,18)"; ctx.beginPath(); ctx.moveTo(44, 32); ctx.quadraticCurveTo(52, 44, 50, 52); ctx.stroke();
        ctx.fillStyle = "rgb(18,18,18)"; ctx.fillRect(44, 52, 12, 4);
    });
    const radio = (on) => (ctx) => {
        ctx.fillStyle = "rgb(60,38,22)"; ctx.fillRect(8, 40, 48, 4); ctx.fillRect(12, 44, 4, 18); ctx.fillRect(48, 44, 4, 18);
        ctx.fillStyle = "rgb(96,60,34)"; ctx.beginPath(); ctx.moveTo(14, 40); ctx.lineTo(14, 22); ctx.quadraticCurveTo(32, 12, 50, 22); ctx.lineTo(50, 40); ctx.fill();
        ctx.fillStyle = "rgb(40,30,20)"; ctx.fillRect(18, 24, 16, 13);
        ctx.fillStyle = "rgba(0,0,0,0.5)"; for (let y = 25; y < 37; y += 2) ctx.fillRect(18, y, 16, 1);
        ctx.fillStyle = on ? "rgb(255,200,110)" : "rgb(120,104,80)"; ctx.fillRect(37, 25, 10, 5);
        ctx.fillStyle = "rgb(30,20,10)"; ctx.beginPath(); ctx.arc(40, 35, 2, 0, Math.PI * 2); ctx.arc(46, 35, 2, 0, Math.PI * 2); ctx.fill();
    };
    sprite("radio", 64, 64, radio(false)); sprite("radio_on", 64, 64, radio(true));
    sprite("covered", 64, 64, (ctx) => {
        ctx.fillStyle = "rgb(150,146,136)";
        ctx.beginPath(); ctx.moveTo(4, 62); ctx.lineTo(6, 32); ctx.quadraticCurveTo(10, 20, 22, 22); ctx.quadraticCurveTo(32, 12, 44, 22); ctx.quadraticCurveTo(58, 20, 60, 34); ctx.lineTo(62, 62); ctx.fill();
        ctx.strokeStyle = "rgba(60,56,50,0.5)"; for (let x = 10; x < 60; x += 9) { ctx.beginPath(); ctx.moveTo(x, 30); ctx.quadraticCurveTo(x + 3, 46, x - 1, 62); ctx.stroke(); }
        ctx.fillStyle = "rgba(70,60,40,0.35)"; ctx.fillRect(4, 54, 58, 8);
    });
    sprite("wheelchair", 64, 64, (ctx) => {
        ctx.strokeStyle = "rgb(110,110,104)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(22, 46, 14, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1; for (let a = 0; a < 6; a++) { ctx.beginPath(); ctx.moveTo(22, 46); ctx.lineTo(22 + Math.cos(a) * 13, 46 + Math.sin(a) * 13); ctx.stroke(); }
        ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(48, 56, 5, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "rgb(60,40,40)"; ctx.fillRect(18, 34, 28, 6); ctx.fillRect(16, 12, 6, 24);
        ctx.strokeStyle = "rgb(90,90,86)"; ctx.beginPath(); ctx.moveTo(19, 12); ctx.lineTo(12, 10); ctx.moveTo(44, 40); ctx.lineTo(48, 52); ctx.stroke();
        ctx.fillStyle = "rgb(110,96,70)"; ctx.fillRect(22, 30, 16, 6); // folded blanket
    });
    const dining = (served) => (ctx) => {
        // chairs behind
        ctx.fillStyle = "rgb(56,34,20)";
        [14, 50, 86].forEach(x => { ctx.fillRect(x, 8, 26, 4); ctx.fillRect(x + 2, 8, 3, 34); ctx.fillRect(x + 21, 8, 3, 34); for (let k = 1; k < 4; k++) ctx.fillRect(x + 2 + k * 5, 12, 2, 20); });
        // the fourth chair, pulled out towards the viewer
        ctx.fillRect(100, 30, 26, 4); ctx.fillRect(102, 30, 3, 50); ctx.fillRect(121, 30, 3, 50);
        // table + cloth
        ctx.fillStyle = "rgb(190,180,160)"; ctx.fillRect(4, 36, 116, 8);
        ctx.beginPath(); ctx.moveTo(4, 44); ctx.lineTo(120, 44); ctx.lineTo(118, 58); ctx.lineTo(6, 58); ctx.fill();
        ctx.fillStyle = "rgba(90,70,40,0.35)"; ctx.fillRect(30, 46, 20, 6);
        ctx.fillStyle = "rgb(60,38,22)"; ctx.fillRect(10, 58, 5, 20); ctx.fillRect(110, 58, 5, 20);
        // steel thalis
        [22, 48, 74, 100].forEach((x, i) => {
            ctx.fillStyle = "rgb(170,170,166)"; ctx.beginPath(); ctx.ellipse(x, 38, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
            if (served) { ctx.fillStyle = i === 3 ? "rgb(120,20,14)" : "rgb(180,120,40)"; ctx.beginPath(); ctx.ellipse(x - 2, 37.5, 4, 1.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "rgb(220,210,180)"; ctx.beginPath(); ctx.ellipse(x + 4, 38, 3, 1.2, 0, 0, Math.PI * 2); ctx.fill(); }
            ctx.fillStyle = "rgb(150,150,150)"; ctx.fillRect(x + 8, 32, 3, 6);
        });
        // candle stand in the middle (flame is a separate light sprite)
        ctx.fillStyle = "rgb(140,110,60)"; ctx.fillRect(60, 30, 4, 7); ctx.fillStyle = "rgb(220,210,190)"; ctx.fillRect(60, 22, 4, 8);
        if (served === "coat") { ctx.fillStyle = "rgb(16,14,14)"; ctx.beginPath(); ctx.moveTo(100, 30); ctx.lineTo(126, 30); ctx.lineTo(128, 70); ctx.lineTo(98, 70); ctx.fill(); }
    };
    sprite("dining", 128, 80, dining(false));
    sprite("dining_served", 128, 80, dining("coat"));
    sprite("well", 96, 96, (ctx) => {
        // round brick well with a wooden crank frame, rope going down
        ctx.fillStyle = "rgb(84,70,58)"; ctx.fillRect(14, 54, 68, 38);
        for (let y = 56; y < 92; y += 7) { const off = (y / 7) % 2 ? 0 : 6; for (let x = 14 + off; x < 82; x += 12) { ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(x, y, 1, 7); } ctx.fillRect(14, y, 68, 1); }
        ctx.fillStyle = "rgb(120,104,88)"; ctx.beginPath(); ctx.ellipse(48, 54, 36, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgb(4,4,6)"; ctx.beginPath(); ctx.ellipse(48, 54, 29, 4.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgb(70,46,28)"; ctx.fillRect(18, 10, 6, 46); ctx.fillRect(72, 10, 6, 46); ctx.fillRect(16, 8, 64, 6);
        ctx.fillStyle = "rgb(90,62,38)"; ctx.fillRect(24, 22, 48, 6); // drum
        ctx.strokeStyle = "rgb(150,130,90)"; ctx.beginPath(); ctx.moveTo(48, 28); ctx.lineTo(48, 54); ctx.stroke();
        ctx.fillStyle = "rgb(50,50,50)"; ctx.fillRect(78, 22, 10, 3); ctx.fillRect(86, 22, 3, 12); // crank
        ctx.fillStyle = "rgba(150,170,200,0.25)"; ctx.fillRect(14, 86, 68, 6);
    });
    sprite("tulsi", 48, 64, (ctx) => {
        ctx.fillStyle = "rgb(150,120,90)"; ctx.fillRect(10, 30, 28, 32);
        ctx.fillStyle = "rgb(170,80,40)"; ctx.fillRect(8, 26, 32, 6); ctx.fillRect(14, 40, 20, 10);
        ctx.fillStyle = "rgb(200,190,170)"; ctx.fillRect(22, 42, 4, 6);
        ctx.strokeStyle = "rgb(60,50,30)"; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(24, 26); ctx.lineTo(24 + (k - 3) * 4, 6 + (k % 2) * 6); ctx.stroke(); }
    });
    sprite("desk", 96, 64, (ctx) => {
        ctx.fillStyle = "rgb(60,36,20)"; ctx.fillRect(6, 30, 84, 6); ctx.fillRect(8, 36, 24, 26); ctx.fillRect(80, 36, 6, 26);
        ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(10, 40, 20, 8); ctx.fillRect(10, 50, 20, 8);
        ctx.fillStyle = "rgb(150,120,60)"; ctx.fillRect(18, 43, 4, 2); ctx.fillRect(18, 53, 4, 2);
        ctx.fillStyle = "rgb(210,200,170)"; ctx.fillRect(38, 27, 22, 3); ctx.fillRect(44, 26, 18, 2);
        ctx.fillStyle = "rgb(20,20,30)"; ctx.fillRect(66, 24, 5, 6);
        ctx.fillStyle = "rgb(120,96,50)"; ctx.fillRect(16, 20, 8, 10); ctx.fillStyle = "rgba(255,230,180,0.5)"; ctx.fillRect(17, 12, 6, 8); // hurricane lamp
    });
    sprite("bed", 96, 64, (ctx) => {
        ctx.fillStyle = "rgb(56,34,20)"; ctx.fillRect(6, 10, 84, 30); // headboard
        ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(12, 16, 72, 20);
        ctx.fillStyle = "rgb(170,160,140)"; ctx.fillRect(4, 34, 88, 16);
        ctx.fillStyle = "rgb(110,40,40)"; ctx.beginPath(); ctx.moveTo(4, 40); ctx.quadraticCurveTo(40, 30, 92, 44); ctx.lineTo(92, 56); ctx.lineTo(4, 56); ctx.fill();
        ctx.fillStyle = "rgb(200,190,170)"; ctx.fillRect(14, 32, 26, 7); ctx.fillRect(56, 32, 26, 7);
        ctx.fillStyle = "rgb(56,34,20)"; ctx.fillRect(4, 54, 6, 10); ctx.fillRect(86, 54, 6, 10);
        ctx.fillStyle = "rgb(0,0,0)"; ctx.fillRect(10, 56, 76, 8); // darkness under the bed
    });
    sprite("kidbed", 64, 64, (ctx) => {
        ctx.fillStyle = "rgb(150,170,190)"; ctx.fillRect(4, 24, 56, 20);
        ctx.fillStyle = "rgb(220,200,210)"; ctx.fillRect(4, 40, 56, 12);
        ctx.fillStyle = "rgb(200,140,160)"; ctx.beginPath(); ctx.moveTo(4, 44); ctx.quadraticCurveTo(30, 36, 60, 46); ctx.lineTo(60, 54); ctx.lineTo(4, 54); ctx.fill();
        ctx.fillStyle = "rgb(150,170,190)"; ctx.fillRect(4, 52, 4, 12); ctx.fillRect(56, 52, 4, 12);
        ctx.fillStyle = "rgb(4,4,4)"; ctx.fillRect(8, 56, 48, 8);
    });
    sprite("doll", 32, 32, (ctx) => {
        ctx.fillStyle = "rgb(150,40,50)"; ctx.beginPath(); ctx.moveTo(8, 30); ctx.lineTo(12, 16); ctx.lineTo(20, 16); ctx.lineTo(24, 30); ctx.fill();
        ctx.fillStyle = "rgb(210,180,150)"; ctx.beginPath(); ctx.arc(16, 11, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgb(20,16,14)"; ctx.fillRect(10, 5, 12, 3); ctx.fillRect(9, 6, 3, 10); ctx.fillRect(20, 6, 3, 10);
        ctx.fillStyle = "rgb(10,10,10)"; ctx.fillRect(13, 10, 2, 2); ctx.fillRect(18, 10, 2, 2);
        ctx.fillStyle = "rgb(210,180,150)"; ctx.fillRect(6, 18, 4, 2); ctx.fillRect(22, 18, 4, 2);
    });
    sprite("toychest", 64, 48, (ctx) => {
        ctx.fillStyle = "rgb(110,70,40)"; ctx.fillRect(6, 20, 52, 26);
        ctx.fillStyle = "rgb(130,86,50)"; ctx.fillRect(4, 14, 56, 8);
        ctx.fillStyle = "rgb(200,80,80)"; [16, 32, 48].forEach(x => { ctx.beginPath(); ctx.arc(x, 33, 4, 0, Math.PI * 2); ctx.fill(); });
        ctx.fillStyle = "rgb(230,200,60)"; [16, 32, 48].forEach(x => { ctx.beginPath(); ctx.arc(x, 33, 1.5, 0, Math.PI * 2); ctx.fill(); });
        ctx.fillStyle = "rgb(150,120,60)"; ctx.fillRect(29, 20, 6, 4);
    });
    sprite("toychest_open", 64, 48, (ctx) => {
        ctx.drawImage(SPC.toychest, 0, 0);
        ctx.clearRect(0, 0, 64, 22);
        ctx.fillStyle = "rgb(130,86,50)"; ctx.fillRect(4, 2, 56, 6);
        ctx.fillStyle = "rgb(10,8,6)"; ctx.fillRect(8, 16, 48, 6);
        ctx.fillStyle = "rgb(200,190,170)"; ctx.fillRect(12, 14, 6, 4); ctx.fillStyle = "rgb(80,120,60)"; ctx.fillRect(40, 14, 8, 5);
    });
    sprite("horse", 64, 64, (ctx) => {
        ctx.strokeStyle = "rgb(110,60,30)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(6, 58); ctx.quadraticCurveTo(32, 66, 58, 58); ctx.stroke(); ctx.lineWidth = 1;
        ctx.fillStyle = "rgb(170,150,120)"; ctx.fillRect(16, 30, 30, 12);
        ctx.fillRect(18, 42, 3, 16); ctx.fillRect(40, 42, 3, 16);
        ctx.beginPath(); ctx.moveTo(42, 32); ctx.lineTo(52, 14); ctx.lineTo(58, 18); ctx.lineTo(50, 34); ctx.fill();
        ctx.fillStyle = "rgb(40,30,20)"; ctx.fillRect(44, 14, 4, 18); ctx.fillRect(14, 30, 4, 10); ctx.fillRect(53, 17, 2, 2);
        ctx.fillStyle = "rgb(150,30,30)"; ctx.fillRect(24, 28, 12, 4);
    });
    sprite("coatstand", 48, 128, (ctx) => {
        ctx.fillStyle = "rgb(40,26,16)"; ctx.fillRect(22, 10, 4, 112); ctx.fillRect(12, 120, 24, 4);
        ctx.fillRect(16, 10, 16, 3);
        // the long dark coat and a hat — in the dark it reads as a man
        ctx.fillStyle = "rgb(20,18,18)";
        ctx.beginPath(); ctx.moveTo(14, 18); ctx.lineTo(34, 18); ctx.lineTo(38, 40); ctx.lineTo(36, 100); ctx.lineTo(12, 100); ctx.lineTo(10, 40); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fillRect(23, 22, 2, 76);
        ctx.fillStyle = "rgb(16,14,14)"; ctx.beginPath(); ctx.ellipse(24, 10, 10, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(18, 2, 12, 8);
        ctx.fillStyle = "rgb(30,28,28)"; ctx.fillRect(10, 40, 3, 34); ctx.fillRect(35, 40, 3, 34);
    });
    sprite("coatstand_empty", 48, 128, (ctx) => {
        ctx.fillStyle = "rgb(40,26,16)"; ctx.fillRect(22, 10, 4, 112); ctx.fillRect(12, 120, 24, 4);
        ctx.fillRect(14, 10, 20, 3); ctx.fillRect(14, 10, 3, 6); ctx.fillRect(31, 10, 3, 6);
    });
    sprite("bathtub", 96, 96, (ctx) => {
        ctx.fillStyle = "rgb(60,60,58)"; ctx.fillRect(6, 4, 84, 3); // rail
        ctx.fillStyle = "rgb(128,122,100)"; // curtain
        ctx.beginPath(); ctx.moveTo(8, 6); for (let x = 8; x <= 88; x += 8) ctx.quadraticCurveTo(x + 4, 10, x + 8, 6); ctx.lineTo(90, 70); ctx.lineTo(8, 70); ctx.fill();
        ctx.strokeStyle = "rgba(60,60,50,0.4)"; for (let x = 12; x < 90; x += 8) { ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x + 2, 70); ctx.stroke(); }
        ctx.fillStyle = "rgba(90,70,40,0.4)"; ctx.fillRect(8, 56, 82, 14);
        ctx.fillStyle = "rgb(200,198,188)"; ctx.beginPath(); ctx.moveTo(4, 62); ctx.lineTo(92, 62); ctx.lineTo(88, 84); ctx.lineTo(8, 84); ctx.fill();
        ctx.fillStyle = "rgb(150,120,60)"; [12, 84].forEach(x => { ctx.fillRect(x, 84, 4, 8); });
    });
    sprite("cot", 96, 64, (ctx) => {
        // charpai, the rope cot, with a filthy blanket
        ctx.fillStyle = "rgb(70,46,26)"; ctx.fillRect(4, 34, 88, 5); ctx.fillRect(6, 39, 5, 22); ctx.fillRect(85, 39, 5, 22);
        ctx.strokeStyle = "rgb(150,130,90)"; for (let x = 10; x < 88; x += 5) { ctx.beginPath(); ctx.moveTo(x, 34); ctx.lineTo(x + 3, 39); ctx.stroke(); }
        ctx.fillStyle = "rgb(60,56,48)"; ctx.beginPath(); ctx.moveTo(14, 34); ctx.quadraticCurveTo(40, 24, 74, 32); ctx.lineTo(74, 36); ctx.lineTo(14, 36); ctx.fill();
        ctx.strokeStyle = "rgb(84,80,76)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(86, 40); ctx.quadraticCurveTo(80, 56, 64, 60); ctx.stroke(); ctx.lineWidth = 1;
    });
    sprite("bowl", 32, 16, (ctx) => {
        ctx.fillStyle = "rgb(170,170,166)"; ctx.beginPath(); ctx.ellipse(16, 10, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgb(200,150,60)"; ctx.beginPath(); ctx.ellipse(16, 9, 7, 2.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgb(230,220,200)"; ctx.fillRect(21, 4, 6, 3);
    });
    sprite("crate", 64, 64, (ctx) => {
        ctx.fillStyle = "rgb(110,82,52)"; ctx.fillRect(6, 22, 52, 40);
        ctx.strokeStyle = "rgb(50,32,18)"; ctx.lineWidth = 3; ctx.strokeRect(7.5, 23.5, 49, 37); ctx.beginPath(); ctx.moveTo(8, 24); ctx.lineTo(56, 60); ctx.stroke(); ctx.lineWidth = 1;
        ctx.fillStyle = "rgb(140,124,90)"; ctx.beginPath(); ctx.ellipse(28, 18, 16, 8, 0, 0, Math.PI * 2); ctx.fill(); // sack on top
    });
    sprite("kclock", 32, 16, (ctx) => {
        ctx.fillStyle = "rgb(140,60,40)"; ctx.beginPath(); ctx.ellipse(16, 10, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgb(214,200,170)"; ctx.beginPath(); ctx.ellipse(16, 9.5, 10, 3.8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgb(20,16,12)"; ctx.beginPath(); ctx.moveTo(16, 9.5); ctx.lineTo(20, 9); ctx.moveTo(16, 9.5); ctx.lineTo(18, 12); ctx.stroke();
        ctx.strokeStyle = "rgba(20,20,20,0.6)"; ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(24, 11); ctx.stroke();
    });
    sprite("chair", 48, 64, (ctx) => {
        ctx.fillStyle = "rgb(64,40,24)"; ctx.fillRect(10, 6, 28, 4); ctx.fillRect(10, 6, 3, 56); ctx.fillRect(35, 6, 3, 56);
        ctx.fillRect(8, 34, 32, 5); ctx.fillRect(12, 39, 3, 23); ctx.fillRect(33, 39, 3, 23);
        for (let k = 0; k < 3; k++) ctx.fillRect(16 + k * 7, 10, 2, 24);
    });
    sprite("chair_fallen", 64, 48, (ctx) => {
        ctx.fillStyle = "rgb(64,40,24)";
        ctx.save(); ctx.translate(32, 38); ctx.rotate(-1.4); ctx.translate(-24, -32);
        ctx.fillRect(10, 6, 28, 4); ctx.fillRect(10, 6, 3, 56); ctx.fillRect(35, 6, 3, 56);
        ctx.fillRect(8, 34, 32, 5); ctx.fillRect(12, 39, 3, 23); ctx.fillRect(33, 39, 3, 23);
        ctx.restore();
    });
    sprite("bulb", 16, 64, (ctx) => {
        ctx.fillStyle = "rgb(20,20,20)"; ctx.fillRect(7, 0, 2, 48);
        ctx.fillStyle = "rgb(60,56,50)"; ctx.fillRect(5, 46, 6, 5);
        ctx.fillStyle = "rgb(120,116,100)"; ctx.beginPath(); ctx.arc(8, 56, 5, 0, Math.PI * 2); ctx.fill();
    });
    sprite("bulb_on", 16, 64, (ctx) => {
        ctx.drawImage(SPC.bulb, 0, 0);
        ctx.fillStyle = "rgb(255,236,190)"; ctx.beginPath(); ctx.arc(8, 56, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgb(255,255,240)"; ctx.beginPath(); ctx.arc(8, 56, 2.5, 0, Math.PI * 2); ctx.fill();
    });
    sprite("lantern", 32, 48, (ctx) => {
        ctx.strokeStyle = "rgb(60,56,50)"; ctx.beginPath(); ctx.arc(16, 8, 6, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = "rgb(70,64,56)"; ctx.fillRect(9, 8, 14, 4); ctx.fillRect(8, 38, 16, 8);
        ctx.fillStyle = "rgba(200,190,170,0.35)"; ctx.beginPath(); ctx.ellipse(16, 25, 8, 13, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgb(60,56,50)"; ctx.beginPath(); ctx.moveTo(8, 12); ctx.lineTo(8, 38); ctx.moveTo(24, 12); ctx.lineTo(24, 38); ctx.stroke();
    });
    sprite("lantern_on", 32, 48, (ctx) => {
        ctx.drawImage(SPC.lantern, 0, 0);
        ctx.fillStyle = "rgba(255,200,110,0.85)"; ctx.beginPath(); ctx.ellipse(16, 26, 6, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgb(255,250,220)"; ctx.beginPath(); ctx.ellipse(16, 28, 2, 4, 0, 0, Math.PI * 2); ctx.fill();
    });
    sprite("flame", 16, 16, (ctx) => {
        const g = ctx.createRadialGradient(8, 10, 0, 8, 10, 7); g.addColorStop(0, "rgba(255,250,220,1)"); g.addColorStop(0.4, "rgba(255,180,80,0.9)"); g.addColorStop(1, "rgba(255,120,30,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(8, 1); ctx.quadraticCurveTo(14, 10, 8, 15); ctx.quadraticCurveTo(2, 10, 8, 1); ctx.fill();
    });
    sprite("keyOnCloth", 32, 16, (ctx) => {
        ctx.fillStyle = "rgb(150,140,120)"; ctx.fillRect(4, 8, 24, 6);
        ctx.fillStyle = "rgb(150,120,60)"; ctx.fillRect(10, 6, 12, 2); ctx.beginPath(); ctx.arc(9, 7, 3, 0, Math.PI * 2); ctx.fill();
    });
    sprite("sofa", 96, 64, (ctx) => {
        ctx.fillStyle = "rgb(70,40,34)"; ctx.fillRect(8, 20, 80, 26); ctx.fillRect(4, 30, 10, 24); ctx.fillRect(82, 30, 10, 24);
        ctx.fillStyle = "rgb(90,52,44)"; ctx.fillRect(14, 40, 68, 12);
        ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(47, 22, 2, 30);
        ctx.fillStyle = "rgb(40,26,16)"; ctx.fillRect(8, 54, 4, 8); ctx.fillRect(84, 54, 4, 8);
        ctx.fillStyle = "rgb(190,180,150)"; ctx.fillRect(20, 26, 14, 10);
    });
    sprite("dressing", 64, 96, (ctx) => {
        ctx.fillStyle = "rgb(70,46,28)"; ctx.fillRect(6, 52, 52, 40); ctx.fillRect(14, 4, 36, 50);
        ctx.fillStyle = "rgb(30,36,40)"; ctx.beginPath(); ctx.ellipse(32, 28, 14, 20, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(220,230,240,0.25)"; ctx.beginPath(); ctx.moveTo(24, 18); ctx.lineTo(28, 12); ctx.stroke();
        ctx.fillStyle = "rgb(200,180,140)"; ctx.fillRect(12, 48, 6, 4); ctx.fillStyle = "rgb(160,20,30)"; ctx.fillRect(44, 47, 3, 5);
        ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(10, 60, 44, 1); ctx.fillRect(10, 74, 44, 1);
    });
}

/* ======================================================================
   GHOST — cut the figure out of ghost.png, darken it into a silhouette
   ====================================================================== */
ART.ghost = null;
ART.ghostFace = null;
ART.loadGhost = function (src, done) {
    const img = new Image();
    img.onload = () => {
        try {
            const w = img.naturalWidth, h = img.naturalHeight, c = cv(w, h), ctx = g2(c);
            ctx.drawImage(img, 0, 0);
            const id = ctx.getImageData(0, 0, w, h), d = id.data, seen = new Uint8Array(w * h), stack = [];
            const isBg = (i) => {
                const r = d[i], g = d[i + 1], b = d[i + 2];
                const sat = Math.max(r, g, b) - Math.min(r, g, b), lum = 0.299 * r + 0.587 * g + 0.114 * b;
                return sat < 24 && lum > 168;
            };
            for (let x = 0; x < w; x++) { stack.push(x, 0, x, h - 1); }
            for (let y = 0; y < h; y++) { stack.push(0, y, w - 1, y); }
            while (stack.length) {
                const y = stack.pop(), x = stack.pop(), p = y * w + x;
                if (x < 0 || y < 0 || x >= w || y >= h || seen[p]) continue;
                seen[p] = 1;
                if (!isBg(p * 4)) continue;
                d[p * 4 + 3] = 0;
                stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
            }
            // remove stray watermark specks: any light low-saturation pixel left becomes transparent
            let minX = w, minY = h, maxX = 0, maxY = 0;
            for (let p = 0; p < w * h; p++) {
                const i = p * 4;
                if (d[i + 3] === 0) continue;
                const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                if (lum > 150) { d[i + 3] = 0; continue; }
                // darken into a near-black silhouette that still keeps the cloth folds
                const k = 0.28 + (lum / 255) * 0.25;
                d[i] = d[i] * k; d[i + 1] = d[i + 1] * k; d[i + 2] = d[i + 2] * k * 1.1;
                const x = p % w, y = (p / w) | 0;
                if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
            }
            // erode isolated pixels (watermark fragments) by requiring neighbours
            const keep = new Uint8Array(w * h);
            for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
                const p = y * w + x; if (!d[p * 4 + 3]) continue;
                let n = 0; for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) if (d[((y + yy) * w + x + xx) * 4 + 3]) n++;
                keep[p] = n >= 6 ? 1 : 0;
            }
            for (let p = 0; p < w * h; p++) if (!keep[p]) d[p * 4 + 3] = 0;
            ctx.putImageData(id, 0, 0);
            const bw = maxX - minX + 1, bh = maxY - minY + 1;
            const outH = 160, outW = Math.round(outH * bw / bh);
            const o = cv(outW, outH), oc = g2(o);
            oc.imageSmoothingEnabled = true;
            oc.drawImage(c, minX, minY, bw, bh, 0, 0, outW, outH);
            ART.ghost = toTex(o);
            ART.ghostCanvas = o;
        } catch (e) {
            console.warn("ghost cut-out failed", e);
            ART.ghost = fallbackGhost();
        }
        done && done();
    };
    img.onerror = () => { ART.ghost = fallbackGhost(); done && done(); };
    img.src = src;
};
function fallbackGhost() {
    const c = cv(60, 160), ctx = g2(c);
    ctx.fillStyle = "rgb(14,13,14)";
    ctx.beginPath(); ctx.ellipse(30, 22, 12, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(14, 34); ctx.lineTo(46, 34); ctx.lineTo(54, 150); ctx.lineTo(6, 150); ctx.fill();
    ctx.fillStyle = "rgb(0,0,0)"; ctx.beginPath(); ctx.ellipse(30, 24, 7, 10, 0, 0, Math.PI * 2); ctx.fill();
    ART.ghostCanvas = c;
    return toTex(c);
}

/* ======================================================================
   BUILD
   ====================================================================== */
ART.base = baseCanvases;

/* each wall style gets three variants (different stains, cracks, wear)
   so neighbouring wall tiles never look copy-pasted */
function variants(fn, name, o, n) {
    fn(name, o);
    for (let k = 1; k < (n || 3); k++) {
        const o2 = Object.assign({}, o, { seed: (o.seed || 1) * 31 + k * 7 });
        if (o.peel && typeof o.peel === "number") o2.peel = Math.max(0, o.peel + (k === 1 ? -1 : 1));
        
        fn(name + "#" + k, o2);
    }
}
ART.build = function () {
    variants(plaster, "w_lime", { base: [150, 126, 92], dado: [110, 46, 34], seed: 1, cracks: 4 });
    variants(plaster, "w_limeDark", { base: [128, 110, 84], dado: [90, 40, 30], seed: 2, cracks: 5, peel: 2 });
    variants(plaster, "w_prayer", { base: [176, 150, 108], dado: [140, 56, 30], seed: 3, cracks: 2, seep: 0.5 });
    variants(plaster, "w_servant", { base: [112, 104, 92], seed: 4, cracks: 8, peel: 4, stain: 1.0 });
    variants(plaster, "w_store", { base: [104, 98, 86], seed: 6, cracks: 6, peel: 3, stain: 1.0 });
    variants(plaster, "w_kitchenTop", { base: [120, 110, 90], seed: 5, cracks: 3 });
    variants(wallpaper, "w_parlor", { base: [46, 66, 54], motif: [70, 96, 74], pattern: "damask", dado: [54, 34, 20], seed: 11, peel: true });
    variants(wallpaper, "w_dining", { base: [92, 36, 34], motif: [112, 52, 44], pattern: "stripe", dado: [50, 32, 20], seed: 12 });
    variants(wallpaper, "w_bedroom", { base: [120, 84, 80], motif: [140, 60, 64], pattern: "floral", seed: 13, peel: true });
    variants(wallpaper, "w_nursery", { base: [120, 140, 150], motif: [200, 190, 120], pattern: "stars", seed: 14, under: [180, 170, 150], peel: true });
    variants(wallpaper, "w_corridor", { base: [70, 74, 50], motif: [92, 96, 64], pattern: "damask", dado: [48, 30, 18], seed: 15 });
    variants(panel, "w_study", { base: [74, 46, 28], seed: 21 });
    variants(tiles, "w_kitchen", { base: [190, 180, 150], grout: [90, 84, 70], upper: [112, 100, 80], upperH: 46, seed: 31, soot: true });
    variants(tiles, "w_bath", { base: [150, 180, 172], grout: [70, 80, 76], size: 12, seed: 32 });
    variants(brick, "w_brick", { base: [110, 60, 44], mortar: [70, 66, 58], seed: 41 });
    variants(brick, "w_brickDark", { base: [84, 50, 40], mortar: [50, 48, 44], seed: 42 });
    crates("w_crates", 51);
    stonePillar("w_pillar");
    windowTex("w_jaali", "jaali", "w_lime");
    windowTex("w_window_parlor", "bars", "w_parlor");
    windowTex("w_window_dining", "bars", "w_dining");
    windowTex("w_window_prayer", "jaali", "w_prayer");
    windowTex("w_window_study", "bars", "w_study");
    windowTex("w_window_bed", "bars", "w_bedroom");
    windowTex("w_window_nursery", "bars", "w_nursery");
    windowTex("w_window_corr", "jaali", "w_corridor");
    windowTex("w_window_bath", "bars", "w_bath");
    stairsTex("w_stairsUp", "up", "w_lime");
    stairsTex("w_stairsDown", "down", "w_corridor");
    stairsTex("w_stairsDownK", "down", "w_kitchenTop");
    stairsTex("w_stairsUpB", "up", "w_brick");
    doorLeaf("d_room", { base: [86, 56, 34], panels: true, seed: 22 });
    doorLeaf("d_study", { base: [60, 36, 20], panels: true, carved: true, plate: "STUDY", seed: 23 });
    doorLeaf("d_plain", { base: [96, 76, 52], planks: true, seed: 24, handleX: 100 });
    doorLeaf("d_bolted", { base: [90, 70, 48], planks: true, seed: 25, extra: (ctx) => { ctx.fillStyle = "rgb(90,90,86)"; ctx.fillRect(84, 58, 30, 6); ctx.fillRect(108, 54, 8, 14); } });
    doorLeaf("d_attic", { base: [70, 50, 34], planks: true, scratches: true, seed: 26 });
    doorLeaf("d_cellar", { base: [80, 60, 40], planks: true, seed: 27, extra: (ctx) => {
        ctx.strokeStyle = "rgb(110,104,96)"; ctx.lineWidth = 3;
        for (let x = 20; x < 108; x += 8) { ctx.beginPath(); ctx.ellipse(x, 70 + Math.sin(x * 0.3) * 3, 4, 2.5, 0, 0, Math.PI * 2); ctx.stroke(); }
        ctx.lineWidth = 1; ctx.fillStyle = "rgb(120,100,50)"; ctx.fillRect(58, 70, 14, 16);
    } });
    doorLeaf("d_cellarOpen", { base: [80, 60, 40], planks: true, seed: 27 });
    doorLeaf("d_cupboard", { base: [76, 50, 30], panels: true, seed: 28, handleX: 60, extra: (ctx) => {
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(63, 0, 2, 128);
        ctx.fillStyle = "rgb(16,10,6)"; for (let y = 16; y < 120; y += 26) { ctx.fillRect(10, y, 50, 18); ctx.fillRect(68, y, 50, 18); }
        const r = rng(5); for (let y = 16; y < 120; y += 26) for (let x = 12; x < 116; x += 5) { if (x > 58 && x < 68) continue; ctx.fillStyle = rgb(60 + r() * 60, 30 + r() * 30, 20 + r() * 20); ctx.fillRect(x, y + 18 - (8 + r() * 9), 4, 8 + r() * 9); }
    } });
    doorLeaf("d_cupboardBack", { base: [70, 52, 36], planks: true, seed: 29, handleX: -10 });
    gateTex("d_gate");
    steelDoor("d_steel", "off"); steelDoor("d_steelRed", "red"); steelDoor("d_steelGreen", "green");
    jamb("w_jamb");
    buildFloors();
    buildSprites();
};

/* compose a wall face: base + decal(state). Returns a fresh texture. */
const faceCanvas = cv(WALL, WALL);
ART.compose = function (baseName, decal, state) {
    const ctx = g2(faceCanvas);
    ctx.clearRect(0, 0, WALL, WALL);
    if (baseCanvases[baseName]) ctx.drawImage(baseCanvases[baseName], 0, 0);
    if (decal && DEC[decal]) DEC[decal](ctx, state || {});
    const t = toTex(faceCanvas);
    if (windowBases[baseName]) t.gm = skyMask(t);
    return t;
};

/* icons for the inventory (drawn larger, transparent) */
ART.icon = function (id) {
    const c = cv(48, 48), ctx = g2(c);
    ctx.lineCap = "round";
    const key = (col, tag) => {
        ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(14, 24, 7, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(21, 24); ctx.lineTo(40, 24); ctx.moveTo(34, 24); ctx.lineTo(34, 31); ctx.moveTo(39, 24); ctx.lineTo(39, 29); ctx.stroke();
        if (tag) { ctx.fillStyle = "rgb(200,190,160)"; ctx.fillRect(4, 32, 14, 9); ctx.strokeStyle = "rgb(120,110,90)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(10, 32); ctx.lineTo(13, 28); ctx.stroke(); }
    };
    if (id === "studyKey") key("rgb(160,140,90)", true);
    else if (id === "gateKey") key("rgb(200,160,70)", true);
    else if (id === "cellarKey") key("rgb(120,110,100)", false);
    else if (id === "keyring") { key("rgb(150,140,110)", false); ctx.strokeStyle = "rgb(190,160,80)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(18, 30); ctx.lineTo(26, 42); ctx.stroke(); ctx.strokeRect(24, 40, 6, 4); }
    else if (id === "fuse") {
        ctx.fillStyle = "rgb(210,206,190)"; ctx.fillRect(14, 10, 20, 28);
        ctx.fillStyle = "rgb(150,120,60)"; ctx.fillRect(18, 6, 12, 5); ctx.fillRect(18, 37, 12, 5);
        ctx.fillStyle = "rgb(60,50,40)"; ctx.font = "7px monospace"; ctx.fillText("30A", 17, 26);
    } else if (id === "photo") {
        ctx.save(); ctx.translate(24, 24); ctx.rotate(-0.15);
        ctx.fillStyle = "rgb(210,200,180)"; ctx.fillRect(-16, -12, 32, 24);
        ctx.fillStyle = "rgb(110,100,84)"; ctx.fillRect(-13, -9, 26, 18);
        bust(ctx, -6, -1, 6, "man", "scratched", "rgb(150,130,110)"); bust(ctx, 5, -1, 6, "woman", "normal", "rgb(150,130,110)"); bust(ctx, 0, 3, 4, "girl", "normal", "rgb(150,130,110)");
        ctx.restore();
    }
    return c.toDataURL();
};

})();
