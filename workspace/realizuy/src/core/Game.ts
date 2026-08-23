import * as THREE from 'three'
import { GameLoop } from './GameLoop'
import { eventBus, GameState, InputScheme } from './EventBus'
import { sceneManager } from '../rendering/SceneManager'
import { physicsWorld } from '../physics/PhysicsWorld'
import { particleSystem } from '../rendering/ParticleSystem'
import { Player } from '../entities/Player'
import { EntityManager } from '../entities/EntityManager'
import { ProceduralModels } from '../rendering/ProceduralModels'
import { TouchControls } from '../ui/TouchControls'
import { uiRoot } from '../ui/UiRoot'
import { MainMenuScreen } from '../ui/screens/MainMenuScreen'
import { HudOverlayScreen } from '../ui/screens/HudOverlayScreen'
import { WorkbenchScreen } from '../ui/screens/WorkbenchScreen'
import { PauseModal } from '../ui/screens/PauseModal'
import { VictoryDefeatScreen } from '../ui/screens/VictoryDefeatScreen'
import { Hud } from '../ui/Hud'
import { playgamaService } from '../platform/PlaygamaService'
import { storageService } from '../platform/StorageService'
import { audioManager } from '../audio/AudioManager'

export class Game {
  private loop: GameLoop
  public state: GameState = 'BOOT'
  public inputScheme: InputScheme = 'desktop'

  public player!: Player
  public entityManager!: EntityManager
  public hud!: Hud
  public touchControls: TouchControls | null = null

  private keysDown = new Set<string>()
  private mouseIsDown = false
  private mouseDownTime = 0

  private currentWave = 1
  public isReviveUsed = false

  constructor() {
    this.loop = new GameLoop(
      (dt) => this.fixedUpdate(dt),
      (alpha, dt) => this.render(alpha, dt),
    )
  }

  public async init(): Promise<void> {
    // 1. Initialize Physics
    await physicsWorld.init()

    // 2. Build 3D Arena Mesh & Particles
    const arenaMesh = ProceduralModels.createArenaMesh()
    sceneManager.scene.add(arenaMesh)
    sceneManager.scene.add(particleSystem.getMesh())

    // 3. Initialize Player & Entity Manager
    this.player = new Player(sceneManager.scene)
    this.entityManager = new EntityManager(sceneManager.scene)

    // 4. Initialize UI Layers & Router
    uiRoot.init()
    this.hud = new Hud()
    uiRoot.hudLayer.appendChild(this.hud.root)

    // Register all screens
    uiRoot.router.register(
      'menu',
      new MainMenuScreen(() => this.startMatch()),
    )
    uiRoot.router.register('game', new HudOverlayScreen())
    uiRoot.router.register(
      'workbench',
      new WorkbenchScreen(
        (earlyBonus) => this.startNextWaveFromWorkbench(earlyBonus),
        (_type) => {},
      ),
    )
    uiRoot.router.register(
      'pause',
      new PauseModal(
        () => this.resumeFromPause(),
        () => this.quitToMenu(),
      ),
    )

    const victoryDefeat = new VictoryDefeatScreen(
      () => this.startMatch(),
      () => this.quitToMenu(),
      () => this.revivePlayer(),
    )
    uiRoot.router.register('victory', victoryDefeat)
    uiRoot.router.register('defeat', victoryDefeat)

    // 5. Setup Input Scheme
    this.setupInputHandling()

    // 6. Setup State Bus
    this.setupStateBus()

    // Start in Menu state
    this.setState('MENU')
    this.loop.start()
  }

  private setupStateBus(): void {
    eventBus.on('GAME_STATE_CHANGED', (newState: GameState) => {
      // Validate every state string
      if (newState === 'BOOT') {
        this.setState('BOOT')
      } else if (newState === 'MENU') {
        this.setState('MENU')
      } else if (newState === 'PLAYING') {
        this.setState('PLAYING')
      } else if (newState === 'PAUSED') {
        this.setState('PAUSED')
      } else if (newState === 'WORKBENCH') {
        this.setState('WORKBENCH')
      } else if (newState === 'VICTORY') {
        this.setState('VICTORY')
      } else if (newState === 'DEFEAT') {
        this.setState('DEFEAT')
      }
    })
  }

