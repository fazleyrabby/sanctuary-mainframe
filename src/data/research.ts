import type { ResourceCost } from "./buildings";

export type TechId =
  | "bio_agronomy"
  | "hydro_recycling"
  | "reinforced_insulation"
  | "scrap_compactor"
  | "sub_neural_algorithms";

export interface TechDefinition {
  id: TechId;
  name: string;
  category: "agri" | "infra" | "ai";
  description: string;
  perkSummary: string;
  cost: ResourceCost;
  researchHours: number;
  prerequisites: TechId[];
}

export const TECHNOLOGIES: Record<TechId, TechDefinition> = {
  bio_agronomy: {
    id: "bio_agronomy",
    name: "AI Crop Analysis",
    category: "agri",
    description: "Algorithmic root microbiome modeling increases agricultural efficiency.",
    perkSummary: "+25% crop growth speed across all farm plots",
    cost: { data: 25, compute: 15 },
    researchHours: 18,
    prerequisites: [],
  },
  hydro_recycling: {
    id: "hydro_recycling",
    name: "Hydro-Condenser Recycling",
    category: "infra",
    description: "Nanofiltration closed loops squeeze maximum moisture from ambient vapor.",
    perkSummary: "+35% water collector output, -20% power use",
    cost: { data: 30, compute: 20, scrap: 15 },
    researchHours: 24,
    prerequisites: [],
  },
  reinforced_insulation: {
    id: "reinforced_insulation",
    name: "Thermal Aerogel Insulation",
    category: "infra",
    description: "Aerogel insulation panels retain colony warmth during freezing desert nights.",
    perkSummary: "-50% night cold morale loss when unheated",
    cost: { data: 35, scrap: 30, metal: 10 },
    researchHours: 24,
    prerequisites: ["hydro_recycling"],
  },
  scrap_compactor: {
    id: "scrap_compactor",
    name: "Hydraulic Scrap Compactor",
    category: "infra",
    description: "High-pressure thermal presses extract clean structural metal from debris.",
    perkSummary: "+50% metal output rate in workshops",
    cost: { data: 40, compute: 30, scrap: 40 },
    researchHours: 32,
    prerequisites: [],
  },
  sub_neural_algorithms: {
    id: "sub_neural_algorithms",
    name: "Sub-Neural Algorithms",
    category: "ai",
    description: "Quantum-heuristic neural topologies unlock denser compute pipelines.",
    perkSummary: "+30% compute generation in server rooms & AI core",
    cost: { data: 60, compute: 50, energy: 30 },
    researchHours: 48,
    prerequisites: ["bio_agronomy"],
  },
};

export const TECH_IDS: TechId[] = [
  "bio_agronomy",
  "hydro_recycling",
  "reinforced_insulation",
  "scrap_compactor",
  "sub_neural_algorithms",
];
