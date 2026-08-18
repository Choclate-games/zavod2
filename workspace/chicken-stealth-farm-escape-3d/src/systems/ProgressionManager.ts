import { playgamaService } from '@/platform/PlaygamaService';
import { eventBus } from '@/core/EventBus';

export interface SkinItem {
  id: string;
  name: string;
  desc: string;
  cost: number;
  icon: string;
  isUnlocked: boolean;
}

export class ProgressionManager {
  private static instance: ProgressionManager;

  public chickenSkins: SkinItem[] = [
    {
      id: 'classic',
      name: 'Обычная Несушка',
      desc: 'Классическая курица-агент в белом оперении с алым гребешком.',
      cost: 0,
      icon: '🐔',
      isUnlocked: true
    },
    {
      id: 'ninja',
      name: 'Цыпа-Ниндзя',
      desc: 'Черное оперение, красная повязка и бесшумный шаг.',
      cost: 50,
      icon: '🥷',
      isUnlocked: false
    },
    {
      id: 'agent007',
      name: 'Агент 007',
      desc: 'Строгий смокинг, темные очки и лицензия на клевание.',
      cost: 100,
      icon: '🕶️',
      isUnlocked: false
    },
    {
      id: 'cyberpunk',
      name: 'Кибер-Цыпа',
      desc: 'Титановое оперение и неоновый визор ночного видения.',
      cost: 200,
      icon: '🤖',
      isUnlocked: false
    },
    {
      id: 'golden',
      name: 'Золотая Клуша',
      desc: 'Слиток чистейшего золота, ослепляющий сторожевых псов.',
      cost: 350,
      icon: '👑',
      isUnlocked: false
    }
  ];

  public boxSkins: SkinItem[] = [
    {
      id: 'cardboard',
      name: 'Картонная Классика',
      desc: 'Проверенная временем картонная коробка со штампом Осторожно.',
      cost: 0,
      icon: '📦',
      isUnlocked: true
    },
    {
      id: 'parcel',
      name: 'Спец-Посылка',
      desc: 'Почтовая посылка со штрихкодами экспресс-доставки.',
      cost: 40,
      icon: '✉️',
      isUnlocked: false
    },
    {
      id: 'safe',
      name: 'Сейф с Золотом',
      desc: 'Непробиваемый бронированный сейф с кодовым замком.',
      cost: 80,
      icon: '🔒',
      isUnlocked: false
    },
    {
      id: 'watermelon',
      name: 'Фермерский Арбуз',
      desc: 'Сочный полосатый арбуз с прорезями для глаз.',
      cost: 120,
      icon: '🍉',
      isUnlocked: false
    },
    {
      id: 'crate',
      name: 'Деревянный Ящик',
      desc: 'Прочный ящик для яблок с железными уголками.',
      cost: 180,
      icon: '🪵',
      isUnlocked: false
    }
  ];

  private constructor() {
    this.syncFromSave();
  }

  public static getInstance(): ProgressionManager {
    if (!ProgressionManager.instance) {
      ProgressionManager.instance = new ProgressionManager();
    }
    return ProgressionManager.instance;
  }

  public syncFromSave(): void {
    const save = playgamaService.getSave();

    for (const skin of this.chickenSkins) {
      skin.isUnlocked = skin.cost === 0 || save.unlockedChickenSkins.includes(skin.id);
    }

    // Check if ninja skin is rented
    if (save.ninjaSkinRentedLevels > 0) {
      const ninja = this.chickenSkins.find((s) => s.id === 'ninja');
      if (ninja) ninja.isUnlocked = true;
    }

    for (const box of this.boxSkins) {
      box.isUnlocked = box.cost === 0 || save.unlockedBoxSkins.includes(box.id);
    }
  }

  public getTotalGrains(): number {
    return playgamaService.getSave().totalGrains;
  }

  public addGrains(amount: number): number {
    let newTotal = 0;
    playgamaService.updateSave((draft) => {
      draft.totalGrains += Math.max(0, amount);
      newTotal = draft.totalGrains;
    });
    eventBus.emit('save:updated', {
      totalGrains: newTotal,
      unlockedLevels: playgamaService.getSave().unlockedLevel
    });
    return newTotal;
  }

  public getEquippedSkins(): { chicken: string; box: string } {
    const save = playgamaService.getSave();
    return {
      chicken: save.equippedChickenSkin,
      box: save.equippedBoxSkin
    };
  }

  public equipChickenSkin(skinId: string): boolean {
    const skin = this.chickenSkins.find((s) => s.id === skinId);
    if (!skin || !skin.isUnlocked) return false;

    playgamaService.updateSave((draft) => {
      draft.equippedChickenSkin = skinId;
    });

    eventBus.emit('skin:changed', {
      chickenSkinId: skinId,
      boxSkinId: playgamaService.getSave().equippedBoxSkin
    });
    return true;
  }

