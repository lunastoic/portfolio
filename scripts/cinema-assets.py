"""
Builds the artwork for the v2 lo-fi pixel desk scene.

Inputs: the painting (16:9; phones show a portrait crop of the same one) and
the pixel mug icon.

It cuts the interactive props out of the painting as transparent sprites
(mug with steam, the wall note), fills the painting behind them, and writes
manifest.json with the painted screen's rect, the decks' boxes (the seated
crop starts below them), sprite boxes and hotspot boxes (percent of the
image) plus the screen palette. Also: screen-art.png (the on-screen
illustration, keyed), mug.png (the loading icon), sprite-ant.png (drawn here).
The window-removal and deck-drawing steps stay available for art that needs
them (spec keys "window" / "deck_at"); the current painting has neither.

Coordinates below are set by eye on a 50px grid; re-measure if the art changes.

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
OUTLINE = (43, 29, 5)

# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def pct(r, W, H):
    return {"left": round(100 * r[0] / W, 2), "top": round(100 * r[1] / H, 2),
            "width": round(100 * (r[2] - r[0]) / W, 2), "height": round(100 * (r[3] - r[1]) / H, 2)}

def hexc(c): return "#%02x%02x%02x" % tuple(int(v) for v in c)

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
    return np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * r + 1))) > 0

def smooth_rows(rows, k):
    pad = np.pad(rows, ((k // 2, k // 2), (0, 0)), mode="edge")
    return np.stack([np.convolve(pad[:, ch], np.ones(k) / k, mode="valid") for ch in range(3)], 1)


class Painting:
    """One layout's art as an int array, with the sprite-cutting and filling tools."""

    def __init__(self, im):
        self.im = im.convert("RGB")
        self.A = np.asarray(self.im).astype(int)
        self.H, self.W = self.A.shape[:2]

    def median(self, box, bright=None):
        px = self.A[box[1]:box[3], box[0]:box[2]].reshape(-1, 3)
        if bright is not None: px = px[(px[:, 1] > 110) == bright]
        return np.median(px, 0)

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

    @staticmethod
    def fill_holes(m):
        """Add enclosed pockets: anything the outside can't reach through non-mask pixels."""
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

    def sprite(self, box, m):
        a = np.asarray(self.im.crop(box).convert("RGBA")).copy(); a[..., 3] = np.where(m, 255, 0)
        return Image.fromarray(a.astype(np.uint8))

    def fill_cols(self, box, mask, margin=5, skip=5, smooth=9):
        """Fill masked pixels column by column, blending from the colours a little above and
        below each span (skipping the object's own outline), smoothed across columns."""
        A, H = self.A, self.H
        x0, y0 = box[0], box[1]; th, tw = mask.shape
        spans = []; T = np.full((tw, 3), np.nan); B = np.full((tw, 3), np.nan)
        for c in range(tw):
            ys = np.nonzero(mask[:, c])[0]
            if ys.size == 0: spans.append(None); continue
            lo, hi = int(ys.min()), int(ys.max()); ay0, ay1 = y0 + lo, y0 + hi; ax = x0 + c
            spans.append((lo, hi))
            if ay0 - skip > 0: T[c] = A[max(0, ay0 - skip - margin):ay0 - skip, ax].mean(0)
            if ay1 + 1 + skip < H: B[c] = A[ay1 + 1 + skip:min(H, ay1 + 1 + skip + margin), ax].mean(0)
        def tidy(V):
            idx = np.arange(tw); ok = np.logical_not(np.isnan(V[:, 0]))
            if not ok.any(): return None
            V = np.stack([np.interp(idx, idx[ok], V[ok, ch]) for ch in range(3)], 1)
            return smooth_rows(V, smooth)
        T, B = tidy(T), tidy(B)
        if T is None and B is None: return
        if T is None: T = B
        if B is None: B = T
        for c, sp in enumerate(spans):
            if sp is None: continue
            lo, hi = sp; ax = x0 + c
            t = (np.arange(lo, hi + 1) - lo) / max(1, hi - lo)
            col = (1 - t)[:, None] * T[c][None, :] + t[:, None] * B[c][None, :]
            sel = mask[lo:hi + 1, c]
            A[y0 + lo:y0 + hi + 1, ax][sel] = np.clip(col[sel] + rng.integers(-4, 5, (int(sel.sum()), 1)), 0, 255)

    def fill_rows(self, box, mask, margin=4, skip=3):
        """Row-wise version, for things on a wall with wall on both sides."""
        A, W = self.A, self.W
        x0, y0 = box[0], box[1]; th, tw = mask.shape
        for r in range(th):
            xs = np.nonzero(mask[r])[0]
            if xs.size == 0: continue
            lo, hi = int(xs.min()), int(xs.max()); ax0, ax1 = x0 + lo, x0 + hi
            L = A[y0 + r, max(0, ax0 - skip - margin):max(0, ax0 - skip)].mean(0) if ax0 - skip > 0 else None
            R = A[y0 + r, ax1 + 1 + skip:min(W, ax1 + 1 + skip + margin)].mean(0) if ax1 + 1 + skip < W else None
            if L is None and R is None: continue
            if L is None: L = R
            if R is None: R = L
            t = (np.arange(lo, hi + 1) - lo) / max(1, hi - lo)
            row = (1 - t)[:, None] * L[None, :] + t[:, None] * R[None, :]
            sel = mask[r, lo:hi + 1]
            A[y0 + r, ax0:ax1 + 1][sel] = np.clip(row[sel] + rng.integers(-4, 5, (int(sel.sum()), 1)), 0, 255)

    def image(self):
        return Image.fromarray(self.A.astype(np.uint8))


