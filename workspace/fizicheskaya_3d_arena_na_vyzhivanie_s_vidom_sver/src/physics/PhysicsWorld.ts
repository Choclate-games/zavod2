import RAPIER from '@dimforge/rapier3d-compat'

/**
 * Мир Rapier3D: единственный владелец физики.
 * Шаг фиксированный (мир создаётся с timestep 1/60), накопитель ограничен
 * в GameLoop. Тела освобождаются явно: память WASM сборщиком мусора
 * не собирается.
 */
export class PhysicsWorld {
  private world: RAPIER.World | null = null
  private eventQueue: RAPIER.EventQueue | null = null

  async init(): Promise<void> {
    await RAPIER.init()
    this.eventQueue = new RAPIER.EventQueue(true)
    const gravity: RAPIER.Vector3 = { x: 0, y: -9.81, z: 0 }
    this.world = new RAPIER.World(gravity)
    this.world.timestep = 1 / 60
  }

  get raw(): RAPIER.World {
    if (!this.world) throw new Error('PhysicsWorld.init() не вызван')
    return this.world
  }

  createDynamicBody(x: number, y: number, z: number, ccd: boolean): RAPIER.RigidBody {
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, y, z)
      .lockRotations()
      .setLinearDamping(0.12)
    if (ccd) desc.setCcdEnabled(true)
    return this.raw.createRigidBody(desc)
  }

  createKinematicBody(x: number, y: number, z: number): RAPIER.RigidBody {
    const desc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z)
    return this.raw.createRigidBody(desc)
  }

  attachBallCollider(body: RAPIER.RigidBody, radius: number, restitution: number): RAPIER.Collider {
    const desc = RAPIER.ColliderDesc.ball(radius)
      .setRestitution(restitution)
      .setFriction(0.02)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS)
    return this.raw.createCollider(desc, body)
  }

  /** Полуразмеры: коробка 1x1x1 это cuboid(0.5, 0.5, 0.5). */
  attachBoxCollider(
    body: RAPIER.RigidBody,
    hx: number,
    hy: number,
    hz: number,
    friction: number,
  ): RAPIER.Collider {
    const desc = RAPIER.ColliderDesc.cuboid(hx, hy, hz).setFriction(friction)
    return this.raw.createCollider(desc, body)
  }

  step(): void {
    if (!this.world || !this.eventQueue) return
    this.world.step(this.eventQueue)
    this.eventQueue.drainCollisionEvents((handleA, handleB, started) => {
      if (started && this.onContact) this.onContact(handleA, handleB)
    })
  }

  onContact: ((handleA: number, handleB: number) => void) | null = null

  removeBody(body: RAPIER.RigidBody): void {
    this.raw.removeRigidBody(body)
  }
}
