import type { EventBus } from './EventBus'
import { Balance } from './Balance'
import {
  DROP_HIT_HALF_LENGTH_M,
  DROP_MAX_ALTITUDE_M,
  FIRES,
  RIVER_HALF_WIDTH_M,
  START_ALTITUDE_M,
} from './MissionLayout'
import type { FlightInput } from '../input/InputHub'
import type { FlightPose, SceneMode } from '../rendering/SceneManager'
import type { HudSnapshotView } from '../ui/screens/GameplayHudScreen'

export interface SceneBridge {
  setMode(mode: SceneMode): void
  setFlightState(pose: FlightPose): void
  setFireExtinguished(index: number): void
  resetFires(): void
  update(frameDt: number): void
}

export interface GameDeps {
  bus: EventBus
  scene: SceneBridge
  input: FlightInput
  onHudUpdate: (snapshot: HudSnapshotView) => void
  onFlightEnd: (score: number, won: boolean) => void
}

/**
 * Координатор состояния и упрощённая модель полёта. Никаких аллокаций в кадре:
 * поза и HUD-снимок переиспользуются, решения принимаются в фиксированном шаге.
 */
export class Game {
  private state: 'MENU' | 'PLAYING' | 'PAUSED' = 'MENU'
  private platformPaused = false

  private altitudeM: number = START_ALTITUDE_M
  private lateralM = 0
  private forwardM = 0
  private speedKmh: number = Balance.cruiseSpeedKmh
  private waterL = 0
  private verticalBoost = 0
  private pitchDeg = 0
  private rollDeg = 0

  private timeLeftSec = Balance.sessionDurationSec
  private score = 0
  private firesOut = 0
  private readonly fireActive: boolean[] = FIRES.map(() => true)

  private readonly pose: FlightPose = {
    altitudeM: START_ALTITUDE_M,
    lateralM: 0,
    forwardM: 0,
    pitchDeg: 0,
    rollDeg: 0,
    speedKmh: Balance.cruiseSpeedKmh,
  }
  private readonly hudView: HudSnapshotView = {
    timeLeft: Balance.sessionDurationSec,
    waterPercent: 0,
    altitudeM: START_ALTITUDE_M,
    score: 0,
    firesOut: 0,
    fireTotal: FIRES.length,
  }

  constructor(private readonly deps: GameDeps) {
    deps.bus.on('platform:pause', (paused) => this.setPlatformPaused(paused))
  }

  get currentState(): 'MENU' | 'PLAYING' | 'PAUSED' {
    return this.state
  }

  startFlight(): void {
    this.altitudeM = START_ALTITUDE_M
    this.lateralM = 0
    this.forwardM = 0
    this.speedKmh = Balance.cruiseSpeedKmh
    this.waterL = 0
    this.verticalBoost = 0
    this.pitchDeg = 0
    this.rollDeg = 0
    this.timeLeftSec = Balance.sessionDurationSec
    this.score = 0
    this.firesOut = 0
    for (let i = 0; i < this.fireActive.length; i++) this.fireActive[i] = true
    this.deps.scene.resetFires()
    this.deps.scene.setMode('FLIGHT')
    this.setState('PLAYING')
  }

  togglePause(): void {
    if (this.state === 'PLAYING') {
      this.setState('PAUSED')
      this.deps.input.dropQueued = false
    } else if (this.state === 'PAUSED') {
      this.setState('PLAYING')
    }
  }

  toMenu(): void {
    this.deps.scene.setMode('MENU')
    this.setState('MENU')
  }

  setPlatformPaused(paused: boolean): void {
    this.platformPaused = paused
  }

  /** Фиксированный шаг 60 Гц. */
  fixedUpdate(dt: number): void {
    if (this.platformPaused) return
    if (this.state !== 'PLAYING') return
    this.stepFlight(dt)
    this.publishPose()
    this.publishHud()
  }

  /** Кадр рендера: сцена анимируется всегда, даже за меню. */
  renderFrame(frameDt: number): void {
    this.deps.scene.update(frameDt)
    if (this.state === 'PLAYING') this.publishHud()
  }

  resetInputAxes(): void {
    const input = this.deps.input
    input.pitch = 0
    input.roll = 0
    input.boost = false
    input.dropQueued = false
  }

