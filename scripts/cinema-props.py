"""
Second pass over the v2 painting, run after cinema-assets.py on its output
(the source painting is not in the repo):

  * the painted mug, wall note and plant give way to the pixel drafts from
    scripts/pixel-props.js (public/props): the mug and plant at 4 art px per
    sprite px, the note at 3, placed where the painted ones stood. Their boxes,
    transform origins and the coffee-spill geometry go into manifest.json and
    the superseded cut-out sprites are deleted;
  * the two skateboard decks' faces become plain colour: the rim, the trucks
    and the painted lettering stay, the scenes go;
  * the room's light makes sense: the warm glow on the wall right of the
    monitor (no lamp there) is toned down to the wall's ambient level, so the
    desk lamp on the left reads as the room's one light;
  * the wall behind the old mug is refilled with a proper left-to-right blend
    (the first pass filled it from the darker wall by the monitor, which the
    smaller mug no longer hides).

    python3 -m venv .venv && .venv/bin/pip install pillow numpy
    .venv/bin/python scripts/cinema-props.py [review.png]

Coordinates are art pixels of the 1672x941 painting, set by eye.
"""
import json, os, sys
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

CIN, PROPS = "public/cinema", "public/props"
review_path = sys.argv[1] if len(sys.argv) > 1 else None
rng = np.random.default_rng(7)

im = Image.open(f"{CIN}/desk.webp").convert("RGB")
A = np.asarray(im).astype(float)
H, W = A.shape[:2]
manifest = json.load(open(f"{CIN}/manifest.json"))


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def pct_box(r):
    return {"left": round(100 * r[0] / W, 3), "top": round(100 * r[1] / H, 3),
            "width": round(100 * (r[2] - r[0]) / W, 3), "height": round(100 * (r[3] - r[1]) / H, 3)}

def dilate(m, r):
    return m if r <= 0 else np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * r + 1))) > 0

def erode(m, r):
    return m if r <= 0 else np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(2 * r + 1))) > 0

def box1d(a, r, axis):
    pad = [(0, 0)] * a.ndim; pad[axis] = (r, r)
    c = np.cumsum(np.pad(a, pad, mode="edge"), axis=axis)
    c = np.concatenate([np.zeros_like(np.take(c, [0], axis=axis)), c], axis=axis)
    n = a.shape[axis]
    return (np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis) - np.take(c, np.arange(n), axis=axis)) / (2 * r + 1)

def blur(a, r):
    """Three box blurs of radius r: close to a Gaussian of sigma r."""
    for _ in range(3): a = box1d(box1d(a, r, 0), r, 1)
    return a

def flood_from_border(passable):
    """Pixels reachable from the array's border through `passable`."""
    h, w = passable.shape; reach = np.zeros((h, w), bool); q = deque()
    for y in range(h):
        for x in (0, w - 1):
            if passable[y, x] and not reach[y, x]: reach[y, x] = True; q.append((y, x))
    for x in range(w):
        for y in (0, h - 1):
            if passable[y, x] and not reach[y, x]: reach[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and passable[ny, nx] and not reach[ny, nx]:
                reach[ny, nx] = True; q.append((ny, nx))
    return reach

def drop_small(m, min_px):
    h, w = m.shape; lab = np.zeros((h, w), int); keep = np.zeros((h, w), bool); n = 0
    for sy in range(h):
        for sx in range(w):
            if m[sy, sx] and lab[sy, sx] == 0:
                n += 1; q = deque([(sy, sx)]); lab[sy, sx] = n; px = [(sy, sx)]
                while q:
                    y, x = q.popleft()
                    for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                        if 0 <= ny < h and 0 <= nx < w and m[ny, nx] and lab[ny, nx] == 0:
                            lab[ny, nx] = n; q.append((ny, nx)); px.append((ny, nx))
                if len(px) >= min_px:
                    for y, x in px: keep[y, x] = True
    return keep

def distance_from(src):
    """Chebyshev distance of every pixel to the nearest `src` pixel (multi-source BFS, 8-connected)."""
    h, w = src.shape; d = np.full((h, w), 10 ** 6, int); q = deque()
    for y, x in zip(*np.nonzero(src)): d[y, x] = 0; q.append((y, x))
    while q:
        y, x = q.popleft(); n = d[y, x] + 1
        for ny in (y - 1, y, y + 1):
            for nx in (x - 1, x, x + 1):
                if 0 <= ny < h and 0 <= nx < w and d[ny, nx] > n:
                    d[ny, nx] = n; q.append((ny, nx))
    return d

def fill_holes(m):
    return m | ~flood_from_border(~m)

def smoothstep(t):
    t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)

