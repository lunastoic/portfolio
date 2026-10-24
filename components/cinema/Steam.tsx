"use client";

import { useEffect, useRef, type RefObject } from "react";

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
  /** Part of a knock's burst: wilder, and it rises at its quick pace. */
  strong: boolean;
}

// the steam's light ramp, darkest to palest, as the studies drew it
const RAMP = ["#aaa29c", "#cdc5bf", "#ece6e0"];
// how many wisps rise at once; knocked, the cup lets out a burst and steams harder for a moment
const WISPS = 3;
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
 * The coffee's steam, drawn live on a pixel canvas over the mug: thin wisps leave the coffee, faint right at its
 * surface, and rise as unbroken threads that curl wider the higher they climb, with denser pulses travelling up them;
 * up high they break apart into stretches that drift off through the room's checker dither, and new wisps take their
 * place, over and over without end. The box rides the mug's own transform, so the steam goes where the mug goes.
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
    const left = Math.min(...xs) - 1;
    const right = Math.max(...xs) + 1;
    const surface = Math.max(...sources.map((s) => s[1]));
    const wisps: Wisp[] = [];
    const lit = new Float32Array(width * height);
    let time = 0;
    let quick = 0; // the burst's own clock, at its quicker pace
    let hard = 0;
    let seed = 1;

    const spawn = (strong: boolean, age = 0) =>
      wisps.push({
        x: rnd(left, right),
        born: (strong ? quick : time) - age,
        life: strong ? rnd(1.6, 2.4) : rnd(4, 6.5),
        top: strong ? rnd(46, 62) : rnd(40, 58),
        amp: strong ? rnd(4, 6.5) : rnd(2.6, 4.4),
        k: rnd(0.13, 0.2),
        w: rnd(1.5, 2.1),
        phase: rnd(0, Math.PI * 2),
        phase2: rnd(0, Math.PI * 2),
        lean: rnd(-0.08, 0.08),
        seed: seed++,
        strong,
      });
    for (let i = 0; i < WISPS; i++) spawn(false, rnd(0, 3));

    puffRef.current = () => {
      for (let i = 0; i < BURST; i++) spawn(true);
      hard = HARD_FOR;
    };

    const step = (dt: number) => {
      hard = Math.max(0, hard - dt);
      const zoom = Math.max(1, zoomRef.current ?? 1);
      time += ((dt * DRIFT) / zoom) * (hard > 0 ? 1.8 : 1);
      quick += (dt * QUICK * DRIFT) / zoom;
      for (let i = wisps.length - 1; i >= 0; i--) {
        const p = wisps[i];
        if ((p.strong ? quick : time) - p.born > p.life) wisps.splice(i, 1);
      }
      while (wisps.filter((p) => !p.strong).length < WISPS) spawn(false);
    };

    const draw = () => {
      lit.fill(0);
      for (const p of wisps) {
        const age = (p.strong ? quick : time) - p.born;
        const env = Math.min(1, age / (p.strong ? 0.2 : 0.8)) * Math.min(1, (p.life - age) / (p.strong ? 0.6 : 1.2));
        let prev: number | null = null;
        for (let h = 1; h < p.top; h++) {
          const f = h / p.top;
          // the curl widens as it climbs: two bends, one tighter than the other, climbing the wisp
          const amp = 0.3 + p.amp * f ** 1.1;
          const x =
            p.x + p.lean * h + amp * Math.sin(p.k * h - p.w * age + p.phase) + amp * 0.4 * Math.sin(p.k * 2.3 * h - p.w * 1.6 * age + p.phase2);
          // faint at the coffee, densest a little above it, thinning with height; denser pulses carried up
          const pulse = 0.72 + 0.28 * Math.sin(0.3 * h - 2.6 * age + p.phase2);
          const a = 0.9 * env * Math.min(1, h / 6) * (1 - f) ** 0.6 * pulse;
          const Y = Math.round(surface - h);
          const X = Math.round(x);
          // up high it breaks apart: whole short stretches drop out, drifting up with the pulses
          if (Y < 0 || (f > 0.5 && hash(Math.floor((h - age * 8) / 3), p.seed) < (f - 0.5) * 1.5)) {
            prev = null;
            continue;
          }
          // joined to the row below, so the wisp is one unbroken thread
          const from = prev ?? X;
          for (let c = Math.min(from, X); c <= Math.max(from, X); c++) if (c >= 0 && c < width) lit[Y * width + c] = Math.max(lit[Y * width + c], a);
          prev = X;
        }
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
      step(dt);
      draw();
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
