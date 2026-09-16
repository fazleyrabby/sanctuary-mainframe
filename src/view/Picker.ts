import { OrthographicCamera, Raycaster, Vector2, Vector3 } from "three";
import type { World } from "../world/World";

export interface GroundHit {
  gx: number;
  gy: number;
  point: Vector3;
}

export class Picker {
  private raycaster = new Raycaster();
  private ndc = new Vector2();
  private point = new Vector3();

  constructor(
    private readonly camera: OrthographicCamera,
    private readonly world: World,
  ) {}

  pick(clientX: number, clientY: number, width: number, height: number): GroundHit | null {
    this.ndc.set((clientX / width) * 2 - 1, -(clientY / height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);

    const ray = this.raycaster.ray;
    if (Math.abs(ray.direction.y) < 1e-5) return null;

    const grid = this.world.grid;
    let planeY = 0;
    let gx = 0;
    let gy = 0;

    for (let iteration = 0; iteration < 4; iteration += 1) {
      const distance = (planeY - ray.origin.y) / ray.direction.y;
      if (distance < 0) return null;

      this.point.copy(ray.origin).addScaledVector(ray.direction, distance);
      gx = grid.worldToGridX(this.point.x);
      gy = grid.worldToGridY(this.point.z);
      if (!grid.inBounds(gx, gy)) return null;

      planeY = this.world.heightAt(gx, gy);
    }

    this.point.y = planeY;
    return { gx, gy, point: this.point.clone() };
  }
}
