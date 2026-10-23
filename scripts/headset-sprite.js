// The headset sprite for the room: traced from scripts/art/headset-reference.jpg (a pixel-art headset on a baked
// checkerboard) and cleaned up into the room's pixel size. Keys the checkerboard out where it joins the outside or the
// gap inside the band, shrinks it 60 px tall keeping thin stitching and seams, sets the leather in eight warm blacks
// from a softened brightness, despeckles, makes the near cup round on its right with a plain face plate, and outlines
// it in ink. Prints the rows that go in HEADSET in desk-room.js.
// Run: node scripts/headset-sprite.js
// polish the headset: shrink the cut-out to the room's pixel size, a fixed dark palette, despeckle, the logo, the outline
const sharp = require('sharp');
const path = require('path');
const PH = 60; // pixels tall, about the old headset's size
(async () => {
  // key the baked checkerboard: flood the light greys in from the edges and from the gap inside the band, so the band's
  // own highlights stay
  const { data: src, info: si } = await sharp(path.join(__dirname, 'art', 'headset-reference.jpg')).raw().toBuffer({ resolveWithObject: true });
  const SW = si.width, SH = si.height, bg = new Uint8Array(SW * SH);
  const light = (i) => { const r = src[i*3], g = src[i*3+1], b = src[i*3+2]; return Math.min(r,g,b) > 110 && Math.max(r,g,b) - Math.min(r,g,b) < 40; };
  const st = [390 + 400*SW]; for (let x = 0; x < SW; x++) st.push(x, (SH-1)*SW + x); for (let y = 0; y < SH; y++) st.push(y*SW, y*SW + SW-1);
  while (st.length) { const i = st.pop(); if (bg[i] || !light(i)) continue; bg[i] = 1; const x = i % SW;
    if (x) st.push(i-1); if (x < SW-1) st.push(i+1); if (i >= SW) st.push(i-SW); if (i < SW*(SH-1)) st.push(i+SW); }
  for (let k = 0; k < 2; k++) { const n = bg.slice(); for (let i = SW; i < SW*SH-SW; i++) if (!bg[i] && (bg[i-1]||bg[i+1]||bg[i-SW]||bg[i+SW])) n[i] = 1; bg.set(n); }
  let x0 = SW, y0 = SH, x1 = 0, y1 = 0;
  for (let i = 0; i < SW*SH; i++) if (!bg[i]) { const x = i % SW, y = (i/SW)|0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  // each pixel of the asset: the mean colour of its block of the picture, how much of it is solid, how much is the
  // tan stitching and how much the dark seams (thin lines a plain shrink would average away)
  // a pixel of margin all round so nothing at the edges is clipped
  const sf = (y1 - y0 + 1) / PH; x0 -= sf; y0 -= sf;
  const w = Math.ceil((x1 - x0 + 1) / sf) + 1, h = PH + 2, N = w * h;
  const s = Buffer.alloc(N * 4), cover = new Float32Array(N), tan = new Float32Array(N), seam = new Float32Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let n = 0, solid = 0, r = 0, g = 0, b = 0, t = 0, d = 0;
    for (let yy = Math.floor(y0 + y*sf); yy < Math.floor(y0 + (y+1)*sf); yy++) for (let xx = Math.floor(x0 + x*sf); xx < Math.floor(x0 + (x+1)*sf); xx++) {
      n++; const i = yy*SW + xx; if (xx < 0 || yy < 0 || xx >= SW || yy >= SH || bg[i]) continue;
      solid++; const R = src[i*3], G = src[i*3+1], B = src[i*3+2]; r += R; g += G; b += B;
      if (R - B > 22 && R > 85) t++;
      if (R + G + B < 36) d++;
    }
    const j = y*w + x; cover[j] = solid / n;
    if (solid) { s[j*4] = r/solid; s[j*4+1] = g/solid; s[j*4+2] = b/solid; s[j*4+3] = 255; tan[j] = t / solid; seam[j] = d / solid; }
  }
  const A = new Uint8Array(N); for (let i = 0; i < N; i++) A[i] = cover[i] > 0.5 ? 1 : 0;
  const at = (arr, x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : arr[y*w + x]);
  const n4 = (arr, x, y) => at(arr, x-1, y) + at(arr, x+1, y) + at(arr, x, y-1) + at(arr, x, y+1);
  // the silhouette: no lone pixels sticking out, no pin holes
  for (let k = 0; k < 2; k++) { const B = A.slice(); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const n = n4(A, x, y); if (A[y*w+x] && n <= 1) B[y*w+x] = 0; if (!A[y*w+x] && n >= 3) B[y*w+x] = 1; } A.set(B); }
  // the near cup, made truly round on its right: a circle through its bottom and its rightmost edge; below the band it
  // is cut to the circle, beside the band only filled out to it (so the band coming down into it stays)
  let ccx, ccy, R;
  {
    let yb = 0; for (let i = 0; i < N; i++) if (A[i]) yb = Math.max(yb, (i/w)|0);
    const row = []; for (let x = 0; x < w; x++) if (A[yb*w + x]) row.push(x);
    ccx = (row[0] + row[row.length - 1]) / 2;
    let xr = 0; for (let y = yb - 22; y <= yb; y++) for (let x = 0; x < w; x++) if (A[y*w + x]) xr = Math.max(xr, x);
    R = xr - ccx + 0.3; ccy = yb - R + 0.3;
    const inC = (x, y) => (x - ccx) ** 2 + (y - ccy) ** 2 <= R * R;
    for (let y = Math.floor(ccy - R * 0.75); y < h; y++) for (let x = Math.floor(ccx); x < w; x++) {
      const i = y*w + x, inside = inC(x, y);
      if (inside && !A[i]) { A[i] = 1; const k = i - 1; for (let c = 0; c < 4; c++) s[i*4 + c] = s[k*4 + c]; tan[i] = 0; seam[i] = 0; }
      else if (!inside && A[i] && y >= ccy - 4) A[i] = 0;
    }
  }
  // the palette: warm blacks by brightness, a tan for the stitching, greens for the logo
  const PAL = ['#0b0807', '#151110', '#1f1916', '#2b231e', '#3a2f28', '#4f4036', '#7a6250', '#a08068'].map((c) => [1, 3, 5].map((j) => parseInt(c.slice(j, j+2), 16)));
  const lum = (i) => 0.3*s[i*4] + 0.59*s[i*4+1] + 0.11*s[i*4+2];
  const ls = []; for (let i = 0; i < N; i++) if (A[i]) ls.push(lum(i)); ls.sort((a, b) => a - b);
  const q = (f) => ls[Math.floor(f * (ls.length - 1))];
  const cuts = [q(0.12), q(0.32), q(0.56), q(0.78), q(0.93)];
  // shading from a softened brightness, so it falls in clean bands
  const L0 = new Float32Array(N); for (let i = 0; i < N; i++) if (A[i]) L0[i] = lum(i);
  const Ls = new Float32Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y*w + x; if (!A[i]) continue; let t = 0, n = 0;
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const xx = x+a, yy = y+b; if (!at(A, xx, yy)) continue; const k = (a || b) ? ((a && b) ? 1 : 2) : 4; t += L0[yy*w+xx]*k; n += k; }
    Ls[i] = t / n; }
  // stitching and seams only where they join up into a line of three or more
  const lines = (mask) => { const keep = new Uint8Array(N), seen = new Uint8Array(N);
    for (let i = 0; i < N; i++) { if (!mask[i] || seen[i]) continue; const comp = [], st = [i]; seen[i] = 1;
      while (st.length) { const j = st.pop(); comp.push(j); const x = j % w, y = (j/w)|0;
        for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const xx = x+a, yy = y+b; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const k = yy*w+xx; if (mask[k] && !seen[k]) { seen[k] = 1; st.push(k); } } }
      if (comp.length >= 3) for (const j of comp) keep[j] = 1; }
    return keep; };
  const tanL = lines(Uint8Array.from(tan, (v, i) => A[i] && v > 0.2 ? 1 : 0));
  const seamL = lines(Uint8Array.from(seam, (v, i) => A[i] && v > 0.5 ? 1 : 0));
  const lsS = []; for (let i = 0; i < N; i++) if (A[i]) lsS.push(Ls[i]); lsS.sort((a, b) => a - b);
  const qs = (f) => lsS[Math.floor(f * (lsS.length - 1))], cutS = [qs(0.15), qs(0.4), qs(0.68), qs(0.9)];
  let cx = 0, cy = 0, cn = 0; for (let i = 0; i < N; i++) if (A[i] && s[i*4+1] > s[i*4] + 15 && s[i*4+1] > s[i*4+2] + 15) { cx += i % w; cy += (i/w)|0; cn++; }
  cx /= cn; cy /= cn;
  // the near cup's face plate (1 at its rim): set in from the cup's round edge, with a band of shell round it on the right
  const fcx = ccx + 3.4, fcy = ccy - 0.2, frx = R - 7.2, fry = R - 5.4;
  const face = (x, y) => Math.hypot((x - fcx) / frx, (y - fcy) / fry);
  const I = new Int8Array(N).fill(-1), green = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (!A[i]) continue;
    const r = s[i*4], g = s[i*4+1], b = s[i*4+2];
    if (g > r + 15 && g > b + 15) green[i] = 1; // where the logo was: plain face plate now
    const x = i % w, y = (i/w)|0, fr = face(x, y);
    if (fr < 1.12) {
      // the face plate: plain, a shade lighter toward the lamp; a stitched ring inside its rim, a dark seam round it
      const e = Math.abs(fr - 1.02) * frx, ring = Math.abs(fr - 0.8) * frx, ang = Math.atan2(y - fcy, x - fcx);
      I[i] = e < 0.6 ? 0 : ring < 0.5 && (ang < -0.7 || ang > 2.6) ? 5 // inside the ring it's plain, lit toward the lamp
        : fr < 0.72 ? ((x - fcx) + (y - fcy) < -3 ? 3 : 2) : Ls[i] > cutS[2] ? 3 : Ls[i] > cutS[0] ? 2 : 1;
      continue;
    }
    I[i] = seamL[i] ? 0 : tanL[i] ? 6 : 1 + cutS.filter((c) => Ls[i] > c).length;
  }
  // despeckle: a pixel unlike all four neighbours takes their commonest colour, twice over
  for (let k = 0; k < 2; k++) { const J = I.slice(); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y*w + x; if (I[i] < 0 || face(x, y) < 1.12) continue;
    const nb = [[-1,0],[1,0],[0,-1],[0,1]].map(([a, b]) => at(I, x+a, y+b)).filter((v, j) => { const [a, b] = [[-1,0],[1,0],[0,-1],[0,1]][j]; return at(A, x+a, y+b); });
    if (nb.length < 3 || nb.includes(I[i])) continue;
    const cnt = {}; for (const v of nb) cnt[v] = (cnt[v] || 0) + 1;
    const [best, c] = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    if (c >= 2 || Math.abs(best - I[i]) >= 2) J[i] = +best;
  } I.set(J); }
  const o = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) if (I[i] >= 0) { [o[i*4], o[i*4+1], o[i*4+2]] = PAL[I[i]]; o[i*4+3] = 255; }
  // the room's ink outline, a pixel wide, outside the silhouette (and round the gap inside the band)
  const PAD = 1, OW = w + 2*PAD, OH = h + 2*PAD, f = Buffer.alloc(OW*OH*4);
  for (let y = 0; y < h; y++) o.copy(f, ((y+PAD)*OW + PAD)*4, y*w*4, (y+1)*w*4);
  const solid = (x, y) => x >= 0 && y >= 0 && x < OW && y < OH && f[(y*OW+x)*4+3] === 255;
  const ink = []; for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) if (!solid(x, y) && (solid(x-1,y)||solid(x+1,y)||solid(x,y-1)||solid(x,y+1))) ink.push((y*OW+x)*4);
  for (const i of ink) { f[i] = 20; f[i+1] = 12; f[i+2] = 9; f[i+3] = 254; } // 254 marks ink, so it isn't taken as the body
  for (let i = 3; i < f.length; i += 4) if (f[i] === 254) f[i] = 255;
  // as rows for desk-room.js: '.' clear, 'o' ink, 0-7 the palette
  const rows = [];
  for (let y = 0; y < OH; y++) { let r = ''; for (let x = 0; x < OW; x++) { const i = (y*OW + x)*4;
    if (!f[i+3]) r += '.'; else if (f[i] === 20 && f[i+1] === 12 && f[i+2] === 9) r += 'o'; else r += PAL.findIndex((c) => c[0] === f[i] && c[1] === f[i+1] && c[2] === f[i+2]); }
    rows.push(r); }
  if (rows.some((r) => r.includes('-1'))) throw new Error('a pixel off the palette');
  console.log(rows.map((r) => `  '${r}',`).join('\n'));
})();
