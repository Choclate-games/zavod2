import bridge from '@playgama/bridge'

/**
 * Сохранение: один ключ, один JSON, нормализация при чтении.
 * Облачный стор площадки — основная копия; localStorage — зеркало для
 * мгновенного локального старта, но не единственная копия.
 * Запись дебаунсится на 1.5 с и сбрасывается на pagehide / visibilitychange.
 */
const SAVE_KEY = 'player_trophies'
const DEBOUNCE_MS = 1500

export interface SaveData {
  trophies: number
  coins: number
  selectedTube: string
  selectedPilot: string
  selectedTrail: string
  unlockedTubes: string[]
  unlockedPilots: string[]
  unlockedTrails: string[]
  muted: boolean
  matchesPlayed: number
  localScores: number[]
}

function defaults(): SaveData {
  return {
    trophies: 0,
    coins: 0,
    selectedTube: 'classic',
    selectedPilot: 'rookie',
    selectedTrail: 'snow',
    unlockedTubes: ['classic'],
    unlockedPilots: ['rookie'],
    unlockedTrails: ['snow'],
    muted: false,
    matchesPlayed: 0,
    localScores: [],
  }
}

/** Битое или обрезанное сохранение поднимается на умолчаниях, а не роняет игру. */
function normalize(raw: unknown): SaveData {
  const base = defaults()
  if (typeof raw !== 'object' || raw === null) return base
  const source = raw as Record<string, unknown>
  const num = (key: string, fallback: number): number => {
    const value = source[key]
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback
  }
  const strList = (key: string, fallback: string[]): string[] => {
    const value = source[key]
    if (!Array.isArray(value)) return fallback
    const out: string[] = []
    for (const item of value) if (typeof item === 'string') out.push(item)
    return out.length > 0 ? out : fallback
  }
  const rawScores = Array.isArray(source.localScores) ? source.localScores : []
  return {
    trophies: Math.floor(num('trophies', base.trophies)),
    coins: Math.floor(num('coins', base.coins)),
    selectedTube: typeof source.selectedTube === 'string' ? source.selectedTube : base.selectedTube,
    selectedPilot: typeof source.selectedPilot === 'string' ? source.selectedPilot : base.selectedPilot,
    selectedTrail: typeof source.selectedTrail === 'string' ? source.selectedTrail : base.selectedTrail,
    unlockedTubes: strList('unlockedTubes', base.unlockedTubes),
    unlockedPilots: strList('unlockedPilots', base.unlockedPilots),
    unlockedTrails: strList('unlockedTrails', base.unlockedTrails),
    muted: typeof source.muted === 'boolean' ? source.muted : base.muted,
    matchesPlayed: Math.floor(num('matchesPlayed', base.matchesPlayed)),
    localScores: rawScores
      .filter((s): s is number => typeof s === 'number' && Number.isFinite(s))
      .slice(0, 10),
  }
}

export class StorageService {
  private data: SaveData = defaults()
  private flushTimer = 0

  constructor() {
    window.addEventListener('pagehide', () => this.flush())
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush()
    })
  }

  async load(): Promise<SaveData> {
    let mirrorRaw: string | null = null
    try {
      mirrorRaw = localStorage.getItem(SAVE_KEY)
    } catch {
      // Зеркало недоступно — читаем только облако.
    }
    let cloudRaw: unknown = null
    try {
      cloudRaw = await bridge.storage.get(SAVE_KEY)
    } catch (error) {
      // Молчать нельзя: облачное чтение провалилось, остаёмся на зеркале.
      console.warn('[storage] облачное чтение недоступно, работаем с локальной копией:', String(error))
    }
    let chosen: unknown = cloudRaw ?? mirrorRaw
    if (typeof chosen === 'string') {
      try {
        chosen = JSON.parse(chosen)
      } catch {
        chosen = null
      }
    }
    this.data = normalize(chosen)
    this.writeMirror()
    return this.data
  }

  get(): SaveData {
    return this.data
  }

  update(mutate: (data: SaveData) => void): void {
    mutate(this.data)
    this.writeMirror()
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushTimer = setTimeout(() => this.flush(), DEBOUNCE_MS)
  }

  /** Немедленная запись в обе копии: закрытие вкладки не теряет действие игрока. */
  flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = 0
    }
    this.writeMirror()
    try {
      void bridge.storage.set(SAVE_KEY, JSON.stringify(this.data))
    } catch (error) {
      console.warn('[storage] облачная запись не удалась:', String(error))
    }
  }

  private writeMirror(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data))
    } catch {
      // Зеркало необязательно: основная копия живёт в облаке площадки.
    }
  }
}
