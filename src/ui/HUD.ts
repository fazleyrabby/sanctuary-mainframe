import type { ResourceKey } from "../data/buildings";
import type { GameTime } from "../core/Time";
import type { GameState } from "../state/GameState";

interface ResourceDef {
  key: ResourceKey;
  label: string;
}

const RESOURCES: ResourceDef[] = [
  { key: "food", label: "FOOD" },
  { key: "water", label: "WATER" },
  { key: "energy", label: "ENERGY" },
  { key: "wood", label: "WOOD" },
  { key: "stone", label: "STONE" },
  { key: "scrap", label: "SCRAP" },
  { key: "metal", label: "METAL" },
  { key: "data", label: "DATA" },
  { key: "compute", label: "COMPUTE" },
];

const TOOLS = ["Build", "Farm", "Research", "Explore", "AI"];

export class HUD {
  private clockValue: HTMLElement;
  private phaseValue: HTMLElement;
  private toolButtons: HTMLButtonElement[] = [];
  private resourceValues = new Map<ResourceKey, HTMLElement>();
  private resourceRates = new Map<ResourceKey, HTMLElement>();
  private resourceItems = new Map<ResourceKey, HTMLElement>();
  private warningBar: HTMLElement;
  private colonyBar: HTMLElement;
  private toast: HTMLElement;
  private engineButton: HTMLButtonElement;
  private systemCallback: (action: string) => void = () => {};

  constructor(private readonly root: HTMLElement) {
    const top = document.createElement("div");
    top.className = "hud-top";

    const clock = document.createElement("div");
    clock.className = "hud-clock";
    this.clockValue = document.createElement("span");
    this.clockValue.className = "time";
    this.clockValue.textContent = "--:--";
    this.phaseValue = document.createElement("span");
    this.phaseValue.className = "phase";
    this.phaseValue.textContent = "morning";
    clock.append(this.clockValue, this.phaseValue);

    const resources = document.createElement("div");
    resources.className = "hud-resources";
    for (const resource of RESOURCES) {
      const item = document.createElement("div");
      item.className = `resource ${resource.key}`;

      const icon = document.createElement("span");
      icon.className = "icon";

      const label = document.createElement("span");
      label.textContent = resource.label;

      const value = document.createElement("span");
      value.className = "value";
      value.textContent = "0";

      const rate = document.createElement("span");
      rate.className = "rate";

      item.append(icon, label, value, rate);
      resources.append(item);

      this.resourceValues.set(resource.key, value);
      this.resourceRates.set(resource.key, rate);
      this.resourceItems.set(resource.key, item);
    }

    const colony = document.createElement("div");
    colony.className = "hud-colony";
    this.colonyBar = document.createElement("div");
    this.colonyBar.className = "colony-stat";
    colony.append(this.colonyBar);

    const system = document.createElement("div");
    system.className = "hud-system";

    const engineBtn = document.createElement("button");
    engineBtn.className = "sys-button engine-toggle";
    engineBtn.textContent = "ENGINE: 3D (THREE.JS)";
    engineBtn.title = "Click to toggle between Three.js (Orthographic 3D) and Pixi.js (2.5D Sprites)";
    engineBtn.addEventListener("click", () => this.systemCallback("toggle_engine"));
    this.engineButton = engineBtn;
    system.append(engineBtn);

    for (const label of ["Save", "Load", "New"]) {
      const button = document.createElement("button");
      button.className = "sys-button";
      button.textContent = label;
      button.addEventListener("click", () => this.systemCallback(label.toLowerCase()));
      system.append(button);
    }

    top.append(clock, resources, colony, system);

    const hint = document.createElement("div");
    hint.className = "hud-hint";
    hint.innerHTML =
      "<kbd>WASD</kbd> pan &nbsp; <kbd>drag</kbd> pan &nbsp; <kbd>wheel</kbd> zoom &nbsp; <kbd>Q/E</kbd> rotate<br>" +
      "<kbd>B</kbd> build &nbsp; <kbd>click</kbd> gather/select &nbsp; <kbd>R</kbd> rotate &nbsp; <kbd>space</kbd> pause";

    this.warningBar = document.createElement("div");
    this.warningBar.className = "hud-warnings";

    this.toast = document.createElement("div");
    this.toast.className = "hud-toast";
    this.toast.hidden = true;

    const bottom = document.createElement("div");
    bottom.className = "hud-bottom";
    for (const tool of TOOLS) {
      const button = document.createElement("button");
      button.className = "tool";
      button.textContent = tool;
      bottom.append(button);
      this.toolButtons.push(button);
    }

    this.root.append(top, hint, this.warningBar, this.toast, bottom);
  }

  update(time: GameTime, state: GameState): void {
    this.clockValue.textContent = `Day ${time.day}  ${time.clockLabel}`;
    this.phaseValue.textContent = time.phase;

    for (const resource of RESOURCES) {
      const value = state.resources[resource.key];
      const valueElement = this.resourceValues.get(resource.key);
      if (valueElement) valueElement.textContent = String(Math.floor(value));

      const rate = state.rates[resource.key];
      const rateElement = this.resourceRates.get(resource.key);
      if (rateElement) {
        if (Math.abs(rate) < 0.05) {
          rateElement.textContent = "";
        } else {
          rateElement.textContent = `${rate > 0 ? "+" : ""}${rate.toFixed(1)}/h`;
          rateElement.classList.toggle("positive", rate > 0);
          rateElement.classList.toggle("negative", rate < 0);
        }
      }

      const item = this.resourceItems.get(resource.key);
      if (item) {
        item.classList.toggle("empty", value <= 0.5);
        item.classList.toggle("low", value > 0.5 && value <= 40);
      }
    }

    this.colonyBar.textContent =
      `POP ${state.population}   MORALE ${Math.round(state.morale)}   HEALTH ${Math.round(state.health)}`;

    if (state.warnings.length === 0) {
      this.warningBar.hidden = true;
    } else {
      this.warningBar.hidden = false;
      this.warningBar.textContent = state.warnings.map((w) => `⚠ ${w}`).join("   ·   ");
    }
  }

  setToast(text: string): void {
    this.toast.textContent = text;
    this.toast.hidden = false;
  }

  clearToast(): void {
    this.toast.hidden = true;
  }

  setActiveTool(tool: string): void {
    this.toolButtons.forEach((button) => {
      button.classList.toggle("active", button.textContent === tool);
    });
  }

  setEngineMode(label: string): void {
    this.engineButton.textContent = `ENGINE: ${label.toUpperCase()}`;
  }

  onSystem(callback: (action: string) => void): void {
    this.systemCallback = callback;
  }

  onTool(callback: (tool: string) => void): void {
    this.toolButtons.forEach((button, index) => {
      button.addEventListener("click", () => {
        this.setActiveTool(TOOLS[index] as string);
        callback(TOOLS[index] as string);
      });
    });
  }
}
