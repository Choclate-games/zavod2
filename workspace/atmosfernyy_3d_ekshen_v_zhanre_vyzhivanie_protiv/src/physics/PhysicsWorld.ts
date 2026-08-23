import { DERIVED } from '../config/Balance.js'
import type { EnemyManager } from '../entities/EnemyManager.js'
import { SpatialGrid } from './SpatialGrid.js'

const GRID_EXTENT = 34
const GRID_RES = 22
const GRID_CELL_CAPACITY = 24

/**
 * Аркадная физика арены: разделение роя по сетке, столкновения с башней,
 * импульсы парового кольца. Полноценный Rapier здесь не нужен: тела двигаются
 * по плоскости управляемой симуляцией, а WASM-движок съел бы больше мегабайта
 * из бюджета 4.5 МБ, чем весь остальной код вместе (решение записано в DEVLOG).
 */
export class PhysicsWorld {
  private readonly grid: SpatialGrid
  private readonly candidates = new Int32Array(256)

  constructor(private readonly enemies: EnemyManager) {
    this.grid = new SpatialGrid(GRID_EXTENT, GRID_RES, GRID_CELL_CAPACITY)
  }

  step(dt: number): void {
    const enemies = this.enemies
    enemies.rebuildIndex(this.grid)
    this.resolveSeparation()
    this.resolveTower()
    void dt
  }

  private resolveSeparation(): void {
    const enemies = this.enemies
    for (let index = 0; index < enemies.alive.length; index++) {
      if (!enemies.alive[index]) continue
      const x = enemies.posX[index]
      const z = enemies.posZ[index]
      const radius = enemies.radius[index]
      const found = this.grid.query(x, z, radius * 2.4, this.candidates)
      for (let c = 0; c < found; c++) {
        const other = this.candidates[c]
        if (other <= index) continue
        const dx = enemies.posX[other] - x
        const dz = enemies.posZ[other] - z
        const minDist = radius + enemies.radius[other]
        const distSq = dx * dx + dz * dz
        if (distSq >= minDist * minDist || distSq < 1e-6) continue
        const dist = Math.sqrt(distSq)
        const push = (minDist - dist) * 0.5
        const nx = dx / dist
        const nz = dz / dist
        enemies.posX[index] -= nx * push
        enemies.posZ[index] -= nz * push
        enemies.posX[other] += nx * push
        enemies.posZ[other] += nz * push
      }
    }
  }

  private resolveTower(): void {
    const enemies = this.enemies
    const towerRadius = DERIVED.enemyAttackRangeM
    for (let index = 0; index < enemies.alive.length; index++) {
      if (!enemies.alive[index]) continue
      const x = enemies.posX[index]
      const z = enemies.posZ[index]
      const distSq = x * x + z * z
      const limit = towerRadius + enemies.radius[index]
      if (distSq > limit * limit || distSq < 1e-6) continue
      const dist = Math.sqrt(distSq)
      const scale = limit / dist
      enemies.posX[index] = x * scale
      enemies.posZ[index] = z * scale
      enemies.atTower[index] = 1
    }
  }

  /** Кольцо пара: импульс от башни наружу с затуханием по расстоянию. */
  applyRadialImpulse(cx: number, cz: number, radius: number, strength: number): void {
    const enemies = this.enemies
    const found = this.grid.query(cx, cz, radius, this.candidates)
    for (let c = 0; c < found; c++) {
      const index = this.candidates[c]
      if (!enemies.alive[index]) continue
      const dx = enemies.posX[index] - cx
      const dz = enemies.posZ[index] - cz
      const dist = Math.sqrt(dx * dx + dz * dz) || 1
      if (dist > radius) continue
      const falloff = 1 - dist / radius
      const impulse = strength * falloff
      enemies.knockback(index, (dx / dist) * impulse, (dz / dist) * impulse)
    }
  }
}
