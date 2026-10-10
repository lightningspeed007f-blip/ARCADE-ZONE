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
| `maakaali4` | High in the sky above the valley, see-through at its dark edges, with a faint glow. It fades in a few steps after you leave the tunnel. |
| `music/maakaalisong` | Swells in once you are round the tunnel's blind corner; footsteps go quiet while it plays (they also go quiet while the Shivji music plays). |

Transparent PNGs work best for the three standing images. The exact names above are tried first
(`maakaali3.JPG` / `maakaali4.JPG` with capital JPG, as uploaded), then the other extensions.
The images load in the background after the town is ready, so they don't slow the loading screen.
