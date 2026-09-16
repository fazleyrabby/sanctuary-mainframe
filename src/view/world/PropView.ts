import {
  BufferGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Scene,
  Vector3,
} from "three";
import { Rng } from "../../core/Rng";
import { TerrainType, type World } from "../../world/World";
import type { AssetManager } from "../AssetManager";
import type { MaterialSet } from "../Materials";

interface PropDef {
  key: string;
  material: "propOrganic" | "propHard";
  fallback: () => BufferGeometry;
}

interface Placement {
  position: Vector3;
  rotationY: number;
  scale: number;
}

const PROPS: PropDef[] = [
  { key: "pine_tree", material: "propOrganic", fallback: () => new CylinderGeometry(0.2, 0.3, 1.6, 6) },
  { key: "dead_tree", material: "propOrganic", fallback: () => new CylinderGeometry(0.1, 0.16, 1.8, 6) },
  { key: "bush", material: "propOrganic", fallback: () => new IcosahedronGeometry(0.4, 0) },
  { key: "rock", material: "propHard", fallback: () => new DodecahedronGeometry(0.4, 0) },
  { key: "boulder", material: "propHard", fallback: () => new DodecahedronGeometry(0.8, 0) },
  { key: "crate", material: "propOrganic", fallback: () => new DodecahedronGeometry(0.3, 0) },
  { key: "barrel", material: "propHard", fallback: () => new CylinderGeometry(0.3, 0.3, 0.8, 10) },
  { key: "scrap_pile", material: "propHard", fallback: () => new DodecahedronGeometry(0.5, 0) },
];

const DISTRIBUTION: Record<TerrainType, Array<{ key: string; chance: number }>> = {
  [TerrainType.Grass]: [
    { key: "pine_tree", chance: 0.07 },
    { key: "dead_tree", chance: 0.05 },
    { key: "bush", chance: 0.16 },
    { key: "rock", chance: 0.03 },
  ],
  [TerrainType.GrassDry]: [
    { key: "dead_tree", chance: 0.06 },
    { key: "bush", chance: 0.12 },
    { key: "scrap_pile", chance: 0.03 },
  ],
  [TerrainType.Dirt]: [
    { key: "scrap_pile", chance: 0.05 },
    { key: "barrel", chance: 0.03 },
    { key: "crate", chance: 0.03 },
    { key: "rock", chance: 0.04 },
  ],
  [TerrainType.Stone]: [
    { key: "rock", chance: 0.22 },
    { key: "boulder", chance: 0.06 },
    { key: "scrap_pile", chance: 0.05 },
  ],
  [TerrainType.Sand]: [
    { key: "rock", chance: 0.06 },
    { key: "bush", chance: 0.04 },
  ],
  [TerrainType.Water]: [],
};

const CENTER_CLEAR = 5;

export class PropView {
  readonly group = new Group();
  private meshes: InstancedMesh[] = [];
  private ownedGeometries: BufferGeometry[] = [];

  constructor(
    private readonly scene: Scene,
    private readonly materials: MaterialSet,
    private readonly assets: AssetManager,
  ) {}

  build(world: World): void {
    const rng = new Rng(world.seed + 4477);
    const buckets = new Map<string, Placement[]>();
    for (const prop of PROPS) buckets.set(prop.key, []);

    for (let gy = 0; gy < world.height; gy += 1) {
      for (let gx = 0; gx < world.width; gx += 1) {
        const type = world.typeAt(gx, gy);
        const rules = DISTRIBUTION[type];
        if (!rules || rules.length === 0) continue;

        const cx = gx - world.width / 2;
        const cy = gy - world.height / 2;
        if (Math.hypot(cx, cy) < CENTER_CLEAR) continue;

        const height = world.heightAt(gx, gy);
        for (const rule of rules) {
          if (!rng.chance(rule.chance)) continue;
          const bucket = buckets.get(rule.key);
          if (!bucket) continue;

          const px = world.grid.worldX(gx) + rng.range(-0.3, 0.3);
          const pz = world.grid.worldZ(gy) + rng.range(-0.3, 0.3);
          bucket.push({
            position: new Vector3(px, height, pz),
            rotationY: rng.range(0, Math.PI * 2),
            scale: rng.range(0.8, 1.3),
          });
          break;
        }
      }
    }

    for (const prop of PROPS) {
      const placements = buckets.get(prop.key) ?? [];
      if (placements.length === 0) continue;
      this.addInstanced(prop, placements);
    }

    this.scene.add(this.group);
  }

  private addInstanced(prop: PropDef, placements: Placement[]): void {
    let geometry = this.assets.getPropGeometry(prop.key);
    if (!geometry) {
      geometry = prop.fallback();
      this.ownedGeometries.push(geometry);
    }

    const material = this.materials[prop.material];
    const mesh = new InstancedMesh(geometry, material, placements.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const matrix = new Matrix4();
    const quat = new Quaternion();
    const scaleVec = new Vector3();
    const axis = new Vector3(0, 1, 0);

    placements.forEach((placement, index) => {
      quat.setFromAxisAngle(axis, placement.rotationY);
      scaleVec.setScalar(placement.scale);
      matrix.compose(placement.position, quat, scaleVec);
      mesh.setMatrixAt(index, matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
    this.meshes.push(mesh);
    this.group.add(mesh);
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.ownedGeometries.forEach((geometry) => geometry.dispose());
    this.ownedGeometries = [];
    this.meshes = [];
  }
}
