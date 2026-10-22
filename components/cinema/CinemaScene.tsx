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
import manifestJson from "../../public/cinema/room.json";
import LavaLamp from "./LavaLamp";
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
  lamp: {
    /** The whole painting again with the lamp switched off, laid over the lit one. */
    off: string;
    /** The shade's right edge, over the sticky notes on the wall behind it. */
    front?: { file: string; boxPct: PctBox };
    hitPct: PctBox;
  };
  /** The room past the painting's edges (wall, desk, the things the edge cuts), lit and unlit. */
  sides: { px: number; left: string; right: string; leftOff: string; rightOff: string };
  /** The lava lamp: with `off`, it's part of the picture and `off` is its switched-off look laid over it. */
  lava: { boxPct: PctBox; off?: string };
  pens: { files: string[]; boxPct: PctBox; originPct: number[][]; hitPct: PctBox };
  leaves: { stems: string; files: string[]; originPct: number[][] };
  antPct: { from: number[]; to: number[] };
  /** Where a peeled note comes to rest, art px from where it hangs: on the desk behind the mug. */
  noteLand: { dx: number; dy: number };
  /** How far the deck and spine words move in the widened room (art px). */
  textDx?: number;
  /** Sprites that just sit in the room (the console, controller, headset and its cable), back to front. */
  decor?: { name: string; file: string; boxPct: PctBox; z: number }[];
  colors: { coffee: { dark: string; mid: string; hi: string } };
}

const art = manifestJson as unknown as Manifest;


const SIT_MS = 1700;
const STAND_MS = 1400;
/** Seated, the painted screen stands this tall relative to the viewport. */
const SEAT_FRACTION: Record<LayoutKey, number> = { desktop: 0.6, mobile: 0.55 };
/** Seated, the crop starts at least this far (art px) below the decks, so they stay out of view. */
const DECK_CLEARANCE = 12; // clears the brackets under the deck too
const HINT_DELAY_MS = 2200;

/** The mug's tap: each click bumps it a little further back across the desk, upright, up to
 *  three bumps, slopping a little coffee off the back of the rim each time. The first bump also sends
 *  one slow run of coffee over the front lip and down the mug's face; once that is halfway down, the
 *  next bump sends a second, slower one, and that's the last. It all stays until the page is reloaded. */
const PUSH_S = 0.35;
const PUSH_STEP = 4.5; // art px up the desk (away from you) per bump
const PUSH_MAX = 3; // bumps before it won't go further
const PUSH_SHRINK = 0.003; // per art px further away, a hair smaller
const LEAK_DROPS = 10;
const RUN_SLOWER = 0.65; // the second run's pace against the first
const RUN_GAP = 22; // canvas px the second run keeps clear of the first
const LEAK_POOL = [34, 6]; // art px: the front puddle's half-width and half-depth, small
/** Coffee over the front lip: where it runs down the mug's face, canvas px (body is x 110–228). */
/** Art px as a share of the stage's width (container query units), so a prop's move scales with the stage
 *  as you sit and stand instead of being pinned at the px it was last drawn at. */
const cq = (artPx: number) => `${((artPx / art.size.width) * 100).toFixed(3)}cqw`;
const DRIP_LIP = 82;
const DRIP_BASE = 243;
const DRIP_X = [118, 216];

/** The sticky note: peel off the wall, drift down like paper, land flat on the desk, fade. */
const PEEL_S = 0.24;
/** Lying on the desk, how far over the note lies (degrees from the wall): flat as the desk is seen. */
const NOTE_FLAT = 80;
const NOTE_GRAVITY = 900; // art px / s²
const NOTE_DRAG = 5.2; // 1/s, so it falls at about 170 art px/s
const NOTE_SWAY = 34; // art px
const NOTE_SWAY_W = 5.2; // rad/s
const NOTE_LAND_Y = art.noteLand.dy; // art px below the wall spot: its top edge on the desk's back edge, behind the mug
const NOTE_LAND_X = art.noteLand.dx; // art px it glides across on the way down: its middle behind the mug's body
const NOTE_SCATTER = [10, 3, 14]; // a landed note's spread: ± art px across, ± art px deep, ± degrees
/** The eye's distance for the note's tilt, art px: far, so a note lying on the desk is a strip, not a wedge. */
const NOTE_EYE = 1600;
const NOTE_SETTLE = 80; // art px above its landing spot where it starts to lie down

