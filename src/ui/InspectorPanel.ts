export interface InspectorRow {
  label: string;
  value: string;
  tone?: Tone;
}

export interface InspectorAction {
  id: string;
  label: string;
  payload?: unknown;
  disabled?: boolean;
  tone?: Tone;
}

export interface InspectorPlot {
  label: string;
  detail: string;
  tone?: Tone;
  actions: InspectorAction[];
}

export interface InspectorSeed {
  id: string;
  label: string;
  active: boolean;
}

export interface InspectorContent {
  title: string;
  subtitle: string;
  rows: InspectorRow[];
  actions?: InspectorAction[];
  seeds?: InspectorSeed[];
  plots?: InspectorPlot[];
}

type Tone = "default" | "good" | "warn" | "bad";

export class InspectorPanel {
  private root: HTMLElement;
  private title: HTMLElement;
  private subtitle: HTMLElement;
  private body: HTMLElement;

  private rowValues: HTMLElement[] = [];
  private rowElements: HTMLElement[] = [];
  private plotDetails: HTMLElement[] = [];
  private plotElements: HTMLElement[] = [];
  private actionButtons = new Map<string, HTMLButtonElement>();
  private key = "";

  constructor(
    uiRoot: HTMLElement,
    private readonly onAction: (id: string, payload?: unknown) => void,
  ) {
    this.root = document.createElement("div");
    this.root.className = "inspector";
    this.root.hidden = true;

    this.title = document.createElement("div");
    this.title.className = "inspector-title";

    this.subtitle = document.createElement("div");
    this.subtitle.className = "inspector-subtitle";

    this.body = document.createElement("div");
    this.body.className = "inspector-body";

    this.root.append(this.title, this.subtitle, this.body);
    uiRoot.append(this.root);
  }

  hide(): void {
    this.root.hidden = true;
    this.key = "";
  }

  show(content: InspectorContent): void {
    this.root.hidden = false;
    const nextKey = signature(content);
    if (nextKey !== this.key) {
      this.rebuild(content);
      this.key = nextKey;
    }
    this.refresh(content);
  }

  private rebuild(content: InspectorContent): void {
    this.title.textContent = content.title;
    this.subtitle.textContent = content.subtitle;
    this.body.replaceChildren();

    this.rowValues = [];
    this.rowElements = [];
    this.plotDetails = [];
    this.plotElements = [];
    this.actionButtons.clear();

    for (const row of content.rows) {
      const line = document.createElement("div");
      line.className = "inspector-row";
      const label = document.createElement("span");
      label.className = "inspector-label";
      label.textContent = row.label;
      const value = document.createElement("span");
      value.className = "inspector-value";
      line.append(label, value);
      this.body.append(line);
      this.rowValues.push(value);
      this.rowElements.push(line);
    }

    if (content.seeds && content.seeds.length > 0) {
      const seedRow = document.createElement("div");
      seedRow.className = "inspector-seeds";
      for (const seed of content.seeds) {
        const button = document.createElement("button");
        button.className = "seed-button";
        button.textContent = seed.label;
        button.addEventListener("click", () => this.onAction("seed", seed.id));
        seedRow.append(button);
        this.actionButtons.set(`seed:${seed.id}`, button);
      }
      this.body.append(seedRow);
    }

    if (content.actions) {
      const row = document.createElement("div");
      row.className = "inspector-actions";
      for (const action of content.actions) {
        const button = document.createElement("button");
        button.className = `action-button${action.tone ? ` ${action.tone}` : ""}`;
        button.textContent = action.label;
        if (action.disabled) button.disabled = true;
        button.addEventListener("click", () => this.onAction(action.id, action.payload));
        row.append(button);
        this.actionButtons.set(action.id, button);
      }
      this.body.append(row);
    }

    if (content.plots) {
      const list = document.createElement("div");
      list.className = "inspector-plots";
      for (const plot of content.plots) {
        const item = document.createElement("div");
        item.className = "plot-row";

        const label = document.createElement("span");
        label.className = "plot-label";
        label.textContent = plot.label;

        const detail = document.createElement("span");
        detail.className = "plot-detail";
        detail.textContent = plot.detail;

        const actions = document.createElement("span");
        actions.className = "plot-actions";
        plot.actions.forEach((action, actionIndex) => {
          const button = document.createElement("button");
          button.className = "action-button small";
          button.textContent = action.label;
          button.addEventListener("click", () => this.onAction(action.id, action.payload));
          actions.append(button);
          this.actionButtons.set(`plot:${plot.label}:${actionIndex}`, button);
        });

        item.append(label, detail, actions);
        list.append(item);
        this.plotDetails.push(detail);
        this.plotElements.push(item);
      }
      this.body.append(list);
    }
  }

  private refresh(content: InspectorContent): void {
    content.rows.forEach((row, index) => {
      const value = this.rowValues[index];
      const element = this.rowElements[index];
      if (!value || !element) return;
      if (value.textContent !== row.value) value.textContent = row.value;
      setTone(element, row.tone);
    });

    content.actions?.forEach((action) => {
      const button = this.actionButtons.get(action.id);
      if (button) button.disabled = action.disabled ?? false;
    });

    content.seeds?.forEach((seed) => {
      const button = this.actionButtons.get(`seed:${seed.id}`);
      button?.classList.toggle("active", seed.active);
    });

    content.plots?.forEach((plot, plotIndex) => {
      const detail = this.plotDetails[plotIndex];
      if (detail && detail.textContent !== plot.detail) detail.textContent = plot.detail;
      setTone(this.plotElements[plotIndex], plot.tone);
      plot.actions.forEach((action, actionIndex) => {
        const button = this.actionButtons.get(`plot:${plot.label}:${actionIndex}`);
        if (button) button.disabled = action.disabled ?? false;
      });
    });
  }
}

function setTone(element: HTMLElement | undefined, tone: Tone | undefined): void {
  if (!element) return;
  element.classList.remove("good", "warn", "bad");
  if (tone && tone !== "default") element.classList.add(tone);
}

function signature(content: InspectorContent): string {
  return [
    content.title,
    content.subtitle,
    content.rows.map((r) => r.label).join("|"),
    content.actions?.map((a) => a.label).join("|") ?? "",
    content.seeds?.map((s) => s.label).join("|") ?? "",
    content.plots?.map((p) => `${p.label}:${p.actions.map((a) => a.label).join(",")}`).join("|") ?? "",
  ].join("::");
}
