import * as THREE from "three";
import { CHAR_RAMP, TARGET_CELL_PX } from "./config";

/**
 * Renders a three.js scene as ASCII characters on a 2D canvas.
 *
 * Per frame:
 *  1. FILL pass — scene rendered into a grid-sized target; luminance is
 *     histogram-normalized (2nd..98th percentile, temporally smoothed) so
 *     the frame always exercises the full character ramp.
 *  2. EDGE pass — same scene with a normal-material override; adjacent
 *     cells with discontinuous normals are silhouette/crease edges, drawn
 *     as oriented glyphs (| - +) in the bright tier so shapes snap into
 *     focus.
 *
 * Glyphs blit from a prebuilt atlas (no per-cell fillText); empty cells
 * are skipped. Grid size derives from canvas size / TARGET_CELL_PX.
 */

export interface AsciiColors {
  bg: string;
  dim: string;
  mid: string;
  bright: string;
}

const EDGE_CHARS = "|-+";
const SLOPE_CHARS = "|-/\\"; // oriented shading for strongly sloped mid-tone surfaces
const EDGE_THRESHOLD = 110; // sum of |Δrgb| between neighbors, 0..765

const TIER1 = Math.floor(CHAR_RAMP.length * 0.36);
const TIER2 = Math.floor(CHAR_RAMP.length * 0.7);
const tierOf = (idx: number) => (idx < TIER1 ? 0 : idx < TIER2 ? 1 : 2);

export class AsciiCanvasRenderer {
  cols = 0;
  rows = 0;

  private fillTarget: THREE.WebGLRenderTarget | null = null;
  private normalTarget: THREE.WebGLRenderTarget | null = null;
  private fillBuf = new Uint8Array(0);
  private normalBuf = new Uint8Array(0);
  private lum = new Uint8Array(0);
  private edge = new Uint8Array(0); // 0 none, 1 '|', 2 '-', 3 '+'
  private edgePrev = new Uint8Array(0);
  private edgeShown = new Uint8Array(0);
  private smoothLum = new Float32Array(0);
  private cellIdx = new Uint8Array(0);
  private hist = new Uint32Array(256);
  private lo = 0.13; // smoothed low percentile (0..1)
  private frameCount = 0;
  private hi = 0.7; // smoothed high percentile

  private normalMat = new THREE.MeshNormalMaterial();
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private atlas: HTMLCanvasElement;
  private colors: AsciiColors;
  private fontFamily: string;
  private cellW = 8;
  private cellH = 8;
  private glyphW = 8;
  private glyphH = 8;

  constructor(canvas: HTMLCanvasElement, fontFamily: string, colors: AsciiColors) {
    this.canvas = canvas;
    this.fontFamily = fontFamily;
    this.colors = colors;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.atlas = document.createElement("canvas");
    this.resize();
  }

  /** Fit canvas to CSS size, derive the grid, rebuild targets + atlas. */
  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = w;
    this.canvas.height = h;
    this.cols = Math.min(340, Math.max(80, Math.round(w / TARGET_CELL_PX)));
    this.rows = Math.min(220, Math.max(50, Math.round(h / TARGET_CELL_PX)));
    this.cellW = w / this.cols;
    this.cellH = h / this.rows;
    this.glyphW = Math.ceil(this.cellW);
    this.glyphH = Math.ceil(this.cellH);

