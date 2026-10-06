/* =====================================================================
   THE LAST NIGHT — the house's script
   Notes, items, every interaction, the three puzzles and the director
   that makes the house react to what the player does.

   Progression
     1  Unease ............ explore; the house seems empty
     2  Something wrong ... study key from the well, first sighting
     3  Investigation ..... clock puzzle in the study opens the stairs
     4  The house is alive  upstairs; coat key, fuse, power in the cellar
     5  Danger ............ the key ring wakes him: chase / hide
     6  Escape ............ unlock the front door, wind the hall clock
   ===================================================================== */
(function () {
"use strict";
const LN = window.LN;
const A = LN.audio, W = LN.world, G = LN.G;
const C = LN.content = {};
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
let S = null, RT = null;

/* ======================================================================
   ITEMS
   ====================================================================== */
C.ITEMS = {
    studyKey: { name: "Small iron key", desc: "Pulled up from the well, wrapped in a wet cloth. Long black hair was wound around it." },
    gateKey: { name: "Brass key — “UPAR”", desc: "From inside the study clock. The paper tag says UPAR: upstairs." },
    photo: { name: "Family photograph", desc: "Diwali 1986. A man, a woman, a little girl. The man's face has been scratched out." },
    cellarKey: { name: "Heavy iron key", desc: "From the pocket of the coat upstairs. The lining was still warm." },
    fuse: { name: "Ceramic fuse", desc: "An old 30-amp mains fuse, wrapped in a child's handkerchief." },
    keyring: { name: "Ravi's key ring", desc: "A big iron key for a padlock, and a small brass key shaped like a winding crank." }
};

/* ======================================================================
   NOTES
   ====================================================================== */
C.NOTES = {
    news: {
        title: "Torn newspaper", style: "news",
        body: `<div class="mast">NAGAR SAMACHAR</div><div class="date">Monday, 16 November 1987</div>
<h3>TRAGEDY AT MEHRA HAVELI</h3>
<p>…the bodies of Smt. Kamla Mehra (34) and her daughter Misty (7) were discovered on Sunday morning by the milkman, who found the front door chained <b>from the inside</b>.</p>
<p>Police say every clock in the house had stopped at <b>3:17</b>.</p>
<p>The head of the household, Shri Ravi Mehra, has not been seen since early November. Neighbours told this paper he had “gone travelling”. A search of the property found—</p>
<p class="torn">&nbsp;</p>`
    },
    diary1: {
        title: "Diary page — Kamla", style: "paper",
        body: `<p class="date">12 November</p>
<p>Ravi lowers the study key into the well every night now, tied to the bucket rope, so that I cannot read what he writes in there. He says the house tells him things at night. He says it <i>breathes</i>.</p>
<p>Tonight he laid a fourth plate again. “For the guest,” he said.</p>
<p>We have not had a guest in years.</p>`,
        onRead: () => { G.flag("readDiary1", true); }
    },
    ravi: {
        title: "Note on the desk", style: "scrawl",
        body: `<p>It breathes at night. In. Out. In.</p>
<p>I counted every night. It always stops at the same minute, and every clock in the house stops with it.</p>
<p class="big">WHEN THE HOUSE STOPPED BREATHING,<br>THE HANDS SHOWED THE WAY.</p>
<p>Keep the gate locked. Keep Misty upstairs.<br>Keep the guest's plate warm.</p>`
    },
    photo: {
        title: "Family photograph", style: "photo",
        body: `<div class="photoFrame"><canvas id="photoCanvas" width="300" height="200"></canvas></div><p class="back">On the back: <i>“Diwali 1986. The last good one.”</i></p>`,
        onRead: () => drawPhoto()
    },
    diary2: {
        title: "Diary — Kamla", style: "paper",
        body: `<p class="date">14 November</p>
<p>We had to. Pandit-ji said that what lives in Ravi will sleep if he is kept below the house, away from the light. The door down there is steel now. I could not look at him.</p>
<p>Misty asks where Papa went. I told her he is travelling. She hid the fuse in her toy box so nobody can turn the lights on downstairs. Good girl.</p>
<p>Pandit-ji said one more thing: <b>the big clock in the hall must never stop. If it stops, the night will not end.</b> Keep it wound.</p>
<p>It is three o'clock. I can hear him singing under the floor.</p>`,
        onRead: () => { G.flag("readDiary2", true); }
    },
    pandit: {
        title: "Folded paper under the bell", style: "paper",
        body: `<p>Keep the diyas burning, day and night.</p><p><b>Where the lamps burn, he cannot cross.</b></p><p class="sign">— Pt. Shivnath</p>`,
        onRead: () => G.flag("readPandit", true)
    },
    drawing1: { title: "Misty's drawing", style: "drawing", drawing: 1, body: "" },
    drawing2: { title: "Misty's drawing", style: "drawing", drawing: 2, body: "" },
    drawing3: { title: "A drawing, low on the wall", style: "drawing", drawing: 3, body: `<p class="back">The blue figure is carrying a suitcase.</p>` }
};
function drawPhoto() {
    // an old print: the painted family, softened, sepia-toned, creased and grainy
    const c = document.getElementById("photoCanvas"); if (!c) return;
    const x = c.getContext("2d");
    const src = document.createElement("canvas"); src.width = 128; src.height = 128;
    LN.art.decals.familyPortrait(src.getContext("2d"), { ravi: "scratched" });
    x.fillStyle = "#d8ceb4"; x.fillRect(0, 0, 300, 200);
    x.save();
    x.filter = "sepia(0.9) contrast(1.15) brightness(1.05) blur(1.4px)";
    x.imageSmoothingEnabled = true;
    x.drawImage(src, 14, 16, 100, 64, 12, 12, 276, 176);
    x.restore();
    const id = x.getImageData(12, 12, 276, 176), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 34; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    x.putImageData(id, 12, 12);
    const v = x.createRadialGradient(150, 100, 40, 150, 100, 170); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(40,20,5,0.55)");
    x.fillStyle = v; x.fillRect(12, 12, 276, 176);
    // the scratches over his face are real, cut into the print
    x.strokeStyle = "rgba(240,232,214,0.85)"; x.lineWidth = 1.2;
    for (let k = 0; k < 14; k++) { x.beginPath(); x.moveTo(60 + k * 3 + Math.random() * 3, 34 + Math.random() * 4); x.lineTo(56 + k * 3 + Math.random() * 6, 104 + Math.random() * 6); x.stroke(); }
    x.strokeStyle = "rgba(255,255,255,0.25)"; x.lineWidth = 2; x.beginPath(); x.moveTo(12, 140); x.quadraticCurveTo(150, 120, 288, 150); x.stroke();
}

/* ======================================================================
   HIDING SPOTS
   ====================================================================== */
const HIDES = [
    { id: "almirah", floor: "ground", x: 1.05, y: 13.5, label: "Hide in the almirah", view: { x: 1.22, y: 13.5, a: 0 }, exit: { x: 1.7, y: 13.5, a: 0 }, near: { x: 2.4, y: 13.6 }, mask: "gap" },
    { id: "pantry", floor: "ground", x: 20.5, y: 15.95, label: "Hide in the pantry", view: { x: 20.5, y: 15.8, a: -Math.PI / 2 }, exit: { x: 20.5, y: 15.3, a: -Math.PI / 2 }, near: { x: 20.6, y: 14.6 }, mask: "slats" },
    { id: "wardrobe", floor: "upper", x: 14.5, y: 1.05, label: "Hide in the almirah", view: { x: 14.5, y: 1.2, a: Math.PI / 2 }, exit: { x: 14.4, y: 1.75, a: Math.PI / 2 }, near: { x: 14.3, y: 2.6 }, mask: "gap" },
    { id: "tub", floor: "upper", x: 9.0, y: 3.4, label: "Hide behind the curtain", view: { x: 9.0, y: 3.7, a: Math.PI / 2 }, exit: { x: 10.4, y: 3.4, a: Math.PI }, near: { x: 9.6, y: 4.5 }, mask: "curtain" },
    { id: "crates", floor: "basement", x: 16.5, y: 7.55, label: "Crouch in the gap between the crates", view: { x: 16.5, y: 7.78, a: -Math.PI / 2 }, exit: { x: 16.5, y: 7.35, a: -Math.PI / 2 }, near: { x: 16.5, y: 6.1 }, mask: "crates" }
];

/* ======================================================================
   REGISTER INTERACTIONS
   ====================================================================== */
C.register = function () {
    S = G.S(); RT = G.RT;
    const I = G.inter;
    const F = (id) => W.floors[id];

    /* --- every door --- */
    for (const f in W.floors) for (const d of W.floors[f].doorList) {
        I({ floor: f, x: d.x + 0.5, y: d.y + 0.5, z: 0.5, r: 1.6, losBack: 0.62, label: () => doorLabel(d), use: () => G.doorUse(d) });
    }
    /* --- stairs --- */
    W.stairs.forEach(st => {
        const fd = W.FACE[st.face], dx = [0, 1, 0, -1][fd], dy = [-1, 0, 1, 0][fd];
        const px = st.x + 0.5 + dx * 0.55, py = st.y + 0.5 + dy * 0.55;
        st.px = px; st.py = py;
        I({ floor: st.from, x: px, y: py, z: 0.5, r: 1.3, label: st.label, use: () => G.goFloor(st) });
    });
    /* --- hiding spots --- */
    HIDES.forEach(h => I({ floor: h.floor, x: h.x, y: h.y, z: 0.5, r: 1.5, label: h.label, use: () => G.hide(h) }));

    /* ---------------- GROUND FLOOR ---------------- */
    I({ floor: "ground", x: 13.0, y: 20.95, z: 0.6, r: 1.7, label: frontLabel, use: frontUse });
    I({ floor: "ground", x: 10.5, y: 17.05, z: 0.6, r: 1.5, label: clockLabel, hold: clockHold, use: clockUse });
    I({ floor: "ground", x: 15.5, y: 17.05, label: "Look at the photographs", use: () => G.think(S.phase >= 6 ? "Every face in every photograph has been scratched away." : "Family photographs. A wedding, a baby, a girl on a swing in the courtyard.") });
    I({ floor: "ground", x: 8.05, y: 17.5, label: "Look closer", use: () => G.think("Scratched into the plaster, low down, in a child's hand: “we are still here”.") });
    I({ floor: "ground", x: 1.5, y: 6.7, r: 1.4, label: () => S.flags.phoneState === "ringing" ? "Answer the telephone" : "Read the newspaper", use: phoneUse });
    I({ floor: "ground", x: 5.5, y: 6.6, r: 1.4, label: () => S.flags.radio && S.flags.radio !== "off" ? "Switch off the radio" : "Look at the radio", use: radioUse });
    I({ floor: "ground", x: 3.4, y: 8.0, r: 1.4, label: "Look at the rocking chair", use: () => G.think(S.flags.coatOnRocker ? "Papa's coat is draped over the chair now. It's damp, as if someone walked in from the rain." : "A rocking chair with a folded shawl. It's still moving. Barely.") });
    I({ floor: "ground", x: 3.5, y: 6.05, label: "Look at the clock", use: () => G.think(S.flags.parlorClockStopped ? "The pendulum hangs dead still. It was ticking a moment ago." : "An old wall clock. It says nine minutes past three.") });
    I({ floor: "ground", x: 1.05, y: 8.5, label: "Look out of the window", use: () => G.think(S.flags.curtainSeen ? "The window is shut tight. There is no draught at all." : "Rain, and the black shapes of trees. The window is latched from inside.") });
    I({ floor: "ground", x: 6.95, y: 10.5, label: "Look at the photographs", use: () => G.think(S.phase >= 4 ? "The frames are still there. The people in them are not." : "Old photographs of the family. A man in a white kurta, a woman, a little girl with two braids.") });
    I({ floor: "ground", x: 2.6, y: 13.2, r: 1.3, label: "Lift the dust sheet", use: () => G.think("Under the sheet, a child's cot, folded away. A name is painted on the headboard: MISTY.") });
    I({ floor: "ground", x: 1.5, y: 20.95, label: "Look at the drawing", use: () => G.readNote("drawing3") });
    I({ floor: "ground", x: 5.5, y: 17.05, label: "Look at the marks", use: () => G.think("Pencil marks on the wall, one above the other. MISTY 5. MISTY 6. MISTY 7. Nothing after seven.") });
    I({ floor: "ground", x: 9.5, y: 1.05, label: "Look at the portrait", use: () => G.think(S.phase >= 4 ? "The family portrait. Where the father stood, there is only dark paint now." : "A family portrait: Ravi, Kamla, and Misty between them. Nobody is smiling.") });
    I({ floor: "ground", x: 16.5, y: 1.05, label: "Look at the portrait", use: () => G.think(S.phase >= 3 ? "R. MEHRA. The man in the painting has his back to the room." : "R. MEHRA. He looks directly at you, wherever you stand.") });
    I({ floor: "ground", x: 15.5, y: 1.6, r: 1.2, label: "Look at the lantern", use: () => G.think(S.flags.lanternLit ? "Somebody has lit it. There's no match, no smell of smoke." : "A hurricane lantern. Dry. It hasn't been lit in years.") });
    I({ floor: "ground", x: 22.5, y: 1.05, r: 1.5, label: () => S.notes.includes("pandit") ? "Ring the bell" : "Read the note under the bell", use: () => { if (!S.notes.includes("pandit")) G.readNote("pandit"); else A.bell({ x: 22.5, y: 1.1, floor: "ground" }, 0.7); } });
    I({ floor: "ground", x: 13.0, y: 11.0, r: 1.6, label: () => S.flags.wellDone ? "Look into the well" : "Turn the crank", hold: wellHold, use: () => G.think("Black water, very far down. Something knocks gently against the stones.") });
    I({ floor: "ground", x: 0, y: 0, r: 1.4, label: "Look at the wheelchair", spriteId: "wheelchair", use: () => G.think(S.flags.wheelMoved ? "The wheelchair. It was on the other side of the courtyard. The wheels are wet." : "An old wheelchair with a folded blanket. Somebody's Dadi lived here.") });
    I({ floor: "ground", x: 21.9, y: 8.4, r: 1.9, label: () => !S.notes.includes("diary1") ? "Read the diary page" : "Look at the table", use: diningUse });
    I({ floor: "ground", x: 23.5, y: 6.05, label: "Look at the photographs", use: () => G.think("In every photograph on the sideboard, the man has turned his face away from the camera.") });
    I({ floor: "ground", x: 23.6, y: 12.7, r: 1.3, label: "Look at the fallen clock", use: () => { G.flag("sawKitchenClock", true); G.think("The kitchen clock lies face-down on the floor, glass cracked. It stopped at 3:17."); } });
    I({ floor: "ground", x: 19.5, y: 12.05, label: "Look at the calendar", use: () => G.think("November 1987. The 14th is circled in red. Every day after it is blank.") });
    I({ floor: "ground", x: 3.5, y: 2.2, r: 1.6, label: "Read the note on the desk", use: () => G.readNote("ravi") });
    I({ floor: "ground", x: 3.5, y: 1.05, label: "Look at the books", use: () => G.think("Ledgers, land records… and a whole shelf of books about clocks and clockwork.") });
    I({ floor: "ground", x: 6.95, y: 1.5, label: "Look at the clippings", use: () => G.think("Newspaper clippings pinned to the panelling. Deaths in this house: 1891, 1923, 1952. Each one circled.") });
    I({ floor: "ground", x: 3.5, y: 4.95, label: () => S.flags.clockSolved ? "Look at the clock" : "Examine the wall clock", use: studyClockUse });

    /* ---------------- UPSTAIRS ---------------- */
    I({ floor: "upper", x: 6.5, y: 6.05, label: "Look at the portrait", use: () => G.think(S.flags.portraitsChanged ? "RAVI. The frame holds only an empty dark room now." : "RAVI. The painter caught something in his eyes that the photographs didn't.") });
    I({ floor: "upper", x: 12.5, y: 6.05, label: "Look at the portrait", use: () => G.think(S.flags.portraitsChanged ? "KAMLA. Her eyes are closed. They were open." : "KAMLA. A gentle face, painted with great care.") });
    I({ floor: "upper", x: 17.5, y: 6.05, label: "Look at the portrait", use: () => G.think(S.flags.portraitsChanged ? "MISTY. She has turned away, towards the window." : "MISTY. Two braids with red ribbons. She looks about seven.") });
    I({ floor: "upper", x: 2.5, y: 1.05, label: "Look at the drawing", use: () => { G.readNote("drawing1"); G.flag("visitedNursery", true); } });
    I({ floor: "upper", x: 6.5, y: 1.05, label: "Look at the drawing", use: () => { G.readNote("drawing2"); G.flag("visitedNursery", true); } });
    I({ floor: "upper", x: 2.0, y: 1.6, r: 1.4, label: "Look at the bed", use: () => G.think(S.flags.dollMoved ? "The doll is gone from the pillow. There is a small dent where it sat." : "A small bed, the sheet turned down as if someone is expected. A cloth doll sits on the pillow.") });
    I({ floor: "upper", x: 5.4, y: 1.5, r: 1.4, label: () => S.flags.gotFuse ? "Look in the toy chest" : "Open the toy chest", use: toyChestUse });
    I({ floor: "upper", x: 9.5, y: 1.05, label: "Look in the mirror", use: () => G.think(S.flags.mirrorDone ? "Just your own face, grey and tired." : "Your own face in the old glass.") });
    I({ floor: "upper", x: 15.6, y: 1.5, r: 1.8, label: "Read the diary on the bed", use: () => G.readNote("diary2") });
    I({ floor: "upper", x: 18.2, y: 1.6, r: 1.4, label: () => S.flags.gotCellarKey ? "Look at the coat stand" : "Search the coat", use: coatUse, when: () => !S.flags.coatGone });
    I({ floor: "upper", x: 12.5, y: 10.95, label: "Look out of the window", use: () => G.think("The courtyard below. The well. The rain. A light is on in a room across the way… then it isn't.") });
    I({ floor: "upper", x: 12.5, y: 10.35, r: 1.2, label: "Look at the doll", when: () => S.flags.dollMoved, use: () => G.think("The doll from the nursery. It's sitting facing the corridor. Facing you.") });
    I({ floor: "upper", x: 9.5, y: 6.95, label: "Look at the photographs", use: () => G.think("A school photograph. A girl in the front row has been circled in red crayon.") });

    /* ---------------- CELLAR ---------------- */
    I({ floor: "basement", x: 1.05, y: 2.5, r: 1.5, label: fuseLabel, use: fuseUse });
    I({ floor: "basement", x: 1.05, y: 10.5, r: 1.4, label: () => S.flags.gotKeyring ? null : "Take the key ring", use: takeKeyring });
    I({ floor: "basement", x: 3.7, y: 11.4, r: 1.2, label: "Look at the bowl", use: () => G.think("Rice and dal in a steel bowl. It's still warm.") });
    I({ floor: "basement", x: 2.4, y: 12.2, r: 1.5, label: "Look at the cot", use: () => G.think("A rope cot. Chains are bolted to its frame. The blanket is still warm.") });
    I({ floor: "basement", x: 2.5, y: 9.05, label: "Look at the scratches", use: () => G.think("Hundreds of scratches, in groups of five. Somebody counted days down here.") });
    I({ floor: "basement", x: 1.05, y: 9.5, label: "Look at the photographs", use: () => G.think("Photographs of the family, pinned up and scratched over and over. Kamla. Misty. Strangers too — travellers, by the look of them.") });
    I({ floor: "basement", x: 2.5, y: 12.95, r: 1.6, label: "Read the wall", use: () => G.think("“THEY PUT ME BELOW THE LIGHT. NOBODY LEAVES.”") });
    I({ floor: "basement", x: 4.95, y: 9.5, r: 1.2, label: "Press the switch", use: () => { A.tick(null, true, 0.5); G.think(S.power ? "The switch clicks. The steel door's lock is already green." : "It clicks. Nothing. No power."); } });
};

/* ---------------- doors ---------------- */
function doorLabel(d) {
    if (d.id === "cupboard") return d.locked ? (S.y < 11.5 ? (S.flags.cupboardCold ? "Push the cupboard" : "Examine the cupboard") : "Push the panel") : null;
    if (d.id === "boltDoor" && d.locked) return S.x < 7.5 ? "Slide the bolt" : "Open the door";
    if (d.mode === "slide" && !d.locked) return null;
    if (d.locked) return d.key && G.has(d.key) ? "Unlock" : (d.id === "gate" ? "Open the gate" : "Open the door");
    return d.open > 0.5 ? "Close the door" : "Open the door";
}
C.tryUnlock = function (d) {
    if (d.id === "cupboard") {
        if (S.y < 11.5 && !S.flags.cupboardCold) { G.flag("cupboardCold", true); G.think("Cold air is coming through the back of this cupboard."); A.whisper({ x: 2.5, y: 12.5, floor: "ground" }, 1.2, 0.25); return true; }
        d.locked = false; G.openDoor(d, 0.45); G.think(S.y < 11.5 ? "The whole cupboard slides aside. There's a room behind it." : "The panel gives way: the back of a cupboard."); return true;
    }
    if (d.id === "boltDoor") { if (S.x < 7.5) { d.locked = false; A.unlock(G.doorPos(d)); G.openDoor(d, 1.4); return true; } return false; }
    if (d.key === "never") {
        A.rattle(G.doorPos(d), 0.7);
        G.later(0.9, () => A.knock(G.doorPos(d), 3, 0.9));
        G.think(S.flags.atticKnocked ? "Locked. Something on the other side knocks back. Three times. Always three." : "Locked. For a moment, something on the other side knocks back.");
        G.flag("atticKnocked", true);
        return true;
    }
    if (d.key === "power") {
        if (!S.power) return false;
        d.locked = false; d.tex = "d_steelGreen"; A.unlock(G.doorPos(d)); G.openDoor(d, 0.45); return true;
    }
    if (d.key && G.has(d.key)) {
        A.unlock(G.doorPos(d));
        d.locked = false;
        if (d.id === "cellarDoor") { d.tex = "d_cellarOpen"; A.rattle(G.doorPos(d), 0.9); G.take("cellarKey"); }
        else G.take(d.key);
        G.openDoor(d, d.mode === "slide" ? 0.7 : 1.2);
        onUnlock(d.id);
        return true;
    }
    return false;
};
function onUnlock(id) {
    if (id === "studyDoor") { S.phase = Math.max(S.phase, 3); G.checkpoint("study"); }
    if (id === "gate") { G.checkpoint("gate"); }
}

/* ---------------- front door & hall clock ---------------- */
function frontLabel() {
    if (S.flags.dawn) return "Step outside";
    if (!G.has("keyring")) return "Try the door";
    if (!S.flags.frontUnlocked) return "Unlock the padlock";
    return "Push the door";
}
function frontUse() {
    const pos = { x: 13, y: 20.6, floor: "ground" };
    if (S.flags.dawn) { ending(); return; }
    if (!G.has("keyring")) {
        A.rattle(pos, 0.9);
        G.think(S.t < 40 ? "It won't open. There's a chain across it, on the inside. It wasn't there when I came in." : "Chained from the inside. A heavy padlock hangs from the chain.");
        return;
    }
    if (!S.flags.frontUnlocked) {
        G.flag("frontUnlocked", true);
        A.unlock(pos); G.later(0.4, () => A.rattle(pos, 1));
        W.setDecal("frontL", { chain: false }); W.setDecal("frontR", { chain: false });
        G.later(1.2, () => G.think("The chain falls away. The door still won't move — as if something is holding it from the other side."));
        G.later(5.8, () => G.think(S.flags.readDiary2 ? "“If the big clock stops, the night will not end.” Behind me, the hall clock is silent." : "Behind me, the old hall clock is silent. Its pendulum hangs still."));
        if (!S.flags.finalStarted) G.checkpoint("final");
        return;
    }
    A.thump(pos, 0.7);
    G.think("It won't move. The night isn't over.");
}
function clockLabel() {
    if (S.flags.wound) return "Listen to the clock";
    if (G.has("keyring")) return `Wind the clock (${(S.flags.windTurns || 0) + 1}/3)`;
    return "Examine the clock";
}
function clockUse() {
    if (S.flags.wound) { G.think("Tick. Tock. It's running again."); return; }
    G.think("The big hall clock. Silent. Its hands stand at 3:17. There's a small keyhole for winding.");
}
function clockHold() {
    if (S.flags.wound || !G.has("keyring")) return null;
    let clickT = 0;
    return {
        dur: 2.3,
        start: () => { if (!S.flags.finalStarted) startFinal(); },
        tick: (p, dt) => { clickT -= dt; if (clickT <= 0) { clickT = 0.16; A.tick({ x: 10.5, y: 16.9, floor: "ground" }, Math.random() < 0.5, 0.5); } },
        done: () => {
            S.flags.windTurns = (S.flags.windTurns || 0) + 1;
            A.creak({ x: 10.5, y: 16.9, floor: "ground" }, 0.5, 0.4);
            if (S.flags.windTurns >= 3) clockRestarted();
            else { RT.lightning = 1; G.later(0.6, () => A.thunder(0.8)); }
        }
    };
}

/* ---------------- well ---------------- */
function wellHold() {
    if (S.flags.wellDone) return null;
    let clink = 0, bumped = false;
    return {
        dur: 4.6, keep: true,
        tick: (p, dt) => {
            clink -= dt; if (clink <= 0) { clink = 0.32; A.chain({ x: 13, y: 11, floor: "ground" }, 0.55); }
            if (p > 0.55 && !bumped && !S.flags.wellBump) { bumped = true; G.flag("wellBump", true); A.thump({ x: 13, y: 11.2, floor: "ground" }, 1.0); A.splash({ x: 13, y: 11, floor: "ground" }, 0.5); RT.shake = 0.35; }
        },
        done: () => {
            G.flag("wellDone", true);
            A.splash({ x: 13, y: 11, floor: "ground" }, 0.4);
            G.give("studyKey");
            G.think("Inside the bucket, wrapped in a wet cloth: a small iron key. Long black hair is wound tight around it.", 6);
            S.phase = Math.max(S.phase, 2);
            S.flags.wellAt = S.t;
            G.checkpoint("well");
        }
    };
}

/* ---------------- parlour ---------------- */
function phoneUse() {
    if (S.flags.phoneState === "ringing") {
        stopPhone();
        S.flags.phoneState = "answered";
        A.static(0.6, 0.35);
        G.subtitle([
            ["<i>(static… and breathing, very close to the receiver)</i>", 3.2, () => A.static(2.5, 0.12)],
            ["<i>(a child's voice)</i> …hello?", 2.6],
            ["…are you staying for dinner?", 3.4],
            ["<i>(the line goes dead)</i>", 2.2, () => A.tick(null, true, 0.6)]
        ]);
        return;
    }
    G.readNote("news");
}
let phoneEm = null, radioEm = null, parlorTick = null, studyTick = null, hallTick = null, musicBoxEm = null;
function startPhone() { stopPhone(); phoneEm = A.phone({ x: 1.5, y: 6.7, floor: "ground" }); }
function stopPhone() { if (phoneEm) { phoneEm.stop(); phoneEm = null; } }
function setRadio(state) {
    S.flags.radio = state;
    if (radioEm) { radioEm.stop(); radioEm = null; }
    const sp = W.spriteById.radio;
    if (sp) sp.spr = state === "off" || !state ? "radio" : "radio_on";
    if (state === "static") radioEm = A.radio({ x: 5.5, y: 6.6, floor: "ground" }, false);
    if (state === "music") radioEm = A.radio({ x: 5.5, y: 6.6, floor: "ground" }, true);
}
function radioUse() {
    if (S.flags.radio && S.flags.radio !== "off") {
        setRadio("off"); A.tick(null, true, 0.6); G.flag("radioOffT", S.t);
        G.think("Silence. Better.");
        return;
    }
    G.think(S.flags.radioOffT ? "The dial is warm. I switched it off… didn't I?" : "An old valve radio. Battery-powered. Dead, by the look of it.");
}

/* ---------------- dining ---------------- */
function diningUse() {
    if (!S.notes.includes("diary1")) { G.readNote("diary1"); return; }
    if (S.flags.served) G.think("Four thalis, served. Rice, dal, something dark and red on the fourth plate. Papa's coat hangs on the guest's chair.");
    else G.think("Four plates laid on a clean cloth. One chair pulled out, as if for a guest. The candle is fresh.");
}

/* ---------------- study clock puzzle ---------------- */
function studyClockUse() {
    if (S.flags.clockSolved) { G.think("The little door under the dial hangs open. Inside, the clock is ticking backwards."); return; }
    G.openClock(12, 0, "The glass door is jammed shut, but the hands turn when you push them. There's a tiny brass door under the dial with no handle.", (h, m) => {
        if (h === 3 && m === 17) solveClock();
        else {
            S.flags.clockTries = (S.flags.clockTries || 0) + 1;
            A.creak({ x: 3.5, y: 4.8, floor: "ground" }, 0.4, 0.5);
            W.setDecal("studyClock", { h: 12, m: 0 });
            const tries = S.flags.clockTries;
            if (tries >= 4) G.think("Nothing. The hands slowly turn back to twelve. …Every clock in this house stopped at the same minute.");
            else if (tries >= 2) G.think("The hands crawl back to twelve. When did the house stop breathing?");
            else G.think("Nothing happens. The hands drift back to twelve on their own.");
        }
    });
}
function solveClock() {
    G.flag("clockSolved", true);
    W.setDecal("studyClock", { h: 3, m: 17, open: true });
    A.unlock({ x: 3.5, y: 4.8, floor: "ground" });
    G.later(0.5, () => { A.chime({ x: 3.5, y: 4.8, floor: "ground" }, 0.35); });
    G.give("gateKey");
    G.later(0.4, () => G.give("photo", true));
    G.later(0.6, () => G.readNote("photo"));
    S.phase = Math.max(S.phase, 3);
    S.flags.solvedAt = S.t;
    G.checkpoint("clock");
}

/* ---------------- upstairs ---------------- */
function toyChestUse() {
    const sp = W.spriteById.toychest;
    if (S.flags.gotFuse) { G.think("Wooden blocks, a skipping rope, a tin of crayons. Nothing else."); return; }
    G.flag("gotFuse", true); G.flag("visitedNursery", true);
    if (sp) sp.spr = "toychest_open";
    A.creak({ x: 5.4, y: 1.5, floor: "upper" }, 0.5, 0.6);
    G.give("fuse");
    G.think("Under the toys, wrapped in a little handkerchief: an old ceramic fuse.");
    // the music box inside starts by itself as you turn away
    G.later(4, () => { if (S.floor === "upper") { musicBoxEm = A.musicBox({ x: 5.4, y: 1.5, floor: "upper" }); G.later(14, () => { if (musicBoxEm) { musicBoxEm.stop(); musicBoxEm = null; } }); } });
}
function coatUse() {
    if (S.flags.gotCellarKey) { G.think("Just a coat on a stand. Just a coat."); return; }
    G.flag("gotCellarKey", true);
    G.give("cellarKey");
    A.creak({ x: 18.2, y: 1.6, floor: "upper" }, 0.3, 0.4);
    G.think("The coat is heavy and damp. In the pocket, an iron key. The lining is still warm.", 5);
    S.flags.coatAt = S.t;
}

/* ---------------- cellar ---------------- */
function fuseLabel() {
    if (S.power || S.flags.gotKeyring) return "Look at the fuse box";
    if (S.flags.fuseIn) return "Pull the lever";
    if (G.has("fuse")) return "Fit the fuse";
    return "Look at the fuse box";
}
function fuseUse() {
    const pos = { x: 1.05, y: 2.5, floor: "basement" };
    if (S.power) { G.think("The lever is up. The fuses hum."); return; }
    if (S.flags.gotKeyring) { G.think("The fuses are black and cracked. It won't come back on."); return; }
    if (S.flags.fuseIn) { powerOn(); return; }
    if (G.has("fuse")) {
        G.take("fuse"); G.flag("fuseIn", true);
        W.setDecal("fusebox", { fuse: true });
        A.unlock(pos);
        G.think("It fits. Now the lever.");
        return;
    }
    G.think("The mains box. One of the three fuses is missing — the empty slot is labelled MAINS.");
    G.flag("sawFusebox", true);
}
function allBulbs(fn) { for (const f in W.floors) W.floors[f].lights.forEach(L => { if (L.bulb !== undefined) fn(L, f); }); }
function powerOn() {
    S.power = true;
    W.setDecal("fusebox", { fuse: true, on: true });
    A.powerOn();
    // bulbs come on one by one, struggling
    allBulbs((L, f) => {
        G.later(0.2 + Math.random() * 1.4 + (f === S.floor ? 0 : 0.8), () => {
            L.on = true; L.warm = 0;
            const s = W.spriteById[L.id + "_s"]; if (s) s.spr = "bulb_on";
            if (f === S.floor) A.flickerBuzz({ x: L.x, y: L.y, floor: f });
        });
    });
    const sd = G.door("steelDoor"); if (sd) sd.tex = "d_steelRed";
    G.later(1.6, () => { if (sd && sd.locked) { sd.tex = "d_steelGreen"; A.unlock({ x: 5.5, y: 10.5, floor: "basement" }); } });
    G.later(3, () => { setRadio("music"); });
    G.later(5, () => { const em = A.phone({ x: 1.5, y: 6.7, floor: "ground" }); G.later(2.6, () => em && em.stop()); });
    // the dining room is laid for dinner now
    const dn = W.spriteById.dining; if (dn) dn.spr = "dining_served";
    S.flags.served = true; S.flags.coatGone = true; S.flags.coatOnRocker = false;
    const cs = W.spriteById.coatstand; if (cs) cs.spr = "coatstand_empty";
    S.phase = Math.max(S.phase, 4);
    G.later(2.5, () => G.think("Lights. Somewhere far above, a telephone rings twice and stops."));
    G.later(6, () => { if (!S.flags.gotKeyring) G.checkpoint("power"); });
}
function powerOff() {
    S.power = false;
    A.powerOff();
    allBulbs((L) => { L.on = false; const s = W.spriteById[L.id + "_s"]; if (s) s.spr = "bulb"; });
    W.setDecal("fusebox", { fuse: true, on: false });
    setRadio("off");
    const cnd = W.lightById.diningCandle; if (cnd) cnd.on = false;
    const fl = W.spriteById.diningFlame; if (fl) fl.visible = false;
    ["fallen1", "fallen2"].forEach(id => { const s = W.spriteById[id]; if (s) s.visible = true; });
    const vc = W.spriteById.verChair; if (vc) vc.visible = false;
    RT.flashOff = 0.5;
}
function takeKeyring() {
    if (S.flags.gotKeyring) return;
    G.flag("gotKeyring", true);
    W.setDecal("keyring", { taken: true });
    G.give("keyring");
    S.phase = 5;
    const sd = G.door("steelDoor"); if (sd) { sd.locked = false; sd.target = 1; sd.open = 1; }
    G.later(0.7, () => { powerOff(); A.setMaster(0.35, 0.05); });
    G.later(2.2, () => { A.setMaster(0.9, 0.4); A.creak({ x: 2.2, y: 12.3, floor: "basement" }, 0.9, 1.4); });
    G.later(3.0, () => {
        G.ghostRise("basement", 1.6, 12.5, { dur: 1.9, hunt: { speed: 2.1, ramp: 3.2, track: 11 } });
        A.sting(0.9); A.swell(1.6, 0.4);
        S.flags.chase = true;
    });
}
C.onChaseEnd = function () {
    S.flags.chase = false; S.flags.chaseDone = true;
    S.phase = 6;
    G.later(1.5, () => A.whisper({ x: S.x - Math.cos(S.a) * 3, y: S.y - Math.sin(S.a) * 3, floor: S.floor }, 2.2, 0.25));
    G.later(4.5, () => G.think("…It's gone. For now. The big key on the ring — the front door."));
    G.later(6, () => { if (!RT.dying && !G.ghost.on) G.checkpoint("afterChase"); });
};
C.onPassbyStop = function () {
    const g = G.ghost;
    G.later(1.2, () => A.whisper({ x: g.x, y: g.y, floor: g.floor }, 1.3, 0.35));
};
C.onGhostArrive = function () { RT.flashOff = 0.4; };

/* ---------------- the end ---------------- */
function startFinal() {
    G.flag("finalStarted", true);
    S.phase = 6;
    G.later(0.8, () => {
        G.ghostStalk("ground", 17.3, 20.4, { speed: 0.85 });
        A.swell(2.2, 0.35);
        A.doorSlam({ x: 7.5, y: 19.5, floor: "ground" }, 0.7);
    });
}
function clockRestarted() {
    G.flag("wound", true);
    W.setDecal("grandClock", { h: 3, m: 18, swing: 1 });
    hallTick = A.ticking({ x: 10.5, y: 16.9, floor: "ground" }, 0.7);
    for (let i = 0; i < 4; i++) G.later(0.6 + i * 2.1, () => { A.chime({ x: 10.5, y: 16.9, floor: "ground" }, 0.9); RT.flicker = 0.3; });
    G.later(0.9, () => {
        const g = G.ghost;
        if (g.on) { g.mode = "dissolve"; A.whisper({ x: g.x, y: g.y, floor: "ground" }, 2.5, 0.6); A.swell(2.0, 0.5); }
    });
    G.later(9.5, () => {
        G.flag("dawn", true);
        W.setDecal("frontL", { chain: false, dawn: true }); W.setDecal("frontR", { chain: false, dawn: true });
        A.doorCreak({ x: 13, y: 20.6, floor: "ground" }, 3.2, 0.6);
        const L = W.lightById.dawn; if (L) { L.on = true; L.i = 0; }
        G.think("Grey light. The door has swung open by itself.", 4);
    });
}
function ending() {
    if (S.flags.leaving) return;
    S.flags.leaving = true;
    RT.lockMove = true;
    document.getElementById("whiteout").classList.add("on");
    A.setMaster(0, 3);
    setTimeout(() => {
        A.stopAll();
        G.finish();
        A.setMaster(0.6, 0.5);
        setTimeout(() => { const em = A.phone({ x: S.x + 0.4, y: S.y, floor: S.floor }); setTimeout(() => em && em.stop(), 2700); }, 6500);
        document.getElementById("whiteout").classList.remove("on");
    }, 3600);
}

/* ======================================================================
   START / RESTORE
   ====================================================================== */
C.start = function () {
    S = G.S(); RT = G.RT;
    S.flags.phoneAt = rnd(48, 70);
    // the door you came through slams behind you
    G.later(0.6, () => { A.doorSlam({ x: 13, y: 20.8, floor: "ground" }, 1.3); RT.shake = 0.5; A.rattle({ x: 13, y: 20.8, floor: "ground" }, 0.8); });
    G.later(1.2, () => { RT.lightning = 1; G.later(0.7, () => A.thunder(0.9)); });
    G.later(3.2, () => G.think("The door slammed shut behind me."));
    startAudio();
    resetLocal();
};
C.onRestore = function () {
    S = G.S(); RT = G.RT;
    stopPhone(); radioEm = null; parlorTick = studyTick = hallTick = musicBoxEm = null;
    startAudio();
    if (S.flags.radio && S.flags.radio !== "off") setRadio(S.power ? "music" : S.flags.radio);
    S.flags.chase = false;
    if (S.flags.finalStarted && !S.flags.wound) { S.flags.finalStarted = false; S.flags.windTurns = 0; }
    resetLocal();
};
function startAudio() {
    if (!S.flags.parlorClockStopped) parlorTick = A.ticking({ x: 3.5, y: 6.0, floor: "ground" }, 0.5);
    if (S.flags.clockSolved) studyTick = A.ticking({ x: 3.5, y: 4.9, floor: "ground" }, 0.35);
    if (S.flags.wound) hallTick = A.ticking({ x: 10.5, y: 16.9, floor: "ground" }, 0.7);
}
const local = { rock: 0, rockAmp: 1, rockSide: 0, pend: 0, pendT: 0, curtainT: 0, curtainAmp: 0, curtainCool: 20, scareT: 30, thunderT: 18, dripT: 3, stillCool: 0, studyMin: 17, studyT: 0, mirror: 0, mirrorA: 0, last: "" };
function resetLocal() {
    Object.assign(local, { rock: 0, rockAmp: 1, rockSide: 0, pend: 0, pendT: 0, curtainT: 0, curtainAmp: 0, curtainCool: 20, scareT: 30, thunderT: 18, dripT: 3, stillCool: 0, studyMin: 17, studyT: 0, mirror: 0, last: "" });
}

/* ======================================================================
   DIRECTOR
   ====================================================================== */
C.tension = function () { return [0, 0.04, 0.12, 0.16, 0.24, 0.5, 0.32][S.phase] || 0; };

function onScreen(x, y, z) { const p = LN.render.project(G.cam(), x, y, z || 0.4); return !!(p && p.onScreen && p.sx > 0.02 && p.sx < 0.98 && W.los(G.floor(), S.x, S.y, x, y)); }
function inRoom(name) { return W.roomAt(G.floor(), S.x, S.y) === name; }

C.update = function (dt) {
    S = G.S(); RT = G.RT;
    autoStairs();
    updateClocks(dt);
    updateRocker(dt);
    updateCurtains(dt);
    updatePhone(dt);
    scripted(dt);
    ambientScares(dt);
    weather(dt);
    if (G.ghost.on && G.ghost.mode === "dissolve") {
        const g = G.ghost; g.alpha -= dt * 0.45; g.spr.jitter = 2;
        if (g.alpha <= 0) G.ghostOff(false);
    }
    const dawn = W.lightById.dawn; if (dawn && dawn.on && dawn.i < 1.8) dawn.i += dt * 0.25;
};

/* walking into the stairs takes them, so a chase never stalls on a prompt */
function autoStairs() {
    if (RT.transit || RT.hidden) return;
    W.stairs.forEach(st => {
        if (st.from !== S.floor || st.px === undefined) return;
        if (st.from === "ground" && st.to === "upper") { const gt = G.door("gate"); if (!gt || gt.open < 0.8) return; }
        const d = Math.hypot(S.x - st.px, S.y - st.py);
        if (d < 0.5 && RT.moving) {
            const fd = W.FACE[st.face], nx = -[0, 1, 0, -1][fd], ny = -[-1, 0, 1, 0][fd];
            if (Math.cos(S.a) * nx + Math.sin(S.a) * ny > 0.5) G.goFloor(st);
        }
    });
}

function updateClocks(dt) {
    // parlour clock: ticks until you come close, then stops dead
    if (!S.flags.parlorClockStopped) {
        local.pendT -= dt;
        if (local.pendT <= 0 && S.floor === "ground" && G.dist(3.5, 6) < 9) {
            local.pendT = 0.5; local.pend = local.pend > 0 ? -1 : 1;
            W.setDecal("parlorClock", { h: 3, m: 9 + Math.floor(S.t / 60), swing: local.pend });
        }
        if (S.floor === "ground" && G.dist(3.5, 6.0) < 2.1 && S.t > 4) {
            G.flag("parlorClockStopped", true);
            if (parlorTick) { parlorTick.stop(); parlorTick = null; }
            W.setDecal("parlorClock", { swing: 0.3 });
            G.later(2.4, () => G.think("…the ticking stopped.", 2.6));
        }
    }
    // study clock runs backwards once opened
    if (S.flags.clockSolved && S.floor === "ground" && inRoom("Study")) {
        local.studyT += dt;
        if (local.studyT > 1.4) { local.studyT = 0; local.studyMin = (local.studyMin + 59) % 60; W.setDecal("studyClock", { h: 3, m: local.studyMin, open: true }); }
    }
    // hall clock pendulum once wound
    if (S.flags.wound && S.floor === "ground" && G.dist(10.5, 17) < 10) {
        local.pendT -= dt;
        if (local.pendT <= 0) { local.pendT = 0.5; local.pend = local.pend > 0 ? -1 : 1; W.setDecal("grandClock", { swing: local.pend }); }
    }
}

function updateRocker(dt) {
    const sp = W.spriteById.rocker; if (!sp) return;
    if (S.floor !== "ground") return;
    const watched = G.dist(sp.x, sp.y) < 3.4 && onScreen(sp.x, sp.y, 0.2);
    const target = watched ? 0 : 1;
    local.rockAmp += (target - local.rockAmp) * Math.min(1, dt * (watched ? 0.9 : 0.3));
    local.rock += dt * 2.1;
    const v = Math.sin(local.rock) * local.rockAmp;
    const idx = Math.max(0, Math.min(4, Math.round((v + 1) * 2)));
    sp.spr = (S.flags.coatOnRocker ? "rocker_coat" : "rocker") + idx;
    const side = v > 0.85 ? 1 : v < -0.85 ? -1 : 0;
    if (side && side !== local.rockSide && G.dist(sp.x, sp.y) < 10) A.creak({ x: sp.x, y: sp.y, floor: "ground" }, 0.22 * local.rockAmp, 0.3);
    local.rockSide = side;
}

function updateCurtains(dt) {
    if (S.phase < 2 || S.floor !== "ground") return;
    local.curtainCool -= dt;
    if (local.curtainT <= 0 && local.curtainCool <= 0 && inRoom("Parlour") && onScreen(1.0, 8.5, 0.6)) {
        local.curtainT = 5; local.curtainCool = 45;
    }
    if (local.curtainT > 0) {
        local.curtainT -= dt;
        const amp = Math.sin(Math.min(1, (5 - local.curtainT) / 5) * Math.PI);
        local.cAcc = (local.cAcc || 0) + dt;
        if (local.cAcc > 0.09) { local.cAcc = 0; W.setDecal("curtains", { t: RT.time, amp: amp * 1.2 }); }
        if (local.curtainT <= 0) { W.setDecal("curtains", { t: RT.time, amp: 0 }); G.flag("curtainSeen", true); }
    }
}

function updatePhone(dt) {
    const st = S.flags.phoneState;
    if (!st && S.t > S.flags.phoneAt && S.floor === "ground" && G.dist(1.5, 6.7) > 6 && !RT.overlay) {
        S.flags.phoneState = "ringing"; S.flags.ringStart = S.t; startPhone();
    } else if (st === "ringing" && S.t - S.flags.ringStart > 27) {
        stopPhone(); S.flags.phoneState = "missed";
    } else if (st === "missed" && S.phase >= 2 && S.t - S.flags.ringStart > 70 && S.floor === "ground" && G.dist(1.5, 6.7) > 6) {
        S.flags.phoneState = "ringing"; S.flags.ringStart = S.t; startPhone();
    }
    if (S.flags.phoneState === "ringing" && S.floor !== "ground" && phoneEm) { /* still rings, muffled through the floor */ }
}

/* one-shot events tied to progress */
function scripted(dt) {
    const g = G.ghost, F = G.floor();
    const busy = RT.overlay || RT.transit || RT.hidden || g.on;

    // PHASE 2 ------------------------------------------------------------
    G.once("parlorShut", () => S.phase >= 2 && S.t - S.flags.wellAt > 5 && S.floor === "ground" && G.dist(7.5, 8.5) > 5 && !onScreen(7.5, 8.5, 0.6), () => {
        const d = G.door("parlorDoor");
        if (!G.closeDoor(d, true)) G.closeDoor(G.door("kitchenDoor"), true);
    });
    G.once("lantern", () => S.phase >= 2 && S.t - S.flags.wellAt > 16 && S.floor === "ground" && !inRoom("Stair hall") && !onScreen(15.5, 1.6, 0.2), () => {
        const L = W.lightById.lantern; L.on = true; L.warm = 0;
        W.spriteById.lantern.spr = "lantern_on"; W.spriteById.lanternFlame.visible = true;
        G.flag("lanternLit", true);
    });
    if (!busy) G.once("sight1", () => {
        if (!(S.phase >= 2 && S.t - S.flags.wellAt > 22 && S.floor === "ground")) return false;
        const spots = [[12.6, 3.0], [17.3, 15.2], [8.6, 6.6]];
        for (const [x, y] of spots) {
            const d = G.dist(x, y);
            if (d > 5 && d < 11.5 && W.los(F, S.x, S.y, x, y) && !onScreen(x, y)) { local.sight = [x, y]; return true; }
        }
        return false;
    }, () => {
        const [x, y] = local.sight;
        G.ghostAppear("ground", x, y, { vanishDist: 4.2, seenTime: 1.5, timeout: 45, onSeen: () => A.swell(1.2, 0.25) });
    });
    G.once("wheelMove", () => S.phase >= 2 && S.ev.sight1 && S.floor === "ground" && G.dist(8.7, 11.6) > 5 && !onScreen(8.7, 11.6), () => {
        const opts = [[12.9, 6.7], [17.3, 11.2], [13.2, 15.3]].filter(([x, y]) => G.dist(x, y) > 4 && !onScreen(x, y));
        if (!opts.length) { S.ev.wheelMove = false; return; }
        const [x, y] = pick(opts), s = W.spriteById.wheelchair; s.x = x; s.y = y; G.flag("wheelMoved", true);
    });
    // footsteps pacing upstairs once the clock is solved
    G.once("pacing", () => S.flags.clockSolved && S.t - S.flags.solvedAt > 6 && S.floor === "ground", () => {
        for (let i = 0; i < 9; i++) G.later(i * 0.7, () => A.footstep("ghost", 1.2, { x: 4 + i * 1.2, y: 6.5, floor: "upper", above: true }));
        G.later(7, () => A.creak({ x: 14, y: 6.5, floor: "upper", above: true }, 0.6, 1.2));
    });
    G.once("radioOn", () => S.flags.clockSolved && S.t - S.flags.solvedAt > 20 && S.floor === "ground" && G.dist(5.5, 6.6) > 6, () => { setRadio("static"); });
    G.once("raviTurns", () => S.flags.clockSolved && S.floor === "ground" && !onScreen(16.5, 1.0, 0.6), () => W.setDecal("raviPortrait", { variant: "away" }));
    G.once("radioAgain", () => S.flags.radioOffT && S.t - S.flags.radioOffT > 60 && S.phase >= 3 && S.floor === "ground" && G.dist(5.5, 6.6) > 7, () => setRadio(S.power ? "music" : "static"));

    // PHASE 4 — upstairs ---------------------------------------------------
    G.once("familyPortrait", () => S.phase >= 4 && S.floor === "ground" && !onScreen(9.5, 1.0, 0.6), () => W.setDecal("familyPortrait", { ravi: "empty" }));
    G.once("portraits", () => S.flags.visitedNursery && S.floor === "upper" && !onScreen(6.5, 5.9) && !onScreen(12.5, 5.9) && !onScreen(17.5, 5.9) && (inRoom("Nursery") || inRoom("Bedroom") || inRoom("Bathroom")), () => {
        W.setDecal("pRavi", { variant: "empty" }); W.setDecal("pKamla", { variant: "closed" }); W.setDecal("pMisty", { variant: "away" });
        G.flag("portraitsChanged", true);
    });
    G.once("dollMove", () => S.flags.gotFuse && S.floor === "upper" && !inRoom("Nursery") && !onScreen(12.5, 10.3) && G.dist(12.5, 10.3) > 4, () => {
        W.spriteById.doll.visible = false; W.spriteById.dollCorridor.visible = true; G.flag("dollMoved", true);
    });
    G.once("mirror", () => S.phase >= 3 && S.floor === "upper" && G.dist(9.5, 1.05) < 1.9 && facing(9.5, 0.9) < 0.3, () => {
        W.setDecal("bathMirror", { figure: true }); local.mirror = 1; local.mirrorA = S.a; local.mirrorT = 0;
        A.swell(1.0, 0.3); G.later(0.3, () => A.whisper({ x: 9.5, y: 3.5, floor: "upper" }, 1.0, 0.3));
    });
    if (local.mirror === 1) {
        local.mirrorT += dt;
        if (Math.abs(angDiff(S.a, local.mirrorA)) > 1.4 || local.mirrorT > 2.2) {
            local.mirror = 2; W.setDecal("bathMirror", { figure: false, cracked: Math.abs(angDiff(S.a, local.mirrorA)) > 1.4 }); G.flag("mirrorDone", true);
        }
    }
    G.once("attic", () => S.floor === "upper" && G.dist(5.5, 7.5) < 2.4, () => { A.knock({ x: 5.5, y: 8.2, floor: "upper" }, 2, 0.5); G.later(1.4, () => A.whisper({ x: 5.5, y: 8.4, floor: "upper" }, 1.4, 0.3)); });
    G.once("corridorSteps", () => S.flags.gotCellarKey && S.t - S.flags.coatAt > 3 && S.floor === "upper" && inRoom("Bedroom"), () => {
        for (let i = 0; i < 8; i++) G.later(i * 0.62, () => A.footstep("ghost", 1, { x: 7 + i, y: 6.5, floor: "upper" }));
        G.later(5.6, () => {
            const d = G.door("bedDoor");
            if (S.floor === "upper" && inRoom("Bedroom")) G.closeDoor(d, true);
        });
    });
    G.once("upArrive", () => S.floor === "upper", () => {
        S.phase = Math.max(S.phase, 4);
        G.later(0.8, () => G.ghostAppear("upper", 17.3, 6.5, { vanishDist: 13, seenTime: 2.4, timeout: 9, alpha: 0.85 }));
        G.later(5.0, () => { const d = G.door("nurseryDoor"); d.target = 0.95; d.speed = 0.22; A.doorCreak(G.doorPos(d), 3.6, 0.5); });
    });

    // CELLAR -----------------------------------------------------------------
    G.once("cellar1", () => S.floor === "basement", () => { RT.flicker = 1.6; G.later(2, () => A.drip({ x: 4, y: 3, floor: "basement" })); });
    G.once("bulbBehind", () => S.power && S.floor === "basement" && S.x < 5.2 && S.y > 8.5 && !onScreen(8.5, 10.5, 0.9), () => {
        const L = W.lightById.c_corr; L.on = false; const s = W.spriteById.c_corr_s; if (s) s.spr = "bulb";
        A.flickerBuzz({ x: 8.5, y: 10.5, floor: "basement" }); A.tick({ x: 8.5, y: 10.5, floor: "basement" }, true, 0.6);
    });
    // the coat turns up on the rocking chair downstairs
    G.once("coatRocker", () => S.flags.gotCellarKey && S.floor === "ground" && !onScreen(3.4, 8.0) && G.dist(3.4, 8.0) > 4, () => {
        G.flag("coatOnRocker", true);
        const cs = W.spriteById.coatstand; if (cs) cs.spr = "coatstand_empty";
        S.flags.coatGone = true;
    });

    // PHASE 6 — the house turns ---------------------------------------------
    G.once("hostile", () => S.phase >= 6 && S.floor === "ground", () => {
        W.setDecal("hallPhotos", { variants: ["scratched", "scratched", "scratched", "scratched", "scratched"] });
        W.setDecal("familyPortrait", { ravi: "empty", kamla: "closed", misty: "away" });
        const d = G.door("diningDoor"); if (d) G.closeDoor(d, true);
    });
}

function facing(x, y) { return Math.abs(angDiff(Math.atan2(y - S.y, x - S.x), S.a)); }
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

/* ---------------- background scares (sparing, phase-scaled) ---------------- */
function randomCell(minD, maxD, noSight) {
    const F = G.floor();
    for (let k = 0; k < 30; k++) {
        const x = Math.floor(S.x + rnd(-maxD, maxD)), y = Math.floor(S.y + rnd(-maxD, maxD));
        if (!W.cellOpen(F, x, y, true)) continue;
        const d = G.dist(x + 0.5, y + 0.5);
        if (d < minD || d > maxD) continue;
        if (noSight && W.los(F, S.x, S.y, x + 0.5, y + 0.5)) continue;
        return { x: x + 0.5, y: y + 0.5, floor: S.floor };
    }
    return null;
}
const POOL = [
    { id: "creak", phase: 1, w: 3, run: () => { const p = randomCell(3, 8, false); if (p) A.creak(p, 0.35); return !!p; } },
    { id: "above", phase: 2, w: 2, when: () => S.floor === "ground", run: () => { const x = rnd(3, 15); for (let i = 0; i < 4; i++) G.later(i * 0.75, () => A.footstep("ghost", 1, { x: x + i * 0.6, y: 6.5, floor: "upper", above: true })); return true; } },
    { id: "steps", phase: 2, w: 2, run: () => {
        const p = randomCell(5, 10, true); if (!p) return false;
        const a = Math.random() * 6.28;
        for (let i = 0; i < 5; i++) G.later(i * 0.6, () => A.footstep("ghost", 0.9, { x: p.x + Math.cos(a) * i * 0.5, y: p.y + Math.sin(a) * i * 0.5, floor: p.floor }));
        return true;
    } },
    { id: "whisper", phase: 2, w: 1.6, run: () => { const b = S.a + Math.PI + rnd(-0.8, 0.8), r = rnd(2.5, 4.5); A.whisper({ x: S.x + Math.cos(b) * r, y: S.y + Math.sin(b) * r, floor: S.floor }, rnd(1.4, 2.6), 0.3); return true; } },
    { id: "knock", phase: 2, w: 1.4, run: () => {
        const F = G.floor(); const ds = F.doorList.filter(d => d.open < 0.3 && G.dist(d.x + 0.5, d.y + 0.5) < 9 && G.dist(d.x + 0.5, d.y + 0.5) > 2.5);
        if (!ds.length) return false; const d = pick(ds); A.knock(G.doorPos(d), pick([2, 3, 3]), 0.7); return true;
    } },
    { id: "drift", phase: 3, w: 1.4, run: () => {
        const F = G.floor(); const ds = F.doorList.filter(d => !d.locked && d.mode === "hinge" && G.dist(d.x + 0.5, d.y + 0.5) > 3 && G.dist(d.x + 0.5, d.y + 0.5) < 10 && !onScreen(d.x + 0.5, d.y + 0.5));
        if (!ds.length) return false; const d = pick(ds);
        d.target = d.open > 0.5 ? rnd(0.15, 0.35) : rnd(0.6, 0.9); d.speed = 0.18; A.doorCreak(G.doorPos(d), 3.5, 0.4); return true;
    } },
    { id: "fall", phase: 4, w: 1, run: () => { const p = randomCell(5, 11, true); if (p) A.fall(p, 0.7); return !!p; } },
    { id: "cross", phase: 4, w: 1.2, run: crossScare },
    { id: "flicker", phase: 4, w: 2, when: () => S.power, run: () => {
        const F = G.floor(); const ls = F.lights.filter(L => L.bulb !== undefined && L.on && G.dist(L.x, L.y) < 7);
        if (!ls.length) return false; const L = pick(ls); L.flickerT = rnd(0.8, 2.2); A.flickerBuzz({ x: L.x, y: L.y, floor: S.floor }); return true;
    } },
    { id: "appear", phase: 6, w: 1.4, run: () => {
        const p = randomCell(6, 11, false); if (!p || onScreen(p.x, p.y)) return false;
        G.ghostAppear(S.floor, p.x, p.y, { vanishDist: 4.5, seenTime: 0.9, timeout: 20 }); return true;
    } }
];
function crossScare() {
    const F = G.floor(), fx = Math.cos(S.a), fy = Math.sin(S.a);
    for (let k = 0; k < 25; k++) {
        const side = Math.random() < 0.5 ? -1 : 1, ang = S.a + side * rnd(0.42, 0.55), r = rnd(4.5, 8);
        const x = S.x + Math.cos(ang) * r, y = S.y + Math.sin(ang) * r;
        if (!W.cellOpen(F, Math.floor(x), Math.floor(y), true) || !W.los(F, S.x, S.y, x, y)) continue;
        // move across the line of sight, away from the centre of the screen
        const px = -fy * side, py = fx * side;
        if (!W.cellOpen(F, Math.floor(x + px * 1.4), Math.floor(y + py * 1.4), true)) continue;
        G.ghostCross(S.floor, x, y, x + px * 1.6, y + py * 1.6, 3.4);
        return true;
    }
    return false;
}
function ambientScares(dt) {
    const g = G.ghost;
    if (RT.overlay || RT.transit || g.on || S.flags.chase || S.flags.finalStarted || S.t < 25) return;
    // footsteps that keep going after you stop
    local.stillCool -= dt;
    if (S.phase >= 2 && RT.stillT > 4.5 && local.stillCool <= 0 && !RT.hidden) {
        local.stillCool = rnd(70, 110);
        const b = S.a + Math.PI;
        G.later(0.2, () => A.footstep(W.surfaceAt(G.floor(), S.x, S.y), 0.45, { x: S.x + Math.cos(b) * 2.2, y: S.y + Math.sin(b) * 2.2, floor: S.floor }));
        G.later(0.8, () => A.footstep(W.surfaceAt(G.floor(), S.x, S.y), 0.5, { x: S.x + Math.cos(b) * 1.6, y: S.y + Math.sin(b) * 1.6, floor: S.floor }));
        return;
    }
    local.scareT -= dt;
    if (local.scareT > 0 || RT.hidden) return;
    const cool = { 1: [40, 70], 2: [28, 48], 3: [26, 44], 4: [22, 38], 5: [30, 40], 6: [15, 28] }[S.phase] || [30, 50];
    const opts = POOL.filter(p => p.phase <= S.phase && p.id !== local.last && (!p.when || p.when()));
    let tot = opts.reduce((a, p) => a + p.w, 0), r = Math.random() * tot;
    for (const p of opts) { r -= p.w; if (r <= 0) { if (p.run()) local.last = p.id; break; } }
    local.scareT = rnd(cool[0], cool[1]);
}
function weather(dt) {
    if (S.flags.dawn) return;
    local.thunderT -= dt;
    if (local.thunderT <= 0 && S.floor !== "basement") {
        local.thunderT = rnd(26, 60) * (S.phase >= 6 ? 0.6 : 1);
        RT.lightning = rnd(0.6, 1);
        G.later(rnd(0.5, 1.8), () => A.thunder(rnd(0.5, 0.9)));
    }
    if (S.floor === "basement") {
        local.dripT -= dt;
        if (local.dripT <= 0) { local.dripT = rnd(1.5, 5); const p = randomCell(1, 6, false); if (p) A.drip(p); }
    }
}

C.onFloor = function () {};
C.onDeath = function () { stopPhone(); };
C.extraSprites = function () {};
})();
