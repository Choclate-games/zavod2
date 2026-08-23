import type { EventBus } from '../core/EventBus'
import type { InputRouter } from '../core/InputRouter'
import type { UiController } from './screens/controller'
import { ScreenRouter } from './ScreenRouter'
import { Hud } from './Hud'
import { TouchControls } from './TouchControls'
import type { PlayerVehicle } from '../entities/Player'
import { buildMainMenuScreen } from './screens/MainMenuScreen'
import { buildTrackSelectScreen } from './screens/TrackSelectScreen'
import { buildPauseModal } from './screens/PauseModal'
import { ResultsScreen } from './screens/ResultsScreen'
import { CrashScreen } from './screens/CrashScreen'
import { t } from '../data/i18n'
import type { StorageService } from '../platform/StorageService'

export interface ScreenCaps {
  leaderboardsSupported: boolean
  rewardedSupported: boolean
}

/**
 * Корень интерфейса: слои над канвасом (HUD, управление, экраны), измеренный
 * вьюпорт с safe-area и баннером, заставка загрузки и тосты. Контейнеры слоёв
 * прозрачны для ввода, auto включают только листовые интерактивные элементы.
 */
export class UiRoot {
  readonly root: HTMLElement
  readonly router: ScreenRouter
  readonly hud: Hud
  readonly results: ResultsScreen
  readonly crash: CrashScreen

