import {
  EXPEDITIONS,
  EXPEDITION_IDS,
  type ExpeditionDefinition,
} from "../data/expeditions";
import { formatCost } from "../data/buildings";
import type { GameState } from "../state/GameState";

export class ExpeditionPanel {
  private root: HTMLElement;
  private header: HTMLElement;
  private activeContainer: HTMLElement;
  private siteList: HTMLElement;

  constructor(
    uiRoot: HTMLElement,
    private readonly onDispatch: (site: ExpeditionDefinition) => void,
  ) {
    this.root = document.createElement("div");
    this.root.className = "expedition-panel";
    this.root.hidden = true;

    this.header = document.createElement("div");
    this.header.className = "expedition-header";

    const title = document.createElement("span");
    title.className = "expedition-title";
    title.textContent = "SCOUT EXPEDITIONS";

    const badge = document.createElement("span");
    badge.className = "expedition-badge";
    badge.textContent = "FIELD OPS";

    this.header.append(title, badge);

    this.activeContainer = document.createElement("div");
    this.activeContainer.className = "expedition-active-box";

    this.siteList = document.createElement("div");
    this.siteList.className = "expedition-grid";

    this.root.append(this.header, this.activeContainer, this.siteList);
    uiRoot.append(this.root);
  }

  toggle(state: GameState): boolean {
    if (this.root.hidden) {
      this.show(state);
      return true;
    } else {
      this.hide();
      return false;
    }
  }

  show(state: GameState): void {
    this.render(state);
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  get isVisible(): boolean {
    return !this.root.hidden;
  }

  render(state: GameState): void {
    // 1. Active Expeditions Box
    this.activeContainer.innerHTML = "";
    if (state.expeditions.length > 0) {
      for (const exp of state.expeditions) {
        const def = EXPEDITIONS[exp.siteId];
        if (!def) continue;
        const progressPct = Math.min(
          100,
          Math.round((exp.progressHours / def.durationHours) * 100),
        );
        const hoursRemaining = Math.max(
          0,
          Math.ceil(def.durationHours - exp.progressHours),
        );

        const titleRow = document.createElement("div");
        titleRow.className = "active-expedition-title-row";
        titleRow.innerHTML = `<span class="active-label">TEAM IN FIELD (${exp.teamSize} scout${exp.teamSize > 1 ? "s" : ""}):</span> <strong class="active-name">${def.name}</strong>`;

        const barWrap = document.createElement("div");
        barWrap.className = "active-progress-wrap expedition-bar";
        const fill = document.createElement("div");
        fill.className = "active-progress-fill expedition-fill";
        fill.style.width = `${progressPct}%`;
        barWrap.append(fill);

        const metaRow = document.createElement("div");
        metaRow.className = "active-research-meta";
        metaRow.innerHTML = `<span>${progressPct}% — return in ~${hoursRemaining}h</span><span>${state.availableWorkers()} colonist${state.availableWorkers() === 1 ? "" : "s"} home</span>`;

        this.activeContainer.append(titleRow, barWrap, metaRow);
      }
    } else {
      const empty = document.createElement("div");
      empty.className = "active-research-empty";
      empty.textContent = "No teams in the field. Dispatch an expedition below.";
      this.activeContainer.append(empty);
    }

    // 2. Site List
    this.siteList.innerHTML = "";
    for (const id of EXPEDITION_IDS) {
      const site = EXPEDITIONS[id];
      const inField = state.expeditions.some((e) => e.siteId === id);
      const canAfford = state.canAfford(site.cost);
      const crewOk = state.availableWorkers() - site.teamSize >= 1;

      const card = document.createElement("div");
      card.className = "tech-card expedition-card";
      if (inField) card.classList.add("active");

      const topRow = document.createElement("div");
      topRow.className = "tech-card-top";

      const name = document.createElement("div");
      name.className = "tech-name";
      name.textContent = site.name;

      const danger = document.createElement("span");
      danger.className = `expedition-danger d${site.danger}`;
      danger.textContent = `◆${site.danger}`;
      danger.title = `Danger ${site.danger}/5`;
      topRow.append(name, danger);

      const status = document.createElement("span");
      status.className = "tech-status";
      status.textContent = inField ? "TEAM AWAY" : "UNCHARTED";
      topRow.append(status);

      const desc = document.createElement("div");
      desc.className = "tech-desc";
      desc.textContent = site.description;

      const loot = document.createElement("div");
      loot.className = "tech-perk expedition-loot";
      const haul = site.loot.map((l) => `+${l.amount} ${l.resource}`).join(" · ");
      loot.innerHTML = `◈ Expected haul: <strong>${haul}</strong>${site.recruits > 0 ? ` + ${site.recruits} recruit${site.recruits > 1 ? "s" : ""}` : ""}`;

      const bottom = document.createElement("div");
      bottom.className = "tech-card-bottom";

      const costSpan = document.createElement("div");
      costSpan.className = "tech-cost";
      costSpan.textContent = `Rations: ${formatCost(site.cost)} · Team: ${site.teamSize} · Trek: ${site.durationHours}h`;
      bottom.append(costSpan);

      if (!inField) {
        const btn = document.createElement("button");
        btn.className = "tech-btn expedition-btn";
        btn.textContent = "DISPATCH";
        btn.disabled = !canAfford || !crewOk;
        if (!canAfford) btn.title = "Insufficient rations (food/water)";
        else if (!crewOk) btn.title = "Not enough colonists home — at least one must stay";
        btn.addEventListener("click", () => {
          this.onDispatch(site);
          this.render(state);
        });
        bottom.append(btn);
      }

      card.append(topRow, desc, loot, bottom);
      this.siteList.append(card);
    }
  }
}
