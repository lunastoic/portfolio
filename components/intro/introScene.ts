import * as THREE from "three";
import { AsciiCanvasRenderer, type AsciiColors } from "./AsciiCanvasRenderer";
import { buildIntroRoom } from "./buildIntroRoom";


/**
 * Wires the room, the ASCII canvas renderer, the idle camera, and the
 * theme observer together. Returns a cleanup function.
 */

function readThemeColors(): AsciiColors {
  const style = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  return {
    bg: get("--bg", "#020503"),
    dim: get("--green-dim", "#0d6b32"),
    mid: get("--green", "#35ff6d"),
    bright: get("--green-bright", "#8cffb0"),
  };
}

export async function startIntroScene(canvas: HTMLCanvasElement): Promise<() => void> {
  await document.fonts.ready;

  const params = new URLSearchParams(window.location.search);
  // Font locked after the Phase 2 A/B: mono won.
  const fontFamily = '"Courier New", monospace';
  const showFps = params.get("fps") === "1";

  const room = buildIntroRoom();
  const { scene, camera } = room;

  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.setSize(64, 64); // renders happen in grid-sized targets

  const ascii = new AsciiCanvasRenderer(canvas, fontFamily, readThemeColors());

  const setAspect = () => {
    camera.aspect = (canvas.clientWidth || 1) / (canvas.clientHeight || 1);
    camera.updateProjectionMatrix();
  };
  setAspect();

  /* ---- pointer parallax ---- */
  const pointer = { x: 0, y: 0 };
  const onPointerMove = (e: PointerEvent) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener("pointermove", onPointerMove);

  const onResize = () => {
    ascii.resize();
    setAspect();
  };
  window.addEventListener("resize", onResize);

  /* ---- theme sync ---- */
  const themeObserver = new MutationObserver(() => ascii.setColors(readThemeColors()));
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  /* ---- fps meter (?fps=1) ---- */
  let fpsEl: HTMLDivElement | null = null;
  let frames = 0;
  let frameMsAcc = 0;
  let fpsWindowStart = performance.now();
  if (showFps) {
    fpsEl = document.createElement("div");
    fpsEl.className = "intro__fps";
    canvas.parentElement?.appendChild(fpsEl);
  }

  /* ---- main loop: idle drift + parallax ---- */
  const clock = new THREE.Clock();
  const spring = { x: 0, y: 0, vx: 0, vy: 0 };
  let raf = 0;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  const baseY = 122;
  // Debug/test escape hatch: occluded windows starve rAF entirely, which
  // makes automated screenshots impossible. ?introtick=interval swaps the
  // scheduler; production always uses requestAnimationFrame.
  const useIntervalTick = params.get("introtick") === "interval";

  const frame = () => {
    const t = clock.getElapsedTime();

    // Damped-spring parallax: heavy, cinematic, capped velocity.
    const clampV = (v: number) => Math.max(-0.55, Math.min(0.55, v));
    spring.vx = clampV((spring.vx + (pointer.x * 12 - spring.x) * 0.018) * 0.9);
    spring.vy = clampV((spring.vy + (-pointer.y * 6 - spring.y) * 0.018) * 0.9);
    spring.x += spring.vx;
    spring.y += spring.vy;

    camera.position.x = Math.sin(t * 0.06) * 4 + spring.x;
    camera.position.y = baseY + Math.sin(t * 0.1) * 1.6 + spring.y;
    camera.lookAt(0, 94, -104);

    // Live screen: breathing glow, drifting scanlines, bouncing block,
    // occasional single-frame flicker.
    const { base, strips, quad } = room.screenSaver;
    const flick = Math.random() < 0.007 ? 0.25 : 0;
    (base.material as THREE.MeshBasicMaterial).color.setScalar(
      0.55 + Math.sin(t * 1.7) * 0.07 + flick
    );
    strips.forEach((strip, i) => {
      (strip.material as THREE.MeshBasicMaterial).color.setScalar(
        0.32 + 0.08 * Math.sin(t * 2.6 + i * 1.4)
      );
      strip.position.y = -17.5 + ((i * 7 + t * 2.2) % 42);
    });
    quad.position.x = Math.sin(t * 0.62) * 23;
    quad.position.y = Math.sin(t * 1.07) * 16;

    const drawStart = performance.now();
    ascii.render(renderer, scene, camera);
    frameMsAcc += performance.now() - drawStart;

    if (fpsEl) {
      frames++;
      const now = performance.now();
      if (now - fpsWindowStart >= 1000) {
        fpsEl.textContent = `${frames} FPS · ${(frameMsAcc / Math.max(1, frames)).toFixed(1)} ms/frame · ${ascii.cols}x${ascii.rows}`;
        frames = 0;
        frameMsAcc = 0;
        fpsWindowStart = now;
      }
    }
  };

  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    frame();
  };

  if (useIntervalTick) intervalId = setInterval(frame, 66);
  else loop();

  return () => {
    cancelAnimationFrame(raf);
    if (intervalId) clearInterval(intervalId);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("resize", onResize);
    themeObserver.disconnect();
    fpsEl?.remove();
    ascii.dispose();
    room.dispose();
    renderer.dispose();
  };
}
