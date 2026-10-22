// Detailed pixel-art desk room. drawRoom(theme, lampOn, lavaOn, opt) -> Uint8ClampedArray (RGBA, (W + 2 x opt.side) x H).
// Shapes are laid out in "u" (the portfolio room's 461 x 227 grid) and drawn on a finer 640 x 316 pixel grid.
// Every pixel stores a material ramp and a shade; a light pass picks the ramp step with a Bayer dither.
const W = 640, H = 316, K = W / 461, LH = 227;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hash = (x, y, s) => (Math.imul((Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(s, 83492791)) >>> 0, 2654435761) >>> 24) / 255;

/** Five steps from one colour: shadows lean cool, highlights warm (hue-shifted, as pixel artists do). */
function rampFrom(h) {
  const [r, g, b] = hex(h);
  return [[0.4, -6, 2, 10], [0.62, -3, 1, 5], [0.82, 0, 0, 0], [1, 4, 2, -2], [1.2, 14, 8, -6]].map(([f, dr, dg, db]) => [clamp(r * f + dr, 0, 255), clamp(g * f + dg, 0, 255), clamp(b * f + db, 0, 255)]);
}
const R = (list) => list.map(hex);

const SHARED = {
  ink: R(['#0a0504', '#0e0806', '#130b08', '#180f0a', '#1e130d']),
  bronze: R(['#2a160a', '#4e2c12', '#7a4a22', '#a8703a', '#dcae6c']),
  glassOn: R(['#d9822c', '#f2b04e', '#ffd274', '#ffe8a4', '#fff8dc']),
  glassOff: R(['#1c1109', '#29190d', '#382313', '#4a2f1b', '#5e3e25']),
  lead: R(['#1a0e06', '#26150a', '#331d0d', '#402512', '#4e2e17']),
  plastic: R(['#08080b', '#111116', '#1b1b22', '#292932', '#3f3f4c']),
  silver: R(['#30303a', '#53535f', '#82828e', '#b0b0bc', '#e4e4ec']),
  paper: R(['#7a6c56', '#a69778', '#cbbd9c', '#e6d8b6', '#f9f1db']),
  deckWood: R(['#4a2e14', '#7a5430', '#a8804e', '#ccaa74', '#ead2a0']),
  glassBlack: R(['#030305', '#08080c', '#101016', '#1a1a22', '#2a2a36', '#4a4650', '#a08868', '#f6e2b4']),
  alu: R(['#18181c', '#2c2c32', '#46464e', '#686872', '#94949e', '#c8c8d0']),
  pencilWhite: R(['#5e5e64', '#8c8c92', '#b8b8be', '#dadade', '#f0f0f2', '#ffffff']),
  padBlack: R(['#08080b', '#121217', '#1d1d24', '#2b2b35', '#3e3e4b', '#5a5a6a', '#8c8c9c']),
  cushion: R(['#050506', '#0a0a0d', '#111115', '#19191e', '#232329']),
  steam: R(['#5e5650', '#847c76', '#aaa29c', '#cdc5bf', '#ece6e0']),
  screen: R(['#00120a', '#011a0e', '#022414', '#032e1a', '#0b5a2e', '#1f9a48', '#3fd068', '#86f8a0']),
  gold: R(['#5a3e16', '#8a6626', '#c09a52', '#e2c27a', '#fff0b4']),
  lavaOn: R(['#6a1048', '#a02670', '#c8388e', '#e85cae', '#ff9ed4']),
  lavaOff: R(['#1a0c16', '#26121f', '#331a2a', '#422236', '#522c44']),
  wax: R(['#8a3a10', '#d0661e', '#ff8a30', '#ffaa50', '#ffd494']),
  waxOff: R(['#2a160c', '#3a1f12', '#4c2a18', '#5c341e', '#6e4026']),
  white: R(['#9a9aa0', '#c4c4ca', '#e2e2e8', '#f4f4f8', '#ffffff']),
  ledGreen: R(['#0b5a2e', '#1f9a48', '#3fd068', '#5cf17e', '#b0ffc4']),
  keys: rampFrom('#2f6b45'), keysCase: rampFrom('#1c2b20'),
  leaf: R(['#0f3416', '#1c4e20', '#2c6a2e', '#4a9a3c', '#7cc85a']),
  pot: R(['#4a1e0c', '#7a3a1a', '#a8522a', '#c86c3c', '#e6905e']),
  mug: R(['#103424', '#1c4a32', '#2c6a48', '#4a9a6c', '#7ac698']),
  coffee: R(['#140804', '#1e0e06', '#2e1608', '#40200c', '#562c12']),
  moonAccent: rampFrom('#e8883a'),
  cork: R(['#5a3a1c', '#8a5a30', '#a8723f', '#c48c54', '#dcaa72']),
  clay: rampFrom('#b07e4c'), cat: R(['#b08a66', '#d2ae86', '#ecca9e', '#f6dcb4', '#fff0d6']),
  corgiBlack: R(['#0c0a0c', '#1a1618', '#2a2426', '#3c3436', '#504648']), corgiTan: R(['#5a2208', '#843614', '#a8501e', '#c4662a', '#dc8240']),
  corgiWhite: R(['#a8a098', '#cac2b8', '#e6dfd4', '#f6f0e6', '#ffffff']),
  bookA: rampFrom('#2c6444'), bookB: rampFrom('#284476'), bookC: rampFrom('#8a2c20'),
  sky: R(['#1a1030', '#26183e', '#33204e', '#432a60', '#583878']), hills: rampFrom('#3a8a84'), pine: rampFrom('#1c4a38'), moon: rampFrom('#f0b866'),
  frame: rampFrom('#3a2416'), pad: rampFrom('#202830'), mouse: rampFrom('#22342a'),
  btnY: rampFrom('#f2c84a'), btnB: rampFrom('#e04848'), btnX: rampFrom('#4a7ae0'), btnA: rampFrom('#4ac060'),
  penA: rampFrom('#6a4a2a'), penB: rampFrom('#2a2a30'), penC: rampFrom('#34509a'), navy: rampFrom('#24345e'),
};

// 3 x 5, row by row
const GLYPHS = {"0":"####.##.##.####","1":".#.##..#..#.###","4":"#.##.####..#..#","9":"####.####..###.","A":".#.#.#####.##.#","B":"##.#.###.#.###.","C":".###..#..#...##","D":"##.#.##.##.###.","E":"####..##.#..###","F":"####..##.#..#..","G":".###..#.##.#.##","H":"#.##.#####.##.#","I":"###.#..#..#.###","J":"..#..#..##.#.#.","K":"#.##.###.#.##.#","L":"#..#..#..#..###","M":"#.########.##.#","N":"##.#.##.##.##.#","O":".#.#.##.##.#.#.","P":"##.#.###.#..#..","Q":".#.#.##.###..##","R":"##.#.###.#.##.#","S":".###...#...###.","T":"###.#..#..#..#.","U":"#.##.##.##.####","V":"#.##.##.##.#.#.","W":"#.##.########.#","X":"#.##.#.#.#.##.#","Y":"#.##.#.#..#..#.","Z":"###..#.#.#..###",".":".............#.",":":"....#.....#....","_":"............###",">":"#...#...#.#.#..","&":".#.#.#.#.#.#.##","/":"..#..#.#.#..#..","\\":"#..#...#...#..#","-":"......###......"," ":"...............","!":".#..#..#.....#."};
const textWidth = (s, sc) => s.length * 4 * sc - sc;

// vectors, and signed distances for the modelled things (in whatever unit a model uses)
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const sdEll = (p, c, r) => { const q = [(p[0] - c[0]) / r[0], (p[1] - c[1]) / r[1], (p[2] - c[2]) / r[2]]; const k0 = Math.hypot(q[0], q[1], q[2]), k1 = Math.hypot(q[0] / r[0], q[1] / r[1], q[2] / r[2]); return (k0 * (k0 - 1)) / (k1 || 1e-6); };
const sdCone = (p, a, b, ra, rb) => { const ba = sub3(b, a), pa = sub3(p, a); const t = clamp(dot(pa, ba) / dot(ba, ba), 0, 1); return Math.hypot(pa[0] - ba[0] * t, pa[1] - ba[1] * t, pa[2] - ba[2] * t) - (ra + (rb - ra) * t); };
const sdCyl = (p, c, r, h) => { const d0 = Math.hypot(p[0] - c[0], p[2] - c[2]) - r, d1 = Math.abs(p[1] - c[1]) - h; return Math.min(Math.max(d0, d1), 0) + Math.hypot(Math.max(d0, 0), Math.max(d1, 0)); };
const sdBox = (p, c, h, r = 0.8) => { const q = [Math.abs(p[0] - c[0]) - h[0], Math.abs(p[1] - c[1]) - h[1], Math.abs(p[2] - c[2]) - h[2]]; return Math.hypot(Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)) + Math.min(Math.max(q[0], q[1], q[2]), 0) - r; };
const smin = (a, b, k) => { const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1); return b * (1 - h) + a * h - k * h * (1 - h); };
/** Distance to a closed polygon in the x-z plane (negative inside). */
const sdPoly2 = (x, z, v) => {
  let d = (x - v[0][0]) ** 2 + (z - v[0][1]) ** 2, sg = 1;
  for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
    const ex = v[j][0] - v[i][0], ez = v[j][1] - v[i][1], wx = x - v[i][0], wz = z - v[i][1];
    const t = clamp((wx * ex + wz * ez) / (ex * ex + ez * ez), 0, 1), bx = wx - ex * t, bz = wz - ez * t;
    d = Math.min(d, bx * bx + bz * bz);
    const c1 = z >= v[i][1], c2 = z < v[j][1], c3 = ex * wz > ez * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) sg = -sg;
  }
  return sg * Math.sqrt(d);
};
/** A 2D distance pushed up between a floor and a ceiling, its edges rounded by r. */
const extrude = (d2, y, bottom, top, r) => { const a = d2 + r, b = Math.max(y - top, bottom - y) + r; return Math.hypot(Math.max(a, 0), Math.max(b, 0)) + Math.min(Math.max(a, b), 0) - r; };

/**
 * The controller asset (128 px across): the Xbox Series controller in Carbon Black lying on the desk in front of you,
 * as you see it sitting down: from about 55 cm away, your eye about 18 degrees above the desk, the pad turned 20 degrees to the right (clockwise seen from above).
 * A real model of it (mm; x right, y up off the desk, z toward you from its middle, the top edge at z = -50, laid out
 * from a photo of the real pad), seen through that eye, then set in the room's ramp steps with the same 4 x 4 dither,
 * a dark outline round it and dark seams between its parts. drawControllerHD(on, w) -> { w, h, px: [[c, r, ramp, shade, emit]] },
 * w px across (128 for the asset; the room draws it at its true size beside the console).
 */
