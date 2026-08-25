"use client";

import Tooltip from "@/components/ui/Tooltip";
import Steam from "./Steam";
import "./room.css";

/** The coffee mug on the desk — ASCII steam rises from it; click for COFFEE MODE. */
export default function CoffeeCup({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="coffee-cup has-tooltip"
      onClick={onClick}
      aria-label="Open coffee mode"
    >
      <Tooltip label="COFFEE?" />
      <Steam size="small" />
      <pre className="coffee-cup__mug" aria-hidden="true">{`.------.
|COFFEE|-.
| MODE |_|
'------'`}</pre>
    </button>
  );
}
