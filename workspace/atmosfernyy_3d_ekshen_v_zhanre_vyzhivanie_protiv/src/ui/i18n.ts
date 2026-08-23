/**
 * Локализация: язык берётся из площадки/браузера при старте, в разметке —
 * только ключи. Ключи покрыты во всех языках; строки не склеиваются.
 */
export type Locale = 'ru' | 'en'

export interface Dict {
  titleMain: string
  titleSub: string
  tagline: string
  bestLabel: string
  start: string
  leaderboard: string
  soundOn: string
  soundOff: string
  resume: string
  menu: string
  restart: string
  pauseTitle: string
  victoryTitle: string
  defeatTitle: string
  statScore: string
  statTime: string
  statChains: string
  statOverheat: string
  revive: string
  double: string
  hintDesktop: string
  hintTouch: string
  seconds: string
}

const RU: Dict = {
  titleMain: 'МАЯК',
  titleSub: 'НОЧНАЯ ВАХТА',
  tagline: 'Продержись до рассвета 06:00',
  bestLabel: 'Рекорд вахты',
  start: 'НАЧАТЬ ВАХТУ',
  leaderboard: 'Таблица лидеров',
  soundOn: 'Звук: вкл',
  soundOff: 'Звук: выкл',
  resume: 'Продолжить',
  menu: 'В меню',
  restart: 'Заново',
  pauseTitle: 'ПАУЗА',
  victoryTitle: '06:00. РАССВЕТ',
  defeatTitle: 'МАЯК ПАЛ',
  statScore: 'Счёт смотрителя',
  statTime: 'Время вахты',
  statChains: 'Цепных детонаций',
  statOverheat: 'Перегревов линзы',
  revive: 'Спасение вахты',
  double: 'Удвоить очки',
  hintDesktop: 'Мышь — поворот прожектора · Пробел или ЛКМ — фокус · E — паровой сброс · Esc — пауза',
  hintTouch: 'Драг слева — поворот · ФОКУС — прожиг · СБРОС — паровой контрудар',
  seconds: 'с',
}

const EN: Dict = {
  titleMain: 'THE LIGHTHOUSE',
  titleSub: 'NIGHT WATCH',
  tagline: 'Hold out until the 06:00 dawn',
  bestLabel: 'Best watch',
  start: 'START THE WATCH',
  leaderboard: 'Leaderboard',
  soundOn: 'Sound: on',
  soundOff: 'Sound: off',
  resume: 'Resume',
  menu: 'Main menu',
  restart: 'Restart',
  pauseTitle: 'PAUSED',
  victoryTitle: '06:00. DAYBREAK',
  defeatTitle: 'THE LIGHTHOUSE HAS FALLEN',
  statScore: 'Keeper score',
  statTime: 'Watch time',
  statChains: 'Chain detonations',
  statOverheat: 'Lens overheats',
  revive: 'Save the watch',
  double: 'Double score',
  hintDesktop: 'Mouse — aim beam · Space or LMB — focus · E — steam vent · Esc — pause',
  hintTouch: 'Left drag — aim · FOCUS — burn · VENT — steam counter',
  seconds: 's',
}

export const DICTS: Record<Locale, Dict> = { ru: RU, en: EN }

export function detectLocale(platformLocale: string | null): Locale {
  const source = (platformLocale || navigator.language || 'ru').toLowerCase()
  return source.startsWith('ru') || source.startsWith('be') || source.startsWith('uk') ? 'ru' : 'en'
}

export function formatClock(totalMinutes: number): string {
  const minutes = Math.max(0, Math.min(360, Math.round(totalMinutes)))
  const hh = Math.floor(minutes / 60)
  const mm = minutes % 60
  const pad = (value: number): string => (value < 10 ? `0${value}` : String(value))
  return `${pad(hh)}:${pad(mm)}`
}
