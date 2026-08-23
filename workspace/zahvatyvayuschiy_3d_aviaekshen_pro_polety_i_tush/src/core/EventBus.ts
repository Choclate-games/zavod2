/**
 * Типизированная шина событий без аллокаций в кадре: массивы слушателей
 * создаются один раз при первом on(), emit только обходит их.
 */

export interface GameEventMap {
  /** Смена состояния игры: MENU / PLAYING / PAUSED. */
  'game:state': GameState
  /** Пауза площадки (реклама, сворачивание вкладки). */
  'platform:pause': boolean
}

export type GameState = 'MENU' | 'PLAYING' | 'PAUSED'

type Handler<T> = (payload: T) => void

export class EventBus {
  private readonly handlers = new Map<keyof GameEventMap, Set<Handler<never>>>()

  on<K extends keyof GameEventMap>(event: K, handler: Handler<GameEventMap[K]>): void {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set()
      this.handlers.set(event, set)
    }
    set.add(handler as Handler<never>)
  }

  off<K extends keyof GameEventMap>(event: K, handler: Handler<GameEventMap[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<never>)
  }

  emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void {
    const set = this.handlers.get(event)
    if (!set) return
    for (const handler of set) (handler as Handler<GameEventMap[K]>)(payload)
  }
}
