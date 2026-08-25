"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/components/ui/useReducedMotion";
import Tooltip from "@/components/ui/Tooltip";
import "./room.css";

/**
 * Tessie — the resident good girl. Trots back and forth along the bottom
 * of the screen, pausing now and then, and woofs when clicked.
 */

/*
 * Tessie the corgi, dot-art style: a filled dot silhouette in profile —
 * upright ears, snout, long loaf body, stub legs, tail nub.
 * Left-facing frames are exact mirrors (dot characters are symmetric).
 */

const BODY = [
  "                  .::.  .::.",
  "                  ::::  ::::",
  "                  ::::::::::",
  "                 :::::::: :::",
  "                 ::::::::::::::.",
  ".:.              :::::::::::'",
  " .::::::::::::::::::::::::::",
  ":::::::::::::::::::::::::::",
  ":::::::::::::::::::::::::::",
  "'::::::::::::::::::::::::'",
];

const LEGS_A = ["  ::::              ::::", "  '::'              '::'"];
const LEGS_B = [" ::::                ::::", "'::'                  '::'"];

const WAG = [
  "                  .::.  .::.",
  "                  ::::  ::::",
  "                  ::::::::::",
  "                 :::::::: :::",
  ".:               ::::::::::::::.",
  " ':              :::::::::::'",
  " .::::::::::::::::::::::::::",
  ":::::::::::::::::::::::::::",
  ":::::::::::::::::::::::::::",
  "'::::::::::::::::::::::::'",
];

const frame = (body: string[], legs: string[]) => [...body, ...legs].join("\n");

/** Mirror dot art horizontally — every character used is symmetric. */
const mirror = (art: string): string => {
  const lines = art.split("\n");
  const width = Math.max(...lines.map((l) => l.length));
  return lines
    .map((l) => l.padEnd(width, " ").split("").reverse().join(""))
    .join("\n");
};

const RUN_RIGHT: string[] = [frame(BODY, LEGS_A), frame(BODY, LEGS_B)];
const RUN_LEFT: string[] = RUN_RIGHT.map(mirror);
const SIT: string[] = [frame(BODY, LEGS_A), frame(WAG, LEGS_A)];

const SPEED_PX = 3; // per tick
const TICK_MS = 60;
const FRAME_EVERY = 2; // animation frame flips every N ticks

export default function DeskDog({ onClick }: { onClick: () => void }) {
  const reduced = useReducedMotion();
  const [desktop, setDesktop] = useState(false);
  const [x, setX] = useState(60);
  const [dirRight, setDirRight] = useState(true);
  const [frame, setFrame] = useState(0);
  const [running, setRunning] = useState(true);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const roaming = desktop && !reduced;

  useEffect(() => {
    if (!roaming) return;
    const el = ref.current;
    if (!el) return;

    let pos = 60;
    let dir = 1;
    let tick = 0;
    let pauseTicks = 0;
    let nextPauseAt = 80 + Math.floor(Math.random() * 100);

    const id = setInterval(() => {
      tick++;
      const sceneWidth = el.parentElement?.clientWidth ?? window.innerWidth;
      const maxX = sceneWidth - 190;

      if (pauseTicks > 0) {
        // sitting for a moment — wag instead of run
        pauseTicks--;
        if (tick % 8 === 0) setFrame((f) => (f + 1) % 2);
        setRunning(false);
        return;
      }

      if (tick >= nextPauseAt) {
        pauseTicks = 25 + Math.floor(Math.random() * 40);
        tick = 0;
        nextPauseAt = 80 + Math.floor(Math.random() * 140);
        return;
      }

      pos += dir * SPEED_PX;
      if (pos <= 24) {
        pos = 24;
        dir = 1;
      } else if (pos >= maxX) {
        pos = maxX;
        dir = -1;
      }
      setX(pos);
      setDirRight(dir === 1);
      setRunning(true);
      if (tick % FRAME_EVERY === 0) setFrame((f) => (f + 1) % 2);
    }, TICK_MS);

    return () => clearInterval(id);
  }, [roaming]);

  const frames = !roaming || !running ? SIT : dirRight ? RUN_RIGHT : RUN_LEFT;

  return (
    <button
      type="button"
      ref={ref}
      className={`desk-dog has-tooltip ${roaming ? "desk-dog--roam" : ""}`}
      style={roaming ? { transform: `translateX(${x}px)` } : undefined}
      onClick={onClick}
      aria-label="Tessie the dog — say hi"
    >
      <Tooltip label="TESSIE" />
      <pre aria-hidden="true">{frames[frame % frames.length]}</pre>
    </button>
  );
}
