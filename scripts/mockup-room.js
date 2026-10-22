// The v2 room, laid out after the mockup (scripts/art/mockup.png, 1339 x 756): a desk fitted wall to wall in a
// closet, the table lamp on the left, the decks over the monitor on its three books, the plant, the Xbox, the
// lava lamp, the headset on its hook on the right. The mockup is painted in the room's own style, so it is the
// backdrop itself, scaled to art px (K art px per mockup px), with what the scene makes live taken out of it:
// - the lettering on the decks and the book spines (the scene sets real type there),
// - the mug, the sticky note, the plant and the lava lamp (the scene's sprites stand in their places),
// each region filled from the wall or desk round it (a smooth fill solved from its edges, the wall and the desk
// kept apart along the desk's back edge, with the wall's grain added back).
// Writes room.webp (lamp on), desk-off.webp (lamp off), side-left/right(-off).png (the closet's side walls and
// the desk carried on for very wide windows) and room.json (every box the scene reads, in art px).
// usage: node scripts/mockup-room.js
const fs = require('fs'), path = require('path'), sharp = require('sharp');

const ROOT = path.join(__dirname, '..'), CIN = path.join(ROOT, 'public/cinema');
const MOCKUP = path.join(ROOT, 'scripts/art/mockup.png');
const K = 1.2, MW = 1339, MH = 756, W = Math.round(MW * K), H = Math.round(MH * K), SW = 540;
const DESK_Y = 630; // the desk's back edge, mockup px

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hash = (x, y, s) => ((Math.imul((y * 7919 + x) * 3 + s, 2654435761) >>> 24) / 255) - 0.5;
const inPoly = (x, y, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const ell = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const rect = (x, y, x0, y0, x1, y1) => x >= x0 && x < x1 && y >= y0 && y < y1;

/** The Xbox (kept even where the plant and the lava lamp stood in front of it). */
const XBOX = [[985, 566], [1236, 566], [1244, 600], [1244, 656], [998, 656], [998, 600]];
/** What the scene makes live, as regions in mockup px. `split` fills the wall and the desk apart. */
const CLEAR = [
  // the lettering on the decks and the three spines
  { name: 'deck-1', inside: (x, y) => rect(x, y, 456, 30, 846, 110) },
  { name: 'deck-2', inside: (x, y) => rect(x, y, 426, 160, 874, 226) },
  { name: 'book-1', inside: (x, y) => rect(x, y, 517, 568, 656, 588) },
  { name: 'book-2', inside: (x, y) => rect(x, y, 517, 598, 760, 619) },
  { name: 'book-3', inside: (x, y) => rect(x, y, 517, 628, 714, 649) },
  // the sticky note, the mug and its steam, the plant, the lava lamp
  { name: 'note', inside: (x, y) => rect(x, y, 272, 316, 390, 428) },
  { name: 'mug', split: true, inside: (x, y) => rect(x, y, 220, 540, 324, 652) || ell(x, y, 334, 602, 22, 42) || rect(x, y, 240, 462, 310, 542) },
  { name: 'plant', split: true, inside: (x, y) => inPoly(x, y, [[858, 440], [896, 362], [962, 356], [1012, 404], [1050, 468], [1052, 562], [1012, 640], [994, 658], [902, 658], [866, 622], [852, 560]]) && !inPoly(x, y, XBOX) && !rect(x, y, 948, 278, 1074, 440) },
  { name: 'lava', split: true, inside: (x, y) => rect(x, y, 1224, 434, 1298, 650) && !inPoly(x, y, XBOX) },
];

/** Fill the masked pixels smoothly from the known ones round them (wall and desk apart), then add grain. */
function fill(img, mask) {
  const isDesk = (y) => y / K >= DESK_Y;
  const idx = [];
  for (let i = 0; i < W * H; i++) if (mask[i]) idx.push(i);
  // a start: each unknown pixel takes the mean of the known border in its zone
  for (const zone of [false, true]) {
    const s = [0, 0, 0]; let n = 0;
    for (const i of idx) { const y = (i / W) | 0; if (isDesk(y) !== zone) continue; for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < W * H && !mask[j] && isDesk((j / W) | 0) === zone) { for (let c = 0; c < 3; c++) s[c] += img[j * 3 + c]; n++; } }
    for (const i of idx) if (isDesk((i / W) | 0) === zone) for (let c = 0; c < 3; c++) img[i * 3 + c] = n ? s[c] / n : 60;
  }
  const v = Float32Array.from(img);
  for (let it = 0; it < 900; it++) {
    for (const i of idx) {
      const y = (i / W) | 0, z = isDesk(y);
      for (let c = 0; c < 3; c++) {
        let s = 0, n = 0;
        for (const j of [i - 1, i + 1, i - W, i + W]) { if (j < 0 || j >= W * H) continue; if (isDesk((j / W) | 0) !== z) continue; s += v[j * 3 + c]; n++; }
        if (n) v[i * 3 + c] += 1.9 * (s / n - v[i * 3 + c]);
      }
    }
  }
  for (const i of idx) { const x = i % W, y = (i / W) | 0; for (let c = 0; c < 3; c++) img[i * 3 + c] = clamp(Math.round(v[i * 3 + c] + hash(x, y, 7 + c) * 5), 0, 255); }
}

