// Типизированная шина событий. Кросс-системное общение — только через неё.
// Каждое событие имеет и отправителя, и слушателя (см. приёмка G2/G3).

export type BusHandler<T> = (payload: T) => void

export class EventBus {
  private readonly handlers = new Map<string, Set<BusHandler<never>>>()

  on<T>(event: string, handler: BusHandler<T>): void {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set()
      this.handlers.set(event, set)
    }
    set.add(handler as BusHandler<never>)
  }

  off<T>(event: string, handler: BusHandler<T>): void {
    const set = this.handlers.get(event)
    if (set) set.delete(handler as BusHandler<never>)
  }

  emit<T>(event: string, payload: T): void {
    const set = this.handlers.get(event)
    if (!set) return
    for (const handler of set) (handler as BusHandler<T>)(payload)
  }

  clear(): void {
    this.handlers.clear()
  }
}
