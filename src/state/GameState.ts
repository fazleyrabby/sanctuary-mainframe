import {
  BUILDINGS,
  type BuildingId,
  type ResourceCost,
  type ResourceKey,
} from "../data/buildings";
import { CROPS, type CropId } from "../data/crops";
import { NODES, type NodeKind } from "../data/resources";
import type { TechDefinition, TechId } from "../data/research";
import type { ExpeditionId } from "../data/expeditions";
import { EXPEDITIONS } from "../data/expeditions";
import { EVENTS } from "../data/events";
import { AI_LEVELS, MAX_AI_LEVEL } from "../data/aiLevels";
import { Rng } from "../core/Rng";
import { TerrainType, type World } from "../world/World";

export interface Plot {
  crop: CropId | null;
  progress: number;
  water: number;
  ready: boolean;
}

export interface PlacedBuilding {
  uid: number;
  id: BuildingId;
  gx: number;
  gy: number;
  rotation: number;
  plots: Plot[];
}

export interface ResourceNode {
  uid: number;
  kind: NodeKind;
  gx: number;
  gy: number;
  remaining: number;
}

export interface TileRef {
  gx: number;
  gy: number;
}

export interface ActiveResearch {
  id: TechId;
  progressHours: number;
}

export interface ActiveExpedition {
  siteId: ExpeditionId;
  progressHours: number;
  teamSize: number;
  /** Monotonic counter feeding deterministic loot/injury rolls. */
  dispatchIndex: number;
}

export interface SerializedState {
  resources: Record<ResourceKey, number>;
  buildings: PlacedBuilding[];
  nodes: ResourceNode[];
  population: number;
  morale: number;
  health: number;
  fallen: boolean;
  aiTrust: number;
  advisorSnooze: { id: string; untilHour: number } | null;
  researched: TechId[];
  activeResearch: ActiveResearch | null;
  expeditions: ActiveExpedition[];
  expeditionCount: number;
  activeEventId: string | null;
  eventsSeen: string[];
  eventCount: number;
  lastEventHour: number;
  aiLevel: number;
  aiPolicy: { autoPlant: boolean; autoHarvest: boolean };
  nextUid: number;
  occupancy: Array<[string, number]>;
}

const BASE_CAPACITY = 400;
const CAPACITY_PER_STORAGE = 250;

function zeroed(): Record<ResourceKey, number> {
  return {
    food: 0,
    water: 0,
    energy: 0,
    wood: 0,
    stone: 0,
    scrap: 0,
    metal: 0,
    data: 0,
    compute: 0,
  };
}

export class GameState {
  resources: Record<ResourceKey, number> = {
    food: 120,
    water: 80,
    energy: 40,
    wood: 120,
    stone: 40,
    scrap: 90,
    metal: 0,
    data: 0,
    compute: 0,
  };

  rates: Record<ResourceKey, number> = zeroed();

  buildings: PlacedBuilding[] = [];
  nodes: ResourceNode[] = [];
  selected: TileRef | null = null;

  population = 3;
  morale = 72;
  health = 100;
  warnings: string[] = [];
  /** One-shot event messages for the HUD (deaths, milestones). Drained by Game. */
  notices: string[] = [];
  /** True once every colonist is gone. Sandbox continues; warnings say to start over. */
  fallen = false;
  /** 0–100. Rises when the Mainframe's advice is accepted, falls on dismissals and deaths. */
  aiTrust = 50;
  /** Capability level 0–6 (PRD §24). Ascended by the player in the Mainframe panel. */
  aiLevel = 0;
  /** Delegated farm policies (Strategic AI, level 5+). */
  aiPolicy = { autoPlant: true, autoHarvest: true };
  /** Dismissed advice stays quiet for a few game-hours. */
  advisorSnooze: { id: string; untilHour: number } | null = null;
  /** Researched technologies unlocking permanent colony perks. */
  researched: TechId[] = [];
  /** Active research project in progress. */
  activeResearch: ActiveResearch | null = null;
  /** Expedition teams currently in the field. */
  expeditions: ActiveExpedition[] = [];
  expeditionCount = 0;
  /** Fired event awaiting a player decision (persisted across reloads). */
  activeEventId: string | null = null;
  /** Once-only events already resolved. */
  eventsSeen: string[] = [];
  eventCount = 0;
  lastEventHour = 0;

  private occupancy = new Map<string, number>();
  private nextUid = 1;

  constructor(private readonly world: World) {}

  get capacity(): number {
    const stores = this.buildings.filter((b) => b.id === "storage").length;
    return BASE_CAPACITY + stores * CAPACITY_PER_STORAGE;
  }

  /** Total shelter beds across all housing buildings. */
  get housing(): number {
    let beds = 0;
    for (const b of this.buildings) {
      beds += BUILDINGS[b.id].housing ?? 0;
    }
    return beds;
  }

