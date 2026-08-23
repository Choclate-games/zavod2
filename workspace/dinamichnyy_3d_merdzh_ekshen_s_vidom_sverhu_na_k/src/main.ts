import { Game } from './core/Game'
import { EventBus } from './core/EventBus'
import { PlaygamaService } from './platform/PlaygamaService'
import { UiRoot } from './ui/UiRoot'

const canvas = document.getElementById('game-canvas')
const mount = document.getElementById('ui-root')

async function bootstrap(): Promise<void> {
  if (!(canvas instanceof HTMLCanvasElement) || !(mount instanceof HTMLElement)) throw new Error('Game mount is missing')
  const bus = new EventBus()
  const platform = new PlaygamaService(bus)
  const watchdog = window.setTimeout(() => platform.announceReady(), 15000)
  await platform.initialize()
  platform.setProgress(0.35)
  const game = new Game(canvas, platform, bus)
  await game.initialize()
  platform.setProgress(0.72)
  const ui = new UiRoot(mount, game.bus, platform, {
    onStart: () => game.startRun(),
    onRestart: () => game.startRun(),
    onMenu: () => game.startMenu(),
    onNextWave: () => game.nextWave(),
    onPause: () => game.togglePause(),
    onToggleSound: () => game.toggleSound(),
    onReward: () => game.requestReward(),
    onLeaderboard: () => game.submitLeaderboard(),
  }, platform.deviceType === 'desktop' ? 'desktop' : 'touch', game.bestScore)
  ui.router.show('main_menu')
  platform.setProgress(1)
  platform.announceReady()
  window.clearTimeout(watchdog)
  game.loop.start()
  window.addEventListener('pagehide', () => { void platform.storage.flush() })
  document.addEventListener('visibilitychange', () => { if (document.hidden) void platform.storage.flush() })
}

void bootstrap().catch((error: unknown) => {
  console.error('Game bootstrap failed.', error)
})
