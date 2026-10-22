// The portfolio's room, drawn by the desk-room renderer (scripts/desk-room.js, the Ember study from the Desk Room
// Studies) and cut into what the scene needs. The renderer draws on a 640 x 316 pixel grid over the room's 461 x 227
// u; each pixel becomes 3 x 3 px of the site's art (1920 x 948), with the room carried on past each edge for wide
// windows. The things that move are left out of the backdrop and cut out on their own: the mug (with its steam), the
// sticky note (in seven colours), each pen in the cat cup; the lava lamp and the headset's cable are drawn live on the
// page, so only where they go is written down.
// Writes room.png and desk-off.png (desk lamp on / off) and room-lava-off.png and desk-off-lava-off.png (the lava
// lamp's light gone too), side-left/right(-off).png, cut-mug.png, cut-note-1..7.png, cut-pen-1..3.png and room.json.
// Run: node scripts/pixel-room.js
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { drawRoom, THEMES, W, H, K } = require('./desk-room.js');

const CIN = path.join(__dirname, '..', 'public', 'cinema');
const S = 3; // site art px per pixel
const SIDE = 188; // pixels drawn past each side (135 u)
const WS = W + 2 * SIDE; // the whole drawing's width, pixels
const F = K * S; // art px per u
const AW = W * S, AH = H * S; // the art's size

// the Ember study, with the other studies' note colours to hand for the stack of notes
const ember = THEMES.find((t) => t.id === 'ember');
const noteRamps = {};
for (const t of THEMES) for (const [k, v] of Object.entries(t.ramps)) if (k.startsWith('note')) noteRamps[k] ??= v;
const theme = { ...ember, ramps: { ...noteRamps, ...ember.ramps } };
const NOTE_COLOURS = ['noteGreen', 'noteOrange', 'noteYellow', 'notePink', 'noteCream', 'noteCoral', 'noteGreen'];

// the things that move, left out of the backdrop
const MOVING = ['mug', 'note', 'lava', 'pens', 'cable'];
const info = {};
const cache = new Map();
const render = (on, lava, skip, extra = {}) => {
  const key = JSON.stringify([on, lava, skip, extra]);
  if (!cache.has(key)) cache.set(key, drawRoom(theme, on, lava, { side: SIDE, skip, info, ...extra }));
  return cache.get(key);
};
const without = (...keep) => MOVING.filter((k) => !keep.includes(k));

/** Columns x0..x1 of a drawing (pixels), scaled up to art px. */
async function save(px, file, [x0, x1] = [SIDE, SIDE + W], width = WS) {
  const w = x1 - x0, buf = Buffer.alloc(w * H * 4);
  for (let y = 0; y < H; y++) Buffer.from(px.buffer, (y * width + x0) * 4, w * 4).copy(buf, y * w * 4);
  await sharp(buf, { raw: { width: w, height: H, channels: 4 } }).resize(w * S, H * S, { kernel: 'nearest' }).png({ compressionLevel: 9 }).toFile(path.join(CIN, file));
}

/** A thing on its own: the pixels where the room with it differs from the room without it (its shadow comes along),
 *  cropped to them. Returns its box in pixels of the art (x0, y0, x1, y1, exclusive). */
async function cut(withIt, withoutIt, file) {
  let X0 = WS, Y0 = H, X1 = -1, Y1 = -1;
  const differs = (i) => withIt[i] !== withoutIt[i] || withIt[i + 1] !== withoutIt[i + 1] || withIt[i + 2] !== withoutIt[i + 2];
  for (let y = 0; y < H; y++) for (let x = 0; x < WS; x++) if (differs((y * WS + x) * 4)) { X0 = Math.min(X0, x); X1 = Math.max(X1, x); Y0 = Math.min(Y0, y); Y1 = Math.max(Y1, y); }
  const w = X1 - X0 + 1, h = Y1 - Y0 + 1, buf = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((Y0 + y) * WS + X0 + x) * 4, o = (y * w + x) * 4;
    if (!differs(i)) continue;
    buf[o] = withIt[i]; buf[o + 1] = withIt[i + 1]; buf[o + 2] = withIt[i + 2]; buf[o + 3] = 255;
  }
  await sharp(buf, { raw: { width: w, height: h, channels: 4 } }).resize(w * S, h * S, { kernel: 'nearest' }).png({ compressionLevel: 9 }).toFile(path.join(CIN, file));
  return [X0 - SIDE, Y0, X1 - SIDE + 1, Y1 + 1];
}

