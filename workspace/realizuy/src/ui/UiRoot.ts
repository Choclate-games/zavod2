import { ScreenRouter } from './ScreenRouter'

export class UiRoot {
  private static instance: UiRoot
  public hudLayer!: HTMLElement
  public touchLayer!: HTMLElement
  public screensLayer!: HTMLElement
  public modalsLayer!: HTMLElement
  public toastsLayer!: HTMLElement
  public router!: ScreenRouter

  public static getInstance(): UiRoot {
    if (!UiRoot.instance) {
      UiRoot.instance = new UiRoot()
    }
    return UiRoot.instance
  }

  public init(): void {
    this.hudLayer = document.getElementById('hud') as HTMLElement
    this.touchLayer = document.getElementById('touch') as HTMLElement
    this.screensLayer = document.getElementById('screens') as HTMLElement
    this.modalsLayer = document.getElementById('modals') as HTMLElement
    this.toastsLayer = document.getElementById('toasts') as HTMLElement

    this.installViewportGuards()
    this.router = new ScreenRouter(this.screensLayer)
  }

  private installViewportGuards(): void {
    const publishMetrics = () => {
      const w = Math.max(1, window.innerWidth)
      const h = Math.max(1, window.innerHeight)
      document.documentElement.style.setProperty('--vp-w', `${w}px`)
      document.documentElement.style.setProperty('--vp-h', `${h}px`)
    }

    publishMetrics()
    window.addEventListener('resize', publishMetrics)
    window.addEventListener('orientationchange', () => {
      setTimeout(publishMetrics, 100)
      setTimeout(publishMetrics, 300)
    })

    const resetScroll = () => {
      if (window.scrollX || window.scrollY) {
        window.scrollTo(0, 0)
      }
    }
    window.addEventListener('scroll', resetScroll, true)

    // Context menu / drag cancel
    document.addEventListener('contextmenu', (e) => e.preventDefault(), true)
    document.addEventListener('dragstart', (e) => e.preventDefault(), true)
  }
}

export const uiRoot = UiRoot.getInstance()