def hexrgb(h): return np.array([int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)], float)

def save_pixel(arr, path):
    """256-colour quantise (no dither) keeps the pixel art clean and the lossless file small."""
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).quantize(
        256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB").save(
        path, lossless=True, quality=100, method=6)


# --------------------------------------------------------------------------
# 1. the light: no lamp on the right, so no glow on the right wall
# --------------------------------------------------------------------------
# The painting lit the wall between the monitor and the tower as if a second
# lamp stood there (twice the brightness of the wall beside the monitor). Bring
# that patch down to the wall's ambient level with a gentle fall-off away from
# the real lamp, keeping the dither: each pixel is scaled by the ratio of the
# target level to the local (blurred) wall brightness, estimated from wall
# pixels only so the sign, the pencil cup and the tower are dimmed with their
# surroundings instead of being flattened themselves.
GX0, GX1, GY0, GY1 = 1064, 1500, 200, 700
AMBIENT = 46.0            # the wall's luminance away from the lamp (sampled upper right / beside the note)
FALLOFF = 0.10            # darker still toward the far right corner
reg = A[GY0:GY1, GX0:GX1]
lum = reg.mean(-1)
wall = np.ones(lum.shape, bool)
for (x0, y0, x1, y1) in [(1088, 355, 1224, 600),    # the GOOD CODE sign
                         (1098, 590, 1224, 700),    # the cat pencil cup
                         (1476, 200, 1500, 700)]:   # the tower
    wall[y0 - GY0:y1 - GY0, x0 - GX0:x1 - GX0] = False
wall &= lum > 28
G = blur(lum * wall, 28) / np.maximum(blur(wall.astype(float), 28), 1e-3)
xs = np.arange(GX0, GX1)[None, :].astype(float)
target = AMBIENT * (1 - FALLOFF * (xs - GX0) / (GX1 - GX0))
F = np.clip(target / np.maximum(G, 1), 0.35, 1.0)
ys = np.arange(GY0, GY1)[:, None].astype(float)
win = smoothstep((ys - GY0) / 60) * smoothstep((GY1 - ys) / 60) * smoothstep((GX1 - xs) / 30)
F = 1 + (blur(F, 5) - 1) * win
A[GY0:GY1, GX0:GX1] = reg * F[..., None]
print("wall glow: peak factor %.2f" % F.min())


# --------------------------------------------------------------------------
# 2. plain decks
# --------------------------------------------------------------------------
# Each deck is traced from its painted black outline (the trucks' plates, which
# cross it, are included as bumps). Measured inward from the wall: the first
# OUTLINE_D px are the outline, up to RIM_D px the orange wood rim (where the
# scene reached into that band it becomes rim colour, so the rim runs all the
# way round), and everything deeper is the face, flattened to the deck colour.
# The plates and the lettering keep their pixels.
DECKS = [  # box, face colour, lettering box, lettering test
    ((495, 12, 1112, 186), "#1f4a2c", (596, 84, 996, 128),
     lambda c: (c[..., 0] >= 120) & (c[..., 1] >= 80) & (c[..., 2] <= 140) & (c[..., 0] > c[..., 1]) & (c[..., 1] > c[..., 2])),
    # gold strokes with brown shading (G/R ≈ 0.55–0.75) over purple sky and red-orange clouds (G/R ≈ 0.3)
    ((495, 185, 1112, 340), "#432658", (636, 219, 992, 251),
     lambda c: (c[..., 0] >= 100) & (c[..., 1] >= 50) & (c[..., 1] >= 0.5 * c[..., 0]) & (c[..., 2] <= 60)),
]
PLATE_BANDS = [(634, 670), (938, 974)]   # the trucks' x ranges, the same on both decks
OUTLINE_D, RIM_D = 4, 12

