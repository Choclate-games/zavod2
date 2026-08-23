import { EventBus } from '../core/EventBus'
import { icon } from './icons'
import { t } from './locales'

export class TouchControls {
  readonly root: HTMLDivElement
  private readonly held = new Set<number>()

  constructor(private readonly bus: EventBus, parent: HTMLElement) {
    this.root = document.createElement('div')
    this.root.className = 'touch-controls'
    this.root.hidden = true
    const button = document.createElement('button')
    button.className = 'touch-controls__button'
    button.type = 'button'
    button.setAttribute('aria-label', t('jaws'))
    button.innerHTML = `${icon('jaw')}<span>${t('jaws')}</span>`
    const hint = document.createElement('div')
    hint.className = 'touch-controls__hint'
    hint.textContent = t('help')
    this.root.append(button, hint)
    parent.appendChild(this.root)
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      this.held.add(event.pointerId)
      button.setPointerCapture(event.pointerId)
      this.bus.emit('input:chomp', undefined)
    })
    const release = (event: PointerEvent): void => { this.held.delete(event.pointerId) }
    button.addEventListener('pointerup', release)
    button.addEventListener('pointercancel', release)
    document.addEventListener('contextmenu', (event) => event.preventDefault(), { passive: false })
    document.addEventListener('dragstart', (event) => event.preventDefault(), { passive: false })
    document.addEventListener('touchmove', (event) => { if (this.held.size > 1) event.preventDefault() }, { passive: false })
    window.addEventListener('blur', () => this.held.clear())
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.held.clear() })
  }

  show(visible: boolean): void {
    this.root.hidden = !visible
    if (!visible) this.held.clear()
  }
}
