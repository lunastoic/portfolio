# Lo-fi desk scene (v2) artwork

Assets for the pixel-art "v2" room. Nothing here is used by v1.

| File | What it is |
|---|---|
| `desk.webp` | Desktop composition, 1672x941. The window is painted out as wall with two skateboard decks hung beside the monitor; the mug and the three wall notes are lifted out and the painting filled behind them. 256-colour quantised, saved lossless. |
| `desk-mobile.webp` | Portrait composition for phones, 745x1510, cropped out of the phone mockup, same treatment. |
| `sprite-mug.png`, `sprite-note1..3.png` | The mug (with its steam) and the wall notes as transparent sprites, placed back by the manifest and animated on click. `m-` prefixed copies are the phone layout's. |
| `sprite-ant.png` | A small ant drawn by the script; it walks out of the plant pot when the plant is clicked. |
| `screen-art.png` | The moon-and-mountains illustration from the painted screen, background keyed out, used by the live menu. |
| `mug.png` | The pixel mug icon with its background keyed out, shown while the art loads. |
| `manifest.json` | Per layout: image size, the painted screen's rect, the focal point, hotspot boxes (lamp, plant, …), sprite boxes and files, deck boxes and the ant's path, all as percentages. Plus the screen palette sampled from the art. |

Standing, you see the whole painting from across the room; sitting down fills the window with it and the live LUNA_OS takes over the glass. The decks and the wall behind the old window are drawn by the script, not painted, so regenerated art from the same prompt (no window, two decks on the wall) would look better than this fill.

Regenerate everything with `scripts/cinema-assets.py` (see its header).
