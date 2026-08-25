"use client";

import { useEffect, useRef, useState } from "react";
import { ENTER_PROMPT_DELAY_MS } from "./config";
import { startIntroScene } from "./introScene";
import "./intro.css";

/**
 * The 3D ASCII room. Phase 2: static room, idle camera drift, mouse
 * parallax, [ ENTER ] prompt after a beat. The dolly transition into the
 * 2D site arrives in Phase 4 — for now the prompt and monitor are visual.
 */
export default function IntroLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showEnter, setShowEnter] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowEnter(true), ENTER_PROMPT_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    startIntroScene(canvas).then((stop) => {
      if (cancelled) stop();
      else cleanup = stop;
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <div className="intro">
      <canvas ref={canvasRef} className="intro__canvas" />
      {showEnter && (
        <button type="button" className="intro__enter">
          [ ENTER ]
        </button>
      )}
    </div>
  );
}
