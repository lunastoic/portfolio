// New plants (cactus, succulent, tulips, bonsai, monstera, cactus trio) and new book arrangements.
// Everything stands upright or lies flat; nothing tips.
module.exports = core => {
  const { Cv, render, light, norm, hash, vnoise, shadowEllipse, leaf, bookUp, bookFlat, spine, bookend, LEAF, POT, SOIL, BOOK, PAPER, GOLD, WOOD, IRON, CHROME, GLAZE } = core;

  const CACTUS = ['#08160a', '#123018', '#1c4622', '#28602c', '#3a7a36', '#5a9a46', '#9cc46a'];
  const SUCC = ['#0e1a18', '#1f3a36', '#2f5650', '#43746a', '#5e9484', '#86b6a0', '#c4e0c8'];
  const GLASS = ['#0e2422', '#24484a', '#3a6a68', '#5a8e8a', '#86b4ac', '#b8dcd2', '#eefaf4'];
  const BARK = ['#140a04', '#2e1a0c', '#46281a', '#5e3824', '#7a4c30', '#9a6844', '#b8865c'];
  const MAPLE_LEAF = ['#2a0806', '#5e1a0e', '#8a2a14', '#b4401c', '#d45e26', '#ec8a3a', '#f8c070'];
  const MOSS = ['#0c1606', '#1a2e0c', '#2a4614', '#3c601c', '#527c26', '#6e9a34', '#9cc050'];

  // ---------- shared bits ----------
  // a tapered pot with a rim band and soil, like the original plant's
  function pot(cv, pr, { cx, yt, yb, rxRim, rxTop, rxBot, rimH = 5, ryT = 3.5, spec = 0.2, z = 1 }) {
    const y0 = yt + rimH - 1;
    for (let y = y0; y <= yb + 2; y++) {
      const k = Math.min(1, (y - y0) / (yb - y0)), rx = rxTop + (rxBot - rxTop) * k;
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx; if (Math.abs(nx) > 1) continue;
        if (y > yb && Math.abs(nx) > Math.sqrt(Math.max(0, 1 - ((y - yb) / 2.2) ** 2))) continue;
        let v = light(norm([nx, 0.12, Math.sqrt(1 - nx * nx)]), { spec, shin: 20 });
        if (y - y0 < 2) v *= 0.7;
        v += (hash(x, y, 5) - 0.5) * 0.07;
        cv.put(x, y, { ramp: pr, v, z, part: 'pot' });
      }
    }
    for (let x = Math.floor(cx - rxRim); x <= Math.ceil(cx + rxRim); x++) {
      const nx = (x + 0.5 - cx) / rxRim; if (Math.abs(nx) > 1) continue;
      const nz = Math.sqrt(1 - nx * nx);
      for (let y = yt; y <= yt + rimH + 1.5 * nz; y++) {
        const v = light(norm([nx, -0.05, nz]), { spec: spec + 0.05, shin: 20 }) + (hash(x, y, 6) - 0.5) * 0.06;
        cv.put(x, y, { ramp: pr, v, z: z + 1, part: 'rim' });
      }
    }
    for (let y = Math.floor(yt - ryT - 1); y <= yt + ryT + 1; y++) for (let x = Math.floor(cx - rxRim); x <= Math.ceil(cx + rxRim); x++) {
      const ex = (x + 0.5 - cx) / rxRim, ey = (y - yt) / ryT; if (ex * ex + ey * ey > 1) continue;
      const ix = (x + 0.5 - cx) / (rxRim - 2), iy = (y - yt) / (ryT - 1.2);
      if (ix * ix + iy * iy > 1) cv.put(x, y, { ramp: pr, v: 0.78 - 0.25 * ex, z: z + 1.6, part: 'rim' });
      else cv.put(x, y, { ramp: SOIL, v: 0.22 + hash(x, y, 9) * 0.4 + (hash(x, y, 2) > 0.9 ? 0.3 : 0), z: z + 1.5, part: 'soil' });
    }
  }
  // an upright ribbed cactus column, rounded on top (and optionally at the bottom)
  function column(cv, ramp, { cx, yTop, yBot, r, z, part, ribs = 3, roundBot = false }) {
    for (let y = Math.floor(yTop - r); y <= Math.ceil(yBot + (roundBot ? r : 0)); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const nx = (x + 0.5 - cx) / r; if (Math.abs(nx) > 1) continue;
      let ny = 0;
      if (y + 0.5 < yTop) { ny = (y + 0.5 - yTop) / r; if (nx * nx + ny * ny > 1) continue; }
      else if (y + 0.5 > yBot) { if (!roundBot) continue; ny = (y + 0.5 - yBot) / r; if (nx * nx + ny * ny > 1) continue; }
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      let v = light(norm([nx, ny, nz + 0.1]), { amb: 0.24, spec: 0.35, shin: 16 });
      const ang = Math.asin(Math.max(-1, Math.min(1, nx)));
      if (Math.cos(ang * ribs * 2) < -0.6 && Math.abs(nx) < 0.92) v *= 0.68;
      if (hash(x, y, 91) > 0.93) v += 0.3;
      cv.put(x, y, { ramp, v, z, part });
    }
  }
  // a horizontal arm joining a column to its upright branch
  function arm(cv, ramp, { xa, xb, yc, r, z, part }) {
    for (let x = Math.min(xa, xb); x <= Math.max(xa, xb); x++) for (let y = Math.floor(yc - r); y <= Math.ceil(yc + r); y++) {
      const ny = (y + 0.5 - yc) / r; if (Math.abs(ny) > 1) continue;
      let v = light(norm([0, ny, Math.sqrt(1 - ny * ny) + 0.1]), { amb: 0.24, spec: 0.35, shin: 16 });
      if (Math.cos(Math.asin(ny) * 4) < -0.6 && Math.abs(ny) < 0.9) v *= 0.7;
      cv.put(x, y, { ramp, v, z, part });
    }
  }
  function flower(cv, ramp, cx, cy, z) {
    for (const [dx, dy] of [[-1, -1], [1, -1], [-2, 0], [2, 0], [-1, 1], [1, 1], [0, -2], [0, -1], [-1, 0], [1, 0], [0, 1]])
      cv.put(cx + dx, cy + dy, { ramp, v: 0.75 - 0.12 * dy - 0.05 * dx, z, part: 'flower' });
    cv.put(cx, cy, { ramp: GOLD, v: 0.9, z: z + 0.01, part: 'flower', noOutline: true });
  }

  // ---------- SAGUARO ----------
  function saguaro(potName, bloom) {
    const W = 56, H = 84, cv = new Cv(W, H), cx = 28;
    shadowEllipse(cv, cx + 4, 81, 19, 3);
    pot(cv, POT[potName], { cx, yt: 62, yb: 80, rxRim: 14, rxTop: 12.5, rxBot: 10 });
    arm(cv, CACTUS, { xa: cx, xb: 16, yc: 46, r: 3.5, z: 2.5, part: 'armL' });
    column(cv, CACTUS, { cx: 16, yTop: 30, yBot: 46, r: 3.5, z: 2.6, part: 'armL', roundBot: true });
    arm(cv, CACTUS, { xa: cx, xb: 40, yc: 52, r: 3.5, z: 2.5, part: 'armR' });
    column(cv, CACTUS, { cx: 40, yTop: 36, yBot: 52, r: 3.5, z: 2.6, part: 'armR', roundBot: true });
    column(cv, CACTUS, { cx, yTop: 16, yBot: 64, r: 6, z: 3, part: 'trunk' });
    flower(cv, bloom, cx, 9, 4);
    flower(cv, bloom, 16, 26, 4);
    render(cv, `plant2-saguaro-${potName}`, { scale: 5 });
  }

  // ---------- ECHEVERIA ----------
  function echeveria(name, ramp, bowl) {
    const W = 64, H = 58, cv = new Cv(W, H), cx = 32, cy = 38;
    shadowEllipse(cv, cx + 4, 54, 24, 3);
    pot(cv, bowl, { cx, yt: 40, yb: 52, rxRim: 23, rxTop: 22, rxBot: 15, rimH: 3, ryT: 4.5, spec: 0.5 });
    // rings from outside in: [length, width, count, lift, dim, z]
    [[19, 7, 8, 2, 0.8, 3], [14, 6.5, 7, 7, 0.92, 4], [9, 5, 5, 11, 1.02, 5], [4.5, 3.5, 3, 13, 1.1, 6]].forEach(([len, w, n, lift, dim, zr], k) => {
      for (let i = 0; i < n; i++) {
        const a = (i + (k % 2) * 0.5) / n * Math.PI * 2 - Math.PI / 2;
        const t = [cx + Math.cos(a) * len, cy + Math.sin(a) * len * 0.5 - lift];
        const b = [cx + Math.cos(a) * 1.2, cy - lift * 0.4];
        const z = zr + Math.sin(a) * 1.5;
        leaf(cv, ramp, { b, t, w, bend: 0, droop: 0, z, dim, part: `r${k}l${i}` });
        if (k < 3) cv.put(t[0], t[1], { ramp: PAPER.pink, v: 0.55, z: z + 0.02, part: `r${k}l${i}` });
      }
    });
    render(cv, `plant2-echeveria-${name}`, { scale: 5 });
  }

  // ---------- TULIPS IN A GLASS VASE ----------
  function tulipHead(cv, ramp, hx, top, z, part) {
    const hw = 3.6;
    for (let y = top - 1; y <= top + 10; y++) for (let x = Math.floor(hx - 5); x <= Math.ceil(hx + 5); x++) {
      const u = x + 0.5 - hx, v = y + 0.5 - top;
      const edge = 3 - 3 * Math.max(...[-2.3, 0, 2.3].map(p => Math.max(0, 1 - Math.abs(u - p) / 1.3)));
      if (v < edge) continue;
      if (Math.abs(u) > hw) continue;
      if (v > 4 && (u / hw) ** 2 + ((v - 4) / 5.5) ** 2 > 1) continue;
      let val = light(norm([u / hw, (v - 5) / 7, Math.sqrt(Math.max(0.1, 1 - (u / hw) ** 2))]), { amb: 0.25, spec: 0.5, shin: 18 });
      if (Math.abs(Math.abs(u) - 1.2) < 0.45 && v > 2) val *= 0.75;
      cv.put(x, y, { ramp, v: val, z, part });
    }
  }
  function tulips(name, heads) {
    const W = 56, H = 92, cv = new Cv(W, H), cx = 28, vTop = 54, vBot = 86, rx = 10.5, water = 62;
    shadowEllipse(cv, cx + 4, vBot + 2, 15, 2.6);
    const stems = [[21, 24], [28, 14], [35, 19]];
    // leaves standing straight up out of the vase
    leaf(cv, LEAF.forest, { b: [24, vTop + 2], t: [23, 33], w: 2.6, z: 1.2, part: 'lfL', dim: 0.9 });
    leaf(cv, LEAF.forest, { b: [32, vTop + 2], t: [33, 37], w: 2.6, z: 1.2, part: 'lfR', dim: 0.9 });
    stems.forEach(([x, top], i) => {
      for (let y = top + 8; y < vTop; y++) cv.put(x, y, { ramp: LEAF.forest, v: 0.45, z: 1.5, part: 's' + i });
      tulipHead(cv, heads[i], x, top, 2 + i * 0.1 + (i === 1 ? 0.3 : 0), 'h' + i);
    });
    // the vase: thick glass walls and base, see-through middle, water, stems inside
    for (let y = vTop; y <= vBot; y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx; if (Math.abs(nx) > 1) continue;
      if (y > vBot - 1 && Math.abs(nx) > 0.85) continue;
      const n = norm([nx, 0, Math.sqrt(1 - nx * nx)]);
      if (Math.abs(nx) > 0.8 || y >= vBot - 3) { cv.put(x, y, { ramp: GLASS, v: light(n, { amb: 0.35, spec: 1.2, shin: 30 }), z: 3, part: 'vase' }); continue; }
      const stem = stems.some(([sx]) => sx === x);
      if (stem && y >= water) cv.put(x, y, { ramp: LEAF.forest, v: 0.55, z: 3, part: 'vase', noOutline: true });
      else if (stem) cv.put(x, y, { ramp: LEAF.forest, v: 0.4, z: 3, part: 'vase', noOutline: true });
      else if (y === water) cv.put(x, y, { col: '#e6f6f0', a: 0.7, z: 3, part: 'vase' });
      else if (y > water) cv.put(x, y, { col: '#7cb4ac', a: 0.42, z: 3, part: 'vase' });
      else cv.put(x, y, { col: '#cfe8e2', a: 0.16, z: 3, part: 'vase' });
      if (x === Math.round(cx - rx * 0.55) && y > vTop + 3 && y < vBot - 6) cv.put(x, y, { col: '#ffffff', a: 0.6, z: 3.1, part: 'vase' });
    }
    // lip of the vase
    for (let y = vTop - 3; y <= vTop + 2; y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const ex = (x + 0.5 - cx) / rx, ey = (y - vTop) / 2.4, e = ex * ex + ey * ey;
      if (e > 1 || e < 0.5) continue;
      cv.put(x, y, { ramp: GLASS, v: 0.85 - 0.3 * ex, z: y < vTop ? 1.1 : 3.2, part: y < vTop ? 'lipB' : 'lipF' });
    }
    render(cv, `plant2-tulips-${name}`, { scale: 5 });
  }

  // ---------- BONSAI ----------
  function bonsai(name, foliage, potRamp) {
    const W = 84, H = 72, cv = new Cv(W, H), cx = 42;
    for (let x = 14; x < 74; x++) for (let y = 66; y <= 67; y++) cv.put(x, y, { col: '#1c0f08', a: y === 66 ? 0.4 : 0.2, z: -1, solid: false });
    // shallow rectangular tray with little feet
    for (let y = 52; y <= 65; y++) for (let x = 14; x <= 70; x++) {
      if (y >= 64 && !((x >= 18 && x <= 23) || (x >= 61 && x <= 66))) continue;
      if (y <= 54) {
        const inner = x > 16 && x < 68 && y >= 53;
        if (inner) cv.put(x, y, { ramp: MOSS, v: 0.35 + hash(x, y, 33) * 0.4, z: 1.5, part: 'moss' });
        else cv.put(x, y, { ramp: potRamp, v: 0.82, z: 1.6, part: 'tray' });
        continue;
      }
      const nx = x < 17 ? -0.6 : x > 67 ? 0.6 : 0;
      let v = light(norm([nx, y === 55 ? -0.6 : 0.1, 1]), { amb: 0.28, spec: 0.6, shin: 20 }) + (hash(x, y, 34) - 0.5) * 0.05;
      if (y === 63) v -= 0.2;
      cv.put(x, y, { ramp: potRamp, v, z: 1, part: 'tray' });
    }
    // trunk: straight up, flaring into roots, tapering to the crown
    for (let y = 22; y <= 55; y++) {
      const k = (y - 22) / 33, hw = 1.6 + 2.6 * k + (y > 50 ? (y - 50) * 1.1 : 0);
      for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
        const nx = (x + 0.5 - cx) / hw; if (Math.abs(nx) > 1) continue;
        let v = light(norm([nx, 0, Math.sqrt(1 - nx * nx)]), { amb: 0.25, spec: 0.2, shin: 10 });
        v += (vnoise(x * 3, y, 41, 2) - 0.5) * 0.25;
        cv.put(x, y, { ramp: BARK, v, z: 2, part: 'trunk' });
      }
    }
    // branches out to each pad
    const branch = (a, b, w) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let t = 0; t <= 1; t += 0.3 / len) for (let s = 0; s < w; s++)
        cv.put(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + s, { ramp: BARK, v: s ? 0.3 : 0.55, z: 2.1, part: 'br' });
    };
    branch([cx, 38], [24, 31], 2); branch([cx, 42], [60, 35], 2); branch([cx, 30], [cx - 8, 24], 2); branch([cx, 30], [cx + 8, 25], 2);
    // foliage pads: clumpy clouds, lit from the top left
    [[cx, 15, 15, 7.5, 4], [24, 29, 12, 6, 3.5], [60, 33, 12, 6, 3.5], [cx - 10, 22, 8, 5, 3.8], [cx + 10, 23, 8, 5, 3.8]].forEach(([px, py, rx, ry, z], i) => {
      for (let y = Math.floor(py - ry - 1); y <= py + ry + 1; y++) for (let x = Math.floor(px - rx - 1); x <= px + rx + 1; x++) {
        const dx = (x + 0.5 - px) / rx, dy = (y + 0.5 - py) / ry, e = dx * dx + dy * dy;
        const lump = (vnoise(x, y, 50 + i, 2.2) - 0.5) * 0.45;
        if (e > 1 + lump * 0.6) continue;
        const n = norm([dx, dy, Math.sqrt(Math.max(0, 1 - Math.min(1, e))) + 0.3]);
        let v = light(n, { amb: 0.22, spec: 0.2, shin: 10 }) + lump * 0.6;
        if (dy > 0.45) v *= 0.75;
        cv.put(x, y, { ramp: foliage, v, z, part: 'pad' + i });
      }
    });
    render(cv, `plant2-bonsai-${name}`, { scale: 5 });
  }

  // ---------- MONSTERA ----------
  function monsteraLeaf(cv, ramp, B, ang, R, z, part) {
    const a = ang * Math.PI / 180, d = [Math.cos(a), Math.sin(a)], p = [-d[1], d[0]];
    const C = [B[0] + d[0] * R, B[1] + d[1] * R];
    for (let y = Math.floor(C[1] - R - 2); y <= C[1] + R + 2; y++) for (let x = Math.floor(C[0] - R - 2); x <= C[0] + R + 2; x++) {
      const qx = x + 0.5 - C[0], qy = y + 0.5 - C[1];
      const al = qx * d[0] + qy * d[1], ac = qx * p[0] + qy * p[1];
      const r = Math.hypot(al / R, ac / (R * 0.88));
      if (r > 1) continue;
      // heart notch where the stem joins
      if (al < -R * 0.62 && Math.abs(ac) < (-R * 0.62 - al) * 1.1) continue;
      // splits running in from the edge toward the midrib, swept back toward the stem
      const across = Math.abs(ac) / (R * 0.88), s = (al + Math.abs(ac) * 0.7) / 4.6, frac = Math.abs(s - Math.round(s));
      if (across > 0.42 && frac < 0.11 && al > -R * 0.55 && al < R * 0.72) continue;
      // a small hole between each pair of splits
      if (across > 0.22 && across < 0.34 && Math.abs(s - Math.round(s) - 0.5) < 0.14 && al > -R * 0.4 && al < R * 0.5) continue;
      const side = ac > 0 ? 1 : -1;
      const n = norm([p[0] * side * 0.35 - d[0] * 0.1, p[1] * side * 0.35 - 0.25, 0.9]);
      let v = light(n, { amb: 0.22, spec: 0.45, shin: 16 });
      if (Math.abs(ac) < 0.6 && al > -R * 0.6) v *= 0.62;
      cv.put(x, y, { ramp, v, z, part });
    }
  }
  function monstera(potName) {
    const W = 88, H = 100, cv = new Cv(W, H), cx = 44, soilY = 73;
    shadowEllipse(cv, cx + 4, 97, 21, 3);
    pot(cv, POT[potName], { cx, yt: 74, yb: 96, rxRim: 15, rxTop: 14, rxBot: 12, spec: potName === 'forest' ? 0.9 : 0.2, z: 6 });
    // [angle, stem length, leaf radius, z]
    // [leaf angle, base x offset, base height above soil, leaf radius, z]; stems rise straight then curve out
    [[-150, -14, 26, 14, 1], [-30, 14, 26, 14, 1], [-112, -6, 42, 14, 2], [-68, 6, 42, 14, 2], [-90, 0, 30, 15, 3]].forEach(([ang, bx, bh, R, z], i) => {
      const a = ang * Math.PI / 180, B = [cx + bx, soilY - bh];
      for (let t = 0; t <= 1; t += 0.01) {
        const x = cx + bx * t * t, y = soilY - bh * t;
        cv.put(x, y, { ramp: LEAF.forest, v: 0.45, z: z - 0.5, part: 'st' + i });
        cv.put(x + 1, y, { ramp: LEAF.forest, v: 0.28, z: z - 0.5, part: 'st' + i });
      }
      monsteraLeaf(cv, LEAF.forest, B, ang, R, z, 'lf' + i);
    });
    render(cv, `plant2-monstera-${potName}`, { scale: 5 });
  }

  // ---------- CACTUS TRIO IN A PLANTER ----------
  function cactusTrio(name, box) {
    const W = 84, H = 66, cv = new Cv(W, H);
    for (let x = 8; x < 80; x++) for (let y = 61; y <= 62; y++) cv.put(x, y, { col: '#1c0f08', a: y === 61 ? 0.4 : 0.2, z: -1, solid: false });
    // barrel cactus, left, with a flower on top
    for (let y = 26; y <= 48; y++) for (let x = 13; x <= 35; x++) {
      const dx = (x + 0.5 - 24) / 10, dy = (y + 0.5 - 38) / 11, e = dx * dx + dy * dy; if (e > 1) continue;
      let v = light(norm([dx, dy, Math.sqrt(1 - e) + 0.1]), { amb: 0.24, spec: 0.35, shin: 16 });
      if (Math.cos(Math.asin(Math.max(-1, Math.min(1, dx))) * 8) < -0.55 && Math.abs(dx) < 0.92) v *= 0.68;
      if (hash(x, y, 92) > 0.92) v += 0.3;
      cv.put(x, y, { ramp: CACTUS, v, z: 2, part: 'barrel' });
    }
    flower(cv, PAPER.pink, 24, 27, 3);
    // tall column, middle
    column(cv, CACTUS, { cx: 42, yTop: 12, yBot: 48, r: 6, z: 2.2, part: 'col' });
    flower(cv, PAPER.amber, 42, 6, 3);
    // bunny-ear pads, right: one big pad, two ears straight up
    const pad = (px, py, rx, ry, z, part) => {
      for (let y = Math.floor(py - ry - 1); y <= py + ry + 1; y++) for (let x = Math.floor(px - rx - 1); x <= px + rx + 1; x++) {
        const dx = (x + 0.5 - px) / rx, dy = (y + 0.5 - py) / ry, e = dx * dx + dy * dy; if (e > 1) continue;
        let v = light(norm([dx * 0.7, dy * 0.7, Math.sqrt(1 - e) + 0.4]), { amb: 0.25, spec: 0.3, shin: 14 });
        const dot = ((x + (y >> 1) * 2) % 4 === 0) && (y % 3 === 0);
        cv.put(x, y, dot ? { ramp: PAPER.cream, v: 0.7, z: z + 0.01, part, noOutline: true } : { ramp: LEAF.sunlit, v, z, part });
      }
    };
    pad(60, 38, 8, 10, 2, 'padM');
    pad(55, 23, 4.5, 6, 1.9, 'padL');
    pad(66, 23, 4.5, 6, 1.9, 'padR');
    // wooden planter box in front
    for (let y = 44; y <= 60; y++) for (let x = 8; x <= 76; x++) {
      if (y <= 46) { cv.put(x, y, { ramp: box, v: y === 44 ? 0.85 : 0.7, z: 5, part: 'boxTop' }); continue; }
      const nx = x < 11 ? -0.6 : x > 73 ? 0.6 : 0;
      let v = light(norm([nx, 0.05, 1]), { amb: 0.28, spec: 0.2, shin: 10 }) + 0.05 * Math.sin(x * 0.5 + y * 0.2) + (hash(x, y, 93) - 0.5) * 0.06;
      if (y === 52 || y === 57) v -= 0.22;
      if ((x === 11 || x === 73) && y > 46) v -= 0.15;
      cv.put(x, y, { ramp: box, v, z: 5, part: 'box' });
    }
    for (let x = 10; x <= 74; x++) cv.put(x, 47, { ramp: SOIL, v: 0.3 + hash(x, 47, 94) * 0.3, z: 4.9, part: 'soil' });
    render(cv, `plant2-cactus-trio-${name}`, { scale: 5 });
  }

  saguaro('terracotta', PAPER.pink);
  saguaro('cream', PAPER.amber);
  echeveria('sage', SUCC, IRON);
  echeveria('plum', GLAZE.dusk, POT.cream);
  tulips('warm', [BOOK.rust, PAPER.amber, BOOK.rust]);
  tulips('pink', [PAPER.pink, PAPER.cream, PAPER.pink]);
  bonsai('pine', LEAF.forest, BOOK.teal);
  bonsai('maple', MAPLE_LEAF, POT.cream);
  monstera('cream');
  monstera('forest');
  cactusTrio('wood', WOOD);

  // ---------- BOOKS ----------
  // spine decorations beyond the core's label / stripe / dots / emblem
  function book(cv, [c, w, h, deco, accent], x0, base, z, part) {
    const ramp = BOOK[c];
    if (deco === 'bands' || deco === 'ribs' || deco === 'twotone' || deco === 'title' || deco === 'stars') bookUp(cv, ramp, { x0, w, h, base, z, part });
    else spine(cv, ramp, { x0, w, h, base, z, part, deco, accent });
    const y0 = base - h, mid = x0 + (w >> 1);
    const at = (x, y, cell) => cv.put(x, y, { ...cell, z: z + 0.01, part, noOutline: true });
    if (deco === 'ribs') {
      // raised leather bands across the spine
      for (const fy of [0.22, 0.38, 0.54, 0.7]) {
        const y = y0 + Math.round(h * fy);
        for (let x = x0; x < x0 + w; x++) { at(x, y, { ramp, v: 0.85 }); at(x, y + 1, { ramp, v: 0.25 }); }
      }
    } else if (deco === 'twotone') {
      for (let y = base - Math.round(h * 0.35); y < base - 2; y++) for (let x = x0; x < x0 + w; x++)
        at(x, y, { ramp: accent, v: light(norm([((x - x0) + 0.5) / w * 1.7 - 0.85, 0, 1]), { amb: 0.28, spec: 0.3, shin: 10 }) });
    } else if (deco === 'title') {
      // a vertical run of letter-like marks
      for (let y = y0 + 10, i = 0; y < base - 10; y += 3, i++) {
        at(mid, y, { ramp: PAPER.cream, v: 0.75 });
        if (hash(x0, i, 95) > 0.4) at(mid, y + 1, { ramp: PAPER.cream, v: 0.65 });
        if (w > 8 && hash(x0, i, 96) > 0.6) at(mid - 1, y, { ramp: PAPER.cream, v: 0.65 });
      }
    } else if (deco === 'stars') {
      for (let y = y0 + 10; y < base - 9; y += 5) at(mid + ((y >> 2) % 2 ? 1 : -1), y, { ramp: GOLD, v: 0.85 });
    }
  }
  function row(cv, books, x, base, z0 = 2) {
    books.forEach((b, i) => { book(cv, b, x, base, z0 + i, 'b' + z0 + i); x += b[1] + 1; });
    return x;
  }
  const floorShadow = (cv, x0, x1, y) => { for (let x = x0; x < x1; x++) for (let k = 0; k <= 1; k++) cv.put(x, y + k, { col: '#1c0f08', a: k ? 0.22 : 0.42, z: -1, solid: false }); };
  // iron L bookend seen from the front: a plate with a slot cut in it
  function ironEnd(cv, x0, h, base, z, part) {
    for (let y = base - h; y < base; y++) for (let x = x0; x < x0 + 4; x++) {
      if (x > x0 && x < x0 + 3 && y > base - h + 4 && y < base - h + 12) { cv.put(x, y, { ramp: IRON, fixed: 0, z, part }); continue; }
      let v = light(norm([((x - x0) + 0.5) / 4 * 1.6 - 0.8, y === base - h ? -0.8 : 0, 1]), { amb: 0.3, spec: 0.9, shin: 22 });
      cv.put(x, y, { ramp: IRON, v, z, part });
    }
  }

  // upright books with a flat stack lying inside the row
  {
    const cv = new Cv(110, 64), base = 59;
    floorShadow(cv, 2, 107, base);
    let x = row(cv, [['dusk', 9, 48, 'label'], ['forest', 10, 52, 'ribs'], ['rust', 8, 44, 'title']], 4, base);
    const flats = [['teal', 30, 7], ['moss', 28, 6], ['rust', 26, 7]];
    let y0 = base;
    flats.forEach(([c, w, h], i) => { y0 -= h; bookFlat(cv, BOOK[c], { x0: x + 1 + i, y0, w, h, z: 10 + i, part: 'f' + i }); });
    x += 34;
    row(cv, [['teal', 10, 50, 'stripe', PAPER.amber], ['moss', 8, 42, 'emblem'], ['green', 11, 47, 'twotone', BOOK.rust]], x, base, 20);
    render(cv, 'books2-mixed', { scale: 5 });
  }
  // a stepped row, tallest to shortest, held by an iron bookend
  {
    const cv = new Cv(96, 64), base = 59;
    floorShadow(cv, 2, 92, base);
    const x = row(cv, [['forest', 11, 54, 'ribs'], ['rust', 9, 50, 'label'], ['teal', 10, 46, 'title'], ['dusk', 8, 42, 'stars'],
      ['moss', 9, 38, 'emblem'], ['rust', 8, 34, 'twotone', PAPER.cream], ['green', 9, 30, 'dots']], 4, base);
    ironEnd(cv, x + 1, 24, base, 30, 'end');
    render(cv, 'books2-stepped', { scale: 5 });
  }
  // a flat stack with something sitting on top
  function stack(cv, base) {
    let y0 = base;
    [['rust', 56, 9, 6], ['forest', 52, 7, 9], ['dusk', 54, 8, 7], ['teal', 46, 7, 11]].forEach(([c, w, h, x0], i) => {
      y0 -= h; bookFlat(cv, BOOK[c], { x0, y0, w, h, z: 1 + i, part: 's' + i });
    });
    return y0;
  }
  {
    // twin-bell alarm clock
    const cv = new Cv(72, 82), base = 78;
    floorShadow(cv, 4, 66, base);
    const top = stack(cv, base), ccx = 34, ccy = top - 13, R = 9;
    for (const lx of [ccx - 6, ccx + 5]) for (let y = ccy + 7; y <= top - 2; y++) cv.put(lx, y, { ramp: CHROME, v: 0.5, z: 8, part: 'leg' });
    for (const s of [-1, 1]) {
      const bx = ccx + s * 6, by = ccy - 7;
      for (let y = by - 5; y <= by + 1; y++) for (let x = bx - 5; x <= bx + 5; x++) {
        const dx = (x + 0.5 - bx) / 5, dy = (y + 0.5 - by) / 5, e = dx * dx + dy * dy; if (e > 1 || dy > 0.25) continue;
        cv.put(x, y, { ramp: GOLD, v: light(norm([dx, dy, Math.sqrt(1 - e)]), { amb: 0.25, spec: 1, shin: 26 }) * 0.9, z: 8, part: 'bell' + s });
      }
    }
    for (let y = ccy - 12; y <= ccy - 9; y++) cv.put(ccx, y, { ramp: CHROME, v: 0.7, z: 8.5, part: 'hammer' });
    for (let x = ccx - 1; x <= ccx + 1; x++) cv.put(x, ccy - 13, { ramp: CHROME, v: 0.8, z: 8.5, part: 'hammer' });
    for (let y = ccy - R - 1; y <= ccy + R + 1; y++) for (let x = ccx - R - 1; x <= ccx + R + 1; x++) {
      const dx = x + 0.5 - ccx, dy = y + 0.5 - ccy, d = Math.hypot(dx, dy); if (d > R) continue;
      if (d > R - 2) cv.put(x, y, { ramp: BOOK.rust, v: light(norm([dx / R, dy / R, 0.6]), { amb: 0.3, spec: 1, shin: 24 }), z: 9, part: 'case' });
      else cv.put(x, y, { ramp: PAPER.cream, v: 0.78 - 0.15 * (dy / R) - 0.08 * (dx / R), z: 9.5, part: 'face' });
    }
    const mark = (x, y) => cv.put(x, y, { ramp: IRON, fixed: 1, z: 9.6, part: 'face', noOutline: true });
    mark(ccx, ccy - 6); mark(ccx, ccy + 5); mark(ccx - 6, ccy); mark(ccx + 5, ccy);
    // ten past ten
    for (const [x, y] of [[ccx - 1, ccy - 1], [ccx - 2, ccy - 2], [ccx - 3, ccy - 2], [ccx + 1, ccy - 1], [ccx + 2, ccy - 2], [ccx + 3, ccy - 3], [ccx + 3, ccy - 4], [ccx, ccy]]) mark(x, y);
    render(cv, 'books2-stack-clock', { scale: 5 });
  }
  {
    // a small succulent on top
    const cv = new Cv(72, 82), base = 78;
    floorShadow(cv, 4, 66, base);
    const top = stack(cv, base), pcx = 33;
    pot(cv, POT.terracotta, { cx: pcx, yt: top - 13, yb: top - 2, rxRim: 9, rxTop: 8, rxBot: 6.5, rimH: 3, ryT: 2.5, z: 8 });
    [[8, 3.5, 7, 1, 0.85, 11], [5, 3, 5, 3, 1, 12]].forEach(([len, w, n, lift, dim, zr], k) => {
      for (let i = 0; i < n; i++) {
        const a = (i + k * 0.5) / n * Math.PI * 2 - Math.PI / 2, cy = top - 15;
        leaf(cv, SUCC, { b: [pcx + Math.cos(a), cy - lift * 0.4], t: [pcx + Math.cos(a) * len, cy + Math.sin(a) * len * 0.5 - lift], w, z: zr + Math.sin(a), dim, part: `p${k}${i}` });
      }
    });
    render(cv, 'books2-stack-plant', { scale: 5 });
  }
  // a wooden crate full of books, front slats with gaps you can see the spines through
  {
    const cv = new Cv(88, 70), base = 64, ct = 36;
    floorShadow(cv, 6, 84, base);
    for (let y = ct - 4; y <= ct - 1; y++) for (let x = 10; x <= 78; x++) cv.put(x, y, { ramp: WOOD, v: y === ct - 4 ? 0.75 : 0.35, z: 0.5, part: 'back' });
    row(cv, [['rust', 8, 40, 'label'], ['teal', 9, 44, 'ribs'], ['dusk', 7, 36, 'title'], ['forest', 10, 46, 'stripe', PAPER.amber], ['moss', 8, 38, 'emblem'],
      ['rust', 9, 42, 'stars'], ['green', 7, 35, 'dots']], 11, base - 2);
    for (let y = ct; y < base; y++) for (let x = 7; x <= 81; x++) {
      const post = x <= 10 || x >= 78;
      const gap = !post && (y === ct + 9 || y === ct + 19);
      if (gap) continue;
      let v = light(norm([x <= 8 ? -0.6 : x >= 80 ? 0.6 : 0, (y === ct || y === ct + 10 || y === ct + 20) ? -0.5 : 0.05, 1]), { amb: 0.28, spec: 0.2, shin: 10 });
      v += 0.05 * Math.sin(x * 0.45 + y * 0.3) + (hash(x, y, 97) - 0.5) * 0.06 + (post ? -0.08 : 0);
      if (!post && y >= ct + 3 && y <= ct + 5 && x >= 38 && x <= 50) { cv.put(x, y, { ramp: WOOD, fixed: 0, z: 40, part: 'slat' }); continue; }
      cv.put(x, y, { ramp: WOOD, v, z: post ? 41 : 40, part: post ? 'post' : 'slat' });
    }
    render(cv, 'books2-crate', { scale: 5 });
  }
  // two chunky dictionaries between iron bookends
  {
    const cv = new Cv(64, 64), base = 59;
    floorShadow(cv, 2, 60, base);
    ironEnd(cv, 6, 30, base, 1, 'endL');
    const x = row(cv, [['rust', 17, 50, 'ribs'], ['forest', 15, 46, 'label']], 11, base);
    // gold title panels on the chunky spines
    for (const [x0, w, h] of [[11, 17, 50], [29, 15, 46]]) for (let y = base - h + 14; y < base - h + 20; y++) for (let xx = x0 + 3; xx < x0 + w - 3; xx++)
      cv.put(xx, y, { ramp: GOLD, v: (y === base - h + 14 || y === base - h + 19) ? 0.85 : 0.5, z: 10, part: 'panel', noOutline: true });
    ironEnd(cv, x + 1, 30, base, 20, 'endR');
    render(cv, 'books2-dictionaries', { scale: 5 });
  }
};
