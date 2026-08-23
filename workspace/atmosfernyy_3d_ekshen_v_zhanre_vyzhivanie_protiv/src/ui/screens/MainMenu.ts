import { button, el } from '../components.js'
import type { DICTS } from '../i18n.js'

type Dict = (typeof DICTS)['ru']

/**
 * MainMenu: заглавие слева-сверху, главное действие — старт вахты,
 * второстепенный ряд одним весом. Меню лежит поверх живой сцены.
 */
export class MainMenu {
  readonly root: HTMLElement

  constructor(dict: Dict, opts: { leaderboard: boolean; soundMuted: boolean }, onAction: (action: string) => void) {
    this.root = el('div', 'menu-layout')

    const header = el('div')
    const title = el('h1', 'screen-title', dict.titleMain)
    const subtitle = el('p', 'screen-subtitle', dict.titleSub)
    const tagline = el('p', 'hint-line', dict.tagline)
    header.appendChild(title)
    header.appendChild(subtitle)
    header.appendChild(tagline)
    this.root.appendChild(header)

    const actions = el('div', 'menu-actions')
    const startBtn = button({ label: dict.start, primary: true })
    startBtn.addEventListener('click', () => onAction('start'))
    actions.appendChild(startBtn)

    if (opts.leaderboard) {
      const lbBtn = button({ icon: 'trophy', label: dict.leaderboard })
      lbBtn.addEventListener('click', () => onAction('leaderboard'))
      actions.appendChild(lbBtn)
    }
    this.root.appendChild(actions)
  }

  setBestLine(bestSec: number, bestScore: number, dict: Dict): void {
    let best = this.root.querySelector('[data-best]')
    if (!best) {
      best = el('div', 'hint-line panel')
      best.setAttribute('data-best', '')
      ;(this.root.querySelector('.menu-actions') as HTMLElement)?.before(best)
    }
    best.textContent = `${dict.bestLabel}: ${bestSec}${dict.seconds} / ${bestScore}`
  }
}
