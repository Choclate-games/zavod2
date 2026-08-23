import './theme.css'
import { bus } from '../core/eventBus.js'
import { initI18n, t } from '../core/i18n.js'
import type { PlaygamaService } from '../platform/PlaygamaService.js'
import type { StorageService } from '../platform/StorageService.js'
import type { InputRouter } from '../systems/InputRouter.js'
import { installIconSprite } from './icons.js'
import { el } from './components/dom.js'
import { ScreenRouter, type ScreenId } from './ScreenRouter.js'
import { TouchControls } from './TouchControls.js'
import { MainMenuScreen } from './screens/MainMenuScreen.js'
import { BriefingModal } from './screens/BriefingModal.js'
import { HudScreen } from './screens/HudScreen.js'
import { BulletCamOverlay } from './screens/BulletCamOverlay.js'
import { VictorySummaryScreen } from './screens/VictorySummaryScreen.js'
import { DefeatRetryScreen } from './screens/DefeatRetryScreen.js'

/** Корень интерфейса: слои над канвасом, измеренный вьюпорт, экраны,
 * тач-слой и загрузка. Весь DOM живёт здесь. */
export class UiRoot {
  readonly router: ScreenRouter
  private loadingLayer: HTMLElement
  private controlsLayer: HTMLElement
  private loadingFill = el('div')
  private touch: TouchControls | null = null
  private progressValue = 0

  constructor(
    hostRoot: HTMLElement,
    platform: PlaygamaService,
    storage: StorageService,
    router: InputRouter,
    audioResume: () => void,
  ) {
    initI18n(platform.getLanguage())

    const canvasLayer = el('div', 'ui-layer')
    const hudLayer = el('div', 'ui-layer')
    this.controlsLayer = el('div', 'ui-layer controls')
    const screensLayer = el('div', 'ui-layer screens')
    this.loadingLayer = el('div', 'ui-layer loading-layer')

    hostRoot.appendChild(canvasLayer)
    hostRoot.appendChild(hudLayer)
    hostRoot.appendChild(this.controlsLayer)
    hostRoot.appendChild(screensLayer)
    hostRoot.appendChild(this.loadingLayer)

    // спрайт иконок — в слой канваса, чтобы <use> находил символы
    installIconSprite(canvasLayer)

    // измеренный вьюпорт вместо 100vh + пересчёт после поворота/фуллскрина
    const publishViewport = () => {
      const h = Math.round(window.visualViewport?.height ?? window.innerHeight)
      document.documentElement.style.setProperty('--vp-h', `${h}px`)
    }
    window.addEventListener('resize', publishViewport)
    window.addEventListener('orientationchange', publishViewport)
    window.visualViewport?.addEventListener('resize', publishViewport)
    publishViewport()

    // звук оживает по первому жесту игрока
    document.addEventListener('pointerdown', audioResume, { capture: true })

    // сброс отложенных записей при закрытии вкладки
    const flush = () => storage.flush()
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', flush)

    // глобальный запрет браузерных жестов и контекстного меню
    document.addEventListener('contextmenu', (e) => e.preventDefault())
    document.addEventListener('dragstart', (e) => e.preventDefault())

    this.router = new ScreenRouter(screensLayer)
    const menu = new MainMenuScreen()
    const brief = new BriefingModal(platform)
    const hud = new HudScreen()
    const bulletcam = new BulletCamOverlay()
    const victory = new VictorySummaryScreen(platform)
    const defeat = new DefeatRetryScreen(platform)

    this.router.register('menu', menu.root)
    this.router.register('brief', brief.root)
    this.router.register('hud', hud.root)
    this.router.register('bulletcam', bulletcam.root)
    this.router.register('victory', victory.root)
    this.router.register('defeat', defeat.root)

    // тач-слой существует только в мобильной схеме
    bus.on('input:mode', (payload) => {
      const mode = String((payload as { mode?: string }).mode)
      if (mode === 'touch' && !this.touch) {
        this.touch = new TouchControls(this.controlsLayer, router)
        this.touch.mount()
        this.touch.setVisible(this.router.active === 'hud')
      } else if (mode !== 'touch' && this.touch) {
        this.touch.unmount()
        this.touch = null
      }
    })
    bus.on('screen:changed', (payload) => {
      const id = (payload as { id?: string }).id
      this.touch?.setVisible(id === 'hud')
    })
    bus.on('platform:paused', () => this.touch?.resetAll())
    window.addEventListener('blur', () => this.touch?.resetAll())

    // начальный режим приходит от роутера чуть позже — спросим сразу
    queueMicrotask(() => {
      bus.emit('input:mode', { mode: router.mode })
      menu.refreshHints()
    })
  }

  show(id: ScreenId): void {
    this.router.show(id)
  }

  /** Реальные вехи загрузки: монотонно к 100% до game_ready. */
  setProgress(fraction: number): void {
    const clamped = Math.max(0, Math.min(1, fraction))
    if (clamped <= this.progressValue && fraction < 1) return
    this.progressValue = clamped
    if (!this.loadingFill) return
    this.loadingFill.style.transform = `scaleX(${clamped.toFixed(3)})`
  }

  buildLoading(label: string): void {
    this.loadingLayer.replaceChildren()
    const text = el('div', 'loading-label', label || t('ui.loading'))
    const bar = el('div', 'loading-bar')
    this.loadingFill = el('div', 'fill')
    bar.appendChild(this.loadingFill)
    this.loadingLayer.appendChild(text)
    this.loadingLayer.appendChild(bar)
  }

  hideLoading(): void {
    this.progressValue = 1
    this.loadingLayer.replaceChildren()
  }
}
