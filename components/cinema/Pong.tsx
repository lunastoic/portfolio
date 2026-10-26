"use client";

import { useEffect, useRef } from "react";

// the court, in its own pixels, scaled up crisp to fill the window
const W = 160;
const H = 100;
const PAD_H = 18;
const PAD_W = 3;
const BALL = 3;
const TO_WIN = 7;
const INK = "#fff4d8";
const COURT = "#1d1838";
const DIM = "#4a3d70";

// the digits as 3×5 bitmaps, for the score
const DIGITS = ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001", "111100111001111", "111100111101111", "111001001001001", "111101111101111", "111101111001111"];

/**
 * Pong against the computer, drawn as pixel art. You're the left paddle: move it with the mouse or a finger over the
 * court, or with W/S or the arrow keys. Space, a click or a tap serves. The first to seven wins, and the computer's
 * paddle is a little slower than the ball, so it can be beaten.
 */
export default function Pong() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const s = {
      you: H / 2 - PAD_H / 2,
      cpu: H / 2 - PAD_H / 2,
      bx: W / 2,
      by: H / 2,
      vx: 0,
      vy: 0,
      scores: [0, 0],
      serving: true,
      // which side the next serve goes to
      toward: 1,
      keys: { up: false, down: false },
      aim: null as number | null,
      winner: null as string | null,
    };

    const serve = () => {
      if (s.winner) {
        s.scores = [0, 0];
        s.winner = null;
      }
      if (!s.serving) return;
      s.serving = false;
      s.bx = W / 2;
      s.by = H / 2;
      const a = (Math.random() - 0.5) * 0.8;
      s.vx = 70 * s.toward * Math.cos(a);
      s.vy = 70 * Math.sin(a);
    };

    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      const k = e.key;
      if (k === "ArrowUp" || k === "w" || k === "W") s.keys.up = down;
      else if (k === "ArrowDown" || k === "s" || k === "S") s.keys.down = down;
      else if (k === " " && down) serve();
      else return;
      e.preventDefault();
      s.aim = null; // the keys take over from the pointer
    };
    const keydown = onKey(true);
    const keyup = onKey(false);
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);

    const toCourt = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      // the court is letterboxed in the canvas (object-fit: contain), so find where it sits
      const k = Math.min(r.width / W, r.height / H);
      return (e.clientY - r.top - (r.height - H * k) / 2) / k;
    };
    const move = (e: PointerEvent) => (s.aim = toCourt(e));
    const down = (e: PointerEvent) => {
      s.aim = toCourt(e);
      serve();
    };
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerdown", down);

    const hit = (pad: number, dir: number) => {
      // where it meets the paddle sets the angle, and every return is a touch faster
      const off = (s.by + BALL / 2 - (pad + PAD_H / 2)) / (PAD_H / 2);
      const speed = Math.min(150, Math.hypot(s.vx, s.vy) * 1.06);
      const a = off * 0.9;
      s.vx = dir * speed * Math.cos(a);
      s.vy = speed * Math.sin(a);
    };

    const step = (dt: number) => {
      const clampPad = (y: number) => Math.max(2, Math.min(H - 2 - PAD_H, y));
      if (s.aim !== null) s.you = clampPad(s.you + (s.aim - PAD_H / 2 - s.you) * Math.min(1, dt * 18));
      else s.you = clampPad(s.you + ((s.keys.down ? 1 : 0) - (s.keys.up ? 1 : 0)) * 110 * dt);
      // the computer follows the ball when it's coming its way, and drifts back to the middle when it isn't
      const target = s.vx > 0 ? s.by - PAD_H / 2 + BALL / 2 : H / 2 - PAD_H / 2;
      const d = target - s.cpu;
      s.cpu = clampPad(s.cpu + Math.sign(d) * Math.min(Math.abs(d), 62 * dt));
      if (s.serving) return;

      s.bx += s.vx * dt;
      s.by += s.vy * dt;
      if (s.by < 2) {
        s.by = 2;
        s.vy = Math.abs(s.vy);
      }
      if (s.by > H - 2 - BALL) {
        s.by = H - 2 - BALL;
        s.vy = -Math.abs(s.vy);
      }
      if (s.vx < 0 && s.bx <= 6 + PAD_W && s.bx >= 4 && s.by + BALL > s.you && s.by < s.you + PAD_H) {
        s.bx = 6 + PAD_W;
        hit(s.you, 1);
      }
      if (s.vx > 0 && s.bx + BALL >= W - 6 - PAD_W && s.bx <= W - 4 && s.by + BALL > s.cpu && s.by < s.cpu + PAD_H) {
        s.bx = W - 6 - PAD_W - BALL;
        hit(s.cpu, -1);
      }
      if (s.bx < -BALL || s.bx > W) {
        const side = s.bx < 0 ? 1 : 0;
        s.scores[side]++;
        s.serving = true;
        s.toward = side === 1 ? -1 : 1; // served toward whoever lost the point
        s.bx = W / 2;
        s.by = H / 2;
        if (s.scores[side] >= TO_WIN) s.winner = side === 0 ? "YOU WIN" : "CPU WINS";
      }
    };

    const digit = (n: number, x: number, y: number) => {
      const bits = DIGITS[n];
      for (let i = 0; i < 15; i++) if (bits[i] === "1") ctx.fillRect(x + (i % 3) * 2, y + Math.floor(i / 3) * 2, 2, 2);
    };
    // a few capital letters, 3×5, for the messages
    const FONT: Record<string, string> = {
      A: "010101111101101", C: "111100100100111", E: "111100111100111", I: "111010010010111", L: "100100100100111",
      N: "101111111111101", O: "111101101101111", P: "111101111100100", R: "110101110101101", S: "111100111001111",
      T: "111010010010010", U: "101101101101111", V: "101101101101010", W: "101101111111101", Y: "101101010010010",
      " ": "000000000000000",
    };
    const text = (t: string, y: number) => {
      const x0 = Math.round(W / 2 - (t.length * 4 - 1) / 2);
      [...t].forEach((c, j) => {
        const bits = FONT[c] ?? FONT[" "];
        for (let i = 0; i < 15; i++) if (bits[i] === "1") ctx.fillRect(x0 + j * 4 + (i % 3), y + Math.floor(i / 3), 1, 1);
      });
    };

    const draw = () => {
      ctx.fillStyle = COURT;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = DIM;
      for (let y = 2; y < H - 2; y += 6) ctx.fillRect(W / 2 - 1, y, 2, 3);
      ctx.fillRect(0, 0, W, 1);
      ctx.fillRect(0, H - 1, W, 1);
      ctx.fillStyle = INK;
      digit(s.scores[0] % 10, W / 2 - 18, 6);
      digit(s.scores[1] % 10, W / 2 + 12, 6);
      ctx.fillRect(4, Math.round(s.you), PAD_W, PAD_H);
      ctx.fillRect(W - 4 - PAD_W, Math.round(s.cpu), PAD_W, PAD_H);
      if (!s.serving) ctx.fillRect(Math.round(s.bx), Math.round(s.by), BALL, BALL);
      if (s.winner) text(s.winner, H / 2 - 8);
      if (s.serving) text("PRESS SPACE OR TAP", H / 2 + 6);
    };

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
    canvas.focus();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerdown", down);
    };
  }, []);

  return <canvas ref={canvasRef} className="game__pong" width={W} height={H} tabIndex={-1} aria-label="Pong" />;
}
