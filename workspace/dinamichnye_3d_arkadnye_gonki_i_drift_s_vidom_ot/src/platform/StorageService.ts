import type { PlaygamaService } from './PlaygamaService'

/**
 * Единая точка сохранения. Один ключ, один JSON, нормализация при чтении:
 * битое или обрезанное сохранение поднимает игру на значениях по умолчанию.
 * Облако площадки — основная копия, localStorage — зеркало для мгновенного
 * старта, но не единственная копия.
 */

export const SAVE_KEY = 'unlocked_tracks_mask'

export interface SaveData {
  unlockedMask: number
  bestScores: Record<string, number>
  bestTimes: Record<string, number>
  starsByTrack: Record<string, number>
  settingsMuted: boolean
  settingsVolume: number
  baffleLevel: number
  tankerRunsLeft: number
}

function defaults(): SaveData {
  return {
    unlockedMask: 1,
    bestScores: {},
    bestTimes: {},
    starsByTrack: {},
    settingsMuted: false,
    settingsVolume: 0.8,
    baffleLevel: 0,
    tankerRunsLeft: 0,
  }
}

function normalize(raw: unknown): SaveData {
  const base = defaults()
  if (!raw || typeof raw !== 'object') return base
  const source = raw as Record<string, unknown>
  if (typeof source.unlockedMask === 'number' && Number.isFinite(source.unlockedMask)) {
    base.unlockedMask = Math.max(1, Math.floor(source.unlockedMask))
  }
  if (source.bestScores && typeof source.bestScores === 'object') {
    for (const [key, value] of Object.entries(source.bestScores as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value)) base.bestScores[key] = value
    }
  }
  if (source.bestTimes && typeof source.bestTimes === 'object') {
    for (const [key, value] of Object.entries(source.bestTimes as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) base.bestTimes[key] = value
    }
  }
  if (typeof source.settingsMuted === 'boolean') base.settingsMuted = source.settingsMuted
  if (source.starsByTrack && typeof source.starsByTrack === 'object') {
    for (const [key, value] of Object.entries(source.starsByTrack as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value)) base.starsByTrack[key] = value
    }
  }
  if (typeof source.settingsVolume === 'number' && Number.isFinite(source.settingsVolume)) {
    base.settingsVolume = Math.min(1, Math.max(0, source.settingsVolume))
  }
  if (typeof source.baffleLevel === 'number' && Number.isFinite(source.baffleLevel)) {
    base.baffleLevel = Math.min(4, Math.max(0, Math.floor(source.baffleLevel)))
  }
  if (typeof source.tankerRunsLeft === 'number' && Number.isFinite(source.tankerRunsLeft)) {
    base.tankerRunsLeft = Math.min(3, Math.max(0, Math.floor(source.tankerRunsLeft)))
  }
  return base
}

export class StorageService {
  private data: SaveData = defaults()
  private flushTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly platform: PlaygamaService) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush()
    })
    window.addEventListener('pagehide', () => this.flush())
  }

  async load(): Promise<void> {
    let parsed: unknown = null
    try {
      const mirror = window.localStorage.getItem(SAVE_KEY)
      if (mirror) parsed = JSON.parse(mirror)
    } catch {
      /* зеркало пусто или бит — облако ниже важнее */
    }
    const cloud = await this.platform.storageGet(SAVE_KEY)
    if (cloud) {
      try {
        parsed = JSON.parse(cloud)
      } catch {
        /* битый JSON в облаке — стартуем на умолчаниях, а не падаем */
      }
    }
    this.data = normalize(parsed)
  }

  get(): SaveData {
    return this.data
  }

  /** Отложенная запись: 1.5 с дебаунса плюс сброс на pagehide/visibilitychange. */
  save(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushTimer = setTimeout(() => this.flush(), 1500)
  }

  flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(this.data))
    } catch {
      /* приватный режим — живём без зеркала */
    }
    void this.platform.storageSet(SAVE_KEY, JSON.stringify(this.data))
  }
}
