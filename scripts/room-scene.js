// The v2 desk scene, built from separate pixel-art assets (no painting).
// usage: node scripts/room-scene.js [previewDir]
//
// Every thing in the room is its own asset, drawn on the same pixel grid as the props (2 art px a pixel)
// with the shared toolkit in scripts/pixel-props.js (palette ramps, Bayer dither, selective outlines), and
// written to public/cinema/assets/<name>.png: the wall, the desk, the two decks and their brackets, the
// poster, the headset and its hook, its cable, the table lamp (lit and unlit), the monitor and its stand,
// the three books under it, the keyboard, the notebook and pen, the coaster, the cat pencil cup and its
// three pens, the console, the mousepad, the mouse and the controller. The mug, its steam, the sticky notes,
// the plant and the lava lamp stay the live sprites they were.
//
// The assets are laid out after the mockup (positions below are mockup px, mapped by M), composed over the
// wall and desk, and lit: the room's ambient, the lamp's warm light (lamp on only), the monitor's green and
// the lava lamp's pink, with soft contact shadows, all stepped in a dithered pattern like the art. Written:
// room.webp and desk-off.webp (the room, lamp on and off), side-left/right(-off).png (the wall and desk
// carried on for very wide windows), and room.json (sizes, boxes and hit areas the scene reads, in art px).
const fs = require('fs'), path = require('path'), sharp = require('sharp');
const core = require('./pixel-props.js');
const { Cv, paint, writePng, hex, light, norm, hash, vnoise, BAYER, GLAZE, GOLD, PAPER, CHROME, IRON, BOOK, PAGES, WOOD, LEATHER, POT } = core;

const ROOT = path.join(__dirname, '..'), CIN = path.join(ROOT, 'public/cinema'), ASSETS = path.join(CIN, 'assets');
const PREV = process.argv[2];
fs.mkdirSync(ASSETS, { recursive: true });
if (PREV) fs.mkdirSync(PREV, { recursive: true });

/** Art px per pixel, the room in pixels, and how far the wall and desk carry on past each side. */
const S = 2, GW = 1300, GH = 636, SIDE = 450, EW = GW + 2 * SIDE;
/** Mockup px (1339 x 756) to room pixels. */
const M = (mx, my) => [Math.round(0.8425 * mx + 86), Math.round(0.8425 * my)];
const DESK = 535, LIP = 626, FRONT = 630; // the desk's back edge, its front lip, its front face
/**
 * The desk fits a closet wall to wall: the back wall's inside corners near the room's edges, the side walls
 * coming forward from them (toward the vanishing point behind the monitor), the desk meeting each along a
 * diagonal crease. Returns the side wall's shade at a pixel, or null where it's back wall or desk.
 */
