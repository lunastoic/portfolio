"use client";

import Tooltip from "@/components/ui/Tooltip";
import "./room.css";

/** Computer tower on the right of the desk. Click for a system status popup. */
export default function Tower({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="tower has-tooltip"
      onClick={onClick}
      aria-label="Check computer tower status"
    >
      <Tooltip label="SYSTEM" />
      <span className="tower__slot" aria-hidden="true" />
      <span className="tower__slot tower__slot--thin" aria-hidden="true" />
      <span className="tower__led" aria-hidden="true" />
      <span className="tower__vents" aria-hidden="true" />
      <span className="tower__power" aria-hidden="true">
        ⏻
      </span>
    </button>
  );
}
