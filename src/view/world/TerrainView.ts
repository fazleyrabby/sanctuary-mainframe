import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
} from "three";
import { Rng } from "../../core/Rng";
import { TerrainType, type World } from "../../world/World";
import type { AssetManager } from "../AssetManager";
import type { MaterialSet } from "../Materials";

const TILE_BOX_HEIGHT = 0.28;


// Natural fallback colors for each terrain type
const TERRAIN_COLORS: Record<TerrainType, number> = {
  [TerrainType.Grass]:    0x4c7d32,   // natural forest green
  [TerrainType.GrassDry]: 0x787a38,   // savannah/dry field
  [TerrainType.Dirt]:     0x5e452b,   // rich dark loam
  [TerrainType.Stone]:    0x7a7972,   // weathered granite
  [TerrainType.Sand]:     0xab956d,   // natural beach sand
  [TerrainType.Water]:    0x1b4b5c,   // deep coastal azure
};

const TYPE_TINTS: Record<TerrainType, { r: number; g: number; b: number }> = {
  // Slight per-tile variation (hue jitter) so tiles aren't completely uniform
  [TerrainType.Grass]:    { r: 1.00, g: 1.04, b: 0.98 },
  [TerrainType.GrassDry]: { r: 1.01, g: 1.02, b: 0.95 },
  [TerrainType.Dirt]:     { r: 0.98, g: 0.99, b: 0.96 },
  [TerrainType.Stone]:    { r: 1.00, g: 1.00, b: 1.02 },
  [TerrainType.Sand]:     { r: 1.02, g: 1.00, b: 0.96 },
  [TerrainType.Water]:    { r: 0.88, g: 1.05, b: 1.12 },
};

const LAND_TYPES = [
  TerrainType.Grass,
  TerrainType.GrassDry,
  TerrainType.Dirt,
  TerrainType.Stone,
  TerrainType.Sand,
];

export class TerrainView {
  readonly group = new Group();
  private landMeshes: InstancedMesh[] = [];
  private waterMesh: Mesh | null = null;
  private seabedMesh: Mesh | null = null;
  private ownedGeometries: BoxGeometry[] = [];

  constructor(
    private readonly scene: Scene,
    private readonly materials: MaterialSet,
    private readonly assets: AssetManager,
  ) {}

  build(world: World): void {
    const rng = new Rng(world.seed + 991);

    const buckets = new Map<TerrainType, Array<{ gx: number; gy: number }>>();
    for (const type of LAND_TYPES) buckets.set(type, []);

    for (let gy = 0; gy < world.height; gy += 1) {
      for (let gx = 0; gx < world.width; gx += 1) {
        const type = world.typeAt(gx, gy);
        buckets.get(type)?.push({ gx, gy });
      }
    }

    // AoE:DE GROUNDED BEDROCK / SEABED BASE
    const pad = 24;
    const totalW = (world.width + pad * 2) * world.tileSize;
    const totalH = (world.height + pad * 2) * world.tileSize;

    // Natural deep earth / bedrock base beneath tiles
    const dirtSurface = this.assets.getSurface("terrain_dirt");
    const canvasMat = new MeshStandardMaterial({
      color: 0x443525,
      roughness: 0.95,
      metalness: 0.0,
    });
    if (dirtSurface) {
      canvasMat.map = dirtSurface.albedo;
      canvasMat.normalMap = dirtSurface.normal;
      canvasMat.roughnessMap = dirtSurface.roughness;
    }

    const canvasBase = new Mesh(
      new PlaneGeometry(totalW, totalH),
      canvasMat,
    );
    canvasBase.rotation.x = -Math.PI / 2;
    canvasBase.position.y = -0.22;   // below land tiles (~0.0) and water planes (0.01)
    canvasBase.receiveShadow = true;
    this.seabedMesh = canvasBase;
    this.group.add(canvasBase);

    const cliffMaterial = this.makeCliffMaterial();

    for (const type of LAND_TYPES) {
      const tiles = buckets.get(type) ?? [];
      if (tiles.length === 0) continue;
      this.buildType(type, tiles, world, cliffMaterial, rng);
    }

    // Water tiles — flat planes at a fixed height above the canvas base.
    // World assigns height=-0.22 to water tiles which puts BoxGeometry BELOW
    // the canvas. Use a flat PlaneGeometry at y=0.0 (just above canvas) instead.
    const waterTiles: Array<{ gx: number; gy: number }> = [];
    for (let gy = 0; gy < world.height; gy += 1) {
      for (let gx = 0; gx < world.width; gx += 1) {
        if (world.typeAt(gx, gy) === TerrainType.Water) {
          waterTiles.push({ gx, gy });
        }
      }
    }

    if (waterTiles.length > 0) {
      const ts = world.tileSize;
      // PlaneGeometry lies flat (xz plane after rotation). One instanced plane per tile.
      const waterGeo = new PlaneGeometry(ts, ts);
      this.ownedGeometries.push(waterGeo as unknown as BoxGeometry);
      const waterMesh = new InstancedMesh(waterGeo, this.materials.water, waterTiles.length);
      waterMesh.receiveShadow = false;
      waterMesh.castShadow = false;
      const wMatrix = new Matrix4();
      // Rotate once on the geometry so all instances face up
      waterGeo.rotateX(-Math.PI / 2);
      waterTiles.forEach((tile, i) => {
        wMatrix.makeTranslation(
          world.grid.worldX(tile.gx),
          0.01,   // just above the canvas base at -0.18, well above land tiles at ~0.0
          world.grid.worldZ(tile.gy),
        );
        waterMesh.setMatrixAt(i, wMatrix);
      });
      waterMesh.instanceMatrix.needsUpdate = true;
      waterMesh.receiveShadow = true;
      this.waterMesh = waterMesh as unknown as Mesh;
      this.group.add(waterMesh);
    }

    this.scene.add(this.group);
  }

