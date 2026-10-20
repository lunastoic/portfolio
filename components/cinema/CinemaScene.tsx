"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import manifest from "../../public/cinema/manifest.json";
import { quadMatrix3d, type Pt, type Quad } from "./homography";
import CinemaScreen from "./CinemaScreen";
import "./cinema.css";

type Pose = "standing" | "sitting" | "seated" | "rising";

/** Sit-down move: duration, when the CRT lights up on the way in, how much of the viewport the seated screen covers. */
const SIT_MS = 1100;
const POWER_ON_AT = 0.55;
const SEAT_FRACTION = 0.75;
const SCREEN_ASPECT = 4 / 3;
const HINT_DELAY_MS = 2200;

interface Stage {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Cover-fit the photo to the viewport, keeping the focal point (the
 * monitor) as centered as the crop allows. The stage is the photo's
 * rendered rect; hotspots position inside it in image percentages.
 */
function fitStage(vw: number, vh: number): Stage {
  const { width: W, height: H } = manifest.size;
  const [fx, fy] = manifest.focalPoint;
  const scale = Math.max(vw / W, vh / H);
  const width = W * scale;
  const height = H * scale;
  const left = Math.min(0, Math.max(vw - width, vw / 2 - (fx / 100) * width));
  const top = Math.min(0, Math.max(vh - height, vh / 2 - (fy / 100) * height));
  return { left, top, width, height, scale };
}

/** Head-on screen when seated: 4:3, inside 75% of the viewport, centered. */
function fitSeated(vw: number, vh: number): Rect {
  const w = Math.min(vw * SEAT_FRACTION, vh * SEAT_FRACTION * SCREEN_ASPECT);
  const h = w / SCREEN_ASPECT;
  return { x: (vw - w) / 2, y: (vh - h) / 2, w, h };
}

/** The CRT glass in viewport pixels, from the manifest's image-pixel corners. */
function restQuad(stage: Stage): Quad {
  const q = manifest.screen.quadPx;
  const m = ([x, y]: number[]): Pt => [stage.left + x * stage.scale, stage.top + y * stage.scale];
  return { tl: m(q.tl), tr: m(q.tr), br: m(q.br), bl: m(q.bl) };
}

const rectQuad = (r: Rect): Quad => ({
  tl: [r.x, r.y],
  tr: [r.x + r.w, r.y],
  br: [r.x + r.w, r.y + r.h],
  bl: [r.x, r.y + r.h],
});

const lerpPt = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const lerpQuad = (a: Quad, b: Quad, t: number): Quad => ({
  tl: lerpPt(a.tl, b.tl, t),
  tr: lerpPt(a.tr, b.tr, t),
  br: lerpPt(a.br, b.br, t),
  bl: lerpPt(a.bl, b.bl, t),
});

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const pctBox = (r: { left: number; top: number; width: number; height: number }): CSSProperties => ({
  left: `${r.left}%`,
  top: `${r.top}%`,
  width: `${r.width}%`,
  height: `${r.height}%`,
});

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * v2 — the cinematic desk. You arrive standing in the room with the CRT
 * dark. Clicking the monitor sits you down: the room zooms and blurs, the
 * glass straightens into a head-on screen covering 75% of the viewport,
 * and the CRT powers on into LUNA OS. ESC, [ STAND UP ] or clicking the
 * room stands you back up and the screen goes dark again.
 */
export default function CinemaScene() {
  const [stage, setStage] = useState<Stage | null>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [lampOn, setLampOn] = useState(true);
  const [pose, setPose] = useState<Pose>("standing");
  const [progress, setProgress] = useState(0); // 0 = standing, 1 = seated (already eased)
  const [powered, setPowered] = useState(false);
  const [hint, setHint] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const rafRef = useRef(0);
  const fallbackRef = useRef(0);

  useLayoutEffect(() => {
    const update = () => {
      setVp({ w: window.innerWidth, h: window.innerHeight });
      setStage(fitStage(window.innerWidth, window.innerHeight));
    };
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

  const sitDown = useCallback(() => {
    if (pose !== "standing") return;
    setPose("sitting");
    animateTo(1, () => setPose("seated"));
  }, [pose, animateTo]);

  const standUp = useCallback(() => {
    if (pose !== "seated") return;
    setPowered(false);
    setPose("rising");
    animateTo(0, () => setPose("standing"));
  }, [pose, animateTo]);

  // The CRT lights up partway into the sit-down.
  useEffect(() => {
    if ((pose === "sitting" || pose === "seated") && progress >= POWER_ON_AT && !powered) {
      setPowered(true);
    }
  }, [pose, progress, powered]);

  // ESC stands up once nothing is open on the screen (CinemaScreen closes
  // its popup/window on the same keypress first; it is still in the DOM here).
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

  const seated = useMemo(() => (vp.w ? fitSeated(vp.w, vp.h) : null), [vp]);
  const quad = stage && seated ? lerpQuad(restQuad(stage), rectQuad(seated), progress) : null;
  const matrix = quad && seated ? quadMatrix3d(seated.w, seated.h, quad) : undefined;

  // The room zooms toward the glass and recenters on it while you sit down.
  const stageStyle = useMemo((): CSSProperties | undefined => {
    if (!stage || !seated) return undefined;
    const q = manifest.screen.quadPx;
    const cx = ((q.tl[0] + q.tr[0] + q.br[0] + q.bl[0]) / 4) * stage.scale;
    const cy = ((q.tl[1] + q.tr[1] + q.br[1] + q.bl[1]) / 4) * stage.scale;
    const restW = (Math.max(q.tr[0], q.br[0]) - Math.min(q.tl[0], q.bl[0])) * stage.scale;
    const k = seated.w / restW;
    const dx = vp.w / 2 - (stage.left + cx);
    const dy = vp.h / 2 - (stage.top + cy);
    return {
      left: stage.left,
      top: stage.top,
      width: stage.width,
      height: stage.height,
      transformOrigin: `${cx}px ${cy}px`,
      "--stage-zoom": `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${k.toFixed(3)})`,
    } as CSSProperties;
  }, [stage, seated, vp]);

  const bezelStyle = useMemo((): CSSProperties | undefined => {
    if (!seated) return undefined;
    const pad = seated.w * 0.05;
    return { left: seated.x - pad, top: seated.y - pad, width: seated.w + 2 * pad, height: seated.h + 2 * pad };
  }, [seated]);

  const zoomed = pose === "sitting" || pose === "seated";
  const classes = ["cinema", `cinema--${pose}`, stage ? "cinema--ready" : "", powered ? "cinema--powered" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} data-lamp={lampOn ? "on" : "off"} data-zoomed={zoomed ? "true" : "false"}>
      {/* Clicking the room stands you up; ESC and [ STAND UP ] cover keyboard users */}
      <div className="cinema__stage" style={stageStyle} onClick={pose === "seated" ? standUp : undefined}>
        <Image
          src="/cinema/room-screen-blank.webp"
          alt=""
          fill
          priority
          unoptimized
          sizes="100vw"
          draggable={false}
          className="cinema__backdrop"
        />
        <Image
          src="/cinema/room-lamp-off-screen-blank.webp"
          alt=""
          fill
          unoptimized
          sizes="100vw"
          draggable={false}
          className="cinema__backdrop cinema__backdrop--lamp-off"
        />

        {pose === "standing" && (
          <>
            <button
              type="button"
              className="cinema__hotspot cinema__hotspot--monitor"
              style={pctBox(manifest.hotspotsPct.monitor)}
              onClick={sitDown}
              aria-label="Sit down at the computer"
            />
            <button
              type="button"
              className="cinema__hotspot"
              style={pctBox(manifest.hotspotsPct.lamp)}
              onClick={() => setLampOn((v) => !v)}
              aria-label={lampOn ? "Turn the desk lamp off" : "Turn the desk lamp on"}
            />
          </>
        )}
      </div>

      {/* Head-on CRT chassis, fades in as you settle into the chair */}
      <div className="cinema__bezel" style={bezelStyle} aria-hidden="true">
        <span className="cinema__bezel-brand">▪ LUNATRON 4000</span>
        <span className="cinema__bezel-led" />
      </div>

      {/* The glass: angled in the photo, straight when seated */}
      {seated && (
        <div
          ref={screenRef}
          className="cinema__screen"
          style={{ width: seated.w, height: seated.h, transform: matrix, "--screen-w": `${seated.w}px` } as CSSProperties}
        >
          <div className="cinema__screen-inner">{powered && <CinemaScreen screenRef={screenRef} />}</div>
          <div className="cinema__glass" aria-hidden="true" />
        </div>
      )}

      {hint && pose === "standing" && (
        <p className="cinema__hint" aria-hidden="true">
          ▸ CLICK THE SCREEN TO SIT DOWN
        </p>
      )}
      {pose === "seated" && (
        <button type="button" className="cinema__standup" onClick={standUp}>
          [ STAND UP ] <span className="cinema__standup-key">ESC</span>
        </button>
      )}

      <div className="cinema__vignette" aria-hidden="true" />
      <div className="cinema__grain" aria-hidden="true" />
    </div>
  );
}
