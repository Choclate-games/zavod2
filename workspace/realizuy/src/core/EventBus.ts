export type GameState = 'BOOT' | 'MENU' | 'PLAYING' | 'PAUSED' | 'WORKBENCH' | 'VICTORY' | 'DEFEAT'
export type InputScheme = 'desktop' | 'touch'

export interface GameEvents {
  GAME_STATE_CHANGED: (state: GameState) => void
  HP_CHANGED: (current: number, max: number) => void
  CASH_CHANGED: (cash: number) => void
  COMBO_CHANGED: (multiplier: number, count: number) => void
  WAVE_CHANGED: (current: number, total: number) => void
  RELOAD_SAVED_DATA: (saveData: unknown) => void
  INPUT_SCHEME_CHANGED: (scheme: InputScheme) => void
  HITSTOP_TRIGGERED: (duration: number) => void
  SCREEN_SHAKE: (trauma: number) => void
  SOUND_TRIGGERED: (soundId: string) => void
}

type EventKey = keyof GameEvents

export class EventBus {
  private static instance: EventBus
  private listeners: Map<EventKey, Set<(...args: any[]) => void>> = new Map()

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus()
    }
    return EventBus.instance
  }

  public on<K extends EventKey>(event: K, callback: GameEvents[K]): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    const set = this.listeners.get(event)!
    set.add(callback as (...args: any[]) => void)
    return () => this.off(event, callback)
  }

  public off<K extends EventKey>(event: K, callback: GameEvents[K]): void {
    const set = this.listeners.get(event)
    if (set) {
      set.delete(callback as (...args: any[]) => void)
    }
  }

  public emit<K extends EventKey>(event: K, ...args: Parameters<GameEvents[K]>): void {
    const set = this.listeners.get(event)
    if (set) {
      set.forEach((cb) => {
        try {
          cb(...args)
        } catch (err) {
          console.error(`Error in event listener for ${event}:`, err)
        }
      })
    }
  }
}

export const eventBus = EventBus.getInstance()
