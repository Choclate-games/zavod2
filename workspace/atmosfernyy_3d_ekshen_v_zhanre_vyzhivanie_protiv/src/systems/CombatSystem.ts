import type { Balance } from '../config/Balance.js'
import { DERIVED } from '../config/Balance.js'
import type { EventBus } from '../core/EventBus.js'
import { ENEMY_CAPACITY, EnemyType, type EnemyManager } from '../entities/EnemyManager.js'
import { wrapAngle, type LensSystem } from './LensSystem.js'

/**
 * Попадание светового конуса, световой стаггер с адаптацией, прожиг фокусом
 * и цепной катализ био-мин. Порядок в кадре: свет -> движение -> детонации.
 */
export class CombatSystem {
  /** Твари, уничтоженные взрывами: множитель финального счёта вахты. */
  chainKills = 0

  private readonly staggerFactorWide: number
  private readonly shockDuration: number
  private readonly adaptationTime: number
  private readonly adaptationFadeSec = 2
  private readonly catalystTime: number
  private readonly blastRadius: number
  private readonly blastDamage: number
  private readonly beamLength = DERIVED.beamLengthM
  private now = 0
  private readonly nearby = new Int32Array(ENEMY_CAPACITY)

  constructor(
    private readonly enemies: EnemyManager,
    private readonly lens: LensSystem,
    private readonly events: EventBus,
    balance: Balance,
  ) {
    this.staggerFactorWide = (balance.get('koeffitsient_zamedleniya_v_shirokom_svete') || 65) / 100
    this.shockDuration = balance.get('dlitelnost_stagger_shoka_pri_pervom_kasanii_sveta')
    this.adaptationTime =
      balance.get('vremya_adaptatsii_k_svetu_spad_effekta') || DERIVED.lightAdaptationTimeSec
    this.catalystTime = balance.get('vremya_termicheskogo_kataliza_yadra_bio_miny')
    this.blastRadius = balance.get('bazovyy_radius_biodetonatsii')
    this.blastDamage = balance.get('radialnyy_uron_vzryva_bio_miny')
  }

  reset(): void {
    this.chainKills = 0
    this.now = 0
  }

  update(dt: number): void {
    this.now += dt
    const enemies = this.enemies
    const lens = this.lens
    const halfAngle = lens.angleRad * 0.5
    for (let i = 0; i < ENEMY_CAPACITY; i++) {
      if (!enemies.alive[i]) continue
      const dx = enemies.posX[i]
      const dz = enemies.posZ[i]
      const distSq = dx * dx + dz * dz
      const dist = Math.sqrt(distSq)
      const inCone = Math.abs(wrapAngle(Math.atan2(dz, dx) - lens.yaw)) <= halfAngle
      const lit = inCone && dist <= this.beamLength + enemies.radius[i]

      let slow: number
      if (lit) {
        if (!enemies.litNow[i] && enemies.shockT[i] <= 0) {
          enemies.shockT[i] = this.shockDuration
        }
        enemies.litTime[i] += dt
        if (lens.isFocus) {
          slow = 1 - DERIVED.narrowStaggerFactor
          this.applyFocus(i, dt)
        } else {
          const overAdapted = Math.max(0, enemies.litTime[i] - this.adaptationTime)
          const fade = Math.min(1, overAdapted / this.adaptationFadeSec)
          slow = 1 - this.staggerFactorWide * (1 - fade)
          if (enemies.shockT[i] > 0) slow *= 0.1
        }
        enemies.litNow[i] = 1
      } else {
        enemies.litNow[i] = 0
        enemies.litTime[i] = Math.max(0, enemies.litTime[i] - dt * 2)
        if (!lens.isFocus) {
          enemies.catalystHeat[i] = Math.max(0, enemies.catalystHeat[i] - dt * 2)
        }
        // Задержка восстановления скорости после выхода из луча.
        const recovery = Math.min(1, dt / DERIVED.staggerRecoveryDelaySec)
        slow = enemies.slowFactor[i] + (1 - enemies.slowFactor[i]) * recovery
      }
      // Свет пишет замедление ДО шага движения.
      enemies.slowFactor[i] = slow

      if (enemies.detonateAt[i] >= 0 && enemies.detonateAt[i] <= this.now) {
        enemies.detonateAt[i] = -1
        this.detonate(i)
      }
    }
  }

  private applyFocus(index: number, dt: number): void {
    const enemies = this.enemies
    let damage = this.lens.dps * dt
    if (enemies.type[index] === EnemyType.Leviathan) damage *= 0.5
    else if (enemies.type[index] === EnemyType.Carapace) damage *= 0.7
    if (enemies.damage(index, damage)) {
      this.events.emit('fx:vaporize', {
        x: enemies.posX[index],
        z: enemies.posZ[index],
        armored: enemies.type[index] !== EnemyType.Crawler,
      })
      return
    }
    if (enemies.type[index] === EnemyType.BioMine && enemies.detonateAt[index] < 0) {
      enemies.catalystHeat[index] += dt
      if (enemies.catalystHeat[index] >= this.catalystTime) {
        enemies.detonateAt[index] = this.now
      }
    }
  }

  /**
   * Радиальный урон цепной биодетонации: Blast(r) = Max * max(0, 1 - r/R).
   * Соседняя мина при уроне выше порога детонирует с задержкой волны.
   */
  private detonate(sourceIndex: number): void {
    const enemies = this.enemies
    if (!enemies.alive[sourceIndex]) return
    const sx = enemies.posX[sourceIndex]
    const sz = enemies.posZ[sourceIndex]
    enemies.despawn(sourceIndex)
    this.events.emit('fx:blast', { x: sx, z: sz })

    let blastKills = 1
    const found = this.queryRadius(sx, sz, this.blastRadius)
    for (let c = 0; c < found; c++) {
      const index = this.nearby[c]
      if (!enemies.alive[index]) continue
      const dx = enemies.posX[index] - sx
      const dz = enemies.posZ[index] - sz
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist > this.blastRadius) continue
      const damage = this.blastDamage * Math.max(0, 1 - dist / this.blastRadius)
      if (enemies.type[index] === EnemyType.BioMine && damage > DERIVED.blastChainDamageThreshold) {
        if (enemies.detonateAt[index] < 0) enemies.detonateAt[index] = this.now + DERIVED.blastChainDelaySec
        continue
      }
      if (enemies.damage(index, damage)) {
        blastKills += 1
        this.events.emit('fx:vaporize', {
          x: enemies.posX[index],
          z: enemies.posZ[index],
          armored: enemies.type[index] === EnemyType.Carapace,
        })
      }
    }

    if (blastKills > 1) {
      this.chainKills += blastKills - 1
      for (let k = 1; k < blastKills; k++) this.lens.registerChainKill()
      this.events.emit('world:combo', { count: blastKills })
      this.events.emit('fx:shake', { power: Math.min(1, 0.25 + blastKills * 0.08) })
    }
  }

  private queryRadius(x: number, z: number, radius: number): number {
    const enemies = this.enemies
    let found = 0
    const radiusSq = radius * radius
    for (let i = 0; i < ENEMY_CAPACITY; i++) {
      if (!enemies.alive[i]) continue
      const dx = enemies.posX[i] - x
      const dz = enemies.posZ[i] - z
      if (dx * dx + dz * dz <= radiusSq) {
        this.nearby[found++] = i
        if (found >= this.nearby.length) break
      }
    }
    return found
  }
}
