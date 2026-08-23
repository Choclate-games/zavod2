import './ui/theme.css'

import { EventBus } from './core/EventBus'
import { GameLoop } from './core/GameLoop'
import { Game } from './core/Game'
import { createFlightInput, InputHub } from './input/InputHub'
import { PlaygamaService } from './platform/PlaygamaService'
import { StorageService } from './platform/StorageService'
import { getBridge } from './platform/BridgeApi'
import { SceneManager } from './rendering/SceneManager'
import { MainMenuScreen } from './ui/screens/MainMenuScreen'
import { GameplayHudScreen } from './ui/screens/GameplayHudScreen'
import { PauseScreen } from './ui/screens/PauseScreen'
import { ScreenRouter } from './ui/ScreenRouter'
import { TouchControls } from './ui/TouchControls'
import { UiRoot } from './ui/UiRoot'

const WATCHDOG_MS = 15_000
const FRAME_WAIT_MS = 4_000

async function boot(): Promise<void> {
  const platform = new PlaygamaService()
  const storage = new StorageService()
  const bus = new EventBus()
  const ui = new UiRoot()

  ui.reportProgress(5)
  const watchdog = window.setTimeout(() => platform.notifyReady(), WATCHDOG_MS)

  await platform.init()
  ui.reportProgress(30)

  document.documentElement.lang = platform.language()

  const bridge = getBridge()
  const cloudStorage = bridge?.isInitialized ? bridge.storage : null
  await storage.load(cloudStorage)
  storage.installFlushHooks()
  if (storage.get().settings.language === 'ru') {
    storage.update((data) => {
      data.settings.language = platform.language()
    })
  }
  ui.reportProgress(55)

  const canvas = document.getElementById('scene-canvas')
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Канвас сцены не найден')
  const scene = new SceneManager(canvas)
  scene.setMode('MENU')

  const input = createFlightInput()
  const hud = new GameplayHudScreen(() => game.togglePause())
  let game: Game

  game = new Game({
    bus,
    scene,
    input,
    onHudUpdate: (snapshot) => hud.update(snapshot),
    onFlightEnd: (score, won) => {
      storage.update((data) => {
        data.highScores.push(score)
        data.highScores.sort((a, b) => b - a)
        data.highScores = data.highScores.slice(0, 20)
        if (won) data.pilotLevel += 1
      })
    },
  })

  const router = new ScreenRouter(ui.screensContainer)
  router.register(new MainMenuScreen(() => startFlight()).screen)
  router.register(hud.screen)
  router.register(new PauseScreen(() => game.togglePause(), () => game.toMenu()).screen)
  router.show('screen_main_menu')

  function startFlight(): void {
    game.startFlight()
    platform.gameplayStarted()
  }

  // Схема управления выбирается по типу устройства площадки; ?input= — ручной override.
  const forced = new URLSearchParams(window.location.search).get('input')
  const deviceType = forced === 'touch' || forced === 'desktop' ? forced : platform.deviceType()
  let touchControls: TouchControls | null = null
  if (deviceType === 'mobile' || deviceType === 'tablet') {
    touchControls = new TouchControls(ui.touchLayer, input, () => game.togglePause())
  }
  if (deviceType === 'desktop') {
    new InputHub(input, () => game.togglePause())
  }

  bus.on('game:state', (state) => {
    router.show(
      state === 'PLAYING' ? 'screen_gameplay_hud' : state === 'PAUSED' ? 'screen_pause' : 'screen_main_menu',
    )
    touchControls?.[state === 'PLAYING' ? 'show' : 'hide']()
    if (state !== 'PLAYING') game.resetInputAxes()
  })

  const loop = new GameLoop(
    (dt) => game.fixedUpdate(dt),
    (frameDt) => game.renderFrame(frameDt),
  )

  platform.subscribeLifecycle(
    (paused) => {
      bus.emit('platform:pause', paused)
      if (!paused) loop.resetAccumulator()
    },
    () => {
      // Управление звуком площадки подключается вместе с AudioManager (фаза аудио).
    },
  )

  window.addEventListener('resize', () => scene.resize())

  loop.start()

  ui.reportProgress(80)

  // Ждём два кадра с дедлайном: в скрытой вкладке кадры не приходят.
  await Promise.race([
    (async () => {
      await nextFrame()
      await nextFrame()
    })(),
    new Promise((resolve) => setTimeout(resolve, FRAME_WAIT_MS)),
  ])

  ui.reportProgress(100)
  platform.notifyReady()
  window.clearTimeout(watchdog)
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

window.addEventListener('error', (event) => {
  console.error('[boot]', event.error ?? event.message)
})

void boot().catch((error) => {
  console.error('[boot] запуск не удался:', error)
  const fallbackPlatform = new PlaygamaService()
  void fallbackPlatform.init().then(() => fallbackPlatform.notifyReady())
})
