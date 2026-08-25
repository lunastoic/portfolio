"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/components/ui/useReducedMotion";
import "@/components/ui/ui.css";

/**
 * Animated ASCII steam. Frames cycle characters so the steam looks like
 * live terminal text curling upward, not a shape.
 */
const FRAMES: string[] = [
  "  . .  \n (   ) \n  ) (  \n (   ) ",
  " (   ) \n  ) (  \n (   ) \n  . .  ",
  "  ) (  \n (   ) \n  . .  \n (   ) ",
  " (   ) \n  . .  \n  ) (  \n (   ) ",
];

const BIG_FRAMES: string[] = [
  "   ~  .  ~   \n  .  ~  .    \n   ~  .  ~   \n     ~       ",
  "  ~  .  ~    \n   .  ~  .   \n  ~  .  ~    \n      ~      ",
  "   .  ~  .   \n  ~  .  ~    \n   .  ~  .   \n     ~       ",
  "  .  ~  .    \n   ~  .  ~   \n  .  ~  .    \n      ~      ",
];

export default function Steam({
  size = "small",
  frameMs = 420,
}: {
  size?: "small" | "big";
  frameMs?: number;
}) {
  const frames = size === "big" ? BIG_FRAMES : FRAMES;
  const [frame, setFrame] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % frames.length), frameMs);
    return () => clearInterval(id);
  }, [reducedMotion, frames.length, frameMs]);

  return (
    <pre className={`ascii-steam ascii-steam--${size}`} aria-hidden="true">
      {frames[frame]}
    </pre>
  );
}
