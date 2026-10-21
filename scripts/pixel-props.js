// Pixel-art prop renderer: shaded shapes -> palette ramps + Bayer dither + selective outlines -> PNG.
// usage: node scripts/pixel-props.js public/props [previewDir] [canvasProjectDir]
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const OUT = process.argv[2], PREV = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });
if (PREV) fs.mkdirSync(PREV, { recursive: true });

// ---------- PNG ----------
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc(b) { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); }
function writePng(file, W, H, px) {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; Buffer.from(px.buffer, px.byteOffset + y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

// ---------- helpers ----------
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map(r => r.map(v => (v + 0.5) / 16));
const norm = v => { const l = Math.hypot(...v) || 1; return v.map(a => a / l); };
const L = norm([-0.55, -0.6, 0.6]);
const HV = norm([L[0], L[1], L[2] + 1]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function light(n, { amb = 0.2, spec = 0, shin = 24 } = {}) {
  const d = Math.max(0, dot(n, L));
  let v = amb + (1 - amb) * (d * 0.9 + 0.1);
  if (spec) v += spec * Math.pow(Math.max(0, dot(n, HV)), shin);
  return v * 0.84;
}
const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(x, y, s, sc) {
  x /= sc; y /= sc; const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

class Cv {
  constructor(W, H) { this.W = W; this.H = H; this.c = new Array(W * H).fill(null); }
  put(x, y, cell) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= this.W || y >= this.H) return; const i = y * this.W + x; const o = this.c[i]; if (!o || cell.z >= o.z) this.c[i] = cell; }
  get(x, y) { if (x < 0 || y < 0 || x >= this.W || y >= this.H) return null; return this.c[y * this.W + x]; }
}
const solid = s => s && s.solid !== false;

const GR = {};
function render(cv, name, { outline = true, dither = 0.6, scale = 6 } = {}) {
  const { W, H } = cv; const px = new Uint8Array(W * H * 4); const g = GR[name] = { W, H, cells: new Array(W * H).fill(null) };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = cv.get(x, y); if (!c) continue;
    let rgb; const a = c.a ?? 1;
    if (c.col) rgb = hex(c.col);
    else {
      const r = c.ramp; let idx;
      if (c.fixed != null) idx = c.fixed;
      else {
        const f = Math.max(0, Math.min(1, c.v)) * (r.length - 2) + 1;
        idx = Math.floor(f + (BAYER[y & 3][x & 3] - 0.5) * dither + 0.5);
        idx = Math.max(1, Math.min(r.length - 1, idx));
      }
      if (outline && solid(c) && !c.noOutline) {
        let edge = false, open = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = cv.get(x + dx, y + dy);
          if (!solid(n)) { edge = true; open = true; break; }
          if (n.part !== c.part && n.z > c.z + 1e-6) edge = true;
        }
        // lit open edges get a softer, coloured outline (selective outlining)
        if (edge) idx = open && c.v > 0.62 ? Math.min(idx, 1) : 0;
      }
      rgb = hex(r[idx]); g.cells[y * W + x] = { ramp: r, idx, a };
    }
    if (c.col) g.cells[y * W + x] = { col: c.col, a };
    const i = (y * W + x) * 4; px[i] = rgb[0]; px[i + 1] = rgb[1]; px[i + 2] = rgb[2]; px[i + 3] = Math.round(a * 255);
  }
  writePng(path.join(OUT, name + '.png'), W, H, px);
  if (PREV) {
    const S = scale, P = new Uint8Array(W * S * H * S * 4);
    for (let y = 0; y < H * S; y++) for (let x = 0; x < W * S; x++) {
      const si = (Math.floor(y / S) * W + Math.floor(x / S)) * 4, di = (y * W * S + x) * 4;
      const a = px[si + 3] / 255, bg = ((x >> 4) + (y >> 4)) & 1 ? [110, 56, 24] : [96, 48, 20];
      for (let k = 0; k < 3; k++) P[di + k] = Math.round(px[si + k] * a + bg[k] * (1 - a)); P[di + 3] = 255;
    }
    writePng(path.join(PREV, name + '.png'), W * S, H * S, P);
  }
}

