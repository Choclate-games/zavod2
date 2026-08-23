import type { Locale } from '../core/i18n.js'

export interface SaveData {
  unlockedPasses: number
  bestScores: Record<string, number>
  muted: boolean
  lang: Locale
}

const SAVE_KEY = 'unlocked_passes'
const MIRROR_KEY = 'unlocked_passes_mirror'
const WRITE_DEBOUNCE_MS = 1500

function defaults(): SaveData {
  return { unlockedPasses: 1, bestScores: {}, muted: false, lang: 'ru' }
}

function normalize(raw: unknown): SaveData {
  const base = defaults()
  if (typeof raw !== 'object' || raw === null) return base
  const source = raw as Partial<Record<keyof SaveData, unknown>>
  const unlocked = Number(source.unlockedPasses)
  if (Number.isFinite(unlocked) && unlocked >= 1) base.unlockedPasses = Math.floor(unlocked)
  if (source.bestScores && typeof source.bestScores === 'object') {
    for (const [key, value] of Object.entries(source.bestScores as Record<string, unknown>)) {
      const num = Number(value)
      if (Number.isFinite(num)) base.bestScores[key] = num
    }
  }
  base.muted = Boolean(source.muted)
  base.lang = source.lang === 'en' ? 'en' : 'ru'
  return base
}

/** Единственная точка сохранения: один ключ с одним JSON, нормализация при
 * чтении, зеркало в localStorage только для мгновенного офлайн-старта.
 * Настройки живут в сейве, не в localStorage. */
export class StorageService {
  private data: SaveData = defaults()
  private writeTimer = 0
  private bridgeGet?: (key: string) => Promise<string | null>
  private bridgeSet?: (key: string, value: string) => Promise<boolean>
  lastReadFailed = false

  attachBridge(bridge: { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<boolean> } | null): void {
    this.bridgeGet = bridge?.get.bind(bridge)
    this.bridgeSet = bridge?.set.bind(bridge)
  }

  get(): Readonly<SaveData> {
    return this.data
  }

  async load(): Promise<void> {
    let raw: string | null = null
    this.lastReadFailed = false
    try {
      raw = this.bridgeGet ? await this.bridgeGet(SAVE_KEY) : null
    } catch {
      // облачное чтение не должно молча понижать сейв до локального: помечаем сбой
      this.lastReadFailed = true
    }
    if (raw === null || typeof raw !== 'string') {
      try {
        raw = localStorage.getItem(MIRROR_KEY)
      } catch {
        raw = null
      }
    }
    this.data = normalize(this.parseJsonSafe(raw))
  }

  private parseJsonSafe(raw: string | null): unknown {
    if (!raw) return null
    try {
      return JSON.parse(raw) as unknown
    } catch {
      return null
    }
  }

  update(mutate: (data: SaveData) => void): void {
    mutate(this.data)
    this.scheduleWrite()
    this.flushMirror()
  }

  private scheduleWrite(): void {
    if (this.writeTimer) clearTimeout(this.writeTimer)
    this.writeTimer = setTimeout(() => {
      this.writeTimer = 0
      void this.flushCloud()
    }, WRITE_DEBOUNCE_MS)
  }

  /** Мгновенное зеркало для офлайн-запуска; облако пишется дебаунсом. */
  private flushMirror(): void {
    try {
      localStorage.setItem(MIRROR_KEY, JSON.stringify(this.data))
    } catch {
      /* хранилище недоступно (iframe без доступа) — играем дальше */
    }
  }

  private async flushCloud(): Promise<void> {
    if (!this.bridgeSet) return
    try {
      await this.bridgeSet(SAVE_KEY, JSON.stringify(this.data))
    } catch {
      /* повтор будет по следующему update() */
    }
  }

  /** Сброс отложенной записи при закрытии вкладки — на pagehide/visibilitychange,
   * не на beforeunload. */
  flush(): void {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer)
      this.writeTimer = 0
    }
    this.flushMirror()
    void this.flushCloud()
  }
}
