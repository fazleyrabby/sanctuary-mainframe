import { MathUtils, OrthographicCamera, Vector3 } from "three";
import { GameConfig } from "../core/GameConfig";

const WORLD_UP = new Vector3(0, 1, 0);

export class CameraRig {
  readonly camera: OrthographicCamera;
  readonly target = new Vector3(0, 0, 0);

  private desiredTarget = new Vector3(0, 0, 0);
  private zoom = 1;
  private desiredZoom = 1;
  private aspect = 1;
  private viewportHeight = 1;

  private forwardGround = new Vector3();
  private rightGround = new Vector3();
  private offset = new Vector3();

  private boundsX = 20;
  private boundsZ = 20;

  private azimuth = GameConfig.camera.azimuth;
  private desiredAzimuth = GameConfig.camera.azimuth;
  private readonly elevation = GameConfig.camera.elevation;
  private readonly distance = GameConfig.camera.distance;

  constructor() {
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
    this.applyOffset();
    this.updateProjection();
  }

  setBounds(halfX: number, halfZ: number): void {
    this.boundsX = halfX;
    this.boundsZ = halfZ;
  }

  resize(width: number, height: number): void {
    this.aspect = width / Math.max(1, height);
    this.viewportHeight = Math.max(1, height);
    this.updateProjection();
  }

  get worldUnitsPerPixel(): number {
    return GameConfig.camera.viewSize / this.zoom / this.viewportHeight;
  }

  pan(dx: number, dz: number, deltaSeconds: number): void {
    this.computeGroundAxes();
    const speed = GameConfig.camera.panSpeed * deltaSeconds / this.zoom;
    this.desiredTarget.addScaledVector(this.rightGround, dx * speed);
    this.desiredTarget.addScaledVector(this.forwardGround, dz * speed);
    this.clampTarget();
  }

  panWorld(dx: number, dz: number): void {
    this.computeGroundAxes();
    this.desiredTarget.addScaledVector(this.rightGround, -dx);
    this.desiredTarget.addScaledVector(this.forwardGround, dz);
    this.clampTarget();
  }

  zoomBy(amount: number): void {
    this.desiredZoom = MathUtils.clamp(
      this.desiredZoom * (1 - amount),
      GameConfig.camera.minZoom,
      GameConfig.camera.maxZoom,
    );
  }

  rotateBy(deltaRadians: number): void {
    this.desiredAzimuth += deltaRadians;
  }

  focusOn(x: number, z: number, instant = false): void {
    this.desiredTarget.set(x, 0, z);
    this.clampTarget();
    if (instant) {
      this.target.copy(this.desiredTarget);
      this.camera.position.copy(this.target).add(this.offset);
      this.camera.lookAt(this.target);
    }
  }

  update(deltaSeconds: number): void {
    const t = 1 - Math.exp(-GameConfig.camera.damping * deltaSeconds);
    this.target.lerp(this.desiredTarget, t);
    this.zoom = MathUtils.lerp(this.zoom, this.desiredZoom, t);
    this.azimuth = MathUtils.lerp(this.azimuth, this.desiredAzimuth, t);

    this.applyOffset();
    this.camera.position.copy(this.target).add(this.offset);
    this.camera.lookAt(this.target);
    this.updateProjection();
  }

  get groundPoint(): Vector3 {
    return this.target;
  }

  private applyOffset(): void {
    this.offset
      .set(
        Math.sin(this.azimuth) * Math.cos(this.elevation),
        Math.sin(this.elevation),
        Math.cos(this.azimuth) * Math.cos(this.elevation),
      )
      .multiplyScalar(this.distance);
  }

  private computeGroundAxes(): void {
    this.forwardGround
      .copy(this.target)
      .sub(this.camera.position)
      .setY(0)
      .normalize();

    this.rightGround.crossVectors(this.forwardGround, WORLD_UP).normalize();
  }

  private clampTarget(): void {
    const pad = GameConfig.camera.edgePadding;
    this.desiredTarget.x = MathUtils.clamp(
      this.desiredTarget.x,
      -this.boundsX - pad,
      this.boundsX + pad,
    );
    this.desiredTarget.z = MathUtils.clamp(
      this.desiredTarget.z,
      -this.boundsZ - pad,
      this.boundsZ + pad,
    );
  }

  private updateProjection(): void {
    const frustumHeight = GameConfig.camera.viewSize / this.zoom;
    const halfHeight = frustumHeight / 2;
    const halfWidth = halfHeight * this.aspect;

    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
  }
}
