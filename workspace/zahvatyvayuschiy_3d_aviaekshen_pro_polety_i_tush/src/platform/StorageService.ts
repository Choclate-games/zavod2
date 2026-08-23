/**
 * Единственная точка сохранения. Один ключ, один JSON-объект, нормализация
 * при чтении; localStorage — только зеркало (в iframe площадки он партиционирован).
 * Настройки (звук, язык) лежат в сейве, а не в localStorage.
 */

const SAVE_KEY = 'pilot_level'
const SAVE_VERSION = 1
const DEBOUNCE_MS = 1500

export interface SaveSettings {
  muted: boolean
  volume: number
  language: string
}

export interface SaveData {
  version: number
  pilotLevel: number
  unlockedPlanes: string[]
  canyonStars: Record<string, number>
  highScores: number[]
  hangarUpgrades: Record<string, number>
  settings: SaveSettings
}

function freshSave(): SaveData {
  return {
    version: SAVE_VERSION,
    pilotLevel: 1,
    unlockedPlanes: ['be-12-kestrel'],
    canyonStars: {},
    highScores: [],
    hangarUpgrades: {},
    settings: { muted: false, volume: 0.8, language: 'ru' },
  }
}

function normalize(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') return freshSave()
  const d = raw as Partial<SaveData>
  const base = freshSave()
  return {
    version: SAVE_VERSION,
    pilotLevel:
      typeof d.pilotLevel === 'number' && d.pilotLevel >= 1 ? Math.floor(d.pilotLevel) : base.pilotLevel,
    unlockedPlanes:
      Array.isArray(d.unlockedPlanes) && d.unlockedPlanes.every((s) => typeof s === 'string')
        ? [...new Set([...base.unlockedPlanes, ...d.unlockedPlanes])]
        : base.unlockedPlanes,
    canyonStars: readNumberMap(d.canyonStars, base.canyonStars),
    highScores:
      Array.isArray(d.highScores) && d.highScores.every((n) => typeof n === 'number')
        ? d.highScores.filter((n) => Number.isFinite(n)).slice(0, 20)
        : base.highScores,
    hangarUpgrades: readNumberMap(d.hangarUpgrades, base.hangarUpgrades),
    settings:
      d.settings && typeof d.settings === 'object'
        ? {
            muted: typeof d.settings.muted === 'boolean' ? d.settings.muted : base.settings.muted,
            volume:
              typeof d.settings.volume === 'number'
                ? Math.min(1, Math.max(0, d.settings.volume))
                : base.settings.volume,
            language:
              typeof d.settings.language === 'string' && d.settings.language.length >= 2
                ? d.settings.language.slice(0, 2).toLowerCase()
                : base.settings.language,
          }
        : base.settings,
  }
}

function readNumberMap(raw: unknown, fallback: Record<string, number>): Record<string, number> {
  if (!raw || typeof raw !== 'object') return { ...fallback }
  const out: Record<string, number> = { ...fallback }
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value
  }
  return out
}

export class StorageService {
  private data: SaveData = freshSave()
  private timer: ReturnType<typeof setTimeout> | null = null

  get(): SaveData {
    return this.data
  }

  async load(bridgeStorage: { get(key: string): Promise<unknown> } | null): Promise<SaveData> {
    if (bridgeStorage) {
      try {
        const raw = await bridgeStorage.get(SAVE_KEY)
        const parsed = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw
        if (parsed != null) {
          this.data = normalize(parsed)
          return this.data
        }
      } catch (error) {
        // Молча уронить нельзя: облачный сейв незаметно превратился в локальный.
        console.error('[save] облачное чтение не удалось, работаем с зеркалом:', error)
      }
    }
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      this.data = normalize(raw ? (JSON.parse(raw) as unknown) : null)
    } catch (error) {
      console.error('[save] локальное зеркало повреждено, стартуем на умолчаниях:', error)
      this.data = freshSave()
    }
    return this.data
  }

  markDirty(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.saveImmediate(), DEBOUNCE_MS)
  }

  update(patch: (data: SaveData) => void): void {
    patch(this.data)
    this.markDirty()
  }

  async saveImmediate(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    const serialized = JSON.stringify(this.data)
    try {
      localStorage.setItem(SAVE_KEY, serialized)
    } catch {
      // Зеркало недоступно — облако остаётся основной копией.
    }
    const bridge = window.bridge
    if (bridge?.isInitialized && bridge.storage) {
      try {
        await bridge.storage.set(SAVE_KEY, serialized)
      } catch (error) {
        console.error('[save] облачная запись не удалась:', error)
      }
    }
  }

  installFlushHooks(): void {
    const flush = () => void this.saveImmediate()
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) flush()
    })
  }
}
