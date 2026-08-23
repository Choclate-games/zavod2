import RAPIER from '@dimforge/rapier3d-compat'

/** Группы столкновений: мир(1), снаряд-рэгдолл(2), декор(4), гости(8), тросы(16). */
export const GROUP_WORLD = 0x0001
export const GROUP_STUNTMAN = 0x0002
export const GROUP_DECOR = 0x0004
export const GROUP_GUEST = 0x0008
export const GROUP_CABLE = 0x0016

export function groupOf(membership: number, filter: number): number {
  return ((filter & 0xffff) << 16) | (membership & 0xffff)
}

let initPromise: Promise<void> | null = null

export async function initPhysics(): Promise<void> {
  if (!initPromise) initPromise = RAPIER.init()
  await initPromise
}

/**
 * Мир физики с фиксированным шагом 60 Гц. Порядок кадра:
 * силы -> step() -> синхронизация мешей. Меши никогда не двигают тела напрямую.
 */
export class PhysicsWorld {
  readonly world: RAPIER.World
  readonly eventQueue: RAPIER.EventQueue

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    this.world.timestep = 1 / 60
    this.eventQueue = new RAPIER.EventQueue(true)
    // Интегрировать параметры рэгдолла в solver можно через numSolverIterations.
    this.world.integrationParameters.numSolverIterations = 4
  }

  step(): void {
    this.world.step(this.eventQueue)
  }

  createStaticCuboid(hx: number, hy: number, hz: number, x: number, y: number, z: number,
                     membership: number, filter: number): RAPIER.Collider {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z),
    )
    return this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy, hz)
        .setCollisionGroups(groupOf(membership, filter)),
      body,
    )
  }

  /** Rapier сам снимает коллайдеры и джойнты тела при удалении тела (WASM). */
  disposeBody(body: RAPIER.RigidBody): void {
    this.world.removeRigidBody(body)
  }
}

export type Vec3 = { x: number; y: number; z: number }
