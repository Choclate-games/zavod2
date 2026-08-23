import { createButton, el } from '../components/Button'
import { numSlot } from '../components/Meter'
import { Stars } from '../components/Stars'
import type { I18n } from '../i18n'

export class VictoryModal {
  readonly root: HTMLElement
  private readonly stars = new Stars()
  private readonly scoreSlot = numSlot('0')

  constructor(
    i18n: I18n,
    layer: HTMLElement,
    onNext: () => void,
    onRetry: () => void,
    onMenu: () => void,
  ) {
    this.root = el('div')
    this.root.appendChild(el('h2', 'screen__title', i18n.t('victory')))

    const scoreRow = el('div')
    scoreRow.style.cssText = 'display:flex;align-items:center;gap:var(--space-3);justify-content:center'
    scoreRow.appendChild(el('span', 'hud-label', `${i18n.t('collapse')} 100%`))
    scoreRow.appendChild(this.scoreSlot)
    this.root.appendChild(this.stars.root)
    this.root.appendChild(scoreRow)

    const actions = el('div', 'modal-card__actions')
    actions.appendChild(
      createButton({ label: i18n.t('nextSector'), iconName: 'play', variant: 'primary', onClick: onNext }),
    )
    actions.appendChild(createButton({ label: i18n.t('retry'), iconName: 'restart', onClick: onRetry }))
    actions.appendChild(createButton({ label: i18n.t('toMenu'), variant: 'ghost', onClick: onMenu }))
    this.root.appendChild(actions)
    layer.appendChild(this.root)
  }

  showResult(starsCount: number, score: number): void {
    this.stars.setStatic(starsCount)
    this.scoreSlot.textContent = String(score)
  }
}