function drawControllerHD(on, w = 128) {
  const HALF = [[0, -47], [21, -48], [37, -50.5], [58, -50.5], [68, -47.5], [75, -40], [78, -29.5], [79, -17], [78, -2], [75, 16.5], [70, 35], [64, 48.5], [58, 54.5], [50, 54.5], [42, 49], [36, 38], [29, 30.5], [17, 27.5], [0, 27]];
  const OUT = [...HALF, ...HALF.slice(1, -1).reverse().map(([x, z]) => [-x, z])];
  const inGrip = (x, z) => clamp((Math.abs(x) - 30) / 22, 0, 1) * clamp((z + 5) / 40, 0, 1);
  const top = (x, z) => 34 - clamp((z + 40) / 75, 0, 1) * 3 - inGrip(x, z) * 2; // the face, falling a little toward you
  const bottom = (x, z) => 15 - inGrip(x, z) * 15; // the grips bulge down to the desk; the middle sits up off it
  const LOGO = [0, -37.5], LSTICK = [-52, -23], RSTICK = [23, 0.5], DPAD = [-30, 0.5], AB = [51, -21.5];
  const ABXY = [[0, -11, 'btnY', 'Y'], [12.5, 0, 'btnB', 'B'], [-12.5, 0, 'btnX', 'X'], [0, 11, 'btnA', 'A']];
  const SMALL = [[-17, -22.5], [0, -15], [17, -22.5]];
  const scene = (p) => {
    const [x, y, z] = p, tp = top(x, z);
    let body = extrude(sdPoly2(x, z, OUT) + Math.max(0, tp - y) * 0.3, y, bottom(x, z), tp, 5);
    for (const sg of [-1, 1]) body = smin(body, sdEll(p, [sg * 47, 11, -38], [12, 11, 10]), 5); // the triggers under the back
    let best = body, part = 'body';
    const take = (d, name) => { if (d < best) { best = d; part = name; } };
    for (const sg of [-1, 1]) take(Math.min(sdCone(p, [sg * 22, 31, -45.5], [sg * 46, 30.5, -48.5], 3, 3), sdCone(p, [sg * 46, 30.5, -48.5], [sg * 66, 29.5, -45], 3, 3), sdCone(p, [sg * 66, 29.5, -45], [sg * 74, 28.5, -38], 3, 2.6)), 'bumper');
    // the sticks: a low collar round the hole, the shaft, and a tall cap with rounded edges and a dished top
    for (const [sx, sz] of [LSTICK, RSTICK]) {
      const t = top(sx, sz);
      take(sdCyl(p, [sx, t + 0.4, sz], 12, 0.6) - 0.6, 'collar');
      take(sdCyl(p, [sx, t + 4, sz], 5.5, 4), 'shaft');
      take(Math.max(sdCyl(p, [sx, t + 10.5, sz], 9, 1.6) - 1.4, -sdEll(p, [sx, t + 17.5, sz], [8.5, 6, 8.5])), 'stick');
    }
    // the d-pad: a shallow dish with a beveled cross standing up in it
    { const t = top(...DPAD); take(sdCyl(p, [DPAD[0], t + 0.4, DPAD[1]], 12.5, 0.7) - 0.4, 'dpad'); take(Math.min(sdBox(p, [DPAD[0], t + 2.6, DPAD[1]], [10, 1.5, 3.4], 0.9), sdBox(p, [DPAD[0], t + 2.6, DPAD[1]], [3.4, 1.5, 10], 0.9)), 'cross'); }
    // ABXY: rounded domes standing up out of the face
    for (const [bx, bz, nm] of ABXY) { const t = top(AB[0] + bx, AB[1] + bz); take(Math.min(sdCyl(p, [AB[0] + bx, t + 1.6, AB[1] + bz], 5, 1.6) - 0.6, sdEll(p, [AB[0] + bx, t + 3.2, AB[1] + bz], [5.4, 1.6, 5.4])), nm); }
    take(sdEll(p, [LOGO[0], top(...LOGO) + 0.6, LOGO[1]], [7.6, 2.6, 7.6]), 'guide'); // the Xbox button, a glossy dome
    for (const [vx, vz] of SMALL) take(sdEll(p, [vx, top(vx, vz) + 0.5, vz], [3, 1.6, 3]), 'small');
    return [best, part];
  };
  // the eye: 550 mm from the pad's middle, 18 degrees above the desk; the pad turned YAW on the desk
  const YAW = (20 * Math.PI) / 180, cy = Math.cos(YAW), sy = Math.sin(YAW), EL = (18 * Math.PI) / 180, D = 550;
  const toPad = ([x, y, z]) => [x * cy + z * sy, y, -x * sy + z * cy];
  const T = [0, 16, 2], E = [0, T[1] + D * Math.sin(EL), T[2] + D * Math.cos(EL)];
  const f = norm(sub3(T, E)), rt = norm([f[2], 0, -f[0]].map((v) => -v)), up = [rt[1] * f[2] - rt[2] * f[1], rt[2] * f[0] - rt[0] * f[2], rt[0] * f[1] - rt[1] * f[0]];
  const PXMM = 170 / w; // mm per px at the pad's middle
  const ray = (c, r) => norm([0, 1, 2].map((k) => f[k] + (rt[k] * (c + 0.5 - w / 2) * PXMM - up[k] * r * PXMM) / D));
  const march = (d) => {
    let t = D - 140;
    for (let i = 0; i < 160 && t < D + 160; i++) {
      const P = [E[0] + d[0] * t, E[1] + d[1] * t, E[2] + d[2] * t], [dd, part] = scene(toPad(P));
      if (dd < 0.05) return { t, P: toPad(P), part };
      t += Math.max(dd * 0.8, 0.05);
    }
    return null;
  };
  // march every pixel of a tall strip, then keep only the rows it covers
  const rows = [];
  for (let r = -70; r <= 70; r++) { const row = []; for (let c = 0; c < w; c++) row.push(march(ray(c, r))); rows.push(row); }
  const used = rows.map((row) => row.some(Boolean)), r0 = used.indexOf(true) - 1, r1 = used.lastIndexOf(true) + 1;
  const grid = rows.slice(r0, r1 + 1), h = grid.length, cell = (c, r) => (c < 0 || r < 0 || c >= w || r >= h ? null : grid[r][c]);
  const L = norm([-0.55, 0.75, 0.45]), GLOSS = { bumper: [1.3, 26], guide: [1.8, 30], stick: [0.25, 16], cross: [0.6, 16], small: [0.8, 16], btnY: [0.9, 24], btnB: [0.9, 24], btnX: [0.9, 24], btnA: [0.9, 24] };
  const GLYPH = {
    Y: ['#...#', '.#.#.', '..#..', '..#..', '..#..'], B: ['####.', '#...#', '####.', '#...#', '####.'],
    X: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'], A: ['.###.', '#...#', '#####', '#...#', '#...#'],
  };
  const step = (c, r, t) => clamp(Math.round(t + (BAYER[(r & 3) * 4 + (c & 3)] - 0.5) * 0.9) - (on ? 0 : 1), 0, 6);
  const px = [];
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const q = cell(c, r);
    if (!q) continue;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => cell(c + a, r + b));
    if (nb.some((o) => !o || q.t - o.t > 6 || (o.part !== q.part && q.t - o.t > -0.3))) { px.push([c, r, 'padBlack', 0, 2]); continue; }
    const { P, part } = q, e = 0.3;
    const n = norm([0, 1, 2].map((k) => { const a = P.slice(), b = P.slice(); a[k] += e; b[k] -= e; return scene(a)[0] - scene(b)[0]; }));
    const V = norm(sub3(toPad(E), P)), Hh = norm([L[0] + V[0], L[1] + V[1], L[2] + V[2]]);
    const [k, pw] = GLOSS[part] || [0.35, 10];
    let t = 0.5 + Math.max(0, dot(n, L)) ** 2 * 3.4 + k * Math.max(0, dot(n, Hh)) ** pw * 3 - (1 - Math.max(0, dot(n, V))) * 0.8; // darker where it turns away from you
    const [x, y, z] = P;
    // the sticks' tops: a ridged grip ring round a dished middle
    for (const s of [LSTICK, RSTICK]) {
      if (Math.hypot(x - s[0], z - s[1]) > 16) continue;
      const ridge = Math.floor(((Math.atan2(z - s[1], x - s[0]) + Math.PI) * 28) / (2 * Math.PI)) % 2;
      if (part === 'stick') t = Math.abs(n[1]) < 0.6 ? 1.4 + ridge * 1.1 + (x < s[0] ? 0.5 : 0) : y > top(...s) + 11.4 ? 1.2 : 2.6; // ridged sides, dished top, lit rim
      if (part === 'shaft') t = 0.4;
      if (part === 'collar') t -= 0.3;
    }
    // the letters on ABXY, coloured on the black buttons
    const b = ABXY.find((o) => o[2] === part);
    if (b && y > top(AB[0] + b[0], AB[1] + b[1]) + 3) {
      // seen this low a letter is only a few px tall, so each shows as its colour across the button's middle
      const du = x - AB[0] - b[0], dv = z - AB[1] - b[1];
      if (Math.hypot(du, dv * 0.7) < 3.8) { px.push([c, r, part, (dv < 0 ? 0.95 : 0.8) * (on ? 1 : 0.65), 1]); continue; }
    }
    // the Xbox logo: a white sphere cut by an X whose arms are thin where they cross and widen to its edge
    if (part === 'guide' && y > top(...LOGO) + 0.4) {
      const u = x - LOGO[0], v = z - LOGO[1], rr = Math.hypot(u, v);
      if (rr < 6.6) {
        if (Math.abs(Math.abs(u) - Math.abs(v) * 0.6) / Math.SQRT2 > 1.2) { px.push([c, r, 'white', (u + v < 0 ? 0.95 : 0.8) * (on ? 1 : 0.6), 1]); continue; }
        t = 0.6;
      }
    }
    if (part === 'small') t += 0.6;
    // the lamp catching the top edge of everything that stands up off the face: a lit rim along its upper outline
    const above = cell(c, r - 1), RAISED = { stick: 1, cross: 1, guide: 1, small: 1, btnY: 1, btnB: 1, btnX: 1, btnA: 1 };
    if (RAISED[part] && above && (above.part !== part || above.t - q.t > 2)) t = Math.max(t, part === 'stick' ? 4.6 : 4.1);
    px.push([c, r, 'padBlack', step(c, r, t) / 6, 2]);
  }
  return { w, h, px };
}

