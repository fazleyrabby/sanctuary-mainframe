import { Group, Scene } from "three";
import { BUILDINGS, type BuildingId } from "../data/buildings";
import type { World } from "../world/World";
import type { MaterialSet } from "./Materials";
import type { BuildingFactory } from "./world/BuildingFactory";

export class Ghost {
  private group: Group | null = null;
  private currentId: BuildingId | null = null;

  constructor(
    private readonly scene: Scene,
    private readonly world: World,
    private readonly materials: MaterialSet,
    private readonly factory: BuildingFactory,
  ) {}

  show(id: BuildingId, gx: number, gy: number, rotation: number, valid: boolean): void {
    if (this.currentId !== id || !this.group) {
      this.disposeGroup();
      this.group = this.factory.create(id, 1);
      this.factory.applyGhostMaterial(this.group, valid ? this.materials.ghostValid : this.materials.ghostInvalid);
      this.scene.add(this.group);
      this.currentId = id;
    } else {
      this.factory.applyGhostMaterial(this.group, valid ? this.materials.ghostValid : this.materials.ghostInvalid);
    }

    const def = BUILDINGS[id];
    const swapped = rotation % 2 !== 0;
    const size = swapped ? { w: def.size.h, h: def.size.w } : def.size;

    const grid = this.world.grid;
    const cx = gx + (size.w - 1) / 2;
    const cy = gy + (size.h - 1) / 2;

    this.group.position.set(
      grid.worldX(cx),
      this.world.heightAt(Math.round(cx), Math.round(cy)) + 0.02,
      grid.worldZ(cy),
    );
    this.group.rotation.y = -Math.PI / 4 + rotation * (Math.PI / 2);
    this.group.visible = true;
  }

  hide(): void {
    if (this.group) this.group.visible = false;
  }

  dispose(): void {
    this.disposeGroup();
  }

  private disposeGroup(): void {
    if (!this.group) return;
    this.scene.remove(this.group);
    this.group = null;
    this.currentId = null;
  }
}
