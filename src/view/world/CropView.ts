import {
  Color,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Scene,
  Vector3,
} from "three";
import { CROPS, growthStage } from "../../data/crops";
import type { GameState } from "../../state/GameState";
import type { World } from "../../world/World";
import { buildingTransform } from "../placement";

const MAX_INSTANCES = 768;

const PLOT_OFFSETS = [
  { x: -0.72, z: -0.72 },
  { x: 0.72, z: -0.72 },
  { x: -0.72, z: 0.72 },
  { x: 0.72, z: 0.72 },
];

const CROP_OFFSETS = [
  { x: -0.2, z: -0.2 },
  { x: 0.2, z: -0.2 },
  { x: -0.2, z: 0.2 },
  { x: 0.2, z: 0.2 },
];

export class CropView {
  private group = new Group();
  private stalks: InstancedMesh;
  private heads: InstancedMesh;
  private stalkMaterial: MeshStandardMaterial;
  private headMaterial: MeshStandardMaterial;

  private matrix = new Matrix4();
  private quaternion = new Quaternion();
  private scale = new Vector3();
  private position = new Vector3();
  private color = new Color();

  constructor(scene: Scene) {
    const stalkGeometry = new CylinderGeometry(0.026, 0.038, 1, 5);
    stalkGeometry.translate(0, 0.5, 0);

    this.stalkMaterial = new MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
    this.headMaterial = new MeshStandardMaterial({ roughness: 0.8, metalness: 0 });

    this.stalks = new InstancedMesh(stalkGeometry, this.stalkMaterial, MAX_INSTANCES);
    this.stalks.castShadow = true;
    this.stalks.count = 0;

    this.heads = new InstancedMesh(new IcosahedronGeometry(0.085, 0), this.headMaterial, MAX_INSTANCES);
    this.heads.castShadow = true;
    this.heads.count = 0;

    this.group.add(this.stalks, this.heads);
    scene.add(this.group);
  }

  update(state: GameState, world: World): void {
    let index = 0;

    for (const building of state.buildings) {
      if (building.plots.length === 0) continue;
      const transform = buildingTransform(
        building.id,
        building.gx,
        building.gy,
        building.rotation,
        world,
      );
      const cos = Math.cos(transform.rotationY);
      const sin = Math.sin(transform.rotationY);

      building.plots.forEach((plot, plotIndex) => {
        if (!plot.crop) return;
        const def = CROPS[plot.crop];
        const stage = growthStage(plot.progress);
        const stageColor = def.stageColors[Math.min(stage, def.stageColors.length - 1)] as number;
        const growth = plot.progress;
        const height = 0.12 + growth * def.stalkHeight;

        const plotOffset = PLOT_OFFSETS[plotIndex % PLOT_OFFSETS.length] as { x: number; z: number };

        for (const cropOffset of CROP_OFFSETS) {
          if (index >= MAX_INSTANCES) return;

          const lx = plotOffset.x + cropOffset.x;
          const lz = plotOffset.z + cropOffset.z;
          const wx = lx * cos + lz * sin;
          const wz = -lx * sin + lz * cos;

          const baseY = transform.y + 0.18;

          this.position.set(transform.x + wx, baseY, transform.z + wz);
          this.scale.set(1, height, 1);
          this.matrix.compose(this.position, this.quaternion.identity(), this.scale);
          this.stalks.setMatrixAt(index, this.matrix);
          this.color.setHex(0x4f6b32).offsetHSL(0, 0, growth * 0.05);
          this.stalks.setColorAt(index, this.color);

          this.position.set(transform.x + wx, baseY + height, transform.z + wz);
          const headScale = 0.5 + growth * 0.9;
          this.scale.setScalar(headScale);
          this.matrix.compose(this.position, this.quaternion.identity(), this.scale);
          this.heads.setMatrixAt(index, this.matrix);
          this.color.setHex(stageColor);
          this.heads.setColorAt(index, this.color);

          index += 1;
        }
      });
    }

    this.stalks.count = index;
    this.heads.count = index;
    this.stalks.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;
    if (this.stalks.instanceColor) this.stalks.instanceColor.needsUpdate = true;
    if (this.heads.instanceColor) this.heads.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.stalks.geometry.dispose();
    this.heads.geometry.dispose();
    this.stalkMaterial.dispose();
    this.headMaterial.dispose();
  }
}
