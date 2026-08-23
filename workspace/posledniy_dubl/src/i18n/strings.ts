/**
 * Локализация: язык берётся с площадки, строки — только ключи.
 * Числа форматируются по локали, не склейкой строк.
 */

export type Lang = 'ru' | 'en'

type Dictionary = Record<string, string>

const RU: Dictionary = {
  title: 'Один дубль: Разбор сцены',
  subtitle: 'Постановочный физический шутер: один выстрел — одна монтажная команда',
  menu_goal: 'Обезвредь 6 саботажников, открой 3 перехода и закончи дубль с патроном в магазине',
  menu_record_none: 'Рекорда ещё нет',
  start_take: 'Начать дубль',
  fire: 'Огонь',
  resume: 'Продолжить',
  restart: 'Начать заново',
  retry_rewarded: 'Повтор дубля за рекламу',
  to_menu: 'В меню',
  pause_title: 'Дубль приостановлен',
  victory_title: 'Дубль снят',
  fail_title: 'Дубль забракован',
  fail_ammo: 'Боезапас исчерпан',
  fail_charges: 'Заряд активирован',
  fail_hits: 'Стрелок ранен',
  fail_time: 'Не уложился в метраж',
  stats_time: 'Метраж',
  stats_accuracy: 'Точность',
  stats_headshots: 'Хедшоты',
  stats_rating: 'Рейтинг',
  new_record: 'Новый рекорд!',
  best_time: 'Лучший метраж',
  objective_stop_saboteur: 'Останови саботажника',
  objective_open_gate: 'Открой переход: разбей опору',
  objective_move_on: 'Иди к следующей точке',
  objective_finish: 'Дойди до отметки режиссёра',
  hud_marks: 'Отметки',
  hud_charges: 'Заряды',
  loading: 'Загрузка павильона',
  tap_to_focus: 'Кликни, чтобы захватить мышь',
  seconds_short: 'с',
}

const EN: Dictionary = {
  title: 'One Take: Scene Breakdown',
  subtitle: 'Staged physical shooter: one shot is one editing command',
  menu_goal: 'Neutralize 6 saboteurs, open 3 transitions and finish the take with a round in the magazine',
  menu_record_none: 'No record yet',
  start_take: 'Start the take',
  fire: 'Fire',
  resume: 'Resume',
  restart: 'Restart',
  retry_rewarded: 'Retry the take for an ad',
  to_menu: 'Menu',
  pause_title: 'Take suspended',
  victory_title: 'Take wrapped',
  fail_title: 'Take rejected',
  fail_ammo: 'Out of ammo',
  fail_charges: 'Charge detonated',
  fail_hits: 'Operator wounded',
  fail_time: 'Over runtime',
  stats_time: 'Runtime',
  stats_accuracy: 'Accuracy',
  stats_headshots: 'Headshots',
  stats_rating: 'Rating',
  new_record: 'New record!',
  best_time: 'Best time',
  loading: 'Loading the pavilion',
  tap_to_focus: 'Click to capture the mouse',
  objective_stop_saboteur: 'Stop the saboteur',
  objective_open_gate: 'Open the passage: break the support',
  objective_move_on: 'Move to the next point',
  objective_finish: 'Reach the director mark',
  hud_marks: 'Marks',
  hud_charges: 'Charges',
  seconds_short: 's',
}

const DICTS: Record<Lang, Dictionary> = { ru: RU, en: EN }

let currentLang: Lang = 'ru'

export function setLanguage(lang: string): void {
  currentLang = lang.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

export function getLanguage(): Lang {
  return currentLang
}

export function t(key: keyof typeof RU): string {
  const dict = DICTS[currentLang]
  return dict[key] ?? RU[key] ?? String(key)
}

/** Форматирование чисел по локали. */
export function formatNumber(value: number, digits = 0): string {
  const locale = currentLang === 'ru' ? 'ru-RU' : 'en-US'
  return value.toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}
