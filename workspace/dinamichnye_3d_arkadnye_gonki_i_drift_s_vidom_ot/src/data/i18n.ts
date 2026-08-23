/**
 * Локализация. Язык берётся с площадки (Playgama), при отсутствии — русский.
 * Ни одной строки интерфейса в разметке и коде экранов — только ключи.
 */
export type Lang = 'ru' | 'en'

type Dict = Record<string, string>

const ru: Dict = {
  'title': 'Ледяной Экспресс: Жидкий Баланс',
  'menu.subtitle': 'Держи волну. Лови занос. Не упади.',
  'menu.play': 'В Заезд',
  'menu.tracks': 'Перевалы',
  'menu.sound': 'Звук',
  'menu.leaderboard': 'Зачёт звёзд',
  'menu.loading': 'Прогрев дизеля',
  'tracks.title': 'Перевалы',
  'tracks.back': 'Назад',
  'tracks.start': 'Спуск',
  'tracks.locked': 'Открыть предыдущий перевал',
  'tracks.best': 'Рекорд',
  'tracks.stars3': '3 звезды: быстрее {time} с и груз от 75%',
  'track.countdown': '{n}',
  'track.go': 'СТАРТ',
  'hud.volume': 'Молоко',
  'hud.multiplier': 'Фактор бездны',
  'hud.drift': 'Дрифт',
  'hud.checkpoint': 'Чекпоинт {n}/3',
  'hud.split.ahead': '+{s} с',
  'hud.split.behind': '−{s} с',
  'pause.title': 'Пауза',
  'pause.resume': 'Продолжить',
  'pause.restart': 'Рестарт',
  'pause.menu': 'В меню',
  'results.title': 'Взвешивание',
  'results.win': 'Груз доставлен',
  'results.lose': 'Груз не принят',
  'results.time': 'Время',
  'results.score': 'Очки',
  'results.next': 'Следующий перевал',
  'results.retry': 'Ещё раз',
  'results.double': 'Удвоить награду',
  'results.doubled': 'Награда удвоена',
  'crash.title': 'Заезд сорван',
  'crash.fall': 'Молоковоз ушёл под лёд пропасти',
  'crash.rollover': 'Цистерна опрокинулась, люки разгерметизированы',
  'crash.revive': 'Возродиться на чекпоинте',
  'crash.retry': 'Быстрый рестарт',
  'common.cancel': 'Отмена',
  'toast.saved': 'Прогресс сохранён',
  'toast.adFail': 'Реклама недоступна, попробуйте позже',
  'toast.wrongWay': 'Не туда! Развернись',
  'hint.desktop': 'A/D или стрелки — руль, W — газ, Пробел — ручник, E — клапан, Shift — турбо',
  'hint.touch': 'Левая/правая половина экрана — руль, кнопки справа — ручник и турбо',
  'touch.handbrake': 'Ручник',
}

const en: Dict = {
  'title': 'Ice Express: Liquid Balance',
  'menu.subtitle': 'Ride the wave. Catch the drift. Do not fall.',
  'menu.play': 'Drive',
  'menu.tracks': 'Passes',
  'menu.sound': 'Sound',
  'menu.leaderboard': 'Star ranking',
  'menu.loading': 'Warming up the diesel',
  'tracks.title': 'Passes',
  'tracks.back': 'Back',
  'tracks.start': 'Descend',
  'tracks.locked': 'Clear the previous pass first',
  'tracks.best': 'Best',
  'tracks.stars3': '3 stars: under {time} s with 75% cargo',
  'track.countdown': '{n}',
  'track.go': 'GO',
  'hud.volume': 'Milk',
  'hud.multiplier': 'Edge factor',
  'hud.drift': 'Drift',
  'hud.checkpoint': 'Checkpoint {n}/3',
  'hud.split.ahead': '+{s} s',
  'hud.split.behind': '−{s} s',
  'pause.title': 'Paused',
  'pause.resume': 'Resume',
  'pause.restart': 'Restart',
  'pause.menu': 'Main menu',
  'results.title': 'Weighing',
  'results.win': 'Cargo delivered',
  'results.lose': 'Cargo rejected',
  'results.time': 'Time',
  'results.score': 'Score',
  'results.next': 'Next pass',
  'results.retry': 'Retry',
  'results.double': 'Double reward',
  'results.doubled': 'Reward doubled',
  'crash.title': 'Run wrecked',
  'crash.fall': 'The tanker went off the cliff',
  'crash.rollover': 'The tank rolled over and vented',
  'crash.revive': 'Respawn at checkpoint',
  'crash.retry': 'Quick restart',
  'common.cancel': 'Cancel',
  'toast.saved': 'Progress saved',
  'toast.adFail': 'Ad unavailable, try later',
  'toast.wrongWay': 'Wrong way! Turn around',
  'hint.desktop': 'A/D or arrows to steer, W throttle, Space handbrake, E valve, Shift turbo',
  'hint.touch': 'Left/right half of screen steers, right buttons handbrake and turbo',
  'touch.handbrake': 'Handbrake',
}

const dicts: Record<Lang, Dict> = { ru, en }

let currentLang: Lang = 'ru'

export function setLanguage(lang: string): void {
  currentLang = lang.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

export function getLanguage(): Lang {
  return currentLang
}

export function t(key: string, vars?: Record<string, string | number>): string {
  let text = dicts[currentLang][key] ?? dicts.ru[key] ?? key
  if (vars) {
    for (const name of Object.keys(vars)) {
      text = text.replaceAll(`{${name}}`, String(vars[name]))
    }
  }
  return text
}
