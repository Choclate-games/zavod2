import './theme.css'

export type UiLayer = {
  root: HTMLElement
  screens: HTMLElement
  hud: HTMLElement
  controls: HTMLElement
  modals: HTMLElement
}

/**
 * Слои над канвасом. Геометрия считается от измеренного вьюпорта
 * (visualViewport), резерв под баннер площадки живёт токеном --banner-height,
 * который читают правила вёрстки.
 */
export class UiRoot {
  readonly layers: UiLayer

  constructor(containerId = 'ui-root') {
    const host =
      document.getElementById(containerId) ??
      (() => {
        const created = document.createElement('div')
        created.id = containerId
        document.body.appendChild(created)
        return created
      })()
    host.innerHTML = ''

    const screens = document.createElement('div')
    screens.className = 'ui-layer layer-screens'
    const hud = document.createElement('div')
    hud.className = 'ui-layer layer-hud'
    const controls = document.createElement('div')
    controls.className = 'ui-layer layer-controls'
    const modals = document.createElement('div')
    modals.className = 'ui-layer layer-modal'

    for (const node of [hud, controls, screens, modals]) host.appendChild(node)
    this.layers = { root: host, screens, hud, controls, modals }

    window.visualViewport?.addEventListener('resize', () => this.measureViewport())
    window.addEventListener('orientationchange', () => setTimeout(() => this.measureViewport(), 120))
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.measureViewport()
    })
    this.measureViewport()
  }

  private measureViewport(): void {
    const vv = window.visualViewport
    const width = Math.round(vv?.width ?? window.innerWidth)
    const height = Math.round(vv?.height ?? window.innerHeight)
    const rootStyle = document.documentElement.style
    // Обе переменные читаются правилами theme.css: --vp-h задаёт высоту модалок,
    // --banner-height — резерв под полосу баннера площадки.
    rootStyle.setProperty('--vp-w', `${width}px`)
    rootStyle.setProperty('--vp-h', `${height}px`)
  }

  setBannerHeight(px: number): void {
    document.documentElement.style.setProperty('--banner-height', `${Math.max(0, Math.round(px))}px`)
  }
}
