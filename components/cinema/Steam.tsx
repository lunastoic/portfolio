"use client";

import { useEffect, useRef, type RefObject } from "react";

export interface SteamArt {
  /** The canvas, one pixel of the room's drawing a pixel. */
  width: number;
  height: number;
  /** Where each wisp leaves the coffee, canvas px. */
  sources: number[][];
}

interface Puff {
  x0: number;
  y0: number;
  age: number;
  life: number;
  rise: number;
  phase: number;
  sway: number;
  drift: number;
  /** Part of a knock's burst: it keeps its quick pace. */
  strong: boolean;
}

// the steam's light ramp, darkest to palest, as the studies drew it
const RAMP = ["#aaa29c", "#cdc5bf", "#ece6e0"];
// a new puff off each wisp this often (s); knocked, the cup lets out a burst and steams harder for a moment
const EVERY = 0.085;
const BURST = 34;
const HARD_FOR = 0.8;
// the steam's own pace, slower than the burst's
const DRIFT = 0.7;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * The coffee's steam, drawn live on a pixel canvas over the mug: puffs leave the coffee in two or three wisps, rise
 * curling side to side, thin out through the room's checker dither and are gone, over and over without end. The box rides the
 * mug's own transform, so the steam goes where the mug goes. `puffRef` lets the scene make it puff when the mug is
 * knocked. `zoomRef` is how far the camera has zoomed in from standing: the steam slows by as much, so it crosses the
 * screen at the same pace standing and seated.
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
    const puffs: Puff[] = [];
    const due = sources.map(() => Math.random() * EVERY);
    let hard = 0;

    const spawn = (s: number[], strong: boolean) =>
      puffs.push({
        x0: s[0] + rnd(-0.6, 0.6) + (strong ? rnd(-2.5, 2.5) : 0),
        y0: s[1],
        age: 0,
        life: strong ? rnd(1.8, 2.8) : rnd(3, 4.4),
        rise: strong ? rnd(18, 26) : rnd(10, 14),
        phase: rnd(0, Math.PI * 2),
        sway: strong ? rnd(1.6, 3) : rnd(0.8, 1.6),
        drift: rnd(-1.2, 1.2),
        strong,
      });

    puffRef.current = () => {
      for (let i = 0; i < BURST; i++) spawn(sources[i % sources.length], true);
      hard = HARD_FOR;
    };

    const step = (dt: number) => {
      hard = Math.max(0, hard - dt);
      const zoom = Math.max(1, zoomRef.current ?? 1);
      const slow = (dt * DRIFT) / zoom;
      sources.forEach((s, i) => {
        due[i] -= slow * (hard > 0 ? 2.5 : 1);
        while (due[i] <= 0) {
          spawn(s, false);
          due[i] += EVERY * rnd(0.7, 1.3);
        }
      });
      for (const p of puffs) p.age += p.strong ? dt / zoom : slow;
      for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i].age >= puffs[i].life) puffs.splice(i, 1);
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (const p of puffs) {
        const t = p.age / p.life;
        // fades in off the coffee, thins out as it rises
        const a = Math.min(1, p.age / 0.35) * (1 - t) ** 1.3;
        // the curl widens as it climbs
        const X = Math.round(p.x0 + Math.sin(p.age * 2.1 + p.phase) * p.sway * (0.4 + t * 2.2) + p.drift * p.age);
        const Y = Math.round(p.y0 - p.rise * p.age);
        if (Y < 0 || X < 0 || X >= width) continue;
        // pale and solid near the cup, then only every other pixel of the checker, as the room dithers
        if (a < 0.4 && (X + Y) % 2 !== 0) continue;
        ctx.fillStyle = RAMP[a > 0.7 ? 2 : a > 0.4 ? 1 : 0];
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