/** The lamp switched off: its warm light divided out of the room round it, the shade's glass dark. */
function lampOff(img) {
  const out = Buffer.alloc(img.length), SHADE = [[28, 383], [213, 383], [152, 268], [86, 268]];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const mx = x / K, my = y / K, o = (y * W + x) * 3;
    const G = 1.6 * Math.exp(-(((mx - 118) / 300) ** 2) - ((my - 420) / 280) ** 2) + (my > DESK_Y ? 0.9 * Math.exp(-(((mx - 170) / 330) ** 2) - ((my - 700) / 110) ** 2) : 0);
    const tint = [1.2, 1, 0.65];
    for (let c = 0; c < 3; c++) out[o + c] = clamp(Math.round((img[o + c] * 0.8 * [0.95, 0.97, 1.08][c]) / (1 + G * tint[c])), 0, 255);
    if (inPoly(mx, my, SHADE)) { const l = 0.3 * img[o] + 0.59 * img[o + 1] + 0.11 * img[o + 2]; out[o] = l * 0.26; out[o + 1] = l * 0.17; out[o + 2] = l * 0.1; }
  }
  return out;
}

/**
 * The room widened so a full-screen window is covered by the room itself (no side walls painted on): strips
 * of plain wall and desk put in along paths that thread between things (mockup px, rows [y0, y1) at column x).
 * Left: between the sticky note and the decks, the note and the monitor, the coaster and the keyboard. Right:
 * between the decks and the poster, the monitor and the plant, the keyboard and the mousepad.
 */
const CUTS = {
  left: { d: 118, path: [[0, 598, 372], [598, 655, 415], [655, MH, 345]] },
  right: { d: 118, path: [[0, 660, 930], [660, MH, 876]] },
};
const WW = W + CUTS.left.d + CUTS.right.d;
const cutAt = (side, yArt) => { const my = yArt / K; return Math.round(CUTS[side].path.find(([a, b]) => my >= a && my < b)[2] * K); };
/** An art-px column of the mockup room to its place in the widened room, on art-px row y. */
const mapX = (x, y) => x + (x >= cutAt('left', y) ? CUTS.left.d : 0) + (x >= cutAt('right', y) ? CUTS.right.d : 0);

