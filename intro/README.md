# Cinematic intro

Files: `intro.js` (logic, drawing, Web Audio sounds) and `intro.css` (layers, title, skip/replay buttons).
`index.html` loads both and connects them with a small `ArcadeIntro.init({...})` block at the end of its script.

The intro moves the hub's **real** five `.card` elements and hands them back to the cylinder when they land.
It never creates copies of the cards.

## Intro video
Upload your video as **`intro/intro.mp4`** (H.264 MP4, ideally under ~8 MB, any length).
- It plays full screen with sound (muted if the hub sound is off). Then the trickster snaps and throws the cards into place.
- "Skip intro" skips the whole intro.
- If the file is missing or doesn't start within 4 seconds, the normal drawn intro plays instead.
- To use a different name, change `CONFIG.VIDEO` in `intro.js`.

## Testing
- `index.html?intro=reset` forgets that the intro was watched and shows the splash again.
- Console: `ArcadeIntro.reset()`, `ArcadeIntro.play()`, `ArcadeIntro.skip()`.
- `index.html?introperf=low|mid|high` forces a performance level.
- The localStorage key is `gz_intro_seen_v1`.

## Adding real character artwork
The character is drawn in code for now. To use artwork instead:
1. Add a transparent PNG/WebP (feet at the bottom centre, ideally under ~300 KB), e.g. `intro/assets/character.webp`.
2. In `intro.js`, set `CONFIG.CHARACTER_IMAGE = "intro/assets/character.webp"`.
3. Set `CONFIG.CHARACTER_HAND` to where the snapping hand is in the image (0..1 of width/height).
   The cards are summoned from that point.

A single still image can only walk, lean and fade. The arm-raise, snap and flick motion comes from the drawn character.
