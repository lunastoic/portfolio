"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/components/ui/useReducedMotion";
import "./monitor.css";

const BOOT_LINES = [
  "LUNA OS v1.0",
  "",
  "INITIALIZING...",
  "LOADING PORTFOLIO...",
  "PROJECT DATA ......... OK",
  "INTERACTIVE OBJECTS .. OK",
  "COFFEE SYSTEM ........ READY",
  "",
  "WELCOME, USER.",
];

const LINE_DELAY_MS = 190;
const DONE_DELAY_MS = 450;

/** ~2s boot sequence inside the monitor. Click or press any key to skip. */
export default function BootSequence({ onDone }: { onDone: () => void }) {
  const reducedMotion = useReducedMotion();
  // Always start at 0 so the server and client render identically (no hydration mismatch).
  const [visibleLines, setVisibleLines] = useState(0);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  // With reduced motion, skip the typing effect entirely and show every line.
  const shownLines = reducedMotion ? BOOT_LINES.length : visibleLines;

  useEffect(() => {
    if (reducedMotion) {
      const t = setTimeout(finish, 300);
      return () => clearTimeout(t);
    }
    if (visibleLines >= BOOT_LINES.length) {
      const t = setTimeout(finish, DONE_DELAY_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setVisibleLines((n) => n + 1), LINE_DELAY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleLines, reducedMotion]);

  useEffect(() => {
    const onKey = () => finish();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button
      type="button"
      className="boot-sequence"
      onClick={finish}
      aria-label="Booting LUNA OS. Click or press any key to skip."
    >
      <pre className="boot-sequence__lines" aria-hidden="true">
        {/* No leading newline: the HTML parser drops it after <pre>, breaking hydration */}
        {shownLines > 0
          ? BOOT_LINES.slice(0, shownLines).join("\n") + "\n"
          : null}
        <span className="cursor-blink" />
      </pre>
      <span className="boot-sequence__skip" aria-hidden="true">
        [ CLICK OR PRESS ANY KEY TO SKIP ]
      </span>
    </button>
  );
}
