"""
Builds the artwork for the v2 lo-fi pixel desk scene.

Inputs: the desktop art (16:9), the phone art (a portrait render inside an
iPhone mockup, which gets cropped out), and the pixel mug icon.

For each layout it cuts the interactive props out of the painting as
transparent sprites (mug with steam, the three wall notes), fills the
painting behind them, paints the window out as plain wall, hangs two
skateboard decks there, and writes manifest.json with the painted screen's
rect, sprite boxes and hotspot boxes (percent of each image) plus the
screen palette. Also: screen-art.png (the on-screen illustration, keyed),
mug.png (the loading icon), sprite-ant.png (drawn here).

Coordinates below are set by eye on a 50px grid; re-measure if the art changes.

    python3 -m venv .venv && .venv/bin/pip install pillow numpy
    .venv/bin/python scripts/cinema-assets.py <desk.webp> <phone.webp> <mug.png> [review.png]
"""
import json, sys
from collections import deque
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = "public/cinema"
desk_src, phone_src, mug_src = sys.argv[1:4]
review_path = sys.argv[4] if len(sys.argv) > 4 else None
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
    # ---- window → wall ----
    win = spec["window"]
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
# desktop
# --------------------------------------------------------------------------
desk = Painting(Image.open(desk_src)); W, H = desk.W, desk.H
d_screen = [560, 220, 1098, 612]
screen_bg = desk.median((600, 420, 800, 530))
colors = {"screenBg": hexc(screen_bg), "text": hexc(desk.median((595, 285, 945, 315), bright=True)),
          "highlight": hexc(desk.median((900, 376, 1060, 396))),
          "highlightText": hexc(desk.median((880, 376, 985, 396), bright=False)),
          "bezel": hexc(desk.median((520, 640, 600, 660)))}
art_box = (574, 364, 772, 528)
art = key_out(desk.im.crop(art_box), screen_bg, tol=40); art.save(f"{OUT}/screen-art.png", optimize=True)

DESK_SPEC = {
    "mug": {"box": (285, 555, 487, 800), "seeds": [(380, 700), (455, 690), (320, 628), (440, 630), (380, 640), (360, 624)],
            "wall_sample": (490, 560, 540, 690), "steam_zone": (365, 555, 432, 622), "steam_lum": 100},
    "notes": {"note1": ((352, 180, 414, 254), [(362, 194), (404, 242)]),
              "note2": ((396, 248, 474, 344), [(410, 262), (462, 330)]),
              "note3": ((358, 368, 432, 452), [(368, 392), (420, 440)])},
    "window": (846, 0, 1504, 614),
    "wall_strips": [(756, 0, 848, 172), (482, 172, 504, 614)],
    "keep_boxes": [(505, 172, 1152, 745)],          # the monitor overlaps the window
    "plant_from": (1392, 376),                       # the big plant overlaps it too
    "deck_size": (150, 33), "deck_at": [(772, 14), (772, 96)],
}
d_sprites, d_decks = compose(desk, DESK_SPEC, "")
save_pixel(desk.image(), f"{OUT}/desk.webp")
d_hot = {
  "monitor": [505, 170, 1150, 745], "lamp": [130, 210, 385, 540], "plant": [1395, 380, 1672, 800],
  "books": [40, 595, 292, 790], "pencup": [1270, 600, 1370, 745], "sticky": [1150, 620, 1250, 755],
}
d_ant = {"from": [1470, 700], "to": [1180, 760]}     # out of the pot, along the desk, under the sticky

# --------------------------------------------------------------------------
# phone: cropped out of the mockup (below its status bar, inside its bezel), then the same treatment
# --------------------------------------------------------------------------
phone = Image.open(phone_src).convert("RGB")
crop = (66, 130, 811, 1640)
mob = Painting(phone.crop(crop)); MW, MH = mob.W, mob.H
ox, oy = crop[0], crop[1]
m_screen = [205 - ox, 660 - oy, 722 - ox, 1092 - oy]
MOBILE_SPEC = {
    "mug": {"box": (20, 950, 190, 1190), "seeds": [(100, 1100), (165, 1090), (60, 1035), (150, 1038), (100, 1045)],
            "wall_sample": (195, 1030, 215, 1060), "steam_zone": (70, 950, 120, 1025), "steam_lum": 100},
    "notes": {"note1": ((284, 272, 356, 350), [(300, 295), (340, 335)]),
              "note2": ((366, 304, 448, 392), [(382, 322), (430, 375)]),
              "note3": ((312, 366, 396, 452), [(330, 392), (378, 435)])},
    "window": (486, 0, 745, 472),
    "wall_strips": [(455, 0, 485, 472)],
    "keep_boxes": [],
    "plant_from": None,
    "deck_size": (118, 26), "deck_at": [(492, 56), (492, 124)],
}
m_sprites, m_decks = compose(mob, MOBILE_SPEC, "m-")
save_pixel(mob.image(), f"{OUT}/desk-mobile.webp")
m_hot = {"monitor": [95, 485, 695, 1020], "lamp": [0, 290, 200, 500], "plant": [690, 480, 745, 760],
         "sticky": [596, 960, 684, 1085]}
