import {
  Group,
  Mesh,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export interface AssetGroups {
  buildings: string[];
  props: string[];
}

const BASE = `${import.meta.env.BASE_URL}assets`;

export class AssetManager {
  private loader = new GLTFLoader();
  private scenes = new Map<string, Group>();

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
  }

  has(key: string): boolean {
    return this.scenes.has(key);
  }

  clone(key: string): Group | null {
    const scene = this.scenes.get(key);
    return scene ? (scene.clone(true) as Group) : null;
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
