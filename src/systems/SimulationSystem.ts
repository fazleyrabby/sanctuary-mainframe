import { BUILDINGS, type ResourceKey } from "../data/buildings";
import { CROPS } from "../data/crops";
import type { GameState } from "../state/GameState";

const FOOD_PER_PERSON_HOUR = 0.5;
const WATER_PER_PERSON_HOUR = 0.62;
const STARVATION_MORALE = 4.5;
const STARVATION_HEALTH = 1.6;
const MORALE_RECOVERY = 1.2;
const HEALTH_RECOVERY = 0.8;

const LOW_THRESHOLD: Partial<Record<ResourceKey, number>> = {
  food: 40,
  water: 35,
  energy: 12,
};

export class SimulationSystem {
  tick(state: GameState, hours: number): void {
    this.updateCrops(state, hours);
    this.updateIndustry(state, hours);
    this.updateColony(state, hours);
    this.updateRates(state);
  }

  private updateCrops(state: GameState, hours: number): void {
    for (const building of state.buildings) {
      for (const plot of building.plots) {
        if (!plot.crop || plot.ready) continue;
        const def = CROPS[plot.crop];

        if (plot.water > 0) {
          const consumed = Math.min(plot.water, def.waterPerHour * hours);
          plot.water -= consumed;
          plot.progress = Math.min(1, plot.progress + hours / def.growthHours);
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

  private updateColony(state: GameState, hours: number): void {
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
    if (state.resources.energy <= 0.5) warnings.push("Colony has no power");
    if (state.health < 55) warnings.push("Colonists are unwell");
    if (state.morale < 30) warnings.push("Morale is collapsing");

    state.warnings = warnings;
  }
}

function label(resource: ResourceKey): string {
  return resource.charAt(0).toUpperCase() + resource.slice(1);
}
