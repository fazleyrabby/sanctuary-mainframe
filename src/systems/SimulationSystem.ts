import { BUILDINGS, type ResourceKey } from "../data/buildings";
import { CROPS } from "../data/crops";
import { TECHNOLOGIES } from "../data/research";
import {
  EXPEDITIONS,
  expeditionHash,
  expeditionInjury,
  lootVariance,
} from "../data/expeditions";
import { EVENT_IDS, EVENTS } from "../data/events";
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
  /** Absolute game clock in hours (day * 24 + hour). */
  nowHours: number;
}

export class SimulationSystem {
  tick(state: GameState, hours: number, ctx: SimContext): void {
    if (state.fallen) return;
    const isNight = ctx.daylight < 0.2;
    this.updateResearch(state, hours);
    this.updateExpeditions(state, hours);
    this.updateEvents(state, ctx.nowHours);
    this.updateCrops(state, hours, ctx.daylight);
    this.updateIndustry(state, hours);
    this.updateColony(state, hours, isNight);
    this.updateRates(state);
  }

  private updateResearch(state: GameState, hours: number): void {
    if (!state.activeResearch) return;
    const tech = TECHNOLOGIES[state.activeResearch.id];
    if (!tech) {
      state.activeResearch = null;
      return;
    }

    // Compute surplus bonus accelerates research speed (up to +50% speed)
    const computeBonus = state.resources.compute > 20 ? 1.25 : 1.0;
    state.activeResearch.progressHours += hours * computeBonus;

    if (state.activeResearch.progressHours >= tech.researchHours) {
      state.researched.push(tech.id);
      state.activeResearch = null;
      state.notices.push(`Research Complete: ${tech.name}! ${tech.perkSummary}`);
    }
  }

  private updateExpeditions(state: GameState, hours: number): void {
    if (state.expeditions.length === 0) return;
    const finished: typeof state.expeditions = [];
    for (const exp of state.expeditions) {
      exp.progressHours += hours;
      const def = EXPEDITIONS[exp.siteId];
      if (!def || exp.progressHours < def.durationHours) continue;
      finished.push(exp);

      // Deposit loot with deterministic variance.
      const hauls = def.loot.map((item, i) => {
        const gained = state.add(
          item.resource,
          Math.round(item.amount * lootVariance(exp.dispatchIndex, i)),
        );
        return `+${gained} ${item.resource}`;
      });

      let tail = `${def.flavor} Haul: ${hauls.join(", ")}.`;
      if (def.recruits > 0) {
        state.population += def.recruits;
        tail += ` ${def.recruits} survivor${def.recruits > 1 ? "s join" : " joins"} the colony!`;
      }
      if (expeditionInjury(exp.dispatchIndex, def.danger)) {
        state.health = Math.max(0, state.health - 12);
        state.morale = Math.max(0, state.morale - 5);
        tail += ` The team took a beating getting out — tend the wounded.`;
      } else {
        state.morale = Math.min(100, state.morale + 4);
      }
      state.notices.push(`Expedition returned: ${def.name}. ${tail}`);
    }
    if (finished.length > 0) {
      const done = new Set(finished);
      state.expeditions = state.expeditions.filter((e) => !done.has(e));
    }
  }

  /**
   * Event director: every ~26–40 game-hours (deterministic), fire one
   * eligible event. Pure function of play history — no RNG.
   */
  private updateEvents(state: GameState, nowHours: number): void {
    if (state.activeEventId) return;
    const interval = 26 + expeditionHash(state.eventCount, 3) * 14;
    if (nowHours - state.lastEventHour < interval) return;

    const day = Math.floor(nowHours / 24) + 1;
    const eligible = EVENT_IDS.map((id) => EVENTS[id]).filter((e) => {
      if (!e) return false;
      if (e.once && state.eventsSeen.includes(e.id)) return false;
      if (e.minDay && day < e.minDay) return false;
      if (e.requiresPop && state.population < e.requiresPop) return false;
      if (e.requiresBuilding &&
        !state.buildings.some((b) => b.id === e.requiresBuilding)
      ) {
        return false;
      }
      if (e.requiresAILevel && state.aiLevel < e.requiresAILevel) return false;
      return true;
    });

    state.lastEventHour = nowHours;
    if (eligible.length === 0) return;
    const pick = eligible[Math.floor(expeditionHash(state.eventCount, day) * eligible.length)];
    if (!pick) return;
    state.activeEventId = pick.id;
    state.eventCount += 1;
    state.notices.push(
      pick.mainframe ? "MAINFRAME requests a decision." : "Something demands your attention.",
    );
  }