  canAfford(cost: ResourceCost): boolean {
    return Object.entries(cost).every(
      ([key, value]) => this.resources[key as ResourceKey] >= (value ?? 0),
    );
  }

  pay(cost: ResourceCost): void {
    for (const [key, value] of Object.entries(cost)) {
      this.resources[key as ResourceKey] -= value ?? 0;
    }
  }

  add(resource: ResourceKey, amount: number): number {
    const before = this.resources[resource];
    this.resources[resource] = Math.min(this.capacity, before + amount);
    return this.resources[resource] - before;
  }

  isOccupied(gx: number, gy: number): boolean {
    return this.occupancy.has(`${gx},${gy}`);
  }

  canPlace(id: BuildingId, gx: number, gy: number, rotation: number): boolean {
    const def = BUILDINGS[id];
    const size = rotation % 2 === 0 ? def.size : { w: def.size.h, h: def.size.w };

    if (!this.canAfford(def.cost)) return false;

    for (let dy = 0; dy < size.h; dy += 1) {
      for (let dx = 0; dx < size.w; dx += 1) {
        const tx = gx + dx;
        const ty = gy + dy;
        if (!this.world.grid.inBounds(tx, ty)) return false;
        if (this.isOccupied(tx, ty)) return false;
        const type = this.world.typeAt(tx, ty);
        if (type === TerrainType.Water) return false;
        if (type === TerrainType.Stone && def.requiresFlatGround) return false;
      }
    }
    return true;
  }

  place(id: BuildingId, gx: number, gy: number, rotation: number): PlacedBuilding {
    const def = BUILDINGS[id];
    const size = rotation % 2 === 0 ? def.size : { w: def.size.h, h: def.size.w };

    const building: PlacedBuilding = {
      uid: this.nextUid,
      id,
      gx,
      gy,
      rotation,
      plots: [],
    };
    this.nextUid += 1;

    for (let i = 0; i < (def.plots ?? 0); i += 1) {
      building.plots.push({ crop: null, progress: 0, water: 0, ready: false });
    }

    this.buildings.push(building);

    for (let dy = 0; dy < size.h; dy += 1) {
      for (let dx = 0; dx < size.w; dx += 1) {
        this.occupancy.set(`${gx + dx},${gy + dy}`, building.uid);
      }
    }

    this.pay(def.cost);
    return building;
  }

  /** Dismantle a building, freeing occupancy and refunding 50% of construction cost. */
  removeBuilding(building: PlacedBuilding): Record<string, number> {
    const def = BUILDINGS[building.id];
    const size = building.rotation % 2 === 0 ? def.size : { w: def.size.h, h: def.size.w };

    // Free grid occupancy
    for (let dy = 0; dy < size.h; dy += 1) {
      for (let dx = 0; dx < size.w; dx += 1) {
        this.occupancy.delete(`${building.gx + dx},${building.gy + dy}`);
      }
    }

    // Remove from placed buildings
    this.buildings = this.buildings.filter((b) => b.uid !== building.uid);

    // 50% salvage refund (rounded up to nearest integer)
    const refund: Record<string, number> = {};
    for (const [key, cost] of Object.entries(def.cost)) {
      if (cost && cost > 0) {
        const amount = Math.ceil(cost * 0.5);
        this.add(key as ResourceKey, amount);
        refund[key] = amount;
      }
    }

    return refund;
  }

  buildingAt(gx: number, gy: number): PlacedBuilding | null {
    const uid = this.occupancy.get(`${gx},${gy}`);
    if (uid === undefined) return null;
    return this.buildings.find((b) => b.uid === uid) ?? null;
  }

  nodeAt(gx: number, gy: number): ResourceNode | null {
    return this.nodes.find((n) => n.gx === gx && n.gy === gy) ?? null;
  }

  gather(node: ResourceNode): { resource: ResourceKey; amount: number } | null {
    const def = NODES[node.kind];
    const amount = Math.min(def.yieldPerGather, node.remaining);
    if (amount <= 0) return null;

    const gained = this.add(def.resource, amount);
    node.remaining -= amount;
    if (node.remaining <= 0) {
      this.nodes = this.nodes.filter((n) => n.uid !== node.uid);
    }
    return { resource: def.resource, amount: gained };
  }

  plant(building: PlacedBuilding, plotIndex: number, crop: CropId): boolean {
    const plot = building.plots[plotIndex];
    if (!plot || plot.crop) return false;
    const def = CROPS[crop];
    if (!this.canAfford(def.seedCost)) return false;
    this.pay(def.seedCost);
    plot.crop = crop;
    plot.progress = 0;
    plot.water = 0.35;
    plot.ready = false;
    return true;
  }

