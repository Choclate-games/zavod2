import type { EventBus } from '../core/EventBus'
import type { EntityManager } from '../entities/EntityManager'
import type { Tubing } from '../entities/Player'
import type { IceArenaFracturingSystem } from './IceArenaFracturingSystem'

import { ICE, MATCH } from '../core/Balance'
import type { KineticImpulseCollisionSystem } from './KineticImpulseCollisionSystem'

/**
 * Режиссёр матча: таймер раунда, расписание расколов колец, порядок выбывания,
 * условия победы и поражения, оффер ревайва и награды.
 */
export type MatchPhase = 'IDLE' | 'COUNTDOWN' | 'PLAYING' | 'ROUND_OVER'

const OUTER_COLLAPSE_START = 18
const OUTER_COLLAPSE_STEP = 2.6
const INNER_COLLAPSE_START = 42
const INNER_COLLAPSE_STEP = 5.5
const FINAL_PLATES = 2

export class MatchDirectorLeagueSystem {
  phase: MatchPhase = 'IDLE'
  elapsed = 0
  countdown = 0
  private outerCollapsed = 0
  private innerCollapsed = 0
  private nextCollapseAt = 0
  private reviveOffered = false
  private revivePending = false
  private readonly diedBuffer: Tubing[] = []

  constructor(
    private readonly bus: EventBus,
    private readonly entities: EntityManager,
    private readonly arena: IceArenaFracturingSystem,
    private readonly collisions: KineticImpulseCollisionSystem,
  ) {}

  startMatch(): void {
    this.phase = 'COUNTDOWN'
    this.elapsed = 0
    this.countdown = MATCH.countdownSeconds
    this.outerCollapsed = 0
    this.innerCollapsed = 0
    this.nextCollapseAt = OUTER_COLLAPSE_START
    this.reviveOffered = false
    this.revivePending = false
    this.emitPhase()
  }

  toIdle(): void {
    this.phase = 'IDLE'
    this.emitPhase()
  }

  update(dt: number): void {
    switch (this.phase) {
      case 'COUNTDOWN': {
        const before = Math.ceil(this.countdown)
        this.countdown -= dt
        const after = Math.ceil(this.countdown)
        if (after !== before && after > 0) {
          this.bus.emit('hud:countdown', { label: String(after) })
        }
        if (this.countdown <= 0) {
          this.phase = 'PLAYING'
          this.bus.emit('hud:countdown', { label: 'GO' })
          this.emitPhase()
        }
        break
      }
      case 'PLAYING': {
        this.elapsed += dt
        this.bus.emit('hud:timer', { seconds: Math.floor(this.elapsed) })
        this.scheduleCollapses()
        // Гидродинамика и гибель.
        this.entities.updateHydrodynamics(this.diedBuffer)
        for (let i = 0; i < this.diedBuffer.length; i++) {
          const victim = this.diedBuffer[i]
          const settled = this.countSettled()
          const place = Math.max(2, this.entities.tubes.length - settled + 1)
          const killInfo = this.collisions.confirmKill(victim, place)
          this.bus.emit('tube:killed', {
            victim: victim.name,
            killer: killInfo ? killInfo.killerName : 'ОКЕАН',
            byPlayer: killInfo ? killInfo.byPlayer : false,
          })
          if (victim.isPlayer && !this.reviveOffered && this.aliveTubesCount() >= MATCH.reviveMinAlive) {
            this.reviveOffered = true
            this.revivePending = true
            this.bus.emit('revive:offer', { alive: this.aliveTubesCount() })
          }
        }
        // Победа / поражение.
        const alive = this.aliveTubesCount()
        this.bus.emit('hud:survivors', { count: alive })
        const player = this.entities.player
        if (alive <= 1 && player.alive) {
          this.finish(1, true)
        } else if (!player.alive && !this.revivePending && alive > 1) {
          this.finish(player.place || alive + 1, false)
        } else if (alive === 1 && !player.alive) {
          this.finish(player.place || 2, false)
        }
        break
      }
      default:
        break
    }
  }

