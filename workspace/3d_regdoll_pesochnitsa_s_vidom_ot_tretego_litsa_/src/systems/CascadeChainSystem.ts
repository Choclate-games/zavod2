import { BALANCE } from '../config/balance.ts'
import { bus } from '../core/EventBus.ts'
import type { BanquetHall } from '../entities/BanquetHall.ts'

interface BlastEvent {
  x: number
  y: number
  z: number
  chandelierMassKg: number
  fallSpeed: number
}

/**
 * Каскадная цепная детонация банкета. У взрыва две зоны: эпицентр с полным
 * импульсом и внешняя с квадратичным спадом:
 * F_blast = (E_impact * 0.65) / (distance + 0.5)^2,
 * E_impact = 0.5 * M_chandelier * V_fall^2.
 */
export class CascadeChainSystem {
  private lastBlastAtSec = -Infinity

  constructor(private readonly hall: BanquetHall) {}

  /** Взрыв торта: радиальный разлёт крема, сбивающий гостей и столы. */
  cakeBlast(x: number, y: number, z: number, chandelierMassKg: number, fallSpeed: number): void {
    const nowSec = performance.now() / 1000
    if (nowSec - this.lastBlastAtSec < 0.12) return
    this.lastBlastAtSec = nowSec
    const radius = BALANCE.cascade.cakeBlastRadius
    const energy = 0.5 * chandelierMassKg * fallSpeed * fallSpeed

    for (const glass of this.hall.glasses) {
      if (glass.broken) continue
      const p = glass.body.translation()
      const d = Math.hypot(p.x - x, p.y - y, p.z - z)
      if (d > radius * 3) continue
      const force = (energy * 0.65) / ((d + 0.5) * (d + 0.5))
      const inv = 1 / Math.max(d, 0.001)
      const strength = Math.min(force * 0.002, 6)
      glass.body.applyImpulse(
        { x: (p.x - x) * inv * strength, y: strength * 0.6, z: (p.z - z) * inv * strength },
        true,
      )
    }

    for (const table of this.hall.tables) {
      const p = table.body.translation()
      const d = Math.hypot(p.x - x, p.z - z)
      if (d > radius) continue
      table.body.lockRotations(false, true)
      const dirX = (p.x - x) / Math.max(d, 0.001)
      const dirZ = (p.z - z) / Math.max(d, 0.001)
      table.body.applyTorqueImpulse({ x: dirZ * 40, y: 0, z: -dirX * 40 }, true)
      bus.emit('damage:item', { source: 'table' })
    }

    bus.emit('cascade:crashPoint', { x, y, z, strength: radius })
    bus.emit('vfx:creamExplosion', { x, y, z })
  }

  /** Импульс ударной волны по телам в радиусе — используется и для люстры об пол. */
  radialPush(event: BlastEvent): void {
    for (const guest of this.hall.guests) {
      const p = guest.body.translation()
      const d = Math.hypot(p.x - event.x, p.z - event.z)
      if (d > BALANCE.crowd.panicTriggerRadius) continue
      const force = (event.chandelierMassKg * event.fallSpeed * 0.65) / ((d + 0.5) * (d + 0.5))
      const impulse = Math.min(force * 0.01, 12)
      const inv = 1 / Math.max(d, 0.001)
      guest.body.applyImpulse(
        { x: (p.x - event.x) * inv * impulse, y: impulse * 0.4, z: (p.z - event.z) * inv * impulse },
        true,
      )
      this.hall.unlockGuestRotation(guest)
      if (impulse >= BALANCE.crowd.npcRagdollThresholdImpulse * 0.02 && guest.state !== 'counted') {
        guest.state = 'counted'
        bus.emit('damage:item', { source: 'guest' })
        bus.emit('guest:bowled', { index: this.hall.guests.indexOf(guest) })
      }
    }
  }
}
