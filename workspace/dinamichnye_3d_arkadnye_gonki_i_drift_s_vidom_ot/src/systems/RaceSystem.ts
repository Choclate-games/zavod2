import { balance } from '../data/balance'
import { MILK_WIN_RATIO, INITIAL_MILK_L, type TrackDef } from '../data/tracks'
import type { EventBus } from '../core/EventBus'
import type { PhysicsWorld } from '../physics/PhysicsWorld'
import type { TrackBuilder, TrackData, PathLocation } from '../rendering/TrackBuilder'
import type { PlayerVehicle, VehicleTelemetry } from '../entities/Player'

export type RacePhase = 'countdown' | 'racing' | 'finished' | 'crashed'

/**
 * Петля заезда: обратный отсчёт → спуск с тремя чекпоинтами → финишная
 * весовая рамка. Считает время, дрифт-очки с множителем Фактора Бездны,
 * сохранность молока и условия победы/поражения.
 */
export class RaceSystem {
  phase: RacePhase = 'countdown'
  countdown = 3.999
  time = 0
  volumeL = INITIAL_MILK_L
  driftBank = 0
  driftChain = 0
  edgeMultiplier = 1
  maxEdgeMultiplier = 1
  checkpointIndex = -1
  wrongWayFor = 0
  private lastS = 0
  private prevProgressIndex = 0
  private crashReason: 'fall' | 'rollover' | null = null
  private rolloverTimerAcc = 0

  constructor(
    private readonly bus: EventBus,
    private readonly physics: PhysicsWorld,
    private readonly track: TrackData,
    private readonly builder: TrackBuilder,
    private readonly vehicle: PlayerVehicle,
    private readonly def: TrackDef,
  ) {
    const handles = track.gateHandles
    for (let i = 0; i < handles.length; i++) {
      const gateIdx = i
      physics.registerSensor(handles[gateIdx], () => this.onGate(gateIdx))
    }
  }

  startVolume(): number {
    return INITIAL_MILK_L
  }

  goldTime(): number {
    return this.def.goldTimeS
  }

  private onGate(gateIdx: number): void {
    if (this.phase !== 'racing') return
    if (gateIdx < 3) {
      if (gateIdx !== this.checkpointIndex + 1) return
      this.checkpointIndex = gateIdx
      const delta = this.time - this.def.goldTimeS * (gateIdx + 1) / 4
      this.bus.emit('race:checkpoint', { index: gateIdx + 1, split: this.time, delta })
    } else {
      this.finish()
    }
  }

  begin(): void {
    this.phase = 'racing'
    this.time = 0
    this.lastS = 0
    this.prevProgressIndex = 4
  }

  restart(): void {
    this.phase = 'countdown'
    this.countdown = 3.999
    this.time = 0
    this.volumeL = INITIAL_MILK_L
    this.driftBank = 0
    this.driftChain = 0
    this.edgeMultiplier = 1
    this.maxEdgeMultiplier = 1
    this.checkpointIndex = -1
    this.wrongWayFor = 0
    this.lastS = 0
    this.crashReason = null
    this.prevProgressIndex = 4
  }

  dumpValve(): void {
    this.volumeL = Math.max(0, this.volumeL - balance.valveDumpL)
  }

  spill(dt: number, rollDeg: number): void {
    const critical = balance.criticalRollDeg
    if (rollDeg > critical * 0.8) {
      const excess = (rollDeg - critical * 0.8) / (critical * 0.2)
      this.volumeL = Math.max(0, this.volumeL - balance.spillRateLps * dt * Math.min(2.5, excess))
    }
  }