  waterPlot(building: PlacedBuilding, plotIndex: number, amount = 0.6): boolean {
    const plot = building.plots[plotIndex];
    if (!plot) return false;
    if (this.resources.water <= 0) return false;
    const applied = Math.min(amount, this.resources.water, 1 - plot.water);
    if (applied <= 0) return false;
    this.resources.water -= applied;
    plot.water = Math.min(1, plot.water + applied);
    return true;
  }

  harvest(building: PlacedBuilding, plotIndex: number): number {
    const plot = building.plots[plotIndex];
    if (!plot || !plot.crop || !plot.ready) return 0;
    const gained = this.add("food", CROPS[plot.crop].yieldFood);
    plot.crop = null;
    plot.progress = 0;
    plot.water = 0;
    plot.ready = false;
    return gained;
  }

  isResearched(id: TechId): boolean {
    return this.researched.includes(id);
  }

  countBuildings(id: BuildingId): number {
    return this.buildings.filter((b) => b.id === id).length;
  }

  /** Next capability level definition, or null at the cap. */
  nextAiLevel(): (typeof AI_LEVELS)[number] | null {
    if (this.aiLevel >= MAX_AI_LEVEL) return null;
    return AI_LEVELS[this.aiLevel + 1] ?? null;
  }

  /** True when every ascension requirement for the next level holds. */
  canAscend(day: number): boolean {
    const def = this.nextAiLevel();
    if (!def) return false;
    const r = def.requires;
    if (r.serverRooms && this.countBuildings("serverRoom") < r.serverRooms) return false;
    if (r.aiCores && this.countBuildings("aiCore") < r.aiCores) return false;
    if (r.dataStockpile && this.resources.data < r.dataStockpile) return false;
    if (r.tech && !this.isResearched(r.tech as TechId)) return false;
    if (r.trust && this.aiTrust < r.trust) return false;
    if (r.day && day < r.day) return false;
    return true;
  }

  /** Claim the next level. Returns its name, or null when locked. */
  ascendMainframe(day: number): string | null {
    const def = this.nextAiLevel();
    if (!def || !this.canAscend(day)) return null;
    this.aiLevel = def.level;
    this.aiTrust = Math.min(100, this.aiTrust + 5);
    this.notices.push(
      `MAINFRAME ASCENDED — Level ${def.level}: ${def.name}. ${def.description}`,
    );
    return def.name;
  }

  /** Colonists not currently out on expedition. At least one must stay home. */
  availableWorkers(): number {
    const away = this.expeditions.reduce((n, e) => n + e.teamSize, 0);
    return this.population - away;
  }

  canDispatch(siteId: ExpeditionId): boolean {
    const def = EXPEDITIONS[siteId];
    if (this.expeditions.some((e) => e.siteId === siteId)) return false;
    if (this.availableWorkers() - def.teamSize < 1) return false;
    return this.canAfford(def.cost);
  }

  dispatchExpedition(siteId: ExpeditionId): boolean {
    if (!this.canDispatch(siteId)) return false;
    const def = EXPEDITIONS[siteId];
    this.pay(def.cost);
    this.expeditions.push({
      siteId,
      progressHours: 0,
      teamSize: def.teamSize,
      dispatchIndex: this.expeditionCount,
    });
    this.expeditionCount += 1;
    return true;
  }

  /**
   * Resolve a fired event option. Returns the outcome narrative,
   * or null when costs can't be paid (button should have been disabled).
   */
  applyEventOption(eventId: string, optionId: string): string | null {
    const event = EVENTS[eventId];
    const option = event?.options.find((o) => o.id === optionId);
    if (!event || !option) return null;
    for (const c of option.cost ?? []) {
      if (this.resources[c.resource] < c.amount) return null;
    }
    for (const c of option.cost ?? []) {
      this.resources[c.resource] = Math.max(0, this.resources[c.resource] - c.amount);
    }
    for (const g of option.gains ?? []) {
      this.add(g.resource, g.amount);
    }
    if (option.morale) {
      this.morale = Math.min(100, Math.max(0, this.morale + option.morale));
    }
    if (option.health) {
      this.health = Math.min(100, Math.max(0, this.health + option.health));
    }
    if (option.trust) {
      this.aiTrust = Math.min(100, Math.max(0, this.aiTrust + option.trust));
    }
    if (option.population) {
      // Events never kill: the wastes take, starvation takes lives.
      this.population = Math.max(1, this.population + option.population);
    }
    if (option.cropProgress) {
      for (const b of this.buildings) {
        for (const p of b.plots) {
          if (p.crop && !p.ready) {
            p.progress = Math.min(1, Math.max(0, p.progress + option.cropProgress));
          }
        }
      }
    }
    this.eventsSeen.push(eventId);
    if (this.activeEventId === eventId) this.activeEventId = null;
    return option.result;
  }