  private updateCrops(state: GameState, hours: number, daylight: number): void {
    // Plants rest at night: growth scales with light.
    // Bio-Agronomy perk: +25% crop growth speed
    const agriBonus = state.isResearched("bio_agronomy") ? 1.25 : 1.0;
    const lightScale = (0.25 + 0.75 * daylight) * agriBonus;
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
    // Automation (L3+): the Mainframe waters thirsty fields, keeping a reserve.
    if (state.aiLevel >= 3) {
      for (const building of state.buildings) {
        for (const plot of building.plots) {
          if (!plot.crop || plot.ready || plot.water > 0.05) continue;
          if (state.resources.water <= 25) return;
          const applied = Math.min(0.6, state.resources.water - 25, 1 - plot.water);
          if (applied <= 0) continue;
          state.resources.water -= applied;
          plot.water = Math.min(1, plot.water + applied);
        }
      }
    }
    // Strategic autonomy (L5+): self-harvesting, self-planting fields.
    if (state.aiLevel >= 5) {
      for (const building of state.buildings) {
        if (building.plots.length === 0) continue;
        for (const plot of building.plots) {
          if (plot.ready && state.aiPolicy.autoHarvest) {
            state.add("food", CROPS[plot.crop ?? "wheat"].yieldFood);
            plot.crop = null;
            plot.progress = 0;
            plot.water = 0;
            plot.ready = false;
          }
          if (!plot.crop && state.aiPolicy.autoPlant) {
            const seed = CROPS.wheat;
            if (state.canAfford(seed.seedCost)) {
              state.pay(seed.seedCost);
              plot.crop = "wheat";
              plot.progress = 0;
              plot.water = 0.35;
              plot.ready = false;
            }
          }
        }
      }
    }
  }

  private updateIndustry(state: GameState, hours: number): void {
    const hasHydro = state.isResearched("hydro_recycling");
    const hasCompactor = state.isResearched("scrap_compactor");
    const hasSubNeural = state.isResearched("sub_neural_algorithms");

    const need = new Map<ResourceKey, number>();
    for (const building of state.buildings) {
      const def = BUILDINGS[building.id];
      for (const item of def.consumption ?? []) {
        let perHour = item.perHour;
        if (hasHydro && building.id === "waterCollector" && item.resource === "energy") {
          perHour *= 0.8;
        }
        need.set(item.resource, (need.get(item.resource) ?? 0) + perHour * hours);
      }
    }

    const scaleFor = new Map<ResourceKey, number>();
    for (const [resource, amount] of need) {
      if (amount <= 0) {
        scaleFor.set(resource, 1);
        continue;
      }
      scaleFor.set(resource, Math.min(1, (state.resources[resource] ?? 0) / amount));
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
        let perHour = item.perHour;
        if (hasHydro && building.id === "waterCollector" && item.resource === "energy") {
          perHour *= 0.8;
        }
        state.resources[item.resource] = Math.max(
          0,
          state.resources[item.resource] - perHour * hours * scale,
        );
      }
      for (const item of def.production ?? []) {
        let perHour = item.perHour;
        if (hasHydro && building.id === "waterCollector" && item.resource === "water") {
          perHour *= 1.35;
        } else if (hasCompactor && building.id === "workshop" && item.resource === "metal") {
          perHour *= 1.5;
        } else if (hasSubNeural && (building.id === "serverRoom" || building.id === "aiCore") && item.resource === "compute") {
          perHour *= 1.3;
        }
        // Optimization (L2+) and Governance (L6+): tuned output.
        if (state.aiLevel >= 2) perHour *= 1.1;
        if (state.aiLevel >= 6) perHour *= 1.1;
        state.add(item.resource, perHour * hours * scale);
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
    // Thermal Aerogel Insulation perk: -50% night cold morale loss
    if (isNight && state.population > 0) {
      const hasFire = state.buildings.some((b) => b.id === "campfire");
      if (hasFire) {
        state.morale = Math.min(100, state.morale + CAMPFIRE_NIGHT_COMFORT * hours);
      } else {
        const coldDrain = state.isResearched("reinforced_insulation")
          ? NIGHT_COLD_DRAIN * 0.5
          : NIGHT_COLD_DRAIN;
        state.morale = Math.max(0, state.morale - coldDrain * hours);
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

    const hasHydro = state.isResearched("hydro_recycling");
    const hasCompactor = state.isResearched("scrap_compactor");
    const hasSubNeural = state.isResearched("sub_neural_algorithms");

    for (const building of state.buildings) {
      const def = BUILDINGS[building.id];
      for (const item of def.production ?? []) {
        let perHour = item.perHour;
        if (hasHydro && building.id === "waterCollector" && item.resource === "water") perHour *= 1.35;
        else if (hasCompactor && building.id === "workshop" && item.resource === "metal") perHour *= 1.5;
        else if (hasSubNeural && (building.id === "serverRoom" || building.id === "aiCore") && item.resource === "compute") perHour *= 1.3;
        rates[item.resource] += perHour;
      }
      for (const item of def.consumption ?? []) {
        let perHour = item.perHour;
        if (hasHydro && building.id === "waterCollector" && item.resource === "energy") perHour *= 0.8;
        rates[item.resource] -= perHour;
      }
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