def deck(w, h, base, band, logo):
    """Top-view deck silhouette at half resolution, scaled 2x for the chunky pixel look, hung horizontally."""
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=h // 2, fill=base, outline=OUTLINE, width=2)
    lighter = tuple(min(255, int(v * 1.18)) for v in base)
    d.rounded_rectangle([3, 3, w - 4, h - 4], radius=h // 2 - 3, outline=lighter, width=1)
    for bx in (int(w * 0.2), int(w * 0.8)):
        d.rectangle([bx - 5, 3, bx + 5, h - 4], fill=band)
        d.line([bx - 5, 3, bx - 5, h - 4], fill=OUTLINE); d.line([bx + 5, 3, bx + 5, h - 4], fill=OUTLINE)
    if logo == "moon":
        cx, cy, r = w // 2, h // 2, h // 2 - 7
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=band, outline=OUTLINE)
        d.ellipse([cx - r + 7, cy - r - 3, cx + r + 7, cy + r - 3], fill=base)
    if logo == "stripes":
        for i in range(int(w * 0.28), int(w * 0.72), 12):
            d.line([i, h - 4, i + h - 8, 4], fill=OUTLINE, width=3)
    return im.resize((w * 2, h * 2), Image.NEAREST)


def compose(P, spec, prefix):
    """Cut sprites, fill behind them, paint out the window, hang the decks. Returns sprite boxes."""
    sprites = {}
    # ---- mug with steam ----
    mb = spec["mug"]["box"]
    m = P.grow(mb, spec["mug"]["seeds"], 70)
    holes = P.fill_holes(m) & ~m
    c = P.A[mb[1]:mb[3], mb[0]:mb[2]]
    holes &= ~(np.abs(c - P.median(spec["mug"]["wall_sample"])).sum(-1) < 60)   # the handle's hole shows wall
    m = dilate(m | holes, 2)
    sz = spec["mug"]["steam_zone"]
    zone = np.zeros_like(m); zone[sz[1] - mb[1]:sz[3] - mb[1], sz[0] - mb[0]:sz[2] - mb[0]] = True
    steam = dilate(zone & (c.mean(-1) > spec["mug"]["steam_lum"]), 1) & zone
    P.sprite(mb, m | steam).save(f"{OUT}/{prefix}sprite-mug.png", optimize=True)
    P.fill_cols(mb, dilate(steam, 2))
    P.fill_cols(mb, dilate(m, 4))
    sprites["mug"] = mb
    # ---- wall notes ----
    for k, (box, seeds) in spec["notes"].items():
        nm = dilate(P.fill_holes(P.grow(box, seeds, 55)), 2)
        c = P.A[box[1]:box[3], box[0]:box[2]]
        nm |= (c.max(-1) < 90) & dilate(nm, 6)            # the pin above the paper
        P.sprite(box, nm).save(f"{OUT}/{prefix}sprite-{k}.png", optimize=True)
        P.fill_rows(box, dilate(nm, 3))
        sprites[k] = box
    # ---- window → wall (only for art that has one) ----
    win = spec.get("window")
    if not win:
        P_decks = [list(b) for b in spec.get("deck_boxes", [])]
        return sprites, P_decks
    rows = np.concatenate([P.A[y0:y1, x0:x1].mean(1) for (x0, y0, x1, y1) in spec["wall_strips"]])
    rows = smooth_rows(rows, 31)
    ww, wh = win[2] - win[0], win[3] - win[1]
    wall = np.clip(np.repeat(rows[:wh, None, :], ww, 1) + rng.integers(-5, 6, (wh, ww, 1)), 0, 255)
    reg = P.A[win[1]:win[3], win[0]:win[2]]
    yy, xx = np.mgrid[win[1]:win[3], win[0]:win[2]]
    fillmask = np.ones(reg.shape[:2], bool)
    for (x0, y0, x1, y1) in spec["keep_boxes"]:
        fillmask &= ~((xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1))
    plant_keep = np.zeros_like(fillmask)
    if spec.get("plant_from"):
        px, py = spec["plant_from"]
        inplant = (xx >= px) & (yy >= py)
        bright = (reg[..., 1] > 118) & (reg[..., 1] > reg[..., 0] * 1.1) & (reg[..., 1] > reg[..., 2] * 1.25)
        cand = inplant & dilate(bright, 2)
        lab = np.zeros(cand.shape, int); n = 0; keep = set()
        for sy in range(cand.shape[0]):
            for sx in range(cand.shape[1]):
                if cand[sy, sx] and lab[sy, sx] == 0:
                    n += 1; q = deque([(sy, sx)]); lab[sy, sx] = n; touches = False
                    while q:
                        y, x = q.popleft()
                        if x == cand.shape[1] - 1 or y == cand.shape[0] - 1: touches = True
                        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                            if 0 <= ny < cand.shape[0] and 0 <= nx < cand.shape[1] and cand[ny, nx] and lab[ny, nx] == 0:
                                lab[ny, nx] = n; q.append((ny, nx))
                    if touches: keep.add(n)
        plant_keep = np.isin(lab, list(keep))
    fillmask &= ~plant_keep
    plant_pixels = reg[plant_keep].copy()
    reg[fillmask] = wall[fillmask]
    # ---- decks ----
    dw, dh = spec["deck_size"]
    d1 = deck(dw, dh, (46, 92, 58), (240, 224, 190), "moon")
    d2 = deck(dw, dh, (232, 208, 160), (46, 92, 58), "stripes")
    base = P.image().convert("RGBA")
    decks = []
    for (x, y), dk in zip(spec["deck_at"], (d1, d2)):
        sa = np.asarray(dk)[..., 3]
        shadow = np.zeros(dk.size[::-1] + (4,), np.uint8); shadow[..., 3] = (sa > 0) * 105
        base.alpha_composite(Image.fromarray(shadow), (x + 7, y + 9)); base.alpha_composite(dk, (x, y))
        decks.append([x, y, x + dk.width, y + dk.height])
    final = np.asarray(base.convert("RGB")).copy()
    fr = final[win[1]:win[3], win[0]:win[2]]; fr[plant_keep] = plant_pixels   # the plant stays in front
    P.A = final.astype(int)
    return sprites, decks