const CORNER = [64, 1236], VP = [640, 360];
function closet(rx, Y) {
  for (const [c, dir] of [[CORNER[0], -1], [CORNER[1], 1]]) {
    const k = Math.abs((c - VP[0]) / (DESK - VP[1])), edge = c + dir * (Y > DESK ? (Y - DESK) * k : 0);
    const out = (rx - edge) * dir; // px past the corner line, into the side wall
    if (out < 0) continue;
    if (out < 1.5) return 0.1; // the crease
    return 0.44 - 0.12 * ss(out / 420) + 0.04 * (vnoise(rx, Y, 23, 30) - 0.5) + (out < 4 ? -0.08 : 0);
  }
  return null;
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

// ---- ramps (dark -> light; 0 is the outline) ----
const WALLR = ['#140904', '#40200e', '#5a2c14', '#6c3618', '#7c421e', '#8c4e24', '#a05c2a'];
const BRONZE = ['#120804', '#2e1a0c', '#4a2c14', '#6a4220', '#8c5a2c', '#b07a40', '#e0b46a'];
const GLASS = ['#3a1404', '#8a3c0c', '#c0601a', '#e08a30', '#f0b050', '#f8d080', '#fff0c8'];
const RIM = ['#140a06', '#5a2c12', '#8a4a1e', '#b06428', '#d07e34', '#e89a48', '#f6c070'];
const ROSE = ['#2a1218', '#5c3036', '#7a4648', '#92585a', '#a66a68', '#ba827c', '#d4a49a'];
const NAVY = ['#06080e', '#101828', '#18243a', '#20304a', '#2c405e', '#3e5878', '#6a84a4'];
const CORK = ['#1a0c06', '#3a1e0e', '#5a3018', '#6e3e20', '#84502a', '#9a6234', '#b07a44'];
const PLASTIC = ['#060608', '#121116', '#1c1a20', '#28252c', '#36323a', '#4a4550', '#6e6876'];
const SKY = ['#120a20', '#24163a', '#34204e', '#46285e', '#5a326c', '#743e78', '#9a5a8a'];
const MOUNT = ['#081418', '#14282e', '#1e3a40', '#2a4c52', '#386266', '#4e7c7c', '#7aa8a0'];

// ------------------------------------------------------------------------------------------------
// drawing helpers
// ------------------------------------------------------------------------------------------------

/**
 * Paint a canvas into an asset: pixels, which of them glow, where it goes (room pixels).
 * Things in the room are drawn the way the mug, notes and plant were: painted as a chunky draft at half
 * resolution (4 art px a pixel, so the dither shows as the props' checks and the outline is a full draft
 * pixel), then doubled with the outer outline thinned to its inner half and graded to the room's warm light,
 * falling off low and right. The wall and desk (`fine`) are painted straight at full resolution.
 */
function asset(name, x, y, cv, opts = {}) {
  const { px, glow, neutral = new Uint8Array(cv.W * cv.H) } = opts.fine ? fine(cv, name, opts) : chunky(cv, name, opts);
  writePng(path.join(ASSETS, name + '.png'), cv.W, cv.H, px);
  return { name, x, y, w: cv.W, h: cv.H, px, glow, neutral };
}
function fine(cv, name, opts) {
  const { px } = paint(cv, name, opts), glow = new Uint8Array(cv.W * cv.H);
  for (let i = 0; i < cv.W * cv.H; i++) if (cv.c[i] && cv.c[i].glow) glow[i] = 1;
  return { px, glow };
}
function chunky(cv, name, { warm = [1, 0.92, 0.8], shadow = 0.22, sat = 0.88, ...opts } = {}) {
  const W2 = Math.ceil(cv.W / 2), H2 = Math.ceil(cv.H / 2), half = new Cv(W2, H2);
  for (let j = 0; j < H2; j++) for (let i = 0; i < W2; i++) {
    // the uppermost thing in each 2 x 2 block, so thin lines (leads, cords, rules) survive
    let c = null;
    for (const [dx, dy] of [[1, 1], [0, 0], [1, 0], [0, 1]]) { const d = cv.get(2 * i + dx, 2 * j + dy); if (d && (!c || d.z > c.z)) c = d; }
    if (c) half.c[j * W2 + i] = c;
  }
  const { px: hp } = paint(half, name, opts);
  const W = cv.W, H = cv.H, px = new Uint8Array(W * H * 4), glow = new Uint8Array(W * H), neutral = new Uint8Array(W * H);
  const A = (i, j) => (i < 0 || j < 0 || i >= W2 || j >= H2 ? 0 : hp[(j * W2 + i) * 4 + 3]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = x >> 1, j = y >> 1, si = (j * W2 + i) * 4, o = (y * W + x) * 4;
    if (!hp[si + 3]) continue;
    let r = hp[si], g = hp[si + 1], b = hp[si + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b, hc = half.c[j * W2 + i];
    // an outline pixel on the silhouette keeps only its inner half
    if (lum < 34 && hp[si + 3] > 200) { const ox = x & 1 ? 1 : -1, oy = y & 1 ? 1 : -1; if (A(i + ox, j) < 128 || A(i, j + oy) < 128) continue; }
    if (hc && hc.neutral) neutral[y * W + x] = 1;
    if (hc && hc.glow) glow[y * W + x] = 1;
    else {
      const gray = lum; r = gray + (r - gray) * sat; g = gray + (g - gray) * sat; b = gray + (b - gray) * sat;
      const fall = 1 - shadow * clamp(0.55 * (x / W) + 0.65 * (y / H) - 0.25, 0, 1);
      r *= warm[0] * fall; g *= warm[1] * fall; b *= warm[2] * fall;
    }
    px[o] = clamp(Math.round(r), 0, 255); px[o + 1] = clamp(Math.round(g), 0, 255); px[o + 2] = clamp(Math.round(b), 0, 255); px[o + 3] = hp[si + 3];
  }
  return { px, glow, neutral };
}
const cell = (ramp, v, z, part, extra) => ({ ramp, v, z, part, ...extra });
/** A rounded rectangle's signed inside distance (px from its edge, negative outside). */
const rrect = (x, y, x0, y0, x1, y1, r) => {
  const qx = Math.max(x0 + r - x, 0, x - (x1 - r)), qy = Math.max(y0 + r - y, 0, y - (y1 - r));
  if (qx > 0 && qy > 0) return r - Math.hypot(qx, qy);
  return Math.min(x - x0, x1 - x, y - y0, y1 - y);
};
/** A cylinder's lighting across its width (u from -1 to 1), lit from the upper left. */
const cyl = (u, opts) => light(norm([u, -0.15, Math.sqrt(Math.max(0, 1 - u * u))]), opts);

// ------------------------------------------------------------------------------------------------
// the assets
// ------------------------------------------------------------------------------------------------

function wall() {
  const cv = new Cv(EW, DESK + 1);
  for (let y = 0; y <= DESK; y++) for (let x = 0; x < EW; x++) {
    const rx = x - SIDE;
    let v = 0.5 + 0.08 * (vnoise(x, y, 3, 60) - 0.5) + 0.06 * (vnoise(x, y / 7, 5, 3) - 0.5) + 0.03 * (hash(x, y, 9) - 0.5);
    // the panel seams: a dark line with a lit edge beside it
    const side = closet(rx, y);
    if (side !== null) v = side;
    cv.put(x, y, cell(WALLR, v, 0, 'wall', { noOutline: true }));
  }
  return asset('wall', -SIDE, 0, cv, { outline: false, dither: 1, fine: true });
}

function desk() {
  const H = GH - DESK, cv = new Cv(EW, H);
  // planks running across, narrower toward the back
  const seams = [0, 9, 20, 33, 48, 66, 90];
  for (let y = 0; y < H; y++) for (let x = 0; x < EW; x++) {
    const Y = y + DESK;
    let v;
    if (y < 2) v = 0.14; // where the desk meets the wall
    else if (Y >= FRONT) v = 0.28 + 0.06 * (vnoise(x, Y, 13, 20) - 0.5) - 0.04 * (Y - FRONT);
    else if (Y >= LIP) v = Y === LIP ? 0.95 : 0.78;
    else {
      const p = seams.findIndex((s, i) => y >= s && (i === seams.length - 1 || y < seams[i + 1]));
      const joint = (x + p * 173) % (230 + p * 37) === 0;
      if (seams.includes(y) || joint) v = 0.3;
      else v = 0.55 + 0.1 * Math.sin(x * 0.035 + p * 1.7 + 2.6 * vnoise(x, y * 4, 11 + p, 40)) + 0.05 * (hash(x, y, 17) - 0.5) - 0.06 * (1 - y / (LIP - DESK));
    }
    const side = closet(x - SIDE, Y);
    if (side !== null) { cv.put(x, y, cell(WALLR, side, 0, 'wall', { noOutline: true })); continue; }
    cv.put(x, y, cell(WOOD, v, 0, 'desk', { noOutline: true }));
  }
  return asset('desk', -SIDE, DESK, cv, { outline: false, dither: 1, fine: true });
}

function deck(name, x0, y0, x1, y1, face, lift = 0.52) {
  const W = x1 - x0 + 1, H = y1 - y0 + 1, cv = new Cv(W, H), r = H / 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = x < r ? x - r : x > W - 1 - r ? x - (W - 1 - r) : 0, dy = y - (H - 1) / 2;
    const d = Math.hypot(dx, dy) / r;
    if (d > 1) continue;
    const edge = (1 - d) * r; // px in from the edge
    if (edge < 6) {
      const k = Math.hypot(dx, dy) || 1, n = norm([dx / k * 0.9, dy / k * 0.9, 0.5 + edge / 12]);
      cv.put(x, y, cell(RIM, light(n, { spec: 0.4 }) * 1.05, 1.2, 'rim'));
    } else {
      const v = lift + 0.08 * (1 - y / H) - 0.06 * (x / W) + 0.03 * (vnoise(x, y, 41, 12) - 0.5);
      cv.put(x, y, cell(face, v, 1, 'face'));
    }
  }
  return asset(name, x0, y0, cv);
}

function bracket(name, x, y) {
  const cv = new Cv(16, 8);
  for (let j = 0; j < 8; j++) for (let i = 0; i < 16; i++) {
    const screw = (i === 3 || i === 12) && j === 4;
    cv.put(i, j, cell(CHROME, screw ? 0.2 : 0.62 - j * 0.04 - i * 0.008, 1, 'plate'));
  }
  return asset(name, x, y, cv);
}

function poster() {
  const [x0, y0] = M(950, 283), [x1, y1] = M(1070, 437), W = x1 - x0, H = y1 - y0, cv = new Cv(W, H), F = 5;
  const iw = W - 2 * F, ih = H - 2 * F;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ix = x - F, iy = y - F;
    if (ix < 0 || iy < 0 || ix >= iw || iy >= ih) {
      const top = y < F, left = x < F;
      cv.put(x, y, cell(IRON, top || left ? 0.55 : 0.3, 1.2, 'frame'));
      continue;
    }
    const t = iy / ih;
    // the night: sky, a crescent moon, stars, two teal peaks, dark hills with pines
    let c = cell(SKY, 0.5 + 0.35 * t, 1, 'pic', { noOutline: true });
    const moon = Math.hypot(ix - iw * 0.72, iy - ih * 0.2) <= 8 && Math.hypot(ix - iw * 0.72 + 4, iy - ih * 0.2 + 3) > 7;
    if (moon) c = cell(GOLD, 0.82, 1.1, 'moon', { noOutline: true });
    else if (hash(ix, iy, 77) > 0.996 && t < 0.5) c = cell(GOLD, 0.9, 1.1, 'star', { noOutline: true });
    const peak = (px, py, w) => py + Math.abs(ix - px) * (ih * 0.42 - py) / w;
    const ridge = Math.min(peak(iw * 0.32, ih * 0.38, iw * 0.4), peak(iw * 0.66, ih * 0.44, iw * 0.38));
    if (iy >= ridge) {
      const lit = ix < (iy < ih * 0.6 ? iw * 0.32 : iw * 0.66);
      c = cell(MOUNT, 0.6 + (lit ? 0.14 : 0) - 0.15 * ((iy - ridge) / ih), 1.2, 'mount', { noOutline: true });
    }
    const hill = ih * 0.74 + 4 * Math.sin(ix * 0.12);
    const pine = [0.16, 0.44, 0.82].some((p) => { const px = iw * p, top = hill - 14; return iy >= top && iy < hill + 2 && Math.abs(ix - px) <= (iy - top) * 0.32; });
    if (iy >= hill || pine) c = cell(GLAZE.forest, 0.3 + (iy >= hill ? 0.1 * (1 - (iy - hill) / ih) : 0), 1.3, 'hill', { noOutline: true });
    cv.put(x, y, c);
  }
  return asset('poster', x0, y0, cv);
}