  private makeTopMaterial(type: TerrainType): MeshStandardMaterial {
    const keyMap: Partial<Record<TerrainType, string>> = {
      [TerrainType.Grass]: "terrain_grass",
      [TerrainType.GrassDry]: "terrain_grass_dry",
      [TerrainType.Dirt]: "terrain_dirt",
      [TerrainType.Stone]: "terrain_stone",
      [TerrainType.Sand]: "terrain_sand",
    };
    const key = keyMap[type];
    const surface = key ? this.assets.getSurface(key) : null;
    const material = new MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0.0,
      flatShading: false,
    });
    if (surface) {
      material.map = surface.albedo;
      material.normalMap = surface.normal;
      material.roughnessMap = surface.roughness;
      material.normalScale.set(0.85, 0.85);
    } else {
      material.color.setHex(TERRAIN_COLORS[type] ?? 0x4c7d32);
    }
    return material;
  }

  private makeCliffMaterial(): MeshStandardMaterial {
    const surface = this.assets.getSurface("terrain_cliff");
    const material = new MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1,
      metalness: 0,
      flatShading: false,
    });
    if (surface) {
      material.map = surface.albedo;
      material.normalMap = surface.normal;
      material.roughnessMap = surface.roughness;
      material.normalScale.set(1, 1);
    }
    return material;
  }

  private buildType(
    type: TerrainType,
    tiles: Array<{ gx: number; gy: number }>,
    world: World,
    cliffMaterial: MeshStandardMaterial,
    rng: Rng,
  ): void {
    // AoE:DE: High-detail PBR surface textures
    const topMaterial = this.makeTopMaterial(type);

    const geometry = new BoxGeometry(world.tileSize, TILE_BOX_HEIGHT, world.tileSize);
    this.ownedGeometries.push(geometry);

    const materials = [
      cliffMaterial,
      cliffMaterial,
      topMaterial,
      cliffMaterial,
      cliffMaterial,
      cliffMaterial,
    ];

    const mesh = new InstancedMesh(geometry, materials, tiles.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const matrix = new Matrix4();
    const color = new Color();

    tiles.forEach((tile, index) => {
      const height = world.heightAt(tile.gx, tile.gy);
      matrix.makeTranslation(
        world.grid.worldX(tile.gx),
        height - TILE_BOX_HEIGHT / 2,
        world.grid.worldZ(tile.gy),
      );
      mesh.setMatrixAt(index, matrix);

      const tint = TYPE_TINTS[type];
      color.setRGB(tint.r, tint.g, tint.b);
      color.offsetHSL(rng.range(-0.008, 0.008), rng.range(-0.02, 0.02), rng.range(-0.05, 0.05));
      mesh.setColorAt(index, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    this.landMeshes.push(mesh);
    this.group.add(mesh);
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.ownedGeometries.forEach((geometry) => geometry.dispose());
    this.ownedGeometries = [];
    this.waterMesh?.geometry.dispose();
    this.seabedMesh?.geometry.dispose();
  }
}
