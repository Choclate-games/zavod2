/**
 * Типизированная шина событий. Единственный канал связи между системами:
 * ввод, площадка, симуляция и интерфейс не знают друг о друге.
 */
export interface BusEvents {
  /** Площадка (или сворачивание вкладки) требует паузу. payload: paused */
  'platform:pause': boolean
  /** Площадка глушит или возвращает звук. payload: muted */
  'platform:audio': boolean
  /** Забег завершён: победа или причина провала, награда и время. */
  'game:over': { won: boolean; reason: string; gold: number; time: number }
  /** Активная схема управления сменилась. payload: 'desktop' | 'touch' */
  'scheme:changed': 'desktop' | 'touch'
  /** Сохранение изменилось (золото, улучшения). */
  'save:changed': void
  /** Игрок запросил выпад (тач-кнопка или клик): направление или null для автоцели. */
  'ui:lungeRequested': { x: number | null; z: number | null }
}

type Handler<T> = (payload: T) => void

export class EventBus {
  private handlers = new Map<keyof BusEvents, Set<Handler<never>>>()

  on<K extends keyof BusEvents>(event: K, handler: Handler<BusEvents[K]>): void {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set()
      this.handlers.set(event, set)
    }
    set.add(handler as Handler<never>)
  }

  off<K extends keyof BusEvents>(event: K, handler: Handler<BusEvents[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<never>)
  }

  emit<K extends keyof BusEvents>(event: K, payload: BusEvents[K]): void {
    const set = this.handlers.get(event)
    if (!set) return
    for (const handler of [...set]) (handler as Handler<BusEvents[K]>)(payload)
  }
}

export const bus = new EventBus()