  public equipBoxSkin(boxId: string): boolean {
    const box = this.boxSkins.find((b) => b.id === boxId);
    if (!box || !box.isUnlocked) return false;

    playgamaService.updateSave((draft) => {
      draft.equippedBoxSkin = boxId;
    });

    eventBus.emit('skin:changed', {
      chickenSkinId: playgamaService.getSave().equippedChickenSkin,
      boxSkinId: boxId
    });
    return true;
  }

  public buyChickenSkin(skinId: string): boolean {
    const skin = this.chickenSkins.find((s) => s.id === skinId);
    if (!skin || skin.isUnlocked) return false;

    const save = playgamaService.getSave();
    if (save.totalGrains < skin.cost) return false;

    playgamaService.updateSave((draft) => {
      draft.totalGrains -= skin.cost;
      if (!draft.unlockedChickenSkins.includes(skinId)) {
        draft.unlockedChickenSkins.push(skinId);
      }
      draft.equippedChickenSkin = skinId;
    });

    skin.isUnlocked = true;
    eventBus.emit('save:updated', {
      totalGrains: playgamaService.getSave().totalGrains,
      unlockedLevels: save.unlockedLevel
    });
    eventBus.emit('skin:changed', {
      chickenSkinId: skinId,
      boxSkinId: save.equippedBoxSkin
    });

    return true;
  }

  public buyBoxSkin(boxId: string): boolean {
    const box = this.boxSkins.find((b) => b.id === boxId);
    if (!box || box.isUnlocked) return false;

    const save = playgamaService.getSave();
    if (save.totalGrains < box.cost) return false;

    playgamaService.updateSave((draft) => {
      draft.totalGrains -= box.cost;
      if (!draft.unlockedBoxSkins.includes(boxId)) {
        draft.unlockedBoxSkins.push(boxId);
      }
      draft.equippedBoxSkin = boxId;
    });

    box.isUnlocked = true;
    eventBus.emit('save:updated', {
      totalGrains: playgamaService.getSave().totalGrains,
      unlockedLevels: save.unlockedLevel
    });
    eventBus.emit('skin:changed', {
      chickenSkinId: save.equippedChickenSkin,
      boxSkinId: boxId
    });

    return true;
  }

  public rentNinjaSkin(): boolean {
    playgamaService.updateSave((draft) => {
      draft.ninjaSkinRentedLevels = 3;
      draft.equippedChickenSkin = 'ninja';
    });

    const ninja = this.chickenSkins.find((s) => s.id === 'ninja');
    if (ninja) ninja.isUnlocked = true;

    eventBus.emit('skin:changed', {
      chickenSkinId: 'ninja',
      boxSkinId: playgamaService.getSave().equippedBoxSkin
    });

    return true;
  }

  public calculateStars(_levelIndex: number, timeElapsedSec: number, targetTimeSec: number, wasAlertTriggered: boolean): number {
    if (timeElapsedSec <= targetTimeSec && !wasAlertTriggered) {
      return 3; // Perfect stealth run!
    } else if (timeElapsedSec <= targetTimeSec * 1.35) {
      return 2;
    }
    return 1;
  }

  public onLevelCompleted(levelIndex: number, stars: number, grainsEarned: number, timeSec: number): void {
    playgamaService.updateSave((draft) => {
      // Advance unlocked level
      if (levelIndex >= draft.unlockedLevel && draft.unlockedLevel < 15) {
        draft.unlockedLevel = levelIndex + 1;
      }

      // Record stars
      const prevStars = draft.starsPerLevel[levelIndex] || 0;
      if (stars > prevStars) {
        draft.starsPerLevel[levelIndex] = stars;
      }

      // Record best time
      const prevBest = draft.bestTimes[levelIndex] || 9999;
      if (timeSec < prevBest) {
        draft.bestTimes[levelIndex] = Math.round(timeSec * 10) / 10;
      }

      // Add grains
      draft.totalGrains += grainsEarned;

      // Decrement ninja rental if active
      if (draft.ninjaSkinRentedLevels > 0) {
        draft.ninjaSkinRentedLevels--;
        if (draft.ninjaSkinRentedLevels <= 0 && !draft.unlockedChickenSkins.includes('ninja')) {
          if (draft.equippedChickenSkin === 'ninja') {
            draft.equippedChickenSkin = 'classic';
          }
        }
      }
    });

    this.syncFromSave();

    // Submit leaderboard score
    playgamaService.setLeaderboardScore('leaderboard_total_grains', playgamaService.getSave().totalGrains);
  }
}

export const progressionManager = ProgressionManager.getInstance();
