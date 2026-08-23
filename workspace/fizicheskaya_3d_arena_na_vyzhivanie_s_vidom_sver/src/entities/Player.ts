import type RAPIER from '@dimforge/rapier3d-compat'
import { BOOST, DRIFT, MASS, REBOUND } from '../core/Balance'

/**
 * Физический контроллер надувного тюбинга: тяга, ледовый дрифт,
 * реактивный форсаж и ударная волна. Один класс обслуживает и игрока,
 * и ботов — бот выдаёт тот же TubeInput, что и клавиатура с тач-слоем.
 */
export interface TubeInput {
  throttle: number
  steer: number
  boost: boolean
  rebound: boolean
}

const DEG2RAD = Math.PI / 180

function createInput(): TubeInput {
  return { throttle: 0, steer: 0, boost: false, rebound: false }
}

export class Tubing {
  readonly input: TubeInput = createInput()
  body: RAPIER.RigidBody | null = null
  collider: RAPIER.Collider | null = null

  id = 0
  name = 'BOT'
  isPlayer = false
  colorIndex = 0

  kills = 0
  alive = true
  place = 0

  heading = 0
  massKg: number = MASS.baseMassKg
  radiusM: number = MASS.radiusBaseM
  boostFuel: number = BOOST.tankCapacity * 0.5
  boosting = false
  drifting = false
  slipAngleDeg = 0
  private lastReboundAt = -10
  /** Момент последнего тарана этим тюбингом: для зачёта фрага. */
  lastRamTargetId = -1
  lastRamTime = -10
  /** Признак заноса для частиц: интенсивность шлейфа 0..1. */
  sprayIntensity = 0

  reset(x: number, z: number, heading: number): void {
    this.kills = 0
    this.alive = true
    this.place = 0
    this.heading = heading
    this.massKg = MASS.baseMassKg
    this.radiusM = MASS.radiusBaseM
    this.boostFuel = BOOST.tankCapacity * 0.5
    this.boosting = false
    this.drifting = false
    this.sprayIntensity = 0
    this.lastReboundAt = -10
    this.lastRamTargetId = -1
    this.lastRamTime = -10
    const body = this.body
    if (!body) return
    body.setTranslation({ x, y: 1.4, z }, true)
    body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    body.setAngvel({ x: 0, y: 0, z: 0 }, true)
  }

  /**
   * Шаг управления на фиксированном тике. Никаких аллокаций:
   * все векторы читаются в локальные числа.
   */
  update(dt: number): void {
    const body = this.body
    if (!body || !this.alive) return
    const input = this.input
    const v = body.linvel()
    const speed = Math.hypot(v.x, v.z)

    // Занос: угол между вектором скорости и носом корпуса.
    let moveAngle = this.heading
    if (speed > 0.6) moveAngle = Math.atan2(v.x, v.z)
    let diff = moveAngle - this.heading
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    this.slipAngleDeg = Math.abs(diff) / DEG2RAD
    this.drifting = speed > 2.2 && this.slipAngleDeg > DRIFT.slipAngleThresholdDeg
    this.sprayIntensity = this.drifting ? Math.min(1, this.slipAngleDeg / 60) : 0

    // Заряд форсажа в дрифте.
    if (this.drifting) {
      this.boostFuel = Math.min(
        BOOST.tankCapacity,
        this.boostFuel + (this.slipAngleDeg / DRIFT.slipAngleThresholdDeg) * BOOST.rechargeDriftRate * dt,
      )
    }

    // Реактивный форсаж: удержание сжигает баллон.
    this.boosting = input.boost && this.boostFuel > 0.5
    if (this.boosting) {
      const burnPerSecond = BOOST.tankCapacity / BOOST.durationMax
      this.boostFuel = Math.max(0, this.boostFuel - burnPerSecond * dt)
    }

    // Поворот с инерционным штрафом за массу.
    const stacks = Math.max(0, this.kills)
    const turnPenalty = Math.max(0.35, 1 - (MASS.inertiaHandlingPenaltyPct / 100) * stacks)
    const steerAuthority = (input.throttle >= 0 ? 1 : -1) * turnPenalty
    this.heading -= input.steer * 2.6 * steerAuthority * dt * (this.drifting ? 1.35 : 1)

    const sinH = Math.sin(this.heading)
    const cosH = Math.cos(this.heading)

    // Тяга вперёд.
    const targetSpeed = this.boosting ? BOOST.speedMax : BOOST.speedBase
    const thrust = input.throttle * (this.boosting ? 46 : 26) * this.massKg * 0.05
    body.addForce({ x: sinH * thrust, y: 0, z: cosH * thrust }, true)

    // Ледовое трение: боковое гасится по формуле динамического сноса.
    const mu = this.drifting ? DRIFT.frictionDrift : DRIFT.frictionStraight
    const vAlong = v.x * sinH + v.z * cosH
    const vLateralX = v.x - sinH * vAlong
    const vLateralZ = v.z - cosH * vAlong
    const lateralSpeed = Math.hypot(vLateralX, vLateralZ)
    if (lateralSpeed > 0.01) {
      const grip = Math.min(lateralSpeed * mu * this.massKg * 1.2, (lateralSpeed * this.massKg) / dt)
      body.addForce({ x: (-vLateralX / lateralSpeed) * grip, y: 0, z: (-vLateralZ / lateralSpeed) * grip }, true)
    }
    // Продольное сопротивление льда и ограничение скорости вне форсажа.
    const drag = vAlong * this.massKg * (mu * 0.22)
    body.addForce({ x: -sinH * drag, y: 0, z: -cosH * drag }, true)
    if (!this.boosting && speed > targetSpeed * 1.15 && speed > 0.01) {
      const excess = (speed - targetSpeed) * this.massKg * 0.9
      body.addForce({ x: (-v.x / speed) * excess, y: 0, z: (-v.z / speed) * excess }, true)
    }
    if (input.throttle < -0.1) {
      const brake = 30 * this.massKg * 0.06 * Math.sign(vAlong || 1)
      body.addForce({ x: -sinH * brake, y: 0, z: -cosH * brake }, true)
    }
  }

  /** Игрок или бот нажал отскок: открывается окно идеального тайминга. */
  triggerRebound(timeSec: number): void {
    this.lastReboundAt = timeSec
  }

  hasFreshRebound(timeSec: number): boolean {
    return timeSec - this.lastReboundAt <= REBOUND.timingWindowSec
  }

  /** Фраг подтверждён: рост массы и калибра по формулам баланса. */
  absorbKill(): void {
    this.kills++
    this.massKg = Math.min(MASS.maxMassCapKg, MASS.baseMassKg * (1 + (MASS.massGainPerKillPct / 100) * this.kills))
    this.radiusM = MASS.radiusBaseM * (1 + (MASS.scaleGainPerKillPct / 100) * this.kills)
    this.boostFuel = Math.min(BOOST.tankCapacity, this.boostFuel + BOOST.tankCapacity * 0.35)
  }

  die(place: number): void {
    this.alive = false
    this.place = place
    this.boosting = false
    this.input.throttle = 0
    this.input.steer = 0
    this.input.boost = false
    this.input.rebound = false
  }
}

export { createInput }
