import { GameTopic, bus, GameState } from '../core/Game'
import { ScreenRouter } from './ScreenRouter'
import { LoadingScreen } from './screens/LoadingScreen'
import { MainMenuScreen } from './screens/MainMenuScreen'
import { Hud } from './Hud'

/**
 * Корень интерфейса: слои над канвасом, измеренный вьюпорт, экраны и HUD.
 * DOM живёт только здесь; состояние игры приходит через шину.
 */
export class UiRoot {
  readonly loading: LoadingScreen
  readonly menu: MainMenuScreen
  readonly hud: Hud
  private readonly router: ScreenRouter

  constructor(onStart: () => void) {
    const root = document.getElementById('ui-root')
    if (!root) throw new Error('ui-root отсутствует в index.html')

    this.router = new ScreenRouter(document.createElement('div'))
    this.loading = new LoadingScreen()
    this.menu = new MainMenuScreen(onStart)
    this.hud = new Hud()

    this.screensLayer(root)
    this.router.register(GameState.MENU, this.menu)

    // Экран загрузки не привязан к состоянию — им управляют вехи бутстрапа.
    this.loading.show()
    const loadingLayer = document.createElement('div')
    loadingLayer.className = 'ui-layer ui-layer--loading'
    loadingLayer.appendChild(this.loading.root)
    root.appendChild(loadingLayer)

    bus.on(GameTopic.stateChanged, (state) => this.applyState(state))
    this.measureViewport()
    window.addEventListener('resize', () => this.measureViewport())
    window.visualViewport?.addEventListener('resize', () => this.measureViewport())
  }

  /** Слой экранов вставляется в корень при регистрации. */
  private screensLayer(root: HTMLElement): void {
    const layer = document.createElement('div')
    layer.className = 'ui-layer ui-layer--screens'
    layer.appendChild(this.router.getContainer())
    layer.appendChild(this.hud.root)
    root.appendChild(layer)
  }

  /** Измеренный вьюпорт вместо 100vh: реклама и повороты не ломают раскладку. */
  private measureViewport(): void {
    const height = Math.round(window.visualViewport?.height ?? window.innerHeight)
    document.documentElement.style.setProperty('--vp-h', `${height}px`)
  }

  private applyState(state: GameState): void {
    if (state === GameState.MENU) {
      this.loading.hide()
      this.hud.hide()
      this.router.show(state)
      return
    }
    if (state === GameState.PLAYING || state === GameState.PAUSED) {
      this.loading.hide()
      this.hud.show()
      this.router.hideAll()
    }
  }
}
