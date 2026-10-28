"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { AppId } from "@/components/types";
import AboutApp from "./AboutApp";
import InfoApp from "./InfoApp";
import ProjectsApp from "./ProjectsApp";
import ResumeWindow from "@/components/monitor/ResumeWindow";
import ContactCard from "./ContactCard";
import PixelIcon, { type IconName } from "./PixelIcon";
import GamesWindow, { type GameId } from "./GamesWindow";
import { setGameOn } from "./gamePause";

type DeskApp = AppId | "games" | "info";

// each section is a numbered file on the desktop and an app in the dock
const ITEMS: { id: DeskApp; label: string; file: string; icon: IconName; tile: string }[] = [
  { id: "about", label: "About", file: "About Me", icon: "person", tile: "#e8835a" },
  { id: "projects", label: "Projects", file: "Projects", icon: "folder", tile: "#4f8de0" },
  { id: "resume", label: "Resume", file: "Resume.pdf", icon: "document", tile: "#8c6ad8" },
  { id: "contact", label: "Contact", file: "Contact", icon: "mail", tile: "#3fb37f" },
  { id: "games", label: "Games", file: "Games", icon: "gamepad", tile: "#d4a72c" },
  { id: "info", label: "Info", file: "Info", icon: "info", tile: "#6b7a90" },
];

// the four sections are the desktop's main files; the games folder and the info file sit off to the side
const MAIN = 4;
const GAMES = MAIN;
const SIDE = [GAMES, GAMES + 1];

// how long a clicked file stays highlighted before its window springs open, ms
const OPEN_AFTER = 160;

