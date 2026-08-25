"use client";

import Tooltip from "@/components/ui/Tooltip";
import "./room.css";

/** Xbox 360 console on the desk. Click for an achievement popup. */
export default function Xbox({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="xbox has-tooltip"
      onClick={onClick}
      aria-label="Xbox 360 console"
    >
      <Tooltip label="XBOX 360" />
      <span className="xbox__body" aria-hidden="true">
        <span className="xbox__slot" />
        <span className="xbox__ring" />
      </span>
    </button>
  );
}
