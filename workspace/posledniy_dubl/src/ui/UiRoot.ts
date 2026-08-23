import type { EventBus, RunStats } from '../core/EventBus.js'
import type { InputRouter } from '../input/InputRouter.js'
import type { PlaygamaService } from '../platform/PlaygamaService.js'
import type { StorageService } from '../platform/StorageService.js'
import { ScreenRouter } from './ScreenRouter.js'
import { Hud } from './Hud.js'
import { TouchControls } from './TouchControls.js'
import {
  buildFailScreen,
  buildMenuScreen,
  buildPauseScreen,
  buildVictoryScreen,
  refreshMenuRecord,
  updateResultScreens,
} from './screens.js'

/**
 * Корень интерфейса: слои, роутер экранов, HUD, тач-схема.
 * DOM создаётся только здесь. Состояние приходит только через шину событий.
 */
export class UiRoot {
  readonly router = new ScreenRouter()
  private hud!: Hud
  private touch: TouchControls | null = null

  constructor(
    private readonly events: EventBus,
    private readonly input: InputRouter,
    private readonly platform: PlaygamaService,
    private readonly storage: StorageService,
    private readonly callbacks: {
      startRun: () => void
      pause: () => void
      resume: () => void
      restart: () => void
      toMenu: () => void
    },
  ) {}

  build(appRoot: HTMLElement, canvas: HTMLCanvasElement, isTouchScheme: boolean): void {
    appRoot.appendChild(canvas)

    const screensLayer = document.createElement('div')
    screensLayer.id = 'screens'

    const screenCallbacks = {
      onStartRun: this.callbacks.startRun,
      onResume: this.callbacks.resume,
      onRestart: this.callbacks.restart,
      onRewardedRetry: async (): Promise<void> => {
        const rewarded = await this.platform.showRewarded()
        // Награда выдаётся строго по состоянию 'rewarded' — внутри showRewarded.
        if (rewarded) this.callbacks.restart()
      },
      onToMenu: () => {
        // Interstitial только на уходе с экрана результата, не на старте.
        void this.platform.showInterstitial()
        this.callbacks.toMenu()
      },
    }

    buildMenuScreen(this.router, screenCallbacks, this.storage.snapshot.bestTimeMs)
    buildPauseScreen(this.router, screenCallbacks)
    buildVictoryScreen(this.router, screenCallbacks)
    buildFailScreen(this.router, screenCallbacks, this.platform.capability)

    // Корни экранов вставляются в слой при регистрации.
    this.router.mountAll(screensLayer)

    this.hud = new Hud(this.events, () => this.callbacks.pause(), true)

    if (isTouchScheme) {
      // Тач-слой вставлен в DOM только в тач-схеме и виден в геймплее.
      this.touch = new TouchControls(
        (x, y) => this.input.touchMove(x, y),
        (dx, dy) => this.input.touchLook(dx, dy),
        (pressed) => (pressed ? this.input.touchFirePress() : this.input.touchFireRelease()),
      )
      this.touch.setZoomHandler((active) => this.input.touchZoom(active))
      this.touch.mount(appRoot)
      this.touch.setVisible(false)
    }

    appRoot.appendChild(screensLayer)
    appRoot.appendChild(this.hud.root)
    this.hud.setVisible(false)

    // Начальное состояние MENU присвоено до подписки — показываем меню явно.
    this.router.show('MENU')

    // Облако догрузилось позже — обновляем рекорд в меню.
    this.events.on('save:loaded', () => {
      refreshMenuRecord(this.storage.snapshot.bestTimeMs)
    })

    this.events.on('state:changed', ({ state }) => {
      switch (state) {
        case 'MENU':
          refreshMenuRecord(this.storage.snapshot.bestTimeMs)
          this.router.show('MENU')
          this.hud.setVisible(false)
          this.touch?.setVisible(false)
          break
        case 'PLAYING':
          this.router.hideAll()
          this.hud.setVisible(true)
          this.touch?.setVisible(true)
          break
        case 'PAUSED':
          this.router.show('PAUSED')
          this.hud.setVisible(true)
          this.touch?.setVisible(false)
          break
        case 'VICTORY':
          this.router.show('VICTORY')
          this.hud.setVisible(false)
          this.touch?.setVisible(false)
          break
        case 'FAIL':
          this.router.show('FAIL')
          this.hud.setVisible(false)
          this.touch?.setVisible(false)
          break
      }
    })

    this.events.on('run:finished', ({ win, reasonKey, stats }: { win: boolean; reasonKey: string | null; stats: RunStats }) => {
      updateResultScreens(win, reasonKey, stats)
    })
  }
}
