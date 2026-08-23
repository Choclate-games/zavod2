/** Локализация: язык берётся с площадки (или из браузера как запасной вариант).
 * Экраны знают только ключи; строки живут здесь и покрыты во всех локалях. */

export type Locale = 'ru' | 'en'

const DICT: Record<Locale, Record<string, string>> = {
  ru: {
    'app.title': 'Лавинный снайпер: Эхо Каньона',
    'menu.subtitle': 'Перевал {n} из 15',
    'menu.play': 'Вперёд',
    'menu.resume': 'Продолжить дозор',
    'menu.sound.on': 'Звук включён',
    'menu.sound.off': 'Звук выключен',
    'menu.hint.desktop': 'Мышь — наведение · Shift/ПКМ — дыхание · A/D — шаг · ЛКМ — выстрел',
    'menu.hint.touch': 'Правая половина — наведение · кнопка огня справа · слайдер слева — шаг',
    'menu.unlocked': 'Открыто перевалов: {n}',
    'menu.best': 'Лучший счёт: {n}',
    'brief.title': 'Перевал {n}: сводка',
    'brief.distance': 'Дистанция до ядра: {n} м',
    'brief.wind': 'Ветер: до {n} м/с',
    'brief.ammo': 'Патронов: {n}',
    'brief.time': 'Лимит времени: {n} с',
    'brief.mass': 'Порог погребения: {n}% массы ледника',
    'brief.start': 'Принять контракт',
    'brief.back': 'Назад',
    'brief.scan': 'Метео-сканирование ущелья',
    'hud.wind': 'Ветер',
    'hud.distance': 'До заставы',
    'hud.breath': 'Дыхание',
    'hud.ammo': 'Патроны',
    'hud.zoom': 'Оптика',
    'hud.rangefinder': 'Шкала',
    'hud.drop': 'Провис',
    'hud.drift': 'Снос',
    'hud.mass': 'Обвал',
    'hud.time': 'Время',
    'hud.pause': 'Меню',
    'bulletcam.tag': 'Рапид ×0.25',
    'win.title': 'Контракт выполнен',
    'win.mass': 'Масса лавины: {n}%',
    'win.time': 'Осталось времени: {n} с',
    'win.ammo': 'Неизрасходованных патронов: {n}',
    'win.score': 'Счёт: {n}',
    'win.double': 'Удвоить знаки дозорного',
    'win.doubled': 'Знаки удвоены',
    'win.next': 'Следующий перевал',
    'lose.timeout': 'Время контракта истекло',
    'lose.crossed': 'Титан пересёк рубеж заставы',
    'lose.outofammo': 'Боекомплект исчерпан без критического обвала',
    'lose.title': 'Контракт сорван',
    'lose.retry': 'Повторить',
    'lose.golden': 'Золотой Калибр: +1 патрон',
    'ui.menu': 'В меню',
    'ui.loading': 'Подготовка перевала',
    'ui.error.save': 'Сохранение недоступно, прогресс этой сессии не запишется',
    'ui.error.ad': 'Реклама сейчас недоступна',
    'ui.leaderboard.sent': 'Счёт отправлен в таблицу',
    'ui.leaderboard.fail': 'Таблица мастерства недоступна',
    'ui.continue': 'Сыграть ещё патрон',
    'touch.lungs': 'Задержать дыхание',
    'touch.crosshair': 'Спуск курка',
    'touch.echo': 'Ложное эхо',
    'touch.scope': 'Кратность оптики',
    'touch.ruler': 'Дальномерная шкала',
  },
  en: {
    'app.title': 'Avalanche Sniper: Echo Canyon',
    'menu.subtitle': 'Pass {n} of 15',
    'menu.play': 'Deploy',
    'menu.resume': 'Resume watch',
    'menu.sound.on': 'Sound on',
    'menu.sound.off': 'Sound off',
    'menu.hint.desktop': 'Mouse — aim · Shift/RMB — breath · A/D — step · LMB — fire',
    'menu.hint.touch': 'Right half — aim · fire button right · left slider — step',
    'menu.unlocked': 'Passes unlocked: {n}',
    'menu.best': 'Best score: {n}',
    'brief.title': 'Pass {n}: briefing',
    'brief.distance': 'Range to core: {n} m',
    'brief.wind': 'Wind: up to {n} m/s',
    'brief.ammo': 'Rounds: {n}',
    'brief.time': 'Time limit: {n} s',
    'brief.mass': 'Burial threshold: {n}% of glacier mass',
    'brief.start': 'Accept contract',
    'brief.back': 'Back',
    'brief.scan': 'Weather drone scan',
    'hud.wind': 'Wind',
    'hud.distance': 'To outpost',
    'hud.breath': 'Breath',
    'hud.ammo': 'Rounds',
    'hud.zoom': 'Scope',
    'hud.rangefinder': 'Scale',
    'hud.drop': 'Drop',
    'hud.drift': 'Drift',
    'hud.mass': 'Avalanche',
    'hud.time': 'Time',
    'hud.pause': 'Menu',
    'bulletcam.tag': 'Slow-mo ×0.25',
    'win.title': 'Contract complete',
    'win.mass': 'Avalanche mass: {n}%',
    'win.time': 'Time remaining: {n} s',
    'win.ammo': 'Unspent rounds: {n}',
    'win.score': 'Score: {n}',
    'win.double': 'Double mastery marks',
    'win.doubled': 'Marks doubled',
    'win.next': 'Next pass',
    'lose.timeout': 'Contract time expired',
    'lose.crossed': 'Titan crossed the outpost line',
    'lose.outofammo': 'Ammo exhausted without critical collapse',
    'lose.title': 'Contract failed',
    'lose.retry': 'Retry',
    'lose.golden': 'Golden Caliber: +1 round',
    'ui.menu': 'Main menu',
    'ui.loading': 'Preparing the pass',
    'ui.error.save': 'Storage unavailable, this session will not be saved',
    'ui.error.ad': 'Ads are unavailable right now',
    'ui.leaderboard.sent': 'Score submitted to the leaderboard',
    'ui.leaderboard.fail': 'Mastery leaderboard unavailable',
    'ui.continue': 'Fire one more round',
    'touch.lungs': 'Hold breath',
    'touch.crosshair': 'Trigger',
    'touch.echo': 'False echo',
    'touch.scope': 'Scope zoom',
    'touch.ruler': 'Rangefinder scale',
  },
}

let current: Locale = 'ru'
let numberLocale = 'ru-RU'

export function initI18n(platformLanguage: string | undefined): void {
  const raw = (platformLanguage || navigator.language || 'ru').toLowerCase()
  current = raw.startsWith('ru') ? 'ru' : 'en'
  numberLocale = current === 'ru' ? 'ru-RU' : 'en-US'
}

export function t(key: string, vars?: Record<string, string | number>): string {
  let text = DICT[current][key] ?? DICT.ru[key] ?? key
  if (vars) {
    for (const name of Object.keys(vars)) {
      text = text.replace(`{${name}}`, String(vars[name]))
    }
  }
  return text
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(numberLocale).format(value)
}
