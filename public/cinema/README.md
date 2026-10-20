# Lo-fi desk scene (v2) artwork

Assets for the pixel-art "v2" room. Nothing here is used by v1.

| File | What it is |
|---|---|
| `desk.webp` | Desktop composition, 1672x941, 256-colour quantised and saved lossless so pixels stay crisp when scaled. |
| `desk-mobile.webp` | Portrait composition for phones, 810x1510, cropped out of the phone mockup below its status bar. |
| `screen-art.png` | The moon-and-mountains illustration from the painted screen, background keyed out, used by the live menu. |
| `mug.png` | The pixel mug icon with its background keyed out, shown while the art loads. |
| `manifest.json` | Per layout: image size, the painted screen's rect (px and %), the focal point for cropping, and hotspot boxes as percentages. Plus the screen palette sampled from the art. |

The painted screen stays visible while you stand; the live LUNA_OS only
takes over once you sit down, and it is styled to match the painting.

Regenerate everything with `scripts/cinema-assets.py` (see its header).
