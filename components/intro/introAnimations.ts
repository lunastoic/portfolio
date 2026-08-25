import * as THREE from "three";
import type { AsciiCanvasRenderer } from "./AsciiCanvasRenderer";
import type { IntroRoom } from "./buildIntroRoom";

/**
 * Phase 3 life: coffee steam, the dog's idle/walk/sit/wag brain, lamp
 * flicker, and the bouncing LUNA_OS screensaver.
 *
 * Steam and the screensaver text are drawn as OVERLAY characters at
 * projected world positions — they bypass the fill smoothing entirely, so
 * animation never reintroduces boil into the stable background.
 */

const STEAM_CHARS = ["~", "°", "o"];
const STEAM_MAX = 5;

interface SteamParticle {
  pos: THREE.Vector3;
  age: number;
  life: number;
  char: string;
  phase: number;
}

type DogMode = "idle" | "walk" | "sit";

export class IntroAnimations {
  private v = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  /* steam */
  private steam: SteamParticle[] = [];
  private nextSteamAt = 1;

  /* dog */
  private dogMode: DogMode = "idle";
  private dogUntil = 6;
  private nextWalkAt = 14;
  private walkDir = 1;
  private legPhase = 0;
  private walkAmount = 0;
  private sitAmount = 0;
  private wagUntil = 3;
  private nextWagAt = 6;

  /* lamp */
  private readonly lampBase: number;
  private nextFlickerAt = 7;
  private flickerEndAt = 0;
  private flickerVal = 1;
  private flickerStep = 0;

  /* screensaver */
  private ssVel = { x: 8.5, y: 5.6 };

  constructor(
    private room: IntroRoom,
    private ascii: AsciiCanvasRenderer
  ) {
    this.lampBase = room.lampLight.intensity;
  }

  update(t: number, dt: number) {
    this.updateSteam(t, dt);
    this.updateDog(t, dt);
    this.updateLamp(t);
    this.updateScreensaver(t, dt);
  }

  /* ------------------------------------------------------------------ */

