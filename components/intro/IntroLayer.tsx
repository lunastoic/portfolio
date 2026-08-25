"use client";

import { useEffect, useRef, useState } from "react";
import { ENTER_PROMPT_DELAY_MS } from "./config";
import { startIntroScene, type DollyTarget, type IntroSceneHandle } from "./introScene";
import "./intro.css";

export interface IntroApi {
  /** Fly into the monitor toward the given 2D-monitor target rect. */
  beginDolly(target: DollyTarget, instant: boolean): void;
  /** Fly back out to the idle room. */
  beginExit(): void;
}

export type IntroPhase = "room" | "entering" | "away" | "exiting";

interface IntroLayerProps {
  phase: IntroPhase;
  /** Crossfade state — true once the 3D screen matches the 2D monitor. */
  faded: boolean;
  /** Skip the opacity transition (reduced-motion hard cut). */
  instant: boolean;
  onApi: (api: IntroApi | null) => void;
  /** User clicked the monitor or [ ENTER ]. */
  onRequestEnter: () => void;
  onMatched: () => void;
  onEnterDone: () => void;
  onExitDone: () => void;
}

/**
 * The 3D ASCII room canvas. All transition orchestration lives in
 * IntroGate; this component owns the three.js scene handle and input.
 */
export default function IntroLayer({
  phase,
  faded,
  instant,
  onApi,
  onRequestEnter,
  onMatched,
  onEnterDone,
  onExitDone,
}: IntroLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<IntroSceneHandle | null>(null);
  const [showEnter, setShowEnter] = useState(false);
  const [overMonitor, setOverMonitor] = useState(false);

  const cbRef = useRef({ onRequestEnter, onMatched, onEnterDone, onExitDone, onApi });
  useEffect(() => {
    cbRef.current = { onRequestEnter, onMatched, onEnterDone, onExitDone, onApi };
  });

  useEffect(() => {
    const t = setTimeout(() => setShowEnter(true), ENTER_PROMPT_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  /* three.js lifecycle */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    startIntroScene(canvas).then((handle) => {
      if (cancelled) {
        handle.dispose();
        return;
      }
      handleRef.current = handle;
      cbRef.current.onApi({
        beginDolly: (target: DollyTarget, hardCut: boolean) =>
          handle.startDolly(
            target,
            () => cbRef.current.onMatched(),
            () => cbRef.current.onEnterDone(),
            hardCut
          ),
        beginExit: () => handle.reverseDolly(() => cbRef.current.onExitDone()),
      });
    });
    return () => {
      cancelled = true;
      cbRef.current.onApi(null);
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, []);

  /* pause the scene while the 2D site is up */
  useEffect(() => {
    if (phase === "away") handleRef.current?.pause();
  }, [phase]);

  const inRoom = phase === "room";

  return (
    <div
      className={[
        "intro",
        faded ? "intro--faded" : "",
        phase === "away" ? "intro--hidden" : "",
        instant ? "intro--instant" : "",
      ].join(" ")}
    >
      <canvas
        ref={canvasRef}
        className="intro__canvas"
        style={{ cursor: overMonitor && inRoom ? "pointer" : "default" }}
        onPointerMove={(e) => {
          if (!inRoom) return;
          setOverMonitor((handleRef.current?.hitTest(e.clientX, e.clientY) ?? null) !== null);
        }}
        onClick={(e) => {
          if (!inRoom) return;
          const hit = handleRef.current?.hitTest(e.clientX, e.clientY);
          if (hit === "monitor") cbRef.current.onRequestEnter();
          else if (hit === "lamp") handleRef.current?.toggleLamp();
        }}
      />
      {showEnter && inRoom && (
        <button
          type="button"
          className="intro__enter"
          onClick={() => cbRef.current.onRequestEnter()}
        >
          [ ENTER ]
        </button>
      )}
    </div>
  );
}
