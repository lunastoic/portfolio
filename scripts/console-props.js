// The gaming corner added to the painted v2 room: an Xbox One, its controller, a headset on a wall hook and the
// headset's cable, each its own sprite (public/cinema/prop-*.png) laid over the painting like the mug and plant.
// usage: node scripts/console-props.js        (cinema-room.js runs it last, after it writes room.json)
//
// The console, controller and headset are lifted from the mockup (scripts/art/mockup.png, 1339 x 756), where
// they're drawn as the real things: cut along outlines traced by hand (mockup px), with the lava lamp's pink
// glow taken off (the lava lamp stands on the other side of them here), scaled to the props' grid (a chunky
// draft at 4 art px a pixel, saved at 2 art px a pixel) and doubled with the outer outline kept to its inner
// half, exactly as the mug, notes and plant were. The cable is drawn: a dark cord down the wall behind the
// plant, along the desk to the controller. Their boxes go into room.json as `decor`, back to front.
const fs = require('fs'), path = require('path'), sharp = require('sharp');

const ROOT = path.join(__dirname, '..'), CIN = path.join(ROOT, 'public/cinema');
const MOCKUP = path.join(ROOT, 'scripts/art/mockup.png');

const ell = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const inPoly = (x, y, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };

/** Where each piece stands in the room (art px: left, top, width) and where it comes from in the mockup. */
const PIECES = [
  {
    name: 'headset', at: [1612, 252, 128], z: 3,
    box: [1192, 114, 1322, 322],
    inside: (x, y) => (x >= 1248 && x <= 1270 && y >= 118 && y <= 152) ||
      (y < 230 && ell(x, y, 1262, 216, 47, 73) && !ell(x, y, 1262, 222, 30, 66)) ||
      ell(x, y, 1229, 261, 33, 39.5) || ell(x, y, 1287, 262, 32, 40) ||
      (x >= 1269 && x <= 1278 && y >= 296 && y <= 318),
  },
  {
    name: 'xbox', at: [1352, 698, 248], z: 3,
    box: [996, 564, 1246, 660],
    inside: (x, y) => inPoly(x, y, [[999, 600], [1012, 574], [1150, 573], [1222, 590], [1242, 599], [1242, 657], [999, 657]]),
  },
  {
    name: 'controller', at: [1592, 806, 148], z: 6,
    box: [1128, 648, 1302, 738],
    inside: (x, y) => inPoly(x, y, [[1152, 668], [1166, 659], [1185, 654], [1200, 657], [1215, 661], [1245, 661], [1262, 656], [1279, 661], [1289, 673], [1295, 690], [1297, 710], [1295, 724], [1288, 731], [1275, 733], [1263, 726], [1250, 709], [1232, 701], [1205, 700], [1186, 703], [1171, 713], [1157, 727], [1146, 731], [1137, 728], [1134, 715], [1136, 696], [1143, 681]]),
  },
];

const savePng = (buf, w, h, file) => sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png().toFile(file);

/** Cut a piece out of the mockup and give it the props' chunky treatment; returns its sprite size in px. */
async function lift({ name, at: [, , artW], box: [mx0, my0, mx1, my1], inside }) {
  const w = mx1 - mx0, h = my1 - my0;
  const src = await sharp(MOCKUP).removeAlpha().extract({ left: mx0, top: my0, width: w, height: h }).raw().toBuffer();
  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    let r = src[i * 3], g = src[i * 3 + 1], b = src[i * 3 + 2];
    // the lava lamp's pink, off the plastic: back to a neutral dark of the same brightness
    if (r > g * 1.35 && b > g * 1.25) { const l = 0.3 * r + 0.59 * g + 0.11 * b; r = g = b = l * 0.8; }
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = inside(mx0 + x + 0.5, my0 + y + 0.5) ? 255 : 0;
  }
  // the draft (4 art px a pixel), then doubled to the sprite (2 art px a pixel)
  const dw = Math.round(artW / 4), dh = Math.round((artW / 4) * (h / w));
  const d = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).resize(dw, dh, { kernel: 'lanczos3' }).raw().toBuffer();
  const A = (i, j) => i >= 0 && j >= 0 && i < dw && j < dh && d[(j * dw + i) * 4 + 3] >= 128;
  const W = dw * 2, H = dh * 2, px = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = x >> 1, j = y >> 1, si = (j * dw + i) * 4, o = (y * W + x) * 4;
    if (!A(i, j)) continue;
    let r = d[si], g = d[si + 1], b = d[si + 2];
    if (!A(i + 1, j) || !A(i - 1, j) || !A(i, j + 1) || !A(i, j - 1)) {
      const ox = x & 1 ? 1 : -1, oy = y & 1 ? 1 : -1;
      if (!A(i + ox, j) || !A(i, j + oy)) continue; // the outline keeps only its inner half
      r *= 0.35; g *= 0.3; b *= 0.3;
    }
    px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
  }
  await savePng(px, W, H, path.join(CIN, `prop-${name}.png`));
  return [W, H];
}

/** The headset's cable: from the right cup's plug down the wall behind the plant, along the desk to the controller. */
async function cable() {
  const pts = [[1692, 452], [1694, 520], [1698, 620], [1702, 720], [1706, 772], [1716, 790], [1728, 802], [1722, 814]];
  const x0 = 1680, y0 = 444, W = 60, H = 380, px = Buffer.alloc((W / 2) * (H / 2) * 4);
  const put = (X, Y, v) => { const i = Math.round((X - x0) / 2), j = Math.round((Y - y0) / 2); if (i < 0 || j < 0 || i >= W / 2 || j >= H / 2) return; const o = (j * (W / 2) + i) * 4; px[o] = v; px[o + 1] = v * 0.9; px[o + 2] = v * 0.95; px[o + 3] = 255; };
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, ay] = pts[k], [bx, by] = pts[k + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay));
    for (let t = 0; t <= n; t++) { const X = ax + ((bx - ax) * t) / n, Y = ay + ((by - ay) * t) / n; put(X, Y, 34); put(X + 2, Y, 14); }
  }
  await savePng(px, W / 2, H / 2, path.join(CIN, 'prop-headset-cable.png'));
  return { file: '/cinema/prop-headset-cable.png', box: [x0, y0, W, H], z: 3 };
}

async function run() {
  const mf = path.join(CIN, 'room.json'), m = JSON.parse(fs.readFileSync(mf, 'utf8')), { width: RW, height: RH } = m.size;
  const pct = (x, y, w, h) => ({ left: +((x / RW) * 100).toFixed(3), top: +((y / RH) * 100).toFixed(3), width: +((w / RW) * 100).toFixed(3), height: +((h / RH) * 100).toFixed(3) });
  const decor = [];
  const c = await cable();
  decor.push({ name: 'headset-cable', file: c.file, boxPct: pct(...c.box), z: c.z });
  for (const p of PIECES) {
    const [W, H] = await lift(p);
    const [x, y] = p.at;
    decor.push({ name: p.name, file: `/cinema/prop-${p.name}.png`, boxPct: pct(x, y, W * 2, H * 2), z: p.z });
  }
  m.decor = decor;
  fs.writeFileSync(mf, JSON.stringify(m, null, 2) + '\n');
}

module.exports = { run };
if (require.main === module) run().then(() => console.log('done'));
