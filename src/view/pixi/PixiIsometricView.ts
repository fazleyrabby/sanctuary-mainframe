import {
  Application,
  ColorMatrixFilter,
  Container,
  Graphics,
  Sprite,
} from "pixi.js";
import { BUILDINGS } from "../../data/buildings";
import type { GameTime } from "../../core/Time";
import type { GameState, PlacedBuilding, ResourceNode } from "../../state/GameState";
import { TerrainType, type World } from "../../world/World";
import type { AssetManager } from "../AssetManager";
import { SpriteBaker, type BakedSprite } from "./SpriteBaker";

const TILE_WIDTH = 96;
const TILE_HEIGHT = 48; // 2:1 classic dimetric RTS ratio
const ELEVATION_PIXELS = 32;

const TERRAIN_HEX_COLORS: Record<TerrainType, number> = {
  [TerrainType.Grass]: 0x487532,
  [TerrainType.GrassDry]: 0x727335,
  [TerrainType.Dirt]: 0x5a422a,
  [TerrainType.Stone]: 0x6e6e69,
  [TerrainType.Sand]: 0x9e8a60,
  [TerrainType.Water]: 0x184454,
};

export class PixiIsometricView {
  readonly app: Application;

  private worldContainer = new Container();
  private groundContainer = new Container();
  private objectsContainer = new Container();
  private cursorGraphics = new Graphics();

  private colorFilter = new ColorMatrixFilter();
  private baker = new SpriteBaker();
  private bakedSprites = new Map<string, BakedSprite>();

  private cameraX = 0;
  private cameraY = 0;
  private zoom = 1.0;

  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private camStartX = 0;
  private camStartY = 0;

  private hoveredGx = 0;
  private hoveredGy = 0;

  constructor() {
    this.app = new Application();
  }

  async init(canvas: HTMLCanvasElement): Promise<void> {
    await this.app.init({
      canvas,
      resizeTo: window,
      backgroundColor: 0x101622,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
      antialias: true,
    });

    this.worldContainer.filters = [this.colorFilter];
    this.objectsContainer.sortableChildren = true;

    this.worldContainer.addChild(this.groundContainer);
    this.worldContainer.addChild(this.objectsContainer);
    this.worldContainer.addChild(this.cursorGraphics);
    this.app.stage.addChild(this.worldContainer);

    this.setupInteraction(canvas);
  }

  bakeAssets(assets: AssetManager): void {
    const buildings = [
      "shelter",
      "farm",
      "storage",
      "water_collector",
      "workshop",
      "generator",
      "server_room",
      "ai_core",
    ];
    const props = [
      "dead_tree",
      "pine_tree",
      "rock",
      "boulder",
      "bush",
      "crate",
      "barrel",
      "scrap_pile",
    ];

    for (const b of buildings) {
      const baked = this.baker.bakeModel(assets, b, true);
      if (baked) this.bakedSprites.set(b, baked);
    }
    for (const p of props) {
      const baked = this.baker.bakeModel(assets, p, false);
      if (baked) this.bakedSprites.set(p, baked);
    }
  }

  buildWorld(world: World, state: GameState): void {
    this.groundContainer.removeChildren();
    this.objectsContainer.removeChildren();

    // Center camera on center of grid
    const centerGx = world.width / 2;
    const centerGy = world.height / 2;
    const [cx, cy] = this.gridToScreen(centerGx, centerGy);
    this.cameraX = window.innerWidth / 2 - cx;
    this.cameraY = window.innerHeight / 2 - cy;
    this.updateCamera();

    // Render terrain tiles as 2.5D isometric diamonds
    const halfW = TILE_WIDTH / 2;
    const halfH = TILE_HEIGHT / 2;

    for (let gy = 0; gy < world.height; gy++) {
      for (let gx = 0; gx < world.width; gx++) {
        const type = world.typeAt(gx, gy);
        const height = world.heightAt(gx, gy);
        const [sx, sy] = this.gridToScreen(gx, gy, height);

        const g = new Graphics();
        const baseColor = TERRAIN_HEX_COLORS[type];

        // Subtle tile variation
        const jitter = ((gx * 17 + gy * 31) % 7) - 3;
        const color = baseColor + (jitter << 8) + jitter;

        // Top diamond
        g.poly([
          sx, sy - halfH,
          sx + halfW, sy,
          sx, sy + halfH,
          sx - halfW, sy,
        ]);
        g.fill({ color, alpha: type === TerrainType.Water ? 0.85 : 1.0 });
        g.stroke({ width: 0.5, color: 0x000000, alpha: 0.15 });

        // Cliff side edges for elevated tiles
        const cliffHeight = height * ELEVATION_PIXELS + 6;
        if (cliffHeight > 0) {
          // Right cliff
          g.poly([
            sx + halfW, sy,
            sx, sy + halfH,
            sx, sy + halfH + cliffHeight,
            sx + halfW, sy + cliffHeight,
          ]);
          g.fill({ color: 0x3d352c });

          // Left cliff
          g.poly([
            sx - halfW, sy,
            sx, sy + halfH,
            sx, sy + halfH + cliffHeight,
            sx - halfW, sy + cliffHeight,
          ]);
          g.fill({ color: 0x2e2720 });
        }

        this.groundContainer.addChild(g);
      }
    }

    // Render props as pre-rendered 2.5D sprites
    for (const node of state.nodes) {
      this.addResourceNodeSprite(node, world);
    }

    // Render buildings
    for (const b of state.buildings) {
      this.addBuildingSprite(b, world);
    }
  }

