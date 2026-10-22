"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { Spring } from "./physics";

interface CableArt {
  boxPct: { left: number; top: number; width: number; height: number };
  /** The canvas, one pixel of the room's drawing a pixel. */
  width: number;
  height: number;
  /** The cable from the headset down the wall to the controller's port, canvas px. */
  points: number[][];
  color: { on: string; off: string };
}

/**
 * The headset's cable, drawn live on a pixel canvas (scripts/pixel-room.js lays out where it runs): from the
 * headset on its hook down the wall and across into the controller. Tap it and it sways a little, fixed at both
 * ends, swinging furthest in its slack middle, and settles.
 */
export default function HeadsetCable({ cable, lampOn, tabIndex }: { cable: CableArt; lampOn: boolean; tabIndex: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sim = useRef({ sway: new Spring(38, 1.6), last: 0, raf: 0 });

  const draw = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { points, width, height } = cable;
    const n = points.length;
    const off = sim.current.sway.x;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = lampOn ? cable.color.on : cable.color.off;
    // each point pushed sideways by the sway, most where the cable hangs free and not at all at its ends
    for (let i = 0; i < n; i++) {
      const [x, y] = points[i];
      ctx.fillRect(Math.round(x + off * Math.sin((Math.PI * i) / (n - 1))), Math.round(y), 1, 1);
    }
  };

  useEffect(draw);
  useEffect(() => () => cancelAnimationFrame(sim.current.raf), []);

  const swing = () => {
    const st = sim.current;
    st.sway.kick((Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 8));
    if (st.raf) return;
    st.last = 0;
    const frame = (now: number) => {
      const dt = st.last ? Math.min(0.033, (now - st.last) / 1000) : 1 / 60;
      st.last = now;
      st.sway.step(dt);
      draw();
      if (st.sway.idle) {
        st.sway.settle();
        draw();
        st.raf = 0;
        return;
      }
      st.raf = requestAnimationFrame(frame);
    };
    st.raf = requestAnimationFrame(frame);
  };

  const { left, top, width, height } = cable.boxPct;
  const box: CSSProperties = { left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` };
  return (
    <button
      type="button"
      className="cinema__sprite cinema__cable"
      style={box}
      onClick={(e) => {
        e.stopPropagation();
        swing();
      }}
      tabIndex={tabIndex}
      aria-label="Swing the headset cable"
    >
      <canvas ref={canvasRef} width={cable.width} height={cable.height} />
    </button>
  );
}