  /** Тик фиксированного шага. Вызывается только в фазах гонки. */
  update(dt: number, telemetry: VehicleTelemetry, loc: PathLocation): void {
    if (this.phase === 'countdown') {
      this.countdown -= dt
      if (this.countdown <= 0) this.begin()
      return
    }
    if (this.phase !== 'racing') return

    this.time += dt
    this.spill(dt, telemetry.rollDeg)

    // прогресс и разворот назад
    if (loc.index < this.prevProgressIndex && Math.abs(loc.s - this.lastS) > 12) {
      this.wrongWayFor += dt
    } else {
      this.wrongWayFor = 0
      this.lastS = loc.s
      this.prevProgressIndex = loc.index
    }

    // Фактор Бездны: множитель растёт у самой кромки и в заносе
    const dEdge = telemetry.dEdge
    if (dEdge < 1.5) {
      const closeness = Math.max(0, Math.min(1, (1.5 - dEdge) / 1.2))
      this.edgeMultiplier =
        1.0 + closeness * 3.0 * (1.0 + Math.abs(telemetry.slipAngleDeg) / 45.0)
      this.maxEdgeMultiplier = Math.max(this.maxEdgeMultiplier, this.edgeMultiplier)
      // турбо заряжается ездой у кромки, а не ожиданием
      this.vehicle.turboCharge = Math.min(
        1,
        this.vehicle.turboCharge + (balance.turboChargePerSecPct / 100) * dt * closeness,
      )
    } else {
      this.edgeMultiplier = Math.max(1, this.edgeMultiplier - dt * 4)
    }

    // дрифт: честный угол скольжения, очки копятся пропорционально скорости
    const absSlip = Math.abs(telemetry.slipAngleDeg)
    if (telemetry.speedKmh > 30 && absSlip > 12 && absSlip < 50) {
      this.driftChain += (telemetry.speedKmh / 3.6) * absSlip * 0.05 * this.edgeMultiplier * dt
    } else if (absSlip < 8 && this.driftChain > 0) {
      this.bankDrift()
    }
    if (absSlip >= 50 || telemetry.speedKmh < 7) {
      // разворот или остановка обрывают несданную цепочку
      if (this.driftChain > 0) this.driftChain = 0
    }

    // переворот: кузов на боку или крыше дольше секунды — разгерметизация люков
    if (telemetry.rollDeg > balance.criticalRollDeg * 1.6 || this.vehicle.uprightness() < 0.35) {
      this.rolloverTimerAcc += dt
      if (this.rolloverTimerAcc > 1.2) {
        this.volumeL *= 0.45
        this.crash('rollover')
      }
    } else {
      this.rolloverTimerAcc = 0
    }
  }

  bankDrift(): void {
    this.driftBank += this.driftChain
    this.bus.emit('drift:scored', {
      banked: this.driftChain,
      total: this.driftBank,
      multiplier: this.edgeMultiplier,
    })
    this.driftChain = 0
  }

  finish(): void {
    if (this.phase === 'finished') return
    if (this.driftChain > 0) this.bankDrift()
    const result = this.finalScore()
    this.phase = 'finished'
    this.bus.emit('race:finished', result)
  }

  crash(reason: 'fall' | 'rollover'): void {
    if (this.phase === 'crashed' || this.phase === 'finished') return
    if (this.driftChain > 0) this.driftChain = 0
    this.crashReason = reason
    this.phase = 'crashed'
    this.bus.emit('vehicle:crashed', { reason })
  }

  get reason(): 'fall' | 'rollover' | null {
    return this.crashReason
  }

  respawnAtCheckpoint(): void {
    const idx = this.checkpointIndex >= 0 ? this.track.checkpointIndices[this.checkpointIndex] : 4
    this.vehicle.respawn(this.builder, this.track, idx)
    this.phase = 'racing'
    this.crashReason = null
    this.rolloverTimerAcc = 0
    this.bus.emit('respawn', null)
  }

  finalScore(): { time: number; volumeRatio: number; score: number; stars: number; win: boolean } {
    const volumeRatio = this.volumeL / INITIAL_MILK_L
    const win = volumeRatio >= MILK_WIN_RATIO
    const stars = win ? (this.time < this.def.goldTimeS ? 3 : this.time < this.def.silverTimeS ? 2 : 1) : 0
    const basePass = 1000
    const timeBonus = Math.max(0, 1 + (this.def.goldTimeS - this.time) / this.def.goldTimeS)
    const score = win
      ? Math.round((basePass * stars + this.driftBank * this.maxEdgeMultiplier) *
          Math.pow(volumeRatio, 2.5) * timeBonus)
      : 0
    return { time: this.time, volumeRatio, score, stars, win }
  }

  isWrongWay(): boolean {
    return this.wrongWayFor > 1.5
  }
}
