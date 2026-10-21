// Repairs the v2 desk painting around the props and cuts the pieces the scene animates.
// usage: node scripts/cinema-blend.js [reviewDir]
//
// Input: scripts/art/desk-base.webp (the painting with the props lifted out), output: public/cinema/desk.webp.
// - restores the lamp head and its beam from the original painting (scripts/art/desk-original.webp),
//   so the head is painted in place again and nothing outlines it
// - rebuilds the warm-lit wall, the PC tower's edge and the desk behind the pixel plant
//   (rows filled across for the wall and desk, columns filled down for the tower edge)
// - cuts the three pens out of the painted pencil cup and fills the wall behind them
// - writes the lamp head with its bulb out, and the shadow the lamp leaves when it's off
const fs = require('fs'), path = require('path'), sharp = require('sharp');

const ROOT = path.join(__dirname, '..'), CIN = path.join(ROOT, 'public/cinema');
const REVIEW = process.argv[2];
const W = 1672, H = 941;
const SCREEN = JSON.parse(fs.readFileSync(path.join(CIN, 'manifest.json'), 'utf8')).screenPx;

const raw = async (file) => sharp(file).removeAlpha().raw().toBuffer();
const lum = (b, i) => 0.299 * b[i * 3] + 0.587 * b[i * 3 + 1] + 0.114 * b[i * 3 + 2];

/** Fill `mask` (Uint8Array, 1 = fill) inside box by linear interpolation between the
 *  nearest known pixels on each row (dir 'row') or each column (dir 'col'), plus a little grain. */
function fill(img, mask, [x0, y0, x1, y1], dir, seed = 1) {
  const rnd = (i) => { let h = (i * 2654435761 + seed * 97) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; return (h & 255) / 255 - 0.5; };
  const outer = dir === 'row' ? [y0, y1] : [x0, x1], inner = dir === 'row' ? [x0, x1] : [y0, y1];
  for (let a = outer[0]; a <= outer[1]; a++) {
    const at = (b) => (dir === 'row' ? a * W + b : b * W + a);
    let b = inner[0];
    while (b <= inner[1]) {
      if (!mask[at(b)]) { b++; continue; }
      let e = b; while (e + 1 <= inner[1] && mask[at(e + 1)]) e++;
      // average a few known pixels either side, so a single dark outline pixel doesn't smear across
      const side = (from, step) => {
        const acc = [0, 0, 0]; let n = 0;
        for (let k = 0, p = from; k < 4 && p >= inner[0] && p <= inner[1]; p += step) if (!mask[at(p)]) { const i = at(p); acc[0] += img[i * 3]; acc[1] += img[i * 3 + 1]; acc[2] += img[i * 3 + 2]; n++; k++; }
        return n ? acc.map(v => v / n) : null;
      };
      let L = side(b - 1, -1), R = side(e + 1, 1);
      if (!L) L = R; if (!R) R = L;
      for (let p = b; p <= e && L; p++) {
        const t = (p - b + 1) / (e - b + 2), i = at(p), g = rnd(i) * 6;
        for (let c = 0; c < 3; c++) img[i * 3 + c] = Math.max(0, Math.min(255, L[c] + (R[c] - L[c]) * t + g));
      }
      b = e + 1;
    }
  }
}

function dilate(mask, r) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!mask[y * W + x]) continue;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const X = x + dx, Y = y + dy;
      if (X >= 0 && Y >= 0 && X < W && Y < H && dx * dx + dy * dy <= r * r) out[Y * W + X] = 1;
    }
  }
  return out;
}

/** Pixels not reachable from the box's top/left/right edges without crossing a dark outline. */
function enclosed(img, [x0, y0, x1, y1], dark) {
  const seen = new Uint8Array(W * H), stack = [];
  const isLine = (i) => lum(img, i) < dark;
  for (let x = x0; x <= x1; x++) stack.push(y0 * W + x);
  for (let y = y0; y <= y1; y++) stack.push(y * W + x0, y * W + x1);
  while (stack.length) {
    const i = stack.pop(); if (seen[i] || isLine(i)) continue;
    const x = i % W, y = (i / W) | 0; if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    seen[i] = 1; stack.push(i - 1, i + 1, i - W, i + W);
  }
  const m = new Uint8Array(W * H);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!seen[y * W + x]) m[y * W + x] = 1;
  return m;
}