/** What each sticky note says, in the order they come off the wall: a real to-do list. */
const NOTE_TEXTS = [
  ["WRITE", "TESTS"],
  ["FIX NAV", "ON MOBILE"],
  ["DRINK", "WATER"],
  ["UPDATE", "RESUME"],
  ["STANDUP", "10:00"],
  ["PUSH", "TO MAIN"],
  ["GYM", "6 PM"],
];

/**
 * The words round the room (the decks and the book spines), set in real type over the places the painting's own
 * lettering was cleared (scripts/cinema-blend.js). Painting px (mapped into the widened room by mapX): x, y is
 * the text's anchor (its centre, or its left middle with align "left"), size the font size, rotate follows the
 * book spines' slant.
 */
/** A run of a line in its own colour (the school's two colours share a line). */
type WallRun = { text: string; color: string };
interface WallText {
  lines: (string | WallRun[])[];
  x: number;
  y: number;
  size: number;
  color: string;
  align?: "center" | "left";
  rotate?: number;
  track?: number;
  weight?: number;
  leading?: number;
  /** A thin dark edge, for gold on the light deck. */
  edged?: boolean;
}
const CSU_BURGUNDY = "#7e012d";
const DH_GOLD = "#fcbe11";
const NAME_GOLD = "#f6bb5c";
// art px = mockup px x 1.2 (scripts/mockup-room.js)
const SPINE = "#d9b77a";
const WALL_TEXT: WallText[] = [
  { lines: ["CHRISTOPHER LUNA"], x: 781, y: 61, size: 44, color: NAME_GOLD, weight: 700, track: 0.06 },
  { lines: ["LUNA_CHRISTOPHER98@HOTMAIL.COM"], x: 781, y: 99, size: 19, color: "#e9b468", weight: 500, track: 0.06 },
  { lines: ["ANAHEIM, CA 92806  ·  (714) 800-3264"], x: 781, y: 120, size: 14.5, color: "#e9b468", weight: 500, track: 0.08 },
  // the school in its colours, CSU burgundy and DH gold, then the degree in the name's colour
  {
    lines: [[{ text: "CALIFORNIA STATE UNIVERSITY, ", color: CSU_BURGUNDY }, { text: "DOMINGUEZ HILLS", color: DH_GOLD }]],
    x: 781, y: 210, size: 22, color: CSU_BURGUNDY, weight: 700, track: 0.07,
  },
  { lines: ["BACHELOR OF SCIENCE  ·  COMPUTER SCIENCE"], x: 781, y: 239, size: 18, color: NAME_GOLD, weight: 600, track: 0.06, edged: true },
  { lines: ["FIRST GEN"], x: 781, y: 262, size: 13.5, color: NAME_GOLD, weight: 600, track: 0.08, edged: true },
  // the three books under the monitor, titles in gilt on their spines
  { lines: ["COMPUTER SCIENCE"], x: 625, y: 693, size: 15.5, color: SPINE, align: "left", track: 0.1, weight: 600 },
  { lines: ["DATA STRUCTURES & ALGORITHMS"], x: 625, y: 730, size: 15.5, color: SPINE, align: "left", track: 0.1, weight: 600 },
  { lines: ["COMPUTER ORGANIZATION"], x: 625, y: 766, size: 15.5, color: SPINE, align: "left", track: 0.1, weight: 600 },
];
const wallTextStyle = (t: WallText): CSSProperties => ({
  left: `${((t.x + (art.textDx ?? 0)) / art.size.width) * 100}%`,
  top: `${(t.y / art.size.height) * 100}%`,
  fontSize: `${(t.size / art.size.width) * 100}cqw`,
  color: t.color,
  fontWeight: t.weight ?? 600,
  letterSpacing: `${t.track ?? 0}em`,
  lineHeight: t.leading ?? 1,
  textAlign: t.align ?? "center",
  transform: `translate(${t.align === "left" ? "0" : "-50%"}, -50%) rotate(${t.rotate ?? 0}deg)`,
  transformOrigin: t.align === "left" ? "0 50%" : "50% 50%",
});
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

