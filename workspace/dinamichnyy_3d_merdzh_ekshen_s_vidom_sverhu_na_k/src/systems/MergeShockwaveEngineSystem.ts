import { BALANCE } from '../balance'
import type { BlobEntity, EnemyEntity, EntityManager } from '../entities/EntityManager'
import { PhysicsWorld } from '../physics/PhysicsWorld'

export class MergeShockwaveEngineSystem {
  constructor(private readonly physics: PhysicsWorld, private readonly entities: EntityManager) {}

  update(onMerge: (tier: number, x: number, z: number, radius: number) => void, onRingout: (tier: number) => void): void {
    for (let first = 0; first < this.entities.blobs.length; first += 1) {
      const a = this.entities.blobs[first]
      if (!a.active || a.tier >= BALANCE.maxTier) continue
      for (let second = first + 1; second < this.entities.blobs.length; second += 1) {
        const b = this.entities.blobs[second]
        if (!b.active || b.tier !== a.tier) continue
        const dx = b.x - a.x
        const dz = b.z - a.z
        const distance = Math.sqrt(dx * dx + dz * dz)
        const relativeX = a.vx - b.vx
        const relativeZ = a.vz - b.vz
        const relativeSpeed = Math.sqrt(relativeX * relativeX + relativeZ * relativeZ)
        if (distance > 1.5 || relativeSpeed < BALANCE.mergeVelocityThreshold) continue
        const x = (a.x + b.x) * 0.5
        const z = (a.z + b.z) * 0.5
        const nextTier = a.tier + 1
        const radius = BALANCE.baseShockwaveRadius + (nextTier - 1) * BALANCE.shockwaveRadiusStep
        const impulse = BALANCE.baseShockwaveImpulse * Math.pow(nextTier, 1.45) * (1 + relativeSpeed / 15)
        this.entities.deactivateBlob(a)
        this.entities.deactivateBlob(b)
        const newborn = this.entities.spawnBlob(nextTier, x, z)
        if (newborn) {
          this.physics.reset(newborn.slot, x, z)
          this.physics.applyImpulse(newborn.slot, (a.vx + b.vx) * 0.2, (a.vz + b.vz) * 0.2)
        }
        this.pushEnemies(x, z, radius, impulse, onRingout)
        onMerge(nextTier, x, z, radius)
        return
      }
    }
  }

  private pushEnemies(x: number, z: number, radius: number, impulse: number, onRingout: (tier: number) => void): void {
    for (const enemy of this.entities.enemies) {
      if (!enemy.active) continue
      const dx = enemy.x - x
      const dz = enemy.z - z
      const distance = Math.sqrt(dx * dx + dz * dz)
      if (distance > radius) continue
      const safeDistance = Math.max(0.4, distance)
      const mass = enemy.kind === 'void_titan' ? 220 : enemy.kind === 'rammer' ? 65 : enemy.kind === 'leaper' ? 20 : 8
      const falloff = Math.max(0, 1 - (distance * distance) / (radius * radius))
      const push = impulse * falloff / mass * 0.08
      enemy.vx += (dx / safeDistance) * push
      enemy.vz += (dz / safeDistance) * push
      enemy.stunTime = BALANCE.stunDuration
      if (push > BALANCE.magmaSplashForce / mass * 0.01 || distance < 0.8) {
        enemy.x += (dx / safeDistance) * push * 0.3
        enemy.z += (dz / safeDistance) * push * 0.3
      }
      if (Math.sqrt(enemy.x * enemy.x + enemy.z * enemy.z) > BALANCE.initialArenaDiameter / 2 + 1) {
        this.entities.deactivateEnemy(enemy)
        onRingout(1)
      }
    }
  }
}
