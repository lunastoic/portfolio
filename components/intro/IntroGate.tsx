"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import DeskScene from "@/components/room/DeskScene";
import InsideScreen from "./InsideScreen";
import { INTRO_ENABLED } from "./config";
import type { IntroApi, IntroPhase } from "./IntroLayer";
import "./intro.css";

const IntroLayer = dynamic(() => import("./IntroLayer"), {
  ssr: false,
  loading: () => (
    <div className="intro intro--loading">
      <span className="intro__spinner">
        LOADING ROOM... <span className="cursor-blink" />
      </span>
    </div>
  ),
});

function supportsWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Orchestrates the whole intro experience:
 *
 *   room ── click ──▶ entering (fullscreen LUNA OS mounts hidden and starts
 *   booting, dolly flies, crossfade as the 3D screen fills the frame)
 *   ──▶ away (inside the machine, intro paused+hidden, EXIT shown)
 *   ── EXIT/ESC/Back ──▶ exiting (room fades back in, reverse dolly) ──▶ room
 *
 * History: entering pushes #desk so Back exits to the room and Forward
 * re-enters. A refresh on #desk loads straight into the fullscreen OS.
 * Without the intro (flag off, mobile, reduced motion, no WebGL) the
 * classic 2D desk scene renders instead.
 */
export default function IntroGate() {
  const [introEligible, setIntroEligible] = useState(false);
  const [insideOnly, setInsideOnly] = useState(false); // #desk refresh path
  const [phase, setPhase] = useState<IntroPhase>("room");
  const [faded, setFaded] = useState(false);
  const [instant, setInstant] = useState(false);
  const [insideMounted, setInsideMounted] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const apiRef = useRef<IntroApi | null>(null);
  const instantRef = useRef(false);
  const phaseRef = useRef<IntroPhase>("room");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  /* ---------------- eligibility ---------------- */
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search);
      const override = params.get("intro");
      const wanted = override === "1" ? true : override === "0" ? false : INTRO_ENABLED;
      if (!wanted) return;
      const eligible =
        window.matchMedia("(min-width: 900px)").matches &&
        !prefersReducedMotion() &&
        supportsWebGL();
      if (!eligible) return;

      if (window.location.hash === "#desk") {
        // Refreshed while "inside": load the fullscreen OS directly; Back
        // reloads out to the room rather than appearing to do nothing.
        setInsideOnly(true);
        const onPop = () => {
          if (window.location.hash !== "#desk") window.location.reload();
        };
        window.addEventListener("popstate", onPop);
        return;
      }
      setIntroEligible(true);
      setPhase("room");
    });
    return () => cancelAnimationFrame(id);
  }, []);

  /* ---------------- enter ---------------- */
  const requestEnter = useCallback(() => {
    if (phaseRef.current !== "room" || !apiRef.current) return;
    const hardCut = prefersReducedMotion();
    instantRef.current = hardCut;
    setInstant(hardCut);
    setPhase("entering");
    setInsideMounted(true); // mounts hidden under the opaque canvas; boot starts
    // Let the fullscreen OS lay out, then measure its screen for the dolly.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = document.querySelector(".inside-screen .monitor__screen");
        const rect = el?.getBoundingClientRect();
        const target =
          rect && rect.height > 0
            ? {
                centerYFrac: (rect.top + rect.height / 2) / window.innerHeight,
                heightFrac: rect.height / window.innerHeight,
              }
            : { centerYFrac: 0.5, heightFrac: 0.85 };
        apiRef.current?.beginDolly(target, hardCut);
      })
    );
  }, []);

  const onMatched = useCallback(() => {
    setFaded(true); // crossfade starts as the 3D screen fills the frame
    if (window.location.hash !== "#desk") {
      window.history.pushState({ luna: "desk" }, "", "#desk");
    }
  }, []);

  const onEnterDone = useCallback(() => {
    // The fade may still be finishing when the dolly ends — let it complete
    // before display:none, or the crossfade would cut.
    const finish = () => {
      setPhase("away");
      setShowExit(true);
    };
    if (instantRef.current) finish();
    else window.setTimeout(finish, 460);
  }, []);

  /* ---------------- exit ---------------- */
  const performExit = useCallback(() => {
    if (phaseRef.current !== "away" || !apiRef.current) return;
    setShowExit(false);
    setFaded(false); // room fades back in over the fullscreen OS
    setPhase("exiting");
    apiRef.current.beginExit();
  }, []);

  const requestExit = useCallback(() => {
    if (phaseRef.current !== "away") return;
    // Route through history so Back/EXIT/ESC all take the same path.
    if (window.location.hash === "#desk") window.history.back();
    else performExit();
  }, [performExit]);

  const onExitDone = useCallback(() => {
    setInsideMounted(false); // next enter boots fresh
    setInstant(false);
    setPhase("room");
  }, []);

  /* ---------------- history + ESC ---------------- */
  useEffect(() => {
    if (!introEligible) return;
    const onPop = () => {
      if (window.location.hash !== "#desk" && phaseRef.current === "away") {
        performExit();
      } else if (window.location.hash === "#desk" && phaseRef.current === "room") {
        requestEnter(); // Forward button re-enters
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || phaseRef.current !== "away") return;
      if (document.querySelector(".retro-window")) return; // windows first
      requestExit();
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
    };
  }, [introEligible, performExit, requestEnter, requestExit]);

  /* ---------------- render ---------------- */
  if (insideOnly) return <InsideScreen />;

  return (
    <>
      {introEligible ? insideMounted && <InsideScreen /> : <DeskScene />}
      {introEligible && (
        <IntroLayer
          phase={phase}
          faded={faded}
          instant={instant}
          onApi={(api) => (apiRef.current = api)}
          onRequestEnter={requestEnter}
          onMatched={onMatched}
          onEnterDone={onEnterDone}
          onExitDone={onExitDone}
        />
      )}
      {showExit && (
        <button type="button" className="intro__exit" onClick={requestExit}>
          [ EXIT ]
        </button>
      )}
    </>
  );
}
