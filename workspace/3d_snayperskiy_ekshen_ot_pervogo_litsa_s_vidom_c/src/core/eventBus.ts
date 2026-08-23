type Handler = (payload: unknown) => void

/** Типизированная шина событий. Каждый emit имеет слушателя, каждый слушатель —
 * отправителя; состояния передаются строками в нижнем регистре и всегда
 * разбираются веткой кода. */
export class EventBus {
  private map = new Map<string, Set<Handler>>()

  on(type: string, handler: Handler): () => void {
    let set = this.map.get(type)
    if (!set) {
      set = new Set<Handler>()
      this.map.set(type, set)
    }
    const typed: Handler = handler
    set.add(typed)
    return () => {
      set?.delete(typed)
    }
  }

  emit(type: string, payload?: unknown): void {
    const set = this.map.get(type)
    if (!set || set.size === 0) return
    for (const handler of set) handler(payload)
  }

  clear(): void {
    this.map.clear()
  }
}

export const bus = new EventBus()
