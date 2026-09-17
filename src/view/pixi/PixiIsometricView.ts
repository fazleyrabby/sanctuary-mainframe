import {
  Application,
  ColorMatrixFilter,
  Container,
  Graphics,
  Sprite,
} from "pixi.js";
import { BUILDINGS } from "../../data/buildings";
import { CROPS, growthStage } from "../../data/crops";
import type { GameTime } from "../../core/Time";
import type { GameState, PlacedBuilding, ResourceNode } from "../../state/GameState";
import { TerrainType, type World } from "../../world/World";
import type { AssetManager } from "../AssetManager";
import { SpriteBaker, type BakedSprite } from "./SpriteBaker";

export const TILE_SIZE = 48; // 3/4 Top-Down orthogonal square tile size in pixels

// Rich Stardew-inspired palette sampled from reference boards
const TERRAIN_BASE_COLORS: Record<TerrainType, number> = {
  [TerrainType.Sand]: 0xdfbe7e,
  [TerrainType.Grass]: 0x77b255, // vibrant meadow green
  [TerrainType.GrassDry]: 0xb3a04e, // golden savanna
  [TerrainType.Dirt]: 0x9c6b43, // warm tilled path dirt
  [TerrainType.Stone]: 0xa89a83,
  [TerrainType.Water]: 0x3d8ab5, // brighter oasis azure
};

const GRASS_PATCH_DARK = 0x5da244;
const GRASS_PATCH_LIGHT = 0x8ccb63;
const FLOWER_COLORS = [0xff8ab3, 0xffffff, 0xffd94d, 0xc99aff];

/** Deterministic 0..1 hash for tile variation (no allocation). */
function hash2(x: number, y: number, salt: number): number {
  let h = (x * 374761393 + y * 668265263 + salt * 1442695041) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = (h * 1274126177) | 0;
  h = (h ^ (h >> 16)) >>> 0;
  return h / 4294967295;
}

export class PixiIsometricView {
  readonly app: Application;

  private worldContainer = new Container();
  private groundContainer = new Container();
  private shadowsContainer = new Container();
  private farmContainer = new Container();
  private objectsContainer = new Container();
  private constructionContainer = new Container();
  private cursorGraphics = new Graphics();
  private selectedGraphics = new Graphics();
  private ghostGraphics = new Graphics();
  private ghostActive = false;

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

  // Chibi survivors (visual-only wanderers, Stardew-style villagers)
  private survivors: Array<{
    container: Container;
    shadow: Graphics;
    body: Graphics;
    fx: number; fy: number; tx: number; ty: number;
    idleUntil: number; speed: number; phase: number;
    shirt: number; hair: number; skin: number; moving: boolean;
  }> = [];
  private survivorWorld: World | null = null;
  private lastFarmRefresh = 0;
  private elapsed = 0;

  // Soothing ambience: animated water shimmer, swaying trees, drifting leaves
  private waterFx = new Graphics();
  private waterTiles: Array<{ x: number; y: number; gx: number; gy: number }> = [];
  private lastWaterDraw = 0;
  private trees: Array<{
    canopy: Container;
    x: number; y: number; canopyH: number;
    phase: number; swayAmp: number;
    leafColors: number[];
  }> = [];
  private leaves: Array<{
    c: Container; g: Graphics;
    x: number; y: number; vx: number; vy: number;
    rot: number; vr: number; phase: number;
    life: number; maxLife: number; active: boolean;
  }> = [];
  private leafContainer = new Container();
  private lastLeafSpawn = 0;
  /** Campfire flames: flicker via transforms, spawn rising embers. */
  private fires: Array<{
    x: number; y: number;
    flame: Graphics; mid: Graphics; core: Graphics; glow: Graphics;
    phase: number;
  }> = [];

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
    this.worldContainer.addChild(this.waterFx);
    this.worldContainer.addChild(this.farmContainer);
    this.worldContainer.addChild(this.shadowsContainer);
    this.worldContainer.addChild(this.constructionContainer);
    this.worldContainer.addChild(this.objectsContainer);
    this.worldContainer.addChild(this.leafContainer);
    this.worldContainer.addChild(this.selectedGraphics);
    this.worldContainer.addChild(this.ghostGraphics);
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
    this.trees = [];
    this.fires = [];
    this.waterTiles = [];
    this.waterFx.clear();

    // Center camera on grid center
    const centerPx = (world.width * TILE_SIZE) / 2;
    const centerPy = (world.height * TILE_SIZE) / 2;
    this.cameraX = window.innerWidth / 2 - centerPx;
    this.cameraY = window.innerHeight / 2 - centerPy;
    this.updateCamera();

