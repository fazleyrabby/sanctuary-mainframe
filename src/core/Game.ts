import { BUILDINGS, BUILD_MENU, type BuildingId, type ResourceKey } from "../data/buildings";
import { CROP_IDS, CROPS, growthStage, type CropId } from "../data/crops";
import { NODES } from "../data/resources";
import { GameState, type PlacedBuilding, type ResourceNode } from "../state/GameState";
import { SaveSystem, buildSaveData, type SaveData } from "../state/SaveSystem";
import { SimulationSystem } from "../systems/SimulationSystem";
import {
  evaluateMainframe,
  snoozeDuration,
  type MainframeReport,
} from "../systems/MainframeAdvisor";
import { View } from "../view/View";
import { PixiIsometricView } from "../view/pixi/PixiIsometricView";
import { InputManager } from "../input/InputManager";
import { BuildMenu } from "../ui/BuildMenu";
import { HUD } from "../ui/HUD";
import { InspectorPanel, type InspectorContent, type InspectorRow } from "../ui/InspectorPanel";
import { MainframePanel } from "../ui/MainframePanel";
import { World, terrainName } from "../world/World";
import { EventBus } from "./Events";
import { GameConfig } from "./GameConfig";
import { Loop } from "./Loop";
import { GameTime } from "./Time";

export class Game {
  private world: World;
  private view: View;
  private canvas: HTMLCanvasElement;
  private pixiCanvas: HTMLCanvasElement;
  private pixiView: PixiIsometricView | null = null;

  private state: GameState;
  private simulation = new SimulationSystem();
  private saves = new SaveSystem();
  private time = new GameTime();
  private input: InputManager;
  private hud: HUD;
  private buildMenu: BuildMenu;
  private inspector: InspectorPanel;
  private mainframe: MainframePanel;
  private loop: Loop;
  private events = new EventBus();