function headset() {
  const X = 1088, Y = 96, W = 110, H = 170, cv = new Cv(W, H), cx = 55;
  // the hook: a plate on the wall with a prong
  for (let y = 3; y <= 24; y++) for (let x = 44; x <= 64; x++) {
    const screw = (y === 8 || y === 19) && x === 54;
    cv.put(x, y, cell(PLASTIC, screw ? 0.2 : 0.42 - (y - 3) * 0.006, 1, 'hook'));
  }
  // the headband over it
  const bcx = cx, bcy = 98, rx = 38, ry = 76;
  for (let y = 0; y < bcy; y++) for (let x = 0; x < W; x++) {
    const e = Math.hypot((x - bcx) / rx, (y - bcy) / ry);
    if (e > 1 || e < 0.84) continue;
    const k = (e - 0.84) / 0.16, n = norm([(x - bcx) / rx, (y - bcy) / ry, 0.4 + Math.sin(k * Math.PI)]);
    cv.put(x, y, cell(LEATHER.black, light(n, { spec: 0.6 }) * 1.05, 2, 'band'));
  }
  // the yokes and the cups, the right one with the logo
  for (const ux of [cx - 33, cx + 33]) {
    for (let y = 92; y <= 104; y++) for (let x = ux - 2; x <= ux + 2; x++) cv.put(x, y, cell(CHROME, 0.4 + (ux - x) * 0.05, 2.2, 'yoke'));
    for (let y = 96; y < H; y++) for (let x = ux - 21; x <= ux + 21; x++) {
      const ex = (x - ux) / 20, ey = (y - 132) / 36, e = ex * ex + ey * ey;
      if (e > 1) continue;
      const n = norm([ex, ey, Math.sqrt(1 - Math.min(1, e))]);
      const inner = (ex / 0.7) ** 2 + (ey / 0.78) ** 2 <= 1;
      const logo = ux > cx && Math.hypot(x - ux, y - 136) <= 5;
      if (logo) {
        const xmark = Math.abs(Math.abs(x - ux) - Math.abs(y - 136)) <= 0.6;
        cv.put(x, y, { col: xmark ? '#0f3a16' : '#46c454', z: 3, part: 'logo', glow: true });
      } else cv.put(x, y, cell(inner ? PLASTIC : LEATHER.black, light(n, { spec: 0.8, shin: 20 }) * (inner ? 1.05 : 0.95), inner ? 2.6 : 2.4, inner ? 'shell' : 'cup'));
    }
  }
  return asset('headset', X, Y, cv);
}

/** A Catmull-Rom spline through points, sampled every half pixel. */
function spline(pts) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 2);
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  return out;
}

function cable() {
  const X = 1120, Y = 255, cv = new Cv(80, 310);
  const pts = [[1173, 262], [1171, 298], [1164, 324], [1164, 346], [1169, 420], [1173, 482], [1177, 530], [1171, 550], [1150, 557], [1125, 558]];
  for (const [px, py] of spline(pts)) {
    const x = Math.round(px - X), y = Math.round(py - Y);
    cv.put(x, y, cell(PLASTIC, 0.5, 1, 'cord', { noOutline: true }));
    cv.put(x + 1, y, cell(PLASTIC, 0.3, 0.9, 'cord', { noOutline: true }));
  }
  // the inline remote
  for (let y = 326 - Y; y <= 342 - Y; y++) for (let x = 1161 - X; x <= 1168 - X; x++) cv.put(x, y, cell(PLASTIC, 0.45 - (x - (1161 - X)) * 0.03, 2, 'remote'));
  return asset('cable', X, Y, cv);
}

function lamp(on) {
  const X = 97, Y = 214, W = 172, H = 326, cv = new Cv(W, H), cx = 85;
  const shTop = 12, shBot = 108;
  // the shade: stained glass in leaded panes, a bronze rim, a finial
  for (let y = shTop; y <= shBot; y++) {
    const t = (y - shTop) / (shBot - shTop), hw = 18 + 65 * Math.pow(t, 0.75);
    for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
      const u = (x - cx) / hw; if (Math.abs(u) > 1) continue;
      if (y >= shBot - 7) { cv.put(x, y, cell(BRONZE, cyl(u, { spec: 0.6 }) * (y === shBot - 7 ? 1.2 : 0.9), 2, 'rim')); continue; }
      const pane = Math.floor((u + 1) * 3), paneL = Math.floor(((x - 1 - cx) / hw + 1) * 3);
      const band = Math.floor(t * 3), bandU = Math.floor(((y - 1 - shTop) / (shBot - shTop)) * 3);
      if ((pane !== paneL && x > cx - hw + 1) || (band !== bandU && y > shTop)) { cv.put(x, y, cell(BRONZE, 0.18, 2.1, 'lead', { noOutline: true })); continue; }
      const alt = (pane + band) % 2 ? 0.08 : 0;
      const v = on ? 0.98 - 0.32 * Math.abs(u) - 0.12 * t - alt : 0.42 - 0.12 * Math.abs(u) - alt * 0.6;
      cv.put(x, y, cell(GLASS, v, 2, 'glass', on ? { glow: true } : {}));
    }
  }
  for (let y = 2; y < shTop; y++) for (let x = cx - 6; x <= cx + 6; x++) {
    const hw = y < 6 ? 3 : y < 9 ? 5 : 7, u = (x - cx) / hw;
    if (Math.abs(u) <= 1) cv.put(x, y, cell(BRONZE, cyl(u, { spec: 0.8 }), 2.2, 'finial'));
  }
  // the pull chain
  for (let y = shBot; y < 166; y += 2) cv.put(cx + 32, y, cell(GOLD, 0.6, 2.5, 'chain', { noOutline: true }));
  for (let y = 166; y < 170; y++) for (let x = cx + 31; x <= cx + 33; x++) cv.put(x, y, cell(GOLD, cyl((x - cx - 32) / 1.5, { spec: 1 }), 2.6, 'bead'));
  // the stem: socket, a vase, rings, a column, and the stepped round foot
  const prof = (y) => {
    if (y < 116) return 6; if (y < 122) return 9; if (y < 130) return 8;
    if (y < 212) return 8 + 15 * Math.pow(Math.sin(Math.PI * (y - 130) / 82), 0.8);
    if (y < 216) return 11; if (y < 264) return 7; if (y < 270) return 12; if (y < 276) return 9;
    if (y < 292) return 9 + 25 * ss((y - 276) / 16);
    if (y < 316) return 34 + 24 * Math.pow((y - 292) / 24, 0.6);
    return 61;
  };
  for (let y = shBot + 1; y < H - 1; y++) {
    const hw = prof(y), slope = prof(y + 1) - prof(y - 1);
    for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
      const u = (x - cx) / hw; if (Math.abs(u) > 1) continue;
      const n = norm([u, -0.25 - slope * 0.25, Math.sqrt(Math.max(0, 1 - u * u))]);
      cv.put(x, y, cell(BRONZE, light(n, { spec: 0.9, shin: 18 }) * (on ? 1.08 : 1), 1, 'stem'));
    }
  }
  return asset(on ? 'lamp' : 'lamp-off', X, Y, cv);
}

