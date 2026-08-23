import RAPIER from '@dimforge/rapier3d-compat';

export class PhysicsWorld {
  private world: RAPIER.World | null = null;
  private isInitialized = false;
  private accumulator = 0;
  private readonly fixedDt = 1 / 60;

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    await RAPIER.init();
    const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
    this.world = new RAPIER.World(gravity);
    this.isInitialized = true;
    this.setupStaticBoundaries();
  }

  private setupStaticBoundaries(): void {
    if (!this.world) return;

    // Пол платформы обороны (30м x 20м)
    const groundDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0);
    const groundBody = this.world.createRigidBody(groundDesc);
    const groundCollider = RAPIER.ColliderDesc.cuboid(20, 0.5, 20);
    this.world.createCollider(groundCollider, groundBody);

    // Бруствер / Оборонительная стена
    const wallDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0.6, -6);
    const wallBody = this.world.createRigidBody(wallDesc);
    const wallCollider = RAPIER.ColliderDesc.cuboid(14, 0.6, 0.5);
    this.world.createCollider(wallCollider, wallBody);

    // Задняя стена бункера
    const backWallDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 2, 7);
    const backWallBody = this.world.createRigidBody(backWallDesc);
    const backWallCollider = RAPIER.ColliderDesc.cuboid(15, 2, 0.5);
    this.world.createCollider(backWallCollider, backWallBody);
  }

  public step(dt: number): void {
    if (!this.world) return;
    const clampedDt = Math.min(dt, 0.1);
    this.accumulator += clampedDt;

    while (this.accumulator >= this.fixedDt) {
      this.world.step();
      this.accumulator -= this.fixedDt;
    }
  }

  public getRawWorld(): RAPIER.World | null {
    return this.world;
  }
}
