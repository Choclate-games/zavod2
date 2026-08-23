import type { EventBus } from '../core/EventBus.js'

/**
 * Одно сохранение — один ключ — один JSON. Облако площадки через мост,
 * localStorage только зеркало для мгновенного офлайн-запуска: внутри iframe
 * площадки это партиционированное хранилище и единственной копией быть не может.
 */
const SAVE_KEY = 'best_survival_time_sec'
const WRITE_DEBOUNCE_MS = 1500

export interface SaveData {
  bestSurvivalTimeSec: number
  bestScore: number
  muted: boolean
  volume: number
}

export function defaultSave(): SaveData {
  return { bestSurvivalTimeSec: 0, bestScore: 0, muted: false, volume: 0.8 }
}

/** Битое или обрезанное сохранение поднимается на умолчаниях, а не роняет игру. */
export function normalizeSave(raw: unknown): SaveData {
  const base = defaultSave()
  if (typeof raw !== 'object' || raw === null) return base
  const source = raw as Record<string, unknown>
  const num = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return {
    bestSurvivalTimeSec: Math.max(0, num(source.bestSurvivalTimeSec, 0)),
    bestScore: Math.max(0, Math.round(num(source.bestScore, 0))),
    muted: typeof source.muted === 'boolean' ? source.muted : base.muted,
    volume: Math.min(1, Math.max(0, num(source.volume, base.volume))),
  }
}

export class StorageService {
  private data: SaveData = defaultSave()
  private writeTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly events: EventBus) {}

  get save(): SaveData {
    return this.data
  }

  async load(readCloud: (key: string) => Promise<string | null>): Promise<SaveData> {
    let loaded = defaultSave()
    try {
      const cloudRaw = await readCloud(SAVE_KEY)
      if (cloudRaw) loaded = normalizeSave(JSON.parse(cloudRaw))
    } catch {
      // Облачный сбой не должен молча обесценить сейв: читаем зеркало.
      try {
        const localRaw = localStorage.getItem(SAVE_KEY)
        if (localRaw) loaded = normalizeSave(JSON.parse(localRaw))
      } catch {}
    }
    this.data = loaded
    this.bindFlush()
    return this.data
  }

  update(mutate: (data: SaveData) => void): void {
    mutate(this.data)
    if (this.writeTimer) clearTimeout(this.writeTimer)
    this.writeTimer = setTimeout(() => void this.flush(), WRITE_DEBOUNCE_MS)
  }

  async flush(writeCloud?: (key: string, value: string) => Promise<boolean>): Promise<void> {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer)
      this.writeTimer = null
    }
    const serialized = JSON.stringify(this.data)
    try {
      localStorage.setItem(SAVE_KEY, serialized)
    } catch {}
    if (writeCloud) {
      try {
        await writeCloud(SAVE_KEY, serialized)
      } catch {}
    }
  }

  /** Сброс настроек звука приходит от кнопки интерфейса и от флага площадки. */
  applyMute(muted: boolean): void {
    if (this.data.muted === muted) return
    this.update((data) => {
      data.muted = muted
    })
    this.events.emit('audio:mute', { muted })
  }

  recordRun(survivedSec: number, score: number): boolean {
    const isRecord = survivedSec > this.data.bestSurvivalTimeSec || score > this.data.bestScore
    this.update((data) => {
      if (survivedSec > data.bestSurvivalTimeSec) data.bestSurvivalTimeSec = survivedSec
      if (score > data.bestScore) data.bestScore = score
    })
    return isRecord
  }

  private bindFlush(): void {
    const flushNow = (): void => {
      // Флаш без облачной записи: на pagehide асинхронный вызов всё равно не дойдёт.
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(this.data))
      } catch {}
    }
    document.addEventListener('pagehide', flushNow)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushNow()
    })
  }
}
