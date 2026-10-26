"use client";

import { useEffect, useRef, type RefObject } from "react";
import { gameOn } from "./gamePause";

export interface SteamArt {
  /** The canvas, one pixel of the room's drawing a pixel. */
  width: number;
  height: number;
  /** Where each wisp leaves the coffee, canvas px. */
  sources: number[][];
}

interface Wisp {
  /** Where it leaves the coffee, and when (steam time). */
  x: number;
  born: number;
  life: number;
  /** How high it climbs before it has thinned away, px. */
  top: number;
  /** Its curl: how wide it swings up high, how tight the bends, how fast they climb. */
  amp: number;
  k: number;
  w: number;
  phase: number;
  phase2: number;
  lean: number;
  seed: number;
}

// the steam's light ramp, darkest to palest, as the studies drew it
const RAMP = ["#aaa29c", "#cdc5bf", "#ece6e0"];
// the coffee's three standing streams, across the cup from left to right: the middle one climbs far higher than the
// two beside it. Each has its own height, curl and pace, and its top rises and sinks a little as it breathes
const STREAMS = [
  { at: 0.1, top: 34, amp: 2.4, k: 0.2, w: 1.7, phase: 0, seed: 11 },
  { at: 0.52, top: 62, amp: 4.2, k: 0.14, w: 1.4, phase: 2.1, seed: 23 },
  { at: 0.9, top: 26, amp: 2, k: 0.22, w: 1.9, phase: 4, seed: 37 },
];
// knocked, the cup lets out a burst of wilder wisps and steams harder for a moment
const BURST = 4;
const HARD_FOR = 0.8;
// the steam's own pace, slower than the burst's
const DRIFT = 0.7;
const QUICK = 2.2;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const hash = (x: number, s: number) => {
  let h = Math.imul(x | 0, 73856093) ^ Math.imul(s | 0, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/**
 * The coffee's steam, drawn live on a pixel canvas over the mug: three thin streams stand off the coffee, one far
 * taller than the others. Each leaves the surface straight and smooth, then sways and curls wider the higher it climbs,
 * with denser pulses travelling up it; near its top it breaks apart into stretches that drift off through the room's
 * checker dither, and the room's air leans the whole plume a little, slowly, this way and that. The box rides the mug's own transform, so the steam goes where the mug goes.
 * `puffRef` lets the scene make it puff when the mug is knocked. `zoomRef` is how far the camera has zoomed in from
 * standing: the steam slows by as much, so it crosses the screen at the same pace standing and seated.
 */
export default function Steam({
  steam,
  puffRef,
  zoomRef,
}: {
  steam: SteamArt;
  puffRef: RefObject<(() => void) | null>;
  zoomRef: RefObject<number>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { width, height, sources } = steam;
    const xs = sources.map((s) => s[0]);
    // the streams stand across the coffee, out to just past the outer sources
    const left = Math.min(...xs) - 1;
    const right = Math.max(...xs) + 1;
    const surface = Math.max(...sources.map((s) => s[1]));
    const wisps: Wisp[] = [];
    const lit = new Float32Array(width * height);
    let time = 0;
    let quick = 0; // the burst's own clock, at its quicker pace
    let hard = 0;
    let seed = 1;

    // a knock's wisp: it rises once at the burst's quick pace and is gone
    const spawn = () =>
      wisps.push({
        x: rnd(left, right),
        born: quick,
        life: rnd(1.6, 2.4),
        top: rnd(46, 62),
        amp: rnd(4, 6.5),
        k: rnd(0.13, 0.2),
        w: rnd(1.5, 2.1),
        phase: rnd(0, Math.PI * 2),
        phase2: rnd(0, Math.PI * 2),
        lean: rnd(-0.08, 0.08),
        seed: seed++,
      });

    puffRef.current = () => {
      for (let i = 0; i < BURST; i++) spawn();
      hard = HARD_FOR;
    };

    const step = (dt: number) => {
      hard = Math.max(0, hard - dt);
      const zoom = Math.max(1, zoomRef.current ?? 1);
      time += ((dt * DRIFT) / zoom) * (hard > 0 ? 1.8 : 1);
      quick += (dt * QUICK * DRIFT) / zoom;
      for (let i = wisps.length - 1; i >= 0; i--) {
        if (quick - wisps[i].born > wisps[i].life) wisps.splice(i, 1);
      }
    };

    // one rising thread, joined row to row so it never breaks except where it is meant to
    const thread = (top: number, seed: number, age: number, at: (h: number, f: number) => [number, number]) => {
      let prev: number | null = null;
      for (let h = 1; h < top; h++) {
        const f = h / top;
        const [x, a] = at(h, f);
        const Y = Math.round(surface - h);
        const X = Math.round(x);
        // up high it breaks apart: whole short stretches drop out, drifting up with the pulses
        if (Y < 0 || (f > 0.45 && hash(Math.floor((h - age * 7) / 3), seed) < (f - 0.45) * 1.6)) {
          prev = null;
          continue;
        }
        const from = prev ?? X;
        for (let c = Math.min(from, X); c <= Math.max(from, X); c++) if (c >= 0 && c < width) lit[Y * width + c] = Math.max(lit[Y * width + c], a);
        prev = X;
      }
    };

    const draw = () => {
      lit.fill(0);
      // the room's air leans the whole plume, more the higher it is
      const air = 0.05 * Math.sin(time * 0.23) + 0.03 * Math.sin(time * 0.61 + 1);
      for (const s of STREAMS) {
        const base = left + (right - left) * s.at;
        const top = s.top * (1 + 0.14 * Math.sin(time * 0.37 + s.phase) + 0.06 * Math.sin(time * 0.91 + s.seed));
        thread(top, s.seed, time, (h, f) => {
          // smooth just off the coffee, swaying more and more as it climbs: two bends, one tighter than the other
          const amp = 0.15 + s.amp * Math.max(0, f - 0.08) ** 1.2;
          const x =
            base + (air * h * h) / 20 + amp * Math.sin(s.k * h - s.w * time + s.phase) + amp * 0.4 * Math.sin(s.k * 2.3 * h - s.w * 1.6 * time + s.phase * 1.7);
          // faint at the coffee, densest a little above it, thinning with height; denser pulses carried up
          const pulse = 0.7 + 0.3 * Math.sin(0.28 * h - 2.4 * time + s.phase);
          return [x, 0.95 * Math.min(1, h / 5) * (1 - f) ** 0.55 * pulse];
        });
      }
      for (const p of wisps) {
        const age = quick - p.born;
        const env = Math.min(1, age / 0.2) * Math.min(1, (p.life - age) / 0.6);
        thread(p.top, p.seed, age, (h, f) => {
          const amp = 0.3 + p.amp * f ** 1.1;
          const x =
            p.x + p.lean * h + amp * Math.sin(p.k * h - p.w * age + p.phase) + amp * 0.4 * Math.sin(p.k * 2.3 * h - p.w * 1.6 * age + p.phase2);
          const pulse = 0.72 + 0.28 * Math.sin(0.3 * h - 2.6 * age + p.phase2);
          return [x, 0.9 * env * Math.min(1, h / 6) * (1 - f) ** 0.6 * pulse];
        });
      }
      ctx.clearRect(0, 0, width, height);
      for (let Y = 0; Y < height; Y++)
        for (let X = 0; X < width; X++) {
          const a = lit[Y * width + X];
          if (a < 0.12) continue;
          // thin steam only every other pixel of the checker, as the room dithers
          if (a < 0.4 && (X + Y) % 2 !== 0) continue;
          ctx.fillStyle = RAMP[a > 0.72 ? 2 : a > 0.4 ? 1 : 0];
          ctx.fillRect(X, Y, 1, 1);
        }
    };

    // it loops for everyone, "reduce motion" too: a slow, small drift the size of a few pixels
    for (let i = 0; i < 240; i++) step(1 / 60);
    let raf = 0;
    let last = 0;
    const frame = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      // a game is playing on the computer: hold still until it's done
      if (!gameOn()) {
        step(dt);
        draw();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      puffRef.current = null;
    };
  }, [steam, puffRef, zoomRef]);

  return <canvas ref={canvasRef} width={steam.width} height={steam.height} />;
}
