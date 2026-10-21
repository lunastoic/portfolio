"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import manifestJson from "../../public/cinema/manifest.json";
import LofiOS, { type LofiPopup } from "./LofiOS";
import { Spring, clamp01, easeOutCubic } from "./physics";
import { Spill } from "./spill";
import "./cinema.css";

type Pose = "standing" | "sitting" | "seated" | "rising";
type LayoutKey = "desktop" | "mobile";
type PropKey =
  "mug" | "steam" | "note" | "lamp-head" | "plant-pot" | "plant-leaves";

interface PctBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Prop {
  file: string;
  boxPct: PctBox;
  originPct: number[];
  spill?: {
    boxPct: PctBox;
    width: number;
    height: number;
    pivot: number[];
    rim: number[];
    landY: number;
    mugLeft: number;
  };
}

interface Manifest {
  image: string;
  size: { width: number; height: number };
  screenPx: number[];
  focalPoint: number[];
  monitorPct: PctBox;
  decksPct: PctBox[];
  props: Partial<Record<PropKey, Prop>>;
  antPct: { from: number[]; to: number[] };
  colors: { coffee: { dark: string; mid: string; hi: string } };
}

const art = manifestJson as unknown as Manifest;

const SIT_MS = 1000;
/** Seated, the painted screen stands this tall relative to the viewport. */
const SEAT_FRACTION: Record<LayoutKey, number> = { desktop: 0.6, mobile: 0.55 };
/** Seated, the crop starts at least this far (art px) below the decks, so they stay out of view. */
const DECK_CLEARANCE = 6;
/** Progress at which the live OS takes over from the painted screen. */
const SCREEN_ON_AT = 0.9;
const HINT_DELAY_MS = 2200;

/** The mug's tap: tip over, hold while it pours, then spring back. */
const TIP_DEG = 36;
const TIP_S = 0.3;
const HOLD_S = 0.55;
const POUR_DEG = 18;

/** Back-to-front draw order of the props: the note is pinned to the wall behind the lamp head. */
const SPRITE_ORDER: PropKey[] = [
  "note",
  "lamp-head",
  "plant-pot",
  "plant-leaves",
  "steam",
  "mug",
];
/** What the sticky note says; laid over the blank pixel note in the terminal face. */
const NOTE_LINES = ["KEEP", "BUILDING", ":)"];
/** Sprite files are given as site paths; bare names are the cinema-assets.py cut-outs. */
const spriteSrc = (file: string) => (file.startsWith("/") ? file : `/cinema/${file}`);
const SPRITE_LABEL: Record<PropKey, string> = {
  mug: "Tap the coffee mug",
  steam: "",
  note: "Flick the sticky note",
  "lamp-head": "Tap the desk lamp",
  "plant-pot": "Nudge the plant",
  "plant-leaves": "Rustle the plant",
};

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Stage extends Rect {
  scale: number;
}

/** Everything that moves when a prop is tapped. Lives outside React state: the loop writes styles directly. */
interface World {
  mug: {
    phase: "idle" | "tip" | "return";
    t: number;
    angle: number;
    spring: Spring;
  };
  note: Spring;
  lampHead: Spring;
  potX: Spring;
  potRot: Spring;
  leafRot: Spring;
  leafX: Spring;
  spill: Spill | null;
  last: number;
  raf: number;
}

const createWorld = (): World => ({
  mug: { phase: "idle", t: 0, angle: 0, spring: new Spring(70, 5.5) },
  note: new Spring(85, 2.8),
  lampHead: new Spring(140, 6),
  potX: new Spring(260, 11),
  potRot: new Spring(300, 12),
  leafRot: new Spring(55, 2.6),
  leafX: new Spring(120, 6),
  spill: null,
  last: 0,
  raf: 0,
});

/** Portrait or narrow viewports use the phone framing of the same painting. */
const pickLayout = (vw: number, vh: number): LayoutKey =>
  vw > 0 && (vw < 900 || vh > vw * 1.15) ? "mobile" : "desktop";

