import { BALANCE } from '../config/balance.ts'
import type { BanquetHall, GuestItem } from '../entities/BanquetHall.ts'

interface HazardPoint {
  x: number
  z: number
}

/**
 * Паника банкетной массовки. Гибридный агент: спокойный гость бродит у своего
 * стола; при опасности в радиусе panicTriggerRadius убегает от точки риска;
 * сильный импульс переводит тело в полноценный физический рэгдолл (боулинг).
 */
export class NpcCrowdPanicSystem {
  private readonly hazards: HazardPoint[] = []
  private hazardTimer = 0

  constructor(private readonly hall: BanquetHall) {}

  reportHazard(x: number, z: number): void {
    if (this.hazards.length >= 8) this.hazards.shift()
    this.hazards.push({ x, z })
    this.hazardTimer = 6
  }

  fixedUpdate(dt: number): void {
    if (this.hazardTimer > 0) this.hazardTimer -= dt
    else this.hazards.length = 0

    for (const guest of this.hall.guests) {
      switch (guest.state) {
        case 'calm':
          this.wander(guest)
          break
        case 'fleeing':
        case 'ragdoll':
          this.flee(guest)
          break
        case 'counted':
          break
      }
    }
  }

  private nearestHazard(x: number, z: number): HazardPoint | null {
    let best: HazardPoint | null = null
    let bestDist = Infinity
    for (const h of this.hazards) {
      const d = Math.hypot(h.x - x, h.z - z)
      if (d < bestDist) {
        bestDist = d
        best = h
      }
    }
    return best
  }

  private wander(guest: GuestItem): void {
    const p = guest.body.translation()
    const hazard = this.nearestHazard(p.x, p.z)
    if (hazard && Math.hypot(hazard.x - p.x, hazard.z - p.z) <= BALANCE.crowd.panicTriggerRadius) {
      guest.state = 'fleeing'
      return
    }
    // Спокойное брожение вокруг «своего» места.
    guest.wanderPhase += 0.016
    const targetX = guest.homeX + Math.sin(guest.wanderPhase) * 0.4
    const targetZ = guest.homeZ + Math.cos(guest.wanderPhase * 0.7) * 0.4
    const vx = (targetX - p.x) * 2
    const vz = (targetZ - p.z) * 2
    guest.body.setLinvel({ x: vx, y: p.y > 0.9 ? -0.5 : 0, z: vz }, true)
  }

  private flee(guest: GuestItem): void {
    const p = guest.body.translation()
    const hazard = this.nearestHazard(p.x, p.z)
    if (!hazard) {
      guest.state = 'calm'
      return
    }
    const dx = p.x - hazard.x
    const dz = p.z - hazard.z
    const d = Math.max(Math.hypot(dx, dz), 0.001)
    const speed = 3.2
    guest.body.setLinvel({ x: (dx / d) * speed, y: 0, z: (dz / d) * speed }, true)
    // Цепная давка: бегущий гость толкает соседей.
    for (const other of this.hall.guests) {
      if (other === guest || other.state === 'counted') continue
      const o = other.body.translation()
      const od = Math.hypot(o.x - p.x, o.z - p.z)
      if (od < 0.7 && od > 0.001) {
        other.body.applyImpulse(
          { x: ((o.x - p.x) / od) * BALANCE.crowd.guestChainPushForce * 0.01, y: 0, z: ((o.z - p.z) / od) * BALANCE.crowd.guestChainPushForce * 0.01 },
          true,
        )
      }
    }
  }

  reset(): void {
    this.hazards.length = 0
    this.hazardTimer = 0
  }
}