  private stepFlight(dt: number): void {
    const input = this.deps.input

    // Инерция тангажа и крена растёт с массой воды (формула из спецификации).
    const massFactor =
      1 + ((this.waterL * 1) / Balance.dryMassKg) * 1.25 * (1 - Balance.pitchInertiaDegradation)
    const responsiveness = 1 / Math.max(1, massFactor)

    this.rollDeg += input.roll * 120 * dt * responsiveness
    const rollLimit = 38 + 22 * responsiveness
    this.rollDeg = clamp(this.rollDeg, rollLimit)
    this.lateralM += Math.sin((this.rollDeg * Math.PI) / 180) * this.speedKmh / 3.6 * dt
    this.lateralM = clamp(this.lateralM, RIVER_HALF_WIDTH_M + 8)

    const targetPitch = -input.pitch * 24 * responsiveness
    this.pitchDeg += (targetPitch - this.pitchDeg) * Math.min(1, dt * 6)

    let climbMs = Math.sin((-this.pitchDeg * Math.PI) / 180) * this.speedKmh / 3.6 * 0.55
    climbMs += this.verticalBoost

    // Глиссирование и водозабор.
    const overRiver = Math.abs(this.lateralM) <= RIVER_HALF_WIDTH_M
    const gliding = overRiver && this.altitudeM >= Balance.glideWindowMinM && this.altitudeM <= Balance.glideWindowMaxM + 0.8
    if (gliding) {
      this.waterL = Math.min(Balance.tankCapacityL, this.waterL + Balance.scoopRateLps * dt)
      this.speedKmh -= Balance.waterDragDecelMs2 * dt * 1.9
      if (input.boost) this.verticalBoost = Math.max(this.verticalBoost, 4)
    }
    this.verticalBoost -= 9.81 * dt
    this.verticalBoost = Math.max(this.verticalBoost, -14)
    this.altitudeM += climbMs * dt + this.verticalBoost * dt * 0.5

    // Тяжёлый борт проседает сильнее.
    this.altitudeM -= (this.waterL / Balance.tankCapacityL) * 5.5 * dt

    // Форсаж и разгон к крейсерской.
    if (input.boost && !gliding) this.speedKmh += Balance.boostSpeedGainKmh / Balance.boostDurationSec * dt
    this.speedKmh += (Balance.cruiseSpeedKmh - this.speedKmh) * Math.min(1, dt * 0.35)
    this.speedKmh = clamp(this.speedKmh, 90, Balance.cruiseSpeedKmh + Balance.boostSpeedGainKmh)

    this.forwardM += this.speedKmh / 3.6 * dt

    if (input.dropQueued) {
      input.dropQueued = false
      this.performDrop()
    }

    this.timeLeftSec -= dt
    const crashed = this.altitudeM < 0.4 || Math.abs(this.lateralM) > RIVER_HALF_WIDTH_M + 7.5
    if (crashed || this.timeLeftSec <= 0) {
      this.finishFlight(false)
      return
    }
    if (this.firesOut >= FIRES.length) {
      this.finishFlight(true)
    }
  }

  private performDrop(): void {
    if (this.waterL < 300) return
    const droppedL = this.waterL
    this.waterL = 0

    // Реактивный вертикальный импульс сброса: Delta_V_y = (M_dropped/M_empty)*9.81*1.35.
    this.verticalBoost += (droppedL / Balance.dryMassKg) * 9.81 * 1.35 + Balance.recoilLiftMs * 0.12

    for (let i = 0; i < FIRES.length; i++) {
      const fire = FIRES[i]
      if (!fire || !this.fireActive[i]) continue
      if (this.altitudeM > DROP_MAX_ALTITUDE_M) break
      const alongRiver = Math.abs(this.forwardM - fire.distanceM) <= DROP_HIT_HALF_LENGTH_M
      const acrossRiver =
        Math.abs(this.lateralM - fire.offsetX) <= Balance.waterImpactWidthM / 2
      if (alongRiver && acrossRiver) {
        this.fireActive[i] = false
        this.firesOut += 1
        this.timeLeftSec += Balance.bonusSecondsPerFire
        this.score +=
          1000 *
          (1 + this.firesOut * 0.5) *
          Math.max(0.5, this.speedKmh / 150) *
          (droppedL >= fire.requiredWaterL ? 1 : 0.4)
        this.deps.scene.setFireExtinguished(i)
      }
    }
  }

  private finishFlight(won: boolean): void {
    this.deps.onFlightEnd(Math.round(this.score), won)
    this.toMenu()
  }

  private publishPose(): void {
    this.pose.altitudeM = this.altitudeM
    this.pose.lateralM = this.lateralM
    this.pose.forwardM = this.forwardM
    this.pose.pitchDeg = this.pitchDeg
    this.pose.rollDeg = this.rollDeg
    this.pose.speedKmh = this.speedKmh
    this.deps.scene.setFlightState(this.pose)
  }

  private publishHud(): void {
    this.hudView.timeLeft = this.timeLeftSec
    this.hudView.waterPercent = (this.waterL / Balance.tankCapacityL) * 100
    this.hudView.altitudeM = this.altitudeM
    this.hudView.score = this.score
    this.hudView.firesOut = this.firesOut
    this.hudView.fireTotal = FIRES.length
    this.deps.onHudUpdate(this.hudView)
  }

  private setState(state: 'MENU' | 'PLAYING' | 'PAUSED'): void {
    if (state === this.state) return
    this.state = state
    this.deps.bus.emit('game:state', state)
  }
}

function clamp(value: number, minOrMax: number, max?: number): number {
  if (max === undefined) return Math.max(-minOrMax, Math.min(minOrMax, value))
  return Math.max(minOrMax, Math.min(max, value))
}
