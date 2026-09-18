import type { BuildingId } from "../data/buildings";
import type { GameState } from "../state/GameState";

/**
 * Deterministic Mainframe recommendation engine (PRD §52–53).
 * Pure function of GameState — no RNG, no LLM. Same colony, same advice.
 */

export interface AdviceAction {
  kind: "build";
  building: BuildingId;
}

export interface Advice {
  /** Stable key used for the dismiss-snooze. */
  id: string;
  title: string;
  detail: string;
  reason: string;
  alternative: string;
  confidence: number;
  action: AdviceAction | null;
}

export interface PriorityScore {
  key: string;
  score: number;
}

export interface MainframeReport {
  status: "STABLE" | "STRAINED" | "CRITICAL";
  priorities: PriorityScore[];
  advice: Advice | null;
}

const SNOOZE_HOURS = 6;

function runwayHours(stock: number, ratePerHour: number): number {
  if (ratePerHour >= -0.001) return Number.POSITIVE_INFINITY;
  return stock / -ratePerHour;
}

function fmtRunway(hours: number): string {
  if (!Number.isFinite(hours)) return "stable";
  if (hours < 1) return "under an hour";
  return `~${Math.max(1, Math.round(hours))}h`;
}

export function evaluateMainframe(state: GameState, nowHours: number): MainframeReport {
  const foodRate = state.rates.food;
  const waterRate = state.rates.water;
  const foodRunway = runwayHours(state.resources.food, foodRate);
  const waterRunway = runwayHours(state.resources.water, waterRate);
  const hasFire = state.buildings.some((b) => b.id === "campfire");
  const readyPlots = state.buildings.reduce(
    (n, b) => n + b.plots.filter((p) => p.ready).length,
    0,
  );
  const thirstyPlots = state.buildings.reduce(
    (n, b) => n + b.plots.filter((p) => p.crop && !p.ready && p.water <= 0.05).length,
    0,
  );

  const score = (runway: number, stock: number, threshold: number): number => {
    if (runway < 6 || stock <= threshold * 0.35) return 95;
    if (runway < 24) return 75;
    if (runway < 48 || stock <= threshold) return 50;
    if (runway < 72) return 25;
    return 8;
  };

  const priorities: PriorityScore[] = [
    { key: "Food", score: score(foodRunway, state.resources.food, 40) },
    { key: "Water", score: score(waterRunway, state.resources.water, 35) },
    {
      key: "Energy",
      score:
        state.resources.energy <= 0.5 ? 90 : state.rates.energy < -0.05 ? 60 : 12,
    },
    {
      key: "Shelter",
      score: state.population > state.housing ? 70 : 10,
    },
    {
      key: "Morale",
      score: state.morale < 30 ? 80 : state.morale < 50 ? 45 : 10,
    },
  ];
  priorities.sort((a, b) => b.score - a.score);

  const worst = priorities[0]?.score ?? 0;
  const status = worst >= 85 ? "CRITICAL" : worst >= 55 ? "STRAINED" : "STABLE";

  const candidates: Advice[] = [];
  if (foodRunway < 30) {
    candidates.push({
      id: "food",
      title: "Expand food production",
      detail: `Build another Farm. Expected +35 food/day at a cost of ~20 water/day.`,
      reason: `Food reserves will reach critical levels in ${fmtRunway(foodRunway)} at current consumption (${(-foodRate).toFixed(1)}/h for ${state.population} colonists).`,
      alternative: `Gather from ruins instead — slower, but costs no water.`,
      confidence: 92,
      action: { kind: "build", building: "farm" },
    });
  }
  if (waterRunway < 30) {
    candidates.push({
      id: "water",
      title: "Secure the water supply",
      detail: `Build a Water Collector (+2.6/h, uses 0.8 energy/h).`,
      reason: `Water reserves last ${fmtRunway(waterRunway)} at current burn (${(-waterRate).toFixed(1)}/h). Crops and colonists both draw from the same tank.`,
      alternative: `Shut down water-hungry production until the tank recovers.`,
      confidence: 90,
      action: { kind: "build", building: "waterCollector" },
    });
  }
  if (state.resources.energy <= 0.5) {
    candidates.push({
      id: "energy",
      title: "Restore power",
      detail: `Build a Generator (+9 energy/h, burns scrap). Unpowered machines are idle.`,
      reason: `Energy reserves are empty. Every powered building in the colony is currently stalled.`,
      alternative: `Demolish nothing — just feed the grid. There is no alternative to power.`,
      confidence: 88,
      action: { kind: "build", building: "generator" },
    });
  }
  if (state.population > state.housing) {
    candidates.push({
      id: "shelter",
      title: "Roof every head",
      detail: `Build a Shelter (+4 beds). ${state.population} souls, ${state.housing} beds.`,
      reason: `Overcrowding drains morale every hour. Colonists sleeping in the open lose faith faster than hunger takes them.`,
      alternative: `There is no alternative. Build beds.`,
      confidence: 85,
      action: { kind: "build", building: "shelter" },
    });
  }
  if (!hasFire) {
    candidates.push({
      id: "fire",
      title: "Raise a fire before dark",
      detail: `Build a Campfire. Warmth steadies morale through cold nights.`,
      reason: `Night morale decays without a lit fire nearby. A campfire is the cheapest comfort in the colony.`,
      alternative: `Endure the dark — morale will sag a little each night.`,
      confidence: 78,
      action: { kind: "build", building: "campfire" },
    });
  }
  if (readyPlots > 0) {
    candidates.push({
      id: "harvest",
      title: "Harvest ready crops",
      detail: `${readyPlots} plot${readyPlots > 1 ? "s" : ""} ripe and waiting. Select a Farm to collect.`,
      reason: `Ripe crops gain nothing by waiting, and blight is never far in the wastes.`,
      alternative: `Leave them standing if labor is needed elsewhere — they will keep.`,
      confidence: 95,
      action: null,
    });
  }
  if (thirstyPlots > 0 && state.resources.water > 1) {
    candidates.push({
      id: "watering",
      title: "Water the fields",
      detail: `${thirstyPlots} growing plot${thirstyPlots > 1 ? "s" : ""} stalled dry. Growth has paused.`,
      reason: `Dry plots do not grow at all. A single watering resumes every stalled crop.`,
      alternative: `Let them wait — but every dry hour is a lost harvest hour.`,
      confidence: 87,
      action: null,
    });
  }
  if (!state.activeResearch && state.resources.data >= 25 && state.resources.compute >= 15) {
    candidates.push({
      id: "research",
      title: "Initiate technological research",
      detail: `Colony holds ${Math.floor(state.resources.data)} data and ${Math.floor(state.resources.compute)} compute. Open TECH tree (T) to unlock upgrades.`,
      reason: `Compute cores and data caches sit idle. Research accelerates crop yield, water efficiency, and insulation.`,
      alternative: `Conserve data and compute for future expansions.`,
      confidence: 72,
      action: null,
    });
  }
  candidates.push({
    id: "stable",
    title: "Hold the line",
    detail: `Colony stable. Stockpile wood and scrap for the next expansion.`,
    reason: `No reserve is projected to fail within two days. The best move is preparation.`,
    alternative: `Push outward: more farms now means surplus later.`,
    confidence: 60,
    action: null,
  });

  const snooze = state.advisorSnooze;
  const advice =
    candidates.find(
      (c) => !(snooze && snooze.id === c.id && nowHours < snooze.untilHour),
    ) ?? candidates[candidates.length - 1] ?? null;

  return { status, priorities, advice };
}

export function snoozeDuration(): number {
  return SNOOZE_HOURS;
}