  addBuildingSprite(b: PlacedBuilding, world: World): void {
    const key = b.id === "waterCollector"
      ? "water_collector"
      : b.id === "serverRoom"
      ? "server_room"
      : b.id === "aiCore"
      ? "ai_core"
      : b.id;

    const baked = this.bakedSprites.get(key);
    if (!baked) return;

    const def = BUILDINGS[b.id];
    const w = def?.size.w ?? 2;
    const h = def?.size.h ?? 2;

    const [sx, sy] = this.gridToScreen(
      b.gx + w / 2,
      b.gy + h / 2,
      world.heightAt(b.gx, b.gy),
    );

    const sprite = new Sprite(baked.texture);
    sprite.anchor.set(baked.anchorX, baked.anchorY);
    sprite.position.set(sx, sy);
    sprite.scale.set((TILE_WIDTH / 110) * (w > 2 ? 1.3 : 1.0));
    sprite.zIndex = (b.gx + b.gy) * 1000 + 500;

    this.objectsContainer.addChild(sprite);
  }

  addResourceNodeSprite(node: ResourceNode, world: World): void {
    const propKey = node.kind === "wood" ? "pine_tree" : node.kind === "stone" ? "boulder" : "scrap_pile";
    const baked = this.bakedSprites.get(propKey);
    if (!baked) return;

    const [sx, sy] = this.gridToScreen(
      node.gx,
      node.gy,
      world.heightAt(node.gx, node.gy),
    );

    const sprite = new Sprite(baked.texture);
    sprite.anchor.set(baked.anchorX, baked.anchorY);
    sprite.position.set(sx, sy);
    sprite.scale.set(TILE_WIDTH / 160);
    sprite.zIndex = (node.gx + node.gy) * 1000 + 200;

    this.objectsContainer.addChild(sprite);
  }

  gridToScreen(gx: number, gy: number, height = 0): [number, number] {
    const halfW = TILE_WIDTH / 2;
    const halfH = TILE_HEIGHT / 2;
    const sx = (gx - gy) * halfW;
    const sy = (gx + gy) * halfH - height * ELEVATION_PIXELS;
    return [sx, sy];
  }

  screenToGrid(screenX: number, screenY: number): [number, number] {
    const localX = (screenX - this.cameraX) / this.zoom;
    const localY = (screenY - this.cameraY) / this.zoom;

    const halfW = TILE_WIDTH / 2;
    const halfH = TILE_HEIGHT / 2;

    const gx = (localX / halfW + localY / halfH) / 2;
    const gy = (localY / halfH - localX / halfW) / 2;
    return [Math.floor(gx), Math.floor(gy)];
  }

  update(time: GameTime): void {
    // Dynamic day/night cycle color grading in 2D
    const daylight = time.daylight;
    this.colorFilter.reset();

    if (daylight < 0.5) {
      // Night tint (deep atmospheric blue)
      const nightFactor = (0.5 - daylight) * 2;
      this.colorFilter.brightness(1 - nightFactor * 0.45, false);
      this.colorFilter.tint(0x8fa8e0, false);
    } else {
      // Warm daylight
      this.colorFilter.brightness(1.05, false);
    }

    this.drawHoverCursor();
  }

  private drawHoverCursor(): void {
    this.cursorGraphics.clear();
    const halfW = TILE_WIDTH / 2;
    const halfH = TILE_HEIGHT / 2;
    const [sx, sy] = this.gridToScreen(this.hoveredGx, this.hoveredGy);

    this.cursorGraphics.poly([
      sx, sy - halfH,
      sx + halfW, sy,
      sx, sy + halfH,
      sx - halfW, sy,
    ]);
    this.cursorGraphics.stroke({ width: 2, color: 0x7fd6c2, alpha: 0.8 });
    this.cursorGraphics.fill({ color: 0x7fd6c2, alpha: 0.15 });
  }

  private setupInteraction(canvas: HTMLCanvasElement): void {
    canvas.addEventListener("mousedown", (e) => {
      if (e.button === 0 || e.button === 1 || e.button === 2) {
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.camStartX = this.cameraX;
        this.camStartY = this.cameraY;
      }
    });

    window.addEventListener("mousemove", (e) => {
      if (this.isDragging) {
        this.cameraX = this.camStartX + (e.clientX - this.dragStartX);
        this.cameraY = this.camStartY + (e.clientY - this.dragStartY);
        this.updateCamera();
      }

      const rect = canvas.getBoundingClientRect();
      const [gx, gy] = this.screenToGrid(e.clientX - rect.left, e.clientY - rect.top);
      this.hoveredGx = gx;
      this.hoveredGy = gy;
    });

    window.addEventListener("mouseup", () => {
      this.isDragging = false;
    });

    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.88;
      const newZoom = Math.min(Math.max(this.zoom * zoomFactor, 0.4), 2.5);

      // Zoom toward cursor
      const mouseX = e.clientX;
      const mouseY = e.clientY;
      this.cameraX = mouseX - (mouseX - this.cameraX) * (newZoom / this.zoom);
      this.cameraY = mouseY - (mouseY - this.cameraY) * (newZoom / this.zoom);
      this.zoom = newZoom;
      this.updateCamera();
    }, { passive: false });
  }

  private updateCamera(): void {
    this.worldContainer.position.set(this.cameraX, this.cameraY);
    this.worldContainer.scale.set(this.zoom);
  }

  destroy(): void {
    this.baker.dispose();
    this.app.destroy(true, { children: true });
  }
}