/** Standing back from the desk: the whole painting cover-fits the viewport, monitor as centered as the crop allows. */
function standingStage(vw: number, vh: number): Stage {
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
 * viewport tall (capped by width on phones), centered on it, never showing the decks
 * above the monitor and never leaving the painting (no blank edges).
 */
function seatedStage(layout: LayoutKey, vw: number, vh: number): Stage {
  const { width: W, height: H } = art.size;
  const [sx0, sy0, sx1, sy1] = art.screenPx;
  const cover = Math.max(vw / W, vh / H);
  const fit = Math.min(
    (SEAT_FRACTION[layout] * vh) / (sy1 - sy0),
    (0.94 * vw) / (sx1 - sx0),
  );
  const scale = Math.max(cover * 1.12, fit);
  const cropW = vw / scale;
  const cropH = vh / scale;
  const deckBottom = art.decksPct.reduce(
    (m, d) => Math.max(m, ((d.top + d.height) / 100) * H),
    0,
  );
  const minTop = deckBottom ? deckBottom + DECK_CLEARANCE : 0;
  let top = Math.max(minTop, (sy0 + sy1) / 2 - cropH / 2);
  top = Math.min(top, H - cropH);
  let left = (sx0 + sx1) / 2 - cropW / 2;
  left = Math.min(Math.max(0, left), W - cropW);
  return {
    x: -left * scale,
    y: -top * scale,
    w: W * scale,
    h: H * scale,
    scale,
  };
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
function screenRect(s: Stage): Rect {
  const [x0, y0, x1, y1] = art.screenPx;
  return {
    x: s.x + x0 * s.scale,
    y: s.y + y0 * s.scale,
    w: (x1 - x0) * s.scale,
    h: (y1 - y0) * s.scale,
  };
}

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const pctBox = (r: PctBox): CSSProperties => ({
  left: `${r.left}%`,
  top: `${r.top}%`,
  width: `${r.width}%`,
  height: `${r.height}%`,
});

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * v2 — the lo-fi pixel desk. You arrive standing back, the whole painted room
 * filling the window. Clicking the monitor sits you down: the view zooms in on
 * the monitor (the decks above it slide out of frame) and the live LUNA_OS
 * takes over the glass. Standing, the props are sprites on springs (the mug,
 * note and plant are the pixel drafts from scripts/pixel-props.js, the lamp
 * head is cut from the painting): tap the mug and it tips and pours, the note
 * swings, the lamp head bobs, the plant gets nudged and its leaves sway while
 * an ant walks out. Seated, ESC, [ STAND UP ] or a click anywhere outside the
 * screen stands you back up.
 */
export default function CinemaScene() {
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [pose, setPose] = useState<Pose>("standing");
  const [progress, setProgress] = useState(0); // 0 = standing, 1 = seated (already eased)
  const [loadedImage, setLoadedImage] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [pendingPopup, setPendingPopup] = useState<LofiPopup>(null);
  const [flickerKey, setFlickerKey] = useState(0);
  const [antKey, setAntKey] = useState(0);
  const progressRef = useRef(0);
  const rafRef = useRef(0);
  const fallbackRef = useRef(0);
  const worldRef = useRef<World | null>(null);
  const elsRef = useRef<Partial<Record<PropKey, HTMLElement | null>>>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scaleRef = useRef(1);

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
      if (worldRef.current) cancelAnimationFrame(worldRef.current.raf);
    },
    [],
  );

  // Reveal the art once its image is in: the load event, or the image was
  // already complete when attached (cached / decoded before hydration), or
  // a short timeout so a slow network never leaves the room black.
  const loaded = loadedImage === art.image;
  useEffect(() => {
    const t = setTimeout(() => setLoadedImage(art.image), 4000);
    return () => clearTimeout(t);
  }, []);
  const attachBackdrop = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) setLoadedImage(art.image);
  }, []);

  /* ---------------- sit down / stand up ---------------- */

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
    [pose, animateTo],
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

  /* ---------------- the props' physics loop ---------------- */

  const loopRef = useRef<(now: number) => void>(() => {});
  useEffect(() => {
    loopRef.current = (now: number) => {
      const w = worldRef.current;
      if (!w) return;
      const dt = w.last ? Math.min(0.033, (now - w.last) / 1000) : 1 / 60;
      w.last = now;
      const s = scaleRef.current;

      // the mug: scripted tip and hold, then a spring brings it back with a wobble
      const m = w.mug;
      if (m.phase === "tip") {
        m.t += dt;
        if (m.t < TIP_S) m.angle = -TIP_DEG * easeOutCubic(m.t / TIP_S);
        else if (m.t < TIP_S + HOLD_S) {
          const u = (m.t - TIP_S) / HOLD_S;
          m.angle = -TIP_DEG + 2.5 * Math.sin(u * 14) * (1 - u);
        } else {
          m.phase = "return";
          m.spring.x = m.angle;
          m.spring.v = 60;
        }
      }
      if (m.phase === "return") {
        m.spring.step(dt);
        m.angle = m.spring.x;
        if (m.spring.idle) {
          m.spring.settle();
          m.angle = 0;
          m.phase = "idle";
        }
      }
      if (w.spill) {
        w.spill.setPouring(m.phase !== "idle" && m.angle < -POUR_DEG);
        w.spill.step(dt, m.angle);
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx) w.spill.draw(ctx);
      }

      // the leaves follow the pot with a lag, on top of their own swing
      w.leafRot.target = -w.potX.x * 1.1;
      w.leafX.target = w.potX.x;
      const springs = [
        w.note,
        w.lampHead,
        w.potX,
        w.potRot,
        w.leafRot,
        w.leafX,
      ];
      for (const sp of springs) sp.step(dt);

      const el = elsRef.current;
      const set = (node: HTMLElement | null | undefined, transform: string) => {
        if (node) node.style.transform = transform;
      };
      set(el.mug, `rotate(${m.angle.toFixed(2)}deg)`);
      if (el.steam) el.steam.style.opacity = String(clamp01(1 + m.angle / 20));
      set(el.note, `rotate(${w.note.x.toFixed(2)}deg)`);
      set(el["lamp-head"], `rotate(${w.lampHead.x.toFixed(2)}deg)`);
      set(
        el["plant-pot"],
        `translate(${(w.potX.x * s).toFixed(1)}px, 0) rotate(${w.potRot.x.toFixed(2)}deg)`,
      );
      set(
        el["plant-leaves"],
        `translate(${(w.leafX.x * s).toFixed(1)}px, 0) rotate(${w.leafRot.x.toFixed(2)}deg)`,
      );

      const idle =
        m.phase === "idle" &&
        !(w.spill && w.spill.active) &&
        springs.every((sp) => sp.idle);
      if (idle) {
        for (const sp of springs) sp.settle();
        w.raf = 0;
        w.last = 0;
      } else {
        w.raf = requestAnimationFrame(loopRef.current);
      }
    };
  }, []);

  const ensureRunning = useCallback(() => {
    const w = worldRef.current;
    if (w && !w.raf) {
      w.last = 0;
      w.raf = requestAnimationFrame(loopRef.current);
    }
  }, []);

  const tap = useCallback(
    (key: PropKey) => (e: React.MouseEvent) => {
      if (pose !== "standing") return;
      e.stopPropagation();
      if (prefersReducedMotion()) return;
      if (!worldRef.current) worldRef.current = createWorld();
      const w = worldRef.current;
      switch (key) {
        case "mug": {
          if (w.mug.phase !== "idle") break;
          const geom = art.props.mug?.spill;
          if (!w.spill && geom) {
            w.spill = new Spill(
              {
                width: geom.width,
                height: geom.height,
                pivot: [geom.pivot[0], geom.pivot[1]],
                rim: [geom.rim[0], geom.rim[1]],
                landY: geom.landY,
                mugLeft: geom.mugLeft,
              },
              art.colors.coffee,
            );
          }
          w.mug.phase = "tip";
          w.mug.t = 0;
          break;
        }
        case "note":
          w.note.kick(240);
          break;
        case "lamp-head":
          w.lampHead.kick(90);
          setFlickerKey((k) => k + 1);
          break;
        case "plant-pot":
        case "plant-leaves":
          w.potX.kick(150);
          w.potRot.kick(60);
          w.leafRot.kick(-85);
          setAntKey((k) => k + 1);
          break;
        default:
          break;
      }
      ensureRunning();
    },
    [pose, ensureRunning],
  );

  /* ---------------- geometry ---------------- */

  const layout = pickLayout(vp.w, vp.h);
  const ready = vp.w > 0;
  const stage = ready
    ? lerpStage(
        standingStage(vp.w, vp.h),
        seatedStage(layout, vp.w, vp.h),
        progress,
      )
    : null;
  const stageScale = stage?.scale ?? 1;
  useEffect(() => {
    scaleRef.current = stageScale;
  }, [stageScale]);
  const screen = stage ? screenRect(stage) : null;
  const screenOn =
    pose === "seated" || (pose === "sitting" && progress >= SCREEN_ON_AT);

  const antStyle = (): CSSProperties | undefined => {
    if (!stage) return undefined;
    const { from, to } = art.antPct;
    return {
      left: `${from[0]}%`,
      top: `${from[1]}%`,
      "--ant-dx": `${((to[0] - from[0]) / 100) * stage.w}px`,
      "--ant-dy": `${((to[1] - from[1]) / 100) * stage.h}px`,
    } as CSSProperties;
  };

  const classes = [
    "cinema",
    `cinema--${pose}`,
    ready && loaded ? "cinema--ready" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const spill = art.props.mug?.spill;

  return (
    <div className={classes} data-layout={layout}>
      {/* Standing, the monitor sits you down (the props are easter eggs); seated, anything
          outside the live screen stands you up. ESC and [ STAND UP ] cover keyboard users. */}
      <div
        className="cinema__stage"
        style={
          stage
            ? { left: stage.x, top: stage.y, width: stage.w, height: stage.h }
            : undefined
        }
        onClick={pose === "seated" ? standUp : undefined}
      >
        <Image
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

        {/* The props in their places on the painting, each on its own spring */}
        {SPRITE_ORDER.map((k) => {
          const p = art.props[k];
          if (!p) return null;
          const style: CSSProperties = {
            ...pctBox(p.boxPct),
            transformOrigin: `${p.originPct[0]}% ${p.originPct[1]}%`,
          };
          const img = (
            <Image
              src={spriteSrc(p.file)}
              alt=""
              fill
              unoptimized
              draggable={false}
            />
          );
          const attach = (node: HTMLElement | null) => {
            elsRef.current[k] = node;
          };
          if (k === "steam") {
            return (
              <div
                key={k}
                ref={attach}
                className="cinema__sprite cinema__sprite--steam"
                style={style}
                aria-hidden="true"
              >
                {img}
              </div>
            );
          }
          return (
            <button
              key={k}
              ref={attach}
              type="button"
              className={`cinema__sprite cinema__sprite--${k}`}
              style={style}
              onClick={tap(k)}
              tabIndex={pose === "standing" ? 0 : -1}
              aria-label={SPRITE_LABEL[k]}
            >
              {img}
              {k === "note" && (
                <span className="cinema__note-text" aria-hidden="true">
                  {NOTE_LINES.map((line, i) => (
                    <span key={i}>{line}</span>
                  ))}
                </span>
              )}
            </button>
          );
        })}

        {/* The coffee that slops out of the tipped mug, drawn on the painting's pixel grid */}
        {spill && (
          <canvas
            ref={canvasRef}
            className="cinema__spill"
            width={spill.width}
            height={spill.height}
            style={pctBox(spill.boxPct)}
            aria-hidden="true"
          />
        )}

        {pose === "standing" && (
          <button
            type="button"
            className="cinema__hotspot cinema__hotspot--monitor"
            style={pctBox(art.monitorPct)}
            onClick={() => sitDown()}
            aria-label="Sit down at the computer"
          />
        )}

        {antKey > 0 && (
          <div
            key={antKey}
            className="cinema__ant"
            style={antStyle()}
            onAnimationEnd={() => setAntKey(0)}
            aria-hidden="true"
          >
            <Image
              src="/cinema/sprite-ant.png"
              alt=""
              width={28}
              height={16}
              unoptimized
              draggable={false}
            />
          </div>
        )}

        {flickerKey > 0 && (
          <div
            key={flickerKey}
            className="cinema__flicker"
            onAnimationEnd={() => setFlickerKey(0)}
            aria-hidden="true"
          />
        )}
        <div className="cinema__dark" aria-hidden="true" />
      </div>

      {/* The live screen rides the painted one; it only lights up seated */}
      {screen && (
        <div
          className="cinema__screen"
          style={
            {
              left: screen.x,
              top: screen.y,
              width: screen.w,
              height: screen.h,
              "--screen-w": `${screen.w}px`,
            } as CSSProperties
          }
        >
          {screenOn && <LofiOS initialPopup={pendingPopup} />}
        </div>
      )}

      {!loaded && (
        <div className="cinema__loading" aria-live="polite">
          <Image
            src="/cinema/mug.png"
            alt=""
            width={146}
            height={142}
            unoptimized
            draggable={false}
          />
          <span>
            BREWING
            <span className="cursor-blink" aria-hidden="true" />
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