for box, colour, tbox, is_text in DECKS:
    x0, y0, x1, y1 = box
    c = A[y0:y1, x0:x1]
    dark = c.max(-1) < 50
    reach = flood_from_border(~dark)                 # the wall around the deck
    deck = ~reach
    d = distance_from(reach)
    orange = (c[..., 0] >= 60) & (c[..., 0] >= 1.8 * c[..., 1]) & (c[..., 2] <= 16)
    hardware = np.zeros(deck.shape, bool)            # the plates: whatever their black outlines enclose, plus the outlines
    for bx0, bx1 in PLATE_BANDS:
        band = np.zeros(deck.shape, bool); band[:, bx0 - x0:bx1 - x0] = True
        plate = drop_small(fill_holes(dark & band) & ~dark, 60)
        hardware |= plate | (dilate(plate, 3) & dark)
    text = np.zeros(deck.shape, bool)
    tx0, ty0, tx1, ty1 = tbox
    text[ty0 - y0:ty1 - y0, tx0 - x0:tx1 - x0] = is_text(c[ty0 - y0:ty1 - y0, tx0 - x0:tx1 - x0])
    text = drop_small(text, 10)
    ring = deck & (d >= OUTLINE_D) & (d < RIM_D) & ~hardware
    rim_colour = np.median(c[ring & orange].reshape(-1, 3), 0)   # the painted wood, one flat colour all round
    c[ring] = np.clip(rim_colour[None, :] + rng.integers(-4, 5, (int(ring.sum()), 1)), 0, 255)
    inner = ring & (d == RIM_D - 1)                               # the 1 px shadow line where the face is inset
    c[inner] = rim_colour[None, :] * 0.5
    face = deck & (d >= RIM_D) & ~hardware & ~text
    c[face] = hexrgb(colour)[None, :] + rng.integers(-3, 4, (int(face.sum()), 1))
    print("deck", box[1], "face px", int(face.sum()), "rim", [int(v) for v in rim_colour], "plates px", int(hardware.sum()), "text px", int(text.sum()))


# --------------------------------------------------------------------------
# 3. the props: pixel drafts in place of the painted cut-outs
# --------------------------------------------------------------------------
old = manifest["props"]
spill_box = (250, 540, 545, 814)

# the wall behind the old mug: blend each row from the lit wall left of the pencil cup to the wall by the monitor
old_mug = f"{CIN}/sprite-mug.png"
if os.path.exists(old_mug) and "mug" in old:
    bx0, by0, bx1, by1 = old["mug"]["boxPx"]
    alpha = np.asarray(Image.open(old_mug).convert("RGBA"))[..., 3] > 0
    mask = dilate(alpha, 3)
    desk_top = 770
    for r in range(mask.shape[0]):
        ay = by0 + r
        if ay >= desk_top or not mask[r].any(): continue
        xs_ = np.nonzero(mask[r])[0]; lo, hi = bx0 + int(xs_[0]), bx0 + int(xs_[-1])
        left = np.median(A[ay, 296:326], 0); right = np.median(A[ay, 524:546], 0)
        t = (np.arange(lo, hi + 1) - 300) / (540 - 300)
        row = left[None, :] * (1 - t[:, None]) + right[None, :] * t[:, None]
        row += rng.integers(-3, 4, (hi - lo + 1, 1))
        sel = mask[r, lo - bx0:hi - bx0 + 1]
        A[ay, lo:hi + 1][sel] = np.clip(row, 0, 255)[sel]