function monitor() {
  const [X, Y] = [457, 232], W = 344, H = 232, cv = new Cv(W, H);
  const G = [27, 17, 320, 211]; // the glass, local px
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = rrect(x, y, 0, 0, W - 1, H - 1, 16);
    if (d < 0) continue;
    const g = rrect(x, y, G[0], G[1], G[2], G[3], 9);
    if (g >= 0) { cv.put(x, y, { col: '#05160c', z: 3, part: 'glass', glow: true }); continue; }
    if (d < 5) { cv.put(x, y, cell(RIM, (d < 1.5 ? 0.5 : 0.8) - (y / H) * 0.12 - (x / W) * 0.1, 1.2, 'rim')); continue; }
    if (g > -6) { const lit = y < G[1] + 2 || x < G[0] + 2; cv.put(x, y, cell(PLASTIC, g > -2 && lit ? 0.5 : 0.2, 2, 'bezel')); continue; }
    cv.put(x, y, cell(PLASTIC, 0.36 - 0.1 * (y / H) + 0.02 * (vnoise(x, y, 51, 8) - 0.5), 1, 'case'));
  }
  // the buttons along the bottom, and the power light
  for (let i = 0; i < 4; i++) for (let y = 219; y <= 221; y++) for (let x = 18 + i * 8; x <= 22 + i * 8; x++) cv.put(x, y, cell(PLASTIC, 0.15, 2.5, 'btn' + i));
  for (let y = 219; y <= 221; y++) for (let x = 316; x <= 320; x++) cv.put(x, y, { col: '#43f07e', z: 2.5, part: 'led', glow: true });
  return asset('monitor', X, Y, cv);
}

function monitorStand() {
  const cv = new Cv(150, 8);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 150; x++) { const inset = y * 2; if (x >= inset && x < 150 - inset) cv.put(x, y, cell(PLASTIC, 0.3 - y * 0.02, 1, 'stand')); }
  return asset('monitor-stand', 554, 461, cv);
}

function book(name, x0, y0, x1, y1, ramp) {
  const W = x1 - x0, H = y1 - y0, cv = new Cv(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = 0.42 + 0.14 * Math.sin(Math.PI * (y + 0.5) / H) + 0.03 * (vnoise(x, y, 61, 10) - 0.5) - 0.06 * (x / W);
    if (y === 0) v = 0.7; else if (y >= H - 2) v = 0.24;
    if (x < 3 || x >= W - 3) v -= 0.12;
    let c = cell(ramp, v, 1, 'spine');
    // gilt bands near the ends, and an emblem toward the right
    if ((x === 7 || x === W - 8) && y > 2 && y < H - 3) c = cell(GOLD, 0.55, 1.2, 'gilt', { noOutline: true });
    const ex = W - 24, ey = (H - 1) / 2, rr = Math.hypot(x - ex, y - ey);
    if (rr <= 6 && rr > 4.6) c = cell(GOLD, 0.6, 1.2, 'gilt', { noOutline: true });
    cv.put(x, y, c);
  }
  return asset(name, x0, y0, cv);
}

function keyboard() {
  const [X, Y] = [409, 559], W = 419, H = 66, cv = new Cv(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = rrect(x, y, 0, 0, W - 1, H - 1, 6);
    if (d < 0) continue;
    const v = y >= H - 7 ? 0.18 : d < 2 && (y < 3 || x < 3) ? 0.6 : 0.3;
    cv.put(x, y, cell(PLASTIC, v, 1, 'case'));
  }
  const u = 19.4, rows = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2], [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5],
    [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25], [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75], [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25]];
  const key = (kx0, ky0, kw, dark) => {
    for (let y = 0; y < 10; y++) for (let x = 0; x < Math.round(kw) - 2; x++) {
      const top = y < 7, v = top ? (y === 0 ? 0.62 : 0.4 - y * 0.02) - (dark ? 0.1 : 0) : 0.16;
      cv.put(kx0 + x, ky0 + y, cell(GLAZE.forest, x === Math.round(kw) - 3 && top ? v - 0.12 : v, 2 + ky0 * 0.001, 'k' + kx0 + '-' + ky0));
    }
  };
  rows.forEach((r, j) => { let kx = 12; r.forEach((w, i) => { key(Math.round(kx), 6 + j * 11, w * u, w > 1 && w < 6); kx += w * u; }); });
  for (let j = 0; j < 5; j++) for (let i = 0; i < 4; i++) key(Math.round(318 + i * 22), 6 + j * 11, 22, i === 3);
  return asset('keyboard', X, Y, cv);
}

function coaster(cx, cy) {
  const W = 104, H = 26, cv = new Cv(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const e = Math.hypot((x - W / 2 + 0.5) / 51, (y - 10) / 10);
    if (e <= 1) cv.put(x, y, cell(CORK, e > 0.82 ? 0.7 - (y - 10) * 0.03 : 0.42 + 0.04 * (hash(x, y, 8) - 0.5), 1, 'cork'));
    else if (y > 10 && Math.abs((x - W / 2 + 0.5) / 51) <= 1 && y <= 10 + 10 * Math.sqrt(Math.max(0, 1 - ((x - W / 2 + 0.5) / 51) ** 2)) + 3) cv.put(x, y, cell(CORK, 0.25, 0.9, 'side'));
  }
  return asset('coaster', cx - W / 2, cy - 10, cv);
}

