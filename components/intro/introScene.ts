import * as THREE from "three";
import { AsciiCanvasRenderer, type AsciiColors } from "./AsciiCanvasRenderer";
import { buildIntroRoom } from "./buildIntroRoom";
import { IntroAnimations } from "./introAnimations";

/**
 * Wires the room, the ASCII renderer, the idle/dolly camera, and the theme
 * observer together, and exposes an imperative handle for the enter/exit
 * transition.
 */

export interface DollyTarget {
  /** 2D monitor screen center, as a fraction of viewport height from top. */
  centerYFrac: number;
  /** 2D monitor screen height / viewport height. */
  heightFrac: number;
}

export interface IntroSceneHandle {
  dispose(): void;
  /** Fly into the monitor. onMatched fires when the 3D screen's projected
   * size crosses the 2D monitor frame (start the crossfade there). */
  startDolly(target: DollyTarget, onMatched: () => void, onDone: () => void, instant?: boolean): void;
  /** Fly back out to the idle room. */
  reverseDolly(onDone: () => void): void;
  /** Freeze rendering + room life while the 2D site is up. */
  pause(): void;
  hitTest(clientX: number, clientY: number): "monitor" | "lamp" | null;
  toggleLamp(): void;
}

const SCREEN_CENTER = new THREE.Vector3(0, 122, -110.9);
const SCREEN_H = 44;
const ROOM_LOOK = new THREE.Vector3(0, 94, -104);
const IDLE_POS = new THREE.Vector3(0, 122, 122);
const FOV_START = 55;
const FOV_END = 47;
const DOLLY_S = 1.2;
const END_FILL = 1.0; // screen height coverage at dolly end

const easeInOutCubic = (p: number) =>
  p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

function readThemeColors(): AsciiColors {
  const style = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  const rgb = get("--accent-rgb", "53, 255, 109");
  return {
    bg: get("--bg", "#020503"),
    // Alpha-scaled accent over the black bg: much brighter glow than the
    // dark --green-dim token, matching the neon-sign reference.
    dim: `rgba(${rgb}, 0.62)`,
    mid: `rgba(${rgb}, 0.94)`,
    bright: get("--green-bright", "#8cffb0"),
  };
}

