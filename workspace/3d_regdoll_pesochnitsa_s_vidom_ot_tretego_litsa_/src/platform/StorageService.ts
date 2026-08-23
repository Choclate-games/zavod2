/**
 * Один ключ сохранения — один JSON-объект. Облако моста, зеркало в
 * localStorage для мгновенной загрузки, нормализация на чтении: битое
 * сохранение загружается с дефолтами, а не роняет игру. Запись с дебаунсом
 * и сбросом на pagehide / visibilitychange.
 */
import {
  capabilityStorage,
  loadCloudValue,
  saveCloudValue,
} from './PlaygamaService.ts'

export const SAVE_KEY = 'player_unlocked_halls_bitmask'

export interface SaveData {
  totalDamage: number
  unlockedHalls: number
  selectedHall: number
  bestStars: Record<string, number>
  muted: boolean
  volume: number
  launches: number
}

export function defaultSave(): SaveData {
  return {
    totalDamage: 0,
    unlockedHalls: 1,
    selectedHall: 0,
    bestStars: {},
    muted: false,
    volume: 0.8,
    launches: 0,
  }
}

function normalize(raw: unknown): SaveData {
  const base = defaultSave()
  if (!raw || typeof raw !== 'object') return base
  const src = raw as Record<string, unknown>
  const out = base
  if (typeof src['totalDamage'] === 'number' && Number.isFinite(src['totalDamage'])) out.totalDamage = src['totalDamage']
  if (typeof src['unlockedHalls'] === 'number' && Number.isFinite(src['unlockedHalls']) && src['unlockedHalls'] >= 1) {
    out.unlockedHalls = Math.floor(src['unlockedHalls'])
  }
  if (typeof src['selectedHall'] === 'number' && Number.isFinite(src['selectedHall'])) out.selectedHall = Math.floor(src['selectedHall'])
  if (src['bestStars'] && typeof src['bestStars'] === 'object') {
    for (const [key, value] of Object.entries(src['bestStars'] as Record<string, unknown>)) {
      if (typeof value === 'number' && value >= 0 && value <= 3) out.bestStars[key] = Math.floor(value)
    }
  }
  if (typeof src['muted'] === 'boolean') out.muted = src['muted']
  if (typeof src['volume'] === 'number' && src['volume'] >= 0 && src['volume'] <= 1) out.volume = src['volume']
  if (typeof src['launches'] === 'number' && Number.isFinite(src['launches'])) out.launches = Math.floor(src['launches'])
  if (out.selectedHall >= out.unlockedHalls) out.selectedHall = out.unlockedHalls - 1
  return out
}

class StorageServiceImpl {
  private current: SaveData = defaultSave()
  private writeTimer = 0
  /** true — облако недоступно в этой сессии, играем с локальной копии. */
  cloudDegraded = false

  get data(): SaveData {
    return this.current
  }

  async load(): Promise<SaveData> {
    let cloudRaw: string | null = null
    // Молча проглотить отказ облака нельзя: фиксируем деградацию в данных.
    let cloudFailed = false
    if (capabilityStorage()) {
      cloudRaw = await loadCloudValue(SAVE_KEY)
      cloudFailed = cloudRaw === null
    } else {
      cloudFailed = true
    }
    let localRaw: string | null = null
    try {
      localRaw = window.localStorage.getItem(SAVE_KEY)
    } catch {}
    const parsedCloud = safeParse(cloudRaw)
    const parsedLocal = safeParse(localRaw)
    this.current = normalize(parsedCloud ?? parsedLocal)
    if (parsedCloud === null && parsedLocal !== null) {
      // Облако недоступно или пусто — играем с локальной копии, но помним об этом.
      this.current = normalize(parsedLocal)
    }
    if (cloudFailed) this.cloudDegraded = true
    return this.current
  }

  update(patch: Partial<SaveData>): void {
    Object.assign(this.current, patch)
    this.scheduleFlush()
  }

  scheduleFlush(): void {
    if (this.writeTimer) clearTimeout(this.writeTimer)
    this.writeTimer = setTimeout(() => void this.flush(), 1500) as unknown as number
  }

  async flush(): Promise<void> {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer)
      this.writeTimer = 0
    }
    const serialized = JSON.stringify(this.current)
    try {
      window.localStorage.setItem(SAVE_KEY, serialized)
    } catch {}
    await saveCloudValue(SAVE_KEY, serialized)
  }

  installAutoFlush(): void {
    const flush = (): void => void this.flush()
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })
  }
}

function safeParse(raw: string | null): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

export const StorageService = new StorageServiceImpl()