// ---------- palettes (dark -> light; index 0 is the outline) ----------
const GLAZE = {
  forest: ['#0b1a10', '#133420', '#1f4a2c', '#2a5f37', '#3a7a46', '#5c9a5c', '#a8d490'],
  ember: ['#2a0f06', '#6e2c18', '#9a4422', '#b8562a', '#d9783e', '#eb9a58', '#f8d09a'],
  dusk: ['#140a1c', '#2f1a3e', '#432658', '#57336e', '#714a8a', '#9070aa', '#d0b0e0'],
  crt: ['#020e06', '#0a2616', '#103a22', '#17502e', '#1f6b3c', '#2fa050', '#7cf59a']
};
const GOLD = ['#3a1c08', '#7a4214', '#b0682a', '#d98a3a', '#e8a45c', '#f6d08a'];
const COFFEE = ['#100602', '#1e0d05', '#2e1608', '#4a240e', '#6b3512', '#a8703a'];
const LEAF = {
  forest: ['#0a1405', '#16280c', '#22400f', '#355a16', '#4f7a1c', '#76982a', '#b4bc3e'],
  sunlit: ['#121806', '#24380e', '#3a5a14', '#55801e', '#76a028', '#a8bc32', '#e6d85a'],
  crt: ['#020e06', '#0a2616', '#145a30', '#1f7a3e', '#2fa050', '#56e474', '#b0ffc0']
};
const POT = {
  terracotta: ['#2a0f06', '#5e2414', '#86381c', '#a84a24', '#c4602e', '#dc8044', '#f0aa6c'],
  forest: GLAZE.forest,
  cream: ['#3a2a18', '#6e5a40', '#968060', '#b8a07a', '#d2bc94', '#e8d6b0', '#fbf0d8']
};
const SOIL = ['#0a0402', '#1a0c05', '#2a1508', '#3e2010', '#583018', '#744226'];
const BOOK = {
  teal: ['#081618', '#142a2c', '#1f3e40', '#2d4f52', '#3f6a6c', '#5a8a88', '#8fbcb4'],
  green: ['#0a160c', '#18301a', '#244626', '#2f5a32', '#447a44', '#62985a', '#9ac48a'],
  moss: ['#101806', '#223a14', '#30521c', '#3f6a2e', '#56883c', '#76a650', '#a8cc80'],
  rust: ['#240c05', '#5a2412', '#86361e', '#a8482a', '#c8623a', '#e08a50', '#f6b880'],
  dusk: ['#140a1c', '#2a1838', '#3c2450', '#4a2a5e', '#644080', '#8462a0', '#b898d0'],
  forest: GLAZE.forest
};
const PAGES = ['#4a3a24', '#8a7452', '#b89c70', '#d8c096', '#ecdab4', '#f8eed6'];
const PAPER = {
  orange: ['#4a1c0a', '#9a4420', '#c4642c', '#e0803a', '#ec9a52', '#f6b874', '#fcdcaa'],
  amber: ['#4a3410', '#9a7224', '#c8962e', '#e0b448', '#ecc864', '#f6dc8a', '#fcf0c4'],
  green: ['#1a2c0c', '#3e6a1e', '#5a8a2e', '#74a640', '#8cba56', '#acd078', '#d4ecb0'],
  pink: ['#3a1428', '#7a3456', '#a44e78', '#c2688e', '#d484a6', '#e6a8c2', '#f6d4e2'],
  cream: ['#4a3a24', '#8a7452', '#bca27a', '#d8c096', '#e8d4ae', '#f4e6c8', '#fcf6e6'],
  crt: ['#000804', '#011e10', '#03281a', '#063220', '#0a3c26', '#104a30', '#1f6b3c']
};
const PIN = {
  green: ['#0a1405', '#1f3a14', '#2f5a20', '#4a7a3a', '#6f9a50', '#b8d890'],
  rust: POT.terracotta.slice(0, 6), gold: GOLD, teal: BOOK.teal.slice(0, 6), crt: ['#020e06', '#0a2616', '#1f6b3c', '#2fa050', '#5cf17e', '#c8ffd4']
};
const WALL = ['#2a1208', '#4a2410', '#582c14', '#663416', '#743c1a', '#84461e', '#9a5626'];
const WOOD = ['#1e0c04', '#4a220c', '#663014', '#7a3c18', '#8e4a1e', '#a85c26', '#c87a3a'];

