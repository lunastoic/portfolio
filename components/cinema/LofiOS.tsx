"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import type { AppId } from "@/components/types";
import AboutWindow from "@/components/monitor/AboutWindow";
import ProjectsWindow from "@/components/monitor/ProjectsWindow";
import ResumeWindow from "@/components/monitor/ResumeWindow";
import ContactWindow from "@/components/monitor/ContactWindow";
import CoffeeWindow from "@/components/monitor/CoffeeWindow";
import manifest from "../../public/cinema/manifest.json";
import PixelIcon, { type IconName } from "./PixelIcon";

export type LofiPopup = "coffee" | null;

const ITEMS: { id: AppId; label: string; icon: IconName }[] = [
  { id: "about", label: "ABOUT", icon: "person" },
  { id: "projects", label: "PROJECTS", icon: "folder" },
  { id: "resume", label: "RESUME", icon: "document" },
  { id: "contact", label: "CONTACT", icon: "mail" },
];

const formatClock = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }).toUpperCase();

/**
 * LUNA_OS as drawn in the lo-fi art: header bar with a live clock, name,
 * the moon-and-mountains illustration beside a numbered menu, and the
 * BUILD • TEST • REPEAT prompt. Opening an item swaps the body for the
 * same .EXE windows v1 uses. Arrow keys, Enter and 1–4 drive the menu.
 */
export default function LofiOS({ initialPopup = null }: { initialPopup?: LofiPopup }) {
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (popup) setPopup(null);
        else if (activeApp) close();
        return;
      }
      if (popup || activeApp) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((i) => (i + 1) % ITEMS.length);
      } else if (e.key === "ArrowUp") {
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
  }, [popup, activeApp, selected, close]);

  const { screenArt } = manifest;

  return (
    <div className="lofi">
      <div className="lofi__bar" aria-hidden="true">
        <span>LUNA_OS v1.0</span>
        <span>{clock}</span>
      </div>
      <div className="lofi__rule" aria-hidden="true" />

      {activeApp === null ? (
        <>
          <p className="lofi__name">CHRISTOPHER LUNA</p>
          <p className="lofi__title">SOFTWARE ENGINEER</p>
          <div className="lofi__body">
            <Image
              src={`/cinema/${screenArt.file}`}
              alt=""
              width={screenArt.width}
              height={screenArt.height}
              unoptimized
              draggable={false}
              className="lofi__art"
            />
            <nav aria-label="Portfolio sections">
              <ul className="lofi__menu">
                {ITEMS.map((item, i) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`lofi__item ${i === selected ? "lofi__item--active" : ""}`}
                      onMouseEnter={() => setSelected(i)}
                      onFocus={() => setSelected(i)}
                      onClick={() => setActiveApp(item.id)}
                    >
                      <span className="lofi__cursor" aria-hidden="true">
                        {i === selected ? ">" : ""}
                      </span>
                      <PixelIcon name={item.icon} />
                      <span>
                        {String(i + 1).padStart(2, "0")} {item.label}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </>
      ) : (
        <div className="lofi__window">
          {activeApp === "about" && <AboutWindow onClose={close} />}
          {activeApp === "projects" && <ProjectsWindow onClose={close} />}
          {activeApp === "resume" && <ResumeWindow onClose={close} />}
          {activeApp === "contact" && <ContactWindow onClose={close} />}
        </div>
      )}

      <div className="lofi__rule" aria-hidden="true" />
      <div className="lofi__footer" aria-hidden="true">
        <span>BUILD • TEST • REPEAT</span>
        <span className="lofi__prompt">
          C:\PORTFOLIO&gt;{activeApp ? `${activeApp.toUpperCase()}.EXE` : ""}
          <span className="cursor-blink" />
        </span>
      </div>

      {popup === "coffee" && <CoffeeWindow onClose={() => setPopup(null)} />}
    </div>
  );
}
