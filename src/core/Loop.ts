export type TickFn = (fixedDelta: number) => void;
export type RenderFn = (delta: number, alpha: number) => void;

export class Loop {
  private fixedStep: number;
  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;
  private timeScale = 1;

  constructor(
    private readonly onTick: TickFn,
    private readonly onRender: RenderFn,
    ticksPerSecond = 10,
  ) {
    this.fixedStep = 1 / ticksPerSecond;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now() / 1000;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  setTimeScale(scale: number): void {
    this.timeScale = scale;
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.frame);

    const current = now / 1000;
    let delta = current - this.lastTime;
    this.lastTime = current;
    if (delta > 0.25) delta = 0.25;

    this.accumulator += delta * this.timeScale;

    let steps = 0;
    while (this.accumulator >= this.fixedStep && steps < 8) {
      this.onTick(this.fixedStep);
      this.accumulator -= this.fixedStep;
      steps += 1;
    }

    const alpha = this.accumulator / this.fixedStep;
    this.onRender(delta, alpha);
  };
}
