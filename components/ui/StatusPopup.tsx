"use client";

import RetroWindow from "@/components/monitor/RetroWindow";

/** Small status popup on the monitor (clock, plant, tower, heart easter eggs). */
export default function StatusPopup({
  title,
  lines,
  onClose,
}: {
  title: string;
  lines: string[];
  onClose: () => void;
}) {
  return (
    <RetroWindow title={title} onClose={onClose} className="retro-window--popup retro-window--status">
      <div className="app-content status-popup" role="status">
        {lines.map((line, i) =>
          line === "" ? (
            <br key={i} />
          ) : (
            <p key={i} className={i === 0 ? "status-popup__lead" : undefined}>
              {line}
            </p>
          )
        )}
        <p aria-hidden="true">
          <span className="cursor-blink" />
        </p>
      </div>
    </RetroWindow>
  );
}
