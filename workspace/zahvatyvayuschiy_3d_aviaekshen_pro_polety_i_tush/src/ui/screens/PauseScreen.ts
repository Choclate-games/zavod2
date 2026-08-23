import { el } from '../components/dom'
import { createScreen, SCREEN_IDS, type Screen } from '../ScreenRouter'

export class PauseScreen {
  readonly screen: Screen & { root: HTMLDivElement }

  constructor(onResume: () => void, onToMenu: () => void) {
    const title = el('h2', 'screen__title', 'ПАУЗА')

    const resume = el('button', 'btn btn--primary')
    resume.type = 'button'
    resume.dataset.action = 'resume'
    resume.textContent = 'ПРОДОЛЖИТЬ'
    resume.addEventListener('click', onResume)

    const toMenu = el('button', 'btn')
    toMenu.type = 'button'
    toMenu.dataset.action = 'to-menu'
    toMenu.textContent = 'В МЕНЮ'
    toMenu.addEventListener('click', onToMenu)

    this.screen = createScreen(SCREEN_IDS.pause, title, resume, toMenu)
  }
}
