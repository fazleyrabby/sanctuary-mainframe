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

export const TILE_SIZE = 48; // 3/4 Top-Down orthogonal square tile size in pixels

const TERRAIN_BASE_COLORS: Record<TerrainType, number> = {
  [TerrainType.Sand]: 0xdfbe7e,     // Warm desert sand
  [TerrainType.Grass]: 0x629938,    // Oasis lush green
  [TerrainType.GrassDry]: 0x9c9444, // Savanna dry grass
  [TerrainType.Dirt]: 0x8a5e37,     // Compacted path dirt
  [TerrainType.Stone]: 0x9e8c74,    // Warm sandstone plateau
  [TerrainType.Water]: 0x2e7492,    // Deep oasis azure
};

export class PixiIsometricView {
  readonly app: Application;

  private worldContainer = new Container();
  private groundContainer = new Container();
  private shadowsContainer = new Container();
  private objectsContainer = new Container();
  private constructionContainer = new Container();
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
      backgroundColor: 0x14100c, // Warm dark ambient background
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
      antialias: false, // Sharp pixel art rendering
    });

    this.worldContainer.filters = [this.colorFilter];
    this.objectsContainer.sortableChildren = true;

    this.worldContainer.addChild(this.groundContainer);
    this.worldContainer.addChild(this.shadowsContainer);
    this.worldContainer.addChild(this.constructionContainer);
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
      "campfire",
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
    this.shadowsContainer.removeChildren();
    this.constructionContainer.removeChildren();
    this.objectsContainer.removeChildren();

    // Center camera on grid center
    const centerPx = (world.width * TILE_SIZE) / 2;
    const centerPy = (world.height * TILE_SIZE) / 2;
    this.cameraX = window.innerWidth / 2 - centerPx;
    this.cameraY = window.innerHeight / 2 - centerPy;
    this.updateCamera();

    // Render 3/4 top-down square terrain tiles with rich stylized textures
    for (let gy = 0; gy < world.height; gy++) {
      for (let gx = 0; gx < world.width; gx++) {
        const type = world.typeAt(gx, gy);
        const height = world.heightAt(gx, gy);
        const sx = gx * TILE_SIZE;
        const sy = gy * TILE_SIZE;

        const g = new Graphics();
        const baseColor = TERRAIN_BASE_COLORS[type];

        // Organic tile tone variation
        const jitter = ((gx * 19 + gy * 37) % 7) - 3;
        const color = baseColor + (jitter << 16) + (jitter << 8) + jitter;

        // Base square tile
        g.rect(sx, sy, TILE_SIZE, TILE_SIZE);
        g.fill({ color, alpha: type === TerrainType.Water ? 0.9 : 1.0 });

        // Decorative tile details inspired by top-down reference screenshots
        if (type === TerrainType.Sand) {
          // Delicate wavy wind ripple dunes
          const rippleY = sy + (TILE_SIZE / 3) * (((gx + gy) % 3) + 0.5);
          g.moveTo(sx + 3, rippleY);
          g.bezierCurveTo(
            sx + TILE_SIZE * 0.35, rippleY - 3,
            sx + TILE_SIZE * 0.65, rippleY + 3,
            sx + TILE_SIZE - 3, rippleY
          );
          g.stroke({ width: 1.5, color: 0xc8a462, alpha: 0.45 });
        } else if (type === TerrainType.Grass) {
          // Tiny green blade clusters
          const tuftX = sx + 12 + ((gx * 7) % 20);
          const tuftY = sy + 14 + ((gy * 11) % 18);
          g.rect(tuftX, tuftY, 3, 5);
          g.rect(tuftX + 4, tuftY - 2, 3, 7);
          g.fill({ color: 0x487624, alpha: 0.7 });
        } else if (type === TerrainType.Dirt) {
          // Small stone pebbles
          const px = sx + 8 + ((gx * 13) % 28);
          const py = sy + 10 + ((gy * 17) % 24);
          g.circle(px, py, 2);
          g.fill({ color: 0x6e4a28, alpha: 0.6 });
        } else if (type === TerrainType.Stone && height > 0) {
          // Vertical sandstone cliff face downward
          const cliffH = Math.min(height * 20 + 8, 36);
          g.rect(sx, sy + TILE_SIZE, TILE_SIZE, cliffH);
          g.fill({ color: 0x6e5c46 });
          // Horizontal rock strata lines
          g.moveTo(sx, sy + TILE_SIZE + cliffH * 0.45);
          g.lineTo(sx + TILE_SIZE, sy + TILE_SIZE + cliffH * 0.45);
          g.stroke({ width: 1.5, color: 0x483a2c, alpha: 0.55 });
        }

        // Subtle tile seam line
        g.rect(sx, sy, TILE_SIZE, TILE_SIZE);
        g.stroke({ width: 0.5, color: 0x000000, alpha: 0.08 });

        this.groundContainer.addChild(g);
      }
    }

    // Render resource nodes (trees, boulders, scrap)
    for (const node of state.nodes) {
      this.addResourceNodeSprite(node, world);
    }

    // Render buildings and construction plots
    for (const b of state.buildings) {
      this.addBuildingSprite(b, world);
    }
  }

  addBuildingSprite(b: PlacedBuilding, _world: World): void {
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

    const centerX = (b.gx + w / 2) * TILE_SIZE;
    const baseY = (b.gy + h) * TILE_SIZE;

    // 1. Directional soft drop shadow beneath building footprint
    const shadow = new Graphics();
    shadow.ellipse(centerX + 3, baseY - 6, (w * TILE_SIZE) * 0.50, (h * TILE_SIZE) * 0.28);
    shadow.fill({ color: 0x140e0a, alpha: 0.35 });
    this.shadowsContainer.addChild(shadow);

    if (b.id === "campfire") {
      const fireGlow = new Graphics();
      fireGlow.circle(centerX, baseY - 12, 36);
      fireGlow.fill({ color: 0xffaa33, alpha: 0.25 });
      this.shadowsContainer.addChild(fireGlow);
    }

    // 2. Diegetic Construction plot boundary (posts & progress bar)
    const plot = new Graphics();
    const plotX = b.gx * TILE_SIZE;
    const plotY = b.gy * TILE_SIZE;
    const plotW = w * TILE_SIZE;
    const plotH = h * TILE_SIZE;

    // Wooden corner boundary stakes
    const stakeRadius = 3.5;
    plot.circle(plotX + 3, plotY + 3, stakeRadius);
    plot.circle(plotX + plotW - 3, plotY + 3, stakeRadius);
    plot.circle(plotX + 3, plotY + plotH - 3, stakeRadius);
    plot.circle(plotX + plotW - 3, plotY + plotH - 3, stakeRadius);
    plot.fill({ color: 0x6e4a2a });
    plot.stroke({ width: 1, color: 0x3d2716 });

    this.constructionContainer.addChild(plot);

    // 3. Pre-rendered 3/4 Pixel Art Building Sprite
    const sprite = new Sprite(baked.texture);
    sprite.anchor.set(baked.anchorX, baked.anchorY);
    sprite.position.set(centerX, baseY);
    // Scale pixel sprite to fit building grid dimensions
    const targetDim = Math.max(w, h) * TILE_SIZE * 1.35;
    sprite.scale.set(targetDim / baked.width);
    sprite.zIndex = (b.gy + h) * 1000 + b.gx;

    this.objectsContainer.addChild(sprite);
  }

  addResourceNodeSprite(node: ResourceNode, _world: World): void {
    const propKey = node.kind === "wood" ? "pine_tree" : node.kind === "stone" ? "boulder" : "scrap_pile";
    const baked = this.bakedSprites.get(propKey);
    if (!baked) return;

    const posX = (node.gx + 0.5) * TILE_SIZE;
    const posY = (node.gy + 0.85) * TILE_SIZE;

    // Directional elliptical drop shadow under prop
    const shadow = new Graphics();
    const shadowRadius = node.kind === "wood" ? 14 : 12;
    shadow.ellipse(posX + 3, posY + 1, shadowRadius, shadowRadius * 0.55);
    shadow.fill({ color: 0x140e0a, alpha: 0.32 });
    this.shadowsContainer.addChild(shadow);

    // 3/4 Pixel Art Prop Sprite
    const sprite = new Sprite(baked.texture);
    sprite.anchor.set(baked.anchorX, baked.anchorY);
    sprite.position.set(posX, posY);
    sprite.scale.set(1.4);
    sprite.zIndex = (node.gy + 1) * 1000 + node.gx;

    this.objectsContainer.addChild(sprite);
  }

  gridToScreen(gx: number, gy: number): [number, number] {
    return [gx * TILE_SIZE, gy * TILE_SIZE];
  }

  screenToGrid(screenX: number, screenY: number): [number, number] {
    const localX = (screenX - this.cameraX) / this.zoom;
    const localY = (screenY - this.cameraY) / this.zoom;
    return [Math.floor(localX / TILE_SIZE), Math.floor(localY / TILE_SIZE)];
  }

  update(time: GameTime): void {
    // Dynamic day/night warm color grading
    const daylight = time.daylight;
    this.colorFilter.reset();

    if (daylight < 0.3) {
      // Night: moody dark blue-violet
      this.colorFilter.brightness(0.55 + daylight * 0.4, false);
      this.colorFilter.tint(0x5a78aa, false);
    } else if (daylight < 0.7) {
      // Dusk / Dawn: rich warm golden amber
      this.colorFilter.brightness(0.85, false);
      this.colorFilter.tint(0xffca8a, false);
    } else {
      // High noon sunlight
      this.colorFilter.brightness(1.04, false);
    }
  }

  private updateCamera(): void {
    this.worldContainer.position.set(Math.round(this.cameraX), Math.round(this.cameraY));
    this.worldContainer.scale.set(this.zoom);
  }

  private updateHoverCursor(): void {
    this.cursorGraphics.clear();
    const sx = this.hoveredGx * TILE_SIZE;
    const sy = this.hoveredGy * TILE_SIZE;

    // Crisp square tactical cursor matching 3/4 top-down grid
    this.cursorGraphics.rect(sx, sy, TILE_SIZE, TILE_SIZE);
    this.cursorGraphics.stroke({ width: 2, color: 0x7fd6c2, alpha: 0.9 });
    this.cursorGraphics.fill({ color: 0x7fd6c2, alpha: 0.15 });

    // Corner bracket accents
    const bLen = 6;
    this.cursorGraphics.poly([sx, sy + bLen, sx, sy, sx + bLen, sy]);
    this.cursorGraphics.poly([sx + TILE_SIZE - bLen, sy, sx + TILE_SIZE, sy, sx + TILE_SIZE, sy + bLen]);
    this.cursorGraphics.poly([sx, sy + TILE_SIZE - bLen, sx, sy + TILE_SIZE, sx + bLen, sy + TILE_SIZE]);
    this.cursorGraphics.poly([sx + TILE_SIZE - bLen, sy + TILE_SIZE, sx + TILE_SIZE, sy + TILE_SIZE, sx + TILE_SIZE, sy + TILE_SIZE - bLen]);
    this.cursorGraphics.stroke({ width: 2.5, color: 0xffffff, alpha: 0.8 });
  }

  private setupInteraction(canvas: HTMLCanvasElement): void {
    canvas.addEventListener("pointerdown", (e) => {
      if (e.button === 0 || e.button === 2) {
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.camStartX = this.cameraX;
        this.camStartY = this.cameraY;
      }
    });

    window.addEventListener("pointermove", (e) => {
      if (this.isDragging) {
        this.cameraX = this.camStartX + (e.clientX - this.dragStartX);
        this.cameraY = this.camStartY + (e.clientY - this.dragStartY);
        this.updateCamera();
      }

      const [gx, gy] = this.screenToGrid(e.clientX, e.clientY);
      if (gx !== this.hoveredGx || gy !== this.hoveredGy) {
        this.hoveredGx = gx;
        this.hoveredGy = gy;
        this.updateHoverCursor();
      }
    });

    window.addEventListener("pointerup", () => {
      this.isDragging = false;
    });

    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const newZoom = Math.max(0.6, Math.min(2.5, this.zoom * zoomFactor));

      const mouseX = e.clientX;
      const mouseY = e.clientY;
      this.cameraX = mouseX - (mouseX - this.cameraX) * (newZoom / this.zoom);
      this.cameraY = mouseY - (mouseY - this.cameraY) * (newZoom / this.zoom);
      this.zoom = newZoom;
      this.updateCamera();
    }, { passive: false });
  }

  destroy(): void {
    this.baker.dispose();
    this.app.destroy(true, { children: true });
  }
}