  private buildId: BuildingId | null = null;
  private rotation = 0;
  private speedLevel = 1;
  private selectedSeed: CropId = "wheat";
  private toast: { text: string; until: number } | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    pixiCanvas: HTMLCanvasElement,
    uiRoot: HTMLElement,
  ) {
    this.canvas = canvas;
    this.pixiCanvas = pixiCanvas;
    this.world = new World(
      GameConfig.world.gridWidth,
      GameConfig.world.gridHeight,
      GameConfig.world.tileSize,
      GameConfig.world.seed,
    );
    this.state = new GameState(this.world);

    this.view = new View(canvas);

    this.input = new InputManager(pixiCanvas);
    this.hud = new HUD(uiRoot);
    this.buildMenu = new BuildMenu(uiRoot);
    this.inspector = new InspectorPanel(uiRoot, (id, payload) => this.onInspectorAction(id, payload));
    this.mainframe = new MainframePanel(uiRoot, (id) => this.onMainframeAction(id));

    this.hud.onTool((tool) => {
      if (tool === "Build") {
        const visible = this.buildMenu.toggle();
        if (!visible) this.cancelBuild();
      } else if (tool === "AI") {
        this.mainframe.toggle(this.mainframeReport(), this.state.aiTrust);
      }
    });
    this.buildMenu.onSelect((id) => this.beginBuild(id));
    this.hud.onSystem((action) => {
      if (action === "save") void this.saveGame();
      else if (action === "load") void this.loadGame();
      else if (action === "new") void this.newGame();
    });

    this.loop = new Loop(
      (fixed) => this.tick(fixed),
      (delta) => this.render(delta),
      10,
    );

    window.addEventListener("resize", this.onResize);
    this.onResize();
  }

  /** 2.5D is the only renderer. Three.js View stays headless (asset baking). */
  private async bootPixi(): Promise<void> {
    this.canvas.style.display = "none";
    this.pixiCanvas.style.display = "block";
    if (!this.pixiView) {
      this.pixiView = new PixiIsometricView();
      await this.pixiView.init(this.pixiCanvas);
      this.pixiView.bakeAssets(this.view.assets);
    }
    this.pixiView.buildWorld(this.world, this.state);
  }

  async init(): Promise<void> {
    await this.view.loadAssets();
    this.state.populateNodes();
    this.placeStarterSettlement();
    this.hud.setActiveTool("Build");

    await this.bootPixi();
  }

  start(): void {
    this.loop.start();
    this.events.emit("world:ready", undefined);
  }

  stop(): void {
    this.loop.stop();
    this.input.dispose();
    window.removeEventListener("resize", this.onResize);
  }

  private tick(fixedDelta: number): void {
    const before = this.time.day * 24 + this.time.hour;
    this.time.advance(fixedDelta);
    const hours = this.time.day * 24 + this.time.hour - before;
    this.simulation.tick(this.state, hours, { daylight: this.time.daylight });
    const notice = this.state.notices.shift();
    if (notice) this.showToast(notice, 4000);
  }

  private render(delta: number): void {
    this.pixiView?.update(this.time, this.state);
    this.handleKeyEdges();
    this.handlePixiClicks();
    this.updatePixiCamera(delta);
    this.updateBuildGhost();

    this.hud.update(this.time, this.state);
    this.buildMenu.setAffordable((id) => this.state.canAfford(BUILDINGS[id].cost));
    this.updateInspector();
    this.mainframe.refresh(this.mainframeReport(), this.state.aiTrust);

    if (this.toast && performance.now() > this.toast.until) {
      this.toast = null;
      this.hud.clearToast();
    }
  }

  // ------------------------------------------------------------- input (2.5D)

  private handleKeyEdges(): void {
    for (const key of this.input.consumeKeyPresses()) {
      if (key === "b") {
        const visible = this.buildMenu.toggle();
        if (!visible) this.cancelBuild();
      } else if (key === "r") {
        this.rotation = (this.rotation + 1) % 4;
      } else if (key === "escape") {
        this.cancelBuild();
        this.buildMenu.hide();
        this.mainframe.hide();
        this.state.selected = null;
        this.pixiView?.clearSelected();
        this.inspector.hide();
      }
    }
    if (this.input.has("1")) this.setSpeed(1);
    if (this.input.has("2")) this.setSpeed(2);
    if (this.input.has("3")) this.setSpeed(4);
    if (this.input.has(" ")) this.setSpeed(0);
    // clear unconsumed drag/wheel (camera is owned by the Pixi view)
    this.input.consumeDrag();
    this.input.consumeWheel();
  }

  private handlePixiClicks(): void {
    if (!this.pixiView) return;
    for (const click of this.input.consumeClicks()) {
      if (click.button === 2) {
        this.cancelBuild();
        continue;
      }
      if (click.button !== 0) continue;
      const [gx, gy] = this.pixiView.screenToGrid(click.x, click.y);
      if (!this.world.grid.inBounds(gx, gy)) continue;
      const node = this.state.nodeAt(gx, gy);
      if (node && !this.buildId) {
        this.gather(node);
        continue;
      }
      if (this.buildId) {
        this.tryPlace(this.buildId, gx, gy);
      } else {
        this.selectTile(gx, gy);
      }
    }
  }

  /** WASD/arrows pan the Pixi camera (drag + wheel are owned by the Pixi view). */
  private updatePixiCamera(delta: number): void {
    const { moveRight, moveForward } = this.input;
    if ((moveRight !== 0 || moveForward !== 0) && this.pixiView) {
      const speed = 520 * delta;
      this.pixiView.panPixels(-moveRight * speed, moveForward * speed);
    }
  }

  /** Green/red footprint ghost while a building is selected. */
  private updateBuildGhost(): void {
    if (!this.pixiView) return;
    if (!this.buildId || !this.input.pointerInside) {
      this.pixiView.clearBuildPreview();
      return;
    }
    const [gx, gy] = this.pixiView.screenToGrid(this.input.pointerX, this.input.pointerY);
    if (!this.world.grid.inBounds(gx, gy)) {
      this.pixiView.clearBuildPreview();
      return;
    }
    const def = BUILDINGS[this.buildId];
    const swapped = this.rotation % 2 !== 0;
    const w = swapped ? def.size.h : def.size.w;
    const h = swapped ? def.size.w : def.size.h;
    this.pixiView.setBuildPreview(gx, gy, w, h, this.state.canPlace(this.buildId, gx, gy, this.rotation));
  }

  // ------------------------------------------------------------- actions

  private gather(node: ResourceNode): void {
    const result = this.state.gather(node);
    if (!result) return;
    const label = result.resource.charAt(0).toUpperCase() + result.resource.slice(1);
    this.showToast(`+${result.amount.toFixed(0)} ${label}`);
    this.state.selected = { gx: node.gx, gy: node.gy };
    this.pixiView?.syncFromState(this.world, this.state);
    this.pixiView?.setSelected(node.gx, node.gy);
  }

  private onInspectorAction(id: string, payload?: unknown): void {
    if (id === "seed") {
      this.selectedSeed = payload as CropId;
      return;
    }

    const target = payload as { uid: number; plotIndex: number } | undefined;
    if (!target) return;
    const building = this.state.buildings.find((b) => b.uid === target.uid);
    if (!building) return;

    if (id === "plant") {
      if (this.state.plant(building, target.plotIndex, this.selectedSeed)) {
        this.showToast(`Planted ${CROPS[this.selectedSeed].name}`);
        this.pixiView?.refreshFarmOverlays(this.state);
      }
    } else if (id === "water") {
      if (this.state.waterPlot(building, target.plotIndex)) {
        this.showToast("Watered plot");
        this.pixiView?.refreshFarmOverlays(this.state);
      }
    } else if (id === "harvest") {
      const gained = this.state.harvest(building, target.plotIndex);
      if (gained > 0) {
        this.showToast(`+${gained.toFixed(0)} Food`);
        this.pixiView?.refreshFarmOverlays(this.state);
      }
    } else if (id === "gather") {
      const node = this.state.selected
        ? this.state.nodeAt(this.state.selected.gx, this.state.selected.gy)
        : null;
      if (node) this.gather(node);
    }
  }

  private tryPlace(id: BuildingId, gx: number, gy: number): void {
    if (!this.state.canPlace(id, gx, gy, this.rotation)) return;
    const placed = this.state.place(id, gx, gy, this.rotation);
    this.pixiView?.addBuildingSprite(placed, this.world);
    this.pixiView?.refreshFarmOverlays(this.state);
    this.selectTile(gx, gy);
  }

  private selectTile(gx: number, gy: number): void {
    this.state.selected = { gx, gy };
    const building = this.state.buildingAt(gx, gy);
    const def = building ? BUILDINGS[building.id] : null;
    const swapped = building ? building.rotation % 2 !== 0 : false;
    const size = def ? (swapped ? { w: def.size.h, h: def.size.w } : def.size) : { w: 1, h: 1 };

    if (building) {
      this.pixiView?.setSelected(building.gx, building.gy, size.w, size.h);
    } else {
      this.pixiView?.setSelected(gx, gy);
    }
  }

  // ------------------------------------------------------------- mainframe

  private nowHours(): number {
    return this.time.day * 24 + this.time.hour;
  }

  private mainframeReport(): MainframeReport {
    return evaluateMainframe(this.state, this.nowHours());
  }

  private onMainframeAction(id: "accept" | "dismiss" | "why"): void {
    if (id === "why") {
      this.mainframe.toggleWhy();
      this.mainframe.refresh(this.mainframeReport(), this.state.aiTrust);
      return;
    }
    const advice = this.mainframeReport().advice;
    if (!advice) return;
    if (id === "accept") {
      this.state.aiTrust = Math.min(100, this.state.aiTrust + 3);
      this.state.morale = Math.min(100, this.state.morale + 1);
      if (advice.action?.kind === "build") {
        const name = BUILDINGS[advice.action.building].name;
        this.beginBuild(advice.action.building);
        this.buildMenu.show();
        this.showToast(`Mainframe: place the ${name} where it fits best`);
      } else {
        this.showToast("Mainframe: noted. It will be watching.");
      }
    } else {
      this.state.aiTrust = Math.max(0, this.state.aiTrust - 2);
      this.state.advisorSnooze = {
        id: advice.id,
        untilHour: this.nowHours() + snoozeDuration(),
      };
      this.showToast("Recommendation dismissed. The Mainframe recalculates.");
    }
    this.mainframe.refresh(this.mainframeReport(), this.state.aiTrust);
  }

  // ------------------------------------------------------------- inspector

  private updateInspector(): void {
    if (!this.state.selected) {
      this.inspector.hide();
      return;
    }

    const { gx, gy } = this.state.selected;
    const node = this.state.nodeAt(gx, gy);
    if (node) {
      this.inspector.show(this.nodeContent(node));
      return;
    }

    const building = this.state.buildingAt(gx, gy);
    if (building) {
      this.inspector.show(this.buildingContent(building));
      return;
    }

    this.inspector.show(this.tileContent(gx, gy));
  }

  private nodeContent(node: ResourceNode): InspectorContent {
    const def = NODES[node.kind];
    return {
      title: def.name,
      subtitle: "Resource Node",
      rows: [
        { label: "Tile", value: `${node.gx}, ${node.gy}` },
        { label: "Yields", value: def.resource, tone: "good" },
        { label: "Per gather", value: `${def.yieldPerGather}` },
        { label: "Remaining", value: `${node.remaining} / ${def.capacity}` },
      ],
      actions: [{ id: "gather", label: "Gather" }],
    };
  }

  private buildingContent(building: PlacedBuilding): InspectorContent {
    const def = BUILDINGS[building.id];
    const rows: InspectorRow[] = [
      { label: "Footprint", value: `${def.size.w} × ${def.size.h}` },
      { label: "Tile", value: `${building.gx}, ${building.gy}` },
    ];

    if (def.production) {
      for (const item of def.production) {
        rows.push({ label: `Produces ${item.resource}`, value: `+${item.perHour}/h`, tone: "good" });
      }
    }
    if (def.consumption) {
      for (const item of def.consumption) {
        rows.push({ label: `Uses ${item.resource}`, value: `${item.perHour}/h`, tone: "warn" });
      }
    }
    if (def.housing) rows.push({ label: "Housing", value: `${def.housing}` });

    if (building.plots.length === 0) {
      return { title: def.name, subtitle: "Structure", rows };
    }

    const planted = building.plots.filter((p) => p.crop).length;
    rows.push({ label: "Plots", value: `${planted} / ${building.plots.length}` });

    const plots = building.plots.map((plot, index) => {
      if (!plot.crop) {
        return {
          label: `Plot ${index + 1}`,
          detail: "Empty",
          tone: "default" as const,
          actions: [
            {
              id: "plant",
              label: `Plant ${CROPS[this.selectedSeed].name}`,
              payload: { uid: building.uid, plotIndex: index },
              disabled: !this.state.canAfford(CROPS[this.selectedSeed].seedCost),
            },
          ],
        };
      }

      const crop = CROPS[plot.crop];
      const stage = growthStage(plot.progress);
      const stageName = plot.ready ? "Ready" : ["Seedling", "Growing", "Ripening", "Mature"][stage];

      return {
        label: `Plot ${index + 1}`,
        detail: `${crop.name} · ${stageName} ${Math.round(plot.progress * 100)}% · water ${Math.round(plot.water * 100)}%`,
        tone: plot.ready ? ("good" as const) : plot.water <= 0.02 ? ("bad" as const) : ("default" as const),
        actions: plot.ready
          ? [
              {
                id: "harvest",
                label: "Harvest",
                payload: { uid: building.uid, plotIndex: index },
              },
            ]
          : [
              {
                id: "water",
                label: "Water",
                payload: { uid: building.uid, plotIndex: index },
                disabled: plot.water >= 0.99 || this.state.resources.water <= 0,
              },
            ],
      };
    });

    return {
      title: def.name,
      subtitle: "Farm",
      rows,
      seeds: CROP_IDS.map((id) => ({
        id,
        label: CROPS[id].name,
        active: id === this.selectedSeed,
      })),
      plots,
    };
  }

  private tileContent(gx: number, gy: number): InspectorContent {
    const type = this.world.typeAt(gx, gy);
    const height = this.world.heightAt(gx, gy);
    const buildable = this.world.isBuildable(gx, gy);

    return {
      title: terrainName(type),
      subtitle: "Terrain",
      rows: [
        { label: "Tile", value: `${gx}, ${gy}` },
        { label: "Elevation", value: `${height.toFixed(2)} m` },
        { label: "Buildable", value: buildable ? "Yes" : "No", tone: buildable ? "good" : "bad" },
      ],
    };
  }

  private showToast(text: string, duration = 1600): void {
    this.toast = { text, until: performance.now() + duration };
    this.hud.setToast(this.toast.text);
  }

  // ------------------------------------------------------------- persistence

  private async saveGame(): Promise<void> {
    const ok = await this.saves.save(buildSaveData(this.state, this.time.hour, this.time.day));
    this.showToast(ok ? "Colony saved" : "Saved in memory only");
  }

  private async loadGame(): Promise<void> {
    const data = await this.saves.load();
    if (!data) {
      this.showToast("No save found");
      return;
    }
    this.applySave(data);
    this.showToast("Colony restored");
  }

  private async newGame(): Promise<void> {
    await this.saves.clear();
    window.location.reload();
  }

  private applySave(data: SaveData): void {
    this.state.restore(data.state);
    this.time.hour = data.time.hour;
    this.time.day = data.time.day;
    this.time.update();

    this.pixiView?.syncFromState(this.world, this.state);

    this.cancelBuild();
    this.state.selected = null;
    this.pixiView?.clearSelected();
    this.inspector.hide();
  }

  private beginBuild(id: BuildingId): void {
    this.buildId = id;
    this.rotation = 0;
    this.buildMenu.setActive(id);
    this.state.selected = null;
    this.pixiView?.clearSelected();
  }

  private cancelBuild(): void {
    this.buildId = null;
    this.buildMenu.setActive(null);
  }

  private setSpeed(level: number): void {
    if (level === this.speedLevel) return;
    this.speedLevel = level;
    this.loop.setTimeScale(level);
  }

  private placeStarterSettlement(): void {
    this.placeStarter("shelter", 21, 21);
    this.placeStarter("farm", 26, 22);
    this.placeStarter("campfire", 24, 26);
  }

  private placeStarter(id: BuildingId, preferX: number, preferY: number): void {
    const grid = this.world.grid;
    for (let radius = 0; radius < 10; radius += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const gx = preferX + dx;
          const gy = preferY + dy;
          if (!grid.inBounds(gx, gy)) continue;
          if (!this.state.canPlace(id, gx, gy, 0)) continue;
          this.state.place(id, gx, gy, 0);
          return;
        }
      }
    }
  }

  /** Dev helper: place one of every building in a showcase grid near the center. */
  debugPlaceAll(): string[] {
    for (const key of Object.keys(this.state.resources) as ResourceKey[]) {
      this.state.resources[key] = 9999;
    }

    const grid = this.world.grid;
    const cx = Math.floor(grid.width / 2);
    const cy = Math.floor(grid.height / 2);
    const placedIds: string[] = [];

    BUILD_MENU.forEach((id, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const baseX = cx - 8 + col * 7;
      const baseY = cy - 7 + row * 7;

      for (let radius = 0; radius < 7; radius += 1) {
        let found = false;
        for (let dy = -radius; dy <= radius && !found; dy += 1) {
          for (let dx = -radius; dx <= radius; dx += 1) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
            const gx = baseX + dx;
            const gy = baseY + dy;
            if (!grid.inBounds(gx, gy)) continue;
            if (!this.state.canPlace(id, gx, gy, 0)) continue;
            this.state.place(id, gx, gy, 0);
            placedIds.push(`${id}@${gx},${gy}`);
            found = true;
            break;
          }
        }
        if (found) break;
      }
    });

    this.pixiView?.syncFromState(this.world, this.state);
    return placedIds;
  }

  private onResize = (): void => {
    this.view.resize(window.innerWidth, window.innerHeight);
  };
}
