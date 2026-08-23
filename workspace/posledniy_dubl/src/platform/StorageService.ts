import type { EventBus } from '../core/EventBus.js'

/**
 * Сохранение игры: один ключ, один JSON, нормализация при чтении.
 * Мост площадки выбирает облако или локал сам; localStorage — только зеркало.
 */

export const SAVE_KEY = 'best_time_ms'

export interface SaveData {
  version: number
  bestTimeMs: number | null
  settings: { muted: boolean; volume: number }
}

const CURRENT_VERSION = 1

const FRESH: SaveData = {
  version: CURRENT_VERSION,
  bestTimeMs: null,
  settings: { muted: false, volume: 0.8 },
}

export function normalizeSave(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') return structuredClone(FRESH)
  const d = raw as Partial<SaveData>
  const settings = (d.settings ?? {}) as Partial<SaveData['settings']>
  return {
    version: CURRENT_VERSION,
    bestTimeMs: typeof d.bestTimeMs === 'number' && Number.isFinite(d.bestTimeMs) && d.bestTimeMs > 0
      ? d.bestTimeMs
      : null,
    settings: {
      muted: typeof settings.muted === 'boolean' ? settings.muted : FRESH.settings.muted,
      volume: typeof settings.volume === 'number' && settings.volume >= 0 && settings.volume <= 1
        ? settings.volume
        : FRESH.settings.volume,
    },
  }
}

interface StorageLike {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
}

export class StorageService {
  private data: SaveData = structuredClone(FRESH)
  private timer: ReturnType<typeof setTimeout> | null = null
  private storage: StorageLike | null = null

  constructor(private readonly events: EventBus) {}

  attachStorage(storage: StorageLike | null): void {
    this.storage = storage
  }

  async load(): Promise<SaveData> {
    let raw: unknown = null
    try {
      if (this.storage) raw = await this.storage.get(SAVE_KEY)
    } catch {
      raw = null
    }
    if (raw == null) {
      // Зеркало в localStorage — не единственная копия, а офлайн-фолбэк.
      try {
        const local = localStorage.getItem(SAVE_KEY)
        if (local) raw = JSON.parse(local)
      } catch {
        raw = null
      }
    }
    this.data = normalizeSave(raw)
    // Интерфейс обновляет рекорд в меню после догрузки облака.
    this.events.emit('save:loaded', { bestTimeMs: this.data.bestTimeMs })
    return this.data
  }

  get snapshot(): SaveData {
    return this.data
  }

  update(mutate: (data: SaveData) => void): void {
    mutate(this.data)
    this.scheduleFlush()
  }

  /** Немедленная запись (pagehide / visibilitychange). */
  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.writeNow()
  }

  private scheduleFlush(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      this.writeNow()
    }, 1500)
  }

  private writeNow(): void {
    const json = JSON.stringify(this.data)
    try {
      localStorage.setItem(SAVE_KEY, json)
    } catch {
      /* приватный режим — облако остаётся основным хранилищем */
    }
    const storage = this.storage
    if (storage) {
      void storage.set(SAVE_KEY, json).catch(() => { /* площадка недоступна */ })
    }
  }

  installLifecycleHooks(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.flush()
    })
    window.addEventListener('pagehide', () => this.flush())
  }
}
