"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import manifest from "../../public/cinema/manifest.json";
import LofiOS, { type LofiPopup } from "./LofiOS";
import "./cinema.css";

type Pose = "standing" | "sitting" | "seated" | "rising";
type LayoutKey = "desktop" | "mobile";

const SIT_MS = 1000;
/** Seated, the screen fills this much of the viewport (phones get nearly all of it). */
const SEAT_FRACTION: Record<LayoutKey, number> = { desktop: 0.75, mobile: 0.96 };
/** Progress at which the live OS takes over from the painted screen. */
const SCREEN_ON_AT = 0.9;
const HINT_DELAY_MS = 2200;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Stage extends Rect {
  scale: number;
}

/** Portrait or narrow viewports use the phone composition. */
const pickLayout = (vw: number, vh: number): LayoutKey =>
  vw > 0 && (vw < 900 || vh > vw * 1.15) ? "mobile" : "desktop";

/** Standing: cover-fit the art, keeping the monitor as centered as the crop allows. */
function restStage(layout: LayoutKey, vw: number, vh: number): Stage {
  const { width: W, height: H } = manifest[layout].size;
  const [fx, fy] = manifest[layout].focalPoint;
  const scale = Math.max(vw / W, vh / H);
  const w = W * scale;
  const h = H * scale;
  const x = Math.min(0, Math.max(vw - w, vw / 2 - (fx / 100) * w));
  const y = Math.min(0, Math.max(vh - h, vh / 2 - (fy / 100) * h));
  return { x, y, w, h, scale };
}

/** Seated: scale and place the art so its screen sits head-on, centered, at SEAT_FRACTION of the viewport. */
function seatedStage(layout: LayoutKey, vw: number, vh: number): Stage {
  const { width: W, height: H } = manifest[layout].size;
  const [sx0, sy0, sx1, sy1] = manifest[layout].screenPx;
  const sw = sx1 - sx0;
  const sh = sy1 - sy0;
  const f = SEAT_FRACTION[layout];
  const targetW = Math.min(vw * f, vh * f * (sw / sh));
  const scale = targetW / sw;
  const targetH = sh * scale;
  const x = (vw - targetW) / 2 - sx0 * scale;
  const y = (vh - targetH) / 2 - sy0 * scale;
  return { x, y, w: W * scale, h: H * scale, scale };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpStage = (a: Stage, b: Stage, t: number): Stage => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  w: lerp(a.w, b.w, t),
  h: lerp(a.h, b.h, t),
  scale: lerp(a.scale, b.scale, t),
});

