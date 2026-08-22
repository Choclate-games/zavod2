# Cloud Storage & Save System (Bridge v2)

Requirement 1.9 of Yandex Games: progress must survive a page reload. This is one
of the most common rejection reasons, and every trap below cost a real bug in a
shipped game.

## Principles

1. **One key, one JSON object.** Not `coins`, `level_1_score`, `settings_volume`
   as separate keys — a single monolithic save. Atomic, debuggable, and adding a
   field never needs a migration function.
2. **No `storageType` argument.** v2 picks cloud (authorized) or local by itself.
3. **localStorage is a mirror, not the store.** The game runs in an iframe on the
   platform's domain, where localStorage is third-party storage: partitioned in
   Chrome, culled in Safari. Never keep the only copy of anything there —
   including settings like mute and language.
4. **Normalize on read.** A truncated or corrupted save must boot the game on
   defaults, not crash it.

## Service

```typescript
const SAVE_KEY = 'my_game_save_v1';
const CURRENT_VERSION = 1;

interface SaveData {
    version: number;
    coins: number;
    upgrades: Record<string, number>;
    premium: { noAds: boolean };
    settings: { musicVolume: number; sfxVolume: number; muted: boolean; language: string };
}

const FRESH: SaveData = {
    version: CURRENT_VERSION,
    coins: 0,
    upgrades: {},
    premium: { noAds: false },
    settings: { musicVolume: 0.7, sfxVolume: 0.8, muted: false, language: 'en' },
};

// Never trust the shape of what comes back: old builds, partial writes and
// hand-edited cloud saves all land here.
function normalize(raw: unknown): SaveData {
    if (!raw || typeof raw !== 'object') return { ...FRESH };
    const d = raw as Partial<SaveData>;
    return {
        version: CURRENT_VERSION,
        coins: typeof d.coins === 'number' ? d.coins : FRESH.coins,
        upgrades: { ...FRESH.upgrades, ...(d.upgrades ?? {}) },
        premium: { ...FRESH.premium, ...(d.premium ?? {}) },
        settings: { ...FRESH.settings, ...(d.settings ?? {}) },
    };
}

export class SaveService {
    private static data: SaveData = { ...FRESH };
    private static timer: number | null = null;

    static async load(): Promise<SaveData> {
        const b = window.bridge;
        if (b?.storage) {
            try {
                const raw = await b.storage.get(SAVE_KEY);       // v2 parses JSON itself
                const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                if (parsed != null) { this.data = normalize(parsed); return this.data; }
            } catch (e) {
                // Falling back keeps the session playable, but silently downgrades a
                // cloud save to a device-local one — the exact failure behind "my
                // progress didn't sync". Never swallow it.
                console.error('[save] cloud read failed, using local mirror:', e);
            }
        }
        try { this.data = normalize(JSON.parse(localStorage.getItem(SAVE_KEY) || 'null')); }
        catch { this.data = { ...FRESH }; }
        return this.data;
    }

    static saveDebounced() {
        if (this.timer) clearTimeout(this.timer);
        this.timer = window.setTimeout(() => this.saveImmediate(), 1500);
    }

    static async saveImmediate(): Promise<void> {
        const str = JSON.stringify(this.data);
        try { localStorage.setItem(SAVE_KEY, str); } catch {}   // mirror first: instant/offline boot
        try { await window.bridge?.storage?.set(SAVE_KEY, str); } catch (e) {
            console.error('[save] cloud write failed:', e);
        }
    }
}
```

## Flush before the page goes away

A 1.5 s debounce plus a 10 s autosave loses real progress when the tab closes.
Use `pagehide` and `visibilitychange` — **not** `beforeunload`, which mobile
browsers frequently skip.

```typescript
const flush = () => { try { SaveService.saveImmediate(); } catch {} };
window.addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
```

## Settings belong in the save

Mute, volume and language go into the save object, not `localStorage`. Real bug:
a shipped game kept `muted` only in the audio engine's constructor, so the mute
button reset on every reload; moving it into the save fixed it for guests and
authorized players alike.

## Time-based content needs server time

Dailies, streaks and timed rewards keyed off `new Date()` are farmable by moving
the device clock. Measure the offset once at boot, then use it synchronously
(the daily check usually runs from the game tick and cannot be async).

```typescript
let offsetMs = 0;
export async function syncServerTime() {
    try {
        const t = await window.bridge?.platform?.getServerTime();
        if (typeof t === 'number' && isFinite(t)) offsetMs = t - Date.now();
    } catch {}
}
export const now = () => Date.now() + offsetMs;
```

Measured on a live machine: `offsetMs = -14287` — the device clock was 14 s fast.

## Auth changes mid-session

When the player signs in during play, re-run `load()`: the cloud save (if any)
wins, and if the cloud is empty the current local state is uploaded on the next
`save()`. Never merge blindly — pick one side and write it back whole.

## Acceptance tests before submitting

- reload survives progress — as guest **and** authorized;
- corrupted JSON in storage → game boots on defaults, loop alive;
- truncated save `{"coins":500}` → `normalize` rebuilds the rest;
- signing in mid-session does not wipe progress;
- closing the tab right after an action keeps that action.

---

## Чек-лист «прогресс не теряется»

- [ ] Перезагрузка сохраняет прогресс и у гостя, и у авторизованного
- [ ] Битый JSON в хранилище — игра стартует на значениях по умолчанию, петля жива
- [ ] Обрезанное сохранение достраивается `normalize`, а не роняет игру
- [ ] Вход в аккаунт посреди сессии не стирает прогресс
- [ ] Закрытие вкладки сразу после действия это действие сохраняет (`flush` на `visibilitychange`)
- [ ] Настройки (звук, чувствительность, язык) лежат в том же сохранении
- [ ] Обращение к хранилищу — через один сервис, а не `localStorage` вразнобой