def place(name, file, w, h, scale, left, top, origin, extra=None):
    """A pixel-draft prop: `w`x`h` sprite px drawn at `scale` art px each, top-left at (left, top)."""
    box = (left, top, left + w * scale, top + h * scale)
    manifest["props"][name] = {"file": f"/props/{file}", "boxPct": pct_box(box), "boxPx": list(box),
                               "originPct": [round(100 * origin[0] / w, 2), round(100 * origin[1] / h, 2)], **(extra or {})}
    return box

manifest["props"] = {k: v for k, v in old.items() if k == "lamp-head"}
manifest["props"]["lamp-head"]["file"] = "/cinema/" + manifest["props"]["lamp-head"]["file"].split("/")[-1]

# the mug sits on the painted coaster (its base at y≈795), tipping on its bottom-left corner
MS = 4; mug_box = (322, 563)
mug_pivot = (9.5, 55)                                 # sprite px: the body's bottom-left
mug_rim = (9, 14)                                     # the rim's left edge, where it pours from
px = lambda p, box, s: (box[0] + p[0] * s, box[1] + p[1] * s)
pv, rm = px(mug_pivot, mug_box, MS), px(mug_rim, mug_box, MS)
place("mug", "mug-forest.png", 56, 64, MS, *mug_box, mug_pivot, {"spill": {
    "boxPct": pct_box(spill_box), "width": spill_box[2] - spill_box[0], "height": spill_box[3] - spill_box[1],
    "pivot": [round(pv[0] - spill_box[0]), round(pv[1] - spill_box[1])],
    "rim": [round(rm[0] - spill_box[0]), round(rm[1] - spill_box[1])],
    "landY": round(pv[1] - 3 - spill_box[1]),         # the desk just in front of the mug's foot
    "mugLeft": round(pv[0] - spill_box[0])}})
place("steam", "mug-steam.png", 56, 64, MS, *mug_box, (28, 64))
# the note hangs on the wall between the lamp and the monitor, swinging from its pin
place("note", "note-1.png", 52, 54, 3, 388, 348, (24, 6.5))
# the plant stands right of the monitor; the leaves sway over the pot
PS = 4; plant_box = (1255, 474)
place("plant-pot", "plant-forest-terracotta-pot.png", 72, 84, PS, *plant_box, (36, 80))
place("plant-leaves", "plant-forest-terracotta-leaves.png", 72, 84, PS, *plant_box, (36, 52))
# the ant walks out from under the pot's left side, across the desk past the mouse pad
pot_foot = px((23, 80), plant_box, PS)
manifest["antPct"] = {"from": [round(100 * pot_foot[0] / W, 2), round(100 * pot_foot[1] / H, 2)],
                      "to": [round(100 * 1080 / W, 2), round(100 * 805 / H, 2)]}

for f in ("sprite-mug.png", "sprite-steam.png", "sprite-note.png", "sprite-plant-pot.png", "sprite-plant-leaves.png"):
    p = f"{CIN}/{f}"
    if os.path.exists(p): os.remove(p); print("removed", p)

save_pixel(A, f"{CIN}/desk.webp")
json.dump(manifest, open(f"{CIN}/manifest.json", "w"), indent=2)
print("done")

if review_path:
    base = Image.fromarray(np.clip(A, 0, 255).astype(np.uint8)).convert("RGBA")
    for k in ("note", "lamp-head", "plant-pot", "plant-leaves", "steam", "mug"):
        p = manifest["props"][k]; x0, y0, x1, y1 = p["boxPx"]
        sp = Image.open("public" + p["file"]).convert("RGBA").resize((x1 - x0, y1 - y0), Image.NEAREST)
        base.alpha_composite(sp, (x0, y0))
    base.convert("RGB").save(review_path)
