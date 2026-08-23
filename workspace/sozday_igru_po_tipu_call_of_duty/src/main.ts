import { playgama } from './platform/PlaygamaService'
import { sound } from './audio/SoundManager'
import { physics } from './physics/PhysicsWorld'
import { SceneManager } from './rendering/SceneManager'
import { BallisticsManager } from './game/BallisticsManager'
import { SquadAIController } from './game/SquadAIController'
import { EnemySpawnDirector } from './game/EnemySpawnDirector'
import { DestructionSystem } from './game/DestructionSystem'
import { InputManager } from './input/InputManager'
import { TouchControls } from './input/TouchControls'
import { UiRoot } from './ui/UiRoot'
import { Hud } from './ui/Hud'
import { ScreenRouter } from './ui/ScreenRouter'
import { GameManager } from './game/GameManager'
import { GameLoop } from './core/GameLoop'
import { events } from './core/EventBus'
import { GameState, ThermalPalette } from './types'

async function bootstrap(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
  if (!canvas) throw new Error('Game canvas not found')

  // 1. Platform Bridge Initialization
  playgama.setProgress(15)
  await playgama.initialize()
  playgama.setProgress(35)

  // 2. Audio & Physics Subsystems
  sound.init()
  await physics.init()
  playgama.setProgress(60)

  // 3. Scene & Game Systems
  const scene = SceneManager.getInstance(canvas)
  const props = scene.getPropsGroup()

  const ballistics = BallisticsManager.getInstance()
  ballistics.init(props)

  const squadAI = SquadAIController.getInstance()
  squadAI.init(props)

  const enemyDirector = EnemySpawnDirector.getInstance()
  enemyDirector.init(props)

  const destruction = DestructionSystem.getInstance()
  destruction.init(props)

  playgama.setProgress(80)

  // 4. UI Layer Stack & Controls
  const ui = UiRoot.getInstance()
  const uiContainer = ui.getLayersContainer()

  const touchControls = new TouchControls(uiContainer)
  const hud = new Hud(uiContainer)
  const router = ScreenRouter.getInstance(uiContainer)
  const input = InputManager.getInstance()
  input.init(canvas)

  const game = GameManager.getInstance()
  game.init()

  // 5. Connect UI Visibility & State Transitions
  events.on('PLATFORM_BOOT_READY', () => {})
  events.on('TOUCH_CAPABILITY_DETECTED', () => {})

  events.on('GAME_STATE_CHANGED', (state: GameState) => {
    if (state === 'PLAYING') {
      hud.setVisible(true)
      touchControls.setVisible(true)
    } else if (state === 'MENU' || state === 'ARMORY') {
      hud.setVisible(false)
      touchControls.setVisible(false)
    } else if (state === 'VICTORY' || state === 'DEFEAT') {
      hud.setVisible(false)
      touchControls.setVisible(false)
    }
  })

  events.on('PALETTE_CHANGED', (palette: ThermalPalette) => {
    scene.setThermalPalette(palette)
  })

  events.on('ZOOM_CHANGED', (zoom: number) => {
    scene.setZoom(zoom)
  })

  events.on('INPUT_TOGGLE_PAUSE', () => {
    if (game.getState() === 'PLAYING') {
      game.setState('PAUSED')
      router.navigateTo('ScreenMainMenu')
    }
  })

  // Hook game loop tick updates for HUD
  const originalUpdate = game.update.bind(game)
  game.update = (dt: number, aimPos: any) => {
    originalUpdate(dt, aimPos)
    if (game.getState() === 'PLAYING') {
      hud.update(game.getStats(), performance.now() / 1000)
    }
  }

  // 6. Complete loading and dispatch ready signal
  playgama.setProgress(100)
  playgama.sendGameReady()

  // 7. Start the main game loop
  const loop = GameLoop.getInstance()
  loop.start()
}

window.addEventListener('DOMContentLoaded', () => {
  bootstrap().catch((err) => console.error('[Main] Boot error:', err))
})
