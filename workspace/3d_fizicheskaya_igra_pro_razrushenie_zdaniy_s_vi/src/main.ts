import { Game } from './core/Game'
import { EventBus } from './core/EventBus'
import { SESSION } from './core/balance'
import { AudioManager } from './audio/AudioManager'
import { InputRouter } from './input/InputRouter'
import { PlaygamaService } from './platform/PlaygamaService'
import { StorageService } from './platform/StorageService'
import { UiRoot } from './ui/UiRoot'
import { ScreenRouter } from './ui/ScreenRouter'
import { I18n } from './ui/i18n'
import { injectIconSprite } from './ui/icons'
import { TouchControls } from './ui/TouchControls'
import { SplashScreen } from './ui/screens/SplashScreen'
import { LevelSelectScreen } from './ui/screens/LevelSelectScreen'
import { GameplayHUD } from './ui/screens/GameplayHUD'
import { VictoryModal } from './ui/screens/VictoryModal'
import { DefeatModal } from './ui/screens/DefeatModal'
import { PauseModal } from './ui/screens/PauseModal'

async function bootstrap(): Promise<void> {
  const events = new EventBus()
  const playgama = new PlaygamaService(events)
  const uiRoot = new UiRoot()
  injectIconSprite()

  const i18n = new I18n()
  const router = new ScreenRouter(events)
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement

  // Заставка встаёт первой и слушает реальные вехи загрузки.
  const splash = new SplashScreen(events, i18n, uiRoot.layers.screens)
  router.register('splash', splash.root, uiRoot.layers.screens)
  router.show('splash')
  playgama.reportLoadingProgress(0.05)

  events.on('loading:progress', ({ value }) => {
    playgama.reportLoadingProgress(value)
  })

  await playgama.initialize()
  i18n.setLanguage(playgama.language)
  splash.setHint(
    i18n,
    playgama.deviceType === 'desktop' ? 'hintCutDesktop' : 'hintCutTouch',
  )
  events.emit('loading:progress', { value: 0.1 })

  const storage = new StorageService(
    SESSION.TOTAL_LEVELS,
    (key) => playgama.getCloudValue(key),
    (key, value) => playgama.setCloudValue(key, value),
    events,
  )
  await storage.loadFromCloud()
  events.emit('loading:progress', { value: 0.2 })

  const audio = new AudioManager(events)
  if (storage.data.muted) audio.toggleMute()

  const inputRouter = new InputRouter(canvas, events, playgama.deviceType, () => undefined)

  const game = new Game(canvas, events, playgama, storage, audio, {
    showScreen: (name) => router.show(name),
  })
  await game.init((fraction) => {
    events.emit('loading:progress', { value: 0.2 + fraction * 0.8 })
  })

  // ── экраны ──────────────────────────────────────────────────────────────
  const hud = new GameplayHUD(
    events,
    i18n,
    uiRoot.layers.hud,
    () => game.restartLevel(),
    () => game.togglePause(),
    () => events.emit('act:view', {}),
  )
  router.register('gameplay', hud.root, uiRoot.layers.hud)

  let currentLevelIndex = 0

  const levelSelect = new LevelSelectScreen(
    i18n,
    uiRoot.layers.screens,
    (index) => {
      audio.uiClick()
      game.startLevel(index)
    },
    () => {
      const muted = audio.toggleMute()
      storage.setMuted(muted)
    },
    () => game.togglePause(),
    () => Math.max(0, Math.min(storage.data.unlocked - 1, SESSION.TOTAL_LEVELS - 1)),
  )
  router.register('levelselect', levelSelect.root, uiRoot.layers.screens)
  levelSelect.refresh(storage.data.unlocked, storage.data.stars)

  const backToMenu = (): void => {
    playgama.maybeShowInterstitial()
    levelSelect.refresh(storage.data.unlocked, storage.data.stars)
    game.toMenu()
  }

  const victory = new VictoryModal(
    i18n,
    uiRoot.layers.modals,
    () => {
      playgama.maybeShowInterstitial()
      game.startLevel(Math.min(currentLevelIndex + 1, SESSION.TOTAL_LEVELS - 1))
    },
    () => game.restartLevel(),
    backToMenu,
  )
  router.register('victory', victory.root, uiRoot.layers.modals, true)

  const defeat = new DefeatModal(
    events,
    i18n,
    uiRoot.layers.modals,
    () => game.restartLevel(),
    backToMenu,
    () => game.grantExtraWedge(),
    () => playgama.isRewardedSupported,
  )
  router.register('defeat', defeat.root, uiRoot.layers.modals, true)

  const pauseModal = new PauseModal(
    i18n,
    uiRoot.layers.modals,
    () => game.togglePause(),
    () => {
      game.togglePause()
      game.restartLevel()
    },
    () => {
      game.setPausedByUi(false)
      backToMenu()
    },
  )
  router.register('pause', pauseModal.root, uiRoot.layers.modals, true)

  events.on('level:start', ({ index }) => {
    currentLevelIndex = index
  })
  events.on('level:result', ({ win, score, stars }) => {
    if (!win) return
    victory.showResult(stars, score)
  })

  // ── тач-слой: живёт только в экранной схеме и только в геймплее ─────────
  let touchControls: TouchControls | null = null
  const syncTouchLayer = (): void => {
    if (inputRouter.scheme === 'touch') {
      touchControls ??= new TouchControls(
        inputRouter,
        events,
        i18n,
        () => game.restartLevel(),
        () => events.emit('act:view', {}),
        () => game.togglePause(),
      )
      touchControls.mount(uiRoot.layers.controls)
      touchControls.setVisible(router.active === 'gameplay' && !game.pausedByUi)
    } else if (touchControls) {
      touchControls.unmount()
    }
  }
  syncTouchLayer()
  events.on('screen:show', () => syncTouchLayer())

  // Сворачивание вкладки и пауза площадки отпускают все зажатые оси и кнопки.
  const releaseControls = (): void => {
    inputRouter.releaseAll()
    touchControls?.setVisible(false)
  }
  events.on('platform:pause', ({ paused }) => {
    if (paused) releaseControls()
  })
  window.addEventListener('blur', releaseControls)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') releaseControls()
  })

  // Глобальные запреты браузерных жестов и контекстного меню.
  document.addEventListener('contextmenu', (e) => e.preventDefault())
  document.addEventListener('dragstart', (e) => e.preventDefault())
  document.addEventListener('selectstart', (e) => e.preventDefault())

  // Меню интерактивно: заставка уходит, площадка получает сигнал готовности.
  router.show('levelselect')
  playgama.markReady()
  playgama.requestBanner()
  uiRoot.setBannerHeight(playgama.measureBannerHeight())
  setTimeout(() => uiRoot.setBannerHeight(playgama.measureBannerHeight()), 1500)
}

bootstrap().catch((error: unknown) => {
  console.error(String(error))
})
