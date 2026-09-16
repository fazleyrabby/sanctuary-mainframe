import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  PointLight,
  Vector3,
} from "three";
import type { BuildingId } from "../../data/buildings";
import { Rng } from "../../core/Rng";
import type { AssetManager } from "../AssetManager";
import type { MaterialSet } from "../Materials";

const MAX_FIRE_LIGHTS = 4;

const GLB_KEYS: Partial<Record<BuildingId, string>> = {
  shelter: "shelter",
  farm: "farm",
  storage: "storage",
  waterCollector: "water_collector",
  workshop: "workshop",
  generator: "generator",
  serverRoom: "server_room",
  aiCore: "ai_core",
};

export class BuildingFactory {
  private cache = new Map<string, BufferGeometry>();
  private fireLights = 0;
  private readonly clashScale = 1.32;

  constructor(
    private readonly materials: MaterialSet,
    private readonly assets?: AssetManager,
  ) {}

  create(id: BuildingId, seed = 1, withLights = true): Group {
    const key = GLB_KEYS[id];
    if (key && this.assets?.has(key)) {
      const clone = this.assets.clone(key);
      if (clone) {
        // CLASH: chibi scale + center lift so it stays on tile
        clone.scale.setScalar(this.clashScale);
        clone.position.y += 0.18;
        // Try to saturate vertex colors if present — clash pop
        clone.traverse((o) => {
          if ((o as Mesh).isMesh) {
            const m = (o as Mesh).material as unknown as { color?: { setHSL: (h:number,s:number,l:number)=>void; getHSL:(t:{h:number;s:number;l:number})=>void } };
            if (m?.color?.getHSL) {
              const hsl = { h: 0, s: 0, l: 0 };
              (m.color as unknown as { getHSL:(t: typeof hsl)=>void }).getHSL(hsl);
              (m.color as unknown as { setHSL:(h:number,s:number,l:number)=>void }).setHSL(hsl.h, Math.min(1, hsl.s * 1.25), Math.min(0.92, hsl.l * 1.06 + 0.04));
            }
          }
        });
        return clone;
      }
    }
    const g = this.procedural(id, seed, withLights);
    g.scale.setScalar(this.clashScale);
    return g;
  }

  private procedural(id: BuildingId, seed: number, withLights: boolean): Group {
    switch (id) {
      case "shelter":
        return this.shelter();
      case "farm":
        return this.farm(seed);
      case "storage":
        return this.storage();
      case "waterCollector":
        return this.waterCollector();
      case "workshop":
        return this.workshop();
      case "campfire":
        return this.campfire(seed, withLights);
      default:
        return new Group();
    }
  }

  resetLights(): void {
    this.fireLights = 0;
  }

  applyGhostMaterial(group: Group, material: Mesh["material"]): void {
    group.traverse((object) => {
      if ((object as Mesh).isMesh) {
        (object as Mesh).material = material;
        (object as Mesh).castShadow = false;
        (object as Mesh).receiveShadow = false;
      }
    });
  }

  dispose(): void {
    this.cache.forEach((geometry) => geometry.dispose());
    this.cache.clear();
  }

  private geo<T extends BufferGeometry>(key: string, make: () => T): T {
    const existing = this.cache.get(key);
    if (existing) return existing as T;
    const created = make();
    this.cache.set(key, created);
    return created;
  }