/** The camera's extra move on top of the standing→seated framing: a lift, and the zoom it needs to cover. */
interface Cam {
  dy: number;
  zoom: number;
}
const CAM_REST: Cam = { dy: 0, zoom: 1 };

interface NoteFall {
  id: number;
  phase: "peel" | "fall" | "land" | "rest";
  t: number;
  x: number;
  y: number;
  vy: number;
  /** Its bank in the air (a turn in the screen's plane), gone by the time it lands. */
  rot: number;
  /** How far it has tipped over, from flat on the wall (0) toward flat on the desk (NOTE_FLAT). */
  tilt: number;
  /** Its turn in its own plane, so it lies on the desk askew rather than standing askew. */
  yaw: number;
  side: number;
  /** Where it ends up: a little off the others, so they pile up scattered. */
  landY: number;
  landRot: number;
  landDx: number;
}

/** Everything that moves when a prop is tapped. Lives outside React state: the loop writes styles directly. */
interface World {
  mug: {
    phase: "rest" | "pushing";
    t: number;
    /** How far back it is (art px), and where this bump started and will end. */
    pos: number;
    from: number;
    to: number;
    bumps: number;
    /** A little shiver when it's knocked again where it stands. */
    nudge: Spring;
  };
  /** Every note peeled off the wall, in the order they came off: falling, landing or lying on the desk. */
  notes: NoteFall[];
  pens: Spring[];
  /** One per leaf, back to front: each flutters on its own stem. */
  leaves: Spring[];
  spill: Spill | null;
  last: number;
  raf: number;
}

const createWorld = (): World => ({
  mug: { phase: "rest", t: 0, pos: 0, from: 0, to: 0, bumps: 0, nudge: new Spring(420, 9) },
  notes: [],
  pens: [new Spring(170, 4.2), new Spring(150, 3.6), new Spring(190, 4.6)],
  // a spread of stiffnesses, so the leaves never flutter in step
  leaves: art.leaves.files.map((_, i) => new Spring(48 + ((i * 37) % 41), 2.1 + (i % 3) * 0.35)),
  spill: null,
  last: 0,
  raf: 0,
});

const worldOf = (ref: { current: World | null }) => (ref.current ??= createWorld());

/** The point the mug and its steam scale about (middle of its base), in the spill canvas's px. */
const mugOrigin = () => {
  const mug = art.props.mug;
  const sp = mug?.spill;
  if (!mug || !sp) return { ox: 0, oy: 0 };
  const W = art.size.width, H = art.size.height;
  const [x0, y0, x1, y1] = mug.boxPx;
  return {
    ox: (x0 + x1) / 2 - (sp.boxPct.left / 100) * W,
    oy: y0 + ((y1 - y0) * mug.originPct[1]) / 100 - (sp.boxPct.top / 100) * H,
  };
};

/** Portrait or narrow viewports use the phone framing of the same painting. */
const pickLayout = (vw: number, vh: number): LayoutKey =>
  vw > 0 && (vw < 900 || vh > vw * 1.15) ? "mobile" : "desktop";

/** Art px of room painted on past each side of the painting (public/cinema/side-*.png). */
const SIDE_PX = art.sides.px;

/**
 * Standing back from the desk: the painting's full height always fits, so both decks and the
 * keyboard are in view. A window narrower than the painting crops its sides (monitor as centered as
 * the crop allows, never a gap); only a wider one sees the room painted on past either side of it.
 */
