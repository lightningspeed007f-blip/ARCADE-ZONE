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
  sounds/pistol.mp3  revolver.mp3  dunali.mp3  rifle.mp3   ← gun fire sounds
  music/zombiechase.mp3  zombiebye.mp3  zombiescream.mp3     ← zombie sounds
  music/shivjibackground.mp3                                 ← the Shivdham reveal music
  maakaali1.png  maakaali3.JPG  maakaali2.png  maakaali4.JPG  ← the hidden Kalidham (see below)
  music/maakaalisong.mp3                                     ← the Kalidham music
  music/spider.mp3                                           ← the giant spider in the sky (optional)
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

## Gun fire sounds — `sounds/`
Trimmed one-shot clips (`.mp3`, `.wav` or `.ogg`; the loader tries them in that order, so keep one format per name):
`pistol`, `revolver`, `dunali` (one shot each), `rifle` (a single ~0.1 s shot, so it can repeat at 600 rpm),
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
Mutant is no longer the last fight. When he is nearly dead, **the Joker** (the jester) steps out of
purple smoke beside him, shoots him dead, laughs and throws a laughing-gas canister at you. You wake up in
**the Joker's Playground** — an abandoned city street far from Jais — and fight him there. He skips around
the square, shoots three-round bursts (watch for the red laser: that's your cue to take cover), lobs bombs,
slashes if you get close and vanishes in a puff of smoke when hurt. Hit him and he runs off honking; between
attacks he clowns about (a kazoo dance, a pirouette, a "nyah-nyah" taunt, a cartwheel). At 60% health he lets
out his pet, **CatNap**, who hunts you and breathes red smoke. At 30% he goes wild.

At the far end of the square sits his glowing **jack-in-the-box crate**: open it (USE) for the **acid gun**
(150 damage a shot, the most of any gun, and the acid splashes whatever stands next to the target; key 8 or
swap). Killing the Joker sends you back to Jais: take the **last bus** from the bus adda (USE beside it, a
glow marks it) to **the Worm Desert**, where the Giant Warrior and the Giant Worm wait. Kill both to win.

| File | What it is |
|------|------------|
| `models/acidgun.glb` | The acid gun (“Acid Gun (Omnidroid v20.22)”), compressed to 0.3 MB. |
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

The models are compressed (about 8 MB together) and only start downloading when Mutant wakes up. If they
can't be downloaded at all, killing Mutant ends the game the old way.

## Beyond Jais — `models/truck`, `ghoul`, `hound`, `forest`, `city`, `metro`
The Amethi road now ends at a **highway sign**. Drive (or walk) past it and you come out on **the forest road**:
a winding dirt road through pines at night, with hound packs and a burnt-out camp at the bend. The far end of
the road reaches **the dead city**: a lamp-lit avenue between tower blocks, full of ghouls, with a **metro
entrance** at the top. The metro is **the old metro**: two station halls joined by a loop of graffiti tunnel.
The south hall climbs back to the city; the north hall comes out at the new metro entrance on the forecourt of
Jais City station. Cars come along on the road; the metro is on foot.

| File | What it is |
|------|------------|
| `models/truck.glb` | The armoured zombie pickup you can drive, parked on the Amethi road facing the highway (“ZOMBIE PICKUP TRUCK” by seangorman, CC BY 4.0). Faster and heavier than the jeep. The upload was cut short; the missing part of one texture was rebuilt from what arrived. The wheels were cut out of the body so they spin and steer. |
| `models/ghoul.glb` | The ghoul: a tough rotting zombie that roars when it sees you (“Zombie” by David Glynch). Reduced from 109k to 16k triangles. In town, the forest, the city and the metro. |
| `models/hound.glb` | The hound: a fast zombie dog that hunts in packs and howls to call them (“Zombie Dog” by LostBoyz2078, CC BY 4.0). Packs roam the town edges and the forest. |
| `models/forest.glb` | The forest road (“a forest (3) with a road at night for game” by dasy444, CC BY 4.0), scaled 12×. |
| `models/city.glb` | The dead city (“street city (7) for games FREE” by dasy444), scaled 4×. |
| `models/metro.glb` | The old metro (“old metro tunnel FREE” by dasy444), scaled 2.6×. |
| `models/forest.json`, `city.json`, `metro.json` | Collision and walkable ground baked from the three models (walls, floors, stairs, the forest's hills). Re-bake them if you replace a model. |

Everything here downloads in the background once the town is ready (about 10 MB, smallest first: the pickup,
the hound, the ghoul, then the three places). Until a place has arrived, its road or stairs tell you it is still
loading; if a file can't be downloaded, that way stays closed and the rest of the game is unchanged.

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

