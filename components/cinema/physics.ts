/** A damped spring toward a target. `kick` adds velocity, which is what a tap does. */
export class Spring {
  x = 0;
  v = 0;
  target = 0;

  constructor(
    public k: number,
    public c: number
  ) {}

  kick(dv: number) {
    this.v += dv;
  }

  step(dt: number) {
    const a = -this.k * (this.x - this.target) - this.c * this.v;
    this.v += a * dt;
    this.x += this.v * dt;
  }

  get idle() {
    return Math.abs(this.x - this.target) < 0.02 && Math.abs(this.v) < 0.4;
  }

  settle() {
    this.x = this.target;
    this.v = 0;
  }
}

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
