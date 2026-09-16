import {
  Color,
  Fog,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
} from "three";
import { GameConfig } from "../core/GameConfig";
import type { GameTime } from "../core/Time";

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uSunColor;
  uniform vec2 uSunScreen;
  uniform float uSunIntensity;
  uniform float uAspect;

  void main() {
    float t = pow(clamp(vUv.y, 0.0, 1.0), 0.85);
    vec3 col = mix(uHorizon, uTop, t);

    vec2 d = vUv - uSunScreen;
    d.x *= uAspect;
    float dist = length(d);
    col += uSunColor * exp(-dist * 16.0) * uSunIntensity * 0.9;
    col += uSunColor * exp(-dist * 3.5) * uSunIntensity * 0.18;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export class Sky {
  readonly mesh: Mesh;
  private material: ShaderMaterial;
  private fog: Fog;

  private dayTop = new Color(GameConfig.sky.dayTop);
  private dayHorizon = new Color(GameConfig.sky.dayHorizon);
  private duskTop = new Color(GameConfig.sky.duskTop);
  private duskHorizon = new Color(GameConfig.sky.duskHorizon);
  private nightTop = new Color(GameConfig.sky.nightTop);
  private nightHorizon = new Color(GameConfig.sky.nightHorizon);

  private fogDay = new Color(GameConfig.sky.fogDay);
  private fogDusk = new Color(GameConfig.sky.fogDusk);
  private fogNight = new Color(GameConfig.sky.fogNight);

  private top = new Color();
  private horizon = new Color();
  private fogColor = new Color();
  private sunColor = new Color();
  private sunWorld = new Vector3();
  private sunNdc = new Vector3();
  private forward = new Vector3();

  constructor(scene: Scene) {
    this.material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      depthTest: false,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new Color(GameConfig.sky.dayTop) },
        uHorizon: { value: new Color(GameConfig.sky.dayHorizon) },
        uSunColor: { value: new Color(GameConfig.sun.colorDay) },
        uSunScreen: { value: new Vector2(0.5, 0.8) },
        uSunIntensity: { value: 1 },
        uAspect: { value: 1 },
      },
    });

    this.mesh = new Mesh(new PlaneGeometry(1, 1), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    scene.add(this.mesh);

    this.fog = new Fog(this.fogColor, 55, 190);
    scene.fog = this.fog;
  }

  update(time: GameTime, camera: OrthographicCamera): void {
    const elev = time.sunElevation;

    const wNight = clamp01((0.06 - elev) / 0.28);
    const wDusk = clamp01(1 - Math.abs(elev - 0.02) / 0.34) * 0.9;
    const wDay = clamp01((elev - 0.12) / 0.4);
    const invSum = 1 / (wNight + wDusk + wDay + 1e-4);

    blend3(this.top, this.nightTop, wNight, this.duskTop, wDusk, this.dayTop, wDay, invSum);
    blend3(this.horizon, this.nightHorizon, wNight, this.duskHorizon, wDusk, this.dayHorizon, wDay, invSum);
    blend3(this.fogColor, this.fogNight, wNight, this.fogDusk, wDusk, this.fogDay, wDay, invSum);

    this.sunColor
      .copy(this.nightHorizon)
      .lerp(new Color(GameConfig.sun.colorDusk), clamp01(1 - elev / 0.3))
      .lerp(new Color(GameConfig.sun.colorDay), clamp01(elev / 0.5));

    const width = camera.right - camera.left;
    const height = camera.top - camera.bottom;
    this.mesh.scale.set(width, height, 1);
    camera.getWorldDirection(this.forward);
    this.mesh.position.copy(camera.position).addScaledVector(this.forward, 200);
    this.mesh.quaternion.copy(camera.quaternion);

    this.sunWorld.copy(camera.position).addScaledVector(time.sunDirection, 120);
    this.sunNdc.copy(this.sunWorld).project(camera);
    const sunX = this.sunNdc.x * 0.5 + 0.5;
    const sunY = this.sunNdc.y * 0.5 + 0.5;
    const visible =
      this.sunNdc.z < 1 && Math.abs(this.sunNdc.x) < 1.3 && Math.abs(this.sunNdc.y) < 1.3 ? 1 : 0;

    const uniforms = this.material.uniforms;
    (uniforms.uTop.value as Color).copy(this.top);
    (uniforms.uHorizon.value as Color).copy(this.horizon);
    (uniforms.uSunColor.value as Color).copy(this.sunColor);
    const sunScreen = uniforms.uSunScreen.value as Vector2;
    sunScreen.set(sunX, sunY);
    (uniforms.uSunIntensity.value as number) = clamp01(time.daylight * 1.5) * visible;
    (uniforms.uAspect.value as number) = width / Math.max(1, height);

    this.fog.color.copy(this.fogColor);
    this.fog.near = 72 + (1 - time.daylight) * 12;   // pushed further — map stays crisp
    this.fog.far  = 240 - (1 - time.daylight) * 40;
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function blend3(
  target: Color,
  a: Color,
  wa: number,
  b: Color,
  wb: number,
  c: Color,
  wc: number,
  invSum: number,
): void {
  target.setRGB(
    (a.r * wa + b.r * wb + c.r * wc) * invSum,
    (a.g * wa + b.g * wb + c.g * wc) * invSum,
    (a.b * wa + b.b * wb + c.b * wc) * invSum,
  );
}
