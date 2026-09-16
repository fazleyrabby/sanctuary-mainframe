import {
  Group,
  InstancedMesh,
  Matrix4,
  OrthographicCamera,
  Quaternion,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
} from "three";
import { NODES, NODE_KINDS, type NodeKind } from "../../data/resources";
import type { GameState, ResourceNode } from "../../state/GameState";
import type { World } from "../../world/World";
import type { AssetManager } from "../AssetManager";
import type { MaterialSet } from "../Materials";

const NODE_SCALE = 1.15;

export class NodeView {
  private group = new Group();
  private meshes = new Map<NodeKind, InstancedMesh>();
  private nodeOrder = new Map<NodeKind, ResourceNode[]>();
  private raycaster = new Raycaster();
  private ndc = new Vector2();
  private matrix = new Matrix4();
  private quaternion = new Quaternion();
  private position = new Vector3();
  private scale = new Vector3(NODE_SCALE, NODE_SCALE, NODE_SCALE);

  constructor(
    private readonly scene: Scene,
    private readonly materials: MaterialSet,
    private readonly assets: AssetManager,
  ) {}

  build(state: GameState, world: World): void {
    for (const kind of NODE_KINDS) {
      const def = NODES[kind];
      const geometry = this.assets.getPropGeometry(def.propKey);
      if (!geometry) continue;

      const material = kind === "wood" ? this.materials.propOrganic : this.materials.propHard;
      const mesh = new InstancedMesh(geometry, material, 256);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.count = 0;
      this.meshes.set(kind, mesh);
      this.group.add(mesh);
    }

    this.scene.add(this.group);
    this.refresh(state, world);
  }

  refresh(state: GameState, world: World): void {
    for (const kind of NODE_KINDS) {
      const mesh = this.meshes.get(kind);
      if (!mesh) continue;
      const nodes = state.nodes.filter((node) => node.kind === kind);
      this.nodeOrder.set(kind, nodes);

      nodes.forEach((node, index) => {
        const height = world.heightAt(node.gx, node.gy);
        this.position.set(world.grid.worldX(node.gx), height, world.grid.worldZ(node.gy));
        this.matrix.compose(this.position, this.quaternion.identity(), this.scale);
        mesh.setMatrixAt(index, this.matrix);
      });

      mesh.count = nodes.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }

  pick(
    camera: OrthographicCamera,
    clientX: number,
    clientY: number,
    width: number,
    height: number,
  ): ResourceNode | null {
    this.ndc.set((clientX / width) * 2 - 1, -(clientY / height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, camera);

    const targets = [...this.meshes.values()];
    const hits = this.raycaster.intersectObjects(targets, false);
    if (hits.length === 0) return null;

    const hit = hits[0];
    if (hit.instanceId === undefined) return null;

    for (const [kind, mesh] of this.meshes) {
      if (mesh !== hit.object) continue;
      const nodes = this.nodeOrder.get(kind);
      return nodes?.[hit.instanceId] ?? null;
    }
    return null;
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.meshes.clear();
  }
}
