import type { MainframeReport } from "../systems/MainframeAdvisor";

export type MainframeAction = "accept" | "dismiss" | "why";

/**
 * Sanctuary Mainframe interface panel (PRD §43).
 * Distinct cold cyan-violet voice; sits left so it never covers the inspector.
 */
export class MainframePanel {
  private root: HTMLElement;
  private statusDot: HTMLElement;
  private statusText: HTMLElement;
  private priorityBox: HTMLElement;
  private adviceTitle: HTMLElement;
  private adviceDetail: HTMLElement;
  private confFill: HTMLElement;
  private confLabel: HTMLElement;
  private whyBox: HTMLElement;
  private whyReason: HTMLElement;
  private whyAlt: HTMLElement;
  private trustFill: HTMLElement;
  private trustLabel: HTMLElement;
  private acceptBtn: HTMLButtonElement;
  private dismissBtn: HTMLButtonElement;
  private whyBtn: HTMLButtonElement;

  private key = "";
  private whyVisible = false;

  constructor(
    uiRoot: HTMLElement,
    private readonly onAction: (id: MainframeAction) => void,
  ) {
    this.root = document.createElement("div");
    this.root.className = "mainframe";
    this.root.hidden = true;

    const header = document.createElement("div");
    header.className = "mainframe-header";
    this.statusDot = document.createElement("span");
    this.statusDot.className = "mainframe-dot";
    const title = document.createElement("span");
    title.className = "mainframe-title";
    title.textContent = "SANCTUARY MAINFRAME";
    this.statusText = document.createElement("span");
    this.statusText.className = "mainframe-status";
    header.append(this.statusDot, title, this.statusText);

    this.priorityBox = document.createElement("div");
    this.priorityBox.className = "mainframe-priorities";

    this.adviceTitle = document.createElement("div");
    this.adviceTitle.className = "mainframe-advice-title";
    this.adviceDetail = document.createElement("div");
    this.adviceDetail.className = "mainframe-advice-detail";

    const confRow = document.createElement("div");
    confRow.className = "mainframe-conf-row";
    const confTrack = document.createElement("div");
    confTrack.className = "mainframe-conf-track";
    this.confFill = document.createElement("div");
    this.confFill.className = "mainframe-conf-fill";
    confTrack.append(this.confFill);
    this.confLabel = document.createElement("span");
    this.confLabel.className = "mainframe-conf-label";
    confRow.append(confTrack, this.confLabel);

    this.whyBox = document.createElement("div");
    this.whyBox.className = "mainframe-why";
    this.whyBox.hidden = true;
    this.whyReason = document.createElement("div");
    this.whyReason.className = "mainframe-why-reason";
    this.whyAlt = document.createElement("div");
    this.whyAlt.className = "mainframe-why-alt";
    this.whyBox.append(this.whyReason, this.whyAlt);

    const buttons = document.createElement("div");
    buttons.className = "mainframe-buttons";
    this.acceptBtn = this.mkButton("Accept", "accept");
    this.dismissBtn = this.mkButton("Dismiss", "dismiss");
    this.whyBtn = this.mkButton("Ask Why", "why");
    buttons.append(this.acceptBtn, this.dismissBtn, this.whyBtn);

    const trustRow = document.createElement("div");
    trustRow.className = "mainframe-trust-row";
    const trustTrack = document.createElement("div");
    trustTrack.className = "mainframe-trust-track";
    this.trustFill = document.createElement("div");
    this.trustFill.className = "mainframe-trust-fill";
    trustTrack.append(this.trustFill);
    this.trustLabel = document.createElement("span");
    this.trustLabel.className = "mainframe-trust-label";
    trustRow.append(trustTrack, this.trustLabel);

    this.root.append(
      header,
      this.priorityBox,
      this.adviceTitle,
      this.adviceDetail,
      confRow,
      this.whyBox,
      buttons,
      trustRow,
    );
    uiRoot.append(this.root);
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  hide(): void {
    this.root.hidden = true;
    this.key = "";
    this.whyVisible = false;
  }

  toggle(report: MainframeReport, trust: number): boolean {
    if (this.visible) {
      this.hide();
    } else {
      this.root.hidden = false;
      this.render(report, trust);
    }
    return this.visible;
  }

  toggleWhy(): void {
    this.whyVisible = !this.whyVisible;
    this.key = "";
  }

  refresh(report: MainframeReport, trust: number): void {
    if (!this.visible) return;
    this.render(report, trust);
  }

  private mkButton(label: string, id: MainframeAction): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = `mainframe-btn ${id}`;
    btn.textContent = label;
    btn.addEventListener("click", () => this.onAction(id));
    return btn;
  }

  private render(report: MainframeReport, trust: number): void {
    const advice = report.advice;
    const nextKey = [
      report.status,
      advice?.id ?? "none",
      Math.round(trust),
      this.whyVisible ? "why" : "n why",
    ].join("|");
    if (nextKey === this.key) return;
    this.key = nextKey;

    this.statusText.textContent = report.status;
    this.statusText.dataset.tone = report.status;
    this.statusDot.dataset.tone = report.status;

    this.priorityBox.replaceChildren();
    for (const p of report.priorities.slice(0, 3)) {
      const row = document.createElement("div");
      row.className = "mainframe-priority";
      const label = document.createElement("span");
      label.textContent = p.key;
      const track = document.createElement("div");
      track.className = "mainframe-priority-track";
      const fill = document.createElement("div");
      fill.className = "mainframe-priority-fill";
      fill.style.width = `${Math.round(p.score)}%`;
      fill.dataset.hot = p.score >= 55 ? "true" : "false";
      track.append(fill);
      row.append(label, track);
      this.priorityBox.append(row);
    }

    if (advice) {
      this.adviceTitle.textContent = advice.title;
      this.adviceDetail.textContent = advice.detail;
      this.confFill.style.width = `${advice.confidence}%`;
      this.confLabel.textContent = `${advice.confidence}%`;
      this.whyReason.textContent = `Why: ${advice.reason}`;
      this.whyAlt.textContent = `Alternative: ${advice.alternative}`;
      this.acceptBtn.textContent = advice.action ? "Accept — build it" : "Accept";
    } else {
      this.adviceTitle.textContent = "The Mainframe is silent.";
      this.adviceDetail.textContent = "No colony left to optimize.";
      this.confFill.style.width = "0%";
      this.confLabel.textContent = "—";
      this.whyReason.textContent = "";
      this.whyAlt.textContent = "";
    }
    this.whyBox.hidden = !this.whyVisible || !advice;
    this.whyBtn.classList.toggle("active", this.whyVisible);

    this.trustFill.style.width = `${Math.round(trust)}%`;
    this.trustLabel.textContent = `TRUST ${Math.round(trust)}`;
  }
}
