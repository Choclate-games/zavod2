/**
 * Типизированная шина событий. Один экземпляр на игру экспортируется ниже.
 * Имена событий — из GameTopic, чтобы отправитель и слушатель не разошлись.
 */
export type Handler<T> = (payload: T) => void

export class EventBus<E extends object> {
  private handlers = new Map<keyof E, Set<Handler<never>>>()

  on<K extends keyof E>(topic: K, handler: Handler<E[K]>): () => void {    let set = this.handlers.get(topic)
    if (!set) {
      set = new Set()
      this.handlers.set(topic, set)
    }
    set.add(handler as Handler<never>)
    return () => this.off(topic, handler)
  }

  off<K extends keyof E>(topic: K, handler: Handler<E[K]>): void {
    this.handlers.get(topic)?.delete(handler as Handler<never>)
  }

  emit<K extends keyof E>(topic: K, payload: E[K]): void {
    const set = this.handlers.get(topic)
    if (!set) return
    for (const handler of set) (handler as Handler<E[K]>)(payload)
  }
}