function shadowEllipse(cv, cx, cy, rx, ry, a = 0.38) {
  for (let y = 0; y < cv.H; y++) for (let x = 0; x < cv.W; x++) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry, e = dx * dx + dy * dy;
    if (e <= 1) cv.put(x, y, { col: '#1c0f08', a: e > 0.6 ? a * 0.6 : a, z: -1, solid: false, part: 'sh' });
  }
}

// ---------- MUG ----------
function mug(glaze, emblem) {
  const W = 56, H = 64, cv = new Cv(W, H), g = GLAZE[glaze];
  const cx = 24, rx = 15, ry = 4, yt = 15, yb = 54;
  shadowEllipse(cv, cx + 4, yb + 2, 23, 4);
  // handle: a tube bent into an ellipse
  const hx = cx + rx + 1, hy = 34, R = 8, Ry = 10, tr = 2.7;
  for (let y = 0; y < H; y++) for (let x = cx; x < W; x++) {
    const ux = (x - hx) / R, uy = (y - hy) / Ry, d = Math.hypot(ux, uy);
    const t = (d - 1) * 9 / tr;
    if (Math.abs(t) <= 1 && x >= cx + rx - 2) {
      const n = norm([ux / d * t, uy / d * t, Math.sqrt(1 - t * t)]);
      cv.put(x, y, { ramp: g, v: light(n, { spec: 0.9, shin: 30 }) * 0.95, z: 0.5, part: 'handle' });
    }
  }
  // body: cylinder side
  for (let x = cx - rx; x <= cx + rx; x++) {
    const nx = (x - cx) / rx; if (Math.abs(nx) > 1) continue;
    const nz = Math.sqrt(1 - nx * nx), ybot = yb + ry * nz;
    for (let y = yt; y <= ybot; y++) {
      const fromBot = ybot - y;
      const ny = fromBot < 3 ? (3 - fromBot) * 0.25 : 0;
      const n = norm([nx, ny, nz]);
      let v = light(n, { spec: 1.1, shin: 34 });
      v *= 1 - 0.12 * ((y - yt) / (yb - yt));
      let ramp = g;
      if (emblem) {
        const u = Math.asin(nx) * rx, vv = y;
        const in1 = (u + 1) ** 2 + (vv - 35) ** 2 <= 36, in2 = (u - 2) ** 2 + (vv - 33) ** 2 <= 25;
        if (in1 && !in2) { ramp = GOLD; v = Math.min(1, v * 0.95 + 0.05); }
      }
      cv.put(x, y, { ramp, v, z: 1, part: 'body' });
    }
  }
  // top: rim lip, inner wall, coffee
  const irx = rx - 2, iry = ry - 1.2;
  for (let y = yt - ry - 1; y <= yt + ry + 1; y++) for (let x = cx - rx; x <= cx + rx; x++) {
    const ex = (x - cx) / rx, ey = (y - yt) / ry, e = ex * ex + ey * ey;
    if (e > 1) continue;
    const ix = (x - cx) / irx, iy = (y - yt) / iry, e2 = ix * ix + iy * iy;
    if (e2 > 1) {
      const v = 0.62 - 0.3 * ex - 0.15 * ey;
      cv.put(x, y, { ramp: GOLD, v, z: 2, part: 'rim' });
    } else {
      const wallLine = yt - iry * Math.sqrt(Math.max(0, 1 - ix * ix)) + 1.6;
      if (y < wallLine) cv.put(x, y, { ramp: g, v: 0.18 + 0.1 * -ix, z: 1.5, part: 'cof' });
      else {
        let v = 0.18 + 0.1 * (y - yt) / iry;
        if (((x - (cx - 5)) / 3.2) ** 2 + ((y - (yt + 0.5)) / 1.1) ** 2 <= 1) v = 0.85;
        if (e2 > 0.7) v += 0.18;
        cv.put(x, y, { ramp: COFFEE, v, z: 1.5, part: 'cof' });
      }
    }
  }
  render(cv, `mug-${glaze}${emblem ? '' : '-plain'}`);
}
function steam() {
  const W = 56, H = 64, cv = new Cv(W, H);
  [[17, 0.2, 13], [24, 2.1, 11], [30, 4.0, 12]].forEach(([bx, ph, top]) => {
    for (let y = 1; y <= top; y++) {
      const a = 0.12 + 0.5 * (y / top);
      const x = bx + 1.8 * Math.sin(y * 0.55 + ph);
      cv.put(x, y, { col: '#f6ead0', a, z: 0, solid: false });
      if (y > top * 0.5 && hash(bx, y, 3) > 0.35) cv.put(x + 1, y, { col: '#f6ead0', a: a * 0.6, z: 0, solid: false });
    }
  });
  render(cv, 'mug-steam', { outline: false });
}

