export interface UpgradeModule {
  id: string;
  name: string;
  desc: string;
  icon: string;
  rarity: 'common' | 'rare' | 'prototype';
  level: number;
  maxLevel: number;
}

export class UpgradeSystem {
  private static instance: UpgradeSystem;

  private allModules: UpgradeModule[] = [
    {
      id: 'circular_saws',
      name: 'Дисковые Пилы на Ступицах',
      desc: 'Вращающиеся лезвия наносят x2.5 режущий урон всем врагам по радиусу заноса',
      icon: '⚙️',
      rarity: 'common',
      level: 0,
      maxLevel: 5,
    },
    {
      id: 'autocannon',
      name: 'Крышная Автопушка 20-мм',
      desc: 'Автоматически ведет огонь кинетическими бронебойными снарядами по ближайшим патрулям',
      icon: '💥',
      rarity: 'common',
      level: 0,
      maxLevel: 5,
    },
    {
      id: 'napalm_trail',
      name: 'Напалмовый Шлейф',
      desc: 'Оставляет горящую огненную полосу на асфальте при дрифте, испепеляющую преследователей',
      icon: '🔥',
      rarity: 'rare',
      level: 0,
      maxLevel: 5,
    },
    {
      id: 'tesla_emp',
      name: 'Электромагнитный Разрядник',
      desc: 'Генерирует дуговые молнии во время тарана, оглушая и детонируя электронику машин копов',
      icon: '⚡',
      rarity: 'prototype',
      level: 0,
      maxLevel: 5,
    },
    {
      id: 'spiked_bumper',
      name: 'Усиленный Кенгурятник',
      desc: '+35% к урону лобового тарана и увеличение радиуса ударной волны',
      icon: '🛡️',
      rarity: 'common',
      level: 0,
      maxLevel: 5,
    },
    {
      id: 'turbo_charger',
      name: 'Турбо-Компрессор Нитро',
      desc: '+25% к скорости набора Нитро-Ярости во время заноса',
      icon: '🚀',
      rarity: 'rare',
      level: 0,
      maxLevel: 5,
    },
    {
      id: 'magnetic_ram',
      name: 'Магнитный Захват Капота',
      desc: '+50% к радиусу сбора шестеренок и автоматический подбор на высокой скорости',
      icon: '🧲',
      rarity: 'common',
      level: 0,
      maxLevel: 5,
    },
  ];

  static get(): UpgradeSystem {
    if (!UpgradeSystem.instance) {
      UpgradeSystem.instance = new UpgradeSystem();
    }
    return UpgradeSystem.instance;
  }

  reset(): void {
    this.allModules.forEach(m => m.level = 0);
  }

  getRandomThreeChoices(guaranteeRare = false): UpgradeModule[] {
    const available = this.allModules.filter(m => m.level < m.maxLevel);
    if (available.length <= 3) return [...available];

    const shuffled = [...available].sort(() => Math.random() - 0.5);

    if (guaranteeRare) {
      const rareIndex = shuffled.findIndex(m => m.rarity === 'rare' || m.rarity === 'prototype');
      if (rareIndex > 2 && rareIndex !== -1) {
        const item = shuffled.splice(rareIndex, 1)[0];
        shuffled.unshift(item);
      }
    }

    return shuffled.slice(0, 3);
  }

  applyUpgrade(moduleId: string): void {
    const mod = this.allModules.find(m => m.id === moduleId);
    if (mod && mod.level < mod.maxLevel) {
      mod.level++;
    }
  }

  getModuleLevel(moduleId: string): number {
    const mod = this.allModules.find(m => m.id === moduleId);
    return mod ? mod.level : 0;
  }
}
