import RAPIER from '@dimforge/rapier3d-compat';
import { ARENA_SIZE, ARENA_HALF } from '../core/Constants';

export class PhysicsWorld {
  private static instance: PhysicsWorld;
  public world: RAPIER.World | null = null;
  public isReady = false;
  private accumulator = 0;
  public readonly fixedTimeStep = 1 / 60;

  private constructor() {}

  public static getInstance(): PhysicsWorld {
    if (!PhysicsWorld.instance) {
      PhysicsWorld.instance = new PhysicsWorld();
    }
    return PhysicsWorld.instance;
  }

  public async init(): Promise<void> {
    try {
      await RAPIER.init();
      const gravity = { x: 0.0, y: -9.81, z: 0.0 };
      this.world = new RAPIER.World(gravity);
      this.isReady = true;
      this.setupArenaBoundaries();
      console.log('[PhysicsWorld] Rapier3D initialized successfully.');
    } catch (e) {
      console.error('[PhysicsWorld] Failed to init Rapier3D:', e);
    }
  }

  private setupArenaBoundaries(): void {
    if (!this.world) return;

    // Ground Plane Collider
    const groundDesc = RAPIER.ColliderDesc.cuboid(ARENA_HALF, 0.5, ARENA_HALF)
      .setTranslation(0, -0.5, 0)
      .setFriction(0.85)
      .setRestitution(0.1);
    this.world.createCollider(groundDesc);

    // 4 Perimeter Walls
    const wallThickness = 2.0;
    const wallHeight = 4.0;

    // North (+Z)
    const northDesc = RAPIER.ColliderDesc.cuboid(ARENA_HALF, wallHeight, wallThickness)
      .setTranslation(0, wallHeight, ARENA_HALF)
      .setRestitution(0.2);
    this.world.createCollider(northDesc);

    // South (-Z)
    const southDesc = RAPIER.ColliderDesc.cuboid(ARENA_HALF, wallHeight, wallThickness)
      .setTranslation(0, wallHeight, -ARENA_HALF)
      .setRestitution(0.2);
    this.world.createCollider(southDesc);

    // East (+X)
    const eastDesc = RAPIER.ColliderDesc.cuboid(wallThickness, wallHeight, ARENA_HALF)
      .setTranslation(ARENA_HALF, wallHeight, 0)
      .setRestitution(0.2);
    this.world.createCollider(eastDesc);

    // West (-X)
    const westDesc = RAPIER.ColliderDesc.cuboid(wallThickness, wallHeight, ARENA_HALF)
      .setTranslation(-ARENA_HALF, wallHeight, 0)
      .setRestitution(0.2);
    this.world.createCollider(westDesc);
  }

  public step(deltaTime: number): void {
    if (!this.world || !this.isReady) return;

    // Fixed timestep accumulator to guarantee deterministic physics
    const clampedDelta = Math.min(deltaTime, 0.1);
    this.accumulator += clampedDelta;

    let steps = 0;
    while (this.accumulator >= this.fixedTimeStep && steps < 2) {
      this.world.step();
      this.accumulator -= this.fixedTimeStep;
      steps++;
    }
    if (this.accumulator >= this.fixedTimeStep) {
      this.accumulator = 0; // Prevent spiral of death
    }
  }
}

export const physicsWorld = PhysicsWorld.getInstance();
