import type { MeshPhysicalMaterial } from "three";

export interface WaterAnimation {
  time: { value: number };
}

/**
 * Replaces the single normal-map lookup with two counter-scrolling samples so
 * the water surface ripples and catches moving sun highlights.
 */
export function animateWater(material: MeshPhysicalMaterial): WaterAnimation {
  const time = { value: 0 };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWaterTime = time;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uWaterTime;")
      .replace(
        "#include <normal_fragment_maps>",
        `
        vec3 waterN1 = texture2D( normalMap, vNormalMapUv + uWaterTime * vec2( 0.020, 0.013 ) ).xyz * 2.0 - 1.0;
        vec3 waterN2 = texture2D( normalMap, vNormalMapUv * 1.9 - uWaterTime * vec2( 0.012, 0.021 ) ).xyz * 2.0 - 1.0;
        vec3 waterN = normalize( waterN1 + waterN2 );
        waterN.xy *= normalScale;
        normal = normalize( tbn * waterN );
        `,
      );
  };
  material.customProgramCacheKey = () => "water-animated";

  return { time };
}
