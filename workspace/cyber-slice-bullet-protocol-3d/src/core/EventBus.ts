export type EventCallback<T = any> = (data: T) => void;

class EventBusService {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  public on<T = any>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  public off<T = any>(event: string, callback: EventCallback<T>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  public emit<T = any>(event: string, data?: T): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const callback of set) {
        try {
          callback(data);
        } catch (e) {
          console.error(`Error in event listener for "${event}":`, e);
        }
      }
    }
  }

  public clear(): void {
    this.listeners.clear();
  }
}

export const EventBus = new EventBusService();
