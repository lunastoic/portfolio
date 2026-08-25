"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import DeskScene from "@/components/room/DeskScene";
import { INTRO_ENABLED } from "./config";
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

/**
 * The single touchpoint between the intro layer and the existing site.
 * Renders the 2D DeskScene unless the intro is enabled (INTRO_ENABLED or
 * ?intro=1 preview) AND the environment can handle it: desktop width,
 * no reduced-motion preference, WebGL available, no #desk deep-link.
 */
export default function IntroGate() {
  const [mode, setMode] = useState<"2d" | "intro">("2d");

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search);
      const override = params.get("intro");
      const wanted = override === "1" ? true : override === "0" ? false : INTRO_ENABLED;
      if (!wanted) return;
      const eligible =
        window.matchMedia("(min-width: 900px)").matches &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
        supportsWebGL() &&
        window.location.hash !== "#desk";
      if (eligible) setMode("intro");
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return mode === "intro" ? <IntroLayer /> : <DeskScene />;
}