  public setState(newState: GameState): void {
    this.state = newState

    switch (newState) {
      case 'BOOT':
        break
      case 'MENU':
        sceneManager.setMenuMode(true)
        this.hud.setVisible(false)
        if (this.touchControls) this.touchControls.setVisible(false)
        uiRoot.router.go('menu')
        break
      case 'PLAYING':
        sceneManager.setMenuMode(false)
        this.hud.setVisible(true)
        if (this.touchControls && this.inputScheme === 'touch') {
          this.touchControls.setVisible(true)
        }
        uiRoot.router.go('game')
        break
      case 'PAUSED':
        if (this.touchControls) this.touchControls.setVisible(false)
        uiRoot.router.go('pause')
        break
      case 'WORKBENCH':
        sceneManager.setMenuMode(true)
        this.hud.setVisible(false)
        if (this.touchControls) this.touchControls.setVisible(false)
        uiRoot.router.go('workbench')
        break
      case 'VICTORY':
        sceneManager.setMenuMode(true)
        this.hud.setVisible(false)
        if (this.touchControls) this.touchControls.setVisible(false)
        const vScreen = (uiRoot.router as any).views?.get('victory') as VictoryDefeatScreen
        if (vScreen) vScreen.setMode(true)
        uiRoot.router.go('victory')
        break
      case 'DEFEAT':
        sceneManager.setMenuMode(true)
        this.hud.setVisible(false)
        if (this.touchControls) this.touchControls.setVisible(false)
        const dScreen = (uiRoot.router as any).views?.get('defeat') as VictoryDefeatScreen
        if (dScreen) dScreen.setMode(false)
        uiRoot.router.go('defeat')
        break
    }
  }

  public startMatch(): void {
    this.currentWave = 1
    this.isReviveUsed = false
    this.player.reset(0, 0)
    this.entityManager.spawnWave(this.currentWave)
    eventBus.emit('WAVE_CHANGED', this.currentWave, this.entityManager.totalWaves)
    this.setState('PLAYING')
  }

  public startNextWaveFromWorkbench(earlyBonus: boolean): void {
    if (earlyBonus) {
      this.player.addCash(50)
    }
    this.currentWave++
    this.player.reset(0, 0)
    this.entityManager.spawnWave(this.currentWave)
    eventBus.emit('WAVE_CHANGED', this.currentWave, this.entityManager.totalWaves)
    this.setState('PLAYING')
  }

  public resumeFromPause(): void {
    this.setState('PLAYING')
  }

  public quitToMenu(): void {
    this.entityManager.clearAll()
    this.setState('MENU')
  }

  public revivePlayer(): void {
    this.isReviveUsed = true
    this.player.hp = Math.round(this.player.maxHp * 0.5)
    eventBus.emit('HP_CHANGED', this.player.hp, this.player.maxHp)

    // Blast wave knocking all nearby enemies away
    this.entityManager.explodeArea(this.player.position, 6.0, 30, this.player)
    this.setState('PLAYING')
  }

