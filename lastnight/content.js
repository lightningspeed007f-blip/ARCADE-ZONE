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
    studyKey: { name: "Chhoti lohe ki chaabi", desc: "Kuen se nikli, geele kapde mein lipti hui. Uspe lambe kaale baal lipte hue the." },
    gateKey: { name: "Peetal ki chaabi — “UPAR”", desc: "Study ki ghadi ke andar se mili. Kaagaz ki parchi pe likha hai UPAR." },
    photo: { name: "Family ki photo", desc: "Diwali 1986. Ek aadmi, ek aurat, ek chhoti bachchi. Aadmi ka chehra khurach ke mita diya gaya hai." },
    cellarKey: { name: "Bhaari lohe ki chaabi", desc: "Upar wale coat ki jeb se mili. Andar ka kapda abhi bhi garam tha." },
    fuse: { name: "Purana fuse", desc: "Ek purana 30-amp mains fuse, ek bachche ke rumaal mein lipta hua." },
    keyring: { name: "Ravi ka chaabi ka guchha", desc: "Taale ki ek badi lohe ki chaabi, aur ghadi mein chaabi bharne wali ek chhoti peetal ki chaabi." }
};

/* ======================================================================
   NOTES
   ====================================================================== */
C.NOTES = {
    news: {
        title: "Phata hua akhbaar", style: "news",
        body: `<div class="mast">NAGAR SAMACHAR</div><div class="date">Somvaar, 16 November 1987</div>
<h3>MEHRA HAVELI MEIN HAADSA</h3>
<p>…Smt. Kamla Mehra (34) aur unki beti Misty (7) ki laashein Ravivaar subah doodhwale ko milin. Ghar ka main darwaza <b>andar se</b> zanjeer se band tha.</p>
<p>Police ke mutaabik ghar ki har ghadi <b>3:17</b> pe ruki hui thi.</p>
<p>Ghar ke maalik, Shri Ravi Mehra, November ki shuruaat se kisi ko nahi dikhe. Padosiyon ne bataya ki woh “safar pe gaye hain”. Ghar ki talaashi mein mila—</p>
<p class="torn">&nbsp;</p>`
    },
    diary1: {
        title: "Diary ka panna — Kamla", style: "paper",
        body: `<p class="date">12 November</p>
<p>Ravi ab har raat study ki chaabi baalti ki rassi se baandh ke kuen mein latka deta hai, taaki main na padh sakun ki woh wahan kya likhta hai. Kehta hai raat ko ghar usse baatein karta hai. Kehta hai ghar <i>saans leta hai</i>.</p>
<p>Aaj raat usne phir se chauthi thaali lagayi. “Mehmaan ke liye,” usne kaha.</p>
<p>Saalon se hamare ghar koi mehmaan nahi aaya.</p>`,
        onRead: () => { G.flag("readDiary1", true); }
    },
    ravi: {
        title: "Desk pe pada note", style: "scrawl",
        body: `<p>Raat ko yeh saans leta hai. Andar. Bahar. Andar.</p>
<p>Maine har raat gina. Yeh hamesha usi minute pe rukta hai, aur ghar ki har ghadi iske saath ruk jaati hai.</p>
<p class="big">JAB GHAR KI SAANS RUKI,<br>SUIYON NE RAASTA DIKHAYA.</p>
<p>Gate band rakho. Misty ko upar rakho.<br>Mehmaan ki thaali garam rakho.</p>`
    },
    photo: {
        title: "Family ki photo", style: "photo",
        body: `<div class="photoFrame"><canvas id="photoCanvas" width="300" height="200"></canvas></div><p class="back">Peeche likha hai: <i>“Diwali 1986. Aakhri achhi Diwali.”</i></p>`,
        onRead: () => drawPhoto()
    },
    diary2: {
        title: "Diary — Kamla", style: "paper",
        body: `<p class="date">14 November</p>
<p>Humein yeh karna pada. Pandit-ji ne kaha ki Ravi ke andar jo hai, woh so jaayega agar use ghar ke neeche, roshni se door rakha jaaye. Neeche ka darwaza ab steel ka hai. Main uski taraf dekh bhi nahi paayi.</p>
<p>Misty poochhti hai Papa kahan gaye. Maine bola woh safar pe hain. Usne fuse apne toy box mein chhupa diya taaki koi neeche ki lights na jala sake. Meri achhi bachchi.</p>
<p>Pandit-ji ne ek baat aur kahi: <b>hall ki badi ghadi kabhi rukni nahi chahiye. Agar woh ruki, toh yeh raat kabhi khatam nahi hogi.</b> Usme chaabi bharte raho.</p>
<p>Teen baj gaye hain. Mujhe farsh ke neeche se uske gaane ki awaaz aa rahi hai.</p>`,
        onRead: () => { G.flag("readDiary2", true); }
    },
    pandit: {
        title: "Ghanti ke neeche muda kaagaz", style: "paper",
        body: `<p>Diye jalte rehne do, din raat.</p><p><b>Jahan diye jalte hain, woh wahan nahi aa sakta.</b></p><p class="sign">— Pt. Shivnath</p>`,
        onRead: () => G.flag("readPandit", true)
    },
    drawing1: { title: "Misty ki drawing", style: "drawing", drawing: 1, body: "" },
    drawing2: { title: "Misty ki drawing", style: "drawing", drawing: 2, body: "" },
    drawing3: { title: "Deewar pe neeche bani drawing", style: "drawing", drawing: 3, body: `<p class="back">Neele aadmi ke haath mein suitcase hai.</p>` }
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
    { id: "almirah", floor: "ground", x: 1.05, y: 13.5, label: "Almari mein chhupo", view: { x: 1.22, y: 13.5, a: 0 }, exit: { x: 1.7, y: 13.5, a: 0 }, near: { x: 2.4, y: 13.6 }, mask: "gap" },
    { id: "pantry", floor: "ground", x: 20.5, y: 15.95, label: "Pantry mein chhupo", view: { x: 20.5, y: 15.8, a: -Math.PI / 2 }, exit: { x: 20.5, y: 15.3, a: -Math.PI / 2 }, near: { x: 20.6, y: 14.6 }, mask: "slats" },
    { id: "wardrobe", floor: "upper", x: 14.5, y: 1.05, label: "Almari mein chhupo", view: { x: 14.5, y: 1.2, a: Math.PI / 2 }, exit: { x: 14.4, y: 1.75, a: Math.PI / 2 }, near: { x: 14.3, y: 2.6 }, mask: "gap" },
    { id: "tub", floor: "upper", x: 9.0, y: 3.4, label: "Parde ke peeche chhupo", view: { x: 9.0, y: 3.7, a: Math.PI / 2 }, exit: { x: 10.4, y: 3.4, a: Math.PI }, near: { x: 9.6, y: 4.5 }, mask: "curtain" },
    { id: "crates", floor: "basement", x: 16.5, y: 7.55, label: "Crates ke beech mein chhupo", view: { x: 16.5, y: 7.78, a: -Math.PI / 2 }, exit: { x: 16.5, y: 7.35, a: -Math.PI / 2 }, near: { x: 16.5, y: 6.1 }, mask: "crates" }
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
    I({ floor: "ground", x: 15.5, y: 17.05, label: "Photos dekho", use: () => G.think(S.phase >= 6 ? "Har photo mein har chehra khurach ke mita diya gaya hai." : "Family ki photos. Ek shaadi, ek baby, aangan mein jhoole pe ek ladki.") });
    I({ floor: "ground", x: 8.05, y: 17.5, label: "Paas se dekho", use: () => G.think("Deewar pe neeche, kisi bachche ke haath se khurach ke likha hai: “hum abhi bhi yahin hain”.") });
    I({ floor: "ground", x: 1.5, y: 6.7, r: 1.4, label: () => S.flags.phoneState === "ringing" ? "Phone uthao" : "Akhbaar padho", use: phoneUse });
    I({ floor: "ground", x: 5.5, y: 6.6, r: 1.4, label: () => S.flags.radio && S.flags.radio !== "off" ? "Radio band karo" : "Radio dekho", use: radioUse });
    I({ floor: "ground", x: 3.4, y: 8.0, r: 1.4, label: "Jhoolne wali kursi dekho", use: () => G.think(S.flags.coatOnRocker ? "Ab kursi pe Papa ka coat pada hai. Geela hai, jaise koi abhi baarish se andar aaya ho." : "Ek jhoolne wali kursi, uspe tah kiya hua shawl. Abhi bhi hil rahi hai. Bas thoda sa.") });
    I({ floor: "ground", x: 3.5, y: 6.05, label: "Ghadi dekho", use: () => G.think(S.flags.parlorClockStopped ? "Pendulum bilkul ruka hua hai. Abhi ek pal pehle tak tik-tik kar raha tha." : "Ek purani deewar ghadi. Teen baj ke nau minute ho rahe hain.") });
    I({ floor: "ground", x: 1.05, y: 8.5, label: "Khidki se bahar dekho", use: () => G.think(S.flags.curtainSeen ? "Khidki kas ke band hai. Hawa bilkul nahi aa rahi." : "Baarish, aur pedon ki kaali parchhaiyan. Khidki andar se band hai.") });
    I({ floor: "ground", x: 6.95, y: 10.5, label: "Photos dekho", use: () => G.think(S.phase >= 4 ? "Frame abhi bhi wahin hain. Unme log nahi hain." : "Family ki purani photos. Safed kurte mein ek aadmi, ek aurat, do choti wali ek chhoti ladki.") });
    I({ floor: "ground", x: 2.6, y: 13.2, r: 1.3, label: "Chaadar hatao", use: () => G.think("Chaadar ke neeche bachche ka ek palna, mod ke rakha hua. Uspe naam likha hai: MISTY.") });
    I({ floor: "ground", x: 1.5, y: 20.95, label: "Drawing dekho", use: () => G.readNote("drawing3") });
    I({ floor: "ground", x: 5.5, y: 17.05, label: "Nishaan dekho", use: () => G.think("Deewar pe pencil ke nishaan, ek ke upar ek. MISTY 5. MISTY 6. MISTY 7. Saat ke baad kuch nahi.") });
    I({ floor: "ground", x: 9.5, y: 1.05, label: "Tasveer dekho", use: () => G.think(S.phase >= 4 ? "Family ki tasveer. Jahan papa khade the, wahan ab sirf kaala rang hai." : "Family ki tasveer: Ravi, Kamla, aur beech mein Misty. Koi nahi muskura raha.") });
    I({ floor: "ground", x: 16.5, y: 1.05, label: "Tasveer dekho", use: () => G.think(S.phase >= 3 ? "R. MEHRA. Tasveer wale aadmi ne room ki taraf peeth kar li hai." : "R. MEHRA. Tum kahin bhi khade ho, woh seedha tumhe hi dekhta hai.") });
    I({ floor: "ground", x: 15.5, y: 1.6, r: 1.2, label: "Laaltain dekho", use: () => G.think(S.flags.lanternLit ? "Kisi ne ise jala diya hai. Na maachis hai, na dhuen ki boo." : "Ek purani laaltain. Sookhi padi hai. Saalon se nahi jali.") });
    I({ floor: "ground", x: 22.5, y: 1.05, r: 1.5, label: () => S.notes.includes("pandit") ? "Ghanti bajao" : "Ghanti ke neeche ka note padho", use: () => { if (!S.notes.includes("pandit")) G.readNote("pandit"); else A.bell({ x: 22.5, y: 1.1, floor: "ground" }, 0.7); } });
    I({ floor: "ground", x: 13.0, y: 11.0, r: 1.6, label: () => S.flags.wellDone ? "Kuen mein jhaanko" : "Charkhi ghumao", hold: wellHold, use: () => G.think("Bahut neeche kaala paani. Koi cheez dheere se pattharon pe thak-thak kar rahi hai.") });
    I({ floor: "ground", x: 0, y: 0, r: 1.4, label: "Wheelchair dekho", spriteId: "wheelchair", use: () => G.think(S.flags.wheelMoved ? "Wheelchair. Yeh toh aangan ki doosri taraf thi. Iske pahiye geele hain." : "Ek purani wheelchair, uspe tah kiya kambal. Yahan kisi ki Dadi rehti thi.") });
    I({ floor: "ground", x: 21.9, y: 8.4, r: 1.9, label: () => !S.notes.includes("diary1") ? "Diary ka panna padho" : "Table dekho", use: diningUse });
    I({ floor: "ground", x: 23.5, y: 6.05, label: "Photos dekho", use: () => G.think("Sideboard ki har photo mein us aadmi ne camera se apna muh pher liya hai.") });
    I({ floor: "ground", x: 23.6, y: 12.7, r: 1.3, label: "Giri hui ghadi dekho", use: () => { G.flag("sawKitchenClock", true); G.think("Kitchen ki ghadi farsh pe ulti padi hai, kaanch toota hua. Yeh 3:17 pe ruki thi."); } });
    I({ floor: "ground", x: 19.5, y: 12.05, label: "Calendar dekho", use: () => G.think("November 1987. 14 tareekh pe laal gola bana hai. Uske baad ka har din khaali hai.") });
    I({ floor: "ground", x: 3.5, y: 2.2, r: 1.6, label: "Desk pe pada note padho", use: () => G.readNote("ravi") });
    I({ floor: "ground", x: 3.5, y: 1.05, label: "Kitaabein dekho", use: () => G.think("Bahi-khaate, zameen ke kaagaz… aur ghadiyon pe kitaabon se bhari ek poori shelf.") });
    I({ floor: "ground", x: 6.95, y: 1.5, label: "Akhbaar ki katrane dekho", use: () => G.think("Deewar pe akhbaar ki katrane lagi hain. Is ghar mein hui mautein: 1891, 1923, 1952. Har ek pe gola bana hai.") });
    I({ floor: "ground", x: 3.5, y: 4.95, label: () => S.flags.clockSolved ? "Ghadi dekho" : "Deewar ghadi ko dhyaan se dekho", use: studyClockUse });

    /* ---------------- UPSTAIRS ---------------- */
    I({ floor: "upper", x: 6.5, y: 6.05, label: "Tasveer dekho", use: () => G.think(S.flags.portraitsChanged ? "RAVI. Frame mein ab sirf ek khaali, andhera kamra hai." : "RAVI. Painter ne uski aankhon mein kuch aisa pakda jo photos mein nahi dikhta.") });
    I({ floor: "upper", x: 12.5, y: 6.05, label: "Tasveer dekho", use: () => G.think(S.flags.portraitsChanged ? "KAMLA. Uski aankhein band hain. Pehle khuli thi." : "KAMLA. Ek pyaara sa chehra, bade pyaar se banaya hua.") });
    I({ floor: "upper", x: 17.5, y: 6.05, label: "Tasveer dekho", use: () => G.think(S.flags.portraitsChanged ? "MISTY. Woh muh pher ke khidki ki taraf dekh rahi hai." : "MISTY. Laal ribbon wali do chotiyan. Saat saal ki lagti hai.") });
    I({ floor: "upper", x: 2.5, y: 1.05, label: "Drawing dekho", use: () => { G.readNote("drawing1"); G.flag("visitedNursery", true); } });
    I({ floor: "upper", x: 6.5, y: 1.05, label: "Drawing dekho", use: () => { G.readNote("drawing2"); G.flag("visitedNursery", true); } });
    I({ floor: "upper", x: 2.0, y: 1.6, r: 1.4, label: "Bistar dekho", use: () => G.think(S.flags.dollMoved ? "Takiye se gudiya gaayab hai. Jahan woh baithi thi, wahan halka sa gaddha hai." : "Ek chhota bistar, chaadar aise mudi hai jaise kisi ka intezaar ho. Takiye pe kapde ki ek gudiya baithi hai.") });
    I({ floor: "upper", x: 5.4, y: 1.5, r: 1.4, label: () => S.flags.gotFuse ? "Khilaune ka box dekho" : "Khilaune ka box kholo", use: toyChestUse });
    I({ floor: "upper", x: 9.5, y: 1.05, label: "Sheeshe mein dekho", use: () => G.think(S.flags.mirrorDone ? "Bas tumhara apna chehra, feeka aur thaka hua." : "Purane sheeshe mein tumhara apna chehra.") });
    I({ floor: "upper", x: 15.6, y: 1.5, r: 1.8, label: "Bistar pe padi diary padho", use: () => G.readNote("diary2") });
    I({ floor: "upper", x: 18.2, y: 1.6, r: 1.4, label: () => S.flags.gotCellarKey ? "Coat stand dekho" : "Coat ki talaashi lo", use: coatUse, when: () => !S.flags.coatGone });
    I({ floor: "upper", x: 12.5, y: 10.95, label: "Khidki se bahar dekho", use: () => G.think("Neeche aangan. Kuan. Baarish. Saamne wale kamre mein ek light jal rahi hai… phir nahi.") });
    I({ floor: "upper", x: 12.5, y: 10.35, r: 1.2, label: "Gudiya dekho", when: () => S.flags.dollMoved, use: () => G.think("Bachchon ke kamre wali gudiya. Corridor ki taraf muh karke baithi hai. Tumhari taraf.") });
    I({ floor: "upper", x: 9.5, y: 6.95, label: "Photos dekho", use: () => G.think("School ki ek photo. Aage ki line mein ek ladki ke chaaron taraf laal crayon se gola bana hai.") });

    /* ---------------- CELLAR ---------------- */
    I({ floor: "basement", x: 1.05, y: 2.5, r: 1.5, label: fuseLabel, use: fuseUse });
    I({ floor: "basement", x: 1.05, y: 10.5, r: 1.4, label: () => S.flags.gotKeyring ? null : "Chaabi ka guchha uthao", use: takeKeyring });
    I({ floor: "basement", x: 3.7, y: 11.4, r: 1.2, label: "Katori dekho", use: () => G.think("Steel ki katori mein daal chawal. Abhi bhi garam hai.") });
    I({ floor: "basement", x: 2.4, y: 12.2, r: 1.5, label: "Khaat dekho", use: () => G.think("Rassi ki khaat. Uske dhaanche pe zanjeerein kasi hui hain. Kambal abhi bhi garam hai.") });
    I({ floor: "basement", x: 2.5, y: 9.05, label: "Khuraachein dekho", use: () => G.think("Saikdon khuraachein, paanch-paanch ke jhund mein. Yahan neeche koi din gin raha tha.") });
    I({ floor: "basement", x: 1.05, y: 9.5, label: "Photos dekho", use: () => G.think("Family ki photos, deewar pe lagi aur baar-baar khurachi hui. Kamla. Misty. Kuch anjaan log bhi — dekhne mein musafir lagte hain.") });
    I({ floor: "basement", x: 2.5, y: 12.95, r: 1.6, label: "Deewar padho", use: () => G.think("“UNHONE MUJHE ROSHNI KE NEECHE DAALA. KOI NAHI JAAYEGA.”") });
    I({ floor: "basement", x: 4.95, y: 9.5, r: 1.2, label: "Switch dabao", use: () => { A.tick(null, true, 0.5); G.think(S.power ? "Switch click hua. Steel ke darwaze ka lock pehle se hara hai." : "Click hua. Kuch nahi. Bijli nahi hai."); } });
};