// ---------- PLANT ----------
function leaf(cv, ramp, o) {
  const { b, t, w, bend = 0, droop = 0, z, part, dim = 1, varieg = false } = o;
  const ax = t[0] - b[0], ay = t[1] - b[1], len = Math.hypot(ax, ay);
  const dx = ax / len, dy = ay / len, px = -dy, py = dx;
  const tilt = norm([dx * 0.45, dy * 0.25 - 0.25, 0.85]);
  for (let tt = 0; tt <= 1; tt += 0.4 / len) {
    const hw = tt < 0.38 ? w * Math.pow(Math.sin((tt / 0.38) * Math.PI / 2), 0.5) : w * Math.pow(Math.cos(((tt - 0.38) / 0.62) * Math.PI / 2), 0.85);
    const off = bend * Math.sin(Math.PI * tt) * len;
    const cx = b[0] + ax * tt + px * off, cy = b[1] + ay * tt + py * off + droop * tt * tt * len;
    for (let s = -hw; s <= hw; s += 0.35) {
      const sn = s / (hw || 1), X = cx + px * s, Y = cy + py * s;
      const n = norm([tilt[0] + px * sn * 0.6, tilt[1] + py * sn * 0.6, tilt[2] - Math.abs(sn) * 0.15]);
      let v = light(n, { amb: 0.22, spec: 0.35, shin: 14 }) * dim;
      if (Math.abs(s) < 0.5 && tt > 0.04 && tt < 0.9) v *= 0.62;
      const vein = tt * 8 - Math.abs(sn) * 1.7;
      if (Math.abs(s) > 1.2 && Math.abs(vein - Math.round(vein)) < 0.08) v *= 0.8;
      if (varieg && vnoise(X, Y, 11, 3.2) > 0.68) v += 0.28;
      cv.put(X, Y, { ramp, v, z: z + 0.001 * tt, part });
    }
  }
}
function stem(cv, ramp, a, b, z, part) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  for (let t = 0; t <= 1; t += 0.3 / len) {
    const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
    cv.put(x, y, { ramp, v: 0.32, z, part });
  }
}
// `layers`: the pot and the leaves as two sprites (the site sways the leaves over a nudged pot)
function plant(fol, potName, face, layers = false) {
  const W = 72, H = 84, cv = new Cv(W, H), lr = LEAF[fol], pr = POT[potName];
  const cx = 36, yt = 52, rxRim = 18, ryT = 4.5, rimH = 6, yb = 78, rxTop = 16, rxBot = 12.5;
  shadowEllipse(cv, cx + 4, yb + 2.5, 24, 3.6);
  // pot body (tapered cylinder)
  const y0 = yt + rimH - 1;
  for (let y = y0; y <= yb + 3; y++) {
    const k = Math.min(1, (y - y0) / (yb - y0)), rx = rxTop + (rxBot - rxTop) * k;
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x - cx) / rx; if (Math.abs(nx) > 1) continue;
      if (y > yb && Math.abs(nx) > Math.sqrt(Math.max(0, 1 - ((y - yb) / 2.5) ** 2))) continue;
      const n = norm([nx, 0.12, Math.sqrt(1 - nx * nx)]);
      let v = light(n, { spec: potName === 'forest' ? 0.9 : 0.15, shin: 20 });
      if (y - y0 < 3) v *= 0.68;
      v += (hash(x, y, 5) - 0.5) * 0.08;
      cv.put(x, y, { ramp: pr, v, z: 1, part: 'pot' });
    }
  }
  // rim band
  for (let x = cx - rxRim; x <= cx + rxRim; x++) {
    const nx = (x - cx) / rxRim; if (Math.abs(nx) > 1) continue;
    const nz = Math.sqrt(1 - nx * nx);
    for (let y = yt; y <= yt + rimH + 1.5 * nz; y++) {
      let v = light(norm([nx, -0.05, nz]), { spec: potName === 'forest' ? 0.9 : 0.2, shin: 20 });
      v += (hash(x, y, 6) - 0.5) * 0.06;
      cv.put(x, y, { ramp: pr, v, z: 2, part: 'rim' });
    }
  }
  // rim top + soil
  for (let y = yt - ryT - 1; y <= yt + ryT + 1; y++) for (let x = cx - rxRim; x <= cx + rxRim; x++) {
    const ex = (x - cx) / rxRim, ey = (y - yt) / ryT; if (ex * ex + ey * ey > 1) continue;
    const ix = (x - cx) / (rxRim - 2.2), iy = (y - yt) / (ryT - 1.3);
    if (ix * ix + iy * iy > 1) cv.put(x, y, { ramp: pr, v: 0.78 - 0.25 * ex, z: 2.6, part: 'rim' });
    else cv.put(x, y, { ramp: SOIL, v: 0.22 + hash(x, y, 9) * 0.4 + (hash(x, y, 2) > 0.9 ? 0.3 : 0), z: 2.5, part: 'soil' });
  }
  // cat face decal
  if (face) {
    const fy = 66, set = (x, y, fixed) => { const c = cv.get(x, y); if (c) cv.c[y * W + x] = { ...c, fixed, noOutline: true }; };
    for (const ex of [cx - 6, cx + 5]) { set(ex - 1, fy, 0); set(ex, fy + 1, 0); set(ex + 1, fy + 1, 0); set(ex + 2, fy, 0); }
    set(cx - 1, fy + 3, 0); set(cx, fy + 3, 0); set(cx - 2, fy + 4, 0); set(cx + 1, fy + 4, 0);
    for (const [x, y] of [[cx - 9, fy + 3], [cx - 8, fy + 3], [cx + 8, fy + 3], [cx + 9, fy + 3]]) { const c = cv.get(x, y); if (c) cv.c[y * W + x] = { ...c, ramp: PAPER.pink, fixed: 4, noOutline: true }; }
  }
  // leaves, back to front
  const lv = layers ? new Cv(W, H) : cv;
  const spec = [
    [30, 22, -120, 18, 6.5, 3, 0.7], [42, 20, -60, 18, 6.5, 3, 0.7], [36, 14, -90, 16, 6, 3, 0.7],
    [22, 30, -150, 17, 6.5, 3, 0.7], [50, 28, -30, 17, 6.5, 3, 0.7],
    [28, 32, -110, 16, 6.5, 4, 0.82], [44, 31, -70, 16, 6.5, 4, 0.82], [18, 40, 175, 16, 6.5, 4, 0.82],
    [54, 38, 5, 16, 6.5, 4, 0.82], [36, 28, -95, 15, 6, 4, 0.82],
    [26, 44, -140, 15, 6, 5, 0.95], [46, 44, -40, 15, 6, 5, 0.95], [21, 51, 160, 16, 6, 5, 0.95],
    [51, 51, 20, 16, 6, 5, 0.95], [34, 42, -100, 13, 5.5, 5.2, 1], [39, 43, -75, 13, 5.5, 5.2, 1]
  ];
  spec.forEach(([bx, by, ang, len, w, z, dim], i) => {
    const a = ang * Math.PI / 180, t = [bx + Math.cos(a) * len, by + Math.sin(a) * len];
    const s0 = [cx + (bx - cx) * 0.12, yt - 1], c0 = [s0[0] + (bx - s0[0]) * 0.15, by + (yt - 1 - by) * 0.15];
    for (let k = 0; k <= 1; k += 0.02) {
      const x = (1 - k) ** 2 * s0[0] + 2 * (1 - k) * k * c0[0] + k * k * bx, y = (1 - k) ** 2 * s0[1] + 2 * (1 - k) * k * c0[1] + k * k * by;
      lv.put(x, y, { ramp: lr, v: 0.3 * dim + 0.05, z: z - 0.01, part: 'stem' + i });
    }
    leaf(lv, lr, { b: [bx, by], t, w, bend: (i % 2 ? 1 : -1) * 0.06, droop: by > 45 ? 0.1 : 0, z, dim, part: 'leaf' + i, varieg: fol === 'sunlit' });
  });
  const name = `plant-${fol}-${potName}${face ? '-cat' : ''}`;
  if (layers) { render(cv, name + '-pot'); render(lv, name + '-leaves'); }
  else render(cv, name);
}