  private setupInputHandling(): void {
    const deviceType = playgamaService.getDeviceType()
    this.setInputScheme(deviceType === 'desktop' ? 'desktop' : 'touch')

    // Desktop Keyboard Listeners
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (this.inputScheme !== 'desktop') {
        this.setInputScheme('desktop')
      }

      this.keysDown.add(e.code)

      if (e.code === 'Escape' && this.state === 'PLAYING') {
        this.setState('PAUSED')
      }

      if (e.code === 'Space' && this.state === 'PLAYING') {
        if (!this.player.isChargingKick) {
          this.player.startChargingKick()
          this.mouseDownTime = performance.now()
        }
      }

      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        const move = this.getKeyboardMoveVector()
        this.player.dash(move.x, move.y)
      }
    })

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      this.keysDown.delete(e.code)

      if (e.code === 'Space' && this.state === 'PLAYING') {
        const duration = (performance.now() - this.mouseDownTime) / 1000
        const kickData = this.player.releaseKick(duration)
        if (kickData) {
          this.entityManager.executeSpartanKick(this.player, kickData)
        }
      }
    })

    // Pointer down on canvas for Pointer Lock on desktop only
    sceneManager.canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        if (this.inputScheme !== 'touch') {
          this.setInputScheme('touch')
        }
        return
      }

      if (this.inputScheme === 'desktop' && this.state === 'PLAYING') {
        // Request pointer lock only in desktop mode
        try {
          if (!document.pointerLockElement) {
            sceneManager.canvas.requestPointerLock()
          }
        } catch {}

        if (e.button === 0 && !this.player.isChargingKick) {
          this.mouseIsDown = true
          this.mouseDownTime = performance.now()
          this.player.startChargingKick()
        }
      }
    })

    window.addEventListener('pointerup', (e: PointerEvent) => {
      if (this.mouseIsDown && this.state === 'PLAYING') {
        this.mouseIsDown = false
        const duration = (performance.now() - this.mouseDownTime) / 1000
        const kickData = this.player.releaseKick(duration)
        if (kickData) {
          this.entityManager.executeSpartanKick(this.player, kickData)
        }
      }
    })
  }

  public setInputScheme(scheme: InputScheme): void {
    if (this.inputScheme === scheme && this.touchControls) return
    this.inputScheme = scheme

    if (scheme === 'touch') {
      if (!this.touchControls) {
        this.touchControls = new TouchControls(uiRoot.touchLayer)
      }
      this.touchControls.setVisible(this.state === 'PLAYING')
    } else {
      if (this.touchControls) {
        this.touchControls.destroy()
        this.touchControls = null
      }
    }

    eventBus.emit('INPUT_SCHEME_CHANGED', scheme)
  }

  private getKeyboardMoveVector(): { x: number; y: number } {
    let x = 0
    let y = 0
    if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) y -= 1
    if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) y += 1
    if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) x -= 1
    if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) x += 1
    return { x, y }
  }

  public fixedUpdate(fixedDt: number): void {
    if (this.state !== 'PLAYING') return

    // Step physics
    physicsWorld.step()

    // 1. Gather Input
    let moveX = 0
    let moveY = 0

    if (this.inputScheme === 'touch' && this.touchControls) {
      moveX = this.touchControls.state.moveX
      moveY = this.touchControls.state.moveY

      if (this.touchControls.state.isDashPressed) {
        this.player.dash(moveX, moveY)
      }

      if (this.touchControls.state.isKickPressed) {
        const kickData = this.player.releaseKick(this.touchControls.state.kickHoldDuration)
        if (kickData) {
          this.entityManager.executeSpartanKick(this.player, kickData)
        }
      }
    } else {
      const kb = this.getKeyboardMoveVector()
      moveX = kb.x
      moveY = kb.y
    }

    // 2. Update Player
    this.player.update(fixedDt, moveX, moveY)

    // 3. Update Entities & Collisions
    this.entityManager.update(fixedDt, this.player)

    // 4. Check Wave Clear
    if (this.entityManager.isWaveCleared()) {
      if (this.currentWave >= this.entityManager.totalWaves) {
        // Tournament Victory!
        const data = storageService.getData()
        storageService.save({
          cups: data.cups + 1,
          cash: data.cash + this.player.cash,
        })
        audioManager.play('cash_pickup')
        this.setState('VICTORY')
      } else {
        // Round Clear -> Go to Workbench
        audioManager.play('cash_pickup')
        this.setState('WORKBENCH')
      }
    }
  }

  public render(alpha: number, frameDt: number): void {
    // 1. Update Particles
    particleSystem.update(frameDt)

    // 2. Update Camera (Menu orbit or Follow player)
    if (this.state === 'PLAYING' && this.player) {
      sceneManager.updateCamera(frameDt, this.player.position, this.player.heading)
    } else {
      sceneManager.updateCamera(frameDt)
    }

    // 3. Render Three.js Scene
    sceneManager.render()
  }
}
