// src/physics/PhysicsWorld.ts
// Rapier3D physics wrapper with fixed 60Hz timestep accumulator & collision layers

import RAPIER from '@dimforge/rapier3d-compat';

export const COLLISION_GROUPS = {
  GROUND: 0x0001,
  PLAYER: 0x0002,
  BASE_CORE: 0x0004,
  TURRET: 0x0008,
  ENEMY: 0x0010,
  PLAYER_PROJECTILE: 0x0020,
  ENEMY_PROJECTILE: 0x0040,
  PICKUP: 0x0080,
};

export class PhysicsWorld {
  private static instance: PhysicsWorld;
  private rapier!: typeof RAPIER;
  private world!: RAPIER.World;
  private isInitialized = false;

  private readonly FIXED_TIME_STEP = 1 / 60;
  private accumulator = 0;

  private constructor() {}

  public static getInstance(): PhysicsWorld {
    if (!PhysicsWorld.instance) {
      PhysicsWorld.instance = new PhysicsWorld();
    }
    return PhysicsWorld.instance;
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    await RAPIER.init();
    this.rapier = RAPIER;
    const gravity = new RAPIER.Vector3(0.0, -18.0, 0.0);
    this.world = new RAPIER.World(gravity);
    this.isInitialized = true;
    this.createArenaBoundaries();
  }

  public getRapier(): typeof RAPIER {
    return this.rapier;
  }

  public getWorld(): RAPIER.World {
    return this.world;
  }

  private createArenaBoundaries(): void {
    // Arena ground plane
    const groundDesc = this.rapier.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0);
    const groundBody = this.world.createRigidBody(groundDesc);
    const groundCollider = this.rapier.ColliderDesc.cuboid(40, 0.5, 40)
      .setCollisionGroups(
        this.makeInteractionGroup(COLLISION_GROUPS.GROUND, 0xffff)
      );
    this.world.createCollider(groundCollider, groundBody);

    // Perimeter boundary walls (radius ~32)
    const wallThickness = 1.0;
    const wallHeight = 4.0;
    const size = 32.0;

    const walls = [
      { x: 0, z: -size, sx: size, sz: wallThickness },
      { x: 0, z: size, sx: size, sz: wallThickness },
      { x: -size, z: 0, sx: wallThickness, sz: size },
      { x: size, z: 0, sx: wallThickness, sz: size },
    ];

    walls.forEach((w) => {
      const bodyDesc = this.rapier.RigidBodyDesc.fixed().setTranslation(w.x, wallHeight / 2, w.z);
      const body = this.world.createRigidBody(bodyDesc);
      const colliderDesc = this.rapier.ColliderDesc.cuboid(w.sx, wallHeight / 2, w.sz)
        .setCollisionGroups(
          this.makeInteractionGroup(COLLISION_GROUPS.GROUND, COLLISION_GROUPS.PLAYER | COLLISION_GROUPS.ENEMY)
        );
      this.world.createCollider(colliderDesc, body);
    });
  }

  public makeInteractionGroup(membership: number, filter: number): number {
    return (membership << 16) | (filter & 0xffff);
  }

  public step(dt: number): void {
    if (!this.isInitialized) return;
    // Clamp dt to max 0.1s to prevent physics explosion/tunneling on lag spike
    const clampedDt = Math.min(dt, 0.1);
    this.accumulator += clampedDt;

    while (this.accumulator >= this.FIXED_TIME_STEP) {
      this.world.step();
      this.accumulator -= this.FIXED_TIME_STEP;
    }
  }

  public resetAccumulator(): void {
    this.accumulator = 0;
  }
}

export const physicsWorld = PhysicsWorld.getInstance();
