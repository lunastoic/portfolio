/**
 * Projective mapping of a w×h rectangle onto an arbitrary quadrilateral,
 * expressed as a CSS matrix3d(). Used to lay the flat LUNA OS screen onto
 * the angled CRT glass in the photo.
 */
export type Pt = [number, number];
export interface Quad {
  tl: Pt;
  tr: Pt;
  br: Pt;
  bl: Pt;
}

type M3 = [number, number, number, number, number, number, number, number, number];

function adjugate(m: M3): M3 {
  return [
    m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
    m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
    m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3],
  ];
}

function multiply(a: M3, b: M3): M3 {
  const out = new Array(9).fill(0) as M3;
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      out[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return out;
}

/** Matrix taking the basis square to the four points (order: p1, p2, p3 with p4 as the "sum" corner). */
function basisToPoints([x1, y1]: Pt, [x2, y2]: Pt, [x3, y3]: Pt, [x4, y4]: Pt): M3 {
  const m: M3 = [x1, x2, x3, y1, y2, y3, 1, 1, 1];
  const a = adjugate(m);
  const v = [
    a[0] * x4 + a[1] * y4 + a[2],
    a[3] * x4 + a[4] * y4 + a[5],
    a[6] * x4 + a[7] * y4 + a[8],
  ];
  return multiply(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]);
}

/** CSS transform that maps the rectangle (0,0)-(w,h) onto `quad`. Apply with transform-origin 0 0. */
export function quadMatrix3d(w: number, h: number, quad: Quad): string {
  const src = basisToPoints([0, 0], [w, 0], [0, h], [w, h]);
  const dst = basisToPoints(quad.tl, quad.tr, quad.bl, quad.br);
  const t = multiply(dst, adjugate(src)).map((v, _, arr) => v / arr[8]);
  const m = [
    t[0], t[3], 0, t[6],
    t[1], t[4], 0, t[7],
    0, 0, 1, 0,
    t[2], t[5], 0, t[8],
  ];
  return `matrix3d(${m.map((v) => v.toFixed(6)).join(",")})`;
}
