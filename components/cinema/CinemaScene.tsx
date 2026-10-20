"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import manifest from "../../public/cinema/manifest.json";
import LofiOS, { type LofiPopup } from "./LofiOS";
import "./cinema.css";

type Pose = "standing" | "sitting" | "seated" | "rising";
type LayoutKey = "desktop" | "mobile";

interface PctBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** One layout's art, as the manifest describes it (sprites and decks only where composed). */
interface LayoutArt {
  image: string;
  size: { width: number; height: number };
  screenPx: number[];
  focalPoint: number[];
  hotspotsPct: Record<string, PctBox>;
  spritesPct?: Record<string, PctBox>;
  spriteFiles?: Record<string, string>;
  antPct?: { from: number[]; to: number[] };
  decksPct?: PctBox[];
}

const SIT_MS = 1000;
/** Seated, the painted screen stands this tall relative to the viewport. */
const SEAT_FRACTION: Record<LayoutKey, number> = { desktop: 0.6, mobile: 0.55 };
/** Seated, the crop starts at least this far (art px) below the decks, so they stay out of view. */
const DECK_CLEARANCE = 6;
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

/** Standing back from the desk: the whole painting cover-fits the viewport, monitor as centered as the crop allows. */
function standingStage(art: LayoutArt, vw: number, vh: number): Stage {
  const { width: W, height: H } = art.size;
  const [fx, fy] = art.focalPoint;
  const scale = Math.max(vw / W, vh / H);
  const w = W * scale;
  const h = H * scale;
  const x = Math.min(0, Math.max(vw - w, vw / 2 - (fx / 100) * w));
  const y = Math.min(0, Math.max(vh - h, vh / 2 - (fy / 100) * h));
  return { x, y, w, h, scale };
}

/**
 * Seated at the desk: zoomed in so the painted screen stands SEAT_FRACTION of the
 * viewport tall, centered on it, but never showing the decks above the monitor and
 * never leaving the painting (no blank edges).
 */
