"""
Builds the artwork for the v2 lo-fi pixel desk scene from the painting
("Cozy Retro Developer Workspace", 1672x941) and the pixel mug icon.

Every interactive prop is traced along its painted dark outline and lifted
out as a transparent sprite; the painting is filled in behind it by copying
its own texture row by row from beside the prop (mirrored strips, hard cut
at the middle), which keeps the dither, the wood grain and the wall gradient
intact. The plant is two layers (pot and leaves) so the leaves can sway over
a nudged pot; the lamp's head is the only moving lamp part. The steam is its
own sprite so it can fade while the mug tips.

manifest.json carries, per prop, its box, file and transform origin (percent
of the painting / of the sprite), the coffee-spill geometry for the mug (art
pixels inside the spill canvas), the painted screen's rect, the decks' boxes
(the seated crop starts below them), the monitor hotspot and the palette.

Coordinates below are set by eye on a 10–50px grid; re-measure if the art changes.

    python3 -m venv .venv && .venv/bin/pip install pillow numpy
    .venv/bin/python scripts/cinema-assets.py <desk.png> <mug.png> [review.png]
"""
import json, sys
from collections import deque
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = "public/cinema"
desk_src, mug_src = sys.argv[1:3]
review_path = sys.argv[3] if len(sys.argv) > 3 else None
rng = np.random.default_rng(3)


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def pct_box(r, W, H):
    return {"left": round(100 * r[0] / W, 3), "top": round(100 * r[1] / H, 3),
            "width": round(100 * (r[2] - r[0]) / W, 3), "height": round(100 * (r[3] - r[1]) / H, 3)}

def hexc(c): return "#%02x%02x%02x" % tuple(int(min(255, max(0, v))) for v in c)

def key_out(im, bg, tol=28):
    a = np.asarray(im.convert("RGBA")).astype(np.int32)
    d = np.abs(a[..., :3] - np.array(bg)).sum(-1)
    a[..., 3] = np.where(d <= tol, 0, 255)
    return Image.fromarray(a.astype(np.uint8))

def save_pixel(im, path):
    """256-colour quantise (no dither) keeps the pixel art clean and the lossless file small."""
    im.quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB").save(
        path, lossless=True, quality=100, method=6)

def dilate(m, r):
    if r <= 0: return m
    return np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * r + 1))) > 0

def erode(m, r):
    if r <= 0: return m
    return np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(2 * r + 1))) > 0

def components(m):
    """Label 4-connected components; returns (labels, sizes)."""
    h, w = m.shape; lab = np.zeros((h, w), int); sizes = []
    for sy in range(h):
        for sx in range(w):
            if m[sy, sx] and lab[sy, sx] == 0:
                n = len(sizes) + 1; q = deque([(sy, sx)]); lab[sy, sx] = n; cnt = 0
                while q:
                    y, x = q.popleft(); cnt += 1
                    for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                        if 0 <= ny < h and 0 <= nx < w and m[ny, nx] and lab[ny, nx] == 0:
                            lab[ny, nx] = n; q.append((ny, nx))
                sizes.append(cnt)
    return lab, sizes

def keep_big(m, min_px):
    lab, sizes = components(m)
    keep = [i + 1 for i, s in enumerate(sizes) if s >= min_px]
    return np.isin(lab, keep)

def largest(m):
    lab, sizes = components(m)
    if not sizes: return m
    return lab == (int(np.argmax(sizes)) + 1)