    // Render 3/4 top-down square terrain tiles with rich stylized textures
    // Layered like refs: base + soft blotches + tufts/flowers/pebbles + shore foam
    for (let gy = 0; gy < world.height; gy++) {
      for (let gx = 0; gx < world.width; gx++) {
        const type = world.typeAt(gx, gy);
        const height = world.heightAt(gx, gy);
        const sx = gx * TILE_SIZE;
        const sy = gy * TILE_SIZE;

        const g = new Graphics();
        const baseColor = TERRAIN_BASE_COLORS[type];

        // Base square tile with subtle per-tile brightness variation
        const bright = (hash2(gx, gy, 11) - 0.5) * 10;
        const rShift = Math.round(bright);
        const color = baseColor + (rShift << 16) + (rShift << 8) + rShift;
        g.rect(sx, sy, TILE_SIZE, TILE_SIZE);
        g.fill({ color, alpha: type === TerrainType.Water ? 0.96 : 1.0 });

        // Soft organic blotches (two overlapping ellipses, like hand-painted ground)
        if (type === TerrainType.Grass || type === TerrainType.GrassDry) {
          const dark = type === TerrainType.Grass ? GRASS_PATCH_DARK : 0x9a8a3e;
          const light = type === TerrainType.Grass ? GRASS_PATCH_LIGHT : 0xc9b968;
          const bx1 = sx + 6 + hash2(gx, gy, 21) * 24;
          const by1 = sy + 8 + hash2(gx, gy, 22) * 22;
          g.ellipse(bx1, by1, 10 + hash2(gx, gy, 23) * 8, 6 + hash2(gx, gy, 24) * 5);
          g.fill({ color: dark, alpha: 0.22 });
          const bx2 = sx + 8 + hash2(gx, gy, 25) * 26;
          const by2 = sy + 6 + hash2(gx, gy, 26) * 26;
          g.ellipse(bx2, by2, 7 + hash2(gx, gy, 27) * 6, 5 + hash2(gx, gy, 28) * 4);
          g.fill({ color: light, alpha: 0.2 });
        } else if (type === TerrainType.Dirt) {
          const bx = sx + 8 + hash2(gx, gy, 31) * 22;
          const by = sy + 8 + hash2(gx, gy, 32) * 22;
          g.ellipse(bx, by, 11, 7);
          g.fill({ color: 0x7d5027, alpha: 0.25 });
          g.ellipse(bx + 8, by + 6, 6, 4);
          g.fill({ color: 0xbd8a58, alpha: 0.3 });
        }

        // Type-specific micro detail
        if (type === TerrainType.Sand) {
          const rippleY = sy + (TILE_SIZE / 3) * (((gx + gy) % 3) + 0.5);
          g.moveTo(sx + 3, rippleY);
          g.bezierCurveTo(
            sx + TILE_SIZE * 0.35, rippleY - 3,
            sx + TILE_SIZE * 0.65, rippleY + 3,
            sx + TILE_SIZE - 3, rippleY,
          );
          g.stroke({ width: 1.5, color: 0xc8a462, alpha: 0.45 });
          // sand speckle
          for (let i = 0; i < 3; i++) {
            const px = sx + 6 + hash2(gx, gy, 40 + i) * 36;
            const py = sy + 6 + hash2(gx, gy, 50 + i) * 36;
            g.circle(px, py, 1.1);
            g.fill({ color: 0xb98f4e, alpha: 0.5 });
          }
        } else if (type === TerrainType.Grass) {
          // Two grass-blade clusters (3 blades each, like ref farms)
          for (let c = 0; c < 2; c++) {
            const tuftX = sx + 8 + hash2(gx, gy, 60 + c * 7) * 30;
            const tuftY = sy + 10 + hash2(gx, gy, 70 + c * 7) * 28;
            g.rect(tuftX, tuftY - 4, 2, 6);
            g.rect(tuftX + 3, tuftY - 6, 2, 8);
            g.rect(tuftX + 6, tuftY - 3, 2, 5);
            g.fill({ color: 0x3f7a28, alpha: 0.75 });
          }
          // Occasional flower cluster (pink / white / yellow, as in refs)
          if (hash2(gx, gy, 91) < 0.1) {
            const fx = sx + 10 + hash2(gx, gy, 92) * 26;
            const fy = sy + 10 + hash2(gx, gy, 93) * 26;
            const fc = FLOWER_COLORS[Math.floor(hash2(gx, gy, 94) * FLOWER_COLORS.length)] ?? 0xffffff;
            g.circle(fx, fy, 2.2);
            g.circle(fx + 4, fy + 1, 2.2);
            g.circle(fx + 2, fy - 3, 2.2);
            g.fill({ color: fc, alpha: 0.95 });
            g.circle(fx + 2, fy - 1, 1.2);
            g.fill({ color: 0xffef9e, alpha: 0.95 });
          }
          // Occasional pebble
          if (hash2(gx, gy, 95) < 0.12) {
            const px = sx + 8 + hash2(gx, gy, 96) * 30;
            const py = sy + 8 + hash2(gx, gy, 97) * 30;
            g.ellipse(px, py, 3, 2.2);
            g.fill({ color: 0x9aa37e, alpha: 0.7 });
          }
        } else if (type === TerrainType.GrassDry) {
          for (let c = 0; c < 2; c++) {
            const tuftX = sx + 8 + hash2(gx, gy, 100 + c * 7) * 30;
            const tuftY = sy + 10 + hash2(gx, gy, 110 + c * 7) * 28;
            g.rect(tuftX, tuftY - 4, 2, 6);
            g.rect(tuftX + 3, tuftY - 5, 2, 7);
            g.fill({ color: 0x7d6f2a, alpha: 0.7 });
          }
          if (hash2(gx, gy, 119) < 0.14) {
            const px = sx + 10 + hash2(gx, gy, 120) * 26;
            const py = sy + 12 + hash2(gx, gy, 121) * 24;
            g.circle(px, py, 1.8);
            g.fill({ color: 0x6e5c30, alpha: 0.6 });
          }
        } else if (type === TerrainType.Dirt) {
          // pebbles + tiny twig
          for (let i = 0; i < 2; i++) {
            const px = sx + 8 + hash2(gx, gy, 130 + i * 5) * 30;
            const py = sy + 10 + hash2(gx, gy, 140 + i * 5) * 26;
            g.circle(px, py, 1.6 + hash2(gx, gy, 150 + i) * 1.2);
            g.fill({ color: 0x6e4a28, alpha: 0.55 });
          }
          if (hash2(gx, gy, 159) < 0.2) {
            const lx = sx + 10 + hash2(gx, gy, 160) * 24;
            const ly = sy + 12 + hash2(gx, gy, 161) * 22;
            g.moveTo(lx, ly);
            g.lineTo(lx + 8, ly + 3);
            g.stroke({ width: 1.2, color: 0x5d3a1e, alpha: 0.5 });
          }
        } else if (type === TerrainType.Stone) {
          // cracks + highlight
          if (hash2(gx, gy, 170) < 0.6) {
            const cxp = sx + 8 + hash2(gx, gy, 171) * 20;
            const cyp = sy + 8 + hash2(gx, gy, 172) * 20;
            g.moveTo(cxp, cyp);
            g.lineTo(cxp + 10 + hash2(gx, gy, 173) * 10, cyp + 6);
            g.lineTo(cxp + 16, cyp + 14);
            g.stroke({ width: 1.2, color: 0x6b5d49, alpha: 0.6 });
          }
          g.circle(sx + 10 + hash2(gx, gy, 174) * 26, sy + 10 + hash2(gx, gy, 175) * 26, 2);
          g.fill({ color: 0xc4b59c, alpha: 0.5 });
          if (height > 0) {
            const cliffH = Math.min(height * 20 + 8, 36);
            g.rect(sx, sy + TILE_SIZE, TILE_SIZE, cliffH);
            g.fill({ color: 0x6e5c46 });
            g.moveTo(sx, sy + TILE_SIZE + cliffH * 0.45);
            g.lineTo(sx + TILE_SIZE, sy + TILE_SIZE + cliffH * 0.45);
            g.stroke({ width: 1.5, color: 0x483a2c, alpha: 0.55 });
          }
        } else if (type === TerrainType.Water) {
          // record for the animated shimmer overlay (redrawn on a timer)
          this.waterTiles.push({ x: sx, y: sy, gx, gy });
          // static base waves (the overlay adds the moving shimmer)
          const w1 = sy + 12 + hash2(gx, gy, 180) * 24;
          g.moveTo(sx + 8, w1);
          g.lineTo(sx + 20, w1);
          g.stroke({ width: 1.5, color: 0x9fd4e8, alpha: 0.5 });
          const w2 = sy + 10 + hash2(gx, gy, 181) * 26;
          g.moveTo(sx + 26, w2);
          g.lineTo(sx + 38, w2);
          g.stroke({ width: 1.2, color: 0x9fd4e8, alpha: 0.35 });
          // shore foam where a neighbor is land
          const neighbors: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          for (const [dx, dy] of neighbors) {
            const nx = gx + dx;
            const ny = gy + dy;
            if (nx < 0 || ny < 0 || nx >= world.width || ny >= world.height) continue;
            if (world.typeAt(nx, ny) === TerrainType.Water) continue;
            if (dx === 1) { g.rect(sx + TILE_SIZE - 3, sy, 3, TILE_SIZE); g.fill({ color: 0xeaf7ff, alpha: 0.65 }); }
            if (dx === -1) { g.rect(sx, sy, 3, TILE_SIZE); g.fill({ color: 0xeaf7ff, alpha: 0.65 }); }
            if (dy === 1) { g.rect(sx, sy + TILE_SIZE - 3, TILE_SIZE, 3); g.fill({ color: 0xeaf7ff, alpha: 0.65 }); }
            if (dy === -1) { g.rect(sx, sy, TILE_SIZE, 3); g.fill({ color: 0xeaf7ff, alpha: 0.65 }); }
          }
        }

        // Soft bottom/right edge for tile readability (no harsh grid)
        g.moveTo(sx, sy + TILE_SIZE - 0.5);
        g.lineTo(sx + TILE_SIZE, sy + TILE_SIZE - 0.5);
        g.moveTo(sx + TILE_SIZE - 0.5, sy);
        g.lineTo(sx + TILE_SIZE - 0.5, sy + TILE_SIZE);
        g.stroke({ width: 1, color: 0x2a1f14, alpha: 0.1 });

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

    this.refreshFarmOverlays(state);
    this.spawnSurvivors(world, state);
  }

  /** Rebuild dynamic layers from state (placed buildings, gathered nodes, crops). */
  syncFromState(world: World, state: GameState): void {
    this.shadowsContainer.removeChildren();
    this.constructionContainer.removeChildren();
    this.objectsContainer.removeChildren();
    this.farmContainer.removeChildren();
    this.clearSelected();
    this.clearBuildPreview();
    // survivors live in objectsContainer — respawn them after clear
    this.survivors = [];
    this.trees = [];
    this.fires = [];
    for (const node of state.nodes) this.addResourceNodeSprite(node, world);
    for (const b of state.buildings) this.addBuildingSprite(b, world);
    this.refreshFarmOverlays(state);
    this.spawnSurvivors(world, state);
  }

  /** Tilled soil rows + crop dots for farm buildings, Stardew-style. */
  refreshFarmOverlays(state: GameState): void {
    this.farmContainer.removeChildren();
    for (const b of state.buildings) {
      if (b.plots.length === 0) continue;
      const def = BUILDINGS[b.id];
      const w = def?.size.w ?? 3;
      const h = def?.size.h ?? 3;
      const ox = b.gx * TILE_SIZE;
      const oy = b.gy * TILE_SIZE;
      const plotW = (w * TILE_SIZE) / 2;
      const plotH = (h * TILE_SIZE) / 2;
      b.plots.forEach((plot, i) => {
        const px = ox + (i % 2) * plotW;
        const py = oy + Math.floor(i / 2) * plotH;
        const g = new Graphics();
        // tilled soil bed
        g.roundRect(px + 3, py + 3, plotW - 6, plotH - 6, 4);
        g.fill({ color: 0x5d3a22, alpha: 1 });
        g.roundRect(px + 5, py + 5, plotW - 10, plotH - 10, 3);
        g.fill({ color: 0x7a5230, alpha: 1 });
        // furrow rows
        for (let r = 0; r < 3; r++) {
          const ry = py + 10 + r * ((plotH - 16) / 3);
          g.moveTo(px + 7, ry);
          g.lineTo(px + plotW - 7, ry);
          g.stroke({ width: 2, color: 0x4a2c17, alpha: 0.8 });
        }
        // dry vs watered tint
        if (plot.water > 0.05) {
          g.roundRect(px + 5, py + 5, plotW - 10, plotH - 10, 3);
          g.fill({ color: 0x2e1c0e, alpha: Math.min(0.35, plot.water * 0.4) });
        }
        // crops by growth stage
        if (plot.crop) {
          const cropDef = CROPS[plot.crop];
          const stage = growthStage(plot.progress);
          const stageColor = cropDef.stageColors[Math.min(stage, cropDef.stageColors.length - 1)] ?? 0x7da34f;
          const size = 2 + stage * 1.8 + plot.progress * 2;
          for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 4; c++) {
              const cx = px + 12 + c * ((plotW - 24) / 3);
              const cy = py + 10 + r * ((plotH - 16) / 2) - 2;
              // stem
              g.rect(cx - 1, cy - size, 2, size);
              g.fill({ color: 0x3f6b2a, alpha: 1 });
              // head / leaves
              g.circle(cx, cy - size, size * 0.8);
              g.fill({ color: stageColor, alpha: 1 });
              if (plot.ready) {
                g.circle(cx + 1, cy - size - 1, 1.2);
                g.fill({ color: 0xfff6c9, alpha: 0.9 });
              }
            }
          }
        }
        this.farmContainer.addChild(g);
      });
    }
  }

  private spawnSurvivors(world: World, state: GameState): void {
    if (this.survivors.length > 0) return;
    this.survivorWorld = world;
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const designs = [
      { shirt: 0x4f9e4d, hair: 0x4a2f1d, skin: 0xf2c89b }, // farmer green
      { shirt: 0xd9793b, hair: 0x1d1d22, skin: 0xe8b088 }, // engineer orange
      { shirt: 0x4d7dd1, hair: 0xb5542c, skin: 0xf5d3ae }, // scout blue
    ];
    const count = Math.max(3, Math.min(5, state.population));
    for (let i = 0; i < count; i++) {
      const d = designs[i % designs.length] ?? designs[0]!;
      const container = new Container();
      const shadow = new Graphics();
      const body = new Graphics();
      container.addChild(shadow);
      container.addChild(body);
      container.zIndex = 999999;
      this.objectsContainer.addChild(container);
      const fx = cx - 2 + i * 2 + hash2(i, 7, 3) * 2;
      const fy = cy + 3 + (i % 2) * 2;
      this.survivors.push({
        container, shadow, body,
        fx, fy, tx: fx, ty: fy,
        idleUntil: performance.now() + 500 + i * 700,
        speed: 2.2 + hash2(i, 1, 9) * 1.2,
        phase: Math.random() * Math.PI * 2,
        shirt: d.shirt, hair: d.hair, skin: d.skin, moving: false,
      });
    }
  }

  private drawSurvivor(
    s: { shadow: Graphics; body: Graphics; moving: boolean; phase: number; shirt: number; hair: number; skin: number },
    bob: number,
  ): void {
    const { shadow, body, moving, phase, shirt, hair, skin } = s;
    shadow.clear();
    shadow.ellipse(0, 0, 9, 4.5);
    shadow.fill({ color: 0x140e0a, alpha: 0.3 });
    body.clear();
    const legSwing = moving ? Math.sin(phase * 10) * 2.2 : 0;
    // legs
    body.roundRect(-6, -12 + bob * 0.3, 5, 12 + legSwing * 0.4, 2);
    body.fill({ color: 0x3a3348 });
    body.roundRect(1, -12 - bob * 0.3, 5, 12 - legSwing * 0.4, 2);
    body.fill({ color: 0x464058 });
    // torso (chibi, big-head proportions like refs)
    body.roundRect(-8, -26 + bob, 16, 15, 5);
    body.fill({ color: shirt });
    body.roundRect(-8, -26 + bob, 16, 4, 2);
    body.fill({ color: 0xffffff, alpha: 0.18 });
    // arms
    const armSwing = moving ? Math.sin(phase * 10 + Math.PI) * 2 : 0;
    body.roundRect(-11, -24 + bob + armSwing * 0.4, 4, 10, 2);
    body.fill({ color: skin });
    body.roundRect(7, -24 + bob - armSwing * 0.4, 4, 10, 2);
    body.fill({ color: skin });
    // head
    body.circle(0, -32 + bob * 1.2, 8);
    body.fill({ color: skin });
    // hair cap
    body.circle(0, -35 + bob * 1.2, 8);
    body.fill({ color: hair, alpha: 1 });
    body.rect(-8, -35 + bob * 1.2, 16, 5);
    body.fill({ color: hair });
    // eyes (two dots, facing down-screen like top-down refs)
    body.circle(-3, -31 + bob * 1.2, 1.2);
    body.circle(3, -31 + bob * 1.2, 1.2);
    body.fill({ color: 0x1d1620 });
  }

  addBuildingSprite(b: PlacedBuilding, _world: World): void {
    // Campfire has no GLB — drawn procedurally with a live flickering flame.
    if (b.id === "campfire") {
      this.addCampfireSprite(b);
      return;
    }

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

  /** Procedural campfire: stone ring, crossed logs, layered flame + glow. */
  private addCampfireSprite(b: PlacedBuilding): void {
    const posX = (b.gx + 0.5) * TILE_SIZE;
    const posY = (b.gy + 0.85) * TILE_SIZE;

    const c = new Container();
    c.position.set(posX, posY);
    c.zIndex = (b.gy + 1) * 1000 + b.gx;

    const glow = new Graphics();
    glow.circle(0, -10, 30);
    glow.fill({ color: 0xff9a3c, alpha: 0.22 });
    c.addChild(glow);

    const base = new Graphics();
    base.ellipse(0, 0, 13, 6);
    base.fill({ color: 0x140e0a, alpha: 0.32 });
    // stone ring
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      const r = 2.4 + hash2(b.gx, b.gy, 300 + i) * 1.4;
      base.circle(Math.cos(a) * 11, Math.sin(a) * 5 - 2, r);
      base.fill({ color: 0x8f8f98 });
      base.circle(Math.cos(a) * 11 - 0.8, Math.sin(a) * 5 - 2.8, r * 0.45);
      base.fill({ color: 0xc4c9d1, alpha: 0.9 });
    }
    // crossed logs
    base.roundRect(-9, -6, 18, 4.5, 2);
    base.fill({ color: 0x5d3a1e });
    base.roundRect(-9, -6, 18, 1.6, 1);
    base.fill({ color: 0x8a5f36 });
    const log2 = new Graphics();
    log2.roundRect(-9, -6, 18, 4.5, 2);
    log2.fill({ color: 0x4e2f16 });
    log2.position.set(0, -2);
    log2.rotation = 0.6;
    c.addChild(base);
    c.addChild(log2);

    // layered flame (outer flickers most, core stays bright)
    const flame = new Graphics();
    flame.ellipse(0, -13, 7, 10);
    flame.fill({ color: 0xe07b2c });
    const mid = new Graphics();
    mid.ellipse(0, -13, 4.5, 7.5);
    mid.fill({ color: 0xf5a83b });
    const core = new Graphics();
    core.ellipse(0, -12, 2.4, 4.2);
    core.fill({ color: 0xffe9a8 });
    for (const part of [flame, mid, core]) {
      part.pivot.set(0, -4);
      part.position.set(0, -4);
      c.addChild(part);
    }

    this.objectsContainer.addChild(c);
    this.fires.push({ x: posX, y: posY - 14, flame, mid, core, glow, phase: (b.gx * 3 + b.gy * 7) % 6 });
  }

  addResourceNodeSprite(node: ResourceNode, _world: World): void {
    const posX = (node.gx + 0.5) * TILE_SIZE;
    const posY = (node.gy + 0.85) * TILE_SIZE;
    const vary = hash2(node.gx, node.gy, 201);

    // Procedural Stardew-style nodes — baked GLBs foreshorten into blobs
    // from the top-down camera, so trees/rocks/scrap are drawn in 2D.
    const c = new Container();
    c.position.set(posX, posY);
    c.zIndex = (node.gy + 1) * 1000 + node.gx;
    const shadow = new Graphics();
    const body = new Graphics();
    c.addChild(shadow);
    c.addChild(body);

    if (node.kind === "wood") {
      // Tree variants: broadleaf / pine / poplar / golden / dead — swaying canopy
      const s = 0.9 + vary * 0.35;
      const roll = hash2(node.gx, node.gy, 202);
      const variant = roll < 0.46 ? "broad" : roll < 0.66 ? "pine" : roll < 0.8 ? "poplar" : roll < 0.93 ? "golden" : "dead";
      const golden = variant === "golden";
      const dark = golden ? 0x8a6b1f : 0x2e6b2c;
      const mid = golden ? 0xd9a83c : 0x4da24a;
      const light = golden ? 0xf2d06b : 0x86d95e;
      const shadowW = variant === "pine" ? 12 : 15;
      shadow.ellipse(3, 1, shadowW * s, 7 * s);
      shadow.fill({ color: 0x140e0a, alpha: 0.32 });

      // canopy lives in its own sub-container so wind sways leaves, not roots
      const canopy = new Container();
      const canopyG = new Graphics();
      canopy.addChild(canopyG);
      let canopyH = 24 * s;

      if (variant === "pine") {
        body.rect(-2 * s, -9 * s, 4 * s, 10 * s);
        body.fill({ color: 0x5d3a1e });
        const tiers: Array<[number, number, number]> = [[-36, 8, 0x2a5b28], [-27, 11, 0x35702f], [-17, 14, 0x41853a]];
        for (const [ty, hw, col] of tiers) {
          canopyG.moveTo(0, (ty - 6) * s);
          canopyG.lineTo(-hw * s, ty * s);
          canopyG.lineTo(hw * s, ty * s);
          canopyG.closePath();
          canopyG.fill({ color: col });
        }
        canopyG.circle(-3 * s, -28 * s, 2 * s);
        canopyG.fill({ color: 0x8fd06e, alpha: 0.8 });
        canopyH = 38 * s;
      } else if (variant === "poplar") {
        body.rect(-2 * s, -10 * s, 4 * s, 11 * s);
        body.fill({ color: 0x6b4423 });
        canopyG.ellipse(0, -22 * s, 7.5 * s, 14 * s);
        canopyG.fill({ color: 0x3f8a3c });
        canopyG.ellipse(-2 * s, -23 * s, 4.5 * s, 11 * s);
        canopyG.fill({ color: 0x62b95a });
        canopyG.ellipse(-3 * s, -26 * s, 2 * s, 6 * s);
        canopyG.fill({ color: 0xa5e08e, alpha: 0.85 });
        canopyH = 34 * s;
      } else if (variant === "dead") {
        // bare snag: taller trunk + branches, no leaves (sways nothing)
        body.rect(-2 * s, -24 * s, 4 * s, 25 * s);
        body.fill({ color: 0x6e6259 });
        body.moveTo(0, -18 * s);
        body.lineTo(-9 * s, -27 * s);
        body.moveTo(0, -14 * s);
        body.lineTo(9 * s, -24 * s);
        body.moveTo(0, -22 * s);
        body.lineTo(5 * s, -31 * s);
        body.stroke({ width: 2 * s, color: 0x6e6259 });
        body.circle(4 * s, -8 * s, 2 * s);
        body.fill({ color: 0x5da244, alpha: 0.7 });
        canopyH = 0;
      } else {
        // broadleaf + golden: round canopy, sunlit highlight
        body.rect(-2.5 * s, -10 * s, 5 * s, 11 * s);
        body.fill({ color: 0x6b4423 });
        body.rect(-2.5 * s, -10 * s, 5 * s, 3 * s);
        body.fill({ color: 0x8a5f36 });
        canopyG.circle(0, -22 * s, 15 * s);
        canopyG.fill({ color: dark });
        canopyG.circle(-3 * s, -25 * s, 11 * s);
        canopyG.fill({ color: mid });
        canopyG.circle(-6 * s, -28 * s, 6 * s);
        canopyG.fill({ color: light });
        canopyG.circle(5 * s, -20 * s, 2.2 * s);
        canopyG.circle(-1 * s, -17 * s, 1.8 * s);
        canopyG.fill({ color: dark, alpha: 0.6 });
        canopyG.circle(-7 * s, -26 * s, 1.6 * s);
        canopyG.fill({ color: 0xffffff, alpha: 0.5 });
        canopyG.moveTo(-13 * s, -14 * s);
        canopyG.lineTo(13 * s, -14 * s);
        canopyG.stroke({ width: 2 * s, color: dark, alpha: 0.7 });
      }

      c.addChild(canopy);
      if (canopyH > 0) {
        this.trees.push({
          canopy,
          x: posX, y: posY, canopyH,
          phase: vary * Math.PI * 2,
          swayAmp: 1.2 + vary * 1.4,
          leafColors: golden
            ? [0xf2d06b, 0xd9a83c, 0xe8b34b]
            : variant === "pine"
              ? [0x35702f, 0x41853a, 0x2a5b28]
              : [0x86d95e, 0x62b95a, 0xd9e07a, 0xffb3c9],
        });
      }
    } else if (node.kind === "stone") {
      const s = 0.85 + vary * 0.4;
      shadow.ellipse(3, 1, 14 * s, 6.5 * s);
      shadow.fill({ color: 0x140e0a, alpha: 0.32 });
      // boulder body
      body.ellipse(0, -10 * s, 14 * s, 11 * s);
      body.fill({ color: 0x8f8f98 });
      body.ellipse(-2 * s, -13 * s, 10 * s, 7.5 * s);
      body.fill({ color: 0xa9adb6 });
      body.ellipse(-4 * s, -15 * s, 5 * s, 3.5 * s);
      body.fill({ color: 0xd4d8de });
      // crack + moss
      body.moveTo(-4 * s, -18 * s);
      body.lineTo(2 * s, -10 * s);
      body.lineTo(6 * s, -8 * s);
      body.stroke({ width: 1.4, color: 0x5d5d66, alpha: 0.8 });
      if (vary > 0.5) {
        body.circle(6 * s, -8 * s, 2.5 * s);
        body.fill({ color: 0x5da244, alpha: 0.8 });
      }
      // pebbles
      body.circle(-12 * s, -3 * s, 1.8);
      body.circle(11 * s, -2 * s, 1.5);
      body.fill({ color: 0x77777f, alpha: 0.9 });
    } else {
      // scrap pile: junk heap with planks + rust + metal shards
      const s = 0.9 + vary * 0.3;
      shadow.ellipse(3, 1, 13 * s, 6 * s);
      shadow.fill({ color: 0x140e0a, alpha: 0.32 });
      body.ellipse(0, -6 * s, 13 * s, 7 * s);
      body.fill({ color: 0x5d4a33 });
      body.ellipse(0, -8 * s, 10 * s, 5.5 * s);
      body.fill({ color: 0x7d6547 });
      // planks
      body.rect(-10 * s, -12 * s, 12 * s, 3.5 * s);
      body.fill({ color: 0x8a5f36 });
      body.rect(-2 * s, -14 * s, 11 * s, 3.5 * s);
      body.fill({ color: 0x6e6e78 });
      // rust spots + metal glint
      body.circle(-3 * s, -9 * s, 2.2 * s);
      body.circle(5 * s, -7 * s, 1.8 * s);
      body.fill({ color: 0xc96a2c, alpha: 0.9 });
      body.circle(3 * s, -13 * s, 1.4 * s);
      body.fill({ color: 0xe8edf2, alpha: 0.9 });
    }

    if (vary > 0.6) c.scale.x *= -1; // mirror variety
    this.objectsContainer.addChild(c);
  }

  gridToScreen(gx: number, gy: number): [number, number] {
    return [gx * TILE_SIZE, gy * TILE_SIZE];
  }

  /** Selection highlight for the 2.5D view (replaces the Three.js Selection box). */
  setSelected(gx: number, gy: number, w = 1, h = 1): void {
    this.selectedGraphics.clear();
    this.selectedGraphics.rect(gx * TILE_SIZE, gy * TILE_SIZE, w * TILE_SIZE, h * TILE_SIZE);
    this.selectedGraphics.stroke({ width: 2.5, color: 0xffd94d, alpha: 0.95 });
    this.selectedGraphics.fill({ color: 0xffd94d, alpha: 0.12 });
  }

  clearSelected(): void {
    this.selectedGraphics.clear();
  }

  /** Build ghost footprint (green = placeable, red = blocked). */
  setBuildPreview(gx: number, gy: number, w: number, h: number, valid: boolean): void {
    this.ghostActive = true;
    this.cursorGraphics.clear();
    const color = valid ? 0x6fe08a : 0xe05c5c;
    this.ghostGraphics.clear();
    this.ghostGraphics.rect(gx * TILE_SIZE, gy * TILE_SIZE, w * TILE_SIZE, h * TILE_SIZE);
    this.ghostGraphics.fill({ color, alpha: 0.22 });
    this.ghostGraphics.stroke({ width: 2.5, color, alpha: 0.95 });
  }

  clearBuildPreview(): void {
    if (!this.ghostActive) return;
    this.ghostActive = false;
    this.ghostGraphics.clear();
  }

  /** Keyboard pan (WASD/arrows), pixels per call. */
  panPixels(dx: number, dy: number): void {
    this.cameraX += dx;
    this.cameraY += dy;
    this.updateCamera();
  }

  screenToGrid(screenX: number, screenY: number): [number, number] {
    const localX = (screenX - this.cameraX) / this.zoom;
    const localY = (screenY - this.cameraY) / this.zoom;
    return [Math.floor(localX / TILE_SIZE), Math.floor(localY / TILE_SIZE)];
  }

  update(time: GameTime, state?: GameState): void {
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

    // Survivors + farm refresh need a state; Game passes it each frame
    const now = performance.now();
    const dt = Math.min(0.05, (now - (this.lastFrame ?? now)) / 1000 || 0.016);
    this.lastFrame = now;
    this.elapsed += dt;

    if (state && now - this.lastFarmRefresh > 400) {
      this.lastFarmRefresh = now;
      this.refreshFarmOverlays(state);
    }
    this.updateSurvivors(now, dt);
    this.updateAmbience(now, dt);
  }

  /** Gentle water shimmer + swaying canopies + drifting leaves (all cheap transforms). */
  private updateAmbience(now: number, dt: number): void {
    const t = this.elapsed;

    // Water shimmer: redrawn slowly (~7Hz) — a slow breathing highlight, not chop
    if (this.waterTiles.length > 0 && now - this.lastWaterDraw > 140) {
      this.lastWaterDraw = now;
      const fx = this.waterFx;
      fx.clear();
      for (const tile of this.waterTiles) {
        const ph = (tile.gx * 0.7 + tile.gy * 1.3);
        const dx = Math.sin(t * 0.9 + ph) * 3;
        const alpha = 0.28 + 0.14 * Math.sin(t * 0.7 + ph * 1.7);
        const y1 = tile.y + 14 + Math.sin(t * 0.5 + ph) * 2;
        fx.moveTo(tile.x + 9 + dx, y1);
        fx.lineTo(tile.x + 22 + dx, y1);
        fx.stroke({ width: 1.6, color: 0xbfe6f5, alpha });
        const y2 = tile.y + 30 + Math.cos(t * 0.45 + ph) * 2;
        fx.moveTo(tile.x + 24 - dx, y2);
        fx.lineTo(tile.x + 36 - dx, y2);
        fx.stroke({ width: 1.2, color: 0xbfe6f5, alpha: alpha * 0.7 });
      }
    }

    // Canopy sway: leaves breathe, trunks stay rooted
    for (const tree of this.trees) {
      tree.canopy.position.x = Math.sin(t * 1.1 + tree.phase) * tree.swayAmp;
      tree.canopy.rotation = Math.sin(t * 0.8 + tree.phase) * 0.018;
    }

    // Campfire flicker: layered flames dance at different rates, glow breathes
    for (const fire of this.fires) {
      const p = fire.phase;
      fire.flame.scale.y = 1 + 0.16 * Math.sin(t * 11 + p) + 0.07 * Math.sin(t * 27 + p * 2);
      fire.flame.scale.x = 1 + 0.08 * Math.sin(t * 13 + p * 1.3);
      fire.flame.rotation = 0.06 * Math.sin(t * 9 + p);
      fire.mid.scale.y = 1 + 0.12 * Math.sin(t * 14 + p + 1);
      fire.core.position.x = 1.2 * Math.sin(t * 17 + p);
      fire.glow.alpha = 0.2 + 0.05 * Math.sin(t * 8 + p);
    }

    // Falling leaves: slow drift, recycled pool
    if (this.trees.length > 0 && now - this.lastLeafSpawn > 260) {
      this.lastLeafSpawn = now;
      this.spawnLeaf();
    }
    for (const leaf of this.leaves) {
      if (!leaf.active) continue;
      leaf.life += dt;
      if (leaf.life >= leaf.maxLife) {
        leaf.active = false;
        leaf.c.visible = false;
        continue;
      }
      leaf.x += (leaf.vx + Math.sin(t * 2.6 + leaf.phase) * 7) * dt;
      leaf.y += leaf.vy * dt;
      leaf.rot += leaf.vr * dt;
      leaf.c.position.set(leaf.x, leaf.y);
      leaf.c.rotation = leaf.rot;
      const fadeIn = Math.min(1, leaf.life / 0.6);
      const fadeOut = Math.min(1, (leaf.maxLife - leaf.life) / 1.2);
      leaf.g.alpha = Math.min(fadeIn, fadeOut) * 0.9;
    }
  }

  private spawnLeaf(): void {
    let leaf = this.leaves.find((l) => !l.active);
    if (!leaf) {
      if (this.leaves.length >= 48) return;
      const g = new Graphics();
      const c = new Container();
      c.addChild(g);
      this.leafContainer.addChild(c);
      leaf = {
        c, g, x: 0, y: 0, vx: 0, vy: 0,
        rot: 0, vr: 0, phase: 0, life: 0, maxLife: 1, active: false,
      };
      this.leaves.push(leaf);
    }
    const tree = this.trees[Math.floor(Math.random() * this.trees.length)];
    if (!tree) return;
    // Campfire embers rise instead of falling (~1 in 3 spawns when fires burn)
    const fire = this.fires.length > 0 && Math.random() < 0.33
      ? this.fires[Math.floor(Math.random() * this.fires.length)]
      : null;
    const color = fire
      ? [0xffb03c, 0xff7b2c, 0xffe9a8][Math.floor(Math.random() * 3)] ?? 0xffb03c
      : tree.leafColors[Math.floor(Math.random() * tree.leafColors.length)] ?? 0x86d95e;
    leaf.g.clear();
    leaf.g.ellipse(0, 0, 2.4, 1.7);
    leaf.g.fill({ color });
    leaf.g.moveTo(0, 0);
    leaf.g.lineTo(3.2, -1);
    leaf.g.stroke({ width: 0.8, color: 0x3f6b2a, alpha: 0.7 });
    leaf.x = fire ? fire.x + (Math.random() - 0.5) * 8 : tree.x + (Math.random() - 0.5) * 22 + tree.canopy.position.x;
    leaf.y = fire ? fire.y + Math.random() * 4 : tree.y - tree.canopyH + Math.random() * 8;
    leaf.vx = fire ? (Math.random() - 0.5) * 6 : 6 + Math.random() * 8; // embers wobble up, leaves ride the breeze
    leaf.vy = fire ? -(14 + Math.random() * 12) : 11 + Math.random() * 9;
    leaf.rot = Math.random() * Math.PI * 2;
    leaf.vr = (Math.random() - 0.5) * 4;
    leaf.phase = Math.random() * Math.PI * 2;
    leaf.life = 0;
    leaf.maxLife = 4 + Math.random() * 2.5;
    leaf.active = true;
    leaf.c.visible = true;
    leaf.c.position.set(leaf.x, leaf.y);
  }

  private lastFrame: number | null = null;

  private updateSurvivors(now: number, dt: number): void {
    if (this.survivors.length === 0 || !this.survivorWorld) return;
    const world = this.survivorWorld;
    for (const s of this.survivors) {
      const dx = s.tx - s.fx;
      const dy = s.ty - s.fy;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.08) {
        s.moving = false;
        if (now > s.idleUntil) {
          // pick a nearby walkable target (5-tile radius, like villagers strolling)
          for (let tries = 0; tries < 8; tries++) {
            const nx = Math.round(s.fx + (hash2(Math.floor(now / 1000), tries, s.phase * 100 | 0) - 0.5) * 10);
            const ny = Math.round(s.fy + (hash2(tries, Math.floor(now / 1000), s.phase * 50 | 0) - 0.5) * 10);
            if (nx < 2 || ny < 2 || nx >= world.width - 2 || ny >= world.height - 2) continue;
            if (world.isWater(nx, ny)) continue;
            s.tx = nx + 0.5;
            s.ty = ny + 0.5;
            s.moving = true;
            break;
          }
          if (!s.moving) s.idleUntil = now + 1500;
        }
      } else {
        s.moving = true;
        const step = (s.speed * dt) / 1;
        s.fx += (dx / dist) * Math.min(step, dist);
        s.fy += (dy / dist) * Math.min(step, dist);
        s.phase += dt * 6;
        if (dist < 0.15) s.idleUntil = now + 1200 + hash2(s.tx | 0, s.ty | 0, 7) * 3000;
      }
      const px = s.fx * TILE_SIZE;
      const py = s.fy * TILE_SIZE;
      s.container.position.set(Math.round(px), Math.round(py));
      s.container.zIndex = Math.round(py) * 1000 + Math.round(px);
      const bob = s.moving ? Math.abs(Math.sin(s.phase * 5)) * -1.6 : Math.sin(this.elapsed * 2 + s.phase) * -0.7;
      this.drawSurvivor(s, bob);
    }
    this.objectsContainer.sortChildren();
  }

  private updateCamera(): void {
    this.worldContainer.position.set(Math.round(this.cameraX), Math.round(this.cameraY));
    this.worldContainer.scale.set(this.zoom);
  }

  private updateHoverCursor(): void {
    if (this.ghostActive) return;
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
