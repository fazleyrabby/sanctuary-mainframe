import { Scene, Vector3 } from "three";
import { GameConfig, type QualityPreset } from "../core/GameConfig";
import type { GameTime } from "../core/Time";
import type { GameState, PlacedBuilding, ResourceNode } from "../state/GameState";
import type { World } from "../world/World";
import { AssetManager } from "./AssetManager";
import { CameraRig } from "./CameraRig";
import { Lighting } from "./Lighting";
import { applyQualityToMaterials, createMaterials, type MaterialSet } from "./Materials";
import { PostFX } from "./PostFX";
import { createRenderer, type RendererHandle } from "./Renderer";
import { Sky } from "./Sky";
import { animateWater, type WaterAnimation } from "./WaterMaterial";
import { BuildingView } from "./world/BuildingView";
import { CropView } from "./world/CropView";
import { NodeView } from "./world/NodeView";
import { PropView } from "./world/PropView";
import { TerrainView } from "./world/TerrainView";

const BUILDING_ASSETS = [
  "shelter",
  "farm",
  "storage",
  "water_collector",
  "workshop",
  "generator",
  "server_room",
  "ai_core",
];

const PROP_ASSETS = [
  "dead_tree",
  "pine_tree",
  "rock",
  "boulder",
  "bush",
  "crate",
  "barrel",
  "scrap_pile",
];

const SURFACE_ASSETS = [
  "terrain_grass",
  "terrain_grass_dry",
  "terrain_dirt",
  "terrain_stone",
  "terrain_sand",
  "terrain_cliff",
];

export class View {
  readonly scene = new Scene();
  readonly cameraRig = new CameraRig();
  readonly materials: MaterialSet;
  readonly assets = new AssetManager();

  private rendererHandle: RendererHandle;
  private sky: Sky;
  private lighting: Lighting;
  private postFX: PostFX;
  private terrainView: TerrainView;
  private propView: PropView;
  private buildingView: BuildingView;
  private cropView: CropView;
  private nodeView: NodeView;
  private waterAnimation: WaterAnimation | null = null;

  private elapsed = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.rendererHandle = createRenderer(canvas);
    this.materials = createMaterials();

    this.sky = new Sky(this.scene);
    this.lighting = new Lighting(this.scene);

    this.terrainView = new TerrainView(this.scene, this.materials, this.assets);
    this.propView = new PropView(this.scene, this.materials, this.assets);
    this.buildingView = new BuildingView(this.scene, this.materials, this.assets);
    this.cropView = new CropView(this.scene);
    this.nodeView = new NodeView(this.scene, this.materials, this.assets);

    this.postFX = new PostFX(
      this.rendererHandle.renderer,
      this.scene,
      this.cameraRig.camera,
      window.innerWidth,
      window.innerHeight,
    );

    this.cameraRig.resize(window.innerWidth, window.innerHeight);
    this.setQuality(GameConfig.quality.default);
  }

  async loadAssets(): Promise<void> {
    await this.assets.load({ buildings: BUILDING_ASSETS, props: PROP_ASSETS });
    await Promise.all([
      this.assets.loadSurfaces(SURFACE_ASSETS),
      this.assets.loadTexture("water_normal", "water_normal"),
    ]);
    this.attachWater();
  }

  private attachWater(): void {
    const normal = this.assets.getTexture("water_normal");
    if (normal) {
      normal.repeat.set(16, 16);
      this.materials.water.normalMap = normal;
      this.materials.water.normalScale.set(1.0, 1.0);
      this.materials.water.needsUpdate = true;
    }
    this.waterAnimation = animateWater(this.materials.water);
  }

  get buildingFactoryRef() {
    return this.buildingView.factoryRef;
  }

  addBuilding(building: PlacedBuilding, world: World): void {
    this.buildingView.add(building, world);
  }

  buildWorld(world: World, state: GameState): void {
    this.terrainView.build(world);
    this.propView.build(world);
    this.nodeView.build(state, world);
    this.cameraRig.setBounds(world.grid.halfExtentX, world.grid.halfExtentZ);
  }

  refreshNodes(state: GameState, world: World): void {
    this.nodeView.refresh(state, world);
  }

  rebuildBuildings(state: GameState, world: World): void {
    this.buildingView.rebuild(state, world);
  }

  pickNode(
    clientX: number,
    clientY: number,
    width: number,
    height: number,
  ): ResourceNode | null {
    return this.nodeView.pick(this.cameraRig.camera, clientX, clientY, width, height);
  }

  updateCrops(state: GameState, world: World): void {
    this.cropView.update(state, world);
  }

  setQuality(preset: QualityPreset): void {
    applyQualityToMaterials(this.materials, preset);
    this.postFX.setQuality(preset);
  }

  resize(width: number, height: number): void {
    this.rendererHandle.resize(width, height);
    this.rendererHandle.setPixelRatio(window.devicePixelRatio);
    this.cameraRig.resize(width, height);
    this.postFX.setSize(width, height);
  }

  render(delta: number, time: GameTime): void {
    this.elapsed += delta;
    this.cameraRig.update(delta);

    if (this.waterAnimation) {
      this.waterAnimation.time.value += delta * 0.55;
    }

    const focus: Vector3 = this.cameraRig.groundPoint;
    this.sky.update(time, this.cameraRig.camera);
    this.lighting.update(time, focus);
    this.buildingView.update(this.elapsed, time.daylight);

    this.rendererHandle.renderer.toneMappingExposure =
      GameConfig.render.exposure + (1 - time.daylight) * 0.38;

    this.postFX.render(delta);
  }
}
