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
 * The closet's side walls and the desk carried on past the edges, without smearing: each row's colour at the
 * edge, smoothed down the rows (so no row's dither turns into a stripe), darkening outward, with real 2D grain
 * from a clean patch of the left side wall laid over it (its fine texture only, the patch's light taken off).
 */
function side(img, left) {
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
  // the closet's left corner: the line the mockup draws above the lamp, carried on down behind it to the desk
  {
    const CX = 176, lc = [0, 1, 2].map((c) => img[(100 * W + CX) * 3 + c]);
    const SHADE = [[28, 383], [213, 383], [152, 268], [86, 268]];
    for (let y = 0; y < Math.round(DESK_Y * K); y++) {
      const mx = CX / K, my = y / K;
      if (inPoly(mx, my, SHADE) || (my > 590 && ell(mx, my, 122, 625, 88, 45)) || (my > 383 && Math.abs(mx - 117) < 24)) continue;
      const o = (y * W + CX) * 3;
      const wallish = Math.abs(img[o] - img[o - 9]) < 40; // only over wall, never over the lamp
      if (wallish) for (let c = 0; c < 3; c++) img[o + c] = Math.round(lc[c] * (0.6 + 0.4 * Math.min(1, img[o - 9 + c] / 120)));
    }
  }
  const off = lampOff(img);
  await saveWebp(img, W, path.join(CIN, 'room.webp'));
  await saveWebp(off, W, path.join(CIN, 'desk-off.webp'));
  await savePng(side(img, true), SW, path.join(CIN, 'side-left.png'));
  await savePng(side(img, false), SW, path.join(CIN, 'side-right.png'));
  await savePng(side(off, true), SW, path.join(CIN, 'side-left-off.png'));
  await savePng(side(off, false), SW, path.join(CIN, 'side-right-off.png'));

  // ---- room.json: every box in art px (mockup px x K) ----
  const A = (v) => Math.round(v * K);
  const pct = ([x0, y0, x1, y1]) => ({ left: +((x0 / W) * 100).toFixed(3), top: +((y0 / H) * 100).toFixed(3), width: +(((x1 - x0) / W) * 100).toFixed(3), height: +(((y1 - y0) / H) * 100).toFixed(3) });
  const box = (x, y, w, h) => [x, y, x + w, y + h];
  const old = JSON.parse(fs.readFileSync(path.join(CIN, 'room.json'), 'utf8'));
  const glass = [A(474), A(296), A(822), A(522)];
  // the sprites, each lined up with the thing it replaces (art px)
  const mug = box(A(271) - 97, A(650) - 220, 224, 256); // its body's middle and its base
  const note = box(A(276) - 6, A(320) - 15, 156, 162); // the paper's corner
  const PS = 0.85, plant = box(A(947) - Math.round(162 * PS), A(652) - Math.round(336 * PS), Math.round(288 * PS), Math.round(336 * PS)); // the pot's middle and base
  const lava = box(A(1272) - 55, A(648) - 220, 110, 220);
  const m = {
    ...old,
    image: 'room.webp',
    size: { width: W, height: H },
    screenPx: glass,
    screenPct: pct(glass),
    focalPoint: [+((((glass[0] + glass[2]) / 2) / W) * 100).toFixed(2), +((((glass[1] + glass[3]) / 2) / H) * 100).toFixed(2)],
    monitorPct: pct([A(440), A(272), A(848), A(550)]),
    decksPct: [pct([A(388), A(6), A(914), A(136)]), pct([A(386), A(136), A(912), A(266)])],
    props: {
      ...old.props,
      mug: { ...old.props.mug, boxPx: mug, boxPct: pct(mug), spill: { ...old.props.mug.spill, boxPct: pct(box(mug[0] - 72, mug[1] - 23, 295, 274)) } },
      steam: { ...old.props.steam, boxPx: mug, boxPct: pct(mug) },
      note: { ...old.props.note, boxPx: note, boxPct: pct(note) },
      'plant-pot': { ...old.props['plant-pot'], boxPx: plant, boxPct: pct(plant) },
      'plant-leaves': { ...old.props['plant-leaves'], boxPx: plant, boxPct: pct(plant) },
    },
    // a peeled note comes to rest flat on the desk's back edge behind the mug (art px from where it hangs)
    noteLand: { dx: A(271) - (note[0] + 78), dy: A(DESK_Y) + 4 - (note[1] + 5) },
    lamp: { off: '/cinema/desk-off.webp', hitPct: pct([A(15), A(262), A(216), A(645)]) },
    lava: { boxPct: pct(lava) },
    pens: { files: [], boxPct: pct([0, 0, 1, 1]), originPct: [], hitPct: pct([0, 0, 1, 1]) },
    antPct: { from: [+(((A(940)) / W) * 100).toFixed(2), +(((A(652)) / H) * 100).toFixed(2)], to: [+(((A(870)) / W) * 100).toFixed(2), +(((A(664)) / H) * 100).toFixed(2)] },
    sides: { px: SW, left: '/cinema/side-left.png', right: '/cinema/side-right.png', leftOff: '/cinema/side-left-off.png', rightOff: '/cinema/side-right-off.png' },
  };
  delete m.decor; delete m.widen;
  fs.writeFileSync(path.join(CIN, 'room.json'), JSON.stringify(m, null, 2) + '\n');
  console.log('done', W, H);
})();
