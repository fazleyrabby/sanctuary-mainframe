import type { ResourceKey } from "../data/buildings";
import type { GameTime } from "../core/Time";
import type { GameState } from "../state/GameState";

interface ResourceDef {
  key: ResourceKey;
  label: string;
  category: "vital" | "mat" | "tech";
}

const RESOURCES: ResourceDef[] = [
  { key: "food", label: "FOOD", category: "vital" },
  { key: "water", label: "H₂O", category: "vital" },
  { key: "energy", label: "PWR", category: "vital" },
  { key: "wood", label: "WOOD", category: "mat" },
  { key: "stone", label: "STONE", category: "mat" },
  { key: "scrap", label: "SCRAP", category: "mat" },
  { key: "metal", label: "MTL", category: "mat" },
  { key: "data", label: "DATA", category: "tech" },
  { key: "compute", label: "AI", category: "tech" },
];

interface ToolDef {
  id: string;
  label: string;
  key: string;
  disabled?: boolean;
  hint?: string;
}

const TOOLS: ToolDef[] = [
  { id: "Build", label: "BUILD", key: "B" },
  { id: "Farm", label: "FARM", key: "F" },
  { id: "Research", label: "TECH", key: "T", disabled: true, hint: "Research systems still offline" },
  { id: "Explore", label: "SCOUT", key: "E", disabled: true, hint: "Scouting parties still organizing" },
  { id: "AI", label: "MAINFRAME", key: "M" },
];

export class HUD {
  private dayValue: HTMLElement;
  private clockValue: HTMLElement;
  private phaseValue: HTMLElement;
  private clockDot: HTMLElement;

  private popValue: HTMLElement;
  private moraleValue: HTMLElement;
  private healthValue: HTMLElement;

  private toolButtons: HTMLButtonElement[] = [];
  private resourceValues = new Map<ResourceKey, HTMLElement>();
  private resourceRates = new Map<ResourceKey, HTMLElement>();
  private resourceItems = new Map<ResourceKey, HTMLElement>();

  private warningBar: HTMLElement;
  private toast: HTMLElement;
  private systemCallback: (action: string) => void = () => {};

