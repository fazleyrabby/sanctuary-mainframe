export type EventMap = {
  "time:tick": { hour: number; day: number };
  "time:phase": { phase: DayPhase };
  "world:ready": undefined;
  "quality:changed": { preset: string };
};

export type DayPhase = "dawn" | "morning" | "afternoon" | "dusk" | "night";

type Handler<T> = (payload: T) => void;

export class EventBus {
  private handlers = new Map<keyof EventMap, Set<Handler<unknown>>>();

  on<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<unknown>);
    return () => set?.delete(handler as Handler<unknown>);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of set) {
      (handler as Handler<EventMap[K]>)(payload);
    }
  }
}
