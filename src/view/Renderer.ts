import {
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import { GameConfig } from "../core/GameConfig";

export interface RendererHandle {
  renderer: WebGLRenderer;
  resize: (width: number, height: number) => void;
  setPixelRatio: (ratio: number) => void;
}

export function createRenderer(canvas: HTMLCanvasElement): RendererHandle {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
    stencil: false,
  });

  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = GameConfig.render.exposure;
  renderer.shadowMap.enabled = GameConfig.render.shadows;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const setPixelRatio = (ratio: number): void => {
    renderer.setPixelRatio(Math.min(ratio, GameConfig.render.pixelRatioCap));
  };

  const resize = (width: number, height: number): void => {
    renderer.setSize(width, height, false);
  };

  setPixelRatio(window.devicePixelRatio);
  resize(window.innerWidth, window.innerHeight);

  return { renderer, resize, setPixelRatio };
}
