import { BALANCE } from '../balance'
import type { EntityManager, EnemyEntity } from '../entities/EntityManager'

export class EnemyHordeDirectorSystem {
  private spawnTimer = 2
  private phase = 0

  constructor(private readonly entities: EntityManager) {}

  reset(): void {
    this.spawnTimer = 1.5
    this.phase = 0
  }

  update(dt: number, wave: number, arenaRadius: number, onRingout: () => void, onBlobHit: (force: number) => void): void {
    this.spawnTimer -= dt
    this.phase += dt
    const interval = Math.max(0.72, 2.2 - wave * 0.38)
    if (this.spawnTimer <= 0 && this.entities.countEnemies() < Math.min(BALANCE.maxEnemies, 8 + wave * 7)) {
      this.spawnTimer += interval
      const angle = this.phase * 1.7
      const distance = arenaRadius + 1.8
      const kind = wave >= 3 && this.phase > 18 ? 'rammer' : wave >= 2 && Math.floor(this.phase) % 5 === 0 ? 'leaper' : 'skirmisher'
      this.entities.spawnEnemy(kind, Math.cos(angle) * distance, Math.sin(angle) * distance)
    }
    for (const enemy of this.entities.enemies) {
      if (!enemy.active) continue
      this.updateEnemy(enemy, dt, arenaRadius, onBlobHit)
      if (Math.sqrt(enemy.x * enemy.x + enemy.z * enemy.z) > arenaRadius + 2.2) {
        this.entities.deactivateEnemy(enemy)
        onRingout()
      }
    }
  }

  spawnBoss(arenaRadius: number): void {
    this.entities.spawnEnemy('void_titan', arenaRadius + 1.5, 0)
  }

  private updateEnemy(enemy: EnemyEntity, dt: number, arenaRadius: number, onBlobHit: (force: number) => void): void {
    if (enemy.stunTime > 0) {
      enemy.stunTime -= dt
      enemy.x += enemy.vx * dt
      enemy.z += enemy.vz * dt
      enemy.vx *= 0.94
      enemy.vz *= 0.94
      return
    }
    let target: { x: number; z: number } | null = null
    let nearest = Infinity
    for (const blob of this.entities.blobs) {
      if (!blob.active) continue
      const dx = blob.x - enemy.x
      const dz = blob.z - enemy.z
      const squared = dx * dx + dz * dz
      if (squared < nearest) { nearest = squared; target = blob }
    }
    if (!target) return
    const distance = Math.sqrt(nearest)
    const speed = enemy.kind === 'void_titan' ? 1.05 : enemy.kind === 'rammer' ? 1.85 : enemy.kind === 'leaper' ? 2.15 : 1.25
    if (distance > 1.25) {
      enemy.vx += ((target.x - enemy.x) / Math.max(0.2, distance)) * speed * dt * 3
      enemy.vz += ((target.z - enemy.z) / Math.max(0.2, distance)) * speed * dt * 3
      const velocity = Math.sqrt(enemy.vx * enemy.vx + enemy.vz * enemy.vz)
      if (velocity > speed) { enemy.vx = enemy.vx / velocity * speed; enemy.vz = enemy.vz / velocity * speed }
      enemy.x += enemy.vx * dt
      enemy.z += enemy.vz * dt
    } else {
      onBlobHit(enemy.kind === 'void_titan' ? 2.4 : enemy.kind === 'rammer' ? 1.2 : 0.45)
      enemy.vx = (enemy.x - target.x) * 0.2
      enemy.vz = (enemy.z - target.z) * 0.2
    }
    if (enemy.kind === 'leaper') enemy.phase += dt * 7
    if (enemy.x * enemy.x + enemy.z * enemy.z > (arenaRadius + 3) * (arenaRadius + 3)) enemy.stunTime = 0.2
  }
}
