import type { MeshStandardMaterial } from "three";

const DECLARATION = `
attribute vec4 aUvXform;
vec2 applyUvXform( vec2 uv ) {
  vec2 centered = uv - 0.5;
  vec2 rotated = vec2(
    centered.x * aUvXform.x - centered.y * aUvXform.y,
    centered.x * aUvXform.y + centered.y * aUvXform.x
  );
  return rotated + 0.5 + aUvXform.zw;
}
`;

/**
 * Rotates and offsets UVs per instance so a single tileable texture does not
 * visibly repeat across a grid of tiles. Requires a vec4 `aUvXform` instanced
 * attribute: (cos, sin, offsetX, offsetY).
 */
export function applyInstanceUvTransform(material: MeshStandardMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${DECLARATION}`)
      .replace(
        /v(\w+)Uv = \( (\w+) \* vec3\( (\w+), 1 \) \)\.xy;/g,
        (_match: string, name: string, transform: string, uv: string) =>
          `v${name}Uv = applyUvXform( ( ${transform} * vec3( ${uv}, 1 ) ).xy );`,
      );
  };
  material.customProgramCacheKey = () => "instance-uv-transform";
}