function catCup() {
  const X = 220, Y = 488, W = 54, H = 54, cv = new Cv(W, H), cx = 26.5;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = (x - cx) / 24;
    const top = 6 + 3 * Math.sqrt(Math.max(0, 1 - u * u));
    if (Math.abs(u) > 1) continue;
    const opening = ((x - cx) / 24) ** 2 + ((y - 6) / 4) ** 2 <= 1;
    if (opening) { cv.put(x, y, cell(POT.terracotta, ((x - cx) / 21) ** 2 + ((y - 6) / 3) ** 2 <= 1 ? 0.06 : 0.7, 2, 'mouth')); continue; }
    if (y < top || y > H - 2) continue;
    let c = cell(POT.terracotta, cyl(u, { spec: 0.4 }) * 0.72, 1, 'cup');
    // the cat
    const hx = x - cx, hy = y - 32, head = (hx / 10) ** 2 + (hy / 8.5) ** 2 <= 1;
    const ear = (hy < -5 && hy > -13 && Math.abs(Math.abs(hx) - 6) <= (hy + 13) * 0.45);
    if (head || ear) {
      c = cell(PAPER.orange, 0.62 - hy * 0.01, 1.3, 'cat', { noOutline: true });
      if ((Math.abs(hx + 4) <= 0.6 || Math.abs(hx - 4) <= 0.6) && hy >= -2 && hy <= -1) c = { col: '#2a1208', z: 1.4, part: 'eye' };
      if (Math.abs(hx) <= 0.6 && hy === 2) c = { col: '#7a3020', z: 1.4, part: 'nose' };
      if (hy === 4 && (hx === -1.5 || hx === 1.5 || Math.abs(Math.abs(hx) - 1.5) < 0.6)) c = { col: '#5a2414', z: 1.4, part: 'mouth' };
    }
    cv.put(x, y, c);
  }
  return asset('cat-cup', X, Y, cv);
}

/** The three pens in the cat cup, each its own sprite on one shared canvas, standing on their bases. */
function pens() {
  const X = 224, Y = 452, W = 48, H = 46;
  const spec = [[12, 45, 5, 4, IRON, GOLD], [24, 45, 25, 0, NAVY, CHROME], [36, 45, 45, 8, GLAZE.ember, GOLD]];
  return spec.map(([bx, by, tx, ty, body, trim], k) => {
    const cv = new Cv(W, H), len = Math.hypot(tx - bx, ty - by);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = ((x - bx) * (tx - bx) + (y - by) * (ty - by)) / (len * len);
      if (t < 0 || t > 1) continue;
      const off = ((x - bx) * (ty - by) - (y - by) * (tx - bx)) / len;
      if (Math.abs(off) > 2.2) continue;
      const cap = t > 0.72, clip = cap && off > 1 && t < 0.9;
      cv.put(x, y, cell(clip ? trim : body, cyl(off / 2.2, { spec: 1 }) * (cap ? 1.08 : 0.95), clip ? 2 : 1, clip ? 'clip' : 'pen'));
    }
    const a = asset('pen-' + (k + 1), X, Y, cv);
    a.origin = [+(((bx + 0.5) / W) * 100).toFixed(2), 100];
    return a;
  });
}

function mousepad() {
  const [X, Y] = [833, 570], W = 221, H = 59, cv = new Cv(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = rrect(x, y, 0, 0, W - 1, H - 1, 7);
    if (d < 0) continue;
    const stitch = d >= 2.5 && d < 3.5 && (x + y) % 3 !== 0;
    cv.put(x, y, cell(LEATHER.black, stitch ? 0.62 : 0.34 + 0.04 * (hash(x, y, 4) - 0.5), 1, 'pad', { noOutline: d > 1 }));
  }
  return asset('mousepad', X, Y, cv);
}

const WHITE = ['#2e2c30', '#7c7a80', '#aeacb2', '#cac8cc', '#dedce0', '#eeecef', '#fbfaf9'];
const SPACE = ['#0a0a0c', '#26262a', '#3c3c42', '#55555c', '#707078', '#90909a', '#b8b8c0'];

/** A shape's height field from its mask: how far in from the edge (capped), so it shades as a soft dome. */
function dome(W, H, inside, cap) {
  const h = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inside(x, y)) continue;
    let d = cap;
    for (let dy = -cap; dy <= cap; dy++) for (let dx = -cap; dx <= cap; dx++) { const r = Math.hypot(dx, dy); if (r < d && !inside(x + dx, y + dy)) d = r; }
    h[y * W + x] = Math.sqrt(d / cap);
  }
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : h[y * W + x]);
  return { h: at, n: (x, y) => norm([(at(x - 1, y) - at(x + 1, y)) * cap * 0.35, (at(x, y - 1) - at(x, y + 1)) * cap * 0.35, 1]) };
}

/** An iPad lying on the desk, screen off, with a white Apple Pencil across it. */
function ipad() {
  const X = 26, Y = 546, W = 242, H = 92, cv = new Cv(W, H), cx = 121, cy = 46, hw = 86, hh = 28, a = (8 * Math.PI) / 180;
  const ca = Math.cos(a), sa = Math.sin(a);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = x - cx, dy = y - cy, u = dx * ca - dy * sa, v = dx * sa + dy * ca;
    const d = rrect(u, v, -hw, -hh, hw, hh, 7);
    if (d < 0) { if (rrect(u, v - 3, -hw, -hh, hw, hh, 7) >= 0) cv.put(x, y, cell(SPACE, 0.4, 1, 'side', { neutral: true })); continue; }
    if (d < 2.5) { cv.put(x, y, cell(SPACE, 0.78 - 0.25 * ((v + hh) / (2 * hh)), 1.1, 'rim', { neutral: true })); continue; }
    // the black bezel round the glass, the front camera on the long side
    if (Math.min((u + hw) / 6, (hw - u) / 6, (v + hh) / 4.5, (hh - v) / 4.5) < 1) {
      const cam = Math.hypot(u + hw - 3, v) < 1.3;
      cv.put(x, y, cell(IRON, cam ? 0.5 : 0.04, 1.2, 'glass', { noOutline: true }));
      continue;
    }
    // the screen, asleep: blue-black glass with a soft streak of reflection across it
    const s = u * 0.32 - v + 6, streak = Math.abs(s) < 7 ? 0.14 * (1 - Math.abs(s) / 7) : 0;
    cv.put(x, y, cell(NAVY, 0.3 + 0.12 * ((u + hw) / (2 * hw)) + 1.6 * streak, 1.2, 'glass', { noOutline: true, neutral: true }));
  }
  // the Apple Pencil: a long white cylinder with one flat side, a tapered grey tip
  const P0 = [82, 60], P1 = [184, 38], len = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]), R = 2.6, pen = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = ((x - P0[0]) * (P1[0] - P0[0]) + (y - P0[1]) * (P1[1] - P0[1])) / (len * len);
    if (t < 0 || t > 1) continue;
    const off = ((x - P0[0]) * (P1[1] - P0[1]) - (y - P0[1]) * (P1[0] - P0[0])) / len;
    const r = t < 0.09 ? 0.7 + (R - 0.7) * (t / 0.09) : R;
    if (Math.abs(off) > r) continue;
    const tip = t < 0.03, flat = off > R * 0.45 && !tip;
    const v = tip ? 0.35 : flat ? 0.62 : cyl(off / r, { spec: 0.8, shin: 16 }) * 1.25;
    cv.put(x, y, cell(tip ? SPACE : WHITE, v, 3, 'pencil', { neutral: true }));
    pen.push([x, y]);
  }
  // its shadow on the glass
  for (const [x, y] of pen) { const c = cv.get(x + 1, y + 2); if (c && c.part !== 'pencil') cv.put(x + 1, y + 2, cell(IRON, 0.04, 1.25, 'shadow', { noOutline: true })); }
  return asset('ipad', X, Y, cv);
}

