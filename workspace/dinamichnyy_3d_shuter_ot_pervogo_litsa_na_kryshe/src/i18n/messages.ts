// Локализация: язык берётся с площадки (bridge.platform.language), не из меню.
// Ни одной строки интерфейса в разметке и коде экранов — только ключи.

export type Lang = 'ru' | 'en'

const RU = {
  title: 'ГРОМОВОЙ ПЕРЕХВАТ',
  subtitle: 'Штормовой Экспресс',
  startRaid: 'В РЕЙД',
  bestScore: 'Рекорд',
  menuHint: 'Крыша поезда, 85 секунд, эскадрилья дронов. Держите упреждение против ветра.',
  resume: 'Продолжить',
  restart: 'Заново',
  toMenu: 'В меню',
  pause: 'Пауза',
  victoryTitle: 'ПЕРЕХВАТ ВЫПОЛНЕН',
  defeatTitle: 'СОСТАВ ПОТЕРЯН',
  defeatShield: 'Энергощит визора исчерпан: плазмоиды роя пробили защиту.',
  defeatFall: 'Вы не удержались на крыше: падение в межвагонную бездну.',
  defeatTimeout: 'Время штормового окна вышло: «Громовержец» ушёл в грозу.',
  revive: 'Возрождение',
  reviveHint: 'Посмотреть ролик: полный щит и 2 секунды неуязвимости',
  score: 'Счёт',
  kills: 'Дроны',
  timeLeft: 'Время',
  rank: 'Ранг',
  shield: 'ЩИТ',
  speed: 'СКОРОСТЬ',
  wind: 'ВЕТЕР',
  teslaReady: 'ПЕРЕГРУЗКА ГОТОВА',
  loading: 'ЗАГРУЗКА ШТОРМА',
  rotateHint: 'Поверните телефон горизонтально',
  newRecord: 'Новый рекорд!',
  soundOn: 'Звук включён',
  soundOff: 'Звук выключен',
  sensitivity: 'Чувствительность',
  raidAgain: 'ЕЩЁ РЕЙД',
  comboX: 'x',
} as const

const EN: Record<keyof typeof RU, string> = {
  title: 'THUNDER INTERCEPT',
  subtitle: 'Storm Express',
  startRaid: 'START RAID',
  bestScore: 'Best score',
  menuHint: 'A train roof, 85 seconds, a drone squadron. Keep your lead against the wind.',
  resume: 'Resume',
  restart: 'Restart',
  toMenu: 'Main menu',
  pause: 'Paused',
  victoryTitle: 'INTERCEPT COMPLETE',
  defeatTitle: 'TRAIN LOST',
  defeatShield: 'Visor energy shield depleted: the swarm plasma broke through.',
  defeatFall: 'You lost the roof: fallen into the coupler gap.',
  defeatTimeout: 'The storm window closed: Thunderer escaped into the storm.',
  revive: 'Revive',
  reviveHint: 'Watch a video: full shield and 2 seconds of invulnerability',
  score: 'Score',
  kills: 'Drones',
  timeLeft: 'Time',
  rank: 'Rank',
  shield: 'SHIELD',
  speed: 'SPEED',
  wind: 'WIND',
  teslaReady: 'OVERLOAD READY',
  loading: 'LOADING THE STORM',
  rotateHint: 'Rotate your phone sideways',
  newRecord: 'New record!',
  soundOn: 'Sound on',
  soundOff: 'Sound off',
  sensitivity: 'Sensitivity',
  raidAgain: 'RAID AGAIN',
  comboX: 'x',
}

const PACKS: Record<Lang, Record<keyof typeof RU, string>> = { ru: RU, en: EN }

let currentLang: Lang = 'ru'

export function setLanguage(lang: string): void {
  currentLang = lang === 'en' ? 'en' : lang === 'ru' ? 'ru' : lang.startsWith('ru') ? 'ru' : 'en'
}

export function t(key: keyof typeof RU): string {
  return PACKS[currentLang][key]
}
