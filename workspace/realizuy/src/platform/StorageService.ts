import bridge from '@playgama/bridge'
import { DEFAULT_STORAGE, StorageData } from './PlaygamaService'

const STORAGE_KEY = 'player_cups'

export class StorageService {
  private static instance: StorageService
  private currentData: StorageData = { ...DEFAULT_STORAGE }
  private saveTimeout: number | null = null
  private isLoaded = false

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService()
    }
    return StorageService.instance
  }

  public getData(): StorageData {
    return this.currentData
  }

  public async load(): Promise<StorageData> {
    let raw: string | null = null

    try {
      // Try bridge storage first (Bridge v2 takes no storageType argument)
      const res = await bridge.storage.get(STORAGE_KEY)
      if (res && typeof res === 'string') {
        raw = res
      } else if (res && typeof res === 'object') {
        raw = JSON.stringify(res)
      }
    } catch {
      // Fall back to local storage
      try {
        raw = localStorage.getItem(STORAGE_KEY)
      } catch {}
    }

    if (!raw) {
      try {
        raw = localStorage.getItem(STORAGE_KEY)
      } catch {}
    }

    this.currentData = this.normalize(raw)
    this.isLoaded = true
    this.setupFlushListeners()
    return this.currentData
  }

  public save(partial: Partial<StorageData>): void {
    this.currentData = { ...this.currentData, ...partial }

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

    const payload = JSON.stringify(this.currentData)

    // Mirror to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, payload)
    } catch {}

    // Cloud storage
    try {
      bridge.storage.set(STORAGE_KEY, payload)
    } catch (err) {
      console.warn('Failed to save to platform storage:', err)
    }
  }

  private normalize(raw: string | null): StorageData {
    if (!raw) return { ...DEFAULT_STORAGE }

    try {
      const parsed = JSON.parse(raw)
      return {
        cups: typeof parsed.cups === 'number' ? parsed.cups : DEFAULT_STORAGE.cups,
        cash: typeof parsed.cash === 'number' ? parsed.cash : DEFAULT_STORAGE.cash,
        highScore: typeof parsed.highScore === 'number' ? parsed.highScore : DEFAULT_STORAGE.highScore,
        kickLevel: typeof parsed.kickLevel === 'number' ? parsed.kickLevel : DEFAULT_STORAGE.kickLevel,
        bowlingLevel: typeof parsed.bowlingLevel === 'number' ? parsed.bowlingLevel : DEFAULT_STORAGE.bowlingLevel,
        weaponLevel: typeof parsed.weaponLevel === 'number' ? parsed.weaponLevel : DEFAULT_STORAGE.weaponLevel,
        soundMuted: typeof parsed.soundMuted === 'boolean' ? parsed.soundMuted : DEFAULT_STORAGE.soundMuted,
        musicMuted: typeof parsed.musicMuted === 'boolean' ? parsed.musicMuted : DEFAULT_STORAGE.musicMuted,
      }
    } catch {
      return { ...DEFAULT_STORAGE }
    }
  }

  private setupFlushListeners(): void {
    window.addEventListener('pagehide', () => this.flush())
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush()
      }
    })
  }
}

export const storageService = StorageService.getInstance()
