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
type PropKey = "mug" | "steam" | "note" | "plant-pot" | "plant-leaves";

interface PctBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Prop {
  file: string;
  boxPct: PctBox;
  boxPx: number[];
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
  notes: string[];
  lamp: { off: { file: string; boxPct: PctBox }; shade: string; hitPct: PctBox };
  pens: { files: string[]; boxPct: PctBox; originPct: number[][]; hitPct: PctBox };
  antPct: { from: number[]; to: number[] };
  colors: { coffee: { dark: string; mid: string; hi: string } };
}

const art = manifestJson as unknown as Manifest;

const SIT_MS = 1900;
const STAND_MS = 1500;
/** Seated, the painted screen stands this tall relative to the viewport. */
const SEAT_FRACTION: Record<LayoutKey, number> = { desktop: 0.6, mobile: 0.55 };
/** Seated, the crop starts at least this far (art px) below the decks, so they stay out of view. */
const DECK_CLEARANCE = 6;
/** Progress at which the live OS takes over from the painted screen. */
const SCREEN_ON_AT = 0.9;
const HINT_DELAY_MS = 2200;

/** The mug's tap: a knock that rocks it onto its heel, sloshes a little over the rim, and lets it settle. */
const JOLT_DEG = 13;
const JOLT_S = 0.13;
const SLOSH_DROPS = 34;

/** The sticky note: peel off the wall, drift down like paper, land flat on the desk, fade. */
const PEEL_S = 0.24;
const NOTE_GRAVITY = 900; // art px / s²
const NOTE_DRAG = 5.2; // 1/s, so it falls at about 170 art px/s
const NOTE_SWAY = 34; // art px
const NOTE_SWAY_W = 5.2; // rad/s
const NOTE_LAND_Y = 412; // art px below the wall spot: the desk behind the mug
const NOTE_REST_S = 1.4;
const NOTE_FADE_S = 0.6;

/** What each sticky note says, in the order they come off the wall; laid over the blank pixel notes. */
const NOTE_TEXTS = [
  ["KEEP", "BUILDING", ":)"],
  ["SHIP", "IT"],
  ["DRINK", "WATER"],
  ["COMMIT", "OFTEN"],
  ["TODO:", "SLEEP"],
  ["HELLO", "WORLD"],
  ["ONE", "MORE", "BUG"],
];
/** Sprite files are given as site paths; bare names are the cinema-assets.py cut-outs. */
const spriteSrc = (file: string) => (file.startsWith("/") ? file : `/cinema/${file}`);

