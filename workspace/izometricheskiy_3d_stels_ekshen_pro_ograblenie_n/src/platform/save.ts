import { bus } from '../core/events.js'
import { pg, SAVE_KEY } from './playgama.js'

/** Улучшения из мастерской: уровни покупаются за золото и влияют на забег. */
export interface Upgrades {
  confettiStock: number
  silentSteps: number
  strongGuard: number
}

export interface SaveData {
  gold: number
  bestTimeMs: number
  wins: number
  runs: number
  noAdsOwned: boolean
  soundOn: boolean
  upgrades: Upgrades
}

const UPGRADE_MAX_LEVEL = 2

function normalize(raw: unknown): SaveData {
  const src = (typeof raw === 'object' && raw !== null) ? raw as Partial<SaveData> : {}
  const upgradesSrc = (typeof src.upgrades === 'object' && src.upgrades !== null)
    ? src.upgrades as Partial<Upgrades> : {}
  const clampLevel = (value: unknown): number =>
    Math.max(0, Math.min(UPGRADE_MAX_LEVEL, Math.round(Number(value) || 0)))
  return {
    gold: Math.max(0, Math.round(Number(src.gold) || 0)),
    bestTimeMs: Math.max(0, Number(src.bestTimeMs) || 0),
    wins: Math.max(0, Math.round(Number(src.wins) || 0)),
    runs: Math.max(0, Math.round(Number(src.runs) || 0)),
    noAdsOwned: Boolean(src.noAdsOwned),
    soundOn: src.soundOn === undefined ? true : Boolean(src.soundOn),
    upgrades: {
      confettiStock: clampLevel(upgradesSrc.confettiStock),
      silentSteps: clampLevel(upgradesSrc.silentSteps),
      strongGuard: clampLevel(upgradesSrc.strongGuard),
    },
  }
}

class SaveService {
  private data: SaveData = normalize(undefined)
  private timer: ReturnType<typeof setTimeout> | null = null

  get snapshot(): SaveData {
    return this.data
  }

  async load(): Promise<SaveData> {
    let parsed: unknown = null
    try {
      const raw = await pg.loadRaw(SAVE_KEY)
      if (raw) parsed = JSON.parse(raw)
    } catch {
      // Битый JSON — игра стартует на значениях по умолчанию.
      parsed = null
    }
    this.data = normalize(parsed)
    if (this.data.noAdsOwned) pg.noAds = true
    return this.data
  }

  /** Отложенная запись: частые изменения склеиваются в один flush. */
  update(mutate: (data: SaveData) => void): void {
    mutate(this.data)
    if (pg.noAds) this.data.noAdsOwned = true
    bus.emit('save:changed', undefined)
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      void this.flush()
    }, 300)
  }

  /** Немедленная запись: вызывается на visibilitychange/pagehide. */
  async flush(): Promise<void> {
    try {
      await pg.persistRaw(SAVE_KEY, JSON.stringify(this.data))
    } catch {
      /* хранилище недоступно — прогресс живёт до перезагрузки вкладки */
    }
  }

  upgradeCost(level: number): number {
    return 150 + level * 150
  }

  maxLevel(): number {
    return UPGRADE_MAX_LEVEL
  }
}

export const save = new SaveService()

export function bindFlushOnHide(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void save.flush()
  })
  window.addEventListener('pagehide', () => {
    void save.flush()
  })
}
