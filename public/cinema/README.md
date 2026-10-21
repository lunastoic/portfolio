# Lo-fi desk scene (v2) artwork

Assets for the pixel-art "v2" room. Nothing here is used by v1.

| File | What it is |
|---|---|
| `desk.webp` | The painting, 1672x941 ("Cozy Retro Developer Workspace"): no window, the name and title on two skateboard decks above the monitor. Phones cover-fit a portrait crop of the same image. The mug, the wall note, the plant and the lamp head are lifted out and the painting filled behind them. The decks' faces are flattened to plain colour (green, plum) under the painted lettering; the wall right of the monitor, which the painting lit as if a second lamp stood there, is toned down so the desk lamp is the room's one light. 256-colour quantised, saved lossless. |
| `sprite-lamp-head.png` | The lamp's head cut out of the painting (the arm stays painted; the head swings on its hinge). |
| `sprite-ant.png` | A small ant drawn by the script; it walks out of the plant pot when the plant is clicked. |
| `screen-art.png` | The moon-and-mountains illustration from the painted screen, background keyed out, used by the live menu. |
| `mug.png` | The pixel mug icon with its background keyed out, shown while the art loads. |
| `manifest.json` | Image size, the painted screen's rect, the focal point, the decks' boxes (the seated crop starts below them), hotspot boxes, each prop's box, file and transform origin (percentages), the coffee-spill geometry, the ant's path, and the screen palette sampled from the art. |

The mug (with its steam), the sticky note and the plant (pot and leaves as two
layers) are not cut from the painting any more: they are the pixel drafts from
`scripts/pixel-props.js` in `public/props/` (`mug-forest.png`, `mug-steam.png`,
`note-1.png`, `plant-forest-terracotta-pot.png`, `plant-forest-terracotta-leaves.png`),
drawn at 4 art px per sprite px (the note at 3) where the painted ones stood.
The note is blank; the scene lays its message over it in the terminal face.

Standing, you see the whole painting; clicking the monitor zooms in until the
screen stands 60% of the window tall and the live LUNA_OS takes over the glass.
Standing, the props sit on springs (`components/cinema/physics.ts`): tap the
mug and it tips, pours a stream of coffee that splashes and pools on the desk
then soaks away (`components/cinema/spill.ts`, a small particle sim drawn on
the painting's pixel grid), the note swings on its pin, the lamp head bobs on
its hinge while the bulb flickers, the plant gets nudged and its leaves sway
with a lag while an ant walks out. Seated, any click outside the screen stands
you back up.

Regenerate in two steps: `scripts/cinema-assets.py` cuts the props out of the
source painting and fills behind them (see its header), then
`scripts/cinema-props.py` runs on its output: it flattens the decks, relights
the right wall, swaps the cut-out mug, note and plant for the pixel drafts
(deleting those sprites) and rewrites the manifest. `node scripts/pixel-props.js public/props`
draws the drafts themselves.
