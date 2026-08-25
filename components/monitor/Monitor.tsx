"use client";

import type { AppId, PopupId } from "@/components/types";
import BootSequence from "./BootSequence";
import MainMenu from "./MainMenu";
import AboutWindow from "./AboutWindow";
import ProjectsWindow from "./ProjectsWindow";
import ResumeWindow from "./ResumeWindow";
import ContactWindow from "./ContactWindow";
import CoffeeWindow from "./CoffeeWindow";
import StatusPopup from "@/components/ui/StatusPopup";
import "./monitor.css";

const POPUP_CONTENT: Record<Exclude<PopupId, "coffee">, { title: string; lines: string[] }> = {
  clock: {
    title: "ALARM.SYS",
    lines: ["07:00", "", "WAKE UP.", "BUILD SOMETHING."],
  },
  plant: {
    title: "PLANT.SYS",
    lines: ["PLANT STATUS: STILL ALIVE.", "", "WATERED: PROBABLY", "PHOTOSYNTHESIS: OK"],
  },
  tower: {
    title: "TOWER.SYS",
    lines: [
      "LUNA-TOWER ONLINE",
      "",
      "CPU .... NOMINAL",
      "FANS ... HUMMING",
      "UPTIME . FOREVER",
    ],
  },
  heart: {
    title: "STATUS.SYS",
    lines: ["PASSION FOR CODE", "", "[##########] 100%"],
  },
  xbox: {
    title: "XBOX360.SYS",
    lines: [
      "ACHIEVEMENT UNLOCKED",
      "",
      "“FINISHED THE FIGHT”",
      "GAMERSCORE +117 G",
    ],
  },
  snake: {
    title: "SNAKE.EXE",
    lines: [
      "STATUS: HUNTING",
      "PATHFINDING: A* (MANHATTAN)",
      "",
      "SCORE: CLASSIFIED",
      "ROUTE: OPTIMAL. ALWAYS.",
    ],
  },
  dog: {
    title: "TESSIE.SYS",
    lines: [
      "*WOOF* *WOOF*",
      "",
      "TESSIE — GOOD GIRL: CONFIRMED",
      "ZOOMIES: ACTIVE",
      "FRESHLY GROOMED ✓",
    ],
  },
  music: {
    title: "AUDIO.SYS",
    lines: [
      "NOW PLAYING:",
      "LOFI BEATS TO SHIP CODE TO",
      "",
      "VOL [██████░░░░]",
    ],
  },
  media: {
    title: "WATCHLIST.SYS",
    lines: [
      "TONIGHT'S LINEUP:",
      "",
      "▪ ANIME: “ONE MORE EPISODE”",
      "▪ MOVIES: THE CLASSICS",
    ],
  },
};

interface MonitorProps {
  booted: boolean;
  onBootDone: () => void;
  activeApp: AppId | null;
  onOpenApp: (app: AppId) => void;
  onCloseApp: () => void;
  popup: PopupId | null;
  onClosePopup: () => void;
}

/** The retro monitor: bezel, CRT screen, LUNA OS boot + windows + dock + taskbar. */
export default function Monitor({
  booted,
  onBootDone,
  activeApp,
  onOpenApp,
  onCloseApp,
  popup,
  onClosePopup,
}: MonitorProps) {
  return (
    <div className="monitor">
      <div className="monitor__bezel">
        <div className="monitor__screen">
          {!booted ? (
            <BootSequence onDone={onBootDone} />
          ) : (
            <>
              <div className="monitor__desktop">
                {activeApp === null && <MainMenu onOpen={onOpenApp} />}
                {activeApp === "about" && <AboutWindow onClose={onCloseApp} />}
                {activeApp === "projects" && <ProjectsWindow onClose={onCloseApp} />}
                {activeApp === "resume" && <ResumeWindow onClose={onCloseApp} />}
                {activeApp === "contact" && <ContactWindow onClose={onCloseApp} />}
              </div>

              {popup === "coffee" && <CoffeeWindow onClose={onClosePopup} />}
              {popup && popup !== "coffee" && (
                <StatusPopup
                  title={POPUP_CONTENT[popup].title}
                  lines={POPUP_CONTENT[popup].lines}
                  onClose={onClosePopup}
                />
              )}

              <div className="monitor__taskbar" aria-hidden="true">
                <span>LUNA_OS v1.0</span>
                <span className="monitor__taskbar-path">
                  C:\PORTFOLIO&gt;<span className="cursor-blink" />
                </span>
                <span>07:00</span>
              </div>
            </>
          )}
        </div>
        <div className="monitor__brand" aria-hidden="true">
          ▪ LUNATRON 4000
        </div>
      </div>
      <div className="monitor__stand" aria-hidden="true" />
      <div className="monitor__base" aria-hidden="true" />
    </div>
  );
}