const savePng = (buf, w, h, ch, file) => sharp(buf, { raw: { width: w, height: h, channels: ch } }).png().toFile(file);

(async () => {
  const img = await raw(path.join(__dirname, 'art/desk-base.webp'));
  const orig = await raw(path.join(__dirname, 'art/desk-original.webp'));

  // ---- lamp: the painted head and its beam, feathered back in ----
  const LAMP = [196, 244, 412, 464], F = 6;
  for (let y = LAMP[1] - F; y <= LAMP[3] + F; y++) for (let x = LAMP[0] - F; x <= LAMP[2] + F; x++) {
    const d = Math.min(x - (LAMP[0] - F), (LAMP[2] + F) - x, y - (LAMP[1] - F), (LAMP[3] + F) - y);
    const t = Math.min(1, d / F), i = y * W + x;
    for (let c = 0; c < 3; c++) img[i * 3 + c] = Math.round(img[i * 3 + c] * (1 - t) + orig[i * 3 + c] * t);
  }

  // ---- plant: the original wall/tower/desk with the painted plant filled out ----
  const PB = [1226, 490, 1546, 796];
  // the painted plant's whole footprint: the foliage, its lower leaves, the pot and the saucer
  const pm = new Uint8Array(W * H);
  const inEll = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  for (let y = PB[1]; y <= PB[3]; y++) for (let x = PB[0]; x <= PB[2]; x++) {
    if (inEll(x, y, 1385, 615, 160, 124) || inEll(x, y, 1380, 702, 150, 58) || inEll(x, y, 1396, 782, 80, 13)
      || (y >= 640 && y <= 780 && x >= 1324 && x <= 1468)) pm[y * W + x] = 1;
  }
  // the original lights that wall as if a second lamp stood there; bring it back down to the
  // wall's ambient level as scripts/cinema-props.py does, so the desk lamp stays the room's one light
  // (a scale toward a target level: where the wall is already at it, nothing changes)
  const tone = (img) => {
    const [GX0, GX1, GY0, GY1] = [1064, 1500, 200, 700], AMBIENT = 46, FALLOFF = 0.1;
    const gw = GX1 - GX0, gh = GY1 - GY0, L = new Float32Array(gw * gh), M = new Float32Array(gw * gh);
    const skip = [[1088, 355, 1224, 600], [1098, 590, 1224, 700], [1476, 200, 1500, 700]];
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const X = x + GX0, Y = y + GY0, l = lum(img, Y * W + X);
      const wall = l > 28 && !skip.some(([a, b, c, d]) => X >= a && X < c && Y >= b && Y < d);
      L[y * gw + x] = wall ? l : 0; M[y * gw + x] = wall ? 1 : 0;
    }
    // three box passes ≈ a gaussian
    const box = (a, r) => {
      const t = new Float32Array(a.length);
      for (let y = 0; y < gh; y++) { let s = 0; for (let x = -r; x <= r; x++) s += a[y * gw + Math.min(gw - 1, Math.max(0, x))]; for (let x = 0; x < gw; x++) { t[y * gw + x] = s / (2 * r + 1); s += a[y * gw + Math.min(gw - 1, x + r + 1)] - a[y * gw + Math.max(0, x - r)]; } }
      for (let x = 0; x < gw; x++) { let s = 0; for (let y = -r; y <= r; y++) s += t[Math.min(gh - 1, Math.max(0, y)) * gw + x]; for (let y = 0; y < gh; y++) { a[y * gw + x] = s / (2 * r + 1); s += t[Math.min(gh - 1, y + r + 1) * gw + x] - t[Math.max(0, y - r) * gw + x]; } }
    };
    for (let k = 0; k < 3; k++) { box(L, 16); box(M, 16); }
    const ss = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const G = L[y * gw + x] / Math.max(M[y * gw + x], 1e-3), X = x + GX0, Y = y + GY0;
      const target = AMBIENT * (1 - FALLOFF * x / gw);
      const F = Math.min(1, Math.max(0.35, target / Math.max(G, 1)));
      const win = ss(y / 60) * ss((gh - y) / 60) * ss((gw - x) / 30);
      const f = 1 + (F - 1) * win, i = Y * W + X;
      for (let c = 0; c < 3; c++) img[i * 3 + c] = Math.round(img[i * 3 + c] * f);
    }
  };

  const base = Buffer.from(orig);
  tone(base);
  const TOWER = 1474; // columns right of this hold the tower's vertical edge
  const wallMask = new Uint8Array(W * H), towerMask = new Uint8Array(W * H);
  for (let y = PB[1]; y <= PB[3]; y++) for (let x = PB[0]; x <= PB[2]; x++) {
    const i = y * W + x; if (!pm[i]) continue;
    if (x >= TOWER && y < 770) towerMask[i] = 1; else wallMask[i] = 1;
  }
  fill(base, towerMask, [TOWER, PB[1] - 8, PB[2] + 8, 790], 'col', 3);
  fill(base, wallMask, [PB[0] - 10, PB[1], TOWER + 30, PB[3]], 'row', 5);
  // the old fill reached well past the plant (up the wall, beside the poster), so that whole
  // stretch comes back from the toned original, feathered into what's round it
  const WALL = [1150, 236, 1566, 806], WF = 10;
  for (let y = WALL[1]; y <= WALL[3]; y++) for (let x = WALL[0]; x <= WALL[2]; x++) {
    if ((x >= 1088 && x < 1224 && y >= 355 && y < 600) || (x >= 1098 && x < 1224 && y >= 590 && y < 770)) continue;
    const d = Math.min(x - WALL[0], WALL[2] - x, y - WALL[1], WALL[3] - y), t = Math.min(1, d / WF), i = y * W + x;
    for (let c = 0; c < 3; c++) img[i * 3 + c] = Math.round(img[i * 3 + c] * (1 - t) + base[i * 3 + c] * t);
  }

  // ---- pens in the cat pencil cup: cut out, fill the wall behind ----
  // the pens are ringed by near-black outlines; the wall round them is a dim brown (lum ≈ 50)
  const PEN = [1124, 593, 1212, 660];
  const pen = enclosed(img, PEN, 18);
  // three pens, split by their axes (bottom x → top x)
  const AX = [[1142, 1137], [1166, 1176], [1192, 1200]];
  const penOf = (x, y) => {
    let best = 0, bd = 1e9;
    AX.forEach(([xb, xt], k) => { const t = (y - PEN[1]) / (PEN[3] - PEN[1]), ax = xt + (xb - xt) * t, d = Math.abs(x - ax); if (d < bd) { bd = d; best = k; } });
    return best;
  };
  // all three share one canvas the size of PEN, so they stack back in place with no offsets
  for (let k = 0; k < 3; k++) {
    const pw = PEN[2] - PEN[0] + 1, ph = PEN[3] - PEN[1] + 1, buf = Buffer.alloc(pw * ph * 4);
    for (let y = PEN[1]; y <= PEN[3]; y++) for (let x = PEN[0]; x <= PEN[2]; x++) {
      const i = y * W + x; if (!pen[i] || penOf(x, y) !== k) continue;
      const o = ((y - PEN[1]) * pw + (x - PEN[0])) * 4;
      buf[o] = img[i * 3]; buf[o + 1] = img[i * 3 + 1]; buf[o + 2] = img[i * 3 + 2]; buf[o + 3] = 255;
    }
    await savePng(buf, pw, ph, 4, path.join(CIN, `sprite-pen-${k + 1}.png`));
  }
  fill(img, dilate(pen, 1), [PEN[0] - 8, PEN[1] - 2, PEN[2] + 8, PEN[3]], 'row', 9);

  // ---- lettering: the painting's own words go; the scene sets real type in their place ----
  // decks: each lettering box is filled down its columns from the face just above and below it
  const block = (boxes) => { const m = new Uint8Array(W * H); for (const [x0, y0, x1, y1] of boxes) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m[y * W + x] = 1; return m; };
  for (const [x0, y0, x1, y1] of [[596, 82, 998, 130], [634, 217, 994, 253]]) fill(img, block([[x0, y0, x1, y1]]), [x0, y0 - 4, x1, y1 + 4], 'col', 19);
  // the decks' painted rims wander (ragged edges, a gap at the nose, drips by the brackets), so each
  // deck is redrawn from its outline's box as a clean stadium: dark outline, a maple edge lit along
  // the top and shaded under, the flat face, a soft shadow on the wall; the brackets go back on top
  {
    const DECKS = [{ box: [492, 25, 1114, 175] }, { box: [494, 189, 1114, 341] }];
    const BRACKETS = [641, 945].flatMap(x => [[19, 50], [150, 183], [297, 331]].map(([y0, y1]) => [x, y0, x + 22, y1]));
    const src = Buffer.from(img);
    for (const d of DECKS) {
      const [x0, y0, x1, y1] = d.box, cy = (y0 + y1) / 2, R = (y1 - y0) / 2;
      d.dist = (x, y) => { const cx = Math.min(Math.max(x + 0.5, x0 + R), x1 + 1 - R); return Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - R; };
      d.normal = (x, y) => { const cx = Math.min(Math.max(x + 0.5, x0 + R), x1 + 1 - R), dx = x + 0.5 - cx, dy = y + 0.5 - cy, l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
      // the face colour, read well inside the deck
      const count = new Map();
      for (let y = cy - 10; y <= cy + 10; y++) for (let x = x0 + 150; x <= x1 - 150; x += 3) {
        const i = (y * W + x) * 3, k = (src[i] << 16) | (src[i + 1] << 8) | src[i + 2]; count.set(k, (count.get(k) || 0) + 1);
      }
      const k = [...count].sort((a, b) => b[1] - a[1])[0][0];
      d.face = [k >> 16, (k >> 8) & 255, k & 255];
    }
    const RX0 = 470, RY0 = 10, RX1 = 1140, RY1 = 350;
    const inBracket = (x, y) => BRACKETS.some(([a, b, c, e]) => x >= a && x <= c && y >= b && y <= e);
    // 1. the wall behind each deck and wherever its old rim and drips reached, rebuilt across from the
    //    wall either side (the decks are drawn over it after, so none of the old rim leaks into the fill)
    const wallMask = new Uint8Array(W * H);
    for (let y = RY0; y <= RY1; y++) for (let x = RX0; x <= RX1; x++) if (DECKS.some(d => d.dist(x, y) < 12)) wallMask[y * W + x] = 1;
    fill(img, wallMask, [RX0 - 12, RY0, RX1 + 12, RY1], 'row', 23);
    // 2. the shadow each deck throws down and right onto the wall
    for (let y = RY0; y <= RY1; y++) for (let x = RX0; x <= RX1; x++) {
      if (DECKS.some(d => d.dist(x, y) <= 0)) continue;
      const s = Math.min(...DECKS.map(d => d.dist(x - 3, y - 5)));
      if (s >= 4) continue;
      const k = s < 0 ? 0.6 : 0.6 + 0.4 * (s / 4), i = (y * W + x) * 3;
      for (let c = 0; c < 3; c++) img[i + c] = Math.round(img[i + c] * k);
    }
    // 3. the decks
    const RIM_LIT = [244, 160, 78], RIM = [214, 108, 36], RIM_SHADE = [150, 66, 20], LINE = [22, 10, 5];
    const mix = (a, b, t) => a.map((v, c) => v + (b[c] - v) * t);
    for (const d of DECKS) {
      const [x0, y0, x1, y1] = d.box;
      for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) {
        const t = -d.dist(x, y); if (t < 0) continue;
        let col;
        if (t < 2.6) col = LINE;
        else if (t < 9.5) {
          // the edge faces outward: lit where it faces up-left, shaded where it faces down-right
          const [nx, ny] = d.normal(x, y), lit = -(nx * 0.35 + ny * 0.94);
          col = lit > 0 ? mix(RIM, RIM_LIT, Math.min(1, lit * 1.3)) : mix(RIM, RIM_SHADE, Math.min(1, -lit * 1.2));
          if (t < 3.6) col = mix(col, RIM_LIT, lit > 0.3 ? 0.35 : 0);
        } else if (t < 10.6) col = mix(d.face, LINE, 0.55);
        else col = mix(d.face, [0, 0, 0], 0.1 * Math.max(0, 1 - (t - 10.6) / 14));
        const i = (y * W + x) * 3;
        for (let c = 0; c < 3; c++) img[i + c] = Math.round(col[c]);
      }
    }
    // 4. the brackets, back on top: each one's outline and what it encloses
    for (const [a, b, c, e] of BRACKETS) {
      const inner = enclosed(src, [a - 2, b - 2, c + 2, e + 2], 30), keep = dilate(inner, 2);
      for (let y = b - 2; y <= e + 2; y++) for (let x = a - 2; x <= c + 2; x++) {
        const i = y * W + x; if (!keep[i] || !inBracket(x, y)) continue;
        for (let k = 0; k < 3; k++) img[i * 3 + k] = src[i * 3 + k];
      }
    }
  }

  // poster, book spines, the shelf's spines
  const POSTER = [[1107, 375, 1210, 532]], BOOKS = [[60, 618, 128, 652], [62, 660, 140, 692], [64, 698, 216, 740], [64, 736, 236, 780]];
  const SHELF = [[1586, 168, 1606, 290], [1628, 190, 1652, 286]];
  // the poster's panel is flat and dark between bright frame lines (x 1100, 1212): each row of the
  // text area takes the colour of that row's own left margin, which never had letters
  {
    const [px0, py0, px1, py1] = POSTER[0];
    for (let y = py0; y <= py1; y++) {
      const ref = [0, 0, 0];
      for (let x = 1102; x <= 1106; x++) for (let c = 0; c < 3; c++) ref[c] += img[(y * W + x) * 3 + c] / 5;
      for (let x = px0; x <= px1; x++) {
        const i = y * W + x, g = ((Math.imul(i, 2654435761) >>> 24) / 255 - 0.5) * 4;
        for (let c = 0; c < 3; c++) img[i * 3 + c] = Math.max(0, Math.min(255, Math.round(ref[c] + g)));
      }
    }
  }
  // the spines are shaded across and lit warm; a letter is well above its row's spine colour
  const bookMask = new Uint8Array(W * H);
  for (const [x0, y0, x1, y1] of BOOKS) for (let y = y0; y <= y1; y++) {
    const ls = []; for (let x = x0; x <= x1; x++) ls.push(lum(img, y * W + x));
    const med = ls.slice().sort((a, b) => a - b)[ls.length >> 1];
    for (let x = x0; x <= x1; x++) if (lum(img, y * W + x) > med + 38 && img[(y * W + x) * 3] > 130) bookMask[y * W + x] = 1;
  }
  // grown by 3 so each letter's dark outline goes with it
  fill(img, dilate(bookMask, 3), [56, 614, 242, 784], 'row', 13);
  // the shelf's spines stand upright: fill their text columns top to bottom
  fill(img, block(SHELF), [1580, 164, 1658, 294], 'col', 17);

  // 256 colours, saved lossless, like the rest of the painting's pipeline (about 410 KB)
  const quant = await sharp(img, { raw: { width: W, height: H, channels: 3 } }).png({ palette: true, colours: 256, dither: 0 }).toBuffer();
  await sharp(quant).webp({ lossless: true, effort: 6 }).toFile(path.join(CIN, 'desk.webp.tmp'));
  fs.renameSync(path.join(CIN, 'desk.webp.tmp'), path.join(CIN, 'desk.webp'));

  // ---- the lamp with its bulb out: the head crop, bright warm pixels pulled down ----
  const HB = [204, 250, 408, 462], hw = HB[2] - HB[0] + 1, hh = HB[3] - HB[1] + 1;
  const off = Buffer.alloc(hw * hh * 4);
  for (let y = HB[1]; y <= HB[3]; y++) for (let x = HB[0]; x <= HB[2]; x++) {
    const i = y * W + x, o = ((y - HB[1]) * hw + (x - HB[0])) * 4, L = lum(img, i);
    // inside the shade's mouth: an ellipse round the bulb and lit rim
    const ex = (x - 306) / 96, ey = (y - 404) / 38, inMouth = ex * ex + ey * ey <= 1;
    if (!inMouth || L < 110) continue;
    const k = Math.min(1, (L - 110) / 120);
    const r = img[i * 3], g = img[i * 3 + 1], b = img[i * 3 + 2];
    const dim = 0.32 + 0.3 * (1 - k);
    off[o] = Math.round(r * dim * 0.9); off[o + 1] = Math.round(g * dim * 0.82); off[o + 2] = Math.round(b * dim * 0.9 + 6);
    off[o + 3] = Math.round(255 * Math.min(1, 0.4 + k));
  }
  await savePng(off, hw, hh, 4, path.join(CIN, 'lamp-off.png'));

  // ---- the shade the room falls into with the lamp off (quarter res, scaled up smooth) ----
  const q = 4, sw = W / q | 0, sh = Math.ceil(H / q), shade = Buffer.alloc(sw * sh * 4);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const X = x * q, Y = y * q;
    const bulb = Math.max(0, 1 - Math.hypot((X - 306) / 330, (Y - 400) / 300));
    // the beam: down and right from the mouth, onto the books, mug and desk
    const bx = (X - 360) / 300, by = (Y - 640) / 210, beam = Math.max(0, 1 - Math.hypot(bx, by));
    // the monitor makes its own light: leave its glass alone
    const [gx0, gy0, gx1, gy1] = SCREEN, gd = Math.min(X - gx0, gx1 - X, Y - gy0, gy1 - Y);
    const glass = gd > 0 ? Math.min(1, gd / 24) : 0;
    const a = Math.min(1, 1.15 * Math.pow(bulb, 0.9) + 0.9 * Math.pow(beam, 1.1)) * (1 - glass);
    const o = (y * sw + x) * 4;
    shade[o] = 22; shade[o + 1] = 14; shade[o + 2] = 26; shade[o + 3] = Math.round(255 * a * 0.62);
  }
  await savePng(shade, sw, sh, 4, path.join(CIN, 'lamp-shade.png'));

  // ---- the pixel props, brought into the painting's hand ----
  // drawn at 2× (2 art px per pixel instead of 4), the outer outline thinned to one pixel
  // and graded toward the room's warm light: lit from the upper left, falling off low and right
  const refine = async (src, dst, { warm = [1, 0.9, 0.74], lift = 0, shadow = 0.28, sat = 0.82 } = {}) => {
    const { data, info } = await sharp(path.join(ROOT, 'public', src)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = info.width * 2, h = info.height * 2, out = Buffer.alloc(w * h * 4);
    const A = (x, y) => (x < 0 || y < 0 || x >= info.width || y >= info.height ? 0 : data[(y * info.width + x) * 4 + 3]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const sx = x >> 1, sy = y >> 1, si = (sy * info.width + sx) * 4, o = (y * w + x) * 4;
      if (!data[si + 3]) continue;
      let r = data[si], g = data[si + 1], b = data[si + 2];
      const dark = 0.299 * r + 0.587 * g + 0.114 * b < 34;
      // an outline pixel on the silhouette keeps only its inner half
      if (dark && data[si + 3] > 200) {
        const ox = x & 1 ? 1 : -1, oy = y & 1 ? 1 : -1;
        if (A(sx + ox, sy) < 128 || A(sx, sy + oy) < 128) continue;
      }
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + (r - gray) * sat; g = gray + (g - gray) * sat; b = gray + (b - gray) * sat;
      const fall = 1 - shadow * Math.min(1, Math.max(0, 0.55 * (x / w) + 0.65 * (y / h) - 0.25));
      out[o] = Math.min(255, r * warm[0] * fall + lift); out[o + 1] = Math.min(255, g * warm[1] * fall + lift);
      out[o + 2] = Math.min(255, b * warm[2] * fall + lift); out[o + 3] = data[si + 3];
    }
    await savePng(out, w, h, 4, path.join(CIN, dst));
  };
  await refine('props/plant-forest-terracotta-pot.png', 'prop-plant-pot.png', { warm: [1, 0.86, 0.7], shadow: 0.34 });
  await refine('props/plant-forest-terracotta-leaves.png', 'prop-plant-leaves.png', { warm: [1.02, 0.86, 0.62], shadow: 0.34, sat: 0.78 });
  await refine('props/mug-forest.png', 'prop-mug.png', { warm: [1, 0.92, 0.8], shadow: 0.2, sat: 0.9 });
  for (let n = 1; n <= 7; n++) await refine(`props/sticky-${n}.png`, `prop-sticky-${n}.png`, { warm: [1, 0.93, 0.82], shadow: 0.16, sat: 0.92 });

  // ---- what the scene needs to know about all this ----
  const mf = path.join(CIN, 'manifest.json'), m = JSON.parse(fs.readFileSync(mf, 'utf8'));
  const pct = ([x0, y0, x1, y1]) => ({ left: +(x0 / W * 100).toFixed(3), top: +(y0 / H * 100).toFixed(3), width: +((x1 - x0) / W * 100).toFixed(3), height: +((y1 - y0) / H * 100).toFixed(3) });
  delete m.props['lamp-head'];
  m.props.mug.file = '/cinema/prop-mug.png';
  m.props['plant-pot'].file = '/cinema/prop-plant-pot.png';
  m.props['plant-leaves'].file = '/cinema/prop-plant-leaves.png';
  m.props.note.file = '/cinema/prop-sticky-1.png';
  m.notes = Array.from({ length: 7 }, (_, i) => `/cinema/prop-sticky-${i + 1}.png`);
  m.lamp = {
    off: { file: '/cinema/lamp-off.png', boxPct: pct([HB[0], HB[1], HB[2] + 1, HB[3] + 1]) },
    shade: '/cinema/lamp-shade.png',
    hitPct: pct([206, 252, 386, 456]),
  };
  m.pens = {
    files: [1, 2, 3].map(k => `/cinema/sprite-pen-${k}.png`),
    boxPct: pct([PEN[0], PEN[1], PEN[2] + 1, PEN[3] + 1]),
    originPct: AX.map(([xb]) => [+((xb - PEN[0]) / (PEN[2] - PEN[0] + 1) * 100).toFixed(2), 100]),
    hitPct: pct([1106, 590, 1218, 770]),
  };
  fs.writeFileSync(mf, JSON.stringify(m, null, 2) + '\n');

  if (REVIEW) {
    await sharp(img, { raw: { width: W, height: H, channels: 3 } }).png().toFile(path.join(REVIEW, 'desk-fixed.png'));
    await savePng(Buffer.from(pm.map(v => v * 255)), W, H, 1, path.join(REVIEW, 'plant-mask.png'));
    await savePng(Buffer.from(pen.map(v => v * 255)), W, H, 1, path.join(REVIEW, 'pen-mask.png'));
  }
  console.log('done');
})();
