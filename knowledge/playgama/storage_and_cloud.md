# Playgama Bridge: Cloud Storage & Save System Architecture

## Cloud Save Service Implementation
```typescript
import bridge, { StorageType } from '@playgama/bridge';

export interface GameSaveData {
    version: number;
    gold: number;
    unlockedCharacters: string[];
    highScore: number;
    highestWave: number;
    talentLevels: Record<string, number>;
    settings: {
        musicVolume: number;
        sfxVolume: number;
        joystickFloating: boolean;
        language: string;
    };
}

const DEFAULT_SAVE: GameSaveData = {
    version: 1,
    gold: 0,
    unlockedCharacters: ['recruit_gladiator'],
    highScore: 0,
    highestWave: 1,
    talentLevels: {},
    settings: {
        musicVolume: 0.7,
        sfxVolume: 0.8,
        joystickFloating: true,
        language: 'ru'
    }
};

export class SaveService {
    private static currentData: GameSaveData = { ...DEFAULT_SAVE };
    private static saveTimeout: number | null = null;
    private static readonly SAVE_KEY = 'gladiator_save_v1';

    static async load(): Promise<GameSaveData> {
        try {
            const storageType = bridge.storage.defaultType || StorageType.LOCAL_STORAGE;
            const data = await bridge.storage.get(this.SAVE_KEY, storageType);
            if (data && typeof data === 'object') {
                this.currentData = { ...DEFAULT_SAVE, ...data };
            } else if (typeof data === 'string') {
                this.currentData = { ...DEFAULT_SAVE, ...JSON.parse(data) };
            }
        } catch (e) {
            console.warn('Storage load failed, using defaults or local fallback', e);
        }
        return this.currentData;
    }

    static saveDebounced() {
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        this.saveTimeout = window.setTimeout(() => this.saveImmediate(), 1500);
    }

    static async saveImmediate(): Promise<void> {
        try {
            const storageType = bridge.storage.defaultType || StorageType.LOCAL_STORAGE;
            await bridge.storage.set(this.SAVE_KEY, JSON.stringify(this.currentData), storageType);
        } catch (e) {
            console.error('Save failed', e);
        }
    }
}
```
