"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import DeskScene from "@/components/room/DeskScene";
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
 *   room ── click ──▶ entering (2D mounts hidden, dolly flies, crossfade
 *   at frame-match) ──▶ away (2D live, intro paused+hidden, EXIT shown)
 *   ── EXIT/ESC/Back ──▶ exiting (fade room back in, reverse dolly) ──▶ room
 *
 * History: entering pushes #desk so Back exits to the room and Forward
 * re-enters. A refresh on #desk loads the 2D site directly.
 */
export default function IntroGate() {
  const [introEligible, setIntroEligible] = useState(false);
  const [phase, setPhase] = useState<IntroPhase>("room");
  const [faded, setFaded] = useState(false);
  const [instant, setInstant] = useState(false);
  const [deskMounted, setDeskMounted] = useState(true); // true when intro is off
  const [showExit, setShowExit] = useState(false);
  const apiRef = useRef<IntroApi | null>(null);
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
        // Refreshed while "inside": load the 2D site directly; Back reloads
        // out to the room rather than appearing to do nothing.
        const onPop = () => {
          if (window.location.hash !== "#desk") window.location.reload();
        };
        window.addEventListener("popstate", onPop);
        return;
      }
      setIntroEligible(true);
      setDeskMounted(false);
      setPhase("room");
    });
    return () => cancelAnimationFrame(id);
  }, []);

  /* ---------------- enter ---------------- */
  const requestEnter = useCallback(() => {
    if (phaseRef.current !== "room" || !apiRef.current) return;
    const hardCut = prefersReducedMotion();
    setInstant(hardCut);
    setPhase("entering");
    setDeskMounted(true); // mounts hidden under the opaque canvas; boot starts
    // Let the 2D scene lay out, then measure its monitor for the dolly target.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = document.querySelector(".monitor__screen");
        const rect = el?.getBoundingClientRect();
        const target =
          rect && rect.height > 0
            ? {
                centerYFrac: (rect.top + rect.height / 2) / window.innerHeight,
                heightFrac: rect.height / window.innerHeight,
              }
            : { centerYFrac: 0.47, heightFrac: 0.45 };
        apiRef.current?.beginDolly(target, hardCut);
      })
    );
  }, []);

  const onMatched = useCallback(() => {
    setFaded(true); // crossfade starts exactly when the frames align
    if (window.location.hash !== "#desk") {
      window.history.pushState({ luna: "desk" }, "", "#desk");
    }
  }, []);

  const onEnterDone = useCallback(() => {
    setPhase("away");
    setShowExit(true);
  }, []);

  /* ---------------- exit ---------------- */
  const performExit = useCallback(() => {
    if (phaseRef.current !== "away" || !apiRef.current) return;
    setShowExit(false);
    setFaded(false); // room fades back in over the 2D site
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
    setDeskMounted(false); // next enter boots fresh
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
  return (
    <>
      {deskMounted && <DeskScene />}
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