# --------------------------------------------------------------------------
# the painting
# --------------------------------------------------------------------------
desk = Painting(Image.open(desk_src)); W, H = desk.W, desk.H
d_screen = [585, 377, 1022, 693]
screen_bg = desk.median((840, 640, 1000, 688))
colors = {"screenBg": hexc(screen_bg), "text": hexc(desk.median((620, 435, 900, 458), bright=True)),
          "highlight": hexc(desk.median((830, 505, 990, 522))),
          "highlightText": hexc(desk.median((800, 503, 1000, 525), bright=False)),
          "bezel": hexc(desk.median((560, 700, 640, 725)))}
art_box = (600, 496, 760, 628)
art = key_out(desk.im.crop(art_box), screen_bg, tol=40); art.save(f"{OUT}/screen-art.png", optimize=True)

SPEC = {
    "mug": {"box": (350, 555, 530, 800), "seeds": [(420, 720), (505, 715), (400, 672), (470, 674), (430, 680)],
            "wall_sample": (520, 560, 545, 615), "steam_zone": (410, 560, 480, 660), "steam_lum": 100},
    "notes": {"note1": ((406, 370, 514, 490), [(430, 395), (490, 465)])},
    # painted decks above the monitor (brackets included): the seated crop starts below them
    "deck_boxes": [(495, 20, 1112, 180), (495, 185, 1112, 334)],
}
d_sprites, d_decks = compose(desk, SPEC, "")
save_pixel(desk.image(), f"{OUT}/desk.webp")
d_hot = {
  "monitor": [548, 338, 1064, 770], "lamp": [120, 250, 400, 520], "plant": [1235, 505, 1500, 785],
  "headphones": [15, 275, 115, 405], "camera": [20, 65, 115, 135], "tower": [1480, 445, 1672, 760],
  "sign": [1095, 365, 1215, 590], "books": [0, 605, 290, 780], "notebook": [40, 790, 400, 880],
}
d_ant = {"from": [1310, 778], "to": [1080, 800]}