  private part(
    geometry: BufferGeometry,
    material: Mesh["material"],
    position: [number, number, number] = [0, 0, 0],
    rotation: [number, number, number] = [0, 0, 0],
  ): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private shelter(): Group {
    const g = new Group();

    g.add(this.part(this.geo("shelter.platform", () => new BoxGeometry(3.1, 0.18, 3.1)), this.materials.concrete, [0, 0.09, 0]));
    g.add(this.part(this.geo("shelter.walls", () => new BoxGeometry(2.6, 1.5, 2.6)), this.materials.wood, [0, 0.93, 0]));
    g.add(this.part(this.geo("shelter.roof", () => new BoxGeometry(3.1, 0.14, 1.75)), this.materials.woodDark, [0, 1.95, -0.78], [-0.62, 0, 0]));
    g.add(this.part(this.geo("shelter.roof", () => new BoxGeometry(3.1, 0.14, 1.75)), this.materials.woodDark, [0, 1.95, 0.78], [0.62, 0, 0]));
    g.add(this.part(this.geo("shelter.door", () => new BoxGeometry(0.72, 1.05, 0.1)), this.materials.woodDark, [0, 0.6, 1.34]));
    g.add(this.part(this.geo("shelter.window", () => new BoxGeometry(0.52, 0.42, 0.08)), this.materials.emissiveWarm, [0.95, 1.05, 1.34]));
    g.add(this.part(this.geo("shelter.chimney", () => new BoxGeometry(0.34, 1.0, 0.34)), this.materials.concrete, [-0.85, 2.15, -0.5]));

    return g;
  }

