import RAPIER from '@dimforge/rapier3d-compat'
import { BALANCE } from '../core/balance'

export interface GroundHit {
  hit: boolean
  pointY: number
  normalY: number
  normalZ: number
  slopeAngleDeg: number
  surfaceType: 'tile' | 'slate' | 'cable'
  isLedge: boolean
}

export class PhysicsWorld {
  private world: RAPIER.World | null = null
  private initialized = false
  private isInitializing = false

  public async init(): Promise<void> {
    if (this.initialized) return
    if (this.isInitializing) return
    this.isInitializing = true

    await RAPIER.init()
    const gravity = new RAPIER.Vector3(0.0, -BALANCE.movement.gravity, 0.0)
    this.world = new RAPIER.World(gravity)
    this.world.timestep = 1 / 60
    this.initialized = true
    this.isInitializing = false
  }

  public step(): void {
    if (!this.world || !this.initialized) return
    this.world.step()
  }

  public getRawWorld(): RAPIER.World | null {
    return this.world
  }

  public isReady(): boolean {
    return this.initialized && this.world !== null
  }

  public createStaticBox(
    x: number,
    y: number,
    z: number,
    halfW: number,
    halfH: number,
    halfD: number
  ): RAPIER.RigidBody | null {
    if (!this.world) return null
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z)
    const body = this.world.createRigidBody(bodyDesc)
    const colliderDesc = RAPIER.ColliderDesc.cuboid(halfW, halfH, halfD)
    this.world.createCollider(colliderDesc, body)
    return body
  }

  public removeRigidBody(body: RAPIER.RigidBody): void {
    if (!this.world) return
    this.world.removeRigidBody(body)
  }

  public reset(): void {
    if (!this.world) return
    // Clean bodies
    this.world.bodies.forEach((body) => {
      this.world?.removeRigidBody(body)
    })
  }
}

export const physicsWorld = new PhysicsWorld()
