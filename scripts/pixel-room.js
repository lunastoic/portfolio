// The room drawn as pixel art, from scratch: no mockup cut-outs, no fills, no filters. Everything is drawn on a
// 461 x 227 grid (1 art pixel = 4 px of the site's art space, so the room is 1844 x 908 and every box the scene
// uses lines up with the grid) with flat colours, 1 px outlines and the lamp's light in flat bands with a
// checker dither between them. The layout follows the mockup (scripts/art/mockup.png) and keeps every place
// the scene relies on: the screen's glass, the decks and spines the words sit on, the mug's spill, the notes.
// Writes room.png (lamp on), desk-off.png (lamp off), side-left/right(-off).png (the room carried on past each
// edge: the same drawing, wider), cut-mug.png, cut-note-1..7.png, cut-plant.png, cut-lava-off.png and room.json.
// Run: node scripts/pixel-room.js
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const CIN = path.join(__dirname, '..', 'public', 'cinema');
const S = 4; // site art px per pixel
const LW = 461, LH = 227; // the room, pixels
const SIDE = 135; // pixels drawn past each side (540 art px)
const DESK = 190; // the desk's back edge (first desk row)
const CORNER_L = 45, CORNER_R = 418; // the back wall's inside corners

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hash = (x, y, s) => ((Math.imul((y * 7919 + x) * 3 + s, 2654435761) >>> 24) / 255);

/** A pixel canvas in room coordinates (x from -ox); `e` marks pixels that give their own light. */
class Canvas {
  constructor(w, h, ox = 0, oy = 0) { this.w = w; this.h = h; this.ox = ox; this.oy = oy; this.c = new Uint8Array(w * h * 4); this.e = new Uint8Array(w * h); }
  set(x, y, col, emit = false) {
    x += this.ox; y += this.oy;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !col) return;
    const c = typeof col === 'string' ? hex(col) : col, o = (y * this.w + x) * 4;
    this.c[o] = c[0]; this.c[o + 1] = c[1]; this.c[o + 2] = c[2]; this.c[o + 3] = 255;
    this.e[y * this.w + x] = emit ? 1 : 0;
  }
  /** Fill a shape; its edge (any pixel with a 4-neighbour outside) takes the outline colour. */
  shape([x0, y0, x1, y1], inside, fill, outline, emit = false) {
    for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) {
      if (!inside(x, y)) continue;
      const edge = outline && !(inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1));
      this.set(x, y, edge ? outline : typeof fill === 'function' ? fill(x, y) : fill, emit && !edge);
    }
  }
  line(x0, y0, x1, y1, col, emit = false) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= n; i++) this.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), col, emit);
  }
}

