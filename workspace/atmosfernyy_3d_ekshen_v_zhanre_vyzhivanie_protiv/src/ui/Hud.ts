import type { EventBus } from '../core/EventBus.js'
import { button, CircularGauge, el, Meter } from './components.js'
import { formatClock, type DICTS } from './i18n.js'
import { iconSvg } from './icons.js'

type Dict = (typeof DICTS)['ru']

/**
 * GameplayHUD: пять якорей, запись только в закэшированные узлы и только при
 * изменении значения. HUD никогда не кликается, кроме кнопок паузы и звука.
 */
export class Hud {
  readonly root: HTMLElement

  private readonly hpMeter = new Meter('hp-bar')
  private readonly hpValue: HTMLElement
  private readonly clockText: HTMLElement
  private readonly scoreValue: HTMLElement
  private readonly comboTag: HTMLElement
  private readonly gauge = new CircularGauge()
  private readonly hint: HTMLElement
  private readonly comboPopup: HTMLElement
  private readonly banner: HTMLElement
  private readonly flash: HTMLElement
  private readonly pauseBtn: HTMLButtonElement
  private readonly soundBtn: HTMLButtonElement

  private lastClock = ''
  private lastScore = -1
  private lastCombo = -1
  private lastHpRatio = -1
  private lastTemp = -1
  private lastLocked = false
  private bannerTimer = 0
  private popupTimer = 0

  constructor(
    private readonly events: EventBus,
    dict: Dict,
    soundOn: boolean,
    onAction: (action: string) => void,
  ) {
    this.root = el('div', 'layer')
    this.root.id = 'hud'

    // topLeft: прочность маяка.
    const topLeft = el('div', 'hud-anchor top-left')
    topLeft.appendChild(this.hpMeter.root)
    this.hpValue = el('span', 'hud-chip', '100%')
    topLeft.appendChild(this.hpValue)

    // topCenter: часы вахты.
    const topCenter = el('div', 'hud-anchor top-center')
    this.clockText = el('div', 'hud-chip clock-digital', '00:00')
    topCenter.appendChild(this.clockText)
    this.banner = el('div', 'phase-banner')
    topCenter.appendChild(this.banner)

    // topRight: счёт и комбо.
    const topRight = el('div', 'hud-anchor top-right')
    this.scoreValue = el('div', 'hud-chip score-value', '0')
    topRight.appendChild(this.scoreValue)
    this.comboTag = el('div', 'hud-chip combo-tag', 'x0')
    topRight.appendChild(this.comboTag)

    // bottomLeft: пауза и звук.
    const bottomLeft = el('div', 'hud-anchor bottom-left')
    this.pauseBtn = button({ icon: 'pause', ariaLabel: 'Pause' })
    this.pauseBtn.addEventListener('click', () => onAction('pause'))
    bottomLeft.appendChild(this.pauseBtn)
    this.soundBtn = button({ icon: soundOn ? 'soundOn' : 'soundOff', ariaLabel: 'Sound' })
    this.soundBtn.addEventListener('click', () => onAction('sound'))
    bottomLeft.appendChild(this.soundBtn)
    this.hint = el('div', 'hint-line panel', dict.hintDesktop)
    bottomLeft.appendChild(this.hint)

    // bottomRight: термометр линзы.
    const bottomRight = el('div', 'hud-anchor bottom-right')
    bottomRight.appendChild(this.gauge.root)

    this.comboPopup = el('div', 'combo-popup')
    this.flash = el('div', 'flash-layer')

    this.root.appendChild(topLeft)
    this.root.appendChild(topCenter)
    this.root.appendChild(topRight)
    this.root.appendChild(bottomLeft)
    this.root.appendChild(bottomRight)
    this.root.appendChild(this.comboPopup)
    this.root.appendChild(this.flash)

    this.events.on('hud:hp', ({ ratio }) => {
      if (ratio === this.lastHpRatio) return
      this.lastHpRatio = ratio
      this.hpMeter.set(ratio)
      this.hpMeter.toggleDanger(ratio < 0.35)
      this.hpValue.textContent = `${Math.round(ratio * 100)}%`
    })
    this.events.on('hud:clock', ({ minutes }) => {
      const text = formatClock(minutes)
      if (text === this.lastClock) return
      this.lastClock = text
      this.clockText.textContent = text
    })
    this.events.on('hud:score', ({ score, combo }) => {
      if (score !== this.lastScore) {
        this.lastScore = score
        this.scoreValue.textContent = String(score)
      }
      if (combo !== this.lastCombo) {
        this.lastCombo = combo
        this.comboTag.textContent = `x${combo}`
      }
    })
    this.events.on('hud:heat', ({ temp, locked }) => {
      const quantized = Math.round(temp * 200) / 200
      if (quantized !== this.lastTemp || locked !== this.lastLocked) {
        this.lastTemp = quantized
        this.lastLocked = locked
        this.gauge.set(temp, locked)
      }
    })
    this.events.on('world:phase', ({ title }) => this.showBanner(title))
    this.events.on('world:combo', ({ count }) => this.showCombo(count))
    this.events.on('state:changed', ({ state }) => {
      if (state === 'VICTORY') this.flashOnce('dawn')
    })
    this.events.on('input:scheme', ({ scheme }) => {
      this.hint.textContent = scheme === 'touch' ? dict.hintTouch : dict.hintDesktop
    })
  }

  showBanner(title: string): void {
    this.banner.textContent = title
    this.banner.classList.add('is-visible')
    window.clearTimeout(this.bannerTimer)
    this.bannerTimer = window.setTimeout(() => this.banner.classList.remove('is-visible'), 2200)
  }

  private showCombo(count: number): void {
    this.comboPopup.textContent = `COMBO x${count}`
    this.comboPopup.classList.remove('is-visible')
    void this.comboPopup.offsetWidth
    this.comboPopup.classList.add('is-visible')
    window.clearTimeout(this.popupTimer)
    this.popupTimer = window.setTimeout(() => this.comboPopup.classList.remove('is-visible'), 700)
    this.flashOnce()
  }

  /** Вспышки состояния: перегрев — рубиновая, рассвет — тёплое золото. */
  flashOnce(color: 'heat' | 'dawn' = 'heat'): void {
    this.flash.classList.toggle('is-dawn', color === 'dawn')
    this.flash.classList.add('is-flashing')
    window.setTimeout(() => this.flash.classList.remove('is-flashing'), 120)
  }

  setMuted(muted: boolean): void {
    const span = this.soundBtn.querySelector('.icon')
    if (span) span.innerHTML = iconSvg(muted ? 'soundOff' : 'soundOn')
  }

  reset(): void {
    this.lastClock = ''
    this.lastScore = -1
    this.lastCombo = -1
    this.lastHpRatio = -1
    this.lastTemp = -1
    this.clockText.textContent = '00:00'
    this.scoreValue.textContent = '0'
    this.comboTag.textContent = 'x0'
    this.hpValue.textContent = '100%'
    this.hpMeter.set(1)
    this.hpMeter.toggleDanger(false)
    this.gauge.set(0, false)
  }
}
