export type BuildingId =
  | "shelter"
  | "farm"
  | "storage"
  | "waterCollector"
  | "campfire"
  | "workshop"
  | "generator"
  | "serverRoom"
  | "aiCore"
  | "watchtower"
  | "crossbowTower";

export type ResourceKey =
  | "food"
  | "water"
  | "energy"
  | "wood"
  | "stone"
  | "scrap"
  | "metal"
  | "data"
  | "compute";

export type ResourceCost = Partial<Record<ResourceKey, number>>;

export interface ResourceRate {
  resource: ResourceKey;
  perHour: number;
}

export interface BuildingDefinition {
  id: BuildingId;
  name: string;
  description: string;
  size: { w: number; h: number };
  cost: ResourceCost;
  produces?: string;
  requiresFlatGround: boolean;
  production?: ResourceRate[];
  consumption?: ResourceRate[];
  housing?: number;
  plots?: number;
}

export const BUILDINGS: Record<BuildingId, BuildingDefinition> = {
  shelter: {
    id: "shelter",
    name: "Shelter",
    description: "A place to sleep. Protects survivors from the elements.",
    size: { w: 3, h: 3 },
    cost: { wood: 30, scrap: 10 },
    requiresFlatGround: true,
    housing: 4,
  },
  farm: {
    id: "farm",
    name: "Farm",
    description: "Grows food. Needs water and a worker.",
    size: { w: 3, h: 3 },
    cost: { wood: 15, scrap: 5 },
    produces: "Food",
    requiresFlatGround: true,
    plots: 4,
  },
  storage: {
    id: "storage",
    name: "Storage",
    description: "Increases resource capacity.",
    size: { w: 2, h: 2 },
    cost: { wood: 20, scrap: 15 },
    requiresFlatGround: true,
  },
  waterCollector: {
    id: "waterCollector",
    name: "Water Collector",
    description: "Condenses moisture from the air into clean water.",
    size: { w: 2, h: 2 },
    cost: { scrap: 20, stone: 10 },
    produces: "Water",
    requiresFlatGround: true,
    production: [{ resource: "water", perHour: 2.6 }],
    consumption: [{ resource: "energy", perHour: 0.8 }],
  },
  campfire: {
    id: "campfire",
    name: "Campfire",
    description: "Warmth and light. Raises nearby morale at night.",
    size: { w: 1, h: 1 },
    cost: { wood: 10, stone: 5 },
    requiresFlatGround: false,
  },
  workshop: {
    id: "workshop",
    name: "Workshop",
    description: "Crafts tools and processes scrap into metal.",
    size: { w: 2, h: 2 },
    cost: { wood: 40, scrap: 30 },
    produces: "Metal",
    requiresFlatGround: true,
    production: [{ resource: "metal", perHour: 1.4 }],
    consumption: [
      { resource: "scrap", perHour: 2.8 },
      { resource: "energy", perHour: 1.6 },
    ],
  },
  generator: {
    id: "generator",
    name: "Generator",
    description: "Burns fuel to produce energy for the colony.",
    size: { w: 2, h: 2 },
    cost: { scrap: 45, metal: 20 },
    produces: "Energy",
    requiresFlatGround: true,
    production: [{ resource: "energy", perHour: 9 }],
    consumption: [{ resource: "scrap", perHour: 0.6 }],
  },
  serverRoom: {
    id: "serverRoom",
    name: "Server Room",
    description: "Racks of recovered machines. Generates Data and Compute.",
    size: { w: 3, h: 3 },
    cost: { metal: 60, scrap: 40, energy: 25 },
    produces: "Data, Compute",
    requiresFlatGround: true,
    production: [
      { resource: "data", perHour: 3.2 },
      { resource: "compute", perHour: 2.4 },
    ],
    consumption: [{ resource: "energy", perHour: 4.5 }],
  },
  aiCore: {
    id: "aiCore",
    name: "AI Core",
    description: "Housing for the Sanctuary Mainframe. Expands its capabilities.",
    size: { w: 3, h: 3 },
    cost: { metal: 120, data: 40, energy: 60 },
    produces: "Compute",
    requiresFlatGround: true,
    production: [{ resource: "compute", perHour: 7 }],
    consumption: [{ resource: "energy", perHour: 6 }],
  },
  watchtower: {
    id: "watchtower",
    name: "Watchtower",
    description: "A tall timber post. Spots dust-wolves and raiders while they are still distant.",
    size: { w: 2, h: 2 },
    cost: { wood: 40, stone: 20 },
    requiresFlatGround: true,
  },
  crossbowTower: {
    id: "crossbowTower",
    name: "Crossbow Tower",
    description: "A winched steel bow that drives off beasts and raiders. Drinks energy to stay spanned.",
    size: { w: 2, h: 2 },
    cost: { metal: 40, scrap: 30 },
    requiresFlatGround: true,
    consumption: [{ resource: "energy", perHour: 2 }],
  },
};

export const BUILD_MENU: BuildingId[] = [
  "shelter",
  "farm",
  "waterCollector",
  "storage",
  "campfire",
  "workshop",
  "generator",
  "watchtower",
  "crossbowTower",
  "serverRoom",
  "aiCore",
];

export function formatCost(cost: ResourceCost): string {
  return Object.entries(cost)
    .map(([key, value]) => `${value} ${key}`)
    .join("  ");
}