m_ant = {"from": [716, 742], "to": [600, 985]}

# --------------------------------------------------------------------------
# small extras
# --------------------------------------------------------------------------
mug_icon = Image.open(mug_src).convert("RGB")
key_out(mug_icon, np.median(np.asarray(mug_icon.crop((0, 0, 40, 40))).reshape(-1, 3), 0), tol=30).save(f"{OUT}/mug.png", optimize=True)
ant = Image.new("RGBA", (14, 8), (0, 0, 0, 0)); d = ImageDraw.Draw(ant)
for cx in (2, 6, 11): d.ellipse([cx - 2, 2, cx + 2, 6], fill=(28, 18, 8))
for lx in (3, 6, 9): d.line([lx, 6, lx - 1, 7], fill=(28, 18, 8)); d.line([lx, 2, lx + 1, 1], fill=(28, 18, 8))
ant.resize((28, 16), Image.NEAREST).save(f"{OUT}/sprite-ant.png")

manifest = {
  "colors": colors,
  "screenArt": {"file": "screen-art.png", "width": art.width, "height": art.height},
  "desktop": {"image": "desk.webp", "size": {"width": W, "height": H},
              "screenPx": d_screen, "screenPct": pct(d_screen, W, H),
              "focalPoint": [round(100 * (d_screen[0] + d_screen[2]) / 2 / W, 2), round(100 * (d_screen[1] + d_screen[3]) / 2 / H, 2)],
              "hotspotsPct": {k: pct(v, W, H) for k, v in d_hot.items()},
              "spritesPct": {k: pct(v, W, H) for k, v in d_sprites.items()},
              "spriteFiles": {k: f"sprite-{k}.png" for k in d_sprites},
              "decksPct": [pct(v, W, H) for v in d_decks],
              "antPct": {"from": [round(100 * d_ant["from"][0] / W, 2), round(100 * d_ant["from"][1] / H, 2)],
                         "to": [round(100 * d_ant["to"][0] / W, 2), round(100 * d_ant["to"][1] / H, 2)]}},
  "mobile":  {"image": "desk-mobile.webp", "size": {"width": MW, "height": MH},
              "screenPx": m_screen, "screenPct": pct(m_screen, MW, MH),
              "focalPoint": [round(100 * (m_screen[0] + m_screen[2]) / 2 / MW, 2), round(100 * (m_screen[1] + m_screen[3]) / 2 / MH, 2)],
              "hotspotsPct": {k: pct(v, MW, MH) for k, v in m_hot.items()},
              "spritesPct": {k: pct(v, MW, MH) for k, v in m_sprites.items()},
              "spriteFiles": {k: f"m-sprite-{k}.png" for k in m_sprites},
              "decksPct": [pct(v, MW, MH) for v in m_decks],
              "antPct": {"from": [round(100 * m_ant["from"][0] / MW, 2), round(100 * m_ant["from"][1] / MH, 2)],
                         "to": [round(100 * m_ant["to"][0] / MW, 2), round(100 * m_ant["to"][1] / MH, 2)]}},
}
json.dump(manifest, open(f"{OUT}/manifest.json", "w"), indent=2)
print("desk", W, H, "sprites", {k: v for k, v in d_sprites.items()}, "mobile", MW, MH)

if review_path:
    sheet = Image.new("RGB", (W, H + 300), (120, 40, 140)); sheet.paste(desk.image(), (0, 0))
    x = 10
    for k in d_sprites:
        sp = Image.open(f"{OUT}/sprite-{k}.png"); sheet.paste(sp, (x, H + 10), sp); x += sp.width + 20
    big = ant.resize((112, 64), Image.NEAREST); sheet.paste(big, (x, H + 10), big)
    sheet.save(review_path)
    msheet = Image.new("RGB", (MW + 220, MH), (120, 40, 140)); msheet.paste(mob.image(), (0, 0)); y = 10
    for k in m_sprites:
        sp = Image.open(f"{OUT}/m-sprite-{k}.png"); msheet.paste(sp, (MW + 10, y), sp); y += sp.height + 16
    msheet.save(review_path.replace(".png", "-mobile.png"))
