import { bus } from '../core/EventBus.ts'
import { BALANCE } from '../config/balance.ts'
import { createButton, createMeter } from './components.ts'

/**
 * HUD: пять якорей, запись только в закэшированные узлы и только при
 * изменении значения. Слой никогда не становится интерактивным.
 */
export class Hud {
  readonly root: HTMLDivElement
  private readonly damageNode: HTMLDivElement
  private readonly meter: { root: HTMLDivElement; set: (fraction: number) => void }
  private readonly starsNode: HTMLDivElement
  private lastDamage = -1
  private lastCombo = -1
  private badge: HTMLDivElement | null = null

  constructor(onPause: () => void, onRestart: () => void) {
    this.root = document.createElement('div')
    this.root.className = 'ui-layer hud-layer'

    // top_center: счётчик ущерба.
    this.damageNode = document.createElement('div')
    this.damageNode.className = 'damage-counter numeral'
    this.damageNode.textContent = '$0'
    this.root.appendChild(this.damageNode)

    // top_left: прогресс по порогам звёзд.
    const progress = document.createElement('div')
    progress.className = 'star-progress'
    const starsLabel = document.createElement('div')
    starsLabel.className = 'numeral'
    starsLabel.style.marginBottom = 'var(--space-1)'
    starsLabel.textContent = '0 из 3'
    this.starsNode = starsLabel
    this.meter = createMeter()
    progress.appendChild(starsLabel)
    progress.appendChild(this.meter.root)
    this.root.appendChild(progress)

    // top_right: настройки/пауза.
    const pauseButton = createButton('', {
      variant: 'icon',
      iconName: 'gear',
      onClick: onPause,
    })
    const topRight = document.createElement('div')
    topRight.className = 'top-right'
    topRight.appendChild(pauseButton)
    this.root.appendChild(topRight)

    // bottom_right: мгновенный рестарт.
    const retryButton = createButton('', {
      variant: 'retry',
      iconName: 'restart',
      onClick: onRestart,
    })
    retryButton.title = 'Мгновенный рестарт (R)'
    const bottomRight = document.createElement('div')
    bottomRight.className = 'bottom-right'
    bottomRight.appendChild(retryButton)
    this.root.appendChild(bottomRight)

    bus.on('hud:damageChanged', (payload: { total: number; combo: number } | undefined) => {
      if (!payload) return
      this.setDamage(payload.total, payload.combo)
    })
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? '' : 'none'
  }

  /** Полоса до следующей звезды + подпись. */
  setStars(stars: number): void {
    this.starsShown = stars
    const thresholds = [
      BALANCE.scoring.star1Threshold,
      BALANCE.scoring.star2Threshold,
      BALANCE.scoring.star3Threshold,
    ]
    const total = this.currentDamage()
    let fraction = 0
    if (stars >= 3) fraction = 1
    else {
      const lower = stars === 2 ? thresholds[1] : stars === 1 ? thresholds[0] : 0
      const upper = thresholds[stars]
      fraction = (total - lower) / Math.max(upper - lower, 1)
    }
    this.meter.set(fraction)
    this.starsNode.textContent = `${stars} из 3`
  }

  private currentDamage(): number {
    return this.lastDamage < 0 ? 0 : this.lastDamage
  }

  setDamage(total: number, combo: number): void {
    const changed = total !== this.lastDamage || combo !== this.lastCombo
    this.lastDamage = total
    this.lastCombo = combo
    if (changed) {
      this.damageNode.textContent =
        combo > 1 ? `$${formatMoney(total)} x${combo.toFixed(1)}` : `$${formatMoney(total)}`
      this.setStars(this.starsShown)
    }
  }

  private starsShown = 0

  showPopup(text: string): void {
    const popup = document.createElement('div')
    popup.className = 'popup-floater'
    popup.textContent = text
    this.root.appendChild(popup)
    window.setTimeout(() => popup.remove(), 950)
  }

  showBadge(text: string): void {
    if (!this.badge) {
      this.badge = document.createElement('div')
      this.badge.className = 'state-badge'
      this.root.appendChild(this.badge)
    }
    this.badge.textContent = text
    this.badge.style.display = ''
  }

  hideBadge(): void {
    if (this.badge) this.badge.style.display = 'none'
  }
}

export function formatMoney(value: number): string {
  return Math.round(value).toLocaleString('ru-RU')
}
