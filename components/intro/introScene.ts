import * as THREE from "three";
import { AsciiCanvasRenderer, type AsciiColors } from "./AsciiCanvasRenderer";
import { buildIntroRoom } from "./buildIntroRoom";
import { INTRO_COLS, INTRO_ROWS } from "./config";

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
  const useMono = params.get("introfont") === "mono";
  const fontFamily = useMono
    ? '"Courier New", monospace'
    : getComputedStyle(document.body).fontFamily;
  const showFps = params.get("fps") === "1";

  const room = buildIntroRoom();
  const { scene, camera } = room;

  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.setSize(INTRO_COLS, INTRO_ROWS);

  const ascii = new AsciiCanvasRenderer(
    canvas,
    INTRO_COLS,
    INTRO_ROWS,
    fontFamily,
    readThemeColors()
  );

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
  let fpsWindowStart = performance.now();
  if (showFps) {
    fpsEl = document.createElement("div");
    fpsEl.className = "intro__fps";
    canvas.parentElement?.appendChild(fpsEl);
  }

  /* ---- main loop: idle drift + parallax ---- */
  const clock = new THREE.Clock();
  let raf = 0;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  const baseY = 122;
  // Debug/test escape hatch: occluded windows starve rAF entirely, which
  // makes automated screenshots impossible. ?introtick=interval swaps the
  // scheduler; production always uses requestAnimationFrame.
  const useIntervalTick = params.get("introtick") === "interval";

  const frame = () => {
    const t = clock.getElapsedTime();

    const targetX = Math.sin(t * 0.12) * 7 + pointer.x * 15;
    const targetY = baseY + Math.sin(t * 0.19) * 2.5 - pointer.y * 8;
    camera.position.x += (targetX - camera.position.x) * 0.04;
    camera.position.y += (targetY - camera.position.y) * 0.04;
    camera.lookAt(0, 94, -104);

    // Monitor screensaver placeholder: gentle brightness breathing so the
    // screen clearly reads as ON (bouncing-text screensaver lands in Phase 3).
    const screenMat = room.monitorScreen.material as THREE.MeshBasicMaterial;
    screenMat.color.setScalar(0.5 + Math.sin(t * 1.8) * 0.12);

    ascii.render(renderer, scene, camera);

    if (fpsEl) {
      frames++;
      const now = performance.now();
      if (now - fpsWindowStart >= 1000) {
        fpsEl.textContent = `${frames} FPS`;
        frames = 0;
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
