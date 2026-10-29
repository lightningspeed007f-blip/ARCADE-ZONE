# JAIS: LAST STAND — your images and music

Put your files in this folder with **exactly** these names (lower case — GitHub Pages is case-sensitive).
Images can be `.jpg`, `.jpeg`, `.png` or `.webp`; the game tries each one. Anything missing shows a
painted placeholder, so you can add files one at a time. Nothing is baked into the code: replace a
file, refresh the page, done.

```
laststand/assets/
  shivji.png                 ← the large Shivji image (most important, see below)
  kamakhya.jpg               ← Maa Kamakhya image / logo (sanctum + temple gate)
  photos/photo01.jpg … photo15.jpg
  banners/banner01.jpg … banner05.jpg
  music/song01.mp3 … song06.mp3
  music/templesong.mp3                                       ← the mandir's four loudspeakers
  sounds/pistol.mp3  revolver.mp3  dunali.mp3  rifle.mp3  machinegun.mp3   ← gun fire sounds
  music/zombiechase.mp3  zombiebye.mp3  zombiescream.mp3     ← zombie sounds
  music/shivjibackground.mp3                                 ← the Shivdham reveal music
  maakaali1.png  maakaali3.JPG  maakaali2.png  maakaali4.JPG  ← the hidden Kalidham (see below)
  music/maakaalisong.mp3                                     ← the Kalidham music
  music/spider.mp3                                           ← the giant spider's prowl (all music dips while it is in the sky)
```

## Shivji (`shivji.png`)
- **Best:** PNG with a transparent background, portrait, about 1200 × 1800 px (max 2048 px tall), under 4 MB.
- Also fine: a JPG with a plain, single-colour background (white, black, a flat colour). The game removes
  that background automatically and feathers the edge.
- If the photo has a busy background, the game can't cut it out cleanly; it shows it inside a soft
  arched shrine shape instead of a rectangle. For the best result, upload the transparent PNG.
- The image keeps its own proportions (it is never stretched). It stands on a pedestal in the
  Maa Kamakhya Mandir courtyard, facing the gate, with a soft halo, a gentle bloom and light falling
  on the courtyard.

## Maa Kamakhya (`kamakhya.jpg`)
Square works best (1024 × 1024, under 1 MB). It appears in the sanctum (garbhagriha) and above the
temple gate.

## Photo frames (15) — `photos/photo01.jpg` … `photo15.jpg`
Portrait 3:4 is best (for example 900 × 1200), under 1 MB each. The frame is 52 × 70 cm and the
photo is centre-cropped to fit (never stretched).

| # | Where |
|---|-------|
| 01, 02 | The house you wake up in (Wahabganj lane) — living room, bedroom |
| 03 | Gupta General Store, Wahabganj bazaar — upstairs |
| 04, 05 | Courtyard haveli on the lane from Wahabganj toward the mandir |
| 06 | Narrow two-storey house on the start lane |
| 07, 08, 09 | Three-floor house by the well — ground, first and second floor |
| 10 | House on the east lane near Naugazi |
| 11 | Primary school |
| 12 | Soni Electronics on the main road — upstairs |
| 13 | Narrow house on Salon road, near Naugazi |
| 14 | Locked house on the east lane (kick the door) |
| 15 | House on Station Road |

## Banners (5) — `banners/banner01.jpg` … `banner05.jpg`
Landscape **3:1** (for example 1500 × 500), under 1.5 MB each. They are flex banners outside homes,
centre-cropped to fit.

| # | Where |
|---|-------|
| 01 | Front wall of the house you wake up in |
| 02 | Balcony railing of Gupta General Store |
| 03 | Front wall of the house on the east lane |
| 04 | Strung across Wahabganj bazaar road (both sides printed) |
| 05 | Strung across the Alia Market lane (both sides printed) |