function seatedStage(art: LayoutArt, layout: LayoutKey, vw: number, vh: number): Stage {
  const { width: W, height: H } = art.size;
  const [sx0, sy0, sx1, sy1] = art.screenPx;
  const cover = Math.max(vw / W, vh / H);
  // tall enough to read, but never wider than the viewport (phones are narrow)
  const fit = Math.min((SEAT_FRACTION[layout] * vh) / (sy1 - sy0), (0.94 * vw) / (sx1 - sx0));
  const scale = Math.max(cover * 1.12, fit);
  const cropW = vw / scale;
  const cropH = vh / scale;
  const deckBottom = (art.decksPct ?? []).reduce((m, d) => Math.max(m, ((d.top + d.height) / 100) * H), 0);
  const minTop = deckBottom ? deckBottom + DECK_CLEARANCE : 0;
  let top = Math.max(minTop, (sy0 + sy1) / 2 - cropH / 2);
  top = Math.min(top, H - cropH);
  let left = (sx0 + sx1) / 2 - cropW / 2;
  left = Math.min(Math.max(0, left), W - cropW);
  return { x: -left * scale, y: -top * scale, w: W * scale, h: H * scale, scale };
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
function screenRect(art: LayoutArt, s: Stage): Rect {
  const [x0, y0, x1, y1] = art.screenPx;
  return { x: s.x + x0 * s.scale, y: s.y + y0 * s.scale, w: (x1 - x0) * s.scale, h: (y1 - y0) * s.scale };
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const pctBox = (r: PctBox): CSSProperties => ({
  left: `${r.left}%`,
  top: `${r.top}%`,
  width: `${r.width}%`,
  height: `${r.height}%`,
});

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Easter eggs on the desk; each click restarts its little animation. */
type Egg = "mug" | "note1" | "note2" | "note3" | "lamp" | "plant";

/**
 * v2 — the lo-fi pixel desk. You arrive standing back, the whole painted room
 * filling the window. Clicking the desk sits you down: the view zooms in on
 * the monitor (the decks above it slide out of frame) and the live LUNA_OS
 * takes over the glass. Seated,
 * the mug, lamp, plant and wall notes are little easter eggs. ESC,
 * [ STAND UP ] or clicking the room stands you back up.
 */
export default function CinemaScene() {
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [pose, setPose] = useState<Pose>("standing");
  const [progress, setProgress] = useState(0); // 0 = standing, 1 = seated (already eased)
  const [loadedImage, setLoadedImage] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [pendingPopup, setPendingPopup] = useState<LofiPopup>(null);
  const [eggs, setEggs] = useState<Record<Egg, number>>({ mug: 0, note1: 0, note2: 0, note3: 0, lamp: 0, plant: 0 });
  const [antRun, setAntRun] = useState(0); // > 0 while an ant is out
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

  const layout = pickLayout(vp.w, vp.h);
  const art = manifest[layout] as LayoutArt;

  // Reveal the art once its image is in: the load event, or the image was
  // already complete when attached (cached / decoded before hydration), or
  // a short timeout so a slow network never leaves the room black.
  const loaded = loadedImage === art.image;
  const artImage = art.image;
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

  const poke = useCallback(
    (egg: Egg) => (e: React.MouseEvent) => {
      e.stopPropagation();
      if (pose === "standing") {
        sitDown(egg === "mug" ? "coffee" : null);
        return;
      }
      if (pose !== "seated") return;
      setEggs((v) => ({ ...v, [egg]: v[egg] + 1 }));
      if (egg === "plant") setAntRun((n) => n + 1);
    },
    [pose, sitDown]
  );

  /* ---------------- geometry ---------------- */

  const ready = vp.w > 0;
  const stage = ready ? lerpStage(standingStage(art, vp.w, vp.h), seatedStage(art, layout, vp.w, vp.h), progress) : null;
  const screen = stage ? screenRect(art, stage) : null;
  const screenOn = pose === "seated" || (pose === "sitting" && progress >= SCREEN_ON_AT);

  const antStyle = (): CSSProperties | undefined => {
    if (!art.antPct || !stage) return undefined;
    const { from, to } = art.antPct;
    return {
      left: `${from[0]}%`,
      top: `${from[1]}%`,
      "--ant-dx": `${((to[0] - from[0]) / 100) * stage.w}px`,
      "--ant-dy": `${((to[1] - from[1]) / 100) * stage.h}px`,
    } as CSSProperties;
  };

  const classes = ["cinema", `cinema--${pose}`, ready && loaded ? "cinema--ready" : ""].filter(Boolean).join(" ");
  const sprites = art.spritesPct ?? {};

  return (
    <div className={classes} data-layout={layout}>
      {/* Standing, any click on the desk sits you down; seated, the room (not the props) stands you up.
          ESC and [ STAND UP ] cover keyboard users. */}
      <div
        className="cinema__stage"
        style={stage ? { left: stage.x, top: stage.y, width: stage.w, height: stage.h } : undefined}
        onClick={pose === "seated" ? standUp : pose === "standing" ? () => sitDown() : undefined}
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

        {/* Props cut out of the painting, back in their places, each with a little animation */}
        {(Object.keys(sprites) as Egg[]).map((k) => (
          <button
            key={`${k}-${eggs[k] ?? 0}`}
            type="button"
            className={`cinema__sprite cinema__sprite--${k} ${eggs[k] ? "is-poked" : ""}`}
            style={pctBox(sprites[k])}
            onClick={poke(k)}
            aria-label={k === "mug" ? "Nudge the coffee mug" : "Flick the sticky note"}
          >
            <Image src={`/cinema/${art.spriteFiles?.[k]}`} alt="" fill unoptimized draggable={false} />
          </button>
        ))}

        {art.hotspotsPct.lamp && (
          <button
            type="button"
            className="cinema__hotspot"
            style={pctBox(art.hotspotsPct.lamp)}
            onClick={poke("lamp")}
            aria-label="Tap the desk lamp"
          />
        )}
        {art.hotspotsPct.plant && (
          <button
            type="button"
            className="cinema__hotspot"
            style={pctBox(art.hotspotsPct.plant)}
            onClick={poke("plant")}
            aria-label="Rustle the plant"
          />
        )}

        {antRun > 0 && art.antPct && (
          <div key={antRun} className="cinema__ant" style={antStyle()} onAnimationEnd={() => setAntRun(0)} aria-hidden="true">
            <Image src="/cinema/sprite-ant.png" alt="" width={28} height={16} unoptimized draggable={false} />
          </div>
        )}

        {eggs.lamp > 0 && <div key={eggs.lamp} className="cinema__flicker" aria-hidden="true" />}
        <div className="cinema__dark" aria-hidden="true" />
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
          ▸ {layout === "mobile" ? "TAP" : "CLICK"} THE DESK TO SIT DOWN
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