  startResearch(tech: TechDefinition): boolean {
    if (this.isResearched(tech.id)) return false;
    if (this.activeResearch && this.activeResearch.id === tech.id) return false;
    // Check prerequisites
    const prereqsMet = tech.prerequisites.every((p) => this.isResearched(p));
    if (!prereqsMet) return false;
    if (!this.canAfford(tech.cost)) return false;

    this.pay(tech.cost);
    this.activeResearch = { id: tech.id, progressHours: 0 };
    return true;
  }

  serialize(): SerializedState {
    return {
      resources: { ...this.resources },
      buildings: this.buildings.map((b) => ({ ...b, plots: b.plots.map((p) => ({ ...p })) })),
      nodes: this.nodes.map((n) => ({ ...n })),
      population: this.population,
      morale: this.morale,
      health: this.health,
      fallen: this.fallen,
      aiTrust: this.aiTrust,
      advisorSnooze: this.advisorSnooze ? { ...this.advisorSnooze } : null,
      researched: [...this.researched],
      activeResearch: this.activeResearch ? { ...this.activeResearch } : null,
      expeditions: this.expeditions.map((e) => ({ ...e })),
      expeditionCount: this.expeditionCount,
      activeEventId: this.activeEventId,
      eventsSeen: [...this.eventsSeen],
      eventCount: this.eventCount,
      lastEventHour: this.lastEventHour,
      aiLevel: this.aiLevel,
      aiPolicy: { ...this.aiPolicy },
      nextUid: this.nextUid,
      occupancy: [...this.occupancy.entries()],
    };
  }

  restore(data: SerializedState): void {
    this.resources = { ...data.resources };
    this.buildings = data.buildings.map((b) => ({ ...b, plots: b.plots.map((p) => ({ ...p })) }));
    this.nodes = data.nodes.map((n) => ({ ...n }));
    this.population = data.population;
    this.morale = data.morale;
    this.health = data.health;
    this.fallen = data.fallen ?? false;
    this.aiTrust = data.aiTrust ?? 50;
    this.advisorSnooze = data.advisorSnooze ? { ...data.advisorSnooze } : null;
    this.researched = data.researched ? [...data.researched] : [];
    this.activeResearch = data.activeResearch ? { ...data.activeResearch } : null;
    this.expeditions = data.expeditions ? data.expeditions.map((e) => ({ ...e })) : [];
    this.expeditionCount = data.expeditionCount ?? 0;
    this.activeEventId = data.activeEventId ?? null;
    this.eventsSeen = data.eventsSeen ? [...data.eventsSeen] : [];
    this.eventCount = data.eventCount ?? 0;
    this.lastEventHour = data.lastEventHour ?? 0;
    this.aiLevel = data.aiLevel ?? 0;
    this.aiPolicy = data.aiPolicy ? { ...data.aiPolicy } : { autoPlant: true, autoHarvest: true };
    this.nextUid = data.nextUid;
    this.occupancy = new Map(data.occupancy);
    this.rates = zeroed();
    this.selected = null;
    this.warnings = [];
    this.notices = [];
  }

  populateNodes(): void {
    const rng = new Rng(this.world.seed + 777);
    const taken = new Set<string>();

    const chance: Record<TerrainType, Partial<Record<NodeKind, number>>> = {
      [TerrainType.Grass]: { wood: 0.05, scrap: 0.015 },
      [TerrainType.GrassDry]: { wood: 0.045, scrap: 0.02 },
      [TerrainType.Dirt]: { scrap: 0.05, stone: 0.03 },
      [TerrainType.Stone]: { stone: 0.11, scrap: 0.03 },
      [TerrainType.Sand]: { stone: 0.03 },
      [TerrainType.Water]: {},
    };

    for (let gy = 2; gy < this.world.height - 2; gy += 1) {
      for (let gx = 2; gx < this.world.width - 2; gx += 1) {
        const cx = gx - this.world.width / 2;
        const cy = gy - this.world.height / 2;
        if (Math.hypot(cx, cy) < 6) continue;

        const type = this.world.typeAt(gx, gy);
        const rules = chance[type];
        if (!rules) continue;

        for (const kind of Object.keys(rules) as NodeKind[]) {
          const probability = rules[kind] ?? 0;
          if (!rng.chance(probability)) continue;

          let blocked = false;
          for (let dy = -2; dy <= 2 && !blocked; dy += 1) {
            for (let dx = -2; dx <= 2; dx += 1) {
              if (taken.has(`${gx + dx},${gy + dy}`)) {
                blocked = true;
                break;
              }
            }
          }
          if (blocked || this.isOccupied(gx, gy)) continue;

          const def = NODES[kind];
          this.nodes.push({
            uid: this.nextUid++,
            kind,
            gx,
            gy,
            remaining: def.capacity,
          });
          taken.add(`${gx},${gy}`);
          break;
        }
      }
    }
  }
}
