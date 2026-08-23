type EventHandler<T = any> = (data: T) => void

export class EventBus {
  private static instance: EventBus
  private handlers = new Map<string, Set<EventHandler>>()

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus()
    }
    return EventBus.instance
  }

  public on<T = any>(event: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    this.handlers.get(event)!.add(handler)
    return () => this.off(event, handler)
  }

  public off<T = any>(event: string, handler: EventHandler<T>): void {
    const set = this.handlers.get(event)
    if (set) {
      set.delete(handler)
      if (set.size === 0) {
        this.handlers.delete(event)
      }
    }
  }

  public emit<T = any>(event: string, data?: T): void {
    const set = this.handlers.get(event)
    if (set) {
      for (const handler of set) {
        try {
          handler(data)
        } catch (err) {
          console.error(`[EventBus] Error handling event ${event}:`, err)
        }
      }
    }
  }
}

export const events = EventBus.getInstance()
