# Lo-fi desk scene (v2) artwork

**The room is the Ember study from the Desk Room Studies.** `node scripts/pixel-room.js` runs the studies'
renderer (`scripts/desk-room.js`): the room laid out on its 461 x 227 u grid, drawn on a 640 x 316 pixel grid with
the lamps' light picked from material ramps through a 4 x 4 dither, and some things modelled in 3D and shaded as
pixel art (the headset, the lamp's foot, the iPad, the mouse, the controller). Each pixel becomes 3 x 3 art px, so the
room is 1920 x 948. The things that move are left out of the backdrop and cut out on their own (the pixels where the
room with the thing differs from the room without it): `cut-mug.png` (with its steam), `cut-note-1…7.png` (the
sticky note in seven colours) and `cut-pen-1…3.png` (each pen in the cat cup). The lava lamp
(`components/cinema/LavaLamp.tsx`) and the headset's cable (`HeadsetCable.tsx`) are drawn live on the page, so
`room.json` only says where they go. The backdrops: `room.png` and `desk-off.png` (desk lamp on / off) and
`room-lava-off.png` and `desk-off-lava-off.png` (the lava lamp's light gone as well), and the `side-*` strips for very
wide windows (the same drawing carried on past each edge). `room.json` holds every place the scene uses: the
screen's glass, the decks, the mug and its coffee spill, the note and where it lands, the pens' pivots, the lamp's
hit box, the lava lamp's box and the cable's path. `scripts/mockup-room.js` and everything below about the painting
(`desk.webp`, `cinema-blend.js`) describe earlier rooms, kept but unused.

Assets for the pixel-art "v2" room. Nothing here is used by v1.

| File | What it is |
|---|---|
| `room.webp`, `room.json` | What the scene actually shows: `desk.webp` with the wall behind the desk made plain (the painting's two-step ledge along it, the box the pencil cup stood on and the old mug's steam go; the desk stands against a flat wall and the cat cup is set down onto it) and widened to 1932 px by two 130 px strips of plain wall and desk cut in between the lamp, the notes and the mug and the monitor on the left and between the poster, the mousepad and the bookcase on the right (`scripts/cinema-room.js`), so a full-screen browser is covered by the painting itself with the shelf and the bookcase at its edges. `room.json` is `manifest.json` with every box moved into that frame, plus the lamp-off and side images and the cuts (the scene maps its own painting-px, the wall text, through them). |
| `desk.webp` | The painting, 1672x941 ("Cozy Retro Developer Workspace"): no window, the name and title on two skateboard decks above the monitor. Phones cover-fit a portrait crop of the same image. The mug, the wall note and the plant are lifted out and the painting filled behind them; the lamp head is painted in place, and the wall, tower edge and desk behind the plant and the wall behind the cup's pens are rebuilt from the original painting by `scripts/cinema-blend.js`. The same script clears the painting's own lettering (the decks, the poster, the book spines, the shelf's spines); the scene sets real type there instead (`WALL_TEXT` in `CinemaScene.tsx`, in Oxanium), and the live screen shows standing too, so none of the painted words show. The decks' faces are flattened to plain colour (green, plum) under the painted lettering; the wall right of the monitor, which the painting lit as if a second lamp stood there, is toned down so the desk lamp is the room's one light. 256-colour quantised, saved lossless. |
| `desk-off.webp` | The whole painting again with the desk lamp switched off, laid over the lit one when the lamp is clicked: the lamp's light is measured off the bare wall and desk against the room's ambient and divided out (so the cone on the wall and the beam on the desk go), the room drops a little darker and cooler, the monitor's green reaches the desk in front of it, and the bulb sits dark in its shade (`scripts/cinema-room.js`). |
| `side-left.png`, `side-right.png`, `side-*-off.png` | The room past the painting's edges, 900 art px each side, for windows wider than the painting: the wall, the desk and its front carried on with the painting's own grain, each row running from the painting's edge colour toward the room's ambient, and the things the edge cuts (the shelf, the pegboard, the book stack, the bookcase, the tower, the book on the desk) carried on a little way and ended. The `-off` pair is the same from the unlit painting. |
| `sprite-pen-1…3.png` | The three pens in the cat pencil cup, cut from the painting on one shared canvas; each rocks on its own base. |
| `prop-mug.png`, `prop-plant-pot.png`, `prop-plant-leaves.png`, `prop-sticky-1…7.png` | The pixel props as the scene shows them: redrawn at 2 art px per pixel with the outer outline thinned to the painting's line weight and graded to the room's light. |
| `sprite-lamp-head.png` | Unused since the head went back into the painting; kept for `cinema-assets.py`. |
| `sprite-ant.png` | A small ant drawn by the script; it walks out of the plant pot when the plant is clicked. |
| `screen-art.png` | The moon-and-mountains illustration from the painted screen, background keyed out, used by the live menu. |
| `mug.png` | The pixel mug icon with its background keyed out, shown while the art loads. |
| `manifest.json` | In the painting's own frame (the scripts up to `cinema-blend.js` read and write it; the scene reads `room.json`): image size, the painted screen's rect, the focal point, the decks' boxes (the seated crop starts below them), hotspot boxes, each prop's box, file and transform origin (percentages), the coffee-spill geometry, the ant's path, the lamp-off painting and the side images, and the screen palette sampled from the art. |

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
click the lamp to switch it off (the filament catches before it dies, and the
room goes dark with it: the unlit painting fades in over the lit one, the props
in its light dim) and on again; nudge the plant and its leaves
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
the `prop-*` files, adds its entries to the manifest, and ends by running
`scripts/cinema-room.js` (also runnable on its own against `desk.webp` and
`manifest.json`), which writes `room.webp`, `room.json`, `desk-off.webp` and the
`side-*.png` files.