/** Back-to-front draw order of the props. */
const SPRITE_ORDER: PropKey[] = ["plant-pot", "plant-leaves", "steam", "mug"];
const SPRITE_LABEL: Record<PropKey, string> = {
  mug: "Knock the coffee mug",
  steam: "",
  note: "Peel off the sticky note",
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

/** The camera's extra move on top of the standing→seated framing: a lift, a lean and the zoom it needs to cover. */
interface Cam {
  dy: number;
  rot: number;
  zoom: number;
}
const CAM_REST: Cam = { dy: 0, rot: 0, zoom: 1 };

/** Everything that moves when a prop is tapped. Lives outside React state: the loop writes styles directly. */
interface World {
  mug: {
    phase: "idle" | "jolt" | "return";
    t: number;
    angle: number;
    spring: Spring;
    slide: Spring;
  };
  note: {
    phase: "idle" | "peel" | "fall" | "land";
    t: number;
    x: number;
    y: number;
    vy: number;
    rot: number;
    tilt: number;
    side: number;
    opacity: number;
  };
  pens: Spring[];
  potX: Spring;
  potRot: Spring;
  leafRot: Spring;
  leafX: Spring;
  spill: Spill | null;
  last: number;
  raf: number;
}

const createWorld = (): World => ({
  mug: { phase: "idle", t: 0, angle: 0, spring: new Spring(90, 6.5), slide: new Spring(210, 14) },
  note: { phase: "idle", t: 0, x: 0, y: 0, vy: 0, rot: 0, tilt: 0, side: 1, opacity: 1 },
  pens: [new Spring(170, 4.2), new Spring(150, 3.6), new Spring(190, 4.6)],
  potX: new Spring(260, 11),
  potRot: new Spring(300, 12),
  leafRot: new Spring(55, 2.6),
  leafX: new Spring(120, 6),
  spill: null,
  last: 0,
  raf: 0,
});

const worldOf = (ref: { current: World | null }) => (ref.current ??= createWorld());

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

/**
 * Sitting down, as a body does it, for raw time u (0→1). Two steps up to the desk
 * (the view bobs and rolls with each), standing over it the monitor sits low in view,
 * then you lower into the chair: the screen rises to eye level, the view leans a
 * touch and the cushion gives a little bounce. Standing up runs the same path
 * backwards, without the bounce.
 */
function sitPath(u: number, rising: boolean, vh: number): { p: number; cam: Cam } {
  const v = rising ? 1 - u : u;
  const p = easeInOut(clamp01((v - 0.06) / 0.8));
  const walk = clamp01(v / 0.48);
  const stepping = v < 0.48 ? 1 - walk * 0.35 : 0;
  const bob = Math.abs(Math.sin(walk * 2 * Math.PI)) * 0.011 * vh * stepping;
  const sway = Math.sin(walk * 2 * Math.PI) * 0.35 * stepping;
  // over the desk, then down into the chair
  const over = Math.sin(Math.PI * clamp01(v / 0.66)) * 0.07 * vh;
  const s = clamp01((v - 0.66) / 0.34);
  const cushion = rising ? 0 : -Math.sin(Math.PI * s) * Math.exp(-2.2 * s) * 0.026 * vh;
  const lean = -Math.sin(Math.PI * clamp01((v - 0.42) / 0.5)) * 0.8;
  const dy = bob + over + cushion;
  const rot = sway + lean;
  return {
    p,
    cam: { dy, rot, zoom: 1 + (Math.abs(dy) * 2.1) / vh + Math.abs(rot) * 0.014 },
  };
}

const pctBox = (r: PctBox): CSSProperties => ({
  left: `${r.left}%`,
  top: `${r.top}%`,
  width: `${r.width}%`,
  height: `${r.height}%`,
});

/** Only the sit-down camera move honours this: the props move because someone clicked them. */
const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function NoteFace({ index }: { index: number }) {
  const n = art.notes.length;
  return (
    <>
      <Image src={art.notes[index % n]} alt="" fill unoptimized draggable={false} />
      <span className="cinema__note-text" aria-hidden="true">
        {NOTE_TEXTS[index % NOTE_TEXTS.length].map((line, i) => (
          <span key={i}>{line}</span>
        ))}
      </span>
    </>
  );
}

/**
 * v2 — the lo-fi pixel desk. You arrive standing back, the whole painted room
 * filling the window. Clicking the monitor sits you down: two steps up to the desk,
 * then down into the chair, and the live LUNA_OS takes over the glass. Standing, the
 * desk is alive: knock the mug and it rocks and sloshes a little coffee, peel the
 * sticky note and it drifts down to the desk with the next one waiting behind it,
 * tap the pencil cup and the pens rattle, click the lamp to switch it off and on,
 * nudge the plant and an ant walks out. Seated, ESC, [ STAND UP ] or a click
 * anywhere outside the screen stands you back up.
 */
export default function CinemaScene() {
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [pose, setPose] = useState<Pose>("standing");
  const [progress, setProgress] = useState(0); // 0 = standing, 1 = seated (already eased)
  const [cam, setCam] = useState<Cam>(CAM_REST);
  const [loadedImage, setLoadedImage] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [pendingPopup, setPendingPopup] = useState<LofiPopup>(null);
  const [antKey, setAntKey] = useState(0);
  const [noteIndex, setNoteIndex] = useState(0);
  const [fallingNote, setFallingNote] = useState<number | null>(null);
  const [lampOn, setLampOn] = useState(true);
  const [lampSwitches, setLampSwitches] = useState(0);
  const progressRef = useRef(0);
  const rafRef = useRef(0);
  const fallbackRef = useRef(0);
  const worldRef = useRef<World | null>(null);
  const elsRef = useRef<Partial<Record<PropKey, HTMLElement | null>>>({});
  const fallerRef = useRef<HTMLDivElement | null>(null);
  const penRefs = useRef<(HTMLDivElement | null)[]>([]);
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

  /** Walk the sit (or stand) path from start to end; standing and seated are its two ends. */
  const animateTo = useCallback((to: 0 | 1, onDone: () => void) => {
    cancelAnimationFrame(rafRef.current);
    clearTimeout(fallbackRef.current);
    const rising = to === 0;
    const set = (p: number, c: Cam) => {
      progressRef.current = p;
      setProgress(p);
      setCam(c);
    };
    if (prefersReducedMotion() || progressRef.current === to) {
      set(to, CAM_REST);
      onDone();
      return;
    }
    const duration = rising ? STAND_MS : SIT_MS;
    const start = performance.now();
    const finish = () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(fallbackRef.current);
      set(to, CAM_REST);
      onDone();
    };
    const step = (now: number) => {
      const u = Math.min(1, (now - start) / duration);
      if (u >= 1) return finish();
      const { p, cam: c } = sitPath(u, rising, window.innerHeight);
      set(p, c);
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

      // the mug: knocked onto its heel, then a spring rocks it back down and it slides to rest
      const m = w.mug;
      if (m.phase === "jolt") {
        m.t += dt;
        m.angle = -JOLT_DEG * easeOutCubic(m.t / JOLT_S);
        if (m.t >= JOLT_S) {
          m.phase = "return";
          m.spring.x = m.angle;
          m.spring.v = 0;
          w.spill?.slosh(m.angle, SLOSH_DROPS);
        }
      }
      if (m.phase === "return") {
        m.spring.step(dt);
        // a mug rocks on its rim and lands on its base: it can't tip the other way past flat
        m.angle = Math.min(0.6, m.spring.x);
        if (m.spring.x > 0.6) m.spring.v *= -0.35;
        if (m.spring.idle) {
          m.spring.settle();
          m.angle = 0;
          m.phase = "idle";
        }
      }
      m.slide.step(dt);
      if (w.spill) {
        w.spill.step(dt, m.angle);
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx) w.spill.draw(ctx);
      }

      // the falling sticky note
      const n = w.note;
      if (n.phase !== "idle") {
        n.t += dt;
        if (n.phase === "peel") {
          // the bottom lets go first and curls off the wall, one corner ahead of the other
          const k = easeOutCubic(n.t / PEEL_S);
          n.tilt = 30 * k;
          n.rot = 5 * n.side * k;
          n.y = 6 * k * k;
          if (n.t >= PEEL_S) {
            n.phase = "fall";
            n.t = 0;
            n.vy = 40;
          }
        } else if (n.phase === "fall") {
          // paper falls at a slow terminal speed, gliding side to side and banking into each swing
          n.vy += (NOTE_GRAVITY - NOTE_DRAG * n.vy) * dt;
          n.y += n.vy * dt;
          const grow = 1 - Math.exp(-2.4 * n.t);
          const ph = NOTE_SWAY_W * n.t;
          n.x = NOTE_SWAY * grow * Math.sin(ph) * n.side;
          n.rot = 5 * n.side * (1 - grow) + 16 * grow * Math.cos(ph) * n.side;
          n.tilt = 30 + 24 * grow * Math.sin(2 * ph + 0.6);
          if (n.y >= NOTE_LAND_Y) {
            n.y = NOTE_LAND_Y;
            n.phase = "land";
            n.t = 0;
          }
        } else {
          // flat on the desk: it settles, rests a moment, then goes
          const k = easeOutCubic(n.t / 0.28);
          n.tilt = lerp(n.tilt, 78, k);
          n.rot *= 1 - 0.12 * Math.min(1, dt * 60);
          n.opacity = 1 - clamp01((n.t - NOTE_REST_S) / NOTE_FADE_S);
          if (n.t >= NOTE_REST_S + NOTE_FADE_S) {
            n.phase = "idle";
            setFallingNote(null);
          }
        }
        const f = fallerRef.current;
        if (f) {
          f.style.transform = `translate(${(n.x * s).toFixed(1)}px, ${(n.y * s).toFixed(1)}px) perspective(${(600 * s).toFixed(0)}px) rotateZ(${n.rot.toFixed(2)}deg) rotateX(${n.tilt.toFixed(2)}deg)`;
          f.style.opacity = n.opacity.toFixed(3);
        }
      }

      // the leaves follow the pot with a lag, on top of their own swing
      w.leafRot.target = -w.potX.x * 1.1;
      w.leafX.target = w.potX.x;
      const springs = [...w.pens, w.potX, w.potRot, w.leafRot, w.leafX];
      for (const sp of springs) sp.step(dt);

      const el = elsRef.current;
      const set = (node: HTMLElement | null | undefined, transform: string) => {
        if (node) node.style.transform = transform;
      };
      set(el.mug, `translate(${(m.slide.x * s).toFixed(1)}px, 0) rotate(${m.angle.toFixed(2)}deg)`);
      set(el.steam, `translate(${(m.slide.x * s).toFixed(1)}px, 0)`);
      if (el.steam) el.steam.style.opacity = String(clamp01(1 + m.angle / 8));
      w.pens.forEach((sp, i) => set(penRefs.current[i], `rotate(${sp.x.toFixed(2)}deg)`));
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
        m.slide.idle &&
        n.phase === "idle" &&
        !(w.spill && w.spill.active) &&
        springs.every((sp) => sp.idle);
      if (idle) {
        for (const sp of [...springs, m.slide]) sp.settle();
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
      const w = worldOf(worldRef);
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
          w.mug.phase = "jolt";
          w.mug.t = 0;
          // the knock shoves it a few pixels along the desk and it stays there; the next one shoves it back
          w.mug.slide.target = w.mug.slide.target ? 0 : 3;
          w.mug.slide.kick(w.mug.slide.target ? 90 : -90);
          break;
        }
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

  const peelNote = useCallback(
    (e: React.MouseEvent) => {
      if (pose !== "standing") return;
      e.stopPropagation();
      if (fallingNote !== null) return;
      const next = noteIndex + 1;
      const w = worldOf(worldRef);
      Object.assign(w.note, {
        phase: "peel",
        t: 0,
        x: 0,
        y: 0,
        vy: 0,
        rot: 0,
        tilt: 0,
        side: Math.random() < 0.5 ? -1 : 1,
        opacity: 1,
      });
      setFallingNote(noteIndex);
      setNoteIndex(next);
      ensureRunning();
    },
    [pose, fallingNote, noteIndex, ensureRunning],
  );

  const rattlePens = useCallback(
    (e: React.MouseEvent) => {
      if (pose !== "standing") return;
      e.stopPropagation();
      const w = worldOf(worldRef);
      // each pen knocks against the next: opposite directions, different strengths
      const side = Math.random() < 0.5 ? -1 : 1;
      [55, -70, 48].forEach((v, i) => w.pens[i].kick(side * v * (0.8 + Math.random() * 0.4)));
      ensureRunning();
    },
    [pose, ensureRunning],
  );

  const switchLamp = useCallback(
    (e: React.MouseEvent) => {
      if (pose !== "standing") return;
      e.stopPropagation();
      setLampOn((on) => !on);
      setLampSwitches((n) => n + 1);
    },
    [pose],
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
  const note = art.props.note;
  const camStyle: CSSProperties | undefined =
    cam === CAM_REST
      ? undefined
      : {
          transform: `translateY(${cam.dy.toFixed(1)}px) rotate(${cam.rot.toFixed(3)}deg) scale(${cam.zoom.toFixed(4)})`,
        };
  const standingTab = pose === "standing" ? 0 : -1;

  return (
    <div className={classes} data-layout={layout}>
      {/* The camera: the stage and the live screen move together as you sit down and stand up */}
      <div className="cinema__camera" style={camStyle}>
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

          {/* The lamp's head with the bulb out, over the painted one */}
          <div
            key={`head-${lampSwitches}`}
            className={`cinema__lamp-off${lampOn ? "" : " is-off"}${lampSwitches ? " is-switching" : ""}`}
            style={pctBox(art.lamp.off.boxPct)}
            aria-hidden="true"
          >
            <Image src={art.lamp.off.file} alt="" fill unoptimized draggable={false} />
          </div>

          {/* The sticky notes on the wall: the one you can peel, and the next one under it */}
          {note && (
            <>
              <div
                className="cinema__sprite cinema__sprite--note cinema__note-under"
                style={pctBox(note.boxPct)}
                aria-hidden="true"
              >
                <NoteFace index={noteIndex + 1} />
              </div>
              <button
                key={`note-${noteIndex}`}
                type="button"
                className="cinema__sprite cinema__sprite--note"
                style={pctBox(note.boxPct)}
                onClick={peelNote}
                tabIndex={standingTab}
                aria-label={SPRITE_LABEL.note}
              >
                <NoteFace index={noteIndex} />
              </button>
              {fallingNote !== null && (
                <div
                  ref={fallerRef}
                  className="cinema__sprite cinema__sprite--note cinema__note-falling"
                  style={{ ...pctBox(note.boxPct), transformOrigin: "50% 3%" }}
                  aria-hidden="true"
                >
                  <NoteFace index={fallingNote} />
                </div>
              )}
            </>
          )}

          {/* The pens in the cat pencil cup, cut from the painting, each rocking on its own */}
          {art.pens.files.map((file, i) => (
            <div
              key={file}
              ref={(node) => {
                penRefs.current[i] = node;
              }}
              className="cinema__pen"
              style={{
                ...pctBox(art.pens.boxPct),
                transformOrigin: `${art.pens.originPct[i][0]}% ${art.pens.originPct[i][1]}%`,
              }}
              aria-hidden="true"
            >
              <Image src={file} alt="" fill unoptimized draggable={false} />
            </div>
          ))}

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
                tabIndex={standingTab}
                aria-label={SPRITE_LABEL[k]}
              >
                {img}
              </button>
            );
          })}

          {/* The coffee that slops out of the knocked mug, drawn on the painting's pixel grid */}
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

          {/* With the lamp off, the wall and desk it lit fall into shadow */}
          <div
            key={`shade-${lampSwitches}`}
            className={`cinema__lamp-shade${lampOn ? "" : " is-off"}${lampSwitches ? " is-switching" : ""}`}
            style={{ backgroundImage: `url(${art.lamp.shade})` }}
            aria-hidden="true"
          />

          {pose === "standing" && (
            <>
              <button
                type="button"
                className="cinema__hotspot cinema__hotspot--monitor"
                style={pctBox(art.monitorPct)}
                onClick={() => sitDown()}
                aria-label="Sit down at the computer"
              />
              <button
                type="button"
                className="cinema__hotspot cinema__hotspot--lamp"
                style={pctBox(art.lamp.hitPct)}
                onClick={switchLamp}
                aria-label={lampOn ? "Switch the desk lamp off" : "Switch the desk lamp on"}
              />
              <button
                type="button"
                className="cinema__hotspot cinema__hotspot--pens"
                style={pctBox(art.pens.hitPct)}
                onClick={rattlePens}
                aria-label="Rattle the pencil cup"
              />
            </>
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
      </div>

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
