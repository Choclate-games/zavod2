import { ScreenRouter } from './ScreenRouter'

export class UiRoot {
  public hudLayer: HTMLElement
  public touchLayer: HTMLElement
  public screensLayer: HTMLElement
  public modalsLayer: HTMLElement
  public toastsLayer: HTMLElement
  public router: ScreenRouter

  constructor(appContainer: HTMLElement) {
    this.router = new ScreenRouter()

    // 1. Create DOM Layer Stack
    this.hudLayer = this.createLayer('hud-layer')
    this.touchLayer = this.createLayer('touch-layer')
    this.screensLayer = this.createLayer('screens-layer')
    this.modalsLayer = this.createLayer('modals-layer')
    this.toastsLayer = this.createLayer('toasts-layer')

    appContainer.appendChild(this.hudLayer)
    appContainer.appendChild(this.touchLayer)
    appContainer.appendChild(this.screensLayer)
    appContainer.appendChild(this.modalsLayer)
    appContainer.appendChild(this.toastsLayer)

    // 2. Measure Viewport and update CSS variables
    this.updateMeasuredViewport()
    window.addEventListener('resize', () => this.updateMeasuredViewport())
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.updateMeasuredViewport())
      window.visualViewport.addEventListener('scroll', () => this.updateMeasuredViewport())
    }
  }

  private createLayer(id: string): HTMLElement {
    const layer = document.createElement('div')
    layer.id = id
    layer.className = 'layer'
    return layer
  }

  public updateMeasuredViewport(): void {
    const h = window.visualViewport ? window.visualViewport.height : window.innerHeight
    document.documentElement.style.setProperty('--vp-h', `${h}px`)
    document.documentElement.style.setProperty('--banner-height', '0px')
  }
}
