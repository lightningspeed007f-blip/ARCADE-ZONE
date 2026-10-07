# Cinematic intro

Files: `intro.js` (logic, drawing, Web Audio sounds) and `intro.css` (layers, title, skip/replay buttons).
`index.html` loads both and connects them with a small `ArcadeIntro.init({...})` block at the end of its script.

The intro moves the hub's **real** five `.card` elements and hands them back to the cylinder when they land.
It never creates copies of the cards.

## Intro video
`intro/intro.mp4` (H.264 MP4, portrait) plays full screen first, with sound (muted if the hub sound is off).
As it ends, the real cards burst out of the joker's throw and land in their places. The drawn character is not shown.
- The file is compressed for the web (720x1280, 30 fps, about 2.5 MB, "faststart" so it starts while downloading).
  To replace it, re-encode the new video the same way:
  `ffmpeg -i new.mp4 -vf "scale=720:1280,fps=30" -c:v libx264 -crf 22 -preset slow -c:a aac -b:a 128k -movflags +faststart intro/intro.mp4`
- On a first visit the video starts downloading as soon as the page opens.
- On wide screens the whole portrait video is shown, with dark bars at the sides.
- "Skip intro" skips everything.
- If the file is missing or doesn't start within 6 seconds, the full drawn intro plays instead.

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
