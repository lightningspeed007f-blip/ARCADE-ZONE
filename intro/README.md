# Cinematic intro

Files:
- `intro.js` handles the timeline, scenery, Web Audio sounds and the real cards. It also has the drawn 2D character used as the fallback.
- `intro.css` holds the layers, title and the skip/replay buttons.
- `zombie3d.js` is the 3D zombie: three.js and `src/zombie3d.src.js` bundled into one file of about 580 KB (about 150 KB gzipped).
- `models/zombie.glb` is the rigged model with its walk animation, optimized to 187 KB. It is built from `models/source/zombiewalk.fbx`.

`index.html` loads `intro.js` and `intro.css` and connects them with a small `ArcadeIntro.init({...})` block at the end of its script.
`zombie3d.js` is not in `index.html`. `intro.js` loads it when needed:
- first visit: in the background right away, so it's ready by the time the visitor taps to enter;
- returning visitors: only when they press the replay button.
The dark opening of the intro waits up to 3 s for the download (`CONFIG.MODEL_3D_WAIT`).
If WebGL is missing, Save-Data is on, or the download fails or is too slow, the drawn character plays instead.

The intro moves the hub's **real** five `.card` elements and hands them back to the cylinder when they land.
It never creates copies of the cards.

## How the 3D zombie works
- The model's only animation is the Mixamo zombie walk. It is used for the entrance. The walk's own forward motion moves the zombie, so the feet don't slide.
- The raise/snap, card presentation, wind-up and throw are posed in code. The arm bones are aimed on top of the walk pose (`pose()` in `src/zombie3d.src.js`), so no extra animation files are needed.
- Skin blotches are baked into vertex colours when the model loads, so no textures are downloaded. The neon rim light comes from a small shader addition.
- The glowing eyes, sparks, flash and vignette are drawn on a 2D canvas above the WebGL layer.
- Low-end devices: the low tier uses a cheaper material, no antialiasing and 1x resolution. If frames are still slow, the zombie drops to 0.7x resolution.

## Rebuilding
After editing `src/zombie3d.src.js` (needs `npm i three@0.160.0 esbuild` somewhere on `NODE_PATH`):

    npx esbuild intro/src/zombie3d.src.js --bundle --minify --format=iife --target=es2017 --outfile=intro/zombie3d.js

To replace the model (any Mixamo character FBX with a walk animation, "with skin"):

    npx fbx2gltf --binary -i intro/models/source/zombiewalk.fbx -o /tmp/zombie
    npx @gltf-transform/cli optimize /tmp/zombie.glb intro/models/zombie.glb --compress meshopt --simplify-ratio 0.55 --simplify-error 0.002 --join false --flatten false --instance false

## Testing
- `index.html?intro=reset` forgets that the intro was watched and shows the splash again.
- Console: `ArcadeIntro.reset()`, `ArcadeIntro.play()`, `ArcadeIntro.skip()`, `ArcadeIntro.is3d()`.
- `index.html?introperf=low|mid|high` forces a performance level.
- `index.html?intro3d=0|1` forces the drawn character or the 3D zombie.
- The localStorage key is `gz_intro_seen_v1`.

## Drawn character artwork (fallback only)
The fallback character is drawn in code. To use artwork instead:
1. Add a transparent PNG/WebP (feet at the bottom centre, ideally under ~300 KB), e.g. `intro/assets/character.webp`.
2. In `intro.js`, set `CONFIG.CHARACTER_IMAGE = "intro/assets/character.webp"`.
3. Set `CONFIG.CHARACTER_HAND` to where the snapping hand is in the image (0..1 of width/height).
