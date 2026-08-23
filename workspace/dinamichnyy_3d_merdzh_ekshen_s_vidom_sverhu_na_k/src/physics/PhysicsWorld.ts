import RAPIER from '@dimforge/rapier3d-compat'

export class PhysicsWorld {
  private world: RAPIER.World | null = null
  private readonly bodies: Array<RAPIER.RigidBody | null> = []
  private ready = false

  async initialize(): Promise<void> {
    await RAPIER.init()
    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 })
    this.world.timestep = 1 / 60
    const floor = RAPIER.RigidBodyDesc.fixed()
    const floorBody = this.world.createRigidBody(floor)
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(12, 0.15, 12).setFriction(0.85), floorBody)
    for (let index = 0; index < 48; index += 1) {
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setGravityScale(0).setCcdEnabled(true))
      this.world.createCollider(RAPIER.ColliderDesc.ball(0.5).setRestitution(0.72).setFriction(0.85), body)
      this.bodies.push(body)
    }
    this.ready = true
  }

  step(): void {
    if (!this.world || !this.ready) return
    this.world.step()
  }

  reset(slot: number, x: number, z: number): void {
    const body = this.bodies[slot]
    if (!body) return
    body.setTranslation({ x, y: 0.6, z }, true)
    body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    body.setAngvel({ x: 0, y: 0, z: 0 }, true)
  }

  applyImpulse(slot: number, x: number, z: number): void {
    this.bodies[slot]?.applyImpulse({ x, y: 0, z }, true)
  }

  position(slot: number): { x: number; z: number } {
    const translation = this.bodies[slot]?.translation()
    return translation ? { x: translation.x, z: translation.z } : { x: 0, z: 0 }
  }
}
