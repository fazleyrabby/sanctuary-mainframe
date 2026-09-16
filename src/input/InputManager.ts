export interface PointerClick {
  button: number;
  x: number;
  y: number;
}

const DRAG_THRESHOLD = 5;

export class InputManager {
  private keys = new Set<string>();
  private wheel = 0;
  private dragX = 0;
  private dragY = 0;
  private dragging = false;
  private pointerId: number | null = null;
  private lastX = 0;
  private lastY = 0;
  private downX = 0;
  private downY = 0;
  private moved = false;
  private clicks: PointerClick[] = [];
  private keyPresses: string[] = [];

  pointerX = 0;
  pointerY = 0;
  pointerInside = false;

  private disposers: Array<() => void> = [];

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.bind(window, "keydown", this.onKeyDown);
    this.bind(window, "keyup", this.onKeyUp);
    this.bind(window, "blur", this.onBlur);
    this.bind(canvas, "pointerdown", this.onPointerDown);
    this.bind(window, "pointermove", this.onPointerMove);
    this.bind(window, "pointerup", this.onPointerUp);
    this.bind(window, "pointercancel", this.onPointerUp);
    this.bind(canvas, "pointerenter", this.onPointerEnter);
    this.bind(canvas, "pointerleave", this.onPointerLeave);
    this.bind(canvas, "wheel", this.onWheel, { passive: false });
    this.bind(canvas, "contextmenu", (event) => event.preventDefault());
  }

  get moveRight(): number {
    return (this.has("d") || this.has("arrowright") ? 1 : 0) - (this.has("a") || this.has("arrowleft") ? 1 : 0);
  }

  get moveForward(): number {
    return (this.has("w") || this.has("arrowup") ? 1 : 0) - (this.has("s") || this.has("arrowdown") ? 1 : 0);
  }

  get isDragging(): boolean {
    return this.dragging;
  }

  has(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }

  consumeWheel(): number {
    const value = this.wheel;
    this.wheel = 0;
    return value;
  }

  consumeDrag(): { x: number; y: number } {
    const result = { x: this.dragX, y: this.dragY };
    this.dragX = 0;
    this.dragY = 0;
    return result;
  }

  consumeClicks(): PointerClick[] {
    const result = this.clicks;
    this.clicks = [];
    return result;
  }

  consumeKeyPresses(): string[] {
    const result = this.keyPresses;
    this.keyPresses = [];
    return result;
  }

  dispose(): void {
    this.disposers.forEach((dispose) => dispose());
    this.disposers = [];
  }

  private bind(
    target: EventTarget,
    type: string,
    handler: EventListener,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, handler, options);
    this.disposers.push(() => target.removeEventListener(type, handler, options));
  }

  private onKeyDown = (event: Event): void => {
    const keyboard = event as KeyboardEvent;
    const key = keyboard.key.toLowerCase();
    this.keys.add(key);
    if (!keyboard.repeat) this.keyPresses.push(key);
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
      event.preventDefault();
    }
  };

  private onKeyUp = (event: Event): void => {
    this.keys.delete((event as KeyboardEvent).key.toLowerCase());
  };

  private onBlur = (): void => {
    this.keys.clear();
    this.dragging = false;
  };

  private onPointerEnter = (event: Event): void => {
    this.pointerInside = true;
    this.updatePointer(event);
  };

  private onPointerLeave = (): void => {
    this.pointerInside = false;
  };

  private onPointerDown = (event: Event): void => {
    const pointer = event as PointerEvent;
    if (pointer.button !== 0 && pointer.button !== 1 && pointer.button !== 2) return;
    this.dragging = true;
    this.moved = false;
    this.pointerId = pointer.pointerId;
    this.lastX = pointer.clientX;
    this.lastY = pointer.clientY;
    this.downX = pointer.clientX;
    this.downY = pointer.clientY;
    this.canvas.setPointerCapture(pointer.pointerId);
  };

  private onPointerMove = (event: Event): void => {
    const pointer = event as PointerEvent;
    this.updatePointer(event);
    if (!this.dragging || pointer.pointerId !== this.pointerId) return;

    const dx = pointer.clientX - this.lastX;
    const dy = pointer.clientY - this.lastY;
    this.dragX += dx;
    this.dragY += dy;
    this.lastX = pointer.clientX;
    this.lastY = pointer.clientY;

    if (Math.hypot(pointer.clientX - this.downX, pointer.clientY - this.downY) > DRAG_THRESHOLD) {
      this.moved = true;
    }
  };

  private onPointerUp = (event: Event): void => {
    const pointer = event as PointerEvent;
    if (pointer.pointerId !== this.pointerId) return;

    if (!this.moved) {
      this.clicks.push({ button: pointer.button, x: pointer.clientX, y: pointer.clientY });
    }

    this.dragging = false;
    this.pointerId = null;
    if (this.canvas.hasPointerCapture(pointer.pointerId)) {
      this.canvas.releasePointerCapture(pointer.pointerId);
    }
  };

  private onWheel = (event: Event): void => {
    const wheel = event as WheelEvent;
    wheel.preventDefault();
    this.wheel += wheel.deltaY;
  };

  private updatePointer(event: Event): void {
    const pointer = event as PointerEvent;
    this.pointerX = pointer.clientX;
    this.pointerY = pointer.clientY;
  }
}
