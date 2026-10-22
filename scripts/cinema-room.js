// Dresses the finished v2 painting (public/cinema/desk.webp) for the room around it.
// usage: node scripts/cinema-room.js        (cinema-blend.js runs this last, on the painting it just wrote)
//
// - desk-off.webp: the painting with the desk lamp switched off. The lamp's light is measured off the
//   bare wall and desk against the room's ambient (the wall right of the monitor, the bare desk by the
//   tower), carried smoothly across the things it falls on, and divided out, so the cone on the wall and
//   the beam on the desk go with it; then the room drops a little darker and cooler, the monitor's green
//   reaches the desk in front of it, and the bulb sits dark in its shade.
// - side-left.png, side-right.png (and side-*-off.png for the lamp off): the room past the painting's
//   edges for wide windows, built from the painting's own pixels so it scales as crisply: the plain wall
//   behind the desk, the desk and its front carried on with their grain, the lamp's light on the left
//   fading out with distance, and the things the edge cuts (the shelf, the pegboard, the book stack, the
//   bookcase, the tower, the book on the desk) ended a few px out so only the wall goes on.
const fs = require('fs'), path = require('path'), sharp = require('sharp');

const ROOT = path.join(__dirname, '..'), CIN = path.join(ROOT, 'public/cinema');
const W = 1672, H = 941, DESK = 772, FRONT = 890, SW = 900;
/** A clean stretch of bare desk, right of the mousepad and short of the book by the tower. */
const DESK_REF = [1416, 1470];

const ss = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const idx = (x, y) => (y * W + x) * 3;
const avg = (b, x0, x1, y0, y1) => {
  const a = [0, 0, 0]; let n = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = idx(x, y); a[0] += b[i]; a[1] += b[i + 1]; a[2] += b[i + 2]; n++; }
  return a.map((v) => v / n);
};
/** A tidy hash in [-0.5, 0.5) for a little noise that is the same on every run. */
const hash = (x, y, s) => ((Math.imul((y * 7919 + x) * 3 + s, 2654435761) >>> 24) / 255) - 0.5;

/** The room's ambient colour row by row: the wall right of the monitor, the bare desk beside the tower. */
function ambient(img) {
  const raw = new Float32Array(H * 3);
  for (let y = 0; y < H; y++) {
    let c;
    if (y < DESK) { const yy = Math.min(y, 556); c = avg(img, 1300, 1340, yy, yy + 2).map((v) => v * (y > 556 ? 1 - 0.18 * ss((y - 556) / 216) : 1)); }
    // the desk's back rows by the tower are in its shadow: read them left of the mousepad instead
    else if (y < 790) c = avg(img, 1240, 1310, y, y);
    else c = avg(img, DESK_REF[0], DESK_REF[1], y, y);
    raw[y * 3] = c[0]; raw[y * 3 + 1] = c[1]; raw[y * 3 + 2] = c[2];
  }
  // smoothed down the rows (the bare wall and desk end up exactly this, so it mustn't step)
  const ref = new Float32Array(H * 3);
  for (let y = 0; y < H; y++) {
    const r = y < DESK ? 4 : 10, y0 = Math.max(y < DESK ? 0 : DESK, y - r), y1 = Math.min(y < DESK ? DESK - 1 : H - 1, y + r);
    for (let c = 0; c < 3; c++) { let s = 0; for (let k = y0; k <= y1; k++) s += raw[k * 3 + c]; ref[y * 3 + c] = s / (y1 - y0 + 1); }
  }
  return ref;
}

/* ------------------------------------------------------------------------------------------------
   The lamp off
   ------------------------------------------------------------------------------------------------ */

