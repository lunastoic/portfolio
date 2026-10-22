// Dresses the finished v2 painting (public/cinema/desk.webp + manifest.json) into the room the scene shows.
// usage: node scripts/cinema-room.js        (cinema-blend.js runs this last, on the painting it just wrote)
//
// - room.webp, room.json: the painting with the wall behind the desk made plain (the painting's ledge along
//   it, the box behind the pencil cup and the old mug's steam go, so the desk stands against a flat wall),
//   then widened by WIDEN.left.d + WIDEN.right.d px of plain wall and desk, so
//   that a full-screen browser is covered by the painting itself and the shelf and the bookcase sit at its
//   edges. Each strip is cut in along a path that threads between the things in the room (left: between the
//   lamp, the notes and the mug and the monitor, then between the coaster and the keyboard; right: between
//   the poster and the bookcase, then between the mousepad and the tower) and carries the painting's colour at
//   the cut out into the room's ambient (the lamp's glow fading within a short way; the ledge and the desk
//   running straight across), with the wall's dither and the desk's streaks. room.json is manifest.json
//   with every box moved into the widened frame (manifest.json itself stays in the painting's frame for the
//   scripts before this one), plus the lamp-off and side images and the cuts, for the scene's own art-px.
// - desk-off.webp: the room with the desk lamp switched off, widened the same way. The lamp's light is
//   measured off the bare wall and desk against the room's ambient (the wall right of the monitor, the bare
//   desk by the tower), carried smoothly across the things it falls on, and divided out, so the cone on the
//   wall and the beam on the desk go with it; then the room drops a little darker and cooler, the monitor's
//   green reaches the desk in front of it, and the bulb sits dark in its shade.
// - side-left.png, side-right.png (and side-*-off.png for the lamp off): the room past the widened painting's
//   edges for windows wider still, built from its own pixels so it scales as crisply: the plain wall behind
//   the desk, the desk and its front carried on with their grain, and the things the edge cuts (the shelf, the
//   pegboard, the book stack, the bookcase, the tower, the book on the desk) ended a few px out.
const fs = require('fs'), path = require('path'), sharp = require('sharp');

const ROOT = path.join(__dirname, '..'), CIN = path.join(ROOT, 'public/cinema');
const W = 1672, H = 941, DESK = 772, FRONT = 890, SW = 900;

/**
 * Where the painting is cut and how much room goes in: per side, the rows [y0, y1) and the column the cut
 * runs down them (or from one column to another, slanting, where it has to step across between things),
 * threading between the things in the room, and the px of wall and desk put in there.
 */
const WIDEN = {
  left: { d: 130, path: [[0, 322, 450], [322, 346, 450, 536], [346, 772, 536], [772, 808, 495], [808, H, 486]] },
  right: { d: 130, path: [[0, 772, 1440], [772, H, 1412]] },
};
const WIDE_W = W + WIDEN.left.d + WIDEN.right.d;
const cutAt = (side, y) => {
  const [y0, y1, x0, x1] = WIDEN[side].path.find(([a, b]) => y >= a && y < b);
  return x1 == null ? x0 : Math.round(x0 + ((x1 - x0) * (y - y0)) / (y1 - y0));
};
/** A painting column's place in the widened frame, on row y. */
const mapX = (x, y) => x + (x >= cutAt('left', y) ? WIDEN.left.d : 0) + (x >= cutAt('right', y) ? WIDEN.right.d : 0);
/** From these rows down, what the cut runs through goes straight across (the desk and its front). */
const FLAT_FROM = { left: DESK, right: DESK };
/** A clean stretch of bare desk, right of the mousepad and short of the book by the tower. */
const DESK_REF = [1416, 1470];

const ss = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const idx = (x, y, w = W) => (y * w + x) * 3;
const avg = (b, x0, x1, y0, y1, w = W) => {
  const a = [0, 0, 0]; let n = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = idx(x, y, w); a[0] += b[i]; a[1] += b[i + 1]; a[2] += b[i + 2]; n++; }
  return a.map((v) => v / n);
};
/** A tidy hash in [-0.5, 0.5) for a little noise that is the same on every run. */
const hash = (x, y, s) => ((Math.imul((y * 7919 + x) * 3 + s, 2654435761) >>> 24) / 255) - 0.5;

