import { EVENTS, type GameEvent } from "../data/events";
import type { GameState } from "../state/GameState";

function effectLine(cost: { resource: string; amount: number }[] | undefined): string {
  if (!cost || cost.length === 0) return "";
  return cost.map((c) => `−${c.amount} ${c.resource}`).join(" · ");
}

export class EventModal {
  private root: HTMLElement;
  private kicker: HTMLElement;
  private title: HTMLElement;
  private story: HTMLElement;
  private optionsBox: HTMLElement;
  private shownId: string | null = null;

  constructor(
    uiRoot: HTMLElement,
    private readonly onChoose: (eventId: string, optionId: string) => void,
  ) {
    this.root = document.createElement("div");
    this.root.className = "event-modal";
    this.root.hidden = true;

    const dialog = document.createElement("div");
    dialog.className = "event-dialog";

    this.kicker = document.createElement("div");
    this.kicker.className = "event-kicker";
    this.title = document.createElement("h2");
    this.title.className = "event-title";
    this.story = document.createElement("p");
    this.story.className = "event-story";
    this.optionsBox = document.createElement("div");
    this.optionsBox.className = "event-options";

    dialog.append(this.kicker, this.title, this.story, this.optionsBox);
    this.root.append(dialog);
    uiRoot.append(this.root);
  }

  get isVisible(): boolean {
    return !this.root.hidden;
  }

  /** Show the pending event; no-op while one is already displayed. */
  show(eventId: string, state: GameState): void {
    const event = EVENTS[eventId];
    if (!event) return;
    if (this.shownId === eventId && !this.root.hidden) {
      this.refreshAffordability(event, state);
      return;
    }
    this.shownId = eventId;
    this.render(event, state);
    this.root.hidden = false;
  }

  hide(): void {
    this.shownId = null;
    this.root.hidden = true;
  }

  private refreshAffordability(event: GameEvent, state: GameState): void {
    const buttons = this.optionsBox.querySelectorAll<HTMLButtonElement>(".event-btn");
    event.options.forEach((opt, i) => {
      const btn = buttons[i];
      if (!btn) return;
      const blocked = (opt.cost ?? []).some((c) => state.resources[c.resource] < c.amount);
      btn.disabled = blocked;
    });
  }

  private render(event: GameEvent, state: GameState): void {
    this.root.classList.toggle("mainframe-event", event.mainframe === true);
    this.kicker.textContent = event.kicker;
    this.title.textContent = event.title;
    this.story.textContent = event.story;
    this.optionsBox.replaceChildren();

    for (const opt of event.options) {
      const btn = document.createElement("button");
      btn.className = "event-btn";

      const label = document.createElement("div");
      label.className = "event-btn-label";
      label.textContent = opt.label;

      const price = effectLine(opt.cost);
      if (price) {
        const costLine = document.createElement("div");
        costLine.className = "event-btn-cost";
        costLine.textContent = price;
        btn.append(label, costLine);
      } else {
        btn.append(label);
      }

      const blocked = (opt.cost ?? []).some((c) => state.resources[c.resource] < c.amount);
      btn.disabled = blocked;
      if (blocked) btn.title = "Cannot afford the cost right now";

      btn.addEventListener("click", () => this.onChoose(event.id, opt.id));
      this.optionsBox.append(btn);
    }
  }
}
