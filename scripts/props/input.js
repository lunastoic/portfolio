// Keyboards, mice and mouse pads. Everything square to the viewer; cables run straight up.
module.exports = ({ Cv, render, light, norm, hash, vnoise, shadowEllipse, GLAZE, GOLD, PAPER, CHROME, IRON, POT, BOOK }) => {
  const CREAM = ['#3a2a18', '#7a6448', '#a89070', '#c8b08a', '#dcc8a2', '#ece0c0', '#faf2dc'];
  const BEIGE = ['#2e2618', '#5e5440', '#8a7e64', '#a89c80', '#c0b498', '#d6cbb0', '#ece4cc'];
  const COCOA = ['#140804', '#2e1a0e', '#45291a', '#5a3824', '#704a30', '#8a6040', '#a87c58'];
  const ORANGE = PAPER.orange;
  const SLATE = ['#06070a', '#111318', '#1b1e26', '#262a34', '#333844', '#454b58', '#646b7a'];
  const NIGHT = ['#04060e', '#0a1024', '#121a38', '#1c2650', '#283468', '#3a4a86', '#5a6ca8'];
  const SUN = ['#3a0c18', '#8a2440', '#c43c50', '#e8604a', '#f48a4c', '#f8b45a', '#fce08a'];
  const GRID = ['#0c0418', '#1e0c34', '#2e1450', '#40206a', '#582c88', '#7a44aa', '#b070e0'];
  const RUBBER = ['#060404', '#120c0a', '#1c1412', '#26201c', '#322a26', '#403632', '#544a44'];
  const VINYL = ['#040404', '#0c0c0e', '#16161a', '#202026', '#2c2c34', '#3c3c46', '#5a5a66'];
  const TOPO = ['#1a2410', '#34481e', '#4e6a2c', '#6a8a3c', '#8aa650', '#b0c474', '#dce4a8'];
  const SAND = ['#3a2a14', '#6e5430', '#987a48', '#b89a60', '#d0b47a', '#e4cc98', '#f6e8c4'];
  const LED = '#7cf59a';

  // ---------------- KEYBOARDS ----------------
  // a key list: {x, r, w, h, role} in units/rows
  function rowKeys(r, widths, x = 0, roles = {}) {
    const out = [];
    widths.forEach((w, i) => { if (w < 0) { x -= w; return; } out.push({ x, r, w, h: 1, role: roles[i] || 'a' }); x += w; });
    return out;
  }
  const mainBlock = (r0, opt = {}) => {
    const M = 'm', keys = [];
    keys.push(...rowKeys(r0, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2], 0, { 0: opt.grave || 'a', 13: M }));
    keys.push(...rowKeys(r0 + 1, [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5], 0, { 0: M, 13: M }));
    keys.push(...rowKeys(r0 + 2, [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25], 0, { 0: M, 12: opt.enter || M }));
    keys.push(...rowKeys(r0 + 3, [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75], 0, { 0: M, 11: M }));
    keys.push(...rowKeys(r0 + 4, [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25], 0, { 0: M, 1: M, 2: M, 3: opt.space || 's', 4: M, 5: M, 6: M, 7: M }));
    return keys;
  };
  const fnRow = (esc = 'e') => rowKeys(0, [1, -1, 1, 1, 1, 1, -0.5, 1, 1, 1, 1, -0.5, 1, 1, 1, 1], 0, { 0: esc, 1: 'm', 2: 'm', 3: 'm', 4: 'm', 9: 'm', 10: 'm', 11: 'm', 12: 'm' });
  const navBlock = x => [
    ...rowKeys(0, [1, 1, 1], x, { 0: 'm', 1: 'm', 2: 'm' }),
    ...rowKeys(1, [1, 1, 1], x, { 0: 'm', 1: 'm', 2: 'm' }), ...rowKeys(2, [1, 1, 1], x, { 0: 'm', 1: 'm', 2: 'm' }),
    { x: x + 1, r: 4, w: 1, h: 1, role: 'm' }, ...rowKeys(5, [1, 1, 1], x, { 0: 'm', 1: 'm', 2: 'm' })
  ];
  const numBlock = (x, r0, opt = {}) => [
    ...rowKeys(r0, [1, 1, 1, 1], x, { 0: 'm', 1: 'm', 2: 'm', 3: 'm' }),
    ...rowKeys(r0 + 1, [1, 1, 1], x), { x: x + 3, r: r0 + 1, w: 1, h: 2, role: 'm' },
    ...rowKeys(r0 + 2, [1, 1, 1], x),
    ...rowKeys(r0 + 3, [1, 1, 1], x), { x: x + 3, r: r0 + 3, w: 1, h: 2, role: opt.enter || 'm' },
    { x, r: r0 + 4, w: 2, h: 1, role: 'a' }, { x: x + 2, r: r0 + 4, w: 1, h: 1, role: 'a' }
  ];

  // case: rounded slab; keys: caps with a lit top, darker front skirt; legends as a dark pixel or two
  function keyboard(name, o) {
    const { U, keys, units, rows, top = 3, skirt = 2, inset = 0, padX = 3, padTop = 4, padBot = 3, thick = 3, back = 0, wedge = false,
      ramps, caseR, extras, fnGap = 0, legend = true } = o;
    const pitch = top + skirt + 1, W = Math.round(units * U) + padX * 2 + 2;
    const rowsH = rows * pitch + fnGap;
    const cy0 = 2 + back, cy1 = cy0 + padTop + rowsH + padBot, H = cy1 + thick + 4;
    const cv = new Cv(W, H), x0 = 1, x1 = W - 2, rr = 3;
    for (let x = x0 + 1; x <= x1 + 1; x++) for (let y = cy1 + thick; y <= cy1 + thick + 2; y++) cv.put(x + 1, y, { col: '#1c0f08', a: y === cy1 + thick ? 0.42 : 0.22, z: -1, solid: false });
    const inCase = (x, y, ya) => {
      if (x < x0 || x > x1 || y < ya || y > cy1 + thick) return false;
      const dx = Math.max(x0 + rr - x, 0, x - (x1 - rr)), dy = Math.max(ya + rr - y, 0, y - (cy1 + thick - rr));
      return dx * dx + dy * dy <= rr * rr + 1;
    };
    // case top surface (and for the wedge, the sloped back panel), then the front edge
    for (let y = 2; y <= cy1 + thick; y++) for (let x = x0; x <= x1; x++) {
      if (!inCase(x, y, 2)) continue;
      const ex = x < x0 + 2 ? -0.7 : x > x1 - 2 ? 0.7 : 0;
      let v, part = 'case';
      if (y > cy1) { v = 0.32 - 0.05 * (y - cy1) + (y === cy1 + 1 ? 0.12 : 0); part = 'edge'; }
      else if (wedge && y < cy0) { v = light(norm([ex, -0.75, 0.66]), { amb: 0.3, spec: 0.4, shin: 14 }) + 0.05; }
      else v = light(norm([ex, y < 4 ? -0.6 : 0, 1]), { amb: 0.3, spec: 0.3, shin: 12 }) * 0.82;
      if (wedge && y === cy0) v = 0.25;
      v += (hash(x, y, 91) - 0.5) * 0.04;
      cv.put(x, y, { ramp: caseR, v, z: 0, part });
    }
    const kx0 = x0 + padX + 1, ky0 = cy0 + padTop;
    keys.forEach((k, i) => {
      const r = ramps[k.role] || ramps.a;
      const xa = kx0 + Math.round(k.x * U), xb = kx0 + Math.round((k.x + k.w) * U) - 2;
      const ya = ky0 + k.r * pitch + (k.r > 0 ? fnGap : 0), yb = ya + k.h * pitch - 2;
      const topB = yb - skirt;
      for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
        let v;
        if (y <= topB) {
          if (inset && (x < xa + inset || x > xb - inset)) { v = 0.42 + (x < xa + inset ? 0.08 : -0.08); }
          else {
            const nx = (x - xa + 0.5) / (xb - xa + 1) * 2 - 1;
            v = 0.74 - 0.08 * nx - 0.06 * ((y - ya) / Math.max(1, topB - ya));
            if (y === ya) v += 0.08;
          }
        } else v = 0.36 - 0.07 * (y - topB - 1) - (x === xb ? 0.05 : 0);
        cv.put(x, y, { ramp: r, v, z: 1 + i * 0.001, part: 'k' + i });
      }
      // legend: a dot or a short dash on the cap
      if (legend && k.role !== 's' && topB - ya >= 1) {
        const lx = k.w > 1.6 ? xa + 2 : Math.round((xa + xb) / 2) - 1, ly = ya + 1;
        const cell = { ramp: r, fixed: 2, z: 1.5, part: 'k' + i, noOutline: true };
        cv.put(lx, ly, cell); if (k.w > 1.6 || (i % 3 === 0)) cv.put(lx + 1, ly, cell);
      }
    });
    if (extras) extras(cv, { W, H, x0, x1, cy0, cy1, thick, kx0, ky0, U, pitch });
    render(cv, name, { scale: 4 });
  }
  const leds = (cv, xs, y, cols) => xs.forEach((x, i) => cv.put(x, y, { col: cols[i], z: 0.5, solid: false }));

  // 1. full-size retro, numpad, orange Esc
  keyboard('kb-retro-full', {
    U: 6, units: 23, rows: 6, fnGap: 2, caseR: COCOA,
    keys: [...fnRow(), ...mainBlock(1, { enter: 'e' }), ...navBlock(15.5), ...numBlock(19, 1)],
    ramps: { a: CREAM, m: BEIGE, s: CREAM, e: ORANGE },
    extras: (cv, g) => leds(cv, [g.x1 - 14, g.x1 - 10, g.x1 - 6], g.cy0 + 2, [LED, '#3a2a18', LED])
  });
  // 2. tenkeyless mechanical: tall caps, green alphas, cream mods
  keyboard('kb-tkl-green', {
    U: 7, units: 18.5, rows: 6, top: 3, skirt: 3, inset: 1, fnGap: 3, caseR: SLATE,
    keys: [...fnRow(), ...mainBlock(1, { enter: 'e', space: 'm' }), ...navBlock(15.5)],
    ramps: { a: GLAZE.forest, m: CREAM, s: CREAM, e: ORANGE }
  });
  // 3. compact 60%: no F row, coloured space bar, one artisan cap
  keyboard('kb-sixty', {
    U: 8, units: 15, rows: 5, top: 4, skirt: 3, inset: 1, padX: 4, padTop: 4, caseR: GLAZE.dusk,
    keys: (() => { const k = mainBlock(0, { grave: 'e', enter: 'g', space: 's' }); return k; })(),
    ramps: { a: CREAM, m: BEIGE, s: GLAZE.dusk, e: ORANGE, g: GLAZE.forest },
    extras: (cv, g) => {
      // artisan cap: a little green slime moon on the Esc key
      const ax = g.kx0 + 2, ay = g.ky0 + 1;
      for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) if (!(y === 0 && (x === 0 || x === 3)))
        cv.put(ax + x, ay + y, { ramp: GLAZE.crt, v: 0.85 - y * 0.15 - x * 0.05, z: 2, part: 'art' });
    }
  });
  // 4. chunky beige terminal board with a wedge case and badge
  keyboard('kb-terminal', {
    U: 6, units: 19.5, rows: 5, back: 9, wedge: true, padTop: 3, thick: 5, caseR: BEIGE,
    keys: [...mainBlock(0, { enter: 'e' }), ...numBlock(15.5, 0, { enter: 'e' })],
    ramps: { a: CREAM, m: COCOA, s: CREAM, e: ORANGE },
    extras: (cv, g) => {
      // badge strip and two lights on the sloped back panel
      for (let x = g.x0 + 6; x <= g.x0 + 22; x++) for (let y = 4; y <= 6; y++) cv.put(x, y, { ramp: SLATE, v: 0.4 + (y === 4 ? 0.2 : 0), z: 0.5, part: 'badge' });
      for (const x of [g.x0 + 8, g.x0 + 11, g.x0 + 13, g.x0 + 16, g.x0 + 19]) cv.put(x, 5, { ramp: CREAM, fixed: 5, z: 0.6, part: 'badge', noOutline: true });
      leds(cv, [g.x1 - 12, g.x1 - 7], 5, [LED, '#f6b874']);
      // ventilation slots on the front edge
      for (let x = g.x0 + 10; x < g.x1 - 10; x += 4) cv.put(x, g.cy1 + 3, { ramp: BEIGE, fixed: 1, z: 0.5, part: 'edge', noOutline: true });
    }
  });
  // 5. split board: two mirrored halves, square to the viewer
  (() => {
    const L = [...rowKeys(0, [1, 1, 1, 1, 1, 1, 1], 0, { 0: 'e' }), ...rowKeys(1, [1.5, 1, 1, 1, 1, 1], 0, { 0: 'm' }),
      ...rowKeys(2, [1.75, 1, 1, 1, 1, 1], 0, { 0: 'm' }), ...rowKeys(3, [2.25, 1, 1, 1, 1, 1], 0, { 0: 'm' }),
      ...rowKeys(4, [1.25, 1.25, 1.25, 2.75], 0, { 0: 'm', 1: 'm', 2: 'm', 3: 's' })];
    const half = 7.25, gapU = 3;
    const keys = [...L.map(k => ({ ...k })), ...L.map(k => ({ ...k, x: half * 2 + gapU - k.x - k.w, role: k.role === 'e' ? 'm' : k.role }))];
    keyboard('kb-split', {
      U: 7, units: half * 2 + gapU, rows: 5, top: 3, skirt: 3, inset: 1, padX: 3, caseR: SLATE,
      keys, ramps: { a: CREAM, m: GLAZE.forest, s: ORANGE, e: ORANGE },
      extras: (cv, g) => {
        // the gap between the halves: clear it back to nothing and draw a coiled-straight link cable
        const gx0 = g.kx0 + Math.round(half * g.U) + 1, gx1 = g.kx0 + Math.round((half + gapU) * g.U) - 4;
        for (let y = 0; y < g.H; y++) for (let x = gx0; x <= gx1; x++) cv.c[y * g.W + x] = null;
        for (let x = gx0; x <= gx1; x++) for (let y = g.cy1 + g.thick; y <= g.cy1 + g.thick + 2; y++) { /* no shadow across the gap */ }
        const my = Math.round((g.cy0 + g.cy1) / 2);
        for (let x = gx0; x <= gx1; x++) { cv.put(x, my, { ramp: IRON, v: 0.55, z: 0.5, part: 'cord' }); cv.put(x, my + 1, { ramp: IRON, v: 0.3, z: 0.5, part: 'cord' }); }
      }
    });
  })();

  // ---------------- MICE ----------------
  // a mouse seen from above; `shape(dx, dy)` -> half width at dy (-1 nose .. 1 heel), normal tweaks per design
  function mouseBody(cv, { cx, cy, ry, halfW, ramp, z = 1, spec = 1, part = 'shell', flat = 1 }) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      const dy = (y + 0.5 - cy) / ry; if (Math.abs(dy) > 1) continue;
      const hw = halfW(dy); if (hw <= 0) continue;
      for (let x = Math.floor(cx - hw - 1); x <= Math.ceil(cx + hw + 1); x++) {
        const dx = (x + 0.5 - cx) / hw; if (Math.abs(dx) > 1) continue;
        const e = Math.min(1, dx * dx * 0.8 + dy * dy * 0.6);
        const n = norm([dx * 0.9, dy * 0.7, (Math.sqrt(1 - e) + 0.1) * flat]);
        cv.put(x, y, { ramp, v: light(n, { amb: 0.26, spec, shin: 26 }), z, part, dx, dy });
      }
    }
  }
  const cableUp = (cv, cx, yEnd, ramp = IRON, w = 2) => { for (let y = 0; y <= yEnd; y++) for (let k = 0; k < w; k++) cv.put(cx - (w >> 1) + k, y, { ramp, v: k === 0 ? 0.55 : 0.3, z: 0.5, part: 'cable' }); };
  const shade = (cv, f) => { for (let i = 0; i < cv.c.length; i++) { const c = cv.c[i]; if (c && c.dx !== undefined) { const r = f(c, i % cv.W, Math.floor(i / cv.W)); if (r) cv.c[i] = { ...c, ...r }; } } };

  // 1. retro boxy two-button ball mouse, thick grey cord
  (() => {
    const W = 40, H = 56, cv = new Cv(W, H), cx = 20, cy = 34, ry = 18;
    shadowEllipse(cv, cx + 3, cy + 5, 15, 16, 0.32);
    cableUp(cv, cx, cy - ry + 1, BEIGE, 3);
    mouseBody(cv, { cx, cy, ry, ramp: BEIGE, spec: 0.35, flat: 1.6, halfW: dy => 13 * Math.sqrt(1 - Math.max(0, Math.abs(dy) - 0.82) ** 2 / 0.033) || 0 });
    shade(cv, (c, x, y) => {
      const by = y - (cy - ry);
      // two big square buttons across the front third, split by a groove
      if (by >= 2 && by <= 13 && Math.abs(c.dx) < 0.86) {
        if (Math.abs(x + 0.5 - cx) < 1) return { v: 0.12 };
        if (by === 13) return { v: 0.15 };
        return { ramp: CREAM, v: 0.66 - 0.015 * by - (Math.abs(x + 0.5 - cx) < 2 ? 0.1 : 0) };
      }
      if (by === 26 && Math.abs(c.dx) < 0.5) return { v: 0.3 };
    });
    for (const x of [cx - 3, cx + 2]) cv.put(x, cy + 10, { ramp: ORANGE, fixed: 4, z: 1.5, part: 'shell', noOutline: true });
    render(cv, 'mouse2-retro-ball', { scale: 5 });
  })();

  // 2. trackball: a glossy ball in a wide housing, a button either side
  (() => {
    const W = 52, H = 48, cv = new Cv(W, H), cx = 26, cy = 26;
    shadowEllipse(cv, cx + 3, cy + 6, 22, 15, 0.32);
    cableUp(cv, cx, cy - 16);
    mouseBody(cv, { cx, cy, ry: 17, ramp: SLATE, spec: 0.7, flat: 1.2, halfW: dy => 22 * Math.sqrt(Math.max(0, 1 - dy * dy * dy * dy)) });
    shade(cv, (c, x, y) => { const dx = x + 0.5 - cx, by = y - cy; if (by > 3 && Math.abs(dx) > 12 && Math.abs(dx) < 19 && by < 13) return { ramp: GLAZE.forest, v: c.v * 0.9 + 0.1 }; if (by > 3 && by < 13 && (Math.abs(dx) - 12 | 0) === 0) return { v: 0.1 }; });
    const bx = cx, by = cy - 2, R = 10;
    for (let y = by - R - 2; y <= by + R + 2; y++) for (let x = bx - R - 2; x <= bx + R + 2; x++) {
      const d = Math.hypot(x + 0.5 - bx, y + 0.5 - by);
      if (d <= R + 1.6 && d > R) cv.put(x, y, { ramp: SLATE, v: 0.1, z: 1.4, part: 'socket' });
      else if (d <= R) {
        const ux = (x + 0.5 - bx) / R, uy = (y + 0.5 - by) / R, n = norm([ux, uy, Math.sqrt(Math.max(0, 1 - ux * ux - uy * uy))]);
        let v = light(n, { amb: 0.18, spec: 1.8, shin: 50 });
        if (hash(x, y, 93) > 0.9) v -= 0.12;
        cv.put(x, y, { ramp: POT.terracotta, v, z: 2, part: 'ball' });
      }
    }
    cv.put(bx - 4, by - 5, { col: '#fff4e0', z: 3, part: 'ball' }); cv.put(bx - 3, by - 5, { col: '#fff4e0', a: 0.6, z: 3, part: 'ball' }); cv.put(bx - 4, by - 4, { col: '#fff4e0', a: 0.6, z: 3, part: 'ball' });
    render(cv, 'mouse2-trackball', { scale: 5 });
  })();

  // 3. slim wireless: long, low, an LED strip down the spine, no cable
  (() => {
    const W = 36, H = 52, cv = new Cv(W, H), cx = 18, cy = 26, ry = 21;
    shadowEllipse(cv, cx + 3, cy + 4, 12, 20, 0.32);
    mouseBody(cv, { cx, cy, ry, ramp: SLATE, spec: 1.3, flat: 0.8, halfW: dy => 10.5 * Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(dy), 2.6))) * (0.9 + 0.1 * dy) });
    shade(cv, (c, x, y) => {
      const ax = Math.abs(x + 0.5 - cx), by = y - (cy - ry);
      if (ax < 1 && by >= 2 && by <= 34) return by >= 5 && by <= 9 ? { ramp: CHROME, v: by % 2 ? 0.75 : 0.45 } : { ramp: GLAZE.crt, v: 0.95 - by * 0.012, noOutline: true };
      if (ax < 1.8 && by >= 2 && by <= 34) return { v: 0.12 };
      if (by === 17 && ax < 8) return { v: c.v * 0.55 };
    });
    for (let y = 9; y <= 36; y++) for (const x of [cx - 2, cx + 1]) cv.put(x, y, { col: LED, a: 0.18, z: 2, solid: false });
    render(cv, 'mouse2-slim-led', { scale: 5 });
  })();

  // 4. sculpted ergonomic: wide palm hump, thumb rests both sides, side buttons, two-tone
  (() => {
    const W = 46, H = 56, cv = new Cv(W, H), cx = 23, cy = 34, ry = 18;
    shadowEllipse(cv, cx + 3, cy + 5, 19, 16, 0.32);
    cableUp(cv, cx, cy - ry + 1);
    mouseBody(cv, { cx, cy, ry, ramp: RUBBER, spec: 0.4, part: 'wing', halfW: dy => (16 + 3 * Math.max(0, dy)) * Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(dy), 3))) });
    mouseBody(cv, { cx, cy: cy - 1, ry: ry - 1, ramp: GLAZE.ember, spec: 1.2, z: 1.2, halfW: dy => 11.5 * Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(dy), 2.4))) * (0.82 + 0.18 * Math.max(0, dy + 0.3)) });
    shade(cv, (c, x, y) => {
      if (c.part !== 'shell') return;
      const by = y - (cy - ry), ax = Math.abs(x + 0.5 - cx);
      if (by >= 4 && by <= 9 && ax < 1.5) return { ramp: CHROME, v: by % 2 ? 0.7 : 0.4 };
      if (by >= 2 && by <= 14 && ax < 0.6) return { v: 0.12 };
      if (by === 15 && ax < 9) return { v: c.v * 0.5 };
    });
    for (const s of [-1, 1]) for (const yy of [cy - 2, cy + 2]) for (let k = 0; k < 3; k++) cv.put(cx + s * (15 + 0) + (s > 0 ? k - 2 : -k + 2) * 0 + s * k * 0, yy + k, { ramp: CHROME, v: 0.7 - k * 0.15, z: 1.3, part: 'sb' + s + yy });
    render(cv, 'mouse2-ergo', { scale: 5 });
  })();

  // ---------------- MOUSE PADS ----------------
  // seen from above with a touch of perspective: top edge 2px narrower each side, a thick foam front edge
  function pad(name, { W, H, shape = 'rect', foam = 3, edge = RUBBER, paint, wrist = null, rr = 5 }) {
    const cv = new Cv(W, H), yt = 2, yb = H - foam - 4, inset = 2;
    const lx = y => 1 + inset * (yb - y) / (yb - yt), rx = y => W - 2 - inset * (yb - y) / (yb - yt);
    const cxm = W / 2, cym = (yt + yb) / 2;
    const inside = (x, y) => {
      if (shape === 'round') return ((x - cxm) / (W / 2 - 1.5)) ** 2 + ((y - cym) / ((yb - yt) / 2)) ** 2 <= 1;
      if (y < yt || y > yb) return false;
      const a = lx(y), b = rx(y); if (x < a || x > b) return false;
      const dy = y < yt + rr ? yt + rr - y : y > yb - rr ? y - (yb - rr) : 0, dx = x < a + rr ? a + rr - x : x > b - rr ? x - (b - rr) : 0;
      return dx * dx + dy * dy <= rr * rr + 0.5;
    };
    // shadow + foam edge: the outline shifted down
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (inside(x - 2, y - foam - 2) && !inside(x, y)) cv.put(x, y, { col: '#1c0f08', a: 0.35, z: -1, solid: false });
      for (let k = 1; k <= foam; k++) if (inside(x + 0.5, y - k) && !inside(x + 0.5, y)) { cv.put(x, y, { ramp: edge, v: 0.32 - 0.06 * k, z: 0.5, part: 'foam' }); break; }
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!inside(x + 0.5, y)) continue;
      const u = (x + 0.5 - lx(y)) / (rx(y) - lx(y)), v = (y - yt) / (yb - yt);
      const c = paint(u, v, x, y);
      // soft cloth sheen from the upper left
      if (c.ramp && c.fixed == null) c.v = c.v + 0.08 * (1 - u) * (1 - v) - 0.06 * u * v + (hash(x, y, 97) - 0.5) * 0.05;
      cv.put(x, y, { ...c, z: 1, part: c.part || 'pad', noOutline: c.noOutline });
    }
    if (wrist) wrist(cv, { W, H, yb, lx, rx, inside });
    render(cv, name, { scale: 5 });
  }

  // 1. night: moon over two ridges of mountains, stars
  pad('pad2-moon', {
    W: 64, H: 58, paint: (u, v, x, y) => {
      const X = u * 60, Y = v * 46;
      const ridge1 = 30 + 6 * Math.abs(Math.sin(X * 0.13 + 1.2)) - (Math.abs(X - 22) < 10 ? 10 - Math.abs(X - 22) : 0);
      const ridge2 = 36 + 3 * Math.sin(X * 0.3) - (Math.abs(X - 44) < 8 ? 8 - Math.abs(X - 44) : 0) * 0.9;
      if (Y > ridge2) return { ramp: GLAZE.forest, v: 0.22 + (Y - ridge2 < 1 ? 0.2 : 0) };
      if (Y > ridge1) { const snow = Y - ridge1 < 2 && Math.abs(X - 22) < 4; return { ramp: snow ? CREAM : GLAZE.dusk, v: snow ? 0.75 : 0.3 + (X < 22 ? 0.12 : 0) }; }
      const m1 = Math.hypot(X - 42, Y - 12) <= 6.5, m2 = Math.hypot(X - 44.5, Y - 10.5) <= 5.5;
      if (m1 && !m2) return { ramp: PAPER.amber, v: 0.82 };
      if (hash(Math.round(X), Math.round(Y), 98) > 0.988) return { ramp: PAPER.cream, v: 0.9 };
      return { ramp: NIGHT, v: 0.25 + 0.3 * v };
    }
  });
  // 2. retro sunset with a perspective grid floor
  pad('pad2-sunset-grid', {
    W: 64, H: 58, edge: GRID, paint: (u, v) => {
      const X = u * 60 - 30, Y = v * 46, hz = 26;
      if (Y < hz) {
        const r = Math.hypot(X, Y - hz);
        if (r < 14 && !(Y > hz - 10 && Math.round(Y) % 3 === 0)) return { ramp: SUN, v: 0.95 - (Y / hz) * 0.5 };
        return { ramp: GRID, v: 0.12 + 0.4 * (Y / hz) };
      }
      const d = Y - hz, s = Math.sqrt(d * 2.2), t = X / (d + 3) * 2.4;
      const line = s - Math.floor(s) < 0.2 + 0.1 / (d + 1) || Math.abs(t - Math.round(t)) * (d + 3) / 2.4 < 0.5 || d < 0.6;
      return line ? { ramp: GRID, v: 0.92, noOutline: true } : { ramp: GRID, v: 0.18 };
    }
  });
  // 3. big cat face on a ginger pad
  pad('pad2-cat', {
    W: 62, H: 56, edge: POT.terracotta, rr: 7, paint: (u, v) => {
      const X = u * 58 - 29, Y = v * 44 - 24;
      const head = (X / 17) ** 2 + (Y / 13) ** 2 <= 1;
      const ear = s => { const ex = s * X - 11, ey = Y + 9; return ey <= 0 && ey >= -9 && Math.abs(ex) <= (9 + ey) * 0.55; };
      if (head || ear(1) || ear(-1)) {
        if ((ear(1) || ear(-1)) && !head && Math.abs(Math.abs(X) - 11) < (9 + Y + 9) * 0.25) return { ramp: PAPER.pink, v: 0.6 };
        if (Math.abs(Math.abs(X) - 7) < 1.6 && Math.abs(Y + 1) < 2.2) return { ramp: IRON, fixed: 1 };
        if (Math.abs(Math.abs(X) - 6.4) < 0.6 && Math.abs(Y + 2) < 0.6) return { ramp: CREAM, fixed: 6 };
        if (Math.abs(X) < 1.6 && Y > 2 && Y < 3.6) return { ramp: PAPER.pink, fixed: 3 };
        if (Y > 4 && Y < 5.2 && Math.abs(Math.abs(X) - 1.5) < 1.2) return { ramp: IRON, fixed: 1 };
        if (Y > 2 && Y < 3 && Math.abs(X) > 9 && Math.abs(X) < 15) return { ramp: IRON, fixed: 2 };
        return { ramp: CREAM, v: 0.72 - 0.15 * (Y / 13) };
      }
      const stripe = Math.round(u * 58 + v * 44) % 8 < 4;
      return { ramp: PAPER.orange, v: stripe ? 0.55 : 0.47 };
    }
  });
  // 4. topographic map: contour lines and a lake
  pad('pad2-topo', {
    W: 66, H: 56, edge: COCOA, rr: 3, paint: (u, v, x, y) => {
      const h = vnoise(u * 60, v * 46, 99, 16) * 0.8 + vnoise(u * 60, v * 46, 100, 9) * 0.2;
      if (h < 0.3) return { ramp: BOOK.teal, v: 0.45 + (h > 0.27 ? 0.25 : 0) };
      const band = h * 14, f = band - Math.floor(band);
      if (f < 0.16) return { ramp: COCOA, fixed: 3, noOutline: true };
      return { ramp: h > 0.62 ? SAND : TOPO, fixed: Math.min(6, 2 + Math.floor(band) % 4) };
    }
  });
  // 5. round pad: a vinyl record with an orange label
  pad('pad2-record', {
    W: 58, H: 52, shape: 'round', edge: VINYL, paint: (u, v, x, y) => {
      const X = x + 0.5 - 29, Y = (y - 23.5) * (29 / 22.5), r = Math.hypot(X, Y);
      if (r < 1.2) return { ramp: VINYL, fixed: 0 };
      if (r < 9) return { ramp: PAPER.orange, v: 0.62 + (r > 7.6 ? -0.15 : 0) + (Math.abs(Y + 3) < 0.8 && Math.abs(X) < 5 ? 0.25 : 0) };
      const shine = Math.max(0, Math.cos(Math.atan2(Y, X) * 2 + 2.4)) ** 6 * 0.4;
      return { ramp: VINYL, v: 0.3 + (Math.round(r) % 2 ? 0.06 : 0) + shine };
    }
  });
  // 6. pad with a padded gel wrist rest along the front
  pad('pad2-wrist', {
    W: 64, H: 62, edge: SLATE, paint: (u, v) => {
      const X = u * 60, Y = v * 52;
      const ring = Math.abs(Math.hypot(X - 30, Y - 20) - 12);
      if (ring < 0.8 || Math.abs(Math.hypot(X - 30, Y - 20) - 7) < 0.6) return { ramp: GLAZE.crt, v: 0.8, noOutline: true };
      if (Math.hypot(X - 30, Y - 20) < 2) return { ramp: GLAZE.crt, v: 0.95, noOutline: true };
      return { ramp: SLATE, v: 0.32 };
    },
    wrist: (cv, { W, yb, lx, rx }) => {
      const y0 = yb - 13;
      for (let y = y0; y <= yb + 1; y++) for (let x = 0; x < W; x++) {
        const a = lx(y) + 3, b = rx(y) - 3; if (x < a || x > b) continue;
        const t = (y - y0) / (yb + 1 - y0), ny = t * 2 - 1, ex = x < a + 4 ? -(a + 4 - x) / 4 : x > b - 4 ? (x - (b - 4)) / 4 : 0;
        if (ex * ex + 0.3 * ny * ny > 1) continue;
        const n = norm([ex, ny * 0.95, Math.sqrt(Math.max(0.05, 1 - ny * ny * 0.9))]);
        cv.put(x, y, { ramp: GLAZE.forest, v: light(n, { amb: 0.25, spec: 1.1, shin: 30 }), z: 2, part: 'gel' });
      }
    }
  });
};
