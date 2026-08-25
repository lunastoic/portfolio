"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppId, PopupId } from "@/components/types";
import { useThemeRipple } from "@/components/useThemeRipple";
import Monitor from "@/components/monitor/Monitor";
import IdentityPanels from "./IdentityPanels";
import Shelves from "./Shelves";
import Lamp from "./Lamp";
import Xbox from "./Xbox";
import CoffeeCup from "./CoffeeCup";
import ClockDevice from "./ClockDevice";
import Tower from "./Tower";
import WallSnake from "./WallSnake";
import DeskDog from "./DeskDog";
import Tooltip from "@/components/ui/Tooltip";
import "./room.css";

/**
 * The full POV desk scene. Owns all interactive state:
 * boot status, the active monitor app, desk-object popups, and the lamp.
 *
 * Each section has its own color theme (about=green, projects=orange,
 * resume=blue, contact=off-white). Opening one recolors the monitor instantly
 * (it has its own view-transition layer) while the rest of the site is
 * revealed by a ripple that grows out from behind the monitor.
 */
export default function DeskScene() {
  const [booted, setBooted] = useState(false);
  const [activeApp, setActiveApp] = useState<AppId | null>(null);
  const [popup, setPopup] = useState<PopupId | null>(null);
  const [lampOn, setLampOn] = useState(true);

  // The ripple emanates from the monitor's center, hidden behind it at first.
  const monitorSlotRef = useRef<HTMLDivElement>(null);
  const getRippleOrigin = useCallback(() => {
    const rect = monitorSlotRef.current?.getBoundingClientRect();
    return rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : null;
  }, []);
  const withThemeRipple = useThemeRipple(getRippleOrigin);

  const openApp = useCallback(
    (app: AppId) => {
      withThemeRipple(app, () => {
        setPopup(null);
        setActiveApp(app);
      });
    },
    [withThemeRipple]
  );

  const closeApp = useCallback(() => {
    withThemeRipple(null, () => setActiveApp(null));
  }, [withThemeRipple]);

  // Desk objects surface their popups on the monitor — boot it if needed.
  const openPopup = useCallback((id: PopupId) => {
    setBooted(true);
    setPopup(id);
  }, []);

  // ESC closes the popup first, then the active app window.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (popup) setPopup(null);
      else if (activeApp) closeApp();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popup, activeApp, closeApp]);

  return (
    <div className="scene" data-lamp={lampOn ? "on" : "off"}>
      <div className="room-frame" aria-hidden="true" />

      <div className="wall">
        <WallSnake onClick={() => openPopup("snake")} />
        <IdentityPanels />
        <Shelves side="left" onPlantClick={() => openPopup("plant")} />
        <Shelves side="right" onHeartClick={() => openPopup("heart")} />

        <button
          type="button"
          className="wall-gear wall-gear--music has-tooltip"
          onClick={() => openPopup("music")}
          aria-label="Headphones — see what's playing"
        >
          <Tooltip label="AUDIO" />
          <pre aria-hidden="true">{`  _____
 /     \\
||     ||
|]     [|`}</pre>
        </button>

        <button
          type="button"
          className="wall-gear wall-gear--media has-tooltip"
          onClick={() => openPopup("media")}
          aria-label="Movie poster — see the watchlist"
        >
          <Tooltip label="MOVIES" />
          <span className="wall-gear__title" aria-hidden="true">
            NOW SHOWING
          </span>
          <pre aria-hidden="true">{`[▪][▪][▪]`}</pre>
          <span aria-hidden="true">ANIME NIGHT</span>
          <span className="wall-gear__sub" aria-hidden="true">
            + THE CLASSICS
          </span>
        </button>
      </div>

      <div className="desk-area">
        <div className="monitor-slot" ref={monitorSlotRef}>
          <Monitor
            booted={booted}
            onBootDone={() => setBooted(true)}
            activeApp={activeApp}
            onOpenApp={openApp}
            onCloseApp={closeApp}
            popup={popup}
            onClosePopup={() => setPopup(null)}
          />
        </div>

        <div className="desk-objects">
          <Lamp on={lampOn} onToggle={() => setLampOn((v) => !v)} />
          <Xbox onClick={() => openPopup("xbox")} />
          <ClockDevice onClick={() => openPopup("clock")} />
          <CoffeeCup onClick={() => openPopup("coffee")} />
          <div
            className={`status-sign dimmable ${popup === "coffee" ? "status-sign--active" : ""}`}
            aria-hidden="true"
          >
            <span className="status-sign__title">STATUS.EXE</span>
            <span>
              COFFEE MODE
              <br />
              {popup === "coffee" ? "ACTIVE" : "READY"}
            </span>
            <span className="status-sign__bar">
              {popup === "coffee" ? "████████" : "██░░░░░░"}
            </span>
          </div>
          <Tower onClick={() => openPopup("tower")} />
        </div>

        <div className="keyboard dimmable" aria-hidden="true" />
        <div className="mousepad dimmable" aria-hidden="true">
          <div className="mouse" />
        </div>
      </div>

      <div className="desk-front dimmable">
        <span className="desk-label desk-label--right" aria-hidden="true">
          BUILD • TEST • REPEAT
        </span>
        <div className="drawers" aria-hidden="true">
          <div className="drawer" />
          <div className="drawer" />
        </div>
      </div>

      <DeskDog onClick={() => openPopup("dog")} />
    </div>
  );
}