/** A black wireless mouse, Logitech-style: an egg, narrower at the front, two buttons and a wheel. */
function mouse() {
  const [X, Y] = [920, 560], W = 52, H = 60, cv = new Cv(W, H), cx = 26;
  const half = (y) => { const t = (y - 3) / 52; if (t < 0 || t > 1) return 0; return 22 * Math.sqrt(Math.max(0, 1 - ((t - 0.55) / 0.55) ** 2)) * (0.78 + 0.22 * t); };
  const inside = (x, y) => Math.abs(x - cx) <= half(y);
  const { n } = dome(W, H, inside, 9);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inside(x, y)) continue;
    const ex = (x - cx) / Math.max(1, half(y));
    let c = cell(PLASTIC, light(n(x, y), { spec: 1.1, shin: 24 }) * (Math.abs(ex) > 0.78 ? 0.75 : 1.05), 1, 'shell');
    const split = 24 - 0.02 * (x - cx) ** 2; // where the buttons end and the palm begins
    if (x === cx && y < split) c = cell(PLASTIC, 0.12, 1.2, 'seam', { noOutline: true });
    if (Math.abs(x - cx) <= 1.5 && y >= 9 && y <= 16) c = cell(PLASTIC, y % 2 ? 0.25 : 0.5, 1.3, 'wheel', { noOutline: true });
    cv.put(x, y, c);
  }
  return asset('mouse', X, Y, cv);
}

/** An Xbox One: glossy top on the left, vented on the right; the disc slot along the front, the lit logo. */
function xbox() {
  const [X, Y] = [916, 480], W = 218, H = 77, cv = new Cv(W, H), split = 132, TOP = 10;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (rrect(x, y, 0, 0, W - 1, H - 1, 2) < 0) continue;
    let c;
    if (y < TOP) {
      if (x < split) c = cell(PLASTIC, 0.3 + (Math.abs(x - 2.2 * y - 40) < 6 ? 0.16 : 0), 1.1, 'top-gloss');
      else c = cell(PLASTIC, (x + 2 * y) % 4 < 2 ? 0.12 : 0.34, 1.1, 'top-vent', { noOutline: true });
      if (y === TOP - 1) c = cell(PLASTIC, 0.55, 1.15, 'edge', { noOutline: true });
    } else if (x < split) {
      c = cell(PLASTIC, 0.22 + 0.02 * (hash(x, y, 5) - 0.5) - 0.04 * ((y - TOP) / H), 1, 'front-matte');
      // the disc slot, a port and the eject button
      if (y === 46 && x > 10 && x < 96) c = cell(PLASTIC, 0.02, 1.2, 'slot', { noOutline: true });
      if (y === 47 && x > 10 && x < 96) c = cell(PLASTIC, 0.38, 1.2, 'slot', { noOutline: true });
      if (y >= 58 && y <= 61 && x >= 12 && x <= 18) c = cell(PLASTIC, y === 58 ? 0.4 : 0.06, 1.2, 'usb', { noOutline: true });
      if (Math.hypot(x - 104, y - 46) < 1.6) c = cell(PLASTIC, 0.45, 1.2, 'eject', { noOutline: true });
    } else {
      const gloss = Math.abs((x - split) - (y - TOP) * 0.9 - 10) < 7 ? 0.14 : 0;
      c = cell(PLASTIC, 0.15 + gloss, 1, 'front-gloss');
    }
    if (x === split && y >= TOP) c = cell(PLASTIC, 0.04, 1.2, 'seam', { noOutline: true });
    if (y >= H - 2) c = cell(PLASTIC, 0.08, 1.2, 'foot');
    const lr = Math.hypot(x - 178, y - 44);
    if (lr <= 5.5) c = { col: Math.abs(Math.abs(x - 178) - Math.abs(y - 44)) <= 0.7 && lr < 4.6 ? '#8c9290' : '#f2f4f0', z: 2, part: 'logo', glow: true };
    cv.put(x, y, c);
  }
  return asset('xbox', X, Y, cv);
}

/** An Xbox One controller: the wide top with its bumpers, two grips, offset sticks, d-pad, ABXY, the lit guide button. */
function controller() {
  const [X, Y] = [1043, 548], W = 142, H = 68, cv = new Cv(W, H);
  const e = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
  const inside = (x, y) => {
    const top = e(x, y, 71, 25, 57, 19) <= 1, gl = e(x, y, 31, 43, 23, 22) <= 1, gr = e(x, y, 111, 43, 23, 22) <= 1;
    return (top && e(x, y, 71, 64, 30, 21) > 1) || gl || gr;
  };
  const { n } = dome(W, H, inside, 8);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inside(x, y)) continue;
    let c = cell(PLASTIC, light(n(x, y), { spec: 0.9, shin: 20 }) * 1.12, 1, 'body');
    // the bumpers along the top edge
    if (y < 11 && (x < 55 || x > 87) && !inside(x, y - 3)) c = cell(PLASTIC, 0.46 - y * 0.02, 1.4, x < 71 ? 'lb' : 'rb');
    // the thumbsticks: a dark well, a concave cap with a grip ring
    for (const [sx, sy] of [[43, 24], [89, 41]]) {
      const r = Math.hypot(x - sx, y - sy);
      if (r <= 8.5) c = r > 6.5 ? cell(PLASTIC, 0.04, 1.5, 'well' + sx, { noOutline: true })
        : cell(PLASTIC, (r > 5 ? 0.42 : 0.24 + 0.1 * ((x - sx) + (y - sy)) / 6) + (r > 5 && r < 5.8 ? 0.1 : 0), 1.6, 'stick' + sx);
    }
    // the d-pad in its round well
    const dx = x - 56, dy = y - 41, dr = Math.hypot(dx, dy);
    if (dr <= 7.5) c = cell(PLASTIC, 0.08, 1.5, 'dwell', { noOutline: true });
    if ((Math.abs(dx) <= 1.6 && Math.abs(dy) <= 6) || (Math.abs(dy) <= 1.6 && Math.abs(dx) <= 6)) c = cell(PLASTIC, 0.36 - (dx + dy) * 0.02, 1.6, 'dpad');
    // A B X Y: dark caps with their coloured letters
    for (const [bx, by, col] of [[105, 17, '#e8c43a'], [98, 24, '#3a7ae0'], [112, 24, '#e04a3a'], [105, 31, '#4ac85a']]) {
      const r = Math.hypot(x - bx, y - by);
      if (r <= 3.2) c = r <= 1.4 ? { col, z: 1.8, part: 'btn' + bx + by, glow: true } : cell(PLASTIC, 0.2 + (y < by ? 0.15 : 0), 1.7, 'btn' + bx + by);
    }
    // view and menu
    for (const bx of [63, 79]) if (Math.hypot(x - bx, y - 25) <= 1.7) c = cell(PLASTIC, 0.5, 1.6, 'vm' + bx);
    // the guide button, lit
    const gr = Math.hypot(x - 71, y - 13);
    if (gr <= 5) c = gr > 4 ? cell(CHROME, 0.4, 1.7, 'guide-ring') : { col: Math.abs(Math.abs(x - 71) - Math.abs(y - 13)) <= 0.7 && gr < 3.4 ? '#8c9290' : '#f2f4f0', z: 1.8, part: 'guide', glow: true };
    cv.put(x, y, c);
  }
  return asset('controller', X, Y, cv);
}

