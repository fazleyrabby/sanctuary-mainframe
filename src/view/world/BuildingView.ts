import { Group, Mesh, PointLight, Scene } from "three";
import type { GameState, PlacedBuilding } from "../../state/GameState";
import type { World } from "../../world/World";
import type { AssetManager } from "../AssetManager";
import type { MaterialSet } from "../Materials";
import { buildingTransform } from "../placement";
import { BuildingFactory } from "./BuildingFactory";

export class BuildingView {
  readonly group = new Group();
  private factory: BuildingFactory;
  private byUid = new Map<number, Group>();
  private flames: Mesh[] = [];
  private fireLights: PointLight[] = [];

  constructor(
    private readonly scene: Scene,
    materials: MaterialSet,
    assets?: AssetManager,
  ) {
    this.factory = new BuildingFactory(materials, assets);
    this.scene.add(this.group);
  }

  get factoryRef(): BuildingFactory {
    return this.factory;
  }

  add(building: PlacedBuilding, world: World): void {
    const mesh = this.factory.create(building.id, building.uid);
    const transform = buildingTransform(building.id, building.gx, building.gy, building.rotation, world);

    mesh.position.set(transform.x, transform.y, transform.z);
    mesh.rotation.y = transform.rotationY;

    mesh.traverse((object) => {
      if (object.name === "flame") this.flames.push(object as Mesh);
      if (object.name === "fireLight") this.fireLights.push(object as PointLight);
    });

    this.byUid.set(building.uid, mesh);
    this.group.add(mesh);
  }

  rebuild(state: GameState, world: World): void {
    this.clear();
    for (const building of state.buildings) this.add(building, world);
  }

  clear(): void {
    this.group.clear();
    this.byUid.clear();
    this.flames = [];
    this.fireLights = [];
    this.factory.resetLights();
  }

  update(elapsed: number, daylight: number): void {
    for (const flame of this.flames) {
      const flicker = 0.9 + Math.sin(elapsed * 11.0 + flame.id) * 0.06 + Math.sin(elapsed * 23.0) * 0.04;
      flame.scale.set(1, flicker, 1);
    }
    const boost = 1 + (1 - daylight) * 1.6;
    for (const light of this.fireLights) {
      light.intensity = (2.2 + Math.sin(elapsed * 13.0 + light.id) * 0.25) * boost;
    }
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.factory.dispose();
  }
}
