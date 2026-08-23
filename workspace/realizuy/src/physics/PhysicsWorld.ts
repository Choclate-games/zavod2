import RAPIER from '@dimforge/rapier3d-compat'

export const COLLISION_GROUPS = {
  PLAYER: 0x0001000e, // player collides with terrain, enemies, props
  ENEMY: 0x0002000f,  // enemy collides with terrain, player, enemies, props
  PROP: 0x0004000f,   // prop collides with everything
  TERRAIN: 0x00080007, // walls and ground
}

export class PhysicsWorld {
  private static instance: PhysicsWorld
  public RAPIER!: typeof RAPIER
  public world!: RAPIER.World
  public isReady = false

  public static getInstance(): PhysicsWorld {
    if (!PhysicsWorld.instance) {
      PhysicsWorld.instance = new PhysicsWorld()
    }
    return PhysicsWorld.instance
  }

  public async init(): Promise<void> {
    if (this.isReady) return
    await RAPIER.init()
    this.RAPIER = RAPIER
    const gravity = { x: 0.0, y: -19.62, z: 0.0 }
    this.world = new RAPIER.World(gravity)
    this.createArenaBounds()
    this.isReady = true
  }

  private createArenaBounds(): void {
    const R = this.RAPIER
    // Floor: 24x24 arena
    const groundBodyDesc = R.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0)
    const groundBody = this.world.createRigidBody(groundBodyDesc)
    const groundColliderDesc = R.ColliderDesc.cuboid(16, 0.5, 16)
      .setFriction(0.6)
      .setRestitution(0.1)
    this.world.createCollider(groundColliderDesc, groundBody)

    // Octagonal walls surrounding arena with radius 12m
    const sides = 8
    const radius = 12
    const wallHeight = 4
    const halfThickness = 0.5

    for (let i = 0; i < sides; i++) {
      const angle1 = (i / sides) * Math.PI * 2
      const angle2 = ((i + 1) / sides) * Math.PI * 2
      const midAngle = (angle1 + angle2) / 2
      const segLength = 2 * radius * Math.sin(Math.PI / sides)

      const wx = Math.cos(midAngle) * radius
      const wz = Math.sin(midAngle) * radius

      const wallBodyDesc = R.RigidBodyDesc.fixed()
        .setTranslation(wx, wallHeight / 2, wz)
        .setRotation({
          x: 0,
          y: Math.sin((-midAngle + Math.PI / 2) / 2),
          z: 0,
          w: Math.cos((-midAngle + Math.PI / 2) / 2),
        })

      const wallBody = this.world.createRigidBody(wallBodyDesc)
      const wallColliderDesc = R.ColliderDesc.cuboid(segLength / 2, wallHeight / 2, halfThickness)
        .setFriction(0.4)
        .setRestitution(0.2)
      this.world.createCollider(wallColliderDesc, wallBody)
    }
  }

  public step(): void {
    if (!this.isReady) return
    this.world.step()
  }

  public removeRigidBody(body: RAPIER.RigidBody): void {
    if (!this.isReady || !body) return
    try {
      this.world.removeRigidBody(body)
    } catch {}
  }
}

export const physicsWorld = PhysicsWorld.getInstance()
