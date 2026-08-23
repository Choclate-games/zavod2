import { el } from './components/dom'

/**
 * Слои интерфейса над канвасом: измеренный вьюпорт, safe-area и место под
 * полосу баннера. Значения уходят в CSS-переменные, которые читает theme.css.
 */
export class UiRoot {
  readonly screensContainer: HTMLElement
  readonly touchLayer: HTMLElement
  private readonly loader: HTMLDivElement
  private readonly loaderPercent: HTMLElement
  private lastPercent = -1

  constructor() {
    const screens = document.getElementById('screens')
    if (!screens) throw new Error('Контейнер #screens не найден')
    this.screensContainer = screens

    this.touchLayer = el('div')
    this.touchLayer.id = 'touch-layer'
    document.body.appendChild(this.touchLayer)

    this.loader = el('div', 'loader')
    this.loaderPercent = el('div', 'loader__percent', '0%')
    this.loader.appendChild(this.loaderPercent)
    document.body.appendChild(this.loader)

    window.addEventListener('resize', () => this.applyViewport())
    this.applyViewport()
    this.installGuards()
  }

  reportProgress(percent: number): void {
    const rounded = Math.max(0, Math.min(100, Math.round(percent)))
    if (rounded === this.lastPercent) return
    this.lastPercent = rounded
    this.loaderPercent.textContent = `${rounded}%`
    if (rounded >= 100) {
      // Даём заставке дойти до 100% и отработать переход.
      window.setTimeout(() => {
        this.loader.hidden = true
      }, 700)
    }
  }

  applyViewport(): void {
    const height = Math.round(
      (window.visualViewport ? window.visualViewport.height : window.innerHeight),
    )
    const rootStyle = document.documentElement.style
    rootStyle.setProperty('--viewport-height', `${height}px`)
    rootStyle.setProperty('--banner-height', '0px')
  }

  private installGuards(): void {
    const block = (event: Event) => event.preventDefault()
    document.addEventListener('contextmenu', block)
    document.addEventListener('dragstart', block)
    document.addEventListener('gesturestart', block)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.applyViewport()
    })
  }
}
