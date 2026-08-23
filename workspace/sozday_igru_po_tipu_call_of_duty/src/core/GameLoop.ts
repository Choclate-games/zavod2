import { SceneManager } from '../rendering/SceneManager'
import { PhysicsWorld } from '../physics/PhysicsWorld'
import { BallisticsManager } from '../game/BallisticsManager'
import { GameManager } from '../game/GameManager'
import { InputManager } from '../input/InputManager'

export class GameLoop {
  private static instance: GameLoop
  private isRunning = false
  private lastTime = 0
  private accumulator = 0
  private readonly FIXED_TIMESTEP = 1 / 60
  private readonly MAX_FRAME_TIME = 0.1

  public static getInstance(): GameLoop {
    if (!GameLoop.instance) {
      GameLoop.instance = new GameLoop()
    }
    return GameLoop.instance
  }

  public start(): void {
    if (this.isRunning) return
    this.isRunning = true
    this.lastTime = performance.now()
    this.accumulator = 0
    requestAnimationFrame((t) => this.tick(t))
  }

  public stop(): void {
    this.isRunning = false
  }

  public resetAccumulator(): void {
    this.accumulator = 0
    this.lastTime = performance.now()
  }

  private tick(currentTime: number): void {
    if (!this.isRunning) return

    let frameTime = (currentTime - this.lastTime) / 1000
    this.lastTime = currentTime

    if (frameTime > this.MAX_FRAME_TIME) {
      frameTime = this.MAX_FRAME_TIME
    }
    this.accumulator += frameTime

    const scene = SceneManager.getInstance()
    const physics = PhysicsWorld.getInstance()
    const ballistics = BallisticsManager.getInstance()
    const game = GameManager.getInstance()
    const input = InputManager.getInstance()

    // 1. Process Input Aiming
    const aimDelta = input.consumeAimDelta()
    if (aimDelta.x !== 0 || aimDelta.y !== 0) {
      scene.setAimOffset(aimDelta.x, aimDelta.y)
    }

    const aimPos = scene.getAimPosition()
    const cameraPos = scene.getCameraPosition()

    // 2. Process Input Firing
    if (input.isFireHeld() && game.getState() === 'PLAYING') {
      ballistics.fire(cameraPos, aimPos)
    }

    // 3. Fixed Step Physics & Systems
    while (this.accumulator >= this.FIXED_TIMESTEP) {
      physics.step()
      ballistics.update(this.FIXED_TIMESTEP, cameraPos, aimPos)
      game.update(this.FIXED_TIMESTEP, aimPos)
      this.accumulator -= this.FIXED_TIMESTEP
    }

    // 4. Update scene visual interpolation and render
    scene.update(frameTime, currentTime / 1000)
    scene.render(currentTime / 1000)

    requestAnimationFrame((t) => this.tick(t))
  }
}

export const gameLoop = GameLoop.getInstance()