def fill_holes(m):
    h, w = m.shape; reach = np.zeros_like(m); q = deque()
    for y in range(h):
        for x in range(w):
            if (y in (0, h - 1) or x in (0, w - 1)) and not m[y, x]:
                reach[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and not m[ny, nx] and not reach[ny, nx]:
                reach[ny, nx] = True; q.append((ny, nx))
    return m | ~reach

def mirror_tile(strip, n, nearest_last):
    """n pixels tiled from `strip` with mirroring; the pixel nearest the gap comes first."""
    L = len(strip); out = np.zeros((n, 3))
    for i in range(n):
        p = i % (2 * L)
        if nearest_last: j = L - 1 - p if p < L else p - L
        else: j = p if p < L else 2 * L - 1 - p
        out[i] = strip[j]
    return out


class Painting:
    def __init__(self, im):
        self.im = im.convert("RGB")
        self.A = np.asarray(self.im).astype(int)
        self.H, self.W = self.A.shape[:2]

    def median(self, box, bright=None):
        px = self.A[box[1]:box[3], box[0]:box[2]].reshape(-1, 3)
        if bright is not None: px = px[(px[:, 1] > 110) == bright]
        return np.median(px, 0)

    def outline_object(self, box, dark=70, close=1, min_px=200):
        """Everything inside `box` that the painted dark outlines enclose: flood the background in
        from the box border through non-dark pixels; what it can't reach (minus the outlines
        themselves) is object interior; the outline pixels touching that interior are added back."""
        c = self.A[box[1]:box[3], box[0]:box[2]]; h, w = c.shape[:2]
        isdark = c.max(-1) < dark
        isdark_c = dilate(isdark, close)
        reach = np.zeros((h, w), bool); q = deque()
        for y in range(h):
            for x in range(w):
                if (y in (0, h - 1) or x in (0, w - 1)) and not isdark_c[y, x]:
                    reach[y, x] = True; q.append((y, x))
        while q:
            y, x = q.popleft()
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and not reach[ny, nx] and not isdark_c[ny, nx]:
                    reach[ny, nx] = True; q.append((ny, nx))
        interior = ~reach & ~isdark_c
        interior = keep_big(interior, min_px)
        return interior | (dilate(interior, 2) & isdark)

    def grow(self, box, seeds, tol):
        """Connected region of pixels within `tol` (channel-sum distance) of each seed's colour."""
        c = self.A[box[1]:box[3], box[0]:box[2]]; h, w, _ = c.shape
        out = np.zeros((h, w), bool)
        for sx, sy in seeds:
            sx -= box[0]; sy -= box[1]
            ok = np.abs(c - c[sy, sx]).sum(-1) <= tol
            if out[sy, sx]: continue
            q = deque([(sy, sx)]); out[sy, sx] = True
            while q:
                y, x = q.popleft()
                for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                    if 0 <= ny < h and 0 <= nx < w and ok[ny, nx] and not out[ny, nx]:
                        out[ny, nx] = True; q.append((ny, nx))
        return out

    def sprite(self, box, m):
        a = np.asarray(self.im.crop(box).convert("RGBA")).copy(); a[..., 3] = np.where(m, 255, 0)
        return Image.fromarray(a.astype(np.uint8))

    def fill_rows(self, box, mask, side="both", strip=28, skip=3):
        """Fill masked pixels row by row with the painting's own texture: for each row, a strip just
        outside the row's whole masked span (so always true background) is mirror-tiled across every
        masked run. `side` is "left", "right", "both", or a list of (y_below, side) rules by absolute y."""
        A, W = self.A, self.W
        x0, y0 = box[0], box[1]
        for r in range(mask.shape[0]):
            row = mask[r]
            if not row.any(): continue
            ay = y0 + r
            s = side
            if isinstance(side, list):
                s = next((sd for (ylim, sd) in side if ay < ylim), side[-1][1])
            xs = np.nonzero(row)[0]
            span_lo, span_hi = x0 + int(xs[0]), x0 + int(xs[-1])
            L = A[ay, max(0, span_lo - skip - strip):span_lo - skip] if span_lo - skip > 0 else np.zeros((0, 3))
            R = A[ay, span_hi + 1 + skip:min(W, span_hi + 1 + skip + strip)] if span_hi + 1 + skip < W else np.zeros((0, 3))
            use_l = s in ("both", "left") and len(L) > 0
            use_r = s in ("both", "right") and len(R) > 0
            if not use_l and not use_r: use_l, use_r = len(L) > 0, len(R) > 0
            if not use_l and not use_r: continue
            n = span_hi - span_lo + 1
            if use_l and use_r:
                cut = n // 2
                fill = np.zeros((n, 3))
                fill[:cut] = mirror_tile(L, cut, True)
                fill[cut:] = mirror_tile(R, n - cut, False)[::-1]
            elif use_l:
                fill = mirror_tile(L, n, True)
            else:
                fill = mirror_tile(R, n, False)[::-1]
            sel = row[span_lo - x0:span_hi - x0 + 1]
            A[ay, span_lo:span_hi + 1][sel] = fill[sel]

    def row_median(self, ay, x0, x1):
        """Median of a row strip, ignoring outline-dark pixels."""
        px = self.A[ay, x0:x1]
        lit = px[px.max(-1) >= 60]
        return np.median(lit if len(lit) else px, 0)

    def fill_structured(self, box, mask, sampler):
        """Fill masked pixels row by row with `sampler(ay, lo, hi)` -> (n,3) colours for the absolute
        span lo..hi, plus a touch of dither so it reads as painted."""
        A = self.A
        x0, y0 = box[0], box[1]
        for r in range(mask.shape[0]):
            row = mask[r]
            if not row.any(): continue
            ay = y0 + r
            xs = np.nonzero(row)[0]
            lo, hi = x0 + int(xs[0]), x0 + int(xs[-1])
            fill = sampler(ay, lo, hi)
            if fill is None: continue
            fill = np.clip(fill + rng.integers(-3, 4, (hi - lo + 1, 1)), 0, 255)
            sel = row[lo - x0:hi - x0 + 1]
            A[ay, lo:hi + 1][sel] = fill[sel]

    def image(self):
        return Image.fromarray(self.A.astype(np.uint8))


# --------------------------------------------------------------------------
# the painting
# --------------------------------------------------------------------------
P = Painting(Image.open(desk_src)); W, H = P.W, P.H
screen = [585, 377, 1022, 693]
screen_bg = P.median((840, 640, 1000, 688))
colors = {"screenBg": hexc(screen_bg), "text": hexc(P.median((620, 435, 900, 458), bright=True)),
          "highlight": hexc(P.median((830, 505, 990, 522))),
          "highlightText": hexc(P.median((800, 503, 1000, 525), bright=False)),
          "bezel": hexc(P.median((560, 700, 640, 725)))}
art_box = (600, 496, 760, 628)
art = key_out(P.im.crop(art_box), screen_bg, tol=40); art.save(f"{OUT}/screen-art.png", optimize=True)

props = {}

def add_prop(name, box, mask, origin_pct, extra=None):
    sp = P.sprite(box, mask); sp.save(f"{OUT}/sprite-{name}.png", optimize=True)
    props[name] = {"file": f"sprite-{name}.png", "boxPct": pct_box(box, W, H), "boxPx": list(box),
                   "originPct": origin_pct, **(extra or {})}
    return sp

# ---- mug: outline-traced body (green) + the coffee inside the rim; the coaster stays on the desk ----
mug_box = (340, 548, 540, 806)
c = P.A[mug_box[1]:mug_box[3], mug_box[0]:mug_box[2]]
mug_green = (c[..., 1] >= c[..., 0] * 0.9) & (c[..., 1] > c[..., 2] * 1.15) & (c[..., 1] > 25)
mug_cream = (c[..., 0] > 150) & (c[..., 1] > 110) & (c[..., 2] > 60)          # the moon and the rim highlight
mug_coffee = (c[..., 0] > c[..., 1]) & (c[..., 1] > c[..., 2]) & (c[..., 0] > 60) & (c[..., 0] < 200)
grown = P.grow(mug_box, [(420, 720), (505, 715), (430, 680), (380, 700), (455, 690), (390, 760), (480, 760), (425, 735)], 48)
grown &= mug_green | mug_cream
# the rim and the coffee: an ellipse along the painted rim (its colours are too mixed to trace)
rim_ell = (368, 662, 476, 686)
ell = Image.new("L", (mug_box[2] - mug_box[0], mug_box[3] - mug_box[1]), 0)
ImageDraw.Draw(ell).ellipse([rim_ell[0] - mug_box[0], rim_ell[1] - mug_box[1], rim_ell[2] - mug_box[0], rim_ell[3] - mug_box[1]], fill=255)
grown |= np.asarray(ell) > 0
body = fill_holes(keep_big(grown, 300))
# the rim ring sits behind its own outline, so the body and the rim are separate components: keep both
body = keep_big(dilate(body, 1) | (dilate(body, 2) & (c.max(-1) < 60)), 300)
body = fill_holes(body)
lab, sizes = components(keep_big(grown, 300)); print("mug components", sorted(sizes, reverse=True)[:5])
core = largest(keep_big(grown, 300))
cy, cx = np.nonzero(core)
rows_wide = [y for y in range(core.shape[0]) if core[y].sum() > 40]
mug_bottom = max(rows_wide)
foot = core[mug_bottom - 10:mug_bottom + 1]
mug_left = int(np.nonzero(foot.any(0))[0].min())
by, bx = np.nonzero(body)
left_cols = bx < bx.min() + 14
mug_rim = (int(bx.min()), int(by[left_cols].min()))
pivot = (mug_left, mug_bottom)
print("mug px", int(body.sum()), "pivot", pivot, "rim", mug_rim, "bottom", mug_bottom)
coffee = np.array([46, 22, 8])                                 # the puddle: real coffee brown, darker than the desk
coffee_dark = coffee; coffee_mid = np.array([107, 53, 18]); coffee_hi = np.array([168, 112, 58])
spill_box = (250, 540, 545, 814)
add_prop("mug", mug_box, body,
         [round(100 * pivot[0] / (mug_box[2] - mug_box[0]), 2), round(100 * pivot[1] / (mug_box[3] - mug_box[1]), 2)],
         {"spill": {"boxPct": pct_box(spill_box, W, H), "width": spill_box[2] - spill_box[0], "height": spill_box[3] - spill_box[1],
                    "pivot": [mug_box[0] + pivot[0] - spill_box[0], mug_box[1] + pivot[1] - spill_box[1]],
                    "rim": [mug_box[0] + mug_rim[0] - spill_box[0], mug_box[1] + mug_rim[1] - spill_box[1]],
                    "landY": mug_box[1] + mug_bottom - 3 - spill_box[1],      # the desk just in front of the mug's foot
                    "mugLeft": mug_box[0] + mug_left - spill_box[0]}})
coaster_top = mug_box[1] + mug_bottom - 4
def mug_sampler(ay, lo, hi):
    n = hi - lo + 1
    if ay < coaster_top:
        return np.repeat(P.row_median(ay, 512, 528)[None, :], n, 0)        # shadowed wall right of the handle
    ring = np.concatenate([P.A[ay, 352:366], P.A[ay, 495:504]])
    lit = ring[ring.max(-1) >= 60]
    return np.repeat(np.median(lit if len(lit) else ring, 0)[None, :], n, 0)   # the coaster under the mug
P.fill_structured(mug_box, dilate(body, 3), mug_sampler)

# ---- steam: pale tan wisps on the wall above the mug ----
steam_box = (405, 556, 490, 668)
c = P.A[steam_box[1]:steam_box[3], steam_box[0]:steam_box[2]]
wisps = keep_big((c.mean(-1) > 105) & ~((c[..., 1] >= c[..., 0] * 0.9) & (c[..., 1] > c[..., 2] * 1.2)), 20)
wisps = dilate(wisps, 1)
print("steam px", int(wisps.sum()))
add_prop("steam", steam_box, wisps, [50, 100])
P.fill_structured(steam_box, dilate(wisps, 2), lambda ay, lo, hi: np.repeat(P.row_median(ay, 492, 512)[None, :], hi - lo + 1, 0))

# ---- wall note: outline-traced, swings from its pin ----
note_box = (400, 362, 520, 496)
note = dilate(fill_holes(P.grow(note_box, [(430, 395), (490, 465), (460, 430)], 55)), 2)
c = P.A[note_box[1]:note_box[3], note_box[0]:note_box[2]]
note |= (c.max(-1) < 90) & dilate(note, 6)              # the pin above the paper
note = keep_big(note, 200)
print("note px", int(note.sum()))
add_prop("note", note_box, note, [50, 5])
note_profile = P.A[350:360, 396:530].mean(0)
k = 7; note_profile = np.stack([np.convolve(np.pad(note_profile[:, ch], (k // 2, k // 2), mode="edge"), np.ones(k) / k, mode="valid") for ch in range(3)], 1)
def note_sampler(ay, lo, hi):
    right = P.row_median(ay, 523, 541)
    ratio = (right + 1) / (note_profile[-10:].mean(0) + 1)
    return np.clip(note_profile[lo - 396:hi - 396 + 1] * ratio[None, :], 0, 255)
P.fill_structured(note_box, dilate(note, 6), note_sampler)

# ---- lamp head: the shade and its vented cap, traced by hand along the painted outline; it
#      swings on the hinge at its left, which stays with the arm ----
HEAD_POLY = [(252, 256), (300, 262), (330, 275), (352, 300), (386, 332), (398, 365), (396, 398), (380, 420),
             (340, 440), (290, 450), (240, 450), (212, 440), (210, 400), (218, 360), (228, 332), (250, 318),
             (244, 300), (245, 272)]
joint = (238, 318)
xs_ = [p[0] for p in HEAD_POLY]; ys_ = [p[1] for p in HEAD_POLY]
head_box = (min(xs_) - 3, min(ys_) - 3, max(xs_) + 4, max(ys_) + 4)
poly_im = Image.new("L", (head_box[2] - head_box[0], head_box[3] - head_box[1]), 0)
ImageDraw.Draw(poly_im).polygon([(x - head_box[0], y - head_box[1]) for x, y in HEAD_POLY], fill=255)
poly = np.asarray(poly_im) > 0
c = P.A[head_box[1]:head_box[3], head_box[0]:head_box[2]]
head_mask = erode(poly, 1) | (dilate(poly, 1) & (c.max(-1) < 60))
head_mask = largest(head_mask)
print("lamp head px", int(head_mask.sum()), "box", head_box)
add_prop("lamp-head", head_box, head_mask,
         [round(100 * (joint[0] - head_box[0]) / (head_box[2] - head_box[0]), 2), round(100 * (joint[1] - head_box[1]) / (head_box[3] - head_box[1]), 2)])
P.fill_structured(head_box, dilate(head_mask, 3), lambda ay, lo, hi: np.repeat(P.row_median(ay, 406, 426)[None, :], hi - lo + 1, 0))

# ---- plant: leaves (green inside the outline) over the pot (outlined cream) ----
plant_box = (1222, 488, 1528, 798)
pot_box = (1318, 660, 1480, 798)
c = P.A[plant_box[1]:plant_box[3], plant_box[0]:plant_box[2]]
greenish = ((c[..., 1] >= c[..., 0] * 0.8) & (c[..., 1] > c[..., 2] * 1.25) & (c[..., 1] > 45)) | \
           ((c[..., 1] > c[..., 0] * 1.3) & (c[..., 1] > c[..., 2] * 1.3) & (c[..., 1] > 18))      # shadowed leaves too
closed = erode(dilate(greenish, 3), 3)                      # the leaves with their dark veins closed over
leaves = keep_big(greenish | closed, 12)
leaves = leaves | (dilate(leaves, 2) & (c.max(-1) < 60))     # their outlines
pot_full = np.zeros_like(leaves)
pot_full[pot_box[1] - plant_box[1]:pot_box[3] - plant_box[1], pot_box[0] - plant_box[0]:pot_box[2] - plant_box[0]] = P.outline_object(pot_box, dark=45, close=1, min_px=400)[: pot_box[3] - pot_box[1], : pot_box[2] - pot_box[0]]
pot_full &= ~greenish
pot_full = fill_holes(largest(pot_full))
pot_vis = pot_full & ~leaves
# the pot behind the leaves: patch each leaf-covered column from the pot colour above/below
pot_rgba = np.asarray(P.sprite(plant_box, pot_full)).copy()
holes = pot_full & leaves
for col in range(holes.shape[1]):
    ys_ = np.nonzero(holes[:, col])[0]
    if ys_.size == 0: continue
    vis = np.nonzero(pot_vis[:, col])[0]
    if vis.size == 0: continue
    for y in ys_:
        above = vis[vis < y]; below = vis[vis > y]
        if above.size and below.size:
            a, b = above[-1], below[0]; t = (y - a) / max(1, b - a)
            pot_rgba[y, col, :3] = (1 - t) * pot_rgba[a, col, :3] + t * pot_rgba[b, col, :3]
        elif above.size: pot_rgba[y, col, :3] = pot_rgba[above[-1], col, :3]
        else: pot_rgba[y, col, :3] = pot_rgba[below[0], col, :3]
Image.fromarray(pot_rgba).save(f"{OUT}/sprite-plant-pot.png", optimize=True)
props["plant-pot"] = {"file": "sprite-plant-pot.png", "boxPct": pct_box(plant_box, W, H), "boxPx": list(plant_box), "originPct": [50, 100]}
add_prop("plant-leaves", plant_box, leaves, [50, 86])
print("leaves px", int(leaves.sum()), "pot px", int(pot_full.sum()))
leafy_loose = (c[..., 1] > c[..., 0] * 0.75) & (c[..., 1] > c[..., 2] * 1.1) & (c[..., 1] > 30)   # any leaf-ish pixel
plant_blob = fill_holes(dilate(leaves | pot_full | leafy_loose, 8))
wall_profile = P.A[488:498, 1226:1528].mean(0)                 # the wall just above the plant, per column
k = 9; wall_profile = np.stack([np.convolve(np.pad(wall_profile[:, ch], (k // 2, k // 2), mode="edge"), np.ones(k) / k, mode="valid") for ch in range(3)], 1)
desk_top = 775
def plant_sampler(ay, lo, hi):
    n = hi - lo + 1
    if ay >= desk_top:
        return np.repeat(P.row_median(ay, 1226, 1240)[None, :], n, 0)        # the desk
    left = P.row_median(ay, 1226, 1238)
    ratio = (left + 1) / (wall_profile[0:12].mean(0) + 1)
    seg = wall_profile[lo - 1226:hi - 1226 + 1] * ratio[None, :]
    return np.clip(seg, 0, 255)
P.fill_structured(plant_box, plant_blob, plant_sampler)

save_pixel(P.image(), f"{OUT}/desk.webp")

# ---- small drawn extras ----
mug_icon = Image.open(mug_src).convert("RGB")
key_out(mug_icon, np.median(np.asarray(mug_icon.crop((0, 0, 40, 40))).reshape(-1, 3), 0), tol=30).save(f"{OUT}/mug.png", optimize=True)
ant = Image.new("RGBA", (14, 8), (0, 0, 0, 0)); d = ImageDraw.Draw(ant)
for cx in (2, 6, 11): d.ellipse([cx - 2, 2, cx + 2, 6], fill=(28, 18, 8))
for lx in (3, 6, 9): d.line([lx, 6, lx - 1, 7], fill=(28, 18, 8)); d.line([lx, 2, lx + 1, 1], fill=(28, 18, 8))
ant.resize((28, 16), Image.NEAREST).save(f"{OUT}/sprite-ant.png")

# ---- manifest ----
deck_boxes = [(495, 20, 1112, 180), (495, 185, 1112, 334)]
monitor_box = [548, 338, 1064, 770]
ant_path = {"from": [1310, 778], "to": [1080, 800]}
manifest = {
  "colors": {**colors, "coffee": {"dark": hexc(coffee_dark), "mid": hexc(coffee_mid), "hi": hexc(coffee_hi)}},
  "screenArt": {"file": "screen-art.png", "width": art.width, "height": art.height},
  "image": "desk.webp", "size": {"width": W, "height": H},
  "screenPx": screen, "screenPct": pct_box(screen, W, H),
  "focalPoint": [round(100 * (screen[0] + screen[2]) / 2 / W, 2), round(100 * (screen[1] + screen[3]) / 2 / H, 2)],
  "monitorPct": pct_box(monitor_box, W, H),
  "decksPct": [pct_box(b, W, H) for b in deck_boxes],
  "props": props,
  "antPct": {"from": [round(100 * ant_path["from"][0] / W, 2), round(100 * ant_path["from"][1] / H, 2)],
             "to": [round(100 * ant_path["to"][0] / W, 2), round(100 * ant_path["to"][1] / H, 2)]},
}
json.dump(manifest, open(f"{OUT}/manifest.json", "w"), indent=2)
print("done; coffee", manifest["colors"]["coffee"])

if review_path:
    base = P.image()
    sheet = Image.new("RGB", (W, H + 340), (120, 40, 140)); sheet.paste(base, (0, 0))
    x = 10
    for name in props:
        sp = Image.open(f"{OUT}/{props[name]['file']}").convert("RGBA")
        if sp.height > 320: sp = sp.resize((sp.width * 320 // sp.height, 320), Image.NEAREST)
        sheet.paste(sp, (x, H + 10), sp); x += sp.width + 20
    sheet.save(review_path)
