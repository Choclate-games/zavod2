import { BALANCE } from '../generated/balanceValues'
import { EventBus } from './EventBus'
import { GameLoop } from './GameLoop'
import type { SceneManager } from '../rendering/SceneManager'
import type { InputRouter } from '../input/InputRouter'

/** Состояния игры. Отправляется в шину и разбирается интерфейсом. */
export const GameState = {
  BOOT: 'BOOT',
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  RESULTS: 'RESULTS',
} as const
export type GameState = (typeof GameState)[keyof typeof GameState]

/** Темы шины. */
export const GameTopic = {
  stateChanged: 'stateChanged',
  contractTick: 'contractTick',
} as const

interface GameEvents {
  [GameTopic.stateChanged]: GameState
  [GameTopic.contractTick]: { elapsed: number; waveTimeLeft: number }
}

export const bus = new EventBus<GameEvents>()

/**
 * Координатор игры: владеет циклом, сценой, вводом и состоянием.
 * Площадки здесь нет — платформенные события приходят через main.ts.
 */
export class Game {
  private loop: GameLoop
  private scene: SceneManager
  private input: InputRouter
  private state: GameState = GameState.BOOT
  private contractElapsed = 0
  // Переиспользуемый payload тика: цикл не аллоцирует.
  private readonly tickPayload = { elapsed: 0, waveTimeLeft: 0 }

  constructor(scene: SceneManager, input: InputRouter) {
    this.scene = scene
    this.input = input
    this.loop = new GameLoop(
      BALANCE.performance.target_fps,
      (dt) => this.update(dt),
      () => this.render(),
    )
  }

  getState(): GameState {
    return this.state
  }

  enterMenu(): void {
    this.setState(GameState.MENU)
    this.scene.setMenuCamera(true)
  }

  startContract(): void {
    this.contractElapsed = 0
    this.scene.setMenuCamera(false)
    this.setState(GameState.PLAYING)
    this.loop.resetDelta()
    this.loop.start()
  }

  pause(): void {
    if (this.state !== GameState.PLAYING) return
    this.setState(GameState.PAUSED)
  }

  resume(): void {
    if (this.state !== GameState.PAUSED) return
    this.loop.resetDelta()
    this.setState(GameState.PLAYING)
  }

  /** Полная остановка цикла: сворачивание вкладки или пауза площадки. */
  suspend(): void {
    this.loop.stop()
    this.input.releaseAll()
  }

  stop(): void {
    this.loop.stop()
  }

  private setState(next: GameState): void {
    if (this.state === next) return
    this.state = next
    bus.emit(GameTopic.stateChanged, next)
  }

  private update(dt: number): void {
    this.scene.update(dt)
    if (this.state !== GameState.PLAYING) return
    // Пока контракт идёт — копим время; полный контракт появится в фазе петли.
    this.contractElapsed += dt
    const waveLength = BALANCE.mechanics.pamyat_perekrytiy.parameters.dlitelnost_pervoy_volny.value
    this.tickPayload.elapsed = this.contractElapsed
    this.tickPayload.waveTimeLeft = waveLength - (this.contractElapsed % waveLength)
    bus.emit(GameTopic.contractTick, this.tickPayload)
    const move = this.input.moveAxis()
    this.scene.movePlayer(move.x, move.y, dt)
  }

  private render(): void {
    this.scene.render()
  }
}