function widen(img) {
  const out = Buffer.alloc(WW * H * 3), deskY = Math.round(DESK_Y * K);
  const px = (x, y, c) => img[(clamp(y, 0, H - 1) * W + clamp(x, 0, W - 1)) * 3 + c];
  for (const side of ['left', 'right']) {
    // each side of the cut's colour per row, smoothed down the rows (wall and desk apart) so no row's dither
    // becomes a streak; and the cut's own texture (each pixel less its local mean), mirrored across the strip
    // on the desk, only desk-coloured pixels (lit orange wood) count, searching outward past any object's edge
    const desky = (x, y) => { const r = px(x, y, 0), g = px(x, y, 1), b = px(x, y, 2); return r > 70 && r > g * 1.3 && g > b; };
    const col = (dx) => Array.from({ length: H }, (_, y) => {
      const s = [0, 0, 0]; let n = 0;
      for (let k = 0; k < 60 && n < 4; k++) {
        const x = cutAt(side, y) + dx + (dx < 0 ? -k : k);
        if (y >= deskY && !desky(x, y)) continue;
        for (let c = 0; c < 3; c++) s[c] += px(x, y, c); n++;
      }
      return n ? s.map((v) => v / n) : [px(cutAt(side, y) + dx, y, 0), px(cutAt(side, y) + dx, y, 1), px(cutAt(side, y) + dx, y, 2)];
    });
    // the wall is smoothed down the rows (no streaks); the desk keeps its planks, lightly
    const sm = (a) => a.map((_, y) => { const r = y < deskY ? 6 : 1, s = [0, 0, 0]; let n = 0; for (let k = y - r; k <= y + r; k++) { if (k < 0 || k >= H || (k < deskY) !== (y < deskY)) continue; for (let c = 0; c < 3; c++) s[c] += a[k][c]; n++; } return s.map((v) => v / n); });
    CUTS[side].L = sm(col(-1)); CUTS[side].R = sm(col(0));
  }
  for (let y = 0; y < H; y++) {
    let o = y * WW * 3, x = 0;
    for (const side of ['left', 'right']) {
      const cut = cutAt(side, y), d = CUTS[side].d, L = CUTS[side].L[y], R = CUTS[side].R[y];
      img.copy(out, o, (y * W + x) * 3, (y * W + cut) * 3); o += (cut - x) * 3; x = cut;
      for (let k = 0; k < d; k++) {
        const t = k / (d - 1), m = k % 24, j = m < 12 ? m : 23 - m, gx = cut - 12 + j;
        for (let c = 0; c < 3; c++) {
          let mean = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) mean += px(gx + dx, y + dy, c) / 25;
          const grain = y < deskY ? clamp(px(gx, y, c) - mean, -10, 10) : 0;
          out[o + c] = clamp(Math.round(L[c] * (1 - t) + R[c] * t + grain * 0.7 + hash(k + cut, y, 3 + c) * 2), 0, 255);
        }
        o += 3;
      }
    }
    img.copy(out, o, (y * W + x) * 3, (y * W + W) * 3);
  }
  return out;
}

/**
 * The closet's inside corners moved out to where the desk's back corners are (widened-room art px), so the desk
 * runs right into each corner: the old corner line is painted out, the strip between takes the back wall's
 * tone (row by row, as measured either side of the old line), and the line is drawn at the new corner, behind
 * whatever stands in front of it.
 */
const CORNERS = [{ from: 176, half: 2, to: 50, deskY: 758 }, { from: 1695, half: 8, to: 1796, deskY: 768 }];
/** Things that stand in front of the closet's corners (mockup px): the lamp's stem and base, the headset. */
const keep = (x, y) => (y > 383 && Math.abs(x - 117) < 30) || ell(x, y, 122, 625, 92, 48) ||
  ell(x, y, 1229, 261, 35, 42) || ell(x, y, 1287, 262, 34, 42) || (y < 232 && ell(x, y, 1262, 216, 50, 76) && !ell(x, y, 1262, 222, 27, 63)) || (x >= 1246 && x <= 1272 && y >= 116 && y <= 154);
