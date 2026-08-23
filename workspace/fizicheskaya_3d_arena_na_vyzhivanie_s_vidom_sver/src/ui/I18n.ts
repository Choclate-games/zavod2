/**
 * Локализация: язык берётся с площадки (fallback — язык браузера).
 * Ни одной строки текста в разметке экранов — только ключи.
 */
type Dict = Record<string, string>

const RU: Dict = {
  title: 'Ледовый Сумо-Батл: Последний Тюбинг',
  subtitle: 'Последний тюбинг на льду побеждает',
  play: 'В БОЙ НА ЛЁД',
  garage: 'АНГАР',
  leaderboard: 'РЕКОРДЫ',
  back: 'НАЗАД',
  next_match: 'СЛЕДУЮЩИЙ МАТЧ',
  main_menu: 'В ГЛАВНОЕ МЕНЮ',
  survivors: 'В ЖИВЫХ',
  time: 'ТАЙМЕР',
  mass: 'МАССА',
  boost: 'ТУРБО',
  rebound: 'ОТСКОК',
  pause: 'ПАУЗА',
  paused_title: 'МАТЧ НА ПАУЗЕ',
  resume: 'ПРОДОЛЖИТЬ',
  sound_on: 'ЗВУК ВКЛЮЧЁН',
  sound_off: 'ЗВУК ВЫКЛЮЧЕН',
  exit_to_menu: 'ВЫЙТИ В МЕНЮ',
  revive_title: 'ЛЕДОВОЕ СПАСЕНИЕ',
  revive_desc: 'Вернуться на лёд за просмотр рекламы?',
  revive_accept: 'СПАСТИСЬ ЗА РЕКЛАМУ',
  revive_decline: 'ПРИНЯТЬ ПОРАЖЕНИЕ',
  victory: 'ПОБЕДА',
  defeat: 'ПОРАЖЕНИЕ',
  place: 'МЕСТО',
  trophies: 'КУБКИ',
  coins: 'МОНЕТЫ',
  multiply_rewards: 'УТРОИТЬ ЗА РЕКЛАМУ',
  select: 'ВЫБРАТЬ',
  selected: 'В ИГРЕ',
  buy: 'КУПИТЬ ЗА КУБКИ',
  not_enough: 'НЕ ХВАТАЕТ КУБКОВ',
  leaderboard_title: 'ЛИГА АЙСБЕРГОВ',
  leaderboard_empty: 'Рекордов пока нет — сыграйте первый матч',
  leaderboard_error: 'Таблица недоступна, показаны локальные рекорды',
  your_best: 'ВАШ РЕКОРД',
  killed_by: 'выбит в воду',
  knocked_out: 'ВЫБИТ',
  desktop_hint: 'WASD — движение · ПРОБЕЛ — турбо · P — пауза',
  tubes_section: 'Тюбинги',
  pilots_section: 'Пилоты',
  trails_section: 'Эффекты следа',
}

const EN: Dict = {
  title: 'Ice Sumo Battle: Last Tubing',
  subtitle: 'Last tube on the ice wins',
  play: 'BATTLE ON ICE',
  garage: 'GARAGE',
  leaderboard: 'RECORDS',
  back: 'BACK',
  next_match: 'NEXT MATCH',
  main_menu: 'MAIN MENU',
  survivors: 'ALIVE',
  time: 'TIME',
  mass: 'MASS',
  boost: 'TURBO',
  rebound: 'REBOUND',
  pause: 'PAUSE',
  paused_title: 'MATCH PAUSED',
  resume: 'RESUME',
  sound_on: 'SOUND ON',
  sound_off: 'SOUND OFF',
  exit_to_menu: 'EXIT TO MENU',
  revive_title: 'ICE RESCUE',
  revive_desc: 'Return to the ice for a short ad?',
  revive_accept: 'RESCUE FOR AD',
  revive_decline: 'ACCEPT DEFEAT',
  victory: 'VICTORY',
  defeat: 'DEFEAT',
  place: 'PLACE',
  trophies: 'TROPHIES',
  coins: 'COINS',
  multiply_rewards: 'TRIPLE FOR AD',
  select: 'SELECT',
  selected: 'IN PLAY',
  buy: 'BUY FOR TROPHIES',
  not_enough: 'NOT ENOUGH TROPHIES',
  leaderboard_title: 'ICEBERG LEAGUE',
  leaderboard_empty: 'No records yet — play your first match',
  leaderboard_error: 'Table unavailable, showing local records',
  your_best: 'YOUR BEST',
  killed_by: 'knocked into water by',
  knocked_out: 'KNOCKED OUT',
  desktop_hint: 'WASD to move · SPACE for turbo · P to pause',
  tubes_section: 'Tubes',
  pilots_section: 'Pilots',
  trails_section: 'Trail effects',
}

export type LocaleKey = keyof typeof RU

export class I18n {
  private dict: Dict = RU

  setLanguage(lang: string): void {
    this.dict = lang.startsWith('ru') ? RU : EN
  }

  t(key: LocaleKey): string {
    return this.dict[key] ?? String(key)
  }
}