/* ---------------- doors ---------------- */
function doorLabel(d) {
    if (d.id === "cupboard") return d.locked ? (S.y < 11.5 ? (S.flags.cupboardCold ? "Almari dhakelo" : "Almari ko dhyaan se dekho") : "Panel dhakelo") : null;
    if (d.id === "boltDoor" && d.locked) return S.x < 7.5 ? "Kundi kholo" : "Darwaza kholo";
    if (d.mode === "slide" && !d.locked) return null;
    if (d.locked) return d.key && G.has(d.key) ? "Taala kholo" : (d.id === "gate" ? "Gate kholo" : "Darwaza kholo");
    return d.open > 0.5 ? "Darwaza band karo" : "Darwaza kholo";
}
C.tryUnlock = function (d) {
    if (d.id === "cupboard") {
        if (S.y < 11.5 && !S.flags.cupboardCold) { G.flag("cupboardCold", true); G.think("Is almari ke peeche se thandi hawa aa rahi hai."); A.whisper({ x: 2.5, y: 12.5, floor: "ground" }, 1.2, 0.25); return true; }
        d.locked = false; G.openDoor(d, 0.45); G.think(S.y < 11.5 ? "Poori almari khisak ke side ho gayi. Peeche ek kamra hai." : "Panel khul gaya: yeh toh ek almari ka peechla hissa hai."); return true;
    }
    if (d.id === "boltDoor") { if (S.x < 7.5) { d.locked = false; A.unlock(G.doorPos(d)); G.openDoor(d, 1.4); return true; } return false; }
    if (d.key === "never") {
        A.rattle(G.doorPos(d), 0.7);
        G.later(0.9, () => A.knock(G.doorPos(d), 3, 0.9));
        G.think(S.flags.atticKnocked ? "Band hai. Doosri taraf se koi wapas khatkhatata hai. Teen baar. Hamesha teen baar." : "Band hai. Ek pal ke liye, doosri taraf se koi wapas khatkhatata hai.");
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
    if (S.flags.dawn) return "Bahar niklo";
    if (!G.has("keyring")) return "Darwaza kholne ki koshish karo";
    if (!S.flags.frontUnlocked) return "Taala kholo";
    return "Darwaza dhakelo";
}
function frontUse() {
    const pos = { x: 13, y: 20.6, floor: "ground" };
    if (S.flags.dawn) { ending(); return; }
    if (!G.has("keyring")) {
        A.rattle(pos, 0.9);
        G.think(S.t < 40 ? "Yeh khul nahi raha. Andar ki taraf zanjeer lagi hai. Jab main andar aaya tha tab yeh nahi thi." : "Andar se zanjeer lagi hai. Zanjeer pe ek bhaari taala latka hai.");
        return;
    }
    if (!S.flags.frontUnlocked) {
        G.flag("frontUnlocked", true);
        A.unlock(pos); G.later(0.4, () => A.rattle(pos, 1));
        W.setDecal("frontL", { chain: false }); W.setDecal("frontR", { chain: false });
        G.later(1.2, () => G.think("Zanjeer gir gayi. Darwaza phir bhi nahi hil raha — jaise doosri taraf se koi use pakad ke khada ho."));
        G.later(5.8, () => G.think(S.flags.readDiary2 ? "“Agar badi ghadi ruki, toh yeh raat khatam nahi hogi.” Mere peeche, hall ki ghadi khamosh hai." : "Mere peeche, hall ki purani ghadi khamosh hai. Uska pendulum ruka hua hai."));
        if (!S.flags.finalStarted) G.checkpoint("final");
        return;
    }
    A.thump(pos, 0.7);
    G.think("Yeh nahi hil raha. Raat abhi khatam nahi hui.");
}
function clockLabel() {
    if (S.flags.wound) return "Ghadi ki awaaz suno";
    if (G.has("keyring")) return `Ghadi mein chaabi bharo (${(S.flags.windTurns || 0) + 1}/3)`;
    return "Ghadi ko dhyaan se dekho";
}
function clockUse() {
    if (S.flags.wound) { G.think("Tik. Tik. Yeh phir se chal padi."); return; }
    G.think("Hall ki badi ghadi. Khamosh. Iski suiyan 3:17 pe ruki hain. Chaabi bharne ke liye ek chhota sa ched hai.");
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
            G.think("Baalti ke andar, geele kapde mein lipti: ek chhoti lohe ki chaabi. Uspe lambe kaale baal kas ke lipte hain.", 6);
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
            ["<i>(khar-khar… aur saans ki awaaz, receiver ke bilkul paas)</i>", 3.2, () => A.static(2.5, 0.12)],
            ["<i>(ek bachche ki awaaz)</i> …hello?", 2.6],
            ["…tum khaana khaake jaoge na?", 3.4],
            ["<i>(line kat jaati hai)</i>", 2.2, () => A.tick(null, true, 0.6)]
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
        G.think("Sannata. Ab theek hai.");
        return;
    }
    G.think(S.flags.radioOffT ? "Dial garam hai. Maine toh ise band kiya tha… kiya tha na?" : "Ek purana valve radio. Battery wala. Dekhne mein toh bekaar pada hai.");
}