function alignCorners(img) {
  const at = (x, y, c) => img[(y * WW + x) * 3 + c];
  const lum = (x, y) => 0.299 * at(x, y, 0) + 0.587 * at(x, y, 1) + 0.114 * at(x, y, 2);
  const SHADE = [[28, 383], [213, 383], [152, 268], [86, 268]];
  for (const { from, half, to, deskY } of CORNERS) {
    const dir = to < from ? -1 : 1; // which way the side wall is
    const line = [0, 1, 2].map((c) => at(176, 100, c));
    // the back wall's tone over the side wall's, per row (read clear of the corner's shading), smoothed
    const raw = [];
    for (let y = 0; y < deskY; y++) {
      const r = [0, 0, 0];
      for (let c = 0; c < 3; c++) { let bw = 0, sw = 0; for (let k = half + 4; k < half + 16; k++) { bw += at(from - dir * k, y, c); sw += at(from + dir * k, y, c); } r[c] = clamp(bw / Math.max(1, sw), 0.75, 1.3); }
      raw.push(r);
    }
    const ratio = raw.map((_, y) => { const s = [0, 0, 0]; let n = 0; for (let k = Math.max(0, y - 20); k <= Math.min(deskY - 1, y + 20); k++) { for (let c = 0; c < 3; c++) s[c] += raw[k][c]; n++; } return s.map((v) => v / n); });
    const lo = Math.min(from, to), hi = Math.max(from, to);
    for (let y = 0; y < deskY; y++) {
      // the strip takes the back wall's tone (bright lamp pixels left as they are)
      for (let x = lo; x <= hi; x++) { if (Math.abs(x - from) <= half + 1) continue; const o = (y * WW + x) * 3; if (lum(x, y) > 170) continue; for (let c = 0; c < 3; c++) img[o + c] = clamp(Math.round(img[o + c] * ratio[y][c]), 0, 255); }
      // then the old corner and its shading painted out, between the plain wall either side of it
      const e0 = from - half - 2, e1 = from + half + 2, a = lum(e0, y), b = lum(e1, y);
      // pixel by pixel, keeping anything in front of the corner (the lamp, its chain, the headset)
      if (Math.abs(a - b) < 40) for (let x = e0 + 1; x < e1; x++) {
        const mx = (x - (x > 900 ? CUTS.left.d + CUTS.right.d : 0)) / K, my = y / K, l = lum(x, y);
        if (keep(mx, my) || l > Math.max(a, b) + 35) continue;
        const t = (x - e0) / (e1 - e0), o = (y * WW + x) * 3;
        for (let c = 0; c < 3; c++) img[o + c] = clamp(Math.round(at(e0, y, c) * (1 - t) + at(e1, y, c) * t + hash(x, y, 40 + c) * 3), 0, 255);
      }
    }
    // the new corner line, behind the lamp and anything else in front of the wall
    for (let y = 0; y < deskY; y++) {
      const mx = to / K, my = y / K;
      if (inPoly(mx, my, SHADE) || ell(mx, my, 122, 625, 92, 48)) continue;
      const L = lum(to, y);
      if (Math.abs(L - lum(to - 8, y)) > 30 || Math.abs(L - lum(to + 8, y)) > 30) continue;
      const o = (y * WW + to) * 3;
      for (let c = 0; c < 3; c++) img[o + c] = line[c];
    }
  }
  return img;
}

/**
 * The closet's side walls and the desk carried on past the edges, without smearing: each row's colour at the
 * edge, smoothed down the rows (so no row's dither turns into a stripe), darkening outward, with real 2D grain
 * from a clean patch of the left side wall laid over it (its fine texture only, the patch's light taken off).
 */