/** Things in the room that are neither bare wall nor bare desk (the light is not read off them). */
const THINGS = [
  [0, 0, 262, 215], // the shelf, its books and the camera
  [0, 195, 190, 515], // the pegboard and the headphones
  [0, 590, 262, 790], // the book stack
  [204, 250, 412, 462], // the lamp's head
  [160, 550, 225, 610], // the lamp's base
  [492, 7, 1115, 322], // the decks
  [548, 338, 1064, 772], // the monitor and its stand
  [1085, 365, 1230, 565], // the poster
  [290, 640, 370, 780], // the cat cup
  [520, 740, 745, 805], // the coaster
  [30, 785, 430, 880], // the notebook
  [730, 760, 1130, 865], // the keyboard
  [1095, 790, 1400, 875], // the mousepad
  [1550, 790, 1672, 850], // the book on the desk
  [700, 740, 900, 780], // the monitor's foot
  [1110, 566, 1214, 774], // the lava lamp's spot
  [440, 560, 1480, 700], // the ledge along the wall behind the desk
];
/** The lamp's arm: two segments, base joint to elbow to the head's joint. */
const ARM = [[190, 560, 145, 435], [145, 435, 255, 300]];
const segDist = (px, py, x0, y0, x1, y1) => {
  const dx = x1 - x0, dy = y1 - y0, t = clamp(((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(px - x0 - t * dx, py - y0 - t * dy);
};

/**
 * Solve for a smooth field over the cells that have no reading, holding the cells that do: a coarse
 * pass first so the wide gaps (the monitor) settle, then the fine one. The wall and the desk are
 * solved apart (no light bleeds across the desk's back edge).
 */
function fillField(vals, known, w, h, barrier, iters, seeded) {
  const zoneOf = (y) => (y < barrier ? 0 : 1);
  // without a start, every unknown cell takes the mean of the known ones in its zone
  for (let z = 0; z < 2 && !seeded; z++) {
    const sum = [0, 0, 0]; let n = 0;
    for (let y = 0; y < h; y++) if (zoneOf(y) === z) for (let x = 0; x < w; x++) if (known[y * w + x]) { for (let c = 0; c < 3; c++) sum[c] += vals[(y * w + x) * 3 + c]; n++; }
    for (let y = 0; y < h; y++) if (zoneOf(y) === z) for (let x = 0; x < w; x++) if (!known[y * w + x]) for (let c = 0; c < 3; c++) vals[(y * w + x) * 3 + c] = n ? sum[c] / n : 1;
  }
  const omega = 1.85;
  for (let it = 0; it < iters; it++) {
    const fwd = it % 2 === 0;
    for (let yy = 0; yy < h; yy++) {
      const y = fwd ? yy : h - 1 - yy, z = zoneOf(y);
      for (let xx = 0; xx < w; xx++) {
        const x = fwd ? xx : w - 1 - xx, i = y * w + x;
        if (known[i]) continue;
        for (let c = 0; c < 3; c++) {
          let s = 0, n = 0;
          if (x > 0) { s += vals[(i - 1) * 3 + c]; n++; }
          if (x < w - 1) { s += vals[(i + 1) * 3 + c]; n++; }
          if (y > 0 && zoneOf(y - 1) === z) { s += vals[(i - w) * 3 + c]; n++; }
          if (y < h - 1 && zoneOf(y + 1) === z) { s += vals[(i + w) * 3 + c]; n++; }
          if (n) vals[i * 3 + c] += omega * (s / n - vals[i * 3 + c]);
        }
      }
    }
  }
}

function relight(img, screen, debug) {
  const ref = ambient(img);
  const lum = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) lum[i] = 0.299 * img[i * 3] + 0.587 * img[i * 3 + 1] + 0.114 * img[i * 3 + 2];
  const flat = (x, y) => {
    let lo = 1e9, hi = -1e9;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const v = lum[clamp(y + dy, 0, H - 1) * W + clamp(x + dx, 0, W - 1)];
      if (v < lo) lo = v; if (v > hi) hi = v;
    }
    return hi - lo <= 40;
  };
  const warm = (x, y) => { const i = idx(x, y); return img[i] > img[i + 1] + 8 && img[i + 1] >= img[i + 2] && img[i] > 1.25 * img[i + 2]; };
  const inThing = (x, y) => THINGS.some(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1) || ARM.some(([x0, y0, x1, y1]) => segDist(x, y, x0, y0, x1, y1) < 18);

  // how much brighter (per channel) the lamp makes each bare pixel than the room's ambient
  const gain = new Float32Array(W * H * 3).fill(1), known = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (x >= 1470) { known[i] = 1; continue; } // the far side of the room is the reference
    if (inThing(x, y) || !warm(x, y) || !flat(x, y)) continue;
    const m = avg(img, Math.max(0, x - 1), Math.min(W - 1, x + 1), Math.max(0, y - 1), Math.min(H - 1, y + 1));
    for (let c = 0; c < 3; c++) gain[i * 3 + c] = clamp(m[c] / Math.max(1, ref[y * 3 + c]), 0.8, 8);
    known[i] = 1;
  }

  // carry the light across the things it falls on: a smooth field through the readings, at 1/4 and
  // first at 1/16 (so the big gaps settle), the wall and the desk apart
  const solve = (q, iters, init) => {
    const w = Math.ceil(W / q), h = Math.ceil(H / q), vals = new Float32Array(w * h * 3), ck = new Uint8Array(w * h), n = new Uint16Array(w * h);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!known[i]) continue;
      const ci = ((y / q) | 0) * w + ((x / q) | 0);
      for (let c = 0; c < 3; c++) vals[ci * 3 + c] += gain[i * 3 + c];
      n[ci]++;
    }
    // a cell counts as read when at least half its pixels were (a stray reading or two off the edge
    // of something won't do)
    for (let ci = 0; ci < w * h; ci++) if (n[ci] >= (q * q) / 2) { ck[ci] = 1; for (let c = 0; c < 3; c++) vals[ci * 3 + c] /= n[ci]; }
    else if (init) { n[ci] = 0; for (let c = 0; c < 3; c++) vals[ci * 3 + c] = 0; const s = init.vals, sw = init.w, sh = init.h, r = init.q / q; const sx = Math.min(sw - 1, ((ci % w) / r) | 0), sy = Math.min(sh - 1, (((ci / w) | 0) / r) | 0); for (let c = 0; c < 3; c++) vals[ci * 3 + c] = s[(sy * sw + sx) * 3 + c]; }
    fillField(vals, ck, w, h, Math.round(DESK / q), iters, !!init);
    return { vals, w, h, q, ck };
  };
  const coarse = solve(16, 1500);
  const fine = solve(4, 500, coarse);
  const sample = (x, y) => {
    const { vals, w, h, q } = fine, barrier = Math.round(DESK / q);
    const fx = clamp(x / q - 0.5, 0, w - 1), fy0 = y < DESK ? 0 : barrier, fy1 = y < DESK ? barrier - 1 : h - 1;
    const fy = clamp(y / q - 0.5, fy0, fy1);
    const x0 = fx | 0, y0 = fy | 0, x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(fy1, y0 + 1), tx = fx - x0, ty = fy - y0;
    const out = [0, 0, 0];
    for (let c = 0; c < 3; c++) out[c] = lerp(lerp(vals[(y0 * w + x0) * 3 + c], vals[(y0 * w + x1) * 3 + c], tx), lerp(vals[(y1 * w + x0) * 3 + c], vals[(y1 * w + x1) * 3 + c], tx), ty);
    return out;
  };

  // the room with the lamp out: the lamp's share divided out, a little darker and cooler all over,
  // the monitor's green on the desk and the keyboard in front of it, the glass left to the live screen
  if (debug) { debug.known = known; debug.gain = new Float32Array(W * H * 3); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, g = known[i] ? [gain[i * 3], gain[i * 3 + 1], gain[i * 3 + 2]] : sample(x, y); debug.gain.set(g, i * 3); } }
  const DIM = [0.74, 0.71, 0.78], GLOW = [4, 30, 13];
  // the shade's brass and the cat cup are painted lit from the bulb, which the wall round them doesn't
  // show: each is what its outline closes off inside its box (the wall floods in from the box's edge)
  const LIT = [[204, 250, 412, 462, 0.6], [290, 640, 370, 780, 0.55]];
  const litBy = new Float32Array(W * H).fill(1);
  for (const [x0, y0, x1, y1, f] of LIT) {
    const bw = x1 - x0, bh = y1 - y0, wall = new Uint8Array(bw * bh), stack = [];
    for (let x = 0; x < bw; x++) stack.push(x, 0, x, bh - 1);
    for (let y = 0; y < bh; y++) stack.push(0, y, bw - 1, y);
    while (stack.length) {
      const y = stack.pop(), x = stack.pop(), i = y * bw + x;
      if (x < 0 || y < 0 || x >= bw || y >= bh || wall[i] || lum[(y0 + y) * W + x0 + x] < 30) continue;
      wall[i] = 1;
      stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
    }
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (!wall[y * bw + x]) litBy[(y0 + y) * W + x0 + x] = f;
  }
  const [gx0, gy0, gx1, gy1] = screen;
  const off = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, o = i * 3;
    const g = known[i] ? [gain[o], gain[o + 1], gain[o + 2]] : sample(x, y);
    const d = Math.hypot((x - 803) / 560, (y - 560) / 430), glow = Math.pow(Math.max(0, 1 - d), 1.6);
    const gd = Math.min(x - gx0, gx1 - x, y - gy0, gy1 - y), glass = gd > 0 ? Math.min(1, gd / 24) : 0;
    // inside the shade's mouth the bulb and the lit rim go dark
    const ex = (x - 306) / 96, ey = (y - 404) / 38, L = lum[i];
    const bulb = ex * ex + ey * ey <= 1 && L >= 110 ? Math.min(1, (L - 110) / 120) : -1;
    const extra = litBy[i];
    for (let c = 0; c < 3; c++) {
      let v = (img[o + c] / g[c]) * extra * DIM[c] + GLOW[c] * glow;
      if (bulb >= 0) v = img[o + c] * (0.16 + 0.2 * (1 - bulb)) * [0.9, 0.8, 0.95][c] + [4, 2, 6][c];
      off[o + c] = Math.round(clamp(lerp(v, img[o + c], glass), 0, 255));
    }
  }
  return off;
}

