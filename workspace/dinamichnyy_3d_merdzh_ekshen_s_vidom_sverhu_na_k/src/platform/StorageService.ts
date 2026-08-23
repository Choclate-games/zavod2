export type SaveData = {
  highScore: number
  totalRingouts: number
  equippedSkin: string
  muted: boolean
  volume: number
}

const KEY = 'player_high_score'
const DEFAULTS: SaveData = { highScore: 0, totalRingouts: 0, equippedSkin: 'thorn', muted: false, volume: 0.7 }

type StorageBridge = {
  storage?: {
    get: (key: string) => Promise<unknown>
    set: (key: string, value: string) => Promise<void>
  }
}

export class StorageService {
  private readonly bridge: StorageBridge | null
  private current: SaveData = { ...DEFAULTS }
  private timer: number | undefined

  constructor(bridge: StorageBridge | null) {
    this.bridge = bridge
  }

  async load(): Promise<SaveData> {
    let raw: unknown = null
    try {
      raw = this.bridge?.storage ? await this.bridge.storage.get(KEY) : localStorage.getItem(KEY)
    } catch (error) {
      console.warn('Cloud save unavailable, using local defaults.', error)
    }
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw) as unknown } catch { raw = null }
    }
    this.current = this.normalize(raw)
    return { ...this.current }
  }

  schedule(next: Partial<SaveData>): void {
    this.current = this.normalize({ ...this.current, ...next })
    if (this.timer !== undefined) window.clearTimeout(this.timer)
    this.timer = window.setTimeout(() => { void this.flush() }, 1500)
  }

  async flush(): Promise<void> {
    if (this.timer !== undefined) window.clearTimeout(this.timer)
    this.timer = undefined
    const value = JSON.stringify(this.current)
    try {
      if (this.bridge?.storage) await this.bridge.storage.set(KEY, value)
      localStorage.setItem(KEY, value)
    } catch (error) {
      console.warn('Save flush failed.', error)
    }
  }

  private normalize(value: unknown): SaveData {
    if (!value || typeof value !== 'object') return { ...DEFAULTS }
    const data = value as Record<string, unknown>
    return {
      highScore: typeof data.highScore === 'number' && Number.isFinite(data.highScore) ? Math.max(0, data.highScore) : DEFAULTS.highScore,
      totalRingouts: typeof data.totalRingouts === 'number' && Number.isFinite(data.totalRingouts) ? Math.max(0, data.totalRingouts) : DEFAULTS.totalRingouts,
      equippedSkin: typeof data.equippedSkin === 'string' ? data.equippedSkin : DEFAULTS.equippedSkin,
      muted: typeof data.muted === 'boolean' ? data.muted : DEFAULTS.muted,
      volume: typeof data.volume === 'number' && Number.isFinite(data.volume) ? Math.min(1, Math.max(0, data.volume)) : DEFAULTS.volume,
    }
  }
}
