"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AppId } from "@/components/types";
import AboutWindow from "@/components/monitor/AboutWindow";
import ProjectsWindow from "@/components/monitor/ProjectsWindow";
import ResumeWindow from "@/components/monitor/ResumeWindow";
import ContactCard from "./ContactCard";
import CoffeeWindow from "@/components/monitor/CoffeeWindow";
import PixelIcon, { type IconName } from "./PixelIcon";

export type LofiPopup = "coffee" | null;

// each section is a numbered file on the desktop and an app in the dock
const ITEMS: { id: AppId; label: string; file: string; icon: IconName; tile: string }[] = [
  { id: "about", label: "About", file: "About Me", icon: "person", tile: "#e8835a" },
  { id: "projects", label: "Projects", file: "Projects", icon: "folder", tile: "#4f8de0" },
  { id: "resume", label: "Resume", file: "Resume.pdf", icon: "document", tile: "#8c6ad8" },
  { id: "contact", label: "Contact", file: "Contact", icon: "mail", tile: "#3fb37f" },
];

// how long a clicked file stays highlighted before its window springs open, ms
const OPEN_AFTER = 160;

const formatClock = () =>
  new Date().toLocaleTimeString([], { weekday: "short", hour: "numeric", minute: "2-digit" });

/**
 * The desk computer's desktop, Mac style: a menu bar across the top with my name and a live clock, the
 * moon-and-mountains wallpaper at dusk, the four sections as big numbered files on the desktop and a dock along the
 * bottom. Clicking a file selects it as Finder does, then its window springs open out of the icon (the same windows
 * v1 uses, in light Mac chrome); the dock opens them too, and the cup in the dock pours the coffee popup. Arrow keys
 * walk the files, Enter opens, 1–4 open a file straight away.
 */
export default function LofiOS({
  initialPopup = null,
  interactive = true,
}: {
  initialPopup?: LofiPopup;
  /** Standing back, the screen just shows; keys and clicks only reach it once you sit down. */
  interactive?: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const [activeApp, setActiveApp] = useState<AppId | null>(null);
  const [popup, setPopup] = useState<LofiPopup>(initialPopup);
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () => setClock(formatClock());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const close = useCallback(() => setActiveApp(null), []);

  const rootRef = useRef<HTMLDivElement>(null);
  const winRef = useRef<HTMLDivElement>(null);
  const fileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // where the opening window grows from: the middle of what was clicked, in the desktop's own px
  const from = useRef<[number, number] | null>(null);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

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
    timer.current = window.setTimeout(() => setActiveApp(ITEMS[i].id), wait);
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
      if (e.key === "Escape") {
        if (popup) setPopup(null);
        else if (activeApp) close();
        return;
      }
      if (popup) return;
      if (/^[1-4]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        open(i, fileRefs.current[i], OPEN_AFTER);
        return;
      }
      if (activeApp) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((i) => (i + 1) % ITEMS.length);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((i) => (i + ITEMS.length - 1) % ITEMS.length);
      } else if (e.key === "Enter") {
        open(selected, fileRefs.current[selected], OPEN_AFTER);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [interactive, popup, activeApp, selected, close, open]);

  const tab = interactive ? 0 : -1;
  const appName = activeApp ? ITEMS.find((it) => it.id === activeApp)?.label : "Desktop";

  return (
    <div className="lofi mac" ref={rootRef}>
      <div className="mac__menubar" aria-hidden="true">
        <span className="mac__moon">☾</span>
        <span className="mac__app">{appName}</span>
        <span className="mac__menu">File</span>
        <span className="mac__menu">Edit</span>
        <span className="mac__menu">View</span>
        <span className="mac__menu mac__menu--wide">Window</span>
        <span className="mac__spacer" />
        <span className="mac__menu mac__menu--wide">Christopher Luna</span>
        <span>{clock}</span>
      </div>

      <ul className="mac__files" aria-hidden={!interactive || undefined}>
        {ITEMS.map((item, i) => (
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

      {activeApp && (
        <div className="lofi__window mac__window" ref={winRef} key={activeApp}>
          {activeApp === "about" && <AboutWindow onClose={close} />}
          {activeApp === "projects" && <ProjectsWindow onClose={close} />}
          {activeApp === "resume" && <ResumeWindow onClose={close} />}
          {activeApp === "contact" && <ContactCard onClose={close} />}
        </div>
      )}

      <nav className="mac__dock" aria-label="Portfolio sections" aria-hidden={!interactive || undefined}>
        {ITEMS.map((item, i) => (
          <button
            key={item.id}
            type="button"
            className={`mac__dock-item ${i === selected ? "mac__dock-item--active" : ""}`}
            tabIndex={tab}
            aria-label={`${i + 1}. ${item.label}`}
            onMouseEnter={() => setSelected(i)}
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
          aria-label="Coffee"
          onClick={() => setPopup("coffee")}
        >
          <span className="mac__tip" aria-hidden="true">
            Coffee
          </span>
          <span className="mac__tile mac__tile--coffee" aria-hidden="true">
            <PixelIcon name="cup" />
          </span>
          <span className={`mac__dot ${popup === "coffee" ? "mac__dot--on" : ""}`} aria-hidden="true" />
        </button>
      </nav>

      {popup === "coffee" && <CoffeeWindow onClose={() => setPopup(null)} />}
    </div>
  );
}
