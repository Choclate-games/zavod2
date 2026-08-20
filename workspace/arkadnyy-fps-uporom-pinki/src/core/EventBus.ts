import { EventMap } from '../types';

type EventHandler<T> = (payload: T) => void;

export class EventBus {
  private static instance: EventBus;
  private listeners: { [K in keyof EventMap]?: Set<EventHandler<any>> } = {};

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set();
    }
    this.listeners[event]!.add(handler);
    return () => this.off(event, handler);
  }

  public off<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    const handlers = this.listeners[event];
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        delete this.listeners[event];
      }
    }
  }

  public emit<K extends keyof EventMap>(
    event: K,
    ...args: EventMap[K] extends void ? [] : [EventMap[K]]
  ): void {
    const handlers = this.listeners[event];
    if (handlers) {
      const payload = args[0];
      // Clone set to prevent issues if a handler unsubscribes during emit
      for (const handler of Array.from(handlers)) {
        try {
          handler(payload);
        } catch (err) {
          console.error(`[EventBus] Error in handler for ${String(event)}:`, err);
        }
      }
    }
  }

  public clear(): void {
    this.listeners = {};
  }
}
