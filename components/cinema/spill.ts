/**
 * Coffee that slops out of a tipping mug, simulated and drawn in the
 * painting's own pixel grid: a stream of drops off the rim under gravity,
 * splashes where it lands, a puddle that pools against the mug's base and
 * spreads along the desk, then soaks away.
 *
 * All units are art pixels; the canvas is scaled up by CSS with
 * image-rendering: pixelated so every rect here is one crisp art pixel.
 */
export interface SpillGeometry {
  width: number;
  height: number;
  /** The mug's rotation pivot, canvas coords. */
  pivot: [number, number];
  /** The rim's lowest-when-tipped corner at rest, canvas coords. */
  rim: [number, number];
  /** The desk surface the coffee lands on. */
  landY: number;
  /** The mug body's left edge; the puddle pools against it. */
  mugLeft: number;
}

export interface SpillColors {
  dark: string;
  mid: string;
  hi: string;
}

interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

const GRAVITY = 2300; // art px / s²
const SPAWN_PER_FRAME = 4;
const MAX_DEPTH = 6;
const DIFFUSE = 0.12;
const SOAK_DELAY = 3; // s after the last drop lands
const SOAK_RATE = 0.75; // 1/s
const SPREAD_S = 1.5; // s the puddle keeps spreading after the last drop lands

export class Spill {
  active = false;
  private drops: Drop[] = [];
  private depth: Float32Array;
  private pouring = false;
  private quietFor = 0;
  private soaking = false;
  private rng = () => Math.random();
  /** The puddle's right-hand wall: the mug's left side while it stands there, none once it's moved. */
  private wallX: number;
  /** The pool left where the mug's base stood once it's pushed away: seen from above, growing to full size. */
  private pool: { cx: number; rx: number; ry: number; rxTo: number; ryTo: number; k: number; wobble: number[] } | null = null;

  constructor(
    private g: SpillGeometry,
    private colors: SpillColors,
    /** Keep the puddle on the desk instead of letting it soak away. */
    private persist = false
  ) {
    this.depth = new Float32Array(g.width);
    this.wallX = g.mugLeft;
  }

  reset() {
    this.drops = [];
    this.depth.fill(0);
    this.pouring = false;
    this.quietFor = 0;
    this.soaking = false;
    this.active = false;
  }

  /** Anything still falling, pouring, spreading or soaking: the loop keeps drawing while this holds. */
  get moving() {
    return this.active && (this.pouring || this.drops.length > 0 || this.soaking || this.quietFor < SPREAD_S || (this.pool !== null && (this.pool.k < 1 || this.pool.rx !== this.pool.rxTo || this.pool.ry !== this.pool.ryTo)));
  }

  /** Where the rim corner is for a given mug tilt (CSS rotate, degrees). */
  rimAt(angleDeg: number): [number, number] {
    const a = (angleDeg * Math.PI) / 180;
    const [px, py] = this.g.pivot;
    const dx = this.g.rim[0] - px;
    const dy = this.g.rim[1] - py;
    return [px + dx * Math.cos(a) - dy * Math.sin(a), py + dx * Math.sin(a) + dy * Math.cos(a)];
  }

  setPouring(on: boolean) {
    this.pouring = on;
    if (on) {
      this.active = true;
      this.soaking = false;
      this.quietFor = 0;
    }
  }

  /**
   * The mug has been pushed off this spot: coffee that ran down its side is left in a puddle
   * where its base stood (centred on cx, about `spread` px either side), free to spread both ways.
   */
  leak(cx: number, rx: number, ry: number) {
    this.wallX = this.g.width;
    if (this.pool) {
      // another bump: the same puddle spreads a little wider
      this.pool.rxTo += rx * 0.22;
      this.pool.ryTo += ry * 0.15;
    } else {
      // an uneven edge: a few lobes round the rim, fixed for this puddle
      const wobble = Array.from({ length: 5 }, () => this.rng() * Math.PI * 2);
      this.pool = { cx, rx, ry, rxTo: rx, ryTo: ry, k: 0, wobble };
    }
    this.active = true;
    this.soaking = false;
    this.quietFor = 0;
  }

  /** A jolt: a few drops thrown up and over the rim at once, no pour behind them. */
  slosh(angleDeg: number, count: number) {
    const [sx, sy] = this.rimAt(angleDeg);
    for (let i = 0; i < count; i++) {
      this.drops.push({
        x: sx + (this.rng() - 0.3) * 4,
        y: sy - this.rng() * 2,
        vx: -(25 + this.rng() * 70),
        vy: -(40 + this.rng() * 120),
        r: 1.4 + this.rng() * 1.3,
      });
    }
    this.active = true;
    this.soaking = false;
    this.quietFor = 0;
  }