/* ------------------------------------------------------------------------------------------------
   The room past the painting's edges
   ------------------------------------------------------------------------------------------------ */

/**
 * Rows at each edge that end on plain wall, desk or desk front. The rest is something the edge cuts
 * through (the shelf, the pegboard and the book stack on the left; the bookcase, the tower and the book
 * on the desk on the right): it runs on a few px past the edge to its outline, and the wall and desk go
 * on beyond it.
 */
const PLAIN = { left: [[0, 129], [509, 604], [786, H - 1]], right: [[0, 79], [849, H - 1]] };
const CUT = 6;

function sides(src, suffix) {
  const ref = ambient(src);
  const amb = (y) => [ref[y * 3], ref[y * 3 + 1], ref[y * 3 + 2]];
  const files = {};
  for (const side of ['left', 'right']) {
    const out = Buffer.alloc(SW * H * 3);
    const ex = side === 'left' ? 0 : W - 1;
    const X = (k) => (side === 'left' ? SW - 1 - k : k); // k counts out from the painting
    const put = (k, y, c) => { const o = (y * SW + X(k)) * 3; out[o] = clamp(Math.round(c[0]), 0, 255); out[o + 1] = clamp(Math.round(c[1]), 0, 255); out[o + 2] = clamp(Math.round(c[2]), 0, 255); };
    const px = (x, y) => { const i = idx(clamp(x, 0, W - 1), clamp(y, 0, H - 1)); return [src[i], src[i + 1], src[i + 2]]; };
    /** The painting's column `j` in from the edge, mirrored back and forth over `n` columns. */
    const tile = (k, n) => { const m = k % (2 * n), j = m < n ? m : 2 * n - 1 - m; return side === 'left' ? j : W - 1 - j; };
    const zone = (y) => (y < DESK ? [0, DESK - 1] : y < FRONT ? [DESK, FRONT - 1] : [FRONT, H - 1]);

    // how much lighter or darker the painting's edge is than the room's ambient, row by row: read off the
    // plain rows, bridged across the cut things within the wall, the desk and its front (the wall meets the
    // desk in a step), then softened down the rows so the lamp's light on the left wall carries out past the
    // edge as one glow rather than as bands
    const plain = new Uint8Array(H), lift = new Array(H);
    for (const [a, b] of PLAIN[side]) for (let y = a; y <= b; y++) {
      plain[y] = 1;
      const e = avg(src, side === 'left' ? 0 : W - 6, side === 'left' ? 5 : W - 1, y, y);
      lift[y] = e.map((v, c) => v / Math.max(1, amb(y)[c]));
    }
    for (let y = 0; y < H; y++) if (!plain[y]) {
      const [z0, z1] = zone(y);
      let a = y, b = y; while (a > z0 && !plain[a]) a--; while (b < z1 && !plain[b]) b++;
      const ta = plain[a] ? lift[a] : lift[b], tb = plain[b] ? lift[b] : lift[a], t = plain[a] && plain[b] && b > a ? (y - a) / (b - a) : plain[a] ? 0 : 1;
      lift[y] = ta.map((v, c) => lerp(v, tb[c], t));
    }
    const blurRows = (rows) => rows.map((_, y) => {
      const [z0, z1] = zone(y), y0 = Math.max(z0, y - 50), y1 = Math.min(z1, y + 50), s = [0, 0, 0];
      for (let k = y0; k <= y1; k++) for (let c = 0; c < 3; c++) s[c] += rows[k][c];
      return s.map((v) => v / (y1 - y0 + 1));
    });
    const soft = blurRows(blurRows(lift));

    // the painting's grain, lifted off clean stretches of wall and desk: the wall's fine dither is
    // tiled out (mirrored, so it never seams); the desk's streaks of grain run on along their rows
    const rowMean = (x0, n) => Array.from({ length: H }, (_, y) => avg(src, x0, x0 + n - 1, y, y));
    const wallMean = rowMean(1300, 40), deskMean = rowMean(DESK_REF[0], DESK_REF[1] - DESK_REF[0] + 1);
    const streak = deskMean.map((m, y) => { const a = avg(src, DESK_REF[0], DESK_REF[1], Math.max(DESK, y - 6), Math.min(H - 1, y + 6)); return m.map((v, c) => v - a[c]); });
    const grain = (k, y) => {
      if (y >= DESK) return streak[y].map((v) => v * 0.8 + hash(k, y, 3) * 4);
      const yy = y <= 556 ? y : 1112 - y, m = k % 80, j = m < 40 ? m : 79 - m;
      return px(1300 + j, yy).map((v, c) => v - wallMean[yy][c]);
    };
    const dim = (k) => 1 - 0.3 * ss((k - 120) / (SW - 120));

    for (let y = 0; y < H; y++) {
      const e = px(ex, y), a = amb(y);
      for (let k = 0; k < SW; k++) {
        // the lamp's extra light fades out within a short way; shadow (the edge darker than the room) stays
        const fade = Math.exp(-k / 140), g = grain(k, y), d = dim(k);
        const base = a.map((v, c) => (v * (soft[y][c] > 1 ? 1 + (soft[y][c] - 1) * fade : soft[y][c]) + g[c]) * d + hash(k, y, side === 'left' ? 1 : 7) * 3);
        if (plain[y]) put(k, y, base.map((v, c) => lerp(e[c], v, ss(k / 8))));
        else if (k < CUT) put(k, y, px(tile(k, CUT), y).map((v) => v * d)); // the cut thing runs on a little
        else if (k < CUT + 2) put(k, y, [6, 3, 2]); // to its outline
        else put(k, y, base.map((v) => v * (k < CUT + 8 ? 0.82 + 0.03 * (k - CUT - 2) : 1))); // a touch of shadow beside it
      }
    }
    files[side] = out;
  }
  return files;
}