(async () => {
  // ---- the backdrop: desk lamp on and off, lava lamp on and off; the room past each edge (its lava light doesn't reach)
  const lit = render(true, true, MOVING), dark = render(false, true, MOVING);
  await save(lit, 'room.png');
  await save(dark, 'desk-off.png');
  await save(render(true, false, MOVING), 'room-lava-off.png');
  await save(render(false, false, MOVING), 'desk-off-lava-off.png');
  await save(lit, 'side-left.png', [0, SIDE]);
  await save(lit, 'side-right.png', [SIDE + W, WS]);
  await save(dark, 'side-left-off.png', [0, SIDE]);
  await save(dark, 'side-right-off.png', [SIDE + W, WS]);

  // ---- the things that move, each cut out lit (the scene dims them with the lamp)
  const MUG = await cut(render(true, true, without('mug')), lit, 'cut-mug.png');
  let NOTE;
  for (let i = 0; i < NOTE_COLOURS.length; i++) NOTE = await cut(render(true, true, without('note'), { noteRamp: NOTE_COLOURS[i] }), lit, `cut-note-${i + 1}.png`);
  const PENS = [];
  for (let i = 0; i < 3; i++) PENS.push(await cut(render(true, true, [...without('pens'), ...[0, 1, 2].filter((j) => j !== i).map((j) => `pen${j}`)]), lit, `cut-pen-${i + 1}.png`));

  // ---- room.json: the places, in art px of the 1920 x 948 art
  const u = (v) => +(v * F).toFixed(1); // u to art px
  const p = (v) => v * S; // pixels to art px
  const pct = ([x0, y0, x1, y1]) => ({ left: +((x0 / AW) * 100).toFixed(3), top: +((y0 / AH) * 100).toFixed(3), width: +(((x1 - x0) / AW) * 100).toFixed(3), height: +(((y1 - y0) / AH) * 100).toFixed(3) });
  const m = JSON.parse(fs.readFileSync(path.join(CIN, 'room.json'), 'utf8'));
  const GLASS = [u(170.5), u(87.5), u(276.5), u(152.5)];

  // the mug: its cut-out, and the coffee spill's canvas round it (canvas px = art px), set so the mug's body starts 110
  // in and its rim sits 79 down, as the spill was laid out (the body is 106..136 u across, its rim at 155 u, its base
  // at 194 u, all MY further toward you)
  const MY = info.mug.MY, mugBox = MUG.map(p);
  const body0 = u(106), rimY = u(155 + MY), baseY = u(194 + MY);
  const spillX = Math.round(body0 - 110), spillY = Math.round(rimY - 79);
  const mugBase = (baseY - mugBox[1]) / (mugBox[3] - mugBox[1]);

  // the pens: each in its own box, rocking about where it leaves the cup
  const penBoxes = PENS.map((b) => b.map(p));
  const penOrigin = info.pens.map(([x0, y0], i) => { const b = penBoxes[i]; return [+(((u(x0) - b[0]) / (b[2] - b[0])) * 100).toFixed(2), +(((u(y0) - b[1]) / (b[3] - b[1])) * 100).toFixed(2)]; });

  // the headset's cable: from the cup's foot down the wall (as the study draws it) to the desk in the corner, then
  // across into the USB port on the controller's top edge; drawn live on the page so it can sway
  const [cx0, cy0] = info.cableStart, wall = [];
  for (let y = cy0; y < 196; y += 0.4) { const t = (y - cy0) / (196 - cy0); wall.push([cx0 + (419 - cx0) * t ** 3 + Math.sin(y / 9) * 1.1 * (1 - t), y]); }
  const ctl = info.controller, mid = ctl.pad.px.filter(([c]) => Math.abs(c - ctl.pad.w * 0.5) < ctl.pad.w * 0.12);
  const topR = Math.min(...mid.map(([, r]) => r)), topC = mid.filter(([, r]) => r === topR).reduce((a, [c]) => a + c, 0) / mid.filter(([, r]) => r === topR).length;
  const port = [(ctl.x + topC + 0.5) / K, (ctl.y + topR + 0.5) / K];
  const [ex, ey] = wall[wall.length - 1], desk = [];
  for (let t = 0; t <= 1; t += 0.02) { const q = 1 - t; desk.push([q * q * ex + 2 * q * t * (ex - 2) + t * t * port[0], q * q * ey + 2 * q * t * (port[1] - 1) + t * t * port[1]]); }
  const cablePts = [...wall, ...desk].map(([x, y]) => [x * K, y * K]); // pixels
  const SWAY = 6; // pixels of room round it to sway into
  const cb = [Math.floor(Math.min(...cablePts.map((q) => q[0])) - SWAY), Math.floor(Math.min(...cablePts.map((q) => q[1])) - 1), Math.ceil(Math.max(...cablePts.map((q) => q[0])) + SWAY), Math.ceil(Math.max(...cablePts.map((q) => q[1])) + 2)];
  // its colour, as the room lights it: sampled where the study draws it, lamp on and off
  const colourAt = (on) => {
    const a = render(on, true, without('cable'));
    const [x, y] = wall[Math.floor(wall.length * 0.4)], i = (Math.round(y * K) * WS + SIDE + Math.round(x * K)) * 4;
    for (const d of [0, 4, -4, 8, -8]) if (a[i + d] < 40 && a[i + d + 1] < 40) return '#' + [0, 1, 2].map((k) => a[i + d + k].toString(16).padStart(2, '0')).join('');
    return '#111116';
  };


  // the lava lamp: drawn live (components/cinema/LavaLamp.tsx), a 30 x 90 pixel canvas whose column 15.4 is the lamp's
  // middle (310 u) and whose top row is 135.5 u down
  const lavaX = Math.round(310 * K - 15.4), lavaY = Math.round(135.5 * K);

  Object.assign(m, {
    image: 'room.png',
    size: { width: AW, height: AH },
    textDx: 0,
    screenPx: GLASS,
    monitorPct: pct([u(161), u(81), u(284), u(160)]),
    decksPct: [pct([u(146), u(2), u(304), u(39)]), pct([u(145), u(42), u(303), u(78.5)])],
    lamp: { off: '/cinema/desk-off.png', hitPct: pct([u(34), u(102), u(95), u(197)]) },
    lavaOff: { on: '/cinema/room-lava-off.png', off: '/cinema/desk-off-lava-off.png' },
    lava: { boxPct: pct([p(lavaX), p(lavaY), p(lavaX + 30), p(lavaY + 90)]) },
    sides: { ...m.sides, px: SIDE * S },
    notes: NOTE_COLOURS.map((_, i) => `/cinema/cut-note-${i + 1}.png`),
    // a peeled note comes to rest flat on the desk just behind the mug, a little to its right
    noteLand: { dx: Math.round(u(129) - u(127)), dy: Math.round(u(193) - u(97)) },
    pens: {
      files: PENS.map((_, i) => `/cinema/cut-pen-${i + 1}.png`),
      boxes: penBoxes.map(pct),
      originPct: penOrigin,
      hitPct: pct([u(83), u(140), u(111), u(196)]),
    },
    cable: {
      boxPct: pct(cb.map(p)),
      width: cb[2] - cb[0],
      height: cb[3] - cb[1],
      points: cablePts.map(([x, y]) => [+(x - cb[0]).toFixed(2), +(y - cb[1]).toFixed(2)]),
      color: { on: colourAt(true), off: colourAt(false) },
    },
  });
  delete m.decor; delete m.leaves; delete m.antPct;
  m.screenPct = pct(GLASS);
  m.focalPoint = [50, +((((GLASS[1] + GLASS[3]) / 2) / AH) * 100).toFixed(2)];
  m.props = {
    mug: {
      file: '/cinema/cut-mug.png', boxPx: mugBox, boxPct: pct(mugBox), originPct: [50, +(mugBase * 100).toFixed(2)],
      spill: { boxPct: pct([spillX, spillY, spillX + 295, spillY + 274]), width: 295, height: 274, pivot: [110, Math.round(baseY - spillY)], rim: [108, 79], landY: Math.round(baseY - spillY) - 2, mugLeft: 110 },
    },
    steam: { file: '/cinema/cut-empty.png', boxPx: mugBox, boxPct: pct(mugBox), originPct: [50, 100] },
    note: { file: '/cinema/cut-note-1.png', boxPx: NOTE.map(p), boxPct: pct(NOTE.map(p)), originPct: [50, 3] },
  };
  fs.writeFileSync(path.join(CIN, 'room.json'), JSON.stringify(m, null, 2) + '\n');
  console.log('done', AW, AH, { mug: mugBox, note: NOTE.map(p), pens: penBoxes, port, cable: m.cable.color, mugBody: [body0, rimY, baseY] });
})();