  private updateSteam(t: number, dt: number) {
    if (t >= this.nextSteamAt && this.steam.length < STEAM_MAX) {
      this.room.mugTop.getWorldPosition(this.v);
      this.steam.push({
        pos: this.v.clone().add(
          new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 2)
        ),
        age: 0,
        life: 2.4 + Math.random() * 1.4,
        char: STEAM_CHARS[Math.floor(Math.random() * STEAM_CHARS.length)],
        phase: Math.random() * Math.PI * 2,
      });
      this.nextSteamAt = t + 0.7 + Math.random() * 0.7;
    }
    for (let i = this.steam.length - 1; i >= 0; i--) {
      const p = this.steam[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.steam.splice(i, 1);
        continue;
      }
      p.pos.y += dt * 6.5; // lazy rise
      p.pos.x += Math.sin(t * 1.6 + p.phase) * dt * 1.4; // gentle drift
    }
  }

  /* ------------------------------------------------------------------ */

  private updateDog(t: number, dt: number) {
    const { group, head, legs, tail } = this.room.dog;

    /* state transitions */
    if (t >= this.dogUntil) {
      if (this.dogMode === "walk" || this.dogMode === "sit") {
        this.dogMode = "idle";
        this.dogUntil = t + 7 + Math.random() * 6;
      } else if (t >= this.nextWalkAt) {
        this.dogMode = "walk";
        this.walkDir = group.position.x > 0 ? -1 : 1;
        this.dogUntil = t + 7 + Math.random() * 4;
        this.nextWalkAt = t + 20 + Math.random() * 20;
      } else if (Math.random() < 0.45) {
        this.dogMode = "sit";
        this.dogUntil = t + 6 + Math.random() * 4;
      } else {
        this.dogUntil = t + 6 + Math.random() * 6;
      }
    }

    /* eased amounts */
    this.walkAmount += ((this.dogMode === "walk" ? 1 : 0) - this.walkAmount) * Math.min(1, dt * 4);
    this.sitAmount += ((this.dogMode === "sit" ? 1 : 0) - this.sitAmount) * Math.min(1, dt * 3);

    /* walking */
    if (this.walkAmount > 0.01) {
      group.position.x += this.walkDir * 15 * dt * this.walkAmount;
      this.legPhase += dt * 8.5 * this.walkAmount;
      if (group.position.x > 140) this.walkDir = -1;
      if (group.position.x < -150) this.walkDir = 1;
    }
    const targetRotY = this.walkAmount > 0.3 ? (this.walkDir > 0 ? 0.3 : Math.PI - 0.3) : 0.6;
    group.rotation.y += (targetRotY - group.rotation.y) * Math.min(1, dt * 2.5);

    legs.forEach((leg, i) => {
      const swing = Math.sin(this.legPhase + (i % 2 === 0 ? 0 : Math.PI) + (i < 4 ? 0 : Math.PI / 2));
      const rearFold = i < 4 ? this.sitAmount * 1.2 : 0;
      leg.rotation.x = swing * 0.5 * this.walkAmount + rearFold;
    });
    group.position.y = Math.abs(Math.sin(this.legPhase)) * 0.6 * this.walkAmount;

    /* sitting: rear drops, chest and head rise */
    group.rotation.z = this.sitAmount * 0.3;

    /* tail wag: while sitting, walking, or in idle bursts */
    if (t >= this.nextWagAt) {
      this.wagUntil = t + 1.6 + Math.random() * 1.6;
      this.nextWagAt = t + 6 + Math.random() * 9;
    }
    const wagging = t < this.wagUntil || this.dogMode !== "idle" ? 1 : 0;
    tail.rotation.y = Math.sin(t * 11) * 0.55 * wagging;

    /* idle head sway */
    head.rotation.z = -0.05 + Math.sin(t * 0.45) * 0.05;
  }

  /* ------------------------------------------------------------------ */

  private updateLamp(t: number) {
    const light = this.room.lampLight;
    if (t >= this.nextFlickerAt) {
      this.flickerEndAt = t + 0.25 + Math.random() * 0.4;
      this.nextFlickerAt = t + 9 + Math.random() * 14;
    }
    if (t < this.flickerEndAt) {
      // stepped noise: old fluorescent settling, not a strobe
      if (++this.flickerStep % 3 === 0) this.flickerVal = 0.5 + Math.random() * 0.45;
    } else {
      this.flickerVal = 1;
    }
    light.intensity = this.lampBase * this.flickerVal;
  }

  /* ------------------------------------------------------------------ */

  private updateScreensaver(t: number, dt: number) {
    const { base, strips, quad } = this.room.screenSaver;
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

    // DVD-style bounce inside the screen bounds
    quad.position.x += this.ssVel.x * dt;
    quad.position.y += this.ssVel.y * dt;
    if (Math.abs(quad.position.x) > 24.5) {
      quad.position.x = Math.sign(quad.position.x) * 24.5;
      this.ssVel.x *= -1;
    }
    if (Math.abs(quad.position.y) > 17.5) {
      quad.position.y = Math.sign(quad.position.y) * 17.5;
      this.ssVel.y *= -1;
    }
  }

  /* ------------------------------------------------------------------ */

  /** Draw steam glyphs + screensaver text. Call AFTER ascii.render(). */
  drawOverlays(camera: THREE.Camera) {
    for (const p of this.steam) {
      this.v.copy(p.pos).project(camera);
      if (this.v.z > 1) continue;
      const f = p.age / p.life;
      const tier: 0 | 1 = f < 0.45 ? 1 : 0; // mid → dim, never bright: subtle
      this.ascii.overlayChar(p.char, this.v.x, this.v.y, tier, 1.35 - f * 0.4);
    }

    // LUNA_OS text riding the bouncing quad, scaled by projection
    const { quad } = this.room.screenSaver;
    quad.getWorldPosition(this.v);
    this.v2.copy(this.v).setY(this.v.y + 3.2);
    const c = this.v.clone().project(camera);
    const top = this.v2.project(camera);
    if (c.z <= 1) {
      const pxH = Math.abs(top.y - c.y) * 0.5 * this.ascii.canvasHeight;
      this.ascii.overlayText("LUNA_OS", c.x, c.y, Math.max(9, pxH * 1.6), 2);
    }
  }
}
