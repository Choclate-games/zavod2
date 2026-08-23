export type GameState = 'LOADING' | 'MENU' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'DEFEAT'

export interface RunSummary {
  victory: boolean
  score: number
  survivedSec: number
  chainKills: number
  overheatCount: number
  lighthouseHpRatio: number
  reviveUsed: boolean
}

export interface EventMap {
  'state:changed': { state: GameState }
  'hud:hp': { ratio: number }
  'hud:heat': { temp: number; locked: boolean }
  'hud:clock': { minutes: number }
  'hud:score': { score: number; combo: number }
  'hud:steam': { charged: boolean; progress: number }
  'world:combo': { count: number }
  'world:phase': { index: number; title: string }
  'world:beam': { focus: boolean; overheated: boolean }
  'fx:blast': { x: number; z: number }
  'fx:vaporize': { x: number; z: number; armored: boolean }
  'fx:steam': Record<string, never>
  'run:end': { summary: RunSummary }
  'platform:pause': { paused: boolean }
  'audio:mute': { muted: boolean }
  'input:scheme': { scheme: 'desktop' | 'touch' }
  'ui:action': { action: string }
  'fx:shake': { power: number }
}

type Handler<T> = (payload: T) => void

/** Типизированная публикация/подписка. Единственный канал связи слоёв. */
export class EventBus {
  private readonly handlers = new Map<keyof EventMap, Set<Handler<never>>>()

  on<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): void {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set()
      this.handlers.set(event, set)
    }
    set.add(handler as Handler<never>)
  }

  off<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<never>)
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const set = this.handlers.get(event)
    if (!set) return
    for (const handler of set) (handler as Handler<EventMap[K]>)(payload)
  }
}
