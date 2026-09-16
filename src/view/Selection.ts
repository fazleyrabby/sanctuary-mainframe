import { BoxGeometry, Group, Mesh, Scene } from "three";
import type { World } from "../world/World";
import type { MaterialSet } from "./Materials";

export class Selection {
  private group = new Group();
  private hoverMesh: Mesh;
  private selectMesh: Mesh;

  constructor(
    scene: Scene,
    materials: MaterialSet,
    private readonly world: World,
  ) {
    const geometry = new BoxGeometry(1, 0.06, 1);

    this.hoverMesh = new Mesh(geometry, materials.hover);
    this.hoverMesh.visible = false;
    this.hoverMesh.renderOrder = 10;

    this.selectMesh = new Mesh(geometry, materials.selection);
    this.selectMesh.visible = false;
    this.selectMesh.renderOrder = 11;

    this.group.add(this.hoverMesh, this.selectMesh);
    scene.add(this.group);
  }

  setHover(gx: number, gy: number, w = 1, h = 1): void {
    this.place(this.hoverMesh, gx, gy, w, h, 0.05);
  }

  clearHover(): void {
    this.hoverMesh.visible = false;
  }

  setSelection(gx: number, gy: number, w = 1, h = 1): void {
    this.place(this.selectMesh, gx, gy, w, h, 0.08);
  }

  clearSelection(): void {
    this.selectMesh.visible = false;
  }

  private place(mesh: Mesh, gx: number, gy: number, w: number, h: number, yOffset: number): void {
    const grid = this.world.grid;
    const cx = gx + (w - 1) / 2;
    const cy = gy + (h - 1) / 2;
    const height = this.world.heightAt(Math.round(cx), Math.round(cy));

    mesh.position.set(grid.worldX(cx), height + yOffset, grid.worldZ(cy));
    mesh.scale.set(w * 0.98, 1, h * 0.98);
    mesh.visible = true;
  }
}