function side(img, left, W = WW) {
  const out = Buffer.alloc(SW * H * 3), deskY = Math.round(DESK_Y * K);
  const at = (x, y, c) => img[(clamp(y, 0, H - 1) * W + clamp(x, 0, W - 1)) * 3 + c];
  // the edge colour per row
  const edge = [];
  for (let y = 0; y < H; y++) { const e = [0, 0, 0]; for (let k = 0; k < 8; k++) { const x = left ? k : W - 1 - k; for (let c = 0; c < 3; c++) e[c] += at(x, y, c) / 8; } edge.push(e); }
  // smoothed down the rows, the wall and the desk apart
  const smooth = (R) => edge.map((_, y) => {
    const s = [0, 0, 0]; let n = 0;
    for (let k = y - R; k <= y + R; k++) { if (k < 0 || k >= H || (k < deskY) !== (y < deskY)) continue; for (let c = 0; c < 3; c++) s[c] += edge[k][c]; n++; }
    return s.map((v) => v / n);
  });
  // near the edge the wall follows the room's own light; a little way out it's an even, plain wall
  const near = smooth(14), far = smooth(90);
  // the side wall's colour per row: the room's edge band (20 px), averaged across and lightly down the rows,
  // so it carries the room's light on outward without dragging any one pixel's line or dither
  const bandRaw = []; for (let y = 0; y < H; y++) { const e = [0, 0, 0]; for (let k = 0; k < 20; k++) { const x = left ? k : W - 1 - k; for (let c = 0; c < 3; c++) e[c] += at(x, y, c) / 20; } bandRaw.push(e); }
  const band = bandRaw.map((_, y) => { const s = [0, 0, 0]; let n = 0; for (let k = y - 5; k <= y + 5; k++) { if (k < 0 || k >= deskY) continue; for (let c = 0; c < 3; c++) s[c] += bandRaw[k][c]; n++; } return n ? s.map((v) => v / n) : bandRaw[y]; });
  // the grain: a clean stretch of the left side wall (art px), mirrored to tile, minus its local mean
  const P = [8, 8, 150, 290], pw = P[2] - P[0], ph = P[3] - P[1];
  const mir = (v, n) => { const m = ((v % (2 * n)) + 2 * n) % (2 * n); return m < n ? m : 2 * n - 1 - m; };
  const grain = (k, y, c) => {
    const gx = P[0] + mir(k, pw), gy = P[1] + mir(y, ph);
    let s = 0; for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) s += at(gx + dx, gy + dy, c);
    return clamp(at(gx, gy, c) - s / 81, -12, 12);
  };
  for (let y = 0; y < H; y++) for (let k = 0; k < SW; k++) {
    const X = left ? SW - 1 - k : k, d = 1 - 0.3 * Math.min(1, k / SW), blend = Math.min(1, k / 40), t = Math.min(1, k / 120);
    if (y < deskY) {
      // the closet's side wall: the room's own edge band (clean wall), mirrored on outward, so its texture and
      // light carry on exactly, nothing dragged
      for (let c = 0; c < 3; c++) out[(y * SW + X) * 3 + c] = clamp(Math.round(band[y][c] * d + hash(k, y, 9 + c) * 4), 0, 255);
      continue;
    }
    for (let c = 0; c < 3; c++) {
      const v = (near[y][c] * (1 - t) + far[y][c] * t + grain(k, y, c) * 0.8 * blend) * d;
      out[(y * SW + X) * 3 + c] = clamp(Math.round(edge[y][c] * (1 - blend) + v * blend), 0, 255);
    }
  }
  return out;
}

const saveWebp = async (buf, w, file) => { await sharp(buf, { raw: { width: w, height: H, channels: 3 } }).webp({ lossless: true, effort: 6 }).toFile(file + '.tmp'); fs.renameSync(file + '.tmp', file); };
const savePng = (buf, w, file) => sharp(buf, { raw: { width: w, height: H, channels: 3 } }).png({ palette: true, colours: 128, dither: 0 }).toFile(file);

