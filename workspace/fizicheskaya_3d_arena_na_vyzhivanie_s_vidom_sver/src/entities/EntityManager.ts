import { Tubing } from './Player'
import type { PhysicsWorld } from '../physics/PhysicsWorld'
import { ICE, MASS, REBOUND, SESSION } from '../core/Balance'

/**
 * Пул из 8 тюбингов (игрок + 7 ботов). Тела создаются один раз,
 * рестарт матча — телепорт существующих тел, а не пересборка мира.
 */
const BOT_NAMES = ['МОРЖ-ТИТАН', 'ПИНГВИН-БОМБАРДИР', 'НЕРАПАЙ', 'ТЮЛЕНЬ-ШТУРМ', 'АЙСБЕРГ-ДЖО', 'КРИЛЬ-СПИРИТ', 'ПОЛЯРНИК'] as const

export class EntityManager {
  readonly tubes: Tubing[] = []
  aliveCount: number = SESSION.participants

  constructor(private readonly physics: PhysicsWorld) {}

  build(): void {
    for (let i = 0; i < SESSION.participants; i++) {
      const tube = new Tubing()
      tube.id = i
      tube.isPlayer = i === 0
      tube.colorIndex = i
      tube.name = tube.isPlayer ? 'ИГРОК' : BOT_NAMES[i - 1] ?? 'БОТ'
      tube.body = this.physics.createDynamicBody(0, 1.4, 0, true)
      tube.collider = this.physics.attachBallCollider(tube.body, tube.radiusM, REBOUND.restitutionCoefficient)
      this.tubes.push(tube)
    }
  }

  /** Расстановка по кругу носом к центру. Телепорт, не пересоздание. */
  layoutForMatch(): void {
    this.aliveCount = this.tubes.length
    const radius = ICE.arenaRadius * 0.72
    for (let i = 0; i < this.tubes.length; i++) {
      const angle = (i / this.tubes.length) * Math.PI * 2
      const x = Math.sin(angle) * radius
      const z = Math.cos(angle) * radius
      this.tubes[i].reset(x, z, angle + Math.PI)
    }
  }

  /** Рост коллайдера после фрага: коллайдер пересоздаётся с новым радиусом. */
  refreshCollider(tube: Tubing): void {
    if (!tube.body || !tube.collider) return
    const world = this.physics.raw
    world.removeCollider(tube.collider, false)
    tube.collider = this.physics.attachBallCollider(tube.body, tube.radiusM, REBOUND.restitutionCoefficient)
    tube.body.setAdditionalMass(tube.massKg - MASS.baseMassKg, true)
  }

  /**
   * Гидродинамика: выталкивание по погружённому объёму, сопротивление воды,
   * гибель ниже ватерлинии. Погибшие за тик пишутся в переданный буфер.
   */
  updateHydrodynamics(outDied: Tubing[]): void {
    outDied.length = 0
    let alive = 0
    for (let i = 0; i < this.tubes.length; i++) {
      const tube = this.tubes[i]
      if (!tube.alive || !tube.body) continue
      const t = tube.body.translation()
      const v = tube.body.linvel()
      if (t.y < 0) {
        // Погружённая доля шара: от поверхности воды до центра + радиус.
        const submerged = Math.min(1, Math.max(0.08, (0 - t.y + tube.radiusM) / (2 * tube.radiusM)))
        const buoyancy = submerged * tube.massKg * 9.81 * (submerged > 0.85 ? 0.55 : 1.15)
        const dragK = submerged * tube.massKg * 1.6
        tube.body.addForce({ x: -v.x * dragK, y: buoyancy - v.y * dragK * 0.6, z: -v.z * dragK }, true)
        if (t.y < SESSION.waterlineDeathY) {
          tube.die(0)
          outDied.push(tube)
          continue
        }
      }
      alive++
    }
    this.aliveCount = alive
  }

  countAlive(): number {
    let alive = 0
    for (let i = 0; i < this.tubes.length; i++) if (this.tubes[i].alive) alive++
    this.aliveCount = alive
    return alive
  }

  get player(): Tubing {
    return this.tubes[0]
  }

  dispose(): void {
    for (let i = 0; i < this.tubes.length; i++) {
      const body = this.tubes[i].body
      if (body) this.physics.removeBody(body)
    }
    this.tubes.length = 0
  }
}
