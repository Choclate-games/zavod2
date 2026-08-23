/**
 * Единственное сохранение игры: один ключ, один JSON, нормализация при чтении.
 * localStorage — только зеркало; основная копия живёт в хранилище площадки.
 */
import bridge from '@playgama/bridge'

export const SAVE_KEY = 'courier_best_delivery_time'

export interface SaveData {
  version: number
  bestDeliveryTimeSec: number | null
  contractsFinished: number
  settings: {
    muted: boolean
    volume: number
    vibration: boolean
  }
}

const CURRENT_VERSION = 1

export function freshSave(): SaveData {
  return {
    version: CURRENT_VERSION,
    bestDeliveryTimeSec: null,
    contractsFinished: 0,
    settings: { muted: false, volume: 0.8, vibration: true },
  }
}

/** Битое или обрезанное сохранение поднимается на умолчаниях, не роняет игру. */
export function normalizeSave(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') return freshSave()
  const data = raw as Partial<SaveData>
  const fresh = freshSave()
  return {
    version: CURRENT_VERSION,
    bestDeliveryTimeSec:
      typeof data.bestDeliveryTimeSec === 'number' && isFinite(data.bestDeliveryTimeSec)
        ? data.bestDeliveryTimeSec
        : null,
    contractsFinished:
      typeof data.contractsFinished === 'number' ? Math.max(0, Math.floor(data.contractsFinished)) : 0,
    settings: { ...fresh.settings, ...(data.settings ?? {}) },
  }
}

function parseStored(raw: unknown): SaveData {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
  return parsed == null ? freshSave() : normalizeSave(parsed)
}

export class StorageService {
  private timer: ReturnType<typeof setTimeout> | null = null

  async load(): Promise<SaveData> {
    try {
      const raw = await bridge.storage.get(SAVE_KEY)
      if (raw != null) return parseStored(raw)
    } catch (error) {
      // Облачное чтение не проглатывается молча: зеркало ниже — запасной путь.
      console.error('[save] cloud read failed, using local mirror:', error)
    }
    try {
      const mirror = localStorage.getItem(SAVE_KEY)
      return mirror ? normalizeSave(JSON.parse(mirror)) : freshSave()
    } catch {
      return freshSave()
    }
  }

  saveDebounced(data: SaveData): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.saveImmediate(data), 1500)
  }

  /** Мгновенная запись: зеркало сначала, облако следом. */
  async saveImmediate(data: SaveData): Promise<void> {
    const str = JSON.stringify(data)
    try {
      localStorage.setItem(SAVE_KEY, str)
    } catch (error) {
      console.error('[save] local mirror write failed:', error)
    }
    try {
      await bridge.storage.set(SAVE_KEY, str)
    } catch (error) {
      console.error('[save] cloud write failed:', error)
    }
  }
}
