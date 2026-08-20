export type EventHandler<T> = (payload: T) => void;

export class EventBus<Events extends object> {
  private readonly listeners = new Map<keyof Events, Set<EventHandler<unknown>>>();

  on<Key extends keyof Events>(event: Key, handler: EventHandler<Events[Key]>): () => void {
    let handlers = this.listeners.get(event);
    if (!handlers) {
      handlers = new Set<EventHandler<unknown>>();
      this.listeners.set(event, handlers);
    }
    handlers.add(handler as EventHandler<unknown>);
    return () => this.off(event, handler);
  }

  off<Key extends keyof Events>(event: Key, handler: EventHandler<Events[Key]>): void {
    this.listeners.get(event)?.delete(handler as EventHandler<unknown>);
  }

  emit<Key extends keyof Events>(event: Key, payload: Events[Key]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const handler of handlers) handler(payload);
  }

  clear(): void {
    this.listeners.clear();
  }
}