  private readonly screensLayer: HTMLElement
  private readonly controlsLayer: HTMLElement
  private readonly loadingScreen: HTMLElement
  private readonly loadingBarFill: HTMLDivElement
  private readonly loadingStatus: HTMLElement
  private readonly toast: HTMLElement
  private readonly inputHint: HTMLElement
  private touchControls: TouchControls | null = null
  private toastTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    bus: EventBus,
    private readonly currentInputRef: InputRouter,
    controller: UiController,
    storage: StorageService,
    caps: ScreenCaps,
    private readonly vehicleRef: { current: PlayerVehicle | null },
    onPauseClick: () => void,
    carPos: () => { x: number; z: number },
    trackCenterX: () => Float32Array | null,
    trackCenterZ: () => Float32Array | null,
  ) {
    this.root = document.createElement('div')
    this.root.className = 'ui-root'

    const hudLayer = document.createElement('div')
    hudLayer.className = 'ui-layer layer-hud'
    this.controlsLayer = document.createElement('div')
    this.controlsLayer.className = 'ui-layer layer-controls'
    this.screensLayer = document.createElement('div')
    this.screensLayer.className = 'ui-layer layer-screens safe-inset'
    const modalLayer = document.createElement('div')
    modalLayer.className = 'ui-layer layer-modal'
    const toastLayer = document.createElement('div')
    toastLayer.className = 'ui-layer layer-toast'

    this.toast = document.createElement('div')
    this.toast.className = 'toast'
    toastLayer.appendChild(this.toast)

    this.inputHint = document.createElement('div')
    this.inputHint.className = 'input-hint'

    this.root.append(hudLayer, this.controlsLayer, this.screensLayer, this.inputHint, modalLayer, toastLayer)
    document.body.appendChild(this.root)

    // ── HUD ──────────────────────────────────────────────────────────────
    this.hud = new Hud(trackCenterX, trackCenterZ, carPos, onPauseClick, bus)
    hudLayer.appendChild(this.hud.root)

    // ── роутер и экраны ─────────────────────────────────────────────────
    this.router = new ScreenRouter(this.screensLayer, bus)
    this.router.register('menu', buildMainMenuScreen(controller, storage, caps))
    this.router.register('trackSelect', buildTrackSelectScreen(controller, storage, caps))
    const hudScreen = document.createElement('div')
    this.router.register('hud', hudScreen)
    this.router.register('pause', buildPauseModal(controller, caps))
    this.results = new ResultsScreen(controller, caps)
    this.router.register('results', this.results.rootElement)
    this.crash = new CrashScreen(controller, caps, () => controller.reviveAvailableCheck())
    this.router.register('crash', this.crash.rootElement)

    bus.on('scheme:changed', (scheme) => this.applyScheme(scheme))
    this.applyScheme(this.currentInputRef.scheme)

    // ── заставка загрузки: прогресс по реальным вехам ───────────────────
    this.loadingScreen = document.createElement('div')
    this.loadingScreen.className = 'loading-screen'
    const loadingTitle = document.createElement('div')
    loadingTitle.className = 'loading-title'
    loadingTitle.textContent = t('title')
    this.loadingStatus = document.createElement('div')
    this.loadingStatus.className = 'loading-status'
    this.loadingStatus.textContent = t('menu.loading')
    const bar = document.createElement('div')
    bar.className = 'loading-bar'
    this.loadingBarFill = document.createElement('div')
    this.loadingBarFill.className = 'loading-bar-fill'
    bar.appendChild(this.loadingBarFill)
    this.loadingScreen.append(loadingTitle, this.loadingStatus, bar)
    document.body.appendChild(this.loadingScreen)

    bus.on('boot:progress', (percent) => this.setProgress(percent))
    bus.on('screen:changed', (name) => {
      // управление видно только в заезде и сброшено при скрытии
      const racing = name === 'hud'
      this.controlsLayer.style.display = racing ? 'block' : 'none'
      if (!racing) this.touchControls?.reset()
      this.updateHint()
    })
    this.controlsLayer.style.display = 'none'
    this.updateHint()

    // ── измеренный вьюпорт: никогда не 100vh наугад ─────────────────────
    this.measureViewport()
    window.visualViewport?.addEventListener('resize', () => this.measureViewport())
    window.addEventListener('orientationchange', () => this.measureViewport())
    window.addEventListener('resize', () => this.measureViewport())
    window.addEventListener('blur', () => this.touchControls?.reset())
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.touchControls?.reset()
    })

    // свайп по игре не скроллит страницу и не тянет документ
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false })
    document.addEventListener('contextmenu', (e) => e.preventDefault())
    document.addEventListener('dragstart', (e) => e.preventDefault())
    document.addEventListener('selectstart', (e) => e.preventDefault())
  }

  /** Слой управления существует только в тач-схеме: remove(), не display:none. */
  private applyScheme(scheme: 'desktop' | 'touch'): void {
    if (scheme === 'touch') {
      if (!this.touchControls) {
        this.touchControls = new TouchControls(
          {
            setSteerAxis: (v) => this.currentInputRef.setSteerAxis(v),
            setHandbrake: (p) => this.currentInputRef.setHandbrake(p),
            pressTurbo: () => this.currentInputRef.pressTurbo(),
            pressValve: () => this.currentInputRef.pressValve(),
          },
          this.vehicleRef,
        )
        this.touchControls.mountTo(this.controlsLayer)
      }
    } else if (this.touchControls) {
      this.touchControls.unmount()
      this.touchControls = null
    }
    this.updateHint()
  }

  private updateHint(): void {
    const racing = this.router.current === 'hud'
    this.inputHint.style.display = racing ? 'block' : 'none'
    this.inputHint.textContent =
      this.currentInputRef.scheme === 'touch' ? t('hint.touch') : t('hint.desktop')
  }

  showScreenByName(name: string): void {
    this.router.show(name)
  }

  get touch(): TouchControls | null {
    return this.touchControls
  }

  setProgress(percent: number): void {
    this.loadingBarFill.style.transform = `scaleX(${(percent / 100).toFixed(3)})`
  }

  setLoadingStatus(text: string): void {
    this.loadingStatus.textContent = text
  }

  hideSplash(): void {
    this.loadingScreen.classList.add('hidden')
    window.setTimeout(() => this.loadingScreen.remove(), 400)
  }

  showToast(text: string): void {
    this.toast.textContent = text
    this.toast.classList.add('visible')
    if (this.toastTimer) clearTimeout(this.toastTimer)
    this.toastTimer = setTimeout(() => this.toast.classList.remove('visible'), 2200)
  }

  private measureViewport(): void {
    const measured = window.visualViewport?.height ?? window.innerHeight
    document.documentElement.style.setProperty('--vp-h', `${Math.round(measured)}px`)
  }
}
