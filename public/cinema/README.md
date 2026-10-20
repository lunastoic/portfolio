# Lo-fi desk scene (v2) artwork

Assets for the pixel-art "v2" room. Nothing here is used by v1.

| File | What it is |
|---|---|
| `desk.webp` | The painting, 1672x941 ("Cozy Retro Developer Workspace"): no window, the name and title on two skateboard decks above the monitor. Phones cover-fit a portrait crop of the same image. The mug and the wall note are lifted out and the painting filled behind them. 256-colour quantised, saved lossless. |
| `sprite-mug.png`, `sprite-note1.png` | The mug (with its steam) and the KEEP BUILDING note as transparent sprites, placed back by the manifest and animated on click. |
| `sprite-ant.png` | A small ant drawn by the script; it walks out of the plant pot when the plant is clicked. |
| `screen-art.png` | The moon-and-mountains illustration from the painted screen, background keyed out, used by the live menu. |
| `mug.png` | The pixel mug icon with its background keyed out, shown while the art loads. |
| `manifest.json` | Image size, the painted screen's rect, the focal point, the decks' boxes (the seated crop starts below them), hotspot boxes (monitor, lamp, plant, headphones, camera, tower, sign, books, notebook), sprite boxes and files, and the ant's path, all as percentages. Plus the screen palette sampled from the art. |

Standing, you see the whole painting; clicking the monitor zooms in until the
screen stands 60% of the window tall and the live LUNA_OS takes over the glass.
Standing, the mug, note, lamp and plant are easter eggs. Seated, any click
outside the screen stands you back up.

Regenerate everything with `scripts/cinema-assets.py` (see its header).
