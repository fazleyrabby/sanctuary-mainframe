import { BUILD_MENU, BUILDINGS, formatCost, type BuildingId } from "../data/buildings";

export class BuildMenu {
  private root: HTMLElement;
  private items = new Map<BuildingId, HTMLButtonElement>();
  private activeId: BuildingId | null = null;
  private onSelectCb: (id: BuildingId) => void = () => {};

  constructor(uiRoot: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "build-menu";
    this.root.hidden = true;

    for (const id of BUILD_MENU) {
      const def = BUILDINGS[id];
      const button = document.createElement("button");
      button.className = "build-item";
      button.innerHTML = `
        <span class="build-name">${def.name}</span>
        <span class="build-cost">${formatCost(def.cost)}</span>
      `;
      button.addEventListener("click", () => {
        if (button.classList.contains("disabled")) return;
        this.onSelectCb(id);
      });
      this.items.set(id, button);
      this.root.append(button);
    }

    uiRoot.append(this.root);
  }

  onSelect(callback: (id: BuildingId) => void): void {
    this.onSelectCb = callback;
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
    this.setActive(null);
  }

  toggle(): boolean {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
    return this.visible;
  }

  setActive(id: BuildingId | null): void {
    this.activeId = id;
    this.items.forEach((button, key) => {
      button.classList.toggle("active", key === id);
    });
  }

  get active(): BuildingId | null {
    return this.activeId;
  }

  setAffordable(check: (id: BuildingId) => boolean): void {
    this.items.forEach((button, key) => {
      button.classList.toggle("disabled", !check(key));
    });
  }
}