/** The controller on its own, as RGBA with a transparent background (lamp on, or off for night). */
function controllerImage(on = true) {
  const { w, h, px } = drawControllerHD(on), data = new Uint8ClampedArray(w * h * 4);
  for (const [c, r, name, shade] of px) {
    const ramp = SHARED[name], col = ramp[clamp(Math.round(shade * (ramp.length - 1)), 0, ramp.length - 1)], o = (r * w + c) * 4;
    data[o] = col[0]; data[o + 1] = col[1]; data[o + 2] = col[2]; data[o + 3] = 255;
  }
  return { w, h, data };
}

function drawRoom(theme, on, lavaOn = true, opt = {}) {
  // opt.side: px of room drawn past each edge; opt.skip: pieces left out (mug, note, lava, pens, pen0..2, cable);
  // opt.noteRamp: the sticky note's colour; opt.info: filled in with where things are (u)
  const OX = opt.side || 0, WW = W + 2 * OX, skip = new Set(opt.skip || []), info = opt.info || {};
  const ramps = [], rampId = new Map();
  const id = (name) => {
    if (!rampId.has(name)) { rampId.set(name, ramps.length); ramps.push(theme.ramps[name] || SHARED[name]); }
    return rampId.get(name);
  };
  const RB = new Int16Array(WW * H).fill(-1), SB = new Float32Array(WW * H), EB = new Uint8Array(WW * H);
  // where each pixel takes the room's light from (u): its own place for the wall and desk, the spot an object stands
  // on for everything on them, so an object is lit as one thing; ANC is the object being drawn
  const AX = new Float32Array(WW * H).fill(-1), AY = new Float32Array(WW * H);
  let ANC = null;
  const put = (X, Y, ramp, s, emit) => {
    if (X < 0 || Y < 0 || X >= WW || Y >= H) return;
    const i = Y * WW + X; RB[i] = id(ramp); SB[i] = s; EB[i] = emit === 2 ? 2 : emit ? 1 : 0;
    if (ANC) { AX[i] = ANC[0]; AY[i] = ANC[1]; } else AX[i] = -1;
  };
  const val = (v, x, y, X, Y) => (typeof v === 'function' ? v(x, y, X, Y) : v);
  /** A shape in u: its mask, its ramp and shade (constants or functions of u), outlined in ink by default. */
  const shape = (box, mask, ramp, shade = 0.5, o = {}) => {
    const X0 = Math.max(0, Math.floor(box[0] * K) + OX - 1), X1 = Math.min(WW - 1, Math.ceil(box[2] * K) + OX + 1);
    const Y0 = Math.max(0, Math.floor(box[1] * K) - 1), Y1 = Math.min(H - 1, Math.ceil(box[3] * K) + 1);
    const m = (X, Y) => mask((X - OX + 0.5) / K, (Y + 0.5) / K);
    const own = !ANC; // a shape that isn't part of a bigger object takes its light at its own foot
    if (own) ANC = [(box[0] + box[2]) / 2, box[3] - 0.5];
    for (let Y = Y0; Y <= Y1; Y++) for (let X = X0; X <= X1; X++) {
      if (!m(X, Y)) continue;
      const x = (X - OX + 0.5) / K, y = (Y + 0.5) / K;
      const edge = o.outline !== false && !(m(X - 1, Y) && m(X + 1, Y) && m(X, Y - 1) && m(X, Y + 1));
      if (edge) put(X, Y, o.ink || 'ink', 0.5, false);
      else put(X, Y, val(ramp, x, y, X - OX, Y), val(shade, x, y, X - OX, Y), val(o.emit, x, y, X - OX, Y));
    }
    if (own) ANC = null;
  };
  const fx = (f, dx) => (typeof f === 'function' ? (x, y, X, Y) => f(x - dx, y, X, Y) : f);
  const moved = (dx) => (box, mask, ramp, shade, o = {}) => shape([box[0] + dx, box[1], box[2] + dx, box[3]], fx(mask, dx), fx(ramp, dx), fx(shade, dx), { ...o, emit: fx(o.emit, dx) });
  const text = (s, X, Y, sc, ramp, shade, emit, align = 'left') => {
    let x0 = align === 'center' ? X - Math.floor(textWidth(s, sc) / 2) : X;
    for (const ch of s.toUpperCase()) {
      const g = GLYPHS[ch] || GLYPHS[' '];
      for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === '#') for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) put(x0 + i * sc + a, Y + j * sc + b, ramp, shade, emit);
      x0 += 4 * sc;
    }
  };
  const pattern = (rows, X, Y, sc, map) => rows.forEach((row, j) => [...row].forEach((ch, i) => { if (map[ch]) for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) put(X + i * sc + a, Y + j * sc + b, ...map[ch]); }));
  const px = (u) => Math.round(u * K), pxX = (u) => Math.round(u * K) + OX; // a u to its row; a u to its column (past the left edge)

  // masks (u)
  const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const ell = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  const pill = (x0, y0, x1, y1) => { const r = (y1 - y0) / 2, cy = y0 + r; return (x, y) => { if (y < y0 || y > y1 || x < x0 || x > x1) return false; const cx = clamp(x, x0 + r, x1 - r); return (x - cx) ** 2 + (y - cy) ** 2 <= r * r; }; };
  const poly = (pts) => (x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const bb = (pts) => [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
  const any = (...ms) => (x, y) => ms.some((m) => m(x, y));
  const thick = (x0, y0, x1, y1, w) => { const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy; return (x, y) => { const t = clamp(((x - x0) * dx + (y - y0) * dy) / L2, 0, 1); return Math.hypot(x - x0 - t * dx, y - y0 - t * dy) <= w; }; };
  // shading helpers: lit from the lamp's side (left)
  const cyl = (cx, hw, base = 0.5) => (x) => { const t = (x - cx) / hw; return base + 0.34 * (1 - Math.min(1, Math.abs(t + 0.4) * 1.1)) - (t > 0.6 ? 0.2 : 0); };
  const vg = (y0, y1, a, b) => (x, y) => a + (b - a) * clamp((y - y0) / (y1 - y0), 0, 1);

  // ------------------------------------------------ wall and desk
  const DESK = 190, CL = 45, CR = 418, SLOPE = 0.38; // SLOPE: the crease's drop per u out from the corner (toward the eye's vanishing point)
  const crease = (x) => (x < CL ? DESK + (CL - x) * SLOPE : x > CR ? DESK + (x - CR) * SLOPE : DESK);
  const onWall = (x, y) => y < crease(x);
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < WW; X++) {
    const x = (X - OX + 0.5) / K, y = (Y + 0.5) / K;
    if (onWall(x, y)) {
      let s = theme.wall(x, y, X - OX, Y);
      if (x < CL || x > CR) s -= 0.2;
      if (Math.abs(x - CL) < 0.6 || Math.abs(x - CR) < 0.6) s = 0.02;
      if (y < 3) s = Math.min(s, 0.1);
      if (y > crease(x) - 2.2) s = Math.min(s, 0.12); // the shadow where the wall meets the desk
      put(X, Y, 'wall', s);
    } else if (y >= LH - 4.5) {
      put(X, Y, 'desk', y < LH - 3.5 ? 0.62 : 0.12);
    } else {
      const r = Math.floor((y - DESK - 1) / 9), ry = (y - DESK - 1) - r * 9;
      const joint = Math.abs(((x + 400 + r * 71) % 157)) < 0.7;
      let s = 0.48 + 0.12 * Math.sin(x * 0.22 + 2.6 * Math.sin(y * 0.8 + r * 1.7)) + (hash((X - OX) >> 2, Y, r) > 0.9 ? -0.12 : 0);
      if (y < crease(x) + 1.2) s = x < CL || x > CR ? 0.3 : 0.9; // the back edge catches the light; the sides sit in the walls' shadow
      else if (ry > 8.1 || joint) s = 0.12;
      else if (ry < 1) s += 0.1;
      put(X, Y, 'desk', s);
    }
  }

  // ------------------------------------------------ the camera, the lights, and the things modelled in 3D
  // The room is drawn as a camera sees it: world x and y are the back wall's u, z comes out of the wall toward you.
  // The camera sits at the eye's vanishing point (where the desk's creases meet), CAM[2] in front of the wall: a
  // seated eye at the monitor's middle. The desk's top is the plane y = DESK.
  const CAM = [230, 118.6, 400];
  const toScreen = ([x, y, z]) => { const k = CAM[2] / (CAM[2] - z); return [CAM[0] + (x - CAM[0]) * k, CAM[1] + (y - CAM[1]) * k]; };
  const LAMP = [72.8, 144, 20], LAVA = [308.4, 163.1, 8], MON = [223, 120, 4]; // the bulb, the lava lamp's glass, the screen
  /** How lit a modelled surface is: each light that's on (diffuse and a highlight), the room's fill and the monitor's glow. */
  const lightAt = (P, n, V, gloss, near = 0.62) => {
    let sh = 0.1 + Math.max(0, dot(n, V)) * 0.14 + 0.12 * Math.max(0, dot(n, norm(sub3(MON, P))));
    for (const [Lp, lit, k] of [[LAMP, on, near], [LAVA, lavaOn, 0.36]]) {
      if (!lit) continue;
      const L = norm(sub3(Lp, P));
      sh += k * Math.max(0, dot(n, L)) + gloss * Math.max(0, dot(n, norm([L[0] + V[0], L[1] + V[1], L[2] + V[2]]))) ** 28;
    }
    return sh;
  };
  /**
   * A modelled thing, ray-marched through the camera. m.scene(p) -> [distance, part] in the model's own units; m.S is
   * u per model unit; m.toLocal(world) / m.toWorld(local) / m.dirToWorld(local normal); m.box is two opposite corners
   * round it (local); m.look(part, p, n, P, V) -> [ramp, shade, emit]; m.ao (u) is how far its contact shade spreads
   * on the desk and m.reach (u) how far right its cast shadows can fall; m.seams false draws no ink where its parts meet
   * (for something small, whose parts read better by their light alone).
   */
  const model = (m) => {
    const cs = [];
    for (const x of [m.box[0][0], m.box[1][0]]) for (const y of [m.box[0][1], m.box[1][1]]) for (const z of [m.box[0][2], m.box[1][2]]) cs.push(toScreen(m.toWorld([x, y, z])));
    const B = bb(cs), X0 = Math.max(0, Math.floor(B[0] * K) + OX - 2), X1 = Math.min(WW - 1, Math.ceil(B[2] * K) + OX + 2), Y0 = Math.max(0, Math.floor(B[1] * K) - 2), Y1 = Math.min(H - 1, Math.ceil(B[3] * K) + 2);
    const Cw = m.toWorld(m.box[0].map((v, i) => (v + m.box[1][i]) / 2)), Rw = (Math.hypot(...m.box[1].map((v, i) => v - m.box[0][i])) / 2) * m.S;
    const dist = (P) => m.scene(m.toLocal(P))[0] * m.S;
    // d normalised: the hit distance (or -1), or for a shadow ray how lit the point is (0..1)
    const march = (o, d, tMax, soft) => {
      let t = 0, res = 1;
      for (let i = 0; i < 140 && t < tMax; i++) {
        const dd = dist([o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t]);
        if (soft) { res = Math.min(res, (10 * dd) / Math.max(t, 1e-3)); if (dd < 0.004) return 0; }
        else if (dd < 0.006) return t;
        t += Math.max(dd * 0.75, 0.004);
      }
      return soft ? clamp(res, 0, 1) : -1;
    };
    // its shadows on the desk (and whatever lies flat on it): contact shade under it, each light's cast shadow
    for (let Y = Y0; Y <= Math.min(H - 1, Y1 + 6); Y++) for (let X = Math.max(0, X0 - 4); X <= Math.min(WW - 1, X1 + m.reach * K); X++) {
      const x = (X - OX + 0.5) / K, y = (Y + 0.5) / K, i = Y * WW + X;
      if (onWall(x, y) || RB[i] < 0 || EB[i]) continue;
      const d = [x - CAM[0], y - CAM[1], -CAM[2]], t = (DESK - CAM[1]) / d[1];
      const P = [CAM[0] + d[0] * t, DESK - 0.01, CAM[2] + d[2] * t];
      let dark = (1 - clamp(dist(P) / m.ao, 0, 1)) * 0.45;
      for (const [Lp, lit, k] of [[LAMP, on, 0.3], [LAVA, lavaOn, 0.2]]) {
        if (!lit) continue;
        const v = sub3(Lp, P), L = Math.hypot(v[0], v[1], v[2]);
        dark += (1 - march(P, [v[0] / L, v[1] / L, v[2] / L], Math.min(L, 60), true)) * k;
      }
      if (dark > 0.02) SB[i] = Math.max(0, SB[i] - dark);
    }
    // it
    const MW = X1 - X0 + 1, MH = Y1 - Y0 + 1, depth = new Float32Array(MW * MH).fill(Infinity), part = new Array(MW * MH).fill(null), look = new Array(MW * MH);
    for (let Y = Y0; Y <= Y1; Y++) for (let X = X0; X <= X1; X++) {
      const x = (X - OX + 0.5) / K, y = (Y + 0.5) / K, d0 = [x - CAM[0], y - CAM[1], -CAM[2]], d = norm(d0);
      const t0 = Math.max(0, dot(sub3(Cw, CAM), d) - Rw), hit = march([CAM[0] + d[0] * t0, CAM[1] + d[1] * t0, CAM[2] + d[2] * t0], d, 2 * Rw, false);
      if (hit < 0) continue;
      const tt = t0 + hit, P = [CAM[0] + d[0] * tt, CAM[1] + d[1] * tt, CAM[2] + d[2] * tt], lp = m.toLocal(P), nm = m.scene(lp)[1];
      const e = 0.2 / m.S * 0.31, g = [0, 1, 2].map((k) => { const a1 = lp.slice(), a2 = lp.slice(); a1[k] += e; a2[k] -= e; return m.scene(a1)[0] - m.scene(a2)[0]; });
      const j = (Y - Y0) * MW + (X - X0);
      depth[j] = tt; part[j] = nm; look[j] = m.look(nm, lp, norm(m.dirToWorld(norm(g))), P, [-d[0], -d[1], -d[2]]);
    }
    const own = !ANC;
    if (own) ANC = toScreen(Cw);
    for (let Y = Y0; Y <= Y1; Y++) for (let X = X0; X <= X1; X++) {
      const j = (Y - Y0) * MW + (X - X0);
      if (!part[j]) continue;
      // the silhouette, a part well in front of what's behind it, and the seam where two parts meet (on the nearer)
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => {
        const XX = X + a, YY = Y + b;
        if (XX < X0 || XX > X1 || YY < Y0 || YY > Y1) return true;
        const k = (YY - Y0) * MW + (XX - X0);
        return !part[k] || depth[k] - depth[j] > 3 || (m.seams !== false && part[k] !== part[j] && depth[k] - depth[j] > -0.05);
      });
      const [ramp, sh, emit] = look[j];
      put(X, Y, edge ? 'ink' : ramp, edge ? 0.5 : clamp(sh, 0, 1), edge ? 0 : emit);
    }
    if (own) ANC = null;
  };

  // ------------------------------------------------ the decks
  // the studs they rest on: in toward the middle, but not centred under it
  for (const [x, y] of [[192, 39], [252, 39], [192, 78.5], [252, 78.5]]) shape([x, y, x + 6, y + 3], rect(x, y, x + 6, y + 3), 'silver', vg(y, y + 3, 0.8, 0.3));
  const deckShade = (y0, y1, sheen) => (x, y) => (y < y0 + 2 ? 0.9 : y > y1 - 2.6 ? 0.16 : 0.58 - 0.18 * ((y - y0) / (y1 - y0)) + (Math.abs(x - y * 1.4 - sheen) < 3 ? 0.14 : 0));
  // a deck without its trucks and wheels: the maple ply shows as a rim round the printed face, and the bolt holes
  // the trucks hang from go through it, four at each end
  const deck = (x0, y0, x1, y1, face, sheen) => {
    shape([x0, y0, x1, y1], pill(x0, y0, x1, y1), 'deckWood', (x, y) => (y < y0 + 1.4 ? 0.92 : y > y1 - 1.6 ? 0.3 : 0.62));
    shape([x0 + 1.9, y0 + 1.9, x1 - 1.9, y1 - 1.9], pill(x0 + 1.9, y0 + 1.9, x1 - 1.9, y1 - 1.9), face, deckShade(y0 + 1.9, y1 - 1.9, sheen), { outline: false });
    const cy = (y0 + y1) / 2;
    for (const hx of [x0 + 19, x0 + 24, x1 - 24, x1 - 19]) for (const hy of [cy - 3, cy + 3]) shape([hx - 1.4, hy - 1.4, hx + 1.4, hy + 1.4], ell(hx, hy, 1.05, 1.05), 'ink', 0.2, { outline: false });
  };
  deck(146, 2, 304, 39, 'deckA', 120);
  deck(145, 42, 303, 78.5, 'deckB', 175);

  // ------------------------------------------------ the poster
  shape([344, 85, 380, 131], rect(344, 85, 380, 131), 'frame', (x, y) => (x < 346 || y < 87 ? 0.8 : x > 378 || y > 129 ? 0.2 : 0.5));
  shape([347.4, 88.4, 376.6, 127.6], rect(347.4, 88.4, 376.6, 127.6), 'sky', vg(88, 128, 0.15, 0.95), { outline: false });
  for (const [x, y] of [[352, 92], [372, 104], [358, 99], [350, 106], [369, 92], [362, 107]]) put(pxX(x), px(y), 'moon', 0.95, true);
  shape([362, 91, 371, 101], (x, y) => ell(367, 96, 4.2, 4.2)(x, y) && !ell(369.2, 94.6, 3.6, 3.6)(x, y), 'moon', 0.8, { outline: false, emit: true });
  const hills = [[347.4, 127.6], [347.4, 117], [356, 108], [363, 116], [370, 109], [376.6, 116], [376.6, 127.6]];
  shape(bb(hills), poly(hills), 'hills', (x, y) => (y < 112 ? 0.95 : vg(108, 128, 0.7, 0.2)(x, y)), { outline: false });
  for (const [cx, h] of [[351, 9], [374, 8], [360, 6], [366, 7]]) shape([cx - 3, 127.6 - h, cx + 3, 127.6], poly([[cx, 127.6 - h], [cx + 2.6, 127.6], [cx - 2.6, 127.6]]), 'pine', (x) => (x < cx ? 0.55 : 0.25), { outline: false });

  // ------------------------------------------------ the headset, on a hook on the right side wall
  // Modelled in 3D and ray-traced through the room's camera, so its angle and perspective match the closet. The headset hangs in a plane parallel to
  // the side wall, off a short hook: band over the hook, a cup at each end facing the other, so from here you see
  // the near cup's round face, the far cup behind it, and the band arching between them.
  const HXW = 409, HOOK_Y = 36, HZ = 30, BR = 15; // the headset's plane, the hook's height, its depth, the band's radius
  const BCY = HOOK_Y + 1.6 + BR, CUP_Y = BCY + 8;
  const prims = []; // axis-aligned ellipsoids: centre, radii, part
  const add = (c, r, part) => prims.push({ c, r, part });
  for (let i = 0; i <= 44; i++) { const a = -Math.PI * 0.53 + (i / 44) * Math.PI * 1.06; add([HXW, BCY - BR * Math.cos(a), HZ + BR * Math.sin(a)], [1.9, 1.5, 1.5], 'band'); }
  for (const sgn of [-1, 1]) {
    add([HXW, CUP_Y, HZ + sgn * (BR + 1.6)], [6.8, 8.8, 2.8], 'shell');
    add([HXW, CUP_Y, HZ + sgn * (BR - 1.4)], [6.4, 8.4, 2.3], 'cushion');
    add([HXW, BCY - 1, HZ + sgn * BR], [1.4, 3.4, 1.4], 'band'); // the yoke down to the cup
  }
  for (let i = 0; i <= 8; i++) add([418 - i * 1.25, HOOK_Y + 0.4, HZ], [1.1, 1.1, 1.1], 'hook');
  add([417.6, HOOK_Y + 0.4, HZ], [0.6, 3.2, 2.6], 'hook'); // its plate on the wall
  const hitAll = (o, d, skipT) => {
    let best = null;
    for (const p of prims) {
      const oc = [(o[0] - p.c[0]) / p.r[0], (o[1] - p.c[1]) / p.r[1], (o[2] - p.c[2]) / p.r[2]];
      const dd = [d[0] / p.r[0], d[1] / p.r[1], d[2] / p.r[2]];
      const A = dd[0] ** 2 + dd[1] ** 2 + dd[2] ** 2, B = 2 * (oc[0] * dd[0] + oc[1] * dd[1] + oc[2] * dd[2]), C = oc[0] ** 2 + oc[1] ** 2 + oc[2] ** 2 - 1;
      const disc = B * B - 4 * A * C;
      if (disc < 0) continue;
      const t = (-B - Math.sqrt(disc)) / (2 * A);
      if (t <= (skipT || 1e-4)) continue;
      if (!best || t < best.t) best = { t, p };
      if (skipT && best) return best; // a shadow ray only needs one
    }
    return best;
  };
  // where it lands on the screen
  const corners = [];
  for (const x of [HXW - 9, 418]) for (const y of [HOOK_Y - 3, CUP_Y + 10]) for (const z of [HZ - BR - 6, HZ + BR + 6]) corners.push(toScreen([x, y, z]));
  const HB = bb(corners), HX0 = Math.floor(HB[0] * K) + OX - 2, HX1 = Math.ceil(HB[2] * K) + OX + 2, HY0 = Math.floor(HB[1] * K) - 2, HY1 = Math.ceil(HB[3] * K) + 2;
  // its shadow on the side wall (lamp on): the wall point under each pixel, traced back toward the lamp
  if (on) for (let Y = HY0; Y <= HY1 + 14; Y++) for (let X = HX0; X <= HX1 + 14; X++) {
    const x = (X - OX + 0.5) / K, y = (Y + 0.5) / K;
    if (x <= 418 || !onWall(x, y)) continue;
    const d = [x - CAM[0], y - CAM[1], -CAM[2]], t = (418 - CAM[0]) / d[0];
    const P = [CAM[0] + d[0] * t, CAM[1] + d[1] * t, CAM[2] + d[2] * t];
    if (hitAll(P, [LAMP[0] - P[0], LAMP[1] - P[1], LAMP[2] - P[2]], 0.002)) { const i = Y * WW + X; if (RB[i] >= 0) SB[i] = Math.max(0, SB[i] - 0.22); }
  }
  // the headset itself
  const HW = HX1 - HX0 + 1, HH = HY1 - HY0 + 1, depth = new Float32Array(HW * HH).fill(Infinity), part = new Array(HW * HH).fill(null), shadeBuf = new Float32Array(HW * HH);
  for (let Y = HY0; Y <= HY1; Y++) for (let X = HX0; X <= HX1; X++) {
    const x = (X - OX + 0.5) / K, y = (Y + 0.5) / K, d = [x - CAM[0], y - CAM[1], -CAM[2]];
    const h = hitAll(CAM, d);
    if (!h) continue;
    const P = [CAM[0] + d[0] * h.t, CAM[1] + d[1] * h.t, CAM[2] + d[2] * h.t];
    const n = norm([(P[0] - h.p.c[0]) / h.p.r[0] ** 2, (P[1] - h.p.c[1]) / h.p.r[1] ** 2, (P[2] - h.p.c[2]) / h.p.r[2] ** 2]);
    const L = norm([LAMP[0] - P[0], LAMP[1] - P[1], LAMP[2] - P[2]]), V = norm([-d[0], -d[1], -d[2]]);
    const diff = Math.max(0, dot(n, L)), spec = Math.max(0, dot(n, norm([L[0] + V[0], L[1] + V[1], L[2] + V[2]]))) ** 24;
    const fill = Math.max(0, dot(n, V)) * 0.18; // the room's light from in front
    const gloss = h.p.part === 'cushion' ? 0 : h.p.part === 'hook' ? 0.8 : 0.6;
    const j = (Y - HY0) * HW + (X - HX0);
    depth[j] = h.t; part[j] = h.p.part; shadeBuf[j] = 0.1 + 0.6 * diff * (on ? 1 : 0.35) + fill + gloss * spec * (on ? 1 : 0.2);
  }
  for (let Y = HY0; Y <= HY1; Y++) for (let X = HX0; X <= HX1; X++) {
    const j = (Y - HY0) * HW + (X - HX0);
    if (!part[j]) continue;
    // its outline: where it meets the wall, or where it passes in front of a part well behind it
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => {
      const XX = X + a, YY = Y + b;
      if (XX < HX0 || XX > HX1 || YY < HY0 || YY > HY1) return true;
      const k = (YY - HY0) * HW + (XX - HX0);
      return !part[k] || depth[k] - depth[j] > 0.012;
    });
    put(X, Y, edge ? 'ink' : part[j] === 'cushion' ? 'cushion' : part[j] === 'hook' ? 'silver' : 'plastic', edge ? 0.5 : clamp(shadeBuf[j], 0, 1));
  }
  // the green logo on the near cup's face
  const [lx, ly] = toScreen([HXW, CUP_Y, HZ + BR + 1.6 + 2.8]);
  for (const [a, b] of [[0, -1], [-1, 0], [1, 0], [0, 1], [0, 0]]) put(pxX(lx) + a, px(ly) + b, 'ledGreen', b === 0 && a === 0 ? 0.5 : 0.85, true);
  // the cable: from the near cup's foot, down the wall, then across the desk to the controller's back
  const [cx0, cy0] = toScreen([HXW, CUP_Y + 8.6, HZ + BR]);
  info.cableStart = [cx0, cy0];
  if (!skip.has('cable')) for (let y = cy0; y < 196; y += 0.4) {
    const t = (y - cy0) / (196 - cy0);
    put(pxX(cx0 + (419 - cx0) * t ** 3 + Math.sin(y / 9) * 1.1 * (1 - t)), px(y), 'plastic', 0.3);
  }

  // ------------------------------------------------ the monitor
  ANC = [222.5, 170]; // lit as one object, from where it stands
  // its tilt-and-swivel stand on the top book: an oval base and a neck (the books are slim so the stand can stand
  // tall while the monitor keeps its place under the decks)
  shape([192, 170, 253, 175], rect(193, 170.6, 252, 174.6), 'bezel', (x, y) => (y < 171.8 ? 0.85 : y > 173.6 ? 0.18 : cyl(222.5, 29.5, 0.3)(x)));
  shape([210, 158, 235, 172], rect(211.5, 158, 233.5, 171), 'bezel', (x, y) => cyl(222.5, 11, 0.35)(x) + (Math.abs(y - 164) < 0.6 ? -0.25 : 0));
  shape([161, 81, 284, 160], rect(161, 81, 284, 160), 'bezel', (x, y) => (x < 163.2 || y < 83.2 ? 0.9 : x > 281.8 || y > 157.8 ? 0.14 : 0.5 - (y - 83) * 0.002));
  shape([165, 84.5, 280.5, 156], (x, y) => rect(165, 84.5, 280.5, 156)(x, y) && !rect(167.5, 86.4, 278, 154)(x, y), 'bezelRim', (x, y) => (x < 166.5 || y < 85.8 ? 0.85 : 0.35), { outline: false });
  const SX0 = pxX(170), SY0 = px(87), SX1 = pxX(277), SY1 = px(153);
  for (let Y = SY0; Y <= SY1; Y++) for (let X = SX0; X <= SX1; X++) {
    const edge = X === SX0 || Y === SY0 || X === SX1 || Y === SY1;
    const cx = (X - (SX0 + SX1) / 2) / ((SX1 - SX0) / 2), cy = (Y - (SY0 + SY1) / 2) / ((SY1 - SY0) / 2);
    const v = 0.43 - 0.2 * (cx * cx + cy * cy) - (Y % 2 ? 0.05 : 0);
    put(X, Y, edge ? 'ink' : 'screen', edge ? 0.3 : clamp(v, 0, 0.43) * 0.75, !edge);
  }
  // what's on the glass is the live screen, laid over it on the page (LUNA_OS, as on the portfolio)
  for (const x of [172, 176, 180]) put(pxX(x), px(158), 'silver', 0.4);
  put(pxX(277), px(158), 'ledGreen', 0.8, true); put(pxX(277) + 1, px(158), 'ledGreen', 0.8, true);
  ANC = null;

  // ------------------------------------------------ the books
  ANC = [222, 198]; // lit as one object, from where it stands
  [['bookA', 'COMPUTER SCIENCE'], ['bookB', 'DATA STRUCTURES & ALGORITHMS'], ['bookC', 'COMPUTER ORGANIZATION']].forEach(([ramp, title], i) => {
    const y0 = 175 + i * 8, y1 = y0 + 7.8, x0 = 166 - (i === 1 ? 2 : 0), x1 = 280 + (i === 2 ? 2 : 0);
    shape([x0, y0, x1, y1], rect(x0, y0, x1, y1), (x) => (Math.abs(x - x0 - 4) < 0.7 || Math.abs(x - (x1 - 4)) < 0.7 ? 'gold' : ramp), (x, y) => (y < y0 + 1.6 ? 0.85 : y > y1 - 1.6 ? 0.18 : 0.5));
    shape([x1 - 13, y0 + 1.4, x1 - 8, y1 - 1.4], (x, y) => ell(x1 - 10.5, y0 + 3.9, 2.2, 2.2)(x, y) && !ell(x1 - 10.5, y0 + 3.9, 1.1, 1.1)(x, y), 'gold', 0.7, { outline: false });
  });
  ANC = null;

  // ------------------------------------------------ the Xbox, on the right beside the lava lamp
  // drawn as a 62-wide console at x 342, then scaled up to XW wide standing at X0 (the Xbox One is 333 x 79 mm; the
  // controller beside it is 153 mm, a little under half its width)
  // stretched longer than it is tall (XFX across, XFY up)
  const X0 = 328, XW = 82, XFX = XW / 62, XFY = 70 / 62;
  const inv = (fn) => (typeof fn === 'function' ? (x, y) => fn(342 + (x - X0) / XFX, 197 - (197 - y) / XFY) : fn);
  const xboxAt = (box, mask, ramp, shade, o = {}) => shape([X0 + (box[0] - 342) * XFX, 197 - (197 - box[1]) * XFY, X0 + (box[2] - 342) * XFX, 197 - (197 - box[3]) * XFY], inv(mask), ramp, inv(shade), { ...o, emit: inv(o.emit) });
  const lavaAt = moved(-105); // the lava lamp stands left of the Xbox
  ANC = [X0 + XW / 2, 196]; // lit as one object, from where it stands
  xboxAt([342, 179, 404, 197], rect(342, 179, 404, 197), 'plastic', (x, y) => (y < 182 ? 0.8 - (x - 342) * 0.004 : x > 375 && ((x - 375) % 3) < 1.1 && y < 195 ? 0.05 : x < 345 ? 0.55 : 0.32));
  xboxAt([346, 186.5, 372, 188], rect(346, 186.5, 372, 188), 'plastic', 0, { outline: false });
  { // the power button: the white Xbox sphere with its X cut through it, lit, kept round
    const cx = Math.round((X0 + (398 - 342) * XFX) * K) + OX, cy = Math.round((197 - (197 - 189.5) * XFY) * K);
    ['.#####.', '#.###.#', '##.#.##', '###.###', '##.#.##', '#.###.#', '.#####.'].forEach((row, y) => [...row].forEach((k, x) => { if (k === '#') put(cx - 3 + x, cy - 3 + y, 'white', 0.9, true); }));
  }
  ANC = null;

  // ------------------------------------------------ the lava lamp, left of the Xbox
  ANC = [310, 196]; // lit as one object, from where it stands
  const lglass = [[412, 147], [418, 147], [421.5, 180], [408.5, 180]];
  const lcap = [[413, 136], [417, 136], [418.2, 147], [411.8, 147]];
  const lbase = [[408.5, 180], [421.5, 180], [424.5, 196.5], [405.5, 196.5]];
  if (!skip.has('lava')) {
  lavaAt(bb(lbase), poly(lbase), 'silver', cyl(415, 9, 0.48));
  lavaAt(bb(lcap), poly(lcap), 'silver', cyl(415, 3.5, 0.48));
  const blobs = any(ell(415, 175.5, 4, 3.4), ell(416.2, 161, 2.2, 3.2), ell(414, 152.5, 1.5, 1.8), ell(417.4, 168, 1.1, 1.3));
  lavaAt(bb(lglass), poly(lglass), (x, y) => (blobs(x, y) ? (lavaOn ? 'wax' : 'waxOff') : lavaOn ? 'lavaOn' : 'lavaOff'), (x, y) => cyl(415, 6, 0.45)(x) + (y > 172 ? 0.12 : 0), { emit: lavaOn });
  }
  ANC = null;

  // ------------------------------------------------ the pencil cup, beside the lamp on its right, clear of its base
  ANC = [97, 193]; // lit as one object, from where it stands
  // sized to the mug beside it: a little shorter and narrower, as a real pen cup is
  const CU0 = 85, CU1 = 109, CUT = 166, CUB = 194, CUM = (CU0 + CU1) / 2;
  const pens = [[CUM - 6, CUT + 1, CUM - 9, CUT - 17, 'penA'], [CUM, CUT + 1, CUM + 2.4, CUT - 20, 'penB'], [CUM + 6, CUT + 1, CUM + 8.6, CUT - 14, 'penC']];
  info.pens = pens;
  for (const [i, [x0, y0, x1, y1, r]] of pens.entries()) {
    if (skip.has('pens') || skip.has(`pen${i}`)) continue;
    shape([Math.min(x0, x1) - 2.5, y1 - 1.5, Math.max(x0, x1) + 2.5, y0], thick(x0, y0, x1, y1, 1.4), r, (x) => (x < (x0 + x1) / 2 ? 0.75 : 0.35));
    shape([x1 - 1.6, y1 - 2.2, x1 + 1.6, y1 + 0.8], ell(x1, y1 - 0.6, 1.3, 1.5), 'gold', 0.75, { outline: false });
  }
  shape([CU0, CUT, CU1, CUB], rect(CU0, CUT, CU1, CUB), 'clay', (x, y) => cyl(CUM, (CU1 - CU0) / 2, 0.5)(x) + (y < CUT + 2 ? 0.25 : 0));
  shape([CU0 + 1, CUT + 1, CU1 - 1, CUT + 2.4], rect(CU0 + 1.2, CUT + 1.2, CU1 - 1.2, CUT + 2.2), 'clay', 0.12, { outline: false }); // the rim's inside
  // a tri-colour corgi's face on the cup: black ears and crown, tan inside the ears, over the brows and on the cheeks,
  // a white blaze down to a white muzzle, black eyes and nose
  pattern([
    '.B.......B.',
    '.BB.....BB.',
    '.BtB...BtB.',
    '.BBBBwBBBB.',
    'BBtBBwBBtBB',
    'BtkttwttktB',
    '.ttwwwwwtt.',
    '..wwwnwww..',
    '...wwwww...',
  ], pxX(CUM) - 11, px(CUT + 7), 2, { B: ['corgiBlack', 0.3], t: ['corgiTan', 0.45], w: ['corgiWhite', 0.75], k: ['ink', 0.4], n: ['ink', 0.4] });
  ANC = null;

  // ------------------------------------------------ the lamp, in from the left corner so its base stands clear of the side wall
  ANC = [64.5, 168]; // lit as one object: from partway up its stand, right under the bulb
  const LAMP_DX = 18, lampAt = moved(LAMP_DX);
  // the stand, 40% shorter than it was: its turned profile (laid out for 115..184.5) squeezed into 143..184.5
  const LIFT = 28, squeeze = (y) => 184.5 - (184.5 - y) / 0.6;
  const half = (Y) => {
    const y = squeeze(Y);
    if (y < 115 || y > 184.5) return -1;
    if (y < 119) return 2; if (y < 124) return 3.2; if (y < 127) return 2.2;
    if (y < 145) return 2.2 + Math.sin(((y - 127) / 18) * Math.PI / 2) * 5;
    if (y < 163) return 7.2 - ((y - 145) / 18) * 4.2;
    if (y < 176) return 3; if (y < 180) return 4.2;
    return 3.2;
  };
  // its foot, modelled (u): a weighted bronze plinth flat on the desk, a step, a domed top and a flare into the stand,
  // seen as the camera sees a disc on the desk this far back, lit from the bulb straight above it
  {
    const FZ = 21, FX = CAM[0] + (46.5 + LAMP_DX - CAM[0]) / (CAM[2] / (CAM[2] - FZ)); // right under the stand
    model({
      S: 1, ao: 3, reach: 6, box: [[-18, 0, -18], [18, 10, 18]],
      toLocal: (P) => [P[0] - FX, DESK - P[1], P[2] - FZ], toWorld: ([x, y, z]) => [FX + x, DESK - y, FZ + z], dirToWorld: ([x, y, z]) => [x, -y, z],
      scene: (p) => {
        const plinth = sdCyl(p, [0, 1.2, 0], 16, 1.2) - 0.5;
        let top = sdCyl(p, [0, 3, 0], 13.6, 0.7) - 0.3;
        top = smin(top, sdEll(p, [0, 3.4, 0], [12, 3.4, 12]), 1.2);
        top = smin(top, sdCone(p, [0, 5.6, 0], [0, 9.8, 0], 4.8, 3), 1.5);
        return plinth < top ? [plinth, 'plinth'] : [top, 'top'];
      },
      look: (nm, p, n, P, V) => ['bronze', lightAt(P, n, V, 0.6, 0.8) + (nm === 'plinth' ? -0.05 : 0.05), 2],
    });
  }
  lampAt([36, 114 + LIFT, 58, 188], (x, y) => { const h = half(y); return h >= 0 && Math.abs(x - 46.5) <= h; }, 'bronze', (x, y) => { const yy = squeeze(y); return cyl(46.5, Math.max(1, half(y)), 0.42)(x) + ((yy > 123 && yy < 124.5) || (yy > 162.5 && yy < 164) ? -0.2 : 0); });
  for (let y = 116 + LIFT; y < 140 + LIFT; y += 1.6) put(pxX(63 + LAMP_DX), px(y), 'silver', 0.7);
  lampAt([60.5, 139.5 + LIFT, 65.5, 145 + LIFT], ell(63, 142.2 + LIFT, 2.1, 2.3), 'silver', (x) => cyl(63, 2.1, 0.5)(x));
  if (on) lampAt([38, 113 + LIFT, 55, 119 + LIFT], ell(46.5, 116 + LIFT, 6.5, 2.2), 'white', 1, { outline: false, emit: true });
  const shade = [[35, 80 + LIFT], [58, 80 + LIFT], [75, 115.5 + LIFT], [18, 115.5 + LIFT]];
  lampAt([18, 80 + LIFT, 75, 115.5 + LIFT], poly(shade), (x, Y) => {
    const y = Y - LIFT, t = (y - 80) / 35.5, w = 11.5 + t * 17, u = (x - 46.5) / w;
    if (Math.abs(y - 108.5) < 0.7 || Math.abs(y - 112) < 0.7) return 'lead';
    for (const k of [-0.62, -0.2, 0.2, 0.62]) if (Math.abs(u - k) * w < 0.55) return 'lead';
    return on ? 'glassOn' : 'glassOff';
  }, (x, Y) => {
    const y = Y - LIFT, t = (y - 80) / 35.5, w = 11.5 + t * 17, u = (x - 46.5) / w;
    const pane = Math.floor((u + 1) * 2.5) % 2; // alternating panes, like stained glass
    const base = on ? 0.45 + t * 0.35 : 0.55 - Math.abs(u + 0.3) * 0.4;
    return clamp(base + (pane ? 0.12 : -0.05) - (u > 0.65 ? 0.15 : 0) + (y > 112.5 ? 0.15 : 0), 0, 1);
  }, { emit: (x, Y) => on && !(Math.abs(Y - LIFT - 108.5) < 0.7 || Math.abs(Y - LIFT - 112) < 0.7) });
  lampAt([44, 75.5 + LIFT, 49, 80.5 + LIFT], rect(44, 75.5 + LIFT, 49, 80.5 + LIFT), 'bronze', (x) => cyl(46.5, 2.5, 0.5)(x));
  ANC = null;

  // ------------------------------------------------ the sticky notes
  const note = (x0, y0, ramp, words) => {
    const sheet = [[x0, y0], [x0 + 28, y0], [x0 + 28, y0 + 21], [x0 + 21, y0 + 27.5], [x0, y0 + 27.5]];
    shape(bb(sheet), poly(sheet), ramp, (x, y) => (y < y0 + 2.6 ? 0.35 : 0.68 - (y - y0) * 0.006));
    const fold = [[x0 + 21, y0 + 27.5], [x0 + 28, y0 + 21], [x0 + 22, y0 + 21.5]];
    shape(bb(fold), poly(fold), ramp, 0.88);
  };
  info.note = [113, 97, 28, 27.5];
  if (!skip.has('note')) note(113, 97, opt.noteRamp || theme.note1, ['SHIP', 'IT!']); // halfway between the lamp (its edge at 93) and the monitor (161)

  // ------------------------------------------------ the mug and its steam, forward on the desk beside the keyboard
  ANC = [121, 210]; // lit as one object, from where it stands
  const MY = 16;
  info.mug = { MY };
  if (!skip.has('mug')) { // how far toward you from where it stood
  shape([101, 193 + MY, 146, 200.5 + MY], ell(121.5, 197 + MY, 20, 2.9), 'cork', (x, y) => (y < 196.5 + MY ? 0.75 : 0.3));
  shape([132, 160 + MY, 145, 186 + MY], (x, y) => ell(137, 172 + MY, 7.8, 10.5)(x, y) && !ell(137, 172 + MY, 4.2, 6.5)(x, y) && x > 134, 'mug', (x) => (x > 141 ? 0.25 : 0.5));
  shape([106, 151 + MY, 136, 196 + MY], any(rect(106, 155 + MY, 136, 194 + MY), ell(121, 155 + MY, 15, 3.2), ell(121, 194 + MY, 15, 2.6)), 'mug', (x) => cyl(121, 15, 0.45)(x));
  shape([108.4, 152.6 + MY, 133.6, 157.6 + MY], ell(121, 155 + MY, 12.6, 2.1), 'coffee', (x) => (x < 116 ? 0.3 : 0.6), { outline: false });
  shape([113, 167 + MY, 127, 183 + MY], (x, y) => ell(120, 175 + MY, 5.6, 6.8)(x, y) && !ell(122.6, 173 + MY, 4.8, 5.9)(x, y), 'moonAccent', 0.6, { outline: false });
  info.steam = { sources: [[116, 154 + MY], [121, 153.5 + MY], [125.5, 154 + MY]], box: [100, 98 + MY, 142, 157 + MY] }; // off the coffee (its top at 153 + MY), up the wall
  if (!skip.has('steam')) for (const [x0, ph] of [[116, 0], [125, 2]]) for (let y = 128 + MY; y < 150 + MY; y += 0.6) {
    const X = pxX(x0 + Math.sin(y / 4 + ph) * 2.2), Y = px(y);
    if ((X - OX + Y) % 2 === 0 && hash(X - OX, Y, 5) > (y - 128 - MY) / 26) put(X, Y, 'steam', 0.7);
  }
  }
  ANC = null;

  // ------------------------------------------------ the keyboard
  ANC = [218, 220]; // lit as one object, from where it stands
  const kb = [[148, 199], [289, 199], [292.5, 221.5], [144.5, 221.5]];
  shape(bb(kb), poly(kb), 'keysCase', (x, y) => (y > 219.5 ? 0.15 : y < 200.5 ? 0.75 : 0.4));
  for (let r = 0; r < 4; r++) {
    const y = 202 + r * 4.4, inset = 4 - r;
    for (let x = 151 + inset; x + 4 <= 286 - inset; x += 5.8) {
      const space = r === 3 && x > 190 && x < 240;
      if (space && Math.abs(x - 193.2) > 3) continue;
      const w = space ? 44 : 4.2;
      if (x + w > 286 - inset) break;
      shape([x, y, x + w, y + 3.2], rect(x, y, x + w, y + 3.2), 'keys', (px_, py) => (py < y + 1 ? 0.88 : py > y + 2.4 ? 0.2 : 0.55), { outline: false });
    }
  }
  ANC = null;

  // ------------------------------------------------ the iPad, its screen off, and the Apple Pencil lying on it
  // Modelled in millimetres (an 11-inch iPad, 248 x 179 x 6; the Pencil 166 long, 9 across) and seen through the
  // room's camera, turned a little so its far edge runs back to the right, as the notebook lay. Its black glass
  // reflects the lamp where the angle brings the shade into it; its edge and the Pencil are lit like everything else.
  {
    const S = 0.26, YAW = -0.2, C = [95, DESK, 97];
    const cy = Math.cos(YAW), sy = Math.sin(YAW);
    const toLocal = (P) => { const dx = (P[0] - C[0]) / S, dz = (P[2] - C[2]) / S; return [dx * cy + dz * sy, (DESK - P[1]) / S, -dx * sy + dz * cy]; };
    const toWorld = ([x, y, z]) => [C[0] + (x * cy - z * sy) * S, DESK - y * S, C[2] + (x * sy + z * cy) * S];
    const dirToWorld = ([x, y, z]) => [x * cy - z * sy, -y, x * sy + z * cy];
    const HX = 123.8, HZ = 89.3, T = 6.1, CR = 10; // half its width and depth, its thickness, its corner radius
    const rr = (x, z, hx, hz, r) => { const qx = Math.abs(x) - (hx - r), qz = Math.abs(z) - (hz - r); return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r; };
    const PR = 4.45, A = [-92, T + PR, 46], DIR = norm([150, 0, -84]), TIP = 17; // the Pencil: its tip end, its run, its sharpened length
    const B = [A[0] + DIR[0] * 166, A[1], A[2] + DIR[2] * 166], TB = [A[0] + DIR[0] * TIP, A[1], A[2] + DIR[2] * TIP];
    model({
      S, ao: 4, reach: 10, box: [[-HX - 4, 0, -HZ - 4], [HX + 4, T + 2 * PR + 1, HZ + 4]], toLocal, toWorld, dirToWorld,
      scene: (p) => {
        const pad = extrude(rr(p[0], p[2], HX, HZ, CR), p[1], 0, T, 2.4);
        const pen = Math.min(sdCone(p, A, TB, 0.7, PR), sdCone(p, TB, B, PR, PR));
        return pen < pad ? [pen, Math.hypot(p[0] - A[0], p[2] - A[2]) < TIP - 2 ? 'tip' : 'pencil'] : [pad, 'ipad'];
      },
      look: (nm, p, n, P, V) => {
        if (nm !== 'ipad') return ['pencilWhite', lightAt(P, n, V, 0.15, 0.7) * 1.15 - (nm === 'tip' ? 0.12 : 0), 2];
        if (p[1] < T - 0.5 || -n[1] < 0.9) return ['alu', lightAt(P, n, V, 0.5, 0.75), 2]; // the aluminium edge
        // the glass: black, a faint sheen at a grazing look, and the lamp's shade where the reflection lands on it
        const Rf = [2 * dot(n, V) * n[0] - V[0], 2 * dot(n, V) * n[1] - V[1], 2 * dot(n, V) * n[2] - V[2]];
        const shadeAt = [LAMP[0], LAMP[1] - 14, LAMP[2]]; // the middle of the glowing shade
        const glint = on ? clamp((dot(Rf, norm(sub3(shadeAt, P))) - 0.988) / 0.008, 0, 1) : 0;
        const active = Math.abs(p[0]) < HX - 7 && Math.abs(p[2]) < HZ - 7; // the screen inside its bezel, a shade deeper
        return ['glassBlack', 0.07 + 0.16 * (1 - Math.max(0, dot(n, V))) ** 3 - (active ? 0.03 : 0) + glint * 0.9, 2];
      },
    });
  }

  // ------------------------------------------------ the mousepad, mouse and controller
  ANC = [339, 220]; // lit as one object, from where it stands
  const MDX = -26; // the mouse and its pad, in close beside the keyboard
  const pad = [[328 + MDX, 202], [402 + MDX, 202], [405.5 + MDX, 223.5], [324.5 + MDX, 223.5]];
  shape(bb(pad), poly(pad), 'pad', (x, y) => (y < 203.5 ? 0.75 : y > 222 ? 0.15 : 0.42));
  // a black gaming mouse on the pad, its nose turned in toward the keyboard so its left side, with the thumb buttons, faces you. Modelled in mm
  // (x right, y up, z toward you): 125 long, 63 wide at the back, its hump 38 high just behind the middle; the two
  // buttons split by the wheel, a DPI button behind it, two thumb buttons on the left side, a lit logo on the palm.
  {
    const S = 0.235, YAW = -0.55, C = [313, DESK, 95];
    const cy = Math.cos(YAW), sy = Math.sin(YAW);
    const toLocal = (P) => { const dx = (P[0] - C[0]) / S, dz = (P[2] - C[2]) / S; return [dx * cy + dz * sy, -(P[1] - C[1]) / S, -dx * sy + dz * cy]; };
    const toWorld = ([x, y, z]) => [C[0] + (x * cy - z * sy) * S, C[1] - y * S, C[2] + (x * sy + z * cy) * S];
    const dirToWorld = (n) => [n[0] * cy - n[2] * sy, -n[1], n[0] * sy + n[2] * cy];
    const HALF = [[0, -62], [12, -61], [22, -58], [28, -50], [29, -35], [28, -15], [29.5, 5], [31.5, 25], [31, 40], [27, 52], [18, 60], [8, 63], [0, 63.5]];
    const OUT = [...HALF, ...HALF.slice(1, -1).reverse().map(([x, z]) => [-x, z])];
    const top = (x, z) => 38 - 16 * ((z - 15) / 75) ** 2 - 12 * (x / 32) ** 2;
    const WHEEL = -38, LOGO = [0, 30];
    const scene = (p) => {
      const [x, y, z] = p, tp = top(x, z);
      // the shell, narrowing a little toward the top; a slot down the middle for the wheel
      let body = extrude(sdPoly2(x, z, OUT) + Math.max(0, y - 12) * 0.22, y, 0, tp, 6);
      body = Math.max(body, -sdBox(p, [0, tp, WHEEL], [3.6, 6, 11], 0.5));
      // the buttons are the shell's front half, split down the middle
      let best = body, part = z < -12 && y > 15 ? (x < 0 ? 'lbtn' : 'rbtn') : 'body';
      const take = (d, name) => { if (d < best) { best = d; part = name; } };
      { const c = top(0, WHEEL) - 3.2; take(Math.max(Math.hypot(y - c, z - WHEEL) - 7, Math.abs(x) - 2.2), 'wheel'); }
      take(sdBox(p, [0, top(0, -19) + 0.4, -19], [2, 1, 3], 0.6), 'dpi');
      for (const bz of [-24, -8]) take(sdBox(p, [-29.5, 22, bz], [1.4, 2.6, 6.5], 0.8), 'side');
      return [best, part];
    };
    model({
      S, ao: 4, reach: 30, box: [[-36, -2, -68], [36, 44, 68]], toLocal, toWorld, dirToWorld, scene,
      look: (nm, p, n, P, V) => {
        if (nm === 'body' && p[1] > top(p[0], p[2]) - 1.5 && Math.hypot(p[0] - LOGO[0], p[2] - LOGO[1]) < 5.5) return ['ledGreen', 0.8, 1];
        if (nm === 'body' && p[1] > 2 && p[1] < 4 && p[2] > -20) return ['ledGreen', 0.6, 1]; // the glow strip round its back
        const gloss = nm === 'side' ? 0.7 : nm === 'lbtn' || nm === 'rbtn' ? 0.45 : 0.3;
        return ['padBlack', lightAt(P, n, V, gloss) + (nm === 'wheel' ? 0.16 : nm === 'side' || nm === 'dpi' ? 0.06 : 0), 0];
      },
    });
  }
  ANC = null;

  // the Xbox Series controller lying on the desk right of the mouse pad, turned a little (drawControllerHD, above),
  // drawn a little bigger than the mouse beside it
  {
    const pad = drawControllerHD(on, 84), PX0 = 549 + OX, PY0 = 312 - pad.h, low = new Map();
    info.controller = { x: 549, y: 312 - pad.h, pad }; // its sprite and top-left corner (px)
    for (const [c, r, ramp, shade, emit] of pad.px) { put(PX0 + c, PY0 + r, ramp, shade, emit); low.set(c, Math.max(low.get(c) ?? -1, r)); }
    // its shadow on the desk under it
    for (const [c, r] of low) for (let k = 1; k <= 2; k++) { const i = (PY0 + r + k) * WW + PX0 + c; if (!EB[i] && RB[i] >= 0) SB[i] = Math.max(0, SB[i] - (k === 1 ? 0.35 : 0.18)); }
  }
  // ------------------------------------------------ light
  const out = new Uint8ClampedArray(WW * H * 4);
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < WW; X++) {
    const i = Y * WW + X, o = i * 4;
    out[o + 3] = 255;
    const r = RB[i];
    if (r < 0) continue;
    const ramp = ramps[r], n = ramp.length, b = BAYER[(Y & 3) * 4 + ((X - OX) & 3)];
    const anchored = AX[i] >= 0, x = anchored ? AX[i] : (X - OX + 0.5) / K, y = anchored ? AY[i] : (Y + 0.5) / K;
    if (EB[i]) { const c = ramp[clamp(Math.round(SB[i] * (n - 1) + (EB[i] === 2 ? (b - 0.5) * 0.95 : 0)), 0, n - 1)]; out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; continue; }
    // the lamp: a pool on the wall round the shade (taller below it), one on the desk under it
    let lamp = 0;
    if (on) {
      if (onWall(x, y)) { const dy = y - 134; lamp = Math.exp(-((Math.hypot((x - 64.5) / 1.2, dy / (dy < 0 ? 0.7 : 1.05)) / 56) ** 2)); }
      else lamp = Math.exp(-((Math.hypot((x - 68) / 2.5, (y - 199) / 0.75) / 42) ** 2));
    }
    const dxs = Math.max(170 - x, 0, x - 277), dys = Math.max(87 - y, 0, y - 153);
    const mon = Math.exp(-((Math.hypot(dxs, dys * 1.15) / 20) ** 2)) * (on ? 0.4 : 1);
    // the lava lamp: a soft pink pool on the wall round its glass, and one on the desk at its foot
    const lava = !lavaOn ? 0 : onWall(x, y) ? Math.exp(-((Math.hypot(x - 310, (y - 160) * 0.85) / 40) ** 2)) : Math.exp(-((Math.hypot((x - 310) / 2.4, (y - 199) / 0.8) / 24) ** 2));
    const shift = (on ? lamp * 2.3 - 0.25 + theme.ambient : -1.05 + theme.ambient + mon * 0.9) + lava * (on ? 0.7 : 1.5);
    const v = SB[i] * (n - 1) + shift + (b - 0.5) * 0.95;
    const c = ramp[clamp(Math.round(v), 0, n - 1)];
    // tint in flat dithered bands
    const q = (f) => Math.floor(f * 4 + (anchored ? 0.5 : b * 0.999)) / 4;
    let t;
    if (on) { const l = q(lamp); t = [1 + theme.warm[0] * l, 1 + theme.warm[1] * l, 1 + theme.warm[2] * l]; }
    else t = theme.night.slice();
    const g = q(mon), p = q(lava);
    t[0] *= 1 - 0.12 * g + 0.35 * p; t[1] *= 1 + 0.5 * g - 0.06 * p; t[2] *= 1 + 0.3 * g + 0.3 * p;
    // the lamp's light also adds its own colour, so it reads warm on any wall
    const add = on ? q(lamp) : 0;
    const pink = p * (on ? 0.6 : 1); // the lava lamp's own colour
    out[o] = c[0] * t[0] + theme.glow[0] * add + 70 * pink; out[o + 1] = c[1] * t[1] + theme.glow[1] * add + 14 * pink; out[o + 2] = c[2] * t[2] + theme.glow[2] * add + 46 * pink;
  }
  return out;
}