/* ---------------- dining ---------------- */
function diningUse() {
    if (!S.notes.includes("diary1")) { G.readNote("diary1"); return; }
    if (S.flags.served) G.think("Chaar thaali, khaana parosa hua. Chawal, daal, aur chauthi thaali mein kuch gehra laal sa. Mehmaan ki kursi pe Papa ka coat tanga hai.");
    else G.think("Saaf kapde pe chaar thaali lagi hain. Ek kursi bahar khinchi hui, jaise kisi mehmaan ke liye. Mombatti nayi hai.");
}

/* ---------------- study clock puzzle ---------------- */
function studyClockUse() {
    if (S.flags.clockSolved) { G.think("Dial ke neeche ka chhota darwaza khula latka hai. Andar ghadi ulti chal rahi hai."); return; }
    G.openClock(12, 0, "Kaanch ka darwaza jaam hai, par dhakelne pe suiyan ghoom jaati hain. Dial ke neeche peetal ka ek chhota darwaza hai, bina handle ke.", (h, m) => {
        if (h === 3 && m === 17) solveClock();
        else {
            S.flags.clockTries = (S.flags.clockTries || 0) + 1;
            A.creak({ x: 3.5, y: 4.8, floor: "ground" }, 0.4, 0.5);
            W.setDecal("studyClock", { h: 12, m: 0 });
            const tries = S.flags.clockTries;
            if (tries >= 4) G.think("Kuch nahi. Suiyan dheere-dheere wapas baarah pe aa gayi. …Is ghar ki har ghadi ek hi minute pe ruki thi.");
            else if (tries >= 2) G.think("Suiyan rengte hue wapas baarah pe aa gayi. Ghar ki saans kab ruki thi?");
            else G.think("Kuch nahi hua. Suiyan apne aap wapas baarah pe chali gayi.");
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
    if (S.flags.gotFuse) { G.think("Lakdi ke blocks, ek rassi, crayons ka dibba. Aur kuch nahi."); return; }
    G.flag("gotFuse", true); G.flag("visitedNursery", true);
    if (sp) sp.spr = "toychest_open";
    A.creak({ x: 5.4, y: 1.5, floor: "upper" }, 0.5, 0.6);
    G.give("fuse");
    G.think("Khilaunon ke neeche, ek chhote se rumaal mein lipta: ek purana fuse.");
    // the music box inside starts by itself as you turn away
    G.later(4, () => { if (S.floor === "upper") { musicBoxEm = A.musicBox({ x: 5.4, y: 1.5, floor: "upper" }); G.later(14, () => { if (musicBoxEm) { musicBoxEm.stop(); musicBoxEm = null; } }); } });
}
function coatUse() {
    if (S.flags.gotCellarKey) { G.think("Bas stand pe ek coat. Bas ek coat."); return; }
    G.flag("gotCellarKey", true);
    G.give("cellarKey");
    A.creak({ x: 18.2, y: 1.6, floor: "upper" }, 0.3, 0.4);
    G.think("Coat bhaari aur geela hai. Jeb mein ek lohe ki chaabi. Andar ka kapda abhi bhi garam hai.", 5);
    S.flags.coatAt = S.t;
}

/* ---------------- cellar ---------------- */
function fuseLabel() {
    if (S.power || S.flags.gotKeyring) return "Fuse box dekho";
    if (S.flags.fuseIn) return "Lever kheencho";
    if (G.has("fuse")) return "Fuse lagao";
    return "Fuse box dekho";
}
function fuseUse() {
    const pos = { x: 1.05, y: 2.5, floor: "basement" };
    if (S.power) { G.think("Lever upar hai. Fuse se hum-hum ki awaaz aa rahi hai."); return; }
    if (S.flags.gotKeyring) { G.think("Fuse kaale pad gaye hain, toote hue. Bijli ab wapas nahi aayegi."); return; }
    if (S.flags.fuseIn) { powerOn(); return; }
    if (G.has("fuse")) {
        G.take("fuse"); G.flag("fuseIn", true);
        W.setDecal("fusebox", { fuse: true });
        A.unlock(pos);
        G.think("Fit ho gaya. Ab lever.");
        return;
    }
    G.think("Mains ka box. Teen mein se ek fuse gaayab hai — khaali jagah pe likha hai MAINS.");
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
    G.later(2.5, () => G.think("Lights aa gayi. Kahin door upar, ek phone do baar bajta hai aur ruk jaata hai."));
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
    G.later(4.5, () => G.think("…Woh chala gaya. Abhi ke liye. Guchhe ki badi chaabi — main darwaze ki hai."));
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
        G.think("Halki dhundhli roshni. Darwaza apne aap khul gaya hai.", 4);
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
    G.later(3.2, () => G.think("Mere peeche darwaza zor se band ho gaya."));
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
            G.later(2.4, () => G.think("…tik-tik ruk gayi.", 2.6));
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
