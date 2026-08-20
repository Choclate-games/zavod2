import { storageService } from '../platform/StorageService';

export interface ColonyPerk {
  id: string;
  name: string;
  desc: string;
  costGears: number;
  costScrolls: number;
  level: number;
  maxLevel: number;
}

export class ColonySystem {
  private perks: ColonyPerk[] = [
    {
      id: 'colony_forge',
      name: '⚒️ Кузня Колонии',
      desc: '+5 к базовому урону бура за каждый уровень.',
      costGears: 15,
      costScrolls: 0,
      level: 0,
      maxLevel: 10,
    },
    {
      id: 'bio_garden',
      name: '🍄 Грибная Ферма',
      desc: '+15 HP и +10 Щита к начальным параметрам.',
      costGears: 20,
      costScrolls: 1,
      level: 0,
      maxLevel: 10,
    },
    {
      id: 'burrow_network',
      name: '🚇 Сеть Норок',
      desc: '+7% к базовой скорости передвижения.',
      costGears: 25,
      costScrolls: 1,
      level: 0,
      maxLevel: 8,
    },
    {
      id: 'radar_tower',
      name: '📡 Радарная Вышка',
      desc: '+2м к радиусу волн сонара и ускорение восстановления энергии.',
      costGears: 30,
      costScrolls: 2,
      level: 0,
      maxLevel: 5,
    },
    {
      id: 'archive_library',
      name: '📚 Архив Мудрецов',
      desc: '+20% к шансу выпадения ценных свитков и кристаллов.',
      costGears: 40,
      costScrolls: 3,
      level: 0,
      maxLevel: 5,
    },
  ];

  constructor() {
    this.syncFromStorage();
  }

  syncFromStorage(): void {
    const saved = storageService.getData().colonyUpgrades;
    this.perks.forEach((p) => {
      p.level = saved[p.id] || 0;
    });
  }

  getPerks(): ColonyPerk[] {
    this.syncFromStorage();
    return this.perks;
  }

  upgradePerk(perkId: string): boolean {
    const perk = this.perks.find((p) => p.id === perkId);
    if (!perk || perk.level >= perk.maxLevel) return false;

    const data = storageService.getData();
    const currentGearsCost = perk.costGears * (perk.level + 1);
    const currentScrollsCost = perk.costScrolls;

    if (data.gears >= currentGearsCost && data.scrolls >= currentScrollsCost) {
      storageService.updateData((d) => {
        d.gears -= currentGearsCost;
        d.scrolls -= currentScrollsCost;
        d.colonyUpgrades[perkId] = (d.colonyUpgrades[perkId] || 0) + 1;
      });
      this.syncFromStorage();
      return true;
    }
    return false;
  }
}

export const colonySystem = new ColonySystem();