/** Clean stretches to read the room's ambient off: the wall right of the monitor, the desk's back left of the
 *  mousepad (by the tower it is in its shadow), the bare desk by the tower; painting columns. */
const REF_COLS = { wall: [1300, 1340], deskBack: [1240, 1310], desk: DESK_REF };
/** The same stretches in the widened frame. */
const WIDE_COLS = { wall: REF_COLS.wall.map((x) => mapX(x, 300)), deskBack: REF_COLS.deskBack.map((x) => mapX(x, 780)), desk: REF_COLS.desk.map((x) => mapX(x, 800)) };

/** The room's ambient colour row by row, read off the clean stretches of wall and desk. */
function ambient(img, w = W, cols = REF_COLS) {
  const raw = new Float32Array(H * 3);
  for (let y = 0; y < H; y++) {
    let c;
    if (y < DESK) { const yy = Math.min(y, 556); c = avg(img, cols.wall[0], cols.wall[1], yy, yy + 2, w).map((v) => v * (y > 600 ? 1 - 0.1 * ss((y - 600) / 172) : 1)); }
    else if (y < 790) c = avg(img, cols.deskBack[0], cols.deskBack[1], y, y, w);
    else c = avg(img, cols.desk[0], cols.desk[1], y, y, w);
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
   The wall behind the desk
   ------------------------------------------------------------------------------------------------ */

/** The lamp's arm: two segments, base joint to elbow to the head's joint. */
const ARM = [[190, 560, 145, 435], [145, 435, 255, 300]];
const segDist = (px, py, x0, y0, x1, y1) => {
  const dx = x1 - x0, dy = y1 - y0, t = clamp(((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(px - x0 - t * dx, py - y0 - t * dy);
};

/**
 * The painting put a two-step ledge along the wall behind the desk, a box behind the pencil cup and the old
 * mug's steam; the desk should stand against a plain wall. From the book stack to the tower, the band from
 * `top` down to the desk becomes wall: the room's ambient wall, plus whatever extra light the wall just
 * above the band has (the lamp's, on the left), dying away down the band at the rate it dies away above
 * it, column by column (smoothed across, bridged across the poster's foot and the monitor). The monitor,
 * its foot and the keyboard stay; what the lava lamp hides goes with the rest; the cat cup, which sat on
 * the box, is set down onto the desk.
 */
const BACK = { x0: 60, x1: 1482, top: (x) => (x < 541 ? 548 : x < 1240 ? 566 : 492) };
/** Columns the old mug's steam drifts up (too faint to be caught as a thing): they take their neighbours. */
const STEAM = [395, 475];
/** The book stack: the band starts right of it on the rows it covers. */
const BOOKS = { x1: 262, y0: 602 };
const KEEP = [[541, 338, 1064, 762], [660, 755, 960, 785], [490, DESK, 1130, 870], [155, 545, 230, 612]];
const BLEND_ROWS = 10;
const CUP = { box: [292, 666, 372, 756], down: 20 };
function flatten(img) {
  const out = Buffer.from(img);
  const ref = ambient(img), amb = (y) => [ref[y * 3], ref[y * 3 + 1], ref[y * 3 + 2]];
  const lumAt = (x, y) => 0.299 * img[idx(x, y)] + 0.587 * img[idx(x, y) + 1] + 0.114 * img[idx(x, y) + 2];
  // per column: the wall's colour just above the band and its slope down the rows (a straight-line fit over
  // the 28 rows above), where those rows are plain wall
  const N = 28, above = new Array(W), slope = new Array(W), ok = new Uint8Array(W);
  for (let x = BACK.x0; x < BACK.x1; x++) {
    const t = BACK.top(x), y0 = t - 3 - N;
    let lo = 1e9, hi = -1e9;
    for (let y = y0; y < t - 3; y++) { const l = lumAt(x, y); if (l < lo) lo = l; if (l > hi) hi = l; }
    const poster = x >= 1085 && x < 1240, monitor = x >= 541 && x < 1064, steam = x >= STEAM[0] && x < STEAM[1];
    ok[x] = !poster && !monitor && !steam && hi - lo < 40 ? 1 : 0;
    // least squares over the window, per channel: value at the band's top and change per row
    const my = (N - 1) / 2; let sxx = 0;
    for (let k = 0; k < N; k++) sxx += (k - my) * (k - my);
    above[x] = [0, 0, 0]; slope[x] = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      let sum = 0, sxy = 0;
      for (let k = 0; k < N; k++) { const v = img[idx(x, y0 + k) + c]; sum += v; sxy += (k - my) * v; }
      const m = sxy / sxx, b = sum / N;
      slope[x][c] = m; above[x][c] = b + m * (N - 1 - my + 3); // carried to the band's top row
    }
  }
  // (across a wide gap, the monitor and the poster, each column takes its nearer plain neighbour rather
  //  than a blend of the lamp-lit wall on the left with the plain wall on the right)
  const bridge = (arr) => { for (let x = BACK.x0; x < BACK.x1; x++) if (!ok[x]) {
    let a = x, b = x; while (a > BACK.x0 && !ok[a]) a--; while (b < BACK.x1 - 1 && !ok[b]) b++;
    const wide = b - a > 120;
    const clear = (e, dir) => { const s = [0, 0, 0]; let n = 0; for (let k = e + dir * 12; n < 16 && k >= BACK.x0 && k < BACK.x1; k += dir) if (ok[k]) { for (let c = 0; c < 3; c++) s[c] += arr[k][c]; n++; } return n ? s.map((v) => v / n) : arr[e]; };
    const ca = ok[a] ? (wide ? clear(a, -1) : arr[a]) : arr[b], cb = ok[b] ? (wide ? clear(b, 1) : arr[b]) : arr[a];
    const t = !(ok[a] && ok[b] && b > a) ? (ok[a] ? 0 : 1) : wide ? (x - a < b - x ? 0 : 1) : (x - a) / (b - a);
    arr[x] = ca.map((v, c) => lerp(v, cb[c], t));
  } };
  bridge(above); bridge(slope);
  const smooth = (arr) => { const o = arr.slice(); for (let x = BACK.x0; x < BACK.x1; x++) { const s = [0, 0, 0]; let n = 0; for (let k = Math.max(BACK.x0, x - 16); k <= Math.min(BACK.x1 - 1, x + 16); k++) { for (let c = 0; c < 3; c++) s[c] += arr[k][c]; n++; } o[x] = s.map((v) => v / n); } return o; };
  const A = smooth(above), S = smooth(slope);
  const keep = (x, y) => KEEP.some(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1) || (x < BOOKS.x1 && y >= BOOKS.y0) || ARM.some(([x0, y0, x1, y1]) => segDist(x, y, x0, y0, x1, y1) < 16);
  // the extra light over the ambient dies away at the rate the slope says (never faster than over 80 rows),
  // the rate smoothed across the columns
  const tau = new Array(W).fill(600);
  for (let x = BACK.x0; x < BACK.x1; x++) {
    const a0 = amb(BACK.top(x)), extra = A[x].map((v, c) => v - a0[c]);
    const eLum = 0.299 * extra[0] + 0.587 * extra[1] + 0.114 * extra[2], sLum = 0.299 * S[x][0] + 0.587 * S[x][1] + 0.114 * S[x][2];
    tau[x] = eLum > 2 && sLum < -0.02 ? clamp(eLum / -sLum, 80, 600) : 600;
  }
  const T = tau.slice(); for (let x = BACK.x0; x < BACK.x1; x++) { let s = 0, n = 0; for (let k = Math.max(BACK.x0, x - 20); k <= Math.min(BACK.x1 - 1, x + 20); k++) { s += tau[k]; n++; } T[x] = s / n; }
  for (let x = BACK.x0; x < BACK.x1; x++) {
    const t = BACK.top(x), a0 = amb(t), extra = A[x].map((v, c) => v - a0[c]);
    for (let y = t; y < DESK; y++) {
      if (keep(x, y)) continue;
      const a = amb(y), f = Math.exp(-(y - t) / T[x]), o = idx(x, y), w = ss((y - t + 1) / BLEND_ROWS);
      for (let c = 0; c < 3; c++) out[o + c] = clamp(Math.round(lerp(img[o + c], a[c] + extra[c] * f + hash(x, y, 11 + c) * 4, w)), 0, 255);
    }
  }
  // the cat cup, down onto the desk
  const [cx0, cy0, cx1, cy1] = CUP.box;
  for (let y = cy1 - 1; y >= cy0; y--) img.copy(out, idx(cx0, y + CUP.down), idx(cx0, y), idx(cx1, y));
  return out;
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
];

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
  const LIT = [[204, 250, 412, 462, 0.6], [290, 660, 370, 800, 0.55]];
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
 * The painting's grain, lifted off its clean stretches: the wall's fine dither (tiled out mirrored, so it
 * never seams) and the desk's streaks, which run on along their rows. `k` counts across the new wall.
 */
function grainOf(img, w, cols) {
  const px = (x, y) => { const i = idx(clamp(x, 0, w - 1), clamp(y, 0, H - 1), w); return [img[i], img[i + 1], img[i + 2]]; };
  const [wx0, wx1] = cols.wall, wn = wx1 - wx0, [dx0, dx1] = cols.desk;
  const wallMean = Array.from({ length: H }, (_, y) => avg(img, wx0, wx1 - 1, y, y, w));
  const deskMean = Array.from({ length: H }, (_, y) => avg(img, dx0, dx1, y, y, w));
  const streak = deskMean.map((m, y) => { const a = avg(img, dx0, dx1, Math.max(DESK, y - 6), Math.min(H - 1, y + 6), w); return m.map((v, c) => v - a[c]); });
  return (k, y) => {
    if (y >= DESK) return streak[y].map((v) => v * 0.8 + hash(k, y, 3) * 4);
    const yy = y <= 556 ? y : 1112 - y, m = k % (2 * wn), j = m < wn ? m : 2 * wn - 1 - m;
    return px(wx0 + j, yy).map((v, c) => v - wallMean[yy][c]);
  };
}

/* ------------------------------------------------------------------------------------------------
   Room put into the painting
   ------------------------------------------------------------------------------------------------ */

/** The painting with WIDEN's strips of wall and desk cut in. */
function widen(src) {
  const out = Buffer.alloc(WIDE_W * H * 3);
  const ref = ambient(src), amb = (y) => [ref[y * 3], ref[y * 3 + 1], ref[y * 3 + 2]];
  for (let y = 0; y < H; y++) {
    let o = y * WIDE_W * 3, x = 0;
    for (const side of ['left', 'right']) {
      const cut = cutAt(side, y), d = WIDEN[side].d;
      src.copy(out, o, idx(x, y), idx(cut, y)); o += (cut - x) * 3; x = cut;
      // the strip: the painting's colour either side of the cut, carried across. Up the wall the lamp's
      // extra light (over the room's ambient) fades out within a short way, so between the lamp and the
      // monitor the wall settles to the room's own colour; where the cut runs through the ledge or the
      // desk, one side blends straight into the other. Left of the monitor there's only the one side.
      // The strip's colour runs from the painting's colour just left of the cut to the colour just right
      // of it (what's left of the monitor has only the one side); up the wall both fade toward the room's
      // ambient on the way, so the lamp's extra light dies out within a short way, while across the ledge
      // and the desk one blends straight into the other. Over that goes the painting's own dither from
      // right beside the cut (whichever side is the plainer there), tiled mirrored, so the texture meets
      // without a seam. An outline that happens to sit by the cut is kept out of the colours.
      const a = amb(y), flat = y >= FLAT_FROM[side], P = 12;
      const one = side === 'left' && y >= 330 && y < 772;
      const px = (x) => { const i = idx(clamp(x, 0, W - 1), y); return [src[i], src[i + 1], src[i + 2]]; };
      const lumAt = (x) => { const [r, g, b] = px(x); return 0.299 * r + 0.587 * g + 0.114 * b; };
      const cleanAvg = (x0, x1) => {
        const xs = []; for (let x = x0; x <= x1; x++) xs.push(x);
        const ls = xs.map(lumAt).sort((p, q) => p - q), med = ls[ls.length >> 1];
        const keep = xs.filter((x) => Math.abs(lumAt(x) - med) <= 18);
        return keep.reduce((acc, x) => { const c = px(x); return acc.map((v, i) => v + c[i] / keep.length); }, [0, 0, 0]);
      };
      const range = (x0, x1) => { let lo = 1e9, hi = -1e9; for (let x = x0; x <= x1; x++) { const l = lumAt(x); if (l < lo) lo = l; if (l > hi) hi = l; } return hi - lo; };
      const useRight = !one && range(cut, cut + P - 1) < range(cut - P, cut - 1);
      const gx0 = useRight ? cut : cut - P;
      // the dither is what's left after a straight-line fit across the sample columns is taken off (a slope in
      // the wall's colour would otherwise tile into stripes)
      const fit = [0, 1, 2].map((c) => { let sy = 0, sxy = 0; const mx = (P - 1) / 2; let sxx = 0; for (let j = 0; j < P; j++) { const v = px(gx0 + j)[c]; sy += v; sxy += (j - mx) * v; sxx += (j - mx) * (j - mx); } return [sy / P, sxy / sxx, mx]; });
      const plainWall = range(gx0, gx0 + P - 1) < 8; // flat wall has no dither worth tiling: plain noise instead
      const grainAt = (k) => { if (plainWall) return [0, 1, 2].map((i) => hash(k + cut, y, 21 + i) * 5); const m = k % (2 * P), j = m < P ? m : 2 * P - 1 - m, x = useRight ? gx0 + j : gx0 + P - 1 - j; return px(x).map((v, i) => clamp(v - (fit[i][0] + fit[i][1] * (x - gx0 - fit[i][2])), -14, 14)); };
      const L = cleanAvg(cut - 8, cut - 1), R = one ? null : cleanAvg(cut, cut + 7);
      for (let k = 0; k < d; k++) {
        const s = k / (d - 1), g = grainAt(k), n = hash(k + cut, y, 5) * 1.5;
        let c;
        if (flat) c = R ? L.map((v, i) => lerp(v, R[i], s)) : L;
        else {
          const fl = L.map((v, i) => a[i] + (v - a[i]) * Math.exp(-k / 140));
          const fr = R ? R.map((v, i) => a[i] + (v - a[i]) * Math.exp(-(d - 1 - k) / 140)) : fl;
          c = fl.map((v, i) => lerp(v, fr[i], R ? s : 0));
        }
        for (let i = 0; i < 3; i++) out[o + i] = clamp(Math.round(c[i] + g[i] + n), 0, 255);
        o += 3;
      }
    }
    src.copy(out, o, idx(x, y), idx(W, y));
  }
  return out;
}

/** manifest.json's boxes and points, moved into the widened frame. */
function roomManifest(m) {
  const isPctBox = (v) => v && typeof v === 'object' && ['left', 'top', 'width', 'height'].every((k) => typeof v[k] === 'number');
  const pctBox = (b) => {
    const x = (b.left / 100) * W, y = ((b.top + b.height / 2) / 100) * H;
    return { ...b, left: +((mapX(x, y) / WIDE_W) * 100).toFixed(3), width: +(((b.width / 100) * W / WIDE_W) * 100).toFixed(3) };
  };
  const pxBox = ([x0, y0, x1, y1]) => { const d = mapX(x0, (y0 + y1) / 2) - x0; return [x0 + d, y0, x1 + d, y1]; };
  const pt = ([x, y]) => [+((mapX((x / 100) * W, (y / 100) * H) / WIDE_W) * 100).toFixed(2), y];
  const walk = (v, key) => {
    if (Array.isArray(v)) {
      if (/Px$/.test(key) && v.length === 4) return pxBox(v);
      if (key === 'focalPoint' || key === 'from' || key === 'to') return pt(v);
      return v.map((e) => walk(e, key));
    }
    if (isPctBox(v)) return pctBox(v);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, e]) => [k, walk(e, k)]));
    return v;
  };
  const r = walk(m, '');
  // the pens stand in the cat cup, which flatten() set down onto the desk
  for (const k of ['boxPct', 'hitPct']) r.pens[k] = { ...r.pens[k], top: +(r.pens[k].top + (CUP.down / H) * 100).toFixed(3) };
  r.image = 'room.webp';
  r.size = { width: WIDE_W, height: H };
  r.widen = WIDEN;
  return r;
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

function sides(src, w, cols) {
  const ref = ambient(src, w, cols);
  const amb = (y) => [ref[y * 3], ref[y * 3 + 1], ref[y * 3 + 2]];
  const grain = grainOf(src, w, cols);
  const files = {};
  for (const side of ['left', 'right']) {
    const out = Buffer.alloc(SW * H * 3);
    const ex = side === 'left' ? 0 : w - 1;
    const X = (k) => (side === 'left' ? SW - 1 - k : k); // k counts out from the painting
    const put = (k, y, c) => { const o = (y * SW + X(k)) * 3; out[o] = clamp(Math.round(c[0]), 0, 255); out[o + 1] = clamp(Math.round(c[1]), 0, 255); out[o + 2] = clamp(Math.round(c[2]), 0, 255); };
    const px = (x, y) => { const i = idx(clamp(x, 0, w - 1), clamp(y, 0, H - 1), w); return [src[i], src[i + 1], src[i + 2]]; };
    /** The painting's column `j` in from the edge, mirrored back and forth over `n` columns. */
    const tile = (k, n) => { const m = k % (2 * n), j = m < n ? m : 2 * n - 1 - m; return side === 'left' ? j : w - 1 - j; };
    const zone = (y) => (y < DESK ? [0, DESK - 1] : y < FRONT ? [DESK, FRONT - 1] : [FRONT, H - 1]);

    // how much lighter or darker the painting's edge is than the room's ambient, row by row: read off the
    // plain rows, bridged across the cut things within the wall, the desk and its front (the wall meets the
    // desk in a step), then softened down the rows so the lamp's light on the left wall carries out past the
    // edge as one glow rather than as bands
    const plain = new Uint8Array(H), lift = new Array(H);
    for (const [a, b] of PLAIN[side]) for (let y = a; y <= b; y++) {
      plain[y] = 1;
      const e = avg(src, side === 'left' ? 0 : w - 6, side === 'left' ? 5 : w - 1, y, y, w);
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
const saveWebp = async (buf, w, file) => {
  const q = await sharp(buf, { raw: { width: w, height: H, channels: 3 } }).png({ palette: true, colours: 256, dither: 0 }).toBuffer();
  await sharp(q).webp({ lossless: true, effort: 6 }).toFile(file + '.tmp');
  fs.renameSync(file + '.tmp', file);
};

/** Everything, from the finished painting (a raw RGB buffer, W×H) and manifest.json; writes room.json. */
async function run(img) {
  const m = JSON.parse(fs.readFileSync(path.join(CIN, 'manifest.json'), 'utf8'));
  const flat = flatten(img);
  const off = relight(flat, m.screenPx);
  const room = widen(flat), roomOff = widen(off);
  await saveWebp(room, WIDE_W, path.join(CIN, 'room.webp'));
  await saveWebp(roomOff, WIDE_W, path.join(CIN, 'desk-off.webp'));
  for (const [src, suffix] of [[room, ''], [roomOff, '-off']]) {
    const s = sides(src, WIDE_W, WIDE_COLS);
    for (const side of ['left', 'right']) await savePalette(s[side], SW, H, path.join(CIN, `side-${side}${suffix}.png`), 128);
  }
  const r = roomManifest(m);
  r.lamp.off = '/cinema/desk-off.webp';
  delete r.lamp.shade;
  r.sides = { px: SW, left: '/cinema/side-left.png', right: '/cinema/side-right.png', leftOff: '/cinema/side-left-off.png', rightOff: '/cinema/side-right-off.png' };
  fs.writeFileSync(path.join(CIN, 'room.json'), JSON.stringify(r, null, 2) + '\n');
}

module.exports = { run, flatten, relight, widen, sides, WIDEN, WIDE_W };

if (require.main === module) {
  (async () => {
    const img = await sharp(path.join(CIN, 'desk.webp')).removeAlpha().raw().toBuffer();
    await run(img);
    console.log('done');
  })();
}
