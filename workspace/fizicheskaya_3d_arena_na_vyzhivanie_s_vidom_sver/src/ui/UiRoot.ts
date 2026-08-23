import type { I18n } from './I18n'
import type { ScreenRouter } from './ScreenRouter'
import type { Hud } from './Hud'
import type { TouchControls } from './TouchControls'

/**
 * Слои над канвасом и измеренный вьюпорт. Геометрия интерфейса считается
 * от реальной высоты (--vp-h), никогда от 100vh; нижний резерв включает
 * высоту баннера площадки. Контейнеры прозрачны для ввода.
 */
export class UiRoot {
  readonly screensLayer: HTMLElement
  readonly controlsLayer: HTMLElement
  private settleRepeats = 0

  constructor(
    container: HTMLElement,
    private readonly i18n: I18n,
    private readonly router: ScreenRouter,
    readonly hud: Hud,
    private readonly touch: TouchControls | null,
  ) {
    this.screensLayer = document.createElement('div')
    this.screensLayer.className = 'ui-layer layer-screens'
    this.controlsLayer = document.createElement('div')
    this.controlsLayer.className = 'ui-layer layer-controls'
    container.append(this.controlsLayer, this.screensLayer)

    this.measureViewport()
    window.visualViewport?.addEventListener('resize', this.handleViewportChange)
    window.addEventListener('orientationchange', this.handleViewportChange)
    document.addEventListener('visibilitychange', this.handleViewportChange)
  }

  /** Измеренный вьюпорт публикуется в токен; после событий он оседает окном. */
  private measureViewport(): void {
    const vv = window.visualViewport
    const height = Math.round(vv?.height ?? window.innerHeight)
    document.documentElement.style.setProperty('--vp-h', `${height}px`)
  }

  private handleViewportChange = (): void => {
    this.measureViewport()
    this.touch?.layout()
    if (this.settleRepeats < 6) {
      this.settleRepeats++
      window.setTimeout(() => this.handleViewportChange(), 250)
    }
  }

  applyInputMode(mode: 'desktop' | 'touch'): void {
    if (mode === 'touch' && this.touch) {
      this.touch.mount(this.controlsLayer)
      this.hud.setHintVisible(false)
    } else {
      this.touch?.unmount()
      this.hud.setHintVisible(true)
    }
  }

  showScreen(name: string): void {
    this.router.show(name)
  }

  dispose(): void {
    window.visualViewport?.removeEventListener('resize', this.handleViewportChange)
    window.removeEventListener('orientationchange', this.handleViewportChange)
    document.removeEventListener('visibilitychange', this.handleViewportChange)
    void this.i18n
  }
}
