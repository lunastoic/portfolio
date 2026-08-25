"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppId, PopupId } from "@/components/types";
import { useThemeRipple } from "@/components/useThemeRipple";
import Monitor from "@/components/monitor/Monitor";
import "./intro.css";

/**
 * The landing after flying into the 3D monitor: LUNA OS at full screen.
 * Same Monitor component as the 2D desk scene (boot → menu → .EXE
 * windows), just filling the viewport — you are now inside the machine.
 */
export default function InsideScreen() {
  const [booted, setBooted] = useState(false);
  const [activeApp, setActiveApp] = useState<AppId | null>(null);
  const [popup, setPopup] = useState<PopupId | null>(null);

  const getOrigin = useCallback(
    () => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 }),
    []
  );
  const withThemeRipple = useThemeRipple(getOrigin);

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

  // ESC closes the popup first, then the active app window. (Backing out
  // of the machine itself is handled by IntroGate when nothing is open.)
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
    <div className="inside-screen">
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
  );
}