  step(dt: number, angleDeg: number) {
    if (!this.active) return;
    const { landY, width } = this.g;
    const mugLeft = this.wallX;
    // the pool spreads out fast at first, then creeps to its edge
    if (this.pool) {
      const p = this.pool;
      if (p.k < 1) p.k = Math.min(1, p.k + dt * 1.6 * (1.15 - p.k));
      const f = Math.min(1, dt * 3);
      p.rx += (p.rxTo - p.rx) * f;
      p.ry += (p.ryTo - p.ry) * f;
      if (Math.abs(p.rxTo - p.rx) < 0.05) p.rx = p.rxTo;
      if (Math.abs(p.ryTo - p.ry) < 0.05) p.ry = p.ryTo;
    }

    if (this.pouring) {
      const [sx, sy] = this.rimAt(angleDeg);
      // the harder the tilt, the faster it pours
      const push = 30 + Math.max(0, -angleDeg - 15) * 2.2;
      for (let i = 0; i < SPAWN_PER_FRAME; i++) {
        this.drops.push({
          x: sx + (this.rng() - 0.5) * 2,
          y: sy + this.rng() * 1.5,
          vx: -push * (0.8 + this.rng() * 0.5),
          vy: 10 + this.rng() * 40,
          r: 1.4 + this.rng() * 1.0,
        });
      }
    }

    // fall
    const landed: Drop[] = [];
    for (const d of this.drops) {
      d.vy += GRAVITY * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.y >= landY) landed.push(d);
    }
    if (landed.length) {
      this.drops = this.drops.filter((d) => d.y < landY);
      for (const d of landed) {
        const col = Math.max(1, Math.min(mugLeft - 2, Math.round(d.x)));
        this.depth[col] += 0.75 * d.r;
        // a fast drop splashes a droplet or two back up
        if (d.vy > 260 && this.rng() < 0.35) {
          const n = 1 + (this.rng() < 0.4 ? 1 : 0);
          for (let i = 0; i < n; i++) {
            this.drops.push({
              x: col,
              y: landY - 1,
              vx: (this.rng() - 0.7) * 90,
              vy: -(70 + this.rng() * 110),
              r: 0.8,
            });
          }
        }
      }
    }

    // the puddle spreads along the desk, held back by the mug on its right
    const k = DIFFUSE * Math.min(2, dt * 60);
    const h = this.depth;
    const prev = Float32Array.from(h);
    const last = mugLeft - 2;
    for (let i = 1; i < last; i++) {
      const l = prev[i - 1];
      const r = i + 1 <= last ? prev[i + 1] : prev[i];
      h[i] = prev[i] + k * (l - 2 * prev[i] + r);
      if (h[i] > MAX_DEPTH) {
        const over = (h[i] - MAX_DEPTH) * 0.5;
        h[i] = MAX_DEPTH;
        h[Math.max(1, i - 1)] += over;
        if (i + 1 <= last) h[i + 1] += over;
      }
    }
    for (let i = last + 1; i < width; i++) h[i] = 0;

    // once the pouring is over and the last drop has landed, the coffee soaks into the desk
    if (!this.pouring && this.drops.length === 0) {
      this.quietFor += dt;
      if (this.quietFor > SOAK_DELAY && !this.persist) this.soaking = true;
    }
    if (this.soaking) {
      const f = Math.exp(-SOAK_RATE * dt);
      let maxDepth = 0;
      for (let i = 0; i < width; i++) {
        h[i] *= f;
        if (h[i] < 0.3) h[i] = 0;
        if (h[i] > maxDepth) maxDepth = h[i];
      }
      if (maxDepth === 0) this.reset();
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { width, height, landY } = this.g;
    ctx.clearRect(0, 0, width, height);
    if (!this.active) return;
    const { dark, mid, hi } = this.colors;

    // the pool where the mug stood: a flat, slightly lobed ellipse on the desk, dark at its rim,
    // a lighter sheen across its far side
    if (this.pool) {
      const { cx, rx, ry, k, wobble } = this.pool;
      const ease = 1 - Math.pow(1 - k, 3), RX = rx * ease, RY = ry * ease, cy = landY + 3;
      if (RX >= 1) {
        for (let y = Math.floor(cy - RY - 2); y <= Math.ceil(cy + RY + 2); y++) {
          for (let x = Math.floor(cx - RX - 3); x <= Math.ceil(cx + RX + 3); x++) {
            const dx = (x + 0.5 - cx) / RX, dy = (y + 0.5 - cy) / Math.max(RY, 0.8);
            const a = Math.atan2(dy, dx);
            const edge = 1 + 0.12 * Math.sin(2 * a + wobble[0]) + 0.08 * Math.sin(3 * a + wobble[1]) + 0.05 * Math.sin(5 * a + wobble[2]);
            const r = Math.hypot(dx, dy) / edge;
            if (r > 1) continue;
            ctx.fillStyle = r > 0.8 ? dark : mid;
            if (r < 0.62 && dy < -0.25 && dx > -0.55 && dx < 0.25 && (x + y) % 2 === 0) ctx.fillStyle = hi;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }

    // puddle: a shallow bulge above the desk line and a perspective spread below it,
    // dark body with a lit rim on top
    for (let i = 0; i < width; i++) {
      const t = this.depth[i];
      if (t < 0.25) continue;
      const top = Math.round(landY - Math.min(t, 3.5));
      const bottom = Math.round(landY + 1 + t * 0.8);
      const mid1 = Math.round(landY + t * 0.3);
      ctx.fillStyle = mid;
      ctx.fillRect(i, top, 1, Math.max(1, mid1 - top));
      ctx.fillStyle = dark;
      ctx.fillRect(i, mid1, 1, Math.max(1, bottom - mid1));
      if (t > 1 && i % 3 !== 1) {
        ctx.fillStyle = hi;
        ctx.fillRect(i, top, 1, 1);
      }
    }

    // drops: 2px blobs, the fat ones 3px with a highlight
    for (const d of this.drops) {
      const x = Math.round(d.x);
      const y = Math.round(d.y);
      const s = d.r >= 2 ? 3 : 2;
      ctx.fillStyle = dark;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = mid;
      ctx.fillRect(x, y, s - 1, s - 1);
      if (d.r >= 2) {
        ctx.fillStyle = hi;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}
