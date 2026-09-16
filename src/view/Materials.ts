import {
  Color,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Material,
} from "three";

export interface MaterialSet {
  terrain: MeshStandardMaterial;
  water: MeshPhysicalMaterial;
  wood: MeshStandardMaterial;
  woodDark: MeshStandardMaterial;
  metal: MeshStandardMaterial;
  metalDark: MeshStandardMaterial;
  rust: MeshStandardMaterial;
  concrete: MeshStandardMaterial;
  canvas: MeshStandardMaterial;
  tech: MeshStandardMaterial;
  glass: MeshPhysicalMaterial;
  emissiveWarm: MeshStandardMaterial;
  emissiveTech: MeshStandardMaterial;
  selection: MeshStandardMaterial;
  soil: MeshStandardMaterial;
  crop: MeshStandardMaterial;
  propOrganic: MeshStandardMaterial;
  propHard: MeshStandardMaterial;
  ghostValid: MeshStandardMaterial;
  ghostInvalid: MeshStandardMaterial;
  hover: MeshStandardMaterial;
  all: Material[];
}

export function createMaterials(): MaterialSet {
  // AoE:DE: Natural PBR materials with smooth shading and tactile response
  const terrain = new MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.90,
    metalness: 0.0,
    flatShading: false,
  });

  // Deep coastal water — natural dark azure with high clearcoat for sun glints
  const water = new MeshPhysicalMaterial({
    color: 0x1b4b5c,
    roughness: 0.12,
    metalness: 0.05,
    clearcoat: 0.75,
    clearcoatRoughness: 0.12,
    transparent: false,
    flatShading: false,
  });

  const wood = new MeshStandardMaterial({
    color: 0x8c6239,       // natural weathered timber
    roughness: 0.78,
    metalness: 0.0,
    flatShading: false,
  });

  const woodDark = new MeshStandardMaterial({
    color: 0x4d341e,       // aged dark wood
    roughness: 0.82,
    metalness: 0.0,
    flatShading: false,
  });

  const metal = new MeshStandardMaterial({
    color: 0x66727d,
    roughness: 0.42,
    metalness: 0.65,
    flatShading: false,
  });

  const metalDark = new MeshStandardMaterial({
    color: 0x343b42,
    roughness: 0.48,
    metalness: 0.70,
    flatShading: false,
  });

  const rust = new MeshStandardMaterial({
    color: 0x8a3e1c,
    roughness: 0.82,
    metalness: 0.15,
    flatShading: false,
  });

  const concrete = new MeshStandardMaterial({
    color: 0x949084,
    roughness: 0.88,
    metalness: 0.0,
    flatShading: false,
  });

  const canvas = new MeshStandardMaterial({
    color: 0xc2b99b,
    roughness: 0.90,
    metalness: 0.0,
    flatShading: false,
  });

  const tech = new MeshStandardMaterial({
    color: 0x2a3336,
    roughness: 0.35,
    metalness: 0.45,
    emissive: new Color(0x4aa9e0),
    emissiveIntensity: 0.55,
    flatShading: false,
  });

  const glass = new MeshPhysicalMaterial({
    color: 0x9fc6c9,
    roughness: 0.14,
    metalness: 0.0,
    transmission: 0.45,
    thickness: 0.35,
    transparent: true,
    opacity: 0.62,
  });

  const emissiveWarm = new MeshStandardMaterial({
    color: 0x2a1e14,
    emissive: new Color(0xffb44a),
    emissiveIntensity: 2.8,
    roughness: 0.55,
  });

  const emissiveTech = new MeshStandardMaterial({
    color: 0x0c1a1a,
    emissive: new Color(0x4aa9e0),
    emissiveIntensity: 3.2,
    roughness: 0.4,
  });

  const selection = new MeshStandardMaterial({
    color: 0x7fd6c2,
    emissive: new Color(0x7fd6c2),
    emissiveIntensity: 1.6,
    transparent: true,
    opacity: 0.35,
    roughness: 0.5,
  });

  const soil = new MeshStandardMaterial({
    color: 0x48321d,       // rich dark tilled soil
    roughness: 0.92,
    metalness: 0.0,
    flatShading: false,
  });

  const crop = new MeshStandardMaterial({
    color: 0x4d8a2a,       // healthy organic crop green
    roughness: 0.72,
    metalness: 0.0,
    flatShading: false,
  });

  const propOrganic = new MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.0,
  });

  const propHard = new MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.62,
    metalness: 0.32,
  });

  const ghostValid = new MeshStandardMaterial({
    color: 0x6ee7a8,
    emissive: new Color(0x2f9d6a),
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.5,
    roughness: 0.6,
    depthWrite: false,
  });

  const ghostInvalid = new MeshStandardMaterial({
    color: 0xe0604a,
    emissive: new Color(0x9d3322),
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.45,
    roughness: 0.6,
    depthWrite: false,
  });

  const hover = new MeshStandardMaterial({
    color: 0xf2e6c4,
    emissive: new Color(0xf2e6c4),
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.22,
    roughness: 0.6,
    depthWrite: false,
  });

  const all: Material[] = [
    terrain,
    water,
    wood,
    woodDark,
    metal,
    metalDark,
    rust,
    concrete,
    canvas,
    tech,
    glass,
    emissiveWarm,
    emissiveTech,
    selection,
    soil,
    crop,
    propOrganic,
    propHard,
    ghostValid,
    ghostInvalid,
    hover,
  ];

  return {
    terrain,
    water,
    wood,
    woodDark,
    metal,
    metalDark,
    rust,
    concrete,
    canvas,
    tech,
    glass,
    emissiveWarm,
    emissiveTech,
    selection,
    soil,
    crop,
    propOrganic,
    propHard,
    ghostValid,
    ghostInvalid,
    hover,
    all,
  };
}

export function applyQualityToMaterials(set: MaterialSet, preset: string): void {
  const highEnd = preset === "high" || preset === "ultra";
  set.glass.transmission = highEnd ? 0.6 : 0;
  set.glass.transparent = true;
  set.glass.opacity = highEnd ? 0.55 : 0.7;
  set.emissiveWarm.emissiveIntensity = highEnd ? 2.4 : 1.4;
  set.emissiveTech.emissiveIntensity = highEnd ? 3.0 : 1.8;
}
