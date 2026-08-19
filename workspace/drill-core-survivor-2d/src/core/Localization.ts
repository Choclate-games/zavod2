export type Language = 'ru' | 'en';

export interface Translations {
  [key: string]: {
    ru: string;
    en: string;
  };
}

export const DICTIONARY: Translations = {
  // Game & Title
  gameTitle: {
    ru: 'БУР СУДНОГО ДНЯ: ШАХТЕРСКИЙ РОГАЛИК',
    en: 'DOOMSDAY DRILL: MINER ROGUELIKE',
  },
  playBtn: {
    ru: 'В ЗАБОЙ!',
    en: 'DEPLOY DRILL!',
  },
  hangarBtn: {
    ru: 'АНГАР И ПРОКАЧКА',
    en: 'HANGAR & UPGRADES',
  },
  leaderboardBtn: {
    ru: 'РЕКОРДЫ',
    en: 'LEADERBOARDS',
  },
  settingsBtn: {
    ru: 'НАСТРОЙКИ',
    en: 'SETTINGS',
  },
  starterPerkBtn: {
    ru: 'ОРБИТАЛЬНЫЙ СУНДУК (РЕКЛАМА)',
    en: 'ORBITAL CACHE (REWARDED)',
  },
  
  // HUD
  hpLabel: {
    ru: 'КОРПУС',
    en: 'HULL HP',
  },
  heatLabel: {
    ru: 'ТЕМПЕРАТУРА',
    en: 'CORE HEAT',
  },
  craftLabel: {
    ru: 'КРАФТ-ЭНЕРГИЯ',
    en: 'CRAFT ENERGY',
  },
  depthLabel: {
    ru: 'ГЛУБИНА',
    en: 'DEPTH',
  },
  recordLabel: {
    ru: 'РЕКОРД',
    en: 'BEST',
  },
  crystalsLabel: {
    ru: 'КРИСТАЛЛЫ',
    en: 'CRYSTALS',
  },
  turboLabel: {
    ru: 'ТАРАН',
    en: 'TURBO',
  },
  skillLabel: {
    ru: 'ВОЛНА',
    en: 'BLAST',
  },
  pausedTitle: {
    ru: 'ПАУЗА',
    en: 'PAUSED',
  },
  resumeBtn: {
    ru: 'ПРОДОЛЖИТЬ',
    en: 'RESUME',
  },
  exitToMenuBtn: {
    ru: 'В АНГАР',
    en: 'ABORT TO HANGAR',
  },

  // Biomes
  biome_0: {
    ru: 'БАЗАЛЬТОВЫЙ ПЛАСТ (0 - 300м)',
    en: 'BASALT CRUST (0 - 300m)',
  },
  biome_1: {
    ru: 'КРИСТАЛЬНЫЕ ПЕЩЕРЫ (300 - 700м)',
    en: 'CRYSTAL CAVERNS (300 - 700m)',
  },
  biome_2: {
    ru: 'МАГМАТИЧЕСКИЙ РАЗЛОМ (700 - 1200м)',
    en: 'MAGMA ABYSS (700 - 1200m)',
  },
  biome_3: {
    ru: 'ДРЕВНЕЕ БИО-ГНЕЗДО (1200м+)',
    en: 'ANCIENT BIO-HIVE (1200m+)',
  },

  // Boss warning
  bossWarning: {
    ru: 'ВНИМАНИЕ! ТИТАН НЕДР ПРИБЛИЖАЕТСЯ!',
    en: 'WARNING! DEPTH TITAN APPROACHING!',
  },

  // Draft modal
  draftTitle: {
    ru: 'ВЫБЕРИТЕ МОДИФИКАЦИЮ БУРА',
    en: 'CHOOSE DRILL MODIFICATION',
  },
  rerollBtn: {
    ru: 'ПЕРЕБРОСИТЬ',
    en: 'REROLL',
  },
  rarityCommon: {
    ru: 'Обычный',
    en: 'Common',
  },
  rarityRare: {
    ru: 'Редкий',
    en: 'Rare',
  },
  rarityEpic: {
    ru: 'Эпический',
    en: 'Epic',
  },
  rarityLegendary: {
    ru: 'Легендарный',
    en: 'Legendary',
  },

  // Perks
  perk_frost_drill_name: {
    ru: 'Крио-фреза',
    en: 'Frost Cutter',
  },
  perk_frost_drill_desc: {
    ru: 'Охлаждает бур, снижая перегрев на 25%, и замораживает блоки и врагов вокруг.',
    en: 'Cools drill heat by 25% and freezes nearby terrain & enemies.',
  },
  perk_cryo_blast_name: {
    ru: 'Ледяная сверхновая',
    en: 'Cryo Supernova',
  },
  perk_cryo_blast_desc: {
    ru: 'Каждые 4 сек выпускает морозную волну, замедляющую врагов на 50%.',
    en: 'Releases a freezing frost ring every 4s, slowing enemies by 50%.',
  },
  perk_nuclear_ram_name: {
    ru: 'Ядерный таран',
    en: 'Nuclear Ram',
  },
  perk_nuclear_ram_desc: {
    ru: 'Удар бура на форсаже создает мощный взрыв, расчищающий породу.',
    en: 'Turbo charge triggers an explosive blast that disintegrates terrain.',
  },
  perk_seismic_wave_name: {
    ru: 'Сейсмо-импульс',
    en: 'Seismic Shockwave',
  },
  perk_seismic_wave_desc: {
    ru: 'Бурение порождает ударные волны вниз, разрушая дальние блоки.',
    en: 'Drilling sends seismic shockwaves downward, cracking blocks below.',
  },
  perk_plasma_turret_name: {
    ru: 'Плазменная турель',
    en: 'Plasma Turret',
  },
  perk_plasma_turret_desc: {
    ru: 'Монтирует скорострельную авто-турель для защиты от нападающих тварей.',
    en: 'Mounts a rapid-fire auto-turret targeting nearest subterranean beasts.',
  },
  perk_orbital_saws_name: {
    ru: 'Орбитальные диски',
    en: 'Orbital Saws',
  },
  perk_orbital_saws_desc: {
    ru: 'Пара вращающихся алмазных пил кружит вокруг корпуса, нанося урон.',
    en: 'Pair of diamond saw blades orbit the mech, slicing anything close.',
  },
  perk_tesla_arc_name: {
    ru: 'Цепная молния',
    en: 'Tesla Arc Emitter',
  },
  perk_tesla_arc_desc: {
    ru: 'Периодически бьет электрическим разрядом до 3 врагов по цепочке.',
    en: 'Zaps up to 3 nearby enemies with chain lightning arcs.',
  },
  perk_heavy_armor_name: {
    ru: 'Титановая броня',
    en: 'Titanium Plating',
  },
  perk_heavy_armor_desc: {
    ru: '+35 к максимальной прочности корпуса и снижение урона на 15%.',
    en: '+35 Max Hull HP and 15% flat damage mitigation.',
  },
  perk_magnet_name: {
    ru: 'Грави-магнит',
    en: 'Graviton Magnet',
  },
  perk_magnet_desc: {
    ru: 'Увеличивает радиус сбора кристаллов и руды на 60%.',
    en: 'Expands mineral and crystal collection radius by 60%.',
  },
  perk_nanite_repair_name: {
    ru: 'Наниты-ремонтники',
    en: 'Repair Nanites',
  },
  perk_nanite_repair_desc: {
    ru: 'Медленно восстанавливает 2 HP в секунду при отсутствии перегрева.',
    en: 'Slowly regenerates 2 HP per second when core is not overheated.',
  },

  // Game Over
  gameOverTitle: {
    ru: 'БУР УНИЧТОЖЕН!',
    en: 'DRILL DESTROYED!',
  },
  victoryTitle: {
    ru: 'ЯДРО ПЛАНЕТЫ ПОКОРЕНО!',
    en: 'PLANETARY CORE CONQUERED!',
  },
  runStatsDepth: {
    ru: 'Достигнутая глубина:',
    en: 'Max Depth Reached:',
  },
  runStatsKills: {
    ru: 'Уничтожено монстров:',
    en: 'Enemies Slain:',
  },
  runStatsBlocks: {
    ru: 'Разрушено блоков:',
    en: 'Blocks Destroyed:',
  },
  runStatsCrystals: {
    ru: 'Добыто кристаллов:',
    en: 'Crystals Mined:',
  },
  reviveBtn: {
    ru: 'РЕАКТОРНЫЙ ПЕРЕЗАПУСК (ВОСКРЕШЕНИЕ ЗА РЕКЛАМУ)',
    en: 'EMERGENCY REVIVE (REWARDED AD)',
  },
  doubleCrystalsBtn: {
    ru: 'УДВОИТЬ КРИСТАЛЛЫ Х2 (РЕКЛАМА)',
    en: 'DOUBLE CRYSTALS 2X (REWARDED AD)',
  },

  // Hangar upgrades
  hangarTitle: {
    ru: 'АНГАР МОДИФИКАЦИЙ',
    en: 'HANGAR ENGINEERING',
  },
  upgrade_hull_name: {
    ru: 'Прочность корпуса',
    en: 'Reinforced Hull',
  },
  upgrade_torque_name: {
    ru: 'Мощность бура (Урон)',
    en: 'Drill Torque (Power)',
  },
  upgrade_cooling_name: {
    ru: 'Охлаждение реактора',
    en: 'Reactor Cooling',
  },
  upgrade_magnet_name: {
    ru: 'Радиус магнита',
    en: 'Magnet Pull Range',
  },
  upgrade_turret_name: {
    ru: 'Стартовые турели',
    en: 'Starting Turrets',
  },
  upgradeCost: {
    ru: 'Цена:',
    en: 'Cost:',
  },
  upgradeMax: {
    ru: 'МАКС',
    en: 'MAX',
  },
  closeBtn: {
    ru: 'ЗАКРЫТЬ',
    en: 'CLOSE',
  },

  // Settings
  musicVol: {
    ru: 'Громкость музыки',
    en: 'Music Volume',
  },
  sfxVol: {
    ru: 'Громкость эффектов',
    en: 'SFX Volume',
  },
  languageLabel: {
    ru: 'Язык / Language',
    en: 'Language / Язык',
  },
  touchSens: {
    ru: 'Чувствительность тача',
    en: 'Touch Sensitivity',
  },
};

export class Localization {
  private static currentLang: Language = 'ru';

  public static setLanguage(lang: Language): void {
    if (lang === 'ru' || lang === 'en') {
      this.currentLang = lang;
    }
  }

  public static getLanguage(): Language {
    return this.currentLang;
  }

  public static t(key: string, placeholders?: Record<string, string | number>): string {
    const item = DICTIONARY[key];
    let str = item ? item[this.currentLang] || item.ru || key : key;
    if (placeholders) {
      for (const [k, v] of Object.entries(placeholders)) {
        str = str.replace(new RegExp(`{${k}}`, 'g'), String(v));
      }
    }
    return str;
  }
}
