import { KatanaConfig, SaveProfile } from '../core/Types';
import { Playgama } from './PlaygamaService';

export const KATANAS: KatanaConfig[] = [
  {
    id: 'katana_cyan',
    nameKey: 'katana_cyan_title',
    descKey: 'katana_cyan_desc',
    color: 0x00f3ff,
    trailColor: '#00f3ff',
    unlocked: true,
    cost: 0,
    damageMultiplier: 1.0,
    chronoBonus: 0
  },
  {
    id: 'katana_crimson',
    nameKey: 'katana_crimson_title',
    descKey: 'katana_crimson_desc',
    color: 0xff0055,
    trailColor: '#ff0055',
    unlocked: false,
    cost: 500,
    damageMultiplier: 1.35,
    chronoBonus: 0
  },
  {
    id: 'katana_violet',
    nameKey: 'katana_violet_title',
    descKey: 'katana_violet_desc',
    color: 0xb026ff,
    trailColor: '#b026ff',
    unlocked: false,
    cost: 1200,
    damageMultiplier: 1.15,
    chronoBonus: 40
  },
  {
    id: 'katana_gold',
    nameKey: 'katana_gold_title',
    descKey: 'katana_gold_desc',
    color: 0xffd700,
    trailColor: '#ffd700',
    unlocked: false,
    cost: 2500,
    damageMultiplier: 1.5,
    chronoBonus: 20
  }
];

export class StorageService {
  private static instance: StorageService;
  private currentProfile: SaveProfile = this.createDefaultProfile();

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  public createDefaultProfile(): SaveProfile {
    return {
      version: 1,
      credits: 0,
      highScore: 0,
      maxWaveReached: 1,
      selectedKatana: 'katana_cyan',
      unlockedKatanas: ['katana_cyan'],
      permanentUpgrades: {
        maxHpLevel: 0,
        chronoCapLevel: 0,
        slicePowerLevel: 0,
        creditBoostLevel: 0
      },
      settings: {
        soundVolume: 0.8,
        musicVolume: 0.7,
        soundMuted: false,
        language: 'ru',
        touchControlsEnabled: true
      }
    };
  }

  public async init(): Promise<SaveProfile> {
    const loaded = await Playgama.loadProfile();
    if (loaded && typeof loaded === 'object') {
      this.currentProfile = this.normalize(loaded);
    } else {
      this.currentProfile = this.createDefaultProfile();
      this.currentProfile.settings.language = Playgama.getPlatformLanguage();
    }
    return this.currentProfile;
  }

  public getProfile(): SaveProfile {
    return this.currentProfile;
  }

  public save(): void {
    Playgama.saveProfile(this.currentProfile);
  }

  public addCredits(amount: number): void {
    this.currentProfile.credits = Math.max(0, this.currentProfile.credits + Math.floor(amount));
    this.save();
  }

  public updateScore(score: number, wave: number): void {
    if (score > this.currentProfile.highScore) {
      this.currentProfile.highScore = Math.floor(score);
      Playgama.setLeaderboardScore(this.currentProfile.highScore);
    }
    if (wave > this.currentProfile.maxWaveReached) {
      this.currentProfile.maxWaveReached = wave;
    }
    this.save();
  }

  public upgradeStat(stat: keyof SaveProfile['permanentUpgrades'], cost: number): boolean {
    if (this.currentProfile.credits >= cost && this.currentProfile.permanentUpgrades[stat] < 5) {
      this.currentProfile.credits -= cost;
      this.currentProfile.permanentUpgrades[stat]++;
      this.save();
      return true;
    }
    return false;
  }

  public unlockKatana(id: string): boolean {
    const katana = KATANAS.find((k) => k.id === id);
    if (!katana) return false;
    if (this.currentProfile.unlockedKatanas.includes(id)) return true;

    if (this.currentProfile.credits >= katana.cost) {
      this.currentProfile.credits -= katana.cost;
      this.currentProfile.unlockedKatanas.push(id);
      this.currentProfile.selectedKatana = id;
      this.save();
      return true;
    }
    return false;
  }

  public selectKatana(id: string): void {
    if (this.currentProfile.unlockedKatanas.includes(id)) {
      this.currentProfile.selectedKatana = id;
      this.save();
    }
  }

  private normalize(data: Partial<SaveProfile>): SaveProfile {
    const d = this.createDefaultProfile();
    return {
      version: 1,
      credits: typeof data.credits === 'number' ? Math.max(0, data.credits) : d.credits,
      highScore: typeof data.highScore === 'number' ? Math.max(0, data.highScore) : d.highScore,
      maxWaveReached: typeof data.maxWaveReached === 'number' ? Math.max(1, data.maxWaveReached) : d.maxWaveReached,
      selectedKatana: typeof data.selectedKatana === 'string' ? data.selectedKatana : d.selectedKatana,
      unlockedKatanas: Array.isArray(data.unlockedKatanas) && data.unlockedKatanas.length > 0 ? data.unlockedKatanas : d.unlockedKatanas,
      permanentUpgrades: {
        maxHpLevel: typeof data.permanentUpgrades?.maxHpLevel === 'number' ? Math.min(5, Math.max(0, data.permanentUpgrades.maxHpLevel)) : 0,
        chronoCapLevel: typeof data.permanentUpgrades?.chronoCapLevel === 'number' ? Math.min(5, Math.max(0, data.permanentUpgrades.chronoCapLevel)) : 0,
        slicePowerLevel: typeof data.permanentUpgrades?.slicePowerLevel === 'number' ? Math.min(5, Math.max(0, data.permanentUpgrades.slicePowerLevel)) : 0,
        creditBoostLevel: typeof data.permanentUpgrades?.creditBoostLevel === 'number' ? Math.min(5, Math.max(0, data.permanentUpgrades.creditBoostLevel)) : 0
      },
      settings: {
        soundVolume: typeof data.settings?.soundVolume === 'number' ? data.settings.soundVolume : d.settings.soundVolume,
        musicVolume: typeof data.settings?.musicVolume === 'number' ? data.settings.musicVolume : d.settings.musicVolume,
        soundMuted: typeof data.settings?.soundMuted === 'boolean' ? data.settings.soundMuted : d.settings.soundMuted,
        language: data.settings?.language === 'en' ? 'en' : 'ru',
        touchControlsEnabled: typeof data.settings?.touchControlsEnabled === 'boolean' ? data.settings.touchControlsEnabled : true
      }
    };
  }
}

export const Storage = StorageService.getInstance();