// ------------------------------------------------------------------------------------------------
// layout, composition and light
// ------------------------------------------------------------------------------------------------

const [d1x0, d1y0] = M(383, 8), [d1x1, d1y1] = M(915, 128), [d2x0, d2y0] = M(386, 140), [d2x1, d2y1] = M(911, 258);
const books = [[475, 468, 776, 497, BOOK.green], [471, 497, 779, 525, NAVY], [468, 525, 785, 553, BOOK.rust]];
const MUG_BODY_X = 306, MUG_BASE_Y = 555; // pixels: the mug's middle and where its base meets the desk

const lampOn = lamp(true), lampOff = lamp(false);
const wallLayer = wall(), deskLayer = desk();
const wallItems = [
  deck('deck-green', d1x0, d1y0, d1x1, d1y1, GLAZE.forest, 0.56), deck('deck-rose', d2x0, d2y0, d2x1, d2y1, ROSE, 0.74),
  ...[533, 731].flatMap((bx, i) => [bracket('bracket-' + (2 * i + 1), bx - 8, d1y1 + 1), bracket('bracket-' + (2 * i + 2), bx - 8, d2y1 + 1)]),
  poster(), headset(),
];
const deskBack = [cable(), catCup(), monitorStand(), monitor(), ...books.map(([a, b, c, d, r], i) => book('book-' + (i + 1), a, b, c, d, r)), coaster(MUG_BODY_X, MUG_BASE_Y), xbox()];
const deskFront = [ipad(), keyboard(), mousepad(), mouse(), controller()];
const penSprites = pens();

/** Soft shadows: the contact shadows under things on the desk, and what the wall items cast (light from the lamp, upper left). */
function occlusion() {
  const occ = new Float32Array(EW * GH).fill(1);
  const darken = (x, y, f) => { const X = x + SIDE; if (X >= 0 && X < EW && y >= 0 && y < GH) occ[y * EW + X] = Math.min(occ[y * EW + X], f); };
  // the wall darkens toward the desk's back edge
  for (let y = DESK - 14; y < DESK; y++) for (let x = -SIDE; x < GW + SIDE; x++) darken(x, y, 1 - 0.3 * ss((y - (DESK - 14)) / 14));
  for (const a of [...wallItems, monitorLike()]) for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    if (a.px[(y * a.w + x) * 4 + 3] < 128) continue;
    for (let k = 1; k <= 6; k++) darken(a.x + x + k, a.y + y + Math.round(k * 0.6), 0.62 + k * 0.05);
  }
  const blob = (cx, cy, rx, ry, f) => { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (e <= 1) darken(x, y, f + (1 - f) * e * e); } };
  blob(182, 540, 72, 7, 0.45); // the lamp's foot
  blob(250, 541, 32, 5, 0.5); // the cat cup
  blob(630, 557, 175, 7, 0.5); // the books
  blob(1028, 557, 120, 7, 0.45); // the console
  blob(310, 560, 58, 8, 0.55); // the coaster
  blob(875, 549, 50, 6, 0.55); // the plant's pot
  blob(1148, 543, 34, 5, 0.5); // the lava lamp
  blob(148, 606, 100, 22, 0.7); blob(620, 625, 215, 8, 0.6); blob(945, 626, 115, 6, 0.65); blob(948, 618, 40, 7, 0.55); blob(1116, 614, 70, 7, 0.55);
  return occ;
}
function monitorLike() { return deskBack.find((a) => a.name === 'monitor'); }

/** The light falling on each pixel, per channel, lamp on or off. */
function lightAt(x, y, on, self = 1) {
  const amb = on ? [0.6, 0.52, 0.52] : [0.4, 0.37, 0.45];
  const g = (cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2) - ((y - cy) / sy) ** 2);
  let r = amb[0], gg = amb[1], b = amb[2];
  if (on) {
    const wallLamp = 1.35 * g(182, 290, 175, 230) + 0.25 * g(182, 300, 420, 400), deskLamp = y >= DESK ? 0.95 * g(230, 575, 260, 90) : 0, cone = y > 330 && y < DESK ? 0.3 * g(182, 440, 110, 110) : 0;
    const k = (wallLamp + deskLamp + cone) * self;
    r += 0.95 * k; gg += 0.52 * k; b += 0.2 * k;
  }
  const mon = (on ? 0.22 : 0.36) * g(628, 360, 280, 220) + (y >= DESK ? (on ? 0.2 : 0.32) * g(628, 590, 260, 60) : 0);
  r += 0.12 * mon; gg += 0.55 * mon; b += 0.28 * mon;
  const lava = (on ? 0.42 : 0.6) * g(1148, 460, 110, 140) * (y > DESK ? 0.4 : 1);
  r += 0.7 * lava; gg += 0.16 * lava; b += 0.5 * lava;
  const top = 0.78 + 0.22 * ss(y / 320);
  return [r * top, gg * top, b * top];
}

function compose(on) {
  const out = new Float32Array(EW * GH * 3), glow = new Uint8Array(EW * GH), shaded = new Uint8Array(EW * GH), neutral = new Uint8Array(EW * GH);
  const blit = (a, mark = 0) => {
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
      const si = (y * a.w + x) * 4, al = a.px[si + 3] / 255;
      if (!al) continue;
      const X = a.x + x + SIDE, Y = a.y + y;
      if (X < 0 || X >= EW || Y < 0 || Y >= GH) continue;
      const o = (Y * EW + X) * 3;
      for (let c = 0; c < 3; c++) out[o + c] = out[o + c] * (1 - al) + a.px[si + c] * al;
      glow[Y * EW + X] = al > 0.5 ? a.glow[y * a.w + x] : glow[Y * EW + X];
      if (al > 0.5) { shaded[Y * EW + X] = mark; neutral[Y * EW + X] = a.neutral ? a.neutral[y * a.w + x] : 0; }
    }
  };
  blit(wallLayer); blit(deskLayer);
  wallItems.forEach(blit);
  blit(on ? lampOn : lampOff, 1);
  deskBack.forEach(blit);
  deskFront.forEach(blit);
  const occ = occlusion(), img = Buffer.alloc(EW * GH * 3);
  for (let y = 0; y < GH; y++) for (let X = 0; X < EW; X++) {
    const i = y * EW + X, o = i * 3;
    if (glow[i]) { for (let c = 0; c < 3; c++) img[o + c] = clamp(Math.round(out[o + c]), 0, 255); continue; }
    let L = lightAt(X - SIDE, y, on, shaded[i] ? 0.3 : 1);
    if (neutral[i]) { const m = (L[0] + L[1] + L[2]) / 3; L = [m * 1.04, m, m * 0.95]; }
    const b = BAYER[y & 3][X & 3];
    for (let c = 0; c < 3; c++) {
      const q = Math.floor(L[c] * occ[i] * 10 + b) / 10; // light in steps, dithered between them
      img[o + c] = clamp(Math.round(out[o + c] * q), 0, 255);
    }
  }
  return img;
}

