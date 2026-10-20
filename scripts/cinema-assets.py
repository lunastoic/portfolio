"""
Builds the derived artwork for the v2 cinematic desk scene from one source
image: a screen-blanked backdrop (the live UI is overlaid on the CRT), a
lamp-off variant, a grain tile, and manifest.json with the screen quad and
hotspot boxes as percentages of the image.

The screen corners and hotspot boxes below are set by eye for the current
1436x804 placeholder. When final art arrives, re-measure them (the overlay
grid in the scratch version of this script helps) and re-run:

    python3 -m venv .venv && .venv/bin/pip install pillow numpy
    .venv/bin/python scripts/cinema-assets.py public/cinema/room-source.webp
"""
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import sys
SRC = sys.argv[1] if len(sys.argv) > 1 else "public/cinema/room-source.webp"
OUT = sys.argv[2] if len(sys.argv) > 2 else "public/cinema"
img = Image.open(SRC).convert("RGB")
W, H = img.size
a = np.asarray(img).astype(np.int32)
R, G, B = a[..., 0], a[..., 1], a[..., 2]

# ---- screen quad (phosphor-green, dense, below the wall map) ----
green = (G > 110) & (G > R * 1.5) & (G > B * 1.4)
dense = np.asarray(Image.fromarray((green * 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(9))) > 150
dense[:285, :] = False; dense[:, :850] = False
ys, xs = np.nonzero(dense); pts = np.stack([xs, ys], 1)
tl = pts[np.argmin(xs + ys)]; tr = pts[np.argmax(xs - ys)]
br = pts[np.argmax(xs + ys)]; bl = pts[np.argmin(xs - ys)]
quad = [[1018, 292], [1262, 298], [1256, 568], [1008, 558]]  # set by eye; the detector misses the dim edges
print("screen quad TL,TR,BR,BL:", quad)
cx = sum(p[0] for p in quad) / 4; cy = sum(p[1] for p in quad) / 4

def expand(q, px):
    return [[int(round(x + (px if x > cx else -px))), int(round(y + (px if y > cy else -px)))] for x, y in q]

# ---- 1. screen-blanked backdrop (live UI goes on top) ----
mask = Image.new("L", (W, H), 0)
ImageDraw.Draw(mask).polygon([tuple(p) for p in expand(quad, 8)], fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(3))
dark = Image.new("RGB", (W, H), (1, 19, 10))          # matches --bg-screen
blank = Image.composite(dark, img, mask)
blank.save(f"{OUT}/room-screen-blank.webp", quality=88, method=6)


# ---- 2. lamp-off variant: everything dark except the screen glow and the map ----
dim = Image.fromarray(np.clip(a * 0.26, 0, 255).astype(np.uint8))
glow = Image.new("L", (W, H), 0)
rx, ry = 250, 220                                      # soft ellipse of screen light
ImageDraw.Draw(glow).ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
glow = glow.filter(ImageFilter.GaussianBlur(80))
glow = Image.fromarray((np.asarray(glow) * 0.7).astype(np.uint8))
mapm = Image.new("L", (W, H), 0)
ImageDraw.Draw(mapm).rectangle([900, 0, 1380, 275], fill=170)
mapm = mapm.filter(ImageFilter.GaussianBlur(30))
keep = Image.fromarray(np.maximum(np.asarray(glow), np.asarray(mapm)))
lampoff = Image.composite(img, dim, keep)
lampoff.save(f"{OUT}/room-lamp-off.webp", quality=88, method=6)

# and the same with the screen blanked, for the live-UI build
Image.composite(dark, lampoff, mask).save(f"{OUT}/room-lamp-off-screen-blank.webp", quality=88, method=6)

# ---- 3. tileable grain ----
rng = np.random.default_rng(7)
n = rng.normal(128, 38, (256, 256)).clip(0, 255).astype(np.uint8)
Image.fromarray(n, "L").save(f"{OUT}/grain.png", optimize=True)

# ---- 4. manifest (percent of image size, so it scales with object-fit) ----
pct = lambda x, y: [round(100 * x / W, 2), round(100 * y / H, 2)]
rect = lambda x0, y0, x1, y1: {"left": round(100 * x0 / W, 2), "top": round(100 * y0 / H, 2),
                               "width": round(100 * (x1 - x0) / W, 2), "height": round(100 * (y1 - y0) / H, 2)}
hot_px = {
  "monitor":  [985, 235, 1405, 745],
  "lamp":     [735, 255, 885, 610],
  "mug":      [1210, 665, 1350, 765],
  "keyboard": [725, 655, 1125, 795],
  "boards":   [495, 560, 1055, 705],
  "shelf":    [100, 0, 470, 720],
  "map":      [913, 0, 1371, 269],
}
manifest = {
  "source": "room-source.webp",
  "size": {"width": W, "height": H},
  "focalPoint": pct(cx, cy),
  "screen": {
    "quadPx": {"tl": quad[0], "tr": quad[1], "br": quad[2], "bl": quad[3]},
    "quadPct": {"tl": pct(*quad[0]), "tr": pct(*quad[1]), "br": pct(*quad[2]), "bl": pct(*quad[3])},
    "bboxPct": rect(min(p[0] for p in quad), min(p[1] for p in quad), max(p[0] for p in quad), max(p[1] for p in quad)),
  },
  "hotspotsPct": {k: rect(*v) for k, v in hot_px.items()},
  "images": {
    "room": "room-source.webp",
    "roomScreenBlank": "room-screen-blank.webp",
    "roomLampOff": "room-lamp-off.webp",
    "roomLampOffScreenBlank": "room-lamp-off-screen-blank.webp",
    "grain": "grain.png",
  },
}
json.dump(manifest, open(f"{OUT}/manifest.json", "w"), indent=2)
print(json.dumps(manifest["screen"], indent=1))

