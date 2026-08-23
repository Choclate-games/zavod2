import { DOMINO_CHAIN } from '../core/balance'
import type { EventBus } from '../core/EventBus'
import type { LevelSpec } from '../core/levels'
import type { Building } from '../entities/Building'
import { requiredTiltDv, type PhysicsWorld } from '../physics/PhysicsWorld'

const CONTACT_MARGIN = 0.6

/**
 * Отслеживает передачу кинетической энергии между телами: падающая башня,
 * подошедшая к стоящей вплотную, отдаёт долю своей кинетической энергии; если
 * она превышает порог целостности — сосед переходит в динамику и валится.
 */
export class DominoChainEvaluationSystem {
  private buildings: Building[] = []
  perimeterRadius = 100
  breachDetected = false
  collapseRatio = 0
  maxChainDepth = 0
  comboMult = 1
  private lastProgressEmitted = -1
  private readonly handledPairs = new Set<string>()
  private readonly poses = new Map<number, { x: number; y: number; z: number }>()
  private readonly halfExtents = new Map<number, { x: number; y: number; z: number }>()
  private readonly scratchRot = { qx: 0, qy: 0, qz: 0, qw: 1 }
  private readonly scratchVel = { x: 0, y: 0, z: 0 }

  constructor(
    private readonly physics: PhysicsWorld,
    private readonly events: EventBus,
    private readonly onTopple: (building: Building, dirX: number, dirZ: number) => void,
    private readonly onImpactFx: (x: number, y: number, z: number, power: number) => void,
  ) {}

  bindLevel(spec: LevelSpec, buildings: Building[]): void {
    this.buildings = buildings
    this.perimeterRadius = spec.perimeterRadius
    this.breachDetected = false
    this.collapseRatio = 0
    this.maxChainDepth = 0
    this.comboMult = 1
    this.lastProgressEmitted = -1
    this.handledPairs.clear()
    this.poses.clear()
    this.halfExtents.clear()
    for (const building of buildings) {
      const s = building.spec
      this.poses.set(building.handle, { x: s.x, y: s.h / 2, z: s.z })
      this.halfExtents.set(building.handle, {
        x: s.w / 2,
        y: s.h / 2,
        z: s.d / 2,
      })
    }
  }

  get all(): readonly Building[] {
    return this.buildings
  }

  update(): void {
    // 1. Свежие позы и повёрнутые AABB-полуразмеры падающих тел.
    for (const building of this.buildings) {
      if (building.state === 'standing') continue
      const pose = this.poses.get(building.handle)
      const t = this.physics.translationOf(building.handle)
      if (pose && t) {
        pose.x = t.x
        pose.y = t.y
        pose.z = t.z
      }
      const he = this.halfExtents.get(building.handle)
      if (he && this.physics.rotationOf(building.handle, this.scratchRot)) {
        this.orientedHalfExtents(building.spec, this.scratchRot, he)
      }
    }

    // 2. Передача энергии: каждое падающее тело не более одного раза бьёт
    //    каждое стоящее — каскад идёт волной, а не схлопывается в кадр.
    for (const source of this.buildings) {
      if (source.state !== 'falling') continue
      const sp = this.poses.get(source.handle)
      const se = this.halfExtents.get(source.handle)
      if (!sp || !se) continue
      for (const target of this.buildings) {
        if (target.state !== 'standing') continue
        const key =
          source.handle < target.handle
            ? `${source.handle}:${target.handle}`
            : `${target.handle}:${source.handle}`
        if (this.handledPairs.has(key)) continue
        const tp = this.poses.get(target.handle)
        const te = this.halfExtents.get(target.handle)
        if (!tp || !te) continue
        const overlap =
          Math.abs(tp.x - sp.x) <= se.x + te.x + CONTACT_MARGIN &&
          Math.abs(tp.y - sp.y) <= se.y + te.y + CONTACT_MARGIN &&
          Math.abs(tp.z - sp.z) <= se.z + te.z + CONTACT_MARGIN
        if (!overlap) continue

        this.handledPairs.add(key)
        this.physics.linearVelocity(source.handle, this.scratchVel)
        const speedSq =
          this.scratchVel.x ** 2 + this.scratchVel.y ** 2 + this.scratchVel.z ** 2
        const mass = this.physics.massOf(source.handle)
        const energyJ = 0.5 * mass * speedSq
        const horizontal = Math.max(0.001, Math.hypot(tp.x - sp.x, tp.z - sp.z))
        this.resolveImpact(
          source,
          target,
          energyJ,
          (tp.x - sp.x) / horizontal,
          (tp.z - sp.z) / horizontal,
        )
      }
    }

    // 3. Состояние обрушения и охранной периметр.
    let collapsed = 0
    for (const building of this.buildings) {
      if (building.state === 'collapsed') {
        collapsed++
        continue
      }
      if (building.state === 'standing') continue
      const pose = this.poses.get(building.handle)
      if (!pose || !this.physics.rotationOf(building.handle, this.scratchRot)) continue
      const originY = building.spec.h / 2
      const drop = 1 - pose.y / originY
      const driftSq = (pose.x - building.spec.x) ** 2 + (pose.z - building.spec.z) ** 2
      // Наклон — это крен оси «вверх» тела (qx/qz), а не рыскание вокруг Y.
      const upY = Math.min(
        1,
        Math.max(-1, 1 - 2 * (this.scratchRot.qx ** 2 + this.scratchRot.qz ** 2)),
      )
      const tiltAngle = Math.acos(upY)
      if (
        tiltAngle >= DOMINO_CHAIN.TILT_COLLAPSE_RAD ||
        drop >= DOMINO_CHAIN.COM_DROP_COLLAPSE ||
        driftSq > (building.spec.h * 0.6) ** 2
      ) {
        building.state = 'collapsed'
        collapsed++
      }
      const distSq = pose.x * pose.x + pose.z * pose.z
      if (distSq > this.perimeterRadius * this.perimeterRadius) {
        this.breachDetected = true
      }
    }
    this.collapseRatio = collapsed / this.buildings.length
    const rounded = Math.floor(this.collapseRatio * 100)
    if (rounded !== this.lastProgressEmitted) {
      this.lastProgressEmitted = rounded
      this.events.emit('progress:collapse', { ratio: this.collapseRatio })
    }
  }

