# Lo-fi desk scene (v2) artwork

Assets for the pixel-art "v2" room. Nothing here is used by v1.

| File | What it is |
|---|---|
| `desk.webp` | The painting, 1672x941 ("Cozy Retro Developer Workspace"): no window, the name and title on two skateboard decks above the monitor. Phones cover-fit a portrait crop of the same image. The mug, the wall note and the plant are lifted out and the painting filled behind them; the lamp head is painted in place, and the wall, tower edge and desk behind the plant and the wall behind the cup's pens are rebuilt from the original painting by `scripts/cinema-blend.js`. The decks' faces are flattened to plain colour (green, plum) under the painted lettering; the wall right of the monitor, which the painting lit as if a second lamp stood there, is toned down so the desk lamp is the room's one light. 256-colour quantised, saved lossless. |
| `lamp-off.png` | The lamp's head with the bulb out, laid exactly over the painted one when the lamp is switched off. |
| `lamp-shade.png` | Quarter-resolution shadow (multiplied over the room) for the wall and desk the lamp lights; clear over the monitor's glass. |
| `sprite-pen-1…3.png` | The three pens in the cat pencil cup, cut from the painting on one shared canvas; each rocks on its own base. |
| `prop-mug.png`, `prop-plant-pot.png`, `prop-plant-leaves.png`, `prop-sticky-1…7.png` | The pixel props as the scene shows them: redrawn at 2 art px per pixel with the outer outline thinned to the painting's line weight and graded to the room's light. |
| `sprite-lamp-head.png` | Unused since the head went back into the painting; kept for `cinema-assets.py`. |
| `sprite-ant.png` | A small ant drawn by the script; it walks out of the plant pot when the plant is clicked. |
| `screen-art.png` | The moon-and-mountains illustration from the painted screen, background keyed out, used by the live menu. |
| `mug.png` | The pixel mug icon with its background keyed out, shown while the art loads. |
| `manifest.json` | Image size, the painted screen's rect, the focal point, the decks' boxes (the seated crop starts below them), hotspot boxes, each prop's box, file and transform origin (percentages), the coffee-spill geometry, the ant's path, and the screen palette sampled from the art. |

The mug (with its steam), the sticky notes and the plant (pot and leaves as two
layers) are not cut from the painting: they are the pixel drafts from
`scripts/pixel-props.js` (`mug-forest.png`, `mug-steam.png`, `sticky-1…7.png`,
`plant-forest-terracotta-pot.png`, `plant-forest-terracotta-leaves.png` in
`public/props/`), refined into the `prop-*` files above. The notes are blank;
the scene lays each one's message over it in the terminal face.

Standing, you see the whole painting. Clicking the monitor sits you down: two
steps up to the desk (the view bobs and rolls with each), the monitor low in
view as you stand over it, then down into the chair as it rises to eye level,
with a little give from the cushion; the live LUNA_OS takes over the glass.
Standing up runs the same path back. Standing, the desk is alive
(`components/cinema/physics.ts` springs): knock the mug and it rocks onto its
heel, sloshes a little coffee over the rim that pools and soaks away
(`components/cinema/spill.ts`, drawn on the painting's pixel grid) and ends up
shoved a few pixels along; peel the sticky note and it lets go from the bottom,
glides down side to side like paper, lands flat behind the mug and fades, with
the next note already on the wall; tap the pencil cup and the pens rattle;
click the lamp to switch it off (the filament catches before it dies, the
room it lit falls into shadow) and on again; nudge the plant and its leaves
sway while an ant walks out. Seated, any click outside the screen stands you
back up.

Regenerate in two steps: `scripts/cinema-assets.py` cuts the props out of the
source painting and fills behind them (see its header), then
`scripts/cinema-props.py` runs on its output: it flattens the decks, relights
the right wall, swaps the cut-out mug, note and plant for the pixel drafts
(deleting those sprites) and rewrites the manifest. `node scripts/pixel-props.js public/props`
draws the drafts themselves. Last, `node scripts/cinema-blend.js` repairs the painting round the props
(from `scripts/art/desk-base.webp`, the output of the two steps above, and
`scripts/art/desk-original.webp`, the untouched painting), cuts the pens, writes
the lamp and `prop-*` files, and adds its entries to the manifest.
