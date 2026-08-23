import './ui/theme.css'
import { Game, GameState, bus, GameTopic } from './core/Game'
import { GameLoop } from './core/GameLoop'
import { PlaygamaService } from './platform/PlaygamaService'
import { StorageService, type SaveData } from './platform/StorageService'
import { InputRouter } from './input/InputRouter'
import { SceneManager } from './rendering/SceneManager'
import { UiRoot } from './ui/UiRoot'
import { BALANCE } from './generated/balanceValues'

/**
 * Bootstrap: guards → initialize → прогресс по вехам → сохранение →
 * движок и интерфейс → 100 % → сигнал готовности. Ни один шаг не ждёт
 * решения игрока; сторожевой таймер снимает заставку при любой ошибке.
 */
const platform = new PlaygamaService()
const storage = new StorageService()

/** Глобальные ошибки логируются с дедупликацией, а не проглатываются. */
function installErrorReporting(): void {
  const seen = new Set<string>()
  window.addEventListener('error', (event) => {
    const key = String(event.message)
    if (seen.has(key)) return
    seen.add(key)
    console.error('[boot]', event.error ?? event.message)
  })
  window.addEventListener('unhandledrejection', (event) => {
    const key = `rejection: ${String(event.reason)}`
    if (seen.has(key)) return
    seen.add(key)
    console.error('[boot] unhandled rejection:', event.reason)
  })
}

/** Страница под игрой не скроллится; контекстные жесты отменены. */
function installViewportGuards(): void {
  document.addEventListener('contextmenu', (event) => event.preventDefault())
  document.addEventListener('selectstart', (event) => event.preventDefault())
  document.addEventListener('dragstart', (event) => event.preventDefault())
  document.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length > 1) event.preventDefault()
    },
    { passive: false },
  )
}

/** Ожидание кадра с дедлайном: скрытая вкладка кадров не даёт. */
function nextFrame(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false
    const timer = setTimeout(() => {
      if (!done) {
        done = true
        resolve()
      }
    }, timeoutMs)
    requestAnimationFrame(() => {
      if (!done) {
        done = true
        clearTimeout(timer)
        resolve()
      }
    })
  })
}

async function boot(): Promise<void> {
  installViewportGuards()
  installErrorReporting()

  // Веха 1: мост с таймаутом; сторожевой таймер стартует сразу.
  const watchdog = setTimeout(() => platform.markReady(), 15_000)
  await platform.init()
  platform.setProgress(15)

  // Веха 2: схема управления от площадки.
  const input = new InputRouter(platform.deviceType())
  platform.setProgress(30)

  // Веха 3: сохранение — облако или зеркало, нормализация на месте.
  let save: SaveData | null = null
  try {
    save = await storage.load()
  } catch (error) {
    console.error('[boot] save load failed:', error)
  }
  platform.setProgress(45)

  // Веха 4: движок и интерфейс.
  const canvas = document.getElementById('game-canvas')
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('#game-canvas не найден')
  const scene = new SceneManager(canvas)
  const game = new Game(scene, input)
  const ui = new UiRoot(() => game.startContract())
  if (save) ui.menu.setSave(save)
  platform.setProgress(75)

  // Меню живое: сцена крутится на сниженной нагрузке ещё до контракта.
  game.enterMenu()
  const menuIdle = new GameLoop(
    Math.max(30, Math.round(BALANCE.performance.target_fps / 2)),
    (dt) => scene.update(dt),
    () => scene.render(),
  )
  menuIdle.start()
  platform.setProgress(90)

  // Веха 5: заставка успела отрисоваться, прогресс дошёл до 100.
  if (document.fonts) await document.fonts.ready
  await nextFrame(250)
  await nextFrame(250)
  platform.setProgress(100)
  await nextFrame(700)

  clearTimeout(watchdog)
  platform.markReady()

  // Пауза и звук приходят из событий моста; дельта времени сбрасывается.
  platform.onPlatformPause((paused) => {
    if (paused) {
      game.suspend()
      menuIdle.resetDelta()
    } else if (game.getState() === GameState.PLAYING || game.getState() === GameState.PAUSED) {
      game.resume()
    } else {
      menuIdle.resetDelta()
      menuIdle.start()
    }
  })

  bus.on(GameTopic.stateChanged, (state) => {
    if (state === GameState.PLAYING) menuIdle.stop()
    else if (state === GameState.MENU) menuIdle.start()
  })
}

void boot().catch((error) => {
  console.error('[boot] failed:', error)
  // Заставка площадки обязана уйти даже при упавшем бутстрапе.
  platform.markReady()
})
