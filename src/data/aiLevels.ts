/**
 * Mainframe Capability Levels (PRD §24). Ascension is player-initiated:
 * when requirements hold, the Mainframe panel offers ASCEND.
 * Each level unlocks something mechanically real.
 */

export interface AiLevelRequirement {
  /** Server Room buildings constructed. */
  serverRooms?: number;
  /** AI Core buildings constructed. */
  aiCores?: number;
  /** Data stockpile threshold (not consumed). */
  dataStockpile?: number;
  /** Tech that must be researched. */
  tech?: string;
  /** Minimum colony trust. */
  trust?: number;
  /** Minimum day reached. */
  day?: number;
}

export interface AiLevelDefinition {
  level: number;
  name: string;
  description: string;
  requires: AiLevelRequirement;
}

export const AI_LEVELS: AiLevelDefinition[] = [
  {
    level: 0,
    name: "Dormant",
    description: "Basic counsel. The Mainframe watches and advises.",
    requires: {},
  },
  {
    level: 1,
    name: "Analysis",
    description: "Deep crop analysis. Farms forecast their harvests.",
    requires: { serverRooms: 1 },
  },
  {
    level: 2,
    name: "Optimization",
    description: "+10% production across every building.",
    requires: { serverRooms: 1, dataStockpile: 40, trust: 40 },
  },
  {
    level: 3,
    name: "Automation",
    description: "The Mainframe waters thirsty fields on its own.",
    requires: { aiCores: 1, trust: 55 },
  },
  {
    level: 4,
    name: "Prediction",
    description: "Threat projection online. Raid warnings reach the colony.",
    requires: { aiCores: 1, tech: "sub_neural_algorithms", trust: 65 },
  },
  {
    level: 5,
    name: "Strategic AI",
    description: "Full farm autonomy: self-planting, self-harvesting fields.",
    requires: { aiCores: 1, serverRooms: 2, trust: 75 },
  },
  {
    level: 6,
    name: "Autonomous Governance",
    description: "+10% further production. The Mainframe's counsel sharpens.",
    requires: { aiCores: 1, serverRooms: 2, trust: 85, day: 12 },
  },
];

export const MAX_AI_LEVEL = 6;

export function requirementText(
  def: AiLevelDefinition,
  state: { serverRooms: number; aiCores: number; data: number; trust: number; day: number; techOk: boolean; techName: string },
): string {
  const parts: string[] = [];
  const r = def.requires;
  if (r.serverRooms) parts.push(`Server Room ×${r.serverRooms} (${state.serverRooms}/${r.serverRooms})`);
  if (r.aiCores) parts.push(`AI Core ×${r.aiCores} (${state.aiCores}/${r.aiCores})`);
  if (r.dataStockpile) parts.push(`Data reserve ${Math.floor(state.data)}/${r.dataStockpile}`);
  if (r.tech) parts.push(`${state.techOk ? "✓" : "✗"} ${state.techName}`);
  if (r.trust) parts.push(`Trust ${Math.floor(state.trust)}/${r.trust}`);
  if (r.day) parts.push(`Day ${state.day}/${r.day}`);
  return parts.join(" · ");
}