    const n = this.cols * this.rows;
    this.fillTarget?.dispose();
    this.normalTarget?.dispose();
    this.fillTarget = new THREE.WebGLRenderTarget(this.cols, this.rows, {
      depthBuffer: true,
    });
    this.normalTarget = new THREE.WebGLRenderTarget(this.cols, this.rows, {
      depthBuffer: true,
    });
    this.fillBuf = new Uint8Array(n * 4);
    this.normalBuf = new Uint8Array(n * 4);
    this.lum = new Uint8Array(n);
    this.edge = new Uint8Array(n);
    this.edgePrev = new Uint8Array(n);
    this.edgeShown = new Uint8Array(n);
    this.smoothLum = new Float32Array(n);
    this.cellIdx = new Uint8Array(n);
    this.buildAtlas();
  }

  setColors(colors: AsciiColors) {
    this.colors = colors;
    this.buildAtlas();
  }

  /** Atlas rows: dim / mid / bright ramp glyphs + a bright edge-glyph row. */
  private buildAtlas() {
    const { glyphW: gw, glyphH: gh } = this;
    this.atlas.width = gw * CHAR_RAMP.length;
    this.atlas.height = gh * 5;
    const actx = this.atlas.getContext("2d")!;
    actx.clearRect(0, 0, this.atlas.width, this.atlas.height);
    actx.font = `${gh}px ${this.fontFamily}`;
    actx.textAlign = "center";
    actx.textBaseline = "middle";
    [this.colors.dim, this.colors.mid, this.colors.bright].forEach((color, tier) => {
      actx.fillStyle = color;
      for (let i = 1; i < CHAR_RAMP.length; i++) {
        actx.fillText(CHAR_RAMP[i], i * gw + gw / 2, tier * gh + gh / 2 + 1);
      }
    });
    actx.fillStyle = this.colors.bright;
    for (let i = 0; i < EDGE_CHARS.length; i++) {
      actx.fillText(EDGE_CHARS[i], i * gw + gw / 2, 3 * gh + gh / 2 + 1);
    }
    actx.fillStyle = this.colors.mid;
    for (let i = 0; i < SLOPE_CHARS.length; i++) {
      actx.fillText(SLOPE_CHARS[i], i * gw + gw / 2, 4 * gh + gh / 2 + 1);
    }
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    const { cols, rows, ctx, cellW, cellH, glyphW: gw, glyphH: gh } = this;
    if (!this.fillTarget || !this.normalTarget) return;

    /* ---- pass 1: lit scene ---- */
    renderer.setRenderTarget(this.fillTarget);
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(this.fillTarget, 0, 0, cols, rows, this.fillBuf);

    /* ---- pass 2: normals for edge detection (every other frame) ---- */
    this.frameCount++;
    const runEdges = this.frameCount % 2 === 0;
    if (runEdges) {
    scene.overrideMaterial = this.normalMat;
    renderer.setRenderTarget(this.normalTarget);
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    renderer.readRenderTargetPixels(this.normalTarget, 0, 0, cols, rows, this.normalBuf);
    }
    renderer.setRenderTarget(null);

    /* ---- luminance + histogram (sRGB-encode the linear readback) ---- */
    const lum = this.lum;
    const hist = this.hist;
    hist.fill(0);
    let count = 0;
    for (let i = 0, p = 0; i < cols * rows; i++, p += 4) {
      const v = Math.round(Math.pow(this.fillBuf[p + 1] / 255, 1 / 2.2) * 255);
      lum[i] = v;
      if (v > 6) {
        hist[v]++;
        count++;
      }
    }

    /* ---- percentile auto-levels, temporally smoothed ---- */
    if (count > 32) {
      const loCut = count * 0.02;
      const hiCut = count * 0.98;
      let acc = 0;
      let p2 = 0;
      let p98 = 255;
      for (let v = 0; v < 256; v++) {
        acc += hist[v];
        if (p2 === 0 && acc >= loCut) p2 = v;
        if (acc >= hiCut) {
          p98 = v;
          break;
        }
      }
      const rate = this.frameCount < 4 ? 1 : 0.025; // settle fast, then hold
      this.lo += (Math.max(p2 / 255, 0.13) - this.lo) * rate;
      this.hi += (p98 / 255 - this.hi) * rate;
    }
    const lo = this.lo;
    const range = Math.max(0.08, this.hi - lo);

    /* ---- edges from normal discontinuities ---- */
    const nb = this.normalBuf;
    const edge = this.edge;
    if (runEdges) {
    this.edgePrev.set(edge);
    edge.fill(0);
    for (let y = 0; y < rows - 1; y++) {
      for (let x = 0; x < cols - 1; x++) {
        const i = y * cols + x;
        const p = i * 4;
        const pr = p + 4;
        const pd = p + cols * 4;
        const dRight =
          Math.abs(nb[p] - nb[pr]) +
          Math.abs(nb[p + 1] - nb[pr + 1]) +
          Math.abs(nb[p + 2] - nb[pr + 2]);
        const dDown =
          Math.abs(nb[p] - nb[pd]) +
          Math.abs(nb[p + 1] - nb[pd + 1]) +
          Math.abs(nb[p + 2] - nb[pd + 2]);
        const r = dRight > EDGE_THRESHOLD;
        const d = dDown > EDGE_THRESHOLD;
        if (r && d) edge[i] = 3;
        else if (r) edge[i] = 1;
        else if (d) edge[i] = 2;
      }
    }
    // Only show edges confirmed in two consecutive computations (kills crawl)
    for (let i = 0; i < edge.length; i++) {
      this.edgeShown[i] = edge[i] > 0 && this.edgePrev[i] > 0 ? edge[i] : 0;
    }
    }

    /* ---- draw ---- */
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const rampMax = CHAR_RAMP.length - 1;

    const sm = this.smoothLum;
    const cells = this.cellIdx;
    for (let row = 0; row < rows; row++) {
      const srcRow = rows - 1 - row; // render target is bottom-up
      const y = row * cellH;
      for (let col = 0; col < cols; col++) {
        const i = srcRow * cols + col;
        const e = this.edgeShown[i];
        if (e > 0) {
          ctx.drawImage(this.atlas, (e - 1) * gw, 3 * gh, gw, gh, col * cellW, y, cellW, cellH);
          continue;
        }

        // Temporal EMA on normalized luminance kills frame-to-frame boil...
        const v01 = Math.max(0, Math.min(1, (lum[i] / 255 - lo) / range));
        const smoothed = (sm[i] += (v01 - sm[i]) * 0.22);

        // ...and per-cell hysteresis: the glyph only changes once the value
        // moves clearly past the current step's boundary.
        const target =
          smoothed <= 0.025 ? 0 : 1 + Math.pow(smoothed, 0.9) * (rampMax - 1);
        if (Math.abs(target - cells[i]) > 0.62) {
          cells[i] = Math.max(0, Math.min(rampMax, Math.round(target)));
        }
        const idx = cells[i];
        if (idx === 0) continue;

        const tier = tierOf(idx);
        // Mid-tone cells on strongly sloped surfaces use oriented strokes
        // so shading follows form (hand-drawn ASCII style).
        if (tier === 1) {
          const p = i * 4;
          const nx = nb[p] - 128;
          const nyv = nb[p + 1] - 128;
          const ax = Math.abs(nx);
          const ay = Math.abs(nyv);
          if (ax > 78 || ay > 78) {
            let g: number;
            if (ax > ay * 1.6) g = 0; // '|'
            else if (ay > ax * 1.6) g = 1; // '-'
            else g = nx * nyv > 0 ? 3 : 2; // '\' or '/'
            ctx.drawImage(this.atlas, g * gw, 4 * gh, gw, gh, col * cellW, y, cellW, cellH);
            continue;
          }
        }

        ctx.drawImage(this.atlas, idx * gw, tier * gh, gw, gh, col * cellW, y, cellW, cellH);
      }
    }
  }

  dispose() {
    this.fillTarget?.dispose();
    this.normalTarget?.dispose();
    this.normalMat.dispose();
  }
}
