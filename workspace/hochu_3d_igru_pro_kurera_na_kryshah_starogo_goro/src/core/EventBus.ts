/**
 * Strongly-typed EventBus for decoupled game communication.
 */
export type EventCallback<T = any> = (payload: T) => void

export class EventBus {
  private listeners = new Map<string, Set<EventCallback>>()

  public on<T = any>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
    return () => this.off(event, callback)
  }

  public subscribe<T = any>(event: string, callback: EventCallback<T>): () => void {
    return this.on(event, callback)
  }

  public off<T = any>(event: string, callback: EventCallback<T>): void {
    const set = this.listeners.get(event)
    if (set) {
      set.delete(callback)
      if (set.size === 0) {
        this.listeners.delete(event)
      }
    }
  }

  public emit<T = any>(event: string, payload?: T): void {
    const set = this.listeners.get(event)
    if (set) {
      for (const callback of set) {
        try {
          callback(payload)
        } catch (err) {
          console.error(`[EventBus] Error in event listener for ${event}:`, err)
        }
      }
    }
  }

  public clear(): void {
    this.listeners.clear()
  }
}

export const events = new EventBus()
