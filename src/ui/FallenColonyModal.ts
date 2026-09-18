export class FallenColonyModal {
  private root: HTMLElement;
  private daysSurvivedText: HTMLElement;
  private shown = false;

  constructor(
    uiRoot: HTMLElement,
    private readonly onRestart: () => void,
  ) {
    this.root = document.createElement("div");
    this.root.className = "fallen-modal";
    this.root.hidden = true;

    const dialog = document.createElement("div");
    dialog.className = "fallen-dialog";

    const skull = document.createElement("div");
    skull.className = "fallen-icon";
    skull.textContent = "☠";

    const title = document.createElement("h1");
    title.className = "fallen-title";
    title.textContent = "THE COLONY HAS FALLEN";

    const subtitle = document.createElement("p");
    subtitle.className = "fallen-subtitle";
    subtitle.textContent = "Life support exhausted. The sanctuary grows cold.";

    this.daysSurvivedText = document.createElement("div");
    this.daysSurvivedText.className = "fallen-days";
    this.daysSurvivedText.textContent = "SURVIVED: 0 DAYS";

    const restartBtn = document.createElement("button");
    restartBtn.className = "fallen-btn";
    restartBtn.textContent = "BEGIN ANEW";
    restartBtn.addEventListener("click", () => {
      this.onRestart();
    });

    dialog.append(skull, title, subtitle, this.daysSurvivedText, restartBtn);
    this.root.append(dialog);
    uiRoot.append(this.root);
  }

  show(days: number): void {
    if (this.shown && !this.root.hidden) return;
    this.shown = true;
    this.daysSurvivedText.textContent = `SURVIVED: ${days} DAY${days === 1 ? "" : "S"}`;
    this.root.hidden = false;
  }

  hide(): void {
    this.shown = false;
    this.root.hidden = true;
  }
}
