"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import type { AppId, PopupId } from "@/components/types";
import { useThemeRipple } from "@/components/useThemeRipple";
import Monitor from "@/components/monitor/Monitor";

/**
 * The live LUNA OS projected onto the CRT in the cinematic scene. Same
 * Monitor component as v1 (boot → menu → .EXE windows); the chassis is
 * hidden by CSS because the photo already has one.
 */
export default function CinemaScreen({
  screenRef,
}: {
  screenRef: RefObject<HTMLDivElement | null>;
}) {
  const [booted, setBooted] = useState(false);
  const [activeApp, setActiveApp] = useState<AppId | null>(null);
  const [popup, setPopup] = useState<PopupId | null>(null);

  // Theme ripples grow out from the middle of the glass.
  const getOrigin = useCallback(() => {
    const r = screenRef.current?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  }, [screenRef]);
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
    <Monitor
      booted={booted}
      onBootDone={() => setBooted(true)}
      activeApp={activeApp}
      onOpenApp={openApp}
      onCloseApp={closeApp}
      popup={popup}
      onClosePopup={() => setPopup(null)}
    />
  );
}
