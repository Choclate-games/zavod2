import { button, el } from '../components.js'
import type { DICTS } from '../i18n.js'

type Dict = (typeof DICTS)['ru']

/** PauseModal: панель по центру, главное действие — продолжить вахту. */
export class PauseModal {
  readonly root: HTMLElement

  constructor(dict: Dict, onAction: (action: string) => void) {
    this.root = el('div', 'modal-center')

    const panel = el('div', 'panel')
    const title = el('h2', 'screen-title', dict.pauseTitle)
    title.style.fontSize = 'calc(30px * var(--ui-scale))'
    panel.appendChild(title)

    const actions = el('div', 'btn-row')
    const resumeBtn = button({ label: dict.resume, primary: true })
    resumeBtn.addEventListener('click', () => onAction('resume'))
    actions.appendChild(resumeBtn)

    const menuBtn = button({ label: dict.menu })
    menuBtn.addEventListener('click', () => onAction('menu'))
    actions.appendChild(menuBtn)
    panel.appendChild(actions)

    this.root.appendChild(panel)
  }
}
