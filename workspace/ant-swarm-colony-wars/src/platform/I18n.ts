export type SupportedLanguage = 'ru' | 'en';

export interface Translations {
  gameTitle: string;
  gameSubtitle: string;
  play: string;
  evolution: string;
  settings: string;
  restart: string;
  nextLevel: string;
  resume: string;
  mainMenu: string;
  victory: string;
  defeat: string;
  victoryDesc: string;
  defeatDesc: string;
  level: string;
  biomass: string;
  population: string;
  pheromones: string;
  workers: string;
  soldiers: string;
  bombers: string;
  disperse: string;
  sphere: string;
  drawHint: string;
  bridgeHint: string;
  bomberHint: string;
  objectiveDefault: string;
  objectiveChasm: string;
  objectiveWall: string;
  rewardDoubleBiomass: string;
  rewardInstantSwarm: string;
  sound: string;
  music: string;
  language: string;
  close: string;
  buy: string;
  upgraded: string;
  maxLevel: string;
  cost: string;
  notEnoughBiomass: string;
}

const RU: Translations = {
  gameTitle: 'Муравьиный Рой: Война Колоний',
  gameSubtitle: 'Тактический симулятор роя и живых био-структур',
  play: 'В БОЙ 🐜',
  evolution: 'МУТАЦИИ ДНК 🧬',
  settings: 'НАСТРОЙКИ ⚙️',
  restart: 'ЗАНОВО 🔄',
  nextLevel: 'СЛЕДУЮЩИЙ УРОВЕНЬ ⏩',
  resume: 'ПРОДОЛЖИТЬ ▶️',
  mainMenu: 'В МЕНЮ 🏠',
  victory: 'ПОБЕДА КОЛОНИИ! 🏆',
  defeat: 'МУРАВЕЙНИК ПАЛ 💀',
  victoryDesc: 'Все вражеские гнезда захвачены! Королева ликует!',
  defeatDesc: 'Ваш главный муравейник был разрушен врагами.',
  level: 'Уровень',
  biomass: 'Биомасса',
  population: 'Популяция',
  pheromones: 'Феромоны',
  workers: 'Рабочие',
  soldiers: 'Солдаты',
  bombers: 'Бомбардиры',
  disperse: 'Рассеять',
  sphere: 'Сфера',
  drawHint: '✍️ Проведите пальцем или мышью, чтобы направить рой!',
  bridgeHint: '🌉 Направьте Рабочих к пропасти, чтобы построить живой мост!',
  bomberHint: '💥 Направьте Бомбардиров на стену, чтобы взорвать её!',
  objectiveDefault: 'Захватите все вражеские муравейники!',
  objectiveChasm: 'Постройте живой мост через расщелину!',
  objectiveWall: 'Взорвите укрепления бомбардирами и захватите гнездо!',
  rewardDoubleBiomass: '🎬 Удвоить биомассу (+{amount} 🧬)',
  rewardInstantSwarm: '🎬 Призыв 150 солдат (Подкрепление)',
  sound: 'Звуковые эффекты',
  music: 'Музыка',
  language: 'Язык / Language',
  close: 'ЗАКРЫТЬ',
  buy: 'ИЗУЧИТЬ',
  upgraded: 'ИЗУЧЕНО',
  maxLevel: 'МАКС',
  cost: 'Цена',
  notEnoughBiomass: 'Недостаточно биомассы!'
};

const EN: Translations = {
  gameTitle: 'Ant Swarm: Colony Wars',
  gameSubtitle: 'Tactical Swarm & Living Bio-Structures Simulator',
  play: 'TO BATTLE 🐜',
  evolution: 'DNA MUTATIONS 🧬',
  settings: 'SETTINGS ⚙️',
  restart: 'RETRY 🔄',
  nextLevel: 'NEXT LEVEL ⏩',
  resume: 'RESUME ▶️',
  mainMenu: 'MAIN MENU 🏠',
  victory: 'COLONY VICTORY! 🏆',
  defeat: 'COLONY OVERRUN 💀',
  victoryDesc: 'All enemy hives conquered! The Queen triumphs!',
  defeatDesc: 'Your primary hive was destroyed by enemy swarms.',
  level: 'Level',
  biomass: 'Biomass',
  population: 'Population',
  pheromones: 'Pheromones',
  workers: 'Workers',
  soldiers: 'Soldiers',
  bombers: 'Bombers',
  disperse: 'Disperse',
  sphere: 'Sphere',
  drawHint: '✍️ Drag finger or mouse to lay pheromone trails!',
  bridgeHint: '🌉 Direct Workers to the chasm to build a living bridge!',
  bomberHint: '💥 Direct Bombers to destructible walls to blast them!',
  objectiveDefault: 'Conquer all enemy hives on the map!',
  objectiveChasm: 'Build a living ant bridge across the chasm!',
  objectiveWall: 'Breach enemy barricades and claim the nest!',
  rewardDoubleBiomass: '🎬 Double Biomass (+{amount} 🧬)',
  rewardInstantSwarm: '🎬 Summon 150 Soldiers (Reinforcements)',
  sound: 'Sound Effects',
  music: 'Music',
  language: 'Language / Язык',
  close: 'CLOSE',
  buy: 'RESEARCH',
  upgraded: 'MAXED',
  maxLevel: 'MAX',
  cost: 'Cost',
  notEnoughBiomass: 'Not enough biomass!'
};

export class I18nService {
  private static instance: I18nService;
  private currentLang: SupportedLanguage = 'ru';

  private constructor() {
    // Detect system / navigator language
    try {
      const navLang = navigator.language || (navigator as { userLanguage?: string }).userLanguage || '';
      if (navLang.startsWith('en')) {
        this.currentLang = 'en';
      }
    } catch {
      this.currentLang = 'ru';
    }
  }

  public static getInstance(): I18nService {
    if (!I18nService.instance) {
      I18nService.instance = new I18nService();
    }
    return I18nService.instance;
  }

  public setLanguage(lang: SupportedLanguage): void {
    this.currentLang = lang;
  }

  public getLanguage(): SupportedLanguage {
    return this.currentLang;
  }

  public t(key: keyof Translations, params?: Record<string, string | number>): string {
    const dict = this.currentLang === 'ru' ? RU : EN;
    let text = dict[key] || RU[key] || key;
    if (params) {
      for (const [pKey, pVal] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal));
      }
    }
    return text;
  }

  public get dict(): Translations {
    return this.currentLang === 'ru' ? RU : EN;
  }
}

export const i18n = I18nService.getInstance();
