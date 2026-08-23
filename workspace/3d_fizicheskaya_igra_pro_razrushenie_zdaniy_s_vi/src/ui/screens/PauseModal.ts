import { createButton, el } from '../components/Button'
import type { I18n } from '../i18n'

export class PauseModal {
  readonly root: HTMLElement

  constructor(
    i18n: I18n,
    layer: HTMLElement,
    onResume: () => void,
    onRestart: () => void,
    onMenu: () => void,
  ) {
    this.root = el('div')
    this.root.appendChild(el('h2', 'screen__title', i18n.t('paused')))

    const actions = el('div', 'modal-card__actions')
    actions.appendChild(
      createButton({ label: i18n.t('resume'), iconName: 'play', variant: 'primary', onClick: onResume }),
    )
    actions.appendChild(createButton({ label: i18n.t('restart'), iconName: 'restart', onClick: onRestart }))
    actions.appendChild(createButton({ label: i18n.t('toMenu'), variant: 'ghost', onClick: onMenu }))
    this.root.appendChild(actions)
    layer.appendChild(this.root)
  }
}
