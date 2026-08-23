/** Типизированная шина событий: все межсистемные коммуникации идут через неё. */

export interface GameEvents {
  'state:changed': { state: GameState }
  'ammo:changed': { current: number; capacity: number }
  'marks:changed': { hits: number; max: number }
  'charges:changed': { charges: number; max: number }
  'route:progress': { pointsDone: number; pointsTotal: number }
  'objective:changed': { textKey: string }
  'timer:tick': { secondsLeft: number }
  'hitmarker:shown': { headshot: boolean }
  'zoom:changed': { active: boolean }
  'run:finished': { win: boolean; reasonKey: FailReasonKey | null; stats: RunStats }
  'save:loaded': { bestTimeMs: number | null }
}

export type GameState = 'MENU' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'FAIL'

export type FailReasonKey = 'fail_ammo' | 'fail_charges' | 'fail_hits' | 'fail_time'

export interface RunStats {
  timeMs: number
  shots: number
  hitsBody: number
  headshots: number
  rating: number
  bestTimeMs: number | null
  newRecord: boolean
}

type Handler<T> = (payload: T) => void

export class EventBus {
  private readonly handlers = new Map<keyof GameEvents, Set<Handler<never>>>()

  on<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>): void {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set()
      this.handlers.set(event, set)
    }
    set.add(handler as Handler<never>)
  }

  off<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<never>)
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(event)
    if (!set) return
    for (const handler of set) (handler as Handler<GameEvents[K]>)(payload)
  }
}
