/**
 * Типизированная шина событий. Единственный канал связи между слоями:
 * UI не знает про физику и рендер, ядро не знает про площадку.
 * Подписки создаются один раз при старте, в кадре шина только читается.
 */
export interface BusEvents {
  'boot:progress': number
  'boot:done': null
  'scheme:changed': 'desktop' | 'touch'
  'screen:changed': string
  'race:started': number
  'race:checkpoint': { index: number; split: number; delta: number }
  'race:finished': { time: number; volumeRatio: number; score: number; stars: number; win: boolean }
  'vehicle:crashed': { reason: 'fall' | 'rollover' }
  'slosh:impact': { strength: number }
  'drift:scored': { banked: number; total: number; multiplier: number }
  'pause:changed': boolean
  respawn: null
}

type Handler = (payload: never) => void

export class EventBus {
  private readonly listeners = new Map<string, Set<Handler>>()

  on<K extends keyof BusEvents>(event: K, handler: (payload: BusEvents[K]) => void): void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(handler as Handler)
  }

  off<K extends keyof BusEvents>(event: K, handler: (payload: BusEvents[K]) => void): void {
    this.listeners.get(event)?.delete(handler as Handler)
  }

  emit<K extends keyof BusEvents>(event: K, payload: BusEvents[K]): void {
    const set = this.listeners.get(event)
    if (!set) return
    for (const handler of set) handler(payload as never)
  }

  clear(): void {
    this.listeners.clear()
  }
}
