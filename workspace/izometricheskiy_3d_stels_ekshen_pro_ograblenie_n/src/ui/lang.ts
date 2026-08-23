import { pg } from '../platform/playgama.js'

/**
 * Локализация: язык берётся с площадки (fallback — браузер), в разметке и коде
 * экранов только ключи. Словари обязаны иметь полный паритет ключей.
 */

export type Lang = 'ru' | 'en'

const RU: Record<string, string> = {
  'game.title': 'Тени Фестиваля',
  'game.subtitle': 'Клинок и Эшелон',
  'menu.start': 'Начать ограбление',
  'menu.workshop': 'Мастерская',
  'menu.sound': 'Звук',
  'menu.sound.on': 'Звук: вкл',
  'menu.sound.off': 'Звук: выкл',
  'menu.best': 'Лучшее время: {time}',
  'menu.gold': 'Золото: {gold}',
  'hud.alarm': 'Тревога',
  'hud.time': 'Трек шествия',
  'hud.disguised': 'В маскировке',
  'hud.exposed': 'Вы вне толпы',
  'hud.confetti': 'Хлопушки',
  'hud.totem': 'Тотем у вас',
  'hud.totem.hint': 'Украдите золотой тотем на главном эшелоне',
  'hud.objective.escape': 'Уходите в переулок!',
  'hud.pause': 'Пауза',
  'pause.title': 'Пауза',
  'pause.resume': 'Продолжить',
  'pause.quit': 'Сдаться и в меню',
  'result.win.title': 'Ограбление удалось',
  'result.lose.title': 'Вас раскрыли',
  'result.reason.alarm': 'Тревога заполнилась — гвардия перекрыла эшелоны',
  'result.reason.blades': 'Стража выбилась из сил: три удара алебард достигли цели',
  'result.reason.time': 'Шествие прошло мимо — окно ограбления закрыто',
  'result.gold': 'Добыто золота: {gold}',
  'result.time': 'Время забега: {time}',
  'result.retry': 'Ещё раз',
  'result.menu': 'В меню',
  'result.secondChance': 'Второй шанс за рекламу',
  'workshop.title': 'Мастерская вора',
  'workshop.back': 'Назад',
  'workshop.gold': 'Золото: {gold}',
  'ws.confetti.name': 'Запас хлопушек',
  'ws.confetti.desc': '+1 заряд хлопушек на забег',
  'ws.silent.name': 'Тихая поступь',
  'ws.silent.desc': 'Неритмичный удар шумит тише: радиус шума меньше',
  'ws.guard.name': 'Крепкий блок',
  'ws.guard.desc': 'Окно парирования шире на 20%',
  'workshop.buy': 'Купить — {cost}',
  'workshop.maxed': 'Изучено',
  'hint.desktop.move': 'WASD — движение, Space — шаг шествия',
  'hint.desktop.combat': 'ЛКМ — выпад, ПКМ — парирование, Shift — рывок, E/Q — хлопушка',
  'hint.touch.move': 'Джойстик слева — движение, зона «Шаг шествия» — маскировка',
  'loading.bridge': 'Связываемся с площадкой…',
  'loading.world': 'Готовим эшелоны…',
  'loading.menu': 'Открываем занавес…',
}

const EN: Record<string, string> = {
  'game.title': 'Festival Shadows',
  'game.subtitle': 'Blade and Echelon',
  'menu.start': 'Start the heist',
  'menu.workshop': 'Workshop',
  'menu.sound': 'Sound',
  'menu.sound.on': 'Sound: on',
  'menu.sound.off': 'Sound: off',
  'menu.best': 'Best time: {time}',
  'menu.gold': 'Gold: {gold}',
  'hud.alarm': 'Alarm',
  'hud.time': 'Procession track',
  'hud.disguised': 'Disguised',
  'hud.exposed': 'You are out of the crowd',
  'hud.confetti': 'Poppers',
  'hud.totem': 'Totem is yours',
  'hud.totem.hint': 'Steal the golden totem on the main echelon',
  'hud.objective.escape': 'Escape into the alley!',
  'hud.pause': 'Pause',
  'pause.title': 'Paused',
  'pause.resume': 'Resume',
  'pause.quit': 'Give up and exit',
  'result.win.title': 'Heist succeeded',
  'result.lose.title': 'You were exposed',
  'result.reason.alarm': 'The alarm filled up — the guard sealed the echelons',
  'result.reason.blades': 'Three halberd strikes found their mark',
  'result.reason.time': 'The procession passed by — the window closed',
  'result.gold': 'Gold earned: {gold}',
  'result.time': 'Run time: {time}',
  'result.retry': 'Try again',
  'result.menu': 'Main menu',
  'result.secondChance': "Thief's second chance for an ad",
  'workshop.title': `Thief's workshop`,
  'workshop.back': 'Back',
  'workshop.gold': 'Gold: {gold}',
  'ws.confetti.name': 'Popper stock',
  'ws.confetti.desc': '+1 popper charge per run',
  'ws.silent.name': 'Silent steps',
  'ws.silent.desc': 'Off-beat lunges make less noise',
  'ws.guard.name': 'Sturdy block',
  'ws.guard.desc': 'Parry window widened by 20%',
  'workshop.buy': 'Buy — {cost}',
  'workshop.maxed': 'Learned',
  'hint.desktop.move': 'WASD to move, Space to march with the crowd',
  'hint.desktop.combat': 'LMB lunge, RMB parry, Shift dash, E/Q confetti',
  'hint.touch.move': 'Left stick moves, hold the March zone to blend in',
  'loading.bridge': 'Connecting to the platform…',
  'loading.world': 'Raising the echelons…',
  'loading.menu': 'Raising the curtain…',
}

const DICTS: Record<Lang, Record<string, string>> = { ru: RU, en: EN }

let currentLang: Lang = pg.locale === 'en' ? 'en' : 'ru'

export function lang(): Lang {
  return currentLang
}

export function setLang(next: Lang): void {
  currentLang = next
  applyTranslations(document)
}

export function t(key: string, params?: Record<string, string>): string {
  const dict = DICTS[currentLang]
  let text = dict[key] ?? RU[key] ?? key
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(value)
    }
  }
  return text
}

/** Обновляет все узлы с data-lang — экраны не хранят строк сами. */
export function applyTranslations(root: ParentNode): void {
  const nodes = root.querySelectorAll('[data-lang]')
  nodes.forEach((node) => {
    const key = node.getAttribute('data-lang')
    if (key) node.textContent = t(key)
  })
}

export function formatTime(seconds: number): string {
  const mm = Math.floor(Math.max(0, seconds) / 60)
  const ss = Math.floor(Math.max(0, seconds) % 60)
  return `${mm}:${String(ss).padStart(2, '0')}`
}
