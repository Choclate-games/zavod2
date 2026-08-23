import { DERIVED } from '../config/Balance.js'
import type { SpatialGrid } from '../physics/SpatialGrid.js'

export const ENEMY_CAPACITY = 220

export const EnemyType = {
  Crawler: 0,
  Carapace: 1,
  BioMine: 2,
  Leviathan: 3,
} as const
export type EnemyType = (typeof EnemyType)[keyof typeof EnemyType]

const TYPE_HP = [DERIVED.crawlerHp, DERIVED.carapaceHp, DERIVED.bioMineHp, DERIVED.leviathanHp]
const TYPE_SPEED = [DERIVED.crawlerSpeed, DERIVED.carapaceSpeed, DERIVED.bioMineSpeed, DERIVED.leviathanSpeed]
const TYPE_RADIUS = [0.7, 1.25, 0.9, 3.0]

/**
 * Орда в структуре массивов: до 220 тварей на типизированных буферах,
 * слоты переиспользуются через стек свободных индексов. Ни одной аллокации в кадре.
 */
export class EnemyManager {
  readonly posX = new Float32Array(ENEMY_CAPACITY)
  readonly posZ = new Float32Array(ENEMY_CAPACITY)
  readonly knockX = new Float32Array(ENEMY_CAPACITY)
  readonly knockZ = new Float32Array(ENEMY_CAPACITY)
  readonly hp = new Float32Array(ENEMY_CAPACITY)
  readonly maxHp = new Float32Array(ENEMY_CAPACITY)
  readonly radius = new Float32Array(ENEMY_CAPACITY)
  readonly yaw = new Float32Array(ENEMY_CAPACITY)
  readonly animPhase = new Float32Array(ENEMY_CAPACITY)
  /** Множитель скорости: система света пишет его ДО шага движения. */
  readonly slowFactor = new Float32Array(ENEMY_CAPACITY)
  /** Время непрерывного освещения: после адаптации замедление спадает. */
  readonly litTime = new Float32Array(ENEMY_CAPACITY)
  readonly shockT = new Float32Array(ENEMY_CAPACITY)
  readonly litNow = new Uint8Array(ENEMY_CAPACITY)
  /** Прогрев ядра био-мины узким лучом, секунды непрерывного контакта. */
  readonly catalystHeat = new Float32Array(ENEMY_CAPACITY)
  /** Время запланированной детонации или -1. */
  readonly detonateAt = new Float32Array(ENEMY_CAPACITY)
  readonly atTower = new Uint8Array(ENEMY_CAPACITY)
  readonly attackCooldown = new Float32Array(ENEMY_CAPACITY)
  readonly alive = new Uint8Array(ENEMY_CAPACITY)
  readonly type = new Uint8Array(ENEMY_CAPACITY)

  private readonly freeSlots = new Int32Array(ENEMY_CAPACITY)
  private freeTop = ENEMY_CAPACITY

  constructor() {
    this.slowFactor.fill(1)
    this.detonateAt.fill(-1)
    for (let i = 0; i < ENEMY_CAPACITY; i++) {
      this.freeSlots[i] = ENEMY_CAPACITY - 1 - i
      this.maxHp[i] = 1
      this.radius[i] = TYPE_RADIUS[0]
    }
  }

  get aliveCount(): number {
    let count = 0
    for (let i = 0; i < ENEMY_CAPACITY; i++) count += this.alive[i]
    return count
  }

  reset(): void {
    this.alive.fill(0)
    this.detonateAt.fill(-1)
    this.slowFactor.fill(1)
    for (let i = 0; i < ENEMY_CAPACITY; i++) this.freeSlots[i] = ENEMY_CAPACITY - 1 - i
    this.freeTop = ENEMY_CAPACITY
  }

  spawn(type: EnemyType, angleRad: number, spawnRadius: number): number {
    if (this.freeTop === 0) return -1
    const index = this.freeSlots[--this.freeTop]
    this.alive[index] = 1
    this.type[index] = type
    this.posX[index] = Math.cos(angleRad) * spawnRadius
    this.posZ[index] = Math.sin(angleRad) * spawnRadius
    this.knockX[index] = 0
    this.knockZ[index] = 0
    this.maxHp[index] = TYPE_HP[type]
    this.hp[index] = TYPE_HP[type]
    this.radius[index] = TYPE_RADIUS[type]
    this.yaw[index] = angleRad + Math.PI
    this.animPhase[index] = Math.random() * Math.PI * 2
    this.slowFactor[index] = 1
    this.litTime[index] = 0
    this.shockT[index] = 0
    this.litNow[index] = 0
    this.catalystHeat[index] = 0
    this.detonateAt[index] = -1
    this.atTower[index] = 0
    this.attackCooldown[index] = 0
    return index
  }

  damage(index: number, amount: number): boolean {
    if (!this.alive[index]) return false
    this.hp[index] -= amount
    if (this.hp[index] > 0) return false
    this.alive[index] = 0
    this.freeSlots[this.freeTop++] = index
    return true
  }

  despawn(index: number): void {
    if (!this.alive[index]) return
    this.alive[index] = 0
    this.freeSlots[this.freeTop++] = index
  }

  knockback(index: number, vx: number, vz: number): void {
    this.knockX[index] += vx
    this.knockZ[index] += vz
  }

  setAtTower(index: number): void {
    this.atTower[index] = 1
  }

  rebuildIndex(grid: SpatialGrid): void {
    grid.clear()
    for (let i = 0; i < ENEMY_CAPACITY; i++) {
      if (!this.alive[i]) continue
      grid.insert(i, this.posX[i], this.posZ[i])
    }
  }

  /** Движение к маяку. slowFactor уже записан системой света. */
  step(dt: number): void {
    for (let i = 0; i < ENEMY_CAPACITY; i++) {
      if (!this.alive[i]) continue
      let x = this.posX[i]
      let z = this.posZ[i]
      x += this.knockX[i] * dt
      z += this.knockZ[i] * dt
      this.knockX[i] *= 0.86
      this.knockZ[i] *= 0.86
      const distSq = x * x + z * z || 1
      const dist = Math.sqrt(distSq)
      const nx = -x / dist
      const nz = -z / dist
      const speed = TYPE_SPEED[this.type[i]] * this.slowFactor[i]
      this.yaw[i] = Math.atan2(nx, nz)
      if (!this.atTower[i]) {
        const shockStop = this.shockT[i] > 0 ? 0 : 1
        x += nx * speed * dt * shockStop
        z += nz * speed * dt * shockStop
      } else {
        const cooldown = this.attackCooldown[i] - dt
        this.attackCooldown[i] = cooldown < 0 ? 0 : cooldown
      }
      if (this.shockT[i] > 0) this.shockT[i] -= dt
      this.animPhase[i] += speed * dt * 2.4 + dt * 0.6
      this.posX[i] = x
      this.posZ[i] = z
    }
  }

  tryAttack(index: number, _dt: number): number {
    if (!this.atTower[index]) return 0
    if (this.attackCooldown[index] > 0) return 0
    this.attackCooldown[index] = 1.2
    return DERIVED.enemyContactDamagePerSec * 1.2 * this.scaleByType(index)
  }

  private scaleByType(index: number): number {
    return this.type[index] === 3 ? 3 : this.type[index] === 1 ? 1.6 : 1
  }
}
