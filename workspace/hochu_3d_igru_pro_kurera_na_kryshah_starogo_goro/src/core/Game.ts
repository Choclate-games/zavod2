import * as THREE from 'three'
import { audioManager } from '../audio/AudioManager'
import { EntityManager } from '../entities/EntityManager'
import { Player } from '../entities/Player'
import { physicsWorld } from '../physics/PhysicsWorld'
import { playgamaService } from '../platform/PlaygamaService'
import { storageService } from '../platform/StorageService'
import { ParticleSystem } from '../rendering/ParticleSystem'
import { SceneManager } from '../rendering/SceneManager'
import { FlowComboSystem } from '../systems/FlowComboSystem'
import { GuildContractDispatchSystem } from '../systems/GuildContractDispatchSystem'
import { ParcelIntegritySystem } from '../systems/ParcelIntegritySystem'
import { RooftopProceduralGeneratorSystem } from '../systems/RooftopProceduralGeneratorSystem'
import { showModal } from '../ui/components/Modal'
import { DefeatScreen } from '../ui/screens/DefeatScreen'
import { GameplayHudScreen } from '../ui/screens/GameplayHudScreen'
import { MainMenuScreen } from '../ui/screens/MainMenuScreen'
import { SplashScreen } from '../ui/screens/SplashScreen'
import { VictoryScreen } from '../ui/screens/VictoryScreen'
import { WorkshopScreen } from '../ui/screens/WorkshopScreen'
import { TouchControls } from '../ui/TouchControls'
import { UiRoot } from '../ui/UiRoot'
import { events } from './EventBus'
import { GameLoop } from './GameLoop'
import type { GameState } from './types'

export class Game {
  private state: GameState = 'BOOT'
  private loop: GameLoop
  private sceneManager: SceneManager
  private particleSystem: ParticleSystem
  private generator: RooftopProceduralGeneratorSystem
  private integritySystem: ParcelIntegritySystem
  private flowSystem: FlowComboSystem
  private dispatchSystem: GuildContractDispatchSystem

  private player: Player
  private entityManager: EntityManager
  private uiRoot: UiRoot
  private touchControls: TouchControls

  // Screens
  private splashScreen: SplashScreen
  private mainMenuScreen: MainMenuScreen
  private hudScreen: GameplayHudScreen
  private workshopScreen: WorkshopScreen
  private victoryScreen: VictoryScreen
  private defeatScreen: DefeatScreen

  // Session stats
  private targetDistance = 400
  private timeRemaining = 60
  private contractTimeLimit = 60

  constructor(canvas: HTMLCanvasElement, appContainer: HTMLElement) {
    // 1. Systems & Rendering
    this.sceneManager = new SceneManager(canvas)
    this.particleSystem = new ParticleSystem(this.sceneManager.scene)
    this.generator = new RooftopProceduralGeneratorSystem(this.sceneManager.scene)
    this.integritySystem = new ParcelIntegritySystem()
    this.flowSystem = new FlowComboSystem()
    this.dispatchSystem = new GuildContractDispatchSystem()

    // 2. Entities
    this.player = new Player(
      this.sceneManager.scene,
      this.particleSystem,
      this.generator,
      this.integritySystem,
      this.flowSystem
    )
    this.entityManager = new EntityManager(this.sceneManager.scene, this.player)

    // 3. UI Layer
    this.uiRoot = new UiRoot(appContainer)

    this.splashScreen = new SplashScreen()
    this.mainMenuScreen = new MainMenuScreen(
      this.dispatchSystem,
      () => this.startGame(),
      () => this.openWorkshop()
    )
    this.hudScreen = new GameplayHudScreen(() => this.pauseGame())
    this.workshopScreen = new WorkshopScreen(() => this.returnToMenu())
    this.victoryScreen = new VictoryScreen(() => this.returnToMenu())
    this.defeatScreen = new DefeatScreen(
      () => this.restartGame(),
      () => this.returnToMenu()
    )

    // Register with screen router
    this.uiRoot.router.register('splash', this.splashScreen)
    this.uiRoot.router.register('main_menu', this.mainMenuScreen)
    this.uiRoot.router.register('gameplay_hud', this.hudScreen)
    this.uiRoot.router.register('workshop', this.workshopScreen)
    this.uiRoot.router.register('victory_screen', this.victoryScreen)
    this.uiRoot.router.register('defeat_screen', this.defeatScreen)

    // Mount Touch Controls
    this.touchControls = new TouchControls(this.player)

    // 4. Game Loop
    this.loop = new GameLoop(
      (dt) => this.update(dt),
      () => this.render()
    )

    this.bindKeyboardControls()
    this.bindEventBus()
  }

  public async init(): Promise<void> {
    this.setState('BOOT')
    this.splashScreen.setProgress(20, 'ИНИЦИАЛИЗАЦИЯ ДВИЖКА...')

    await physicsWorld.init()
    this.splashScreen.setProgress(50, 'СВЯЗЬ С ПЛАТФОРМОЙ...')

    await playgamaService.initialize()
    this.splashScreen.setProgress(80, 'ГЕНЕРАЦИЯ ГОРОДСКИХ КВАРТАЛОВ...')

    this.generator.reset(this.targetDistance)
    this.splashScreen.setProgress(100, 'ГОТОВО К ДОСТАВКЕ')

    // Start loop
    this.loop.start()

    setTimeout(() => {
      playgamaService.markReady()
      this.setState('MENU')
    }, 400)
  }

