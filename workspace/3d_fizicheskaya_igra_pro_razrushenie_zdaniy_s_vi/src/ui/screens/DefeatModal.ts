import type { EventBus } from '../../core/EventBus'
import { createButton, el } from '../components/Button'
import type { I18n } from '../i18n'

export class DefeatModal {
  readonly root: HTMLElement
  private extraWedgeButton: HTMLButtonElement | null = null

  constructor(
    events: EventBus,
    i18n: I18n,
    layer: HTMLElement,
    onRetry: () => void,
    onMenu: () => void,
    onExtraWedge: () => Promise<boolean>,
    rewardedSupported: () => boolean,
  ) {
    this.root = el('div')
    this.root.appendChild(el('h2', 'screen__title', i18n.t('defeatTitle')))
    const reason = el('p', 'screen__subtitle')
    reason.id = 'defeat-reason'
    this.root.appendChild(reason)

    const actions = el('div', 'modal-card__actions')
    actions.appendChild(
      createButton({ label: i18n.t('retry'), iconName: 'restart', variant: 'primary', onClick: onRetry }),
    )
    actions.appendChild(createButton({ label: i18n.t('toMenu'), variant: 'ghost', onClick: onMenu }))

    // Кнопка rewarded рисуется только там, где площадка поддерживает ролики,
    // и только пока попытка не потрачена: серой заглушки не бывает.
    if (rewardedSupported()) {
      this.extraWedgeButton = createButton({
        label: i18n.t('extraWedge'),
        iconName: 'wedge',
        variant: 'danger',
        onClick: () => {
          void onExtraWedge().then((granted) => {
            if (this.extraWedgeButton && granted) this.extraWedgeButton.remove()
          })
        },
      })
      actions.appendChild(this.extraWedgeButton)
    }
    this.root.appendChild(actions)
    layer.appendChild(this.root)

    events.on('level:result', ({ win, breach }) => {
      if (win) return
      this.breachAtDefeat = breach
    })
    events.on('screen:show', ({ name }) => {
      if (name !== 'defeat') return
      reason.textContent = i18n.t(this.breachAtDefeat ? 'reasonBreach' : 'reasonLow')
    })
  }

  private breachAtDefeat = false
}
