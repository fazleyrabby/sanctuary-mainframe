import { BUILDINGS, type BuildingId } from "../data/buildings";
import type { World } from "../world/World";

export interface BuildingTransform {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  width: number;
  depth: number;
}

export function buildingTransform(
  id: BuildingId,
  gx: number,
  gy: number,
  rotation: number,
  world: World,
): BuildingTransform {
  const def = BUILDINGS[id];
  const swapped = rotation % 2 !== 0;
  const size = swapped ? { w: def.size.h, h: def.size.w } : def.size;
  const cx = gx + (size.w - 1) / 2;
  const cy = gy + (size.h - 1) / 2;

  return {
    x: world.grid.worldX(cx),
    y: world.heightAt(Math.round(cx), Math.round(cy)),
    z: world.grid.worldZ(cy),
    rotationY: -Math.PI / 4 + rotation * (Math.PI / 2),
    width: size.w,
    depth: size.h,
  };
}
