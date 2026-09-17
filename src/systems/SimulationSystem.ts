import { BUILDINGS, type ResourceKey } from "../data/buildings";
import { CROPS } from "../data/crops";
import type { GameState } from "../state/GameState";

const FOOD_PER_PERSON_HOUR = 0.5;
const WATER_PER_PERSON_HOUR = 0.62;
const STARVATION_MORALE = 4.5;
const STARVATION_HEALTH = 1.6;
const MORALE_RECOVERY = 1.2;
const HEALTH_RECOVERY = 0.8;
/** Cold dark nights wear on morale unless a campfire burns. */
const NIGHT_COLD_DRAIN = 1.6;
const CAMPFIRE_NIGHT_COMFORT = 2.2;
/** Too many bodies, too few beds. */
const OVERCROWD_DRAIN = 2.0;

const LOW_THRESHOLD: Partial<Record<ResourceKey, number>> = {
  food: 40,
  water: 35,
  energy: 12,
};

export interface SimContext {
  /** 0 (deep night) .. 1 (full day). */
  daylight: number;
}

export class SimulationSystem {
  tick(state: GameState, hours: number, ctx: SimContext): void {
    if (state.fallen) return;
    const isNight = ctx.daylight < 0.2;
    this.updateCrops(state, hours, ctx.daylight);
    this.updateIndustry(state, hours);
    this.updateColony(state, hours, isNight);
    this.updateRates(state);
  }

  private updateCrops(state: GameState, hours: number, daylight: number): void {
    // Plants rest at night: growth scales with light.
    const lightScale = 0.25 + 0.75 * daylight;
    for (const building of state.buildings) {
      for (const plot of building.plots) {
        if (!plot.crop || plot.ready) continue;
        const def = CROPS[plot.crop];

        if (plot.water > 0) {
          const consumed = Math.min(plot.water, def.waterPerHour * hours);
          plot.water -= consumed;
          plot.progress = Math.min(1, plot.progress + (hours / def.growthHours) * lightScale);
          if (plot.progress >= 1) plot.ready = true;
        }
      }
    }
  }

  private updateIndustry(state: GameState, hours: number): void {
    const need = new Map<ResourceKey, number>();

    for (const building of state.buildings) {
      const def = BUILDINGS[building.id];
      for (const item of def.consumption ?? []) {
        need.set(item.resource, (need.get(item.resource) ?? 0) + item.perHour * hours);
      }
    }

    const scaleFor = new Map<ResourceKey, number>();
    for (const [resource, amount] of need) {
      if (amount <= 0) {
        scaleFor.set(resource, 1);
        continue;
      }
      scaleFor.set(resource, Math.min(1, state.resources[resource] / amount));
    }

    for (const building of state.buildings) {
      const def = BUILDINGS[building.id];
      if (!def.production && !def.consumption) continue;

      let scale = 1;
      for (const item of def.consumption ?? []) {
        scale = Math.min(scale, scaleFor.get(item.resource) ?? 1);
      }
      if (scale <= 0) continue;

      for (const item of def.consumption ?? []) {
        state.resources[item.resource] = Math.max(
          0,
          state.resources[item.resource] - item.perHour * hours * scale,
        );
      }
      for (const item of def.production ?? []) {
        state.add(item.resource, item.perHour * hours * scale);
      }
    }
  }

  private updateColony(state: GameState, hours: number, isNight: boolean): void {
    const foodUse = state.population * FOOD_PER_PERSON_HOUR * hours;
    const waterUse = state.population * WATER_PER_PERSON_HOUR * hours;

    const foodShort = state.resources.food < foodUse;
    const waterShort = state.resources.water < waterUse;

    state.resources.food = Math.max(0, state.resources.food - foodUse);
    state.resources.water = Math.max(0, state.resources.water - waterUse);

    const starving = foodShort || waterShort;
    if (starving) {
      state.morale = Math.max(0, state.morale - STARVATION_MORALE * hours);
      state.health = Math.max(0, state.health - STARVATION_HEALTH * hours);
    } else {
      state.morale = Math.min(100, state.morale + MORALE_RECOVERY * hours);
      state.health = Math.min(100, state.health + HEALTH_RECOVERY * hours);
    }

    // Night: cold dread, unless the campfire burns.
    if (isNight && state.population > 0) {
      const hasFire = state.buildings.some((b) => b.id === "campfire");
      if (hasFire) {
        state.morale = Math.min(100, state.morale + CAMPFIRE_NIGHT_COMFORT * hours);
      } else {
        state.morale = Math.max(0, state.morale - NIGHT_COLD_DRAIN * hours);
      }
    }

    // Overcrowding: more mouths than beds.
    if (state.population > state.housing) {
      state.morale = Math.max(0, state.morale - OVERCROWD_DRAIN * hours);
    }

    // Death: health hitting zero costs a colonist, once per crossing.
    if (state.health <= 0 && state.population > 0) {
      state.population -= 1;
      state.health = 55;
      state.morale = Math.max(0, state.morale - 15);
      state.aiTrust = Math.max(0, state.aiTrust - 5);
      if (state.population <= 0) {
        state.population = 0;
        state.fallen = true;
        state.notices.push("The last colonist has died. The colony has fallen — start a New game.");
      } else {
        state.notices.push("A colonist has died of deprivation. Bury them and feed the rest.");
      }
    }
  }

  private updateRates(state: GameState): void {
    const rates: Record<ResourceKey, number> = {
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

    for (const building of state.buildings) {
      const def = BUILDINGS[building.id];
      for (const item of def.production ?? []) rates[item.resource] += item.perHour;
      for (const item of def.consumption ?? []) rates[item.resource] -= item.perHour;
    }

    rates.food -= state.population * FOOD_PER_PERSON_HOUR;
    rates.water -= state.population * WATER_PER_PERSON_HOUR;

    state.rates = rates;

    const warnings: string[] = [];
    if (state.fallen) {
      warnings.push("The colony has fallen — start a New game");
      state.warnings = warnings;
      return;
    }
    for (const [resource, threshold] of Object.entries(LOW_THRESHOLD) as Array<
      [ResourceKey, number]
    >) {
      const value = state.resources[resource];
      if (value <= threshold * 0.35) {
        warnings.push(`${label(resource)} critically low`);
      } else if (value <= threshold) {
        warnings.push(`${label(resource)} reserves low`);
      }
    }
    // Runway: burning reserves with a negative rate gets a countdown.
    for (const key of ["food", "water"] as const) {
      const rate = rates[key];
      if (rate < -0.05) {
        const hoursLeft = state.resources[key] / -rate;
        if (hoursLeft < 24) {
          warnings.push(
            `${label(key)} runs out in ~${Math.max(1, Math.round(hoursLeft))}h — grow or gather now`,
          );
        }
      }
    }
    if (state.population > state.housing) {
      warnings.push(`Not enough shelter — ${state.population} souls, ${state.housing} beds`);
    }
    if (state.resources.energy <= 0.5) warnings.push("Colony has no power");
    if (state.health < 55) warnings.push("Colonists are unwell");
    if (state.morale < 30) warnings.push("Morale is collapsing");

    state.warnings = warnings;
  }
}

function label(resource: ResourceKey): string {
  return resource.charAt(0).toUpperCase() + resource.slice(1);
}
