import type { ResourceKey } from "./buildings";

export type NodeKind = "scrap" | "wood" | "stone";

export interface NodeDefinition {
  kind: NodeKind;
  name: string;
  resource: ResourceKey;
  yieldPerGather: number;
  capacity: number;
  propKey: string;
}

export const NODES: Record<NodeKind, NodeDefinition> = {
  scrap: {
    kind: "scrap",
    name: "Scrap Heap",
    resource: "scrap",
    yieldPerGather: 9,
    capacity: 45,
    propKey: "scrap_pile",
  },
  wood: {
    kind: "wood",
    name: "Dead Tree",
    resource: "wood",
    yieldPerGather: 7,
    capacity: 35,
    propKey: "dead_tree",
  },
  stone: {
    kind: "stone",
    name: "Rock Outcrop",
    resource: "stone",
    yieldPerGather: 8,
    capacity: 40,
    propKey: "boulder",
  },
};

export const NODE_KINDS: NodeKind[] = ["scrap", "wood", "stone"];