function standingStage(vw: number, vh: number): Stage {
  const { width: W, height: H } = art.size;
  const [fx] = art.focalPoint;
  const scale = Math.max(vh / H, vw / (W + 2 * SIDE_PX));
  const w = W * scale;
  const h = H * scale;
  const side = SIDE_PX * scale;
  const centred = vw / 2 - (fx / 100) * w;
  const x = w >= vw ? Math.min(0, Math.max(vw - w, centred)) : Math.min(side, Math.max(vw - w - side, centred));
  const y = Math.min(0, Math.max(vh - h, (vh - h) / 2));
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

/**
 * The view between two framings as a camera move rather than a rectangle tween: the zoom
 * grows geometrically (each moment looks like the same speed of approach) and the point at
 * the middle of the window travels so it moves at an even pace across the screen.
 */
function dollyStage(a: Stage, b: Stage, t: number, vw: number, vh: number): Stage {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const scale = a.scale * Math.pow(b.scale / a.scale, t);
  const ca = [(vw / 2 - a.x) / a.scale, (vh / 2 - a.y) / a.scale];
  const cb = [(vw / 2 - b.x) / b.scale, (vh / 2 - b.y) / b.scale];
  const span = 1 / a.scale - 1 / b.scale;
  const k = Math.abs(span) > 1e-9 ? (1 / a.scale - 1 / scale) / span : t;
  return {
    x: vw / 2 - lerp(ca[0], cb[0], k) * scale,
    y: vh / 2 - lerp(ca[1], cb[1], k) * scale,
    w: art.size.width * scale,
    h: art.size.height * scale,
    scale,
  };
}

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
 * Sitting down for raw time u (0→1): one unbroken move in toward the screen that eases in and
 * eases out. As you lower into the chair the monitor drifts up from just below eye level and
 * settles there. Standing up is the same move run backwards.
 */
function sitPath(u: number, rising: boolean, vh: number): { p: number; cam: Cam } {
  const v = rising ? 1 - u : u;
  const p = easeInOut(v);
  const dy = Math.sin(Math.PI * p) ** 2 * 0.035 * vh;
  return { p, cam: { dy, zoom: 1 + (dy * 2.1) / vh } };
}

const pctBox = (r: PctBox): CSSProperties => ({
  left: `${r.left}%`,
  top: `${r.top}%`,
  width: `${r.width}%`,
  height: `${r.height}%`,
});

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
 * filling the window. Clicking the monitor sits you down in one smooth move toward the screen,
 * and the LUNA_OS on the glass wakes up to your keys. Standing, the desk is alive: push the mug
 * and it bumps back a little, upright, coffee running down its front; peel the sticky notes, as fast
 * as you like, and they drift down and pile up behind the mug; tap the cat pencil cup and the pens
 * rattle; click the desk lamp to switch it off (the room it lit goes dark with it) and on, the lava lamp too;
 * brush the plant and its leaves rustle while an ant walks out. Seated, ESC, [ STAND UP ] or a click
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
  /** Every note peeled off so far (which note it was), in order: they stay on the desk until reload. */
  const [fallen, setFallen] = useState<number[]>([]);
  const [lampOn, setLampOn] = useState(true);
  const [lampSwitches, setLampSwitches] = useState(0);
  const [lavaOn, setLavaOn] = useState(true);
  const [visits, setVisits] = useState(0); // each stand-up hands back a fresh screen at the menu
  const progressRef = useRef(0);
  const rafRef = useRef(0);
  const fallbackRef = useRef(0);
  const worldRef = useRef<World | null>(null);
  const elsRef = useRef<Partial<Record<PropKey, HTMLElement | null>>>({});
  const noteRefs = useRef(new Map<number, HTMLDivElement>());
  const penRefs = useRef<(HTMLDivElement | null)[]>([]);
  const leafRefs = useRef<(HTMLDivElement | null)[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    if (progressRef.current === to) {
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
    animateTo(0, () => {
      setPose("standing");
      setVisits((v) => v + 1);
    });
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

      // the mug: each bump slides it back a little, upright, and it stays there
      const m = w.mug;
      if (m.phase === "pushing") {
        m.t += dt;
        // a shove: quick off the mark, dragging to a stop on the wood
        m.pos = lerp(m.from, m.to, easeOutCubic(m.t / PUSH_S));
        if (m.t >= PUSH_S) {
          m.pos = m.to;
          m.phase = "rest";
        }
      }
      m.nudge.step(dt);
      if (w.spill) {
        // the runs down its front ride the mug: same move, same scale about the middle of its base
        w.spill.setMug({ dx: m.nudge.x, dy: -m.pos, scale: 1 - PUSH_SHRINK * m.pos, ...mugOrigin() });
        w.spill.step(dt, 0);
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx) w.spill.draw(ctx);
      }

      // the peeled sticky notes: each falls on its own and stays where it lands
      for (const n of w.notes) {
        if (n.phase === "rest") continue;
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
          // over the last stretch it flattens out toward the desk, so its lower edge never swings
          // down past the mug's base (it lands behind the mug, it shouldn't flash in front of it)
          const near = easeOutCubic(clamp01((n.y - (n.landY - NOTE_SETTLE)) / NOTE_SETTLE));
          // ...while gliding across toward where it will land, the whole way down
          n.x = n.x * (1 - 0.6 * near) + n.landDx * clamp01(n.y / n.landY);
          n.rot = (5 * n.side * (1 - grow) + 16 * grow * Math.cos(ph) * n.side) * (1 - near);
          n.yaw = n.landRot * near;
          n.tilt = lerp(30 + 24 * grow * Math.sin(2 * ph + 0.6), NOTE_FLAT, near);
          if (n.y >= n.landY) {
            n.y = n.landY;
            n.phase = "land";
            n.t = 0;
          }
        } else {
          // flat on the desk: it slides the last bit and settles at its own angle, and stays
          const k = easeOutCubic(n.t / 0.32);
          n.tilt = lerp(n.tilt, NOTE_FLAT, k);
          n.rot = lerp(n.rot, 0, k);
          n.yaw = lerp(n.yaw, n.landRot, k);
          n.x = lerp(n.x, n.landDx, k);
          if (n.t >= 0.32) n.phase = "rest";
        }
        const f = noteRefs.current.get(n.id);
        if (f) {
          // the turn in its own plane goes on before it tips over, so a note lying askew is still foreshortened flat
          f.style.transform = `translate(${cq(n.x)}, ${cq(n.y)}) perspective(${cq(NOTE_EYE)}) rotateZ(${n.rot.toFixed(2)}deg) rotateX(${n.tilt.toFixed(2)}deg) rotateZ(${n.yaw.toFixed(2)}deg)`;
        }
      }

      const springs = [...w.pens, ...w.leaves, m.nudge];
      for (const sp of springs) sp.step(dt);

      const el = elsRef.current;
      const set = (node: HTMLElement | null | undefined, transform: string) => {
        if (node) node.style.transform = transform;
      };
      const mugMove = `translate(${cq(m.nudge.x)}, ${cq(-m.pos)}) scale(${(1 - PUSH_SHRINK * m.pos).toFixed(4)})`;
      set(el.mug, mugMove);
      set(el.steam, mugMove);
      w.pens.forEach((sp, i) => set(penRefs.current[i], `rotate(${sp.x.toFixed(2)}deg)`));
      // the pot and stems stay put; each leaf flutters about where it meets its stem
      w.leaves.forEach((sp, i) => set(leafRefs.current[i], `rotate(${sp.x.toFixed(2)}deg)`));

      const idle =
        m.phase !== "pushing" &&
        w.notes.every((n) => n.phase === "rest") &&
        !(w.spill && w.spill.moving) &&
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
      const w = worldOf(worldRef);
      switch (key) {
        case "mug": {
          if (w.mug.phase === "pushing") break;
          if (w.mug.bumps >= PUSH_MAX) {
            // as far back as it goes: it just shivers where it stands
            w.mug.nudge.kick(w.mug.nudge.v >= 0 ? -60 : 60);
            break;
          }
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
              true,
            );
          }
          w.mug.phase = "pushing";
          w.mug.t = 0;
          w.mug.from = w.mug.pos;
          w.mug.bumps += 1;
          w.mug.to = PUSH_STEP * w.mug.bumps;
          // each shove slops a few drops off the back of the rim to the left; the first also sends one
          // slow run over the front lip and down the mug's face into a small puddle at its base, and once
          // that run is halfway down the next shove sends a second, slower one, clear of the first: the
          // last there is. It all stays.
          if (w.spill && geom) {
            w.spill.slosh(0, LEAK_DROPS);
            const n = w.spill.runs;
            if (n === 0 || (n === 1 && w.spill.runPast(0.5))) {
              const [x0, x1] = DRIP_X;
              const taken = w.spill.runXs;
              let x = x0 + Math.random() * (x1 - x0);
              for (let tries = 0; tries < 12 && taken.some((t) => Math.abs(t - x) < RUN_GAP); tries++) x = x0 + Math.random() * (x1 - x0);
              w.spill.drip([x], DRIP_LIP, DRIP_BASE, { cx: geom.mugLeft + 60, rx: LEAK_POOL[0], ry: LEAK_POOL[1] }, n === 0 ? 1 : RUN_SLOWER);
            }
          }
          break;
        }
        case "plant-pot":
        case "plant-leaves":
          // a gentle rustle: every leaf gets its own small push, this way or that
          w.leaves.forEach((sp) => sp.kick((Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 26)));
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
      const w = worldOf(worldRef);
      const r = () => Math.random() * 2 - 1;
      w.notes.push({
        id: w.notes.length,
        phase: "peel",
        t: 0,
        x: 0,
        y: 0,
        vy: 0,
        rot: 0,
        tilt: 0,
        yaw: 0,
        side: Math.random() < 0.5 ? -1 : 1,
        landY: NOTE_LAND_Y + r() * NOTE_SCATTER[1],
        landRot: r() * NOTE_SCATTER[2],
        landDx: NOTE_LAND_X + r() * NOTE_SCATTER[0],
      });
      setFallen((f) => [...f, noteIndex]);
      setNoteIndex(noteIndex + 1);
      ensureRunning();
    },
    [pose, noteIndex, ensureRunning],
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

  const switchLava = useCallback(
    (e: React.MouseEvent) => {
      if (pose !== "standing") return;
      e.stopPropagation();
      setLavaOn((on) => !on);
    },
    [pose],
  );

  /* ---------------- geometry ---------------- */

  const layout = pickLayout(vp.w, vp.h);
  const ready = vp.w > 0;
  const stage = ready
    ? dollyStage(
        standingStage(vp.w, vp.h),
        seatedStage(layout, vp.w, vp.h),
        progress,
        vp.w,
        vp.h,
      )
    : null;
  const screen = stage ? screenRect(stage) : null;
  // the live screen is laid out at its seated size and only scaled as you sit and stand, so the text
  // never reflows or jumps between font sizes on the way
  const seatScreen = ready ? screenRect(seatedStage(layout, vp.w, vp.h)) : null;

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
    lampOn ? "" : "cinema--lamp-off",
  ]
    .filter(Boolean)
    .join(" ");
  const spill = art.props.mug?.spill;
  const note = art.props.note;
  const camStyle: CSSProperties | undefined =
    cam === CAM_REST
      ? undefined
      : {
          transform: `translateY(${cam.dy.toFixed(1)}px) scale(${cam.zoom.toFixed(4)})`,
        };
  const standingTab = pose === "standing" ? 0 : -1;
  // the unlit room fades in over the lit one as the lamp goes off (with a flicker, restarted by the key)
  const offClass = `cinema__off${lampOn ? "" : " is-off"}${lampSwitches ? " is-switching" : ""}`;
  const sideWidth = `${(SIDE_PX / art.size.width) * 100}%`;

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
          {/* The same room with the lamp off: the cone on the wall and the beam on the desk gone, the
              bulb dark, the monitor's green the light that's left */}
          <Image
            key={`off-${lampSwitches}`}
            src={art.lamp.off}
            alt=""
            fill
            unoptimized
            sizes="100vw"
            draggable={false}
            className={`cinema__backdrop ${offClass}`}
          />

          {/* The room past the painting's edges, for wide windows, lit and unlit */}
          <div className="cinema__side cinema__side--left" style={{ width: sideWidth, backgroundImage: `url(${art.sides.left})` }} aria-hidden="true">
            <div key={`side-l-${lampSwitches}`} className={offClass} style={{ backgroundImage: `url(${art.sides.leftOff})` }} />
          </div>
          <div className="cinema__side cinema__side--right" style={{ width: sideWidth, backgroundImage: `url(${art.sides.right})` }} aria-hidden="true">
            <div key={`side-r-${lampSwitches}`} className={offClass} style={{ backgroundImage: `url(${art.sides.rightOff})` }} />
          </div>

          {/* The words on the decks and the book spines */}
          {WALL_TEXT.map((t) => (
            <p
              key={t.lines.map((l) => (typeof l === "string" ? l : l.map((r) => r.text).join(""))).join(" ")}
              className={`cinema__wall-text${t.edged ? " cinema__wall-gold" : ""}${t.y > 500 ? " cinema__wall-text--desk" : ""}`}
              style={wallTextStyle(t)}
            >
              {t.lines.map((line, i) => (
                <span key={i}>
                  {typeof line === "string"
                    ? line
                    : line.map((r) => (
                        <span key={r.text} className={r.color === DH_GOLD ? "cinema__wall-gold" : undefined} style={{ color: r.color }}>
                          {r.text}
                        </span>
                      ))}
                </span>
              ))}
            </p>
          ))}

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
              {/* the notes peeled so far: falling, or lying where they landed behind the mug */}
              {fallen.map((index, id) => (
                <div
                  key={id}
                  ref={(node) => {
                    if (node) noteRefs.current.set(id, node);
                    else noteRefs.current.delete(id);
                  }}
                  className="cinema__sprite cinema__sprite--note cinema__note-falling"
                  style={{ ...pctBox(note.boxPct), transformOrigin: "50% 3%" }}
                  aria-hidden="true"
                >
                  <NoteFace index={index} />
                </div>
              ))}
            </>
          )}

          {/* The lamp's head is in front of the notes on the wall: the shade's edge over them */}
          {art.lamp.front && (
            <div className="cinema__lamp-front" style={pctBox(art.lamp.front.boxPct)} aria-hidden="true">
              <Image src={art.lamp.front.file} alt="" fill unoptimized draggable={false} />
            </div>
          )}

          {/* The gaming corner: the console, its controller, the headset on its hook and the headset's cable */}
          {art.decor?.map((d) => (
            <div key={d.name} className="cinema__decor" style={{ ...pctBox(d.boxPct), zIndex: d.z }} aria-hidden="true">
              <Image src={d.file} alt="" fill unoptimized draggable={false} />
            </div>
          ))}

          {/* The lava lamp by the PC: click it off and on */}
          {art.lava.off ? (
            <button
              type="button"
              className="cinema__sprite cinema__lava-pic"
              style={pctBox(art.lava.boxPct)}
              onClick={switchLava}
              tabIndex={standingTab}
              aria-label={lavaOn ? "Switch the lava lamp off" : "Switch the lava lamp on"}
            >
              <Image src={art.lava.off} alt="" fill unoptimized draggable={false} className={lavaOn ? "is-hidden" : ""} />
            </button>
          ) : (
            <LavaLamp on={lavaOn} boxPct={art.lava.boxPct} onToggle={switchLava} tabIndex={standingTab} />
          )}

          {/* The pens in the cat pencil cup under the lamp, each rocking on its own */}
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
            // the mug and its steam shrink together toward the middle of the mug's base as it slides back
            const mugBase = art.props.mug?.originPct[1];
            const origin =
              (k === "mug" || k === "steam") && mugBase != null
                ? `50% ${mugBase}%`
                : `${p.originPct[0]}% ${p.originPct[1]}%`;
            const style: CSSProperties = { ...pctBox(p.boxPct), transformOrigin: origin };
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
                {k === "plant-leaves" ? (
                  <>
                    <Image src={art.leaves.stems} alt="" fill unoptimized draggable={false} />
                    {art.leaves.files.map((file, i) => (
                      <div
                        key={file}
                        ref={(node) => {
                          leafRefs.current[i] = node;
                        }}
                        className="cinema__leaf"
                        style={{ transformOrigin: `${art.leaves.originPct[i][0]}% ${art.leaves.originPct[i][1]}%` }}
                      >
                        <Image src={file} alt="" fill unoptimized draggable={false} />
                      </div>
                    ))}
                  </>
                ) : (
                  img
                )}
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
              {art.pens.files.length > 0 && (
                <button
                  type="button"
                  className="cinema__hotspot cinema__hotspot--pens"
                  style={pctBox(art.pens.hitPct)}
                  onClick={rattlePens}
                  aria-label="Rattle the pencil cup"
                />
              )}
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

        {/* The live screen rides the painted one: on all the time, only usable seated */}
        {screen && seatScreen && (
          <div
            className="cinema__screen"
            style={
              {
                left: 0,
                top: 0,
                width: seatScreen.w,
                height: seatScreen.h,
                transform: `translate(${screen.x}px, ${screen.y}px) scale(${screen.w / seatScreen.w})`,
                "--screen-w": `${seatScreen.w}px`,
              } as CSSProperties
            }
          >
            <LofiOS key={visits} initialPopup={pendingPopup} interactive={pose === "seated"} />
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
