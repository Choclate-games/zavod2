import RAPIER from '@dimforge/rapier3d-compat'
import { MATERIAL_DENSITY, SHEAR_CUT } from '../core/balance'
import type { BuildingSpec } from '../core/levels'

export type ImpactInfo = {
  sourceHandle: number
  targetHandle: number
  energyJ: number
  x: number
  y: number
  z: number
  dirX: number
  dirZ: number
}

export type BodyPose = { x: number; y: number; z: number; qx: number; qy: number; qz: number; qw: number }

const tmpVec = new RAPIER.Vector3(0, 0, 0)

/**
 * Минимальное приращение скорости центра масс (м/с), при котором башня с
 * габаритами w×d×h переваливает центр масс через ребро основания и падает:
 * кинетическая энергия вращения должна перекрыть подъём COM на Δ высоты.
 */
export function requiredTiltDv(w: number, d: number, h: number): number {
  const foot = Math.max(w, d)
  const delta = (Math.sqrt(h * h + foot * foot) - h) / 2
  const lever = h * 0.22
  return Math.sqrt(((h * h + foot * foot) * SHEAR_CUT.GRAVITY * delta) / (6 * lever * lever))
}

export class PhysicsWorld {
  private world: RAPIER.World | null = null
  private eventQueue: RAPIER.EventQueue | null = null
  private readonly poses = new Map<number, BodyPose>()
  private readonly masses = new Map<number, number>()
  readonly gravity = SHEAR_CUT.GRAVITY

  async load(): Promise<void> {
    await RAPIER.init()
    this.world = new RAPIER.World({ x: 0, y: -this.gravity, z: 0 })
    this.world.timestep = 1 / 60
    this.eventQueue = new RAPIER.EventQueue(true)
    const ground = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0))
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setFriction(0.9), ground)
  }

  get isReady(): boolean {
    return this.world !== null && this.eventQueue !== null
  }

  createStanding(spec: BuildingSpec): number {
    const world = this.world!
    const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(spec.x, spec.h / 2, spec.z)
    const body = world.createRigidBody(desc)
    // Плотность коллайдера задаёт физическую массу: она обязана совпадать со
    // стилизованной массой в карте masses, иначе импульсы врут на два порядка.
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(spec.w / 2, spec.h / 2, spec.d / 2)
        .setDensity(MATERIAL_DENSITY[spec.material])
        .setFriction(0.85)
        .setRestitution(0.02)
        // Без этого флага EventQueue не приносит событий контакта вовсе.
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
    )
    this.poses.set(body.handle, { x: spec.x, y: spec.h / 2, z: spec.z, qx: 0, qy: 0, qz: 0, qw: 1 })
    this.masses.set(body.handle, spec.w * spec.d * spec.h * MATERIAL_DENSITY[spec.material])
    return body.handle
  }

  massOf(handle: number): number {
    return this.masses.get(handle) ?? 1
  }

  setDynamic(handle: number, ccd: boolean): void {
    const body = this.world?.getRigidBody(handle)
    if (!body) return
    body.setBodyType(RAPIER.RigidBodyType.Dynamic, true)
    if (ccd && 'setCcdEnabled' in body) {
      ;(body as RAPIER.RigidBody & { setCcdEnabled(flag: boolean): void }).setCcdEnabled(true)
    }
    body.wakeUp()
  }

  isFixed(handle: number): boolean {
    const body = this.world?.getRigidBody(handle)
    return body?.isFixed() ?? true
  }

  applyImpulseAt(handle: number, ix: number, iy: number, iz: number, px: number, py: number, pz: number): void {
    const body = this.world?.getRigidBody(handle)
    if (!body) return
    tmpVec.x = ix
    tmpVec.y = iy
    tmpVec.z = iz
    body.applyImpulseAtPoint(tmpVec, { x: px, y: py, z: pz }, true)
  }

  linearVelocity(handle: number, out: { x: number; y: number; z: number }): void {
    const v = this.world?.getRigidBody(handle)?.linvel()
    out.x = v?.x ?? 0
    out.y = v?.y ?? 0
    out.z = v?.z ?? 0
  }

  translationOf(handle: number): { x: number; y: number; z: number } | null {
    return this.world?.getRigidBody(handle)?.translation() ?? null
  }

  rotationOf(handle: number, out: { qx: number; qy: number; qz: number; qw: number }): boolean {
    const r = this.world?.getRigidBody(handle)?.rotation()
    if (!r) return false
    out.qx = r.x
    out.qy = r.y
    out.qz = r.z
    out.qw = r.w
    return true
  }

  syncPose(handle: number, out: BodyPose): boolean {
    const t = this.world?.getRigidBody(handle)?.translation()
    const r = this.world?.getRigidBody(handle)?.rotation()
    if (!t || !r) return false
    out.x = t.x
    out.y = t.y
    out.z = t.z
    out.qx = r.x
    out.qy = r.y
    out.qz = r.z
    out.qw = r.w
    return true
  }

  storedPose(handle: number): BodyPose | undefined {
    return this.poses.get(handle)
  }

  /** Рестарт уровня — телепорт тел в исходную позу, мир не пересобирается. */
  teleportToStored(handle: number): void {
    const pose = this.poses.get(handle)
    const body = this.world?.getRigidBody(handle)
    if (!pose || !body) return
    body.setTranslation({ x: pose.x, y: pose.y, z: pose.z }, true)
    body.setRotation({ x: pose.qx, y: pose.qy, z: pose.qz, w: pose.qw }, true)
    body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    body.setBodyType(RAPIER.RigidBodyType.Fixed, true)
    body.sleep()
  }

  removeBody(handle: number): void {
    this.poses.delete(handle)
    this.masses.delete(handle)
    const body = this.world?.getRigidBody(handle)
    if (body) this.world!.removeRigidBody(body)
  }

  step(onImpact?: (impact: ImpactInfo) => void): void {
    const world = this.world
    const queue = this.eventQueue
    if (!world || !queue) return
    world.step(queue)
    if (!onImpact) {
      queue.drainCollisionEvents(() => undefined)
      return
    }
    queue.drainCollisionEvents((h1, h2, started) => {
      if (!started) return
      this.reportImpact(h1, h2, onImpact)
      this.reportImpact(h2, h1, onImpact)
    })
  }

  private reportImpact(source: number, target: number, onImpact: (impact: ImpactInfo) => void): void {
    const sourceMass = this.masses.get(source)
    const targetMass = this.masses.get(target)
    if (sourceMass === undefined || targetMass === undefined) return
    const body = this.world?.getRigidBody(source)
    if (!body || body.isFixed()) return
    const lv = body.linvel()
    const av = body.angvel()
    const speedSq = lv.x * lv.x + lv.y * lv.y + lv.z * lv.z
    const spinSq = av.x * av.x + av.y * av.y + av.z * av.z
    const targetPos = this.world!.getRigidBody(target)?.translation()
    if (!targetPos) return
    const horizontal = Math.sqrt(lv.x * lv.x + lv.z * lv.z)
    const nx = horizontal > 1e-4 ? lv.x / horizontal : 1
    const nz = horizontal > 1e-4 ? lv.z / horizontal : 0
    onImpact({
      sourceHandle: source,
      targetHandle: target,
      // Кинетическая энергия удара: поступательная плюс вращательная доли.
      energyJ: 0.5 * sourceMass * speedSq + 0.5 * sourceMass * 12 * spinSq,
      x: targetPos.x,
      y: Math.max(targetPos.y, 1),
      z: targetPos.z,
      dirX: nx,
      dirZ: nz,
    })
  }
}
