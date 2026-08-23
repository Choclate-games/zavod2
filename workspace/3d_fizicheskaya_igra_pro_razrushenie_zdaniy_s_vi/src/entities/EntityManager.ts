import type { LevelSpec } from '../core/levels'
import type { PhysicsWorld } from '../physics/PhysicsWorld'
import { Building } from './Building'

/**
 * Пул сущностей уровня: здания создаются один раз на уровень и телепортируются
 * при рестарте; обломки живут в фиксированном бюджете и убираются по таймеру.
 */
export class EntityManager {
  buildings: Building[] = []
  private readonly debrisAges: Float32Array
  debrisCount = 0

  constructor(
    private readonly physics: PhysicsWorld,
    debrisBudget: number,
  ) {
    this.debrisAges = new Float32Array(debrisBudget)
  }

  loadLevel(spec: LevelSpec): void {
    this.unloadLevel()
    for (const buildingSpec of spec.buildings) {
      const handle = this.physics.createStanding(buildingSpec)
      this.buildings.push(new Building(buildingSpec, handle))
    }
  }

  unloadLevel(): void {
    for (const building of this.buildings) this.physics.removeBody(building.handle)
    this.buildings.length = 0
    this.debrisCount = 0
    this.debrisAges.fill(0)
  }

  restartLevel(): void {
    for (const building of this.buildings) {
      building.state = 'standing'
      building.chainDepth = 0
      building.chargeArmed = false
      building.chargeTimer = -1
      this.physics.teleportToStored(building.handle)
    }
    this.debrisCount = 0
    this.debrisAges.fill(0)
  }

  get debrisBudget(): number {
    return this.debrisAges.length
  }

  updateDebris(dt: number): number {
    let alive = 0
    for (let i = 0; i < this.debrisCount && i < this.debrisAges.length; i++) {
      this.debrisAges[i] = (this.debrisAges[i] ?? 0) + dt
      if ((this.debrisAges[i] ?? 0) < 6) alive++
    }
    if (alive < this.debrisCount) this.debrisCount = alive
    return alive
  }

  resetDebrisAge(index: number): void {
    if (index >= 0 && index < this.debrisAges.length) this.debrisAges[index] = 0
  }
}
