import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export interface AssetGroups {
  buildings: string[];
  props: string[];
}

export interface SurfaceTextures {
  albedo: Texture;
  normal: Texture;
  roughness: Texture;
}

const BASE = `${import.meta.env.BASE_URL}assets`;

export class AssetManager {
  private loader = new GLTFLoader();
  private textureLoader = new TextureLoader();
  private scenes = new Map<string, Group>();
  private propGeometry = new Map<string, BufferGeometry>();
  private surfaces = new Map<string, SurfaceTextures>();
  private looseTextures = new Map<string, Texture>();

  async load(groups: AssetGroups): Promise<void> {
    const buildings = groups.buildings.map((key) =>
      this.loadScene(key, `${BASE}/buildings/${key}.glb`),
    );
    const props = groups.props.map((key) =>
      this.loadScene(key, `${BASE}/props/${key}.glb`),
    );

    const results = await Promise.allSettled([...buildings, ...props]);
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const all = [...groups.buildings, ...groups.props];
        console.warn(`Asset failed: ${all[index]}`, result.reason);
      }
    });

    for (const key of groups.props) {
      const scene = this.scenes.get(key);
      if (scene) this.propGeometry.set(key, flattenToVertexColors(scene));
    }
  }

  async loadSurfaces(names: string[]): Promise<void> {
    const tasks = names.map(async (name) => {
      const [albedo, normal, roughness] = await Promise.all([
        this.textureLoader.loadAsync(`${BASE}/textures/${name}_albedo.png`),
        this.textureLoader.loadAsync(`${BASE}/textures/${name}_normal.png`),
        this.textureLoader.loadAsync(`${BASE}/textures/${name}_roughness.png`),
      ]);

      for (const texture of [albedo, normal, roughness]) {
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.anisotropy = 4;
      }
      albedo.colorSpace = SRGBColorSpace;

      this.surfaces.set(name, { albedo, normal, roughness });
    });

    const results = await Promise.allSettled(tasks);
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.warn(`Surface failed: ${names[index]}`, result.reason);
      }
    });
  }

  async loadTexture(key: string, file: string): Promise<void> {
    try {
      const texture = await this.textureLoader.loadAsync(`${BASE}/textures/${file}.png`);
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.anisotropy = 4;
      this.looseTextures.set(key, texture);
    } catch (error) {
      console.warn(`Texture failed: ${file}`, error);
    }
  }

  getSurface(name: string): SurfaceTextures | null {
    return this.surfaces.get(name) ?? null;
  }

  getTexture(key: string): Texture | null {
    return this.looseTextures.get(key) ?? null;
  }

  has(key: string): boolean {
    return this.scenes.has(key);
  }

  clone(key: string): Group | null {
    const scene = this.scenes.get(key);
    return scene ? (scene.clone(true) as Group) : null;
  }

  getPropGeometry(key: string): BufferGeometry | null {
    return this.propGeometry.get(key) ?? null;
  }

  private async loadScene(key: string, url: string): Promise<void> {
    const gltf = await this.loader.loadAsync(url);
    gltf.scene.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    this.scenes.set(key, gltf.scene);
  }
}

function flattenToVertexColors(root: Object3D): BufferGeometry {
  root.updateWorldMatrix(true, true);
  const geometries: BufferGeometry[] = [];

  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;

    const source = mesh.geometry;
    const geometry = source.index ? source.toNonIndexed() : source.clone();
    geometry.applyMatrix4(mesh.matrixWorld);

    for (const name of Object.keys(geometry.attributes)) {
      if (name !== "position" && name !== "normal") geometry.deleteAttribute(name);
    }
    if (!geometry.attributes.normal) geometry.computeVertexNormals();

    const count = geometry.attributes.position.count;
    const colors = new Float32Array(count * 3);
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const base =
      material && (material as MeshStandardMaterial).color
        ? (material as MeshStandardMaterial).color
        : new Color(0xffffff);

    for (let i = 0; i < count; i += 1) {
      colors[i * 3] = base.r;
      colors[i * 3 + 1] = base.g;
      colors[i * 3 + 2] = base.b;
    }
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    geometries.push(geometry);
  });

  if (geometries.length === 0) return new BufferGeometry();
  return mergeGeometries(geometries, false) ?? new BufferGeometry();
}
