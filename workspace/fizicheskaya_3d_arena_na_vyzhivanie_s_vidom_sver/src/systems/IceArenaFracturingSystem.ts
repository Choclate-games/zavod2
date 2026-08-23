import RAPIER from '@dimforge/rapier3d-compat'
import type { PhysicsWorld } from '../physics/PhysicsWorld'
import type { EntityManager } from '../entities/EntityManager'
import { ICE } from '../core/Balance'

/**
 * 16-сегментная льдина: 8 внутренних плит (радиус до 9 м) и 8 внешних
 * (9–18 м). Плавающие кинематические тела: кренятся под суммарным весом
 * тюбингов по формуле Tilt_angle(t+dt) и тонут со скоростью submerge_sink_speed.
 */
export interface IcePlate {
  index: number
  ring: 0 | 1
  body: RAPIER.RigidBody
  halfX: number
  halfZ: number
  centerX: number
  centerZ: number
  /** Направление крена наружу (нормализованный вектор от центра арены). */
  outX: number
  outZ: number
  tiltDeg: number
  sinking: boolean
  sunk: boolean
  sinkOffset: number
}

export class IceArenaFracturingSystem {
  readonly plates: IcePlate[] = []

  constructor(private readonly physics: PhysicsWorld) {}

  build(): void {
    for (let i = 0; i < ICE.outerSegments; i++) {
      this.createWedge(i, 1)
    }
    for (let i = 0; i < ICE.innerSegments; i++) {
      this.createWedge(i, 0)
    }
  }

  private createWedge(index: number, ring: 0 | 1): void {
    const sectorAngle = (Math.PI * 2) / ICE.outerSegments
    const angle = sectorAngle * index + sectorAngle / 2
    const innerR = ring === 0 ? 0 : ICE.arenaRadius / 2
    const outerR = ring === 0 ? ICE.arenaRadius / 2 : ICE.arenaRadius
    const midR = (innerR + outerR) / 2
    const centerX = Math.sin(angle) * midR
    const centerZ = Math.cos(angle) * midR
    const chord = 2 * midR * Math.sin(sectorAngle / 2) * 1.04
    const halfX = ring === 0 ? midR : chord / 2
    const halfZ = ring === 0 ? chord / 2 : (outerR - innerR) / 2 + 0.4
    const body = this.physics.createKinematicBody(centerX, ICE.plateTopY - ICE.plateThickness / 2, centerZ)
    const rotation = ring === 0 ? angle : angle
    body.setRotation(quatAroundY(rotation), true)
    // Внутренние плиты — квадраты от центра, внешние — тангенциальные брусья.
    if (ring === 0) {
      this.physics.attachBoxCollider(body, midR * 0.52, ICE.plateThickness / 2, halfZ, 0.06)
    } else {
      this.physics.attachBoxCollider(body, halfX * 0.5, ICE.plateThickness / 2, halfZ, 0.06)
    }
    this.plates.push({
      index: this.plates.length,
      ring,
      body,
      halfX,
      halfZ,
      centerX,
      centerZ,
      outX: Math.sin(angle),
      outZ: Math.cos(angle),
      tiltDeg: 0,
      sinking: false,
      sunk: false,
      sinkOffset: 0,
    })
  }

