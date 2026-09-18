import { TECHNOLOGIES, TECH_IDS, type TechDefinition } from "../data/research";
import { formatCost } from "../data/buildings";
import type { GameState } from "../state/GameState";

export class ResearchPanel {
  private root: HTMLElement;
  private header: HTMLElement;
  private techList: HTMLElement;
  private activeContainer: HTMLElement;

  constructor(
    uiRoot: HTMLElement,
    private readonly onStartResearch: (tech: TechDefinition) => void,
  ) {
    this.root = document.createElement("div");
    this.root.className = "research-panel";
    this.root.hidden = true;

    this.header = document.createElement("div");
    this.header.className = "research-header";

    const title = document.createElement("span");
    title.className = "research-title";
    title.textContent = "COLONY RESEARCH TREE";

    const badge = document.createElement("span");
    badge.className = "research-badge";
    badge.textContent = "TECH ARCHIVE";

    this.header.append(title, badge);

    this.activeContainer = document.createElement("div");
    this.activeContainer.className = "research-active-box";

    this.techList = document.createElement("div");
    this.techList.className = "research-grid";

    this.root.append(this.header, this.activeContainer, this.techList);
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
    // 1. Active Research Box
    this.activeContainer.innerHTML = "";
    if (state.activeResearch) {
      const activeTech = TECHNOLOGIES[state.activeResearch.id];
      const progressPct = Math.min(100, Math.round((state.activeResearch.progressHours / activeTech.researchHours) * 100));
      const hoursRemaining = Math.max(0, Math.ceil(activeTech.researchHours - state.activeResearch.progressHours));

      const titleRow = document.createElement("div");
      titleRow.className = "active-research-title-row";
      titleRow.innerHTML = `<span class="active-label">CURRENTLY RESEARCHING:</span> <strong class="active-name">${activeTech.name}</strong>`;

      const barWrap = document.createElement("div");
      barWrap.className = "active-progress-wrap";
      const fill = document.createElement("div");
      fill.className = "active-progress-fill";
      fill.style.width = `${progressPct}%`;
      barWrap.append(fill);

      const metaRow = document.createElement("div");
      metaRow.className = "active-research-meta";
      metaRow.innerHTML = `<span>${progressPct}% complete</span><span>~${hoursRemaining}h remaining</span>`;

      this.activeContainer.append(titleRow, barWrap, metaRow);
    } else {
      const empty = document.createElement("div");
      empty.className = "active-research-empty";
      empty.textContent = "No research in progress. Select a technology below to begin.";
      this.activeContainer.append(empty);
    }

    // 2. Tech List
    this.techList.innerHTML = "";
    for (const id of TECH_IDS) {
      const tech = TECHNOLOGIES[id];
      const isCompleted = state.isResearched(id);
      const isActive = state.activeResearch?.id === id;
      const prereqsMet = tech.prerequisites.every((p) => state.isResearched(p));
      const canAfford = state.canAfford(tech.cost);

      const card = document.createElement("div");
      card.className = `tech-card ${tech.category}`;
      if (isCompleted) card.classList.add("completed");
      else if (isActive) card.classList.add("active");
      else if (!prereqsMet) card.classList.add("locked");

      const topRow = document.createElement("div");
      topRow.className = "tech-card-top";

      const name = document.createElement("div");
      name.className = "tech-name";
      name.textContent = tech.name;

      const status = document.createElement("span");
      status.className = "tech-status";
      if (isCompleted) status.textContent = "COMPLETED";
      else if (isActive) status.textContent = "IN PROGRESS";
      else if (!prereqsMet) status.textContent = "LOCKED";
      else status.textContent = "AVAILABLE";

      topRow.append(name, status);

      const desc = document.createElement("div");
      desc.className = "tech-desc";
      desc.textContent = tech.description;

      const perk = document.createElement("div");
      perk.className = "tech-perk";
      perk.innerHTML = `★ <strong>${tech.perkSummary}</strong>`;

      const bottom = document.createElement("div");
      bottom.className = "tech-card-bottom";

      const costSpan = document.createElement("div");
      costSpan.className = "tech-cost";
      costSpan.textContent = `Cost: ${formatCost(tech.cost)} · Time: ${tech.researchHours}h`;

      if (tech.prerequisites.length > 0 && !prereqsMet) {
        const reqs = document.createElement("div");
        reqs.className = "tech-prereq";
        const reqNames = tech.prerequisites.map((p) => TECHNOLOGIES[p].name).join(", ");
        reqs.textContent = `Requires: ${reqNames}`;
        bottom.append(reqs);
      }

      bottom.append(costSpan);

      if (!isCompleted && !isActive) {
        const btn = document.createElement("button");
        btn.className = "tech-btn";
        btn.textContent = "RESEARCH";
        btn.disabled = !prereqsMet || !canAfford || state.activeResearch !== null;
        if (!canAfford) btn.title = "Insufficient Data/Compute resources";
        else if (state.activeResearch !== null) btn.title = "Another research project is already active";
        else if (!prereqsMet) btn.title = "Prerequisites not researched";

        btn.addEventListener("click", () => {
          this.onStartResearch(tech);
          this.render(state);
        });
        bottom.append(btn);
      }

      card.append(topRow, desc, perk, bottom);
      this.techList.append(card);
    }
  }
}
