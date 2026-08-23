export const DICTIONARY: Record<string, Record<string, string>> = {
  ru: {
    game_title: 'Снайпер: Призрачный Контракт',
    start_contract: 'НАЧАТЬ КОНТРАКТ',
    arsenal: 'АРСЕНАЛ',
    back: 'НАЗАД',
    next_contract: 'СЛЕДУЮЩИЙ КОНТРАКТ',
    retry: 'ПОВТОРИТЬ',
    contract_complete: 'КОНТРАКТ ВЫПОЛНЕН',
    mission_failed: 'ТРЕВОГА: МИССИЯ ПРОВАЛЕНА',
    headshots: 'Хедшоты',
    accidents: 'Несчастные случаи',
    ghost_bonus: 'Бонус «Призрак»',
    bounty: 'Награда за контракт',
    wind: 'Ветер',
    lungs: 'ФОКУС',
    fire: 'ВЫСТРЕЛ',
    ammo: 'Патроны',
    targets: 'Цели',
    double_reward: 'УДВОИТЬ НАГРАДУ',
    rewind_time: 'ПЕРЕМОТКА ВРЕМЕНИ',
    selected: 'ВЫБРАНО',
    select: 'ВЫБРАТЬ',
    buy: 'КУПИТЬ',
    damage: 'Урон',
    velocity: 'Скорость пули',
    suppression: 'Глушение'
  },
  en: {
    game_title: 'Sniper: Ghost Contract',
    start_contract: 'START CONTRACT',
    arsenal: 'ARSENAL',
    back: 'BACK',
    next_contract: 'NEXT CONTRACT',
    retry: 'RETRY',
    contract_complete: 'CONTRACT COMPLETED',
    mission_failed: 'ALARM: MISSION FAILED',
    headshots: 'Headshots',
    accidents: 'Accident Kills',
    ghost_bonus: 'Ghost Bonus',
    bounty: 'Contract Bounty',
    wind: 'Wind',
    lungs: 'FOCUS',
    fire: 'FIRE',
    ammo: 'Ammo',
    targets: 'Targets',
    double_reward: 'DOUBLE REWARD',
    rewind_time: 'REWIND TIME',
    selected: 'SELECTED',
    select: 'SELECT',
    buy: 'BUY',
    damage: 'Damage',
    velocity: 'Muzzle Velocity',
    suppression: 'Suppression'
  }
};

export class I18nService {
  private static currentLang = 'ru';

  public static setLanguage(lang: string): void {
    this.currentLang = lang === 'en' ? 'en' : 'ru';
  }

  public static t(key: string): string {
    const dict = DICTIONARY[this.currentLang] || DICTIONARY.ru;
    return dict[key] || key;
  }
}