  private setState(nextState: GameState): void {
    this.state = nextState
    this.uiRoot.router.handleGameStateChange(nextState)
    events.emit('GAME_STATE_CHANGED', nextState)

    if (nextState === 'PLAYING') {
      this.touchControls.show()
      this.sceneManager.setMenuMode(false)
    } else {
      this.touchControls.hide()
      this.sceneManager.setMenuMode(true)
    }
  }

  public startGame(): void {
    const contract = this.dispatchSystem.getActiveContract()
    this.targetDistance = contract.distance
    this.contractTimeLimit = contract.timeLimit
    this.timeRemaining = contract.timeLimit

    this.generator.reset(this.targetDistance)
    this.player.reset()
    this.integritySystem.reset()
    this.flowSystem.reset()
    this.loop.resetDelta()

    this.setState('PLAYING')
  }

  public pauseGame(): void {
    if (this.state !== 'PLAYING') return
    this.setState('PAUSED')

    showModal({
      title: 'ПЕРЕРЫВ В ДОСТАВКЕ',
      content: 'Курьер переводит дыхание на коньке крыши.',
      confirmText: 'ПРОДОЛЖИТЬ',
      cancelText: 'В МЕНЮ',
      onConfirm: () => {
        this.resumeGame()
      },
      onCancel: () => {
        this.returnToMenu()
      },
    })
  }

  public resumeGame(): void {
    if (this.state !== 'PAUSED') return
    this.loop.resetDelta()
    this.setState('PLAYING')
  }

  public restartGame(): void {
    this.startGame()
  }

  public openWorkshop(): void {
    this.setState('WORKSHOP')
  }

  public returnToMenu(): void {
    this.setState('MENU')
    this.mainMenuScreen.updateContract(this.dispatchSystem.getActiveContract())
  }

  private handleVictory(): void {
    this.setState('VICTORY')
    const payout = this.dispatchSystem.calculatePayout(
      this.timeRemaining,
      this.integritySystem.getIntegrityPercent(),
      this.flowSystem.getTier()
    )
    this.victoryScreen.setData({
      shillings: payout.shillings,
      base: payout.base,
      timeBonus: payout.timeBonus,
      integrityBonus: payout.integrityBonus,
      flowBonus: payout.flowBonus,
      timeRemainingSec: this.timeRemaining,
    })
  }

  private handleDefeat(reason: 'PARCEL_DESTROYED' | 'FALL_TO_STREET' | 'TIME_EXPIRED'): void {
    this.setState('DEFEAT')
    this.defeatScreen.setData({
      reason,
      distanceCovered: this.player.position.z,
      targetDistance: this.targetDistance,
    })
  }

  private update(dt: number): void {
    if (this.state === 'PLAYING') {
      this.timeRemaining = Math.max(0, this.timeRemaining - dt)
      events.emit('TIMER_UPDATED', { timeRemaining: this.timeRemaining })

      if (this.timeRemaining <= 0) {
        this.handleDefeat('TIME_EXPIRED')
        return
      }

      this.entityManager.update(dt)
      this.generator.update(this.player.position.z)
      this.particleSystem.update(dt)

      const gForce = 1.0 + Math.abs(this.player.velocity.y) / 9.81
      this.integritySystem.update(dt, gForce)

      const tiltRad = (this.player.getTiltAngle() * Math.PI) / 180
      this.sceneManager.update(dt, this.player.position, this.player.velocity.z, tiltRad)
      this.sceneManager.updateParcelLightPosition(this.player.position.x, this.player.position.y, this.player.position.z)

      const distPercent = Math.min(100, Math.round((this.player.position.z / this.targetDistance) * 100))
      events.emit('DISTANCE_UPDATED', {
        current: this.player.position.z,
        target: this.targetDistance,
        percent: distPercent,
      })

      // Win / Loss Checks
      if (this.player.position.z >= this.targetDistance) {
        this.handleVictory()
      } else if (this.integritySystem.isDestroyed()) {
        this.handleDefeat('PARCEL_DESTROYED')
      } else if (this.player.state === 'FALL_DEATH') {
        this.handleDefeat('FALL_TO_STREET')
      }
    } else {
      // Menu Mode: Live background scene under reduced load
      this.particleSystem.update(dt * 0.5)
      this.sceneManager.update(dt, this.player.position, 0, 0)
    }
  }

  private render(): void {
    this.sceneManager.render()
  }

  private bindKeyboardControls(): void {
    window.addEventListener('keydown', (e) => {
      if (this.state === 'PLAYING') {
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
          this.player.handleJump()
        } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
          this.player.handleSlide()
        } else if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
          this.player.handleBalanceTilt(-1)
        } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
          this.player.handleBalanceTilt(1)
        } else if (e.code === 'KeyP' || e.code === 'Escape') {
          this.pauseGame()
        }
      }
    })

    window.addEventListener('keyup', (e) => {
      if (this.state === 'PLAYING') {
        if (e.code === 'Space' || e.code === 'ArrowDown') {
          this.player.handleHoldEnd()
        }
      }
    })
  }

  private bindEventBus(): void {
    events.on('GAME_STATE_CHANGED', (state: GameState) => {
      if (state === 'PLAYING') {
        audioManager.ensureContext()
      }
    })

    events.on('PLATFORM_PAUSE_CHANGED', (isPaused: boolean) => {
      if (isPaused && this.state === 'PLAYING') {
        this.pauseGame()
      }
    })

    events.on('REVIVE_TRIGGERED', () => {
      if (this.state === 'DEFEAT') {
        this.player.position.y = 1.0
        this.player.velocity.set(0, 0, 12.0)
        this.player.state = 'RUNNING'
        this.integritySystem.revive()
        this.loop.resetDelta()
        this.setState('PLAYING')
      }
    })
  }
}
