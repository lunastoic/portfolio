"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppId } from "@/components/types";
import AboutWindow from "@/components/monitor/AboutWindow";
import ProjectsWindow from "@/components/monitor/ProjectsWindow";
import ResumeWindow from "@/components/monitor/ResumeWindow";
import ContactCard from "./ContactCard";
import CoffeeWindow from "@/components/monitor/CoffeeWindow";
import PixelIcon, { type IconName } from "./PixelIcon";

export type LofiPopup = "coffee" | null;

const ITEMS: { id: AppId; label: string; icon: IconName; tile: string }[] = [
  { id: "about", label: "About", icon: "person", tile: "#e8835a" },
  { id: "projects", label: "Projects", icon: "folder", tile: "#4f8de0" },
  { id: "resume", label: "Resume", icon: "document", tile: "#8c6ad8" },
  { id: "contact", label: "Contact", icon: "mail", tile: "#3fb37f" },
];

// what sits loose on the desktop, top right as a Mac keeps it
const DESKTOP: { id: AppId; label: string; icon: IconName }[] = [
  { id: "projects", label: "Projects", icon: "folder" },
  { id: "resume", label: "Resume.pdf", icon: "document" },
];

const formatClock = () =>
  new Date().toLocaleTimeString([], { weekday: "short", hour: "numeric", minute: "2-digit" });

/**
 * The desk computer's desktop, Mac style: a menu bar across the top with my name and a live clock, the
 * moon-and-mountains wallpaper at dusk, a couple of icons loose on the desktop and a dock along the bottom. Each
 * dock app opens its window over the wallpaper (the same windows v1 uses, in light Mac chrome), and the cup in the
 * dock pours the coffee popup. Arrow keys walk the dock, Enter opens, 1–4 jump straight to an app.
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

  useEffect(() => {
    if (!interactive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (popup) setPopup(null);
        else if (activeApp) close();
        return;
      }
      if (popup || activeApp) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((i) => (i + 1) % ITEMS.length);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((i) => (i + ITEMS.length - 1) % ITEMS.length);
      } else if (e.key === "Enter") {
        setActiveApp(ITEMS[selected].id);
      } else if (/^[1-4]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        setSelected(i);
        setActiveApp(ITEMS[i].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [interactive, popup, activeApp, selected, close]);

  const tab = interactive ? 0 : -1;
  const open = (id: AppId) => {
    setSelected(ITEMS.findIndex((it) => it.id === id));
    setActiveApp(id);
  };
  const appName = activeApp ? ITEMS.find((it) => it.id === activeApp)?.label : "Desktop";

  return (
    <div className="lofi mac">
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

      <ul className="mac__icons" aria-hidden={!interactive || undefined}>
        {DESKTOP.map((d) => (
          <li key={d.id}>
            <button type="button" className="mac__icon" tabIndex={tab} onClick={() => open(d.id)}>
              <span className={`mac__glyph mac__glyph--${d.icon}`}>
                <PixelIcon name={d.icon} />
              </span>
              <span className="mac__icon-label">{d.label}</span>
            </button>
          </li>
        ))}
      </ul>

      {activeApp && (
        <div className="lofi__window mac__window">
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
            onClick={() => setActiveApp(item.id)}
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
