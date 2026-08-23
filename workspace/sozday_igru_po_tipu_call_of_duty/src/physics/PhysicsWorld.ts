import RAPIER from '@dimforge/rapier3d-compat'
import { BALANCE } from '../game/balanceConfig'

export interface PhysicsBodyHandle {
  id: number
  body: RAPIER.RigidBody
  collider: RAPIER.Collider
  isStatic: boolean
  isExplosive?: boolean
  isDestructible?: boolean
}

export class PhysicsWorld {
  private static instance: PhysicsWorld
  private world: RAPIER.World | null = null
  private isInitialized = false
  private bodies: Map<number, PhysicsBodyHandle> = new Map()
  private nextBodyId = 1

  public static getInstance(): PhysicsWorld {
    if (!PhysicsWorld.instance) {
      PhysicsWorld.instance = new PhysicsWorld()
    }
    return PhysicsWorld.instance
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return
    await RAPIER.init()
    const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0)
    this.world = new RAPIER.World(gravity)
    this.world.timestep = 1 / 60
    this.isInitialized = true
    this.createGround()
  }

  private createGround(): void {
    if (!this.world) return
    const groundBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0)
    const groundBody = this.world.createRigidBody(groundBodyDesc)
    const groundColliderDesc = RAPIER.ColliderDesc.cuboid(500, 0.5, 500)
    this.world.createCollider(groundColliderDesc, groundBody)
  }

  public step(): void {
    if (this.world) {
      this.world.step()
    }
  }

  public createBoxBody(
    x: number,
    y: number,
    z: number,
    halfW: number,
    halfH: number,
    halfD: number,
    isStatic = false,
    isExplosive = false,
    isDestructible = false
  ): PhysicsBodyHandle | null {
    if (!this.world) return null

    const bodyDesc = isStatic
      ? RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z)
      : RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setLinearDamping(0.8).setAngularDamping(0.8)

    const body = this.world.createRigidBody(bodyDesc)
    const colliderDesc = RAPIER.ColliderDesc.cuboid(halfW, halfH, halfD)
    const collider = this.world.createCollider(colliderDesc, body)

    const id = this.nextBodyId++
    const handle: PhysicsBodyHandle = {
      id,
      body,
      collider,
      isStatic,
      isExplosive,
      isDestructible
    }
    this.bodies.set(id, handle)
    return handle
  }

  public applyExplosionImpulse(
    epicenter: { x: number; y: number; z: number },
    radius: number,
    baseForce: number = BALANCE.physics.vehicleImpulse
  ): Array<{ id: number; distance: number; isExplosive?: boolean }> {
    const affected: Array<{ id: number; distance: number; isExplosive?: boolean }> = []
    if (!this.world) return affected

    for (const [id, handle] of this.bodies.entries()) {
      const pos = handle.body.translation()
      const dx = pos.x - epicenter.x
      const dy = pos.y - epicenter.y
      const dz = pos.z - epicenter.z
      const distSq = dx * dx + dy * dy + dz * dz
      const dist = Math.sqrt(distSq)

      if (dist <= radius) {
        affected.push({ id, distance: dist, isExplosive: handle.isExplosive })
        if (!handle.isStatic) {
          const normDist = Math.max(1.0, dist)
          const force = baseForce / (normDist * normDist)
          const invDist = 1 / normDist
          const impulse = new RAPIER.Vector3(
            dx * invDist * force,
            Math.max(force * 0.5, (dy + 1.0) * invDist * force),
            dz * invDist * force
          )
          handle.body.applyImpulse(impulse, true)
        }
      }
    }

    return affected
  }

  public removeBody(id: number): void {
    if (!this.world) return
    const handle = this.bodies.get(id)
    if (handle) {
      this.world.removeCollider(handle.collider, false)
      this.world.removeRigidBody(handle.body)
      this.bodies.delete(id)
    }
  }

  public reset(): void {
    if (!this.world) return
    for (const [, handle] of this.bodies) {
      this.world.removeCollider(handle.collider, false)
      this.world.removeRigidBody(handle.body)
    }
    this.bodies.clear()
    this.createGround()
  }
}

export const physics = PhysicsWorld.getInstance()
