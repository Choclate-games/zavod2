import type { SaveData } from '../core/types'

const SAVE_KEY = 'courier_rank'

export const DEFAULT_SAVE: SaveData = {
  shillings: 50,
  highScore: 0,
  bestTime: 0,
  gear: {
    bagSuspensionLevel: 1,
    brassBootsLevel: 1,
    unlockedDistricts: ['district_old_town'],
  },
  settings: {
    muted: false,
    volume: 0.8,
    touchMode: true,
  },
}

export class StorageService {
  private currentSave: SaveData = { ...DEFAULT_SAVE }
  private saveTimeout: number | null = null
  private cloudStorageAvailable = false

  constructor() {
    this.currentSave = this.loadFromLocal()
    window.addEventListener('pagehide', () => this.flush())
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.flush()
    })
  }

  public getSave(): SaveData {
    return this.currentSave
  }

  public updateSave(mutator: (data: SaveData) => void): void {
    mutator(this.currentSave)
    this.scheduleSave()
  }

  public scheduleSave(): void {
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout)
    }
    this.saveTimeout = window.setTimeout(() => {
      this.flush()
    }, 1500)
  }

  public flush(): void {
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = null
    }
    try {
      const serialized = JSON.stringify(this.currentSave)
      localStorage.setItem(SAVE_KEY, serialized)
    } catch (e) {
      console.warn('[StorageService] LocalStorage save failed:', e)
    }
  }

  public normalize(raw: unknown): SaveData {
    if (!raw || typeof raw !== 'object') {
      return JSON.parse(JSON.stringify(DEFAULT_SAVE))
    }
    const data = raw as Partial<SaveData>
    return {
      shillings: typeof data.shillings === 'number' ? data.shillings : DEFAULT_SAVE.shillings,
      highScore: typeof data.highScore === 'number' ? data.highScore : DEFAULT_SAVE.highScore,
      bestTime: typeof data.bestTime === 'number' ? data.bestTime : DEFAULT_SAVE.bestTime,
      gear: {
        bagSuspensionLevel: Math.max(1, Math.min(5, data.gear?.bagSuspensionLevel ?? 1)),
        brassBootsLevel: Math.max(1, Math.min(5, data.gear?.brassBootsLevel ?? 1)),
        unlockedDistricts: Array.isArray(data.gear?.unlockedDistricts)
          ? data.gear.unlockedDistricts
          : [...DEFAULT_SAVE.gear.unlockedDistricts],
      },
      settings: {
        muted: typeof data.settings?.muted === 'boolean' ? data.settings.muted : DEFAULT_SAVE.settings.muted,
        volume: typeof data.settings?.volume === 'number' ? data.settings.volume : DEFAULT_SAVE.settings.volume,
        touchMode: typeof data.settings?.touchMode === 'boolean' ? data.settings.touchMode : DEFAULT_SAVE.settings.touchMode,
      },
    }
  }

  private loadFromLocal(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT_SAVE))
      return this.normalize(JSON.parse(raw))
    } catch (err) {
      console.warn('[StorageService] LocalStorage load failed, falling back to defaults:', err)
      return JSON.parse(JSON.stringify(DEFAULT_SAVE))
    }
  }
}

export const storageService = new StorageService()
