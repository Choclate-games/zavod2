import type { EventBus } from '../../core/EventBus'
import { createButton, el } from '../components/Button'
import { Meter, numSlot } from '../components/Meter'
import type { I18n } from '../i18n'

/**
 * HUD: пять якорей, запись только в закэшированные узлы и только при изменении
 * значения. Слой никогда не становится интерактивным — пауза и рестарт живут
 * кнопками, а не слоем.
 */
export class GameplayHUD {
  readonly root: HTMLElement
  private readonly sectorLabel: HTMLElement
  private readonly chargePips: HTMLElement[] = []
  private readonly meter = new Meter()
  private readonly percentSlot: HTMLElement
  private loadedCharges = 0

  constructor(
    events: EventBus,
    i18n: I18n,
    layer: HTMLElement,
    onRestart: () => void,
    onPause: () => void,
    onViewToggle: () => void,
  ) {
    this.root = el('div')

    // TopLeft: номер сектора + заряды клиньев.
    const topLeft = el('div', 'hud-corner hud-corner--tl')
    const tlPanel = el('div', 'panel')
    tlPanel.style.cssText = 'display:flex;flex-direction:column;gap:var(--space-2)'
    this.sectorLabel = el('div', 'hud-label telemetry', `${i18n.t('sector')} S-01`)
    const chargesRow = el('div')
    chargesRow.style.cssText = 'display:flex;align-items:center;gap:var(--space-2)'
    chargesRow.appendChild(el('span', 'hud-label', i18n.t('charges')))
    const pips = el('div', 'charges')
    for (let i = 0; i < 2; i++) {
      const pip = el('span', 'charge-pip')
      pips.appendChild(pip)
      this.chargePips.push(pip)
    }
    chargesRow.appendChild(pips)
    tlPanel.appendChild(this.sectorLabel)
    tlPanel.appendChild(chargesRow)
    topLeft.appendChild(tlPanel)

    // TopRight: шкала зачистки + пауза.
    const topRight = el('div', 'hud-corner hud-corner--tr')
    const trPanel = el('div', 'panel')
    trPanel.style.cssText =
      'display:flex;flex-direction:column;gap:var(--space-2);align-items:flex-end'
    const percentRow = el('div')
    percentRow.style.cssText = 'display:flex;align-items:center;gap:var(--space-2)'
    percentRow.appendChild(el('span', 'hud-label', i18n.t('collapse')))
    this.percentSlot = numSlot('0%')
    percentRow.appendChild(this.percentSlot)
    trPanel.appendChild(percentRow)
    trPanel.appendChild(this.meter.root)
    topRight.appendChild(trPanel)
    topRight.appendChild(
      createButton({ iconName: 'pause', variant: 'icon', onClick: onPause }),
    )

    // BottomRight: рестарт и переключение ракурса.
    const bottomRight = el('div', 'hud-corner hud-corner--br')
    bottomRight.appendChild(
      createButton({ label: i18n.t('restart'), iconName: 'restart', onClick: onRestart }),
    )
    bottomRight.appendChild(
      createButton({ iconName: 'camera', variant: 'icon', onClick: onViewToggle }),
    )

    this.root.appendChild(topLeft)
    this.root.appendChild(topRight)
    this.root.appendChild(bottomRight)
    layer.appendChild(this.root)

    events.on('level:start', ({ index }) => {
      this.sectorLabel.textContent = `${i18n.t('sector')} S-${String(index + 1).padStart(2, '0')}`
    })
    events.on('charges:changed', ({ left, total }) => {
      this.setChargeTotal(total)
      if (left === this.loadedCharges) return
      this.loadedCharges = left
      for (let i = 0; i < this.chargePips.length; i++) {
        this.chargePips[i]?.classList.toggle('charge-pip--loaded', i < left)
      }
    })
    let lastPercent = -1
    events.on('progress:collapse', ({ ratio }) => {
      this.meter.set(ratio)
      const percent = Math.floor(ratio * 100)
      if (percent !== lastPercent) {
        lastPercent = percent
        this.percentSlot.textContent = `${percent}%`
      }
    })
  }

  setChargeTotal(total: number): void {
    for (let i = 0; i < this.chargePips.length; i++) {
      const pip = this.chargePips[i]!
      pip.style.display = i < total ? '' : 'none'
      pip.classList.toggle('charge-pip--loaded', i < total)
    }
    this.loadedCharges = total
  }
}
