import type { PlaygamaService } from './PlaygamaService'

// Единственная точка сохранения. Один ключ, один JSON, нормализация при чтении:
// битый или обрезанный сейв поднимается на умолчаниях, игра не падает никогда.

export const SAVE_KEY = 'player_high_score'

export interface SaveData {
  bestScore: number
  soundOn: boolean
  sensitivity: number
  lang: string
}

const DEFAULTS: SaveData = {
  bestScore: 0,
  soundOn: true,
  sensitivity: 1.0,
  lang: 'ru',
}

function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback
}

export function normalizeSave(raw: unknown): SaveData {
  if (typeof raw !== 'object' || raw == null) return { ...DEFAULTS }
  const record = raw as Record<string, unknown>
  const bestScore = clampNum(record.bestScore, 0, Number.MAX_SAFE_INTEGER, DEFAULTS.bestScore)
  let lang = DEFAULTS.lang
  if (record.lang === 'en' || record.lang === 'ru') lang = record.lang
  return {
    bestScore,
    soundOn: typeof record.soundOn === 'boolean' ? record.soundOn : DEFAULTS.soundOn,
    sensitivity: clampNum(record.sensitivity, 0.2, 3.0, DEFAULTS.sensitivity),
    lang,
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    // битый JSON -> умолчания
    return null
  }
}

export class StorageService {
  private current: SaveData = { ...DEFAULTS }
  private flushTimerId = 0

  constructor(private readonly platform: PlaygamaService) {}

  async load(): Promise<SaveData> {
    let raw: string | null = await this.platform.loadSave(SAVE_KEY)
    if (raw == null) raw = this.readLocalMirror()
    this.current = normalizeSave(raw == null ? null : parseJson(raw))
    return this.current
  }

  get data(): SaveData {
    return this.current
  }

  update(patch: Partial<SaveData>): void {
    this.current = normalizeSave({ ...this.current, ...patch })
    this.schedulePersist()
  }

  /** Debounce записи + немедленная выгрузка при уходе вкладки. */
  schedulePersist(): void {
    clearTimeout(this.flushTimerId)
    this.flushTimerId = window.setTimeout(() => this.flush(), 1500)
    if (!this.flushHooked) {
      this.flushHooked = true
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.flush()
      })
      window.addEventListener('pagehide', () => this.flush())
    }
  }

  flush(): void {
    clearTimeout(this.flushTimerId)
    const text = JSON.stringify(this.current)
    try {
      localStorage.setItem(SAVE_KEY, text)
    } catch {
      // приватный режим браузера — облако остаётся единственным местом
    }
    void this.platform.persistSave(SAVE_KEY, text)
  }

  private readLocalMirror(): string | null {
    try {
      return localStorage.getItem(SAVE_KEY)
    } catch {
      return null
    }
  }

  private flushHooked = false
}
