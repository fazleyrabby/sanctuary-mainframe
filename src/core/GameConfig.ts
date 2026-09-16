export const degToRad = (deg: number): number => (deg * Math.PI) / 180;

export const GameConfig = {
  world: {
    seed: 20260915,
    gridWidth: 48,
    gridHeight: 48,
    tileSize: 1,
    tileThickness: 0.35,
  },

  camera: {
    viewSize: 30,
    minZoom: 0.55,
    maxZoom: 3.2,
    azimuth: degToRad(45),
    elevation: degToRad(35.264),
    distance: 70,
    panSpeed: 18,
    edgePadding: 6,
    damping: 10,
    zoomSensitivity: 0.0016,
  },

  render: {
    pixelRatioCap: 2,
    shadows: true,
    shadowMapSize: 2048,
    exposure: 1.05,
  },

  sky: {
    // AoE:DE: natural atmospheric sky gradient with soft horizon haze
    dayTop:      0x3a6ca8,
    dayHorizon:  0xb8d2e8,
    duskTop:     0x3d4b60,
    duskHorizon: 0xe09858,
    nightTop:    0x101828,
    nightHorizon:0x1e2b44,
    fogDay:      0xa4c0d8,
    fogNight:    0x1c2638,
    fogDusk:     0x686460,
  },

  sun: {
    intensityDay: 2.2,
    intensityNight: 0.8,
    colorDay: 0xfff6ec,      // warm natural sunlight
    colorDusk: 0xff9848,
    colorNight: 0x7e9acc,
  },

  time: {
    dayLengthSeconds: 240,
    startHour: 6.5,
    hoursPerDay: 24,
  },

  quality: {
    default: "high" as QualityPreset,
  },

  colors: {
    // AoE:DE inspired grounded diorama palette
    grass:     0x4c7d32,
    grassDry:  0x787a38,
    dirt:      0x5e452b,
    stone:     0x7a7972,
    sand:      0xab956d,
    water:     0x1b4b5c,
    wood:      0x8c6239,
    woodDark:  0x4d341e,
    metal:     0x66727d,
    metalDark: 0x343b42,
    rust:      0x8a3e1c,
    concrete:  0x949084,
    canvas:    0xc2b99b,
    tech:      0x4eb8a0,
    emissive:  0xffa33a,
  },
} as const;

export type QualityPreset = "low" | "medium" | "high" | "ultra";
