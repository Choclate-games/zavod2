import './theme.css'
import { bus } from '../core/EventBus.ts'
import type { InputRouter } from '../core/InputRouter.ts'
import { deviceType, forceInputParam } from '../platform/PlaygamaService.ts'
import { Hud } from './Hud.ts'
import type { Screen } from './ScreenRouter.ts'
import { ScreenRouter } from './ScreenRouter.ts'
import { TouchControls } from './TouchControls.ts'
import {
  createMainMenuScreen,
  createVictoryScreen,
  type MainMenuCallbacks,
  type VictoryCallbacks,
  type VictoryData,
} from './screens.ts'
import { createPauseScreen } from './pauseScreen.ts'
import { createMeter, } from './components.ts'
import { formatMoney } from './Hud.ts'

/**
 * Корень интерфейса: измеренный вьюпорт, слои над канвасом, роутер экранов,
 * HUD и тач-слой (создаётся только в мобильной схеме). Весь DOM игры живёт здесь.
 */
export class UiRoot {
  readonly sceneLayer: HTMLDivElement
  readonly router: ScreenRouter
  readonly hud: Hud
  touchControls: TouchControls | null = null

  private readonly uiRoot: HTMLDivElement
  private readonly screensLayer: HTMLDivElement
  private readonly loadingFill: (fraction: number) => void
  private readonly loadingRoot: HTMLDivElement
  private victoryUpdate: ((data: VictoryData) => void) | null = null
  private pauseMutedSetter: ((muted: boolean) => void) | null = null

  constructor(container: HTMLElement, input: InputRouter) {
    // Измеренный вьюпорт вместо 100vh; публикуется как --vp-h.
    this.sceneLayer = document.createElement('div')
    this.sceneLayer.className = 'scene-layer'
    container.appendChild(this.sceneLayer)

    this.uiRoot = document.createElement('div')
    this.uiRoot.className = 'ui-root'
    container.appendChild(this.uiRoot)

    const measureViewport = (): void => {
      const height = window.visualViewport ? Math.round(window.visualViewport.height) : window.innerHeight
      document.documentElement.style.setProperty('--vp-h', `${height}px`)
    }
    measureViewport()
    window.visualViewport?.addEventListener('resize', measureViewport)
    window.addEventListener('orientationchange', () => setTimeout(measureViewport, 120))

    // Слой экранов: сюда роутер вставляет корни всех экранов при регистрации.
    this.screensLayer = document.createElement('div')
    this.screensLayer.className = 'ui-layer screens-layer'
    this.uiRoot.appendChild(this.screensLayer)
    this.router = new ScreenRouter(this.screensLayer)

    // Слой HUD.
    this.hud = new Hud(
      () => this.onPauseRequest?.(),
      () => bus.emit('input:restart', undefined),
    )
    this.hud.setVisible(false)
    this.uiRoot.appendChild(this.hud.root)

    // Экран загрузки: единственный непрозрачный слой — под ним ещё нет кадра.
    const loadingScreen = this.buildLoadingScreen()
    this.loadingRoot = loadingScreen.root
    this.loadingFill = loadingScreen.setProgress
    const loading: Screen = { root: loadingScreen.root, name: 'loading' }
    this.router.register(loading)
    this.router.show('loading')

    // Тач-слой только в мобильной схеме.
    const forced = forceInputParam()
    const isTouch = forced === 'touch' || (forced === null && deviceType() !== 'desktop')
    if (isTouch) {
      this.touchControls = new TouchControls(input, this.uiRoot)
      this.touchControls.setVisible(false)
    }

    // Живое переключение схем: неактивная схема удаляется из DOM.
    bus.on('input:schemeChanged', (mode: string) => {
      if (mode === 'touch' && !this.touchControls) {
        this.touchControls = new TouchControls(input, this.uiRoot)
        this.touchControls.setVisible(this.isGameplayVisible)
      } else if (mode === 'desktop' && this.touchControls) {
        this.touchControls.root.remove()
        this.touchControls = null
      }
    })
  }

  private isGameplayVisible = false
  /** Клик по настройкам в HUD: игра сама решает, как поставить паузу. */
  onPauseRequest: (() => void) | null = null

  /** Форматтер денег для экранов: единый источник. */
  formatMoneyForUi(): (value: number) => string {
    return formatMoney
  }

  setProgress(fraction: number): void {
    this.loadingFill(fraction)
  }

  hideLoading(): void {
    this.loadingRoot.hidden = true
  }

  registerMainMenu(callbacks: MainMenuCallbacks): void {
    this.router.register(createMainMenuScreen(callbacks))
  }

  registerVictory(callbacks: VictoryCallbacks): void {
    const screen = createVictoryScreen(callbacks)
    this.victoryUpdate = screen.update
    this.router.register(screen)
  }

  registerPause(callbacks: Parameters<typeof createPauseScreen>[0]): void {
    const screen = createPauseScreen(callbacks)
    this.pauseMutedSetter = screen.setMuted
    this.router.register(screen)
  }

  showMenu(): void {
    this.isGameplayVisible = false
    this.hud.setVisible(false)
    this.touchControls?.setVisible(false)
    this.router.show('main_menu')
  }

  showGameplay(): void {
    this.isGameplayVisible = true
    this.router.hideAll()
    this.hud.setVisible(true)
    this.touchControls?.setVisible(true)
  }

  showPause(): void {
    this.touchControls?.setVisible(false)
    this.router.show('pause')
  }

  resumeFromPause(): void {
    this.router.hideAll()
    this.touchControls?.setVisible(true)
  }

  showVictory(data: VictoryData): void {
    this.isGameplayVisible = false
    this.hud.setVisible(true)
    this.touchControls?.setVisible(false)
    this.victoryUpdate?.(data)
    this.router.show('victory_screen')
  }

  setPauseMuted(muted: boolean): void {
    this.pauseMutedSetter?.(muted)
  }

  private buildLoadingScreen(): { root: HTMLDivElement; setProgress: (fraction: number) => void } {
    const root = document.createElement('div')
    root.className = 'screen'
    // Подложка допустима: во время загрузки сцены ещё нет.
    root.style.background = 'color-mix(in srgb, var(--color-bg) 88%, transparent)'
    const panel = document.createElement('div')
    panel.className = 'panel'
    const title = document.createElement('h1')
    title.className = 'title'
    title.textContent = 'Банкетный Краш'
    const subtitle = document.createElement('p')
    subtitle.className = 'subtitle'
    subtitle.textContent = 'Свадебный Саботаж'
    const meter = createMeter()
    meter.root.style.width = '100%'
    panel.appendChild(title)
    panel.appendChild(subtitle)
    panel.appendChild(meter.root)
    root.appendChild(panel)
    return { root, setProgress: meter.set }
  }
}
