import RAPIER from '@dimforge/rapier3d-compat'
import type { Collider, Ray, World } from '@dimforge/rapier3d-compat'

/**
 * Мир физики на Rapier: фиксированный шаг, явное владение телами,
 * рейкасты с исключением тела стрелка.
 */
export class PhysicsWorld {
  private world!: World
  private readyFlag = false

  async init(): Promise<void> {
    await RAPIER.init()
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    this.readyFlag = true
  }

  get ready(): boolean {
    return this.readyFlag
  }

  get raw(): World {
    return this.world
  }

  step(): void {
    // Шаг фиксированный: world.timestep не подменяется на dt кадра.
    this.world.timestep = 1 / 60
    this.world.step()
  }

  createStaticBox(hx: number, hy: number, hz: number, x: number, y: number, z: number): Collider {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z),
    )
    // cuboid получает ПОЛУразмеры.
    return this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz), body)
  }

  createDynamicBox(
    hx: number, hy: number, hz: number,
    x: number, y: number, z: number,
    density = 40,
  ): { body: RAPIER.RigidBody; collider: Collider } {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setLinearDamping(0.4).setAngularDamping(0.6),
    )
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy, hz).setDensity(density),
      body,
    )
    body.sleep()
    return { body, collider }
  }

  createPlayerCapsule(x: number, y: number, z: number, halfHeight: number, radius: number): {
    controller: RAPIER.KinematicCharacterController
    body: RAPIER.RigidBody
    collider: Collider
  } {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z),
    )
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(halfHeight, radius),
      body,
    )
    const controller = this.world.createCharacterController(0.02)
    controller.enableAutostep(0.5, 0.2, true)
    controller.enableSnapToGround(0.4)
    controller.setApplyImpulsesToDynamicBodies(true)
    controller.setCharacterMass(80)
    return { controller, body, collider }
  }

  /** Луч по уровню; тело стрелка исключается по коллайдеру. */
  castRayExclude(ray: Ray, maxToi: number, excludeCollider: Collider): number {
    const hit = this.world.castRayAndGetNormal(
      ray,
      maxToi,
      true,
      undefined,
      undefined,
      excludeCollider,
    )
    return hit ? hit.timeOfImpact : maxToi
  }

  teleportBody(body: RAPIER.RigidBody, x: number, y: number, z: number): void {
    // Рестарт уровня — телепорт тел, а не пересборка мира.
    body.setTranslation({ x, y, z }, true)
    body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
    body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    body.setAngvel({ x: 0, y: 0, z: 0 }, true)
  }

  disposeBody(body: RAPIER.RigidBody): void {
    // Тела освобождаются явно: память WASM не собирается сборщиком мусора.
    this.world.removeRigidBody(body)
  }
}