const crop = (img, x0, w) => { const out = Buffer.alloc(w * GH * 3); for (let y = 0; y < GH; y++) img.copy(out, y * w * 3, (y * EW + x0) * 3, (y * EW + x0 + w) * 3); return out; };
const save = async (buf, w, file) => {
  const s = sharp(buf, { raw: { width: w, height: GH, channels: 3 } });
  if (file.endsWith('.webp')) await s.webp({ lossless: true, effort: 6 }).toFile(file); else await s.png({ palette: true, colours: 256, dither: 0 }).toFile(file);
};

(async () => {
  for (const on of [true, false]) {
    const img = compose(on), sfx = on ? '' : '-off';
    await save(crop(img, SIDE, GW), GW, path.join(CIN, on ? 'room.webp' : 'desk-off.webp'));
    await save(crop(img, 0, SIDE), SIDE, path.join(CIN, `side-left${sfx}.png`));
    await save(crop(img, SIDE + GW, SIDE), SIDE, path.join(CIN, `side-right${sfx}.png`));
    if (PREV) await sharp(crop(img, SIDE, GW), { raw: { width: GW, height: GH, channels: 3 } }).png().toFile(path.join(PREV, `room${sfx}.png`));
  }

  // ---- what the scene needs: everything in art px (S art px a pixel) ----
  const W = GW * S, H = GH * S, A = (v) => v * S;
  const pct = ([x0, y0, x1, y1]) => ({ left: +((x0 / W) * 100).toFixed(3), top: +((y0 / H) * 100).toFixed(3), width: +(((x1 - x0) / W) * 100).toFixed(3), height: +(((y1 - y0) / H) * 100).toFixed(3) });
  const old = JSON.parse(fs.readFileSync(path.join(CIN, 'room.json'), 'utf8'));
  const mon = monitorLike(), glass = [A(mon.x + 27), A(mon.y + 17), A(mon.x + 321), A(mon.y + 212)];
  // the mug: its body's middle over the coaster, its base on the desk (the sprite is 224 x 256 art px, base 220 down)
  const mugBox = [A(MUG_BODY_X) - 97, A(MUG_BASE_Y) - 220]; mugBox.push(mugBox[0] + 224, mugBox[1] + 256);
  const plantBox = [A(875) - 162, A(548) - 336]; plantBox.push(plantBox[0] + 288, plantBox[1] + 336);
  const noteBox = [A(361) - 78, A(314) - 81]; noteBox.push(noteBox[0] + 156, noteBox[1] + 162);
  const lavaBox = [A(1148) - 65, A(541) - 260]; lavaBox.push(lavaBox[0] + 130, lavaBox[1] + 260);
  const penBox = [A(penSprites[0].x), A(penSprites[0].y), A(penSprites[0].x + penSprites[0].w), A(penSprites[0].y + penSprites[0].h)];
  const m = {
    ...old,
    image: 'room.webp',
    size: { width: W, height: H },
    screenPx: glass,
    screenPct: pct(glass),
    focalPoint: [+(((glass[0] + glass[2]) / 2 / W) * 100).toFixed(2), +(((glass[1] + glass[3]) / 2 / H) * 100).toFixed(2)],
    monitorPct: pct([A(mon.x), A(mon.y), A(mon.x + mon.w), A(mon.y + mon.h)]),
    decksPct: [pct([A(d1x0), A(d1y0), A(d1x1 + 1), A(d1y1 + 1 + 8)]), pct([A(d2x0), A(d2y0), A(d2x1 + 1), A(d2y1 + 1 + 8)])],
    props: {
      ...old.props,
      mug: { ...old.props.mug, boxPx: mugBox, boxPct: pct(mugBox), spill: { ...old.props.mug.spill, boxPct: pct([mugBox[0] - 72, mugBox[1] - 23, mugBox[0] - 72 + 295, mugBox[1] - 23 + 274]) } },
      steam: { ...old.props.steam, boxPx: mugBox, boxPct: pct(mugBox) },
      note: { ...old.props.note, boxPx: noteBox, boxPct: pct(noteBox) },
      'plant-pot': { ...old.props['plant-pot'], boxPx: plantBox, boxPct: pct(plantBox) },
      'plant-leaves': { ...old.props['plant-leaves'], boxPx: plantBox, boxPct: pct(plantBox) },
    },
    // a peeled note comes to rest lying on the desk behind the mug: its top edge on the desk's back
    // edge, its middle behind the mug's (art px from where it hangs)
    noteLand: { dx: A(MUG_BODY_X) - (noteBox[0] + 78), dy: A(DESK) + 6 - (noteBox[1] + Math.round(162 * 0.03)) },
    lamp: { off: '/cinema/desk-off.webp', hitPct: pct([A(lampOn.x), A(lampOn.y), A(lampOn.x + lampOn.w), A(lampOn.y + lampOn.h)]) },
    lava: { boxPct: pct(lavaBox) },
    pens: {
      files: penSprites.map((p) => `/cinema/assets/${p.name}.png`),
      boxPct: pct(penBox),
      originPct: penSprites.map((p) => p.origin),
      hitPct: pct([A(220), A(452), A(274), A(542)]),
    },
    antPct: { from: [+(((plantBox[0] + 120) / W) * 100).toFixed(2), +(((plantBox[3] - 10) / H) * 100).toFixed(2)], to: [+(((plantBox[0] - 160) / W) * 100).toFixed(2), +(((plantBox[3] + 4) / H) * 100).toFixed(2)] },
    sides: { px: SIDE * S, left: '/cinema/side-left.png', right: '/cinema/side-right.png', leftOff: '/cinema/side-left-off.png', rightOff: '/cinema/side-right-off.png' },
    // where the words go (art px): the decks' middles, and each book's spine (left edge, middle)
    text: {
      deck1: [A((d1x0 + d1x1) / 2), A(d1y0), A(d1y1)],
      deck2: [A((d2x0 + d2x1) / 2), A(d2y0), A(d2y1)],
      books: books.map(([x0, y0, , y1]) => [A(x0 + 46), A((y0 + y1) / 2)]),
    },
  };
  delete m.widen;
  fs.writeFileSync(path.join(CIN, 'room.json'), JSON.stringify(m, null, 2) + '\n');
  console.log('done', JSON.stringify(m.text));
})();
