import * as THREE from "three";
import { CHAR_RAMP } from "./config";

/**
 * Renders a three.js scene as ASCII characters on a 2D canvas.
 *
 * Pipeline per frame: render the scene into a tiny WebGLRenderTarget
 * (one pixel per character cell) → read the pixels back → map luminance
 * through CHAR_RAMP → blit pre-rendered glyphs from an atlas with
 * drawImage. Space cells are skipped entirely (typically most of the
 * frame), and glyphs come from the atlas so there are zero per-cell
 * fillText calls.
 */

export interface AsciiColors {
  bg: string;
  dim: string;
  mid: string;
  bright: string;
}

/** Ramp index → color tier (0 dim, 1 mid, 2 bright). */
const tierOf = (idx: number) => (idx < 4 ? 0 : idx < 7 ? 1 : 2);

export class AsciiCanvasRenderer {
  private cols: number;
  private rows: number;
  private target: THREE.WebGLRenderTarget;
  private pixels: Uint8Array;
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private atlas: HTMLCanvasElement;
  private lut: Uint8Array; // luminance byte -> ramp index
  private colors: AsciiColors;
  private fontFamily: string;
  private cellW = 8;
  private cellH = 8;
  private glyphW = 8;
  private glyphH = 8;

  constructor(
    canvas: HTMLCanvasElement,
    cols: number,
    rows: number,
    fontFamily: string,
    colors: AsciiColors
  ) {
    this.canvas = canvas;
    this.cols = cols;
    this.rows = rows;
    this.fontFamily = fontFamily;
    this.colors = colors;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.target = new THREE.WebGLRenderTarget(cols, rows, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
    });
    this.pixels = new Uint8Array(cols * rows * 4);
    this.atlas = document.createElement("canvas");

    // The render target readback is linear-light; convert to perceptual
    // (~sRGB) before mapping to the ramp, or everything crushes to dots.
    this.lut = new Uint8Array(256);
    for (let v = 0; v < 256; v++) {
      const perceptual = Math.pow(v / 255, 1 / 2.2);
      const idx = Math.round(perceptual * (CHAR_RAMP.length - 1));
      this.lut[v] = Math.min(CHAR_RAMP.length - 1, idx);
    }

    this.resize();
  }

  /** Fit the canvas to its CSS size and rebuild the glyph atlas. */
  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = w;
    this.canvas.height = h;
    this.cellW = w / this.cols;
    this.cellH = h / this.rows;
    this.glyphW = Math.ceil(this.cellW);
    this.glyphH = Math.ceil(this.cellH);
    this.buildAtlas();
  }

  setColors(colors: AsciiColors) {
    this.colors = colors;
    this.buildAtlas();
  }

  setFont(fontFamily: string) {
    this.fontFamily = fontFamily;
    this.buildAtlas();
  }

  /** Pre-render every ramp glyph in all three color tiers. */
  private buildAtlas() {
    const { glyphW: gw, glyphH: gh } = this;
    this.atlas.width = gw * CHAR_RAMP.length;
    this.atlas.height = gh * 3;
    const actx = this.atlas.getContext("2d")!;
    actx.clearRect(0, 0, this.atlas.width, this.atlas.height);
    actx.font = `${Math.floor(gh * 1.0)}px ${this.fontFamily}`;
    actx.textAlign = "center";
    actx.textBaseline = "middle";
    const tiers = [this.colors.dim, this.colors.mid, this.colors.bright];
    tiers.forEach((color, tier) => {
      actx.fillStyle = color;
      for (let i = 1; i < CHAR_RAMP.length; i++) {
        actx.fillText(CHAR_RAMP[i], i * gw + gw / 2, tier * gh + gh / 2 + 1);
      }
    });
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    const { cols, rows, ctx, cellW, cellH, glyphW: gw, glyphH: gh } = this;

    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.readRenderTargetPixels(this.target, 0, 0, cols, rows, this.pixels);

    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const px = this.pixels;
    for (let row = 0; row < rows; row++) {
      // The render target is bottom-up; flip vertically while drawing.
      const srcRow = rows - 1 - row;
      let offset = srcRow * cols * 4;
      const y = row * cellH;
      for (let col = 0; col < cols; col++, offset += 4) {
        // Grayscale scene → green channel is the luminance.
        const idx = this.lut[px[offset + 1]];
        if (idx === 0) continue; // space — skip (most of the frame)
        const tier = tierOf(idx);
        ctx.drawImage(
          this.atlas,
          idx * gw,
          tier * gh,
          gw,
          gh,
          col * cellW,
          y,
          cellW,
          cellH
        );
      }
    }
  }

  dispose() {
    this.target.dispose();
  }
}
