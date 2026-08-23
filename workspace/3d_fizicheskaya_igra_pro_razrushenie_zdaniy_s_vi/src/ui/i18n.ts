type Dict = Record<string, string>

const RU: Dict = {
  title: 'Сейсмо-Домино',
  subtitle: 'Точечный Снос',
  loading: 'Инициализация моста площадки',
  play: 'Играть',
  sectors: 'Сектора',
  nextSector: 'Следующий сектор',
  retry: 'Повторить',
  toMenu: 'В меню',
  resume: 'Продолжить',
  restart: 'Рестарт',
  paused: 'Пауза',
  sector: 'Сектор',
  charges: 'Клинья',
  collapse: 'Зачистка',
  victory: 'Сектор снесён',
  defeatTitle: 'Каскад оборвался',
  reasonBreach: 'Обломки вышли за охранной периметр.',
  reasonLow: 'Разрушено слишком мало сектора.',
  extraWedge: 'Дополнительный клин за ролик',
  sound: 'Звук',
  delayLabel: 'Задержка',
  hintCutDesktop: 'ЛКМ по пилону — протянуть вектор среза, отпустить — пуск клина. ПКМ — камера, R — рестарт.',
  hintCutTouch: 'Свайп поперёк колонны — прицел и вектор среза. Два пальца — камера. Двойной тап — заряд задержки.',
}

const EN: Dict = {
  title: 'Seismo Domino',
  subtitle: 'Precision Demolition',
  loading: 'Initializing platform bridge',
  play: 'Play',
  sectors: 'Sectors',
  nextSector: 'Next sector',
  retry: 'Retry',
  toMenu: 'Menu',
  resume: 'Resume',
  restart: 'Restart',
  paused: 'Paused',
  sector: 'Sector',
  charges: 'Wedges',
  collapse: 'Collapse',
  victory: 'Sector demolished',
  defeatTitle: 'Chain collapsed early',
  reasonBreach: 'Debris left the protective perimeter.',
  reasonLow: 'Too little of the sector was demolished.',
  extraWedge: 'Extra wedge for an ad',
  sound: 'Sound',
  delayLabel: 'Delay',
  hintCutDesktop: 'LMB on a pillar: drag the cut vector, release to fire. RMB orbits, R restarts.',
  hintCutTouch: 'Swipe across a column to aim and cut. Two fingers orbit. Double tap plants a timed charge.',
}

const DICTS: Record<string, Dict> = { ru: RU, en: EN }

export class I18n {
  private lang = 'ru'

  setLanguage(lang: string): void {
    this.lang = DICTS[lang] ? lang : 'en'
  }

  t(key: string): string {
    return DICTS[this.lang]?.[key] ?? DICTS['en']?.[key] ?? key
  }
}
