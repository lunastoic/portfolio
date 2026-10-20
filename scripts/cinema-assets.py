"""
Builds the artwork for the v2 lo-fi pixel desk scene.

Inputs: the desktop art (16:9), the phone art (a portrait render inside an
iPhone mockup, which gets cropped out), and the pixel mug icon.
Outputs in public/cinema: lossless WebP backdrops for both layouts, a
transparent cut of the on-screen moon/mountain illustration, the mug with
its background keyed out, sampled screen colors, and manifest.json with
screen rects and hotspot boxes (percent of each image).

Rects below are set by eye on a 50px grid; re-measure if the art changes.

    python3 -m venv .venv && .venv/bin/pip install pillow numpy
    .venv/bin/python scripts/cinema-assets.py <desk.webp> <phone.webp> <mug.png>
"""
import json, sys
import numpy as np
from PIL import Image, ImageDraw

OUT = "public/cinema"
desk_src, phone_src, mug_src = sys.argv[1:4]

def rect(x0, y0, x1, y1): return [x0, y0, x1, y1]
def pct(r, W, H): return {"left": round(100*r[0]/W, 2), "top": round(100*r[1]/H, 2),
                          "width": round(100*(r[2]-r[0])/W, 2), "height": round(100*(r[3]-r[1])/H, 2)}
def key_out(im, bg, tol=28):
    """Make pixels within `tol` of `bg` transparent (pixel art keys cleanly)."""
    a = np.asarray(im.convert("RGBA")).astype(np.int32)
    d = np.abs(a[..., :3] - np.array(bg)).sum(-1)
    a[..., 3] = np.where(d <= tol, 0, 255)
    return Image.fromarray(a.astype(np.uint8))
def median_color(im, box, bright=None):
    """Median color in `box`; with bright=True/False only the lit / dark pixels (G above / below 110)."""
    px = np.asarray(im.crop(box).convert("RGB")).reshape(-1, 3)
    if bright is not None:
        px = px[(px[:, 1] > 110) == bright]
    return [int(v) for v in np.median(px, 0)]
def hexc(c): return "#%02x%02x%02x" % tuple(c)

# ---------------- desktop ----------------
desk = Image.open(desk_src).convert("RGB"); W, H = desk.size
# 256-colour quantise (no dither) keeps the pixel art clean and the lossless file small
def save_pixel(im, path):
    im.quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB").save(path, lossless=True, quality=100, method=6)
save_pixel(desk, f"{OUT}/desk.webp")
d_screen = rect(560, 220, 1098, 612)
d_hot = {
  "monitor": rect(505, 170, 1150, 745),
  "mug":     rect(290, 560, 480, 790),
  "lamp":    rect(130, 210, 385, 540),
  "books":   rect(40, 595, 292, 790),
  "notes":   rect(340, 190, 480, 450),
  "window":  rect(850, 0, 1500, 600),
  "plant":   rect(1395, 380, 1672, 800),
  "pencup":  rect(1270, 600, 1370, 745),
  "sticky":  rect(1150, 620, 1250, 755),
}

# screen colors, sampled from the art
screen_bg   = median_color(desk, (600, 420, 800, 530))          # empty glass area
text_green  = median_color(desk, (595, 285, 945, 315), bright=True)   # name letters
hi_bar      = median_color(desk, (900, 376, 1060, 396))         # highlighted ABOUT bar
hi_text     = median_color(desk, (880, 376, 985, 396), bright=False)  # dark text on the bar
bezel       = median_color(desk, (520, 640, 600, 660))

# moon/mountain illustration, keyed to transparency
art_box = (574, 364, 772, 528)
art = key_out(desk.crop(art_box), screen_bg, tol=40)
art.save(f"{OUT}/screen-art.png", optimize=True)

# ---------------- phone ----------------
phone = Image.open(phone_src).convert("RGB")
crop = (66, 130, 876, 1640)                     # inside the mockup, below the status bar
mob = phone.crop(crop); MW, MH = mob.size
save_pixel(mob, f"{OUT}/desk-mobile.webp")
ox, oy = crop[0], crop[1]
m_screen = rect(205-ox, 660-oy, 722-ox, 1092-oy)
m_hot = {
  "monitor": rect(160-ox, 600-oy, 760-ox, 1150-oy),
  "mug":     rect(95-ox, 1100-oy, 250-ox, 1310-oy),
  "lamp":    rect(66-ox, 440-oy, 270-ox, 620-oy),
  "sticky":  rect(660-ox, 1100-oy, 750-ox, 1215-oy),
  "window":  rect(540-ox, 130-oy, 820-ox, 600-oy),
}

# ---------------- mug icon ----------------
mug = Image.open(mug_src).convert("RGB")
mug_bg = median_color(mug, (0, 0, 40, 40))
key_out(mug, mug_bg, tol=30).save(f"{OUT}/mug.png", optimize=True)

manifest = {
  "colors": {"screenBg": hexc(screen_bg), "text": hexc(text_green), "highlight": hexc(hi_bar),
             "highlightText": hexc(hi_text), "bezel": hexc(bezel)},
  "screenArt": {"file": "screen-art.png", "width": art.width, "height": art.height},
  "desktop": {"image": "desk.webp", "size": {"width": W, "height": H},
              "screenPx": d_screen, "screenPct": pct(d_screen, W, H),
              "focalPoint": [round(100*(d_screen[0]+d_screen[2])/2/W, 2), round(100*(d_screen[1]+d_screen[3])/2/H, 2)],
              "hotspotsPct": {k: pct(v, W, H) for k, v in d_hot.items()}},
  "mobile":  {"image": "desk-mobile.webp", "size": {"width": MW, "height": MH},
              "screenPx": m_screen, "screenPct": pct(m_screen, MW, MH),
              "focalPoint": [round(100*(m_screen[0]+m_screen[2])/2/MW, 2), round(100*(m_screen[1]+m_screen[3])/2/MH, 2)],
              "hotspotsPct": {k: pct(v, MW, MH) for k, v in m_hot.items()}},
}
json.dump(manifest, open(f"{OUT}/manifest.json", "w"), indent=2)
print(json.dumps(manifest["colors"]), "desk", W, H, "mobile", MW, MH, "art", art.size)

# ---------------- review sheet ----------------
if len(sys.argv) > 4:
    def draw(im, screen, hot):
        im = im.copy(); d = ImageDraw.Draw(im)
        d.rectangle(screen, outline=(255, 0, 255), width=3)
        for k, r in hot.items(): d.rectangle(r, outline=(255, 220, 0), width=2); d.text((r[0]+4, r[1]+4), k, fill=(255, 220, 0))
        return im
    a = draw(desk, d_screen, d_hot); b = draw(mob, m_screen, m_hot)
    b = b.resize((int(b.width * a.height / b.height), a.height))
    checker = Image.new("RGB", (art.width + mug.width // 2 + 30, max(art.height, mug.height // 2) + 20), (140, 60, 160))
    checker.paste(art, (10, 10), art); mg = key_out(mug, mug_bg, 30).resize((mug.width // 2, mug.height // 2)); checker.paste(mg, (art.width + 20, 10), mg)
    sheet = Image.new("RGB", (a.width + b.width + 10, a.height + checker.height + 10), (0, 0, 0))
    sheet.paste(a, (0, 0)); sheet.paste(b, (a.width + 10, 0)); sheet.paste(checker, (0, a.height + 10))
    sheet.save(sys.argv[4])
