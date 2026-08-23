const RU = {
  title: 'БИО-КОЛИЗЕЙ', subtitle: 'УДАРНЫЙ СИНТЕЗ', menuHint: 'Швыряй одинаковые комья навстречу и рождай волну.', fight: 'В БОЙ', soundOn: 'ЗВУК ВКЛ', soundOff: 'ЗВУК ВЫКЛ', help: 'Свайп по комку: прицельный бросок', best: 'ЛУЧШИЙ СЧЁТ', wave: 'ВОЛНА', score: 'СЧЁТ', combo: 'КОМБО', tier: 'ТИР', pause: 'ПАУЗА', jaws: 'ЧЕЛЮСТИ', danger: 'КРАЙ ТРЕЩИТ', clear: 'ВОЛНА ЗАЧИЩЕНА', next: 'СЛЕДУЮЩАЯ ВОЛНА', defeat: 'ПАДЕНИЕ В МАГМУ', retry: 'РЕВАНШ', menu: 'В МЕНЮ', victory: 'ТРИУМФ КОЛИЗЕЯ', continue: 'ЕЩЁ РАУНД', reward: 'СПАСТИ ТИТАНА', leaderboard: 'ТАБЛИЦА РЕКОРДОВ', ringouts: 'РИНГ-АУТЫ', loading: 'СИНТЕЗИРУЕМ АРЕНУ' }
export type LocaleKey = keyof typeof RU
export const t = (key: LocaleKey): string => RU[key]