export async function startIntroScene(canvas: HTMLCanvasElement): Promise<IntroSceneHandle> {
  await document.fonts.ready;

  const params = new URLSearchParams(window.location.search);
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
  const anims = new IntroAnimations(room, ascii);

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

  /* ---- camera state machine ---- */
  type Mode = "idle" | "dolly" | "away" | "reverse";
  let mode: Mode = "idle";
  let moveT0 = 0;
  const moveFrom = new THREE.Vector3();
  const moveTo = new THREE.Vector3();
  const lookFrom = new THREE.Vector3();
  const lookCur = ROOM_LOOK.clone();
  let fovFrom = FOV_START;
  let fovTo = FOV_END;
  let matched = false;
  let onMatchedCb: (() => void) | null = null;
  let onDoneCb: (() => void) | null = null;
  let matchFrac = 0.45;

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const spring = { x: 0, y: 0, vx: 0, vy: 0 };
  const baseY = 122;

  const clock = new THREE.Clock();
  let prevT = 0;

  const frame = () => {
    const t = clock.getElapsedTime();
    const dt = Math.min(0.1, t - prevT);
    prevT = t;
    if (mode === "away") return;

    if (mode === "idle") {
      const clampV = (v: number) => Math.max(-0.55, Math.min(0.55, v));
      spring.vx = clampV((spring.vx + (pointer.x * 12 - spring.x) * 0.018) * 0.9);
      spring.vy = clampV((spring.vy + (-pointer.y * 6 - spring.y) * 0.018) * 0.9);
      spring.x += spring.vx;
      spring.y += spring.vy;
      camera.position.x = Math.sin(t * 0.06) * 4 + spring.x;
      camera.position.y = baseY + Math.sin(t * 0.1) * 1.6 + spring.y;
      camera.position.z = IDLE_POS.z;
      lookCur.lerp(ROOM_LOOK, Math.min(1, dt * 4));
      camera.lookAt(lookCur);
    } else if (mode === "dolly" || mode === "reverse") {
      const p = Math.min(1, (t - moveT0) / DOLLY_S);
      const e = easeInOutCubic(p);
      camera.position.lerpVectors(moveFrom, moveTo, e);
      camera.fov = fovFrom + (fovTo - fovFrom) * e;
      camera.updateProjectionMatrix();
      const lookTarget = mode === "dolly" ? SCREEN_CENTER : ROOM_LOOK;
      lookCur.lerpVectors(lookFrom, lookTarget, e);
      camera.lookAt(lookCur);

      if (mode === "dolly" && !matched) {
        const d = camera.position.distanceTo(SCREEN_CENTER);
        const cov = SCREEN_H / (2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
        if (cov >= matchFrac) {
          matched = true;
          onMatchedCb?.();
        }
      }
      if (p >= 1) {
        if (mode === "dolly") {
          mode = "away";
          ascii.setSmoothing(0.22);
          onDoneCb?.();
          return;
        }
        mode = "idle";
        ascii.setSmoothing(0.22);
        onDoneCb?.();
      }
    }

    anims.update(dt);

    const drawStart = performance.now();
    ascii.render(renderer, scene, camera);
    anims.drawOverlays(camera);
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

  let raf = 0;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  const useIntervalTick = params.get("introtick") === "interval";
  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    frame();
  };
  if (useIntervalTick) intervalId = setInterval(frame, 66);
  else loop();

  /* ---- handle ---- */

  const tanEnd = Math.tan(THREE.MathUtils.degToRad(FOV_END / 2));

  return {
    startDolly(target, onMatched, onDone, instant = false) {
      if (mode === "dolly") return; // double-fire guard
      matchFrac = Math.max(0.2, Math.min(0.85, target.heightFrac));
      const dEnd = SCREEN_H / (2 * END_FILL * tanEnd);
      const dMatch = SCREEN_H / (2 * matchFrac * tanEnd);
      // vertical offset so the screen center projects onto the 2D monitor's
      // center at the crossfade moment
      const yOff = (0.5 - target.centerYFrac) * 2 * dMatch * tanEnd;
      moveTo.set(0, SCREEN_CENTER.y + yOff, SCREEN_CENTER.z + dEnd);
      moveFrom.copy(camera.position);
      lookFrom.copy(lookCur);
      fovFrom = camera.fov;
      fovTo = FOV_END;
      matched = false;
      onMatchedCb = onMatched;
      onDoneCb = onDone;

      if (instant) {
        camera.position.copy(moveTo);
        camera.fov = FOV_END;
        camera.updateProjectionMatrix();
        camera.lookAt(SCREEN_CENTER);
        lookCur.copy(SCREEN_CENTER);
        mode = "away";
        matched = true;
        onMatched();
        onDone();
        return;
      }
      ascii.setSmoothing(0.42); // more responsive during the fast move
      moveT0 = clock.getElapsedTime();
      mode = "dolly";
    },

    reverseDolly(onDone) {
      moveFrom.copy(camera.position);
      moveTo.copy(IDLE_POS);
      lookFrom.copy(lookCur);
      fovFrom = camera.fov;
      fovTo = FOV_START;
      onDoneCb = onDone;
      ascii.setSmoothing(0.42);
      moveT0 = clock.getElapsedTime();
      prevT = clock.getElapsedTime();
      mode = "reverse";
    },

    pause() {
      mode = "away";
    },

    hitTest(clientX, clientY) {
      if (mode !== "idle") return null;
      ndc.set(
        (clientX / window.innerWidth) * 2 - 1,
        -(clientY / window.innerHeight) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      if (raycaster.intersectObjects(room.monitorHit, false).length > 0) return "monitor";
      if (raycaster.intersectObject(room.lampHit, true).length > 0) return "lamp";
      return null;
    },

    toggleLamp() {
      anims.toggleLamp();
    },

    dispose() {
      cancelAnimationFrame(raf);
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      themeObserver.disconnect();
      fpsEl?.remove();
      ascii.dispose();
      room.dispose();
      renderer.dispose();
    },
  };
}