(async () => {
  const img = await sharp(MOCKUP).removeAlpha().resize(W, H, { kernel: 'lanczos3' }).raw().toBuffer();
  for (const r of CLEAR) {
    const mask = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (r.inside((x + 0.5) / K, (y + 0.5) / K)) mask[y * W + x] = 1;
    fill(img, mask);
  }
  const off0 = lampOff(img);
  const room = alignCorners(widen(img)), off = alignCorners(widen(off0));
  await saveWebp(room, WW, path.join(CIN, 'room.webp'));
  await saveWebp(off, WW, path.join(CIN, 'desk-off.webp'));
  await savePng(side(room, true), SW, path.join(CIN, 'side-left.png'));
  await savePng(side(room, false), SW, path.join(CIN, 'side-right.png'));
  await savePng(side(off, true), SW, path.join(CIN, 'side-left-off.png'));
  await savePng(side(off, false), SW, path.join(CIN, 'side-right-off.png'));

  // ---- room.json: every box in art px (mockup px x K) ----
  const A = (v) => Math.round(v * K);
  // boxes are worked out in the mockup room's art px, then moved into the widened room (by their middle row)
  const mv = ([x0, y0, x1, y1]) => { const d = mapX(x0, (y0 + y1) / 2) - x0; return [x0 + d, y0, x1 + d, y1]; };
  const pct = (b) => { const [x0, y0, x1, y1] = mv(b); return { left: +((x0 / WW) * 100).toFixed(3), top: +((y0 / H) * 100).toFixed(3), width: +(((x1 - x0) / WW) * 100).toFixed(3), height: +(((y1 - y0) / H) * 100).toFixed(3) }; };
  const box = (x, y, w, h) => [x, y, x + w, y + h];
  const old = JSON.parse(fs.readFileSync(path.join(CIN, 'room.json'), 'utf8'));
  const glass = mv([A(474), A(296), A(822), A(522)]);
  // the sprites, each lined up with the thing it replaces (art px)
  const mug = box(A(271) - 97, A(650) - 220, 224, 256); // its body's middle and its base
  const note = box(A(276) - 6, A(320) - 15, 156, 162); // the paper's corner
  const PS = 0.85, plant = box(A(947) - Math.round(162 * PS), A(652) - Math.round(336 * PS), Math.round(288 * PS), Math.round(336 * PS)); // the pot's middle and base
  const lava = box(A(1272) - 55, A(648) - 220, 110, 220);
  const m = {
    ...old,
    image: 'room.webp',
    size: { width: WW, height: H },
    // the words on the decks and spines (CinemaScene's WALL_TEXT, in the mockup room's art px) move with them
    textDx: CUTS.left.d,
    screenPx: glass,
    screenPct: { left: +((glass[0] / WW) * 100).toFixed(3), top: +((glass[1] / H) * 100).toFixed(3), width: +(((glass[2] - glass[0]) / WW) * 100).toFixed(3), height: +(((glass[3] - glass[1]) / H) * 100).toFixed(3) },
    // standing, the room is centred (it's laid out to be seen whole)
    focalPoint: [50, +((((glass[1] + glass[3]) / 2) / H) * 100).toFixed(2)],
    monitorPct: pct([A(440), A(272), A(848), A(550)]),
    decksPct: [pct([A(388), A(6), A(914), A(136)]), pct([A(386), A(136), A(912), A(266)])],
    props: {
      ...old.props,
      mug: { ...old.props.mug, boxPx: mv(mug), boxPct: pct(mug), spill: { ...old.props.mug.spill, boxPct: pct(box(mug[0] - 72, mug[1] - 23, 295, 274)) } },
      steam: { ...old.props.steam, boxPx: mv(mug), boxPct: pct(mug) },
      note: { ...old.props.note, boxPx: mv(note), boxPct: pct(note) },
      'plant-pot': { ...old.props['plant-pot'], boxPx: mv(plant), boxPct: pct(plant) },
      'plant-leaves': { ...old.props['plant-leaves'], boxPx: mv(plant), boxPct: pct(plant) },
    },
    // a peeled note comes to rest flat on the desk's back edge behind the mug (art px from where it hangs)
    noteLand: { dx: A(271) - (note[0] + 78), dy: A(DESK_Y) + 4 - (note[1] + 5) },
    lamp: { off: '/cinema/desk-off.webp', hitPct: pct([A(15), A(262), A(216), A(645)]) },
    lava: { boxPct: pct(lava) },
    pens: { files: [], boxPct: pct([0, 0, 1, 1]), originPct: [], hitPct: pct([0, 0, 1, 1]) },
    antPct: { from: [+(((mapX(A(940), A(652))) / WW) * 100).toFixed(2), +(((A(652)) / H) * 100).toFixed(2)], to: [+(((mapX(A(870), A(652))) / WW) * 100).toFixed(2), +(((A(664)) / H) * 100).toFixed(2)] },
    sides: { px: SW, left: '/cinema/side-left.png', right: '/cinema/side-right.png', leftOff: '/cinema/side-left-off.png', rightOff: '/cinema/side-right-off.png' },
  };
  delete m.decor; delete m.widen;
  fs.writeFileSync(path.join(CIN, 'room.json'), JSON.stringify(m, null, 2) + '\n');
  console.log('done', WW, H);
})();