/* ------------------------------------------------------------------------------------------------ */

const savePalette = (buf, w, h, file, colours) => sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png({ palette: true, colours, dither: 0 }).toFile(file);

/** Everything, from the finished painting (a raw RGB buffer, W×H). Rewrites the manifest's entries. */
async function run(img) {
  const mf = path.join(CIN, 'manifest.json'), m = JSON.parse(fs.readFileSync(mf, 'utf8'));
  const off = relight(img, m.screenPx);
  const q = await sharp(off, { raw: { width: W, height: H, channels: 3 } }).png({ palette: true, colours: 256, dither: 0 }).toBuffer();
  await sharp(q).webp({ lossless: true, effort: 6 }).toFile(path.join(CIN, 'desk-off.webp.tmp'));
  fs.renameSync(path.join(CIN, 'desk-off.webp.tmp'), path.join(CIN, 'desk-off.webp'));
  for (const [src, suffix] of [[img, ''], [off, '-off']]) {
    const s = sides(src, suffix);
    for (const side of ['left', 'right']) await savePalette(s[side], SW, H, path.join(CIN, `side-${side}${suffix}.png`), 128);
  }
  m.lamp.off = '/cinema/desk-off.webp';
  delete m.lamp.shade;
  m.sides = { px: SW, left: '/cinema/side-left.png', right: '/cinema/side-right.png', leftOff: '/cinema/side-left-off.png', rightOff: '/cinema/side-right-off.png' };
  fs.writeFileSync(mf, JSON.stringify(m, null, 2) + '\n');
}

module.exports = { run, relight, sides };

if (require.main === module) {
  (async () => {
    const img = await sharp(path.join(CIN, 'desk.webp')).removeAlpha().raw().toBuffer();
    await run(img);
    console.log('done');
  })();
}
