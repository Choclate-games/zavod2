import RAPIER from '@dimforge/rapier3d-compat'

export interface ChunkBody {
  body: RAPIER.RigidBody
  collider: RAPIER.Collider
  halfX: number
  halfY: number
  halfZ: number
}

/** Rapier-мир: фиксированный шаг 1/60, тела и коллайдеры освобождаются явно.
 * cuboid() получает ПОЛУразмеры. */
export class PhysicsWorld {
  private world: RAPIER.World | null = null
  private chunks: ChunkBody[] = []

  async init(): Promise<void> {
    await RAPIER.init()
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    this.world.timestep = 1 / 60
  }

  createStaticBox(hx: number, hy: number, hz: number, x: number, y: number, z: number): void {
    const world = this.requireWorld()
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z))
    world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz), body)
  }

  /** Динамическая глыба обвала; группы столкновений заданы с обеих сторон
   * (чанки ↔ статика/чанки). Возвращает индекс для синхронизации меша. */
  spawnChunk(
    index: number,
    hx: number, hy: number, hz: number,
    x: number, y: number, z: number,
    vx: number, vy: number, vz: number,
  ): void {
    const world = this.requireWorld()
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setLinvel(vx, vy, vz)
        .setAngvel({ x: (Math.sin(index * 12.9) * 2) % 1, y: (Math.cos(index * 7.7) * 2) % 1, z: (Math.sin(index * 3.3) * 2) % 1 })
        .setLinearDamping(0.15)
        .setAngularDamping(0.35)
        .setCcdEnabled(true),
    )
    const collider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy, hz)
        .setRestitution(0.08)
        .setFriction(0.92),
      body,
    )
    this.chunks[index] = { body, collider, halfX: hx, halfY: hy, halfZ: hz }
  }

  getChunk(index: number): ChunkBody | undefined {
    return this.chunks[index]
  }

  step(): void {
    this.requireWorld().step()
  }

  /** Рестарт — телепорт и удаление тел, мир не пересобирается. */
  removeChunks(): void {
    const world = this.world
    if (!world) return
    for (let i = 0; i < this.chunks.length; i++) {
      const chunk = this.chunks[i]
      if (!chunk) continue
      world.removeRigidBody(chunk.body)
      this.chunks[i] = undefined as unknown as ChunkBody
    }
    this.chunks.length = 0
  }

  private requireWorld(): RAPIER.World {
    if (!this.world) throw new Error('PhysicsWorld is not initialized')
    return this.world
  }
}
