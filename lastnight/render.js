/* =====================================================================
   THE LAST NIGHT — software renderer
   A classic grid raycaster drawn into a low-res pixel buffer:
   textured walls (hinged + sliding doors), floor/ceiling casting, a
   baked per-tile lightmap, a swaying flashlight cone, billboard props,
   rain over the courtyard and dust in the beam.
   ===================================================================== */
(function () {
"use strict";
const LN = window.LN = window.LN || {};
const R = LN.render = {};
const W = () => LN.world;

let canvas, ctx, off, offCtx, img, data8;
let RW = 0, RH = 0, P = 1, TANH = 0.7;
const TANV = 0.43;
let zbuf, wallBot, wallTop, spot, spotW, spotH, colDir;
const SPOT_M = 48;
const aoTab = new Float32Array(128);
for (let i = 0; i < 128; i++) { const v = i / 127; aoTab[i] = 0.62 + 0.38 * Math.min(1, v * 6) * Math.min(1, (1 - v) * 10 + 0.55); }
let grain = [];

R.init = function (cv) {
    canvas = cv; ctx = canvas.getContext("2d", { alpha: false });
    off = document.createElement("canvas"); offCtx = off.getContext("2d");
    for (let k = 0; k < 4; k++) {
        const g = document.createElement("canvas"); g.width = g.height = 192;
        const gc = g.getContext("2d"), id = gc.createImageData(192, 192);
        for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
        gc.putImageData(id, 0, 0); grain.push(g);
    }
    R.resize();
};
R.resize = function () {
    const sw = window.innerWidth, sh = window.innerHeight;
    canvas.width = sw; canvas.height = sh;
    RH = Math.max(200, Math.min(300, Math.round(sh / 3)));
    if (R.lowRes) RH = Math.round(RH * 0.78);
    RW = Math.min(620, Math.round(RH * sw / sh));
    off.width = RW; off.height = RH;
    img = offCtx.createImageData(RW, RH); data8 = img.data;
    for (let i = 3; i < data8.length; i += 4) data8[i] = 255;
    P = (RH / 2) / TANV;
    TANH = (RW / 2) / P;
    zbuf = new Float32Array(RW); wallBot = new Int16Array(RW); wallTop = new Int16Array(RW);
    colDir = new Float32Array(RW * 2);
    // flashlight cone mask (oversized so it can sway)
    spotW = RW + SPOT_M * 2; spotH = RH + SPOT_M * 2;
    spot = new Float32Array(spotW * spotH);
    const cx = spotW / 2, cy = spotH / 2 + RH * 0.04;
    for (let y = 0; y < spotH; y++) for (let x = 0; x < spotW; x++) {
        const dx = (x - cx) / (RH * 0.62), dy = (y - cy) / (RH * 0.56), d = Math.hypot(dx, dy);
        const core = Math.max(0, 1 - d), hot = Math.max(0, 1 - d * 2.4);
        spot[y * spotW + x] = Math.pow(core, 1.5) * 0.95 + hot * hot * 0.35 + 0.07 * Math.max(0, 1 - d * 0.4);
    }
};
R.size = () => ({ RW, RH, P });

/* torch falloff: soft up close (no blown-out walls), long reach down corridors */
function beamFall(d) { return d / (0.6 + d) * 1.25 / (1 + d * d * 0.09); }

/* bilinear lightmap sample into out[0..2] */
const LMS = [0, 0, 0];
function sampleLM(F, x, y, out) {
    const LM = 4, gx = x * LM - 0.5, gy = y * LM - 0.5;
    let ix = gx | 0, iy = gy | 0;
    const fx = gx - ix, fy = gy - iy;
    if (ix < 0) ix = 0; if (iy < 0) iy = 0;
    if (ix >= F.lmW - 1) ix = F.lmW - 2; if (iy >= F.lmH - 1) iy = F.lmH - 2;
    const lm = F.lm, w3 = F.lmW * 3, i = (iy * F.lmW + ix) * 3;
    const a = (1 - fx) * (1 - fy), b = fx * (1 - fy), c = (1 - fx) * fy, d = fx * fy;
    out[0] = lm[i] * a + lm[i + 3] * b + lm[i + w3] * c + lm[i + w3 + 3] * d;
    out[1] = lm[i + 1] * a + lm[i + 4] * b + lm[i + w3 + 1] * c + lm[i + w3 + 4] * d;
    out[2] = lm[i + 2] * a + lm[i + 5] * b + lm[i + w3 + 2] * c + lm[i + w3 + 5] * d;
}
function sampleLMNearest(F, x, y, out) {
    let ix = (x * 4) | 0, iy = (y * 4) | 0;
    if (ix < 0) ix = 0; if (iy < 0) iy = 0; if (ix >= F.lmW) ix = F.lmW - 1; if (iy >= F.lmH) iy = F.lmH - 1;
    const i = (iy * F.lmW + ix) * 3;
    out[0] = F.lm[i]; out[1] = F.lm[i + 1]; out[2] = F.lm[i + 2];
}
R.sampleLight = function (F, x, y) { sampleLM(F, x, y, LMS); return (LMS[0] + LMS[1] + LMS[2]) / 3; };

/* per-floor caches of floor / ceiling textures */
function prepFloor(F) {
    if (F._prep) return;
    const ART = LN.art, n = F.w * F.h;
    F.flTex = new Array(n); F.ceTex = new Array(n);
    for (let i = 0; i < n; i++) {
        const z = F.zone[i];
        F.flTex[i] = z ? ART.tex[z.floor] : null;
        F.ceTex[i] = z ? (z.sky ? null : ART.tex[z.ceil]) : null;
    }
    F._prep = true;
}

/* ------------------------------------------------------------------ */
R.render = function (F, cam, fx) {
    prepFloor(F);
    const ART = LN.art, w = LN.world;
    const dirX = Math.cos(cam.a), dirY = Math.sin(cam.a);
    const plX = -dirY * TANH, plY = dirX * TANH;
    const WH = F.cfg.wallH, camZ = cam.z, horizon = (RH >> 1) + (cam.horizon || 0);
    const fogD = F.cfg.fog, fogC = F.cfg.fogCol;
    const flashOn = fx.flash, fcr = 1.85 * flashOn, fcg = 1.7 * flashOn, fcb = 1.45 * flashOn;
    const sox = SPOT_M + (fx.swayX | 0), soy = SPOT_M + (fx.swayY | 0);
    const px = cam.x, py = cam.y;
    const jambTex = ART.tex.w_jamb;
    const lmTmp = [0, 0, 0];
    const ex = fx.exposure || 1;

    /* ================= WALLS ================= */
    for (let x = 0; x < RW; x++) {
        const camX = 2 * x / RW - 1;
        const rdx = dirX + plX * camX, rdy = dirY + plY * camX;
        colDir[x * 2] = rdx; colDir[x * 2 + 1] = rdy;
        let mapX = px | 0, mapY = py | 0;
        const ddx = Math.abs(1 / (rdx || 1e-9)), ddy = Math.abs(1 / (rdy || 1e-9));
        let stepX, stepY, sdx, sdy;
        if (rdx < 0) { stepX = -1; sdx = (px - mapX) * ddx; } else { stepX = 1; sdx = (mapX + 1 - px) * ddx; }
        if (rdy < 0) { stepY = -1; sdy = (py - mapY) * ddy; } else { stepY = 1; sdy = (mapY + 1 - py) * ddy; }
        let dist = 0, tex = null, u = 0, side = 0, hit = false, prevDoor = false, lx = 0, ly = 0;
        // a door in the cell we're standing in
        let cell = mapY * F.w + mapX;
        if (F.solid[cell] === 2) {
            const r = doorHit(F, cell, px, py, rdx, rdy, 0.02);
            if (r) { dist = r.t; tex = r.tex; u = r.u; hit = true; lx = px + rdx * (dist - 0.05); ly = py + rdy * (dist - 0.05); }
            else prevDoor = true;
        }
        let guard = 80;
        while (!hit && guard-- > 0) {
            let tEnter;
            if (sdx < sdy) { tEnter = sdx; sdx += ddx; mapX += stepX; side = 0; }
            else { tEnter = sdy; sdy += ddy; mapY += stepY; side = 1; }
            if (mapX < 0 || mapY < 0 || mapX >= F.w || mapY >= F.h) { dist = tEnter; tex = null; hit = true; break; }
            cell = mapY * F.w + mapX;
            const s = F.solid[cell];
            if (s === 1) {
                dist = tEnter;
                let face;
                if (side === 0) { face = stepX > 0 ? 3 : 1; u = py + dist * rdy; u -= Math.floor(u); if (stepX < 0) u = 1 - u; }
                else { face = stepY > 0 ? 0 : 2; u = px + dist * rdx; u -= Math.floor(u); if (stepY > 0) u = 1 - u; }
                tex = prevDoor ? jambTex : F.faces[cell * 4 + face];
                // light sampled just in front of the face
                lx = px + rdx * dist - (side === 0 ? stepX * 0.13 : 0);
                ly = py + rdy * dist - (side === 1 ? stepY * 0.13 : 0);
                hit = true; break;
            }
            if (s === 2) {
                const r = doorHit(F, cell, px, py, rdx, rdy, tEnter - 0.001);
                if (r) { dist = r.t; tex = r.tex; u = r.u; hit = true; lx = px + rdx * (dist - 0.08); ly = py + rdy * (dist - 0.08); break; }
                prevDoor = true;
            } else prevDoor = false;
        }
        if (dist < 0.05) dist = 0.05;
        zbuf[x] = dist;
        const lineH = P / dist;
        const top = horizon - (WH - camZ) * lineH, bot = horizon + camZ * lineH;
        let ys = Math.ceil(top), ye = Math.ceil(bot);
        if (ys < 0) ys = 0; if (ye > RH) ye = RH;
        wallTop[x] = ys; wallBot[x] = ye;
        if (!tex) { for (let y = ys; y < ye; y++) { const p = (y * RW + x) * 4; data8[p] = data8[p + 1] = data8[p + 2] = 0; } continue; }
        sampleLMNearest(F, lx, ly, lmTmp);
        const fog = Math.exp(-dist * fogD), fogI = 1 - fog;
        const sd = (side ? 0.86 : 1) * ex, lr = lmTmp[0] * sd, lg = lmTmp[1] * sd, lb = lmTmp[2] * sd;
        const fall = beamFall(dist);
        const tw = tex.w, th = tex.h, td = tex.d, gm = tex.gm, glow = (fx.moon || 1) * (0.55 + 0.45 * fog);
        let tx = (u * tw) | 0; if (tx >= tw) tx = tw - 1; if (tx < 0) tx = 0;
        const texStep = th / (bot - top);
        let texPos = (ys - top) * texStep;
        const fr = fogC[0] * fogI, fg = fogC[1] * fogI, fb = fogC[2] * fogI;
        let si = (ys + soy) * spotW + x + sox;
        for (let y = ys; y < ye; y++, si += spotW) {
            let ty = texPos | 0; if (ty >= th) ty = th - 1;
            texPos += texStep;
            const ti = (ty * tw + tx) * 4;
            const p = (y * RW + x) * 4;
            if (gm && gm[ty * tw + tx]) { data8[p] = td[ti] * glow; data8[p + 1] = td[ti + 1] * glow; data8[p + 2] = td[ti + 2] * glow; continue; }
            const fl = spot[si] * fall;
            const ao = aoTab[(ty * 127 / (th - 1)) | 0] * fog;
            data8[p] = td[ti] * (lr + fl * fcr) * ao + fr;
            data8[p + 1] = td[ti + 1] * (lg + fl * fcg) * ao + fg;
            data8[p + 2] = td[ti + 2] * (lb + fl * fcb) * ao + fb;
        }
    }

    /* ================= FLOOR & CEILING ================= */
    const rdx0 = dirX - plX, rdy0 = dirY - plY, rdx1 = dirX + plX, rdy1 = dirY + plY;
    const sky = ART.tex.sky, skyD = sky.d, skyMul = fx.skyMul || 1, tShift = fx.time * 0.02;
    for (let y = 0; y < RH; y++) {
        const isFloor = y > horizon;
        const dy = isFloor ? (y - horizon) : (horizon - y);
        if (dy < 0.5) continue;
        const rowDist = (isFloor ? camZ : (WH - camZ)) * P / dy;
        const stepX = rowDist * (rdx1 - rdx0) / RW, stepY = rowDist * (rdy1 - rdy0) / RW;
        let wx = px + rowDist * rdx0, wy = py + rowDist * rdy0;
        const fog = Math.exp(-rowDist * fogD), fogI = 1 - fog;
        const fr = fogC[0] * fogI, fg = fogC[1] * fogI, fb = fogC[2] * fogI;
        const fall = beamFall(rowDist) * (isFloor ? 1 : 0.6);
        let si = (y + soy) * spotW + sox;
        let p = y * RW * 4;
        const shade = isFloor ? fog : fog * 0.8;
        for (let x = 0; x < RW; x++, wx += stepX, wy += stepY, si++, p += 4) {
            if (isFloor ? (y < wallBot[x]) : (y >= wallTop[x])) continue;
            const cx = wx | 0, cy = wy | 0;
            if (cx < 0 || cy < 0 || cx >= F.w || cy >= F.h) { data8[p] = data8[p + 1] = data8[p + 2] = 0; continue; }
            const ci = cy * F.w + cx;
            const tex = isFloor ? F.flTex[ci] : F.ceTex[ci];
            if (!tex) {
                if (!isFloor && F.sky[ci]) {
                    const sx = (((wx * 0.25 + tShift) * 128) | 0) & 127, sy = (((wy * 0.25) * 128) | 0) & 127, k = (sy * 128 + sx) * 4;
                    data8[p] = skyD[k] * skyMul; data8[p + 1] = skyD[k + 1] * skyMul; data8[p + 2] = skyD[k + 2] * skyMul;
                } else { data8[p] = fr; data8[p + 1] = fg; data8[p + 2] = fb; }
                continue;
            }
            const tw = tex.w, td = tex.d;
            const ti = ((((wy - cy) * tw) | 0) * tw + (((wx - cx) * tw) | 0)) * 4;
            sampleLM(F, wx, wy, lmTmp);
            const fl = spot[si] * fall;
            data8[p] = td[ti] * (lmTmp[0] * ex + fl * fcr) * shade + fr;
            data8[p + 1] = td[ti + 1] * (lmTmp[1] * ex + fl * fcg) * shade + fg;
            data8[p + 2] = td[ti + 2] * (lmTmp[2] * ex + fl * fcb) * shade + fb;
        }
    }

    /* ================= SPRITES ================= */
    const invDet = 1 / (plX * dirY - dirX * plY);
    const list = R._list || (R._list = []);
    list.length = 0;
    const consider = (s) => {
        const rx = s.x - px, ry = s.y - py;
        const tX = invDet * (dirY * rx - dirX * ry), tY = invDet * (-plY * rx + plX * ry);
        if (tY < 0.1) return;
        s._tx = tX; s._ty = tY; list.push(s);
    };
    for (let i = 0; i < F.sprites.length; i++) { const s = F.sprites[i]; if (s.visible) consider(s); }
    if (fx.extra) for (let i = 0; i < fx.extra.length; i++) consider(fx.extra[i]);
    list.sort((a, b) => b._ty - a._ty);
    for (let k = 0; k < list.length; k++) drawSprite(F, list[k], horizon, camZ, fogD, fogC, fcr, fcg, fcb, sox, soy, fx);

    /* ================= RAIN ================= */
    if (fx.rain && fx.rain.length) {
        for (let i = 0; i < fx.rain.length; i++) {
            const d = fx.rain[i];
            const rx = d.x - px, ry = d.y - py;
            const tX = invDet * (dirY * rx - dirX * ry), tY = invDet * (-plY * rx + plX * ry);
            if (tY < 0.2 || tY > 9) continue;
            const sx = ((RW / 2) * (1 + tX / tY)) | 0;
            if (sx < 0 || sx >= RW || tY >= zbuf[sx]) continue;
            const yb = horizon + (camZ - d.z) * P / tY, len = Math.max(2, 0.16 * P / tY);
            let y0 = (yb - len) | 0, y1 = yb | 0;
            if (y0 < 0) y0 = 0; if (y1 > RH) y1 = RH;
            const a = Math.min(0.5, 0.9 / tY) * (fx.lightning ? 2 : 1);
            for (let y = y0; y < y1; y++) { const p = (y * RW + sx) * 4; data8[p] += 90 * a; data8[p + 1] += 100 * a; data8[p + 2] += 120 * a; }
        }
    }
    /* ================= DUST IN THE BEAM ================= */
    if (fx.dust && flashOn > 0.2) {
        for (let i = 0; i < fx.dust.length; i++) {
            const d = fx.dust[i];
            const rx = d.x - px, ry = d.y - py;
            const tX = invDet * (dirY * rx - dirX * ry), tY = invDet * (-plY * rx + plX * ry);
            if (tY < 0.15 || tY > 2.6) continue;
            const sx = ((RW / 2) * (1 + tX / tY)) | 0, sy = (horizon + (camZ - d.z) * P / tY) | 0;
            if (sx < 0 || sx >= RW || sy < 0 || sy >= RH || tY >= zbuf[sx]) continue;
            const b = spot[(sy + soy) * spotW + sx + sox] * flashOn * 70 / (1 + tY);
            const p = (sy * RW + sx) * 4;
            data8[p] += b; data8[p + 1] += b * 0.92; data8[p + 2] += b * 0.8;
        }
    }

    /* ================= DISTORTION (when it is close) ================= */
    if (fx.distort > 0.02) {
        const n = (fx.distort * 18) | 0;
        for (let k = 0; k < n; k++) {
            const y = (Math.random() * RH) | 0, h = 1 + ((Math.random() * 4) | 0), sh = ((Math.random() - 0.5) * fx.distort * 24) | 0;
            for (let yy = y; yy < Math.min(RH, y + h); yy++) {
                const row = yy * RW * 4;
                if (sh > 0) data8.copyWithin(row + sh * 4, row, row + (RW - sh) * 4);
                else if (sh < 0) data8.copyWithin(row, row - sh * 4, row + RW * 4);
            }
        }
    }

    offCtx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
    // film grain
    ctx.globalAlpha = 0.055 + (fx.distort || 0) * 0.12;
    ctx.globalCompositeOperation = "overlay";
    const gimg = grain[(Math.random() * 4) | 0], ox = -(Math.random() * 192) | 0, oy = -(Math.random() * 192) | 0;
    for (let y = oy; y < canvas.height; y += 192 * 2) for (let x = ox; x < canvas.width; x += 192 * 2) ctx.drawImage(gimg, x, y, 384, 384);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
};

/* intersect a ray with a door leaf in cell; returns {t,u,tex} */
function doorHit(F, cell, px, py, rdx, rdy, tMin) {
    const d = F.doors.get(cell);
    if (!d) return null;
    const s = LN.world.doorSeg(d);
    const ex = s.bx - s.ax, ey = s.by - s.ay;
    const den = rdx * ey - rdy * ex;
    if (Math.abs(den) < 1e-9) return null;
    const qx = s.ax - px, qy = s.ay - py;
    const t = (qx * ey - qy * ex) / den;
    const v = (qx * rdy - qy * rdx) / den;
    if (t < tMin || v < 0 || v > 1) return null;
    // which side of the leaf are we looking at?
    const cross = ex * (py - s.ay) - ey * (px - s.ax);
    const back = d.texBack && cross < 0;
    const ART = LN.art;
    return { t, u: s.u0 + v * (s.u1 - s.u0), tex: ART.tex[back ? d.texBack : d.tex] };
}

function drawSprite(F, s, horizon, camZ, fogD, fogC, fcr, fcg, fcb, sox, soy, fx) {
    const ART = LN.art;
    const tex = s.tex || ART.spr[s.spr];
    if (!tex) return;
    const tY = s._ty, tX = s._tx;
    const scrX = (RW / 2) * (1 + tX / tY);
    const sh = s.h * P / tY, sw = s.w * P / tY;
    const bottom = horizon + (camZ - s.z) * P / tY, top = bottom - sh;
    let x0 = Math.ceil(scrX - sw / 2), x1 = Math.ceil(scrX + sw / 2);
    if (x1 <= 0 || x0 >= RW) return;
    let y0 = Math.ceil(top), y1 = Math.ceil(bottom);
    if (y0 < 0) y0 = 0; if (y1 > RH) y1 = RH;
    if (y0 >= y1) return;
    let lr = 1, lg = 1, lb = 1;
    if (!s.fullbright) { const ex = fx.exposure || 1; sampleLM(F, s.x, s.y, LMS); lr = LMS[0] * ex; lg = LMS[1] * ex; lb = LMS[2] * ex; }
    const fog = Math.exp(-tY * fogD), fogI = 1 - fog;
    const fr = fogC[0] * fogI, fg = fogC[1] * fogI, fb = fogC[2] * fogI;
    const fall = s.fullbright ? 0 : beamFall(tY);
    const tw = tex.w, th = tex.h, td = tex.d;
    const alpha = s.alpha, blend = alpha < 0.99;
    const flick = s.fullbright ? (s.glow || 1) : 1;
    const sx0 = x0 < 0 ? 0 : x0, sx1 = x1 > RW ? RW : x1;
    const jit = s.jitter || 0;
    for (let x = sx0; x < sx1; x++) {
        if (tY >= zbuf[x]) continue;
        let txx = (((x - (scrX - sw / 2)) / sw) * tw) | 0;
        if (jit) txx += ((Math.random() - 0.5) * jit * tw * 0.1) | 0;
        if (txx < 0 || txx >= tw) continue;
        let si = (y0 + soy) * spotW + x + sox;
        for (let y = y0; y < y1; y++, si += spotW) {
            const ty = (((y - top) / sh) * th) | 0;
            if (ty < 0 || ty >= th) continue;
            const ti = (ty * tw + txx) * 4;
            const a = td[ti + 3];
            if (a < 110) continue;
            const p = (y * RW + x) * 4;
            let r, g, b;
            if (s.fullbright) { r = td[ti] * flick; g = td[ti + 1] * flick; b = td[ti + 2] * flick; }
            else {
                const fl = spot[si] * fall;
                r = td[ti] * (lr + fl * fcr) * fog + fr;
                g = td[ti + 1] * (lg + fl * fcg) * fog + fg;
                b = td[ti + 2] * (lb + fl * fcb) * fog + fb;
            }
            if (blend) { const ia = 1 - alpha; data8[p] = data8[p] * ia + r * alpha; data8[p + 1] = data8[p + 1] * ia + g * alpha; data8[p + 2] = data8[p + 2] * ia + b * alpha; }
            else { data8[p] = r; data8[p + 1] = g; data8[p + 2] = b; }
        }
    }
}

/* where a world point lands on screen (for interaction checks); null if hidden */
R.project = function (cam, x, y, z) {
    const dirX = Math.cos(cam.a), dirY = Math.sin(cam.a), plX = -dirY * TANH, plY = dirX * TANH;
    const invDet = 1 / (plX * dirY - dirX * plY), rx = x - cam.x, ry = y - cam.y;
    const tX = invDet * (dirY * rx - dirX * ry), tY = invDet * (-plY * rx + plX * ry);
    if (tY < 0.05) return null;
    const sx = (RW / 2) * (1 + tX / tY);
    const col = sx | 0;
    return { sx: sx / RW, depth: tY, visible: col >= 0 && col < RW && tY <= zbuf[col] + 0.15, onScreen: col >= 0 && col < RW };
};
R.depthAtCenter = () => zbuf ? zbuf[RW >> 1] : 99;

})();
