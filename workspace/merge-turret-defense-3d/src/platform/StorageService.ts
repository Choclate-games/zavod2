import bridge from '@playgama/bridge';
import { BASE_HP, SAVE_KEY, SLOT_COUNT } from '../game/config';
import type { SaveData } from '../game/types';

const CURRENT_VERSION = 1;

export function freshSave(now: number, language = 'ru'): SaveData {
  return {
    version: CURRENT_VERSION,
    coins: 120,
    gems: 0,
    slots: Array.from({ length: SLOT_COUNT }, (_, index) => (index < 2 ? 1 : null)),
    highestTier: 1,
    currentWave: 1,
    purchases: 0,
    upgrades: { damage: 0, income: 0, crateSpeed: 0, critChance: 0 },
    lastOnlineTimestamp: now,
    settings: { muted: false, sfxVolume: 0.82, musicVolume: 0.42, language },
    premiumNoAds: false
  };
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function normalizeSave(raw: unknown, now: number, language: string): SaveData {
  const base = freshSave(now, language);
  if (!isRecord(raw)) return base;

  const upgradesRaw = isRecord(raw.upgrades) ? raw.upgrades : {};
  const settingsRaw = isRecord(raw.settings) ? raw.settings : {};
  const slotsRaw = Array.isArray(raw.slots) ? raw.slots : base.slots;
  const slots = slotsRaw.slice(0, SLOT_COUNT).map((slot) => {
    const tier = numberOr(slot, 0);
    return tier >= 1 && tier <= 15 ? Math.round(tier) : null;
  });
  while (slots.length < SLOT_COUNT) slots.push(null);

  return {
    version: CURRENT_VERSION,
    coins: Math.max(0, numberOr(raw.coins, base.coins)),
    gems: Math.max(0, numberOr(raw.gems, base.gems)),
    slots,
    highestTier: Math.max(1, Math.min(15, Math.round(numberOr(raw.highestTier, base.highestTier)))),
    currentWave: Math.max(1, Math.round(numberOr(raw.currentWave, base.currentWave))),
    purchases: Math.max(0, Math.round(numberOr(raw.purchases, base.purchases))),
    upgrades: {
      damage: Math.max(0, Math.round(numberOr(upgradesRaw.damage, 0))),
      income: Math.max(0, Math.round(numberOr(upgradesRaw.income, 0))),
      crateSpeed: Math.max(0, Math.round(numberOr(upgradesRaw.crateSpeed, 0))),
      critChance: Math.max(0, Math.round(numberOr(upgradesRaw.critChance, 0)))
    },
    lastOnlineTimestamp: Math.max(0, Math.round(numberOr(raw.lastOnlineTimestamp, now))),
    settings: {
      muted: booleanOr(settingsRaw.muted, false),
      sfxVolume: Math.max(0, Math.min(1, numberOr(settingsRaw.sfxVolume, base.settings.sfxVolume))),
      musicVolume: Math.max(0, Math.min(1, numberOr(settingsRaw.musicVolume, base.settings.musicVolume))),
      language: stringOr(settingsRaw.language, language)
    },
    premiumNoAds: booleanOr(raw.premiumNoAds, false)
  };
}

export class StorageService {
  private data: SaveData;
  private saveTimer = 0;

  constructor(language: string, now: number) {
    this.data = freshSave(now, language);
  }

  get save(): SaveData {
    return this.data;
  }

  async load(now: number, language: string): Promise<SaveData> {
    const cloud = await this.tryReadCloud();
    if (cloud !== null) {
      this.data = normalizeSave(cloud, now, language);
      return this.data;
    }

    const local = this.tryReadLocal();
    this.data = normalizeSave(local, now, language);
    return this.data;
  }

  replace(save: SaveData): void {
    this.data = normalizeSave(save, save.lastOnlineTimestamp, save.settings.language);
    this.saveDebounced();
  }

  mutate(mutator: (save: SaveData) => void): SaveData {
    mutator(this.data);
    this.saveDebounced();
    return this.data;
  }

  saveDebounced(): void {
    if (this.saveTimer !== 0) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = 0;
      void this.saveImmediate();
    }, 1500);
  }

  async saveImmediate(): Promise<void> {
    const value = JSON.stringify(this.data);
    try {
      window.localStorage.setItem(SAVE_KEY, value);
    } catch {
      // Local mirror is best-effort.
    }
    if (bridge.storage?.set) {
      try {
        await bridge.storage.set(SAVE_KEY, value);
      } catch (error) {
        console.error('[save] cloud write failed', error);
      }
    }
  }

  bindFlushEvents(): void {
    const flush = (): void => {
      this.data.lastOnlineTimestamp = Date.now();
      void this.saveImmediate();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) flush();
    });
  }

  private async tryReadCloud(): Promise<unknown | null> {
    if (!bridge.storage?.get) return null;
    try {
      const value = await bridge.storage.get(SAVE_KEY);
      if (typeof value === 'string') return JSON.parse(value);
      return value;
    } catch (error) {
      console.error('[save] cloud read failed, using local mirror', error);
      return null;
    }
  }

  private tryReadLocal(): unknown | null {
    try {
      const value = window.localStorage.getItem(SAVE_KEY);
      return value ? JSON.parse(value) : null;
    } catch {
      return { lastOnlineTimestamp: Date.now(), currentWave: 1, slots: Array.from({ length: SLOT_COUNT }, () => null), baseHp: BASE_HP };
    }
  }
}