## Radio songs (6) — `music/song01.mp3` … `song06.mp3`
MP3, 128–192 kbps, ideally under 5 MB each. A radio in each of these houses starts playing when you
walk in and fades out when you leave (they loop, and the songs are shuffled between houses every run):
Gupta General Store, the courtyard haveli, the three-floor house, the east-lane house, the narrow house
on Salon road and Baba Dhaba. A missing song plays radio static instead. Players can switch a radio off
(it's loud).

## Mandir loudspeakers — `music/templesong.mp3`
Played through four PA horns: one on a bamboo pole at the turn from Wahabganj road into the lane toward the
mandir, one on the Alia Market arch, one on the temple gate and one tied to the shikhara. All four carry the
same signal, so they are always on the same moment of the song, and each horn's sound reaches you after the
time sound takes to travel from it, so the far horns echo the near one. The song loops on the wall clock: it
never starts from the top, you walk into it wherever it has got to. Heard muffled indoors, silent across town.
Replace the file to change the song (keep the name).

## Gun fire sounds — `sounds/`
Trimmed one-shot clips (`.mp3`, `.wav` or `.ogg`; the loader tries them in that order, so keep one format per name):
`pistol`, `revolver`, `dunali` (one shot each), `rifle` (a single ~0.1 s shot, so it can repeat at 600 rpm),
`machinegun` (a single short shot, about 0.1 s, so it can repeat at 720 rpm),
plus `rifle_reload_out` (magazine out, at reload start) and `rifle_reload_in` (magazine in, mid-reload).
A missing file keeps the built-in generated sound. The katta keeps its generated sound.

## Zombie sounds and the Shivji music
Put them in `music/` (or `sounds/`). Any of `.mp3`, `.m4a`, `.wav`, `.ogg` works (mp3 is safest on iPhone).

| File | When it plays |
|------|---------------|
| `zombiechase` (also `zombie chase`, `zombie_chase`) | Loops while zombies are chasing you close by; louder as they close in, fades out a few seconds after the chase ends. |
| `zombiebye` (also `zombie bye bye`, `zombiebyebye`) | Once, when a zombie kills you (not for falls, the train or thieves). |
| `zombiescream` (also `zombie scream`, `zombie_scream`) | Now and then, from a zombie 45–110 m away: a distant warning, at most about once a minute, never during a chase. |
| `shivjibackground` (also `Shiv Ji background music`, `shivji_music`) | Swells in slowly (about 9 s) when you round the blind corner halfway through the hidden tunnel and Shivji comes into view; dips under a chase, fades out if you go back. |

A missing file keeps the game's built-in sound (or silence for the death sound and the music).

## The hidden Kalidham (Maa Kaali) — `maakaali1` … `maakaali4`, `music/maakaalisong`
A second trapdoor (a red one) lies on the east side of the Maa Kamakhya Mandir courtyard, between the
peepal chabutra and the compound wall. Stairs lead to a torch-lit tunnel; round its blind corner it opens
into a valley far north of Jais (the Shivdham is not touched by any of this).

| File | Where |
|------|-------|
| `maakaali1` | 1st, as you walk out: a colossus on the left of the path |
| `maakaali3` | 2nd: a colossus on the right bank by the ghat (its painted checkerboard background is cut out automatically) |
| `maakaali2` | 3rd: the great colossus on the island behind the lake, in the golden glow |
| `maakaali4` | High in the sky above the valley, see-through at its dark edges, with a faint glow. The valley is empty when you walk out; a few steps on, the figures appear out of thin air (like Shivji): first `maakaali2` in the middle, then `maakaali1` and `maakaali3` left and right, and last `maakaali4` fades in over the sky. |
| `music/maakaalisong` | Swells in once you are round the tunnel's blind corner; footsteps go quiet while it plays (they also go quiet while the Shivji music plays). |

Transparent PNGs work best for the three standing images. The exact names above are tried first
(`maakaali3.JPG` / `maakaali4.JPG` with capital JPG, as uploaded), then the other extensions.
The images load in the background after the town is ready, so they don't slow the loading screen.

## The Joker finale — `models/`, `music/jokerlaugh`, `music/jokermusic`
MAW is no longer the last fight. When he is nearly dead, **the Joker** (the jester) steps out of
purple smoke beside him, shoots him dead, laughs and throws a laughing-gas canister at you. You wake up in
**the Joker's Playground** — an abandoned city street far from Jais — and fight him there. He skips around
the square, shoots three-round bursts (watch for the red laser: that's your cue to take cover), lobs bombs,
slashes if you get close and vanishes in a puff of smoke when hurt. Hit him and he runs off honking; between
attacks he clowns about (a kazoo dance, a pirouette, a "nyah-nyah" taunt, a cartwheel). At 60% health he lets
out his pet, **CatNap**, who hunts you and breathes red smoke. At 30% he goes wild.

At the far end of the square sits his glowing **jack-in-the-box crate**: open it (USE) and the jack pops out, but
there is no gun inside. The **machine gun** (50 damage a shot, fully automatic, one 200-round belt with
no reload and no extra ammo anywhere in the game, so make it last; key 8 or swap) is found only in the hidden **Kalidham**: the second trapdoor in the
Mandir courtyard, beside the Shivdham trapdoor. It falls out of the sky over the valley the first time you step into it.
Killing the Joker sends you back to Jais: take the **last bus** from the bus adda (USE beside it, a
glow marks it) to **the Worm Desert**, where the Giant Warrior and the Giant Worm wait. Kill both to win.

| File | What it is |
|------|------------|
| `models/acidgun.glb` | The old acid gun model. No longer used (the machine gun is built in code). |
| `models/warrior.glb` | The Giant Warrior (“Lowpoly Giant Warrior (rigged)”), with its Walking clip. Its specular texture was cut off in the upload and is left out (the game doesn't use it). |
| `models/worm.glb` | The Giant Worm (“Giant Worm”), 28.6 MB uploaded, 3.7 MB compressed. Its one 102 s clip is used in sections: idle, roar, strikes and lunges. |
| `music/joker1` … `music/joker5` (optional) | The Joker's five silly sounds: 1 clown honk (running off), 2 kazoo (dance), 3 slide whistle (pirouette, cartwheel), 4 spring boing (cartwheel landing, the crate), 5 "nyah-nyah" taunt. Without them the game makes its own. |

| File | What it is |
|------|------------|
| `models/joker.glb` | The Joker (“Fixed Prototype Rigged” by Unschooling with Fin, CC BY 4.0). The broken collar was removed and the right forearm rebuilt by mirroring the left. |
| `models/catnap.glb` | CatNap with its animations (“[NEW] Catnap \| Escape from Playtime” by Unusual Games Official, CC BY 4.0). |
| `models/street.glb` | The arena (“abandoned city street for games” by dasy444), scaled up 4×. |
| `music/jokerlaugh` (optional) | The Joker's laugh. Without it the game uses its own cackle. |
| `music/jokermusic` (optional, loops) | Music for the Playground. Without it a creepy music box plays. |

The models are compressed (about 8 MB together) and only start downloading when MAW wakes up. If they
can't be downloaded at all, killing MAW ends the game the old way.

## Beyond Jais — `models/truck`, `hound`, `forest`, `city`, `metro`
The Amethi road now ends at a **highway sign**. Drive (or walk) past it and you come out on **the forest road**:
a winding dirt road through pines at night, with hound packs and a burnt-out camp at the bend. The far end of
the road reaches **the dead city**: a lamp-lit avenue between tower blocks, full of ghouls, with a **metro
entrance** at the top. The metro is **the old metro**: two station halls joined by a loop of graffiti tunnel.
The south hall climbs back to the city; the north hall comes out at the new metro entrance on the forecourt of
Jais City station. Cars come along on the road; the metro is on foot.

| File | What it is |
|------|------------|
| `models/truck.glb` | The armoured zombie pickup you can drive, parked on the Amethi road facing the highway (“ZOMBIE PICKUP TRUCK” by seangorman, CC BY 4.0). Faster and heavier than the jeep. The upload was cut short; the missing part of one texture was rebuilt from what arrived. The wheels were cut out of the body so they spin and steer. |
| `models/hound.glb` | The hound: a fast zombie dog that hunts in packs and howls to call them (“Zombie Dog” by LostBoyz2078, CC BY 4.0). Packs roam the town edges and the forest. |
| `models/forest.glb` | The forest road (“a forest (3) with a road at night for game” by dasy444, CC BY 4.0), scaled 12×. |
| `models/city.glb` | The dead city (“street city (7) for games FREE” by dasy444), scaled 4×. |
| `models/metro.glb` | The old metro (“old metro tunnel FREE” by dasy444), scaled 2.6×. |
| `models/forest.json`, `city.json`, `metro.json` | Collision and walkable ground baked from the three models (walls, floors, stairs, the forest's hills). Re-bake them if you replace a model. |

Everything here downloads in the background once the town is ready (about 10 MB, smallest first: the pickup,
the hound, then the three places). Until a place has arrived, its road or stairs tell you it is still
loading; if a file can't be downloaded, that way stays closed and the rest of the game is unchanged.

## The zombies and MAW — `models/zombies/*.glb`, `models/maw.glb`
Every zombie in the game (walkers, runners, brutes and the ghouls of the outlands) wears one of four models from
the uploaded **Scary Zombie Packs**; the railyard boss is **MAW** from the **Creature NPC Pack** (he took the place
of the old box-built giant, once called Lohasur, then MUTANT). All five are Mixamo characters with their own clips.
```
models/zombies/prisoner.glb     the prisoner in stripes          (Scary_Zombie_Pack)
models/zombies/girlscout.glb    the girl scout                   (Scary_Zombie_Pack_1)
models/zombies/zombiegirl.glb   the zombie girl                  (Scary_Zombie_Pack_2)
models/zombies/parasite.glb     the parasite (most brutes)       (Scary_Zombie_Pack_3)
models/maw.glb                  MAW, asleep on the tracks        (Creature_NPC_Pack)
```
- **Zombies** use idle, walk, run, attack, scream (the ghouls, when they spot you), death / dying and the two
  crawls: a zombie whose legs are shot to pieces may drop and crawl after you. The stride is matched to how fast
  each one really moves. The nearest few of each kind (7 on a computer, 4 on a phone) get a fully animated body;
  the hordes further off are drawn as a low-poly copy of the same model posed in a few frames of its walk, run or
  crawl, so hundreds cost only a handful of draw calls. Until a model has downloaded (about 3.2 MB for all four),
  its zombies are drawn the old way.
- **MAW** sleeps where he fell (the last frame of his death clip), gets up by playing that fall backwards, flexes
  and roars, then walks, runs, swipes, leaps and slams (the ground-pound lands on the frame he comes down) and
  throws chunks of concrete with his right hand. His fight is the same as before; the Joker still steps in when
  he is nearly dead. His torn loincloth's see-through parts are cut out of the texture (the pack's opacity map was
  not in the FBX).
- The hounds keep their own model.

Converted from the uploaded zips by `scripts/zombies` (FBX2glTF; textures to webp, normal maps dropped, the walk
forward taken out of the moving clips and stored as a speed, a low-poly copy added for the far zombies):
```
cd scripts/zombies && npm install
UPLOADS=/folder/with/the/unzipped/packs node build.mjs all      # one folder per zip, named like the zip
cp out/prisoner.glb out/girlscout.glb out/zombiegirl.glb out/parasite.glb ../../laststand/assets/models/zombies/
cp out/maw.glb ../../laststand/assets/models/
```

## The crew — `models/viking`, `samurai`, `soldier`, `tactical`
Four fighters hide in the houses of Jais. Every run they sit waiting in four different houses (picked at random among
the eight nearest the start house — never one with a thief in it). Walk in, look at one and press **USE** to recruit
him: he follows you and fights. Press **USE** on a follower to make him **hold** that spot (USE again: follow).
If one goes down, get to him and press **USE** to revive him (he also gets up on his own after 45 s). They heal
slowly out of a fight, ride along when you drive, and catch up if you get far ahead (roads, metro, tunnels).
Name tags with health bars float over their heads; the party panel above your health shows all of them.
Zombies go after them too.

| File | Who | Fights with |
|------|-----|-------------|
| `models/viking.glb` | **Ragnar** (“Viking/Medieval Game Character” by CGenesis, CC BY 4.0) | Axe: slow, heavy chops that cleave up to three zombies and knock them back. Most health. |
| `models/samurai.glb` | **Hanzo**, the masked ninja (“Samurai character” by Marfa4, Sketchfab Standard licence) | Katana: fast slashes. The sword was moved into his hand and the scabbard into his belt. |
| `models/soldier.glb` | **Sergeant Mark** (“Soldier Full Tactical Gear” by DanlyVostok, CC BY 4.0) | Assault rifle: three-round bursts, about 30 m. |
| `models/tactical.glb` | **Ghost** (“Game Ready low poly character tactical” by DanlyVostok, CC BY 4.0) | Pump shotgun: devastating close up. The upload was cut short (the boots' normal map was lost and dropped), the gloves had been exported mirrored and were put back on the hands, and the head was lowered onto the neck. |

Ragnar and Hanzo came as statues with no skeleton: each was given a simple humanoid skeleton and skin weights
offline, so all four are posed in code (sitting, walking, running, swinging, aiming, lying wounded).
The four load in the background right after the pickup (about 5.6 MB together); a fighter whose model hasn't
arrived yet simply isn't in his house yet.

## The dead of Jais — `models/body1`, `body2`, `body3`, `bodybags`, `pumpkin`
Bodies lie about the town: about 46 of them on the streets, lanes and waste ground, and the **bus adda** has the most,
23 in uneven heaps around its yard (a pile of bodies and rotten pumpkins here, a loner there). The layout is fixed
(the same every run), and the bodies have no colliders, so you walk over them. They load in the background once the
town is ready.

| File | What it is |
|------|------------|
| `models/body1.glb` | A body under a bloodstained sheet (about 2.2 × 2.8 m). |
| `models/body2.glb` | A body in grey wrapping, blood on the cloth (about 0.9 × 2.3 m). |
| `models/body3.glb` | A body under a dark cover (about 2.4 × 1.5 m). |
| `models/bodybags.glb` | Six Christmas body bags in a row (about 5.6 × 1.9 m). |
| `models/pumpkin.glb` | A rotten pumpkin, scaled to about 0.6 m across. Its source was an unlit export with a black base colour, so it was made an ordinary lit material. |

The uploads were cut short: their headers claim more data than the files hold, so the geometry is whole but the
bottom part of one texture in each file was missing. The missing rows were rebuilt by mirroring the part that arrived
(body1 lost about half of its sheet texture, the others between 4 and 16 percent of theirs). Then they were compressed (meshopt
geometry, WebP textures) and the heavy ones simplified. Re-export from the originals if you have them.

## The map
The full map (M / the map button) now has a **Beyond Jais** strip in the bottom-left corner: the forest road, the
dead city and the old metro, each painted from its walkable ground once it has loaded, with arrows for the way
between them and dashed lines to the highway sign and the Jais City metro entrance. While you are in one of them
it is outlined and shows where you are. The corner minimap now works in those places too, and your crew shows on both.


## Time of day
The town has a day: a run starts at **night**, then comes **morning** (dawn light, mist), **day**
(clear and bright, street lamps off), **evening** (orange low sun, lamps back on), and night again.
One full day is 12 minutes (night 5, morning 2½, day 2, evening 2½; change `DAY` in `js/daytime.js`).
The time shows under the minimap. The hidden valleys, the outlands, the Joker's Playground and the
Worm Desert keep their own night look.

## Cars, ambulances and road grass (`models/*.glb`, loaded by `js/swaps.js`)
```
models/rusty_car.glb     parked cars (most) and some wrecks
models/police_car.glb    burnt police car: crashed cars across the roads, some wrecks and parked cars
models/police_car2.glb   the same wreck upside down (the overturned wreck)
models/ambulance.glb     M725 army ambulance: the tempus
models/dry_grass.glb     seven dry tufts   } scattered along the kerbs, in cracks and in
models/grass06.glb       green blades      } patches on every road
```
These are the uploaded Sketchfab files, converted once: node transforms baked in, rotated to y-up, scaled to metres
(nose toward +z, wheels on y = 0), only the colour texture kept (1024 px JPEG, PNG where there is alpha).
The burning cars are unchanged (`js/vehicles.js`). The uploaded `grass_06` file was cut off in transfer, so its blade
texture was rebuilt from the part that survived; re-upload the file if you want the original texture.

## Trees (`models/trees/*.glb`, placed by `js/trees.js`)
```
models/trees/pine.glb     a pine
models/trees/leafy.glb    a broadleaf with red-pink leaves; every peepal is this tree, drawn bigger
models/trees/dead.glb     a scanned bare, dead tree
models/trees/fallen.glb   a scanned fallen trunk ("drevo"), lying in the belt of trees around the edge of town
```
Every tree in Jais, the hidden valleys and on the shrine islands is one of these. Which one stands at a spot is
fixed by its position (`treeKind` in `js/trees.js`; change the mix there), and each is sized from the spot's old
scale. The box-and-blob trees are only drawn until the models have loaded. Standing trees keep the old trunk
collider; a fallen trunk gets a long, low one.

Converted from the uploads by `scripts/scenery` (`node build.mjs pine` / `leafy` / `dead` / `fallen`): 1 m tall,
centred on the trunk, webp textures, simplified to 2–6k triangles each (the dead tree was a 128k-triangle scan).
Three uploads were cut off in transfer: the pine lost the last rows of a texture, the broadleaf its leaf normal map
(not used) and the fallen trunk the end of its texture; the parts that arrived are used. The snow-covered ground
the trunk was scanned on is cut away.

## The graves and the wrecks of Jais (`models/`, placed by `js/graves.js`)
```
models/tombstone_bonaventure.glb   forty headstones in one straight line along the north side of the railway, by Jais City station
models/tombstone_koszeg.glb        six grey stones on the far side of the track, around MAW
models/eclipso_car.glb             a post-apocalypse car, parked on the lane west of the Mandir road
models/l200_pickup.glb             a red pickup, parked on the waste ground south-west of the main road
models/aircraft_wreck.glb          a small aircraft down in the fields at the south-west edge of town
models/destroyed_building.glb      a bombed-out house on the east side of the bazaar
```
Each model is scaled to metres, stood on the ground and centred on its spot when it loads (the numbers are in
`js/graves.js`: move a spot or a scale there, nothing else). The stones and the wrecks have colliders. The
spots are on the town map only; the outlands are not touched.

Converted once from the uploads: the textures are webp (512 px for the stones, 1024 px for the cars), the
geometry is meshopt-compressed. Three uploads were cut off in transfer and were repaired as far as possible:
- `aircraft_wreck`: the ivy leaves were lost and are left out; the fuselage and the ivy branches are complete, with no textures.
- `tombstone_koszeg`: its stone texture was cut short; the part that arrived is used.
- `tombstone_bonaventure`: one of its four textures was cut short (the part that arrived is used).
- `destroyed_building`: the upload held only the `.fbx` (its textures were not in the archive), so it is a plain grey
  plaster ruin converted from the FBX. Add its textures to get the original look.

## Night mist and lightning (`js/atmosphere.js`)
At night a low mist drifts east over the stones by the station, the graves by MAW and the railway line; it is
thin in the day. Now and then at night, out in the town, lightning flickers the fill light and its thunder
(`thunder` in `js/audio.js`) rolls in a moment later. Nothing to upload: the thunder is generated.

## Walk-in houses (`models/houses/*.glb`, placed by `js/houses.js`)
The plain box houses in the residential rows and in the blocks behind the streets are now nine uploaded house
models, and **every one of them can be walked into**, like the town's other houses: the game hangs its own door in
each doorway (open / close, kick in when it is locked, zombies can break it), the inside counts as indoors (the
light dims, the street goes quiet), and a few houses hold loot or a thief waiting inside. About 57 of them stand
in town (`CAP` in `js/houses.js` sets how many of each). Shops in the bazaar rows stay as they were, and so do the
named houses of the story (the house you wake up in, Gupta store, the three-floor house, and the rest).
```
models/houses/american.glb     two-storey clapboard house, porch and garage      (door up the porch steps)
models/houses/apocalypse.glb   rusty-roofed shack with a lean-to
models/houses/abandoned.glb    collapsing timber house                           (an open doorway, no door left)
models/houses/wooden.glb       plank house on a concrete base
models/houses/farm.glb         square farmhouse on a stone plinth                 (front and side doors)
models/houses/japan.glb        narrow Japanese shop-house
models/houses/old.glb          low timber cottage, entered from its veranda
models/houses/test.glb         small clapboard cabin with a brick chimney
models/houses/horror.glb       big house with a wraparound porch                  (up the porch's side steps)
```
Converted once from the uploads: turned so the front door faces the street, scaled to metres, only the colour
textures kept (webp, 1024 px; 768 px for the wooden house), geometry meshopt-compressed, the heaviest three
simplified. The modelled door panels were cut out (the game's door replaces them); the horror kit's loose spare
pieces and the Japanese shop's round ground patch were left out. Four uploads were cut off in transfer: three lost
only a normal map (not used), and the farmhouse's roof texture lost its last rows, which were refilled from the
shingle pattern above them.

`js/housedata.js` holds what the game needs from each model, baked from the geometry: collision boxes for walls,
floors and steps up to head height, the doorways, open floor spots for loot, and the floor (with a ceiling) the
game adds to the hollow shells. The houses load during the loading screen (about 6 MB).
To change a house (door position, scale, which way it faces), edit `scripts/houses/config.mjs` and re-bake:
```
cd scripts/houses && npm install
UPLOADS=/folder/with/the/original/uploads node build.mjs american && node bake.mjs american   # each house you changed
node gen.mjs                                                                                     # writes housedata.js, copies the models
```
`bake.mjs` also draws `out/walk_<name>.png`: a map of where you can walk (coloured by floor height), so you can see
that the doors and steps work before trying it in the game.

### The Hunter's Rest (`models/houses/hunters.glb`, `hunters_door.glb`)
Three uploads put together into one house: an arched **castle door** (two leaves that swing open together), a
scanned **stone corridor** behind it (about 10 m), and the candle-lit **crypt hall** at its end (the coffin on the
altar, the colonnades, the moon window). The hall is exactly as it came; only its tiled floor was carried on by 7
rows of tiles (about 5 m) toward the corridor, so the room is bigger. The corridor scan was scaled to a walkable
2.2 m wide, 3.7 m high, its slight drift straightened, and its smeared far end left out. The hall came as an open
cut-away (no front wall, no roof, open colonnades), so the game builds dark stone walls and a roof round it, and
warm candle light inside. The whole house is lifted 10 cm (the hall's tiles sit just below its own zero).

There is only one: it stands across lane L1 from the house you wake up in, its door facing the lane (`HUNTERS_LOT`
in `js/world.js`), with a dot and a label on the map. **One of the four crew always waits inside**, on the hall
floor (which one changes each run). Two uploads were cut off in transfer: the corridor lost the bottom quarter of
one texture (refilled by mirroring the rows above), and the door lost its glass map (not used).
```
cd scripts/houses
UPLOADS=/folder/with/the/uploads node hunters.mjs     # puts the three together -> out/hunters_src.glb, out/hunters_door.glb
node build.mjs hunters && node bake.mjs hunters && node gen.mjs
```

## Look-only scenery (`models/scenery/*.glb`, `js/scenery.js`)
Three more uploads are there only to be looked at: none of them can be entered.
```
models/scenery/provence.glb    a photo-scanned stone cottage from Provence, vines over its wall, a garage on one end
models/scenery/seahouse.glb    "the house lost at sea": a tall gothic house with a tower, on its grassy mound
models/scenery/himalaya.glb    Mount Everest and the peaks around it
```
**The two houses** take the place of plain box homes, in the residential rows and in the blocks behind the streets
(about 60 in town: `CAP` in `js/scenery.js`). Shops, the walk-in houses and the named houses stay as they were.
Each is one solid block: you walk round it, bullets stop on it, zombies path round it. The Provence scan is only
the cottage's front wall, so the game builds the rest behind it from the town's own materials (stone walls, a
terracotta tile roof with a ridge cap and a chimney). The sea house stands on its own mound with its dead tree,
and its windows are lit at night. They are drawn like the walk-in houses (one instanced mesh per part, only the
ones in view), and not past 140 m, where the haze hides them anyway.

Only the plain box homes on lots big enough for one of them (they are 12 to 14 m wide) were replaced; the small
gaps between buildings, too narrow for either, keep their plain blocks.

**The Himalaya** stand in a ring on the horizon all round the town: six copies of the Everest tile, each showing a
different face of the range, so the skyline doesn't repeat. They move with the camera, so they stay on the horizon
wherever you go, and are lit by the town's own moon or sun (snow pale blue under the moon, gold in the evening).
From the middle of town they are a faint shape behind the haze; toward the edge of the map they come out clear,
so at the end of the map the whole range stands over the fields. They are hidden in the valleys, the outlands,
the Joker's Playground and the Worm Desert, which keep their own skies.

Converted once from the uploads: scaled to metres, turned to face the street, the colour textures kept (webp),
geometry simplified and meshopt-compressed (about 3.4 MB for the three). Left out: the sea house's sea, sky, mist,
floating debris, dust and the mirrored reflections under the water; the Provence scan's patio, plants and loose
specks. Two uploads were cut off in transfer: the Everest and Provence textures lost their last rows, which were
refilled from the rows next to them. The sea house was made for unlit display, so its very dark wall texture is
lifted for the town's lighting. To change one, edit `scripts/scenery/config.mjs` and rebuild:
```
cd scripts/scenery && npm install
UPLOADS=/folder/with/the/original/uploads node build.mjs all    # or one name: provence, seahouse, himalaya
cp out/*.glb ../../laststand/assets/models/scenery/
```
