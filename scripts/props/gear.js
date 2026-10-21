// Cameras, skate decks and lamps, second set: new shapes, all standing straight.
module.exports = core => {
  const { Cv, render, light, norm, hash, shadowEllipse, GLAZE, GOLD, PAPER, CHROME, IRON, LEATHER, LENS, MAPLE, BOOK, POT, WOOD } = core;
  const SKY = ['#0a1020', '#16243e', '#20365a', '#2c4a76', '#3e6496', '#5a86b8', '#9cc4e8'];
  const MINT = ['#0e2018', '#1e4434', '#2e664e', '#3e8466', '#58a280', '#80c4a0', '#c4ecd4'];
  const RED = ['#2a0606', '#5e1010', '#8a1c18', '#b02a22', '#d0402e', '#e8684a', '#f8a888'];
  const LIQ = ['#1a0614', '#3e0c2e', '#5e1446', '#7e1e5c', '#a02c70', '#c84a8a', '#f08ab8'];
  const WAX = ['#3a1004', '#8a3010', '#c4501c', '#e8742a', '#f89a3e', '#fcc062', '#fff0b0'];
  const OPAL = ['#3a2a18', '#7a6448', '#b09a78', '#d8c4a0', '#ecdcbc', '#f8eed6', '#fffaf0'];
  const leather = (x, y) => hash(x, y, 52) > 0.72 ? 0.1 : hash(x, y, 53) > 0.8 ? -0.08 : 0;

  // rounded box with bevelled edges; `ramp` may be a function of (x, y)
  function box(cv, x0, y0, x1, y1, ramp, { r = 2, z = 1, part = 'box', amb = 0.3, spec = 0.4, shin = 16, bev = 2, tex = null, vmul = 1, voff = 0 } = {}) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (r) { const dx = Math.max(x0 + r - x, 0, x - (x1 - r)), dy = Math.max(y0 + r - y, 0, y - (y1 - r)); if (dx * dx + dy * dy > r * r + 0.5) continue; }
      const ex = x < x0 + bev ? -(x0 + bev - x) / bev : x > x1 - bev ? (x - (x1 - bev)) / bev : 0;
      const ey = y < y0 + bev ? -(y0 + bev - y) / bev : y > y1 - bev ? (y - (y1 - bev)) / bev : 0;
      const v = light(norm([ex * 0.9, ey * 0.9, 1]), { amb, spec, shin }) * vmul + voff + (tex ? tex(x, y) : 0);
      cv.put(x, y, { ramp: typeof ramp === 'function' ? ramp(x, y) : ramp, v, z, part });
    }
  }
  // lens: rings from the outside in ([outer fraction, ramp, kind]), glass inside the last one
  function lens(cv, cx, cy, R, rings, { z = 2, part = 'lens', glass = LENS } = {}) {
    const gF = rings[rings.length - 1][3] ?? 0.4;
    for (let y = Math.floor(cy - R - 1); y <= cy + R + 1; y++) for (let x = Math.floor(cx - R - 1); x <= cx + R + 1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy), f = d / R, a = Math.atan2(dy, dx);
      if (f > 1) continue;
      let k = -1; for (let i = 0; i < rings.length; i++) if (f <= rings[i][0]) k = i;
      const gR = R * gF;
      if (d <= gR) {
        const q = d / gR, gl = norm([dx / gR, dy / gR, Math.sqrt(Math.max(0, 1 - q * q)) + 0.2]);
        let v = light(gl, { amb: 0.15, spec: 1.6, shin: 40 }) * 0.8;
        if (Math.abs(q - 0.62) < 0.1 && dx > 0 && dy > 0) v = 0.55;
        cv.put(x, y, { ramp: glass, v, z: z + 0.4, part: part + 'g', noOutline: q < 0.85 });
        continue;
      }
      const [, ramp, kind] = rings[k], zz = z + k * 0.05;
      const rim = norm([dx / R, dy / R, 1]);
      if (kind === 'rim') cv.put(x, y, { ramp, v: light(rim, { amb: 0.3, spec: 1, shin: 24 }), z: zz, part: part + k });
      else if (kind === 'knurl') cv.put(x, y, { ramp, v: light(rim, { amb: 0.3, spec: 0.6, shin: 16 }) + (Math.cos(a * 22) > 0.2 ? 0.12 : -0.08), z: zz, part: part + k });
      else if (kind === 'trim') cv.put(x, y, { ramp, v: light(norm([-dx / R, -dy / R, 1]), { amb: 0.3, spec: 0.9, shin: 20 }), z: zz, part: part + k });
      else { const txt = Math.abs(a + 2.2) < 0.9 && hash(x, y, 54) > 0.45; cv.put(x, y, { ramp, v: txt ? 0.85 : 0.12, z: zz, part: part + k, noOutline: txt }); }
    }
    cv.put(Math.round(cx - gF * R * 0.45) - 1, Math.round(cy - gF * R * 0.55) - 1, { col: '#fbf6ea', z: z + 1, part: part + 'g' });
  }
  function knob(cv, xa, xb, ya, yb, ramp, { knurl = false, z = 0.9, part = 'knob' } = {}) {
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      const nx = ((x - xa) + 0.5) / (xb - xa + 1) * 2 - 1;
      let v = light(norm([nx, y === ya ? -0.8 : 0, 1]), { amb: 0.3, spec: 0.9, shin: 22 });
      if (knurl && y > ya && (x - xa) % 2 === 1) v -= 0.18;
      cv.put(x, y, { ramp, v, z, part });
    }
  }
  function win(cv, xa, xb, ya, yb, { ramp = LENS, z = 1.2, part = 'win', fresnel = false } = {}) {
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      let v = fresnel ? ((y - ya) % 2 ? 0.7 : 0.92) - 0.06 * ((x - xa) / Math.max(1, xb - xa))
        : 0.3 + 0.25 * (1 - (y - ya) / Math.max(1, yb - ya)) - 0.1 * ((x - xa) / Math.max(1, xb - xa));
      if (!fresnel && x - xa + (y - ya) === 2) v = 0.95;
      cv.put(x, y, { ramp, v, z, part });
    }
  }
  const dots = (cv, pts, ramp, fixed, z = 1.3, part = 'mark') => pts.forEach(([x, y]) => cv.put(x, y, { ramp, fixed, z, part, noOutline: true }));

  // ---------- CAMERAS ----------
  function instant() {
    // a boxy instant camera; the last shot is half out of the slot on top
    const cv = new Cv(72, 62);
    shadowEllipse(cv, 38, 57, 33, 3);
    for (let y = 3; y <= 18; y++) for (let x = 24; x <= 47; x++) {
      const img = x >= 26 && x <= 45 && y >= 5 && y <= 18;
      if (!img) { cv.put(x, y, { ramp: PAPER.cream, v: 0.78 - 0.05 * (y - 3) / 15, z: 0.5, part: 'photo' }); continue; }
      let ramp = SKY, v = 0.25 + 0.35 * (y - 5) / 13;
      if (Math.hypot(x - 41, y - 8) <= 2.2) { ramp = PAPER.amber; v = 0.85; }
      if (y > 13 - Math.min(Math.abs(x - 31), 6) * 0.8 + (x > 37 ? 2 : 0)) { ramp = GLAZE.dusk; v = 0.2; }
      cv.put(x, y, { ramp, v, z: 0.6, part: 'photo', noOutline: true });
    }
    box(cv, 6, 18, 65, 55, PAPER.cream, { r: 5, bev: 3, spec: 0.5, part: 'body' });
    for (let x = 22; x <= 49; x++) cv.put(x, 18, { ramp: IRON, fixed: 1, z: 1.1, part: 'slot' });
    const bands = [RED, PAPER.orange, PAPER.amber, MINT, SKY, GLAZE.dusk];
    for (let y = 19; y <= 54; y++) bands.forEach((rp, i) => { const c = cv.get(12 + i, y); if (c) cv.put(12 + i, y, { ramp: rp, v: Math.min(0.75, c.v * 0.6 + 0.3), z: 1.05, part: 'body', noOutline: true }); });
    win(cv, 52, 60, 22, 27, { part: 'vf' });
    box(cv, 51, 30, 61, 37, CHROME, { r: 1, bev: 1, z: 1.2, part: 'flashrim' });
    win(cv, 53, 59, 32, 35, { ramp: OPAL, fresnel: true, z: 1.3, part: 'flash' });
    lens(cv, 36, 38, 13, [[1, PAPER.cream, 'rim'], [0.8, IRON, 'knurl'], [0.6, CHROME, 'trim'], [0.52, IRON, 'text', 0.38]]);
    for (let y = 44; y <= 48; y++) for (let x = 55; x <= 59; x++) if (Math.hypot(x - 57, y - 46) <= 2.6) cv.put(x, y, { ramp: RED, v: light(norm([(x - 57) / 3, (y - 46) / 3, 1]), { spec: 1.2, shin: 26 }), z: 1.4, part: 'btn' });
    for (const x of [4, 5, 66, 67]) for (const y of [24, 25]) cv.put(x, y, { ramp: CHROME, v: 0.6, z: 0.8, part: 'lug' });
    render(cv, 'cam2-instant', { scale: 5 });
  }
  function tlr() {
    // twin-lens reflex: tall box, finder hood on top, viewing lens over taking lens
    const cv = new Cv(56, 78);
    shadowEllipse(cv, 30, 74, 22, 3);
    box(cv, 16, 5, 39, 9, IRON, { r: 0, bev: 1, vmul: 0.7, part: 'hoodback' });
    box(cv, 14, 9, 41, 22, IRON, { r: 1, bev: 1, spec: 0.6, part: 'hood' });
    for (let y = 10; y <= 21; y++) for (const x of [17, 38]) { const c = cv.get(x, y); if (c) cv.put(x, y, { ...c, v: c.v - 0.15, z: 1.01 }); }
    box(cv, 24, 13, 31, 16, CHROME, { r: 0, bev: 1, z: 1.1, part: 'badge' });
    box(cv, 10, 22, 45, 72, LEATHER.black, { r: 2, bev: 2, tex: leather, spec: 0.25, part: 'body' });
    box(cv, 15, 26, 40, 68, CHROME, { r: 2, bev: 1, spec: 0.9, shin: 20, z: 1.5, part: 'plate' });
    lens(cv, 28, 36, 8.5, [[1, CHROME, 'rim'], [0.8, IRON, 'text', 0.55]], { part: 'view' });
    lens(cv, 28, 57, 9.5, [[1, IRON, 'knurl'], [0.72, CHROME, 'trim'], [0.62, IRON, 'text', 0.48]], { part: 'take' });
    box(cv, 18, 45, 37, 47, IRON, { r: 0, bev: 1, z: 1.6, part: 'name' });
    dots(cv, [[21, 46], [23, 46], [24, 46], [26, 46], [28, 46], [29, 46], [31, 46], [33, 46], [34, 46]], PAPER.cream, 4, 1.7);
    knob(cv, 6, 9, 40, 50, CHROME, { knurl: true, part: 'focus' });
    knob(cv, 46, 49, 41, 47, CHROME, { part: 'crank' });
    box(cv, 48, 43, 52, 45, CHROME, { r: 0, bev: 1, z: 1, part: 'handle' });
    for (const x of [8, 9, 46, 47]) for (const y of [27, 28]) cv.put(x, y, { ramp: CHROME, v: 0.6, z: 0.8, part: 'lug' });
    render(cv, 'cam2-tlr', { scale: 5 });
  }
  function slr() {
    // chunky 35mm SLR: prism hump, big lens, grip on the right
    const cv = new Cv(80, 64), cx = 40;
    shadowEllipse(cv, 43, 59, 36, 3);
    box(cv, 5, 22, 74, 53, (x, y) => y <= 29 || y >= 52 ? CHROME : LEATHER.black, { r: 3, bev: 3, tex: (x, y) => y > 29 && y < 52 ? leather(x, y) : (hash(0, y, 51) - 0.5) * 0.05, spec: 0.6, part: 'body' });
    for (let x = 5; x <= 74; x++) { const c = cv.get(x, 29); if (c) cv.put(x, 29, { ...c, v: c.v - 0.25, z: 1.01 }); }
    for (let y = 8; y <= 22; y++) {
      const hw = 9 + (y - 8) * 0.55;
      for (let x = Math.round(cx - hw); x < Math.round(cx + hw); x++) {
        const nx = (x + 0.5 - cx) / hw, face = y >= 13 && y <= 20 && Math.abs(nx) < 0.72;
        const v = light(norm([nx * 0.8, y === 8 ? -1 : -0.45, 1]), { amb: 0.3, spec: 0.9, shin: 22 });
        cv.put(x, y, { ramp: face ? IRON : CHROME, v: face ? v * 0.7 : v, z: 1.2, part: face ? 'prismface' : 'prism' });
      }
    }
    dots(cv, [[35, 16], [36, 16], [38, 16], [40, 16], [41, 16], [43, 16], [44, 16]], CHROME, 5, 1.3);
    knob(cv, 10, 18, 16, 21, CHROME, { knurl: true, part: 'rew' });
    knob(cv, 61, 69, 15, 21, CHROME, { knurl: true, part: 'dial' });
    knob(cv, 56, 58, 18, 21, CHROME, { part: 'btn' });
    box(cv, 63, 31, 73, 52, LEATHER.black, { r: 3, bev: 3, tex: leather, voff: 0.06, z: 1.1, part: 'grip' });
    for (let y = 33; y <= 37; y++) for (let x = 15; x <= 17; x++) cv.put(x, y, { ramp: CHROME, v: light(norm([(x - 16) * 0.7, 0, 1]), { spec: 1, shin: 20 }), z: 1.3, part: 'timer' });
    for (let y = 22; y <= 58; y++) for (let x = 22; x <= 58; x++) if (Math.hypot(x + 0.5 - cx - 1.5, y + 0.5 - 40 - 1.5) <= 18.5 && cv.get(x, y)) { const c = cv.get(x, y); cv.put(x, y, { ...c, v: c.v * 0.78 }); }
    lens(cv, cx, 40, 17, [[1, CHROME, 'rim'], [0.88, IRON, 'knurl'], [0.66, CHROME, 'trim'], [0.6, IRON, 'text', 0.44]]);
    render(cv, 'cam2-slr', { scale: 5 });
  }
  function compact() {
    // pocket point-and-shoot in glossy teal plastic
    const cv = new Cv(64, 46);
    shadowEllipse(cv, 34, 42, 28, 2.6);
    knob(cv, 46, 52, 9, 11, CHROME, { part: 'btn' });
    knob(cv, 12, 18, 10, 11, IRON, { part: 'slide' });
    box(cv, 4, 12, 59, 39, BOOK.teal, { r: 6, bev: 4, spec: 0.8, shin: 26, part: 'body' });
    for (let y = 22; y <= 35; y++) for (const x of [6, 8]) { const c = cv.get(x, y); if (c) cv.put(x, y, { ...c, v: c.v - 0.2, z: 1.01 }); }
    box(cv, 7, 14, 20, 20, IRON, { r: 1, bev: 1, z: 1.1, part: 'flashrim' });
    win(cv, 8, 19, 15, 19, { ramp: OPAL, fresnel: true, part: 'flash' });
    win(cv, 23, 28, 15, 19, { part: 'vf' });
    win(cv, 47, 50, 15, 17, { ramp: RED, part: 'af' });
    dots(cv, [[9, 23], [10, 23], [12, 23], [13, 23], [14, 23], [16, 23]], PAPER.cream, 5);
    lens(cv, 38, 27, 10.5, [[1, CHROME, 'rim'], [0.78, IRON, 'knurl'], [0.6, CHROME, 'trim'], [0.52, IRON, 'text', 0.4]]);
    render(cv, 'cam2-compact', { scale: 5 });
  }
  function toy() {
    // plastic toy camera: red body, viewfinder bump, chunky ribbed lens
    const cv = new Cv(64, 62);
    shadowEllipse(cv, 34, 57, 28, 3);
    knob(cv, 28, 35, 9, 11, CHROME, { part: 'shoe' });
    box(cv, 22, 11, 41, 19, IRON, { r: 2, bev: 2, spec: 0.7, part: 'bump' });
    win(cv, 25, 29, 13, 16, { part: 'vf' });
    knob(cv, 47, 51, 14, 17, CHROME, { part: 'btn' });
    box(cv, 5, 18, 58, 52, RED, { r: 5, bev: 3, spec: 0.9, shin: 28, part: 'body' });
    box(cv, 10, 22, 53, 24, IRON, { r: 0, bev: 1, z: 1.1, vmul: 0.8, part: 'band' });
    for (let y = 26; y <= 48; y++) for (let x = 6; x <= 8; x++) { const c = cv.get(x, y); if (c && (y % 3 === 0)) cv.put(x, y, { ...c, v: c.v - 0.2, z: 1.01 }); }
    lens(cv, 32, 37, 14.5, [[1, IRON, 'rim'], [0.86, PAPER.cream, 'knurl'], [0.66, IRON, 'trim'], [0.6, IRON, 'text', 0.42]]);
    render(cv, 'cam2-toy', { scale: 5 });
  }

  // ---------- SKATE DECKS ----------
  const DW = 150, DH = 50, CY = 25;
  function deck(name, { x0 = 4, x1 = 145, half, cut = null, paint, bolts, brackets = [44, 102], grip = false }) {
    const cv = new Cv(DW, DH);
    const inside = (x, y, s = 0) => Math.abs(y + 0.5 - CY) <= half(x + 0.5) - s && !(cut && cut(x + 0.5, y + 0.5, s));
    for (let x = 0; x < DW; x++) for (let y = 0; y < DH; y++) {
      if (!inside(x, y)) continue;
      const ny = (y + 0.5 - CY) / 16;
      const tl = x < x0 + 22 ? (x0 + 22 - x) / 22 : x > x1 - 22 ? -(x - (x1 - 22)) / 22 : 0;
      const n = norm([tl * 0.45, ny * 0.45, 1]);
      if (!inside(x, y, 2)) {
        cv.put(x, y, { ramp: MAPLE, v: light(norm([tl * 0.75 - 0.2 * Math.sign(x - 75), ny * 1.4, 0.8]), { amb: 0.35, spec: 0.4, shin: 12 }) + 0.08, z: 1, part: 'deck' });
        continue;
      }
      const base = light(n, { amb: 0.28, spec: 0.35, shin: 14 }) + (hash(x, y, 61) - 0.5) * 0.05;
      const p = paint(x - 75, y - CY, base, x, y);
      cv.put(x, y, { ramp: p.ramp, v: p.v, fixed: p.fixed ?? null, z: 1, part: 'deck', noOutline: p.fixed != null });
    }
    for (const bx of bolts) for (const by of [CY - 4, CY + 3]) {
      if (grip) { cv.put(bx, by, { ramp: CHROME, v: 0.8, z: 1.5, part: 'bolt', noOutline: true }); continue; }
      cv.put(bx, by, { ramp: CHROME, v: 0.85, z: 1.5, part: 'bolt', noOutline: true });
      cv.put(bx + 1, by + 1, { ramp: IRON, fixed: 0, z: 1.4, part: 'deck', noOutline: true });
    }
    for (const bx of brackets) {
      let h = 0; for (let x = bx; x < bx + 6; x++) h = Math.max(h, half(x + 0.5));
      const top = Math.round(CY - h), bot = Math.round(CY + h) - 1;
      for (const [ya, yb] of [[top - 3, top + 2], [bot - 2, bot + 3]]) for (let y = ya; y <= yb; y++) for (let x = bx; x < bx + 6; x++) {
        const nx = ((x - bx) + 0.5) / 6 * 2 - 1;
        let v = light(norm([nx * 0.8, (y === ya ? -0.6 : y === yb ? 0.6 : 0), 1]), { amb: 0.3, spec: 0.9, shin: 22 });
        if (x === bx + 2 && y === (ya + yb >> 1)) v = 0.95;
        cv.put(x, y, { ramp: IRON, v, z: 2, part: 'bracket' });
      }
    }
    render(cv, name, { scale: 5 });
  }
  const ellCap = (x, a, b, hh, cap) => x < a + cap ? hh * Math.sqrt(Math.max(0, 1 - ((a + cap - x) / cap) ** 2)) : x > b - cap ? hh * Math.sqrt(Math.max(0, 1 - ((x - (b - cap)) / cap) ** 2)) : hh;
  const sqCap = (x, a, b, hh, r) => { const d = x < a + r ? a + r - x : x > b - r ? x - (b - r) : 0; return d > r ? 0 : d ? hh - r + Math.sqrt(r * r - d * d) : hh; };
  const dist = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))); return [Math.hypot(px - ax - t * dx, py - ay - t * dy), t]; };

  function decks() {
    // old school: wide squared nose on the left, narrow round tail, a big cat face
    deck('deck2-oldschool-cat', {
      half: x => {
        const t = (x - 4) / 141, base = t < 0.35 ? 16 : 16 - (t - 0.35) / 0.65 * 5.5;
        if (x < 4 + 7) return sqCap(x, 4, 400, base, 7);
        if (x > 145 - 14) return base * Math.sqrt(Math.max(0, 1 - ((x - (145 - 14)) / 14) ** 2));
        return base;
      },
      bolts: [24, 30, 118, 124],
      paint: (X, Y, v) => {
        const hx = -28, hy = 2, head = ((X - hx) / 13) ** 2 + ((Y - hy) / 10) ** 2 <= 1;
        const ear = s => { const ex = (X - hx) * s - 8, ey = Y - hy + 7; return ey <= 0 && ey >= -7 && Math.abs(ex) <= (ey + 7) * 0.5; };
        if (head || ear(1) || ear(-1)) {
          if (Math.abs(Math.abs(X - hx) - 5) <= 1 && (Y === hy - 2 || Y === hy - 1)) return { ramp: IRON, fixed: Math.abs(X - hx) === 4 && Y === hy - 2 ? 5 : 1 };
          if (Math.abs(X - hx) <= 1 && Y === hy + 2) return { ramp: PAPER.pink, fixed: 4 };
          if ((X - hx === -2 || X - hx === 2) && Y === hy + 4 || (X - hx === -1 || X - hx === 1) && Y === hy + 5) return { ramp: IRON, fixed: 1 };
          if (ear(1) && Math.abs((X - hx) - 8) <= (Y - hy + 7) * 0.25 && Y - hy + 7 < -1.5) return { ramp: PAPER.pink, v: 0.6 };
          if (ear(-1) && Math.abs(-(X - hx) - 8) <= (Y - hy + 7) * 0.25 && Y - hy + 7 < -1.5) return { ramp: PAPER.pink, v: 0.6 };
          return { ramp: PAPER.cream, v: 0.55 + v * 0.3 };
        }
        if ((Y === hy + 2 || Y === hy + 5) && Math.abs(X - hx) >= 15 && Math.abs(X - hx) <= 21) return { ramp: PAPER.cream, v: 0.7 };
        if ((Y === -6 || Y === 5) && X > 4 && X < 50) return { ramp: PAPER.amber, v: 0.7 };
        return { ramp: POT.terracotta, v };
      }
    });
    // cruiser with a fishtail; a curling wave under a sun
    deck('deck2-fishtail-wave', {
      half: x => {
        if (x < 4 + 34) return 14 * Math.pow(Math.max(0, 1 - ((4 + 34 - x) / 34) ** 2), 0.55);
        const fl = x > 110 ? 14 + (x - 110) / 35 * 2.5 : 14;
        return x > 145 - 4 ? sqCap(x, -400, 145, fl, 4) : fl;
      },
      cut: (x, y, s) => x > 145 - 15 && Math.abs(y - CY) < (x - (145 - 15)) * 0.8 + s - 0.5,
      bolts: [26, 32, 114, 120],
      paint: (X, Y, v) => {
        // two rows of waves, the near one darker, foam riding each crest
        const back = -2 + 3 * Math.sin(X * 0.16 + 1.2), front = 4 + 3 * Math.sin(X * 0.13 - 0.4);
        if (Y >= front) {
          if (Y - front < 1.1) return { ramp: PAPER.cream, v: 0.95 };
          if (Math.abs(Y - front - 3.5) < 0.6 && (X % 3 === 0)) return { ramp: PAPER.cream, v: 0.75 };
          return { ramp: SKY, v: 0.22 + v * 0.12 };
        }
        if (Y >= back) {
          if (Y - back < 1.1) return { ramp: PAPER.cream, v: 0.9 };
          return { ramp: SKY, v: 0.45 + v * 0.12 };
        }
        if (Math.hypot(X - 26, Y + 6) <= 5) return { ramp: PAPER.amber, v: 0.8 };
        if ((Y === -9 && X % 5 === 0 && X < 10) || (Y === -7 && (X + 2) % 7 === 0 && X < 0)) return { ramp: SKY, v: 0.4 };
        return { ramp: PAPER.cream, v: v * 0.55 + 0.28 };
      }
    });
    // stadium popsicle in black, flames licking forward from the tail
    deck('deck2-popsicle-flames', {
      half: x => ellCap(x, 4, 145, 15, 15),
      bolts: [24, 30, 119, 125],
      paint: (X, Y, v, x) => {
        const d = 145 - x, L = 50 + 16 * Math.abs(Math.sin(Y * 0.5 + 1)) + 7 * Math.sin(Y * 1.3);
        if (d < L) { const k = d / L; return k > 0.82 ? { ramp: BOOK.rust, v: 0.45 + v * 0.2 } : k > 0.5 ? { ramp: PAPER.orange, v: 0.6 } : { ramp: PAPER.amber, v: 0.62 + 0.25 * (1 - k) }; }
        return { ramp: IRON, v: v * 0.8 };
      }
    });
    // narrow street popsicle, a lightning bolt end to end
    deck('deck2-street-bolt', {
      half: x => ellCap(x, 4, 145, 13, 26),
      bolts: [26, 32, 117, 123],
      paint: (X, Y, v) => {
        const P = [[-60, -1], [-18, -6], [-12, 1], [14, -5], [20, 3], [60, -1]];
        const lens_ = P.slice(1).map((p, i) => Math.hypot(p[0] - P[i][0], p[1] - P[i][1])), tot = lens_.reduce((a, b) => a + b);
        let best = 99, at = 0, acc = 0;
        for (let i = 0; i < P.length - 1; i++) { const [d, t] = dist(X, Y, ...P[i], ...P[i + 1]); if (d < best) { best = d; at = (acc + t * lens_[i]) / tot; } acc += lens_[i]; }
        const th = 0.8 + 3.2 * Math.sin(Math.PI * at);
        if (best < th) return { ramp: PAPER.amber, v: 0.6 + 0.25 * (Y < 0 ? 1 : 0.5) };
        if (best < th + 1) return { ramp: GLAZE.dusk, fixed: 0 };
        if ([[-40, 6], [-22, -9], [30, -5], [46, 9], [8, 9], [-52, 4]].some(([sx, sy]) => sx === X && sy === Y)) return { ramp: PAPER.cream, v: 0.9 };
        return { ramp: GLAZE.dusk, v };
      }
    });
    // grip side out: black grip with a moon and two bars cut through to the maple
    deck('deck2-grip-cutout', {
      half: x => ellCap(x, 4, 145, 15, 20),
      grip: true,
      bolts: [24, 30, 119, 125],
      paint: (X, Y, v, x, y) => {
        const moon = Math.hypot(X, Y) <= 9 && Math.hypot(X + 4, Y - 3) > 7.5;
        const bars = (Math.abs(Y) <= 1 || Math.abs(Y - 5) <= 0 || Math.abs(Y + 5) <= 0) && Math.abs(X) >= 16 && Math.abs(X) <= 44;
        if (moon || bars) return { ramp: MAPLE, v: 0.45 + v * 0.3 };
        return { ramp: IRON, v: 0.18 + hash(x, y, 91) * 0.22 + (hash(x, y, 92) > 0.93 ? 0.25 : 0) };
      }
    });
    // short cruiser: round nose, squared kick tail, a palm against the sunset
    deck('deck2-mini-palm', {
      x0: 22, x1: 127,
      half: x => x < 22 + 20 ? ellCap(x, 22, 9999, 15, 20) : x > 127 - 6 ? sqCap(x, -400, 127, 14, 6) : 15 - Math.max(0, (x - 90) / 37),
      bolts: [38, 44, 105, 111],
      brackets: [48, 96],
      paint: (X, Y, v) => {
        const tX = -22;
        if (Y >= 9 - Math.max(0, 6 - Math.abs(X - tX) * 0.35)) return { ramp: GLAZE.dusk, v: 0.12 };
        if (Math.abs(X - tX) <= 1 && Y >= -8) return { ramp: GLAZE.dusk, v: (Y % 3 === 0 ? 0.08 : 0.16) };
        for (const [dir, len, lift] of [[-1, 13, 3], [1, 13, 3], [-1, 10, 6], [1, 10, 6], [-1, 6, 7], [1, 6, 7]]) {
          for (let t = 0; t <= 1; t += 0.04) {
            const fx = tX + dir * len * t, fy = -9 - lift * Math.sin(Math.PI * t * 0.7) + 7 * t * t;
            if (Math.hypot(X - fx, Y - fy) < 1.1 - t * 0.3) return { ramp: GLAZE.dusk, v: 0.14 };
          }
        }
        const sr = Math.hypot(X - 14, Y - 6);
        if (sr <= 11 && Y <= 6 && !(Y > -2 && (Y + 6) % 3 === 0)) return { ramp: PAPER.amber, v: 0.7 + 0.05 * (-Y / 11) };
        return Y < -8 ? { ramp: GLAZE.dusk, v: 0.42 + v * 0.15 } : Y < -2 ? { ramp: PAPER.pink, v: 0.45 + v * 0.15 } : { ramp: PAPER.orange, v: 0.5 + v * 0.15 };
      }
    });
  }

  // ---------- LAMPS ----------
  function pool(cv, cx, cy, rx, ry, col = '#ffe0a0') {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (e <= 1) cv.put(x, y, { col, a: e > 0.55 ? 0.12 : 0.22, z: -0.5, solid: false });
    }
  }
  // a turned solid: r(y) gives the half width, ramp(y, nx) the material
  function lathe(cv, cx, ya, yb, r, mat, { z = 1, part = 'lathe' } = {}) {
    for (let y = ya; y <= yb; y++) {
      const R = r(y); if (R <= 0) continue;
      const dr = (r(y + 1) - r(y - 1)) / 2;
      for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
        const nx = (x + 0.5 - cx) / R; if (Math.abs(nx) > 1) continue;
        const n = norm([nx, -dr * 0.9, Math.sqrt(1 - nx * nx)]);
        const m = mat(y, nx, n, x);
        if (m) cv.put(x, y, { z, part, ...m });
      }
    }
  }
  const metal = (ramp, extra = 0) => (y, nx, n) => ({ ramp, v: light(n, { amb: 0.3, spec: 1.1, shin: 26 }) + extra });

  function lava(on) {
    const cv = new Cv(44, 86), cx = 22;
    const gr = y => 6 + 4 * Math.sin(Math.PI * (y - 22) / 40);
    if (on) {
      pool(cv, cx, 81, 20, 4, '#ffb0d0');
      for (let y = 20; y <= 60; y++) for (let x = 0; x < 44; x++) { const d = Math.abs(x + 0.5 - cx) - gr(y); if (d > 0 && d < 4) cv.put(x, y, { col: '#ff8ac0', a: 0.2 - d * 0.04, z: -0.4, solid: false }); }
    }
    shadowEllipse(cv, cx + 2, 81, 15, 2.5);
    lathe(cv, cx, 9, 21, y => y < 10 ? 3 : 3 + (y - 10) * 0.32, metal(CHROME), { part: 'cap' });
    const blobs = [[cx - 1, 55, 5.5], [cx + 1.5, 44, 3.4], [cx - 2, 35, 2.6], [cx + 1.5, 27, 1.9], [cx - 0.5, 49, 2]];
    lathe(cv, cx, 22, 58, gr, (y, nx, n, x) => {
      const wax = blobs.some(([bx, by, br]) => Math.hypot(x + 0.5 - bx, (y + 0.5 - by) * 1.15) <= br);
      const sp = light(n, { amb: 0, spec: 1.4, shin: 40 }) > 0.75;
      if (sp && !wax) return { ramp: LIQ, v: on ? 1 : 0.8 };
      if (wax) return { ramp: WAX, v: on ? 0.62 + 0.3 * (1 - Math.abs(nx)) : 0.3 + 0.2 * (1 - Math.abs(nx)) };
      return { ramp: LIQ, v: on ? 0.42 + 0.3 * (1 - Math.abs(nx)) : 0.14 + 0.18 * (1 - Math.abs(nx)) };
    }, { z: 1.2, part: 'glass' });
    lathe(cv, cx, 59, 80, y => 7 + (y - 59) * 0.29, (y, nx, n) => ({ ramp: CHROME, v: light(n, { amb: 0.3, spec: 1.1, shin: 26 }) - (y >= 59 && y <= 60 || y >= 79 ? 0.25 : 0) + (on && y < 64 ? 0.12 : 0) }), { part: 'base' });
    render(cv, `lamp2-lava${on ? '' : '-off'}`, { scale: 5 });
  }
  function mushroom(on) {
    const cv = new Cv(64, 66), cx = 32;
    if (on) {
      pool(cv, cx, 60, 30, 4.5);
      for (let y = 3; y <= 33; y++) for (let x = 0; x < 64; x++) { const d = Math.hypot((x + 0.5 - cx) / 26, (y + 0.5 - 32) / 24); if (d > 1 && d < 1.17) cv.put(x, y, { col: '#ffd0a0', a: 0.22 - (d - 1) * 1.1, z: -0.4, solid: false }); }
    }
    shadowEllipse(cv, cx + 3, 60, 15, 2.4);
    for (let y = 54; y <= 61; y++) for (let x = cx - 13; x <= cx + 13; x++) {
      const dx = (x + 0.5 - cx) / 12.5, dy = y < 58 ? (y - 58) / 4 : (y - 58) / 2.5, e = dx * dx + dy * dy;
      if (e > 1) continue;
      cv.put(x, y, { ramp: OPAL, v: light(norm([dx, y < 58 ? dy : 0.6, Math.sqrt(Math.max(0, 1 - e)) + 0.3]), { amb: 0.3, spec: 0.8, shin: 20 }) + (on ? 0.12 : 0), z: 1, part: 'foot' });
    }
    lathe(cv, cx, 33, 56, y => 4 + (y - 33) * 0.06, (y, nx, n) => ({ ramp: OPAL, v: light(n, { amb: 0.3, spec: 0.7, shin: 20 }) + (on ? 0.25 * (1 - (y - 33) / 23) : -0.05) }), { z: 1.2, part: 'stem' });
    for (let y = 7; y <= 33; y++) for (let x = cx - 27; x <= cx + 27; x++) {
      const dx = (x + 0.5 - cx) / 26, dy = (y + 0.5 - 32) / 24, e = dx * dx + dy * dy;
      if (e > 1 || y > 32) continue;
      const n = norm([dx, dy * 0.9, Math.sqrt(1 - e) + 0.1]);
      let v = on ? 0.68 + 0.3 * (1 - e) : light(n, { amb: 0.2, spec: 1.3, shin: 32 }) * 0.82;
      if (y >= 31) v = on ? 0.98 : 0.18;
      cv.put(x, y, { ramp: y >= 31 && on ? OPAL : PAPER.orange, v, z: 2, part: 'shade' });
    }
    render(cv, `lamp2-mushroom${on ? '' : '-off'}`, { scale: 5 });
  }
  function globe(on) {
    const cv = new Cv(56, 72), cx = 28, cy = 27, R = 20;
    if (on) {
      pool(cv, cx, 66, 26, 4);
      for (let y = 0; y < 52; y++) for (let x = 0; x < 56; x++) { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - R; if (d > 0 && d < 5) cv.put(x, y, { col: '#ffe8b0', a: 0.22 - d * 0.04, z: -0.4, solid: false }); }
    }
    shadowEllipse(cv, cx + 3, 66, 16, 2.6);
    for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
      const dx = (x + 0.5 - cx) / R, dy = (y + 0.5 - cy) / R, e = dx * dx + dy * dy;
      if (e > 1) continue;
      const n = norm([dx, dy, Math.sqrt(1 - e)]);
      const v = on ? 0.6 + 0.38 * (1 - Math.sqrt(e)) + (light(n, { amb: 0, spec: 1.2, shin: 40 }) > 0.8 ? 0.1 : 0) : light(n, { amb: 0.25, spec: 1.1, shin: 36 }) * 0.9;
      cv.put(x, y, { ramp: OPAL, v, z: 1, part: 'globe' });
    }
    lathe(cv, cx, 45, 49, () => 7, metal(GOLD), { z: 1.5, part: 'collar' });
    lathe(cv, cx, 50, 64, y => y > 62 ? 13 - (y - 62) * 1.5 : 13, (y, nx, n, x) => ({ ramp: WOOD, v: light(n, { amb: 0.3, spec: 0.3, shin: 10 }) + 0.06 * Math.sin(x * 1.3 + Math.sin(y * 0.4) * 2) + (y === 50 ? 0.25 : 0) + (on && y < 53 ? 0.1 : 0) }), { z: 1.4, part: 'base' });
    render(cv, `lamp2-globe${on ? '' : '-off'}`, { scale: 5 });
  }
  function cone(on) {
    const cv = new Cv(60, 84), cx = 30;
    if (on) {
      for (let y = 34; y <= 79; y++) { const k = (y - 34) / 45, hw = 15 + 10 * k; for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) cv.put(x, y, { col: '#ffd98a', a: (0.15 - 0.07 * k) * (Math.abs(x - cx) / hw > 0.85 ? 0.5 : 1), z: -0.6, solid: false }); }
      pool(cv, cx, 79, 27, 4);
    }
    shadowEllipse(cv, cx + 3, 80, 18, 2.6);
    for (let y = 71; y <= 80; y++) for (let x = cx - 16; x <= cx + 16; x++) {
      const dx = (x + 0.5 - cx) / 15.5, top = y <= 75, dy = top ? (y - 75) / 4 : 0, e = dx * dx + dy * dy;
      if ((top && e > 1) || Math.abs(dx) > 1 || (!top && y > 77 + 2 * Math.sqrt(1 - dx * dx))) continue;
      const n = top ? norm([dx, dy, Math.sqrt(Math.max(0, 1 - e)) + 0.3]) : norm([dx, 0.3, Math.sqrt(1 - dx * dx)]);
      cv.put(x, y, { ramp: POT.terracotta, v: light(n, { amb: 0.3, spec: 1, shin: 26 }) - (top ? 0 : 0.15) + (on && top ? 0.1 : 0), z: 1, part: 'base' });
    }
    lathe(cv, cx, 30, 72, y => y >= 49 && y <= 51 ? 2.5 : 1.2, metal(CHROME), { z: 1.5, part: 'stem' });
    lathe(cv, cx, 8, 11, () => 1.6, metal(CHROME), { z: 2.2, part: 'finial' });
    lathe(cv, cx, 12, 33, y => y >= 32 ? 16 : 4 + (y - 12) * 0.6, (y, nx, n) => y >= 32
      ? { ramp: OPAL, v: on ? 0.98 : 0.55 - 0.2 * Math.abs(nx) }
      : { ramp: POT.terracotta, v: light(norm([nx, -0.5, Math.sqrt(1 - nx * nx)]), { amb: 0.25, spec: 1.2, shin: 30 }) }, { z: 2, part: 'shade' });
    render(cv, `lamp2-cone${on ? '' : '-off'}`, { scale: 5 });
  }
  function lantern(on) {
    const cv = new Cv(52, 74), cx = 26, cy = 34, rx = 18, ry = 22;
    if (on) {
      pool(cv, cx, 68, 24, 4);
      for (let y = 8; y < 60; y++) for (let x = 0; x < 52; x++) { const e = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry); if (e > 1 && e < 1.25 && Math.abs(y + 0.5 - cy) < ry * 0.85) cv.put(x, y, { col: '#ffd890', a: 0.22 - (e - 1) * 0.8, z: -0.4, solid: false }); }
    }
    shadowEllipse(cv, cx + 3, 68, 16, 2.4);
    for (const lx of [cx - 12, cx + 11]) for (let y = 62; y <= 67; y++) cv.put(lx, y, { ramp: WOOD, v: 0.4, z: 0.9, part: 'leg' + lx });
    lathe(cv, cx, 57, 61, () => 14, (y, nx, n, x) => ({ ramp: WOOD, v: light(n, { amb: 0.3, spec: 0.3, shin: 10 }) + (y === 57 ? 0.2 : 0) + 0.05 * Math.sin(x * 1.1) + (on && y < 59 ? 0.12 : 0) }), { part: 'stand' });
    for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, e = dx * dx + dy * dy;
      if (e > 1 || Math.abs(dy) > 0.86) continue;
      const n = norm([dx, dy, Math.sqrt(1 - e)]), rib = (y - cy + 40) % 4 === 0;
      let v = on ? 0.5 + 0.38 * (1 - e) : light(n, { amb: 0.3, spec: 0.25, shin: 12 }) + (hash(x, y, 77) - 0.5) * 0.05;
      if (rib) v -= on ? 0.22 : 0.18;
      cv.put(x, y, { ramp: on ? PAPER.amber : PAPER.cream, v, z: 1, part: 'paper' });
    }
    lathe(cv, cx, 11, 15, () => 7, (y, nx, n) => ({ ramp: WOOD, v: light(n, { amb: 0.3, spec: 0.4, shin: 12 }) + (y === 11 ? 0.2 : 0) }), { z: 1.5, part: 'cap' });
    lathe(cv, cx, 53, 56, () => 8, (y, nx, n) => ({ ramp: WOOD, v: light(n, { amb: 0.3, spec: 0.4, shin: 12 }) }), { z: 1.5, part: 'ring' });
    lathe(cv, cx, 8, 10, () => 1.5, metal(GOLD), { z: 1.6, part: 'loop' });
    render(cv, `lamp2-lantern${on ? '' : '-off'}`, { scale: 5 });
  }

  instant(); tlr(); slr(); compact(); toy();
  decks();
  for (const on of [true, false]) { lava(on); mushroom(on); globe(on); cone(on); lantern(on); }
};
