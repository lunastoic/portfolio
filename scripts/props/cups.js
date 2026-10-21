// Cups and pencil cups: new shapes, all standing straight. Names start with cup- / pcup-.
module.exports = core => {
  const { Cv, render, light, norm, hash, shadowEllipse, GLAZE, GOLD, COFFEE, POT, PAPER, CHROME, IRON, WOOD, BOOK, pencil } = core;

  const ENAMEL = ['#2a2418', '#6e6450', '#a89c80', '#cfc4a6', '#e6dcc0', '#f4eedc', '#fffaf0'];
  const NAVY = ['#04060e', '#0c1426', '#16223c', '#203252', '#2e4670', '#4a6a96', '#8aa8c8'];
  const KRAFT = ['#2a1406', '#5a3414', '#7e4c22', '#9a6232', '#b47c46', '#cc9a62', '#e6c48e'];
  const LIDW = ['#3a3630', '#77706a', '#a8a29a', '#cac4bc', '#e0dcd4', '#f0ece6', '#fffdf8'];
  const MILK = ['#3a2210', '#6e4422', '#9a6638', '#b8844e', '#cfa26c', '#e2c290', '#f4e2c0'];
  const FOAM = ['#6a5a48', '#a89680', '#d0c0a8', '#e4d8c4', '#f2eadc', '#faf6ee', '#ffffff'];
  const CREMA = ['#1e0d05', '#4a240e', '#7a4418', '#a0622a', '#c08440', '#dca460', '#f0c888'];
  const GLASS = ['#1a2a2a', '#3e5a58', '#6a8a86', '#94b4ae', '#bcd8d0', '#dcf0ea', '#f8fffc'];
  const CRT = GLAZE.crt;
  const NEON = { yellow: ['#3a3404', '#8a7c0a', '#c4b014', '#e4d030', '#f2e454', '#fcf28a', '#fffcd0'], pink: PAPER.pink, green: ['#0a2a08', '#1e6a14', '#30962a', '#46b840', '#66d058', '#98e888', '#d4ffc8'] };

  // side of a lathe-turned body; rx(y) is the radius at row y, `paint` may recolour a pixel
  function body(cv, { cx, yt, yb, rx, ry, z = 1, part = 'body', paint, ramp, spec = 0.9, shin = 30, amb = 0.2 }) {
    for (let y = yt; y <= yb + ry + 1; y++) {
      const yy = Math.min(y, yb), r = rx(yy);
      const dr = (rx(Math.min(yy + 1, yb)) - rx(Math.max(yy - 1, yt))) / 2;
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const nx = (x + 0.5 - cx) / r; if (Math.abs(nx) > 1) continue;
        const nz = Math.sqrt(1 - nx * nx), ybot = yb + ry * nz;
        if (y > ybot) continue;
        const fromBot = ybot - y, ny = (fromBot < 2.5 ? (2.5 - fromBot) * 0.3 : 0) + dr * 0.9;
        const n = norm([nx, ny, nz]);
        const v = light(n, { amb, spec, shin });
        const u = Math.asin(nx) * r;
        const cell = paint ? paint({ x, y, u, nx, nz, v, n, fromBot, fromTop: y - yt }) : { ramp, v };
        if (!cell) continue;
        cv.put(x, y, { z, part, ...cell });
      }
    }
  }
  // elliptical opening at row yt: `fn` returns the cell for each pixel (ex,ey in the outer ellipse, ix,iy in the inner)
  function opening(cv, { cx, yt, rx, ry, lip, fn }) {
    const irx = rx - lip, iry = ry - lip * 0.6;
    for (let y = Math.floor(yt - ry - 1); y <= Math.ceil(yt + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const ex = (x + 0.5 - cx) / rx, ey = (y + 0.5 - yt) / ry; if (ex * ex + ey * ey > 1) continue;
      const ix = (x + 0.5 - cx) / irx, iy = (y + 0.5 - yt) / iry, inner = ix * ix + iy * iy <= 1;
      const c = fn({ x, y, ex, ey, ix, iy, inner, irx, iry }); if (c) cv.put(x, y, c);
    }
    return { irx, iry };
  }
  function handle(cv, { hx, hy, R, Ry, tr, ramp, xmin, z = 0.5, spec = 0.9 }) {
    for (let y = Math.floor(hy - Ry - tr - 2); y <= hy + Ry + tr + 2; y++) for (let x = xmin; x <= hx + R + tr + 2; x++) {
      const ux = (x + 0.5 - hx) / R, uy = (y + 0.5 - hy) / Ry, d = Math.hypot(ux, uy);
      const t = (d - 1) * Math.min(R, Ry) / tr;
      if (Math.abs(t) > 1) continue;
      const n = norm([ux / d * t, uy / d * t, Math.sqrt(1 - t * t)]);
      cv.put(x, y, { ramp, v: light(n, { spec, shin: 30 }) * 0.95, z, part: 'handle' });
    }
  }
  // coffee surface inside an opening: dark at the back wall, a little crema ring and a glint
  const coffee = (cx, yt, glint = true) => ({ x, y, ix, iy }) => {
    let v = 0.2 + 0.12 * iy;
    if (ix * ix + iy * iy > 0.72) v += 0.18;
    if (glint && ((x + 0.5 - (cx - 5)) / 3) ** 2 + ((y + 0.5 - (yt + 0.3)) / 1) ** 2 <= 1) v = 0.85;
    return { ramp: COFFEE, v, z: 1.5, part: 'cof' };
  };
  const wisps = (cv, cx, top, base) => [[-5, 0.4, 10], [1, 2.3, 13], [6, 4.1, 9]].forEach(([dx, ph, h]) => {
    for (let y = base - h; y <= base; y++) {
      const k = (base - y) / h, x = cx + dx + 1.3 * Math.sin(y * 0.6 + ph);
      if (y < top) continue;
      cv.put(x, y, { col: '#f6ead0', a: 0.55 * (1 - k) + 0.1, z: 0, solid: false });
    }
  });

  // ---------- 1. enamel camp mug ----------
  function enamel(name, base, rim) {
    const W = 56, H = 60, cv = new Cv(W, H), cx = 24, rx = 15, ry = 4, yt = 16, yb = 50;
    shadowEllipse(cv, cx + 4, yb + 3, 23, 3.6);
    handle(cv, { hx: cx + rx + 1, hy: 32, R: 8, Ry: 9, tr: 1.8, ramp: rim, xmin: cx + rx - 2 });
    body(cv, { cx, yt, yb, rx: () => rx, ry, spec: 1.3, shin: 40, paint: ({ x, y, v, fromBot, fromTop }) => {
      if (fromTop < 2 || fromBot < 1.6) return { ramp: rim, v };
      if (hash(x, y, 101) > 0.93) return { ramp: base === ENAMEL ? NAVY : ENAMEL, v: base === ENAMEL ? 0.35 : 0.7, noOutline: true };
      return { ramp: base, v };
    } });
    opening(cv, { cx, yt, rx, ry, lip: 1.4, fn: ({ x, y, ex, ey, ix, iy, inner, iry }) => {
      if (!inner) return { ramp: rim, v: 0.7 - 0.3 * ex - 0.15 * ey, z: 2, part: 'rim' };
      const wallLine = yt - iry * Math.sqrt(Math.max(0, 1 - ix * ix)) + 2.2;
      if (y + 0.5 < wallLine) return { ramp: ENAMEL, v: 0.55 - 0.15 * ix, z: 1.6, part: 'in' };
      return coffee(cx, yt + 1)({ x, y, ix, iy });
    } });
    wisps(cv, cx, 0, yt - 4);
    render(cv, name, { scale: 5 });
  }

  // ---------- 2. travel tumbler ----------
  function tumbler(name, grip) {
    const W = 40, H = 76, cv = new Cv(W, H), cx = 19.5, ry = 3, yt = 20, yb = 68;
    const rx = y => 11.5 - 2 * (y - yt) / (yb - yt);
    shadowEllipse(cv, cx + 3, yb + 3, 16, 3);
    body(cv, { cx, yt, yb, rx, ry, spec: 1.2, shin: 36, paint: ({ x, y, v, u, fromTop, fromBot }) => {
      if (y >= 38 && y <= 52) {
        // silicone grip band with vertical ribs
        const rib = Math.round(u + 20) % 3 === 0 ? -0.12 : 0.02;
        return { ramp: grip, v: v * 0.9 + rib, part: 'grip' };
      }
      return { ramp: CHROME, v: v * 0.82 + (hash(x, 0, 102) - 0.5) * 0.1 - (fromBot < 2 ? 0.1 : 0) };
    } });
    // lid: a band a touch wider than the cup, a flat top, a sip slot and its slider
    body(cv, { cx, yt: 13, yb: 20, rx: () => 12.2, ry: 3, z: 2, part: 'lidband', spec: 0.6, paint: ({ v, fromTop }) => ({ ramp: IRON, v: v + (fromTop === 0 ? 0.1 : 0) }) });
    opening(cv, { cx, yt: 13, rx: 12.2, ry: 3, lip: 1.2, fn: ({ x, y, ex, ey, inner }) => {
      if (!inner) return { ramp: IRON, v: 0.75 - 0.3 * ex - 0.1 * ey, z: 3, part: 'lid' };
      const slot = y === 14 && x >= cx - 4 && x <= cx + 1;
      const slider = (y === 12 || y === 13) && x >= cx + 3 && x <= cx + 6;
      if (slot) return { ramp: IRON, fixed: 0, z: 3.1, part: 'lid', noOutline: true };
      if (slider) return { ramp: grip, v: 0.7, z: 3.2, part: 'slider' };
      return { ramp: IRON, v: 0.42 - 0.1 * ex, z: 3, part: 'lid' };
    } });
    // a small moon on the grip band
    for (let y = 42; y <= 48; y++) for (let x = Math.floor(cx - 4); x <= cx + 3; x++) {
      const m = Math.hypot(x + 0.5 - cx, y + 0.5 - 45) <= 3.2 && Math.hypot(x + 0.5 - cx - 1.5, y + 0.5 - 44) > 2.6;
      if (m) cv.put(x, y, { ramp: PAPER.cream, v: 0.75, z: 1.2, part: 'grip', noOutline: true });
    }
    render(cv, name, { scale: 5 });
  }

  // ---------- 3. takeaway cup ----------
  function takeaway(name, sleeve) {
    const W = 50, H = 72, cv = new Cv(W, H), cx = 24.5, ry = 3.6, yt = 19, yb = 66;
    const rx = y => 15 - 4 * (y - yt) / (yb - yt);
    shadowEllipse(cv, cx + 3, yb + 3, 18, 3);
    body(cv, { cx, yt, yb, rx, ry, spec: 0.4, shin: 16, amb: 0.26, paint: ({ x, y, v, u }) => {
      if (y >= 33 && y <= 51) {
        let vv = v * 0.95 + (y % 2 ? -0.06 : 0.03);
        // stamped moon in a ring
        const d = Math.hypot(u, y + 0.5 - 42);
        if (Math.abs(d - 5.3) < 0.6) return { ramp: sleeve, fixed: 1, part: 'sleeve', noOutline: true };
        if (d <= 3.5 && Math.hypot(u - 1.6, y + 0.5 - 41) > 2.8) return { ramp: sleeve, fixed: 1, part: 'sleeve', noOutline: true };
        return { ramp: sleeve, v: vv, part: 'sleeve' };
      }
      return { ramp: PAPER.cream, v: v + 0.05 };
    } });
    // lid: wide snap rim, raised dome, sip hole at the front
    body(cv, { cx, yt: 16, yb: 19, rx: () => 16.4, ry: 3.8, z: 2, part: 'lidrim', spec: 0.9, paint: ({ v }) => ({ ramp: LIDW, v }) });
    body(cv, { cx, yt: 11, yb: 16, rx: y => 13.5 - 0.3 * (16 - y), ry: 3.4, z: 3, part: 'dome', spec: 0.9, paint: ({ v }) => ({ ramp: LIDW, v: v + 0.05 }) });
    opening(cv, { cx, yt: 11, rx: 12, ry: 3, lip: 1, fn: ({ x, y, ex, ey, inner }) => {
      if (Math.abs(x + 0.5 - cx) <= 2.5 && y === 13) return { ramp: IRON, fixed: 1, z: 4.1, part: 'dome', noOutline: true };
      return { ramp: LIDW, v: inner ? 0.62 - 0.12 * ex : 0.8 - 0.2 * ex, z: 4, part: 'dome' };
    } });
    wisps(cv, cx - 1, 0, 9);
    render(cv, name, { scale: 5 });
  }

  // ---------- 4. espresso on a saucer ----------
  function espresso(name, glaze) {
    const W = 64, H = 48, cv = new Cv(W, H), scx = 31.5, scy = 37;
    shadowEllipse(cv, scx + 3, scy + 4, 30, 5);
    // saucer: a thin plate with a lip and a shallow well
    for (let y = scy - 8; y <= scy + 9; y++) for (let x = 0; x < W; x++) {
      const ex = (x + 0.5 - scx) / 28, ey = (y + 0.5 - scy) / 7, e = ex * ex + ey * ey;
      const eu = (y + 0.5 - scy - 2) / 7, under = ex * ex + eu * eu <= 1 && y > scy;
      if (e <= 1) {
        let v = 0.72 - 0.25 * ex - 0.1 * ey;
        if (e > 0.78) v += 0.12;
        const w = ex * ex * (28 / 13) ** 2 + ey * ey * (7 / 3.4) ** 2;
        if (w <= 1) v -= 0.18;
        else if (w <= 1.25) v -= 0.08;
        cv.put(x, y, { ramp: glaze, v, z: 1, part: 'saucer' });
      } else if (under) cv.put(x, y, { ramp: glaze, v: 0.3 - 0.1 * ex, z: 0.9, part: 'saucerU' });
    }
    // cup: a small tulip, narrower at the foot
    const cx = 30, yt = 22, yb = 34, ry = 3;
    handle(cv, { hx: cx + 11, hy: 27, R: 4, Ry: 3.6, tr: 1.4, ramp: glaze, xmin: cx + 8, z: 1.4 });
    body(cv, { cx, yt, yb, rx: y => 11 - 3.5 * ((y - yt) / (yb - yt)) ** 1.6, ry, z: 1.5, spec: 1.1, paint: ({ v, fromTop }) => fromTop < 1 ? { ramp: GOLD, v } : { ramp: glaze, v } });
    opening(cv, { cx, yt, rx: 11, ry, lip: 1.1, fn: ({ x, y, ex, ey, ix, iy, inner }) => {
      if (!inner) return { ramp: GOLD, v: 0.65 - 0.3 * ex - 0.1 * ey, z: 2.5, part: 'rim' };
      // crema with a darker swirl
      let v = 0.55 + 0.12 * iy;
      const sw = Math.hypot(ix * 1.3 + 0.1, iy - 0.05);
      if (Math.abs(sw - 0.45) < 0.12) v -= 0.22;
      if (ix * ix + iy * iy > 0.75) v -= 0.12;
      return { ramp: CREMA, v, z: 2.4, part: 'cof' };
    } });
    wisps(cv, cx, 0, 18);
    render(cv, name, { scale: 5 });
  }

  // ---------- 5. glass latte mug ----------
  function latte(name) {
    const W = 52, H = 66, cv = new Cv(W, H), cx = 22, rx = 14, ry = 4, yt = 13, yb = 58;
    shadowEllipse(cv, cx + 4, yb + 3, 21, 3.4);
    handle(cv, { hx: cx + rx + 1, hy: 34, R: 7, Ry: 11, tr: 2, ramp: GLASS, xmin: cx + rx - 1, spec: 1.4 });
    const foamTop = yt + 2, milkTop = yt + 9, shotTop = yt + 30, baseTop = yb - 3;
    body(cv, { cx, yt, yb, rx: () => rx, ry, spec: 0, paint: ({ x, y, nx, n, fromBot }) => {
      const edge = Math.abs(nx) > 0.86, hl = Math.abs(nx + 0.55) < 0.07 && y > yt + 2 && fromBot > 3;
      const lv = light(n, { amb: 0.4, spec: 0.3, shin: 10 });
      if (edge) return { ramp: GLASS, v: 0.55 + 0.2 * -nx };
      if (hl) return { ramp: GLASS, v: 0.98, noOutline: true };
      if (y < foamTop || y >= baseTop) return { col: '#dcf0ea', a: y >= baseTop ? 0.55 : 0.3, solid: false };
      if (y < milkTop) return { ramp: FOAM, v: lv * 0.9 + 0.12 };
      if (y < shotTop) {
        // milk shading from pale under the foam to caramel where it meets the shot
        const k = (y - milkTop) / (shotTop - milkTop);
        return { ramp: MILK, v: lv * 0.5 + 0.55 - 0.3 * k };
      }
      return { ramp: CREMA, v: lv * 0.4 + 0.08 + (y === shotTop ? 0.25 : 0) };
    } });
    opening(cv, { cx, yt, rx, ry, lip: 1, fn: ({ x, y, ex, ey, ix, iy, inner }) => {
      if (!inner) return { ramp: GLASS, v: 0.85 - 0.2 * ex, z: 2, part: 'rim' };
      // foam surface sits a little below the rim, with a latte-art heart
      const hx = ix * 1.6, hy = (iy + 0.1) * 1.8;
      const heart = (hx * hx + (hy - Math.sqrt(Math.abs(hx)) * 0.9) ** 2) <= 0.55;
      if (heart) return { ramp: MILK, v: 0.62 + 0.08 * iy, z: 1.6, part: 'foam', noOutline: true };
      return { ramp: FOAM, v: 0.72 + 0.12 * iy + (hash(x, y, 103) > 0.9 ? -0.15 : 0), z: 1.6, part: 'foam' };
    } });
    wisps(cv, cx, 0, yt - 4);
    render(cv, name, { scale: 5 });
  }

  // ---------- 6. cat-ear mug ----------
  function catMug(name, glaze, face, innerRamp) {
    const W = 56, H = 62, cv = new Cv(W, H), cx = 24, rx = 15, ry = 4, yt = 18, yb = 52;
    shadowEllipse(cv, cx + 4, yb + 3, 23, 3.6);
    // ears stand up from the back of the rim
    for (const s of [-1, 1]) {
      const ex0 = cx + s * 9;
      for (let y = yt - 12; y <= yt; y++) for (let x = ex0 - 6; x <= ex0 + 6; x++) {
        const h = yt - y, hw = 5.5 - h * 0.48, off = x + 0.5 - ex0 + s * h * 0.12;
        if (hw <= 0 || Math.abs(off) > hw) continue;
        const pink = Math.abs(off) < hw - 2 && h > 2 && h < 9;
        cv.put(x, y, pink ? { ramp: PAPER.pink, v: 0.55 + 0.03 * h, z: 0.7, part: 'ear' + s }
          : { ramp: glaze, v: light(norm([off / 6, -0.4, 0.8]), { spec: 0.8, shin: 24 }), z: 0.6, part: 'ear' + s });
      }
    }
    handle(cv, { hx: cx + rx + 1, hy: 35, R: 8, Ry: 10, tr: 2.6, ramp: glaze, xmin: cx + rx - 2 });
    body(cv, { cx, yt, yb, rx: () => rx, ry, spec: 1.1, shin: 34, paint: ({ y, u, v }) => {
      const fy = y + 0.5 - 37;
      const eye = Math.abs(Math.abs(u) - 5) < 1.6 && Math.abs(fy + 1.2 - 0.25 * (Math.abs(u) - 5) ** 2) < 0.6;
      if (eye) return { ramp: face, fixed: 1, noOutline: true };
      if (Math.abs(u) < 1.1 && Math.abs(fy - 1.5) < 0.6) return { ramp: PAPER.pink, fixed: 3, noOutline: true };
      if (Math.abs(Math.abs(u) - 1.2) < 0.7 && Math.abs(fy - 3) < 0.6) return { ramp: face, fixed: 1, noOutline: true };
      if (Math.abs(Math.abs(u) - 8) < 1.1 && Math.abs(fy - 2.5) < 0.6) return { ramp: PAPER.pink, fixed: 4, noOutline: true };
      if (Math.abs(u) > 9.5 && Math.abs(u) < 13 && (Math.abs(fy - 0.5) < 0.5 || Math.abs(fy - 2.5) < 0.5)) return { ramp: face, fixed: 2, noOutline: true };
      return { ramp: glaze, v };
    } });
    opening(cv, { cx, yt, rx, ry, lip: 2, fn: ({ x, y, ex, ey, ix, iy, inner, iry }) => {
      if (!inner) return { ramp: glaze, v: 0.8 - 0.3 * ex - 0.1 * ey, z: 2, part: 'rim' };
      const wallLine = yt - iry * Math.sqrt(Math.max(0, 1 - ix * ix)) + 1.6;
      if (y + 0.5 < wallLine) return { ramp: innerRamp, v: 0.4 - 0.1 * ix, z: 1.6, part: 'in' };
      return coffee(cx, yt + 0.5)({ x, y, ix, iy });
    } });
    render(cv, name, { scale: 5 });
  }

  // ---------- 7. terminal mug ----------
  function terminalMug(name) {
    const W = 56, H = 60, cv = new Cv(W, H), cx = 24, rx = 15, ry = 4, yt = 16, yb = 50;
    shadowEllipse(cv, cx + 4, yb + 3, 23, 3.6);
    handle(cv, { hx: cx + rx + 1, hy: 32, R: 8, Ry: 10, tr: 2.7, ramp: IRON, xmin: cx + rx - 2, spec: 1.2 });
    const glyph = (u, y) => {
      const U = Math.round(u + 0.5), Y = y;
      // window frame
      if ((Y === 22 || Y === 43) && U >= -10 && U <= 10) return 3;
      if ((U === -10 || U === 10) && Y >= 22 && Y <= 43) return 3;
      if (Y === 24 && U >= -9 && U <= 9 && U % 3 !== 0) return 2;
      // > prompt, a line of text, then a cursor block
      if (Y >= 28 && Y <= 32 && U === -8 + Math.min(Y - 28, 32 - Y)) return 5;
      if (Y === 30 && U >= -4 && U <= 6) return 4;
      if (Y === 35 && U >= -7 && U <= 2) return 4;
      if (Y === 38 && U >= -7 && U <= -1) return 4;
      if (Y >= 37 && Y <= 39 && U >= 1 && U <= 3) return 6;
      return null;
    };
    body(cv, { cx, yt, yb, rx: () => rx, ry, spec: 1.4, shin: 44, paint: ({ y, u, v, nx }) => {
      const g = Math.abs(nx) < 0.85 ? glyph(u, y) : null;
      if (g != null) return { ramp: CRT, fixed: g, noOutline: true };
      return { ramp: IRON, v };
    } });
    opening(cv, { cx, yt, rx, ry, lip: 1.4, fn: ({ x, y, ex, ey, ix, iy, inner, iry }) => {
      if (!inner) return { ramp: IRON, v: 0.75 - 0.3 * ex - 0.1 * ey, z: 2, part: 'rim' };
      const wallLine = yt - iry * Math.sqrt(Math.max(0, 1 - ix * ix)) + 1.8;
      if (y + 0.5 < wallLine) return { ramp: CRT, v: 0.35 - 0.1 * ix, z: 1.6, part: 'in' };
      return coffee(cx, yt + 0.5)({ x, y, ix, iy });
    } });
    wisps(cv, cx, 0, yt - 4);
    render(cv, name, { scale: 5 });
  }

  // ---------- contents for the pencil cups (all vertical) ----------
  function item(cv, o) {
    const { x, w, top, bot, ramp, kind, z, part, clip } = o;
    if (['pencil', 'eraser', 'pen', 'ruler'].includes(kind)) return pencil(cv, o);
    const facet = i => light(norm([(i + 0.5) / w * 2 - 1, 0, 0.9]), { amb: 0.25, spec: 0.6, shin: 14 });
    const put = (X, y, cell) => { if (clip(X, y)) cv.put(X, y, { z, part, ...cell }); };
    if (kind === 'scissors') {
      // two finger loops up top, blades running down into the cup
      for (const s of [-1, 1]) {
        const lx = x + s * 3, ly = top + 4;
        for (let y = top; y <= top + 9; y++) for (let X = lx - 4; X <= lx + 4; X++) {
          const d = Math.hypot((X + 0.5 - lx) / 3.4, (y + 0.5 - ly) / 4.2);
          if (d > 1 || d < 0.45) continue;
          put(X, y, { ramp, v: light(norm([(X + 0.5 - lx) / 4, (y + 0.5 - ly) / 5, 0.8]), { spec: 0.9, shin: 24 }), part: part + s });
        }
      }
      for (let y = top + 9; y <= bot; y++) for (let X = x - 1; X <= x; X++) put(X, y, { ramp: CHROME, v: X === x - 1 ? 0.85 : 0.5 });
      put(x - 1, top + 10, { ramp: IRON, fixed: 1 });
      return;
    }
    for (let y = top; y <= bot; y++) for (let i = 0; i < w; i++) {
      const r = y - top, f = facet(i), off = Math.abs(i + 0.5 - w / 2);
      if (kind === 'marker') {
        if (r === 0 && off > w / 2 - 1) continue;
        if (r < 9) put(x + i, y, { ramp, v: f + 0.05 });
        else if (r === 9) put(x + i, y, { ramp: IRON, v: f });
        else if (r >= 13 && r <= 15) put(x + i, y, { ramp, v: f });
        else put(x + i, y, { ramp: PAPER.cream, v: f + 0.1 });
      } else if (kind === 'highlighter') {
        if (r < 2 && i < w / 2 - (r === 0 ? 0 : 1)) continue;
        if (r < 11) put(x + i, y, { ramp, v: f + 0.1 });
        else put(x + i, y, { ramp, v: f - 0.05 + (r === 11 ? -0.2 : 0) });
      } else if (kind === 'brush') {
        if (r >= 10) put(x + i, y, { ramp, v: f });
      }
    }
    if (kind === 'brush') {
      // bristles up: a fat tuft dipped in paint, wider than the handle, then a bright crimped ferrule
      const c = x + w / 2, prof = [0.6, 1.4, 2, 2.4, 2.5, 2.5, 2.2];
      prof.forEach((hw, r) => {
        for (let X = Math.floor(c - hw); X < Math.ceil(c + hw); X++) {
          const f = light(norm([(X + 0.5 - c) / (hw + 0.5), 0, 0.9]), { amb: 0.25, spec: 0.5, shin: 14 });
          put(X, top + r, { ramp: r < 3 ? o.paint : SABLE, v: f + (r === 2 ? -0.1 : 0) });
        }
      });
      for (let r = 7; r < 10; r++) for (let X = Math.floor(c - 1.5); X < Math.ceil(c + 1.5); X++)
        put(X, top + r, { ramp: CHROME, v: light(norm([(X + 0.5 - c) / 2, 0, 0.9]), { amb: 0.3, spec: 1, shin: 20 }) + (r === 8 ? -0.2 : 0.1) });
    }
  }
  const SABLE = ['#140a04', '#3a2210', '#5e3a1c', '#80542c', '#a07040', '#c49460'];
  const cylClip = (cx, irx, iry, yt) => (x, y) => { const ix = (x + 0.5 - cx) / irx; return Math.abs(ix) < 1 && y + 0.5 <= yt + iry * Math.sqrt(1 - ix * ix); };
  const fill = (cv, clip, z0, list) => list.forEach(([x, w, top, kind, ramp, paint], i) => item(cv, { x, w, top, bot: 74, ramp, kind, paint, z: z0 + i * 0.01, part: 'c' + i, clip }));

  // ---------- A. ribbed tin can with a paper label ----------
  function tinCan(name, label, band) {
    const W = 52, H = 76, cv = new Cv(W, H), cx = 25.5, rx = 14, ry = 3.6, yt = 40, yb = 70;
    shadowEllipse(cv, cx + 4, yb + 3, 21, 3.2);
    body(cv, { cx, yt, yb, rx: () => rx, ry, spec: 1.2, shin: 30, paint: ({ x, y, u, v, fromTop, fromBot }) => {
      const t = y - yt;
      if (t >= 6 && t <= 23) {
        // label: cream paper, a coloured band, a little drawn pencil and two text lines
        if (t >= 9 && t <= 13) return { ramp: band, v: v * 0.8 + 0.1, part: 'label' };
        if (t === 17 && Math.abs(u) < 7) return { ramp: IRON, fixed: 2, part: 'label', noOutline: true };
        if (t === 19 && Math.abs(u) < 4) return { ramp: IRON, fixed: 2, part: 'label', noOutline: true };
        return { ramp: label, v: v * 0.85 + 0.12, part: 'label' };
      }
      // tin above and below the label, with pressed ribs
      const rib = (t % 3 === 1 && (t < 6 || t > 23)) ? -0.2 : 0;
      return { ramp: CHROME, v: v + rib + (hash(x, 0, 104) - 0.5) * 0.06 };
    } });
    const { irx, iry } = opening(cv, { cx, yt, rx, ry, lip: 1.3, fn: ({ ex, ey, inner, iy }) => !inner
      ? { ramp: CHROME, v: 0.85 - 0.3 * ex - 0.1 * ey, z: ey < 0 ? 1.4 : 2.2, part: ey < 0 ? 'lipB' : 'lipF' }
      : { ramp: IRON, v: 0.05 + 0.12 * Math.max(0, iy), z: 1.3, part: 'in' } });
    fill(cv, cylClip(cx, irx, iry, yt), 1.8, [
      [14, 3, 14, 'pencil', BOOK.teal], [17, 4, 18, 'marker', BOOK.rust], [26, 0, 14, 'scissors', GLAZE.forest],
      [30, 3, 10, 'pencil', PAPER.amber], [33, 3, 16, 'pen', GLAZE.dusk], [36, 3, 21, 'pencil', BOOK.green]]);
    render(cv, name, { scale: 5 });
  }

  // ---------- B. glass mason jar, pens seen through the glass ----------
  function masonJar(name) {
    const W = 52, H = 80, cv = new Cv(W, H), cx = 25.5, yb = 74, ry = 3.4;
    shadowEllipse(cv, cx + 4, yb + 3, 21, 3.2);
    // contents first, full length, then the glass laid over them
    const inJar = (x, y) => Math.abs(x + 0.5 - cx) < 12 && y < yb;
    const list = [[13, 3, 18, 'pencil', BOOK.rust], [16, 4, 14, 'highlighter', NEON.yellow], [21, 3, 9, 'pencil', GLAZE.forest],
      [24, 3, 20, 'pen', IRON], [28, 4, 12, 'highlighter', NEON.pink], [33, 3, 16, 'pencil', BOOK.teal], [36, 3, 22, 'pencil', GLAZE.dusk]];
    list.forEach(([x, w, top, kind, ramp], i) => item(cv, { x, w, top, bot: yb, ramp, kind, z: 1 + i * 0.01, part: 'c' + i, clip: inJar }));
    // jar profile: a body, a shoulder curving in to the neck, threads on the neck
    const neck = 11, bodyR = 14.5, shoulderTop = 36, shoulderBot = 42, yt = 32;
    const rx = y => y < shoulderTop ? neck : y < shoulderBot ? neck + (bodyR - neck) * Math.sin((y - shoulderTop) / (shoulderBot - shoulderTop) * Math.PI / 2) : bodyR;
    for (let y = yt; y <= yb + ry; y++) {
      const r = rx(Math.min(y, yb));
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const nx = (x + 0.5 - cx) / r; if (Math.abs(nx) > 1) continue;
        const nz = Math.sqrt(1 - nx * nx); if (y > yb + ry * nz) continue;
        const under = cv.get(x, y);
        const thread = y >= yt + 1 && y <= shoulderTop - 1 && (y - yt) % 2 === 0;
        const edge = Math.abs(nx) > 0.86 || y > yb + ry * nz - 2;
        const hl = Math.abs(nx + 0.5) < 0.08 && y > shoulderBot && y < yb - 2;
        if (edge || thread) cv.put(x, y, { ramp: GLASS, v: 0.5 - 0.2 * nx + (thread ? 0.25 : 0), z: 3, part: 'glass' });
        else if (hl) cv.put(x, y, { ramp: GLASS, v: 0.98, z: 3, part: 'glass', noOutline: true });
        else if (under && under.ramp) cv.c[y * W + x] = { ...under, v: under.v * 0.82 + 0.08, z: 2, noOutline: true };
        else cv.put(x, y, { col: '#cfe8e0', a: 0.28, z: 2, solid: false });
      }
    }
    opening(cv, { cx, yt, rx: neck, ry: 2.6, lip: 1.2, fn: ({ ex, ey, inner, x, y }) => {
      if (!inner) return { ramp: GLASS, v: 0.85 - 0.25 * ex - 0.1 * ey, z: ey < 0 ? 0.9 : 3.2, part: 'neck' };
      return cv.get(x, y) ? null : { ramp: GLASS, v: 0.2, z: 0.8, part: 'in' };
    } });
    render(cv, name, { scale: 5 });
  }

  // ---------- C. square wooden box ----------
  function woodBox(name) {
    const W = 52, H = 76, cv = new Cv(W, H), x0 = 9, x1 = 42, yTop = 44, yb = 70, depth = 5;
    for (let y = yb + 1; y <= yb + 3; y++) for (let x = x0 + 2; x <= x1 + 4; x++) cv.put(x, y, { col: '#1c0f08', a: y === yb + 1 ? 0.42 : 0.22, z: -1, solid: false });
    const grain = (x, y) => 0.06 * Math.sin(y * 1.1 + Math.sin(x * 0.35) * 2.5) + (hash(x, y, 105) - 0.5) * 0.06;
    // contents, clipped to the box opening
    const clip = (x, y) => x > x0 + 1 && x < x1 - 1 && y <= yTop;
    fill(cv, clip, 1.5, [
      [12, 5, 8, 'ruler', null], [18, 3, 18, 'pencil', BOOK.rust], [21, 3, 12, 'eraser', PAPER.amber], [27, 0, 16, 'scissors', BOOK.rust],
      [30, 4, 20, 'marker', GLAZE.dusk], [35, 3, 10, 'pencil', BOOK.teal], [38, 3, 22, 'pen', IRON]]);
    // top rim: back edge (behind contents), inner shadow, front edge
    for (let y = yTop - depth; y <= yTop; y++) for (let x = x0; x <= x1; x++) {
      const back = y <= yTop - depth + 1, side = x <= x0 + 1 || x >= x1 - 1, front = y >= yTop - 1;
      if (back) cv.put(x, y, { ramp: WOOD, v: 0.85 + grain(x, y), z: 1, part: 'rimB' });
      else if (side) cv.put(x, y, { ramp: WOOD, v: 0.78 + grain(x, y), z: 2.5, part: 'rimS' + (x < 25 ? 'L' : 'R') });
      else if (front) cv.put(x, y, { ramp: WOOD, v: 0.92 + grain(x, y), z: 2.6, part: 'rimF' });
      else if (!cv.get(x, y)) cv.put(x, y, { ramp: WOOD, v: 0.05, z: 0.9, part: 'in' });
    }
    // front face with a dovetail joint at each corner and a brass name plate
    for (let y = yTop + 1; y <= yb; y++) for (let x = x0; x <= x1; x++) {
      const nx = x <= x0 + 1 ? -0.6 : x >= x1 - 1 ? 0.6 : 0;
      let v = light(norm([nx, y >= yb - 1 ? 0.5 : 0, 1]), { amb: 0.3, spec: 0.3, shin: 10 }) + grain(x, y);
      const dove = (x === x0 + 2 || x === x1 - 2) && ((y - yTop) % 6 === 0);
      if (dove) v -= 0.25;
      const plate = x >= 20 && x <= 31 && y >= 53 && y <= 58;
      if (plate) {
        const screw = (x === 21 || x === 30) && y === 55;
        cv.put(x, y, { ramp: GOLD, v: screw ? 0.2 : light(norm([0, (y - 55.5) / 3, 1]), { spec: 1, shin: 20 }), z: 3.1, part: 'plate' });
      } else cv.put(x, y, { ramp: WOOD, v, z: 3, part: 'face' });
    }
    render(cv, name, { scale: 5 });
  }

  // ---------- D. terracotta pot of paintbrushes ----------
  function brushPot(name, pot) {
    const W = 52, H = 80, cv = new Cv(W, H), cx = 25.5, yt = 48, yb = 74, ry = 3.6;
    shadowEllipse(cv, cx + 4, yb + 3, 20, 3.2);
    const rx = y => 13.5 - 3 * (y - yt) / (yb - yt);
    body(cv, { cx, yt, yb, rx, ry, spec: 0.2, shin: 16, paint: ({ x, y, v, fromTop }) => {
      if (fromTop < 6) return { ramp: pot, v: v * (fromTop < 1 ? 1 : 1) + (fromTop === 5 ? -0.25 : 0.05) + (hash(x, y, 106) - 0.5) * 0.06, part: 'band' };
      // splashes of paint down the side
      const sp = ((x - 18) ** 2 + (y - 60) ** 2 <= 2.2) ? PAPER.amber : ((x - 30) ** 2 + (y - 64) ** 2 <= 1.5) ? GLAZE.crt : null;
      if (sp) return { ramp: sp, v: 0.7, noOutline: true };
      return { ramp: pot, v: v + (hash(x, y, 107) - 0.5) * 0.08 };
    } });
    const { irx, iry } = opening(cv, { cx, yt, rx: 15, ry, lip: 1.8, fn: ({ ex, ey, inner, iy }) => !inner
      ? { ramp: pot, v: 0.85 - 0.3 * ex - 0.1 * ey, z: ey < 0 ? 1.4 : 2.2, part: ey < 0 ? 'lipB' : 'lipF' }
      : { ramp: pot, v: 0.04 + 0.1 * Math.max(0, iy), z: 1.3, part: 'in' } });
    // rim band is slightly wider than the pot body
    body(cv, { cx, yt, yb: yt + 5, rx: () => 15, ry: 3.6, z: 1.2, part: 'band', spec: 0.2, paint: ({ v, x, y }) => ({ ramp: pot, v: v + 0.06 + (hash(x, y, 108) - 0.5) * 0.06 }) });
    fill(cv, cylClip(cx, irx, iry, yt), 1.8, [
      [14, 2, 14, 'brush', WOOD, BOOK.rust], [17, 3, 6, 'brush', IRON, GLAZE.forest], [21, 2, 20, 'brush', BOOK.teal, PAPER.amber],
      [24, 3, 10, 'brush', WOOD, GLAZE.dusk], [28, 2, 16, 'brush', PAPER.cream, BOOK.teal], [31, 3, 4, 'brush', BOOK.rust, PAPER.cream], [35, 2, 12, 'brush', WOOD, GLAZE.crt]]);
    render(cv, name, { scale: 5 });
  }

  // ---------- E. black mesh cup ----------
  function meshCup(name, metal) {
    const W = 52, H = 76, cv = new Cv(W, H), cx = 25.5, rx = 13.5, ry = 3.6, yt = 38, yb = 70;
    shadowEllipse(cv, cx + 4, yb + 3, 20, 3.2);
    // contents run all the way down so they show through the holes
    const inner = (x, y) => Math.abs(x + 0.5 - cx) < 12 && y < yb;
    const list = [[14, 4, 10, 'highlighter', NEON.green], [18, 3, 16, 'pen', GLAZE.dusk], [21, 3, 5, 'pencil', PAPER.amber],
      [24, 4, 12, 'marker', IRON], [29, 3, 18, 'pencil', BOOK.rust], [32, 4, 8, 'highlighter', NEON.yellow], [36, 3, 14, 'pen', BOOK.teal]];
    list.forEach(([x, w, top, kind, ramp], i) => item(cv, { x, w, top, bot: yb, ramp, kind, z: 1 + i * 0.01, part: 'c' + i, clip: inner }));
    body(cv, { cx, yt, yb, rx: () => rx, ry, spec: 1, shin: 26, z: 2, paint: ({ x, y, v, u, fromTop, fromBot }) => {
      if (fromTop < 3 || fromBot < 3) return { ramp: metal, v: v + 0.05, part: 'band' };
      // diamond mesh: holes where both diagonals miss the wire
      const a = Math.round(u + y) % 4, b = Math.round(u - y + 400) % 4;
      if (a !== 0 && b !== 0 && Math.abs(u) < rx - 2.5) {
        const under = cv.get(x, y);
        if (under && under.ramp && under.z < 2) { cv.c[y * W + x] = { ...under, v: under.v * 0.35, noOutline: true }; return null; }
        return { ramp: metal, v: 0.06, noOutline: true, part: 'hole' };
      }
      return { ramp: metal, v: v + 0.08, part: 'wire' };
    } });
    opening(cv, { cx, yt, rx, ry, lip: 1.2, fn: ({ ex, ey, inner: inn, iy, x, y }) => {
      if (!inn) return { ramp: metal, v: 0.85 - 0.3 * ex - 0.1 * ey, z: ey < 0 ? 0.9 : 2.5, part: ey < 0 ? 'lipB' : 'lipF' };
      return cv.get(x, y) ? null : { ramp: metal, v: 0.04 + 0.1 * Math.max(0, iy), z: 0.8, part: 'in' };
    } });
    render(cv, name, { scale: 5 });
  }

  enamel('cup-enamel-cream', ENAMEL, NAVY);
  enamel('cup-enamel-forest', GLAZE.forest, IRON);
  tumbler('cup-tumbler-forest', GLAZE.forest);
  tumbler('cup-tumbler-dusk', GLAZE.dusk);
  takeaway('cup-takeaway', KRAFT);
  espresso('cup-espresso-cream', ENAMEL);
  espresso('cup-espresso-forest', GLAZE.forest);
  latte('cup-latte');
  catMug('cup-cat-cream', ENAMEL, IRON, ENAMEL);
  catMug('cup-cat-black', IRON, PAPER.amber, IRON);
  terminalMug('cup-terminal');
  tinCan('pcup-tin-teal', PAPER.cream, BOOK.teal);
  tinCan('pcup-tin-rust', PAPER.cream, BOOK.rust);
  masonJar('pcup-jar');
  woodBox('pcup-box');
  brushPot('pcup-brushes', POT.terracotta);
  meshCup('pcup-mesh', IRON);
};
