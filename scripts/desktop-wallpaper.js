// The desk computer's wallpaper: the LUNA_OS moon-and-mountains picture repainted as a dusk scene in colour, a
// crescent moon over snow-capped peaks and a pine forest, banded and dithered like the room. Writes
// public/cinema/wallpaper.png at the screen's own shape, one pixel a pixel. Run: node scripts/desktop-wallpaper.js
const path = require('path');
const sharp = require('sharp');

const W = 176, H = 108;
const px = Buffer.alloc(W * H * 3);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const set = (x, y, c) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  px.set(c, (y * W + x) * 3);
};
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dither = (x, y) => (BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16;

// the sky, banded from deep violet overhead to a warm glow on the horizon
const SKY = ['#1d1838', '#2a1f4d', '#3c2860', '#57336f', '#7a3f78', '#a34f78', '#cf6a72', '#ec9070', '#f7b77a'];
const sky = SKY.map(hex);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const v = Math.min(1, (y / (H * 0.6)) ** 1.4) * (sky.length - 1);
    set(x, y, sky[Math.min(sky.length - 1, Math.floor(v + dither(x, y) - 0.5 + 0.5))]);
  }

// stars, only up where the sky is dark
const STAR = hex('#fff4d8'), DIM = hex('#b9a7d8');
let s = 7;
const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
for (let i = 0; i < 46; i++) {
  const x = Math.floor(rand() * W), y = Math.floor(rand() * H * 0.42);
  if (Math.hypot(x - 118, y - 24) < 17) continue; // none in front of the moon or its halo
  set(x, y, rand() < 0.3 ? STAR : DIM);
}
for (const [x, y] of [[22, 10], [140, 18], [62, 26]]) {
  set(x, y, STAR); set(x - 1, y, DIM); set(x + 1, y, DIM); set(x, y - 1, DIM); set(x, y + 1, DIM);
}

// the crescent moon with a soft halo
const MX = 118, MY = 24, MR = 11;
const halo = hex('#6d4a86');
for (let y = MY - MR - 6; y <= MY + MR + 6; y++)
  for (let x = MX - MR - 6; x <= MX + MR + 6; x++) {
    const d = Math.hypot(x - MX, y - MY);
    if (d > MR && d < MR + 4 && Math.hypot(x - (MX + 5), y - (MY - 4)) > MR + 1 && dither(x, y) < (1 - (d - MR) / 4) * 0.45) set(x, y, halo);
  }
const MOON = ['#c7a86a', '#f1d68e', '#fff1c4'].map(hex);
for (let y = MY - MR; y <= MY + MR; y++)
  for (let x = MX - MR; x <= MX + MR; x++) {
    const d = Math.hypot(x - MX, y - MY);
    const bite = Math.hypot(x - (MX + 5), y - (MY - 4));
    if (d <= MR && bite > MR - 1) set(x, y, MOON[d > MR - 1.2 ? 0 : x - MX < -4 ? 2 : 1]);
  }

// a ridge line: peaks joined by straight slopes, with a little wobble
const ridge = (peaks, x) => {
  let y = H;
  for (const [px0, py, w] of peaks) y = Math.min(y, py + Math.abs(x - px0) * (H / w) * 0.5);
  return y + Math.sin(x * 0.9) * 0.6;
};
const range = (peaks, cols, snow) => {
  const [dark, mid, light] = cols.map(hex);
  for (let x = 0; x < W; x++) {
    const top = ridge(peaks, x);
    for (let y = Math.ceil(top); y < H; y++) {
      // the lit face is the left slope of each peak
      const near = peaks.reduce((a, p) => (Math.abs(x - p[0]) < Math.abs(x - a[0]) ? p : a));
      const lit = x < near[0];
      // snow only on the summits, not all along the ridge
      const capped = snow && y - top < 3 + Math.sin(x * 1.7) * 1.2 && top - near[1] < snow && Math.abs(x - near[0]) < 16;
      set(x, y, capped ? hex(lit ? '#fbe6e8' : '#c9b4cf') : lit ? (dither(x, y) < 0.35 ? mid : light) : y - top < 2 ? mid : dark);
    }
  }
};
range([[30, 46, 120], [92, 52, 110], [150, 44, 120]], ['#4a3466', '#6a4a80', '#83609a'], 0);
range([[56, 40, 90], [118, 50, 96], [176, 58, 90]], ['#2f2448', '#47345f', '#5f4777'], 9);
range([[8, 72, 80], [74, 70, 70], [130, 76, 80], [170, 70, 70]], ['#1f1a33', '#2c2444', '#3a2f55'], 0);

// the pine forest in front, darkest of all
const TREE = hex('#141026'), TREE_LIT = hex('#251d3d');
const pine = (cx, base, h) => {
  for (let y = 0; y < h; y++) {
    const w = Math.floor(((y % 5) + y * 0.55) / 2.2);
    for (let x = -w; x <= w; x++) set(cx + x, base - h + y, x < 0 && x === -w ? TREE_LIT : TREE);
  }
  set(cx, base, TREE); set(cx, base + 1, TREE);
};
for (let x = -2; x < W + 4; x += 5 + Math.floor(rand() * 4)) pine(x, H - 4 + Math.floor(rand() * 3), 10 + Math.floor(rand() * 11));
for (let y = H - 4; y < H; y++) for (let x = 0; x < W; x++) set(x, y, TREE);

sharp(px, { raw: { width: W, height: H, channels: 3 } })
  .png()
  .toFile(path.join(__dirname, '../public/cinema/wallpaper.png'))
  .then(() => console.log('wallpaper.png', W, H));
