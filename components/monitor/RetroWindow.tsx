"use client";

import { useEffect, useRef } from "react";
import "./monitor.css";

interface RetroWindowProps {
  title: string;
  onClose?: () => void;
  children: React.ReactNode;
  /** Extra class for sizing variants (e.g. popups) */
  className?: string;
}

/** Terminal window chrome: title bar, close control, scrollable body. */
export default function RetroWindow({
  title,
  onClose,
  children,
  className = "",
}: RetroWindowProps) {
  const headingRef = useRef<HTMLDivElement>(null);

  // Move focus into the window when it opens so keyboard users land inside it.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section className={`retro-window ${className}`} aria-label={title}>
      <div className="retro-window__titlebar">
        <span className="retro-window__title" ref={headingRef} tabIndex={-1}>
          <span aria-hidden="true">▪ </span>
          {title}
        </span>
        {onClose && (
          <button
            type="button"
            className="retro-window__close"
            onClick={onClose}
            aria-label={`Close ${title}`}
          >
            [X]
          </button>
        )}
      </div>
      <div className="retro-window__body">{children}</div>
    </section>
  );
}
