# Cinematic desk scene (v2) artwork

Assets for the photoreal "v2" room. Nothing here is used by v1.

| File | What it is |
|---|---|
| `room-source.webp` | The reference render, 1436x804. Placeholder: for production we need a version at 2500px or wider that we hold the rights to, ideally regenerated from the same prompt. |
| `room-screen-blank.webp` | Same image with the CRT glass filled dark so the live LUNA OS UI can be laid over it without baked-in text showing at the edges. |
| `room-lamp-off.webp` | Approximate lamp-off state: whole room dimmed, screen glow and wall map kept. A real lamp-off render should replace this. |
| `room-lamp-off-screen-blank.webp` | Lamp-off with the glass blanked, for the live-UI build. |
| `grain.png` | 256x256 tileable film grain, meant to be overlaid at low opacity. |
| `manifest.json` | Screen quad corners (px and % of image), focal point for cropping, and hotspot boxes for monitor, lamp, mug, keyboard, boards, shelf, and map, all as percentages so they track the image under `object-fit: cover`. |

Still needed for later phases: separate wall / monitor / foreground layers
with transparency (for parallax and cables crossing in front of the screen),
and a phone-shaped crop or alternate composition.

Regenerate everything with `scripts/cinema-assets.py` (see its header).
