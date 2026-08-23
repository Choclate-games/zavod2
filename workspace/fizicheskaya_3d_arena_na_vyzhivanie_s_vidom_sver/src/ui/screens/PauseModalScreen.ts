import { createButton } from '../components/Widgets'
import type { I18n } from '../I18n'
import type { UiActions, UiState } from '../types'
import type { Screen } from '../ScreenRouter'

/**
 * Оверлей паузы: продолжить (главное действие), звук и выход в меню.
 */
export class PauseModalScreen implements Screen {
  readonly name = 'pause_settings'
  readonly root: HTMLElement
  private readonly soundButton = createButton('', { small: true })

  constructor(
    private readonly i18n: I18n,
    actions: UiActions,
    private readonly getState: () => UiState,
  ) {
    this.root = document.createElement('div')
    const backdrop = document.createElement('div')
    backdrop.className = 'modal-backdrop'

    const panel = document.createElement('div')
    panel.className = 'panel'
    panel.style.display = 'flex'
    panel.style.flexDirection = 'column'
    panel.style.alignItems = 'center'
    panel.style.gap = 'var(--space-3)'
    panel.style.padding = 'calc(var(--space-6) * var(--ui-scale))'

    const title = document.createElement('div')
    title.className = 'title'
    title.textContent = i18n.t('paused_title')

    const resumeButton = createButton(i18n.t('resume'), { primary: true })
    resumeButton.root.addEventListener('click', () => actions.resumeMatch())

    this.soundButton.root.addEventListener('click', () => {
      const muted = actions.toggleSound()
      this.refreshSoundLabel(muted)
    })

    const exitButton = createButton(i18n.t('exit_to_menu'), { small: true })
    exitButton.root.addEventListener('click', () => actions.backToMenu())

    panel.append(title, resumeButton.root, this.soundButton.root, exitButton.root)
    backdrop.appendChild(panel)
    this.root.appendChild(backdrop)
  }

  onShow(): void {
    this.refreshSoundLabel(this.getState().muted)
  }

  private refreshSoundLabel(muted: boolean): void {
    const span = this.soundButton.root.querySelector('span')
    if (span) span.textContent = muted ? this.i18n.t('sound_off') : this.i18n.t('sound_on')
  }
}