// ---------- BOOKS ----------
function bookFlat(cv, ramp, { x0, y0, w, h, z, part }) {
  // top face (the cover, seen from slightly above)
  for (let k = 1; k <= 3; k++) {
    const y = y0 - k, sh = Math.round(k * 0.7);
    for (let x = x0 + sh; x < x0 + w + sh; x++) cv.put(x, y, { ramp, v: 0.72 + 0.06 * k + (hash(x, y, 4) - 0.5) * 0.08, z, part });
  }
  // end face: cover edges + page block
  for (let j = 0; j < 2; j++) {
    const x = x0 + w + j, lift = j + 1;
    for (let y = y0 - lift; y < y0 + h - lift + 1; y++) {
      const r = y - (y0 - lift);
      if (r === 0 || r >= h) cv.put(x, y, { ramp, v: 0.35, z, part });
      else cv.put(x, y, { ramp: PAGES, v: r % 2 ? 0.5 : 0.62, z, part });
    }
  }
  // spine
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const ny = ((y - y0) + 0.5) / h * 2 - 1;
    const n = norm([x - x0 < 2 ? -0.5 : 0, ny * 0.85, 1]);
    let v = light(n, { amb: 0.24, spec: 0.25, shin: 10 }) + (hash(x, y, 7) - 0.5) * 0.08;
    let r = ramp;
    if (x === x0 + 4 || x === x0 + 6 || x === x0 + w - 4) r = GOLD;
    cv.put(x, y, { ramp: r, v, z, part });
  }
}
function bookUp(cv, ramp, { x0, w, h, base, z, part }) {
  const y0 = base - h;
  for (let k = 1; k <= 3; k++) {
    const y = y0 - k, sh = Math.round(k * 0.7);
    for (let x = x0 + sh; x < x0 + w + sh; x++) cv.put(x, y, { ramp: PAGES, v: 0.65 + (x - x0 - sh === 0 || x === x0 + w + sh - 1 ? -0.3 : 0), z, part });
  }
  for (let j = 0; j < 2; j++) {
    const x = x0 + w + j, lift = j + 1;
    for (let y = y0 - lift; y < base - lift + 1; y++) cv.put(x, y, { ramp, v: 0.3, z, part });
  }
  for (let y = y0; y < base; y++) for (let x = x0; x < x0 + w; x++) {
    const nx = ((x - x0) + 0.5) / w * 2 - 1;
    const n = norm([nx * 0.85, 0, 1]);
    let v = light(n, { amb: 0.24, spec: 0.3, shin: 10 }) + (hash(x, y, 8) - 0.5) * 0.08;
    let r = ramp;
    const fromTop = y - y0, fromBot = base - 1 - y;
    if (fromTop === 4 || fromTop === 6 || fromBot === 4 || fromBot === 6) r = GOLD;
    cv.put(x, y, { ramp: r, v, z, part });
  }
}
function books() {
  let cv = new Cv(96, 52);
  for (let x = 1; x < 92; x++) for (let y = 49; y <= 50; y++) cv.put(x, y, { col: '#1c0f08', a: y === 49 ? 0.42 : 0.22, z: -1, solid: false });
  bookFlat(cv, BOOK.rust, { x0: 2, y0: 38, w: 82, h: 11, z: 1, part: 'b4' });
  bookFlat(cv, BOOK.moss, { x0: 10, y0: 28, w: 74, h: 10, z: 2, part: 'b3' });
  bookFlat(cv, BOOK.green, { x0: 5, y0: 19, w: 72, h: 9, z: 3, part: 'b2' });
  bookFlat(cv, BOOK.teal, { x0: 9, y0: 10, w: 66, h: 9, z: 4, part: 'b1' });
  render(cv, 'books-stack', { scale: 5 });
  cv = new Cv(64, 76);
  for (let x = 1; x < 62; x++) for (let y = 72; y <= 73; y++) cv.put(x, y, { col: '#1c0f08', a: y === 72 ? 0.42 : 0.22, z: -1, solid: false });
  [['dusk', 2, 11, 58], ['forest', 13, 12, 64], ['rust', 25, 10, 52], ['teal', 35, 11, 60], ['moss', 46, 9, 46]]
    .forEach(([c, x0, w, h], i) => bookUp(cv, BOOK[c], { x0, w, h, base: 72, z: i + 1, part: 'u' + i }));
  render(cv, 'books-shelf', { scale: 5 });
}

