export type EventHandler<T> = (payload: T) => void

/** Типизированная шина событий: единственный канал связи между слоями. */
export class EventBus {
  private readonly handlers = new Map<string, Set<EventHandler<never>>>()

  on<T>(event: string, handler: EventHandler<T>): void {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set()
      this.handlers.set(event, set)
    }
    set.add(handler as EventHandler<never>)
  }

  off<T>(event: string, handler: EventHandler<T>): void {
    this.handlers.get(event)?.delete(handler as EventHandler<never>)
  }

  emit<T>(event: string, payload: T): void {
    const set = this.handlers.get(event)
    if (!set) return
    for (const handler of set) (handler as EventHandler<T>)(payload)
  }
}

export const bus = new EventBus()
