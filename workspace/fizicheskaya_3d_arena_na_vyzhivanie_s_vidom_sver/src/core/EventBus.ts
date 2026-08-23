/**
 * Типизированная шина событий. Единственный канал связи между слоями:
 * геймплей не знает про интерфейс, интерфейс — про физику и рендер.
 * Подписки хранятся в предвыделенных массивах — шина не аллоцирует в кадре.
 */
export interface BusEvents {
  'match:phase': { value: 'IDLE' | 'COUNTDOWN' | 'PLAYING' | 'ROUND_OVER' }
  'match:over': { place: number; trophies: number; coins: number; survived: boolean }
  'revive:offer': { alive: number }
  'revive:used': { ok: boolean }
  'tube:killed': { victim: string; killer: string; byPlayer: boolean }
  'arena:collapse': { index: number }
  'hud:timer': { seconds: number }
  'hud:survivors': { count: number }
  'hud:nitro': { ratio: number }
  'hud:mass': { kilograms: number }
  'hud:radar': { mask: number }
  'hud:countdown': { label: string }
  'platform:pause': { value: 'PAUSED' | 'RESUMED' }
  'platform:audio': { value: 'MUTED' | 'UNMUTED' }
}

type Handler<T> = (payload: T) => void

export class EventBus {
  private readonly handlers: Map<string, Array<Handler<never>>> = new Map()

  on<K extends keyof BusEvents>(event: K, handler: Handler<BusEvents[K]>): void {
    const list = this.handlers.get(event)
    if (list) {
      list.push(handler as Handler<never>)
    } else {
      this.handlers.set(event, [handler as Handler<never>])
    }
  }

  off<K extends keyof BusEvents>(event: K, handler: Handler<BusEvents[K]>): void {
    const list = this.handlers.get(event)
    if (!list) return
    const index = list.indexOf(handler as Handler<never>)
    if (index >= 0) list.splice(index, 1)
  }

  emit<K extends keyof BusEvents>(event: K, payload: BusEvents[K]): void {
    const list = this.handlers.get(event)
    if (!list) return
    for (let i = 0; i < list.length; i++) {
      ;(list[i] as unknown as Handler<BusEvents[K]>)(payload)
    }
  }

  clear(): void {
    this.handlers.clear()
  }
}
