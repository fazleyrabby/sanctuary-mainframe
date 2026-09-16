import {
  AmbientLight,
  Color,
  DirectionalLight,
  HemisphereLight,
  Scene,
  Vector3,
} from "three";
import { GameConfig } from "../core/GameConfig";
import type { GameTime } from "../core/Time";

export class Lighting {
  readonly sun: DirectionalLight;
  readonly hemisphere: HemisphereLight;
  readonly ambient: AmbientLight;

  private sunColorDay = new Color(GameConfig.sun.colorDay);
  private sunColorDusk = new Color(GameConfig.sun.colorDusk);
  private sunColorNight = new Color(GameConfig.sun.colorNight);
  private sunColor = new Color();
  private skyTint = new Color();
  private moonDirection = new Vector3(-0.55, 0.72, 0.42).normalize();
  private lightDirection = new Vector3();

  constructor(scene: Scene) {
    this.sun = new DirectionalLight(GameConfig.sun.colorDay, GameConfig.sun.intensityDay);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(
      GameConfig.render.shadowMapSize,
      GameConfig.render.shadowMapSize,
    );
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 220;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;

    const shadowCam = this.sun.shadow.camera;
    shadowCam.left = -46;
    shadowCam.right = 46;
    shadowCam.top = 46;
    shadowCam.bottom = -46;
    shadowCam.updateProjectionMatrix();

    scene.add(this.sun);
    scene.add(this.sun.target);

    // AoE:DE: Natural atmospheric bounce — soft sky fill, warm earth bounce
    this.hemisphere = new HemisphereLight(0x9bbcd8, 0x3d3224, 0.50);
    scene.add(this.hemisphere);

    this.ambient = new AmbientLight(0xffffff, 0.12);
    scene.add(this.ambient);
  }

  update(time: GameTime, focus: Vector3): void {
    const elev = time.sunElevation;
    const daylight = time.daylight;

    this.sunColor
      .copy(this.sunColorNight)
      .lerp(this.sunColorDusk, clamp01(1 - Math.abs(elev - 0.02) / 0.3))
      .lerp(this.sunColorDay, clamp01((elev - 0.05) / 0.45));
    this.sun.color.copy(this.sunColor);

    const intensity = GameConfig.sun.intensityNight +
      (GameConfig.sun.intensityDay - GameConfig.sun.intensityNight) * daylight;
    this.sun.intensity = intensity;

    const nightAmount = clamp01(-elev / 0.18);
    this.lightDirection
      .copy(time.sunDirection)
      .lerp(this.moonDirection, nightAmount)
      .normalize();

    this.sun.position.copy(focus).addScaledVector(this.lightDirection, 90);
    this.sun.target.position.copy(focus);
    this.sun.target.updateMatrixWorld();

    // Grounded atmospheric lighting — keeps shadows deep and distinct
    this.skyTint
      .copy(this.sunColor)
      .lerp(new Color(0x9bbcd8), 0.55)
      .multiplyScalar(0.55 + daylight * 0.35);
    this.hemisphere.color.copy(this.skyTint);
    this.hemisphere.groundColor.setHex(daylight > 0.2 ? 0x3d3224 : 0x1e1c18);
    this.hemisphere.intensity = 0.45 + daylight * 0.20;

    this.ambient.intensity = 0.10 + daylight * 0.05;
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
