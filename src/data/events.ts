import type { BuildingId, ResourceKey } from "./buildings";

export interface EventCost {
  resource: ResourceKey;
  amount: number;
}

export interface EventGains {
  resource: ResourceKey;
  amount: number;
}

export interface EventOption {
  id: string;
  label: string;
  /** Costs paid up front; option disabled when unaffordable. */
  cost?: EventCost[];
  gains?: EventGains[];
  morale?: number;
  health?: number;
  trust?: number;
  population?: number;
  /** Crop progress delta applied to every growing plot (dust storm). */
  cropProgress?: number;
  /** Narrative outcome line shown after choosing. */
  result: string;
}

export interface GameEvent {
  id: string;
  title: string;
  kicker: string;
  story: string;
  /** Mainframe-voiced events render violet and move trust. */
  mainframe?: boolean;
  minDay?: number;
  requiresBuilding?: BuildingId;
  requiresPop?: number;
  /** Minimum Mainframe capability level (threat projection comes online at L4). */
  requiresAILevel?: number;
  /** Once-only story beats never repeat. */
  once?: boolean;
  options: EventOption[];
}

export const EVENTS: Record<string, GameEvent> = {
  thirsty_neighbors: {
    id: "thirsty_neighbors",
    title: "Thirsty Neighbors",
    kicker: "COLONY EVENT",
    story:
      "A dust-caked family from a failed settlement begs at the gate for water. Their jugs are empty. Their child does not cry anymore — too tired.",
    options: [
      {
        id: "share",
        label: "Share water freely",
        cost: [{ resource: "water", amount: 30 }],
        morale: 6,
        result: "You fill their jugs. Word of the sanctuary's mercy spreads.",
      },
      {
        id: "trade",
        label: "Trade water for scrap",
        cost: [{ resource: "water", amount: 20 }],
        gains: [{ resource: "scrap", amount: 25 }],
        morale: 2,
        result: "A fair trade. They leave lighter of scrap, heavier of water.",
      },
      {
        id: "refuse",
        label: "Turn them away",
        morale: -6,
        result: "The gate closes. Your colonists heard the child coughing.",
      },
    ],
  },
  mainframe_power_shift: {
    id: "mainframe_power_shift",
    title: "Optimization Proposal",
    kicker: "MAINFRAME DIRECTIVE",
    story:
      "MAINFRAME: I have identified an optimization. Redirect 20% of residential power to the agricultural district. Projected food output +32%. Residential comfort −14%.",
    mainframe: true,
    minDay: 3,
    options: [
      {
        id: "accept",
        label: "ACCEPT",
        gains: [{ resource: "food", amount: 40 }],
        morale: -8,
        trust: 3,
        result: "Harvests surge. The houses sit dim and cold, and everyone knows why.",
      },
      {
        id: "deny",
        label: "DENY",
        morale: 2,
        trust: -1,
        result: "The lights stay on. The Mainframe notes your preference. It always notes.",
      },
      {
        id: "explain",
        label: "ASK WHY",
        trust: 1,
        morale: 1,
        result:
          "Food reserves will reach critical levels in 5.4 days (confidence 87%). Alternative: construct another greenhouse. Transparency, it seems, reassures.",
      },
    ],
  },
  fever_outbreak: {
    id: "fever_outbreak",
    title: "Red-Lung Fever",
    kicker: "COLONY EVENT",
    story:
      "Two colonists wake with red-lung fever — wet coughs, glassy eyes. It spreads through shared cups and close bunks.",
    minDay: 2,
    options: [
      {
        id: "isolate",
        label: "Isolate the sick",
        cost: [{ resource: "food", amount: 15 }],
        health: 4,
        result: "Separate tents, clean water, time. The fever burns out alone.",
      },
      {
        id: "remedy",
        label: "Brew fever tea",
        cost: [{ resource: "water", amount: 20 }],
        health: 6,
        morale: 2,
        result: "Bitter boiled-root tea. The sick sweat through the night and wake clear.",
      },
      {
        id: "ignore",
        label: "Work through it",
        health: -15,
        morale: -4,
        result: "The cough moves bunk to bunk. The colony works slower for days.",
      },
    ],
  },
  dust_storm: {
    id: "dust_storm",
    title: "Ashen Squall",
    kicker: "COLONY EVENT",
    story:
      "The horizon turns the color of old blood. An ash squall is an hour out — it will scour every uncovered leaf and solar vein.",
    minDay: 2,
    options: [
      {
        id: "shelter",
        label: "Cover the fields",
        cropProgress: -0.15,
        result: "Tarps over every row. Growth stalls, but nothing is stripped bare.",
      },
      {
        id: "endure",
        label: "Work through it",
        morale: -6,
        health: -4,
        result: "Grit in every lung and gearbox. The crops survive; the crew does not enjoy it.",
      },
    ],
  },
  wanderer: {
    id: "wanderer",
    title: "A Figure on the Road",
    kicker: "COLONY EVENT",
    story:
      "A lone wanderer with a patched pack and a working multitool asks for a place by the fire. Their hands look useful.",
    options: [
      {
        id: "welcome",
        label: "Take them in",
        cost: [{ resource: "food", amount: 15 }],
        population: 1,
        morale: 3,
        result: "One more mouth, one more pair of hands. The fire feels bigger tonight.",
      },
      {
        id: "refuse",
        label: "Send them on",
        morale: -2,
        result: "They nod like they expected it and walk back into the dust.",
      },
    ],
  },
  scrap_traders: {
    id: "scrap_traders",
    title: "Tinker Caravan",
    kicker: "COLONY EVENT",
    story:
      "A tinker caravan rattles in with a cart of pressed metal ingots and an appetite for preserved food.",
    minDay: 3,
    options: [
      {
        id: "buy",
        label: "Buy metal (−30 scrap)",
        cost: [{ resource: "scrap", amount: 30 }],
        gains: [{ resource: "metal", amount: 20 }],
        result: "Clean ingots, fair weight. The workshop will eat well.",
      },
      {
        id: "sell",
        label: "Sell food (+25 scrap)",
        cost: [{ resource: "food", amount: 20 }],
        gains: [{ resource: "scrap", amount: 25 }],
        result: "Full bellies traded for full bins. Hope the harvest agrees.",
      },
      {
        id: "decline",
        label: "Decline politely",
        result: "The caravan rattles on. No harm, no profit.",
      },
    ],
  },
  mainframe_raid_warning: {
    id: "mainframe_raid_warning",
    title: "Threat Projection",
    kicker: "MAINFRAME DIRECTIVE",
    story:
      "MAINFRAME: Scavenger movement triangulated on the eastern approach. Raid probability 72% within 12 hours. Recommend barricading the perimeter.",
    mainframe: true,
    minDay: 4,
    requiresAILevel: 4,
    options: [
      {
        id: "barricade",
        label: "Barricade (20 wood, 10 scrap)",
        cost: [
          { resource: "wood", amount: 20 },
          { resource: "scrap", amount: 10 },
        ],
        morale: 2,
        trust: 2,
        result: "Timber and wire by dusk. The raiders circle once, then move on to softer prey.",
      },
      {
        id: "gamble",
        label: "Hold position unarmed",
        trust: -2,
        result: "They came at moonrise. Nothing burned — but tools, stores, and blood were taken.",
      },
    ],
  },
  old_cache: {
    id: "old_cache",
    title: "Sealed Cache",
    kicker: "COLONY EVENT",
    story:
      "Scouts find a pre-collapse supply cache sealed in wax and lead. The markings warn of unstable chemistry inside.",
    once: true,
    minDay: 2,
    options: [
      {
        id: "crack",
        label: "Crack it open",
        gains: [
          { resource: "scrap", amount: 40 },
          { resource: "metal", amount: 10 },
        ],
        health: -4,
        result: "Old batteries, clean wire, and a lungful of ancient fumes. Worth it.",
      },
      {
        id: "leave",
        label: "Leave it sealed",
        morale: -2,
        result: "Some doors were closed for a reason. Still — everyone wonders.",
      },
    ],
  },
};

export const EVENT_IDS = Object.keys(EVENTS);
