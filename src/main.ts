import "./style.css";
import { Game } from "./core/Game";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement | null;
const pixiCanvas = document.getElementById("pixi-canvas") as HTMLCanvasElement | null;
const uiRoot = document.getElementById("ui-layer") as HTMLElement | null;
const loading = document.getElementById("loading") as HTMLElement | null;

function fail(message: string, error?: unknown): void {
  if (loading) {
    const status = loading.querySelector(".loading-status") as HTMLElement | null;
    if (status) {
      status.textContent = message;
      status.style.color = "#d9664a";
    }
  }
  if (error) console.error(error);
}

async function boot(): Promise<void> {
  if (!canvas || !pixiCanvas || !uiRoot) {
    fail("MISSING DOM");
    return;
  }

  try {
    const game = new Game(canvas, pixiCanvas, uiRoot);
    await game.init();
    game.start();

    if (import.meta.env.DEV) {
      (window as unknown as { __game: Game }).__game = game;
    }

    requestAnimationFrame(() => {
      loading?.classList.add("hidden");
      window.setTimeout(() => loading?.remove(), 700);
    });
  } catch (error) {
    fail("INITIALIZATION FAILED", error);
  }
}

void boot();
