import {
  AmbientLight,
  Box3,
  DirectionalLight,
  HemisphereLight,
  OrthographicCamera,
  PCFSoftShadowMap,
  PlaneGeometry,
  Mesh,
  Scene,
  ShadowMaterial,
  Vector3,
  WebGLRenderer,
} from "three";
import { Texture } from "pixi.js";
import type { AssetManager } from "../AssetManager";

export interface BakedSprite {
  texture: Texture;
  anchorX: number;
  anchorY: number;
  width: number;
  height: number;
}

export class SpriteBaker {
  private offCanvas: HTMLCanvasElement;
  private renderer: WebGLRenderer;
  private scene: Scene;
  private camera: OrthographicCamera;
  private sun: DirectionalLight;

  constructor() {
    this.offCanvas = document.createElement("canvas");
    this.offCanvas.width = 384;
    this.offCanvas.height = 384;

    this.renderer = new WebGLRenderer({
      canvas: this.offCanvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;

    this.scene = new Scene();

    // Isometric camera
    this.camera = new OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
    const elev = Math.atan(1 / Math.SQRT2); // 35.264 deg
    const az = Math.PI / 4; // 45 deg
    const dist = 10;
    this.camera.position.set(
      Math.sin(az) * Math.cos(elev) * dist,
      Math.sin(elev) * dist,
      Math.cos(az) * Math.cos(elev) * dist,
    );
    this.camera.lookAt(0, 0, 0);

    // Warm directional AoE sunlight
    this.sun = new DirectionalLight(0xfff6ec, 2.4);
    this.sun.position.set(-6, 12, 6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // Soft sky and ground fill
    const hemi = new HemisphereLight(0x9bbcd8, 0x3d3224, 0.6);
    this.scene.add(hemi);
    const amb = new AmbientLight(0xffffff, 0.15);
    this.scene.add(amb);
  }

  bakeModel(assets: AssetManager, key: string, isBuilding: boolean): BakedSprite | null {
    const clone = assets.clone(key);
    if (!clone) return null;

    clone.position.set(0, 0, 0);

    // Enable shadows on all meshes
    clone.traverse((child) => {
      const mesh = child as Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    // Shadow receiver ground plane (receives shadow only, 100% transparent elsewhere)
    const shadowPlane = new Mesh(
      new PlaneGeometry(16, 16),
      new ShadowMaterial({ opacity: 0.38 }),
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.001;
    shadowPlane.receiveShadow = true;

    this.scene.add(shadowPlane);
    this.scene.add(clone);

    // Compute bounding box to frame object
    const bbox = new Box3().setFromObject(clone);
    const size = new Vector3();
    bbox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, isBuilding ? 3.5 : 2.0);

    const half = (maxDim * 0.95) / 2;
    this.camera.left = -half;
    this.camera.right = half;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();

    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    // Copy pixels to an independent canvas so PixiJS has a permanent, synchronous source
    const spriteCanvas = document.createElement("canvas");
    spriteCanvas.width = this.offCanvas.width;
    spriteCanvas.height = this.offCanvas.height;
    const ctx = spriteCanvas.getContext("2d");
    if (ctx) ctx.drawImage(this.offCanvas, 0, 0);

    const texture = Texture.from(spriteCanvas);

    // Clean up scene
    this.scene.remove(clone);
    this.scene.remove(shadowPlane);
    shadowPlane.geometry.dispose();

    return {
      texture,
      anchorX: 0.5,
      anchorY: 0.72,
      width: spriteCanvas.width,
      height: spriteCanvas.height,
    };
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
