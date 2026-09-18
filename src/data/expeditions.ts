import type { ResourceCost, ResourceKey } from "./buildings";

export type ExpeditionId = "data_center" | "hydro_vault" | "industrial_depot";

export interface ExpeditionLoot {
  resource: ResourceKey;
  amount: number;
}

export interface ExpeditionDefinition {
  id: ExpeditionId;
  name: string;
  description: string;
  /** 1 (milk run) .. 5 (meat grinder). Shown as a ◆ rating. */
  danger: number;
  /** One-way field time in game hours. */
  durationHours: number;
  /** Colonists that march out (unavailable while away). */
  teamSize: number;
  /** Rations paid up front. */
  cost: ResourceCost;
  /** Base loot on successful return. */
  loot: ExpeditionLoot[];
  /** Survivor recruits found on site. */
  recruits: number;
  flavor: string;
}

export const EXPEDITIONS: Record<ExpeditionId, ExpeditionDefinition> = {
  data_center: {
    id: "data_center",
    name: "Abandoned Data Center",
    description: "A drowned server farm humming on backup power. Racks of pre-collapse drives.",
    danger: 3,
    durationHours: 30,
    teamSize: 1,
    cost: { food: 20, water: 15 },
    loot: [
      { resource: "data", amount: 40 },
      { resource: "compute", amount: 25 },
    ],
    recruits: 0,
    flavor: "The team pries open a vault of humming racks, frost on the dead screens.",
  },
  hydro_vault: {
    id: "hydro_vault",
    name: "Overgrown Hydroponics Vault",
    description: "A seed vault swallowed by kudzu. Water tech and heirloom seed stock inside.",
    danger: 2,
    durationHours: 24,
    teamSize: 1,
    cost: { food: 15, water: 10 },
    loot: [
      { resource: "water", amount: 60 },
      { resource: "food", amount: 30 },
    ],
    recruits: 0,
    flavor: "Vines part to reveal condensation tanks still sweating clean water.",
  },
  industrial_depot: {
    id: "industrial_depot",
    name: "Ruined Industrial Depot",
    description: "A collapsed freight yard. Heavy scrap, pressed metal — and squatters.",
    danger: 4,
    durationHours: 40,
    teamSize: 2,
    cost: { food: 30, water: 20 },
    loot: [
      { resource: "scrap", amount: 70 },
      { resource: "metal", amount: 30 },
    ],
    recruits: 1,
    flavor: "Among the gantry wreckage, a squatter clan agrees to walk home with the team.",
  },
};

export const EXPEDITION_IDS: ExpeditionId[] = [
  "data_center",
  "hydro_vault",
  "industrial_depot",
];

/**
 * Deterministic 0..1 hash (integer math, no Math.random in sim).
 * Same inputs → same outputs, every run.
 */
export function expeditionHash(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = (h * 1274126177) | 0;
  h = (h ^ (h >> 16)) >>> 0;
  return h / 4294967295;
}

/** Loot variance multiplier 0.9–1.1, deterministic per expedition. */
export function lootVariance(dispatchIndex: number, lootIndex: number): number {
  return 0.9 + expeditionHash(dispatchIndex, lootIndex + 7) * 0.2;
}

/** True when the returning team took a beating (danger 3+ sites only). */
export function expeditionInjury(dispatchIndex: number, danger: number): boolean {
  if (danger < 3) return false;
  return expeditionHash(dispatchIndex, 99) < (danger - 2) * 0.12;
}