// ---------- STICKY NOTES ----------
function note(name, paper, pin) {
  const W = 52, H = 54, cv = new Cv(W, H), pr = PAPER[paper];
  const nx0 = 2, ny0 = 5, N = 44, x1 = nx0 + N - 1, y1 = ny0 + N - 1, c = 9, K = x1 + y1 - c;
  const inPaper = (x, y) => x >= nx0 && x <= x1 && y >= ny0 && y <= y1 && x + y <= K;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inPaper(x - 3, y - 3) && !inPaper(x, y)) cv.put(x, y, { col: '#1c0f08', a: 0.4, z: -1, solid: false });
  for (let y = ny0; y <= y1; y++) for (let x = nx0; x <= x1; x++) {
    if (!inPaper(x, y)) continue;
    const fy = (y - ny0) / N, fx = (x - nx0) / N;
    let v = 0.78 - 0.32 * fy - 0.1 * fx + (hash(x, y, 12) - 0.5) * 0.05;
    if (fy < 0.12) v -= 0.05;
    const flap = x >= K - y1 && y >= K - x1;
    if (flap) {
      const d = K - (x + y);
      v = 0.62 + 0.04 * d;
      cv.put(x, y, { ramp: pr, v, z: 2, part: 'flap' });
    } else {
      if (x + y > K - c - 3 && x + y <= K && !(x >= K - y1 && y >= K - x1)) v -= 0.12;
      cv.put(x, y, { ramp: pr, v, z: 1, part: 'paper' });
    }
  }
  // flap casts a shadow onto the paper just outside its fold edges
  for (let y = ny0; y <= y1; y++) for (let x = nx0; x <= x1; x++) {
    const cc = cv.get(x, y); if (!cc || cc.part !== 'paper') continue;
    if ((x === K - y1 - 1 && y >= K - x1) || (y === K - x1 - 1 && x >= K - y1)) cv.c[y * W + x] = { ...cc, v: cc.v - 0.25 };
  }
  // pushpin
  const pcx = nx0 + N / 2, pcy = ny0 + 1.5, r = 3.3, pp = PIN[pin];
  for (let y = 0; y < 12; y++) for (let x = pcx - 6; x <= pcx + 6; x++) {
    const sx = (x - (pcx + 1.5)) / r, sy = (y - (pcy + 2)) / (r * 0.7);
    if (sx * sx + sy * sy <= 1 && !(((x - pcx) / r) ** 2 + ((y - pcy) / r) ** 2 <= 1)) cv.put(x, y, { col: '#1c0f08', a: 0.35, z: 2.5, solid: false });
  }
  for (let y = 0; y < 12; y++) for (let x = pcx - 5; x <= pcx + 5; x++) {
    const dx = (x - pcx) / r, dy = (y - pcy) / r, e = dx * dx + dy * dy;
    if (e > 1) continue;
    cv.put(x, y, { ramp: pp, v: light(norm([dx, dy, Math.sqrt(1 - e)]), { spec: 1.2, shin: 30 }), z: 3, part: 'pin' });
  }
  render(cv, name, { scale: 5 });
}

