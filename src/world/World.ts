import { Grid } from "./Grid";
import { fbm } from "./Noise";
import { Rng } from "../core/Rng";

export enum TerrainType {
  Grass = 0,
  GrassDry = 1,
  Dirt = 2,
  Stone = 3,
  Sand = 4,
  Water = 5,
}

export const TERRAIN_NAMES: Record<TerrainType, string> = {
  [TerrainType.Grass]: "Grassland",
  [TerrainType.GrassDry]: "Dry Grass",
  [TerrainType.Dirt]: "Bare Dirt",
  [TerrainType.Stone]: "Rocky Ground",
  [TerrainType.Sand]: "Sand",
  [TerrainType.Water]: "Water",
};

export function terrainName(type: TerrainType): string {
  return TERRAIN_NAMES[type] ?? "Unknown";
}

export interface Tile {
  type: TerrainType;
  height: number;
}

export class World {
  readonly grid: Grid;
  readonly types: Uint8Array;
  readonly heights: Float32Array;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly tileSize: number,
    readonly seed: number,
  ) {
    this.grid = new Grid(width, height, tileSize);
    this.types = new Uint8Array(width * height);
    this.heights = new Float32Array(width * height);
    this.generate();
  }

  private generate(): void {
    const rng = new Rng(this.seed);
    const cx = this.width / 2;
    const cy = this.height / 2;

    for (let gy = 0; gy < this.height; gy += 1) {
      for (let gx = 0; gx < this.width; gx += 1) {
        const i = this.grid.index(gx, gy);
        const nx = gx / 14;
        const ny = gy / 14;

        const elevation = fbm(nx, ny, this.seed, 4);
        const moisture = fbm(nx + 40, ny + 90, this.seed + 7, 3);
        const detail = fbm(nx * 3, ny * 3, this.seed + 21, 2);

        const dist = Math.hypot(gx - cx, gy - cy) / (this.width / 2);
        const edgeFalloff = Math.min(1, Math.max(0, (dist - 0.78) * 3));

        let type = TerrainType.Grass;
        if (elevation < 0.3) type = TerrainType.Water;
        else if (elevation < 0.35) type = TerrainType.Sand;
        else if (elevation > 0.74) type = TerrainType.Stone;
        else if (moisture < 0.36) type = TerrainType.GrassDry;
        else if (moisture > 0.66) type = TerrainType.Dirt;

        if (type !== TerrainType.Water && rng.chance(0.02 + edgeFalloff * 0.1)) {
          type = rng.chance(0.5) ? TerrainType.Dirt : TerrainType.Stone;
        }

        this.types[i] = type;

        const base = (elevation - 0.4) * 1.3;
        this.heights[i] =
          type === TerrainType.Water ? -0.22 : base + (detail - 0.5) * 0.26;
      }
    }
  }

  typeAt(gx: number, gy: number): TerrainType {
    return this.types[this.grid.index(gx, gy)] as TerrainType;
  }

  heightAt(gx: number, gy: number): number {
    return this.heights[this.grid.index(gx, gy)] ?? 0;
  }

  isWater(gx: number, gy: number): boolean {
    return this.typeAt(gx, gy) === TerrainType.Water;
  }

  isBuildable(gx: number, gy: number): boolean {
    if (!this.grid.inBounds(gx, gy)) return false;
    const type = this.typeAt(gx, gy);
    return type !== TerrainType.Water && type !== TerrainType.Stone;
  }
}
