"use client";

import { useEffect, useRef, type CSSProperties } from "react";

/**
 * The lava lamp on the desk, drawn live on a small pixel canvas (one pixel of the room's drawing a pixel,
 * scripts/pixel-room.js) and scaled up crisp: the room's lamp, a silver cap and foot round a tapered pink glass. The wax is a handful of blobs that warm at the heater in the base,
 * rise, cool at the top and sink again, drawn as metaballs so they stretch, merge and pinch apart.
 * Switched off, the glow fades and the wax cools and slowly sinks into a lump at the bottom; switched
 * on, the glow comes back and, once the heater has warmed the wax, the blobs lift off again.
 */

const GW = 30;
const GH = 90;
const CX = 15.4;

// the shape, in canvas px: a cone cap, the glass widening down, the flared base
const CAP = [1, 15];
const GLASS = [16, 61];
const BASE = [62, 84];
const ss = (t: number) => {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** The glass's half width on row y: narrow at the top, widening down to the base. */
const glassR = (y: number) => {
  const t = (y - GLASS[0]) / (GLASS[1] - GLASS[0]);
  return lerp(4.2, 9, 0.75 * t + 0.25 * ss(t));
};
/** The whole silhouette's half width on row y (0 where there's nothing). */
const outerR = (y: number) => {
  if (y < CAP[0]) return 0;
  if (y <= CAP[1]) return lerp(2.8, 4.4, (y - CAP[0]) / (CAP[1] - CAP[0]));
  if (y <= GLASS[1]) return glassR(y);
  if (y <= BASE[1]) return lerp(9, 13.2, (y - BASE[0]) / (BASE[1] - BASE[0]));
  return 0;
};

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
// the room's ramps (scripts/desk-room.js), dark to light: the silver metal; the liquid and the wax, each from its
// switched-off tones up to its lit ones
const METAL = ["#30303a", "#53535f", "#82828e", "#b0b0bc", "#e4e4ec"].map(hex);
const LIQ = ["#26121f", "#422236", "#6a1048", "#a02670", "#c8388e", "#e85cae", "#ff9ed4"].map(hex);
const WAX = ["#3a1f12", "#5c341e", "#8a3a10", "#d0661e", "#ff8a30", "#ffaa50", "#ffd494"].map(hex);
const OUTLINE = hex("#0a0504");
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
/** A tone from a ramp for value v (0–1), dithered between neighbours like the painted props. */
const tone = (ramp: number[][], v: number, x: number, y: number) => {
  const f = Math.max(0, Math.min(1, v)) * (ramp.length - 1);
  const i = Math.min(ramp.length - 1, Math.floor(f) + (f - Math.floor(f) > BAYER[(y & 3) * 4 + (x & 3)] ? 1 : 0));
  return ramp[i];
};
// light from the upper left, toward the viewer
const L = (() => {
  const v = [-0.55, -0.35, 0.76];
  const n = Math.hypot(...v);
  return v.map((c) => c / n);
})();

interface Blob {
  x: number;
  y: number;
  r: number;
  vy: number;
  /** 0 cold, 1 hot: hot wax is lighter than the liquid and rises. */
  heat: number;
  phase: number;
  /** Where it's wandering across the glass (-1 left .. 1 right), the spot it's heading for, and when it picks a new one. */
  wander: number;
  aim: number;
  /** How strongly it rises for now: each blob keeps its own random pace, and now and then stalls. */
  pace: number;
  next: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

const TOP = GLASS[0] + 1;
const BOTTOM = GLASS[1] - 1;

const startBlobs = (): Blob[] =>
  [
    [0, 23, 2.4, 0.2],
    [1, 32, 1.7, 0.35],
    [-1, 41, 2.1, 0.62],
    [1, 50, 2.6, 0.75],
    [-1.5, 56, 2.2, 0.92],
    [0.5, 58, 3.0, 0.85],
  ].map(([x, y, r, heat], i) => ({ x: CX + x, y, r, vy: 0, heat, phase: i * 1.7, wander: 0, aim: rnd(-1, 1), pace: rnd(0.75, 1.25), next: rnd(0, 3) }));

export default function LavaLamp({
  on,
  roomLit = true,
  boxPct,
  onToggle,
  tabIndex,
}: {
  on: boolean;
  /** Whether the desk lamp is on: without it the metal is only lit by the glass. */
  roomLit?: boolean;
  boxPct: { left: number; top: number; width: number; height: number };
  onToggle: (e: React.MouseEvent) => void;
  tabIndex: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sim = useRef({ blobs: startBlobs(), heater: 1, glow: 1, t: 0, last: 0, raf: 0, on: true });

  useEffect(() => {
    const st = sim.current;
    st.on = on;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(GW, GH);
    const px = img.data;

    const frame = (now: number) => {
      const dt = st.last ? Math.min(0.05, (now - st.last) / 1000) : 1 / 60;
      st.last = now;
      st.t += dt;

      // the glow follows the switch quickly; the heater (and so the wax) takes its time
      st.glow = st.on ? Math.min(1, st.glow + dt * 1.4) : Math.max(0, st.glow - dt * 0.8);
      st.heater = st.on ? Math.min(1, st.heater + dt * 0.15) : Math.max(0, st.heater - dt * 0.12);

      // the wax: each blob takes the heat of where it is (hot by the base, cool at the top), floats
      // while it's hot and sinks once it cools; cold wax is thick, so it sinks slowly
      let still = true;
      for (const b of st.blobs) {
        // every few seconds a blob picks a new place to drift toward and a new pace, so the lamp never repeats
        b.next -= dt;
        if (b.next <= 0) {
          b.aim = rnd(-1, 1);
          b.pace = Math.random() < 0.18 ? rnd(0.35, 0.6) : rnd(0.75, 1.35);
          b.next = rnd(1.8, 5.5);
        }
        const u = (b.y - TOP) / (BOTTOM - TOP);
        const env = st.heater * (1.25 * u * u) - 0.1;
        b.heat += (env - b.heat) * (0.8 / b.r) * dt;
        const lift = -(b.heat - 0.5) * 16 * (st.on ? b.pace : 1);
        const drag = 1.7 + 3 * (1 - st.heater);
        b.vy += (lift - drag * b.vy) * dt;
        b.y += b.vy * dt;
        const lo = TOP + b.r * 0.8;
        const hi = BOTTOM - b.r * 0.35;
        if (b.y < lo) {
          b.y = lo;
          b.vy = Math.max(0, b.vy);
        }
        if (b.y > hi) {
          b.y = hi;
          b.vy = Math.min(0, b.vy);
        }
        // a slow drift across toward wherever it's wandering, more while it's moving, kept inside the glass
        b.wander += (b.aim - b.wander) * Math.min(1, dt * 0.35);
        const room = Math.max(0, glassR(b.y) - b.r - 1);
        const want = CX + (b.wander * 0.75 + Math.sin(st.t * 0.23 + b.phase) * 0.15) * room * Math.min(1, Math.abs(b.vy) / 2 + st.heater * 0.3);
        b.x += (want - b.x) * Math.min(1, dt * 0.8);
        if (Math.abs(b.vy) > 0.03 || b.y < hi - 0.05) still = false;
      }

      // draw
      const g = st.glow;
      const field = (x: number, y: number) => {
        // the wax that's always lying in the bottom of the glass, and every blob, stretched as it moves
        const pdx = (x - CX) / 2.2;
        const pdy = y - (BOTTOM + 2.5);
        let f = 12 / (pdx * pdx + pdy * pdy + 0.01);
        for (const b of st.blobs) {
          const e = 1 / (1 + Math.min(0.7, Math.abs(b.vy) * 0.06));
          const dx = x - b.x;
          const dy = (y - b.y) * e;
          f += (b.r * b.r) / (dx * dx + dy * dy + 0.01);
        }
        return f;
      };
      px.fill(0);
      const put = (x: number, y: number, c: number[]) => {
        const o = (y * GW + x) * 4;
        px[o] = c[0];
        px[o + 1] = c[1];
        px[o + 2] = c[2];
        px[o + 3] = 255;
      };
      for (let y = 0; y < GH; y++) {
        const R = outerR(y);
        if (!R) continue;
        const slope = (outerR(y + 1) - outerR(y - 1)) / 2;
        for (let x = Math.floor(CX - R); x <= Math.ceil(CX + R); x++) {
          const nx = (x + 0.5 - CX) / R;
          if (Math.abs(nx) > 1) continue;
          const nz = Math.sqrt(1 - nx * nx);
          const n = [nx, -slope * 0.6, nz];
          const nl = Math.hypot(n[0], n[1], n[2]);
          const diff = Math.max(0, (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / nl);
          if (y > GLASS[1] || y < GLASS[0]) {
            // the metal cap and base: warm-lit, a bright streak, dark bands at the joins and the foot
            let v = 0.12 + 0.66 * diff + Math.pow(diff, 18) * 0.4;
            if (y === GLASS[1] + 1 || y === GLASS[1] + 2 || y === BASE[1] || y === CAP[1]) v -= 0.3;
            // the glass lights the top of the base and the foot of the cap
            if (y > GLASS[1] && y < GLASS[1] + 8) v += 0.12 * g * (1 - (y - GLASS[1]) / 8);
            put(x, y, tone(METAL, roomLit ? v : v * 0.5, x, y));
            continue;
          }
          const u = (y - GLASS[0]) / (GLASS[1] - GLASS[0]);
          const shine = nx > -0.68 && nx < -0.44 && y > GLASS[0] + 2 && y < GLASS[1] - 2 && (y % 7 !== 0);
          const f = field(x + 0.5, y + 0.5);
          if (f > 1) {
            // wax: brightest in a blob's thick middle, lit from below by the heater
            const core = Math.min(1, (f - 1) / 2.2);
            const lit = 0.42 + 0.3 * core + 0.18 * nz + 0.08 * u;
            const dark = 0.14 + 0.16 * core + 0.1 * nz;
            put(x, y, tone(WAX, lerp(dark, lit, g) + (shine ? 0.25 : 0), x, y));
          } else {
            // the liquid: glowing, deepest at the edges of the glass, a sheen near its left side
            const lit = 0.3 + 0.36 * nz + 0.16 * u + 0.12 * f;
            const dark = 0.05 + 0.2 * nz;
            put(x, y, shine ? tone(LIQ, lerp(0.55, 1, g), x, y) : tone(LIQ, lerp(dark, lit, g), x, y));
          }
        }
      }
      // a one-pixel dark outline round the whole lamp, the way the painted props are drawn
      for (let y = 0; y < GH; y++) {
        for (let x = 0; x < GW; x++) {
          if (px[(y * GW + x) * 4 + 3]) continue;
          const filled = (X: number, Y: number) => X >= 0 && Y >= 0 && X < GW && Y < GH && px[(Y * GW + X) * 4 + 3] === 255;
          if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) {
            const o = (y * GW + x) * 4;
            px[o] = OUTLINE[0];
            px[o + 1] = OUTLINE[1];
            px[o + 2] = OUTLINE[2];
            px[o + 3] = 254;
          }
        }
      }
      // its shadow on the desk
      for (let y = BASE[1] + 2; y <= Math.min(GH - 1, BASE[1] + 4); y++) {
        for (let x = 0; x < GW; x++) {
          const e = ((x + 0.5 - CX - 1) / 14) ** 2 + ((y - BASE[1] - 2.5) / 2) ** 2;
          const o = (y * GW + x) * 4;
          if (e <= 1 && !px[o + 3]) px[o + 3] = 90;
        }
      }
      ctx.putImageData(img, 0, 0);

      // switched off, the wax all sunk and the glow gone: nothing more to draw until it's switched on
      if (!st.on && g === 0 && st.heater === 0 && still) {
        st.raf = 0;
        st.last = 0;
        return;
      }
      st.raf = requestAnimationFrame(frame);
    };

    cancelAnimationFrame(st.raf);
    st.last = 0;
    st.raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(st.raf);
      st.raf = 0;
    };
  }, [on, roomLit]);

  const { left, top, width, height } = boxPct;
  const box: CSSProperties = { left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` };

  return (
    <>
      <button
        type="button"
        className="cinema__sprite cinema__lava"
        style={box}
        onClick={onToggle}
        tabIndex={tabIndex}
        aria-label={on ? "Switch the lava lamp off" : "Switch the lava lamp on"}
      >
        <canvas ref={canvasRef} width={GW} height={GH} />
      </button>
    </>
  );
}