// masks (pixel centres)
const rectM = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const ellM = (cx, cy, rx, ry) => (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
const pillM = (x0, y0, x1, y1) => {
  const r = (y1 - y0 + 1) / 2, cy = y0 + r;
  return (x, y) => {
    if (y < y0 || y > y1 || x < x0 || x > x1) return false;
    const cx = Math.min(Math.max(x + 0.5, x0 + r), x1 + 1 - r);
    return (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r;
  };
};
const polyM = (pts) => (x, y) => {
  const px = x + 0.5, py = y + 0.5;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const bbox = (pts) => [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
const or = (...ms) => (x, y) => ms.some((m) => m(x, y));

const INK = '#1c0f08'; // the outline everything shares

// ---------------------------------------------------------------- the room

function wallAndDesk(cv, x0, x1) {
  for (let y = 0; y < LH; y++) for (let x = x0; x < x1; x++) {
    if (y < DESK) {
      const side = x < CORNER_L || x > CORNER_R;
      let col = side ? '#4a1d06' : '#552306';
      if (x === CORNER_L || x === CORNER_R) col = '#341303'; // the inside corner
      else if (y < 2) col = '#2a0f02'; // the ceiling's shadow
      else if (y === DESK - 1) col = '#2e1104'; // where the wall meets the desk
      else if (hash(x, y, 1) > 0.965) col = side ? '#421904' : '#4b1e05'; // a little grain
      cv.set(x, y, col);
    } else if (y >= LH - 4) {
      cv.set(x, y, y === LH - 4 ? '#5a2208' : '#3c1504'); // the desk's front edge
    } else {
      // planks running across, their joints staggered row to row
      const r = Math.floor((y - DESK - 1) / 9), ry = (y - DESK - 1) % 9;
      const joint = ((x + 400 + r * 71) % 157) === 0;
      let col = '#7c3a12';
      if (y === DESK) col = '#9b4c18'; // the back edge catches the light
      else if (ry === 8 || joint) col = '#5a280b';
      else if (hash(x >> 2, y, 3 + r) > 0.86) col = '#723410'; // grain streaks, a few pixels long
      cv.set(x, y, col);
    }
  }
}

function decks(cv) {
  // the hangers on the wall the decks rest on
  for (const [x, y] of [[170, 40], [280, 40], [170, 79], [280, 79]]) cv.shape([x, y, x + 5, y + 2], rectM(x, y, x + 5, y + 2), '#8a8a90', INK);
  cv.shape([146, 2, 304, 39], pillM(146, 2, 304, 39), (x, y) => (y <= 4 ? '#1e6a4a' : y >= 36 ? '#06301d' : '#0a432a'), INK);
  cv.shape([145, 42, 303, 78], pillM(145, 42, 303, 78), (x, y) => (y <= 44 ? '#b88a84' : y >= 75 ? '#7c4c4a' : '#9a6662'), INK);
}

function monitor(cv) {
  cv.shape([176, 164, 186, 168], rectM(176, 164, 186, 168), '#2a160b', INK);
  cv.shape([259, 164, 269, 168], rectM(259, 164, 269, 168), '#2a160b', INK);
  cv.shape([161, 81, 284, 165], rectM(161, 81, 284, 165), (x, y) => {
    if (x === 162 || y === 82) return '#d8742a'; // the orange rim, lit along the top and left
    if (x === 283 || y === 164) return '#8a3c12';
    return '#3c2014';
  }, INK);
  cv.shape([170, 87, 277, 158], rectM(170, 87, 277, 158), '#011e10', '#140a05', true); // the glass
  for (const x of [172, 176, 180]) cv.set(x, 161, '#5a3a28');
  cv.set(277, 161, '#5cf17e', true); // the power light
}

function books(cv) {
  const BOOK = [['#24543a', '#3a7652', '#163626'], ['#1e3460', '#33508a', '#132240'], ['#6e2218', '#93382a', '#4a140c']];
  BOOK.forEach(([mid, hi, lo], i) => {
    const y0 = 169 + i * 10, y1 = y0 + 9, x0 = 166 - (i === 1 ? 2 : 0), x1 = 280 + (i === 2 ? 2 : 0);
    cv.shape([x0, y0, x1, y1], rectM(x0, y0, x1, y1), (x, y) => {
      if (x === x0 + 4 || x === x1 - 4) return '#c9a35e'; // gilt bands near each end
      if (y === y0 + 1) return hi;
      if (y === y1 - 1) return lo;
      return mid;
    }, INK);
    cv.shape([x1 - 13, y0 + 2, x1 - 8, y1 - 2], ellM(x1 - 10.5, y0 + 5, 2.6, 2.6), (x, y) => (ellM(x1 - 10.5, y0 + 5, 1.4, 1.4)(x, y) ? mid : '#c9a35e')); // the emblem
  });
}

function keyboard(cv) {
  const pts = [[148, 199], [289, 199], [292, 221], [145, 221]];
  cv.shape(bbox(pts), polyM(pts), (x, y) => (y >= 219 ? '#0e1a12' : '#1a2a1e'), INK);
  for (let r = 0; r < 4; r++) {
    const y = 202 + r * 4, inset = 4 - r;
    for (let x = 151 + inset; x + 4 <= 286 - inset; x += 6) {
      const space = r === 3 && x > 190 && x < 240;
      if (space && x !== 193) continue;
      const w = space ? 44 : 4;
      if (x + w > 286 - inset) break;
      cv.shape([x, y, x + w, y + 2], rectM(x, y, x + w, y + 2), (px, py) => (py === y ? '#4c9a68' : '#2f6b45'));
    }
  }
}

function notebook(cv) {
  const pts = [[12, 203], [78, 196], [87, 216], [20, 224]];
  cv.shape(bbox(pts), polyM(pts), (x, y) => ((y + Math.round((x - 12) * 0.11)) % 4 === 0 ? '#c4b28c' : '#eadcb8'), INK);
  for (let i = 0; i < 9; i++) cv.set(17 + i * 7, 203 - Math.round(i * 0.75), '#4a4a50'); // the spiral
  cv.line(28, 217, 70, 205, '#1b2440');
  cv.line(28, 218, 70, 206, '#2c3a66');
  cv.line(71, 205, 74, 204, '#c9a35e'); // the cap
  cv.set(27, 218, '#c9a35e');
}

function pencilCup(cv) {
  cv.line(62, 175, 60, 162, '#5a3a20'); cv.line(63, 175, 61, 162, '#7a5230'); cv.set(60, 161, '#2a1a10');
  cv.line(67, 175, 69, 160, '#1a1a1e'); cv.line(68, 175, 70, 160, '#3a3a40'); cv.set(70, 159, '#c9a35e');
  cv.line(72, 175, 74, 164, '#2c3a66'); cv.line(73, 175, 75, 164, '#4a5a9a'); cv.set(75, 163, '#1a1a1e');
  cv.shape([58, 174, 77, 194], rectM(58, 174, 77, 194), (x, y) => (x === 59 ? '#c48e5a' : x === 76 ? '#7a4e2a' : '#a8723f'), INK);
  // the cat
  const CAT = ['x.....x', 'xx...xx', 'xxxxxxx', 'xkxxxkx', 'xxxnxxx', 'xxkxkxx', '.xxxxx.'];
  CAT.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') cv.set(64 + i, 180 + j, ch === 'x' ? '#f0d2a8' : ch === 'n' ? '#d07a6a' : INK); }));
}

/** The lamp: bronze stand, stained-glass shade (glowing when `on`), pull chain. */
function lamp(cv, on) {
  // the stand: a vase turned on a lathe, its half-width by row
  const half = (y) => {
    if (y < 115 || y > 186) return -1;
    if (y < 119) return 2;
    if (y < 124) return 3;
    if (y < 127) return 2;
    if (y < 145) return 2 + Math.round(Math.sin(((y - 127) / 18) * Math.PI / 2) * 5);
    if (y < 163) return 7 - Math.round(((y - 145) / 18) * 4);
    if (y < 176) return 3;
    if (y < 180) return 4;
    return 3 + (y - 180);
  };
  const stand = (x, y) => { const h = half(y); return h >= 0 && Math.abs(x + 0.5 - 46.5) <= h + 0.5; };
  cv.shape([28, 182, 65, 194], ellM(46.5, 189.5, 17, 4.6), (x, y) => (y <= 187 ? '#a8703a' : '#6b4220'), INK);
  cv.shape([36, 115, 58, 188], stand, (x, y) => { const d = x + 0.5 - 46.5, h = half(y); return d < -h + 1.8 ? '#c48a4a' : d > h - 1.5 ? '#4a2c14' : '#7a4a22'; }, INK);
  // the pull chain
  for (let y = 115; y < 140; y += 2) cv.set(63, y, '#b0a090');
  cv.shape([61, 140, 65, 144], ellM(63.5, 142, 2, 2), '#c0b0a0', INK);
  // the shade
  const shade = [[35, 80], [57, 80], [74, 115], [18, 115]];
  const glass = on ? ['#fff0b8', '#ffd878', '#f0b050'] : ['#6a4a2a', '#54381e', '#3e2814'];
  cv.shape([18, 80, 74, 115], polyM(shade), (x, y) => {
    const t = (y - 80) / 35, cx = 46.5, w = 11 + t * 17.5; // the shade's half-width at this row
    const u = (x + 0.5 - cx) / w; // -1..1 across
    // the lead lines: three ribs down the middle, two bands round the bottom
    if (y === 108 || y === 111) return on ? '#6a3a14' : '#24160a';
    for (const k of [-0.18, 0, 0.18]) if (Math.abs(u - k) * w < 0.6) return on ? '#6a3a14' : '#24160a';
    return glass[u < -0.55 ? 0 : u > 0.6 ? 2 : 1];
  }, INK, on);
  cv.shape([44, 76, 49, 80], rectM(44, 76, 49, 80), '#a8703a', INK); // the finial
}

function poster(cv) {
  cv.shape([344, 85, 380, 131], rectM(344, 85, 380, 131), '#2a1a12', INK);
  cv.shape([347, 88, 377, 128], rectM(347, 88, 377, 128), (x, y) => (y < 100 ? '#3c2450' : y < 110 ? '#4e2e62' : '#5e3a6e'));
  for (const [x, y] of [[352, 92], [372, 104], [358, 98], [350, 106], [369, 92]]) cv.set(x, y, '#f0e0a0');
  cv.shape([362, 91, 371, 100], (x, y) => ellM(367, 96, 4, 4)(x, y) && !ellM(369, 94.5, 3.4, 3.4)(x, y), '#e8b060');
  const hills = [[347, 128], [347, 116], [356, 108], [363, 116], [370, 110], [377, 117], [377, 128]];
  cv.shape(bbox(hills), polyM(hills), (x, y) => (y < 116 ? '#3e8a86' : '#2c6466'));
  for (const [x, h] of [[351, 8], [374, 7], [360, 6]]) for (let j = 0; j < h; j++) for (let i = -Math.floor(j / 2); i <= Math.floor(j / 2); i++) cv.set(x + i, 128 - h + j, '#1e4a3a');
}

function headset(cv) {
  // the cable, from the right cup down to the controller
  for (let y = 72; y < 200; y++) cv.set(Math.round(451 - (y - 72) * 0.07 + Math.sin(y / 9) * 1.2), y, '#141418');
  cv.shape([433, 32, 441, 38], rectM(433, 32, 441, 38), '#2a2a30', INK); // the hook
  cv.shape([420, 36, 455, 60], (x, y) => ellM(437.5, 52, 17.5, 16)(x, y) && !ellM(437.5, 53, 13.5, 13)(x, y) && y < 54, (x, y) => (y < 40 ? '#4a4a52' : '#26262c'), INK);
  for (const x0 of [417, 446]) cv.shape([x0, 50, x0 + 11, 75], ellM(x0 + 6, 62.5, 6, 12.5), (x, y) => (x === x0 + 2 ? '#4a4a52' : '#1e1e24'), INK);
  for (const [x, y] of [[451, 61], [452, 62], [451, 63], [450, 62]]) cv.set(x, y, '#5cf17e', true);
}

function xbox(cv) {
  cv.shape([359, 170, 432, 197], rectM(359, 170, 432, 197), (x, y) => {
    if (y <= 173) return '#2e2e34';
    if (x > 396 && (x - 397) % 3 === 0 && y < 194) return '#141418'; // the vents
    return '#1c1c20';
  }, INK);
  cv.line(363, 181, 392, 181, '#08080a');
  cv.shape([422, 184, 426, 188], ellM(424, 186, 2, 2), '#f2f2f2', null, true);
}

function lava(cv, on) {
  const glass = [[433, 147], [439, 147], [442, 180], [430, 180]];
  const cap = [[434, 136], [438, 136], [439, 147], [433, 147]];
  const base = [[430, 180], [442, 180], [445, 196], [427, 196]];
  const silver = on ? ['#d0d0d8', '#9a9aa4', '#6a6a74'] : ['#7a7a84', '#5a5a64', '#3a3a44'];
  const metal = (x) => silver[x < 434 ? 0 : x > 439 ? 2 : 1];
  cv.shape(bbox(base), polyM(base), metal, INK);
  cv.shape(bbox(cap), polyM(cap), metal, INK);
  const blob = or(ellM(436, 175, 3.5, 3.5), ellM(437, 160, 2.2, 3), ellM(435, 152, 1.6, 1.8));
  cv.shape(bbox(glass), polyM(glass), (x, y) => {
    if (blob(x, y)) return on ? '#ffa040' : '#5a3426';
    return on ? (x < 434 ? '#e45aa8' : '#c2378a') : (x < 434 ? '#4a2440' : '#3a1a32');
  }, INK, on);
}

function mousepadAndMouse(cv) {
  const pad = [[328, 202], [402, 202], [405, 223], [325, 223]];
  cv.shape(bbox(pad), polyM(pad), (x, y) => (y === 203 ? '#2e3640' : '#1c2228'), INK);
  cv.shape([352, 202, 377, 220], ellM(364.5, 211, 12.5, 8.5), (x, y) => (y < 206 ? '#3a5a46' : '#1f2e26'), INK);
  cv.line(364, 204, 364, 207, '#5cf17e', true); // the scroll wheel's light
}

function controller(cv) {
  const body = or(ellM(408, 213, 8, 7), ellM(441, 213, 8, 7), rectM(406, 201, 443, 214));
  cv.shape([399, 200, 450, 221], body, (x, y) => (y === 202 ? '#3a3a42' : '#1a1a1e'), INK);
  for (const [x, y, c] of [[438, 205, '#f2c84a'], [441, 207, '#e04848'], [435, 207, '#4a7ae0'], [438, 209, '#4ac060']]) cv.set(x, y, c);
  cv.shape([411, 204, 416, 209], ellM(413.5, 206.5, 2.6, 2.6), '#3a3a42', INK);
  cv.shape([427, 209, 432, 214], ellM(429.5, 211.5, 2.6, 2.6), '#3a3a42', INK);
  for (const [x, y] of [[420, 210], [419, 211], [421, 211], [420, 212]]) cv.set(x, y, '#3a3a42');
  cv.set(424, 204, '#f2f2f2', true);
}

/** The lamp's light (lit) or the dark (off), in flat bands with a checker dither where they meet. */
function light(cv, on) {
  const { w, h, ox } = cv;
  for (let y = 0; y < h; y++) for (let X = 0; X < w; X++) {
    const i = y * w + X;
    if (cv.e[i] || !cv.c[i * 4 + 3]) continue;
    const x = X - ox, dith = (x + y) & 1 ? 1.6 : -1.6;
    let mul;
    if (on) {
      // the pool round the shade on the wall, and the one on the desk under it
      const d = y < DESK
        ? Math.hypot((x - 46) / 1.15, (y - 112) / (y < 80 ? 0.75 : 1))
        : Math.hypot((x - 48) / 2.6, (y - 196) / 0.8);
      const level = [26, 44, 66, 92].filter((t) => d + dith < t).length;
      mul = [[1, 1, 1], [1.2, 1.12, 1.02], [1.45, 1.3, 1.08], [1.75, 1.5, 1.15], [2.1, 1.75, 1.25]][level];
    } else {
      // the monitor's green the light that's left, falling off the glass in bands
      const dx = Math.max(170 - x, 0, x - 277), dy = Math.max(87 - y, 0, y - 158);
      const d = Math.hypot(dx, dy * 1.2);
      const level = [5, 12].filter((t) => d + dith < t).length;
      mul = [[0.42, 0.42, 0.52], [0.46, 0.55, 0.6], [0.5, 0.66, 0.66]][level];
    }
    for (let c = 0; c < 3; c++) cv.c[i * 4 + c] = Math.min(255, Math.round(cv.c[i * 4 + c] * mul[c]));
  }
}

function room(on) {
  const cv = new Canvas(LW + 2 * SIDE, LH, SIDE);
  wallAndDesk(cv, -SIDE, LW + SIDE);
  decks(cv); poster(cv); headset(cv);
  monitor(cv); books(cv); xbox(cv); lava(cv, true); pencilCup(cv); lamp(cv, on);
  keyboard(cv); notebook(cv); mousepadAndMouse(cv); controller(cv);
  light(cv, on);
  return cv;
}

// ---------------------------------------------------------------- the sprites (drawn lit, the scene dims them)

function mugSprite() {
  const cv = new Canvas(41, 64); // box: art px [412, 544, 576, 800]
  cv.shape([0, 58, 40, 63], ellM(18.5, 61, 19, 2.6), (x, y) => (y <= 60 ? '#c08a52' : '#8a5a30'), INK); // the coaster
  cv.shape([30, 26, 41, 48], (x, y) => ellM(33, 37, 7.5, 10.5)(x, y) && !ellM(33, 37, 4, 6.5)(x, y) && x > 30, '#2f6a4a', INK); // the handle
  cv.shape([3, 17, 32, 60], or(rectM(3, 20, 32, 58), ellM(17.5, 20, 15, 3), ellM(17.5, 58, 15, 2.4)), (x, y) => {
    if (x <= 5) return '#4e9a6e';
    if (x >= 29) return '#1e4a32';
    return '#2f6a4a';
  }, INK);
  cv.shape([5, 18, 30, 22], ellM(17.5, 20, 13, 1.8), '#2e1608'); // the coffee
  cv.shape([12, 32, 24, 46], (x, y) => ellM(18, 39, 5.5, 6.5)(x, y) && !ellM(20.5, 37, 4.6, 5.6)(x, y), '#e08a3a');
  return cv;
}

const NOTE_PAPER = [['#8ad07a', '#5ea852'], ['#f2a24a', '#c4782a'], ['#f2cc4a', '#c49e2a'], ['#f2a0b8', '#c4728a'], ['#f2e8c4', '#c4b890'], ['#8ad07a', '#5ea852'], ['#f2a24a', '#c4782a']];
function noteSprite([paper, curl]) {
  const cv = new Canvas(32, 30); // box: art px [332, 384, 460, 504]
  const sheet = [[2, 1], [30, 1], [30, 22], [23, 28], [2, 28]];
  cv.shape(bbox(sheet), polyM(sheet), (x, y) => (y <= 3 ? curl : paper), INK);
  const fold = [[23, 28], [30, 22], [24, 22]];
  cv.shape(bbox(fold), polyM(fold), curl, INK);
  return cv;
}

function plantSprite() {
  const cv = new Canvas(56, 67); // box: art px [1136, 516, 1360, 784]
  const leaf = (cx, cy, len, wid, ang, dark) => {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const m = (x, y) => { const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = dx * ca + dy * sa, v = -dx * sa + dy * ca; return (u / len) ** 2 + (v / (wid * (1 - Math.abs(u) / (len * 1.4)))) ** 2 <= 1; };
    cv.shape([cx - len - 1, cy - len - 1, cx + len + 1, cy + len + 1], m, (x, y) => {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, v = -dx * sa + dy * ca;
      return Math.abs(v) < 0.6 ? (dark ? '#4a9a44' : '#7cc458') : v < 0 ? (dark ? '#2a6a2c' : '#4e9a3e') : (dark ? '#1e5222' : '#3a7e32');
    }, INK);
  };
  // each leaf on a stem out of the pot: [angle (0 = right, up is negative), stem length, leaf length, width, dark]
  // back leaves first, then the front ones over them
  const LEAVES = [[-2.5, 8, 11, 5, 1], [-0.65, 8, 11, 5, 1], [-1.57, 14, 10, 4.5, 1], [-2.95, 4, 10, 4.5, 0], [-0.2, 4, 10, 4.5, 0],
    [-2.05, 6, 11, 5, 0], [-1.1, 6, 11, 5, 0], [-1.6, 3, 10, 5, 0]];
  const BX = 28, BY = 45; // where the stems come out of the soil
  for (const [a, stem, len, wid, dark] of LEAVES) {
    const sx = BX + Math.cos(a) * stem, sy = BY + Math.sin(a) * stem;
    cv.line(BX, BY, Math.round(sx), Math.round(sy), dark ? '#1e5222' : '#3a7e32');
    leaf(sx + Math.cos(a) * len, sy + Math.sin(a) * len, len, wid, a, dark);
  }
  const pot = [[14, 46], [42, 46], [38, 66], [18, 66]];
  cv.shape(bbox(pot), polyM(pot), (x, y) => (y <= 49 ? '#d07a4a' : x <= 18 ? '#c06a3a' : x >= 36 ? '#7a3a1a' : '#a8522a'), INK);
  cv.shape([14, 44, 42, 49], rectM(14, 44, 42, 49), (x, y) => (y === 45 ? '#e08a5a' : '#b85e30'), INK); // the rim
  return cv;
}

// ---------------------------------------------------------------- output

async function save(cv, file, [x0, x1] = [0, cv.w]) {
  const w = x1 - x0, buf = Buffer.alloc(w * cv.h * 4);
  for (let y = 0; y < cv.h; y++) Buffer.from(cv.c.buffer, (y * cv.w + x0) * 4, w * 4).copy(buf, y * w * 4);
  await sharp(buf, { raw: { width: w, height: cv.h, channels: 4 } }).resize(w * S, cv.h * S, { kernel: 'nearest' }).png({ compressionLevel: 9, palette: false }).toFile(path.join(CIN, file));
}

(async () => {
  const lit = room(true), dark = room(false);
  await save(lit, 'room.png', [SIDE, SIDE + LW]);
  await save(dark, 'desk-off.png', [SIDE, SIDE + LW]);
  await save(lit, 'side-left.png', [0, SIDE]);
  await save(lit, 'side-right.png', [SIDE + LW, 2 * SIDE + LW]);
  await save(dark, 'side-left-off.png', [0, SIDE]);
  await save(dark, 'side-right-off.png', [SIDE + LW, 2 * SIDE + LW]);

  await save(mugSprite(), 'cut-mug.png');
  for (let i = 0; i < 7; i++) await save(noteSprite(NOTE_PAPER[i]), `cut-note-${i + 1}.png`);
  await save(plantSprite(), 'cut-plant.png');
  // the lava lamp switched off: just the lamp (the same outline as lit, so it covers it), nothing round it
  const lv = new Canvas(16, 64, -428, -133);
  lava(lv, false);
  await save(lv, 'cut-lava-off.png');

  // ---- room.json: the boxes, on the grid
  const WW = LW * S, H = LH * S;
  const pct = ([x0, y0, x1, y1]) => ({ left: +((x0 / WW) * 100).toFixed(3), top: +((y0 / H) * 100).toFixed(3), width: +(((x1 - x0) / WW) * 100).toFixed(3), height: +(((y1 - y0) / H) * 100).toFixed(3) });
  const m = JSON.parse(fs.readFileSync(path.join(CIN, 'room.json'), 'utf8'));
  const MUG = [412, 544, 576, 800], NOTE = [332, 384, 460, 504], PLANT = [1136, 516, 1360, 784], LAVA = [1712, 532, 1776, 788];
  Object.assign(m, {
    image: 'room.png',
    size: { width: WW, height: H },
    textDx: 118,
    screenPx: [170 * S, 87 * S, 278 * S, 159 * S],
    monitorPct: pct([161 * S, 81 * S, 285 * S, 166 * S]),
    decksPct: [pct([146 * S, 2 * S, 305 * S, 40 * S]), pct([145 * S, 42 * S, 304 * S, 79 * S])],
    lamp: { off: '/cinema/desk-off.png', hitPct: pct([16 * S, 75 * S, 76 * S, 195 * S]) },
    lava: { boxPct: pct(LAVA), off: '/cinema/cut-lava-off.png' },
    sides: { ...m.sides, px: SIDE * S },
  });
  const sp = m.screenPx;
  m.screenPct = { left: +((sp[0] / WW) * 100).toFixed(3), top: +((sp[1] / H) * 100).toFixed(3), width: +(((sp[2] - sp[0]) / WW) * 100).toFixed(3), height: +(((sp[3] - sp[1]) / H) * 100).toFixed(3) };
  m.focalPoint = [50, +((((sp[1] + sp[3]) / 2) / H) * 100).toFixed(2)];
  const P = m.props;
  P.mug = { ...P.mug, boxPx: MUG, boxPct: pct(MUG), originPct: [50, 94] };
  P.steam = { ...P.steam, boxPx: MUG, boxPct: pct(MUG) };
  P.note = { ...P.note, boxPx: NOTE, boxPct: pct(NOTE) };
  P['plant-pot'] = { ...P['plant-pot'], boxPx: PLANT, boxPct: pct(PLANT) };
  P['plant-leaves'] = { ...P['plant-leaves'], boxPx: PLANT, boxPct: pct(PLANT) };
  fs.writeFileSync(path.join(CIN, 'room.json'), JSON.stringify(m, null, 2) + '\n');
  console.log('done', WW, H);
})();
