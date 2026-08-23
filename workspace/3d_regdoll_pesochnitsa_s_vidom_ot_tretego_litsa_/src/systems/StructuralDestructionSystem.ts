import { BALANCE } from '../config/balance.ts'
import { bus } from '../core/EventBus.ts'
import type { Stuntman } from '../entities/Stuntman.ts'
import type { BanquetHall } from '../entities/BanquetHall.ts'

/**
 * Расчёт механических напряжений в подвесах люстр.
 * BreakStress = (m * V * cos(theta)) / A, нормировано так, что порог
 * jointBreakForce достигается при V_impact >= 15 м/с для массы 80 кг
 * при фронтальном ударе (theta -> 0).
 */
export class StructuralDestructionSystem {
  private readonly stuntmanHandles = new Set<number>()
  private readonly cableToChandelier = new Map<number, number>()
  private readonly chandelierHandles = new Map<number, number>()
  private readonly tierHandles = new Map<number, number>()

  constructor(
    private readonly stuntman: Stuntman,
    private readonly hall: BanquetHall,
  ) {
    for (const part of this.stuntman.parts.values()) {
      this.stuntmanHandles.add(part.collider.handle)
    }
    this.hall.chandeliers.forEach((chandelier, index) => {
      this.cableToChandelier.set(chandelier.cableCollider.handle, index)
      this.chandelierHandles.set(chandelier.body.handle, index)
    })
    this.hall.tiers.forEach((tier, index) => {
      this.tierHandles.set(tier.body.handle, index)
    })
  }

  /** Вызывается для каждого события столкновения после world.step(). */
  processEvent(a: number, b: number, started: boolean): void {
    if (!started) return

    // Таран троса телом каскадёра.
    if (this.stuntmanHandles.has(a) && this.cableToChandelier.has(b)) {
      this.trySnap(this.cableToChandelier.get(b) as number)
    } else if (this.stuntmanHandles.has(b) && this.cableToChandelier.has(a)) {
      this.trySnap(this.cableToChandelier.get(a) as number)
    }

    // Люстра врезалась в ярус торта — запускаем взрыв крема.
    let chandelierIndex: number | undefined
    let tierIndex: number | undefined
    if (this.chandelierHandles.has(a) && this.tierHandles.has(b)) {
      chandelierIndex = this.chandelierHandles.get(a)
      tierIndex = this.tierHandles.get(b)
    } else if (this.chandelierHandles.has(b) && this.tierHandles.has(a)) {
      chandelierIndex = this.chandelierHandles.get(b)
      tierIndex = this.tierHandles.get(a)
    }
    if (chandelierIndex !== undefined && tierIndex !== undefined) {
      const tier = this.hall.tiers[tierIndex]
      if (tier && !tier.smashed) {
        const body = tier.body
        const lv = body.linvel()
        const impactSpeed = Math.hypot(lv.x, lv.y, lv.z)
        tier.smashed = true
        bus.emit('cascade:cakeSmash', {
          x: body.translation().x,
          y: body.translation().y,
          z: body.translation().z,
          speed: impactSpeed,
          tier: tierIndex,
        })
      }
    }

    // Люстра ударилась об пол — точка паники массовки.
    if (this.chandelierHandles.has(a) || this.chandelierHandles.has(b)) {
      const idx = this.chandelierHandles.has(a) ? this.chandelierHandles.get(a) : this.chandelierHandles.get(b)
      const chandelier = idx !== undefined ? this.hall.chandeliers[idx] : undefined
      if (chandelier && chandelier.snapped) {
        const p = chandelier.body.translation()
        bus.emit('cascade:crashPoint', { x: p.x, y: p.y, z: p.z, strength: 1 })
      }
    }
  }

  private trySnap(chandelierIndex: number): void {
    const v = this.stuntman.speed()
    // cos(theta): проекция скорости на горизонталь удара — чем фронтальнее,
    // тем больше переданная энергия.
    const vel = this.stuntman.velocity()
    const horizontal = Math.hypot(vel.x, vel.z)
    const speed = Math.max(v, 0.001)
    const cosTheta = horizontal / speed
    if (speed < BALANCE.cable.snapVelocityThreshold) {
      bus.emit('cable:tooSlow', undefined)
      return
    }
    // BreakStress = m*V*cos(theta)/A, нормировано к jointBreakForce при
    // V == impactVelocityRequirement и фронтальном ударе.
    const breakStress = BALANCE.cable.jointBreakForce * ((speed * cosTheta) / BALANCE.launch.impactVelocityRequirement)
    if (breakStress < BALANCE.cable.jointBreakForce) {
      bus.emit('cable:tooSlow', undefined)
      return
    }
    if (!this.hall.snapChandelier(chandelierIndex)) return
    const chandelier = this.hall.chandeliers[chandelierIndex]
    if (!chandelier) return
    bus.emit('cable:snapped', {
      index: chandelierIndex,
      x: chandelier.anchor.x,
      y: chandelier.anchor.y - 0.8,
      z: chandelier.anchor.z,
      speed,
    })
  }
}