const THEMES = [
  {
    id: 'ember', name: 'Ember', mood: 'Warm amber evening. The current portfolio direction, pushed further: plaster wall, honey wood, one big pool of lamp light.',
    finish: 'Plaster wall, speckled',
    lines: ['CHRISTOPHER LUNA', 'SOFTWARE ENGINEER', 'CSU DOMINGUEZ HILLS', 'B.S. COMPUTER SCIENCE'],
    note1: 'noteGreen', note2: 'noteOrange', ambient: 0.05, warm: [0.26, 0.1, -0.12], glow: [26, 12, 0], night: [0.66, 0.7, 0.92],
    wall: (x, y, X, Y) => 0.5 + (hash(X, Y, 1) > 0.95 ? -0.16 : hash(X, Y, 2) > 0.97 ? 0.12 : 0) + 0.05 * Math.sin(y * 0.05),
    ramps: {
      wall: R(['#260c02', '#3a1404', '#541f06', '#6e2e0e', '#8c4218']), desk: R(['#2e1003', '#542409', '#7c3a12', '#9e4e1a', '#c4702e']),
      deckA: R(['#03201a', '#073a26', '#0e5236', '#1a6a48', '#38906a']), deckB: R(['#40242a', '#704446', '#946060', '#b48480', '#d8aca4']),
      deckAText: R(['#7a5216', '#b08032', '#e6ae5c', '#f6c87a', '#ffe0a8']), deckBText: R(['#3a0414', '#5a0a20', '#7e122e', '#9a1c3c', '#c0304e']),
      bezel: R(['#1a0d06', '#2c170c', '#3e2014', '#55301e', '#70432a']), bezelRim: R(['#6a2a0a', '#a04414', '#d0661e', '#ec8a3a', '#ffb466']),
      noteGreen: R(['#3e6a2c', '#5e9446', '#82bc66', '#a2d684', '#c8ecaa']), noteOrange: R(['#8a4410', '#c4681e', '#ec8e3a', '#f8ae5e', '#ffd090']),
    },
    swatches: ['#541f06', '#7c3a12', '#0e5236', '#946060', '#ffd274'],
  },
  {
    id: 'midnight', name: 'Midnight', mood: 'Cool navy room, warm lamp. The contrast makes the lamp the hero and the monitor glow read from across the room.',
    finish: 'Board paneling, vertical',
    lines: ['CHRISTOPHER LUNA', 'SOFTWARE ENGINEER', 'CSU DOMINGUEZ HILLS', 'B.S. COMPUTER SCIENCE'],
    note1: 'noteYellow', note2: 'notePink', ambient: 0.1, warm: [0.5, 0.22, -0.28], glow: [92, 52, 6], night: [0.62, 0.7, 1.0],
    wall: (x, y, X, Y) => { const m = (x + 3) % 23; return m < 0.8 ? 0.12 : m < 1.7 ? 0.7 : 0.46 + (hash(X, Y >> 3, Math.floor((x + 3) / 23)) > 0.85 ? -0.08 : 0) + 0.04 * Math.sin(y * 0.3 + Math.floor((x + 3) / 23)); },
    ramps: {
      wall: R(['#080c18', '#0f1628', '#16213c', '#203052', '#2e4470']), desk: R(['#140a06', '#2a170e', '#432719', '#5c3824', '#7c5034']),
      deckA: R(['#2e1f04', '#5a420c', '#8c6a16', '#b8902a', '#e2bc52']), deckB: R(['#04201f', '#0b3a3a', '#145858', '#24807c', '#46aaa2']),
      deckAText: R(['#160f02', '#241a06', '#33250a', '#40300e', '#503c14']), deckBText: R(['#a8e6d8', '#c4f0e4', '#dcf8ee', '#ecfcf6', '#ffffff']),
      bezel: R(['#0c0c12', '#16161e', '#22222c', '#30303c', '#444452']), bezelRim: R(['#3a2a10', '#6a4c1c', '#9a7030', '#c8964a', '#ecc274']),
      noteYellow: R(['#8a6a10', '#c49a1e', '#ecc23a', '#f8d860', '#fff0a0']), notePink: R(['#8a3a54', '#c45e7c', '#ec86a4', '#f8a8c0', '#ffd0de']),
    },
    swatches: ['#16213c', '#432719', '#8c6a16', '#145858', '#ffd274'],
  },
  {
    id: 'dusk', name: 'Dusk', mood: 'Soft plum and light oak with sage and coral accents. Calmer and more lo-fi, closer to an illustrated study room.',
    finish: 'Diamond wallpaper',
    lines: ['CHRISTOPHER LUNA', 'SOFTWARE ENGINEER', 'CSU DOMINGUEZ HILLS', 'B.S. COMPUTER SCIENCE'],
    note1: 'noteCream', note2: 'noteCoral', ambient: 0.12, warm: [0.3, 0.16, -0.06], glow: [58, 34, 8], night: [0.6, 0.62, 0.9],
    wall: (x, y) => { const a = ((x + y) % 11 + 11) % 11, c = ((x - y) % 11 + 11) % 11; return a < 0.7 || c < 0.7 ? 0.62 : (Math.abs(a - 5.5) < 0.7 && Math.abs(c - 5.5) < 0.7 ? 0.68 : 0.45); },
    ramps: {
      wall: R(['#180c1a', '#271629', '#38213c', '#4c2e52', '#64406a']), desk: R(['#3a2412', '#5c3c20', '#82603a', '#a47e52', '#c8a06c']),
      deckA: R(['#162418', '#2a402e', '#426048', '#5e8464', '#86aa88']), deckB: R(['#401814', '#6e3028', '#9a4c3e', '#c26e5a', '#e6957e']),
      deckAText: R(['#c8b890', '#dccca4', '#ece0bc', '#f6eed2', '#fffaea']), deckBText: R(['#c8b890', '#dccca4', '#ece0bc', '#f6eed2', '#fffaea']),
      bezel: R(['#1e1418', '#2e2026', '#40303a', '#56424e', '#705868']), bezelRim: R(['#4a3a2a', '#7a6248', '#a8886a', '#cab08e', '#ead2b2']),
      noteCream: R(['#8a7e5a', '#bcae86', '#e2d6ae', '#f2e8c6', '#fffae4']), noteCoral: R(['#8a3a2a', '#c45c44', '#ec8064', '#f8a084', '#ffc8b0']),
    },
    swatches: ['#38213c', '#82603a', '#426048', '#9a4c3e', '#ffd274'],
  },
];

if (typeof module !== 'undefined') module.exports = { drawRoom, controllerImage, drawControllerHD, THEMES, SHARED, W, H, K };