  /** Расписание обрушений: внешнее кольцо, затем внутреннее до FINAL_PLATES. */
  private scheduleCollapses(): void {
    if (this.elapsed >= this.nextCollapseAt) {
      const collapsed = this.collapseNextPlate()
      if (collapsed) {
        if (this.innerCollapsed === 0 && this.outerCollapsed < ICE.outerSegments) {
          this.nextCollapseAt = Math.max(this.nextCollapseAt + OUTER_COLLAPSE_STEP, OUTER_COLLAPSE_START)
        }
      } else {
        this.nextCollapseAt += ICE.ringCollapseInterval
      }
    }
    // Вторая волна: внутренние плиты.
    if (this.elapsed >= INNER_COLLAPSE_START && this.remainingStablePlates() > FINAL_PLATES) {
      if (this.elapsed >= this.innerWaveAt()) {
        const collapsedInner = this.collapseNextInnerPlate()
        if (collapsedInner) {
          this.innerCollapsed++
        }
      }
    }
  }

  private innerWaveAt(): number {
    return INNER_COLLAPSE_START + this.innerCollapsed * INNER_COLLAPSE_STEP
  }

  private collapseNextPlate(): boolean {
    for (let i = 0; i < this.arena.plates.length; i++) {
      const plate = this.arena.plates[i]
      if (plate.ring === 1 && !plate.sinking && !plate.sunk) {
        this.arena.collapse(plate.index)
        this.outerCollapsed++
        this.bus.emit('arena:collapse', { index: plate.index })
        return true
      }
    }
    return false
  }

  private collapseNextInnerPlate(): boolean {
    const stable = this.stableInnerIndices()
    if (stable.length <= FINAL_PLATES) return false
    // Тонет плита с наибольшим индексом — визуально по кругу.
    const target = stable[stable.length - 1]
    this.arena.collapse(target)
    this.bus.emit('arena:collapse', { index: target })
    return true
  }

  private stableInnerIndices(): number[] {
    const out: number[] = []
    for (let i = 0; i < this.arena.plates.length; i++) {
      const plate = this.arena.plates[i]
      if (plate.ring === 0 && !plate.sinking && !plate.sunk) out.push(plate.index)
    }
    return out
  }

  remainingStablePlates(): number {
    let count = 0
    for (let i = 0; i < this.arena.plates.length; i++) {
      const plate = this.arena.plates[i]
      if (!plate.sinking && !plate.sunk) count++
    }
    return count
  }

  /** Возврат игрока на центральный лёд за rewarded (Ледовое Спасение). */
  grantRevive(): void {
    const player = this.entities.player
    player.alive = true
    player.reset(0, 0, 0)
    this.revivePending = false
    this.bus.emit('revive:used', { ok: true })
  }

  declineRevive(): void {
    this.revivePending = false
    const player = this.entities.player
    if (!player.alive) {
      this.finish(player.place || this.aliveTubesCount() + 1, false)
    }
  }

  isRevivePending(): boolean {
    return this.revivePending
  }

  private finish(place: number, won: boolean): void {
    this.phase = 'ROUND_OVER'
    this.emitPhase()
    let trophies: number = MATCH.trophiesOther
    if (place === 1) trophies = MATCH.trophiesWin
    else if (place === 2) trophies = MATCH.trophiesSecond
    else if (place === 3) trophies = MATCH.trophiesThird
    const player = this.entities.player
    const coins = player.kills * MATCH.coinsPerKill + (won ? MATCH.coinsWinBonus : 0)
    this.bus.emit('match:over', { place, trophies, coins, survived: won })
  }

  private countSettled(): number {
    let dead = 0
    for (let i = 0; i < this.entities.tubes.length; i++) {
      if (!this.entities.tubes[i].alive) dead++
    }
    return dead
  }

  private aliveTubesCount(): number {
    return this.entities.countAlive()
  }

  private emitPhase(): void {
    this.bus.emit('match:phase', { value: this.phase })
  }
}
