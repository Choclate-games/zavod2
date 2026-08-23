export class UiRoot {
  private static instance: UiRoot
  private rootElement: HTMLElement
  private layersContainer: HTMLElement

  public static getInstance(): UiRoot {
    if (!UiRoot.instance) {
      UiRoot.instance = new UiRoot()
    }
    return UiRoot.instance
  }

  private constructor() {
    this.rootElement = document.getElementById('ui-root') || document.body
    this.layersContainer = document.createElement('div')
    this.layersContainer.className = 'ui-layer'
    this.rootElement.appendChild(this.layersContainer)

    this.measureViewport()
    window.addEventListener('resize', () => this.measureViewport())
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.measureViewport())
      window.visualViewport.addEventListener('scroll', () => this.measureViewport())
    }
  }

  public getLayersContainer(): HTMLElement {
    return this.layersContainer
  }

  public measureViewport(): void {
    const width = window.visualViewport ? window.visualViewport.width : window.innerWidth
    const height = window.visualViewport ? window.visualViewport.height : window.innerHeight

    document.documentElement.style.setProperty('--vp-w', `${Math.round(width)}px`)
    document.documentElement.style.setProperty('--vp-h', `${Math.round(height)}px`)
  }
}

export const uiRoot = UiRoot.getInstance()
