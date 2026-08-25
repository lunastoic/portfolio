"use client";

import { useState } from "react";
import Tooltip from "@/components/ui/Tooltip";
import "./room.css";

interface LampProps {
  on: boolean;
  onToggle: () => void;
}

/**
 * Articulated desk lamp. Clicking toggles the light with a brief retro
 * flicker; the shade + light pool brightness are driven by the `on` prop.
 */
export default function Lamp({ on, onToggle }: LampProps) {
  const [flickering, setFlickering] = useState(false);

  const handleClick = () => {
    setFlickering(true);
    onToggle();
    setTimeout(() => setFlickering(false), 450);
  };

  return (
    <button
      type="button"
      className={`lamp has-tooltip ${on ? "lamp--on" : "lamp--off"} ${
        flickering ? "lamp--flicker" : ""
      }`}
      onClick={handleClick}
      aria-pressed={on}
      aria-label={`Desk lamp, currently ${on ? "on" : "off"}`}
    >
      <Tooltip label="LIGHTS" />
      <span className="lamp__glow" aria-hidden="true" />
      {/* Simple classic table lamp: trapezoid shade, stem, flat base */}
      <pre className="lamp__art" aria-hidden="true">{`     _____
    /     \\
   /       \\
  /_________\\
      ${on ? "|*|" : "|_|"}
       |
       |
    ___|___
   /_______\\`}</pre>
    </button>
  );
}
