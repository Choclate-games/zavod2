import { el } from '../components/dom'
import { createScreen, SCREEN_IDS, type Screen } from '../ScreenRouter'

export class MainMenuScreen {
  readonly screen: Screen & { root: HTMLDivElement }

  constructor(onPlay: () => void) {
    const title = el('h1', 'screen__title', 'ОГНЕННЫЙ КАНЬОН')
    const subtitle = el('p', 'screen__subtitle', 'Водный сброс')
    const play = el('button', 'btn btn--primary')
    play.type = 'button'
    play.dataset.action = 'play'
    play.textContent = 'ВЫЛЕТ'
    play.addEventListener('click', onPlay)

    const hint = el(
      'p',
      'screen__hint',
      'Бреющим полётом черпайте воду из реки, набирайте высоту и гасите залпами все очаги пожара за 60 секунд',
    )

    this.screen = createScreen(SCREEN_IDS.mainMenu, title, subtitle, play, hint)
  }
}
