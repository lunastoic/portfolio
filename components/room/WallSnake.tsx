"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/components/ui/useReducedMotion";
import "./room.css";

/**
 * An autonomous game of Snake roaming the wall, driven by A* pathfinding
 * (Manhattan-distance heuristic). Every move follows a planned shortest
 * path to the food — no aimless loops. The grid marks every real wall/desk
 * object (monitor, shelves, lamp...) as blocked, so it slithers around them.
 */

const CELL = 14;
const TICK_MS = 130;
const START_LEN = 6;
const MAX_LEN = 22;

const OBSTACLE_SELECTORS = [
  ".identity-panels",
  ".monitor-slot",
  ".shelf-zone--left",
  ".shelf-zone--right",
  ".status-sign",
  ".lamp",
  ".tower",
  ".coffee-cup",
  ".clock-device",
  ".wall-gear",
].join(",");

interface Pt {
  x: number;
  y: number;
}

const DIRS: Pt[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export default function WallSnake({ onClick }: { onClick: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [desktop, setDesktop] = useState(false);
  const [snake, setSnake] = useState<Pt[]>([]);
  const [food, setFood] = useState<Pt | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const active = desktop && !reduced;

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    let cols = 0;
    let rows = 0;
    let blocked = new Set<string>();
    let body: Pt[] = [];
    let target: Pt | null = null;
    let path: Pt[] = []; // planned route, head -> food
    const key = (p: Pt) => `${p.x},${p.y}`;

    const measure = () => {
      const rect = container.getBoundingClientRect();
      cols = Math.max(6, Math.floor(rect.width / CELL));
      rows = Math.max(6, Math.floor(rect.height / CELL));
      blocked = new Set();
      const scene = container.closest(".scene") ?? document.body;
      scene.querySelectorAll(OBSTACLE_SELECTORS).forEach((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        const x0 = Math.floor((r.left - rect.left) / CELL) - 1;
        const x1 = Math.floor((r.right - rect.left) / CELL) + 1;
        const y0 = Math.floor((r.top - rect.top) / CELL) - 1;
        const y1 = Math.floor((r.bottom - rect.top) / CELL) + 1;
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) blocked.add(`${x},${y}`);
        }
      });
    };

    const onBody = (p: Pt) => body.some((b) => b.x === p.x && b.y === p.y);
    const inBounds = (p: Pt) => p.x >= 0 && p.y >= 0 && p.x < cols && p.y < rows;
    const isFree = (p: Pt) => inBounds(p) && !blocked.has(key(p)) && !onBody(p);

    /**
     * A* shortest path on the wall grid. Current body cells count as walls
     * (conservative — a cell may free up later, but never path through it).
     * Returns the route from just after `start` through `goal`, or null.
     */
    const findPath = (start: Pt, goal: Pt): Pt[] | null => {
      const startKey = key(start);
      const goalKey = key(goal);
      const h = (p: Pt) => Math.abs(p.x - goal.x) + Math.abs(p.y - goal.y);

      const open = new Map<string, Pt>([[startKey, start]]);
      const gScore = new Map<string, number>([[startKey, 0]]);
      const fScore = new Map<string, number>([[startKey, h(start)]]);
      const cameFrom = new Map<string, string>();
      const closed = new Set<string>();
      const cellOf = new Map<string, Pt>([[startKey, start]]);

      while (open.size > 0) {
        // extract the open node with the lowest f-score
        let currentKey = "";
        let best = Infinity;
        open.forEach((_, k) => {
          const f = fScore.get(k) ?? Infinity;
          if (f < best) {
            best = f;
            currentKey = k;
          }
        });
        const current = cellOf.get(currentKey)!;
        if (currentKey === goalKey) {
          const route: Pt[] = [];
          let k = goalKey;
          while (k !== startKey) {
            route.unshift(cellOf.get(k)!);
            k = cameFrom.get(k)!;
          }
          return route;
        }
        open.delete(currentKey);
        closed.add(currentKey);

        for (const d of DIRS) {
          const n = { x: current.x + d.x, y: current.y + d.y };
          const nKey = key(n);
          if (closed.has(nKey)) continue;
          const passable =
            inBounds(n) && !blocked.has(nKey) && (nKey === goalKey || !onBody(n));
          if (!passable) continue;
          const tentative = (gScore.get(currentKey) ?? Infinity) + 1;
          if (tentative < (gScore.get(nKey) ?? Infinity)) {
            cameFrom.set(nKey, currentKey);
            gScore.set(nKey, tentative);
            fScore.set(nKey, tentative + h(n));
            cellOf.set(nKey, n);
            open.set(nKey, n);
          }
        }
      }
      return null;
    };

    const randomFree = (): Pt | null => {
      for (let i = 0; i < 300; i++) {
        const p = {
          x: Math.floor(Math.random() * cols),
          y: Math.floor(Math.random() * rows),
        };
        if (!blocked.has(key(p)) && !onBody(p)) return p;
      }
      return null;
    };

    /** Pick a food cell the snake can actually reach, and plan the route. */
    const retarget = () => {
      const head = body[0];
      for (let i = 0; i < 12; i++) {
        const candidate = randomFree();
        if (!candidate) break;
        const route = findPath(head, candidate);
        if (route) {
          target = candidate;
          path = route;
          return;
        }
      }
      target = null;
      path = [];
    };

    const respawn = () => {
      body = [];
      path = [];
      target = null;
      const head = randomFree();
      if (!head) return;
      body = [head];
      for (let i = 1; i < START_LEN; i++) {
        const p = { x: head.x - i, y: head.y };
        if (isFree(p)) body.push(p);
        else break;
      }
      retarget();
    };

    const publish = () => {
      setSnake(body.map((p) => ({ ...p })));
      setFood(target ? { ...target } : null);
    };

    const step = () => {
      if (body.length === 0) {
        respawn();
        publish();
        return;
      }
      if (!target || path.length === 0) retarget();

      let next = path[0];
      if (!next || !isFree(next)) {
        // route invalidated (own body in the way) — replan from here
        if (target) {
          const route = findPath(body[0], target);
          if (route) path = route;
          else retarget();
        }
        next = path[0];
      }

      if (!next) {
        // nowhere reachable right now: take any safe step so the tail frees up
        const head = body[0];
        const safe = DIRS.map((d) => ({ x: head.x + d.x, y: head.y + d.y })).find(isFree);
        if (!safe) {
          respawn();
          publish();
          return;
        }
        next = safe;
      } else {
        path.shift();
      }

      body.unshift(next);
      if (target && next.x === target.x && next.y === target.y) {
        // ate: grow (skip the tail pop), pick the next destination
        if (body.length >= MAX_LEN) respawn();
        else retarget();
      } else {
        body.pop();
      }
      publish();
    };

    measure();
    respawn();
    publish();
    const id = setInterval(step, TICK_MS);
    const onResize = () => {
      measure();
      respawn();
      publish();
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearInterval(id);
      window.removeEventListener("resize", onResize);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div className="wall-snake" ref={ref} aria-hidden="true">
      {snake.map((p, i) => (
        <span
          key={i}
          className={`wall-snake__seg ${i === 0 ? "wall-snake__seg--head" : ""}`}
          style={{ transform: `translate(${p.x * CELL}px, ${p.y * CELL}px)` }}
          onClick={onClick}
        />
      ))}
      {food && (
        <span
          className="wall-snake__food"
          style={{ transform: `translate(${food.x * CELL}px, ${food.y * CELL}px)` }}
        />
      )}
    </div>
  );
}
