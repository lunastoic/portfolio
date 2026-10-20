# Lo-fi desk scene (v2) artwork

Assets for the pixel-art "v2" room. Nothing here is used by v1.

| File | What it is |
|---|---|
| `desk.webp` | The painting, 1672x941 ("Cozy Retro Developer Workspace"): no window, the name and title on two skateboard decks above the monitor. Phones cover-fit a portrait crop of the same image. The mug and the wall note are lifted out and the painting filled behind them. 256-colour quantised, saved lossless. |
| `sprite-mug.png`, `sprite-note1.png`, `sprite-lamp.png`, `sprite-plant-pot.png`, `sprite-plant-leaves.png` | The props as transparent sprites cut out of the painting (the plant in two layers so the leaves rustle over a nudged pot), placed back by the manifest and animated on click. The painting is filled in behind each so it can move. |
| `sprite-drop.png`, `sprite-puddle.png` | Pixel coffee for the mug's spill, drawn by the script in the painting's coffee colours. |
| `sprite-ant.png` | A small ant drawn by the script; it walks out of the plant pot when the plant is clicked. |
| `screen-art.png` | The moon-and-mountains illustration from the painted screen, background keyed out, used by the live menu. |
| `mug.png` | The pixel mug icon with its background keyed out, shown while the art loads. |
| `manifest.json` | Image size, the painted screen's rect, the focal point, the decks' boxes (the seated crop starts below them), hotspot boxes (monitor, lamp, plant, headphones, camera, tower, sign, books, notebook), sprite boxes and files, and the ant's path, all as percentages. Plus the screen palette sampled from the art. |

Standing, you see the whole painting; clicking the monitor zooms in until the
screen stands 60% of the window tall and the live LUNA_OS takes over the glass.
Standing, the props are easter eggs: tap the mug and it tips and slops coffee
on the desk, the note swings on its pin, the lamp head bobs and the bulb
flickers, the plant gets nudged and its leaves rustle while an ant walks out.
Seated, any click outside the screen stands you back up.

Regenerate everything with `scripts/cinema-assets.py` (see its header).
