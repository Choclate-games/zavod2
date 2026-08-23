import type { EventBus } from '../../core/EventBus'
import { el } from '../components/Button'
import { icon } from '../icons'
import type { I18n } from '../i18n'

export class SplashScreen {
  readonly root: HTMLElement
  private readonly fill: HTMLElement
  private readonly statusText: HTMLElement
  private readonly hintIcon: HTMLElement
  private lastValue = -1

  constructor(
    events: EventBus,
    i18n: I18n,
    layer: HTMLElement,
  ) {
    this.root = el('div', 'screen-splash')

    const header = el('div')
    header.style.cssText = 'margin:auto auto var(--space-5);text-align:center;display:flex;flex-direction:column;align-items:center;gap:var(--space-3)'
    const logoRow = el('div')
    logoRow.innerHTML = icon('wedge')
    const logoSvg = logoRow.querySelector('svg')
    if (logoSvg) {
      logoSvg.style.width = '56px'
      logoSvg.style.height = '56px'
      ;(logoSvg as unknown as HTMLElement).style.color = 'var(--color-accent)'
    }
    const title = el('h1', 'screen__title', i18n.t('title'))
    const subtitle = el('p', 'screen__subtitle', i18n.t('subtitle'))
    header.appendChild(logoRow)
    header.appendChild(title)
    header.appendChild(subtitle)

    const progressWrap = el('div')
    progressWrap.className = 'veil-block'
    progressWrap.style.cssText =
      'display:flex;flex-direction:column;align-items:center;gap:var(--space-3)'
    this.statusText = el('div', 'hud-label', i18n.t('loading'))
    const track = el('div', 'progress-track')
    this.fill = el('div', 'progress-fill')
    track.appendChild(this.fill)
    progressWrap.appendChild(this.statusText)
    progressWrap.appendChild(track)
    header.appendChild(progressWrap)

    this.hintIcon = el('span', 'hud-label')
    this.hintIcon.innerHTML = `${icon('camera')} <span style="vertical-align:middle">${i18n.t('hintCutDesktop')}</span>`
    this.hintIcon.style.maxWidth = 'min(480px, 86vw)'

    this.root.appendChild(header)
    this.root.appendChild(this.hintIcon)
    layer.appendChild(this.root)

    events.on('loading:progress', ({ value }) => {
      if (value === this.lastValue) return
      this.lastValue = value
      this.fill.style.transform = `scaleX(${value})`
    })
  }

  /** Подсказка управления соответствует активной схеме ввода. */
  setHint(i18n: I18n, key: string): void {
    const text = i18n.t(key)
    this.hintIcon.innerHTML = `${icon('camera')} <span style="vertical-align:middle"></span>`
    const holder = this.hintIcon.querySelector('span')
    if (holder) holder.textContent = text
  }
}
