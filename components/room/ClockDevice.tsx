"use client";

import Tooltip from "@/components/ui/Tooltip";
import "./room.css";

/** Small digital clock on the desk, permanently reading 7:00. */
export default function ClockDevice({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="clock-device has-tooltip"
      onClick={onClick}
      aria-label="Digital clock showing 7:00"
    >
      <Tooltip label="ALARM" />
      <span className="clock-device__time" aria-hidden="true">
        7:00
      </span>
      <span className="clock-device__icon" aria-hidden="true">
        ▲▲
      </span>
    </button>
  );
}