// ---------- BACKDROPS ----------
function backdrop(name, W, H, deskRows) {
  const cv = new Cv(W, H), top = H - deskRows;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (y < top) {
      const d = Math.hypot((x - W * 0.18) / W, (y - H * 0.2) / H);
      const v = 0.78 - d * 0.62 + (vnoise(x, y, 21, 6) - 0.5) * 0.12;
      cv.put(x, y, { ramp: WALL, v, z: 0 });
    } else {
      const r = y - top;
      let v;
      if (r === 0) v = 0.98; else if (r === 1) v = 0.82; else if (r === 2) v = 0.3;
      else v = 0.5 + 0.12 * Math.sin(x * 0.18 + 3 * Math.sin(y * 0.55 + x * 0.02)) + (hash(x, y, 31) - 0.5) * 0.1 - 0.15 * (x / W);
      cv.put(x, y, { ramp: WOOD, v, z: 0 });
    }
  }
  render(cv, name, { outline: false, dither: 1, scale: 3 });
}

for (const gl of Object.keys(GLAZE)) { mug(gl, true); mug(gl, false); }
steam();
for (const f of Object.keys(LEAF)) for (const p of Object.keys(POT)) { plant(f, p, false); plant(f, p, true); }
plant('forest', 'terracotta', false, true); // the v2 site's plant, in two layers
books();
[['note-1', 'orange', 'green'], ['note-2', 'amber', 'rust'], ['note-3', 'green', 'gold'], ['note-4', 'pink', 'green'],
 ['note-5', 'cream', 'rust'], ['note-6', 'crt', 'crt'], ['note-7', 'orange', 'teal']].forEach(a => note(...a));
backdrop('bd-desk-560', 112, 112, 26);
backdrop('bd-desk-800', 160, 112, 24);
backdrop('bd-wall', 240, 140, 0);
console.log('done');
if (process.argv[4]) require('./pixel-props-emit.js')({ GR, GLAZE, LEAF, POT }, process.argv[4]);