/** Where the art's screen is on the page for a given stage rect. */
function screenRect(layout: LayoutKey, s: Stage): Rect {
  const [x0, y0, x1, y1] = manifest[layout].screenPx;
  return { x: s.x + x0 * s.scale, y: s.y + y0 * s.scale, w: (x1 - x0) * s.scale, h: (y1 - y0) * s.scale };
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const pctBox = (r: { left: number; top: number; width: number; height: number }): CSSProperties => ({
  left: `${r.left}%`,
  top: `${r.top}%`,
  width: `${r.width}%`,
  height: `${r.height}%`,
});

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * v2 — the lo-fi pixel desk. You arrive standing in the room; the painted
 * monitor shows LUNA_OS. Clicking it (or the mug) sits you down: the art
 * scales up around the screen until the screen sits head-on at 75% of the
 * viewport, and the live OS takes over the glass. ESC, [ STAND UP ] or
 * clicking the room stands you back up. Phones get the portrait art.
 */
export default function CinemaScene() {
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [pose, setPose] = useState<Pose>("standing");
  const [progress, setProgress] = useState(0); // 0 = standing, 1 = seated (already eased)
  const [loadedImage, setLoadedImage] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [pendingPopup, setPendingPopup] = useState<LofiPopup>(null);
  const progressRef = useRef(0);
  const rafRef = useRef(0);
  const fallbackRef = useRef(0);

  useLayoutEffect(() => {
    const update = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setHint(true), HINT_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(fallbackRef.current);
    },
    []
  );

  // Reveal the art once its image is in: the load event, or the image was
  // already complete when attached (cached / decoded before hydration), or
  // a short timeout so a slow network never leaves the room black.
  const artImage = manifest[pickLayout(vp.w, vp.h)].image;
  const loaded = loadedImage === artImage;
  useEffect(() => {
    const t = setTimeout(() => setLoadedImage(artImage), 4000);
    return () => clearTimeout(t);
  }, [artImage]);
  const attachBackdrop = useCallback(
    (img: HTMLImageElement | null) => {
      if (img?.complete && img.naturalWidth > 0) setLoadedImage(artImage);
    },
    [artImage]
  );

  /** Ease progress from where it is to `to`; duration scales with the distance left. */
  const animateTo = useCallback((to: 0 | 1, onDone: () => void) => {
    cancelAnimationFrame(rafRef.current);
    clearTimeout(fallbackRef.current);
    const from = progressRef.current;
    const set = (p: number) => {
      progressRef.current = p;
      setProgress(p);
    };
    if (prefersReducedMotion() || from === to) {
      set(to);
      onDone();
      return;
    }
    const duration = SIT_MS * Math.abs(to - from);
    const start = performance.now();
    const finish = () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(fallbackRef.current);
      set(to);
      onDone();
    };
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      if (t >= 1) return finish();
      set(from + (to - from) * easeInOut(t));
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    // Frames stall in a backgrounded tab; land the move anyway.
    fallbackRef.current = window.setTimeout(finish, duration + 250);
  }, []);

  const sitDown = useCallback(
    (popup: LofiPopup = null) => {
      if (pose !== "standing") return;
      setPendingPopup(popup);
      setPose("sitting");
      animateTo(1, () => setPose("seated"));
    },
    [pose, animateTo]
  );

  const standUp = useCallback(() => {
    if (pose !== "seated") return;
    setPose("rising");
    animateTo(0, () => setPose("standing"));
  }, [pose, animateTo]);

  // ESC stands up once nothing is open on the screen (LofiOS closes its
  // popup/window on the same keypress first; it is still in the DOM here).
  useEffect(() => {
    if (pose !== "seated") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector(".retro-window")) return;
      standUp();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pose, standUp]);

  /* ---------------- geometry ---------------- */

  const layout = pickLayout(vp.w, vp.h);
  const art = manifest[layout];
  const ready = vp.w > 0;
  const stage = ready ? lerpStage(restStage(layout, vp.w, vp.h), seatedStage(layout, vp.w, vp.h), progress) : null;
  const screen = stage ? screenRect(layout, stage) : null;
  const screenOn = pose === "seated" || (pose === "sitting" && progress >= SCREEN_ON_AT);

  const classes = ["cinema", `cinema--${pose}`, ready && loaded ? "cinema--ready" : ""].filter(Boolean).join(" ");

  return (
    <div className={classes} data-layout={layout}>
      {/* Clicking the room stands you up; ESC and [ STAND UP ] cover keyboard users */}
      <div
        className="cinema__stage"
        style={stage ? { left: stage.x, top: stage.y, width: stage.w, height: stage.h } : undefined}
        onClick={pose === "seated" ? standUp : undefined}
      >
        <Image
          key={art.image}
          src={`/cinema/${art.image}`}
          alt=""
          fill
          priority
          unoptimized
          sizes="100vw"
          draggable={false}
          className="cinema__backdrop"
          ref={attachBackdrop}
          onLoad={() => setLoadedImage(art.image)}
          onError={() => setLoadedImage(art.image)}
        />

        {pose === "standing" && (
          <>
            <button
              type="button"
              className="cinema__hotspot"
              style={pctBox(art.hotspotsPct.monitor)}
              onClick={() => sitDown()}
              aria-label="Sit down at the computer"
            />
            <button
              type="button"
              className="cinema__hotspot"
              style={pctBox(art.hotspotsPct.mug)}
              onClick={() => sitDown("coffee")}
              aria-label="Grab the coffee and sit down"
            />
          </>
        )}
      </div>

      {/* The live screen rides the painted one; it only lights up seated */}
      {screen && (
        <div
          className="cinema__screen"
          style={{ left: screen.x, top: screen.y, width: screen.w, height: screen.h, "--screen-w": `${screen.w}px` } as CSSProperties}
        >
          {screenOn && <LofiOS initialPopup={pendingPopup} />}
        </div>
      )}

      {!loaded && (
        <div className="cinema__loading" aria-live="polite">
          <Image src="/cinema/mug.png" alt="" width={146} height={142} unoptimized draggable={false} />
          <span>
            BREWING<span className="cursor-blink" aria-hidden="true" />
          </span>
        </div>
      )}

      {hint && pose === "standing" && (
        <p className="cinema__hint" aria-hidden="true">
          ▸ {layout === "mobile" ? "TAP" : "CLICK"} THE SCREEN TO SIT DOWN
        </p>
      )}
      {pose === "seated" && (
        <button type="button" className="cinema__standup" onClick={standUp}>
          [ STAND UP ] <span className="cinema__standup-key">ESC</span>
        </button>
      )}
    </div>
  );
}
