export type EventHandler<T = unknown> = (payload: T) => void;

export class EventBus {
  private listeners: Map<string, Set<EventHandler>> = new Map();

  on<T>(event: string, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    const wrapped = handler as EventHandler;
    set.add(wrapped);
    return () => set.delete(wrapped);
  }

  once<T>(event: string, handler: EventHandler<T>): () => void {
    let unsubscribe: (() => void) | null = null;
    const wrapped = (payload: T) => {
      handler(payload);
      if (unsubscribe) unsubscribe();
    };
    unsubscribe = this.on(event, wrapped);
    return unsubscribe;
  }

  emit<T>(event: string, payload?: T): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(payload);
      } catch (e) {
        console.error(`[EventBus] handler failed for ${event}`, e);
      }
    }
  }

  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

export const eventBus = new EventBus();