  private farm(seed: number): Group {
    const g = new Group();

    g.add(this.part(this.geo("farm.soil", () => new BoxGeometry(4.2, 0.16, 4.2)), this.materials.soil, [0, 0.08, 0]));

    const crops = new InstancedMesh(
      this.geo("farm.crop", () => new ConeGeometry(0.13, 0.55, 5)),
      this.materials.crop,
      16,
    );
    crops.castShadow = true;

    const rng = new Rng(seed + 313);
    const matrix = new Matrix4();
    let index = 0;
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const px = -1.5 + col * 1.0 + rng.range(-0.08, 0.08);
        const pz = -1.5 + row * 1.0 + rng.range(-0.08, 0.08);
        const scale = rng.range(0.8, 1.2);
        matrix.makeScale(scale, scale, scale);
        matrix.setPosition(px, 0.16 + 0.275 * scale, pz);
        crops.setMatrixAt(index, matrix);
        index += 1;
      }
    }
    crops.instanceMatrix.needsUpdate = true;
    g.add(crops);

    return g;
  }

  private storage(): Group {
    const g = new Group();

    g.add(this.part(this.geo("storage.base", () => new BoxGeometry(2.6, 0.14, 2.6)), this.materials.concrete, [0, 0.07, 0]));
    g.add(this.part(this.geo("storage.body", () => new BoxGeometry(2.3, 1.2, 2.3)), this.materials.wood, [0, 0.74, 0]));
    g.add(this.part(this.geo("storage.roof", () => new BoxGeometry(2.6, 0.12, 2.6)), this.materials.rust, [0, 1.42, 0], [0, 0, 0.06]));
    g.add(this.part(this.geo("storage.door", () => new BoxGeometry(0.9, 0.95, 0.08)), this.materials.woodDark, [0, 0.62, 1.17]));
    g.add(this.part(this.geo("storage.crate", () => new BoxGeometry(0.55, 0.5, 0.55)), this.materials.woodDark, [0.78, 0.25, -0.95], [0, 0.4, 0]));
    g.add(this.part(this.geo("storage.crate", () => new BoxGeometry(0.55, 0.5, 0.55)), this.materials.woodDark, [0.2, 0.25, -1.05], [0, 0.9, 0]));
    g.add(this.part(this.geo("storage.barrel", () => new CylinderGeometry(0.24, 0.24, 0.62, 8)), this.materials.rust, [-0.95, 0.31, 0.75]));

    return g;
  }

  private waterCollector(): Group {
    const g = new Group();

    g.add(this.part(this.geo("water.base", () => new BoxGeometry(1.8, 0.14, 1.8)), this.materials.concrete, [0, 0.07, 0]));
    g.add(this.part(this.geo("water.tank", () => new CylinderGeometry(0.62, 0.68, 1.25, 10)), this.materials.metal, [0, 0.78, 0]));
    g.add(this.part(this.geo("water.cap", () => new CylinderGeometry(0.5, 0.62, 0.22, 10)), this.materials.metalDark, [0, 1.5, 0]));
    g.add(this.part(this.geo("water.panel", () => new BoxGeometry(1.7, 0.08, 1.35)), this.materials.glass, [0, 1.55, -0.95], [0.5, 0, 0]));
    g.add(this.part(this.geo("water.pipe", () => new CylinderGeometry(0.07, 0.07, 1.0, 6)), this.materials.metalDark, [0.62, 0.5, 0], [0, 0, Math.PI / 2]));
    g.add(this.part(this.geo("water.leg", () => new BoxGeometry(0.1, 0.9, 0.1)), this.materials.metalDark, [-0.6, 0.5, -0.85], [0.45, 0, 0]));
    g.add(this.part(this.geo("water.leg", () => new BoxGeometry(0.1, 0.9, 0.1)), this.materials.metalDark, [0.6, 0.5, -0.85], [0.45, 0, 0]));

    return g;
  }

  private workshop(): Group {
    const g = new Group();

    g.add(this.part(this.geo("shop.base", () => new BoxGeometry(2.7, 0.14, 2.7)), this.materials.concrete, [0, 0.07, 0]));
    g.add(this.part(this.geo("shop.body", () => new BoxGeometry(2.4, 1.35, 2.4)), this.materials.metalDark, [0, 0.82, 0]));
    g.add(this.part(this.geo("shop.roof", () => new BoxGeometry(2.7, 0.12, 2.7)), this.materials.rust, [0, 1.55, 0]));
    g.add(this.part(this.geo("shop.stack", () => new CylinderGeometry(0.18, 0.22, 1.0, 8)), this.materials.metal, [0.85, 2.05, -0.85]));
    g.add(this.part(this.geo("shop.door", () => new BoxGeometry(1.0, 1.05, 0.08)), this.materials.woodDark, [0, 0.67, 1.22]));
    g.add(this.part(this.geo("shop.window", () => new BoxGeometry(0.6, 0.45, 0.08)), this.materials.emissiveTech, [-0.75, 1.0, 1.22]));
    g.add(this.part(this.geo("shop.pipe", () => new CylinderGeometry(0.06, 0.06, 1.1, 6)), this.materials.metal, [-1.25, 1.0, 0], [0, 0, Math.PI / 2]));

    return g;
  }

  private campfire(seed: number, withLights = true): Group {
    const g = new Group();

    const stones = new InstancedMesh(
      this.geo("fire.stone", () => new DodecahedronGeometry(0.16, 0)),
      this.materials.concrete,
      8,
    );
    stones.castShadow = true;

    const rng = new Rng(seed + 808);
    const matrix = new Matrix4();
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      matrix.makeTranslation(Math.cos(angle) * 0.55, 0.1, Math.sin(angle) * 0.55);
      matrix.scale(new Vector3(rng.range(0.8, 1.3), rng.range(0.8, 1.2), rng.range(0.8, 1.3)));
      stones.setMatrixAt(i, matrix);
    }
    stones.instanceMatrix.needsUpdate = true;
    g.add(stones);

    g.add(this.part(this.geo("fire.log", () => new CylinderGeometry(0.07, 0.07, 0.9, 5)), this.materials.woodDark, [0, 0.12, 0], [0, 0.4, Math.PI / 2]));
    g.add(this.part(this.geo("fire.log", () => new CylinderGeometry(0.07, 0.07, 0.9, 5)), this.materials.woodDark, [0, 0.12, 0], [0, -0.7, Math.PI / 2]));

    const flame = this.part(this.geo("fire.flame", () => new ConeGeometry(0.24, 0.7, 6)), this.materials.emissiveWarm, [0, 0.5, 0]);
    flame.name = "flame";
    g.add(flame);

    if (withLights && this.fireLights < MAX_FIRE_LIGHTS) {
      this.fireLights += 1;
      const light = new PointLight(0xff9a4a, 2.4, 12, 2);
      light.position.set(0, 0.7, 0);
      light.name = "fireLight";
      g.add(light);
    }

    return g;
  }
}