  constructor(private readonly root: HTMLElement) {
    const top = document.createElement("div");
    top.className = "hud-top-bar";

    // 1. Clock Section
    const clock = document.createElement("div");
    clock.className = "hud-sect hud-sect-clock";

    this.clockDot = document.createElement("div");
    this.clockDot.className = "status-dot day";

    const clockMeta = document.createElement("div");
    clockMeta.className = "clock-meta";

    const row1 = document.createElement("div");
    row1.className = "clock-row-top";
    this.dayValue = document.createElement("span");
    this.dayValue.className = "day-badge";
    this.dayValue.textContent = "DAY 1";
    this.clockValue = document.createElement("span");
    this.clockValue.className = "time-badge";
    this.clockValue.textContent = "07:00";
    row1.append(this.dayValue, this.clockValue);

    this.phaseValue = document.createElement("span");
    this.phaseValue.className = "phase-badge";
    this.phaseValue.textContent = "MORNING";

    clockMeta.append(row1, this.phaseValue);
    clock.append(this.clockDot, clockMeta);

    // Divider
    const div1 = document.createElement("div");
    div1.className = "hud-vdiv";

    // 2. Resources Section
    const resources = document.createElement("div");
    resources.className = "hud-sect hud-sect-resources";

    let currentCat = "";
    for (const resource of RESOURCES) {
      if (currentCat !== "" && currentCat !== resource.category) {
        const div = document.createElement("div");
        div.className = "res-separator";
        resources.append(div);
      }
      currentCat = resource.category;

      const item = document.createElement("div");
      item.className = `res-pill ${resource.key}`;

      const dot = document.createElement("span");
      dot.className = "res-dot";

      const label = document.createElement("span");
      label.className = "res-label";
      label.textContent = resource.label;

      const val = document.createElement("span");
      val.className = "res-val";
      val.textContent = "0";

      const rate = document.createElement("span");
      rate.className = "res-rate";

      item.append(dot, label, val, rate);
      resources.append(item);

      this.resourceValues.set(resource.key, val);
      this.resourceRates.set(resource.key, rate);
      this.resourceItems.set(resource.key, item);
    }

    // Divider
    const div2 = document.createElement("div");
    div2.className = "hud-vdiv";

    // 3. Colony Section
    const colony = document.createElement("div");
    colony.className = "hud-sect hud-sect-colony";

    const mkStat = (iconText: string, label: string) => {
      const wrap = document.createElement("div");
      wrap.className = "colony-stat-pill";
      const lbl = document.createElement("span");
      lbl.className = "colony-lbl";
      lbl.textContent = `${iconText} ${label}`;
      const val = document.createElement("span");
      val.className = "colony-num";
      val.textContent = "--";
      wrap.append(lbl, val);
      colony.append(wrap);
      return val;
    };

    this.popValue = mkStat("👥", "POP");
    this.moraleValue = mkStat("★", "MOR");
    this.healthValue = mkStat("✚", "HP");

    // Divider
    const div3 = document.createElement("div");
    div3.className = "hud-vdiv";

    // 4. System Section
    const system = document.createElement("div");
    system.className = "hud-sect hud-sect-system";

    for (const label of ["Save", "Load", "New"]) {
      const btn = document.createElement("button");
      btn.className = "sys-btn";
      btn.textContent = label;
      btn.addEventListener("click", () => this.systemCallback(label.toLowerCase()));
      system.append(btn);
    }

    top.append(clock, div1, resources, div2, colony, div3, system);

    this.warningBar = document.createElement("div");
    this.warningBar.className = "hud-warnings";
    this.warningBar.hidden = true;

    this.toast = document.createElement("div");
    this.toast.className = "hud-toast";
    this.toast.hidden = true;

    // Bottom command dock
    const bottom = document.createElement("div");
    bottom.className = "hud-bottom-dock";
    for (const tool of TOOLS) {
      const btn = document.createElement("button");
      btn.className = "dock-btn";
      btn.innerHTML = `<span class="dock-key">${tool.key}</span><span class="dock-label">${tool.label}</span>`;
      if (tool.disabled) {
        btn.classList.add("disabled");
        btn.title = tool.hint ?? "Not yet available";
      }
      bottom.append(btn);
      this.toolButtons.push(btn);
    }

    this.root.append(top, this.warningBar, this.toast, bottom);
  }

  update(time: GameTime, state: GameState): void {
    this.dayValue.textContent = `DAY ${time.day}`;
    this.clockValue.textContent = time.clockLabel;
    this.phaseValue.textContent = time.phase.toUpperCase();

    // Status dot color matches time phase
    this.clockDot.className = `status-dot ${time.phase.toLowerCase()}`;

    for (const resource of RESOURCES) {
      const value = state.resources[resource.key];
      const valElem = this.resourceValues.get(resource.key);
      if (valElem) valElem.textContent = String(Math.floor(value));

      const rate = state.rates[resource.key];
      const rateElem = this.resourceRates.get(resource.key);
      if (rateElem) {
        if (Math.abs(rate) < 0.05) {
          rateElem.textContent = "";
        } else {
          rateElem.textContent = `${rate > 0 ? "+" : ""}${rate.toFixed(1)}`;
          rateElem.classList.toggle("pos", rate > 0);
          rateElem.classList.toggle("neg", rate < 0);
        }
      }

      const item = this.resourceItems.get(resource.key);
      if (item) {
        item.classList.toggle("empty", value <= 0.5);
        item.classList.toggle("low", value > 0.5 && value <= 40);
      }
    }

    this.popValue.textContent = `${state.population}/${state.housing}`;
    this.moraleValue.textContent = `${Math.round(state.morale)}%`;
    this.healthValue.textContent = `${Math.round(state.health)}%`;

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
    this.toolButtons.forEach((button, index) => {
      button.classList.toggle("active", TOOLS[index]?.id === tool);
    });
  }

  onSystem(callback: (action: string) => void): void {
    this.systemCallback = callback;
  }

  onTool(callback: (tool: string) => void): void {
    this.toolButtons.forEach((button, index) => {
      if (TOOLS[index]?.disabled) return;
      button.addEventListener("click", () => {
        const tool = TOOLS[index]?.id ?? "Build";
        this.setActiveTool(tool);
        callback(tool);
      });
    });
  }
}
