import type { PhysicsWorld } from '../physics/PhysicsWorld'
import type { EntityManager } from '../entities/EntityManager'
import type { Tubing } from '../entities/Player'
import { BOOST, MASS, REBOUND } from '../core/Balance'

/**
 * Кинетические тараны: P_impact = (m_a*v_a - m_v*v_v) * k_boost * (1 + 0.085*kills).
 * Ударная волна отскока: F_shockwave(r) = 1650 / max(1, r^1.5) с множителем
 * идеального тайминга. Hitstop и зачёт фрагов живут здесь же.
 */
export class KineticImpulseCollisionSystem {
  /** Секунды замедления времени, накопленные ударом. */
  hitstopRemaining = 0
  shakeIntensity = 0
  private readonly handleToTube = new Map<number, Tubing>()
  private lastContactTime = -10

  constructor(
    physics: PhysicsWorld,
    private readonly entities: EntityManager,
  ) {
    this.physics = physics
  }

  private readonly physics: PhysicsWorld

  build(): void {
    for (let i = 0; i < this.entities.tubes.length; i++) {
      const tube = this.entities.tubes[i]
      if (tube.collider && tube.body) {
        this.handleToTube.set(tube.collider.handle, tube)
      }
    }
    this.physics.onContact = (handleA: number, handleB: number) => this.handleContact(handleA, handleB)
  }

  private handleContact(handleA: number, handleB: number): void {
    const a = this.handleToTube.get(handleA)
    const b = this.handleToTube.get(handleB)
    if (!a || !b || !a.body || !b.body) return
    const timeSec = performance.now() / 1000
    // Окно удара не чаще, чем раз в 0.2 с на пару: контакты сыпятся каждый кадр.
    if (timeSec - this.lastContactTime < 0.2) return
    this.lastContactTime = timeSec

    const va = a.body.linvel()
    const vb = b.body.linvel()
    const ta = a.body.translation()
    const tb = b.body.translation()
    let nx = tb.x - ta.x
    let nz = tb.z - ta.z
    const len = Math.hypot(nx, nz) || 1
    nx /= len
    nz /= len

    // Кто из двоих атакующий: тот, кто сближался быстрее вдоль нормали.
    const relVa = va.x * nx + va.z * nz
    const relVb = vb.x * nx + vb.z * nz
    const attacker = relVa > relVb ? a : b
    const victim = attacker === a ? b : a

    // Идеальный тайминг жертвы: ударная волна разворачивает импульс.
    let victimRebounded = false
    if (victim.hasFreshRebound(timeSec)) {
      victimRebounded = true
      this.applyShockwave(victim, attacker)
    }

    // Импульс тарана по формуле ядра.
    const vAttacker = Math.hypot(va.x, va.z)
    const boostMult = attacker.boosting ? BOOST.multiplier : 1.0
    const killBonus = 1 + MASS.killImpactBonus * attacker.kills
    const impact =
      ((attacker.massKg * vAttacker - victim.massKg * Math.hypot(vb.x, vb.z)) *
        boostMult *
        killBonus) /
      (attacker.massKg + victim.massKg)
    const magnitude = Math.max(0, impact) * (victimRebounded ? REBOUND.perfectTimingMultiplier : 1)

    const body = victim.body
    if (body && magnitude > 0) {
      const dirX = victim === a ? -nx : nx
      const dirZ = victim === a ? -nz : nz
      body.applyImpulse({ x: dirX * magnitude * 0.9, y: magnitude * 0.12, z: dirZ * magnitude * 0.9 }, true)
    }
    // Отдача атакующему — упругий отскок бортов.
    const attackerBody = attacker.body
    if (attackerBody && !victimRebounded) {
      const recoil = magnitude * REBOUND.restitutionCoefficient * 0.35
      attackerBody.applyImpulse({ x: (victim === a ? nx : -nx) * recoil, y: 0, z: (victim === a ? nz : -nz) * recoil }, true)
    } else if (attackerBody) {
      attackerBody.applyImpulse({ x: (victim === a ? -nx : nx) * 6, y: 2, z: (victim === a ? -nz : nz) * 6 }, true)
    }

    attacker.lastRamTargetId = victim.id
    attacker.lastRamTime = timeSec

    // Сок: hitstop 70 мс при сильном ударе, тряска камеры.
    const strength = Math.min(1, magnitude / 60)
    if (strength > 0.25) {
      this.hitstopRemaining = BOOST.impactFreezeFrame
      this.shakeIntensity = Math.max(this.shakeIntensity, strength)
    }
    void strength
  }

  /** Кольцевая ударная волна: радиальный отброс всем в радиусе shockwave_radius_m. */
  applyShockwave(center: Tubing, priorityTarget?: Tubing): void {
    const tc = center.body?.translation()
    if (!tc) return
    const tubes = this.entities.tubes
    for (let i = 0; i < tubes.length; i++) {
      const other = tubes[i]
      if (other === center || !other.alive || !other.body) continue
      const to = other.body.translation()
      const dx = to.x - tc.x
      const dz = to.z - tc.z
      const dist = Math.hypot(dx, dz)
      if (dist > REBOUND.shockwaveRadiusM) continue
      const falloff = REBOUND.shockwaveForceN / Math.max(1, Math.pow(Math.max(dist, 0.4), 1.5))
      const scale = falloff / other.massKg
      other.body.applyImpulse({ x: (dx / dist) * scale, y: scale * 0.25, z: (dz / dist) * scale }, true)
      void priorityTarget
    }
  }

  /**
   * Подтверждение фрага: погибшему назначается место, убийце — масса.
   * Возвращает имя жертвы для killfeed.
   */
  confirmKill(victim: Tubing, place: number): { killerName: string; byPlayer: boolean } | null {
    const tubes = this.entities.tubes
    let killer: Tubing | null = null
    const now = performance.now() / 1000
    for (let i = 0; i < tubes.length; i++) {
      const t = tubes[i]
      if (t.lastRamTargetId === victim.id && now - t.lastRamTime < 4) {
        killer = t
        break
      }
    }
    victim.die(place)
    if (killer && killer.alive) {
      killer.absorbKill()
      return { killerName: killer.name, byPlayer: killer.isPlayer }
    }
    return null
  }

  consumeHitstop(dt: number): number {
    if (this.hitstopRemaining <= 0) return dt
    const taken = Math.min(this.hitstopRemaining, dt)
    this.hitstopRemaining -= taken
    return taken
  }

  decayShake(dt: number): void {
    this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 2.2)
  }
}
