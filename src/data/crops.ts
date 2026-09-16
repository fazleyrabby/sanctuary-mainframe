export type CropId = "wheat" | "potato" | "corn" | "tomato";

export interface CropDefinition {
  id: CropId;
  name: string;
  growthHours: number;
  waterPerHour: number;
  yieldFood: number;
  seedCost: Partial<Record<"food" | "scrap" | "water", number>>;
  stageColors: number[];
  stalkHeight: number;
}

export const CROPS: Record<CropId, CropDefinition> = {
  wheat: {
    id: "wheat",
    name: "Wheat",
    growthHours: 20,
    waterPerHour: 0.5,
    yieldFood: 34,
    seedCost: { food: 2 },
    stageColors: [0x7d8a4a, 0x8f9a52, 0xb2a95e, 0xd9c072],
    stalkHeight: 0.5,
  },
  potato: {
    id: "potato",
    name: "Potato",
    growthHours: 26,
    waterPerHour: 0.42,
    yieldFood: 52,
    seedCost: { food: 3 },
    stageColors: [0x5f7a44, 0x6b8a48, 0x8a9a52, 0xa8a35e],
    stalkHeight: 0.42,
  },
  corn: {
    id: "corn",
    name: "Corn",
    growthHours: 32,
    waterPerHour: 0.62,
    yieldFood: 74,
    seedCost: { food: 4 },
    stageColors: [0x4f6f3c, 0x5f8442, 0x7d9a4c, 0xc4b060],
    stalkHeight: 0.7,
  },
  tomato: {
    id: "tomato",
    name: "Tomato",
    growthHours: 24,
    waterPerHour: 0.55,
    yieldFood: 44,
    seedCost: { food: 3 },
    stageColors: [0x4d6b3a, 0x5f7d40, 0x7d8f46, 0xb5462f],
    stalkHeight: 0.55,
  },
};

export const CROP_IDS: CropId[] = ["wheat", "potato", "corn", "tomato"];

export function growthStage(progress: number, stages = 4): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return stages - 1;
  return Math.min(stages - 1, Math.floor(progress * stages));
}
