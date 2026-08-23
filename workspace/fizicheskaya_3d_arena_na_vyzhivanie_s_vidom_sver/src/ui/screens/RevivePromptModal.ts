import { createButton } from '../components/Widgets'
import type { I18n } from '../I18n'
import type { UiActions, UiState } from '../types'
import type { Screen } from '../ScreenRouter'

/**
 * Окно Ледового Спасения: возврат на лёд за rewarded-ролик.
 * Кнопка рекламы рисуется только если площадка её поддерживает.
 */
export class RevivePromptModal implements Screen {
  readonly name = 'revive_prompt'
  readonly root: HTMLElement
  private readonly acceptButton = createButton('', { primary: true })

  constructor(
    private readonly i18n: I18n,
    private readonly actions: UiActions,
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
    title.textContent = i18n.t('revive_title')
    const description = document.createElement('div')
    description.textContent = i18n.t('revive_desc')

    const declineButton = createButton(i18n.t('revive_decline'), { small: true })
    declineButton.root.addEventListener('click', () => this.actions.declineRevive())

    this.acceptButton.root.classList.add('primary')
    this.acceptButton.root.querySelector('span')!.textContent = i18n.t('revive_accept')
    this.acceptButton.root.addEventListener('click', () => {
      this.acceptButton.setLoading(true)
      this.actions.acceptRevive()
      window.setTimeout(() => this.acceptButton.setLoading(false), 800)
    })

    panel.append(title, description)
    // Возможность, которой нет на площадке, не рисуется вовсе.
    if (this.getState().rewardedSupported) {
      panel.appendChild(this.acceptButton.root)
    }
    panel.appendChild(declineButton.root)
    backdrop.appendChild(panel)
    this.root.appendChild(backdrop)
  }

  onShow(): void {
    void this.i18n
  }
}