// whether the device has a pointer that hovers (a mouse), as opposed to a touch screen
const HOVER_QUERY = "(hover: hover)";
const subscribeHover = (cb: () => void) => {
  const mq = window.matchMedia(HOVER_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const canHover = () => window.matchMedia(HOVER_QUERY).matches;

const formatClock = () =>
  new Date().toLocaleTimeString([], { weekday: "short", hour: "numeric", minute: "2-digit" });

/**
 * The desk computer's desktop, Mac style: a menu bar across the top with my name and a live clock, the
 * moon-and-mountains wallpaper at dusk, the four sections as big numbered files on the desktop (the games folder smaller, off to the side) and a dock
 * along the bottom. Clicking a file selects it as Finder does, then its window springs open out of the icon (the same windows
 * v1 uses, in light Mac chrome); the dock opens them too. Arrow keys
 * walk the files, Enter opens, 1–5 open a file straight away. While a game is playing every key is the game's, and
 * ESC goes back to the games folder.
 */
export default function LofiOS({
  interactive = true,
  visit = 0,
}: {
  /** Standing back, the screen just shows; keys and clicks only reach it once you sit down. */
  interactive?: boolean;
  /** Bumped on each stand-up: the screen goes back to a fresh desktop in place, without blinking off. */
  visit?: number;
}) {
  // nothing is selected until you point at, click or arrow to a file
  const [selected, setSelected] = useState<number | null>(null);
  // the file or dock app under the pointer, named in the menu bar; with a mouse it says File when over nothing,
  // and on a touch screen (no hover) it names the selected file, About Me before one is picked
  const [hovered, setHovered] = useState<number | null>(null);
  const mouse = useSyncExternalStore(subscribeHover, canHover, () => true);
  const [activeApp, setActiveApp] = useState<DeskApp | null>(null);
  const [game, setGame] = useState<GameId | null>(null);
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () => setClock(formatClock());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const close = useCallback(() => {
    setActiveApp(null);
    setGame(null);
  }, []);

  // the room holds still while a game plays
  useEffect(() => {
    setGameOn(game !== null);
    return () => setGameOn(false);
  }, [game]);

  const rootRef = useRef<HTMLDivElement>(null);
  const winRef = useRef<HTMLDivElement>(null);
  const fileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // where the opening window grows from: the middle of what was clicked, in the desktop's own px
  const from = useRef<[number, number] | null>(null);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  // a fresh desktop for the next visit, set before the frame paints so the old window never flashes
  const lastVisit = useRef(visit);
  useLayoutEffect(() => {
    if (lastVisit.current === visit) return;
    lastVisit.current = visit;
    clearTimeout(timer.current);
    from.current = null;
    setSelected(null);
    setHovered(null);
    close();
  }, [visit, close]);

  /** Opens item i out of the element it was opened from, after a moment highlighted if it's a file. */
  const open = useCallback((i: number, el: Element | null | undefined, wait = 0) => {
    setSelected(i);
    const root = rootRef.current;
    if (root && el) {
      const r = root.getBoundingClientRect();
      const e = el.getBoundingClientRect();
      const k = r.width / root.offsetWidth || 1; // the screen is scaled while you sit and stand
      from.current = [(e.left + e.width / 2 - r.left) / k, (e.top + e.height / 2 - r.top) / k];
    } else from.current = null;
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setActiveApp(ITEMS[i].id);
      setGame(null);
    }, wait);
  }, []);

  // the window zooms out of the icon: its transform origin is the icon, measured before the first frame
  useLayoutEffect(() => {
    const win = winRef.current;
    if (!win || !from.current) return;
    win.style.transformOrigin = `${from.current[0] - win.offsetLeft}px ${from.current[1] - win.offsetTop}px`;
  }, [activeApp]);

  useEffect(() => {
    if (!interactive) return;
    const onKey = (e: KeyboardEvent) => {
      if (game) {
        if (e.key === "Escape") setGame(null);
        return;
      }
      if (e.key === "Escape") {
        if (activeApp) close();
        return;
      }
      if (/^[1-5]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        open(i, fileRefs.current[i], OPEN_AFTER);
        return;
      }
      if (activeApp) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((i) => (i === null ? 0 : (i + 1) % MAIN));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((i) => (i === null ? MAIN - 1 : (i + MAIN - 1) % MAIN));
      } else if (e.key === "Enter" && selected !== null) {
        open(selected, fileRefs.current[selected], OPEN_AFTER);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [interactive, activeApp, game, selected, close, open]);

  const current = hovered !== null ? ITEMS[hovered].file : mouse ? "File" : ITEMS[selected ?? 0].file;
  const tab = interactive ? 0 : -1;
  const appName =
    game === "pong" ? "Pong" : game === "doom" ? "DOOM" : activeApp ? ITEMS.find((it) => it.id === activeApp)?.label : "Desktop";

  return (
    <div className="lofi mac" ref={rootRef}>
      <div className="mac__menubar" aria-hidden="true">
        <span className="mac__moon">☾</span>
        <span className="mac__app">{appName}</span>
        {/* every name sits in the same cell, only the current one shown, so the slot is always as wide as the
            longest and the name and clock never shift as you point around */}
        <span className="mac__menu mac__menu--slot">
          {["File", ...ITEMS.map((it) => it.file)].map((name) => (
            <span key={name} hidden={name !== current} className="mac__slot-name">
              {name}
            </span>
          ))}
        </span>
        <span className="mac__menu mac__menu--wide">Edit</span>
        <span className="mac__menu mac__menu--wide">View</span>
        <span className="mac__menu mac__menu--wide">Window</span>
        <span className="mac__spacer" />
        <span className="mac__menu">Christopher Luna</span>
        <span>{clock}</span>
      </div>

      <ul className="mac__files" aria-hidden={!interactive || undefined}>
        {ITEMS.slice(0, MAIN).map((item, i) => (
          <li key={item.id}>
            <button
              ref={(el) => {
                fileRefs.current[i] = el;
              }}
              type="button"
              className={`mac__file ${i === selected ? "mac__file--selected" : ""}`}
              tabIndex={tab}
              aria-label={`${i + 1}. Open ${item.label}`}
              onFocus={() => setSelected(i)}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onClick={(e) => open(i, e.currentTarget, OPEN_AFTER)}
            >
              <span className="mac__file-icon" style={{ background: item.tile }}>
                <PixelIcon name={item.icon} />
                <span className="mac__file-num" aria-hidden="true">
                  {i + 1}
                </span>
              </span>
              <span className="mac__file-label">{item.file}</span>
            </button>
          </li>
        ))}
      </ul>

      <ul className="mac__side" aria-hidden={!interactive || undefined}>
        {SIDE.map((i) => (
          <li key={ITEMS[i].id}>
            <button
              ref={(el) => {
                fileRefs.current[i] = el;
              }}
              type="button"
              className={`mac__file mac__file--side ${selected === i ? "mac__file--selected" : ""}`}
              tabIndex={tab}
              aria-label={`Open ${ITEMS[i].label}`}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onClick={(e) => open(i, e.currentTarget, OPEN_AFTER)}
            >
              <span className="mac__file-icon" style={{ background: ITEMS[i].tile }}>
                <PixelIcon name={ITEMS[i].icon} />
              </span>
              <span className="mac__file-label">{ITEMS[i].file}</span>
            </button>
          </li>
        ))}
      </ul>

      {activeApp && (
        <div className="lofi__window mac__window" ref={winRef} key={activeApp}>
          {activeApp === "about" && <AboutApp onClose={close} />}
          {activeApp === "projects" && <ProjectsApp onClose={close} />}
          {activeApp === "resume" && <ResumeWindow onClose={close} />}
          {activeApp === "contact" && <ContactCard onClose={close} />}
          {activeApp === "games" && <GamesWindow game={game} onGame={setGame} onClose={close} />}
          {activeApp === "info" && <InfoApp onClose={close} />}
        </div>
      )}

      <nav className="mac__dock" aria-label="Portfolio sections" aria-hidden={!interactive || undefined}>
        {ITEMS.slice(0, MAIN).map((item, i) => (
          <button
            key={item.id}
            type="button"
            className={`mac__dock-item ${i === selected ? "mac__dock-item--active" : ""}`}
            tabIndex={tab}
            aria-label={`${i + 1}. ${item.label}`}
            onMouseEnter={() => {
              setSelected(i);
              setHovered(i);
            }}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setSelected(i)}
            onClick={(e) => open(i, e.currentTarget)}
          >
            <span className="mac__tip" aria-hidden="true">
              {item.label}
            </span>
            <span className="mac__tile" style={{ background: item.tile }}>
              <PixelIcon name={item.icon} />
            </span>
            <span className={`mac__dot ${activeApp === item.id ? "mac__dot--on" : ""}`} aria-hidden="true" />
          </button>
        ))}
        <span className="mac__dock-rule" aria-hidden="true" />
        <button
          type="button"
          className="mac__dock-item"
          tabIndex={tab}
          aria-label="Games"
          onMouseEnter={() => setHovered(GAMES)}
          onMouseLeave={() => setHovered(null)}
          onClick={(e) => open(GAMES, e.currentTarget)}
        >
          <span className="mac__tip" aria-hidden="true">
            Games
          </span>
          <span className="mac__tile" style={{ background: ITEMS[GAMES].tile }}>
            <PixelIcon name={ITEMS[GAMES].icon} />
          </span>
          <span className={`mac__dot ${activeApp === "games" ? "mac__dot--on" : ""}`} aria-hidden="true" />
        </button>
      </nav>

    </div>
  );
}
