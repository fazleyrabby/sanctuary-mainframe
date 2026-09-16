import { Vector2, Vector3, type Scene, type Camera, type WebGLRenderer } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { QualityPreset } from "../core/GameConfig";

const AoeSharpenShader = {
  uniforms: {
    tDiffuse: { value: null as unknown },
    uTexel: { value: new Vector2(1 / 1920, 1 / 1080) },
    uStrength: { value: 0.35 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uTexel;
    uniform float uStrength;
    varying vec2 vUv;

    void main() {
      vec4 center = texture2D(tDiffuse, vUv);
      vec3 blur = (
        texture2D(tDiffuse, vUv + vec2( uTexel.x, 0.0)).rgb +
        texture2D(tDiffuse, vUv - vec2( uTexel.x, 0.0)).rgb +
        texture2D(tDiffuse, vUv + vec2(0.0,  uTexel.y)).rgb +
        texture2D(tDiffuse, vUv - vec2(0.0, -uTexel.y)).rgb
      ) * 0.25;

      // High-pass micro-contrast enhancement — gives the crisp tactile clarity of pre-rendered 2.5D assets
      vec3 sharpened = center.rgb + (center.rgb - blur) * uStrength;
      gl_FragColor = vec4(clamp(sharpened, 0.0, 1.0), center.a);
    }
  `,
};

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as unknown },
    uVignette: { value: 0.40 },
    uSaturation: { value: 1.04 },
    uContrast: { value: 1.06 },
    uGrain: { value: 0.008 },
    uTime: { value: 0 },
    uTint: { value: new Vector3(1, 1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uSaturation;
    uniform float uContrast;
    uniform float uGrain;
    uniform float uTime;
    uniform vec3 uTint;
    varying vec2 vUv;

    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 c = tex.rgb;

      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSaturation);
      c = (c - 0.5) * uContrast + 0.5;
      c *= uTint;

      vec2 d = vUv - 0.5;
      float vig = smoothstep(0.95, 0.32, length(d) * uVignette);
      c *= mix(1.0, vig, 0.45);

      float grain = fract(sin(dot(vUv * vec2(uTime, uTime * 1.3), vec2(12.9898, 78.233))) * 43758.5453);
      c += (grain - 0.5) * uGrain;

      gl_FragColor = vec4(c, tex.a);
    }
  `,
};

export class PostFX {
  private composer: EffectComposer;
  private renderPass: RenderPass;
  private bloomPass: UnrealBloomPass;
  private gradePass: ShaderPass;
  private sharpenPass: ShaderPass;
  private outputPass: OutputPass;
  private preset: QualityPreset = "high";

  constructor(
    private renderer: WebGLRenderer,
    scene: Scene,
    camera: Camera,
    width: number,
    height: number,
  ) {
    this.composer = new EffectComposer(renderer);
    this.composer.setSize(width, height);

    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    // Subtle bloom for lights, fire, emissives without washing out terrain
    this.bloomPass = new UnrealBloomPass(new Vector2(width, height), 0.25, 0.35, 0.90);
    this.composer.addPass(this.bloomPass);

    this.gradePass = new ShaderPass(GradeShader);
    this.composer.addPass(this.gradePass);

    this.sharpenPass = new ShaderPass(AoeSharpenShader);
    this.sharpenPass.enabled = true;
    (this.sharpenPass.uniforms.uTexel.value as Vector2).set(1 / width, 1 / height);
    this.composer.addPass(this.sharpenPass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    this.setQuality(this.preset);
  }

  setQuality(preset: QualityPreset): void {
    this.preset = preset;
    const bloomOn = preset !== "low";
    this.bloomPass.enabled = bloomOn;
    this.bloomPass.strength   = preset === "ultra" ? 0.35 : 0.25;
    this.bloomPass.radius     = preset === "ultra" ? 0.45 : 0.35;
    this.bloomPass.threshold  = preset === "ultra" ? 0.85 : 0.90;

    const uniforms = this.gradePass.uniforms;
    // Grounded diorama grading: natural saturation, rich micro-contrast
    (uniforms.uVignette.value   as number) = 0.40;
    (uniforms.uSaturation.value as number) = preset === "low" ? 1.00 : 1.04;
    (uniforms.uContrast.value   as number) = preset === "low" ? 1.02 : 1.06;
    (uniforms.uGrain.value      as number) = 0.008;
    (uniforms.uTint.value       as Vector3).set(1.0, 1.0, 1.0);

    // Tactical micro-sharpening for crisp diorama clarity
    this.sharpenPass.enabled = preset !== "low";
    (this.sharpenPass.uniforms.uStrength.value as number) = preset === "ultra" ? 0.45 : 0.35;
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
    (this.sharpenPass.uniforms.uTexel.value as Vector2).set(1 / width, 1 / height);
  }

  render(delta: number): void {
    (this.gradePass.uniforms.uTime.value as number) += delta;
    if (this.preset === "low") {
      this.renderer.render(
        this.renderPass.scene,
        this.renderPass.camera as Camera,
      );
      return;
    }
    this.composer.render(delta);
  }

  dispose(): void {
    this.composer.dispose();
  }
}