  /**
   * Шаг арены: вес стоящих на плите тюбингов кренит её наружу;
   * перегруз выше critical_mass_threshold ускоряет крен.
   */
  update(dt: number, entities: EntityManager): void {
    for (let p = 0; p < this.plates.length; p++) {
      const plate = this.plates[p]
      if (plate.sunk) continue

      if (!plate.sinking) {
        let loadKg = 0
        let leanDir = 0
        for (let i = 0; i < entities.tubes.length; i++) {
          const tube = entities.tubes[i]
          if (!tube.alive || !tube.body) continue
          const t = tube.body.translation()
          if (t.y > ICE.plateTopY + tube.radiusM * 1.5 || t.y < ICE.plateTopY - 1) continue
          const localX = t.x - plate.centerX
          const localZ = t.z - plate.centerZ
          if (ringLocalInside(plate, localX, localZ)) {
            loadKg += tube.massKg
            leanDir += localX * plate.outX + localZ * plate.outZ >= 0 ? 1 : -1
          }
        }
        if (loadKg <= 0) continue
        // Tilt_angle(t+dt) = min(max, tilt + (load/capacity)^2 * rate * dt)
        const capacity = ICE.criticalMassThreshold
        const overload = loadKg > capacity ? 2.6 : 1
        plate.tiltDeg = Math.min(
          ICE.tiltAngleMaxDeg,
          plate.tiltDeg + Math.pow(Math.min(loadKg / capacity, 1.4), 2) * 14.0 * dt * overload,
        )
        applyTilt(plate, leanDir)
      } else {
        // Тонущая плита уходит вниз с постоянной скоростью.
        plate.sinkOffset += ICE.submergeSinkSpeed * dt
        const y = ICE.plateTopY - ICE.plateThickness / 2 - plate.sinkOffset
        const tr = plate.body.translation()
        plate.body.setNextKinematicTranslation({ x: tr.x, y, z: tr.z })
        if (y < -6) {
          plate.sunk = true
        }
      }
    }
  }

  /** Раскол: плита получает крен до максимума и уходит под воду. */
  collapse(index: number): void {
    const plate = this.find(index)
    if (!plate || plate.sinking || plate.sunk) return
    plate.tiltDeg = ICE.tiltAngleMaxDeg
    applyTilt(plate, 1)
    plate.sinking = true
  }

  find(index: number): IcePlate | undefined {
    for (let i = 0; i < this.plates.length; i++) {
      if (this.plates[i].index === index) return this.plates[i]
    }
    return undefined
  }

  /** Есть ли под точкой живая плита (для радара и логики ботов). */
  hasSupportAt(x: number, z: number): boolean {
    for (let i = 0; i < this.plates.length; i++) {
      const plate = this.plates[i]
      if (plate.sunk || plate.sinking) continue
      if (ringLocalInside(plate, x - plate.centerX, z - plate.centerZ)) return true
    }
    return false
  }

  reset(): void {
    for (let i = 0; i < this.plates.length; i++) {
      const plate = this.plates[i]
      plate.tiltDeg = 0
      plate.sinking = false
      plate.sunk = false
      plate.sinkOffset = 0
      plate.body.setNextKinematicTranslation({
        x: plate.centerX,
        y: ICE.plateTopY - ICE.plateThickness / 2,
        z: plate.centerZ,
      })
      applyTilt(plate, 0)
    }
  }

  dispose(): void {
    for (let i = 0; i < this.plates.length; i++) {
      this.physics.removeBody(this.plates[i].body)
    }
    this.plates.length = 0
  }
}

/** Локальная проверка «точка внутри прямоугольника плиты» без аллокаций. */
function ringLocalInside(plate: IcePlate, lx: number, lz: number): boolean {
  const reachX = plate.ring === 0 ? plate.halfX * 1.05 : plate.halfX * 0.55
  const reachZ = plate.halfZ * 1.05
  const alongOut = lx * plate.outX + lz * plate.outZ
  const acrossX = lx - plate.outX * alongOut
  const acrossZ = lz - plate.outZ * alongOut
  const across = Math.hypot(acrossX, acrossZ)
  if (plate.ring === 0) {
    return Math.abs(lx) < reachX && Math.abs(lz) < reachZ
  }
  return Math.abs(alongOut) < plate.halfZ * 1.15 && across < plate.halfX
}

function applyTilt(plate: IcePlate, dir: number): void {
  const rad = (plate.tiltDeg * dir * Math.PI) / 180
  const axisX = -plate.outZ
  const axisZ = plate.outX
  const sinHalf = Math.sin(rad / 2)
  plate.body.setRotation(
    { x: axisX * sinHalf, y: 0, z: axisZ * sinHalf, w: Math.cos(rad / 2) },
    true,
  )
}

function quatAroundY(angle: number): RAPIER.Rotation {
  const half = angle / 2
  return { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) }
}