  isSettled(): boolean {
    for (const building of this.buildings) {
      if (building.state !== 'falling') continue
      const v = this.scratchVel
      this.physics.linearVelocity(building.handle, v)
      if (v.x * v.x + v.y * v.y + v.z * v.z > 0.04) return false
    }
    return true
  }

  /** Полуразмеры AABB повёрнутого бокса — без аллокаций. */
  private orientedHalfExtents(
    spec: Building['spec'],
    q: { qx: number; qy: number; qz: number; qw: number },
    out: { x: number; y: number; z: number },
  ): void {
    const { qx, qy, qz, qw } = q
    const r00 = 1 - 2 * (qy * qy + qz * qz)
    const r01 = 2 * (qx * qy + qz * qw)
    const r02 = 2 * (qx * qz - qy * qw)
    const r10 = 2 * (qx * qy - qz * qw)
    const r11 = 1 - 2 * (qx * qx + qz * qz)
    const r12 = 2 * (qy * qz + qx * qw)
    const r20 = 2 * (qx * qz + qy * qw)
    const r21 = 2 * (qy * qz - qx * qw)
    const r22 = 1 - 2 * (qx * qx + qy * qy)
    const wx = (spec.w / 2) * Math.abs(r00)
    const wy = (spec.w / 2) * Math.abs(r10)
    const wz = (spec.w / 2) * Math.abs(r20)
    const dx = (spec.d / 2) * Math.abs(r01)
    const dy = (spec.d / 2) * Math.abs(r11)
    const dz = (spec.d / 2) * Math.abs(r21)
    const hx = (spec.h / 2) * Math.abs(r02)
    const hy = (spec.h / 2) * Math.abs(r12)
    const hz = (spec.h / 2) * Math.abs(r22)
    out.x = wx + dx + hx
    out.y = wy + dy + hy
    out.z = wz + dz + hz
  }

  private resolveImpact(
    source: Building,
    target: Building,
    energyJ: number,
    dirX: number,
    dirZ: number,
  ): void {
    const sp = this.poses.get(source.handle)
    if (!sp) return
    const delivered = energyJ * DOMINO_CHAIN.IMPULSE_TRANSFER
    const power = Math.min(1, delivered / target.integrityJ)
    if (power > 0.08) {
      this.onImpactFx(sp.x, sp.y, sp.z, power)
    }
    if (delivered < target.integrityJ) return

    target.state = 'falling'
    target.chainDepth = source.chainDepth + 1
    this.maxChainDepth = Math.max(this.maxChainDepth, target.chainDepth)
    this.comboMult *= DOMINO_CHAIN.CHAIN_MULTIPLIER
    this.physics.setDynamic(target.handle, true)
    const ratio = Math.min(delivered / target.integrityJ, 3)
    // Кик обязан перекрыть энергетический барьер опрокидывания соседа.
    const s = target.spec
    const kickDv = Math.min(
      8,
      Math.max(1.5, requiredTiltDv(s.w, s.d, s.h) * (1.3 + 0.5 * Math.min(ratio, 1))),
    )
    const kick = kickDv * this.physics.massOf(target.handle)
    this.physics.applyImpulseAt(
      target.handle,
      dirX * kick,
      kick * 0.06,
      dirZ * kick,
      target.spec.x + dirX * 2,
      target.spec.h * 0.7,
      target.spec.z + dirZ * 2,
    )
    this.onTopple(target, dirX, dirZ)
  }
}
