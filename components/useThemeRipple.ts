"use client";

import { useCallback } from "react";
import { flushSync } from "react-dom";
import type { AppId } from "@/components/types";

type DocumentWithVT = Document & {
  startViewTransition?: (cb: () => void) => { ready: Promise<void> };
};

/**
 * Returns a function that applies a state update + section-theme swap inside
 * a circular-reveal view transition. The monitor (its own view-transition
 * layer) recolors instantly; the page ripple grows out from `getOrigin()`.
 */
export function useThemeRipple(getOrigin: () => { x: number; y: number } | null) {
  return useCallback(
    (theme: AppId | null, update: () => void) => {
      const root = document.documentElement;
      const apply = () => {
        if (theme && theme !== "about") root.dataset.theme = theme;
        else delete root.dataset.theme; // about = default green
        update();
      };

      const doc = document as DocumentWithVT;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const themeChanged =
        (root.dataset.theme ?? "about") !== (theme && theme !== "about" ? theme : "about");

      if (!doc.startViewTransition || reduced || !themeChanged) {
        apply();
        return;
      }

      const at = getOrigin() ?? {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      };
      const vt = doc.startViewTransition(() => flushSync(apply));
      vt.ready
        .then(() => {
          const maxR = Math.hypot(
            Math.max(at.x, window.innerWidth - at.x),
            Math.max(at.y, window.innerHeight - at.y)
          );
          root.animate(
            {
              clipPath: [
                `circle(0px at ${at.x}px ${at.y}px)`,
                `circle(${maxR}px at ${at.x}px ${at.y}px)`,
              ],
            },
            {
              duration: 700,
              easing: "cubic-bezier(0.2, 0, 0.2, 1)",
              pseudoElement: "::view-transition-new(root)",
            }
          );
        })
        .catch(() => {
          /* transition skipped (e.g. rapid clicks) — theme is applied anyway */
        });
    },
    [getOrigin]
  );
}
