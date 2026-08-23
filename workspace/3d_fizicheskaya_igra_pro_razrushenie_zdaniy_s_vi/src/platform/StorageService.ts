import type { EventBus } from '../core/EventBus'

const SAVE_KEY = 'seismo_unlocked_levels'
const FLUSH_DEBOUNCE_MS = 1500

export type SaveData = {
  unlocked: number
  stars: number[]
  muted: boolean
}

export function defaultSave(totalLevels: number): SaveData {
  return { unlocked: 1, stars: new Array<number>(totalLevels).fill(0), muted: false }
}

/** Нормализация чтения: битое или обрезанное сохранение поднимается на умолчаниях. */
export function normalizeSave(raw: unknown, totalLevels: number): SaveData {
  const base = defaultSave(totalLevels)
  if (typeof raw !== 'object' || raw === null) return base
  const record = raw as Record<string, unknown>
  const unlocked = Number(record['unlocked'])
  if (Number.isFinite(unlocked) && unlocked >= 1) base.unlocked = Math.min(Math.floor(unlocked), totalLevels)
  if (Array.isArray(record['stars'])) {
    for (let i = 0; i < Math.min(base.stars.length, record['stars'].length); i++) {
      const s = Number(record['stars'][i])
      base.stars[i] = Number.isFinite(s) ? Math.min(3, Math.max(0, Math.floor(s))) : 0
    }
  }
  base.muted = record['muted'] === true
  return base
}

/**
 * Единственная точка сохранения: один ключ, один JSON. Зеркалим в localStorage,
 * но облако — основная копия; запись дебаунсится и флашится при уходе вкладки.
 */
export class StorageService {
  private current: SaveData
  private flushTimer: number | null = null

  constructor(
    private readonly totalLevels: number,
    private readonly cloudGet: (key: string) => Promise<unknown>,
    private readonly cloudSet: (key: string, value: unknown) => Promise<boolean>,
    private readonly events: EventBus,
  ) {
    this.current = this.readLocalMirror()
    window.addEventListener('pagehide', () => void this.flushNow())
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void this.flushNow()
    })
  }

  get data(): SaveData {
    return this.current
  }

  async loadFromCloud(): Promise<void> {
    const raw = await this.cloudGet(SAVE_KEY)
    if (raw !== undefined && raw !== null) {
      this.current = normalizeSave(raw, this.totalLevels)
      this.writeLocalMirror(this.current)
    }
  }

  setStars(levelIndex: number, stars: number): void {
    if (levelIndex < 0 || levelIndex >= this.totalLevels) return
    if (stars <= (this.current.stars[levelIndex] ?? 0)) return
    this.current.stars[levelIndex] = stars
    this.current.unlocked = Math.max(this.current.unlocked, Math.min(this.totalLevels, levelIndex + 2))
    this.scheduleFlush()
  }

  setMuted(muted: boolean): void {
    if (this.current.muted === muted) return
    this.current.muted = muted
    this.events.emit('audio:muted', { muted })
    this.scheduleFlush()
  }

  scheduleFlush(): void {
    if (this.flushTimer !== null) return
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null
      void this.flushNow()
    }, FLUSH_DEBOUNCE_MS)
  }

  async flushNow(): Promise<void> {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    this.writeLocalMirror(this.current)
    await this.cloudSet(SAVE_KEY, this.current)
  }

  private readLocalMirror(): SaveData {
    let parsed: unknown = undefined
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (raw !== null) parsed = JSON.parse(raw)
    } catch {
      parsed = undefined
    }
    return normalizeSave(parsed, this.totalLevels)
  }

  private writeLocalMirror(data: SaveData): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data))
    } catch {
      // зеркало не критично: облако остаётся основной копией
    }
  }
}
