import { Vector3 } from "three";
import { GameConfig } from "./GameConfig";
import type { DayPhase } from "./Events";

const TAU = Math.PI * 2;
const SUN_TILT = 0.35;

export class GameTime {
  hour: number = GameConfig.time.startHour;
  day = 1;

  readonly sunDirection = new Vector3(0, 1, SUN_TILT).normalize();
  sunElevation = 1;
  daylight = 1;
  phase: DayPhase = "morning";

  private hoursPerSecond = GameConfig.time.hoursPerDay / GameConfig.time.dayLengthSeconds;

  advance(deltaSeconds: number): void {
    this.hour += deltaSeconds * this.hoursPerSecond;
    while (this.hour >= 24) {
      this.hour -= 24;
      this.day += 1;
    }
    this.update();
  }

  update(): void {
    const sunAngle = (this.hour / 24) * TAU - Math.PI / 2;
    const sin = Math.sin(sunAngle);
    const cos = Math.cos(sunAngle);

    this.sunDirection.set(cos, sin, SUN_TILT).normalize();
    this.sunElevation = sin;
    this.daylight = clamp01((sin + 0.08) / 0.55);
    this.phase = resolvePhase(this.hour, sin);
  }

  get clockLabel(): string {
    const h = Math.floor(this.hour) % 24;
    const m = Math.floor((this.hour - Math.floor(this.hour)) * 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
}

function resolvePhase(hour: number, elevation: number): DayPhase {
  if (elevation <= -0.02) return "night";
  if (elevation < 0.22) return hour < 12 ? "dawn" : "dusk";
  return hour < 12 ? "morning" : "afternoon";
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
