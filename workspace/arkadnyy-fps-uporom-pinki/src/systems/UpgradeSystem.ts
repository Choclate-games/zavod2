import { PerkCard, PerkRarity } from '../types';

export const ALL_PERKS: PerkCard[] = [
  {
    id: 'titanium_sole',
    title: 'Титановый рант',
    description: '+40% к скорости запуска врагов пинком и +30 к базовому урону',
    rarity: 'COMMON',
    tag: 'КИНЕТИКА',
    icon: '👢',
    apply: (stats, mods) => {
      stats.baseKickDamage += 30;
      stats.kickLaunchVelocity *= 1.4;
      mods.kickLaunchBonus += 0.4;
    },
  },
  {
    id: 'hydraulic_ricochet',
    title: 'Гидравлический рикошет',
    description: 'Враги отскакивают от стен до 2 раз, нанося 60% урона вторичным целям',
    rarity: 'RARE',
    tag: 'ФИЗИКА',
    icon: '⚡',
    apply: (_stats, mods) => {
      mods.ricochetCount += 2;
      mods.ricochetDamageRatio = 0.6;
    },
  },
  {
    id: 'gunpowder_catch',
    title: 'Пороховой зацеп',
    description: 'Перехват оружия в воздухе заряжает разрывные патроны со взрывом 2.2м',
    rarity: 'RARE',
    tag: 'ТРЮК',
    icon: '💥',
    apply: (_stats, mods) => {
      mods.gunpowderCatchExplosion = true;
    },
  },
  {
    id: 'supersonic_slide',
    title: 'Сверхзвуковой слайд-кик',
    description: '+50% к скорости подката. Пинок в слайде сбивает летящие пули обратно во врагов',
    rarity: 'EPIC',
    tag: 'СКОРОСТЬ',
    icon: '💨',
    apply: (stats, mods) => {
      stats.slideSpeed *= 1.5;
      mods.sonicSlideKick = true;
    },
  },
  {
    id: 'kinetic_collapse',
    title: 'Кинетический коллапс',
    description: 'Смерть врага от удара о стену вызывает детонацию брони с уроном 150 ед по площади 3.5м',
    rarity: 'EPIC',
    tag: 'СПЛЭТ',
    icon: '🌋',
    apply: (_stats, mods) => {
      mods.kineticCollapseExplosion = true;
    },
  },
  {
    id: 'vampiric_kick',
    title: 'Вампирские берцы',
    description: 'Каждый успешный пинок по врагу восстанавливает +15 HP',
    rarity: 'COMMON',
    tag: 'ВЫЖИВАНИЕ',
    icon: '🩸',
    apply: (stats) => {
      stats.maxHp += 25;
      stats.hp += 25;
    },
  },
  {
    id: 'heavy_plates',
    title: 'Штурмовой кевлар',
    description: '+35 к максимальному щиту и +15% к снижению входящего урона',
    rarity: 'COMMON',
    tag: 'БРОНЯ',
    icon: '🛡️',
    apply: (stats) => {
      stats.maxShield += 35;
      stats.shield = stats.maxShield;
      stats.armorReduction = Math.min(0.6, stats.armorReduction + 0.15);
    },
  },
  {
    id: 'magnet_gloves',
    title: 'Магнитный захват',
    description: 'Радиус автоподхвата летящего оружия увеличен до 3.0 метров',
    rarity: 'COMMON',
    tag: 'ЛОВКОСТЬ',
    icon: '🧲',
    apply: (stats) => {
      stats.disarmMagnetRadius = 3.0;
    },
  },
];

export class UpgradeSystem {
  private static instance: UpgradeSystem;

  public static getInstance(): UpgradeSystem {
    if (!UpgradeSystem.instance) {
      UpgradeSystem.instance = new UpgradeSystem();
    }
    return UpgradeSystem.instance;
  }

  public getRandomDraft(count = 3): PerkCard[] {
    const pool = [...ALL_PERKS];
    const draft: PerkCard[] = [];

    while (draft.length < count && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      draft.push(pool[idx]);
      pool.splice(idx, 1);
    }

    return draft;
  }
}
