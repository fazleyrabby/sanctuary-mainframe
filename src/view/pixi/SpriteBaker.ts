import {
  AmbientLight,
  Box3,
  DirectionalLight,
  HemisphereLight,
  OrthographicCamera,
  PCFShadowMap,
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

/**
 * Applies cel-shading color quantization and a 1px dark silhouette outline
 * to convert 3D rendered models into rich, authentic 3/4 top-down pixel art.
 */
function applyPixelArtProcessing(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const isOpaque = new Uint8Array(width * height);

  // 1. Mark opaque pixels & quantize colors into soft cel-shaded tiers
  // (kept subtle so hand-authored GLB detail survives the bake)
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const a = data[idx + 3];
    if (a > 35) {
      isOpaque[i] = 1;
      // Gentle quantization (steps of 16) — rich gradients, not flat posterize
      const step = 16;
      data[idx] = Math.min(255, Math.round(data[idx] / step) * step);
      data[idx + 1] = Math.min(255, Math.round(data[idx + 1] / step) * step);
      data[idx + 2] = Math.min(255, Math.round(data[idx + 2] / step) * step);
      // Subtle warmth for colony aesthetic
      data[idx] = Math.min(255, Math.round(data[idx] * 1.03));
    }
  }

  // 2. Detect 1px silhouette border around opaque geometry
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (data[idx + 3] <= 35) {
        const hasNeighbor =
          (x > 0 && isOpaque[y * width + (x - 1)]) ||
          (x < width - 1 && isOpaque[y * width + (x + 1)]) ||
          (y > 0 && isOpaque[(y - 1) * width + x]) ||
          (y < height - 1 && isOpaque[(y + 1) * width + x]);

        if (hasNeighbor) {
          data[idx] = 26;
          data[idx + 1] = 20;
          data[idx + 2] = 16;
          data[idx + 3] = 170; // softer 1px silhouette outline
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

export class SpriteBaker {
  private offCanvas: HTMLCanvasElement;
  private renderer: WebGLRenderer;
  private scene: Scene;
  private camera: OrthographicCamera;
  private sun: DirectionalLight;

  constructor() {
    this.offCanvas = document.createElement("canvas");
    this.offCanvas.width = 192;
    this.offCanvas.height = 192;

    this.renderer = new WebGLRenderer({
      canvas: this.offCanvas,
      alpha: true,
      antialias: false, // Crisp pixel edges for pixel art pipeline
      preserveDrawingBuffer: true,
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;

    this.scene = new Scene();

    // 3/4 Top-Down Oblique Camera (Pitch: ~56 deg, Azimuth: 0 deg straight front)
    this.camera = new OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
    const pitch = 56 * (Math.PI / 180);
    const dist = 12;
    this.camera.position.set(0, Math.sin(pitch) * dist, Math.cos(pitch) * dist);
    this.camera.lookAt(0, 0, 0);

    // Warm high-contrast directional key sunlight (upper-left noon sun)
    this.sun = new DirectionalLight(0xfff6ec, 2.6);
    this.sun.position.set(-8, 16, 8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(512, 512);
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // Warm atmospheric bounce fill
    const hemi = new HemisphereLight(0xfff2dc, 0x54402a, 0.7);
    this.scene.add(hemi);
    const amb = new AmbientLight(0xffffff, 0.2);
    this.scene.add(amb);
  }

  bakeModel(assets: AssetManager, key: string, isBuilding: boolean): BakedSprite | null {
    const clone = assets.clone(key);
    if (!clone) return null;

    clone.position.set(0, 0, 0);

    // Enable cast shadows
    clone.traverse((child) => {
      const mesh = child as Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    // Shadow receiver ground plane (receives cast shadow with zero background footprint)
    const shadowPlane = new Mesh(
      new PlaneGeometry(16, 16),
      new ShadowMaterial({ opacity: 0.35 }),
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.001;
    shadowPlane.receiveShadow = true;

    this.scene.add(shadowPlane);
    this.scene.add(clone);

    // High-res bake: buildings 192px, props 128px — stays crisp at 2-3 tile footprints
    const res = isBuilding ? 192 : 128;
    this.offCanvas.width = res;
    this.offCanvas.height = res;
    this.renderer.setSize(res, res, false);

    // Compute bounding box to frame object
    const bbox = new Box3().setFromObject(clone);
    const size = new Vector3();
    bbox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, isBuilding ? 3.4 : 1.9);

    const half = (maxDim * 0.95) / 2;
    this.camera.left = -half;
    this.camera.right = half;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();

    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    // Copy pixels to independent sprite canvas
    const spriteCanvas = document.createElement("canvas");
    spriteCanvas.width = res;
    spriteCanvas.height = res;
    const ctx = spriteCanvas.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(this.offCanvas, 0, 0);
      // Run pixel-art cel-shading + 1px silhouette outline pass
      applyPixelArtProcessing(ctx, res, res);
    }

    const texture = Texture.from(spriteCanvas);
    // Force nearest-neighbor filtering so scaling is crisp, chunky pixel art
    texture.source.scaleMode = "nearest";

    // Clean up scene
    this.scene.remove(clone);
    this.scene.remove(shadowPlane);
    shadowPlane.geometry.dispose();

    return {
      texture,
      anchorX: 0.5,
      anchorY: 0.88,
      width: res,
      height: res,
    };
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