# small extras
mug_icon = Image.open(mug_src).convert("RGB")
key_out(mug_icon, np.median(np.asarray(mug_icon.crop((0, 0, 40, 40))).reshape(-1, 3), 0), tol=30).save(f"{OUT}/mug.png", optimize=True)
ant = Image.new("RGBA", (14, 8), (0, 0, 0, 0)); d = ImageDraw.Draw(ant)
for cx in (2, 6, 11): d.ellipse([cx - 2, 2, cx + 2, 6], fill=(28, 18, 8))
for lx in (3, 6, 9): d.line([lx, 6, lx - 1, 7], fill=(28, 18, 8)); d.line([lx, 2, lx + 1, 1], fill=(28, 18, 8))
ant.resize((28, 16), Image.NEAREST).save(f"{OUT}/sprite-ant.png")

layout = {"image": "desk.webp", "size": {"width": W, "height": H},
          "screenPx": d_screen, "screenPct": pct(d_screen, W, H),
          "focalPoint": [round(100 * (d_screen[0] + d_screen[2]) / 2 / W, 2), round(100 * (d_screen[1] + d_screen[3]) / 2 / H, 2)],
          "hotspotsPct": {k: pct(v, W, H) for k, v in d_hot.items()},
          "spritesPct": {k: pct(v, W, H) for k, v in d_sprites.items()},
          "spriteFiles": {k: f"sprite-{k}.png" for k in d_sprites},
          "decksPct": [pct(v, W, H) for v in d_decks],
          "antPct": {"from": [round(100 * d_ant["from"][0] / W, 2), round(100 * d_ant["from"][1] / H, 2)],
                     "to": [round(100 * d_ant["to"][0] / W, 2), round(100 * d_ant["to"][1] / H, 2)]}}

manifest = {
  "colors": colors,
  "screenArt": {"file": "screen-art.png", "width": art.width, "height": art.height},
  "desktop": layout,
  "mobile": layout,   # phones cover-fit a portrait crop of the same painting
}
json.dump(manifest, open(f"{OUT}/manifest.json", "w"), indent=2)
print("desk", W, H, "sprites", {k: v for k, v in d_sprites.items()}, "decks", d_decks)

if review_path:
    sheet = Image.new("RGB", (W, H + 300), (120, 40, 140)); sheet.paste(desk.image(), (0, 0))
    x = 10
    for k in d_sprites:
        sp = Image.open(f"{OUT}/sprite-{k}.png"); sheet.paste(sp, (x, H + 10), sp); x += sp.width + 20
    big = ant.resize((112, 64), Image.NEAREST); sheet.paste(big, (x, H + 10), big)
    sheet.save(review_path)
