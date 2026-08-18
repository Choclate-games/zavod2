export type Language = 'ru' | 'en';

export const DICTIONARY: Record<Language, Record<string, string>> = {
  ru: {
    game_title: 'Песочный Бастион 3D: Защита Пляжа',
    loading: 'Загрузка песка и волн...',
    play: 'В БОЙ!',
    workshop: 'Мастерская',
    settings: 'Настройки',
    level_select: 'Выбор Пляжа',
    start_wave: '▶ СТАРТ ВОЛНЫ',
    wave_in_progress: '🌊 ВОЛНА ИДЁТ...',
    speed_1x: '1x',
    speed_2x: '2x',
    shells: 'Ракушки',
    pearls: 'Жемчуг',
    castle_hp: 'Замок',
    path_blocked: '⛔ Путь заблокирован! Нельзя перекрывать единственный проход к замку!',
    not_enough_shells: '🐚 Недостаточно ракушек!',
    tower_placed: 'Башня установлена!',
    tower_upgraded: 'Башня улучшена!',
    tower_sold: 'Башня продана!',
    upgrade: 'Улучшить',
    sell: 'Продать',
    close: 'Закрыть',
    tsunami_ready: '🌊 Цунами',
    tsunami_cast: '🌊 Морская волна смывает врагов!',
    cannon_name: 'Ракушечная Пушка',
    cannon_desc: 'Стреляет острыми ракушками по одиночным целям с высоким уроном.',
    splasher_name: 'Водная Поливалка',
    splasher_desc: 'Разбрызгивает воду по кругу, нанося урон и замедляя врагов на 50%.',
    wall_name: 'Песчаная Стена',
    wall_desc: 'Прочный блок утрамбованного песка для создания длинного лабиринта.',
    level_1_name: 'Песчаная Бухта',
    level_2_name: 'Коралловый Риф',
    level_3_name: 'Пальмовый Мыс',
    level_endless: 'Бесконечный Пляж',
    victory_title: '🎉 ПОБЕДА!',
    victory_msg: 'Пляж спасён! Песчаный Замок устоял перед всеми волнами захватчиков!',
    defeat_title: '💔 ЗАМОК РАЗРУШЕН',
    defeat_msg: 'Морские захватчики прорвали оборону и размыли бастион!',
    rewarded_double: '🎬 Удвоить награду (x2)',
    rewarded_revive: '🎬 Второй шанс (+50% HP и смыв волной)',
    next_level: 'Дальше ▶',
    retry: '🔄 Заново',
    to_menu: 'В меню',
    resume: 'Продолжить',
    restart: 'Начать заново',
    talent_sharper_shells: 'Острые Ракушки',
    talent_sharper_shells_desc: '+15% к урону Ракушечной Пушки за уровень.',
    talent_super_soaker: 'Мощная Струя',
    talent_super_soaker_desc: '+10% к замедлению и радиусу Водной Поливалки.',
    talent_reinforced_sand: 'Крепкий Песок',
    talent_reinforced_sand_desc: '+25% к прочности Песчаного Замка.',
    talent_starting_bounty: 'Щедрый Прилив',
    talent_starting_bounty_desc: '+40 стартовых ракушек на каждом уровне.',
    max_level: 'МАКС',
    cost: 'Цена',
    buy: 'Купить',
  },
  en: {
    game_title: 'Sandcastle Defense 3D: Beach Protection',
    loading: 'Loading sand and waves...',
    play: 'BATTLE!',
    workshop: 'Workshop',
    settings: 'Settings',
    level_select: 'Beach Select',
    start_wave: '▶ START WAVE',
    wave_in_progress: '🌊 WAVE RUNNING...',
    speed_1x: '1x',
    speed_2x: '2x',
    shells: 'Shells',
    pearls: 'Pearls',
    castle_hp: 'Castle',
    path_blocked: '⛔ Path blocked! You cannot wall off the only route to the castle!',
    not_enough_shells: '🐚 Not enough shells!',
    tower_placed: 'Tower built!',
    tower_upgraded: 'Tower upgraded!',
    tower_sold: 'Tower sold!',
    upgrade: 'Upgrade',
    sell: 'Sell',
    close: 'Close',
    tsunami_ready: '🌊 Tsunami',
    tsunami_cast: '🌊 A giant ocean wave sweeps away the invaders!',
    cannon_name: 'Shell Cannon',
    cannon_desc: 'Shoots sharp shells at single targets with high ballistic damage.',
    splasher_name: 'Water Sprinkler',
    splasher_desc: 'Sprays water in an area, dealing damage and slowing enemies by 50%.',
    wall_name: 'Sand Wall',
    wall_desc: 'Sturdy block of packed sand to build intricate maze paths.',
    level_1_name: 'Sandy Cove',
    level_2_name: 'Coral Reef',
    level_3_name: 'Palm Point',
    level_endless: 'Endless Beach',
    victory_title: '🎉 VICTORY!',
    victory_msg: 'The beach is saved! The Sandcastle withstood all enemy waves!',
    defeat_title: '💔 CASTLE DESTROYED',
    defeat_msg: 'The sea invaders broke through your defenses and washed the castle away!',
    rewarded_double: '🎬 Double Reward (x2)',
    rewarded_revive: '🎬 Second Chance (+50% HP & Wave Sweep)',
    next_level: 'Next ▶',
    retry: '🔄 Retry',
    to_menu: 'Main Menu',
    resume: 'Resume',
    restart: 'Restart Level',
    talent_sharper_shells: 'Sharper Shells',
    talent_sharper_shells_desc: '+15% Shell Cannon damage per level.',
    talent_super_soaker: 'Super Soaker',
    talent_super_soaker_desc: '+10% Sprinkler slow potency and range.',
    talent_reinforced_sand: 'Reinforced Sand',
    talent_reinforced_sand_desc: '+25% Sandcastle Max HP.',
    talent_starting_bounty: 'Generous Tide',
    talent_starting_bounty_desc: '+40 starting shells on each level.',
    max_level: 'MAX',
    cost: 'Cost',
    buy: 'Upgrade',
  },
};

export class Localization {
  private static currentLang: Language = 'ru';

  public static setLanguage(lang: string): void {
    if (lang.toLowerCase().startsWith('ru')) {
      this.currentLang = 'ru';
    } else {
      this.currentLang = 'en';
    }
  }

  public static getLanguage(): Language {
    return this.currentLang;
  }

  public static t(key: string): string {
    const dict = DICTIONARY[this.currentLang] || DICTIONARY.ru;
    return dict[key] || key;
  }
}
